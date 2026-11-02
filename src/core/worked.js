// Helpers for the "📝 Worked example" card that mirrors the lecture slides step by step.
import { h } from './ui.js';

/** Round like the slides do (2 dp by default), dropping trailing zeros sensibly. */
export function fmt(n, dp = 2) {
  if (n == null || Number.isNaN(n)) return '–';
  if (!Number.isFinite(n)) return '∞';
  const v = +(Math.round(n * 10 ** dp) / 10 ** dp).toFixed(dp);
  return Object.is(v, -0) ? '0' : String(v);
}
/** Fixed decimals (keeps trailing zeros), e.g. table cells. */
export const fx = (n, dp = 2) => (n == null || Number.isNaN(n) ? '–' : !Number.isFinite(n) ? '∞' : (Math.round(n * 10 ** dp) / 10 ** dp).toFixed(dp));

export const pt = (p, dp = 2) => `(${fmt(p.x, dp)}, ${fmt(p.y, dp)})`;

/**
 * Build a compact table.
 *   head: ['Point', 'd to C1', ...]
 *   rows: [[cell, cell, ...]] where a cell is a string/number/Node or { v, cls, title }
 */
export function table(head, rows, { cls = '', caption } = {}) {
  const t = h('table', { class: 'wt ' + cls });
  if (caption) t.append(h('caption', {}, caption));
  if (head) t.append(h('thead', {}, h('tr', {}, head.map((c) => h('th', {}, c)))));
  const body = h('tbody');
  for (const r of rows) {
    const tr = h('tr', r.rowCls ? { class: r.rowCls } : {});
    for (const c of r.cells || r) {
      if (c && typeof c === 'object' && !(c instanceof Node) && 'v' in c) tr.append(h('td', { class: c.cls || null, title: c.title || null }, c.v));
      else tr.append(h('td', {}, c));
    }
    body.append(tr);
  }
  t.append(body);
  return h('div', { class: 'wt-wrap' }, t);
}

export const note = (html, kind = '') => h('div', { class: 'w-note ' + kind, html });
export const para = (html) => h('p', { class: 'w-p', html });
export const step = (title) => h('div', { class: 'w-step' }, title);

/** The card itself. set(nodes) replaces its body. */
export function workedCard() {
  const body = h('div', { class: 'worked-body' });
  const sub = h('span', { class: 'worked-sub' });
  const el = h('div', { class: 'card side-card worked-card' },
    h('h3', {}, '📝 Worked example', sub),
    body,
  );
  return {
    el,
    show(v) { el.style.display = v ? '' : 'none'; },
    set(nodes, subtitle = '') { body.replaceChildren(...[nodes].flat().filter(Boolean)); sub.textContent = subtitle; },
  };
}
