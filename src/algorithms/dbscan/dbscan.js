import * as THREE from 'three';
import { createPointLab, statTiles, GREY, COLORS, INK_C, WHITE } from '../../core/pointlab.js';
import { MiniChart } from '../../core/chart.js';
import { h, section, slider, toggle, button } from '../../core/ui.js';
import { table, note, para, step, fmt, fx } from '../../core/worked.js';
import * as D from './algo.js';
import { LECTURES, intuitionTab, mathTab, challengesTab } from './content.js';

const NOISE_RING = new THREE.Color(0x9ca3af);
const name = (L, i) => L.points[i]?.name || `#${i + 1}`;

export function mount(root) {
  const S = {
    eps: 0.12, minPts: 5,
    run: null, ev: null, phase: 'ready', ff: false,
    show: { areas: true, links: true },
    hover: -1,
  };

  const L = createPointLab(root, {
    meta: { accent: '#2563EB', title: 'DBSCAN', emoji: '', category: 'Unsupervised · Density', level: 'Intermediate', blurb: 'Grow clusters from crowded areas, one point at a time, and leave the loners as noise.' },
    datasets: ['noisymoons', 'noisy', 'rings', 'density', 'smiley', 'blank'],
    defaultDataset: 'noisymoons',
    n: { min: 20, max: 700, step: 20, value: 260 },
    maxPoints: 900,
    interval: 0.6,
    lectures: LECTURES,
    phaseTrack: [
      { id: 'ready', label: 'Data' },
      { id: 'visit', label: 'Visit a point' },
      { id: 'expand', label: 'Expand cluster', loopBack: true },
      { id: 'done', label: 'Done' },
    ],
    learnTabs: [
      { id: 'intuition', label: 'Intuition', render: intuitionTab },
      { id: 'math', label: '∑ Math', render: mathTab },
      { id: 'try', label: 'Try this', render: () => challengesTab(actions) },
    ],
  });
  const n = () => L.points.length;

  /* ---------------- algorithm ---------------- */
  function fresh() { S.run = new D.Runner(L.points, S.eps, S.minPts); S.ev = null; }

  function reset() {
    S.ff = false;
    fresh();
    S.phase = 'ready';
    refresh();
  }

  function doStep() {
    if (!S.run) fresh();
    if (S.run.done) { S.phase = 'done'; refresh(); return false; }
    const ev = S.run.step();
    S.ev = ev;
    if (ev) {
      const p = L.points[ev.i];
      if (p) p.s = Math.max(p.s, 1.6);
    }
    S.phase = S.run.done ? 'done' : ev?.fromQueue ? 'expand' : 'visit';
    refresh();
    return !S.run.done;
  }

  function finish() {
    if (!n()) return;
    L.player.pause();
    if (!S.run) fresh();
    S.ff = true;
  }

  /** Parameters or data changed: keep the finished picture live, otherwise restart. */
  function rerun() {
    const wasDone = S.phase === 'done';
    fresh();
    if (wasDone) { S.run.runAll(); S.phase = 'done'; S.ev = null; }
    else S.phase = 'ready';
    refresh();
    drawK();
  }

  /* ---------------- hooks ---------------- */
  L.hooks.reset = () => { reset(); drawK(); };
  L.hooks.step = doStep;
  L.hooks.onEdit = () => rerun();
  L.hooks.onHover = (i) => { S.hover = i; };
  L.hooks.onDataset = () => {
    epsSlider.setRange(0.02, 0.5, 0.005);
    epsSlider.setFormat((v) => v.toFixed(3));
    setEps(S.eps > 0.5 ? 0.12 : S.eps, true);
  };
  L.hooks.onLecture = (lec) => {
    epsSlider.setRange(0.2, 6, 0.1);
    epsSlider.setFormat((v) => v.toFixed(1));
    setEps(lec.eps, true);
    setMin(lec.minPts, true);
  };

  function setEps(v, silent) { S.eps = v; epsSlider.set(v); if (!silent) rerun(); }
  function setMin(v, silent) { S.minPts = v; minSlider.set(v); if (!silent) rerun(); }

  /* ---------------- controls ---------------- */
  const epsSlider = slider({ label: 'ε — neighbourhood radius', min: 0.02, max: 0.5, step: 0.005, value: S.eps, format: (v) => v.toFixed(3), onInput: (v) => setEps(v) });
  const minSlider = slider({ label: 'minPts — neighbours needed (incl. itself)', min: 2, max: 15, step: 1, value: S.minPts, onInput: (v) => setMin(v) });
  const tAreas = toggle({ label: 'ε-circles of core points', emoji: '', value: true, onChange: (v) => (S.show.areas = v) });
  const tLinks = toggle({ label: 'Lines to neighbours', emoji: '', value: true, onChange: (v) => (S.show.links = v) });
  L.addControls(
    section([L.num(3), 'DBSCAN settings'], epsSlider.el, minSlider.el,
      h('span', { class: 'hint' }, 'Hover any point to see its ε-circle and neighbour count.'),
      button('Run to the end', finish, { variant: 'btn-block' })),
    section([L.num(4), 'Show'], tAreas.el, tLinks.el),
  );

  /* ---------------- side ---------------- */
  const stats = statTiles([['clusters', 'Clusters'], ['core', 'Core'], ['border', 'Border'], ['noise', 'Noise']]);
  const kchart = new MiniChart({ height: 130, xLabel: 'points sorted by k-distance', empty: 'Add points' });
  const kNote = h('div', { class: 'chart-note' });
  const legend = h('div', { class: 'legend-row' },
    h('span', {}, h('i', { style: { background: '#2563EB' } }), 'core'),
    h('span', {}, h('i', { class: 'small', style: { background: '#2563EB' } }), 'border'),
    h('span', {}, h('i', { class: 'ring' }), 'noise'),
    h('span', {}, h('i', { style: { background: '#9CA3AF' } }), 'not visited'));
  const numbers = h('div', { class: 'card side-card' },
    h('h3', {}, 'Live numbers'), stats.el, legend,
    h('div', { class: 'sub-label' }, 'k-distance plot (pick ε at the knee)'), kchart.canvas, kNote);
  L.mountSide(numbers);

  let kTimer = 0;
  function drawK() {
    clearTimeout(kTimer);
    kTimer = setTimeout(() => {
      const k = Math.max(1, S.minPts - 1);
      const kd = n() > 1500 ? [] : D.kDistances(L.points, k);
      kchart.setLine(kd.map((y) => ({ y })), { xLabel: 'points sorted by k-distance', ref: { y: S.eps, label: `ε = ${fmt(S.eps, 3)}` }, dots: kd.length <= 30, noArea: false, empty: 'Need more points than minPts' });
      kNote.innerHTML = `Distance from each point to its ${k}${k === 1 ? 'st' : k === 2 ? 'nd' : k === 3 ? 'rd' : 'th'} nearest neighbour. Points above the red line can’t be core.`;
    }, 60);
  }

  /* ---------------- frame ---------------- */
  const circ = [], segs = [];
  L.hooks.frame = (dt, t) => {
    if (S.ff && S.run) {
      const per = Math.max(1, Math.ceil((n() * dt) / 1.4));
      for (let k = 0; k < per && !S.run.done; k++) S.ev = S.run.step();
      if (S.run.done) { S.ff = false; S.phase = 'done'; S.ev = null; refresh(); }
      else { S.phase = 'expand'; refreshLight(); }
    }
    const run = S.run;
    const epsW = L.space.wl(S.eps);
    circ.length = 0; segs.length = 0;
    if (!run || run.points !== L.points) { for (const p of L.points) { p.tc = GREY; p.sz = 0.9; p.oc = null; p.fr = 0.74; } L.circles.sync(circ); L.segs.sync(segs); return; }

    L.points.forEach((p, i) => {
      const kind = run.kind(i);
      if (kind === 'unvisited') {
        const lab = run.labels[i];
        p.tc = lab >= 0 ? COLORS[lab % COLORS.length] : GREY;
        p.sz = 0.85; p.oc = null; p.fr = 0.74;
      } else if (kind === 'noise') { p.tc = WHITE; p.oc = NOISE_RING; p.fr = 0.45; p.sz = 0.85; }
      else if (kind === 'core') { p.tc = COLORS[run.labels[i] % COLORS.length]; p.oc = null; p.fr = 0.74; p.sz = 1.15; }
      else { p.tc = COLORS[run.labels[i] % COLORS.length]; p.oc = null; p.fr = 0.74; p.sz = 0.72; }
      if (S.show.areas && run.visited[i] && run.core[i]) circ.push({ x: p.wx, y: p.wy, r: epsW, col: COLORS[run.labels[i] % COLORS.length], fill: 0.05, ring: 0 });
    });

    const showFocus = (i, strong) => {
      const p = L.points[i];
      if (!p) return;
      const lab = run.labels[i];
      const col = lab >= 0 ? COLORS[lab % COLORS.length] : GREY;
      circ.push({ x: p.wx, y: p.wy, r: epsW, col: strong ? INK_C : NOISE_RING, fill: 0.06, ring: strong ? 0.95 : 0.7 });
      if (S.show.links) for (const q of run.N[i]) {
        if (q === i) continue;
        const o = L.points[q];
        segs.push({ x1: p.wx, y1: p.wy, x2: o.wx, y2: o.wy, w: strong ? 0.006 : 0.004, col: strong ? col : NOISE_RING });
      }
    };
    if (S.ev && !S.ff && S.phase !== 'done') showFocus(S.ev.i, true);
    if (S.hover >= 0 && S.hover !== S.ev?.i) showFocus(S.hover, false);
    // queue markers
    if (!S.ff && S.phase !== 'done') for (const q of run.queue) {
      const p = L.points[q];
      if (p) circ.push({ x: p.wx, y: p.wy, r: 0.036, col: INK_C, fill: 0, ring: 0.45 + 0.3 * Math.sin(t * 6) });
    }
    L.circles.sync(circ);
    L.segs.sync(segs);
  };

  L.hooks.labels = () => {
    if (S.hover < 0 || !S.run || !L.points[S.hover]) return null;
    const p = L.points[S.hover];
    const c = S.run.N[S.hover].length;
    return [{ x: p.wx, y: p.wy, text: `${c} in ε ${c >= S.minPts ? '≥' : '<'} ${S.minPts} → ${c >= S.minPts ? 'core' : 'not core'}`, cls: 'tip', dx: 12, dy: 10 }];
  };

  /* ---------------- narration / numbers / worked ---------------- */
  function counts() {
    const run = S.run;
    let core = 0, border = 0, noise = 0;
    if (run) L.points.forEach((_, i) => { const k = run.kind(i); if (k === 'core') core++; else if (k === 'border') border++; else if (k === 'noise') noise++; });
    return { core, border, noise, clusters: run ? run.cluster + 1 : 0 };
  }
  function refreshLight() {
    const c = counts();
    stats.set('clusters', c.clusters); stats.set('core', c.core); stats.set('border', c.border); stats.set('noise', c.noise);
  }

  function refresh() {
    refreshLight();
    const N = n();
    const ev = S.ev;
    let nar, active = 'ready';
    if (!N) nar = { emoji: '', title: 'Give me some points!', text: 'Pick a dataset or click on the canvas.' };
    else if (S.phase === 'ready') nar = { emoji: '', title: `Ready · ε = ${fmt(S.eps, 3)}, minPts = ${S.minPts}`, text: 'Each <b>Step</b> visits one point and counts how many points sit inside its ε-circle (itself included). Hover any point to preview.' };
    else if (S.phase === 'done') {
      const c = counts();
      active = 'done';
      nar = { emoji: '', title: `Done: ${c.clusters} cluster${c.clusters === 1 ? '' : 's'}, ${c.noise} noise`, text: `${c.core} core points, ${c.border} border points. Drag ε or minPts — the result updates live.` };
    } else if (ev) {
      const nm = name(L, ev.i);
      const list = ev.nbrs.length <= 8 ? ev.nbrs.map((q) => name(L, q)).join(', ') : `${ev.nbrs.length} points`;
      const added = ev.added.length ? ` Added ${ev.added.length <= 6 ? ev.added.map((q) => name(L, q)).join(', ') : ev.added.length + ' points'} to cluster ${ev.cluster + 1}.` : '';
      active = ev.fromQueue ? 'expand' : 'visit';
      if (ev.kind === 'new') nar = { emoji: '', title: `${nm} is core → new cluster ${ev.cluster + 1}`, text: `ε-neighbours of ${nm}: ${list} (total ${ev.nbrs.length} ≥ ${S.minPts}).${added}` };
      else if (ev.kind === 'expand') nar = { emoji: '', title: `${nm} is core too → keep expanding`, text: `ε-neighbours: ${list} (total ${ev.nbrs.length}).${added || ' All of them are already in the cluster.'}` };
      else if (ev.kind === 'border') nar = { emoji: '', title: `${nm} is a border point of cluster ${ev.cluster + 1}`, text: `Only ${ev.nbrs.length} point${ev.nbrs.length === 1 ? '' : 's'} within ε (< ${S.minPts}), so it can’t grow the cluster — but a core point reached it.` };
      else nar = { emoji: '', title: `${nm} looks like noise (for now)`, text: `Only ${ev.nbrs.length} within ε (< ${S.minPts}) and no cluster has reached it. It can still be rescued as a border point later.` };
    }
    L.narrate(nar, active);
    renderWorked();
  }

  function renderWorked() {
    const N = n();
    const show = L.lecture || (N > 0 && N <= 12);
    L.worked.show(!!show);
    if (!show || !S.run) return;
    const run = S.run;
    const parts = [];
    const ev = S.ev;
    if (N <= 12) {
      parts.push(step(`Distances (cells ≤ ε = ${fmt(S.eps)} highlighted)`));
      const names = L.points.map((_, i) => name(L, i));
      parts.push(table(['', ...names], L.points.map((p, i) => ({
        rowCls: ev && ev.i === i ? 'cur' : '',
        cells: [{ v: names[i], cls: 'rh' }, ...L.points.map((q, j) => {
          const d = D.dist(p, q);
          return { v: i === j ? '0' : fx(d, 2), cls: i === j ? 'diag' : d <= S.eps + 1e-12 ? 'ok' : 'dim' };
        })],
      }))));
    }
    if (ev) {
      const nm = name(L, ev.i);
      parts.push(step(`Visiting ${nm}`));
      parts.push(para(`ε-neighbours of ${nm}: <b>${ev.nbrs.map((q) => name(L, q)).join(', ')}</b> · Total = <b>${ev.nbrs.length}</b>, minPts = ${S.minPts}`));
      if (ev.kind === 'new') parts.push(para(`${ev.nbrs.length} ≥ ${S.minPts} → <b>${nm} is a core point</b>. Start <b>cluster ${ev.cluster + 1}</b>${ev.added.length ? ` and add ${ev.added.map((q) => name(L, q)).join(', ')}` : ''}.`));
      if (ev.kind === 'expand') parts.push(para(`${nm} is a core point. ${ev.added.length ? `Add ${ev.added.map((q) => name(L, q)).join(', ')} to cluster ${ev.cluster + 1}.` : `All are in cluster ${ev.cluster + 1} already.`}`));
      if (ev.kind === 'border') parts.push(para(`${ev.nbrs.length} < ${S.minPts} → ${nm} is <b>not core</b>, but it was reached from a core point → <b>border point</b> of cluster ${ev.cluster + 1}.`));
      if (ev.kind === 'noise?') parts.push(para(`${ev.nbrs.length} < ${S.minPts} and not reached by any core point → <b>noise</b> (unless a later core point reaches it).`));
    }
    if (S.phase === 'done' || run.done) {
      parts.push(step('Result'));
      parts.push(table(['Point', 'ε-nbrs', 'Type', 'Cluster'], L.points.map((_, i) => {
        const k = run.kind(i);
        return [{ v: name(L, i), cls: 'rh' }, run.N[i].length, { v: k, cls: k === 'core' ? 'ok' : k === 'noise' ? 'bad' : '' }, run.labels[i] >= 0 ? run.labels[i] + 1 : '–'];
      })));
    }
    if (!ev && S.phase === 'ready') parts.push(para('Press <b>Step</b> to visit the first point.'));
    L.worked.set(parts, `ε = ${fmt(S.eps)} · minPts = ${S.minPts}`);
  }

  /* ---------------- challenges ---------------- */
  const actions = {
    lec: () => { L.loadLecture(LECTURES[0]); L.focusStage(); },
    moons: () => { L.loadDataset('noisymoons'); setEps(0.11, true); setMin(5, true); reset(); drawK(); L.focusStage(); finish(); },
    noisy: () => { L.loadDataset('noisy'); setEps(0.1, true); setMin(5, true); reset(); drawK(); L.focusStage(); finish(); },
    density: () => { L.loadDataset('density'); setEps(0.08, true); setMin(5, true); reset(); drawK(); L.focusStage(); finish(); },
  };

  L.loadDataset('noisymoons');
  return () => { clearTimeout(kTimer); kchart.dispose(); L.dispose(); };
}
