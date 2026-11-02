// HTML overlays drawn on top of the three.js canvas: point name tags and axes in data units.

const toScreen = (stage, w) => {
  const v = stage.view;
  return { x: ((w.x + v.halfW) / (2 * v.halfW)) * v.w, y: ((v.halfH - w.y) / (2 * v.halfH)) * v.h };
};

/** Small floating tags ("A", "P3", "C1 (3, 5)") pinned to world positions. */
export class LabelOverlay {
  constructor(stage, parent) {
    this.stage = stage;
    this.el = document.createElement('div');
    this.el.className = 'label-layer';
    parent.append(this.el);
    this.pool = [];
  }

  /** items: [{ x, y (world), text, cls?, dx?, dy? }] */
  update(items) {
    while (this.pool.length < items.length) {
      const d = document.createElement('div');
      d.className = 'pt-label';
      this.el.append(d);
      this.pool.push({ el: d, text: '', cls: '' });
    }
    this.pool.forEach((slot, i) => {
      const it = items[i];
      if (!it) { if (slot.el.style.display !== 'none') slot.el.style.display = 'none'; return; }
      slot.el.style.display = '';
      if (slot.text !== it.text) { slot.el.textContent = it.text; slot.text = it.text; }
      const cls = 'pt-label ' + (it.cls || '');
      if (slot.cls !== cls) { slot.el.className = cls; slot.cls = cls; }
      const s = toScreen(this.stage, it);
      slot.el.style.transform = `translate(${(s.x + (it.dx ?? 10)).toFixed(1)}px, ${(s.y + (it.dy ?? -22)).toFixed(1)}px)${it.anchor === 'right' ? ' translateX(-100%)' : ''}`;
    });
  }

  clear() { this.update([]); }
}

function niceStep(range, target = 8) {
  const raw = range / target;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/** Axis tick labels in data units along the bottom and left edges (lecture mode). */
export class AxesOverlay {
  constructor(stage, parent, space, regions) {
    this.stage = stage;
    this.space = space;
    this.regions = regions;
    this.el = document.createElement('div');
    this.el.className = 'axes-layer';
    parent.append(this.el);
    this.key = '';
    this.visible = false;
  }

  setVisible(v) {
    this.visible = v;
    this.el.style.display = v ? '' : 'none';
    this.el.closest('.lab-stage')?.classList.toggle('has-axes', v);
    if (!v) { this.regions?.setGrid(0.1, { x: 0, y: 0 }); this.key = ''; }
  }

  update() {
    if (!this.visible) return;
    const { stage, space } = this;
    const v = stage.view;
    const a = space.d({ x: -v.halfW, y: -v.halfH });
    const b = space.d({ x: v.halfW, y: v.halfH });
    const step = niceStep(Math.min(b.x - a.x, b.y - a.y));
    const key = [v.w, v.h, space.s, space.cx, space.cy, step].join('|');
    if (key === this.key) return;
    this.key = key;
    this.regions?.setGrid(space.wl(step), space.w({ x: 0, y: 0 }));
    const frag = document.createDocumentFragment();
    const fmt = (n) => (Math.abs(n) < 1e-9 ? '0' : +n.toFixed(6) + '');
    for (let x = Math.ceil(a.x / step) * step; x <= b.x; x += step) {
      const s = toScreen(stage, space.w({ x, y: 0 }));
      if (s.x < 24 || s.x > v.w - 12) continue;
      const t = document.createElement('span');
      t.className = 'ax-tick ax-x';
      t.textContent = fmt(x);
      t.style.left = s.x + 'px';
      frag.append(t);
    }
    for (let y = Math.ceil(a.y / step) * step; y <= b.y; y += step) {
      const s = toScreen(stage, space.w({ x: 0, y }));
      if (s.y < 10 || s.y > v.h - 20) continue;
      const t = document.createElement('span');
      t.className = 'ax-tick ax-y';
      t.textContent = fmt(y);
      t.style.top = s.y + 'px';
      frag.append(t);
    }
    this.el.replaceChildren(frag);
  }
}

export { toScreen };
