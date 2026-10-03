import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, LOCATIONS, PLANET, MOON } from './world.js';
import { buildRaider, buildCruiser, buildHauler, animateShip } from './ships.js';
import { HULLS, HULL_ORDER, OUTFITS, emptyFit, buildFitted, outfitPreview, fittedStats } from './catalog.js';
import { Hangar } from './hangar.js';
import { Effects, Projectiles, Missiles, attachShield, intercept, raySphere } from './combat.js';
import { Audio } from './audio.js';
import { HUD, fmtDist } from './hud.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0), ORIGIN = new THREE.Vector3();

// ---------------------------------------------------------------- renderer
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.3, 3e6);

const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.42, 0.45, 0.92);
composer.addPass(bloom);
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
  composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  lensPass.uniforms.uAspect.value = w / h;
  if (hangar) hangar.resize(w, h);
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- game state
const audio = new Audio();
const hud = new HUD();
let world, fx, bolts, missiles, hangar;

const G = {
  state: 'menu', camera, entities: [], locations: LOCATIONS, player: null,
  selected: null, navTarget: LOCATIONS[1], lock: null, leadPoint: null, warp: null, scrambled: false,
  stick: new THREE.Vector2(), freeLook: false, look: new THREE.Vector2(),
  mouse: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), following: false, followToggle: false,
  ctrlTargeting: false, ctrlHover: null, ctrlRadius: 110,
  input: { fire1: false, fire2: false, mmb: false, keys: {} }, flightAssist: true, boosting: false, camMode: 0,
  credits: 250000, kills: 0, ammo: { rail: 40, missile: 24 }, cool: { pri: 0, sec: 0, missile: 0 },
  priOff: false, secOff: false, usesAmmo: true, leadSpeed: 3200,
  hull: 'valkyrie', owned: { valkyrie: emptyFit('valkyrie') }, inventory: {}, dockedAt: LOCATIONS[0],
  nearestName: '', time: 0, shake: 0, hitFlash: 0,
};

const STATS = {
  raider: { cls: 'Corsair Raider', shield: 210, armor: 170, hull: 150, speed: 330, accel: 150, turn: 1.25, bounty: 18500, sig: 0.6 },
  cruiser: { cls: 'Corsair Marauder Cruiser', shield: 1700, armor: 2300, hull: 1900, speed: 95, accel: 20, turn: 0.22, bounty: 145000, sig: 3 },
  hauler: { cls: 'Bestower Hauler', shield: 500, armor: 1100, hull: 1000, speed: 140, accel: 15, turn: 0.28, bounty: 0, sig: 3 },
  navyKestrel: { cls: 'Helion Navy Kestrel', shield: 520, armor: 380, hull: 340, speed: 330, accel: 130, turn: 1.1, bounty: 0, sig: 0.6 },
  navyWarden: { cls: 'Helion Navy Warden', shield: 1800, armor: 1700, hull: 1300, speed: 175, accel: 50, turn: 0.4, bounty: 0, sig: 1.8 },
};
const NAVY_HULL = { navyKestrel: 'kestrel', navyWarden: 'warden' };
const PIRATE_NAMES = ['Corsair Raider', 'Corsair Cutthroat', 'Corsair Wrecker', 'Corsair Outlaw', 'Corsair Plunderer', 'Corsair Despoiler'];
const PROFILES = { em: { s: 1.25, a: 0.7, h: 1 }, kinetic: { s: 0.85, a: 1.2, h: 1 }, explosive: { s: 0.9, a: 1.1, h: 1.2 }, thermal: { s: 1.0, a: 0.95, h: 1.1 } };

function setShadows(obj) {
  obj.traverse((o) => {
    if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { o.castShadow = true; o.receiveShadow = true; }
  });
}

function makeEntity(kind, faction, pos, name) {
  const env = world.env;
  let ship, s = STATS[kind];
  if (kind === 'player') {
    const fit = G.owned[G.hull];
    ship = buildFitted(G.hull, fit, env);
    s = fittedStats(G.hull, fit);
  } else if (NAVY_HULL[kind]) ship = buildFitted(NAVY_HULL[kind], emptyFit(NAVY_HULL[kind]), env, 'navy');
  else ship = kind === 'raider' ? buildRaider(env) : kind === 'cruiser' ? buildCruiser(env) : buildHauler(env, 1 + Math.floor(Math.random() * 50));
  setShadows(ship.group);
  ship.group.position.copy(pos);
  scene.add(ship.group);
  const e = {
    kind, faction, ship, obj: ship.group, name: name || s.cls, className: s.cls,
    vel: new THREE.Vector3(), angVel: new THREE.Vector3(), throttle: 0,
    shield: s.shield, armor: s.armor, hull: s.hull, maxShield: s.shield, maxArmor: s.armor, maxHull: s.hull,
    cap: s.cap || 0, maxCap: s.cap || 0, lastHit: -99, alive: true, stats: s,
    ai: { state: 'idle', t: 0, fire: 0, missile: 6 + Math.random() * 4, home: pos.clone(), evade: new THREE.Vector3(), turretCd: [] },
  };
  attachShield(e, faction === 'player' ? new THREE.Color(0.4, 0.9, 2.2) : faction === 'pirate' ? new THREE.Color(2.2, 0.8, 0.35) : new THREE.Color(0.8, 1.6, 1.0));
  G.entities.push(e);
  return e;
}

function removeEntity(e) {
  e.alive = false;
  scene.remove(e.obj);
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
    fx.sparksAt(hp, nrm, 4, 30, e.faction === 'pirate' ? new THREE.Color(3, 1.2, 0.5) : new THREE.Color(0.8, 1.8, 4));
    if (e.shield >= d) { e.shield -= d; left = 0; } else { left = (d - e.shield) / P.s; e.shield = 0; if (isPlayer) { hud.log('Shields depleted!', 'd'); audio.alarm(); } }
    if (isPlayer) audio.shieldHit();
  }
  if (left > 0) {
    fx.sparksAt(hp, nrm, 14, 60);
    fx.flash(hp, 4 + amount * 0.04, 0xffa050, 0.12);
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
    if (e.faction !== 'pirate' && e.ai.state !== 'flee') { e.ai.state = 'flee'; hud.log(`${e.name}: "Cease fire! We're unarmed!"`, 'w'); }
    if (e.faction === 'pirate' && e.ai.state === 'idle') e.ai.state = 'attack';
  }
  if (e.hull <= 0) destroy(e, source);
}

function destroy(e, source) {
  const scale = e.kind === 'cruiser' ? 13 : e.kind === 'hauler' ? 9 : Math.max(3.2, e.ship.radius * 0.24);
  const pos = e.obj.position.clone();
  fx.explosion(pos, scale, e.vel.clone().multiplyScalar(0.5));
  audio.explosion(pos.distanceTo(camera.position), scale);
  if (e.kind === 'cruiser' || e.kind === 'hauler') {
    for (let i = 1; i <= 5; i++) {
      setTimeout(() => {
        const p = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 120));
        fx.explosion(p, scale * 0.45, e.vel.clone().multiplyScalar(0.4));
        audio.explosion(p.distanceTo(camera.position), scale * 0.4);
      }, i * 220 + Math.random() * 200);
    }
  }
  if (e === G.player) { playerDied(); return; }
  if (source === G.player) {
    if (e.stats.bounty) {
      G.credits += e.stats.bounty; G.kills++;
      hud.log(`${e.name} destroyed. Bounty: ${e.stats.bounty.toLocaleString()} ISK`, 'g');
    } else hud.log(`${e.name} destroyed. Security standing lowered.`, 'w');
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

function playerWeapons(dt, aim) {
  const p = G.player;
  const lockEnt = G.lock && G.lock.progress >= 1 ? G.lock.ent : null;
  let pri = 0, sec = 0, priOff = true, secOff = true;
  for (const t of p.ship.turrets) {
    const O = t.weapon;
    if (!O) continue;
    const primary = O.group === 'primary';
    let target = aim;
    if (O.hitscan && lockEnt) target = intercept(p.obj.position, p.vel, lockEnt.obj.position, lockEnt.vel, 1e9) || lockEnt.obj.position;
    const aligned = aimTurret(t, target, dt, O.track, -1.4, 0.35);
    t.next = Math.max(0, t.next - dt);
    const blocked = p.cap < O.cap || (O.ammo && G.ammo.rail <= 0);
    if (primary) { pri = Math.max(pri, t.next / O.rof); priOff = priOff && blocked; } else { sec = Math.max(sec, t.next / O.rof); secOff = secOff && blocked; }
    if (G.warp || G.state !== 'flying') continue;
    if (!(primary ? G.input.fire1 : G.input.fire2) || t.next > 0 || !aligned || blocked) continue;
    t.next = O.rof * (0.94 + Math.random() * 0.12);
    p.cap -= O.cap;
    t.side = ((t.side || 0) + 1) % t.muzzles.length;
    muzzleWorld(t, t.side, _v2, _v3);
    const dir = _v3.subVectors(target, _v2).normalize();
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
      bolts.fire(O.bolt, _v2, dir, O.speed, p.vel, O.range, O.dmg, p, O.profile);
      fx.muzzle(_v2, dir, O.flash, O.bolt === 'plasma' ? 6 : O.bolt === 'tracer' ? 1.3 : 2.2 * (O.scale || 1));
      if (O.bolt === 'plasma') { fx.flash(_v2, 10, 0x60ffa0, 0.12); G.shake = Math.min(1, G.shake + 0.2); }
    }
    audio[O.sound]();
  }
  G.cool.pri = pri; G.cool.sec = sec; G.priOff = priOff; G.secOff = secOff;
  G.cool.missile = Math.max(0, G.cool.missile - dt);
}

function weaponInfo() {
  const ws = G.owned[G.hull].w.filter(Boolean).map((id) => OUTFITS[id]);
  const names = (g) => [...new Set(ws.filter((o) => o.group === g).map((o) => o.name))].join(' + ') || 'None fitted';
  $('priname').textContent = names('primary');
  $('secname').textContent = names('secondary');
  G.usesAmmo = ws.some((o) => o.ammo);
  const lead = ws.find((o) => o.group === 'primary' && !o.hitscan);
  G.leadSpeed = lead ? lead.speed : 3200;
}

function fireMissiles() {
  const p = G.player;
  if (G.state !== 'flying' || G.warp) return;
  if (!(G.lock && G.lock.progress >= 1)) { hud.notice('MISSILES REQUIRE TARGET LOCK', 1.5); audio.beep(220, 0.15); return; }
  if (G.cool.missile > 0 || G.ammo.missile <= 0 || !p.ship.launchers.length) return;
  G.cool.missile = 4;
  for (let i = 0; i < 2 && G.ammo.missile > 0; i++) {
    G.ammo.missile--;
    const L = p.ship.launchers[(G.ammo.missile) % p.ship.launchers.length];
    setTimeout(() => {
      if (!G.lock || !p.alive) return;
      L.updateWorldMatrix(true, false);
      const pos = new THREE.Vector3().setFromMatrixPosition(L.matrixWorld);
      const dir = fwdOf(p).add(new THREE.Vector3(0, -0.15, 0).applyQuaternion(p.obj.quaternion)).normalize();
      missiles.launch(pos, dir, p.vel, G.lock.ent, p, 150);
      audio.missile();
    }, i * 180);
  }
}

function impactWorld(point, normal, size) {
  fx.sparksAt(point, normal, 10, 40);
  fx.flash(point, size * 3, 0xffb070, 0.1);
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

function updateAI(e, dt) {
  const p = G.player;
  const S = e.stats, A = e.ai;
  const toP = _v4.subVectors(p.obj.position, e.obj.position);
  const dist = toP.length();
  const playerOk = p.alive && G.state === 'flying' && !G.warp;
  A.t += dt;
  if (e.kind === 'hauler') {
    const goal = A.dir > 0 ? LOCATIONS[3].pos : LOCATIONS[0].pos;
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
  if (e.faction === 'navy') {
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
    if (playerOk && dist < (e.kind === 'cruiser' ? 22000 : 16000)) { A.state = 'attack'; A.t = 0; if (e.kind === 'cruiser') hud.log(`${e.name} is targeting you!`, 'd'); }
    return;
  }
  if (!playerOk) { A.state = 'idle'; A.home.copy(e.obj.position); return; }
  if (e.kind === 'raider') {
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
    // guns
    A.fire -= dt;
    const fwd = fwdOf(e, _v2);
    const toLead = _v.subVectors(lead, e.obj.position).normalize();
    if (A.state === 'attack' && dist < 3200 && fwd.dot(toLead) > 0.993 && A.fire <= 0) {
      A.fire = 0.2 + Math.random() * 0.08;
      A.gun = ((A.gun || 0) + 1) % e.ship.guns.length;
      const g = e.ship.guns[A.gun];
      g.updateWorldMatrix(true, false);
      const from = _v3.setFromMatrixPosition(g.matrixWorld);
      const d = toLead.clone();
      d.x += (Math.random() - 0.5) * 0.02; d.y += (Math.random() - 0.5) * 0.02; d.z += (Math.random() - 0.5) * 0.02; d.normalize();
      bolts.fire('pirate', from, d, 2600, e.vel, 3400, 10, e, 'thermal');
      fx.muzzle(from, d, 0xff5030, 1.6);
      audio.laser(from.distanceTo(camera.position), true);
    }
  } else if (e.kind === 'cruiser') {
    // orbit the player at ~4.5 km, broadside towards them
    const radial = _v3.copy(toP).normalize();
    const tangent = new THREE.Vector3().crossVectors(radial, Y).normalize();
    const dir = tangent.clone().addScaledVector(radial, (dist - 4500) / 2000).normalize();
    steer(e, avoid(e, dir), dt, S.turn, 0.4);
    moveAI(e, dt, S.speed, S.accel);
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
        bolts.fire('heavy', _v, d, 2400, e.vel, 9000, 42, e, 'thermal');
        fx.muzzle(_v, d, 0xff8020, 6);
        t.recoil[t.side] = 1;
        audio.laser(_v.distanceTo(camera.position), true);
      }
    });
    A.missile -= dt;
    if (A.missile <= 0 && dist < 15000) {
      A.missile = 8 + Math.random() * 4;
      for (const L of e.ship.launchers) {
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
const encounters = [
  { loc: LOCATIONS[1], ships: [], timer: 0, wave: 0, spawn(pos) { const n = 3 + Math.min(3, this.wave); const out = []; for (let i = 0; i < n; i++) out.push(['raider', 2500 + Math.random() * 3000]); return out; } },
  { loc: LOCATIONS[2], ships: [], timer: 0, wave: 0, spawn() { const out = [['cruiser', 3000]]; if (this.wave >= 2) out.push(['cruiser', 4200]); for (let i = 0; i < 3 + Math.min(3, this.wave); i++) out.push(['raider', 3500 + Math.random() * 2000]); return out; } },
];

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
        const name = kind === 'cruiser' ? 'Corsair Marauder' : PIRATE_NAMES[Math.floor(Math.random() * PIRATE_NAMES.length)];
        const e = makeEntity(kind, 'pirate', pos, name);
        e.obj.lookAt(pp);
        e.vel.copy(fwdOf(e)).multiplyScalar(e.stats.speed * 0.5);
        e.ai.seed = Math.random();
        e.ai.state = 'attack';
        e.ai.home.copy(pos);
        fx.flash(pos, kind === 'cruiser' ? 300 : 80, 0x88bbff, 0.6);
        fx.shock(pos, kind === 'cruiser' ? 400 : 120, 1.0);
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
  if (G.warp) { updateWarp(dt); return; }
  // throttle
  if (K.KeyW || K.ArrowUp) p.throttle = Math.min(1, p.throttle + dt * 0.6);
  if (K.KeyS || K.ArrowDown) p.throttle = Math.max(0, p.throttle - dt * 0.6);
  G.boosting = !!K.ShiftLeft && p.cap > 10 || (!!K.ShiftRight && p.cap > 10);
  if (G.boosting) p.cap -= 45 * dt;
  // rotation (local axes): +X left, +Y up, +Z forward
  if (G.following && !G.freeLook) {
    const r = Math.min(window.innerWidth, window.innerHeight) * 0.32;
    G.stick.set(THREE.MathUtils.clamp((G.mouse.x - window.innerWidth / 2) / r, -1, 1), THREE.MathUtils.clamp((G.mouse.y - window.innerHeight / 2) / r, -1, 1));
  } else G.stick.set(0, 0);
  const dz = 0.04;
  const sx = Math.abs(G.stick.x) > dz ? G.stick.x : 0, sy = Math.abs(G.stick.y) > dz ? G.stick.y : 0;
  const roll = (K.KeyE ? 1 : 0) - (K.KeyQ ? 1 : 0);
  const tgt = _v.set(sy * S.turn[0], -sx * S.turn[1], roll * S.turn[2]);
  const boostTurnPenalty = G.boosting ? 0.75 : 1;
  tgt.multiplyScalar(boostTurnPenalty);
  playerAngVel.lerp(tgt, 1 - Math.exp(-dt * 9));
  _q.setFromEuler(_e.set(playerAngVel.x * dt, playerAngVel.y * dt, playerAngVel.z * dt));
  p.obj.quaternion.multiply(_q).normalize();
  // translation
  const strafeX = ((K.KeyA || K.ArrowLeft) ? 1 : 0) - ((K.KeyD || K.ArrowRight) ? 1 : 0);
  const strafeY = ((K.KeyR || K.PageUp) ? 1 : 0) - ((K.KeyB || K.PageDown) ? 1 : 0);
  const invQ = _q2.copy(p.obj.quaternion).invert();
  const vLocal = _v2.copy(p.vel).applyQuaternion(invQ);
  const maxF = G.boosting ? S.boost : S.speed;
  const acc = G.boosting ? S.accel * 2.2 : S.accel;
  if (G.flightAssist) {
    const want = _v3.set(strafeX * 90, strafeY * 90, G.boosting ? S.boost : p.throttle * S.speed);
    const dv = want.sub(vLocal);
    dv.x = THREE.MathUtils.clamp(dv.x, -acc * 0.6 * dt, acc * 0.6 * dt);
    dv.y = THREE.MathUtils.clamp(dv.y, -acc * 0.6 * dt, acc * 0.6 * dt);
    dv.z = THREE.MathUtils.clamp(dv.z, -acc * dt * (vLocal.z > maxF ? 2.5 : 1), acc * dt);
    vLocal.add(dv);
  } else {
    vLocal.x += strafeX * acc * 0.6 * dt;
    vLocal.y += strafeY * acc * 0.6 * dt;
    vLocal.z += (((K.KeyW || K.ArrowUp) ? 1 : 0) - ((K.KeyS || K.ArrowDown) ? 1 : 0) + (G.boosting ? 2 : 0)) * acc * dt;
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
  for (const body of [PLANET, MOON]) {
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
  const dir = _v.subVectors(p.obj.position, dest.pos).normalize();
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
  let best = null, bd = radius;
  for (const e of G.entities) {
    if (e === G.player || !e.alive || e.obj.position.distanceTo(pp) > lockRange()) continue;
    if (_v.copy(e.obj.position).applyMatrix4(camera.matrixWorldInverse).z >= 0) continue;
    _v.copy(e.obj.position).project(camera);
    const d = Math.hypot((_v.x * 0.5 + 0.5) * w - G.mouse.x, (-_v.y * 0.5 + 0.5) * h - G.mouse.y);
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
  G.ctrlTargeting = !!G.input.keys.ControlLeft && G.state === 'flying' && !G.warp;
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
  const range = st.dock === 'high' ? 4500 : 3500;
  if (d > range) { hud.notice(`DOCKING RANGE ${range / 1000} km — ${st.name.toUpperCase()} AT ${fmtDist(d)}`, 2); audio.beep(220, 0.15); return; }
  if (G.entities.some((e) => e.faction === 'pirate' && e.alive && e.ai.state === 'attack' && e.obj.position.distanceTo(p.obj.position) < 15000)) { hud.notice('CANNOT DOCK WHILE IN COMBAT', 2); return; }
  hud.log(`Docking request accepted: ${st.name}`, 'i');
  G.dockedAt = st;
  $('fade').style.opacity = 1;
  G.state = 'docking';
  G.input.fire1 = G.input.fire2 = G.input.mmb = false;
  setTimeout(() => { enterDocked(); $('fade').style.opacity = 0; }, 700);
}

const D = { tab: 'services', browse: 'valkyrie', slot: { k: 'w', i: 0 }, preview: null, shown: null };
const fmtIsk = (n) => `${Math.round(n).toLocaleString()} ISK`;
function repairCost() { const p = G.player; return Math.round((p.maxArmor - p.armor) * 40 + (p.maxHull - p.hull) * 80); }
function rearmCost() { return G.usesAmmo ? (40 - G.ammo.rail) * 300 + (24 - G.ammo.missile) * 1200 : (24 - G.ammo.missile) * 1200; }
const isHigh = () => G.dockedAt.dock === 'high';

function hangarShow(hullId, keepView) {
  const fit = G.owned[hullId] || emptyFit(hullId);
  hangar.setShip(buildFitted(hullId, fit, world.env), keepView);
  D.shown = hullId;
}

function statRows(s, cmp) {
  const rows = [['Shield', s.shield, 'HP'], ['Armor', s.armor, 'HP'], ['Hull', s.hull, 'HP'], ['Max velocity', s.speed, 'm/s'], ['Afterburner', s.boost, 'm/s'],
    ['Agility', Math.round(s.turn[1] * 100), '°/s'], ['Capacitor', s.cap, 'GJ'], ['Cap recharge', Math.round(s.capRegen * 10) / 10, 'GJ/s'],
    ['Shield regen', Math.round(s.shieldRegen * 10) / 10, 'HP/s'], ['Lock range', Math.round(s.lockRange / 1000), 'km'], ['Signature', s.sig, '']];
  const keys = ['shield', 'armor', 'hull', 'speed', 'boost', null, 'cap', 'capRegen', 'shieldRegen', 'lockRange', null];
  return `<table class="st">${rows.map(([n, v, u], i) => {
    let c = '';
    if (cmp && keys[i]) { const o = cmp[keys[i]]; c = s[keys[i]] > o + 0.01 ? ' class="up"' : s[keys[i]] < o - 0.01 ? ' class="dn"' : ''; }
    return `<tr><td>${n}</td><td${c}>${typeof v === 'number' ? v.toLocaleString() : v} ${u}</td></tr>`;
  }).join('')}</table>`;
}

function weaponLine(O) {
  if (O.type !== 'weapon') return '';
  return `${O.group === 'primary' ? 'Primary (LMB)' : 'Secondary (RMB)'} · ${Math.round(O.dmg / O.rof)} DPS · ${(O.range / 1000).toFixed(1)} km · ${O.cap} GJ/shot${O.ammo ? ' · uses slugs' : ''}`;
}

function renderDock() {
  const L = $('dockleft'), R = $('dockright');
  $('dockwallet').innerHTML = `Wallet <b>${fmtIsk(G.credits)}</b>`;
  document.querySelectorAll('#docktop .dtabs b').forEach((b) => {
    b.classList.toggle('on', b.dataset.tab === D.tab);
    b.classList.toggle('na', b.dataset.tab === 'shipyard' && !isHigh());
  });
  const p = G.player, H = HULLS[G.hull], fit = G.owned[G.hull];
  if (D.tab === 'services') {
    L.innerHTML = `<h3>Active ship</h3><h2>${H.name}</h2><div class="sub">${H.cls}</div>
      <table class="st"><tr><td>Shield</td><td>${Math.round(p.shield)} / ${p.maxShield}</td></tr><tr><td>Armor</td><td>${Math.round(p.armor)} / ${p.maxArmor}</td></tr>
      <tr><td>Hull</td><td>${Math.round(p.hull)} / ${p.maxHull}</td></tr><tr><td>Railgun slugs</td><td>${G.ammo.rail} / 40</td></tr><tr><td>Missiles</td><td>${G.ammo.missile} / 24</td></tr></table>
      <button data-a="repair" ${repairCost() === 0 || G.credits < repairCost() ? 'disabled' : ''}>Repair (${fmtIsk(repairCost())})</button>
      <button data-a="rearm" ${rearmCost() === 0 || G.credits < rearmCost() ? 'disabled' : ''}>Rearm (${fmtIsk(rearmCost())})</button>
      <p style="margin-top:14px">${isHigh() ? 'Helion Orbital Shipyard offers the full hull catalogue and high-tech outfitting.' : 'This station has a basic outfitter. Hulls and high-tech modules are sold at Helion Orbital Shipyard (destination 7).'}</p>`;
    R.innerHTML = `<h3>Fitting</h3>${fit.w.map((id, i) => `<div class="item slot${id ? '' : ' empty'}"><span><span class="k">W${i + 1}</span><span class="nm">${id ? OUTFITS[id].name : 'Empty hardpoint'}</span></span></div>`).join('')}
      ${fit.u.map((id, i) => `<div class="item slot${id ? '' : ' empty'}"><span><span class="k">U${i + 1}</span><span class="nm">${id ? OUTFITS[id].name : 'Empty utility slot'}</span></span></div>`).join('')}
      <h3 style="margin-top:12px">Ship attributes</h3>${statRows(p.stats)}`;
  } else if (D.tab === 'shipyard') {
    L.innerHTML = `<h3>Helion Yards hull catalogue</h3>${HULL_ORDER.map((id) => {
      const h = HULLS[id], own = !!G.owned[id];
      return `<div class="item${D.browse === id ? ' on' : ''}" data-hull="${id}"><span><div class="nm">${h.name}</div><div class="ty">${h.cls}</div></span>
        <span class="pr${own ? ' own' : ''}">${id === G.hull ? 'ACTIVE' : own ? 'OWNED' : fmtIsk(h.price)}</span></div>`;
    }).join('')}<p>Drag the hangar view to orbit the hull, scroll to zoom.</p>`;
    const h = HULLS[D.browse], own = !!G.owned[D.browse];
    const s = fittedStats(D.browse, G.owned[D.browse] || emptyFit(D.browse));
    const f = G.owned[D.browse] || h.fit;
    R.innerHTML = `<h2>${h.name}</h2><div class="sub">${h.cls}</div><p>${h.desc}</p>
      <table class="st"><tr><td>Weapon hardpoints</td><td>${h.fit.w.length}</td></tr><tr><td>Utility slots</td><td>${h.fit.u.length}</td></tr>
      <tr><td>${own ? 'Fitted' : 'Stock'} weapons</td><td>${f.w.filter(Boolean).map((id) => OUTFITS[id].name).join(', ') || '—'}</td></tr></table>
      ${statRows(s, D.browse === G.hull ? null : p.stats)}
      ${D.browse === G.hull ? '<button disabled>Active ship</button>' : own ? '<button data-a="board" class="primary">Board this ship</button>'
    : `<button data-a="buy" class="primary" ${G.credits < h.price ? 'disabled' : ''}>Buy &amp; board (${fmtIsk(h.price)})</button>`}`;
  } else {
    const k = D.slot.k, i = D.slot.i;
    const slotRow = (kk, id, j) => `<div class="item slot${id ? '' : ' empty'}${k === kk && i === j ? ' on' : ''}" data-slot="${kk}${j}"><span><span class="k">${kk.toUpperCase()}${j + 1}</span><span class="nm">${id ? OUTFITS[id].name : kk === 'w' ? 'Empty hardpoint' : 'Empty utility slot'}</span></span></div>`;
    const inv = Object.entries(G.inventory).filter(([, n]) => n > 0);
    L.innerHTML = `<h3>${H.name} — weapon hardpoints</h3>${fit.w.map((id, j) => slotRow('w', id, j)).join('')}
      <h3 style="margin-top:12px">Utility slots</h3>${fit.u.map((id, j) => slotRow('u', id, j)).join('')}
      ${fit[k][i] ? '<button data-a="unfit">Unfit selected slot</button>' : ''}
      <h3 style="margin-top:12px">Ship attributes</h3>${statRows(p.stats)}
      ${inv.length ? `<h3>Cargo hold</h3>${inv.map(([id, n]) => `<div class="item" data-out="${id}"><span class="nm">${OUTFITS[id].name}</span><span class="pr own">×${n}</span></div>`).join('')}` : ''}`;
    const type = k === 'w' ? 'weapon' : 'utility';
    const list = Object.entries(OUTFITS).filter(([, O]) => O.type === type);
    let det = '';
    if (D.preview && OUTFITS[D.preview]) {
      const O = OUTFITS[D.preview], have = G.inventory[D.preview] > 0, avail = O.tech === 'basic' || isHigh();
      const tf = { w: [...fit.w], u: [...fit.u] }; tf[k][i] = D.preview;
      det = `<h2 style="margin-top:12px">${O.name}</h2><div class="sub">${O.tech === 'high' ? 'HIGH-TECH · ' : ''}${O.type.toUpperCase()}</div><p>${O.desc}</p><p>${weaponLine(O)}</p>
        ${O.type === 'utility' ? statRows(fittedStats(G.hull, tf), p.stats) : ''}
        <button data-a="fit" class="primary" ${!avail || (!have && G.credits < O.price) || fit[k][i] === D.preview ? 'disabled' : ''}>${fit[k][i] === D.preview ? 'Fitted' : `${have ? 'Fit from cargo' : `Buy &amp; fit (${fmtIsk(O.price)})`} → ${k.toUpperCase()}${i + 1}`}</button>
        ${!avail ? '<p>Only sold at high-tech stations.</p>' : ''}
        ${have ? `<button data-a="sell">Sell one from cargo (${fmtIsk(O.price * 0.5)})</button>` : ''}`;
    }
    R.innerHTML = `<h3>${isHigh() ? 'Helion outfitter' : 'Basic outfitter'} — ${type}s</h3>${list.map(([id, O]) => {
      const avail = O.tech === 'basic' || isHigh();
      return `<div class="item${D.preview === id ? ' on' : ''}${avail ? '' : ' dis'}" data-out="${id}"><span><div class="nm">${O.name}</div><div class="ty">${O.type === 'weapon' ? (O.group === 'primary' ? 'Primary' : 'Secondary') : 'Utility'}${O.tech === 'high' ? ' · High-tech' : ''}</div></span>
        <span class="pr${G.inventory[id] ? ' own' : ''}">${G.inventory[id] ? `×${G.inventory[id]} in cargo` : fmtIsk(O.price)}</span></div>`;
    }).join('')}${det}`;
  }
}

function setDockTab(tab) {
  if (tab === 'shipyard' && !isHigh()) { flashDockMsg('No shipyard here — warp to Helion Orbital Shipyard (7)'); return; }
  D.tab = tab; D.preview = null;
  hangar.setOutfit(null);
  if (tab === 'shipyard') { D.browse = D.browse || G.hull; if (D.shown !== D.browse) hangarShow(D.browse); } else if (D.shown !== G.hull) hangarShow(G.hull);
  audio.ui();
  renderDock();
}
function flashDockMsg(t) { const h = $('dockhint'); h.textContent = t; h.style.color = '#fc6'; setTimeout(() => { h.textContent = 'Drag to orbit · Wheel to zoom'; h.style.color = ''; }, 2500); }

function rebuildPlayer() {
  const old = G.player;
  const e = makeEntity('player', 'player', old.obj.position.clone(), HULLS[G.hull].name);
  e.obj.quaternion.copy(old.obj.quaternion);
  e.armor = e.maxArmor * (old.armor / old.maxArmor);
  e.hull = Math.max(1, e.maxHull * (old.hull / old.maxHull));
  e.obj.visible = old.obj.visible;
  scene.remove(old.obj);
  G.entities.splice(G.entities.indexOf(old), 1);
  G.player = e;
  weaponInfo();
}

$('docktop').addEventListener('click', (ev) => { const b = ev.target.closest('.dtabs b'); if (b) setDockTab(b.dataset.tab); });
for (const id of ['dockleft', 'dockright']) {
  $(id).addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-a],[data-hull],[data-slot],[data-out]');
    if (!t) return;
    const fit = G.owned[G.hull];
    if (t.dataset.hull) { D.browse = t.dataset.hull; hangarShow(D.browse); audio.ui(); }
    else if (t.dataset.slot) { D.slot = { k: t.dataset.slot[0], i: +t.dataset.slot.slice(1) }; const cur = fit[D.slot.k][D.slot.i]; D.preview = cur; hangar.setOutfit(null); audio.ui(); }
    else if (t.dataset.out) {
      const O = OUTFITS[t.dataset.out];
      if (O.type === 'weapon' && D.slot.k !== 'w') D.slot = { k: 'w', i: 0 };
      if (O.type === 'utility' && D.slot.k !== 'u') D.slot = { k: 'u', i: 0 };
      D.preview = t.dataset.out; hangar.setOutfit(outfitPreview(D.preview, G.player.ship.M)); audio.ui();
    } else {
      const a = t.dataset.a, k = D.slot.k, i = D.slot.i;
      if (a === 'repair') { const c = repairCost(); if (G.credits >= c) { G.credits -= c; G.player.armor = G.player.maxArmor; G.player.hull = G.player.maxHull; } }
      if (a === 'rearm') { const c = rearmCost(); if (G.credits >= c) { G.credits -= c; G.ammo.rail = 40; G.ammo.missile = 24; } }
      if (a === 'buy') { const h = HULLS[D.browse]; if (G.credits >= h.price) { G.credits -= h.price; G.owned[D.browse] = emptyFit(D.browse); G.hull = D.browse; rebuildPlayer(); hangarShow(G.hull, true); hud.log(`Purchased ${h.cls} ${h.name}`, 'g'); } }
      if (a === 'board') { G.hull = D.browse; rebuildPlayer(); hangarShow(G.hull, true); }
      if (a === 'fit' && D.preview) {
        const id = D.preview, O = OUTFITS[id];
        const have = G.inventory[id] > 0;
        if (have) G.inventory[id]--; else if (G.credits >= O.price) G.credits -= O.price; else return;
        const old = fit[k][i];
        if (old) G.inventory[old] = (G.inventory[old] || 0) + 1;
        fit[k][i] = id;
        rebuildPlayer(); hangarShow(G.hull, true); hangar.setOutfit(null);
      }
      if (a === 'unfit') { const old = fit[k][i]; if (old) { G.inventory[old] = (G.inventory[old] || 0) + 1; fit[k][i] = null; rebuildPlayer(); hangarShow(G.hull, true); } }
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
  $('docksub').textContent = isHigh() ? 'HIGH-TECH STATION · SHIPYARD · FULL OUTFITTER · REPAIR' : 'STATION · BASIC OUTFITTER · REPAIR';
  D.tab = 'services'; D.preview = null; D.browse = G.hull;
  hangar.setOutfit(null);
  hangarShow(G.hull);
  hangar.snap();
  renderDock();
}
$('undock').onclick = () => { $('docked').classList.add('hidden'); undock(); };

function undock() {
  const p = G.player;
  const dock = world.docks[G.dockedAt.id];
  const st = dock.root;
  const u = dock.undock();
  const pos = u.pos.applyQuaternion(st.quaternion).add(st.position);
  const out = u.dir.applyQuaternion(st.quaternion).normalize();
  if (hangar) { hangar.restoreEnv(); hangar.setOutfit(null); }
  p.obj.position.copy(pos);
  _m.lookAt(out, ORIGIN, Y);
  p.obj.quaternion.setFromRotationMatrix(_m);
  p.vel.copy(out).multiplyScalar(120);
  p.throttle = 0.5;
  G.stick.set(0, 0);
  playerAngVel.set(0, 0, 0);
  camQuat.copy(p.obj.quaternion);
  G.state = 'flying';
  $('hud').classList.remove('hidden');
  hud.notice('UNDOCKING', 2);
  hud.log(`Undocked from ${G.dockedAt.name}`, 'i');
}

function playerDied() {
  const p = G.player;
  p.obj.visible = false;
  G.state = 'dead';
  G.warp = null; G.lock = null;
  G.input.fire1 = G.input.fire2 = false;
  hud.log('Your ship has been destroyed!', 'd');
  setTimeout(() => $('dead').classList.remove('hidden'), 2500);
}
$('respawn').onclick = () => {
  const p = G.player;
  p.shield = p.maxShield; p.armor = p.maxArmor; p.hull = p.maxHull; p.cap = p.maxCap;
  p.obj.visible = true; p.alive = true;
  G.ammo.rail = 40; G.ammo.missile = 24;
  G.credits = Math.max(0, G.credits - 50000);
  $('dead').classList.add('hidden');
  G.dockedAt = LOCATIONS[0];
  undock();
};

// ---------------------------------------------------------------- input
canvas.addEventListener('mousedown', (ev) => {
  G.mouse.set(ev.clientX, ev.clientY);
  if (ev.button === 1) ev.preventDefault();
  if (G.state === 'docked') { hangar.dragging = true; return; }
  if (G.state !== 'flying') return;
  if (ev.button === 0) { if (!G.lock && !G.ctrlTargeting) lockNearestToReticle(true); G.input.fire1 = true; }
  if (ev.button === 1) G.input.mmb = true;
  if (ev.button === 2) G.input.fire2 = true;
});
window.addEventListener('mouseup', (ev) => {
  if (ev.button === 0) G.input.fire1 = false;
  if (ev.button === 1) G.input.mmb = false;
  if (ev.button === 2) G.input.fire2 = false;
  if (hangar) hangar.dragging = false;
});
canvas.addEventListener('auxclick', (ev) => ev.preventDefault());
window.addEventListener('contextmenu', (ev) => ev.preventDefault());
window.addEventListener('mousemove', (ev) => {
  G.mouse.set(ev.clientX, ev.clientY);
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
  G.input.keys = {}; G.input.fire1 = G.input.fire2 = false;
  if (paused) audio.ctx?.resume();
  else audio.ctx?.suspend();
}
$('pausecontrols').innerHTML = document.querySelector('#menu .cols').outerHTML;
$('resume').addEventListener('click', togglePause);

window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Tab' || ev.code === 'Space' || ev.code.startsWith('Arrow') || ev.code.startsWith('Page') || (ev.ctrlKey && G.state === 'flying')) ev.preventDefault();
  if (ev.code === 'Escape') { togglePause(); return; }
  if (ev.repeat) return;
  G.input.keys[ev.code] = true;
  if (G.state === 'docked' || G.state === 'menu' || G.state === 'paused') return;
  switch (ev.code) {
    case 'KeyX': G.player.throttle = 0; break;
    case 'KeyZ': G.flightAssist = !G.flightAssist; hud.notice(G.flightAssist ? 'FLIGHT ASSIST ON' : 'FLIGHT ASSIST OFF — NEWTONIAN', 1.5); audio.ui(); break;
    case 'KeyV': G.camMode = (G.camMode + 1) % 3; audio.ui(); break;
    case 'KeyC': G.freeLook = true; break;
    case 'KeyT': lockNearestToReticle(); break;
    case 'Tab': cycleHostile(); break;
    case 'KeyF': fireMissiles(); break;
    case 'KeyJ':
    case 'Space': warpTo(G.navTarget); break;
    case 'KeyG': tryDock(); break;
    case 'KeyM': G.followToggle = !G.followToggle; hud.notice(G.followToggle ? 'POINTER FOLLOW LOCKED ON (M)' : 'POINTER FOLLOW: HOLD MIDDLE MOUSE', 1.6); audio.ui(); break;
    case 'KeyH': toggleHelp(); break;
    default:
      if (/^(Digit|Numpad)[1-7]$/.test(ev.code)) { const l = LOCATIONS[+ev.code.slice(-1) - 1]; G.selected = l; G.navTarget = l; hud.ovT = 0; audio.ui(); hud.notice(`DESTINATION: ${l.name.toUpperCase()} — SPACE TO WARP`, 1.8); }
  }
});
window.addEventListener('keyup', (ev) => { G.input.keys[ev.code] = false; if (ev.code === 'KeyC') { G.freeLook = false; } });
window.addEventListener('blur', () => { G.input.keys = {}; G.input.fire1 = G.input.fire2 = G.input.mmb = false; });

hud.onSelect = (ref) => { G.selected = ref; if (ref.pos) G.navTarget = ref; else if (ref.ship) startLock(ref); hud.ovT = 0; audio.ui(); };
document.querySelectorAll('#selinfo button').forEach((b) => b.addEventListener('mousedown', (ev) => {
  ev.stopPropagation();
  const s = G.selected;
  if (b.dataset.act === 'warp') { if (s && s.pos) G.navTarget = s; warpTo(G.navTarget); }
  if (b.dataset.act === 'lock') { if (s && s.ship) startLock(s); else hud.notice('SELECT A SHIP TO LOCK', 1.2); }
  if (b.dataset.act === 'dock') tryDock();
}));
function toggleHelp() {
  const h = $('help');
  if (h.classList.contains('hidden')) {
    $('helpbox').innerHTML = document.querySelector('#menu .cols').outerHTML + '<p style="margin-top:14px">Hold the middle mouse button and the ship turns towards the pointer; turrets always aim at the pointer. Hold left Ctrl and sweep the pointer over a ship to lock it. Shields regenerate after 4 s without damage. Lasers and plasma drain capacitor; railguns use slugs; missiles need a full lock. Dock (G) at Ardent Relay Station (1) to repair and buy basic outfits, or at Helion Orbital Shipyard (7) for new hulls, a 3D hangar and high-tech modules. Pirates spawn at the asteroid belt (2) and the Corsair Hideout (3). Press H to close. Press Esc to pause.</p>';
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
  const target = 68 + (G.boosting ? 7 : 0) + warpI * 26 + Math.min(4, p.vel.length() / 100);
  fov += (target - fov) * (1 - Math.exp(-dt * 3));
  camera.fov = fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return warpI;
}

function aimPoint() {
  const dir = _v.set((G.mouse.x / window.innerWidth) * 2 - 1, -(G.mouse.y / window.innerHeight) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize().clone();
  let dist = 1800;
  const L = G.lock;
  // if the lead pip is close to the pointer, converge on it (aim assist)
  if (L && G.leadPoint) {
    const to = _v.subVectors(G.leadPoint, camera.position);
    if (to.angleTo(dir) < 0.08) return G.leadPoint.clone();
    dist = THREE.MathUtils.clamp(to.length(), 300, 6000);
  }
  return camera.position.clone().addScaledVector(dir, dist);
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!world || !G.player) return;
  G.time += dt;
  const p = G.player;
  if (document.body.dataset.state !== G.state) document.body.dataset.state = G.state;
  G.following = G.state === 'flying' && (G.input.mmb || G.followToggle);
  if (G.state === 'docked') { hangar.update(dt); hangar.render(); return; }
  if (G.state === 'paused') { composer.render(0); return; }
  if (G.state === 'flying' || G.state === 'dead' || G.state === 'docking') {
    updatePlayer(dt);
    // capacitor and shield regeneration
    p.cap = Math.min(p.maxCap, p.cap + p.stats.capRegen * dt);
    if (G.time - p.lastHit > 4 && p.alive) p.shield = Math.min(p.maxShield, p.shield + p.stats.shieldRegen * dt);
    for (const e of G.entities) {
      if (e === p || !e.alive) continue;
      if (e.obj.position.distanceTo(p.obj.position) < 80000 || e.kind === 'hauler') updateAI(e, dt);
      if (G.time - e.lastHit > 6) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.01 * dt);
    }
    G.scrambled = !G.warp && G.entities.some((e) => e.alive && e.kind === 'cruiser' && e.ai.state === 'attack' && e.obj.position.distanceTo(p.obj.position) < 15000);
    updateEncounters(dt);
    updateLock(dt);
  }
  const warpI = updateCamera(dt);
  updateCtrlTargeting();
  if (G.state === 'flying') playerWeapons(dt, aimPoint());
  const colliders = world.collidersNear(p.obj.position, 7000);
  bolts.update(dt, G.entities, colliders, onBoltHit);
  missiles.update(dt, colliders, onMissileDetonate);
  // ship cosmetics
  for (const e of G.entities) {
    if (!e.alive) continue;
    const thr = e === p ? (G.warp ? 1 : Math.max(p.throttle, G.boosting ? 1.4 : 0)) : e.throttle;
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
  if (G.warp) wl.lookAt(_v.copy(camera.position).sub(_v2.copy(p.vel).normalize()));
  world.warp.update(dt, warpI, 2500 + warpI * 9000);
  fx.update(dt, camera);
  G.hitFlash *= Math.exp(-dt * 3);
  lensPass.uniforms.uWarp.value = warpI;
  lensPass.uniforms.uHit.value = G.hitFlash;
  audio.update(p.throttle, G.boosting ? 1 : 0, warpI);
  // nearest named location
  let best = Infinity;
  for (const l of LOCATIONS) { const d = l.pos.distanceTo(p.obj.position) - l.arrive; if (d < best) { best = d; G.nearestName = d < 30000 ? l.name : `Deep space near ${l.name}`; } }
  if (G.state === 'flying' || G.state === 'dead') hud.update(dt, G);
  composer.render(dt);
}

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
    G.player = makeEntity('player', 'player', new THREE.Vector3(), 'Valkyrie');
    weaponInfo();
    // Helion navy patrol around the shipyard
    const yardPos = LOCATIONS[6].pos;
    for (const [kind, name, off] of [['navyWarden', 'HNS Vigilant', [2500, 300, 1500]], ['navyKestrel', 'HNS Swift', [-2000, -400, 2600]], ['navyKestrel', 'HNS Harrier', [1500, 600, -2800]]]) {
      const n = makeEntity(kind, 'navy', yardPos.clone().add(new THREE.Vector3(...off)), name);
      n.ai.seed = Math.random(); n.ai.home.copy(yardPos);
    }
    // civilian traffic between station and gate
    for (let i = 0; i < 3; i++) {
      const t = 0.15 + i * 0.3;
      const pos = new THREE.Vector3().lerpVectors(LOCATIONS[0].pos, LOCATIONS[3].pos, t).add(new THREE.Vector3((Math.random() - 0.5) * 3000, (Math.random() - 0.5) * 800, (Math.random() - 0.5) * 3000));
      const h = makeEntity('hauler', 'civil', pos, ['Orca Logistics', 'Kaltos Freight', 'Vexal Trading Co.'][i] + ' Hauler');
      h.ai.dir = i % 2 ? 1 : -1; h.ai.state = 'cruise';
      h.obj.lookAt(h.ai.dir > 0 ? LOCATIONS[3].pos : LOCATIONS[0].pos);
    }
    // a patrol idling at the hideout entrance so the overview shows threats
    undockPose();
    await step('Compiling shaders…');
    renderer.compile(scene, camera);
    await step('Pressurising hangar bay…');
    hangar = new Hangar(renderer);
    composer.render(0.016);
    msg.textContent = 'Systems online.';
    const start = $('start');
    start.disabled = false; start.textContent = 'Undock';
    start.onclick = () => {
      audio.init();
      $('menu').classList.add('hidden');
      hud.log('Welcome to Kaltos. Pirates reported at Asteroid Belt 1.', 'i');
      hud.log('Press 2 then Space to warp to the belt. Hold MMB to steer, hold L-Ctrl to target.', 'i');
      hud.log('New hulls and high-tech outfits: Helion Orbital Shipyard (7).', 'i');
      undock();
    };
  } catch (err) {
    console.error(err);
    msg.textContent = `Error: ${err.message}`;
  }
}

function undockPose() {
  const st = world.station.root;
  const a = Math.PI / 4;
  const p = G.player;
  p.obj.position.copy(new THREE.Vector3(Math.cos(a) * 900, -180, Math.sin(a) * 900).applyQuaternion(st.quaternion).add(st.position));
  p.obj.lookAt(st.position);
  p.obj.rotateY(0.6);
  camQuat.copy(p.obj.quaternion);
  updateCamera(0.016);
}

// debug/testing hook
window.__game = { G, camera, LOCATIONS, get world() { return world; }, warpTo, startLock, damage };
requestAnimationFrame(frame);
boot();
