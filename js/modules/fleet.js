/* ============================================================
 * Solar Dominion — Fleet Module
 * Player fleet management: build ships, assign AI orders,
 * fleet formations, and autonomous combat.
 * ============================================================ */
var Fleet = (function () {
    'use strict';

    var _ships = [];  // player's fleet ships (AI-controlled)
    var _nextId = 1;

    function init() {
        _ships = [];
        _nextId = 1;
    }

    function getShips() { return _ships; }
    function getShipCount() { return _ships.length; }

    function buildShip(name, hull, engine, weapons, shield) {
        if (_ships.length >= Config.FLEET.MAX_FLEET_SIZE) return { success: false, reason: 'Fleet is full' };

        // Check if hull is actually a template ID
        var template = ShipTemplates.getTemplate(hull);
        if (template) {
            return buildFromTemplate(name, template.id);
        }

        var hullData = Config.HULL_TYPES[hull];
        var engineData = Config.ENGINE_TYPES[engine];
        var shieldData = Config.SHIELD_TYPES[shield];
        if (!hullData || !engineData || !shieldData) return { success: false, reason: 'Invalid components' };

        var cost = {
            credits: (hullData.cost || 0) + (engineData.cost || 0) + (shieldData.cost || 0),
            metal: (hullData.metal || 0) + (shieldData.metal || 0),
            electronics: (engineData.electronics || 0) + (shieldData.electronics || 0)
        };

        var weaponList = Array.isArray(weapons) ? weapons : [weapons];
        for (var w = 0; w < weaponList.length; w++) {
            var wData = Config.WEAPON_TYPES[weaponList[w]];
            if (wData) {
                cost.credits += wData.cost || 0;
                cost.metal += wData.metal || 0;
                cost.electronics += wData.electronics || 0;
            }
        }

        if (!Economy.canAfford(cost)) return { success: false, reason: 'Cannot afford', cost: cost };
        Economy.payCosts(cost);

        var playerShip = Ship.getShip();
        var fleetShip = {
            id: 'fleet_' + (_nextId++),
            name: name || 'Ship ' + _nextId,
            hull: hull,
            engine: engine,
            weapons: weaponList,
            shield: shield,
            hp: hullData.hp,
            maxHp: hullData.hp,
            shieldHp: shieldData.shieldHP,
            maxShieldHp: shieldData.shieldHP,
            x: playerShip.x + (Math.random() - 0.5) * 100,
            y: playerShip.y + (Math.random() - 0.5) * 100,
            angle: 0,
            speed: Config.BASE_SPEED * hullData.maxSpeed * engineData.speedMult * 0.9,
            order: 'follow',
            target: null,
            aiTimer: 0,
            fireTimer: 0,
            dead: false
        };
        _ships.push(fleetShip);
        Events.emit('fleet_ship_built', { ship: fleetShip });
        return { success: true, ship: fleetShip, cost: cost };
    }

    // Build a fleet ship from a template (grid-based)
    function buildFromTemplate(name, templateId) {
        if (_ships.length >= Config.FLEET.MAX_FLEET_SIZE) return { success: false, reason: 'Fleet is full' };

        var template = ShipTemplates.getTemplate(templateId);
        if (!template) return { success: false, reason: 'Unknown template' };

        var grid = ShipGrid.fromTemplate(template.hullClass, template.blocks);
        var stats = grid.stats;

        // Cost based on all blocks in template
        var totalCost = 0;
        for (var r = 0; r < grid.h; r++) {
            for (var c = 0; c < grid.w; c++) {
                var cell = grid.cells[r][c];
                if (cell) {
                    var def = Config.BLOCK_TYPES[cell.type];
                    if (def) totalCost += def.cost;
                }
            }
        }
        // Hull class cost
        var hc = Config.HULL_CLASSES[template.hullClass];
        if (hc) totalCost += hc.cost;

        if (!Economy.spendCredits(totalCost)) return { success: false, reason: 'Not enough credits (need ' + totalCost + ')' };

        var playerShip = Ship.getShip();
        var fleetShip = {
            id: 'fleet_' + (_nextId++),
            name: name || template.name,
            templateId: templateId,
            grid: grid,
            hp: stats.totalHP,
            maxHp: stats.totalHP,
            shieldHp: stats.shieldHP,
            maxShieldHp: stats.shieldHP,
            x: playerShip.x + (Math.random() - 0.5) * 100,
            y: playerShip.y + (Math.random() - 0.5) * 100,
            angle: 0,
            speed: Config.BASE_SPEED * stats.maxSpeed * stats.powerRatio * 0.9,
            order: 'follow',
            target: null,
            aiTimer: 0,
            fireTimer: 0,
            dead: false,
            weapon: (stats.weapons.length > 0) ? stats.weapons[0].typeKey : null,
            weaponDef: (stats.weapons.length > 0) ? stats.weapons[0].def : null
        };
        _ships.push(fleetShip);
        Events.emit('fleet_ship_built', { ship: fleetShip });
        return { success: true, ship: fleetShip, cost: totalCost };
    }

    function setOrder(shipId, order, target) {
        for (var i = 0; i < _ships.length; i++) {
            if (_ships[i].id === shipId) {
                _ships[i].order = order;
                _ships[i].target = target || null;
                return true;
            }
        }
        return false;
    }

    function setAllOrders(order, target) {
        for (var i = 0; i < _ships.length; i++) {
            _ships[i].order = order;
            _ships[i].target = target || null;
        }
    }

    function tick() {
        var playerShip = Ship.getShip();

        for (var i = _ships.length - 1; i >= 0; i--) {
            var s = _ships[i];
            if (s.dead) { _ships.splice(i, 1); continue; }

            // Upkeep
            // (handled by economy tick)

            // Shield regen
            var shieldData = Config.SHIELD_TYPES[s.shield];
            if (s.shieldHp < s.maxShieldHp && shieldData) {
                s.shieldHp = Math.min(s.maxShieldHp, s.shieldHp + shieldData.regenRate);
            }

            // Fire cooldown
            if (s.fireTimer > 0) s.fireTimer--;

            // AI behavior based on order
            s.aiTimer--;
            if (s.aiTimer <= 0) {
                s.aiTimer = Config.FLEET.AI_UPDATE_INTERVAL;
                _updateAI(s, playerShip);
            }

            // Move toward current destination
            if (s.destX !== undefined && s.destY !== undefined) {
                var dx = s.destX - s.x, dy = s.destY - s.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 15) {
                    s.angle = Math.atan2(dy, dx);
                    s.x += Math.cos(s.angle) * s.speed;
                    s.y += Math.sin(s.angle) * s.speed;
                }
            }

            // Attack nearby hostiles
            _fleetCombat(s);
        }
    }

    function _updateAI(s, playerShip) {
        switch (s.order) {
            case 'follow':
                var offset = _ships.indexOf(s);
                var angle = playerShip.angle + Math.PI + (offset - _ships.length / 2) * 0.3;
                s.destX = playerShip.x + Math.cos(angle) * Config.FLEET.FORMATION_SPACING;
                s.destY = playerShip.y + Math.sin(angle) * Config.FLEET.FORMATION_SPACING;
                break;
            case 'patrol':
                if (!s.patrolCenter) s.patrolCenter = { x: s.x, y: s.y };
                s.destX = s.patrolCenter.x + (Math.random() - 0.5) * 600;
                s.destY = s.patrolCenter.y + (Math.random() - 0.5) * 600;
                break;
            case 'attack':
                // Update target to nearest hostile NPC
                var nearestHostile = _findNearestHostile(s);
                if (nearestHostile) {
                    s.target = nearestHostile;
                    s.destX = nearestHostile.x;
                    s.destY = nearestHostile.y;
                }
                break;
            case 'escort':
                // Stay close to player, slightly ahead
                var eAngle = playerShip.angle + ((_ships.indexOf(s) % 2 === 0) ? 0.4 : -0.4);
                s.destX = playerShip.x + Math.cos(eAngle) * (Config.FLEET.FORMATION_SPACING * 0.8);
                s.destY = playerShip.y + Math.sin(eAngle) * (Config.FLEET.FORMATION_SPACING * 0.8);
                break;
            case 'defend':
                // Stable defend positions around player (no jitter)
                var dIdx = _ships.indexOf(s);
                var dAngle = (dIdx / _ships.length) * Math.PI * 2;
                s.destX = playerShip.x + Math.cos(dAngle) * 120;
                s.destY = playerShip.y + Math.sin(dAngle) * 120;
                break;
        }
    }

    function _findNearestHostile(s) {
        var npcs = World.getNPCs();
        var best = null, bestDist = Infinity;
        for (var i = 0; i < npcs.length; i++) {
            if (npcs[i].dead || !Factions.isHostile(npcs[i].faction)) continue;
            var dx = npcs[i].x - s.x, dy = npcs[i].y - s.y;
            var d = dx * dx + dy * dy;
            if (d < bestDist) { bestDist = d; best = npcs[i]; }
        }
        return best;
    }

    function _fleetCombat(s) {
        if (s.weapons.length === 0) return;
        var npcs = World.getNPCs();
        for (var i = 0; i < npcs.length; i++) {
            var npc = npcs[i];
            if (npc.dead) continue;
            if (!Factions.isHostile(npc.faction)) continue;
            var dx = npc.x - s.x, dy = npc.y - s.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < Config.COMBAT.AGGRO_RANGE && s.fireTimer <= 0) {
                var wData = Config.WEAPON_TYPES[s.weapons[0]];
                if (wData && dist < wData.range) {
                    s.angle = Math.atan2(dy, dx);
                    World.addProjectile({
                        x: s.x + Math.cos(s.angle) * 15,
                        y: s.y + Math.sin(s.angle) * 15,
                        angle: s.angle,
                        speed: Config.COMBAT.PROJECTILE_SPEED,
                        damage: wData.damage * 0.8,
                        type: wData.type,
                        owner: s.id,
                        life: Math.ceil(wData.range / Config.COMBAT.PROJECTILE_SPEED)
                    });
                    s.fireTimer = wData.fireRate;
                }
                break;
            }
        }
    }

    function getUpkeepCost() {
        return _ships.length * Config.ECONOMY.FLEET_UPKEEP_PER_SHIP;
    }

    function serialize() {
        return {
            ships: JSON.parse(JSON.stringify(_ships)),
            nextId: _nextId
        };
    }

    function deserialize(data) {
        if (!data) return;
        _ships = data.ships || [];
        _nextId = data.nextId || 1;
    }

    return {
        init: init,
        getShips: getShips,
        getShipCount: getShipCount,
        buildShip: buildShip,
        buildFromTemplate: buildFromTemplate,
        setOrder: setOrder,
        setAllOrders: setAllOrders,
        tick: tick,
        getUpkeepCost: getUpkeepCost,
        serialize: serialize,
        deserialize: deserialize
    };
})();
