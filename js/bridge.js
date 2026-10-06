import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Bridge interior drawn in camera space: canopy frame, dashboard and console screens.
// Three merged meshes, so it costs three draw calls when shown.

const Y = new THREE.Vector3(0, 1, 0);

function bar(a, b, w, d, list) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.BoxGeometry(w, dir.length(), d);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  list.push(g.toNonIndexed());
}

function slab(w, h, d, pos, rx = 0, ry = 0, rz = 0, list) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz);
  g.translate(...pos);
  list.push(g.toNonIndexed());
}

// one canvas holds every display; each screen samples its own cell
function screenTexture() {
  const W = 512, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#020407'; x.fillRect(0, 0, W, H);
  const cell = (i, f) => { const cx = (i % 4) * 128, cy = Math.floor(i / 4) * 128; x.save(); x.translate(cx, cy); x.beginPath(); x.rect(4, 4, 120, 120); x.clip(); f(); x.restore(); };
  const ink = (a) => `rgba(150,196,226,${a})`;
  // radar
  cell(0, () => {
    x.strokeStyle = ink(0.55); x.lineWidth = 1.5;
    for (const r of [18, 36, 54]) { x.beginPath(); x.arc(64, 64, r, 0, Math.PI * 2); x.stroke(); }
    x.beginPath(); x.moveTo(64, 6); x.lineTo(64, 122); x.moveTo(6, 64); x.lineTo(122, 64); x.stroke();
    x.fillStyle = 'rgba(214,92,72,0.9)'; for (const [a, b] of [[88, 40], [30, 90], [96, 82]]) x.fillRect(a - 2, b - 2, 5, 5);
    x.fillStyle = 'rgba(120,214,150,0.9)'; x.fillRect(42, 30, 4, 4);
  });
  // bar charts and readouts
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
  // ship schematic
  cell(3, () => {
    x.strokeStyle = ink(0.75); x.lineWidth = 2;
    x.beginPath(); x.moveTo(64, 14); x.lineTo(92, 96); x.lineTo(64, 84); x.lineTo(36, 96); x.closePath(); x.stroke();
    x.fillStyle = 'rgba(214,170,80,0.85)'; x.fillRect(58, 100, 12, 14);
  });
  // text blocks
  for (let i = 4; i < 8; i++) cell(i, () => {
    for (let r = 0; r < 9; r++) {
      x.fillStyle = ink(r === 0 ? 0.9 : 0.45);
      const n = 2 + ((r * 7 + i * 3) % 5);
      for (let k = 0; k < n; k++) x.fillRect(10 + k * 22, 12 + r * 12, 16 - ((r + k) % 3) * 4, 5);
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function screen(w, h, pos, rx, ry, idx, list) {
  const g = new THREE.PlaneGeometry(w, h);
  const u0 = (idx % 4) / 4, v0 = 1 - (Math.floor(idx / 4) + 1) / 2;
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.25, v0 + uv.getY(i) * 0.5);
  g.rotateX(rx); g.rotateY(ry);
  g.translate(...pos);
  list.push(g.toNonIndexed());
}

export function buildBridge(env) {
  const frame = [], dash = [], scr = [];
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  // canopy: two forward pillars, a header, roof spine and side window frames
  for (const s of [-1, 1]) {
    bar(v(s * 1.18, -0.42, -0.95), v(s * 0.82, 0.78, -1.2), 0.07, 0.09, frame);
    bar(v(s * 0.82, 0.78, -1.2), v(s * 1.05, 1.05, -0.2), 0.06, 0.08, frame);
    bar(v(s * 1.75, -0.36, -0.55), v(s * 1.5, 0.9, -0.45), 0.07, 0.09, frame);
    bar(v(s * 1.18, -0.42, -0.95), v(s * 1.75, -0.36, -0.55), 0.05, 0.05, frame);
    bar(v(s * 1.0, 0.25, -1.08), v(s * 1.62, 0.3, -0.5), 0.03, 0.03, frame);
  }
  bar(v(-0.82, 0.78, -1.2), v(0.82, 0.78, -1.2), 0.06, 0.08, frame);
  bar(v(0, 0.78, -1.2), v(0, 1.08, -0.2), 0.05, 0.07, frame);
  // dashboard: top shelf, sloped face and lip
  slab(2.6, 0.04, 0.42, [0, -0.43, -0.92], -0.12, 0, 0, dash);
  slab(2.6, 0.32, 0.05, [0, -0.6, -0.72], 0.75, 0, 0, dash);
  slab(2.62, 0.035, 0.04, [0, -0.41, -1.12], 0, 0, 0, frame);
  // side consoles angled toward the pilot
  for (const s of [-1, 1]) {
    slab(0.62, 0.05, 0.5, [s * 1.55, -0.5, -0.45], -0.1, -s * 0.5, -s * 0.18, dash);
    slab(0.58, 0.28, 0.05, [s * 1.62, -0.62, -0.28], 0.8, -s * 0.6, 0, dash);
  }
  // centre column under the dash
  slab(0.5, 0.5, 0.36, [0, -0.88, -0.75], 0.25, 0, 0, dash);
  // screens on the sloped face and side consoles
  const face = [0, -0.585, -0.705], fx = -0.82;
  screen(0.34, 0.2, [face[0] - 0.62, face[1], face[2] + 0.004], fx, 0, 4, scr);
  screen(0.34, 0.2, [face[0] - 0.24, face[1], face[2] + 0.004], fx, 0, 0, scr);
  screen(0.34, 0.2, [face[0] + 0.24, face[1], face[2] + 0.004], fx, 0, 3, scr);
  screen(0.34, 0.2, [face[0] + 0.62, face[1], face[2] + 0.004], fx, 0, 5, scr);
  screen(0.3, 0.17, [-1.6, -0.6, -0.245], -0.87, 0.6, 1, scr);
  screen(0.3, 0.17, [1.6, -0.6, -0.245], -0.87, -0.6, 2, scr);
  screen(0.22, 0.13, [-1.05, -0.49, -0.86], -1.35, 0.15, 6, scr);
  screen(0.22, 0.13, [1.05, -0.49, -0.86], -1.35, -0.15, 7, scr);
  const g = new THREE.Group();
  g.name = 'bridge';
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3e44, metalness: 0.85, roughness: 0.38, envMap: env, envMapIntensity: 0.9, emissive: 0x0a0c0f });
  const panel = new THREE.MeshStandardMaterial({ color: 0x1c1f23, metalness: 0.5, roughness: 0.62, envMap: env, envMapIntensity: 0.6, emissive: 0x08090b });
  const glow = new THREE.MeshBasicMaterial({ map: screenTexture(), color: new THREE.Color(1.6, 1.6, 1.6) });
  for (const [list, m] of [[frame, metal], [dash, panel], [scr, glow]]) {
    const mesh = new THREE.Mesh(mergeGeometries(list, false), m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    g.add(mesh);
  }
  g.visible = false;
  return g;
}
