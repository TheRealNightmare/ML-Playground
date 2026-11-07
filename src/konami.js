// ↑ ↑ ↓ ↓ ← → ← → B A — a few hundred points fly in and cluster themselves into the letters "ML".

const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const COLORS = ['#3D8B8B', '#E07A5F', '#6B8E5A', '#B5523B', '#8A5A83', '#D4A24C', '#C46A8A'];
const LINES = ['+30 XP · gradient descended', 'achievement unlocked: unsupervised fun', 'loss → 0 · vibes → ∞', 'converged in 1 iteration (cheating)'];

export function installKonami() {
  let pos = 0;
  let running = false;
  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = k === CODE[pos] ? pos + 1 : k === CODE[0] ? 1 : 0;
    if (pos === CODE.length) { pos = 0; if (!running) { running = true; play().then(() => { running = false; }); } }
  });
}

function targets(w, h, count) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const size = Math.min(w * 0.36, h * 0.55);
  ctx.font = `600 ${size}px "Source Serif 4 Variable", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ML', w / 2, h / 2);
  const data = ctx.getImageData(0, 0, w, h).data;
  const pts = [];
  const step = Math.max(4, Math.round(size / 26));
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] > 128) pts.push({ x, y });
  for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  return pts.slice(0, count);
}

function play() {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'konami';
    const canvas = document.createElement('canvas');
    wrap.append(canvas);
    const msg = document.createElement('div');
    msg.className = 'konami-msg';
    msg.textContent = LINES[Math.floor(Math.random() * LINES.length)];
    document.body.append(wrap);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const T = targets(W, H, 520);
    const P = T.map((t, i) => ({
      x: Math.random() * W, y: Math.random() < 0.5 ? -20 : H + 20,
      tx: t.x, ty: t.y, delay: Math.random() * 0.5,
      c: COLORS[Math.floor((t.x / W) * COLORS.length * 1.6 + (t.y / H) * 2) % COLORS.length],
      r: 3 + Math.random() * 2.5,
    }));
    const t0 = performance.now();
    let shown = false;
    const frame = (now) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      const fade = t > 3.2 ? Math.max(0, 1 - (t - 3.2) / 0.6) : 1;
      ctx.fillStyle = `rgba(237, 230, 219, ${0.82 * Math.min(1, t * 3) * fade})`;
      ctx.fillRect(0, 0, W, H);
      for (const p of P) {
        const k = t < p.delay ? 0 : 1 - Math.exp(-(t - p.delay) * 4.2);
        const x = p.x + (p.tx - p.x) * k, y = p.y + (p.ty - p.y) * k;
        ctx.globalAlpha = fade;
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = '#3A3029'; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (!shown && t > 1) { document.body.append(msg); shown = true; }
      if (t < 3.8) requestAnimationFrame(frame);
      else { wrap.remove(); msg.remove(); resolve(); }
    };
    requestAnimationFrame(frame);
  });
}
