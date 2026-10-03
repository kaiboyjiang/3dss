import { SYSTEMS, GOVS, systemDef, route } from './systems.js';

const $ = (id) => document.getElementById(id);
const GOV_RGB = { gov: '102,204,255', pirate: '255,90,72' };
const defs = {};
const defOf = (id) => defs[id] || (defs[id] = systemDef(id));

// 2D jump-lane graph of charted systems (Endless Sky style)
export class StarMap {
  constructor(G) {
    this.G = G;
    this.el = $('map'); this.cv = $('mapc'); this.info = $('mapinfo');
    this.g = this.cv.getContext('2d');
    this.isOpen = false; this.sel = null; this.zoom = 1.5; this.pan = [0, 0];
    this.onRoute = null;
    let down = null;
    this.cv.addEventListener('mousedown', (ev) => { down = { x: ev.clientX, y: ev.clientY, moved: 0 }; });
    window.addEventListener('mousemove', (ev) => {
      if (!down || !this.isOpen) return;
      down.moved += Math.abs(ev.movementX) + Math.abs(ev.movementY);
      this.pan[0] -= ev.movementX / this.zoom; this.pan[1] -= ev.movementY / this.zoom;
    });
    window.addEventListener('mouseup', (ev) => {
      if (down && this.isOpen && down.moved < 6) { const id = this.pick(ev.clientX, ev.clientY); if (id) this.select(id); }
      down = null;
    });
    this.cv.addEventListener('wheel', (ev) => { ev.preventDefault(); this.zoom = Math.min(4, Math.max(0.6, this.zoom * Math.exp(-ev.deltaY * 0.0012))); }, { passive: false });
    $('mapclose').addEventListener('click', () => this.toggle(false));
  }
  toggle(on = !this.isOpen) {
    this.isOpen = on;
    this.el.classList.toggle('hidden', !on);
    if (on) { this.pan = [0, 0]; this.sel = this.G.routeTo || this.G.system; this.renderInfo(); }
  }
  // charted systems, plus lane stubs leading out to uncharted neighbours
  graph() {
    const ex = this.G.explored;
    const nodes = [...ex].map((id) => SYSTEMS[id]);
    const edges = [], stubs = [];
    for (const s of nodes) {
      for (const n of s.links) {
        const t = SYSTEMS[n];
        if (ex.has(n)) { if (s.id < n) edges.push([s, t]); }
        else stubs.push({ from: s, id: n, end: [s.map[0] + (t.map[0] - s.map[0]) * 0.42, s.map[1] + (t.map[1] - s.map[1]) * 0.42] });
      }
    }
    return { nodes, edges, stubs };
  }
  xf() {
    const c = SYSTEMS[this.G.system].map, w = this.cv.clientWidth, h = this.cv.clientHeight;
    const cx = c[0] + this.pan[0], cy = c[1] + this.pan[1], z = this.zoom;
    return (m) => [w / 2 + (m[0] - cx) * z, h / 2 + (m[1] - cy) * z];
  }
  pick(x, y) {
    const { nodes, stubs } = this.graph(), S = this.xf();
    let best = null, bd = 18;
    for (const n of nodes) { const [px, py] = S(n.map); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = n.id; } }
    for (const s of stubs) { const [px, py] = S(s.end); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = s.id; } }
    return best;
  }
  select(id) {
    const G = this.G;
    this.sel = id;
    G.routeTo = id !== G.system && route(G.system, id, G.explored) ? id : null;
    this.renderInfo();
    if (this.onRoute) this.onRoute();
  }
  renderInfo() {
    const G = this.G, id = this.sel || G.system, S = SYSTEMS[id];
    const path = id === G.system ? [id] : route(G.system, id, G.explored);
    const name = (x) => (G.explored.has(x) ? SYSTEMS[x].name : 'Uncharted');
    const routeTxt = id === G.system ? '<p class="here">You are here</p>'
      : path ? `<p class="route">Route: ${path.map(name).join(' → ')} <b>(${path.length - 1} jump${path.length > 2 ? 's' : ''})</b></p><p class="hint">Press H to warp to the highlighted jump gate and jump.</p>`
        : '<p class="hint">No charted route.</p>';
    if (!G.explored.has(id)) {
      this.info.innerHTML = `<h2>Uncharted System</h2><p class="dim">No survey data. Jump in to chart it.</p>${routeTxt}`;
      return;
    }
    const D = defOf(id), gv = GOVS[S.gov];
    const sec = S.sec.toFixed(1);
    this.info.innerHTML = `<h2>${S.name}</h2>
      <p style="color:${gv.color}">${gv.name}</p>
      <p>Security <b class="sec" style="color:${S.sec >= 0.5 ? '#6f6' : S.sec > 0 ? '#f0a020' : '#f44'}">${sec}</b></p>
      <p>Star: ${D.starInfo.name}</p>
      <h3>Bodies</h3>${D.planets.map((p) => `<p>${p.name} <span class="dim">${p.moon ? 'Moon' : p.label}${p.ring ? ', ringed' : ''}</span></p>`).join('')}
      <h3>Facilities</h3>${D.stations.length ? D.stations.map((s) => `<p>${s.name}${s.dock === 'high' ? ' <span class="yard">Shipyard</span>' : ''}</p>`).join('') : '<p class="dim">None (lawless space)</p>'}
      ${D.outposts.map((o) => `<p class="pir">${o.name}</p>`).join('')}
      ${routeTxt}`;
  }
  draw(t) {
    const cv = this.cv, dpr = Math.min(window.devicePixelRatio, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = this.g, G = this.G;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const S = this.xf();
    const { nodes, edges, stubs } = this.graph();
    // faint grid
    g.strokeStyle = 'rgba(143,149,157,0.06)'; g.lineWidth = 1;
    const step = 50 * this.zoom, [ox, oy] = S([0, 0]);
    for (let x = ((ox % step) + step) % step; x < w; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = ((oy % step) + step) % step; y < h; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const line = (a, b) => { const [x1, y1] = S(a), [x2, y2] = S(b); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    g.lineWidth = 2; g.strokeStyle = 'rgba(180,184,190,0.45)';
    for (const [a, b] of edges) line(a.map, b.map);
    g.setLineDash([5, 5]); g.strokeStyle = 'rgba(180,184,190,0.3)';
    for (const s of stubs) line(s.from.map, s.end);
    g.setLineDash([]);
    for (const s of stubs) {
      const [x, y] = S(s.end);
      g.strokeStyle = s.id === this.sel ? '#ffb040' : 'rgba(180,184,190,0.5)'; g.lineWidth = 1.5;
      g.strokeRect(x - 6, y - 6, 12, 12);
      g.fillStyle = 'rgba(180,184,190,0.7)'; g.font = '10px "Mono Digits", "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.fillText('?', x, y + 3.5);
    }
    // plotted route
    const path = G.routeTo && route(G.system, G.routeTo, G.explored);
    if (path) {
      g.strokeStyle = 'rgba(255,176,64,0.9)'; g.lineWidth = 3.5;
      for (let i = 1; i < path.length; i++) {
        const a = SYSTEMS[path[i - 1]].map, b = SYSTEMS[path[i]];
        line(a, G.explored.has(b.id) ? b.map : [a[0] + (b.map[0] - a[0]) * 0.42, a[1] + (b.map[1] - a[1]) * 0.42]);
      }
    }
    for (const n of nodes) {
      const [x, y] = S(n.map), D = defOf(n.id), c = D.starInfo.color;
      const glow = g.createRadialGradient(x, y, 0, x, y, 16);
      glow.addColorStop(0, `rgba(${c.map((v) => Math.round(v * 255)).join(',')},0.55)`); glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
      g.fillRect(x - 5, y - 5, 10, 10);
      g.strokeStyle = `rgb(${GOV_RGB[n.gov]})`; g.lineWidth = 2;
      g.strokeRect(x - 9, y - 9, 18, 18);
      if (n.id === G.system) {
        g.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 4)})`; g.lineWidth = 1.5;
        g.strokeRect(x - 13, y - 13, 26, 26);
      }
      if (n.id === this.sel) { g.strokeStyle = '#ffb040'; g.lineWidth = 2; g.strokeRect(x - 17, y - 17, 34, 34); }
      g.textAlign = 'center';
      g.fillStyle = '#fff'; g.font = '13px "Mono Digits", "Chakra Petch", sans-serif'; g.fillText(n.name, x, y + 30);
      g.fillStyle = `rgb(${GOV_RGB[n.gov]})`; g.font = '9px "Mono Digits", "Chakra Petch", sans-serif'; g.fillText(`${GOVS[n.gov].short} · ${n.sec.toFixed(1)}`, x, y + 42);
      if (n.id === G.system) { g.fillStyle = '#dbdddf'; g.fillText('YOU ARE HERE', x, y - 22); }
    }
  }
}
