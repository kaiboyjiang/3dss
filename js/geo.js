import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

export function mat(pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  _e.set(rot[0], rot[1], rot[2]);
  _q.setFromEuler(_e);
  _p.set(pos[0], pos[1], pos[2]);
  _s.set(scl[0], scl[1], scl[2]);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

// Box-projected UVs in the geometry's own space with a fixed texel density (metres per tile).
export function boxUV(geo, tile = 8, offset = [0, 0]) {
  const pos = geo.attributes.position, nrm = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i));
    let u, v;
    if (nx >= ny && nx >= nz) { u = z; v = y; }
    else if (ny >= nz) { u = x; v = z; }
    else { u = x; v = y; }
    uv[i * 2] = u / tile + offset[0];
    uv[i * 2 + 1] = v / tile + offset[1];
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function clean(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}

/** Collects geometry pieces grouped by material key and merges them into a few draw calls. */
export class Kit {
  constructor() { this.parts = {}; }
  add(key, geo, matrix) {
    const g = clean(geo.clone ? geo.clone() : geo);
    if (matrix) g.applyMatrix4(matrix);
    (this.parts[key] ||= []).push(g);
    return this;
  }
  // mirror across X (for symmetric ships)
  addMirrored(key, geo, matrix) {
    this.add(key, geo, matrix);
    const m = new THREE.Matrix4().makeScale(-1, 1, 1).multiply(matrix || new THREE.Matrix4());
    const g = clean(geo.clone());
    g.applyMatrix4(m);
    // fix winding after mirror
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i += 3) {
      for (const a of [p, n, u]) {
        const sz = a.itemSize;
        for (let k = 0; k < sz; k++) {
          const t = a.array[(i + 1) * sz + k];
          a.array[(i + 1) * sz + k] = a.array[(i + 2) * sz + k];
          a.array[(i + 2) * sz + k] = t;
        }
      }
    }
    (this.parts[key] ||= []).push(g);
    return this;
  }
  build(materials, { uvTile = {}, shadows = true } = {}) {
    const group = new THREE.Group();
    for (const [key, list] of Object.entries(this.parts)) {
      const geo = mergeGeometries(list, false);
      if (uvTile[key] !== undefined && uvTile[key] !== null) boxUV(geo, uvTile[key]);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, materials[key]);
      mesh.name = key;
      if (shadows && !materials[key].transparent && !materials[key].userData.noShadow) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
      group.add(mesh);
    }
    return group;
  }
}

export const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  rbox: (w, h, d, r = 0.1, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.01, h / 2.01, d / 2.01)),
  cyl: (rt, rb, h, seg = 24, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open),
  sphere: (r, ws = 24, hs = 16) => new THREE.SphereGeometry(r, ws, hs),
  torus: (r, t, rs = 12, ts = 48) => new THREE.TorusGeometry(r, t, rs, ts),
  // extrude a 2D outline (array of [x,y]) along +Z by depth, with bevel
  extrude: (pts, depth, bevel = 0.1, curveSeg = 1) => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, {
      depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
      bevelSegments: 2, curveSegments: curveSeg,
    });
    g.translate(0, 0, -depth / 2);
    return g;
  },
  // closed superellipse loft along +Z; sections are [z, width, heightUp, heightDown, yOffset = 0, exponent = 2.4]
  // (exponent 2 = ellipse, ~4 = rounded box, 1 = diamond). Sections must be ordered by increasing z.
  loft: (sections, seg = 24, flat = false) => {
    const S = sections.map(([z, w, ht, hb, y = 0, n = 2.4]) => ({ z, w, ht, hb, y, n }));
    const pos = [], idx = [];
    for (const s of S) {
      for (let j = 0; j < seg; j++) {
        const a = (j / seg) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), e = 2 / s.n;
        pos.push(Math.sign(c) * Math.abs(c) ** e * s.w / 2, s.y + Math.sign(sn) * Math.abs(sn) ** e * (sn >= 0 ? s.ht : s.hb), s.z);
      }
    }
    for (let i = 0; i < S.length - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const a = i * seg + j, b = i * seg + (j + 1) % seg, c = b + seg, d = a + seg;
        idx.push(a, b, d, b, c, d);
      }
    }
    const cap = (i, front) => {
      const s = S[i];
      if (s.w < 1e-4 && s.ht + s.hb < 1e-4) return;
      const ci = pos.length / 3;
      pos.push(0, s.y + (s.ht - s.hb) * 0.25, s.z);
      for (let j = 0; j < seg; j++) pos.push(pos[(i * seg + j) * 3], pos[(i * seg + j) * 3 + 1], s.z);
      for (let j = 0; j < seg; j++) {
        const a = ci + 1 + j, b = ci + 1 + (j + 1) % seg;
        if (front) idx.push(ci, a, b); else idx.push(ci, b, a);
      }
    };
    cap(0, false);
    cap(S.length - 1, true);
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    if (flat) g = g.toNonIndexed();
    g.computeVertexNormals();
    return g;
  },
  // profiles may be listed in either direction; LatheGeometry faces outward only when y increases
  lathe: (pts, seg = 32) => {
    const v = pts.map(([x, y]) => new THREE.Vector2(x, y));
    if (v[0].y > v[v.length - 1].y) v.reverse();
    return new THREE.LatheGeometry(v, seg);
  },
};
