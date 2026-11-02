import * as THREE from 'three';
import { PAPER } from './theme.js';

/**
 * A 2D three.js stage with an orthographic camera.
 * World space: the square [-domain, domain]² is always fully visible;
 * extra room appears left/right (wide screens) or top/bottom (tall screens).
 */
export class Stage {
  constructor(container, { domain = 1.12 } = {}) {
    this.container = container;
    this.domain = domain;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(PAPER);
    this.canvas = this.renderer.domElement;
    this.canvas.classList.add('stage-canvas');
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -20, 20);
    this.camera.position.z = 10;

    this.view = { halfW: 1, halfH: 1, w: 1, h: 1, worldPerPx: 0.01 };
    this.frameFns = new Set();
    this.resizeFns = new Set();
    this.time = 0;
    this._last = performance.now();

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    let halfW = this.domain, halfH = this.domain;
    if (aspect >= 1) halfW = halfH * aspect; else halfH = halfW / aspect;
    Object.assign(this.camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    this.camera.updateProjectionMatrix();
    this.view = { halfW, halfH, w, h, worldPerPx: (2 * halfH) / h };
    for (const fn of this.resizeFns) fn(this.view);
  }

  /** Convert a pointer event to world coordinates. */
  toWorld(ev) {
    const r = this.canvas.getBoundingClientRect();
    const nx = (ev.clientX - r.left) / r.width;
    const ny = (ev.clientY - r.top) / r.height;
    return { x: -this.view.halfW + nx * 2 * this.view.halfW, y: this.view.halfH - ny * 2 * this.view.halfH };
  }

  /** Keep a world point inside the visible area (with a small margin). */
  clamp(p, margin = 0.03) {
    const { halfW, halfH } = this.view;
    return {
      x: Math.min(halfW - margin, Math.max(-halfW + margin, p.x)),
      y: Math.min(halfH - margin, Math.max(-halfH + margin, p.y)),
    };
  }

  onFrame(fn) { this.frameFns.add(fn); return () => this.frameFns.delete(fn); }
  onResize(fn) { this.resizeFns.add(fn); fn(this.view); return () => this.resizeFns.delete(fn); }

  _tick() {
    const now = performance.now();
    const dt = Math.min((now - this._last) / 1000, 0.1);
    this._last = now;
    this.time += dt;
    for (const fn of this.frameFns) fn(dt, this.time);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this._ro.disconnect();
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose()); else m?.dispose?.();
    });
    this.renderer.dispose();
    this.canvas.remove();
  }
}
