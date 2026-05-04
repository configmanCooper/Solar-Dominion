/* ============================================================
 * Solar Dominion — Ship Templates
 * Pre-defined ship layouts for NPCs, fleet building, and starting ships.
 * Block codes: hb=hull_basic ha=hull_armored ck=cockpit pc=power_core
 *   ec=engine_chemical ei=engine_ion ep=engine_plasma ef=engine_fusion
 *   wl=weapon_laser wm=weapon_missile wr=weapon_railgun wt=weapon_torpedo
 *   sb=shield_basic sh=shield_heavy ps=power_solar pf=power_fusion_gen
 *   cb=cargo_bay ft=fuel_tank sa=sensor_array rb=repair_bay ds=diplomatic_suite
 *   . = empty cell
 * ============================================================ */
var ShipTemplates = (function () {
    'use strict';

    // Template format: { id, name, faction, rarity, role, hullClass, blocks: [rows of codes] }
    // Rarity: 'common', 'uncommon', 'rare', 'elite'
    // Role: 'patrol', 'fighter', 'frigate', 'destroyer', 'cruiser', 'battleship', 'carrier', 'trader', 'diplomat', 'stealth', 'scout', 'battle', 'research', 'miner'

    var _templates = [

        // ══════════════════════════════════════════════════════
        // EARTH SHIPS — heavy armor, railguns, strong shields
        // ══════════════════════════════════════════════════════

        // --- Common (60%) ---
        { id: 'earth_scout', name: 'Hawk Scout', faction: 'earth', rarity: 'common', role: 'scout', hullClass: 'fighter',
            blocks: [
                ['.','wl','.','.','.' ],
                ['.','hb','hb','.','.'],
                ['.','ck','pc','.','.'],
                ['.','hb','ft','.','.'],
                ['.','.','ec','.','.']
            ]},
        { id: 'earth_patrol', name: 'Eagle Patrol', faction: 'earth', rarity: 'common', role: 'patrol', hullClass: 'fighter',
            blocks: [
                ['.','wl','.','wl','.'],
                ['.','hb','hb','hb','.'],
                ['.','sb','ck','pc','.'],
                ['.','hb','ft','hb','.'],
                ['.','.','ec','.','.']
            ]},
        { id: 'earth_fighter', name: 'Falcon Fighter', faction: 'earth', rarity: 'common', role: 'fighter', hullClass: 'fighter',
            blocks: [
                ['wl','.','wl','.','.'],
                ['hb','hb','hb','.','.'],
                ['.','ck','sb','.','.'],
                ['hb','pc','ft','.','.'],
                ['.','ec','ec','.','.']
            ]},
        { id: 'earth_trader', name: 'Pelican Hauler', faction: 'earth', rarity: 'common', role: 'trader', hullClass: 'corvette',
            blocks: [
                ['.','.','.','.','.','.','.'],
                ['.','hb','hb','hb','hb','.','.'],
                ['.','cb','cb','cb','cb','.','.'],
                ['.','hb','ck','pc','hb','.','.'],
                ['.','cb','cb','ft','ft','.','.'],
                ['.','hb','hb','hb','hb','.','.'],
                ['.','.','ec','ec','.','.','.']
            ]},
        { id: 'earth_transport', name: 'Crane Transport', faction: 'earth', rarity: 'common', role: 'trader', hullClass: 'frigate',
            blocks: [
                ['.','.','.','.','.','.','.','.','.'],
                ['.','hb','hb','hb','hb','hb','hb','.','.'],
                ['.','hb','cb','cb','cb','cb','hb','.','.'],
                ['.','wl','cb','ck','pc','cb','wl','.','.'],
                ['.','hb','cb','sb','ft','cb','hb','.','.'],
                ['.','hb','cb','cb','cb','cb','hb','.','.'],
                ['.','hb','hb','hb','hb','hb','hb','.','.'],
                ['.','.','.','ec','ec','ec','.','.','.'],
                ['.','.','.','.','.','.','.','.','.']
            ]},

        // --- Uncommon (25%) ---
        { id: 'earth_corvette', name: 'Osprey Corvette', faction: 'earth', rarity: 'uncommon', role: 'frigate', hullClass: 'corvette',
            blocks: [
                ['.','.','.','wr','.','.', '.'],
                ['.','ha','ha','ha','ha','.','.'],
                ['.','wl','sb','ck','wl','.','.'],
                ['.','ha','pc','pc','ha','.','.'],
                ['.','ha','ft','ft','ha','.','.'],
                ['.','ha','ha','ha','ha','.','.'],
                ['.','.','.','ec','.','.', '.']
            ]},
        { id: 'earth_frigate', name: 'Condor Frigate', faction: 'earth', rarity: 'uncommon', role: 'frigate', hullClass: 'frigate',
            blocks: [
                ['.','.','.','wr','wr','.','.','.','.'],
                ['.','ha','ha','ha','ha','ha','.','.', '.'],
                ['.','wl','ha','sb','ha','wl','.','.', '.'],
                ['.','ha','sh','ck','sh','ha','.','.', '.'],
                ['.','ha','pc','pf','pc','ha','.','.', '.'],
                ['.','ha','ft','ft','ft','ha','.','.', '.'],
                ['.','ha','ha','ha','ha','ha','.','.', '.'],
                ['.','.','ec','ei','ec','.','.','.','.'],
                ['.','.','.','.','.','.','.','.','.']
            ]},
        { id: 'earth_gunship', name: 'Harrier Gunship', faction: 'earth', rarity: 'uncommon', role: 'fighter', hullClass: 'corvette',
            blocks: [
                ['.','wr','.','wr','.','.', '.'],
                ['.','ha','ha','ha','.','.', '.'],
                ['wl','ha','ck','ha','wl','.', '.'],
                ['.','ha','pc','ha','.','.', '.'],
                ['.','ha','sb','ha','.','.', '.'],
                ['.','ha','ft','ha','.','.', '.'],
                ['.','.','ec','ec','.','.', '.']
            ]},
        { id: 'earth_diplomat', name: 'Dove Envoy', faction: 'earth', rarity: 'uncommon', role: 'diplomat', hullClass: 'corvette',
            blocks: [
                ['.','.','.','sa','.','.', '.'],
                ['.','hb','hb','hb','hb','.', '.'],
                ['.','hb','ds','ck','hb','.', '.'],
                ['.','hb','sb','pc','hb','.', '.'],
                ['.','hb','ft','rb','hb','.', '.'],
                ['.','hb','hb','hb','hb','.', '.'],
                ['.','.','ei','ei','.','.', '.']
            ]},

        // --- Research & Mining ships ---
        { id: 'earth_researcher', name: 'Owl Observatory', faction: 'earth', rarity: 'common', role: 'research', hullClass: 'corvette',
            blocks: [
                ['.','.','.','sa','.','.', '.'],
                ['.','hb','hb','hb','hb','.', '.'],
                ['.','sa','hb','hb','sa','.', '.'],
                ['.','hb','ck','pc','hb','.', '.'],
                ['.','hb','sb','ft','hb','.', '.'],
                ['.','hb','hb','hb','hb','.', '.'],
                ['.','.','ei','ei','.','.', '.']
            ]},
        { id: 'earth_miner', name: 'Badger Miner', faction: 'earth', rarity: 'common', role: 'miner', hullClass: 'corvette',
            blocks: [
                ['.','.','.','m1','.','.', '.'],
                ['.','hb','hb','hb','hb','.', '.'],
                ['.','cb','cb','cb','cb','.', '.'],
                ['.','hb','ck','pc','hb','.', '.'],
                ['.','cb','cb','ft','ft','.', '.'],
                ['.','hb','hb','hb','hb','.', '.'],
                ['.','.','ec','ec','.','.', '.']
            ]},
        { id: 'earth_adv_miner', name: 'Ibis Deep Driller', faction: 'earth', rarity: 'uncommon', role: 'miner', hullClass: 'frigate',
            blocks: [
                ['.','.','.','m2','.','.', '.'],
                ['.','ha','hb','hb','ha','.', '.'],
                ['.','cb','cb','cb','cb','.', '.'],
                ['.','cb','cb','cb','cb','.', '.'],
                ['.','ha','ck','pc','ha','.', '.'],
                ['.','cb','sb','ft','cb','.', '.'],
                ['.','ha','hb','hb','ha','.', '.'],
                ['.','.','ei','ei','.','.', '.']
            ]},
        { id: 'earth_battlecruiser', name: 'Raptor Assault', faction: 'earth', rarity: 'uncommon', role: 'battle', hullClass: 'corvette',
            blocks: [
                ['.','wl','.','wl','.','.', '.'],
                ['.','ha','ha','ha','.','.', '.'],
                ['wl','ha','ck','ha','wl','.', '.'],
                ['.','ha','pc','pf','.','.', '.'],
                ['.','ha','sb','ft','.','.', '.'],
                ['.','ha','ha','ha','.','.', '.'],
                ['.','.','ei','ei','.','.', '.']
            ]},

        // --- Rare (10%) ---
        { id: 'earth_destroyer', name: 'Thunder Destroyer', faction: 'earth', rarity: 'rare', role: 'destroyer', hullClass: 'destroyer',
            blocks: [
                ['.','.','.','.','wt','wt','.','.','.','.'],
                ['.','.','.','ha','ha','ha','ha','.','.','.'],
                ['.','.','.','wr','ha','ha','wr','.','.','.'],
                ['.','ha','ha','ha','sh','sh','ha','ha','.','.'],
                ['.','wl','ha','pf','ck','pf','ha','wl','.','.'],
                ['.','ha','ha','ha','pc','pc','ha','ha','.','.'],
                ['.','.','.','ha','ft','ft','ha','.','.','.'],
                ['.','.','.','ha','ft','ft','ha','.','.','.'],
                ['.','.','.','ha','ha','ha','ha','.','.','.'],
                ['.','.','.','.','ei','ei','.','.','.','.']
            ]},
        { id: 'earth_cruiser', name: 'Sovereign Cruiser', faction: 'earth', rarity: 'rare', role: 'cruiser', hullClass: 'cruiser',
            blocks: [
                ['.','.','.','.','wt','wt','wt','.','.','.','.','.' ],
                ['.','.','.','ha','ha','ha','ha','ha','.','.','.','.'],
                ['.','.','.','wr','ha','sh','ha','wr','.','.','.','.'],
                ['.','ha','ha','ha','ha','sh','ha','ha','ha','.','.', '.'],
                ['.','wl','ha','pf','ha','ck','ha','pf','ha','wl','.','.'],
                ['.','ha','ha','ha','rb','pc','rb','ha','ha','ha','.','.'],
                ['.','.','.','ha','ft','pf','ft','ha','.','.','.','.'],
                ['.','.','.','ha','ft','ft','ft','ha','.','.','.','.'],
                ['.','.','.','ha','ha','ha','ha','ha','.','.','.','.'],
                ['.','.','.','ha','ha','ha','ha','ha','.','.','.','.'],
                ['.','.','.','.','ei','ei','ei','.','.','.','.','.' ],
                ['.','.','.','.','.','.','.','.','.','.','.','.']
            ]},

        // --- Elite (5%) ---
        { id: 'earth_battleship', name: 'Titan Battleship', faction: 'earth', rarity: 'elite', role: 'battleship', hullClass: 'battleship',
            blocks: [
                ['.','.','.','.','.','.','wt','wt','.','.','.','.','.','.'],
                ['.','.','.','.','.','ha','ha','ha','ha','.','.','.','.', '.'],
                ['.','.','.','.','wt','ha','ha','ha','ha','wt','.','.','.', '.'],
                ['.','.','.','ha','ha','ha','sh','sh','ha','ha','ha','.','.', '.'],
                ['.','.','.','wr','ha','pf','ha','ha','pf','ha','wr','.','.', '.'],
                ['.','ha','ha','ha','ha','ha','ck','rb','ha','ha','ha','ha','.', '.'],
                ['.','wl','ha','ha','pf','sh','pc','pc','sh','pf','ha','wl','.', '.'],
                ['.','ha','ha','ha','ha','ha','ha','ha','ha','ha','ha','ha','.', '.'],
                ['.','.','.','ha','ft','ft','pf','pf','ft','ft','ha','.','.', '.'],
                ['.','.','.','ha','ft','ft','ft','ft','ft','ft','ha','.','.', '.'],
                ['.','.','.','ha','ha','ha','ha','ha','ha','ha','ha','.','.', '.'],
                ['.','.','.','.','.','ha','ha','ha','ha','.','.','.','.', '.'],
                ['.','.','.','.','.','.','ef','ef','.','.','.','.','.','.'],
                ['.','.','.','.','.','.','.','.','.','.','.','.','.','.']
            ]},

        // ══════════════════════════════════════════════════════
        // MARS SHIPS — light, fast, plasma weapons, agile
        // ══════════════════════════════════════════════════════

        // --- Common (60%) ---
        { id: 'mars_scout', name: 'Dust Runner', faction: 'mars', rarity: 'common', role: 'scout', hullClass: 'fighter',
            blocks: [
                ['.','.','sa','.','.'],
                ['.','hb','hb','.','.'],
                ['.','ck','pc','.','.'],
                ['.','hb','ft','.','.'],
                ['.','ep','.','.', '.']
            ]},
        { id: 'mars_patrol', name: 'Red Viper', faction: 'mars', rarity: 'common', role: 'patrol', hullClass: 'fighter',
            blocks: [
                ['wl','.','.','wl','.'],
                ['hb','hb','hb','hb','.'],
                ['.','ck','pc','.','.'],
                ['.','hb','ft','.','.'],
                ['.','ep','ep','.','.']
            ]},
        { id: 'mars_fighter', name: 'Sand Wasp', faction: 'mars', rarity: 'common', role: 'fighter', hullClass: 'fighter',
            blocks: [
                ['.','wl','wl','.','.'],
                ['hb','hb','hb','.','.'],
                ['ps','ck','sb','.','.'],
                ['hb','pc','ft','.','.'],
                ['.','ep','ep','.','.']
            ]},
        { id: 'mars_trader', name: 'Dune Caravan', faction: 'mars', rarity: 'common', role: 'trader', hullClass: 'corvette',
            blocks: [
                ['.','.','.','.','.','.','.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','cb','cb','cb','.','.', '.'],
                ['.','hb','ck','pc','.','.', '.'],
                ['.','cb','sb','ft','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','.','ep','ep','.','.','.']
            ]},
        { id: 'mars_interceptor', name: 'Crimson Dart', faction: 'mars', rarity: 'common', role: 'fighter', hullClass: 'fighter',
            blocks: [
                ['.','.','wl','.','.'],
                ['.','hb','hb','.','.'],
                ['wl','ck','pc','.','.'],
                ['.','hb','ft','.','.'],
                ['.','ep','ep','.','.']
            ]},

        // --- Uncommon (25%) ---
        { id: 'mars_corvette', name: 'Storm Chaser', faction: 'mars', rarity: 'uncommon', role: 'frigate', hullClass: 'corvette',
            blocks: [
                ['.','wl','.','wl','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['wm','hb','sb','hb','wm','.', '.'],
                ['.','hb','ck','hb','.','.', '.'],
                ['.','hb','pc','hb','.','.', '.'],
                ['.','hb','ft','hb','.','.', '.'],
                ['.','.','ep','ep','.','.', '.']
            ]},
        { id: 'mars_frigate', name: 'Dust Devil', faction: 'mars', rarity: 'uncommon', role: 'frigate', hullClass: 'frigate',
            blocks: [
                ['.','.','.','.','.','.','.','.', '.'],
                ['.','.','.','wl','wl','.','.','.','.'],
                ['.','.','.','hb','hb','.','.','.','.'],
                ['.','wm','hb','sb','hb','hb','wm','.','.'],
                ['.','.','.','ck','pc','.','.','.','.'],
                ['.','.','.','hb','pf','.','.','.','.'],
                ['.','.','.','ft','ft','.','.','.','.'],
                ['.','.','.','ep','ep','.','.','.','.'],
                ['.','.','.','.','.','.','.','.','.']
            ]},
        { id: 'mars_stealth', name: 'Shadow Blade', faction: 'mars', rarity: 'uncommon', role: 'stealth', hullClass: 'fighter',
            blocks: [
                ['.','.','wl','.','.'],
                ['.','hb','hb','.','.'],
                ['.','ck','sb','.','.'],
                ['.','pc','ft','.','.'],
                ['.','ei','ei','.','.']
            ]},
        { id: 'mars_diplomat', name: 'Red Ambassador', faction: 'mars', rarity: 'uncommon', role: 'diplomat', hullClass: 'corvette',
            blocks: [
                ['.','.','.','sa','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','hb','ds','hb','.','.', '.'],
                ['.','hb','ck','pc','.','.', '.'],
                ['.','hb','sb','ft','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','.','ep','ep','.','.', '.']
            ]},
        // --- Research & Mining ships ---
        { id: 'mars_researcher', name: 'Probe Seeker', faction: 'mars', rarity: 'common', role: 'research', hullClass: 'corvette',
            blocks: [
                ['.','sa','.','sa','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','sa','hb','sa','.','.', '.'],
                ['.','hb','ck','pc','.','.', '.'],
                ['.','hb','sb','ft','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','.','ep','ep','.','.', '.']
            ]},
        { id: 'mars_adv_researcher', name: 'Olympus Lab', faction: 'mars', rarity: 'uncommon', role: 'research', hullClass: 'frigate',
            blocks: [
                ['.','sa','.','sa','.','.', '.'],
                ['.','hb','hb','hb','hb','.', '.'],
                ['.','sa','hb','hb','sa','.', '.'],
                ['.','hb','ck','pc','hb','.', '.'],
                ['.','hb','sb','pf','hb','.', '.'],
                ['.','hb','ft','ft','hb','.', '.'],
                ['.','hb','hb','hb','hb','.', '.'],
                ['.','.','ep','ep','.','.', '.']
            ]},
        { id: 'mars_miner', name: 'Rust Digger', faction: 'mars', rarity: 'common', role: 'miner', hullClass: 'corvette',
            blocks: [
                ['.','.','.','m1','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','cb','cb','cb','.','.', '.'],
                ['.','hb','ck','pc','.','.', '.'],
                ['.','cb','cb','ft','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','.','ep','ep','.','.', '.']
            ]},
        { id: 'mars_raider', name: 'Scorpion Raider', faction: 'mars', rarity: 'common', role: 'battle', hullClass: 'fighter',
            blocks: [
                ['wl','wl','.','.','.'],
                ['hb','hb','hb','.','.'],
                ['.','ck','sb','.','.'],
                ['hb','pc','ft','.','.'],
                ['.','ep','ep','.','.']
            ]},
        { id: 'mars_assault', name: 'Vulcan Assault', faction: 'mars', rarity: 'uncommon', role: 'battle', hullClass: 'corvette',
            blocks: [
                ['.','wm','.','wm','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['wl','hb','ck','hb','wl','.', '.'],
                ['.','hb','pc','pf','.','.', '.'],
                ['.','hb','sb','ft','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','.','ep','ep','.','.', '.']
            ]},

        // --- Rare (10%) ---
        { id: 'mars_destroyer', name: 'Sandstorm', faction: 'mars', rarity: 'rare', role: 'destroyer', hullClass: 'destroyer',
            blocks: [
                ['.','.','.','.','wm','wm','.','.','.','.'],
                ['.','.','.','hb','hb','hb','hb','.','.','.'],
                ['.','.','wl','hb','sb','sb','hb','wl','.','.'],
                ['.','.','.','hb','ck','pf','hb','.','.','.'],
                ['.','wm','.','hb','pc','pc','hb','.','wm','.'],
                ['.','.','.','hb','hb','hb','hb','.','.','.'],
                ['.','.','.','hb','ft','ft','hb','.','.','.'],
                ['.','.','.','hb','ft','ft','hb','.','.','.'],
                ['.','.','.','hb','hb','hb','hb','.','.','.'],
                ['.','.','.','.','ep','ep','.','.','.','.']
            ]},
        { id: 'mars_cruiser', name: 'Olympus Reaver', faction: 'mars', rarity: 'rare', role: 'cruiser', hullClass: 'cruiser',
            blocks: [
                ['.','.','.','.','wm','wm','wm','.','.','.','.','.' ],
                ['.','.','.','hb','hb','hb','hb','hb','.','.','.','.'],
                ['.','.','.','wl','hb','sb','hb','wl','.','.','.','.'],
                ['.','hb','hb','hb','sb','sh','sb','hb','hb','.','.', '.'],
                ['.','wm','hb','pf','hb','ck','hb','pf','hb','wm','.','.'],
                ['.','hb','hb','hb','rb','pc','rb','hb','hb','hb','.','.'],
                ['.','.','.','hb','ft','pf','ft','hb','.','.','.','.'],
                ['.','.','.','hb','ft','ft','ft','hb','.','.','.','.'],
                ['.','.','.','hb','hb','hb','hb','hb','.','.','.','.'],
                ['.','.','.','hb','hb','hb','hb','hb','.','.','.','.'],
                ['.','.','.','.','ep','ep','ep','.','.','.','.','.' ],
                ['.','.','.','.','.','.','.','.','.','.','.','.']
            ]},

        // --- Elite (5%) ---
        { id: 'mars_dreadnought', name: 'Ares Dreadnought', faction: 'mars', rarity: 'elite', role: 'battleship', hullClass: 'battleship',
            blocks: [
                ['.','.','.','.','.','.','wm','wm','.','.','.','.','.','.'],
                ['.','.','.','.','.','hb','hb','hb','hb','.','.','.','.', '.'],
                ['.','.','.','.','wm','hb','hb','hb','hb','wm','.','.','.', '.'],
                ['.','.','.','hb','hb','hb','sb','sb','hb','hb','hb','.','.', '.'],
                ['.','.','.','wl','hb','pf','sh','sh','pf','hb','wl','.','.', '.'],
                ['.','hb','hb','hb','hb','hb','ck','rb','hb','hb','hb','hb','.', '.'],
                ['.','wm','hb','hb','pf','sb','pc','pc','sb','pf','hb','wm','.', '.'],
                ['.','hb','hb','hb','hb','hb','hb','hb','hb','hb','hb','hb','.', '.'],
                ['.','.','.','hb','ft','ft','pf','pf','ft','ft','hb','.','.', '.'],
                ['.','.','.','hb','ft','ft','ft','ft','ft','ft','hb','.','.', '.'],
                ['.','.','.','hb','hb','hb','hb','hb','hb','hb','hb','.','.', '.'],
                ['.','.','.','.','.','hb','hb','hb','hb','.','.','.','.', '.'],
                ['.','.','.','.','.','.','ep','ep','.','.','.','.','.','.'],
                ['.','.','.','.','.','.','.','.','.','.','.','.','.','.']
            ]},

        // ══════════════════════════════════════════════════════
        // MOON SHIPS — hybrid designs
        // ══════════════════════════════════════════════════════

        { id: 'moon_patrol', name: 'Lunar Guard', faction: 'moon', rarity: 'common', role: 'patrol', hullClass: 'fighter',
            blocks: [
                ['.','wl','.','.', '.'],
                ['hb','hb','hb','.','.'],
                ['cb','ck','sb','.','.'],
                ['.','pc','ft','.','.'],
                ['.','ec','.','.','.']
            ]},
        { id: 'moon_trader', name: 'Selene Merchant', faction: 'moon', rarity: 'common', role: 'trader', hullClass: 'corvette',
            blocks: [
                ['.','.','.','.','.','.','.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','cb','cb','hb','.','.', '.'],
                ['.','hb','ck','pc','.','.', '.'],
                ['.','cb','sb','ft','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','.','ei','.','.','.','.']
            ]},
        { id: 'moon_corvette', name: 'Artemis Striker', faction: 'moon', rarity: 'uncommon', role: 'frigate', hullClass: 'corvette',
            blocks: [
                ['.','.','.','wr','.','.', '.'],
                ['.','ha','hb','hb','ha','.', '.'],
                ['.','wl','sb','ck','wl','.', '.'],
                ['.','hb','pc','pf','hb','.', '.'],
                ['.','hb','ft','ft','hb','.', '.'],
                ['.','hb','hb','hb','hb','.', '.'],
                ['.','.','ei','ei','.','.', '.']
            ]},
        { id: 'moon_diplomat', name: 'Silver Dove', faction: 'moon', rarity: 'rare', role: 'diplomat', hullClass: 'corvette',
            blocks: [
                ['.','.','.','sa','.','.', '.'],
                ['.','hb','hb','hb','hb','.', '.'],
                ['.','hb','ds','ds','hb','.', '.'],
                ['.','hb','ck','pc','hb','.', '.'],
                ['.','hb','sb','ft','hb','.', '.'],
                ['.','hb','rb','hb','hb','.', '.'],
                ['.','.','ei','ei','.','.', '.']
            ]},

        // ══════════════════════════════════════════════════════
        // INDEPENDENT STATION SHIPS — utility/trade
        // ══════════════════════════════════════════════════════

        { id: 'indie_shuttle', name: 'Waypoint Shuttle', faction: 'independent', rarity: 'common', role: 'trader', hullClass: 'fighter',
            blocks: [
                ['.','.','.','.','.'],
                ['.','hb','hb','.','.'],
                ['.','ck','cb','.','.'],
                ['.','pc','ft','.','.'],
                ['.','ec','.','.','.']
            ]},
        { id: 'indie_freighter', name: 'Frontier Freighter', faction: 'independent', rarity: 'common', role: 'trader', hullClass: 'corvette',
            blocks: [
                ['.','.','.','.','.','.','.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','cb','cb','cb','.','.', '.'],
                ['.','cb','ck','cb','.','.', '.'],
                ['.','cb','pc','ft','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','.','ec','ec','.','.','.']
            ]},
        { id: 'indie_patrol', name: 'Freelance Ranger', faction: 'independent', rarity: 'uncommon', role: 'patrol', hullClass: 'fighter',
            blocks: [
                ['.','wl','.','.','.'],
                ['hb','hb','hb','.','.'],
                ['.','ck','sb','.','.'],
                ['.','pc','ft','.','.'],
                ['.','ec','ec','.','.']
            ]},
        { id: 'indie_corvette', name: 'Nomad Escort', faction: 'independent', rarity: 'rare', role: 'frigate', hullClass: 'corvette',
            blocks: [
                ['.','wl','.','wl','.','.', '.'],
                ['.','ha','hb','ha','.','.', '.'],
                ['.','wl','sb','ck','wl','.', '.'],
                ['.','ha','pc','pf','ha','.', '.'],
                ['.','ha','ft','ft','ha','.', '.'],
                ['.','ha','hb','ha','ha','.', '.'],
                ['.','.','ei','ei','.','.', '.']
            ]},
        { id: 'indie_miner', name: 'Prospector', faction: 'independent', rarity: 'common', role: 'miner', hullClass: 'corvette',
            blocks: [
                ['.','.','.','m1','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','cb','cb','cb','.','.', '.'],
                ['.','hb','ck','pc','.','.', '.'],
                ['.','cb','ft','ft','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','.','ec','ec','.','.', '.']
            ]},
        { id: 'indie_researcher', name: 'Stargazer', faction: 'independent', rarity: 'uncommon', role: 'research', hullClass: 'corvette',
            blocks: [
                ['.','.','.','sa','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','sa','hb','sa','.','.', '.'],
                ['.','hb','ck','pc','.','.', '.'],
                ['.','hb','sb','ft','.','.', '.'],
                ['.','hb','hb','hb','.','.', '.'],
                ['.','.','ei','ei','.','.', '.']
            ]}
    ];

    // ── Rarity weights for spawn rolls ──────────────────────
    var RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 10, elite: 5 };

    // Get a template by id
    function getTemplate(id) {
        for (var i = 0; i < _templates.length; i++) {
            if (_templates[i].id === id) return _templates[i];
        }
        return null;
    }

    // Get all templates for a faction
    function getByFaction(faction) {
        var result = [];
        for (var i = 0; i < _templates.length; i++) {
            if (_templates[i].faction === faction) result.push(_templates[i]);
        }
        return result;
    }

    // Get all templates matching faction and role
    function getByFactionAndRole(faction, role) {
        var result = [];
        for (var i = 0; i < _templates.length; i++) {
            var t = _templates[i];
            if (t.faction === faction && t.role === role) result.push(t);
        }
        return result;
    }

    // Pick a random template for a faction using rarity weights
    function pickRandom(faction, roleFilter) {
        var pool = [];
        for (var i = 0; i < _templates.length; i++) {
            var t = _templates[i];
            if (t.faction !== faction) continue;
            if (roleFilter && t.role !== roleFilter) continue;
            pool.push(t);
        }
        if (pool.length === 0) {
            // Fallback: try independent
            for (var j = 0; j < _templates.length; j++) {
                var t2 = _templates[j];
                if (t2.faction === 'independent') {
                    if (roleFilter && t2.role !== roleFilter) continue;
                    pool.push(t2);
                }
            }
        }
        if (pool.length === 0) return _templates[0]; // absolute fallback

        // Weight by rarity
        var totalWeight = 0;
        var weights = [];
        for (var k = 0; k < pool.length; k++) {
            var w = RARITY_WEIGHTS[pool[k].rarity] || 10;
            weights.push(w);
            totalWeight += w;
        }
        var roll = Math.random() * totalWeight;
        var cumul = 0;
        for (var m = 0; m < pool.length; m++) {
            cumul += weights[m];
            if (roll <= cumul) return pool[m];
        }
        return pool[pool.length - 1];
    }

    // Build a ShipGrid from a template
    function buildGrid(templateId) {
        var tmpl = getTemplate(templateId);
        if (!tmpl) return null;
        return ShipGrid.fromTemplate(tmpl.hullClass, tmpl.blocks);
    }

    // Get all templates
    function getAll() {
        return _templates;
    }

    // Player starter template
    function getStarterTemplate() {
        return getTemplate('moon_patrol');
    }

    return {
        getTemplate: getTemplate,
        getByFaction: getByFaction,
        getByFactionAndRole: getByFactionAndRole,
        pickRandom: pickRandom,
        buildGrid: buildGrid,
        getAll: getAll,
        getStarterTemplate: getStarterTemplate,
        RARITY_WEIGHTS: RARITY_WEIGHTS
    };
})();
