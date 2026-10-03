import * as THREE from 'three';

const VERT = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vN; varying vec3 vV; varying float vY;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vY = (viewMatrix * modelMatrix * vec4(position, 1.0)).y;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }`;
const FRAG = /* glsl */`
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor; uniform float uTime, uGlitch, uLevel;
  varying vec3 vN; varying vec3 vV; varying float vY;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    #include <logdepthbuf_fragment>
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
    float scan = 0.7 + 0.3 * sin(vY * 140.0 - uTime * 9.0);
    float sweep = smoothstep(0.08, 0.0, abs(fract(vY * 0.35 - uTime * 0.45) - 0.5));
    float a = (0.14 + rim * 1.3) * scan + sweep * 0.3;
    float row = floor(vY * 30.0 + floor(uTime * 24.0) * 7.0);
    a *= 1.0 - uGlitch * step(0.55, hash(row));
    a *= uLevel * (0.92 + 0.08 * sin(uTime * 37.0));
    gl_FragColor = vec4(uColor * a, 1.0);
  }`;

const COLORS = {
  pirate: new THREE.Color(1.0, 0.36, 0.22),
  navy: new THREE.Color(0.35, 1.0, 0.55),
  player: new THREE.Color(0.45, 0.85, 1.0),
  civil: new THREE.Color(0.55, 0.85, 1.0),
};
const TILT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.3);
const _q = new THREE.Quaternion(), _inv = new THREE.Matrix4(), _box = new THREE.Box3(), _c = new THREE.Vector3();

// Renders a rotating hologram of the current target into a HUD element's screen rect.
export class TargetHolo {
  constructor(el) {
    this.el = el;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(30, 2, 0.1, 50);
    this.cam.position.set(0, 0, 3.9);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uGlitch: { value: 0 }, uLevel: { value: 1 } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: true,
    });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.02, 1.06, 64), ringMat);
    this.ring.rotation.x = -Math.PI / 2 + 0.3;
    this.ring.position.y = -1.05;
    this.ring.scale.set(1.15, 1.15, 1);
    this.scene.add(this.ring);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 1.6; gl_FragColor = vec4(0.0, 0.0, 0.0, mix(0.6, 0.2, clamp(d, 0.0, 1.0))); }',
      transparent: true, depthTest: false, depthWrite: false,
    }));
    back.frustumCulled = false;
    back.renderOrder = -1;
    this.scene.add(back);
    this.ent = null;
    this.model = null;
    this.since = 0;
    this.models = new WeakMap();
  }

  build(e) {
    const g = e.ship.group;
    g.updateMatrixWorld(true);
    _inv.copy(g.matrixWorld).invert();
    const inner = new THREE.Group();
    g.traverse((o) => {
      if (!o.isMesh || o === e.shieldMesh || !o.visible || !o.geometry.attributes.normal) return;
      const m0 = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m0.isMeshStandardMaterial) return;
      const m = new THREE.Mesh(o.geometry, this.mat);
      m.matrixAutoUpdate = false;
      m.matrix.multiplyMatrices(_inv, o.matrixWorld);
      inner.add(m);
    });
    inner.updateMatrixWorld(true);
    _box.setFromObject(inner);
    const s = _box.getSize(_c);
    const r = Math.max(1e-3, s.x, s.y, s.z) / 2;
    _box.getCenter(_c);
    inner.position.copy(_c).multiplyScalar(-1);
    const outer = new THREE.Group();
    outer.add(inner);
    outer.scale.setScalar(1 / r);
    return outer;
  }

  set(e) {
    if (this.model) this.pivot.remove(this.model);
    this.ent = e;
    this.model = null;
    this.since = 0;
    if (!e) return;
    if (!this.models.has(e)) this.models.set(e, this.build(e));
    this.model = this.models.get(e);
    this.pivot.add(this.model);
    const col = COLORS[e.faction] || COLORS.civil;
    this.mat.uniforms.uColor.value.copy(col);
    this.ring.material.color.copy(col);
  }

  render(renderer, e, camera, time, dt) {
    if (e !== this.ent) this.set(e && e.alive ? e : null);
    if (!this.model) return;
    const r = this.el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    this.since += dt;
    _q.copy(camera.quaternion).invert().multiply(e.obj.quaternion);
    this.pivot.quaternion.multiplyQuaternions(TILT, _q);
    const u = this.mat.uniforms;
    u.uTime.value = time;
    u.uGlitch.value = Math.max(0, 1 - (time - e.lastHit) * 2.5, 1 - this.since * 3);
    u.uLevel.value = Math.min(1, this.since * 4) * (0.55 + 0.45 * Math.max(0, e.hull / e.maxHull));
    this.cam.aspect = r.width / r.height;
    this.cam.updateProjectionMatrix();
    const H = window.innerHeight, W = window.innerWidth;
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(null);
    renderer.setScissorTest(true);
    renderer.setViewport(r.left, H - r.bottom, r.width, r.height);
    renderer.setScissor(r.left, H - r.bottom, r.width, r.height);
    renderer.clearDepth();
    renderer.render(this.scene, this.cam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
    renderer.autoClear = auto;
  }
}
