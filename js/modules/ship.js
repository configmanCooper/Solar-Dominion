/* ============================================================
 * Solar Dominion — Ship Module
 * Player ship state with block-grid based customization.
 * ============================================================ */
var Ship = (function () {
    'use strict';

    var _ship = null;
    var _activeWeaponIdx = 0;

    function _defaultShip() {
        // Build starter grid from moon_patrol template
        var starter = ShipTemplates.getStarterTemplate();
        var grid = ShipGrid.fromTemplate(starter.hullClass, starter.blocks);

        return {
            // Position & movement
            x: 7500, y: 7500,
            angle: 0,
            vx: 0, vy: 0,
            docked: true,
            dockedAt: 'luna',

            // Block grid (replaces old hull/engine/weapons/shield/specials)
            grid: grid,

            // Derived stats cache (updated via _recalcStats)
            maxHp: 0,
            hp: 0,
            maxShieldHp: 0,
            shieldHp: 0,
            maxSpeed: 0,
            acceleration: 0,
            cargo: 0,
            maxFuel: 0,
            fireTimer: 0,

            // Resources in cargo
            inventory: {
                metal: 0,
                electronics: 0,
                food: 20,
                luxury_goods: 0,
                chemical_propellant: 80,
                xenon_gas: 0,
                plasma_cells: 0,
                fusion_cores: 0
            }
        };
    }

    function init() {
        _ship = _defaultShip();
        _activeWeaponIdx = 0;
        _recalcStats();

        // Fill fuel to max capacity
        var stats = _ship.grid.stats;
        if (stats && stats.fuelTypes) {
            for (var ft in stats.fuelTypes) {
                _ship.inventory[ft] = _ship.maxFuel || 180;
            }
        }

        // Set starting position to Luna's current orbital position
        var luna = World.getLocation('luna');
        if (luna) {
            _ship.x = luna.x;
            _ship.y = luna.y;
        }
    }

    function _recalcStats() {
        var stats = ShipGrid.deriveStats(_ship.grid);
        _ship.grid.stats = stats;

        _ship.maxHp = stats.totalHP;
        _ship.hp = Math.min(_ship.hp || stats.totalHP, stats.totalHP);
        _ship.maxShieldHp = stats.shieldHP;
        _ship.shieldHp = Math.min(_ship.shieldHp || stats.shieldHP, stats.shieldHP);
        _ship.maxSpeed = stats.maxSpeed;
        _ship.acceleration = stats.acceleration;
        _ship.cargo = stats.cargoCapacity;
        _ship.maxFuel = stats.fuelCapacity;

        // Ensure hp is set on first init
        if (_ship.hp === 0 && stats.totalHP > 0) _ship.hp = stats.totalHP;
        if (_ship.shieldHp === 0 && stats.shieldHP > 0) _ship.shieldHp = stats.shieldHP;
    }

    function getShip() { return _ship; }

    function getGrid() { return _ship.grid; }

    function getSpeed() {
        var stats = _ship.grid.stats;
        if (!stats) return Config.BASE_SPEED;
        return Config.BASE_SPEED * stats.maxSpeed * stats.powerRatio;
    }

    function getStats() {
        return _ship.grid.stats || ShipGrid.deriveStats(_ship.grid);
    }

    function getFuelType() {
        // Return the primary fuel type (from first working engine)
        var stats = _ship.grid.stats;
        if (stats && stats.engines.length > 0) {
            return stats.engines[0].def.fuelType;
        }
        return 'chemical_propellant';
    }

    function getFuelTypes() {
        var stats = _ship.grid.stats;
        return stats ? stats.fuelTypes : {};
    }

    function getFuelRate() {
        var stats = _ship.grid.stats;
        if (!stats) return 0.5;
        var total = 0;
        for (var ft in stats.fuelTypes) {
            total += stats.fuelTypes[ft];
        }
        return total;
    }

    function consumeFuel(amount) {
        // Consume fuel proportionally from all fuel types needed
        var fuelTypes = getFuelTypes();
        var hasAllFuel = true;
        for (var ft in fuelTypes) {
            var available = _ship.inventory[ft] || 0;
            if (available <= 0) { hasAllFuel = false; break; }
        }
        if (!hasAllFuel) return false;
        for (var ft2 in fuelTypes) {
            var rate = fuelTypes[ft2] * amount;
            _ship.inventory[ft2] = Math.max(0, (_ship.inventory[ft2] || 0) - rate);
        }
        return true;
    }

    var _fuelResources = {
        'chemical_propellant': true, 'xenon_gas': true,
        'plasma_cells': true, 'fusion_cores': true
    };

    function getCargoUsed() {
        var used = 0;
        for (var key in _ship.inventory) {
            if (_fuelResources[key]) continue; // fuel uses fuel capacity, not cargo
            used += (_ship.inventory[key] || 0);
        }
        return used;
    }

    function getFuelUsed() {
        var used = 0;
        for (var key in _fuelResources) {
            used += (_ship.inventory[key] || 0);
        }
        return used;
    }

    function getCargoFree() {
        return _ship.cargo - getCargoUsed();
    }

    function getFuelFree() {
        return (_ship.maxFuel || 0) - getFuelUsed();
    }

    function addItem(resource, amount) {
        if (_fuelResources[resource]) {
            // Fuel uses fuel capacity
            var fuelFree = getFuelFree();
            var actual = Math.min(amount, fuelFree);
            if (actual <= 0) return 0;
            _ship.inventory[resource] = (_ship.inventory[resource] || 0) + actual;
            return actual;
        }
        var free = getCargoFree();
        var actual2 = Math.min(amount, free);
        if (actual2 <= 0) return 0;
        _ship.inventory[resource] = (_ship.inventory[resource] || 0) + actual2;
        return actual2;
    }

    function removeItem(resource, amount) {
        var have = _ship.inventory[resource] || 0;
        var actual = Math.min(have, amount);
        _ship.inventory[resource] = have - actual;
        return actual;
    }

    // Place a block on the player's ship grid
    function placeBlock(row, col, blockTypeKey) {
        if (!_ship.docked) return false;
        var result = ShipGrid.placeBlock(_ship.grid, row, col, blockTypeKey);
        if (result) _recalcStats();
        return result;
    }

    // Remove a block from the player's ship grid
    function removeShipBlock(row, col) {
        if (!_ship.docked) return null;
        var result = ShipGrid.removeBlock(_ship.grid, row, col);
        if (result) _recalcStats();
        return result;
    }

    // Legacy upgrade support — kept for backwards compatibility with UI
    function upgrade(component, type) {
        if (!_ship.docked) return false;
        Events.emit('ship_upgraded', { component: component, type: type });
        return true;
    }

    // Change hull class (creates new grid, preserving what fits)
    function changeHullClass(newClass) {
        if (!_ship.docked) return false;
        var hc = Config.HULL_CLASSES[newClass];
        if (!hc) return false;

        var oldGrid = _ship.grid;
        var newGrid = ShipGrid.createGrid(newClass);

        // Copy blocks that fit
        for (var r = 0; r < Math.min(oldGrid.h, newGrid.h); r++) {
            for (var c = 0; c < Math.min(oldGrid.w, newGrid.w); c++) {
                if (oldGrid.cells[r][c]) {
                    newGrid.cells[r][c] = {
                        type: oldGrid.cells[r][c].type,
                        hp: oldGrid.cells[r][c].hp,
                        maxHp: oldGrid.cells[r][c].maxHp
                    };
                }
            }
        }
        newGrid.stats = ShipGrid.deriveStats(newGrid);
        _ship.grid = newGrid;
        _recalcStats();
        Events.emit('ship_upgraded', { component: 'hullClass', type: newClass });
        return true;
    }

    function dock(locationId) {
        _ship.docked = true;
        _ship.dockedAt = locationId;
        _ship.vx = 0;
        _ship.vy = 0;
        _waypoint = null;
        Events.emit('ship_docked', { locationId: locationId });
    }

    function undock() {
        _ship.docked = false;
        _ship.dockedAt = null;
        Events.emit('ship_undocked', {});
    }

    function takeDamage(amount, type) {
        // Global shield absorbs first
        if (_ship.shieldHp > 0) {
            var shieldDmg = Math.min(_ship.shieldHp, amount * 0.7);
            _ship.shieldHp -= shieldDmg;
            amount -= shieldDmg;
        }

        if (amount <= 0) return;

        // Locational damage: pick a cell to hit
        var hitPos = ShipGrid.hitCell(_ship.grid, 0, _ship.angle);
        if (hitPos) {
            var result = ShipGrid.damageBlock(_ship.grid, hitPos.r, hitPos.c, amount);
            _recalcStats();

            if (result.cockpitHit) {
                _ship.hp = 0;
                Events.emit('player_destroyed', {});
                return;
            }
        }

        // Update aggregate HP
        _ship.hp = _ship.grid.stats ? _ship.grid.stats.totalHP : 0;
        if (_ship.hp <= 0) {
            Events.emit('player_destroyed', {});
        }
    }

    function repair(amount) {
        ShipGrid.repairAll(_ship.grid, amount);
        _recalcStats();
    }

    // Full repair of a specific block at dock
    function repairBlock(row, col) {
        return ShipGrid.repairBlock(_ship.grid, row, col);
    }

    function tick() {
        if (_ship.docked) {
            var dockedLoc = World.getLocation(_ship.dockedAt);
            if (dockedLoc) {
                _ship.x = dockedLoc.x;
                _ship.y = dockedLoc.y;
            }
            return;
        }

        // Shield regen
        var stats = _ship.grid.stats;
        if (stats && _ship.shieldHp < _ship.maxShieldHp) {
            _ship.shieldHp = Math.min(_ship.maxShieldHp, _ship.shieldHp + stats.effectiveShieldRegen);
        }

        // Auto-repair from repair bays
        if (stats && stats.repairRate > 0) {
            ShipGrid.repairAll(_ship.grid, stats.repairRate * stats.powerRatio);
            // Update aggregate HP
            var newStats = ShipGrid.deriveStats(_ship.grid);
            _ship.grid.stats = newStats;
            _ship.hp = newStats.totalHP;
            _ship.maxHp = newStats.totalHP;
        }

        // Fire cooldown
        if (_ship.fireTimer > 0) _ship.fireTimer--;
    }

    // Waypoint for click-to-move
    var _waypoint = null;

    function setWaypoint(wx, wy) {
        _waypoint = { x: wx, y: wy };
    }

    function clearWaypoint() {
        _waypoint = null;
    }

    function getWaypoint() {
        return _waypoint;
    }

    function handleInput() {
        if (_ship.docked) {
            if (Input.justPressed('DOCK')) {
                Events.emit('ship_docked', { locationId: _ship.dockedAt });
            }
            return;
        }

        var maxSpd = getSpeed();
        var accel = _ship.acceleration * Config.BASE_SPEED * 0.5;
        if (accel < 0.3) accel = 0.3; // minimum acceleration so ship always moves
        var moving = false;

        // Rotation — A/D turn left/right
        if (Input.isDown('LEFT'))  _ship.angle -= Config.ROTATION_SPEED;
        if (Input.isDown('RIGHT')) _ship.angle += Config.ROTATION_SPEED;

        // W = thrust forward, S = reverse thrust
        if (Input.isDown('UP')) {
            _waypoint = null;
            if (consumeFuel(1)) {
                _ship.vx += Math.cos(_ship.angle) * accel;
                _ship.vy += Math.sin(_ship.angle) * accel;
                moving = true;
            }
        }
        if (Input.isDown('DOWN')) {
            _waypoint = null;
            if (consumeFuel(1)) {
                _ship.vx -= Math.cos(_ship.angle) * accel * 0.5;
                _ship.vy -= Math.sin(_ship.angle) * accel * 0.5;
                moving = true;
            }
        }

        // Click-to-move waypoint following
        if (_waypoint && !moving) {
            var wpDx = _waypoint.x - _ship.x;
            var wpDy = _waypoint.y - _ship.y;
            var wpDist = Math.sqrt(wpDx * wpDx + wpDy * wpDy);

            if (wpDist < maxSpd * 2) {
                // Arrived at waypoint
                _waypoint = null;
                _ship.vx *= 0.5;
                _ship.vy *= 0.5;
            } else {
                // Move toward waypoint
                var wpNx = wpDx / wpDist;
                var wpNy = wpDy / wpDist;
                _ship.angle = Math.atan2(wpNy, wpNx);

                if (consumeFuel(1)) {
                    _ship.vx += wpNx * accel;
                    _ship.vy += wpNy * accel;
                    moving = true;
                }
            }
        }

        // Cap speed
        var v = Math.sqrt(_ship.vx * _ship.vx + _ship.vy * _ship.vy);
        if (v > maxSpd) {
            _ship.vx = (_ship.vx / v) * maxSpd;
            _ship.vy = (_ship.vy / v) * maxSpd;
        }

        // Apply velocity
        _ship.x += _ship.vx;
        _ship.y += _ship.vy;

        // Friction when not moving
        if (!moving) {
            _ship.vx *= 0.97;
            _ship.vy *= 0.97;
            // Stop very slow drift
            if (Math.abs(_ship.vx) < 0.01) _ship.vx = 0;
            if (Math.abs(_ship.vy) < 0.01) _ship.vy = 0;
        }

        // Clamp to world bounds
        _ship.x = Math.max(0, Math.min(Config.WORLD_W, _ship.x));
        _ship.y = Math.max(0, Math.min(Config.WORLD_H, _ship.y));

        // Fire weapon
        var weapons = _ship.grid.stats ? _ship.grid.stats.weapons : [];
        if (Input.isDown('FIRE') && _ship.fireTimer <= 0 && weapons.length > 0) {
            _fireWeapon(weapons);
        }

        // Weapon switch
        if (Input.justPressed('WEAPON_SWITCH') && weapons.length > 1) {
            _activeWeaponIdx = (_activeWeaponIdx + 1) % weapons.length;
            Events.emit('weapon_switched', { weapon: weapons[_activeWeaponIdx].typeKey });
        }

        // Dock
        if (Input.justPressed('DOCK')) {
            var nearby = World.getNearbyLocation(_ship.x, _ship.y, 100);
            if (nearby && nearby.dockable) {
                dock(nearby.id);
            }
        }
    }

    function _fireWeapon(weapons) {
        if (_activeWeaponIdx >= weapons.length) _activeWeaponIdx = 0;
        var w = weapons[_activeWeaponIdx];
        var def = w.def;
        if (!def) return;

        var effectiveFireRate = Math.ceil(def.fireRate / (_ship.grid.stats ? _ship.grid.stats.powerRatio : 1));
        _ship.fireTimer = effectiveFireRate;

        World.addProjectile({
            x: _ship.x + Math.cos(_ship.angle) * 20,
            y: _ship.y + Math.sin(_ship.angle) * 20,
            angle: _ship.angle,
            speed: Config.COMBAT.PROJECTILE_SPEED,
            damage: def.damage,
            type: def.dmgType || 'energy',
            owner: 'player',
            life: Math.ceil(def.range / Config.COMBAT.PROJECTILE_SPEED)
        });
    }

    function getActiveWeapon() {
        var weapons = _ship.grid.stats ? _ship.grid.stats.weapons : [];
        if (weapons.length === 0) return null;
        if (_activeWeaponIdx >= weapons.length) _activeWeaponIdx = 0;
        return weapons[_activeWeaponIdx].typeKey;
    }

    function getActiveWeaponDef() {
        var weapons = _ship.grid.stats ? _ship.grid.stats.weapons : [];
        if (weapons.length === 0) return null;
        if (_activeWeaponIdx >= weapons.length) _activeWeaponIdx = 0;
        return weapons[_activeWeaponIdx].def;
    }

    function serialize() {
        var data = {
            x: _ship.x, y: _ship.y, angle: _ship.angle,
            vx: _ship.vx, vy: _ship.vy,
            docked: _ship.docked, dockedAt: _ship.dockedAt,
            grid: ShipGrid.serializeGrid(_ship.grid),
            shieldHp: _ship.shieldHp,
            fireTimer: _ship.fireTimer,
            inventory: JSON.parse(JSON.stringify(_ship.inventory)),
            activeWeaponIdx: _activeWeaponIdx
        };
        return data;
    }

    function deserialize(data) {
        if (!data) return;
        _ship = {
            x: data.x, y: data.y, angle: data.angle,
            vx: data.vx, vy: data.vy,
            docked: data.docked, dockedAt: data.dockedAt,
            grid: data.grid ? ShipGrid.deserializeGrid(data.grid) : _defaultShip().grid,
            shieldHp: data.shieldHp || 0,
            fireTimer: data.fireTimer || 0,
            inventory: data.inventory || {},
            // Derived stats placeholders
            maxHp: 0, hp: 0, maxShieldHp: 0,
            maxSpeed: 0, acceleration: 0, cargo: 0, maxFuel: 0
        };
        _activeWeaponIdx = data.activeWeaponIdx || 0;
        _recalcStats();
    }

    return {
        init: init,
        getShip: getShip,
        getGrid: getGrid,
        getSpeed: getSpeed,
        getStats: getStats,
        getFuelType: getFuelType,
        getFuelTypes: getFuelTypes,
        getCargoUsed: getCargoUsed,
        getCargoFree: getCargoFree,
        getFuelUsed: getFuelUsed,
        getFuelFree: getFuelFree,
        addItem: addItem,
        removeItem: removeItem,
        placeBlock: placeBlock,
        removeShipBlock: removeShipBlock,
        changeHullClass: changeHullClass,
        upgrade: upgrade,
        dock: dock,
        undock: undock,
        takeDamage: takeDamage,
        repair: repair,
        repairBlock: repairBlock,
        tick: tick,
        handleInput: handleInput,
        getActiveWeapon: getActiveWeapon,
        getActiveWeaponDef: getActiveWeaponDef,
        setWaypoint: setWaypoint,
        clearWaypoint: clearWaypoint,
        getWaypoint: getWaypoint,
        serialize: serialize,
        deserialize: deserialize
    };
})();
