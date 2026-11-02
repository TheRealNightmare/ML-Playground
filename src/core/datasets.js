// Shared 2D datasets, all roughly inside the square [-1, 1]².

export function gauss(rand = Math.random) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const clip = (p) => ({ x: Math.max(-1.05, Math.min(1.05, p.x)), y: Math.max(-1.05, Math.min(1.05, p.y)) });

export function blobCenters(k, minDist = 0.6, range = 0.7) {
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

export function uneven(n) {
  const big = { x: -0.35, y: 0.0, sd: 0.28, share: 0.7 };
  const small = [{ x: 0.52, y: 0.5, sd: 0.06 }, { x: 0.52, y: -0.5, sd: 0.06 }];
  return Array.from({ length: n }, (_, i) => {
    if (i / n < big.share) return clip({ x: big.x + gauss() * big.sd, y: big.y + gauss() * big.sd });
    const s = small[i % 2];
    return clip({ x: s.x + gauss() * s.sd, y: s.y + gauss() * s.sd });
  });
}

export function moons(n, noise = 0.045) {
  return Array.from({ length: n }, (_, i) => {
    const t = Math.random() * Math.PI;
    let x, y;
    if (i % 2 === 0) { x = Math.cos(t); y = Math.sin(t); }
    else { x = 1 - Math.cos(t); y = 0.5 - Math.sin(t); }
    return clip({ x: (x - 0.5) * 0.62 + gauss() * noise, y: (y - 0.25) * 0.75 + gauss() * noise });
  });
}

export function rings(n) {
  return Array.from({ length: n }, (_, i) => {
    const inner = i % 3 === 0;
    const r = (inner ? 0.3 : 0.82) + gauss() * 0.035;
    const a = Math.random() * Math.PI * 2;
    return clip({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  });
}

export function smiley(n) {
  return Array.from({ length: n }, (_, i) => {
    const kind = i % 10;
    if (kind < 5) {
      const a = Math.random() * Math.PI * 2, r = 0.88 + gauss() * 0.03;
      return clip({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    if (kind < 7) {
      const ex = kind === 5 ? -0.32 : 0.32;
      return clip({ x: ex + gauss() * 0.06, y: 0.3 + gauss() * 0.08 });
    }
    const a = Math.PI * (1.18 + Math.random() * 0.64), r = 0.5 + gauss() * 0.03;
    return clip({ x: Math.cos(a) * r, y: Math.sin(a) * r - 0.02 });
  });
}

export function uniform(n) {
  return Array.from({ length: n }, () => ({ x: (Math.random() * 2 - 1) * 0.98, y: (Math.random() * 2 - 1) * 0.98 }));
}

/** Blobs plus scattered background noise — DBSCAN's favourite test. */
export function noisyBlobs(n) {
  const nNoise = Math.round(n * 0.12);
  return [...blobs(n - nNoise, 3 + Math.floor(Math.random() * 2)), ...uniform(nNoise)];
}

/** Moons plus noise. */
export function noisyMoons(n) {
  const nNoise = Math.round(n * 0.1);
  return [...moons(n - nNoise, 0.04), ...uniform(nNoise)];
}

/** Clusters with very different densities — where DBSCAN struggles and HDBSCAN shines. */
export function varyingDensity(n) {
  const groups = [
    { x: -0.55, y: 0.45, sd: 0.05, share: 0.3 },
    { x: 0.45, y: 0.5, sd: 0.13, share: 0.3 },
    { x: -0.1, y: -0.5, sd: 0.22, share: 0.3 },
  ];
  const out = [];
  for (const g of groups) {
    const m = Math.round(n * g.share);
    for (let i = 0; i < m; i++) out.push(clip({ x: g.x + gauss() * g.sd, y: g.y + gauss() * g.sd }));
  }
  while (out.length < n) out.push({ x: (Math.random() * 2 - 1) * 0.98, y: (Math.random() * 2 - 1) * 0.98 });
  return out;
}

/** Two overlapping blobs — the classic case for soft (fuzzy) membership. */
export function overlapping(n) {
  const cs = [{ x: -0.28, y: 0.05, sd: 0.2 }, { x: 0.3, y: -0.05, sd: 0.2 }, { x: 0.05, y: 0.62, sd: 0.12 }];
  return Array.from({ length: n }, (_, i) => {
    const c = i % 5 === 4 ? cs[2] : cs[i % 2];
    return clip({ x: c.x + gauss() * c.sd, y: c.y + gauss() * c.sd });
  });
}

export const LIB = {
  blobs: { id: 'blobs', label: 'Blobs', emoji: '', make: (n) => blobs(n), note: 'Round, well-separated groups.' },
  uneven: { id: 'uneven', label: 'Uneven', emoji: '', make: uneven, note: 'One big spread-out group and two tiny tight ones.' },
  moons: { id: 'moons', label: 'Moons', emoji: '', make: (n) => moons(n), note: 'Two curved shapes that no straight line can separate.' },
  rings: { id: 'rings', label: 'Rings', emoji: '', make: rings, note: 'A ring around a circle.' },
  smiley: { id: 'smiley', label: 'Smiley', emoji: '', make: smiley, note: 'Just for fun — a face made of points.' },
  uniform: { id: 'uniform', label: 'Random', emoji: '', make: uniform, note: 'No real groups at all.' },
  noisy: { id: 'noisy', label: 'Noisy', emoji: '', make: noisyBlobs, note: 'Blobs with random noise scattered around them.' },
  noisymoons: { id: 'noisymoons', label: 'Moons+noise', emoji: '', make: noisyMoons, note: 'Two moons with background noise.' },
  density: { id: 'density', label: 'Densities', emoji: '', make: varyingDensity, note: 'A tight group, a medium group and a loose group, plus noise.' },
  overlap: { id: 'overlap', label: 'Overlap', emoji: '', make: overlapping, note: 'Groups that blend into each other — no clear border.' },
  blank: { id: 'blank', label: 'Blank', emoji: '', make: () => [], note: 'An empty canvas. Draw your own data.' },
};
