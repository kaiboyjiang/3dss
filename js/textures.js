import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(c, srgb, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

// Build a tangent-space normal map from a grayscale height canvas.
function normalFromHeight(hc, strength) {
  const w = hc.width, h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h);
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  const d = img.data;
  const hm = new Float32Array(w * h);
  for (let i = 0, j = 0; i < hm.length; i++, j += 4) hm[i] = src[j] * (strength / 255);
  for (let y = 0; y < h; y++) {
    const row = y * w, up = ((y + h - 1) % h) * w, dn = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const xl = x ? x - 1 : w - 1, xr = x + 1 < w ? x + 1 : 0;
      const nx = hm[row + xl] - hm[row + xr], ny = hm[dn + x] - hm[up + x];
      const k = 127.5 / Math.sqrt(nx * nx + ny * ny + 1);
      const i = (row + x) * 4;
      d[i] = nx * k + 127.5;
      d[i + 1] = ny * k + 127.5;
      d[i + 2] = k + 127.5;
      d[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function grime(ctx, size, r, count, color, maxR, alpha) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size, rad = (0.2 + r()) * maxR;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, color.replace('A', (alpha * r()).toFixed(3)));
    g.addColorStop(1, color.replace('A', '0'));
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  ctx.restore();
}

/**
 * Procedural sci-fi hull plating. Returns PBR maps: map (albedo), normalMap, roughnessMap.
 * opts: base [r,g,b] 0..255, accent [r,g,b], accentChance, seed, wear (0..1), size
 */
export function hullMaps(opts = {}) {
  const size = opts.size || 1024;
  const r = rng(opts.seed || 1);
  const base = opts.base || [200, 202, 205];
  const accent = opts.accent || [210, 110, 30];
  const accentChance = opts.accentChance ?? 0.08;
  const darkChance = opts.darkChance ?? 0.1;
  const wear = opts.wear ?? 0.4;
  const hazardChance = opts.hazardChance ?? 0.03;

  const col = canvas(size), hgt = canvas(size), rough = canvas(size);
  const c = col.getContext('2d'), h = hgt.getContext('2d', { willReadFrequently: true }), ro = rough.getContext('2d');
  c.fillStyle = `rgb(${base})`; c.fillRect(0, 0, size, size);
  h.fillStyle = '#808080'; h.fillRect(0, 0, size, size);
  ro.fillStyle = '#8c8c8c'; ro.fillRect(0, 0, size, size);

  const panels = [];
  const split = (x, y, w, hh, depth) => {
    if (depth > 5 || (depth > 1 && r() < 0.18) || w < size / 28 || hh < size / 28) {
      panels.push([x, y, w, hh]);
      return;
    }
    if (w > hh ? r() < 0.75 : r() < 0.25) {
      const s = Math.round(w * (0.3 + r() * 0.4));
      split(x, y, s, hh, depth + 1); split(x + s, y, w - s, hh, depth + 1);
    } else {
      const s = Math.round(hh * (0.3 + r() * 0.4));
      split(x, y, w, s, depth + 1); split(x, y + s, w, hh - s, depth + 1);
    }
  };
  split(0, 0, size, size, 0);

  const seam = Math.max(2, size / 400);
  for (const [x, y, w, hh] of panels) {
    const v = (r() - 0.5) * 22;
    let pc = base.map((b) => Math.max(0, Math.min(255, b + v)));
    const roll = r();
    if (roll < accentChance) pc = accent.map((a) => a + (r() - 0.5) * 12);
    else if (roll < accentChance + darkChance) pc = base.map((b) => b * 0.35);
    c.fillStyle = `rgb(${pc.map(Math.round)})`;
    c.fillRect(x + seam, y + seam, w - seam * 2, hh - seam * 2);
    const hv = 128 + (r() - 0.5) * 40;
    h.fillStyle = `rgb(${hv},${hv},${hv})`;
    h.fillRect(x + seam, y + seam, w - seam * 2, hh - seam * 2);
    const rv = 110 + r() * 80;
    ro.fillStyle = `rgb(${rv},${rv},${rv})`;
    ro.fillRect(x + seam, y + seam, w - seam * 2, hh - seam * 2);

    // bevel highlight on panel edges in height map
    h.strokeStyle = 'rgba(255,255,255,0.25)';
    h.lineWidth = seam;
    h.strokeRect(x + seam * 2, y + seam * 2, w - seam * 4, hh - seam * 4);

    // rivets
    if (r() < 0.35) {
      const step = size / 64;
      h.fillStyle = '#c8c8c8'; c.fillStyle = 'rgba(40,40,40,0.35)';
      for (let px = x + step; px < x + w - step / 2; px += step) {
        for (const py of [y + seam * 4, y + hh - seam * 4]) {
          h.beginPath(); h.arc(px, py, seam * 0.9, 0, 7); h.fill();
          c.beginPath(); c.arc(px, py, seam * 0.6, 0, 7); c.fill();
        }
      }
    }
    // vents / grilles
    if (r() < 0.08 && w > size / 12 && hh > size / 16) {
      const gx = x + w * 0.2, gy = y + hh * 0.25, gw = w * 0.6, gh = hh * 0.5;
      c.fillStyle = 'rgb(28,29,31)'; c.fillRect(gx, gy, gw, gh);
      h.fillStyle = '#303030'; h.fillRect(gx, gy, gw, gh);
      h.fillStyle = '#b0b0b0';
      c.fillStyle = 'rgb(70,72,75)';
      for (let gyy = gy + seam * 2; gyy < gy + gh; gyy += seam * 4) {
        h.fillRect(gx, gyy, gw, seam * 1.5);
        c.fillRect(gx, gyy, gw, seam);
      }
    }
    // hazard stripes
    if (r() < hazardChance && w > size / 10) {
      const sh = Math.min(hh * 0.3, size / 30);
      c.save();
      c.beginPath(); c.rect(x + seam, y + seam, w - seam * 2, sh); c.clip();
      c.fillStyle = 'rgb(220,170,30)'; c.fillRect(x, y, w, sh + seam);
      c.fillStyle = 'rgb(25,25,25)';
      for (let k = -sh; k < w; k += sh * 1.2) {
        c.beginPath();
        c.moveTo(x + k, y + seam + sh); c.lineTo(x + k + sh * 0.6, y + seam + sh);
        c.lineTo(x + k + sh * 1.2, y + seam); c.lineTo(x + k + sh * 0.6, y + seam);
        c.fill();
      }
      c.restore();
    }
    // stencilled markings
    if (r() < 0.06 && w > size / 8 && hh > size / 20) {
      const fs = Math.min(hh * 0.35, size / 28);
      c.font = `bold ${fs}px monospace`;
      c.fillStyle = r() < 0.5 ? 'rgba(30,30,30,0.75)' : 'rgba(240,240,240,0.7)';
      const labels = opts.labels || ['UNS', 'A-07', 'NO STEP', 'RCS', '0731', 'MK-IV', 'FUEL', 'HP-2'];
      c.fillText(labels[Math.floor(r() * labels.length)], x + seam * 6, y + seam * 6 + fs);
    }
  }

  // seams (grooves)
  c.strokeStyle = 'rgba(15,15,18,0.85)';
  h.strokeStyle = '#202020';
  c.lineWidth = h.lineWidth = seam;
  for (const [x, y, w, hh] of panels) {
    c.strokeRect(x + seam / 2, y + seam / 2, w - seam, hh - seam);
    h.strokeRect(x + seam / 2, y + seam / 2, w - seam, hh - seam);
  }

  // wear: grime, streaks, scratches
  grime(c, size, r, Math.floor(80 * wear), 'rgba(40,34,28,A)', size / 10, 0.35 * wear);
  grime(ro, size, r, Math.floor(60 * wear), 'rgba(230,230,230,A)', size / 10, 0.5 * wear);
  c.save();
  for (let i = 0; i < 300 * wear; i++) {
    const x = r() * size, y = r() * size, len = r() * size / 12;
    c.strokeStyle = `rgba(${r() < 0.5 ? '255,255,255' : '30,30,30'},${0.08 + r() * 0.12})`;
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * len, y + (r() - 0.5) * len); c.stroke();
  }
  // vertical exhaust/rain streaks
  for (let i = 0; i < 40 * wear; i++) {
    const x = r() * size, y = r() * size, len = size / 20 + r() * size / 6;
    const g = c.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, 'rgba(35,30,25,0.18)'); g.addColorStop(1, 'rgba(35,30,25,0)');
    c.fillStyle = g; c.fillRect(x, y, 2 + r() * 4, len);
  }
  c.restore();
  // corrosion: rust blooms that bleed down from seams and pit the surface
  const rust = opts.rust || 0;
  if (rust > 0) {
    grime(c, size, r, Math.floor(70 * rust), 'rgba(122,58,22,A)', size / 9, 0.75 * rust);
    grime(c, size, r, Math.floor(50 * rust), 'rgba(84,40,18,A)', size / 16, 0.9 * rust);
    grime(ro, size, r, Math.floor(60 * rust), 'rgba(250,250,250,A)', size / 10, 0.8 * rust);
    grime(h, size, r, Math.floor(40 * rust), 'rgba(40,40,40,A)', size / 18, 0.5 * rust);
    for (let i = 0; i < 70 * rust; i++) {
      const x = r() * size, y = r() * size, len = size / 24 + r() * size / 7;
      const g = c.createLinearGradient(x, y, x, y + len);
      g.addColorStop(0, `rgba(140,66,24,${0.25 + r() * 0.3})`); g.addColorStop(1, 'rgba(110,50,20,0)');
      c.fillStyle = g; c.fillRect(x, y, 1.5 + r() * 3, len);
    }
  }

  const nrm = normalFromHeight(hgt, opts.normalStrength || 2.2);
  return {
    map: toTexture(col, true),
    normalMap: toTexture(nrm, false),
    roughnessMap: toTexture(rough, false),
  };
}

export function rockMaps(seed = 7, size = 512, tint = [120, 110, 100]) {
  const r = rng(seed);
  const col = canvas(size), hgt = canvas(size);
  const c = col.getContext('2d', { willReadFrequently: true }), h = hgt.getContext('2d', { willReadFrequently: true });
  c.fillStyle = `rgb(${tint})`; c.fillRect(0, 0, size, size);
  h.fillStyle = '#808080'; h.fillRect(0, 0, size, size);
  // layered noise blobs (wrap-around so it tiles)
  for (let pass = 0; pass < 4; pass++) {
    const n = 60 * (pass + 1) * (pass + 1);
    const rad = size / (3 * (pass + 1) * (pass + 1));
    for (let i = 0; i < n; i++) {
      const x = r() * size, y = r() * size, rr = rad * (0.4 + r());
      const v = r();
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
        const g = h.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr);
        const k = v < 0.5 ? '0,0,0' : '255,255,255';
        g.addColorStop(0, `rgba(${k},${0.12})`); g.addColorStop(1, `rgba(${k},0)`);
        h.fillStyle = g; h.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2);
        const gc = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr);
        const t = v < 0.5 ? '40,34,30' : '190,178,160';
        gc.addColorStop(0, `rgba(${t},${0.09})`); gc.addColorStop(1, `rgba(${t},0)`);
        c.fillStyle = gc; c.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2);
      }
    }
  }
  // craters
  for (let i = 0; i < 40; i++) {
    const x = r() * size, y = r() * size, rr = 3 + r() * size / 22;
    const g = h.createRadialGradient(x, y, rr * 0.2, x, y, rr);
    g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.8, 'rgba(0,0,0,0.1)');
    g.addColorStop(0.9, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    h.fillStyle = g; h.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  // cracks
  h.strokeStyle = 'rgba(0,0,0,0.6)'; c.strokeStyle = 'rgba(20,18,16,0.5)';
  for (let i = 0; i < 30; i++) {
    let x = r() * size, y = r() * size;
    h.lineWidth = c.lineWidth = 1 + r() * 1.5;
    h.beginPath(); c.beginPath(); h.moveTo(x, y); c.moveTo(x, y);
    for (let k = 0; k < 12; k++) {
      x += (r() - 0.5) * 24; y += (r() - 0.5) * 24;
      h.lineTo(x, y); c.lineTo(x, y);
    }
    h.stroke(); c.stroke();
  }
  // fine grain
  const img = c.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 18;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  c.putImageData(img, 0, 0);
  const himg = h.getImageData(0, 0, size, size);
  for (let i = 0; i < himg.data.length; i += 4) {
    const n = (r() - 0.5) * 30;
    himg.data[i] += n; himg.data[i + 1] += n; himg.data[i + 2] += n;
  }
  h.putImageData(himg, 0, 0);
  return { map: toTexture(col, true), normalMap: toTexture(normalFromHeight(hgt, 3.5), false) };
}

export function glowTexture(size = 128, falloff = 2.2) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size * 2 - 1, dy = (y + 0.5) / size * 2 - 1;
    const d = Math.min(1, Math.hypot(dx, dy));
    const v = Math.pow(1 - d, falloff);
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = v * 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, true, false);
}

export function smokeTexture(size = 128, seed = 3) {
  const r = rng(seed);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, d = r() * size * 0.22;
    const x = size / 2 + Math.cos(a) * d, y = size / 2 + Math.sin(a) * d;
    const rr = size * (0.12 + r() * 0.2);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  }
  return toTexture(c, true, false);
}

export function ringTexture(size = 256) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.6)');
  g.addColorStop(0.85, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return toTexture(c, true, false);
}

export function hexTexture(size = 128) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.translate(size / 2, size / 2);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * size * 0.45, Math.sin(a) * size * 0.45);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.45);
  g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(0.9, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0.4)');
  ctx.fillStyle = g; ctx.fill();
  return toTexture(c, true, false);
}

// Emissive window strips for stations.
export function windowMaps(seed = 11, size = 512) {
  const r = rng(seed);
  const col = canvas(size), em = canvas(size);
  const c = col.getContext('2d'), e = em.getContext('2d');
  c.fillStyle = 'rgb(150,152,156)'; c.fillRect(0, 0, size, size);
  e.fillStyle = '#000'; e.fillRect(0, 0, size, size);
  const rows = 16, cols = 32;
  for (let y = 0; y < rows; y++) {
    if (r() < 0.35) continue;
    for (let x = 0; x < cols; x++) {
      const px = x * size / cols, py = y * size / rows;
      c.fillStyle = 'rgb(20,22,26)';
      c.fillRect(px + 3, py + 6, size / cols - 6, size / rows - 12);
      if (r() < 0.55) {
        const warm = r() < 0.7;
        e.fillStyle = warm ? `rgb(255,${200 + r() * 40},${130 + r() * 60})` : 'rgb(170,210,255)';
        e.globalAlpha = 0.5 + r() * 0.5;
        e.fillRect(px + 3, py + 6, size / cols - 6, size / rows - 12);
        e.globalAlpha = 1;
      }
    }
  }
  return { map: toTexture(col, true), emissiveMap: toTexture(em, true) };
}

export function solarPanelMaps(size = 256) {
  const col = canvas(size);
  const c = col.getContext('2d');
  c.fillStyle = 'rgb(14,22,48)'; c.fillRect(0, 0, size, size);
  const n = 8;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const g = c.createLinearGradient(x * size / n, y * size / n, (x + 1) * size / n, (y + 1) * size / n);
    g.addColorStop(0, 'rgb(28,44,96)'); g.addColorStop(1, 'rgb(12,20,52)');
    c.fillStyle = g;
    c.fillRect(x * size / n + 2, y * size / n + 2, size / n - 4, size / n - 4);
  }
  c.strokeStyle = 'rgba(180,190,210,0.5)'; c.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    c.beginPath(); c.moveTo(i * size / n, 0); c.lineTo(i * size / n, size); c.stroke();
    c.beginPath(); c.moveTo(0, i * size / n); c.lineTo(size, i * size / n); c.stroke();
  }
  return toTexture(col, true);
}

// Radial engine-throat gradient: white-hot centre, injector rings and vanes, cooler lip.
export function engineCoreTexture(size = 128) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size * 2 - 1, dy = (y + 0.5) / size * 2 - 1;
    const d = Math.min(1, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    let v = 0.22 + 0.78 * Math.pow(1 - d, 1.6);
    v *= 1 - 0.28 * Math.exp(-(((d - 0.42) / 0.035) ** 2)) - 0.22 * Math.exp(-(((d - 0.7) / 0.03) ** 2));
    if (d > 0.5 && d < 0.88) v *= 0.86 + 0.14 * Math.abs(Math.cos(a * 6));
    v *= 1 - 0.5 * Math.max(0, (d - 0.9) / 0.1);
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(Math.min(1, v) * 255);
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, false, false);
}
