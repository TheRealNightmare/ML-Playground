import * as THREE from 'three';
import { createPointLab, statTiles, GREY, COLORS, INK_C } from '../../core/pointlab.js';
import { h, section, slider, segmented, toggle, button } from '../../core/ui.js';
import { table, note, para, step, fmt, fx, pt } from '../../core/worked.js';
import { katexHtml } from '../../core/tex.js';
import { gauss, clip, blobs, moons } from '../../core/datasets.js';
import { agglomerate, labelsAfter, leafOrder, mds2, METRICS } from './algo.js';
import { LECTURES, LINKAGE_INFO, intuitionTab, mathTab, challengesTab } from './content.js';

const FAINT = new THREE.Color(0xddd3c4);

function bridge(n) {
  const out = [];
  const m = Math.round(n * 0.44);
  for (let i = 0; i < m; i++) out.push(clip({ x: -0.55 + gauss() * 0.13, y: gauss() * 0.13 }));
  for (let i = 0; i < m; i++) out.push(clip({ x: 0.55 + gauss() * 0.13, y: gauss() * 0.13 }));
  const b = n - 2 * m;
  for (let i = 0; i < b; i++) out.push({ x: -0.35 + (0.7 * (i + 0.5)) / b + gauss() * 0.01, y: gauss() * 0.02 });
  return out;
}
const BRIDGE = { id: 'bridge', label: 'Bridge', emoji: '', make: bridge, note: 'Two blobs joined by a thin line of points.' };

export function mount(root) {
  const S = {
    linkage: 'single', metric: 'euclidean',
    res: null, m: 0, K: 3, phase: 'ready', anim: 1, matrix: null,
    show: { lines: true, centroids: true },
    lastPop: -1,
  };

  const L = createPointLab(root, {
    meta: { accent: '#6B8E5A', title: 'Hierarchical Clustering', emoji: '', category: 'Unsupervised · Clustering', level: 'Beginner friendly', blurb: 'Merge the two closest clusters again and again, and grow a family tree of your data.' },
    datasets: ['blobs', 'moons', BRIDGE, 'rings', 'uniform', 'blank'],
    defaultDataset: 'blobs',
    n: { min: 6, max: 200, step: 2, value: 48 },
    maxPoints: 260,
    interval: 0.75,
    lectures: LECTURES,
    phaseTrack: [
      { id: 'ready', label: 'Every point alone' },
      { id: 'merge', label: 'Merge closest' },
      { id: 'update', label: 'Update distances', loopBack: true },
      { id: 'done', label: 'Dendrogram' },
    ],
    learnTabs: [
      { id: 'intuition', label: 'Intuition', render: intuitionTab },
      { id: 'math', label: '∑ Math', render: mathTab },
      { id: 'try', label: 'Try this', render: () => challengesTab(actions) },
    ],
  });

  const n = () => L.points.length;
  const nameOf = (i) => L.points[i]?.name || `P${i + 1}`;
  function clusterName(members) {
    const names = members.slice().sort((a, b) => a - b).map(nameOf);
    if (names.length === 1) return names[0];
    if (names.every((s) => /^P\d+$/.test(s))) return 'C' + names.map((s) => s.slice(1)).join('');
    if (names.every((s) => /^[A-Z]$/.test(s))) return names.join('');
    return names.length <= 3 ? '{' + names.join(',') + '}' : `{${names[0]},…}(${names.length})`;
  }

  /* ---------------- compute ---------------- */
  function compute() {
    if (n() < 2) { S.res = { n: n(), merges: [] }; return; }
    S.res = agglomerate({
      points: L.points,
      matrix: S.matrix,
      linkage: S.linkage,
      metric: S.metric,
      record: n() <= 12,
    });
    // stable colors: a new cluster keeps the color of its bigger colored child
    const col = new Map();
    let next = 0;
    for (const mg of S.res.merges) {
      const ca = col.get(mg.a), cb = col.get(mg.b);
      const sa = mg.sizeA, sb = mg.sizeB;
      let c;
      if (ca != null && cb != null) c = sa >= sb ? ca : cb;
      else if (ca != null) c = ca;
      else if (cb != null) c = cb;
      else c = next++ % COLORS.length;
      col.set(mg.id, c);
    }
    S.colorOf = col;
    S.order = leafOrder(n(), S.res.merges);
    S.m = Math.min(S.m, S.res.merges.length);
  }

  const mUse = () => (S.phase === 'done' ? Math.max(0, n() - S.K) : S.m);

  function reset() {
    S.m = 0;
    S.anim = 1;
    S.phase = n() ? 'ready' : 'ready';
    compute();
    refresh();
  }

  function doStep() {
    if (!S.res || n() < 2) { L.toast('Need at least 2 points'); return false; }
    if (S.phase === 'done') { L.toast('All merged — drag the cut line on the dendrogram '); return false; }
    S.m++;
    S.anim = 0;
    S.lastPop = S.m - 1;
    const mg = S.res.merges[S.m - 1];
    for (const i of mg.members) { const p = L.points[i]; if (p) p.s = Math.max(p.s, 1.45); }
    S.phase = S.m >= S.res.merges.length ? 'done' : 'merge';
    if (S.phase === 'done') S.K = Math.min(S.K, n());
    refresh();
    return S.phase !== 'done';
  }

  function finish() {
    if (!S.res || n() < 2) return;
    L.player.pause();
    S.m = S.res.merges.length;
    S.anim = 0.2;
    S.phase = 'done';
    refresh();
  }

  /* ---------------- hooks ---------------- */
  L.hooks.reset = reset;
  L.hooks.step = doStep;
  L.hooks.isBusy = () => S.anim < 0.98;
  L.hooks.canEdit = () => !S.matrix;
  L.hooks.lockedMessage = 'This example is a distance table — positions are only a sketch';
  L.hooks.onEdit = () => { compute(); refresh(); };
  L.hooks.onDataset = () => { S.matrix = null; metricSeg.el.classList.remove('disabled'); };
  L.hooks.onLecture = (lec) => {
    S.matrix = lec.matrix || null;
    if (lec.matrix) {
      const xy = mds2(lec.matrix);
      L.setPoints(xy.map((p, i) => ({ ...p, name: lec.names[i] })));
      L.space.fit(L.points, { box: 0.7 });
      L.axes.setVisible(false);
    }
    metricSeg.el.classList.toggle('disabled', !!lec.matrix);
    setLinkage(lec.settings.linkage, true);
    if (lec.settings.metric) setMetric(lec.settings.metric, true);
    S.K = 2;
    kSlider.set(2);
  };

  function setLinkage(v, silent) {
    if (v === 'centroid' && S.matrix) { L.toast('Centroid linkage needs coordinates — this example is a table'); linkSeg.set(S.linkage); return; }
    S.linkage = v;
    linkSeg.set(v);
    linkHint.innerHTML = LINKAGE_INFO[v];
    if (!silent) { compute(); refresh(); }
  }
  function setMetric(v, silent) {
    if (S.matrix) { metricSeg.set(S.metric); return; }
    S.metric = v;
    metricSeg.set(v);
    L.regions.setMetric(v);
    if (!silent) { compute(); refresh(); }
  }

  /* ---------------- controls ---------------- */
  const linkHint = h('span', { class: 'hint', html: LINKAGE_INFO[S.linkage] });
  const linkSeg = segmented({
    label: 'Linkage', wrap: true,
    options: [{ value: 'single', label: 'Single' }, { value: 'complete', label: 'Complete' }, { value: 'average', label: 'Average' }, { value: 'centroid', label: 'Centroid' }],
    value: S.linkage, onChange: (v) => setLinkage(v),
  });
  const metricSeg = segmented({
    label: 'Distance',
    options: [{ value: 'euclidean', label: 'Euclidean' }, { value: 'manhattan', label: 'Manhattan' }],
    value: S.metric, onChange: (v) => setMetric(v),
  });
  const kSlider = slider({
    label: 'Cut into K clusters', min: 1, max: 10, step: 1, value: S.K,
    onInput: (v) => { S.K = Math.min(v, Math.max(n(), 1)); refresh(); },
    hint: 'Used once all merges are done. You can also drag the cut line on the dendrogram.',
  });
  const tLines = toggle({ label: 'Merge lines', emoji: '', value: true, onChange: (v) => (S.show.lines = v) });
  const tCents = toggle({ label: 'Cluster centres', emoji: '', value: true, onChange: (v) => (S.show.centroids = v) });
  L.addControls(
    section([L.num(3), 'Hierarchical settings'], linkSeg.el, linkHint, metricSeg.el, kSlider.el,
      button('Finish all merges', finish, { variant: 'btn-block' })),
    section([L.num(4), 'Show'], tLines.el, tCents.el),
  );

  /* ---------------- dendrogram ---------------- */
  const dendro = h('canvas', { class: 'dendro' });
  const dendroNote = h('div', { class: 'chart-note' });
  const stats = statTiles([['clusters', 'Clusters'], ['merge', 'Last merge'], ['steps', 'Merges']]);
  const numbers = h('div', { class: 'card side-card' },
    h('h3', {}, 'Dendrogram'),
    stats.el,
    dendro,
    dendroNote,
  );
  L.mountSide(numbers);

  let dendroGeom = null;
  function drawDendro() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = dendro.clientWidth || 320, H = 230;
    if (dendro.width !== Math.round(W * dpr)) { dendro.width = Math.round(W * dpr); dendro.height = Math.round(H * dpr); }
    dendro.style.height = H + 'px';
    const ctx = dendro.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const N = n();
    ctx.font = '600 11px JetBrains Mono Variable, monospace';
    if (!S.res || N < 2) {
      ctx.fillStyle = '#8A7C6E'; ctx.textAlign = 'center';
      ctx.fillText('Add at least 2 points', W / 2, H / 2);
      dendroGeom = null;
      return;
    }
    const merges = S.res.merges;
    const maxH = Math.max(...merges.map((m) => m.height), 1e-9) * 1.08;
    const showLeafNames = N <= 24;
    const pad = { l: 38, r: 8, t: 10, b: showLeafNames ? 26 : 12 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const yOf = (v) => pad.t + ph - (v / maxH) * ph;
    const xLeaf = new Map(S.order.map((leaf, i) => [leaf, pad.l + ((i + 0.5) * pw) / N]));
    const node = new Map();
    for (let i = 0; i < N; i++) node.set(i, { x: xLeaf.get(i), hgt: 0 });

    // y ticks
    ctx.strokeStyle = '#DDD3C4'; ctx.fillStyle = '#8A7C6E'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const v = (maxH * i) / 3, y = yOf(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillText(fmt(v, maxH > 10 ? 1 : 2), pad.l - 5, y);
    }

    const shown = S.phase === 'done' ? merges.length : S.m;
    const cutM = mUse();
    const lab = labelsAfter(N, merges, cutM);
    ctx.lineCap = 'round';
    for (let k = 0; k < merges.length; k++) {
      const mg = merges[k];
      const A = node.get(mg.a), B = node.get(mg.b);
      const nd = { x: (A.x + B.x) / 2, hgt: mg.height };
      node.set(mg.id, nd);
      if (k >= shown) continue;
      const below = k < cutM;
      const root = lab[mg.members[0]];
      const c = below ? COLORS[S.colorOf.get(root) ?? 0] : null;
      ctx.strokeStyle = below ? '#' + c.getHexString() : '#CFC3B1';
      ctx.lineWidth = k === S.m - 1 && S.phase !== 'done' ? 3.2 : 2;
      const yM = yOf(mg.height);
      ctx.beginPath();
      ctx.moveTo(A.x, yOf(A.hgt)); ctx.lineTo(A.x, yM); ctx.lineTo(B.x, yM); ctx.lineTo(B.x, yOf(B.hgt));
      ctx.stroke();
      if (N <= 12) {
        ctx.fillStyle = '#5A4E43'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(fmt(mg.height), nd.x, yM - 2);
      }
    }
    // leaves
    S.order.forEach((leaf) => {
      const x = xLeaf.get(leaf);
      const root = lab[leaf];
      const c = S.colorOf.get(root);
      ctx.beginPath(); ctx.arc(x, yOf(0), 3, 0, Math.PI * 2);
      ctx.fillStyle = c != null && cutM > 0 && root >= N ? '#' + COLORS[c].getHexString() : '#ADA092';
      ctx.fill();
      if (showLeafNames) {
        ctx.fillStyle = '#3A3029'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.font = '700 10.5px JetBrains Mono Variable, monospace';
        ctx.fillText(nameOf(leaf), x, yOf(0) + 6);
        ctx.font = '600 11px JetBrains Mono Variable, monospace';
      }
    });
    // cut line
    let cutY = null;
    if (S.phase === 'done' && S.K > 1 && S.K <= N) {
      const lo = merges[N - S.K - 1]?.height ?? 0, hi = merges[N - S.K]?.height ?? maxH;
      const hc = (lo + hi) / 2;
      cutY = yOf(hc);
      ctx.setLineDash([6, 5]); ctx.strokeStyle = '#3A3029'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(pad.l, cutY); ctx.lineTo(W - pad.r, cutY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#3A3029'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.font = '800 11px JetBrains Mono Variable, monospace';
      ctx.fillText(`K = ${S.K}`, W - pad.r - 2, cutY - 3);
    }
    ctx.strokeStyle = '#3A3029'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pad.l, yOf(0)); ctx.lineTo(W - pad.r, yOf(0)); ctx.stroke();
    dendroGeom = { yOf, maxH, pad, ph, cutY };
  }

  // drag the cut line
  let cutDrag = false;
  const cutFromY = (y) => {
    if (!dendroGeom || S.phase !== 'done') return;
    const { pad, ph, maxH } = dendroGeom;
    const hgt = ((pad.t + ph - y) / ph) * maxH;
    const kept = S.res.merges.filter((m) => m.height <= hgt).length;
    const K = Math.max(1, n() - kept);
    if (K !== S.K) { S.K = K; kSlider.set(Math.min(K, 10)); refresh(); }
  };
  dendro.addEventListener('pointerdown', (e) => {
    if (S.phase !== 'done') { L.toast('Finish the merges first, then cut '); return; }
    cutDrag = true; dendro.setPointerCapture(e.pointerId);
    cutFromY(e.clientY - dendro.getBoundingClientRect().top);
  });
  dendro.addEventListener('pointermove', (e) => {
    const y = e.clientY - dendro.getBoundingClientRect().top;
    if (cutDrag) cutFromY(y);
    dendro.style.cursor = S.phase === 'done' ? 'ns-resize' : 'default';
  });
  dendro.addEventListener('pointerup', () => { cutDrag = false; });
  new ResizeObserver(() => drawDendro()).observe(dendro);

  /* ---------------- per-frame rendering ---------------- */
  const segList = [];
  const circleList = [];
  L.hooks.frame = (dt) => {
    if (S.anim < 1) S.anim = Math.min(1, S.anim + dt * 2.6 * Math.max(L.player.speed, 0.5));
    const N = n();
    if (!S.res || S.res.n !== N) { for (const p of L.points) p.tc = GREY; L.segs.sync([]); L.circles.sync([]); return; }
    const merges = S.res.merges;
    const cutM = mUse();
    const lab = labelsAfter(N, merges, cutM);
    const size = new Map();
    for (const r of lab) size.set(r, (size.get(r) || 0) + 1);
    L.points.forEach((p, i) => {
      const r = lab[i];
      p.tc = size.get(r) > 1 ? COLORS[S.colorOf.get(r) ?? 0] : GREY;
    });

    segList.length = 0;
    const shown = S.phase === 'done' ? merges.length : S.m;
    if (S.show.lines) {
      for (let k = 0; k < shown; k++) {
        const mg = merges[k];
        let a, b;
        if (S.linkage === 'single' || S.matrix) {
          a = L.points[mg.pair[0]]; b = L.points[mg.pair[1]];
          a = { x: a.wx, y: a.wy }; b = { x: b.wx, y: b.wy };
        } else {
          a = L.space.w(mg.centroidA); b = L.space.w(mg.centroidB);
        }
        const isLast = k === S.m - 1 && S.phase !== 'done';
        const t = isLast ? S.anim : 1;
        const below = k < cutM;
        const c = below ? COLORS[S.colorOf.get(lab[mg.members[0]]) ?? 0] : FAINT;
        segList.push({ x1: a.x, y1: a.y, x2: a.x + (b.x - a.x) * t, y2: a.y + (b.y - a.y) * t, w: isLast ? 0.012 : 0.007, col: c });
      }
    }
    L.segs.sync(segList);

    circleList.length = 0;
    if (S.show.centroids && S.linkage === 'centroid' && !S.matrix) {
      // centre of every current multi-point cluster
      const seen = new Set();
      for (let k = cutM - 1; k >= 0; k--) {
        const mg = merges[k];
        const r = lab[mg.members[0]];
        if (r !== mg.id || seen.has(r)) continue;
        seen.add(r);
        const w = L.space.w(mg.centroid);
        circleList.push({ x: w.x, y: w.y, r: 0.022, col: INK_C, fill: 0, ring: 0.9 });
        circleList.push({ x: w.x, y: w.y, r: 0.012, col: COLORS[S.colorOf.get(r) ?? 0], fill: 1, ring: 0 });
      }
    }
    L.circles.sync(circleList);
  };

  L.hooks.labels = () => {
    if (!S.res || !(S.linkage === 'centroid') || S.matrix || n() > 12 || !S.show.centroids) return null;
    const merges = S.res.merges, cutM = mUse();
    const lab = labelsAfter(n(), merges, cutM);
    const out = [];
    for (let k = 0; k < cutM; k++) {
      const mg = merges[k];
      if (lab[mg.members[0]] !== mg.id) continue;
      const w = L.space.w(mg.centroid);
      out.push({ x: w.x, y: w.y, text: `${clusterName(mg.members)} ${pt(mg.centroid)}`, cls: 'cent', dx: 10, dy: 6 });
    }
    return out;
  };

  /* ---------------- narration + numbers + worked ---------------- */
  function refresh() {
    const N = n();
    const merges = S.res?.merges || [];
    let nar;
    let active = 'ready';
    if (N < 2) {
      nar = { emoji: '', title: 'Give me some points!', text: 'Pick a dataset, a lecture example, or click on the canvas.' };
    } else if (S.phase === 'ready') {
      nar = { emoji: '', title: `${N} points, ${N} clusters`, text: `Every point starts alone. Each <b>Step</b> merges the two closest clusters using <b>${S.linkage}</b> linkage${S.matrix ? '' : ` and <b>${S.metric}</b> distance`}.` };
    } else if (S.phase === 'merge') {
      const mg = merges[S.m - 1];
      active = 'merge';
      nar = { emoji: '', title: `Merge ${S.m}: ${clusterName(mg.members.slice(0, mg.sizeA))} + ${clusterName(mg.members.slice(mg.sizeA))}`, text: `They were the closest pair at distance <b>${fmt(mg.height)}</b>. Now ${N - S.m} clusters are left, and distances to the new cluster get updated.` };
    } else {
      active = 'done';
      nar = { emoji: '', title: `One big tree after ${merges.length} merges`, text: `Drag the <b>cut line</b> on the dendrogram or use K to choose how many clusters you want. Right now: <b>K = ${S.K}</b>.` };
    }
    L.narrate(nar, active);

    stats.set('clusters', N ? (S.phase === 'done' ? S.K : N - S.m) : '–');
    stats.set('merge', S.m && merges[S.m - 1] ? fmt(merges[S.m - 1].height) : '–');
    stats.set('steps', N ? `${S.phase === 'done' ? merges.length : S.m}/${Math.max(N - 1, 0)}` : '–');
    dendroNote.innerHTML = S.phase === 'done'
      ? 'Bar height = distance at which two clusters joined. <b>Drag the dashed line</b> to cut the tree.'
      : 'The tree grows as clusters merge. Long vertical lines mean very different groups were joined.';
    drawDendro();
    renderWorked();
  }

  function renderWorked() {
    const N = n();
    const showIt = (L.lecture || (N >= 2 && N <= 12)) && S.res && S.res.merges.length && S.res.merges[0].table;
    L.worked.show(!!showIt);
    if (!showIt) return;
    const merges = S.res.merges;
    const parts = [];
    const nm = (id) => {
      if (id < N) return nameOf(id);
      return clusterName(merges[id - N].members);
    };

    if (S.m > 0) {
      const mg = merges[S.m - 1];
      const A = nm(mg.a), B = nm(mg.b), C = nm(mg.id);
      parts.push(step(`Merge ${S.m}: ${A} + ${B} → ${C}`));
      parts.push(para(`Closest pair at distance <b>${fmt(mg.height)}</b>.`));
      if (S.linkage === 'centroid' && mg.centroid) {
        const ca = mg.centroidA, cb = mg.centroidB;
        if (mg.sizeA === 1 && mg.sizeB === 1) {
          parts.push(para(katexHtml(`Centroid of ${C}: $\\left(\\frac{${fmt(ca.x)}+${fmt(cb.x)}}{2}, \\frac{${fmt(ca.y)}+${fmt(cb.y)}}{2}\\right) = ${pt(mg.centroid, 3)}$`)));
        } else {
          parts.push(para(katexHtml(`Centroid of ${C} (mean of all ${mg.size} points): $\\left(\\frac{${mg.sizeA}\\cdot${fmt(ca.x, 3)}+${mg.sizeB}\\cdot${fmt(cb.x, 3)}}{${mg.size}}, \\frac{${mg.sizeA}\\cdot${fmt(ca.y, 3)}+${mg.sizeB}\\cdot${fmt(cb.y, 3)}}{${mg.size}}\\right) = ${pt(mg.centroid, 3)}$`)));
          if (mg.sizeA !== mg.sizeB && L.lecture?.id === 'lec-h1') {
            const med = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 };
            parts.push(note(`<b>Slide note:</b> the slides average the two centroids and get ${pt(med, 3)}. That’s <i>median</i> linkage. The true centroid of all ${mg.size} points is ${pt(mg.centroid, 3)}. The merge order and heights are the same either way.`, 'warn'));
          }
        }
      }
      if (mg.rows.length) {
        const lines = mg.rows.map((r) => {
          const other = nm(r.id);
          if (S.linkage === 'single') return `d(${C}, ${other}) = min(${fmt(r.da)}, ${fmt(r.db)}) = <b>${fmt(r.d)}</b>`;
          if (S.linkage === 'complete') return `d(${C}, ${other}) = max(${fmt(r.da)}, ${fmt(r.db)}) = <b>${fmt(r.d)}</b>`;
          if (S.linkage === 'average') return `d(${C}, ${other}) = (${mg.sizeA}·${fmt(r.da)} + ${mg.sizeB}·${fmt(r.db)}) / ${mg.size} = <b>${fmt(r.d)}</b>`;
          const o = otherCentroid(r.id);
          const c = mg.centroid;
          if (S.metric === 'manhattan') return `d(${C}, ${other}) = |${fmt(c.x, 3)} − ${fmt(o.x, 3)}| + |${fmt(c.y, 3)} − ${fmt(o.y, 3)}| = <b>${fmt(r.d)}</b>`;
          return `d(${C}, ${other}) = √((${fmt(c.x, 3)} − ${fmt(o.x, 3)})² + (${fmt(c.y, 3)} − ${fmt(o.y, 3)})²) = <b>${fmt(r.d)}</b>`;
        });
        parts.push(h('div', { class: 'w-lines', html: lines.join('<br>') }));
      }
    }

    if (S.m < merges.length && S.phase !== 'done') {
      const tb = merges[S.m].table;
      const names = tb.ids.map(nm);
      const [pi, pj] = tb.pick;
      parts.push(step(S.m === 0 ? 'Initial distance table' : `Distance table now (${names.length} clusters)`));
      parts.push(table(['', ...names], tb.D.map((row, i) => [
        { v: names[i], cls: 'rh' },
        ...row.map((d, j) => ({ v: i === j ? '0' : fmt(d), cls: (i === pi && j === pj) || (i === pj && j === pi) ? 'hl' : i === j ? 'diag' : '' })),
      ])));
      parts.push(para(`Smallest distance: <b>${fmt(tb.D[pi][pj])}</b> between <b>${names[pi]}</b> and <b>${names[pj]}</b> → merge them next.`));
    }

    if (S.phase === 'done') {
      const hs = merges.map((m) => m.height);
      parts.push(step('Merge heights (dendrogram)'));
      parts.push(para(hs.map((x) => fmt(x)).join(' → ')));
      let gi = 0, gap = -1;
      for (let i = 0; i < hs.length - 1; i++) if (hs[i + 1] - hs[i] > gap) { gap = hs[i + 1] - hs[i]; gi = i; }
      if (hs.length > 1) parts.push(para(`Biggest jump: ${fmt(hs[gi])} → ${fmt(hs[gi + 1])}. Cutting inside that gap gives <b>K = ${N - gi - 1}</b> clusters.`));
    }
    L.worked.set(parts, `${S.linkage} · ${S.matrix ? 'table' : S.metric}`);
  }

  function otherCentroid(id) {
    const N = n();
    if (id < N) return L.points[id];
    return S.res.merges[id - N].centroid;
  }

  /* ---------------- challenges ---------------- */
  const loadWith = (ds, linkage, K, fin = false) => {
    L.loadDataset(ds);
    setLinkage(linkage);
    S.K = K; kSlider.set(K);
    if (fin) finish();
    L.focusStage();
  };
  const actions = {
    lec1: () => { L.loadLecture(LECTURES[0]); L.focusStage(); },
    moonsSingle: () => loadWith({ id: 'moons', label: 'Moons', make: (k) => moons(k, 0.035), note: 'Two curved moons.' }, 'single', 2, true),
    moonsComplete: () => loadWith({ id: 'moons', label: 'Moons', make: (k) => moons(k, 0.035), note: 'Two curved moons.' }, 'complete', 2, true),
    bridge: () => loadWith(BRIDGE, 'single', 2, true),
    blobs: () => loadWith({ id: 'blobs', label: 'Blobs', make: (k) => blobs(k, 3), note: 'Three blobs.' }, 'average', 3),
  };

  L.loadDataset('blobs');
  return () => L.dispose();
}
