import { h } from './core/ui.js';
import { ALGORITHMS } from './algorithms/index.js';

const SITE = {
  author: 'Mirazul Islam Nahid',
  portfolio: 'https://mirazulislamnahid.com',
  github: 'https://github.com/TheRealNightmare',
};

// Small decorative illustration per algorithm card (inline SVG).
function starPath(cx, cy, R, r = R * 0.5) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r : R;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" stroke-linejoin="round"/>`;
}
function cluster(cls, color, cx, cy, offsets) {
  const lines = offsets.map(([dx, dy]) => `<line x1="${cx}" y1="${cy}" x2="${cx + dx}" y2="${cy + dy}" stroke="${color}" stroke-width="2" opacity=".7"/>`).join('');
  const dots = offsets.map(([dx, dy]) => `<circle cx="${cx + dx}" cy="${cy + dy}" r="6.5" fill="${color}" stroke="#2B2240" stroke-width="2.5"/>`).join('');
  return `<g class="${cls}">${lines}${dots}<g fill="#fff" stroke="#2B2240" stroke-width="3">${starPath(cx, cy, 13)}</g><g fill="${color}">${starPath(cx, cy, 8.5)}</g></g>`;
}
const ART = {
  kmeans: `
  <svg viewBox="0 0 240 140" aria-hidden="true">
    <path d="M118 0 L104 70 L0 96 M104 70 L170 140" fill="none" stroke="#2B2240" stroke-width="2" stroke-dasharray="5 5" opacity=".35"/>
    ${cluster('float-a', '#FF6B6B', 52, 42, [[-22, -10], [-14, 16], [10, -20], [22, 6], [-4, 24], [18, 22], [-26, 6]])}
    ${cluster('float-b', '#4D96FF', 180, 50, [[-20, -14], [16, -18], [24, 8], [-10, 20], [6, 26], [-26, 8]])}
    ${cluster('float-c', '#2EC4B6', 92, 108, [[-24, -6], [-12, 16], [14, 14], [24, -6], [4, -22], [-30, 14]])}
  </svg>`,
};

export function mountHome(root) {
  const cards = ALGORITHMS.map((a) =>
    h('a', { class: 'algo-card card', href: `#/${a.id}`, style: { '--accent': a.accent } },
      h('div', { class: 'algo-art', html: ART[a.id] || '' }),
      h('div', { class: 'algo-body' },
        h('div', { class: 'algo-tags' }, h('span', { class: 'tag tag-cat' }, a.category), h('span', { class: 'tag tag-level' }, a.level)),
        h('h3', { class: 'algo-title' }, a.emoji + ' ' + a.title),
        h('p', { class: 'algo-tagline' }, a.tagline),
        h('span', { class: 'algo-cta' }, 'Open the playground →'),
      ),
    ),
  );

  cards.push(
    h('div', { class: 'algo-card card soon' },
      h('div', { class: 'algo-art soon-art' }, h('span', {}, '🧪')),
      h('div', { class: 'algo-body' },
        h('h3', { class: 'algo-title' }, 'More on the way'),
        h('p', { class: 'algo-tagline' }, 'New algorithms are added one at a time. Check back soon!'),
      ),
    ),
  );

  const el = h('div', { class: 'home' },
    h('section', { class: 'hero' },
      h('div', { class: 'hero-text' },
        h('p', { class: 'eyebrow' }, 'Interactive machine learning'),
        h('h1', { class: 'hero-title' }, 'Watch machine learning ', h('span', { class: 'squiggle' }, 'think'), '.'),
        h('p', { class: 'hero-sub' },
          'Each playground turns an algorithm into something you can poke. Draw your own data, press play, ',
          'and follow every step with plain-English notes and the real math beside it.'),
        h('div', { class: 'hero-actions' },
          h('a', { class: 'btn btn-primary btn-lg', href: `#/${ALGORITHMS[0].id}` }, '▶ Start with ' + ALGORITHMS[0].title),
        ),
      ),
      h('div', { class: 'hero-how' },
        how('✏️', 'Draw', 'Click to add points, drag them around, spray whole clouds.'),
        how('⏭', 'Step', 'Move one step at a time and read what just happened.'),
        how('📐', 'Understand', 'Switch between the intuition and the equations whenever you like.'),
      ),
    ),
    h('section', { class: 'algo-section' },
      h('h2', { class: 'section-title' }, 'Playgrounds'),
      h('div', { class: 'algo-grid' }, cards),
    ),
    h('footer', { class: 'site-footer' },
      h('span', {}, 'Made by ', h('a', { href: SITE.portfolio, target: '_blank', rel: 'noopener' }, SITE.author)),
      h('span', { class: 'dot-sep' }, '•'),
      h('a', { href: SITE.github, target: '_blank', rel: 'noopener' }, 'GitHub'),
      h('span', { class: 'dot-sep' }, '•'),
      h('span', {}, 'Built with three.js'),
    ),
  );
  root.replaceChildren(el);
  return () => {};
}

function how(emoji, title, text) {
  return h('div', { class: 'how card' },
    h('span', { class: 'how-emoji' }, emoji),
    h('div', {}, h('strong', {}, title), h('p', {}, text)),
  );
}
