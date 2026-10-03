import { buildFrigate, buildKestrel, buildWarden, buildPaladin, buildMantis, buildCorvid, buildBastion, buildTurret, buildOutfitModel } from './ships.js';
import { Kit, G, mat } from './geo.js';

export const HULLS = {
  kestrel: {
    name: 'Kestrel', cls: 'Kestrel Interceptor', price: 220000, build: buildKestrel,
    desc: 'Twin-nacelle interceptor built around raw speed and agility. Light on armour, quick to lock and almost impossible to track.',
    stats: { shield: 520, armor: 380, hull: 340, speed: 330, boost: 900, accel: 130, turn: [1.6, 1.25, 2.6], cap: 750, capRegen: 24, shieldRegen: 18, sig: 0.6 },
    fit: { w: ['auto', 'pulse'], u: [null, null] },
  },
  corvid: {
    name: 'Corvid', cls: 'Corvid Stealth Corvette', price: 380000, build: buildCorvid,
    desc: 'Faceted low-observable corvette. The smallest sensor signature in the catalogue — hostiles struggle to lock it, and it slips through fights at speed.',
    stats: { shield: 650, armor: 520, hull: 420, speed: 300, boost: 820, accel: 115, turn: [1.45, 1.15, 2.4], cap: 900, capRegen: 28, shieldRegen: 20, sig: 0.45 },
    fit: { w: ['scatter', 'pulse'], u: [null, null, null] },
  },
  valkyrie: {
    name: 'Valkyrie', cls: 'Caldera Assault Frigate', price: 320000, build: buildFrigate,
    desc: 'The UNS workhorse. Balanced shields and armour with a ventral spinal hardpoint for heavy weapons.',
    stats: { shield: 950, armor: 800, hull: 650, speed: 240, boost: 620, accel: 85, turn: [1.15, 0.85, 2.0], cap: 1000, capRegen: 26, shieldRegen: 22, sig: 1 },
    fit: { w: ['blaster', 'pulse', 'rail'], u: [null, null, null] },
  },
  mantis: {
    name: 'Mantis', cls: 'Mantis Heavy Gunship', price: 540000, build: buildMantis,
    desc: 'Forward-swept twin-boom gunship. Heavy forward firepower on the spine, flak mounts on the booms and thick frontal armour.',
    stats: { shield: 1150, armor: 1150, hull: 850, speed: 215, boost: 560, accel: 75, turn: [1.0, 0.78, 1.8], cap: 1250, capRegen: 30, shieldRegen: 24, sig: 1.2 },
    fit: { w: ['scatter', 'gauss', 'flak', 'flak'], u: [null, null, null] },
  },
  warden: {
    name: 'Warden', cls: 'Warden-class Destroyer', price: 780000, build: buildWarden,
    desc: 'Helion Yards line destroyer. Five turret hardpoints on dorsal and ventral spines, heavy sponson armour and a deep capacitor.',
    stats: { shield: 1800, armor: 1700, hull: 1300, speed: 175, boost: 430, accel: 50, turn: [0.75, 0.6, 1.3], cap: 1800, capRegen: 40, shieldRegen: 32, sig: 1.8 },
    fit: { w: ['pulse', 'pulse', 'rail', 'auto', 'auto'], u: [null, null, null, null] },
  },
  bastion: {
    name: 'Bastion', cls: 'Bastion-class Heavy Cruiser', price: 1450000, build: buildBastion,
    desc: 'Armour-ringed heavy cruiser with twin hangar pods. Six hardpoints and five utility slots — a flying fortress that still turns faster than a battlecruiser.',
    stats: { shield: 2700, armor: 2900, hull: 2100, speed: 145, boost: 360, accel: 38, turn: [0.58, 0.48, 1.0], cap: 2600, capRegen: 52, shieldRegen: 44, sig: 2.4 },
    fit: { w: ['auto', 'gauss', 'flak', 'flak', 'pulse', 'pulse'], u: [null, null, null, null, null] },
  },
  paladin: {
    name: 'Paladin', cls: 'Paladin-class Battlecruiser', price: 2400000, build: buildPaladin,
    desc: 'Flagship-grade battlecruiser. Seven large hardpoints, layered armour decks and a command superstructure — slow, but it hits like a station.',
    stats: { shield: 3600, armor: 3800, hull: 2800, speed: 125, boost: 300, accel: 30, turn: [0.45, 0.38, 0.8], cap: 3200, capRegen: 65, shieldRegen: 55, sig: 3 },
    fit: { w: ['heavypulse', 'heavypulse', 'rail', 'rail', 'blaster', 'blaster', 'auto'], u: [null, null, null, null, null] },
  },
};
export const HULL_ORDER = ['kestrel', 'corvid', 'valkyrie', 'mantis', 'warden', 'bastion', 'paladin'];

// mount: turret = auto-fires at hostiles, gun = fixed forward (group: primary = LMB, secondary = RMB). tech: basic (any station) / high (shipyard stations only)
export const OUTFITS = {
  pulse: { name: 'Pulse Laser Turret', type: 'weapon', mount: 'turret', group: 'primary', turret: 'laser', price: 45000, tech: 'basic', bolt: 'laser', dmg: 22, rof: 0.16, cap: 6, speed: 3200, range: 5200, track: 2.6, spread: 0.002, profile: 'em', flash: 0x60a0ff, sound: 'laser', desc: 'Twin-barrel pulsed laser turret. Tracks and engages hostiles automatically; cheap on capacitor.' },
  blaster: { name: 'Pulse Blaster', type: 'weapon', mount: 'gun', group: 'primary', turret: 'laser', scale: 1.1, price: 60000, tech: 'basic', bolt: 'laser', dmg: 30, rof: 0.18, cap: 7, speed: 3600, range: 5500, track: 3, spread: 0.0015, profile: 'em', flash: 0x60a0ff, sound: 'laser', desc: 'Fixed forward pulse cannon. Fires along the bow and auto-aims when the target is near the reticle.' },
  heavypulse: { name: 'Heavy Pulse Turret', type: 'weapon', mount: 'turret', group: 'primary', turret: 'laser', scale: 1.35, price: 190000, tech: 'high', bolt: 'laser', dmg: 46, rof: 0.28, cap: 12, speed: 3400, range: 6500, track: 1.9, spread: 0.0015, profile: 'em', flash: 0x60a0ff, sound: 'laser', desc: 'Up-scaled pulse laser turret with heavier focusing optics. Double the damage per shot; engages automatically.' },
  auto: { name: 'Rotary Autocannon', type: 'weapon', mount: 'gun', group: 'primary', turret: 'auto', price: 85000, tech: 'basic', bolt: 'tracer', dmg: 8, rof: 0.065, cap: 0, speed: 2800, range: 3800, track: 3.2, spread: 0.007, profile: 'kinetic', flash: 0xffb050, sound: 'cannon', desc: 'Six-barrel kinetic cannon. Huge rate of fire and no capacitor draw, short range.' },
  rail: { name: 'Railgun', type: 'weapon', mount: 'gun', group: 'secondary', turret: 'rail', scale: 0.9, price: 120000, tech: 'basic', hitscan: true, ammo: true, dmg: 175, rof: 1.6, cap: 45, range: 9000, track: 1.6, spread: 0, profile: 'kinetic', flash: 0x80c0ff, sound: 'rail', desc: 'Magnetic coil accelerator firing tungsten slugs at near-instant velocity. Uses rail ammo.' },
  plasma: { name: 'Plasma Lance', type: 'weapon', mount: 'gun', group: 'secondary', turret: 'plasma', scale: 0.85, price: 420000, tech: 'high', bolt: 'plasma', dmg: 330, rof: 2.6, cap: 120, speed: 1900, range: 6500, track: 1.3, spread: 0.001, profile: 'thermal', flash: 0x60ffa0, sound: 'plasma', desc: 'Magnetically contained plasma bolt. Devastating thermal damage, slow projectile, heavy capacitor cost.' },
  flak: { name: 'Flak Turret', type: 'weapon', mount: 'turret', group: 'primary', turret: 'flak', price: 70000, tech: 'basic', bolt: 'tracer', dmg: 9, pellets: 4, rof: 0.24, cap: 0, speed: 2400, range: 2600, track: 3.4, spread: 0.03, profile: 'kinetic', flash: 0xffb050, sound: 'cannon', desc: 'Twin-barrel flak mount. Bursts of shrapnel shells that shred fast, close targets. Engages automatically.' },
  beam: { name: 'Beam Laser Turret', type: 'weapon', mount: 'turret', group: 'primary', turret: 'beam', scale: 1.1, price: 260000, tech: 'high', bolt: 'laser', dmg: 60, rof: 0.45, cap: 16, speed: 5200, range: 8000, track: 1.6, spread: 0.0008, profile: 'em', flash: 0x80b0ff, sound: 'laser', desc: 'Long-focus emitter with a crystal lens. Hard-hitting, very long range turret that engages automatically.' },
  scatter: { name: 'Scatter Cannon', type: 'weapon', mount: 'gun', group: 'primary', turret: 'scatter', price: 75000, tech: 'basic', bolt: 'tracer', dmg: 11, pellets: 6, rof: 0.45, cap: 4, speed: 2600, range: 3200, track: 3, spread: 0.035, profile: 'kinetic', flash: 0xffb050, sound: 'cannon', desc: 'Quad-barrel fixed shotgun. A devastating cone of slugs at close range.' },
  gauss: { name: 'Gauss Cannon', type: 'weapon', mount: 'gun', group: 'secondary', turret: 'gauss', scale: 0.9, price: 150000, tech: 'basic', bolt: 'tracer', dmg: 140, rof: 1.1, cap: 30, speed: 4600, range: 7000, track: 1.4, spread: 0.0005, profile: 'kinetic', flash: 0xffc070, sound: 'rail', desc: 'Fixed coilgun firing heavy ferrous slugs. Long range, no ammunition required.' },
  shieldext: { name: 'Shield Extender', type: 'utility', price: 60000, tech: 'basic', mods: { shield: 350 }, desc: '+350 shield HP.' },
  armorplate: { name: 'Reinforced Armor Plates', type: 'utility', price: 55000, tech: 'basic', mods: { armor: 450, speedMul: 0.94 }, desc: '+450 armor HP, −6% max velocity.' },
  capbattery: { name: 'Capacitor Battery', type: 'utility', price: 50000, tech: 'basic', mods: { cap: 400 }, desc: '+400 capacitor.' },
  sensor: { name: 'Sensor Booster', type: 'utility', price: 70000, tech: 'basic', mods: { lockMul: 0.55, lockRange: 15000 }, desc: '−45% lock time, +15 km lock range.' },
  caprecharger: { name: 'Capacitor Recharger', type: 'utility', price: 140000, tech: 'high', mods: { capRegenMul: 1.45 }, desc: '+45% capacitor recharge.' },
  shieldbooster: { name: 'Shield Booster', type: 'utility', price: 160000, tech: 'high', mods: { shieldRegenMul: 1.8 }, desc: '+80% shield regeneration.' },
  overdrive: { name: 'Overdrive Injector', type: 'utility', price: 150000, tech: 'high', mods: { speedMul: 1.15, boostMul: 1.1 }, desc: '+15% max velocity, +10% afterburner.' },
};

export function emptyFit(hullId) {
  const f = HULLS[hullId].fit;
  return { w: [...f.w], u: [...f.u] };
}

function socket(M, m, util) {
  const k = new Kit();
  k.add('dark', G.cyl(util ? 1.2 : 0.95, util ? 1.3 : 1.1, 0.25, 20), mat([0, 0.12, 0]));
  k.add('metal', G.torus(util ? 0.95 : 0.7, 0.06, 6, 24), mat([0, 0.27, 0], [Math.PI / 2, 0, 0]));
  k.add('amber', G.box(0.3, 0.05, 0.12), mat([0, 0.26, util ? 1.05 : 0.85]));
  const g = k.build(M);
  g.position.fromArray(m.p);
  if (m.flip) g.rotation.z = Math.PI;
  g.scale.setScalar(m.s);
  return g;
}

export function buildFitted(hullId, fit, env, liv) {
  const ship = HULLS[hullId].build(env, liv);
  fit.w.forEach((id, i) => {
    const hp = ship.hardpoints[i];
    if (!hp) return;
    if (!id) { ship.group.add(socket(ship.M, hp, false)); return; }
    const O = OUTFITS[id];
    const t = buildTurret(ship.M, O.turret, hp.s * (O.scale || 1));
    t.root.position.fromArray(hp.p);
    if (hp.flip) t.root.rotation.z = Math.PI;
    t.weapon = O;
    ship.group.add(t.root);
    ship.turrets.push(t);
  });
  fit.u.forEach((id, i) => {
    const m = ship.utilMounts[i];
    if (!m) return;
    if (!id) { ship.group.add(socket(ship.M, m, true)); return; }
    const g = buildOutfitModel(id, ship.M);
    g.position.fromArray(m.p);
    if (m.flip) g.rotation.z = Math.PI;
    g.scale.setScalar(m.s);
    ship.group.add(g);
  });
  return ship;
}

export function outfitPreview(id, M) {
  const O = OUTFITS[id];
  return O.type === 'weapon' ? buildTurret(M, O.turret, 1).root : buildOutfitModel(id, M);
}

export function fittedStats(hullId, fit) {
  const H = HULLS[hullId];
  const s = { ...H.stats, turn: [...H.stats.turn], cls: H.cls, lockMul: 1, lockRange: 30000 };
  for (const id of fit.u) {
    if (!id) continue;
    const m = OUTFITS[id].mods;
    s.shield += m.shield || 0;
    s.armor += m.armor || 0;
    s.cap += m.cap || 0;
    s.lockRange += m.lockRange || 0;
    s.lockMul *= m.lockMul || 1;
    s.capRegen *= m.capRegenMul || 1;
    s.shieldRegen *= m.shieldRegenMul || 1;
    s.speed *= m.speedMul || 1;
    s.boost *= m.boostMul || 1;
  }
  s.speed = Math.round(s.speed); s.boost = Math.round(s.boost);
  return s;
}
