/* ============================================================
 * Solar Dominion — Story Module
 * Tracks story progression, triggers events, and manages
 * the narrative flow for both peace and war paths.
 * ============================================================ */
var Story = (function () {
    'use strict';

    var _chapter = 0;
    var _events = [];
    var _flags = {};
    var _introShown = false;
    var _victoryShown = false;

    var CHAPTERS = [
        {
            id: 'prologue',
            title: 'A Divided System',
            text: 'The year is 2202. Earth and Mars have been at war for months. You\'re a pilot from Luna Colony, the neutral ground between two superpowers. The Moon, your home, is being pressured by Earth to join their side. Meanwhile, Mars eyes the Ares Station in orbit above them.\n\nYour choices will determine the fate of the solar system.\n\nWill you broker peace... or help one side win?',
            trigger: function () { return true; }
        },
        {
            id: 'choose_path',
            title: 'Choose Your Path',
            text: 'You\'ve gained enough experience to make your mark. Three paths lie before you:\n\n🕊️ PEACE — Unite the factions through diplomacy and negotiation.\n⚔️ SIDE WITH EARTH — Help Earth\'s industrial might crush Mars.\n⚔️ SIDE WITH MARS — Help Mars\'s technology overcome Earth.\n\nVisit any faction location to begin your chosen path.',
            trigger: function () {
                return Missions.getCompleted().length >= 3 && Diplomacy.getPath() === 'none';
            }
        },
        {
            id: 'path_chosen',
            title: function () {
                var p = Diplomacy.getPath();
                if (p === 'peace') return 'The Peacemaker';
                if (p === 'war_earth') return 'Earth\'s Champion';
                if (p === 'war_mars') return 'Mars\'s Champion';
                return 'Path Chosen';
            },
            text: function () {
                var p = Diplomacy.getPath();
                if (p === 'peace') return 'You\'ve chosen the path of peace. Establish neutral zones, build diplomatic stations, and bring both sides to the negotiating table. The road will be long, but a united solar system is worth fighting for.';
                if (p === 'war_earth') return 'You\'ve allied with Earth. Their industrial power combined with your skill could turn the tide. Convince the Moon and stations to join, build your fleet, and prepare for the final push against Mars.';
                if (p === 'war_mars') return 'You\'ve allied with Mars. Their advanced technology gives you an edge. Rally support from neutral stations, grow your military might, and prepare to challenge Earth\'s dominance.';
                return '';
            },
            trigger: function () { return Diplomacy.getPath() !== 'none'; }
        },
        {
            id: 'midgame',
            title: 'The Tide Turns',
            text: function () {
                var p = Diplomacy.getPath();
                if (p === 'peace') return 'Your diplomatic efforts are gaining traction. Keep establishing neutral zones and building trust with both sides. The peace talks are within reach.';
                return 'Your military campaigns are proving effective. Keep pushing your advantage. Victory draws closer with each battle won.';
            },
            trigger: function () {
                return Diplomacy.getPeaceProgress() >= 50 || Diplomacy.getWarProgress() >= 50;
            }
        }
    ];

    function init() {
        _chapter = 0;
        _events = [];
        _flags = {};
        _introShown = false;
        _victoryShown = false;
    }

    function getChapter() { return _chapter; }
    function getFlags() { return _flags; }
    function isIntroShown() { return _introShown; }

    function showIntro() {
        if (_introShown) return null;
        _introShown = true;
        return CHAPTERS[0];
    }

    function tick() {
        // Check for chapter advancement
        for (var i = _chapter + 1; i < CHAPTERS.length; i++) {
            var ch = CHAPTERS[i];
            if (ch.trigger && ch.trigger()) {
                _chapter = i;
                var title = typeof ch.title === 'function' ? ch.title() : ch.title;
                var text = typeof ch.text === 'function' ? ch.text() : ch.text;
                Events.emit('story_chapter', { index: i, title: title, text: text });
                break;
            }
        }

        // Check victory
        if (!_victoryShown) {
            var victory = Diplomacy.checkVictory();
            if (victory.victory) {
                _victoryShown = true;
                Events.emit('victory', victory);
            }
        }
    }

    function setFlag(key, value) { _flags[key] = value; }
    function getFlag(key) { return _flags[key]; }

    function serialize() {
        return {
            chapter: _chapter,
            events: _events.slice(-20),
            flags: JSON.parse(JSON.stringify(_flags)),
            introShown: _introShown,
            victoryShown: _victoryShown
        };
    }

    function deserialize(data) {
        if (!data) return;
        _chapter = data.chapter || 0;
        _events = data.events || [];
        _flags = data.flags || {};
        _introShown = data.introShown || false;
        _victoryShown = data.victoryShown || false;
    }

    return {
        init: init,
        getChapter: getChapter,
        getFlags: getFlags,
        isIntroShown: isIntroShown,
        showIntro: showIntro,
        tick: tick,
        setFlag: setFlag,
        getFlag: getFlag,
        serialize: serialize,
        deserialize: deserialize
    };
})();
