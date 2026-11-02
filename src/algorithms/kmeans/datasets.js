// Preset datasets, all roughly inside the square [-1, 1]².

function gauss(rand = Math.random) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clip = (p) => ({ x: Math.max(-1.05, Math.min(1.05, p.x)), y: Math.max(-1.05, Math.min(1.05, p.y)) });

function blobCenters(k, minDist = 0.6, range = 0.7) {
  for (let tries = 0; tries < 200; tries++) {
    const cs = [];
    let guard = 0;
    while (cs.length < k && guard++ < 500) {
      const c = { x: (Math.random() * 2 - 1) * range, y: (Math.random() * 2 - 1) * range };
      if (cs.every((d) => Math.hypot(d.x - c.x, d.y - c.y) >= minDist)) cs.push(c);
    }
    if (cs.length === k) return cs;
    minDist *= 0.92;
  }
  return Array.from({ length: k }, () => ({ x: 0, y: 0 }));
}

export function blobs(n, k = 3 + Math.floor(Math.random() * 3) /* 3..5 */) {
  const cs = blobCenters(k, k > 3 ? 0.55 : 0.7);
  const sd = cs.map(() => 0.09 + Math.random() * 0.06);
  return Array.from({ length: n }, (_, i) => {
    const j = i % k;
    return clip({ x: cs[j].x + gauss() * sd[j], y: cs[j].y + gauss() * sd[j] });
  });
}

function uneven(n) {
  const big = { x: -0.35, y: 0.0, sd: 0.28, share: 0.7 };
  const small = [{ x: 0.52, y: 0.5, sd: 0.06 }, { x: 0.52, y: -0.5, sd: 0.06 }];
  return Array.from({ length: n }, (_, i) => {
    const r = i / n;
    if (r < big.share) return clip({ x: big.x + gauss() * big.sd, y: big.y + gauss() * big.sd });
    const s = small[i % 2];
    return clip({ x: s.x + gauss() * s.sd, y: s.y + gauss() * s.sd });
  });
}

function moons(n) {
  return Array.from({ length: n }, (_, i) => {
    const t = Math.random() * Math.PI;
    let x, y;
    if (i % 2 === 0) { x = Math.cos(t); y = Math.sin(t); }
    else { x = 1 - Math.cos(t); y = 0.5 - Math.sin(t); }
    // map from roughly [-1,2]x[-0.5,1] to the canvas
    return clip({ x: (x - 0.5) * 0.62 + gauss() * 0.045, y: (y - 0.25) * 0.75 + gauss() * 0.045 });
  });
}

function rings(n) {
  return Array.from({ length: n }, (_, i) => {
    const inner = i % 3 === 0;
    const r = (inner ? 0.3 : 0.82) + gauss() * 0.035;
    const a = Math.random() * Math.PI * 2;
    return clip({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  });
}

function smiley(n) {
  return Array.from({ length: n }, (_, i) => {
    const kind = i % 10;
    if (kind < 5) { // face outline
      const a = Math.random() * Math.PI * 2, r = 0.88 + gauss() * 0.03;
      return clip({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    if (kind < 7) { // eyes
      const ex = kind === 5 ? -0.32 : 0.32;
      return clip({ x: ex + gauss() * 0.06, y: 0.3 + gauss() * 0.08 });
    }
    // smile
    const a = Math.PI * (1.18 + Math.random() * 0.64), r = 0.5 + gauss() * 0.03;
    return clip({ x: Math.cos(a) * r, y: Math.sin(a) * r - 0.02 });
  });
}

function uniform(n) {
  return Array.from({ length: n }, () => ({ x: (Math.random() * 2 - 1) * 0.98, y: (Math.random() * 2 - 1) * 0.98 }));
}

export const DATASETS = [
  { id: 'blobs', label: 'Blobs', emoji: '🫧', make: blobs, note: 'Round, well-separated groups — K-Means’ favourite kind of data.' },
  { id: 'uneven', label: 'Uneven', emoji: '⚖️', make: uneven, note: 'One big spread-out group and two tiny tight ones. Watch where the borders end up.' },
  { id: 'moons', label: 'Moons', emoji: '🌙', make: moons, note: 'Two curved shapes. K-Means can only draw straight borders, so it slices them wrong.' },
  { id: 'rings', label: 'Rings', emoji: '💍', make: rings, note: 'A ring around a circle. No straight-line split can separate them.' },
  { id: 'smiley', label: 'Smiley', emoji: '🙂', make: smiley, note: 'Just for fun — what does K-Means think a face is made of?' },
  { id: 'uniform', label: 'Random', emoji: '🎲', make: uniform, note: 'No real groups at all. K-Means still splits it into K pieces — it always will!' },
  { id: 'blank', label: 'Blank', emoji: '✏️', make: () => [], note: 'An empty canvas. Click, drag or use the spray tool to draw your own data.' },
];

export const findDataset = (id) => DATASETS.find((d) => d.id === id) || DATASETS[0];

/** Three clear blobs and a deliberately bad start (two stars inside one blob). */
export function trickyStart() {
  const cs = [{ x: -0.6, y: 0.45 }, { x: 0.55, y: 0.5 }, { x: 0.0, y: -0.55 }];
  const pts = [];
  for (let i = 0; i < 240; i++) {
    const c = cs[i % 3];
    pts.push(clip({ x: c.x + gauss() * 0.11, y: c.y + gauss() * 0.11 }));
  }
  const cents = [{ x: -0.72, y: 0.52 }, { x: -0.48, y: 0.36 }, { x: 0.3, y: -0.05 }];
  return { pts, cents };
}
