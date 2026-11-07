import * as THREE from 'three';

/**
 * A full-view texture painted on the CPU: shows what a model predicts at every spot.
 * paint(fn) calls fn(wx, wy) for every texel (world coords) and expects [r, g, b, a] in 0..1.
 * Repaints are throttled and also happen automatically when the view is resized.
 */
export class DecisionField {
  constructor(stage, { res = 200, z = -4 } = {}) {
    this.stage = stage;
    this.res = res;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    );
    this.mesh.position.z = z;
    this.mesh.visible = false;
    stage.scene.add(this.mesh);
    this.fn = null;
    this.dirty = false;
    this._unResize = stage.onResize(() => this._layout());
    this._unFrame = stage.onFrame(() => { if (this.dirty) this._paint(); });
  }

  _layout() {
    const v = this.stage.view;
    this.mesh.scale.set(2 * v.halfW, 2 * v.halfH, 1);
    const w = this.res, h = Math.max(8, Math.round((this.res * v.halfH) / v.halfW));
    if (!this.tex || this.tex.image.width !== w || this.tex.image.height !== h) {
      this.tex?.dispose();
      this.data = new Uint8Array(w * h * 4);
      this.tex = new THREE.DataTexture(this.data, w, h, THREE.RGBAFormat);
      this.tex.colorSpace = THREE.SRGBColorSpace;
      this.tex.magFilter = THREE.LinearFilter;
      this.tex.minFilter = THREE.LinearFilter;
      this.mesh.material.map = this.tex;
      this.mesh.material.needsUpdate = true;
    }
    this.dirty = !!this.fn;
  }

  /** Set the painter. Pass null to hide the field. */
  paint(fn) {
    this.fn = fn;
    this.mesh.visible = !!fn;
    if (!this.tex) this._layout();
    this.dirty = !!fn;
  }

  _paint() {
    this.dirty = false;
    if (!this.fn || !this.tex) return;
    const v = this.stage.view;
    const W = this.tex.image.width, H = this.tex.image.height;
    const d = this.data;
    for (let j = 0; j < H; j++) {
      const wy = -v.halfH + ((j + 0.5) / H) * 2 * v.halfH;
      for (let i = 0; i < W; i++) {
        const wx = -v.halfW + ((i + 0.5) / W) * 2 * v.halfW;
        const c = this.fn(wx, wy);
        const o = (j * W + i) * 4;
        d[o] = c[0] * 255; d[o + 1] = c[1] * 255; d[o + 2] = c[2] * 255; d[o + 3] = c[3] * 255;
      }
    }
    this.tex.needsUpdate = true;
  }

  dispose() { this._unResize(); this._unFrame(); this.tex?.dispose(); }
}
