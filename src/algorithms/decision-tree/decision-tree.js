import * as THREE from 'three';
import { statTiles, COLORS, INK_C } from '../../core/pointlab.js';
import { createSupLab, splitSegment } from '../../core/suplab.js';
import { TreeBuilder, argmax } from '../../core/trees.js';
import { TreeView } from '../../core/treeview.js';
import { MiniChart } from '../../core/chart.js';
import { h, section, slider, segmented, button } from '../../core/ui.js';
import { table, note, para, step, fmt, fx } from '../../core/worked.js';
import { ID3, TENNIS, gains } from './id3.js';
import { LECTURES, intuitionTab, mathTab, challengesTab } from './content.js';

const TERRA = new THREE.Color(0xe07a5f);
const FAINT = new THREE.Color(0x8a7c6e);
const SLATE = new THREE.Color(0x4f6d8a);

export function mount(root) {
  const S = { criterion: 'gini', maxDepth: 5, minLeaf: 1, b: null, cur: -1, phase: 'ready', leafNote: null, sel: -1, id3: null };

  const L = createSupLab(root, {
    meta: { accent: '#6B8E5A', title: 'Decision Tree', emoji: '', category: 'Supervised · Trees', level: 'Beginner', blurb: 'Ask one yes/no question at a time. Each question is the split that makes the two halves as pure as possible.' },
    defaultDataset: 'cmoons',
    n: { min: 20, max: 600, step: 20, value: 200 },
    maxPoints: 800,
    interval: 0.8,
    lectures: LECTURES,
    phaseTrack: [
      { id: 'ready', label: 'Root node' },
      { id: 'split', label: 'Best split', loopBack: true },
      { id: 'done', label: 'Done' },
    ],
    learnTabs: [
      { id: 'intuition', label: 'Intuition', render: intuitionTab },
      { id: 'math', label: '∑ Math', render: mathTab },
      { id: 'try', label: 'Try this', render: () => challengesTab(actions) },
    ],
  });
  const n = () => L.points.length;
  const isId3 = () => L.task === 'id3';
  const featNames = () => (L.task === 'cls' ? ['x', 'y'] : [L.lecture?.id === 'lec-dt-house' ? 'size' : 'x']);

  /* ---------------- algorithm ---------------- */
  function opts() {
    const o = { task: L.task === 'reg' ? 'reg' : 'cls', criterion: L.task === 'reg' ? 'mse' : S.criterion, nClasses: L.nClasses, maxDepth: S.maxDepth, minLeaf: S.minLeaf, record: true, nFeatures: L.nFeatures() };
    if (L.lecture?.settings) Object.assign(o, { maxDepth: L.lecture.settings.maxDepth });
    return o;
  }
  function fresh() {
    S.cur = -1; S.leafNote = null; S.sel = -1;
    if (isId3()) { S.id3 = new ID3(TENNIS); S.b = null; return; }
    S.id3 = null;
    const X = L.X(), y = L.Y();
    S.b = n() ? new TreeBuilder(X, { y }, X.map((_, i) => i), opts()) : null;
  }
  function reset() { L.normalizeTask(); fresh(); S.phase = 'ready'; layoutId3(true); refresh(); }

  function doStep() {
    if (isId3()) {
      const nd = S.id3.step();
      S.cur = nd ? nd.id : -1;
      S.phase = S.id3.done ? 'done' : 'split';
      layoutId3();
      refresh();
      return !S.id3.done;
    }
    if (!S.b) return false;
    let ev = S.b.step();
    const leaves = [];
    while (ev && ev.type === 'leaf') { leaves.push(ev); ev = S.b.step(); }
    S.leafNote = leaves.length ? leaves[leaves.length - 1].reason : null;
    if (ev) { S.cur = ev.node.id; S.phase = 'split'; }
    else { S.phase = 'done'; }
    if (S.b.done) S.phase = 'done';
    refresh();
    return !S.b.done;
  }
  function finish() {
    L.player.pause();
    if (isId3()) { while (!S.id3.done) S.id3.step(); S.cur = -1; S.phase = 'done'; layoutId3(); refresh(); return; }
    if (!S.b) return;
    S.b.growAll(); S.cur = -1; S.leafNote = null; S.phase = 'done'; refresh();
  }
  function rerun() {
    const wasDone = S.phase === 'done';
    fresh();
    if (wasDone && S.b) { S.b.growAll(); S.phase = 'done'; } else S.phase = 'ready';
    refresh();
  }

  const predictFn = () => {
    const b = S.b;
    if (!b) return null;
    return (x) => b.predict(x);
  };

  /* ---------------- ID3 layout: one column per current leaf ---------------- */
  function layoutId3(snap = false) {
    if (!isId3() || !S.id3) return;
    const leaves = S.id3.leaves();
    const K = leaves.length;
    leaves.forEach((lf, c) => {
      const cx = K === 1 ? 0 : -0.82 + (1.64 * c) / (K - 1);
      const rows = lf.rows.slice().sort((a, b) => b.label - a.label);
      rows.forEach((r, j) => {
        const p = L.points.find((q) => q.name === r.name);
        if (!p) return;
        p.tx = cx - 0.05; p.ty = 0.62 - j * 0.104;
        if (snap) { p.x = p.tx; p.y = p.ty; }
      });
    });
  }

  /* ---------------- hooks ---------------- */
  L.hooks.reset = reset;
  L.hooks.step = doStep;
  L.hooks.onEdit = () => rerun();
  L.hooks.canEdit = () => !isId3();
  L.hooks.lockedMessage = 'The Play Tennis table is categorical — nothing to drag here';
  L.hooks.onDatasetSup = () => { syncControls(); };
  L.hooks.onLectureSup = (lec) => {
    if (lec.task === 'id3') { L.space.setIdentity(); L.axes.setVisible(false); }
    syncControls();
  };

  L.hooks.frameSup = (dt) => {
    const segs = [];
    if (isId3()) {
      const k = 1 - Math.exp(-dt * 7);
      for (const p of L.points) if (p.tx != null) { p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; }
      L.segs.sync(segs);
      L.circles.sync([]);
      return;
    }
    const b = S.b;
    const circ = [];
    if (b) {
      for (const nd of b.nodes) {
        if (nd.leaf) continue;
        const s = splitSegment(L, nd, nd.id === S.cur ? 0.012 : 0.006);
        s.col = nd.id === S.cur ? TERRA : INK_C;
        segs.push(s);
      }
      const box = S.sel >= 0 ? b.nodes[S.sel] : S.cur >= 0 ? b.nodes[S.cur] : null;
      if (box && L.task === 'cls') {
        const v = L.stage.view, sp = L.space;
        const X0 = Number.isFinite(box.box.lo[0]) ? sp.w({ x: box.box.lo[0], y: 0 }).x : -v.halfW + 0.01;
        const X1 = Number.isFinite(box.box.hi[0]) ? sp.w({ x: box.box.hi[0], y: 0 }).x : v.halfW - 0.01;
        const Y0 = Number.isFinite(box.box.lo[1]) ? sp.w({ x: 0, y: box.box.lo[1] }).y : -v.halfH + 0.01;
        const Y1 = Number.isFinite(box.box.hi[1]) ? sp.w({ x: 0, y: box.box.hi[1] }).y : v.halfH - 0.01;
        const w = 0.005, col = SLATE;
        segs.push({ x1: X0, y1: Y0, x2: X1, y2: Y0, w, col }, { x1: X1, y1: Y0, x2: X1, y2: Y1, w, col }, { x1: X1, y1: Y1, x2: X0, y2: Y1, w, col }, { x1: X0, y1: Y1, x2: X0, y2: Y0, w, col });
      }
      if (L.lecture?.queries && L.task === 'reg') {
        for (const q of L.lecture.queries) {
          const w = L.space.w({ x: q, y: b.predict([q]) });
          circ.push({ x: w.x, y: w.y, r: 0.03, col: TERRA, fill: 0.9, ring: 1 });
        }
      }
    }
    L.segs.sync(segs);
    L.circles.sync(circ);
  };

  L.hooks.labels = () => {
    const out = [];
    if (isId3() && S.id3) {
      const leaves = S.id3.leaves();
      const K = leaves.length;
      leaves.forEach((lf, c) => {
        const cx = K === 1 ? 0 : -0.82 + (1.64 * c) / (K - 1);
        const head = lf.path.length ? lf.path[lf.path.length - 1] : 'All 14 days';
        out.push({ x: cx - 0.07, y: 0.8, text: head, cls: 'tip', dx: 0, dy: -30 });
        out.push({ x: cx - 0.07, y: 0.8, text: `${lf.pos}+ ${lf.neg}−${lf.decision ? ' → ' + lf.decision : ''}`, cls: '', dx: 0, dy: -4 });
      });
      return out;
    }
    if (L.lecture?.queries && S.b && L.task === 'reg') {
      for (const q of L.lecture.queries) {
        const y = S.b.predict([q]);
        const w = L.space.w({ x: q, y });
        out.push({ x: w.x, y: w.y, text: `new house ${q} → ${fmt(y, 1)}`, cls: 'tip', dx: q > 2000 ? -10 : 12, dy: 8, anchor: q > 2000 ? 'right' : null });
      }
    }
    return out;
  };

  /* ---------------- controls ---------------- */
  const critSeg = segmented({
    label: 'Impurity measure',
    options: [{ value: 'gini', label: 'Gini' }, { value: 'entropy', label: 'Entropy' }],
    value: S.criterion,
    onChange: (v) => { S.criterion = v; rerun(); },
  });
  const regHint = h('span', { class: 'hint' }, 'Regression trees minimise the weighted mean squared error (MSE) of the two halves.');
  const depthSlider = slider({ label: 'Max depth', min: 1, max: 12, step: 1, value: S.maxDepth, onInput: (v) => { S.maxDepth = v; rerun(); } });
  const leafSlider = slider({ label: 'Min samples per leaf', min: 1, max: 30, step: 1, value: S.minLeaf, onInput: (v) => { S.minLeaf = v; rerun(); } });
  const lockHint = h('span', { class: 'hint' });
  const treeSettings = section([L.num(3), 'Tree settings'], critSeg.el, regHint, depthSlider.el, leafSlider.el, lockHint, button('Grow the whole tree', finish, { variant: 'btn-block' }));
  L.addControls(treeSettings);

  function syncControls() {
    const id3 = isId3();
    critSeg.el.style.display = L.task === 'reg' || id3 ? 'none' : '';
    regHint.style.display = L.task === 'reg' ? '' : 'none';
    const locked = !!L.lecture;
    depthSlider.el.style.display = id3 ? 'none' : '';
    leafSlider.el.style.display = id3 ? 'none' : '';
    lockHint.style.display = locked ? '' : 'none';
    lockHint.textContent = id3 ? 'ID3 uses entropy and splits a categorical attribute into one branch per value.' : locked ? 'Lecture rule: stop after one split (weighted MSE vs. threshold 600). Depth is fixed here.' : '';
    depthSlider.el.querySelector('input').disabled = locked;
  }

  /* ---------------- side ---------------- */
  const stats = statTiles([['depth', 'Depth'], ['leaves', 'Leaves'], ['score', 'Train acc.'], ['nodes', 'Splits']]);
  const scoreLabel = stats.el.querySelectorAll('.stat-label')[2];
  const tree = new TreeView({
    height: 220,
    onClick: (id) => { S.sel = S.sel === id ? -1 : id; refreshTree(); },
  });
  const textTree = h('pre', { class: 'tree-text' });
  const treeHint = h('div', { class: 'chart-note' }, 'Click a node to outline its region on the canvas.');
  const searchChart = new MiniChart({ height: 120, xLabel: 'candidate thresholds (sorted)', empty: 'Press Step to search' });
  const searchNote = h('div', { class: 'chart-note' });
  const numbers = h('div', { class: 'card side-card' }, h('h3', {}, 'Live numbers'), stats.el,
    h('div', { class: 'sub-label' }, 'The tree'), tree.canvas, textTree, treeHint,
    h('div', { class: 'sub-label search-label' }, 'Split search at the current node'), searchChart.canvas, searchNote);
  L.mountSide(numbers);

  function refreshTree() {
    if (isId3()) {
      tree.canvas.style.display = 'none'; treeHint.style.display = 'none';
      textTree.style.display = ''; textTree.textContent = S.id3 ? S.id3.text() : '';
      return;
    }
    tree.canvas.style.display = ''; treeHint.style.display = ''; textTree.style.display = 'none';
    tree.featureNames = featNames();
    tree.valueText = L.task === 'reg' ? (nd) => fmt(nd.value, L.lecture ? 1 : 2) : null;
    tree.set(S.b, { highlight: S.sel >= 0 ? S.sel : S.cur, task: L.task });
  }

  /* ---------------- narration / numbers / worked ---------------- */
  function refresh() {
    const N = n();
    const b = S.b;
    // model on canvas
    if (!isId3() && b) {
      if (L.task === 'cls') { L.showField(predictFn()); L.setCurves([]); }
      else { L.showField(null); L.setCurves([{ fn: (x) => b.predict([x]), color: TERRA, width: 0.011, step: true }]); }
    } else { L.showField(null); L.setCurves([]); }
    L.colorPoints();
    numbers.querySelector('.search-label').style.display = isId3() ? 'none' : '';
    searchChart.canvas.style.display = isId3() ? 'none' : '';
    searchNote.style.display = isId3() ? 'none' : '';

    // stats
    if (isId3()) {
      const nodes = S.id3.nodes;
      stats.set('depth', Math.max(...nodes.map((x) => x.depth)));
      stats.set('leaves', S.id3.leaves().length);
      scoreLabel.textContent = 'Pure leaves';
      stats.set('score', S.id3.leaves().filter((x) => x.E === 0).length);
      stats.set('nodes', nodes.filter((x) => !x.leaf).length);
    } else if (b) {
      stats.set('depth', b.depth);
      stats.set('leaves', b.leaves);
      stats.set('nodes', b.nodes.filter((x) => !x.leaf).length);
      if (L.task === 'cls') { scoreLabel.textContent = 'Train acc.'; stats.set('score', `${Math.round(L.accuracy((x) => argmax(b.predict(x))) * 100)}%`); }
      else { scoreLabel.textContent = 'Train MSE'; stats.set('score', fmt(L.mse((x) => b.predict(x)), L.lecture ? 1 : 4)); }
    } else { ['depth', 'leaves', 'nodes'].forEach((k) => stats.set(k, '–')); stats.set('score', '–'); }
    refreshTree();
    drawSearch();

    // narration
    let nar, active = S.phase;
    if (isId3()) {
      const nd = S.cur >= 0 ? S.id3.nodes[S.cur] : null;
      if (S.phase === 'ready') nar = { title: 'Root: all 14 days (9 Yes, 5 No)', text: `Entropy of the root = <b>${fx(S.id3.nodes[0].E, 3)}</b>. Press <b>Step</b> to compute the information gain of every attribute.` };
      else if (S.phase === 'done') nar = { title: 'Done — every leaf is pure', text: 'Outlook at the root; Sunny days split on Humidity, Rain days on Wind, Overcast is always Yes. Compare with the final tree on the slides.' };
      else if (nd) {
        const best = nd.gains.find((g) => g.attr === nd.attr);
        nar = { title: `${nd.path.length ? nd.path.join(', ') : 'Root'} → split on ${nd.attr}`, text: `${nd.gains.map((g) => `${g.attr} ${fx(g.gain, 3)}`).join(' · ')}. <b>${nd.attr}</b> has the largest gain (${fx(best.gain, 3)}), so we branch on it: ${best.parts.map((p) => `${p.value} [${p.pos}+, ${p.neg}−]`).join(', ')}.` };
      }
    } else if (!N) nar = { title: 'Give me some points!', text: 'Pick a dataset, or choose a class and click on the canvas.' };
    else if (S.phase === 'ready') nar = { title: `Root node · ${N} points`, text: `Everything starts in one leaf that predicts the ${L.task === 'reg' ? '<b>average</b> y' : '<b>majority class</b>'}. Press <b>Step</b> to search every threshold for the best first question.` };
    else if (S.phase === 'done') {
      const lec = L.lecture?.id === 'lec-dt-house';
      nar = lec
        ? { title: 'Stop: weighted MSE 541.7 < 600', text: 'The best split (size < 1600) already brings the error below the slide threshold, so the tree stops: <b>≤ 1600 → 180</b>, <b>> 1600 → 275</b>. New houses: 900 → 180, 2500 → 275.' }
        : { title: `Done: depth ${b.depth}, ${b.leaves} leaves`, text: `${S.leafNote ? `Last check: ${S.leafNote}. ` : ''}Every remaining leaf is pure or hit a stopping rule. Drag points or change the depth — the tree regrows live.` };
    } else {
      const nd = b.nodes[S.cur];
      const fn = featNames()[nd.feature];
      const imp = L.task === 'reg' ? 'MSE' : S.criterion === 'gini' ? 'Gini' : 'entropy';
      nar = { title: `Node ${nd.id} (depth ${nd.depth}, ${nd.idx.length} pts): ask “${fn} < ${fmt(nd.thr, L.lecture ? 0 : 3)}?”`, text: `${imp} goes from <b>${fx(nd.stats.imp, 3)}</b> to a weighted <b>${fx(nd.childImp, 3)}</b> across the two halves (${b.nodes[nd.left].idx.length} yes / ${b.nodes[nd.right].idx.length} no).${S.leafNote ? ` <i>A node before it became a leaf: ${S.leafNote}.</i>` : ''}` };
    }
    L.narrate({ emoji: '', ...nar }, active);
    renderWorked();
  }

  function drawSearch() {
    if (isId3()) return;
    const b = S.b;
    const nd = b && S.cur >= 0 ? b.nodes[S.cur] : b && S.sel >= 0 ? b.nodes[S.sel] : null;
    const sr = nd?.search;
    if (!sr) { searchChart.setLine([], { empty: b ? 'Press Step to search' : 'Add points' }); searchNote.textContent = ''; return; }
    const fc = sr.cands.find((c) => c.feature === nd.feature) || sr.cands[0];
    const pts = fc.cands.map((c) => ({ y: c.childImp, color: Math.abs(c.thr - nd.thr) < 1e-12 ? '#E07A5F' : '#DDD3C4' }));
    searchChart.setLine(pts, { dots: pts.length <= 40, noArea: true, xLabel: `thresholds on ${featNames()[fc.feature]} (sorted)` });
    searchNote.innerHTML = `Weighted impurity after each candidate split. The tree takes the <b style="color:#E07A5F">lowest</b> one${L.task === 'cls' ? ' (on whichever feature gives the overall minimum)' : ''}.`;
  }

  function renderWorked() {
    const N = n();
    const show = L.lecture || (N > 0 && N <= 12);
    L.worked.show(!!show);
    if (!show) return;
    const parts = [];
    if (isId3()) {
      const nd = S.cur >= 0 ? S.id3.nodes[S.cur] : null;
      const inNode = new Set((nd || S.id3.nodes[0]).rows.map((r) => r.name));
      parts.push(step(nd ? `Rows in this node (${nd.path.join(', ') || 'root'})` : 'The 14 training days'));
      parts.push(table(['Day', 'Outlook', 'Temp', 'Humidity', 'Wind', 'Play'], TENNIS.rows.map((r) => ({
        rowCls: inNode.has(r.name) ? '' : 'dimrow',
        cells: [{ v: r.name, cls: 'rh' }, r.Outlook, r.Temperature, r.Humidity, r.Wind, { v: r.label ? 'Yes' : 'No', cls: r.label ? 'ok' : 'bad' }],
      }))));
      if (nd) {
        parts.push(step(`Information gain · E(S) = ${fx(nd.gains[0].E, 3)}`));
        parts.push(table(['Attribute', 'Branches [+, −]', 'Gain'], nd.gains.map((g) => ({
          rowCls: g.attr === nd.attr ? 'cur' : '',
          cells: [{ v: g.attr, cls: 'rh' }, g.parts.map((p) => `${p.value} [${p.pos},${p.neg}]`).join(' · '), { v: fx(g.gain, 3), cls: g.attr === nd.attr ? 'ok' : '' }],
        }))));
        if (!nd.path.length) parts.push(note('📌 Slide 18 writes the Sunny-branch entropy as “0.0971”; the correct value is <b>0.971</b> (2 Yes, 3 No). The gains above are unaffected.', 'pin'));
      } else if (S.phase === 'ready') parts.push(para('Press <b>Step</b> to compute the gain of each attribute at the root.'));
      L.worked.set(parts, 'ID3 · entropy');
      return;
    }
    const b = S.b;
    if (!b) return;
    const nd = S.cur >= 0 ? b.nodes[S.cur] : null;
    if (L.task === 'reg' && nd?.search) {
      const fc = nd.search.cands[0];
      parts.push(step(`Node ${nd.id}: every midpoint threshold`));
      parts.push(table(['Split', 'Mean L', 'Mean R', 'MSE L', 'MSE R', 'Wtd.'], fc.cands.map((c) => ({
        rowCls: Math.abs(c.thr - nd.thr) < 1e-9 ? 'cur' : '',
        cells: [{ v: fmt(c.thr, 1), cls: 'rh' }, fx(c.left.mean, 1), fx(c.right.mean, 1), fx(c.left.imp, 1), fx(c.right.imp, 1), { v: fx(c.childImp, 1), cls: Math.abs(c.thr - nd.thr) < 1e-9 ? 'ok' : '' }],
      }))));
      parts.push(para(`Best: <b>${featNames()[0]} < ${fmt(nd.thr, 1)}</b> with weighted MSE <b>${fx(nd.childImp, 1)}</b>.`));
      if (L.lecture?.id === 'lec-dt-house') {
        parts.push(para(`541.7 < 600 (the threshold) → stop splitting. Leaves predict their means: <b>180</b> and <b>275</b>.`));
        parts.push(note('📌 The slide’s rows for 1100, 1250, 1400 and 1850 contain arithmetic slips (for example at 1850 the left mean is <b>194</b>, not 184). The values above are recomputed; the winning split, <b>1600</b>, is the same as on the slide.', 'pin'));
      }
    } else if (nd?.search) {
      const C = L.nClasses;
      parts.push(step(`Node ${nd.id}: ${nd.idx.length} points`));
      parts.push(table(['Feature', 'Best threshold', 'Weighted impurity'], nd.search.cands.map((fc) => {
        const best = fc.cands.reduce((a, c) => (!a || c.childImp < a.childImp ? c : a), null);
        return { rowCls: fc.feature === nd.feature ? 'cur' : '', cells: [{ v: featNames()[fc.feature], cls: 'rh' }, best ? fx(best.thr, 3) : '–', best ? fx(best.childImp, 3) : '–'] };
      })));
      const cnt = (id) => b.nodes[id].stats.counts.map((c) => fmt(c, 0)).join(' / ');
      parts.push(para(`Class counts — node: ${nd.stats.counts.map((c) => fmt(c, 0)).join(' / ')}, yes: ${cnt(nd.left)}, no: ${cnt(nd.right)} (${C} classes).`));
    } else if (S.phase === 'ready') parts.push(para('Press <b>Step</b> to try every threshold at the root.'));
    else if (S.phase === 'done') {
      parts.push(step('Leaves'));
      parts.push(table(['Leaf', 'Points', 'Prediction'], b.nodes.filter((x) => x.leaf).map((x) => [{ v: `#${x.id}`, cls: 'rh' }, x.idx.length, L.task === 'reg' ? fx(x.value, 1) : `class ${argmax(x.value) + 1}`])));
    }
    L.worked.set(parts, L.task === 'reg' ? 'MSE' : S.criterion);
  }

  /* ---------------- challenges ---------------- */
  const actions = {
    house: () => { L.loadLecture(LECTURES[0]); L.focusStage(); },
    tennis: () => { L.loadLecture(LECTURES[1]); L.focusStage(); },
    moons: () => { L.loadDataset('cmoons'); S.maxDepth = 8; depthSlider.set(8); reset(); finish(); L.focusStage(); },
    noisy: () => { L.loadDataset('cnoisy'); S.maxDepth = 10; S.minLeaf = 1; depthSlider.set(10); leafSlider.set(1); reset(); finish(); L.focusStage(); },
  };

  L.loadDataset('cmoons');
  return () => { tree.dispose(); searchChart.dispose(); L.dispose(); };
}
