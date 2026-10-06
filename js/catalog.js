import {
  buildFrigate, buildKestrel, buildWarden, buildPaladin, buildMantis, buildCorvid, buildBastion,
  buildHornet, buildWisp, buildMule, buildAtlas, buildAurora, buildSabre, buildSovereign, buildLeviathan,
  buildTurret, buildGun, buildMissileBay, buildOutfitModel, buildRaider, buildCruiser, buildCutlass, buildReaver, buildRavager, buildCombine,
} from './ships.js';
import { Kit, G, mat } from './geo.js';

export const HULLS = {
  hornet: {
    name: 'Hornet', cls: 'Hornet Light Fighter', price: 160000, build: buildHornet,
    desc: 'Cheap split-wing space-superiority fighter. The smallest warship in the catalogue: two fixed wing guns, a missile bay and the fastest turn rate of any hull.',
    stats: { cargo: 2, bunks: 0, shield: 420, armor: 300, hull: 280, speed: 400, boost: 1080, accel: 200, turn: [2.4, 1.85, 3.8], cap: 650, capRegen: 22, shieldRegen: 16, sig: 0.5 },
    fit: { g: ['blaster', 'auto'], t: [], m: ['swarm'], sys: 1 },
  },
  wisp: {
    name: 'Wisp', cls: 'Wisp Pathfinder Scout', price: 150000, build: buildWisp,
    desc: 'Long-range survey scout with outrigger sensor booms and a dorsal dish. Lightly armed, but the fastest hull in the catalogue with a 45 km lock range.',
    stats: { cargo: 4, bunks: 1, shield: 380, armor: 220, hull: 240, speed: 430, boost: 1200, accel: 190, turn: [2.2, 1.75, 3.6], cap: 900, capRegen: 30, shieldRegen: 18, sig: 0.35, lockRange: 45000 },
    fit: { g: [null], t: ['pulse'], m: [null], sys: 2 },
  },
  mule: {
    name: 'Mule', cls: 'Mule Light Freighter', price: 260000, build: buildMule,
    desc: 'Sixteen-container short-haul freighter with a forward cab. Two defensive turrets and room for a few systems; no missile launchers.',
    stats: { cargo: 180, bunks: 4, shield: 700, armor: 900, hull: 900, speed: 230, boost: 600, accel: 60, turn: [0.9, 0.7, 1.5], cap: 900, capRegen: 24, shieldRegen: 16, sig: 1.6 },
    fit: { w: ['pulse', 'flak'], sys: 4 },
  },
  kestrel: {
    name: 'Kestrel', cls: 'Kestrel Interceptor', price: 220000, build: buildKestrel,
    desc: 'Twin-nacelle interceptor built around raw speed and agility. Light on armour, quick to lock and almost impossible to track.',
    stats: { cargo: 4, bunks: 1, shield: 520, armor: 380, hull: 340, speed: 360, boost: 980, accel: 170, turn: [2.1, 1.65, 3.4], cap: 750, capRegen: 24, shieldRegen: 18, sig: 0.6 },
    fit: { g: ['auto', 'auto'], t: ['pulse'], m: ['srm'], sys: 2 },
  },
  corvid: {
    name: 'Corvid', cls: 'Corvid Stealth Corvette', price: 380000, build: buildCorvid,
    desc: 'Faceted low-observable corvette. The smallest sensor signature in the catalogue — hostiles struggle to lock it, and it slips through fights at speed.',
    stats: { cargo: 8, bunks: 2, shield: 650, armor: 520, hull: 420, speed: 320, boost: 870, accel: 140, turn: [1.8, 1.45, 3.0], cap: 900, capRegen: 28, shieldRegen: 20, sig: 0.45 },
    fit: { g: ['scatter', null], t: ['pulse'], m: ['srm'], sys: 3 },
  },
  valkyrie: {
    name: 'Valkyrie', cls: 'Caldera Assault Frigate', price: 320000, build: buildFrigate,
    desc: 'The UNS workhorse. Balanced shields and armour with a ventral spinal gun mount for heavy weapons.',
    stats: { cargo: 20, bunks: 4, shield: 950, armor: 800, hull: 650, speed: 250, boost: 640, accel: 90, turn: [1.25, 0.95, 2.2], cap: 1000, capRegen: 26, shieldRegen: 22, sig: 1 },
    bays: ['srm', 'srm'], fit: { w: ['blaster', 'pulse', 'rail'], sys: 3 },
  },
  mantis: {
    name: 'Mantis', cls: 'Mantis Heavy Gunship', price: 540000, build: buildMantis,
    desc: 'Forward-swept twin-boom gunship. Heavy forward firepower on the spine, flak mounts on the booms and thick frontal armour.',
    stats: { cargo: 25, bunks: 6, shield: 1150, armor: 1150, hull: 850, speed: 215, boost: 560, accel: 72, turn: [1.0, 0.78, 1.8], cap: 1250, capRegen: 30, shieldRegen: 24, sig: 1.2 },
    fit: { g: ['scatter', 'gauss'], t: ['flak', 'flak'], m: ['srm', 'srm'], sys: 3 },
  },
  warden: {
    name: 'Warden', cls: 'Warden-class Destroyer', price: 780000, build: buildWarden,
    desc: 'Helion Yards line destroyer. Two spinal guns, three turrets and twin missile bays on an armoured slab hull, heavy sponson armour and a deep capacitor.',
    stats: { cargo: 40, bunks: 12, shield: 1800, armor: 1700, hull: 1300, speed: 165, boost: 410, accel: 42, turn: [0.62, 0.5, 1.1], cap: 1800, capRegen: 40, shieldRegen: 32, sig: 1.8 },
    fit: { g: ['auto', 'rail'], t: ['pulse', 'pulse', 'flak'], m: ['srm', 'srm'], sys: 4 },
  },
  sabre: {
    name: 'Sabre', cls: 'Sabre-class Light Cruiser', price: 1050000, build: buildSabre,
    desc: 'Wedge-hulled light cruiser bridging destroyers and heavy cruisers. Two nose guns, three turrets and two missile bays, quick for its size.',
    stats: { cargo: 50, bunks: 18, shield: 2200, armor: 2100, hull: 1600, speed: 150, boost: 380, accel: 36, turn: [0.54, 0.43, 0.95], cap: 2100, capRegen: 44, shieldRegen: 36, sig: 2.0 },
    fit: { g: ['gauss', 'auto'], t: ['heavypulse', 'pulse', 'pulse'], m: ['srm', 'srm'], sys: 4 },
  },
  aurora: {
    name: 'Aurora', cls: 'Aurora Starlines Passenger Liner', price: 1100000, build: buildAurora,
    desc: 'Luxury passenger liner with three lit decks and an observation dome. Huge shields for its class, two point-defence turrets and no missile launchers.',
    stats: { cargo: 60, bunks: 160, shield: 2600, armor: 1300, hull: 1600, speed: 140, boost: 360, accel: 28, turn: [0.42, 0.34, 0.75], cap: 2000, capRegen: 45, shieldRegen: 50, sig: 2.4 },
    fit: { g: [], t: ['pulse', 'pulse', 'flak'], m: [], sys: 5 },
  },
  atlas: {
    name: 'Atlas', cls: 'Atlas Bulk Freighter', price: 950000, build: buildAtlas,
    desc: 'Deep-space bulk hauler: a truss spine racked with sixty-odd containers behind a command module. Tough and slow, three turrets, roomy internals, no launchers.',
    stats: { cargo: 720, bunks: 8, shield: 1600, armor: 2600, hull: 2800, speed: 120, boost: 290, accel: 20, turn: [0.36, 0.29, 0.6], cap: 1600, capRegen: 32, shieldRegen: 24, sig: 3.2 },
    fit: { w: ['flak', 'pulse', 'flak'], sys: 6 },
  },
  bastion: {
    name: 'Bastion', cls: 'Bastion-class Heavy Cruiser', price: 1450000, build: buildBastion,
    desc: 'Armour-ringed heavy cruiser with twin hangar pods. Two guns, four turrets, two missile bays and plenty of outfit space on a broad armoured deck — a flying fortress that still turns faster than a battlecruiser.',
    stats: { cargo: 80, bunks: 30, shield: 2700, armor: 2900, hull: 2100, speed: 130, boost: 330, accel: 30, turn: [0.45, 0.37, 0.8], cap: 2600, capRegen: 52, shieldRegen: 44, sig: 2.4 },
    fit: { g: ['auto', 'gauss'], t: ['flak', 'flak', 'pulse', 'pulse'], m: ['srm', 'srm'], sys: 5 },
  },
  paladin: {
    name: 'Paladin', cls: 'Paladin-class Battlecruiser', price: 2400000, build: buildPaladin,
    desc: 'Flagship-grade battlecruiser. Four spinal guns, four turrets, layered armour decks and a command superstructure — slow, but it hits like a station.',
    stats: { cargo: 100, bunks: 40, shield: 3600, armor: 3800, hull: 2800, speed: 110, boost: 270, accel: 22, turn: [0.34, 0.28, 0.6], cap: 3200, capRegen: 65, shieldRegen: 55, sig: 3 },
    fit: { g: ['rail', 'rail', 'blaster', 'blaster'], t: ['heavypulse', 'heavypulse', 'flak', 'flak'], m: ['srm', 'srm'], sys: 5 },
  },
  sovereign: {
    name: 'Sovereign', cls: 'Sovereign-class Battleship', price: 4200000, build: buildSovereign,
    desc: 'Ship-of-the-line battleship with a dorsal gun deck, armoured belts and a towering command bridge. Two spinal guns, seven turrets, three missile bays and deep outfit space.',
    stats: { cargo: 140, bunks: 60, shield: 5200, armor: 5600, hull: 4200, speed: 90, boost: 220, accel: 15, turn: [0.24, 0.2, 0.42], cap: 4600, capRegen: 85, shieldRegen: 75, sig: 4 },
    fit: { g: ['rail', 'rail'], t: ['heavypulse', 'heavypulse', 'heavypulse', 'beam', 'beam', 'flak', 'flak'], m: ['torp', 'srm', 'srm'], sys: 6 },
  },
  leviathan: {
    name: 'Leviathan', cls: 'Leviathan-class Superheavy Dreadnought', price: 9500000, build: buildLeviathan,
    desc: 'The largest hull Helion Yards will sell: a 270 m dreadnought built around a spinal siege lance. Four spinal guns, eight turrets, four missile bays, vast outfit space and armour measured in metres. It turns like a moon.',
    stats: { cargo: 220, bunks: 90, shield: 9000, armor: 10000, hull: 7500, speed: 70, boost: 175, accel: 10, turn: [0.17, 0.14, 0.3], cap: 8000, capRegen: 130, shieldRegen: 120, sig: 6 },
    fit: { g: ['plasma', 'plasma', 'rail', 'rail'], t: ['heavypulse', 'heavypulse', 'heavypulse', 'heavypulse', 'beam', 'beam', 'flak', 'flak'], m: ['torp', 'torp', 'srm', 'srm'], sys: 7 },
  },
  raider: {
    name: 'Raider', cls: 'Corsair Raider', price: 140000, build: (env) => buildRaider(env), pirate: true,
    desc: 'The Clans\' standard swept-blade fighter. Cheap, fast and fragile, with two wing guns. Sold only at pirate ports.',
    stats: { cargo: 6, bunks: 1, shield: 380, armor: 300, hull: 300, speed: 385, boost: 1050, accel: 185, turn: [2.3, 1.75, 3.6], cap: 700, capRegen: 22, shieldRegen: 15, sig: 0.6 },
    fit: { w: ['blaster', 'auto'], sys: 1 },
  },
  cutlass: {
    name: 'Cutlass', cls: 'Cutlass Scrap Gunboat', price: 190000, build: buildCutlass, pirate: true,
    desc: 'Welded together from salvaged fighter sections: mismatched engines, a bolted armour plate and ram blades on the wingtips. Tougher than it looks.',
    stats: { cargo: 12, bunks: 2, shield: 560, armor: 560, hull: 440, speed: 340, boost: 920, accel: 150, turn: [1.9, 1.5, 3.1], cap: 800, capRegen: 24, shieldRegen: 16, sig: 0.75 },
    fit: { w: ['scatter', 'blaster'], sys: 2 },
  },
  reaver: {
    name: 'Reaver', cls: 'Reaver Boarding Frigate', price: 620000, build: buildReaver, pirate: true,
    desc: 'Spiked assault frigate with a reinforced ram prow and a boarding crew hold. Two guns, two turrets and two missile bays; the Clans use it to run down freighters.',
    stats: { cargo: 60, bunks: 14, shield: 1300, armor: 1750, hull: 1150, speed: 225, boost: 610, accel: 76, turn: [1.0, 0.8, 1.8], cap: 1400, capRegen: 32, shieldRegen: 22, sig: 1.4 },
    bays: ['srm', 'srm'], fit: { w: ['gauss', 'pulse', 'flak', 'auto'], sys: 3 },
  },
  marauder: {
    name: 'Marauder', cls: 'Corsair Marauder Cruiser', price: 1600000, build: (env) => buildCruiser(env, true), pirate: true,
    desc: 'A converted ore carrier with armour belts, side hangars and a tall bridge tower. Slow, but its holds swallow whole cargo convoys.',
    stats: { cargo: 260, bunks: 40, shield: 2400, armor: 3200, hull: 2600, speed: 120, boost: 300, accel: 24, turn: [0.38, 0.31, 0.66], cap: 2600, capRegen: 50, shieldRegen: 34, sig: 3 },
    bays: ['torp', 'srm'], fit: { w: ['heavypulse', 'heavypulse', 'flak', 'pulse', 'pulse'], sys: 5 },
  },
  ravager: {
    name: 'Ravager', cls: 'Ravager Clan Warlord Battleship', price: 5200000, build: buildRavager, pirate: true,
    desc: 'A warlord\'s flagship: a forked siege prow, a salvaged command tower and slabs of stolen armour welded over everything. Seven turrets, a spinal gun and two missile bays. Feared across the frontier.',
    stats: { cargo: 300, bunks: 80, shield: 6000, armor: 8000, hull: 6200, speed: 85, boost: 210, accel: 13, turn: [0.22, 0.18, 0.38], cap: 5200, capRegen: 95, shieldRegen: 70, sig: 5 },
    bays: ['torp', 'torp'], fit: { w: ['heavypulse', 'heavypulse', 'beam', 'heavypulse', 'flak', 'beam', 'flak', 'plasma'], sys: 6 },
  },
};

Object.assign(HULLS, {
  unit: {
    name: 'Unit-7', cls: 'Combine Unit-7 Drone Fighter', price: 70000, build: (env, liv) => buildCombine(env, 'unit', liv), corp: true,
    desc: 'Stamped out by the thousand at Vanta Prime: two box sections, a pair of stub wings and two square engine pods. Cheap to buy, cheap to lose, and it handles like it.',
    stats: { cargo: 2, bunks: 0, shield: 300, armor: 220, hull: 200, speed: 350, boost: 880, accel: 160, turn: [1.9, 1.5, 3.0], cap: 500, capRegen: 16, shieldRegen: 10, sig: 0.55 },
    bays: [null], fit: { w: ['blaster', 'auto'], sys: 1 },
  },
  enforcer: {
    name: 'Enforcer', cls: 'Combine Enforcer Security Frigate', price: 180000, build: (env, liv) => buildCombine(env, 'enforcer', liv), corp: true,
    desc: 'The Combine Security patrol frigate: four identical hull blocks, bolt-on sponsons and four square engine pods. Built to a budget, so the armour is thin and the reactor is small.',
    stats: { cargo: 18, bunks: 4, shield: 800, armor: 700, hull: 600, speed: 230, boost: 560, accel: 68, turn: [0.95, 0.75, 1.7], cap: 1000, capRegen: 22, shieldRegen: 14, sig: 1.0 },
    bays: ['srm'], fit: { w: ['pulse', 'pulse', 'auto'], sys: 2 },
  },
  crate: {
    name: 'Crate', cls: 'Combine Crate-class Container Hauler', price: 380000, build: (env, liv) => buildCombine(env, 'crate', liv), corp: true,
    desc: 'A cab, a spine and twenty standard containers. Huge hold for the price, but sluggish and lightly protected.',
    stats: { cargo: 480, bunks: 4, shield: 700, armor: 900, hull: 900, speed: 120, boost: 290, accel: 18, turn: [0.32, 0.26, 0.55], cap: 900, capRegen: 18, shieldRegen: 12, sig: 2.6 },
    fit: { w: ['pulse', null], sys: 3 },
  },
  commuter: {
    name: 'Commuter', cls: 'Combine Commuter Labour Transport', price: 520000, build: (env, liv) => buildCombine(env, 'commuter', liv), corp: true,
    desc: 'A 110 m box of stacked bunks that ships contract workers between company towns. Two hundred berths and no comforts.',
    stats: { cargo: 40, bunks: 200, shield: 900, armor: 800, hull: 900, speed: 130, boost: 300, accel: 20, turn: [0.3, 0.25, 0.5], cap: 1000, capRegen: 20, shieldRegen: 12, sig: 2.8 },
    fit: { w: ['pulse', null], sys: 4 },
  },
  compliance: {
    name: 'Compliance', cls: 'Combine Compliance Cruiser', price: 620000, build: (env, liv) => buildCombine(env, 'compliance', liv), corp: true,
    desc: 'The heaviest thing Combine Security flies: a cruiser-sized stack of standard blocks with a bridge tower, four turrets, a gun and two missile bays. Half the price of a Sabre, and it shows.',
    stats: { cargo: 90, bunks: 30, shield: 1800, armor: 1700, hull: 1400, speed: 140, boost: 340, accel: 28, turn: [0.42, 0.34, 0.75], cap: 1800, capRegen: 34, shieldRegen: 22, sig: 2.2 },
    bays: ['srm', 'srm'], fit: { w: ['pulse', 'pulse', 'pulse', 'flak', 'rail'], sys: 3 },
  },
});

// hull catalogues by shipyard type
export const YARDS = {
  fed: { name: 'Helion Yards hull catalogue', hulls: ['wisp', 'hornet', 'kestrel', 'corvid', 'valkyrie', 'mule', 'mantis', 'warden', 'sabre', 'aurora', 'atlas', 'bastion', 'paladin', 'sovereign', 'leviathan'] },
  light: { name: 'Civilian dealership', hulls: ['wisp', 'hornet', 'kestrel', 'corvid', 'valkyrie', 'mule', 'aurora'] },
  corp: { name: 'Vanta Combine asset catalogue', hulls: ['unit', 'enforcer', 'crate', 'commuter', 'compliance', 'hornet', 'mule'] },
  pirate: { name: 'Clan black-market hulls', hulls: ['raider', 'cutlass', 'reaver', 'marauder', 'ravager', 'hornet', 'mule'] },
};
export const HULL_ORDER = ['wisp', 'hornet', 'kestrel', 'corvid', 'valkyrie', 'mule', 'mantis', 'warden', 'sabre', 'aurora', 'atlas', 'bastion', 'paladin', 'sovereign', 'leviathan', 'raider', 'cutlass', 'reaver', 'marauder', 'ravager', 'unit', 'enforcer', 'crate', 'commuter', 'compliance'];

// mount: gun = forward-fixed with a small gimbal, turret = free-tracking, bay = missile bay (always secondary).
// group is the default firing role: primary = fires automatically at hostiles, secondary = fires on LMB / U. tech: basic (any station) / high (shipyard stations only)
export const OUTFITS = {
  pulse: { name: 'Pulse Laser Turret', type: 'weapon', space: 8, mount: 'turret', group: 'primary', turret: 'laser', price: 45000, tech: 'basic', bolt: 'laser', dmg: 22, rof: 0.16, cap: 6, speed: 3200, range: 5200, track: 2.6, spread: 0.002, profile: 'em', flash: 0x60a0ff, sound: 'laser', desc: 'Twin-barrel pulsed laser turret. Tracks and engages hostiles automatically; cheap on capacitor.' },
  blaster: { name: 'Pulse Blaster', type: 'weapon', space: 8, mount: 'gun', group: 'primary', turret: 'laser', scale: 1.1, price: 60000, tech: 'basic', bolt: 'laser', dmg: 30, rof: 0.18, cap: 7, speed: 3600, range: 5500, track: 3, spread: 0.0015, profile: 'em', flash: 0x60a0ff, sound: 'laser', desc: 'Fixed forward pulse cannon. Fires along the bow and auto-aims when the target is near the reticle.' },
  heavypulse: { name: 'Heavy Pulse Turret', type: 'weapon', space: 18, mount: 'turret', group: 'primary', turret: 'laser', scale: 1.35, price: 190000, tech: 'high', bolt: 'laser', dmg: 46, rof: 0.28, cap: 12, speed: 3400, range: 6500, track: 1.9, spread: 0.0015, profile: 'em', flash: 0x60a0ff, sound: 'laser', desc: 'Up-scaled pulse laser turret with heavier focusing optics. Double the damage per shot; engages automatically.' },
  auto: { name: 'Rotary Autocannon', type: 'weapon', space: 7, mount: 'gun', group: 'primary', turret: 'auto', price: 85000, tech: 'basic', bolt: 'tracer', dmg: 8, rof: 0.065, cap: 0, speed: 2800, range: 3800, track: 3.2, spread: 0.007, profile: 'kinetic', flash: 0xffb050, sound: 'cannon', desc: 'Six-barrel kinetic cannon. Huge rate of fire and no capacitor draw, short range.' },
  rail: { name: 'Railgun', type: 'weapon', space: 14, mount: 'gun', group: 'secondary', turret: 'rail', scale: 0.9, price: 120000, tech: 'basic', hitscan: true, ammo: true, dmg: 175, rof: 1.6, cap: 45, range: 9000, track: 1.6, spread: 0, profile: 'kinetic', flash: 0x80c0ff, sound: 'rail', desc: 'Magnetic coil accelerator firing tungsten slugs at near-instant velocity. Uses rail ammo.' },
  plasma: { name: 'Plasma Lance', type: 'weapon', space: 30, mount: 'gun', group: 'secondary', turret: 'plasma', scale: 0.85, price: 420000, tech: 'high', bolt: 'plasma', dmg: 330, rof: 2.6, cap: 120, speed: 1900, range: 6500, track: 1.3, spread: 0.001, profile: 'thermal', flash: 0x60ffa0, sound: 'plasma', desc: 'Magnetically contained plasma bolt. Devastating thermal damage, slow projectile, heavy capacitor cost.' },
  flak: { name: 'Flak Turret', type: 'weapon', space: 9, mount: 'turret', group: 'primary', turret: 'flak', price: 70000, tech: 'basic', bolt: 'tracer', dmg: 9, pellets: 4, rof: 0.24, cap: 0, speed: 2400, range: 2600, track: 3.4, spread: 0.03, profile: 'kinetic', flash: 0xffb050, sound: 'cannon', desc: 'Twin-barrel flak mount. Bursts of shrapnel shells that shred fast, close targets. Engages automatically.' },
  beam: { name: 'Beam Laser Turret', type: 'weapon', space: 22, mount: 'turret', group: 'primary', turret: 'beam', scale: 1.1, price: 260000, tech: 'high', bolt: 'laser', dmg: 60, rof: 0.45, cap: 16, speed: 5200, range: 8000, track: 1.6, spread: 0.0008, profile: 'em', flash: 0x80b0ff, sound: 'laser', desc: 'Long-focus emitter with a crystal lens. Hard-hitting, very long range turret that engages automatically.' },
  scatter: { name: 'Scatter Cannon', type: 'weapon', space: 8, mount: 'gun', group: 'primary', turret: 'scatter', price: 75000, tech: 'basic', bolt: 'tracer', dmg: 11, pellets: 6, rof: 0.45, cap: 4, speed: 2600, range: 3200, track: 3, spread: 0.035, profile: 'kinetic', flash: 0xffb050, sound: 'cannon', desc: 'Quad-barrel fixed shotgun. A devastating cone of slugs at close range.' },
  gauss: { name: 'Gauss Cannon', type: 'weapon', space: 14, mount: 'gun', group: 'secondary', turret: 'gauss', scale: 0.9, price: 150000, tech: 'basic', bolt: 'tracer', dmg: 140, rof: 1.1, cap: 30, speed: 4600, range: 7000, track: 1.4, spread: 0.0005, profile: 'kinetic', flash: 0xffc070, sound: 'rail', desc: 'Fixed coilgun firing heavy ferrous slugs. Long range, no ammunition required.' },
  srm: { name: 'Missile Bay', type: 'weapon', space: 10, mount: 'bay', group: 'secondary', bay: 'srm', price: 90000, tech: 'basic', tubes: 2, salvo: 2, dmg: 150, rof: 4, mspeed: 850, range: 10000, ammoPer: 1, desc: 'Armoured twin-cell bay of guided anti-ship missiles. Needs a full target lock; fires a pair per salvo.' },
  swarm: { name: 'Swarm Rocket Pod', type: 'weapon', space: 12, mount: 'bay', group: 'secondary', bay: 'swarm', price: 110000, tech: 'basic', tubes: 6, salvo: 4, dmg: 70, rof: 5, mspeed: 1000, range: 8000, ammoPer: 1, desc: 'Six-cell pod of fast, light seekers. Four at a time saturate point defence on small craft.' },
  torp: { name: 'Torpedo Bay', type: 'weapon', space: 26, mount: 'bay', group: 'secondary', bay: 'torp', price: 320000, tech: 'high', tubes: 1, salvo: 1, dmg: 620, rof: 9, mspeed: 620, range: 8000, ammoPer: 3, desc: 'Single heavy anti-capital torpedo. Slow and expensive (3 missiles of ammunition per shot), but it guts cruisers.' },
  shieldext: { name: 'Shield Extender', type: 'utility', cat: 'shield', space: 10, price: 60000, tech: 'basic', mods: { shield: 350 }, desc: '+350 shield HP.' },
  armorplate: { name: 'Reinforced Armor Plates', type: 'utility', cat: 'armor', space: 12, price: 55000, tech: 'basic', mods: { armor: 450, speedMul: 0.94 }, desc: '+450 armor HP, −6% max velocity.' },
  capbattery: { name: 'Capacitor Battery', type: 'utility', cat: 'battery', space: 8, price: 50000, tech: 'basic', mods: { cap: 400 }, desc: '+400 capacitor.' },
  sensor: { name: 'Sensor Booster', type: 'utility', cat: 'sensor', space: 6, price: 70000, tech: 'basic', mods: { lockMul: 0.55, lockRange: 15000 }, desc: '−45% lock time, +15 km lock range.' },
  caprecharger: { name: 'Capacitor Recharger', type: 'utility', cat: 'reactor', space: 10, price: 140000, tech: 'high', mods: { capRegenMul: 1.45 }, desc: '+45% capacitor recharge.' },
  shieldbooster: { name: 'Shield Booster', type: 'utility', cat: 'shield', space: 12, price: 160000, tech: 'high', mods: { shieldRegenMul: 1.8 }, desc: '+80% shield regeneration.' },
  cargopod: { name: 'Expanded Cargo Pod', type: 'utility', cat: 'system', space: 10, price: 40000, tech: 'basic', mods: { cargo: 40 }, desc: '+40 t cargo capacity.' },
  bunkmod: { name: 'Passenger Bunk Module', type: 'utility', cat: 'system', space: 10, price: 45000, tech: 'basic', mods: { bunks: 8 }, desc: '+8 passenger bunks.' },
  overdrive: { name: 'Overdrive Injector', type: 'engine', cat: 'engine', space: 8, thrust: 0, steer: 0, price: 150000, tech: 'high', mods: { speedMul: 1.15, boostMul: 1.1 }, desc: '+15% max velocity, +10% afterburner.' },
  // ---- more guns
  lpulse: { name: 'Light Pulse Gun', type: 'weapon', space: 5, mount: 'gun', group: 'primary', turret: 'laser', scale: 0.85, price: 30000, tech: 'basic', bolt: 'laser', dmg: 16, rof: 0.15, cap: 4, speed: 3400, range: 4800, track: 3.2, spread: 0.002, profile: 'em', flash: 0x60a0ff, sound: 'laser', desc: 'Compact fixed pulse emitter. Weak, but light enough to fit on anything.' },
  massdriver: { name: 'Mass Driver', type: 'weapon', look: 'driver', space: 9, mount: 'gun', group: 'primary', turret: 'gauss', scale: 0.75, price: 55000, tech: 'basic', bolt: 'tracer', dmg: 34, rof: 0.42, cap: 3, speed: 3600, range: 5200, track: 2.6, spread: 0.002, profile: 'kinetic', flash: 0xffc070, sound: 'cannon', desc: 'Simple electromagnetic slug thrower. Steady kinetic damage for almost no capacitor.' },
  ion: { name: 'Ion Cannon', type: 'weapon', look: 'ion', space: 12, mount: 'gun', group: 'primary', turret: 'plasma', scale: 0.7, price: 140000, tech: 'basic', bolt: 'plasma', dmg: 60, rof: 0.6, cap: 18, speed: 2600, range: 5600, track: 2.2, spread: 0.001, profile: 'em', flash: 0x80c0ff, sound: 'plasma', desc: 'Fires charged ion packets that tear through shields.' },
  neutron: { name: 'Neutron Blaster', type: 'weapon', look: 'neutron', space: 24, mount: 'gun', group: 'secondary', turret: 'plasma', scale: 1.0, price: 360000, tech: 'high', bolt: 'plasma', dmg: 210, rof: 1.4, cap: 70, speed: 2300, range: 6000, track: 1.6, spread: 0.001, profile: 'thermal', flash: 0xa0ff80, sound: 'plasma', desc: 'Heavy thermal blaster. Smaller and faster-firing than a Plasma Lance, but still a capacitor hog.' },
  hrail: { name: 'Heavy Railgun', type: 'weapon', space: 24, mount: 'gun', group: 'secondary', turret: 'rail', scale: 1.15, price: 300000, tech: 'high', hitscan: true, ammo: true, dmg: 320, rof: 2.4, cap: 80, range: 11000, track: 1.2, spread: 0, profile: 'kinetic', flash: 0x80c0ff, sound: 'rail', desc: 'Long-barrel coil accelerator for cruisers. Huge alpha strike at extreme range. Uses rail ammo.' },
  shredder: { name: 'Clan Shredder', type: 'weapon', look: 'clan', space: 9, mount: 'gun', group: 'primary', turret: 'scatter', scale: 1.1, price: 50000, tech: 'basic', shop: 'pirate', bolt: 'tracer', dmg: 9, pellets: 8, rof: 0.5, cap: 2, speed: 2400, range: 2800, track: 3, spread: 0.045, profile: 'kinetic', flash: 0xff9040, sound: 'cannon', desc: 'Welded-together shotgun cannon loaded with scrap. Brutal up close. Clan ports only.' },
  autogun: { name: 'Combine Autogun Mk.I', type: 'weapon', space: 6, mount: 'gun', group: 'primary', turret: 'auto', scale: 0.85, price: 40000, tech: 'basic', shop: 'corp', bolt: 'tracer', dmg: 6, rof: 0.08, cap: 0, speed: 2600, range: 3400, track: 3, spread: 0.009, profile: 'kinetic', flash: 0xffb050, sound: 'cannon', desc: 'Mass-produced rotary gun. Cheap, light and mediocre. Combine ports only.' },
  // ---- more turrets
  pd: { name: 'Point-Defense Turret', type: 'weapon', look: 'pd', space: 5, mount: 'turret', group: 'primary', turret: 'flak', scale: 0.75, price: 35000, tech: 'basic', bolt: 'tracer', dmg: 6, pellets: 3, rof: 0.16, cap: 0, speed: 2600, range: 2000, track: 4.5, spread: 0.03, profile: 'kinetic', flash: 0xffb050, sound: 'cannon', desc: 'Tiny fast-slewing flak mount for swatting fighters at knife range.' },
  gatling: { name: 'Gatling Turret', type: 'weapon', look: 'gatling', space: 12, mount: 'turret', group: 'primary', turret: 'auto', price: 95000, tech: 'basic', bolt: 'tracer', dmg: 9, rof: 0.07, cap: 0, speed: 2800, range: 3600, track: 3.0, spread: 0.008, profile: 'kinetic', flash: 0xffb050, sound: 'cannon', desc: 'Rotary cannon on a tracking mount. No capacitor draw.' },
  iont: { name: 'Ion Turret', type: 'weapon', look: 'ion', space: 14, mount: 'turret', group: 'primary', turret: 'laser', scale: 1.15, price: 150000, tech: 'basic', bolt: 'laser', dmg: 40, rof: 0.4, cap: 12, speed: 3000, range: 5800, track: 2.0, spread: 0.0015, profile: 'em', flash: 0x80c0ff, sound: 'laser', desc: 'Tracking ion emitter. Strips shields fast.' },
  hflak: { name: 'Heavy Flak Turret', type: 'weapon', space: 18, mount: 'turret', group: 'primary', turret: 'flak', scale: 1.35, price: 160000, tech: 'high', bolt: 'tracer', dmg: 14, pellets: 6, rof: 0.3, cap: 0, speed: 2400, range: 3200, track: 2.8, spread: 0.035, profile: 'kinetic', flash: 0xffb050, sound: 'cannon', desc: 'Large-calibre flak battery. Walls of shrapnel around the ship.' },
  hbeam: { name: 'Heavy Beam Turret', type: 'weapon', space: 34, mount: 'turret', group: 'secondary', turret: 'beam', scale: 1.4, price: 520000, tech: 'high', bolt: 'laser', dmg: 140, rof: 0.8, cap: 40, speed: 6000, range: 9500, track: 1.2, spread: 0.0006, profile: 'em', flash: 0x80b0ff, sound: 'laser', desc: 'Capital-grade beam emitter. Enormous range and damage, and a mount to match.' },
  mdturret: { name: 'Mass Driver Turret', type: 'weapon', look: 'driver', space: 22, mount: 'turret', group: 'secondary', turret: 'gauss', scale: 1.2, price: 240000, tech: 'high', bolt: 'tracer', dmg: 120, rof: 1.0, cap: 25, speed: 4400, range: 7500, track: 1.4, spread: 0.0006, profile: 'kinetic', flash: 0xffc070, sound: 'rail', desc: 'Turreted heavy coilgun. Slow to traverse, hits hard at long range.' },
  clanburst: { name: 'Clan Burst Turret', type: 'weapon', look: 'clan', space: 12, mount: 'turret', group: 'primary', turret: 'laser', scale: 1.1, price: 70000, tech: 'basic', shop: 'pirate', bolt: 'laser', dmg: 26, rof: 0.14, cap: 9, speed: 3000, range: 4600, track: 2.4, spread: 0.006, profile: 'thermal', flash: 0xff7040, sound: 'laser', desc: 'Overcharged, badly shielded laser. Sprays hot bolts. Clan ports only.' },
  // ---- more missile bays
  hsrm: { name: 'Heavy Missile Bay', type: 'weapon', space: 18, mount: 'bay', group: 'secondary', bay: 'srm', price: 220000, tech: 'high', tubes: 4, salvo: 3, dmg: 200, rof: 5, mspeed: 800, range: 12000, ammoPer: 1, desc: 'Four-cell bay of long-range heavy missiles. Three per salvo.' },
  rocketrack: { name: 'Clan Rocket Rack', type: 'weapon', space: 10, mount: 'bay', group: 'secondary', bay: 'swarm', price: 70000, tech: 'basic', shop: 'pirate', tubes: 6, salvo: 6, dmg: 50, rof: 6, mspeed: 950, range: 6500, ammoPer: 1, desc: 'Open rack of dumb-fire-grade seekers, emptied all at once. Clan ports only.' },
  // ---- engines: thrust drives acceleration and top speed, steer drives turn rate
  ions: { name: 'Ion Thruster S', type: 'engine', cat: 'engine', space: 6, thrust: 10, steer: 10, price: 30000, tech: 'basic', desc: 'Small, reliable ion thruster. Standard on light hulls.' },
  ionm: { name: 'Ion Thruster M', type: 'engine', cat: 'engine', space: 14, thrust: 24, steer: 22, price: 70000, tech: 'basic', desc: 'Mid-size ion thruster for frigates and freighters.' },
  ionl: { name: 'Ion Thruster L', type: 'engine', cat: 'engine', space: 30, thrust: 54, steer: 46, price: 160000, tech: 'basic', desc: 'Large ion thruster block for cruisers.' },
  fuss: { name: 'Fusion Drive S', type: 'engine', cat: 'engine', space: 7, thrust: 14, steer: 12, price: 65000, tech: 'basic', desc: 'Compact fusion drive. More thrust per tonne than ion.' },
  fusm: { name: 'Fusion Drive M', type: 'engine', cat: 'engine', space: 16, thrust: 34, steer: 28, price: 150000, tech: 'high', desc: 'Military fusion drive for frigates and destroyers.' },
  fusl: { name: 'Fusion Drive L', type: 'engine', cat: 'engine', space: 34, thrust: 76, steer: 60, price: 340000, tech: 'high', desc: 'Heavy fusion drive for cruisers and battlecruisers.' },
  capdrive: { name: 'Capital Drive Block', type: 'engine', cat: 'engine', space: 64, thrust: 120, steer: 96, price: 520000, tech: 'basic', desc: 'Huge clustered drive block for battleships and dreadnoughts.' },
  torch: { name: 'Plasma Torch', type: 'engine', cat: 'engine', space: 18, thrust: 30, steer: 12, price: 260000, tech: 'high', mods: { boostMul: 1.3 }, desc: 'Plasma drive with a savage afterburner. Steers poorly.' },
  vector: { name: 'Vector Thruster Array', type: 'engine', cat: 'engine', space: 6, thrust: 2, steer: 18, price: 55000, tech: 'basic', desc: 'Gimballed manoeuvring thrusters. Almost no forward thrust, lots of turn.' },
  salvage: { name: 'Clan Salvage Burner', type: 'engine', cat: 'engine', space: 12, thrust: 22, steer: 16, price: 40000, tech: 'basic', shop: 'pirate', mods: { sigMul: 1.1 }, desc: 'Stripped from a wreck and bolted back together. Cheap thrust, loud signature. Clan ports only.' },
  combinedrive: { name: 'Combine Standard Drive Unit', type: 'engine', cat: 'engine', space: 12, thrust: 16, steer: 13, price: 35000, tech: 'basic', shop: 'corp', desc: 'Cheapest drive in the Combine catalogue. Heavy for its output. Combine ports only.' },
  // ---- reactors
  fission: { name: 'Fission Pile', type: 'utility', cat: 'reactor', model: 'caprecharger', space: 8, price: 40000, tech: 'basic', mods: { capRegen: 8 }, desc: '+8 GJ/s capacitor recharge.' },
  fusionr: { name: 'Fusion Reactor', type: 'utility', cat: 'reactor', model: 'caprecharger', space: 16, price: 110000, tech: 'basic', mods: { capRegen: 20 }, desc: '+20 GJ/s capacitor recharge.' },
  hfusionr: { name: 'Heavy Fusion Reactor', type: 'utility', cat: 'reactor', model: 'caprecharger', space: 34, price: 260000, tech: 'high', mods: { capRegen: 45 }, desc: '+45 GJ/s capacitor recharge.' },
  antimatter: { name: 'Antimatter Core', type: 'utility', cat: 'reactor', model: 'caprecharger', space: 28, price: 650000, tech: 'high', mods: { capRegen: 75 }, desc: '+75 GJ/s capacitor recharge in a smaller package. Very expensive.' },
  scrapreactor: { name: 'Clan Scrap Reactor', type: 'utility', cat: 'reactor', model: 'caprecharger', space: 22, price: 60000, tech: 'basic', shop: 'pirate', mods: { capRegen: 26, sigMul: 1.15 }, desc: '+26 GJ/s, +15% signature from the leaking shielding. Clan ports only.' },
  combinecell: { name: 'Combine Mk.II Power Cell', type: 'utility', cat: 'reactor', model: 'caprecharger', space: 14, price: 50000, tech: 'basic', shop: 'corp', mods: { capRegen: 14 }, desc: '+14 GJ/s capacitor recharge. Combine ports only.' },
  // ---- shields
  shields: { name: 'Light Shield Emitter', type: 'utility', cat: 'shield', model: 'shieldext', space: 5, price: 30000, tech: 'basic', mods: { shield: 180 }, desc: '+180 shield HP.' },
  shieldl: { name: 'Heavy Shield Extender', type: 'utility', cat: 'shield', model: 'shieldext', space: 24, price: 160000, tech: 'basic', mods: { shield: 900 }, desc: '+900 shield HP.' },
  capshield: { name: 'Capital Shield Array', type: 'utility', cat: 'shield', model: 'shieldbooster', space: 55, price: 480000, tech: 'high', mods: { shield: 2400 }, desc: '+2,400 shield HP. Built for capital ships.' },
  adaptive: { name: 'Adaptive Shield Matrix', type: 'utility', cat: 'shield', model: 'shieldbooster', space: 14, price: 300000, tech: 'high', mods: { shield: 450, shieldRegenMul: 1.3 }, desc: '+450 shield HP, +30% shield regeneration.' },
  shieldrech: { name: 'Shield Recharger', type: 'utility', cat: 'shield', model: 'shieldbooster', space: 8, price: 70000, tech: 'basic', mods: { shieldRegen: 12 }, desc: '+12 HP/s shield regeneration.' },
  // ---- armour
  armors: { name: 'Light Armor Plating', type: 'utility', cat: 'armor', model: 'armorplate', space: 6, price: 25000, tech: 'basic', mods: { armor: 200, speedMul: 0.985 }, desc: '+200 armor HP, −1.5% max velocity.' },
  armorh: { name: 'Heavy Armor Slab', type: 'utility', cat: 'armor', model: 'armorplate', space: 30, price: 150000, tech: 'basic', mods: { armor: 1200, speedMul: 0.9 }, desc: '+1,200 armor HP, −10% max velocity.' },
  ablative: { name: 'Ablative Ceramic Plating', type: 'utility', cat: 'armor', model: 'armorplate', space: 14, price: 220000, tech: 'high', mods: { armor: 600 }, desc: '+600 armor HP with no speed penalty.' },
  nanorep: { name: 'Nanite Armor Repairer', type: 'utility', cat: 'armor', model: 'shieldbooster', space: 12, price: 240000, tech: 'high', mods: { armorRegen: 6 }, desc: 'Repairs 6 armor HP/s in flight.' },
  bracing: { name: 'Hull Bracing Frame', type: 'utility', cat: 'armor', model: 'armorplate', space: 10, price: 60000, tech: 'basic', mods: { hull: 350 }, desc: '+350 hull HP.' },
  scrapplate: { name: 'Clan Scrap Plating', type: 'utility', cat: 'armor', model: 'armorplate', space: 20, price: 40000, tech: 'basic', shop: 'pirate', mods: { armor: 750, speedMul: 0.92, sigMul: 1.1 }, desc: '+750 armor HP, −8% max velocity, +10% signature. Clan ports only.' },
  combineplate: { name: 'Combine Pressed Plate', type: 'utility', cat: 'armor', model: 'armorplate', space: 12, price: 30000, tech: 'basic', shop: 'corp', mods: { armor: 380, speedMul: 0.96 }, desc: '+380 armor HP, −4% max velocity. Combine ports only.' },
  // ---- batteries
  bats: { name: 'Small Capacitor Cell', type: 'utility', cat: 'battery', model: 'capbattery', space: 4, price: 20000, tech: 'basic', mods: { cap: 200 }, desc: '+200 capacitor.' },
  batl: { name: 'Capacitor Bank', type: 'utility', cat: 'battery', model: 'capbattery', space: 18, price: 120000, tech: 'basic', mods: { cap: 1000 }, desc: '+1,000 capacitor.' },
  supercell: { name: 'Superconducting Cell', type: 'utility', cat: 'battery', model: 'capbattery', space: 8, price: 230000, tech: 'high', mods: { cap: 800 }, desc: '+800 capacitor in a tiny package.' },
  // ---- sensors
  lrarray: { name: 'Long-Range Sensor Array', type: 'utility', cat: 'sensor', model: 'sensor', space: 14, price: 140000, tech: 'high', mods: { lockRange: 30000 }, desc: '+30 km lock range.' },
  tcomp: { name: 'Targeting Computer', type: 'utility', cat: 'sensor', model: 'sensor', space: 5, price: 90000, tech: 'basic', mods: { lockMul: 0.7 }, desc: '−30% lock time.' },
  ecm: { name: 'ECM Jammer', type: 'utility', cat: 'sensor', model: 'sensor', space: 8, price: 160000, tech: 'high', mods: { sigMul: 0.75 }, desc: '−25% signature: harder to lock, takes less missile damage.' },
  spoofer: { name: 'Clan Signal Spoofer', type: 'utility', cat: 'sensor', model: 'sensor', space: 6, price: 70000, tech: 'basic', shop: 'pirate', mods: { sigMul: 0.85 }, desc: '−15% signature. Clan ports only.' },
  // ---- systems
  cargol: { name: 'Cargo Bay Expansion', type: 'utility', cat: 'system', model: 'cargopod', space: 28, price: 110000, tech: 'basic', mods: { cargo: 120 }, desc: '+120 t cargo capacity.' },
  cabin: { name: 'Luxury Cabin Block', type: 'utility', cat: 'system', model: 'bunkmod', space: 24, price: 160000, tech: 'high', mods: { bunks: 20 }, desc: '+20 passenger bunks.' },
  smuggler: { name: "Smuggler's Compartment", type: 'utility', cat: 'system', model: 'cargopod', space: 6, price: 60000, tech: 'basic', shop: 'pirate', mods: { cargo: 20 }, desc: '+20 t hidden cargo space. Clan ports only.' },

};

export const MOUNT_KEYS = ['g', 't', 'm'];
export const SLOT_KEYS = ['g', 't', 'm', 'e', 'u'];
export const SLOT_MOUNT = { g: 'gun', t: 'turret', m: 'bay' };
const KEY_OF = { gun: 'g', turret: 't', bay: 'm' };
export const SLOT_NAME = { g: 'Gun', t: 'Turret', m: 'Missile bay', e: 'Engine', u: 'System' };
export const OUTFIT_CATS = [['gun', 'Guns'], ['turret', 'Turrets'], ['bay', 'Missile bays'], ['engine', 'Engines'], ['reactor', 'Reactors'], ['shield', 'Shields'], ['armor', 'Armor'], ['battery', 'Batteries'], ['sensor', 'Sensors'], ['system', 'Systems']];
export const catOf = (id) => (OUTFITS[id].type === 'weapon' ? OUTFITS[id].mount : OUTFITS[id].cat);
export const slotAccepts = (k, id) => !!OUTFITS[id] && (k === 'u' ? OUTFITS[id].type === 'utility' : k === 'e' ? OUTFITS[id].type === 'engine' : OUTFITS[id].mount === SLOT_MOUNT[k]);
export const CAP_NAME = { o: 'outfit space', w: 'weapon capacity', e: 'engine capacity' };

const STOCK_ENGINES = {
  hornet: ['ions', 'ions'], wisp: ['fuss', 'fuss'], kestrel: ['fuss', 'fuss', 'vector'], corvid: ['fuss', 'ions'], valkyrie: ['ionm'], mule: ['ionm'],
  mantis: ['ionm', 'ions'], warden: ['ionl'], sabre: ['fusm', 'fusm'], aurora: ['ionl'], atlas: ['ionl', 'ionm'], bastion: ['ionl', 'ionm'], paladin: ['fusl'],
  sovereign: ['capdrive'], leviathan: ['capdrive', 'ionl'], raider: ['salvage'], cutlass: ['salvage'], reaver: ['salvage', 'salvage'],
  marauder: ['salvage', 'salvage', 'salvage'], ravager: ['capdrive', 'salvage'], unit: ['combinedrive'], enforcer: ['combinedrive', 'combinedrive'],
  crate: ['combinedrive', 'combinedrive'], commuter: ['combinedrive', 'combinedrive', 'combinedrive'], compliance: ['combinedrive', 'combinedrive', 'combinedrive'],
};
const ceil5 = (x) => Math.ceil(x / 5) * 5;
const MOUNT_MIN = { g: 7, t: 8, m: 10 };
const sumOf = (ids, f) => ids.reduce((n, id) => n + (id ? OUTFITS[id][f] || 0 : 0), 0);

// Hulls still described with a legacy generic weapon list get typed gun/turret slots from each stock weapon's mount,
// plus missile bays placed on their old launcher points. Capacities are sized so the stock fit leaves some headroom,
// and the stock engines define the hull's rated thrust (its listed speed, acceleration and agility).
for (const [hid, H] of Object.entries(HULLS)) {
  if (H.fit.w) {
    H.hpKinds = H.fit.w.map((id) => (id && OUTFITS[id].mount === 'gun' ? 'g' : 't'));
    H.fit = { g: H.fit.w.filter((_, i) => H.hpKinds[i] === 'g'), t: H.fit.w.filter((_, i) => H.hpKinds[i] === 't'), m: H.bays || [], sys: H.fit.sys };
  }
  const sys = H.fit.sys || 0;
  delete H.fit.sys;
  H.fit.e = STOCK_ENGINES[hid] || ['ionm'];
  H.fit.u = [];
  const w = MOUNT_KEYS.reduce((n, k) => n + H.fit[k].reduce((a, id) => a + Math.max(id ? OUTFITS[id].space : 0, MOUNT_MIN[k]), 0), 0);
  const e = sumOf(H.fit.e, 'space');
  H.cap = { o: ceil5(w + e + sys * 14), w: ceil5(w * 1.15), e: ceil5(e * 1.25) };
  H.rated = { thrust: sumOf(H.fit.e, 'thrust'), steer: sumOf(H.fit.e, 'steer') };
}

export function roleOf(fit, k, i) {
  if (k === 'm') return 'secondary';
  const r = fit.r?.[k]?.[i];
  if (r === 'primary' || r === 'secondary') return r;
  const id = fit[k][i];
  return id ? OUTFITS[id].group : 'primary';
}

export function emptyFit(hullId) {
  const f = HULLS[hullId].fit;
  const d = { g: [...f.g], t: [...f.t], m: [...f.m], e: [...f.e], u: [...f.u] };
  d.r = { g: d.g.map((id) => (id ? OUTFITS[id].group : 'primary')), t: d.t.map((id) => (id ? OUTFITS[id].group : 'primary')) };
  return d;
}

export function bareFit(hullId) {
  const d = emptyFit(hullId);
  for (const k of MOUNT_KEYS) d[k] = d[k].map(() => null);
  d.e = []; d.u = [];
  return d;
}

export const cloneFit = (f) => ({ g: [...f.g], t: [...f.t], m: [...f.m], e: [...f.e], u: [...f.u], r: { g: [...f.r.g], t: [...f.r.t] } });
export const fitItems = (f) => SLOT_KEYS.flatMap((k) => f[k] || []).filter(Boolean);

export function fitLoad(f) {
  const L = { o: 0, w: 0, e: 0 };
  for (const id of fitItems(f)) {
    const O = OUTFITS[id];
    L.o += O.space;
    if (O.type === 'weapon') L.w += O.space;
    if (O.type === 'engine') L.e += O.space;
  }
  return L;
}

export function fitProblem(hullId, f) {
  const C = HULLS[hullId].cap, L = fitLoad(f);
  for (const k of ['w', 'e', 'o']) if (L[k] > C[k]) return `Needs ${L[k] - C[k]} more ${CAP_NAME[k]}`;
  return '';
}

// Validates a saved fit against the hull. Legacy { w, u } fits are redistributed by each weapon's mount; saves without
// engines get the stock engines. Anything without a slot, or beyond the hull's capacities, is pushed to `spare` so the
// caller can return it to the cargo hold.
export function normFit(hullId, f, spare = []) {
  const d = emptyFit(hullId);
  if (!f || typeof f !== 'object') return d;
  const loose = [];
  if (Array.isArray(f.g) || Array.isArray(f.t) || Array.isArray(f.m)) {
    for (const k of MOUNT_KEYS) {
      if (!Array.isArray(f[k])) continue;
      d[k] = d[k].map(() => null);
      f[k].forEach((x, i) => {
        if (x === null || x === undefined) return;
        if (i < d[k].length && slotAccepts(k, x)) d[k][i] = x; else if (OUTFITS[x]) spare.push(x);
      });
    }
    for (const k of ['g', 't']) {
      d.r[k] = d[k].map((id, i) => {
        const v = f.r?.[k]?.[i];
        return v === 'primary' || v === 'secondary' ? v : id ? OUTFITS[id].group : 'primary';
      });
    }
  } else if (Array.isArray(f.w)) {
    d.g = d.g.map(() => null); d.t = d.t.map(() => null);
    for (const x of f.w) {
      if (!x || !OUTFITS[x] || OUTFITS[x].type !== 'weapon') continue;
      const k = KEY_OF[OUTFITS[x].mount];
      const i = d[k] ? d[k].indexOf(null) : -1;
      if (i >= 0) d[k][i] = x; else spare.push(x);
    }
    d.r = { g: d.g.map((id) => (id ? OUTFITS[id].group : 'primary')), t: d.t.map((id) => (id ? OUTFITS[id].group : 'primary')) };
  }
  if (Array.isArray(f.e)) d.e = [];
  if (Array.isArray(f.u)) d.u = [];
  for (const x of [...(Array.isArray(f.e) ? f.e : []), ...(Array.isArray(f.u) ? f.u : [])]) if (x && OUTFITS[x]) loose.push(x);
  for (const x of loose) {
    const t = OUTFITS[x].type;
    if (t === 'engine') d.e.push(x); else if (t === 'utility') d.u.push(x); else spare.push(x);
  }
  const C = HULLS[hullId].cap;
  const over = () => { const L = fitLoad(d); return L.w > C.w ? 'w' : L.e > C.e ? 'e' : L.o > C.o ? 'o' : null; };
  for (let k = over(); k; k = over()) {
    if (k === 'e') { spare.push(d.e.pop()); continue; }
    if (k === 'o' && d.u.length) { spare.push(d.u.pop()); continue; }
    const mk = ['m', 't', 'g'].find((kk) => d[kk].some(Boolean));
    if (mk) { const i = d[mk].map(Boolean).lastIndexOf(true); spare.push(d[mk][i]); d[mk][i] = null; } else if (d.e.length) spare.push(d.e.pop()); else break;
  }
  return d;
}

function socket(M, m, kind) {
  const k = new Kit();
  if (kind === 'm') {
    k.add('dark', G.rbox(2.2, 0.25, 2.2, 0.06), mat([0, 0.12, 0]));
    k.add('metal', G.box(1.6, 0.06, 1.6), mat([0, 0.27, 0]));
    k.add('amber', G.box(0.12, 0.05, 1.7), mat([0.95, 0.26, 0]));
    k.add('amber', G.box(0.12, 0.05, 1.7), mat([-0.95, 0.26, 0]));
  } else if (kind === 'g') {
    k.add('dark', G.rbox(1.3, 0.25, 2.4, 0.08), mat([0, 0.12, -0.2]));
    k.add('metal', G.box(0.9, 0.06, 1.8), mat([0, 0.27, -0.2]));
    k.add('amber', G.box(0.3, 0.05, 0.12), mat([0, 0.26, 1.0]));
  } else {
    k.add('dark', G.cyl(0.95, 1.1, 0.25, 20), mat([0, 0.12, 0]));
    k.add('metal', G.torus(0.7, 0.06, 6, 24), mat([0, 0.27, 0], [Math.PI / 2, 0, 0]));
    k.add('amber', G.box(0.3, 0.05, 0.12), mat([0, 0.26, 0.85]));
  }
  const g = k.build(M);
  g.position.fromArray(m.p);
  if (m.flip) g.rotation.z = Math.PI;
  g.scale.setScalar(m.s);
  return g;
}

// physical mount points for each slot type
export function mountSlots(ship, hullId) {
  if (ship.slots) return ship.slots;
  const H = HULLS[hullId], kinds = H.hpKinds || [];
  const g = [], t = [];
  ship.hardpoints.forEach((hp, i) => (kinds[i] === 'g' ? g : t).push(hp));
  const L = ship.launchers, n = H.fit.m.length;
  const s = Math.min(2.4, Math.max(0.4, ship.radius * 0.028));
  const m = L.length ? Array.from({ length: n }, (_, i) => {
    const o = L[Math.floor((i * L.length) / n)];
    return { p: o.position.toArray(), flip: o.position.y < 0 ? 1 : 0, s };
  }) : [];
  ship.slots = { g, t, m };
  return ship.slots;
}

export function buildFitted(hullId, fit0, env, liv) {
  const fit = fit0 && Array.isArray(fit0.g) && Array.isArray(fit0.e) && fit0.r ? fit0 : normFit(hullId, fit0);
  const ship = HULLS[hullId].build(env, liv);
  const S = mountSlots(ship, hullId);
  for (const k of ['g', 't']) {
    fit[k].forEach((id, i) => {
      const hp = S[k][i];
      if (!hp) return;
      if (!id) { ship.group.add(socket(ship.M, hp, k)); return; }
      const O = OUTFITS[id];
      const t = k === 'g' ? buildGun(ship.M, O.look || O.turret, hp.s * (O.scale || 1)) : buildTurret(ship.M, O.look || O.turret, hp.s * (O.scale || 1));
      t.root.position.fromArray(hp.p);
      if (hp.flip) t.root.rotation.z = Math.PI;
      t.weapon = O; t.mount = SLOT_MOUNT[k]; t.role = roleOf(fit, k, i); t.slot = i;
      ship.group.add(t.root);
      (k === 'g' ? ship.gunMounts : ship.turretMounts).push(t);
      if (k === 't') ship.turrets.push(t);
    });
  }
  fit.m.forEach((id, i) => {
    const hp = S.m[i];
    if (!hp) return;
    if (!id) { ship.group.add(socket(ship.M, hp, 'm')); return; }
    const O = OUTFITS[id];
    const b = buildMissileBay(ship.M, O, hp.s);
    b.root.position.fromArray(hp.p);
    if (hp.flip) b.root.rotation.z = Math.PI;
    b.weapon = O; b.mount = 'bay'; b.role = 'secondary'; b.slot = i;
    ship.group.add(b.root);
    ship.missileBays.push(b);
  });
  return ship;
}

export function outfitPreview(id, M) {
  const O = OUTFITS[id];
  if (O.type !== 'weapon') return buildOutfitModel(O.model || (O.type === 'engine' ? 'engine' : id), M);
  return O.mount === 'bay' ? buildMissileBay(M, O, 1).root : O.mount === 'gun' ? buildGun(M, O.look || O.turret, 1).root : buildTurret(M, O.look || O.turret, 1).root;
}

export function fittedStats(hullId, fit) {
  const H = HULLS[hullId];
  const s = { ...H.stats, turn: [...H.stats.turn], cls: H.cls, lockMul: 1, lockRange: H.stats.lockRange || 30000, armorRegen: 0 };
  const mul = { capRegen: 1, shieldRegen: 1, speed: 1, boost: 1, sig: 1 };
  let thrust = 0, steer = 0;
  for (const id of [...(fit.e || []), ...(fit.u || [])]) {
    const O = OUTFITS[id];
    if (!O) continue;
    const m = O.mods || {};
    thrust += O.thrust || 0; steer += O.steer || 0;
    for (const k of ['shield', 'armor', 'hull', 'cap', 'lockRange', 'cargo', 'bunks', 'capRegen', 'shieldRegen', 'armorRegen']) s[k] += m[k] || 0;
    s.lockMul *= m.lockMul || 1;
    mul.capRegen *= m.capRegenMul || 1; mul.shieldRegen *= m.shieldRegenMul || 1;
    mul.speed *= m.speedMul || 1; mul.boost *= m.boostMul || 1; mul.sig *= m.sigMul || 1;
  }
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const kt = thrust / H.rated.thrust, kv = clamp(Math.sqrt(kt), 0.1, 1.35), kr = clamp(Math.sqrt(steer / H.rated.steer), 0.15, 1.4);
  s.accel = Math.round(s.accel * clamp(kt, 0.05, 2) * 10) / 10;
  s.speed = Math.round(s.speed * kv * mul.speed);
  s.boost = Math.round(s.boost * kv * mul.speed * mul.boost);
  s.turn = s.turn.map((x) => x * kr);
  s.capRegen *= mul.capRegen; s.shieldRegen *= mul.shieldRegen;
  s.sig = Math.round(s.sig * mul.sig * 100) / 100;
  s.thrust = thrust; s.steer = steer;
  return s;
}
