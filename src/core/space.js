// Maps "data units" (the numbers students see in the slides) to three.js world units.
// The map is a uniform scale + shift, so distances stay proportional:
//   world = (data - c) / s      data = world * s + c
// In free-play mode the map is the identity (data units = world units).

export class Space {
  constructor() { this.setIdentity(); }

  setIdentity() {
    this.s = 1; this.sx = 1; this.sy = 1; this.cx = 0; this.cy = 0;
    this.identity = true;
    return this;
  }

  /** Fit the given data points inside the box [-box, box]² (uniform scale). */
  fit(points, { box = 0.8, minSpan = 1, uniform = true, boxY = box, pad = null } = {}) {
    if (!points.length) return this.setIdentity();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of points) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    if (pad) { x0 -= pad.x ?? 0; x1 += pad.x ?? 0; y0 -= pad.y ?? 0; y1 += pad.y ?? 0; }
    if (uniform) {
      const span = Math.max(x1 - x0, y1 - y0, minSpan);
      this.s = this.sx = this.sy = span / (2 * box);
    } else {
      this.sx = Math.max(x1 - x0, minSpan) / (2 * box);
      this.sy = Math.max(y1 - y0, minSpan) / (2 * boxY);
      this.s = this.sx;
    }
    this.cx = (x0 + x1) / 2;
    this.cy = (y0 + y1) / 2;
    this.identity = false;
    return this;
  }

  /** data → world */
  w(p) { return { x: (p.x - this.cx) / this.sx, y: (p.y - this.cy) / this.sy }; }
  /** world → data */
  d(w) { return { x: w.x * this.sx + this.cx, y: w.y * this.sy + this.cy }; }
  /** a length in data units → world units */
  wl(len) { return len / this.s; }
  /** a length in world units → data units */
  dl(len) { return len * this.s; }
}
