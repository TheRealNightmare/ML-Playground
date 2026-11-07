import { h } from './ui.js';
import { ALGORITHMS, SECTIONS } from '../algorithms/index.js';

/** "§1.2" style number for an algorithm, from its section and position. */
export function sectionNumber(title) {
  const a = ALGORITHMS.find((x) => x.title === title);
  if (!a) return '';
  const si = SECTIONS.findIndex((s) => s.id === a.section);
  const ai = ALGORITHMS.filter((x) => x.section === a.section).indexOf(a);
  return `§${si + 1}.${ai + 1}`;
}

/**
 * Standard lab layout used by every algorithm page, styled like a paper:
 *   title block (section number, title, abstract), then
 *   [ controls ] [ figure: narrator + canvas + playbar + caption ] [ numbers + learn ]
 */
export function createLab(root, { title, category, level, blurb, accent = '#3D8B8B' }) {
  const controls = h('aside', { class: 'lab-controls card', 'aria-label': 'Controls' });
  const stageHolder = h('div', { class: 'stage-holder' });
  const overlay = h('div', { class: 'stage-overlay' });
  const narrator = h('div', { class: 'narrator' });
  const playbarSlot = h('div', { class: 'playbar-slot' });
  const side = h('aside', { class: 'lab-side', 'aria-label': 'Learn' });
  const capText = h('span', {}, 'Interactive simulation. Click to add points, drag them to move.');
  const caption = h('figcaption', { class: 'fig-cap' }, h('b', {}, 'Figure 1. '), capText);
  const num = sectionNumber(title);

  const head = h('header', { class: 'lab-head' },
    h('div', { class: 'lab-head-inner' },
      h('a', { href: '#/', class: 'back-link' }, '← All algorithms'),
      h('p', { class: 'lab-kicker' }, h('span', { class: 'sec-num' }, num), ` ${category}`),
      h('h1', { class: 'lab-title' }, title),
      h('p', { class: 'lab-abstract' }, h('span', { class: 'abs-label' }, 'Abstract. '), blurb),
      h('div', { class: 'lab-meta' },
        h('span', { class: 'tag tag-level' }, level),
        h('span', { class: 'tag' }, 'Lecture mode'),
        h('span', { class: 'tag' }, 'Interactive figure'),
      ),
    ),
  );

  const el = h('div', { class: 'lab-page', style: { '--band': accent } },
    head,
    h('div', { class: 'lab' },
      h('div', { class: 'lab-grid' },
        controls,
        h('figure', { class: 'lab-stage card' }, narrator, h('div', { class: 'stage-wrap' }, stageHolder, overlay), playbarSlot, caption),
        side,
      ),
    ),
  );
  root.replaceChildren(el);
  let lastCap = '';
  const setCaption = (text) => { if (text !== lastCap) { lastCap = text; capText.textContent = text; } };
  return { el, controls, stageHolder, overlay, narrator, playbarSlot, side, setCaption };
}
