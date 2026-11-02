import '@fontsource/archivo-black/400.css';
import '@fontsource-variable/space-grotesk/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './styles.css';

import { h } from './core/ui.js';
import { mountHome } from './home.js';
import { findAlgorithm } from './algorithms/index.js';

import { installKonami } from './konami.js';

const SITE_NAME = 'ML_PLAYGROUND';
const PORTFOLIO = 'https://mirazulislamnahid.com';

const app = document.getElementById('app');
const navHome = h('a', { href: '#/', class: 'nav-btn' }, 'Home');
const navAlgos = h('a', { href: '#/', class: 'nav-btn nav-algos', onclick: (e) => {
  e.preventDefault();
  const go = () => document.getElementById('sec-clustering')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (location.hash.replace(/^#\/?/, '')) { location.hash = '#/'; setTimeout(go, 120); } else go();
} }, 'Algorithms');
const header = h('header', { class: 'site-header' },
  h('div', { class: 'site-header-inner' },
    h('a', { href: '#/', class: 'logo', 'aria-label': 'ML Playground home' }, 'ML_PLAYGROUND', h('span', { class: 'cursor' }, '▌')),
    h('nav', { class: 'site-nav' }, navHome, navAlgos, h('a', { href: PORTFOLIO, class: 'nav-btn out', target: '_blank', rel: 'noopener' }, 'Nahid_ ↗')),
  ),
);
installKonami();
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
  navHome.classList.toggle('active', !algo);
  navAlgos.classList.toggle('active', !!algo);
  if (!algo) {
    if (id) history.replaceState(null, '', '#/');
    document.title = 'ML_PLAYGROUND — watch machine learning think';
    unmount = mountHome(main);
    return;
  }
  document.title = `${algo.title} · ML_PLAYGROUND`;
  main.replaceChildren(h('div', { class: 'loading' }, h('span', { class: 'loading-dot' }), 'Loading…'));
  try {
    const mod = await algo.load();
    if (my !== token) return; // user navigated away meanwhile
    unmount = mod.mount(main);
  } catch (err) {
    console.error(err);
    main.replaceChildren(h('div', { class: 'loading' }, 'Could not load this playground. Try refreshing.'));
  }
}

window.addEventListener('hashchange', route);
route();
