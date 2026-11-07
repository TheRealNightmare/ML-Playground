import * as THREE from 'three';
import { statTiles, COLORS, INK_C, GREY, WHITE } from '../../core/pointlab.js';
import { createSupLab } from '../../core/suplab.js';
import { sigmoid, rng } from '../../core/trees.js';
import { MiniChart } from '../../core/chart.js';
import { h, section, slider, segmented, toggle, button } from '../../core/ui.js';
import { table, note, para, step, fmt, fx } from '../../core/worked.js';
import { CLS_SETS } from '../../core/supdata.js';
import { LECTURES, CUSTOMERS, intuitionTab, mathTab, challengesTab } from './content.js';

const TERRA = new THREE.Color(0xe07a5f);
const MUTE = new THREE.Color(0x8a7c6e);
const CATS = ['Red', 'Blue', 'Green', 'Yellow'];
const RATES = [0.8, 0.3, 0.55, 0.15];
const LANE_Y = [0.5, 0.17, -0.17, -0.5];

/* ---------- oblivious tree: one (feature, threshold) per level ---------- */
function obliviousTree(X, g, hs, depth) {
  const n = X.length, nf = X[0]?.length || 1;
  let leaf = new Array(n).fill(0);
  const levels = [];
  for (let d = 0; d < depth; d++) {
    let best = null;
    const nLeaves = 1 << d;
    for (let f = 0; f < nf; f++) {
      const vals = [...new Set(X.map((x) => x[f]))].sort((a, b) => a - b);
      const step = Math.max(1, Math.floor(vals.length / 48));
      for (let k = step; k < vals.length; k += step) {
        const thr = (vals[k - 1] + vals[k]) / 2;
        const G = new Float64Array(nLeaves * 2), H = new Float64Array(nLeaves * 2);
        for (let i = 0; i < n; i++) { const c = leaf[i] * 2 + (X[i][f] < thr ? 0 : 1); G[c] += g[i]; H[c] += hs[i]; }
        let sc = 0;
        for (let c = 0; c < nLeaves * 2; c++) if (H[c] > 0) sc += (G[c] * G[c]) / (H[c] + 1e-3);
        if (!best || sc > best.score + 1e-12) best = { f, thr, score: sc };
      }
    }
    if (!best) break;
    levels.push(best);
    leaf = leaf.map((l, i) => l * 2 + (X[i][best.f] < best.thr ? 0 : 1));
  }
  const K = 1 << levels.length;
  const G = new Float64Array(K), H = new Float64Array(K), cnt = new Array(K).fill(0);
  leaf.forEach((l, i) => { G[l] += g[i]; H[l] += hs[i]; cnt[l]++; });
  const values = Array.from({ length: K }, (_, l) => (H[l] > 0 ? G[l] / (H[l] + 1e-3) : 0));
  const leafOf = (x) => levels.reduce((l, lv) => l * 2 + (x[lv.f] < lv.thr ? 0 : 1), 0);
  return { levels, values, cnt, leafOf, predict: (x) => values[leafOf(x)] };
}

export function mount(root) {
  const S = {
    mode: 'encode', N: 16, a: 1, prior: 0.5, leaky: false, seed: 3,
    enc: null, k: 0, phase: 'ready',
    depth: 2, eta: 0.5, T: 30, trees: [], F0: 0,
  };

  const CATENC = { id: 'catenc', task: 'cls', label: 'Customers', make: () => genCustomers(), note: '' };
  const L = createSupLab(root, {
    extraDatasets: { catenc: CATENC },
    meta: { accent: '#8A5A83', title: 'CatBoost', emoji: '', category: 'Supervised · Boosting', level: 'Advanced', blurb: 'Turn categories into numbers without leaking the answer (ordered target encoding), then boost symmetric trees.' },
    tasks: ['cls'],
    clsSets: CLS_SETS.filter((id) => id !== 'cthree'),
    defaultDataset: 'cxor',
    n: { min: 20, max: 400, step: 10, value: 160 },
    maxPoints: 500,
    interval: 0.7,
    lectures: LECTURES,
    phaseTrack: [
      { id: 'ready', label: 'Start' },
      { id: 'grow', label: 'Encode / boost', loopBack: true },
      { id: 'done', label: 'Done' },
    ],
    learnTabs: [
      { id: 'intuition', label: 'Intuition', render: intuitionTab },
      { id: 'math', label: '∑ Math', render: mathTab },
      { id: 'try', label: 'Try this', render: () => challengesTab(actions) },
    ],
  });
  const lec = () => L.lecture;
  const enc = () => S.mode === 'encode' && !lec();

  /* ================= ordered encoding (free mode) ================= */
  function genCustomers() {
    S.seed++;
    const r = rng(S.seed * 131 + S.N);
    const rows = Array.from({ length: S.N }, (_, i) => { const c = Math.floor(r() * CATS.length); return { id: i + 1, cat: c, y: r() < RATES[c] ? 1 : 0 }; });
    const perm = rows.map((_, i) => i);
    for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    S.prior = rows.reduce((s, x) => s + x.y, 0) / rows.length;
    S.enc = { rows, perm };
    CATENC.note = `${S.N} customers with a categorical colour (hidden purchase rates: ${CATS.map((c, k) => `${c} ${Math.round(RATES[k] * 100)}%`).join(', ')}), shown in a random order — the permutation.`;
    return perm.map((ri, pos) => ({ x: perm.length === 1 ? 0 : -0.84 + (1.68 * pos) / (perm.length - 1), y: LANE_Y[rows[ri].cat], label: rows[ri].y, name: S.N <= 20 ? String(rows[ri].id) : null }));
  }
  const makeCustomers = () => L.loadDataset(CATENC);
  /** CTR for permutation position `pos` (ordered) or the leaky version. Works for free mode and the lecture. */
  function ctrAt(rows, perm, pos, leaky = false) {
    const ri = perm[pos], c = rows[ri].cat;
    const pool = leaky ? perm : perm.slice(0, pos);
    const same = pool.filter((j) => rows[j].cat === c);
    const s = same.reduce((t, j) => t + rows[j].y, 0);
    return { ctr: (s + S.a * S.prior) / (same.length + S.a), sum: s, cnt: same.length, prev: same };
  }

  /* ================= boosting with oblivious trees ================= */
  const F = (x, upto = S.trees.length) => { let s = S.F0; for (let t = 0; t < upto; t++) s += S.eta * S.trees[t].predict(x); return s; };
  function boostRound() {
    const X = L.X(), y = L.Y();
    const p = X.map((x) => sigmoid(F(x)));
    return obliviousTree(X, p.map((v, i) => y[i] - v), p.map((v) => v * (1 - v)), S.depth);
  }

  /* ================= lecture (scripted, exact slide numbers) ================= */
  const LROWS = CUSTOMERS.map((c) => ({ id: c.id, cat: ['Red', 'Blue', 'Green'].indexOf(c.color), y: c.y, age: c.age }));
  const lecPerm = () => lec().perm.map((id) => id - 1);
  const lecTree = () => {
    const l = LROWS.filter((r) => r.age < lec().split), rr = LROWS.filter((r) => r.age >= lec().split);
    const res = (r) => r.y - lec().prior;
    return { L: l.reduce((s, r) => s + res(r), 0) / l.length, R: rr.reduce((s, r) => s + res(r), 0) / rr.length };
  };
  const lecPred = (age, k = S.k) => (k >= 7 ? lec().prior + lec().eta * (age < lec().split ? lecTree().L : lecTree().R) : lec().prior);

  /* ================= flow ================= */
  const total = () => (lec() ? 8 : enc() ? S.N : S.T);
  function reset() {
    L.normalizeTask();
    S.k = 0; S.phase = 'ready'; S.trees = [];
    if (S.mode === 'encode' && !lec() && L.datasetId !== 'catenc') { S.mode = 'boost'; modeSeg.set('boost'); }
    if (lec()) { S.a = lec().a; S.prior = lec().prior; aSlider.set(S.a); }
    if (S.mode === 'boost' && !lec() && L.points.length) {
      if (L.nClasses > 2) { L.toast('Binary data only here — loading XOR'); L.loadDataset('cxor'); return; }
      const m = Math.min(Math.max(L.Y().reduce((a, c) => a + c, 0) / L.points.length, 0.02), 0.98);
      S.F0 = Math.log(m / (1 - m));
    }
    refresh();
  }
  function doStep() {
    if (lec() || enc()) { if (S.k >= total()) return false; S.k++; S.phase = S.k >= total() ? 'done' : 'grow'; refresh(); return S.k < total(); }
    if (!L.points.length) return false;
    if (S.trees.length >= S.T) { S.phase = 'done'; refresh(); return false; }
    S.trees.push(boostRound());
    S.phase = S.trees.length >= S.T ? 'done' : 'grow';
    refresh();
    return S.phase !== 'done';
  }
  function finish() {
    L.player.pause();
    if (lec() || enc()) { S.k = total(); S.phase = 'done'; refresh(); return; }
    if (!L.points.length) return;
    while (S.trees.length < S.T) S.trees.push(boostRound());
    S.phase = 'done'; refresh();
  }
  function rerun() {
    if (lec() || enc()) { refresh(); return; }
    const k = S.trees.length;
    reset();
    for (let t = 0; t < Math.min(k, S.T); t++) S.trees.push(boostRound());
    S.phase = !S.trees.length ? 'ready' : S.trees.length >= S.T ? 'done' : 'grow';
    refresh();
  }
  function setMode(m) {
    S.mode = m; modeSeg.set(m); syncControls();
    if (m === 'encode') makeCustomers(); else L.loadDataset('cxor');
  }

  /* ================= hooks ================= */
  L.hooks.reset = reset;
  L.hooks.step = doStep;
  L.hooks.onEdit = () => rerun();
  L.hooks.canEdit = () => S.mode === 'boost' && !lec();
  L.hooks.lockedMessage = 'This view is generated from the customer table — switch to Boosting mode to draw';
  L.hooks.onDatasetSup = (ds) => {
    const m = ds.id === 'catenc' ? 'encode' : 'boost';
    if (S.mode !== m) { S.mode = m; modeSeg.set(m); }
    syncControls();
  };
  L.hooks.onLectureSup = () => { S.mode = 'boost'; modeSeg.set('boost'); syncControls(); };

  L.hooks.frameSup = () => {
    const segs = [];
    if (enc() && S.k >= 1 && S.k <= S.N && S.phase !== 'done') {
      const pos = S.k - 1;
      const c = ctrAt(S.enc.rows, S.enc.perm, pos, S.leaky);
      const me = L.points[pos];
      for (const j of c.prev) {
        const q = L.points[S.enc.perm.indexOf(j)];
        if (q !== me) segs.push({ x1: me.wx, y1: me.wy, x2: q.wx, y2: q.wy, w: 0.005, col: S.enc.perm.indexOf(j) > pos ? TERRA : INK_C });
      }
    }
    if (S.mode === 'boost' && !lec() && L.task === 'cls' && S.trees.length) {
      const tr = S.trees[S.trees.length - 1];
      const v = L.stage.view;
      for (const lv of tr.levels) {
        if (lv.f === 0) { const x = L.space.w({ x: lv.thr, y: 0 }).x; segs.push({ x1: x, y1: -v.halfH, x2: x, y2: v.halfH, w: 0.008, col: TERRA }); }
        else { const y = L.space.w({ x: 0, y: lv.thr }).y; segs.push({ x1: -v.halfW, y1: y, x2: v.halfW, y2: y, w: 0.008, col: TERRA }); }
      }
    }
    if (lec() && S.k === 6) for (const p of L.points) {
      const a = L.space.w({ x: p.x, y: p.y }), b = L.space.w({ x: p.x, y: lec().prior });
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, w: 0.006, col: MUTE });
    }
    L.segs.sync(segs);
  };

  L.hooks.labels = () => {
    const out = [];
    const v = L.stage.view;
    if (enc()) {
      CATS.forEach((c, k) => out.push({ x: -v.halfW + 0.02, y: LANE_Y[k], text: c, cls: 'tip', dx: 4, dy: -34 }));
      const upto = S.phase === 'done' ? S.N : S.k;
      if (S.N <= 24) for (let pos = 0; pos < upto; pos++) { const p = L.points[pos]; out.push({ x: p.wx, y: p.wy, text: fx(ctrAt(S.enc.rows, S.enc.perm, pos, S.leaky).ctr, 2), cls: pos === S.k - 1 ? 'tip' : '', dx: -14, dy: 12 }); }
      return out;
    }
    if (lec()) {
      const perm = lecPerm();
      perm.forEach((ri, pos) => {
        if (S.k <= pos || S.k > 5) return;
        const p = L.points[ri];
        out.push({ x: p.wx, y: p.wy, text: `CTR ${fx(ctrAt(LROWS, perm, pos).ctr, 2)}`, cls: pos === S.k - 1 ? 'tip' : '', dx: -20, dy: p.label ? -54 : 14 });
      });
      if (S.k >= 6) L.points.forEach((p, i) => {
        const pred = lecPred(LROWS[i].age);
        out.push({ x: p.wx, y: p.wy, text: S.k === 6 ? `r = ${fx(LROWS[i].y - lec().prior, 1)}` : `ŷ ${fx(pred, 4)}`, cls: 'tip', dx: -20, dy: p.label ? -54 - (i % 2) * 24 : 14 + (i % 2) * 24 });
      });
    }
    return out;
  };

  /* ================= controls ================= */
  const modeSeg = segmented({ label: 'View', options: [{ value: 'encode', label: 'Encoding' }, { value: 'boost', label: 'Boosting' }], value: S.mode, onChange: (v) => setMode(v) });
  const nSlider = slider({ label: 'Customers', min: 5, max: 60, step: 1, value: S.N, onInput: (v) => { S.N = v; makeCustomers(); } });
  const aSlider = slider({ label: 'Smoothing a', min: 0, max: 5, step: 0.5, value: S.a, format: (v) => v.toFixed(1), onInput: (v) => { S.a = v; refresh(); } });
  const leakToggle = toggle({ label: 'Show leaky (greedy) encoding', value: S.leaky, onChange: (v) => { S.leaky = v; refresh(); } });
  const permBtn = button('New permutation', () => { S.seed++; makeCustomers(); }, { variant: 'btn-ghost btn-block' });
  const dSlider = slider({ label: 'Oblivious tree depth', min: 1, max: 4, step: 1, value: S.depth, onInput: (v) => { S.depth = v; rerun(); } });
  const etaSlider = slider({ label: 'Learning rate η', min: 0.05, max: 1, step: 0.05, value: S.eta, format: (v) => v.toFixed(2), onInput: (v) => { S.eta = v; rerun(); } });
  const tSlider = slider({ label: 'Trees', min: 1, max: 100, step: 1, value: S.T, onInput: (v) => { S.T = v; rerun(); } });
  const hint = h('span', { class: 'hint' });
  L.addControls(section([L.num(3), 'CatBoost'], modeSeg.el, hint, nSlider.el, aSlider.el, leakToggle.el, permBtn, dSlider.el, etaSlider.el, tSlider.el, button('Run to the end', finish, { variant: 'btn-block' })));
  function syncControls() {
    const e = S.mode === 'encode' && !lec(), b = S.mode === 'boost' && !lec();
    const show = (el, v) => { el.style.display = v ? '' : 'none'; };
    show(nSlider.el, e); show(aSlider.el, e); show(leakToggle.el, e); show(permBtn, e);
    show(dSlider.el, b); show(etaSlider.el, b); show(tSlider.el, b);
    hint.innerHTML = lec() ? 'Lecture walk-through: Steps 1–5 encode the colours, 6 computes residuals, 7 builds the tree.' : e ? 'Each <b>Step</b> encodes the next customer in the permutation using only the customers before it with the same colour (black lines).' : 'Gradient boosting with <b>oblivious</b> trees: one question per level, shared by all nodes.';
  }

  /* ================= side ================= */
  const stats = statTiles([['a', 'A'], ['b', 'B'], ['c', 'C'], ['d', 'D']]);
  const labs = stats.el.querySelectorAll('.stat-label');
  const chart = new MiniChart({ height: 130, xLabel: '', empty: '' });
  const chartLabel = h('div', { class: 'sub-label' });
  const chartNote = h('div', { class: 'chart-note' });
  const levelsBox = h('div', { class: 'chart-note' });
  L.mountSide(h('div', { class: 'card side-card' }, h('h3', {}, 'Live numbers'), stats.el, levelsBox, chartLabel, chart.canvas, chartNote));

  /* ================= refresh ================= */
  function refresh() {
    syncControls();
    const set = (i, key, label, v) => { labs[i].textContent = label; stats.set(key, v); };
    L.colorPoints();
    levelsBox.innerHTML = '';
    if (enc()) {
      L.showField(null); L.setCurves([]);
      const done = S.phase === 'done' ? S.N : S.k;
      L.points.forEach((p, pos) => { if (pos >= done) { p.oc = p.tc; p.tc = WHITE; p.fr = 0.45; p.sz = 0.85; } else p.sz = pos === S.k - 1 ? 1.5 : 1; });
      const cur = S.k >= 1 ? ctrAt(S.enc.rows, S.enc.perm, S.k - 1, S.leaky) : null;
      set(0, 'a', 'Customer', S.k ? `${S.k}/${S.N}` : `0/${S.N}`);
      set(1, 'b', 'Same colour before', cur ? `${cur.cnt} (Σy ${cur.sum})` : '–');
      set(2, 'c', 'Prior P', fx(S.prior, 2));
      set(3, 'd', 'CTR', cur ? fx(cur.ctr, 3) : '–');
      chartLabel.textContent = 'Encoded value vs. own label';
      const pts = S.enc.perm.map((ri, pos) => ({ label: String(S.enc.rows[ri].id), value: ctrAt(S.enc.rows, S.enc.perm, pos, S.leaky).ctr, color: S.enc.rows[ri].y ? '#3D8B8B' : '#E07A5F', highlight: pos === S.k - 1 }));
      chart.setBars(pts.slice(0, Math.max(S.k, S.phase === 'done' ? S.N : 0)), { xLabel: 'customers in permutation order (colour = own label)', empty: 'Press Step', ref: { y: S.prior, label: 'prior' } });
      const leakGap = (() => { let a = 0, b = 0, c = 0, d = 0; S.enc.perm.forEach((ri, pos) => { const r = S.enc.rows[ri]; const v = ctrAt(S.enc.rows, S.enc.perm, pos, S.leaky).ctr; if (r.y) { a += v; b++; } else { c += v; d++; } }); return (a / (b || 1)) - (c / (d || 1)); })();
      chartNote.innerHTML = `Average encoding of buyers minus non-buyers: <b>${fx(leakGap, 3)}</b>${S.leaky ? ' — inflated, because each row sees its own label.' : '. Switch on the leaky encoding to see how much bigger it gets.'}`;
    } else if (lec()) {
      L.showField(null);
      L.setCurves([{ fn: () => 0.5, color: MUTE, width: 0.003, fade: 0.5 }, { fn: (x) => lecPred(x), color: TERRA, width: 0.012, step: true }]);
      const perm = lecPerm();
      set(0, 'a', 'Step', `${S.k}/8`);
      set(1, 'b', 'F₀', '0.6');
      set(2, 'c', 'Last CTR', S.k >= 1 && S.k <= 5 ? fx(ctrAt(LROWS, perm, S.k - 1).ctr, 2) : '–');
      set(3, 'd', 'η', '0.5');
      chartLabel.textContent = ''; chart.setBars([], { empty: '' }); chartNote.textContent = '';
      chart.canvas.style.display = 'none';
    } else {
      chart.canvas.style.display = '';
      const K = S.trees.length;
      L.setCurves([]);
      L.showField(L.points.length ? (x) => { const p = sigmoid(F(x)); return [1 - p, p]; } : null);
      const acc = L.points.length ? L.accuracy((x) => (sigmoid(F(x)) > 0.5 ? 1 : 0)) : null;
      set(0, 'a', 'Trees', `${K}/${S.T}`);
      set(1, 'b', 'Leaves/tree', String(1 << S.depth));
      set(2, 'c', 'Train acc.', acc == null ? '–' : `${Math.round(acc * 100)}%`);
      set(3, 'd', 'F₀ (log-odds)', fx(S.F0, 3));
      const tr = S.trees[K - 1];
      if (tr) levelsBox.innerHTML = `Tree ${K}: ${tr.levels.map((lv, d) => `level ${d + 1}: <b>${['x', 'y'][lv.f]} &lt; ${fmt(lv.thr, 2)}</b>`).join(' · ')} → ${tr.values.length} leaves.`;
      chartLabel.textContent = 'Training log-loss after each tree';
      const X = L.X(), y = L.Y();
      const ll = (upto) => X.reduce((s, x, i) => { const p = Math.min(Math.max(sigmoid(F(x, upto)), 1e-9), 1 - 1e-9); return s - (y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p)); }, 0) / (X.length || 1);
      chart.setLine(S.trees.map((_, t) => ({ y: ll(t + 1) })), { xLabel: 'trees', dots: K <= 40, empty: 'Press Step' });
      chartNote.innerHTML = 'The red lines on the canvas are the latest tree’s questions — each one cuts the <i>whole</i> plane, because oblivious trees ask the same question in every node of a level.';
    }
    if (!lec()) chart.canvas.style.display = '';
    narrate();
    renderWorked();
  }

  function narrate() {
    let nar;
    if (enc()) {
      if (!S.k) nar = { title: `${S.N} customers in a random order`, text: `Each customer has a colour (lane) and bought (teal) or not (orange). We will replace the colour by a number using only <b>earlier</b> customers. Prior P = ${fx(S.prior, 2)}, a = ${fmt(S.a, 1)}.` };
      else if (S.phase === 'done') nar = { title: 'Every customer encoded', text: 'Each value was computed from the past only, so no row ever saw its own label. Compare with the leaky encoding using the toggle.' };
      else {
        const pos = S.k - 1, r = S.enc.rows[S.enc.perm[pos]], c = ctrAt(S.enc.rows, S.enc.perm, pos, S.leaky);
        nar = { title: `Customer ${r.id} (${CATS[r.cat]}): CTR = (${c.sum} + ${fmt(S.a, 1)}·${fx(S.prior, 2)}) / (${c.cnt} + ${fmt(S.a, 1)}) = ${fx(c.ctr, 3)}`, text: S.leaky ? '<b>Leaky</b>: uses every customer with this colour, including this one and later ones (red lines).' : c.cnt ? `Uses the ${c.cnt} earlier ${CATS[r.cat]} customer${c.cnt === 1 ? '' : 's'} only (black lines).` : `No earlier ${CATS[r.cat]} customer, so the value is just the prior.` };
      }
    } else if (lec()) {
      const perm = lecPerm();
      if (!S.k) nar = { title: 'F₀ = (1 + 0 + 1 + 0 + 1) / 5 = 0.6', text: 'Every customer starts with prediction 0.6. Next we encode Colour in the permutation order (2, 1, 5, 3, 4).' };
      else if (S.k <= 5) {
        const ri = perm[S.k - 1], r = CUSTOMERS[ri], c = ctrAt(LROWS, perm, S.k - 1);
        nar = { title: `Sample ${r.id} (${r.color}): CTR = (${c.sum} + 0.6) / (${c.cnt} + 1) = ${fx(c.ctr, 2)}`, text: c.cnt ? `There ${c.cnt === 1 ? 'is' : 'are'} ${c.cnt} earlier ${r.color} sample${c.cnt === 1 ? '' : 's'} in the permutation with target sum ${c.sum}.` : `No earlier ${r.color} sample in the permutation, so the CTR is the prior.` };
      } else if (S.k === 6) nar = { title: 'Residuals r = y − 0.6', text: 'Buyers have r = 0.4, non-buyers r = −0.6 (grey sticks). The first tree is fitted to these.' };
      else if (S.k === 7) { const t = lecTree(); nar = { title: `Tree 1: Age < 28 → ${fx(t.L, 2)}, otherwise ${fx(t.R, 3)}`, text: `Left leaf = mean(0.4, 0.4); right leaf = mean(−0.6, −0.6, 0.4). With η = 0.5: 0.6 + 0.5·0.40 = <b>0.80</b> and 0.6 + 0.5·(−0.267) = <b>0.4667</b>.` }; }
      else nar = { title: 'New residuals: 0.20, −0.467, 0.20, −0.467, 0.533', text: 'They become the targets of tree 2, and so on. Customer 5 (a young-ish buyer on the right) is now the hardest case.' };
    } else {
      const K = S.trees.length;
      nar = !L.points.length ? { title: 'Give me some points!', text: 'Pick a dataset or click on the canvas.' } : !K ? { title: `Start: F₀ = log-odds of the mean = ${fx(S.F0, 3)}`, text: 'Each <b>Step</b> builds one oblivious tree on the residuals y − p and adds η × its leaf values.' } : { title: `Tree ${K} added`, text: `Its ${S.depth} question${S.depth === 1 ? '' : 's'} (red lines) split the whole plane into ${1 << S.depth} cells; each cell gets one correction value.` };
    }
    L.narrate({ emoji: '', ...nar }, S.phase);
  }

  function renderWorked() {
    const show = lec() || (enc() && S.N <= 24);
    L.worked.show(!!show);
    if (!show) return;
    const parts = [];
    if (enc()) {
      parts.push(table(['#', 'Customer', 'Colour', 'y', 'Earlier same', 'CTR'], S.enc.perm.map((ri, pos) => {
        const r = S.enc.rows[ri], c = ctrAt(S.enc.rows, S.enc.perm, pos, S.leaky), shown = pos < (S.phase === 'done' ? S.N : S.k);
        return { rowCls: pos === S.k - 1 ? 'cur' : shown ? '' : 'dimrow', cells: [pos + 1, { v: r.id, cls: 'rh' }, CATS[r.cat], r.y, shown ? `${c.cnt} (Σ ${c.sum})` : '…', shown ? fx(c.ctr, 3) : '…'] };
      })));
      L.worked.set(parts, S.leaky ? 'leaky' : 'ordered');
      return;
    }
    const perm = lecPerm();
    parts.push(step('Ordered target encoding (a = 1, P = 0.6)'));
    parts.push(table(['Order', 'ID', 'Colour', 'Earlier same', 'CTR'], perm.map((ri, pos) => {
      const r = CUSTOMERS[ri], c = ctrAt(LROWS, perm, pos);
      return { rowCls: pos === S.k - 1 ? 'cur' : S.k > pos ? '' : 'dimrow', cells: [pos + 1, { v: r.id, cls: 'rh' }, r.color, S.k > pos ? `${c.cnt} (Σy ${c.sum})` : '…', S.k > pos ? fx(c.ctr, 2) : '…'] };
    })));
    if (S.k >= 5) parts.push(para('Encoded feature in permutation order: <b>[0.60, 0.60, 0.30, 0.80, 0.60]</b>.'));
    if (S.k >= 6) {
      const t = lecTree();
      parts.push(step('Residuals and the first tree (Age < 28)'));
      parts.push(table(['ID', 'Age', 'y', 'r = y − 0.6', 'Leaf', 'New ŷ', 'New r'], CUSTOMERS.map((c) => {
        const left = c.age < lec().split, pr = lecPred(c.age, 7);
        return { rowCls: '', cells: [{ v: c.id, cls: 'rh' }, c.age, c.y, fx(c.y - 0.6, 1), S.k >= 7 ? (left ? fx(t.L, 2) : fx(t.R, 3)) : '…', S.k >= 7 ? fx(pr, 4) : '…', S.k >= 8 ? fx(c.y - pr, 4) : '…'] };
      })));
    }
    if (S.k >= 7) {
      parts.push(note('📌 The slide’s “final prediction” F(x) = 0.60 + 0.5(0.40 − 0.267) = 0.6665 adds <b>both</b> leaves. A sample lands in only <b>one</b> leaf: F = 0.80 if Age &lt; 28, otherwise 0.4667.', 'pin'));
      parts.push(note('📌 Here F₀ = 0.6 is already a probability (the mean of y), so applying the sigmoid again (→ 0.6607) mixes two scales. Either read F directly as the probability (0.80 / 0.4667), or start from log-odds F₀ = ln(0.6/0.4) = 0.405 and apply the sigmoid at the end — the Boosting view does the latter.', 'pin'));
      parts.push(note('📌 The slide writes 0.4665 for 0.6 + 0.5·(−0.2667); rounded it is 0.4667. Tiny, but it explains the residuals −0.4665 / 0.5335 on the slide.', 'pin'));
    }
    L.worked.set(parts, 'slide numbers');
  }

  /* ================= challenges ================= */
  const actions = {
    lec: () => { L.loadLecture(LECTURES[0]); L.focusStage(); },
    encode: () => { S.N = 12; nSlider.set(12); setMode('encode'); L.focusStage(); },
    xor: () => { setMode('boost'); S.depth = 2; dSlider.set(2); rerun(); finish(); L.focusStage(); },
  };

  syncControls();
  makeCustomers();
  return () => { chart.dispose(); L.dispose(); };
}
