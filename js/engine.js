/* ============================================================
 * Solar Dominion — Engine
 * Orchestrates simulation ticks in a defined order.
 * Owns no gameplay state directly — delegates to modules.
 *
 * Tick order:
 *   1. Ship (player input + physics)
 *   2. World (NPC AI, projectiles, station building)
 *   3. Combat (collision resolution, NPC targeting)
 *   4. Fleet (AI fleet movement + combat)
 *   5. Factions (influence drift)
 *   6. Economy (price drift, station income)
 *   7. Missions (objective checks)
 *   8. Diplomacy (progress updates)
 *   9. Story (chapter triggers, victory check)
 * ============================================================ */
var Engine = (function () {
    'use strict';

    var _tickCount = 0;
    var _paused = false;
    var _gameSpeed = 1;        // 1 = normal, 2 = fast, 0.5 = slow
    var _gameOver = false;

    function init() {
        _tickCount = 0;
        _paused = false;
        _gameSpeed = 1;
        _gameOver = false;

        World.init();
        Ship.init();
        Factions.init();
        Economy.init();
        Combat.init();
        Fleet.init();
        Missions.init();
        Diplomacy.init();
        Stations.init();
        Story.init();

        // Wire up cross-module events
        Events.on('npc_destroyed', function (data) {
            Missions.onEnemyDestroyed(data.npc.faction);
        });

        Events.on('player_destroyed', function () {
            _gameOver = true;
        });

        Events.on('victory', function (data) {
            _gameOver = true;
        });
    }

    function tick() {
        if (_paused || _gameOver) return;

        _tickCount++;

        // 1. Input handling
        Ship.handleInput();

        // 2. World (orbits must update before ship follows docked location)
        World.tick();

        // 3. Player ship (after world so docked position is current)
        Ship.tick();

        // 3. Combat
        Combat.tick();

        // 4. Fleet
        Fleet.tick();

        // 5. Factions (every 10 ticks to save CPU)
        if (_tickCount % 10 === 0) {
            Factions.tick();
        }

        // 6. Economy (every 10 ticks)
        if (_tickCount % 10 === 0) {
            Economy.tick();
            // Fleet upkeep
            var upkeep = Fleet.getUpkeepCost();
            if (upkeep > 0) Economy.spendCredits(upkeep);
        }

        // 7. Missions
        Missions.tick();

        // 8. Diplomacy (every 10 ticks)
        if (_tickCount % 10 === 0) {
            Diplomacy.tick();
        }

        // 9. Story (every 20 ticks)
        if (_tickCount % 20 === 0) {
            Story.tick();
        }
    }

    function isPaused() { return _paused; }
    function isGameOver() { return _gameOver; }
    function getTickCount() { return _tickCount; }
    function getGameSpeed() { return _gameSpeed; }

    function togglePause() {
        _paused = !_paused;
        Events.emit('pause_changed', { paused: _paused });
    }

    function setGameSpeed(speed) {
        _gameSpeed = Math.max(0.5, Math.min(3, speed));
        Events.emit('speed_changed', { speed: _gameSpeed });
    }

    function resetAfterDeath() {
        var ship = Ship.getShip();
        ship.hp = ship.maxHp * 0.5;
        ship.shieldHp = ship.maxShieldHp;
        // Respawn at Luna's current orbital position
        var luna = World.getLocation('luna');
        ship.x = luna ? luna.x : Config.SUN_X;
        ship.y = luna ? luna.y : Config.SUN_Y;
        ship.vx = 0; ship.vy = 0;
        ship.docked = true; ship.dockedAt = 'luna';
        // Penalty
        Economy.spendCredits(Math.floor(Economy.getCredits() * 0.1));
        _gameOver = false;
        Events.emit('player_respawned', {});
    }

    function serialize() {
        return {
            tickCount: _tickCount,
            gameSpeed: _gameSpeed,
            world: World.serialize(),
            ship: Ship.serialize(),
            factions: Factions.serialize(),
            economy: Economy.serialize(),
            combat: Combat.serialize(),
            fleet: Fleet.serialize(),
            missions: Missions.serialize(),
            diplomacy: Diplomacy.serialize(),
            story: Story.serialize()
        };
    }

    function deserialize(data) {
        if (!data) return;
        _tickCount = data.tickCount || 0;
        _gameSpeed = data.gameSpeed || 1;
        _gameOver = false;
        _paused = false;

        World.deserialize(data.world);
        Ship.deserialize(data.ship);
        Factions.deserialize(data.factions);
        Economy.deserialize(data.economy);
        Combat.deserialize(data.combat);
        Fleet.deserialize(data.fleet);
        Missions.deserialize(data.missions);
        Diplomacy.deserialize(data.diplomacy);
        Story.deserialize(data.story);
    }

    function getDate() {
        var totalDays = Math.floor(_tickCount / Config.CALENDAR.TICKS_PER_DAY);
        var year = Config.CALENDAR.START_YEAR;
        var daysRemaining = totalDays;
        var daysInYear = 365;

        while (daysRemaining >= daysInYear) {
            daysRemaining -= daysInYear;
            year++;
        }

        var month = 0;
        var dpm = Config.CALENDAR.DAYS_PER_MONTH;
        while (month < 11 && daysRemaining >= dpm[month]) {
            daysRemaining -= dpm[month];
            month++;
        }

        return {
            year: year,
            month: month,
            day: daysRemaining + 1,
            monthName: Config.CALENDAR.MONTH_NAMES[month],
            totalDays: totalDays
        };
    }

    return {
        init: init,
        tick: tick,
        isPaused: isPaused,
        isGameOver: isGameOver,
        getTickCount: getTickCount,
        getGameSpeed: getGameSpeed,
        getDate: getDate,
        togglePause: togglePause,
        setGameSpeed: setGameSpeed,
        resetAfterDeath: resetAfterDeath,
        serialize: serialize,
        deserialize: deserialize
    };
})();
