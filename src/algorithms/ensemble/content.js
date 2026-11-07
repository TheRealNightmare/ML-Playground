import { h } from '../../core/ui.js';
import { eq, P } from '../../core/tex.js';

const row = (names, y = 0, extra = () => ({})) => names.map((name, i) => ({ x: names.length === 1 ? 0 : -0.84 + (1.68 * i) / (names.length - 1), y, name, label: 0, ...extra(i) }));

/* Each lecture is a scripted walk-through; `steps[k]` describes what to show after k+1 presses of Step. */
export const LECTURES = [
  {
    id: 'lec-ens-bag', label: 'Bagging · 12 examples', mode: 'bagging', task: 'cls', noDraw: true, script: true,
    points: row(Array.from({ length: 12 }, (_, i) => String(i + 1)), 0.08),
    subsets: [[3, 7, 7, 1, 12], [5, 5, 10, 3, 9], [8, 2, 2, 12, 6]],
    votes: ['Good', 'Bad', 'Good'],
    note: 'Slide example: 12 training examples, 3 subsets of size 5 drawn <b>with replacement</b>, one tree per subset, majority vote.',
  },
  {
    id: 'lec-ens-boost', label: 'Boosting · A–F', mode: 'boosting', task: 'cls', noDraw: true, script: true,
    points: row(['A', 'B', 'C', 'D', 'E', 'F'], 0.08),
    rounds: [{ wrong: ['D', 'E'] }, { wrong: ['C'] }, { wrong: [] }],
    votes: ['Good', 'Good', 'Bad'],
    note: 'Slide example: six examples. Each new model gives more importance to the examples the previous ones got wrong.',
  },
  {
    id: 'lec-ens-stack', label: 'Stacking · 3 models', mode: 'stacking', task: 'cls', noDraw: true, script: true,
    points: [
      { x: -0.6, y: 0.42, name: 'Tree', label: 1 },
      { x: 0, y: 0.42, name: 'Logistic', label: 1 },
      { x: 0.6, y: 0.42, name: 'k-NN', label: 0 },
      { x: 0, y: -0.42, name: 'Meta-model', label: 1 },
    ],
    note: 'Slide example: three different base models give their predictions; a <b>meta-model</b> learns how much to trust each one.',
  },
];

export function intuitionTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Why models make mistakes'),
    h('ul', {},
      h('li', { html: '<b>Bias</b>: the model is too simple — it misses the pattern <i>every time</i> (underfitting). Darts that land together but off-centre.' }),
      h('li', { html: '<b>Variance</b>: the model is too jumpy — change the training data a little and its answer changes a lot (overfitting). Darts scattered all over.' }),
    ),
    P('We want low bias <i>and</i> low variance. Making a single model more complex lowers bias but raises variance — the <b>trade-off</b>. Ensembles cheat the trade-off by combining many models.'),
    h('div', { class: 'callout' },
      h('strong', {}, 'Ten students, one exam'),
      P('One student may get a question wrong. If ten students answer and you take the majority, the class is right much more often — as long as they don’t all make the <i>same</i> mistakes.'),
    ),
    h('h4', {}, 'Three ways to combine'),
    h('ul', {},
      h('li', { html: '<b>Bagging</b>: many models trained <i>independently</i> on bootstrap samples, then vote/average. Mainly cuts <b>variance</b>. (Random Forest = bagging + random features.)' }),
      h('li', { html: '<b>Boosting</b>: models trained <i>one after another</i>, each focusing on the previous mistakes. Mainly cuts <b>bias</b>. (AdaBoost, XGBoost, CatBoost.)' }),
      h('li', { html: '<b>Stacking</b>: <i>different kinds</i> of models; a meta-model learns how to weigh their predictions.' }),
    ),
  );
}

export function mathTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Bias–variance decomposition'),
    P('For squared error at a point $x$, averaged over many possible training sets:'),
    eq('\\mathbb{E}\\big[(y - \\hat f(x))^2\\big] = \\underbrace{\\big(f(x) - \\mathbb{E}\\hat f(x)\\big)^2}_{\\text{bias}^2} + \\underbrace{\\mathbb{E}\\big[(\\hat f(x) - \\mathbb{E}\\hat f(x))^2\\big]}_{\\text{variance}} + \\sigma^2'),
    P('The playground estimates the first two terms by refitting the model on many fresh samples. $\\sigma^2$ is the noise nobody can remove.'),
    h('h4', {}, 'Bagging'),
    eq('\\hat f_{\\text{bag}}(x) = \\frac{1}{B}\\sum_{b=1}^{B} \\hat f_b(x)'),
    P('Averaging $B$ models with variance $\\sigma^2$ and correlation $\\rho$ gives variance $\\rho\\sigma^2 + (1-\\rho)\\sigma^2/B$.'),
    h('h4', {}, 'Boosting (gradient form)'),
    eq('F_m(x) = F_{m-1}(x) + \\eta\\, h_m(x), \\qquad h_m \\approx \\text{residuals } y - F_{m-1}(x)'),
    P('Each small model $h_m$ fits what the ensemble still gets wrong; the learning rate $\\eta$ takes only part of each correction.'),
    h('h4', {}, 'Stacking'),
    eq('\\hat y = g\\big(f_1(x), f_2(x), \\dots, f_K(x)\\big)'),
    P('The meta-model $g$ (here logistic regression) is trained on <b>out-of-fold</b> predictions, so it learns how the base models behave on data they have not seen.'),
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
    card('Find the sweet spot', 'In Bias & variance mode, slide the tree depth from 1 to 10.', 'Open bias–variance', actions.bv,
      'Depth 1–2: the fits agree with each other but miss the wave (high bias). Depth 8+: they follow the noise and disagree wildly (high variance). Total error is lowest in between.'),
    card('Bagging kills variance', 'Set depth 10, then switch on “bag 15 trees”.', 'Deep trees + bagging', actions.bag,
      'Bias barely moves, but variance drops a lot — the dartboard shrinks around the same spot.'),
    card('Boosting kills bias', 'Boost depth-1 stumps on the sine data with η = 0.3.', 'Boost stumps', actions.boost,
      'One stump is a single step (high bias). Each round fits the residuals, and the staircase bends into the wave.'),
    card('Stacking', 'Train the three base models and the meta-model on the moons.', 'Stack on moons', actions.stack,
      'The meta-model gives more weight to the base model that is most accurate out-of-fold, and its border borrows from each.'),
  );
}
