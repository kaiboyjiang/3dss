import { buildFrigate, buildKestrel, buildWarden, buildPaladin, buildTurret, buildOutfitModel } from './ships.js';

export const HULLS = {
  kestrel: {
    name: 'Kestrel', cls: 'Kestrel Interceptor', price: 220000, build: buildKestrel,
    desc: 'Twin-nacelle interceptor built around raw speed and agility. Light on armour, quick to lock and almost impossible to track.',
    stats: { shield: 520, armor: 380, hull: 340, speed: 330, boost: 900, accel: 130, turn: [1.6, 1.25, 2.6], cap: 750, capRegen: 24, shieldRegen: 18, sig: 0.6 },
    fit: { w: ['auto', 'pulse'], u: [null, null] },
  },
  valkyrie: {
    name: 'Valkyrie', cls: 'Caldera Assault Frigate', price: 320000, build: buildFrigate,
    desc: 'The UNS workhorse. Balanced shields and armour with a ventral spinal hardpoint for heavy weapons.',
    stats: { shield: 950, armor: 800, hull: 650, speed: 240, boost: 620, accel: 85, turn: [1.15, 0.85, 2.0], cap: 1000, capRegen: 26, shieldRegen: 22, sig: 1 },
    fit: { w: ['pulse', 'pulse', 'rail'], u: [null, null, null] },
  },
  warden: {
    name: 'Warden', cls: 'Warden-class Destroyer', price: 780000, build: buildWarden,
    desc: 'Helion Yards line destroyer. Five turret hardpoints on dorsal and ventral spines, heavy sponson armour and a deep capacitor.',
    stats: { shield: 1800, armor: 1700, hull: 1300, speed: 175, boost: 430, accel: 50, turn: [0.75, 0.6, 1.3], cap: 1800, capRegen: 40, shieldRegen: 32, sig: 1.8 },
    fit: { w: ['pulse', 'pulse', 'rail', 'auto', 'auto'], u: [null, null, null, null] },
  },
  paladin: {
    name: 'Paladin', cls: 'Paladin-class Battlecruiser', price: 2400000, build: buildPaladin,
    desc: 'Flagship-grade battlecruiser. Seven large hardpoints, layered armour decks and a command superstructure — slow, but it hits like a station.',
    stats: { shield: 3600, armor: 3800, hull: 2800, speed: 125, boost: 300, accel: 30, turn: [0.45, 0.38, 0.8], cap: 3200, capRegen: 65, shieldRegen: 55, sig: 3 },
    fit: { w: ['heavypulse', 'heavypulse', 'rail', 'rail', 'pulse', 'pulse', 'auto'], u: [null, null, null, null, null] },
  },
};
export const HULL_ORDER = ['kestrel', 'valkyrie', 'warden', 'paladin'];

// group: primary = LMB, secondary = RMB. tech: basic (any station) / high (shipyard stations only)
export const OUTFITS = {
  pulse: { name: 'Pulse Laser', type: 'weapon', group: 'primary', turret: 'laser', price: 45000, tech: 'basic', bolt: 'laser', dmg: 22, rof: 0.16, cap: 6, speed: 3200, range: 5200, track: 2.6, spread: 0.002, profile: 'em', flash: 0x60a0ff, sound: 'laser', desc: 'Twin-barrel pulsed laser. Reliable, accurate, cheap on capacitor.' },
  heavypulse: { name: 'Heavy Pulse Laser', type: 'weapon', group: 'primary', turret: 'laser', scale: 1.35, price: 190000, tech: 'high', bolt: 'laser', dmg: 46, rof: 0.28, cap: 12, speed: 3400, range: 6500, track: 1.9, spread: 0.0015, profile: 'em', flash: 0x60a0ff, sound: 'laser', desc: 'Up-scaled pulse laser with heavier focusing optics. Double the damage per shot.' },
  auto: { name: 'Rotary Autocannon', type: 'weapon', group: 'primary', turret: 'auto', price: 85000, tech: 'basic', bolt: 'tracer', dmg: 8, rof: 0.065, cap: 0, speed: 2800, range: 3800, track: 3.2, spread: 0.007, profile: 'kinetic', flash: 0xffb050, sound: 'cannon', desc: 'Six-barrel kinetic cannon. Huge rate of fire and no capacitor draw, short range.' },
  rail: { name: 'Railgun', type: 'weapon', group: 'secondary', turret: 'rail', scale: 0.9, price: 120000, tech: 'basic', hitscan: true, ammo: true, dmg: 175, rof: 1.6, cap: 45, range: 9000, track: 1.6, spread: 0, profile: 'kinetic', flash: 0x80c0ff, sound: 'rail', desc: 'Magnetic coil accelerator firing tungsten slugs at near-instant velocity. Uses rail ammo.' },
  plasma: { name: 'Plasma Lance', type: 'weapon', group: 'secondary', turret: 'plasma', scale: 0.85, price: 420000, tech: 'high', bolt: 'plasma', dmg: 330, rof: 2.6, cap: 120, speed: 1900, range: 6500, track: 1.3, spread: 0.001, profile: 'thermal', flash: 0x60ffa0, sound: 'plasma', desc: 'Magnetically contained plasma bolt. Devastating thermal damage, slow projectile, heavy capacitor cost.' },
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

export function buildFitted(hullId, fit, env, liv) {
  const ship = HULLS[hullId].build(env, liv);
  fit.w.forEach((id, i) => {
    const hp = ship.hardpoints[i];
    if (!id || !hp) return;
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
    if (!id || !m) return;
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
