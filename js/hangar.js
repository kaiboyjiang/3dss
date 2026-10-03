import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Kit, G, mat } from './geo.js';
import { hullMaps } from './textures.js';
import { animateShip } from './ships.js';

function hazardTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#16171a'; g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#d8a520';
  for (let x = -32; x < 288; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function signTexture(text, sub) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0c0f13'; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#e8eef4'; g.font = 'bold 120px "Segoe UI", Arial, sans-serif'; g.textBaseline = 'middle';
  g.fillText(text, 40, 110);
  g.fillStyle = '#d8a520'; g.font = '44px "Segoe UI", Arial, sans-serif';
  g.fillText(sub, 44, 205);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function starTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#020308'); gr.addColorStop(0.7, '#061022'); gr.addColorStop(1, '#14305a');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 900; i++) {
    const a = Math.random();
    g.fillStyle = `rgba(255,255,255,${0.2 + a * 0.8})`;
    g.fillRect(Math.random() * 1024, Math.random() * 512, a > 0.97 ? 2 : 1, a > 0.97 ? 2 : 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Ship hangar bay rendered with its own scene/camera while docked.
function slotLabel(text, on, kind) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = on ? 'rgba(60,36,4,0.85)' : 'rgba(4,16,26,0.75)';
  g.strokeStyle = on ? '#ffc060' : kind === 'w' ? '#7cd0ff' : '#80f0a8';
  g.lineWidth = 4;
  g.beginPath(); g.roundRect(6, 8, 116, 48, 10); g.fill(); g.stroke();
  g.fillStyle = on ? '#ffe0a0' : '#e8f6ff';
  g.font = 'bold 30px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 33);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Hangar {
  constructor(renderer) {
    this.renderer = renderer;
    const w = window.innerWidth, h = window.innerHeight;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040507);
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.5, 4000);
    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new OutputPass());
    this.env = this.buildEnv();
    this.yaw = 2.4; this.pitch = 0.28; this.dist = 80; this.distWant = 80;
    this.target = new THREE.Vector3(0, 8, 0); this.targetWant = new THREE.Vector3(0, 8, 0);
    this.focus = 'ship';
    this.ship = null; this.outfit = null; this.cradle = null;
    this.swapped = new Map();
    this.time = 0;
    this.buildRoom();
  }

  buildEnv() {
    const s = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.BoxGeometry(400, 160, 400), new THREE.MeshBasicMaterial({ color: 0x1a1d22, side: THREE.BackSide }));
    room.position.y = 70;
    s.add(room);
    const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 5.5) });
    for (let i = -3; i <= 3; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 300), strip);
      m.position.set(i * 45, 148, 0);
      s.add(m);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(220, 90, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.35, 0.8) }));
    door.position.set(0, 50, -199);
    s.add(door);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(400, 1, 400), new THREE.MeshBasicMaterial({ color: 0x2a2c30 }));
    s.add(floor);
    const pm = new THREE.PMREMGenerator(this.renderer);
    const t = pm.fromScene(s, 0.03).texture;
    pm.dispose();
    return t;
  }

  buildRoom() {
    const env = this.env;
    const fm = hullMaps({ seed: 81, base: [70, 72, 76], accent: [190, 150, 40], accentChance: 0.03, darkChance: 0.3, wear: 0.8, size: 1024, labels: ['BAY 07', 'NO STEP', 'CLEAR ZONE'] });
    const wm = hullMaps({ seed: 82, base: [54, 58, 64], accent: [120, 126, 134], accentChance: 0.08, darkChance: 0.25, wear: 0.6, size: 1024, labels: ['HELION', 'VENT', 'P-07'] });
    const M = {
      floor: new THREE.MeshStandardMaterial({ map: fm.map, normalMap: fm.normalMap, roughnessMap: fm.roughnessMap, metalness: 0.55, roughness: 0.6, envMap: env, envMapIntensity: 0.6 }),
      wall: new THREE.MeshStandardMaterial({ map: wm.map, normalMap: wm.normalMap, roughnessMap: wm.roughnessMap, metalness: 0.6, roughness: 0.55, envMap: env, envMapIntensity: 0.7 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x5c6168, metalness: 0.9, roughness: 0.35, envMap: env }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1c1e22, metalness: 0.7, roughness: 0.5, envMap: env }),
      light: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 5.4) }),
      blue: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.4, 4) }),
      amber: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 0.4) }),
    };
    this.M = M;
    const room = new THREE.Group();
    this.room = room;
    const k = new Kit();
    const W = 200, H = 140;
    k.add('floor', G.box(W * 2, 2, W * 2), mat([0, -1, 0]));
    k.add('wall', G.box(W * 2, H, 4), mat([0, H / 2, W]));
    k.add('wall', G.box(4, H, W * 2), mat([W, H / 2, 0]));
    k.add('wall', G.box(4, H, W * 2), mat([-W, H / 2, 0]));
    k.add('wall', G.box(W * 2, 4, W * 2), mat([0, H, 0]));
    // front wall with the open bay door
    k.add('wall', G.box(W * 2, H - 95, 4), mat([0, 95 + (H - 95) / 2, -W]));
    k.add('wall', G.box(W - 110, 95, 4), mat([-(110 + (W - 110) / 2), 47.5, -W]));
    k.add('wall', G.box(W - 110, 95, 4), mat([110 + (W - 110) / 2, 47.5, -W]));
    k.add('steel', G.box(8, 95, 10), mat([110, 47.5, -W]));
    k.add('steel', G.box(8, 95, 10), mat([-110, 47.5, -W]));
    k.add('steel', G.box(228, 8, 10), mat([0, 95, -W]));
    for (let x = -100; x <= 100; x += 25) k.add('amber', G.box(3, 1.2, 1), mat([x, 90.5, -W + 5.5]));
    // wall columns and ribs
    for (let i = -4; i <= 4; i++) {
      const p = i * 45;
      k.add('steel', G.rbox(7, H, 7, 1), mat([p, H / 2, W - 4]));
      k.add('steel', G.rbox(7, H, 7, 1), mat([W - 4, H / 2, p]));
      k.add('steel', G.rbox(7, H, 7, 1), mat([-W + 4, H / 2, p]));
      k.add('dark', G.box(5, 4, W * 2), mat([p, H - 6, 0]));
      k.add('light', G.box(3, 1, W * 1.6), mat([p + 12, H - 2.6, 0]));
      k.add('dark', G.box(2, 18, 12), mat([W - 2.5, 12, p + 20]));
      k.add('blue', G.box(0.5, 1, 10), mat([W - 3.6, 18, p + 20]));
      k.add('dark', G.box(2, 18, 12), mat([-W + 2.5, 12, p + 20]));
      k.add('blue', G.box(0.5, 1, 10), mat([-W + 3.6, 18, p + 20]));
    }
    // catwalks
    for (const s of [1, -1]) {
      k.add('steel', G.box(14, 1, W * 2 - 20), mat([s * (W - 12), 40, 0]));
      k.add('dark', G.box(0.4, 3, W * 2 - 20), mat([s * (W - 19), 42, 0]));
      for (let z = -W + 20; z <= W - 20; z += 20) k.add('dark', G.box(0.4, 3, 0.4), mat([s * (W - 19), 41.5, z]));
    }
    k.add('steel', G.box(W * 2 - 20, 1, 14), mat([0, 40, W - 12]));
    // overhead gantry crane
    k.add('steel', G.box(W * 2 - 10, 8, 6), mat([0, H - 22, 30]));
    k.add('dark', G.box(16, 10, 14), mat([-30, H - 30, 30]));
    k.add('steel', G.cyl(0.8, 0.8, 60, 8), mat([-30, H - 66, 30]));
    k.add('dark', G.box(8, 4, 8), mat([-30, H - 97, 30]));
    // floor lane markings and floor lights
    for (const s of [1, -1]) {
      k.add('amber', G.box(1.2, 0.05, W * 1.8), mat([s * 120, 0.03, 0]));
      for (let z = -W + 10; z < W; z += 30) k.add('blue', G.box(2, 0.2, 2), mat([s * 128, 0.1, z]));
    }
    // cargo crates and tool carts
    for (let i = 0; i < 14; i++) {
      const x = (i % 2 ? 1 : -1) * (150 + (i * 37) % 30), z = -150 + i * 22;
      k.add(i % 3 ? 'wall' : 'dark', G.rbox(10, 6 + (i % 3) * 3, 8, 0.6), mat([x, 3 + (i % 3) * 1.5, z], [0, i * 0.4, 0]));
    }
    room.add(k.build(M, { uvTile: { floor: 18, wall: 10 } }));
    // signage
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(80, 20), new THREE.MeshBasicMaterial({ map: signTexture('BAY 07', 'HELION YARDS · SHIP SERVICES') }));
    sign.position.set(0, 80, W - 2.2); sign.rotation.y = Math.PI;
    room.add(sign);
    // bay door looking out at space, behind a blue force field
    const space = new THREE.Mesh(new THREE.PlaneGeometry(500, 250), new THREE.MeshBasicMaterial({ map: starTexture() }));
    space.position.set(0, 60, -W - 60);
    room.add(space);
    const field = new THREE.Mesh(new THREE.PlaneGeometry(220, 95), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.35, 0.9), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    field.position.set(0, 47.5, -W - 1);
    room.add(field);
    this.field = field;
    room.traverse((o) => { if (o.isMesh && o.material.isMeshStandardMaterial) { o.receiveShadow = true; o.castShadow = o.position.y > 0.5; } });
    this.scene.add(room);
    // lighting
    this.scene.add(new THREE.HemisphereLight(0x9aa8ba, 0x202226, 0.55));
    const key = new THREE.DirectionalLight(0xfff2e0, 1.6);
    key.position.set(40, 160, 60);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.05;
    this.scene.add(key, key.target);
    this.key = key;
    for (const [x, z, c] of [[-120, -120, 0x9fc4ff], [120, -120, 0xffd8a8], [-120, 120, 0xffe8c8], [120, 120, 0xa8ccff]]) {
      const s = new THREE.SpotLight(c, 0.9, 0, 0.55, 0.6, 0);
      s.position.set(x, H - 10, z);
      s.target.position.set(0, 0, 0);
      this.scene.add(s, s.target);
    }
    const rim = new THREE.DirectionalLight(0x5080ff, 0.6);
    rim.position.set(0, 40, -200);
    this.scene.add(rim);
    // holo pedestal for outfits
    const pk = new Kit();
    pk.add('dark', G.cyl(3.4, 3.8, 1.0, 32), mat([0, 0.5, 0]));
    pk.add('steel', G.cyl(2.6, 3.0, 1.4, 32), mat([0, 1.7, 0]));
    pk.add('blue', G.torus(2.7, 0.08, 6, 48), mat([0, 2.45, 0], [Math.PI / 2, 0, 0]));
    pk.add('blue', G.torus(3.6, 0.05, 6, 48), mat([0, 1.02, 0], [Math.PI / 2, 0, 0]));
    const ped = pk.build(M);
    ped.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 7, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.55, 1.2), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 6;
    this.pedestal = new THREE.Group();
    this.pedestal.add(ped, beam);
    const pl = new THREE.PointLight(0x9fd0ff, 30, 30, 2);
    pl.position.set(0, 9, 3);
    this.pedestal.add(pl);
    this.pedestal.visible = false;
    this.scene.add(this.pedestal);
    this.holder = new THREE.Group();
    this.holder.position.y = 5.5;
    this.pedestal.add(this.holder);
  }

  swapEnv(obj) {
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (!m || !('envMap' in m) || !m.envMap) return;
      if (!this.swapped.has(m)) this.swapped.set(m, m.envMap);
      m.envMap = this.env;
    });
  }

  restoreEnv() {
    for (const [m, e] of this.swapped) m.envMap = e;
    this.swapped.clear();
  }

  dispose(obj) {
    obj.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material && (o.material.isShaderMaterial || o.material.isSpriteMaterial)) o.material.dispose();
    });
  }

  setSlots(list, sel, focus) {
    if (this.slotG) {
      this.slotG.parent?.remove(this.slotG);
      this.slotG.traverse((o) => { if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
      this.slotG = null;
    }
    if (!list || !this.ship) return;
    if (!this.ringGeo) {
      this.ringGeo = new THREE.RingGeometry(0.9, 1.15, 48); this.ringGeo.userData.shared = true;
      this.stemGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6); this.stemGeo.translate(0, 0.5, 0); this.stemGeo.userData.shared = true;
    }
    const R = this.ship.radius, ls = 0.55 + R * 0.025;
    const g = new THREE.Group();
    let selPos = null;
    for (const s of list) {
      const on = !!sel && s.k === sel.k && s.i === sel.i;
      const col = on ? new THREE.Color(5, 3, 0.6) : s.k === 'w' ? new THREE.Color(0.5, 1.6, 3.2) : new THREE.Color(0.5, 2.6, 1.1);
      const up = s.flip ? -1 : 1;
      const m = new THREE.Group();
      m.position.fromArray(s.p);
      const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: on ? 1 : 0.6, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
      const base = s.s * (s.k === 'u' ? 1.5 : 1.3);
      ring.rotation.x = -Math.PI / 2; ring.position.y = up * 0.3 * s.s; ring.scale.setScalar(base * (on ? 1.5 : 1)); ring.renderOrder = 30;
      m.add(ring);
      const h = 2.6 * s.s + ls * 1.4;
      if (on) {
        const stem = new THREE.Mesh(this.stemGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false }));
        stem.scale.set(ls, h, ls); if (up < 0) stem.rotation.x = Math.PI; stem.renderOrder = 30;
        m.add(stem);
      }
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: slotLabel(`${s.k.toUpperCase()}${s.i + 1}`, on, s.k), depthTest: false, depthWrite: false, transparent: true }));
      spr.position.y = up * (h + ls * 0.8); spr.scale.set(3.2 * ls, 1.6 * ls, 1); spr.renderOrder = 31;
      m.add(spr);
      m.userData = { ring, on, base };
      g.add(m);
      if (on) selPos = new THREE.Vector3().fromArray(s.p);
    }
    this.ship.group.add(g);
    this.slotG = g;
    if (focus && selPos && this.focus === 'ship') {
      this.ship.group.updateMatrixWorld(true);
      this.ship.group.localToWorld(selPos);
      this.targetWant.copy(this.shipCenter).lerp(selPos, 0.75);
      this.distWant = R * 1.25 + 8;
    }
  }

  setShip(ship, keepView) {
    this.setSlots(null);
    if (this.ship) { this.scene.remove(this.ship.group); this.dispose(this.ship.group); }
    if (this.cradle) { this.scene.remove(this.cradle); this.dispose(this.cradle); }
    this.ship = ship;
    const g = ship.group;
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    g.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { o.castShadow = true; o.receiveShadow = true; } });
    this.swapEnv(g);
    this.scene.add(g);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g, true);
    const R = ship.radius;
    const lift = 1.5 + R * 0.05;
    g.position.y = lift - box.min.y;
    // landing cradle sized to the hull
    const k = new Kit();
    const pr = Math.max(14, R * 1.25);
    k.add('dark', G.cyl(pr, pr + 1, 0.4, 96), mat([0, 0.2, 0]));
    k.add('steel', G.cyl(pr * 0.7, pr * 0.7, 0.5, 96), mat([0, 0.25, 0]));
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      k.add('blue', G.box(0.8, 0.2, 0.8), mat([Math.cos(a) * (pr - 1.4), 0.45, Math.sin(a) * (pr - 1.4)]));
    }
    const sx = Math.max(1.2, (box.max.x - box.min.x) * 0.22), sz = (box.max.z - box.min.z) * 0.28;
    for (const [x, z] of [[sx, sz], [-sx, sz], [sx, -sz], [-sx, -sz]]) {
      const cw = Math.max(0.8, R * 0.06);
      k.add('steel', G.rbox(cw, lift + 0.6, cw * 1.6, cw * 0.15), mat([x, (lift + 0.6) / 2, z]));
      k.add('dark', G.rbox(cw * 2.2, 0.5, cw * 2.6, 0.1), mat([x, 0.6, z]));
      k.add('amber', G.box(cw * 1.02, cw * 0.15, cw * 1.62), mat([x, lift * 0.5, z]));
    }
    const cradle = k.build(this.M);
    cradle.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    const ring = new THREE.Mesh(new THREE.RingGeometry(pr + 1, pr + 2.6, 128), new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.7, metalness: 0.2 }));
    ring.material.map.repeat.set(40, 1);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
    ring.receiveShadow = true;
    cradle.add(ring);
    this.cradle = cradle;
    this.scene.add(cradle);
    const cy = lift + (box.max.y - box.min.y) * 0.45;
    this.shipCenter = new THREE.Vector3(0, cy, 0);
    this.shipDist = R * 2.7 + 8;
    this.pedestal.position.set(-(R * 1.2 + 10), 0, R * 0.55 + 4);
    const sh = this.key.shadow.camera;
    const ext = R * 1.8 + 30;
    sh.left = -ext; sh.right = ext; sh.top = ext; sh.bottom = -ext; sh.near = 1; sh.far = 600;
    sh.updateProjectionMatrix();
    this.key.position.set(R * 0.6 + 20, 200, R * 0.8 + 40);
    if (this.focus === 'ship') this.focusShip(keepView);
  }

  setOutfit(obj) {
    if (this.outfit) { this.holder.remove(this.outfit); this.dispose(this.outfit); this.outfit = null; }
    if (!obj) { this.pedestal.visible = false; this.focusShip(); return; }
    this.swapEnv(obj);
    obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const sc = 4.2 / Math.max(size.x, size.y, size.z);
    obj.scale.multiplyScalar(sc);
    const c = box.getCenter(new THREE.Vector3()).multiplyScalar(sc);
    const pivot = new THREE.Group();
    obj.position.sub(c);
    pivot.add(obj);
    this.outfit = pivot;
    this.holder.add(pivot);
    this.pedestal.visible = true;
    this.focus = 'outfit';
    this.targetWant.copy(this.pedestal.position).add(new THREE.Vector3(0, 5, 0));
    this.distWant = 15;
  }

  focusShip(keepView) {
    this.focus = 'ship';
    if (!this.shipCenter) return;
    this.targetWant.copy(this.shipCenter);
    if (!keepView) this.distWant = this.shipDist;
  }

  snap() { this.target.copy(this.targetWant); this.dist = this.distWant; }
  drag(dx, dy) {
    this.yaw -= dx * 0.006;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, 0.02, 1.25);
  }
  zoom(dy) {
    const R = this.ship ? this.ship.radius : 20;
    const min = this.focus === 'outfit' ? 7 : R * 1.2 + 4;
    const max = this.focus === 'outfit' ? 40 : Math.min(185, R * 5 + 30);
    this.distWant = THREE.MathUtils.clamp(this.distWant * Math.pow(1.0015, dy), min, max);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  update(dt) {
    this.time += dt;
    const k = 1 - Math.exp(-dt * 4);
    this.target.lerp(this.targetWant, k);
    this.dist += (this.distWant - this.dist) * k;
    const cp = Math.cos(this.pitch);
    this.camera.position.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp).multiplyScalar(this.dist).add(this.target);
    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -192, 192);
    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -192, 192);
    this.camera.position.y = THREE.MathUtils.clamp(this.camera.position.y, 1.5, 132);
    this.camera.lookAt(this.target);
    if (this.ship) {
      animateShip(this.ship, dt, this.time, 0.04);
    }
    if (this.slotG) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
      for (const m of this.slotG.children) {
        const { ring, on, base } = m.userData;
        if (on) { ring.scale.setScalar(base * (1.45 + pulse * 0.35)); ring.material.opacity = 0.65 + pulse * 0.35; }
      }
    }
    if (this.outfit) this.outfit.rotation.y += dt * 0.6;
    this.holder.position.y = 5.5 + Math.sin(this.time * 1.5) * 0.15;
    this.field.material.opacity = 0.15 + Math.sin(this.time * 2) * 0.03;
  }

  setQuality(q) {
    const k = this.key;
    k.castShadow = q.shadow > 0;
    const n = Math.min(4096, (q.shadow || 256) * 2);
    k.shadow.mapSize.set(n, n);
    if (k.shadow.map) { k.shadow.map.dispose(); k.shadow.map = null; }
    for (const t of [this.composer.renderTarget1, this.composer.renderTarget2]) if (t.samples !== q.msaa) { t.samples = q.msaa; t.dispose(); }
  }

  render() { this.composer.render(); }
}
