/* ============================================================
 * Solar Dominion — Main
 * Game initialization, state machine (title/playing/gameover),
 * main loop, and autosave scheduling.
 * ============================================================ */
var Main = (function () {
    'use strict';

    var _state = 'title';   // title, playing, gameover
    var _simInterval = null;
    var _renderRAF = null;
    var _autosaveInterval = null;
    var _uiTickCounter = 0;
    var _tickAccumulator = 0;

    function init() {
        Render.init();
        Input.init(Render.getCanvas());
        UI.init();

        // Title screen buttons
        document.getElementById('btnNewGame').addEventListener('click', _newGame);
        document.getElementById('btnLoadGame').addEventListener('click', _loadGame);
        document.getElementById('btnContinue').addEventListener('click', _continueGame);

        // Check for autosave
        if (Save.hasAutosave()) {
            document.getElementById('btnContinue').style.display = 'inline-block';
        }

        // Save buttons
        document.getElementById('btnSave').addEventListener('click', function () {
            if (Save.save('slot_1')) {
                UI.showToast('Game saved!', 'success');
            } else {
                UI.showToast('Save failed!', 'warning');
            }
        });

        // Game over — new game or load save
        window.addEventListener('keydown', function (e) {
            if (Engine.isGameOver() && !Diplomacy.checkVictory().victory) {
                if (e.code === 'KeyN') {
                    _newGame();
                } else if (e.code === 'KeyL') {
                    var saved = Save.load('slot_1');
                    if (saved) {
                        document.getElementById('titleScreen').style.display = 'none';
                        document.getElementById('gameContainer').style.display = 'block';
                        Events.clear();
                        Engine.init();
                        UI.wireEvents();
                        Save.load('slot_1');
                        _state = 'playing';
                        _startLoops();
                    }
                }
            }
        });
    }

    function _newGame() {
        document.getElementById('titleScreen').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';

        Events.clear();
        Engine.init();
        UI.wireEvents();
        _state = 'playing';
        _startLoops();

        // Show intro story
        var intro = Story.showIntro();
        if (intro) {
            Events.emit('story_chapter', { title: intro.title, text: intro.text });
        }

        // Auto-open dock panel since player starts docked
        Events.emit('ship_docked', { locationId: 'luna' });
    }

    function _loadGame() {
        Events.clear();
        Engine.init();
        UI.wireEvents();
        if (Save.load('slot_1')) {
            document.getElementById('titleScreen').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            _state = 'playing';
            _startLoops();
            UI.showToast('Game loaded!', 'success');
        } else {
            alert('No save found in slot 1.');
        }
    }

    function _continueGame() {
        // Re-init modules first so event wiring is done
        Events.clear();
        Engine.init();
        UI.wireEvents();
        if (Save.loadAutosave()) {
            document.getElementById('titleScreen').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            _state = 'playing';
            _startLoops();
            UI.showToast('Autosave loaded!', 'success');
        } else {
            alert('Autosave corrupted. Starting new game.');
            _newGame();
        }
    }

    function _startLoops() {
        if (_simInterval) clearInterval(_simInterval);
        if (_autosaveInterval) clearInterval(_autosaveInterval);
        if (_renderRAF) cancelAnimationFrame(_renderRAF);
        _tickAccumulator = 0;

        // Simulation tick with fractional accumulator
        _simInterval = setInterval(function () {
            // Check UI input every tick so key presses aren't missed
            UI.handleInput();

            _tickAccumulator += Engine.getGameSpeed();
            while (_tickAccumulator >= 1) {
                Engine.tick();
                _tickAccumulator -= 1;
            }
            _uiTickCounter++;
            if (_uiTickCounter >= Config.UI_UPDATE_TICKS) {
                _uiTickCounter = 0;
                // UI panel content refresh (not input) could go here
            }
            // Clear justPressed after sim has consumed it
            Input.consumeJustPressed();
        }, Config.TICK_RATE);

        // Render loop
        function renderLoop() {
            Render.render();
            Input.endFrame();
            _renderRAF = requestAnimationFrame(renderLoop);
        }
        _renderRAF = requestAnimationFrame(renderLoop);

        // Autosave
        _autosaveInterval = setInterval(function () {
            if (_state === 'playing' && !Engine.isPaused()) {
                if (!Save.autosave()) {
                    UI.showToast('Autosave failed — storage may be full', 'warning');
                }
            }
        }, Config.AUTOSAVE_INTERVAL);
    }

    // Start everything when DOM is ready
    document.addEventListener('DOMContentLoaded', init);

    return { init: init };
})();
