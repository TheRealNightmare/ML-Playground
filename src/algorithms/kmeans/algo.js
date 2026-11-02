// Pure K-Means logic. Points are { x, y, c } where c is the cluster index (-1 = none).

export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
/** Distance used for assignment: 'euclidean' (default) or 'manhattan'. */
export const metricDist = (metric) => (metric === 'manhattan' ? manhattan : (a, b) => Math.sqrt(dist2(a, b)));

/** Nearest centroid. Ties go to the lower index (as on the slides: "tie → C1"). */
export function nearest(p, cents, metric = 'euclidean') {
  const d = metricDist(metric);
  let bi = -1, bd = Infinity;
  for (let k = 0; k < cents.length; k++) {
    const v = d(p, cents[k]);
    if (v < bd - 1e-9) { bd = v; bi = k; }
  }
  return [bi, metric === 'manhattan' ? bd : bd * bd];
}

/** Assignment step: every point joins its nearest centroid. Returns how many changed. */
export function assign(points, cents, metric = 'euclidean') {
  let changed = 0;
  for (const p of points) {
    const [k] = nearest(p, cents, metric);
    if (p.c !== k) { p.c = k; changed++; }
  }
  return changed;
}

/** Update step: each centroid moves to the mean of its points. Returns the new positions. */
export function update(points, cents) {
  const K = cents.length;
  const sx = new Float64Array(K), sy = new Float64Array(K), n = new Uint32Array(K);
  for (const p of points) {
    if (p.c < 0 || p.c >= K) continue;
    sx[p.c] += p.x; sy[p.c] += p.y; n[p.c]++;
  }
  const next = [];
  const empty = [];
  let maxShift = 0;
  for (let k = 0; k < K; k++) {
    if (n[k] === 0) { next.push({ x: cents[k].x, y: cents[k].y }); empty.push(k); continue; }
    const q = { x: sx[k] / n[k], y: sy[k] / n[k] };
    maxShift = Math.max(maxShift, Math.sqrt(dist2(q, cents[k])));
    next.push(q);
  }
  return { next, empty, maxShift, sizes: Array.from(n) };
}

/** Inertia / WCSS: sum of squared distances from each point to its own centroid. */
export function inertia(points, cents) {
  let J = 0;
  for (const p of points) if (p.c >= 0 && p.c < cents.length) J += dist2(p, cents[p.c]);
  return J;
}

export function clusterSizes(points, K) {
  const n = new Array(K).fill(0);
  for (const p of points) if (p.c >= 0 && p.c < K) n[p.c]++;
  return n;
}

/* ---------------- Initialization methods ---------------- */

/** Forgy: pick K distinct data points at random. */
export function initRandomPoints(points, K, rand = Math.random) {
  const idx = points.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const out = idx.slice(0, K).map((i) => ({ x: points[i].x, y: points[i].y }));
  while (out.length < K) out.push(randomSpot(rand));
  return out;
}

/** K-Means++: spread the starting centroids out. */
export function initPlusPlus(points, K, rand = Math.random) {
  if (!points.length) return Array.from({ length: K }, () => randomSpot(rand));
  const out = [];
  const first = points[Math.floor(rand() * points.length)];
  out.push({ x: first.x, y: first.y });
  const D = points.map((p) => dist2(p, first));
  while (out.length < K) {
    const total = D.reduce((a, b) => a + b, 0);
    if (total <= 1e-12) { out.push(randomSpot(rand)); continue; }
    let r = rand() * total;
    let pick = 0;
    for (let i = 0; i < D.length; i++) { r -= D[i]; if (r <= 0) { pick = i; break; } }
    const c = { x: points[pick].x, y: points[pick].y };
    out.push(c);
    for (let i = 0; i < points.length; i++) D[i] = Math.min(D[i], dist2(points[i], c));
  }
  return out;
}

/** "Modified k-means" from the lecture: start with the two farthest points, then keep adding the point farthest from all chosen ones. */
export function initFarthest(points, K, metric = 'euclidean', rand = Math.random) {
  const d = metricDist(metric);
  if (points.length < 2) return initRandomSpots(K, rand);
  let bi = 0, bj = 1, bd = -1;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const v = d(points[i], points[j]);
    if (v > bd + 1e-9) { bd = v; bi = i; bj = j; }
  }
  const chosen = [bi, bj].slice(0, K);
  while (chosen.length < K && chosen.length < points.length) {
    let best = -1, bv = -1;
    points.forEach((p, i) => {
      if (chosen.includes(i)) return;
      const m = Math.min(...chosen.map((c) => d(p, points[c])));
      if (m > bv) { bv = m; best = i; }
    });
    chosen.push(best);
  }
  const out = chosen.map((i) => ({ x: points[i].x, y: points[i].y }));
  while (out.length < K) out.push(randomSpot(rand));
  return out;
}

/** Totally random positions anywhere on the canvas. */
export function initRandomSpots(K, rand = Math.random) {
  return Array.from({ length: K }, () => randomSpot(rand));
}

function randomSpot(rand) {
  return { x: (rand() * 2 - 1) * 0.95, y: (rand() * 2 - 1) * 0.95 };
}

/* ---------------- Full runs (for the elbow chart) ---------------- */

export function runKMeans(xy, K, { maxIter = 100, init = 'pp' } = {}) {
  const pts = xy.map((p) => ({ x: p.x, y: p.y, c: -1 }));
  let cents = init === 'pp' ? initPlusPlus(pts, K) : initRandomPoints(pts, K);
  for (let it = 0; it < maxIter; it++) {
    const changed = assign(pts, cents);
    if (changed === 0 && it > 0) break;
    cents = update(pts, cents).next;
  }
  return { cents, inertia: inertia(pts, cents) };
}

export function elbow(xy, Kmax = 8, restarts = 4) {
  const out = [];
  for (let K = 1; K <= Kmax; K++) {
    let best = Infinity;
    for (let r = 0; r < restarts; r++) best = Math.min(best, runKMeans(xy, K).inertia);
    out.push(best);
  }
  return out;
}
