/* ============================================================
 * Solar Dominion — Diplomacy Module
 * Peace talks, influence campaigns, agreements, and neutral
 * zone management.  Shares state with Factions (reputation)
 * and World (location influence).
 * ============================================================ */
var Diplomacy = (function () {
    'use strict';

    var _peaceTalks = [];       // active peace negotiations
    var _agreements = [];       // signed agreements
    var _neutralZones = [];     // established neutral zones
    var _warCampaigns = 0;      // completed war campaign missions
    var _playerPath = 'none';   // 'none', 'peace', 'war_earth', 'war_mars', 'domination'
    var _peaceTalkProgress = 0; // 0-100 progress toward peace
    var _warProgress = 0;       // 0-100 progress toward war victory
    var _dominationProgress = 0; // 0-100 progress toward domination
    var _controlledStations = []; // station IDs under player control
    var _dominationDeclared = false; // has player revealed their intent?

    function init() {
        _peaceTalks = [];
        _agreements = [];
        _neutralZones = [];
        _warCampaigns = 0;
        _playerPath = 'none';
        _peaceTalkProgress = 0;
        _warProgress = 0;
        _dominationProgress = 0;
        _controlledStations = [];
        _dominationDeclared = false;
    }

    function getPath() { return _playerPath; }
    function getPeaceProgress() { return _peaceTalkProgress; }
    function getWarProgress() { return _warProgress; }
    function getDominationProgress() { return _dominationProgress; }
    function getNeutralZones() { return _neutralZones; }
    function getAgreements() { return _agreements; }
    function getWarCampaigns() { return _warCampaigns; }
    function getControlledStations() { return _controlledStations; }
    function isDominationDeclared() { return _dominationDeclared; }

    function choosePath(path) {
        if (_playerPath !== 'none') return false;
        if (['peace', 'war_earth', 'war_mars', 'domination'].indexOf(path) === -1) return false;
        _playerPath = path;
        Events.emit('path_chosen', { path: path });

        // Rep consequences for choosing war
        if (path === 'war_earth') {
            Factions.changeRep(Config.FACTION.EARTH, 15);
            Factions.changeRep(Config.FACTION.MARS, -20);
        } else if (path === 'war_mars') {
            Factions.changeRep(Config.FACTION.MARS, 15);
            Factions.changeRep(Config.FACTION.EARTH, -20);
        } else if (path === 'domination') {
            // Initially no rep change — player is covert
            // Declaring domination later triggers hostility
        }
        return true;
    }

    function establishNeutralZone(locationId) {
        if (_playerPath !== 'peace') return { success: false, reason: 'Must be on peace path' };
        if (_neutralZones.indexOf(locationId) !== -1) return { success: false, reason: 'Already neutral zone' };

        var loc = World.getLocation(locationId);
        if (!loc) return { success: false, reason: 'Location not found' };

        // Need good rep with both sides
        var earthRep = Factions.getRep(Config.FACTION.EARTH);
        var marsRep = Factions.getRep(Config.FACTION.MARS);
        if (earthRep < 20 || marsRep < 20) {
            return { success: false, reason: 'Need 20+ reputation with both factions' };
        }

        // Costs credits
        if (!Economy.spendCredits(5000)) return { success: false, reason: 'Need 5,000 credits' };

        _neutralZones.push(locationId);
        loc.influence.earth = 0;
        loc.influence.mars = 0;
        _updatePeaceProgress();
        Events.emit('neutral_zone_established', { locationId: locationId });
        return { success: true };
    }

    function initiatePeaceTalk(locationId) {
        if (_playerPath !== 'peace') return { success: false, reason: 'Must be on peace path' };

        var earthRep = Factions.getRep(Config.FACTION.EARTH);
        var marsRep = Factions.getRep(Config.FACTION.MARS);
        if (earthRep < Config.DIPLOMACY.PEACE_TALK_REP_REQUIRED || marsRep < Config.DIPLOMACY.PEACE_TALK_REP_REQUIRED) {
            return { success: false, reason: 'Need ' + Config.DIPLOMACY.PEACE_TALK_REP_REQUIRED + '+ rep with both factions' };
        }

        if (_neutralZones.length < Config.DIPLOMACY.PEACE_ZONES_REQUIRED) {
            return { success: false, reason: 'Need ' + Config.DIPLOMACY.PEACE_ZONES_REQUIRED + ' neutral zones first' };
        }

        _peaceTalks.push({
            locationId: locationId,
            started: Date.now(),
            progress: 0,
            stage: 'initial'  // initial -> negotiation -> agreement -> signed
        });
        Events.emit('peace_talk_started', { locationId: locationId });
        return { success: true };
    }

    function advancePeaceTalk(talkIndex) {
        if (talkIndex >= _peaceTalks.length) return false;
        var talk = _peaceTalks[talkIndex];
        talk.progress += 10;
        if (talk.progress >= 100) {
            if (talk.stage === 'initial') {
                talk.stage = 'negotiation'; talk.progress = 0;
            } else if (talk.stage === 'negotiation') {
                talk.stage = 'agreement'; talk.progress = 0;
            } else if (talk.stage === 'agreement') {
                talk.stage = 'signed';
                _agreements.push({
                    type: 'peace_accord',
                    locationId: talk.locationId,
                    signed: Date.now()
                });
                _updatePeaceProgress();
                Events.emit('agreement_signed', { talk: talk });
            }
        }
        return true;
    }

    function completeWarCampaign() {
        _warCampaigns++;
        _updateWarProgress();
        Events.emit('war_campaign_completed', { total: _warCampaigns });
    }

    function influenceLocation(locationId, side, amount) {
        var loc = World.getLocation(locationId);
        if (!loc) return false;
        if (_neutralZones.indexOf(locationId) !== -1) return false; // protected neutral zone
        loc.influence[side] = (loc.influence[side] || 0) + amount;
        return true;
    }

    function _updatePeaceProgress() {
        var progress = 0;
        // Neutral zones (30% of progress)
        progress += Math.min(30, (_neutralZones.length / Config.DIPLOMACY.PEACE_ZONES_REQUIRED) * 30);
        // Moon neutral (15%)
        if (Factions.getLeaning(Config.FACTION.MOON) === 'neutral') progress += 15;
        // Mars station neutral (15%)
        if (Factions.getLeaning(Config.FACTION.MARS_STATION) === 'neutral') progress += 15;
        // Agreements (40%)
        progress += Math.min(40, _agreements.length * 20);
        _peaceTalkProgress = Math.min(100, progress);
    }

    function _updateWarProgress() {
        var progress = 0;
        var allySide = _playerPath === 'war_earth' ? 'earth' : 'mars';
        // Campaigns (45%)
        progress += Math.min(45, (_warCampaigns / Config.DIPLOMACY.WAR_CAMPAIGNS_REQUIRED) * 45);
        // Moon on your side (15%)
        if (Factions.getLeaning(Config.FACTION.MOON) === allySide) progress += 15;
        // Mars station on your side (15%)
        if (Factions.getLeaning(Config.FACTION.MARS_STATION) === allySide) progress += 15;
        // Military strength (25%) — using configured fleet requirement
        var fleetSize = Fleet.getShipCount();
        progress += Math.min(25, (fleetSize / Config.FLEET.WAR_FLEET_REQUIREMENT) * 25);
        _warProgress = Math.min(100, progress);
    }

    // ── Domination Path ─────────────────────────────────────

    // Flip a neutral/independent station to player control
    function flipStation(locationId) {
        if (_playerPath !== 'domination') return { success: false, reason: 'Must be on domination path' };
        if (_controlledStations.indexOf(locationId) !== -1) return { success: false, reason: 'Already controlled' };

        var loc = World.getLocation(locationId);
        if (!loc) return { success: false, reason: 'Location not found' };

        // Cannot directly flip Earth or Mars homeworlds
        if (locationId === 'earth' || locationId === 'mars') {
            return { success: false, reason: 'Cannot flip a homeworld — must conquer through military might' };
        }

        // Check faction rep for the station's faction
        var stationFaction = loc.faction;
        var repNeeded = Config.DIPLOMACY.DOMINATION_REP_REQUIRED;

        // Need good rep with the station's faction
        if (stationFaction === Config.FACTION.MOON || stationFaction === Config.FACTION.MARS_STATION) {
            var rep = Factions.getRep(stationFaction);
            if (rep < repNeeded) return { success: false, reason: 'Need ' + repNeeded + '+ reputation with ' + (Factions.getFaction(stationFaction) || {}).name };
        } else if (stationFaction === Config.FACTION.INDEPENDENT) {
            var indRep = Factions.getRep(Config.FACTION.INDEPENDENT);
            if (indRep < repNeeded - 10) return { success: false, reason: 'Need ' + (repNeeded - 10) + '+ reputation with Independents' };
        }

        // Fleet requirement — need ships as show of force
        if (Fleet.getShipCount() < 3) return { success: false, reason: 'Need at least 3 fleet ships as show of force' };

        // Costs credits
        var cost = Config.DIPLOMACY.DOMINATION_CREDITS_TO_FLIP;
        if (!Economy.spendCredits(cost)) return { success: false, reason: 'Need ' + cost.toLocaleString() + ' credits' };

        _controlledStations.push(locationId);

        // Change station faction to player
        loc.faction = Config.FACTION.PLAYER;
        loc.influence = { earth: 0, mars: 0, player: 100 };

        _updateDominationProgress();
        Events.emit('station_flipped', { locationId: locationId, stationName: loc.name });
        return { success: true };
    }

    // Declare domination — go public, both sides become hostile
    function declareDomination() {
        if (_playerPath !== 'domination') return { success: false, reason: 'Not on domination path' };
        if (_dominationDeclared) return { success: false, reason: 'Already declared' };
        if (_controlledStations.length < 2) return { success: false, reason: 'Control at least 2 stations first' };
        if (Fleet.getShipCount() < Config.DIPLOMACY.DOMINATION_FLEET_REQUIRED) {
            return { success: false, reason: 'Need ' + Config.DIPLOMACY.DOMINATION_FLEET_REQUIRED + ' fleet ships' };
        }

        _dominationDeclared = true;

        // Both major factions become hostile
        Factions.changeRep(Config.FACTION.EARTH, -200); // force to min
        Factions.changeRep(Config.FACTION.MARS, -200);

        // Both factions become more aggressive
        var earth = Factions.getFaction(Config.FACTION.EARTH);
        var mars = Factions.getFaction(Config.FACTION.MARS);
        if (earth) { earth.warHawk = Math.min(100, earth.warHawk + 30); }
        if (mars) { mars.warHawk = Math.min(100, mars.warHawk + 30); }

        _updateDominationProgress();
        Events.emit('domination_declared', {});
        Events.emit('story_chapter', {
            index: 99,
            title: 'The Solar Dominion Rises',
            text: 'You\'ve declared your independence from both Earth and Mars. Your controlled stations form the backbone of a new power — the Solar Dominion. Both factions now see you as a threat to be eliminated.\n\nYou must weaken both Earth and Mars militarily while protecting your stations. Conquer or ally every location in the system to achieve total dominion.\n\nThis will be the hardest fight of your life.'
        });
        return { success: true };
    }

    // Subjugate a major faction (Earth/Mars) — requires weakening them enough
    function subjugateFaction(factionId) {
        if (_playerPath !== 'domination') return { success: false, reason: 'Not on domination path' };
        if (!_dominationDeclared) return { success: false, reason: 'Must declare domination first' };
        if (factionId !== Config.FACTION.EARTH && factionId !== Config.FACTION.MARS) {
            return { success: false, reason: 'Can only subjugate Earth or Mars' };
        }

        var faction = Factions.getFaction(factionId);
        if (!faction) return { success: false, reason: 'Faction not found' };

        // Need to weaken their military significantly
        var playerFleet = Fleet.getShipCount();
        var milThreshold = Config.DIPLOMACY.DOMINATION_MILITARY_THRESHOLD || 30;
        if (faction.militaryPower > milThreshold) {
            return { success: false, reason: faction.name + ' is still too strong (military: ' + Math.round(faction.militaryPower) + ', need ≤' + milThreshold + ')' };
        }
        if (playerFleet < Config.DIPLOMACY.DOMINATION_FLEET_REQUIRED) {
            return { success: false, reason: 'Need ' + Config.DIPLOMACY.DOMINATION_FLEET_REQUIRED + ' fleet ships' };
        }
        if (!Economy.spendCredits(50000)) return { success: false, reason: 'Need 50,000 credits for occupation' };

        // Mark homeworld as player controlled
        var homeLocId = factionId === Config.FACTION.EARTH ? 'earth' : 'mars';
        if (_controlledStations.indexOf(homeLocId) === -1) {
            _controlledStations.push(homeLocId);
        }
        var loc = World.getLocation(homeLocId);
        if (loc) {
            loc.faction = Config.FACTION.PLAYER;
            loc.influence = { earth: 0, mars: 0, player: 100 };
        }

        // Faction surrenders
        faction.militaryPower = 5;
        faction.atWar = false;

        _updateDominationProgress();
        Events.emit('faction_subjugated', { faction: factionId, name: faction.name });
        return { success: true };
    }

    function _updateDominationProgress() {
        if (_playerPath !== 'domination') { _dominationProgress = 0; return; }
        var progress = 0;

        // Count all dockable locations
        var allLocs = World.getLocations();
        var dockableIds = [];
        for (var i = 0; i < allLocs.length; i++) {
            if (allLocs[i].dockable) dockableIds.push(allLocs[i].id);
        }
        var totalDockable = dockableIds.length;
        if (totalDockable === 0) { _dominationProgress = 0; return; }

        // Controlled stations (70% of progress)
        var controlled = _controlledStations.length;
        progress += Math.min(70, (controlled / totalDockable) * 70);

        // Fleet strength (15%)
        var fleetSize = Fleet.getShipCount();
        progress += Math.min(15, (fleetSize / Config.DIPLOMACY.DOMINATION_FLEET_REQUIRED) * 15);

        // Domination declared bonus (15%)
        if (_dominationDeclared) progress += 15;

        _dominationProgress = Math.min(100, Math.round(progress));
    }

    function checkVictory() {
        if (_playerPath === 'peace' && _peaceTalkProgress >= 100) {
            return { victory: true, type: 'peace' };
        }
        if ((_playerPath === 'war_earth' || _playerPath === 'war_mars') && _warProgress >= 100) {
            return { victory: true, type: _playerPath };
        }
        if (_playerPath === 'domination' && _dominationProgress >= 100) {
            return { victory: true, type: 'domination' };
        }
        return { victory: false };
    }

    function tick() {
        _updatePeaceProgress();
        _updateWarProgress();
        _updateDominationProgress();

        // Auto-advance active peace talks each tick
        for (var i = 0; i < _peaceTalks.length; i++) {
            var talk = _peaceTalks[i];
            if (talk.stage === 'signed') continue;
            // Progress based on diplomatic reputation with both sides
            var earthRep = Factions.getRep(Config.FACTION.EARTH);
            var marsRep = Factions.getRep(Config.FACTION.MARS);
            var repBonus = Math.min(earthRep, marsRep) / 100; // 0-1
            var advanceRate = 0.3 + repBonus * 0.5; // 0.3 to 0.8 per tick
            talk.progress += advanceRate;
            if (talk.progress >= 100) {
                if (talk.stage === 'initial') {
                    talk.stage = 'negotiation'; talk.progress = 0;
                    Events.emit('peace_talk_advanced', { stage: 'negotiation' });
                } else if (talk.stage === 'negotiation') {
                    talk.stage = 'agreement'; talk.progress = 0;
                    Events.emit('peace_talk_advanced', { stage: 'agreement' });
                } else if (talk.stage === 'agreement') {
                    talk.stage = 'signed';
                    _agreements.push({
                        type: 'peace_accord',
                        locationId: talk.locationId,
                        signed: Date.now()
                    });
                    _updatePeaceProgress();
                    Events.emit('agreement_signed', { talk: talk });
                }
            }
        }
    }

    function serialize() {
        return {
            peaceTalks: JSON.parse(JSON.stringify(_peaceTalks)),
            agreements: _agreements.slice(),
            neutralZones: _neutralZones.slice(),
            warCampaigns: _warCampaigns,
            playerPath: _playerPath,
            peaceTalkProgress: _peaceTalkProgress,
            warProgress: _warProgress,
            dominationProgress: _dominationProgress,
            controlledStations: _controlledStations.slice(),
            dominationDeclared: _dominationDeclared
        };
    }

    function deserialize(data) {
        if (!data) return;
        _peaceTalks = data.peaceTalks || [];
        _agreements = data.agreements || [];
        _neutralZones = data.neutralZones || [];
        _warCampaigns = data.warCampaigns || 0;
        _playerPath = data.playerPath || 'none';
        _peaceTalkProgress = data.peaceTalkProgress || 0;
        _warProgress = data.warProgress || 0;
        _dominationProgress = data.dominationProgress || 0;
        _controlledStations = data.controlledStations || [];
        _dominationDeclared = data.dominationDeclared || false;

        // Reconcile flipped stations — restore location factions after load
        for (var i = 0; i < _controlledStations.length; i++) {
            var loc = World.getLocation(_controlledStations[i]);
            if (loc) {
                loc.faction = Config.FACTION.PLAYER;
                loc.influence = { earth: 0, mars: 0, player: 100 };
            }
        }
    }

    return {
        init: init,
        getPath: getPath,
        getPeaceProgress: getPeaceProgress,
        getWarProgress: getWarProgress,
        getDominationProgress: getDominationProgress,
        getNeutralZones: getNeutralZones,
        getAgreements: getAgreements,
        getWarCampaigns: getWarCampaigns,
        getControlledStations: getControlledStations,
        isDominationDeclared: isDominationDeclared,
        choosePath: choosePath,
        establishNeutralZone: establishNeutralZone,
        initiatePeaceTalk: initiatePeaceTalk,
        advancePeaceTalk: advancePeaceTalk,
        completeWarCampaign: completeWarCampaign,
        influenceLocation: influenceLocation,
        flipStation: flipStation,
        declareDomination: declareDomination,
        subjugateFaction: subjugateFaction,
        checkVictory: checkVictory,
        tick: tick,
        serialize: serialize,
        deserialize: deserialize
    };
})();
