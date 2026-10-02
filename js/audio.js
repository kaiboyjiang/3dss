// Procedural WebAudio sound design (no asset files).
export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    // noise buffers
    const len = ctx.sampleRate * 2;
    this.white = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.white.getChannelData(0);
    for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    // engine rumble loop
    const src = ctx.createBufferSource(); src.buffer = this.brown; src.loop = true;
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 200;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    src.connect(this.engFilter); this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
    src.start();
    const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 42;
    const humF = ctx.createBiquadFilter(); humF.type = 'lowpass'; humF.frequency.value = 120;
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0;
    hum.connect(humF); humF.connect(this.humGain); this.humGain.connect(this.master);
    hum.start();
    this.hum = hum;
    // warp loop
    const ws = ctx.createBufferSource(); ws.buffer = this.white; ws.loop = true;
    this.warpF = ctx.createBiquadFilter(); this.warpF.type = 'bandpass'; this.warpF.frequency.value = 300; this.warpF.Q.value = 2;
    this.warpGain = ctx.createGain(); this.warpGain.gain.value = 0;
    ws.connect(this.warpF); this.warpF.connect(this.warpGain); this.warpGain.connect(this.master);
    ws.start();
  }
  get t() { return this.ctx.currentTime; }
  vol(dist) { return dist === undefined ? 1 : Math.max(0, 1 - dist / 6000) ** 2; }
  env(g, a, peak, d) {
    const t = this.t;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  noise(dur, type, freq, q, peak, a = 0.005, sweepTo = null, buf = this.white) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, this.t + dur);
    const g = ctx.createGain();
    s.connect(f); f.connect(g); g.connect(this.master);
    this.env(g, a, peak, dur);
    s.start(this.t, Math.random()); s.stop(this.t + dur + a + 0.05);
  }
  tone(type, f0, f1, dur, peak, a = 0.003) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, this.t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), this.t + dur);
    const g = ctx.createGain();
    o.connect(g); g.connect(this.master);
    this.env(g, a, peak, dur);
    o.start(); o.stop(this.t + dur + a + 0.05);
  }
  laser(dist, enemy) {
    if (!this.ctx) return;
    const v = this.vol(dist) * (enemy ? 0.5 : 0.3);
    if (v < 0.01) return;
    const base = enemy ? 900 : 1500;
    this.tone('sawtooth', base * (0.95 + Math.random() * 0.1), 120, 0.16, v * 0.35);
    this.tone('square', base * 2, 300, 0.08, v * 0.12);
    this.noise(0.08, 'highpass', 3000, 0.7, v * 0.15);
  }
  rail(dist) {
    if (!this.ctx) return;
    const v = this.vol(dist);
    this.tone('sine', 90, 30, 0.6, v * 0.9);
    this.noise(0.5, 'lowpass', 4000, 0.5, v * 0.6, 0.002, 200);
    this.tone('sawtooth', 3000, 400, 0.25, v * 0.18);
  }
  railCharge() {
    if (!this.ctx) return;
    this.tone('sine', 300, 1800, 0.35, 0.05, 0.3);
  }
  missile(dist) {
    if (!this.ctx) return;
    const v = this.vol(dist);
    this.noise(1.1, 'bandpass', 600, 1.2, v * 0.45, 0.02, 2400);
    this.tone('triangle', 200, 60, 0.4, v * 0.2);
  }
  explosion(dist, size = 1) {
    if (!this.ctx) return;
    const v = this.vol(dist === undefined ? 0 : dist * 0.5) * Math.min(1.5, 0.6 + size * 0.2);
    if (v < 0.01) return;
    this.noise(1.6 + size * 0.4, 'lowpass', 2500, 0.7, v * 0.9, 0.003, 60, this.brown);
    this.noise(0.4, 'lowpass', 6000, 0.5, v * 0.4, 0.002, 300);
    this.tone('sine', 70, 22, 1.4, v * 0.9);
  }
  shieldHit() {
    if (!this.ctx) return;
    this.tone('sine', 1200, 600, 0.18, 0.12);
    this.noise(0.15, 'bandpass', 2500, 4, 0.12);
  }
  hullHit() {
    if (!this.ctx) return;
    this.noise(0.25, 'bandpass', 900, 3, 0.4);
    this.tone('square', 180, 60, 0.15, 0.12);
  }
  impact(dist) {
    if (!this.ctx) return;
    const v = this.vol(dist) * 0.35;
    if (v > 0.01) this.noise(0.2, 'bandpass', 1500, 1.5, v);
  }
  beep(f = 880, d = 0.07, v = 0.12) { if (this.ctx) this.tone('sine', f, f, d, v); }
  locked() { if (!this.ctx) return; this.beep(1320, 0.08); setTimeout(() => this.beep(1760, 0.12), 90); }
  ui() { this.beep(660, 0.04, 0.06); }
  alarm() { if (!this.ctx) return; this.tone('square', 700, 500, 0.3, 0.08); }
  warpStart() {
    if (!this.ctx) return;
    this.tone('sawtooth', 60, 600, 3.0, 0.15, 0.6);
    this.noise(3.0, 'bandpass', 200, 2, 0.35, 0.8, 2500);
  }
  warpEnd() {
    if (!this.ctx) return;
    this.noise(1.2, 'lowpass', 3000, 0.7, 0.5, 0.01, 80, this.brown);
    this.tone('sine', 400, 50, 1.0, 0.3);
  }
  update(throttle, boost, warp) {
    if (!this.ctx) return;
    const t = this.t;
    this.engGain.gain.setTargetAtTime(0.08 + throttle * 0.35 + boost * 0.3, t, 0.15);
    this.engFilter.frequency.setTargetAtTime(150 + throttle * 450 + boost * 900, t, 0.2);
    this.humGain.gain.setTargetAtTime(0.03 + throttle * 0.05, t, 0.2);
    this.hum.frequency.setTargetAtTime(38 + throttle * 20 + boost * 25, t, 0.3);
    this.warpGain.gain.setTargetAtTime(warp * 0.25, t, 0.3);
    this.warpF.frequency.setTargetAtTime(200 + warp * 1800, t, 0.3);
  }
}
