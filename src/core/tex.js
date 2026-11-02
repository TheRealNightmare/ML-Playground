import katex from 'katex';
import 'katex/dist/katex.min.css';
import { h } from './ui.js';

export const tex = (s, display = false) => katex.renderToString(s, { displayMode: display, throwOnError: false });
/** Replace $...$ with inline KaTeX. */
export const katexHtml = (s) => s.replace(/\$([^$]+)\$/g, (_, m) => tex(m));
export const eq = (s) => h('div', { class: 'eq', html: tex(s, true) });
export const P = (s) => h('p', { html: katexHtml(s) });
