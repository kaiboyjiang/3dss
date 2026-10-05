import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
    pirate: { base: [74, 76, 80], accent: [168, 28, 22], second: [24, 24, 26], eng: [1.0, 0.45, 0.2], labels: ['XX', 'KILL', 'CR-9', '666', 'RCS'], seed: 9, wear: 0.85, rust: 0.9 },
    cruiser: { base: [96, 84, 74], accent: [176, 34, 26], second: [30, 28, 28], eng: [1.0, 0.4, 0.18], labels: ['CORSAIR', 'BAY', 'C-01', 'HAZARD'], seed: 13, wear: 1.0, rust: 1.0 },
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
    cutlass: { base: [88, 82, 74], accent: [214, 160, 30], second: [26, 24, 22], eng: [1.0, 0.5, 0.22], labels: ['CUTLASS', 'XX', 'SCRAP', '13', 'NO STEP'], seed: 191, wear: 1.0, rust: 1.0 },
    reaver: { base: [40, 40, 42], accent: [190, 24, 20], second: [16, 16, 18], eng: [1.0, 0.36, 0.16], labels: ['REAVER', 'BLOOD', 'R-66', 'RAM', 'HAZARD'], seed: 201, wear: 0.9, rust: 0.7 },
    ravager: { base: [70, 62, 56], accent: [150, 120, 96], second: [22, 20, 20], eng: [1.0, 0.32, 0.14], labels: ['RAVAGER', 'WARLORD', 'CLAN', 'KILL', 'HAZARD', '0666'], seed: 211, wear: 1.0, rust: 0.9 },
    combine: { base: [62, 64, 68], accent: [206, 168, 38], second: [26, 26, 28], eng: [1.0, 0.82, 0.42], labels: ['VANTA', 'COMBINE', 'PROPERTY OF VANTA', 'ASSET 00417', 'COMPLY', 'UNIT'], seed: 221, wear: 0.12 },
    navy: { base: [72, 84, 98], accent: [230, 232, 236], second: [28, 32, 38], eng: [0.5, 0.8, 1.0], labels: ['HELION', 'NAVY', 'HN-12', 'RCS'], seed: 71, wear: 0.35 },
  }[name];
  const h = hullMaps({ seed: L.seed, base: L.base, accent: L.accent, accentChance: 0.05, darkChance: 0.08, wear: L.wear, labels: L.labels, rust: L.rust || 0 });
  const a = hullMaps({ seed: L.seed + 1, base: L.accent, accent: L.base, accentChance: 0.0, darkChance: 0.05, wear: L.wear * 0.8, labels: L.labels, size: 512, rust: (L.rust || 0) * 0.7 });
  const d = hullMaps({ seed: L.seed + 2, base: L.second, accent: [80, 80, 80], accentChance: 0.1, darkChance: 0.2, wear: L.wear, size: 512, rust: (L.rust || 0) * 0.5 });
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
  g.userData.shared = true;
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
export function buildTurret(M, kind = 'laser', scale = 1, fixed = false) {
  const root = new THREE.Group();
  const yaw = new THREE.Group();
  const pitch = new THREE.Group();
  root.add(yaw); yaw.add(pitch);
  let kb = new Kit(), ky = new Kit();
  const kp = new Kit();
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
  if (fixed) { kb = gunCasing(kind, pitch.position.y); ky = new Kit(); }
  root.add(kb.build(M));
  if (Object.keys(ky.parts).length) yaw.add(ky.build(M));
  pitch.add(kp.build(M));
  root.scale.setScalar(scale);
  const recoilDist = { laser: 0.35, rail: 0.8, auto: 0.06, plasma: 0.55, flak: 0.25, beam: 0.15, gauss: 0.9, scatter: 0.4 }[kind];
  return { root, yaw, pitch, muzzles, barrels, kind, recoil: barrels.map(() => 0), baseZ: barrels.map((b) => b.position.z), recoilDist, rotor: kind === 'auto' ? barrels[0] : null, spin: 0, next: 0, fixed };
}

// Fixed gun: a low armoured casing faired into the hull; only the barrels gimbal a few degrees inside it.
function gunCasing(kind, h) {
  const k = new Kit();
  const heavy = kind === 'gauss' || kind === 'plasma' || kind === 'rail';
  const w = heavy ? 2.1 : 1.6, L = heavy ? 4.4 : 3.4, z0 = -L * 0.62;
  k.add('hull', G.loft([[z0, w * 0.55, h * 0.45, 0.02, 0, 2.6], [z0 + L * 0.3, w, h + 0.32, 0.02, 0, 3.2], [z0 + L * 0.78, w, h + 0.28, 0.02, 0, 3.2], [z0 + L, w * 0.62, h + 0.12, 0.02, 0, 2.6]], 20), mat());
  k.add('accent', G.box(w * 0.28, 0.06, L * 0.5), mat([0, h + 0.33, z0 + L * 0.5]));
  k.addMirrored('dark', G.box(0.16, 0.34, L * 0.86), mat([w / 2 - 0.02, 0.17, z0 + L * 0.5]));
  k.add('dark', G.cyl(0.42, 0.42, 0.3, 16), mat([0, h, z0 + L], [Math.PI / 2, 0, 0]));
  k.add('gun', G.box(w * 0.7, 0.12, 0.4), mat([0, 0.06, z0 + 0.2]));
  return k;
}

export function buildGun(M, kind = 'laser', scale = 1) {
  return buildTurret(M, kind, scale, true);
}

// Missile bay: armoured box flush with the hull, a grid of hatched launch cells and hazard trim.
export function buildMissileBay(M, O, scale = 1) {
  const root = new THREE.Group(), k = new Kit(), tubes = [];
  const n = O.tubes, cols = n >= 6 ? 3 : n >= 2 ? 2 : 1, rows = Math.ceil(n / cols);
  const torp = O.bay === 'torp';
  const cw = torp ? 1.3 : n >= 6 ? 0.62 : 0.9, cl = torp ? 3.2 : cw;
  const W = cols * cw + 0.5, L = rows * cl + 0.5, H = torp ? 0.6 : 0.45;
  k.add('dark', G.rbox(W + 0.4, H, L + 0.4, 0.1), mat([0, H / 2, 0]));
  k.add('hull', G.rbox(W, 0.1, L, 0.04), mat([0, H + 0.03, 0]));
  const stripes = Math.max(2, Math.round(L / 0.42));
  for (let i = 0; i < stripes; i++) k.addMirrored(i % 2 ? 'accent' : 'gun', G.box(0.14, 0.06, L / stripes), mat([W / 2 + 0.08, H + 0.01, -L / 2 + (i + 0.5) * (L / stripes)]));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r * cols + c >= n) continue;
      const x = (c - (cols - 1) / 2) * cw, z = (r - (rows - 1) / 2) * cl;
      k.add('gun', G.box(cw * 0.86, 0.08, cl * 0.86), mat([x, H + 0.09, z]));
      k.add('metal', G.box(cw * 0.7, 0.06, cl * 0.7), mat([x, H + 0.15, z]));
      k.add('dark', G.box(cw * 0.1, 0.08, cl * 0.6), mat([x, H + 0.2, z]));
      const o = new THREE.Object3D(); o.position.set(x, H + 0.4, z); root.add(o); tubes.push(o);
    }
  }
  k.add('amber', G.box(0.16, 0.08, 0.16), mat([W / 2 - 0.1, H + 0.1, L / 2 + 0.05]));
  root.add(k.build(M));
  root.scale.setScalar(scale);
  return { root, tubes, next: 0, side: 0 };
}

function shipBase(name, M) {
  return { name, group: new THREE.Group(), turrets: [], guns: [], launchers: [], gunMounts: [], turretMounts: [], missileBays: [], slots: null, style: 'std', engines: [], navLights: [], M, radius: 10, hitSpheres: [], hardpoints: [], utilMounts: [], cockpit: new THREE.Vector3(0, 2, 6) };
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
  const style = ship.style;
  const asym = style === 'pirate';
  const tries = Math.round(THREE.MathUtils.clamp(R * 9, 90, 1100) * ({ sleek: 0.4, pirate: 1.2, armor: 0.9 }[style] || 1));
  const big = R > 30;
  const excl = [
    ...ship.hardpoints.map((h) => [new THREE.Vector3().fromArray(h.p), 2.6 * h.s + base]),
    ...(ship.slots ? ship.slots.m.map((h) => [new THREE.Vector3().fromArray(h.p), 3 * h.s + base]) : []),
    ...ship.utilMounts.map((h) => [new THREE.Vector3().fromArray(h.p), 2.2 * h.s + base]),
    ...ship.launchers.map((o) => [o.position.clone(), base * 4]),
    ...ship.engines.map((e) => [e.plume.position.clone(), e.radius * 1.8]),
  ];
  const k = new Kit();
  const { min, max } = S;
  for (let i = 0; i < tries; i++) {
    const q = r();
    const [a, s] = q < 0.45 ? [1, 1] : q < 0.8 ? [0, asym && r() < 0.5 ? -1 : 1] : [1, -1];
    const u = (a + 1) % 3, v = (a + 2) % 3;
    const pu = min[u] + r() * (max[u] - min[u]);
    // sample the port half only; everything is mirrored to starboard
    const pv = a === 1 && !asym ? r() * max[v] : min[v] + r() * (max[v] - min[v]);
    const hit = S.cast(a, s, pu, pv);
    if (!hit || excl.some(([c, d]) => c.distanceTo(hit.p) < d)) continue;
    const t = r();
    const kind = style === 'sleek' ? (t < 0.55 ? 'plate' : t < 0.8 ? 'vent' : t < 0.9 ? 'dome' : big ? 'windows' : 'vent')
      : style === 'armor' ? (t < 0.6 ? 'armor' : t < 0.72 ? 'vent' : t < 0.82 ? 'cluster' : t < 0.9 ? 'pipe' : big ? 'windows' : 'armor')
      : asym && t < 0.3 ? 'scrap' : asym && t < 0.38 ? 'girder' : t < 0.32 ? 'plate' : t < 0.46 ? 'vent' : t < 0.6 ? 'pipe' : t < 0.68 ? 'dome' : t < 0.76 ? (a === 1 && s === 1 ? 'mast' : 'cluster') : t < 0.88 ? 'cluster' : big ? 'windows' : 'plate';
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
      if (!asym && Math.abs(hit.p.x) > e + base) k.addMirrored(key, geo, m); else k.add(key, geo, m);
    };
    if (kind === 'scrap') {
      // welded-on patch plate, slightly skewed, with a weld bead along one edge
      const h = base * (0.12 + r() * 0.3), pw = w * (1.2 + r()), pd = d * (1.1 + r());
      add(['hull', 'accent', 'dark', 'dark'][Math.floor(r() * 4)], G.box(pw, h, pd), mat([0, h / 2, 0], [(r() - 0.5) * 0.12, (r() - 0.5) * 0.9, (r() - 0.5) * 0.12]));
      add('metal', G.box(pw * 1.02, h * 0.5, base * 0.12), mat([0, h, pd * 0.48]));
      if (r() < 0.5) for (let j = 0; j < 3; j++) add('gun', G.cyl(base * 0.09, base * 0.09, h * 0.6, 6), mat([(j - 1) * pw * 0.35, h, -pd * 0.4]));
    } else if (kind === 'girder') {
      const gl = d * 1.6, gh = base * (0.5 + r() * 0.6);
      for (const x of [-w * 0.35, w * 0.35]) add('metal', G.box(base * 0.14, base * 0.14, gl), mat([x, gh, 0]));
      for (let j = 0; j < 4; j++) add('dark', G.box(w * 0.75, base * 0.1, base * 0.1), mat([0, gh, -gl / 2 + (j + 0.5) * gl / 4], [0, 0, (j % 2 ? 0.5 : -0.5)]));
      for (const z of [-gl * 0.45, gl * 0.45]) add('gun', G.box(w * 0.8, gh, base * 0.2), mat([0, gh / 2, z]));
    } else if (kind === 'armor') {
      const h = base * (0.5 + r() * 0.6), pw = w * 1.5, pd = d * 1.4;
      add(r() < 0.55 ? 'dark' : 'hull', G.rbox(pw, h, pd, Math.min(h * 0.4, base * 0.3)), mat([0, h / 2, 0]));
      add('gun', G.box(pw * 0.92, base * 0.1, base * 0.12), mat([0, h, pd * 0.32]));
      add('gun', G.box(pw * 0.92, base * 0.1, base * 0.12), mat([0, h, -pd * 0.32]));
    } else if (kind === 'plate') {
      const h = base * (style === 'sleek' ? 0.06 + r() * 0.1 : 0.15 + r() * 0.35);
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

function addGreebles(ship, S0) {
  const S = S0 || surfaceGrid(ship.group);
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
  ship.style = 'pirate';
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
  ship.style = 'pirate';
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
  ship.style = 'pirate';
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
  ship.style = 'pirate';
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
  ship.style = 'pirate';
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
// Bakes every opaque part that never moves relative to the hull into one mesh per material and shadow
// setting, so a ship costs a handful of draw calls instead of dozens. Aiming turret heads stay separate.
export function mergeStatic(ship) {
  const g = ship.group;
  const moving = new Set([...ship.turrets, ...ship.gunMounts, ...ship.turretMounts].map((t) => t.yaw));
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const bins = new Map();
  g.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.renderOrder || !o.visible || Array.isArray(o.material)) return;
    const m = o.material, a = o.geometry.attributes;
    if (m.transparent || !(m.isMeshStandardMaterial || m.isMeshBasicMaterial)) return;
    if (o.geometry.index || o.geometry.morphAttributes.position || Object.keys(a).sort().join() !== 'normal,position,uv') return;
    for (let p = o.parent; p !== g; p = p.parent) if (!p || moving.has(p) || !p.visible) return;
    const xf = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    if (xf.determinant() <= 0) return;
    const key = `${m.uuid}|${o.castShadow}|${o.receiveShadow}`;
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push([o, xf]);
  });
  for (const list of bins.values()) {
    if (list.length < 2) continue;
    const geo = mergeGeometries(list.map(([o, xf]) => (o.geometry.userData.shared ? o.geometry.clone() : o.geometry).applyMatrix4(xf)), false);
    if (!geo) continue;
    geo.computeBoundingSphere();
    const [o0] = list[0];
    const mesh = new THREE.Mesh(geo, o0.material);
    mesh.name = o0.name;
    mesh.castShadow = o0.castShadow;
    mesh.receiveShadow = o0.receiveShadow;
    for (const [o] of list) {
      o.removeFromParent();
      if (!o.geometry.userData.shared) o.geometry.dispose();
    }
    g.add(mesh);
  }
  return ship;
}

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
  return design(env, liv, DESIGNS.kestrel);
}

// ---------------------------------------------------------------- Warden destroyer (~66 m)
export function buildWarden(env, liv = 'warden') {
  return design(env, liv, DESIGNS.warden);
}

// ---------------------------------------------------------------- Paladin battlecruiser (~118 m)
export function buildPaladin(env, liv = 'paladin') {
  return design(env, liv, DESIGNS.paladin);
}

// ---------------------------------------------------------------- Mantis gunship (~38 m)
export function buildMantis(env, liv = 'mantis') {
  return design(env, liv, DESIGNS.mantis);
}

// ---------------------------------------------------------------- Corvid stealth corvette (~26 m)
export function buildCorvid(env, liv = 'corvid') {
  return design(env, liv, DESIGNS.corvid);
}

// ---------------------------------------------------------------- Bastion heavy cruiser (~96 m)
export function buildBastion(env, liv = 'bastion') {
  return design(env, liv, DESIGNS.bastion);
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
    case 'engine':
      k.add('dark', G.rbox(2.0, 0.35, 3.0, 0.08), mat([0, 0.18, 0]));
      k.add('hull', G.cyl(0.7, 0.8, 2.0, 24), mat([0, 0.95, 0.4], [Math.PI / 2, 0, 0]));
      for (let i = 0; i < 3; i++) k.add('metal', G.torus(0.78, 0.06, 8, 28), mat([0, 0.95, -0.2 + i * 0.5]));
      k.add('nozzle', G.lathe([[0.55, 0.4], [0.6, 0], [0.8, -0.5], [0.9, -0.9]], 28), mat([0, 0.95, -0.7], [Math.PI / 2, 0, 0]));
      k.add('amber', G.cyl(0.55, 0.55, 0.04, 24), mat([0, 0.95, -0.72], [Math.PI / 2, 0, 0]));
      k.add('accent', G.rbox(0.8, 0.3, 0.9, 0.06), mat([0, 1.75, 0.6]));
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
  return design(env, liv, DESIGNS.hornet);
}

// ---------------------------------------------------------------- Wisp pathfinder scout (~20 m)
export function buildWisp(env, liv = 'wisp') {
  return design(env, liv, DESIGNS.wisp);
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
  return design(env, liv, DESIGNS.aurora);
}

// ---------------------------------------------------------------- Sabre light cruiser (~86 m)
export function buildSabre(env, liv = 'sabre') {
  return design(env, liv, DESIGNS.sabre);
}

// ---------------------------------------------------------------- Sovereign battleship (~185 m)
export function buildSovereign(env, liv = 'sovereign') {
  return design(env, liv, DESIGNS.sovereign);
}

// ---------------------------------------------------------------- Leviathan superheavy dreadnought (~270 m)
export function buildLeviathan(env, liv = 'leviathan') {
  return design(env, liv, DESIGNS.leviathan);
}

// ---------------------------------------------------------------- Vanta Combine mass-production hulls
// every Combine hull is assembled from the same few stamped parts: chamfered box sections, square engine pods and hazard bands
const COMBINE = {
  unit: {
    name: 'Unit-7', radius: 8, cockpit: [0, 1.0, 4.2],
    segs: [[2.0, 1.4, 4, 2.5], [2.4, 1.6, 4, -1.5]], nose: [1.4, 0.9, 2.4, 5.6], bridge: [1.2, 0.5, 1.6, 3.2, 0.7],
    wings: { span: 8, t: 0.22, chord: 2.6, z: -1.5 }, engines: { R: 0.45, xs: [0.7, -0.7], ys: [0], z: -4.3 },
    hp: [{ p: [0, 0.72, 2.2], flip: 0, s: 0.5 }, { p: [0, -0.82, -1.5], flip: 1, s: 0.5 }],
    util: [{ p: [0, 0.82, -2.6], flip: 0, s: 0.32 }],
  },
  enforcer: {
    name: 'Enforcer', radius: 18, cockpit: [0, 3.1, 9],
    segs: [[5, 3.4, 7, 9], [6, 4, 7, 2], [6, 4, 7, -5], [5, 3.6, 5, -11]], nose: [3.4, 2.2, 5, 14.5], bridge: [3, 1.2, 3, 9, 1.7],
    sponsons: { x: 3.9, w: 1.8, h: 2.4, l: 12, z: -2 }, engines: { R: 0.9, xs: [1.4, -1.4], ys: [1.0, -1.0], z: -14.2 },
    hp: [{ p: [0, 2.02, 4], flip: 0, s: 0.75 }, { p: [0, 2.02, -4], flip: 0, s: 0.75 }, { p: [0, -2.02, 0], flip: 1, s: 0.75 }],
    util: [{ p: [3.9, 1.22, -5], flip: 0, s: 0.45 }, { p: [-3.9, 1.22, -5], flip: 0, s: 0.45 }],
  },
  compliance: {
    name: 'Compliance', radius: 50, cockpit: [0, 15, -9],
    segs: [[14, 10, 16, 30], [18, 12, 18, 13], [18, 12, 18, -6], [16, 11, 16, -24]], nose: [10, 6, 14, 44], bridge: [8, 8, 10, -10, 6], tower: true,
    sponsons: { x: 12, w: 5, h: 8, l: 40, z: -4 }, engines: { R: 2.2, xs: [5, 0, -5], ys: [2.6, -2.6], z: -34.5 },
    hp: [{ p: [0, 5.05, 30], flip: 0, s: 1.4 }, { p: [0, 6.05, 8], flip: 0, s: 1.6 }, { p: [12, 4.05, 6], flip: 0, s: 1.2 }, { p: [-12, 4.05, 6], flip: 0, s: 1.2 }, { p: [0, -6.05, 0], flip: 1, s: 1.4 }],
    util: [{ p: [12, 4.05, -14], flip: 0, s: 0.9 }, { p: [-12, 4.05, -14], flip: 0, s: 0.9 }, { p: [0, -6.05, -16], flip: 1, s: 0.9 }],
  },
  crate: {
    name: 'Crate', radius: 46, cockpit: [0, 5, 38],
    segs: [[10, 8, 10, 38], [12, 10, 8, -34]], spine: [3, 3, 66, 2], nose: [7, 5, 4, 44.5], bridge: [8, 0.8, 0.3, 42.6, 2.2],
    containers: { zs: [24, 12, 0, -12, -24], size: [6.4, 6.4, 11] }, engines: { R: 2.4, xs: [3, -3], ys: [0], z: -38.5 },
    hp: [{ p: [0, 4.05, 37], flip: 0, s: 1.1 }, { p: [0, 5.05, -34], flip: 0, s: 1.1 }],
    util: [{ p: [3.4, 6.65, 12], flip: 0, s: 0.8 }, { p: [-3.4, 6.65, -12], flip: 0, s: 0.8 }, { p: [3.4, 6.65, -24], flip: 0, s: 0.8 }],
  },
  commuter: {
    name: 'Commuter', radius: 58, cockpit: [0, 4.5, 50],
    segs: [[12, 10, 90, 0], [13, 11, 8, -49]], nose: [9, 7, 10, 50], bridge: [7, 1.4, 0.3, 54.6, 1.8], decks: true,
    engines: { R: 2.4, xs: [4, 0, -4], ys: [0], z: -53.5 },
    hp: [{ p: [0, 5.05, 32], flip: 0, s: 1.1 }, { p: [0, 5.05, -32], flip: 0, s: 1.1 }],
    util: [{ p: [0, 5.05, 12], flip: 0, s: 0.8 }, { p: [0, 5.05, -12], flip: 0, s: 0.8 }, { p: [0, -5.05, 4], flip: 1, s: 0.8 }, { p: [0, -5.05, -20], flip: 1, s: 0.8 }],
  },
};

export function buildCombine(env, variant, liv = 'combine') {
  const C = COMBINE[variant];
  const M = livery(liv, env);
  const ship = shipBase(C.name, M);
  const k = new Kit();
  const r = rng(241 + C.radius);
  const alongZ = [Math.PI / 2, 0, 0];
  const seg = (w, h, l, z, y = 0, key = 'hull') => {
    k.add(key, G.rbox(w, h, l, Math.min(w, h) * 0.08), mat([0, y, z]));
    for (const e of [-1, 1]) k.add('dark', G.box(w * 1.04, h * 1.04, Math.max(0.12, l * 0.05)), mat([0, y, z + e * l * 0.47]));
    k.add('accent', G.box(w * 1.01, h * 0.1, l * 0.36), mat([0, y + h * 0.3, z]));
    for (let i = 0; i < Math.round(l / (C.radius * 0.12)); i++) k.add('dark', G.box(w * 1.02, h * 0.04, l * 0.02), mat([0, y - h * 0.1, z - l * 0.4 + i * C.radius * 0.12]));
    ship.hitSpheres.push([0, y, z, Math.max(w, h) * 0.55]);
  };
  for (const [w, h, l, z] of C.segs) seg(w, h, l, z);
  if (C.spine) { const [w, h, l, z] = C.spine; k.add('dark', G.rbox(w, h, l, 0.3), mat([0, 0, z])); }
  const [nw, nh, nl, nz] = C.nose;
  k.add('hull', G.rbox(nw, nh, nl, Math.min(nw, nh) * 0.2), mat([0, -nh * 0.1, nz]));
  k.add('accent', G.box(nw * 0.3, nh * 0.2, nl * 0.9), mat([0, nh * 0.35, nz]));
  ship.hitSpheres.push([0, 0, nz, Math.max(nw, nh) * 0.55]);
  const [bw, bh, bl, bz, by] = C.bridge;
  if (C.tower) {
    k.add('dark', G.rbox(bw, bh, bl, 0.6), mat([0, by + bh / 2, bz]));
    k.add('glass', G.box(bw * 1.02, bh * 0.16, bl * 0.8), mat([0, by + bh * 0.8, bz]));
    k.add('metal', G.cyl(0.3, 0.5, 8, 6), mat([0, by + bh + 4, bz - 2]));
    ship.hitSpheres.push([0, by + bh / 2, bz, bh * 0.7]);
  } else if (bl < 1) k.add('glass', G.box(bw, bh, bl), mat([0, by, bz], [-0.5, 0, 0]));
  else { k.add('dark', G.rbox(bw * 1.2, bh, bl * 1.1, 0.1), mat([0, by - bh * 0.3, bz])); k.add('glass', G.rbox(bw, bh, bl, 0.1), mat([0, by, bz])); }
  if (C.wings) {
    const W = C.wings;
    k.addMirrored('hull', G.box(W.span / 2, W.t, W.chord), mat([W.span / 4 + 0.6, 0, W.z]));
    k.addMirrored('accent', G.box(0.5, W.t * 1.2, W.chord * 0.95), mat([W.span / 2 + 0.3, 0, W.z]));
    k.addMirrored('dark', G.box(0.6, 0.7, W.chord * 1.1), mat([W.span / 2 + 0.6, 0, W.z]));
    k.addMirrored('gun', G.cyl(0.08, 0.1, 2.6, 8), mat([W.span / 2 + 0.6, 0, W.z + 2.4], alongZ));
    ship.hitSpheres.push([W.span / 2, 0, W.z, 1.2], [-W.span / 2, 0, W.z, 1.2]);
  }
  if (C.sponsons) {
    const P = C.sponsons;
    k.addMirrored('hull', G.rbox(P.w, P.h, P.l, P.w * 0.15), mat([P.x, 0, P.z]));
    k.addMirrored('accent', G.box(P.w * 1.02, P.h * 0.12, P.l * 0.7), mat([P.x, P.h * 0.25, P.z]));
    k.addMirrored('dark', G.box(P.x - 2, P.h * 0.5, P.l * 0.4), mat([P.x / 2 + 1, 0, P.z]));
    for (let i = 0; i < 4; i++) k.addMirrored('dark', G.box(P.w * 1.06, P.h * 1.04, P.l * 0.03), mat([P.x, 0, P.z - P.l * 0.4 + i * P.l * 0.27]));
    ship.hitSpheres.push([P.x, 0, P.z, P.h * 0.7], [-P.x, 0, P.z, P.h * 0.7]);
  }
  if (C.containers) {
    const [cw, ch, cl] = C.containers.size;
    let i = 0;
    for (const z of C.containers.zs) for (const x of [cw / 2 + 0.2, -cw / 2 - 0.2]) for (const y of [ch / 2 + 0.2, -ch / 2 - 0.2]) {
      k.add(i++ % 3 === 0 ? 'accent' : 'hull', G.rbox(cw, ch, cl, 0.15), mat([x, y, z]));
      for (const e of [-1, 1]) k.add('dark', G.box(cw * 1.03, ch * 1.03, 0.25), mat([x, y, z + e * cl * 0.48]));
      for (let j = 0; j < 5; j++) k.add('gun', G.box(cw * 1.01, 0.1, 0.14), mat([x, y + Math.sign(y) * ch * 0.25, z - cl * 0.4 + j * cl * 0.2]));
    }
    for (const z of C.containers.zs) ship.hitSpheres.push([0, 0, z, ch * 1.2]);
  }
  if (C.decks) {
    const [w, h, l] = C.segs[0];
    for (const y of [2.6, 0.6, -1.4, -3.2]) k.addMirrored('window', G.box(0.12, 0.45, l * 0.86), mat([w / 2 + 0.02, y, 0]));
    for (let z = -l * 0.42; z < l * 0.45; z += 6) k.add('dark', G.box(w * 1.04, h * 1.04, 0.4), mat([0, 0, z]));
  }
  // identical square engine pods
  const E = C.engines;
  for (const x of E.xs) for (const y of E.ys) {
    k.add('dark', G.rbox(E.R * 2.5, E.R * 2.5, E.R * 3, E.R * 0.2), mat([x, y, E.z + E.R * 1.6]));
    k.add('accent', G.box(E.R * 2.56, E.R * 0.4, E.R * 1.2), mat([x, y, E.z + E.R * 1.9]));
    k.add('nozzle', G.lathe([[E.R, E.R * 0.35], [E.R * 1.06, 0], [E.R * 1.2, -E.R * 0.8], [E.R * 1.28, -E.R * 1.2]], 20), mat([x, y, E.z], alongZ));
    k.add('engine', G.cyl(E.R, E.R, 0.05, 16), mat([x, y, E.z - 0.05], alongZ));
  }
  const top = Math.max(...C.segs.map((s) => s[1])) / 2;
  k.add('metal', G.cyl(C.radius * 0.004, C.radius * 0.007, C.radius * 0.12, 6), mat([C.radius * 0.03, top + C.radius * 0.06, C.segs[0][3]]));
  ship.group.add(k.build(M, { uvTile: { hull: Math.max(4, C.radius / 7), accent: 4, dark: Math.max(4, C.radius / 9) } }));
  for (const x of E.xs) for (const y of E.ys) addEngine(ship, M, new THREE.Vector3(x, y, E.z - 0.1), E.R, E.R * 12);
  const half = C.sponsons ? C.sponsons.x + C.sponsons.w / 2 : Math.max(...C.segs.map((s) => s[0])) / 2;
  const ls = Math.max(0.9, C.radius * 0.1);
  addLight(ship, new THREE.Vector3(C.wings ? C.wings.span / 2 + 0.6 : half, 0, C.wings ? C.wings.z : 0), 0xff2015, ls, 0);
  addLight(ship, new THREE.Vector3(-(C.wings ? C.wings.span / 2 + 0.6 : half), 0, C.wings ? C.wings.z : 0), 0x15ff40, ls, 0);
  addLight(ship, new THREE.Vector3(0, top + 0.3, C.segs[C.segs.length - 1][3]), 0xffb020, ls * 1.1, 1.1, 0);
  if (C.radius > 20) for (let i = 0; i < 3; i++) launcherAt(ship, (i - 1) * C.radius * 0.08, -top - 0.5, C.segs[0][3] - i * 2);
  else launcherAt(ship, 0, -top - 0.3, C.segs[0][3]);
  ship.hardpoints = C.hp;
  ship.utilMounts = C.util;
  ship.cockpit.set(...C.cockpit);
  ship.radius = C.radius;
  return addGreebles(ship);
}

// ---------------------------------------------------------------- lofted hull designs
// Each design is a set of superellipse lofts (see G.loft) plus engines, fins and mount slots.
// Slots are [x, z, side, scale]: side 1 sits on the top surface, -1 on the bottom, found by ray-casting the built hull.
const ALONG_Z = [Math.PI / 2, 0, 0];
const fullSec = (c) => [c[0], c[1], c[2], c[3], c[4] ?? 0, c[5] ?? 2.4];
function lerpSec(S, z) {
  if (z <= S[0][0]) return S[0];
  for (let i = 0; i < S.length - 1; i++) {
    if (z <= S[i + 1][0]) {
      const a = S[i], b = S[i + 1], t = (z - a[0]) / Math.max(b[0] - a[0], 1e-6);
      return a.map((v, j) => v + (b[j] - v) * t);
    }
  }
  return S[S.length - 1];
}
function halfWidthAt(c, y) {
  const h = y >= c[4] ? c[2] : c[3];
  const yr = Math.abs(y - c[4]) / Math.max(h, 1e-6);
  return yr >= 1 ? 0 : (c[1] / 2) * (1 - yr ** c[5]) ** (1 / c[5]);
}
// thin strip that rides the top centreline of a loft
function ridge(S0, z0, z1, w, t) {
  const S = S0.map(fullSec);
  const zs = [z0, ...S.map((c) => c[0]).filter((z) => z > z0 && z < z1), z1];
  return zs.map((z) => {
    const c = lerpSec(S, z);
    return [z, Math.min(w, c[1] * 0.5), t, t * 2, c[4] + c[2] - t * 0.6, 2.4];
  });
}

function design(env, liv, D) {
  const M = livery(liv, env);
  const ship = shipBase(D.name, M);
  ship.style = D.style || 'std';
  const k = new Kit();
  for (const P of D.parts) {
    const geo = G.loft(P.s.map(fullSec), P.seg || 28, !!P.flat);
    const m = mat(P.at || [0, 0, 0]);
    if (P.mirror) k.addMirrored(P.key || 'hull', geo, m); else k.add(P.key || 'hull', geo, m);
  }
  for (const F of D.fins || []) {
    const m = mat(F.at, [0, 0, F.roll || 0]).multiply(mat([0, 0, 0], [0, -Math.PI / 2, 0]));
    const geo = G.extrude(F.pts, F.t, Math.min(0.12, F.t * 0.3));
    if (F.mirror) k.addMirrored(F.key || 'hull', geo, m); else k.add(F.key || 'hull', geo, m);
  }
  for (const W of D.windows || []) {
    const S = D.parts[W.part].s.map(fullSec), at = D.parts[W.part].at || [0, 0, 0];
    for (const y of W.ys) {
      for (let z = W.z0; z <= W.z1; z += W.step) {
        const x = halfWidthAt(lerpSec(S, z), y);
        if (x < 1) continue;
        k.addMirrored('window', G.box(0.16, W.h, W.step * 0.55), mat([at[0] + x - 0.05, at[1] + y, at[2] + z]));
      }
    }
  }
  const engines = [];
  for (const E of D.engines) {
    for (const x of E.mirror ? [E.p[0], -E.p[0]] : [E.p[0]]) {
      const [y, z] = [E.p[1], E.p[2]], r = E.r;
      k.add('dark', G.cyl(r * 1.2, r * 1.14, r * 0.9, 24), mat([x, y, z + r * 0.4], ALONG_Z));
      k.add('nozzle', G.lathe([[r * 0.86, r * 0.25], [r * 0.95, 0], [r * 1.04, -r * 0.6], [r * 1.1, -r * 0.95]], 24), mat([x, y, z], ALONG_Z));
      k.add('metal', G.torus(r * 1.1, r * 0.05, 6, 28), mat([x, y, z - r * 0.95]));
      k.add('engine', G.cyl(r * 0.86, r * 0.86, 0.05, 24), mat([x, y, z + r * 0.2], ALONG_Z));
      engines.push([x, y, z - r * 0.95, r, E.len]);
    }
  }
  if (D.extra) D.extra(k, ship);
  ship.group.add(k.build(M, { uvTile: { hull: D.tile || 6, accent: 4, dark: 4 } }));
  const grid = surfaceGrid(ship.group);
  const snap = ([x, z, side, sc]) => {
    const h = grid && grid.cast(1, side, z, x);
    return { p: [x, h ? h.p.y - side * 0.04 * sc : 0, z], flip: side < 0 ? 1 : 0, s: sc, miss: !h };
  };
  ship.slots = { g: (D.slots.g || []).map(snap), t: (D.slots.t || []).map(snap), m: (D.slots.m || []).map(snap), u: (D.slots.u || []).map(snap) };
  ship.hardpoints = [...ship.slots.g, ...ship.slots.t];
  ship.utilMounts = ship.slots.u;
  for (const b of ship.slots.m) {
    const o = new THREE.Object3D(); o.position.fromArray(b.p); ship.group.add(o); ship.launchers.push(o);
  }
  for (const [x, y, z, r, len] of engines) addEngine(ship, M, new THREE.Vector3(x, y, z), r, len);
  const ls = D.radius * 0.06;
  addLight(ship, new THREE.Vector3(...D.nav), new THREE.Color(5, 0.4, 0.3), ls, 1.1, 0);
  addLight(ship, new THREE.Vector3(-D.nav[0], D.nav[1], D.nav[2]), new THREE.Color(0.3, 5, 0.6), ls, 1.1, 0);
  addLight(ship, new THREE.Vector3(...D.beacon), new THREE.Color(5, 5, 5), ls * 0.8, 0.7, 1.7);
  ship.cockpit.set(...D.cockpit);
  ship.radius = D.radius;
  const hs = [];
  for (const P of D.parts) {
    if (P.key === 'glass' || P.hit === false) continue;
    const S = P.s.map(fullSec), at = P.at || [0, 0, 0], z0 = S[0][0], z1 = S[S.length - 1][0];
    const n = Math.max(2, Math.min(10, Math.round((z1 - z0) / (D.radius * 0.2))));
    for (let i = 0; i <= n; i++) {
      const z = z0 + ((z1 - z0) * i) / n, c = lerpSec(S, z);
      const h = (c[2] + c[3]) / 2, w = c[1];
      if (w < 0.4) continue;
      const cols = Math.min(5, Math.max(1, Math.round(w / (2.4 * h + 0.01))));
      const rr = Math.max(h, w / (2 * cols));
      for (let j = 0; j < cols; j++) {
        const x = at[0] - w / 2 + ((j + 0.5) * w) / cols, y = at[1] + c[4] + (c[2] - c[3]) / 2;
        hs.push([x, y, at[2] + z, rr]);
        if (P.mirror) hs.push([-x, y, at[2] + z, rr]);
      }
    }
  }
  const step = Math.ceil(hs.length / 56);
  ship.hitSpheres = hs.filter((_, i) => i % step === 0);
  return addGreebles(ship, surfaceGrid(ship.group));
}

const DESIGNS = {
  // pathfinder scout: needle fuselage, one oversized main drive and two outrigger engine pods
  wisp: {
    name: 'Wisp', style: 'sleek', radius: 11, cockpit: [0, 1.25, 4.2], nav: [5.3, -0.2, -4.5], beacon: [0, 3.4, -4.2],
    parts: [
      { s: [[-8.2, 1.3, 0.8, 0.7, 0.1, 2.2], [-6.5, 1.9, 1.05, 0.85, 0.1, 2.2], [-2, 2.1, 1.2, 0.9, 0, 2.2], [3, 1.6, 1.0, 0.7, 0, 2.2], [7, 0.95, 0.6, 0.45, 0, 2.2], [10.8, 0.12, 0.1, 0.08, 0, 2]] },
      { s: [[-7, 10.4, 0.16, 0.16, -0.2, 2], [-4.5, 10, 0.22, 0.2, -0.2, 2], [-1, 4.4, 0.26, 0.22, -0.2, 2], [2.5, 1.4, 0.18, 0.18, -0.2, 2]] },
      { at: [4.7, -0.2, 0], mirror: true, key: 'accent', s: [[-7.2, 0.95, 0.5, 0.5, 0, 2], [-5.5, 1.25, 0.62, 0.62, 0, 2], [-1.5, 1.05, 0.52, 0.52, 0, 2], [2.8, 0.25, 0.14, 0.14, 0, 2]] },
      { key: 'glass', s: [[1.6, 0.8, 0.05, 0, 0.85, 2], [3.6, 0.95, 0.42, 0, 0.75, 2], [6.2, 0.45, 0.18, 0, 0.45, 2]] },
      { key: 'accent', hit: false, s: ridge([[-8.2, 1.3, 0.8, 0.7, 0.1, 2.2], [-6.5, 1.9, 1.05, 0.85, 0.1, 2.2], [-2, 2.1, 1.2, 0.9, 0, 2.2], [3, 1.6, 1.0, 0.7, 0, 2.2]], -7.5, 1.2, 0.35, 0.06) },
    ],
    engines: [{ p: [0, 0.1, -8.2], r: 0.78, len: 11 }, { p: [4.7, -0.2, -7.2], r: 0.5, len: 7, mirror: true }],
    extra: (k) => {
      k.add('metal', G.cyl(0.05, 0.08, 1.8, 6), mat([0, 1.95, -4.2]));
      k.add('metal', G.lathe([[0.02, 0], [0.6, 0.18], [0.85, 0.4], [0.9, 0.44]], 18), mat([0, 2.85, -4.2], [-0.5, 0, 0]));
      k.add('metal', G.cyl(0.03, 0.03, 2.4, 6), mat([0, 0, 11.6], ALONG_Z));
    },
    slots: { g: [[0, 7.4, 1, 0.42]], t: [[0, -2.5, -1, 0.5]], m: [[0, 1.6, -1, 0.36]], u: [[4.7, -4, 1, 0.3], [-4.7, -4, 1, 0.3]] },
  },
  // light fighter: blended bat wing, wingtip fins, two big drives
  hornet: {
    name: 'Hornet', style: 'sleek', radius: 9, cockpit: [0, 1.5, 2.6], nav: [6.1, 0.4, -4.4], beacon: [0, 1.5, -5.2],
    parts: [
      { s: [[-6.2, 1.8, 1.0, 0.8, 0.1, 2.4], [-4, 2.8, 1.35, 1.0, 0, 2.4], [0, 2.5, 1.3, 0.9, 0, 2.4], [4, 1.4, 0.8, 0.55, 0, 2.2], [7.8, 0.18, 0.12, 0.08, 0, 2]] },
      { s: [[-5.8, 11.6, 0.2, 0.2, 0, 2], [-4.2, 12.2, 0.26, 0.24, 0, 2], [-1.5, 7.4, 0.32, 0.26, 0, 2], [1.8, 2.0, 0.3, 0.24, 0, 2]] },
      { at: [1.1, 0.05, 0], mirror: true, key: 'dark', s: [[-6.4, 1.35, 0.72, 0.72, 0, 2], [-3.5, 1.4, 0.75, 0.75, 0, 2], [0, 0.7, 0.35, 0.35, 0, 2], [1.5, 0.1, 0.06, 0.06, 0, 2]] },
      { key: 'glass', s: [[0.4, 1.0, 0.05, 0, 1.0, 2], [2.4, 1.15, 0.55, 0, 0.9, 2], [4.8, 0.45, 0.18, 0, 0.55, 2]] },
    ],
    fins: [{ pts: [[-6, 0], [-4.4, 1.6], [-3.2, 1.6], [-3.6, 0]], t: 0.18, at: [5.85, 0.12, 0], roll: -0.25, mirror: true, key: 'accent' }],
    engines: [{ p: [1.1, 0.05, -6.4], r: 0.62, len: 9, mirror: true }],
    slots: { g: [[2.6, -2, 1, 0.42], [-2.6, -2, 1, 0.42]], t: [], m: [[0, -1.5, -1, 0.4]], u: [[0, -3.8, 1, 0.32]] },
  },
  // interceptor: slim pod slung between two huge engine nacelles
  kestrel: {
    name: 'Kestrel', style: 'sleek', radius: 12, cockpit: [0, 1.6, 4.8], nav: [7.9, -0.1, -6], beacon: [0, 1.2, -6.4],
    parts: [
      { s: [[-7.5, 1.5, 0.95, 0.8, 0, 2.3], [-3, 1.9, 1.15, 0.9, 0, 2.3], [3, 1.5, 0.95, 0.7, 0, 2.3], [8, 0.8, 0.5, 0.4, 0, 2.2], [11.8, 0.12, 0.08, 0.06, 0, 2]] },
      { at: [3.6, -0.1, 0], mirror: true, s: [[-10.2, 1.8, 1.0, 1.0, 0, 2], [-7.5, 2.15, 1.15, 1.15, 0, 2], [-2.5, 1.75, 0.95, 0.95, 0, 2], [3, 1.05, 0.55, 0.55, 0, 2], [7.5, 0.2, 0.12, 0.12, 0, 2]] },
      { key: 'dark', s: [[-8.5, 8.4, 0.24, 0.24, -0.1, 2], [-5, 8.6, 0.3, 0.28, -0.1, 2], [-1, 6.4, 0.3, 0.26, -0.1, 2], [2.5, 2.2, 0.22, 0.2, -0.1, 2]] },
      { key: 'glass', s: [[1.8, 0.85, 0.05, 0, 0.9, 2], [4.4, 1.0, 0.48, 0, 0.78, 2], [7.2, 0.45, 0.18, 0, 0.42, 2]] },
      { at: [3.6, -0.1, 0], mirror: true, key: 'accent', hit: false, s: ridge([[-10.2, 1.8, 1.0, 1.0, 0, 2], [-7.5, 2.15, 1.15, 1.15, 0, 2], [-2.5, 1.75, 0.95, 0.95, 0, 2], [3, 1.05, 0.55, 0.55, 0, 2]], -6, 2.6, 0.4, 0.07) },
    ],
    fins: [{ pts: [[-10, 0], [-8.2, 1.9], [-6.8, 1.9], [-6.6, 0]], t: 0.16, at: [3.6, 0.9, 0], roll: -0.18, mirror: true, key: 'accent' }],
    engines: [{ p: [3.6, -0.1, -10.2], r: 0.92, len: 13, mirror: true }, { p: [0, 0, -7.5], r: 0.5, len: 6 }],
    slots: { g: [[3.6, 1, 1, 0.42], [-3.6, 1, 1, 0.42]], t: [[0, -2, 1, 0.5]], m: [[0, -1, -1, 0.4]], u: [[0, -5.8, 1, 0.32], [0, 4.5, -1, 0.32]] },
  },
  // stealth corvette: faceted low-observable wedge with canted V-tails
  corvid: {
    name: 'Corvid', style: 'sleek', radius: 13, cockpit: [0, 1.5, 3.8], nav: [5.2, 0, -6], beacon: [0, 1.7, -3],
    parts: [
      { flat: true, seg: 8, s: [[-9, 6.5, 0.75, 0.55, 0, 1.4], [-5, 9.5, 0.95, 0.65, 0, 1.4], [-0.5, 7.5, 1.05, 0.65, 0, 1.4], [5, 3.8, 0.85, 0.5, 0, 1.4], [10.5, 0.4, 0.15, 0.1, 0, 1.4]] },
      { flat: true, seg: 8, key: 'dark', s: [[-7, 3, 0.6, 0.1, 0.75, 1.6], [-2, 3.4, 0.8, 0.1, 0.85, 1.6], [3, 1.6, 0.5, 0.1, 0.8, 1.6]] },
      { flat: true, seg: 8, key: 'glass', s: [[1, 1.1, 0.05, 0, 0.85, 1.6], [3.5, 1.3, 0.45, 0, 0.75, 1.6], [6.5, 0.5, 0.15, 0, 0.5, 1.6]] },
    ],
    fins: [{ pts: [[-9, 0], [-7.2, 2.6], [-5.8, 2.6], [-6, 0]], t: 0.14, at: [2.4, 0.6, 0], roll: -0.5, mirror: true, key: 'dark' }],
    engines: [{ p: [1.8, 0, -9], r: 0.58, len: 8, mirror: true }],
    slots: { g: [[1.4, 4, -1, 0.42], [-1.4, 4, -1, 0.42]], t: [[0, -3.5, -1, 0.5]], m: [[0, 0.5, -1, 0.38]], u: [[2.6, -4.5, 1, 0.3], [-2.6, -4.5, 1, 0.3], [0, -5.5, 1, 0.3]] },
  },
  // heavy gunship: hunched body with forward-reaching gun sponsons
  mantis: {
    name: 'Mantis', radius: 20, cockpit: [0, 4.6, 3.6], nav: [9.1, -0.8, -2], beacon: [0, 5.2, -4],
    parts: [
      { s: [[-15, 6, 3, 2.4, 0, 3], [-9, 8.2, 3.8, 2.8, 0, 3], [0, 7.6, 3.6, 2.6, 0, 3], [8, 5, 2.6, 2, 0, 2.8], [14, 2.6, 1.5, 1.2, -0.2, 2.5], [16.5, 0.6, 0.4, 0.3, -0.3, 2]] },
      { at: [6.6, -0.8, 0], mirror: true, s: [[-7, 2.4, 1.4, 1.4, 0, 3], [2, 2.8, 1.6, 1.6, 0, 3], [11, 2.2, 1.2, 1.2, 0, 3], [15.5, 0.8, 0.5, 0.5, 0, 2.5]] },
      { key: 'dark', s: [[-6, 13, 0.5, 0.5, -0.8, 3], [8, 13, 0.5, 0.5, -0.8, 3]] },
      { key: 'accent', s: [[-6, 3.6, 1.4, 0.2, 3.2, 3], [-1, 4, 1.6, 0.2, 3.3, 3], [3, 2.6, 1.0, 0.2, 3.0, 3]] },
    ],
    extra: (k) => {
      k.add('glass', G.box(2.2, 0.45, 0.2), mat([0, 3.6, 3.05]));
      for (const z of [-9, -3]) k.addMirrored('dark', G.rbox(0.5, 3.6, 5, 0.12), mat([3.9, 0.3, z], [0, 0, -0.12]));
    },
    engines: [{ p: [0, 0.3, -15], r: 1.6, len: 12 }, { p: [6.6, -0.8, -7], r: 1.0, len: 8, mirror: true }],
    slots: { g: [[6.6, 12, 1, 0.55], [-6.6, 12, 1, 0.55]], t: [[0, -11, 1, 0.8], [0, 3, -1, 0.8]], m: [[6.6, 3, -1, 0.5], [-6.6, 3, -1, 0.5]], u: [[3.2, 6, 1, 0.5], [-3.2, 6, 1, 0.5], [0, -2, 1, 0.45]] },
  },
  // destroyer: flat, wide armoured slab with bolted-on side skirts
  warden: {
    name: 'Warden', style: 'armor', radius: 34, cockpit: [0, 8.6, -14], nav: [12.8, 0, -14], beacon: [0, 9.6, -17], tile: 8,
    parts: [
      { s: [[-31, 18, 3.4, 3, 0, 5], [-22, 23, 4, 3.2, 0, 5], [2, 24, 4.2, 3.3, 0, 5], [16, 18, 3.6, 2.8, 0, 4], [26, 9, 2.4, 2, 0, 2.6], [32, 2.4, 0.9, 0.8, 0, 2]] },
      { key: 'dark', s: [[-25, 13, 1.8, 0.2, 3.6, 5], [-10, 15, 2.4, 0.2, 3.8, 5], [8, 11, 2.0, 0.2, 3.6, 5], [15, 5, 1.0, 0.2, 3.0, 3]] },
      { key: 'dark', s: [[-24, 8, 0.2, 2.0, -2.8, 4], [10, 7, 0.2, 1.8, -2.8, 4], [18, 3, 0.2, 1, -2.4, 3]] },
    ],
    extra: (k) => {
      k.add('hull', G.rbox(5, 3, 6, 0.3), mat([0, 7.2, -17]));
      k.add('glass', G.box(4.4, 0.5, 0.2), mat([0, 7.8, -13.95]));
      for (const z of [-22, -12, -2, 8]) k.addMirrored('dark', G.rbox(1.4, 5.4, 8.6, 0.25), mat([12.1, 0, z], [0, 0, -0.18]));
    },
    engines: [{ p: [3.6, 0, -31], r: 1.9, len: 14, mirror: true }, { p: [7.4, 0, -30.5], r: 1.25, len: 9, mirror: true }],
    slots: { g: [[2.5, 24, 1, 0.8], [-2.5, 24, 1, 0.8]], t: [[0, -5, 1, 1.1], [0, 7, 1, 1.1], [0, -6, -1, 1.0]], m: [[8.5, -6, 1, 0.8], [-8.5, -6, 1, 0.8]], u: [[8.5, 10, 1, 0.7], [-8.5, 10, 1, 0.7], [6, -22, -1, 0.7], [-6, -22, -1, 0.7]] },
  },
  // light cruiser: long blade hull, swept wings and a raked tail fin
  sabre: {
    name: 'Sabre', style: 'sleek', radius: 44, cockpit: [0, 5, 19], nav: [19.2, -0.6, -24], beacon: [0, 12.4, -33],
    parts: [
      { s: [[-40, 12, 4, 3.5, 0, 2.4], [-30, 12, 5, 4, 0, 2.2], [-10, 11, 5.2, 4, 0, 2.2], [10, 9, 4.4, 3.4, 0, 2.2], [28, 5, 2.6, 2.1, -0.3, 2.2], [40, 1.4, 0.8, 0.6, -0.5, 2], [44, 0.2, 0.12, 0.1, -0.5, 2]] },
      { s: [[-36, 34, 0.6, 0.6, -0.6, 2], [-28, 36, 0.7, 0.6, -0.6, 2], [-15, 22, 0.8, 0.7, -0.6, 2], [0, 9, 0.7, 0.6, -0.6, 2]] },
      { at: [17.6, -0.6, 0], mirror: true, key: 'dark', s: [[-36, 2.4, 1.2, 1.2, 0, 2], [-26, 2.8, 1.4, 1.4, 0, 2], [-12, 2.0, 1.0, 1.0, 0, 2], [-2, 0.4, 0.2, 0.2, 0, 2]] },
      { key: 'glass', s: [[14, 3, 0.05, 0, 3.9, 2.2], [18, 3.2, 0.9, 0, 3.6, 2.2], [24, 1.6, 0.4, 0, 2.6, 2]] },
      { key: 'accent', hit: false, s: ridge([[-30, 12, 5, 4, 0, 2.2], [-10, 11, 5.2, 4, 0, 2.2], [10, 9, 4.4, 3.4, 0, 2.2], [28, 5, 2.6, 2.1, -0.3, 2.2]], -22, 12, 1.2, 0.12) },
    ],
    fins: [{ pts: [[-40, 0], [-34, 8], [-30, 8.2], [-24, 0]], t: 0.6, at: [0, 4.2, 0], key: 'accent' }, { pts: [[-38, 0], [-34, -4.6], [-31, -4.6], [-28, 0]], t: 0.5, at: [0, -3.2, 0], key: 'dark' }],
    engines: [{ p: [0, 0.3, -40], r: 2.4, len: 20 }, { p: [4.4, -0.2, -39.5], r: 1.5, len: 12, mirror: true }, { p: [17.6, -0.6, -36], r: 1.0, len: 8, mirror: true }],
    slots: { g: [[2.2, 32, -1, 0.8], [-2.2, 32, -1, 0.8]], t: [[0, -16, 1, 1.2], [0, 2, 1, 1.0], [0, -4, -1, 1.0]], m: [[9, -20, 1, 0.7], [-9, -20, 1, 0.7]], u: [[2.6, -30, 1, 0.6], [-2.6, -30, 1, 0.6], [2.6, 12, -1, 0.6], [-2.6, 12, -1, 0.6]] },
  },
  // passenger liner: smooth white cigar, deck after deck of windows, glass observation blister
  aurora: {
    name: 'Aurora', style: 'sleek', radius: 62, cockpit: [0, 11, 40], nav: [21.4, -2, -40], beacon: [0, 21.4, -48], tile: 8,
    parts: [
      { s: [[-58, 14, 9, 8, 0, 2], [-50, 19, 12, 10, 0, 2], [-20, 23, 13, 11, 0, 2], [20, 22, 12.5, 10.5, 0, 2], [42, 16, 9.5, 8, 0, 2], [54, 8, 5, 4, -0.5, 2], [61, 1, 1, 0.8, -1, 2]] },
      { key: 'glass', s: [[22, 11, 0.3, 0, 11.6, 2], [32, 12, 2.8, 0, 10.0, 2], [44, 6, 1.2, 0, 7.6, 2]] },
      { at: [16, -2, 0], mirror: true, key: 'accent', s: [[-56, 4.6, 2.4, 2.4, 0, 2], [-46, 5.4, 2.8, 2.8, 0, 2], [-28, 4.4, 2.2, 2.2, 0, 2], [-18, 0.6, 0.3, 0.3, 0, 2]] },
      { key: 'accent', s: [[-50, 34, 0.6, 0.6, -2, 2.5], [-32, 30, 0.6, 0.6, -2, 2.5]] },
      { key: 'accent', hit: false, s: ridge([[-50, 19, 12, 10, 0, 2], [-20, 23, 13, 11, 0, 2], [20, 22, 12.5, 10.5, 0, 2]], -44, 18, 2.2, 0.15) },
    ],
    fins: [{ pts: [[-58, 0], [-50, 10], [-44, 10], [-36, 0]], t: 1, at: [0, 11, 0], key: 'accent' }],
    windows: [{ part: 0, ys: [-6, -2.5, 1, 4.5, 8], z0: -44, z1: 46, step: 2.4, h: 0.8 }],
    engines: [{ p: [0, 0, -58], r: 4, len: 26 }, { p: [16, -2, -56], r: 2.2, len: 16, mirror: true }],
    slots: { g: [], t: [[0, -30, 1, 1.2], [0, 8, -1, 1.2], [0, -36, -1, 1.0]], m: [], u: [[4, 0, 1, 0.8], [-4, 0, 1, 0.8], [4, -14, 1, 0.8], [-4, -14, 1, 0.8], [0, -46, -1, 0.8]] },
  },
  // heavy cruiser: faceted, stepped fortress hull with armour belts down both flanks
  bastion: {
    name: 'Bastion', style: 'armor', radius: 52, cockpit: [0, 13, -10], nav: [19.6, 0, -20], beacon: [0, 13.4, -24], tile: 8,
    parts: [
      { flat: true, seg: 16, s: [[-48, 26, 6, 5, 0, 4], [-36, 34, 7, 5.5, 0, 4], [0, 36, 7.5, 5.5, 0, 4], [24, 30, 6.5, 5, 0, 3.5], [38, 18, 4.5, 3.5, 0, 2.4], [46, 6, 1.6, 1.2, 0, 1.6]] },
      { flat: true, seg: 16, key: 'dark', s: [[-40, 22, 3.2, 0.2, 6, 4], [-20, 26, 3.8, 0.2, 6.5, 4], [12, 20, 3.2, 0.2, 6.2, 4], [22, 10, 1.6, 0.2, 5.5, 3]] },
      { flat: true, seg: 16, s: [[-34, 12, 3, 0.2, 9, 4], [-14, 13, 3.6, 0.2, 9.6, 4], [-4, 8, 2.0, 0.2, 9.4, 3]] },
      { flat: true, seg: 16, key: 'dark', s: [[-40, 14, 0.2, 3, -5, 4], [20, 12, 0.2, 2.6, -5, 4]] },
    ],
    extra: (k) => {
      k.add('glass', G.box(6.4, 0.6, 0.3), mat([0, 10.6, -3.95]));
      for (const z of [-36, -24, -12, 0, 12]) k.addMirrored('dark', G.rbox(2.2, 8, 11, 0.3), mat([18.2, 0, z], [0, 0, -0.25]));
    },
    engines: [{ p: [5, 0, -48], r: 2.6, len: 18, mirror: true }, { p: [10.5, 0, -47.5], r: 1.8, len: 12, mirror: true }],
    slots: { g: [[3, 40, 1, 1.0], [-3, 40, 1, 1.0]], t: [[15, -8, 1, 1.1], [-15, -8, 1, 1.1], [0, 6, 1, 1.3], [0, -10, -1, 1.2]], m: [[8, 24, 1, 0.9], [-8, 24, 1, 0.9]], u: [[15, -30, 1, 0.8], [-15, -30, 1, 0.8], [10, -30, -1, 0.8], [-10, -30, -1, 0.8], [0, 28, -1, 0.8]] },
  },
  // battlecruiser: refined long hull ending in a split spinal-lance bow, swept sponson wings
  paladin: {
    name: 'Paladin', style: 'sleek', radius: 62, cockpit: [0, 11.5, -10], nav: [28.5, -1, -34], beacon: [0, 17.8, -46], tile: 8,
    parts: [
      { s: [[-56, 16, 7, 6, 0, 2.6], [-44, 22, 9, 7, 0, 2.6], [-10, 24, 9.5, 7.5, 0, 2.6], [16, 18, 7.5, 6, 0, 2.6], [30, 12, 5, 4, 0, 2.4], [36, 6, 3, 2.4, 0, 2]] },
      { at: [6.5, -0.5, 0], mirror: true, s: [[18, 6, 4, 3.5, 0, 2.4], [40, 5, 3.2, 2.8, 0, 2.4], [56, 3, 1.8, 1.6, -0.4, 2.2], [64, 0.4, 0.3, 0.2, -0.6, 2]] },
      { key: 'dark', s: [[30, 2.4, 1.2, 1.2, -0.5, 2], [54, 1.4, 0.7, 0.7, -0.5, 2]] },
      { s: [[-46, 52, 1.0, 1.0, -1, 2.4], [-36, 54, 1.2, 1.0, -1, 2.4], [-22, 34, 1.2, 1.0, -1, 2.4], [-4, 18, 1, 1, -1, 2.4]] },
      { at: [26, -1, 0], mirror: true, key: 'dark', s: [[-48, 4, 2.0, 2.0, 0, 2], [-36, 4.6, 2.3, 2.3, 0, 2], [-22, 3.4, 1.6, 1.6, 0, 2], [-10, 0.6, 0.3, 0.3, 0, 2]] },
      { s: [[-34, 9, 4.5, 0.2, 8.5, 3], [-22, 10, 5.2, 0.2, 8.8, 3], [-12, 6, 3.2, 0.2, 8.6, 3]] },
      { key: 'accent', hit: false, s: ridge([[-44, 22, 9, 7, 0, 2.6], [-10, 24, 9.5, 7.5, 0, 2.6], [16, 18, 7.5, 6, 0, 2.6], [30, 12, 5, 4, 0, 2.4]], -8, 28, 2.4, 0.2) },
    ],
    fins: [{ pts: [[-56, 0], [-48, 9], [-42, 9], [-36, 0]], t: 0.8, at: [0, 8.5, 0], key: 'accent' }],
    extra: (k) => {
      k.add('glass', G.box(5.4, 0.7, 0.3), mat([0, 10.8, -11.9]));
      for (const z of [36, 42, 48]) k.add('coil', G.torus(1.3, 0.12, 6, 20), mat([0, -0.5, z]));
      k.add('coil', G.sphere(0.8, 14, 10), mat([0, -0.5, 54.6]));
    },
    engines: [{ p: [0, 0, -56], r: 3.2, len: 24 }, { p: [5.6, 0, -55.5], r: 2.2, len: 16, mirror: true }, { p: [26, -1, -48], r: 1.6, len: 10, mirror: true }],
    slots: { g: [[6.5, 50, 1, 1.0], [-6.5, 50, 1, 1.0], [6.5, 30, -1, 1.0], [-6.5, 30, -1, 1.0]], t: [[0, 0, 1, 1.4], [0, 14, 1, 1.3], [12, -28, 1, 1.1], [-12, -28, 1, 1.1]], m: [[0, -20, -1, 1.0], [0, 4, -1, 1.0]], u: [[5, -44, 1, 0.9], [-5, -44, 1, 0.9], [18, -34, -1, 0.8], [-18, -34, -1, 0.8], [0, -40, -1, 0.9]] },
  },
  // battleship: tiered arrowhead with flanking engine nacelles and a command tower
  sovereign: {
    name: 'Sovereign', radius: 92, cockpit: [0, 27, -32], nav: [29.4, -2, -60], beacon: [0, 29.4, -40], tile: 10,
    parts: [
      { s: [[-84, 30, 10, 8, 0, 3], [-66, 40, 12, 9, 0, 3], [-20, 42, 13, 9.5, 0, 3], [30, 30, 10, 8, 0, 2.8], [64, 14, 6, 5, 0, 2.4], [88, 3, 1.6, 1.4, 0, 2]] },
      { key: 'dark', s: [[-74, 26, 4, 0.2, 11, 3], [-40, 30, 5, 0.2, 12, 3], [10, 22, 4, 0.2, 11, 3], [40, 8, 2, 0.2, 8.5, 3]] },
      { s: [[-66, 14, 4, 0.2, 15.5, 3], [-40, 16, 5, 0.2, 16.4, 3], [-20, 10, 3, 0.2, 16, 3]] },
      { key: 'accent', s: [[-48, 8, 8, 0.2, 19, 3], [-38, 8, 9, 0.2, 19.5, 3], [-32, 5, 5, 0.2, 19.5, 3]] },
      { at: [24, -2, 0], mirror: true, s: [[-86, 9, 5, 5, 0, 2], [-72, 10, 5.6, 5.6, 0, 2], [-48, 8, 4.4, 4.4, 0, 2], [-32, 1, 0.6, 0.6, 0, 2]] },
      { key: 'dark', s: [[-70, 18, 0.2, 4, -8, 3], [20, 14, 0.2, 3.5, -7.5, 3], [44, 6, 0.2, 2, -5.5, 3]] },
      { key: 'accent', hit: false, s: ridge([[30, 30, 10, 8, 0, 2.8], [64, 14, 6, 5, 0, 2.4], [88, 3, 1.6, 1.4, 0, 2]], 42, 82, 3, 0.3) },
    ],
    extra: (k) => { k.add('glass', G.box(6, 1, 0.3), mat([0, 25.5, -31.9])); },
    windows: [{ part: 0, ys: [-3, 2], z0: -60, z1: 20, step: 3, h: 0.7 }],
    engines: [{ p: [0, 0, -84], r: 5, len: 34 }, { p: [9.5, 0, -83.5], r: 3.4, len: 22, mirror: true }, { p: [24, -2, -86], r: 4, len: 26, mirror: true }],
    slots: { g: [[4, 72, 1, 1.2], [-4, 72, 1, 1.2]], t: [[0, 0, 1, 1.8], [0, 24, 1, 1.6], [0, 46, 1, 1.5], [24, -54, 1, 1.3], [-24, -54, 1, 1.3], [14, -10, -1, 1.3], [-14, -10, -1, 1.3]], m: [[10, 30, 1, 1.1], [-10, 30, 1, 1.1], [0, -30, -1, 1.2]], u: [[16, -30, 1, 1], [-16, -30, 1, 1], [8, -58, 1, 1], [-8, -58, 1, 1], [14, -60, -1, 1], [-14, -60, -1, 1]] },
  },
  // dreadnought: armoured spine, hammerhead prow, six-drive engine block and gun sponsons
  leviathan: {
    name: 'Leviathan', style: 'armor', radius: 130, cockpit: [0, 35, -44], nav: [39.4, -2, -60], beacon: [0, 37.6, -58], tile: 12,
    parts: [
      { s: [[-120, 40, 16, 14, 0, 4], [-96, 48, 18, 15, 0, 4], [-40, 40, 16, 13, 0, 4], [40, 34, 14, 12, 0, 4], [90, 30, 12, 10, 0, 4], [110, 46, 14, 12, 0, 3.4], [126, 40, 10, 8, -1, 2.6], [134, 16, 4, 3, -2, 2]] },
      { at: [30, -2, 0], mirror: true, s: [[-90, 14, 9, 9, 0, 4], [-60, 18, 11, 11, 0, 4], [30, 16, 10, 10, 0, 4], [60, 8, 5, 5, 0, 3]] },
      { key: 'dark', s: [[-100, 30, 5, 0.2, 16, 4], [-30, 28, 6, 0.2, 15.5, 4], [60, 22, 5, 0.2, 13.5, 4], [80, 10, 2, 0.2, 12, 3]] },
      { s: [[-70, 14, 14, 0.2, 20, 3], [-52, 14, 16, 0.2, 21, 3], [-44, 9, 9, 0.2, 21, 3]] },
      { at: [30, -2, 0], mirror: true, key: 'accent', hit: false, s: ridge([[-90, 14, 9, 9, 0, 4], [-60, 18, 11, 11, 0, 4], [30, 16, 10, 10, 0, 4]], -84, 24, 2.5, 0.3) },
    ],
    extra: (k) => {
      k.add('glass', G.box(7, 1.2, 0.4), mat([0, 28, -43.9]));
      for (const z of [-80, -40, 0, 40]) k.addMirrored('dark', G.rbox(3, 14, 20, 0.5), mat([39.5, -2, z], [0, 0, -0.15]));
    },
    engines: [{ p: [9, 6, -120], r: 5.6, len: 40, mirror: true }, { p: [9, -6, -120], r: 5.6, len: 40, mirror: true }, { p: [0, 0, -120], r: 3.6, len: 26 }, { p: [30, -2, -90], r: 5, len: 28, mirror: true }],
    slots: { g: [[14, 118, 1, 2.0], [-14, 118, 1, 2.0], [14, 118, -1, 1.8], [-14, 118, -1, 1.8]], t: [[0, -20, 1, 2.2], [0, 10, 1, 2.2], [0, 40, 1, 2.2], [0, 66, 1, 2.0], [30, -70, 1, 1.8], [-30, -70, 1, 1.8], [30, 0, -1, 1.6], [-30, 0, -1, 1.6]], m: [[14, 100, 1, 1.6], [-14, 100, 1, 1.6], [0, -60, -1, 1.8], [0, 20, -1, 1.8]], u: [[12, -96, 1, 1.4], [-12, -96, 1, 1.4], [0, -90, -1, 1.4], [0, 60, -1, 1.4], [30, -40, 1, 1.4], [-30, -40, 1, 1.4], [0, -20, -1, 1.4]] },
  },
};
