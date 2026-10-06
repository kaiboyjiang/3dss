import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE, LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './shaders.js';
import { hullMaps, rockMaps, windowMaps, solarPanelMaps, glowTexture, rng } from './textures.js';
import { Kit, G, mat, boxUV } from './geo.js';
import { SYSTEMS } from './systems.js';

export const SUN_DIR = new THREE.Vector3(0.78, 0.32, 0.2).normalize();
export const LOCATIONS = [];

// ---------------------------------------------------------------- sky
export const SUN_COL = new THREE.Color(1.0, 0.92, 0.8);
const SKY_U = {
  uSun: { value: SUN_DIR }, uSunCol: { value: SUN_COL }, uSunSize: { value: 1 },
  uNebDir: { value: new THREE.Vector3(-0.6, 0.25, -0.75).normalize() },
  uNeb1: { value: new THREE.Color(0.85, 0.18, 0.32) }, uNeb2: { value: new THREE.Color(0.15, 0.45, 0.95) },
  uNeb3: { value: new THREE.Color(1.0, 0.55, 0.2) }, uNebAmt: { value: 0.45 },
  uCube: { value: null },
};

// expensive procedural sky, rendered once into a cubemap
function makeSkyBake() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: SKY_U,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun, uSunCol, uNebDir, uNeb1, uNeb2, uNeb3; uniform float uNebAmt;
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
        col += vec3(0.55, 0.5, 0.45) * band * (0.25 + 0.3 * n2) * mix(1.0, 0.15, lanes * band);
        col += vec3(0.12, 0.14, 0.2) * bandWide * 0.12;
        // emission nebula region
        vec3 nc = uNebDir;
        float nr = max(dot(d, nc), 0.0);
        float neb = smoothstep(0.55, 1.0, nr) * smoothstep(-0.2, 0.6, n1 + 0.3 * n2);
        float warp = fbm(d * 4.0 + vec3(n1, n2, 0.0) * 1.5, 6);
        vec3 nebCol = mix(uNeb1, uNeb2, smoothstep(-0.3, 0.4, warp));
        nebCol = mix(nebCol, uNeb3, smoothstep(0.35, 0.7, warp) * 0.6);
        col += nebCol * neb * pow(0.25 + 0.75 * max(warp, 0.0), 1.6) * uNebAmt;
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
        col += uSunCol * vec3(1.0, 0.76, 0.56) * pow(sdot, 60.0) * 0.22;
        col += uSunCol * pow(sdot, 6.0) * 0.02;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 32), mat);
  mesh.frustumCulled = false;
  return mesh;
}

// live sky: cubemap lookup plus the analytic sun disk and glare
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: SKY_U,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform samplerCube uCube; uniform vec3 uSun, uSunCol; uniform float uSunSize;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = textureCube(uCube, d).rgb;
        float sdot = max(dot(d, uSun), 0.0);
        float s2 = uSunSize * uSunSize;
        float disk = smoothstep(1.0 - 0.00015 * s2, 1.0 - 0.00008 * s2, sdot);
        col += uSunCol * disk * 60.0;
        col += uSunCol * vec3(1.0, 0.82, 0.62) * pow(sdot, 900.0 / uSunSize) * 7.0;
        col += uSunCol * pow(sdot, 220.0 / uSunSize) * 0.7;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
  mesh.scale.setScalar(1.8e6);
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  return mesh;
}

// render the procedural sky into the cubemap and refresh the reflection env from it
function bakeSky(renderer, cube, envCube, pmrem, envTarget) {
  const s = new THREE.Scene();
  const m = makeSkyBake();
  s.add(m);
  new THREE.CubeCamera(1, 5000, cube).update(renderer, s);
  new THREE.CubeCamera(1, 5000, envCube).update(renderer, s);
  m.geometry.dispose(); m.material.dispose();
  SKY_U.uCube.value = cube.texture;
  return pmrem.fromCubemap(envCube.texture, envTarget);
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
    const b = Math.pow(r(), 6) * 2.6 + 0.22;
    col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
    size[i] = 2.2 + Math.pow(r(), 4) * 2.2;
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
        gl_PointSize = max(size * uPixel, 2.0);
        ${LOGDEPTH_VERT}
      }`,
    fragmentShader: /* glsl */`
      ${LOGDEPTH_FRAG_PARS}
      varying vec3 vCol;
      void main() {
        ${LOGDEPTH_FRAG}
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = exp(-d * d * 3.0) * smoothstep(1.0, 0.7, d);
        gl_FragColor = vec4(vCol * a * 0.8, 1.0);
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

export const GFX_U = { uDetail: { value: 0 } };
const PTYPE_ID = { temperate: 0, barren: 1, gas: 2, desert: 3, ice: 4, lava: 5, ocean: 6 };
function makePlanetMaterial(P) {
  const atmo = P.atmo || [0.3, 0.55, 1.0];
  return new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: SUN_DIR }, uSunCol: { value: SUN_COL }, uRadius: { value: P.radius }, uType: { value: PTYPE_ID[P.type] }, uTime: { value: 0 },
      uSeed: { value: new THREE.Vector3(P.seed, P.seed * 1.7, P.seed * 0.3) }, uTint: { value: new THREE.Vector3(...P.tint) },
      uAtmo: { value: new THREE.Vector3(...atmo) }, uHaze: { value: P.atmo ? 0.75 : 0 }, uSea: { value: P.type === 'ocean' ? 0.26 : 0.02 }, uDetail: GFX_U.uDetail,
    },
    vertexShader: PLANET_VERT,
    fragmentShader: /* glsl */`
      ${LOGDEPTH_FRAG_PARS}
      uniform vec3 uSun, uSunCol, uSeed, uTint, uAtmo; uniform float uRadius, uType, uTime, uHaze, uSea, uDetail;
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
        vec3 sp = p + uSeed;
        vec3 N = normalize(vWN);
        vec3 V = normalize(cameraPosition - vWP);
        float NdV = max(dot(N, V), 0.0);
        vec3 col; float spec = 0.0; vec3 emit = vec3(0.0);
        float NdL0 = dot(N, uSun);
        // octave LOD from on-screen footprint: skip noise detail smaller than a pixel
        int L = int(clamp(-log2(max(length(fwidth(p)), 1e-6)) - 2.0 + uDetail, 3.0, 8.0 + max(uDetail, 0.0)));
        int L2 = L > 4 ? L - 2 : 3;
        float lat = abs(p.y);
        if (uType < 0.5 || uType > 5.5) {
          vec3 q = sp + 0.15 * vec3(fbm(sp * 2.0, 4), fbm(sp * 2.0 + 5.2, 4), fbm(sp * 2.0 + 9.1, 4));
          float h = fbm(q * 1.7, L) + 0.35 * ridged(q * 3.2, L2 + 1) - 0.2;
          float sea = uSea;
          float land = smoothstep(sea, sea + 0.01, h);
          float e = max(h - sea, 0.0);
          float moist = fbm(sp * 3.1 + 40.0, L2);
          vec3 deep = vec3(0.005, 0.03, 0.09), shallow = vec3(0.02, 0.12, 0.2);
          vec3 ocean = mix(deep, shallow, smoothstep(sea - 0.27, sea, h));
          vec3 sand = vec3(0.55, 0.48, 0.34), forest = vec3(0.07, 0.16, 0.05), grass = vec3(0.2, 0.28, 0.1);
          vec3 desert = vec3(0.6, 0.42, 0.24), rock = vec3(0.32, 0.29, 0.26), snow = vec3(0.9, 0.92, 0.95);
          vec3 lc = mix(desert, mix(grass, forest, smoothstep(0.0, 0.3, moist)), smoothstep(-0.25, 0.05, moist - lat * 0.3 + 0.1));
          lc = mix(sand, lc, smoothstep(0.0, 0.03, e));
          lc = mix(lc, rock, smoothstep(0.2, 0.38, e));
          lc = mix(lc, snow, smoothstep(0.42, 0.55, e + lat * 0.25));
          col = mix(ocean, lc, land);
          float ice = smoothstep(0.78, 0.86, lat + fbm(sp * 6.0, 4) * 0.08);
          col = mix(col, snow, ice);
          N = bump(N, e * land * 2500.0, 1.0);
          spec = (1.0 - land) * (1.0 - ice);
          vec3 cp = sp + vec3(uTime * 0.002, 0.0, 0.0);
          float cl = smoothstep(0.05, 0.5, fbm(cp * 3.0 + fbm(cp * 1.4, 3), 4));
          col *= 1.0 - cl * 0.55 * smoothstep(-0.1, 0.3, NdL0);
          if (NdL0 < 0.1 && uType < 0.5) {
            float cityAA = 1.0 - smoothstep(0.15, 0.6, length(fwidth(p * 45.0)));
            float city = cityAA * smoothstep(0.58, 0.85, fbm(sp * 45.0, 4) + 0.5) * land * (1.0 - ice) * smoothstep(0.35, 0.05, e) * smoothstep(0.1, -0.12, NdL0);
            emit = vec3(1.0, 0.62, 0.28) * city * 0.9 * (1.0 - cl * 0.7);
          }
        } else if (uType > 1.5 && uType < 2.5) {
          // gas giant: turbulent latitude bands
          float y = p.y + 0.06 * fbm(sp * 3.0 + vec3(uTime * 0.002, 0.0, 0.0), L2);
          float b = fbm(vec3(y * 9.0, uSeed.x, 0.5), 4);
          float b2 = fbm(vec3(y * 26.0 + fbm(sp * 6.0, L2) * 0.6, uSeed.y, 1.5), 3);
          col = mix(uTint * 0.5, uTint * 1.12, smoothstep(-0.45, 0.45, b));
          col = mix(col, uTint.zyx * 0.75 + 0.1, smoothstep(0.15, 0.6, b2) * 0.35);
          vec3 so = normalize(vec3(sin(uSeed.x), -0.35, cos(uSeed.x)));
          float storm = smoothstep(0.16, 0.0, length((p - so) * vec3(1.0, 2.2, 1.0)));
          col = mix(col, vec3(0.75, 0.38, 0.24), storm * 0.7);
          col *= 0.8 + 0.2 * smoothstep(0.98, 0.7, lat);
        } else {
          // rocky bodies: barren / desert / ice / lava
          float h = fbm(sp * 2.5, L) * 0.5 + ridged(sp * 5.0, L2) * 0.3;
          float cr = 0.0;
          for (int i = 0; i < 3; i++) {
            float sc = 6.0 * pow(2.6, float(i));
            vec3 c = floor(sp * sc); vec3 hsh = hash33(c);
            vec3 cc = (c + 0.25 + hsh * 0.5) / sc;
            float d = length(sp - cc) * sc / (0.25 + hsh.x * 0.25);
            cr += (smoothstep(1.0, 0.7, d) * -0.6 + smoothstep(0.7, 1.0, d) * smoothstep(1.3, 1.0, d) * 0.5) * step(0.4, hsh.y) / float(i + 1);
          }
          float isDes = step(2.5, uType) * step(uType, 3.5), isIce = step(3.5, uType) * step(uType, 4.5), isLava = step(4.5, uType);
          h += cr * mix(0.3, 0.08, isDes + isIce * 0.6);
          col = mix(uTint * 0.38, uTint, smoothstep(-0.3, 0.6, h));
          col = mix(col, uTint * 0.17, smoothstep(0.1, 0.4, fbm(sp * 1.3 + 7.0, 4)) * 0.7 * (1.0 - isIce));
          if (isDes > 0.5) col *= 0.82 + 0.18 * sin((sp.x + sp.z * 0.6) * 70.0 + fbm(sp * 8.0, 3) * 7.0);
          if (isIce > 0.5) {
            col = mix(col, vec3(0.42, 0.58, 0.75), smoothstep(0.62, 0.7, ridged(sp * 4.0, L2)) * 0.6);
            spec = 0.25;
          }
          if (isLava > 0.5) {
            float cracks = smoothstep(0.72, 0.95, ridged(sp * 3.0, L2 + 1));
            emit = vec3(2.6, 0.75, 0.15) * cracks * (0.35 + 0.65 * smoothstep(0.25, -0.2, NdL0));
          }
          N = bump(N, h * 900.0, 1.0);
        }
        float NdL = dot(N, uSun);
        float diff = max(NdL, 0.0);
        float term = smoothstep(-0.12, 0.25, NdL0);
        vec3 c = col * uSunCol * 2.6 * diff * mix(1.0, term, 0.5);
        if (spec > 0.0) {
          vec3 H = normalize(uSun + V);
          vec3 Ns = normalize(vWN);
          c += uSunCol * pow(max(dot(Ns, H), 0.0), 180.0) * spec * 3.0 * term;
          c += uSunCol * pow(max(dot(Ns, H), 0.0), 18.0) * spec * 0.08 * term;
        }
        if (uHaze > 0.0) {
          float haze = pow(1.0 - NdV, 2.5);
          vec3 sky = mix(vec3(0.9, 0.35, 0.12), uAtmo, smoothstep(-0.05, 0.35, NdL0));
          c = mix(c, sky * 1.4 * uSunCol * smoothstep(-0.2, 0.25, NdL0), haze * uHaze);
          c += uAtmo * 0.1 * term * 0.4;
        }
        c += emit;
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

function makeAtmosphere(center, radius, outer, col = [0.3, 0.55, 1.0]) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { uSun: { value: SUN_DIR }, uSunCol: { value: SUN_COL }, uCol: { value: new THREE.Vector3(...col) }, uCenter: { value: center }, uR: { value: radius }, uRa: { value: outer } },
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
      uniform vec3 uSun, uSunCol, uCol; uniform vec3 uCenter; uniform float uR; uniform float uRa;
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
        vec3 c = mix(vec3(1.0, 0.4, 0.15), uCol, smoothstep(-0.1, 0.4, sunAmt)) * uSunCol;
        float fw = pow(max(dot(rd, uSun), 0.0), 8.0);
        gl_FragColor = vec4(c * dens * day * (1.6 + fw * 4.0), 1.0);
      }`,
  });
}

// ---------------------------------------------------------------- materials
function makeRing(P) {
  const inner = P.radius * 1.35, outer = P.radius * 2.25;
  const geo = new THREE.RingGeometry(inner, outer, 160, 1);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uSun: { value: SUN_DIR }, uSunCol: { value: SUN_COL }, uIn: { value: inner }, uOut: { value: outer }, uR: { value: P.radius }, uCenter: { value: P.pos }, uTint: { value: new THREE.Vector3(...P.tint) }, uSeed: { value: P.seed } },
    vertexShader: `${LOGDEPTH_VERT_PARS} varying vec3 vL; varying vec3 vWP; void main(){ vL = position; vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; ${LOGDEPTH_VERT} }`,
    fragmentShader: `${LOGDEPTH_FRAG_PARS} uniform vec3 uSun, uSunCol, uCenter, uTint; uniform float uIn, uOut, uR, uSeed; varying vec3 vL; varying vec3 vWP;
      float h1(float x){ return fract(sin(x * 127.1 + uSeed) * 43758.5453); }
      void main(){ ${LOGDEPTH_FRAG}
        float t = (length(vL.xy) - uIn) / (uOut - uIn);
        float x = t * 64.0; float i = floor(x); float f = fract(x);
        float dens = mix(h1(i), h1(i + 1.0), smoothstep(0.0, 1.0, f));
        dens = smoothstep(0.15, 0.9, dens) * smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.9, t);
        dens *= 1.0 - 0.8 * smoothstep(0.02, 0.0, abs(t - 0.62));
        // planet shadow on the ring
        vec3 oc = vWP - uCenter; float b = dot(oc, uSun); float cc = dot(oc, oc) - uR * uR;
        float sh = (b < 0.0 && b * b - cc > 0.0) ? 0.04 : 1.0;
        vec3 c = uTint * uSunCol * (0.55 + 0.6 * dens) * 1.3 * sh;
        gl_FragColor = vec4(c, dens * 0.8); }`,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.copy(P.pos);
  mesh.rotation.x = -Math.PI / 2 + 0.38;
  mesh.rotation.y = 0.2;
  return mesh;
}

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
    gold: new THREE.MeshStandardMaterial({ color: 0xb8902c, metalness: 0.95, roughness: 0.32, envMap: env, envMapIntensity: 1.1 }),
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

// ---------------------------------------------------------------- enclosed docking bay
// a hollow hangar pod at angle a whose back wall sits at radius r0 and whose mouth opens outward
function bayPod(k, a, r0, y, W, H, D) {
  const c = Math.cos(a), s = Math.sin(a), ry = Math.atan2(c, s);
  const Z = new THREE.Vector3(c, 0, s), X = new THREE.Vector3(s, 0, -c);
  const mouth = new THREE.Vector3(c * (r0 + D), y, s * (r0 + D));
  const at = (x, yy, z) => mouth.clone().addScaledVector(X, x).addScaledVector(Z, z).setY(y + yy);
  const put = (key, geo, x, yy, z) => k.add(key, geo, mat(at(x, yy, z).toArray(), [0, ry, 0]));
  const t = 10;
  put('dark', G.box(W + 2 * t, t, D), 0, -H / 2 - t / 2, -D / 2);
  put('hull', G.box(W + 2 * t, t, D), 0, H / 2 + t / 2, -D / 2);
  put('dark', G.box(W, H, t), 0, 0, -D - t / 2);
  put('hangar', G.box(W * 0.45, H * 0.55, 2), 0, -H * 0.12, -D + 1);
  put('light', G.box(W * 0.5, 2, 2), 0, H * 0.2, -D + 1.5);
  for (const sx of [-1, 1]) {
    put('hull', G.box(t, H, D), sx * (W / 2 + t / 2), 0, -D / 2);
    put('window', G.box(t + 1, 8, D * 0.7), sx * (W / 2 + t / 2), H * 0.28, -D * 0.55);
    put('light', G.box(3, 2, D - 20), sx * (W / 2 - 8), H / 2 - 3, -D / 2);
    put('light', G.box(2, 1.5, D - 20), sx * (W / 2 - 2), -H / 2 + 6, -D / 2);
    put('hangar', G.box(2, 0.6, D - 10), sx * W * 0.22, -H / 2 + 0.4, -D / 2);
    put('dark', G.box(t + 12, H + 2 * t + 24, 16), sx * (W / 2 + t / 2), 0, 0);
  }
  for (const sy of [-1, 1]) put('dark', G.box(W + 2 * t + 24, t + 12, 16), 0, sy * (H / 2 + t / 2), 0);
  for (let z = -D + 30; z < -20; z += 55) {
    put('dark', G.box(W, 8, 8), 0, H / 2 - 4, z);
    put('light', G.box(W * 0.4, 1.5, 3), 0, H / 2 - 8.5, z);
    for (const sx of [-1, 1]) put('dark', G.box(8, H, 8), sx * (W / 2 - 4), 0, z);
  }
  const beacons = [], colliders = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) beacons.push([at(sx * (W / 2 + t + 6), sy * (H / 2 + t + 6), 9), sy > 0 ? 0xffe0a0 : 0xff4030]);
  for (let z = -D; z <= 0; z += 40) {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) colliders.push(at(sx * (W / 2 + 22), sy * H / 4, z));
    for (const sx of [-1, 0, 1]) for (const sy of [-1, 1]) colliders.push(at(sx * W / 3, sy * (H / 2 + 22), z));
  }
  for (const sx of [-1, 0, 1]) colliders.push(at(sx * W / 3, 0, -D - 22));
  return { bay: { pos: mouth, dir: Z, depth: D, h: H }, beacons, colliders };
}
function finishPods(pods, addBeacon, colliders) {
  pods.forEach((pd, i) => {
    pd.beacons.forEach(([p, col], j) => addBeacon(p, col, 34, i * 0.13 + j * 0.25, 1.2));
    for (const p of pd.colliders) colliders.push({ p, r: 26 });
  });
  return pods.map((pd) => pd.bay);
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
  const pods = [0, 1, 2, 3].map((i) => bayPod(k, Math.PI / 4 + i * Math.PI / 2, 478, -230, 220, 110, 340));
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
  return { root, colliders, bays: finishPods(pods, addBeacon, colliders) };
}

// ---------------------------------------------------------------- high-tech orbital shipyard
function truss(k, key, a, b, w, seg) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(B, A);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  const off = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const local = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(mid).toArray();
  for (const [x, y] of off) k.add(key, G.box(w * 0.08, w * 0.08, len), mat(local(x * w / 2, y * w / 2, 0), [e.x, e.y, e.z]));
  const n = Math.max(1, Math.round(len / seg));
  for (let i = 0; i <= n; i++) {
    const z = -len / 2 + i * len / n;
    k.add(key, G.box(w, w * 0.06, w * 0.06), mat(local(0, w / 2, z), [e.x, e.y, e.z]));
    k.add(key, G.box(w, w * 0.06, w * 0.06), mat(local(0, -w / 2, z), [e.x, e.y, e.z]));
    k.add(key, G.box(w * 0.06, w, w * 0.06), mat(local(w / 2, 0, z), [e.x, e.y, e.z]));
    k.add(key, G.box(w * 0.06, w, w * 0.06), mat(local(-w / 2, 0, z), [e.x, e.y, e.z]));
    if (i < n) {
      const dz = len / n;
      const diag = Math.hypot(w, dz);
      const ang = Math.atan2(w, dz);
      for (const sx of [1, -1]) {
        const qd = new THREE.Quaternion().setFromEuler(new THREE.Euler(sx * ang, 0, 0));
        const ed = new THREE.Euler().setFromQuaternion(q.clone().multiply(qd));
        k.add(key, G.box(w * 0.05, w * 0.05, diag), mat(local(sx * w / 2, 0, z + dz / 2), [ed.x, ed.y, ed.z]));
      }
    }
  }
}

function buildShipyard(M) {
  const root = new THREE.Group();
  const k = new Kit();
  const r = rng(808);
  const colliders = [];
  // command core
  k.add('hull', G.sphere(150, 48, 32), mat([0, 0, 0]));
  k.add('window', G.cyl(152, 152, 24, 48, true), mat([0, 0, 0]));
  k.add('window', G.cyl(128, 128, 16, 48, true), mat([0, 70, 0]));
  k.add('dark', G.cyl(160, 160, 12, 48), mat([0, -40, 0]));
  k.add('hull', G.cyl(42, 60, 320, 32), mat([0, 260, 0]));
  k.add('hull', G.cyl(60, 42, 300, 32), mat([0, -250, 0]));
  for (const y of [180, 260, 340, -200, -300]) k.add('dark', G.cyl(72, 72, 12, 32), mat([0, y, 0]));
  k.add('blue', G.cyl(62, 62, 6, 32, true), mat([0, 300, 0]));
  k.add('blue', G.cyl(62, 62, 6, 32, true), mat([0, -260, 0]));
  k.add('dark', G.cyl(10, 10, 240, 12), mat([0, 540, 0]));
  k.add('dark', G.cyl(120, 6, 40, 32), mat([0, 440, 0]));
  colliders.push({ p: new THREE.Vector3(0, 0, 0), r: 160 });
  for (let y = -380; y <= 420; y += 80) if (Math.abs(y) > 140) colliders.push({ p: new THREE.Vector3(0, y, 0), r: 70 });
  // static docking ring with spokes
  k.add('dark', G.torus(360, 18, 16, 128), mat([0, -120, 0], [Math.PI / 2, 0, 0]));
  k.add('blue', G.torus(360, 18.5, 3, 128), mat([0, -120, 0], [Math.PI / 2, 0, 0], [1, 1, 0.2]));
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    k.add('hull', G.cyl(8, 8, 260, 10), mat([Math.cos(a) * 220, -120, Math.sin(a) * 220], [0, -a, Math.PI / 2]));
    k.add('hull', G.rbox(50, 34, 60, 5), mat([Math.cos(a) * 360, -120, Math.sin(a) * 360], [0, -a, 0]));
    k.add('hangar', G.box(4, 18, 34), mat([Math.cos(a) * 386, -120, Math.sin(a) * 386], [0, -a, 0]));
    k.add('light', G.box(3, 3, 3), mat([Math.cos(a) * 390, -98, Math.sin(a) * 390]));
  }
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2;
    colliders.push({ p: new THREE.Vector3(Math.cos(a) * 360, -120, Math.sin(a) * 360), r: 36 });
  }
  // construction gantries (two slips, one with a hull under construction)
  for (const side of [1, -1]) {
    const z0 = side * 120;
    const x0 = 200, x1 = 1150;
    for (const [dy, dz] of [[90, 90], [90, -90], [-90, 90], [-90, -90]]) truss(k, 'dark', [x0, dy, z0 + dz], [x1, dy, z0 + dz], 16, 60);
    for (let x = x0; x <= x1; x += 190) {
      truss(k, 'hull', [x, 90, z0 - 90], [x, 90, z0 + 90], 12, 45);
      truss(k, 'hull', [x, -90, z0 - 90], [x, -90, z0 + 90], 12, 45);
      truss(k, 'hull', [x, -90, z0 + 90], [x, 90, z0 + 90], 12, 45);
      truss(k, 'hull', [x, -90, z0 - 90], [x, 90, z0 - 90], 12, 45);
      k.add('light', G.box(6, 4, 6), mat([x, 96, z0 + 90]));
      k.add('light', G.box(6, 4, 6), mat([x, 96, z0 - 90]));
    }
    k.add('dark', G.box(80, 12, 200), mat([x1 + 20, 90, z0]));
    k.add('hull', G.rbox(60, 60, 60, 6), mat([x0 - 20, 0, z0]));
    for (let x = x0 + 40; x <= x1; x += 120) colliders.push({ p: new THREE.Vector3(x, 0, z0), r: 130 });
  }
  // hull under construction in the +Z slip: keel, ribs and partial plating
  const hz = 120;
  k.add('dark', G.box(560, 14, 18), mat([640, -30, hz]));
  for (let i = 0; i < 14; i++) {
    const x = 380 + i * 40;
    const s = 1 - Math.abs(i - 6) / 12;
    k.add('dark', G.torus(46 * s + 14, 3, 6, 24, Math.PI), mat([x, -30, hz], [0, Math.PI / 2, 0]));
    if (i > 3 && i < 11) k.add('hull', G.box(36, 4, 90 * s + 20), mat([x, 10 + 30 * s, hz]));
  }
  k.add('hull', G.rbox(150, 60, 110, 10), mat([440, -10, hz]));
  for (let i = 0; i < 6; i++) k.add('light', G.box(4, 2, 4), mat([440 + r() * 400, 60 + r() * 20, hz + (r() - 0.5) * 120]));
  // the -Z slip holds a finished frigate-sized hull with the cradle arms
  k.add('hull', G.rbox(220, 40, 70, 12), mat([700, 0, -hz]));
  k.add('accent' in M ? 'accent' : 'dark', G.rbox(224, 8, 72, 3), mat([700, 12, -hz]));
  k.add('dark', G.rbox(70, 30, 60, 6), mat([570, 0, -hz]));
  k.add('blue', G.cyl(14, 14, 2, 20), mat([590 - 112, 0, -hz + 18], [0, 0, Math.PI / 2]));
  k.add('blue', G.cyl(14, 14, 2, 20), mat([590 - 112, 0, -hz - 18], [0, 0, Math.PI / 2]));
  // radiator wings
  for (const side of [1, -1]) {
    k.add('dark', G.box(16, 16, 520), mat([-140, 200, side * 300]));
    for (let j = 0; j < 4; j++) k.add('solar', G.box(220, 2, 110), mat([-140, 200, side * (110 + j * 130)]));
  }
  // greebles on the core
  for (let i = 0; i < 120; i++) {
    const a = r() * Math.PI * 2, el = (r() - 0.5) * 2.2;
    const p = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).multiplyScalar(150);
    const w = 6 + r() * 18;
    const g = G.box(w, 4 + r() * 12, 4 + r() * 16);
    const m4 = new THREE.Matrix4().lookAt(p, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)).setPosition(p);
    k.add(r() < 0.5 ? 'dark' : 'hull', g, m4);
  }
  const pods = [Math.PI / 2, Math.PI, Math.PI * 1.5].map((a) => bayPod(k, a, 396, -120, 220, 110, 320));
  root.add(k.build(M, { uvTile: { hull: 40, dark: 30, window: 60 } }));
  // rotating habitat ring
  const ringK = new Kit();
  ringK.add('hull', G.torus(560, 26, 20, 192), mat([0, 0, 0], [Math.PI / 2, 0, 0]));
  ringK.add('window', G.torus(560, 26.6, 4, 192), mat([0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 0.55]));
  ringK.add('blue', G.torus(560, 29, 4, 192), mat([0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 0.08]));
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 4;
    ringK.add('dark', G.cyl(7, 7, 410, 10), mat([Math.cos(a) * 355, 0, Math.sin(a) * 355], [0, -a, Math.PI / 2]));
    ringK.add('hull', G.rbox(70, 60, 70, 6), mat([Math.cos(a) * 560, 0, Math.sin(a) * 560], [0, -a, 0]));
  }
  const ring = ringK.build(M, { uvTile: { hull: 40, dark: 30 } });
  ring.position.y = 120;
  ring.rotation.x = 0.0;
  root.add(ring);
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2;
    colliders.push({ p: new THREE.Vector3(Math.cos(a) * 560, 120, Math.sin(a) * 560), r: 40 });
  }
  const beacons = [];
  const addBeacon = (p, color, size, phase, rate) => {
    const s = beaconSprite(color, size);
    s.position.copy(p);
    root.add(s);
    beacons.push({ s, phase, rate, base: size });
  };
  addBeacon(new THREE.Vector3(0, 665, 0), 0x40a0ff, 80, 0, 0.8);
  addBeacon(new THREE.Vector3(0, -410, 0), 0xff3020, 50, 0.5, 1.0);
  for (const side of [1, -1]) {
    addBeacon(new THREE.Vector3(1180, 100, side * 210), 0x40a0ff, 60, 0.2, 1.2);
    addBeacon(new THREE.Vector3(1180, -100, side * 30), 0xffffff, 40, 0.6, 1.2);
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    addBeacon(new THREE.Vector3(Math.cos(a) * 392, -120, Math.sin(a) * 392), 0x80d0ff, 30, i / 8, 0.5);
  }
  root.userData = { ring, beacons };
  return { root, colliders, bays: finishPods(pods, addBeacon, colliders) };
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
    uniforms: { uTime: { value: 0 }, uBoost: { value: 0 } },
    vertexShader: `${LOGDEPTH_VERT_PARS} varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); ${LOGDEPTH_VERT} }`,
    fragmentShader: `${LOGDEPTH_FRAG_PARS} uniform float uTime, uBoost; varying vec2 vUv; ${NOISE}
      void main(){ ${LOGDEPTH_FRAG}
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
        float sw = fbm(vec3(cos(a) * 1.5, sin(a) * 1.5, r * 3.0 - uTime * 0.6) + vec3(0.0, 0.0, a * 0.3), 5);
        float edge = smoothstep(1.0, 0.85, r);
        float i = (0.15 + 0.5 * smoothstep(-0.2, 0.6, sw)) * edge * (0.3 + 0.7 * smoothstep(0.2, 1.0, r));
        vec3 c = mix(vec3(0.1, 0.4, 1.0), vec3(0.6, 0.9, 1.0), smoothstep(0.3, 0.8, sw));
        i = mix(i, edge * (0.6 + 0.6 * smoothstep(-0.2, 0.6, sw)), uBoost);
        gl_FragColor = vec4(c * i * (1.6 + uBoost * 2.4), 1.0); }`,
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
function buildOutpost(M, seed = 77) {
  const root = new THREE.Group();
  const k = new Kit();
  const r = rng(seed);
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

// ---------------------------------------------------------------- planetary spaceports (local +Y is the surface normal)
function beaconAdder(root, beacons) {
  return (p, color, size, phase, rate) => {
    const s = beaconSprite(color, size);
    s.position.copy(p);
    root.add(s);
    beacons.push({ s, phase, rate, base: size });
  };
}
function landingPad(k, x, z, R, key = 'hull') {
  k.add('dark', G.cyl(R + 8, R + 12, 14, 32), mat([x, -2, z]));
  k.add(key, G.cyl(R, R, 4, 32), mat([x, 6, z]));
  k.add('light', G.torus(R * 0.82, 0.9, 4, 48), mat([x, 8.2, z], [Math.PI / 2, 0, 0]));
  k.add('hangar', G.box(R * 0.9, 0.4, 3), mat([x, 8.3, z]));
  k.add('hangar', G.box(3, 0.4, R * 0.9), mat([x, 8.3, z]));
}
function buildSpaceport(M, style, seed) {
  const root = new THREE.Group();
  const k = new Kit();
  const r = rng(seed);
  const beacons = [];
  const addBeacon = beaconAdder(root, beacons);
  const floating = style === 'aerostat';
  const pirate = style === 'haven';
  const metal = pirate ? 'rust' : 'hull';
  if (floating) {
    // a lift-envelope platform riding the upper cloud deck
    k.add('hull', G.cyl(460, 420, 26, 48), mat([0, -14, 0]));
    k.add('dark', G.lathe([[420, 0], [400, -60], [320, -150], [180, -220], [40, -250], [0, -252]], 48), mat([0, -26, 0]));
    k.add('window', G.cyl(462, 462, 8, 48, true), mat([0, -12, 0]));
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      k.add('dark', G.cyl(10, 6, 260, 8), mat([Math.cos(a) * 300, -170, Math.sin(a) * 300], [0, 0, 0]));
      k.add('hull', G.sphere(55, 20, 14), mat([Math.cos(a) * 300, -310, Math.sin(a) * 300]));
      addBeacon(new THREE.Vector3(Math.cos(a) * 470, 0, Math.sin(a) * 470), i % 2 ? 0xffe0a0 : 0xff4030, 30, i / 8, 0.8);
    }
  } else {
    // apron slab, sunk into the terrain so it never floats
    k.add('dark', G.cyl(520, 560, 60, 48), mat([0, -32, 0]));
    k.add(metal, G.cyl(500, 520, 4, 48), mat([0, 0, 0]));
    for (let i = 0; i < 6; i++) k.add('hangar', G.box(900, 0.4, 2), mat([0, 2.3, -300 + i * 120]));
  }
  landingPad(k, 0, 0, 90, metal);
  const side = [];
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + 0.6;
    side.push([Math.cos(a) * 290, Math.sin(a) * 290]);
    landingPad(k, side[i][0], side[i][1], 55, metal);
  }
  // control tower
  const tx = -230, tz = 230;
  k.add(metal, G.cyl(18, 26, 150, 16), mat([tx, 75, tz]));
  k.add('dark', G.cyl(44, 34, 26, 16), mat([tx, 160, tz]));
  k.add('window', G.cyl(45, 35, 10, 16, true), mat([tx, 162, tz]));
  k.add('dark', G.cyl(2, 2, 70, 6), mat([tx, 208, tz]));
  addBeacon(new THREE.Vector3(tx, 246, tz), 0xff3020, 40, 0, 1.0);
  // terminal and hangars
  k.add(metal, G.rbox(260, 50, 90, 8), mat([220, 25, 210], [0, -0.7, 0]));
  k.add('window', G.box(262, 8, 80), mat([220, 30, 210], [0, -0.7, 0]));
  for (const [x, z] of [[300, -120], [-330, -60]]) {
    k.add(metal, G.cyl(60, 60, 140, 24, false), mat([x, 20, z], [Math.PI / 2, 0, 0], [1, 1, 0.6]));
    k.add('dark', G.box(110, 70, 6), mat([x, 30, z + 44]));
    k.add('hangar', G.box(80, 40, 2), mat([x, 28, z + 47]));
  }
  // settlement around the port
  const ring0 = floating ? 380 : 600, ring1 = floating ? 440 : 1400;
  const n = floating ? 18 : pirate ? 46 : 70;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = ring0 + r() * (ring1 - ring0);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const sink = d * d / 120000 + 20;
    if (style === 'city') {
      const w = 40 + r() * 70, h = 60 + r() * (d < 900 ? 320 : 160);
      k.add(r() < 0.5 ? 'hull' : 'dark', G.box(w, h + sink, w * (0.6 + r() * 0.6)), mat([x, (h - sink) / 2, z], [0, a, 0]));
      k.add('window', G.box(w + 1, h * 0.7, w * 0.4), mat([x, h * 0.45, z], [0, a, 0]));
      if (r() < 0.3) addBeacon(new THREE.Vector3(x, h + 6, z), 0xff3020, 18, r(), 0.7);
    } else if (style === 'colony') {
      const R = 30 + r() * 60;
      k.add(r() < 0.6 ? 'hull' : 'dark', G.sphere(R, 24, 12), mat([x, -R * 0.15, z], [0, 0, 0], [1, 0.7, 1]));
      k.add('window', G.cyl(R * 1.01, R * 1.01, 6, 24, true), mat([x, R * 0.15, z]));
      if (i % 4 === 0) k.add('dark', G.box(8, 8, d * 0.5), mat([x * 0.7, 2, z * 0.7], [0, -a + Math.PI / 2, 0]));
    } else if (style === 'mining') {
      if (i % 3 === 0) {
        k.add('rust', G.box(10, 140, 10), mat([x - 18, 70, z]));
        k.add('rust', G.box(10, 140, 10), mat([x + 18, 70, z]));
        k.add('dark', G.box(60, 10, 14), mat([x, 138, z]));
        k.add('dark', G.cyl(16, 16, 6, 16), mat([x, 146, z], [Math.PI / 2, 0, 0]));
      } else if (i % 3 === 1) {
        k.add('hull', G.cyl(26, 26, 90 + sink, 16), mat([x, (90 - sink) / 2, z]));
        k.add('dark', G.cyl(28, 28, 6, 16), mat([x, 90, z]));
      } else k.add('rust', G.box(16, 10, 300), mat([x, 30, z], [0.12, a, 0]));
    } else if (style === 'company') {
      // identical factory halls, stacks, cooling towers and worker blocks
      const t = i % 4;
      if (t === 0) {
        const w = 80 + r() * 60, l = 160 + r() * 120, h = 40 + r() * 20;
        k.add('dark', G.box(w, h + sink, l), mat([x, (h - sink) / 2, z], [0, a, 0]));
        k.add('window', G.box(w + 1, 6, l * 0.9), mat([x, h * 0.6, z], [0, a, 0]));
        for (let j = 0; j < 4; j++) k.add('hull', G.box(w * 0.9, 10, 14), mat([x, h + 4, z], [0, a, 0]).multiply(mat([0, 0, -l * 0.35 + j * l * 0.23], [0.5, 0, 0])));
        const sh = 140 + r() * 80;
        k.add('hull', G.cyl(6, 10, sh + sink, 10), mat([x, (sh - sink) / 2, z]));
        k.add('gold', G.cyl(10.5, 10.5, 8, 10), mat([x, sh - 12, z]));
        addBeacon(new THREE.Vector3(x, sh + 6, z), 0xff3020, 20, r(), 0.6);
      } else if (t === 1) {
        k.add('hull', G.cyl(46, 70, 170 + sink, 24), mat([x, (170 - sink) / 2, z]));
        k.add('dark', G.cyl(44, 44, 2, 24), mat([x, 171, z]));
      } else {
        const h = 70 + (i % 3) * 20;
        k.add(t === 2 ? 'hull' : 'dark', G.box(36, h + sink, 36), mat([x, (h - sink) / 2, z], [0, a, 0]));
        k.add('window', G.box(37, h * 0.7, 30), mat([x, h * 0.45, z], [0, a, 0]));
      }
    } else if (style === 'haven') {
      const w = 30 + r() * 60, h = 20 + r() * 60;
      k.add(r() < 0.5 ? 'rust' : 'dark', G.box(w, h + sink, w * (0.5 + r())), mat([x, (h - sink) / 2, z], [r() * 0.2, a, r() * 0.2]));
      if (r() < 0.4) k.add('window', G.box(w + 1, 5, w * 0.3), mat([x, h * 0.6, z], [0, a, 0]));
      if (r() < 0.2) addBeacon(new THREE.Vector3(x, h + 8, z), 0xff2010, 26, r(), 1.4);
      if (r() < 0.15) k.add('dark', G.box(6, 6, 120), mat([x, h, z], [r() * 2, r() * 3, r()]));
    } else {
      const w = 30 + r() * 30;
      k.add('hull', G.rbox(w, 24, w * 1.4, 4), mat([x, 12, z], [0, a, 0]));
      k.add('window', G.box(w + 1, 5, w * 1.2), mat([x, 14, z], [0, a, 0]));
    }
  }
  // approach light column above the main pad, chasing upwards
  const col = pirate ? 0xff5020 : style === 'company' ? 0xffc040 : 0x9fd0ff;
  for (let i = 0; i < 8; i++) addBeacon(new THREE.Vector3(0, 220 + i * 170, 0), col, 34 + i * 6, -i * 0.1, 0.9);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; addBeacon(new THREE.Vector3(Math.cos(a) * 96, 12, Math.sin(a) * 96), pirate ? 0xff3010 : 0xffe0a0, 16, i / 8, 1.2); }
  root.add(k.build(M, { uvTile: { hull: 40, dark: 30, rust: 30, window: 60 } }));
  root.userData = { beacons };
  const bays = [{ pos: new THREE.Vector3(0, 9, 0), dir: new THREE.Vector3(0, 1, 0), fwd: new THREE.Vector3(0, 0, 1), depth: 0, h: 0, pad: true },
    ...side.map(([x, z]) => ({ pos: new THREE.Vector3(x, 9, z), dir: new THREE.Vector3(0, 1, 0), fwd: new THREE.Vector3(-x, 0, -z).normalize(), depth: 0, h: 0, pad: true }))];
  return { root, colliders: [], bays };
}

// ---------------------------------------------------------------- civilian habitat: twin counter-rotating wheels on a long axle
function buildHabitat(M, seed) {
  const root = new THREE.Group();
  const k = new Kit();
  const r = rng(seed);
  k.add('hull', G.cyl(46, 46, 900, 32), mat([0, 0, 0]));
  k.add('window', G.cyl(47, 47, 600, 32, true), mat([0, 0, 0], [0, 0, 0], [1, 1, 1]));
  for (const y of [-450, 450]) k.add('dark', G.cyl(70, 46, 60, 32), mat([0, y + Math.sign(y) * 20, 0]));
  k.add('hull', G.cyl(90, 90, 120, 32), mat([0, -330, 0]));
  for (let i = 0; i < 120; i++) {
    const a = r() * Math.PI * 2, y = -420 + r() * 840;
    k.add(r() < 0.6 ? 'dark' : 'hull', G.box(8 + r() * 20, 6 + r() * 24, 6 + r() * 12), mat([Math.cos(a) * 50, y, Math.sin(a) * 50], [0, -a, 0]));
  }
  for (const side of [-1, 1]) {
    k.add('dark', G.box(700, 6, 6), mat([side * 380, 380, 0]));
    for (let j = 0; j < 4; j++) k.add('solar', G.box(150, 2, 260), mat([side * (140 + j * 160), 380, 0]));
  }
  const pods = [0, 1, 2].map((i) => bayPod(k, i * Math.PI * 2 / 3 + 0.3, 150, -330, 200, 100, 300));
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.3;
    k.add('hull', G.rbox(70, 50, 70, 6), mat([Math.cos(a) * 115, -330, Math.sin(a) * 115], [0, Math.atan2(Math.cos(a), Math.sin(a)), 0]));
  }
  root.add(k.build(M, { uvTile: { hull: 40, dark: 30, window: 60 } }));
  const ringK = new Kit();
  for (const y of [120, 300]) {
    ringK.add('hull', G.torus(520, 36, 16, 96), mat([0, y, 0], [Math.PI / 2, 0, 0]));
    ringK.add('window', G.torus(520, 37, 6, 96), mat([0, y, 0], [Math.PI / 2, 0, 0], [1, 1, 0.3]));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      ringK.add('dark', G.cyl(8, 8, 470, 10), mat([Math.cos(a) * 285, y, Math.sin(a) * 285], [0, -a, Math.PI / 2]));
    }
  }
  const ring = ringK.build(M, { uvTile: { hull: 50, dark: 30, window: 80 } });
  root.add(ring);
  const beacons = [];
  const addBeacon = beaconAdder(root, beacons);
  addBeacon(new THREE.Vector3(0, 520, 0), 0xff3020, 60, 0, 1.0);
  addBeacon(new THREE.Vector3(0, -510, 0), 0xff3020, 50, 0.5, 1.0);
  root.userData = { ring, beacons };
  const colliders = [];
  for (let y = -450; y <= 450; y += 60) colliders.push({ p: new THREE.Vector3(0, y, 0), r: 60 });
  for (const y of [120, 300]) for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; colliders.push({ p: new THREE.Vector3(Math.cos(a) * 520, y, Math.sin(a) * 520), r: 40 }); }
  return { root, colliders, bays: finishPods(pods, addBeacon, colliders) };
}

// ---------------------------------------------------------------- Combine tower: a tapering corporate spire on a docking podium
function buildTower(M, seed) {
  const root = new THREE.Group();
  const k = new Kit();
  const r = rng(seed);
  k.add('dark', G.cyl(160, 190, 260, 8), mat([0, -60, 0]));
  k.add('gold', G.cyl(166, 166, 10, 8), mat([0, 64, 0]));
  const floors = 14;
  for (let i = 0; i < floors; i++) {
    const rad = 120 - i * 5, y = 70 + i * 90;
    k.add(i % 4 === 3 ? 'dark' : 'hull', G.cyl(rad - 4, rad, 84, 8), mat([0, y + 42, 0]));
    k.add('window', G.cyl(rad - 1.5, rad + 0.5, 30, 8, true), mat([0, y + 50, 0]));
  }
  const topY = 70 + floors * 90;
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 8;
    k.add('gold', G.box(14, 1000, 50), mat([Math.cos(a) * 125, 620, Math.sin(a) * 125], [0, Math.PI / 2 - a, 0]));
  }
  k.add('dark', G.cyl(40, 60, 140, 8), mat([0, topY + 70, 0]));
  k.add('gold', G.cyl(4, 14, 260, 8), mat([0, topY + 270, 0]));
  k.add('gold', G.torus(280, 9, 6, 64), mat([0, 900, 0], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    k.add('dark', G.box(170, 6, 6), mat([Math.cos(a) * 190, 900, Math.sin(a) * 190], [0, -a, 0]));
  }
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, y = 100 + r() * 1100;
    k.add('dark', G.box(10 + r() * 16, 8 + r() * 20, 8), mat([Math.cos(a) * 118, y, Math.sin(a) * 118], [0, -a, 0]));
  }
  const pods = [0, 1, 2].map((i) => bayPod(k, i * Math.PI * 2 / 3 + 0.5, 190, -60, 200, 100, 300));
  root.add(k.build(M, { uvTile: { hull: 40, dark: 30, window: 60 } }));
  const beacons = [];
  const addBeacon = beaconAdder(root, beacons);
  addBeacon(new THREE.Vector3(0, topY + 410, 0), 0xffc040, 90, 0, 0.6);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; addBeacon(new THREE.Vector3(Math.cos(a) * 280, 900, Math.sin(a) * 280), 0xffb020, 40, i / 8, 1.0); }
  root.userData = { beacons };
  const colliders = [{ p: new THREE.Vector3(0, -60, 0), r: 190 }];
  for (let y = 100; y <= topY + 300; y += 70) colliders.push({ p: new THREE.Vector3(0, y, 0), r: Math.max(60, 130 - (y / 90) * 5) });
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; colliders.push({ p: new THREE.Vector3(Math.cos(a) * 280, 900, Math.sin(a) * 280), r: 24 }); }
  return { root, colliders, bays: finishPods(pods, addBeacon, colliders) };
}

// ---------------------------------------------------------------- pirate station: hollowed asteroid lashed with scrap hulls
function buildDen(M, seed) {
  const root = new THREE.Group();
  const k = new Kit();
  const r = rng(seed);
  const rock = new THREE.IcosahedronGeometry(260, 2);
  const pa = rock.attributes.position;
  for (let i = 0; i < pa.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pa, i); v.multiplyScalar(0.8 + 0.35 * Math.abs(Math.sin(v.x * 0.02) * Math.cos(v.z * 0.017 + v.y * 0.01))); pa.setXYZ(i, v.x, v.y, v.z); }
  rock.computeVertexNormals();
  k.add('dark', rock, mat([0, 120, 0], [0, 0, 0], [1.2, 0.9, 1.1]));
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, y = -40 + r() * 340, d = 230 + r() * 90;
    const w = 50 + r() * 90, h = 30 + r() * 60, l = 120 + r() * 200;
    k.add(r() < 0.5 ? 'rust' : 'dark', G.rbox(w, h, l, 6), mat([Math.cos(a) * d, y, Math.sin(a) * d], [r() * 0.5, -a, r() * 0.4]));
    if (r() < 0.6) k.add('window', G.box(w + 2, 6, l * 0.8), mat([Math.cos(a) * d, y + h * 0.25, Math.sin(a) * d], [r() * 0.5, -a, r() * 0.4]));
    for (let g = 0; g < 3; g++) k.add('dark', G.box(5, 5, 60 + r() * 140), mat([Math.cos(a) * (d + 40), y + (r() - 0.5) * 60, Math.sin(a) * (d + 40)], [r() * 3, r() * 3, r() * 3]));
  }
  k.add('rust', G.cyl(30, 40, 420, 10), mat([0, 380, 0], [0.1, 0, 0.08]));
  k.add('dark', G.cyl(90, 90, 14, 10), mat([10, 560, 30]));
  k.add('dark', G.cyl(3, 3, 260, 6), mat([10, 700, 30]));
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2;
    k.add('dark', G.cyl(3, 3, 200 + r() * 200, 6), mat([Math.cos(a) * 200, 260 + r() * 80, Math.sin(a) * 200], [r() * 0.6 - 0.3, 0, r() * 0.6 - 0.3]));
  }
  const pods = [0, 1, 2].map((i) => bayPod(k, i * Math.PI * 2 / 3, 280, -60, 200, 100, 300));
  root.add(k.build(M, { uvTile: { dark: 30, rust: 30, window: 60 } }));
  const beacons = [];
  const addBeacon = beaconAdder(root, beacons);
  addBeacon(new THREE.Vector3(10, 835, 30), 0xff2010, 90, 0, 0.7);
  for (let i = 0; i < 6; i++) addBeacon(new THREE.Vector3((r() - 0.5) * 700, r() * 400, (r() - 0.5) * 700), 0xff2010, 50, r(), 1.4);
  root.userData = { beacons };
  const colliders = [{ p: new THREE.Vector3(0, 120, 0), r: 300 }];
  for (let y = 200; y <= 560; y += 60) colliders.push({ p: new THREE.Vector3(0, y, 0), r: 50 });
  return { root, colliders, bays: finishPods(pods, addBeacon, colliders) };
}

// ---------------------------------------------------------------- asteroids
function makeAsteroidGeometries(count, detail) {
  const simplex = new SimplexNoise({ random: rng(1234) });
  const geos = [];
  const r = rng(42);
  for (let g = 0; g < count; g++) {
    let geo = new THREE.IcosahedronGeometry(1, detail);
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
  material.userData.ownMaps = true;
  const { hi, lo } = sharedRockGeos();
  const per = Math.ceil(count / hi.length);
  const group = new THREE.Group();
  const rocks = [];
  const mk = (g) => {
    const m = new THREE.InstancedMesh(g, material, per);
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.count = 0;
    group.add(m);
    return m;
  };
  const meshes = hi.map((g, i) => ({ hi: mk(g), lo: mk(lo[i]) }));
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
    rocks.push({ set: meshes[i % hi.length], pos: p.add(center), q: q.clone(), axis, spin: (r() - 0.5) * 0.04 / Math.sqrt(size / 50), size, radius: size * 0.92, on: true, ord: i / count });
  }
  const m4 = new THREE.Matrix4(), sc = new THREE.Vector3(), dq = new THREE.Quaternion();
  const update = (dt, focus) => {
    for (const s of meshes) s.hi.count = s.lo.count = 0;
    for (const k of rocks) {
      k.on = k.ord < ROCK_Q.belt;
      if (!k.on) continue;
      dq.setFromAxisAngle(k.axis, k.spin * dt);
      k.q.premultiply(dq);
      sc.setScalar(k.size);
      m4.compose(k.pos, k.q, sc);
      const near = focus && focus.distanceTo(k.pos) < (k.size * 14 + 900) * ROCK_Q.lod;
      const m = near ? k.set.hi : k.set.lo;
      m.setMatrixAt(m.count++, m4);
    }
    for (const s of meshes) { s.hi.instanceMatrix.needsUpdate = true; s.lo.instanceMatrix.needsUpdate = true; }
  };
  update(0, null);
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
  let n = N;
  const setCount = (f) => { n = Math.round(N * f); geo.setDrawRange(0, n * 2); };
  const update = (camPos, vel) => {
    const sp = vel.length();
    tail.copy(vel).multiplyScalar(-Math.min(0.06, 25 / Math.max(sp, 1)));
    if (tail.length() < 0.25) tail.set(0, 0.25, 0);
    for (let i = 0; i < n; i++) {
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
  return { lines, update, setCount };
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
let rockGeos = null;
// near rocks use the detailed mesh, distant ones a low-poly copy of the same shape
const sharedRockGeos = () => rockGeos || (rockGeos = { hi: makeAsteroidGeometries(5, 5), lo: makeAsteroidGeometries(5, 2) });
const ROCK_Q = { belt: 1, lod: 1 };

export function buildWorld(renderer, scene, skySize = 512) {
  // sky is baked to a cubemap per system; the PMREM env is re-rendered into the same target so materials keep their reference
  const cubeOpts = { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter };
  let cube = new THREE.WebGLCubeRenderTarget(skySize, cubeOpts);
  const envCube = new THREE.WebGLCubeRenderTarget(256, cubeOpts);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTarget = bakeSky(renderer, cube, envCube, pmrem, null);
  const env = envTarget.texture;

  const sky = makeSky();
  scene.add(sky);
  const stars = makeStars();
  scene.add(stars);

  const sun = new THREE.DirectionalLight(0xfff2e0, 4.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -180; sc.right = 180; sc.top = 180; sc.bottom = -180; sc.near = 10; sc.far = 3000;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.08;
  scene.add(sun, sun.target);
  const bounce = new THREE.DirectionalLight(0x6f8fbf, 0.06);
  scene.add(bounce, bounce.target);
  scene.add(new THREE.AmbientLight(0x2a3040, 0.08));

  const SM = stationMaterials(env);
  const rustMaps = hullMaps({ seed: 31, base: [92, 62, 48], accent: [150, 40, 25], accentChance: 0.08, darkChance: 0.25, wear: 1.0 });
  SM.rust = new THREE.MeshStandardMaterial({ map: rustMaps.map, normalMap: rustMaps.normalMap, roughnessMap: rustMaps.roughnessMap, metalness: 0.6, roughness: 0.75, envMap: env, envMapIntensity: 0.4 });
  const keepMats = new Set(Object.values(SM));

  const dust = makeDust();
  scene.add(dust.lines);
  const warp = makeWarpTunnel();
  scene.add(warp.lines);

  const structures = [], rocks = [], bodies = [], spinners = [], fields = [], beaconSets = [], timed = [], clouds = [];
  let cloudsOn = true;
  const docks = {};
  let sys = null, time = 0;

  function clearSystem() {
    if (!sys) return;
    scene.remove(sys);
    const keepGeo = new Set([...sharedRockGeos().hi, ...sharedRockGeos().lo]);
    sys.traverse((o) => {
      if (o.geometry && !keepGeo.has(o.geometry)) o.geometry.dispose();
      if (o.material && !keepMats.has(o.material)) {
        if (o.material.userData.ownMaps) for (const k of ['map', 'normalMap', 'roughnessMap']) o.material[k]?.dispose();
        o.material.dispose();
      }
    });
    sys = null;
  }

  function load(def, explored) {
    clearSystem();
    sys = new THREE.Group();
    scene.add(sys);
    for (const a of [structures, rocks, bodies, spinners, fields, beaconSets, timed, clouds, LOCATIONS]) a.length = 0;
    for (const k of Object.keys(docks)) delete docks[k];

    const st = def.starInfo;
    SUN_DIR.copy(def.sunDir);
    SUN_COL.setRGB(...st.color);
    SKY_U.uSunSize.value = st.size;
    SKY_U.uNebDir.value.set(...def.sky.dir).normalize();
    SKY_U.uNeb1.value.setRGB(...def.sky.c1);
    SKY_U.uNeb2.value.setRGB(...def.sky.c2);
    SKY_U.uNeb3.value.setRGB(...def.sky.c3);
    SKY_U.uNebAmt.value = def.sky.amt;
    envTarget = bakeSky(renderer, cube, envCube, pmrem, envTarget);
    sun.color.setRGB(...st.color);
    sun.intensity = st.light * 1.24;

    const planetLocs = [], planetMeshes = [], noSpin = new Set();
    for (const P of def.planets) {
      const seg = P.moon ? [128, 64] : P.type === 'gas' ? [160, 80] : [224, 112];
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(P.radius, seg[0], seg[1]), makePlanetMaterial(P));
      mesh.position.copy(P.pos);
      mesh.rotation.z = P.type === 'gas' ? 0.06 : 0.35;
      sys.add(mesh);
      planetMeshes.push(mesh);
      timed.push(mesh.material);
      spinners.push({ o: mesh, s: P.type === 'gas' ? 0.003 : 0.0012 });
      if (P.clouds) {
        const cl = new THREE.Mesh(new THREE.SphereGeometry(P.radius * 1.006, 160, 80), makeClouds(P.radius * 1.006));
        cl.position.copy(P.pos);
        cl.rotation.z = 0.35;
        cl.visible = cloudsOn;
        clouds.push(cl);
        sys.add(cl);
        timed.push(cl.material);
        spinners.push({ o: cl, s: 0.0016 });
      }
      if (P.atmo) {
        const at = new THREE.Mesh(new THREE.SphereGeometry(P.radius * 1.045, 96, 48), makeAtmosphere(P.pos, P.radius, P.radius * 1.045, P.atmo));
        at.position.copy(P.pos);
        sys.add(at);
      }
      if (P.ring) sys.add(makeRing(P));
      bodies.push({ pos: P.pos, radius: P.radius });
      planetLocs.push({ id: `planet-${planetLocs.length}`, name: P.name, type: P.moon ? 'Moon' : `Planet (${P.label})`, pos: P.pos, arrive: P.radius + (P.type === 'gas' ? 20000 : 9000), icon: P.moon ? 'moon' : 'planet' });
    }
    bounce.position.copy(def.planets[0].pos).normalize().multiplyScalar(1000);

    const LOC_TYPE = { station: 'Station', shipyard: 'Station (High-Tech)', habitat: 'Habitat Station', den: 'Pirate Station', port: 'Spaceport', tower: 'Combine Tower' };
    const PORT_TYPE = { city: 'City Spaceport', colony: 'Colony Landing Field', mining: 'Mining Outpost', aerostat: 'Cloud-city Aerostat', haven: 'Pirate Haven', company: 'Company Town' };
    def.stations.forEach((S, si) => {
      const b = S.kind === 'shipyard' ? buildShipyard(SM) : S.kind === 'habitat' ? buildHabitat(SM, 300 + si) : S.kind === 'den' ? buildDen(SM, 400 + si) : S.kind === 'tower' ? buildTower(SM, 600 + si) : S.kind === 'port' ? buildSpaceport(SM, S.style, 500 + si * 7) : buildStation(SM);
      b.root.position.copy(S.pos);
      if (S.up) {
        b.root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), S.up);
        b.root.rotateY(S.rot);
        noSpin.add(S.planet);
      } else b.root.rotation.y = S.rot;
      sys.add(b.root);
      const loc = { id: S.id, name: S.name, type: S.kind === 'port' ? PORT_TYPE[S.style] : LOC_TYPE[S.kind], pos: S.pos, arrive: S.kind === 'port' ? 2600 : S.kind === 'shipyard' ? 3000 : 3200, icon: S.kind, dock: S.dock, yard: S.yard || null, kind: S.kind, style: S.style || S.kind, up: S.up || null };
      structures.push({ obj: b.root, colliders: b.colliders, loc });
      if (b.root.userData.ring) spinners.push({ o: b.root.userData.ring, s: S.kind === 'shipyard' ? -0.025 : 0.03 });
      beaconSets.push(b.root.userData.beacons);
      docks[S.id] = { root: b.root, bays: b.bays };
      LOCATIONS.push(loc);
    });
    // planets hosting surface ports stop spinning so the port stays put on the terrain
    for (const [i, m] of planetMeshes.entries()) if (noSpin.has(i) && def.planets[i].type !== 'gas') { const k = spinners.findIndex((x) => x.o === m); if (k >= 0) spinners.splice(k, 1); }
    def.belts.forEach((B, i) => {
      const f = buildAsteroidField(B.pos, env, B.count, B.spread, B.seed, B.tint);
      sys.add(f.group);
      fields.push({ f, pos: B.pos });
      rocks.push(...f.rocks);
      LOCATIONS.push({ id: `belt-${i}`, name: B.name, type: 'Asteroid Belt', pos: B.pos, arrive: 1500, icon: 'belt' });
    });
    def.outposts.forEach((O, i) => {
      const b = buildOutpost(SM, 77 + i * 13);
      b.root.position.copy(O.pos);
      sys.add(b.root);
      const loc = { id: `outpost-${i}`, name: O.name, type: 'Pirate Outpost', pos: O.pos, arrive: 6000, icon: 'outpost' };
      structures.push({ obj: b.root, colliders: b.colliders, loc });
      beaconSets.push(b.root.userData.beacons);
      if (O.rocks) {
        const f = buildAsteroidField(O.pos, env, 120, [8000, 3000, 8000], 202 + i, [92, 80, 72]);
        sys.add(f.group);
        fields.push({ f, pos: O.pos });
        rocks.push(...f.rocks);
      }
      LOCATIONS.push(loc);
    });
    for (const J of def.jumps) {
      const b = buildGate(SM);
      b.root.position.copy(J.pos);
      b.root.lookAt(0, 0, 0);
      sys.add(b.root);
      const loc = { id: `jump-${J.to}`, name: `Jump Gate (${explored.has(J.to) ? SYSTEMS[J.to].name : 'Uncharted'})`, type: 'Jump Gate', pos: J.pos, arrive: 2200, icon: 'gate', jump: J.to, horizon: b.root.userData.horizon.material.uniforms.uBoost };
      structures.push({ obj: b.root, colliders: b.colliders, loc });
      beaconSets.push(b.root.userData.beacons);
      timed.push(b.root.userData.horizon.material);
      LOCATIONS.push(loc);
    }
    LOCATIONS.push(...planetLocs);
  }

  const _wp = new THREE.Vector3();
  const worldColliders = [];

  return {
    env, sun, sky, stars, docks, rocks, bodies, dust, warp, structures, load,
    setQuality(q) {
      GFX_U.uDetail.value = q.detail;
      cloudsOn = q.clouds;
      for (const c of clouds) c.visible = cloudsOn;
      ROCK_Q.belt = q.belt; ROCK_Q.lod = q.rockLod;
      for (const f of fields) f.f.update(0, null);
      dust.setCount(q.dust);
      stars.geometry.setDrawRange(0, Math.round(stars.geometry.attributes.position.count * q.stars));
      sun.shadow.mapSize.set(q.shadow || 512, q.shadow || 512);
      sun.castShadow = q.shadow > 0;
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      if (cube.width !== q.sky) {
        cube.dispose();
        cube = new THREE.WebGLCubeRenderTarget(q.sky, cubeOpts);
        envTarget = bakeSky(renderer, cube, envCube, pmrem, envTarget);
      }
    },
    // rename jump gates once their destination is charted
    chart(id) { const l = LOCATIONS.find((x) => x.jump === id); if (l) l.name = `Jump Gate (${SYSTEMS[id].name})`; },
    update(dt, camera, focus) {
      time += dt;
      sky.position.copy(camera.position);
      stars.position.copy(camera.position);
      for (const s of spinners) s.o.rotation.y += dt * s.s;
      for (const m of timed) m.uniforms.uTime.value = time;
      for (const set of beaconSets) {
        for (const b of set) b.s.material.opacity = b.rate === 0 ? 1 : (Math.sin((time * b.rate + b.phase) * Math.PI * 2) > 0.6 ? 1 : 0.08);
      }
      // asteroids only need animating when near
      for (const f of fields) if (focus.distanceTo(f.pos) < 40000) f.f.update(dt, camera.position);
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
        if (k.on && k.pos.distanceTo(p) < range + k.radius) worldColliders.push({ p: k.pos, r: k.radius });
      }
      return worldColliders;
    },
  };
}
