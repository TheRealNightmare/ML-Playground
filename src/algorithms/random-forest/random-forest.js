import * as THREE from 'three';
import { statTiles, COLORS, INK_C, WHITE } from '../../core/pointlab.js';
import { createSupLab, splitSegment } from '../../core/suplab.js';
import { TreeBuilder, argmax, rng, bootstrap } from '../../core/trees.js';
import { MiniChart } from '../../core/chart.js';
import { ModelThumbs, paintCls, paintCurve } from '../../core/thumbs.js';
import { h, section, slider, toggle, button } from '../../core/ui.js';
import { table, note, para, step, fmt, fx } from '../../core/worked.js';
import { LECTURES, intuitionTab, mathTab, challengesTab } from './content.js';

const TERRA = new THREE.Color(0xe07a5f);
const SLATE = new THREE.Color(0x4f6d8a);
const MUTE = new THREE.Color(0x8a7c6e);

export function mount(root) {
  const S = { T: 20, maxDepth: 6, featRand: true, seed: 1, trees: [], sel: -1, phase: 'ready' };

  const L = createSupLab(root, {
    meta: { accent: '#4F6D8A', title: 'Random Forest', emoji: '', category: 'Supervised · Ensemble', level: 'Intermediate', blurb: 'Grow many trees, each on its own bootstrap sample and random features, then let them vote.' },
    defaultDataset: 'cnoisy',
    n: { min: 20, max: 500, step: 20, value: 180 },
    maxPoints: 600,
    interval: 0.55,
    lectures: LECTURES,
    phaseTrack: [
      { id: 'ready', label: 'Data' },
      { id: 'grow', label: 'Bootstrap + grow a tree', loopBack: true },
      { id: 'done', label: 'Vote / average' },
    ],
    learnTabs: [
      { id: 'intuition', label: 'Intuition', render: intuitionTab },
      { id: 'math', label: '∑ Math', render: mathTab },
      { id: 'try', label: 'Try this', render: () => challengesTab(actions) },
    ],
  });
  const n = () => L.points.length;
  const lec = () => L.lecture;
  const nT = () => (lec() ? lec().boots.length : S.T);
  const reg = () => L.task === 'reg';
  const name = (i) => L.points[i]?.name || `#${i + 1}`;

  /* ---------------- model ---------------- */
  function buildTree(t) {
    const X = L.X(), y = L.Y();
    const rand = rng(S.seed * 7919 + t * 104729);
    let boot;
    if (lec()) {
      const idx = lec().boots[t].map((nm) => L.points.findIndex((p) => p.name === nm)).filter((i) => i >= 0);
      const counts = new Array(n()).fill(0);
      idx.forEach((i) => counts[i]++);
      boot = { idx, counts, oob: counts.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0) };
    } else boot = bootstrap(n(), n(), rand);
    const b = new TreeBuilder(X, { y }, boot.idx, {
      task: reg() ? 'reg' : 'cls', criterion: reg() ? 'mse' : 'gini', nClasses: L.nClasses,
      maxDepth: lec() ? lec().maxDepth : S.maxDepth, minLeaf: 1, nFeatures: L.nFeatures(),
      maxFeatures: !reg() && L.task === 'cls' && S.featRand ? 1 : null, rand, record: true,
    }).growAll();
    return { b, boot };
  }
  const treeOut = (tr, x) => (reg() ? tr.b.predict(x) : argmax(tr.b.predict(x)));
  /** Forest output: mean (regression) or vote shares per class. */
  function forest(x, trees = S.trees) {
    if (reg()) return trees.reduce((s, tr) => s + tr.b.predict(x), 0) / (trees.length || 1);
    const v = new Array(L.nClasses).fill(0);
    for (const tr of trees) v[argmax(tr.b.predict(x))] += 1 / trees.length;
    return v;
  }
  const forestOut = (x) => (reg() ? forest(x) : argmax(forest(x)));

  function oobCurve() {
    const pts = L.points.map(L.feat);
    const sum = pts.map(() => (reg() ? { s: 0, c: 0 } : { v: new Array(L.nClasses).fill(0), c: 0 }));
    const out = [];
    S.trees.forEach((tr) => {
      for (const i of tr.boot.oob) {
        if (reg()) { sum[i].s += tr.b.predict(pts[i]); sum[i].c++; }
        else { sum[i].v[argmax(tr.b.predict(pts[i]))]++; sum[i].c++; }
      }
      let err = 0, cnt = 0;
      sum.forEach((s, i) => {
        if (!s.c) return;
        cnt++;
        if (reg()) err += (s.s / s.c - L.points[i].y) ** 2;
        else if (argmax(s.v) !== L.points[i].label) err++;
      });
      out.push(cnt ? err / cnt : null);
    });
    return out;
  }

  /* ---------------- flow ---------------- */
  function reset() { L.normalizeTask(); S.trees = []; S.sel = -1; S.phase = 'ready'; refresh(); }
  function doStep() {
    if (S.trees.length >= nT()) { S.phase = 'done'; refresh(); return false; }
    S.trees.push(buildTree(S.trees.length));
    S.phase = S.trees.length >= nT() ? 'done' : 'grow';
    refresh();
    return S.phase !== 'done';
  }
  function finish() {
    L.player.pause();
    if (!n()) return;
    while (S.trees.length < nT()) S.trees.push(buildTree(S.trees.length));
    S.phase = 'done'; refresh();
  }
  function rerun() {
    const k = S.trees.length;
    S.trees = [];
    if (n()) for (let t = 0; t < Math.min(k, nT()); t++) S.trees.push(buildTree(t));
    if (S.sel >= S.trees.length) S.sel = -1;
    S.phase = !S.trees.length ? 'ready' : S.trees.length >= nT() ? 'done' : 'grow';
    refresh();
  }

  /* ---------------- hooks ---------------- */
  L.hooks.reset = reset;
  L.hooks.step = doStep;
  L.hooks.onEdit = () => rerun();
  L.hooks.onDatasetSup = () => syncControls();
  L.hooks.onLectureSup = () => syncControls();

  const focusTree = () => (S.sel >= 0 ? S.trees[S.sel] : S.phase === 'grow' ? S.trees[S.trees.length - 1] : null);

  L.hooks.frameSup = () => {
    const segs = [], circ = [];
    const tr = S.sel >= 0 ? S.trees[S.sel] : S.phase === 'grow' ? S.trees[S.trees.length - 1] : null;
    if (tr) for (const nd of tr.b.nodes) {
      if (nd.leaf) continue;
      const s = splitSegment(L, nd, S.sel >= 0 ? 0.008 : 0.005);
      s.col = S.sel >= 0 ? INK_C : MUTE;
      segs.push(s);
    }
    if (lec() && S.trees.length) for (const q of lec().queries) {
      const y = reg() ? forest([q]) : forest([q])[1];
      const w = L.space.w({ x: q, y });
      circ.push({ x: w.x, y: w.y, r: 0.03, col: TERRA, fill: 0.9, ring: 1 });
    }
    L.segs.sync(segs);
    L.circles.sync(circ);
  };

  L.hooks.labels = () => {
    if (!lec() || !S.trees.length) return null;
    return lec().queries.map((q, qi) => {
      let text;
      if (reg()) text = `size ${q} → ${fx(forest([q]), 2)}`;
      else { const v = forest([q]); const no = Math.round(v[0] * S.trees.length); text = `size ${q} → ${v[1] > 0.5 ? 'Yes' : 'No'} (${S.trees.length - no} Yes · ${no} No)`; }
      const y = reg() ? forest([q]) : forest([q])[1];
      const w = L.space.w({ x: q, y });
      return { x: w.x, y: w.y, text, cls: 'tip', dx: 12, dy: (reg() ? 10 : -34) + qi * 26 };
    });
  };

  /* ---------------- controls ---------------- */
  const tSlider = slider({ label: 'Number of trees', min: 1, max: 60, step: 1, value: S.T, onInput: (v) => { S.T = v; if (S.trees.length > v) S.trees.length = v; if (S.sel >= v) S.sel = -1; S.phase = S.trees.length >= v ? 'done' : S.trees.length ? 'grow' : 'ready'; refresh(); } });
  const dSlider = slider({ label: 'Max depth of each tree', min: 1, max: 12, step: 1, value: S.maxDepth, onInput: (v) => { S.maxDepth = v; rerun(); } });
  const tFeat = toggle({ label: 'Random feature at each split', value: S.featRand, onChange: (v) => { S.featRand = v; rerun(); } });
  const lockHint = h('span', { class: 'hint' }, 'Lecture example: 3 trees with the slide’s bootstrap samples, one split each.');
  L.addControls(section([L.num(3), 'Forest settings'], tSlider.el, dSlider.el, tFeat.el, lockHint,
    h('div', { class: 'btn-row' },
      button('Grow all trees', finish, { variant: 'btn-block' }),
      button('New bootstraps', () => { S.seed++; rerun(); }, { variant: 'btn-ghost btn-block' }))));

  function syncControls() {
    const l = !!lec();
    tSlider.el.style.display = l ? 'none' : '';
    dSlider.el.style.display = l ? 'none' : '';
    tFeat.el.style.display = l || L.task !== 'cls' ? 'none' : '';
    lockHint.style.display = l ? '' : 'none';
  }

  /* ---------------- side ---------------- */
  const stats = statTiles([['trees', 'Trees'], ['train', 'Train acc.'], ['oob', 'OOB acc.'], ['depth', 'Avg depth']]);
  const labs = stats.el.querySelectorAll('.stat-label');
  const thumbs = new ModelThumbs({ onSelect: (i) => { S.sel = i; refresh(); if (i >= 0) L.toast(`Showing tree ${i + 1} alone — click it again for the forest`); } });
  const thumbNote = h('div', { class: 'chart-note' });
  const oobChart = new MiniChart({ height: 120, xLabel: 'number of trees', empty: 'Grow some trees' });
  const oobNote = h('div', { class: 'chart-note' });
  const card = h('div', { class: 'card side-card' }, h('h3', {}, 'Live numbers'), stats.el,
    h('div', { class: 'sub-label' }, 'The trees (click one)'), thumbs.el, thumbNote,
    h('div', { class: 'sub-label' }, 'Out-of-bag error'), oobChart.canvas, oobNote);
  L.mountSide(card);

  /* ---------------- refresh ---------------- */
  function refresh() {
    const N = n(), K = S.trees.length;
    const tr = focusTree();
    const shown = S.sel >= 0 ? [S.trees[S.sel]] : S.trees;
    // canvas model
    if (!K) { L.showField(null); L.setCurves([]); }
    else if (L.task === 'cls') { L.showField((x) => forest(x, shown)); L.setCurves([]); }
    else {
      L.showField(null);
      const pick = (t) => (x) => (reg() ? t.b.predict([x]) : t.b.predict([x])[1]);
      const cs = S.trees.map((t, i) => ({ fn: pick(t), color: i === S.sel ? SLATE : MUTE, width: i === S.sel ? 0.01 : 0.004, fade: i === S.sel ? 0 : 0.55, step: true }));
      cs.push({ fn: (x) => (reg() ? forest([x]) : forest([x])[1]), color: TERRA, width: 0.012, fade: S.sel >= 0 ? 0.6 : 0, step: true });
      if (L.task === 'cls1d') cs.unshift({ fn: () => 0.5, color: MUTE, width: 0.003, fade: 0.5 });
      L.setCurves(cs);
    }
    // points: bootstrap highlight
    L.colorPoints();
    if (tr) L.points.forEach((p, i) => {
      const c = tr.boot.counts[i] || 0;
      if (!c) { p.oc = p.tc; p.tc = WHITE; p.fr = 0.45; p.sz = 0.85; p.thumbAlpha = 0.35; }
      else { p.sz = 0.8 + 0.28 * Math.min(c, 4); p.thumbAlpha = 1; }
    });
    else L.points.forEach((p) => { p.sz = 1; p.thumbAlpha = 1; });

    // stats
    labs[1].textContent = reg() ? 'Train MSE' : 'Train acc.';
    labs[2].textContent = reg() ? 'OOB MSE' : 'OOB acc.';
    stats.set('trees', `${K}/${nT()}`);
    if (K && N) {
      if (reg()) stats.set('train', fmt(L.mse((x) => forest(x)), lec() ? 1 : 4));
      else stats.set('train', `${Math.round(L.accuracy(forestOut) * 100)}%`);
      const oc = oobCurve();
      const last = oc[oc.length - 1];
      stats.set('oob', last == null ? '–' : reg() ? fmt(last, lec() ? 1 : 4) : `${Math.round((1 - last) * 100)}%`);
      stats.set('depth', fmt(S.trees.reduce((s, t) => s + t.b.depth, 0) / K, 1));
      oobChart.setLine(oc.map((y) => ({ y: y ?? 0 })), { dots: oc.length <= 30, xLabel: 'number of trees', noArea: false });
      oobNote.innerHTML = reg() ? 'Mean squared error on points each tree did <b>not</b> see, averaged over the trees that left them out.' : 'Share of points misclassified by the trees that did <b>not</b> train on them. It drops, then levels off.';
    } else { ['train', 'oob', 'depth'].forEach((k) => stats.set(k, '–')); oobChart.setLine([], { empty: 'Grow some trees' }); oobNote.textContent = ''; }

    // thumbnails
    const ver = `${S.seed}|${N}|${L.task}|${L.stage.view.halfW.toFixed(3)}`;
    thumbs.set(S.trees.map((t, i) => ({
      title: `T${i + 1}`,
      key: `${ver}|${i}|${t.b.nodes.length}|${editTick}`,
      draw: (ctx, w, hh) => (L.task === 'cls' ? paintCls(L, ctx, w, hh, (x) => t.b.predict(x)) : paintCurve(L, ctx, w, hh, (x) => (reg() ? t.b.predict([x]) : t.b.predict([x])[1]))),
    })), S.sel);
    thumbNote.textContent = K ? (S.sel >= 0 ? `Tree ${S.sel + 1}: hollow points are out-of-bag (not in its bootstrap), bigger dots were drawn more than once.` : 'Each tree sees a different bootstrap sample, so each one is a little different.') : '';

    narrate();
    renderWorked();
  }
  let editTick = 0;
  const baseEdit = L.hooks.onEdit;
  L.hooks.onEdit = () => { editTick++; baseEdit(); };

  function narrate() {
    const K = S.trees.length;
    let nar;
    if (!n()) nar = { title: 'Give me some points!', text: 'Pick a dataset, or choose a class and click on the canvas.' };
    else if (S.phase === 'ready') nar = { title: `Ready to grow ${nT()} trees`, text: 'Each <b>Step</b> draws a bootstrap sample (n points <i>with replacement</i>) and grows one tree on it.' };
    else if (S.phase === 'grow') {
      const tr = S.trees[K - 1];
      const oob = tr.boot.oob.length;
      const dup = tr.boot.counts.filter((c) => c > 1).length;
      nar = { title: `Tree ${K}: bootstrap of ${tr.boot.idx.length} draws`, text: `${dup} point${dup === 1 ? ' was' : 's were'} drawn more than once (bigger), <b>${oob}</b> never (hollow, out-of-bag — ${Math.round((oob / n()) * 100)}%). The tree grew to depth ${tr.b.depth} with ${tr.b.leaves} leaves.${lec() ? ` Bootstrap: [${lec().boots[K - 1].join(', ')}].` : ''}` };
    } else nar = { title: `Forest of ${K} trees · ${reg() ? 'average' : 'majority vote'}`, text: `The ${L.task === 'cls' ? 'background shows the share of trees voting for each class — pale where they disagree' : 'bold line is the forest; thin lines are the individual trees'}. Click a tree thumbnail to see it alone.` };
    L.narrate({ emoji: '', ...nar }, S.phase);
  }

  function renderWorked() {
    const N = n();
    const show = lec() || (N > 0 && N <= 12);
    L.worked.show(!!show);
    if (!show) return;
    const parts = [];
    const K = S.trees.length;
    const fname = lec()?.featName || 'x';
    if (!K) { parts.push(para('Press <b>Step</b> to draw the first bootstrap sample and grow tree 1.')); L.worked.set(parts, ''); return; }
    const leafTxt = (v) => (reg() ? fx(v, 2) : (L.lecture?.classNames || ['A', 'B', 'C'])[argmax(v)]);
    const qs = lec()?.queries || [];
    parts.push(step('Trees trained on their bootstraps'));
    parts.push(table(['Tree', 'Bootstrap', 'Split', 'Left', 'Right', ...qs.map((q) => `@${q}`)], S.trees.map((t, i) => {
      const root = t.b.nodes[0];
      const boot = t.boot.idx.map(name).join(',');
      const split = root.leaf ? 'pure → leaf' : `${fname} < ${fmt(root.thr, 1)}`;
      return {
        rowCls: i === S.sel ? 'cur' : '',
        cells: [{ v: `T${i + 1}`, cls: 'rh' }, boot, split, root.leaf ? leafTxt(root.value) : leafTxt(t.b.nodes[root.left].value), root.leaf ? '–' : leafTxt(t.b.nodes[root.right].value),
          ...qs.map((q) => (reg() ? fx(t.b.predict([q]), 2) : leafTxt(t.b.predict([q]))))],
      };
    })));
    if (qs.length) {
      parts.push(step(reg() ? 'Average of the trees' : 'Majority vote'));
      qs.forEach((q) => {
        if (reg()) parts.push(para(`${fname} ${q}: (${S.trees.map((t) => fx(t.b.predict([q]), 2)).join(' + ')}) / ${K} = <b>${fx(forest([q]), 2)}</b>`));
        else parts.push(para(`${fname} ${q}: majority(${S.trees.map((t) => leafTxt(t.b.predict([q]))).join(', ')}) = <b>${forest([q])[1] > 0.5 ? 'Yes' : 'No'}</b>`));
      });
    }
    if (lec() && K === nT()) {
      parts.push(step('Applied to the training set'));
      parts.push(table(['House', 'True', ...S.trees.map((_, i) => `T${i + 1}`), 'Forest'], L.points.map((p, i) => {
        const x = L.feat(p);
        const f = forestOut(x);
        const ok = reg() ? null : f === p.label;
        return [{ v: name(i), cls: 'rh' }, reg() ? fx(p.y, 0) : leafTxt([1 - p.label, p.label]), ...S.trees.map((t) => (reg() ? fx(t.b.predict(x), 2) : leafTxt(t.b.predict(x)))), { v: reg() ? fx(f, 2) : leafTxt([1 - f, f]), cls: ok === null ? '' : ok ? 'ok' : 'bad' }];
      })));
      if (reg()) {
        parts.push(note('📌 Tree 1’s bootstrap contains E twice, so its right side is {E, E} with mean <b>380</b> (slide: 350). Any threshold between 1450 and 2000 gives the same split; we use the midpoint 1725 (slide: 1600).', 'pin'));
        parts.push(note('📌 Tree 3’s lowest-error split is between C and D (<b>1575</b>, means 230 / 340), not 1400 with 182.5 / 316.67.', 'pin'));
        parts.push(note('📌 So 1280 and 1460 both fall on the left of every tree: (206.67 + 206.67 + 230) / 3 = <b>214.44</b> for both (slide: 198.61 and 243.34).', 'pin'));
      } else {
        parts.push(note('📌 Tree 2’s bootstrap contains house A (No), so its best split also separates A: size < 1075 → No (slide: “< 1300 → Yes / Yes”). Thresholds are shown as midpoints (slide’s 1000 for tree 1 gives the same split).', 'pin'));
        parts.push(note('📌 For size 460 the votes are No, No, Yes → <b>No</b> (slide: Yes). Size 1280 is Yes in all three trees.', 'pin'));
      }
    }
    L.worked.set(parts, reg() ? 'average' : 'vote');
  }

  /* ---------------- challenges ---------------- */
  const actions = {
    reg: () => { L.loadLecture(LECTURES[0]); L.focusStage(); },
    cls: () => { L.loadLecture(LECTURES[1]); L.focusStage(); },
    noisy: () => { L.loadDataset('cnoisy'); S.T = 1; tSlider.set(1); finish(); L.focusStage(); },
    blobs: () => { L.loadDataset('cblobs'); S.T = 12; tSlider.set(12); finish(); S.sel = 0; refresh(); L.focusStage(); },
  };

  L.loadDataset('cnoisy');
  return () => { oobChart.dispose(); L.dispose(); };
}
