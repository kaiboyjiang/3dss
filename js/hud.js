import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();

export function fmtDist(m) {
  if (m < 10000) return `${Math.round(m).toLocaleString()} m`;
  if (m < 1e7) return `${(m / 1000).toFixed(m < 1e5 ? 1 : 0)} km`;
  return `${(m / 1.496e11).toFixed(2)} AU`;
}

const COLORS = { hostile: '255,90,72', neutral: '207,214,218', friendly: '127,224,160' };
function factionCls(e) { return e.faction === 'pirate' ? 'hostile' : e.faction === 'navy' ? 'friendly' : 'neutral'; }

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), brackets: $('brackets'), hudc: $('hudc'), prograde: $('prograde'), lead: $('lead'), off: $('offarrow'),
      log: $('log'), notice: $('notice'), warning: $('warning'), target: $('target'), tname: $('tname'), tsub: $('tsub'),
      tsh: $('tsh'), tar: $('tar'), thu: $('thu'), tlock: $('tlock'), ov: $('ovbody'), selname: $('selname'),
      speed: $('speed'), flags: $('flags'), gauge: $('gauge'), loc: $('locname'), credits: $('credits'), kills: $('kills'),
      warpfx: $('warpfx'), warpdest: $('warpdest'),
      railammo: $('railammo'), misammo: $('misammo'),
    };
    this.g = this.el.gauge.getContext('2d');
    this.o = this.el.hudc.getContext('2d');
    this.pool = [];
    this.noticeT = 0;
    this.ovT = 0;
    this.tab = 'all';
    this.rows = [];
    this.onSelect = null;
    document.querySelectorAll('#overview .tabs b').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('#overview .tabs b').forEach((x) => x.classList.remove('on'));
      b.classList.add('on'); this.tab = b.dataset.tab; this.ovT = 0;
    }));
    document.querySelector('#overview .otitle').addEventListener('click', () => this.toggleOverview());
  }
  log(msg, cls = 'i') {
    const d = document.createElement('div');
    d.className = cls;
    const t = new Date();
    d.textContent = `[${t.toTimeString().slice(0, 8)}] ${msg}`;
    this.el.log.appendChild(d);
    while (this.el.log.children.length > 8) this.el.log.firstChild.remove();
  }
  toggleOverview() {
    const o = $('overview');
    o.classList.toggle('collapsed');
    o.querySelector('.otitle').textContent = o.classList.contains('collapsed') ? 'OVERVIEW ▸' : 'OVERVIEW ▾';
  }
  notice(msg, dur = 2.5) { this.el.notice.textContent = msg; this.el.notice.style.opacity = 1; this.noticeT = dur; }
  bracket(i) {
    while (this.pool.length <= i) {
      const d = document.createElement('div');
      d.className = 'br';
      d.innerHTML = '<div class="box"></div><div class="lockring"></div><div class="hpbar"><i></i></div><div class="lbl"></div>';
      this.el.brackets.appendChild(d);
      this.pool.push({ d, box: d.children[0], ring: d.children[1], hp: d.children[2], hpi: d.children[2].firstChild, lbl: d.children[3], key: '' });
    }
    return this.pool[i];
  }
  update(dt, G) {
    const { camera, player } = G;
    const w = window.innerWidth, h = window.innerHeight;
    const camDir = camera.getWorldDirection(new THREE.Vector3());
    const isBehind = (p) => _v.copy(p).sub(camera.position).dot(camDir) <= 0;
    const proj = (p) => { _v.copy(p).project(camera); return [(_v.x * 0.5 + 0.5) * w, (-_v.y * 0.5 + 0.5) * h]; };
    if (this.noticeT > 0) { this.noticeT -= dt; if (this.noticeT <= 0) this.el.notice.style.opacity = 0; }

    // ---- brackets
    let n = 0;
    const items = [];
    for (const e of G.entities) {
      if (!e.alive || e === player) continue;
      items.push({ ref: e, pos: e.obj.position, cls: factionCls(e), label: e.name, size: e.ship.radius });
    }
    for (const l of G.locations) items.push({ ref: l, pos: l.pos, cls: 'loc', label: l.name, size: 0, loc: true });
    for (const it of items) {
      const d = it.pos.distanceTo(camera.position);
      const isSel = G.selected === it.ref, isLock = G.lock && G.lock.ent === it.ref;
      if (isBehind(it.pos)) continue;
      if (!it.loc && d > 60000 && !isSel && !isLock) continue;
      const [x, y] = proj(it.pos);
      if (x < -50 || y < -50 || x > w + 50 || y > h + 50) continue;
      const b = this.bracket(n++);
      b.d.style.display = '';
      b.d.className = `br ${it.cls}${isSel ? ' sel' : ''}`;
      b.d.style.left = `${x}px`; b.d.style.top = `${y}px`;
      const px = it.loc ? 12 : Math.max(18, Math.min(260, (it.size * 2.2 / d) * h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))));
      b.box.style.width = b.box.style.height = `${px}px`;
      const lbl = `${it.label}  ${fmtDist(Math.max(0, it.pos.distanceTo(player.obj.position) - (it.loc ? 0 : it.size)))}`;
      if (b.key !== lbl) { b.lbl.textContent = lbl; b.key = lbl; }
      b.lbl.style.marginLeft = `${px / 2 + 4}px`;
      b.lbl.style.marginTop = `${-px / 2 - 2}px`;
      if (isLock) {
        b.ring.style.display = '';
        const rs = px + 14 + (1 - G.lock.progress) * 40;
        b.ring.style.width = b.ring.style.height = `${rs}px`;
        b.ring.classList.toggle('done', G.lock.progress >= 1);
      } else b.ring.style.display = 'none';
      if (!it.loc && (isSel || isLock || d < 8000)) {
        const e = it.ref;
        b.hp.style.display = '';
        b.hp.style.width = `${px}px`;
        b.hp.style.top = `${px / 2 + 4}px`;
        const tot = e.shield + e.armor + e.hull, max = e.maxShield + e.maxArmor + e.maxHull;
        b.hpi.style.width = `${(tot / max) * 100}%`;
        b.hpi.style.background = e.shield > 0 ? '#7896ae' : e.armor > 0 ? '#9a9fa5' : '#a86a67';
      } else b.hp.style.display = 'none';
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].d.style.display = 'none';

    // ---- reticle compass, pointer and prograde / lead / off-screen arrow
    this.overlay(G, w, h, proj, isBehind);
    const sp = player.vel.length();
    if (sp > 5) {
      const pp = _v.copy(player.obj.position).addScaledVector(player.vel, 1000 / sp);
      if (!isBehind(pp)) {
        const [x, y] = proj(pp);
        this.el.prograde.style.display = ''; this.el.prograde.style.left = `${x}px`; this.el.prograde.style.top = `${y}px`;
      } else this.el.prograde.style.display = 'none';
    } else this.el.prograde.style.display = 'none';
    if (G.leadPoint && !isBehind(G.leadPoint)) {
      const [x, y] = proj(G.leadPoint);
      this.el.lead.style.display = ''; this.el.lead.style.left = `${x}px`; this.el.lead.style.top = `${y}px`;
    } else this.el.lead.style.display = 'none';
    const tgt = G.lock ? G.lock.ent : null;
    if (tgt) {
      const rel = _v.copy(tgt.obj.position).applyMatrix4(camera.matrixWorldInverse);
      const ndcVisible = (() => { if (rel.z > 0) return false; const [x, y] = proj(tgt.obj.position); return x > 0 && y > 0 && x < w && y < h; })();
      if (!ndcVisible) {
        const ang = Math.atan2(-rel.y, rel.x);
        const r = Math.min(w, h) * 0.3;
        this.el.off.style.display = '';
        this.el.off.style.transform = `translate(${Math.cos(ang) * r}px, ${Math.sin(ang) * r}px) rotate(${ang + Math.PI / 2}rad)`;
      } else this.el.off.style.display = 'none';
    } else this.el.off.style.display = 'none';

    // ---- target panel
    const tp = tgt || (G.selected && G.selected.ship ? G.selected : null);
    this.shown = tp && tp.alive ? tp : null;
    if (tp && tp.alive) {
      this.el.target.classList.remove('hidden');
      this.el.tname.textContent = tp.name;
      this.el.tname.style.color = tp.faction === 'pirate' ? '#ff7a66' : '#fff';
      const d = tp.obj.position.distanceTo(player.obj.position);
      this.el.tsub.textContent = `${tp.className} · ${fmtDist(d)} · ${Math.round(tp.vel.length())} m/s`;
      this.el.tsh.style.width = `${(tp.shield / tp.maxShield) * 100}%`;
      this.el.tar.style.width = `${(tp.armor / tp.maxArmor) * 100}%`;
      this.el.thu.style.width = `${(tp.hull / tp.maxHull) * 100}%`;
      this.el.tlock.textContent = tgt === tp ? (G.lock.progress >= 1 ? 'TARGET LOCKED' : `LOCKING ${Math.round(G.lock.progress * 100)}%`) : 'SELECTED — hold R-Ctrl or press T to lock';
    } else this.el.target.classList.add('hidden');

    // ---- overview (throttled)
    this.ovT -= dt;
    if (this.ovT <= 0) { this.ovT = 0.25; this.overview(G); }

    // ---- status gauge
    this.gauge(G);
    this.el.speed.textContent = `${G.warp ? Math.round(G.warp.speed / 1000).toLocaleString() + ' km/s' : Math.round(sp) + ' m/s'}`;
    const flags = [];
    flags.push(`THR ${Math.round(player.throttle * 100)}%`);
    flags.push(G.flightAssist ? 'FA ON' : '<b>FA OFF</b>');
    if (G.boosting) flags.push('<b>AB</b>');
    if (G.scrambled) flags.push('<b>SCRAMBLED</b>');
    flags.push(['CHASE', 'COCKPIT', 'TACTICAL'][G.camMode]);
    this.el.flags.innerHTML = flags.join(' · ');
    this.el.loc.textContent = G.nearestName;
    this.el.credits.textContent = Math.round(G.credits).toLocaleString();
    this.el.kills.textContent = G.kills;
    this.el.railammo.textContent = `(${G.ammo.rail})`;
    this.el.misammo.textContent = `(${G.ammo.missile})`;
    const cd = (id, f, active, off) => {
      const m = document.getElementById(id);
      m.firstChild.style.height = `${Math.max(0, Math.min(1, f)) * 100}%`;
      m.classList.toggle('active', !!active); m.classList.toggle('off', !!off);
    };
    this.el.railammo.style.display = G.usesAmmo ? '' : 'none';
    cd('m-laser', G.cool.pri, G.input.fire1, G.priOff);
    cd('m-rail', G.cool.sec, G.input.fire2, G.secOff);
    cd('m-turret', G.cool.tur, G.turFiring, !G.turretsAuto || !G.hasTurrets);
    document.getElementById('turstate').textContent = !G.hasTurrets ? '' : G.turretsAuto ? 'AUTO' : 'HOLD';
    cd('m-missile', G.cool.missile / 4, false, G.ammo.missile <= 0 || !(G.lock && G.lock.progress >= 1));
    cd('m-ab', 0, G.boosting, player.cap < 10);
    cd('m-warp', G.warp ? 1 : 0, !!G.warp, G.scrambled);
    // warnings
    const warn = [];
    if (G.scrambled) warn.push('WARP DRIVE DISRUPTED');
    if (player.hull < player.maxHull * 0.35) warn.push('HULL CRITICAL');
    else if (player.shield <= 0) warn.push('SHIELDS DOWN');
    if (player.cap < player.maxCap * 0.15) warn.push('CAPACITOR LOW');
    this.el.warning.textContent = warn.join('   ·   ');
    // warp overlay
    this.el.warpfx.classList.toggle('hidden', !G.warp);
    if (G.warp) this.el.warpdest.textContent = `${G.warp.phase === 'align' ? 'Aligning to' : 'Warping to'} ${G.warp.dest.name} — ${fmtDist(G.warp.remaining)}`;
  }
  overlay(G, w, h, proj, isBehind) {
    const c = this.el.hudc, g = this.o;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    g.clearRect(0, 0, w, h);
    const cam = G.camera, pp = G.player.obj.position;
    const cx = w / 2, cy = h / 2, R0 = 24, R = 68;
    // compass ring around the reticle: centre = dead ahead, outer edge = directly behind
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(204,207,211,0.22)';
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    g.setLineDash([2, 4]);
    g.strokeStyle = 'rgba(204,207,211,0.14)';
    g.beginPath(); g.arc(cx, cy, (R0 + R) / 2, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, l = i % 2 ? 3 : 6;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * (R + l), cy + Math.sin(a) * (R + l)); g.stroke();
    }
    const inv = cam.matrixWorldInverse;
    const tgt = G.lock ? G.lock.ent : (G.selected && G.selected.ship && G.selected.alive ? G.selected : null);
    const dirOf = (p) => {
      const rel = _v.copy(p).applyMatrix4(inv);
      const len = rel.length() || 1;
      const th = Math.acos(Math.max(-1, Math.min(1, -rel.z / len)));
      const ph = Math.atan2(-rel.y, rel.x);
      return { th, ph, r: R0 + (R - R0) * (th / Math.PI) };
    };
    let tdir = null;
    for (const e of G.entities) {
      if (!e.alive || e === G.player) continue;
      const d = e.obj.position.distanceTo(pp);
      if (d > 60000 && e !== tgt) continue;
      const D = dirOf(e.obj.position);
      if (e === tgt) { tdir = D; continue; }
      const col = COLORS[factionCls(e)];
      const x = cx + Math.cos(D.ph) * D.r, y = cy + Math.sin(D.ph) * D.r;
      const a = d < 15000 ? 0.95 : 0.5;
      g.beginPath();
      g.arc(x, y, e.ship.radius > 30 ? 3.2 : 2.4, 0, Math.PI * 2);
      if (D.th > Math.PI / 2) { g.strokeStyle = `rgba(${col},${a})`; g.stroke(); } else { g.fillStyle = `rgba(${col},${a})`; g.fill(); }
    }
    if (tdir && tgt) {
      const locked = G.lock && G.lock.ent === tgt && G.lock.progress >= 1;
      const col = locked ? '#ff4a30' : G.lock && G.lock.ent === tgt ? '#ffb040' : '#f6f6f7';
      const x = cx + Math.cos(tdir.ph) * tdir.r, y = cy + Math.sin(tdir.ph) * tdir.r;
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.5;
      g.strokeRect(x - 4.5, y - 4.5, 9, 9);
      if (tdir.th > 0.03) {
        const ax = cx + Math.cos(tdir.ph) * (R + 12), ay = cy + Math.sin(tdir.ph) * (R + 12);
        g.save(); g.translate(ax, ay); g.rotate(tdir.ph);
        g.beginPath(); g.moveTo(9, 0); g.lineTo(-3, -7); g.lineTo(-1, 0); g.lineTo(-3, 7); g.closePath(); g.fill();
        g.restore();
        g.font = '11px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(fmtDist(tgt.obj.position.distanceTo(pp)), cx + Math.cos(tdir.ph) * (R + 30), cy + Math.sin(tdir.ph) * (R + 30));
      }
      g.lineWidth = 1;
    }
    // pointer and follow vector
    const m = G.mouse;
    if (G.state === 'flying') {
      if (G.aimActive && !isBehind(G.aimPoint)) {
        const [ax, ay] = proj(G.aimPoint);
        g.strokeStyle = 'rgba(255,200,110,0.5)'; g.setLineDash([4, 5]);
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(ax, ay); g.stroke(); g.setLineDash([]);
        g.strokeStyle = 'rgba(255,200,110,0.95)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(ax, ay - 8); g.lineTo(ax + 8, ay); g.lineTo(ax, ay + 8); g.lineTo(ax - 8, ay); g.closePath(); g.stroke();
        g.lineWidth = 1;
      }
      if (G.gunAssist) {
        g.strokeStyle = 'rgba(255,90,72,0.85)';
        g.beginPath(); g.arc(cx, cy, 13, 0, Math.PI * 2); g.stroke();
      }
      if (!G.mouseLocked) {
        g.strokeStyle = 'rgba(220,222,225,0.8)';
        g.beginPath(); g.arc(m.x, m.y, 7, 0, Math.PI * 2); g.stroke();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.moveTo(m.x + dx * 10, m.y + dy * 10); g.lineTo(m.x + dx * 15, m.y + dy * 15); g.stroke(); }
      }
      if (G.ctrlTargeting) {
        const tx = G.mouseLocked ? cx : m.x, ty = G.mouseLocked ? cy : m.y;
        g.strokeStyle = 'rgba(255,176,64,0.6)'; g.setLineDash([6, 6]);
        g.beginPath(); g.arc(tx, ty, G.ctrlRadius, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
        const hv = G.ctrlHover;
        if (hv && hv.alive && !isBehind(hv.obj.position)) {
          const [hx, hy] = proj(hv.obj.position);
          g.strokeStyle = 'rgba(255,176,64,0.9)';
          g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
        }
        g.fillStyle = '#ffb040'; g.font = '10px monospace'; g.textAlign = 'left';
        g.fillText('TARGETING', tx + 18, ty - 12);
      }
    }
  }
  overview(G) {
    const pp = G.player.obj.position;
    const rows = [];
    for (const e of G.entities) {
      if (!e.alive || e === G.player) continue;
      const d = e.obj.position.distanceTo(pp);
      if (d > 150000) continue;
      if (this.tab === 'nav') continue;
      if (this.tab === 'hostile' && e.faction !== 'pirate') continue;
      rows.push({ ref: e, cls: factionCls(e), ico: e.faction === 'pirate' ? '▼' : e.faction === 'navy' ? '△' : '▽', name: e.name, type: e.className, d });
    }
    if (this.tab !== 'hostile') {
      G.locations.forEach((l, i) => rows.push({ ref: l, cls: 'loc', ico: ['◆', '◌', '☠', '◎', '●', '○', '✦'][i] || '◇', name: `${i + 1}. ${l.name}`, type: l.type, d: l.pos.distanceTo(pp) }));
    }
    rows.sort((a, b) => a.d - b.d);
    const body = this.el.ov;
    while (body.children.length < rows.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="ico"></td><td></td><td class="d"></td>';
      tr.addEventListener('mousedown', (ev) => { ev.stopPropagation(); if (tr._ref && this.onSelect) this.onSelect(tr._ref); });
      body.appendChild(tr);
    }
    while (body.children.length > rows.length) body.lastChild.remove();
    rows.forEach((r, i) => {
      const tr = body.children[i];
      tr._ref = r.ref;
      tr.className = `${r.cls}${G.selected === r.ref ? ' sel' : ''}`;
      const c = tr.children;
      c[0].textContent = r.ico; c[1].textContent = r.name; c[2].textContent = fmtDist(r.d); tr.title = r.type;
    });
    const s = G.selected;
    this.el.selname.textContent = s ? `${s.name} · ${s.type || s.className || ''} — ${fmtDist(s.pos ? s.pos.distanceTo(pp) : s.obj.position.distanceTo(pp))}` : 'No selection';
  }
  gauge(G) {
    const g = this.g, p = G.player;
    const W = 300, H = 170, top = 18, bh = 78, bw = 10;
    g.clearRect(0, 0, W, H);
    const cols = [
      ['SHD', p.shield / p.maxShield, [96, 128, 152], Math.round(p.shield)],
      ['ARM', p.armor / p.maxArmor, [124, 129, 135], Math.round(p.armor)],
      ['HUL', p.hull / p.maxHull, [140, 88, 86], Math.round(p.hull)],
      ['CAP', p.cap / p.maxCap, [150, 156, 162], Math.round(p.cap)],
      ['THR', Math.min(1, p.throttle), G.boosting ? [156, 124, 82] : [104, 109, 116], Math.round(p.throttle * 100) + '%'],
    ];
    const shade = (c, k) => `rgb(${c.map((v) => Math.round(Math.min(255, v * k))).join(',')})`;
    const metal = (x, c) => {
      const gr = g.createLinearGradient(x, 0, x + bw, 0);
      gr.addColorStop(0, shade(c, 0.5)); gr.addColorStop(0.3, shade(c, 1.35));
      gr.addColorStop(0.55, shade(c, 0.95)); gr.addColorStop(1, shade(c, 0.45));
      return gr;
    };
    const track = metal(0, [34, 36, 39]);
    const gap = 44, x0 = W / 2 - ((cols.length - 1) * gap) / 2;
    g.font = '10px sans-serif'; g.textAlign = 'center';
    cols.forEach(([lb, f, col, v], i) => {
      const x = x0 + i * gap - bw / 2, fr = Math.max(0, Math.min(1, f));
      g.save(); g.translate(x, 0); g.fillStyle = track; g.fillRect(0, top, bw, bh); g.restore();
      g.strokeStyle = 'rgba(190,196,204,0.18)'; g.lineWidth = 1; g.strokeRect(x - 0.5, top - 0.5, bw + 1, bh + 1);
      g.fillStyle = metal(x, col);
      if (lb === 'CAP') {
        const segs = 16, sh = bh / segs;
        for (let k = 0; k < segs; k++) if (k / segs < fr) g.fillRect(x, top + bh - (k + 1) * sh + 1, bw, sh - 2);
      } else {
        const h = bh * fr; g.fillRect(x, top + bh - h, bw, h);
        if (h > 1) { g.fillStyle = shade(col, 1.6); g.fillRect(x, top + bh - h, bw, 1); }
      }
      g.shadowColor = '#000'; g.shadowBlur = 4;
      g.fillStyle = '#8a9098'; g.fillText(String(v), x + bw / 2, top - 6);
      g.fillStyle = '#737981'; g.fillText(lb, x + bw / 2, top + bh + 12);
      g.shadowBlur = 0;
    });

  }
}
