import * as THREE from 'three';
import { statTiles, COLORS, INK_C, WHITE, GREY } from '../../core/pointlab.js';
import { createSupLab } from '../../core/suplab.js';
import { TreeBuilder, growTree, argmax, rng, bootstrap } from '../../core/trees.js';
import { logistic, knn } from '../../core/models.js';
import { SUPDATA } from '../../core/supdata.js';
import { MiniChart } from '../../core/chart.js';
import { ModelThumbs, paintCls, paintCurve } from '../../core/thumbs.js';
import { h, section, slider, segmented, toggle, button } from '../../core/ui.js';
import { table, note, para, step, fmt, fx } from '../../core/worked.js';
import { LECTURES, intuitionTab, mathTab, challengesTab } from './content.js';

const TERRA = new THREE.Color(0xe07a5f);
const SLATE = new THREE.Color(0x4f6d8a);
const MUTE = new THREE.Color(0x8a7c6e);

const TRUTH = {
  rsine: (x) => 0.55 * Math.sin(3.2 * x),
  rsteps: (x) => (x < -0.35 ? -0.45 : x < 0.3 ? 0.35 : -0.05),
  rline: (x) => 0.55 * x - 0.05,
  rquad: (x) => 1.1 * x * x - 0.5,
};
const NOISE = { rsine: 0.1, rsteps: 0.08, rline: 0.12, rquad: 0.1 };
const MODES = [
  { value: 'bias', label: 'Bias & variance' },
  { value: 'bagging', label: 'Bagging' },
  { value: 'boosting', label: 'Boosting' },
  { value: 'stacking', label: 'Stacking' },
];
const DEFAULT_DS = { bias: 'rsine', bagging: 'cnoisy', boosting: 'rsine', stacking: 'cmoons' };
const GRID = Array.from({ length: 81 }, (_, i) => -0.95 + (1.9 * i) / 80);
const R_FITS = 20;
const STACK_NAMES = ['Decision tree', 'Logistic regression', 'k-NN (k = 9)', 'Meta-model'];

export function mount(root) {
  const S = {
    mode: 'bias', depth: 3, bag: false, B: 15, eta: 0.3, rounds: 40, bdepth: 1,
    models: [], k: 0, phase: 'ready', sel: -1, seed: 1, test: null, curve: null, F0: 0,
  };

  const L = createSupLab(root, {
    meta: { accent: '#C46A8A', title: 'Ensemble Learning', emoji: '', category: 'Concepts · Bias & variance', level: 'Beginner', blurb: 'Why single models fail (bias and variance), and three ways to combine many models into a better one.' },
    defaultDataset: 'rsine',
    defaultTask: 'reg',
    n: { min: 20, max: 400, step: 10, value: 120 },
    maxPoints: 500,
    interval: 0.6,
    lectures: LECTURES,
    phaseTrack: [
      { id: 'ready', label: 'Data' },
      { id: 'grow', label: 'Add a model', loopBack: true },
      { id: 'done', label: 'Combine' },
    ],
    learnTabs: [
      { id: 'intuition', label: 'Intuition', render: intuitionTab },
      { id: 'math', label: '∑ Math', render: mathTab },
      { id: 'try', label: 'Try this', render: () => challengesTab(actions) },
    ],
  });
  const n = () => L.points.length;
  const reg = () => L.task === 'reg';
  const script = () => !!L.lecture?.script;
  const truth = () => (L.lecture ? null : TRUTH[L.datasetId] || null);

  /* ---------------- helpers ---------------- */
  function sampleTruth(rand) {
    const f = truth(), sd = NOISE[L.datasetId] || 0.1, m = Math.max(30, n());
    const X = [], y = [];
    for (let i = 0; i < m; i++) { const x = rand() * 1.9 - 0.95; X.push([x]); y.push(f(x) + gaussR(rand) * sd); }
    return { X, y };
  }
  function gaussR(rand) { let u = 0, v = 0; while (u === 0) u = rand(); v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function fitReg(X, y, depth, bag, rand) {
    const idx = X.map((_, i) => i);
    if (!bag) { const b = growTree(X, { y }, idx, { task: 'reg', criterion: 'mse', maxDepth: depth, nFeatures: 1 }); return (x) => b.predict([x]); }
    const trees = Array.from({ length: 15 }, () => growTree(X, { y }, bootstrap(X.length, X.length, rand).idx, { task: 'reg', criterion: 'mse', maxDepth: depth, nFeatures: 1 }));
    return (x) => trees.reduce((s, b) => s + b.predict([x]), 0) / trees.length;
  }
  /** One bias–variance "fit": a fresh sample from the true curve (or a bootstrap of your points) and a model on it. */
  function biasFit(r, depth = S.depth, bag = S.bag) {
    const rand = rng(S.seed * 9973 + r * 31 + depth * 7 + (bag ? 5 : 0));
    let X, y;
    if (truth()) ({ X, y } = sampleTruth(rand));
    else { const bt = bootstrap(n(), n(), rand); X = bt.idx.map((i) => [L.points[i].x]); y = bt.idx.map((i) => L.points[i].y); }
    return fitReg(X, y, depth, bag, rand);
  }
  function biasVar(fits) {
    const f = truth();
    let b2 = 0, v = 0;
    for (const x of GRID) {
      const ps = fits.map((fn) => fn(x));
      const m = ps.reduce((a, c) => a + c, 0) / ps.length;
      v += ps.reduce((a, c) => a + (c - m) ** 2, 0) / ps.length;
      if (f) b2 += (m - f(x)) ** 2;
    }
    return { bias2: f ? b2 / GRID.length : null, variance: v / GRID.length };
  }
  const avgFit = (fits) => (x) => fits.reduce((s, fn) => s + fn(x), 0) / fits.length;

  /* bagging / boosting / stacking models */
  function bagModel(t) {
    const X = L.X(), y = L.Y();
    const rand = rng(S.seed * 7919 + t * 104729);
    const boot = bootstrap(n(), n(), rand);
    const b = new TreeBuilder(X, { y }, boot.idx, { task: reg() ? 'reg' : 'cls', criterion: reg() ? 'mse' : 'gini', nClasses: L.nClasses, maxDepth: 10, nFeatures: L.nFeatures() }).growAll();
    return { b, boot };
  }
  const bagPredict = (x, ms = S.models) => {
    if (reg()) return ms.reduce((s, m) => s + m.b.predict(x), 0) / (ms.length || 1);
    const v = new Array(L.nClasses).fill(0);
    for (const m of ms) v[argmax(m.b.predict(x))] += 1 / ms.length;
    return v;
  };
  let singleTree = null;

  const boostF = (x, upto = S.models.length) => { let F = S.F0; for (let m = 0; m < upto; m++) F += S.eta * S.models[m].b.predict(x); return F; };
  function boostRound() {
    const X = L.X(), y = L.Y();
    if (!S.models.length) S.F0 = y.reduce((a, c) => a + c, 0) / (y.length || 1);
    const r = X.map((x, i) => y[i] - boostF(x));
    const b = growTree(X, { y: r }, X.map((_, i) => i), { task: 'reg', criterion: 'mse', maxDepth: S.bdepth, nFeatures: 1 });
    return { b, r };
  }

  function stackStage(k) {
    const X = L.X(), y = L.Y();
    const fitBase = (j, Xs, ys) => {
      if (j === 0) { const b = growTree(Xs, { y: ys }, Xs.map((_, i) => i), { task: 'cls', criterion: 'gini', nClasses: 2, maxDepth: 5, nFeatures: 2 }); return (x) => b.predict(x)[1]; }
      if (j === 1) { const m = logistic(Xs, ys, { epochs: 300, lr: 1.2 }); return (x) => m.prob(x); }
      const m = knn(Xs, ys, { k: 9, nClasses: 2 }); return (x) => m.probs(x)[1];
    };
    if (k < 3) return { p: fitBase(k, X, y) };
    // meta-model on out-of-fold predictions
    const K = 5, folds = X.map((_, i) => i % K);
    const oof = X.map(() => [0, 0, 0]);
    for (let f = 0; f < K; f++) {
      const tr = X.map((_, i) => i).filter((i) => folds[i] !== f);
      const te = X.map((_, i) => i).filter((i) => folds[i] === f);
      for (let j = 0; j < 3; j++) { const p = fitBase(j, tr.map((i) => X[i]), tr.map((i) => y[i])); te.forEach((i) => { oof[i][j] = p(X[i]); }); }
    }
    const meta = logistic(oof, y, { epochs: 600, lr: 1.5, l2: 1e-3 });
    const bases = S.models.slice(0, 3).map((m) => m.p);
    return { p: (x) => meta.prob(bases.map((p) => p(x))), theta: meta.theta };
  }

  /* ---------------- flow ---------------- */
  const total = () => {
    if (script()) return 4;
    return { bias: R_FITS, bagging: S.B, boosting: S.rounds, stacking: 4 }[S.mode];
  };
  function addModel(i) {
    if (S.mode === 'bias') return biasFit(i);
    if (S.mode === 'bagging') return bagModel(i);
    if (S.mode === 'boosting') return boostRound();
    return stackStage(i);
  }
  function reset() {
    L.normalizeTask();
    S.models = []; S.k = 0; S.sel = -1; S.phase = 'ready';
    singleTree = null;
    if (S.mode === 'bagging' && n() && !script()) singleTree = growTree(L.X(), { y: L.Y() }, L.X().map((_, i) => i), { task: reg() ? 'reg' : 'cls', criterion: reg() ? 'mse' : 'gini', nClasses: L.nClasses, maxDepth: 10, nFeatures: L.nFeatures() });
    if (S.mode === 'bias') scheduleCurve();
    refresh();
  }
  function doStep() {
    if (script()) { if (S.k >= 4) return false; S.k++; S.phase = S.k >= 4 ? 'done' : 'grow'; refresh(); return S.k < 4; }
    if (!n()) return false;
    if (S.models.length >= total()) { S.phase = 'done'; refresh(); return false; }
    S.models.push(addModel(S.models.length));
    S.phase = S.models.length >= total() ? 'done' : 'grow';
    refresh();
    return S.phase !== 'done';
  }
  function finish() {
    L.player.pause();
    if (script()) { S.k = 4; S.phase = 'done'; refresh(); return; }
    if (!n()) return;
    while (S.models.length < total()) S.models.push(addModel(S.models.length));
    S.phase = 'done'; refresh();
  }
  function rerun() {
    const k = S.models.length;
    reset();
    if (!n()) return;
    for (let i = 0; i < Math.min(k, total()); i++) S.models.push(addModel(i));
    S.phase = !S.models.length ? 'ready' : S.models.length >= total() ? 'done' : 'grow';
    refresh();
  }

  function setMode(m, { load = true } = {}) {
    S.mode = m;
    modeSeg.set(m);
    syncControls();
    if (load) L.loadDataset(DEFAULT_DS[m]);
  }

  /* ---------------- hooks ---------------- */
  L.hooks.reset = reset;
  L.hooks.step = doStep;
  L.hooks.onEdit = () => { S.test = null; rerun(); };
  L.hooks.canEdit = () => !script() && S.mode !== 'bias';
  L.hooks.lockedMessage = 'Bias & variance draws its own fresh samples — switch to Bagging or Boosting to draw';
  L.hooks.onDatasetSup = (ds) => {
    const need = { bias: 'reg', boosting: 'reg', stacking: 'cls' }[S.mode];
    if (need && ds.task !== need || (S.mode === 'stacking' && ds.nClasses > 2)) {
      const to = ds.task === 'reg' ? 'boosting' : 'bagging';
      if (ds.id !== 'cblank' && ds.id !== 'rblank') L.toast(`${MODES.find((x) => x.value === S.mode).label} needs ${need === 'reg' ? 'regression' : 'two-class'} data — switched to ${MODES.find((x) => x.value === to).label}`);
      S.mode = to; modeSeg.set(to);
    }
    const mk = SUPDATA[ds.id];
    S.test = mk && !/blank/.test(ds.id) ? mk.make(300).map((p) => ({ x: reg() ? [p.x] : [p.x, p.y], y: reg() ? p.y : p.label })) : null;
    syncControls();
  };
  L.hooks.onLectureSup = (lec) => {
    S.mode = lec.mode; modeSeg.set(lec.mode);
    L.space.setIdentity(); L.axes.setVisible(false);
    S.test = null;
    syncControls();
  };

  /* ---------------- frame: residual sticks + stacking links ---------------- */
  L.hooks.frameSup = () => {
    const segs = [];
    if (S.mode === 'boosting' && !script() && S.models.length && S.phase !== 'done' && n() <= 200) {
      for (const p of L.points) {
        const F = boostF([p.x]);
        const a = L.space.w({ x: p.x, y: p.y }), b = L.space.w({ x: p.x, y: F });
        segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, w: 0.004, col: MUTE });
      }
    }
    if (script() && L.lecture.mode === 'stacking') {
      const meta = L.points[3];
      for (let j = 0; j < 3; j++) {
        const p = L.points[j];
        const on = S.k >= 4;
        segs.push({ x1: p.wx, y1: p.wy - 0.05, x2: meta.wx, y2: meta.wy + 0.05, w: on ? 0.008 : 0.004, col: on ? INK_C : GREY });
      }
    }
    L.segs.sync(segs);
  };

  L.hooks.labels = () => {
    if (!script()) return null;
    const lec = L.lecture, out = [];
    if (lec.mode === 'bagging') {
      const sub = S.k >= 1 && S.k <= 3 ? lec.subsets[S.k - 1] : null;
      if (sub) L.points.forEach((p) => { const c = sub.filter((v) => String(v) === p.name).length; if (c > 1) out.push({ x: p.wx, y: p.wy, text: `×${c}`, cls: 'tip', dx: -10, dy: 18 }); });
      if (S.k >= 1) out.push({ x: -0.84, y: -0.45, text: lec.votes.slice(0, Math.min(S.k, 3)).map((v, i) => `Model ${i + 1} → ${v}`).join('   ·   ') + (S.k >= 4 ? '   ⇒   majority: Good' : ''), cls: 'tip', dx: 0, dy: 0 });
    } else if (lec.mode === 'boosting') {
      if (S.k >= 1) out.push({ x: -0.84, y: -0.45, text: lec.votes.slice(0, Math.min(S.k, 3)).map((v, i) => `Model ${i + 1} → ${v}`).join('   ·   ') + (S.k >= 4 ? '   ⇒   weighted vote: Good' : ''), cls: 'tip', dx: 0, dy: 0 });
      if (S.k >= 1 && S.k <= 3) lec.rounds[S.k - 1].wrong.forEach((nm) => { const p = L.points.find((q) => q.name === nm); out.push({ x: p.wx, y: p.wy, text: 'wrong', cls: 'tip', dx: -18, dy: 18 }); });
    } else {
      const preds = ['Good', 'Good', 'Bad'];
      L.points.slice(0, 3).forEach((p, j) => { if (S.k > j) out.push({ x: p.wx, y: p.wy, text: `→ ${preds[j]}`, cls: 'tip', dx: -22, dy: 18 }); });
      if (S.k >= 4) out.push({ x: L.points[3].wx, y: L.points[3].wy, text: '→ Good', cls: 'tip', dx: -22, dy: 18 });
    }
    return out;
  };

  /* ---------------- controls ---------------- */
  const modeSeg = segmented({ label: 'Concept', options: MODES, value: S.mode, wrap: true, onChange: (v) => setMode(v) });
  const depthSlider = slider({ label: 'Tree depth (model complexity)', min: 1, max: 10, step: 1, value: S.depth, onInput: (v) => { S.depth = v; rerun(); } });
  const bagToggle = toggle({ label: 'Bag 15 trees per fit', value: S.bag, onChange: (v) => { S.bag = v; rerun(); } });
  const bSlider = slider({ label: 'Number of bagged trees', min: 1, max: 40, step: 1, value: S.B, onInput: (v) => { S.B = v; rerun(); } });
  const etaSlider = slider({ label: 'Learning rate η', min: 0.05, max: 1, step: 0.05, value: S.eta, format: (v) => v.toFixed(2), onInput: (v) => { S.eta = v; rerun(); } });
  const bdSlider = slider({ label: 'Depth of each boosted tree', min: 1, max: 4, step: 1, value: S.bdepth, onInput: (v) => { S.bdepth = v; rerun(); } });
  const rSlider = slider({ label: 'Boosting rounds', min: 1, max: 100, step: 1, value: S.rounds, onInput: (v) => { S.rounds = v; rerun(); } });
  const modeHint = h('span', { class: 'hint' });
  L.addControls(section([L.num(3), 'Ensemble'], modeSeg.el, modeHint, depthSlider.el, bagToggle.el, bSlider.el, etaSlider.el, bdSlider.el, rSlider.el,
    h('div', { class: 'btn-row' }, button('Run to the end', finish, { variant: 'btn-block' }), button('Resample', () => { S.seed++; rerun(); }, { variant: 'btn-ghost btn-block' }))));

  function syncControls() {
    const m = S.mode, sc = script();
    const show = (el, v) => { el.style.display = v ? '' : 'none'; };
    show(depthSlider.el, m === 'bias' && !sc);
    show(bagToggle.el, m === 'bias' && !sc);
    show(bSlider.el, m === 'bagging' && !sc);
    show(etaSlider.el, m === 'boosting' && !sc);
    show(bdSlider.el, m === 'boosting' && !sc);
    show(rSlider.el, m === 'boosting' && !sc);
    modeHint.innerHTML = sc ? 'Lecture walk-through: press <b>Step</b> to follow the slides.' : {
      bias: `Each <b>Step</b> draws a fresh training set ${truth() ? 'from the same true curve' : '(a bootstrap of your points)'} and fits a tree. The spread of the fits is the <b>variance</b>; how far their average is from the truth is the <b>bias</b>.`,
      bagging: 'Deep trees (depth 10) on bootstrap samples, combined by vote / average.',
      boosting: 'Gradient boosting for regression: each small tree fits the current residuals (grey sticks).',
      stacking: 'Three different base models, then a logistic meta-model trained on their out-of-fold predictions.',
    }[m];
  }

  /* ---------------- side ---------------- */
  const stats = statTiles([['a', 'A'], ['b', 'B'], ['c', 'C'], ['d', 'D']]);
  const labs = stats.el.querySelectorAll('.stat-label');
  const dart = h('canvas', { class: 'dartboard', width: 440, height: 220 });
  const dartNote = h('div', { class: 'chart-note' });
  const chart = new MiniChart({ height: 120, xLabel: '', empty: '' });
  const chartNote = h('div', { class: 'chart-note' });
  const chartLabel = h('div', { class: 'sub-label' });
  const thumbs = new ModelThumbs({ onSelect: (i) => { S.sel = i; refresh(); } });
  const thumbLabel = h('div', { class: 'sub-label' }, 'The models (click one)');
  const card = h('div', { class: 'card side-card' }, h('h3', {}, 'Live numbers'), stats.el, dart, dartNote, thumbLabel, thumbs.el, chartLabel, chart.canvas, chartNote);
  L.mountSide(card);

  /* precomputed error-vs-depth curve for bias mode */
  let curveTimer = 0;
  function scheduleCurve() {
    clearTimeout(curveTimer);
    S.curve = null;
    curveTimer = setTimeout(() => {
      if (S.mode !== 'bias' || !n() || script()) return;
      S.curve = Array.from({ length: 10 }, (_, d) => {
        const fits = Array.from({ length: 10 }, (_, r) => biasFit(100 + r, d + 1, S.bag));
        const bv = biasVar(fits);
        return { d: d + 1, ...bv };
      });
      drawChart();
    }, 80);
  }

  function drawDart(fits) {
    const ctx = dart.getContext('2d');
    const W = dart.width, H = dart.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = H * 0.44;
    ['#E6DED1', '#EDE6DB', '#E6DED1', '#EDE6DB'].forEach((c, i) => { ctx.beginPath(); ctx.arc(cx, cy, R * (1 - i * 0.25), 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = '#C9BCA8'; ctx.lineWidth = 1.5; ctx.stroke(); });
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.08, 0, Math.PI * 2); ctx.fillStyle = '#3D8B8B'; ctx.fill();
    const f = truth();
    if (!f || !fits.length) return;
    const half = GRID.length >> 1;
    const err = (fn, a, b) => { let s = 0; for (let i = a; i < b; i++) s += fn(GRID[i]) - f(GRID[i]); return s / (b - a); };
    const scale = R / 0.12;
    fits.forEach((fn, i) => {
      const ex = err(fn, 0, half), ey = err(fn, half, GRID.length);
      const x = cx + Math.max(-1.2, Math.min(1.2, ex * scale / R)) * R, y = cy - Math.max(-1.2, Math.min(1.2, ey * scale / R)) * R;
      ctx.beginPath(); ctx.arc(x, y, i === fits.length - 1 ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#E07A5F'; ctx.fill(); ctx.strokeStyle = '#4A3F35'; ctx.lineWidth = 1.2; ctx.stroke();
    });
  }

  function drawChart() {
    const m = S.mode;
    chartLabel.style.display = chart.canvas.style.display = chartNote.style.display = script() ? 'none' : '';
    if (script()) return;
    if (m === 'bias') {
      chartLabel.textContent = 'Total error (bias² + variance) by depth';
      if (!S.curve) { chart.setLine([], { empty: truth() ? 'Computing…' : 'Needs a dataset with a known true curve' }); chartNote.textContent = ''; return; }
      chart.setLine(S.curve.map((c) => ({ y: (c.bias2 ?? 0) + c.variance, color: c.d === S.depth ? '#E07A5F' : '#DDD3C4' })), { xLabel: 'tree depth 1 → 10', noArea: true });
      const best = S.curve.reduce((a, c) => ((c.bias2 ?? 0) + c.variance < (a.bias2 ?? 0) + a.variance ? c : a));
      chartNote.innerHTML = `Lowest total error at depth <b>${best.d}</b>. Shallow trees: bias dominates. Deep trees: variance dominates.`;
    } else if (m === 'bagging') {
      chartLabel.textContent = reg() ? 'Test MSE vs number of trees' : 'Test accuracy vs number of trees';
      if (!S.test || !S.models.length) { chart.setLine([], { empty: S.test ? 'Add some trees' : 'No test set for drawn data' }); chartNote.textContent = ''; return; }
      const pts = S.models.map((_, k) => ({ y: testScore((x) => bagPredict(x, S.models.slice(0, k + 1))) }));
      chart.setLine(pts, { xLabel: 'number of bagged trees', dots: pts.length <= 30, ref: { y: testScore((x) => singleTree.predict(x)), label: 'one tree' } });
      chartNote.innerHTML = `Measured on 300 fresh points from the same dataset. The dashed line is a single deep tree on all the data.`;
    } else if (m === 'boosting') {
      chartLabel.textContent = 'Training MSE by round';
      if (!S.models.length) { chart.setLine([], { empty: 'Press Step' }); chartNote.textContent = ''; return; }
      const X = L.X(), y = L.Y();
      const pts = S.models.map((_, k) => ({ y: X.reduce((s, x, i) => s + (y[i] - boostF(x, k + 1)) ** 2, 0) / X.length }));
      chart.setLine(pts, { xLabel: 'boosting round', dots: pts.length <= 30, noArea: false });
      chartNote.innerHTML = 'Each round removes part of the remaining error. A smaller η needs more rounds but generalises better.';
    } else {
      chartLabel.textContent = 'Accuracy of each model';
      const sc = S.models.map((mm, j) => ({ label: ['Tree', 'LogReg', 'k-NN', 'Stack'][j], value: scoreCls(mm.p), color: j === 3 ? '#E07A5F' : '#DDD3C4', highlight: j === S.sel }));
      chart.setBars(sc, { xLabel: S.test ? 'accuracy on 300 fresh points' : 'training accuracy', empty: 'Press Step' });
      chartNote.textContent = S.models.length === 4 ? `Meta-model weights: tree ${fx(S.models[3].theta[1], 2)}, logistic ${fx(S.models[3].theta[2], 2)}, k-NN ${fx(S.models[3].theta[3], 2)} (bias ${fx(S.models[3].theta[0], 2)}).` : '';
    }
  }
  function testScore(pred) {
    if (reg()) return S.test.reduce((s, t) => s + (pred(t.x) - t.y) ** 2, 0) / S.test.length;
    return S.test.reduce((s, t) => s + (argmax(pred(t.x)) === t.y ? 1 : 0), 0) / S.test.length;
  }
  function scoreCls(p) {
    if (S.test) return S.test.reduce((s, t) => s + ((p(t.x) > 0.5 ? 1 : 0) === t.y ? 1 : 0), 0) / S.test.length;
    return L.points.reduce((s, q) => s + ((p([q.x, q.y]) > 0.5 ? 1 : 0) === q.label ? 1 : 0), 0) / (n() || 1);
  }

  /* ---------------- refresh ---------------- */
  function refresh() {
    const m = S.mode;
    const sc = script();
    const show = (el, v) => { el.style.display = v ? '' : 'none'; };
    show(dart, m === 'bias' && !sc); show(dartNote, m === 'bias' && !sc);
    show(thumbLabel, !sc && m !== 'bias'); show(thumbs.el, !sc && m !== 'bias');
    L.colorPoints();
    if (sc) { refreshScript(); drawChart(); return; }

    const K = S.models.length;
    const setStat = (i, label, key, val) => { labs[i].textContent = label; stats.set(key, val); };

    if (m === 'bias') {
      L.showField(null);
      const f = truth();
      const cs = S.models.map((fn) => ({ fn, color: SLATE, width: 0.004, fade: 0.45 }));
      if (K) cs.push({ fn: avgFit(S.models), color: TERRA, width: 0.012 });
      if (f) cs.unshift({ fn: f, color: INK_C, width: 0.006, fade: 0.2 });
      L.setCurves(cs);
      const bv = K >= 2 ? biasVar(S.models) : null;
      setStat(0, 'Fits', 'a', `${K}/${R_FITS}`);
      setStat(1, 'Bias²', 'b', bv?.bias2 != null ? fx(bv.bias2, 4) : '–');
      setStat(2, 'Variance', 'c', bv ? fx(bv.variance, 4) : '–');
      setStat(3, 'Depth', 'd', S.depth + (S.bag ? ' · bag' : ''));
      drawDart(S.models);
      dartNote.innerHTML = f ? 'Each dart is one fit: its distance from the centre is its error on the left and right halves of the curve. <b>Bias</b> = darts off-centre together, <b>variance</b> = darts spread out.' : 'The dartboard needs a dataset with a known true curve (Sine, Steps, Line or Parabola).';
    } else if (m === 'bagging') {
      const ms = S.sel >= 0 ? [S.models[S.sel]] : S.models;
      if (L.task === 'cls') { L.showField(K ? (x) => bagPredict(x, ms) : null); L.setCurves([]); }
      else {
        L.showField(null);
        const cs = S.models.map((mm, i) => ({ fn: (x) => mm.b.predict([x]), color: i === S.sel ? SLATE : MUTE, width: i === S.sel ? 0.01 : 0.003, fade: i === S.sel ? 0 : 0.6, step: true }));
        if (K) cs.push({ fn: (x) => bagPredict([x]), color: TERRA, width: 0.012, fade: S.sel >= 0 ? 0.6 : 0 });
        L.setCurves(cs);
      }
      const tr = S.sel >= 0 ? S.models[S.sel] : S.phase === 'grow' ? S.models[K - 1] : null;
      if (tr) L.points.forEach((p, i) => { const c = tr.boot.counts[i]; if (!c) { p.oc = p.tc; p.tc = WHITE; p.fr = 0.45; } else p.sz = 0.8 + 0.25 * Math.min(c, 4); });
      const sc1 = singleTree && S.test ? testScore((x) => singleTree.predict(x)) : null;
      const scB = K && S.test ? testScore((x) => bagPredict(x)) : null;
      const f = (v) => (v == null ? '–' : reg() ? fx(v, 4) : `${Math.round(v * 100)}%`);
      setStat(0, 'Trees', 'a', `${K}/${S.B}`);
      setStat(1, reg() ? 'One tree MSE' : 'One tree', 'b', f(sc1));
      setStat(2, reg() ? 'Bagged MSE' : 'Bagged', 'c', f(scB));
      setStat(3, reg() ? 'Train MSE' : 'Train acc.', 'd', K ? (reg() ? fx(L.mse((x) => bagPredict(x)), 4) : `${Math.round(L.accuracy((x) => argmax(bagPredict(x))) * 100)}%`) : '–');
      setThumbs(S.models.map((mm, i) => ({ title: `T${i + 1}`, fn: reg() ? (x) => mm.b.predict([x]) : (x) => mm.b.predict(x) })));
    } else if (m === 'boosting') {
      L.showField(null);
      const cs = [];
      if (K) {
        const last = S.models[S.sel >= 0 ? S.sel : K - 1];
        cs.push({ fn: () => -0.85, color: MUTE, width: 0.003, fade: 0.6 });
        cs.push({ fn: (x) => last.b.predict([x]) - 0.85, color: SLATE, width: 0.007, step: true });
        cs.push({ fn: (x) => boostF([x], S.sel >= 0 ? S.sel + 1 : K), color: TERRA, width: 0.012 });
      } else if (n()) { const mean = L.Y().reduce((a, c) => a + c, 0) / n(); cs.push({ fn: () => mean, color: TERRA, width: 0.012 }); }
      L.setCurves(cs);
      const X = L.X(), y = L.Y();
      const mse = K ? X.reduce((s, x, i) => s + (y[i] - boostF(x)) ** 2, 0) / X.length : null;
      setStat(0, 'Rounds', 'a', `${K}/${S.rounds}`);
      setStat(1, 'Train MSE', 'b', mse == null ? '–' : fx(mse, 4));
      setStat(2, 'Test MSE', 'c', K && S.test ? fx(testScore((x) => boostF(x)), 4) : '–');
      setStat(3, 'η', 'd', fx(S.eta, 2));
      setThumbs(S.models.map((mm, i) => ({ title: `h${i + 1}`, fn: (x) => mm.b.predict([x]) })));
    } else {
      const shown = S.sel >= 0 ? S.models[S.sel] : S.models[K - 1];
      L.showField(shown ? (x) => { const p = shown.p(x); return [1 - p, p]; } : null);
      L.setCurves([]);
      setStat(0, 'Tree', 'a', K > 0 ? `${Math.round(scoreCls(S.models[0].p) * 100)}%` : '–');
      setStat(1, 'Logistic', 'b', K > 1 ? `${Math.round(scoreCls(S.models[1].p) * 100)}%` : '–');
      setStat(2, 'k-NN', 'c', K > 2 ? `${Math.round(scoreCls(S.models[2].p) * 100)}%` : '–');
      setStat(3, 'Stacked', 'd', K > 3 ? `${Math.round(scoreCls(S.models[3].p) * 100)}%` : '–');
      setThumbs(S.models.map((mm, i) => ({ title: ['Tree', 'LogReg', 'k-NN', 'Meta'][i], fn: (x) => { const p = mm.p(x); return [1 - p, p]; } })));
    }
    drawChart();
    narrate();
    renderWorked();
  }

  let thumbVer = 0;
  const baseEdit = L.hooks.onEdit;
  L.hooks.onEdit = () => { thumbVer++; baseEdit(); };
  function setThumbs(list) {
    const ver = `${S.mode}|${S.seed}|${n()}|${L.task}|${thumbVer}|${S.eta}|${S.bdepth}`;
    thumbs.set(list.map((t, i) => ({
      title: t.title, key: `${ver}|${i}`,
      draw: (ctx, w, hh) => (L.task === 'cls' ? paintCls(L, ctx, w, hh, t.fn) : paintCurve(L, ctx, w, hh, t.fn)),
    })), S.sel);
  }

  /* ---------------- scripted lectures ---------------- */
  function refreshScript() {
    const lec = L.lecture, k = S.k;
    L.showField(null); L.setCurves([]);
    let nar;
    if (lec.mode === 'bagging') {
      const sub = k >= 1 && k <= 3 ? lec.subsets[k - 1] : null;
      L.points.forEach((p) => {
        const c = sub ? sub.filter((v) => String(v) === p.name).length : 1;
        p.tc = sub ? (c ? COLORS[5] : WHITE) : GREY; p.oc = sub && !c ? GREY : null; p.fr = sub && !c ? 0.45 : 0.74; p.sz = sub ? (c ? 0.9 + 0.35 * c : 0.85) : 1;
      });
      if (!k) nar = { title: 'Original dataset: 12 examples', text: 'We will create <b>3 subsets of size 5</b> by sampling <i>with replacement</i>, train one decision tree on each, and combine their votes.' };
      else if (sub) {
        const rep = [...new Set(sub.filter((v, i) => sub.indexOf(v) !== i))];
        const miss = Array.from({ length: 12 }, (_, i) => i + 1).filter((v) => !sub.includes(v));
        nar = { title: `Subset ${k}: [${sub.join(', ')}] → Model ${k}`, text: `${rep.length ? `${rep.join(', ')} appear${rep.length === 1 ? 's' : ''} twice` : 'No repeats'} (sampling with replacement); ${miss.length} examples are not used at all. Model ${k} is trained on this subset and predicts <b>${lec.votes[k - 1]}</b> for the new input.` };
      } else nar = { title: 'Majority vote: Good, Bad, Good → Good', text: 'Two of the three models say Good, so the bagged prediction is <b>Good</b> — more stable than any single model.' };
    } else if (lec.mode === 'boosting') {
      const imp = {};
      L.points.forEach((p) => { imp[p.name] = 1; });
      for (let r = 0; r < Math.min(k, 3); r++) if (r < k - 1 || k > 3) lec.rounds[r].wrong.forEach((nm) => { imp[nm] += 1; });
      const cur = k >= 1 && k <= 3 ? lec.rounds[k - 1] : null;
      L.points.forEach((p) => {
        const wrong = cur?.wrong.includes(p.name);
        p.tc = cur ? (wrong ? COLORS[0] : COLORS[1]) : GREY; p.oc = wrong ? COLORS[0] : null; p.fr = wrong ? 0.5 : 0.74;
        p.sz = 0.85 + 0.35 * (imp[p.name] - 1);
      });
      const txt = [
        'Model 1 (a small tree) predicts correctly for <b>A, B, C, F</b> and gets <b>D, E</b> wrong. Boosting raises the importance of D and E (they will grow).',
        'Model 2 is trained with more weight on D and E and fixes them — but makes a new mistake on <b>C</b>. Now C gets more importance.',
        'Model 3 focuses on what is still difficult and gets <b>C</b> right. All remaining mistakes are corrected.',
      ];
      if (!k) nar = { title: 'Six training examples, equal importance', text: 'Every example starts with the same weight (same size). Press <b>Step</b> to train Model 1.' };
      else if (cur) nar = { title: `Model ${k}`, text: txt[k - 1] };
      else nar = { title: 'Weighted vote: Good, Good, Bad → Good', text: 'Models 1 and 2 performed better than Model 3, so their votes count more: the final prediction is <b>Good</b>.' };
    } else {
      L.points.forEach((p, j) => { const on = j < 3 ? k > j : k >= 4; p.tc = on ? COLORS[p.label] : GREY; p.sz = j === 3 ? 1.5 : 1.2; });
      const t = [
        'The <b>decision tree</b>, trained on the full dataset, predicts <b>Good</b> for the new point.',
        '<b>Logistic regression</b> also predicts <b>Good</b>.',
        '<b>k-NN</b> predicts <b>Bad</b>. The base models disagree!',
        'The meta-model has learned during training that the tree and logistic regression are usually reliable, while k-NN is sometimes noisy. Final prediction: <b>Good</b>.',
      ];
      nar = !k ? { title: 'Stacking: three different base models', text: 'Each base model is a different <i>type</i> of learner. Their outputs become the input features of a meta-model.' } : { title: k < 4 ? `Base model ${k}: ${STACK_NAMES[k - 1]}` : 'Meta-model combines them → Good', text: t[k - 1] };
    }
    L.narrate({ emoji: '', ...nar }, !k ? 'ready' : k >= 4 ? 'done' : 'grow');
    labs[0].textContent = 'Step'; stats.set('a', `${k}/4`);
    labs[1].textContent = 'Concept'; stats.set('b', MODES.find((x) => x.value === lec.mode).label.split(' ')[0]);
    labs[2].textContent = 'Models'; stats.set('c', String(Math.min(k, lec.mode === 'stacking' ? 4 : 3)));
    labs[3].textContent = 'Final'; stats.set('d', k >= 4 ? 'Good' : '…');
    renderWorked();
  }

  function narrate() {
    const m = S.mode, K = S.models.length;
    let nar;
    if (!n()) nar = { title: 'Give me some points!', text: 'Pick a dataset or click on the canvas.' };
    else if (m === 'bias') {
      if (!K) nar = { title: `Bias & variance · tree depth ${S.depth}`, text: 'The dark line is the <b>true</b> curve. Each <b>Step</b> draws a new noisy training set and fits a tree (thin blue). The orange line is their average.' };
      else { const bv = K >= 2 ? biasVar(S.models) : null; nar = { title: `${K} fits of depth ${S.depth}${S.bag ? ' (bagged)' : ''}`, text: bv ? `Bias² ≈ <b>${fx(bv.bias2 ?? 0, 4)}</b>, variance ≈ <b>${fx(bv.variance, 4)}</b>. ${S.depth <= 2 ? 'The fits agree but are too simple: bias dominates.' : S.depth >= 7 ? 'The fits chase the noise and disagree: variance dominates.' : 'A balanced depth.'}` : 'One fit so far — add more to see the spread.' }; }
    } else if (m === 'bagging') nar = !K ? { title: 'Bagging: bootstrap + aggregate', text: 'Each <b>Step</b> trains a deep tree on a bootstrap sample. Hollow points were left out of that sample.' } : { title: `${K} bagged tree${K === 1 ? '' : 's'}`, text: `${reg() ? 'Average' : 'Majority vote'} of the trees. Each tree alone overfits; together their quirks cancel out.` };
    else if (m === 'boosting') nar = !K ? { title: 'Start: predict the mean', text: 'The first “model” is just the average y. Each <b>Step</b> fits a small tree to the <b>residuals</b> (grey sticks) and adds η × that tree.' } : { title: `Round ${K}: F = F + ${fx(S.eta, 2)} · h${K}`, text: `The blue staircase at the bottom is h${K}, fitted to the current residuals. The orange ensemble moves a little towards the points each round.` };
    else nar = !K ? { title: 'Stacking: different learners + a meta-model', text: 'Steps 1–3 train a tree, logistic regression and k-NN. Step 4 trains a logistic meta-model on their out-of-fold probabilities.' } : { title: K < 4 ? `Base model ${K}: ${STACK_NAMES[K - 1]}` : 'Meta-model trained', text: K < 4 ? 'The background shows this model’s prediction. Click a thumbnail to compare.' : 'The meta-model weighs each base model by how useful it was on data it had not seen.' };
    L.narrate({ emoji: '', ...nar }, S.phase);
  }

  function renderWorked() {
    const sc = script();
    const lec = L.lecture;
    L.worked.show(sc);
    if (!sc) return;
    const parts = [];
    if (lec.mode === 'bagging') {
      parts.push(step('Original dataset'));
      parts.push(para('[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] — 3 subsets of size 5, sampled with replacement.'));
      parts.push(table(['Subset', 'Examples', 'Repeats', 'Model predicts'], lec.subsets.map((s, i) => ({
        rowCls: S.k === i + 1 ? 'cur' : S.k > i ? '' : 'dimrow',
        cells: [{ v: `Subset ${i + 1}`, cls: 'rh' }, `[${s.join(', ')}]`, [...new Set(s.filter((v, j) => s.indexOf(v) !== j))].join(', ') || '–', S.k > i ? { v: lec.votes[i], cls: lec.votes[i] === 'Good' ? 'ok' : 'bad' } : '…'],
      }))));
      if (S.k >= 4) parts.push(para('Majority of (Good, Bad, Good) = <b>Good</b>.'));
    } else if (lec.mode === 'boosting') {
      const names = ['A', 'B', 'C', 'D', 'E', 'F'];
      parts.push(table(['Model', 'Correct', 'Incorrect', 'Next focus'], lec.rounds.map((r, i) => ({
        rowCls: S.k === i + 1 ? 'cur' : S.k > i ? '' : 'dimrow',
        cells: [{ v: `Model ${i + 1}`, cls: 'rh' }, names.filter((x) => !r.wrong.includes(x)).join(', '), { v: r.wrong.join(', ') || '–', cls: r.wrong.length ? 'bad' : 'ok' }, r.wrong.join(', ') || 'none left'],
      }))));
      if (S.k >= 4) parts.push(para('New example: Model 1 → Good, Model 2 → Good, Model 3 → Bad. Models 1 and 2 performed better, so they carry more weight → <b>Good</b>.'));
      parts.push(note('The AdaBoost page computes these weights exactly (α = ½ ln((1 − ε)/ε)).', 'info'));
    } else {
      parts.push(table(['Base model', 'Prediction', 'Meta-model trusts it'], [['Decision tree', 'Good', 'usually reliable'], ['Logistic regression', 'Good', 'usually reliable'], ['k-NN', 'Bad', 'sometimes noisy']].map((r, i) => ({
        rowCls: S.k === i + 1 ? 'cur' : S.k > i ? '' : 'dimrow',
        cells: [{ v: r[0], cls: 'rh' }, S.k > i ? { v: r[1], cls: r[1] === 'Good' ? 'ok' : 'bad' } : '…', S.k >= 4 ? r[2] : '…'],
      }))));
      if (S.k >= 4) parts.push(para('Meta-model output: <b>Good</b>. In the free playground (Stacking mode) you can see the real learned weights.'));
    }
    L.worked.set(parts, MODES.find((x) => x.value === lec.mode).label);
  }

  /* ---------------- challenges ---------------- */
  const actions = {
    bv: () => { setMode('bias'); L.focusStage(); finish(); },
    bag: () => { setMode('bias'); S.depth = 10; depthSlider.set(10); S.bag = true; bagToggle.set(true); rerun(); finish(); L.focusStage(); },
    boost: () => { setMode('boosting'); S.bdepth = 1; bdSlider.set(1); S.eta = 0.3; etaSlider.set(0.3); rerun(); L.focusStage(); },
    stack: () => { setMode('stacking'); finish(); L.focusStage(); },
  };

  syncControls();
  L.loadDataset('rsine');
  return () => { clearTimeout(curveTimer); chart.dispose(); L.dispose(); };
}
