import * as THREE from 'three';
import { createLab } from '../../core/lab.js';
import { Stage } from '../../core/stage.js';
import { RegionBackground, PointLayer, StarLayer, LinkLayer, TrailLayer } from '../../core/layers.js';
import { Player } from '../../core/player.js';
import { MiniChart } from '../../core/chart.js';
import { h, section, slider, segmented, toggle, button, tabs } from '../../core/ui.js';
import { PALETTE, PALETTE_NAMES, NEUTRAL, INK, css } from '../../core/theme.js';
import * as KM from './algo.js';
import { DATASETS, findDataset, trickyStart, blobs, LECTURE } from './datasets.js';
import { Space } from '../../core/space.js';
import { LabelOverlay, AxesOverlay } from '../../core/overlay.js';
import { workedCard, table, note, para, step, fmt, fx, pt } from '../../core/worked.js';
import { narration, PHASE_TRACK, intuitionTab, mathTab, challengesTab } from './content.js';

const MAX_POINTS = 1500;
const COLORS = PALETTE.map((c) => new THREE.Color(c));
const GREY = new THREE.Color(NEUTRAL);
const INIT_INFO = {
  pp: 'Spreads the stars out: each new star prefers points far from the ones already placed. The default in most libraries.',
  random: 'Picks K random data points as the starting stars (the classic “Forgy” method). Fast, but sometimes unlucky.',
  spots: 'Drops the stars anywhere on the canvas — even in empty space. Watch out for stars that never get any points!',
  farthest: 'The lecture’s “modified k-means”: start from the two points that are farthest apart, then keep adding the point farthest from the chosen ones.',
  given: 'Using the starting centroids given on the slide: C1 = (3, 4) and C2 = (4, 5).',
};

export function mount(root) {
  const lab = createLab(root, {
    accent: '#D4A24C',
    title: 'K-Means Clustering',
    emoji: '',
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
    metric: 'euclidean',
    lecture: false,
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
  const space = new Space();
  const labels = new LabelOverlay(stage, lab.overlay);
  const axes = new AxesOverlay(stage, lab.overlay, space, regions);
  axes.setVisible(false);
  const worked = workedCard();
  worked.show(false);

  /* ---------------- Overlays ---------------- */
  const toastEl = h('div', { class: 'toast', role: 'status' });
  const emptyEl = h('div', { class: 'stage-empty' }, h('div', {}, h('span', { class: 'big' }, ''), 'Click anywhere to add points', h('br'), h('small', {}, 'or pick a dataset')));
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
    if (playing && S.points.length === 0) { player.pause(); toast('Add some points first '); }
  });

  /* ---------------- Points helpers ---------------- */
  const newPoint = (x, y, wait = 0, name = null) => ({ x, y, name, c: -1, col: GREY.clone(), s: 0, ts: 1, wait, delay: 0, pending: false });
  const targetColor = (p) => (p.c >= 0 ? COLORS[p.c % COLORS.length] : GREY);
  const centXY = () => S.cents.map((c) => ({ x: c.x, y: c.y }));

  function setPoints(xy, { stagger = true } = {}) {
    S.points = xy.slice(0, MAX_POINTS).map((p, i) => newPoint(p.x, p.y, stagger ? Math.min(0.5, (i / xy.length) * 0.5) : 0));
  }

  /* ---------------- Algorithm steps ---------------- */
  function initCentroids(custom) {
    const pts = S.points;
    const cs = custom
      || (S.init === 'given' && S.lecture && S.K === 2 ? LECTURE.given.map((c) => space.w(c))
        : S.init === 'pp' ? KM.initPlusPlus(pts, S.K)
          : S.init === 'random' ? KM.initRandomPoints(pts, S.K)
            : S.init === 'farthest' ? KM.initFarthest(pts, S.K, S.metric)
              : S.init === 'given' ? KM.initPlusPlus(pts, S.K)
                : KM.initRandomSpots(S.K));
    S.prevCents = null;
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
      const [k] = KM.nearest(p, cents, S.metric);
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
    if (S.points.length === 0) { setPhase('empty'); toast('Add some points first '); return false; }
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
    S.prevCents = centXY();
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
        const [k] = KM.nearest(p, cents, S.metric);
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
  function leaveLecture() {
    if (!S.lecture) return;
    S.lecture = false;
    space.setIdentity();
    axes.setVisible(false);
    if (S.init === 'given') { S.init = 'pp'; initSeg.set('pp'); initHint.textContent = INIT_INFO.pp; }
  }

  function loadLecture() {
    player.pause();
    S.lecture = true;
    S.dataset = 'lecture';
    space.fit(LECTURE.points, { box: 0.62 });
    S.points = LECTURE.points.map((q, i) => { const w = space.w(q); return newPoint(w.x, w.y, i * 0.08, q.name); });
    axes.setVisible(true);
    datasetChips.forEach((b) => b.classList.toggle('active', b.dataset.id === 'lecture'));
    datasetNote.innerHTML = 'Slide example: 5 points, k = 2, starting centroids C1 = (3, 4), C2 = (4, 5). It should converge after 3 iterations to C1 = (3, 5), C2 = (5.5, 7).';
    S.K = 2; kSlider.set(2); paintKDots();
    S.init = 'given'; initSeg.set('given'); initHint.textContent = INIT_INFO.given;
    setMetric('euclidean', true);
    resetAlgo();
    scheduleElbow(true);
  }

  function setMetric(v, silent) {
    S.metric = v;
    metricSeg.set(v);
    regions.setMetric(v);
    if (!silent) {
      if (S.cents.length && S.phase !== 'init') afterEdit();
      else refreshUI();
      toast(v === 'manhattan' ? 'Manhattan distance: |Δx| + |Δy| — borders become zig-zags' : 'Euclidean distance: straight-line');
    }
  }

  function loadDataset(id, { keepK = true } = {}) {
    leaveLecture();
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
    if (S.cents.length && S.phase !== 'init') { p.c = KM.nearest(p, centXY(), S.metric)[0]; p.col.copy(targetColor(p)); }
    if (S.lecture) p.name = 'P' + (S.points.length + 1);
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

    brush.scale.setScalar(0.075);
    axes.update();
    const tags = [];
    if (S.lecture || S.points.length <= 12) {
      S.points.forEach((p) => { if (p.name) tags.push({ x: p.x, y: p.y, text: p.name }); });
      if (S.lecture) S.cents.forEach((c, i) => tags.push({ x: c.dx, y: c.dy, text: `C${i + 1} ${pt(space.d(c), 2)}`, cls: 'cent', dx: 14, dy: 4 }));
    }
    labels.update(tags);
  });

  /* ---------------- Controls (left) ---------------- */
  const datasetNote = h('span', { class: 'hint' });
  const datasetChips = DATASETS.map((d) =>
    h('button', { type: 'button', class: 'chip', 'data-id': d.id, onclick: () => { player.pause(); loadDataset(d.id); } },
      h('span', { class: 'emo' }, d.emoji), d.label),
  );
  const lectureChip = h('button', { type: 'button', class: 'chip chip-lecture', 'data-id': 'lecture', onclick: () => loadLecture() }, h('span', { class: 'emo' }, ''), '5 points · k = 2');
  datasetChips.push(lectureChip);
  const nSlider = slider({
    label: 'Number of points', min: 40, max: 800, step: 20, value: S.n,
    onInput: (v) => { S.n = v; },
  });
  nSlider.el.querySelector('input').addEventListener('change', () => { if (S.dataset !== 'blank') loadDataset(S.dataset); });

  const toolSeg = segmented({
    options: [
      { value: 'draw', label: 'Draw', title: 'Click to add a point, drag to move one' },
      { value: 'spray', label: 'Spray', title: 'Hold and drag to spray many points' },
      { value: 'erase', label: 'Erase', title: 'Hold and drag to erase points' },
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
      { value: 'farthest', label: 'Farthest' },
      { value: 'given', label: 'Slide' },
    ],
    value: S.init,
    wrap: true,
    onChange: (v) => {
      if (v === 'given' && !S.lecture) { toast('“Slide” start is for the lecture example'); initSeg.set(S.init); return; }
      S.init = v; initHint.textContent = INIT_INFO[v]; resetAlgo(); toast('New starting method — press ▶');
    },
  });
  const metricSeg = segmented({
    label: 'Distance',
    options: [{ value: 'euclidean', label: 'Euclidean' }, { value: 'manhattan', label: 'Manhattan' }],
    value: S.metric,
    onChange: (v) => setMetric(v),
  });

  const tRegions = toggle({ label: 'Colored regions', emoji: '', value: S.show.regions, onChange: (v) => (S.show.regions = v) });
  const tLinks = toggle({ label: 'Lines to their ★', emoji: '', value: S.show.links, onChange: (v) => (S.show.links = v) });
  const tTrails = toggle({ label: '★ footprints', emoji: '', value: S.show.trails, onChange: (v) => (S.show.trails = v) });

  const num = (n) => h('span', { class: 'num' }, `${n}.`);
  lab.controls.append(
    section([num(1), 'Data'],
      h('div', { class: 'chips' }, datasetChips.slice(0, -1)),
      h('div', { class: 'lecture-row' }, h('span', { class: 'field-label' }, 'From the lecture'), h('div', { class: 'chips chips-lecture' }, lectureChip)),
      datasetNote,
      nSlider.el,
      button('New sample', () => { player.pause(); loadDataset(S.dataset); }, { variant: 'btn-block' }),
    ),
    section([num(2), 'Draw your own'],
      toolSeg.el,
      h('span', { class: 'hint', html: 'Drag any point or ★ to move it. The algorithm reacts live.' }),
      button('Clear canvas', () => { player.pause(); leaveLecture(); S.points = []; resetAlgo(); datasetChips.forEach((b) => b.classList.remove('active')); S.dataset = 'blank'; scheduleElbow(true); }, { variant: 'btn-ghost btn-block' }),
    ),
    section([num(3), 'K-Means settings'],
      kSlider.el,
      kDots,
      initSeg.el,
      initHint,
      metricSeg.el,
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
    options: [{ value: 'inertia', label: 'Inertia' }, { value: 'elbow', label: 'Elbow (best K)' }],
    value: 'inertia',
    onChange: (v) => { S.chartMode = v; if (v === 'elbow') computeElbow(); updateChart(); },
  });
  const sizeBar = h('div', { class: 'size-bar' });
  const sizeLegend = h('div', { class: 'size-legend' });

  const numbersCard = h('div', { class: 'card side-card' },
    h('h3', {}, 'Live numbers'),
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
    { id: 'intuition', label: 'Intuition', render: intuitionTab },
    { id: 'math', label: '∑ Math', render: () => mathEl },
    { id: 'try', label: 'Try this', render: () => challengesTab(challengeActions) },
  ]);
  const learnCard = h('div', { class: 'card side-card' }, h('h3', {}, 'Learn'), learnTabs.el);
  lab.side.append(numbersCard, worked.el, learnCard);

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
        S.history.map((d) => ({ y: d.J, color: d.kind === 'assign' ? '#3D8B8B' : '#E07A5F' })),
        { xLabel: 'step', empty: S.points.length ? 'Press Step to see inertia drop' : 'Add points first' },
      );
      chartLegend.replaceChildren(
        h('span', {}, h('i', { style: { background: '#3D8B8B' } }), 'after Assign'),
        h('span', {}, h('i', { style: { background: '#E07A5F' } }), 'after Update'),
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
        color: i + 1 === S.K ? '#D4A24C' : '#DDD3C4',
        highlight: i + 1 === S.K,
      })), { xLabel: 'K (number of clusters) — click a bar to use it' });
      chartLegend.replaceChildren(h('span', {}, h('i', { style: { background: '#D4A24C' } }), `your K = ${S.K}`));
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
      const avatar = h('div', { class: 'narrator-avatar bounce' }, h('small', {}, 'Step'), String(Math.max(activeIdx, 0) + 1));
      lab.setCaption(`K-Means on ${S.points.length} points, K = ${S.K}, ${S.metric} distance${S.lecture ? ' — the worked example from the lecture slides' : ''}. Stars are centroids; shaded regions show which centroid is nearest.`);
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
    renderWorked();
  }

  /* ---------------- Worked example (lecture tables) ---------------- */
  function renderWorked() {
    const N = S.points.length;
    const show = S.lecture || (N > 0 && N <= 10);
    worked.show(show);
    if (!show) return;
    const D = (a, b) => (S.metric === 'manhattan' ? KM.manhattan(a, b) : Math.sqrt(KM.dist2(a, b))) * space.s;
    const nm = (i) => S.points[i].name || `P${i + 1}`;
    const dp = (p) => space.d(p);
    const parts = [];
    const pairTable = () => {
      let bi = 0, bj = 1, bd = -1;
      const rows = S.points.map((p, i) => [{ v: nm(i), cls: 'rh' }, ...S.points.map((q, j) => {
        const d = D(p, q);
        if (j > i && d > bd + 1e-9) { bd = d; bi = i; bj = j; }
        return { v: i === j ? '0' : fx(d), cls: i === j ? 'diag' : '' };
      })]);
      rows[bi][bj + 1].cls = 'hl'; rows[bj][bi + 1].cls = 'hl';
      parts.push(step(`Pairwise distances (${S.metric})`));
      parts.push(table(['', ...S.points.map((_, i) => nm(i))], rows));
      parts.push(para(`Maximum distance: d(${nm(bi)}, ${nm(bj)}) = <b>${fx(bd)}</b> → the two farthest points become the starting centroids.`));
    };

    if (S.phase === 'empty' || S.phase === 'ready') {
      parts.push(para(S.lecture ? 'Press <b>Step</b> to place the starting centroids C1 = (3, 4) and C2 = (4, 5).' : 'Press <b>Step</b> to place the starting centroids.'));
      if (S.init === 'farthest' && N >= 2) pairTable();
    }
    if (S.phase === 'init') {
      if (S.init === 'farthest') pairTable();
      parts.push(step('Starting centroids'));
      parts.push(para(S.cents.map((c, i) => `C${i + 1}<sup>(0)</sup> = <b>${pt(dp(c))}</b>`).join(', ')));
    }
    if (['assign', 'converged', 'edited'].includes(S.phase) && S.cents.length) {
      const C = S.cents.map((c) => ({ x: c.x, y: c.y }));
      parts.push(step(S.phase === 'converged' ? `Iteration ${S.iter + 1}: nothing changes` : `Iteration ${S.iter + 1}: distances and clusters`));
      parts.push(para('Current centroids: ' + C.map((c, i) => `C${i + 1} = ${pt(dp(c))}`).join(', ')));
      parts.push(table(['Point', ...C.map((_, k) => `d to C${k + 1}`), 'Cluster'], S.points.map((p, i) => {
        const ds = C.map((c) => D(p, c));
        const best = Math.min(...ds);
        const ties = ds.filter((d) => Math.abs(d - best) < 1e-9).length > 1;
        return [{ v: S.lecture ? pt(dp(p), 0) : nm(i), cls: 'rh' }, ...ds.map((d, k) => ({ v: fx(d), cls: k === p.c ? 'ok' : '' })), p.c >= 0 ? `C${p.c + 1}${ties ? ` (tie → C${p.c + 1})` : ''}` : '–'];
      })));
      const groups = C.map((_, k) => S.points.map((p, i) => (p.c === k ? (S.lecture ? pt(dp(p), 0) : nm(i)) : null)).filter(Boolean));
      parts.push(para(groups.map((g, k) => `C${k + 1} = {${g.join(', ')}}`).join('<br>')));
    }
    if (S.phase === 'update' && S.prevCents) {
      parts.push(step(`Iteration ${S.iter}: new centroids`));
      const lines = S.cents.map((c, k) => {
        const mem = S.points.filter((p) => p.c === k).map(dp);
        if (!mem.length) return `C${k + 1}: no points → stays at ${pt(dp(c))}`;
        const xs = mem.map((m) => fmt(m.x)).join(' + '), ys = mem.map((m) => fmt(m.y)).join(' + ');
        return `C${k + 1} = ((${xs}) / ${mem.length}, (${ys}) / ${mem.length}) = <b>${pt(dp(c))}</b>`;
      });
      parts.push(h('div', { class: 'w-lines', html: lines.join('<br>') }));
      if (S.metric === 'manhattan') parts.push(note('With Manhattan distance the centroid is still the <b>mean</b> here (as on the slides). Strictly, the best centre for Manhattan distance is the <i>median</i> — that variant is called k-medians.', 'info'));
    }
    if (S.phase === 'converged') {
      parts.push(note(`Recomputing the centroids gives the same values → <b>converged</b>. Final centroids: ${S.cents.map((c, k) => `C${k + 1} = ${pt(dp(c))}`).join(', ')}.`, 'info'));
      if (S.lecture && S.cents.length === 2) {
        const q = LECTURE.newPoint;
        const C = S.cents.map(dp);
        const dd = C.map((c) => (S.metric === 'manhattan' ? KM.manhattan(q, c) : Math.hypot(q.x - c.x, q.y - c.y)));
        const k = dd[0] <= dd[1] ? 0 : 1;
        parts.push(step('New point (2, 7) — which cluster?'));
        parts.push(para(dd.map((d, i) => `d((2, 7), C${i + 1}) = ${fx(d)}`).join('<br>') + `<br>Since ${fx(dd[k])} &lt; ${fx(dd[1 - k])}, it belongs to <b>Cluster ${k + 1}</b>.`));
        const already = S.points.some((p) => { const d = dp(p); return Math.abs(d.x - 2) < 1e-6 && Math.abs(d.y - 7) < 1e-6; });
        if (!already) parts.push(button('Add (2, 7) to the canvas', () => {
          const w = space.w(q);
          const i = addPoint(w.x, w.y);
          if (i >= 0) { S.points[i].name = 'new'; afterEdit(); toast('Added (2, 7) — it joins its nearest ★'); }
        }, { variant: 'btn-primary' }));
      }
    }
    worked.set(parts, `${S.metric} · K = ${S.K}`);
  }

  function updateTip() {
    tipEl.textContent = {
      draw: 'Click to add · drag points or ★ to move',
      spray: 'Hold & drag to spray points · drag ★ to move',
      erase: 'Hold & drag to erase · drag ★ to move',
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
      toast('Check the elbow chart on the right ');
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
