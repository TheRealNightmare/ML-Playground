// Agglomerative (bottom-up) hierarchical clustering — pure functions, no three.js.

export const METRICS = {
  euclidean: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  manhattan: (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
};

const mean = (pts) => {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
};

/**
 * Run the full merge sequence.
 *   points  – [{x, y}] (needed for 'centroid' linkage and for drawing)
 *   matrix  – optional n×n distance matrix (used instead of points for distances)
 *   linkage – 'single' | 'complete' | 'average' | 'centroid'
 *   metric  – 'euclidean' | 'manhattan'
 *   record  – keep a snapshot of the distance table before every merge (small n only)
 *
 * Leaves are ids 0..n-1; the k-th merge creates id n+k.
 * Each merge: { a, b, id, height, size, members, centroid, centroidA, centroidB, pair, table?, rows? }
 */
export function agglomerate({ points, matrix = null, linkage = 'single', metric = 'euclidean', record = false }) {
  const n = matrix ? matrix.length : points.length;
  const dist = METRICS[metric];
  const pd = matrix ? (i, j) => matrix[i][j] : (i, j) => dist(points[i], points[j]);

  // slot s holds cluster info; D is a full slot×slot matrix
  const D = Array.from({ length: n }, (_, i) => new Float64Array(n));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) D[i][j] = D[j][i] = pd(i, j);
  const slots = Array.from({ length: n }, (_, i) => ({
    id: i,
    members: [i],
    centroid: points ? { x: points[i].x, y: points[i].y } : null,
    active: true,
  }));

  const merges = [];
  for (let step = 0; step < n - 1; step++) {
    // find the closest active pair (first one wins ties, in slot order)
    let bi = -1, bj = -1, bd = Infinity;
    for (let i = 0; i < n; i++) {
      if (!slots[i].active) continue;
      for (let j = i + 1; j < n; j++) {
        if (!slots[j].active) continue;
        if (D[i][j] < bd - 1e-12) { bd = D[i][j]; bi = i; bj = j; }
      }
    }
    let table = null;
    if (record) {
      const act = slots.map((s, i) => (s.active ? i : -1)).filter((i) => i >= 0);
      table = { ids: act.map((i) => slots[i].id), members: act.map((i) => slots[i].members.slice()), D: act.map((i) => act.map((j) => D[i][j])), pick: [act.indexOf(bi), act.indexOf(bj)] };
    }
    const A = slots[bi], B = slots[bj];

    // closest pair of points between the two clusters (draws a nice MST for single link)
    let pair = [A.members[0], B.members[0]], pdMin = Infinity;
    for (const i of A.members) for (const j of B.members) {
      const d = pd(i, j);
      if (d < pdMin) { pdMin = d; pair = [i, j]; }
    }

    const members = A.members.concat(B.members);
    const centroid = points ? mean(members.map((i) => points[i])) : null;
    const merge = {
      a: A.id, b: B.id, id: n + step, height: bd, size: members.length, members,
      centroid, centroidA: A.centroid, centroidB: B.centroid, pair, table,
      sizeA: A.members.length, sizeB: B.members.length,
    };

    // new row of distances (Lance–Williams style, or recompute for centroid linkage)
    const rows = [];
    const na = A.members.length, nb = B.members.length;
    for (let k = 0; k < n; k++) {
      if (!slots[k].active || k === bi || k === bj) continue;
      const da = D[bi][k], db = D[bj][k];
      let d;
      if (linkage === 'single') d = Math.min(da, db);
      else if (linkage === 'complete') d = Math.max(da, db);
      else if (linkage === 'average') d = (na * da + nb * db) / (na + nb);
      else d = dist(centroid, slots[k].centroid); // centroid linkage
      rows.push({ id: slots[k].id, d, da, db });
      D[bi][k] = D[k][bi] = d;
    }
    merge.rows = rows;
    merges.push(merge);

    A.id = n + step;
    A.members = members;
    A.centroid = centroid;
    B.active = false;
  }
  return { n, merges };
}

/** Cluster labels after applying the first m merges (union of leaves). Returns array of root ids per leaf. */
export function labelsAfter(n, merges, m) {
  const parent = new Map();
  const find = (x) => { while (parent.has(x)) x = parent.get(x); return x; };
  for (let k = 0; k < m; k++) {
    const mg = merges[k];
    parent.set(mg.a, mg.id);
    parent.set(mg.b, mg.id);
  }
  return Array.from({ length: n }, (_, i) => find(i));
}

/** Leaf order for drawing a dendrogram without crossings. */
export function leafOrder(n, merges) {
  if (!merges.length) return Array.from({ length: n }, (_, i) => i);
  const kids = new Map(merges.map((m) => [m.id, [m.a, m.b]]));
  const out = [];
  const stack = [merges[merges.length - 1].id];
  while (stack.length) {
    const id = stack.pop();
    if (id < n) { out.push(id); continue; }
    const [a, b] = kids.get(id);
    stack.push(b, a);
  }
  return out;
}

/** Classical MDS to 2D — used only to *draw* a distance-matrix example on the canvas. */
export function mds2(M) {
  const n = M.length;
  const D2 = M.map((r) => r.map((d) => d * d));
  const rowMean = D2.map((r) => r.reduce((a, b) => a + b, 0) / n);
  const all = rowMean.reduce((a, b) => a + b, 0) / n;
  const B = D2.map((r, i) => r.map((d, j) => -0.5 * (d - rowMean[i] - rowMean[j] + all)));
  const eig = [];
  let Bk = B.map((r) => r.slice());
  for (let e = 0; e < 2; e++) {
    let v = Array.from({ length: n }, (_, i) => Math.sin(i + 1 + e));
    let lambda = 0;
    for (let it = 0; it < 300; it++) {
      const w = Bk.map((r) => r.reduce((s, x, j) => s + x * v[j], 0));
      const norm = Math.hypot(...w) || 1;
      lambda = norm;
      v = w.map((x) => x / norm);
    }
    eig.push({ lambda, v });
    Bk = Bk.map((r, i) => r.map((x, j) => x - lambda * v[i] * v[j]));
  }
  return Array.from({ length: n }, (_, i) => ({
    x: eig[0].v[i] * Math.sqrt(Math.max(eig[0].lambda, 0)),
    y: eig[1].v[i] * Math.sqrt(Math.max(eig[1].lambda, 0)),
  }));
}
