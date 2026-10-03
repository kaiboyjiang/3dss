import * as THREE from 'three';
import { glowTexture, smokeTexture, ringTexture, rng } from './textures.js';
import { LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './shaders.js';

const glow = glowTexture(128, 2.0);
const softGlow = glowTexture(128, 1.2);
const smoke = smokeTexture(128, 5);
const ring = ringTexture(256);

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _z = new THREE.Vector3(0, 0, 1);

// ---------------------------------------------------------------- particles
class Particles {
  constructor(max, texture, additive) {
    this.max = max;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('rot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uTex: { value: texture }, uScale: { value: 800 } },
      vertexShader: /* glsl */`
        ${LOGDEPTH_VERT_PARS}
        attribute float size; attribute vec4 color; attribute float rot;
        uniform float uScale; varying vec4 vCol; varying float vRot;
        void main() {
          vCol = color; vRot = rot;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(size * uScale / max(-mv.z, 0.1), 1024.0);
          ${LOGDEPTH_VERT}
        }`,
      fragmentShader: /* glsl */`
        ${LOGDEPTH_FRAG_PARS}
        uniform sampler2D uTex; varying vec4 vCol; varying float vRot;
        void main() {
          ${LOGDEPTH_FRAG}
          vec2 c = gl_PointCoord - 0.5;
          float s = sin(vRot), co = cos(vRot);
          c = mat2(co, -s, s, co) * c + 0.5;
          vec4 t = texture2D(uTex, c);
          gl_FragColor = vec4(vCol.rgb * ${additive ? 't.a * vCol.a' : '1.0'}, ${additive ? '1.0' : 't.a * vCol.a'});
        }`,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 15;
    this.p = [];
    for (let i = 0; i < max; i++) this.p.push({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), s0: 1, s1: 1, c0: new THREE.Color(), c1: new THREE.Color(), a0: 1, a1: 0, drag: 0, rot: 0, spin: 0 });
    this.cursor = 0;
  }
  spawn(pos, vel, life, s0, s1, c0, c1, a0 = 1, a1 = 0, drag = 0) {
    const p = this.p[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    p.pos.copy(pos); p.vel.copy(vel);
    p.life = p.max = life; p.s0 = s0; p.s1 = s1;
    p.c0.copy(c0); p.c1.copy(c1); p.a0 = a0; p.a1 = a1; p.drag = drag;
    p.rot = Math.random() * 6.28; p.spin = (Math.random() - 0.5) * 2;
  }
  update(dt) {
    const { pos, col, size, rot } = this;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life <= 0) { size[i] = 0; col[i * 4 + 3] = 0; continue; }
      p.life -= dt;
      const t = 1 - Math.max(p.life, 0) / p.max;
      if (p.drag) p.vel.multiplyScalar(Math.exp(-p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      p.rot += p.spin * dt;
      pos[i * 3] = p.pos.x; pos[i * 3 + 1] = p.pos.y; pos[i * 3 + 2] = p.pos.z;
      size[i] = p.s0 + (p.s1 - p.s0) * t;
      col[i * 4] = p.c0.r + (p.c1.r - p.c0.r) * t;
      col[i * 4 + 1] = p.c0.g + (p.c1.g - p.c0.g) * t;
      col[i * 4 + 2] = p.c0.b + (p.c1.b - p.c0.b) * t;
      col[i * 4 + 3] = p.a0 + (p.a1 - p.a0) * t;
      rot[i] = p.rot;
    }
    for (const k of ['position', 'color', 'size', 'rot']) this.geo.attributes[k].needsUpdate = true;
  }
}

// ---------------------------------------------------------------- shield bubble
function shieldMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uHits: { value: [new THREE.Vector4(0, 0, 1, -99), new THREE.Vector4(0, 0, 1, -99), new THREE.Vector4(0, 0, 1, -99), new THREE.Vector4(0, 0, 1, -99)] }, uTime: { value: 0 }, uColor: { value: color }, uStrength: { value: 1 } },
    vertexShader: /* glsl */`
      ${LOGDEPTH_VERT_PARS}
      varying vec3 vDir; varying vec3 vN; varying vec3 vV;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
        ${LOGDEPTH_VERT}
      }`,
    fragmentShader: /* glsl */`
      ${LOGDEPTH_FRAG_PARS}
      uniform vec4 uHits[4]; uniform float uTime; uniform vec3 uColor; uniform float uStrength;
      varying vec3 vDir; varying vec3 vN; varying vec3 vV;
      void main() {
        ${LOGDEPTH_FRAG}
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        float total = 0.0;
        for (int i = 0; i < 4; i++) {
          float age = uTime - uHits[i].w;
          if (age < 0.0 || age > 0.9) continue;
          float d = acos(clamp(dot(vDir, uHits[i].xyz), -1.0, 1.0));
          float front = age * 1.4;
          float ripple = exp(-pow((d - front) * 9.0, 2.0)) * (1.0 - age / 0.9) * smoothstep(1.3, 0.3, d);
          float spot = exp(-d * d * 30.0) * exp(-age * 7.0) * 2.5;
          float hexes = 0.6 + 0.4 * step(0.5, fract(vDir.x * 18.0 + vDir.y * 11.0) * fract(vDir.z * 18.0 - vDir.y * 9.0) * 2.0);
          total += (ripple * hexes * 0.6 + spot) * (0.3 + fres) + exp(-age * 8.0) * fres * 0.12;
        }
        gl_FragColor = vec4(uColor * total * uStrength, 1.0);
      }`,
  });
}

export function attachShield(entity, color) {
  const box = new THREE.Box3();
  entity.ship.group.updateMatrixWorld(true);
  entity.ship.group.traverse((o) => { if (o.isMesh && o.material.isMeshStandardMaterial) box.expandByObject(o); });
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), shieldMaterial(color));
  m.scale.set(size.x * 0.56 + 1, size.y * 0.7 + 1.5, size.z * 0.56 + 1);
  m.position.copy(center).sub(entity.ship.group.position);
  m.renderOrder = 30;
  m.visible = false;
  entity.ship.group.add(m);
  entity.shieldMesh = m;
  entity.shieldHit = 0;
  entity.shieldLast = -99;
}

// ---------------------------------------------------------------- effects manager
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.fire = new Particles(2600, softGlow, true);
    this.smoke = new Particles(1800, smoke, false);
    this.sparks = new Particles(1500, glow, true);
    scene.add(this.fire.points, this.smoke.points, this.sparks.points);
    this.flashes = [];
    for (let i = 0; i < 48; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.visible = false; s.renderOrder = 25;
      scene.add(s);
      this.flashes.push({ s, life: 0, max: 1, size: 1, color: new THREE.Color() });
    }
    this.rings = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ring, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide }));
      m.visible = false; m.renderOrder = 24;
      scene.add(m);
      this.rings.push({ m, life: 0, max: 1, size: 1 });
    }
    this.lights = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffa060, 0, 0, 2);
      scene.add(l);
      this.lights.push({ l, life: 0, max: 1, power: 0 });
    }
    this.debris = [];
    const dg = [new THREE.BoxGeometry(1, 0.3, 0.7), new THREE.TetrahedronGeometry(0.7), new THREE.BoxGeometry(0.4, 0.4, 1.4)];
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(dg[i % 3], new THREE.MeshStandardMaterial({ color: 0x55575b, metalness: 0.8, roughness: 0.5, emissive: new THREE.Color(1, 0.35, 0.1) }));
      m.visible = false;
      m.castShadow = true;
      scene.add(m);
      this.debris.push({ m, life: 0, vel: new THREE.Vector3(), spin: new THREE.Vector3(), max: 1 });
    }
    this.tracers = [];
    this.time = 0;
    this.camera = null;
  }
  flash(pos, size, color, life) {
    const f = this.flashes.find((x) => x.life <= 0) || this.flashes[0];
    f.s.position.copy(pos); f.size = size; f.life = f.max = life; f.color.set(color);
    f.s.material.color.copy(f.color); f.s.visible = true;
  }
  light(pos, power, life, color = 0xffa060) {
    const l = this.lights.reduce((a, b) => (a.life < b.life ? a : b));
    l.l.position.copy(pos); l.l.color.set(color); l.power = power; l.life = l.max = life;
  }
  shock(pos, size, life) {
    const r = this.rings.find((x) => x.life <= 0) || this.rings[0];
    r.m.position.copy(pos); r.size = size; r.life = r.max = life; r.m.visible = true;
    if (this.camera) r.m.quaternion.copy(this.camera.quaternion);
    r.m.rotateX((Math.random() - 0.5) * 1.2);
  }
  sparksAt(pos, normal, n, speed, color = new THREE.Color(4, 2.4, 1)) {
    const end = new THREE.Color(1.2, 0.2, 0.02);
    for (let i = 0; i < n; i++) {
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().add(normal).normalize().multiplyScalar(speed * (0.3 + Math.random()));
      this.sparks.spawn(pos, _v, 0.3 + Math.random() * 0.5, 0.35, 0.1, color, end, 1, 0, 1.5);
    }
  }
  muzzle(pos, dir, color, size) {
    this.flash(pos, size * 2.2, color, 0.1);
    this.flash(_v.copy(pos).addScaledVector(dir, size * 0.6), size * 0.9, 0xffffff, 0.05);
    for (let i = 0; i < 6; i++) {
      _v.copy(dir).multiplyScalar(40 + Math.random() * 60).add(_v2.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(25));
      this.sparks.spawn(pos, _v, 0.18, size * 0.4, 0.08, new THREE.Color(color).multiplyScalar(3.5), new THREE.Color(0, 0, 0), 1, 0, 2);
    }
  }
  explosion(pos, scale, vel = new THREE.Vector3(), color = null) {
    const s = scale;
    this.flash(pos, s * 9, 0xffe0b0, 0.35);
    this.flash(pos, s * 4, 0xffffff, 0.15);
    this.light(pos, 4e3 * s * s, 1.2);
    this.shock(pos, s * 14, 0.9);
    const hot = new THREE.Color(5, 2.8, 1.0), mid = new THREE.Color(1.6, 0.35, 0.06);
    for (let i = 0; i < 70; i++) {
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(s * (2 + Math.random() * 12)).add(vel);
      this.fire.spawn(_v2.copy(pos).addScaledVector(_v, 0.02), _v, 0.6 + Math.random() * 1.4, s * (1.5 + Math.random() * 2), s * (4 + Math.random() * 5), hot, mid, 1, 0, 1.6);
    }
    const sc = new THREE.Color(0.09, 0.085, 0.08), sc2 = new THREE.Color(0.03, 0.03, 0.03);
    for (let i = 0; i < 40; i++) {
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(s * (1 + Math.random() * 6)).add(vel);
      this.smoke.spawn(pos, _v, 2.5 + Math.random() * 3.5, s * 3, s * (10 + Math.random() * 8), sc, sc2, 0.75, 0, 0.6);
    }
    for (let i = 0; i < 90; i++) {
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(s * (10 + Math.random() * 40)).add(vel);
      this.sparks.spawn(pos, _v, 0.6 + Math.random() * 1.6, s * 0.5, s * 0.1, new THREE.Color(6, 3.5, 1.5), new THREE.Color(1, 0.2, 0), 1, 0, 0.4);
    }
    const n = Math.min(14, Math.ceil(s * 4));
    for (let i = 0; i < n; i++) {
      const d = this.debris.find((x) => x.life <= 0);
      if (!d) break;
      d.m.position.copy(pos);
      d.m.scale.setScalar(s * (0.4 + Math.random() * 1.2));
      d.vel.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(s * (5 + Math.random() * 25)).add(vel);
      d.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(6);
      d.life = d.max = 5 + Math.random() * 6;
      d.m.visible = true;
    }
  }
  trail(pos, vel, size, life, hot = true) {
    if (hot) this.fire.spawn(pos, vel, life * 0.4, size, size * 0.4, new THREE.Color(3, 1.6, 0.6), new THREE.Color(0.6, 0.12, 0.02), 1, 0, 0.5);
    this.smoke.spawn(pos, vel, life, size * 0.8, size * 3.5, new THREE.Color(0.18, 0.18, 0.19), new THREE.Color(0.05, 0.05, 0.05), 0.45, 0, 0.3);
  }
  railTrail(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(2, 3.5, 8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    line.frustumCulled = false;
    const beam = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.6, 5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.lerpVectors(a, b, 0.5);
    beam.quaternion.setFromUnitVectors(_z, _v.subVectors(b, a).normalize());
    beam.scale.set(0.3, 0.3, a.distanceTo(b));
    beam.frustumCulled = false;
    line.add(beam);
    this.scene.add(line);
    this.tracers.push({ line, beam, life: 1.6, max: 1.6 });
    // ionised particles along the path
    const len = a.distanceTo(b);
    const n = Math.min(80, Math.floor(len / 40));
    for (let i = 0; i < n; i++) {
      _v.lerpVectors(a, b, Math.random());
      _v2.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2);
      this.smoke.spawn(_v, _v2, 1.5 + Math.random(), 1, 4, new THREE.Color(0.25, 0.3, 0.38), new THREE.Color(0.1, 0.1, 0.12), 0.25, 0, 0);
    }
  }
  update(dt, camera) {
    this.time += dt;
    this.camera = camera;
    this.fire.mat.uniforms.uScale.value = this.smoke.mat.uniforms.uScale.value = this.sparks.mat.uniforms.uScale.value = window.innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.fire.update(dt); this.smoke.update(dt); this.sparks.update(dt);
    for (const f of this.flashes) {
      if (f.life <= 0) { f.s.visible = false; continue; }
      f.life -= dt;
      const t = 1 - f.life / f.max;
      f.s.scale.setScalar(f.size * (0.6 + t * 0.6));
      f.s.material.opacity = Math.max(0, 1 - t);
      f.s.material.color.copy(f.color).multiplyScalar(4);
    }
    for (const r of this.rings) {
      if (r.life <= 0) { r.m.visible = false; continue; }
      r.life -= dt;
      const t = 1 - r.life / r.max;
      r.m.scale.setScalar(r.size * (0.2 + t * 1.6));
      r.m.material.opacity = (1 - t) * 0.8;
      r.m.material.color.setRGB(2, 1.4, 1);
    }
    for (const l of this.lights) {
      if (l.life <= 0) { l.l.intensity = 0; continue; }
      l.life -= dt;
      l.l.intensity = l.power * Math.pow(Math.max(l.life / l.max, 0), 2);
    }
    for (const d of this.debris) {
      if (d.life <= 0) { d.m.visible = false; continue; }
      d.life -= dt;
      d.m.position.addScaledVector(d.vel, dt);
      d.m.rotation.x += d.spin.x * dt; d.m.rotation.y += d.spin.y * dt; d.m.rotation.z += d.spin.z * dt;
      const heat = Math.max(0, (d.life / d.max) - 0.4) * 1.6;
      d.m.material.emissive.setRGB(heat * 3, heat * 1.0, heat * 0.25);
      if (Math.random() < dt * 20 && d.life > d.max * 0.3) this.trail(d.m.position, _v.set(0, 0, 0), d.m.scale.x * 1.2, 1.5, heat > 0.2);
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      const f = Math.max(0, t.life / t.max);
      t.line.material.opacity = f;
      t.beam.material.opacity = f * f;
      t.beam.scale.x = t.beam.scale.y = 0.3 + (1 - f) * 1.2;
      if (t.life <= 0) {
        this.scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); t.beam.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
}

// ---------------------------------------------------------------- projectiles
const boltGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1).rotateX(Math.PI / 2);
const BOLT_TYPES = {
  laser: { core: new THREE.Color(8, 9, 12), halo: new THREE.Color(1.0, 2.4, 7.5), len: 22, w: 0.22, hw: 1.0, gw: 5 },
  pirate: { core: new THREE.Color(12, 8, 6), halo: new THREE.Color(7.5, 1.0, 0.5), len: 18, w: 0.22, hw: 1.1, gw: 5 },
  heavy: { core: new THREE.Color(12, 8, 5), halo: new THREE.Color(6.5, 2.0, 0.35), len: 42, w: 0.5, hw: 2.6, gw: 12 },
  slug: { core: new THREE.Color(10, 11, 14), halo: new THREE.Color(1.6, 3.2, 9.0), len: 55, w: 0.16, hw: 0.8, gw: 5 },
  tracer: { core: new THREE.Color(12, 8, 3.5), halo: new THREE.Color(6.0, 2.4, 0.5), len: 14, w: 0.12, hw: 0.6, gw: 3 },
  plasma: { core: new THREE.Color(7, 12, 8), halo: new THREE.Color(1.0, 6.5, 2.6), len: 22, w: 0.8, hw: 3.2, gw: 14 },
};

export class Projectiles {
  constructor(scene, effects) {
    this.scene = scene;
    this.fx = effects;
    this.list = [];
    this.pool = [];
    this.mats = {};
    for (const [k, t] of Object.entries(BOLT_TYPES)) {
      this.mats[k] = {
        core: new THREE.MeshBasicMaterial({ color: t.core, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
        halo: new THREE.MeshBasicMaterial({ color: t.halo, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
        glow: new THREE.SpriteMaterial({ map: glow, color: t.halo.clone().multiplyScalar(0.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
      };
    }
  }
  get(type) {
    let p = this.pool.find((x) => x.type === type && !x.active);
    if (!p) {
      const t = BOLT_TYPES[type];
      const g = new THREE.Group();
      const core = new THREE.Mesh(boltGeo, this.mats[type].core);
      core.scale.set(t.w, t.w, t.len);
      const halo = new THREE.Mesh(boltGeo, this.mats[type].halo);
      halo.scale.set(t.hw, t.hw, t.len * 1.15);
      const head = new THREE.Sprite(this.mats[type].glow);
      head.position.z = t.len * 0.4;
      head.scale.setScalar(t.gw);
      g.add(core, halo, head);
      g.renderOrder = 22;
      this.scene.add(g);
      p = { type, t, core, halo, head, obj: g, active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), prev: new THREE.Vector3() };
      this.pool.push(p);
    }
    return p;
  }
  fire(type, from, dir, speed, inherit, range, damage, owner, profile) {
    const p = this.get(type);
    p.active = true;
    p.obj.visible = true;
    p.pos.copy(from); p.prev.copy(from);
    p.vel.copy(dir).multiplyScalar(speed).add(inherit);
    p.life = range / speed;
    p.damage = damage; p.owner = owner; p.profile = profile;
    p.obj.position.copy(from);
    p.obj.quaternion.setFromUnitVectors(_z, dir);
    const L = Math.max(p.t.len, speed * 0.015);
    p.core.scale.z = L; p.halo.scale.z = L * 1.15; p.head.position.z = L * 0.4;
    this.list.push(p);
    return p;
  }
  update(dt, entities, colliders, onHit) {
    const cam = this.fx.camera;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.prev.copy(p.pos);
      p.pos.addScaledVector(p.vel, dt);
      p.life -= dt;
      p.obj.position.copy(p.pos);
      if (cam) {
        // keep distant shots a few pixels wide so they stay readable
        const d = p.pos.distanceTo(cam.position), t = p.t;
        p.core.scale.x = p.core.scale.y = Math.max(t.w, d * 0.0018);
        p.halo.scale.x = p.halo.scale.y = Math.max(t.hw, d * 0.005);
        p.head.scale.setScalar(Math.max(t.gw, d * 0.022));
      }
      let hit = null, hitT = Infinity, hitEnt = null;
      // segment vs entities
      const seg = _v.subVectors(p.pos, p.prev);
      const segLen = seg.length();
      for (const e of entities) {
        if (!e.alive || e === p.owner || e.faction === p.owner.faction) continue;
        const ep = e.ship.group.position;
        // broad phase
        _v2.subVectors(ep, p.prev);
        const along = _v2.dot(seg) / (segLen || 1);
        if (along < -e.ship.radius || along > segLen + e.ship.radius) continue;
        const closest = _v3.copy(p.prev).addScaledVector(seg, Math.max(0, Math.min(1, along / (segLen || 1))));
        if (closest.distanceTo(ep) > e.ship.radius * 1.6) continue;
        for (const hs of e.ship.hitSpheres) {
          const c = _v3.set(hs[0], hs[1], hs[2]).applyQuaternion(e.ship.group.quaternion).add(ep);
          const t = raySphere(p.prev, seg, segLen, c, hs[3] + (e.shield > 0 ? 2 : 0));
          if (t !== null && t < hitT) { hitT = t; hitEnt = e; }
        }
      }
      for (const c of colliders) {
        const t = raySphere(p.prev, seg, segLen, c.p, c.r * 0.92);
        if (t !== null && t < hitT) { hitT = t; hitEnt = null; hit = c; }
      }
      if (hitT !== Infinity) {
        const hp = new THREE.Vector3().copy(p.prev).addScaledVector(seg, hitT / (segLen || 1));
        onHit(p, hitEnt, hp);
        this.kill(p, i);
        continue;
      }
      if (p.life <= 0) this.kill(p, i);
    }
  }
  kill(p, i) {
    p.active = false; p.obj.visible = false;
    this.list.splice(i, 1);
  }
}

// returns distance along the segment to the first intersection, or null
export function raySphere(o, seg, segLen, c, r) {
  if (segLen <= 0) return null;
  const dx = seg.x / segLen, dy = seg.y / segLen, dz = seg.z / segLen;
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * dx + oy * dy + oz * dz;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  if (cc < 0) return 0;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t < 0 || t > segLen) return null;
  return t;
}

// ---------------------------------------------------------------- missiles
export class Missiles {
  constructor(scene, effects, env) {
    this.scene = scene; this.fx = effects; this.list = [];
    const body = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.6, roughness: 0.4, envMap: env });
    const tip = new THREE.MeshStandardMaterial({ color: 0xb03018, metalness: 0.4, roughness: 0.5, envMap: env });
    this.make = () => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 10).rotateX(Math.PI / 2), body);
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 10).rotateX(Math.PI / 2), tip);
      t.position.z = 1.35;
      g.add(b, t);
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.35, 0.4), body);
        f.position.set(0, 0, -0.9);
        f.rotation.z = i * Math.PI / 2;
        f.translateY(0.2);
        g.add(f);
      }
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(5, 3, 1.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      fl.position.z = -1.3; fl.scale.setScalar(3.5);
      g.add(fl);
      g.userData.flare = fl;
      return g;
    };
  }
  launch(from, dir, inherit, target, owner, damage, speed = 850) {
    const obj = this.make();
    obj.position.copy(from);
    obj.quaternion.setFromUnitVectors(_z, dir);
    this.scene.add(obj);
    this.list.push({ obj, vel: dir.clone().multiplyScalar(80).add(inherit), target, owner, damage, speed, life: 14, arm: 0.35 });
    this.fx.flash(from, 9, 0xffc080, 0.18);
  }
  update(dt, colliders, onDetonate, sound) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      m.life -= dt; m.arm -= dt;
      const fwd = _v.set(0, 0, 1).applyQuaternion(m.obj.quaternion);
      if (m.target && m.target.alive && m.arm < 0.2) {
        // proportional-ish pursuit with lead
        const tp = m.target.ship.group.position;
        const rel = _v2.subVectors(tp, m.obj.position);
        const dist = rel.length();
        const tt = dist / Math.max(m.speed, 1);
        rel.addScaledVector(m.target.vel, tt * 0.8).normalize();
        _q.setFromUnitVectors(fwd, rel);
        const ang = 2 * Math.acos(Math.min(1, Math.abs(_q.w)));
        const maxTurn = 2.6 * dt;
        if (ang > 1e-4) {
          const k = Math.min(1, maxTurn / ang);
          const qq = new THREE.Quaternion().slerp(_q, k);
          m.obj.quaternion.premultiply(qq);
        }
        if (dist < 8 + m.target.ship.radius * 0.6) { this.detonate(m, i, onDetonate); continue; }
      }
      fwd.set(0, 0, 1).applyQuaternion(m.obj.quaternion);
      const accel = m.arm > 0 ? 0 : 500;
      m.vel.addScaledVector(fwd, accel * dt);
      // aerodynamic-free: bleed lateral velocity so the missile follows its nose
      const fv = m.vel.dot(fwd);
      _v3.copy(fwd).multiplyScalar(fv);
      m.vel.lerp(_v3, Math.min(1, dt * 3));
      if (m.vel.length() > m.speed) m.vel.setLength(m.speed);
      m.obj.position.addScaledVector(m.vel, dt);
      if (this.fx.camera) m.obj.userData.flare.scale.setScalar(Math.max(3.5, m.obj.position.distanceTo(this.fx.camera.position) * 0.016) * (0.85 + Math.random() * 0.3));
      if (m.arm < 0.2) {
        const back = _v3.copy(m.obj.position).addScaledVector(fwd, -1.4);
        this.fx.trail(back, _v2.copy(m.vel).multiplyScalar(0.05), 1.4, 2.8, true);
      }
      let boom = m.life <= 0;
      for (const c of colliders) if (c.p.distanceTo(m.obj.position) < c.r) { boom = true; break; }
      if (boom) this.detonate(m, i, onDetonate);
    }
  }
  detonate(m, i, onDetonate) {
    this.scene.remove(m.obj);
    this.list.splice(i, 1);
    onDetonate(m);
  }
}

export function intercept(shooter, shooterVel, target, targetVel, speed) {
  const rp = _v.subVectors(target, shooter);
  const rv = _v2.subVectors(targetVel, shooterVel);
  const a = rv.dot(rv) - speed * speed;
  const b = 2 * rv.dot(rp);
  const c = rp.dot(rp);
  let t;
  if (Math.abs(a) < 1e-6) t = -c / b;
  else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const t1 = (-b - s) / (2 * a), t2 = (-b + s) / (2 * a);
    t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2);
  }
  if (!(t > 0)) return null;
  return new THREE.Vector3().copy(target).addScaledVector(rv, t);
}

export { rng };
