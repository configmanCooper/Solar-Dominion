/* ============================================================
 * Solar Dominion — Mining Module
 * Manages minable asteroids in asteroid fields, mining gameplay,
 * NPC miners, and resource extraction.
 * ============================================================ */
var Mining = (function () {
    'use strict';

    var _asteroids = [];       // all minable asteroid objects
    var _npcMiners = [];       // NPC mining ships
    var _miningState = null;   // player's active mining state
    var _respawnQueue = [];    // asteroids waiting to respawn
    var _tickCount = 0;

    function init() {
        _asteroids = [];
        _npcMiners = [];
        _miningState = null;
        _respawnQueue = [];
        _tickCount = 0;

        _spawnAllAsteroids();
        _spawnNPCMiners();
    }

    // ── Asteroid spawning ───────────────────────────────────

    function _spawnAllAsteroids() {
        var fields = Config.ASTEROID_FIELDS;
        for (var fieldId in fields) {
            if (!fields.hasOwnProperty(fieldId)) continue;
            var fieldConf = fields[fieldId];
            var loc = World.getLocation(fieldId);
            if (!loc) continue;

            for (var i = 0; i < fieldConf.asteroidCount; i++) {
                _asteroids.push(_createAsteroid(fieldId, loc, fieldConf, i));
            }
        }
    }

    function _createAsteroid(fieldId, loc, fieldConf, index) {
        // Position within field radius with some randomness
        var angle = (index / fieldConf.asteroidCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        var dist = loc.radius * 0.3 + Math.random() * loc.radius * 0.7;
        var ox = Math.cos(angle) * dist;
        var oy = Math.sin(angle) * dist;

        // Generate resources
        var resources = _rollResources(fieldConf);
        var totalRes = 0;
        for (var r in resources) totalRes += resources[r];

        return {
            id: fieldId + '_rock_' + index,
            fieldId: fieldId,
            offsetX: ox,
            offsetY: oy,
            x: loc.x + ox,
            y: loc.y + oy,
            radius: 4 + Math.random() * 6,
            resources: resources,
            maxResources: totalRes,
            depleted: false,
            respawnTimer: 0,
            colorSeed: Math.random()
        };
    }

    function _rollResources(fieldConf) {
        var weights = Config.MINING.RESOURCE_WEIGHTS;
        var overrides = fieldConf.resourceOverrides || {};
        var richness = fieldConf.richness || 1.0;

        // Build weighted pool
        var pool = [];
        var totalWeight = 0;
        for (var res in weights) {
            var w = weights[res] * (overrides[res] || 1.0);
            pool.push({ resource: res, weight: w });
            totalWeight += w;
        }

        // Pick 1-3 resource types
        var numTypes = 1 + Math.floor(Math.random() * 3);
        var resources = {};
        var totalAmount = Config.MINING.ASTEROID_MIN_RESOURCES +
            Math.floor(Math.random() * (Config.MINING.ASTEROID_MAX_RESOURCES - Config.MINING.ASTEROID_MIN_RESOURCES));
        totalAmount = Math.round(totalAmount * richness);

        for (var t = 0; t < numTypes; t++) {
            // Weighted random pick
            var roll = Math.random() * totalWeight;
            var cumulative = 0;
            for (var p = 0; p < pool.length; p++) {
                cumulative += pool[p].weight;
                if (roll <= cumulative) {
                    var amount = (t === numTypes - 1)
                        ? totalAmount  // last type gets remainder
                        : Math.ceil(totalAmount * (0.2 + Math.random() * 0.5));
                    totalAmount -= amount;
                    if (totalAmount < 0) { amount += totalAmount; totalAmount = 0; }
                    if (amount > 0) {
                        resources[pool[p].resource] = (resources[pool[p].resource] || 0) + amount;
                    }
                    break;
                }
            }
        }

        // Ensure at least something
        if (Object.keys(resources).length === 0) {
            resources.metal = Config.MINING.ASTEROID_MIN_RESOURCES;
        }

        return resources;
    }

    // ── Asteroid position updates ───────────────────────────

    function _updateAsteroidPositions() {
        for (var i = 0; i < _asteroids.length; i++) {
            var ast = _asteroids[i];
            var loc = World.getLocation(ast.fieldId);
            if (loc) {
                ast.x = loc.x + ast.offsetX;
                ast.y = loc.y + ast.offsetY;
            }
        }
    }

    // ── Player mining ───────────────────────────────────────

    function _getPlayerMiningStats() {
        var ship = Ship.getShip();
        if (!ship.grid || !ship.grid.cells) return null;
        var speed = 0, yieldMult = 0, count = 0;
        for (var r = 0; r < ship.grid.h; r++) {
            for (var c = 0; c < ship.grid.w; c++) {
                var cell = ship.grid.cells[r][c];
                if (!cell) continue;
                var def = Config.BLOCK_TYPES[cell.type];
                if (def && def.miningSpeed) {
                    speed += def.miningSpeed;
                    yieldMult += def.miningYield;
                    count++;
                }
            }
        }
        if (count === 0) return null;
        return { speed: speed, yieldMult: yieldMult / count };
    }

    function startMining(asteroidId) {
        var stats = _getPlayerMiningStats();
        if (!stats) {
            Events.emit('mining_error', { reason: 'No mining laser equipped' });
            return false;
        }

        var ast = _getAsteroid(asteroidId);
        if (!ast || ast.depleted) {
            Events.emit('mining_error', { reason: 'Asteroid depleted or not found' });
            return false;
        }

        var ship = Ship.getShip();
        var dx = ast.x - ship.x, dy = ast.y - ship.y;
        if (Math.sqrt(dx * dx + dy * dy) > Config.MINING.ACTIVATION_RANGE) {
            Events.emit('mining_error', { reason: 'Too far from asteroid' });
            return false;
        }

        if (Ship.getCargoFree() <= 0) {
            Events.emit('mining_error', { reason: 'Cargo hold full' });
            return false;
        }

        _miningState = {
            asteroidId: asteroidId,
            progress: 0,
            stats: stats,
            extractedThisCycle: {}
        };

        Events.emit('mining_started', { asteroidId: asteroidId });
        return true;
    }

    function stopMining() {
        if (!_miningState) return;
        Events.emit('mining_stopped', { asteroidId: _miningState.asteroidId });
        _miningState = null;
    }

    function isMining() {
        return _miningState !== null;
    }

    function getMiningState() {
        return _miningState;
    }

    function _tickPlayerMining() {
        if (!_miningState) return;

        var ast = _getAsteroid(_miningState.asteroidId);
        if (!ast || ast.depleted) {
            stopMining();
            return;
        }

        // Check range
        var ship = Ship.getShip();
        var dx = ast.x - ship.x, dy = ast.y - ship.y;
        if (Math.sqrt(dx * dx + dy * dy) > Config.MINING.ACTIVATION_RANGE * 1.2) {
            stopMining();
            return;
        }

        // Check cargo
        if (Ship.getCargoFree() <= 0) {
            Events.emit('mining_error', { reason: 'Cargo hold full' });
            stopMining();
            return;
        }

        // Consume fuel (chemical propellant)
        var fuel = ship.inventory.chemical_propellant || 0;
        if (fuel < Config.MINING.FUEL_PER_TICK) {
            Events.emit('mining_error', { reason: 'Out of fuel' });
            stopMining();
            return;
        }
        Ship.removeItem('chemical_propellant', Config.MINING.FUEL_PER_TICK);

        // Advance progress
        _miningState.progress += Config.MINING.PROGRESS_PER_TICK * _miningState.stats.speed;

        // Extract when progress reaches 1.0
        if (_miningState.progress >= 1.0) {
            _miningState.progress = 0;
            _extractResources(ast, _miningState.stats.yieldMult);
        }
    }

    function _extractResources(ast, yieldMult) {
        var resKeys = Object.keys(ast.resources);
        if (resKeys.length === 0) {
            ast.depleted = true;
            ast.respawnTimer = Config.MINING.RESPAWN_TICKS;
            _respawnQueue.push(ast);
            Events.emit('asteroid_depleted', { asteroidId: ast.id });
            stopMining();
            return;
        }

        // Pick a random available resource
        var picked = resKeys[Math.floor(Math.random() * resKeys.length)];
        var safeYield = (isFinite(yieldMult) && yieldMult > 0) ? yieldMult : 1.0;
        var baseAmount = 1 + Math.floor(Math.random() * 2);
        var amount = Math.max(0, Math.min(
            Math.round(baseAmount * safeYield),
            ast.resources[picked] || 0,
            Ship.getCargoFree()
        ));

        if (amount <= 0) return;

        var added = Ship.addItem(picked, amount);
        ast.resources[picked] -= added;
        if (ast.resources[picked] <= 0) delete ast.resources[picked];

        // Track for UI
        if (!_miningState.extractedThisCycle) _miningState.extractedThisCycle = {};
        _miningState.extractedThisCycle[picked] = (_miningState.extractedThisCycle[picked] || 0) + added;

        Events.emit('resource_mined', { resource: picked, amount: added, asteroidId: ast.id });

        // Check if asteroid is now depleted
        var remaining = 0;
        for (var k in ast.resources) remaining += ast.resources[k];
        if (remaining <= 0) {
            ast.depleted = true;
            ast.respawnTimer = Config.MINING.RESPAWN_TICKS;
            _respawnQueue.push(ast);
            Events.emit('asteroid_depleted', { asteroidId: ast.id });
            stopMining();
        }
    }

    // ── NPC Miners ──────────────────────────────────────────

    function _spawnNPCMiners() {
        var fieldIds = Object.keys(Config.ASTEROID_FIELDS);
        for (var i = 0; i < Config.MINING.NPC_MINER_COUNT; i++) {
            var fieldId = fieldIds[i % fieldIds.length];
            var loc = World.getLocation(fieldId);
            if (!loc) continue;

            var factions = [Config.FACTION.EARTH, Config.FACTION.MARS, Config.FACTION.INDEPENDENT];
            var faction = factions[i % factions.length];

            _npcMiners.push({
                id: 'npc_miner_' + i,
                fieldId: fieldId,
                faction: faction,
                x: loc.x + (Math.random() - 0.5) * loc.radius,
                y: loc.y + (Math.random() - 0.5) * loc.radius,
                angle: Math.random() * Math.PI * 2,
                speed: Config.BASE_SPEED * 0.6,
                hp: 60,
                maxHp: 60,
                shieldHp: 20,
                maxShieldHp: 20,
                dead: false,
                cargo: {},
                cargoTotal: 0,
                targetAsteroid: null,
                state: 'seeking',  // seeking, mining, delivering
                mineProgress: 0,
                destX: loc.x,
                destY: loc.y,
                deliverTimer: 0,
                behavior: 'mining'
            });
        }
    }

    function _tickNPCMiners() {
        for (var i = _npcMiners.length - 1; i >= 0; i--) {
            var miner = _npcMiners[i];
            if (miner.dead) {
                _npcMiners.splice(i, 1);
                continue;
            }
            _updateMinerAI(miner);
        }
    }

    function _updateMinerAI(miner) {
        if (miner.state === 'seeking') {
            // Find nearest non-depleted asteroid in our field
            if (!miner.targetAsteroid) {
                var best = null, bestDist = Infinity;
                for (var a = 0; a < _asteroids.length; a++) {
                    var ast = _asteroids[a];
                    if (ast.fieldId !== miner.fieldId || ast.depleted) continue;
                    var dx = ast.x - miner.x, dy = ast.y - miner.y;
                    var d = dx * dx + dy * dy;
                    if (d < bestDist) { bestDist = d; best = ast; }
                }
                if (best) {
                    miner.targetAsteroid = best.id;
                    miner.destX = best.x;
                    miner.destY = best.y;
                } else {
                    // No asteroids available, wander
                    var loc = World.getLocation(miner.fieldId);
                    if (loc) {
                        miner.destX = loc.x + (Math.random() - 0.5) * loc.radius;
                        miner.destY = loc.y + (Math.random() - 0.5) * loc.radius;
                    }
                }
            }

            // Move toward target
            _moveMiner(miner);

            // Check if arrived at asteroid
            if (miner.targetAsteroid) {
                var tAst = _getAsteroid(miner.targetAsteroid);
                if (tAst && !tAst.depleted) {
                    var tdx = tAst.x - miner.x, tdy = tAst.y - miner.y;
                    if (Math.sqrt(tdx * tdx + tdy * tdy) < 30) {
                        miner.state = 'mining';
                        miner.mineProgress = 0;
                    }
                } else {
                    miner.targetAsteroid = null;
                }
            }
        } else if (miner.state === 'mining') {
            var ast2 = _getAsteroid(miner.targetAsteroid);
            if (!ast2 || ast2.depleted) {
                miner.state = 'seeking';
                miner.targetAsteroid = null;
                return;
            }

            // Stay near asteroid
            miner.destX = ast2.x;
            miner.destY = ast2.y;

            miner.mineProgress += Config.MINING.NPC_MINE_SPEED;
            if (miner.mineProgress >= 1.0) {
                miner.mineProgress = 0;
                // Extract
                var resKeys = Object.keys(ast2.resources);
                if (resKeys.length > 0) {
                    var res = resKeys[Math.floor(Math.random() * resKeys.length)];
                    var amt = Math.min(2, ast2.resources[res]);
                    ast2.resources[res] -= amt;
                    if (ast2.resources[res] <= 0) delete ast2.resources[res];
                    miner.cargo[res] = (miner.cargo[res] || 0) + amt;
                    miner.cargoTotal += amt;

                    // Check depleted
                    var rem = 0;
                    for (var k in ast2.resources) rem += ast2.resources[k];
                    if (rem <= 0) {
                        ast2.depleted = true;
                        ast2.respawnTimer = Config.MINING.RESPAWN_TICKS;
                        _respawnQueue.push(ast2);
                    }
                }

                // Head to deliver when full
                if (miner.cargoTotal >= Config.MINING.NPC_CARGO_CAPACITY) {
                    miner.state = 'delivering';
                    miner.targetAsteroid = null;
                    _setMinerDeliveryTarget(miner);
                }
            }
        } else if (miner.state === 'delivering') {
            _moveMiner(miner);

            // Check if arrived at delivery location
            var locs = World.getLocations();
            for (var li = 0; li < locs.length; li++) {
                var loc2 = locs[li];
                if (!loc2.dockable) continue;
                var ddx = loc2.x - miner.x, ddy = loc2.y - miner.y;
                if (Math.sqrt(ddx * ddx + ddy * ddy) < loc2.radius + 40) {
                    // Deliver cargo to economy
                    for (var cr in miner.cargo) {
                        if (miner.cargo[cr] > 0) {
                            Economy.npcDeliver(loc2.id, cr, miner.cargo[cr]);
                        }
                    }
                    miner.cargo = {};
                    miner.cargoTotal = 0;
                    miner.state = 'seeking';
                    break;
                }
            }
        }

        // Shield regen
        if (miner.shieldHp < miner.maxShieldHp) {
            miner.shieldHp = Math.min(miner.maxShieldHp, miner.shieldHp + 0.05);
        }
    }

    function _moveMiner(miner) {
        var dx = miner.destX - miner.x;
        var dy = miner.destY - miner.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
            miner.angle = Math.atan2(dy, dx);
            miner.x += Math.cos(miner.angle) * miner.speed;
            miner.y += Math.sin(miner.angle) * miner.speed;
        }
    }

    function _setMinerDeliveryTarget(miner) {
        // Find nearest dockable location that matches faction or is neutral
        var locs = World.getLocations();
        var best = null, bestDist = Infinity;
        for (var i = 0; i < locs.length; i++) {
            var loc = locs[i];
            if (!loc.dockable) continue;
            if (loc.faction !== miner.faction && loc.faction !== Config.FACTION.INDEPENDENT &&
                loc.faction !== Config.FACTION.MOON) continue;
            var dx = loc.x - miner.x, dy = loc.y - miner.y;
            var d = dx * dx + dy * dy;
            if (d < bestDist) { bestDist = d; best = loc; }
        }
        if (best) {
            miner.destX = best.x;
            miner.destY = best.y;
        } else {
            // No valid delivery target — reset to seeking
            miner.state = 'seeking';
            miner.targetAsteroid = null;
        }
    }

    // ── Respawning ──────────────────────────────────────────

    function _tickRespawns() {
        for (var i = _respawnQueue.length - 1; i >= 0; i--) {
            var ast = _respawnQueue[i];
            ast.respawnTimer--;
            if (ast.respawnTimer <= 0) {
                // Respawn with new resources
                var fieldConf = Config.ASTEROID_FIELDS[ast.fieldId];
                if (fieldConf) {
                    ast.resources = _rollResources(fieldConf);
                    var total = 0;
                    for (var k in ast.resources) total += ast.resources[k];
                    ast.maxResources = total;
                }
                ast.depleted = false;
                _respawnQueue.splice(i, 1);
            }
        }
    }

    // ── Pirate spawning in fields ───────────────────────────

    function _checkPirateSpawn() {
        var ship = Ship.getShip();
        if (ship.docked) return;

        // Check if player is in an asteroid field
        for (var fieldId in Config.ASTEROID_FIELDS) {
            var loc = World.getLocation(fieldId);
            if (!loc) continue;
            var dx = ship.x - loc.x, dy = ship.y - loc.y;
            if (Math.sqrt(dx * dx + dy * dy) < loc.radius * 1.5) {
                var fieldConf = Config.ASTEROID_FIELDS[fieldId];
                var chance = Config.MINING.PIRATE_SPAWN_CHANCE * (fieldConf.dangerLevel || 1.0);
                if (Math.random() < chance) {
                    _spawnPirate(loc);
                }
                break;
            }
        }
    }

    function _spawnPirate(loc) {
        // Spawn a hostile independent NPC near the field
        var angle = Math.random() * Math.PI * 2;
        var dist = loc.radius * 0.8 + Math.random() * loc.radius * 0.4;
        var px = loc.x + Math.cos(angle) * dist;
        var py = loc.y + Math.sin(angle) * dist;

        World.spawnNPC({
            faction: Config.FACTION.INDEPENDENT,
            behavior: 'patrol',
            x: px, y: py,
            hostile: true,
            hp: 40 + Math.floor(Math.random() * 40),
            patrolRadius: 200,
            label: 'Pirate'
        });
    }

    // ── Helpers ──────────────────────────────────────────────

    function _getAsteroid(id) {
        for (var i = 0; i < _asteroids.length; i++) {
            if (_asteroids[i].id === id) return _asteroids[i];
        }
        return null;
    }

    function getAsteroids() { return _asteroids; }
    function getNPCMiners() { return _npcMiners; }

    function getNearbyAsteroid(x, y, range) {
        var best = null, bestDist = range || Config.MINING.ACTIVATION_RANGE;
        for (var i = 0; i < _asteroids.length; i++) {
            var ast = _asteroids[i];
            if (ast.depleted) continue;
            var dx = ast.x - x, dy = ast.y - y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) { bestDist = dist; best = ast; }
        }
        return best;
    }

    function isInAsteroidField(x, y) {
        for (var fieldId in Config.ASTEROID_FIELDS) {
            var loc = World.getLocation(fieldId);
            if (!loc) continue;
            var dx = x - loc.x, dy = y - loc.y;
            if (Math.sqrt(dx * dx + dy * dy) < loc.radius * 1.2) {
                return { fieldId: fieldId, location: loc };
            }
        }
        return null;
    }

    // ── Main tick ───────────────────────────────────────────

    function tick() {
        _tickCount++;
        _updateAsteroidPositions();
        _tickPlayerMining();
        _tickRespawns();

        // NPC miners every 2 ticks
        if (_tickCount % 2 === 0) {
            _tickNPCMiners();
        }

        // Pirates every 10 ticks
        if (_tickCount % 10 === 0) {
            _checkPirateSpawn();
        }

        // Respawn dead NPC miners periodically
        if (_tickCount % 600 === 0) {
            _respawnDeadMiners();
        }
    }

    function _respawnDeadMiners() {
        if (_npcMiners.length < Config.MINING.NPC_MINER_COUNT) {
            var fieldIds = Object.keys(Config.ASTEROID_FIELDS);
            var fieldId = fieldIds[Math.floor(Math.random() * fieldIds.length)];
            var loc = World.getLocation(fieldId);
            if (!loc) return;
            var factions = [Config.FACTION.EARTH, Config.FACTION.MARS, Config.FACTION.INDEPENDENT];
            _npcMiners.push({
                id: 'npc_miner_' + _tickCount,
                fieldId: fieldId,
                faction: factions[Math.floor(Math.random() * factions.length)],
                x: loc.x + (Math.random() - 0.5) * loc.radius,
                y: loc.y + (Math.random() - 0.5) * loc.radius,
                angle: Math.random() * Math.PI * 2,
                speed: Config.BASE_SPEED * 0.6,
                hp: 60, maxHp: 60,
                shieldHp: 20, maxShieldHp: 20,
                dead: false,
                cargo: {}, cargoTotal: 0,
                targetAsteroid: null,
                state: 'seeking',
                mineProgress: 0,
                destX: loc.x, destY: loc.y,
                deliverTimer: 0,
                behavior: 'mining'
            });
        }
    }

    // ── Serialization ───────────────────────────────────────

    function serialize() {
        return {
            miningState: _miningState ? {
                asteroidId: _miningState.asteroidId,
                progress: _miningState.progress,
                extractedThisCycle: _miningState.extractedThisCycle
            } : null,
            asteroids: _asteroids.map(function (a) {
                return {
                    id: a.id, fieldId: a.fieldId,
                    offsetX: a.offsetX, offsetY: a.offsetY,
                    radius: a.radius,
                    resources: JSON.parse(JSON.stringify(a.resources)),
                    maxResources: a.maxResources,
                    depleted: a.depleted,
                    respawnTimer: a.respawnTimer,
                    colorSeed: a.colorSeed
                };
            }),
            npcMiners: _npcMiners.map(function (m) {
                return {
                    id: m.id, fieldId: m.fieldId, faction: m.faction,
                    x: m.x, y: m.y, angle: m.angle,
                    hp: m.hp, maxHp: m.maxHp,
                    shieldHp: m.shieldHp, maxShieldHp: m.maxShieldHp,
                    cargo: JSON.parse(JSON.stringify(m.cargo)),
                    cargoTotal: m.cargoTotal,
                    state: m.state,
                    targetAsteroid: m.targetAsteroid,
                    destX: m.destX, destY: m.destY,
                    mineProgress: m.mineProgress
                };
            })
        };
    }

    function deserialize(data) {
        if (!data) return;

        // Restore player mining state
        if (data.miningState) {
            var stats = _getPlayerMiningStats();
            if (stats) {
                _miningState = {
                    asteroidId: data.miningState.asteroidId,
                    progress: data.miningState.progress || 0,
                    stats: stats,
                    extractedThisCycle: data.miningState.extractedThisCycle || {}
                };
            }
        } else {
            _miningState = null;
        }

        if (data.asteroids) {
            _asteroids = [];
            _respawnQueue = [];
            for (var i = 0; i < data.asteroids.length; i++) {
                var a = data.asteroids[i];
                var loc = World.getLocation(a.fieldId);
                var ast = {
                    id: a.id,
                    fieldId: a.fieldId,
                    offsetX: a.offsetX,
                    offsetY: a.offsetY,
                    x: loc ? loc.x + a.offsetX : a.offsetX,
                    y: loc ? loc.y + a.offsetY : a.offsetY,
                    radius: a.radius,
                    resources: a.resources || {},
                    maxResources: a.maxResources || 0,
                    depleted: a.depleted || false,
                    respawnTimer: a.respawnTimer || 0,
                    colorSeed: a.colorSeed || Math.random()
                };
                _asteroids.push(ast);
                if (ast.depleted && ast.respawnTimer > 0) {
                    _respawnQueue.push(ast);
                }
            }
        }

        if (data.npcMiners) {
            _npcMiners = [];
            for (var j = 0; j < data.npcMiners.length; j++) {
                var m = data.npcMiners[j];
                _npcMiners.push({
                    id: m.id, fieldId: m.fieldId, faction: m.faction,
                    x: m.x, y: m.y, angle: m.angle || 0,
                    speed: Config.BASE_SPEED * 0.6,
                    hp: m.hp, maxHp: m.maxHp,
                    shieldHp: m.shieldHp || 0, maxShieldHp: m.maxShieldHp || 20,
                    dead: false,
                    cargo: m.cargo || {}, cargoTotal: m.cargoTotal || 0,
                    targetAsteroid: m.targetAsteroid || null,
                    state: m.state || 'seeking',
                    mineProgress: m.mineProgress || 0,
                    destX: m.destX || m.x, destY: m.destY || m.y,
                    deliverTimer: 0,
                    behavior: 'mining'
                });
            }
        }
    }

    return {
        init: init,
        tick: tick,
        startMining: startMining,
        stopMining: stopMining,
        isMining: isMining,
        getMiningState: getMiningState,
        getAsteroids: getAsteroids,
        getNPCMiners: getNPCMiners,
        getNearbyAsteroid: getNearbyAsteroid,
        isInAsteroidField: isInAsteroidField,
        serialize: serialize,
        deserialize: deserialize
    };
})();
