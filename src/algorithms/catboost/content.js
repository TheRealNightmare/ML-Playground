import { h } from '../../core/ui.js';
import { eq, P } from '../../core/tex.js';

export const CUSTOMERS = [
  { id: 1, color: 'Red', age: 20, y: 1 },
  { id: 2, color: 'Blue', age: 30, y: 0 },
  { id: 3, color: 'Red', age: 25, y: 1 },
  { id: 4, color: 'Green', age: 40, y: 0 },
  { id: 5, color: 'Blue', age: 35, y: 1 },
];

export const LECTURES = [
  {
    id: 'lec-cat', label: '5 customers', task: 'cls1d', noDraw: true, mode: 'boost',
    points: CUSTOMERS.map((c) => ({ x: c.age, y: c.y, label: c.y, name: `${c.id}·${c.color}` })),
    fitOpts: { uniform: false, box: 0.8, boxY: 0.55, pad: { x: 6, y: 0.3 } },
    classNames: ['No', 'Yes'],
    perm: [2, 1, 5, 3, 4], a: 1, prior: 0.6, eta: 0.5, split: 28,
    note: 'Slide example: will a customer buy? Colour is categorical, Age is numeric. Permutation (2, 1, 5, 3, 4), a = 1, P = 0.6, learning rate 0.5.',
  },
];

export function intuitionTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Categories need numbers'),
    P('Trees split on numbers, but “Red / Blue / Green” are categories. A popular trick is <b>target encoding</b>: replace each category by the average target of that category (e.g. “Red customers buy 80% of the time”).'),
    h('h4', {}, 'The leak'),
    P('If a row’s own label is used to compute its encoding, the feature secretly contains the answer. With few rows per category the model looks brilliant in training and fails on new data — <b>target leakage</b>.'),
    h('div', { class: 'callout' },
      h('strong', {}, 'Only look at the past'),
      P('CatBoost shuffles the rows into a random order and encodes each row using <b>only the rows before it</b>, like a student who may only use earlier exam results to predict the next one. A prior P and smoothing a keep the first rows of a category from getting extreme values.'),
    ),
    h('h4', {}, 'Then: plain gradient boosting'),
    h('ul', {},
      h('li', { html: 'Start from F₀ = the average target.' }),
      h('li', { html: 'Fit a small tree to the residuals, add η × its output, repeat.' }),
      h('li', { html: 'CatBoost’s trees are <b>oblivious</b> (symmetric): every node on the same level asks the <i>same</i> question, which makes them fast and hard to overfit. You can see the grid they make in Boosting mode.' }),
    ),
  );
}

export function mathTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Ordered target statistic'),
    P('For row $i$ in the random permutation, using only the rows $j$ that come before it and have the same category:'),
    eq('\\text{CTR}_i = \\frac{\\sum_{j < i,\\ c_j = c_i} y_j + a\\,P}{N_i + a}'),
    P('$N_i$ = number of earlier rows with the same category, $P$ = prior (usually the global mean of $y$), $a$ = smoothing weight.'),
    h('h4', {}, 'Compare: greedy (leaky) encoding'),
    eq('\\text{TS}_i = \\frac{\\sum_{j:\\,c_j = c_i} y_j + a\\,P}{N_{c_i} + a}'),
    P('It includes row $i$’s own label — the leak.'),
    h('h4', {}, 'Boosting update'),
    eq('F_m(x) = F_{m-1}(x) + \\eta\\, h_m(x), \\qquad r_i = y_i - \\hat y_i'),
    P('In the playground’s Boosting mode the scores are log-odds: $F_0 = \\ln\\frac{\\bar y}{1 - \\bar y}$, residuals $y_i - \\sigma(F(x_i))$, and $P(y=1) = \\sigma(F)$.'),
    h('h4', {}, 'Oblivious tree'),
    P('A depth-$d$ oblivious tree is $d$ conditions applied to every row; the $2^d$ combinations index the leaves, like a lookup table.'),
  );
}

export function challengesTab(actions) {
  const card = (title, text, label, fn, answer) => h('div', { class: 'challenge' },
    h('div', { class: 'challenge-head' }, h('strong', {}, title)),
    h('p', { html: text }),
    label ? h('button', { type: 'button', class: 'btn btn-primary', onclick: fn }, label) : null,
    answer ? h('details', {}, h('summary', {}, 'What should I notice?'), h('p', { html: answer })) : null,
  );
  return h('div', { class: 'learn' },
    card('Reproduce the slide', 'Step through the encoding of the five customers, then the first tree.', 'Load the example', actions.lec,
      'CTRs in permutation order: 0.60, 0.60, 0.30, 0.80, 0.60. Then Age < 28 → +0.40, otherwise −0.267; with η = 0.5 the predictions become 0.80 and 0.4665.'),
    card('See the leak', 'In Ordered encoding mode, switch on “Show leaky encoding” with 12 customers.', 'Open encoding', actions.encode,
      'The leaky value of each row is pulled towards its own label — a free hint the model would never get on new data.'),
    card('Shuffle', 'Press “New permutation” a few times.', 'Open encoding', actions.encode,
      'Each permutation gives different encodings for the early rows; real CatBoost averages over several permutations.'),
    card('Oblivious grids', 'In Boosting mode on the XOR data, set depth 2.', 'Load XOR', actions.xor,
      'A depth-2 oblivious tree is exactly one vertical and one horizontal cut — perfect for XOR.'),
  );
}
