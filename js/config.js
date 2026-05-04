/* ============================================================
 * Solar Dominion — Central Configuration
 * Single source of truth for all game constants and data.
 * ============================================================ */
var Config = (function () {
    'use strict';

    // ── Display ──────────────────────────────────────────────
    var VIEWPORT_W = 1920;
    var VIEWPORT_H = 1080;
    var WORLD_W = 15000;
    var WORLD_H = 15000;
    var MINIMAP_W = 240;
    var MINIMAP_H = 240;

    // ── Timing ───────────────────────────────────────────────
    var TICK_RATE = 100;          // ms per simulation tick
    var RENDER_FPS = 60;
    var AUTOSAVE_INTERVAL = 60000; // ms
    var UI_UPDATE_TICKS = 5;
    var NPC_RESPAWN_INTERVAL = 300; // ticks between respawn checks
    var NPC_MAX_PATROLS_EARTH = 75;   // Earth has more ships (resourceful)
    var NPC_MAX_PATROLS_MARS = 50;
    var NPC_MAX_BATTLE_EARTH = 38;
    var NPC_MAX_BATTLE_MARS = 35;
    var NPC_MAX_DIPLOMACY_EARTH = 18;
    var NPC_MAX_DIPLOMACY_MARS = 8;
    var NPC_MAX_RESEARCH_EARTH = 9;
    var NPC_MAX_RESEARCH_MARS = 10;    // Mars has research advantage
    var NPC_MAX_MINERS_EARTH = 15;
    var NPC_MAX_MINERS_MARS = 12;

    // ── Calendar ────────────────────────────────────────────
    // 1 day = 6 seconds real = 60 ticks. 1 year = 365 days = 21900 ticks (~36.5 min)
    var CALENDAR = {
        START_YEAR: 2202,
        TICKS_PER_DAY: 60,
        DAYS_PER_MONTH: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
        MONTH_NAMES: ['January','February','March','April','May','June','July','August','September','October','November','December']
    };
    var NPC_MAX_TRADERS = 60;

    // ── Physics ──────────────────────────────────────────────
    var BASE_SPEED = 2.5;        // pixels per tick at speed 1
    var ROTATION_SPEED = 0.06;   // radians per tick

    // ── Factions ─────────────────────────────────────────────
    var FACTION = {
        EARTH: 'earth',
        MARS: 'mars',
        MOON: 'moon',
        MARS_STATION: 'mars_station',
        INDEPENDENT: 'independent',
        PLAYER: 'player'
    };

    // ── Location types ───────────────────────────────────────
    var LOC_TYPE = {
        STAR: 'star',
        PLANET: 'planet',
        MOON: 'moon',
        STATION: 'station',
        ASTEROID: 'asteroid'
    };

    // ── Orbital constants ────────────────────────────────────
    // Sun at map center. Orbital radii and periods proportional to real solar system.
    var SUN_X = 7500, SUN_Y = 7500;
    // Earth orbit = ~4300px, one full orbit in ~24000 ticks (~40 min real time)
    var ORBIT_BASE_TICKS = 21900; // Earth's orbital period in ticks (365 days × 60 ticks/day)

    // ── Locations (world coordinates) ────────────────────────
    // Positions are initial only — orbiting bodies get updated each tick
    var LOCATIONS = [
        {
            id: 'sun', name: 'Sol', type: LOC_TYPE.STAR,
            faction: FACTION.INDEPENDENT, x: SUN_X, y: SUN_Y, radius: 300,
            color: '#ffcc00', description: 'The star at the center of our solar system.',
            services: [],
            dockable: false,
            orbit: null // stationary
        },
        {
            id: 'mercury', name: 'Mercury', type: LOC_TYPE.PLANET,
            faction: FACTION.INDEPENDENT, x: SUN_X + 1670, y: SUN_Y, radius: 25,
            color: '#aa9988', description: 'Small rocky planet. Extreme temperatures. Unmanned mining operations.',
            services: ['mining'],
            dockable: false,
            orbit: { parent: 'sun', radius: 1670, period: Math.round(ORBIT_BASE_TICKS * 88 / 365), angle: 0 }
        },
        {
            id: 'venus', name: 'Venus', type: LOC_TYPE.PLANET,
            faction: FACTION.INDEPENDENT, x: SUN_X + 3080, y: SUN_Y, radius: 55,
            color: '#ddbb66', description: 'Cloud-shrouded planet. Atmospheric research stations in orbit.',
            services: ['trade'],
            dockable: false,
            orbit: { parent: 'sun', radius: 3080, period: Math.round(ORBIT_BASE_TICKS * 225 / 365), angle: Math.PI * 0.7 }
        },
        {
            id: 'earth', name: 'Earth', type: LOC_TYPE.PLANET,
            faction: FACTION.EARTH, x: SUN_X + 4300, y: SUN_Y, radius: 65,
            color: '#4488ff', description: 'Humanity\'s homeworld. Industrial powerhouse.',
            services: ['trade', 'missions', 'shipyard', 'upgrade'],
            dockable: true,
            orbit: { parent: 'sun', radius: 4300, period: ORBIT_BASE_TICKS, angle: Math.PI * 1.3 }
        },
        {
            id: 'mars', name: 'Mars', type: LOC_TYPE.PLANET,
            faction: FACTION.MARS, x: SUN_X + 6500, y: SUN_Y, radius: 45,
            color: '#dd4422', description: 'The red planet. Technologically advanced colony.',
            services: ['trade', 'missions', 'shipyard', 'upgrade'],
            dockable: true,
            orbit: { parent: 'sun', radius: 6500, period: Math.round(ORBIT_BASE_TICKS * 687 / 365), angle: Math.PI * 0.4 }
        },
        {
            id: 'luna', name: 'Luna Colony', type: LOC_TYPE.MOON,
            faction: FACTION.MOON, x: SUN_X + 4300 + 150, y: SUN_Y, radius: 22,
            color: '#cccccc', description: 'Neutral moon colony. Your starting base.',
            services: ['trade', 'missions', 'shipyard', 'upgrade'],
            dockable: true,
            orbit: { parent: 'earth', radius: 150, period: Math.round(ORBIT_BASE_TICKS * 27.3 / 365), angle: 0 }
        },
        {
            id: 'mars_orbital', name: 'Ares Station', type: LOC_TYPE.STATION,
            faction: FACTION.MARS_STATION, x: SUN_X + 6500 + 120, y: SUN_Y, radius: 18,
            color: '#ffaa33', description: 'Neutral orbital station near Mars.',
            services: ['trade', 'missions', 'upgrade'],
            dockable: true,
            orbit: { parent: 'mars', radius: 120, period: Math.round(ORBIT_BASE_TICKS * 10 / 365), angle: Math.PI * 0.5 }
        },
        {
            id: 'station_alpha', name: 'Station Alpha', type: LOC_TYPE.STATION,
            faction: FACTION.INDEPENDENT, x: SUN_X + 3800, y: SUN_Y - 800, radius: 15,
            color: '#88cc88', description: 'Independent trading outpost between Venus and Earth.',
            services: ['trade', 'missions'],
            dockable: true,
            orbit: { parent: 'sun', radius: 3800, period: Math.round(ORBIT_BASE_TICKS * 280 / 365), angle: Math.PI * 1.8 }
        },
        {
            id: 'station_beta', name: 'Station Beta', type: LOC_TYPE.STATION,
            faction: FACTION.INDEPENDENT, x: SUN_X + 5400, y: SUN_Y + 600, radius: 15,
            color: '#88cc88', description: 'Independent refueling depot between Earth and Mars.',
            services: ['trade', 'fuel'],
            dockable: true,
            orbit: { parent: 'sun', radius: 5400, period: Math.round(ORBIT_BASE_TICKS * 500 / 365), angle: Math.PI * 0.9 }
        },
        {
            id: 'station_gamma', name: 'Station Gamma', type: LOC_TYPE.STATION,
            faction: FACTION.INDEPENDENT, x: SUN_X + 2400, y: SUN_Y - 400, radius: 15,
            color: '#88cc88', description: 'Independent research station near Mercury.',
            services: ['trade', 'upgrade'],
            dockable: true,
            orbit: { parent: 'sun', radius: 2400, period: Math.round(ORBIT_BASE_TICKS * 160 / 365), angle: Math.PI * 0.2 }
        },
        {
            id: 'asteroid_belt_1', name: 'Ceres Belt', type: LOC_TYPE.ASTEROID,
            faction: FACTION.INDEPENDENT, x: SUN_X + 5900, y: SUN_Y, radius: 120,
            color: '#887766', description: 'Rich asteroid field between Earth and Mars.',
            services: ['mining'],
            dockable: false,
            orbit: { parent: 'sun', radius: 5900, period: Math.round(ORBIT_BASE_TICKS * 600 / 365), angle: Math.PI * 1.1 }
        },
        {
            id: 'asteroid_belt_2', name: 'Vesta Field', type: LOC_TYPE.ASTEROID,
            faction: FACTION.INDEPENDENT, x: SUN_X + 5600, y: SUN_Y, radius: 80,
            color: '#887766', description: 'Smaller asteroid cluster.',
            services: ['mining'],
            dockable: false,
            orbit: { parent: 'sun', radius: 5600, period: Math.round(ORBIT_BASE_TICKS * 550 / 365), angle: Math.PI * 1.6 }
        }
    ];

    // ── Ship components (legacy — kept for backwards compat) ─
    var HULL_TYPES = {
        light:  { name: 'Light Hull',  hp: 100, maxSpeed: 1.4, slots: 4, cost: 0,    metal: 0 },
        medium: { name: 'Medium Hull', hp: 200, maxSpeed: 1.0, slots: 6, cost: 5000, metal: 200 },
        heavy:  { name: 'Heavy Hull',  hp: 350, maxSpeed: 0.7, slots: 8, cost: 15000, metal: 500 }
    };

    var ENGINE_TYPES = {
        chemical: { name: 'Chemical Engine', speedMult: 1.0, fuelType: 'chemical_propellant', fuelRate: 0.5, cost: 0, electronics: 0 },
        ion:      { name: 'Ion Drive',       speedMult: 1.3, fuelType: 'xenon_gas',          fuelRate: 0.3, cost: 8000, electronics: 100 },
        plasma:   { name: 'Plasma Drive',    speedMult: 1.6, fuelType: 'plasma_cells',       fuelRate: 0.4, cost: 20000, electronics: 250 },
        fusion:   { name: 'Fusion Drive',    speedMult: 2.0, fuelType: 'fusion_cores',       fuelRate: 0.2, cost: 35000, electronics: 350 }
    };

    var WEAPON_TYPES = {
        laser:    { name: 'Laser Cannon',  damage: 25,  range: 250, fireRate: 10, type: 'energy',   cost: 2000,  electronics: 50 },
        missile:  { name: 'Missile Rack',  damage: 55, range: 400, fireRate: 30, type: 'explosive', cost: 3000,  metal: 100 },
        railgun:  { name: 'Railgun',       damage: 70, range: 350, fireRate: 30, type: 'kinetic',  cost: 12000, metal: 200, electronics: 150 },
        torpedo:  { name: 'Torpedo Bay',   damage: 100, range: 500, fireRate: 45, type: 'explosive', cost: 18000, metal: 300, electronics: 200 }
    };

    var SHIELD_TYPES = {
        none:     { name: 'No Shield',      shieldHP: 0,   regenRate: 0,    resist: {}, cost: 0 },
        energy:   { name: 'Energy Shield',  shieldHP: 50,  regenRate: 0.08, resist: { energy: 0.3 }, cost: 3000, electronics: 80 },
        magnetic: { name: 'Magnetic Shield', shieldHP: 80,  regenRate: 0.05, resist: { kinetic: 0.4 }, cost: 8000, electronics: 150 },
        ablative: { name: 'Ablative Armor', shieldHP: 120, regenRate: 0.02, resist: { explosive: 0.5 }, cost: 12000, metal: 200 }
    };

    var SPECIAL_MODULES = {
        diplomatic_suite: { name: 'Diplomatic Suite', effect: 'diplomacy_bonus', value: 0.25, cost: 10000, electronics: 100 },
        stealth:          { name: 'Stealth Module',   effect: 'stealth',         value: 0.5,  cost: 20000, electronics: 300 },
        scanner:          { name: 'Long Scanner',     effect: 'scan_range',      value: 500,  cost: 5000,  electronics: 50 },
        repair_bay:       { name: 'Repair Bay',       effect: 'auto_repair',     value: 0.5,  cost: 8000,  metal: 100, electronics: 50 },
        cargo_expand:     { name: 'Cargo Expansion',  effect: 'cargo_bonus',     value: 100,  cost: 3000,  metal: 150 }
    };

    // ── Block-based ship system ─────────────────────────────
    // Placement rules: 'any' = anywhere valid, 'aft' = bottom row(s), 'edge' = top/side edges, 'core' = interior
    var BLOCK_CAT = { STRUCTURE: 'structure', CORE: 'core', PROPULSION: 'propulsion', WEAPON: 'weapon', DEFENSE: 'defense', POWER: 'power', UTILITY: 'utility' };

    var BLOCK_TYPES = {
        // Structure
        hull_basic:     { code: 'hb', name: 'Basic Hull',      cat: BLOCK_CAT.STRUCTURE,   weight: 5,   hp: 30,  powerDraw: 0,  powerGen: 0,  cost: 100,   color: '#556677', placement: 'any', materials: { metal: 2 } },
        hull_armored:   { code: 'ha', name: 'Armored Hull',     cat: BLOCK_CAT.STRUCTURE,   weight: 12,  hp: 80,  powerDraw: 0,  powerGen: 0,  cost: 400,   color: '#778899', placement: 'any', materials: { refined_metals: 3, metal: 2 } },
        // Core (exactly 1 cockpit, at least 1 power core)
        cockpit:        { code: 'ck', name: 'Cockpit',          cat: BLOCK_CAT.CORE,        weight: 8,   hp: 50,  powerDraw: 2,  powerGen: 0,  cost: 0,     color: '#44ddaa', placement: 'core', unique: true, materials: {} },
        power_core:     { code: 'pc', name: 'Power Core',       cat: BLOCK_CAT.CORE,        weight: 10,  hp: 40,  powerDraw: 0,  powerGen: 10, cost: 500,   color: '#ffcc44', placement: 'any', materials: { electronics: 2, metal: 2 } },
        // Propulsion (aft placement = bottom rows)
        engine_chemical:{ code: 'ec', name: 'Chemical Engine',  cat: BLOCK_CAT.PROPULSION,  weight: 8,   hp: 25,  powerDraw: 3,  powerGen: 0,  cost: 300,   color: '#ff8844', placement: 'aft', thrust: 15, fuelType: 'chemical_propellant', fuelRate: 0.33, speedBoost: 0.3, materials: { metal: 3, construction_mats: 1 } },
        engine_ion:     { code: 'ei', name: 'Ion Drive',        cat: BLOCK_CAT.PROPULSION,  weight: 6,   hp: 20,  powerDraw: 5,  powerGen: 0,  cost: 2000,  color: '#44aaff', placement: 'aft', thrust: 20, fuelType: 'xenon_gas', fuelRate: 0.2, speedBoost: 0.6, materials: { electronics: 3, refined_metals: 2, rare_minerals: 1 } },
        engine_plasma:  { code: 'ep', name: 'Plasma Drive',     cat: BLOCK_CAT.PROPULSION,  weight: 10,  hp: 22,  powerDraw: 8,  powerGen: 0,  cost: 5000,  color: '#cc44ff', placement: 'aft', thrust: 30, fuelType: 'plasma_cells', fuelRate: 0.27, speedBoost: 1.0, materials: { advanced_components: 4, rare_minerals: 2, electronics: 3 } },
        engine_fusion:  { code: 'ef', name: 'Fusion Drive',     cat: BLOCK_CAT.PROPULSION,  weight: 14,  hp: 30,  powerDraw: 12, powerGen: 0,  cost: 12000, color: '#ff44aa', placement: 'aft', thrust: 50, fuelType: 'fusion_cores', fuelRate: 0.13, speedBoost: 1.5, materials: { advanced_components: 6, rare_minerals: 4, data_cores: 1 } },
        // Weapons (edge placement = top/side rows)
        weapon_laser:   { code: 'wl', name: 'Laser Cannon',    cat: BLOCK_CAT.WEAPON,      weight: 4,   hp: 20,  powerDraw: 3,  powerGen: 0,  cost: 800,   color: '#ff4444', placement: 'edge', damage: 25,  range: 250, fireRate: 10, dmgType: 'energy', materials: { electronics: 2, refined_metals: 1 } },
        weapon_missile: { code: 'wm', name: 'Missile Rack',    cat: BLOCK_CAT.WEAPON,      weight: 8,   hp: 15,  powerDraw: 2,  powerGen: 0,  cost: 1200,  color: '#ff6644', placement: 'edge', damage: 55, range: 400, fireRate: 30, dmgType: 'explosive', materials: { weapons_components: 2, metal: 2 } },
        weapon_railgun: { code: 'wr', name: 'Railgun',         cat: BLOCK_CAT.WEAPON,      weight: 12,  hp: 25,  powerDraw: 6,  powerGen: 0,  cost: 4000,  color: '#ffaa22', placement: 'edge', damage: 70, range: 350, fireRate: 30, dmgType: 'kinetic', materials: { weapons_components: 5, advanced_components: 2, rare_minerals: 1 } },
        weapon_torpedo: { code: 'wt', name: 'Torpedo Bay',     cat: BLOCK_CAT.WEAPON,      weight: 15,  hp: 20,  powerDraw: 4,  powerGen: 0,  cost: 6000,  color: '#ff2222', placement: 'edge', damage: 100, range: 500, fireRate: 45, dmgType: 'explosive', materials: { weapons_components: 6, advanced_components: 3, data_cores: 1 } },
        // Defense
        shield_basic:   { code: 'sb', name: 'Shield Generator', cat: BLOCK_CAT.DEFENSE,    weight: 6,   hp: 25,  powerDraw: 5,  powerGen: 0,  cost: 1500,  color: '#4466ff', placement: 'any', shieldHP: 50, regenRate: 0.08, materials: { electronics: 2, refined_metals: 2 } },
        shield_heavy:   { code: 'sh', name: 'Heavy Shield',     cat: BLOCK_CAT.DEFENSE,    weight: 12,  hp: 35,  powerDraw: 10, powerGen: 0,  cost: 5000,  color: '#2244cc', placement: 'any', shieldHP: 120, regenRate: 0.05, materials: { shield_components: 6, advanced_components: 2, rare_minerals: 1 } },
        // Power generation
        power_solar:    { code: 'ps', name: 'Solar Panel',      cat: BLOCK_CAT.POWER,      weight: 2,   hp: 10,  powerDraw: 0,  powerGen: 5,  cost: 200,   color: '#88ccff', placement: 'edge', materials: { electronics: 2 } },
        power_fusion_gen:{ code: 'pf', name: 'Fusion Generator', cat: BLOCK_CAT.POWER,     weight: 14,  hp: 30,  powerDraw: 0,  powerGen: 40, cost: 8000,  color: '#ffee44', placement: 'any', fuelType: 'fusion_cores', fuelRate: 0.1, materials: { advanced_components: 5, rare_minerals: 3, electronics: 3 } },
        // Utility
        cargo_bay:      { code: 'cb', name: 'Cargo Bay',        cat: BLOCK_CAT.UTILITY,    weight: 4,   hp: 20,  powerDraw: 0,  powerGen: 0,  cost: 300,   color: '#88aa66', placement: 'any', cargoCapacity: 50, materials: { metal: 3, construction_mats: 1 } },
        fuel_tank:      { code: 'ft', name: 'Fuel Tank',        cat: BLOCK_CAT.UTILITY,    weight: 6,   hp: 15,  powerDraw: 0,  powerGen: 0,  cost: 400,   color: '#aa8844', placement: 'any', fuelCapacity: 180, materials: { metal: 2, construction_mats: 2 } },
        sensor_array:   { code: 'sa', name: 'Sensor Array',     cat: BLOCK_CAT.UTILITY,    weight: 3,   hp: 12,  powerDraw: 2,  powerGen: 0,  cost: 1000,  color: '#44ffaa', placement: 'edge', scanRange: 500, materials: { electronics: 4, data_cores: 1 } },
        repair_bay:     { code: 'rb', name: 'Repair Bay',       cat: BLOCK_CAT.UTILITY,    weight: 8,   hp: 25,  powerDraw: 3,  powerGen: 0,  cost: 2000,  color: '#44cc88', placement: 'any', repairRate: 0.5, materials: { refined_metals: 3, electronics: 2, medical_supplies: 1 } },
        diplo_suite:    { code: 'ds', name: 'Diplomatic Suite',  cat: BLOCK_CAT.UTILITY,   weight: 6,   hp: 20,  powerDraw: 2,  powerGen: 0,  cost: 4000,  color: '#ccaa44', placement: 'any', diploBonus: 0.25, materials: { luxury_goods: 2, electronics: 2, cultural_artifacts: 1 } },
        // Mining equipment
        mining_laser_1: { code: 'm1', name: 'Basic Mining Laser',    cat: BLOCK_CAT.UTILITY,   weight: 5,   hp: 18,  powerDraw: 3,  powerGen: 0,  cost: 600,   color: '#ddaa33', placement: 'edge', miningSpeed: 1.0, miningYield: 1.0, materials: { metal: 3, electronics: 1 } },
        mining_laser_2: { code: 'm2', name: 'Adv Mining Laser',     cat: BLOCK_CAT.UTILITY,   weight: 7,   hp: 22,  powerDraw: 5,  powerGen: 0,  cost: 2500,  color: '#eebb44', placement: 'edge', miningSpeed: 1.8, miningYield: 1.4, materials: { refined_metals: 3, electronics: 3, rare_minerals: 1 } },
        mining_laser_3: { code: 'm3', name: 'Plasma Mining Drill',  cat: BLOCK_CAT.UTILITY,   weight: 10,  hp: 28,  powerDraw: 8,  powerGen: 0,  cost: 7000,  color: '#ffcc55', placement: 'edge', miningSpeed: 3.0, miningYield: 2.0, materials: { advanced_components: 4, rare_minerals: 3, electronics: 4 } }
    };

    // Reverse lookup: code → block type key
    var BLOCK_CODE_MAP = {};
    for (var bk in BLOCK_TYPES) {
        if (BLOCK_TYPES.hasOwnProperty(bk)) BLOCK_CODE_MAP[BLOCK_TYPES[bk].code] = bk;
    }

    // Hull classes define grid size limits and speed caps
    var HULL_CLASSES = {
        fighter:    { name: 'Fighter',     gridW: 5,  gridH: 5,  maxSpeed: 4.0, baseMass: 20,  cost: 0 },
        corvette:   { name: 'Corvette',    gridW: 7,  gridH: 7,  maxSpeed: 3.2, baseMass: 40,  cost: 3000 },
        frigate:    { name: 'Frigate',     gridW: 9,  gridH: 9,  maxSpeed: 2.5, baseMass: 80,  cost: 8000 },
        destroyer:  { name: 'Destroyer',   gridW: 10, gridH: 10, maxSpeed: 2.0, baseMass: 120, cost: 15000 },
        cruiser:    { name: 'Cruiser',     gridW: 12, gridH: 12, maxSpeed: 1.6, baseMass: 200, cost: 30000 },
        battleship: { name: 'Battleship',  gridW: 14, gridH: 14, maxSpeed: 1.2, baseMass: 350, cost: 60000 },
        carrier:    { name: 'Carrier',     gridW: 16, gridH: 16, maxSpeed: 1.0, baseMass: 500, cost: 100000 }
    };

    // ── Resources ────────────────────────────────────────────
    var RESOURCES = {
        credits:             { name: 'Credits',         icon: '💰', tradeable: false },
        // Raw materials
        metal:               { name: 'Metal Ore',       icon: '🔩', tradeable: true,  basePrice: 10, category: 'raw' },
        rare_minerals:       { name: 'Rare Minerals',   icon: '💠', tradeable: true,  basePrice: 35, category: 'raw' },
        water:               { name: 'Water/Ice',       icon: '💧', tradeable: true,  basePrice: 6,  category: 'raw' },
        // Processed goods
        refined_metals:      { name: 'Refined Metals',  icon: '🔧', tradeable: true,  basePrice: 18, category: 'processed' },
        electronics:         { name: 'Electronics',     icon: '💡', tradeable: true,  basePrice: 25, category: 'processed' },
        advanced_components: { name: 'Adv Components',  icon: '⚙️', tradeable: true,  basePrice: 55, category: 'processed' },
        construction_mats:   { name: 'Construction',    icon: '🧱', tradeable: true,  basePrice: 14, category: 'processed' },
        // Consumer goods
        food:                { name: 'Food',            icon: '🍎', tradeable: true,  basePrice: 5,  category: 'consumer' },
        medical_supplies:    { name: 'Medical',         icon: '💊', tradeable: true,  basePrice: 20, category: 'consumer' },
        luxury_goods:        { name: 'Luxury Goods',    icon: '💎', tradeable: true,  basePrice: 50, category: 'consumer' },
        // Military
        weapons_components:  { name: 'Weapon Parts',    icon: '🔫', tradeable: true,  basePrice: 40, category: 'military' },
        shield_components:   { name: 'Shield Parts',    icon: '🛡️', tradeable: true,  basePrice: 38, category: 'military' },
        // Special
        data_cores:          { name: 'Data Cores',      icon: '📀', tradeable: true,  basePrice: 45, category: 'special' },
        cultural_artifacts:  { name: 'Cultural Items',  icon: '🏺', tradeable: true,  basePrice: 60, category: 'special' },
        // Fuel
        chemical_propellant: { name: 'Chem Fuel',       icon: '⛽', tradeable: true,  basePrice: 8,  category: 'fuel' },
        xenon_gas:           { name: 'Xenon Gas',       icon: '🔵', tradeable: true,  basePrice: 15, category: 'fuel' },
        plasma_cells:        { name: 'Plasma Cells',    icon: '🟣', tradeable: true,  basePrice: 20, category: 'fuel' },
        fusion_cores:        { name: 'Fusion Cores',    icon: '☢️', tradeable: true,  basePrice: 40, category: 'fuel' }
    };

    // ── Location Production & Consumption ───────────────────
    // Each location produces certain goods (lowering price) and consumes others (raising price)
    // Production/consumption rates are per production cycle (60 ticks = 6 sec)
    // Earth pop ~2 billion, Mars pop ~100 million (20:1 ratio)
    // Rates reflect relative economic scale, not absolute per-capita
    var LOCATION_ECONOMY = {
        earth: {
            // Earth: Agricultural powerhouse (climate stressed but still dominant),
            // massive industrial base, cultural center. Climate change hurts efficiency.
            // Needs advanced tech from Mars, rare minerals from asteroid belt.
            produces: {
                food: 20,               // Largest food producer by far despite climate issues
                water: 12,              // Desalination plants, still has oceans
                metal: 10,              // Extensive mining operations
                refined_metals: 8,      // Large smelting industry
                construction_mats: 10,  // Massive construction sector
                medical_supplies: 8,    // Strong pharmaceutical industry
                luxury_goods: 6,        // Cultural/manufacturing center
                cultural_artifacts: 5,  // Museums, art, entertainment
                chemical_propellant: 6, // Petrochem industry
                shield_components: 4    // Military R&D
            },
            consumes: {
                electronics: 8,         // Massive demand from 2B population
                advanced_components: 6, // Military and infrastructure needs
                rare_minerals: 7,       // Manufacturing input
                weapons_components: 4,  // War buildup
                data_cores: 4,          // Government/military AI systems
                fusion_cores: 3,        // Power grid and ships
                xenon_gas: 3,           // Ion drives for fleet
                plasma_cells: 2         // Military ships
            },
            stockCapacity: 800
        },
        mars: {
            // Mars: ~100M people in biome domes. Scientifically advanced, unified.
            // Strong in high-tech manufacturing. Weak in food/water (dome agriculture limited).
            // Rich in minerals from Martian crust. More militarized.
            produces: {
                electronics: 12,            // Top electronics manufacturer
                advanced_components: 10,    // Mars's primary export, high-tech labs
                rare_minerals: 6,           // Martian crust mining
                weapons_components: 8,      // Major arms manufacturer
                data_cores: 6,              // AI research hub
                plasma_cells: 5,            // Advanced fuel production
                xenon_gas: 4,               // Atmospheric extraction
                fusion_cores: 4,            // Cutting-edge energy tech
                refined_metals: 4,          // Martian ore processing
                shield_components: 3        // Military tech
            },
            consumes: {
                food: 14,               // Critical need - domes can't grow enough
                water: 10,              // Ice mining helps but not enough for 100M
                medical_supplies: 5,    // Healthcare system needs
                luxury_goods: 4,        // Quality of life demand
                metal: 5,              // Raw materials for manufacturing
                construction_mats: 6,   // Expanding domes and infrastructure
                cultural_artifacts: 2,  // Cultural imports from Earth
                chemical_propellant: 3  // Basic fuel still needed
            },
            stockCapacity: 600
        },
        luna: {
            // Luna Colony: ~8M people. Neutral mining colony on the Moon.
            // Rich in metals (regolith mining), water from ice deposits at poles.
            // Limited manufacturing, depends on imports for food/tech.
            produces: {
                metal: 8,               // Primary industry: regolith mining
                water: 5,              // Polar ice extraction
                construction_mats: 4,   // Processes metal into building materials
                chemical_propellant: 4, // Fuel refinery (low gravity = good for launches)
                refined_metals: 3,      // Small smelting operation
                rare_minerals: 2        // Some found in deep craters
            },
            consumes: {
                food: 6,                // Must import most food
                electronics: 4,         // Mining equipment maintenance
                medical_supplies: 3,    // Healthcare
                luxury_goods: 2,        // Quality of life
                advanced_components: 2, // Equipment upgrades
                weapons_components: 1   // Small defense force
            },
            stockCapacity: 350
        },
        mars_orbital: {
            // Ares Station: ~50K people. Orbital station near Mars, nominally neutral.
            // Research-focused, processes data. Small but strategically important.
            // Mars is trying to convince it to join them.
            produces: {
                data_cores: 4,          // Main output: orbital research data
                xenon_gas: 2,           // Atmospheric skimming from Mars orbit
                electronics: 2          // Small electronics assembly
            },
            consumes: {
                food: 3,                // All imported
                water: 2,              // Recycled but needs top-ups
                metal: 2,              // Station maintenance
                electronics: 2,         // Research equipment
                medical_supplies: 1,    // Small medical bay
                construction_mats: 1,   // Repairs
                chemical_propellant: 1  // Attitude thrusters
            },
            stockCapacity: 180
        },
        station_alpha: {
            // Station Alpha: ~20K people. Independent trading post between Venus & Earth.
            // Specializes in processing rare minerals & trade brokering.
            produces: {
                rare_minerals: 4,       // Processes asteroid captures
                refined_metals: 3,      // Refinery operations
                luxury_goods: 2         // Artisan crafts, zero-G glass
            },
            consumes: {
                food: 2,                // Imported
                water: 2,              // Recycling helps
                electronics: 2,         // Station operations
                medical_supplies: 1,    // Basic healthcare
                metal: 2,              // Refinery inputs
                chemical_propellant: 1  // Ships refueling
            },
            stockCapacity: 150
        },
        station_beta: {
            // Station Beta: ~10K people. Independent refueling depot between Earth & Mars.
            // Primarily a fuel production & waypoint station.
            produces: {
                chemical_propellant: 6, // Main business: fuel production
                xenon_gas: 3,           // Gas processing
                plasma_cells: 2,        // Advanced fuel synthesis
                metal: 2               // Some asteroid capture/processing
            },
            consumes: {
                food: 2,                // Imported
                water: 2,              // Used in fuel processing
                electronics: 1,         // Minimal needs
                construction_mats: 1    // Station upkeep
            },
            stockCapacity: 130
        },
        station_gamma: {
            // Station Gamma: ~10K people. Independent research station near Mercury.
            // Solar energy research, electronics from solar panel manufacturing.
            produces: {
                electronics: 3,             // Solar panel tech spinoffs
                advanced_components: 2,     // Research prototypes
                data_cores: 2,             // Solar physics research data
                fusion_cores: 2            // Experimental fusion from solar proximity
            },
            consumes: {
                food: 2,                // All imported, far from suppliers
                water: 2,              // Critical - very far from ice
                metal: 2,              // Research materials
                medical_supplies: 1,    // Radiation exposure treatment
                rare_minerals: 1,       // Research inputs
                shield_components: 1    // Radiation shielding maintenance
            },
            stockCapacity: 130
        }
    };

    // ── Location Events ───────────────────────────────────────
    // Events temporarily modify production/consumption at locations.
    // prodMod/consMod: multipliers applied to specific resources (1.0 = normal, 2.0 = double, 0.5 = half)
    // duration: in production cycles (each cycle = 60 ticks = 6 seconds)
    // locations: null = can happen anywhere, or array of specific location ids
    // severity: 'minor' (small), 'moderate' (noticeable), 'major' (big impact), 'crisis' (extreme)
    var LOCATION_EVENTS = [
        // ═══ UNIVERSAL EVENTS (can happen anywhere) ═══════════════
        // Food & Water
        { id: 'supply_surplus', name: 'Supply Surplus', description: 'Efficient logistics created a temporary supply surplus.', severity: 'minor', prodMod: { food: 1.5, water: 1.3 }, consMod: {}, duration: 40, locations: null },
        { id: 'food_contamination', name: 'Food Contamination', description: 'A batch of food supplies was contaminated.', severity: 'moderate', prodMod: { food: 0.3 }, consMod: { medical_supplies: 1.5 }, duration: 30, locations: null },
        { id: 'water_recycling_failure', name: 'Water Recycler Failure', description: 'Water recycling systems have malfunctioned.', severity: 'moderate', prodMod: { water: 0.4 }, consMod: { water: 2.0, electronics: 1.3 }, duration: 25, locations: null },
        { id: 'rationing', name: 'Emergency Rationing', description: 'Rationing protocols reduce consumption but hurt morale.', severity: 'moderate', prodMod: {}, consMod: { food: 0.5, water: 0.5, luxury_goods: 2.0 }, duration: 35, locations: null },

        // Trade & Economy
        { id: 'trade_boom', name: 'Trade Boom', description: 'Increased trade activity is boosting the local economy.', severity: 'minor', prodMod: { luxury_goods: 1.5 }, consMod: { electronics: 1.3 }, duration: 50, locations: null },
        { id: 'market_crash', name: 'Market Instability', description: 'Economic uncertainty is causing market disruption.', severity: 'moderate', prodMod: { luxury_goods: 0.5 }, consMod: { luxury_goods: 0.3 }, duration: 30, locations: null },
        { id: 'smuggling_ring', name: 'Smuggling Ring', description: 'Black market activity is draining supplies.', severity: 'minor', prodMod: {}, consMod: { weapons_components: 1.8, rare_minerals: 1.5 }, duration: 40, locations: null },
        { id: 'refugee_influx', name: 'Refugee Influx', description: 'War refugees have arrived, straining resources.', severity: 'moderate', prodMod: {}, consMod: { food: 2.0, water: 1.8, medical_supplies: 1.5, construction_mats: 1.3 }, duration: 45, locations: null },

        // Technology
        { id: 'tech_breakthrough', name: 'Tech Breakthrough', description: 'A research breakthrough has improved manufacturing.', severity: 'moderate', prodMod: { electronics: 1.8, advanced_components: 1.5 }, consMod: { data_cores: 1.5 }, duration: 35, locations: null },
        { id: 'system_virus', name: 'Computer Virus', description: 'A system-wide virus is disrupting production.', severity: 'moderate', prodMod: { electronics: 0.4, data_cores: 0.3 }, consMod: { electronics: 1.5 }, duration: 20, locations: null },
        { id: 'ai_optimization', name: 'AI Optimization', description: 'AI systems have optimized production workflows.', severity: 'minor', prodMod: { refined_metals: 1.3, construction_mats: 1.3 }, consMod: { data_cores: 1.2 }, duration: 60, locations: null },

        // Military & Security
        { id: 'pirate_attacks', name: 'Pirate Attacks', description: 'Increased pirate activity is threatening supply lines.', severity: 'moderate', prodMod: {}, consMod: { weapons_components: 2.0, shield_components: 1.8 }, duration: 35, locations: null },
        { id: 'arms_buildup', name: 'Arms Buildup', description: 'Military tensions are driving weapons demand.', severity: 'minor', prodMod: { weapons_components: 1.5 }, consMod: { metal: 1.5, electronics: 1.3 }, duration: 40, locations: null },
        { id: 'security_lockdown', name: 'Security Lockdown', description: 'A security threat has triggered a lockdown.', severity: 'moderate', prodMod: { luxury_goods: 0.3, cultural_artifacts: 0.2 }, consMod: { weapons_components: 1.5 }, duration: 20, locations: null },

        // Infrastructure
        { id: 'power_grid_upgrade', name: 'Power Grid Upgrade', description: 'Power infrastructure is being upgraded.', severity: 'minor', prodMod: { electronics: 1.3 }, consMod: { construction_mats: 2.0, electronics: 1.5 }, duration: 50, locations: null },
        { id: 'hull_breach_scare', name: 'Hull Integrity Alert', description: 'Structural concerns require immediate maintenance.', severity: 'moderate', prodMod: {}, consMod: { construction_mats: 2.5, metal: 2.0, refined_metals: 1.5 }, duration: 25, locations: null },
        { id: 'efficient_mining', name: 'Mining Efficiency Up', description: 'New techniques have improved mining output.', severity: 'minor', prodMod: { metal: 1.5, rare_minerals: 1.3 }, consMod: {}, duration: 45, locations: null },

        // Medical
        { id: 'disease_outbreak', name: 'Disease Outbreak', description: 'A viral outbreak is sweeping through the population.', severity: 'major', prodMod: { food: 0.7 }, consMod: { medical_supplies: 3.0, water: 1.5 }, duration: 40, locations: null },
        { id: 'medical_research', name: 'Medical Research Grant', description: 'Research funding is boosting medical production.', severity: 'minor', prodMod: { medical_supplies: 1.8 }, consMod: { data_cores: 1.3 }, duration: 50, locations: null },

        // Fuel
        { id: 'fuel_shortage', name: 'Fuel Shortage', description: 'Supply disruptions have caused a fuel shortage.', severity: 'moderate', prodMod: { chemical_propellant: 0.4 }, consMod: {}, duration: 30, locations: null },
        { id: 'fuel_discovery', name: 'Fuel Cache Discovered', description: 'An old fuel depot has been found with reserves.', severity: 'minor', prodMod: { chemical_propellant: 2.0, xenon_gas: 1.5 }, consMod: {}, duration: 25, locations: null },

        // General
        { id: 'worker_strike', name: 'Worker Strike', description: 'Labor disputes have slowed all production.', severity: 'major', prodMod: { metal: 0.4, refined_metals: 0.4, construction_mats: 0.4, electronics: 0.5 }, consMod: {}, duration: 30, locations: null },
        { id: 'cultural_festival', name: 'Cultural Festival', description: 'A celebration is boosting morale and trade.', severity: 'minor', prodMod: { cultural_artifacts: 2.0, luxury_goods: 1.5 }, consMod: { food: 1.5, luxury_goods: 1.3 }, duration: 20, locations: null },
        { id: 'population_boom', name: 'Population Growth', description: 'Population growth is increasing all demands.', severity: 'moderate', prodMod: {}, consMod: { food: 1.5, water: 1.5, medical_supplies: 1.3, construction_mats: 1.5 }, duration: 60, locations: null },

        // ═══ EARTH-SPECIFIC EVENTS ═══════════════════════════════
        { id: 'earth_climate_storm', name: 'Climate Superstorm', description: 'A massive storm has devastated agricultural regions.', severity: 'crisis', prodMod: { food: 0.2, water: 0.5 }, consMod: { construction_mats: 3.0, medical_supplies: 2.0 }, duration: 50, locations: ['earth'] },
        { id: 'earth_harvest_season', name: 'Harvest Season', description: 'Record crop yields across multiple continents.', severity: 'moderate', prodMod: { food: 2.5, water: 1.3 }, consMod: {}, duration: 40, locations: ['earth'] },
        { id: 'earth_political_crisis', name: 'Political Crisis', description: 'Government instability is disrupting operations.', severity: 'major', prodMod: { weapons_components: 0.5, shield_components: 0.5 }, consMod: { luxury_goods: 0.5 }, duration: 35, locations: ['earth'] },
        { id: 'earth_ocean_mining', name: 'Deep Ocean Discovery', description: 'New mineral deposits found in deep ocean trenches.', severity: 'moderate', prodMod: { metal: 2.0, rare_minerals: 1.8 }, consMod: { advanced_components: 1.3 }, duration: 45, locations: ['earth'] },
        { id: 'earth_industrial_boom', name: 'Industrial Renaissance', description: 'New factories coming online across multiple nations.', severity: 'moderate', prodMod: { refined_metals: 2.0, construction_mats: 1.8, chemical_propellant: 1.5 }, consMod: { metal: 2.0, electronics: 1.5 }, duration: 55, locations: ['earth'] },
        { id: 'earth_cultural_golden_age', name: 'Cultural Golden Age', description: 'An artistic movement is flourishing globally.', severity: 'minor', prodMod: { cultural_artifacts: 3.0, luxury_goods: 2.0 }, consMod: {}, duration: 40, locations: ['earth'] },
        { id: 'earth_pandemic', name: 'Global Pandemic', description: 'A new strain is overwhelming healthcare systems.', severity: 'crisis', prodMod: { food: 0.6, refined_metals: 0.5 }, consMod: { medical_supplies: 4.0, water: 2.0 }, duration: 60, locations: ['earth'] },
        { id: 'earth_space_program', name: 'Space Program Expansion', description: 'Massive investment in Earth\'s space fleet.', severity: 'moderate', prodMod: { shield_components: 2.0 }, consMod: { advanced_components: 2.5, electronics: 2.0, fusion_cores: 2.0, metal: 1.5 }, duration: 50, locations: ['earth'] },
        { id: 'earth_green_revolution', name: 'Green Revolution 2.0', description: 'New agricultural technology dramatically boosts yields.', severity: 'major', prodMod: { food: 3.0, medical_supplies: 1.5 }, consMod: { electronics: 1.5, data_cores: 1.3 }, duration: 45, locations: ['earth'] },
        { id: 'earth_earthquake', name: 'Mega-Earthquake', description: 'A devastating earthquake has hit a major industrial zone.', severity: 'major', prodMod: { refined_metals: 0.3, construction_mats: 0.3 }, consMod: { construction_mats: 3.0, medical_supplies: 2.0 }, duration: 35, locations: ['earth'] },
        { id: 'earth_trade_treaty', name: 'Interplanetary Trade Treaty', description: 'New trade agreements are boosting imports.', severity: 'minor', prodMod: {}, consMod: { electronics: 0.7, advanced_components: 0.7 }, duration: 60, locations: ['earth'] },
        { id: 'earth_military_draft', name: 'Military Conscription', description: 'Wartime draft is pulling workers from factories.', severity: 'major', prodMod: { food: 0.6, luxury_goods: 0.4, cultural_artifacts: 0.3 }, consMod: { weapons_components: 2.5, metal: 2.0 }, duration: 45, locations: ['earth'] },
        { id: 'earth_climate_accord', name: 'Climate Restoration Project', description: 'Major climate engineering project begins.', severity: 'moderate', prodMod: { water: 2.0 }, consMod: { advanced_components: 2.0, construction_mats: 2.0, electronics: 1.5 }, duration: 55, locations: ['earth'] },
        { id: 'earth_energy_crisis', name: 'Energy Crisis', description: 'Power grid failures across multiple nations.', severity: 'major', prodMod: { electronics: 0.3, refined_metals: 0.5 }, consMod: { fusion_cores: 3.0, chemical_propellant: 2.0 }, duration: 30, locations: ['earth'] },

        // ═══ MARS-SPECIFIC EVENTS ════════════════════════════════
        { id: 'mars_dome_breach', name: 'Biome Dome Breach', description: 'A dome has been breached, threatening the ecosystem inside.', severity: 'crisis', prodMod: { food: 0.1 }, consMod: { construction_mats: 4.0, shield_components: 2.0, medical_supplies: 2.0 }, duration: 40, locations: ['mars'] },
        { id: 'mars_dust_storm', name: 'Global Dust Storm', description: 'A planet-wide dust storm has reduced solar power and visibility.', severity: 'major', prodMod: { electronics: 0.5, plasma_cells: 0.4 }, consMod: { chemical_propellant: 2.0 }, duration: 50, locations: ['mars'] },
        { id: 'mars_new_dome', name: 'New Dome Constructed', description: 'A new biome dome has started producing food.', severity: 'moderate', prodMod: { food: 2.5, water: 1.5 }, consMod: { construction_mats: 2.0 }, duration: 40, locations: ['mars'] },
        { id: 'mars_weapons_sprint', name: 'Weapons Production Sprint', description: 'Emergency military manufacturing order.', severity: 'moderate', prodMod: { weapons_components: 2.5, plasma_cells: 2.0 }, consMod: { metal: 2.5, rare_minerals: 2.0, electronics: 1.5 }, duration: 35, locations: ['mars'] },
        { id: 'mars_tech_expo', name: 'Mars Tech Expo', description: 'Annual technology exposition drives innovation.', severity: 'minor', prodMod: { advanced_components: 2.0, data_cores: 1.8, electronics: 1.5 }, consMod: { rare_minerals: 1.5 }, duration: 30, locations: ['mars'] },
        { id: 'mars_ice_mining_boom', name: 'Polar Ice Mining Boom', description: 'New polar ice deposits being aggressively mined.', severity: 'moderate', prodMod: { water: 3.0, chemical_propellant: 1.5 }, consMod: { metal: 1.5, electronics: 1.3 }, duration: 45, locations: ['mars'] },
        { id: 'mars_fusion_breakthrough', name: 'Fusion Breakthrough', description: 'Martian scientists achieve a fusion energy milestone.', severity: 'major', prodMod: { fusion_cores: 3.0, plasma_cells: 2.0, advanced_components: 1.5 }, consMod: { rare_minerals: 2.0, data_cores: 2.0 }, duration: 40, locations: ['mars'] },
        { id: 'mars_unification_rally', name: 'Unification Rally', description: 'Political unity drives coordinated economic effort.', severity: 'minor', prodMod: { electronics: 1.5, weapons_components: 1.5, advanced_components: 1.3 }, consMod: {}, duration: 35, locations: ['mars'] },
        { id: 'mars_supply_crisis', name: 'Import Shortage', description: 'Trade disruptions have cut off vital Earth imports.', severity: 'crisis', prodMod: {}, consMod: { food: 0.3, medical_supplies: 0.3 }, duration: 40, locations: ['mars'] },
        { id: 'mars_mining_collapse', name: 'Mine Collapse', description: 'A major mining complex has collapsed.', severity: 'major', prodMod: { rare_minerals: 0.3, metal: 0.4, refined_metals: 0.4 }, consMod: { construction_mats: 2.0, medical_supplies: 1.5 }, duration: 30, locations: ['mars'] },
        { id: 'mars_drone_army', name: 'Automated Fleet Program', description: 'Mars ramps up drone warship production.', severity: 'moderate', prodMod: { weapons_components: 1.8 }, consMod: { electronics: 3.0, advanced_components: 2.5, metal: 2.0 }, duration: 50, locations: ['mars'] },
        { id: 'mars_terraforming_phase', name: 'Terraforming Push', description: 'New terraforming effort increases atmospheric processing.', severity: 'moderate', prodMod: { xenon_gas: 2.5, water: 1.5 }, consMod: { advanced_components: 2.0, construction_mats: 2.0 }, duration: 55, locations: ['mars'] },
        { id: 'mars_scientific_council', name: 'Scientific Council Decree', description: 'The Science Council prioritizes research output.', severity: 'minor', prodMod: { data_cores: 2.5, advanced_components: 1.8 }, consMod: { food: 1.2 }, duration: 40, locations: ['mars'] },

        // ═══ LUNA-SPECIFIC EVENTS ═════════════════════════════════
        { id: 'luna_regolith_strike', name: 'Rich Regolith Vein', description: 'Miners hit an exceptionally rich metal deposit.', severity: 'moderate', prodMod: { metal: 2.5, rare_minerals: 2.0 }, consMod: { electronics: 1.3 }, duration: 40, locations: ['luna'] },
        { id: 'luna_ice_geyser', name: 'Ice Geyser Discovery', description: 'Underground ice geysers found at south pole.', severity: 'moderate', prodMod: { water: 3.0 }, consMod: { construction_mats: 1.5 }, duration: 35, locations: ['luna'] },
        { id: 'luna_neutrality_crisis', name: 'Neutrality Challenged', description: 'Political pressure from both factions is disrupting operations.', severity: 'major', prodMod: { metal: 0.5, construction_mats: 0.5 }, consMod: { weapons_components: 2.0, shield_components: 1.5 }, duration: 30, locations: ['luna'] },
        { id: 'luna_colony_expansion', name: 'Colony Expansion', description: 'New underground habitats being constructed.', severity: 'moderate', prodMod: {}, consMod: { construction_mats: 3.0, electronics: 2.0, metal: 1.5, food: 1.5 }, duration: 50, locations: ['luna'] },
        { id: 'luna_fuel_refinery_upgrade', name: 'Refinery Upgrade', description: 'Fuel refinery capacity has been doubled.', severity: 'moderate', prodMod: { chemical_propellant: 2.5, xenon_gas: 1.5 }, consMod: { electronics: 1.5, metal: 1.3 }, duration: 45, locations: ['luna'] },
        { id: 'luna_meteor_impact', name: 'Meteor Impact Near Colony', description: 'A meteor struck near the colony, exposing rare minerals but damaging infrastructure.', severity: 'major', prodMod: { rare_minerals: 3.0, metal: 1.5 }, consMod: { construction_mats: 2.5, medical_supplies: 1.5 }, duration: 35, locations: ['luna'] },
        { id: 'luna_tourism_boom', name: 'Lunar Tourism Boom', description: 'Low-gravity tourism is bringing in revenue and demand.', severity: 'minor', prodMod: { luxury_goods: 1.5 }, consMod: { food: 1.8, water: 1.5, luxury_goods: 1.5 }, duration: 40, locations: ['luna'] },
        { id: 'luna_mining_strike', name: 'Miners\' Strike', description: 'Lunar miners demand better conditions, halting work.', severity: 'major', prodMod: { metal: 0.2, rare_minerals: 0.2, water: 0.3 }, consMod: {}, duration: 25, locations: ['luna'] },
        { id: 'luna_mass_driver_online', name: 'Mass Driver Online', description: 'New electromagnetic launcher speeds up exports.', severity: 'minor', prodMod: { metal: 1.8, construction_mats: 1.5 }, consMod: { electronics: 1.5 }, duration: 50, locations: ['luna'] },

        // ═══ ARES STATION (mars_orbital) EVENTS ══════════════════
        { id: 'ares_research_grant', name: 'Major Research Grant', description: 'A large research contract boosts data production.', severity: 'moderate', prodMod: { data_cores: 3.0, electronics: 1.5 }, consMod: { rare_minerals: 1.5 }, duration: 40, locations: ['mars_orbital'] },
        { id: 'ares_diplomatic_summit', name: 'Diplomatic Summit', description: 'High-profile peace talks require extra supplies.', severity: 'moderate', prodMod: {}, consMod: { food: 2.5, luxury_goods: 3.0, medical_supplies: 1.5 }, duration: 25, locations: ['mars_orbital'] },
        { id: 'ares_atmosphere_sampling', name: 'Atmosphere Sampling Mission', description: 'Orbital atmospheric scooping runs yield extra xenon.', severity: 'minor', prodMod: { xenon_gas: 2.5 }, consMod: { chemical_propellant: 1.5 }, duration: 35, locations: ['mars_orbital'] },
        { id: 'ares_mars_pressure', name: 'Mars Political Pressure', description: 'Mars is pressuring the station, causing unrest.', severity: 'moderate', prodMod: { data_cores: 0.5 }, consMod: { weapons_components: 2.0, shield_components: 1.5 }, duration: 30, locations: ['mars_orbital'] },
        { id: 'ares_station_renovation', name: 'Station Renovation', description: 'Major upgrades to station infrastructure.', severity: 'moderate', prodMod: { electronics: 0.5 }, consMod: { construction_mats: 3.0, metal: 2.5, electronics: 2.0 }, duration: 45, locations: ['mars_orbital'] },
        { id: 'ares_tourist_delegation', name: 'Delegation Visit', description: 'VIP delegation increases supply demands.', severity: 'minor', prodMod: {}, consMod: { food: 2.0, luxury_goods: 2.5 }, duration: 15, locations: ['mars_orbital'] },
        { id: 'ares_comms_relay', name: 'Communications Hub Upgrade', description: 'New comms array boosts data throughput.', severity: 'minor', prodMod: { data_cores: 2.0 }, consMod: { electronics: 2.0, advanced_components: 1.5 }, duration: 30, locations: ['mars_orbital'] },

        // ═══ STATION ALPHA EVENTS ════════════════════════════════
        { id: 'alpha_asteroid_capture', name: 'Asteroid Capture', description: 'A rare mineral-rich asteroid has been captured nearby.', severity: 'major', prodMod: { rare_minerals: 3.0, metal: 2.0 }, consMod: { chemical_propellant: 2.0 }, duration: 50, locations: ['station_alpha'] },
        { id: 'alpha_trade_caravan', name: 'Trade Caravan Arrival', description: 'A large merchant fleet has arrived bringing supplies.', severity: 'minor', prodMod: { luxury_goods: 2.0, refined_metals: 1.5 }, consMod: {}, duration: 20, locations: ['station_alpha'] },
        { id: 'alpha_refinery_accident', name: 'Refinery Accident', description: 'An explosion has damaged the mineral processing plant.', severity: 'major', prodMod: { rare_minerals: 0.2, refined_metals: 0.3 }, consMod: { construction_mats: 2.5, medical_supplies: 2.0 }, duration: 35, locations: ['station_alpha'] },
        { id: 'alpha_smuggler_bust', name: 'Smuggler Ring Busted', description: 'Security crackdown has disrupted operations briefly.', severity: 'minor', prodMod: { luxury_goods: 0.5 }, consMod: { weapons_components: 1.5 }, duration: 20, locations: ['station_alpha'] },
        { id: 'alpha_artisan_fair', name: 'Zero-G Artisan Fair', description: 'Artisans gather to create unique zero-gravity crafts.', severity: 'minor', prodMod: { luxury_goods: 3.0, cultural_artifacts: 2.0 }, consMod: { rare_minerals: 1.3 }, duration: 25, locations: ['station_alpha'] },
        { id: 'alpha_pirate_raid', name: 'Pirate Raid', description: 'Pirates attacked and stole cargo.', severity: 'moderate', prodMod: { rare_minerals: 0.5, luxury_goods: 0.3 }, consMod: { weapons_components: 2.5, shield_components: 2.0 }, duration: 25, locations: ['station_alpha'] },

        // ═══ STATION BETA EVENTS ═════════════════════════════════
        { id: 'beta_fuel_demand_surge', name: 'Fleet Refueling', description: 'A military fleet stopped for emergency refueling.', severity: 'moderate', prodMod: {}, consMod: { chemical_propellant: 3.0, xenon_gas: 2.5, plasma_cells: 2.0 }, duration: 15, locations: ['station_beta'] },
        { id: 'beta_new_gas_pocket', name: 'Gas Pocket Discovered', description: 'A xenon-rich gas pocket found in nearby space.', severity: 'moderate', prodMod: { xenon_gas: 3.0, chemical_propellant: 1.5 }, consMod: {}, duration: 40, locations: ['station_beta'] },
        { id: 'beta_reactor_overhaul', name: 'Reactor Overhaul', description: 'Fuel reactor maintenance reduces output temporarily.', severity: 'major', prodMod: { chemical_propellant: 0.2, plasma_cells: 0.3 }, consMod: { electronics: 2.0, advanced_components: 1.5 }, duration: 30, locations: ['station_beta'] },
        { id: 'beta_asteroid_haul', name: 'Asteroid Ore Haul', description: 'Mining drones brought in a large metal haul.', severity: 'minor', prodMod: { metal: 3.0 }, consMod: {}, duration: 25, locations: ['station_beta'] },
        { id: 'beta_convoy_stopover', name: 'Trade Convoy Stopover', description: 'Multiple trade ships docking for fuel.', severity: 'minor', prodMod: {}, consMod: { food: 2.0, water: 1.5, chemical_propellant: 2.0 }, duration: 20, locations: ['station_beta'] },
        { id: 'beta_fuel_leak', name: 'Fuel Tank Leak', description: 'A storage tank developed a leak, losing fuel reserves.', severity: 'moderate', prodMod: { chemical_propellant: 0.4, xenon_gas: 0.5 }, consMod: { construction_mats: 2.0 }, duration: 25, locations: ['station_beta'] },

        // ═══ STATION GAMMA EVENTS ════════════════════════════════
        { id: 'gamma_solar_flare', name: 'Solar Flare', description: 'Intense solar activity damages electronics but provides research data.', severity: 'major', prodMod: { electronics: 0.3, data_cores: 2.5 }, consMod: { shield_components: 3.0, electronics: 2.0 }, duration: 20, locations: ['station_gamma'] },
        { id: 'gamma_fusion_test', name: 'Fusion Test Success', description: 'Experimental fusion reactor achieved new efficiency record.', severity: 'moderate', prodMod: { fusion_cores: 3.0, advanced_components: 1.5 }, consMod: { rare_minerals: 2.0, data_cores: 1.5 }, duration: 35, locations: ['station_gamma'] },
        { id: 'gamma_mercury_flyby', name: 'Mercury Research Mission', description: 'Close Mercury flyby yielding valuable data.', severity: 'minor', prodMod: { data_cores: 2.5 }, consMod: { chemical_propellant: 2.0, xenon_gas: 1.5 }, duration: 30, locations: ['station_gamma'] },
        { id: 'gamma_radiation_spike', name: 'Radiation Spike', description: 'Dangerous radiation levels force partial evacuation.', severity: 'crisis', prodMod: { electronics: 0.2, advanced_components: 0.3, fusion_cores: 0.3 }, consMod: { medical_supplies: 3.0, shield_components: 2.5 }, duration: 25, locations: ['station_gamma'] },
        { id: 'gamma_research_consortium', name: 'Research Consortium', description: 'Multiple factions fund a joint research project.', severity: 'moderate', prodMod: { advanced_components: 2.5, electronics: 2.0, data_cores: 2.0 }, consMod: { rare_minerals: 2.0, food: 1.5 }, duration: 45, locations: ['station_gamma'] },
        { id: 'gamma_solar_panel_harvest', name: 'Solar Panel Harvest', description: 'Maximum solar energy collection period.', severity: 'minor', prodMod: { electronics: 2.0, fusion_cores: 1.5 }, consMod: {}, duration: 35, locations: ['station_gamma'] },
        { id: 'gamma_heat_shield_failure', name: 'Heat Shield Degradation', description: 'Solar proximity is degrading station shielding faster than expected.', severity: 'moderate', prodMod: {}, consMod: { shield_components: 2.5, construction_mats: 2.0, refined_metals: 1.5 }, duration: 30, locations: ['station_gamma'] },

        // ═══ MORE UNIVERSAL/MULTI-LOCATION EVENTS ════════════════
        { id: 'solar_storm', name: 'Solar Storm', description: 'A coronal mass ejection disrupts electronics system-wide.', severity: 'major', prodMod: { electronics: 0.4, data_cores: 0.5 }, consMod: { shield_components: 2.0, electronics: 1.5 }, duration: 20, locations: null },
        { id: 'trade_embargo', name: 'Trade Embargo', description: 'Political tensions have caused a trade disruption.', severity: 'moderate', prodMod: {}, consMod: { luxury_goods: 0.3, cultural_artifacts: 0.3 }, duration: 35, locations: null },
        { id: 'construction_boom', name: 'Construction Boom', description: 'Major infrastructure projects require resources.', severity: 'moderate', prodMod: {}, consMod: { construction_mats: 2.5, metal: 2.0, refined_metals: 1.5 }, duration: 45, locations: null },
        { id: 'scientific_discovery', name: 'Scientific Discovery', description: 'A major discovery increases demand for research materials.', severity: 'minor', prodMod: { data_cores: 1.5 }, consMod: { rare_minerals: 1.5, advanced_components: 1.3 }, duration: 35, locations: null },
        { id: 'refugee_wave', name: 'War Refugee Wave', description: 'Large-scale displacement strains all resources.', severity: 'major', prodMod: {}, consMod: { food: 2.5, water: 2.0, medical_supplies: 2.0, construction_mats: 1.5 }, duration: 50, locations: null },
        { id: 'diplomatic_breakthrough', name: 'Diplomatic Thaw', description: 'Briefly improved relations reduce military spending.', severity: 'minor', prodMod: {}, consMod: { weapons_components: 0.4, shield_components: 0.5 }, duration: 30, locations: null },
        { id: 'supply_convoy_lost', name: 'Supply Convoy Lost', description: 'A major supply convoy was destroyed or lost in transit.', severity: 'moderate', prodMod: {}, consMod: { food: 1.5, water: 1.3, electronics: 1.3 }, duration: 25, locations: null },
        { id: 'black_market_surge', name: 'Black Market Surge', description: 'Underground economy is booming, draining visible supply.', severity: 'minor', prodMod: {}, consMod: { weapons_components: 1.5, luxury_goods: 1.5, rare_minerals: 1.3 }, duration: 30, locations: null },
        { id: 'efficiency_drive', name: 'Efficiency Initiative', description: 'New management boosts all production briefly.', severity: 'minor', prodMod: { refined_metals: 1.3, construction_mats: 1.3, electronics: 1.3 }, consMod: {}, duration: 40, locations: null },
        { id: 'holiday_season', name: 'Holiday Season', description: 'Holiday celebrations drive consumer demand.', severity: 'minor', prodMod: { luxury_goods: 1.5 }, consMod: { food: 1.8, luxury_goods: 2.0, cultural_artifacts: 1.5 }, duration: 30, locations: null },
        { id: 'maintenance_window', name: 'Scheduled Maintenance', description: 'Routine maintenance temporarily reduces output.', severity: 'minor', prodMod: { electronics: 0.7, refined_metals: 0.7 }, consMod: { construction_mats: 1.3 }, duration: 20, locations: null },
        { id: 'weapons_recall', name: 'Weapons Systems Recall', description: 'Defective weapons must be replaced, spiking demand.', severity: 'moderate', prodMod: {}, consMod: { weapons_components: 2.5, electronics: 1.5 }, duration: 30, locations: null },
        { id: 'mining_accident', name: 'Mining Disaster', description: 'A mine collapse reduces raw material output.', severity: 'major', prodMod: { metal: 0.3, rare_minerals: 0.4 }, consMod: { medical_supplies: 2.0, construction_mats: 1.5 }, duration: 30, locations: null },
        { id: 'new_trade_route', name: 'New Trade Route', description: 'Discovery of efficient transit path boosts trade.', severity: 'minor', prodMod: { chemical_propellant: 1.3 }, consMod: { xenon_gas: 0.8 }, duration: 50, locations: null },
        { id: 'espionage_scandal', name: 'Espionage Scandal', description: 'A spy scandal increases security spending.', severity: 'moderate', prodMod: {}, consMod: { data_cores: 2.0, weapons_components: 1.5, electronics: 1.3 }, duration: 30, locations: null },

        // ═══ EARTH-MARS SHARED EVENTS ════════════════════════════
        { id: 'battle_aftermath', name: 'Battle Aftermath', description: 'A recent space battle requires repairs and resupply.', severity: 'major', prodMod: {}, consMod: { metal: 2.5, construction_mats: 2.0, shield_components: 2.0, weapons_components: 1.5, medical_supplies: 2.0 }, duration: 35, locations: ['earth', 'mars'] },
        { id: 'arms_race_escalation', name: 'Arms Race Escalation', description: 'Both sides accelerate military production.', severity: 'moderate', prodMod: { weapons_components: 2.0, shield_components: 1.5 }, consMod: { metal: 2.0, electronics: 2.0, advanced_components: 1.5 }, duration: 50, locations: ['earth', 'mars'] },
        { id: 'fleet_mobilization', name: 'Fleet Mobilization', description: 'Military fleets being prepared for deployment.', severity: 'major', prodMod: {}, consMod: { chemical_propellant: 2.5, xenon_gas: 2.0, plasma_cells: 2.0, food: 1.5, weapons_components: 1.5 }, duration: 40, locations: ['earth', 'mars'] },
        { id: 'ceasefire_period', name: 'Temporary Ceasefire', description: 'Brief ceasefire allows focus on civilian needs.', severity: 'minor', prodMod: { food: 1.3, luxury_goods: 1.5 }, consMod: { weapons_components: 0.3, shield_components: 0.3 }, duration: 30, locations: ['earth', 'mars'] },
        { id: 'propaganda_war', name: 'Propaganda War', description: 'Information warfare increases media/data production.', severity: 'minor', prodMod: { data_cores: 1.5, cultural_artifacts: 1.3 }, consMod: { electronics: 1.3 }, duration: 35, locations: ['earth', 'mars'] },

        // ═══ STATION-SHARED EVENTS ═══════════════════════════════
        { id: 'station_power_outage', name: 'Power Systems Failure', description: 'Power failure cripples station operations.', severity: 'major', prodMod: { electronics: 0.2, data_cores: 0.2, advanced_components: 0.2 }, consMod: { fusion_cores: 3.0, electronics: 2.0 }, duration: 20, locations: ['station_alpha', 'station_beta', 'station_gamma', 'mars_orbital'] },
        { id: 'station_life_support', name: 'Life Support Strain', description: 'Life support operating at reduced capacity.', severity: 'major', prodMod: {}, consMod: { water: 3.0, electronics: 2.0, medical_supplies: 1.5 }, duration: 25, locations: ['station_alpha', 'station_beta', 'station_gamma', 'mars_orbital'] },
        { id: 'station_expansion', name: 'Station Module Added', description: 'A new module is being attached, boosting capacity.', severity: 'moderate', prodMod: {}, consMod: { construction_mats: 3.0, metal: 2.5, electronics: 1.5 }, duration: 40, locations: ['station_alpha', 'station_beta', 'station_gamma', 'mars_orbital'] },
        { id: 'station_docking_rush', name: 'Docking Bay Rush', description: 'Unusually high ship traffic increases all demands.', severity: 'minor', prodMod: {}, consMod: { food: 1.8, water: 1.5, chemical_propellant: 2.0 }, duration: 25, locations: ['station_alpha', 'station_beta', 'station_gamma', 'mars_orbital'] }
    ];

    // ── Faction Strategies ──────────────────────────────────
    // Earth leans diplomatic, Mars leans military. Each evaluates and may switch.
    var FACTION_STRATEGIES = {
        earth: [
            // Diplomatic strategies
            { id: 'diplomatic_outreach', name: 'Diplomatic Outreach', type: 'diplomatic', description: 'Send envoys to neutral stations to build alliances', missionTypes: ['diplomatic', 'escort'], goalMetric: 'neutral_influence', weight: 1.5 },
            { id: 'trade_agreements', name: 'Trade Agreements', type: 'economic', description: 'Establish favorable trade deals with neutrals', missionTypes: ['delivery', 'escort'], goalMetric: 'trade_volume', weight: 1.3 },
            { id: 'food_leverage', name: 'Food Leverage', type: 'economic', description: 'Use food surplus as diplomatic leverage', missionTypes: ['delivery', 'diplomatic'], goalMetric: 'food_exports', weight: 1.2 },
            { id: 'peace_initiative', name: 'Peace Initiative', type: 'diplomatic', description: 'Push for ceasefire and peace negotiations', missionTypes: ['diplomatic'], goalMetric: 'peace_progress', weight: 1.4 },
            { id: 'cultural_exchange', name: 'Cultural Exchange', type: 'diplomatic', description: 'Promote cultural understanding between factions', missionTypes: ['delivery', 'diplomatic'], goalMetric: 'cultural_influence', weight: 1.0 },
            { id: 'medical_aid', name: 'Medical Aid Program', type: 'diplomatic', description: 'Provide medical supplies to struggling stations', missionTypes: ['delivery'], goalMetric: 'medical_deliveries', weight: 1.1 },
            { id: 'refugee_support', name: 'Refugee Support', type: 'diplomatic', description: 'Help displaced civilians from the war', missionTypes: ['escort', 'delivery'], goalMetric: 'civilian_aid', weight: 1.0 },
            { id: 'intelligence_network', name: 'Intelligence Network', type: 'covert', description: 'Build spy network to anticipate Mars moves', missionTypes: ['spy'], goalMetric: 'intel_gathered', weight: 0.8 },
            // Military strategies
            { id: 'defensive_buildup', name: 'Defensive Buildup', type: 'military', description: 'Strengthen orbital defenses and patrol routes', missionTypes: ['escort', 'combat'], goalMetric: 'defense_strength', weight: 0.7 },
            { id: 'blockade_mars', name: 'Mars Trade Blockade', type: 'military', description: 'Disrupt Mars supply lines', missionTypes: ['combat', 'sabotage'], goalMetric: 'mars_disruption', weight: 0.5 },
            { id: 'shield_research', name: 'Shield Tech Research', type: 'economic', description: 'Invest in advanced shield technology', missionTypes: ['delivery', 'mining'], goalMetric: 'tech_progress', weight: 0.9 },
            { id: 'luna_courtship', name: 'Luna Courtship', type: 'diplomatic', description: 'Convince Luna Colony to join Earth', missionTypes: ['diplomatic', 'delivery'], goalMetric: 'luna_influence', weight: 1.3 },
            { id: 'supply_stockpile', name: 'Supply Stockpile', type: 'economic', description: 'Build up resource reserves for prolonged conflict', missionTypes: ['mining', 'delivery'], goalMetric: 'stockpile_level', weight: 0.8 },
            { id: 'propaganda_campaign', name: 'Hearts & Minds', type: 'diplomatic', description: 'Win public opinion across neutral stations', missionTypes: ['delivery', 'diplomatic'], goalMetric: 'public_opinion', weight: 1.0 },
            { id: 'economic_sanctions', name: 'Economic Sanctions', type: 'economic', description: 'Pressure neutral stations to stop trading with Mars', missionTypes: ['diplomatic', 'spy'], goalMetric: 'sanction_effect', weight: 0.6 },
            { id: 'convoy_protection', name: 'Convoy Protection', type: 'military', description: 'Protect Earth trade convoys from Mars raiders', missionTypes: ['escort', 'combat'], goalMetric: 'convoy_safety', weight: 0.9 },
            { id: 'tech_sharing', name: 'Technology Sharing', type: 'diplomatic', description: 'Share Earth tech with allies to strengthen bonds', missionTypes: ['delivery', 'diplomatic'], goalMetric: 'ally_strength', weight: 1.1 },
            { id: 'ceasefire_push', name: 'Ceasefire Push', type: 'diplomatic', description: 'Aggressively push for temporary ceasefire', missionTypes: ['diplomatic'], goalMetric: 'ceasefire_progress', weight: 1.2 },
            { id: 'resource_monopoly', name: 'Resource Control', type: 'economic', description: 'Control key resource routes', missionTypes: ['escort', 'delivery'], goalMetric: 'resource_control', weight: 0.7 },
            { id: 'earth_recon', name: 'Recon Operations', type: 'covert', description: 'Scout Mars military positions', missionTypes: ['spy'], goalMetric: 'recon_data', weight: 0.6 },
            { id: 'humanitarian_corridor', name: 'Humanitarian Corridor', type: 'diplomatic', description: 'Establish safe routes for civilian transport', missionTypes: ['escort', 'diplomatic'], goalMetric: 'corridor_safety', weight: 1.0 },
            { id: 'joint_research', name: 'Joint Research', type: 'diplomatic', description: 'Propose joint scientific missions with neutrals', missionTypes: ['delivery', 'diplomatic'], goalMetric: 'research_progress', weight: 0.9 },
            { id: 'earth_strike', name: 'Preemptive Strike', type: 'military', description: 'Launch targeted strikes on Mars outposts', missionTypes: ['combat', 'sabotage'], goalMetric: 'military_damage', weight: 0.4 }
        ],
        mars: [
            // Military strategies
            { id: 'weapons_buildup', name: 'Weapons Buildup', type: 'military', description: 'Accelerate weapons production and deployment', missionTypes: ['mining', 'delivery'], goalMetric: 'weapons_stockpile', weight: 1.5 },
            { id: 'raid_supply_lines', name: 'Raid Supply Lines', type: 'military', description: 'Intercept and raid Earth trade convoys', missionTypes: ['combat', 'sabotage'], goalMetric: 'earth_disruption', weight: 1.3 },
            { id: 'tech_superiority', name: 'Tech Superiority', type: 'military', description: 'Develop next-gen weapons and engines', missionTypes: ['delivery', 'mining'], goalMetric: 'tech_level', weight: 1.4 },
            { id: 'station_courtship', name: 'Ares Station Alliance', type: 'diplomatic', description: 'Convince Ares Station to support Mars', missionTypes: ['diplomatic', 'delivery'], goalMetric: 'station_influence', weight: 1.2 },
            { id: 'mars_offensive', name: 'Military Offensive', type: 'military', description: 'Launch coordinated attacks on Earth positions', missionTypes: ['combat'], goalMetric: 'territory_gained', weight: 1.0 },
            { id: 'sabotage_ops', name: 'Sabotage Operations', type: 'covert', description: 'Infiltrate and sabotage Earth infrastructure', missionTypes: ['sabotage', 'spy'], goalMetric: 'sabotage_success', weight: 1.1 },
            { id: 'espionage_network', name: 'Espionage Network', type: 'covert', description: 'Plant agents in Earth-aligned stations', missionTypes: ['spy'], goalMetric: 'intel_gathered', weight: 0.9 },
            { id: 'resource_raiding', name: 'Resource Raiding', type: 'military', description: 'Seize resources from asteroid fields and convoys', missionTypes: ['combat', 'mining'], goalMetric: 'resources_seized', weight: 1.2 },
            // Economic strategies
            { id: 'food_security', name: 'Food Security', type: 'economic', description: 'Expand biome domes and import food supplies', missionTypes: ['delivery', 'mining'], goalMetric: 'food_reserves', weight: 1.3 },
            { id: 'export_tech', name: 'Technology Exports', type: 'economic', description: 'Sell advanced tech to neutrals for resources', missionTypes: ['delivery'], goalMetric: 'trade_profit', weight: 1.0 },
            { id: 'mining_expansion', name: 'Mining Expansion', type: 'economic', description: 'Expand mining operations in asteroid fields', missionTypes: ['mining', 'escort'], goalMetric: 'mining_output', weight: 0.9 },
            { id: 'self_sufficiency', name: 'Self Sufficiency', type: 'economic', description: 'Reduce dependence on imports', missionTypes: ['mining', 'delivery'], goalMetric: 'import_reduction', weight: 0.8 },
            // Diplomatic strategies
            { id: 'neutral_trade', name: 'Neutral Trade Deals', type: 'diplomatic', description: 'Offer favorable tech trades to neutral stations', missionTypes: ['delivery', 'diplomatic'], goalMetric: 'neutral_deals', weight: 0.7 },
            { id: 'mars_propaganda', name: 'Mars Unity Propaganda', type: 'diplomatic', description: 'Broadcast Mars unity and Earth oppression narrative', missionTypes: ['diplomatic'], goalMetric: 'public_support', weight: 0.8 },
            { id: 'mercenary_hiring', name: 'Mercenary Recruitment', type: 'military', description: 'Hire independent fighters for Mars cause', missionTypes: ['combat', 'escort'], goalMetric: 'merc_fleet_size', weight: 0.9 },
            { id: 'blockade_running', name: 'Blockade Running', type: 'economic', description: 'Smuggle goods past Earth patrols', missionTypes: ['delivery', 'escort'], goalMetric: 'smuggle_success', weight: 0.8 },
            { id: 'defection_program', name: 'Defection Program', type: 'covert', description: 'Recruit Earth scientists and military to defect', missionTypes: ['spy', 'diplomatic'], goalMetric: 'defections', weight: 0.7 },
            { id: 'drone_warfare', name: 'Drone Warfare', type: 'military', description: 'Deploy autonomous combat drones', missionTypes: ['combat'], goalMetric: 'drone_kills', weight: 1.1 },
            { id: 'infrastructure_defense', name: 'Home Defense', type: 'military', description: 'Fortify Mars orbital defenses', missionTypes: ['escort', 'delivery'], goalMetric: 'defense_rating', weight: 1.0 },
            { id: 'biome_expansion', name: 'Biome Expansion', type: 'economic', description: 'Build new biodomes to increase population capacity', missionTypes: ['delivery', 'mining'], goalMetric: 'biome_count', weight: 0.8 },
            { id: 'economic_warfare', name: 'Economic Warfare', type: 'economic', description: 'Undercut Earth prices to steal trade partners', missionTypes: ['delivery', 'spy'], goalMetric: 'market_share', weight: 0.7 },
            { id: 'elite_forces', name: 'Elite Forces Training', type: 'military', description: 'Train specialized combat units', missionTypes: ['combat', 'escort'], goalMetric: 'elite_count', weight: 1.0 },
            { id: 'mars_diplomacy', name: 'Diplomatic Overture', type: 'diplomatic', description: 'Attempt diplomatic resolution on Mars terms', missionTypes: ['diplomatic'], goalMetric: 'diplomatic_wins', weight: 0.5 },
            { id: 'rapid_strike', name: 'Rapid Strike Force', type: 'military', description: 'Hit-and-run attacks on Earth positions', missionTypes: ['combat', 'sabotage'], goalMetric: 'strike_success', weight: 1.2 }
        ]
    };

    // ── Economy ──────────────────────────────────────────────
    var ECONOMY = {
        STARTING_CREDITS: 5000,
        PRICE_VARIANCE: 0.3,            // ±30% random price swing
        SUPPLY_DEMAND_FACTOR: 0.02,     // price change per unit traded
        MISSION_PAY_BASE: 500,
        STATION_BUILD_COST: { credits: 50000, metal: 500, electronics: 200 },
        FLEET_UPKEEP_PER_SHIP: 5,
        PRODUCTION_INTERVAL: 60,        // ticks between production cycles (1 day)
        NPC_TRADE_INTERVAL: 30,         // ticks between NPC trade attempts
        STOCK_DECAY_RATE: 0.001,        // excess stock slowly decays
        EVENT_CHECK_INTERVAL: 300,      // ticks between event checks (~30 sec)
        EVENT_CHANCE: 0.15,             // chance per location per check to trigger event
        MAX_EVENTS_PER_LOCATION: 2      // max simultaneous events at one location
    };

    // ── Diplomacy ────────────────────────────────────────────
    var DIPLOMACY = {
        REP_MIN: -100,
        REP_MAX: 100,
        NEUTRAL_THRESHOLD: 20,          // abs(rep) < this = neutral
        ALLY_THRESHOLD: 60,
        ENEMY_THRESHOLD: -60,
        PEACE_TALK_REP_REQUIRED: 30,    // need this with both sides
        PEACE_ZONES_REQUIRED: 2,
        WAR_CAMPAIGNS_REQUIRED: 3,
        INFLUENCE_PER_MISSION: 5,
        INFLUENCE_DECAY: 0.1,           // per tick
        MOON_STARTING_LEAN: { earth: 8, mars: 0 },      // Earth already courting Moon
        STATION_STARTING_LEAN: { earth: 0, mars: 5 },   // Mars courting station
        // Domination path (hidden third option)
        DOMINATION_REP_REQUIRED: 50,    // rep with neutral factions to flip them
        DOMINATION_FLEET_REQUIRED: 8,   // fleet ships needed for full progress
        DOMINATION_CREDITS_TO_FLIP: 15000, // credits to flip a station
        DOMINATION_MILITARY_THRESHOLD: 60  // player military power needed to declare
    };

    // ── Combat ───────────────────────────────────────────────
    var COMBAT = {
        AGGRO_RANGE: 800,
        DISENGAGE_RANGE: 1200,
        BATTLE_AGGRO_RANGE: 1200,
        PROJECTILE_SPEED: 8,
        EXPLOSION_DURATION: 20,
        LOOT_CHANCE: 0.4,
        XP_PER_KILL: 25
    };

    // ── Fleet ────────────────────────────────────────────────
    var FLEET = {
        MAX_FLEET_SIZE: 10,
        AI_UPDATE_INTERVAL: 5,  // ticks between AI decisions
        FORMATION_SPACING: 60,
        WAR_FLEET_REQUIREMENT: 5  // ships needed for full war progress
    };

    // ── Missions ─────────────────────────────────────────────
    var MISSION_TYPES = {
        delivery:   { name: 'Delivery',   risk: 'low',    payMult: 1.0,  repGain: 3 },
        combat:     { name: 'Combat',     risk: 'high',   payMult: 2.5,  repGain: 8 },
        escort:     { name: 'Escort',     risk: 'medium', payMult: 1.8,  repGain: 5 },
        spy:        { name: 'Espionage',  risk: 'high',   payMult: 3.0,  repGain: -5 },
        sabotage:   { name: 'Sabotage',   risk: 'high',   payMult: 3.5,  repGain: -10 },
        diplomatic: { name: 'Diplomatic', risk: 'low',    payMult: 1.5,  repGain: 10 },
        mining:     { name: 'Mining',     risk: 'low',    payMult: 1.2,  repGain: 1 }
    };

    // ── Station building ─────────────────────────────────────
    var STATION_TYPES = {
        trade_hub:    { name: 'Trade Hub',        income: 500,  influence: 5,  buildTime: 100, cost: { credits: 50000, metal: 500, electronics: 200 } },
        military:     { name: 'Military Outpost', income: 200,  influence: 10, buildTime: 150, cost: { credits: 75000, metal: 800, electronics: 300 } },
        diplomatic:   { name: 'Diplomatic Center', income: 150, influence: 15, buildTime: 120, cost: { credits: 60000, metal: 400, electronics: 250 } },
        refueling:    { name: 'Refueling Depot',  income: 300,  influence: 3,  buildTime: 80,  cost: { credits: 40000, metal: 300, electronics: 150 } }
    };

    // ── Mining ───────────────────────────────────────────────
    var MINING = {
        ACTIVATION_RANGE: 80,           // max distance to mine an asteroid
        PROGRESS_PER_TICK: 0.01,        // base progress per tick (multiplied by miningSpeed)
        FUEL_PER_TICK: 0.05,            // chemical_propellant consumed per mining tick
        ASTEROID_COUNT_CERES: 25,       // minable rocks in Ceres Belt
        ASTEROID_COUNT_VESTA: 15,       // minable rocks in Vesta Field
        ASTEROID_MIN_RESOURCES: 5,      // min total resources per asteroid
        ASTEROID_MAX_RESOURCES: 30,     // max total resources per asteroid
        RESPAWN_TICKS: 6000,            // ~10 minutes to respawn a depleted asteroid
        NPC_MINER_COUNT: 4,             // total NPC miners across all fields
        NPC_MINE_SPEED: 0.005,          // NPC progress per tick
        NPC_CARGO_CAPACITY: 30,
        NPC_DELIVER_INTERVAL: 200,      // ticks between NPC delivery attempts
        PIRATE_SPAWN_CHANCE: 0.002,     // per tick while player is in asteroid field
        RESOURCE_WEIGHTS: {
            // Probability weights for resource types in asteroids
            metal: 40,
            rare_minerals: 20,
            water: 15,
            refined_metals: 10,         // naturally occurring refined veins
            chemical_propellant: 10,    // trapped gases
            xenon_gas: 5
        }
    };

    // Asteroid field definitions — which field has what characteristics
    var ASTEROID_FIELDS = {
        asteroid_belt_1: {
            name: 'Ceres Belt',
            asteroidCount: 25,
            richness: 1.2,              // multiplier on resource amounts
            dangerLevel: 0.3,           // pirate spawn chance multiplier
            resourceOverrides: {        // boost/reduce specific resources
                rare_minerals: 1.5,
                metal: 1.3
            }
        },
        asteroid_belt_2: {
            name: 'Vesta Field',
            asteroidCount: 15,
            richness: 0.9,
            dangerLevel: 0.5,
            resourceOverrides: {
                xenon_gas: 2.0,
                water: 1.5,
                chemical_propellant: 1.3
            }
        }
    };

    // ── Stars (background decoration) ────────────────────────
    var STAR_COUNT = 1200;
    var NEBULA_COUNT = 6;

    // ── Save ─────────────────────────────────────────────────
    var SAVE_VERSION = 2;
    var SAVE_KEY_PREFIX = 'solarDominion_';
    var MAX_SAVE_SLOTS = 5;

    // ── Colors ───────────────────────────────────────────────
    var COLORS = {
        bg: '#0a0a1a',
        stars: '#ffffff',
        grid: 'rgba(40,40,80,0.3)',
        earth: '#4488ff',
        mars: '#dd4422',
        moon: '#cccccc',
        neutral: '#88cc88',
        player: '#00ff88',
        enemy: '#ff4444',
        ally: '#44aaff',
        shield: '#4466ff',
        hud_bg: 'rgba(10,10,30,0.85)',
        hud_border: '#334466',
        hud_text: '#aaccee',
        hud_highlight: '#00ff88',
        panel_bg: 'rgba(15,15,35,0.95)',
        button_bg: '#223355',
        button_hover: '#334477',
        button_active: '#446699'
    };

    // ── Key bindings ─────────────────────────────────────────
    var KEYS = {
        UP: ['ArrowUp', 'KeyW'],
        DOWN: ['ArrowDown', 'KeyS'],
        LEFT: ['ArrowLeft', 'KeyA'],
        RIGHT: ['ArrowRight', 'KeyD'],
        FIRE: ['Space'],
        DOCK: ['KeyE'],
        MAP: ['KeyM'],
        FLEET: ['KeyF'],
        DIPLO: ['KeyG'],
        LOG: ['KeyL'],
        MISSIONS: ['KeyJ'],
        PAUSE: ['KeyP'],
        ESCAPE: ['Escape'],
        SPEED_UP: ['Period'],
        SPEED_DOWN: ['Comma'],
        WEAPON_SWITCH: ['Tab'],
        MINE: ['KeyR']
    };

    return {
        VIEWPORT_W: VIEWPORT_W, VIEWPORT_H: VIEWPORT_H,
        WORLD_W: WORLD_W, WORLD_H: WORLD_H,
        MINIMAP_W: MINIMAP_W, MINIMAP_H: MINIMAP_H,
        TICK_RATE: TICK_RATE, RENDER_FPS: RENDER_FPS,
        AUTOSAVE_INTERVAL: AUTOSAVE_INTERVAL,
        UI_UPDATE_TICKS: UI_UPDATE_TICKS,
        NPC_RESPAWN_INTERVAL: NPC_RESPAWN_INTERVAL,
        NPC_MAX_PATROLS_EARTH: NPC_MAX_PATROLS_EARTH,
        NPC_MAX_PATROLS_MARS: NPC_MAX_PATROLS_MARS,
        NPC_MAX_BATTLE_EARTH: NPC_MAX_BATTLE_EARTH,
        NPC_MAX_BATTLE_MARS: NPC_MAX_BATTLE_MARS,
        NPC_MAX_DIPLOMACY_EARTH: NPC_MAX_DIPLOMACY_EARTH,
        NPC_MAX_DIPLOMACY_MARS: NPC_MAX_DIPLOMACY_MARS,
        NPC_MAX_RESEARCH_EARTH: NPC_MAX_RESEARCH_EARTH,
        NPC_MAX_RESEARCH_MARS: NPC_MAX_RESEARCH_MARS,
        NPC_MAX_MINERS_EARTH: NPC_MAX_MINERS_EARTH,
        NPC_MAX_MINERS_MARS: NPC_MAX_MINERS_MARS,
        NPC_MAX_TRADERS: NPC_MAX_TRADERS,
        BASE_SPEED: BASE_SPEED, ROTATION_SPEED: ROTATION_SPEED,
        FACTION: FACTION, LOC_TYPE: LOC_TYPE, LOCATIONS: LOCATIONS,
        SUN_X: SUN_X, SUN_Y: SUN_Y, ORBIT_BASE_TICKS: ORBIT_BASE_TICKS,
        HULL_TYPES: HULL_TYPES, ENGINE_TYPES: ENGINE_TYPES,
        WEAPON_TYPES: WEAPON_TYPES, SHIELD_TYPES: SHIELD_TYPES,
        SPECIAL_MODULES: SPECIAL_MODULES,
        BLOCK_CAT: BLOCK_CAT, BLOCK_TYPES: BLOCK_TYPES,
        BLOCK_CODE_MAP: BLOCK_CODE_MAP, HULL_CLASSES: HULL_CLASSES,
        RESOURCES: RESOURCES, ECONOMY: ECONOMY,
        LOCATION_ECONOMY: LOCATION_ECONOMY, LOCATION_EVENTS: LOCATION_EVENTS, FACTION_STRATEGIES: FACTION_STRATEGIES,
        DIPLOMACY: DIPLOMACY, COMBAT: COMBAT, FLEET: FLEET,
        MISSION_TYPES: MISSION_TYPES, STATION_TYPES: STATION_TYPES,
        MINING: MINING, ASTEROID_FIELDS: ASTEROID_FIELDS,
        STAR_COUNT: STAR_COUNT, NEBULA_COUNT: NEBULA_COUNT,
        SAVE_VERSION: SAVE_VERSION, SAVE_KEY_PREFIX: SAVE_KEY_PREFIX,
        MAX_SAVE_SLOTS: MAX_SAVE_SLOTS,
        COLORS: COLORS, KEYS: KEYS,
        CALENDAR: CALENDAR
    };
})();
