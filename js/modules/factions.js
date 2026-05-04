/* ============================================================
 * Solar Dominion — Factions Module
 * Tracks faction relationships, reputations, alliances, and
 * AI strategy selection for Earth and Mars.
 * ============================================================ */
var Factions = (function () {
    'use strict';

    var _factions = {};
    var _playerRep = {};
    var _strategyEvalTimer = 0;
    var _buildTimers = {}; // per-faction build state
    var STRATEGY_EVAL_INTERVAL = 600; // evaluate every ~60 seconds
    var BUILD_CHECK_INTERVAL = 300;   // check build AI every ~30 seconds
    var _buildCheckTimer = 0;

    // Fleet attack missions
    var _fleetAttacks = [];
    var _fleetAttackTimer = 0;
    var FLEET_ATTACK_INTERVAL = 3000; // ~5 min between fleet attack checks
    var FLEET_ATTACK_MIN_SHIPS = 5;
    var _fleetAttackIdCounter = 0;

    // Ship classes factions can build — cost materials from home location stocks
    var FACTION_SHIP_CLASSES = {
        patrol_corvette: {
            name: 'Patrol Corvette',
            buildTime: 150,  // ticks (~15 sec)
            militaryPower: 3,
            materials: { metal: 8, electronics: 3, construction_mats: 2 },
            credits: 2000,
            priority: 'military', // only built by military-leaning factions
            minWarHawk: 0
        },
        assault_frigate: {
            name: 'Assault Frigate',
            buildTime: 300,
            militaryPower: 8,
            materials: { metal: 15, refined_metals: 6, electronics: 5, weapons_components: 4 },
            credits: 8000,
            priority: 'military',
            minWarHawk: 30
        },
        battle_cruiser: {
            name: 'Battle Cruiser',
            buildTime: 600,
            militaryPower: 20,
            materials: { metal: 30, refined_metals: 15, electronics: 10, weapons_components: 10, advanced_components: 5, shield_components: 4 },
            credits: 25000,
            priority: 'military',
            minWarHawk: 50
        },
        carrier: {
            name: 'Carrier',
            buildTime: 900,
            militaryPower: 30,
            materials: { metal: 50, refined_metals: 20, electronics: 15, advanced_components: 8, weapons_components: 6, data_cores: 2 },
            credits: 50000,
            priority: 'military',
            minWarHawk: 60
        },
        trade_hauler: {
            name: 'Trade Hauler',
            buildTime: 100,
            militaryPower: 0,
            economyBoost: 3,
            materials: { metal: 6, construction_mats: 4, electronics: 2 },
            credits: 1500,
            priority: 'economic',
            minWarHawk: 0
        },
        diplomatic_vessel: {
            name: 'Diplomatic Vessel',
            buildTime: 200,
            militaryPower: 1,
            diplomacyBoost: 2,
            materials: { metal: 5, electronics: 4, luxury_goods: 3, cultural_artifacts: 1 },
            credits: 5000,
            priority: 'diplomatic',
            minWarHawk: 0
        },
        research_ship: {
            name: 'Research Ship',
            buildTime: 250,
            militaryPower: 1,
            economyBoost: 2,
            materials: { metal: 8, electronics: 8, advanced_components: 4, data_cores: 2 },
            credits: 10000,
            priority: 'economic',
            minWarHawk: 0
        }
    };

    function init() {
        _factions = {};
        _strategyEvalTimer = 0;
        _buildCheckTimer = 0;
        _buildTimers = {};
        _buildTimers[Config.FACTION.EARTH] = { building: null, timer: 0, queue: [], shipsBuilt: [] };
        _buildTimers[Config.FACTION.MARS] = { building: null, timer: 0, queue: [], shipsBuilt: [] };

        _factions[Config.FACTION.EARTH] = {
            id: Config.FACTION.EARTH,
            name: 'Earth Alliance',
            description: 'Industrial powerhouse with conventional military might.',
            strengths: { shields: 1.2, shipCost: 0.9, crew: 1.3 },
            militaryPower: 80,
            economy: 90,
            atWar: true,
            enemy: Config.FACTION.MARS,
            // AI strategy system
            warHawk: 30,        // 0-100, how aggressive (Earth starts diplomatic)
            diplomacy: 70,      // 0-100, how diplomatic
            activeStrategies: [],
            strategyScores: {},
            strategyHistory: [],
            // Internal politics — Earth is deeply divided
            politics: {
                unity: 40,          // 0-100, how unified (Earth starts low — very divided)
                factions: [
                    { id: 'hawks', name: 'War Hawks Coalition', support: 25,
                      desc: 'Military hardliners demanding Mars unconditional surrender.',
                      warBias: 20, diploBias: -10, econBias: -5 },
                    { id: 'doves', name: 'Peace & Prosperity Party', support: 30,
                      desc: 'Diplomats and merchants pushing for ceasefire and trade.',
                      warBias: -15, diploBias: 20, econBias: 10 },
                    { id: 'isolationists', name: 'Earth First Movement', support: 20,
                      desc: 'Want to abandon Mars operations and invest on Earth.',
                      warBias: -5, diploBias: -5, econBias: 15 },
                    { id: 'expansionists', name: 'Colonial Expansion Bureau', support: 25,
                      desc: 'Pragmatic expansionists seeking to control all colonies.',
                      warBias: 10, diploBias: 5, econBias: 5 }
                ],
                crisisTimer: 0,     // ticks until next potential political crisis
                crisisActive: null, // current political crisis event
                coupRisk: 0         // 0-100, risk of leadership change
            }
        };
        _factions[Config.FACTION.MARS] = {
            id: Config.FACTION.MARS,
            name: 'Mars Confederacy',
            description: 'Technologically advanced elite forces.',
            strengths: { weapons: 1.3, engines: 1.2, tech: 1.4 },
            militaryPower: 70,
            economy: 70,
            atWar: true,
            enemy: Config.FACTION.EARTH,
            warHawk: 65,
            diplomacy: 35,
            activeStrategies: [],
            strategyScores: {},
            strategyHistory: [],
            // Internal politics — Mars is more unified but still has tensions
            politics: {
                unity: 70,          // Mars is more cohesive
                factions: [
                    { id: 'technocrats', name: 'Technocrat Council', support: 40,
                      desc: 'Scientists and engineers running Mars. Favor tech superiority.',
                      warBias: 5, diploBias: 0, econBias: 5 },
                    { id: 'militants', name: 'Red Legion', support: 35,
                      desc: 'Military veterans wanting to strike Earth decisively.',
                      warBias: 20, diploBias: -10, econBias: -5 },
                    { id: 'reformists', name: 'New Mars Coalition', support: 25,
                      desc: 'Younger generation seeking peaceful independence.',
                      warBias: -10, diploBias: 15, econBias: 5 }
                ],
                crisisTimer: 0,
                crisisActive: null,
                coupRisk: 0
            }
        };
        _factions[Config.FACTION.MOON] = {
            id: Config.FACTION.MOON,
            name: 'Luna Colony',
            description: 'Neutral moon colony. Your home base.',
            strengths: {},
            militaryPower: 20,
            economy: 40,
            atWar: false,
            leaning: 'neutral'
        };
        _factions[Config.FACTION.MARS_STATION] = {
            id: Config.FACTION.MARS_STATION,
            name: 'Ares Station',
            description: 'Neutral orbital station near Mars.',
            strengths: {},
            militaryPower: 15,
            economy: 35,
            atWar: false,
            leaning: 'neutral'
        };
        _factions[Config.FACTION.INDEPENDENT] = {
            id: Config.FACTION.INDEPENDENT,
            name: 'Independents',
            description: 'Various independent traders and stations.',
            strengths: {},
            militaryPower: 10,
            economy: 50,
            atWar: false
        };

        _playerRep = {};
        _playerRep[Config.FACTION.EARTH] = 0;
        _playerRep[Config.FACTION.MARS] = 0;
        _playerRep[Config.FACTION.MOON] = 10;
        _playerRep[Config.FACTION.MARS_STATION] = 0;
        _playerRep[Config.FACTION.INDEPENDENT] = 5;

        // Pick initial strategies
        _selectStrategies(Config.FACTION.EARTH);
        _selectStrategies(Config.FACTION.MARS);
    }

    // ── Strategy AI ─────────────────────────────────────────
    function _selectStrategies(factionId) {
        var faction = _factions[factionId];
        if (!faction || !faction.hasOwnProperty('warHawk')) return;

        var fKey = factionId === Config.FACTION.EARTH ? 'earth' : 'mars';
        var pool = Config.FACTION_STRATEGIES[fKey];
        if (!pool || pool.length === 0) return;

        // Weight strategies by faction temperament
        var weighted = [];
        for (var i = 0; i < pool.length; i++) {
            var s = pool[i];
            var w = s.weight;
            // Bias by faction's warHawk / diplomacy values
            if (s.type === 'military' || s.type === 'covert') {
                w *= (faction.warHawk / 50); // >1 if warHawk > 50
            } else if (s.type === 'diplomatic') {
                w *= (faction.diplomacy / 50);
            }
            // Economic strategies are always moderately weighted
            if (s.type === 'economic') w *= 0.8 + (faction.economy / 200);
            weighted.push({ strategy: s, weight: Math.max(0.1, w) });
        }

        // Weighted random selection of 3 strategies (no duplicates)
        var selected = [];
        var totalWeight = 0;
        for (var j = 0; j < weighted.length; j++) totalWeight += weighted[j].weight;

        for (var pick = 0; pick < 3 && weighted.length > 0; pick++) {
            var roll = Math.random() * totalWeight;
            var cumulative = 0;
            for (var k = 0; k < weighted.length; k++) {
                cumulative += weighted[k].weight;
                if (roll <= cumulative) {
                    selected.push(weighted[k].strategy.id);
                    totalWeight -= weighted[k].weight;
                    weighted.splice(k, 1);
                    break;
                }
            }
        }

        faction.activeStrategies = selected;
        Events.emit('faction_strategy_changed', { faction: factionId, strategies: selected });
    }

    function _evaluateStrategies() {
        _evaluateFaction(Config.FACTION.EARTH);
        _evaluateFaction(Config.FACTION.MARS);
    }

    function _evaluateFaction(factionId) {
        var faction = _factions[factionId];
        if (!faction || !faction.activeStrategies) return;

        var enemy = _factions[faction.enemy];
        if (!enemy) return;

        // Evaluate how well current strategies match the game state
        var score = 0;
        var strategies = getActiveStrategies(factionId);
        for (var i = 0; i < strategies.length; i++) {
            var s = strategies[i];
            // Military strategies score well when faction is strong
            if (s.type === 'military') {
                score += (faction.militaryPower > enemy.militaryPower) ? 2 : -1;
            }
            // Diplomatic strategies score well when faction economy is strong
            if (s.type === 'diplomatic') {
                score += (faction.economy > 60) ? 1 : -1;
            }
            // Economic strategies always somewhat useful
            if (s.type === 'economic') score += 1;
            // Covert strategies score well when weaker
            if (s.type === 'covert') {
                score += (faction.militaryPower < enemy.militaryPower) ? 2 : 0;
            }
        }

        // Temperament drift based on game state
        if (faction.militaryPower < enemy.militaryPower - 15) {
            // Losing militarily — split between doubling down and seeking peace
            if (Math.random() < 0.4) {
                faction.diplomacy = Math.min(100, faction.diplomacy + 2);
                faction.warHawk = Math.max(0, faction.warHawk - 1);
            } else {
                faction.warHawk = Math.min(100, faction.warHawk + 1);
            }
        } else if (faction.militaryPower > enemy.militaryPower + 15) {
            // Winning — become more aggressive
            faction.warHawk = Math.min(100, faction.warHawk + 1);
            faction.diplomacy = Math.max(0, faction.diplomacy - 0.5);
        }

        // Switch strategies if current ones score poorly, or periodically
        var shouldSwitch = score < 0 || Math.random() < 0.15;

        if (shouldSwitch) {
            faction.strategyHistory.push(faction.activeStrategies.slice());
            if (faction.strategyHistory.length > 10) faction.strategyHistory.shift();
            _selectStrategies(factionId);
        }
    }

    function getActiveStrategies(factionId) {
        var f = _factions[factionId];
        if (!f || !f.activeStrategies) return [];
        var fKey = factionId === Config.FACTION.EARTH ? 'earth' : 'mars';
        var pool = Config.FACTION_STRATEGIES[fKey];
        var result = [];
        for (var i = 0; i < f.activeStrategies.length; i++) {
            for (var j = 0; j < pool.length; j++) {
                if (pool[j].id === f.activeStrategies[i]) {
                    result.push(pool[j]);
                    break;
                }
            }
        }
        return result;
    }

    function getStrategyMissionTypes(factionId) {
        var strategies = getActiveStrategies(factionId);
        var types = {};
        for (var i = 0; i < strategies.length; i++) {
            var mt = strategies[i].missionTypes;
            for (var j = 0; j < mt.length; j++) {
                types[mt[j]] = (types[mt[j]] || 0) + 1;
            }
        }
        return types;
    }

    // ── Core API ────────────────────────────────────────────
    function getFaction(id) { return _factions[id] || null; }
    function getAllFactions() { return _factions; }
    function getRep(factionId) { return _playerRep[factionId] || 0; }

    function changeRep(factionId, amount) {
        if (!_playerRep.hasOwnProperty(factionId)) return;
        _playerRep[factionId] = Math.max(Config.DIPLOMACY.REP_MIN,
            Math.min(Config.DIPLOMACY.REP_MAX, _playerRep[factionId] + amount));
        Events.emit('reputation_changed', { faction: factionId, rep: _playerRep[factionId], change: amount });
    }

    function getStanding(factionId) {
        var rep = _playerRep[factionId] || 0;
        if (rep >= Config.DIPLOMACY.ALLY_THRESHOLD) return 'allied';
        if (rep >= Config.DIPLOMACY.NEUTRAL_THRESHOLD) return 'friendly';
        if (rep > -Config.DIPLOMACY.NEUTRAL_THRESHOLD) return 'neutral';
        if (rep > Config.DIPLOMACY.ENEMY_THRESHOLD) return 'unfriendly';
        return 'hostile';
    }

    function isHostile(factionId) {
        return getStanding(factionId) === 'hostile';
    }

    function getLeaning(neutralFactionId) {
        var f = _factions[neutralFactionId];
        if (!f || !f.hasOwnProperty('leaning')) return null;
        return f.leaning;
    }

    function setLeaning(neutralFactionId, side) {
        var f = _factions[neutralFactionId];
        if (!f) return;
        if (f.leaning === side) return; // no change, skip event
        f.leaning = side;
        Events.emit('faction_leaning_changed', { faction: neutralFactionId, leaning: side });
    }

    // ── Faction Ship Building AI ──────────────────────────────

    function _getHomeLocation(factionId) {
        if (factionId === Config.FACTION.EARTH) return 'earth';
        if (factionId === Config.FACTION.MARS) return 'mars';
        return null;
    }

    function _canBuildShip(factionId, shipClassId) {
        var cls = FACTION_SHIP_CLASSES[shipClassId];
        if (!cls) return false;
        var faction = _factions[factionId];
        if (!faction) return false;
        // Check warHawk threshold
        if (cls.priority === 'military' && faction.warHawk < cls.minWarHawk) return false;
        // Diplomatic ships need diplomacy > 30
        if (cls.priority === 'diplomatic' && faction.diplomacy < 30) return false;

        var homeLoc = _getHomeLocation(factionId);
        if (!homeLoc) return false;

        // Check all material requirements against location stocks
        for (var mat in cls.materials) {
            if (Economy.getStock(homeLoc, mat) < cls.materials[mat]) return false;
        }
        return true;
    }

    function _consumeShipMaterials(factionId, shipClassId) {
        var cls = FACTION_SHIP_CLASSES[shipClassId];
        var homeLoc = _getHomeLocation(factionId);
        if (!cls || !homeLoc) return false;

        // Verify all materials available first
        for (var mat in cls.materials) {
            if (Economy.getStock(homeLoc, mat) < cls.materials[mat]) return false;
        }
        // Consume
        for (var mat2 in cls.materials) {
            Economy.consumeStock(homeLoc, mat2, cls.materials[mat2]);
        }
        return true;
    }

    function _decideBuild(factionId) {
        var faction = _factions[factionId];
        if (!faction) return null;
        var bt = _buildTimers[factionId];
        if (!bt || bt.building) return null; // already building

        var enemy = _factions[faction.enemy];
        var strategies = getActiveStrategies(factionId);
        var homeLoc = _getHomeLocation(factionId);

        // Determine what types of ships to prioritize
        var wantMilitary = false, wantEconomic = false, wantDiplomatic = false;
        for (var i = 0; i < strategies.length; i++) {
            var t = strategies[i].type;
            if (t === 'military' || t === 'covert') wantMilitary = true;
            if (t === 'economic') wantEconomic = true;
            if (t === 'diplomatic') wantDiplomatic = true;
        }

        // Always want military if enemy is stronger
        if (enemy && faction.militaryPower < enemy.militaryPower) wantMilitary = true;
        // Default to military if warHawk > 50
        if (faction.warHawk > 50) wantMilitary = true;

        // Score each buildable ship class
        var best = null, bestScore = -1;
        for (var clsId in FACTION_SHIP_CLASSES) {
            if (!_canBuildShip(factionId, clsId)) continue;
            var cls = FACTION_SHIP_CLASSES[clsId];

            // Stock-aware throttling: penalize if building would drain key resources below 20%
            var stockPenalty = 1.0;
            if (homeLoc) {
                var locEcon = Config.LOCATION_ECONOMY[homeLoc];
                var sCap = (locEcon && locEcon.stockCapacity) || 200;
                for (var mat in cls.materials) {
                    var curStock = Economy.getStock(homeLoc, mat);
                    var afterBuild = curStock - cls.materials[mat];
                    if (afterBuild < sCap * 0.15) stockPenalty *= 0.3; // heavily penalize
                    else if (afterBuild < sCap * 0.3) stockPenalty *= 0.6;
                }
            }

            var score = 0;
            if (cls.priority === 'military' && wantMilitary) {
                score = cls.militaryPower * 2;
                if (enemy && faction.militaryPower < enemy.militaryPower - 10) score *= 1.5;
            } else if (cls.priority === 'economic' && wantEconomic) {
                score = (cls.economyBoost || 0) * 3 + 2;
            } else if (cls.priority === 'diplomatic' && wantDiplomatic) {
                score = (cls.diplomacyBoost || 0) * 3 + 3;
            } else {
                score = 1;
            }

            score *= stockPenalty;
            score *= (0.8 + Math.random() * 0.4);

            if (score > bestScore) { bestScore = score; best = clsId; }
        }

        // Don't build if best score is too low (resource scarcity)
        if (bestScore < 0.5) return null;

        return best;
    }

    function _startBuild(fId, bt) {
        var chosen = _decideBuild(fId);
        if (!chosen) return;
        if (!_consumeShipMaterials(fId, chosen)) return;
        bt.building = chosen;
        var baseBuildTime = FACTION_SHIP_CLASSES[chosen].buildTime;
        bt.timer = baseBuildTime;
        bt.originalBuildTime = baseBuildTime;
        // Apply faction strengths (Earth: shipCost 0.9 = 10% faster, not 0.8)
        var faction = _factions[fId];
        if (faction && faction.strengths && faction.strengths.shipCost) {
            bt.timer = Math.round(bt.timer * (0.5 + faction.strengths.shipCost * 0.5));
        }
        // Internal politics: low unity slows building
        var buildEff = (faction && faction._buildEfficiency) || 1.0;
        if (buildEff < 1.0) {
            bt.timer = Math.round(bt.timer / buildEff);
        }
        bt.originalBuildTime = bt.timer;
        Events.emit('faction_ship_building', {
            faction: fId,
            shipClass: chosen,
            shipName: FACTION_SHIP_CLASSES[chosen].name,
            buildTime: bt.timer
        });
    }

    function _tickBuild() {
        _buildCheckTimer++;

        var factionIds = [Config.FACTION.EARTH, Config.FACTION.MARS];
        for (var fi = 0; fi < factionIds.length; fi++) {
            var fId = factionIds[fi];
            var bt = _buildTimers[fId];
            if (!bt) continue;

            if (bt.building) {
                // Progress current build
                bt.timer--;
                if (bt.timer <= 0) {
                    // Build complete!
                    var cls = FACTION_SHIP_CLASSES[bt.building];
                    var faction = _factions[fId];
                    if (cls && faction) {
                        // Diminishing returns on military power
                        var mpGain = cls.militaryPower;
                        if (faction.militaryPower > 100) mpGain *= 0.8;
                        if (faction.militaryPower > 150) mpGain *= 0.7;
                        faction.militaryPower += Math.max(1, Math.round(mpGain));
                        if (cls.economyBoost) faction.economy = Math.min(150, faction.economy + cls.economyBoost);
                        if (cls.diplomacyBoost) faction.diplomacy = Math.min(100, faction.diplomacy + cls.diplomacyBoost);
                        bt.shipsBuilt.push({ classId: bt.building, name: cls.name, time: Date.now() });
                        if (bt.shipsBuilt.length > 20) bt.shipsBuilt.shift();
                        Events.emit('faction_ship_built', {
                            faction: fId,
                            shipClass: bt.building,
                            shipName: cls.name,
                            militaryPower: faction.militaryPower
                        });
                    }
                    bt.building = null;
                    bt.timer = 0;
                    // Immediately try to start next build (no idle gap)
                    _startBuild(fId, bt);
                }
            } else if (_buildCheckTimer >= BUILD_CHECK_INTERVAL) {
                _startBuild(fId, bt);
            }
        }
        if (_buildCheckTimer >= BUILD_CHECK_INTERVAL) _buildCheckTimer = 0;
    }

    function getBuildState(factionId) {
        var bt = _buildTimers[factionId];
        if (!bt) return null;
        var totalTime = bt.originalBuildTime || (bt.building ? FACTION_SHIP_CLASSES[bt.building].buildTime : 0);
        return {
            building: bt.building,
            timer: bt.timer,
            shipName: bt.building ? FACTION_SHIP_CLASSES[bt.building].name : null,
            progress: bt.building ? 1 - (bt.timer / Math.max(1, totalTime)) : 0,
            shipsBuilt: bt.shipsBuilt
        };
    }

    // ── Internal Politics System ──────────────────────────────
    var POLITICS_TICK_INTERVAL = 300; // every 30 seconds
    var _politicsTimer = 0;

    // Political crisis events that can affect a faction
    var CRISIS_TYPES = [
        { id: 'budget_dispute', name: 'Budget Dispute', desc: 'Internal factions arguing over military vs civilian spending.',
          effects: { economy: -3, unity: -5 }, duration: 600, warBias: 0 },
        { id: 'peace_protests', name: 'Peace Protests', desc: 'Massive anti-war protests erupting across the homeland.',
          effects: { warHawk: -8, diplomacy: 5, unity: -8 }, duration: 900, warBias: -10 },
        { id: 'war_rally', name: 'War Rally', desc: 'Patriotic fervor sweeping the population after a perceived enemy provocation.',
          effects: { warHawk: 10, diplomacy: -5, unity: 8, militaryPower: 3 }, duration: 600, warBias: 15 },
        { id: 'corruption_scandal', name: 'Corruption Scandal', desc: 'High-ranking officials caught embezzling military funds.',
          effects: { economy: -5, unity: -10, militaryPower: -2 }, duration: 1200, warBias: 0 },
        { id: 'supply_shortage', name: 'Supply Chain Crisis', desc: 'Critical supply lines disrupted by internal disagreements.',
          effects: { economy: -8, militaryPower: -3 }, duration: 900, warBias: 0 },
        { id: 'tech_breakthrough', name: 'Tech Breakthrough', desc: 'Scientists achieve a major advance, boosting national morale.',
          effects: { economy: 3, unity: 5, militaryPower: 2 }, duration: 300, warBias: 0 },
        { id: 'election_crisis', name: 'Leadership Election', desc: 'A contentious election splits the population.',
          effects: { unity: -15 }, duration: 1500, warBias: 0, earthOnly: true },
        { id: 'secession_threat', name: 'Secession Threat', desc: 'A major city-state threatens to declare independence.',
          effects: { unity: -20, economy: -5, militaryPower: -5 }, duration: 1800, warBias: 0, earthOnly: true },
        { id: 'refugee_crisis', name: 'Refugee Crisis', desc: 'War refugees straining civilian infrastructure.',
          effects: { economy: -4, unity: -6, diplomacy: 3 }, duration: 900, warBias: -5 },
        { id: 'military_purge', name: 'Military Purge', desc: 'Leadership cracks down on dissenting officers.',
          effects: { unity: 10, militaryPower: -8, warHawk: 5 }, duration: 600, warBias: 5, marsOnly: true },
        { id: 'propaganda_push', name: 'Propaganda Campaign', desc: 'State media launches a coordinated messaging effort.',
          effects: { unity: 8, warHawk: 3, diplomacy: -2 }, duration: 600, warBias: 5 },
        { id: 'trade_embargo', name: 'Internal Trade Dispute', desc: 'Economic factions impose internal trade barriers.',
          effects: { economy: -6, unity: -4 }, duration: 900, warBias: 0 },
        { id: 'heroic_victory', name: 'Celebrated Victory', desc: 'A military victory boosts national pride tremendously.',
          effects: { unity: 12, warHawk: 5, militaryPower: 3 }, duration: 300, warBias: 10 },
        { id: 'war_fatigue', name: 'War Fatigue', desc: 'Population growing weary of prolonged conflict.',
          effects: { warHawk: -6, diplomacy: 8, unity: -3, militaryPower: -2 }, duration: 1200, warBias: -8 },
        { id: 'food_crisis', name: 'Food Production Crisis', desc: 'Agricultural output falling, civilian unrest growing.',
          effects: { economy: -7, unity: -8 }, duration: 1200, warBias: 0, earthOnly: true },
        { id: 'dome_failure', name: 'Habitat Dome Failure', desc: 'Critical life support failure diverts resources from war effort.',
          effects: { economy: -5, unity: -6, militaryPower: -3 }, duration: 900, warBias: -5, marsOnly: true },
        { id: 'defection', name: 'High-Profile Defection', desc: 'A prominent leader defects to the other side.',
          effects: { unity: -12, diplomacy: -5, militaryPower: -2 }, duration: 600, warBias: 0 },
        { id: 'alliance_proposal', name: 'Alliance Proposal', desc: 'A political faction proposes secret peace negotiations.',
          effects: { diplomacy: 10, warHawk: -5, unity: -5 }, duration: 900, warBias: -10 }
    ];

    function _tickPolitics() {
        _politicsTimer++;
        if (_politicsTimer < POLITICS_TICK_INTERVAL) return;
        _politicsTimer = 0;

        _tickFactionPolitics(Config.FACTION.EARTH);
        _tickFactionPolitics(Config.FACTION.MARS);
    }

    function _tickFactionPolitics(factionId) {
        var faction = _factions[factionId];
        if (!faction || !faction.politics) return;
        var pol = faction.politics;
        var isEarth = factionId === Config.FACTION.EARTH;

        // ── Process active crisis ──
        if (pol.crisisActive) {
            pol.crisisActive.remaining--;
            if (pol.crisisActive.remaining <= 0) {
                Events.emit('political_crisis_ended', {
                    faction: factionId,
                    crisis: pol.crisisActive.id,
                    name: pol.crisisActive.name
                });
                pol.crisisActive = null;
            }
        }

        // ── Political faction support drift ──
        var factions = pol.factions;
        for (var i = 0; i < factions.length; i++) {
            var pf = factions[i];
            // Support shifts based on game state
            var shift = 0;
            if (pf.warBias > 0 && faction.militaryPower > (_factions[faction.enemy] || {}).militaryPower) {
                shift += 0.5; // war hawks gain when winning
            }
            if (pf.warBias < 0 && faction.militaryPower < ((_factions[faction.enemy] || {}).militaryPower || 0)) {
                shift += 0.8; // peace factions gain when losing
            }
            if (pf.econBias > 0 && faction.economy < 50) {
                shift += 0.6; // economic factions gain during recession
            }
            // Random drift
            shift += (Math.random() - 0.5) * 1.5;
            pf.support = Math.max(5, Math.min(60, pf.support + shift));
        }

        // Normalize support to sum to 100
        var total = 0;
        for (var n = 0; n < factions.length; n++) total += factions[n].support;
        for (var nn = 0; nn < factions.length; nn++) factions[nn].support = (factions[nn].support / total) * 100;

        // ── Dominant faction influences policy ──
        var dominant = factions[0];
        for (var d = 1; d < factions.length; d++) {
            if (factions[d].support > dominant.support) dominant = factions[d];
        }
        // Small nudge toward dominant faction's bias
        faction.warHawk = Math.max(0, Math.min(100, faction.warHawk + dominant.warBias * 0.02));
        faction.diplomacy = Math.max(0, Math.min(100, faction.diplomacy + dominant.diploBias * 0.02));

        // ── Unity drift ──
        // Support spread — more even = more divided
        var maxSupport = 0, minSupport = 100;
        for (var u = 0; u < factions.length; u++) {
            if (factions[u].support > maxSupport) maxSupport = factions[u].support;
            if (factions[u].support < minSupport) minSupport = factions[u].support;
        }
        var spread = maxSupport - minSupport;
        if (spread < 15) {
            // Very even — unity drops (deadlock)
            pol.unity = Math.max(5, pol.unity - 0.3);
        } else if (spread > 40) {
            // Clear mandate — unity rises
            pol.unity = Math.min(95, pol.unity + 0.2);
        }

        // Earth is inherently more divided (larger population, more diverse views)
        if (isEarth) {
            pol.unity = Math.max(5, pol.unity - 0.1);
        }

        // ── Unity effects on faction performance ──
        var unityMod = pol.unity / 100;
        // Low unity slows ship building (applied via efficiency multiplier)
        faction._buildEfficiency = 0.5 + unityMod * 0.5; // 50-100% build speed

        // ── Coup risk ──
        pol.coupRisk = Math.max(0, 100 - pol.unity - faction.economy * 0.3);
        if (isEarth) pol.coupRisk += 5; // Earth is more prone to upheaval

        // ── Trigger new crisis ──
        if (!pol.crisisActive) {
            pol.crisisTimer++;
            // Crisis chance: higher when unity is low
            var crisisChance = (100 - pol.unity) / 500; // 0-0.2 per check
            if (isEarth) crisisChance *= 1.5; // Earth has more frequent crises
            // Minimum time between crises
            if (pol.crisisTimer > 3 && Math.random() < crisisChance) {
                _triggerCrisis(factionId);
                pol.crisisTimer = 0;
            }
        }
    }

    function _triggerCrisis(factionId) {
        var faction = _factions[factionId];
        if (!faction || !faction.politics) return;
        var isEarth = factionId === Config.FACTION.EARTH;

        // Filter valid crises
        var validCrises = [];
        for (var i = 0; i < CRISIS_TYPES.length; i++) {
            var c = CRISIS_TYPES[i];
            if (c.earthOnly && !isEarth) continue;
            if (c.marsOnly && isEarth) continue;
            validCrises.push(c);
        }
        if (validCrises.length === 0) return;

        var crisis = validCrises[Math.floor(Math.random() * validCrises.length)];

        // Apply immediate effects
        for (var key in crisis.effects) {
            if (key === 'unity') {
                faction.politics.unity = Math.max(5, Math.min(95, faction.politics.unity + crisis.effects[key]));
            } else if (faction.hasOwnProperty(key)) {
                faction[key] = Math.max(key === 'economy' ? 10 : key === 'militaryPower' ? 5 : 0,
                    Math.min(100, faction[key] + crisis.effects[key]));
            }
        }

        faction.politics.crisisActive = {
            id: crisis.id,
            name: crisis.name,
            desc: crisis.desc,
            remaining: crisis.duration,
            totalDuration: crisis.duration,
            effects: crisis.effects
        };

        Events.emit('political_crisis', {
            faction: factionId,
            factionName: faction.name,
            crisis: crisis.id,
            name: crisis.name,
            desc: crisis.desc,
            effects: crisis.effects
        });
    }

    function getPolitics(factionId) {
        var f = _factions[factionId];
        if (!f || !f.politics) return null;
        return f.politics;
    }

    // ── Fleet Attack Missions ────────────────────────────────
    function _tickFleetAttacks() {
        _fleetAttackTimer++;
        if (_fleetAttackTimer < FLEET_ATTACK_INTERVAL) return;
        _fleetAttackTimer = 0;

        var factionIds = [Config.FACTION.EARTH, Config.FACTION.MARS];
        for (var fi = 0; fi < factionIds.length; fi++) {
            var fid = factionIds[fi];
            var faction = _factions[fid];
            if (!faction || !faction.atWar) continue;

            // Chance scales with warHawk
            var chance = (faction.warHawk || 30) / 200;
            if (Math.random() > chance) continue;

            // Pick a target
            var enemyId = (fid === Config.FACTION.EARTH) ? 'mars' : 'earth';
            var enemyLoc = World.getLocation(enemyId);
            if (!enemyLoc) continue;

            var targetX = enemyLoc.x;
            var targetY = enemyLoc.y;
            var targetName = enemyLoc.name || enemyId;

            // Sometimes target a contested station instead
            var locs = World.getLocations ? World.getLocations() : [];
            var contested = [];
            for (var li = 0; li < locs.length; li++) {
                var loc = locs[li];
                if (loc.influence && loc.dockable) {
                    var myInf = (fid === Config.FACTION.EARTH) ? loc.influence.earth : loc.influence.mars;
                    var enemyInf = (fid === Config.FACTION.EARTH) ? loc.influence.mars : loc.influence.earth;
                    if (enemyInf > 30 && myInf < 70) {
                        contested.push(loc);
                    }
                }
            }
            if (contested.length > 0 && Math.random() < 0.4) {
                var cTarget = contested[Math.floor(Math.random() * contested.length)];
                targetX = cTarget.x;
                targetY = cTarget.y;
                targetName = cTarget.name || 'contested station';
            }

            // Gather eligible ships
            var npcs = World.getNPCs();
            var eligible = [];
            for (var ni = 0; ni < npcs.length; ni++) {
                var npc = npcs[ni];
                if (npc.dead || npc.fleetMission) continue;
                if (npc.faction !== fid) continue;
                if (npc.behavior !== 'battle' && npc.behavior !== 'patrol') continue;
                eligible.push(npc);
            }

            if (eligible.length < FLEET_ATTACK_MIN_SHIPS) continue;

            // Pick 5-12 ships
            var fleetSize = Math.min(eligible.length, 5 + Math.floor(Math.random() * 8));
            // Prefer battle ships
            eligible.sort(function (a, b) {
                return (b.behavior === 'battle' ? 1 : 0) - (a.behavior === 'battle' ? 1 : 0);
            });

            var attackId = 'fleet_' + fid + '_' + (++_fleetAttackIdCounter);
            var shipIds = [];
            for (var si = 0; si < fleetSize; si++) {
                eligible[si].fleetMission = attackId;
                shipIds.push(eligible[si].id);
            }

            var missionObj = {
                id: attackId,
                faction: fid,
                targetX: targetX,
                targetY: targetY,
                targetName: targetName,
                shipIds: shipIds,
                launched: _fleetAttackTimer,
                attackTimer: 0,
                attackDuration: 300 + Math.floor(Math.random() * 300),
                state: 'assembling'
            };
            _fleetAttacks.push(missionObj);

            var fName = faction.name || fid;
            Events.emit('fleet_attack_launched', {
                faction: fid,
                factionName: fName,
                targetName: targetName,
                shipCount: fleetSize
            });
        }
    }

    function _tickFleetMissions() {
        var npcs = World.getNPCs();
        for (var mi = _fleetAttacks.length - 1; mi >= 0; mi--) {
            var mission = _fleetAttacks[mi];

            // Count surviving ships
            var alive = 0;
            var arrived = 0;
            for (var si = 0; si < mission.shipIds.length; si++) {
                var found = false;
                for (var ni = 0; ni < npcs.length; ni++) {
                    if (npcs[ni].id === mission.shipIds[si] && !npcs[ni].dead) {
                        found = true;
                        var sdx = mission.targetX - npcs[ni].x;
                        var sdy = mission.targetY - npcs[ni].y;
                        if (Math.sqrt(sdx * sdx + sdy * sdy) < 500) {
                            arrived++;
                        }
                        break;
                    }
                }
                if (found) alive++;
            }

            // Check if fleet decimated (more than half killed)
            if (alive <= Math.floor(mission.shipIds.length / 2)) {
                _endFleetMission(mission, npcs, 'decimated');
                _fleetAttacks.splice(mi, 1);
                continue;
            }

            if (mission.state === 'assembling') {
                // Transition to attacking when enough ships arrive
                if (arrived >= Math.ceil(alive * 0.5)) {
                    mission.state = 'attacking';
                    mission.attackTimer = 0;
                }
            } else if (mission.state === 'attacking') {
                mission.attackTimer++;
                if (mission.attackTimer >= mission.attackDuration) {
                    _endFleetMission(mission, npcs, 'completed');
                    _fleetAttacks.splice(mi, 1);
                    continue;
                }
            }
        }
    }

    function _endFleetMission(mission, npcs, reason) {
        // Clear fleet mission from all surviving ships
        for (var si = 0; si < mission.shipIds.length; si++) {
            for (var ni = 0; ni < npcs.length; ni++) {
                if (npcs[ni].id === mission.shipIds[si]) {
                    npcs[ni].fleetMission = null;
                    break;
                }
            }
        }

        var faction = _factions[mission.faction];
        var fName = faction ? faction.name : mission.faction;
        var msg;
        if (reason === 'decimated') {
            msg = fName + ' fleet attack on ' + mission.targetName + ' was repelled!';
        } else {
            msg = fName + ' fleet completed assault on ' + mission.targetName + '.';
        }
        Events.emit('fleet_attack_result', { faction: mission.faction, message: msg, reason: reason });
    }

    function getFleetAttack(id) {
        for (var i = 0; i < _fleetAttacks.length; i++) {
            if (_fleetAttacks[i].id === id) return _fleetAttacks[i];
        }
        return null;
    }

    function getFleetAttacks() {
        return _fleetAttacks;
    }

    function tick() {
        // Earth tries to influence Moon, Mars tries to influence Ares Station
        var luna = World.getLocation('luna');
        var marsOrb = World.getLocation('mars_orbital');

        if (luna) {
            luna.influence.earth += 0.005;
            if (luna.influence.earth - luna.influence.mars > 30) {
                setLeaning(Config.FACTION.MOON, 'earth');
            } else if (luna.influence.mars - luna.influence.earth > 30) {
                setLeaning(Config.FACTION.MOON, 'mars');
            } else {
                setLeaning(Config.FACTION.MOON, 'neutral');
            }
        }

        if (marsOrb) {
            marsOrb.influence.mars += 0.005;
            if (marsOrb.influence.mars - marsOrb.influence.earth > 25) {
                setLeaning(Config.FACTION.MARS_STATION, 'mars');
            } else if (marsOrb.influence.earth - marsOrb.influence.mars > 25) {
                setLeaning(Config.FACTION.MARS_STATION, 'earth');
            } else {
                setLeaning(Config.FACTION.MARS_STATION, 'neutral');
            }
        }

        // Strategy AI evaluation
        _strategyEvalTimer++;
        if (_strategyEvalTimer >= STRATEGY_EVAL_INTERVAL) {
            _strategyEvalTimer = 0;
            _evaluateStrategies();

            // War attrition: factions at war lose military power over time
            var earth = _factions[Config.FACTION.EARTH];
            var mars = _factions[Config.FACTION.MARS];
            if (earth && mars && earth.atWar && mars.atWar) {
                // Each side loses based on how aggressive the other is
                var earthLoss = (mars.warHawk / 100) * 2 * (0.8 + Math.random() * 0.4);
                var marsLoss = (earth.warHawk / 100) * 2 * (0.8 + Math.random() * 0.4);
                earth.militaryPower = Math.max(10, earth.militaryPower - earthLoss);
                mars.militaryPower = Math.max(10, mars.militaryPower - marsLoss);
                // Economy also suffers from war
                earth.economy = Math.max(20, earth.economy - 0.2);
                mars.economy = Math.max(20, mars.economy - 0.2);
            }
        }

        // Faction ship building
        _tickBuild();

        // Internal politics
        _tickPolitics();

        // Fleet attack missions
        _tickFleetAttacks();
        _tickFleetMissions();
    }

    function serialize() {
        return {
            factions: JSON.parse(JSON.stringify(_factions)),
            playerRep: JSON.parse(JSON.stringify(_playerRep)),
            strategyEvalTimer: _strategyEvalTimer,
            buildTimers: JSON.parse(JSON.stringify(_buildTimers)),
            buildCheckTimer: _buildCheckTimer,
            fleetAttacks: JSON.parse(JSON.stringify(_fleetAttacks)),
            fleetAttackTimer: _fleetAttackTimer,
            fleetAttackIdCounter: _fleetAttackIdCounter
        };
    }

    function deserialize(data) {
        if (!data) return;
        if (data.factions) _factions = data.factions;
        if (data.playerRep) _playerRep = data.playerRep;
        _strategyEvalTimer = data.strategyEvalTimer || 0;
        _buildCheckTimer = data.buildCheckTimer || 0;
        // Restore fleet attack state
        _fleetAttacks = data.fleetAttacks || [];
        _fleetAttackTimer = data.fleetAttackTimer || 0;
        _fleetAttackIdCounter = data.fleetAttackIdCounter || 0;
        // Restore build timers
        if (data.buildTimers) {
            _buildTimers = data.buildTimers;
        } else {
            _buildTimers[Config.FACTION.EARTH] = { building: null, timer: 0, queue: [], shipsBuilt: [] };
            _buildTimers[Config.FACTION.MARS] = { building: null, timer: 0, queue: [], shipsBuilt: [] };
        }
        // Ensure build timers have all needed fields
        var btIds = [Config.FACTION.EARTH, Config.FACTION.MARS];
        for (var b = 0; b < btIds.length; b++) {
            var bt = _buildTimers[btIds[b]];
            if (!bt) {
                _buildTimers[btIds[b]] = { building: null, timer: 0, queue: [], shipsBuilt: [] };
            } else {
                if (!bt.shipsBuilt) bt.shipsBuilt = [];
                if (!bt.queue) bt.queue = [];
            }
        }
        // Ensure strategies exist for loaded factions
        var earth = _factions[Config.FACTION.EARTH];
        if (earth && (!earth.activeStrategies || earth.activeStrategies.length === 0)) {
            earth.warHawk = earth.warHawk || 30;
            earth.diplomacy = earth.diplomacy || 70;
            _selectStrategies(Config.FACTION.EARTH);
        }
        var mars = _factions[Config.FACTION.MARS];
        if (mars && (!mars.activeStrategies || mars.activeStrategies.length === 0)) {
            mars.warHawk = mars.warHawk || 65;
            mars.diplomacy = mars.diplomacy || 35;
            _selectStrategies(Config.FACTION.MARS);
        }
    }

    return {
        init: init,
        getFaction: getFaction,
        getAllFactions: getAllFactions,
        getRep: getRep,
        changeRep: changeRep,
        getStanding: getStanding,
        isHostile: isHostile,
        getLeaning: getLeaning,
        setLeaning: setLeaning,
        getActiveStrategies: getActiveStrategies,
        getStrategyMissionTypes: getStrategyMissionTypes,
        getPolitics: getPolitics,
        getBuildState: getBuildState,
        getFleetAttack: getFleetAttack,
        getFleetAttacks: getFleetAttacks,
        tick: tick,
        serialize: serialize,
        deserialize: deserialize
    };
})();
