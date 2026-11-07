// Draws a decision tree (from TreeBuilder or any { nodes } with the same shape) into a 2D canvas.
import { css, PALETTE } from './theme.js';
import { fmt } from './worked.js';

const INK = '#3A3029', MUTED = '#8A7C6E', BASE = '#EDE6DB', HI = '#FFFDF8', LO = '#C9BCA8';

export class TreeView {
  constructor({ height = 240, featureNames = ['x', 'y'], valueText = null, classColor = (k) => css(PALETTE[k % PALETTE.length]), onClick = null } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tree-canvas';
    this.height = height;
    this.featureNames = featureNames;
    this.valueText = valueText;
    this.classColor = classColor;
    this.tree = null;
    this.highlight = -1;
    this.pathTo = new Set();
    this.onClick = onClick;
    this.hits = [];
    this._ro = new ResizeObserver(() => this.draw());
    this._ro.observe(this.canvas);
    this.canvas.addEventListener('click', (e) => {
      if (!this.onClick) return;
      const r = this.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const hit = this.hits.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      if (hit) this.onClick(hit.id);
    });
  }

  set(tree, { highlight = -1, task = 'cls' } = {}) {
    this.tree = tree; this.highlight = highlight; this.task = task;
    this.draw();
  }

  draw() {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = c.clientWidth || 320;
    const t = this.tree;
    const nodes = t?.nodes || [];
    const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
    const H = Math.max(this.height, Math.min(520, 70 + maxDepth * 62));
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    c.style.height = H + 'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this.hits = [];
    if (!nodes.length) {
      ctx.fillStyle = MUTED; ctx.font = '500 12px Inter Variable, system-ui'; ctx.textAlign = 'center';
      ctx.fillText('The tree appears here', W / 2, H / 2);
      return;
    }
    // layout: leaves get equal slots in order, parents sit above the middle of their children
    const pos = new Map();
    let slot = 0;
    const visit = (id) => {
      const n = nodes[id];
      if (n.leaf || n.left == null) { pos.set(id, slot++); return pos.get(id); }
      const a = visit(n.left), b = visit(n.right);
      pos.set(id, (a + b) / 2);
      return pos.get(id);
    };
    visit(0);
    const nSlots = Math.max(slot, 1);
    const padX = 8, top = 16;
    const rowH = maxDepth ? Math.min(66, (H - top - 40) / maxDepth) : 0;
    const slotW = (W - padX * 2) / nSlots;
    const bw = Math.max(26, Math.min(86, slotW - 6));
    const bh = 30;
    const xy = (id) => ({ x: padX + (pos.get(id) + 0.5) * slotW, y: top + nodes[id].depth * rowH });
    // path highlight
    const onPath = new Set();
    if (this.highlight >= 0 && nodes[this.highlight]) { let k = this.highlight; while (k >= 0) { onPath.add(k); k = nodes[k].parent; } }

    // edges
    for (const n of nodes) {
      if (n.leaf || n.left == null) continue;
      const p = xy(n.id);
      for (const [ch, lab] of [[n.left, 'yes'], [n.right, 'no']]) {
        const q = xy(ch);
        ctx.strokeStyle = onPath.has(ch) ? INK : LO;
        ctx.lineWidth = onPath.has(ch) ? 2 : 1.4;
        ctx.beginPath(); ctx.moveTo(p.x, p.y + bh); ctx.bezierCurveTo(p.x, p.y + bh + rowH * 0.35, q.x, q.y - rowH * 0.35, q.x, q.y); ctx.stroke();
        if (slotW > 30) {
          ctx.fillStyle = MUTED; ctx.font = '500 9.5px JetBrains Mono Variable, monospace'; ctx.textAlign = 'center';
          ctx.fillText(lab, (p.x + q.x) / 2 + (lab === 'yes' ? -6 : 6), (p.y + bh + q.y) / 2);
        }
      }
    }
    // boxes
    for (const n of nodes) {
      const { x, y } = xy(n.id);
      const bx = x - bw / 2, by = y;
      const isLeaf = n.leaf || n.left == null;
      // neumorphic box
      ctx.save();
      ctx.shadowColor = LO; ctx.shadowBlur = 6; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
      roundRect(ctx, bx, by, bw, bh, 8);
      ctx.fillStyle = BASE; ctx.fill();
      ctx.restore();
      roundRect(ctx, bx, by, bw, bh, 8);
      ctx.lineWidth = n.id === this.highlight ? 2.4 : 1;
      ctx.strokeStyle = n.id === this.highlight ? INK : HI;
      ctx.stroke();
      // fill strip showing class mix / value
      if (isLeaf && Array.isArray(n.value)) {
        let off = 0;
        n.value.forEach((p, k) => {
          ctx.fillStyle = this.classColor(k);
          ctx.fillRect(bx + 4 + off, by + bh - 7, (bw - 8) * p, 4);
          off += (bw - 8) * p;
        });
      }
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${bw < 50 ? 9 : 10.5}px JetBrains Mono Variable, monospace`;
      let label;
      if (!isLeaf) label = `${this.featureNames[n.feature] ?? 'x' + n.feature} < ${fmt(n.thr, 2)}`;
      else if (this.valueText) label = this.valueText(n);
      else if (Array.isArray(n.value)) { const k = n.value.indexOf(Math.max(...n.value)); label = `n=${n.idx.length}`; ctx.fillStyle = this.classColor(k); }
      else label = fmt(n.value, 2);
      ctx.fillText(fitText(ctx, label, bw - 6), x, by + (isLeaf && Array.isArray(n.value) ? bh / 2 - 2 : bh / 2));
      this.hits.push({ id: n.id, x: bx, y: by, w: bw, h: bh });
    }
  }

  dispose() { this._ro.disconnect(); }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
function fitText(ctx, s, max) {
  if (ctx.measureText(s).width <= max) return s;
  while (s.length > 2 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}
