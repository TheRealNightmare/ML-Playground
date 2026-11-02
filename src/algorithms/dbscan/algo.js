// DBSCAN, one point visit per step — pure, no three.js.
// minPts counts the point itself (as on the lecture slides).

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function neighborhoods(points, eps) {
  const n = points.length;
  const N = Array.from({ length: n }, () => []);
  const e2 = eps * eps;
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const dx = points[i].x - points[j].x, dy = points[i].y - points[j].y;
      if (dx * dx + dy * dy <= e2 + 1e-12) { N[i].push(j); if (i !== j) N[j].push(i); }
    }
  }
  for (const list of N) list.sort((a, b) => a - b);
  return N;
}

/**
 * Step-by-step DBSCAN.
 * labels: -2 = not yet visited, -1 = noise, k ≥ 0 = cluster k
 */
export class Runner {
  constructor(points, eps, minPts) {
    this.points = points;
    this.eps = eps;
    this.minPts = minPts;
    this.N = neighborhoods(points, eps);
    const n = points.length;
    this.labels = new Array(n).fill(-2);
    this.visited = new Array(n).fill(false);
    this.core = this.N.map((l) => l.length >= minPts);
    this.queue = [];
    this.queued = new Set();
    this.next = 0;
    this.cluster = -1;
    this.done = n === 0;
    this.visits = 0;
    this.last = null;
  }

  /** Visit one point. Returns an event describing what happened. */
  step() {
    if (this.done) return null;
    let i, fromQueue = false;
    if (this.queue.length) { i = this.queue.shift(); fromQueue = true; }
    else {
      while (this.next < this.points.length && this.visited[this.next]) this.next++;
      if (this.next >= this.points.length) { this.done = true; this.last = null; return null; }
      i = this.next;
    }
    this.visited[i] = true;
    this.visits++;
    const nbrs = this.N[i];
    const isCore = this.core[i];
    const ev = { i, nbrs, isCore, fromQueue, added: [], rescued: [], cluster: null, kind: '' };

    if (!fromQueue) {
      if (isCore) {
        this.cluster++;
        this.labels[i] = this.cluster;
        ev.kind = 'new';
        ev.cluster = this.cluster;
        this._grab(i, ev);
      } else {
        // may still become a border point later
        this.labels[i] = -1;
        ev.kind = 'noise?';
      }
    } else {
      ev.cluster = this.labels[i];
      if (isCore) { ev.kind = 'expand'; this._grab(i, ev); }
      else ev.kind = 'border';
    }

    // finished?
    if (!this.queue.length) {
      let k = this.next;
      while (k < this.points.length && this.visited[k]) k++;
      if (k >= this.points.length) this.done = true;
    }
    this.last = ev;
    return ev;
  }

  _grab(i, ev) {
    const c = this.labels[i];
    for (const q of this.N[i]) {
      if (q === i) continue;
      if (this.labels[q] === -1) { this.labels[q] = c; ev.rescued.push(q); } // noise → border
      if (this.labels[q] === -2) { this.labels[q] = c; ev.added.push(q); }
      if (!this.visited[q] && !this.queued.has(q)) { this.queue.push(q); this.queued.add(q); }
    }
  }

  runAll() { while (!this.done) this.step(); return this; }

  kind(i) {
    if (this.labels[i] === -2) return 'unvisited';
    if (this.labels[i] === -1) return 'noise';
    return this.core[i] ? 'core' : 'border';
  }
}

/** Distance from each point to its k-th nearest *other* point, sorted ascending. */
export function kDistances(points, k) {
  const n = points.length;
  if (n <= k) return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = [];
    for (let j = 0; j < n; j++) if (j !== i) d.push(dist(points[i], points[j]));
    d.sort((a, b) => a - b);
    out.push(d[k - 1]);
  }
  return out.sort((a, b) => a - b);
}
