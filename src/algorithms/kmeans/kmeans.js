import * as THREE from 'three';
import { createLab } from '../../core/lab.js';
import { Stage } from '../../core/stage.js';
import { RegionBackground, PointLayer, StarLayer, LinkLayer, TrailLayer } from '../../core/layers.js';
import { Player } from '../../core/player.js';
import { MiniChart } from '../../core/chart.js';
import { h, section, slider, segmented, toggle, button, tabs } from '../../core/ui.js';
import { PALETTE, PALETTE_NAMES, NEUTRAL, INK, css } from '../../core/theme.js';
import * as KM from './algo.js';
import { DATASETS, findDataset, trickyStart, blobs } from './datasets.js';
import { narration, PHASE_TRACK, intuitionTab, mathTab, challengesTab } from './content.js';

const MAX_POINTS = 1500;
const COLORS = PALETTE.map((c) => new THREE.Color(c));
const GREY = new THREE.Color(NEUTRAL);
const INIT_INFO = {
  pp: 'Spreads the stars out: each new star prefers points far from the ones already placed. The default in most libraries.',
  random: 'Picks K random data points as the starting stars (the classic “Forgy” method). Fast, but sometimes unlucky.',
  spots: 'Drops the stars anywhere on the canvas — even in empty space. Watch out for stars that never get any points!',
};

export function mount(root) {
  const lab = createLab(root, {
    title: 'K-Means Clustering',
    emoji: '⭐',
    category: 'Unsupervised · Clustering',
    level: 'Beginner friendly',
    blurb: 'Group unlabeled points into K clusters by moving K centroids again and again.',
  });

  /* ---------------- State ---------------- */
  const S = {
    points: [],
    cents: [],
    K: 3,
    init: 'pp',
    dataset: 'blobs',
    n: 240,
    tool: 'draw',
    phase: 'empty',
    iter: 0,
    history: [],
    lastChanged: 0,
    lastShift: 0,
    emptyNote: '',
    show: { regions: true, links: true, trails: true },
    busy: false,
    chartMode: 'inertia',
  };

  /* ---------------- three.js stage ---------------- */
  const stage = new Stage(lab.stageHolder, { domain: 1.12 });
  const regions = new RegionBackground(stage);
  const links = new LinkLayer(stage, { max: MAX_POINTS, opacity: 0.3 });
  const trails = new TrailLayer(stage);
  const pointLayer = new PointLayer(stage, { max: MAX_POINTS, radius: 0.024 });
  const stars = new StarLayer(stage, { size: 0.072 });
  const brush = new THREE.Mesh(
    new THREE.RingGeometry(0.93, 1, 48),
    new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  brush.position.z = 5;
  brush.visible = false;
  stage.scene.add(brush);

  /* ---------------- Overlays ---------------- */
  const toastEl = h('div', { class: 'toast', role: 'status' });
  const emptyEl = h('div', { class: 'stage-empty' }, h('div', {}, h('span', { class: 'big' }, '👆'), 'Click anywhere to add points', h('br'), h('small', {}, 'or pick a dataset')));
  const tipEl = h('div', { class: 'stage-tip' });
  lab.overlay.append(emptyEl, tipEl, toastEl);
  let toastTimer = 0;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  };

  /* ---------------- Player ---------------- */
  const player = new Player({
    onStep: () => doStep(),
    onReset: () => { resetAlgo(); toast('Reset — same points, fresh start'); },
    isBusy: () => S.busy,
    baseInterval: 0.85,
  });
  lab.playbarSlot.append(player.el);
  player.el.append(h('span', { class: 'kbd-hint' }, h('span', { class: 'kbd' }, 'Space'), 'play ', h('span', { class: 'kbd' }, '→'), 'step ', h('span', { class: 'kbd' }, 'R'), 'reset'));
  player.onChange((playing) => {
    if (playing && S.points.length === 0) { player.pause(); toast('Add some points first 🙂'); }
  });

  /* ---------------- Points helpers ---------------- */
  const newPoint = (x, y, wait = 0) => ({ x, y, c: -1, col: GREY.clone(), s: 0, ts: 1, wait, delay: 0, pending: false });
  const targetColor = (p) => (p.c >= 0 ? COLORS[p.c % COLORS.length] : GREY);
  const centXY = () => S.cents.map((c) => ({ x: c.x, y: c.y }));

  function setPoints(xy, { stagger = true } = {}) {
    S.points = xy.slice(0, MAX_POINTS).map((p, i) => newPoint(p.x, p.y, stagger ? Math.min(0.5, (i / xy.length) * 0.5) : 0));
  }

  /* ---------------- Algorithm steps ---------------- */
  function initCentroids(custom) {
    const pts = S.points;
    const cs = custom
      || (S.init === 'pp' ? KM.initPlusPlus(pts, S.K)
        : S.init === 'random' ? KM.initRandomPoints(pts, S.K)
          : KM.initRandomSpots(S.K));
    S.cents = cs.map((c) => ({ x: c.x, y: c.y, dx: c.x, dy: c.y, hist: [], drag: false }));
    stars.setCount(0, PALETTE);
    stars.setCount(S.cents.length, PALETTE);
  }

  function record(kind) {
    S.history.push({ J: KM.inertia(S.points, centXY()), kind });
  }

  function doAssign() {
    const cents = centXY();
    let changed = 0;
    for (const p of S.points) {
      const [k] = KM.nearest(p, cents);
      if (p.c !== k) {
        changed++;
        p.c = k;
        const d = Math.sqrt(KM.dist2(p, cents[k]));
        p.delay = Math.min(0.65, d * 0.75); // ripple out from the star
        p.pending = true;
      }
    }
    return changed;
  }

  function doStep() {
    if (S.points.length === 0) { setPhase('empty'); toast('Add some points first 🙂'); return false; }
    if (S.phase === 'converged') { toast('Already converged — drag a ★ or change K'); return false; }

    if (S.cents.length === 0) {
      initCentroids();
      S.iter = 0;
      S.history = [];
      setPhase('init');
      return true;
    }
    if (S.phase === 'init' || S.phase === 'update' || S.phase === 'ready') {
      const changed = doAssign();
      S.lastChanged = changed;
      if (S.phase === 'update' && changed === 0) {
        record('assign');
        setPhase('converged');
        return false;
      }
      record('assign');
      setPhase('assign');
      return true;
    }
    // assign / edited → update
    const { next, empty, maxShift } = KM.update(S.points, centXY());
    S.cents.forEach((c, k) => {
      c.hist.push({ x: c.x, y: c.y });
      if (c.hist.length > 80) c.hist.shift();
      c.x = next[k].x; c.y = next[k].y;
    });
    S.lastShift = maxShift;
    S.emptyNote = empty.length
      ? `${empty.map((k) => PALETTE_NAMES[k]).join(' & ')} ★ ${empty.length > 1 ? 'have' : 'has'} no points, so ${empty.length > 1 ? 'they stay' : 'it stays'} put.`
      : '';
    S.iter++;
    record('update');
    setPhase('update');
    return true;
  }

  function resetAlgo() {
    S.cents = [];
    stars.setCount(0, PALETTE);
    for (const p of S.points) { if (p.c !== -1) { p.c = -1; p.delay = Math.random() * 0.25; p.pending = false; } }
    S.iter = 0;
    S.history = [];
    S.lastChanged = 0;
    S.emptyNote = '';
    setPhase(S.points.length ? 'ready' : 'empty');
  }

  /** After the user edits data or drags a star: re-assign live, no ripple. */
  function afterEdit() {
    if (S.cents.length && S.phase !== 'init') {
      const cents = centXY();
      for (const p of S.points) {
        const [k] = KM.nearest(p, cents);
        if (p.c !== k) { p.c = k; p.delay = 0; }
      }
      setPhase('edited');
    } else if (!S.cents.length) {
      setPhase(S.points.length ? 'ready' : 'empty');
    } else {
      refreshUI();
    }
    scheduleElbow();
  }

  /* ---------------- Data loading ---------------- */
  function loadDataset(id, { keepK = true } = {}) {
    S.dataset = id;
    const ds = findDataset(id);
    setPoints(ds.make(S.n));
    datasetChips.forEach((b) => b.classList.toggle('active', b.dataset.id === id));
    datasetNote.textContent = ds.note;
    resetAlgo();
    scheduleElbow(true);
    if (!keepK) kSlider.set(S.K);
  }

  function setK(k, silent = false) {
    if (k === S.K) { kSlider.set(k); return; }
    S.K = k;
    kSlider.set(k);
    paintKDots();
    resetAlgo();
    if (!silent) toast(`K = ${k} — press ▶ to start again`);
    updateChart();
  }

  /* ---------------- Pointer interaction ---------------- */
  let drag = null;
  let lastSpray = 0;
  const canvas = stage.canvas;
  const hitCent = (w) => {
    let best = -1, bd = (0.085) ** 2;
    S.cents.forEach((c, i) => { const d = (c.dx - w.x) ** 2 + (c.dy - w.y) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const hitPoint = (w) => {
    let best = -1, bd = (0.045) ** 2;
    S.points.forEach((p, i) => { const d = (p.x - w.x) ** 2 + (p.y - w.y) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const addPoint = (x, y) => {
    if (S.points.length >= MAX_POINTS) { toast(`That’s the max (${MAX_POINTS} points)`); return -1; }
    const p = newPoint(x, y);
    if (S.cents.length && S.phase !== 'init') { p.c = KM.nearest(p, centXY())[0]; p.col.copy(targetColor(p)); }
    S.points.push(p);
    return S.points.length - 1;
  };
  const eraseAt = (w, r = 0.075) => {
    const before = S.points.length;
    S.points = S.points.filter((p) => (p.x - w.x) ** 2 + (p.y - w.y) ** 2 > r * r);
    return before - S.points.length;
  };
  const spray = (w) => {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.075;
      const q = stage.clamp({ x: w.x + Math.cos(a) * r, y: w.y + Math.sin(a) * r });
      if (addPoint(q.x, q.y) < 0) break;
    }
  };

  const onDown = (ev) => {
    if (ev.button !== undefined && ev.button > 0) return;
    const w = stage.clamp(stage.toWorld(ev));
    canvas.setPointerCapture?.(ev.pointerId);
    const ci = hitCent(w);
    if (ci >= 0) {
      const c = S.cents[ci];
      c.drag = true; c.hist = [];
      drag = { type: 'cent', i: ci, ox: c.dx - w.x, oy: c.dy - w.y };
      player.pause();
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (S.tool === 'erase') {
      drag = { type: 'erase' };
      if (eraseAt(w)) afterEdit();
      return;
    }
    if (S.tool === 'spray') {
      drag = { type: 'spray' };
      spray(w); lastSpray = performance.now(); afterEdit();
      return;
    }
    const pi = hitPoint(w);
    if (pi >= 0) {
      drag = { type: 'point', i: pi, ox: S.points[pi].x - w.x, oy: S.points[pi].y - w.y };
      S.points[pi].ts = 1.6;
      canvas.style.cursor = 'grabbing';
      return;
    }
    const ni = addPoint(w.x, w.y);
    if (ni >= 0) {
      drag = { type: 'point', i: ni, ox: 0, oy: 0, fresh: true };
      S.points[ni].ts = 1.6;
      afterEdit();
    }
  };

  const onMove = (ev) => {
    const w = stage.toWorld(ev);
    const wc = stage.clamp(w);
    brush.position.x = w.x; brush.position.y = w.y;
    if (!drag) {
      const overCent = hitCent(w) >= 0;
      if (overCent) canvas.style.cursor = 'grab';
      else if (S.tool === 'draw') canvas.style.cursor = hitPoint(w) >= 0 ? 'grab' : 'crosshair';
      else canvas.style.cursor = 'none';
      brush.visible = !overCent && (S.tool === 'erase' || S.tool === 'spray');
      return;
    }
    if (drag.type === 'cent') {
      const c = S.cents[drag.i];
      const p = stage.clamp({ x: w.x + drag.ox, y: w.y + drag.oy });
      c.x = c.dx = p.x; c.y = c.dy = p.y;
      afterEdit();
    } else if (drag.type === 'point') {
      const p = S.points[drag.i];
      if (!p) return;
      const q = stage.clamp({ x: w.x + drag.ox, y: w.y + drag.oy });
      p.x = q.x; p.y = q.y;
      afterEdit();
    } else if (drag.type === 'erase') {
      if (eraseAt(wc)) afterEdit();
    } else if (drag.type === 'spray') {
      const now = performance.now();
      if (now - lastSpray > 28) { lastSpray = now; spray(wc); afterEdit(); }
    }
  };

  const onUp = (ev) => {
    if (!drag) return;
    if (drag.type === 'cent') S.cents[drag.i] && (S.cents[drag.i].drag = false);
    if (drag.type === 'point' && S.points[drag.i]) S.points[drag.i].ts = 1;
    drag = null;
    canvas.releasePointerCapture?.(ev.pointerId);
    onMove(ev);
  };
  const onLeave = () => { if (!drag) brush.visible = false; };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------------- Frame loop ---------------- */
  stage.onFrame((dt, t) => {
    player.update(dt);
    const sp = Math.max(player.speed, 0.5);
    const kC = 1 - Math.exp(-dt * 6.5 * sp);
    const kP = 1 - Math.exp(-dt * 12 * sp);
    const kS = 1 - Math.exp(-dt * 14);
    let busy = false;

    for (const c of S.cents) {
      if (!c.drag) {
        c.dx += (c.x - c.dx) * kC;
        c.dy += (c.y - c.dy) * kC;
        if (Math.abs(c.x - c.dx) + Math.abs(c.y - c.dy) > 0.003) busy = true;
        else { c.dx = c.x; c.dy = c.y; }
      }
    }
    for (const p of S.points) {
      if (p.wait > 0) { p.wait -= dt; p.s = 0; busy = true; continue; }
      if (p.delay > 0) { p.delay -= dt * sp; busy = true; }
      else {
        if (p.pending) { p.pending = false; p.s = Math.max(p.s, 1.55); }
        p.col.lerp(targetColor(p), kP);
      }
      p.s += (p.ts - p.s) * kS;
    }
    S.busy = busy;

    pointLayer.sync(S.points);
    const disp = S.cents.map((c) => ({ x: c.dx, y: c.dy, active: c.drag }));
    stars.update(disp, dt, t);
    regions.setCentroids(disp, PALETTE);
    regions.show(S.show.regions && S.cents.length > 0 && S.phase !== 'init');
    regions.update(dt);

    links.show(S.show.links && S.cents.length > 0);
    links.update(dt);
    if (links.lines.visible) {
      links.sync(S.points.length, (i) => {
        const p = S.points[i];
        if (p.c < 0 || p.delay > 0 || p.wait > 0) return null;
        const c = disp[p.c];
        return c ? [p.x, p.y, c.x, c.y, p.col] : null;
      });
    }
    trails.setVisible(S.show.trails);
    if (S.show.trails) trails.sync(S.cents.map((c, i) => ({ hist: c.hist, head: { x: c.dx, y: c.dy }, color: PALETTE[i % PALETTE.length] })));

    const r = S.tool === 'erase' ? 0.075 : 0.075;
    brush.scale.setScalar(r);
  });

  /* ---------------- Controls (left) ---------------- */
  const datasetNote = h('span', { class: 'hint' });
  const datasetChips = DATASETS.map((d) =>
    h('button', { type: 'button', class: 'chip', 'data-id': d.id, onclick: () => { player.pause(); loadDataset(d.id); } },
      h('span', { class: 'emo' }, d.emoji), d.label),
  );
  const nSlider = slider({
    label: 'Number of points', min: 40, max: 800, step: 20, value: S.n,
    onInput: (v) => { S.n = v; },
  });
  nSlider.el.querySelector('input').addEventListener('change', () => { if (S.dataset !== 'blank') loadDataset(S.dataset); });

  const toolSeg = segmented({
    options: [
      { value: 'draw', label: '✏️ Draw', title: 'Click to add a point, drag to move one' },
      { value: 'spray', label: '💨 Spray', title: 'Hold and drag to spray many points' },
      { value: 'erase', label: '🧽 Erase', title: 'Hold and drag to erase points' },
    ],
    value: S.tool,
    onChange: (v) => { S.tool = v; updateTip(); },
  });

  const kDots = h('div', { class: 'k-dots' }, PALETTE.map((c) => h('span', { class: 'k-dot', style: { background: css(c) } })));
  const paintKDots = () => [...kDots.children].forEach((d, i) => d.classList.toggle('off', i >= S.K));
  const kSlider = slider({
    label: 'K — number of clusters', min: 1, max: 8, step: 1, value: S.K,
    onInput: (v) => setK(v),
  });
  const initHint = h('span', { class: 'hint' }, INIT_INFO[S.init]);
  const initSeg = segmented({
    label: 'Starting positions',
    options: [
      { value: 'pp', label: 'K-Means++' },
      { value: 'random', label: 'Random pts' },
      { value: 'spots', label: 'Anywhere' },
    ],
    value: S.init,
    onChange: (v) => { S.init = v; initHint.textContent = INIT_INFO[v]; resetAlgo(); toast('New starting method — press ▶'); },
  });

  const tRegions = toggle({ label: 'Colored regions', emoji: '🗺️', value: S.show.regions, onChange: (v) => (S.show.regions = v) });
  const tLinks = toggle({ label: 'Lines to their ★', emoji: '🔗', value: S.show.links, onChange: (v) => (S.show.links = v) });
  const tTrails = toggle({ label: '★ footprints', emoji: '👣', value: S.show.trails, onChange: (v) => (S.show.trails = v) });

  const num = (n) => h('span', { class: 'num' }, n);
  lab.controls.append(
    section([num(1), 'Data'],
      h('div', { class: 'chips' }, datasetChips),
      datasetNote,
      nSlider.el,
      button('🔄 New sample', () => { player.pause(); loadDataset(S.dataset); }, { variant: 'btn-block' }),
    ),
    section([num(2), 'Draw your own'],
      toolSeg.el,
      h('span', { class: 'hint', html: 'Drag any point or ★ to move it. The algorithm reacts live.' }),
      button('🗑️ Clear canvas', () => { player.pause(); S.points = []; resetAlgo(); datasetChips.forEach((b) => b.classList.remove('active')); S.dataset = 'blank'; scheduleElbow(true); }, { variant: 'btn-ghost btn-block' }),
    ),
    section([num(3), 'K-Means settings'],
      kSlider.el,
      kDots,
      initSeg.el,
      initHint,
    ),
    section([num(4), 'Show'],
      tRegions.el, tLinks.el, tTrails.el,
    ),
  );

  /* ---------------- Side: live numbers ---------------- */
  const statEls = {};
  const stat = (key, label) => {
    const v = h('div', { class: 'stat-value' }, '–');
    statEls[key] = v;
    return h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, label), v);
  };
  const setStat = (key, val) => {
    const el = statEls[key];
    if (el.textContent === String(val)) return;
    el.textContent = val;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  };

  const chart = new MiniChart({ height: 150, xLabel: 'step', empty: 'Press Step to see inertia drop' });
  chart.onBarClick = (i) => setK(i + 1);
  const chartLegend = h('div', { class: 'chart-legend' });
  const chartNote = h('div', { class: 'chart-note' });
  const chartSeg = segmented({
    options: [{ value: 'inertia', label: '📉 Inertia' }, { value: 'elbow', label: '📐 Elbow (best K)' }],
    value: 'inertia',
    onChange: (v) => { S.chartMode = v; if (v === 'elbow') computeElbow(); updateChart(); },
  });
  const sizeBar = h('div', { class: 'size-bar' });
  const sizeLegend = h('div', { class: 'size-legend' });

  const numbersCard = h('div', { class: 'card side-card' },
    h('h3', {}, '📊 Live numbers'),
    h('div', { class: 'stats' }, stat('iter', 'Round'), stat('J', 'Inertia'), stat('changed', 'Switched')),
    chartSeg.el,
    chart.canvas,
    chartLegend,
    chartNote,
    h('div', { class: 'sub-label' }, 'Points per cluster'),
    sizeBar,
    sizeLegend,
  );

  /* ---------------- Side: learn ---------------- */
  const mathEl = mathTab();
  const learnTabs = tabs([
    { id: 'intuition', label: '💡 Intuition', render: intuitionTab },
    { id: 'math', label: '∑ Math', render: () => mathEl },
    { id: 'try', label: '🎯 Try this', render: () => challengesTab(challengeActions) },
  ]);
  const learnCard = h('div', { class: 'card side-card' }, h('h3', {}, '📚 Learn'), learnTabs.el);
  lab.side.append(numbersCard, learnCard);

  /* ---------------- Elbow ---------------- */
  let elbowData = null;
  let elbowTimer = 0;
  function computeElbow() {
    if (S.points.length < 8) { elbowData = null; return; }
    elbowData = KM.elbow(S.points, 8, S.points.length > 600 ? 2 : 4);
  }
  function scheduleElbow(now = false) {
    if (S.chartMode !== 'elbow') { elbowData = null; return; }
    clearTimeout(elbowTimer);
    elbowTimer = setTimeout(() => { computeElbow(); updateChart(); }, now ? 0 : 350);
  }

  function updateChart() {
    if (S.chartMode === 'inertia') {
      chart.setLine(
        S.history.map((d) => ({ y: d.J, color: d.kind === 'assign' ? '#4D96FF' : '#FF6B6B' })),
        { xLabel: 'step', empty: S.points.length ? 'Press Step to see inertia drop' : 'Add points first' },
      );
      chartLegend.replaceChildren(
        h('span', {}, h('i', { style: { background: '#4D96FF' } }), 'after Assign'),
        h('span', {}, h('i', { style: { background: '#FF6B6B' } }), 'after Update'),
      );
      chartNote.innerHTML = S.history.length > 1
        ? 'Notice it <b>never goes up</b> — both steps can only make the groups tighter.'
        : 'Inertia = total squared distance from each point to its own ★.';
    } else {
      if (!elbowData) {
        chart.setBars([], { empty: S.points.length < 8 ? 'Need at least 8 points' : 'Computing…' });
        chartLegend.replaceChildren();
        chartNote.textContent = '';
        return;
      }
      chart.setBars(elbowData.map((v, i) => ({
        label: String(i + 1), value: v,
        color: i + 1 === S.K ? '#FFC93C' : '#D9CCF7',
        highlight: i + 1 === S.K,
      })), { xLabel: 'K (number of clusters) — click a bar to use it' });
      chartLegend.replaceChildren(h('span', {}, h('i', { style: { background: '#FFC93C' } }), `your K = ${S.K}`));
      chartNote.innerHTML = 'Best inertia found for each K. Find the <b>elbow</b>: the K after which bars stop shrinking much.';
    }
  }

  /* ---------------- Narrator & UI refresh ---------------- */
  let lastNarr = '';
  function setPhase(ph) {
    S.phase = ph;
    refreshUI();
  }

  function refreshUI() {
    const nar = narration(S);
    const key = S.phase + '|' + nar.title + '|' + nar.text;
    if (key !== lastNarr) {
      lastNarr = key;
      const activeId = { empty: 'data', ready: 'data', init: 'init', assign: 'assign', edited: 'assign', update: 'update', converged: 'converged' }[S.phase];
      const activeIdx = PHASE_TRACK.findIndex((p) => p.id === activeId);
      const track = h('div', { class: 'phase-track' });
      PHASE_TRACK.forEach((p, i) => {
        if (i) track.append(h('span', { class: 'phase-arrow' }, i === 3 ? '⇄' : '→'));
        track.append(h('span', { class: 'phase-chip' + (i === activeIdx ? ' active' : i < activeIdx || (activeIdx === 2 && i === 3 && S.iter > 0) ? ' done' : '') }, p.label));
      });
      const avatar = h('div', { class: 'narrator-avatar bounce' }, nar.emoji);
      lab.narrator.replaceChildren(
        avatar,
        h('div', { class: 'narrator-main' }, track, h('div', { class: 'narrator-title' }, nar.title), h('div', { class: 'narrator-text', html: nar.text })),
      );
      mathEl.highlight(S.phase);
    }

    setStat('iter', S.iter);
    const J = S.cents.length && S.phase !== 'init' ? KM.inertia(S.points, centXY()) : null;
    setStat('J', J == null ? '–' : J.toFixed(J >= 100 ? 0 : J >= 10 ? 1 : 2));
    setStat('changed', S.phase === 'assign' || S.phase === 'converged' ? S.lastChanged : '–');

    // cluster sizes
    const sizes = KM.clusterSizes(S.points, S.cents.length);
    const total = sizes.reduce((a, b) => a + b, 0);
    if (!total) {
      sizeBar.replaceChildren(h('span', { style: { flexGrow: 1, background: 'transparent' } }));
      sizeLegend.textContent = S.points.length ? `${S.points.length} points, not grouped yet` : 'No points yet';
    } else {
      sizeBar.replaceChildren(...sizes.map((n, i) => h('span', { style: { flexGrow: n, background: css(PALETTE[i]) }, title: `${PALETTE_NAMES[i]}: ${n}` })));
      sizeLegend.replaceChildren(...sizes.map((n, i) => h('span', {}, h('i', { style: { background: css(PALETTE[i]) } }), `${n}`)));
    }

    emptyEl.style.opacity = S.points.length ? 0 : 1;
    updateChart();
  }

  function updateTip() {
    tipEl.textContent = {
      draw: '✏️ Click to add · drag points or ★ to move',
      spray: '💨 Hold & drag to spray points · drag ★ to move',
      erase: '🧽 Hold & drag to erase · drag ★ to move',
    }[S.tool];
  }

  /* ---------------- Challenges ---------------- */
  const focusStage = () => {
    if (window.innerWidth < 1240) lab.el.querySelector('.lab-stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const preset = ({ dataset, xy, K, init }) => {
    player.pause();
    if (init) { S.init = init; initSeg.set(init); initHint.textContent = INIT_INFO[init]; }
    if (K) { S.K = K; kSlider.set(K); paintKDots(); }
    if (xy) {
      S.dataset = dataset || 'custom';
      setPoints(xy);
      datasetChips.forEach((b) => b.classList.toggle('active', b.dataset.id === dataset));
      if (dataset) datasetNote.textContent = findDataset(dataset).note;
      resetAlgo();
      scheduleElbow(true);
    } else if (dataset) loadDataset(dataset);
    focusStage();
  };
  const challengeActions = {
    basic: () => { preset({ dataset: 'blobs', xy: blobs(S.n, 3), K: 3, init: 'pp' }); setTimeout(() => player.play(), 700); },
    tricky: () => {
      const { pts, cents } = trickyStart();
      preset({ xy: pts, K: 3, init: 'random' });
      setTimeout(() => { initCentroids(cents); S.iter = 0; S.history = []; setPhase('init'); toast('Bad start loaded — press ▶'); }, 550);
    },
    moons: () => preset({ dataset: 'moons', K: 2, init: 'pp' }),
    elbow: () => {
      preset({ dataset: 'blobs', K: 2, init: 'pp' });
      S.chartMode = 'elbow'; chartSeg.set('elbow'); computeElbow(); updateChart();
      toast('Check the elbow chart on the right 👉');
    },
    uneven: () => preset({ dataset: 'uneven', K: 3, init: 'pp' }),
  };

  /* ---------------- Start ---------------- */
  paintKDots();
  updateTip();
  loadDataset('blobs');

  return () => {
    clearTimeout(toastTimer);
    clearTimeout(elbowTimer);
    player.dispose();
    chart.dispose();
    regions.dispose();
    stars.dispose();
    stage.dispose();
  };
}
