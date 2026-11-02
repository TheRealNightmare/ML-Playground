// Shared scaffold for every 2D point-based playground:
// lab layout, three.js stage + layers, slide-unit space, drawing tools, datasets,
// lecture examples, narrator, playback, worked-example card and learn tabs.
// An algorithm page fills in `L.hooks` and adds its own controls and side cards.

import * as THREE from 'three';
import { createLab } from './lab.js';
import { Stage } from './stage.js';
import { Space } from './space.js';
import { RegionBackground, PointLayer, StarLayer, SegmentLayer, CircleLayer } from './layers.js';
import { LabelOverlay, AxesOverlay } from './overlay.js';
import { Player } from './player.js';
import { workedCard, fmt } from './worked.js';
import { h, section, slider, segmented, button, tabs } from './ui.js';
import { INK, NEUTRAL, PALETTE } from './theme.js';
import { LIB } from './datasets.js';

export const GREY = new THREE.Color(NEUTRAL);
export const COLORS = PALETTE.map((c) => new THREE.Color(c));
export const INK_C = new THREE.Color(INK);
export const WHITE = new THREE.Color(0xffffff);
export const colorOf = (k) => (k >= 0 ? COLORS[k % COLORS.length] : GREY);

export function createPointLab(root, cfg) {
  const maxPoints = cfg.maxPoints || 1200;
  const lab = createLab(root, cfg.meta);
  const stage = new Stage(lab.stageHolder, { domain: 1.12 });
  const space = new Space();
  const regions = new RegionBackground(stage);
  const circles = new CircleLayer(stage, { max: cfg.maxCircles || maxPoints, z: -2 });
  const segs = new SegmentLayer(stage, { max: cfg.maxSegments || maxPoints * 3, z: -1 });
  const pointLayer = new PointLayer(stage, { max: maxPoints, radius: 0.024 });
  const stars = new StarLayer(stage, { size: 0.068 });
  const labels = new LabelOverlay(stage, lab.overlay);
  const axes = new AxesOverlay(stage, lab.overlay, space, regions);
  axes.setVisible(false);

  const brush = new THREE.Mesh(
    new THREE.RingGeometry(0.93, 1, 48),
    new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  brush.position.z = 5;
  brush.visible = false;
  brush.scale.setScalar(0.075);
  stage.scene.add(brush);

  /* ---------- overlays ---------- */
  const toastEl = h('div', { class: 'toast', role: 'status' });
  const emptyEl = h('div', { class: 'stage-empty' }, h('div', {}, h('span', { class: 'big' }, '👆'), 'Click anywhere to add points', h('br'), h('small', {}, 'or pick a dataset')));
  const tipEl = h('div', { class: 'stage-tip' });
  lab.overlay.append(emptyEl, tipEl, toastEl);
  let toastTimer = 0;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  };

  const L = {
    lab, stage, space, regions, circles, segs, pointLayer, stars, labels, axes, toast,
    points: [],
    lecture: null,
    datasetId: cfg.defaultDataset,
    n: cfg.n?.value ?? 200,
    tool: 'draw',
    hovered: -1,
    hooks: {},
    maxPoints,
  };

  /* ---------- player ---------- */
  const player = new Player({
    onStep: () => (L.points.length ? L.hooks.step?.() : (toast('Add some points first 🙂'), false)),
    onReset: () => { L.hooks.reset?.(); toast('Reset — same points, fresh start'); },
    isBusy: () => L.hooks.isBusy?.() || L.busy,
    baseInterval: cfg.interval ?? 0.85,
  });
  L.player = player;
  lab.playbarSlot.append(player.el);
  player.el.append(h('span', { class: 'kbd-hint' }, h('span', { class: 'kbd' }, 'Space'), 'play ', h('span', { class: 'kbd' }, '→'), 'step ', h('span', { class: 'kbd' }, 'R'), 'reset'));

  /* ---------- points ---------- */
  L.newPoint = (x, y, name = null, wait = 0) => ({
    x, y, name,
    col: GREY.clone(), tc: GREY, oc: null, fr: 0.66,
    s: 0, ts: 1, sz: 1, wait,
    wx: 0, wy: 0, far: false,
  });

  function nextName() {
    const named = L.points.filter((p) => p.name);
    if (!named.length) return null;
    const last = named[named.length - 1].name;
    const m = /^([A-Za-z]*)(\d+)$/.exec(last);
    if (m) {
      const nums = named.map((p) => +(/\d+$/.exec(p.name)?.[0] ?? 0));
      return m[1] + (Math.max(...nums) + 1);
    }
    if (/^[A-Z]$/.test(last)) {
      const codes = named.filter((p) => /^[A-Z]$/.test(p.name)).map((p) => p.name.charCodeAt(0));
      const c = Math.max(...codes) + 1;
      return c <= 90 ? String.fromCharCode(c) : null;
    }
    return null;
  }

  /* ---------- data loading ---------- */
  const chipEls = [];
  const datasetNote = h('span', { class: 'hint' });

  function markChip(id) { chipEls.forEach((b) => b.classList.toggle('active', b.dataset.id === id)); }

  L.setPoints = (xy, { stagger = true } = {}) => {
    L.points = xy.slice(0, maxPoints).map((p, i) => L.newPoint(p.x, p.y, p.name || null, stagger ? Math.min(0.45, (i / Math.max(xy.length, 1)) * 0.45) : 0));
  };

  L.loadDataset = (id) => {
    player.pause();
    const ds = typeof id === 'object' ? id : LIB[id] || cfg.extraDatasets?.[id];
    L.datasetId = ds.id;
    L.lecture = null;
    space.setIdentity();
    axes.setVisible(false);
    L.setPoints(ds.make(L.n));
    markChip(ds.id);
    datasetNote.textContent = cfg.notes?.[ds.id] || ds.note;
    L.hooks.onDataset?.(ds);
    L.hooks.reset?.();
    L.refreshEmpty();
  };

  L.loadLecture = (lec) => {
    player.pause();
    L.lecture = lec;
    L.datasetId = lec.id;
    L.setPoints((lec.points || []).map((p) => ({ ...p })));
    const fitPts = lec.fit ? L.points.filter((p) => lec.fit.includes(p.name)) : L.points;
    space.fit(fitPts, { box: lec.box ?? 0.72, minSpan: lec.minSpan ?? 1 });
    axes.setVisible(true);
    axes.key = '';
    markChip(lec.id);
    datasetNote.innerHTML = lec.note || 'The exact numbers from the lecture slides. Step through it and compare with the tables.';
    L.hooks.onLecture?.(lec);
    L.hooks.reset?.();
    L.refreshEmpty();
  };

  L.refreshEmpty = () => { emptyEl.style.opacity = L.points.length ? 0 : 1; };

  /* ---------- pointer interaction ---------- */
  const canvas = stage.canvas;
  let drag = null;
  let lastSpray = 0;
  const hitPoint = (w, r = 0.045) => {
    let best = -1, bd = r * r;
    L.points.forEach((p, i) => { if (p.far) return; const d = (p.wx - w.x) ** 2 + (p.wy - w.y) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  };
  L.hitPoint = hitPoint;
  const addPointAt = (w) => {
    if (L.points.length >= maxPoints) { toast(`That’s the max (${maxPoints} points)`); return -1; }
    const d = space.d(w);
    const p = L.newPoint(d.x, d.y, L.lecture ? nextName() : null);
    L.points.push(p);
    return L.points.length - 1;
  };
  const eraseAt = (w, r = 0.075) => {
    const before = L.points.length;
    L.points = L.points.filter((p) => p.far || (p.wx - w.x) ** 2 + (p.wy - w.y) ** 2 > r * r);
    return before - L.points.length;
  };
  const spray = (w) => {
    let added = 0;
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.075;
      const q = stage.clamp({ x: w.x + Math.cos(a) * r, y: w.y + Math.sin(a) * r });
      if (addPointAt(q) < 0) break;
      added++;
    }
    return added;
  };
  const edited = (kind) => { L.hooks.onEdit?.(kind); L.refreshEmpty(); };
  const editable = () => (L.hooks.canEdit ? L.hooks.canEdit() : true);

  const onDown = (ev) => {
    if (ev.button !== undefined && ev.button > 0) return;
    const w = stage.clamp(stage.toWorld(ev));
    canvas.setPointerCapture?.(ev.pointerId);
    const handle = L.hooks.handles?.hit(w);
    if (handle != null) {
      drag = { type: 'handle', id: handle };
      player.pause();
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (!editable()) { toast(L.hooks.lockedMessage || 'Editing is locked in this example'); return; }
    if (L.tool === 'erase') { drag = { type: 'erase' }; if (eraseAt(w)) edited('erase'); return; }
    if (L.tool === 'spray') { drag = { type: 'spray' }; if (spray(w)) edited('add'); lastSpray = performance.now(); return; }
    const pi = hitPoint(w);
    if (pi >= 0) {
      const p = L.points[pi];
      drag = { type: 'point', p, ox: p.wx - w.x, oy: p.wy - w.y };
      p.ts = 1.6;
      canvas.style.cursor = 'grabbing';
      return;
    }
    const ni = addPointAt(w);
    if (ni >= 0) {
      const p = L.points[ni];
      drag = { type: 'point', p, ox: 0, oy: 0 };
      p.ts = 1.6;
      edited('add');
    }
  };

  const onMove = (ev) => {
    const w = stage.toWorld(ev);
    const wc = stage.clamp(w);
    brush.position.set(w.x, w.y, 5);
    if (!drag) {
      const overHandle = L.hooks.handles?.hit(w) != null;
      const hp = hitPoint(w);
      if (hp !== L.hovered) { L.hovered = hp; L.hooks.onHover?.(hp); }
      if (overHandle) canvas.style.cursor = 'grab';
      else if (L.tool === 'draw') canvas.style.cursor = hp >= 0 ? 'grab' : 'crosshair';
      else canvas.style.cursor = 'none';
      brush.visible = !overHandle && editable() && (L.tool === 'erase' || L.tool === 'spray');
      return;
    }
    if (drag.type === 'handle') {
      L.hooks.handles.drag(drag.id, space.d(wc), wc);
    } else if (drag.type === 'point') {
      const q = stage.clamp({ x: w.x + drag.ox, y: w.y + drag.oy });
      const d = space.d(q);
      drag.p.x = d.x; drag.p.y = d.y;
      edited('move');
    } else if (drag.type === 'erase') {
      if (eraseAt(wc)) edited('erase');
    } else if (drag.type === 'spray') {
      const now = performance.now();
      if (now - lastSpray > 28) { lastSpray = now; if (spray(wc)) edited('add'); }
    }
  };

  const onUp = (ev) => {
    if (!drag) return;
    if (drag.type === 'handle') L.hooks.handles.end?.(drag.id);
    if (drag.type === 'point') { drag.p.ts = 1; L.hooks.onEditEnd?.(); }
    if (drag.type === 'erase' || drag.type === 'spray') L.hooks.onEditEnd?.();
    drag = null;
    canvas.releasePointerCapture?.(ev.pointerId);
    onMove(ev);
  };
  const onLeave = () => { if (!drag) { brush.visible = false; if (L.hovered !== -1) { L.hovered = -1; L.hooks.onHover?.(-1); } } };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------- frame loop ---------- */
  const disp = [];
  stage.onFrame((dt, t) => {
    player.update(dt);
    L.hooks.frame?.(dt, t);
    const sp = Math.max(player.speed, 0.5);
    const kP = 1 - Math.exp(-dt * 10 * sp);
    const kS = 1 - Math.exp(-dt * 14);
    const v = stage.view;
    const mx = v.halfW - 0.04, my = v.halfH - 0.04;
    let busy = false;
    disp.length = L.points.length;
    for (let i = 0; i < L.points.length; i++) {
      const p = L.points[i];
      if (p.wait > 0) { p.wait -= dt; p.s = 0; busy = true; }
      else {
        p.col.lerp(p.tc, kP);
        p.s += (p.ts * p.sz - p.s) * kS;
      }
      const w = space.w(p);
      p.far = Math.abs(w.x) > mx || Math.abs(w.y) > my;
      p.wx = Math.max(-mx, Math.min(mx, w.x));
      p.wy = Math.max(-my, Math.min(my, w.y));
      const o = disp[i] || (disp[i] = {});
      o.x = p.wx; o.y = p.wy; o.s = p.s; o.col = p.col; o.oc = p.oc; o.fr = p.fr;
    }
    L.busy = busy;
    pointLayer.sync(disp);
    regions.update(dt);
    axes.update();

    // name tags
    const items = [];
    const showNames = L.lecture || L.points.length <= 40;
    if (showNames) {
      let farK = 0;
      for (const p of L.points) {
        if (!p.name) continue;
        if (p.far) {
          const right = p.wx > 0, top = p.wy > 0;
          items.push({ x: p.wx, y: p.wy, text: `${p.name} (${fmt(p.x)}, ${fmt(p.y)}) ${top ? (right ? '↗' : '↖') : right ? '↘' : '↙'} far away`, cls: 'far', anchor: right ? 'right' : 'left', dx: right ? -10 : 10, dy: (top ? 8 : -30) + (top ? 1 : -1) * 22 * farK++ });
        } else items.push({ x: p.wx, y: p.wy, text: p.name });
      }
    }
    const extra = L.hooks.labels?.();
    if (extra) items.push(...extra);
    labels.update(items);
  });

  /* ---------- controls ---------- */
  const datasetList = cfg.datasets.map((id) => (typeof id === 'object' ? id : LIB[id]));
  const chips = datasetList.map((d) => {
    const b = h('button', { type: 'button', class: 'chip', 'data-id': d.id, onclick: () => L.loadDataset(d) }, h('span', { class: 'emo' }, d.emoji), d.label);
    chipEls.push(b);
    return b;
  });
  const lectureChips = (cfg.lectures || []).map((lec) => {
    const b = h('button', { type: 'button', class: 'chip chip-lecture', 'data-id': lec.id, onclick: () => L.loadLecture(lec) }, h('span', { class: 'emo' }, '📝'), lec.label);
    chipEls.push(b);
    return b;
  });
  const nSlider = cfg.n ? slider({ label: 'Number of points', min: cfg.n.min, max: cfg.n.max, step: cfg.n.step, value: L.n, onInput: (v) => { L.n = v; } }) : null;
  nSlider?.el.querySelector('input').addEventListener('change', () => { if (!L.lecture && L.datasetId !== 'blank') L.loadDataset(L.datasetId); });

  const toolSeg = segmented({
    options: [
      { value: 'draw', label: '✏️ Draw', title: 'Click to add a point, drag to move one' },
      { value: 'spray', label: '💨 Spray', title: 'Hold and drag to spray many points' },
      { value: 'erase', label: '🧽 Erase', title: 'Hold and drag to erase points' },
    ],
    value: 'draw',
    onChange: (v) => { L.tool = v; updateTip(); },
  });
  function updateTip() {
    tipEl.textContent = (cfg.tips || {
      draw: '✏️ Click to add · drag a point to move it',
      spray: '💨 Hold & drag to spray points',
      erase: '🧽 Hold & drag to erase',
    })[L.tool];
  }
  updateTip();

  const num = (n) => h('span', { class: 'num' }, n);
  L.num = num;
  L.controlsData = section([num(1), 'Data'],
    h('div', { class: 'chips' }, chips),
    lectureChips.length ? h('div', { class: 'lecture-row' }, h('span', { class: 'field-label' }, 'From the lecture'), h('div', { class: 'chips chips-lecture' }, lectureChips)) : null,
    datasetNote,
    nSlider?.el,
    button('🔄 New sample', () => (L.lecture ? L.loadLecture(L.lecture) : L.loadDataset(L.datasetId)), { variant: 'btn-block' }),
  );
  L.controlsDraw = section([num(2), 'Draw your own'],
    toolSeg.el,
    h('span', { class: 'hint' }, cfg.drawHint || 'Drag any point to move it. Everything reacts live.'),
    button('🗑️ Clear canvas', () => {
      player.pause();
      L.points = [];
      L.lecture = null;
      space.setIdentity();
      axes.setVisible(false);
      L.datasetId = 'blank';
      markChip('blank');
      datasetNote.textContent = LIB.blank.note;
      L.hooks.reset?.();
      L.refreshEmpty();
    }, { variant: 'btn-ghost btn-block' }),
  );
  lab.controls.append(L.controlsData, L.controlsDraw);
  L.addControls = (...nodes) => lab.controls.append(...nodes);

  /* ---------- narrator ---------- */
  let lastNarr = '';
  L.narrate = ({ emoji, title, text }, activeId) => {
    const key = emoji + title + text + activeId;
    if (key === lastNarr) return;
    lastNarr = key;
    const track = h('div', { class: 'phase-track' });
    const items = cfg.phaseTrack || [];
    const ai = items.findIndex((p) => p.id === activeId);
    items.forEach((p, i) => {
      if (i) track.append(h('span', { class: 'phase-arrow' }, p.loopBack ? '⇄' : '→'));
      track.append(h('span', { class: 'phase-chip' + (i === ai ? ' active' : i < ai ? ' done' : '') }, p.label));
    });
    lab.narrator.replaceChildren(
      h('div', { class: 'narrator-avatar bounce' }, emoji),
      h('div', { class: 'narrator-main' }, items.length ? track : null, h('div', { class: 'narrator-title' }, title), h('div', { class: 'narrator-text', html: text })),
    );
  };

  /* ---------- side cards ---------- */
  L.worked = workedCard();
  L.worked.show(false);
  L.learn = tabs(cfg.learnTabs);
  L.learnCard = h('div', { class: 'card side-card' }, h('h3', {}, '📚 Learn'), L.learn.el);
  L.mountSide = (...cards) => lab.side.append(...cards, L.worked.el, L.learnCard);

  L.focusStage = () => { if (window.innerWidth < 1240) lab.el.querySelector('.lab-stage').scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  L.dispose = () => {
    clearTimeout(toastTimer);
    player.dispose();
    regions.dispose();
    circles.dispose();
    stars.dispose();
    stage.dispose();
  };
  return L;
}

/** Small "stat" tile helper used in the numbers cards. */
export function statTiles(defs) {
  const els = {};
  const el = h('div', { class: 'stats' + (defs.length === 2 ? ' stats-2' : defs.length === 4 ? ' stats-4' : '') },
    defs.map(([key, label]) => {
      const v = h('div', { class: 'stat-value' }, '–');
      els[key] = v;
      return h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, label), v);
    }),
  );
  const set = (key, val) => {
    const e = els[key];
    const s = String(val);
    if (e.textContent === s) return;
    e.textContent = s;
    e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop');
  };
  return { el, set };
}
