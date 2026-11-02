import { h } from './ui.js';

/**
 * Standard lab layout used by every algorithm page:
 *   a full-width colored title band, then
 *   [ controls ] [ stage (narrator + canvas + playbar) ] [ numbers + learn ]
 */
export function createLab(root, { title, category, level, blurb, accent = '#FFE07A' }) {
  const controls = h('aside', { class: 'lab-controls card', 'aria-label': 'Controls' });
  const stageHolder = h('div', { class: 'stage-holder' });
  const overlay = h('div', { class: 'stage-overlay' });
  const narrator = h('div', { class: 'narrator' });
  const playbarSlot = h('div', { class: 'playbar-slot' });
  const side = h('aside', { class: 'lab-side', 'aria-label': 'Learn' });

  const band = h('header', { class: 'lab-band' },
    h('div', { class: 'lab-band-inner' },
      h('a', { href: '#/', class: 'back-link' }, '← All algorithms'),
      h('div', { class: 'lab-title-row' },
        h('div', { class: 'lab-title-text' },
          h('p', { class: 'eyebrow' }, category),
          h('h1', { class: 'lab-title' }, title),
          h('p', { class: 'lab-blurb' }, blurb),
        ),
        h('div', { class: 'lab-tags' },
          h('span', { class: 'tag tag-level' }, level),
          h('span', { class: 'tag tag-dark' }, 'Lecture mode'),
        ),
      ),
    ),
  );

  const el = h('div', { class: 'lab-page', style: { '--band': accent } },
    band,
    h('div', { class: 'lab' },
      h('div', { class: 'lab-grid' },
        controls,
        h('section', { class: 'lab-stage card' }, narrator, h('div', { class: 'stage-wrap' }, stageHolder, overlay), playbarSlot),
        side,
      ),
    ),
  );
  root.replaceChildren(el);
  return { el, controls, stageHolder, overlay, narrator, playbarSlot, side };
}
