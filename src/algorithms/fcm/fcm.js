import * as THREE from 'three';
import { createPointLab, statTiles, GREY, COLORS, INK_C } from '../../core/pointlab.js';
import { MiniChart } from '../../core/chart.js';
import { h, section, slider, segmented, toggle, button } from '../../core/ui.js';
import { table, note, para, step, fmt, fx, pt } from '../../core/worked.js';
import { katexHtml } from '../../core/tex.js';
import { PALETTE, PALETTE_NAMES, css } from '../../core/theme.js';
import { blobs } from '../../core/datasets.js';
import * as F from './algo.js';
import { LECTURES, intuitionTab, mathTab, challengesTab } from './content.js';

export function mount(root) {
  const S = {
    c: 3, m: 2, eps: 0.01, init: 'randomU',
    U: null, cents: [], disp: [],
    phase: 'ready', iter: 0, history: [], lastDelta: null,
    hard: false, showField: true,
    inspect: -1, lecture: null,
    prevU: null, prevCents: null,
  };

  const L = createPointLab(root, {
    meta: { accent: '#8A5A83', title: 'Fuzzy C-Means', emoji: '', category: 'Unsupervised · Soft clustering', level: 'Intermediate', blurb: 'Every point belongs to every cluster a little — watch memberships and colors blend.' },
    datasets: ['overlap', 'blobs', 'uneven', 'moons', 'uniform', 'blank'],
    defaultDataset: 'overlap',
    n: { min: 20, max: 600, step: 20, value: 180 },
    maxPoints: 900,
    lectures: LECTURES,
    phaseTrack: [
      { id: 'ready', label: 'Data' },
      { id: 'init', label: 'Guess U⁽⁰⁾' },
      { id: 'cent', label: 'Centroids' },
      { id: 'mem', label: 'Memberships', loopBack: true },
      { id: 'done', label: 'Done' },
    ],
    learnTabs: [
      { id: 'intuition', label: 'Intuition', render: intuitionTab },
      { id: 'math', label: '∑ Math', render: mathTab },
      { id: 'try', label: 'Try this', render: () => challengesTab(actions) },
    ],
  });
  L.regions.setFuzzy(true, S.m);

  const n = () => L.points.length;
  const tmp = new THREE.Color();

  /* ---------------- colors from memberships ---------------- */
  function recolor() {
    L.points.forEach((p, i) => {
      if (!p.mix) p.mix = new THREE.Color();
      const u = S.U?.[i];
      if (!u) { p.tc = GREY; p.sz = 1; return; }
      if (S.hard) {
        const k = u.indexOf(Math.max(...u));
        p.mix.copy(COLORS[k % COLORS.length]);
      } else {
        p.mix.setRGB(0, 0, 0);
        u.forEach((v, j) => { tmp.copy(COLORS[j % COLORS.length]).multiplyScalar(v); p.mix.add(tmp); });
      }
      p.tc = p.mix;
      p.sz = 0.8 + 0.45 * Math.max(...u);
    });
  }

  /* ---------------- algorithm ---------------- */
  function syncStars() {
    L.stars.setCount(0, PALETTE);
    L.stars.setCount(S.cents.length, PALETTE);
    S.disp = S.cents.map((c) => ({ x: c.x, y: c.y }));
  }

  function reset() {
    S.U = null; S.cents = []; S.disp = []; S.prevU = null; S.prevCents = null;
    S.iter = 0; S.history = []; S.lastDelta = null;
    L.stars.setCount(0, PALETTE);
    S.phase = 'ready';
    recolor();
    refresh();
  }

  function doStep() {
    if (n() < 2) { L.toast('Add a few more points'); return false; }
    if (S.phase === 'done') { L.toast('Converged — drag a ★ or change m'); return false; }
    if (S.phase === 'ready') {
      if (S.lecture?.U0 && S.lecture.U0.length === n() && S.c === S.lecture.c) S.U = S.lecture.U0.map((r) => r.slice());
      else if (S.init === 'points') {
        const idx = [...L.points.keys()].sort(() => Math.random() - 0.5).slice(0, S.c);
        S.U = F.memberships(L.points, idx.map((i) => L.points[i]), S.m);
      } else S.U = F.randomU(n(), S.c);
      S.phase = 'init';
      recolor();
      refresh();
      return true;
    }
    if (S.phase === 'init' || S.phase === 'mem' || S.phase === 'edited') {
      S.prevCents = S.cents.map((c) => ({ ...c }));
      const first = !S.cents.length;
      S.cents = F.centroids(L.points, S.U, S.m);
      if (first) syncStars();
      S.phase = 'cent';
      S.history.push({ J: F.objective(L.points, S.U, S.cents, S.m), kind: 'cent' });
      refresh();
      return true;
    }
    // cent → memberships
    S.prevU = S.U;
    S.U = F.memberships(L.points, S.cents, S.m);
    S.lastDelta = F.maxDelta(S.U, S.prevU);
    S.iter++;
    S.history.push({ J: F.objective(L.points, S.U, S.cents, S.m), kind: 'mem' });
    S.phase = S.lastDelta < S.eps ? 'done' : 'mem';
    recolor();
    refresh();
    return S.phase !== 'done';
  }

  /** After edits / dragging a centroid: memberships follow the centroids instantly. */
  function liveUpdate() {
    if (!S.cents.length) {
      if (S.U) { S.U = null; S.phase = 'ready'; }
      recolor(); refresh();
      return;
    }
    S.U = F.memberships(L.points, S.cents, S.m);
    S.phase = 'edited';
    recolor();
    refresh();
  }

  /* ---------------- hooks ---------------- */
  L.hooks.reset = reset;
  L.hooks.step = doStep;
  L.hooks.isBusy = () => S.busyStars;
  L.hooks.onEdit = () => liveUpdate();
  L.hooks.onDataset = () => { S.lecture = null; };
  L.hooks.onLecture = (lec) => {
    S.lecture = lec;
    setC(lec.c, true);
    setM(lec.m, true);
  };
  L.hooks.onHover = (i) => { S.inspect = i; renderInspect(); };
  L.hooks.handles = {
    hit: (w) => {
      let best = null, bd = 0.085 ** 2;
      S.disp.forEach((d, i) => { const q = L.space.w(d); const dd = (q.x - w.x) ** 2 + (q.y - w.y) ** 2; if (dd < bd) { bd = dd; best = i; } });
      return best;
    },
    drag: (i, dataPos) => {
      S.cents[i] = { ...S.cents[i], x: dataPos.x, y: dataPos.y };
      S.disp[i] = { x: dataPos.x, y: dataPos.y };
      S.dragging = i;
      liveUpdate();
    },
    end: () => { S.dragging = -1; },
  };

  function setC(v, silent) {
    S.c = v; cSlider.set(v); paintDots();
    if (!silent) { reset(); L.toast(`c = ${v} — press ▶ to start again`); }
  }
  function setM(v, silent) {
    S.m = v; mSlider.set(v);
    L.regions.setFuzzy(true, v);
    if (!silent && S.cents.length) liveUpdate();
  }

  /* ---------------- controls ---------------- */
  const dots = h('div', { class: 'k-dots' }, PALETTE.map((c) => h('span', { class: 'k-dot', style: { background: css(c) } })));
  const paintDots = () => [...dots.children].forEach((d, i) => d.classList.toggle('off', i >= S.c));
  const cSlider = slider({ label: 'c — number of clusters', min: 2, max: 8, step: 1, value: S.c, onInput: (v) => setC(v) });
  const mSlider = slider({
    label: 'm — fuzziness', min: 1.1, max: 4, step: 0.1, value: S.m, format: (v) => v.toFixed(1),
    onInput: (v) => setM(v),
    hint: 'Close to 1 = almost hard (like K-Means). 2 = usual. Bigger = blurrier.',
  });
  const epsSeg = segmented({
    label: 'Stop when memberships change less than ε',
    options: [{ value: 0.05, label: '0.05' }, { value: 0.01, label: '0.01' }, { value: 0.001, label: '0.001' }],
    value: S.eps, onChange: (v) => { S.eps = v; if (S.phase === 'done' && S.lastDelta >= v) S.phase = 'mem'; refresh(); },
  });
  const initHint = h('span', { class: 'hint' }, 'Random U is the slide method: every point gets random shares. Centroids start near the middle and slowly pull apart.');
  const initSeg = segmented({
    label: 'First guess U⁽⁰⁾',
    options: [{ value: 'randomU', label: 'Random U' }, { value: 'points', label: 'From c points' }],
    value: S.init,
    onChange: (v) => {
      S.init = v;
      initHint.textContent = v === 'randomU'
        ? 'Random U is the slide method: every point gets random shares. Centroids start near the middle and slowly pull apart.'
        : 'Pick c random points as rough centres and compute U from them. Usually converges much faster.';
      if (S.phase !== 'ready') reset();
    },
  });
  const tHard = toggle({ label: 'Show hard labels (argmax)', emoji: '', value: false, onChange: (v) => { S.hard = v; recolor(); } });
  const tField = toggle({ label: 'Membership field', emoji: '', value: true, onChange: (v) => { S.showField = v; } });
  paintDots();
  L.addControls(
    section([L.num(3), 'Fuzzy C-Means settings'], cSlider.el, dots, mSlider.el, initSeg.el, initHint, epsSeg.el),
    section([L.num(4), 'Show'], tField.el, tHard.el),
  );

  /* ---------------- side: numbers ---------------- */
  const stats = statTiles([['iter', 'Round'], ['J', 'J_m'], ['delta', 'Max Δu']]);
  const chart = new MiniChart({ height: 130, xLabel: 'step', empty: 'Press Step to start' });
  const legend = h('div', { class: 'chart-legend' },
    h('span', {}, h('i', { style: { background: '#D4A24C' } }), 'after centroids'),
    h('span', {}, h('i', { style: { background: '#8A5A83' } }), 'after memberships'));
  const inspectTitle = h('div', { class: 'sub-label' }, 'Memberships');
  const inspectBars = h('div', { class: 'member-bars' });
  const numbers = h('div', { class: 'card side-card' },
    h('h3', {}, 'Live numbers'), stats.el, chart.canvas, legend, inspectTitle, inspectBars);
  L.mountSide(numbers);

  function mostUncertain() {
    if (!S.U) return -1;
    let bi = -1, bv = 2;
    S.U.forEach((u, i) => { const m = Math.max(...u); if (m < bv) { bv = m; bi = i; } });
    return bi;
  }

  function renderInspect() {
    let i = S.inspect;
    let auto = false;
    if (i < 0 || !S.U?.[i]) { i = mostUncertain(); auto = true; }
    S.shown = i;
    if (i < 0 || !S.U?.[i]) {
      inspectTitle.textContent = 'Memberships';
      inspectBars.replaceChildren(h('span', { class: 'hint' }, 'Step once to give every point its first memberships, then hover any point.'));
      return;
    }
    const p = L.points[i];
    const nm = p.name || `point #${i + 1}`;
    inspectTitle.textContent = auto ? `Most undecided point (${nm}) — hover others` : `Memberships of ${nm}`;
    inspectBars.replaceChildren(...S.U[i].map((u, j) => h('div', { class: 'member-bar' },
      h('span', {}, h('span', { class: 'sw', style: { background: css(PALETTE[j]) } }), ` ${PALETTE_NAMES[j]}`),
      h('span', { class: 'track' }, h('span', { class: 'fill', style: { width: (u * 100).toFixed(1) + '%', background: css(PALETTE[j]) } })),
      h('span', {}, u.toFixed(2)),
    )));
  }

  /* ---------------- frame ---------------- */
  const circ = [];
  L.hooks.frame = (dt, t) => {
    const k = 1 - Math.exp(-dt * 7 * Math.max(L.player.speed, 0.5));
    S.disp.forEach((d, i) => {
      const c = S.cents[i];
      if (!c || S.dragging === i) return;
      d.x += (c.x - d.x) * k; d.y += (c.y - d.y) * k;
    });
    S.busyStars = S.disp.some((d, i) => S.cents[i] && L.space.wl(Math.abs(S.cents[i].x - d.x) + Math.abs(S.cents[i].y - d.y)) > 0.004);
    const w = S.disp.map((d) => L.space.w(d));
    L.stars.update(w.map((q, i) => ({ ...q, active: S.dragging === i })), dt, t);
    L.regions.setCentroids(w, PALETTE);
    L.regions.show(S.showField && S.cents.length > 0);
    // ring around the inspected point
    circ.length = 0;
    const i = S.shown;
    if (i >= 0 && L.points[i]) circ.push({ x: L.points[i].wx, y: L.points[i].wy, r: 0.05 + Math.sin(t * 4) * 0.005, col: INK_C, fill: 0, ring: 0.9 });
    L.circles.sync(circ);
  };

  L.hooks.labels = () => {
    const out = [];
    const i = S.inspect;
    if (i >= 0 && S.U?.[i] && L.points[i]) {
      const p = L.points[i];
      out.push({ x: p.wx, y: p.wy, text: S.U[i].map((u) => u.toFixed(2)).join(' / '), cls: 'tip', dx: 12, dy: 8 });
    }
    if (L.lecture) S.disp.forEach((d, j) => {
      const q = L.space.w(d);
      out.push({ x: q.x, y: q.y, text: `c${j + 1} = ${S.lecture?.dim === 1 ? fmt(d.x) : pt(d)}`, cls: 'cent', dx: 12, dy: -30 });
    });
    return out;
  };

  /* ---------------- narration / numbers / worked ---------------- */
  function refresh() {
    const N = n();
    let nar, active;
    switch (S.phase) {
      case 'ready':
        active = 'ready';
        nar = N ? { emoji: '', title: `Ready: ${N} points, c = ${S.c}, m = ${fmt(S.m, 1)}`, text: 'Press <b>Step</b> and I’ll make a first guess of the membership table <b>U</b> — every point gets a share of every cluster.' }
          : { emoji: '', title: 'Give me some points!', text: 'Pick a dataset or click on the canvas.' };
        break;
      case 'init':
        active = 'init';
        nar = { emoji: '', title: 'Step 1 · First guess of U', text: S.lecture?.U0 ? 'These are the memberships <b>U⁽⁰⁾</b> given on the slide. Each row adds up to 1.' : S.init === 'points' ? 'Memberships computed from c random points as rough centres. Next: compute each centroid as a <b>weighted average</b>.' : 'Random memberships, so the colors are a muddy mix. Next: compute each centroid as a <b>weighted average</b>.' };
        break;
      case 'cent':
        active = 'cent';
        nar = { emoji: '', title: `Centroids · round ${S.iter + 1}`, text: `Each ★ moved to the average of <b>all</b> points, weighted by u<sup>m</sup>. Strong members pull harder.` };
        break;
      case 'mem':
        active = 'mem';
        nar = { emoji: '', title: `Memberships · round ${S.iter}`, text: `Every point re-measured its distance to each ★: closer means more membership. Biggest change: <b>${fmt(S.lastDelta, 3)}</b> (stop below ${S.eps}).` };
        break;
      case 'done':
        active = 'done';
        nar = { emoji: '', title: `Converged after ${S.iter} rounds`, text: `No membership changed by more than ${S.eps}. Hover points to see their mixes, or drag <b>m</b> and watch the field change.` };
        break;
      case 'edited':
        active = 'mem';
        nar = { emoji: '', title: 'Memberships updated live', text: 'Points re-measured their distance to the ★s. Press <b>Step</b> to move the centroids again.' };
        break;
    }
    L.narrate(nar, active);
    stats.set('iter', S.iter);
    stats.set('J', S.cents.length ? fmt(F.objective(L.points, S.U, S.cents, S.m), 2) : '–');
    stats.set('delta', S.lastDelta == null ? '–' : fmt(S.lastDelta, 3));
    chart.setLine(S.history.map((d) => ({ y: d.J, color: d.kind === 'cent' ? '#D4A24C' : '#8A5A83' })), { xLabel: 'step' });
    renderInspect();
    renderWorked();
  }

  function renderWorked() {
    const N = n();
    const show = L.lecture || (N > 0 && N <= 8);
    L.worked.show(!!show);
    if (!show) return;
    const one = S.lecture?.dim === 1;
    const name = (i) => L.points[i].name || `x${i + 1}`;
    const P = (p) => (one ? fmt(p.x, 3) : pt(p, 3));
    const parts = [];
    const C = S.cents.length || S.c;

    if (S.U) {
      const Ushow = S.phase === 'cent' ? S.U : S.prevU || S.U;
      if (S.phase === 'init' || S.phase === 'cent') {
        parts.push(step(S.phase === 'init' ? 'Membership matrix U⁽⁰⁾' : `Memberships used for this step`));
        parts.push(table(['Point', ...Array.from({ length: C }, (_, j) => `u·${j + 1}`)],
          (S.phase === 'init' ? S.U : Ushow).map((r, i) => [{ v: name(i), cls: 'rh' }, ...r.map((u) => fx(u, 2))])));
      }
    }

    if (S.phase === 'cent' && S.cents.length) {
      parts.push(step(`Centroids (m = ${fmt(S.m, 1)})`));
      S.cents.slice(0, 3).forEach((c, j) => {
        const rows = L.points.map((p, i) => {
          const u = S.U[i][j], w = Math.pow(u, S.m);
          return [{ v: name(i), cls: 'rh' }, fx(u, 2), fx(w, 3), one ? fx(w * p.x, 3) : `(${fx(w * p.x, 2)}, ${fx(w * p.y, 2)})`];
        });
        rows.push({ rowCls: 'cur', cells: [{ v: 'Σ', cls: 'rh' }, '', fx(c.den, 3), one ? fx(c.nx, 3) : `(${fx(c.nx, 2)}, ${fx(c.ny, 2)})`] });
        parts.push(table(['Point', `u·${j + 1}`, `u^m`, one ? 'u^m · x' : 'u^m · (x, y)'], rows, { caption: `Cluster ${j + 1}` }));
        parts.push(para(katexHtml(one
          ? `$c_${j + 1} = \\frac{${fmt(c.nx, 3)}}{${fmt(c.den, 3)}} \\approx ${fmt(c.x, 2)}$`
          : `$c_${j + 1} = \\left(\\frac{${fmt(c.nx, 3)}}{${fmt(c.den, 3)}}, \\frac{${fmt(c.ny, 3)}}{${fmt(c.den, 3)}}\\right) \\approx (${fmt(c.x, 2)}, ${fmt(c.y, 2)})$`)));
      });
      if (S.cents.length > 3) parts.push(note(`(Only the first 3 clusters shown.)`, 'info'));
    }

    if ((S.phase === 'mem' || S.phase === 'done' || S.phase === 'edited') && S.U) {
      parts.push(step(`Updated memberships (m = ${fmt(S.m, 1)})`));
      const head = ['Point', ...S.cents.map((_, j) => `d to c${j + 1}`), ...S.cents.map((_, j) => `u·${j + 1}`)];
      parts.push(table(head, L.points.map((p, i) => [
        { v: name(i), cls: 'rh' },
        ...S.cents.map((c) => fx(F.dist(p, c), 2)),
        ...S.U[i].map((u) => ({ v: fx(u, 2), cls: u === Math.max(...S.U[i]) ? 'ok' : '' })),
      ])));
      if (S.cents.length === 2 && L.points.length) {
        const p = L.points[0];
        const d1 = F.dist(p, S.cents[0]), d2 = F.dist(p, S.cents[1]);
        const e = 2 / (S.m - 1);
        parts.push(para(katexHtml(`Example: $u_{11} = \\dfrac{1}{1 + \\left(\\frac{${fmt(d1, 2)}}{${fmt(d2, 2)}}\\right)^{${fmt(e, 2)}}} \\approx ${fmt(S.U[0][0], 2)}$`)));
      }
    }
    if (!parts.length) parts.push(para('Press <b>Step</b> to start. The tables here follow every step with the same numbers as the slides.'));
    L.worked.set(parts, one ? '1D' : `${N} points`);
  }

  /* ---------------- challenges ---------------- */
  const actions = {
    lec1: () => { L.loadLecture(LECTURES[0]); L.focusStage(); },
    overlap: () => { L.loadDataset('overlap'); setC(3, true); reset(); L.focusStage(); setTimeout(() => L.player.play(), 500); },
    blobs: () => { L.loadDataset({ id: 'blobs', label: 'Blobs', make: (k) => blobs(k, 3), note: 'Three blobs.' }); setC(3, true); reset(); L.focusStage(); setTimeout(() => L.player.play(), 500); },
  };

  L.loadDataset('overlap');
  return () => L.dispose();
}
