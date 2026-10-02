import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();

export function fmtDist(m) {
  if (m < 10000) return `${Math.round(m).toLocaleString()} m`;
  if (m < 1e7) return `${(m / 1000).toFixed(m < 1e5 ? 1 : 0)} km`;
  return `${(m / 1.496e11).toFixed(2)} AU`;
}

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), brackets: $('brackets'), stick: $('stick'), prograde: $('prograde'), lead: $('lead'), off: $('offarrow'),
      log: $('log'), notice: $('notice'), warning: $('warning'), target: $('target'), tname: $('tname'), tsub: $('tsub'),
      tsh: $('tsh'), tar: $('tar'), thu: $('thu'), tlock: $('tlock'), ov: $('ovbody'), selname: $('selname'),
      speed: $('speed'), flags: $('flags'), gauge: $('gauge'), loc: $('locname'), credits: $('credits'), kills: $('kills'),
      warpfx: $('warpfx'), warpdest: $('warpdest'), cursorhint: $('cursorhint'),
      railammo: $('railammo'), misammo: $('misammo'),
    };
    this.g = this.el.gauge.getContext('2d');
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
  }
  log(msg, cls = 'i') {
    const d = document.createElement('div');
    d.className = cls;
    const t = new Date();
    d.textContent = `[${t.toTimeString().slice(0, 8)}] ${msg}`;
    this.el.log.appendChild(d);
    while (this.el.log.children.length > 8) this.el.log.firstChild.remove();
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
      items.push({ ref: e, pos: e.obj.position, cls: e.faction === 'pirate' ? 'hostile' : 'neutral', label: e.name, size: e.ship.radius });
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
        b.hpi.style.background = e.shield > 0 ? '#4ab3ff' : e.armor > 0 ? '#e9c46a' : '#e85d4a';
      } else b.hp.style.display = 'none';
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].d.style.display = 'none';

    // ---- stick / prograde / lead / off-screen arrow
    this.el.stick.style.left = `${w / 2 + G.stick.x * Math.min(w, h) * 0.22}px`;
    this.el.stick.style.top = `${h / 2 + G.stick.y * Math.min(w, h) * 0.22}px`;
    this.el.stick.style.display = G.pointerLocked && !G.freeLook ? '' : 'none';
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
    if (tp && tp.alive) {
      this.el.target.classList.remove('hidden');
      this.el.tname.textContent = tp.name;
      this.el.tname.style.color = tp.faction === 'pirate' ? '#ff7a66' : '#fff';
      const d = tp.obj.position.distanceTo(player.obj.position);
      this.el.tsub.textContent = `${tp.className} · ${fmtDist(d)} · ${Math.round(tp.vel.length())} m/s`;
      this.el.tsh.style.width = `${(tp.shield / tp.maxShield) * 100}%`;
      this.el.tar.style.width = `${(tp.armor / tp.maxArmor) * 100}%`;
      this.el.thu.style.width = `${(tp.hull / tp.maxHull) * 100}%`;
      this.el.tlock.textContent = tgt === tp ? (G.lock.progress >= 1 ? 'TARGET LOCKED' : `LOCKING ${Math.round(G.lock.progress * 100)}%`) : 'SELECTED — press T to lock';
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
    cd('m-laser', 0, G.input.fire1, player.cap < 6);
    cd('m-rail', G.cool.rail / 1.6, G.input.fire2, G.ammo.rail <= 0);
    cd('m-missile', G.cool.missile / 4, false, G.ammo.missile <= 0 || !(G.lock && G.lock.progress >= 1));
    cd('m-ab', 0, G.boosting, player.cap < 10);
    cd('m-warp', G.warp ? 1 : 0, !!G.warp, G.scrambled);
    this.el.cursorhint.style.display = !G.pointerLocked && G.state === 'flying' ? '' : 'none';
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
  overview(G) {
    const pp = G.player.obj.position;
    const rows = [];
    for (const e of G.entities) {
      if (!e.alive || e === G.player) continue;
      const d = e.obj.position.distanceTo(pp);
      if (d > 150000) continue;
      if (this.tab === 'nav') continue;
      if (this.tab === 'hostile' && e.faction !== 'pirate') continue;
      rows.push({ ref: e, cls: e.faction === 'pirate' ? 'hostile' : 'neutral', ico: e.faction === 'pirate' ? '▼' : '▽', name: e.name, type: e.className, d });
    }
    if (this.tab !== 'hostile') {
      G.locations.forEach((l, i) => rows.push({ ref: l, cls: 'loc', ico: ['◆', '◌', '☠', '◎', '●', '○'][i] || '◇', name: `${i + 1}. ${l.name}`, type: l.type, d: l.pos.distanceTo(pp) }));
    }
    rows.sort((a, b) => a.d - b.d);
    const body = this.el.ov;
    while (body.children.length < rows.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="ico"></td><td></td><td></td><td class="d"></td>';
      tr.addEventListener('mousedown', (ev) => { ev.stopPropagation(); if (tr._ref && this.onSelect) this.onSelect(tr._ref); });
      body.appendChild(tr);
    }
    while (body.children.length > rows.length) body.lastChild.remove();
    rows.forEach((r, i) => {
      const tr = body.children[i];
      tr._ref = r.ref;
      tr.className = `${r.cls}${G.selected === r.ref ? ' sel' : ''}`;
      const c = tr.children;
      c[0].textContent = r.ico; c[1].textContent = r.name; c[2].textContent = r.type; c[3].textContent = fmtDist(r.d);
    });
    const s = G.selected;
    this.el.selname.textContent = s ? `${s.name} — ${fmtDist(s.pos ? s.pos.distanceTo(pp) : s.obj.position.distanceTo(pp))}` : 'No selection';
  }
  gauge(G) {
    const g = this.g, p = G.player;
    const W = 300, H = 170, cx = W / 2, cy = 150;
    g.clearRect(0, 0, W, H);
    const arc = (r, f, col, wdt) => {
      const a0 = Math.PI * 1.08, a1 = Math.PI * 1.92;
      g.lineWidth = wdt; g.lineCap = 'butt';
      g.strokeStyle = 'rgba(255,255,255,0.08)';
      g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
      g.strokeStyle = col;
      g.beginPath(); g.arc(cx, cy, r, a0, a0 + (a1 - a0) * Math.max(0, Math.min(1, f))); g.stroke();
    };
    arc(128, p.shield / p.maxShield, '#4ab3ff', 7);
    arc(118, p.armor / p.maxArmor, '#e9c46a', 7);
    arc(108, p.hull / p.maxHull, '#e85d4a', 7);
    // capacitor: segmented ring
    const segs = 24, capF = p.cap / p.maxCap;
    for (let i = 0; i < segs; i++) {
      const a0 = Math.PI * 1.12 + (i / segs) * Math.PI * 0.76;
      g.strokeStyle = i / segs < capF ? 'rgba(255,210,110,0.9)' : 'rgba(255,255,255,0.08)';
      g.lineWidth = 9;
      g.beginPath(); g.arc(cx, cy, 92, a0, a0 + Math.PI * 0.76 / segs * 0.7); g.stroke();
    }
    // throttle bar
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(cx - 50, cy - 58 + 20, 100, 3);
    g.fillStyle = G.boosting ? '#ffb040' : '#7cf'; g.fillRect(cx - 50, cy - 38, 100 * Math.min(1, p.throttle), 3);
    g.font = '10px sans-serif'; g.fillStyle = '#8ab'; g.textAlign = 'center';
    g.fillText(`S ${Math.round(p.shield)} · A ${Math.round(p.armor)} · H ${Math.round(p.hull)}`, cx, cy - 64);
    g.fillText(`CAP ${Math.round(p.cap)} GJ`, cx, cy - 44);
  }
}
