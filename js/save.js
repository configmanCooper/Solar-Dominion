/* ============================================================
 * Solar Dominion — Save System
 * Slot-based saves with LZString compression, versioning, and
 * autosave rotation.
 * ============================================================ */
var Save = (function () {
    'use strict';

    var _autoSlotA = '_autosave_a';
    var _autoSlotB = '_autosave_b';
    var _lastAutoSlot = 'a';

    function _key(slot) {
        return Config.SAVE_KEY_PREFIX + slot;
    }

    function save(slot) {
        try {
            var payload = Engine.serialize();
            payload._saveVersion = Config.SAVE_VERSION;
            payload._saveDate = new Date().toISOString();
            payload._saveName = slot;

            var json = JSON.stringify(payload);
            var compressed = typeof LZString !== 'undefined'
                ? LZString.compressToUTF16(json) : json;

            localStorage.setItem(_key(slot), compressed);
            localStorage.setItem(_key(slot) + '_meta', JSON.stringify({
                version: Config.SAVE_VERSION,
                date: payload._saveDate,
                credits: Economy.getCredits(),
                path: Diplomacy.getPath(),
                chapter: Story.getChapter()
            }));
            return true;
        } catch (e) {
            console.error('[Save] Error saving:', e);
            return false;
        }
    }

    function load(slot) {
        try {
            var raw = localStorage.getItem(_key(slot));
            if (!raw) return false;

            var json;
            try {
                json = typeof LZString !== 'undefined'
                    ? LZString.decompressFromUTF16(raw) : raw;
                if (!json) json = raw; // fallback if decompression returns null
            } catch (e) {
                json = raw;
            }

            var data = JSON.parse(json);
            if (!data) return false;

            Engine.deserialize(data);
            return true;
        } catch (e) {
            console.error('[Save] Error loading:', e);
            return false;
        }
    }

    function autosave() {
        var slot = _lastAutoSlot === 'a' ? _autoSlotB : _autoSlotA;
        _lastAutoSlot = _lastAutoSlot === 'a' ? 'b' : 'a';
        return save(slot);
    }

    function deleteSave(slot) {
        localStorage.removeItem(_key(slot));
        localStorage.removeItem(_key(slot) + '_meta');
    }

    function getSaveSlots() {
        var slots = [];
        for (var i = 1; i <= Config.MAX_SAVE_SLOTS; i++) {
            var meta = localStorage.getItem(_key('slot_' + i) + '_meta');
            slots.push({
                slot: 'slot_' + i,
                exists: !!meta,
                meta: meta ? JSON.parse(meta) : null
            });
        }
        return slots;
    }

    function hasAutosave() {
        return !!localStorage.getItem(_key(_autoSlotA)) || !!localStorage.getItem(_key(_autoSlotB));
    }

    function loadAutosave() {
        // Try most recent autosave slot first
        var slotToTry = _lastAutoSlot === 'a' ? _autoSlotA : _autoSlotB;
        if (load(slotToTry)) return true;
        var other = slotToTry === _autoSlotA ? _autoSlotB : _autoSlotA;
        return load(other);
    }

    return {
        save: save,
        load: load,
        autosave: autosave,
        deleteSave: deleteSave,
        getSaveSlots: getSaveSlots,
        hasAutosave: hasAutosave,
        loadAutosave: loadAutosave
    };
})();
