import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './styles.css';

import { h } from './core/ui.js';
import { mountHome } from './home.js';
import { findAlgorithm } from './algorithms/index.js';

const SITE_NAME = 'ML Playground';

const app = document.getElementById('app');
const header = h('header', { class: 'site-header' },
  h('a', { href: '#/', class: 'logo' },
    h('span', { class: 'logo-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    h('span', { class: 'logo-text' }, SITE_NAME),
  ),
  h('nav', { class: 'site-nav' }, h('a', { href: '#/' }, 'Algorithms')),
);
const main = h('main', { class: 'site-main' });
app.append(header, main);

let unmount = null;
let token = 0;

async function route() {
  const id = (location.hash.replace(/^#\/?/, '').split('?')[0] || '').trim();
  const my = ++token;
  unmount?.();
  unmount = null;
  window.scrollTo(0, 0);

  const algo = id ? findAlgorithm(id) : null;
  document.body.dataset.page = algo ? 'lab' : 'home';
  if (!algo) {
    if (id) history.replaceState(null, '', '#/');
    document.title = `${SITE_NAME} — watch machine learning think`;
    unmount = mountHome(main);
    return;
  }
  document.title = `${algo.title} · ${SITE_NAME}`;
  main.replaceChildren(h('div', { class: 'loading' }, h('span', { class: 'loading-dot' }), 'Loading playground…'));
  try {
    const mod = await algo.load();
    if (my !== token) return; // user navigated away meanwhile
    unmount = mod.mount(main);
  } catch (err) {
    console.error(err);
    main.replaceChildren(h('div', { class: 'loading' }, '😵 Could not load this playground. Try refreshing.'));
  }
}

window.addEventListener('hashchange', route);
route();
