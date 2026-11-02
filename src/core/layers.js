import * as THREE from 'three';
import { INK, PAPER, GRID_DOT } from './theme.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/* ------------------------------------------------------------------ */
/* Background: paper + dot grid + optional Voronoi regions             */
/* ------------------------------------------------------------------ */
export class RegionBackground {
  static MAX = 8;
  constructor(stage) {
    this.stage = stage;
    const uC = Array.from({ length: RegionBackground.MAX }, () => new THREE.Vector2(99, 99));
    const uCol = Array.from({ length: RegionBackground.MAX }, () => new THREE.Color(1, 1, 1));
    this.uniforms = {
      uC: { value: uC },
      uCol: { value: uCol },
      uK: { value: 0 },
      uRegion: { value: 0 },
      uBg: { value: new THREE.Color(PAPER) },
      uDot: { value: new THREE.Color(GRID_DOT) },
      uInk: { value: new THREE.Color(INK) },
      uPx: { value: 0.003 },
      uDomain: { value: stage.domain },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xy;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec2 uC[8];
        uniform vec3 uCol[8];
        uniform int uK;
        uniform float uRegion;
        uniform vec3 uBg, uDot, uInk;
        uniform float uPx;
        uniform float uDomain;
        varying vec2 vW;
        void main() {
          vec3 col = uBg;
          // dot grid every 0.1 world units
          vec2 g = abs(fract(vW / 0.1 + 0.5) - 0.5) * 0.1;
          float d = length(g);
          float dotA = 1.0 - smoothstep(uPx * 1.1, uPx * 2.2, d);
          col = mix(col, uDot, dotA * 0.9);
          // axes through the origin
          float ax = min(abs(vW.x), abs(vW.y));
          col = mix(col, uDot, (1.0 - smoothstep(uPx * 0.6, uPx * 1.6, ax)) * 0.55);

          if (uK > 0 && uRegion > 0.001) {
            float b1 = 1e9; float b2 = 1e9; int bi = 0; int bj = 0;
            for (int i = 0; i < 8; i++) {
              if (i >= uK) break;
              float dd = distance(vW, uC[i]);
              if (dd < b1) { b2 = b1; bj = bi; b1 = dd; bi = i; }
              else if (dd < b2) { b2 = dd; bj = i; }
            }
            vec3 rc = uCol[0];
            vec2 ca = uC[0]; vec2 cb = uC[0];
            for (int i = 0; i < 8; i++) {
              if (i == bi) { rc = uCol[i]; ca = uC[i]; }
              if (i == bj) { cb = uC[i]; }
            }
            col = mix(col, rc, 0.17 * uRegion);
            if (uK > 1) {
              // exact distance to the bisector between the two nearest centroids
              float sep = max(distance(ca, cb), 1e-4);
              float edgeDist = (b2 * b2 - b1 * b1) / (2.0 * sep);
              float edge = 1.0 - smoothstep(uPx * 0.8, uPx * 2.2, edgeDist);
              col = mix(col, uInk, edge * 0.45 * uRegion);
            }
          }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat);
    this.mesh.position.z = -5;
    stage.scene.add(this.mesh);
    this._unResize = stage.onResize((v) => { this.uniforms.uPx.value = v.worldPerPx; });
    this.target = 0;
  }

  /** centroids: [{x,y}] in display positions, colors: hex[] */
  setCentroids(centroids, colors) {
    const n = Math.min(centroids.length, RegionBackground.MAX);
    this.uniforms.uK.value = n;
    for (let i = 0; i < n; i++) {
      this.uniforms.uC.value[i].set(centroids[i].x, centroids[i].y);
      this.uniforms.uCol.value[i].setHex(colors[i % colors.length]);
    }
  }

  show(on) { this.target = on ? 1 : 0; }

  update(dt) {
    const u = this.uniforms.uRegion;
    u.value += (this.target - u.value) * (1 - Math.exp(-dt * 6));
  }

  dispose() { this._unResize(); }
}

/* ------------------------------------------------------------------ */
/* Points: instanced circles with an ink outline                      */
/* ------------------------------------------------------------------ */
export class PointLayer {
  constructor(stage, { max = 2000, radius = 0.024 } = {}) {
    this.max = max;
    this.radius = radius;
    const geo = new THREE.CircleGeometry(1, 24);
    this.outline = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: INK }), max);
    this.fill = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), max);
    for (const m of [this.outline, this.fill]) {
      m.frustumCulled = false;
      m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    this.fill.setColorAt(0, new THREE.Color(1, 1, 1));
    this.fill.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.outline.position.z = 0;
    this.fill.position.z = 0.01;
    stage.scene.add(this.outline, this.fill);
  }

  /** points: [{ x, y, s (scale), col (THREE.Color) }] */
  sync(points) {
    const n = Math.min(points.length, this.max);
    const r = this.radius;
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const s = r * (p.s ?? 1);
      _p.set(p.x, p.y, 0);
      _s.set(s, s, 1);
      _m.compose(_p, _q, _s);
      this.outline.setMatrixAt(i, _m);
      _s.set(s * 0.66, s * 0.66, 1);
      _m.compose(_p, _q, _s);
      this.fill.setMatrixAt(i, _m);
      this.fill.setColorAt(i, p.col);
    }
    this.outline.count = this.fill.count = n;
    this.outline.instanceMatrix.needsUpdate = true;
    this.fill.instanceMatrix.needsUpdate = true;
    this.fill.instanceColor.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
/* Centroid stars                                                      */
/* ------------------------------------------------------------------ */
function starShape(points = 5, outer = 1, inner = 0.5) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / points;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

export class StarLayer {
  constructor(stage, { size = 0.075 } = {}) {
    this.stage = stage;
    this.size = size;
    this.group = new THREE.Group();
    this.group.position.z = 2;
    stage.scene.add(this.group);
    this.starGeo = new THREE.ShapeGeometry(starShape(5, 1, 0.52));
    this.outlineGeo = new THREE.ShapeGeometry(starShape(5, 1.32, 0.74));
    this.haloGeo = new THREE.RingGeometry(1.45, 1.75, 48);
    this.items = [];
  }

  setCount(n, colors) {
    while (this.items.length > n) {
      const it = this.items.pop();
      this.group.remove(it.root);
      it.fill.material.dispose();
      it.halo.material.dispose();
      it.outline.material.dispose();
    }
    while (this.items.length < n) {
      const root = new THREE.Group();
      const outline = new THREE.Mesh(this.outlineGeo, new THREE.MeshBasicMaterial({ color: INK }));
      const fill = new THREE.Mesh(this.starGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const halo = new THREE.Mesh(this.haloGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
      fill.position.z = 0.02;
      halo.position.z = -0.02;
      root.add(halo, outline, fill);
      root.scale.setScalar(0.001);
      this.group.add(root);
      this.items.push({ root, fill, outline, halo, scale: 0, phase: Math.random() * 6 });
    }
    this.items.forEach((it, i) => {
      it.fill.material.color.setHex(colors[i % colors.length]);
      it.halo.material.color.setHex(colors[i % colors.length]);
    });
  }

  /** cents: [{ x, y, active? }] display positions */
  update(cents, dt, t) {
    this.items.forEach((it, i) => {
      const c = cents[i];
      if (!c) return;
      const target = c.active ? 1.35 : 1;
      it.scale += (target - it.scale) * (1 - Math.exp(-dt * 10));
      const wobble = 1 + Math.sin(t * 3 + it.phase) * 0.03;
      it.root.scale.setScalar(this.size * it.scale * wobble);
      it.root.position.set(c.x, c.y, i * 0.05);
      it.fill.rotation.z = it.outline.rotation.z = Math.sin(t * 1.2 + it.phase) * 0.18;
      const pulse = (t * 0.9 + it.phase * 0.1) % 1;
      it.halo.scale.setScalar(0.85 + pulse * 0.6);
      it.halo.material.opacity = 0.55 * (1 - pulse);
    });
  }

  dispose() {
    this.setCount(0, []);
    this.starGeo.dispose(); this.outlineGeo.dispose(); this.haloGeo.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Links: a line from each point to something (e.g. its centroid)     */
/* ------------------------------------------------------------------ */
export class LinkLayer {
  constructor(stage, { max = 2000, opacity = 0.35 } = {}) {
    this.max = max;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 6);
    this.col = new Float32Array(max * 6);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity, depthWrite: false });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false;
    this.lines.position.z = -1;
    this.baseOpacity = opacity;
    this.visibility = 1;
    this.target = 1;
    stage.scene.add(this.lines);
  }

  /** pairs: iterate with fn(i) -> [x1,y1,x2,y2,color] or null */
  sync(n, getter) {
    let k = 0;
    for (let i = 0; i < n && k < this.max; i++) {
      const seg = getter(i);
      if (!seg) continue;
      const [x1, y1, x2, y2, c] = seg;
      const o = k * 6;
      this.pos[o] = x1; this.pos[o + 1] = y1; this.pos[o + 2] = 0;
      this.pos[o + 3] = x2; this.pos[o + 4] = y2; this.pos[o + 5] = 0;
      this.col[o] = this.col[o + 3] = c.r;
      this.col[o + 1] = this.col[o + 4] = c.g;
      this.col[o + 2] = this.col[o + 5] = c.b;
      k++;
    }
    const g = this.lines.geometry;
    g.setDrawRange(0, k * 2);
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }

  show(on) { this.target = on ? 1 : 0; }
  update(dt) {
    this.visibility += (this.target - this.visibility) * (1 - Math.exp(-dt * 8));
    this.mat.opacity = this.baseOpacity * this.visibility;
    this.lines.visible = this.visibility > 0.01;
  }
}

/* ------------------------------------------------------------------ */
/* Trails: dashed path + ghost dots of where each centroid has been    */
/* ------------------------------------------------------------------ */
export class TrailLayer {
  constructor(stage, { maxPerTrail = 80, maxTrails = 8 } = {}) {
    this.stage = stage;
    this.group = new THREE.Group();
    this.group.position.z = 1;
    stage.scene.add(this.group);
    this.maxPer = maxPerTrail;
    this.lines = [];
    this.ghosts = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
      maxPerTrail * maxTrails,
    );
    this.ghosts.frustumCulled = false;
    this.ghosts.count = 0;
    this.ghosts.setColorAt(0, new THREE.Color());
    this.ghostOutline = new THREE.InstancedMesh(
      this.ghosts.geometry,
      new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.6 }),
      maxPerTrail * maxTrails,
    );
    this.ghostOutline.frustumCulled = false;
    this.ghostOutline.count = 0;
    this.ghosts.position.z = 0.01;
    this.group.add(this.ghostOutline, this.ghosts);
    this._c = new THREE.Color();
  }

  /** trails: [{ hist: [{x,y}], head: {x,y}, color: hex }] */
  sync(trails) {
    while (this.lines.length < trails.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((this.maxPer + 1) * 3), 3));
      const mat = new THREE.LineDashedMaterial({ color: INK, dashSize: 0.025, gapSize: 0.018, transparent: true, opacity: 0.55 });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      this.group.add(line);
      this.lines.push(line);
    }
    let g = 0;
    this.lines.forEach((line, i) => {
      const t = trails[i];
      if (!t || t.hist.length === 0) { line.visible = false; return; }
      line.visible = true;
      const arr = line.geometry.attributes.position.array;
      const pts = t.hist.slice(-this.maxPer);
      pts.forEach((p, j) => { arr[j * 3] = p.x; arr[j * 3 + 1] = p.y; arr[j * 3 + 2] = 0; });
      arr[pts.length * 3] = t.head.x; arr[pts.length * 3 + 1] = t.head.y; arr[pts.length * 3 + 2] = 0;
      line.geometry.setDrawRange(0, pts.length + 1);
      line.geometry.attributes.position.needsUpdate = true;
      line.geometry.computeBoundingSphere();
      line.computeLineDistances();
      line.material.color.setHex(INK);
      this._c.setHex(t.color);
      for (const p of pts) {
        _p.set(p.x, p.y, 0);
        _s.set(0.016, 0.016, 1); _m.compose(_p, _q, _s); this.ghostOutline.setMatrixAt(g, _m);
        _s.set(0.011, 0.011, 1); _m.compose(_p, _q, _s); this.ghosts.setMatrixAt(g, _m);
        this.ghosts.setColorAt(g, this._c);
        g++;
      }
    });
    this.ghosts.count = this.ghostOutline.count = g;
    this.ghosts.instanceMatrix.needsUpdate = this.ghostOutline.instanceMatrix.needsUpdate = true;
    if (this.ghosts.instanceColor) this.ghosts.instanceColor.needsUpdate = true;
  }

  setVisible(v) { this.group.visible = v; }
}
