import { h } from '../../core/ui.js';
import { eq, P } from '../../core/tex.js';

const row = (names, labels = null, y = 0.1) => names.map((name, i) => ({ x: names.length === 1 ? 0 : -0.86 + (1.72 * i) / (names.length - 1), y, name, label: labels ? labels[i] : 5 }));

export const LECTURES = [
  {
    id: 'lec-cv-k', label: 'K-fold · 15 points', method: 'kfold', task: 'cls', noDraw: true, script: true,
    points: row(Array.from({ length: 15 }, (_, i) => String(i + 1))),
    folds: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2], K: 3,
    note: 'Slide example: 15 points, K = 3 → Fold 1 = points 1–5, Fold 2 = 6–10, Fold 3 = 11–15. Each round tests on one fold and trains on the other two.',
  },
  {
    id: 'lec-cv-loo', label: 'LOOCV · A–E', method: 'loocv', task: 'cls', noDraw: true, script: true,
    points: row(['A', 'B', 'C', 'D', 'E']),
    folds: [0, 1, 2, 3, 4], K: 5,
    note: 'Slide example: 5 points → 5 rounds, each one leaves exactly one point out for testing.',
  },
  {
    id: 'lec-cv-strat', label: 'Stratified · 9 : 3', method: 'stratified', task: 'cls', noDraw: true, script: true,
    // 9 samples of class 1 (teal) then 3 of class 2 (terracotta)
    points: row(Array.from({ length: 12 }, (_, i) => String(i + 1)), [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0]),
    folds: [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2], plainFolds: [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2], K: 3,
    classNames: ['Class 2', 'Class 1'],
    note: 'Slide example: 9 samples of Class 1 and 3 of Class 2 (ratio 3 : 1), K = 3. Stratified folds keep 3 : 1 in every fold.',
  },
];

export function intuitionTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Don’t grade your own homework'),
    P('A model is always better on the data it trained on. To know how it will do on <b>new</b> data, we must test it on points it has never seen. Cross-validation does this several times so the answer doesn’t depend on one lucky (or unlucky) split.'),
    h('div', { class: 'callout' },
      h('strong', {}, 'Several mini-exams instead of one'),
      P('One exam can be unusually easy or hard. Averaging several exams, each on different questions, gives a fairer grade — and the spread of the grades tells you how much to trust it.'),
    ),
    h('h4', {}, 'The four methods'),
    h('ul', {},
      h('li', { html: '<b>Holdout</b>: one split (e.g. 80% train / 20% test). Fast, but the score depends on which points landed in the test set — press “Repeat 40×” to see how much it jumps.' }),
      h('li', { html: '<b>K-fold</b>: split into K folds; every fold is the test set once. Report the mean (and spread) of the K scores.' }),
      h('li', { html: '<b>LOOCV</b>: K = n. Every single point is tested alone. Uses the most training data, but trains n models.' }),
      h('li', { html: '<b>Stratified K-fold</b>: like K-fold, but every fold keeps the class proportions — important for imbalanced data.' }),
    ),
    P('On the canvas, the coloured rings show which fold each point belongs to. The current test fold is drawn big with a dark ring; the background is the model trained on the other folds.'),
  );
}

export function mathTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'K-fold estimate'),
    eq('\\text{CV}_K = \\frac{1}{K} \\sum_{k=1}^{K} \\text{score}\\big(f^{(-k)},\\ \\text{fold}_k\\big)'),
    P('$f^{(-k)}$ is the model trained on every fold except fold $k$.'),
    h('h4', {}, 'Spread'),
    eq('s = \\sqrt{\\frac{1}{K-1}\\sum_{k}\\big(\\text{score}_k - \\text{CV}_K\\big)^2}'),
    P('Report “mean ± s”. A large $s$ means the estimate depends a lot on the split.'),
    h('h4', {}, 'Cost'),
    P('Holdout trains 1 model, K-fold trains $K$, LOOCV trains $n$. Each training set has $n(K-1)/K$ points, so larger $K$ = less pessimistic estimate, but more computation.'),
    h('h4', {}, 'Stratification'),
    P('With class proportions $\\pi_c$, a stratified fold of size $n/K$ contains about $\\pi_c\\, n / K$ samples of every class $c$.'),
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
    card('How lucky is one split?', 'Holdout on the noisy data, then press “Repeat 40×”.', 'Repeat holdout', actions.repeat,
      'The 40 holdout scores spread over 10–20 percentage points. A single holdout number can be quite misleading on small data.'),
    card('Stratify the imbalanced data', 'Compare plain K-fold and stratified K-fold on the imbalanced dataset (look at the fold table).', 'Load imbalanced', actions.imbal,
      'Plain folds can get very different numbers of the small class; stratified folds all get about the same.'),
    card('Choose k for k-NN honestly', 'With 5-fold CV, try k = 1, 5 and 25.', 'Load moons', actions.knn,
      'k = 1 is 100% on training data but not on held-out folds. CV picks the k that generalises, not the one that memorises.'),
    card('LOOCV', 'Run LOOCV on a small dataset (30 points).', 'Run LOOCV', actions.loo,
      'Every round tests a single point, so each score is 0% or 100%; only the average is meaningful.'),
  );
}
