import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Bridge interiors drawn in camera space (camera at the origin looking down -Z), one layout per hull family.
// Each layout merges into a handful of meshes: frame, panels, screens, lit parts, glass and an optional hologram.
// Interior lights are evaluated only in the bridge's own shader, so they cost nothing for the rest of the scene.

const KIND = {
  hornet: 'fighter', wisp: 'fighter', kestrel: 'fighter', corvid: 'fighter', valkyrie: 'fighter', mantis: 'fighter',
  mule: 'civil', atlas: 'civil', aurora: 'civil',
  warden: 'command', sabre: 'command', bastion: 'command', paladin: 'command', sovereign: 'command', leviathan: 'command',
  raider: 'clan', cutlass: 'clan', reaver: 'clan', marauder: 'clan', ravager: 'clan',
  unit: 'combine', enforcer: 'combine', crate: 'combine', commuter: 'combine', compliance: 'combine'
};
const LUXURY = new Set(['paladin', 'sabre', 'aurora']);
export const bridgeKind = (hull) => KIND[hull] || 'fighter';

const ONE = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
const col = (r, g, b) => new THREE.Color(r, g, b);

const STYLE = {
  fighter: {
    frame: [0x30343a, 0.85, 0.35], panel: [0x1b1e22, 0.55, 0.6], ink: [150, 205, 235], label: 'ARMED',
    accent: col(0.25, 0.75, 1.0), warn: col(1.0, 0.55, 0.12), keys: [col(0.3, 0.8, 1), col(0.25, 0.9, 0.5), col(1, 0.6, 0.15)], glass: col(0.03, 0.09, 0.07),
    lights: [[[0, -0.25, -0.85], col(0.25, 0.6, 0.9), 1.4], [[-0.9, -0.3, -0.6], col(0.15, 0.3, 0.9), 0.9], [[0.9, -0.3, -0.6], col(0.15, 0.3, 0.9), 0.9], [[0, 0.7, -0.2], col(0.5, 0.55, 0.6), 0.45], [[0, -0.75, -0.2], col(0.15, 0.4, 0.7), 0.45], [[0, 0.35, 0.5], col(0.35, 0.4, 0.46), 0.3]]
  },
  command: {
    frame: [0x2c3036, 0.85, 0.35], panel: [0x22252a, 0.5, 0.55], ink: [170, 200, 240], label: 'COND GREEN',
    accent: col(0.45, 0.7, 1.0), warn: col(1.0, 0.25, 0.15), keys: [col(0.4, 0.7, 1), col(0.9, 0.9, 1), col(1, 0.35, 0.2)], glass: col(0.05, 0.12, 0.25),
    lights: [[[0, 1.0, -1.6], col(0.55, 0.62, 0.78), 1.1], [[0, -0.8, -2.0], col(0.2, 0.5, 1.0), 1.0], [[-2.2, 0.1, -2.0], col(0.7, 0.14, 0.1), 0.7], [[2.2, 0.1, -2.0], col(0.7, 0.14, 0.1), 0.7], [[0, 0.95, 1.2], col(0.5, 0.56, 0.7), 0.9], [[0, -1.3, 0.4], col(0.15, 0.35, 0.8), 0.45]]
  },
  civil: {
    frame: [0x55534d, 0.6, 0.45], panel: [0x80786a, 0.2, 0.7], ink: [150, 230, 160], label: 'CARGO OK',
    accent: col(1.0, 0.7, 0.3), warn: col(1.0, 0.3, 0.15), keys: [col(1, 0.7, 0.25), col(0.5, 1, 0.5), col(0.95, 0.9, 0.8)], glass: col(0.08, 0.07, 0.04),
    lights: [[[0, 0.7, -1.2], col(0.95, 0.65, 0.35), 0.8], [[0, -0.35, -1.2], col(0.5, 0.75, 0.45), 0.6], [[-1.6, -0.1, -1.0], col(0.9, 0.55, 0.25), 0.5], [[1.6, -0.1, -1.0], col(0.9, 0.55, 0.25), 0.5], [[-1.2, 0.85, 0.8], col(1.0, 0.78, 0.5), 0.6], [[1.2, 0.85, 0.8], col(1.0, 0.78, 0.5), 0.6]]
  },
  clan: {
    frame: [0x3a2c22, 0.6, 0.75], panel: [0x4a3123, 0.4, 0.85], ink: [235, 120, 80], label: 'NO MERCY',
    accent: col(1.0, 0.3, 0.1), warn: col(1.0, 0.15, 0.05), keys: [col(1, 0.25, 0.1), col(1, 0.6, 0.1), col(0.4, 1, 0.3)], glass: col(0.1, 0.03, 0.02),
    lights: [[[0.58, 0.38, -1.1], col(1.0, 0.35, 0.12), 0.9], [[-0.8, -0.3, -0.8], col(0.85, 0.42, 0.1), 0.55], [[0, -0.3, -1.0], col(0.7, 0.15, 0.1), 0.5], [[0, 0.8, 0], col(0.35, 0.22, 0.15), 0.3], [[0, 0.5, 0.6], col(0.6, 0.3, 0.12), 0.35], [[-0.8, -0.9, 0.3], col(0.8, 0.1, 0.05), 0.3]]
  },
  combine: {
    frame: [0x2c2d2a, 0.7, 0.5], panel: [0x3e403b, 0.35, 0.65], ink: [235, 195, 90], label: 'QUOTA 97%',
    accent: col(1.0, 0.78, 0.25), warn: col(1.0, 0.4, 0.1), keys: [col(1, 0.8, 0.25), col(1, 0.8, 0.25), col(0.9, 0.95, 0.9)], glass: col(0.06, 0.06, 0.03),
    lights: [[[0, 0.62, -1.15], col(0.7, 0.85, 0.72), 1.0], [[0, -0.4, -1.1], col(0.85, 0.65, 0.2), 0.5], [[-1.1, -0.2, -0.9], col(0.45, 0.5, 0.45), 0.35], [[1.1, -0.2, -0.9], col(0.45, 0.5, 0.45), 0.35], [[0, 0.8, 0.35], col(0.7, 0.85, 0.72), 0.8], [[0, -0.6, 0.8], col(0.4, 0.42, 0.38), 0.25]]
  }
};

function mat(p = [0, 0, 0], r = [0, 0, 0], parent) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'YXZ')), ONE);
  return parent ? parent.clone().multiply(m) : m;
}

class Kit {
  constructor(S) { this.S = S; this.L = { frame: [], panel: [], scr: [], lit: [], glass: [], holo: [] }; }
  add(list, g, m, c) {
    if (m) g.applyMatrix4(m);
    if (g.index) g = g.toNonIndexed();
    if (list === 'lit') {
      const cc = c || this.S.accent, n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    }
    this.L[list].push(g);
  }
  box(list, w, h, d, p, r, parent, c) { this.add(list, new THREE.BoxGeometry(w, h, d), mat(p, r, parent), c); }
  cyl(list, rt, rb, h, p, r, parent, c, seg = 12) { this.add(list, new THREE.CylinderGeometry(rt, rb, h, seg), mat(p, r, parent), c); }
  torus(list, R, t, p, r, parent, c) { this.add(list, new THREE.TorusGeometry(R, t, 6, 32), mat(p, r, parent), c); }
  bar(list, a, b, w, d, c) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A);
    const g = new THREE.BoxGeometry(w, dir.length(), d);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir.normalize()));
    g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
    this.add(list, g, null, c);
  }
  tube(list, pts, r, seg = 16, c) {
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)));
    this.add(list, new THREE.TubeGeometry(curve, seg, r, 6, false), null, c);
  }
  // console body; returns the matrix of its front (+Z) face so screens and keys can be laid out on it
  cons(w, h, d, p, r) {
    const m = mat(p, r);
    this.add('panel', new THREE.BoxGeometry(w, h, d), m.clone());
    this.box('frame', w + 0.02, 0.018, d + 0.02, [0, h / 2, 0], [0, 0, 0], m);
    return mat([0, 0, d / 2], [0, 0, 0], m);
  }
  // plated deck over a frame-coloured sub-floor; jitter(i, j) may return false (missing plate) or [dy, rx, rz]
  deck(x0, x1, z0, z1, y, step, list = 'panel', jitter) {
    this.box('frame', x1 - x0, 0.04, z1 - z0, [(x0 + x1) / 2, y - 0.035, (z0 + z1) / 2]);
    const nx = Math.max(1, Math.round((x1 - x0) / step)), nz = Math.max(1, Math.round((z1 - z0) / step));
    const sx = (x1 - x0) / nx, sz = (z1 - z0) / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const q = jitter ? jitter(i, j) : null;
      if (q === false) continue;
      this.box(list, sx - 0.03, 0.025, sz - 0.03, [x0 + (i + 0.5) * sx, y + (q ? q[0] : 0), z0 + (j + 0.5) * sz], q ? [q[1], 0, q[2]] : [0, 0, 0]);
    }
  }
  // side wall at x = s * x with vertical ribs and a kick plate
  wallX(s, x, z0, z1, y0, y1, rib) {
    this.box('panel', 0.04, y1 - y0, z1 - z0, [s * x, (y0 + y1) / 2, (z0 + z1) / 2]);
    const n = Math.max(1, Math.round((z1 - z0) / rib));
    for (let i = 0; i <= n; i++) this.box('frame', 0.06, y1 - y0, 0.07, [s * (x - 0.04), (y0 + y1) / 2, z0 + i * (z1 - z0) / n]);
    this.box('frame', 0.05, 0.14, z1 - z0, [s * (x - 0.03), y0 + 0.07, (z0 + z1) / 2]);
  }
  // fore or aft wall at z, ribs and kick plate on the cabin side
  wallZ(z, x0, x1, y0, y1, rib) {
    const d = -Math.sign(z);
    this.box('panel', x1 - x0, y1 - y0, 0.04, [(x0 + x1) / 2, (y0 + y1) / 2, z]);
    const n = Math.max(1, Math.round((x1 - x0) / rib));
    for (let i = 0; i <= n; i++) this.box('frame', 0.07, y1 - y0, 0.06, [x0 + i * (x1 - x0) / n, (y0 + y1) / 2, z + d * 0.04]);
    this.box('frame', x1 - x0, 0.14, 0.05, [(x0 + x1) / 2, y0 + 0.07, z + d * 0.03]);
  }
  door(z, x, y0, w, h) {
    const d = -Math.sign(z);
    this.box('frame', w + 0.2, h + 0.1, 0.04, [x, y0 + (h + 0.1) / 2, z + d * 0.07]);
    this.box('panel', w, h, 0.04, [x, y0 + h / 2, z + d * 0.1]);
    this.box('frame', 0.03, h - 0.1, 0.02, [x, y0 + h / 2, z + d * 0.125]);
    for (const s of [-1, 1]) this.box('lit', 0.02, h - 0.2, 0.01, [x + s * (w / 2 + 0.05), y0 + h / 2, z + d * 0.095]);
    this.box('lit', 0.12, 0.03, 0.01, [x, y0 + h + 0.02, z + d * 0.095], [0, 0, 0], null, this.S.keys[1]);
  }
  // seat facing -Z: back at z, pan at yPan, pedestal down to the floor at y
  seat(x, z, y, yPan, w) {
    this.box('panel', w, 0.1, 0.48, [x, yPan, z - 0.25]);
    this.box('panel', w, 0.78, 0.1, [x, yPan + 0.42, z], [-0.1, 0, 0]);
    this.box('panel', w * 0.55, 0.2, 0.1, [x, yPan + 0.9, z + 0.07]);
    this.cyl('frame', 0.07, 0.1, yPan - y, [x, (yPan + y) / 2, z - 0.25]);
    this.box('frame', w * 0.8, 0.03, 0.4, [x, y + 0.015, z - 0.25]);
    for (const s of [-1, 1]) {
      this.box('frame', 0.07, 0.06, 0.4, [x + s * (w / 2 + 0.04), yPan + 0.22, z - 0.24]);
      this.box('frame', 0.04, 0.22, 0.04, [x + s * (w / 2 + 0.04), yPan + 0.1, z - 0.06]);
    }
  }
  screen(face, x, y, w, h, idx) {
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    const u0 = (idx % 4) / 4, v0 = 1 - (Math.floor(idx / 4) + 1) / 2;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.25, v0 + uv.getY(i) * 0.5);
    this.add('scr', g, mat([x, y, 0.02], [0, 0, 0], face));
  }
  // bezelled display with key columns either side
  mfd(face, x, y, w, h, idx, keys = 4) {
    this.box('frame', w + 0.05, h + 0.05, 0.016, [x, y, 0.008], [0, 0, 0], face);
    this.screen(face, x, y, w, h, idx);
    const K = this.S.keys;
    for (const s of [-1, 1]) for (let j = 0; j < keys; j++) {
      const c = K[(j + (s > 0 ? 1 : 0)) % K.length];
      this.box('lit', 0.022, 0.016, 0.01, [x + s * (w / 2 + 0.04), y - h / 2 + 0.03 + j * (h - 0.06) / Math.max(1, keys - 1), 0.012], [0, 0, 0], face, (j * 3 + s) % 4 === 0 ? c.clone().multiplyScalar(0.18) : c);
    }
  }
  keys(face, x0, y0, nx, ny, sx, sy, s = 0.024, pick) {
    const K = this.S.keys;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const c = pick ? pick(i, j) : K[(i * 7 + j * 3) % K.length];
      const off = (i * 5 + j * 11) % 7 === 0;
      this.box('lit', s, s * 0.75, 0.012, [x0 + i * sx, y0 + j * sy, 0.008], [0, 0, 0], face, off ? c.clone().multiplyScalar(0.15) : c);
    }
  }
}

function screenTexture(kind) {
  const S = STYLE[kind], W = 512, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#020407'; x.fillRect(0, 0, W, H);
  const [ir, ig, ib] = S.ink;
  const ink = (a) => `rgba(${ir},${ig},${ib},${a})`;
  const cell = (i, f) => { const cx = (i % 4) * 128, cy = Math.floor(i / 4) * 128; x.save(); x.translate(cx, cy); x.beginPath(); x.rect(4, 4, 120, 120); x.clip(); x.fillStyle = ink(0.06); x.fillRect(4, 4, 120, 120); f(); x.restore(); };
  cell(0, () => {
    x.strokeStyle = ink(0.55); x.lineWidth = 1.5;
    for (const r of [18, 36, 54]) { x.beginPath(); x.arc(64, 64, r, 0, Math.PI * 2); x.stroke(); }
    x.beginPath(); x.moveTo(64, 6); x.lineTo(64, 122); x.moveTo(6, 64); x.lineTo(122, 64); x.stroke();
    const gr = x.createLinearGradient(64, 64, 118, 30); gr.addColorStop(0, ink(0.5)); gr.addColorStop(1, ink(0));
    x.fillStyle = gr; x.beginPath(); x.moveTo(64, 64); x.arc(64, 64, 56, -0.9, -0.4); x.closePath(); x.fill();
    x.fillStyle = 'rgba(214,92,72,0.9)'; for (const [a, b] of [[88, 40], [30, 90], [96, 82]]) x.fillRect(a - 2, b - 2, 5, 5);
    x.fillStyle = 'rgba(120,214,150,0.9)'; x.fillRect(42, 30, 4, 4);
  });
  cell(1, () => {
    x.fillStyle = ink(0.75);
    for (let i = 0; i < 7; i++) { const h = 20 + ((i * 37) % 70); x.fillRect(12 + i * 15, 112 - h, 10, h); }
    x.fillStyle = ink(0.35); x.fillRect(8, 18, 112, 2);
  });
  cell(2, () => {
    x.strokeStyle = ink(0.8); x.lineWidth = 2; x.beginPath();
    for (let i = 0; i <= 112; i += 4) x.lineTo(8 + i, 64 + Math.sin(i * 0.11) * 22 + Math.sin(i * 0.37) * 8);
    x.stroke();
    x.fillStyle = ink(0.3); for (let i = 0; i < 6; i++) x.fillRect(8, 14 + i * 20, 112, 1);
  });
  cell(3, () => {
    x.strokeStyle = ink(0.75); x.lineWidth = 2;
    x.beginPath(); x.moveTo(64, 14); x.lineTo(92, 96); x.lineTo(64, 84); x.lineTo(36, 96); x.closePath(); x.stroke();
    x.fillStyle = 'rgba(214,170,80,0.85)'; x.fillRect(58, 100, 12, 14);
  });
  for (let i = 4; i < 6; i++) cell(i, () => {
    for (let r = 0; r < 9; r++) {
      x.fillStyle = ink(r === 0 ? 0.9 : 0.45);
      const n = 2 + ((r * 7 + i * 3) % 5);
      for (let k = 0; k < n; k++) x.fillRect(10 + k * 22, 12 + r * 12, 16 - ((r + k) % 3) * 4, 5);
    }
  });
  // round gauge (civil) or cracked display (clan) or a star chart
  cell(6, () => {
    if (kind === 'clan') {
      for (let r = 0; r < 9; r++) { x.fillStyle = ink(0.4); x.fillRect(10, 12 + r * 12, 30 + ((r * 29) % 70), 5); }
      x.strokeStyle = 'rgba(230,230,230,0.7)'; x.lineWidth = 1.2;
      for (const [a, b, cx2, d] of [[70, 50, 20, 10], [70, 50, 118, 30], [70, 50, 90, 120], [70, 50, 30, 110], [70, 50, 60, 6]]) { x.beginPath(); x.moveTo(a, b); x.lineTo((a + cx2) / 2 + 6, (b + d) / 2 - 4); x.lineTo(cx2, d); x.stroke(); }
    } else {
      x.strokeStyle = ink(0.7); x.lineWidth = 3; x.beginPath(); x.arc(64, 70, 46, Math.PI * 0.8, Math.PI * 2.2); x.stroke();
      x.lineWidth = 2; for (let k = 0; k <= 10; k++) { const a = Math.PI * (0.8 + k * 0.14); x.beginPath(); x.moveTo(64 + Math.cos(a) * 38, 70 + Math.sin(a) * 38); x.lineTo(64 + Math.cos(a) * 46, 70 + Math.sin(a) * 46); x.stroke(); }
      x.strokeStyle = 'rgba(240,120,70,0.95)'; x.lineWidth = 3; x.beginPath(); x.moveTo(64, 70); x.lineTo(64 + Math.cos(-0.7) * 40, 70 + Math.sin(-0.7) * 40); x.stroke();
    }
  });
  cell(7, () => {
    x.fillStyle = ink(0.9); x.font = '600 19px "Share Tech Mono", monospace'; x.textAlign = 'center';
    const words = S.label.split(' ');
    words.forEach((w, i) => x.fillText(w, 64, 58 + i * 24 - (words.length - 1) * 12));
    x.fillStyle = ink(0.4); x.fillRect(16, 96, 96, 4); x.fillStyle = ink(0.85); x.fillRect(16, 96, 78, 4);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const texCache = {};

function interiorMat([color, metalness, roughness], env, U) {
  const m = new THREE.MeshStandardMaterial({ color, metalness, roughness, envMap: env, envMapIntensity: 0.55 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLP = U.pos; sh.uniforms.uLC = U.col;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uLP[6];\nuniform vec3 uLC[6];')
      .replace('#include <opaque_fragment>', `
        vec3 ipos = -vViewPosition, iv = normalize(vViewPosition), il = vec3(0.0), isp = vec3(0.0);
        for (int i = 0; i < 6; i++) {
          vec3 d = uLP[i] - ipos; float r2 = dot(d, d); vec3 l = d * inversesqrt(r2);
          float att = 1.0 / (1.0 + r2 * 3.0);
          il += uLC[i] * att * (max(dot(normal, l), 0.0) * 0.85 + 0.15);
          isp += uLC[i] * att * pow(max(dot(iv, reflect(-l, normal)), 0.0), 24.0);
        }
        outgoingLight += diffuseColor.rgb * il + isp * (1.0 - roughnessFactor) * 0.9;
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'bridgeInterior';
  return m;
}

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }

// ------------------------------------------------------------------ layouts
function fighter(K) {
  const S = K.S;
  const arch = [[-1.06, -0.4, -1.2], [-1.0, 0.12, -1.16], [-0.76, 0.58, -1.02], [-0.36, 0.84, -0.84], [0, 0.9, -0.76], [0.36, 0.84, -0.84], [0.76, 0.58, -1.02], [1.0, 0.12, -1.16], [1.06, -0.4, -1.2]];
  K.tube('frame', arch, 0.05, 48);
  K.tube('panel', arch.map(([x, y, z]) => [x * 0.97, y - 0.02, z + 0.06]), 0.022, 48);
  for (const s of [-1, 1]) {
    K.tube('frame', [[s * 1.06, -0.4, -1.2], [s * 1.12, -0.36, -0.6], [s * 1.08, -0.3, 0.2]], 0.045, 12);
    K.tube('frame', [[s * 1.0, 0.12, -1.16], [s * 1.1, 0.26, -0.5], [s * 1.05, 0.32, 0.2]], 0.03, 12);
    K.tube('lit', [[s * 1.02, -0.44, -1.16], [s * 1.08, -0.4, -0.6], [s * 1.04, -0.34, 0.1]], 0.007, 12);
    // glare-shield wings and angled side panels
    K.box('panel', 0.5, 0.05, 0.34, [s * 1.0, -0.39, -1.0], [-0.08, -s * 0.55, 0]);
    const sf = K.cons(0.5, 0.3, 0.06, [s * 0.96, -0.56, -0.84], [-0.6, -s * 0.6, 0]);
    K.screen(sf, s * 0.06, 0.03, 0.22, 0.15, s < 0 ? 4 : 5);
    K.keys(sf, -s * 0.15 - 0.03, -0.1, 3, 3, 0.03, 0.045, 0.02);
  }
  K.box('panel', 1.9, 0.05, 0.36, [0, -0.37, -1.1], [-0.08, 0, 0]);
  K.bar('frame', [-0.95, -0.39, -0.925], [0.95, -0.39, -0.925], 0.026, 0.026);
  K.bar('lit', [-0.9, -0.413, -0.93], [0.9, -0.413, -0.93], 0.008, 0.008);
  const f = K.cons(1.7, 0.36, 0.08, [0, -0.56, -0.96], [-0.5, 0, 0]);
  K.mfd(f, -0.55, -0.01, 0.34, 0.25, 0);
  K.mfd(f, 0, -0.01, 0.34, 0.25, 3);
  K.mfd(f, 0.55, -0.01, 0.34, 0.25, 1);
  K.keys(f, -0.19, 0.145, 8, 1, 0.054, 0, 0.026, (i) => (i === 3 || i === 4 ? S.warn : S.keys[i % 2]));
  // throttle quadrant
  K.box('panel', 0.16, 0.08, 0.34, [-0.78, -0.6, -0.66], [0, 0.3, 0]);
  K.bar('frame', [-0.78, -0.58, -0.66], [-0.77, -0.47, -0.74], 0.025, 0.025);
  K.box('panel', 0.07, 0.05, 0.09, [-0.77, -0.45, -0.75], [0.3, 0.3, 0]);
  K.box('lit', 0.02, 0.012, 0.02, [-0.77, -0.423, -0.76], [0, 0, 0], null, S.warn);
  // cockpit tub: floor, side walls, footwell, seat and the bulkhead behind it
  K.deck(-1.0, 1.0, -1.15, 0.7, -1.05, 0.33);
  for (const s of [-1, 1]) {
    K.wallX(s, 1.06, -1.15, 0.7, -1.05, -0.42, 0.37);
    K.box('lit', 0.012, 0.008, 1.7, [s * 0.92, -1.03, -0.25], [0, 0, 0], null, S.accent.clone().multiplyScalar(0.6));
    const sc = K.cons(0.32, 0.62, 0.08, [s * 0.66, -0.66, -0.1], [-Math.PI / 2, 0, 0]);
    K.keys(sc, -0.1, -0.22, 3, 6, 0.1, 0.08, 0.022);
    K.box('panel', 0.3, 0.35, 0.6, [s * 0.66, -0.875, -0.1]);
    K.box('frame', 0.12, 0.035, 0.22, [s * 0.2, -0.95, -0.92], [0.6, 0, 0]);
  }
  K.wallZ(-1.15, -1.06, 1.06, -1.05, -0.62, 0.35);
  K.wallZ(0.7, -1.1, 1.1, -1.05, 0.5, 0.44);
  K.tube('frame', arch.map(([x, y]) => [x, y * 0.82 - 0.05, 0.64]), 0.05, 48);
  K.seat(0, 0.42, -1.05, -0.62, 0.56);
  K.box('frame', 0.16, 0.06, 0.16, [0, -1.0, -0.45]);
  K.bar('frame', [0, -0.98, -0.45], [0, -0.66, -0.5], 0.035, 0.035);
  K.box('panel', 0.06, 0.12, 0.06, [0, -0.6, -0.51], [-0.2, 0, 0]);
  K.box('lit', 0.02, 0.012, 0.02, [0, -0.535, -0.52], [0, 0, 0], null, S.warn);
}

function command(K, lux) {
  const S = K.S;
  for (const x of [-3.4, -2.3, -1.0, 1.0, 2.3, 3.4]) K.bar('frame', [x, -0.75, -2.5], [x * 1.06, 1.05, -2.85], 0.13, 0.18);
  K.bar('frame', [-3.6, 1.08, -2.85], [3.6, 1.08, -2.85], 0.22, 0.28);
  K.bar('frame', [-3.6, -0.78, -2.5], [3.6, -0.78, -2.5], 0.2, 0.26);
  K.bar('lit', [-3.4, 0.94, -2.8], [3.4, 0.94, -2.8], 0.018, 0.018);
  K.bar('lit', [-3.4, -0.66, -2.47], [3.4, -0.66, -2.47], 0.012, 0.012, S.warn.clone().multiplyScalar(0.6));
  // ceiling: panels, ribs and light strips running toward the window
  K.box('panel', 7.4, 0.08, 3.0, [0, 1.24, -1.5]);
  K.box('panel', 6.0, 0.08, 2.7, [0, 1.24, 1.35]);
  for (const z of [0.6, 1.8]) K.box('frame', 5.9, 0.14, 0.12, [0, 1.16, z]);
  for (const x of [-1.5, 0, 1.5]) K.box('lit', 0.05, 0.015, 2.6, [x, 1.19, 1.35], [0, 0, 0], null, x ? S.accent.clone().multiplyScalar(0.8) : col(0.95, 0.97, 1));
  for (const z of [-1.9, -2.4]) K.box('frame', 7.4, 0.14, 0.12, [0, 1.16, z]);
  for (const x of [-1.5, 0, 1.5]) K.box('lit', 0.05, 0.015, 2.4, [x, 1.19, -1.5], [0, 0, 0], null, x ? S.accent.clone().multiplyScalar(0.8) : col(0.95, 0.97, 1));
  for (const s of [-1, 1]) {
    for (const z of [-1.0, -1.8, -2.45]) K.bar('frame', [s * 2.9, -1.6, z], [s * 2.78, 1.2, z], 0.16, 0.16);
    K.wallX(s, 2.97, -2.7, 2.7, -1.75, 1.24, 0.9);
    K.bar('lit', [s * 2.89, 0.75, -0.3], [s * 2.89, 0.75, 2.6], 0.015, 0.015);
    K.mfd(mat([s * 2.88, 0.1, 1.35], [0, -s * Math.PI / 2, 0]), 0, 0, 0.8, 0.5, s < 0 ? 6 : 2, 4);
    // crew seats and desk pedestals
    K.box('panel', 0.5, 0.08, 0.3, [s * 0.95, -1.4, -1.62]);
    K.cyl('frame', 0.06, 0.09, 0.35, [s * 0.95, -1.575, -1.62]);
    K.box('panel', 0.55, 0.22, 0.3, [s * 0.95, -1.64, -2.0]);
    K.bar('lit', [s * 2.84, -0.6, -2.2], [s * 2.78, 1.0, -2.2], 0.02, 0.02);
    // crew stations in the lower pit
    K.box('panel', 0.5, 0.62, 0.14, [s * 0.95, -1.15, -1.5], [0.12, 0, 0]);
    K.box('panel', 0.3, 0.16, 0.12, [s * 0.95, -0.76, -1.5]);
    K.box('lit', 0.3, 0.012, 0.01, [s * 0.95, -0.85, -1.43], [0, 0, 0], null, S.accent.clone().multiplyScalar(0.5));
    const cf = K.cons(0.7, 0.3, 0.4, [s * 0.95, -1.38, -2.0], [-1.0, 0, 0]);
    K.screen(cf, 0, 0, 0.42, 0.2, s < 0 ? 4 : 2);
  }
  // main console arc under the window
  for (let i = -2; i <= 2; i++) {
    const a = i * 0.36, R = 2.15;
    const f = K.cons(0.8, 0.42, 0.5, [Math.sin(a) * R, -1.0, -Math.cos(a) * R], [-0.75, -a, 0]);
    K.mfd(f, -0.12, 0.02, 0.34, 0.22, [5, 0, 7, 3, 1][i + 2], 3);
    K.keys(f, 0.14, -0.13, 3, 6, 0.04, 0.05, 0.022);
    K.box('lit', 0.76, 0.01, 0.01, [0, 0.2, 0.01], [0, 0, 0], f);
    K.box('panel', 0.6, 0.6, 0.35, [Math.sin(a) * R * 1.04, -1.45, -Math.cos(a) * R * 1.04], [0, -a, 0]);
  }
  // deck, fore and aft walls, lift doors and the captain's chair on a lit dais
  K.deck(-2.95, 2.95, -2.5, 2.7, -1.75, 0.6);
  K.wallZ(-2.5, -2.95, 2.95, -1.75, -0.8, 0.9);
  K.wallZ(2.7, -2.95, 2.95, -1.75, 1.24, 0.9);
  K.door(2.7, 0, -1.75, 1.1, 2.1);
  for (const s of [-1, 1]) K.mfd(mat([s * 1.9, -0.3, 2.62], [0, Math.PI, 0]), 0, 0, 0.7, 0.45, s < 0 ? 0 : 5, 3);
  K.cyl('frame', 0.34, 0.42, 0.24, [0, -1.64, -2.0], [0, 0, 0], null, null, 20);
  K.cyl('panel', 1.0, 1.05, 0.18, [0, -1.66, 0.2], [0, 0, 0], null, null, 32);
  K.torus('lit', 1.02, 0.012, [0, -1.57, 0.2], [Math.PI / 2, 0, 0], null, S.accent.clone().multiplyScalar(0.7));
  K.seat(0, 0.45, -1.57, -0.78, 0.7);
  for (const s of [-1, 1]) for (let j = 0; j < 4; j++) K.box('lit', 0.025, 0.01, 0.03, [s * 0.39, -0.525, 0.12 - j * 0.07], [0, 0, 0], null, S.keys[j % 3]);
  // holotable with a rotating projection
  K.cyl('panel', 0.3, 0.38, 0.45, [0, -1.3, -2.0], [0, 0, 0], null, null, 20);
  K.torus('lit', 0.29, 0.014, [0, -1.075, -2.0], [Math.PI / 2, 0, 0]);
  K.cyl('glass', 0.2, 0.05, 0.22, [0, -0.96, -2.0], [0, 0, 0], null, null, 16);
  K.add('holo', new THREE.IcosahedronGeometry(0.11, 1), mat([0, 0, 0]));
  K.add('holo', new THREE.TorusGeometry(0.16, 0.005, 4, 40), mat([0, 0, 0], [Math.PI / 2 + 0.3, 0, 0]));
  K.holoPos = [0, -0.84, -2.0];
  if (lux) K.box('lit', 6.8, 0.01, 0.01, [0, -0.72, -2.46], [0, 0, 0], null, col(0.9, 0.95, 1));
}

function civil(K) {
  const S = K.S;
  for (const x of [-2.4, -0.95, 0.95, 2.4]) K.bar('frame', [x, -0.55, -1.6], [x * 1.04, 1.0, -1.95], 0.1, 0.12);
  K.bar('frame', [-2.8, 1.02, -1.95], [2.8, 1.02, -1.95], 0.18, 0.2);
  K.bar('frame', [-2.8, -0.56, -1.6], [2.8, -0.56, -1.6], 0.16, 0.2);
  for (const s of [-1, 1]) {
    // wipers parked on the side panes
    K.cyl('frame', 0.03, 0.03, 0.03, [s * 1.9, -0.49, -1.62], [Math.PI / 2, 0, 0]);
    K.bar('frame', [s * 1.9, -0.49, -1.63], [s * 1.2, -0.4, -1.67], 0.022, 0.012);
    // empty co-pilot / navigator seat backs
    K.box('panel', 0.5, 0.55, 0.14, [s * 1.35, -0.86, -1.65], [0.1, s * 0.1, 0]);
    K.box('panel', 0.3, 0.14, 0.12, [s * 1.35, -0.52, -1.66], [0, s * 0.1, 0]);
  }
  K.box('panel', 4.8, 0.06, 0.3, [0, -0.5, -1.55]);
  const f = K.cons(3.4, 0.5, 0.1, [0, -0.68, -1.32], [-1.15, 0, 0]);
  [-1.35, -1.0, 1.0, 1.35].forEach((x, i) => { K.box('frame', 0.26, 0.26, 0.02, [x, 0.06, 0.01], [0, 0, 0], f); K.screen(f, x, 0.06, 0.22, 0.22, i % 2 ? 0 : 6); });
  K.mfd(f, -0.42, 0.06, 0.4, 0.26, 2, 3);
  K.mfd(f, 0.42, 0.06, 0.4, 0.26, 7, 3);
  // chunky toggle row
  for (let i = 0; i < 12; i++) {
    const x = -0.9 + i * 0.164;
    K.box('frame', 0.05, 0.05, 0.03, [x, -0.16, 0.015], [0, 0, 0], f);
    K.box('lit', 0.016, 0.016, 0.01, [x, -0.11, 0.008], [0, 0, 0], f, i % 5 === 2 ? S.warn : S.keys[i % 2]);
  }
  // overhead switch panel
  const o = K.cons(1.5, 0.6, 0.08, [0, 0.86, -1.4], [1.1, 0, 0]);
  K.keys(o, -0.6, -0.22, 14, 4, 0.092, 0.13, 0.018);
  // a mug on the dash
  K.cyl('panel', 0.045, 0.04, 0.1, [1.6, -0.42, -1.5], [0, 0, 0], null, null, 14);
  K.torus('panel', 0.03, 0.008, [1.65, -0.42, -1.5], [0, 0, 0]);
  // deck, walls, ceiling lamps, pilot seat, lockers and a galley counter
  K.deck(-2.55, 2.55, -1.62, 2.0, -1.35, 0.52);
  K.box('panel', 3.4, 0.62, 0.3, [0, -1.04, -1.42]);
  K.wallZ(-1.62, -2.55, 2.55, -1.35, -0.56, 0.72);
  K.wallZ(2.0, -2.55, 2.55, -1.35, 1.12, 0.72);
  K.door(2.0, 0.9, -1.35, 0.9, 2.05);
  for (const s of [-1, 1]) K.wallX(s, 2.57, -1.65, 2.0, -1.35, 1.12, 0.72);
  K.box('panel', 5.1, 0.06, 3.7, [0, 1.12, 0.15]);
  for (const z of [0.0, 1.0]) K.box('frame', 5.0, 0.1, 0.1, [0, 1.06, z]);
  for (const x of [-1.0, 1.0]) K.box('lit', 0.6, 0.012, 0.25, [x, 1.085, 0.6], [0, 0, 0], null, col(1.0, 0.85, 0.6));
  K.seat(0, 0.4, -1.35, -0.8, 0.62);
  for (let i = 0; i < 4; i++) {
    const z = 0.55 + i * 0.44;
    K.box('panel', 0.4, 1.8, 0.42, [-2.32, -0.45, z]);
    K.box('frame', 0.02, 0.22, 0.03, [-2.11, -0.3, z + 0.14]);
    for (let j = 0; j < 3; j++) K.box('frame', 0.01, 0.015, 0.26, [-2.115, 0.25 + j * 0.05, z]);
  }
  K.box('panel', 0.6, 0.9, 1.2, [2.22, -0.9, 1.1]);
  K.box('frame', 0.64, 0.04, 1.24, [2.22, -0.43, 1.1]);
  K.box('frame', 0.3, 0.42, 0.3, [2.32, -0.2, 1.45]);
  K.box('lit', 0.03, 0.03, 0.01, [2.16, -0.1, 1.45], [0, Math.PI / 2, 0], null, S.warn);
  K.cyl('panel', 0.045, 0.04, 0.1, [2.12, -0.36, 0.8], [0, 0, 0], null, null, 14);
}

function clan(K) {
  const S = K.S, r = rng(7);
  for (const s of [-1, 1]) {
    K.bar('frame', [s * 1.1, -0.42, -1.15], [s * 0.8, 0.85, -1.35], 0.09, 0.07);
    K.bar('frame', [s * 0.8, 0.85, -1.35], [s * 0.25, 0.95, -1.2], 0.08, 0.07);
    K.tube('frame', [[s * 1.15, -0.55, -0.4], [s * 1.1, -0.46, -1.0], [s * 0.9, -0.5, -1.2]], 0.035, 10);
  }
  K.bar('frame', [0.95, -0.3, -1.25], [0.35, 0.9, -1.3], 0.05, 0.05);
  // welded patch over a broken pane, with rivets
  const pm = mat([-0.78, 0.62, -1.3], [0, 0.15, 0.22]);
  K.add('panel', new THREE.BoxGeometry(0.75, 0.5, 0.035), pm.clone());
  for (let i = 0; i < 10; i++) {
    const t = i / 10 * Math.PI * 2;
    K.cyl('frame', 0.014, 0.014, 0.02, [Math.cos(t) * 0.33, Math.sin(t) * 0.21, 0.02], [Math.PI / 2, 0, 0], pm, null, 6);
  }
  // sagging cables and a hanging lamp
  K.tube('frame', [[-1.0, 0.95, -0.85], [-0.6, 0.5, -1.0], [-0.15, 0.85, -1.15]], 0.02, 16);
  K.tube('frame', [[0.2, 0.95, -1.1], [0.45, 0.62, -1.15], [0.9, 0.9, -1.0]], 0.028, 16);
  K.tube('frame', [[0.62, 0.95, -1.05], [0.6, 0.7, -1.08], [0.58, 0.52, -1.1]], 0.012, 8);
  K.cyl('frame', 0.05, 0.075, 0.08, [0.58, 0.49, -1.1]);
  K.box('lit', 0.05, 0.04, 0.05, [0.58, 0.44, -1.1], [0, 0, 0], null, S.accent);
  // bent dash with welded plates
  K.box('panel', 2.2, 0.06, 0.45, [0, -0.42, -1.08], [-0.1, 0, 0.03]);
  for (let i = 0; i < 6; i++) K.box('panel', 0.2 + r() * 0.3, 0.03, 0.15 + r() * 0.2, [-1 + i * 0.4, -0.385 + r() * 0.01, -1.0 - r() * 0.1], [r() * 0.2, r() * 0.5, r() * 0.1]);
  for (let i = 0; i < 14; i++) K.box('lit', 0.04, 0.012, 0.01, [-0.95 + i * 0.145, -0.418, -0.85], [0, 0, (i % 2 ? 0.6 : -0.6)], null, i % 2 ? S.warn : col(1, 0.65, 0.1));
  const f1 = K.cons(0.5, 0.32, 0.12, [-0.55, -0.56, -0.98], [-0.45, 0.25, 0.06]);
  const f2 = K.cons(0.44, 0.3, 0.1, [0.05, -0.58, -1.0], [-0.6, 0, -0.04]);
  const f3 = K.cons(0.58, 0.28, 0.14, [0.62, -0.55, -0.96], [-0.35, -0.3, -0.08]);
  K.mfd(f1, 0.02, 0.0, 0.3, 0.2, 0, 3);
  K.screen(f2, 0, 0.02, 0.3, 0.2, 7);
  K.keys(f2, -0.16, -0.12, 6, 1, 0.064, 0, 0.026);
  K.mfd(f3, -0.04, 0.0, 0.36, 0.2, 6, 3);
  // pressure gauge bolted to the left pipe
  K.cyl('frame', 0.06, 0.06, 0.04, [-1.02, -0.36, -1.0], [Math.PI / 2, 0.5, 0]);
  K.cyl('lit', 0.045, 0.045, 0.01, [-1.0, -0.36, -0.975], [Math.PI / 2, 0.5, 0], null, col(0.3, 0.17, 0.05));
  // warped deck plates (one missing, grating showing), patched walls, pipes, a hatch and clutter
  K.deck(-1.22, 1.22, -1.2, 1.25, -1.15, 0.49, 'panel', (i, j) => (i === 3 && j === 1 ? false : [(r() - 0.5) * 0.03, (r() - 0.5) * 0.07, (r() - 0.5) * 0.07]));
  for (let i = 0; i < 5; i++) K.box('frame', 0.02, 0.02, 0.44, [0.27 + i * 0.1, -1.17, -0.47]);
  K.wallZ(-1.2, -1.22, 1.22, -1.15, -0.42, 0.5);
  K.wallZ(1.25, -1.22, 1.22, -1.15, 1.0, 0.5);
  for (const s of [-1, 1]) {
    K.wallX(s, 1.24, -1.25, 1.25, -1.15, 1.0, 0.5);
    for (let k = 0; k < 4; k++) K.box('panel', 0.03, 0.25 + r() * 0.3, 0.25 + r() * 0.35, [s * 1.18, -0.7 + r() * 1.3, -0.9 + r() * 1.9], [r() * 0.12, 0, r() * 0.12]);
    K.tube('frame', [[s * 1.13, 0.8, -1.2], [s * 1.1, 0.74, 0], [s * 1.13, 0.8, 1.2]], 0.04, 10);
    K.tube('frame', [[s * 1.15, -0.95, -1.1], [s * 1.12, -0.9, 0.2], [s * 1.0, -1.1, 1.1]], 0.025, 10);
  }
  K.box('panel', 2.5, 0.05, 2.6, [0, 1.0, 0.05], [0, 0, 0.02]);
  for (const z of [-0.3, 0.6]) K.box('frame', 2.4, 0.08, 0.08, [0, 0.95, z], [0, 0, 0.02]);
  K.torus('frame', 0.42, 0.06, [0.3, -0.35, 1.2], [0, 0, 0]);
  K.cyl('panel', 0.4, 0.4, 0.05, [0.3, -0.35, 1.2], [Math.PI / 2, 0, 0], null, null, 20);
  K.torus('frame', 0.14, 0.02, [0.3, -0.35, 1.16], [0, 0, 0]);
  for (const t of [0, Math.PI / 2]) K.box('frame', 0.28, 0.02, 0.02, [0.3, -0.35, 1.16], [0, 0, t]);
  K.seat(0, 0.42, -1.15, -0.72, 0.55);
  K.box('frame', 0.3, 0.06, 0.11, [0.05, -0.1, 0.42], [0, 0, 0.4]);
  K.box('panel', 0.45, 0.35, 0.4, [0.78, -0.97, 0.7], [0, 0.4, 0]);
  K.box('frame', 0.3, 0.22, 0.3, [0.72, -0.68, 0.72], [0, -0.2, 0]);
  K.cyl('frame', 0.035, 0.035, 0.22, [-0.8, -1.02, 0.85], [0, 0, 0], null, null, 8);
  K.cyl('frame', 0.035, 0.035, 0.22, [-0.95, -1.1, 0.6], [0, 0.5, Math.PI / 2], null, null, 8);
}

function combine(K) {
  const S = K.S;
  for (const s of [-1, 1]) {
    K.box('frame', 0.22, 1.5, 0.22, [s * 1.3, 0.15, -1.5]);
    K.box('frame', 0.3, 0.3, 0.12, [s * 1.13, 0.7, -1.47], [0, 0, Math.PI / 4]);
    K.box('frame', 0.3, 0.3, 0.12, [s * 1.13, -0.4, -1.47], [0, 0, Math.PI / 4]);
    // identical cube cabinets with vents
    K.box('panel', 0.5, 0.5, 0.6, [s * 1.15, -0.75, -0.95]);
    for (let j = 0; j < 4; j++) K.box('frame', 0.36, 0.02, 0.02, [s * 1.15, -0.6 - j * 0.06, -0.64]);
    K.cyl('frame', 0.012, 0.012, 0.12, [s * 0.95, 0.72, -1.32], [0, 0, 0], null, null, 6);
  }
  K.box('frame', 2.8, 0.24, 0.24, [0, 0.88, -1.5]);
  K.box('frame', 2.8, 0.2, 0.26, [0, -0.55, -1.45]);
  // hazard stripes on the sill
  for (let i = -11; i <= 11; i++) K.box('lit', 0.05, 0.18, 0.004, [i * 0.12, -0.55, -1.317], [0, 0, 0.6], null, col(0.32, 0.24, 0.03));
  // fluorescent tube
  K.cyl('lit', 0.018, 0.018, 1.5, [0, 0.67, -1.32], [0, 0, Math.PI / 2], null, col(0.5, 0.55, 0.5), 8);
  // three identical console modules
  for (const i of [-1, 0, 1]) {
    const f = K.cons(0.62, 0.34, 0.3, [i * 0.68, -0.66, -1.12], [-0.55, 0, 0]);
    K.box('frame', 0.46, 0.26, 0.012, [-0.06, 0.02, 0.006], [0, 0, 0], f);
    K.screen(f, -0.06, 0.02, 0.42, 0.22, i === 0 ? 7 : 1);
    K.keys(f, 0.21, -0.1, 1, 5, 0, 0.05, 0.024, (a, j) => (j === 4 ? S.warn : S.accent));
    K.box('frame', 0.12, 0.04, 0.01, [-0.2, -0.145, 0.006], [0, 0, 0], f);
  }
  // standard-issue deck, wall and ceiling modules, a second tube light and a hazard-striped door
  K.deck(-1.44, 1.44, -1.42, 1.3, -1.0, 0.48);
  K.wallZ(-1.42, -1.44, 1.44, -1.0, -0.55, 0.48);
  K.wallZ(1.3, -1.44, 1.44, -1.0, 1.0, 0.48);
  K.door(1.3, 0, -1.0, 0.8, 1.85);
  for (let i = -4; i <= 4; i++) K.box('lit', 0.05, 0.004, 0.16, [i * 0.1, -0.984, 1.08], [0, 0.6, 0], null, col(0.32, 0.24, 0.03));
  for (const s of [-1, 1]) {
    K.wallX(s, 1.46, -1.5, 1.3, -1.0, 1.0, 0.47);
    for (const z of [-0.3, 0.4]) K.box('lit', 0.005, 0.12, 0.2, [s * 1.4, 0.35, z], [0, 0, 0], null, col(0.3, 0.24, 0.04));
  }
  K.mfd(mat([1.4, 0.0, 0.75], [0, -Math.PI / 2, 0]), 0, 0, 0.36, 0.24, 7, 3);
  K.box('panel', 2.95, 0.05, 2.9, [0, 1.02, -0.1]);
  for (const x of [-0.96, -0.48, 0, 0.48, 0.96]) K.box('frame', 0.03, 0.03, 2.8, [x, 0.99, -0.1]);
  for (const z of [-1.0, -0.4, 0.2, 0.8]) K.box('frame', 2.9, 0.03, 0.03, [0, 0.99, z]);
  K.box('frame', 1.6, 0.04, 0.1, [0, 0.985, 0.35]);
  K.cyl('lit', 0.018, 0.018, 1.5, [0, 0.95, 0.35], [0, 0, Math.PI / 2], null, col(0.5, 0.55, 0.5), 8);
  K.seat(0, 0.4, -1.0, -0.62, 0.5);
}

const LAYOUT = { fighter, command, civil, clan, combine };

export function buildBridge(hull, env) {
  const kind = bridgeKind(hull), lux = LUXURY.has(hull);
  const S = { ...STYLE[kind] };
  if (lux && kind === 'command') { S.panel = [0xb4b8bf, 0.35, 0.4]; S.frame = [0x8a9098, 0.8, 0.3]; }
  const K = new Kit(S);
  LAYOUT[kind](K, lux);
  const U = { pos: { value: S.lights.map((l) => new THREE.Vector3(...l[0])) }, col: { value: S.lights.map(() => new THREE.Vector3()) } };
  const litMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.4, 1.4, 1.4) });
  const scrMat = new THREE.MeshBasicMaterial({ map: (texCache[kind] ||= screenTexture(kind)), color: new THREE.Color(1.6, 1.6, 1.6) });
  const glassMat = new THREE.MeshBasicMaterial({ color: S.glass, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const holoMat = new THREE.MeshBasicMaterial({ color: S.accent.clone().multiplyScalar(0.3), wireframe: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const mats = { frame: interiorMat(S.frame, env, U), panel: interiorMat(S.panel, env, U), scr: scrMat, lit: litMat, glass: glassMat, holo: holoMat };
  const g = new THREE.Group();
  g.name = 'bridge';
  let holo = null;
  for (const k of Object.keys(K.L)) {
    if (!K.L[k].length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(K.L[k], false), mats[k]);
    mesh.frustumCulled = false;
    mesh.renderOrder = k === 'glass' || k === 'holo' ? 3 : 2;
    if (k === 'holo') { holo = mesh; mesh.position.set(...K.holoPos); }
    g.add(mesh);
  }
  const base = S.lights.map((l) => new THREE.Vector3(l[1].r, l[1].g, l[1].b).multiplyScalar(l[2]));
  const red = new THREE.Vector3(1.0, 0.08, 0.04), litBase = new THREE.Color(1.1, 1.1, 1.1), litRed = new THREE.Color(2.0, 0.35, 0.25);
  let alertK = 0;
  g.userData = {
    hull, env, kind,
    // alert: 0..1 combat state; lights pulse red while it is up
    update(t, dt, alert) {
      alertK += (alert - alertK) * (1 - Math.exp(-dt * 3));
      const pulse = alertK * (0.55 + 0.45 * Math.sin(t * 5.5));
      const flick = kind === 'clan' ? 0.8 + 0.2 * Math.sin(t * 23) * Math.sin(t * 7.3) + (Math.sin(t * 1.7) > 0.97 ? -0.5 : 0) : 1;
      for (let i = 0; i < base.length; i++) {
        const v = U.col.value[i].copy(base[i]).multiplyScalar((i === 0 ? flick : 1) * (1 - alertK * 0.6));
        v.addScaledVector(red, pulse * (i === 0 ? 1.1 : 0.7));
      }
      litMat.color.copy(litBase).multiplyScalar(kind === 'clan' ? 0.75 + 0.25 * flick : 1).lerp(litRed, pulse * 0.5);
      if (holo) { holo.rotation.y = t * 0.6; holo.rotation.x = Math.sin(t * 0.4) * 0.2; }
    },
    dispose() {
      for (const c of g.children) c.geometry.dispose();
      for (const k in mats) mats[k].dispose();
    }
  };
  g.visible = false;
  return g;
}
