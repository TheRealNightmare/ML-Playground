// Maps "data units" (the numbers students see in the slides) to three.js world units.
// The map is a uniform scale + shift, so distances stay proportional:
//   world = (data - c) / s      data = world * s + c
// In free-play mode the map is the identity (data units = world units).

export class Space {
  constructor() { this.setIdentity(); }

  setIdentity() {
    this.s = 1; this.cx = 0; this.cy = 0;
    this.identity = true;
    return this;
  }

  /** Fit the given data points inside the box [-box, box]² (uniform scale). */
  fit(points, { box = 0.8, minSpan = 1 } = {}) {
    if (!points.length) return this.setIdentity();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of points) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const span = Math.max(x1 - x0, y1 - y0, minSpan);
    this.s = span / (2 * box);
    this.cx = (x0 + x1) / 2;
    this.cy = (y0 + y1) / 2;
    this.identity = false;
    return this;
  }

  /** data → world */
  w(p) { return { x: (p.x - this.cx) / this.s, y: (p.y - this.cy) / this.s }; }
  /** world → data */
  d(w) { return { x: w.x * this.s + this.cx, y: w.y * this.s + this.cy }; }
  /** a length in data units → world units */
  wl(len) { return len / this.s; }
  /** a length in world units → data units */
  dl(len) { return len * this.s; }
}
