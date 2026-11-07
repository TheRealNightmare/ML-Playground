// CART-style decision trees — pure functions, no three.js.
// One engine for three kinds of tree:
//   task 'cls'  : class labels y (0..C-1), sample weights w, criterion 'gini' | 'entropy' | 'error'
//   task 'reg'  : numbers y, weights w, criterion 'mse'
//   task 'grad' : gradients g and Hessians h (XGBoost), with lambda / gamma regularisation
// Candidate thresholds are midpoints between consecutive distinct values (as on the slides).

const log2 = (x) => Math.log(x) / Math.LN2;

export function impurity(counts, W, criterion) {
  if (W <= 0) return 0;
  if (criterion === 'entropy') {
    let e = 0;
    for (const c of counts) if (c > 0) { const p = c / W; e -= p * log2(p); }
    return e;
  }
  if (criterion === 'error') return 1 - Math.max(...counts) / W;
  let g = 1;
  for (const c of counts) { const p = c / W; g -= p * p; }
  return g;
}

/* ---------- statistics accumulators ---------- */
function makeStats(task, C) {
  if (task === 'cls') return { W: 0, n: 0, counts: new Float64Array(C) };
  if (task === 'reg') return { W: 0, n: 0, s: 0, s2: 0 };
  return { W: 0, n: 0, G: 0, H: 0 };
}
function addTo(st, task, data, i, sign = 1) {
  const w = data.w ? data.w[i] : 1;
  st.n += sign;
  if (task === 'cls') { st.W += sign * w; st.counts[data.y[i]] += sign * w; }
  else if (task === 'reg') { st.W += sign * w; st.s += sign * w * data.y[i]; st.s2 += sign * w * data.y[i] * data.y[i]; }
  else { st.W += sign; st.G += sign * data.g[i]; st.H += sign * data.h[i]; }
}
function cloneStats(st) {
  return st.counts ? { ...st, counts: Float64Array.from(st.counts) } : { ...st };
}

/** Node "impurity" for display: gini/entropy/error, MSE, or the XGBoost similarity score. */
export function nodeImpurity(st, task, opts) {
  if (task === 'cls') return impurity(st.counts, st.W, opts.criterion);
  if (task === 'reg') { if (st.W <= 0) return 0; const m = st.s / st.W; return Math.max(st.s2 / st.W - m * m, 0); }
  return (st.G * st.G) / (st.H + opts.lambda);
}
/** Total cost to minimise (impurity × weight). For 'grad' it is −½·G²/(H+λ). */
function cost(st, task, opts) {
  if (task === 'grad') return -0.5 * (st.G * st.G) / (st.H + opts.lambda);
  return st.W * nodeImpurity(st, task, opts);
}
export function leafValue(st, task, opts) {
  if (task === 'cls') { const W = st.W || 1; return Array.from(st.counts, (c) => c / W); }
  if (task === 'reg') return st.W > 0 ? st.s / st.W : 0;
  return -st.G / (st.H + opts.lambda);
}
function summary(st, task, opts) {
  const o = { n: st.n, W: st.W, imp: nodeImpurity(st, task, opts), value: leafValue(st, task, opts) };
  if (task === 'cls') o.counts = Array.from(st.counts);
  if (task === 'reg') o.mean = st.W > 0 ? st.s / st.W : 0;
  if (task === 'grad') { o.G = st.G; o.H = st.H; }
  return o;
}

/**
 * Best split of the samples `idx` over the given features.
 * Returns { feature, thr, gain, childImp, left, right, cands } or null.
 *   gain     : decrease in total cost (for 'grad', the XGBoost gain incl. −γ)
 *   childImp : weighted average impurity of the two children (what the slides call "weighted MSE")
 */
export function bestSplit(X, data, idx, features, opts) {
  const { task } = opts;
  const C = opts.nClasses || 2;
  const parent = makeStats(task, C);
  for (const i of idx) addTo(parent, task, data, i);
  const pc = cost(parent, task, opts);
  let best = null;
  const allCands = [];
  for (const f of features) {
    const order = idx.slice().sort((a, b) => X[a][f] - X[b][f]);
    const L = makeStats(task, C), R = cloneStats(parent);
    const cands = [];
    for (let k = 0; k < order.length - 1; k++) {
      const i = order[k];
      addTo(L, task, data, i, 1);
      addTo(R, task, data, i, -1);
      const v = X[i][f], vn = X[order[k + 1]][f];
      if (vn - v < 1e-12) continue;
      if (L.n < (opts.minLeaf || 1) || R.n < (opts.minLeaf || 1)) continue;
      const thr = (v + vn) / 2;
      const cl = cost(L, task, opts), cr = cost(R, task, opts);
      let gain = pc - cl - cr;
      if (task === 'grad') gain -= opts.gamma || 0;
      const W = L.W + R.W;
      const childImp = task === 'grad' ? null : (L.W * nodeImpurity(L, task, opts) + R.W * nodeImpurity(R, task, opts)) / (W || 1);
      const c = { feature: f, thr, gain, childImp };
      if (opts.record) { c.left = summary(L, task, opts); c.right = summary(R, task, opts); }
      cands.push(c);
      if (!best || gain > best.gain + 1e-12) best = { ...c, left: summary(L, task, opts), right: summary(R, task, opts) };
    }
    allCands.push({ feature: f, cands });
  }
  if (best) { best.cands = allCands; best.parent = summary(parent, task, opts); }
  return best;
}

/**
 * Grows a tree one node at a time (breadth first), so pages can animate it.
 *   opts: { task, criterion, nClasses, maxDepth, minLeaf, minGain, stopImpurity,
 *           maxFeatures, rand, lambda, gamma, record, nFeatures }
 */
export class TreeBuilder {
  constructor(X, data, idx, opts) {
    this.X = X; this.data = data; this.opts = { maxDepth: 6, minLeaf: 1, minGain: 1e-9, lambda: 1, gamma: 0, ...opts };
    this.nFeat = this.opts.nFeatures ?? (X[0]?.length || 1);
    const st = makeStats(this.opts.task, this.opts.nClasses || 2);
    for (const i of idx) addTo(st, this.opts.task, data, i);
    const box = { lo: Array(this.nFeat).fill(-Infinity), hi: Array(this.nFeat).fill(Infinity) };
    this.nodes = [{ id: 0, depth: 0, idx, stats: summary(st, this.opts.task, this.opts), value: leafValue(st, this.opts.task, this.opts), leaf: true, box, parent: -1 }];
    this.queue = [0];
    this.lastEvent = null;
  }

  get done() { return this.queue.length === 0; }

  _features() {
    const all = Array.from({ length: this.nFeat }, (_, i) => i);
    const k = this.opts.maxFeatures;
    if (!k || k >= all.length) return all;
    const r = this.opts.rand || Math.random;
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    return all.slice(0, k);
  }

  /** Try to split the next node in the queue. Returns an event describing what happened. */
  step() {
    while (this.queue.length) {
      const id = this.queue.shift();
      const node = this.nodes[id];
      const o = this.opts;
      let reason = null;
      if (node.depth >= o.maxDepth) reason = 'max depth reached';
      else if (node.idx.length < 2 * (o.minLeaf || 1)) reason = 'too few samples to split';
      else if (o.task !== 'grad' && node.stats.imp <= (o.stopImpurity ?? 1e-12)) reason = o.stopImpurity ? `impurity ${node.stats.imp.toFixed(3)} ≤ threshold` : 'node is pure';
      let split = null;
      if (!reason) {
        const features = this._features();
        split = bestSplit(this.X, this.data, node.idx, features, o);
        node.features = features;
        if (!split) reason = 'no valid threshold';
        else if (split.gain <= o.minGain) { reason = o.task === 'grad' ? `best gain ${split.gain.toFixed(3)} ≤ 0` : 'no split improves the impurity'; node.search = split; split = null; }
      }
      if (reason) {
        node.leaf = true; node.reason = reason;
        this.lastEvent = { type: 'leaf', node, reason };
        return this.lastEvent;
      }
      node.leaf = false;
      node.feature = split.feature; node.thr = split.thr; node.gain = split.gain; node.childImp = split.childImp;
      node.search = split;
      const li = node.idx.filter((i) => this.X[i][split.feature] < split.thr);
      const ri = node.idx.filter((i) => this.X[i][split.feature] >= split.thr);
      const mk = (ids, side) => {
        const st = makeStats(o.task, o.nClasses || 2);
        for (const i of ids) addTo(st, o.task, this.data, i);
        const box = { lo: node.box.lo.slice(), hi: node.box.hi.slice() };
        if (side === 'L') box.hi[split.feature] = split.thr; else box.lo[split.feature] = split.thr;
        const n = { id: this.nodes.length, depth: node.depth + 1, idx: ids, stats: summary(st, o.task, o), value: leafValue(st, o.task, o), leaf: true, box, parent: node.id, side };
        this.nodes.push(n);
        this.queue.push(n.id);
        return n.id;
      };
      node.left = mk(li, 'L');
      node.right = mk(ri, 'R');
      this.lastEvent = { type: 'split', node };
      return this.lastEvent;
    }
    this.lastEvent = null;
    return null;
  }

  growAll() { while (!this.done) this.step(); return this; }

  leafOf(x) {
    let n = this.nodes[0];
    while (!n.leaf) n = this.nodes[x[n.feature] < n.thr ? n.left : n.right];
    return n;
  }
  predict(x) { return this.leafOf(x).value; }
  get depth() { return Math.max(...this.nodes.map((n) => n.depth)); }
  get leaves() { return this.nodes.filter((n) => n.leaf).length; }
}

export function growTree(X, data, idx, opts) { return new TreeBuilder(X, data, idx, opts).growAll(); }

/* ---------- small helpers shared by the supervised pages ---------- */
export function argmax(a) { let b = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; }
export const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/** Seeded RNG (for reproducible bootstraps). */
export function rng(seed = 1) { let s = (seed >>> 0) % 2147483647 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

/** Bootstrap sample of size m from n items. Returns { idx, counts, oob }. */
export function bootstrap(n, m = n, rand = Math.random) {
  const idx = [], counts = new Array(n).fill(0);
  for (let i = 0; i < m; i++) { const k = Math.floor(rand() * n); idx.push(k); counts[k]++; }
  const oob = counts.map((c, i) => (c === 0 ? i : -1)).filter((i) => i >= 0);
  return { idx, counts, oob };
}
