// Tiny DOM helpers used by every lab page. No framework on purpose.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function section(title, ...children) {
  return h('section', { class: 'panel-section' }, h('h3', { class: 'panel-title' }, title), ...children);
}

/** Labeled range slider. Returns { el, set(value), get() } */
export function slider({ label, min, max, step = 1, value, format = (v) => v, onInput, hint }) {
  const out = h('output', { class: 'slider-value' }, format(value));
  const input = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
  const paint = () => {
    const pct = ((input.value - min) / (max - min)) * 100;
    input.style.setProperty('--pct', pct + '%');
  };
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = format(v);
    paint();
    onInput?.(v);
  });
  paint();
  const el = h('label', { class: 'slider' },
    h('span', { class: 'slider-head' }, h('span', { class: 'slider-label' }, label), out),
    input,
    hint ? h('span', { class: 'hint' }, hint) : null,
  );
  return {
    el,
    get: () => Number(input.value),
    set(v) { input.value = v; out.textContent = format(Number(v)); paint(); },
  };
}

/** Segmented button group. options: [{ value, label, title? }] */
export function segmented({ options, value, onChange, label, wrap = false }) {
  let current = value;
  const buttons = options.map((o) =>
    h('button', {
      type: 'button',
      class: 'seg-btn' + (o.value === value ? ' active' : ''),
      title: o.title || null,
      'aria-pressed': o.value === value ? 'true' : 'false',
      onclick: () => api.set(o.value, true),
    }, o.label),
  );
  const el = h('div', { class: 'seg-wrap' },
    label ? h('span', { class: 'field-label' }, label) : null,
    h('div', { class: 'seg' + (wrap ? ' seg-wrapping' : ''), role: 'group' }, buttons),
  );
  const api = {
    el,
    get: () => current,
    set(v, fire = false) {
      current = v;
      options.forEach((o, i) => {
        buttons[i].classList.toggle('active', o.value === v);
        buttons[i].setAttribute('aria-pressed', o.value === v ? 'true' : 'false');
      });
      if (fire) onChange?.(v);
    },
  };
  return api;
}

export function toggle({ label, value, onChange, emoji }) {
  const input = h('input', { type: 'checkbox' });
  input.checked = value;
  input.addEventListener('change', () => onChange?.(input.checked));
  const el = h('label', { class: 'toggle' },
    input,
    h('span', { class: 'toggle-track' }, h('span', { class: 'toggle-thumb' })),
    h('span', { class: 'toggle-label' }, emoji ? h('span', { class: 'emo' }, emoji) : null, label),
  );
  return { el, get: () => input.checked, set(v) { input.checked = v; } };
}

export function button(label, onClick, { variant = '', title } = {}) {
  return h('button', { type: 'button', class: 'btn ' + variant, onclick: onClick, title: title || null }, label);
}

/** Simple tabs. tabs: [{ id, label, render: () => Node }] */
export function tabs(list, { initial } = {}) {
  const bar = h('div', { class: 'tabs', role: 'tablist' });
  const body = h('div', { class: 'tab-body' });
  const el = h('div', { class: 'tabs-wrap' }, bar, body);
  const btns = {};
  const cache = {};
  let current = null;
  const show = (id) => {
    current = id;
    for (const t of list) btns[t.id].classList.toggle('active', t.id === id);
    if (!cache[id]) cache[id] = list.find((t) => t.id === id).render();
    body.replaceChildren(cache[id]);
    body.scrollTop = 0;
  };
  for (const t of list) {
    btns[t.id] = h('button', { type: 'button', class: 'tab', role: 'tab', onclick: () => show(t.id) }, t.label);
    bar.append(btns[t.id]);
  }
  show(initial || list[0].id);
  return { el, show, get current() { return current; } };
}
