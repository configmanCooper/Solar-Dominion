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
    var STRATEGY_EVAL_INTERVAL = 600; // evaluate every ~60 seconds

    function init() {
        _factions = {};
        _strategyEvalTimer = 0;

        _factions[Config.FACTION.EARTH] = {
            id: Config.FACTION.EARTH,
            name: 'Earth Alliance',
            description: 'Industrial powerhouse with conventional military might.',
            strengths: { shields: 1.2, shipCost: 0.8, crew: 1.3 },
            militaryPower: 80,
            economy: 90,
            atWar: true,
            enemy: Config.FACTION.MARS,
            // AI strategy system
            warHawk: 30,        // 0-100, how aggressive (Earth starts diplomatic)
            diplomacy: 70,      // 0-100, how diplomatic
            activeStrategies: [], // current active strategy IDs (up to 3)
            strategyScores: {},   // goalMetric → cumulative score
            strategyHistory: []   // past strategies for evaluation
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
            strategyHistory: []
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
        }
    }

    function serialize() {
        return {
            factions: JSON.parse(JSON.stringify(_factions)),
            playerRep: JSON.parse(JSON.stringify(_playerRep)),
            strategyEvalTimer: _strategyEvalTimer
        };
    }

    function deserialize(data) {
        if (!data) return;
        if (data.factions) _factions = data.factions;
        if (data.playerRep) _playerRep = data.playerRep;
        _strategyEvalTimer = data.strategyEvalTimer || 0;
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
        tick: tick,
        serialize: serialize,
        deserialize: deserialize
    };
})();
