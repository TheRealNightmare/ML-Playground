// A grid of tiny canvases, one per model (trees in a forest, boosting rounds...).
// Each item supplies its own draw(ctx, w, h). Clicking a thumbnail selects it.
import { h } from './ui.js';
import { css, PALETTE } from './theme.js';

export class ModelThumbs {
  constructor({ onSelect = null, max = 60 } = {}) {
    this.el = h('div', { class: 'thumbs' });
    this.onSelect = onSelect;
    this.max = max;
    this.sel = -1;
    this.items = [];
    this.pool = [];
  }

  set(items, sel = this.sel) {
    this.items = items.slice(0, this.max);
    this.sel = sel;
    while (this.pool.length < this.items.length) {
      const i = this.pool.length;
      const cv = h('canvas', { width: 128, height: 96 });
      const cap = h('span', { class: 'thumb-cap' });
      const b = h('button', { type: 'button', class: 'thumb', onclick: () => this.onSelect?.(this.sel === i ? -1 : i) }, cv, cap);
      this.pool.push({ b, cv, cap, key: '' });
    }
    this.el.replaceChildren(...this.pool.slice(0, this.items.length).map((p) => p.b));
    this.items.forEach((it, i) => {
      const p = this.pool[i];
      p.b.classList.toggle('active', i === sel);
      p.cap.textContent = it.title;
      if (it.key !== undefined && it.key === p.key) return;
      p.key = it.key;
      const ctx = p.cv.getContext('2d');
      ctx.clearRect(0, 0, 128, 96);
      it.draw(ctx, 128, 96);
    });
  }
  select(i) { this.set(this.items, i); }
}

/** Paint a 2D classifier into a thumbnail. probs(xData) → class probabilities. */
export function paintCls(L, ctx, w, h, probs, { res = 32 } = {}) {
  const v = L.stage.view;
  const img = ctx.createImageData(res, Math.round((res * h) / w));
  const H = img.height;
  for (let j = 0; j < H; j++) for (let i = 0; i < res; i++) {
    const wx = -v.halfW + ((i + 0.5) / res) * 2 * v.halfW;
    const wy = v.halfH - ((j + 0.5) / H) * 2 * v.halfH;
    const d = L.space.d({ x: wx, y: wy });
    const pr = probs([d.x, d.y]);
    let r = 0, g = 0, b = 0;
    pr.forEach((p, k) => { const c = PALETTE[k % PALETTE.length]; r += ((c >> 16) & 255) * p; g += ((c >> 8) & 255) * p; b += (c & 255) * p; });
    const o = (j * res + i) * 4;
    img.data[o] = r * 0.55 + 237 * 0.45; img.data[o + 1] = g * 0.55 + 230 * 0.45; img.data[o + 2] = b * 0.55 + 219 * 0.45; img.data[o + 3] = 255;
  }
  const tmp = document.createElement('canvas');
  tmp.width = res; tmp.height = H;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, w, h);
  dots(L, ctx, w, h);
}

/** Draw a 1D model (regression or P(class 1)) as a curve over the points. */
export function paintCurve(L, ctx, w, h, fn, { color = '#E07A5F' } = {}) {
  ctx.fillStyle = '#EDE6DB'; ctx.fillRect(0, 0, w, h);
  dots(L, ctx, w, h);
  const v = L.stage.view;
  ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath();
  for (let i = 0; i <= w; i += 2) {
    const wx = -v.halfW + (i / w) * 2 * v.halfW;
    const dx = L.space.d({ x: wx, y: 0 }).x;
    const wy = L.space.w({ x: dx, y: fn(dx) }).y;
    const py = h / 2 - (wy / v.halfH) * (h / 2);
    if (i) ctx.lineTo(i, py); else ctx.moveTo(i, py);
  }
  ctx.stroke();
}

function dots(L, ctx, w, h) {
  const v = L.stage.view;
  for (const p of L.points) {
    const px = ((p.wx + v.halfW) / (2 * v.halfW)) * w, py = h / 2 - (p.wy / v.halfH) * (h / 2);
    ctx.fillStyle = L.task === 'reg' ? '#4F6D8A' : css(PALETTE[p.label % PALETTE.length]);
    ctx.globalAlpha = p.thumbAlpha ?? 1;
    ctx.beginPath(); ctx.arc(px, py, L.points.length > 80 ? 1.3 : 2.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
