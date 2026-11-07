import * as THREE from 'three';
import { statTiles, COLORS, INK_C } from '../../core/pointlab.js';
import { createSupLab, splitSegment } from '../../core/suplab.js';
import { TreeBuilder, argmax, sigmoid } from '../../core/trees.js';
import { MiniChart } from '../../core/chart.js';
import { ModelThumbs, paintCls } from '../../core/thumbs.js';
import { h, section, slider, button } from '../../core/ui.js';
import { table, note, para, step, fmt, fx } from '../../core/worked.js';
import { CLS_SETS } from '../../core/supdata.js';
import { LECTURES, intuitionTab, mathTab, challengesTab } from './content.js';

const TERRA = new THREE.Color(0xe07a5f);
const SLATE = new THREE.Color(0x4f6d8a);
const MUTE = new THREE.Color(0x8a7c6e);

export function mount(root) {
  const S = { T: 50, depth: 1, w: [], learners: [], phase: 'ready', sel: -1, hist: [] };

  const L = createSupLab(root, {
    meta: { accent: '#D4A24C', title: 'AdaBoost', emoji: '', category: 'Supervised · Boosting', level: 'Intermediate', blurb: 'Train tiny decision stumps one after another. Points a stump gets wrong grow heavier, so the next stump has to fix them.' },
    tasks: ['cls'],
    clsSets: CLS_SETS.filter((id) => id !== 'cthree'),
    defaultDataset: 'ccircles',
    n: { min: 10, max: 400, step: 10, value: 150 },
    maxPoints: 500,
    interval: 0.5,
    lectures: LECTURES,
    phaseTrack: [
      { id: 'ready', label: 'Equal weights' },
      { id: 'grow', label: 'Stump → ε → α → re-weight', loopBack: true },
      { id: 'done', label: 'Weighted vote' },
    ],
    learnTabs: [
      { id: 'intuition', label: 'Intuition', render: intuitionTab },
      { id: 'math', label: '∑ Math', render: mathTab },
      { id: 'try', label: 'Try this', render: () => challengesTab(actions) },
    ],
  });
  const n = () => L.points.length;
  const lec = () => L.lecture;
  const nT = () => (lec() ? lec().learners.length : S.T);
  const pm = (c) => (c ? 1 : -1);
  const name = (i) => L.points[i]?.name || `#${i + 1}`;

  /* ---------------- learners ---------------- */
  // A learner: { h(x) → ±1, eps, alpha, wrong[], before[], after[], stump? }
  function lectureH(lr) {
    return (x) => {
      const v = x[0];
      if (lr.cuts.length === 1) return pm(v < lr.cuts[0] ? lr.left : 1 - lr.left);
      return pm(v > lr.cuts[0] && v < lr.cuts[1] ? 1 - lr.left : lr.left);
    };
  }
  function fitLearner(t) {
    const before = S.w.slice();
    let hfn, stump = null, preds;
    if (lec()) {
      const lr = lec().learners[t];
      preds = lr.preds.map(pm);
      hfn = lectureH(lr);
    } else {
      const X = L.X(), y = L.Y();
      stump = new TreeBuilder(X, { y, w: S.w }, X.map((_, i) => i), { task: 'cls', criterion: 'gini', nClasses: 2, maxDepth: S.depth, nFeatures: 2 }).growAll();
      hfn = (x) => pm(argmax(stump.predict(x)));
      preds = X.map(hfn);
    }
    const wrong = [];
    let eps = 0;
    L.points.forEach((p, i) => { if (preds[i] !== pm(p.label)) { wrong.push(i); eps += S.w[i]; } });
    const e = Math.min(Math.max(eps, 1e-6), 1 - 1e-6);
    const alpha = 0.5 * Math.log((1 - e) / e);
    const raw = S.w.map((w, i) => w * Math.exp(-alpha * pm(L.points[i].label) * preds[i]));
    const Z = raw.reduce((a, c) => a + c, 0);
    S.w = raw.map((w) => w / Z);
    return { h: hfn, stump, preds, eps, alpha, wrong, before, raw, Z, after: S.w.slice() };
  }
  const F = (x, upto = S.learners.length) => { let s = 0; for (let t = 0; t < upto; t++) s += S.learners[t].alpha * S.learners[t].h(x); return s; };
  const sumAlpha = (upto = S.learners.length) => S.learners.slice(0, upto).reduce((s, l) => s + Math.abs(l.alpha), 0) || 1;

  /* ---------------- flow ---------------- */
  function reset() {
    L.normalizeTask();
    if (L.nClasses > 2) { L.toast('AdaBoost here is binary — loading Circles'); L.loadDataset('ccircles'); return; }
    S.w = L.points.map(() => 1 / (n() || 1));
    S.learners = []; S.sel = -1; S.phase = 'ready';
    refresh();
  }
  function doStep() {
    if (!n()) return false;
    if (S.learners.length >= nT()) { S.phase = 'done'; refresh(); return false; }
    const l = fitLearner(S.learners.length);
    S.learners.push(l);
    S.phase = S.learners.length >= nT() || (!lec() && l.eps < 1e-9) ? 'done' : 'grow';
    if (!lec() && l.eps < 1e-9) L.toast('A perfect stump: ε = 0, nothing left to fix');
    refresh();
    return S.phase !== 'done';
  }
  function finish() {
    L.player.pause();
    if (!n()) return;
    while (S.learners.length < nT()) { const l = fitLearner(S.learners.length); S.learners.push(l); if (!lec() && l.eps < 1e-9) break; }
    S.phase = 'done'; refresh();
  }
  function rerun() {
    const k = S.learners.length;
    S.w = L.points.map(() => 1 / (n() || 1));
    S.learners = [];
    for (let t = 0; t < Math.min(k, nT()); t++) S.learners.push(fitLearner(t));
    if (S.sel >= S.learners.length) S.sel = -1;
    S.phase = !S.learners.length ? 'ready' : S.learners.length >= nT() ? 'done' : 'grow';
    refresh();
  }

  /* ---------------- hooks ---------------- */
  L.hooks.reset = reset;
  L.hooks.step = doStep;
  L.hooks.onEdit = () => { thumbVer++; rerun(); };
  L.hooks.canEdit = () => !lec();
  L.hooks.lockedMessage = 'The slide example uses the learners’ given predictions — load a dataset to draw';
  L.hooks.onDatasetSup = () => syncControls();
  L.hooks.onLectureSup = () => syncControls();

  L.hooks.frameSup = () => {
    const segs = [];
    const cur = S.sel >= 0 ? S.learners[S.sel] : S.phase === 'grow' ? S.learners[S.learners.length - 1] : null;
    if (cur?.stump) for (const nd of cur.stump.nodes) {
      if (nd.leaf) continue;
      const s = splitSegment(L, nd, 0.011);
      s.col = TERRA;
      segs.push(s);
    }
    L.segs.sync(segs);
  };

  L.hooks.labels = () => {
    if (!lec()) return null;
    const out = L.points.map((p, i) => ({ x: p.wx, y: p.wy, text: `w = ${fx(S.w[i], 3)}`, cls: 'tip', dx: -24, dy: p.label ? -50 : 16 }));
    return out;
  };

  /* ---------------- controls ---------------- */
  const tSlider = slider({ label: 'Number of stumps T', min: 1, max: 150, step: 1, value: S.T, onInput: (v) => { S.T = v; rerun(); } });
  const dSlider = slider({ label: 'Depth of each weak learner', min: 1, max: 3, step: 1, value: S.depth, onInput: (v) => { S.depth = v; rerun(); } });
  const lockHint = h('span', { class: 'hint' }, 'Lecture example: the three learners’ predictions are taken from the slides.');
  L.addControls(section([L.num(3), 'Boosting settings'], tSlider.el, dSlider.el, lockHint, button('Run all rounds', finish, { variant: 'btn-block' })));
  function syncControls() {
    const l = !!lec();
    tSlider.el.style.display = l ? 'none' : '';
    dSlider.el.style.display = l ? 'none' : '';
    lockHint.style.display = l ? '' : 'none';
  }

  /* ---------------- side ---------------- */
  const stats = statTiles([['t', 'Round'], ['eps', 'Error ε'], ['alpha', 'Vote α'], ['acc', 'Ensemble acc.']]);
  const thumbs = new ModelThumbs({ onSelect: (i) => { S.sel = i; refresh(); }, max: 24 });
  const thumbLabel = h('div', { class: 'sub-label' }, 'The stumps (first 24, click one)');
  const chart = new MiniChart({ height: 120, xLabel: 'round', empty: 'Press Step' });
  const chartNote = h('div', { class: 'chart-note' });
  const card = h('div', { class: 'card side-card' }, h('h3', {}, 'Live numbers'), stats.el, thumbLabel, thumbs.el,
    h('div', { class: 'sub-label' }, 'Training error of the ensemble'), chart.canvas, chartNote);
  L.mountSide(card);
  let thumbVer = 0;

  /* ---------------- refresh ---------------- */
  function refresh() {
    const K = S.learners.length;
    const upto = S.sel >= 0 ? S.sel + 1 : K;
    // canvas
    if (L.task === 'cls') {
      L.setCurves([]);
      if (K) {
        const sel = S.sel >= 0 ? S.learners[S.sel] : null;
        L.showField(sel ? (x) => (sel.h(x) > 0 ? [0.1, 0.9] : [0.9, 0.1]) : (x) => { const p = sigmoid(2 * F(x, upto)); return [1 - p, p]; });
      } else L.showField(null);
    } else {
      L.showField(null);
      const cs = [{ fn: () => 0.5, color: MUTE, width: 0.003, fade: 0.5 }];
      S.learners.forEach((l, t) => cs.push({ fn: (x) => (l.h([x]) > 0 ? 1 : 0), color: t === K - 1 && S.phase !== 'done' ? SLATE : MUTE, width: t === K - 1 ? 0.008 : 0.004, fade: t === K - 1 ? 0 : 0.5, step: true }));
      if (K) cs.push({ fn: (x) => (F([x]) / sumAlpha() + 1) / 2, color: TERRA, width: 0.012, step: true });
      L.setCurves(cs);
    }
    // points sized by weight
    L.colorPoints();
    const N = n();
    const last = S.phase === 'grow' || S.sel >= 0 ? S.learners[S.sel >= 0 ? S.sel : K - 1] : null;
    L.points.forEach((p, i) => {
      p.sz = Math.max(0.45, Math.min(3.2, Math.sqrt(S.w[i] * N)));
      if (last?.wrong.includes(i)) { p.oc = INK_C; p.fr = 0.55; }
    });
    // stats
    const lt = S.learners[S.sel >= 0 ? S.sel : K - 1];
    stats.set('t', `${S.sel >= 0 ? S.sel + 1 : K}/${nT()}`);
    stats.set('eps', lt ? fx(lt.eps, 3) : '–');
    stats.set('alpha', lt ? fx(lt.alpha, 3) : '–');
    stats.set('acc', K ? `${Math.round(L.accuracy((x) => (F(x, upto) > 0 ? 1 : 0)) * 100)}%` : '–');
    // thumbs + chart
    const ver = `${N}|${thumbVer}|${S.depth}|${lec()?.id}`;
    thumbs.set(L.task === 'cls' ? S.learners.map((l, t) => ({ title: `${t + 1} · α ${fmt(l.alpha, 2)}`, key: `${ver}|${t}`, draw: (ctx, w, hh) => paintCls(L, ctx, w, hh, (x) => (l.h(x) > 0 ? [0, 1] : [1, 0]), { res: 24 }) })) : [], S.sel);
    thumbLabel.style.display = thumbs.el.style.display = L.task === 'cls' ? '' : 'none';
    const errs = S.learners.map((_, t) => ({ y: 1 - L.accuracy((x) => (F(x, t + 1) > 0 ? 1 : 0)), color: t === upto - 1 ? '#E07A5F' : null }));
    chart.setLine(errs, { dots: errs.length <= 40, xLabel: 'round', empty: 'Press Step' });
    chartNote.innerHTML = K ? `Each stump alone has ε ≈ ${fx(S.learners.reduce((s, l) => s + l.eps, 0) / K, 2)} on its own weights, yet the weighted vote keeps getting better.` : '';
    narrate();
    renderWorked();
  }

  function narrate() {
    const K = S.learners.length;
    let nar;
    if (!n()) nar = { title: 'Give me some points!', text: 'Pick a dataset, or choose a class and click on the canvas.' };
    else if (S.phase === 'ready') nar = { title: `${n()} samples, equal weights 1/${n()} = ${fx(1 / n(), 3)}`, text: 'Each <b>Step</b> trains a stump on the <i>weighted</i> data, computes its error ε and vote α, and makes the mistakes heavier.' };
    else if (S.phase === 'done' && !lec()) nar = { title: `Weighted vote of ${K} stumps`, text: `H(x) = sign(Σ α<sub>t</sub> h<sub>t</sub>(x)). Training accuracy <b>${Math.round(L.accuracy((x) => (F(x) > 0 ? 1 : 0)) * 100)}%</b>. Big points are the ones AdaBoost found hardest.` };
    else if (S.phase === 'done') nar = { title: 'New sample: 0.549 + 0.805 − 1.099 = 0.255 → +1', text: 'L1 and L2 say +1, L3 says −1. L3 has the largest α on its own, but together L1 and L2 outvote it: H(x) = sign(0.255) = <b>+1</b>.' };
    else {
      const l = S.learners[K - 1];
      const wrongNames = l.wrong.length <= 6 ? l.wrong.map(name).join(', ') : `${l.wrong.length} points`;
      nar = { title: `Stump ${K}: ε = ${fx(l.eps, 3)}, α = ½ ln((1 − ε)/ε) = ${fx(l.alpha, 3)}`, text: l.wrong.length ? `Wrong: <b>${wrongNames}</b> → weights × e<sup>${fx(l.alpha, 3)}</sup> = ×${fx(Math.exp(l.alpha), 3)}. Right: × e<sup>−${fx(l.alpha, 3)}</sup> = ×${fx(Math.exp(-l.alpha), 3)}. Then normalise so the weights sum to 1.` : 'No mistakes at all — a perfect learner.' };
    }
    L.narrate({ emoji: '', ...nar }, S.phase);
  }

  function renderWorked() {
    const N = n();
    const show = lec() || (N > 0 && N <= 12);
    L.worked.show(!!show);
    if (!show) return;
    const parts = [];
    const K = S.learners.length;
    const cls = (c) => (lec() ? (c ? 'Yes' : 'No') : c ? '+1' : '−1');
    if (!K) {
      parts.push(table(['Sample', lec() ? 'Hours' : 'x', 'Actual', 'Weight'], L.points.map((p, i) => [{ v: name(i), cls: 'rh' }, fmt(p.x, 2), cls(p.label), fx(S.w[i], 3)])));
      parts.push(para('Press <b>Step</b> to train the first stump.'));
    }
    S.learners.forEach((l, t) => {
      if (t < K - 2 && !lec()) return;
      parts.push(step(`Learner ${t + 1}${lec() ? ` — ${lec().learners[t].rule}` : ''}`));
      parts.push(table(['Sample', 'Actual', 'h(x)', 'w', 'w·e^(∓α)', 'New w'], L.points.map((p, i) => ({
        rowCls: l.wrong.includes(i) ? 'cur' : '',
        cells: [{ v: name(i), cls: 'rh' }, cls(p.label), { v: cls(l.preds[i] > 0 ? 1 : 0), cls: l.wrong.includes(i) ? 'bad' : 'ok' }, fx(l.before[i], 3), fx(l.raw[i], 3), fx(l.after[i], 3)],
      }))));
      parts.push(para(`ε<sub>${t + 1}</sub> = ${l.wrong.map((i) => fx(l.before[i], 3)).join(' + ') || '0'} = <b>${fx(l.eps, 3)}</b> → α<sub>${t + 1}</sub> = ½ ln(${fx(1 - l.eps, 3)} / ${fx(l.eps, 3)}) = <b>${fx(l.alpha, 3)}</b>. Sum before normalising: ${fx(l.Z, 3)}.`));
    });
    if (lec()) {
      if (K >= 1) parts.push(note('📌 Slide step 5 says “consider Sample 2 … the prediction is incorrect”; it means <b>Sample 3</b> (hours 6), the only mistake of learner 1. The numbers on the slide are for sample 3.', 'pin'));
      if (K >= 3) {
        parts.push(note('📌 Learner 3’s predictions (No, Yes, No, No) cannot come from one threshold — a single stump would need “Yes” only between 3 and 5 hours. The slide says “suppose”, so we follow it. A real stump such as <b>hours &lt; 5 → Yes</b> would make no mistakes at all.', 'pin'));
        parts.push(step('Final weighted vote for a new sample'));
        parts.push(table(['Learner', 'Prediction', 'α', 'α·h'], lec().newSample.map((v, t) => [{ v: `L${t + 1}`, cls: 'rh' }, v > 0 ? '+1' : '−1', fx(S.learners[t].alpha, 3), fx(v * S.learners[t].alpha, 3)])));
        const sc = lec().newSample.reduce((s, v, t) => s + v * S.learners[t].alpha, 0);
        parts.push(para(`Σ α·h = <b>${fx(sc, 3)}</b> → H(x) = sign(${fx(sc, 3)}) = <b>${sc > 0 ? '+1' : '−1'}</b>`));
      }
    }
    L.worked.set(parts, lec() ? 'slide numbers' : `${K} stump${K === 1 ? '' : 's'}`);
  }

  /* ---------------- challenges ---------------- */
  const actions = {
    lec: () => { L.loadLecture(LECTURES[0]); L.focusStage(); },
    circles: () => { L.loadDataset('ccircles'); S.T = 50; tSlider.set(50); finish(); L.focusStage(); },
    noisy: () => { L.loadDataset('cnoisy'); S.T = 60; tSlider.set(60); finish(); L.focusStage(); },
    small: () => { L.n = 10; L.loadDataset('cblobs'); L.focusStage(); },
  };

  L.loadDataset('ccircles');
  return () => { chart.dispose(); L.dispose(); };
}
