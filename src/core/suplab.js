// Scaffold for the supervised playgrounds (trees, forests, boosting, cross-validation).
// Builds on createPointLab and adds:
//   · a task switch: classification (2D features) / regression (1D: x → y)
//   · a class picker for drawing labelled points
//   · 'cls1d' lecture view: one feature on x, the class (0/1) on y, model shown as a curve P(y=1|x)
//   · a decision field (background shading) and prediction curves

import * as THREE from 'three';
import { createPointLab, GREY, COLORS } from './pointlab.js';
import { DecisionField } from './field.js';
import { SegmentLayer } from './layers.js';
import { segmented, h } from './ui.js';
import { PAPER, INK, css, PALETTE } from './theme.js';
import { SUPDATA, CLS_SETS, REG_SETS } from './supdata.js';
import { argmax } from './trees.js';

const BASE = new THREE.Color(PAPER);
const INKC = new THREE.Color(INK);
const SLATE = new THREE.Color(0x4f6d8a);

export function createSupLab(root, cfg) {
  const tasks = cfg.tasks || ['cls', 'reg'];
  const clsSets = cfg.clsSets || CLS_SETS;
  const regSets = cfg.regSets || REG_SETS;
  const sets = [...(tasks.includes('cls') ? clsSets : []), ...(tasks.includes('reg') ? regSets : [])].map((id) => SUPDATA[id]);
  const classNames = cfg.classNames || ['Class A', 'Class B', 'Class C'];

  const L = createPointLab(root, {
    ...cfg,
    datasets: sets,
    extraDatasets: SUPDATA,
    defaultDataset: cfg.defaultDataset || sets[0].id,
    maxSegments: cfg.maxSegments || 6000,
    blankId: () => (L.task === 'reg' ? 'rblank' : 'cblank'),
    blankNote: 'Empty canvas. Pick a class and click to add points.',
    tips: { draw: 'Click to add · drag to move', spray: 'Hold & drag to spray', erase: 'Hold & drag to erase' },
  });
  L.task = cfg.defaultTask || tasks[0];
  L.nClasses = 2;
  L.drawClass = 0;
  L.field = new DecisionField(L.stage, { res: cfg.fieldRes || 190, z: -4 });
  L.curveSegs = new SegmentLayer(L.stage, { max: cfg.maxCurveSegments || 9000, z: -0.8 });

  /* ---------- task + class pickers ---------- */
  const taskSeg = tasks.length > 1 ? segmented({
    label: 'Task',
    options: [{ value: 'cls', label: 'Classification' }, { value: 'reg', label: 'Regression' }],
    value: L.task === 'reg' ? 'reg' : 'cls',
    onChange: (v) => L.setTask(v),
  }) : null;
  if (taskSeg) L.controlsData.insertBefore(taskSeg.el, L.controlsData.children[1]);

  const classWrap = h('div', {});
  L.controlsDraw.insertBefore(classWrap, L.controlsDraw.children[2]);
  function buildClassPicker() {
    if (L.task === 'reg' || L.task === 'id3' || L.lecture?.noDraw) { classWrap.replaceChildren(); return; }
    const K = L.task === 'cls1d' ? 2 : L.nClasses;
    const names = L.lecture?.classNames || classNames;
    const seg = segmented({
      label: 'New points get class',
      options: Array.from({ length: K }, (_, k) => ({ value: k, label: names[k] })),
      value: Math.min(L.drawClass, K - 1),
      onChange: (v) => { L.drawClass = v; },
    });
    seg.el.querySelectorAll('.seg-btn').forEach((b, k) => {
      b.prepend(h('span', { class: 'cls-dot', style: { background: css(PALETTE[k]) } }));
    });
    classWrap.replaceChildren(seg.el);
  }

  function filterChips() {
    const want = L.task === 'reg' ? 'reg' : 'cls';
    L.controlsData.querySelectorAll('.chip[data-id]').forEach((b) => {
      const ds = SUPDATA[b.dataset.id];
      if (ds) b.style.display = ds.task === want ? '' : 'none';
    });
  }

  L.setTask = (t, { load = true } = {}) => {
    L.task = t;
    taskSeg?.set(t === 'reg' ? 'reg' : 'cls');
    filterChips();
    buildClassPicker();
    if (load) L.loadDataset(t === 'reg' ? regSets[0] : clsSets[0]);
  };

  /* ---------- dataset / lecture integration ---------- */
  const userOnDataset = () => L.hooks.onDatasetSup?.();
  L.hooks.onDataset = (ds) => {
    if (ds.task) { L.task = ds.task; taskSeg?.set(ds.task); filterChips(); }
    L.nClasses = ds.nClasses || Math.max(2, ...L.points.map((p) => p.label + 1));
    buildClassPicker();
    userOnDataset(ds);
  };
  L.hooks.onLecture = (lec) => {
    L.task = lec.task;
    taskSeg?.set(lec.task === 'reg' ? 'reg' : 'cls');
    filterChips();
    L.nClasses = lec.nClasses || 2;
    buildClassPicker();
    L.hooks.onLectureSup?.(lec);
  };
  // cls1d: the y position *is* the class
  L.hooks.placeNew = (p) => {
    if (L.task === 'cls1d') { p.y = L.drawClass; p.label = L.drawClass; }
    if (L.task === 'cls' && p.label >= L.nClasses) L.nClasses = p.label + 1;
  };
  L.hooks.constrain = (p) => {
    if (L.task === 'cls1d') { p.label = p.y > 0.5 ? 1 : 0; p.y = p.label; }
  };

  /** After "Clear canvas" in a lecture-only view (cls1d / id3), fall back to plain classification. */
  L.normalizeTask = () => {
    if (!L.lecture && (L.task === 'cls1d' || L.task === 'id3')) { L.task = 'cls'; taskSeg?.set('cls'); filterChips(); buildClassPicker(); }
  };

  /* ---------- features / targets ---------- */
  L.feat = (p) => (L.task === 'cls' ? [p.x, p.y] : [p.x]);
  L.X = () => L.points.map(L.feat);
  L.Y = () => L.points.map((p) => (L.task === 'reg' ? p.y : p.label));
  L.isCls = () => L.task !== 'reg';
  L.nFeatures = () => (L.task === 'cls' ? 2 : 1);

  /** Default point colors: class color, or slate for regression. Pages can override after calling this. */
  L.colorPoints = () => {
    for (const p of L.points) {
      p.tc = L.task === 'reg' ? SLATE : COLORS[p.label % COLORS.length] || GREY;
      p.oc = null; p.fr = 0.74;
    }
  };

  /* ---------- model rendering ---------- */
  const tmp = new THREE.Color();
  const out = [0, 0, 0, 0];
  /** Classification (2D): shade the background by predicted class probabilities. probs(x[]) → array */
  L.showField = (probs, { strength = 1 } = {}) => {
    if (!probs || L.task !== 'cls') { L.field.paint(null); return; }
    L.field.paint((wx, wy) => {
      const d = L.space.d({ x: wx, y: wy });
      const pr = probs([d.x, d.y]);
      tmp.setRGB(0, 0, 0);
      let pmax = 0, p2 = 0;
      for (let k = 0; k < pr.length; k++) {
        const c = COLORS[k % COLORS.length];
        tmp.r += c.r * pr[k]; tmp.g += c.g * pr[k]; tmp.b += c.b * pr[k];
        if (pr[k] > pmax) { p2 = pmax; pmax = pr[k]; } else if (pr[k] > p2) p2 = pr[k];
      }
      const K = Math.max(pr.length, 2);
      const conf = Math.max(0, (pmax - 1 / K) / (1 - 1 / K));
      let a = (0.12 + 0.3 * conf) * strength;
      if (pmax - p2 < 0.045) { tmp.lerp(INKC, 0.6); a = Math.max(a, 0.5 * strength); }
      out[0] = tmp.r; out[1] = tmp.g; out[2] = tmp.b; out[3] = a;
      return out;
    });
  };

  /**
   * Curves for regression and cls1d: list of { fn: x → y (data units), color: THREE.Color, width, fade (0..1) }.
   * Recomputed only when the curves or the view change.
   */
  let curves = [];
  let curveKey = '';
  L.setCurves = (list) => { curves = list || []; curveKey = ''; };
  const segBuf = [];
  function drawCurves() {
    const v = L.stage.view, sp = L.space;
    const key = [v.halfW, v.halfH, sp.s, sp.cx, sp.cy, curves.length].join('|');
    if (key === curveKey) return;
    curveKey = key;
    segBuf.length = 0;
    const N = Math.max(120, Math.min(420, Math.round(v.w / 3)));
    for (const c of curves) {
      const col = c.color.clone().lerp(BASE, c.fade || 0);
      const w = c.width || 0.009;
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const wx = -v.halfW + (i / N) * 2 * v.halfW;
        const dx = sp.d({ x: wx, y: 0 }).x;
        const dy = c.fn(dx);
        const wy = sp.w({ x: dx, y: dy }).y;
        if (prev && Number.isFinite(dy)) {
          // vertical jumps get drawn as a clean step
          if (c.step && Math.abs(wy - prev.y) > 1e-6) {
            segBuf.push({ x1: prev.x, y1: prev.y, x2: wx, y2: prev.y, w, col });
            segBuf.push({ x1: wx, y1: prev.y, x2: wx, y2: wy, w, col });
          } else segBuf.push({ x1: prev.x, y1: prev.y, x2: wx, y2: wy, w, col });
        }
        prev = Number.isFinite(dy) ? { x: wx, y: wy } : null;
      }
    }
    L.curveSegs.sync(segBuf);
  }
  L.redrawCurves = () => { curveKey = ''; };

  L.hooks.frame = (dt, t) => {
    L.hooks.frameSup?.(dt, t);
    drawCurves();
  };

  /* ---------- metrics ---------- */
  L.accuracy = (predClass, idx = null) => {
    const ids = idx || L.points.map((_, i) => i);
    if (!ids.length) return null;
    let ok = 0;
    for (const i of ids) if (predClass(L.feat(L.points[i])) === L.points[i].label) ok++;
    return ok / ids.length;
  };
  L.mse = (pred, idx = null) => {
    const ids = idx || L.points.map((_, i) => i);
    if (!ids.length) return null;
    let s = 0;
    for (const i of ids) s += (pred(L.feat(L.points[i])) - L.points[i].y) ** 2;
    return s / ids.length;
  };
  L.argmax = argmax;

  const baseDispose = L.dispose;
  L.dispose = () => { L.field.dispose(); baseDispose(); };

  filterChips();
  buildClassPicker();
  return L;
}

/** World-space segment for a split line inside a node's box (feature 0 = x, 1 = y), clipped to the view. */
export function splitSegment(L, node, colWidth = 0.008) {
  const v = L.stage.view;
  const lo = node.box.lo, hi = node.box.hi;
  const sp = L.space;
  const clipX = (x) => Math.max(-v.halfW, Math.min(v.halfW, x));
  const clipY = (y) => Math.max(-v.halfH, Math.min(v.halfH, y));
  if (node.feature === 0) {
    const wx = sp.w({ x: node.thr, y: 0 }).x;
    const y1 = L.task === 'cls' && Number.isFinite(lo[1]) ? sp.w({ x: 0, y: lo[1] }).y : -v.halfH;
    const y2 = L.task === 'cls' && Number.isFinite(hi[1]) ? sp.w({ x: 0, y: hi[1] }).y : v.halfH;
    return { x1: wx, y1: clipY(y1), x2: wx, y2: clipY(y2), w: colWidth };
  }
  const wy = sp.w({ x: 0, y: node.thr }).y;
  const x1 = Number.isFinite(lo[0]) ? sp.w({ x: lo[0], y: 0 }).x : -v.halfW;
  const x2 = Number.isFinite(hi[0]) ? sp.w({ x: hi[0], y: 0 }).x : v.halfW;
  return { x1: clipX(x1), y1: wy, x2: clipX(x2), y2: wy, w: colWidth };
}
