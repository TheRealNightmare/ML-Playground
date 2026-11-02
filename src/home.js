import { h } from './core/ui.js';
import { ALGORITHMS, SECTIONS } from './algorithms/index.js';

const SITE = {
  author: 'Nahid_',
  portfolio: 'https://mirazulislamnahid.com',
  github: 'https://github.com/TheRealNightmare/ML-Playground',
};

const C = { red: '#FF8C7A', blue: '#8EC9F5', yellow: '#FFE07A', green: '#7FD8BE', purple: '#B9A6F2', aqua: '#A8E6A1', orange: '#FFB37A', cream: '#FFF6E9' };

/* ---------------- tiny SVG helpers for the card art ---------------- */
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const dot = (x, y, fill, r = 5.5) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}" stroke="#000" stroke-width="2"/>`;
const ring = (x, y, r = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.cream}" stroke="#A39889" stroke-width="2"/>`;
const line = (x1, y1, x2, y2, w = 2.2, c = '#000', dash = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linecap="square"/>`;
const rect = (x, y, w, hh, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="3" fill="${fill}" stroke="#000" stroke-width="2"/>`;
const label = (x, y, t, size = 11) => `<text x="${x}" y="${y}" font-family="JetBrains Mono Variable, monospace" font-weight="800" font-size="${size}" text-anchor="middle">${t}</text>`;
function star(cx, cy, R, fill) {
  const p = [];
  for (let i = 0; i < 10; i++) { const r = i % 2 ? R * 0.5 : R; const a = -Math.PI / 2 + (i * Math.PI) / 5; p.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`); }
  return `<polygon points="${p.join(' ')}" fill="${fill}" stroke="#000" stroke-width="2.2" stroke-linejoin="round"/>`;
}
function cloud(rand, cx, cy, n, spread, fill, r = 5) {
  let s = '';
  for (let i = 0; i < n; i++) { const a = rand() * 6.28, d = Math.sqrt(rand()) * spread; s += dot(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, fill, r); }
  return s;
}
const svg = (inner) => `<svg viewBox="0 0 300 132" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${inner}</svg>`;

const ART = {
  kmeans: () => { const r = rng(7); return svg(
    line(150, 0, 132, 70, 2, '#000', '5 5') + line(132, 70, 30, 132, 2, '#000', '5 5') + line(132, 70, 230, 132, 2, '#000', '5 5') +
    cloud(r, 70, 40, 9, 26, C.red) + cloud(r, 220, 45, 9, 26, C.blue) + cloud(r, 140, 100, 9, 24, C.yellow) +
    star(70, 40, 12, C.cream) + star(220, 45, 12, C.cream) + star(140, 100, 12, C.cream)); },
  hierarchical: () => {
    const xs = [40, 70, 105, 135, 185, 215, 255];
    const cols = [C.green, C.green, C.green, C.green, C.orange, C.orange, C.orange];
    const U = (a, b, y, ya, yb, c) => line(a, ya, a, y, 2.5, c) + line(a, y, b, y, 2.5, c) + line(b, y, b, yb, 2.5, c);
    let s = U(40, 70, 88, 112, 112, C.green) + U(105, 135, 80, 112, 112, C.green) + U(55, 120, 52, 88, 80, C.green);
    s += U(185, 215, 92, 112, 112, C.orange) + U(200, 255, 70, 92, 112, C.orange) + U(87, 227, 22, 52, 70, '#000');
    s += line(20, 40, 280, 40, 2, C.red, '6 5');
    xs.forEach((x, i) => { s += dot(x, 112, cols[i], 6); });
    return svg(s);
  },
  fcm: () => { const r = rng(3); return svg(
    `<circle cx="115" cy="66" r="52" fill="${C.purple}" fill-opacity=".28" stroke="#000" stroke-width="2"/>` +
    `<circle cx="185" cy="66" r="52" fill="${C.blue}" fill-opacity=".28" stroke="#000" stroke-width="2"/>` +
    cloud(r, 95, 66, 7, 26, C.purple) + cloud(r, 205, 66, 7, 26, C.blue) + cloud(r, 150, 66, 5, 10, '#A59BC9') +
    star(100, 64, 11, C.cream) + star(200, 64, 11, C.cream)); },
  dbscan: () => { const r = rng(11); let s = '';
    for (let i = 0; i < 14; i++) { const t = i / 13; const x = 40 + t * 150, y = 90 - Math.sin(t * 3.1) * 50 + (r() - 0.5) * 8; s += `<circle cx="${x}" cy="${y}" r="20" fill="${C.blue}" fill-opacity=".09"/>` + dot(x, y, C.blue); }
    s += `<circle cx="96" cy="44" r="20" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="4 4"/>`;
    s += cloud(r, 240, 60, 7, 18, C.yellow) + ring(25, 25) + ring(280, 115) + ring(200, 118) + ring(285, 20);
    return svg(s); },
  hdbscan: () => { const r = rng(5);
    const pts = [];
    for (let i = 0; i < 8; i++) pts.push([60 + r() * 50, 30 + r() * 70]);
    for (let i = 0; i < 6; i++) pts.push([200 + r() * 60, 40 + r() * 60]);
    let s = '';
    const used = [0];
    while (used.length < pts.length) {
      let best = null, bd = 1e9;
      for (const u of used) pts.forEach((p, j) => { if (used.includes(j)) return; const d = Math.hypot(p[0] - pts[u][0], p[1] - pts[u][1]); if (d < bd) { bd = d; best = [u, j]; } });
      used.push(best[1]);
      const a = pts[best[0]], b = pts[best[1]], far = bd > 60;
      s += line(a[0], a[1], b[0], b[1], far ? 2 : 3, far ? '#D9C6A8' : best[1] < 8 ? C.aqua : C.orange, far ? '5 4' : '');
    }
    pts.forEach((p, i) => { s += dot(p[0], p[1], i < 8 ? C.aqua : C.orange, 5.5); });
    return svg(s + ring(150, 115) + ring(160, 20)); },
  'decision-tree': () => svg(
    line(150, 32, 85, 78) + line(150, 32, 215, 78) + line(85, 78, 50, 112) + line(85, 78, 120, 112) +
    rect(106, 14, 88, 26, C.yellow) + label(150, 31, 'x &lt; 3 ?', 12) +
    rect(55, 66, 60, 24, C.cream) + rect(185, 66, 60, 24, C.blue) + rect(25, 102, 50, 22, C.red) + rect(95, 102, 50, 22, C.green)),
  'random-forest': () => { let s = '';
    [[60, C.green], [150, C.aqua], [240, C.green]].forEach(([x, c], k) => {
      s += line(x, 30, x - 28, 70) + line(x, 30, x + 28, 70) + line(x - 28, 70, x - 42, 104) + line(x - 28, 70, x - 14, 104);
      s += rect(x - 18, 18, 36, 20, c) + rect(x - 40, 62, 24, 18, C.cream) + rect(x + 16, 62, 24, 18, k === 1 ? C.red : C.yellow) + dot(x - 42, 108, C.red, 5) + dot(x - 14, 108, C.blue, 5);
    });
    return svg(s); },
  ensemble: () => { const r = rng(9); let s = '';
    [56, 42, 28, 14].forEach((rr, i) => { s += `<circle cx="150" cy="66" r="${rr}" fill="${i % 2 ? C.cream : C.red}" stroke="#000" stroke-width="2"/>`; });
    for (let i = 0; i < 9; i++) s += dot(150 + (r() - 0.5) * 30, 66 + (r() - 0.5) * 30, C.yellow, 4.5);
    s += rect(30, 30, 46, 22, C.blue) + rect(30, 80, 46, 22, C.purple) + rect(224, 55, 46, 22, C.green);
    s += line(78, 41, 100, 55, 2, '#000', '4 4') + line(78, 91, 100, 78, 2, '#000', '4 4') + line(222, 66, 206, 66, 2, '#000', '4 4');
    return svg(s); },
  adaboost: () => { const r = rng(4); let s = line(150, 10, 150, 122, 2.5, '#000', '6 5');
    for (let i = 0; i < 14; i++) { const x = 30 + r() * 240, y = 20 + r() * 92; const heavy = i % 3 === 0; s += dot(x, y, i % 2 ? C.blue : C.red, heavy ? 9 : 4.5); }
    return svg(s); },
  xgboost: () => { let s = ''; [90, 66, 48, 36, 28, 22, 18].forEach((hh, i) => { s += rect(34 + i * 34, 118 - hh, 24, hh, i === 0 ? C.red : C.orange); });
    s += `<path d="M 40 22 C 120 30, 180 70, 262 90" fill="none" stroke="#000" stroke-width="2.5" stroke-dasharray="6 5"/><polygon points="270,93 255,97 259,84" fill="#000"/>`;
    return svg(s); },
  catboost: () => { let s = '';
    [[C.red, 'RED'], [C.blue, 'BLUE'], [C.red, 'RED'], [C.green, 'GRN'], [C.blue, 'BLUE']].forEach(([c, t], i) => { s += rect(22 + i * 52, 22, 44, 26, c) + label(44 + i * 52, 40, t, 10); });
    s += `<path d="M150 56 L150 72" stroke="#000" stroke-width="2.5"/><polygon points="150,82 143,70 157,70" fill="#000"/>`;
    [0.6, 0.6, 0.3, 0.8, 0.6].forEach((v, i) => { s += rect(22 + i * 52, 90, 44, 24, C.cream) + label(44 + i * 52, 106, v.toFixed(2)); });
    return svg(s); },
  'cross-validation': () => { let s = '';
    for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) s += rect(40 + k * 56, 14 + row * 27, 50, 19, k === row ? C.yellow : C.blue);
    return svg(s); },
};

function heroBadge() {
  const words = 'CLUSTER · SPLIT · BOOST · VALIDATE · ';
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return `<line x1="${160 + Math.cos(a) * 58}" y1="${160 + Math.sin(a) * 58}" x2="${160 + Math.cos(a) * 74}" y2="${160 + Math.sin(a) * 74}" stroke="#1A1A1A" stroke-opacity=".35" stroke-width="5"/>`;
  }).join('');
  return `<svg viewBox="0 0 320 320" aria-hidden="true">
    <defs><path id="badge-ring" d="M160,160 m-128,0 a128,128 0 1,1 256,0 a128,128 0 1,1 -256,0"/></defs>
    <g class="badge-ring"><text font-family="JetBrains Mono Variable, monospace" font-weight="800" font-size="15.5" letter-spacing="5" fill="#1A1A1A"><textPath href="#badge-ring">${words}${words}</textPath></text></g>
    <circle cx="160" cy="160" r="104" fill="none" stroke="#1A1A1A" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>
    <circle cx="160" cy="160" r="82" fill="none" stroke="#1A1A1A" stroke-opacity=".45" stroke-width="2"/>
    ${rays}
    <g class="badge-orbit">${rect(62, 150, 16, 16, C.purple)}${dot(250, 112, C.yellow, 7)}${dot(118, 254, C.red, 6)}${rect(232, 222, 13, 13, C.green)}${dot(148, 58, C.orange, 6)}</g>
    <g class="badge-core">
      <rect x="124" y="124" width="76" height="76" rx="4" fill="#000"/>
      <rect x="118" y="118" width="76" height="76" rx="4" fill="${C.yellow}" stroke="#000" stroke-width="3"/>
      ${dot(138, 140, C.red, 5)}${dot(147, 148, C.red, 5)}${dot(171, 138, C.blue, 5)}${dot(180, 146, C.blue, 5)}${dot(150, 176, C.green, 5)}${dot(161, 172, C.green, 5)}
      ${star(156, 156, 9, C.cream)}
    </g>
  </svg>`;
}

const HERO_TITLE = [
  [['W', 'c-y'], ['ATCH']],
  [['M'], ['A', 'c-p'], ['CHIN'], ['E', 'c-g'], ['S']],
  [['L'], ['E', 'c-o'], ['ARN'], ['_', 'us']],
];

export function mountHome(root) {
  const card = (a) => {
    const art = h('div', { class: 'algo-art', html: ART[a.id] ? ART[a.id]() : '' });
    const body = h('div', { class: 'algo-body' },
      h('div', { class: 'algo-tags' }, h('span', { class: 'tag tag-cat' }, a.category), h('span', { class: 'tag tag-level' }, a.level)),
      h('h3', { class: 'algo-title' }, a.title),
      h('p', { class: 'algo-tagline' }, a.tagline),
      h('span', { class: 'algo-cta' }, a.soon ? 'Coming soon' : 'Open →'),
    );
    return a.soon
      ? h('div', { class: 'algo-card card soon', style: { '--accent': a.accent } }, art, body)
      : h('a', { class: 'algo-card card', href: `#/${a.id}`, style: { '--accent': a.accent } }, art, body);
  };
  const sections = SECTIONS.map((sec, i) => {
    const list = ALGORITHMS.filter((a) => a.section === sec.id);
    if (!list.length) return null;
    return h('section', { class: 'algo-section', id: 'sec-' + sec.id },
      h('div', { class: 'section-head' },
        h('div', {}, h('p', { class: 'eyebrow' }, `${String(i + 1).padStart(2, '0')} / ${sec.title}`), h('h2', { class: 'section-title' }, sec.heading)),
        h('p', { class: 'section-blurb' }, sec.blurb),
      ),
      h('div', { class: 'algo-grid' }, list.map(card)),
    );
  });
  const live = ALGORITHMS.filter((a) => !a.soon).length;
  const first = ALGORITHMS.find((a) => !a.soon);
  const words = 'CLUSTER<b>·</b>ASSIGN<b>·</b>UPDATE<b>·</b>REPEAT<b>·</b>SPLIT<b>·</b>BAG<b>·</b>BOOST<b>·</b>VALIDATE<b>·</b>';

  const el = h('div', { class: 'home-page' },
    h('section', { class: 'hero-band' },
      h('div', { class: 'hero' },
        h('div', { class: 'hero-text' },
          h('p', { class: 'eyebrow' }, 'Interactive ML simulations · draw · step · understand'),
          h('h1', { class: 'hero-title' }, HERO_TITLE.map((ln) => h('span', { style: { display: 'block' } }, ln.map(([t, c]) => (c ? h('span', { class: c }, t) : t))))),
          h('p', { class: 'hero-sub' }, 'Draw your own data, press play, and follow every step — with plain-English notes, the real math, and the exact worked examples from the lecture slides.'),
          h('div', { class: 'hero-actions' },
            h('a', { class: 'btn btn-primary btn-lg', href: `#/${first.id}` }, `Start with ${first.title} →`),
            h('a', { class: 'btn btn-purple btn-lg', href: '#/', onclick: (e) => { e.preventDefault(); document.getElementById('sec-clustering')?.scrollIntoView({ behavior: 'smooth' }); } }, 'Browse all'),
            h('a', { class: 'btn btn-grey btn-lg', href: SITE.portfolio, target: '_blank', rel: 'noopener' }, 'Who made this'),
          ),
        ),
        h('div', { class: 'hero-badge', html: heroBadge() }),
      ),
    ),
    h('div', { class: 'marquee', 'aria-hidden': 'true' }, h('div', { class: 'marquee-track' }, h('span', { html: words.repeat(4) }), h('span', { html: words.repeat(4) }))),
    h('div', { class: 'home' },
      h('div', { class: 'how-row' },
        how('01 / Draw', 'Make the data', 'Click to add points, drag them around, spray whole clouds — or load the slide examples.'),
        how('02 / Step', 'One move at a time', 'Press step and read exactly what changed and why. Or hit play and watch.'),
        how('03 / Understand', 'Intuition + math', 'Plain-English notes, the real equations, and tables that match your lectures.'),
      ),
      h('p', { class: 'count-line' }, `${live} playgrounds live · ${ALGORITHMS.length - live} on the way`),
      sections,
    ),
    h('footer', { class: 'site-footer' },
      h('div', { class: 'site-footer-inner' },
        h('span', {}, 'ML_PLAYGROUND · built with three.js & neo-retro'),
        h('span', {},
          'by ', h('a', { href: SITE.portfolio, target: '_blank', rel: 'noopener' }, SITE.author),
          h('span', { class: 'dot-sep' }, ' · '),
          h('a', { href: SITE.github, target: '_blank', rel: 'noopener' }, 'Source'),
          h('span', { class: 'dot-sep' }, ' · '),
          'psst… try the Konami code',
        ),
      ),
    ),
  );
  root.replaceChildren(el);
  return () => {};
}

function how(label, title, text) {
  return h('div', { class: 'how card' }, h('p', { class: 'eyebrow' }, label), h('strong', {}, title), h('p', {}, text));
}
