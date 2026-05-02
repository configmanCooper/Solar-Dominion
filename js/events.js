/* ============================================================
 * Solar Dominion — Event Bus
 * Decoupled communication between modules.
 * Events are for notifications only; state mutations stay in
 * the owning module.
 * ============================================================ */
var Events = (function () {
    'use strict';

    var _listeners = {};

    function on(event, callback) {
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(callback);
    }

    function off(event, callback) {
        if (!_listeners[event]) return;
        _listeners[event] = _listeners[event].filter(function (cb) { return cb !== callback; });
    }

    function emit(event, data) {
        if (!_listeners[event]) return;
        for (var i = 0; i < _listeners[event].length; i++) {
            try {
                _listeners[event][i](data);
            } catch (e) {
                console.error('[Events] Error in listener for "' + event + '":', e);
            }
        }
    }

    function clear() {
        _listeners = {};
    }

    return { on: on, off: off, emit: emit, clear: clear };
})();
