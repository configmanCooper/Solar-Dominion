/* ============================================================
 * Solar Dominion — Missions Module
 * Dynamic, persistent missions generated from faction strategies
 * and location economic needs.
 * ============================================================ */
var Missions = (function () {
    'use strict';

    var _locationMissions = {}; // per-location persistent missions
    var _active = [];           // accepted missions
    var _completed = [];        // completed mission ids
    var _trackedId = null;      // currently tracked mission id
    var _nextId = 1;
    var _refreshTimer = 0;
    var REFRESH_INTERVAL = 300; // refresh every ~30 seconds

    function init() {
        _locationMissions = {};
        _active = [];
        _completed = [];
        _trackedId = null;
        _nextId = 1;
        _refreshTimer = 0;
        // Generate initial missions for all dockable locations
        var locs = World.getLocations();
        for (var i = 0; i < locs.length; i++) {
            if (locs[i].dockable) _refreshLocationMissions(locs[i].id);
        }
    }

    function getAvailableAtLocation(locationId) {
        return _locationMissions[locationId] || [];
    }
    function getActive() { return _active; }
    function getCompleted() { return _completed; }

    // Called when player opens mission panel — just returns existing missions
    function generateForLocation(locationId) {
        if (!_locationMissions[locationId] || _locationMissions[locationId].length === 0) {
            _refreshLocationMissions(locationId);
        }
        return _locationMissions[locationId] || [];
    }

    function _refreshLocationMissions(locationId) {
        var loc = World.getLocation(locationId);
        if (!loc) return;

        // Keep existing missions that haven't expired
        var existing = _locationMissions[locationId] || [];
        var kept = [];
        for (var i = 0; i < existing.length; i++) {
            if (existing[i].expiresAt && existing[i].expiresAt > _refreshTimer) {
                kept.push(existing[i]);
            }
        }

        // Target 4-6 missions per location
        var target = 4 + Math.floor(Math.random() * 3);
        var needed = Math.max(0, target - kept.length);

        for (var j = 0; j < needed; j++) {
            var mission = _generateMissionForLocation(loc);
            if (mission) kept.push(mission);
        }

        _locationMissions[locationId] = kept;
    }

    function _generateMissionForLocation(loc) {
        // Get faction's active strategies to determine mission types
        var strategyTypes = {};
        var faction = Factions.getFaction(loc.faction);

        if (loc.faction === Config.FACTION.EARTH || loc.faction === Config.FACTION.MARS) {
            strategyTypes = Factions.getStrategyMissionTypes(loc.faction);
        } else {
            // Neutral locations: check leaning for mission bias
            var leaning = Factions.getLeaning(loc.faction);
            if (leaning === 'earth') {
                strategyTypes = Factions.getStrategyMissionTypes(Config.FACTION.EARTH);
            } else if (leaning === 'mars') {
                strategyTypes = Factions.getStrategyMissionTypes(Config.FACTION.MARS);
            }
        }

        // Also check location economic needs
        var needMissions = _getEconomicNeedMissions(loc);

        // Build weighted type pool
        var typePool = [];
        // From strategies
        for (var type in strategyTypes) {
            for (var w = 0; w < strategyTypes[type]; w++) typePool.push(type);
        }
        // From economic needs
        for (var n = 0; n < needMissions.length; n++) typePool.push(needMissions[n]);
        // Always some baseline types (reduced delivery bias)
        typePool.push('delivery', 'mining');
        if (loc.faction === Config.FACTION.EARTH || loc.faction === Config.FACTION.MARS) {
            typePool.push('escort', 'combat');
        }
        if (loc.faction === Config.FACTION.MOON || loc.faction === Config.FACTION.MARS_STATION) {
            typePool.push('diplomatic', 'escort');
        }

        var typeKey = typePool[Math.floor(Math.random() * typePool.length)];
        return _createMission(typeKey, loc);
    }

    function _getEconomicNeedMissions(loc) {
        var needs = [];
        var locEcon = Config.LOCATION_ECONOMY[loc.id];
        if (!locEcon || !locEcon.consumes) return needs;

        // Check what the location needs most
        for (var res in locEcon.consumes) {
            var stock = Economy.getStock(loc.id, res);
            if (stock < 10) {
                // Urgent need — generate delivery missions for this resource
                needs.push('delivery');
            }
        }
        return needs;
    }

    function _createMission(typeKey, sourceLoc) {
        var allLocs = World.getLocations().filter(function (l) { return l.id !== sourceLoc.id && l.dockable; });
        var destLoc = allLocs.length > 0 ? allLocs[Math.floor(Math.random() * allLocs.length)] : null;

        var mType = Config.MISSION_TYPES[typeKey];
        if (!mType) mType = { payMult: 1.0, repGain: 5 };

        var pay = Math.floor(Config.ECONOMY.MISSION_PAY_BASE * mType.payMult * (1 + Math.random()));

        // Determine cargo/resource for delivery missions based on actual needs
        var deliveryResource = null;
        var deliveryAmount = 0;
        if (typeKey === 'delivery' && destLoc) {
            var destEcon = Config.LOCATION_ECONOMY[destLoc.id];
            if (destEcon && destEcon.consumes) {
                var consumeKeys = Object.keys(destEcon.consumes);
                if (consumeKeys.length > 0) {
                    deliveryResource = consumeKeys[Math.floor(Math.random() * consumeKeys.length)];
                    deliveryAmount = 5 + Math.floor(Math.random() * 15);
                    pay += deliveryAmount * (Config.RESOURCES[deliveryResource] ? Config.RESOURCES[deliveryResource].basePrice : 5);
                }
            }
        }

        var mission = {
            id: 'mission_' + (_nextId++),
            type: typeKey,
            name: _generateMissionName(typeKey, sourceLoc, destLoc, deliveryResource),
            description: _generateDescription(typeKey, sourceLoc, destLoc, deliveryResource, deliveryAmount),
            sourceFaction: sourceLoc.faction,
            sourceLocation: sourceLoc.id,
            targetLocation: destLoc ? destLoc.id : null,
            deliveryResource: deliveryResource,
            deliveryAmount: deliveryAmount,
            reward: {
                credits: pay,
                reputation: { faction: sourceLoc.faction, amount: mType.repGain }
            },
            objectives: _generateObjectives(typeKey, destLoc, deliveryResource, deliveryAmount),
            status: 'available',
            isStoryMission: false,
            advancesPath: null,
            expiresAt: _refreshTimer + 1800 + Math.floor(Math.random() * 1200) // 3-5 min lifespan
        };

        // Story-advancing missions
        if (typeKey === 'diplomatic' && Math.random() < 0.4) {
            mission.advancesPath = 'peace';
            mission.reward.credits += 500;
            mission.name = '⭐ ' + mission.name;
        }
        if (typeKey === 'combat' && Math.random() < 0.3) {
            mission.advancesPath = 'war';
            mission.reward.credits += 800;
            mission.name = '⭐ ' + mission.name;
        }

        return mission;
    }

    function _generateMissionName(type, src, dest, resource) {
        var resName = resource && Config.RESOURCES[resource] ? Config.RESOURCES[resource].name : '';
        var names = {
            delivery: [
                resName ? resName + ' Delivery to ' + (dest ? dest.name : 'Unknown') : 'Supply Run to ' + (dest ? dest.name : 'Unknown'),
                'Cargo Haul', 'Emergency Delivery', 'Resource Transport'
            ],
            combat: ['Patrol Sweep', 'Pirate Elimination', 'Combat Patrol', 'Hostile Clearance'],
            escort: ['Convoy Escort', 'VIP Transport', 'Safe Passage', 'Trade Escort'],
            spy: ['Intelligence Gathering', 'Covert Surveillance', 'Data Extraction', 'Recon Mission'],
            sabotage: ['Supply Disruption', 'Facility Sabotage', 'Covert Ops', 'Behind Enemy Lines'],
            diplomatic: ['Peace Envoy', 'Diplomatic Courier', 'Treaty Negotiation', 'Goodwill Mission'],
            mining: ['Asteroid Mining', 'Resource Extraction', 'Ore Collection', 'Deep Mining']
        };
        var list = names[type] || ['Mission'];
        return list[Math.floor(Math.random() * list.length)];
    }

    function _generateDescription(type, src, dest, resource, amount) {
        var resName = resource && Config.RESOURCES[resource] ? Config.RESOURCES[resource].name : '';
        var descs = {
            delivery: resource
                ? 'Deliver ' + amount + ' ' + resName + ' from ' + src.name + ' to ' + (dest ? dest.name : 'the target') + '.'
                : 'Transport supplies from ' + src.name + ' to ' + (dest ? dest.name : 'the target') + '.',
            combat: 'Eliminate hostile targets in the region around ' + src.name + '.',
            escort: 'Escort a convoy safely from ' + src.name + ' to ' + (dest ? dest.name : 'the destination') + '.',
            spy: 'Gather intelligence near ' + (dest ? dest.name : 'the target') + ' and return.',
            sabotage: 'Disrupt enemy operations near ' + (dest ? dest.name : 'the target') + '.',
            diplomatic: 'Carry diplomatic messages and negotiate at ' + (dest ? dest.name : 'the destination') + '.',
            mining: 'Mine resources from nearby asteroid fields and deliver them.'
        };
        return descs[type] || 'Complete the assigned objectives.';
    }

    function _generateObjectives(type, dest, resource, amount) {
        switch (type) {
            case 'delivery':
                if (resource && amount) {
                    return [
                        { type: 'collect', resource: resource, amount: amount, collected: 0, done: false },
                        { type: 'go_to', target: dest ? dest.id : null, done: false }
                    ];
                }
                return [{ type: 'go_to', target: dest ? dest.id : null, done: false }];
            case 'combat': return [{ type: 'destroy', count: 2 + Math.floor(Math.random() * 3), destroyed: 0, done: false }];
            case 'escort': return [{ type: 'go_to', target: dest ? dest.id : null, done: false }];
            case 'spy': return [{ type: 'go_to', target: dest ? dest.id : null, done: false }, { type: 'return', done: false }];
            case 'sabotage': return [{ type: 'go_to', target: dest ? dest.id : null, done: false }];
            case 'diplomatic': return [{ type: 'go_to', target: dest ? dest.id : null, done: false }];
            case 'mining':
                var mineRes = ['metal', 'rare_minerals', 'water', 'refined_metals'];
                var pickedRes = mineRes[Math.floor(Math.random() * mineRes.length)];
                return [{ type: 'collect', resource: pickedRes, amount: 10 + Math.floor(Math.random() * 25), collected: 0, done: false }];
            default: return [];
        }
    }

    function acceptMission(missionId) {
        var ship = Ship.getShip();
        // Search all location missions
        for (var locId in _locationMissions) {
            var missions = _locationMissions[locId];
            if (!Array.isArray(missions)) continue;
            for (var i = 0; i < missions.length; i++) {
                if (missions[i].id === missionId) {
                    var mission = missions.splice(i, 1)[0];
                    mission.status = 'active';
                    // Extend expiry significantly once accepted (30 min gameplay)
                    mission.expiresAt = _refreshTimer + 18000;
                    for (var o = 0; o < mission.objectives.length; o++) {
                        var obj = mission.objectives[o];
                        if (obj.type === 'collect') {
                            obj.startingAmount = ship.inventory[obj.resource] || 0;
                        }
                    }
                    _active.push(mission);
                    // Auto-track if no mission currently tracked
                    if (!_trackedId) _trackedId = mission.id;
                    Events.emit('mission_accepted', { mission: mission });
                    return true;
                }
            }
        }
        return false;
    }

    function checkObjectives() {
        var ship = Ship.getShip();
        for (var i = _active.length - 1; i >= 0; i--) {
            var m = _active[i];
            var allDone = true;

            for (var j = 0; j < m.objectives.length; j++) {
                var obj = m.objectives[j];
                if (obj.done) continue;

                if (obj.type === 'go_to' && obj.target) {
                    if (ship.docked && ship.dockedAt === obj.target) {
                        obj.done = true;
                    }
                }
                if (obj.type === 'return' && ship.docked && ship.dockedAt === m.sourceLocation) {
                    obj.done = true;
                }
                if (obj.type === 'collect') {
                    var currentAmt = ship.inventory[obj.resource] || 0;
                    var startAmt = obj.startingAmount || 0;
                    obj.collected = Math.max(0, currentAmt - startAmt);
                    if (obj.collected >= obj.amount) obj.done = true;
                }
                if (!obj.done) allDone = false;
            }

            if (allDone) {
                _completeMission(m, i);
            }
        }
    }

    function onEnemyDestroyed(faction) {
        for (var i = 0; i < _active.length; i++) {
            var m = _active[i];
            for (var j = 0; j < m.objectives.length; j++) {
                var obj = m.objectives[j];
                if (obj.type === 'destroy' && !obj.done) {
                    // Only count kills of the correct faction (or any if no target specified)
                    if (!obj.targetFaction || obj.targetFaction === faction) {
                        obj.destroyed = (obj.destroyed || 0) + 1;
                        if (obj.destroyed >= obj.count) obj.done = true;
                    }
                }
            }
        }
    }

    function _completeMission(mission, index) {
        _active.splice(index, 1);
        mission.status = 'completed';
        _completed.push(mission.id);

        // Clear tracking if this was the tracked mission
        if (_trackedId === mission.id) _trackedId = null;

        Economy.addCredits(mission.reward.credits);
        if (mission.reward.reputation) {
            Factions.changeRep(mission.reward.reputation.faction, mission.reward.reputation.amount);
        }

        if (mission.advancesPath === 'war') {
            Diplomacy.completeWarCampaign();
        }
        if (mission.advancesPath === 'peace') {
            Factions.changeRep(Config.FACTION.EARTH, 5);
            Factions.changeRep(Config.FACTION.MARS, 5);
        }

        Events.emit('mission_completed', { mission: mission });
    }

    function tick() {
        _refreshTimer++;
        checkObjectives();

        // Check for expired active missions
        for (var e = _active.length - 1; e >= 0; e--) {
            var am = _active[e];
            if (am.expiresAt && am.expiresAt <= _refreshTimer) {
                if (_trackedId === am.id) _trackedId = null;
                _active.splice(e, 1);
                Events.emit('mission_expired', { mission: am });
            }
        }

        // Periodically refresh missions at all locations
        if (_refreshTimer % REFRESH_INTERVAL === 0) {
            var locs = World.getLocations();
            for (var i = 0; i < locs.length; i++) {
                if (locs[i].dockable) _refreshLocationMissions(locs[i].id);
            }
        }
    }

    function serialize() {
        return {
            locationMissions: JSON.parse(JSON.stringify(_locationMissions)),
            active: JSON.parse(JSON.stringify(_active)),
            completed: _completed.slice(),
            nextId: _nextId,
            refreshTimer: _refreshTimer,
            trackedId: _trackedId
        };
    }

    function deserialize(data) {
        if (!data) return;
        _locationMissions = data.locationMissions || {};
        _active = data.active || [];
        _completed = data.completed || [];
        _nextId = data.nextId || 1;
        _refreshTimer = data.refreshTimer || 0;
        _trackedId = data.trackedId || null;

        // Validate active missions have required shape
        for (var i = _active.length - 1; i >= 0; i--) {
            var m = _active[i];
            if (!m || !m.objectives || !Array.isArray(m.objectives) || !m.reward) {
                _active.splice(i, 1);
            }
        }

        // Validate tracked mission still exists
        if (_trackedId) {
            var found = false;
            for (var t = 0; t < _active.length; t++) {
                if (_active[t].id === _trackedId) { found = true; break; }
            }
            if (!found) _trackedId = null;
        }

        // Backwards compatibility with old save format
        if (data.available) {
            var ship = Ship.getShip();
            if (ship && ship.dockedAt) {
                _locationMissions[ship.dockedAt] = data.available;
            }
        }
    }

    function getTrackedId() { return _trackedId; }
    function setTrackedId(id) { _trackedId = id; }

    function getTrackedMission() {
        if (!_trackedId) return null;
        for (var i = 0; i < _active.length; i++) {
            if (_active[i].id === _trackedId) return _active[i];
        }
        _trackedId = null;
        return null;
    }

    function abandonMission(missionId) {
        for (var i = 0; i < _active.length; i++) {
            if (_active[i].id === missionId) {
                var m = _active.splice(i, 1)[0];
                if (_trackedId === missionId) _trackedId = null;
                // Small rep penalty for abandoning
                if (m.reward && m.reward.reputation) {
                    Factions.changeRep(m.reward.reputation.faction, -Math.floor(m.reward.reputation.amount / 2));
                }
                Events.emit('mission_abandoned', { mission: m });
                return true;
            }
        }
        return false;
    }

    function getMissionById(id) {
        for (var i = 0; i < _active.length; i++) {
            if (_active[i].id === id) return _active[i];
        }
        return null;
    }

    return {
        init: init,
        getAvailableAtLocation: getAvailableAtLocation,
        getAvailable: function () {
            var ship = Ship.getShip();
            if (ship && ship.dockedAt) return getAvailableAtLocation(ship.dockedAt);
            return [];
        },
        getActive: getActive,
        getCompleted: getCompleted,
        getTrackedId: getTrackedId,
        setTrackedId: setTrackedId,
        getTrackedMission: getTrackedMission,
        getMissionById: getMissionById,
        abandonMission: abandonMission,
        generateForLocation: generateForLocation,
        acceptMission: acceptMission,
        checkObjectives: checkObjectives,
        onEnemyDestroyed: onEnemyDestroyed,
        tick: tick,
        serialize: serialize,
        deserialize: deserialize
    };
})();
