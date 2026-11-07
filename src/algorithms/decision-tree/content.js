import { h } from '../../core/ui.js';
import { eq, P } from '../../core/tex.js';
import { TENNIS } from './id3.js';

export const LECTURES = [
  {
    id: 'lec-dt-house', label: 'House price · MSE', task: 'reg',
    points: [[1000, 150], [1200, 170], [1300, 190], [1500, 210], [1700, 250], [2000, 300]].map(([x, y], i) => ({ x, y, name: 'ABCDEF'[i] })),
    fitOpts: { uniform: false, box: 0.78, boxY: 0.62, pad: { x: 150, y: 30 } },
    settings: { maxDepth: 1, stopImpurity: 600 },
    note: 'Slide example: size → price for six houses. The tree tries every midpoint and keeps the split with the lowest <b>weighted MSE</b>. Stop threshold: MSE 600.',
    queries: [900, 2500],
  },
  {
    id: 'lec-dt-tennis', label: 'Play Tennis · entropy', task: 'id3', noDraw: true,
    points: TENNIS.rows.map((r) => ({ x: 0, y: 0, name: r.name, label: r.label })),
    classNames: ['No', 'Yes'],
    note: 'Slide example: 14 days with four categorical attributes. ID3 picks the attribute with the largest <b>information gain</b> at every node.',
  },
];

export function intuitionTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'A game of 20 questions'),
    P('A decision tree predicts by asking a short series of <b>yes/no questions</b> about the input: “Is x below 0.3?”, “Is y above −0.1?” Each answer sends you down a branch until you reach a <b>leaf</b>, which holds the prediction.'),
    h('div', { class: 'callout' },
      h('strong', {}, 'Sorting a deck of cards'),
      P('To separate a mixed pile, you first ask the question that splits it most cleanly (“red or black?”), then ask a new question for each smaller pile. A tree does exactly this, always choosing the question that makes the piles the most <i>pure</i>.'),
    ),
    h('h4', {}, 'How it grows'),
    h('ol', {},
      h('li', { html: 'Start with all points in one node.' }),
      h('li', { html: 'Try every possible threshold on every feature (midpoints between neighbouring values).' }),
      h('li', { html: 'Keep the one that makes the two halves <b>purest</b> (lowest entropy / Gini for classes, lowest MSE for numbers).' }),
      h('li', { html: 'Repeat inside each half, until a stopping rule says stop (max depth, too few points, or already pure).' }),
    ),
    h('h4', {}, 'Classification vs regression'),
    h('ul', {},
      h('li', { html: '<b>Classification</b>: a leaf predicts the majority class. Borders are always <b>axis-aligned</b> — you can see the staircase on the canvas.' }),
      h('li', { html: '<b>Regression</b>: a leaf predicts the <b>average</b> of its points, so the prediction is a step function.' }),
    ),
    h('h4', {}, 'Good to know'),
    h('ul', {},
      h('li', { html: 'Easy to read as if–else rules; no feature scaling needed.' }),
      h('li', { html: 'Deep trees <b>overfit</b>: they carve a tiny box around every noisy point.' }),
      h('li', { html: 'Small data changes can give a very different tree (high variance) — which is why forests and boosting exist.' }),
    ),
  );
}

export function mathTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Entropy and information gain'),
    eq('H(S) = -\\sum_{k} p_k \\log_2 p_k'),
    eq('\\text{Gain}(S, A) = H(S) - \\sum_{v \\in \\text{values}(A)} \\frac{|S_v|}{|S|}\\, H(S_v)'),
    P('A pure node has $H = 0$; a 50/50 node has $H = 1$ bit. ID3 picks the attribute with the largest gain.'),
    h('h4', {}, 'Gini impurity'),
    eq('G(S) = 1 - \\sum_k p_k^2'),
    P('Like entropy but cheaper to compute; CART (and scikit-learn) use it by default. The two usually pick the same split.'),
    h('h4', {}, 'Regression: weighted MSE'),
    eq('\\text{MSE}(S) = \\frac{1}{|S|}\\sum_{i\\in S} (y_i - \\bar y_S)^2'),
    eq('\\text{score}(t) = \\frac{|S_L|}{|S|}\\,\\text{MSE}(S_L) + \\frac{|S_R|}{|S|}\\,\\text{MSE}(S_R)'),
    P('For a numeric feature the candidate thresholds $t$ are the midpoints between consecutive sorted values. The tree keeps the $t$ with the lowest score; each leaf predicts $\\bar y$ of its points.'),
    h('h4', {}, 'Stopping rules'),
    P('Stop splitting a node when it is pure, when the maximum depth is reached, when it holds fewer than <i>min samples</i>, or (as on the slides) when its MSE is already below a threshold.'),
    h('h4', {}, 'Cost'),
    P('Sorting each feature costs $O(n \\log n)$ per node, so building a tree is roughly $O(d\\, n \\log n \\cdot \\text{depth})$ for $d$ features.'),
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
    card('Reproduce the house example', 'Step through the size → price data and compare the weighted MSE of each threshold with the slide.', 'Load house example', actions.house,
      'The best threshold is 1600 with weighted MSE 541.7. That is below the 600 threshold, so the tree stops: ≤ 1600 → 180, otherwise 275.'),
    card('Play Tennis by hand', 'Watch ID3 split the 14 days. Which attribute wins at the root, and why?', 'Load Play Tennis', actions.tennis,
      'Outlook has the highest gain (0.247). Overcast days are all Yes, so that branch is pure immediately; Sunny splits on Humidity, Rain on Wind.'),
    card('Staircase borders', 'Load the moons and grow the tree to depth 8.', 'Load moons', actions.moons,
      'The border is built from horizontal and vertical pieces only. A diagonal or curved border needs many small steps.'),
    card('Overfitting noise', 'Load the noisy data, set depth 10 and min samples 1, then compare with depth 3.', 'Load noisy data', actions.noisy,
      'The deep tree reaches ~100% training accuracy by drawing tiny boxes around flipped labels. The shallow tree ignores the noise — it will do better on new data.'),
  );
}
