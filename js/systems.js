import * as THREE from 'three';
import { rng } from './textures.js';

export const GOVS = {
  gov: { name: 'Helion Federation', short: 'FEDERATION', color: '#6cf' },
  pirate: { name: 'Corsair Clans', short: 'PIRATE', color: '#ff5a48' },
};

export const STAR_CLASSES = {
  B: { name: 'B-type blue giant', color: [0.62, 0.74, 1.0], size: 1.5, light: 3.9 },
  A: { name: 'A-type white star', color: [0.86, 0.9, 1.0], size: 1.15, light: 3.6 },
  F: { name: 'F-type yellow-white star', color: [1.0, 0.96, 0.88], size: 1.05, light: 3.5 },
  G: { name: 'G-type yellow dwarf', color: [1.0, 0.9, 0.76], size: 1.0, light: 3.4 },
  K: { name: 'K-type orange dwarf', color: [1.0, 0.68, 0.42], size: 1.2, light: 3.0 },
  M: { name: 'M-type red giant', color: [1.0, 0.44, 0.26], size: 2.1, light: 2.6 },
};

// 2D map graph; map +x is world +x, map +y is world +z
const RAW = [
  { id: 'kaltos', name: 'Kaltos', gov: 'gov', sec: 0.8, danger: 1, map: [0, 0], star: 'G', links: ['vexal', 'orin', 'tessaly', 'pellam'] },
  { id: 'vexal', name: 'Vexal', gov: 'gov', sec: 0.7, danger: 1, map: [150, -55], star: 'F', links: ['kaltos', 'sarn', 'mirel'] },
  { id: 'orin', name: 'Orin', gov: 'gov', sec: 0.6, danger: 1, map: [-130, -95], star: 'K', links: ['kaltos', 'drak', 'corsa', 'oskar'] },
  { id: 'tessaly', name: 'Tessaly', gov: 'gov', sec: 0.5, danger: 1, map: [45, 155], star: 'A', links: ['kaltos', 'khar', 'nyx', 'pellam', 'bastide'] },
  { id: 'mirel', name: 'Mirel', gov: 'gov', sec: 0.9, danger: 0, map: [195, -200], star: 'G', links: ['vexal', 'aster', 'corsa'] },
  { id: 'aster', name: 'Aster', gov: 'gov', sec: 0.9, danger: 0, map: [345, -215], star: 'B', links: ['mirel', 'ruin', 'lyra'], yard: true },
  { id: 'corsa', name: 'Corsa', gov: 'gov', sec: 0.6, danger: 1, map: [-15, -185], star: 'F', links: ['orin', 'mirel'] },
  { id: 'pellam', name: 'Pellam', gov: 'gov', sec: 0.7, danger: 1, map: [140, 85], star: 'K', links: ['kaltos', 'tessaly', 'sarn'] },
  { id: 'lyra', name: 'Lyra', gov: 'gov', sec: 0.8, danger: 0, map: [500, -165], star: 'A', links: ['aster', 'quell'], yard: true },
  { id: 'bastide', name: 'Bastide', gov: 'gov', sec: 0.4, danger: 1, map: [200, 250], star: 'G', links: ['tessaly', 'vane'] },
  { id: 'oskar', name: 'Oskar', gov: 'gov', sec: 0.5, danger: 1, map: [-300, -215], star: 'G', links: ['orin', 'grav'] },
  { id: 'sarn', name: 'Sarn', gov: 'pirate', sec: 0.1, danger: 2, map: [285, -10], star: 'M', links: ['vexal', 'ruin', 'pellam'] },
  { id: 'ruin', name: 'Ruin', gov: 'pirate', sec: 0.0, danger: 3, map: [400, 70], star: 'K', links: ['sarn', 'aster', 'quell', 'vane'] },
  { id: 'drak', name: 'Drak', gov: 'pirate', sec: 0.2, danger: 2, map: [-265, -40], star: 'M', links: ['orin', 'nyx', 'grav'] },
  { id: 'nyx', name: 'Nyx', gov: 'pirate', sec: 0.0, danger: 3, map: [-195, 170], star: 'B', links: ['tessaly', 'drak', 'morrow'] },
  { id: 'khar', name: 'Khar', gov: 'pirate', sec: 0.1, danger: 2, map: [-40, 290], star: 'F', links: ['tessaly', 'morrow'] },
  { id: 'quell', name: 'Quell', gov: 'pirate', sec: 0.1, danger: 2, map: [555, -25], star: 'K', links: ['lyra', 'ruin'] },
  { id: 'vane', name: 'Vane', gov: 'pirate', sec: 0.0, danger: 3, map: [360, 215], star: 'M', links: ['bastide', 'ruin'] },
  { id: 'grav', name: 'Grav', gov: 'pirate', sec: 0.1, danger: 2, map: [-445, -115], star: 'K', links: ['oskar', 'drak'] },
  { id: 'morrow', name: 'Morrow', gov: 'pirate', sec: 0.0, danger: 3, map: [-170, 375], star: 'M', links: ['khar', 'nyx'] },
];
export const SYSTEMS = Object.fromEntries(RAW.map((s) => [s.id, s]));

const PTYPE = {
  temperate: { t: 0, label: 'Temperate', r: [45000, 65000], clouds: true, atmo: [0.3, 0.55, 1.0] },
  barren: { t: 1, label: 'Barren', r: [16000, 40000] },
  gas: { t: 2, label: 'Gas Giant', r: [110000, 160000], atmo: [0.8, 0.7, 0.55], ring: 0.6 },
  desert: { t: 3, label: 'Desert', r: [28000, 52000], atmo: [0.95, 0.6, 0.35] },
  ice: { t: 4, label: 'Ice', r: [22000, 46000], atmo: [0.6, 0.8, 1.0] },
  lava: { t: 5, label: 'Lava', r: [20000, 42000], atmo: [1.0, 0.4, 0.15] },
  ocean: { t: 6, label: 'Ocean', r: [42000, 62000], clouds: true, atmo: [0.3, 0.6, 1.0] },
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const TINTS = {
  gas: [[0.78, 0.62, 0.44], [0.55, 0.66, 0.78], [0.82, 0.74, 0.58], [0.6, 0.5, 0.7], [0.74, 0.48, 0.34]],
  desert: [[0.66, 0.36, 0.2], [0.72, 0.56, 0.36], [0.52, 0.3, 0.24]],
  barren: [[0.42, 0.4, 0.38], [0.46, 0.4, 0.34], [0.36, 0.38, 0.42]],
  ice: [[0.82, 0.9, 1.0], [0.9, 0.92, 0.95]],
  lava: [[0.2, 0.16, 0.14]],
  temperate: [[1, 1, 1]], ocean: [[1, 1, 1]],
};

function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const v3 = (a) => new THREE.Vector3(...a);

function planet(r, name, type, pos, radius) {
  const T = PTYPE[type];
  return { name, type, t: T.t, label: T.label, pos, radius, seed: r() * 100, tint: pick(r, TINTS[type]), clouds: !!T.clouds, atmo: T.atmo || null, ring: T.ring && r() < T.ring };
}

// full system layout: star, sky, planets, stations, belts, outposts and one jump point per link
export function systemDef(id) {
  const S = SYSTEMS[id];
  const r = rng(hash(id));
  const star = STAR_CLASSES[S.star];
  const def = { ...S, starInfo: star, planets: [], stations: [], belts: [], outposts: [], jumps: [] };
  if (id === 'kaltos') {
    def.sunDir = new THREE.Vector3(0.78, 0.32, 0.2).normalize();
    def.sky = { dir: [-0.6, 0.25, -0.75], c1: [0.85, 0.18, 0.32], c2: [0.15, 0.45, 0.95], c3: [1.0, 0.55, 0.2], amt: 0.55 };
    const p = planet(r, 'Kaltos III', 'temperate', v3([120000, -40000, -280000]), 60000);
    p.seed = 0;
    const m = planet(r, 'Kaltos III - Moon 1', 'barren', v3([-150000, 52000, -210000]), 14000);
    m.seed = 0; m.tint = [0.42, 0.4, 0.38]; m.moon = true;
    const q = planet(r, 'Kaltos IV', 'gas', v3([-420000, 30000, 260000]), 130000);
    q.ring = true;
    const l = planet(r, 'Kaltos I', 'lava', v3([300000, 60000, 120000]), 26000);
    def.planets.push(p, m, q, l);
    def.stations.push({ id: 'station', kind: 'station', name: 'Ardent Relay Station', pos: v3([0, 0, 0]), dock: 'basic', rot: 0.4 });
    def.belts.push({ name: 'Kaltos III - Asteroid Belt 1', pos: v3([48000, 4000, -36000]), count: 520, spread: [14000, 3500, 14000], seed: 101, tint: [118, 108, 98] });
    def.outposts.push({ name: 'Corsair Hideout', pos: v3([-62000, -9000, -24000]), rocks: true });
    def.stations.push({ id: 'shipyard', kind: 'shipyard', name: 'Helion Orbital Shipyard', pos: v3([-38000, 14000, 34000]), dock: 'high', rot: -0.6 });
  } else {
    def.sunDir = new THREE.Vector3(r() * 2 - 1, (r() - 0.35) * 0.8, r() * 2 - 1).normalize();
    const nd = new THREE.Vector3(r() * 2 - 1, r() * 1.2 - 0.6, r() * 2 - 1).normalize();
    const hue = r();
    const col = (h, s, l) => new THREE.Color().setHSL(h % 1, s, l).toArray();
    def.sky = { dir: nd.toArray(), c1: col(hue, 0.75, 0.45), c2: col(hue + 0.35 + r() * 0.3, 0.7, 0.5), c3: col(hue + 0.1, 0.8, 0.55), amt: 0.25 + r() * 0.6 };
    const pirate = S.gov === 'pirate';
    const pool = pirate ? ['desert', 'lava', 'barren', 'gas', 'ice'] : ['temperate', 'ocean', 'gas', 'desert', 'ice', 'barren'];
    const n = 2 + Math.floor(r() * 2.6);
    const used = [];
    for (let i = 0; i < n; i++) {
      const type = i === 0 && !pirate && r() < 0.6 ? pick(r, ['temperate', 'ocean']) : pick(r, pool);
      const T = PTYPE[type];
      const radius = T.r[0] + r() * (T.r[1] - T.r[0]);
      let dir;
      for (let k = 0; k < 30; k++) {
        dir = new THREE.Vector3(r() * 2 - 1, (r() - 0.5) * 0.5, r() * 2 - 1).normalize();
        if (used.every((u) => u.angleTo(dir) > 0.9)) break;
      }
      used.push(dir);
      const dist = (type === 'gas' ? 520000 : 260000) + r() * 180000;
      const p = planet(r, `${S.name} ${ROMAN[i + 1]}`, type, dir.clone().multiplyScalar(dist), radius);
      def.planets.push(p);
      if ((type === 'gas' || type === 'temperate' || type === 'ocean') && r() < 0.75) {
        const md = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.4, r() - 0.5).normalize();
        const mr = 8000 + r() * 9000;
        const mt = r() < 0.5 ? 'ice' : 'barren';
        const m = planet(r, `${p.name} - Moon 1`, mt, p.pos.clone().addScaledVector(md, radius * (2.2 + r()) + mr), mr);
        m.atmo = null; m.moon = true;
        def.planets.push(m);
      }
    }
    const near = (d0, d1) => { const a = r() * Math.PI * 2; const d = d0 + r() * (d1 - d0); return new THREE.Vector3(Math.cos(a) * d, (r() - 0.5) * 16000, Math.sin(a) * d); };
    const mainPlanet = def.planets[0].name;
    if (!pirate) {
      const nm = pick(r, ['Relay Station', 'Trade Hub', 'Customs Station', 'Orbital Station', 'Logistics Hub']);
      def.stations.push({ id: 'station', kind: 'station', name: `${S.name} ${nm}`, pos: v3([0, 0, 0]), dock: 'basic', rot: r() * 6 });
    }
    const nb = pirate ? 1 + Math.floor(r() * 2) : 1;
    for (let i = 0; i < nb; i++) def.belts.push({ name: `${mainPlanet} - Asteroid Belt ${i + 1}`, pos: near(40000, 65000), count: 280 + Math.floor(r() * 260), spread: [12000, 3200, 12000], seed: 300 + Math.floor(r() * 9000), tint: pick(r, [[118, 108, 98], [128, 96, 76], [96, 100, 108], [110, 92, 86]]) });
    if (pirate) {
      const no = 1 + Math.floor(r() * 2);
      for (let i = 0; i < no; i++) def.outposts.push({ name: pick(r, ['Corsair Stronghold', 'Clan Hideout', 'Smuggler Den', 'Raider Base', 'Wreckers Yard']) + (no > 1 ? ` ${ROMAN[i]}` : ''), pos: near(45000, 70000), rocks: r() < 0.7 });
    }
    if (S.yard) def.stations.push({ id: 'shipyard', kind: 'shipyard', name: `${S.name} Fleet Yards`, pos: near(30000, 42000), dock: 'high', rot: r() * 6 });
  }
  addSettlements(def, S);
  // jump points point along the 2D map edge toward the neighbour
  for (const to of S.links) {
    const T = SYSTEMS[to];
    const d = new THREE.Vector3(T.map[0] - S.map[0], 0, T.map[1] - S.map[1]).normalize();
    d.y = 0.09;
    def.jumps.push({ to, pos: d.normalize().multiplyScalar(id === 'kaltos' && to === 'tessaly' ? 72000 : 78000 + (hash(to) % 12000)) });
  }
  return def;
}

const PORT_NAMES = {
  city: ['Meridian', 'New Harbor', 'Port Calder', 'Highgate', 'Concord', 'Landfall', 'Sunward', 'Founders'],
  colony: ['Dome', 'Ridge', 'Basin', 'Crater', 'Rift', 'Mesa'],
  mining: ['Deepcore', 'Shaft Nine', 'Regolith', 'Pithead', 'Lodestone'],
  aerostat: ['Cirrus', 'Stratos', 'Skyhaven', 'Bellwether', 'Zephyr'],
  haven: ['Freeport', "Smugglers' Rest", 'Blackwater Haven', 'Scrap Town', 'Cutthroat Landing', 'Gallows Field', 'Redwater'],
};
const PORT_SUFFIX = { city: 'Spaceport', colony: 'Colony', mining: 'Mining Outpost', aerostat: 'Aerostat', haven: '' };

// planetary spaceports and secondary orbital stations; separate seed keeps the base layout stable
function addSettlements(def, S) {
  const r = rng(hash(`${S.id}:ports`));
  const pirate = S.gov === 'pirate';
  let city = 0;
  def.planets.forEach((P, i) => {
    let style = null;
    if (pirate) style = i === 0 || r() < 0.4 ? 'haven' : null;
    else if (P.moon) style = r() < 0.55 ? 'mining' : null;
    else if (P.type === 'temperate' || P.type === 'ocean') style = 'city';
    else if (P.type === 'gas') style = r() < 0.6 ? 'aerostat' : null;
    else if (P.type === 'lava') style = r() < 0.35 ? 'mining' : null;
    else style = r() < 0.65 ? 'colony' : null;
    if (!style) return;
    const up = P.pos.clone().negate().normalize().add(new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.6, r() - 0.5).multiplyScalar(0.5)).normalize();
    const lift = style === 'aerostat' ? 900 : 2;
    const nm = pick(r, PORT_NAMES[style]);
    def.stations.push({
      id: `port-${i}`, kind: 'port', style, planet: i, up,
      name: style === 'haven' ? `${nm}, ${P.name}` : `${P.name} ${nm} ${PORT_SUFFIX[style]}`,
      pos: P.pos.clone().addScaledVector(up, P.radius + lift),
      dock: pirate ? 'pirate' : 'basic',
      yard: pirate ? 'pirate' : style === 'city' && city++ === 0 && r() < 0.7 ? 'light' : null,
      rot: r() * 6,
    });
  });
  const near = (d0, d1) => { const a = r() * Math.PI * 2; const d = d0 + r() * (d1 - d0); return new THREE.Vector3(Math.cos(a) * d, (r() - 0.5) * 12000, Math.sin(a) * d); };
  if (!pirate && (S.id === 'kaltos' || r() < 0.5)) {
    def.stations.push({ id: 'habitat', kind: 'habitat', name: `${S.name} ${pick(r, ['Halo', 'Wheel', 'Concourse', 'Arcology'])} Habitat`, pos: S.id === 'kaltos' ? v3([30000, -6000, 46000]) : near(24000, 36000), dock: 'basic', yard: null, rot: r() * 6 });
  }
  if (pirate && r() < 0.65) {
    def.stations.push({ id: 'den', kind: 'den', name: `${S.name} ${pick(r, ['Black Market', 'Rustworks', 'Clan Moot', 'Freebooter Spire', 'Salvage Exchange'])}`, pos: near(16000, 26000), dock: 'pirate', yard: 'pirate', rot: r() * 6 });
  }
  for (const st of def.stations) if (st.kind === 'shipyard') st.yard = 'fed';
}

let portCache = null;
// every dockable place in the galaxy
export function allPorts() {
  if (!portCache) portCache = RAW.flatMap((S) => systemDef(S.id).stations.map((st) => ({ sys: S.id, id: st.id, name: st.name, kind: st.kind, style: st.style || st.kind, pirate: st.dock === 'pirate' })));
  return portCache;
}

// jump counts from a system over the full lane graph
export function hops(from) {
  const d = { [from]: 0 };
  const q = [from];
  while (q.length) {
    const c = q.shift();
    for (const n of SYSTEMS[c].links) if (!(n in d)) { d[n] = d[c] + 1; q.push(n); }
  }
  return d;
}

// shortest path over the full graph
export function fullRoute(from, to) {
  const prev = { [from]: null };
  const q = [from];
  while (q.length) {
    const c = q.shift();
    if (c === to) break;
    for (const n of SYSTEMS[c].links) if (!(n in prev)) { prev[n] = c; q.push(n); }
  }
  if (!(to in prev)) return null;
  const path = [];
  for (let c = to; c; c = prev[c]) path.unshift(c);
  return path;
}

// shortest route through explored systems (plus the final hop into the goal)
export function route(from, to, explored) {
  const prev = { [from]: null };
  const q = [from];
  while (q.length) {
    const c = q.shift();
    if (c === to) break;
    if (c !== from && !explored.has(c)) continue;
    for (const n of SYSTEMS[c].links) if (!(n in prev)) { prev[n] = c; q.push(n); }
  }
  if (!(to in prev)) return null;
  const path = [];
  for (let c = to; c; c = prev[c]) path.unshift(c);
  return path;
}
