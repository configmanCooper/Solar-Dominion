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
    var _playerPath = 'none';   // 'none', 'peace', 'war_earth', 'war_mars'
    var _peaceTalkProgress = 0; // 0-100 progress toward peace
    var _warProgress = 0;       // 0-100 progress toward war victory

    function init() {
        _peaceTalks = [];
        _agreements = [];
        _neutralZones = [];
        _warCampaigns = 0;
        _playerPath = 'none';
        _peaceTalkProgress = 0;
        _warProgress = 0;
    }

    function getPath() { return _playerPath; }
    function getPeaceProgress() { return _peaceTalkProgress; }
    function getWarProgress() { return _warProgress; }
    function getNeutralZones() { return _neutralZones; }
    function getAgreements() { return _agreements; }
    function getWarCampaigns() { return _warCampaigns; }

    function choosePath(path) {
        if (_playerPath !== 'none') return false;
        if (['peace', 'war_earth', 'war_mars'].indexOf(path) === -1) return false;
        _playerPath = path;
        Events.emit('path_chosen', { path: path });

        // Rep consequences for choosing war
        if (path === 'war_earth') {
            Factions.changeRep(Config.FACTION.EARTH, 15);
            Factions.changeRep(Config.FACTION.MARS, -20);
        } else if (path === 'war_mars') {
            Factions.changeRep(Config.FACTION.MARS, 15);
            Factions.changeRep(Config.FACTION.EARTH, -20);
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

    function checkVictory() {
        if (_playerPath === 'peace' && _peaceTalkProgress >= 100) {
            return { victory: true, type: 'peace' };
        }
        if ((_playerPath === 'war_earth' || _playerPath === 'war_mars') && _warProgress >= 100) {
            return { victory: true, type: _playerPath };
        }
        return { victory: false };
    }

    function tick() {
        _updatePeaceProgress();
        _updateWarProgress();

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
            warProgress: _warProgress
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
    }

    return {
        init: init,
        getPath: getPath,
        getPeaceProgress: getPeaceProgress,
        getWarProgress: getWarProgress,
        getNeutralZones: getNeutralZones,
        getAgreements: getAgreements,
        getWarCampaigns: getWarCampaigns,
        choosePath: choosePath,
        establishNeutralZone: establishNeutralZone,
        initiatePeaceTalk: initiatePeaceTalk,
        advancePeaceTalk: advancePeaceTalk,
        completeWarCampaign: completeWarCampaign,
        influenceLocation: influenceLocation,
        checkVictory: checkVictory,
        tick: tick,
        serialize: serialize,
        deserialize: deserialize
    };
})();
