import { h } from '../../core/ui.js';
import { eq, P } from '../../core/tex.js';

const HOUSES = [['A', 950, 160, 0], ['B', 1200, 205, 1], ['C', 1450, 255, 1], ['D', 1700, 320, 1], ['E', 2000, 380, 1]];
const BOOTS = [['A', 'B', 'C', 'E', 'E'], ['B', 'C', 'D', 'E', 'A'], ['C', 'D', 'D', 'B', 'E']];

export const LECTURES = [
  {
    id: 'lec-rf-reg', label: 'Price · 3 trees', task: 'reg',
    points: HOUSES.map(([name, x, y]) => ({ x, y, name })),
    fitOpts: { uniform: false, box: 0.8, boxY: 0.62, pad: { x: 160, y: 40 } },
    boots: BOOTS, maxDepth: 1, queries: [1280, 1460], featName: 'size',
    note: 'Slide example: five houses, three trees, each trained on the bootstrap sample listed on the slide. Each tree makes one split; the forest <b>averages</b> them.',
  },
  {
    id: 'lec-rf-cls', label: 'fast_sale · 3 trees', task: 'cls1d', noDraw: false,
    points: HOUSES.map(([name, x, , c]) => ({ x, y: c, label: c, name })),
    fitOpts: { uniform: false, box: 0.8, boxY: 0.55, pad: { x: 520, y: 0.25 } },
    classNames: ['No', 'Yes'],
    boots: BOOTS, maxDepth: 1, queries: [460, 1280], featName: 'size',
    note: 'Slide example: is the house a <b>fast sale</b>? Same three bootstraps; the forest takes a <b>majority vote</b>. The y-axis shows the class (0 = No, 1 = Yes) and the vote share for Yes.',
  },
];

export function intuitionTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Ask a crowd, not one expert'),
    P('One deep decision tree memorises its training data: move a single point and the whole tree can change. A <b>random forest</b> trains many trees, each on a slightly different version of the data, and lets them <b>vote</b> (classification) or <b>average</b> (regression).'),
    h('div', { class: 'callout' },
      h('strong', {}, 'Guess the number of sweets in a jar'),
      P('Individual guesses are all over the place, but the average of a hundred guesses is usually close. Errors that point in different directions cancel out. That only works if the guessers are <i>different</i> — which is why each tree gets its own random data and features.'),
    ),
    h('h4', {}, 'Two sources of randomness'),
    h('ol', {},
      h('li', { html: '<b>Bootstrap sampling</b>: each tree gets n points drawn <i>with replacement</i>. Some points appear twice (bigger dots), about a third not at all (hollow rings — the <b>out-of-bag</b> points).' }),
      h('li', { html: '<b>Feature randomness</b>: at every split a tree only looks at a random subset of the features, so the trees don’t all ask the same first question.' }),
    ),
    h('h4', {}, 'Free test set: out-of-bag error'),
    P('Every point is left out by roughly a third of the trees. Asking only those trees about it gives an honest, test-like error — without a separate test set.'),
    h('h4', {}, 'What to watch'),
    h('ul', {},
      h('li', { html: 'A single tree has jagged, overconfident borders. The forest’s border is smoother and its colours fade where trees disagree.' }),
      h('li', { html: 'Adding trees never makes the forest overfit more — the OOB curve flattens out.' }),
    ),
  );
}

export function mathTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Aggregation'),
    eq('\\hat y_{\\text{reg}}(x) = \\frac{1}{T}\\sum_{t=1}^{T} f_t(x) \\qquad \\hat y_{\\text{cls}}(x) = \\operatorname{mode}\\{f_1(x),\\dots,f_T(x)\\}'),
    h('h4', {}, 'Why averaging helps'),
    P('If each tree has variance $\\sigma^2$ and any two trees are correlated by $\\rho$, the variance of their average is'),
    eq('\\operatorname{Var}\\Big(\\tfrac{1}{T}\\sum_t f_t\\Big) = \\rho\\,\\sigma^2 + \\frac{1-\\rho}{T}\\,\\sigma^2'),
    P('More trees shrink the second term; random features and bootstraps shrink $\\rho$. Bias stays about the same as one tree.'),
    h('h4', {}, 'Out-of-bag probability'),
    P('The chance a given point is never picked in $n$ draws with replacement is'),
    eq('\\Big(1 - \\frac{1}{n}\\Big)^n \\;\\to\\; e^{-1} \\approx 0.368'),
    P('so about 36.8% of the points are out-of-bag for each tree.'),
    h('h4', {}, 'Feature subset'),
    P('A common default is $m = \\sqrt{d}$ features per split for classification and $d/3$ for regression.'),
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
    card('Reproduce the regression slide', 'Step through the three bootstrap trees and read the prediction for sizes 1280 and 1460.', 'Load price example', actions.reg,
      'Correctly computed, all three trees put both 1280 and 1460 on their left side, so both predictions are 214.44. The slide’s 198.61 and 243.34 come from slips in trees 1 and 3 (see the 📌 notes).'),
    card('Reproduce the classification slide', 'Step through the votes for a house of size 460 and 1280.', 'Load fast_sale example', actions.cls,
      'Trees 1 and 2 both contain house A (No), so both learn “small → No”. 460 gets two No votes → No.'),
    card('One tree vs a forest', 'Load the noisy data, set the forest to 1 tree, then to 40.', 'Load noisy data', actions.noisy,
      'One tree draws tiny boxes around flipped labels. Forty trees vote those boxes away, and the OOB accuracy goes up.'),
    card('Out-of-bag points', 'Click any tree thumbnail. Hollow points were not in that tree’s bootstrap.', 'Load blobs', actions.blobs,
      'Roughly a third of the points are hollow for every tree — they are that tree’s private test set.'),
  );
}
