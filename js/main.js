import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, LOCATIONS } from './world.js';
import { SYSTEMS, GOVS, systemDef, route, allPorts, hops, fullRoute } from './systems.js';
import { StarMap } from './map.js';
import { buildRaider, buildCruiser, buildHauler, animateShip, mergeStatic } from './ships.js';
import { HULLS, OUTFITS, YARDS, emptyFit, bareFit, normFit, cloneFit, fitItems, roleOf, slotAccepts, SLOT_KEYS, MOUNT_KEYS, OUTFIT_CATS, CAP_NAME, catOf, fitLoad, fitProblem, buildFitted, outfitPreview, fittedStats } from './catalog.js';
import { Hangar } from './hangar.js';
import { Effects, Projectiles, Missiles, attachShield, intercept, raySphere } from './combat.js';
import { Audio } from './audio.js';
import { HUD, fmtDist } from './hud.js';
import { TargetHolo } from './holo.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0), ORIGIN = new THREE.Vector3();

// ---------------------------------------------------------------- renderer
const canvas = $('c');
// MSAA happens in the composer's render target, so the canvas itself needs none
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
const GFX = {
  min: { label: 'Min', desc: 'For low-end hardware: lower resolution, no shadows or anti-aliasing, thinner asteroid belts and dust.', prMax: 0.75, prMin: 0.5, msaa: 0, shadow: 0, soft: false, sky: 256, detail: -2, clouds: false, belt: 0.45, rockLod: 0.35, dust: 0.35, stars: 0.6 },
  normal: { label: 'Normal', desc: 'A balance of looks and speed.', prMax: 1, prMin: 0.6, msaa: 4, shadow: 1024, soft: false, sky: 512, detail: 0, clouds: true, belt: 0.8, rockLod: 1, dust: 0.7, stars: 1 },
  max: { label: 'Max', desc: 'Maximum graphics: full display resolution, 8× MSAA, soft high-resolution shadows, full asteroid belts.', prMax: 2, prMin: 0.85, msaa: 8, shadow: 2048, soft: true, sky: 1024, detail: 1, clouds: true, belt: 1, rockLod: 2.5, dust: 1, stars: 1 },
};
const SETTINGS_KEY = 'gvcsg-settings-v1';
const settings = (() => { try { return { gfx: 'normal', fps: false, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { gfx: 'normal', fps: false }; } })();
if (!GFX[settings.gfx]) settings.gfx = 'normal';
let prMax = Math.min(window.devicePixelRatio || 1, GFX[settings.gfx].prMax), prMin = Math.min(prMax, GFX[settings.gfx].prMin);
let pixelRatio = prMax;
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.3, 3e6);

const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: GFX[settings.gfx].msaa });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const lensPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uWarp: { value: 0 }, uHit: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uWarp, uHit, uAspect; varying vec2 vUv;
    void main(){
      vec2 c = vUv - 0.5;
      float ca = uWarp * 0.004 + uHit * 0.004;
      vec2 uvW = vUv - c * uWarp * 0.03 * dot(c, c);
      vec3 col;
      col.r = texture2D(tDiffuse, uvW + c * ca).r;
      col.g = texture2D(tDiffuse, uvW).g;
      col.b = texture2D(tDiffuse, uvW - c * ca).b;
      // high-contrast grade: crush shadows, push highlights
      col = pow(max(col, 0.0), vec3(1.14)) * 1.12;
      vec2 cc = c * vec2(uAspect, 1.0);
      col *= 1.0 - smoothstep(0.35, 1.05, length(cc)) * 0.55;
      col = mix(col, col * vec3(1.5, 0.55, 0.45) + vec3(0.04, 0.0, 0.0), uHit * 0.45 * smoothstep(0.2, 0.9, length(cc)));
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
});
composer.addPass(lensPass);
composer.addPass(new OutputPass());

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  lensPass.uniforms.uAspect.value = w / h;
  if (hangar) hangar.resize(w, h);
  staticDrawn = false;
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- game state
const audio = new Audio();
const hud = new HUD();
const holo = new TargetHolo($('tholo'));
let world, fx, bolts, missiles, hangar;

const G = {
  state: 'menu', camera, entities: [], locations: LOCATIONS, player: null,
  selected: null, navTarget: null, lock: null, leadPoint: null, warp: null, scrambled: false,
  stick: new THREE.Vector2(), freeLook: false, look: new THREE.Vector2(),
  mouse: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), following: false, followToggle: false,
  ctrlTargeting: false, ctrlHover: null, ctrlRadius: 110,
  input: { fire1: false, fire2: false, mmb: false, keys: {} }, flightAssist: true, boosting: false, boostFx: 0, engFx: 0.3, camMode: 0,
  credits: 250000, kills: 0, ammo: { rail: 40, missile: 24 }, cool: { pri: 0, sec: 0, tur: 0, missile: 0 },
  priOff: false, secOff: false, usesAmmo: true, leadSpeed: 3200, turretsAuto: true, hasTurrets: true, turFiring: false, gunAssist: false,
  aimDir: new THREE.Vector3(0, 0, 1), aimPoint: new THREE.Vector3(), aimActive: false, mouseLocked: false,
  hull: 'valkyrie', owned: { valkyrie: emptyFit('valkyrie') }, inventory: {}, dockedAt: null,
  system: 'kaltos', explored: new Set(['kaltos']), routeTo: null, autoJump: null, dockSys: 'kaltos', dockId: 'station',
  jobs: [], access: {}, jumps: 0, ambush: null, boardT: 0, bribe: null, bribeT: 0,
  nearestName: '', time: 0, shake: 0, hitFlash: 0,
};

const STATS = {
  raider: { cls: 'Corsair Raider', shield: 210, armor: 170, hull: 150, speed: 330, accel: 150, turn: 1.25, bounty: 18500, sig: 0.6 },
  cruiser: { cls: 'Corsair Marauder Cruiser', shield: 1700, armor: 2300, hull: 1900, speed: 95, accel: 20, turn: 0.22, bounty: 145000, sig: 3 },
  cutlass: { cls: 'Cutlass Scrap Gunboat', shield: 300, armor: 300, hull: 240, speed: 320, accel: 140, turn: 1.15, bounty: 30000, sig: 0.75, hullId: 'cutlass', ai: 'fighter', gunDmg: 13 },
  reaver: { cls: 'Reaver Boarding Frigate', shield: 1000, armor: 1300, hull: 950, speed: 200, accel: 55, turn: 0.55, bounty: 95000, sig: 1.4, hullId: 'reaver', ai: 'gunship', gunDmg: 24, orbit: 2600 },
  ravager: { cls: 'Ravager Warlord Battleship', shield: 5500, armor: 7500, hull: 5600, speed: 80, accel: 12, turn: 0.16, bounty: 750000, sig: 5, hullId: 'ravager', ai: 'gunship', gunDmg: 55, orbit: 5000, scram: true },
  hauler: { cls: 'Bestower Hauler', shield: 500, armor: 1100, hull: 1000, speed: 140, accel: 15, turn: 0.28, bounty: 0, sig: 3 },
  navyKestrel: { cls: 'Helion Navy Kestrel', shield: 520, armor: 380, hull: 340, speed: 330, accel: 130, turn: 1.1, bounty: 0, sig: 0.6 },
  navyWarden: { cls: 'Helion Navy Warden', shield: 1800, armor: 1700, hull: 1300, speed: 175, accel: 50, turn: 0.4, bounty: 0, sig: 1.8 },
  navyBastion: { cls: 'Helion Navy Bastion', shield: 2700, armor: 2900, hull: 2100, speed: 140, accel: 36, turn: 0.3, bounty: 0, sig: 2.4 },
  navySabre: { cls: 'Helion Navy Sabre', shield: 2200, armor: 2100, hull: 1600, speed: 150, accel: 36, turn: 0.38, bounty: 0, sig: 2.0 },
  navyMantis: { cls: 'Helion Navy Mantis', shield: 1150, armor: 1150, hull: 850, speed: 210, accel: 72, turn: 0.75, bounty: 0, sig: 1.2 },
  secUnit: { cls: 'Combine Security Unit-7', shield: 220, armor: 160, hull: 150, speed: 320, accel: 135, turn: 1.0, bounty: 0, sig: 0.55, hullId: 'unit' },
  secEnforcer: { cls: 'Combine Security Enforcer', shield: 650, armor: 550, hull: 450, speed: 215, accel: 62, turn: 0.6, bounty: 0, sig: 1.0, hullId: 'enforcer' },
  secCompliance: { cls: 'Combine Compliance Cruiser', shield: 1500, armor: 1400, hull: 1100, speed: 130, accel: 26, turn: 0.3, bounty: 0, sig: 2.2, hullId: 'compliance' },
};
const NAVY_HULL = { navyKestrel: 'kestrel', navyWarden: 'warden', navyBastion: 'bastion', navyMantis: 'mantis', navySabre: 'sabre' };
const pirateName = (kind) => (kind === 'raider' ? PIRATE_NAMES[Math.floor(Math.random() * PIRATE_NAMES.length)] : kind === 'cruiser' ? 'Corsair Marauder' : `Corsair ${HULLS[STATS[kind].hullId].name}`);
const PIRATE_NAMES = ['Corsair Raider', 'Corsair Cutthroat', 'Corsair Wrecker', 'Corsair Outlaw', 'Corsair Plunderer', 'Corsair Despoiler'];
const PROFILES = { em: { s: 1.25, a: 0.7, h: 1 }, kinetic: { s: 0.85, a: 1.2, h: 1 }, explosive: { s: 0.9, a: 1.1, h: 1.2 }, thermal: { s: 1.0, a: 0.95, h: 1.1 } };

function setShadows(obj) {
  obj.traverse((o) => {
    if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { o.castShadow = true; o.receiveShadow = true; }
  });
}

function makeEntity(kind, faction, pos, name, civHull) {
  const env = world.env;
  let ship, s = STATS[kind];
  if (kind === 'player') {
    const fit = G.owned[G.hull];
    ship = buildFitted(G.hull, fit, env);
    s = fittedStats(G.hull, fit);
  } else if (NAVY_HULL[kind]) ship = buildFitted(NAVY_HULL[kind], emptyFit(NAVY_HULL[kind]), env, 'navy');
  else if (civHull) ship = buildFitted(civHull, bareFit(civHull), env);
  else if (s.hullId) ship = buildFitted(s.hullId, emptyFit(s.hullId), env);
  else ship = kind === 'raider' ? buildRaider(env) : kind === 'cruiser' ? buildCruiser(env) : buildHauler(env, 1 + Math.floor(Math.random() * 50));
  setShadows(ship.group);
  mergeStatic(ship);
  ship.group.position.copy(pos);
  scene.add(ship.group);
  const e = {
    kind, faction, ship, obj: ship.group, name: name || s.cls, className: civHull ? HULLS[civHull].cls : s.cls,
    vel: new THREE.Vector3(), angVel: new THREE.Vector3(), throttle: 0,
    shield: s.shield, armor: s.armor, hull: s.hull, maxShield: s.shield, maxArmor: s.armor, maxHull: s.hull,
    cap: s.cap || 0, maxCap: s.cap || 0, lastHit: -99, alive: true, stats: s,
    ai: { state: 'idle', t: 0, seed: Math.random(), fire: 0, missile: 6 + Math.random() * 4, home: pos.clone(), evade: new THREE.Vector3(), turretCd: [] },
  };
  attachShield(e, faction === 'player' ? new THREE.Color(0.4, 0.9, 2.2) : faction === 'pirate' ? new THREE.Color(2.2, 0.8, 0.35) : faction === 'corp' ? new THREE.Color(2.0, 1.5, 0.4) : new THREE.Color(0.8, 1.6, 1.0));
  G.entities.push(e);
  return e;
}

function disposeShip(obj) {
  scene.remove(obj);
  obj.traverse((o) => {
    if (o.isSprite) { o.material.dispose(); return; }
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.isSkinnedMesh) o.skeleton.dispose();
    if (o.material && o.material.isShaderMaterial && !o.material.userData.shared) o.material.dispose();
  });
}

function removeEntity(e) {
  e.alive = false;
  disposeShip(e.obj);
  const i = G.entities.indexOf(e);
  if (i >= 0) G.entities.splice(i, 1);
  if (G.selected === e) G.selected = null;
  if (G.lock && G.lock.ent === e) G.lock = null;
}

const fwdOf = (e, out = new THREE.Vector3()) => out.set(0, 0, 1).applyQuaternion(e.obj.quaternion);

// ---------------------------------------------------------------- damage
function shieldImpact(e, hp) {
  const m = e.shieldMesh;
  m.visible = true;
  const local = m.worldToLocal(hp.clone()).normalize();
  const u = m.material.uniforms;
  e.shieldHit = (e.shieldHit + 1) % 4;
  u.uHits.value[e.shieldHit].set(local.x, local.y, local.z, G.time);
  e.shieldLast = G.time;
}

function damage(e, amount, profile, hp, source) {
  if (!e.alive) return;
  const P = PROFILES[profile] || PROFILES.thermal;
  e.lastHit = G.time;
  let left = amount;
  const isPlayer = e === G.player;
  const nrm = _v4.subVectors(hp, e.obj.position).normalize();
  if (e.shield > 0) {
    const d = left * P.s;
    shieldImpact(e, hp);
    fx.flash(hp, 5 + amount * 0.05, e.faction === 'pirate' ? 0xff9060 : 0x80b8ff, 0.12);
    fx.sparksAt(hp, nrm, 8, 40, e.faction === 'pirate' ? new THREE.Color(3, 1.2, 0.5) : new THREE.Color(0.8, 1.8, 4));
    if (e.shield >= d) { e.shield -= d; left = 0; } else { left = (d - e.shield) / P.s; e.shield = 0; if (isPlayer) { hud.log('Shields depleted!', 'd'); audio.alarm(); } }
    if (isPlayer) audio.shieldHit();
  }
  if (left > 0) {
    fx.sparksAt(hp, nrm, 20, 70);
    fx.flash(hp, 7 + amount * 0.07, 0xffa050, 0.16);
    fx.trail(hp, nrm.clone().multiplyScalar(8), 2, 1.5, true);
    if (isPlayer) { audio.hullHit(); G.hitFlash = Math.min(1, G.hitFlash + 0.35); }
    if (e.armor > 0) {
      const d = left * P.a;
      if (e.armor >= d) { e.armor -= d; left = 0; } else { left = (d - e.armor) / P.a; e.armor = 0; if (isPlayer) hud.log('Armor breached — hull taking damage!', 'd'); }
    }
    if (left > 0) e.hull -= left * P.h;
  }
  if (isPlayer) G.shake = Math.min(1.2, G.shake + amount * 0.004);
  else if (source === G.player) {
    if (e.faction === 'corp' && e.ai.state !== 'flee') { e.ai.state = 'flee'; hud.log(`${e.name}: "Unlicensed weapons discharge logged. Repair costs will be billed to your next of kin."`, 'w'); }
    if (e.faction !== 'pirate' && e.ai.state !== 'flee') { e.ai.state = 'flee'; hud.log(`${e.name}: "Cease fire! We're unarmed!"`, 'w'); }
    if (e.faction === 'pirate' && e.ai.state === 'idle') e.ai.state = 'attack';
  }
  if (e.hull <= 0) destroy(e, source);
}

function destroy(e, source) {
  const big = e.kind === 'cruiser' || e.kind === 'hauler' || e.ship.radius > 60;
  const scale = e.kind === 'cruiser' || e.ship.radius > 60 ? 13 : e.kind === 'hauler' ? 9 : Math.max(3.2, e.ship.radius * 0.24);
  const pos = e.obj.position.clone();
  fx.explosion(pos, scale, e.vel.clone().multiplyScalar(0.5));
  audio.explosion(pos.distanceTo(camera.position), scale);
  if (big) {
    for (let i = 1; i <= 5; i++) {
      setTimeout(() => {
        const p = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 120));
        fx.explosion(p, scale * 0.45, e.vel.clone().multiplyScalar(0.4));
        audio.explosion(p.distanceTo(camera.position), scale * 0.4);
      }, i * 220 + Math.random() * 200);
    }
  }
  if (e === G.player) { playerDied(); return; }
  if (e.ai.bountyJob) bountyKilled(e, source);
  if (source === G.player) {
    if (e.stats.bounty) {
      G.credits += e.stats.bounty; G.kills++;
      hud.log(`${e.name} destroyed. Bounty: ${e.stats.bounty.toLocaleString()} ISK`, 'g');
    } else if (!e.ai.bountyJob) hud.log(`${e.name} destroyed. Security standing lowered.`, 'w');
  }
  removeEntity(e);
}

// ---------------------------------------------------------------- weapons
function hitscan(from, dir, range, owner) {
  let best = range, ent = null;
  for (const e of G.entities) {
    if (!e.alive || e === owner || e.faction === owner.faction) continue;
    if (_v.subVectors(e.obj.position, from).dot(dir) < -e.ship.radius) continue;
    for (const hs of e.ship.hitSpheres) {
      const c = _v2.set(hs[0], hs[1], hs[2]).applyQuaternion(e.obj.quaternion).add(e.obj.position);
      const t = raySphere(from, _v3.copy(dir).multiplyScalar(range), range, c, hs[3] + (e.shield > 0 ? 2 : 0));
      if (t !== null && t < best) { best = t; ent = e; }
    }
  }
  for (const c of world.collidersNear(_v.copy(from).addScaledVector(dir, range / 2), range / 2)) {
    const t = raySphere(from, _v3.copy(dir).multiplyScalar(range), range, c.p, c.r * 0.92);
    if (t !== null && t < best) { best = t; ent = null; }
  }
  return { ent, dist: best, point: from.clone().addScaledVector(dir, best), hitWorld: best < range };
}

// returns true when the turret is pointing at the world point
function aimTurret(t, point, dt, rate, pitchMin = -1.4, pitchMax = 0.15) {
  t.root.updateWorldMatrix(true, false);
  const lp = t.root.worldToLocal(_v.copy(point));
  const dy = lp.y - t.pitch.position.y;
  const yaw = Math.atan2(lp.x, lp.z);
  const rawPitch = -Math.atan2(dy, Math.hypot(lp.x, lp.z));
  const pitch = THREE.MathUtils.clamp(rawPitch, pitchMin, pitchMax);
  let dyaw = yaw - t.yaw.rotation.y;
  dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
  const step = rate * dt;
  t.yaw.rotation.y += THREE.MathUtils.clamp(dyaw, -step, step);
  const dp = pitch - t.pitch.rotation.x;
  t.pitch.rotation.x += THREE.MathUtils.clamp(dp, -step, step);
  return Math.abs(dyaw) < 0.04 && Math.abs(dp) < 0.04 && Math.abs(rawPitch - pitch) < 0.02;
}

function muzzleWorld(t, i, outPos, outDir) {
  const m = t.muzzles[i];
  m.updateWorldMatrix(true, false);
  outPos.setFromMatrixPosition(m.matrixWorld);
  outDir.set(0, 0, 1).transformDirection(m.matrixWorld);
}

const GUN_ASSIST = 0.1, AIM_SENS = 0.0022, AIM_EDGE = 0.9;
const _fw = new THREE.Vector3(), _gp = new THREE.Vector3(), _tp = new THREE.Vector3(), _pd = new THREE.Vector3();

const GUN_ARC = 0.1, TUR_PMAX = 0.35;
const isHostile = (e) => e.alive && e.faction === 'pirate';
const power = (e) => e.maxShield + e.maxArmor + e.maxHull;
const _lp = new THREE.Vector3();

// live hostiles, most powerful first
function hostileList() {
  const pp = G.player.obj.position;
  return G.entities.filter((e) => isHostile(e) && e.obj.position.distanceTo(pp) < 12000).sort((a, b) => power(b) - power(a));
}

// lead point if this mount can put shots on the target from where it sits, otherwise null
function reach(t, O, e, mp, fwd) {
  const lead = intercept(mp, G.player.vel, e.obj.position, e.vel, O.hitscan ? 1e9 : O.speed);
  if (!lead || mp.distanceTo(lead) > O.range * 0.95) return null;
  if (t.mount === 'gun') return _v.subVectors(lead, mp).angleTo(fwd) < GUN_ARC ? lead : null;
  const lp = t.root.worldToLocal(_lp.copy(lead));
  return -Math.atan2(lp.y - t.pitch.position.y, Math.hypot(lp.x, lp.z)) <= TUR_PMAX ? lead : null;
}

function playerWeapons(dt) {
  const p = G.player;
  const live = G.state === 'flying' && !G.warp && p.alive;
  const lockEnt = G.lock && G.lock.progress >= 1 && G.lock.ent.alive ? G.lock.ent : null;
  const hostiles = live ? hostileList() : [];
  const priGun = lockEnt && isHostile(lockEnt) ? [lockEnt, ...hostiles] : hostiles;
  const secT = lockEnt ? [lockEnt] : hostiles;
  const trig = G.input.fire1 || !!G.input.keys.KeyU || !!G.input.keys.KeyO;
  const fwd = _fw.set(0, 0, 1).applyQuaternion(p.obj.quaternion);
  let pri = 0, sec = 0, tur = 0, priOff = true, secOff = true, priF = false, secF = false, turF = false;
  G.gunAssist = false;
  for (const t of [...p.ship.gunMounts, ...p.ship.turretMounts]) {
    const O = t.weapon, turret = t.mount === 'turret', primary = t.role === 'primary';
    t.next = Math.max(0, t.next - dt);
    t.root.updateWorldMatrix(true, false);
    const mp = _gp.setFromMatrixPosition(t.root.matrixWorld);
    const blocked = p.cap < O.cap || (O.ammo && G.ammo.rail <= 0);
    let aim = null;
    for (const e of primary ? (turret ? hostiles : priGun) : secT) {
      const l = reach(t, O, e, mp, fwd);
      if (l) { aim = (t.aim ||= new THREE.Vector3()).copy(l); break; }
    }
    let aligned;
    if (turret) aligned = aimTurret(t, aim || _tp.copy(mp).addScaledVector(fwd, 2000), dt, O.track, -1.4, TUR_PMAX);
    else {
      aligned = aimTurret(t, aim || _tp.copy(mp).addScaledVector(fwd, 1e5), dt, 4, -GUN_ARC * 1.2, GUN_ARC * 1.2);
      if (aim) G.gunAssist = true;
    }
    if (primary && turret) tur = Math.max(tur, t.next / O.rof);
    else if (primary) { pri = Math.max(pri, t.next / O.rof); priOff = priOff && blocked; }
    else { sec = Math.max(sec, t.next / O.rof); secOff = secOff && blocked; }
    const want = primary ? !turret || G.turretsAuto : trig;
    if (!live || !want || !aim || !aligned || t.next > 0 || blocked) continue;
    if (!primary) secF = true; else if (turret) turF = true; else priF = true;
    t.next = O.rof * (0.94 + Math.random() * 0.12);
    p.cap -= O.cap;
    t.side = ((t.side || 0) + 1) % t.muzzles.length;
    muzzleWorld(t, t.side, _v2, _v3);
    const dir = _v3.subVectors(aim, _v2).normalize();
    if (O.spread) { dir.x += (Math.random() - 0.5) * O.spread; dir.y += (Math.random() - 0.5) * O.spread; dir.z += (Math.random() - 0.5) * O.spread; dir.normalize(); }
    t.recoil[Math.min(t.side, t.recoil.length - 1)] = 1;
    if (t.rotor) t.spin = 30;
    if (O.hitscan) {
      if (O.ammo) G.ammo.rail--;
      const from = _v2.clone(), d = dir.clone();
      const h = hitscan(from, d, O.range, p);
      fx.railTrail(from, h.point);
      fx.muzzle(from, d, O.flash, 7);
      fx.flash(from, 12, 0x99ccff, 0.1);
      G.shake = Math.min(1, G.shake + 0.35);
      if (h.ent) damage(h.ent, O.dmg, O.profile, h.point, p);
      else if (h.hitWorld) impactWorld(h.point, d.negate(), 2.5);
    } else {
      for (let n = 0; n < (O.pellets || 1); n++) {
        const d = n === 0 ? dir : _pd.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(O.spread * 1.6).add(dir).normalize();
        bolts.fire(O.bolt, _v2, d, O.speed * (0.95 + Math.random() * 0.1), p.vel, O.range, O.dmg, p, O.profile);
      }
      fx.muzzle(_v2, dir, O.flash, O.bolt === 'plasma' ? 6 : O.bolt === 'tracer' ? 1.3 : 2.2 * (O.scale || 1));
      if (O.bolt === 'plasma') { fx.flash(_v2, 10, 0x60ffa0, 0.12); G.shake = Math.min(1, G.shake + 0.2); }
    }
    audio[O.sound]();
  }
  let mis = 0;
  for (const b of p.ship.missileBays) { b.next = Math.max(0, b.next - dt); mis = Math.max(mis, b.next / b.weapon.rof); }
  G.misFiring = false;
  if (live && (trig || G.input.fire2) && fireBays(false)) G.misFiring = true;
  G.cool.pri = pri; G.cool.sec = sec; G.cool.tur = tur; G.cool.missile = mis;
  G.priOff = priOff; G.secOff = secOff; G.turFiring = turF; G.priFiring = priF; G.secFiring = secF;
}

function weaponInfo() {
  const sh = G.player.ship;
  const ms = [...sh.gunMounts, ...sh.turretMounts];
  const names = (list) => [...new Set(list.map((t) => t.weapon.name))].join(' + ') || 'None fitted';
  $('priname').textContent = names(sh.gunMounts.filter((t) => t.role === 'primary'));
  $('secname').textContent = names(ms.filter((t) => t.role === 'secondary'));
  $('turname').textContent = names(sh.turretMounts.filter((t) => t.role === 'primary'));
  $('misname').textContent = names(sh.missileBays);
  G.hasTurrets = sh.turretMounts.some((t) => t.role === 'primary');
  G.hasBays = sh.missileBays.length > 0;
  G.usesAmmo = ms.some((t) => t.weapon.ammo);
  const lead = sh.gunMounts.find((t) => !t.weapon.hitscan);
  G.leadSpeed = lead ? lead.weapon.speed : 3200;
}

function dragAim(dx, dy) {
  const q = G.player.obj.quaternion;
  const fwd = _fw.set(0, 0, 1).applyQuaternion(q);
  if (!G.aimActive) { G.aimDir.copy(fwd); G.aimActive = true; }
  // pointer-lock occasionally reports huge spurious jumps; drop them instead of steering backwards
  if (Math.abs(dx) > 250 || Math.abs(dy) > 250) return;
  G.aimDir.applyAxisAngle(_gp.set(0, 1, 0).applyQuaternion(q), -dx * AIM_SENS);
  G.aimDir.applyAxisAngle(_gp.set(1, 0, 0).applyQuaternion(q), dy * AIM_SENS).normalize();
  // pin the heading marker to the screen edge rather than letting it swing off-screen
  const cq = _q2.copy(camera.quaternion);
  const l = _tp.copy(G.aimDir).applyQuaternion(cq.clone().invert());
  const my = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * AIM_EDGE, mx = my * camera.aspect;
  const z = Math.max(-l.z, 1e-3);
  l.set(THREE.MathUtils.clamp(l.x / z, -mx, mx), THREE.MathUtils.clamp(l.y / z, -my, my), -1).normalize();
  G.aimDir.copy(l.applyQuaternion(cq));
}

function setMouseFlight(on) {
  G.followToggle = on;
  if (on) lockMouse(); else if (!G.input.mmb) document.exitPointerLock?.();
}
function lockMouse() {
  if (G.mouseLocked) return;
  const r = canvas.requestPointerLock?.();
  if (r && r.catch) r.catch(() => {});
}
document.addEventListener('pointerlockchange', () => {
  G.mouseLocked = document.pointerLockElement === canvas;
  if (!G.mouseLocked) G.followToggle = false;
});

// Launches from every fitted bay that is reloaded, has ammunition and has the locked target inside its range.
// Returns the number of bays that fired; nothing is spent when no bay can engage.
function fireBays(explicit) {
  const p = G.player;
  if (G.state !== 'flying' || G.warp || !p.alive) return 0;
  const bays = p.ship.missileBays;
  if (!bays.length) { if (explicit) hud.notice('NO MISSILE BAYS FITTED', 1.2); return 0; }
  const T = G.lock && G.lock.progress >= 1 && G.lock.ent.alive ? G.lock.ent : null;
  if (!T) { if (explicit) { hud.notice('MISSILES REQUIRE TARGET LOCK', 1.5); audio.beep(220, 0.15); } return 0; }
  let n = 0, range = false, ready = false;
  for (const b of bays) {
    const O = b.weapon;
    if (b.next > 0) continue;
    ready = true;
    if (G.ammo.missile < O.ammoPer) continue;
    b.root.updateWorldMatrix(true, false);
    if (_gp.setFromMatrixPosition(b.root.matrixWorld).distanceTo(T.obj.position) > O.range) { range = true; continue; }
    b.next = O.rof;
    n++;
    for (let i = 0; i < O.salvo && G.ammo.missile >= O.ammoPer; i++) {
      G.ammo.missile -= O.ammoPer;
      b.side = (b.side + 1) % b.tubes.length;
      const tube = b.tubes[b.side];
      setTimeout(() => {
        if (!p.alive || !T.alive || G.player !== p || G.state !== 'flying') { G.ammo.missile += O.ammoPer; return; }
        tube.updateWorldMatrix(true, false);
        const pos = new THREE.Vector3().setFromMatrixPosition(tube.matrixWorld);
        const up = new THREE.Vector3(0, 1, 0).transformDirection(b.root.matrixWorld);
        missiles.launch(pos, fwdOf(p).addScaledVector(up, 0.6).normalize(), p.vel, T, p, O.dmg, O.mspeed);
        audio.missile();
      }, i * 160);
    }
  }
  if (!n && explicit && ready) { hud.notice(range ? 'TARGET OUT OF MISSILE RANGE' : 'OUT OF MISSILES', 1.3); audio.beep(220, 0.15); }
  return n;
}

function impactWorld(point, normal, size) {
  fx.sparksAt(point, normal, 16, 50);
  fx.flash(point, size * 5, 0xffb070, 0.14);
  for (let i = 0; i < 4; i++) fx.smoke.spawn(point, _v.copy(normal).multiplyScalar(5 + Math.random() * 10).add(_v2.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(6)), 3, size, size * 6, new THREE.Color(0.25, 0.22, 0.2), new THREE.Color(0.1, 0.1, 0.1), 0.5, 0, 0.3);
  audio.impact(point.distanceTo(camera.position));
}

function onBoltHit(p, ent, hp) {
  if (ent) damage(ent, p.damage, p.profile, hp, p.owner);
  else impactWorld(hp, _v.copy(p.vel).normalize().negate(), 1.2);
}

function onMissileDetonate(m) {
  const pos = m.obj.position;
  fx.explosion(pos, 1.6, m.vel.clone().multiplyScalar(0.1));
  audio.explosion(pos.distanceTo(camera.position), 1);
  for (const e of [...G.entities]) {
    if (!e.alive || e.faction === m.owner.faction) continue;
    const d = e.obj.position.distanceTo(pos) - e.ship.radius * 0.6;
    if (d < 40) damage(e, m.damage * (1 - Math.max(0, d) / 40) * Math.min(1, e.stats.sig * 0.9 + 0.3), 'explosive', pos.clone(), m.owner);
  }
}

// ---------------------------------------------------------------- AI
function steer(e, dir, dt, rate, bankK = 1.5) {
  const fwd = fwdOf(e, _v);
  const up = _v2.set(0, 1, 0).applyQuaternion(e.obj.quaternion);
  const lat = _v3.copy(dir).addScaledVector(fwd, -dir.dot(fwd));
  up.addScaledVector(lat, bankK).normalize();
  _m.lookAt(dir, ORIGIN, up);
  _q.setFromRotationMatrix(_m);
  e.obj.quaternion.rotateTowards(_q, rate * dt);
}

function moveAI(e, dt, speed, accel) {
  const fwd = fwdOf(e, _v);
  _v2.copy(fwd).multiplyScalar(speed).sub(e.vel);
  const l = _v2.length(), maxDv = accel * dt;
  if (l > maxDv) _v2.multiplyScalar(maxDv / l);
  e.vel.add(_v2);
  e.obj.position.addScaledVector(e.vel, dt);
  e.throttle = THREE.MathUtils.lerp(e.throttle, Math.min(1, speed / e.stats.speed), dt * 3);
}

function avoid(e, dir) {
  const cs = world.collidersNear(e.obj.position, 600 + e.ship.radius);
  for (const c of cs) {
    const to = _v4.subVectors(c.p, e.obj.position);
    const d = to.length() - c.r - e.ship.radius;
    if (d < 500 && to.dot(dir) > 0) dir.addScaledVector(to.normalize(), -2.5 * (1 - Math.max(d, 0) / 500));
  }
  return dir.normalize();
}

function npcTurrets(e, dt, dist) {
  const p = G.player, A = e.ai, S = e.stats;
  if (!A.turretCd.length) A.turretCd = e.ship.turrets.map(() => Math.random());
  e.ship.turrets.forEach((t, i) => {
    const lead = intercept(e.obj.position, e.vel, p.obj.position, p.vel, 2400) || p.obj.position;
    const ok = aimTurret(t, lead, dt, 0.7, -1.45, 0.25);
    A.turretCd[i] -= dt;
    if (ok && dist < 8500 && A.turretCd[i] <= 0) {
      A.turretCd[i] = 1.2 + Math.random() * 0.5;
      t.side = ((t.side || 0) + 1) % t.muzzles.length;
      muzzleWorld(t, t.side, _v, _v2);
      const d = _v2.subVectors(lead, _v).normalize();
      d.x += (Math.random() - 0.5) * 0.012; d.y += (Math.random() - 0.5) * 0.012; d.normalize();
      bolts.fire('heavy', _v, d, 2400, e.vel, 9000, S.gunDmg || 42, e, 'thermal');
      fx.muzzle(_v, d, 0xff8020, 6);
      t.recoil[t.side] = 1;
      audio.laser(_v.distanceTo(camera.position), true);
    }
  });
}

function updateAI(e, dt) {
  const p = G.player;
  const S = e.stats, A = e.ai;
  const toP = _v4.subVectors(p.obj.position, e.obj.position);
  const dist = toP.length();
  const playerOk = p.alive && G.state === 'flying' && !G.warp;
  A.t += dt;
  if (e.kind === 'hauler') {
    const goal = A.dir > 0 ? A.b : A.a;
    const dir = new THREE.Vector3().subVectors(goal, e.obj.position);
    if (dir.length() < 5000) A.dir = -A.dir;
    if (A.state === 'flee') {
      dir.copy(e.obj.position).sub(p.obj.position);
      if (A.t > 25 && dist > 15000) { A.state = 'cruise'; A.t = 0; }
    }
    dir.normalize();
    steer(e, avoid(e, dir), dt, S.turn, 0.6);
    moveAI(e, dt, A.state === 'flee' ? S.speed * 1.5 : S.speed, S.accel);
    return;
  }
  if (e.faction === 'navy' || e.faction === 'corp') {
    const ang = A.t * 0.04 + A.seed * 6;
    const tgt = _v3.copy(A.home).add(_v2.set(Math.cos(ang) * 3500, Math.sin(ang * 0.6) * 500, Math.sin(ang) * 3500));
    steer(e, avoid(e, tgt.sub(e.obj.position).normalize()), dt, S.turn * 0.5);
    moveAI(e, dt, S.speed * 0.35, S.accel);
    return;
  }
  if (A.state === 'idle') {
    // patrol around home point
    const ang = A.t * 0.05 + A.seed;
    const tgt = _v3.copy(A.home).add(_v2.set(Math.cos(ang) * 2500, Math.sin(ang * 0.7) * 400, Math.sin(ang) * 2500));
    const dir = tgt.sub(e.obj.position).normalize();
    steer(e, avoid(e, dir), dt, S.turn * 0.5);
    moveAI(e, dt, S.speed * 0.35, S.accel);
    if (playerOk && dist < (S.sig >= 1.4 ? 22000 : 16000)) { A.state = 'attack'; A.t = 0; if (S.sig >= 1.4) hud.log(`${e.name} is targeting you!`, 'd'); }
    return;
  }
  if (!playerOk) { A.state = 'idle'; A.home.copy(e.obj.position); return; }
  if (e.kind === 'raider' || S.ai === 'fighter') {
    const lead = intercept(e.obj.position, e.vel, p.obj.position, p.vel, 2600) || p.obj.position;
    let dir;
    if (A.state === 'break') {
      dir = _v3.subVectors(A.evade, e.obj.position).normalize();
      if (A.t > A.breakT) { A.state = 'attack'; A.t = 0; }
    } else {
      dir = _v3.subVectors(lead, e.obj.position).normalize();
      if (dist < 350 || A.t > 9 + A.seed * 3) {
        A.state = 'break'; A.t = 0; A.breakT = 2.5 + Math.random() * 2;
        const side = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        A.evade.copy(e.obj.position).addScaledVector(side, 1600).addScaledVector(fwdOf(e), 1200);
      }
    }
    dir = avoid(e, dir.clone());
    steer(e, dir, dt, S.turn);
    const speed = A.state === 'break' ? S.speed : THREE.MathUtils.clamp(dist / 4, S.speed * 0.45, S.speed);
    moveAI(e, dt, speed, S.accel);
    if (e.ship.turrets.length) npcTurrets(e, dt, dist);
    // guns
    A.fire -= dt;
    const fwd = fwdOf(e, _v2);
    const toLead = _v.subVectors(lead, e.obj.position).normalize();
    if (A.state === 'attack' && dist < 3200 && fwd.dot(toLead) > 0.993 && A.fire <= 0) {
      A.fire = 0.2 + Math.random() * 0.08;
      const d = toLead.clone();
      const gm = e.ship.gunMounts, gs = gm.length ? gm : e.ship.guns;
      let from;
      if (!gs.length) from = _v3.copy(e.obj.position).addScaledVector(fwd, e.ship.radius);
      else {
        A.gun = ((A.gun || 0) + 1) % gs.length;
        const g = gs[A.gun];
        if (gm.length) { g.side = ((g.side || 0) + 1) % g.muzzles.length; muzzleWorld(g, g.side, _v3, _pd); g.recoil[g.side] = 1; from = _v3; }
        else { g.updateWorldMatrix(true, false); from = _v3.setFromMatrixPosition(g.matrixWorld); }
      }
      d.x += (Math.random() - 0.5) * 0.02; d.y += (Math.random() - 0.5) * 0.02; d.z += (Math.random() - 0.5) * 0.02; d.normalize();
      bolts.fire('pirate', from, d, 2600, e.vel, 3400, S.gunDmg || 10, e, 'thermal');
      fx.muzzle(from, d, 0xff5030, 1.6);
      audio.laser(from.distanceTo(camera.position), true);
    }
  } else if (e.kind === 'cruiser' || S.ai === 'gunship') {
    // orbit the player at ~4.5 km, broadside towards them
    const radial = _v3.copy(toP).normalize();
    const tangent = new THREE.Vector3().crossVectors(radial, Y).normalize();
    const dir = tangent.clone().addScaledVector(radial, (dist - (S.orbit || 4500)) / 2000).normalize();
    steer(e, avoid(e, dir), dt, S.turn, 0.4);
    moveAI(e, dt, S.speed, S.accel);
    npcTurrets(e, dt, dist);
    A.missile -= dt;
    if (A.missile <= 0 && dist < 15000) {
      A.missile = 8 + Math.random() * 4;
      for (const L of e.ship.missileBays.length ? e.ship.missileBays.map((m) => m.tubes[0]) : e.ship.launchers) {
        L.updateWorldMatrix(true, false);
        const pos = new THREE.Vector3().setFromMatrixPosition(L.matrixWorld);
        missiles.launch(pos, new THREE.Vector3(0, 1, 0).applyQuaternion(e.obj.quaternion).add(fwdOf(e)).normalize(), e.vel, p, e, 95, 700);
      }
      audio.missile(dist);
      hud.log('Incoming missiles!', 'd');
    }
  }
}

// ---------------------------------------------------------------- encounters
let encounters = [];
// combat sites scale with the system's danger rating; quiet core worlds have none
function buildEncounters(def) {
  const dg = def.danger, out = [];
  if (dg > 0) for (const loc of LOCATIONS.filter((l) => l.icon === 'belt')) {
    out.push({ loc, ships: [], timer: 0, wave: 0, spawn() {
      const n = 2 + dg + Math.min(3, this.wave), o = [];
      if (dg >= 2 && this.wave >= 1) o.push([Math.random() < 0.5 ? 'cruiser' : 'reaver', 3500]);
      for (let i = 0; i < n; i++) o.push([Math.random() < 0.3 ? 'cutlass' : 'raider', 2500 + Math.random() * 3000]);
      return o;
    } });
  }
  for (const loc of LOCATIONS.filter((l) => l.icon === 'outpost')) {
    out.push({ loc, ships: [], timer: 0, wave: 0, spawn() {
      const o = [['cruiser', 3000]];
      if (this.wave >= 2 || dg >= 3) o.push(['cruiser', 4200]);
      if (dg >= 2) o.push(['reaver', 3800]);
      for (let i = 0; i < 2 + dg + Math.min(3, this.wave); i++) o.push([Math.random() < 0.35 ? 'cutlass' : 'raider', 3500 + Math.random() * 2000]);
      return o;
    } });
  }
  return out;
}

function updateEncounters(dt) {
  const pp = G.player.obj.position;
  for (const enc of encounters) {
    enc.ships = enc.ships.filter((s) => s.alive);
    const d = pp.distanceTo(enc.loc.pos);
    if (enc.active && enc.ships.length === 0) {
      enc.active = false; enc.timer = 12 + Math.random() * 8; enc.wave++;
      hud.log(`${enc.loc.name}: hostiles cleared. Site bonus +${(25000 * enc.wave).toLocaleString()} ISK`, 'g');
      G.credits += 25000 * enc.wave;
      hud.notice('SITE CLEARED — REINFORCEMENTS INBOUND', 3);
    }
    enc.timer -= dt;
    if (!enc.active && enc.timer <= 0 && d < 45000 && !G.warp) {
      enc.active = true;
      const spec = enc.spawn();
      const center = enc.loc.pos.clone().lerp(pp, 0.25);
      for (const [kind, r] of spec) {
        const dir = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.3, Math.random() - 0.5).normalize();
        const pos = center.clone().addScaledVector(dir, r);
        const name = pirateName(kind);
        const e = makeEntity(kind, 'pirate', pos, name);
        e.obj.lookAt(pp);
        e.vel.copy(fwdOf(e)).multiplyScalar(e.stats.speed * 0.5);
        e.ai.seed = Math.random();
        e.ai.state = 'attack';
        e.ai.home.copy(pos);
        const sz = e.ship.radius > 25 ? 300 : 80;
        fx.flash(pos, sz, 0x88bbff, 0.6);
        fx.shock(pos, sz * 1.3, 1.0);
        enc.ships.push(e);
      }
      hud.log(`Warp signatures detected — ${spec.length} hostiles at ${enc.loc.name}`, 'd');
      hud.notice('HOSTILES INBOUND', 2.5);
      audio.alarm();
    }
  }
}

// ---------------------------------------------------------------- player
let playerAngVel = new THREE.Vector3();
function updatePlayer(dt) {
  const p = G.player, S = p.stats, K = G.input.keys;
  if (G.state !== 'flying') return;
  if (G.warp) { G.aimActive = false; updateWarp(dt); return; }
  // throttle
  if (K.KeyW || K.ArrowUp || K.KeyI) p.throttle = Math.min(1, p.throttle + dt * 0.6);
  if (K.KeyS || K.ArrowDown || K.KeyK) p.throttle = Math.max(0, p.throttle - dt * 0.6);
  G.boosting = !!K.ShiftLeft && p.cap > 10 || (!!K.ShiftRight && p.cap > 10);
  if (G.boosting) p.cap -= 45 * dt;
  // rotation (local axes): +X left, +Y up, +Z forward
  // Pioneer-style: dragging with MMB moves a target heading; the ship turns to it and stops there
  let wx = 0, wy = 0;
  if (G.aimActive && !G.freeLook) {
    const l = _v2.copy(G.aimDir).applyQuaternion(_q2.copy(p.obj.quaternion).invert());
    const ex = Math.atan2(-l.y, l.z), ey = Math.atan2(l.x, l.z);
    wx = THREE.MathUtils.clamp(ex * 2.2, -S.turn[0], S.turn[0]);
    wy = THREE.MathUtils.clamp(ey * 2.2, -S.turn[1], S.turn[1]);
    if (!G.following && Math.abs(ex) < 0.002 && Math.abs(ey) < 0.002) G.aimActive = false;
  }
  const roll = (K.KeyE ? 1 : 0) - (K.KeyQ ? 1 : 0);
  const tgt = _v.set(wx, wy, roll * S.turn[2]);
  const boostTurnPenalty = G.boosting ? 0.75 : 1;
  tgt.multiplyScalar(boostTurnPenalty);
  playerAngVel.lerp(tgt, 1 - Math.exp(-dt * (3 + 6 * S.turn[1])));
  _q.setFromEuler(_e.set(playerAngVel.x * dt, playerAngVel.y * dt, playerAngVel.z * dt));
  p.obj.quaternion.multiply(_q).normalize();
  if (!G.aimActive) G.aimDir.set(0, 0, 1).applyQuaternion(p.obj.quaternion);
  // translation
  const strafeX = ((K.KeyA || K.ArrowLeft || K.KeyJ) ? 1 : 0) - ((K.KeyD || K.ArrowRight || K.KeyL) ? 1 : 0);
  const strafeY = ((K.KeyR || K.PageUp) ? 1 : 0) - ((K.KeyB || K.PageDown) ? 1 : 0);
  const invQ = _q2.copy(p.obj.quaternion).invert();
  const vLocal = _v2.copy(p.vel).applyQuaternion(invQ);
  const maxF = G.boosting ? S.boost : S.speed;
  const acc = G.boosting ? S.accel * 2.2 : S.accel;
  if (G.flightAssist) {
    const strafeMax = S.speed * 0.35;
    const want = _v3.set(strafeX * strafeMax, strafeY * strafeMax, G.boosting ? S.boost : p.throttle * S.speed);
    const dv = want.sub(vLocal);
    dv.x = THREE.MathUtils.clamp(dv.x, -acc * 0.6 * dt, acc * 0.6 * dt);
    dv.y = THREE.MathUtils.clamp(dv.y, -acc * 0.6 * dt, acc * 0.6 * dt);
    dv.z = THREE.MathUtils.clamp(dv.z, -acc * dt * (vLocal.z > maxF ? 2.5 : 1), acc * dt);
    vLocal.add(dv);
  } else {
    vLocal.x += strafeX * acc * 0.6 * dt;
    vLocal.y += strafeY * acc * 0.6 * dt;
    vLocal.z += (((K.KeyW || K.ArrowUp || K.KeyI) ? 1 : 0) - ((K.KeyS || K.ArrowDown || K.KeyK) ? 1 : 0) + (G.boosting ? 2 : 0)) * acc * dt;
    if (vLocal.length() > S.boost) vLocal.setLength(S.boost);
  }
  p.vel.copy(vLocal.applyQuaternion(p.obj.quaternion));
  p.obj.position.addScaledVector(p.vel, dt);
  // collisions with structures / rocks
  for (const c of world.collidersNear(p.obj.position, 200)) {
    const n = _v.subVectors(p.obj.position, c.p);
    const d = n.length(), min = c.r + p.ship.radius * 0.55;
    if (d < min) {
      n.normalize();
      p.obj.position.copy(c.p).addScaledVector(n, min);
      const vn = p.vel.dot(n);
      if (vn < 0) {
        p.vel.addScaledVector(n, -vn * 1.4);
        if (-vn > 25) { damage(p, -vn * 1.4, 'kinetic', p.obj.position.clone().addScaledVector(n, -p.ship.radius * 0.5), null); hud.log(`Collision! (${Math.round(-vn)} m/s)`, 'w'); }
      }
    }
  }
  for (const body of world.bodies) {
    const n = _v.subVectors(p.obj.position, body.pos);
    if (n.length() < body.radius + 1500) { p.obj.position.copy(body.pos).addScaledVector(n.normalize(), body.radius + 1500); p.vel.addScaledVector(n, -Math.min(0, p.vel.dot(n))); }
  }
  for (const e of G.entities) {
    if (e === p || !e.alive) continue;
    const n = _v.subVectors(p.obj.position, e.obj.position);
    const min = (e.ship.radius + p.ship.radius) * 0.55;
    if (n.lengthSq() < min * min) { const d = n.length() || 1; p.obj.position.addScaledVector(n, (min - d) / d); }
  }
}

// ---------------------------------------------------------------- warp
function warpTo(dest) {
  if (G.state !== 'flying' || G.warp) return;
  if (!dest || !dest.pos) { hud.notice('SELECT A DESTINATION (1-7)', 1.6); return; }
  const p = G.player;
  const d = p.obj.position.distanceTo(dest.pos);
  if (d < dest.arrive + 8000) { hud.notice('DESTINATION WITHIN WARP RANGE MINIMUM', 1.8); audio.beep(220, 0.15); return; }
  if (G.scrambled) { hud.notice('WARP DRIVE DISRUPTED', 1.8); audio.beep(220, 0.2); return; }
  if (p.cap < 250) { hud.notice('INSUFFICIENT CAPACITOR FOR WARP', 1.8); return; }
  p.cap -= 200;
  // arrival point: just outside the destination on the side facing the ship
  const dir = dest.up ? _v.copy(dest.up) : _v.subVectors(p.obj.position, dest.pos).normalize();
  const arrive = dest.pos.clone().addScaledVector(dir, dest.arrive).add(new THREE.Vector3((Math.random() - 0.5) * 600, (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 600));
  G.warp = { dest, arrive, phase: 'align', speed: 0, t: 0, remaining: d, start: p.obj.position.clone() };
  G.lock = null;
  hud.log(`Warp drive engaged: ${dest.name} (${fmtDist(d)})`, 'i');
  audio.beep(520, 0.1);
}

function updateWarp(dt) {
  const p = G.player, W = G.warp;
  W.t += dt;
  const toDest = _v3.subVectors(W.arrive, p.obj.position);
  W.remaining = toDest.length();
  const dir = toDest.clone().normalize();
  if (W.phase === 'align') {
    steer(p, dir, dt, 0.9, 0.3);
    p.throttle = Math.min(1, p.throttle + dt);
    moveAI(p, dt, p.stats.speed * 0.75, p.stats.accel);
    if (fwdOf(p).dot(dir) > 0.9995 && W.t > 2.5) { W.phase = 'warp'; W.t = 0; W.speed = 300; audio.warpStart(); hud.notice('WARP DRIVE ACTIVE', 2); W.total = W.remaining; }
    return;
  }
  // accelerate / decelerate exponentially, capped
  const traveled = W.total - W.remaining;
  const vmax = 60000;
  const v = Math.min(vmax, 300 + Math.min(traveled * 1.6, W.remaining * 1.6), 300 + W.t * W.t * 3000);
  W.speed = v;
  const step = Math.min(v * dt, W.remaining);
  steer(p, dir, dt, 2, 0);
  p.obj.position.addScaledVector(dir, step);
  p.vel.copy(dir).multiplyScalar(v);
  if (W.remaining - step < 5) {
    p.vel.copy(dir).multiplyScalar(250);
    p.throttle = 0.6;
    G.warp = null;
    audio.warpEnd();
    G.shake = 0.6;
    fx.flash(p.obj.position.clone().addScaledVector(dir, 200), 400, 0x99ccff, 0.5);
    hud.log(`Arrived at ${W.dest.name}`, 'i');
    hud.notice(W.dest.name.toUpperCase(), 3);
  }
}

// ---------------------------------------------------------------- targeting
function lockRange() { return G.player.stats.lockRange || 30000; }

function pickNearPointer(radius) {
  const w = window.innerWidth, h = window.innerHeight, pp = G.player.obj.position;
  // with the pointer captured (mouse flight / MMB drag) the cursor is hidden, so target around the reticle
  const px = G.mouseLocked ? w / 2 : G.mouse.x, py = G.mouseLocked ? h / 2 : G.mouse.y;
  let best = null, bd = radius;
  for (const e of G.entities) {
    if (e === G.player || !e.alive || e.obj.position.distanceTo(pp) > lockRange()) continue;
    if (_v.copy(e.obj.position).applyMatrix4(camera.matrixWorldInverse).z >= 0) continue;
    _v.copy(e.obj.position).project(camera);
    const d = Math.hypot((_v.x * 0.5 + 0.5) * w - px, (-_v.y * 0.5 + 0.5) * h - py);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function lockNearestToReticle(silent) {
  const p = G.player;
  let best = pickNearPointer(160);
  if (!best) {
    const cd = camera.getWorldDirection(new THREE.Vector3());
    let bestA = 0.42;
    for (const e of G.entities) {
      if (e === p || !e.alive) continue;
      const to = _v.subVectors(e.obj.position, camera.position);
      const d = to.length();
      if (d > lockRange()) continue;
      const a = Math.acos(THREE.MathUtils.clamp(to.dot(cd) / d, -1, 1));
      if (a < bestA) { bestA = a; best = e; }
    }
  }
  if (!best && G.selected && G.selected.ship && G.selected.alive) best = G.selected;
  if (best) startLock(best); else if (!silent) { hud.notice('NO TARGET NEAR POINTER', 1.2); audio.beep(220, 0.1); }
}

function updateCtrlTargeting() {
  G.ctrlTargeting = !!G.input.keys.ControlRight && G.state === 'flying' && !G.warp;
  if (!G.ctrlTargeting) { G.ctrlHover = null; return; }
  const e = pickNearPointer(G.ctrlRadius);
  G.ctrlHover = e;
  if (e && (!G.lock || G.lock.ent !== e)) startLock(e);
}

function startLock(e) {
  const R = lockRange();
  if (e.obj.position.distanceTo(G.player.obj.position) > R) { hud.notice(`TARGET OUT OF LOCK RANGE (${Math.round(R / 1000)} km)`, 1.6); return; }
  if (G.lock && G.lock.ent === e) return;
  G.lock = { ent: e, progress: 0, time: 0.7 / Math.sqrt(e.stats.sig) * (G.player.stats.lockMul || 1) };
  G.selected = e;
  audio.beep(990, 0.05);
}

function cycleHostile() {
  const hostiles = G.entities.filter((e) => e.alive && e.faction === 'pirate').sort((a, b) => a.obj.position.distanceTo(G.player.obj.position) - b.obj.position.distanceTo(G.player.obj.position));
  if (!hostiles.length) { hud.notice('NO HOSTILES', 1.2); return; }
  const i = G.lock ? hostiles.indexOf(G.lock.ent) : -1;
  startLock(hostiles[(i + 1) % hostiles.length]);
}

function updateLock(dt) {
  const L = G.lock;
  if (!L) { G.leadPoint = null; return; }
  if (!L.ent.alive || L.ent.obj.position.distanceTo(G.player.obj.position) > lockRange() + 2000) { G.lock = null; G.leadPoint = null; return; }
  if (L.progress < 1) {
    L.progress = Math.min(1, L.progress + dt / L.time);
    if (L.progress >= 1) { audio.locked(); hud.log(`Target locked: ${L.ent.name}`, 'i'); }
  }
  G.leadPoint = intercept(G.player.obj.position, G.player.vel, L.ent.obj.position, L.ent.vel, G.leadSpeed);
}

// ---------------------------------------------------------------- docking
function tryDock() {
  if (G.state !== 'flying' || G.warp) return;
  const p = G.player;
  let st = null, d = Infinity;
  for (const l of LOCATIONS) {
    if (!l.dock) continue;
    const dd = p.obj.position.distanceTo(l.pos);
    if (dd < d) { d = dd; st = l; }
  }
  if (!st) { hud.notice('NO DOCKABLE STATION IN THIS SYSTEM', 2); audio.beep(220, 0.15); return; }
  const range = st.dock === 'high' ? 4500 : 3500;
  if (d > range) { hud.notice(`DOCKING RANGE ${range / 1000} km — ${st.name.toUpperCase()} AT ${fmtDist(d)}`, 2); audio.beep(220, 0.15); return; }
  if (G.entities.some((e) => e.faction === 'pirate' && e.alive && e.ai.state === 'attack' && e.obj.position.distanceTo(p.obj.position) < 15000)) { hud.notice('CANNOT DOCK WHILE IN COMBAT', 2); return; }
  if (!bribeGate(st)) return;
  hud.log(`${st.kind === 'port' ? 'Landing' : 'Docking'} request accepted: ${st.name}`, 'i');
  G.dockedAt = st;
  G.dockSys = G.system; G.dockId = st.id;
  G.state = 'docking';
  G.input.fire1 = G.input.fire2 = G.input.mmb = false;
  G.lock = null; G.selected = null;
  setMouseFlight(false);
  const dock = world.docks[st.id];
  const pp = p.obj.position;
  const bays = dock.bays.map((_, i) => bayWorld(dock, i));
  const b = bays.reduce((m, x) => (x.pos.clone().addScaledVector(x.dir, 900).distanceTo(pp) < m.pos.clone().addScaledVector(m.dir, 900).distanceTo(pp) ? x : m));
  const r = p.ship.radius;
  const fwd = _v.set(0, 0, 1).applyQuaternion(p.obj.quaternion);
  if (b.pad) {
    // come in high over the field, hover above the pad, then settle onto it
    const A = b.pos.clone().addScaledVector(b.dir, r * 6 + 700);
    const hover = b.pos.clone().addScaledVector(b.dir, r * 3 + 140);
    const end = b.pos.clone().addScaledVector(b.dir, r * 0.45 + 2);
    const dist = pp.distanceTo(A);
    const path = [
      seg(0.6, [pp.clone(), pp.clone().addScaledVector(fwd, THREE.MathUtils.clamp(dist * 0.35, 200, 1200)), A.clone().addScaledVector(b.dir, Math.max(300, dist * 0.3)), A]),
      seg(0.2, [A, hover]),
      seg(0.2, [hover, end]),
    ];
    startCine('docking', b, path, THREE.MathUtils.clamp(6 + dist / 700, 7, 11), `LANDING — ${st.name.toUpperCase()}`);
    return;
  }
  // line up on the bay axis outside the mouth, then fly straight in and stop inside the pod
  const end = b.pos.clone().addScaledVector(b.dir, -bayDepth(b, r));
  const A = b.pos.clone().addScaledVector(b.dir, r * 4 + 200);
  const dist = pp.distanceTo(A);
  const path = [
    seg(0.7, [pp.clone(), pp.clone().addScaledVector(fwd, THREE.MathUtils.clamp(dist * 0.35, 200, 1200)), A.clone().addScaledVector(b.dir, Math.max(lead(A.distanceTo(end), 0.3, 0.7), dist * 0.3)), A]),
    seg(0.3, [A, end]),
  ];
  startCine('docking', b, path, THREE.MathUtils.clamp(5 + dist / 700, 6, 10), `DOCKING — ${st.name.toUpperCase()}`);
}

// ---------------------------------------------------------------- docking / undocking / jump cinematics
const cine = { mode: null, t: 0, dur: 1, path: null, bay: null, gate: null, to: null, from: null, warpFx: 0, cam: new THREE.Vector3(), look: new THREE.Vector3(), ext: new THREE.Vector3(), q0: new THREE.Quaternion(), c0: new THREE.Vector3(), cq0: new THREE.Quaternion(), prev: new THREE.Vector3(), ending: false, crossed: false };
const _cq = new THREE.Quaternion(), _cm = new THREE.Matrix4(), _ct = new THREE.Vector3();
function bayWorld(dock, i) {
  const st = dock.root, b = dock.bays[i];
  const w = { pos: b.pos.clone().applyQuaternion(st.quaternion).add(st.position), dir: b.dir.clone().applyQuaternion(st.quaternion).normalize(), depth: b.depth, h: b.h, pad: !!b.pad };
  if (b.pad) { w.fwd = b.fwd.clone().applyQuaternion(st.quaternion).normalize(); w.side = w.dir.clone().cross(w.fwd).normalize(); }
  return w;
}
// how far inside the pod the ship parks
const trailBack = (r) => r * 2.2 + 25;
const bayDepth = (b, r) => THREE.MathUtils.clamp(b.depth - trailBack(r) - 20, b.depth * 0.3, b.depth * 0.6);
function bezier(P, s, out) {
  const u = 1 - s;
  return out.set(0, 0, 0).addScaledVector(P[0], u * u * u).addScaledVector(P[1], 3 * u * u * s).addScaledVector(P[2], 3 * u * s * s).addScaledVector(P[3], s * s * s);
}
function bezierTangent(P, s, out) {
  const u = 1 - s;
  return out.set(0, 0, 0).addScaledVector(P[1].clone().sub(P[0]), 3 * u * u).addScaledVector(P[2].clone().sub(P[1]), 6 * u * s).addScaledVector(P[3].clone().sub(P[2]), 3 * s * s).normalize();
}
// cinematic paths are chains of cubic Bézier (4 points) and straight (2 points) segments, each spanning a share k of the eased time
const seg = (k, P) => ({ k, P });
// Bézier handle length that matches the speed of an adjoining straight segment of length len
const lead = (len, kLine, kBez) => len * kBez / (3 * kLine);
function pathAt(path, s, out, tan) {
  let a = 0;
  for (let i = 0; i < path.length; i++) {
    const g = path[i];
    if (s <= a + g.k || i === path.length - 1) {
      const t = THREE.MathUtils.clamp((s - a) / g.k, 0, 1);
      if (g.P.length === 2) { out.lerpVectors(g.P[0], g.P[1], t); tan.subVectors(g.P[1], g.P[0]).normalize(); }
      else { bezier(g.P, t, out); bezierTangent(g.P, Math.min(t, 0.999), tan); }
      return;
    }
    a += g.k;
  }
}
const cineEase = (mode, u) => (mode === 'docking' ? u * (2 - u) : mode === 'jumpout' ? u * u * (0.35 + 0.65 * u) : mode === 'jumpin' ? 1 - (1 - u) * (1 - u) : 0.6 * u * u + 0.4 * u);
// cinematics that start from the chase camera and end off-screen, versus ones that hand back to the chase camera
const cineIn = (mode) => mode === 'docking' || mode === 'jumpout';
function startCine(mode, bay, path, dur, caption) {
  const p = G.player, r = p.ship.radius;
  const side = _v.copy(bay.dir).cross(Y).normalize();
  if (Math.random() < 0.5) side.negate();
  Object.assign(cine, { mode, t: 0, dur, path, bay, ending: false, crossed: false });
  // a fixed external camera: beside the bay mouth for docking/undocking, off to one side of the gate for jumps
  if (bay.pad && (mode === 'docking' || mode === 'undocking')) cine.ext.copy(bay.pos).addScaledVector(bay.fwd, r * 7 + 380).addScaledVector(bay.side, (Math.random() < 0.5 ? -1 : 1) * (r * 3 + 200)).addScaledVector(bay.dir, r * 1.5 + 60);
  else if (mode === 'docking' || mode === 'undocking') cine.ext.copy(bay.pos).addScaledVector(bay.dir, r * 5 + 260).addScaledVector(side, r * 2.5 + 110).addScaledVector(Y, r * 1.2 + 45);
  else cine.ext.copy(bay.pos).addScaledVector(bay.dir, mode === 'jumpout' ? -(r * 6 + 700) : r * 6 + 900).addScaledVector(side, r * 3 + 560).addScaledVector(Y, r * 2 + 160);
  cine.tEnd = -1;
  cine.q0.copy(p.obj.quaternion);
  cine.c0.copy(camera.position); cine.cq0.copy(camera.quaternion);
  cine.prev.copy(path[0].P[0]);
  $('cinecap').textContent = caption;
  $('cine').classList.remove('hidden');
  $('hud').classList.add('hidden');
  if (mode === 'undocking') { fx.flash(path[0].P[0], r * 3 + 40, 0xbfe4ff, 0.5); audio.ui(); }
  cineStep(0);
}
function setFade(on, color) {
  const f = $('fade');
  if (color) f.style.background = color;
  f.style.opacity = on ? 1 : 0;
}
function endCine() {
  const mode = cine.mode;
  cine.mode = null;
  $('cine').classList.add('hidden');
  if (mode === 'docking') {
    setFade(true, '#000');
    setTimeout(() => { if (G.state !== 'docking') return; enterDocked(); setFade(false); }, 650);
  } else if (mode === 'undocking') finishUndock();
  else if (mode === 'jumpout') {
    setFade(true, '#e6eeff');
    G.state = 'jumpfade';
    setTimeout(() => { if (G.state === 'jumpfade') arriveJump(cine.to, cine.from); }, 650);
  } else if (mode === 'jumpin') finishJump();
}
function skipCine() {
  if (!cine.mode) return;
  if (cine.mode === 'docking' || cine.mode === 'jumpout') { cine.t = cine.dur; cine.ending = true; endCine(); return; }
  cine.t = cine.dur;
  cineStep(0);
}
function cineStep(dt) {
  if (!cine.mode) return;
  if (G.state !== cine.mode) { cine.mode = null; $('cine').classList.add('hidden'); return; }
  const p = G.player, r = p.ship.radius, B = cine.bay;
  cine.t = Math.min(cine.dur, cine.t + dt);
  const u = cine.t / cine.dur, s = cineEase(cine.mode, u);
  const tan = _v2;
  pathAt(cine.path, s, p.obj.position, tan);
  if (B.pad) {
    // stay level over a landing pad: heading follows the horizontal path, nose pitches only a little
    const aim = _v3.copy(tan).projectOnPlane(B.dir).addScaledVector(B.fwd, 0.35).normalize().addScaledVector(B.dir, 0.3 * tan.dot(B.dir)).normalize();
    _cm.lookAt(aim, ORIGIN, B.dir);
  } else _cm.lookAt(cine.mode === 'undocking' ? _v3.copy(B.dir).lerp(tan, 0.5).normalize() : tan, ORIGIN, Y);
  _cq.setFromRotationMatrix(_cm);
  p.obj.quaternion.copy(cineIn(cine.mode) ? cine.q0.clone().slerp(_cq, Math.min(1, u * 3.5)) : _cq);
  if (dt > 0) p.vel.copy(p.obj.position).sub(cine.prev).divideScalar(dt);
  cine.prev.copy(p.obj.position);
  p.throttle = cine.mode === 'docking' ? 0.35 * (1 - u) + 0.05 : cine.mode === 'jumpout' ? 0.4 + 0.6 * u : cine.mode === 'jumpin' ? 1 - 0.5 * u : 0.2 + 0.6 * u;
  G.boosting = cine.mode === 'jumpout' && u > 0.45;
  playerAngVel.set(0, 0, 0);
  // camera: a fixed external camera that pans to keep the ship in frame
  const dz = _ct.copy(p.obj.position).sub(B.pos).dot(B.dir);
  cine.cam.copy(cine.ext);
  cine.look.copy(p.obj.position).addScaledVector(tan, r);
  if (cine.mode === 'jumpout') {
    // the gate spools up and the ship vanishes into the event horizon in a flash
    if (cine.gate.horizon) cine.gate.horizon.value = THREE.MathUtils.smoothstep(u, 0.1, 0.6);
    cine.warpFx = THREE.MathUtils.smoothstep(u, 0.5, 0.9);
    if (dz > 0 && !cine.ending) {
      cine.ending = true;
      cine.tEnd = cine.t;
      p.obj.visible = false;
      fx.flash(cine.gate.pos, 1400, 0x9fc8ff, 0.9);
      audio.warpStart();
    }
    if (cine.ending) cine.look.copy(cine.gate.pos);
    if (cine.ending && cine.t - cine.tEnd > 0.7 && !cine.crossed) {
      cine.crossed = true;
      endCine();
      return;
    }
  } else if (cine.mode === 'jumpin') {
    if (cine.gate && cine.gate.horizon) cine.gate.horizon.value = 1 - THREE.MathUtils.smoothstep(u, 0.15, 0.8);
    cine.warpFx = 1 - THREE.MathUtils.smoothstep(u, 0, 0.3);
  }
  if (cine.mode === 'docking') {
    if (u > 0.82 && !cine.crossed) { cine.crossed = true; setFade(true, '#000'); }
    if (u > 0.75 && !cine.ending) {
      cine.ending = true;
      fx.flash(p.obj.position, r * 2 + 30, 0xbfe4ff, 0.5);
      audio.beep(990, 0.12, 0.08);
    }
  }
  if (u >= 1) endCine();
}
function cineCamera() {
  if (!cine.mode) return;
  const u = cine.t / cine.dur;
  const w = cineIn(cine.mode) ? THREE.MathUtils.smoothstep(u, 0, 0.22) : 1 - THREE.MathUtils.smoothstep(u, 0.72, 1);
  _m.lookAt(cine.cam, cine.look, cine.bay?.pad ? cine.bay.dir : Y);
  _cq.setFromRotationMatrix(_m);
  if (cineIn(cine.mode)) {
    camera.position.lerpVectors(cine.c0, cine.cam, w);
    camera.quaternion.slerpQuaternions(cine.cq0, _cq, w);
  } else {
    camera.position.lerp(cine.cam, w);
    camera.quaternion.slerp(_cq, w);
  }
  // frame the ship (and for jumps, a good part of the gate) as it moves relative to the fixed camera
  const ext = G.player.ship.radius * 4 + (cine.mode === 'jumpout' || cine.mode === 'jumpin' ? 220 : 40);
  const fovT = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(ext / Math.max(1, cine.cam.distanceTo(cine.look)))), 14, 55);
  camera.fov += (fovT - camera.fov) * w;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

const D = { tab: 'services', browse: 'valkyrie', slot: { k: 'g', i: 0 }, preview: null, shown: null, board: [], boardAt: null };
const fmtIsk = (n) => `${Math.round(n).toLocaleString()} ISK`;
function repairCost() { const p = G.player; return Math.round((p.maxArmor - p.armor) * 40 + (p.maxHull - p.hull) * 80); }
function rearmCost() { return G.usesAmmo ? (40 - G.ammo.rail) * 300 + (24 - G.ammo.missile) * 1200 : (24 - G.ammo.missile) * 1200; }
const isHigh = () => G.dockedAt.dock === 'high' || G.dockedAt.dock === 'pirate';
const yardOf = () => (G.dockedAt.yard ? YARDS[G.dockedAt.yard] : null);

function hangarShow(hullId, keepView) {
  const fit = G.owned[hullId] || emptyFit(hullId);
  hangar.setShip(buildFitted(hullId, fit, world.env), keepView);
  D.shown = hullId;
}

function statRows(s, cmp) {
  const rows = [['Shield', s.shield, 'HP'], ['Armor', s.armor, 'HP'], ['Hull', s.hull, 'HP'], ['Max velocity', s.speed, 'm/s'], ['Afterburner', s.boost, 'm/s'], ['Acceleration', s.accel, 'm/s²'],
    ['Agility', Math.round(THREE.MathUtils.radToDeg(s.turn[1])), '°/s'], ['Capacitor', s.cap, 'GJ'], ['Cap recharge', Math.round(s.capRegen * 10) / 10, 'GJ/s'],
    ['Shield regen', Math.round(s.shieldRegen * 10) / 10, 'HP/s'], ['Lock range', Math.round(s.lockRange / 1000), 'km'], ['Signature', s.sig, '']];
  const keys = ['shield', 'armor', 'hull', 'speed', 'boost', 'accel', 'agility', 'cap', 'capRegen', 'shieldRegen', 'lockRange', null];
  return `<table class="st">${rows.map(([n, v, u], i) => {
    let c = '';
    const val = (x) => (keys[i] === 'agility' ? x.turn[1] : x[keys[i]]);
    if (cmp && keys[i]) { const a = val(s), o = val(cmp); c = a > o + 0.001 ? ' class="up"' : a < o - 0.001 ? ' class="dn"' : ''; }
    return `<tr><td>${n}</td><td${c}>${typeof v === 'number' ? v.toLocaleString() : v} ${u}</td></tr>`;
  }).join('')}</table>`;
}

const SLOT_HEAD = { g: 'Gun mounts', t: 'Turret mounts', m: 'Missile bays', e: 'Engines', u: 'Systems' };
const SLOT_EMPTY = { g: 'Empty gun mount', t: 'Empty turret mount', m: 'Empty missile bay' };
const CAT_NAME = Object.fromEntries(OUTFIT_CATS);
const MOUNT_OF_CAT = { gun: 'g', turret: 't', bay: 'm' };
function capBars(hullId, fit) {
  const C = HULLS[hullId].cap, L = fitLoad(fit);
  return `<div class="caps">${['o', 'w', 'e'].map((k) => `<div class="cap${L[k] > C[k] ? ' over' : ''}"><span>${CAP_NAME[k]}</span><b>${L[k]} / ${C[k]}</b><i style="width:${Math.min(100, (100 * L[k]) / C[k])}%"></i></div>`).join('')}</div>`;
}
function shopOk(O) {
  if (O.shop === 'pirate') return G.dockedAt.dock === 'pirate';
  if (O.shop === 'corp') return SYSTEMS[G.system].gov === 'corp';
  return O.tech === 'basic' || isHigh();
}
const shopNote = (O) => (O.shop === 'pirate' ? 'Only sold at Clan ports.' : O.shop === 'corp' ? 'Only sold in Combine systems.' : 'Only sold at high-tech stations.');
// Where an outfit would go on the active ship: the selected mount if it matches, else the first empty matching mount,
// else replacing the first matching mount; engines and systems are appended.
function planFit(id) {
  const fit = G.owned[G.hull], O = OUTFITS[id], tf = cloneFit(fit);
  const mk = MOUNT_OF_CAT[catOf(id)];
  let k, i;
  if (mk) {
    if (!fit[mk].length) return { err: `This hull has no ${SLOT_NAME_L[mk]}` };
    k = mk; i = D.slot.k === mk ? D.slot.i : fit[mk].indexOf(null);
    if (i < 0) i = 0;
    if (fit[k][i] === id) return { k, i, tf, same: true };
    tf[k][i] = id; tf.r[k] && (tf.r[k][i] = O.group);
  } else {
    k = O.type === 'engine' ? 'e' : 'u'; i = fit[k].length;
    tf[k].push(id);
  }
  const err = fitProblem(G.hull, tf) || (capOk(G.hull, tf) ? '' : 'Active cargo or passengers would lose their space');
  return { k, i, tf, err, old: mk ? fit[k][i] : null };
}
const SLOT_NAME_L = { g: 'gun mounts', t: 'turret mounts', m: 'missile bays' };
const spaceLine = (O) => `Uses ${O.space} outfit space${O.type === 'weapon' ? ` and ${O.space} weapon capacity` : O.type === 'engine' ? ` and ${O.space} engine capacity` : ''}.`;
const engineLine = (O) => (O.type === 'engine' ? `Thrust ${O.thrust} · steering ${O.steer}` : '');
function weaponLine(O) {
  if (O.type !== 'weapon') return '';
  if (O.mount === 'bay') return `Missile bay — always secondary, needs a target lock · ${O.salvo} × ${O.dmg} dmg per salvo · ${(O.range / 1000).toFixed(1)} km · ${O.rof} s reload · ${O.ammoPer} missile${O.ammoPer > 1 ? 's' : ''} per shot`;
  return `${O.mount === 'turret' ? 'Turret — tracks targets on its own' : 'Fixed gun — aims up to 6° off the nose'} · ${Math.round(O.dmg / O.rof)} DPS · ${(O.range / 1000).toFixed(1)} km · ${O.cap} GJ/shot${O.ammo ? ' · uses slugs' : ''}`;
}
const mountType = (O) => (O.type !== 'weapon' ? CAT_NAME[O.cat] : O.mount === 'bay' ? 'Missile bay · secondary' : `${O.mount === 'gun' ? 'Fixed gun' : 'Turret'} · ${O.group === 'primary' ? 'primary' : 'secondary'} by default`);
const roleName = (fit, k, j) => (roleOf(fit, k, j) === 'primary' ? 'PRIMARY' : 'SECONDARY');

function renderDock() {
  const L = $('dockleft'), R = $('dockright');
  $('dockwallet').innerHTML = `Wallet <b>${fmtIsk(G.credits)}</b>`;
  document.querySelectorAll('#docktop .dtabs b').forEach((b) => {
    b.classList.toggle('on', b.dataset.tab === D.tab);
    b.classList.toggle('na', b.dataset.tab === 'shipyard' && !yardOf());
  });
  const p = G.player, H = HULLS[G.hull], fit = G.owned[G.hull];
  if (D.tab === 'services') {
    L.innerHTML = `<h3>Active ship</h3><h2>${H.name}</h2><div class="sub">${H.cls}</div>
      <table class="st"><tr><td>Shield</td><td>${Math.round(p.shield)} / ${p.maxShield}</td></tr><tr><td>Armor</td><td>${Math.round(p.armor)} / ${p.maxArmor}</td></tr>
      <tr><td>Hull</td><td>${Math.round(p.hull)} / ${p.maxHull}</td></tr><tr><td>Cargo hold</td><td>${usedCargo()} / ${p.stats.cargo} t</td></tr><tr><td>Passenger bunks</td><td>${usedBunks()} / ${p.stats.bunks}</td></tr><tr><td>Railgun slugs</td><td>${G.ammo.rail} / 40</td></tr><tr><td>Missiles</td><td>${G.ammo.missile} / 24</td></tr></table>
      <button data-a="repair" ${repairCost() === 0 || G.credits < repairCost() ? 'disabled' : ''}>Repair (${fmtIsk(repairCost())})</button>
      <button data-a="rearm" ${rearmCost() === 0 || G.credits < rearmCost() ? 'disabled' : ''}>Rearm (${fmtIsk(rearmCost())})</button>
      <p style="margin-top:14px">${servicesText()}</p>`;
    R.innerHTML = `<h3>Fitting</h3>${SLOT_KEYS.map((k) => fit[k].map((id, i) => `<div class="item slot${id ? '' : ' empty'}"><span><span class="k">${k.toUpperCase()}${i + 1}</span><span class="nm">${id ? OUTFITS[id].name : SLOT_EMPTY[k]}</span></span>${id && MOUNT_KEYS.includes(k) ? `<span class="pr">${roleName(fit, k, i)}</span>` : ''}</div>`).join('')).join('')}
      ${capBars(G.hull, fit)}<h3 style="margin-top:12px">Ship attributes</h3>${statRows(p.stats)}`;
  } else if (D.tab === 'shipyard') {
    const Y0 = yardOf(), forSale = new Set(Y0.hulls);
    L.innerHTML = `<h3>${Y0.name}</h3>${[...Y0.hulls, ...Object.keys(G.owned).filter((id) => !forSale.has(id))].map((id) => {
      const h = HULLS[id], own = !!G.owned[id];
      return `<div class="item${D.browse === id ? ' on' : ''}" data-hull="${id}"><span><div class="nm">${h.name}</div><div class="ty">${h.cls}</div></span>
        <span class="pr${own ? ' own' : ''}">${id === G.hull ? 'ACTIVE' : own ? 'OWNED' : fmtIsk(h.price)}</span></div>`;
    }).join('')}<p>Drag the hangar view to orbit the hull, scroll to zoom.</p>`;
    const h = HULLS[D.browse], own = !!G.owned[D.browse];
    const s = fittedStats(D.browse, G.owned[D.browse] || emptyFit(D.browse));
    const f = G.owned[D.browse] || h.fit;
    R.innerHTML = `<h2>${h.name}</h2><div class="sub">${h.cls}</div><p>${h.desc}</p>
      <table class="st">${MOUNT_KEYS.map((k) => `<tr><td>${SLOT_HEAD[k]}</td><td>${h.fit[k].length}</td></tr>`).join('')}
      ${['o', 'w', 'e'].map((k) => `<tr><td>${CAP_NAME[k][0].toUpperCase()}${CAP_NAME[k].slice(1)}</td><td>${own ? `${fitLoad(f)[k]} / ` : ''}${h.cap[k]}</td></tr>`).join('')}
      <tr><td>Cargo hold</td><td>${s.cargo} t</td></tr><tr><td>Passenger bunks</td><td>${s.bunks}</td></tr>
      <tr><td>${own ? 'Fitted' : 'Stock'} weapons</td><td>${fitItems(f).filter((id) => OUTFITS[id].type === 'weapon').map((id) => OUTFITS[id].name).join(', ') || '—'}</td></tr>
      <tr><td>${own ? 'Fitted' : 'Stock'} engines</td><td>${f.e.map((id) => OUTFITS[id].name).join(', ') || '—'}</td></tr></table>
      ${statRows(s, D.browse === G.hull ? null : p.stats)}
      ${D.browse === G.hull ? '<button disabled>Active ship</button>' : own ? `<button data-a="board" class="primary">Board this ship</button><button data-a="sellship">Sell hull (${fmtIsk(h.price * 0.5)}, fittings to cargo)</button>`
    : forSale.has(D.browse) ? `<button data-a="buy" class="primary" ${G.credits < h.price ? 'disabled' : ''}>Buy &amp; board (${fmtIsk(h.price)})</button>` : '<button disabled>Not sold here</button>'}
      ${capOk(D.browse, G.owned[D.browse] || emptyFit(D.browse)) ? '' : `<p class="warn">Too small for your active jobs (${usedCargo()} t cargo, ${usedBunks()} passengers).</p>`}`;
  } else if (D.tab === 'jobs') {
    renderJobs(L, R);
  } else {
    if (!fit[D.slot.k] || D.slot.i >= fit[D.slot.k].length) D.slot = { k: MOUNT_KEYS.find((kk) => fit[kk].length) || 'e', i: 0 };
    if (!D.cat) D.cat = { g: 'gun', t: 'turret', m: 'bay', e: 'engine' }[D.slot.k] || 'reactor';
    const k = D.slot.k, i = D.slot.i;
    const slotRow = (kk, id, j) => `<div class="item slot${id ? '' : ' empty'}${k === kk && i === j ? ' on' : ''}" data-slot="${kk}${j}"><span><span class="k">${kk.toUpperCase()}${j + 1}</span><span class="nm">${id ? OUTFITS[id].name : SLOT_EMPTY[kk]}</span></span>${kk === 'g' || kk === 't' ? `<span class="pr role" data-a="role" data-slot="${kk}${j}" title="Switch firing role">${roleName(fit, kk, j)}</span>` : kk === 'm' ? '<span class="pr">SECONDARY</span>' : `<span class="pr">${OUTFITS[id].space}</span>`}</div>`;
    const inv = Object.entries(G.inventory).filter(([, n]) => n > 0);
    L.innerHTML = `<h3>${H.name} — fitting</h3>${capBars(G.hull, fit)}<p>Weapons and engines count against outfit space as well as their own capacity. Primary weapons fire on their own at hostiles in reach; secondary weapons fire on LMB / U. Click a role to switch it.</p>
      ${MOUNT_KEYS.filter((kk) => fit[kk].length).map((kk) => `<h3 style="margin-top:12px">${SLOT_HEAD[kk]}</h3>${fit[kk].map((id, j) => slotRow(kk, id, j)).join('')}`).join('')}
      ${['e', 'u'].map((kk) => `<h3 style="margin-top:12px">${SLOT_HEAD[kk]}</h3>${fit[kk].map((id, j) => slotRow(kk, id, j)).join('') || `<p class="${kk === 'e' ? 'warn' : ''}">${kk === 'e' ? 'No engines: the ship cannot leave the dock.' : 'No systems fitted.'}</p>`}`).join('')}
      ${fit[k]?.[i] ? `<button data-a="unfit">Unfit ${OUTFITS[fit[k][i]].name}</button>` : ''}
      <h3 style="margin-top:12px">Ship attributes</h3>${statRows(p.stats)}
      ${inv.length ? `<h3>Cargo hold</h3>${inv.map(([id, n]) => `<div class="item" data-out="${id}"><span class="nm">${OUTFITS[id].name}</span><span class="pr own">×${n}</span></div>`).join('')}` : ''}`;
    const list = Object.entries(OUTFITS).filter(([id]) => catOf(id) === D.cat).sort((x, y) => x[1].space - y[1].space || x[1].price - y[1].price);
    let det = '';
    if (D.preview && OUTFITS[D.preview]) {
      const O = OUTFITS[D.preview], have = G.inventory[D.preview] > 0, avail = shopOk(O), plan = planFit(D.preview);
      const stats = plan.tf && !plan.err ? fittedStats(G.hull, plan.tf) : null;
      const where = plan.k ? (MOUNT_KEYS.includes(plan.k) ? `${plan.k.toUpperCase()}${plan.i + 1}` : SLOT_HEAD[plan.k].toLowerCase()) : '';
      const label = plan.same ? 'Fitted' : plan.err || `${have ? 'Fit from cargo' : avail ? `Buy &amp; fit (${fmtIsk(O.price)})` : 'Not sold here'} → ${where}`;
      det = `<h2 style="margin-top:12px">${O.name}</h2><div class="sub">${O.tech === 'high' ? 'HIGH-TECH · ' : ''}${O.shop === 'pirate' ? 'CLAN · ' : O.shop === 'corp' ? 'COMBINE · ' : ''}${mountType(O).toUpperCase()}</div><p>${O.desc}</p><p>${weaponLine(O)}${engineLine(O)}</p><p>${spaceLine(O)}</p>
        ${O.type !== 'weapon' && stats ? statRows(stats, p.stats) : ''}
        <button data-a="fit" class="primary" ${plan.err || plan.same || (!have && (!avail || G.credits < O.price)) ? 'disabled' : ''}>${label}</button>
        ${!avail && !have ? `<p>${shopNote(O)}</p>` : ''}
        ${have ? `<button data-a="sell">Sell one from cargo (${fmtIsk(O.price * 0.5)})</button>` : ''}`;
    }
    R.innerHTML = `<h3>${G.dockedAt.dock === 'pirate' ? 'Black-market outfitter' : isHigh() ? 'Helion outfitter' : 'Basic outfitter'}</h3>
      <div class="dtabs ocats">${OUTFIT_CATS.map(([c, n]) => `<b data-cat="${c}" class="${D.cat === c ? 'on' : ''}">${n}</b>`).join('')}</div>
      ${list.map(([id, O]) => `<div class="item${D.preview === id ? ' on' : ''}${shopOk(O) || G.inventory[id] ? '' : ' dis'}" data-out="${id}"><span><div class="nm">${O.name}</div><div class="ty">${O.space} space${O.type === 'engine' ? ` · thrust ${O.thrust}` : ''}${O.tech === 'high' ? ' · High-tech' : ''}${O.shop === 'pirate' ? ' · Clan' : O.shop === 'corp' ? ' · Combine' : ''}</div></span>
        <span class="pr${G.inventory[id] ? ' own' : ''}">${G.inventory[id] ? `×${G.inventory[id]} in cargo` : fmtIsk(O.price)}</span></div>`).join('')}${det}`;
  }
  slotMarkers();
}

function slotMarkers() {
  const s = hangar.ship;
  if (D.tab === 'services' || D.tab === 'jobs' || !s) { hangar.setSlots(null); return; }
  const fit = D.tab === 'shipyard' ? (G.owned[D.browse] || HULLS[D.browse].fit) : G.owned[G.hull];
  const list = MOUNT_KEYS.flatMap((k) => (s.slots ? s.slots[k] : []).slice(0, fit[k].length).map((h, i) => ({ k, i, ...h })));
  hangar.setSlots(list, D.tab === 'outfitter' ? D.slot : null, D.focusSlot);
  D.focusSlot = false;
}

function setDockTab(tab) {
  if (tab === 'shipyard' && !yardOf()) { flashDockMsg('No shipyard here — the star map lists shipyards under Facilities'); return; }
  D.tab = tab; D.preview = null; D.cat = null;
  hangar.setOutfit(null);
  if (tab === 'shipyard') { D.browse = D.browse || G.hull; if (D.shown !== D.browse) hangarShow(D.browse); } else if (D.shown !== G.hull) hangarShow(G.hull);
  audio.ui();
  renderDock();
}
// ---------------------------------------------------------------- job board: freight, passengers, bounties
const CARGO_KINDS = [['Machine parts', 0], ['Hydroponic seed stock', 0], ['Water ice', 0], ['Mining charges', 1], ['Medical supplies', 1], ['Luxury goods', 2], ['Military hardware', 2], ['Refined iridium', 2], ['Unmarked crates', 3]];
const PAX_KINDS = [['Colonists', 0], ['Contract miners', 0], ['Tourists', 0], ['Pilgrims', 1], ['Corporate executives', 2], ['A defecting Clan engineer', 3], ['A protected witness', 3]];
const WARLORDS = ['Red Vasko', 'Mother Ilsk', 'Kaine the Flayer', 'Old Gutter', 'Saffron Jax', 'The Widow Marr', 'Brannoc Ironjaw', 'Six-Finger Tal'];
const RISK = ['Low', 'Moderate', 'High', 'Extreme'];
const RIVALS = ['Halvorsen-Kade Trading', 'Meridian Free Traders', 'Calder & Daughters', 'Tessaly Independent Freight', 'Orsk Cooperative', 'Lantern Line Couriers'];
const MERCHANT_SHIPS = ['Patient Margin', 'Honest Weight', 'Little Wren', 'Second Chance', 'Morning Star', 'Ilsa May', 'Quiet Harbour', 'Good Fortune'];
const SECRETS = ['stolen Combine drive-coil patents', "a whistleblower's data core", 'leaked reactor schematics', 'audit records from a Combine labour camp', "a defecting engineer's design archive", 'proof of a rigged mining tender'];
const isHunt = (j) => j.type === 'bounty' || j.type === 'hit';
const huntLoc = (j) => (j.type === 'hit' ? 'contract' : 'bounty');
const usedCargo = () => G.jobs.reduce((n, j) => n + (j.type === 'cargo' ? j.amt : 0), 0);
const usedBunks = () => G.jobs.reduce((n, j) => n + (j.type === 'pax' ? j.amt : 0), 0);
const shipCap = (id = G.hull) => fittedStats(id, G.owned[id] || emptyFit(id));
function capOk(id, fit) { const s = fittedStats(id, fit); return s.cargo >= usedCargo() && s.bunks >= usedBunks(); }
const jumpsLeft = (j) => j.deadline - G.jumps;

function servicesText() {
  const L0 = G.dockedAt, Y0 = yardOf();
  const parts = [`${L0.name} is a ${L0.type.toLowerCase()}.`];
  parts.push(Y0 ? `Its shipyard sells the ${Y0.name.toLowerCase()}.` : 'There is no shipyard here.');
  parts.push(L0.dock === 'pirate' ? 'The black-market outfitter carries everything, no questions asked.' : isHigh() ? 'The outfitter stocks high-tech modules.' : 'The outfitter only stocks basic modules.');
  if (SYSTEMS[G.system].gov === 'corp') parts.push('Property of the Vanta Combine: every dock, rock and lane in this system belongs to the company, and Combine Security patrols it.');
  parts.push('Check the Job Board for freight, passenger and bounty contracts.');
  return parts.join(' ');
}

function bribeCost() { return Math.round((25000 + SYSTEMS[G.system].danger * 20000 + HULLS[G.hull].price * 0.03) / 1000) * 1000; }
// pirate ports wave a ship off until it pays once; the first G asks, the second pays
function bribeGate(st) {
  const key = `${G.system}:${st.id}`;
  if (st.dock !== 'pirate' || G.access[key]) return true;
  const c = bribeCost();
  if (G.bribe !== key || G.time - G.bribeT > 10) {
    G.bribe = key; G.bribeT = G.time;
    hud.log(`${st.name}: "Landing's not free, friend. ${fmtIsk(c)} and we never saw you."`, 'w');
    hud.notice(`LANDING DENIED — PRESS G AGAIN TO PAY ${fmtIsk(c).toUpperCase()} BRIBE`, 4);
    audio.beep(330, 0.15);
    return false;
  }
  if (G.credits < c) { hud.notice(`CANNOT AFFORD THE ${fmtIsk(c).toUpperCase()} BRIBE`, 2.5); audio.beep(220, 0.15); return false; }
  G.credits -= c; G.access[key] = true; G.bribe = null;
  hud.log(`Paid ${fmtIsk(c)} to ${st.name}. Permanent landing rights granted.`, 'g');
  return true;
}

const routeRisk = (from, to) => ((fullRoute(from, to) || []).slice(1).some((x) => SYSTEMS[x].gov === 'pirate') ? 1 : 0);

function makeBoard() {
  const here = G.dockedAt, pir = here.dock === 'pirate', R = Math.random;
  const pick = (a) => a[Math.floor(R() * a.length)];
  const dist = hops(G.system);
  const ports = allPorts().filter((x) => !(x.sys === G.system && x.id === here.id) && dist[x.sys] <= 4);
  const safe = ports.filter((x) => !x.pirate), dark = ports.filter((x) => x.pirate);
  const dest = (shady) => pick((pir || shady) && dark.length && R() < 0.6 ? dark : safe.length ? safe : ports);
  const where = (x) => ({ sys: x.sys, id: x.id, name: x.name });
  const board = [];
  const n = 7 + Math.floor(R() * 3);
  const huntable = Object.keys(dist).filter((x) => SYSTEMS[x].gov === 'pirate' && dist[x] >= 0 && dist[x] <= 3);
  // the Combine sometimes wants a harmless competitor quietly removed
  const marks = Object.keys(dist).filter((x) => SYSTEMS[x].gov !== 'pirate' && dist[x] >= 1 && dist[x] <= 3);
  if (SYSTEMS[G.system].gov === 'corp' && marks.length && R() < 0.55) {
    const sys = pick(marks), h = dist[sys];
    const hull = pick(['mule', 'mule', 'atlas']);
    const reward = Math.round((280000 + R() * 240000) * (1 + h * 0.2) / 1000) * 1000;
    board.push({ id: `${Date.now().toString(36)}-h-${Math.floor(R() * 1e6).toString(36)}`, type: 'hit', risk: 2, reward, deadline: G.jumps + h * 2 + 5, to: { sys, name: SYSTEMS[sys].name },
      target: { sys, hull, name: `${pick(RIVALS)} ${HULLS[hull].name} "${pick(MERCHANT_SHIPS)}"`, secret: pick(SECRETS) } });
  }
  for (let i = 0; i < n; i++) {
    const roll = i === 0 && huntable.length ? 1 : R();
    const id = `${Date.now().toString(36)}-${i}-${Math.floor(R() * 1e6).toString(36)}`;
    if (roll > 0.82 && huntable.length) {
      const sys = pick(huntable), heavy = R() < 0.45;
      const h = Math.max(1, dist[sys]);
      const hull = heavy ? 'ravager' : 'reaver';
      const reward = Math.round(((heavy ? 1500000 : 420000) + R() * (heavy ? 900000 : 260000)) * (1 + h * 0.15) / 1000) * 1000;
      board.push({ id, type: 'bounty', risk: 3, reward, deadline: G.jumps + h * 2 + 6, to: { sys, name: SYSTEMS[sys].name },
        target: { sys, hull, name: pick(WARLORDS), escorts: heavy ? ['reaver', 'cutlass', 'cutlass'] : ['cutlass', 'raider'] } });
      continue;
    }
    const pax = roll > 0.42;
    const [what, base] = pick(pax ? PAX_KINDS : CARGO_KINDS);
    const to = dest(base >= 2);
    const h = Math.max(1, dist[to.sys]);
    const bulk = R() < 0.45;
    const amt = pax ? (bulk ? 20 + Math.floor(R() * 9) * 15 : 1 + Math.floor(R() * 6)) : (bulk ? 60 + Math.floor(R() * 9) * 40 : 2 + Math.floor(R() * 14));
    const risk = Math.min(3, base + (to.pirate || routeRisk(G.system, to.sys) ? 1 : 0) + (pir && base > 0 ? 1 : 0));
    const per = pax ? (bulk ? 2600 : 9000) : (bulk ? 520 : 2200);
    const reward = Math.round((12000 + amt * per) * h * (1 + risk * 0.65) / 1000) * 1000;
    board.push({ id, type: pax ? 'pax' : 'cargo', what, amt, risk, reward, deadline: G.jumps + h * 2 + 3, from: where({ sys: G.system, id: here.id, name: here.name }), to: where(to) });
  }
  return board;
}

function jobTitle(j) {
  if (j.type === 'bounty') return `Bounty: ${j.target.name}`;
  if (j.type === 'hit') return `Discreet removal: ${j.target.name}`;
  return j.type === 'cargo' ? `Deliver ${j.amt} t ${j.what.toLowerCase()}` : `Carry ${j.amt > 1 && !/^A /.test(j.what) ? `${j.amt} ${j.what.toLowerCase()}` : j.what.toLowerCase()}`;
}
function jobLine(j) {
  const sysName = (x) => (G.explored.has(x) ? SYSTEMS[x].name : 'uncharted space');
  const left = jumpsLeft(j), dist = hops(G.system)[j.to.sys];
  const when = `${dist} jump${dist === 1 ? '' : 's'} away · ${left} jump${left === 1 ? '' : 's'} to deadline`;
  if (j.type === 'bounty') return `${STATS[j.target.hull].cls} with escorts, last seen in ${sysName(j.target.sys)}. ${when}.`;
  if (j.type === 'hit') return `A non-hostile merchant ${HULLS[j.target.hull].cls} carrying ${j.target.secret}, running between the ports and gates of ${sysName(j.target.sys)}. Unarmed; it will not fire on you. Destroy it before it delivers. ${when}.`;
  return `To ${j.to.name} (${sysName(j.to.sys)}). Needs ${j.amt} ${j.type === 'cargo' ? 't of cargo space' : `bunk${j.amt > 1 ? 's' : ''}`}. ${when}.`;
}
function jobRow(j, act) {
  const free = j.type === 'cargo' ? shipCap().cargo - usedCargo() : j.type === 'pax' ? shipCap().bunks - usedBunks() : Infinity;
  const short = act === 'accept' && j.amt > free;
  return `<div class="job r${j.risk}"><div class="jh"><span class="nm">${jobTitle(j)}</span><span class="pr">${fmtIsk(j.reward)}</span></div>
    <div class="ty">${jobLine(j)}</div><div class="jr">Risk: <b>${RISK[j.risk]}</b>${j.type === 'hit' ? ' · Vanta Combine: no record of this contract exists' : j.risk >= 2 && j.type !== 'bounty' ? ' · Clan hijackers want this' : ''}</div>
    ${act === 'accept' ? `<button data-a="accept" data-j="${j.id}" ${short ? 'disabled' : ''}>${short ? `Not enough ${j.type === 'cargo' ? 'cargo space' : 'bunks'} (${Math.max(0, free)} free)` : 'Accept'}</button>`
    : `<button data-a="abandon" data-j="${j.id}">Abandon</button>`}</div>`;
}
function renderJobs(L, R) {
  const c = shipCap();
  L.innerHTML = `<h3>Job board — ${G.dockedAt.name}</h3>${D.board.length ? D.board.map((j) => jobRow(j, 'accept')).join('') : '<p>No contracts left. Check back after your next trip.</p>'}`;
  R.innerHTML = `<h3>Capacity — ${HULLS[G.hull].name}</h3><table class="st"><tr><td>Cargo hold</td><td>${usedCargo()} / ${c.cargo} t</td></tr><tr><td>Passenger bunks</td><td>${usedBunks()} / ${c.bunks}</td></tr></table>
    <p>Freighters (Mule, Atlas) carry bulk cargo; liners (Aurora) carry many passengers. Cargo pods and passenger modules add space to any hull.</p>
    <h3>Active jobs</h3>${G.jobs.length ? G.jobs.map((j) => jobRow(j, 'abandon')).join('') : '<p>None.</p>'}`;
}
function jobAction(a, id) {
  if (a === 'accept') {
    const j = D.board.find((x) => x.id === id);
    if (!j) return;
    const c = shipCap();
    if (j.type === 'cargo' && usedCargo() + j.amt > c.cargo) { flashDockMsg('Not enough cargo space'); return; }
    if (j.type === 'pax' && usedBunks() + j.amt > c.bunks) { flashDockMsg('Not enough passenger bunks'); return; }
    D.board = D.board.filter((x) => x !== j);
    G.jobs.push(j);
    for (const x of fullRoute(G.system, j.to.sys) || []) G.explored.add(x);
    if (!G.routeTo || G.routeTo === G.system) G.routeTo = j.to.sys !== G.system ? j.to.sys : null;
    hud.log(`Job accepted: ${jobTitle(j)} — ${isHunt(j) ? `hunt in ${SYSTEMS[j.to.sys].name}` : `to ${j.to.name}`}. Route charted.`, 'i');
  } else if (a === 'abandon') {
    const j = G.jobs.find((x) => x.id === id);
    if (!j) return;
    G.jobs = G.jobs.filter((x) => x !== j);
    hud.log(`Job abandoned: ${jobTitle(j)}.`, 'w');
  }
  saveGame();
}
function deliverJobs() {
  const here = G.dockedAt;
  for (const j of [...G.jobs]) {
    if (isHunt(j) || j.to.sys !== G.system || j.to.id !== here.id) continue;
    G.jobs = G.jobs.filter((x) => x !== j);
    G.credits += j.reward;
    hud.log(`Delivered: ${jobTitle(j)}. Paid ${fmtIsk(j.reward)}.`, 'g');
    flashDockMsg(`Job complete: +${fmtIsk(j.reward)}`);
    audio.beep(880, 0.12);
  }
}
function jobDestHere() {
  const j = G.jobs.find((x) => x.to.sys === G.system);
  if (!j) return null;
  return isHunt(j) ? LOCATIONS.find((l) => l.id === huntLoc(j)) : LOCATIONS.find((l) => l.id === j.to.id);
}

// a jump ticks deadlines and may tip off hijackers about valuable loads
function jumpedInto(def) {
  G.jumps++;
  for (const j of [...G.jobs]) if (jumpsLeft(j) < 0) { G.jobs = G.jobs.filter((x) => x !== j); hud.log(`Job failed — deadline missed: ${jobTitle(j)}.`, 'd'); }
  G.ambush = null;
  const risky = G.jobs.filter((j) => !isHunt(j) && j.risk > 0).sort((a, b) => b.risk - a.risk)[0];
  if (risky && Math.random() < 0.12 + risky.risk * 0.2 + (def.gov === 'pirate' ? 0.15 : 0)) G.ambush = { t: 8 + Math.random() * 10, job: risky.id, risk: risky.risk };
}
function spawnAmbush() {
  const A = G.ambush, p = G.player;
  G.ambush = null;
  const j = G.jobs.find((x) => x.id === A.job);
  if (!j) return;
  const kinds = [['raider', 'raider'], ['cutlass', 'raider', 'raider'], ['reaver', 'cutlass', 'raider'], ['reaver', 'cutlass', 'cutlass', 'raider']][A.risk];
  const c = p.obj.position.clone().add(_v.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.3, Math.random() - 0.5).normalize().multiplyScalar(5000));
  for (const kind of kinds) {
    const e = makeEntity(kind, 'pirate', c.clone().add(jitter(1500)), `Clan Hijacker ${HULLS[STATS[kind].hullId || 'raider'].name}`);
    e.ai.state = 'attack'; e.ai.raidJob = j.id;
    fx.flash(e.obj.position, e.ship.radius > 25 ? 300 : 80, 0x88bbff, 0.6);
  }
  hud.log(`Clan Hijackers: "We know what you're hauling. Drop your shields and let us board, and you might live."`, 'd');
  hud.notice('HIJACKERS — DO NOT LET THEM BOARD', 3);
  audio.beep(260, 0.3);
}
function spawnContract(j) {
  const docks = LOCATIONS.filter((l) => l.dock), gates = LOCATIONS.filter((l) => l.jump);
  const a = docks[Math.floor(Math.random() * docks.length)] || LOCATIONS[0], b = gates[Math.floor(Math.random() * gates.length)] || LOCATIONS[0];
  const pos = new THREE.Vector3().lerpVectors(a.pos, b.pos, 0.3 + Math.random() * 0.4).add(jitter(3000));
  const m = makeEntity('hauler', 'civil', pos, j.target.name, j.target.hull);
  m.className = `${HULLS[j.target.hull].cls} · CONTRACT TARGET`;
  m.ai.bountyJob = j.id; m.ai.a = a.pos; m.ai.b = b.pos; m.ai.dir = Math.random() < 0.5 ? 1 : -1; m.ai.state = 'cruise';
  m.obj.lookAt(m.ai.dir > 0 ? m.ai.b : m.ai.a);
  LOCATIONS.push({ id: 'contract', name: `Contract: ${j.target.name}`, type: `Last reported position · ${HULLS[j.target.hull].cls}`, pos: pos.clone(), arrive: 6000, icon: 'bounty' });
  hud.log(`Contract intel: ${j.target.name} is in this system with ${j.target.secret}, flying between ${a.name} and ${b.name}. Warp to "Contract: ${j.target.name}".`, 'w');
}
function spawnBounties(def) {
  const hit = G.jobs.find((j) => j.type === 'hit' && j.target.sys === def.id);
  if (hit) spawnContract(hit);
  for (const j of G.jobs) {
    if (j.type !== 'bounty' || j.target.sys !== def.id) continue;
    const anchor = LOCATIONS.find((l) => l.icon === 'outpost') || LOCATIONS.find((l) => l.icon === 'belt') || LOCATIONS.find((l) => l.jump);
    const pos = anchor.pos.clone().add(_v.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize().multiplyScalar(14000));
    const boss = makeEntity(j.target.hull, 'pirate', pos.clone(), j.target.name);
    boss.className = `BOUNTY · ${STATS[j.target.hull].cls}`;
    boss.ai.bountyJob = j.id; boss.ai.home.copy(pos);
    for (const kind of j.target.escorts) {
      const e = makeEntity(kind, 'pirate', pos.clone().add(jitter(3000)), `${j.target.name}'s ${HULLS[STATS[kind].hullId || 'raider'].name}`);
      e.ai.home.copy(pos);
    }
    LOCATIONS.push({ id: 'bounty', name: `Bounty: ${j.target.name}`, type: `Last known position of ${STATS[j.target.hull].cls}`, pos, arrive: 12000, icon: 'bounty' });
    hud.log(`Bounty intel: ${j.target.name} (${STATS[j.target.hull].cls}) is in this system. Warp to "Bounty: ${j.target.name}".`, 'w');
    break;
  }
}
function bountyKilled(e, source) {
  const j = G.jobs.find((x) => x.id === e.ai.bountyJob);
  if (!j) return;
  const hit = j.type === 'hit';
  const i = LOCATIONS.findIndex((l) => l.id === huntLoc(j));
  G.jobs = G.jobs.filter((x) => x !== j);
  if (source !== G.player) hud.log(`${e.name} died to someone else — ${hit ? 'contract void' : 'no bounty paid'}.`, 'w');
  else if (hit) {
    G.credits += j.reward; G.kills++;
    hud.log(`${e.name} destroyed with ${j.target.secret}. A numbered Combine account paid ${fmtIsk(j.reward)}.`, 'g');
    hud.notice(`CONTRACT FULFILLED — ${fmtIsk(j.reward).toUpperCase()}`, 4);
  } else {
    G.credits += j.reward;
    hud.log(`Bounty collected on ${e.name}: ${fmtIsk(j.reward)}.`, 'g');
    hud.notice(`BOUNTY COLLECTED — ${fmtIsk(j.reward).toUpperCase()}`, 4);
  }
  if (i >= 0) { if (G.navTarget === LOCATIONS[i]) G.navTarget = null; if (G.selected === LOCATIONS[i]) G.selected = null; LOCATIONS.splice(i, 1); }
}
// hijackers board a ship whose shields are down and steal the load
function updateJobs(dt) {
  if (G.ambush && (G.ambush.t -= dt) <= 0 && !G.warp) spawnAmbush();
  const p = G.player;
  if (!p.alive) return;
  const raiders = G.entities.filter((e) => e.alive && e.ai.raidJob && G.jobs.some((j) => j.id === e.ai.raidJob));
  const near = raiders.find((e) => e.obj.position.distanceTo(p.obj.position) < 1200 + e.ship.radius + p.ship.radius);
  if (near && p.shield < p.maxShield * 0.05) {
    G.boardT += dt;
    hud.notice(`BOARDING IN PROGRESS ${Math.ceil(5 - G.boardT)}s — RESTORE SHIELDS OR GET CLEAR`, 0.3);
    if (G.boardT > 5) {
      const j = G.jobs.find((x) => x.id === near.ai.raidJob);
      G.jobs = G.jobs.filter((x) => x !== j);
      G.boardT = 0;
      hud.log(`Hijackers seized ${j.type === 'pax' ? 'your passengers' : `the ${j.what.toLowerCase()}`}! Job failed: ${jobTitle(j)}.`, 'd');
      hud.notice(j.type === 'pax' ? 'PASSENGERS ABDUCTED' : 'CARGO STOLEN', 3);
      for (const e of raiders) if (e.ai.raidJob === j.id) { e.ai.state = 'flee'; e.ai.raidJob = null; }
    }
  } else G.boardT = Math.max(0, G.boardT - dt * 2);
}

const SAVE_KEY = 'gvcsg-save-v1';
function snapshot() {
  return { v: 1, hull: G.hull, owned: G.owned, inventory: G.inventory, credits: G.credits, kills: G.kills, ammo: G.ammo,
    explored: [...G.explored], dockSys: G.dockSys, dockId: G.dockId, turretsAuto: G.turretsAuto, jobs: G.jobs, access: G.access, jumps: G.jumps,
    hp: G.player ? [G.player.armor / G.player.maxArmor, G.player.hull / G.player.maxHull] : [1, 1] };
}
function saveGame(force = false) {
  if (G.state !== 'docked' && !force) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); } catch { /* storage unavailable */ }
}
function readSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    return s && s.v === 1 && HULLS[s.hull] && SYSTEMS[s.dockSys] ? s : null;
  } catch { return null; }
}
function applySave(s) {
  G.inventory = {};
  for (const [k, n] of Object.entries(s.inventory || {})) if (OUTFITS[k] && n > 0) G.inventory[k] = Math.floor(n);
  // fittings that no longer have a matching slot go back to the cargo hold
  G.owned = {};
  const spare = [];
  for (const [id, f] of Object.entries(s.owned || {})) if (HULLS[id]) G.owned[id] = normFit(id, f, spare);
  for (const x of spare) G.inventory[x] = (G.inventory[x] || 0) + 1;
  if (!G.owned[s.hull]) G.owned[s.hull] = emptyFit(s.hull);
  G.hull = s.hull;
  G.credits = Math.max(0, Number(s.credits) || 0);
  G.kills = Math.max(0, Number(s.kills) || 0);
  G.ammo = { rail: s.ammo?.rail ?? 40, missile: s.ammo?.missile ?? 24 };
  G.explored = new Set(['kaltos', s.dockSys, ...(s.explored || []).filter((x) => SYSTEMS[x])]);
  G.dockSys = s.dockSys;
  G.dockId = systemDef(s.dockSys).stations.some((st) => st.id === s.dockId) ? s.dockId : (systemDef(s.dockSys).stations[0]?.id || 'station');
  G.turretsAuto = s.turretsAuto !== false;
  G.jobs = Array.isArray(s.jobs) ? s.jobs.filter((j) => j && j.id && j.to && SYSTEMS[j.to.sys] && (j.type === 'bounty' ? STATS[j.target?.hull] : j.type === 'hit' ? HULLS[j.target?.hull] && SYSTEMS[j.target.sys] : true)) : [];
  G.access = s.access && typeof s.access === 'object' ? { ...s.access } : {};
  G.jumps = Math.max(0, Number(s.jumps) || 0);
  G.ambush = null; G.boardT = 0;
}
function dockStationName(sys, id) { return systemDef(sys).stations.find((st) => st.id === id)?.name || `your last station in ${SYSTEMS[sys].name}`; }
$('docked').addEventListener('click', () => setTimeout(saveGame, 0));
window.addEventListener('beforeunload', () => saveGame());

function flashDockMsg(t) { const h = $('dockhint'); h.textContent = t; h.style.color = '#fc6'; setTimeout(() => { h.textContent = 'Drag to orbit · Wheel to zoom'; h.style.color = ''; }, 2500); }

function rebuildPlayer() {
  const old = G.player;
  const e = makeEntity('player', 'player', old.obj.position.clone(), HULLS[G.hull].name);
  e.obj.quaternion.copy(old.obj.quaternion);
  e.armor = e.maxArmor * (old.armor / old.maxArmor);
  e.hull = Math.max(1, e.maxHull * (old.hull / old.maxHull));
  e.obj.visible = old.obj.visible;
  disposeShip(old.obj);
  G.entities.splice(G.entities.indexOf(old), 1);
  G.player = e;
  weaponInfo();
}

$('docktop').addEventListener('click', (ev) => { const b = ev.target.closest('.dtabs b'); if (b) setDockTab(b.dataset.tab); });
for (const id of ['dockleft', 'dockright']) {
  $(id).addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-a],[data-hull],[data-slot],[data-out],[data-cat]');
    if (!t) return;
    const fit = G.owned[G.hull];
    if (t.dataset.j) { jobAction(t.dataset.a, t.dataset.j); audio.ui(); renderDock(); return; }
    if (t.dataset.a === 'role') {
      const k = t.dataset.slot[0], i = +t.dataset.slot.slice(1);
      fit.r[k][i] = roleOf(fit, k, i) === 'primary' ? 'secondary' : 'primary';
      D.slot = { k, i }; D.preview = fit[k][i];
      rebuildPlayer(); hangarShow(G.hull, true); audio.ui(); renderDock(); return;
    }
    if (t.dataset.cat) { D.cat = t.dataset.cat; D.preview = null; hangar.setOutfit(null); audio.ui(); renderDock(); return; }
    if (t.dataset.hull) { D.browse = t.dataset.hull; hangarShow(D.browse); audio.ui(); }
    else if (t.dataset.slot) { D.slot = { k: t.dataset.slot[0], i: +t.dataset.slot.slice(1) }; const cur = fit[D.slot.k][D.slot.i]; D.preview = cur; D.cat = cur ? catOf(cur) : { g: 'gun', t: 'turret', m: 'bay' }[D.slot.k] || D.cat; D.focusSlot = MOUNT_KEYS.includes(D.slot.k); hangar.setOutfit(null); audio.ui(); }
    else if (t.dataset.out) {
      const kk = MOUNT_OF_CAT[catOf(t.dataset.out)];
      if (kk && D.slot.k !== kk && fit[kk].length) { D.slot = { k: kk, i: Math.max(0, fit[kk].indexOf(null)) }; D.focusSlot = true; }
      D.cat = catOf(t.dataset.out);
      D.preview = t.dataset.out; hangar.setOutfit(outfitPreview(D.preview, G.player.ship.M)); audio.ui();
    } else {
      const a = t.dataset.a, k = D.slot.k, i = D.slot.i;
      if (a === 'repair') { const c = repairCost(); if (G.credits >= c) { G.credits -= c; G.player.armor = G.player.maxArmor; G.player.hull = G.player.maxHull; } }
      if (a === 'rearm') { const c = rearmCost(); if (G.credits >= c) { G.credits -= c; G.ammo.rail = 40; G.ammo.missile = 24; } }
      if ((a === 'buy' || a === 'board') && !capOk(D.browse, G.owned[D.browse] || emptyFit(D.browse))) { flashDockMsg('That hull cannot carry your active cargo and passengers'); renderDock(); return; }
      if (a === 'buy') { const h = HULLS[D.browse]; if (G.credits >= h.price && yardOf()?.hulls.includes(D.browse)) { G.credits -= h.price; G.owned[D.browse] = emptyFit(D.browse); G.hull = D.browse; rebuildPlayer(); hangarShow(G.hull, true); hud.log(`Purchased ${h.cls} ${h.name}`, 'g'); } }
      if (a === 'board') { G.hull = D.browse; rebuildPlayer(); hangarShow(G.hull, true); }
      if (a === 'sellship' && G.owned[D.browse] && D.browse !== G.hull) {
        const h = HULLS[D.browse], f = G.owned[D.browse];
        for (const id of fitItems(f)) G.inventory[id] = (G.inventory[id] || 0) + 1;
        delete G.owned[D.browse];
        G.credits += h.price * 0.5;
        hud.log(`Sold ${h.cls} ${h.name} for ${fmtIsk(h.price * 0.5)}`, 'g');
      }
      if (a === 'fit' && D.preview) {
        const id = D.preview, O = OUTFITS[id], plan = planFit(id);
        if (plan.err || plan.same) { if (plan.err) flashDockMsg(plan.err); renderDock(); return; }
        const have = G.inventory[id] > 0;
        if (have) G.inventory[id]--; else if (shopOk(O) && G.credits >= O.price) G.credits -= O.price; else return;
        if (plan.old) G.inventory[plan.old] = (G.inventory[plan.old] || 0) + 1;
        G.owned[G.hull] = plan.tf;
        if (!MOUNT_KEYS.includes(plan.k)) D.slot = { k: plan.k, i: plan.i };
        rebuildPlayer(); hangarShow(G.hull, true); hangar.setOutfit(null);
      }
      if (a === 'unfit') {
        const old = fit[k][i], tf = cloneFit(fit);
        if (MOUNT_KEYS.includes(k)) tf[k][i] = null; else tf[k].splice(i, 1);
        if (old && !capOk(G.hull, tf)) { flashDockMsg('Active cargo or passengers need that module'); renderDock(); return; }
        if (old) { G.inventory[old] = (G.inventory[old] || 0) + 1; G.owned[G.hull] = tf; D.preview = null; rebuildPlayer(); hangarShow(G.hull, true); }
      }
      if (a === 'sell' && D.preview && G.inventory[D.preview] > 0) { G.inventory[D.preview]--; G.credits += OUTFITS[D.preview].price * 0.5; }
      audio.ui();
    }
    renderDock();
  });
}
canvas.addEventListener('wheel', (ev) => { if (G.state === 'docked') { ev.preventDefault(); hangar.zoom(ev.deltaY); } }, { passive: false });

function enterDocked() {
  G.state = 'docked';
  const p = G.player;
  p.shield = p.maxShield; p.cap = p.maxCap;
  p.vel.set(0, 0, 0); p.throttle = 0;
  G.lock = null; G.selected = null;
  $('docked').classList.remove('hidden');
  $('hud').classList.add('hidden');
  $('dockname').textContent = G.dockedAt.name.toUpperCase();
  const L0 = G.dockedAt, Y0 = yardOf();
  $('docksub').textContent = [L0.type, Y0 ? 'SHIPYARD' : null, L0.dock === 'pirate' ? 'BLACK-MARKET OUTFITTER' : isHigh() ? 'FULL OUTFITTER' : 'BASIC OUTFITTER', 'REPAIR', 'JOB BOARD'].filter(Boolean).join(' · ').toUpperCase();
  D.tab = 'services'; D.preview = null; D.browse = G.hull;
  deliverJobs();
  const bk = `${G.system}:${L0.id}:${G.jumps}`;
  if (D.boardAt !== bk) { D.board = makeBoard(); D.boardAt = bk; }
  hangar.setOutfit(null);
  hangarShow(G.hull);
  saveGame();
  hangar.snap();
  renderDock();
}
$('undock').onclick = () => {
  if (!G.player.stats.thrust) { flashDockMsg('Fit an engine before undocking'); return; }
  $('docked').classList.add('hidden'); undock();
};

function undock() {
  const p = G.player;
  const dock = world.docks[G.dockedAt.id];
  const b = bayWorld(dock, Math.floor(Math.random() * dock.bays.length));
  if (hangar) { hangar.restoreEnv(); hangar.setOutfit(null); }
  $('docked').classList.add('hidden');
  const r = p.ship.radius;
  let start, exit, end;
  if (b.pad) {
    start = b.pos.clone().addScaledVector(b.dir, r * 0.45 + 2);
    exit = b.pos.clone().addScaledVector(b.dir, r * 3 + 150);
    end = exit.clone().addScaledVector(b.fwd, r * 7 + 900).addScaledVector(b.dir, 1600);
  } else {
    start = b.pos.clone().addScaledVector(b.dir, -bayDepth(b, r));
    exit = b.pos.clone().addScaledVector(b.dir, r * 3 + 120);
    end = b.pos.clone().addScaledVector(b.dir, r * 7 + 900).addScaledVector(Y, 40);
  }
  p.obj.position.copy(start);
  if (b.pad) _m.lookAt(b.fwd, ORIGIN, b.dir); else _m.lookAt(b.dir, ORIGIN, Y);
  p.obj.quaternion.setFromRotationMatrix(_m);
  p.vel.set(0, 0, 0);
  camQuat.copy(p.obj.quaternion);
  G.state = 'undocking';
  G.stick.set(0, 0);
  G.aimActive = false;
  updateCamera(0.016);
  const path = [
    seg(0.4, [start, exit]),
    b.pad ? seg(0.6, [exit, exit.clone().addScaledVector(b.dir, lead(start.distanceTo(exit), 0.4, 0.6)), end.clone().addScaledVector(b.fwd, -500).addScaledVector(b.dir, -300), end])
      : seg(0.6, [exit, exit.clone().addScaledVector(b.dir, lead(start.distanceTo(exit), 0.4, 0.6)), end.clone().addScaledVector(b.dir, -260).addScaledVector(Y, -15), end]),
  ];
  startCine('undocking', b, path, b.pad ? 8 : 7, `${b.pad ? 'LIFTING OFF' : 'UNDOCKING'} — ${G.dockedAt.name.toUpperCase()}`);
  cineCamera();
  setFade(false);
}

function finishUndock() {
  const p = G.player;
  p.vel.copy(_v.set(0, 0, 1).applyQuaternion(p.obj.quaternion)).multiplyScalar(Math.max(120, p.vel.length()));
  p.throttle = 0.5;
  G.stick.set(0, 0);
  G.aimActive = false;
  playerAngVel.set(0, 0, 0);
  G.state = 'flying';
  $('hud').classList.remove('hidden');
  hud.log(`${G.dockedAt.kind === 'port' ? 'Lifted off from' : 'Undocked from'} ${G.dockedAt.name}`, 'i');
  const active = G.jobs.length;
  if (active) hud.log(`${active} active job${active > 1 ? 's' : ''}. Cargo ${usedCargo()} / ${shipCap().cargo} t, passengers ${usedBunks()} / ${shipCap().bunks}.`, 'i');
}

function playerDied() {
  const p = G.player;
  p.obj.visible = false;
  G.state = 'dead';
  G.warp = null; G.lock = null;
  G.input.fire1 = G.input.fire2 = false;
  hud.log('Your ship has been destroyed!', 'd');
  const sv = readSave();
  $('deadstation').textContent = sv ? `${dockStationName(sv.dockSys, sv.dockId)} (${SYSTEMS[sv.dockSys].name})` : dockStationName(G.dockSys, G.dockId);
  setTimeout(() => $('dead').classList.remove('hidden'), 2500);
}
$('respawn').onclick = () => {
  $('dead').classList.add('hidden');
  const sv = readSave();
  if (sv) applySave(sv);
  else { G.ammo.rail = 40; G.ammo.missile = 24; G.credits = Math.max(0, G.credits - 50000); }
  G.routeTo = null;
  enterSystem(G.dockSys, null);
  rebuildPlayer();
  const p = G.player;
  p.shield = p.maxShield; p.armor = p.maxArmor; p.hull = p.maxHull; p.cap = p.maxCap;
  p.obj.visible = true; p.alive = true;
  G.dockedAt = LOCATIONS.find((l) => l.id === G.dockId) || LOCATIONS.find((l) => l.dock);
  G.navTarget = null;
  hud.log(sv ? 'Clone revived. Everything has reverted to your last docked save.' : 'Clone revived.', 'i');
  enterDocked();
};

// ---------------------------------------------------------------- input
canvas.addEventListener('mousedown', (ev) => {
  G.mouse.set(ev.clientX, ev.clientY);
  if (ev.button === 1) ev.preventDefault();
  if (G.state === 'docked') { hangar.dragging = true; return; }
  if (G.state !== 'flying') return;
  if (ev.button === 0) { if (!G.lock && !G.ctrlTargeting) lockNearestToReticle(true); G.input.fire1 = true; }
  if (ev.button === 1) { G.input.mmb = true; lockMouse(); }
  if (ev.button === 2) { G.input.fire2 = true; fireBays(true); }
});
window.addEventListener('mouseup', (ev) => {
  if (ev.button === 0) G.input.fire1 = false;
  if (ev.button === 1) { G.input.mmb = false; if (!G.followToggle && G.mouseLocked) document.exitPointerLock(); }
  if (ev.button === 2) G.input.fire2 = false;
  if (hangar) hangar.dragging = false;
});
canvas.addEventListener('auxclick', (ev) => ev.preventDefault());
window.addEventListener('contextmenu', (ev) => ev.preventDefault());
window.addEventListener('mousemove', (ev) => {
  if (!G.mouseLocked) G.mouse.set(ev.clientX, ev.clientY);
  if (G.following && !G.warp && !G.freeLook && G.player) dragAim(ev.movementX, ev.movementY);
  if (G.state === 'docked' && hangar && hangar.dragging) { hangar.drag(ev.movementX, ev.movementY); return; }
  if (G.freeLook) {
    G.look.x = THREE.MathUtils.clamp(G.look.x - ev.movementX * 0.004, -Math.PI, Math.PI);
    G.look.y = THREE.MathUtils.clamp(G.look.y + ev.movementY * 0.004, -1.2, 1.2);
  }
});
function togglePause() {
  if (G.state !== 'flying' && G.state !== 'paused') return;
  const paused = G.state === 'paused';
  G.state = paused ? 'flying' : 'paused';
  $('pause').classList.toggle('hidden', paused);
  G.input.keys = {}; G.input.fire1 = G.input.fire2 = G.input.mmb = false;
  if (!paused) { G.followToggle = false; document.exitPointerLock?.(); }
  if (paused) audio.ctx?.resume();
  else audio.ctx?.suspend();
}
$('pausecontrols').innerHTML = document.querySelector('#menu .cols').outerHTML;
$('resume').addEventListener('click', togglePause);

window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Tab' || ev.code === 'Space' || ev.code.startsWith('Arrow') || ev.code.startsWith('Page') || ev.code === 'F1' || (ev.ctrlKey && G.state === 'flying')) ev.preventDefault();
  if (cine.mode) { if ((ev.code === 'Space' || ev.code === 'Escape') && !ev.repeat) skipCine(); return; }
  if (ev.code === 'Escape') { if (starmap.isOpen) starmap.toggle(false); else togglePause(); return; }
  if (ev.repeat) return;
  G.input.keys[ev.code] = true;
  if (ev.code === 'KeyM' && !ev.repeat && (G.state === 'flying' || G.state === 'docked')) { starmap.toggle(); audio.ui(); return; }
  if (G.state === 'docked' || G.state === 'menu' || G.state === 'paused') return;
  switch (ev.code) {
    case 'KeyX': G.player.throttle = 0; break;
    case 'KeyZ': G.flightAssist = !G.flightAssist; hud.notice(G.flightAssist ? 'FLIGHT ASSIST ON' : 'FLIGHT ASSIST OFF — NEWTONIAN', 1.5); audio.ui(); break;
    case 'KeyV': G.camMode = (G.camMode + 1) % 3; audio.ui(); break;
    case 'KeyC': G.freeLook = true; break;
    case 'KeyT': lockNearestToReticle(); break;
    case 'Tab': cycleHostile(); break;
    case 'KeyU': if (!G.lock && !G.ctrlTargeting) lockNearestToReticle(true); break;
    case 'KeyF': case 'Semicolon': fireBays(true); break;
    case 'KeyH': jumpKey(); break;
    case 'Space': warpKey(); break;
    case 'KeyG': tryDock(); break;
    case 'KeyN': setMouseFlight(!G.followToggle); hud.notice(G.followToggle ? 'MOUSE FLIGHT ON — MOVE MOUSE TO STEER (N)' : 'MOUSE FLIGHT OFF — HOLD MMB AND DRAG TO STEER', 1.8); audio.ui(); break;
    case 'KeyY': G.turretsAuto = !G.turretsAuto; hud.notice(G.turretsAuto ? 'TURRETS: AUTO-ENGAGE HOSTILES' : 'TURRETS: HOLD FIRE', 1.6); audio.ui(); break;
    case 'F1': toggleHelp(); break;
    case 'KeyP': hud.toggleOverview(); break;
    default:
      if (/^(Digit|Numpad)[1-9]$/.test(ev.code)) { const l = LOCATIONS[+ev.code.slice(-1) - 1]; if (!l) break; G.selected = l; G.navTarget = l; hud.ovT = 0; audio.ui(); hud.notice(`DESTINATION: ${l.name.toUpperCase()} — SPACE TO WARP`, 1.8); }
  }
});
window.addEventListener('keyup', (ev) => { G.input.keys[ev.code] = false; if (ev.code === 'KeyC') { G.freeLook = false; } });
window.addEventListener('blur', () => { G.input.keys = {}; G.input.fire1 = G.input.fire2 = G.input.mmb = false; });

hud.onSelect = (ref) => { G.selected = ref; if (ref.pos) G.navTarget = ref; else if (ref.ship) startLock(ref); hud.ovT = 0; audio.ui(); };
document.querySelectorAll('#selinfo button').forEach((b) => b.addEventListener('mousedown', (ev) => {
  ev.stopPropagation();
  const s = G.selected;
  if (b.dataset.act === 'warp') { if (s && s.pos) G.navTarget = s; if (s && s.jump && nearJump() === s) jumpKey(); else warpKey(); }
  if (b.dataset.act === 'lock') { if (s && s.ship) startLock(s); else hud.notice('SELECT A SHIP TO LOCK', 1.2); }
  if (b.dataset.act === 'dock') tryDock();
}));
function toggleHelp() {
  const h = $('help');
  if (h.classList.contains('hidden')) {
    $('helpbox').innerHTML = document.querySelector('#menu .cols').outerHTML + '<p style="margin-top:14px">Hold the middle mouse button and drag to set a heading: the ship turns to it and stops there (N toggles mouse flight). Each weapon is primary or secondary (switch it in the outfitter). Primary guns fire on their own when a hostile is within about 6° of the nose, and primary turrets fire at the most powerful hostile they can reach (Y toggles turret hold fire). Secondary guns, turrets and missile bays fire only while you hold LMB or U, and only the ones that can hit the locked target. RMB, ; or F fire just the missile bays. Hold right Ctrl and sweep the pointer over a ship to lock it. Shields regenerate after 4 s without damage. Lasers and plasma drain capacitor; railguns use slugs; missiles need a full lock. Dock (G) at Federation stations to repair and buy outfits; high-tech stations sell new hulls and high-tech modules. Space warps to the selected destination; H jumps at a gate (or warps to the gate on your route, then jumps). M opens the star map. The game saves while you are docked; if you die, everything reverts to that save. Press F1 to close. Press Esc to pause.</p>';
    h.classList.remove('hidden');
  } else h.classList.add('hidden');
}
$('help').addEventListener('mousedown', () => $('help').classList.add('hidden'));

// ---------------------------------------------------------------- camera
const camQuat = new THREE.Quaternion();
const camPos = new THREE.Vector3();
let fov = 68;
const FLIP = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI);
function updateCamera(dt) {
  const p = G.player;
  const warpI = G.warp && G.warp.phase === 'warp' ? Math.min(1, G.warp.speed / 20000) : 0;
  if (G.camMode === 1) camQuat.copy(p.obj.quaternion);
  else camQuat.slerp(p.obj.quaternion, 1 - Math.exp(-dt * (G.warp ? 3 : 5.5)));
  if (!G.freeLook) G.look.multiplyScalar(Math.exp(-dt * 5));
  const lookQ = _q.setFromEuler(_e.set(G.look.y, G.look.x, 0, 'YXZ'));
  const q = _q2.copy(camQuat).multiply(lookQ);
  let off;
  const cs = Math.max(0.7, p.ship.radius / 19);
  if (G.camMode === 0) off = _v.set(0, 8.5 * cs, -40 * cs);
  else if (G.camMode === 2) off = _v.set(0, 32 * cs, -125 * cs);
  else off = _v.copy(p.ship.cockpit);
  if (G.camMode === 1) {
    camPos.copy(off).applyQuaternion(p.obj.quaternion).add(p.obj.position);
    const lq = _q.copy(p.obj.quaternion).multiply(lookQ);
    camera.quaternion.copy(lq).multiply(FLIP);
  } else {
    camPos.copy(off).applyQuaternion(q).add(p.obj.position);
    // a slight velocity lag sells acceleration
    const lag = _v2.copy(p.vel).multiplyScalar(-0.012).clampLength(0, 6);
    if (!G.warp) camPos.add(lag);
    camera.quaternion.copy(q).multiply(FLIP);
    if (G.camMode === 0) camera.quaternion.multiply(_q.setFromAxisAngle(_v3.set(1, 0, 0), -0.025));
  }
  camera.position.copy(camPos);
  if (G.shake > 0.001) {
    const s = G.shake * G.shake * (G.camMode === 1 ? 0.25 : 0.6);
    camera.position.add(_v.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
    camera.rotateZ((Math.random() - 0.5) * s * 0.02);
    G.shake *= Math.exp(-dt * 5);
  }
  const target = 68 + G.boostFx * 7 + warpI * 26 + Math.min(4, p.vel.length() / 100);
  fov += (target - fov) * (1 - Math.exp(-dt * 3));
  camera.fov = fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return warpI;
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
// 60 fps cap plus adaptive render resolution
const perf = { acc: 0, n: 0 };
const fpsMeter = { n: 0, t: 0 };
// menu and pause screens only redraw when something changed
let staticDrawn = false, menuAcc = 0;
let msaa = 0;
function setMsaa(n) {
  msaa = n;
  for (const c of [composer, hangar && hangar.composer]) {
    if (!c) continue;
    for (const t of [c.renderTarget1, c.renderTarget2]) if (t.samples !== n) { t.samples = n; t.dispose(); }
  }
}
function adaptResolution(ms) {
  perf.acc += ms; perf.n++;
  if (perf.acc < 2000) return;
  const avg = perf.acc / perf.n;
  perf.acc = perf.n = 0;
  let pr = pixelRatio;
  // once resolution is at its floor, shed anti-aliasing: multisampled targets dominate fill cost on weak GPUs
  if (avg > 21 && pr <= prMin && msaa > 0) { setMsaa(msaa > 4 ? 4 : msaa > 2 ? 2 : 0); return; }
  if (avg > 21 && pr > prMin) pr = Math.max(prMin, pr - 0.1);
  else if (avg < 17.5 && pr < prMax) pr = Math.min(prMax, pr + 0.05);
  if (pr === pixelRatio) return;
  pixelRatio = pr;
  renderer.setPixelRatio(pr);
  resize();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (now - last < 1000 / 62) return;
  const ms = now - last;
  let dt = Math.min(0.05, ms / 1000);
  last = now;
  fpsMeter.n++; fpsMeter.t += ms;
  if (fpsMeter.t >= 500) {
    if (settings.fps) $('fps').textContent = `${Math.round(fpsMeter.n * 1000 / fpsMeter.t)} FPS · ${Math.round(pixelRatio * 100)}%`;
    fpsMeter.n = fpsMeter.t = 0;
  }
  if (G.state === 'menu' || G.state === 'paused') perf.acc = perf.n = 0;
  else adaptResolution(ms);
  if (world) world.stars.material.uniforms.uPixel.value = pixelRatio;
  if (!world || !G.player) return;
  G.time += dt;
  if (starmap.isOpen) starmap.draw(G.time);
  const p = G.player;
  if (document.body.dataset.state !== G.state) document.body.dataset.state = G.state;
  G.following = G.state === 'flying' && (G.input.mmb || G.followToggle);
  if (G.state === 'docked') { hangar.update(dt); hangar.render(); return; }
  if (G.state === 'paused') { if (!staticDrawn) { composer.render(0); staticDrawn = true; } return; }
  if (G.state === 'menu') {
    menuAcc += dt;
    if (staticDrawn && menuAcc < 0.1) return;
    dt = Math.min(0.1, menuAcc); menuAcc = 0; staticDrawn = true;
  }
  if (G.state === 'flying' || G.state === 'dead' || G.state === 'docking' || G.state === 'undocking' || G.state === 'jumpout' || G.state === 'jumpin') {
    updatePlayer(dt);
    // capacitor and shield regeneration
    p.cap = Math.min(p.maxCap, p.cap + p.stats.capRegen * dt);
    if (G.time - p.lastHit > 4 && p.alive) p.shield = Math.min(p.maxShield, p.shield + p.stats.shieldRegen * dt);
    if (p.stats.armorRegen && p.alive) p.armor = Math.min(p.maxArmor, p.armor + p.stats.armorRegen * dt);
    for (const e of G.entities) {
      if (e === p || !e.alive) continue;
      if (e.obj.position.distanceTo(p.obj.position) < 80000 || e.kind === 'hauler') updateAI(e, dt);
      if (G.time - e.lastHit > 6) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.01 * dt);
    }
    G.scrambled = !G.warp && G.entities.some((e) => e.alive && (e.kind === 'cruiser' || e.stats.scram) && e.ai.state === 'attack' && e.obj.position.distanceTo(p.obj.position) < 15000);
    updateEncounters(dt);
    updateJobs(dt);
    updateLock(dt);
  }
  cineStep(dt);
  const warpI = updateCamera(dt);
  cineCamera();
  updateCtrlTargeting();
  G.aimPoint.copy(camera.position).addScaledVector(G.aimDir, 5000);
  if (G.state === 'flying') playerWeapons(dt);
  const colliders = world.collidersNear(p.obj.position, 7000);
  bolts.update(dt, G.entities, colliders, onBoltHit);
  missiles.update(dt, colliders, onMissileDetonate);
  // ship cosmetics; the player's engine glow eases toward its target so afterburner and warp don't flare abruptly
  G.boostFx += ((G.boosting ? 1 : 0) - G.boostFx) * (1 - Math.exp(-dt * (G.boosting ? 2.2 : 1.6)));
  const engT = G.warp ? 1 : p.throttle + (Math.max(p.throttle, 1.4) - p.throttle) * G.boostFx;
  G.engFx += (engT - G.engFx) * (1 - Math.exp(-dt * 4));
  for (const e of G.entities) {
    if (!e.alive) continue;
    const thr = e === p ? G.engFx : e.throttle;
    animateShip(e.ship, dt, G.time, thr);
    const sm = e.shieldMesh;
    if (sm.visible) { sm.material.uniforms.uTime.value = G.time; if (G.time - e.shieldLast > 1) sm.visible = false; }
    // damaged ships trail smoke and fire
    if (e.hull < e.maxHull * 0.5 && Math.random() < dt * 25) {
      const hs = e.ship.hitSpheres[Math.floor(Math.random() * e.ship.hitSpheres.length)];
      const hp = _v.set(hs[0], hs[1], hs[2]).applyQuaternion(e.obj.quaternion).add(e.obj.position);
      fx.trail(hp, _v2.copy(e.vel).multiplyScalar(0.6), e.ship.radius * 0.08 + 0.6, 2, e.hull < e.maxHull * 0.25);
    }
  }
  world.update(dt, camera, p.obj.position);
  world.dust.update(camera.position, G.warp ? _v.set(0, 0, 0) : p.vel);
  // warp tunnel aligned to travel direction around the camera
  const wl = world.warp.lines;
  wl.position.copy(camera.position);
  const jw = cine.mode === 'jumpout' || cine.mode === 'jumpin' ? cine.warpFx : 0;
  if (G.warp || jw > 0) wl.lookAt(_v.copy(camera.position).sub(_v2.copy(p.vel).normalize()));
  const tunnel = Math.max(warpI, jw);
  world.warp.update(dt, tunnel, 2500 + tunnel * 9000);
  fx.update(dt, camera);
  G.hitFlash *= Math.exp(-dt * 3);
  lensPass.uniforms.uWarp.value = tunnel;
  lensPass.uniforms.uHit.value = G.hitFlash;
  audio.update(p.throttle, G.boostFx, tunnel);
  // nearest named location
  let best = Infinity;
  for (const l of LOCATIONS) { const d = l.pos.distanceTo(p.obj.position) - l.arrive; if (d < best) { best = d; G.nearestName = d < 30000 ? l.name : `Deep space near ${l.name}`; } }
  if (G.state === 'flying' || G.state === 'dead') hud.update(dt, G);
  if (G.autoJump && !G.warp) { const g = G.autoJump; G.autoJump = null; if (G.state === 'flying' && nearJump() === g) startJump(g); }
  const jp = G.state === 'flying' && !G.warp && nearJump();
  const jh = jp ? `JUMP GATE IN RANGE — H TO JUMP TO ${G.explored.has(jp.jump) ? SYSTEMS[jp.jump].name.toUpperCase() : 'UNCHARTED SYSTEM'}` : '';
  if ($('jumphint').textContent !== jh) $('jumphint').textContent = jh;
  composer.render(dt);
  holo.render(renderer, G.state === 'flying' ? hud.shown : null, camera, G.time, dt);
}

// ---------------------------------------------------------------- star systems
const starmap = new StarMap(G);
const NAVY_NAMES = ['HNS Vigilant', 'HNS Swift', 'HNS Harrier', 'HNS Bulwark', 'HNS Talon', 'HNS Resolute', 'HNS Aegis', 'HNS Lancer', 'HNS Sentinel', 'HNS Valor'];
const HAULER_LINES = ['Orca Logistics', 'Kaltos Freight', 'Vexal Trading Co.', 'Helion Supply', 'Aster Bulk Lines'];
// civilian traffic: the classic hauler plus catalogue freighters and liners
const CIVIL_TYPES = [[null, 'Hauler'], ['mule', 'Freighter'], ['atlas', 'Bulk Freighter'], ['aurora', 'Liner']];
const LINER_LINES = ['Aurora Starlines', 'Helion Spaceways', 'Mirel Cruise Lines', 'Tessaly Interstellar'];
const CORP_CIVIL = [['crate', 'Vanta Logistics Crate'], ['crate', 'Combine Freight Division Crate'], ['commuter', 'Vanta Labour Transit Commuter']];
const secName = (kind) => `Combine Security ${HULLS[STATS[kind].hullId].name} ${String(100 + Math.floor(Math.random() * 900))}`;
const jitter = (s) => new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s * 0.3, (Math.random() - 0.5) * s);

function populate(def, from) {
  const gates = LOCATIONS.filter((l) => l.jump);
  if (def.gov === 'gov') {
    let ni = 0;
    for (const st of LOCATIONS.filter((l) => l.dock)) {
      const kinds = st.dock === 'high' ? ['navyWarden', 'navyKestrel', 'navyKestrel', 'navyBastion', 'navyMantis', 'navySabre'] : st.kind === 'station' ? ['navyKestrel', 'navyMantis', 'navyWarden'].slice(0, Math.round(def.sec * 3)) : ['navyKestrel'].slice(0, def.sec >= 0.5 ? 1 : 0);
      const home = st.up ? st.pos.clone().addScaledVector(st.up, 5000) : st.pos;
      for (const kind of kinds) {
        const n = makeEntity(kind, 'navy', home.clone().add(jitter(6000)), NAVY_NAMES[ni++ % NAVY_NAMES.length]);
        n.ai.seed = Math.random(); n.ai.home.copy(home);
      }
    }
    const hub = LOCATIONS.find((l) => l.dock);
    if (hub) for (let i = 0; i < (def.sec >= 0.6 ? 3 : 2); i++) {
      const gate = gates[i % gates.length];
      const pos = new THREE.Vector3().lerpVectors(hub.pos, gate.pos, 0.15 + i * 0.3).add(jitter(3000));
      const [civ, label] = CIVIL_TYPES[Math.floor(Math.random() * CIVIL_TYPES.length)];
      const lines = civ === 'aurora' ? LINER_LINES : HAULER_LINES;
      const h = makeEntity('hauler', 'civil', pos, `${lines[Math.floor(Math.random() * lines.length)]} ${label}`, civ);
      h.ai.a = hub.pos; h.ai.b = gate.pos; h.ai.dir = i % 2 ? 1 : -1; h.ai.state = 'cruise';
      h.obj.lookAt(h.ai.dir > 0 ? h.ai.b : h.ai.a);
    }
  } else if (def.gov === 'corp') {
    // Combine Security: cheap hulls in numbers, guarding company property; licensed traffic is left alone
    for (const st of LOCATIONS.filter((l) => l.dock)) {
      const kinds = st.kind === 'tower' ? (def.hq ? ['secCompliance', 'secCompliance', 'secEnforcer', 'secEnforcer', 'secUnit', 'secUnit', 'secUnit'] : ['secCompliance', 'secEnforcer', 'secUnit', 'secUnit']) : ['secEnforcer', 'secUnit'];
      const home = st.up ? st.pos.clone().addScaledVector(st.up, 5000) : st.pos;
      for (const kind of kinds) makeEntity(kind, 'corp', home.clone().add(jitter(6000)), secName(kind)).ai.home.copy(home);
    }
    for (const g of gates) for (let i = 0; i < 2; i++) makeEntity('secUnit', 'corp', g.pos.clone().add(jitter(5000)), secName('secUnit')).ai.home.copy(g.pos);
    const hub = LOCATIONS.find((l) => l.dock);
    if (hub) for (let i = 0; i < 3; i++) {
      const gate = gates[i % gates.length];
      const pos = new THREE.Vector3().lerpVectors(hub.pos, gate.pos, 0.15 + i * 0.3).add(jitter(3000));
      const [civ, label] = CORP_CIVIL[Math.floor(Math.random() * CORP_CIVIL.length)];
      const h = makeEntity('hauler', 'civil', pos, label, civ);
      h.ai.a = hub.pos; h.ai.b = gate.pos; h.ai.dir = i % 2 ? 1 : -1; h.ai.state = 'cruise';
      h.obj.lookAt(h.ai.dir > 0 ? h.ai.b : h.ai.a);
    }
  } else {
    // lawless space: raider gangs lurk off the gates you didn't arrive through
    for (const g of gates) {
      if (g.jump === from || Math.random() < 0.35) continue;
      const home = g.pos.clone().add(jitter(9000));
      for (let i = 0; i < def.danger; i++) {
        const kind = Math.random() < 0.3 ? 'cutlass' : 'raider';
        const e = makeEntity(kind, 'pirate', home.clone().add(jitter(1500)), pirateName(kind));
        e.ai.seed = Math.random(); e.ai.home.copy(home);
      }
    }
  }
}

function nextHop() {
  if (!G.routeTo || G.routeTo === G.system) { G.routeTo = null; return null; }
  const path = route(G.system, G.routeTo, G.explored);
  if (!path || path.length < 2) { G.routeTo = null; return null; }
  return LOCATIONS.find((l) => l.jump === path[1]) || null;
}
starmap.onRoute = () => {
  const hop = nextHop();
  if (!hop) return;
  G.navTarget = hop; G.selected = hop; hud.ovT = 0;
  hud.notice(`ROUTE SET: ${hop.name.toUpperCase()} — H TO JUMP`, 2.5);
};

function updateSysInfo(def) {
  $('sysname').textContent = def.name;
  const sec = $('syssec');
  sec.textContent = def.sec.toFixed(1);
  sec.style.color = def.sec >= 0.5 ? '#6f6' : def.sec > 0 ? '#f0a020' : '#f44';
  const gv = $('sysgov');
  gv.textContent = `${GOVS[def.gov].name} · ${def.starInfo.name}`;
  gv.style.color = GOVS[def.gov].color;
  document.title = `GVCSG — ${def.name} · Generic Vibe Coded Space Game`;
}

function enterSystem(to, from) {
  for (const e of [...G.entities]) if (e !== G.player) removeEntity(e);
  for (let i = bolts.list.length - 1; i >= 0; i--) bolts.kill(bolts.list[i], i);
  for (const m of missiles.list) scene.remove(m.obj);
  missiles.list.length = 0;
  const fresh = !G.explored.has(to);
  G.explored.add(to);
  G.system = to;
  const def = systemDef(to);
  world.load(def, G.explored);
  G.selected = null; G.lock = null; G.leadPoint = null; G.warp = null; G.autoJump = null; G.scrambled = false; G.aimActive = false;
  encounters = buildEncounters(def);
  const back = from && LOCATIONS.find((l) => l.jump === from);
  if (back) {
    const p = G.player;
    const out = back.pos.clone().negate().normalize();
    p.obj.position.copy(back.pos).addScaledVector(out, 1800).add(jitter(300));
    _m.lookAt(out, ORIGIN, Y);
    p.obj.quaternion.setFromRotationMatrix(_m);
    p.vel.copy(out).multiplyScalar(200);
    playerAngVel.set(0, 0, 0);
    camQuat.copy(p.obj.quaternion);
  }
  populate(def, from);
  if (from) jumpedInto(def);
  spawnBounties(def);
  G.navTarget = nextHop() || jobDestHere() || LOCATIONS.find((l) => l.dock) || LOCATIONS.find((l) => l.icon === 'belt') || LOCATIONS[0];
  updateSysInfo(def);
  hud.ovT = 0;
  if (starmap.isOpen) starmap.renderInfo();
  if (from) {
    hud.notice(`${def.name.toUpperCase()} — ${GOVS[def.gov].name.toUpperCase()}`, 3.5);
    hud.log(`Jumped into ${def.name} (${GOVS[def.gov].name}, security ${def.sec.toFixed(1)}).`, def.gov === 'pirate' ? 'd' : 'i');
    if (def.gov === 'pirate') hud.log('Warning: lawless space. No navy; pirate ports demand a bribe before you can land.', 'w');
    if (def.gov === 'corp') hud.log('Vanta Combine space: every port, rock and lane here is company property. Combine Security will not interfere with licensed traffic.', 'i');
  }
  if (fresh) hud.log(`New system charted: ${def.name}, ${def.starInfo.name}. It now appears on the star map (M).`, 'g');
}

function nearJump() {
  const pp = G.player.obj.position;
  let best = null, bd = 3500;
  for (const l of LOCATIONS) if (l.jump) { const d = l.pos.distanceTo(pp); if (d < bd) { bd = d; best = l; } }
  return best;
}

function warpKey() {
  if (G.state !== 'flying' || G.warp) return;
  const jp = nearJump();
  if (jp && (!G.navTarget || G.navTarget === jp)) { hud.notice('IN JUMP RANGE — PRESS H TO JUMP', 1.6); return; }
  warpTo(G.navTarget);
}

function jumpKey() {
  if (G.state !== 'flying' || G.warp) return;
  const jp = nearJump();
  if (jp) { startJump(jp); return; }
  const gate = (G.navTarget && G.navTarget.jump && G.navTarget) || nextHop();
  if (!gate) { hud.notice('SELECT A JUMP GATE OR PLOT A ROUTE (M)', 1.8); audio.beep(220, 0.15); return; }
  G.navTarget = gate; G.selected = gate; hud.ovT = 0;
  warpTo(gate);
  if (G.warp) G.autoJump = gate;
}

function startJump(jp) {
  const p = G.player;
  if (G.scrambled) { hud.notice('JUMP DRIVE DISRUPTED', 1.8); audio.beep(220, 0.2); return; }
  if (p.cap < 150) { hud.notice('INSUFFICIENT CAPACITOR FOR JUMP', 1.8); return; }
  p.cap -= 120;
  G.state = 'jumpout';
  G.input.fire1 = G.input.fire2 = G.input.mmb = false;
  G.aimActive = false;
  const to = jp.jump, from = G.system;
  // fly through the ring along its axis, entering from whichever side the ship is on
  const n = jp.pos.clone().negate().normalize();
  if (_v.copy(p.obj.position).sub(jp.pos).dot(n) > 0) n.negate();
  const pp = p.obj.position.clone();
  const fwd = _v.set(0, 0, 1).applyQuaternion(p.obj.quaternion);
  const dist = pp.distanceTo(jp.pos);
  const r = p.ship.radius;
  const A = jp.pos.clone().addScaledVector(n, -(r * 6 + 500));
  const E = jp.pos.clone().addScaledVector(n, trailBack(r) + r * 2 + 80);
  const path = [
    seg(0.55, [pp, pp.clone().addScaledVector(fwd, Math.min(600, dist * 0.3)), A.clone().addScaledVector(n, -Math.max(lead(A.distanceTo(E), 0.45, 0.55), dist * 0.25)), A]),
    seg(0.45, [A, E]),
  ];
  Object.assign(cine, { gate: jp, to, from, warpFx: 0 });
  startCine('jumpout', { pos: jp.pos, dir: n }, path, 4.2 + dist / 2500, `JUMPING TO ${G.explored.has(to) ? SYSTEMS[to].name.toUpperCase() : 'UNCHARTED SYSTEM'}`);
  audio.ui();
}

function arriveJump(to, from) {
  enterSystem(to, from);
  const p = G.player;
  p.obj.visible = true;
  const back = LOCATIONS.find((l) => l.jump === from);
  setFade(false);
  audio.warpEnd();
  if (!back) { finishJump(); return; }
  G.state = 'jumpin';
  const end = p.obj.position.clone();
  const out = end.clone().sub(back.pos).normalize();
  const r = p.ship.radius;
  // the ship and camera both start just behind the event horizon and emerge through it
  const S = back.pos.clone().addScaledVector(out, -(r * 0.5 + 10));
  const X = back.pos.clone().addScaledVector(out, r * 4 + 300);
  const path = [
    seg(0.35, [S, X]),
    seg(0.65, [X, X.clone().addScaledVector(out, lead(S.distanceTo(X), 0.35, 0.65)), end.clone().addScaledVector(out, -500), end]),
  ];
  p.obj.position.copy(S);
  const def = SYSTEMS[to];
  Object.assign(cine, { gate: back, to, from, warpFx: 1 });
  startCine('jumpin', { pos: back.pos, dir: out }, path, 4.5, `${def.name.toUpperCase()} — ${GOVS[def.gov].name.toUpperCase()}`);
  fx.flash(back.pos, 1400, 0x9fc8ff, 0.9);
  G.shake = 0.8;
  cineCamera();
}

function finishJump() {
  const p = G.player;
  p.obj.visible = true;
  if (cine.gate && cine.gate.horizon) cine.gate.horizon.value = 0;
  cine.warpFx = 0;
  p.vel.copy(_v.set(0, 0, 1).applyQuaternion(p.obj.quaternion)).multiplyScalar(Math.max(200, p.vel.length()));
  p.throttle = 0.5;
  G.boosting = false;
  G.stick.set(0, 0);
  playerAngVel.set(0, 0, 0);
  camQuat.copy(p.obj.quaternion);
  G.state = 'flying';
  $('hud').classList.remove('hidden');
}

$('mapbtn').addEventListener('mousedown', (ev) => { ev.stopPropagation(); starmap.toggle(); });
$('dockmap').addEventListener('click', () => starmap.toggle());

// ---------------------------------------------------------------- boot
async function boot() {
  const msg = $('loadmsg');
  const step = (t) => new Promise((r) => { msg.textContent = t; setTimeout(r, 30); });
  try {
    await step('Generating star system…');
    world = buildWorld(renderer, scene);
    fx = new Effects(scene);
    bolts = new Projectiles(scene, fx);
    missiles = new Missiles(scene, fx, world.env);
    await step('Assembling ships…');
    const save = readSave();
    if (save) applySave(save);
    G.player = makeEntity('player', 'player', new THREE.Vector3(), HULLS[G.hull].name);
    if (save && Array.isArray(save.hp)) {
      const [a, h] = save.hp.map((x) => Math.min(1, Math.max(0.05, Number(x) || 1)));
      G.player.armor = G.player.maxArmor * a; G.player.hull = G.player.maxHull * h;
    }
    weaponInfo();
    enterSystem(G.dockSys, null);
    G.dockedAt = LOCATIONS.find((l) => l.id === G.dockId) || LOCATIONS.find((l) => l.dock);
    G.navTarget = LOCATIONS.find((l) => l.icon === 'belt') || LOCATIONS.find((l) => l.jump);
    undockPose();
    await step('Compiling shaders…');
    const fonts = Promise.race([Promise.all(['600 120px "Chakra Petch"', '44px "Chakra Petch"', '30px "Share Tech Mono"', '10px "Mono Digits"'].map((f) => document.fonts.load(f, 'A0'))), new Promise((r) => setTimeout(r, 2000))]).catch(() => {});
    renderer.compile(scene, camera);
    await step('Pressurising hangar bay…');
    await fonts;
    hangar = new Hangar(renderer);
    applyGfx(settings.gfx);
    composer.render(0.016);
    msg.textContent = 'Systems online.';
    const start = $('start');
    start.disabled = false; start.textContent = save ? 'Continue' : 'Undock';
    if (save) $('newgame').classList.remove('hidden');
    $('newgame').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ } location.reload(); };
    start.onclick = () => {
      audio.init();
      $('menu').classList.add('hidden');
      $('newgame').classList.add('hidden');
      if (save) {
        hud.log(`Save loaded: ${G.dockedAt.name}, ${SYSTEMS[G.system].name}. ${G.explored.size} system${G.explored.size > 1 ? 's' : ''} charted, ${fmtIsk(G.credits)}.`, 'i');
        hud.log('Space warps, H jumps at a gate, M opens the star map. The game saves while you are docked.', 'i');
        enterDocked();
        return;
      }
      saveGame(true);
      const num = (f) => LOCATIONS.findIndex(f) + 1;
      hud.log('Welcome to GVCSG - Generic Vibe Coded Space Game. Pirates reported at Kaltos III - Asteroid Belt 1.', 'i');
      hud.log(`Press ${num((l) => l.icon === 'belt')} then Space to warp to the belt. Hold MMB and drag to steer, hold R-Ctrl to target.`, 'i');
      hud.log(`New hulls and high-tech outfits: Helion Orbital Shipyard (${num((l) => l.id === 'shipyard')}). Jump gates lead to other systems; M opens the star map, H jumps.`, 'i');
      undock();
    };
  } catch (err) {
    console.error(err);
    msg.textContent = `Error: ${err.message}`;
  }
}

// ---------------------------------------------------------------- settings: graphics preset and FPS counter
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ } }
function applyGfx(name) {
  const q = GFX[name] || GFX.normal;
  settings.gfx = GFX[name] ? name : 'normal';
  prMax = Math.min(window.devicePixelRatio || 1, q.prMax); prMin = Math.min(prMax, q.prMin);
  pixelRatio = prMax;
  renderer.setPixelRatio(pixelRatio);
  const type = q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  const recompile = renderer.shadowMap.enabled !== q.shadow > 0 || renderer.shadowMap.type !== type;
  renderer.shadowMap.enabled = q.shadow > 0;
  renderer.shadowMap.type = type;
  if (world) world.setQuality(q);
  if (hangar) hangar.setQuality(q);
  setMsaa(q.msaa);
  if (recompile) for (const s of [scene, hangar && hangar.scene]) s?.traverse((o) => { for (const m of [].concat(o.material || [])) m.needsUpdate = true; });
  perf.acc = perf.n = 0;
  resize();
  saveSettings();
  for (const b of document.querySelectorAll('[data-gfx]')) b.classList.toggle('on', b.dataset.gfx === settings.gfx);
  for (const d of document.querySelectorAll('.opts .odesc')) d.textContent = q.desc;
}
function setFps(on) {
  settings.fps = on;
  $('fps').classList.toggle('hidden', !on);
  $('fps').textContent = '';
  for (const c of document.querySelectorAll('[data-fps]')) c.checked = on;
  saveSettings();
}
for (const el of document.querySelectorAll('.opts')) {
  el.innerHTML = `<span class="ol">Graphics</span><span class="seg">${Object.entries(GFX).map(([k, q]) => `<b data-gfx="${k}">${q.label}</b>`).join('')}</span>`
    + '<label class="chk"><input type="checkbox" data-fps> Show FPS</label><div class="odesc"></div>';
}
document.addEventListener('click', (ev) => { const b = ev.target.closest('[data-gfx]'); if (b) applyGfx(b.dataset.gfx); });
document.addEventListener('change', (ev) => { if (ev.target.matches('[data-fps]')) { setFps(ev.target.checked); ev.target.blur(); } });
setFps(settings.fps);
for (const b of document.querySelectorAll('[data-gfx]')) b.classList.toggle('on', b.dataset.gfx === settings.gfx);
for (const d of document.querySelectorAll('.opts .odesc')) d.textContent = GFX[settings.gfx].desc;

function undockPose() {
  const st = (world.docks[G.dockedAt?.id] || Object.values(world.docks)[0]).root;
  const a = Math.PI / 4;
  const p = G.player;
  if (G.dockedAt?.up) p.obj.position.copy(new THREE.Vector3(Math.cos(a) * 1400, 900, Math.sin(a) * 1400).applyQuaternion(st.quaternion).add(st.position));
  else p.obj.position.copy(new THREE.Vector3(Math.cos(a) * 900, -180, Math.sin(a) * 900).applyQuaternion(st.quaternion).add(st.position));
  p.obj.lookAt(st.position);
  p.obj.rotateY(0.6);
  camQuat.copy(p.obj.quaternion);
  updateCamera(0.016);
}

// debug/testing hook
window.__game = { G, holo, hud, cine, camera, renderer, get fx() { return fx; }, get bolts() { return bolts; }, settings, applyGfx, LOCATIONS, SYSTEMS, get world() { return world; }, get hangar() { return hangar; }, get starmap() { return starmap; }, makeEntity, warpTo, startLock, damage, enterSystem, warpKey, jumpKey, nearJump, saveGame, readSave, tryDock, D, renderDock, setDockTab, STATS, destroy, enterDocked };
requestAnimationFrame(frame);
boot();
