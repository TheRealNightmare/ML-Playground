import { h } from '../../core/ui.js';
import { eq, P } from '../../core/tex.js';

/* Slide example: four samples, predictions of the three learners exactly as given on the slides. */
export const LECTURES = [
  {
    id: 'lec-ada', label: 'Hours · 3 learners', task: 'cls1d', noDraw: true,
    points: [[2, 1], [4, 1], [6, 0], [8, 0]].map(([x, c], i) => ({ x, y: c, label: c, name: `S${i + 1}` })),
    fitOpts: { uniform: false, box: 0.8, boxY: 0.55, pad: { x: 1.5, y: 0.3 } },
    classNames: ['No', 'Yes'],
    learners: [
      { preds: [1, 1, 1, 0], rule: 'hours < 7 → Yes', cuts: [7], left: 1 },
      { preds: [1, 0, 0, 0], rule: 'hours < 3 → Yes', cuts: [3], left: 1 },
      { preds: [0, 1, 0, 0], rule: 'Yes only for 3 < hours < 5', cuts: [3, 5], left: 0 },
    ],
    newSample: [1, 1, -1],
    note: 'Slide example: four students, hours studied → pass (Yes/No). The slide <i>gives</i> each learner’s predictions; we follow them exactly and compute ε, α and the new weights.',
  },
];

export function intuitionTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'A team of weak specialists'),
    P('A <b>decision stump</b> is a tree with a single question — barely better than guessing. AdaBoost trains stumps <b>one after another</b>. After each one, the points it got wrong become <b>heavier</b> (bigger on the canvas), so the next stump is forced to pay attention to them.'),
    h('div', { class: 'callout' },
      h('strong', {}, 'Studying for an exam'),
      P('After a practice test, you spend more time on the questions you got wrong. Each round of practice focuses on your current weak spots. That is exactly how AdaBoost re-weights the data.'),
    ),
    h('h4', {}, 'Who gets a bigger vote?'),
    P('Each stump gets a weight $\\alpha$ based on its <b>weighted error</b> $\\varepsilon$: an accurate stump ($\\varepsilon$ small) speaks loudly, a coin-flip stump ($\\varepsilon = 0.5$) gets $\\alpha = 0$. The final answer is the sign of the weighted vote.'),
    h('h4', {}, 'Watch out'),
    h('ul', {},
      h('li', { html: 'Mislabelled points keep getting heavier — AdaBoost is <b>sensitive to noise and outliers</b>.' }),
      h('li', { html: 'Training is sequential: stump t needs the weights from stump t − 1.' }),
    ),
  );
}

export function mathTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Algorithm (labels y ∈ {−1, +1})'),
    P('Start with equal weights $w_i = 1/n$. For $t = 1 \\dots T$:'),
    eq('\\varepsilon_t = \\sum_{i:\\,h_t(x_i) \\ne y_i} w_i'),
    eq('\\alpha_t = \\tfrac12 \\ln\\frac{1 - \\varepsilon_t}{\\varepsilon_t}'),
    eq('w_i \\leftarrow w_i\\, e^{-\\alpha_t\\, y_i\\, h_t(x_i)}, \\qquad w_i \\leftarrow \\frac{w_i}{\\sum_j w_j}'),
    P('Correct points are multiplied by $e^{-\\alpha}$ (shrink), wrong points by $e^{+\\alpha}$ (grow).'),
    h('h4', {}, 'Final classifier'),
    eq('H(x) = \\operatorname{sign}\\Big(\\sum_{t=1}^{T} \\alpha_t\\, h_t(x)\\Big)'),
    h('h4', {}, 'A neat fact'),
    P('After normalising, the misclassified points always carry exactly half of the total weight — so the next stump can never just repeat the last one.'),
    h('h4', {}, 'Where it comes from'),
    P('AdaBoost is gradient boosting with the <b>exponential loss</b> $L = e^{-y F(x)}$; $\\alpha_t$ is the exact line-search step for that loss.'),
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
    card('Reproduce the slide', 'Step through the three learners and check ε, α and the weights.', 'Load the example', actions.lec,
      'α = 0.549, 0.805, 1.099; weights [.167, .167, .5, .167] then [.10, .50, .30, .10]; the new sample scores 0.255 → +1.'),
    card('Stumps make a staircase', 'Run 50 rounds on the circles.', 'Load circles', actions.circles,
      'Each stump is a single straight cut, yet their weighted sum carves out a round region.'),
    card('Noise gets heavy', 'Run 60 rounds on the noisy data and look at the point sizes.', 'Load noisy data', actions.noisy,
      'The flipped labels become the biggest points: AdaBoost keeps chasing them. That is why it is sensitive to label noise.'),
    card('The half-weight rule', 'After any step, add up the weights of the wrong points (worked card, ≤ 12 points).', 'Load 10 points', actions.small,
      'After normalising, the points the last stump got wrong always hold exactly 50% of the weight.'),
  );
}
