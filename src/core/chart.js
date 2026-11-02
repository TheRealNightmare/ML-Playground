// A small, dependency-free canvas chart for live metrics (line or bars).

const INK = '#111827';
const MUTED = '#6B7280';
const GRID = '#E5E7EB';

function niceNum(v) {
  if (!isFinite(v) || v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1000) return (v / 1000).toFixed(1) + 'k';
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

export class MiniChart {
  constructor({ height = 150, xLabel = '', yLabel = '', empty = 'No data yet' } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'mini-chart';
    this.canvas.style.height = height + 'px';
    this.height = height;
    this.xLabel = xLabel;
    this.yLabel = yLabel;
    this.emptyText = empty;
    this.mode = 'line';
    this.data = [];
    this.bars = [];
    this.onBarClick = null;
    this._barRects = [];
    this.canvas.addEventListener('click', (e) => this._click(e));
    this.canvas.addEventListener('mousemove', (e) => this._hover(e));
    this._ro = new ResizeObserver(() => this.draw());
    this._ro.observe(this.canvas);
  }

  /** points: [{ y, color }] — x is the index */
  setLine(points, { xLabel, yLabel, empty, ref = null, noArea = false, dots = true } = {}) {
    this.mode = 'line';
    this.data = points;
    this.ref = ref;
    this.noArea = noArea;
    this.dots = dots;
    if (xLabel != null) this.xLabel = xLabel;
    if (yLabel != null) this.yLabel = yLabel;
    if (empty != null) this.emptyText = empty;
    this.draw();
  }

  /** bars: [{ label, value, color, highlight }] */
  setBars(bars, { xLabel, yLabel, empty, ref = null } = {}) {
    this.mode = 'bars';
    this.ref = ref;
    this.bars = bars;
    if (xLabel != null) this.xLabel = xLabel;
    if (yLabel != null) this.yLabel = yLabel;
    if (empty != null) this.emptyText = empty;
    this.draw();
  }

  _ctx() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || 300;
    const h = this.height;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  draw() {
    const { ctx, w, h } = this._ctx();
    const pad = { l: 40, r: 10, t: 10, b: 34 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    ctx.font = '600 11px JetBrains Mono Variable, monospace';

    const values = this.mode === 'line' ? this.data.map((d) => d.y) : this.bars.map((b) => b.value);
    if (!values.length) {
      ctx.fillStyle = MUTED;
      ctx.textAlign = 'center';
      ctx.fillText(this.emptyText, w / 2, h / 2);
      return;
    }
    let maxY = Math.max(...values, this.ref && this.ref.y < Math.max(...values) * 3 ? this.ref.y : 0) * 1.08;
    if (!(maxY > 0)) maxY = 1;
    const minY = 0;

    // grid + y ticks
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 3; i++) {
      const v = minY + ((maxY - minY) * i) / 3;
      const y = pad.t + ph - (ph * i) / 3;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke();
      ctx.fillText(niceNum(v), pad.l - 6, y);
    }
    // axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(this.xLabel, pad.l + pw / 2, h - 4);

    const yOf = (v) => pad.t + ph - ((v - minY) / (maxY - minY)) * ph;

    if (this.mode === 'line') {
      const n = this.data.length;
      const xOf = (i) => pad.l + (n === 1 ? pw / 2 : (pw * i) / (n - 1));
      // area
      ctx.beginPath();
      this.data.forEach((d, i) => (i ? ctx.lineTo(xOf(i), yOf(d.y)) : ctx.moveTo(xOf(i), yOf(d.y))));
      ctx.lineTo(xOf(n - 1), yOf(0)); ctx.lineTo(xOf(0), yOf(0)); ctx.closePath();
      ctx.fillStyle = 'rgba(37,99,235,0.08)';
      if (!this.noArea) ctx.fill();
      // line
      ctx.beginPath();
      this.data.forEach((d, i) => (i ? ctx.lineTo(xOf(i), yOf(d.y)) : ctx.moveTo(xOf(i), yOf(d.y))));
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.stroke();
      // dots
      const r = n > 40 ? 2.5 : 4;
      if (this.dots !== false) this.data.forEach((d, i) => {
        ctx.beginPath(); ctx.arc(xOf(i), yOf(d.y), r, 0, Math.PI * 2);
        ctx.fillStyle = d.color || INK; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
      });
      // x ticks (first / last)
      ctx.fillStyle = MUTED;
      ctx.textAlign = 'left'; ctx.fillText('1', xOf(0) - 2, pad.t + ph + 13);
      if (n > 1) { ctx.textAlign = 'right'; ctx.fillText(String(n), xOf(n - 1) + 2, pad.t + ph + 13); }
    } else {
      const n = this.bars.length;
      const slot = pw / n;
      const bw = Math.max(6, slot * 0.62);
      this._barRects = [];
      this.bars.forEach((b, i) => {
        const x = pad.l + slot * i + (slot - bw) / 2;
        const y = yOf(b.value);
        const bh = pad.t + ph - y;
        ctx.beginPath();
        const rr = Math.min(6, bw / 2);
        ctx.roundRect ? ctx.roundRect(x, y, bw, Math.max(bh, 1), [rr, rr, 0, 0]) : ctx.rect(x, y, bw, bh);
        ctx.fillStyle = b.color || '#E5E7EB';
        ctx.fill();
        ctx.lineWidth = b.highlight ? 2.5 : 1.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.fillStyle = b.highlight ? INK : MUTED;
        ctx.font = (b.highlight ? '800 ' : '600 ') + '11px JetBrains Mono Variable, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, x + bw / 2, pad.t + ph + 13);
        this._barRects.push({ x: pad.l + slot * i, w: slot, i });
      });
    }
    if (this.ref && this.mode === 'line' || this.ref && this.mode === 'bars') {
      const y = yOf(this.ref.y);
      ctx.setLineDash([5, 4]); ctx.strokeStyle = this.ref.color || '#F97316'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = this.ref.color || '#F97316'; ctx.font = '800 11px JetBrains Mono Variable, monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(this.ref.label || '', pad.l + 4, y - 3);
      ctx.font = '600 11px JetBrains Mono Variable, monospace'; ctx.textBaseline = 'alphabetic';
    }
    // baseline
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t + ph); ctx.lineTo(pad.l + pw, pad.t + ph); ctx.stroke();
  }

  _hit(e) {
    if (this.mode !== 'bars' || !this.onBarClick) return null;
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    return this._barRects.find((b) => x >= b.x && x <= b.x + b.w) || null;
  }
  _click(e) { const b = this._hit(e); if (b) this.onBarClick(b.i); }
  _hover(e) { this.canvas.style.cursor = this._hit(e) ? 'pointer' : 'default'; }

  dispose() { this._ro.disconnect(); }
}
