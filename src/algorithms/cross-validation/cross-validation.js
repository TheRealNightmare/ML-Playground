import * as THREE from 'three';
import { statTiles, COLORS, INK_C } from '../../core/pointlab.js';
import { createSupLab } from '../../core/suplab.js';
import { growTree, argmax, rng } from '../../core/trees.js';
import { knn } from '../../core/models.js';
import { MiniChart } from '../../core/chart.js';
import { h, section, slider, segmented, button } from '../../core/ui.js';
import { table, note, para, step, fx } from '../../core/worked.js';
import { css, PALETTE } from '../../core/theme.js';
import { LECTURES, intuitionTab, mathTab, challengesTab } from './content.js';

const FOLD_COLORS = [2, 4, 5, 3, 6, 7].map((k) => PALETTE[k]);
const foldColor = (f) => new THREE.Color(FOLD_COLORS[f % FOLD_COLORS.length]);
const METHODS = [
  { value: 'holdout', label: 'Holdout' },
  { value: 'kfold', label: 'K-fold' },
  { value: 'loocv', label: 'LOOCV' },
  { value: 'stratified', label: 'Stratified' },
];

export function mount(root) {
  const S = { method: 'kfold', K: 5, test: 0.2, model: 'knn', k: 7, depth: 4, seed: 1, folds: [], rounds: [], phase: 'ready', repeat: null, cur: -1 };

  const L = createSupLab(root, {
    meta: { accent: '#3D8B8B', title: 'Cross-Validation', emoji: '', category: 'Concepts · Evaluation', level: 'Beginner', blurb: 'Hide part of the data, train on the rest, test on the hidden part — and repeat, so the score is honest.' },
    tasks: ['cls'],
    defaultDataset: 'cnoisy',
    n: { min: 10, max: 400, step: 10, value: 120 },
    maxPoints: 500,
    interval: 0.75,
    lectures: LECTURES,
    phaseTrack: [
      { id: 'ready', label: 'Split into folds' },
      { id: 'grow', label: 'Train on K−1, test on 1', loopBack: true },
      { id: 'done', label: 'Average' },
    ],
    learnTabs: [
      { id: 'intuition', label: 'Intuition', render: intuitionTab },
      { id: 'math', label: '∑ Math', render: mathTab },
      { id: 'try', label: 'Try this', render: () => challengesTab(actions) },
    ],
  });
  const n = () => L.points.length;
  const lec = () => L.lecture;
  const script = () => !!lec()?.script;
  const name = (i) => L.points[i]?.name || `#${i + 1}`;

  /* ---------------- folds ---------------- */
  const nFolds = () => (script() ? lec().K : S.method === 'holdout' ? 2 : S.method === 'loocv' ? n() : S.K);
  const nRounds = () => (script() ? lec().K : S.method === 'holdout' ? 1 : nFolds());
  function makeFolds() {
    if (script()) { S.folds = lec().folds.slice(); return; }
    const r = rng(S.seed * 7717 + n());
    const order = L.points.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const f = new Array(n()).fill(0);
    const N = n();
    if (S.method === 'holdout') { const nt = Math.max(1, Math.round(N * S.test)); order.forEach((i, j) => { f[i] = j < nt ? 0 : 1; }); }
    else if (S.method === 'loocv') order.forEach((i, j) => { f[i] = j; });
    else if (S.method === 'kfold') order.forEach((i, j) => { f[i] = Math.floor((j * S.K) / N); });
    else {
      let c = 0;
      for (let k = 0; k < L.nClasses; k++) order.filter((i) => L.points[i].label === k).forEach((i) => { f[i] = c % S.K; c++; });
    }
    S.folds = f;
  }

  function train(idx) {
    const X = idx.map((i) => L.feat(L.points[i])), y = idx.map((i) => L.points[i].label);
    if (!X.length) return () => new Array(L.nClasses).fill(1 / L.nClasses);
    if (S.model === 'knn') { const m = knn(X, y, { k: S.k, nClasses: L.nClasses }); return (x) => m.probs(x); }
    const b = growTree(X, { y }, X.map((_, i) => i), { task: 'cls', criterion: 'gini', nClasses: L.nClasses, maxDepth: S.depth, nFeatures: 2 });
    return (x) => b.predict(x);
  }
  function runRound(r) {
    const testIdx = [], trainIdx = [];
    S.folds.forEach((f, i) => (f === r ? testIdx : trainIdx).push(i));
    if (script()) return { r, testIdx, trainIdx };
    const model = train(trainIdx);
    const ok = testIdx.filter((i) => argmax(model(L.feat(L.points[i]))) === L.points[i].label).length;
    const trainOk = trainIdx.filter((i) => argmax(model(L.feat(L.points[i]))) === L.points[i].label).length;
    return { r, testIdx, trainIdx, model, acc: testIdx.length ? ok / testIdx.length : 0, trainAcc: trainIdx.length ? trainOk / trainIdx.length : 0 };
  }
  const meanStd = (a) => { const m = a.reduce((s, v) => s + v, 0) / (a.length || 1); const s = a.length > 1 ? Math.sqrt(a.reduce((t, v) => t + (v - m) ** 2, 0) / (a.length - 1)) : 0; return { m, s }; };

  /* ---------------- flow ---------------- */
  function reset() {
    L.normalizeTask();
    S.rounds = []; S.phase = 'ready'; S.repeat = null; S.cur = -1;
    if (n()) makeFolds(); else S.folds = [];
    refresh();
  }
  function doStep() {
    if (!n()) return false;
    if (S.rounds.length >= nRounds()) { S.phase = 'done'; S.cur = -1; refresh(); return false; }
    S.rounds.push(runRound(S.rounds.length));
    S.cur = S.rounds.length - 1;
    S.phase = S.rounds.length >= nRounds() ? 'done' : 'grow';
    refresh();
    return S.phase !== 'done';
  }
  function finish() {
    L.player.pause();
    if (!n()) return;
    while (S.rounds.length < nRounds()) S.rounds.push(runRound(S.rounds.length));
    S.phase = 'done'; S.cur = -1; refresh();
  }
  function rerun() {
    const k = S.rounds.length;
    reset();
    if (!n()) return;
    for (let r = 0; r < Math.min(k, nRounds()); r++) S.rounds.push(runRound(r));
    S.cur = S.rounds.length && S.rounds.length < nRounds() ? S.rounds.length - 1 : -1;
    S.phase = !S.rounds.length ? 'ready' : S.rounds.length >= nRounds() ? 'done' : 'grow';
    refresh();
  }
  function repeatHoldout() {
    if (!n()) return;
    setMethod('holdout', false);
    const scores = [];
    const keep = S.seed;
    for (let t = 0; t < 40; t++) { S.seed = 1000 + t + keep * 50; makeFolds(); scores.push(runRound(0).acc); }
    S.seed = keep; makeFolds();
    S.rounds = [runRound(0)]; S.cur = -1; S.phase = 'done';
    S.repeat = scores;
    refresh();
  }
  function setMethod(m, run = true) {
    S.method = m; methodSeg.set(m); syncControls();
    if (m === 'loocv' && n() > 80) L.toast('LOOCV trains one model per point — try fewer points for a quick run');
    if (run) rerun();
  }

  /* ---------------- hooks ---------------- */
  L.hooks.reset = reset;
  L.hooks.step = doStep;
  L.hooks.onEdit = () => rerun();
  L.hooks.canEdit = () => !script();
  L.hooks.lockedMessage = 'Lecture example — load a dataset to draw your own points';
  L.hooks.onDatasetSup = () => syncControls();
  L.hooks.onLectureSup = (l) => { S.method = l.method; methodSeg.set(l.method); L.space.setIdentity(); L.axes.setVisible(false); syncControls(); };

  L.hooks.labels = () => {
    if (!script()) return null;
    const out = [];
    const l = lec();
    for (let f = 0; f < l.K; f++) {
      const idx = S.folds.map((v, i) => (v === f ? i : -1)).filter((i) => i >= 0);
      if (l.method === 'stratified') continue;
      const p = L.points[idx[0]];
      out.push({ x: p.wx, y: p.wy, text: l.method === 'loocv' ? `Round ${f + 1}` : `Fold ${f + 1}`, cls: S.cur === f ? 'tip' : '', dx: -8, dy: -54 });
    }
    if (l.method === 'stratified') {
      for (let f = 0; f < l.K; f++) {
        const show = S.cur === f || S.phase === 'done';
        const idx = S.folds.map((v, i) => (v === f ? i : -1)).filter((i) => i >= 0);
        if (show) idx.forEach((i) => { const p = L.points[i]; out.push({ x: p.wx, y: p.wy, text: `F${f + 1}`, cls: S.cur === f ? 'tip' : '', dx: -8, dy: 14 }); });
      }
    }
    return out;
  };

  /* ---------------- controls ---------------- */
  const methodSeg = segmented({ label: 'Method', options: METHODS, value: S.method, wrap: true, onChange: (v) => setMethod(v) });
  const kSlider = slider({ label: 'K (number of folds)', min: 2, max: 10, step: 1, value: S.K, onInput: (v) => { S.K = v; rerun(); } });
  const testSlider = slider({ label: 'Test share', min: 0.1, max: 0.5, step: 0.05, value: S.test, format: (v) => `${Math.round(v * 100)}%`, onInput: (v) => { S.test = v; rerun(); } });
  const modelSeg = segmented({ label: 'Model being evaluated', options: [{ value: 'knn', label: 'k-NN' }, { value: 'tree', label: 'Decision tree' }], value: S.model, onChange: (v) => { S.model = v; syncControls(); rerun(); } });
  const knnSlider = slider({ label: 'k (neighbours)', min: 1, max: 41, step: 2, value: S.k, onInput: (v) => { S.k = v; rerun(); } });
  const depthSlider = slider({ label: 'Tree depth', min: 1, max: 12, step: 1, value: S.depth, onInput: (v) => { S.depth = v; rerun(); } });
  const repeatBtn = button('Repeat holdout 40× (new random splits)', repeatHoldout, { variant: 'btn-ghost btn-block' });
  const lockHint = h('span', { class: 'hint' }, 'Lecture example: press Step to go through the rounds.');
  L.addControls(
    section([L.num(3), 'Validation'], methodSeg.el, kSlider.el, testSlider.el, lockHint,
      h('div', { class: 'btn-row' }, button('Run all rounds', finish, { variant: 'btn-block' }), button('Reshuffle', () => { S.seed++; rerun(); }, { variant: 'btn-ghost btn-block' })),
      repeatBtn),
    section([L.num(4), 'Model'], modelSeg.el, knnSlider.el, depthSlider.el),
  );
  const modelSection = modelSeg.el.closest('section');
  function syncControls() {
    const sc = script();
    const show = (el, v) => { el.style.display = v ? '' : 'none'; };
    show(kSlider.el, !sc && (S.method === 'kfold' || S.method === 'stratified'));
    show(testSlider.el, !sc && S.method === 'holdout');
    show(repeatBtn, !sc && S.method === 'holdout');
    show(lockHint, sc);
    show(modelSection, !sc);
    show(knnSlider.el, S.model === 'knn');
    show(depthSlider.el, S.model === 'tree');
  }

  /* ---------------- side ---------------- */
  const stats = statTiles([['round', 'Round'], ['acc', 'Test acc.'], ['mean', 'Mean'], ['std', '± Std']]);
  const labs = stats.el.querySelectorAll('.stat-label');
  const chart = new MiniChart({ height: 130, xLabel: 'fold', empty: 'Press Step' });
  const chartLabel = h('div', { class: 'sub-label' }, 'Score per fold');
  const chartNote = h('div', { class: 'chart-note' });
  const foldBox = h('div', {});
  L.mountSide(h('div', { class: 'card side-card' }, h('h3', {}, 'Live numbers'), stats.el, chartLabel, chart.canvas, chartNote, h('div', { class: 'sub-label' }, 'Folds'), foldBox));

  /* ---------------- refresh ---------------- */
  function refresh() {
    syncControls();
    const R = S.rounds.length;
    const cur = S.cur >= 0 ? S.rounds[S.cur] : null;
    // canvas
    L.setCurves([]);
    L.showField(cur?.model ? (x) => cur.model(x) : null, { strength: 0.85 });
    L.colorPoints();
    const testSet = new Set(cur?.testIdx || []);
    L.points.forEach((p, i) => {
      const f = S.folds[i];
      if (script() && lec().method !== 'stratified') p.tc = COLORS[5];
      if (cur) {
        if (testSet.has(i)) { p.oc = INK_C; p.fr = 0.55; p.sz = 1.45; }
        else { p.oc = null; p.fr = 0.74; p.sz = 0.85; }
      } else if (f != null && nFolds() <= 12) { p.oc = foldColor(f); p.fr = 0.55; p.sz = 1.05; }
      else { p.sz = 1; }
    });

    // stats + chart
    const accs = S.rounds.filter((r) => r.acc != null).map((r) => r.acc);
    const ms = meanStd(accs);
    stats.set('round', `${R}/${nRounds()}`);
    if (script()) {
      labs[1].textContent = 'Test size'; stats.set('acc', cur ? String(cur.testIdx.length) : '–');
      labs[2].textContent = 'Train size'; stats.set('mean', cur ? String(cur.trainIdx.length) : '–');
      labs[3].textContent = 'Folds'; stats.set('std', String(lec().K));
      chartLabel.style.display = chart.canvas.style.display = chartNote.style.display = 'none';
    } else {
      chartLabel.style.display = chart.canvas.style.display = chartNote.style.display = '';
      labs[1].textContent = 'This fold'; stats.set('acc', cur ? `${Math.round(cur.acc * 100)}%` : '–');
      labs[2].textContent = 'Mean'; stats.set('mean', accs.length ? `${fx(ms.m * 100, 1)}%` : '–');
      labs[3].textContent = '± Std'; stats.set('std', accs.length > 1 ? `${fx(ms.s * 100, 1)}` : '–');
      if (S.repeat) {
        chartLabel.textContent = '40 random holdout splits — histogram of test accuracy';
        const bins = Array.from({ length: 11 }, (_, b) => ({ label: `${50 + b * 5}`, value: 0, color: '#3D8B8B' }));
        S.repeat.forEach((a) => { const b = Math.max(0, Math.min(10, Math.floor((a * 100 - 50) / 5))); bins[b].value++; });
        chart.setBars(bins, { xLabel: 'test accuracy (%) — bin start', empty: '' });
        const rm = meanStd(S.repeat);
        chartNote.innerHTML = `Same data, same model — only the split changed. Scores range from <b>${Math.round(Math.min(...S.repeat) * 100)}%</b> to <b>${Math.round(Math.max(...S.repeat) * 100)}%</b> (mean ${fx(rm.m * 100, 1)}%, std ${fx(rm.s * 100, 1)}).`;
      } else if (S.method === 'loocv' && n() > 30) {
        chartLabel.textContent = 'Running mean accuracy (LOOCV)';
        let s = 0;
        chart.setLine(accs.map((a, i) => ({ y: (s += a) / (i + 1) })), { xLabel: 'points left out so far', dots: false, empty: 'Press Step' });
        chartNote.innerHTML = 'Each LOOCV round scores 0% or 100% (one test point). Only the running average means something.';
      } else {
        chartLabel.textContent = 'Test accuracy per round';
        chart.setBars(S.rounds.map((r, i) => ({ label: S.method === 'holdout' ? 'test' : String(i + 1), value: r.acc, color: css(FOLD_COLORS[i % FOLD_COLORS.length]), highlight: i === S.cur })), { xLabel: S.method === 'holdout' ? 'holdout split' : 'fold', empty: 'Press Step', ref: accs.length > 1 ? { y: ms.m, label: `mean ${fx(ms.m * 100, 1)}%` } : null });
        const tr = S.rounds.length ? meanStd(S.rounds.map((r) => r.trainAcc)).m : null;
        chartNote.innerHTML = tr != null ? `Average <b>training</b> accuracy: ${fx(tr * 100, 1)}% vs. test ${fx(ms.m * 100, 1)}%. The gap is what a train-only score would hide.` : 'Each bar will be one fold’s test accuracy.';
      }
    }

    // fold table
    if (n() && nFolds() <= 12) {
      const K = nFolds();
      const rows = Array.from({ length: K }, (_, f) => {
        const idx = S.folds.map((v, i) => (v === f ? i : -1)).filter((i) => i >= 0);
        const counts = Array.from({ length: L.nClasses }, (_, c) => idx.filter((i) => L.points[i].label === c).length);
        const r = S.rounds[f];
        const lbl = S.method === 'holdout' && !script() ? (f === 0 ? 'Test' : 'Train') : `Fold ${f + 1}`;
        const cells = [{ v: h('span', {}, h('span', { class: 'cls-dot', style: { background: css(FOLD_COLORS[f % FOLD_COLORS.length]) } }), lbl), cls: 'rh' }, idx.length];
        if (!script() || lec().method === 'stratified') counts.forEach((c) => cells.push(c));
        if (!script()) cells.push(r && S.method !== 'holdout' ? `${Math.round(r.acc * 100)}%` : f === 0 && r ? `${Math.round(r.acc * 100)}%` : '–');
        return { rowCls: S.cur === f ? 'cur' : '', cells };
      });
      const names = L.lecture?.classNames || ['A', 'B', 'C'];
      const head = ['', 'Size', ...(!script() || lec().method === 'stratified' ? Array.from({ length: L.nClasses }, (_, c) => names[c] || `C${c + 1}`) : []), ...(!script() ? ['Acc.'] : [])];
      foldBox.replaceChildren(table(head, rows));
    } else foldBox.replaceChildren(h('div', { class: 'chart-note' }, n() ? `${nFolds()} folds — too many to list (LOOCV uses one fold per point).` : ''));

    narrate(ms);
    renderWorked();
  }

  function narrate(ms) {
    const R = S.rounds.length;
    let nar;
    if (script()) {
      const l = lec();
      const cur = S.cur >= 0 ? S.rounds[S.cur] : null;
      if (!R) nar = { title: { kfold: '15 points → 3 folds of 5', loocv: '5 points → 5 rounds', stratified: '12 samples, ratio 9 : 3 = 3 : 1' }[l.method], text: { kfold: 'Fold 1 = points 1–5, Fold 2 = 6–10, Fold 3 = 11–15. Press <b>Step</b> for round 1.', loocv: 'Each round leaves exactly one point out as the test set and trains on the other four.', stratified: 'Each fold gets 4 samples. To keep the 3 : 1 ratio, every fold needs 3 of Class 1 and 1 of Class 2.' }[l.method] };
      else if (S.phase === 'done' && !cur) nar = { title: 'Final score = average of the round scores', text: l.method === 'stratified' ? 'All three folds have exactly 3 Class 1 + 1 Class 2. Compare with plain sequential folds in the worked card: one of them would get <b>all three</b> Class 2 samples.' : 'Every point was tested exactly once and used for training in all the other rounds.' };
      else {
        const tn = cur.testIdx.map(name).join(', '), trn = cur.trainIdx.map(name).join(', ');
        nar = { title: `Round ${cur.r + 1}: test on ${l.method === 'loocv' ? name(cur.testIdx[0]) : `fold ${cur.r + 1}`}`, text: `Train on <b>${trn}</b> — test on <b>${tn}</b>.` };
      }
    } else if (!n()) nar = { title: 'Give me some points!', text: 'Pick a dataset, or choose a class and click on the canvas.' };
    else if (S.phase === 'ready') nar = { title: `${METHODS.find((m) => m.value === S.method).label}: ${S.method === 'holdout' ? `${Math.round((1 - S.test) * 100)}% train / ${Math.round(S.test * 100)}% test` : `${nFolds()} folds`}`, text: nFolds() <= 12 ? 'The coloured rings show which fold each point is in. Each <b>Step</b> trains on all folds but one and tests on the one left out.' : 'Each <b>Step</b> leaves one point out, trains on the rest and tests on it.' };
    else if (S.repeat) nar = { title: `40 holdout splits: ${fx(meanStd(S.repeat).m * 100, 1)}% ± ${fx(meanStd(S.repeat).s * 100, 1)}`, text: 'One holdout split is just one draw from this histogram. K-fold averages several splits to get a steadier number.' };
    else if (S.phase === 'done') nar = { title: `CV accuracy = ${fx(ms.m * 100, 1)}% ± ${fx(ms.s * 100, 1)}`, text: `Average of ${R} round${R === 1 ? '' : 's'}. This is the honest estimate of how the ${S.model === 'knn' ? `k-NN (k = ${S.k})` : `tree (depth ${S.depth})`} will do on new data.` };
    else { const c = S.rounds[S.cur]; nar = { title: `Round ${c.r + 1}: train on ${c.trainIdx.length}, test on ${c.testIdx.length}`, text: `Test accuracy <b>${Math.round(c.acc * 100)}%</b> (training accuracy ${Math.round(c.trainAcc * 100)}%). The background is this round’s model; big ringed points are the hidden test fold.` }; }
    L.narrate({ emoji: '', ...nar }, S.phase);
  }

  function renderWorked() {
    const sc = script();
    L.worked.show(sc || (n() > 0 && n() <= 12));
    if (!sc && !(n() > 0 && n() <= 12)) return;
    const parts = [];
    const K = nRounds();
    parts.push(step('Rounds'));
    parts.push(table(['Round', 'Train on', 'Test on', ...(sc ? [] : ['Acc.'])], Array.from({ length: K }, (_, r) => {
      const testIdx = [], trainIdx = [];
      S.folds.forEach((f, i) => (f === r ? testIdx : trainIdx).push(i));
      const done = r < S.rounds.length;
      const compact = (ids) => {
        const nm = ids.map(name);
        if (nm.every((x) => /^\d+$/.test(x))) {
          const nums = nm.map(Number), parts = [];
          let a = nums[0], b = nums[0];
          for (let j = 1; j <= nums.length; j++) {
            if (nums[j] === b + 1) { b = nums[j]; continue; }
            parts.push(b - a >= 2 ? `${a}–${b}` : a === b ? `${a}` : `${a}, ${b}`);
            a = b = nums[j];
          }
          const s = parts.join(', ');
          if (s.length <= 28) return s;
        }
        return ids.length > 8 ? `${ids.length} points` : nm.join(', ');
      };
      return { rowCls: S.cur === r ? 'cur' : done ? '' : 'dimrow', cells: [{ v: String(r + 1), cls: 'rh' }, compact(trainIdx), compact(testIdx), ...(sc ? [] : [done ? `${Math.round(S.rounds[r].acc * 100)}%` : '…'])] };
    })));
    if (sc && lec().method === 'stratified') {
      parts.push(step('Without stratification (sequential folds)'));
      const pf = lec().plainFolds;
      parts.push(table(['Fold', 'Samples', 'Class 1', 'Class 2'], [0, 1, 2].map((f) => {
        const idx = pf.map((v, i) => (v === f ? i : -1)).filter((i) => i >= 0);
        const c1 = idx.filter((i) => L.points[i].label === 1).length;
        return [{ v: `Fold ${f + 1}`, cls: 'rh' }, idx.map(name).join(', '), c1, { v: String(idx.length - c1), cls: idx.length - c1 === 3 ? 'bad' : '' }];
      })));
      parts.push(note('Plain K-fold on the sorted data puts all three Class 2 samples in fold 3 — fold 1 and 2 would test without a single Class 2 example. Stratified folds (canvas) keep 3 : 1 everywhere.', 'info'));
    }
    if (S.phase === 'done' && !sc) parts.push(para(`Final score = mean of the ${K} round scores.`));
    L.worked.set(parts, sc ? METHODS.find((m) => m.value === lec().method).label : '');
  }

  /* ---------------- challenges ---------------- */
  const actions = {
    repeat: () => { L.loadDataset('cnoisy'); repeatHoldout(); L.focusStage(); },
    imbal: () => { L.n = 60; L.loadDataset('cimbal'); setMethod('kfold'); L.focusStage(); },
    knn: () => { L.loadDataset('cmoons'); S.model = 'knn'; modelSeg.set('knn'); S.K = 5; kSlider.set(5); setMethod('kfold', false); finish(); L.focusStage(); },
    loo: () => { L.n = 30; L.loadDataset('cblobs'); setMethod('loocv', false); finish(); L.focusStage(); },
  };

  syncControls();
  L.loadDataset('cnoisy');
  return () => { chart.dispose(); L.dispose(); };
}
