import * as THREE from 'three';
import { createPointLab, statTiles, GREY, COLORS, INK_C, WHITE } from '../../core/pointlab.js';
import { MiniChart } from '../../core/chart.js';
import { h, section, slider, segmented, toggle, button, setText } from '../../core/ui.js';
import { table, note, para, step, fmt, fx } from '../../core/worked.js';
import * as H from './algo.js';
import { LECTURES, intuitionTab, mathTab, challengesTab } from './content.js';

const NOISE_RING = new THREE.Color(0xa39889);
const GRAPE = new THREE.Color(0x9d85ee);
const SHORT = new THREE.Color(0x4fc9a4);
const LONG = new THREE.Color(0xff7a66);
const FAINT = new THREE.Color(0xeadbc4);

export function mount(root) {
  const S = {
    k: 5, mcs: 12, allowSingle: false, mode: 'stability', eps: 0.15,
    R: null, phase: 'ready', mstShown: 0, cutRemoved: 0,
    show: { core: true, mst: true },
    hover: -1,
  };

  const L = createPointLab(root, {
    meta: { accent: '#A8E6A1', title: 'HDBSCAN', emoji: '', category: 'Unsupervised · Density', level: 'Advanced', blurb: 'Density clustering for groups of different densities — through core distances and a spanning tree.' },
    datasets: ['density', 'noisymoons', 'noisy', 'smiley', 'uniform', 'blank'],
    defaultDataset: 'density',
    n: { min: 20, max: 500, step: 20, value: 240 },
    maxPoints: 600,
    interval: 0.8,
    lectures: LECTURES,
    phaseTrack: [
      { id: 'ready', label: 'Data' },
      { id: 'core', label: 'Core dist.' },
      { id: 'mrd', label: 'Mutual reach.' },
      { id: 'mst', label: 'Spanning tree' },
      { id: 'tree', label: 'Condense / cut' },
      { id: 'done', label: 'Clusters ' },
    ],
    learnTabs: [
      { id: 'intuition', label: 'Intuition', render: intuitionTab },
      { id: 'math', label: '∑ Math', render: mathTab },
      { id: 'try', label: 'Try this', render: () => challengesTab(actions) },
    ],
  });
  const n = () => L.points.length;
  const nm = (i) => L.points[i]?.name || `#${i + 1}`;

  /* ---------------- compute ---------------- */
  function compute() {
    if (n() < 2) { S.R = null; return; }
    S.R = H.hdbscan(L.points, { k: Math.min(S.k, n() - 1), mcs: S.mcs, allowSingle: S.allowSingle });
    S.R.cutOrder = S.R.edges.map((e, i) => i).filter((i) => S.R.edges[i].w > S.eps).sort((a, b) => S.R.edges[b].w - S.R.edges[a].w);
    S.R.cutLabels = H.thresholdCut(n(), S.R.edges, S.eps, S.mcs);
  }
  const edgesTotal = () => (S.R ? S.R.edges.length : 0);
  const chunk = () => Math.max(1, Math.ceil(edgesTotal() / (n() <= 12 ? edgesTotal() : 8)));

  function reset() {
    S.phase = 'ready'; S.mstShown = 0; S.cutRemoved = 0;
    compute();
    refresh();
  }

  function doStep() {
    if (!S.R) { L.toast('Need at least 2 points'); return false; }
    switch (S.phase) {
      case 'ready': S.phase = 'core'; break;
      case 'core': S.phase = 'mrd'; break;
      case 'mrd': S.phase = 'mst'; S.mstShown = Math.min(edgesTotal(), chunk()); break;
      case 'mst':
        if (S.mstShown < edgesTotal()) { S.mstShown = Math.min(edgesTotal(), S.mstShown + chunk()); break; }
        S.phase = 'tree'; S.cutRemoved = 0;
        if (S.mode === 'cut' && S.R.cutOrder.length) S.cutRemoved = 1;
        break;
      case 'tree':
        if (S.mode === 'cut' && S.cutRemoved < S.R.cutOrder.length) { S.cutRemoved += n() <= 12 ? 1 : Math.max(1, Math.ceil(S.R.cutOrder.length / 6)); S.cutRemoved = Math.min(S.cutRemoved, S.R.cutOrder.length); break; }
        S.phase = 'done';
        break;
      default:
        L.toast('Done — try other settings');
        return false;
    }
    refresh();
    return S.phase !== 'done';
  }

  function finish() {
    if (!S.R) return;
    L.player.pause();
    S.mstShown = edgesTotal();
    S.cutRemoved = S.R.cutOrder.length;
    S.phase = 'done';
    refresh();
  }

  function rerun() {
    const keep = S.phase === 'done';
    compute();
    if (keep && S.R) { S.mstShown = edgesTotal(); S.cutRemoved = S.R.cutOrder.length; S.phase = 'done'; }
    else { S.phase = 'ready'; S.mstShown = 0; S.cutRemoved = 0; }
    refresh();
  }

  /* ---------------- hooks ---------------- */
  L.hooks.reset = reset;
  L.hooks.step = doStep;
  L.hooks.onEdit = () => rerun();
  L.hooks.onHover = (i) => { S.hover = i; };
  L.hooks.onDataset = () => {
    epsSlider.setRange(0.02, 0.6, 0.005); epsSlider.setFormat((v) => v.toFixed(3));
    S.eps = 0.15; epsSlider.set(0.15);
    if (S.k === 2 && S.mcs === 2) { setK(5, true); setMcs(12, true); }
    setAllow(false, true);
    setMode('stability', true);
  };
  L.hooks.onLecture = (lec) => {
    epsSlider.setRange(0.5, 80, 0.5); epsSlider.setFormat((v) => v.toFixed(1));
    S.eps = lec.eps; epsSlider.set(lec.eps);
    setK(lec.k, true); setMcs(lec.mcs, true); setAllow(lec.allowSingle, true);
    setMode('cut', true);
  };

  function setK(v, silent) { S.k = v; kSlider.set(v); if (!silent) rerun(); }
  function setMcs(v, silent) { S.mcs = v; mcsSlider.set(v); if (!silent) rerun(); }
  function setAllow(v, silent) { S.allowSingle = v; tAllow.set(v); if (!silent) rerun(); }
  function setMode(v, silent) {
    S.mode = v; modeSeg.set(v);
    epsSlider.el.style.display = v === 'cut' ? '' : 'none';
    modeHint.innerHTML = v === 'cut'
      ? 'Slide method: remove MST edges longer than ε. Leftover groups smaller than <i>min cluster size</i> become noise.'
      : 'Real HDBSCAN: keep the clusters that stay together over the widest range of thresholds (highest stability).';
    if (!silent) rerun();
  }

  /* ---------------- controls ---------------- */
  const kSlider = slider({ label: 'k — neighbour for core distance', min: 1, max: 20, step: 1, value: S.k, onInput: (v) => setK(v), hint: 'Core distance = distance to the k-th nearest other point.' });
  const mcsSlider = slider({ label: 'Min cluster size', min: 2, max: 60, step: 1, value: S.mcs, onInput: (v) => setMcs(v) });
  const modeHint = h('span', { class: 'hint' });
  const modeSeg = segmented({
    label: 'Cluster extraction',
    options: [{ value: 'stability', label: 'Stability' }, { value: 'cut', label: 'Slide cut' }],
    value: S.mode, onChange: (v) => setMode(v),
  });
  const epsSlider = slider({ label: 'Threshold ε', min: 0.02, max: 0.6, step: 0.005, value: S.eps, format: (v) => v.toFixed(3), onInput: (v) => { S.eps = v; rerun(); } });
  const tAllow = toggle({ label: 'Allow a single cluster', emoji: '', value: false, onChange: (v) => setAllow(v) });
  const tCore = toggle({ label: 'Core-distance circles', emoji: '', value: true, onChange: (v) => (S.show.core = v) });
  const tMst = toggle({ label: 'Spanning tree edges', emoji: '', value: true, onChange: (v) => (S.show.mst = v) });
  setMode(S.mode, true);
  L.addControls(
    section([L.num(3), 'HDBSCAN settings'], kSlider.el, mcsSlider.el, modeSeg.el, modeHint, epsSlider.el, tAllow.el,
      button('Run to the end', finish, { variant: 'btn-block' })),
    section([L.num(4), 'Show'], tCore.el, tMst.el),
  );

  /* ---------------- side: hierarchy ---------------- */
  const stats = statTiles([['clusters', 'Clusters'], ['noise', 'Noise'], ['edges', 'MST edges']]);
  const treeTitle = h('div', { class: 'sub-label' });
  const treeCanvas = h('canvas', { class: 'side-canvas' });
  const cutChart = new MiniChart({ height: 150, xLabel: 'MST edges, longest first' });
  const sideNote = h('div', { class: 'chart-note' });
  const numbers = h('div', { class: 'card side-card' }, h('h3', {}, 'Hierarchy'), stats.el, treeTitle, treeCanvas, cutChart.canvas, sideNote);
  L.mountSide(numbers);
  new ResizeObserver(() => drawTree()).observe(treeCanvas);

  function currentLabels() {
    if (!S.R) return null;
    if (S.mode === 'cut') {
      if (S.phase === 'done') return S.R.cutLabels;
      if (S.phase === 'tree') {
        const removed = new Set(S.R.cutOrder.slice(0, S.cutRemoved));
        return H.thresholdCut(n(), S.R.edges.filter((_, i) => !removed.has(i)), Infinity, S.mcs);
      }
      return null;
    }
    return S.phase === 'done' ? S.R.labels : null;
  }

  function drawTree() {
    const showTree = S.mode === 'stability';
    treeCanvas.style.display = showTree ? '' : 'none';
    cutChart.canvas.style.display = showTree ? 'none' : '';
    if (!showTree) {
      if (!S.R) { cutChart.setBars([], { empty: 'Add points' }); return; }
      const order = S.R.edges.map((e, i) => i).sort((a, b) => S.R.edges[b].w - S.R.edges[a].w);
      const removed = new Set(S.phase === 'done' ? S.R.cutOrder : S.R.cutOrder.slice(0, S.phase === 'tree' ? S.cutRemoved : 0));
      const top = order.slice(0, 40);
      cutChart.setBars(top.map((i) => ({
        label: n() <= 12 ? `${nm(S.R.edges[i].a)}–${nm(S.R.edges[i].b)}` : '',
        value: S.R.edges[i].w,
        color: removed.has(i) ? '#FFC2B8' : S.R.edges[i].w > S.eps ? '#FFE9A8' : '#CFF0DF',
        highlight: removed.has(i),
      })), { xLabel: order.length > 40 ? 'the 40 longest MST edges' : 'MST edges, longest first', ref: { y: S.eps, label: `ε = ${fmt(S.eps)}` } });
      setText(treeTitle, 'Edges longer than ε get removed');
      sideNote.innerHTML = 'Red = removed, orange = longer than ε (to be removed), mint = kept.';
      return;
    }
    setText(treeTitle, 'Condensed tree (λ = 1 / distance, grows downward)');
    sideNote.innerHTML = S.phase === 'done' || S.phase === 'tree'
      ? 'Each bar is a cluster; it narrows as points fall out. <b>Outlined bars</b> are the clusters HDBSCAN picked (most stable).'
      : 'Appears once the spanning tree is built.';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = treeCanvas.clientWidth || 320, Hh = 210;
    if (treeCanvas.width !== Math.round(W * dpr)) { treeCanvas.width = Math.round(W * dpr); treeCanvas.height = Math.round(Hh * dpr); }
    treeCanvas.style.height = Hh + 'px';
    const ctx = treeCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, Hh);
    ctx.font = '600 11px JetBrains Mono Variable, monospace';
    if (!S.R || !(S.phase === 'tree' || S.phase === 'done') || !S.R.tree.rows.length) {
      ctx.fillStyle = '#7A7068'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(S.R ? 'Step until the tree is built' : 'Add points', W / 2, Hh / 2);
      return;
    }
    const { rows, root } = S.R.tree;
    const N = n();
    const finite = rows.map((r) => r.lambda).filter((v) => v < 1e300);
    const lmax = Math.max(...finite, 1e-9) * 1.04;
    const pad = { l: 34, r: 8, t: 8, b: 8 };
    const pw = W - pad.l - pad.r, ph = Hh - pad.t - pad.b;
    const yOf = (lam) => pad.t + (Math.min(lam, lmax) / lmax) * ph;
    // axis
    ctx.strokeStyle = '#F5E2C6'; ctx.fillStyle = '#7A7068'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 3; i++) { const lam = (lmax * i) / 3, y = yOf(lam); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.fillText(fmt(lam, lmax < 10 ? 2 : 0), pad.l - 4, y); }

    const kids = new Map(), falls = new Map(), sizeAtBirth = new Map([[root, N]]);
    for (const r of rows) {
      if (r.child >= root) { if (!kids.has(r.parent)) kids.set(r.parent, []); kids.get(r.parent).push(r); sizeAtBirth.set(r.child, r.size); }
      if (!falls.has(r.parent)) falls.set(r.parent, []);
      falls.get(r.parent).push(r);
    }
    const unit = pw / N;
    const birth = S.R.birth;
    const labelOf = new Map([...S.R.selected].sort((a, b) => a - b).map((c, i) => [c, i]));
    const drawCluster = (c, x0, x1) => {
      const cx = (x0 + x1) / 2;
      const ev = (falls.get(c) || []).slice().sort((a, b) => a.lambda - b.lambda);
      let remaining = sizeAtBirth.get(c);
      let lam = birth.get(c) || 0;
      const sel = S.phase === 'done' && S.R.selected.has(c);
      const col = sel ? '#' + COLORS[labelOf.get(c) % COLORS.length].getHexString() : '#F0E2CC';
      ctx.fillStyle = col;
      const top = yOf(lam);
      let i = 0;
      while (i < ev.length) {
        const l2 = ev[i].lambda;
        const y0 = yOf(lam), y1 = yOf(l2);
        if (y1 > y0) ctx.fillRect(cx - (remaining * unit) / 2, y0, remaining * unit, y1 - y0);
        while (i < ev.length && ev[i].lambda === l2) { remaining -= ev[i].size; i++; }
        lam = l2;
      }
      if (sel) {
        ctx.strokeStyle = '#2A2622'; ctx.lineWidth = 2.5;
        const w = sizeAtBirth.get(c) * unit;
        ctx.strokeRect(cx - w / 2, top, w, Math.max(yOf(lam) - top, 2));
      }
      const ch = (kids.get(c) || []).slice().sort((a, b) => a.child - b.child);
      let xs = x0;
      const tot = ch.reduce((s, r) => s + r.size, 0) || 1;
      ch.forEach((r) => {
        const span = ((x1 - x0) * r.size) / tot;
        // connector
        const ccx = xs + span / 2;
        ctx.strokeStyle = '#7A7068'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(cx, yOf(r.lambda)); ctx.lineTo(ccx, yOf(r.lambda)); ctx.stroke();
        drawCluster(r.child, xs, xs + span);
        xs += span;
      });
    };
    drawCluster(root, pad.l, W - pad.r);
  }

  /* ---------------- frame ---------------- */
  const circ = [], segs = [];
  L.hooks.frame = () => {
    const R = S.R;
    circ.length = 0; segs.length = 0;
    if (!R || R.core.length !== n()) {
      for (const p of L.points) { p.tc = GREY; p.oc = null; p.fr = 0.66; p.sz = 0.9; }
      L.circles.sync(circ); L.segs.sync(segs);
      return;
    }
    const labels = currentLabels();
    L.points.forEach((p, i) => {
      if (!labels) { p.tc = GREY; p.oc = null; p.fr = 0.66; p.sz = 0.9; return; }
      const l = labels[i];
      if (l < 0) { p.tc = WHITE; p.oc = NOISE_RING; p.fr = 0.45; p.sz = 0.85; }
      else { p.tc = COLORS[l % COLORS.length]; p.oc = null; p.fr = 0.66; p.sz = 1.05; }
    });
    if (S.show.core && (S.phase === 'core' || S.phase === 'mrd' || (S.hover >= 0))) {
      const list = S.phase === 'core' || S.phase === 'mrd' ? L.points.map((_, i) => i) : [S.hover];
      for (const i of list) {
        const p = L.points[i];
        if (!p || p.far) continue;
        circ.push({ x: p.wx, y: p.wy, r: L.space.wl(R.core[i]), col: GRAPE, fill: list.length > 1 ? 0.035 : 0.08, ring: list.length > 1 ? 0.35 : 0.8 });
      }
    }
    if (S.show.mst && (S.phase === 'mst' || S.phase === 'tree' || S.phase === 'done')) {
      const shown = S.phase === 'mst' ? S.mstShown : R.edges.length;
      const removed = S.mode === 'cut' && (S.phase === 'tree' || S.phase === 'done')
        ? new Set(S.phase === 'done' ? R.cutOrder : R.cutOrder.slice(0, S.cutRemoved)) : null;
      const wMax = R.edges[R.edges.length - 1]?.w || 1;
      const tmp = new THREE.Color();
      for (let e = 0; e < shown; e++) {
        if (removed?.has(e)) continue;
        const E = R.edges[e];
        const a = L.points[E.a], b = L.points[E.b];
        let col;
        if (labels) {
          const la = labels[E.a], lb = labels[E.b];
          col = la >= 0 && la === lb ? COLORS[la % COLORS.length] : FAINT;
        } else col = tmp.copy(SHORT).lerp(LONG, Math.sqrt(E.w / wMax)).clone();
        segs.push({ x1: a.wx, y1: a.wy, x2: b.wx, y2: b.wy, w: e === shown - 1 && S.phase === 'mst' ? 0.01 : 0.006, col });
      }
    }
    L.circles.sync(circ);
    L.segs.sync(segs);
  };

  L.hooks.labels = () => {
    if (S.hover < 0 || !S.R || !L.points[S.hover]) return null;
    const p = L.points[S.hover];
    return [{ x: p.wx, y: p.wy, text: `core dist = ${fmt(S.R.core[S.hover], 3)}`, cls: 'tip', dx: 12, dy: 10 }];
  };

  /* ---------------- narration / numbers / worked ---------------- */
  function refresh() {
    const N = n();
    const R = S.R;
    const labels = currentLabels();
    const nClusters = labels ? new Set(labels.filter((l) => l >= 0)).size : 0;
    stats.set('clusters', labels ? nClusters : '–');
    stats.set('noise', labels ? labels.filter((l) => l < 0).length : '–');
    stats.set('edges', R ? `${S.phase === 'mst' ? S.mstShown : ['tree', 'done'].includes(S.phase) ? R.edges.length : 0}/${R.edges.length}` : '–');

    let nar, active = S.phase;
    if (!N) nar = { emoji: '', title: 'Give me some points!', text: 'Pick a dataset or click on the canvas.' };
    else if (S.phase === 'ready') nar = { emoji: '', title: `Ready · k = ${S.k}, min cluster size = ${S.mcs}`, text: 'Step through the six stages: core distances → mutual reachability → spanning tree → condense/cut → clusters.' };
    else if (S.phase === 'core') nar = { emoji: '', title: 'Step 2 · Core distances', text: `Each circle reaches the point’s <b>${S.k}${S.k === 1 ? 'st' : S.k === 2 ? 'nd' : S.k === 3 ? 'rd' : 'th'} nearest neighbour</b>. Small circles = dense areas, big circles = sparse ones. Hover any point.` };
    else if (S.phase === 'mrd') nar = { emoji: '', title: 'Step 3 · Mutual reachability', text: 'New distance = max(core of p, core of q, real distance). Points in sparse areas get pushed away from everything, so noise is easy to cut off later.' };
    else if (S.phase === 'mst') nar = { emoji: '', title: `Step 4 · Minimum spanning tree (${S.mstShown}/${R.edges.length})`, text: 'Connect all points with the cheapest links (by mutual reachability), shortest first. <span style="color:#A8E6A1">Mint</span> = short, <span style="color:#FF8C7A">coral</span> = long.' };
    else if (S.phase === 'tree') {
      active = 'tree';
      nar = S.mode === 'cut'
        ? { emoji: '', title: `Step 5 · Cut edges longer than ε = ${fmt(S.eps)}`, text: `Removed ${S.cutRemoved} of ${R.cutOrder.length} long edges. Pieces smaller than ${S.mcs} points become noise.` }
        : { emoji: '', title: 'Step 5 · Condensed tree', text: 'Remove edges from longest to shortest. Clusters are born, shrink as points fall out, and split. See the tree on the right.' };
    } else {
      nar = { emoji: '', title: `Done: ${nClusters} cluster${nClusters === 1 ? '' : 's'}, ${labels.filter((l) => l < 0).length} noise`, text: S.mode === 'cut' ? `Threshold method with ε = ${fmt(S.eps)}. Switch to <b>Stability</b> to see the real HDBSCAN choice.` : 'HDBSCAN kept the most stable clusters (outlined in the tree). Change min cluster size and watch it update.' };
    }
    L.narrate(nar, active);
    drawTree();
    renderWorked();
  }

  function renderWorked() {
    const N = n();
    const show = L.lecture || (N > 1 && N <= 10);
    L.worked.show(!!show);
    if (!show || !S.R) return;
    const R = S.R;
    const parts = [];
    const ph = S.phase;
    if (ph === 'ready') parts.push(para('Press <b>Step</b> to compute core distances.'));
    if (ph === 'core') {
      parts.push(step(`Core distances (k = ${S.k})`));
      parts.push(table(['Point', ...Array.from({ length: S.k }, (_, j) => `${j + 1}${j === 0 ? 'st' : j === 1 ? 'nd' : j === 2 ? 'rd' : 'th'} NN`), 'Core'],
        L.points.map((_, i) => [{ v: nm(i), cls: 'rh' }, ...R.nn[i].slice(0, S.k).map(([d, j]) => `${nm(j)} (${fx(d)})`), { v: fx(R.core[i]), cls: 'ok' }])));
    }
    if (ph === 'mrd') {
      parts.push(step('Mutual reachability distances'));
      parts.push(table(['', ...L.points.map((_, i) => nm(i))], L.points.map((_, i) => [{ v: nm(i), cls: 'rh' }, ...L.points.map((_, j) => ({ v: i === j ? '0' : fx(H.mrd(L.points, R.core, i, j)), cls: i === j ? 'diag' : '' }))])));
      if (N >= 4) {
        const i = 0, j = 3;
        parts.push(para(`Example: MRD(${nm(i)}, ${nm(j)}) = max(core(${nm(i)}) = ${fx(R.core[i])}, core(${nm(j)}) = ${fx(R.core[j])}, d = ${fx(H.dist(L.points[i], L.points[j]))}) = <b>${fx(H.mrd(L.points, R.core, i, j))}</b>`));
      }
      if (L.lecture?.id === 'lec-hd1') parts.push(note('<b>Slide note:</b> the slides list (E, F) = 74.99. The exact value is max(7.21, 74.95, 74.95) = 74.95, because d(E, F) = √(17² + 73²) ≈ 74.95.', 'warn'));
    }
    if (ph === 'mst' || ph === 'tree' || ph === 'done') {
      const shown = ph === 'mst' ? S.mstShown : R.edges.length;
      parts.push(step(`Spanning tree edges (${shown}/${R.edges.length})`));
      parts.push(table(['#', 'Edge', 'Weight'], R.edges.slice(0, shown).map((e, i) => [i + 1, `${nm(e.a)} – ${nm(e.b)}`, fx(e.w)])));
    }
    if ((ph === 'tree' || ph === 'done') && S.mode === 'cut') {
      parts.push(step(`Threshold cut at ε = ${fmt(S.eps)}`));
      const done = ph === 'done' ? R.cutOrder.length : S.cutRemoved;
      const lines = R.cutOrder.slice(0, done).map((ei, k) => {
        const e = R.edges[ei];
        const kept = R.edges.filter((_, i) => !R.cutOrder.slice(0, k + 1).includes(i));
        const lab = H.thresholdCut(N, kept, Infinity, 1);
        const groups = new Map();
        lab.forEach((l, i) => { if (!groups.has(l)) groups.set(l, []); groups.get(l).push(i); });
        const small = [...groups.values()].filter((g) => g.length < S.mcs && (g.includes(e.a) || g.includes(e.b)));
        const s = small.map((g) => `${g.map(nm).join(', ')} (${g.length} < ${S.mcs}) → noise`).join('; ');
        return `Remove <b>${nm(e.a)} – ${nm(e.b)}</b> (${fx(e.w)} > ${fmt(S.eps)})${s ? ': ' + s : ''}`;
      });
      parts.push(h('div', { class: 'w-lines', html: lines.join('<br>') || 'No edge is longer than ε.' }));
    }
    if ((ph === 'tree' || ph === 'done') && S.mode === 'stability') {
      parts.push(step('Condensed tree'));
      parts.push(table(['Parent', 'Child', 'λ', 'Size'], R.tree.rows.map((r) => [
        `C${r.parent - N}`, r.child >= N ? `C${r.child - N}` : nm(r.child), fx(r.lambda, 3), r.size,
      ])));
      parts.push(table(['Cluster', 'Birth λ', 'Stability', 'Picked'], [...R.stab].map(([c, v]) => [
        `C${c - N}`, fx(R.birth.get(c) || 0, 3), fx(v, 3), { v: R.selected.has(c) ? '✓' : '', cls: R.selected.has(c) ? 'ok' : '' },
      ])));
      if (!R.selected.size && !S.allowSingle) parts.push(note('Only the root cluster exists, and by default the root can’t be picked — so everything is noise. Turn on <b>Allow a single cluster</b> (the lecture setting).', 'info'));
    }
    if (ph === 'done') {
      const labels = currentLabels();
      const groups = new Map();
      labels.forEach((l, i) => { if (!groups.has(l)) groups.set(l, []); groups.get(l).push(nm(i)); });
      parts.push(step('Result'));
      parts.push(para([...groups].sort((a, b) => b[0] - a[0]).map(([l, g]) => (l < 0 ? `Noise: <b>${g.join(', ')}</b>` : `Cluster ${l + 1}: <b>(${g.join(', ')})</b>`)).join('<br>')));
      if (L.lecture?.id === 'lec-hd1') {
        const real = R.labels;
        parts.push(note(`Real HDBSCAN (stability, single cluster allowed) gives ${real.every((l, i) => l === R.cutLabels[i]) ? 'the <b>same</b> answer' : 'a different answer'} here: (${real.map((l, i) => (l >= 0 ? nm(i) : null)).filter(Boolean).join(', ')}) and noise ${real.map((l, i) => (l < 0 ? nm(i) : null)).filter(Boolean).join(', ')}.`, 'info'));
      }
    }
    L.worked.set(parts, `k = ${S.k} · mcs = ${S.mcs}`);
  }

  /* ---------------- challenges ---------------- */
  const load = (id, mode) => { L.loadDataset(id); setMode(mode, true); reset(); L.focusStage(); finish(); };
  const actions = {
    lec: () => { L.loadLecture(LECTURES[0]); L.focusStage(); },
    density: () => load('density', 'stability'),
    moons: () => load('noisymoons', 'stability'),
  };

  L.loadDataset('density');
  return () => { cutChart.dispose(); L.dispose(); };
}
