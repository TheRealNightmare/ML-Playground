// HDBSCAN — pure functions, no three.js.
// k = which nearest neighbour defines the core distance (excluding the point itself, as on the slides).

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Core distance = distance to the k-th nearest other point. Also returns the sorted neighbour lists (first k). */
export function coreDistances(points, k) {
  const n = points.length;
  const core = new Float64Array(n);
  const nn = [];
  for (let i = 0; i < n; i++) {
    const d = [];
    for (let j = 0; j < n; j++) if (j !== i) d.push([dist(points[i], points[j]), j]);
    d.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const kk = Math.min(k, d.length);
    core[i] = kk ? d[kk - 1][0] : 0;
    nn.push(d.slice(0, Math.max(kk, 2)));
  }
  return { core, nn };
}

export const mrd = (points, core, i, j) => Math.max(core[i], core[j], dist(points[i], points[j]));

/** Prim's MST on the mutual-reachability graph. Edges come back sorted by weight (ascending). */
export function mst(points, core) {
  const n = points.length;
  if (n < 2) return [];
  const inTree = new Uint8Array(n);
  const best = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const edges = [];
  let cur = 0;
  inTree[0] = 1;
  for (let step = 1; step < n; step++) {
    for (let j = 0; j < n; j++) {
      if (inTree[j]) continue;
      const w = mrd(points, core, cur, j);
      // ties (common with mutual reachability) go to the pair that is really closer
      if (w < best[j] - 1e-9 || (Math.abs(w - best[j]) <= 1e-9 && (from[j] < 0 || dist(points[cur], points[j]) < dist(points[from[j]], points[j])))) { best[j] = w; from[j] = cur; }
    }
    let bj = -1, bw = Infinity;
    for (let j = 0; j < n; j++) if (!inTree[j] && best[j] < bw) { bw = best[j]; bj = j; }
    inTree[bj] = 1;
    edges.push({ a: from[bj], b: bj, w: bw });
    cur = bj;
  }
  return edges.sort((e, f) => e.w - f.w || Math.min(e.a, e.b) - Math.min(f.a, f.b));
}

/** Single-linkage tree from sorted MST edges (union–find). Node ids: leaves 0..n-1, merges n.. */
export function singleLinkage(n, edges) {
  const parent = Array.from({ length: 2 * n }, (_, i) => i);
  const size = new Array(2 * n).fill(1);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const merges = [];
  let next = n;
  for (const e of edges) {
    const ra = find(e.a), rb = find(e.b);
    const id = next++;
    parent[ra] = id; parent[rb] = id;
    size[id] = size[ra] + size[rb];
    merges.push({ id, left: ra, right: rb, dist: e.w, size: size[id] });
  }
  return merges;
}

/**
 * Condense the single-linkage tree with min_cluster_size.
 * Returns rows { parent, child, lambda, size } where cluster labels start at n (root = n).
 */
export function condense(n, merges, mcs) {
  if (!merges.length) return { rows: [], root: n };
  const node = new Map(merges.map((m) => [m.id, m]));
  const sizeOf = (id) => (id < n ? 1 : node.get(id).size);
  const leavesOf = (id) => {
    const out = [], st = [id];
    while (st.length) { const x = st.pop(); if (x < n) out.push(x); else { const m = node.get(x); st.push(m.left, m.right); } }
    return out;
  };
  const rootId = merges[merges.length - 1].id;
  const relabel = new Map([[rootId, n]]);
  let nextLabel = n + 1;
  const rows = [];
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    if (id < n) continue;
    const m = node.get(id);
    const lam = m.dist > 0 ? 1 / m.dist : Number.MAX_VALUE;
    const lc = sizeOf(m.left), rc = sizeOf(m.right);
    const me = relabel.get(id);
    if (lc >= mcs && rc >= mcs) {
      for (const [ch, cs] of [[m.left, lc], [m.right, rc]]) {
        const lab = nextLabel++;
        relabel.set(ch, lab);
        rows.push({ parent: me, child: lab, lambda: lam, size: cs });
        queue.push(ch);
      }
    } else {
      for (const [ch, cs] of [[m.left, lc], [m.right, rc]]) {
        if (cs >= mcs) { relabel.set(ch, me); queue.push(ch); }
        else for (const leaf of leavesOf(ch)) rows.push({ parent: me, child: leaf, lambda: lam, size: 1 });
      }
    }
  }
  return { rows, root: n };
}

/** Stability of each cluster: Σ (λ_leave − λ_birth) × size over its children. */
export function stability({ rows, root }) {
  const birth = new Map([[root, 0]]);
  for (const r of rows) if (r.size > 1 || r.child >= root) if (r.child >= root) birth.set(r.child, r.lambda);
  const stab = new Map();
  for (const c of birth.keys()) stab.set(c, 0);
  for (const r of rows) stab.set(r.parent, (stab.get(r.parent) || 0) + (r.lambda - birth.get(r.parent)) * r.size);
  return { stab, birth };
}

/** Excess-of-mass selection. Returns the set of selected cluster labels. */
export function selectEOM(tree, stab, allowSingle = false) {
  const { rows, root } = tree;
  const children = new Map();
  for (const r of rows) if (r.child >= root) { if (!children.has(r.parent)) children.set(r.parent, []); children.get(r.parent).push(r.child); }
  const S = new Map(stab);
  const nodes = [...stab.keys()].sort((a, b) => b - a);
  const list = allowSingle ? nodes : nodes.filter((c) => c !== root);
  const isCluster = new Map(list.map((c) => [c, true]));
  const descendants = (c) => {
    const out = [], st = [...(children.get(c) || [])];
    while (st.length) { const x = st.pop(); out.push(x); st.push(...(children.get(x) || [])); }
    return out;
  };
  for (const c of list) {
    const kids = children.get(c) || [];
    const sub = kids.reduce((s, k) => s + (S.get(k) || 0), 0);
    if (kids.length && sub > S.get(c)) { isCluster.set(c, false); S.set(c, sub); }
    else for (const d of descendants(c)) isCluster.set(d, false);
  }
  return new Set([...isCluster].filter(([, v]) => v).map(([c]) => c));
}

/** Point labels (-1 = noise) from the selected clusters, following the hdbscan library rules. */
export function labelPoints(n, tree, selected, allowSingle = false) {
  const { rows, root } = tree;
  const parent = new Map();
  for (const r of rows) if (!selected.has(r.child)) parent.set(r.child, r.parent);
  const find = (x) => { while (parent.has(x)) x = parent.get(x); return x; };
  const order = [...selected].sort((a, b) => a - b);
  const map = new Map(order.map((c, i) => [c, i]));
  const pointLambda = new Map();
  for (const r of rows) if (r.child < root) pointLambda.set(r.child, r.lambda);
  const rootMax = Math.max(0, ...rows.filter((r) => r.parent === root).map((r) => r.lambda));
  const labels = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const c = find(i);
    if (c === root) {
      if (selected.size === 1 && allowSingle && selected.has(root) && (pointLambda.get(i) ?? 0) >= rootMax - 1e-12) labels[i] = 0;
    } else if (map.has(c)) labels[i] = map.get(c);
  }
  return labels;
}

/** The slide method: drop MST edges longer than ε, small leftovers become noise. */
export function thresholdCut(n, edges, eps, mcs) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (const e of edges) if (e.w <= eps) parent[find(e.a)] = find(e.b);
  const groups = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
  const labels = new Array(n).fill(-1);
  let k = 0;
  for (const g of [...groups.values()].sort((a, b) => a[0] - b[0])) {
    if (g.length >= mcs) { for (const i of g) labels[i] = k; k++; }
  }
  return labels;
}

/** Everything at once. */
export function hdbscan(points, { k = 5, mcs = 10, allowSingle = false } = {}) {
  const { core, nn } = coreDistances(points, k);
  const edges = mst(points, core);
  const merges = singleLinkage(points.length, edges);
  const tree = condense(points.length, merges, mcs);
  const { stab, birth } = stability(tree);
  const selected = selectEOM(tree, stab, allowSingle);
  const labels = labelPoints(points.length, tree, selected, allowSingle);
  return { core, nn, edges, merges, tree, stab, birth, selected, labels };
}
