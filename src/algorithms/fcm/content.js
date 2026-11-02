import { h } from '../../core/ui.js';
import { eq, P } from '../../core/tex.js';

export const LECTURES = [
  {
    id: 'lec-f1', label: '1D: x = 1, 2, 7, 8',
    dim: 1,
    points: [{ x: 1, y: 0, name: 'x1' }, { x: 2, y: 0, name: 'x2' }, { x: 7, y: 0, name: 'x3' }, { x: 8, y: 0, name: 'x4' }],
    U0: [[0.6, 0.4], [0.7, 0.3], [0.3, 0.7], [0.2, 0.8]],
    c: 2, m: 2,
    minSpan: 7,
    note: 'Slide example: four 1D points, c = 2, m = 2 and the given U⁽⁰⁾. First step should give c₁ ≈ 2.34 and c₂ ≈ 6.44.',
  },
  {
    id: 'lec-f2', label: '2D: three points',
    points: [{ x: 1, y: 2, name: 'x1' }, { x: 5, y: 4, name: 'x2' }, { x: 4, y: 3, name: 'x3' }],
    U0: [[0.7, 0.3], [0.2, 0.8], [0.4, 0.6]],
    c: 2, m: 2,
    note: 'Slide example: three 2D points with the given U⁽⁰⁾. Expect c₁ ≈ (1.93, 2.35), c₂ ≈ (4.34, 3.50) and u₁₁ ≈ 0.93.',
  },
];

export function intuitionTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Hard vs soft clustering'),
    P('K-Means is <b>hard</b>: every point belongs to exactly one cluster (membership 0 or 1). Fuzzy C-Means is <b>soft</b>: a point can be 70% in one cluster and 30% in another.'),
    h('div', { class: 'callout' },
      h('strong', {}, 'Paint mixing analogy'),
      P('Each cluster is a paint color. A point near the middle of a cluster gets almost pure color. A point between two clusters becomes a mix — exactly what you see on the canvas.'),
    ),
    h('h4', {}, 'The steps'),
    h('ol', {},
      h('li', { html: 'Choose the number of clusters <b>c</b> and the fuzziness <b>m</b> (> 1).' }),
      h('li', { html: 'Start with a guess: the membership table <b>U</b> (each row sums to 1).' }),
      h('li', { html: '<b>Centroids</b>: weighted averages of all points, where strong members count more.' }),
      h('li', { html: '<b>Memberships</b>: each point gets more membership in nearby centroids.' }),
      h('li', { html: 'Repeat until the memberships stop changing much.' }),
    ),
    h('h4', {}, 'The fuzziness m'),
    h('ul', {},
      h('li', { html: '<b>m close to 1</b> → almost hard, behaves like K-Means.' }),
      h('li', { html: '<b>m = 2</b> → the usual choice.' }),
      h('li', { html: '<b>Large m</b> → everything blurs towards equal membership.' }),
    ),
    h('h4', {}, 'Good to know'),
    h('ul', {},
      h('li', { html: 'Great when groups overlap or change gradually (image pixels, medical data, customer behaviour).' }),
      h('li', { html: 'Still needs c and m chosen by you, and is still sensitive to outliers.' }),
      h('li', { html: 'More work per round than K-Means: every point updates every membership.' }),
    ),
  );
}

export function mathTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Objective'),
    P('FCM minimises the weighted spread, with the constraint $\\sum_j u_{ij} = 1$ for every point:'),
    eq('J_m = \\sum_{i=1}^{N}\\sum_{j=1}^{c} u_{ij}^{\\,m}\\, \\lVert x_i - c_j \\rVert^2'),
    h('h4', {}, 'Centroid update'),
    eq('c_j = \\frac{\\sum_{i=1}^{N} u_{ij}^{\\,m}\\, x_i}{\\sum_{i=1}^{N} u_{ij}^{\\,m}}'),
    P('Points with higher membership pull the centroid harder. With $m = 2$ the weights are the squared memberships.'),
    h('h4', {}, 'Membership update'),
    eq('u_{ij} = \\frac{1}{\\displaystyle\\sum_{k=1}^{c} \\left( \\frac{\\lVert x_i - c_j \\rVert}{\\lVert x_i - c_k \\rVert} \\right)^{\\frac{2}{m-1}}}'),
    P('For two clusters and $m = 2$ this becomes $u_{i1} = \\dfrac{1}{1 + (d_{i1}/d_{i2})^2}$. If a point sits exactly on a centroid, it gets membership 1 there and 0 elsewhere.'),
    h('h4', {}, 'Stopping'),
    P('Stop when the biggest change in any membership is below a small tolerance $\\varepsilon$:'),
    eq('\\max_{i,j} \\left| u_{ij}^{(t+1)} - u_{ij}^{(t)} \\right| < \\varepsilon'),
    h('h4', {}, 'Link to K-Means'),
    P('As $m \\to 1^+$ the exponent $\\frac{2}{m-1}$ explodes, so the nearest centroid takes all the membership. FCM turns into K-Means.'),
  );
}

export function challengesTab(actions) {
  const card = (emoji, title, text, label, fn, answer) => h('div', { class: 'challenge' },
    h('div', { class: 'challenge-head' }, h('span', { class: 'challenge-emoji' }, emoji), h('strong', {}, title)),
    h('p', { html: text }),
    label ? h('button', { type: 'button', class: 'btn btn-primary', onclick: fn }, label) : null,
    answer ? h('details', {}, h('summary', {}, 'What should I notice?'), h('p', { html: answer })) : null,
  );
  return h('div', { class: 'learn' },
    card('', 'Reproduce the slides', 'Load the 1D example and step once to compute the centroids, then once more for memberships.', 'Load 1D example', actions.lec1,
      'c₁ ≈ 2.34, c₂ ≈ 6.44, then x₁ = 1 gets u₁₁ ≈ 0.94 and u₁₂ ≈ 0.06.'),
    card('', 'Overlapping groups', 'Load overlapping blobs with c = 3 and press play. Hover the points in the middle.', 'Load overlap', actions.overlap,
      'Points between groups get split memberships like 0.5 / 0.4 / 0.1 and look like a color blend. K-Means would force each one into a single group.'),
    card('', 'Turn the fuzziness dial', 'After it converges, drag <b>m</b> from 1.1 to 4 and press play again.', 'Load blobs', actions.blobs,
      'Small m makes crisp colors and sharp regions (like K-Means). Large m washes everything out — memberships drift towards 1/c.'),
    card('', 'Drag a centroid', 'Grab a ★ and move it around. The background shows the membership field live.', null, null,
      'Every spot on the canvas has a membership for every centroid. The color is the mix; the brightness shows how sure the membership is.'),
  );
}
