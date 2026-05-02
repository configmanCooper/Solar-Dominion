/* ============================================================
 * Solar Dominion — World Module
 * Manages locations, spatial queries, background stars, and
 * NPC entity spawning/movement.
 * ============================================================ */
var World = (function () {
    'use strict';

    var _locations = [];       // active location objects (from Config + player-built)
    var _stars = [];           // background decoration
    var _nebulae = [];
    var _npcs = [];            // non-player ships in the world
    var _projectiles = [];     // active projectiles
    var _explosions = [];      // visual explosions
    var _nextId = 1;

    var _respawnTimer = 0;

    function init() {
        _locations = [];
        _npcs = [];
        _projectiles = [];
        _explosions = [];
        _respawnTimer = 0;
        _generateStars();
        _generateNebulae();

        for (var i = 0; i < Config.LOCATIONS.length; i++) {
            var loc = Config.LOCATIONS[i];
            var entry = {
                id: loc.id,
                name: loc.name,
                type: loc.type,
                faction: loc.faction,
                x: loc.x,
                y: loc.y,
                radius: loc.radius,
                color: loc.color,
                description: loc.description,
                services: loc.services.slice(),
                dockable: loc.dockable,
                influence: { earth: 0, mars: 0 },
                isPlayerBuilt: false
            };
            // Copy orbital data
            if (loc.orbit) {
                entry.orbit = {
                    parent: loc.orbit.parent,
                    radius: loc.orbit.radius,
                    period: loc.orbit.period,
                    angle: loc.orbit.angle
                };
            }
            _locations.push(entry);
        }

        // Set initial positions from orbital data
        _updateOrbits();

        // Apply starting influence leans
        var luna = getLocation('luna');
        if (luna) {
            luna.influence.earth = Config.DIPLOMACY.MOON_STARTING_LEAN.earth;
            luna.influence.mars = Config.DIPLOMACY.MOON_STARTING_LEAN.mars;
        }
        var marsOrb = getLocation('mars_orbital');
        if (marsOrb) {
            marsOrb.influence.earth = Config.DIPLOMACY.STATION_STARTING_LEAN.earth;
            marsOrb.influence.mars = Config.DIPLOMACY.STATION_STARTING_LEAN.mars;
        }

        _spawnInitialNPCs();
    }

    function _generateStars() {
        _stars = [];
        for (var i = 0; i < Config.STAR_COUNT; i++) {
            _stars.push({
                x: Math.random() * Config.WORLD_W,
                y: Math.random() * Config.WORLD_H,
                size: Math.random() * 2 + 0.5,
                brightness: Math.random() * 0.5 + 0.5
            });
        }
    }

    function _generateNebulae() {
        _nebulae = [];
        for (var i = 0; i < Config.NEBULA_COUNT; i++) {
            _nebulae.push({
                x: 1000 + Math.random() * (Config.WORLD_W - 2000),
                y: 1000 + Math.random() * (Config.WORLD_H - 2000),
                radius: 200 + Math.random() * 400,
                color: ['rgba(50,20,80,0.15)', 'rgba(20,40,80,0.12)', 'rgba(80,20,30,0.10)', 'rgba(20,60,40,0.12)', 'rgba(60,40,20,0.10)'][i % 5]
            });
        }
    }

    function _spawnInitialNPCs() {
        _npcs = [];
        var earth = getLocation('earth');
        var mars = getLocation('mars');
        var ex = earth ? earth.x : 7500, ey = earth ? earth.y : 7500;
        var mx = mars ? mars.x : 7500, my = mars ? mars.y : 7500;
        // Earth patrol ships — near Earth
        for (var i = 0; i < 5; i++) {
            _spawnNPC('earth_patrol_' + i, Config.FACTION.EARTH, 'patrol',
                ex - 300 + Math.random() * 600, ey - 300 + Math.random() * 600);
        }
        // Mars patrol ships — near Mars
        for (var j = 0; j < 5; j++) {
            _spawnNPC('mars_patrol_' + j, Config.FACTION.MARS, 'patrol',
                mx - 300 + Math.random() * 600, my - 300 + Math.random() * 600);
        }
        // Traders — scattered between Earth and Mars
        for (var k = 0; k < 6; k++) {
            var t = Math.random();
            _spawnNPC('trader_' + k, Config.FACTION.INDEPENDENT, 'trade',
                ex + (mx - ex) * t + (Math.random() - 0.5) * 1000,
                ey + (my - ey) * t + (Math.random() - 0.5) * 1000);
        }
    }

    function _spawnNPC(id, faction, behavior, x, y) {
        // Pick a template based on faction and role
        var factionKey = faction === Config.FACTION.EARTH ? 'earth' :
                         faction === Config.FACTION.MARS ? 'mars' :
                         faction === Config.FACTION.MOON ? 'moon' : 'independent';
        var roleFilter = behavior === 'patrol' ? 'patrol' : behavior === 'trade' ? 'trader' : null;
        var template = ShipTemplates.pickRandom(factionKey, roleFilter);
        var grid = ShipGrid.fromTemplate(template.hullClass, template.blocks);
        var stats = grid.stats;

        var npc = {
            id: id,
            faction: faction,
            behavior: behavior,
            templateId: template.id,
            templateName: template.name,
            grid: grid,
            x: x,
            y: y,
            angle: Math.random() * Math.PI * 2,
            speed: Config.BASE_SPEED * stats.maxSpeed * stats.powerRatio * (0.7 + Math.random() * 0.3),
            hp: stats.totalHP,
            maxHp: stats.totalHP,
            shieldHp: stats.shieldHP,
            maxShieldHp: stats.shieldHP,
            weapon: (stats.weapons.length > 0) ? stats.weapons[0].typeKey : null,
            weaponDef: (stats.weapons.length > 0) ? stats.weapons[0].def : null,
            fireTimer: 0,
            target: null,
            patrolCenter: { x: x, y: y },
            patrolRadius: 400 + Math.random() * 300,
            destX: x, destY: y,
            aiTimer: 0,
            dead: false
        };
        _npcs.push(npc);
        return npc;
    }

    function getLocation(id) {
        for (var i = 0; i < _locations.length; i++) {
            if (_locations[i].id === id) return _locations[i];
        }
        return null;
    }

    function getLocations() { return _locations; }
    function getStars() { return _stars; }
    function getNebulae() { return _nebulae; }
    function getNPCs() { return _npcs; }
    function getProjectiles() { return _projectiles; }
    function getExplosions() { return _explosions; }

    function getNearbyLocation(x, y, range) {
        var best = null, bestDist = range || 200;
        for (var i = 0; i < _locations.length; i++) {
            var loc = _locations[i];
            if (loc.type === Config.LOC_TYPE.STAR) continue; // can't dock at sun
            var dx = loc.x - x, dy = loc.y - y;
            var dist = Math.sqrt(dx * dx + dy * dy) - loc.radius;
            if (dist < bestDist) { bestDist = dist; best = loc; }
        }
        return best;
    }

    function _updateOrbits() {
        // First pass: update bodies orbiting the sun
        for (var i = 0; i < _locations.length; i++) {
            var loc = _locations[i];
            if (!loc.orbit || loc.orbit.parent !== 'sun') continue;
            loc.orbit.angle += (Math.PI * 2) / loc.orbit.period;
            loc.x = Config.SUN_X + Math.cos(loc.orbit.angle) * loc.orbit.radius;
            loc.y = Config.SUN_Y + Math.sin(loc.orbit.angle) * loc.orbit.radius;
        }
        // Second pass: update bodies orbiting planets (moons, stations)
        for (var j = 0; j < _locations.length; j++) {
            var child = _locations[j];
            if (!child.orbit || child.orbit.parent === 'sun') continue;
            var parent = getLocation(child.orbit.parent);
            if (!parent) continue;
            child.orbit.angle += (Math.PI * 2) / child.orbit.period;
            child.x = parent.x + Math.cos(child.orbit.angle) * child.orbit.radius;
            child.y = parent.y + Math.sin(child.orbit.angle) * child.orbit.radius;
        }
    }

    function addPlayerStation(name, type, x, y) {
        var id = 'player_station_' + (_nextId++);
        var stType = Config.STATION_TYPES[type];
        var loc = {
            id: id, name: name, type: Config.LOC_TYPE.STATION,
            faction: Config.FACTION.PLAYER, x: x, y: y, radius: 30,
            color: Config.COLORS.player,
            description: 'Player-built ' + stType.name,
            services: type === 'trade_hub' ? ['trade'] : type === 'military' ? ['missions'] : type === 'diplomatic' ? ['diplomacy'] : ['fuel'],
            dockable: true,
            influence: { earth: 0, mars: 0 },
            isPlayerBuilt: true,
            stationType: type,
            buildProgress: 0,
            buildTime: stType.buildTime,
            built: false,
            income: stType.income,
            influenceValue: stType.influence
        };
        _locations.push(loc);
        return loc;
    }

    function addProjectile(proj) {
        _projectiles.push(proj);
    }

    function addExplosion(x, y, radius) {
        _explosions.push({ x: x, y: y, radius: radius || 20, timer: Config.COMBAT.EXPLOSION_DURATION });
    }

    function tick() {
        // Update orbital positions
        _updateOrbits();

        // Update NPC AI
        for (var i = _npcs.length - 1; i >= 0; i--) {
            var npc = _npcs[i];
            if (npc.dead) { _npcs.splice(i, 1); continue; }
            _updateNPCAI(npc);
        }

        // NPC respawning
        _respawnTimer++;
        if (_respawnTimer >= Config.NPC_RESPAWN_INTERVAL) {
            _respawnTimer = 0;
            _respawnNPCs();
        }

        // Update projectiles
        for (var j = _projectiles.length - 1; j >= 0; j--) {
            var p = _projectiles[j];
            p.x += Math.cos(p.angle) * p.speed;
            p.y += Math.sin(p.angle) * p.speed;
            p.life--;
            if (p.life <= 0 || p.x < 0 || p.x > Config.WORLD_W || p.y < 0 || p.y > Config.WORLD_H) {
                _projectiles.splice(j, 1);
                continue;
            }
        }

        // Update explosions
        for (var k = _explosions.length - 1; k >= 0; k--) {
            _explosions[k].timer--;
            if (_explosions[k].timer <= 0) _explosions.splice(k, 1);
        }

        // Build player stations
        for (var l = 0; l < _locations.length; l++) {
            var loc = _locations[l];
            if (loc.isPlayerBuilt && !loc.built) {
                loc.buildProgress++;
                if (loc.buildProgress >= loc.buildTime) {
                    loc.built = true;
                    Events.emit('station_built', { locationId: loc.id });
                }
            }
        }
    }

    function _updateNPCAI(npc) {
        npc.aiTimer--;
        if (npc.aiTimer > 0) {
            // Move toward destination
            var dx = npc.destX - npc.x;
            var dy = npc.destY - npc.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 10) {
                npc.angle = Math.atan2(dy, dx);
                npc.x += Math.cos(npc.angle) * npc.speed;
                npc.y += Math.sin(npc.angle) * npc.speed;
            } else if (npc.behavior === 'trade' && npc.tradeTarget) {
                // Arrived at trade destination — execute trade
                _npcExecuteTrade(npc);
            }
            // Shield regen
            if (npc.shieldHp < npc.maxShieldHp) {
                npc.shieldHp = Math.min(npc.maxShieldHp, npc.shieldHp + 0.1);
            }
            return;
        }

        // Pick new destination
        npc.aiTimer = 30 + Math.floor(Math.random() * 60);
        if (npc.behavior === 'patrol') {
            // Update patrol center to follow parent planet
            if (npc.faction === Config.FACTION.EARTH) {
                var earthLoc = getLocation('earth');
                if (earthLoc) npc.patrolCenter = { x: earthLoc.x, y: earthLoc.y };
            } else if (npc.faction === Config.FACTION.MARS) {
                var marsLoc = getLocation('mars');
                if (marsLoc) npc.patrolCenter = { x: marsLoc.x, y: marsLoc.y };
            }
            npc.destX = npc.patrolCenter.x + (Math.random() - 0.5) * npc.patrolRadius * 2;
            npc.destY = npc.patrolCenter.y + (Math.random() - 0.5) * npc.patrolRadius * 2;
        } else if (npc.behavior === 'trade') {
            // Smart routing: if carrying cargo, prefer locations that consume it
            var dockable = [];
            for (var li = 0; li < _locations.length; li++) {
                if (_locations[li].dockable) dockable.push(_locations[li]);
            }
            if (dockable.length > 0) {
                var loc = null;
                var cargoKeys = npc.cargo ? Object.keys(npc.cargo) : [];
                var hasGoods = cargoKeys.length > 0 && cargoKeys.some(function(k) { return npc.cargo[k] > 0; });

                if (hasGoods) {
                    // Score locations by how much they want what we carry
                    var best = null, bestScore = -1;
                    for (var di = 0; di < dockable.length; di++) {
                        var dLoc = dockable[di];
                        var dEcon = Config.LOCATION_ECONOMY[dLoc.id];
                        if (!dEcon || !dEcon.consumes) continue;
                        var score = 0;
                        for (var ci = 0; ci < cargoKeys.length; ci++) {
                            if (dEcon.consumes[cargoKeys[ci]]) {
                                score += npc.cargo[cargoKeys[ci]] * (dEcon.consumes[cargoKeys[ci]] || 1);
                                // Bonus for low stock
                                var stk = Economy.getStock(dLoc.id, cargoKeys[ci]);
                                var sCap = dEcon.stockCapacity || 200;
                                if (stk < sCap * 0.3) score += 5;
                            }
                        }
                        if (score > bestScore) { bestScore = score; best = dLoc; }
                    }
                    loc = best || dockable[Math.floor(Math.random() * dockable.length)];
                } else {
                    // No cargo: go to a producer location to pick up goods
                    var producers = dockable.filter(function(d) {
                        var e = Config.LOCATION_ECONOMY[d.id];
                        return e && e.produces && Object.keys(e.produces).length > 0;
                    });
                    loc = producers.length > 0
                        ? producers[Math.floor(Math.random() * producers.length)]
                        : dockable[Math.floor(Math.random() * dockable.length)];
                }
                npc.destX = loc.x + (Math.random() - 0.5) * 60;
                npc.destY = loc.y + (Math.random() - 0.5) * 60;
                npc.tradeTarget = loc.id;
            }
        }
        // Clamp to world
        npc.destX = Math.max(100, Math.min(Config.WORLD_W - 100, npc.destX));
        npc.destY = Math.max(100, Math.min(Config.WORLD_H - 100, npc.destY));
    }

    function _npcExecuteTrade(npc) {
        if (!npc.tradeTarget) return;
        var targetId = npc.tradeTarget;
        npc.tradeTarget = null;

        // Verify we're close enough to the target
        var loc = null;
        for (var i = 0; i < _locations.length; i++) {
            if (_locations[i].id === targetId) {
                var dx = _locations[i].x - npc.x;
                var dy = _locations[i].y - npc.y;
                if (Math.sqrt(dx * dx + dy * dy) < _locations[i].radius + 80) {
                    loc = _locations[i];
                }
                break;
            }
        }
        if (!loc) return;

        var locEcon = Config.LOCATION_ECONOMY[loc.id];
        if (!locEcon) return;
        if (!npc.cargo) npc.cargo = {};

        // Drop off ALL goods this location consumes
        if (locEcon.consumes) {
            var consKeys = Object.keys(locEcon.consumes);
            for (var c = 0; c < consKeys.length; c++) {
                var cRes = consKeys[c];
                if (npc.cargo[cRes] && npc.cargo[cRes] > 0) {
                    var delivered = Economy.npcDeliver(loc.id, cRes, npc.cargo[cRes]);
                    npc.cargo[cRes] -= delivered;
                    if (npc.cargo[cRes] <= 0) delete npc.cargo[cRes];
                }
            }
        }

        // Pick up surplus goods (multiple resources, larger amounts)
        if (locEcon.produces) {
            var prodKeys = Object.keys(locEcon.produces);
            var cargoTotal = 0;
            for (var k in npc.cargo) cargoTotal += npc.cargo[k];
            var maxCargo = 40; // NPC cargo capacity

            for (var p = 0; p < prodKeys.length && cargoTotal < maxCargo; p++) {
                var pickRes = prodKeys[p];
                var stock = Economy.getStock(loc.id, pickRes);
                var cap = (locEcon.stockCapacity || 200);
                // Pick up if stock > 30% of capacity (leave some for player/others)
                if (stock > cap * 0.3) {
                    var take = Math.min(
                        5 + Math.floor(Math.random() * 8),
                        stock - Math.floor(cap * 0.25),
                        maxCargo - cargoTotal
                    );
                    if (take > 0) {
                        var taken = Economy.npcPickup(loc.id, pickRes, take);
                        npc.cargo[pickRes] = (npc.cargo[pickRes] || 0) + taken;
                        cargoTotal += taken;
                    }
                }
            }
        }
    }

    function _respawnNPCs() {
        var earthPatrols = 0, marsPatrols = 0, traders = 0, earthTraders = 0, marsTraders = 0;
        for (var i = 0; i < _npcs.length; i++) {
            var n = _npcs[i];
            if (n.dead) continue;
            if (n.behavior === 'patrol') {
                if (n.faction === Config.FACTION.EARTH) earthPatrols++;
                else if (n.faction === Config.FACTION.MARS) marsPatrols++;
            } else if (n.behavior === 'trade') {
                if (n.faction === Config.FACTION.EARTH) earthTraders++;
                else if (n.faction === Config.FACTION.MARS) marsTraders++;
                else traders++;
            }
        }
        var earth = getLocation('earth');
        var mars = getLocation('mars');
        var ex = earth ? earth.x : Config.SUN_X, ey = earth ? earth.y : Config.SUN_Y;
        var mx = mars ? mars.x : Config.SUN_X, my = mars ? mars.y : Config.SUN_Y;
        var maxP = Config.NPC_MAX_PATROLS;
        var maxT = Config.NPC_MAX_TRADERS;
        if (earthPatrols < maxP) {
            _spawnNPC('earth_patrol_r' + (_nextId++), Config.FACTION.EARTH, 'patrol',
                ex - 300 + Math.random() * 600, ey - 300 + Math.random() * 600);
        }
        if (marsPatrols < maxP) {
            _spawnNPC('mars_patrol_r' + (_nextId++), Config.FACTION.MARS, 'patrol',
                mx - 300 + Math.random() * 600, my - 300 + Math.random() * 600);
        }
        // Independent traders
        if (traders < maxT) {
            var t = Math.random();
            _spawnNPC('trader_r' + (_nextId++), Config.FACTION.INDEPENDENT, 'trade',
                ex + (mx - ex) * t + (Math.random() - 0.5) * 1000,
                ey + (my - ey) * t + (Math.random() - 0.5) * 1000);
        }
        // Earth faction traders
        if (earthTraders < 2) {
            _spawnNPC('earth_trader_r' + (_nextId++), Config.FACTION.EARTH, 'trade',
                ex + (Math.random() - 0.5) * 600, ey + (Math.random() - 0.5) * 600);
        }
        // Mars faction traders
        if (marsTraders < 2) {
            _spawnNPC('mars_trader_r' + (_nextId++), Config.FACTION.MARS, 'trade',
                mx + (Math.random() - 0.5) * 600, my + (Math.random() - 0.5) * 600);
        }
    }

    function serialize() {
        return {
            locations: _locations.map(function (l) {
                return {
                    id: l.id, influence: { earth: l.influence.earth, mars: l.influence.mars },
                    isPlayerBuilt: l.isPlayerBuilt, buildProgress: l.buildProgress || 0,
                    built: l.built || false, stationType: l.stationType || null,
                    name: l.name, x: l.x, y: l.y,
                    orbitAngle: l.orbit ? l.orbit.angle : null
                };
            }),
            npcs: _npcs.map(function (n) {
                return {
                    id: n.id, faction: n.faction, behavior: n.behavior,
                    x: n.x, y: n.y, angle: n.angle, hp: n.hp, maxHp: n.maxHp,
                    shieldHp: n.shieldHp, maxShieldHp: n.maxShieldHp,
                    patrolCenter: n.patrolCenter, dead: n.dead
                };
            }),
            nextId: _nextId
        };
    }

    function deserialize(data) {
        if (!data) return;
        _nextId = data.nextId || 1;

        // Regenerate stars/nebulae (cosmetic only)
        _generateStars();
        _generateNebulae();

        // Rebuild locations from Config baseline
        _locations = [];
        for (var c = 0; c < Config.LOCATIONS.length; c++) {
            var loc = Config.LOCATIONS[c];
            var entry = {
                id: loc.id, name: loc.name, type: loc.type, faction: loc.faction,
                x: loc.x, y: loc.y, radius: loc.radius, color: loc.color,
                description: loc.description, services: loc.services.slice(),
                dockable: loc.dockable,
                influence: { earth: 0, mars: 0 },
                isPlayerBuilt: false
            };
            if (loc.orbit) {
                entry.orbit = {
                    parent: loc.orbit.parent,
                    radius: loc.orbit.radius,
                    period: loc.orbit.period,
                    angle: loc.orbit.angle
                };
            }
            _locations.push(entry);
        }

        // Restore saved influence, orbital angles, and player-built stations
        if (data.locations) {
            for (var i = 0; i < data.locations.length; i++) {
                var saved = data.locations[i];
                var existing = getLocation(saved.id);
                if (existing) {
                    existing.influence = saved.influence || { earth: 0, mars: 0 };
                    if (saved.orbitAngle != null && existing.orbit) {
                        existing.orbit.angle = saved.orbitAngle;
                    }
                    if (saved.isPlayerBuilt) {
                        existing.buildProgress = saved.buildProgress;
                        existing.built = saved.built;
                    }
                } else if (saved.isPlayerBuilt) {
                    var stType = Config.STATION_TYPES[saved.stationType];
                    _locations.push({
                        id: saved.id, name: saved.name, type: Config.LOC_TYPE.STATION,
                        faction: Config.FACTION.PLAYER, x: saved.x, y: saved.y, radius: 30,
                        color: Config.COLORS.player, description: 'Player-built station',
                        services: saved.stationType === 'trade_hub' ? ['trade'] : saved.stationType === 'military' ? ['missions'] : saved.stationType === 'diplomatic' ? ['diplomacy'] : ['fuel'],
                        dockable: true,
                        influence: saved.influence || { earth: 0, mars: 0 },
                        isPlayerBuilt: true,
                        stationType: saved.stationType,
                        buildProgress: saved.buildProgress || 0,
                        buildTime: stType ? stType.buildTime : 100,
                        built: saved.built || false,
                        income: stType ? stType.income : 0,
                        influenceValue: stType ? stType.influence : 0
                    });
                }
            }
        }

        // Restore saved NPCs
        _npcs = [];
        if (data.npcs) {
            for (var j = 0; j < data.npcs.length; j++) {
                var sn = data.npcs[j];
                if (sn.dead) continue;
                var npc = {
                    id: sn.id, faction: sn.faction, behavior: sn.behavior,
                    x: sn.x, y: sn.y, angle: sn.angle || 0,
                    speed: Config.BASE_SPEED * (0.5 + Math.random() * 0.5),
                    hp: sn.hp, maxHp: sn.maxHp,
                    shieldHp: sn.shieldHp, maxShieldHp: sn.maxShieldHp,
                    weapon: sn.behavior === 'patrol' ? 'laser' : null,
                    fireTimer: 0, target: null,
                    patrolCenter: sn.patrolCenter || { x: sn.x, y: sn.y },
                    patrolRadius: 400 + Math.random() * 300,
                    destX: sn.x, destY: sn.y,
                    aiTimer: 0, dead: false
                };
                _npcs.push(npc);
            }
        } else {
            _spawnInitialNPCs();
        }

        _projectiles = [];
        _explosions = [];
        _respawnTimer = 0;
    }

    return {
        init: init,
        tick: tick,
        getLocations: getLocations,
        getLocation: getLocation,
        getStars: getStars,
        getNebulae: getNebulae,
        getNPCs: getNPCs,
        getProjectiles: getProjectiles,
        getExplosions: getExplosions,
        getNearbyLocation: getNearbyLocation,
        addPlayerStation: addPlayerStation,
        addProjectile: addProjectile,
        addExplosion: addExplosion,
        serialize: serialize,
        deserialize: deserialize
    };
})();
