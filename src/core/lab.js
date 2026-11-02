import { h } from './ui.js';

/**
 * Standard 3-column lab layout used by every algorithm page.
 *   [ controls ] [ stage (narrator + canvas + playbar) ] [ numbers + learn ]
 */
export function createLab(root, { title, emoji, category, level, blurb }) {
  const controls = h('aside', { class: 'lab-controls card', 'aria-label': 'Controls' });
  const stageHolder = h('div', { class: 'stage-holder' });
  const overlay = h('div', { class: 'stage-overlay' });
  const narrator = h('div', { class: 'narrator' });
  const playbarSlot = h('div', { class: 'playbar-slot' });
  const side = h('aside', { class: 'lab-side', 'aria-label': 'Learn' });

  const el = h('div', { class: 'lab' },
    h('div', { class: 'lab-head' },
      h('a', { href: '#/', class: 'back-link' }, '← All algorithms'),
      h('div', { class: 'lab-title-row' },
        h('span', { class: 'lab-emoji', 'aria-hidden': 'true' }, emoji),
        h('div', {},
          h('h1', { class: 'lab-title' }, title),
          h('p', { class: 'lab-blurb' }, blurb),
        ),
        h('div', { class: 'lab-tags' },
          h('span', { class: 'tag tag-cat' }, category),
          h('span', { class: 'tag tag-level' }, level),
        ),
      ),
    ),
    h('div', { class: 'lab-grid' },
      controls,
      h('section', { class: 'lab-stage card' }, narrator, h('div', { class: 'stage-wrap' }, stageHolder, overlay), playbarSlot),
      side,
    ),
  );
  root.replaceChildren(el);
  return { el, controls, stageHolder, overlay, narrator, playbarSlot, side };
}
