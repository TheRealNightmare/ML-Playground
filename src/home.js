import { h } from './core/ui.js';
import { ALGORITHMS, SECTIONS } from './algorithms/index.js';
import { mountHero } from './three/hero3d.js';
import { mountBackground } from './three/bgfield.js';
import { mountCardArt } from './three/cardart.js';

const SITE = {
  author: 'Mirazul Islam Nahid',
  portfolio: 'https://mirazulislamnahid.com',
  github: 'https://github.com/TheRealNightmare/ML-Playground',
};

const PHASE_TEXT = {
  scatter: 'new data',
  init: 'placing centroids',
  assign: 'assignment step',
  update: 'update step',
  hold: 'converged',
};

export function mountHome(root) {
  const cleanups = [];
  let figNo = 2;
  const cardItems = [];

  const card = (a, num) => {
    const holder = h('div', { class: 'algo-art' }, h('span', { class: 'fig-no' }, `Fig. ${figNo++}`));
    const body = h('div', { class: 'algo-body' },
      h('div', { class: 'algo-tags' }, h('span', { class: 'tag tag-cat' }, a.category), h('span', { class: 'tag tag-level' }, a.level)),
      h('h3', { class: 'algo-title' }, h('span', { class: 'sec-num' }, num), a.title),
      h('p', { class: 'algo-tagline' }, a.tagline),
      h('span', { class: 'algo-cta' }, a.soon ? 'In preparation' : 'Open the figure →'),
    );
    const el = a.soon
      ? h('div', { class: 'algo-card card soon', tabindex: '0' }, holder, body)
      : h('a', { class: 'algo-card card', href: `#/${a.id}` }, holder, body);
    cardItems.push({ id: a.id, holder, card: el });
    return el;
  };

  const sections = SECTIONS.map((sec, i) => {
    const list = ALGORITHMS.filter((a) => a.section === sec.id);
    if (!list.length) return null;
    return h('section', { class: 'algo-section', id: 'sec-' + sec.id },
      h('div', { class: 'section-head' },
        h('div', {},
          h('p', { class: 'eyebrow' }, `Section ${i + 1}`),
          h('h2', { class: 'section-title' }, h('span', { class: 'sec-num' }, `§${i + 1}`), sec.title),
        ),
        h('p', { class: 'section-blurb' }, sec.blurb),
      ),
      h('div', { class: 'algo-grid' }, list.map((a, j) => card(a, `§${i + 1}.${j + 1}`))),
    );
  });

  const live = ALGORITHMS.filter((a) => !a.soon).length;
  const first = ALGORITHMS.find((a) => !a.soon);

  // hero figure
  const canvasWrap = h('div', { class: 'hero-canvas-wrap' });
  const hud = {
    phase: h('b', {}, 'new data'),
    iter: h('b', {}, '0'),
    J: h('b', {}, '–'),
  };
  canvasWrap.append(h('div', { class: 'hero-hud' },
    h('span', { class: 'hud-chip' }, 'K-Means · K = 5'),
    h('span', { class: 'hud-chip' }, 'step: ', hud.phase),
    h('span', { class: 'hud-chip' }, 'iter ', hud.iter),
    h('span', { class: 'hud-chip' }, 'J = ', hud.J),
  ));
  const bg = h('div', { class: 'bg-field', 'aria-hidden': 'true' });

  const el = h('div', { class: 'home-page' },
    bg,
    h('section', { class: 'hero-wrap' },
      h('div', { class: 'hero' },
        h('div', { class: 'hero-text' },
          h('p', { class: 'hero-kicker' }, h('b', {}, 'ML Playground'), ' · interactive notes · v1.0'),
          h('h1', { class: 'hero-title' }, 'Watch machine learning ', h('em', {}, 'think'), '.'),
          h('p', { class: 'hero-authors' }, h('a', { href: SITE.portfolio, target: '_blank', rel: 'noopener' }, SITE.author), ' · Dhaka, Bangladesh'),
          h('div', { class: 'abstract' },
            h('p', {}, h('span', { class: 'abs-label' }, 'Abstract. '),
              'Every algorithm here is an interactive figure. Draw your own data, step through the algorithm one move at a time, and read what happened — in plain language, with the real equations, and with the exact worked examples from the lecture slides.'),
          ),
          h('div', { class: 'hero-actions' },
            h('a', { class: 'btn btn-primary btn-lg', href: `#/${first.id}` }, `Start with ${first.title} →`),
            h('a', { class: 'btn btn-lg', href: '#/', onclick: (e) => { e.preventDefault(); document.getElementById('sec-clustering')?.scrollIntoView({ behavior: 'smooth' }); } }, 'Browse all figures'),
          ),
        ),
        h('figure', { class: 'hero-figure' },
          canvasWrap,
          h('figcaption', { class: 'fig-cap' }, h('b', {}, 'Figure 1. '), '1,500 points in ℝ³ clustered live by K-Means. Each round assigns every point to its nearest centroid (octahedra), then moves each centroid to the mean of its points. Drag to rotate · double-click for new data.'),
        ),
      ),
    ),
    h('div', { class: 'home' },
      h('div', { class: 'how-row' },
        how('Step 1', 'Draw', 'Click to add points, drag them, spray whole clouds — or load the lecture examples.'),
        how('Step 2', 'Step', 'Advance one move at a time and read exactly what changed and why. Or press play.'),
        how('Step 3', 'Understand', 'Intuition first, then the equations, with tables that match your slides.'),
      ),
      h('p', { class: 'count-line' }, `${live} interactive figures · ${ALGORITHMS.length - live} in preparation`),
      sections,
    ),
    h('footer', { class: 'site-footer' },
      h('div', { class: 'site-footer-inner' },
        h('span', {}, 'ML Playground — interactive notes on machine learning. Built with three.js.'),
        h('span', {},
          h('a', { href: SITE.portfolio, target: '_blank', rel: 'noopener' }, SITE.author),
          h('span', { class: 'dot-sep' }, ' · '),
          h('a', { href: SITE.github, target: '_blank', rel: 'noopener' }, 'Source'),
          h('span', { class: 'dot-sep' }, ' · '),
          h('span', { title: '↑ ↑ ↓ ↓ ← → ← → B A' }, 'Appendix A: try the Konami code'),
        ),
      ),
    ),
  );
  root.replaceChildren(el);

  const fmtJ = (v) => (v == null ? '–' : v >= 100 ? v.toFixed(0) : v.toFixed(1));
  try {
    cleanups.push(mountHero(canvasWrap, (s) => {
      hud.phase.textContent = PHASE_TEXT[s.phase] || s.phase;
      hud.iter.textContent = String(s.iter);
      hud.J.textContent = fmtJ(s.inertia);
    }));
  } catch (e) { console.warn('3D hero unavailable', e); }
  try { cleanups.push(mountBackground(bg)); } catch (e) { console.warn('3D background unavailable', e); }
  try { cleanups.push(mountCardArt(cardItems)); } catch (e) { console.warn('3D card art unavailable', e); }

  return () => cleanups.forEach((fn) => fn?.());
}

function how(label, title, text) {
  return h('div', { class: 'how card' }, h('p', { class: 'eyebrow' }, label), h('strong', {}, title), h('p', {}, text));
}
