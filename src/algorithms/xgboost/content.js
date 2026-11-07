import { h } from '../../core/ui.js';
import { eq, P } from '../../core/tex.js';

export const LECTURES = [
  {
    id: 'lec-xgb', label: '4 samples · one tree', task: 'cls1d', noDraw: true,
    points: [[2, 1], [3, 1], [7, 0], [8, 0]].map(([x, c], i) => ({ x, y: c, label: c, name: `S${i + 1}` })),
    fitOpts: { uniform: false, box: 0.8, boxY: 0.55, pad: { x: 1.6, y: 0.3 } },
    classNames: ['0', '1'],
    settings: { T: 1, eta: 1, lambda: 1, gamma: 0, depth: 1 },
    note: 'Slide example: x = 2, 3, 7, 8 with y = 1, 1, 0, 0, logistic loss, start from ŷ = 0, λ = 1, γ = 0, learning rate 1.',
  },
];

export function intuitionTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Boosting with a compass and a ruler'),
    P('Like every gradient-boosting method, XGBoost adds small trees one at a time, each one correcting what the current model still gets wrong. What makes it special is how it measures “wrong” for each point:'),
    h('ul', {},
      h('li', { html: 'The <b>gradient</b> g<sub>i</sub> says <i>which way</i> to move point i’s prediction (negative → push up, positive → push down).' }),
      h('li', { html: 'The <b>Hessian</b> h<sub>i</sub> says <i>how sure</i> we can be about that direction — how curved the loss is there — and so how big the step should be.' }),
    ),
    h('div', { class: 'callout' },
      h('strong', {}, 'Walking downhill in fog'),
      P('The slope under your feet (gradient) tells you which way is down. How quickly the slope is changing (Hessian) tells you whether to take a long stride or a careful small step.'),
    ),
    h('h4', {}, 'Built-in brakes'),
    h('ul', {},
      h('li', { html: '<b>λ</b> (L2 regularisation) shrinks every leaf value towards 0.' }),
      h('li', { html: '<b>γ</b> is the price of a new leaf: a split is only kept if its gain beats γ — that is XGBoost’s <b>pruning</b>.' }),
      h('li', { html: '<b>η</b> (learning rate) adds only a fraction of each tree.' }),
    ),
    P('On the canvas, point size shows |g| — how much each point is still pulling on the next tree.'),
  );
}

export function mathTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Logistic loss, gradient and Hessian'),
    eq('p_i = \\frac{1}{1 + e^{-\\hat y_i}}, \\qquad L_i = -y_i \\ln p_i - (1 - y_i) \\ln(1 - p_i)'),
    eq('g_i = \\frac{\\partial L_i}{\\partial \\hat y_i} = p_i - y_i, \\qquad h_i = \\frac{\\partial^2 L_i}{\\partial \\hat y_i^2} = p_i (1 - p_i)'),
    P('For squared error (regression) $g_i = \\hat y_i - y_i$ and $h_i = 1$.'),
    h('h4', {}, 'Best leaf value'),
    P('With $G = \\sum g_i$ and $H = \\sum h_i$ over the samples in a leaf, the second-order approximation of the loss is minimised by'),
    eq('w^* = -\\frac{G}{H + \\lambda}'),
    h('h4', {}, 'Gain of a split'),
    eq('\\text{Gain} = \\frac12\\left[\\frac{G_L^2}{H_L + \\lambda} + \\frac{G_R^2}{H_R + \\lambda} - \\frac{G^2}{H + \\lambda}\\right] - \\gamma'),
    P('A split is kept only if Gain > 0. The model is updated with $\\hat y_i \\leftarrow \\hat y_i + \\eta\\, w^*_{\\text{leaf}(i)}$.'),
    h('h4', {}, 'Regularised objective'),
    eq('\\mathcal{L} = \\sum_i L(y_i, \\hat y_i) + \\sum_k \\Big(\\gamma T_k + \\tfrac12 \\lambda \\lVert w_k \\rVert^2\\Big)'),
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
    card('Reproduce the slide', 'Step once and compare g, h, G, H, the gain and the leaf weights.', 'Load the example', actions.lec,
      'g = [−0.5, −0.5, 0.5, 0.5], h = 0.25 each, split x < 5 with gain 0.667, leaves +0.667 / −0.667, new probabilities 0.661 / 0.339.'),
    card('λ shrinks the leaves', 'In the slide example, drag λ from 1 to 0 and to 5.', 'Load the example', actions.lec,
      'λ = 0 gives w = ±2 (a big step); λ = 5 gives w = ±0.18. Larger λ = more cautious trees.'),
    card('γ prunes', 'On the moons, set depth 4 and raise γ.', 'Load moons', actions.moons,
      'Splits whose gain is below γ disappear from the tree diagram: the trees get smaller and the border smoother.'),
    card('Learning rate', 'On the spiral, compare η = 1 and η = 0.1 with 60 rounds.', 'Load spiral', actions.spiral,
      'A small η needs more rounds but builds a cleaner border; η = 1 jumps around and overfits quickly.'),
  );
}
