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
    engine: new THREE.MeshBasicMaterial({ color: engColor.clone().multiplyScalar(2.2) }),
    light: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5, 5) }),
    coil: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.4, 4) }),
    engColor,
  };
  for (const k of ['engine', 'light', 'coil']) M[k].userData.noShadow = true;
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
  return { root, yaw, pitch, muzzles, barrels, kind, recoil: barrels.map(() => 0), next: 0 };
}

function shipBase(name, M) {
  return { name, group: new THREE.Group(), turrets: [], guns: [], launchers: [], engines: [], navLights: [], M, radius: 10, hitSpheres: [] };
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

// ---------------------------------------------------------------- player frigate (~36 m)
export function buildFrigate(env) {
  const M = livery('player', env);
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

  // turrets
  const t1 = buildTurret(M, 'laser', 1); t1.root.position.set(0, 3.5, 1.2); t1.slot = 'laser';
  const t2 = buildTurret(M, 'laser', 1); t2.root.position.set(0, 4.1, -5.6); t2.slot = 'laser';
  const t3 = buildTurret(M, 'rail', 0.9); t3.root.position.set(0, -2.7, -2.0); t3.root.rotation.z = Math.PI; t3.slot = 'rail';
  for (const t of [t1, t2, t3]) { ship.group.add(t.root); ship.turrets.push(t); }
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
  return ship;
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
  return ship;
}

// ---------------------------------------------------------------- pirate cruiser (~150 m)
export function buildCruiser(env) {
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
  for (const [x, y, z, flip] of [[0, 15, 20, 0], [0, 15, 42, 0], [0, -19, 10, 1], [12, 8, -55, 0], [-12, 8, -55, 0]]) {
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
  return ship;
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
  return ship;
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
    t.barrels.forEach((b, i) => { b.position.z = (t.kind === 'laser' ? 0.5 : 0) - t.recoil[i] * (t.kind === 'laser' ? 0.35 : 0.8); });
  }
}
