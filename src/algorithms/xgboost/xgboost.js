import * as THREE from 'three';
import { statTiles, INK_C } from '../../core/pointlab.js';
import { createSupLab, splitSegment } from '../../core/suplab.js';
import { growTree, sigmoid } from '../../core/trees.js';
import { TreeView } from '../../core/treeview.js';
import { MiniChart } from '../../core/chart.js';
import { h, section, slider, button } from '../../core/ui.js';
import { table, para, step, fmt, fx } from '../../core/worked.js';
import { CLS_SETS } from '../../core/supdata.js';
import { LECTURES, intuitionTab, mathTab, challengesTab } from './content.js';

const TERRA = new THREE.Color(0xe07a5f);
const SLATE = new THREE.Color(0x4f6d8a);
const MUTE = new THREE.Color(0x8a7c6e);

export function mount(root) {
  const S = { T: 40, eta: 0.3, lambda: 1, gamma: 0, depth: 3, trees: [], base: 0, phase: 'ready', sel: -1 };

  const L = createSupLab(root, {
    meta: { accent: '#E07A5F', title: 'XGBoost', emoji: '', category: 'Supervised · Boosting', level: 'Advanced', blurb: 'Gradient boosting with second-order math: every point brings a gradient and a Hessian, and every split is scored by its gain.' },
    clsSets: CLS_SETS.filter((id) => id !== 'cthree'),
    defaultDataset: 'cmoons',
    n: { min: 10, max: 400, step: 10, value: 160 },
    maxPoints: 500,
    interval: 0.55,
    lectures: LECTURES,
    phaseTrack: [
      { id: 'ready', label: 'ŷ = base' },
      { id: 'grow', label: 'g, h → tree → ŷ += η·w', loopBack: true },
      { id: 'done', label: 'Done' },
    ],
    learnTabs: [
      { id: 'intuition', label: 'Intuition', render: intuitionTab },
      { id: 'math', label: '∑ Math', render: mathTab },
      { id: 'try', label: 'Try this', render: () => challengesTab(actions) },
    ],
  });
  const n = () => L.points.length;
  const lec = () => L.lecture;
  const reg = () => L.task === 'reg';
  const name = (i) => L.points[i]?.name || `#${i + 1}`;

  /* ---------------- model ---------------- */
  const F = (x, upto = S.trees.length) => { let s = S.base; for (let t = 0; t < upto; t++) s += S.eta * S.trees[t].b.predict(x); return s; };
  const prob = (x, upto) => sigmoid(F(x, upto));
  function gradHess(upto = S.trees.length) {
    const X = L.X(), y = L.Y();
    const yh = X.map((x) => F(x, upto));
    if (reg()) return { yh, p: null, g: yh.map((v, i) => v - y[i]), h: yh.map(() => 1) };
    const p = yh.map(sigmoid);
    return { yh, p, g: p.map((v, i) => v - y[i]), h: p.map((v) => v * (1 - v)) };
  }
  function addTree() {
    const X = L.X();
    const gh = gradHess();
    const b = growTree(X, { g: gh.g, h: gh.h }, X.map((_, i) => i), { task: 'grad', lambda: S.lambda, gamma: S.gamma, maxDepth: S.depth, nFeatures: L.nFeatures(), record: true, minGain: 0 });
    return { b, gh };
  }
  function loss(upto = S.trees.length) {
    if (!n()) return null;
    const X = L.X(), y = L.Y();
    let s = 0;
    X.forEach((x, i) => {
      if (reg()) s += (F(x, upto) - y[i]) ** 2;
      else { const p = Math.min(Math.max(prob(x, upto), 1e-9), 1 - 1e-9); s += -(y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p)); }
    });
    return s / X.length;
  }

  /* ---------------- flow ---------------- */
  function reset() {
    L.normalizeTask();
    if (L.nClasses > 2) { L.toast('XGBoost here uses the binary logistic loss — loading Moons'); L.loadDataset('cmoons'); return; }
    S.base = reg() && n() ? L.Y().reduce((a, c) => a + c, 0) / n() : 0;
    S.trees = []; S.sel = -1; S.phase = 'ready';
    refresh();
  }
  function doStep() {
    if (!n()) return false;
    if (S.trees.length >= S.T) { S.phase = 'done'; refresh(); return false; }
    S.trees.push(addTree());
    S.phase = S.trees.length >= S.T ? 'done' : 'grow';
    refresh();
    return S.phase !== 'done';
  }
  function finish() {
    L.player.pause();
    if (!n()) return;
    while (S.trees.length < S.T) S.trees.push(addTree());
    S.phase = 'done'; refresh();
  }
  function rerun() {
    const k = S.trees.length;
    S.base = reg() && n() ? L.Y().reduce((a, c) => a + c, 0) / n() : 0;
    S.trees = [];
    if (n()) for (let t = 0; t < Math.min(k, S.T); t++) S.trees.push(addTree());
    if (S.sel >= S.trees.length) S.sel = -1;
    S.phase = !S.trees.length ? 'ready' : S.trees.length >= S.T ? 'done' : 'grow';
    refresh();
  }

  /* ---------------- hooks ---------------- */
  L.hooks.reset = reset;
  L.hooks.step = doStep;
  L.hooks.onEdit = () => rerun();
  L.hooks.canEdit = () => !lec();
  L.hooks.lockedMessage = 'Slide example — load a dataset to draw your own points';
  let lecSettings = false;
  L.hooks.onDatasetSup = () => {
    if (lecSettings) {
      lecSettings = false;
      Object.assign(S, { T: 40, eta: 0.3, lambda: 1, gamma: 0, depth: 3 });
      tSlider.set(S.T); etaSlider.set(S.eta); lamSlider.set(S.lambda); gamSlider.set(S.gamma); dSlider.set(S.depth);
    }
    syncControls();
  };
  L.hooks.onLectureSup = (l) => {
    lecSettings = true;
    const s = l.settings;
    S.T = s.T; S.eta = s.eta; S.lambda = s.lambda; S.gamma = s.gamma; S.depth = s.depth;
    tSlider.set(S.T); etaSlider.set(S.eta); lamSlider.set(S.lambda); gamSlider.set(S.gamma); dSlider.set(S.depth);
    syncControls();
  };

  const curTree = () => (S.sel >= 0 ? S.trees[S.sel] : S.trees[S.trees.length - 1]);
  L.hooks.frameSup = () => {
    const segs = [];
    const tr = S.phase === 'grow' || S.sel >= 0 || lec() ? curTree() : null;
    if (tr) for (const nd of tr.b.nodes) {
      if (nd.leaf) continue;
      const s = splitSegment(L, nd, 0.009);
      s.col = TERRA;
      segs.push(s);
    }
    if (reg() && S.trees.length && n() <= 200 && S.phase !== 'done') for (const p of L.points) {
      const a = L.space.w({ x: p.x, y: p.y }), b = L.space.w({ x: p.x, y: F([p.x]) });
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, w: 0.004, col: MUTE });
    }
    L.segs.sync(segs);
  };
  L.hooks.labels = () => {
    if (!lec()) return null;
    const gh = gradHess();
    return L.points.map((p, i) => ({ x: p.wx, y: p.wy, text: `ŷ ${fx(gh.yh[i], 3)} · p ${fx(gh.p[i], 3)}`, cls: 'tip', dx: -40, dy: p.label ? -50 - (i % 2) * 26 : 16 + (i % 2) * 26 }));
  };

  /* ---------------- controls ---------------- */
  const tSlider = slider({ label: 'Number of trees', min: 1, max: 120, step: 1, value: S.T, onInput: (v) => { S.T = v; rerun(); } });
  const etaSlider = slider({ label: 'Learning rate η', min: 0.05, max: 1, step: 0.05, value: S.eta, format: (v) => v.toFixed(2), onInput: (v) => { S.eta = v; rerun(); } });
  const dSlider = slider({ label: 'Max depth', min: 1, max: 6, step: 1, value: S.depth, onInput: (v) => { S.depth = v; rerun(); } });
  const lamSlider = slider({ label: 'λ — L2 on leaf weights', min: 0, max: 10, step: 0.1, value: S.lambda, format: (v) => v.toFixed(1), onInput: (v) => { S.lambda = v; rerun(); } });
  const gamSlider = slider({ label: 'γ — minimum gain to split', min: 0, max: 3, step: 0.05, value: S.gamma, format: (v) => v.toFixed(2), onInput: (v) => { S.gamma = v; rerun(); } });
  L.addControls(section([L.num(3), 'XGBoost settings'], tSlider.el, etaSlider.el, dSlider.el, lamSlider.el, gamSlider.el,
    h('span', { class: 'hint' }, 'Every slider rebuilds the trees you already have, live.'),
    button('Build all trees', finish, { variant: 'btn-block' })));
  function syncControls() { /* all sliders stay available, even in the lecture */ }

  /* ---------------- side ---------------- */
  const stats = statTiles([['t', 'Trees'], ['loss', 'Train loss'], ['acc', 'Train acc.'], ['gain', 'Root gain']]);
  const labs = stats.el.querySelectorAll('.stat-label');
  const tree = new TreeView({ height: 190, valueText: (nd) => `w ${fmt(nd.value, 3)}` });
  const treeNote = h('div', { class: 'chart-note' });
  const chart = new MiniChart({ height: 120, xLabel: 'trees', empty: 'Press Step' });
  const sel = h('div', { class: 'chips-mini' });
  const card = h('div', { class: 'card side-card' }, h('h3', {}, 'Live numbers'), stats.el,
    h('div', { class: 'sub-label' }, 'Current tree (leaf values w*)'), tree.canvas, treeNote, sel,
    h('div', { class: 'sub-label' }, 'Training loss after each tree'), chart.canvas);
  L.mountSide(card);

  /* ---------------- refresh ---------------- */
  function refresh() {
    const K = S.trees.length;
    const upto = S.sel >= 0 ? S.sel + 1 : K;
    if (L.task === 'cls') { L.setCurves([]); L.showField((x) => { const p = prob(x, upto); return [1 - p, p]; }); }
    else {
      L.showField(null);
      const cs = [];
      if (L.task === 'cls1d') cs.push({ fn: () => 0.5, color: MUTE, width: 0.003, fade: 0.5 });
      const tr = curTree();
      if (tr && L.task === 'reg') cs.push({ fn: (x) => tr.b.predict([x]) * S.eta + (L.lecture ? 0 : -0.85), color: SLATE, width: 0.006, step: true });
      cs.push({ fn: (x) => (reg() ? F([x], upto) : prob([x], upto)), color: TERRA, width: 0.012, step: true });
      L.setCurves(cs);
    }
    // points: size by |g| (how much they still pull)
    L.colorPoints();
    const gh = n() ? gradHess(upto) : null;
    if (gh && !reg()) L.points.forEach((p, i) => { p.sz = 0.6 + 1.6 * Math.abs(gh.g[i]); });

    stats.set('t', `${upto}/${S.T}`);
    const l = loss(upto);
    stats.set('loss', l == null ? '–' : fx(l, 4));
    stats.set('acc', !n() ? '–' : reg() ? fx(l, 4) : `${Math.round(L.accuracy((x) => (prob(x, upto) > 0.5 ? 1 : 0)) * 100)}%`);
    labs[2].textContent = reg() ? 'Train MSE' : 'Train acc.';
    labs[1].textContent = reg() ? 'Loss (MSE)' : 'Log-loss';
    const tr = curTree();
    stats.set('gain', tr && !tr.b.nodes[0].leaf ? fx(tr.b.nodes[0].gain, 3) : '–');
    tree.featureNames = L.task === 'cls' ? ['x', 'y'] : ['x'];
    tree.set(tr?.b || null, { highlight: -1 });
    treeNote.innerHTML = tr ? `Tree ${S.sel >= 0 ? S.sel + 1 : K}: ${tr.b.leaves} leaves, depth ${tr.b.depth}. Each leaf adds η × w* = ${fx(S.eta, 2)} × w* to ŷ.` : 'No tree yet.';
    sel.replaceChildren(...(K > 1 ? S.trees.slice(0, 30).map((_, t) => h('button', { type: 'button', class: 'chip' + (t === S.sel ? ' active' : ''), onclick: () => { S.sel = S.sel === t ? -1 : t; refresh(); } }, `#${t + 1}`)) : []));
    chart.setLine(S.trees.map((_, t) => ({ y: loss(t + 1), color: t === upto - 1 ? '#E07A5F' : null })), { dots: K <= 40, xLabel: 'trees', empty: 'Press Step' });
    narrate(gh);
    renderWorked();
  }

  function narrate(gh) {
    const K = S.trees.length;
    let nar;
    if (!n()) nar = { title: 'Give me some points!', text: 'Pick a dataset or click on the canvas.' };
    else if (!K) nar = reg()
      ? { title: `Start: ŷ = mean(y) = ${fx(S.base, 3)} for every point`, text: 'For squared error, g = ŷ − y (the negative residual) and h = 1. Press <b>Step</b> to grow the first tree on them.' }
      : { title: 'Start: ŷ = 0 → p = 0.5 for every point', text: 'With logistic loss, g = p − y and h = p(1 − p). At p = 0.5 every point has |g| = 0.5 and h = 0.25. Press <b>Step</b> to grow the first tree.' };
    else {
      const tr = S.trees[K - 1];
      const r = tr.b.nodes[0];
      nar = { title: `Tree ${K}: ${r.leaf ? 'no split beats γ — a single leaf' : `first split gain ${fx(r.gain, 3)}`}, ${tr.b.leaves} leaves`, text: `Leaf values w* = −G/(H + λ) range from ${fx(Math.min(...tr.b.nodes.filter((x) => x.leaf).map((x) => x.value)), 3)} to ${fx(Math.max(...tr.b.nodes.filter((x) => x.leaf).map((x) => x.value)), 3)}. ${reg() ? 'Grey sticks are the remaining residuals.' : 'Bigger points have larger |g| — they are still badly predicted.'} Loss is now <b>${fx(loss(), 4)}</b>.` };
      if (lec() && K === 1) nar = { title: 'Split x < 5: gain 0.667 → keep it; w = ±0.667', text: 'ŷ becomes 0.667 for S1, S2 and −0.667 for S3, S4, so p = 0.661 and 0.339 — the first tree moved every prediction in the right direction.' };
    }
    L.narrate({ emoji: '', ...nar }, S.phase);
  }

  function renderWorked() {
    const N = n();
    const show = lec() || (N > 0 && N <= 12);
    L.worked.show(!!show);
    if (!show) return;
    const parts = [];
    const K = S.trees.length;
    const tr = S.trees[S.sel >= 0 ? S.sel : K - 1];
    const gh0 = tr ? tr.gh : gradHess();
    parts.push(step(tr ? `Before tree ${S.sel >= 0 ? S.sel + 1 : K}: gradients and Hessians` : 'Gradients and Hessians'));
    parts.push(table(['Sample', 'x', 'y', 'ŷ', reg() ? '' : 'p', 'g', 'h'].filter(Boolean), L.points.map((p, i) => [
      { v: name(i), cls: 'rh' }, fmt(L.feat(p)[0], 2), reg() ? fmt(p.y, 2) : p.label, fx(gh0.yh[i], 3), ...(reg() ? [] : [fx(gh0.p[i], 3)]), fx(gh0.g[i], 3), fx(gh0.h[i], 3),
    ])));
    if (!tr) { parts.push(para('Press <b>Step</b> to search the splits.')); L.worked.set(parts, `λ ${fmt(S.lambda, 2)} · γ ${fmt(S.gamma, 2)}`); return; }
    const root = tr.b.nodes[0];
    const sr = root.search;
    if (sr) {
      const c0 = sr.cands.flatMap((fc) => fc.cands.map((c) => ({ ...c, f: fc.feature })));
      parts.push(step('Split search at the root (λ = ' + fmt(S.lambda, 2) + ', γ = ' + fmt(S.gamma, 2) + ')'));
      parts.push(table(['Split', 'G_L', 'H_L', 'G_R', 'H_R', 'Gain'], c0.map((c) => ({
        rowCls: !root.leaf && c.f === root.feature && Math.abs(c.thr - root.thr) < 1e-9 ? 'cur' : '',
        cells: [{ v: `${L.task === 'cls' ? ['x', 'y'][c.f] : 'x'} < ${fmt(c.thr, 2)}`, cls: 'rh' }, fx(c.left.G, 3), fx(c.left.H, 3), fx(c.right.G, 3), fx(c.right.H, 3), { v: fx(c.gain, 3), cls: c.gain > 0 ? 'ok' : 'bad' }],
      }))));
      const P0 = sr.parent;
      parts.push(para(`Whole node: G = ${fx(P0.G, 3)}, H = ${fx(P0.H, 3)}. Gain = ½ [G<sub>L</sub>²/(H<sub>L</sub>+λ) + G<sub>R</sub>²/(H<sub>R</sub>+λ) − G²/(H+λ)] − γ.`));
    }
    if (!root.leaf) {
      const Lf = tr.b.nodes[root.left], Rf = tr.b.nodes[root.right];
      parts.push(para(`Best: <b>${L.task === 'cls' ? ['x', 'y'][root.feature] : 'x'} &lt; ${fmt(root.thr, 2)}</b>, gain <b>${fx(root.gain, 3)}</b> &gt; 0 → keep. Leaf weights: w<sub>L</sub> = −(${fx(Lf.stats.G, 3)})/(${fx(Lf.stats.H, 3)} + ${fmt(S.lambda, 2)}) = <b>${fx(Lf.value, 3)}</b>, w<sub>R</sub> = −(${fx(Rf.stats.G, 3)})/(${fx(Rf.stats.H, 3)} + ${fmt(S.lambda, 2)}) = <b>${fx(Rf.value, 3)}</b>${tr.b.depth > 1 ? ' (before deeper splits)' : ''}.`));
    } else parts.push(para(`No split has positive gain → the tree is a single leaf with w = ${fx(root.value, 3)}.`));
    const after = gradHess(S.sel >= 0 ? S.sel + 1 : K);
    parts.push(step('Updated predictions'));
    parts.push(table(['Sample', 'ŷ old', `+ η·w (η = ${fmt(S.eta, 2)})`, 'ŷ new', reg() ? 'y' : 'p new'], L.points.map((p, i) => [
      { v: name(i), cls: 'rh' }, fx(gh0.yh[i], 3), fx(after.yh[i] - gh0.yh[i], 3), fx(after.yh[i], 3), reg() ? fmt(p.y, 2) : fx(after.p[i], 3),
    ])));
    L.worked.set(parts, `λ ${fmt(S.lambda, 2)} · γ ${fmt(S.gamma, 2)}`);
  }

  /* ---------------- challenges ---------------- */
  const actions = {
    lec: () => { L.loadLecture(LECTURES[0]); doStep(); L.focusStage(); },
    moons: () => { L.loadDataset('cmoons'); S.depth = 4; dSlider.set(4); S.T = 30; tSlider.set(30); finish(); L.focusStage(); },
    spiral: () => { L.loadDataset('cspiral'); S.T = 60; tSlider.set(60); S.eta = 1; etaSlider.set(1); S.depth = 4; dSlider.set(4); finish(); L.focusStage(); },
  };

  L.loadDataset('cmoons');
  return () => { tree.dispose(); chart.dispose(); L.dispose(); };
}
