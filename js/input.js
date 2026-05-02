/* ============================================================
 * Solar Dominion — Input Handler
 * Tracks keyboard + mouse state for the game loop to read.
 * ============================================================ */
var Input = (function () {
    'use strict';

    var _keys = {};
    var _justPressed = {};
    var _mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, clicked: false, rightClicked: false };
    var _canvas = null;
    var _zoomLevel = 1.0;  // 1.0 = default (furthest out), higher = zoomed in
    var _minZoom = 1.0;
    var _maxZoom = 4.0;

    function init(canvas) {
        _canvas = canvas;
        window.addEventListener('keydown', _onKeyDown);
        window.addEventListener('keyup', _onKeyUp);
        canvas.addEventListener('mousemove', _onMouseMove);
        canvas.addEventListener('mousedown', _onMouseDown);
        canvas.addEventListener('mouseup', _onMouseUp);
        canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        canvas.addEventListener('wheel', _onWheel, { passive: false });
    }

    function _onKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (!_keys[e.code]) _justPressed[e.code] = true;
        _keys[e.code] = true;
    }

    function _onKeyUp(e) {
        _keys[e.code] = false;
    }

    function _onMouseMove(e) {
        if (!_canvas) return;
        var rect = _canvas.getBoundingClientRect();
        _mouse.x = e.clientX - rect.left;
        _mouse.y = e.clientY - rect.top;
    }

    function _onMouseDown(e) {
        if (e.button === 0) { _mouse.down = true; _mouse.clicked = true; }
        if (e.button === 2) _mouse.rightClicked = true;
    }

    function _onMouseUp(e) {
        if (e.button === 0) _mouse.down = false;
    }

    function _onWheel(e) {
        e.preventDefault();
        var delta = e.deltaY > 0 ? -0.15 : 0.15;
        _zoomLevel = Math.max(_minZoom, Math.min(_maxZoom, _zoomLevel + delta));
    }

    function getZoom() { return _zoomLevel; }
    function setZoom(z) { _zoomLevel = Math.max(_minZoom, Math.min(_maxZoom, z)); }

    function isDown(action) {
        var bindings = Config.KEYS[action];
        if (!bindings) return false;
        for (var i = 0; i < bindings.length; i++) {
            if (_keys[bindings[i]]) return true;
        }
        return false;
    }

    function justPressed(action) {
        var bindings = Config.KEYS[action];
        if (!bindings) return false;
        for (var i = 0; i < bindings.length; i++) {
            if (_justPressed[bindings[i]]) return true;
        }
        return false;
    }

    function getMouse() { return _mouse; }

    function endFrame() {
        // Don't clear justPressed here — it's consumed by the sim tick
        _mouse.clicked = false;
        _mouse.rightClicked = false;
    }

    function consumeJustPressed() {
        _justPressed = {};
    }

    function updateWorldMouse(camX, camY) {
        var zoom = _zoomLevel;
        _mouse.worldX = camX + _mouse.x / zoom;
        _mouse.worldY = camY + _mouse.y / zoom;
    }

    return {
        init: init,
        isDown: isDown,
        justPressed: justPressed,
        getMouse: getMouse,
        getZoom: getZoom,
        setZoom: setZoom,
        endFrame: endFrame,
        consumeJustPressed: consumeJustPressed,
        updateWorldMouse: updateWorldMouse
    };
})();
