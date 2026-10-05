import * as THREE from 'three';
import { Kit, G, mat } from './geo.js';
import { hullMaps, rng, glowTexture } from './textures.js';
import { LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './shaders.js';

// Ships face +Z, up is +Y. Port (left) is +X.

const glow = glowTexture(128, 2.0);
const liveryCache = {};

export function livery(name, env) {
  if (liveryCache[name]) return liveryCache[name];
  const L = {
    player: { base: [214, 216, 218], accent: [228, 106, 22], second: [36, 38, 42], eng: [0.55, 0.75, 1.0], labels: ['UNS', 'VALKYRIE', 'FA-31', 'NO STEP', 'RCS', '0731', 'DANGER'], seed: 3, wear: 0.35 },
    pirate: { base: [74, 76, 80], accent: [168, 28, 22], second: [24, 24, 26], eng: [1.0, 0.45, 0.2], labels: ['XX', 'KILL', 'CR-9', '666', 'RCS'], seed: 9, wear: 0.85 },
    cruiser: { base: [96, 84, 74], accent: [176, 34, 26], second: [30, 28, 28], eng: [1.0, 0.4, 0.18], labels: ['CORSAIR', 'BAY', 'C-01', 'HAZARD'], seed: 13, wear: 1.0 },
    hauler: { base: [190, 176, 120], accent: [60, 90, 140], second: [50, 52, 56], eng: [0.6, 0.8, 1.0], labels: ['KALTOS LOG.', 'CARGO', 'H-220', 'HEAVY'], seed: 17, wear: 0.6 },
    kestrel: { base: [62, 64, 68], accent: [40, 190, 210], second: [22, 22, 24], eng: [0.6, 0.85, 1.0], labels: ['KESTREL', 'K-7', 'NO STEP', 'RCS', '0117'], seed: 41, wear: 0.3 },
    warden: { base: [124, 126, 120], accent: [226, 178, 32], second: [40, 42, 44], eng: [0.5, 0.7, 1.0], labels: ['WARDEN', 'DD-4', 'HAZARD', '0442', 'RCS'], seed: 51, wear: 0.5 },
    paladin: { base: [222, 224, 228], accent: [40, 84, 170], second: [52, 56, 64], eng: [0.55, 0.8, 1.0], labels: ['PALADIN', 'BC-1', 'HELION YARDS', 'DANGER', 'VENT'], seed: 61, wear: 0.2 },
    mantis: { base: [104, 112, 92], accent: [212, 74, 36], second: [34, 36, 32], eng: [1.0, 0.7, 0.35], labels: ['MANTIS', 'GS-9', 'NO STEP', 'HAZARD', '0912'], seed: 81, wear: 0.55 },
    corvid: { base: [38, 40, 46], accent: [150, 50, 210], second: [18, 18, 22], eng: [0.85, 0.55, 1.0], labels: ['CORVID', 'X-2', 'RCS', '0023'], seed: 91, wear: 0.15 },
    bastion: { base: [118, 122, 128], accent: [198, 60, 32], second: [42, 44, 48], eng: [0.55, 0.75, 1.0], labels: ['BASTION', 'CA-6', 'HELION YARDS', 'DANGER', 'BAY 2'], seed: 101, wear: 0.45 },
    hornet: { base: [178, 182, 186], accent: [222, 178, 30], second: [30, 32, 36], eng: [0.6, 0.8, 1.0], labels: ['HORNET', 'F-3', 'RCS', 'NO STEP', '0303'], seed: 111, wear: 0.4 },
    wisp: { base: [204, 208, 212], accent: [56, 168, 92], second: [40, 44, 48], eng: [0.6, 0.9, 1.0], labels: ['WISP', 'SCOUT', 'PF-2', 'SENSOR', 'RCS'], seed: 121, wear: 0.25 },
    mule: { base: [176, 150, 96], accent: [40, 70, 120], second: [52, 50, 48], eng: [1.0, 0.75, 0.45], labels: ['MULE', 'CARGO', 'LF-40', 'HEAVY', 'NO STEP'], seed: 131, wear: 0.75 },
    atlas: { base: [196, 122, 40], accent: [60, 64, 70], second: [44, 44, 46], eng: [0.9, 0.75, 0.5], labels: ['ATLAS', 'BULK', 'AT-900', 'HAZARD', 'CARGO'], seed: 141, wear: 0.7 },
    aurora: { base: [236, 236, 232], accent: [30, 120, 190], second: [70, 74, 80], eng: [0.55, 0.8, 1.0], labels: ['AURORA', 'STARLINES', 'DECK 4', 'EXIT'], seed: 151, wear: 0.08 },
    sabre: { base: [96, 104, 112], accent: [200, 40, 40], second: [32, 34, 38], eng: [0.55, 0.75, 1.0], labels: ['SABRE', 'CL-3', 'DANGER', 'RCS'], seed: 161, wear: 0.4 },
    sovereign: { base: [150, 154, 160], accent: [210, 170, 50], second: [44, 46, 52], eng: [0.55, 0.75, 1.0], labels: ['SOVEREIGN', 'BB-1', 'HELION YARDS', 'DANGER', 'VENT'], seed: 171, wear: 0.35 },
    leviathan: { base: [58, 60, 66], accent: [200, 30, 30], second: [24, 24, 28], eng: [0.7, 0.6, 1.0], labels: ['LEVIATHAN', 'DN-0', 'HELION YARDS', 'DANGER', 'RADIATION'], seed: 181, wear: 0.3 },
    cutlass: { base: [88, 82, 74], accent: [214, 160, 30], second: [26, 24, 22], eng: [1.0, 0.5, 0.22], labels: ['CUTLASS', 'XX', 'SCRAP', '13', 'NO STEP'], seed: 191, wear: 1.0 },
    reaver: { base: [40, 40, 42], accent: [190, 24, 20], second: [16, 16, 18], eng: [1.0, 0.36, 0.16], labels: ['REAVER', 'BLOOD', 'R-66', 'RAM', 'HAZARD'], seed: 201, wear: 0.9 },
    ravager: { base: [70, 62, 56], accent: [150, 120, 96], second: [22, 20, 20], eng: [1.0, 0.32, 0.14], labels: ['RAVAGER', 'WARLORD', 'CLAN', 'KILL', 'HAZARD', '0666'], seed: 211, wear: 1.0 },
    navy: { base: [72, 84, 98], accent: [230, 232, 236], second: [28, 32, 38], eng: [0.5, 0.8, 1.0], labels: ['HELION', 'NAVY', 'HN-12', 'RCS'], seed: 71, wear: 0.35 },
  }[name];
  const h = hullMaps({ seed: L.seed, base: L.base, accent: L.accent, accentChance: 0.05, darkChance: 0.08, wear: L.wear, labels: L.labels });
  const a = hullMaps({ seed: L.seed + 1, base: L.accent, accent: L.base, accentChance: 0.0, darkChance: 0.05, wear: L.wear * 0.8, labels: L.labels, size: 512 });
  const d = hullMaps({ seed: L.seed + 2, base: L.second, accent: [80, 80, 80], accentChance: 0.1, darkChance: 0.2, wear: L.wear, size: 512 });
  const engColor = new THREE.Color(L.eng[0], L.eng[1], L.eng[2]);
  const M = {
    hull: new THREE.MeshStandardMaterial({ map: h.map, normalMap: h.normalMap, roughnessMap: h.roughnessMap, metalness: 0.35, roughness: 0.55, envMap: env, envMapIntensity: 0.9 }),
    accent: new THREE.MeshStandardMaterial({ map: a.map, normalMap: a.normalMap, roughnessMap: a.roughnessMap, metalness: 0.3, roughness: 0.5, envMap: env, envMapIntensity: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ map: d.map, normalMap: d.normalMap, roughnessMap: d.roughnessMap, metalness: 0.75, roughness: 0.45, envMap: env, envMapIntensity: 1.0 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8a8d92, metalness: 1.0, roughness: 0.28, envMap: env, envMapIntensity: 1.2 }),
    gun: new THREE.MeshStandardMaterial({ color: 0x2c2e31, metalness: 0.9, roughness: 0.35, envMap: env, envMapIntensity: 1.0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0b1420, metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMap: env, envMapIntensity: 2.4, emissive: new THREE.Color(0.02, 0.05, 0.08) }),
    nozzle: new THREE.MeshStandardMaterial({ color: 0x3a3632, metalness: 0.95, roughness: 0.4, envMap: env, side: THREE.DoubleSide }),
    engine: new THREE.MeshBasicMaterial({ color: engColor.clone().multiplyScalar(1.15) }),
    light: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5, 5) }),
    coil: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.4, 4) }),
    plasma: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 4.5, 2.4) }),
    amber: new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 2.2, 0.4) }),
    window: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.1, 1.5) }),
    engColor,
  };
  for (const k of ['engine', 'light', 'coil', 'plasma', 'amber', 'window']) M[k].userData.noShadow = true;
  liveryCache[name] = M;
  return M;
}

// ---------------------------------------------------------------- engine plume
const plumeGeo = (() => {
  const g = new THREE.CylinderGeometry(1, 0.25, 1, 24, 8, true);
  g.translate(0, -0.5, 0);
  g.rotateX(Math.PI / 2); // tail now along -Z... (y=-1 -> z=-1)
  return g;
})();

function plumeMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: color }, uPower: { value: 0.5 }, uTime: { value: 0 } },
    vertexShader: /* glsl */`
      ${LOGDEPTH_VERT_PARS}
      varying float vT; varying vec3 vN; varying vec3 vV;
      void main() {
        vT = -position.z;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
        ${LOGDEPTH_VERT}
      }`,
    fragmentShader: /* glsl */`
      ${LOGDEPTH_FRAG_PARS}
      uniform vec3 uColor; uniform float uPower; uniform float uTime;
      varying float vT; varying vec3 vN; varying vec3 vV;
      void main() {
        ${LOGDEPTH_FRAG}
        float f = abs(dot(normalize(vN), normalize(vV)));
        float core = pow(f, 2.0);
        float fall = pow(1.0 - clamp(vT, 0.0, 1.0), 1.6);
        float diamonds = 0.8 + 0.2 * sin(vT * 38.0 - uTime * 50.0);
        vec3 c = mix(uColor, vec3(1.0, 0.95, 0.9), core * (1.0 - vT));
        gl_FragColor = vec4(c * core * fall * diamonds * uPower * 1.5, 1.0);
      }`,
  });
}

function addEngine(ship, M, pos, radius, length) {
  const pm = plumeMaterial(M.engColor.clone().multiplyScalar(1.4));
  const plume = new THREE.Mesh(plumeGeo, pm);
  plume.position.copy(pos);
  plume.scale.set(radius, radius, length);
  plume.renderOrder = 10;
  ship.group.add(plume);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: M.engColor.clone().multiplyScalar(1.1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sp.position.copy(pos).add(new THREE.Vector3(0, 0, -radius * 0.4));
  sp.scale.setScalar(radius * 5);
  ship.group.add(sp);
  ship.engines.push({ plume, sprite: sp, radius, length });
}

function addLight(ship, pos, color, size, blink = 0, phase = 0) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sp.position.copy(pos);
  sp.scale.setScalar(size);
  ship.group.add(sp);
  ship.navLights.push({ sp, blink, phase, size });
}

// ---------------------------------------------------------------- turrets
export function buildTurret(M, kind = 'laser', scale = 1) {
  const root = new THREE.Group();
  const yaw = new THREE.Group();
  const pitch = new THREE.Group();
  root.add(yaw); yaw.add(pitch);
  const kb = new Kit(), ky = new Kit(), kp = new Kit();
  const muzzles = [];
  const barrels = [];
  if (kind === 'laser') {
    kb.add('dark', G.cyl(0.95, 1.15, 0.35, 24), mat([0, 0.17, 0]));
    kb.add('metal', G.cyl(0.7, 0.7, 0.2, 24), mat([0, 0.42, 0]));
    ky.add('hull', G.rbox(1.6, 0.75, 1.9, 0.18), mat([0, 0.85, -0.1]));
    ky.add('accent', G.rbox(1.7, 0.2, 1.3, 0.06), mat([0, 1.15, -0.3]));
    ky.add('dark', G.box(0.3, 0.5, 0.9), mat([0.88, 0.8, -0.2]));
    ky.add('dark', G.box(0.3, 0.5, 0.9), mat([-0.88, 0.8, -0.2]));
    ky.add('gun', G.cyl(0.05, 0.05, 0.9, 6), mat([0.45, 1.4, -0.6], [0.2, 0, 0]));
    for (const x of [-0.38, 0.38]) {
      const b = new THREE.Group();
      const kb2 = new Kit();
      kb2.add('gun', G.cyl(0.12, 0.14, 2.4, 16), mat([0, 0, 1.2], [Math.PI / 2, 0, 0]));
      for (let i = 0; i < 4; i++) kb2.add('metal', G.cyl(0.17, 0.17, 0.08, 16), mat([0, 0, 0.5 + i * 0.25], [Math.PI / 2, 0, 0]));
      kb2.add('dark', G.cyl(0.18, 0.15, 0.4, 16), mat([0, 0, 2.5], [Math.PI / 2, 0, 0]));
      kb2.add('coil', G.cyl(0.08, 0.08, 0.02, 12), mat([0, 0, 2.71], [Math.PI / 2, 0, 0]));
      const bm = kb2.build(M);
      b.add(bm);
      b.position.set(x, 0, 0.5);
      pitch.add(b);
      const mz = new THREE.Object3D(); mz.position.set(0, 0, 2.8); b.add(mz);
      muzzles.push(mz); barrels.push(b);
    }
    kp.add('dark', G.rbox(1.2, 0.5, 0.9, 0.1), mat([0, 0, 0.2]));
    pitch.position.set(0, 0.85, 0.3);
  } else if (kind === 'auto') {
    // rotary autocannon with side ammo feed
    kb.add('dark', G.cyl(0.9, 1.1, 0.35, 24), mat([0, 0.17, 0]));
    kb.add('metal', G.cyl(0.65, 0.65, 0.2, 24), mat([0, 0.42, 0]));
    ky.add('hull', G.rbox(1.5, 0.9, 1.6, 0.16), mat([0, 0.85, -0.1]));
    ky.add('accent', G.rbox(1.55, 0.18, 1.0, 0.05), mat([0, 1.3, -0.25]));
    ky.addMirrored('dark', G.box(0.25, 0.7, 0.8), mat([0.8, 0.85, 0]));
    ky.add('dark', G.rbox(0.6, 0.65, 1.0, 0.08), mat([-1.05, 0.75, -0.4]));
    ky.add('metal', G.box(0.3, 0.12, 0.9), mat([-0.7, 1.05, -0.2], [0, 0, -0.5]));
    const rotor = new THREE.Group();
    const kr = new Kit();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      kr.add('gun', G.cyl(0.065, 0.065, 2.5, 8), mat([Math.cos(a) * 0.19, Math.sin(a) * 0.19, 1.35], [Math.PI / 2, 0, 0]));
    }
    for (const z of [0.55, 1.7, 2.45]) kr.add('metal', G.cyl(0.3, 0.3, 0.1, 18), mat([0, 0, z], [Math.PI / 2, 0, 0]));
    kr.add('dark', G.cyl(0.36, 0.3, 0.5, 18), mat([0, 0, 0.15], [Math.PI / 2, 0, 0]));
    rotor.add(kr.build(M));
    rotor.position.set(0, 0, 0.35);
    pitch.add(rotor);
    const mz = new THREE.Object3D(); mz.position.set(0, 0, 2.7); rotor.add(mz);
    muzzles.push(mz); barrels.push(rotor);
    kp.add('dark', G.rbox(1.0, 0.6, 0.9, 0.1), mat([0, 0, -0.1]));
    kp.add('gun', G.cyl(0.42, 0.42, 0.5, 20), mat([0, 0, 0.25], [Math.PI / 2, 0, 0]));
    pitch.position.set(0, 0.88, 0.2);
  } else if (kind === 'plasma') {
    // plasma lance: magnetic bottle chamber feeding a ringed emitter
    kb.add('dark', G.cyl(1.3, 1.5, 0.45, 24), mat([0, 0.22, 0]));
    kb.add('metal', G.cyl(1.0, 1.0, 0.18, 24), mat([0, 0.52, 0]));
    ky.add('hull', G.rbox(2.4, 1.1, 2.6, 0.25), mat([0, 1.05, -0.4]));
    ky.add('accent', G.rbox(2.45, 0.25, 1.2, 0.08), mat([0, 1.6, -0.7]));
    ky.addMirrored('dark', G.rbox(0.45, 1.0, 1.6, 0.1), mat([1.3, 0.95, -0.4]));
    ky.addMirrored('plasma', G.box(0.05, 0.5, 1.0), mat([1.53, 0.95, -0.4]));
    const b = new THREE.Group();
    const kb2 = new Kit();
    kb2.add('dark', G.cyl(0.6, 0.7, 2.0, 20), mat([0, 0, 0.6], [Math.PI / 2, 0, 0]));
    kb2.add('plasma', G.cyl(0.62, 0.62, 0.3, 20, true), mat([0, 0, 0.6], [Math.PI / 2, 0, 0]));
    kb2.add('gun', G.cyl(0.3, 0.38, 3.4, 16), mat([0, 0, 3.2], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 4; i++) kb2.add('metal', G.torus(0.48, 0.09, 8, 24), mat([0, 0, 2.0 + i * 0.75]));
    for (let i = 0; i < 3; i++) kb2.add('plasma', G.torus(0.42, 0.04, 6, 24), mat([0, 0, 2.38 + i * 0.75]));
    kb2.add('dark', G.cyl(0.52, 0.34, 0.7, 20), mat([0, 0, 5.1], [Math.PI / 2, 0, 0]));
    kb2.add('plasma', G.cyl(0.24, 0.24, 0.04, 16), mat([0, 0, 5.47], [Math.PI / 2, 0, 0]));
    b.add(kb2.build(M));
    pitch.add(b);
    const mz = new THREE.Object3D(); mz.position.set(0, 0, 5.6); b.add(mz);
    muzzles.push(mz); barrels.push(b);
    kp.add('dark', G.rbox(1.5, 1.0, 1.4, 0.12), mat([0, 0, 0.1]));
    pitch.position.set(0, 1.1, 0.3);
  } else if (kind === 'flak') {
    // twin-barrel flak mount with top ammo drum and muzzle brakes
    kb.add('dark', G.cyl(1.0, 1.2, 0.4, 24), mat([0, 0.2, 0]));
    kb.add('metal', G.cyl(0.75, 0.75, 0.2, 24), mat([0, 0.48, 0]));
    ky.add('hull', G.rbox(2.0, 1.0, 1.8, 0.2), mat([0, 0.95, -0.2]));
    ky.add('accent', G.rbox(2.05, 0.22, 0.9, 0.06), mat([0, 1.4, -0.5]));
    ky.addMirrored('dark', G.rbox(0.35, 0.8, 1.4, 0.08), mat([1.15, 0.9, -0.2]));
    ky.add('dark', G.cyl(0.45, 0.45, 1.1, 18), mat([0, 1.75, -0.6], [0, 0, Math.PI / 2]));
    ky.add('metal', G.box(1.2, 0.1, 0.3), mat([0, 1.75, -0.6]));
    for (const x of [-0.42, 0.42]) {
      const b = new THREE.Group();
      const k2 = new Kit();
      k2.add('gun', G.cyl(0.22, 0.22, 0.5, 14), mat([0, 0, 0.1], [Math.PI / 2, 0, 0]));
      k2.add('gun', G.cyl(0.15, 0.17, 1.7, 14), mat([0, 0, 0.95], [Math.PI / 2, 0, 0]));
      k2.add('dark', G.rbox(0.42, 0.42, 0.55, 0.06), mat([0, 0, 1.95]));
      k2.add('metal', G.box(0.46, 0.08, 0.36), mat([0, 0, 1.95]));
      b.add(k2.build(M));
      b.position.set(x, 0, 0.4);
      pitch.add(b);
      const mz = new THREE.Object3D(); mz.position.set(0, 0, 2.3); b.add(mz);
      muzzles.push(mz); barrels.push(b);
    }
    kp.add('dark', G.rbox(1.3, 0.6, 0.9, 0.1), mat([0, 0, 0.1]));
    pitch.position.set(0, 0.95, 0.3);
  } else if (kind === 'beam') {
    // long-focus beam emitter with crystal lens and cooling fins
    kb.add('dark', G.cyl(1.1, 1.3, 0.4, 24), mat([0, 0.2, 0]));
    kb.add('metal', G.cyl(0.85, 0.85, 0.18, 24), mat([0, 0.48, 0]));
    ky.add('hull', G.rbox(1.9, 1.1, 2.4, 0.25), mat([0, 1.0, -0.3]));
    ky.add('accent', G.rbox(1.95, 0.22, 1.2, 0.06), mat([0, 1.5, -0.6]));
    for (let i = 0; i < 6; i++) ky.addMirrored('metal', G.box(0.55, 0.05, 1.6), mat([1.22, 0.62 + i * 0.14, -0.4]));
    const b = new THREE.Group();
    const k2 = new Kit();
    k2.add('dark', G.cyl(0.45, 0.5, 1.4, 20), mat([0, 0, 0.5], [Math.PI / 2, 0, 0]));
    k2.add('gun', G.cyl(0.18, 0.24, 3.6, 16), mat([0, 0, 2.6], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 3; i++) k2.add('metal', G.torus(0.3, 0.05, 8, 20), mat([0, 0, 1.6 + i * 0.9]));
    k2.add('coil', G.cyl(0.2, 0.2, 0.5, 14, true), mat([0, 0, 1.15], [Math.PI / 2, 0, 0]));
    k2.add('dark', G.cyl(0.5, 0.26, 0.6, 20), mat([0, 0, 4.5], [Math.PI / 2, 0, 0]));
    k2.add('glass', G.sphere(0.38, 20, 12), mat([0, 0, 4.82], [0, 0, 0], [1, 1, 0.45]));
    k2.add('coil', G.cyl(0.14, 0.14, 0.04, 14), mat([0, 0, 4.99], [Math.PI / 2, 0, 0]));
    b.add(k2.build(M));
    pitch.add(b);
    const mz = new THREE.Object3D(); mz.position.set(0, 0, 5.1); b.add(mz);
    muzzles.push(mz); barrels.push(b);
    kp.add('dark', G.rbox(1.2, 0.8, 1.2, 0.1), mat([0, 0, 0]));
    pitch.position.set(0, 1.05, 0.3);
  } else if (kind === 'gauss') {
    // boxy coilgun accelerator with amber charge rings
    kb.add('dark', G.cyl(1.3, 1.5, 0.45, 24), mat([0, 0.22, 0]));
    ky.add('hull', G.rbox(2.6, 1.3, 3.0, 0.3), mat([0, 1.05, -0.6]));
    ky.add('accent', G.rbox(2.65, 0.3, 1.4, 0.08), mat([0, 1.7, -0.9]));
    ky.addMirrored('dark', G.rbox(0.6, 1.1, 2.4, 0.12), mat([1.5, 0.95, -0.6]));
    ky.addMirrored('amber', G.box(0.04, 0.3, 1.8), mat([1.81, 1.1, -0.6]));
    const b = new THREE.Group();
    const k2 = new Kit();
    k2.add('dark', G.rbox(1.1, 1.1, 6.0, 0.12), mat([0, 0, 3.0]));
    for (let i = 0; i < 6; i++) {
      k2.add('metal', G.rbox(1.35, 1.35, 0.3, 0.08), mat([0, 0, 1.0 + i * 0.85]));
      k2.add('amber', G.box(1.37, 0.08, 0.12), mat([0, 0.5, 1.0 + i * 0.85]));
    }
    k2.add('gun', G.cyl(0.32, 0.32, 1.0, 16), mat([0, 0, 6.4], [Math.PI / 2, 0, 0]));
    k2.add('dark', G.rbox(0.9, 0.9, 0.4, 0.06), mat([0, 0, 6.9]));
    b.add(k2.build(M));
    pitch.add(b);
    const mz = new THREE.Object3D(); mz.position.set(0, 0, 7.2); b.add(mz);
    muzzles.push(mz); barrels.push(b);
    kp.add('dark', G.rbox(1.6, 1.1, 1.6, 0.12), mat([0, 0, 0.1]));
    pitch.position.set(0, 1.1, 0.3);
  } else if (kind === 'scatter') {
    // quad-barrel scatter cannon
    kb.add('dark', G.cyl(0.95, 1.15, 0.35, 24), mat([0, 0.17, 0]));
    kb.add('metal', G.cyl(0.7, 0.7, 0.2, 24), mat([0, 0.42, 0]));
    ky.add('hull', G.rbox(1.7, 0.9, 1.7, 0.18), mat([0, 0.85, -0.2]));
    ky.add('accent', G.rbox(1.75, 0.2, 0.8, 0.05), mat([0, 1.3, -0.4]));
    ky.addMirrored('dark', G.box(0.3, 0.6, 1.2), mat([0.98, 0.8, -0.2]));
    const b = new THREE.Group();
    const k2 = new Kit();
    k2.add('dark', G.rbox(1.0, 0.9, 1.2, 0.1), mat([0, 0, 0.4]));
    for (const [x, y] of [[-0.22, 0.2], [0.22, 0.2], [-0.22, -0.2], [0.22, -0.2]]) k2.add('gun', G.cyl(0.13, 0.13, 2.0, 12), mat([x, y, 1.8], [Math.PI / 2, 0, 0]));
    k2.add('metal', G.rbox(0.95, 0.85, 0.18, 0.04), mat([0, 0, 1.6]));
    k2.add('metal', G.rbox(0.95, 0.85, 0.18, 0.04), mat([0, 0, 2.55]));
    k2.add('amber', G.box(0.9, 0.05, 0.05), mat([0, 0.46, 1.0]));
    b.add(k2.build(M));
    pitch.add(b);
    const mz = new THREE.Object3D(); mz.position.set(0, 0, 2.85); b.add(mz);
    muzzles.push(mz); barrels.push(b);
    kp.add('dark', G.rbox(1.1, 0.6, 0.8, 0.1), mat([0, 0, 0]));
    pitch.position.set(0, 0.88, 0.25);
  } else {
    // railgun: long twin-rail barrel with glowing magnetic coils
    kb.add('dark', G.cyl(1.3, 1.5, 0.45, 24), mat([0, 0.22, 0]));
    ky.add('hull', G.rbox(2.2, 1.0, 2.8, 0.22), mat([0, 0.95, -0.4]));
    ky.add('accent', G.rbox(2.3, 0.25, 1.6, 0.08), mat([0, 1.4, -0.7]));
    ky.add('dark', G.rbox(0.5, 0.9, 1.8, 0.1), mat([1.25, 0.9, -0.5]));
    ky.add('dark', G.rbox(0.5, 0.9, 1.8, 0.1), mat([-1.25, 0.9, -0.5]));
    const b = new THREE.Group();
    const kb2 = new Kit();
    kb2.add('gun', G.box(0.22, 0.12, 5.2), mat([0, 0.2, 2.6]));
    kb2.add('gun', G.box(0.22, 0.12, 5.2), mat([0, -0.2, 2.6]));
    kb2.add('dark', G.box(0.5, 0.14, 4.8), mat([0, 0, 2.3]));
    for (let i = 0; i < 7; i++) {
      kb2.add('metal', G.rbox(0.62, 0.7, 0.22, 0.05), mat([0, 0, 0.8 + i * 0.6]));
      kb2.add('coil', G.box(0.64, 0.08, 0.1), mat([0, 0.36, 0.8 + i * 0.6]));
    }
    kb2.add('dark', G.rbox(0.8, 0.8, 0.5, 0.08), mat([0, 0, 5.2]));
    b.add(kb2.build(M));
    pitch.add(b);
    const mz = new THREE.Object3D(); mz.position.set(0, 0, 5.6); b.add(mz);
    muzzles.push(mz); barrels.push(b);
    kp.add('dark', G.rbox(1.4, 0.9, 1.4, 0.12), mat([0, 0, 0.1]));
    pitch.position.set(0, 1.0, 0.4);
  }
  root.add(kb.build(M));
  yaw.add(ky.build(M));
  pitch.add(kp.build(M));
  root.scale.setScalar(scale);
  const recoilDist = { laser: 0.35, rail: 0.8, auto: 0.06, plasma: 0.55, flak: 0.25, beam: 0.15, gauss: 0.9, scatter: 0.4 }[kind];
  return { root, yaw, pitch, muzzles, barrels, kind, recoil: barrels.map(() => 0), baseZ: barrels.map((b) => b.position.z), recoilDist, rotor: kind === 'auto' ? barrels[0] : null, spin: 0, next: 0 };
}

function shipBase(name, M) {
  return { name, group: new THREE.Group(), turrets: [], guns: [], launchers: [], engines: [], navLights: [], M, radius: 10, hitSpheres: [], hardpoints: [], utilMounts: [], cockpit: new THREE.Vector3(0, 2, 6) };
}

function scatterGreebles(k, r, n, box, keys = ['dark', 'metal', 'gun']) {
  for (let i = 0; i < n; i++) {
    const x = box.x0 + r() * (box.x1 - box.x0), z = box.z0 + r() * (box.z1 - box.z0);
    const w = 0.15 + r() * box.s, h = 0.08 + r() * box.s * 0.5, d = 0.2 + r() * box.s * 1.5;
    const key = keys[Math.floor(r() * keys.length)];
    if (r() < 0.2) k.add(key, G.cyl(w * 0.5, w * 0.5, d, 10), mat([x, box.y + w * 0.4, z], [Math.PI / 2, 0, 0]));
    else k.add(key, G.box(w, h, d), mat([x, box.y + h / 2, z]));
  }
}

// ---------------------------------------------------------------- surface greebles
// Detail parts are dropped onto the outer hull by casting axis-aligned rays against the built model,
// so they sit on whatever surface a ray from outside reaches first. Results are cached per hull design.
const GREEBLE_SOLID = new Set(['hull', 'accent', 'dark', 'metal', 'gun']);
const GREEBLE_BLOCK = new Set(['glass', 'nozzle', 'engine', 'light', 'coil', 'plasma', 'amber', 'window']);
const GRID = 48;
const greebleCache = new Map();

function surfaceGrid(group) {
  const T = [], blocked = [];
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  group.traverse((o) => {
    if (!o.isMesh || !(GREEBLE_SOLID.has(o.name) || GREEBLE_BLOCK.has(o.name))) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const n = idx ? idx.count : pos.count, block = GREEBLE_BLOCK.has(o.name);
    for (let i = 0; i < n; i += 3) {
      for (let j = 0; j < 3; j++) {
        const vi = idx ? idx.getX(i + j) : i + j;
        for (let a = 0; a < 3; a++) {
          const c = pos.getComponent(vi, a);
          T.push(c);
          if (c < min[a]) min[a] = c;
          if (c > max[a]) max[a] = c;
        }
      }
      blocked.push(block);
    }
  });
  const count = blocked.length;
  if (!count) return null;
  const grids = [0, 1, 2].map((a) => {
    const u = (a + 1) % 3, v = (a + 2) % 3;
    const su = GRID / (max[u] - min[u] + 1e-6), sv = GRID / (max[v] - min[v] + 1e-6);
    const cells = Array.from({ length: GRID * GRID }, () => []);
    for (let t = 0; t < count; t++) {
      const o = t * 9;
      const u0 = Math.min(T[o + u], T[o + 3 + u], T[o + 6 + u]), u1 = Math.max(T[o + u], T[o + 3 + u], T[o + 6 + u]);
      const v0 = Math.min(T[o + v], T[o + 3 + v], T[o + 6 + v]), v1 = Math.max(T[o + v], T[o + 3 + v], T[o + 6 + v]);
      const cu0 = Math.max(0, Math.floor((u0 - min[u]) * su)), cu1 = Math.min(GRID - 1, Math.floor((u1 - min[u]) * su));
      const cv0 = Math.max(0, Math.floor((v0 - min[v]) * sv)), cv1 = Math.min(GRID - 1, Math.floor((v1 - min[v]) * sv));
      for (let cu = cu0; cu <= cu1; cu++) for (let cv = cv0; cv <= cv1; cv++) cells[cu * GRID + cv].push(t);
    }
    return { u, v, su, sv, cells };
  });
  // ray travelling along -s*axis a through plane point (pu, pv); returns the first outward-facing solid hit
  const cast = (a, s, pu, pv) => {
    const g = grids[a];
    const cu = Math.floor((pu - min[g.u]) * g.su), cv = Math.floor((pv - min[g.v]) * g.sv);
    if (cu < 0 || cv < 0 || cu >= GRID || cv >= GRID) return null;
    let best = -Infinity, bt = -1;
    for (const t of g.cells[cu * GRID + cv]) {
      const o = t * 9;
      const ax = T[o + g.u], ay = T[o + g.v], bx = T[o + 3 + g.u], by = T[o + 3 + g.v], cx = T[o + 6 + g.u], cy = T[o + 6 + g.v];
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(d) < 1e-12) continue;
      const l1 = ((by - cy) * (pu - cx) + (cx - bx) * (pv - cy)) / d;
      const l2 = ((cy - ay) * (pu - cx) + (ax - cx) * (pv - cy)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      const h = (l1 * T[o + a] + l2 * T[o + 3 + a] + l3 * T[o + 6 + a]) * s;
      if (h > best) { best = h; bt = t; }
    }
    if (bt < 0 || blocked[bt]) return null;
    const o = bt * 9;
    const e1 = new THREE.Vector3(T[o + 3] - T[o], T[o + 4] - T[o + 1], T[o + 5] - T[o + 2]);
    const e2 = new THREE.Vector3(T[o + 6] - T[o], T[o + 7] - T[o + 1], T[o + 8] - T[o + 2]);
    const n = e1.cross(e2).normalize();
    if (n.getComponent(a) * s < 0.55) return null;
    const p = new THREE.Vector3();
    p.setComponent(a, best * s); p.setComponent(g.u, pu); p.setComponent(g.v, pv);
    return { p, n, h: best };
  };
  return { cast, min, max, count };
}

function greebleFrame(p, n) {
  const tz = new THREE.Vector3(0, 0, 1).addScaledVector(n, -n.z);
  if (tz.lengthSq() < 0.12) tz.set(1, 0, 0).addScaledVector(n, -n.x);
  tz.normalize();
  const tx = new THREE.Vector3().crossVectors(n, tz);
  return new THREE.Matrix4().makeBasis(tx, n, tz).setPosition(p);
}

function makeGreebles(ship, S) {
  const R = ship.radius;
  const r = rng(Math.round(R * 97) + S.count);
  const base = THREE.MathUtils.clamp(R * 0.013, 0.12, 1.8);
  const tries = Math.round(THREE.MathUtils.clamp(R * 9, 90, 1100));
  const big = R > 30;
  const excl = [
    ...ship.hardpoints.map((h) => [new THREE.Vector3().fromArray(h.p), 2.6 * h.s + base]),
    ...ship.utilMounts.map((h) => [new THREE.Vector3().fromArray(h.p), 2.2 * h.s + base]),
    ...ship.launchers.map((o) => [o.position.clone(), base * 4]),
    ...ship.engines.map((e) => [e.plume.position.clone(), e.radius * 1.8]),
  ];
  const k = new Kit();
  const { min, max } = S;
  for (let i = 0; i < tries; i++) {
    const q = r();
    const [a, s] = q < 0.45 ? [1, 1] : q < 0.8 ? [0, 1] : [1, -1];
    const u = (a + 1) % 3, v = (a + 2) % 3;
    const pu = min[u] + r() * (max[u] - min[u]);
    // sample the port half only; everything is mirrored to starboard
    const pv = a === 1 ? r() * max[v] : min[v] + r() * (max[v] - min[v]);
    const hit = S.cast(a, s, pu, pv);
    if (!hit || excl.some(([c, d]) => c.distanceTo(hit.p) < d)) continue;
    const t = r();
    const kind = t < 0.32 ? 'plate' : t < 0.46 ? 'vent' : t < 0.6 ? 'pipe' : t < 0.68 ? 'dome' : t < 0.76 ? (a === 1 && s === 1 ? 'mast' : 'cluster') : t < 0.88 ? 'cluster' : big ? 'windows' : 'plate';
    const w = base * (1 + r() * 3), d = kind === 'pipe' ? base * (4 + r() * 8) : base * (1.5 + r() * 5);
    const e = Math.max(w, d) * 0.5;
    let flat = true;
    for (const [du, dv] of [[e, e], [-e, e], [e, -e], [-e, -e]]) {
      const c = S.cast(a, s, pu + du, pv + dv);
      if (!c || Math.abs(c.h - hit.h) > base * 0.5 + e * 0.25) { flat = false; break; }
    }
    if (!flat) continue;
    const F = greebleFrame(hit.p.addScaledVector(hit.n, -base * 0.03), hit.n);
    const add = (key, geo, local) => {
      const m = F.clone().multiply(local);
      if (Math.abs(hit.p.x) > e + base) k.addMirrored(key, geo, m); else k.add(key, geo, m);
    };
    if (kind === 'plate') {
      const h = base * (0.15 + r() * 0.35);
      add(r() < 0.6 ? 'dark' : 'hull', G.box(w, h, d), mat([0, h / 2, 0]));
      if (r() < 0.4) add('gun', G.box(w * 0.6, h * 0.6, d * 0.4), mat([0, h + h * 0.3, (r() - 0.5) * d * 0.4]));
    } else if (kind === 'vent') {
      const h = base * 0.4, n = 3 + Math.floor(r() * 4);
      add('dark', G.box(w, h, d), mat([0, h / 2, 0]));
      for (let j = 0; j < n; j++) add('gun', G.box(w * 0.86, base * 0.12, base * 0.16), mat([0, h + base * 0.06, -d * 0.4 + (j + 0.5) * (d * 0.8 / n)]));
    } else if (kind === 'pipe') {
      const pr = base * (0.12 + r() * 0.14);
      for (const x of r() < 0.5 ? [0] : [-pr * 1.5, pr * 1.5]) add('metal', G.cyl(pr, pr, d, 8), mat([x, pr, 0], [Math.PI / 2, 0, 0]));
      for (const z of [-d * 0.36, d * 0.36]) add('dark', G.box(pr * 6, pr * 2.8, base * 0.3), mat([0, pr * 1.4, z]));
    } else if (kind === 'dome') {
      const dr = base * (0.4 + r() * 0.6);
      add('dark', G.cyl(dr * 1.15, dr * 1.25, base * 0.2, 14), mat([0, base * 0.1, 0]));
      add(r() < 0.5 ? 'hull' : 'metal', G.sphere(dr, 14, 8), mat([0, base * 0.2, 0], [0, 0, 0], [1, 0.55, 1]));
    } else if (kind === 'mast') {
      const mh = base * (3 + r() * 5);
      add('dark', G.box(base * 0.6, base * 0.3, base * 0.6), mat([0, base * 0.15, 0]));
      add('metal', G.cyl(base * 0.05, base * 0.08, mh, 6), mat([0, mh / 2, 0]));
      if (r() < 0.5) add('metal', G.box(base * 1.2, base * 0.05, base * 0.05), mat([0, mh * 0.8, 0]));
    } else if (kind === 'cluster') {
      const n = 2 + Math.floor(r() * 3);
      for (let j = 0; j < n; j++) {
        const bw = base * (0.3 + r() * 0.8), bh = base * (0.2 + r() * 0.7), bd = base * (0.3 + r() * 1.2);
        add(r() < 0.5 ? 'gun' : 'dark', G.box(bw, bh, bd), mat([(r() - 0.5) * w * 0.6, bh / 2, (r() - 0.5) * d * 0.6]));
      }
      if (r() < 0.25) add('amber', G.box(base * 0.25, base * 0.12, base * 0.25), mat([0, base * 0.9, 0]));
    } else {
      const n = 3 + Math.floor(r() * 6), step = base * 0.9;
      add('dark', G.box(base * 0.6, base * 0.08, step * n + base * 0.3), mat([0, base * 0.04, 0]));
      for (let j = 0; j < n; j++) add('window', G.box(base * 0.4, base * 0.1, base * 0.5), mat([0, base * 0.09, (j - (n - 1) / 2) * step]));
    }
  }
  if (!Object.keys(k.parts).length) return [];
  return k.build(ship.M, { uvTile: { hull: 4, accent: 4, dark: 4 } }).children.map((m) => {
    m.geometry.userData.shared = true;
    return { key: m.name, geo: m.geometry };
  });
}

function addGreebles(ship) {
  const S = surfaceGrid(ship.group);
  if (!S) return ship;
  const id = `${ship.name}|${S.count}|${ship.radius}`;
  if (!greebleCache.has(id)) greebleCache.set(id, makeGreebles(ship, S));
  const g = new THREE.Group();
  for (const { key, geo } of greebleCache.get(id)) {
    const m = new THREE.Mesh(geo, ship.M[key]);
    m.name = key;
    m.castShadow = m.receiveShadow = !ship.M[key].userData.noShadow;
    g.add(m);
  }
  ship.group.add(g);
  return ship;
}

// ---------------------------------------------------------------- player frigate (~36 m)
export function buildFrigate(env, liv = 'player') {
  const M = livery(liv, env);
  const ship = shipBase('Valkyrie', M);
  const k = new Kit();
  const r = rng(31);
  const rotZtoX = [0, -Math.PI / 2, 0];

  // main fuselage, side profile extruded across the beam
  const prof = [[-14, -1.7], [-14, 2.1], [-9, 2.7], [1, 2.6], [7, 1.9], [12.5, 0.9], [17.5, 0.1], [17.2, -0.4], [12, -1.2], [5, -1.8], [-6, -2.0]];
  k.add('hull', G.extrude(prof, 3.6, 0.35, 2), mat([0, 0, 0], rotZtoX));
  // lower keel, narrower
  k.add('dark', G.extrude([[-13, -1.6], [-13, -0.2], [9, -0.2], [12, -1.1], [6, -2.6], [-8, -2.7]], 2.4, 0.2), mat([0, 0, 0], rotZtoX));
  // accent stripe on flanks
  k.addMirrored('accent', G.extrude([[-12, 0.6], [-12, 1.25], [8, 1.25], [12.5, 0.4], [12, 0.15], [-12, 0.15]], 0.12, 0.03), mat([2.17, 0, 0], rotZtoX));
  k.addMirrored('dark', G.extrude([[-12, -0.25], [-12, 0.05], [12, 0.05], [12, -0.25]], 0.1, 0.02), mat([2.18, 0, 0], rotZtoX));
  // dorsal deck / spine
  k.add('hull', G.rbox(3.0, 1.0, 15, 0.3), mat([0, 3.0, -3.5]));
  k.add('dark', G.rbox(1.4, 0.5, 9, 0.15), mat([0, 3.6, -5.5]));
  // cockpit canopy with frame
  k.add('glass', G.sphere(1, 32, 16), mat([0, 2.35, 7.6], [0, 0, 0], [1.25, 0.85, 3.0]));
  for (const z of [6.2, 7.6, 9.0]) k.add('dark', G.torus(1, 0.05, 6, 40), mat([0, 2.35, z], [0, 0, 0], [1.27, 0.87 * 1, 1]));
  k.add('dark', G.box(0.12, 0.12, 5.8), mat([0, 3.18, 7.6]));
  k.add('hull', G.rbox(2.4, 0.5, 2.2, 0.15), mat([0, 2.5, 4.3]));
  // chin sensor turret + nose probes
  k.add('dark', G.sphere(0.55, 20, 12), mat([0, -1.6, 12.6]));
  k.add('glass', G.sphere(0.32, 16, 10), mat([0, -1.75, 12.95]));
  k.add('metal', G.cyl(0.04, 0.06, 2.2, 6), mat([0.3, 0.1, 18.4], [Math.PI / 2, 0, 0]));
  k.add('metal', G.cyl(0.04, 0.06, 1.6, 6), mat([-0.3, -0.1, 18.1], [Math.PI / 2, 0, 0]));

  // nacelles (lathed) + pylons
  const nac = [[0.0, 8.5], [0.5, 8.2], [1.1, 7.0], [1.45, 4.5], [1.55, 0], [1.55, -6.5], [1.75, -7.2], [1.75, -9.4], [1.45, -9.8], [1.1, -9.8]];
  k.addMirrored('hull', G.lathe(nac, 32), mat([5.6, -0.2, -2], [Math.PI / 2, 0, 0]));
  k.addMirrored('accent', G.cyl(1.6, 1.6, 0.9, 32, true), mat([5.6, -0.2, 2.5], [Math.PI / 2, 0, 0]));
  k.addMirrored('dark', G.cyl(1.82, 1.82, 0.5, 32), mat([5.6, -0.2, -8.2], [Math.PI / 2, 0, 0]));
  k.addMirrored('dark', G.cyl(1.82, 1.82, 0.3, 32), mat([5.6, -0.2, -6.3], [Math.PI / 2, 0, 0]));
  k.addMirrored('dark', G.cyl(0.5, 0.4, 1.2, 16), mat([5.6, -0.2, 6.6], [Math.PI / 2, 0, 0]));
  k.addMirrored('hull', G.rbox(3.8, 0.7, 9.5, 0.2), mat([3.8, -0.5, -3.5]));
  k.addMirrored('dark', G.rbox(3.6, 0.3, 3, 0.1), mat([3.8, -0.05, -6.5]));
  // nacelle intake grilles
  for (let i = 0; i < 5; i++) k.addMirrored('gun', G.box(0.06, 0.9, 0.5), mat([5.6 + 1.5, -0.2, 3.5 - i * 0.35 - 1.0]));

  // wings: swept, slight anhedral, with flap lines and hardpoint pods
  const wing = [[0, 1.5], [7.5, -3.5], [8.2, -6.8], [0, -8.5]];
  k.addMirrored('hull', G.extrude(wing, 0.4, 0.12), mat([6.8, -0.9, -2.0], [Math.PI / 2, 0, -0.08]));
  k.addMirrored('accent', G.extrude([[6.6, -3.2], [7.6, -3.6], [8.25, -6.7], [7.2, -6.95]], 0.46, 0.04), mat([6.8, -0.9, -2.0], [Math.PI / 2, 0, -0.08]));
  k.addMirrored('dark', G.box(6.5, 0.48, 0.1), mat([10.1, -1.15, -9.0], [0, -0.16, -0.08]));
  // missile pods at wingtip
  k.addMirrored('dark', G.rbox(1.25, 1.1, 5.0, 0.15), mat([15.4, -1.45, -6.0]));
  k.addMirrored('hull', G.rbox(1.3, 0.3, 4.2, 0.08), mat([15.4, -0.85, -6.2]));
  for (const [dx, dy] of [[-0.28, -0.25], [0.28, -0.25], [-0.28, 0.25], [0.28, 0.25]]) {
    k.addMirrored('gun', G.cyl(0.2, 0.2, 0.3, 12), mat([15.4 + dx, -1.45 + dy, -3.45], [Math.PI / 2, 0, 0]));
  }
  // canted tail fins
  k.addMirrored('hull', G.extrude([[0, 0], [-4.2, 0], [-5.6, 3.8], [-4.4, 3.9], [-1.0, 0.9]], 0.3, 0.08), mat([1.5, 3.3, -8.5], [0, 0, -0.32]).multiply(mat([0, 0, 0], [0, -Math.PI / 2, 0])));
  k.addMirrored('accent', G.extrude([[-4.6, 3.0], [-5.6, 3.8], [-4.4, 3.9], [-3.9, 3.0]], 0.34, 0.03), mat([1.5, 3.3, -8.5], [0, 0, -0.32]).multiply(mat([0, 0, 0], [0, -Math.PI / 2, 0])));

  // engine block & bells
  k.add('dark', G.rbox(5.6, 4.2, 3.4, 0.4), mat([0, 0.3, -14.6]));
  k.add('hull', G.rbox(5.0, 0.6, 3.6, 0.15), mat([0, 2.5, -14.4]));
  const bell = [[1.0, 0.4], [1.15, 0], [1.35, -0.6], [1.6, -1.5], [1.7, -1.9]];
  for (const x of [-1.4, 1.4]) {
    k.add('nozzle', G.lathe(bell, 32), mat([x, 0.3, -16.2], [Math.PI / 2, 0, 0]));
    k.add('dark', G.torus(1.02, 0.12, 8, 32), mat([x, 0.3, -16.0]));
    k.add('engine', G.cyl(1.0, 1.0, 0.05, 24), mat([x, 0.3, -16.3], [Math.PI / 2, 0, 0]));
  }
  for (const x of [-5.6, 5.6]) {
    k.add('nozzle', G.lathe([[1.0, 0.2], [1.15, -0.4], [1.35, -1.1]], 24), mat([x, -0.2, -11.8], [Math.PI / 2, 0, 0]));
    k.add('engine', G.cyl(0.95, 0.95, 0.05, 24), mat([x, -0.2, -11.85], [Math.PI / 2, 0, 0]));
  }
  // radiator fins on the deck behind the turret
  for (let i = 0; i < 9; i++) k.add('metal', G.box(2.4, 0.9, 0.08), mat([0, 3.85, -9.0 - i * 0.32]));
  // pipes along flanks
  for (const y of [-0.8, -1.15]) k.addMirrored('metal', G.cyl(0.09, 0.09, 18, 8), mat([2.05, y, -2], [Math.PI / 2, 0, 0]));
  // RCS quads
  for (const [x, y, z] of [[2.0, 2.4, 10.5], [2.4, 2.2, -12.5], [2.2, -1.9, 10.0], [2.6, -1.6, -12.5]]) {
    k.addMirrored('dark', G.rbox(0.6, 0.5, 0.6, 0.08), mat([x, y, z]));
    k.addMirrored('gun', G.cyl(0.1, 0.14, 0.2, 8), mat([x + 0.35, y, z], [0, 0, Math.PI / 2]));
  }
  // antennas
  k.add('metal', G.cyl(0.03, 0.05, 2.6, 6), mat([0.8, 4.4, -12.0], [-0.25, 0, 0]));
  k.add('metal', G.cyl(0.03, 0.05, 1.8, 6), mat([-0.8, 4.1, -12.3], [-0.35, 0, 0]));
  k.add('dark', G.cyl(0.55, 0.05, 0.25, 16), mat([0, 3.95, 1.6 + 6.5]));
  // deck greebles
  scatterGreebles(k, r, 40, { x0: -1.3, x1: 1.3, z0: -10, z1: 3, y: 3.5, s: 0.5 });
  scatterGreebles(k, r, 30, { x0: -1.4, x1: 1.4, z0: -12, z1: 10, y: -2.85, s: 0.45 });
  for (let i = 0; i < 24; i++) {
    const z = -12 + r() * 20, y = -1.4 + r() * 3.4;
    k.addMirrored(r() < 0.5 ? 'dark' : 'gun', G.box(0.15 + r() * 0.2, 0.2 + r() * 0.5, 0.3 + r() * 1.2), mat([2.2, y, z]));
  }

  ship.group.add(k.build(M, { uvTile: { hull: 9, accent: 6, dark: 6 } }));

  ship.hardpoints = [{ p: [0, 3.5, 1.2], flip: 0, s: 1 }, { p: [0, 4.1, -5.6], flip: 0, s: 1 }, { p: [0, -2.7, -2.0], flip: 1, s: 0.9 }];
  ship.utilMounts = [{ p: [9.5, -0.55, -5.5], flip: 0, s: 0.55 }, { p: [-9.5, -0.55, -5.5], flip: 0, s: 0.55 }, { p: [0, -2.85, -10], flip: 1, s: 0.6 }];
  ship.cockpit.set(0, 2.75, 8.4);
  for (const x of [15.4, -15.4]) {
    for (const [dx, dy] of [[-0.28, -0.25], [0.28, 0.25]]) {
      const o = new THREE.Object3D(); o.position.set(x + dx, -1.45 + dy, -3.2); ship.group.add(o); ship.launchers.push(o);
    }
  }

  addEngine(ship, M, new THREE.Vector3(1.4, 0.3, -16.3), 1.0, 14);
  addEngine(ship, M, new THREE.Vector3(-1.4, 0.3, -16.3), 1.0, 14);
  addEngine(ship, M, new THREE.Vector3(5.6, -0.2, -12.0), 0.95, 10);
  addEngine(ship, M, new THREE.Vector3(-5.6, -0.2, -12.0), 0.95, 10);

  addLight(ship, new THREE.Vector3(16.1, -1.45, -6.0), 0xff2015, 1.6, 0);
  addLight(ship, new THREE.Vector3(-16.1, -1.45, -6.0), 0x15ff40, 1.6, 0);
  addLight(ship, new THREE.Vector3(0, 4.9, -12.5), 0xffffff, 2.4, 1.2, 0);
  addLight(ship, new THREE.Vector3(0, -2.95, -12.0), 0xff3030, 1.8, 0.9, 0.5);
  addLight(ship, new THREE.Vector3(3.7, 2.7, -13.6), 0xfff0d0, 0.9, 0);
  addLight(ship, new THREE.Vector3(-3.7, 2.7, -13.6), 0xfff0d0, 0.9, 0);

  ship.radius = 19;
  ship.hitSpheres = [[0, 0.5, 9, 3.5], [0, 0.5, 0, 4.2], [0, 0.5, -9, 4.2], [5.6, -0.2, -3, 2.5], [-5.6, -0.2, -3, 2.5], [12, -1.2, -5, 3], [-12, -1.2, -5, 3]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- pirate raider (~17 m)
export function buildRaider(env) {
  const M = livery('pirate', env);
  const ship = shipBase('Raider', M);
  const k = new Kit();
  const r = rng(57);
  const rotZtoX = [0, -Math.PI / 2, 0];
  k.add('hull', G.extrude([[-7, -1.0], [-7, 1.3], [-2, 1.6], [3, 1.2], [9, 0.2], [9.2, -0.2], [3, -0.9], [-4, -1.2]], 2.2, 0.25), mat([0, 0, 0], rotZtoX));
  k.add('glass', G.sphere(1, 24, 12), mat([0, 1.15, 3.2], [0, 0, 0], [0.7, 0.55, 2.0]));
  k.add('dark', G.rbox(1.0, 0.4, 3.0, 0.1), mat([0, 1.55, -1.5]));
  // side intakes
  k.addMirrored('dark', G.rbox(1.2, 1.4, 5.5, 0.25), mat([1.7, -0.1, -1.5]));
  k.addMirrored('gun', G.box(0.9, 1.0, 0.1), mat([1.7, -0.1, 1.3]));
  // forward swept blades
  k.addMirrored('hull', G.extrude([[0, -3], [6.5, 2.2], [7.2, 1.6], [1.2, -5.5]], 0.3, 0.08), mat([1.9, -0.2, -0.5], [Math.PI / 2, 0, 0.12]));
  k.addMirrored('accent', G.extrude([[4.8, 0.8], [6.5, 2.2], [7.2, 1.6], [5.4, 0.0]], 0.34, 0.03), mat([1.9, -0.2, -0.5], [Math.PI / 2, 0, 0.12]));
  // vertical blade
  k.add('accent', G.extrude([[0, 0], [-3.8, 0], [-5.4, 2.8], [-4.3, 2.8]], 0.25, 0.06), mat([0, 1.4, -1.2], [0, -Math.PI / 2, 0]));
  // wing guns (fixed)
  for (const x of [5.2, -5.2]) {
    k.add('dark', G.rbox(0.6, 0.6, 3.0, 0.1), mat([x * 1.0, -0.35, 1.5]));
    k.add('gun', G.cyl(0.11, 0.13, 2.6, 10), mat([x, -0.35, 3.8], [Math.PI / 2, 0, 0]));
    k.add('gun', G.cyl(0.18, 0.18, 0.4, 10), mat([x, -0.35, 5.0], [Math.PI / 2, 0, 0]));
    const g = new THREE.Object3D(); g.position.set(x, -0.35, 5.3); ship.group.add(g); ship.guns.push(g);
  }
  // engine
  k.add('dark', G.rbox(2.6, 2.0, 2.4, 0.3), mat([0, 0.1, -7.4]));
  k.add('nozzle', G.lathe([[0.85, 0.3], [0.95, 0], [1.15, -0.7], [1.25, -1.2]], 24), mat([0, 0.1, -8.6], [Math.PI / 2, 0, 0]));
  k.add('engine', G.cyl(0.85, 0.85, 0.05, 20), mat([0, 0.1, -8.75], [Math.PI / 2, 0, 0]));
  scatterGreebles(k, r, 18, { x0: -0.8, x1: 0.8, z0: -6, z1: 1, y: 1.4, s: 0.35 });
  for (let i = 0; i < 10; i++) k.addMirrored('gun', G.box(0.12, 0.3 + r() * 0.4, 0.3 + r() * 0.8), mat([1.15, -0.5 + r(), -6 + r() * 9]));
  ship.group.add(k.build(M, { uvTile: { hull: 7, accent: 5, dark: 5 } }));
  addEngine(ship, M, new THREE.Vector3(0, 0.1, -8.8), 0.85, 9);
  addLight(ship, new THREE.Vector3(9.1, 1.6, 0.6), 0xff2010, 1.2, 1.6, 0);
  addLight(ship, new THREE.Vector3(-9.1, 1.6, 0.6), 0xff2010, 1.2, 1.6, 0.5);
  addLight(ship, new THREE.Vector3(0, 4.2, -6.4), 0xff6020, 1.0, 0.9, 0.2);
  ship.radius = 10;
  ship.hitSpheres = [[0, 0, 4, 2.2], [0, 0, -2, 2.6], [0, 0, -7, 2.0], [4.5, -0.2, 0, 2.2], [-4.5, -0.2, 0, 2.2]];
  ship.hardpoints = [{ p: [0, 1.75, -3.4], flip: 0, s: 0.55 }, { p: [0, -1.25, -2.0], flip: 1, s: 0.55 }];
  ship.utilMounts = [{ p: [0, 1.75, 0.6], flip: 0, s: 0.32 }];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- pirate cruiser (~150 m)
export function buildCruiser(env, fitted = false) {
  const M = livery('cruiser', env);
  const ship = shipBase('Marauder', M);
  const k = new Kit();
  const r = rng(91);
  const rotZtoX = [0, -Math.PI / 2, 0];
  k.add('hull', G.extrude([[-70, -10], [-70, 12], [-30, 15], [30, 14], [60, 8], [80, 0], [78, -4], [50, -10], [-20, -14]], 22, 1.5), mat([0, 0, 0], rotZtoX));
  k.add('dark', G.extrude([[-66, -12], [-66, 0], [55, 0], [62, -6], [40, -17], [-40, -18]], 16, 1.0), mat([0, 0, 0], rotZtoX));
  // armour belts
  for (let i = 0; i < 7; i++) {
    const z = -55 + i * 17;
    k.addMirrored(i % 2 ? 'accent' : 'dark', G.rbox(3, 18, 14, 0.8), mat([11.5, 0, z]));
  }
  // superstructure / bridge tower
  k.add('hull', G.rbox(14, 14, 30, 1.5), mat([0, 20, -35]));
  k.add('dark', G.rbox(18, 6, 16, 1.0), mat([0, 30, -38]));
  k.add('glass', G.box(17.5, 1.6, 15), mat([0, 30.5, -37.5]));
  k.add('accent', G.rbox(10, 4, 10, 0.8), mat([0, 35, -40]));
  k.add('metal', G.cyl(0.4, 0.6, 22, 8), mat([3, 46, -42]));
  k.add('metal', G.cyl(0.3, 0.5, 15, 8), mat([-3, 43, -44]));
  k.add('dark', G.cyl(6, 0.6, 2, 24), mat([0, 39, -30], [0.5, 0, 0]));
  // side hangars / sponsons
  k.addMirrored('hull', G.rbox(12, 14, 60, 1.5), mat([19, -2, -15]));
  k.addMirrored('dark', G.box(13, 9, 2), mat([19, -2, 15.2]));
  k.addMirrored('light', G.box(10, 6, 0.4), mat([19, -2, 16.3]));
  // engine cluster
  k.add('dark', G.rbox(34, 26, 14, 2), mat([0, 0, -74]));
  for (const [x, y] of [[-8, 6], [8, 6], [-8, -6], [8, -6]]) {
    k.add('nozzle', G.lathe([[4.2, 1], [4.6, 0], [5.4, -3], [6.0, -5]], 32), mat([x, y, -81], [Math.PI / 2, 0, 0]));
    k.add('engine', G.cyl(4.2, 4.2, 0.2, 24), mat([x, y, -81.2], [Math.PI / 2, 0, 0]));
  }
  // radiator vanes
  for (let i = 0; i < 10; i++) k.addMirrored('metal', G.box(16, 0.4, 3), mat([20, 12 + 0, -50 - i * 3.6], [0, 0, 0.35]));
  // greebles everywhere
  scatterGreebles(k, r, 140, { x0: -9, x1: 9, z0: -65, z1: 50, y: 14.5, s: 3.5 });
  scatterGreebles(k, r, 80, { x0: -7, x1: 7, z0: -60, z1: 45, y: -19, s: 3 });
  for (let i = 0; i < 70; i++) k.addMirrored(r() < 0.5 ? 'dark' : 'gun', G.box(1 + r() * 1.5, 1 + r() * 4, 2 + r() * 8), mat([13.5, -8 + r() * 16, -65 + r() * 120]));
  ship.group.add(k.build(M, { uvTile: { hull: 22, accent: 14, dark: 14 } }));
  const mounts = [[0, 15, 20, 0], [0, 15, 42, 0], [0, -19, 10, 1], [12, 8, -55, 0], [-12, 8, -55, 0]];
  if (fitted) {
    ship.hardpoints = mounts.map(([x, y, z, flip]) => ({ p: [x, y, z], flip, s: 2.6 }));
    ship.utilMounts = [[5, 14.6, -10], [-5, 14.6, -10], [5, 14.6, -55], [-5, 14.6, -55], [0, -19.6, -30]].map(([x, y, z]) => ({ p: [x, y, z], flip: y < 0 ? 1 : 0, s: 1.8 }));
  }
  for (const [x, y, z, flip] of fitted ? [] : mounts) {
    const t = buildTurret(M, 'laser', 3.2);
    t.root.position.set(x, y, z);
    if (flip) t.root.rotation.z = Math.PI;
    ship.group.add(t.root); ship.turrets.push(t);
  }
  for (const x of [19, -19]) { const o = new THREE.Object3D(); o.position.set(x, 6, 10); ship.group.add(o); ship.launchers.push(o); }
  for (const [x, y] of [[-8, 6], [8, 6], [-8, -6], [8, -6]]) addEngine(ship, M, new THREE.Vector3(x, y, -81.3), 4.2, 45);
  addLight(ship, new THREE.Vector3(3, 57, -42), 0xff2010, 6, 1.0, 0);
  addLight(ship, new THREE.Vector3(26, -2, 10), 0xff2010, 4, 0);
  addLight(ship, new THREE.Vector3(-26, -2, 10), 0x20ff40, 4, 0);
  addLight(ship, new THREE.Vector3(0, -20, 60), 0xffffff, 5, 1.3, 0.4);
  ship.radius = 85;
  ship.hitSpheres = [[0, 0, 55, 12], [0, 0, 30, 17], [0, 0, 5, 19], [0, 0, -20, 19], [0, 0, -45, 19], [0, 0, -70, 18], [0, 22, -36, 12], [19, -2, -15, 10], [-19, -2, -15, 10]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Cutlass pirate gunboat (~20 m): welded scrap, asymmetric plating
export function buildCutlass(env, liv = 'cutlass') {
  const M = livery(liv, env);
  const ship = shipBase('Cutlass', M);
  const k = new Kit();
  const r = rng(203);
  const rotZtoX = [0, -Math.PI / 2, 0];
  k.add('hull', G.extrude([[-8, -1.2], [-8, 1.4], [-3, 1.9], [4, 1.3], [10, 0.1], [10, -0.4], [2, -1.3]], 2.6, 0.2), mat([0, 0, 0], rotZtoX));
  k.add('dark', G.extrude([[-7.5, -1.7], [-7.5, -0.6], [6, -0.6], [8.5, -1.0], [2, -1.9]], 3.4, 0.12), mat([0, 0, 0], rotZtoX));
  k.add('glass', G.sphere(1, 20, 12), mat([0, 1.6, 3.2], [0, 0, 0], [0.75, 0.5, 1.8]));
  k.add('dark', G.rbox(1.3, 0.5, 1.6, 0.1), mat([0, 1.95, 1.0]));
  // bolted scrap plate to port, exposed truss to starboard
  k.add('accent', G.rbox(0.4, 2.2, 7, 0.08), mat([1.55, 0.15, -0.8], [0, 0.04, 0.06]));
  for (let i = 0; i < 6; i++) k.add('metal', G.cyl(0.09, 0.09, 0.3, 6), mat([1.8, i % 2 ? 0.9 : -0.6, -3.8 + i * 1.2], [0, 0, Math.PI / 2]));
  for (let i = 0; i < 5; i++) k.add('dark', G.box(0.2, 0.2, 2.4), mat([-1.75, i % 2 ? 0.7 : -0.7, -5 + i * 1.5], [i % 2 ? 0.5 : -0.5, 0, 0]));
  k.add('dark', G.box(0.2, 1.6, 7.4), mat([-1.95, 0, -2]));
  // stubby wings with forward ram blades
  k.addMirrored('hull', G.extrude([[0, -2.6], [5.6, -1.2], [6.2, 1.0], [5.4, 1.4], [0, 1.9]], 0.35, 0.06), mat([1.3, -0.4, -2.8], [Math.PI / 2, 0, 0]));
  k.addMirrored('accent', G.extrude([[5.2, -1.4], [6.8, 3.4], [6.1, 3.4], [4.8, -0.6]], 0.42, 0.04), mat([1.3, -0.4, -2.8], [Math.PI / 2, 0, 0]));
  k.addMirrored('dark', G.extrude([[0, 0], [2.4, 0], [3.4, 1.8], [2.6, 1.9]], 0.25, 0.04), mat([0.9, 1.3, -6.2], [0, -Math.PI / 2, 0.5]));
  // underslung cannons
  for (const x of [4.2, -4.2]) {
    k.add('dark', G.rbox(0.8, 0.8, 3.6, 0.12), mat([x, -0.95, -0.4]));
    k.add('gun', G.cyl(0.14, 0.16, 3.2, 10), mat([x, -0.95, 2.8], [Math.PI / 2, 0, 0]));
    k.add('gun', G.cyl(0.24, 0.24, 0.5, 10), mat([x, -0.95, 4.4], [Math.PI / 2, 0, 0]));
    const g = new THREE.Object3D(); g.position.set(x, -0.95, 4.8); ship.group.add(g); ship.guns.push(g);
  }
  // twin engine pods of different vintage
  for (const [x, rr] of [[1.6, 0.8], [-1.6, 0.68]]) {
    k.add('dark', G.cyl(rr + 0.25, rr + 0.35, 3.4, 16), mat([x, 0.15, -8.4], [Math.PI / 2, 0, 0]));
    k.add('nozzle', G.lathe([[rr, 0.3], [rr + 0.1, 0], [rr + 0.28, -0.7], [rr + 0.36, -1.1]], 20), mat([x, 0.15, -10.1], [Math.PI / 2, 0, 0]));
    k.add('engine', G.cyl(rr, rr, 0.05, 18), mat([x, 0.15, -10.25], [Math.PI / 2, 0, 0]));
  }
  scatterGreebles(k, r, 22, { x0: -0.9, x1: 0.9, z0: -7, z1: 1, y: 1.6, s: 0.35 });
  for (let i = 0; i < 10; i++) k.add(r() < 0.5 ? 'gun' : 'metal', G.box(0.15, 0.25 + r() * 0.4, 0.3 + r() * 0.9), mat([r() < 0.5 ? 1.35 : -1.35, -0.8 + r() * 1.6, -6 + r() * 9]));
  ship.group.add(k.build(M, { uvTile: { hull: 7, accent: 5, dark: 5 } }));
  addEngine(ship, M, new THREE.Vector3(1.6, 0.15, -10.3), 0.8, 8);
  addEngine(ship, M, new THREE.Vector3(-1.6, 0.15, -10.3), 0.68, 7);
  addLight(ship, new THREE.Vector3(7.4, -0.4, 0.4), 0xff2010, 1.1, 1.4, 0);
  addLight(ship, new THREE.Vector3(-7.4, -0.4, 0.4), 0xff2010, 1.1, 1.4, 0.5);
  addLight(ship, new THREE.Vector3(0, 2.3, 0.6), 0xffa020, 0.7, 2.2, 0.2);
  ship.radius = 11;
  ship.cockpit.set(0, 2.2, 4);
  ship.hitSpheres = [[0, 0, 5, 2.0], [0, 0, 0, 2.6], [0, 0, -6, 2.4], [4.5, -0.4, -1.5, 2.2], [-4.5, -0.4, -1.5, 2.2]];
  ship.hardpoints = [{ p: [0, 2.2, -2.6], flip: 0, s: 0.6 }, { p: [0, -1.95, -1.8], flip: 1, s: 0.6 }];
  ship.utilMounts = [{ p: [0, 1.75, -5.6], flip: 0, s: 0.36 }, { p: [0, -1.95, -5.8], flip: 1, s: 0.36 }];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Reaver pirate assault frigate (~50 m): ram prow and spiked armour
export function buildReaver(env, liv = 'reaver') {
  const M = livery(liv, env);
  const ship = shipBase('Reaver', M);
  const k = new Kit();
  const r = rng(211);
  const rotZtoX = [0, -Math.PI / 2, 0];
  k.add('hull', G.extrude([[-22, -3.5], [-22, 4], [-8, 5.5], [10, 4.5], [20, 1.5], [21, -1.5], [8, -4.2], [-12, -4.8]], 8, 0.5), mat([0, 0, 0], rotZtoX));
  k.add('dark', G.extrude([[-21, -5.5], [-21, -2], [14, -2], [17, -3.5], [6, -6], [-14, -6.2]], 10, 0.3), mat([0, 0, 0], rotZtoX));
  // ram prow
  k.add('accent', G.cyl(0.3, 3.6, 11, 6), mat([0, -0.5, 26], [Math.PI / 2, 0, 0], [1, 1, 0.7]));
  k.add('dark', G.cyl(3.8, 4.2, 2, 6), mat([0, -0.5, 20.4], [Math.PI / 2, 0, 0], [1, 1, 0.7]));
  for (const a of [0.6, -0.6, Math.PI - 0.6, Math.PI + 0.6]) k.add('metal', G.cyl(0.05, 0.7, 6, 6), mat([Math.sin(a) * 3.4, -0.5 + Math.cos(a) * 2.4, 22], [Math.PI / 2 - 0.25, 0, -a]));
  // bridge hump
  k.add('hull', G.rbox(6, 3.5, 12, 0.8), mat([0, 6.4, -4]));
  k.add('glass', G.box(5.4, 0.9, 3), mat([0, 7.2, 1.6], [0.35, 0, 0]));
  k.add('dark', G.rbox(4, 1.5, 6, 0.3), mat([0, 8.6, -6]));
  k.add('metal', G.cyl(0.12, 0.2, 7, 6), mat([1.4, 11.5, -8]));
  k.add('metal', G.cyl(0.1, 0.16, 5, 6), mat([-1.2, 10.6, -9]));
  // spiked armour plates along the flanks
  for (let i = 0; i < 5; i++) {
    const z = -16 + i * 7.5;
    k.addMirrored(i % 2 ? 'accent' : 'dark', G.rbox(1.4, 6.5 - i * 0.3, 6, 0.3), mat([5.2, 0, z], [0, 0, 0.08]));
    k.addMirrored('metal', G.cyl(0.05, 0.55, 3.2, 6), mat([6.6, 1.5, z + 1], [0, 0, -Math.PI / 2 + 0.3]));
    k.addMirrored('metal', G.cyl(0.05, 0.45, 2.4, 6), mat([6.4, -2, z - 1], [0, 0, -Math.PI / 2 - 0.4]));
  }
  // missile racks
  k.addMirrored('dark', G.rbox(3, 2.2, 8, 0.3), mat([6.8, 3.8, -10]));
  for (let i = 0; i < 4; i++) k.addMirrored('gun', G.cyl(0.32, 0.32, 0.3, 10), mat([6.0 + (i % 2) * 1.4, 3.6 + Math.floor(i / 2) * 0.9, -5.9], [Math.PI / 2, 0, 0]));
  // engine block
  k.add('dark', G.rbox(14, 10, 6, 0.8), mat([0, 0, -24]));
  for (const [x, y] of [[-3.6, 2.3], [3.6, 2.3], [-3.6, -2.3], [3.6, -2.3]]) {
    k.add('nozzle', G.lathe([[1.7, 0.5], [1.85, 0], [2.2, -1.4], [2.45, -2.2]], 24), mat([x, y, -27.2], [Math.PI / 2, 0, 0]));
    k.add('engine', G.cyl(1.7, 1.7, 0.1, 20), mat([x, y, -27.3], [Math.PI / 2, 0, 0]));
  }
  for (let i = 0; i < 6; i++) k.addMirrored('metal', G.box(5, 0.2, 1.4), mat([9, 2, -14 - i * 1.6], [0, 0, 0.3]));
  // prow cannons
  for (const x of [2.6, -2.6]) {
    k.add('gun', G.cyl(0.3, 0.36, 6, 10), mat([x, -3.6, 19], [Math.PI / 2, 0, 0]));
    const g = new THREE.Object3D(); g.position.set(x, -3.6, 22.2); ship.group.add(g); ship.guns.push(g);
  }
  scatterGreebles(k, r, 70, { x0: -3.5, x1: 3.5, z0: -20, z1: 14, y: 4.8, s: 1.2 });
  scatterGreebles(k, r, 40, { x0: -4, x1: 4, z0: -20, z1: 12, y: -6.2, s: 1.0 });
  ship.group.add(k.build(M, { uvTile: { hull: 12, accent: 8, dark: 8 } }));
  for (const x of [7.4, -7.4]) { const o = new THREE.Object3D(); o.position.set(x, 4, -5.5); ship.group.add(o); ship.launchers.push(o); }
  for (const [x, y] of [[-3.6, 2.3], [3.6, 2.3], [-3.6, -2.3], [3.6, -2.3]]) addEngine(ship, M, new THREE.Vector3(x, y, -27.4), 1.7, 18);
  addLight(ship, new THREE.Vector3(0, 14.6, -8), 0xff2010, 2.4, 1.0, 0);
  addLight(ship, new THREE.Vector3(9.6, 0, -2), 0xff2010, 2, 1.3, 0.3);
  addLight(ship, new THREE.Vector3(-9.6, 0, -2), 0xff2010, 2, 1.3, 0.8);
  ship.radius = 30;
  ship.cockpit.set(0, 8, 2);
  ship.hitSpheres = [[0, -0.5, 24, 3.5], [0, 0, 14, 5.5], [0, 0, 3, 6.5], [0, 0, -8, 7], [0, 0, -19, 7], [0, 6, -4, 4]];
  ship.hardpoints = [{ p: [0, 5.8, 9], flip: 0, s: 1.1 }, { p: [0, 8.6, -10.5], flip: 0, s: 1.0 }, { p: [0, -6.4, 2], flip: 1, s: 1.0 }, { p: [0, -6.4, -12], flip: 1, s: 1.0 }];
  ship.utilMounts = [{ p: [2.6, 5.2, -15], flip: 0, s: 0.75 }, { p: [-2.6, 5.2, -15], flip: 0, s: 0.75 }, { p: [0, 5.6, 16], flip: 0, s: 0.6 }];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Ravager clan warlord battleship (~190 m): forked prow, salvaged plating
export function buildRavager(env, liv = 'ravager') {
  const M = livery(liv, env);
  const ship = shipBase('Ravager', M);
  const k = new Kit();
  const r = rng(223);
  const rotZtoX = [0, -Math.PI / 2, 0];
  k.add('hull', G.extrude([[-80, -12], [-80, 14], [-40, 18], [30, 16], [60, 10], [66, -6], [30, -16], [-50, -18]], 34, 2), mat([0, 0, 0], rotZtoX));
  k.add('dark', G.extrude([[-78, -20], [-78, -8], [50, -8], [58, -14], [20, -24], [-50, -25]], 26, 1.2), mat([0, 0, 0], rotZtoX));
  // forked prow: two armoured prongs with siege cannons
  for (const sx of [1, -1]) {
    k.add('hull', G.extrude([[0, -6], [0, 8], [40, 4], [48, 0], [44, -5]], 9, 1), mat([sx * 11, 0, 58], rotZtoX));
    k.add('accent', G.rbox(10, 3, 30, 1), mat([sx * 11, 8, 72]));
    k.add('gun', G.cyl(1.4, 1.8, 26, 12), mat([sx * 11, -2, 104], [Math.PI / 2, 0, 0]));
    k.add('dark', G.cyl(2.6, 2.6, 6, 12), mat([sx * 11, -2, 92], [Math.PI / 2, 0, 0]));
    const g = new THREE.Object3D(); g.position.set(sx * 11, -2, 118); ship.group.add(g); ship.guns.push(g);
    for (let i = 0; i < 4; i++) k.add('metal', G.cyl(0.2, 2.2, 12, 6), mat([sx * 17.5, 2 - i * 2.5, 64 + i * 8], [0, 0, -sx * (Math.PI / 2 - 0.4)]));
  }
  // command tower offset to port, salvaged from a freighter
  k.add('hull', G.rbox(20, 30, 36, 2), mat([-9, 30, -38]));
  k.add('dark', G.rbox(26, 8, 22, 1.5), mat([-9, 48, -34]));
  k.add('glass', G.box(25.5, 2.4, 21), mat([-9, 49, -33.5]));
  k.add('accent', G.rbox(12, 6, 12, 1), mat([-9, 55, -40]));
  for (const [x, h] of [[-5, 40], [-13, 28], [-9, 22]]) k.add('metal', G.cyl(0.5, 0.9, h, 8), mat([x, 58 + h / 2, -44 + x * 0.3]));
  k.add('dark', G.cyl(9, 0.8, 3, 24), mat([6, 52, -30], [0.5, 0, -0.4]));
  // welded-on hull chunks and armour slabs
  for (let i = 0; i < 16; i++) {
    const z = -70 + r() * 120, sx = r() < 0.5 ? 1 : -1;
    const w = 6 + r() * 8, h = 10 + r() * 16, d = 12 + r() * 26;
    k.add(r() < 0.35 ? 'accent' : r() < 0.5 ? 'hull' : 'dark', G.rbox(w, h, d, 1), mat([sx * (17 + w / 2 - 2), -6 + r() * 14, z], [(r() - 0.5) * 0.12, (r() - 0.5) * 0.1, (r() - 0.5) * 0.15]));
  }
  // spikes along the spine and flanks
  for (let i = 0; i < 12; i++) {
    const z = -70 + i * 11;
    k.add('metal', G.cyl(0.3, 2.4, 10 + (i % 3) * 4, 6), mat([0, 21 + (i % 3) * 2, z], [-0.35, 0, 0]));
    k.addMirrored('metal', G.cyl(0.3, 2.0, 9, 6), mat([30, 6 - (i % 2) * 8, z], [0, 0, -Math.PI / 2 + 0.2]));
  }
  // engine wall: six mismatched drives
  k.add('dark', G.rbox(50, 34, 16, 2), mat([0, 0, -88]));
  const eng = [[-15, 8, 5.5], [0, 8, 6.5], [15, 8, 5.5], [-15, -8, 5], [0, -8, 6], [15, -8, 5]];
  for (const [x, y, rr] of eng) {
    k.add('nozzle', G.lathe([[rr, 1.2], [rr * 1.08, 0], [rr * 1.3, -3.5], [rr * 1.42, -6]], 32), mat([x, y, -96], [Math.PI / 2, 0, 0]));
    k.add('engine', G.cyl(rr, rr, 0.2, 24), mat([x, y, -96.2], [Math.PI / 2, 0, 0]));
  }
  for (let i = 0; i < 12; i++) k.addMirrored('metal', G.box(22, 0.6, 4), mat([30, 14, -56 - i * 2.4], [0, 0, 0.35]));
  scatterGreebles(k, r, 160, { x0: -14, x1: 14, z0: -78, z1: 55, y: 17, s: 4 });
  scatterGreebles(k, r, 90, { x0: -11, x1: 11, z0: -76, z1: 48, y: -25, s: 3.5 });
  ship.group.add(k.build(M, { uvTile: { hull: 26, accent: 16, dark: 16 } }));
  for (const [x, y, z] of [[24, 10, 20], [-24, 10, 20], [24, 10, -20], [-24, 10, -20]]) { const o = new THREE.Object3D(); o.position.set(x, y, z); ship.group.add(o); ship.launchers.push(o); }
  for (const [x, y, rr] of eng) addEngine(ship, M, new THREE.Vector3(x, y, -96.4), rr, rr * 11);
  addLight(ship, new THREE.Vector3(-5, 98, -45), 0xff2010, 8, 1.0, 0);
  addLight(ship, new THREE.Vector3(36, 0, 0), 0xff2010, 6, 1.2, 0.2);
  addLight(ship, new THREE.Vector3(-36, 0, 0), 0xff2010, 6, 1.2, 0.7);
  for (const sx of [1, -1]) addLight(ship, new THREE.Vector3(sx * 11, 10, 100), 0xff6020, 5, 0.8, 0.4);
  ship.radius = 105;
  ship.cockpit.set(-9, 52, -26);
  ship.hitSpheres = [[11, 0, 95, 9], [-11, 0, 95, 9], [11, 0, 75, 10], [-11, 0, 75, 10], [0, 0, 45, 18], [0, 0, 20, 21], [0, 0, -5, 22], [0, 0, -30, 22], [0, 0, -55, 22], [0, 0, -82, 20], [-9, 34, -38, 16]];
  ship.hardpoints = [
    { p: [8, 17.6, 32], flip: 0, s: 3.0 }, { p: [10, 19, 0], flip: 0, s: 3.0 }, { p: [10, 19, -64], flip: 0, s: 2.8 },
    { p: [-6, 17.6, 32], flip: 0, s: 2.8 }, { p: [0, -25.6, 30], flip: 1, s: 3.0 }, { p: [0, -26, -10], flip: 1, s: 3.0 },
    { p: [0, -26, -50], flip: 1, s: 2.8 }, { p: [11, 10, 70], flip: 0, s: 2.0 },
  ];
  ship.utilMounts = [[10, 19, -30], [-14, 19, 8], [-14, 19, -12], [12, -25.5, 10], [-12, -25.5, -30], [0, 19, 52]].map(([x, y, z]) => ({ p: [x, y, z], flip: y < 0 ? 1 : 0, s: 2.0 }));
  return addGreebles(ship);
}

// ---------------------------------------------------------------- civilian hauler (~70 m)
export function buildHauler(env, seed = 1) {
  const M = livery('hauler', env);
  const ship = shipBase('Hauler', M);
  const k = new Kit();
  const r = rng(seed * 101);
  // cockpit module
  k.add('hull', G.rbox(10, 8, 12, 1.5), mat([0, 0, 30]));
  k.add('glass', G.box(8, 2, 0.4), mat([0, 2.2, 36.1], [-0.3, 0, 0]));
  k.add('dark', G.rbox(11, 2, 8, 0.4), mat([0, -4, 28]));
  // spine truss
  k.add('dark', G.box(2.5, 2.5, 60), mat([0, 0, -2]));
  for (let i = 0; i < 12; i++) k.add('metal', G.box(6, 0.4, 0.4), mat([0, 2.6, 24 - i * 5], [0, 0, 0]));
  // containers
  const colors = ['accent', 'hull', 'dark'];
  for (let i = 0; i < 5; i++) {
    for (const [x, y] of [[3.6, 3.6], [-3.6, 3.6], [3.6, -3.6], [-3.6, -3.6]]) {
      if (r() < 0.15) continue;
      k.add(colors[Math.floor(r() * colors.length)], G.rbox(6.6, 6.6, 9.4, 0.3), mat([x, y, 20 - i * 10]));
    }
  }
  // engine module
  k.add('hull', G.rbox(12, 10, 10, 1.5), mat([0, 0, -36]));
  for (const x of [-3.2, 3.2]) {
    k.add('nozzle', G.lathe([[2.2, 0.5], [2.4, 0], [2.9, -2], [3.1, -3]], 24), mat([x, 0, -41.2], [Math.PI / 2, 0, 0]));
    k.add('engine', G.cyl(2.2, 2.2, 0.1, 20), mat([x, 0, -41.4], [Math.PI / 2, 0, 0]));
  }
  ship.group.add(k.build(M, { uvTile: { hull: 12, accent: 8, dark: 8 } }));
  addEngine(ship, M, new THREE.Vector3(3.2, 0, -41.5), 2.2, 18);
  addEngine(ship, M, new THREE.Vector3(-3.2, 0, -41.5), 2.2, 18);
  addLight(ship, new THREE.Vector3(5.5, 0, 32), 0xff2010, 2.2, 0);
  addLight(ship, new THREE.Vector3(-5.5, 0, 32), 0x20ff40, 2.2, 0);
  addLight(ship, new THREE.Vector3(0, 5.5, -36), 0xffffff, 3, 1.0, r());
  ship.radius = 42;
  ship.hitSpheres = [[0, 0, 30, 8], [0, 0, 10, 8], [0, 0, -10, 8], [0, 0, -34, 8]];
  return addGreebles(ship);
}

// per-frame cosmetic animation
export function animateShip(ship, dt, time, throttle) {
  for (const e of ship.engines) {
    const p = 0.12 + throttle * 0.9;
    e.plume.material.uniforms.uPower.value = p * (0.95 + Math.random() * 0.1);
    e.plume.material.uniforms.uTime.value = time;
    e.plume.scale.z = e.length * (0.25 + throttle * 0.9);
    e.sprite.scale.setScalar(e.radius * (1.4 + throttle * 1.8));
    e.sprite.material.opacity = 0.25 + throttle * 0.45;
  }
  for (const l of ship.navLights) {
    if (!l.blink) continue;
    const on = ((time * l.blink + l.phase) % 1) < 0.12;
    l.sp.material.opacity = on ? 1 : 0;
  }
  for (const t of ship.turrets) {
    t.recoil = t.recoil.map((v) => Math.max(0, v - dt * 4));
    t.barrels.forEach((b, i) => { b.position.z = t.baseZ[i] - t.recoil[i] * t.recoilDist; });
    if (t.rotor) { t.rotor.rotation.z += dt * t.spin; t.spin = Math.max(0, t.spin - dt * 40); }
  }
}

// ---------------------------------------------------------------- Kestrel interceptor (~22 m)
export function buildKestrel(env, liv = 'kestrel') {
  const M = livery(liv, env);
  const ship = shipBase('Kestrel', M);
  const k = new Kit();
  const r = rng(71);
  const rotZtoX = [0, -Math.PI / 2, 0];
  k.add('hull', G.extrude([[-9, -0.9], [-9, 1.3], [-4, 1.7], [3, 1.5], [8, 0.8], [12, 0.15], [12, -0.25], [7, -0.8], [0, -1.2], [-6, -1.2]], 2.0, 0.25, 2), mat([0, 0, 0], rotZtoX));
  k.add('dark', G.extrude([[-8.5, -1.1], [-8.5, 0], [6, 0], [9, -0.6], [4, -1.6], [-5, -1.7]], 1.4, 0.15), mat([0, 0, 0], rotZtoX));
  k.add('glass', G.sphere(1, 28, 14), mat([0, 1.35, 4.6], [0, 0, 0], [0.85, 0.6, 2.4]));
  k.add('dark', G.torus(1, 0.05, 6, 32), mat([0, 1.35, 4.0], [0, 0, 0], [0.86, 0.62, 1]));
  k.add('dark', G.torus(1, 0.05, 6, 32), mat([0, 1.35, 5.4], [0, 0, 0], [0.78, 0.55, 1]));
  k.add('accent', G.rbox(0.8, 0.4, 9, 0.12), mat([0, 1.85, -3]));
  k.add('metal', G.cyl(0.03, 0.05, 1.6, 6), mat([0.3, 2.6, -6.5], [-0.3, 0, 0]));
  // nacelles
  const nac = [[0, 4], [0.5, 3.8], [0.95, 2.8], [1.15, 0.5], [1.15, -4], [1.3, -4.6], [1.3, -5.9], [1.0, -6.1]];
  k.addMirrored('hull', G.lathe(nac, 28), mat([2.4, -0.1, -2.4], [Math.PI / 2, 0, 0]));
  k.addMirrored('accent', G.cyl(1.18, 1.18, 0.6, 28, true), mat([2.4, -0.1, -1.0], [Math.PI / 2, 0, 0]));
  k.addMirrored('dark', G.cyl(1.32, 1.32, 0.35, 28), mat([2.4, -0.1, -7.6], [Math.PI / 2, 0, 0]));
  k.addMirrored('nozzle', G.lathe([[0.9, 0.3], [1.0, 0], [1.15, -0.6], [1.25, -1.0]], 24), mat([2.4, -0.1, -8.3], [Math.PI / 2, 0, 0]));
  k.addMirrored('engine', G.cyl(0.9, 0.9, 0.05, 20), mat([2.4, -0.1, -8.35], [Math.PI / 2, 0, 0]));
  k.addMirrored('dark', G.rbox(1.6, 0.5, 4.5, 0.15), mat([1.4, 0.4, -3.5]));
  // delta wings with accent tips
  const wingM = mat([3.2, -0.4, -1.0], [Math.PI / 2, 0, -0.05]);
  k.addMirrored('hull', G.extrude([[0, 2], [7, -3.5], [7.6, -5.8], [0, -6.5]], 0.28, 0.08), wingM);
  k.addMirrored('accent', G.extrude([[5.8, -2.6], [7, -3.5], [7.6, -5.8], [6.4, -5.9]], 0.32, 0.03), wingM);
  k.addMirrored('dark', G.extrude([[1.0, -4.0], [5.5, -4.9], [5.6, -5.8], [1.0, -6.2]], 0.33, 0.02), wingM);
  k.addMirrored('dark', G.extrude([[0, 0], [-2.4, 0], [-3.0, 1.8], [-2.2, 1.8]], 0.18, 0.04), mat([10.6, -0.35, -3.8], [0, -Math.PI / 2, 0]));
  k.addMirrored('gun', G.cyl(0.08, 0.1, 2.2, 8), mat([10.7, -0.45, -2.0], [Math.PI / 2, 0, 0]));
  // canards
  k.addMirrored('hull', G.extrude([[0, 0.8], [2.2, -0.4], [2.3, -1.0], [0, -0.9]], 0.16, 0.04), mat([1.0, 0.2, 7.0], [Math.PI / 2, 0, 0.05]));
  scatterGreebles(k, r, 18, { x0: -0.6, x1: 0.6, z0: -7.5, z1: -0.5, y: 2.05, s: 0.3 });
  for (let i = 0; i < 12; i++) k.addMirrored(r() < 0.5 ? 'gun' : 'dark', G.box(0.1, 0.2 + r() * 0.3, 0.3 + r() * 0.6), mat([1.1, -0.6 + r() * 1.2, -6 + r() * 10]));
  ship.group.add(k.build(M, { uvTile: { hull: 7, accent: 5, dark: 5 } }));
  for (const x of [2.4, -2.4]) addEngine(ship, M, new THREE.Vector3(x, -0.1, -8.4), 0.9, 11);
  for (const x of [5.2, -5.2]) { const o = new THREE.Object3D(); o.position.set(x, -0.9, -1); ship.group.add(o); ship.launchers.push(o); }
  addLight(ship, new THREE.Vector3(10.9, -0.4, -3.5), 0xff2015, 1.2, 0);
  addLight(ship, new THREE.Vector3(-10.9, -0.4, -3.5), 0x15ff40, 1.2, 0);
  addLight(ship, new THREE.Vector3(0, 2.2, -7.8), 0xffffff, 1.5, 1.3, 0);
  ship.hardpoints = [{ p: [0, 1.75, 1.6], flip: 0, s: 0.72 }, { p: [0, 2.05, -3.6], flip: 0, s: 0.72 }];
  ship.utilMounts = [{ p: [0, -1.85, -1.5], flip: 1, s: 0.42 }, { p: [0, -1.85, -5.0], flip: 1, s: 0.42 }];
  ship.cockpit.set(0, 1.75, 5.0);
  ship.radius = 12;
  ship.hitSpheres = [[0, 0, 7, 1.6], [0, 0, 2, 2.1], [0, 0, -4, 2.2], [2.4, 0, -3, 1.6], [-2.4, 0, -3, 1.6], [7, -0.4, -3.5, 2], [-7, -0.4, -3.5, 2]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Warden destroyer (~66 m)
export function buildWarden(env, liv = 'warden') {
  const M = livery(liv, env);
  const ship = shipBase('Warden', M);
  const k = new Kit();
  const r = rng(113);
  const rotZtoX = [0, -Math.PI / 2, 0];
  k.add('hull', G.extrude([[-28, -3], [-28, 3.5], [-12, 4.2], [10, 4.0], [22, 2.5], [33, 0.6], [33, -0.6], [22, -2.8], [0, -3.6], [-20, -3.6]], 7, 0.5, 2), mat([0, 0, 0], rotZtoX));
  k.add('dark', G.extrude([[-26, -3.4], [-26, 0], [24, 0], [28, -1.6], [18, -5.2], [-18, -5.4]], 5, 0.3), mat([0, 0, 0], rotZtoX));
  k.addMirrored('accent', G.extrude([[12, 0.4], [12, 2.6], [22, 1.6], [30, 0.4]], 0.2, 0.04), mat([3.6, 0, 0], rotZtoX));
  // sponsons with armour ribs
  k.addMirrored('hull', G.rbox(3.2, 4.5, 30, 0.5), mat([5.6, -0.5, -6]));
  k.addMirrored('accent', G.rbox(3.3, 1.0, 24, 0.2), mat([5.65, 1.2, -6]));
  k.addMirrored('dark', G.rbox(2.6, 1.8, 22, 0.3), mat([6.4, -2.3, -6]));
  for (let i = 0; i < 5; i++) k.addMirrored('dark', G.box(0.3, 3.2, 1.5), mat([7.25, -0.5, -18 + i * 6]));
  k.addMirrored('light', G.box(0.2, 0.6, 3), mat([7.2, -2.3, 5.0]));
  // bridge tower
  k.add('hull', G.rbox(4.5, 3.2, 8, 0.4), mat([0, 5.6, -14]));
  k.add('dark', G.rbox(5.4, 1.4, 4.2, 0.2), mat([0, 7.6, -13]));
  k.add('glass', G.box(5.3, 0.6, 4.0), mat([0, 7.7, -12.95]));
  k.add('metal', G.cyl(0.08, 0.12, 5, 6), mat([0.8, 10.2, -15]));
  k.add('metal', G.cyl(0.06, 0.1, 3.4, 6), mat([-0.9, 9.6, -15.6]));
  k.add('dark', G.cyl(1.4, 0.1, 0.4, 20), mat([0, 8.8, -16.5], [0.4, 0, 0]));
  // dorsal deck and radiators
  k.add('dark', G.rbox(4, 0.6, 18, 0.2), mat([0, 4.3, -1]));
  for (let i = 0; i < 10; i++) k.addMirrored('metal', G.box(3.5, 0.15, 1.0), mat([4.0, 3.9, -26 + i * 1.2], [0, 0, 0.5]));
  // engine block
  k.add('dark', G.rbox(11, 8, 6, 0.8), mat([0, 0.2, -30]));
  const nz = [[-2.8, 1.8], [2.8, 1.8], [-2.8, -1.8], [2.8, -1.8]];
  for (const [x, y] of nz) {
    k.add('nozzle', G.lathe([[1.5, 0.4], [1.65, 0], [1.95, -1.0], [2.1, -1.6]], 24), mat([x, y, -33.0], [Math.PI / 2, 0, 0]));
    k.add('engine', G.cyl(1.5, 1.5, 0.08, 20), mat([x, y, -33.1], [Math.PI / 2, 0, 0]));
  }
  scatterGreebles(k, r, 50, { x0: -2.8, x1: 2.8, z0: -26, z1: -18, y: 4.2, s: 0.9 });
  scatterGreebles(k, r, 40, { x0: -1.8, x1: 1.8, z0: -16, z1: 14, y: -5.6, s: 0.8 });
  for (let i = 0; i < 40; i++) k.addMirrored(r() < 0.5 ? 'dark' : 'gun', G.box(0.3 + r() * 0.4, 0.4 + r() * 1.2, 0.8 + r() * 3), mat([3.9, -2.5 + r() * 5, -26 + r() * 46]));
  ship.group.add(k.build(M, { uvTile: { hull: 12, accent: 8, dark: 8 } }));
  for (const [x, y] of nz) addEngine(ship, M, new THREE.Vector3(x, y, -33.2), 1.5, 20);
  for (const x of [6.4, -6.4]) { const o = new THREE.Object3D(); o.position.set(x, -2.3, 6); ship.group.add(o); ship.launchers.push(o); }
  addLight(ship, new THREE.Vector3(7.5, 0, 8), 0xff2015, 2.2, 0);
  addLight(ship, new THREE.Vector3(-7.5, 0, 8), 0x15ff40, 2.2, 0);
  addLight(ship, new THREE.Vector3(0.8, 12.8, -15), 0xffffff, 2.6, 1.0, 0);
  addLight(ship, new THREE.Vector3(0, -5.9, -28), 0xff3030, 2.0, 0.8, 0.5);
  ship.hardpoints = [
    { p: [0, 4.6, 6], flip: 0, s: 1.1 }, { p: [0, 4.6, -4], flip: 0, s: 1.1 }, { p: [0, 4.3, -22], flip: 0, s: 1.0 },
    { p: [0, -5.6, 6], flip: 1, s: 1.0 }, { p: [0, -5.6, -9], flip: 1, s: 1.0 },
  ];
  ship.utilMounts = [{ p: [5.6, 1.75, 2], flip: 0, s: 0.75 }, { p: [-5.6, 1.75, 2], flip: 0, s: 0.75 }, { p: [5.6, 1.75, -14], flip: 0, s: 0.75 }, { p: [-5.6, 1.75, -14], flip: 0, s: 0.75 }];
  ship.cockpit.set(0, 8.3, -10.6);
  ship.radius = 34;
  ship.hitSpheres = [[0, 0, 27, 3], [0, 0, 17, 4.5], [0, 0, 5, 5], [0, 0, -8, 5.5], [0, 0, -20, 5.5], [0, 0, -30, 5], [0, 6, -14, 3], [6, -0.5, -6, 3], [-6, -0.5, -6, 3]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Paladin battlecruiser (~118 m)
export function buildPaladin(env, liv = 'paladin') {
  const M = livery(liv, env);
  const ship = shipBase('Paladin', M);
  const k = new Kit();
  const r = rng(149);
  const outline = [[0, 58], [7, 50], [17, 18], [21, -12], [19, -50], [8, -56], [-8, -56], [-19, -50], [-21, -12], [-17, 18], [-7, 50]];
  const flat = [Math.PI / 2, 0, 0];
  k.add('hull', G.extrude(outline, 9, 1.0, 2), mat([0, 0, 0], flat));
  k.add('hull', G.extrude(outline.map(([x, y]) => [x * 0.7, y * 0.7 - 2]), 4, 0.5), mat([0, 7, 0], flat));
  k.add('dark', G.extrude(outline.map(([x, y]) => [x * 0.8, y * 0.8 - 3]), 4, 0.5), mat([0, -7, 0], flat));
  k.addMirrored('accent', G.extrude([[7, 50], [17, 18], [17.6, 18.5], [8, 51]], 9.4, 0.1), mat([0, 0, 0], flat));
  k.addMirrored('accent', G.rbox(1.2, 1.4, 48, 0.3), mat([12.2, 9.4, -6]));
  // side blisters
  k.addMirrored('dark', G.rbox(6, 7, 60, 1.0), mat([20, -1, -16]));
  for (let i = 0; i < 8; i++) k.addMirrored('hull', G.rbox(1.2, 7.4, 4, 0.3), mat([23.2, -1, -42 + i * 7.5]));
  k.addMirrored('light', G.box(0.4, 2.5, 8), mat([23.4, -1, 14.5]));
  // command superstructure
  k.add('hull', G.rbox(12, 8, 22, 1.2), mat([0, 13, -24]));
  k.add('dark', G.rbox(14, 3, 10, 0.5), mat([0, 18, -20]));
  k.add('glass', G.box(13.8, 1.0, 9.6), mat([0, 18.4, -19.95]));
  k.add('accent', G.rbox(8, 3, 8, 0.6), mat([0, 21, -24]));
  k.add('metal', G.cyl(0.25, 0.4, 14, 8), mat([2, 29, -26]));
  k.add('metal', G.cyl(0.2, 0.3, 9, 8), mat([-2, 26.5, -27]));
  k.add('dark', G.cyl(3.5, 0.3, 1.0, 24), mat([0, 24, -30], [0.5, 0, 0]));
  // ventral hangar bay
  k.add('dark', G.box(10, 2, 16), mat([0, -9.4, 30]));
  k.add('light', G.box(8, 0.2, 14), mat([0, -10.45, 30]));
  // engine block
  k.add('dark', G.rbox(30, 12, 10, 1.5), mat([0, 0, -58]));
  const nz = [[-10, 2.5], [0, 2.5], [10, 2.5], [-5, -3.2], [5, -3.2]];
  for (const [x, y] of nz) {
    k.add('nozzle', G.lathe([[2.6, 0.6], [2.9, 0], [3.4, -1.8], [3.7, -3]], 28), mat([x, y, -63], [Math.PI / 2, 0, 0]));
    k.add('engine', G.cyl(2.6, 2.6, 0.1, 24), mat([x, y, -63.2], [Math.PI / 2, 0, 0]));
  }
  for (let i = 0; i < 12; i++) k.addMirrored('metal', G.box(10, 0.3, 2), mat([16, 6.5, -40 - i * 1.4], [0, 0, 0.3]));
  scatterGreebles(k, r, 120, { x0: -9, x1: 9, z0: -10, z1: 32, y: 9.4, s: 2.2 });
  scatterGreebles(k, r, 80, { x0: -9, x1: 9, z0: -40, z1: 20, y: -9.6, s: 2 });
  for (let i = 0; i < 60; i++) k.addMirrored(r() < 0.5 ? 'dark' : 'gun', G.box(0.6 + r(), 0.8 + r() * 2.5, 1.5 + r() * 5), mat([14 + r() * 3, -4 + r() * 8, -36 + r() * 60]));
  ship.group.add(k.build(M, { uvTile: { hull: 16, accent: 10, dark: 10 } }));
  for (const [x, y] of nz) addEngine(ship, M, new THREE.Vector3(x, y, -63.3), 2.6, 34);
  for (const x of [12, -12]) { const o = new THREE.Object3D(); o.position.set(x, 0, 34); ship.group.add(o); ship.launchers.push(o); }
  addLight(ship, new THREE.Vector3(23.6, -1, 0), 0xff2015, 3.5, 0);
  addLight(ship, new THREE.Vector3(-23.6, -1, 0), 0x15ff40, 3.5, 0);
  addLight(ship, new THREE.Vector3(2, 36.2, -26), 0xffffff, 4, 1.0, 0);
  addLight(ship, new THREE.Vector3(0, 0, 59), 0xffffff, 3, 1.4, 0.3);
  ship.hardpoints = [
    { p: [0, 9.4, 30], flip: 0, s: 1.7 }, { p: [0, 9.4, 12], flip: 0, s: 1.7 },
    { p: [9, 9.4, -4], flip: 0, s: 1.6 }, { p: [-9, 9.4, -4], flip: 0, s: 1.6 },
    { p: [9, 9.4, -30], flip: 0, s: 1.5 }, { p: [-9, 9.4, -30], flip: 0, s: 1.5 },
    { p: [0, -9.4, 8], flip: 1, s: 1.6 },
  ];
  ship.utilMounts = [{ p: [16, 5.5, -8], flip: 0, s: 1.4 }, { p: [-16, 5.5, -8], flip: 0, s: 1.4 }, { p: [15, 5.5, -32], flip: 0, s: 1.4 }, { p: [-15, 5.5, -32], flip: 0, s: 1.4 }, { p: [0, -9.4, -20], flip: 1, s: 1.4 }];
  ship.cockpit.set(0, 19.4, -15.5);
  ship.radius = 62;
  ship.hitSpheres = [[0, 0, 46, 8], [0, 0, 28, 13], [0, 0, 8, 17], [0, 0, -14, 19], [0, 0, -36, 18], [0, 0, -56, 12], [0, 14, -24, 9], [18, 0, -16, 9], [-18, 0, -16, 9]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Mantis gunship (~38 m)
export function buildMantis(env, liv = 'mantis') {
  const M = livery(liv, env);
  const ship = shipBase('Mantis', M);
  const k = new Kit();
  const r = rng(181);
  const rotZtoX = [0, -Math.PI / 2, 0];
  k.add('hull', G.extrude([[-16, -1.6], [-16, 2.2], [-6, 3.0], [6, 2.6], [14, 1.4], [19, 0.2], [19, -0.6], [12, -1.8], [0, -2.4], [-10, -2.2]], 4.2, 0.35, 2), mat([0, 0, 0], rotZtoX));
  k.add('dark', G.extrude([[-15, -2.0], [-15, 0], [12, 0], [16, -1.0], [8, -3.0], [-10, -3.0]], 3.2, 0.2), mat([0, 0, 0], rotZtoX));
  k.add('glass', G.sphere(1, 28, 14), mat([0, 2.2, 10.5], [0, 0, 0], [1.4, 0.8, 3.2]));
  k.add('dark', G.torus(1, 0.06, 6, 32), mat([0, 2.2, 9.0], [0, 0, 0], [1.42, 0.82, 1]));
  k.add('accent', G.rbox(1.2, 0.5, 14, 0.15), mat([0, 3.0, -4]));
  // forward-swept gun booms
  k.addMirrored('hull', G.rbox(2.6, 2.4, 24, 0.4), mat([8.5, -0.4, -1], [0, -0.12, 0]));
  k.addMirrored('accent', G.rbox(2.7, 0.6, 18, 0.15), mat([8.5, 0.75, -1], [0, -0.12, 0]));
  k.addMirrored('dark', G.rbox(2.0, 1.2, 22, 0.2), mat([8.5, -1.6, -1], [0, -0.12, 0]));
  k.addMirrored('gun', G.cyl(0.18, 0.24, 3, 10), mat([7.1, -0.4, 12.4], [Math.PI / 2, 0, 0]));
  k.addMirrored('dark', G.cyl(0.32, 0.32, 0.6, 12), mat([7.1, -0.4, 11.0], [Math.PI / 2, 0, 0]));
  k.addMirrored('hull', G.extrude([[0, 4], [6.5, 2], [6.5, -6], [0, -8]], 0.6, 0.1), mat([1.8, 0, 0], [Math.PI / 2, 0, 0]));
  k.addMirrored('dark', G.extrude([[0.5, -4], [6, -3.5], [6, -5.5], [0.5, -7]], 0.7, 0.02), mat([1.8, 0, 0], [Math.PI / 2, 0, 0]));
  // boom engine pods and central engine
  k.addMirrored('nozzle', G.lathe([[1.0, 0.3], [1.1, 0], [1.3, -0.8], [1.4, -1.2]], 24), mat([9.9, -0.4, -13.2], [Math.PI / 2, 0, 0]));
  k.addMirrored('engine', G.cyl(1.0, 1.0, 0.05, 20), mat([9.9, -0.4, -13.3], [Math.PI / 2, 0, 0]));
  k.add('dark', G.rbox(4.6, 3.6, 3, 0.4), mat([0, 0.2, -16.5]));
  k.add('nozzle', G.lathe([[1.4, 0.4], [1.55, 0], [1.85, -1], [2.0, -1.5]], 24), mat([0, 0.2, -18.2], [Math.PI / 2, 0, 0]));
  k.add('engine', G.cyl(1.4, 1.4, 0.06, 20), mat([0, 0.2, -18.3], [Math.PI / 2, 0, 0]));
  scatterGreebles(k, r, 30, { x0: -1.6, x1: 1.6, z0: -14, z1: 4, y: 2.9, s: 0.5 });
  for (let i = 0; i < 20; i++) k.addMirrored(r() < 0.5 ? 'gun' : 'dark', G.box(0.2, 0.3 + r() * 0.5, 0.5 + r() * 1.5), mat([2.15, -1.5 + r() * 2.8, -14 + r() * 24]));
  ship.group.add(k.build(M, { uvTile: { hull: 9, accent: 6, dark: 6 } }));
  for (const x of [9.9, -9.9]) addEngine(ship, M, new THREE.Vector3(x, -0.4, -13.4), 1.0, 12);
  addEngine(ship, M, new THREE.Vector3(0, 0.2, -18.4), 1.4, 16);
  for (const x of [4, -4]) { const o = new THREE.Object3D(); o.position.set(x, -2.2, 4); ship.group.add(o); ship.launchers.push(o); }
  addLight(ship, new THREE.Vector3(7.5, 0.6, 12), 0xff2015, 1.6, 0);
  addLight(ship, new THREE.Vector3(-7.5, 0.6, 12), 0x15ff40, 1.6, 0);
  addLight(ship, new THREE.Vector3(0, 3.5, -10), 0xffffff, 1.8, 1.2, 0);
  ship.hardpoints = [{ p: [0, 3.25, 3], flip: 0, s: 0.9 }, { p: [0, 3.25, -9], flip: 0, s: 0.9 }, { p: [7.8, 1.05, 5], flip: 0, s: 0.75 }, { p: [-7.8, 1.05, 5], flip: 0, s: 0.75 }];
  ship.utilMounts = [{ p: [0, -3.1, 2], flip: 1, s: 0.55 }, { p: [0, -3.1, -6], flip: 1, s: 0.55 }, { p: [4.6, 0.42, -3], flip: 0, s: 0.5 }];
  ship.cockpit.set(0, 3.0, 9.6);
  ship.radius = 20;
  ship.hitSpheres = [[0, 0, 14, 2.2], [0, 0, 6, 3], [0, 0, -4, 3.2], [0, 0, -14, 3], [8.5, -0.4, 4, 2], [-8.5, -0.4, 4, 2], [9.5, -0.4, -8, 2], [-9.5, -0.4, -8, 2]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Corvid stealth corvette (~26 m)
export function buildCorvid(env, liv = 'corvid') {
  const M = livery(liv, env);
  const ship = shipBase('Corvid', M);
  const k = new Kit();
  const r = rng(197);
  const flat = [Math.PI / 2, 0, 0];
  const outline = [[0, 15], [3.2, 6], [9, -6], [9.6, -9], [3, -11], [-3, -11], [-9.6, -9], [-9, -6], [-3.2, 6]];
  k.add('hull', G.extrude(outline, 1.6, 0.25), mat([0, 0, 0], flat));
  k.add('dark', G.extrude(outline.map(([x, y]) => [x * 0.62, y * 0.7 - 1.5]), 1.4, 0.2), mat([0, 1.2, 0], flat));
  k.add('dark', G.extrude(outline.map(([x, y]) => [x * 0.7, y * 0.75 - 1]), 1.2, 0.2), mat([0, -1.1, 0], flat));
  k.addMirrored('accent', G.extrude([[3.2, 6], [9, -6], [9.6, -9], [9.0, -9.1], [8.3, -6.2], [2.7, 5.6]], 1.8, 0.04), mat([0, 0, 0], flat));
  k.add('glass', G.sphere(1, 24, 12), mat([0, 1.75, 5.5], [0, 0, 0], [1.1, 0.45, 3]));
  k.addMirrored('hull', G.rbox(0.2, 3, 4, 0.05), mat([3.4, 2.6, -7.5], [0, 0, -0.45]));
  k.addMirrored('accent', G.rbox(0.22, 0.4, 3.6, 0.04), mat([4.05, 3.9, -7.6], [0, 0, -0.45]));
  for (let i = 0; i < 4; i++) k.addMirrored('dark', G.box(0.08, 0.04, 5), mat([2.2 + i * 1.6, 0.86, -3.5 - i * 1.2], [0, 0.42, 0]));
  k.add('dark', G.rbox(6, 1.4, 1.5, 0.2), mat([0, 0, -10.6]));
  for (const x of [-1.8, 1.8]) k.add('engine', G.box(1.6, 0.5, 0.05), mat([x, 0, -11.4]));
  scatterGreebles(k, r, 10, { x0: -1.5, x1: 1.5, z0: -8, z1: 0, y: 1.95, s: 0.25 });
  ship.group.add(k.build(M, { uvTile: { hull: 6, accent: 4, dark: 5 } }));
  for (const x of [-1.8, 1.8]) addEngine(ship, M, new THREE.Vector3(x, 0, -11.5), 0.55, 7);
  for (const x of [4, -4]) { const o = new THREE.Object3D(); o.position.set(x, -0.9, 0); ship.group.add(o); ship.launchers.push(o); }
  addLight(ship, new THREE.Vector3(9.6, 0, -9), 0xff2015, 1.0, 0);
  addLight(ship, new THREE.Vector3(-9.6, 0, -9), 0x15ff40, 1.0, 0);
  addLight(ship, new THREE.Vector3(0, 2.1, -8), 0xffffff, 1.2, 1.5, 0);
  ship.hardpoints = [{ p: [0, 2.0, 1.5], flip: 0, s: 0.65 }, { p: [0, -1.9, -2], flip: 1, s: 0.65 }];
  ship.utilMounts = [{ p: [5, 0.9, -5], flip: 0, s: 0.4 }, { p: [-5, 0.9, -5], flip: 0, s: 0.4 }, { p: [0, 2.0, -5.5], flip: 0, s: 0.4 }];
  ship.cockpit.set(0, 1.95, 4.2);
  ship.radius = 13;
  ship.hitSpheres = [[0, 0, 10, 1.6], [0, 0, 4, 2.6], [0, 0, -3, 3], [5, 0, -7, 2.5], [-5, 0, -7, 2.5], [0, 0, -9, 2.5]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Bastion heavy cruiser (~96 m)
export function buildBastion(env, liv = 'bastion') {
  const M = livery(liv, env);
  const ship = shipBase('Bastion', M);
  const k = new Kit();
  const r = rng(211);
  const alongZ = [Math.PI / 2, 0, 0];
  k.add('hull', G.lathe([[0.1, 46], [3, 44], [7, 36], [9, 24], [9.5, 0], [9.5, -30], [8.5, -38], [7, -40]], 40), mat([0, 0, 0], alongZ));
  for (let i = 0; i < 5; i++) {
    k.add('dark', G.cyl(10.4, 10.4, 4, 40), mat([0, 0, 18 - i * 11], alongZ));
    k.add('accent', G.cyl(10.5, 10.5, 0.8, 40, true), mat([0, 0, 19.2 - i * 11], alongZ));
  }
  k.add('hull', G.rbox(10, 3, 50, 0.6), mat([0, 9.6, -6]));
  k.add('accent', G.rbox(10.2, 0.6, 6, 0.15), mat([0, 10.4, 21]));
  // side hangar pods on pylons
  k.addMirrored('hull', G.rbox(6, 7, 34, 0.8), mat([13, 0, -10]));
  k.addMirrored('dark', G.rbox(4, 2.5, 30, 0.3), mat([16.2, 0, -10]));
  k.addMirrored('accent', G.rbox(6.1, 1.0, 26, 0.2), mat([13, 2.4, -10]));
  k.addMirrored('light', G.box(0.3, 1.2, 6), mat([16.5, 0, 4]));
  for (const z of [-20, 0]) k.addMirrored('dark', G.box(4, 2, 6), mat([9.5, 0, z]));
  // command tower
  k.add('hull', G.rbox(7, 5, 10, 0.6), mat([0, 13.5, -24]));
  k.add('dark', G.rbox(8, 1.6, 5, 0.3), mat([0, 16.4, -22]));
  k.add('glass', G.box(7.8, 0.6, 4.8), mat([0, 16.6, -21.95]));
  k.add('metal', G.cyl(0.15, 0.25, 9, 8), mat([1.5, 20, -26]));
  k.add('metal', G.cyl(0.12, 0.2, 6, 8), mat([-1.2, 18.5, -27]));
  k.add('dark', G.cyl(2.2, 0.2, 0.6, 20), mat([0, 17.8, -28], [0.5, 0, 0]));
  // engine block
  k.add('dark', G.rbox(20, 14, 8, 1.2), mat([0, 0, -44]));
  const nz = [[-5, 3.5], [5, 3.5], [-5, -3.5], [5, -3.5]];
  for (const [x, y] of nz) {
    k.add('nozzle', G.lathe([[2.2, 0.5], [2.4, 0], [2.8, -1.4], [3.0, -2.2]], 28), mat([x, y, -48.2], alongZ));
    k.add('engine', G.cyl(2.2, 2.2, 0.1, 24), mat([x, y, -48.4], alongZ));
  }
  for (let i = 0; i < 8; i++) k.addMirrored('metal', G.box(8, 0.25, 1.6), mat([10, 6, -32 - i * 1.3], [0, 0, 0.35]));
  scatterGreebles(k, r, 90, { x0: -4.5, x1: 4.5, z0: -30, z1: 18, y: 11.1, s: 1.6 });
  for (let i = 0; i < 40; i++) k.addMirrored(r() < 0.5 ? 'dark' : 'gun', G.box(0.5 + r() * 0.6, 0.6 + r() * 1.8, 1.2 + r() * 4), mat([16 + r() * 0.6, -3 + r() * 6, -26 + r() * 32]));
  ship.group.add(k.build(M, { uvTile: { hull: 14, accent: 9, dark: 9 } }));
  for (const [x, y] of nz) addEngine(ship, M, new THREE.Vector3(x, y, -48.6), 2.2, 28);
  for (const x of [13, -13]) { const o = new THREE.Object3D(); o.position.set(x, -1, 8); ship.group.add(o); ship.launchers.push(o); }
  addLight(ship, new THREE.Vector3(16.8, 0, -10), 0xff2015, 3.0, 0);
  addLight(ship, new THREE.Vector3(-16.8, 0, -10), 0x15ff40, 3.0, 0);
  addLight(ship, new THREE.Vector3(1.5, 24.6, -26), 0xffffff, 3.2, 1.0, 0);
  addLight(ship, new THREE.Vector3(0, -10.6, -20), 0xff3030, 2.4, 0.8, 0.5);
  ship.hardpoints = [
    { p: [0, 11.1, 14], flip: 0, s: 1.4 }, { p: [0, 11.1, 0], flip: 0, s: 1.4 }, { p: [0, 11.1, -14], flip: 0, s: 1.3 },
    { p: [13, 3.5, -2], flip: 0, s: 1.2 }, { p: [-13, 3.5, -2], flip: 0, s: 1.2 }, { p: [0, -9.6, 0], flip: 1, s: 1.3 },
  ];
  ship.utilMounts = [{ p: [13, 3.5, -20], flip: 0, s: 1.0 }, { p: [-13, 3.5, -20], flip: 0, s: 1.0 }, { p: [3.6, 11.1, 7], flip: 0, s: 0.9 }, { p: [-3.6, 11.1, -7], flip: 0, s: 0.9 }, { p: [0, -9.6, -20], flip: 1, s: 1.0 }];
  ship.cockpit.set(0, 17.4, -19);
  ship.radius = 52;
  ship.hitSpheres = [[0, 0, 38, 6], [0, 0, 24, 10], [0, 0, 8, 11], [0, 0, -8, 11], [0, 0, -24, 11], [0, 0, -42, 10], [13, 0, -10, 6], [-13, 0, -10, 6], [0, 13, -24, 6]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- outfit models (utility modules face +Y, ~2.5 m across)
export function buildOutfitModel(id, M) {
  const k = new Kit();
  const up = [0, 0, 0];
  switch (id) {
    case 'shieldext':
      k.add('dark', G.rbox(2.4, 0.4, 2.4, 0.1), mat([0, 0.2, 0]));
      k.add('hull', G.cyl(0.8, 1.0, 1.0, 24), mat([0, 0.9, 0]));
      k.add('metal', G.lathe([[0.2, 0], [1.1, 0.25], [1.25, 0.45], [1.2, 0.5]], 32), mat([0, 1.4, 0]));
      for (let i = 0; i < 3; i++) k.add('coil', G.torus(0.85 - i * 0.2, 0.04, 6, 32), mat([0, 1.55 + i * 0.12, 0], [Math.PI / 2, 0, 0]));
      k.add('coil', G.sphere(0.18, 16, 10), mat([0, 1.95, 0]));
      break;
    case 'shieldbooster':
      k.add('dark', G.rbox(2.2, 0.4, 2.2, 0.1), mat([0, 0.2, 0]));
      k.add('hull', G.cyl(0.6, 0.75, 2.4, 20), mat([0, 1.6, 0]));
      for (let i = 0; i < 4; i++) {
        k.add('metal', G.torus(0.8, 0.1, 8, 28), mat([0, 0.8 + i * 0.5, 0], [Math.PI / 2, 0, 0]));
        k.add('coil', G.torus(0.72, 0.04, 6, 28), mat([0, 1.05 + i * 0.5, 0], [Math.PI / 2, 0, 0]));
      }
      k.add('accent', G.cyl(0.3, 0.6, 0.4, 20), mat([0, 3.0, 0]));
      break;
    case 'armorplate':
      for (let i = 0; i < 3; i++) {
        k.add(i === 1 ? 'accent' : 'hull', G.rbox(2.6 - i * 0.3, 0.32, 2.2 - i * 0.2, 0.08), mat([0, 0.2 + i * 0.36, 0], [0, i * 0.05, 0]));
        for (const [x, z] of [[1, 0.8], [-1, 0.8], [1, -0.8], [-1, -0.8]]) k.add('metal', G.cyl(0.07, 0.07, 0.1, 8), mat([x * (1 - i * 0.14), 0.4 + i * 0.36, z * (1 - i * 0.12)]));
      }
      k.add('dark', G.box(2.7, 0.12, 0.25), mat([0, 0.06, 0]));
      break;
    case 'capbattery':
      k.add('dark', G.rbox(2.6, 0.35, 1.8, 0.08), mat([0, 0.18, 0]));
      for (let i = 0; i < 4; i++) {
        const x = -0.9 + i * 0.6;
        k.add('metal', G.cyl(0.26, 0.26, 1.6, 18), mat([x, 0.65, 0], [Math.PI / 2, 0, 0]));
        k.add('coil', G.cyl(0.27, 0.27, 0.12, 18, true), mat([x, 0.65, 0.4], [Math.PI / 2, 0, 0]));
        k.add('accent', G.cyl(0.2, 0.2, 0.1, 18), mat([x, 0.65, 0.84], [Math.PI / 2, 0, 0]));
      }
      k.add('dark', G.box(2.5, 0.12, 0.2), mat([0, 0.95, 0]));
      break;
    case 'caprecharger':
      k.add('dark', G.rbox(1.4, 1.0, 1.4, 0.15), mat([0, 0.5, 0]));
      for (let i = 0; i < 7; i++) k.add('metal', G.box(2.6, 0.06, 1.2), mat([0, 1.1 + i * 0.14, 0]));
      k.add('coil', G.box(0.2, 0.9, 1.25), mat([0, 1.5, 0]));
      k.add('gun', G.cyl(0.08, 0.08, 1.4, 8), mat([0.9, 0.6, 0], [0, 0, Math.PI / 2]));
      break;
    case 'overdrive':
      k.add('dark', G.rbox(1.8, 0.35, 2.4, 0.08), mat([0, 0.18, 0]));
      k.add('hull', G.cyl(0.5, 0.6, 1.6, 20), mat([0, 0.75, 0.2], [Math.PI / 2, 0, 0]));
      k.add('nozzle', G.lathe([[0.45, 0.3], [0.5, 0], [0.62, -0.4], [0.7, -0.7]], 24), mat([0, 0.75, -0.6], [Math.PI / 2, 0, 0]));
      k.add('amber', G.cyl(0.45, 0.45, 0.04, 20), mat([0, 0.75, -0.62], [Math.PI / 2, 0, 0]));
      k.add('gun', G.cyl(0.08, 0.08, 1.4, 8), mat([0.55, 1.05, 0.1], [Math.PI / 2, 0, 0]));
      k.add('gun', G.cyl(0.08, 0.08, 1.4, 8), mat([-0.55, 1.05, 0.1], [Math.PI / 2, 0, 0]));
      k.add('accent', G.rbox(0.9, 0.3, 0.8, 0.06), mat([0, 1.25, 0.6]));
      break;
    case 'sensor':
      k.add('dark', G.rbox(1.6, 0.35, 1.6, 0.08), mat([0, 0.18, 0]));
      k.add('metal', G.cyl(0.12, 0.18, 1.6, 10), mat([0, 1.1, 0]));
      k.add('hull', G.lathe([[0.05, 0], [0.7, 0.25], [1.1, 0.55], [1.15, 0.62]], 32), mat([0, 1.8, 0.1], [0.5, 0, 0]));
      k.add('gun', G.cyl(0.03, 0.03, 0.8, 6), mat([0, 2.2, 0.35], [0.5, 0, 0]));
      k.add('coil', G.sphere(0.09, 10, 8), mat([0, 2.55, 0.55]));
      k.add('glass', G.sphere(0.3, 16, 10), mat([0.55, 0.55, 0.4]));
      break;
    case 'cargopod':
      k.add('dark', G.rbox(2.6, 0.3, 1.9, 0.06), mat([0, 0.15, 0]));
      k.add('accent', G.box(2.4, 1.2, 1.6), mat([0, 0.9, 0]));
      for (let i = 0; i < 5; i++) k.add('metal', G.box(0.06, 1.24, 1.64), mat([-1.0 + i * 0.5, 0.9, 0]));
      k.add('dark', G.box(2.5, 0.1, 1.7), mat([0, 1.55, 0]));
      k.add('amber', G.box(0.2, 0.08, 0.1), mat([1.0, 1.62, 0.7]));
      break;
    case 'bunkmod':
      k.add('dark', G.rbox(2.4, 0.3, 1.8, 0.06), mat([0, 0.15, 0]));
      k.add('hull', G.cyl(0.7, 0.7, 2.4, 20), mat([0, 0.95, 0], [0, 0, Math.PI / 2]));
      k.add('window', G.cyl(0.71, 0.71, 1.8, 20, true), mat([0, 0.95, 0], [0, 0, Math.PI / 2], [1, 1, 0.25]));
      k.add('metal', G.cyl(0.74, 0.74, 0.12, 20), mat([1.0, 0.95, 0], [0, 0, Math.PI / 2]));
      k.add('metal', G.cyl(0.74, 0.74, 0.12, 20), mat([-1.0, 0.95, 0], [0, 0, Math.PI / 2]));
      break;
    default:
      k.add('dark', G.box(1, 1, 1), mat(up));
  }
  return k.build(M, { uvTile: { hull: 3, accent: 3, dark: 3 } });
}

function launcherAt(ship, x, y, z) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  ship.group.add(o);
  ship.launchers.push(o);
}

// wing panel lying in the XZ plane, tilted about the ship's long axis by `roll`
const wingMat = (pos, roll) => mat(pos, [0, 0, roll]).multiply(mat([0, 0, 0], [Math.PI / 2, 0, 0]));

// ---------------------------------------------------------------- Hornet light fighter (~15 m)
export function buildHornet(env, liv = 'hornet') {
  const M = livery(liv, env);
  const ship = shipBase('Hornet', M);
  const k = new Kit();
  const r = rng(223);
  const rotZtoX = [0, -Math.PI / 2, 0];
  const alongZ = [Math.PI / 2, 0, 0];
  k.add('hull', G.extrude([[-6, -0.8], [-6, 1.0], [-2, 1.4], [3, 1.2], [6.5, 0.5], [8, 0.05], [7.5, -0.35], [2, -0.9], [-4, -1.0]], 1.8, 0.2, 2), mat([0, 0, 0], rotZtoX));
  k.add('dark', G.extrude([[-5.5, -0.9], [-5.5, 0], [5, 0], [6.5, -0.4], [2, -1.2], [-4, -1.2]], 1.3, 0.12), mat([0, 0, 0], rotZtoX));
  k.add('glass', G.sphere(1, 24, 12), mat([0, 1.2, 2.8], [0, 0, 0], [0.62, 0.48, 1.7]));
  k.add('dark', G.torus(1, 0.04, 6, 28), mat([0, 1.2, 2.2], [0, 0, 0], [0.63, 0.5, 1]));
  k.add('accent', G.rbox(0.5, 0.3, 5, 0.1), mat([0, 1.55, -2.5]));
  // split X-wings with wingtip cannons
  for (const [y, roll] of [[0.45, 0.24], [-0.45, -0.24]]) {
    const wm = wingMat([0.85, y, -2.4], roll);
    k.addMirrored('hull', G.extrude([[0, 1.5], [5.2, -0.6], [5.6, -2.3], [0, -2.9]], 0.2, 0.06), wm);
    k.addMirrored('accent', G.extrude([[4.3, -0.25], [5.2, -0.6], [5.6, -2.3], [4.7, -2.4]], 0.24, 0.02), wm);
    k.addMirrored('dark', G.extrude([[0.6, -1.6], [4.0, -1.9], [4.1, -2.5], [0.6, -2.7]], 0.25, 0.02), wm);
    const tx = 0.85 + 5.4 * Math.cos(roll), ty = y + 5.4 * Math.sin(roll);
    k.addMirrored('gun', G.cyl(0.09, 0.12, 3.4, 8), mat([tx, ty, -1.4], alongZ));
    k.addMirrored('dark', G.cyl(0.2, 0.2, 1.6, 10), mat([tx, ty, -3.6], alongZ));
  }
  // engine block
  k.add('dark', G.rbox(2.6, 1.8, 2.2, 0.3), mat([0, 0.1, -6.6]));
  for (const x of [0.7, -0.7]) {
    k.add('nozzle', G.lathe([[0.55, 0.2], [0.6, 0], [0.7, -0.5], [0.75, -0.8]], 20), mat([x, 0.1, -7.8], alongZ));
    k.add('engine', G.cyl(0.55, 0.55, 0.05, 16), mat([x, 0.1, -7.85], alongZ));
  }
  k.add('metal', G.cyl(0.03, 0.05, 1.2, 6), mat([0, 1.9, -4.5], [-0.35, 0, 0]));
  scatterGreebles(k, r, 12, { x0: -0.6, x1: 0.6, z0: -5.5, z1: 0.5, y: 1.35, s: 0.25 });
  ship.group.add(k.build(M, { uvTile: { hull: 6, accent: 4, dark: 4 } }));
  for (const x of [0.7, -0.7]) addEngine(ship, M, new THREE.Vector3(x, 0.1, -7.9), 0.55, 8);
  launcherAt(ship, 2.5, -0.9, -1); launcherAt(ship, -2.5, -0.9, -1);
  addLight(ship, new THREE.Vector3(6.1, 1.8, -3.6), 0xff2015, 1.0, 0);
  addLight(ship, new THREE.Vector3(-6.1, 1.8, -3.6), 0x15ff40, 1.0, 0);
  addLight(ship, new THREE.Vector3(0, 1.7, -5.5), 0xffffff, 1.1, 1.4, 0);
  ship.hardpoints = [{ p: [0, 1.5, 0.8], flip: 0, s: 0.6 }, { p: [0, -1.25, -1.5], flip: 1, s: 0.6 }];
  ship.utilMounts = [{ p: [0, 1.72, -4.2], flip: 0, s: 0.36 }];
  ship.cockpit.set(0, 1.5, 3.0);
  ship.radius = 9;
  ship.hitSpheres = [[0, 0, 5, 1.4], [0, 0, 0, 1.8], [0, 0, -5, 1.8], [4, 0, -3, 1.6], [-4, 0, -3, 1.6]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Wisp pathfinder scout (~20 m)
export function buildWisp(env, liv = 'wisp') {
  const M = livery(liv, env);
  const ship = shipBase('Wisp', M);
  const k = new Kit();
  const r = rng(229);
  const rotZtoX = [0, -Math.PI / 2, 0];
  const alongZ = [Math.PI / 2, 0, 0];
  const flat = [Math.PI / 2, 0, 0];
  k.add('hull', G.extrude([[-8, -0.7], [-8, 0.9], [-3, 1.2], [4, 1.0], [9, 0.3], [11, 0], [10.5, -0.3], [4, -0.8], [-5, -0.9]], 1.6, 0.2, 2), mat([0, 0, 0], rotZtoX));
  k.add('dark', G.extrude([[-7.5, -0.8], [-7.5, 0], [8, 0], [9.5, -0.3], [4, -1.0], [-5, -1.1]], 1.2, 0.12), mat([0, 0, 0], rotZtoX));
  k.add('glass', G.sphere(1, 24, 12), mat([0, 1.0, 5.6], [0, 0, 0], [0.58, 0.42, 2.0]));
  k.add('accent', G.rbox(0.4, 0.24, 6, 0.08), mat([0, 1.3, -3.5]));
  // sensor mast and dish
  k.add('metal', G.cyl(0.12, 0.18, 1.6, 8), mat([0, 1.9, -1]));
  k.add('hull', G.lathe([[0.05, 0], [0.9, 0.25], [1.4, 0.55], [1.45, 0.62]], 28), mat([0, 2.75, -1], [0.7, 0, 0]));
  k.add('metal', G.cyl(0.03, 0.03, 1.0, 6), mat([0, 3.15, -0.55], [0.7, 0, 0]));
  k.add('coil', G.sphere(0.1, 10, 8), mat([0, 3.5, -0.2]));
  // outrigger sensor booms on swept pylons
  k.addMirrored('hull', G.extrude([[0, 2], [2.6, 0.5], [2.6, -3], [0, -4]], 0.18, 0.05), mat([0.6, -0.2, -1], flat));
  k.addMirrored('hull', G.rbox(0.9, 0.9, 10, 0.25), mat([3.2, -0.2, -1]));
  k.addMirrored('accent', G.rbox(0.92, 0.25, 7, 0.06), mat([3.2, 0.2, -1]));
  k.addMirrored('dark', G.cyl(0.32, 0.45, 1.4, 12), mat([3.2, -0.2, 4.6], alongZ));
  k.addMirrored('metal', G.cyl(0.02, 0.04, 4.5, 6), mat([3.2, -0.2, 7.4], alongZ));
  k.addMirrored('nozzle', G.lathe([[0.35, 0.15], [0.4, 0], [0.45, -0.4], [0.5, -0.6]], 16), mat([3.2, -0.2, -6.4], alongZ));
  k.addMirrored('engine', G.cyl(0.35, 0.35, 0.04, 14), mat([3.2, -0.2, -6.45], alongZ));
  // main engine
  k.add('dark', G.rbox(1.8, 1.6, 1.8, 0.25), mat([0, 0.1, -8.3]));
  k.add('nozzle', G.lathe([[0.6, 0.2], [0.65, 0], [0.75, -0.6], [0.8, -0.9]], 20), mat([0, 0.1, -9.4], alongZ));
  k.add('engine', G.cyl(0.6, 0.6, 0.05, 16), mat([0, 0.1, -9.45], alongZ));
  k.add('metal', G.cyl(0.02, 0.04, 3.5, 6), mat([0, 0.1, 12.6], alongZ));
  scatterGreebles(k, r, 12, { x0: -0.5, x1: 0.5, z0: -7, z1: 2, y: 1.15, s: 0.22 });
  ship.group.add(k.build(M, { uvTile: { hull: 6, accent: 4, dark: 4 } }));
  addEngine(ship, M, new THREE.Vector3(0, 0.1, -9.5), 0.6, 9);
  for (const x of [3.2, -3.2]) addEngine(ship, M, new THREE.Vector3(x, -0.2, -6.5), 0.35, 5);
  launcherAt(ship, 3.2, -0.8, 2); launcherAt(ship, -3.2, -0.8, 2);
  addLight(ship, new THREE.Vector3(3.2, -0.2, 9.6), 0xff2015, 0.9, 0);
  addLight(ship, new THREE.Vector3(-3.2, -0.2, 9.6), 0x15ff40, 0.9, 0);
  addLight(ship, new THREE.Vector3(0, 3.5, -0.2), 0x9fffd0, 0.9, 0.9, 0);
  ship.hardpoints = [{ p: [0, 1.22, 1.8], flip: 0, s: 0.55 }, { p: [0, -1.12, -2], flip: 1, s: 0.55 }];
  ship.utilMounts = [{ p: [3.2, 0.3, -3], flip: 0, s: 0.34 }, { p: [-3.2, 0.3, -3], flip: 0, s: 0.34 }];
  ship.cockpit.set(0, 1.3, 6.2);
  ship.radius = 11;
  ship.hitSpheres = [[0, 0, 8, 1.4], [0, 0, 2, 1.8], [0, 0, -4, 1.8], [3.2, -0.2, -1, 1.4], [-3.2, -0.2, -1, 1.4]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Mule light freighter (~48 m)
export function buildMule(env, liv = 'mule') {
  const M = livery(liv, env);
  const ship = shipBase('Mule', M);
  const k = new Kit();
  const r = rng(233);
  const rotZtoX = [0, -Math.PI / 2, 0];
  const alongZ = [Math.PI / 2, 0, 0];
  // cab
  k.add('hull', G.extrude([[15, -1], [15, 5], [19, 5.2], [22.5, 3.6], [24.5, 1.2], [24, -0.6], [21, -1.4]], 6, 0.35, 2), mat([0, 0, 0], rotZtoX));
  k.add('glass', G.box(5.4, 1.2, 0.25), mat([0, 4.15, 21.9], [-0.75, 0, 0]));
  k.addMirrored('glass', G.box(0.2, 0.9, 2.4), mat([3.1, 3.4, 19.5]));
  k.add('dark', G.rbox(6.6, 1.2, 5, 0.3), mat([0, -1.2, 19.5]));
  // spine and container grid
  k.add('dark', G.rbox(2.4, 2.4, 36, 0.3), mat([0, 2, -2]));
  const keys = ['hull', 'accent', 'dark', 'hull'];
  for (const z of [11, 3, -5, -13]) {
    for (const x of [2.2, -2.2]) for (const y of [0, 4]) {
      k.add(keys[Math.floor(r() * keys.length)], G.rbox(3.9, 3.9, 7.4, 0.15), mat([x, y, z]));
      for (const e of [-3.65, 3.65]) k.add('dark', G.box(4.05, 4.05, 0.25), mat([x, y, z + e]));
      for (let i = 0; i < 4; i++) k.add('gun', G.box(x > 0 ? 0.08 : 0.08, 3.4, 0.12), mat([x + Math.sign(x) * 1.98, y, z - 2.4 + i * 1.6]));
    }
  }
  // drive section
  k.add('dark', G.rbox(7, 6, 6, 0.6), mat([0, 2, -19.5]));
  k.add('hull', G.rbox(7.2, 1.2, 5, 0.3), mat([0, 4.4, -19.5]));
  for (const x of [1.8, -1.8]) {
    k.add('nozzle', G.lathe([[1.2, 0.4], [1.3, 0], [1.5, -1.0], [1.6, -1.5]], 24), mat([x, 2, -22.6], alongZ));
    k.add('engine', G.cyl(1.2, 1.2, 0.06, 20), mat([x, 2, -22.7], alongZ));
  }
  for (let i = 0; i < 6; i++) k.addMirrored('metal', G.box(4, 0.18, 1.0), mat([5.2, 3.5, -17.5 - i * 0.9], [0, 0, 0.3]));
  k.add('metal', G.cyl(0.08, 0.14, 4, 6), mat([1.6, 7.0, 18]));
  scatterGreebles(k, r, 20, { x0: -2.2, x1: 2.2, z0: -22, z1: -17, y: 5.0, s: 0.5 });
  ship.group.add(k.build(M, { uvTile: { hull: 7, accent: 6, dark: 6 } }));
  for (const x of [1.8, -1.8]) addEngine(ship, M, new THREE.Vector3(x, 2, -22.8), 1.2, 14);
  addLight(ship, new THREE.Vector3(3.3, 0, 23), 0xff2015, 1.6, 0);
  addLight(ship, new THREE.Vector3(-3.3, 0, 23), 0x15ff40, 1.6, 0);
  addLight(ship, new THREE.Vector3(1.6, 9.1, 18), 0xffffff, 1.6, 1.0, 0);
  addLight(ship, new THREE.Vector3(0, 5.2, -16), 0xffa020, 1.4, 0.7, 0.4);
  ship.hardpoints = [{ p: [0, 5.3, 17], flip: 0, s: 0.85 }, { p: [0, 5.05, -20.5], flip: 0, s: 0.85 }];
  ship.utilMounts = [{ p: [2.2, 5.97, 7], flip: 0, s: 0.6 }, { p: [-2.2, 5.97, 7], flip: 0, s: 0.6 }, { p: [2.2, 5.97, -9], flip: 0, s: 0.6 }, { p: [-2.2, 5.97, -9], flip: 0, s: 0.6 }];
  ship.cockpit.set(0, 4.6, 21);
  ship.radius = 25;
  ship.hitSpheres = [[0, 2, 20, 4], [0, 2, 11, 5], [0, 2, 3, 5], [0, 2, -5, 5], [0, 2, -13, 5], [0, 2, -19.5, 4.5]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Atlas bulk freighter (~140 m)
export function buildAtlas(env, liv = 'atlas') {
  const M = livery(liv, env);
  const ship = shipBase('Atlas', M);
  const k = new Kit();
  const r = rng(239);
  const alongZ = [Math.PI / 2, 0, 0];
  // command module
  k.add('hull', G.lathe([[0.1, 74], [3, 72], [7, 66], [9, 58], [9, 48], [7.5, 46]], 32), mat([0, 0, 0], alongZ));
  k.add('dark', G.cyl(9.6, 9.6, 2.4, 32), mat([0, 0, 52], alongZ));
  k.add('accent', G.cyl(9.3, 9.3, 3, 32, true), mat([0, 0, 62], alongZ));
  k.add('hull', G.rbox(12, 4, 9, 0.6), mat([0, 9, 55]));
  k.add('glass', G.box(11.8, 1.0, 0.3), mat([0, 9.6, 59.6]));
  k.add('dark', G.rbox(13, 1.2, 10, 0.3), mat([0, 11.4, 54.5]));
  k.add('metal', G.cyl(0.25, 0.4, 10, 8), mat([3, 17, 52]));
  k.add('dark', G.cyl(2.6, 0.3, 0.6, 18), mat([-3, 13.2, 51], [0.6, 0, 0]));
  // truss spine
  for (const [x, y] of [[3, 3], [-3, 3], [3, -3], [-3, -3]]) k.add('metal', G.cyl(0.6, 0.6, 104, 8), mat([x, y, -2], alongZ));
  for (let z = -52; z <= 48; z += 8) k.add('dark', G.box(7.2, 7.2, 0.8), mat([0, 0, z]));
  // container racks
  const keys = ['hull', 'accent', 'dark', 'hull', 'accent'];
  for (let z = 40; z >= -44; z -= 12) {
    for (const x of [-5.2, 0, 5.2]) for (const y of [-5.2, 0, 5.2]) {
      if (x === 0 && y === 0) continue;
      if (y < 5 && r() < 0.15) continue;
      k.add(keys[Math.floor(r() * keys.length)], G.rbox(5, 5, 11, 0.2), mat([x, y, z]));
      for (const e of [-5.4, 5.4]) k.add('dark', G.box(5.1, 5.1, 0.3), mat([x, y, z + e]));
    }
  }
  // tanks, drive block and radiators
  k.addMirrored('hull', G.sphere(5, 24, 16), mat([7.5, 0, -50]));
  k.addMirrored('dark', G.cyl(5.1, 5.1, 1.2, 24), mat([7.5, 0, -50]));
  k.add('dark', G.rbox(22, 18, 14, 1.5), mat([0, 0, -57]));
  k.add('hull', G.rbox(22.4, 3, 10, 0.5), mat([0, 7.6, -56]));
  const nz = [[5.5, 4.5], [-5.5, 4.5], [5.5, -4.5], [-5.5, -4.5]];
  for (const [x, y] of nz) {
    k.add('nozzle', G.lathe([[3, 0.6], [3.2, 0], [3.7, -2], [4, -3]], 28), mat([x, y, -64.2], alongZ));
    k.add('engine', G.cyl(3, 3, 0.1, 24), mat([x, y, -64.4], alongZ));
  }
  k.addMirrored('metal', G.box(16, 0.4, 10), mat([19, 0, -52], [0, 0, 0.18]));
  for (let i = 0; i < 5; i++) k.addMirrored('dark', G.box(16.2, 0.5, 0.4), mat([19, 0, -56 + i * 2], [0, 0, 0.18]));
  ship.group.add(k.build(M, { uvTile: { hull: 12, accent: 8, dark: 8 } }));
  for (const [x, y] of nz) addEngine(ship, M, new THREE.Vector3(x, y, -64.6), 3, 34);
  addLight(ship, new THREE.Vector3(27, 1.5, -52), 0xff2015, 3.2, 0);
  addLight(ship, new THREE.Vector3(-27, 1.5, -52), 0x15ff40, 3.2, 0);
  addLight(ship, new THREE.Vector3(3, 22.2, 52), 0xffffff, 3.2, 0.9, 0);
  for (const z of [34, 10, -14, -38]) addLight(ship, new THREE.Vector3(0, 8, z), 0xffa020, 2.2, 0.6, z * 0.01);
  ship.hardpoints = [{ p: [0, 12.05, 53], flip: 0, s: 1.3 }, { p: [0, 9.15, -56], flip: 0, s: 1.3 }, { p: [0, -9.05, -57], flip: 1, s: 1.3 }];
  ship.utilMounts = [5.2, -5.2].flatMap((x) => [28, 4, -20].map((z) => ({ p: [x, 7.72, z], flip: 0, s: 1.0 })));
  ship.cockpit.set(0, 11, 58);
  ship.radius = 72;
  ship.hitSpheres = [[0, 0, 64, 9], [0, 0, 50, 10], [0, 0, 34, 10], [0, 0, 16, 10], [0, 0, -2, 10], [0, 0, -20, 10], [0, 0, -38, 10], [0, 0, -56, 13], [19, 0, -52, 7], [-19, 0, -52, 7]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Aurora passenger liner (~120 m)
export function buildAurora(env, liv = 'aurora') {
  const M = livery(liv, env);
  const ship = shipBase('Aurora', M);
  const k = new Kit();
  const alongZ = [Math.PI / 2, 0, 0];
  const rotZtoX = [0, -Math.PI / 2, 0];
  const sq = [1, 1, 0.72];
  k.add('hull', G.lathe([[0.1, 64], [4, 60], [8, 50], [10.5, 36], [11, 10], [10.5, -20], [9, -40], [7, -52]], 48), mat([0, 0, 0], alongZ, sq));
  for (const z of [40, -25]) k.add('accent', G.cyl(11.1, 11.1, 3, 48, true), mat([0, 0, z], alongZ, [1, 1, 0.73]));
  k.add('accent', G.cyl(10.9, 10.9, 1.2, 48, true), mat([0, 0, 36], alongZ, [1, 1, 0.73]));
  // passenger decks: lit window rows along both flanks
  for (const [y, x] of [[-2.6, 10.48], [0, 11.0], [2.6, 10.48]]) {
    k.addMirrored('dark', G.box(0.1, 0.9, 52), mat([x - 0.02, y, 8]));
    for (let z = -17; z <= 33; z += 1.6) k.addMirrored('window', G.box(0.12, 0.5, 0.9), mat([x + 0.02, y, z]));
  }
  // observation dome and promenade
  k.add('glass', G.sphere(6, 32, 16), mat([0, 6.8, 18], [0, 0, 0], [1, 0.42, 1.7]));
  k.add('dark', G.torus(6, 0.3, 6, 40), mat([0, 6.9, 18], [Math.PI / 2, 0, 0], [1, 1.7, 1]));
  k.add('window', G.torus(5.4, 0.12, 4, 40), mat([0, 7.1, 18], [Math.PI / 2, 0, 0], [1, 1.7, 1]));
  // bridge
  k.add('dark', G.rbox(6, 1.6, 5, 0.4), mat([0, 6.8, 46]));
  k.add('glass', G.box(5.6, 0.5, 0.2), mat([0, 7.1, 48.5]));
  // lifeboat pods
  for (let z = -10; z <= 30; z += 8) k.addMirrored('accent', G.rbox(1.6, 1.4, 4, 0.4), mat([8.6, -4.8, z]));
  // tail fin and drive
  k.add('accent', G.extrude([[-50, 4.5], [-38, 4.5], [-30, 13], [-36, 14.5], [-44, 14.5]], 0.8, 0.2), mat([0, 0, 0], rotZtoX));
  k.add('dark', G.cyl(8, 8.5, 6, 32), mat([0, 0, -53], alongZ, [1, 1, 0.8]));
  const nz = [[0, 0.5, 2.4], [4.5, -1.2, 1.8], [-4.5, -1.2, 1.8]];
  for (const [x, y, rad] of nz) {
    k.add('nozzle', G.lathe([[rad, 0.5], [rad * 1.08, 0], [rad * 1.25, -1.6], [rad * 1.32, -2.4]], 28), mat([x, y, -56.2], alongZ));
    k.add('engine', G.cyl(rad, rad, 0.1, 24), mat([x, y, -56.4], alongZ));
  }
  ship.group.add(k.build(M, { uvTile: { hull: 14, accent: 8, dark: 6 } }));
  for (const [x, y, rad] of nz) addEngine(ship, M, new THREE.Vector3(x, y, -56.6), rad, 28);
  addLight(ship, new THREE.Vector3(11.2, 0, 10), 0xff2015, 2.6, 0);
  addLight(ship, new THREE.Vector3(-11.2, 0, 10), 0x15ff40, 2.6, 0);
  addLight(ship, new THREE.Vector3(0, 15, -40), 0xffffff, 2.8, 1.0, 0);
  addLight(ship, new THREE.Vector3(0, -7.6, 20), 0xff3030, 2.0, 0.7, 0.3);
  ship.hardpoints = [{ p: [0, 7.85, -8], flip: 0, s: 1.0 }, { p: [0, -7.45, 38], flip: 1, s: 1.0 }];
  ship.utilMounts = [{ p: [0, 7.2, -28], flip: 0, s: 0.9 }, { p: [0, -7.85, -6], flip: 1, s: 0.9 }, { p: [0, -7.85, 10], flip: 1, s: 0.9 }, { p: [5, 6.8, -12], flip: 0, s: 0.9 }, { p: [-5, 6.8, -12], flip: 0, s: 0.9 }];
  ship.cockpit.set(0, 8.4, 46);
  ship.radius = 62;
  ship.hitSpheres = [[0, 0, 52, 7], [0, 0, 38, 9], [0, 0, 22, 10], [0, 0, 6, 10], [0, 0, -10, 10], [0, 0, -26, 9.5], [0, 0, -42, 8.5], [0, 9, -40, 5]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Sabre light cruiser (~86 m)
export function buildSabre(env, liv = 'sabre') {
  const M = livery(liv, env);
  const ship = shipBase('Sabre', M);
  const k = new Kit();
  const r = rng(241);
  const flat = [Math.PI / 2, 0, 0];
  const alongZ = [Math.PI / 2, 0, 0];
  const outline = [[0, 44], [6, 24], [12, -10], [13, -36], [-13, -36], [-12, -10], [-6, 24]];
  k.add('hull', G.extrude(outline, 6, 0.25), mat([0, 0, 0], flat));
  k.add('dark', G.extrude(outline.map(([x, y]) => [x * 0.6, y * 0.6 - 4]), 3, 0.1), mat([0, 4, 0], flat));
  k.add('dark', G.extrude(outline.map(([x, y]) => [x * 0.5, y * 0.8 - 2]), 3, 0.1), mat([0, -3.5, 0], flat));
  k.addMirrored('accent', G.extrude([[6, 24], [12, -10], [12.4, -20], [11.6, -20], [11.2, -10], [5.4, 23]], 6.3, 0.03), mat([0, 0, 0], flat));
  // command tower
  k.add('hull', G.rbox(6, 5, 10, 0.6), mat([0, 8, -18]));
  k.add('dark', G.rbox(7.4, 1.4, 4.4, 0.3), mat([0, 10.2, -15]));
  k.add('glass', G.box(7.2, 0.5, 0.2), mat([0, 10.3, -12.75]));
  k.add('metal', G.cyl(0.15, 0.25, 7, 8), mat([1.6, 14, -21]));
  k.add('dark', G.cyl(1.8, 0.2, 0.5, 16), mat([-1.4, 11.6, -21], [0.5, 0, 0]));
  // sponsons and armour ribs
  k.addMirrored('dark', G.rbox(3, 4, 16, 0.5), mat([13, 0, -2]));
  k.addMirrored('hull', G.rbox(3.1, 1.0, 12, 0.2), mat([13.05, 1.6, -2]));
  for (let i = 0; i < 6; i++) k.addMirrored('dark', G.box(0.4, 4.6, 1.4), mat([11.6 - i * 0.6, 0, -30 + i * 6]));
  // drive
  k.add('dark', G.rbox(22, 8, 6, 0.8), mat([0, 0, -38]));
  const nz = [-6.5, 0, 6.5];
  for (const x of nz) {
    k.add('nozzle', G.lathe([[2, 0.5], [2.15, 0], [2.5, -1.2], [2.7, -1.9]], 24), mat([x, 0, -41.2], alongZ));
    k.add('engine', G.cyl(2, 2, 0.08, 20), mat([x, 0, -41.4], alongZ));
  }
  k.add('dark', G.extrude([[0, 3], [-6, 0], [-2, -3]], 0.6, 0.1), mat([0, 0, 44], [0, -Math.PI / 2, 0]));
  scatterGreebles(k, r, 50, { x0: -3.5, x1: 3.5, z0: -12, z1: 20, y: 5.6, s: 0.9 });
  ship.group.add(k.build(M, { uvTile: { hull: 10, accent: 7, dark: 7 } }));
  for (const x of nz) addEngine(ship, M, new THREE.Vector3(x, 0, -41.6), 2, 22);
  launcherAt(ship, 8, -2, 14); launcherAt(ship, -8, -2, 14);
  addLight(ship, new THREE.Vector3(14.6, 0, -2), 0xff2015, 2.2, 0);
  addLight(ship, new THREE.Vector3(-14.6, 0, -2), 0x15ff40, 2.2, 0);
  addLight(ship, new THREE.Vector3(1.6, 17.6, -21), 0xffffff, 2.4, 1.1, 0);
  ship.hardpoints = [
    { p: [0, 5.65, 14], flip: 0, s: 1.1 }, { p: [13, 2.12, -2], flip: 0, s: 0.9 }, { p: [-13, 2.12, -2], flip: 0, s: 0.9 },
    { p: [0, 5.65, 2], flip: 0, s: 1.1 }, { p: [0, 10.62, -18], flip: 0, s: 0.95 },
  ];
  ship.utilMounts = [{ p: [2.5, -5.12, 10], flip: 1, s: 0.8 }, { p: [-2.5, -5.12, 10], flip: 1, s: 0.8 }, { p: [3.5, -5.12, -14], flip: 1, s: 0.8 }, { p: [-3.5, -5.12, -14], flip: 1, s: 0.8 }];
  ship.cockpit.set(0, 11, -14);
  ship.radius = 44;
  ship.hitSpheres = [[0, 0, 34, 5], [0, 0, 22, 8], [0, 0, 8, 10], [0, 0, -8, 12], [0, 0, -24, 12], [0, 0, -36, 9], [13, 0, -2, 4], [-13, 0, -2, 4], [0, 8, -18, 5]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Sovereign battleship (~185 m)
export function buildSovereign(env, liv = 'sovereign') {
  const M = livery(liv, env);
  const ship = shipBase('Sovereign', M);
  const k = new Kit();
  const r = rng(251);
  const rotZtoX = [0, -Math.PI / 2, 0];
  const alongZ = [Math.PI / 2, 0, 0];
  k.add('hull', G.extrude([[-84, -12], [-84, 12], [-50, 14], [40, 13], [72, 8], [92, 2], [92, -2], [72, -9], [30, -14], [-60, -14]], 26, 1.0, 2), mat([0, 0, 0], rotZtoX));
  k.add('dark', G.extrude([[-80, -13], [-80, 0], [70, 0], [84, -6], [60, -18], [-60, -18]], 20, 0.5), mat([0, 0, 0], rotZtoX));
  // armour belts
  k.addMirrored('dark', G.rbox(4, 14, 120, 1), mat([14, -1, -5]));
  k.addMirrored('accent', G.rbox(4.2, 2.5, 100, 0.4), mat([14.1, 6, -5]));
  for (let i = 0; i < 10; i++) k.addMirrored('hull', G.box(0.8, 12, 3), mat([16.1, -1, -55 + i * 11]));
  for (let i = 0; i < 4; i++) k.addMirrored('light', G.box(0.3, 1, 5), mat([16.2, -6, -40 + i * 26]));
  // gun deck and command tower
  k.add('hull', G.rbox(18, 3, 70, 0.8), mat([0, 15, 5]));
  k.add('accent', G.rbox(18.2, 0.6, 6, 0.2), mat([0, 16.4, 38]));
  k.add('hull', G.rbox(12, 10, 22, 1), mat([0, 21, -40]));
  k.add('dark', G.rbox(16, 3, 10, 0.5), mat([0, 27, -36]));
  k.add('glass', G.box(15.8, 0.9, 0.3), mat([0, 27.3, -30.9]));
  k.add('metal', G.cyl(0.3, 0.5, 14, 8), mat([3, 35, -40]));
  k.add('metal', G.cyl(0.25, 0.4, 10, 8), mat([-3, 33, -42]));
  k.add('dark', G.cyl(4, 0.4, 1, 24), mat([0, 30.5, -44], [0.5, 0, 0]));
  // prow ram
  k.add('dark', G.extrude([[0, 6], [-14, 0], [-4, -6]], 3, 0.3), mat([0, -2, 92], [0, -Math.PI / 2, 0]));
  // drive block
  k.add('dark', G.rbox(34, 24, 12, 2), mat([0, 0, -88]));
  const nz = [];
  for (const x of [-10, 0, 10]) for (const y of [-5.5, 5.5]) nz.push([x, y]);
  for (const [x, y] of nz) {
    k.add('nozzle', G.lathe([[3.6, 0.6], [3.9, 0], [4.4, -2.2], [4.7, -3.4]], 28), mat([x, y, -94.6], alongZ));
    k.add('engine', G.cyl(3.6, 3.6, 0.1, 24), mat([x, y, -94.8], alongZ));
  }
  for (let i = 0; i < 10; i++) k.addMirrored('metal', G.box(12, 0.4, 2), mat([20, 8, -70 - i * 1.8], [0, 0, 0.35]));
  scatterGreebles(k, r, 120, { x0: -8, x1: 8, z0: -28, z1: 38, y: 16.5, s: 2.0 });
  ship.group.add(k.build(M, { uvTile: { hull: 16, accent: 10, dark: 10 } }));
  for (const [x, y] of nz) addEngine(ship, M, new THREE.Vector3(x, y, -95), 3.6, 44);
  launcherAt(ship, 16, -6, 60); launcherAt(ship, -16, -6, 60);
  addLight(ship, new THREE.Vector3(16.5, 6, 40), 0xff2015, 4, 0);
  addLight(ship, new THREE.Vector3(-16.5, 6, 40), 0x15ff40, 4, 0);
  addLight(ship, new THREE.Vector3(3, 42.2, -40), 0xffffff, 4.2, 0.9, 0);
  addLight(ship, new THREE.Vector3(0, -18.6, -20), 0xff3030, 3.2, 0.7, 0.5);
  ship.hardpoints = [
    { p: [0, 16.55, 34], flip: 0, s: 2.0 }, { p: [0, 16.55, 18], flip: 0, s: 2.0 }, { p: [0, 16.55, 2], flip: 0, s: 2.0 },
    { p: [9, 13.6, -62], flip: 0, s: 1.5 }, { p: [-9, 13.6, -62], flip: 0, s: 1.5 },
    { p: [14, 7.3, 20], flip: 0, s: 1.4 }, { p: [-14, 7.3, 20], flip: 0, s: 1.4 },
    { p: [6, -18.55, 10], flip: 1, s: 1.3 }, { p: [-6, -18.55, 10], flip: 1, s: 1.3 },
  ];
  ship.utilMounts = [
    { p: [6, 16.55, 26], flip: 0, s: 1.2 }, { p: [-6, 16.55, 26], flip: 0, s: 1.2 }, { p: [6, 16.55, -14], flip: 0, s: 1.2 }, { p: [-6, 16.55, -14], flip: 0, s: 1.2 },
    { p: [0, -18.55, -30], flip: 1, s: 1.2 }, { p: [0, -18.55, 40], flip: 1, s: 1.2 },
  ];
  ship.cockpit.set(0, 29, -36);
  ship.radius = 92;
  ship.hitSpheres = [[0, 0, 82, 8], [0, 0, 64, 12], [0, 0, 46, 15], [0, 0, 28, 16], [0, 0, 10, 16], [0, 0, -8, 16], [0, 0, -26, 16], [0, 0, -44, 16], [0, 0, -62, 15], [0, 0, -84, 14], [0, 21, -40, 8]];
  return addGreebles(ship);
}

// ---------------------------------------------------------------- Leviathan superheavy dreadnought (~270 m)
export function buildLeviathan(env, liv = 'leviathan') {
  const M = livery(liv, env);
  const ship = shipBase('Leviathan', M);
  const k = new Kit();
  const r = rng(257);
  const rotZtoX = [0, -Math.PI / 2, 0];
  const alongZ = [Math.PI / 2, 0, 0];
  k.add('hull', G.extrude([[-118, -16], [-118, 18], [-70, 22], [60, 20], [100, 12], [128, 6], [128, -6], [100, -12], [40, -20], [-80, -20]], 40, 1.5, 2), mat([0, 0, 0], rotZtoX));
  k.add('dark', G.extrude([[-112, -18], [-112, 0], [96, 0], [110, -6], [80, -24], [-90, -24]], 30, 0.8), mat([0, 0, 0], rotZtoX));
  // spinal siege lance
  k.add('dark', G.rbox(14, 14, 48, 1.5), mat([0, 0, 124]));
  k.add('metal', G.cyl(3.2, 3.6, 30, 24), mat([0, 0, 160], alongZ));
  for (let i = 0; i < 6; i++) {
    k.add('dark', G.cyl(5.4, 5.4, 1.6, 24), mat([0, 0, 148 + i * 4.4], alongZ));
    k.add('coil', G.cyl(5.5, 5.5, 0.5, 24, true), mat([0, 0, 149.4 + i * 4.4], alongZ));
  }
  k.add('coil', G.cyl(2.6, 2.6, 0.2, 20), mat([0, 0, 175.1], alongZ));
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) k.add('hull', G.box(2, 2, 40), mat([Math.cos(a) * 7.6, Math.sin(a) * 7.6, 124]));
  // layered flank armour, hangar recesses
  k.addMirrored('dark', G.rbox(6, 26, 170, 1.5), mat([21, 0, -5]));
  k.addMirrored('accent', G.rbox(6.2, 3, 150, 0.5), mat([21.1, 10, -5]));
  for (let i = 0; i < 14; i++) k.addMirrored('hull', G.box(1, 20, 4), mat([24.2, -1, -80 + i * 11.5]));
  for (const z of [40, 10]) {
    k.addMirrored('gun', G.box(0.6, 10, 22), mat([24.8, -4, z]));
    k.addMirrored('light', G.box(0.4, 0.5, 20), mat([25.1, 1.4, z]));
    k.addMirrored('amber', G.box(0.4, 0.4, 20), mat([25.1, -9.4, z]));
  }
  // decks and command spire
  k.add('hull', G.rbox(28, 5, 120, 1), mat([0, 22.5, 0]));
  k.add('accent', G.rbox(28.2, 0.8, 8, 0.2), mat([0, 25, 52]));
  k.add('dark', G.rbox(18, 5, 60, 1), mat([0, 27.5, -30]));
  k.add('hull', G.rbox(14, 12, 20, 1.2), mat([0, 36, -60]));
  k.add('dark', G.rbox(20, 3.5, 12, 0.6), mat([0, 43.5, -56]));
  k.add('glass', G.box(19.8, 1.0, 0.3), mat([0, 43.8, -49.9]));
  k.add('metal', G.cyl(0.4, 0.6, 8, 8), mat([4, 49, -60]));
  k.add('metal', G.cyl(0.3, 0.5, 6, 8), mat([-4, 48, -62]));
  k.add('dark', G.cyl(5, 0.5, 1.2, 24), mat([0, 46, -63], [0.5, 0, 0]));
  // drive block and radiator wings
  k.add('dark', G.rbox(52, 36, 16, 2), mat([0, 0, -124]));
  const nz = [];
  for (const x of [-15, 0, 15]) for (const y of [-10, 0, 10]) nz.push([x, y]);
  for (const [x, y] of nz) {
    k.add('nozzle', G.lathe([[4.2, 0.6], [4.5, 0], [5.1, -2.6], [5.4, -4]], 28), mat([x, y, -132.6], alongZ));
    k.add('engine', G.cyl(4.2, 4.2, 0.1, 24), mat([x, y, -132.8], alongZ));
  }
  k.addMirrored('metal', G.box(30, 0.6, 40), mat([40, 0, -86], [0, 0, 0.15]));
  for (let i = 0; i < 8; i++) k.addMirrored('dark', G.box(30.4, 0.8, 0.8), mat([40, 0, -103 + i * 5], [0, 0, 0.15]));
  scatterGreebles(k, r, 160, { x0: -13, x1: 13, z0: -58, z1: 58, y: 25, s: 2.6 });
  ship.group.add(k.build(M, { uvTile: { hull: 18, accent: 12, dark: 12 } }));
  for (const [x, y] of nz) addEngine(ship, M, new THREE.Vector3(x, y, -133), 4.2, 56);
  for (const y of [-8, 8]) { launcherAt(ship, 25, y, 80); launcherAt(ship, -25, y, 80); }
  addLight(ship, new THREE.Vector3(55, 4, -86), 0xff2015, 5, 0);
  addLight(ship, new THREE.Vector3(-55, 4, -86), 0x15ff40, 5, 0);
  addLight(ship, new THREE.Vector3(4, 53.2, -60), 0xffffff, 5, 0.8, 0);
  addLight(ship, new THREE.Vector3(0, -24.6, -20), 0xff3030, 4, 0.6, 0.5);
  ship.hardpoints = [
    { p: [8, 25.05, 48], flip: 0, s: 2.4 }, { p: [-8, 25.05, 48], flip: 0, s: 2.4 },
    { p: [8, 25.05, 26], flip: 0, s: 2.2 }, { p: [-8, 25.05, 26], flip: 0, s: 2.2 }, { p: [8, 25.05, 6], flip: 0, s: 2.2 }, { p: [-8, 25.05, 6], flip: 0, s: 2.2 },
    { p: [5, 30.05, -12], flip: 0, s: 1.8 }, { p: [-5, 30.05, -12], flip: 0, s: 1.8 },
    { p: [17, 21.85, 40], flip: 0, s: 1.6 }, { p: [-17, 21.85, 40], flip: 0, s: 1.6 },
    { p: [10, -24.85, 20], flip: 1, s: 1.6 }, { p: [-10, -24.85, 20], flip: 1, s: 1.6 },
  ];
  ship.utilMounts = [
    { p: [0, -24.85, -40], flip: 1, s: 1.4 }, { p: [0, -24.85, 60], flip: 1, s: 1.4 },
    { p: [11, 25.05, -40], flip: 0, s: 1.4 }, { p: [-11, 25.05, -40], flip: 0, s: 1.4 },
    { p: [11, 25.05, 38], flip: 0, s: 1.4 }, { p: [-11, 25.05, 38], flip: 0, s: 1.4 },
    { p: [0, 42.05, -67], flip: 0, s: 1.4 },
  ];
  ship.cockpit.set(0, 46, -56);
  ship.radius = 130;
  ship.hitSpheres = [[0, 0, 160, 6], [0, 0, 128, 10], [0, 0, 106, 16], [0, 0, 84, 20], [0, 0, 60, 22], [0, 0, 36, 24], [0, 0, 12, 24], [0, 0, -12, 24], [0, 0, -36, 24], [0, 0, -60, 24], [0, 0, -84, 24], [0, 0, -108, 22], [0, 0, -124, 20], [0, 36, -60, 10], [40, 0, -86, 12], [-40, 0, -86, 12]];
  return addGreebles(ship);
}
