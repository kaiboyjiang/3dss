import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE, LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './shaders.js';
import { hullMaps, rockMaps, windowMaps, solarPanelMaps, glowTexture, rng } from './textures.js';
import { Kit, G, mat, boxUV } from './geo.js';

export const SUN_DIR = new THREE.Vector3(0.78, 0.32, 0.2).normalize();
export const PLANET = { pos: new THREE.Vector3(120000, -40000, -280000), radius: 60000 };
export const MOON = { pos: new THREE.Vector3(-150000, 52000, -210000), radius: 14000 };

export const LOCATIONS = [
  { id: 'station', name: 'Ardent Relay Station', type: 'Station', pos: new THREE.Vector3(0, 0, 0), arrive: 3200, icon: 'station' },
  { id: 'belt', name: 'Kaltos III - Asteroid Belt 1', type: 'Asteroid Belt', pos: new THREE.Vector3(48000, 4000, -36000), arrive: 1500, icon: 'belt' },
  { id: 'outpost', name: 'Corsair Hideout', type: 'Pirate Outpost', pos: new THREE.Vector3(-62000, -9000, -24000), arrive: 6000, icon: 'outpost' },
  { id: 'gate', name: 'Stargate (Vexal)', type: 'Stargate', pos: new THREE.Vector3(18000, 7000, 70000), arrive: 4000, icon: 'gate' },
  { id: 'planet', name: 'Kaltos III', type: 'Planet (Temperate)', pos: PLANET.pos, arrive: PLANET.radius + 9000, icon: 'planet' },
  { id: 'moon', name: 'Kaltos III - Moon 1', type: 'Moon', pos: MOON.pos, arrive: MOON.radius + 4000, icon: 'moon' },
];

// ---------------------------------------------------------------- sky
function makeSky(sunScale) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: { uSun: { value: SUN_DIR }, uSunScale: { value: sunScale } },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun; uniform float uSunScale;
      varying vec3 vDir;
      ${NOISE}
      void main() {
        vec3 d = normalize(vDir);
        vec3 gal = normalize(vec3(0.25, 0.92, -0.3));
        float gd = dot(d, gal);
        float band = exp(-gd * gd / 0.035);
        float bandWide = exp(-gd * gd / 0.25);
        // galactic glow + dust lanes
        float n1 = fbm(d * 3.0, 6);
        float n2 = fbm(d * 7.0 + 3.0, 5);
        float lanes = smoothstep(0.0, 0.5, fbm(d * 5.0 + 11.0, 5) + 0.15);
        vec3 col = vec3(0.0);
        col += vec3(0.55, 0.5, 0.45) * band * (0.35 + 0.35 * n2) * mix(1.0, 0.25, lanes * band);
        col += vec3(0.12, 0.14, 0.2) * bandWide * 0.25;
        // emission nebula region
        vec3 nc = normalize(vec3(-0.6, 0.25, -0.75));
        float nr = max(dot(d, nc), 0.0);
        float neb = smoothstep(0.55, 1.0, nr) * smoothstep(-0.2, 0.6, n1 + 0.3 * n2);
        float warp = fbm(d * 4.0 + vec3(n1, n2, 0.0) * 1.5, 6);
        vec3 nebCol = mix(vec3(0.85, 0.18, 0.32), vec3(0.15, 0.45, 0.95), smoothstep(-0.3, 0.4, warp));
        nebCol = mix(nebCol, vec3(1.0, 0.55, 0.2), smoothstep(0.35, 0.7, warp) * 0.6);
        col += nebCol * neb * (0.35 + 0.65 * max(warp, 0.0)) * 0.55;
        // dark nebula silhouettes
        col *= 1.0 - 0.75 * smoothstep(0.25, 0.6, fbm(d * 2.4 + 21.0, 5)) * smoothstep(0.4, 1.0, nr);
        // faint background starfield
        vec3 cell = floor(d * 380.0);
        vec3 h = hash33(cell);
        vec3 sp = (cell + h) / 380.0;
        float sd = length(normalize(sp) - d) * 380.0;
        float star = smoothstep(0.35, 0.0, sd) * step(0.82, h.x) * (0.4 + band * 1.6);
        col += vec3(0.9, 0.92, 1.0) * star * 0.5 * h.y;
        // sun
        float sdot = max(dot(d, uSun), 0.0);
        float disk = smoothstep(0.99985, 0.99992, sdot);
        col += vec3(1.0, 0.92, 0.8) * disk * 60.0 * uSunScale;
        col += vec3(1.0, 0.75, 0.5) * pow(sdot, 900.0) * 6.0 * uSunScale;
        col += vec3(1.0, 0.7, 0.45) * pow(sdot, 60.0) * 0.25;
        col += vec3(0.6, 0.55, 0.6) * pow(sdot, 6.0) * 0.03;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
  mesh.scale.setScalar(1.8e6);
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  return mesh;
}

function makeStars() {
  const r = rng(99);
  const N = 9000;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
  const gal = new THREE.Vector3(0.25, 0.92, -0.3).normalize();
  const v = new THREE.Vector3();
  const temps = [[0.65, 0.75, 1.0], [0.85, 0.9, 1.0], [1, 1, 1], [1, 0.95, 0.85], [1, 0.82, 0.6], [1, 0.65, 0.45]];
  for (let i = 0; i < N; i++) {
    for (;;) {
      v.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
      const l = v.length();
      if (l < 0.05 || l > 1) continue;
      v.divideScalar(l);
      const g = Math.abs(v.dot(gal));
      if (r() < 0.35 + 0.65 * Math.exp(-g * g / 0.04)) break;
    }
    v.multiplyScalar(1.5e6);
    pos.set([v.x, v.y, v.z], i * 3);
    const t = temps[Math.floor(Math.pow(r(), 1.3) * temps.length)];
    const b = Math.pow(r(), 6) * 6 + 0.25;
    col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
    size[i] = 1.2 + Math.pow(r(), 4) * 2.6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPixel: { value: 1 } },
    vertexShader: /* glsl */`
      ${LOGDEPTH_VERT_PARS}
      attribute float size; attribute vec3 color; varying vec3 vCol; uniform float uPixel;
      void main() {
        vCol = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uPixel;
        ${LOGDEPTH_VERT}
      }`,
    fragmentShader: /* glsl */`
      ${LOGDEPTH_FRAG_PARS}
      varying vec3 vCol;
      void main() {
        ${LOGDEPTH_FRAG}
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = exp(-d * d * 4.0);
        gl_FragColor = vec4(vCol * a, 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -999;
  return pts;
}

// ---------------------------------------------------------------- planets
const PLANET_VERT = /* glsl */`
  ${LOGDEPTH_VERT_PARS}
  uniform float uRadius;
  varying vec3 vObj; varying vec3 vWN; varying vec3 vWP;
  void main() {
    vObj = position / uRadius;
    vWN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWP = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    ${LOGDEPTH_VERT}
  }`;

function makePlanetMaterial(type, radius) {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR }, uRadius: { value: radius }, uType: { value: type }, uTime: { value: 0 } },
    vertexShader: PLANET_VERT,
    fragmentShader: /* glsl */`
      ${LOGDEPTH_FRAG_PARS}
      uniform vec3 uSun; uniform float uRadius; uniform float uType; uniform float uTime;
      varying vec3 vObj; varying vec3 vWN; varying vec3 vWP;
      ${NOISE}
      vec3 bump(vec3 N, float h, float scale) {
        vec3 dpdx = dFdx(vWP), dpdy = dFdy(vWP);
        float dhx = dFdx(h) * scale, dhy = dFdy(h) * scale;
        vec3 r1 = cross(dpdy, N), r2 = cross(N, dpdx);
        float det = dot(dpdx, r1);
        vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
        return normalize(abs(det) * N - grad);
      }
      void main() {
        ${LOGDEPTH_FRAG}
        vec3 p = normalize(vObj);
        vec3 N = normalize(vWN);
        vec3 V = normalize(cameraPosition - vWP);
        float NdV = max(dot(N, V), 0.0);
        vec3 col; float spec = 0.0; vec3 emit = vec3(0.0);
        float NdL0 = dot(N, uSun);
        if (uType < 0.5) {
          vec3 q = p + 0.15 * vec3(fbm(p * 2.0, 4), fbm(p * 2.0 + 5.2, 4), fbm(p * 2.0 + 9.1, 4));
          float h = fbm(q * 1.7, 8) + 0.35 * ridged(q * 3.2, 6) - 0.2;
          float lat = abs(p.y);
          float sea = 0.02;
          float land = smoothstep(sea, sea + 0.01, h);
          float e = max(h - sea, 0.0);
          float moist = fbm(p * 3.1 + 40.0, 5);
          vec3 deep = vec3(0.005, 0.03, 0.09), shallow = vec3(0.02, 0.12, 0.2);
          vec3 ocean = mix(deep, shallow, smoothstep(-0.25, sea, h));
          vec3 sand = vec3(0.55, 0.48, 0.34), forest = vec3(0.07, 0.16, 0.05), grass = vec3(0.2, 0.28, 0.1);
          vec3 desert = vec3(0.6, 0.42, 0.24), rock = vec3(0.32, 0.29, 0.26), snow = vec3(0.9, 0.92, 0.95);
          vec3 lc = mix(desert, mix(grass, forest, smoothstep(0.0, 0.3, moist)), smoothstep(-0.25, 0.05, moist - lat * 0.3 + 0.1));
          lc = mix(sand, lc, smoothstep(0.0, 0.03, e));
          lc = mix(lc, rock, smoothstep(0.2, 0.38, e));
          lc = mix(lc, snow, smoothstep(0.42, 0.55, e + lat * 0.25));
          col = mix(ocean, lc, land);
          float ice = smoothstep(0.78, 0.86, lat + fbm(p * 6.0, 4) * 0.08);
          col = mix(col, snow, ice);
          N = bump(N, e * land * 2500.0, 1.0);
          spec = (1.0 - land) * (1.0 - ice);
          // cloud shadows
          vec3 cp = p + vec3(uTime * 0.002, 0.0, 0.0);
          float cl = smoothstep(0.05, 0.5, fbm(cp * 3.0 + fbm(cp * 1.4, 3), 4));
          col *= 1.0 - cl * 0.55 * smoothstep(-0.1, 0.3, NdL0);
          float cityAA = 1.0 - smoothstep(0.15, 0.6, length(fwidth(p * 45.0)));
          float city = cityAA * smoothstep(0.58, 0.85, fbm(p * 45.0, 4) + 0.5) * land * (1.0 - ice) * smoothstep(0.35, 0.05, e) * smoothstep(0.1, -0.12, NdL0);
          emit = vec3(1.0, 0.62, 0.28) * city * 0.9 * (1.0 - cl * 0.7);
        } else {
          float h = fbm(p * 2.5, 7) * 0.5 + ridged(p * 5.0, 5) * 0.3;
          // craters
          float cr = 0.0;
          for (int i = 0; i < 3; i++) {
            float sc = 6.0 * pow(2.6, float(i));
            vec3 c = floor(p * sc); vec3 hsh = hash33(c);
            vec3 cc = (c + 0.25 + hsh * 0.5) / sc;
            float d = length(p - cc) * sc / (0.25 + hsh.x * 0.25);
            cr += (smoothstep(1.0, 0.7, d) * -0.6 + smoothstep(0.7, 1.0, d) * smoothstep(1.3, 1.0, d) * 0.5) * step(0.4, hsh.y) / float(i + 1);
          }
          h += cr * 0.3;
          col = mix(vec3(0.16, 0.155, 0.15), vec3(0.42, 0.4, 0.38), smoothstep(-0.3, 0.6, h));
          col = mix(col, vec3(0.07, 0.07, 0.075), smoothstep(0.1, 0.4, fbm(p * 1.3 + 7.0, 4)) * 0.7);
          N = bump(N, h * 900.0, 1.0);
        }
        float NdL = dot(N, uSun);
        float diff = max(NdL, 0.0);
        float term = smoothstep(-0.12, 0.25, NdL0);
        vec3 light = vec3(1.0, 0.96, 0.9) * 2.6 * diff;
        vec3 c = col * light * mix(1.0, term, 0.5);
        if (uType < 0.5) {
          vec3 H = normalize(uSun + V);
          vec3 Ns = normalize(vWN);
          c += vec3(1.0, 0.9, 0.75) * pow(max(dot(Ns, H), 0.0), 180.0) * spec * 3.0 * term;
          c += vec3(1.0, 0.9, 0.75) * pow(max(dot(Ns, H), 0.0), 18.0) * spec * 0.08 * term;
          // atmospheric haze toward limb
          float haze = pow(1.0 - NdV, 2.5);
          vec3 sky = mix(vec3(0.9, 0.35, 0.12), vec3(0.25, 0.5, 1.0), smoothstep(-0.05, 0.35, NdL0));
          c = mix(c, sky * 1.4 * smoothstep(-0.2, 0.25, NdL0), haze * 0.75);
          c += vec3(0.04, 0.08, 0.16) * term * 0.4;
          c += emit;
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

function makeClouds(radius) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uSun: { value: SUN_DIR }, uRadius: { value: radius }, uTime: { value: 0 } },
    vertexShader: PLANET_VERT,
    fragmentShader: /* glsl */`
      ${LOGDEPTH_FRAG_PARS}
      uniform vec3 uSun; uniform float uTime;
      varying vec3 vObj; varying vec3 vWN; varying vec3 vWP;
      ${NOISE}
      void main() {
        ${LOGDEPTH_FRAG}
        vec3 p = normalize(vObj) + vec3(uTime * 0.002, 0.0, 0.0);
        float w = fbm(p * 1.4, 3);
        float d = smoothstep(0.05, 0.5, fbm(p * 3.0 + w, 7));
        float lat = abs(normalize(vObj).y);
        d *= 0.75 + 0.25 * smoothstep(0.0, 0.3, lat);
        vec3 N = normalize(vWN);
        float NdL = dot(N, uSun);
        float lit = smoothstep(-0.15, 0.3, NdL);
        vec3 c = mix(vec3(1.0, 0.55, 0.35) * 0.6, vec3(1.0), smoothstep(0.0, 0.35, NdL)) * 2.4 * lit;
        vec3 V = normalize(cameraPosition - vWP);
        float a = d * 0.92 * smoothstep(0.0, 0.15, dot(N, V));
        gl_FragColor = vec4(c * (0.75 + 0.25 * d), a);
      }`,
  });
}

function makeAtmosphere(center, radius, outer) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { uSun: { value: SUN_DIR }, uCenter: { value: center }, uR: { value: radius }, uRa: { value: outer } },
    vertexShader: /* glsl */`
      ${LOGDEPTH_VERT_PARS}
      varying vec3 vWP;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWP = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
        ${LOGDEPTH_VERT}
      }`,
    fragmentShader: /* glsl */`
      ${LOGDEPTH_FRAG_PARS}
      uniform vec3 uSun; uniform vec3 uCenter; uniform float uR; uniform float uRa;
      varying vec3 vWP;
      void main() {
        ${LOGDEPTH_FRAG}
        vec3 rd = normalize(vWP - cameraPosition);
        vec3 oc = cameraPosition - uCenter;
        float b = dot(oc, rd);
        vec3 closest = oc - rd * b;
        float d = length(closest);
        float t = clamp((d - uR) / (uRa - uR), 0.0, 1.0);
        float dens = pow(1.0 - t, 2.2) * step(uR * 0.995, d);
        vec3 up = normalize(closest);
        float sunAmt = dot(up, uSun);
        float day = smoothstep(-0.35, 0.35, sunAmt);
        vec3 c = mix(vec3(1.0, 0.4, 0.15), vec3(0.3, 0.55, 1.0), smoothstep(-0.1, 0.4, sunAmt));
        float fw = pow(max(dot(rd, uSun), 0.0), 8.0);
        gl_FragColor = vec4(c * dens * day * (1.6 + fw * 4.0), 1.0);
      }`,
  });
}

// ---------------------------------------------------------------- materials
export function stationMaterials(env) {
  const hull = hullMaps({ seed: 21, base: [176, 178, 182], accent: [196, 92, 30], accentChance: 0.05, darkChance: 0.14, wear: 0.6, labels: ['ARDENT', 'BAY 04', 'DOCK', 'AUX', 'C-12', 'VENT'] });
  const dark = hullMaps({ seed: 22, base: [70, 72, 76], accent: [140, 40, 30], accentChance: 0.02, darkChance: 0.2, wear: 0.5 });
  const win = windowMaps(23);
  const m = {
    hull: new THREE.MeshStandardMaterial({ map: hull.map, normalMap: hull.normalMap, roughnessMap: hull.roughnessMap, metalness: 0.55, roughness: 0.6, envMap: env, envMapIntensity: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ map: dark.map, normalMap: dark.normalMap, roughnessMap: dark.roughnessMap, metalness: 0.8, roughness: 0.5, envMap: env, envMapIntensity: 0.6 }),
    window: new THREE.MeshStandardMaterial({ map: win.map, emissiveMap: win.emissiveMap, emissive: new THREE.Color(2.2, 2.0, 1.7), metalness: 0.5, roughness: 0.4, envMap: env, envMapIntensity: 0.5 }),
    solar: new THREE.MeshStandardMaterial({ map: solarPanelMaps(), metalness: 0.7, roughness: 0.18, envMap: env, envMapIntensity: 1.2, side: THREE.DoubleSide }),
    light: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.5, 4.5) }),
    red: new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 0.6, 0.3) }),
    blue: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.5, 8) }),
    hangar: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.5, 1.3) }),
  };
  m.light.userData.noShadow = m.red.userData.noShadow = m.blue.userData.noShadow = m.hangar.userData.noShadow = true;
  return m;
}

const glowTex = glowTexture(128, 2.5);
export function beaconSprite(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(size);
  return s;
}

// ---------------------------------------------------------------- station
function buildStation(M) {
  const root = new THREE.Group();
  const k = new Kit();
  const r = rng(5);
  // central spine
  k.add('hull', G.cyl(70, 70, 640, 48), mat([0, 0, 0]));
  k.add('window', G.cyl(71, 71, 40, 48, true), mat([0, 160, 0]));
  k.add('window', G.cyl(71, 71, 40, 48, true), mat([0, -60, 0]));
  k.add('window', G.cyl(71, 71, 30, 48, true), mat([0, -200, 0]));
  for (const y of [-300, -240, -120, 0, 80, 230, 300]) k.add('dark', G.cyl(82, 82, 14, 48), mat([0, y, 0]));
  k.add('hull', G.cyl(40, 70, 90, 48), mat([0, 365, 0]));
  k.add('dark', G.cyl(110, 110, 30, 48), mat([0, 330, 0]));
  k.add('hull', G.cyl(70, 40, 90, 48), mat([0, -365, 0]));
  k.add('dark', G.cyl(20, 20, 260, 16), mat([0, 520, 0]));
  k.add('dark', G.cyl(4, 4, 200, 8), mat([0, 740, 0]));
  k.add('dark', G.sphere(30, 24, 16), mat([0, -420, 0]));
  // hub where spokes attach
  k.add('hull', G.cyl(120, 120, 70, 48), mat([0, 0, 0]));
  k.add('window', G.cyl(121, 121, 18, 48, true), mat([0, 0, 0]));
  // docking arms (4 horizontal)
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const c = Math.cos(a), s = Math.sin(a);
    const L = 380;
    k.add('hull', G.rbox(70, 50, L, 6), mat([c * (L / 2 + 60), -230, s * (L / 2 + 60)], [0, Math.atan2(c, s), 0]));
    k.add('dark', G.box(74, 8, L - 30), mat([c * (L / 2 + 60), -200, s * (L / 2 + 60)], [0, Math.atan2(c, s), 0]));
    k.add('window', G.box(71, 10, L - 60), mat([c * (L / 2 + 60), -235, s * (L / 2 + 60)], [0, Math.atan2(c, s), 0]));
    // docking collar at end
    k.add('dark', G.cyl(48, 48, 40, 24), mat([c * (L + 70), -230, s * (L + 70)], [Math.PI / 2, 0, -a + Math.PI / 2]));
    k.add('hangar', G.box(56, 30, 4), mat([c * (L + 92), -230, s * (L + 92)], [0, Math.atan2(c, s), 0]));
    k.add('dark', G.box(40, 6, 120), mat([c * (L + 60), -262, s * (L + 60)], [0, Math.atan2(c, s), 0]));
    // floodlights
    for (const dy of [-30, 30]) k.add('light', G.box(6, 3, 3), mat([c * (L + 88), -230 + dy, s * (L + 88)], [0, Math.atan2(c, s), 0]));
  }
  // habitat ring (rotates)
  const ringK = new Kit();
  ringK.add('hull', G.torus(420, 34, 24, 160), mat([0, 0, 0], [Math.PI / 2, 0, 0]));
  ringK.add('window', G.torus(420, 34.6, 4, 160), mat([0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 0.55]));
  ringK.add('dark', G.torus(420, 38, 8, 160), mat([0, 0, 0], [Math.PI / 2, 0, 0], [1.0, 1.0, 0.12]));
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    ringK.add('dark', G.cyl(9, 9, 300, 12), mat([Math.cos(a) * 270, 0, Math.sin(a) * 270], [0, -a, Math.PI / 2]));
    ringK.add('hull', G.cyl(16, 16, 40, 16), mat([Math.cos(a) * 140, 0, Math.sin(a) * 140], [0, -a, Math.PI / 2]));
    ringK.add('hull', G.rbox(60, 80, 90, 6), mat([Math.cos(a) * 420, 0, Math.sin(a) * 420], [0, -a, 0]));
    ringK.add('light', G.box(2, 2, 2), mat([Math.cos(a) * 462, 0, Math.sin(a) * 462]));
  }
  const ring = ringK.build(M, { uvTile: { hull: 40, dark: 30 } });
  ring.position.y = 120;
  root.add(ring);
  // solar arrays
  for (const side of [-1, 1]) {
    k.add('dark', G.box(900, 8, 8), mat([side * 520, 430, 0]));
    for (let j = 0; j < 5; j++) {
      const x = side * (200 + j * 150);
      k.add('solar', G.box(130, 2, 220), mat([x, 430, 120]));
      k.add('solar', G.box(130, 2, 220), mat([x, 430, -120]));
      k.add('dark', G.box(4, 4, 470), mat([x, 432, 0]));
    }
  }
  // radiator panels
  for (const a of [0, Math.PI]) {
    k.add('hull', G.box(4, 180, 260), mat([Math.cos(a) * 160, -110, Math.sin(a) * 160], [0, -a, 0]));
    k.add('dark', G.box(10, 10, 90), mat([Math.cos(a) * 110, -110, Math.sin(a) * 110], [0, -a + Math.PI / 2, 0]));
  }
  // greebles on spine
  for (let i = 0; i < 160; i++) {
    const a = r() * Math.PI * 2, y = -300 + r() * 600;
    if (Math.abs(y) < 50) continue;
    const w = 8 + r() * 26, h = 6 + r() * 30, d = 6 + r() * 18;
    k.add(r() < 0.6 ? 'dark' : 'hull', G.box(w, h, d), mat([Math.cos(a) * (70 + d / 2), y, Math.sin(a) * (70 + d / 2)], [0, -a, 0]));
  }
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2, y = -280 + r() * 560;
    k.add('hull', G.sphere(14 + r() * 10, 16, 12), mat([Math.cos(a) * 92, y, Math.sin(a) * 92]));
  }
  // pipes running down the spine
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + 0.2;
    k.add('dark', G.cyl(3, 3, 560, 8), mat([Math.cos(a) * 76, 0, Math.sin(a) * 76]));
  }
  // antennae
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    k.add('dark', G.cyl(1.5, 1.5, 120, 6), mat([Math.cos(a) * 60, 380 + r() * 40, Math.sin(a) * 60], [r() * 0.3, 0, r() * 0.3]));
  }
  k.add('dark', G.cyl(60, 4, 30, 32), mat([90, 470, 40], [0.6, 0, 0.4]));
  const body = k.build(M, { uvTile: { hull: 40, dark: 30, window: 60 } });
  root.add(body);

  const beacons = [];
  const addBeacon = (p, color, size, phase, rate) => {
    const s = beaconSprite(color, size);
    s.position.copy(p);
    root.add(s);
    beacons.push({ s, phase, rate, base: size });
  };
  addBeacon(new THREE.Vector3(0, 842, 0), 0xff3020, 70, 0, 1.0);
  addBeacon(new THREE.Vector3(0, -455, 0), 0xff3020, 50, 0.5, 1.0);
  for (const side of [-1, 1]) addBeacon(new THREE.Vector3(side * 975, 430, 0), side < 0 ? 0xff2a1a : 0x20ff60, 50, 0.25, 0.8);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    addBeacon(new THREE.Vector3(Math.cos(a) * 470, -230, Math.sin(a) * 470), 0xffe0a0, 60, i * 0.1, 0);
    addBeacon(new THREE.Vector3(Math.cos(a) * 470, -190, Math.sin(a) * 470), 0x60a0ff, 30, i * 0.25, 2);
  }
  root.userData = { ring, beacons };
  // collision proxies (local space)
  const colliders = [];
  for (let y = -380; y <= 380; y += 60) colliders.push({ p: new THREE.Vector3(0, y, 0), r: 85 });
  for (let i = 0; i < 36; i++) {
    const a = i / 36 * Math.PI * 2;
    colliders.push({ p: new THREE.Vector3(Math.cos(a) * 420, 120, Math.sin(a) * 420), r: 48 });
  }
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    for (let d = 100; d <= 460; d += 45) colliders.push({ p: new THREE.Vector3(Math.cos(a) * d, -230, Math.sin(a) * d), r: 45 });
  }
  return { root, colliders };
}

// ---------------------------------------------------------------- stargate
function buildGate(M) {
  const root = new THREE.Group();
  const k = new Kit();
  k.add('hull', G.torus(420, 26, 20, 128), mat());
  k.add('dark', G.torus(450, 10, 8, 128), mat());
  k.add('dark', G.torus(392, 8, 8, 128), mat());
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    k.add('hull', G.rbox(70, 90, 110, 8), mat([Math.cos(a) * 425, Math.sin(a) * 425, 0], [0, 0, a]));
    k.add('dark', G.box(30, 140, 30), mat([Math.cos(a) * 470, Math.sin(a) * 470, 0], [0, 0, a]));
    k.add('blue', G.box(6, 30, 116), mat([Math.cos(a) * 382, Math.sin(a) * 382, 0], [0, 0, a]));
  }
  // support truss to control module
  k.add('dark', G.box(30, 600, 30), mat([0, -760, 0]));
  k.add('hull', G.rbox(160, 120, 160, 10), mat([0, -1100, 0]));
  k.add('window', G.box(162, 20, 162), mat([0, -1100, 0]));
  root.add(k.build(M, { uvTile: { hull: 40, dark: 30, window: 60 } }));
  const horizon = new THREE.Mesh(new THREE.CircleGeometry(390, 96), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `${LOGDEPTH_VERT_PARS} varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); ${LOGDEPTH_VERT} }`,
    fragmentShader: `${LOGDEPTH_FRAG_PARS} uniform float uTime; varying vec2 vUv; ${NOISE}
      void main(){ ${LOGDEPTH_FRAG}
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
        float sw = fbm(vec3(cos(a) * 1.5, sin(a) * 1.5, r * 3.0 - uTime * 0.6) + vec3(0.0, 0.0, a * 0.3), 5);
        float edge = smoothstep(1.0, 0.85, r);
        float i = (0.15 + 0.5 * smoothstep(-0.2, 0.6, sw)) * edge * (0.3 + 0.7 * smoothstep(0.2, 1.0, r));
        vec3 c = mix(vec3(0.1, 0.4, 1.0), vec3(0.6, 0.9, 1.0), smoothstep(0.3, 0.8, sw));
        gl_FragColor = vec4(c * i * 1.6, 1.0); }`,
  }));
  root.add(horizon);
  const beacons = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const s = beaconSprite(0x80c0ff, 40);
    s.position.set(Math.cos(a) * 545, Math.sin(a) * 545, 0);
    root.add(s);
    beacons.push({ s, phase: i / 12, rate: 0.5, base: 40 });
  }
  root.userData = { horizon, beacons };
  const colliders = [];
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 2;
    colliders.push({ p: new THREE.Vector3(Math.cos(a) * 425, Math.sin(a) * 425, 0), r: 60 });
  }
  colliders.push({ p: new THREE.Vector3(0, -1100, 0), r: 120 });
  return { root, colliders };
}

// ---------------------------------------------------------------- pirate outpost (derelict structures)
function buildOutpost(M) {
  const root = new THREE.Group();
  const k = new Kit();
  const r = rng(77);
  const colliders = [];
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Vector3((r() - 0.5) * 1600, (r() - 0.5) * 500, (r() - 0.5) * 1600);
    const w = 80 + r() * 160, h = 50 + r() * 90, d = 120 + r() * 260;
    const rot = [r() * 0.6, r() * Math.PI, r() * 0.6];
    k.add('dark', G.rbox(w, h, d, 8), mat(p.toArray(), rot));
    k.add('rust', G.box(w + 6, h * 0.25, d * 0.7), mat(p.toArray(), rot));
    if (r() < 0.6) k.add('window', G.box(w + 2, 8, d * 0.9), mat([p.x, p.y + h * 0.3, p.z], rot));
    colliders.push({ p, r: Math.max(w, h, d) * 0.55 });
    // girders sticking out (wreckage)
    for (let g = 0; g < 4; g++) {
      k.add('dark', G.box(6, 6, 80 + r() * 160), mat([p.x + (r() - 0.5) * w, p.y + (r() - 0.5) * h, p.z + (r() - 0.5) * d], [r() * 3, r() * 3, r() * 3]));
    }
  }
  // central tower
  k.add('rust', G.cyl(50, 70, 500, 12), mat([0, 0, 0]));
  k.add('dark', G.cyl(120, 120, 20, 12), mat([0, 200, 0]));
  k.add('dark', G.cyl(4, 4, 300, 6), mat([0, 400, 0]));
  colliders.push({ p: new THREE.Vector3(0, 0, 0), r: 80 }, { p: new THREE.Vector3(0, 200, 0), r: 120 }, { p: new THREE.Vector3(0, -200, 0), r: 80 });
  root.add(k.build(M, { uvTile: { dark: 30, rust: 30, window: 60 } }));
  const beacons = [];
  for (let i = 0; i < 6; i++) {
    const s = beaconSprite(0xff2010, 60);
    s.position.set((r() - 0.5) * 1200, (r() - 0.5) * 300, (r() - 0.5) * 1200);
    root.add(s);
    beacons.push({ s, phase: r(), rate: 1.4, base: 60 });
  }
  const top = beaconSprite(0xff2010, 90); top.position.set(0, 552, 0); root.add(top);
  beacons.push({ s: top, phase: 0, rate: 0.7, base: 90 });
  root.userData = { beacons };
  return { root, colliders };
}

// ---------------------------------------------------------------- asteroids
function makeAsteroidGeometries(count) {
  const simplex = new SimplexNoise({ random: rng(1234) });
  const geos = [];
  const r = rng(42);
  for (let g = 0; g < count; g++) {
    let geo = new THREE.IcosahedronGeometry(1, 5);
    geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
    geo = mergeVertices(geo);
    const pos = geo.attributes.position;
    const sx = 0.7 + r() * 0.6, sy = 0.6 + r() * 0.5, sz = 0.8 + r() * 0.6;
    const o = r() * 100;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      let d = 1 + 0.32 * simplex.noise3d(v.x * 1.1 + o, v.y * 1.1, v.z * 1.1)
        + 0.14 * simplex.noise3d(v.x * 2.6, v.y * 2.6 + o, v.z * 2.6)
        + 0.05 * simplex.noise3d(v.x * 6, v.y * 6, v.z * 6 + o)
        + 0.02 * simplex.noise3d(v.x * 14 + o, v.y * 14, v.z * 14);
      // craters
      for (let c = 0; c < 5; c++) {
        const cx = Math.sin(o + c * 7.1), cy = Math.cos(o * 1.3 + c * 3.7), cz = Math.sin(o * 0.7 + c * 5.3);
        const cl = Math.hypot(cx, cy, cz);
        const dd = v.distanceTo(new THREE.Vector3(cx / cl, cy / cl, cz / cl));
        if (dd < 0.45) d -= 0.08 * Math.cos(dd / 0.45 * Math.PI / 2) ** 2;
      }
      v.multiplyScalar(d);
      pos.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
    }
    geo.computeVertexNormals();
    boxUV(geo, 0.7);
    geo.computeBoundingSphere();
    geos.push(geo);
  }
  return geos;
}

function buildAsteroidField(center, env, count, spread, seed, tint) {
  const r = rng(seed);
  const maps = rockMaps(seed, 512, tint);
  const material = new THREE.MeshStandardMaterial({ map: maps.map, normalMap: maps.normalMap, normalScale: new THREE.Vector2(1.5, 1.5), roughness: 0.92, metalness: 0.05, envMap: env, envMapIntensity: 0.25 });
  const geos = makeAsteroidGeometries(5);
  const per = Math.ceil(count / geos.length);
  const group = new THREE.Group();
  const rocks = [];
  const meshes = geos.map((g) => {
    const m = new THREE.InstancedMesh(g, material, per);
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    group.add(m);
    return m;
  });
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    let p;
    for (;;) {
      p = new THREE.Vector3((r() * 2 - 1) * spread[0], (r() * 2 - 1) * spread[1], (r() * 2 - 1) * spread[2]);
      const l = Math.hypot(p.x / spread[0], p.y / spread[1], p.z / spread[2]);
      if (l > 1 || p.length() < 1800) continue;
      if (r() > 1.15 - l * 0.6) continue;
      break;
    }
    const size = 25 + Math.pow(r(), 3.2) * 520;
    e.set(r() * 6, r() * 6, r() * 6);
    q.setFromEuler(e);
    const axis = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    const gi = i % geos.length;
    rocks.push({ mesh: meshes[gi], idx: Math.floor(i / geos.length), pos: p.add(center), local: p.clone().sub(center), q: q.clone(), axis, spin: (r() - 0.5) * 0.04 / Math.sqrt(size / 50), size, radius: size * 0.92 });
  }
  const m4 = new THREE.Matrix4(), sc = new THREE.Vector3(), dq = new THREE.Quaternion();
  const update = (dt) => {
    for (const k of rocks) {
      dq.setFromAxisAngle(k.axis, k.spin * dt);
      k.q.premultiply(dq);
      sc.setScalar(k.size);
      m4.compose(k.pos, k.q, sc);
      k.mesh.setMatrixAt(k.idx, m4);
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  };
  for (const m of meshes) m.count = per;
  update(0);
  return { group, rocks, update };
}

// ---------------------------------------------------------------- dust
function makeDust() {
  const N = 1400;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 6), col = new Float32Array(N * 6);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  const seeds = [];
  const r = rng(3);
  for (let i = 0; i < N; i++) seeds.push(new THREE.Vector3(r(), r(), r()));
  const BOX = 500;
  const tmp = new THREE.Vector3(), tail = new THREE.Vector3();
  const update = (camPos, vel) => {
    const sp = vel.length();
    tail.copy(vel).multiplyScalar(-Math.min(0.06, 25 / Math.max(sp, 1)));
    if (tail.length() < 0.25) tail.set(0, 0.25, 0);
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      tmp.set(
        (((s.x * BOX - camPos.x) % BOX) + BOX) % BOX - BOX / 2,
        (((s.y * BOX - camPos.y) % BOX) + BOX) % BOX - BOX / 2,
        (((s.z * BOX - camPos.z) % BOX) + BOX) % BOX - BOX / 2,
      );
      const fade = Math.max(0, 1 - tmp.length() / (BOX * 0.5));
      const b = fade * fade * 0.5;
      tmp.add(camPos);
      pos[i * 6] = tmp.x; pos[i * 6 + 1] = tmp.y; pos[i * 6 + 2] = tmp.z;
      pos[i * 6 + 3] = tmp.x + tail.x; pos[i * 6 + 4] = tmp.y + tail.y; pos[i * 6 + 5] = tmp.z + tail.z;
      col[i * 6] = col[i * 6 + 1] = col[i * 6 + 2] = b * 0.8;
      col[i * 6 + 3] = col[i * 6 + 4] = col[i * 6 + 5] = 0;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  return { lines, update };
}

// ---------------------------------------------------------------- warp tunnel
function makeWarpTunnel() {
  const N = 900;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 6), col = new Float32Array(N * 6);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  lines.frustumCulled = false;
  lines.visible = false;
  const r = rng(8);
  const parts = [];
  for (let i = 0; i < N; i++) {
    const a = r() * Math.PI * 2, rad = 30 + Math.pow(r(), 0.6) * 400;
    parts.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad, z: (r() * 2 - 1) * 3000, len: 100 + r() * 500, c: 0.5 + r() * 0.5 });
  }
  // lines are built in a local frame where -Z is the travel direction
  const update = (dt, intensity, speed) => {
    lines.visible = intensity > 0.01;
    if (!lines.visible) return;
    for (let i = 0; i < N; i++) {
      const p = parts[i];
      p.z += speed * dt;
      if (p.z > 3000) p.z -= 6000;
      const L = p.len * intensity * 2;
      pos[i * 6] = p.x; pos[i * 6 + 1] = p.y; pos[i * 6 + 2] = p.z;
      pos[i * 6 + 3] = p.x; pos[i * 6 + 4] = p.y; pos[i * 6 + 5] = p.z - L;
      const fade = intensity * Math.max(0, 1 - Math.abs(p.z) / 3000);
      col[i * 6] = 0.5 * p.c * fade; col[i * 6 + 1] = 0.75 * p.c * fade; col[i * 6 + 2] = 1.6 * p.c * fade;
      col[i * 6 + 3] = col[i * 6 + 4] = col[i * 6 + 5] = 0;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  return { lines, update };
}

// ---------------------------------------------------------------- world assembly
export function buildWorld(renderer, scene) {
  // environment map from the sky (sun dimmed so reflections don't blow out)
  const envScene = new THREE.Scene();
  const envSky = makeSky(0.0);
  envSky.scale.setScalar(1000);
  envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0.02, 1, 5000).texture;
  pmrem.dispose();

  const sky = makeSky(1.0);
  scene.add(sky);
  const stars = makeStars();
  scene.add(stars);

  const sun = new THREE.DirectionalLight(0xfff2e0, 3.4);
  sun.position.copy(SUN_DIR).multiplyScalar(1000);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -180; sc.right = 180; sc.top = 180; sc.bottom = -180; sc.near = 10; sc.far = 3000;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.08;
  scene.add(sun, sun.target);
  // dim fill: planet bounce + ambient starlight
  const bounce = new THREE.DirectionalLight(0x6f8fbf, 0.12);
  bounce.position.copy(PLANET.pos).normalize().multiplyScalar(-1000).negate();
  scene.add(bounce, bounce.target);
  scene.add(new THREE.AmbientLight(0x2a3040, 0.35));

  const planet = new THREE.Mesh(new THREE.SphereGeometry(PLANET.radius, 256, 128), makePlanetMaterial(0, PLANET.radius));
  planet.position.copy(PLANET.pos);
  planet.rotation.z = 0.35;
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(PLANET.radius * 1.006, 192, 96), makeClouds(PLANET.radius * 1.006));
  clouds.position.copy(PLANET.pos);
  clouds.rotation.z = 0.35;
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(PLANET.radius * 1.045, 128, 64), makeAtmosphere(PLANET.pos, PLANET.radius, PLANET.radius * 1.045));
  atmo.position.copy(PLANET.pos);
  scene.add(planet, clouds, atmo);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON.radius, 160, 80), makePlanetMaterial(1, MOON.radius));
  moon.position.copy(MOON.pos);
  scene.add(moon);

  const SM = stationMaterials(env);
  const rustMaps = hullMaps({ seed: 31, base: [92, 62, 48], accent: [150, 40, 25], accentChance: 0.08, darkChance: 0.25, wear: 1.0 });
  SM.rust = new THREE.MeshStandardMaterial({ map: rustMaps.map, normalMap: rustMaps.normalMap, roughnessMap: rustMaps.roughnessMap, metalness: 0.6, roughness: 0.75, envMap: env, envMapIntensity: 0.4 });

  const structures = [];
  const station = buildStation(SM);
  station.root.position.copy(LOCATIONS[0].pos);
  station.root.rotation.y = 0.4;
  scene.add(station.root);
  structures.push({ obj: station.root, colliders: station.colliders, loc: LOCATIONS[0] });

  const gate = buildGate(SM);
  gate.root.position.copy(LOCATIONS[3].pos);
  gate.root.lookAt(0, 0, 0);
  scene.add(gate.root);
  structures.push({ obj: gate.root, colliders: gate.colliders, loc: LOCATIONS[3] });

  const outpost = buildOutpost(SM);
  outpost.root.position.copy(LOCATIONS[2].pos);
  scene.add(outpost.root);
  structures.push({ obj: outpost.root, colliders: outpost.colliders, loc: LOCATIONS[2] });

  const belt = buildAsteroidField(LOCATIONS[1].pos, env, 520, [14000, 3500, 14000], 101, [118, 108, 98]);
  scene.add(belt.group);
  const outRocks = buildAsteroidField(LOCATIONS[2].pos, env, 120, [8000, 3000, 8000], 202, [92, 80, 72]);
  scene.add(outRocks.group);
  const rocks = belt.rocks.concat(outRocks.rocks);

  const dust = makeDust();
  scene.add(dust.lines);
  const warp = makeWarpTunnel();
  scene.add(warp.lines);

  let time = 0;
  const _wp = new THREE.Vector3();
  const worldColliders = [];

  const world = {
    env, sun, sky, stars, planet, clouds, moon, station, gate, rocks, dust, warp, structures,
    update(dt, camera, focus) {
      time += dt;
      sky.position.copy(camera.position);
      stars.position.copy(camera.position);
      planet.rotation.y += dt * 0.0012;
      clouds.rotation.y += dt * 0.0016;
      clouds.material.uniforms.uTime.value = time;
      planet.material.uniforms.uTime.value = time;
      station.root.userData.ring.rotation.y += dt * 0.03;
      gate.root.userData.horizon.material.uniforms.uTime.value = time;
      for (const st of [station.root, gate.root, outpost.root]) {
        for (const b of st.userData.beacons) {
          const on = b.rate === 0 ? 1 : (Math.sin((time * b.rate + b.phase) * Math.PI * 2) > 0.6 ? 1 : 0.08);
          b.s.material.opacity = on;
        }
      }
      // asteroids only need animating when near
      if (focus.distanceTo(LOCATIONS[1].pos) < 40000) belt.update(dt);
      if (focus.distanceTo(LOCATIONS[2].pos) < 40000) outRocks.update(dt);
      // shadow frustum follows the focus
      sun.target.position.copy(focus);
      sun.position.copy(focus).addScaledVector(SUN_DIR, 1500);
    },
    // world-space collision spheres near a point
    collidersNear(p, range) {
      worldColliders.length = 0;
      for (const s of structures) {
        if (s.obj.position.distanceTo(p) > range + 2500) continue;
        s.obj.updateMatrixWorld();
        for (const c of s.colliders) {
          _wp.copy(c.p).applyMatrix4(s.obj.matrixWorld);
          if (_wp.distanceTo(p) < range + c.r) worldColliders.push({ p: _wp.clone(), r: c.r });
        }
      }
      for (const k of rocks) {
        if (k.pos.distanceTo(p) < range + k.radius) worldColliders.push({ p: k.pos, r: k.radius });
      }
      return worldColliders;
    },
    stars,
  };
  return world;
}
