/* ============================================================
 * Solar Dominion — Stations Module
 * Player station building and management.
 * ============================================================ */
var Stations = (function () {
    'use strict';

    function init() {
        // Station data lives in World locations; this module provides
        // build/manage helpers
    }

    function canBuild() {
        return true; // player can always attempt
    }

    function buildStation(name, type, x, y) {
        var stType = Config.STATION_TYPES[type];
        if (!stType) return { success: false, reason: 'Invalid station type' };

        if (!Economy.canAfford(stType.cost)) {
            return { success: false, reason: 'Not enough resources', cost: stType.cost };
        }

        // Check minimum distance from other locations
        var locs = World.getLocations();
        for (var i = 0; i < locs.length; i++) {
            var dx = locs[i].x - x, dy = locs[i].y - y;
            if (Math.sqrt(dx * dx + dy * dy) < 200) {
                return { success: false, reason: 'Too close to ' + locs[i].name };
            }
        }

        Economy.payCosts(stType.cost);
        var loc = World.addPlayerStation(name, type, x, y);
        Events.emit('station_construction_started', { location: loc });
        return { success: true, location: loc };
    }

    function getPlayerStations() {
        return World.getLocations().filter(function (l) { return l.isPlayerBuilt; });
    }

    function serialize() { return {}; } // state is in World
    function deserialize() {}

    return {
        init: init,
        canBuild: canBuild,
        buildStation: buildStation,
        getPlayerStations: getPlayerStations,
        serialize: serialize,
        deserialize: deserialize
    };
})();
