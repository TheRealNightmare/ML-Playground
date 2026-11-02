import { h } from '../../core/ui.js';
import { eq, P } from '../../core/tex.js';

export const LECTURES = [
  {
    id: 'lec-d1', label: 'Points A–J · ε = 1.5',
    points: [
      { x: 1, y: 1, name: 'A' }, { x: 1, y: 2, name: 'B' }, { x: 2, y: 2, name: 'C' }, { x: 2, y: 3, name: 'D' },
      { x: 8, y: 7, name: 'E' }, { x: 8, y: 8, name: 'F' }, { x: 9, y: 8, name: 'G' }, { x: 9.7, y: 8, name: 'H' },
      { x: 25, y: 80, name: 'I' }, { x: 23, y: 79, name: 'J' },
    ],
    fit: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    eps: 1.5, minPts: 3,
    note: 'Slide example: ε = 1.5, minPts = 3 (counting the point itself). I and J are far away at (25, 80) and (23, 79), so they’re pinned to the edge.',
  },
];

export function intuitionTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'What is DBSCAN?'),
    P('<b>D</b>ensity-<b>B</b>ased <b>S</b>patial <b>C</b>lustering of <b>A</b>pplications with <b>N</b>oise. It finds clusters as <b>crowded areas</b> separated by emptier space, and marks lonely points as <b>noise</b>. You don’t choose the number of clusters.'),
    h('div', { class: 'callout' },
      h('strong', {}, '🎉 Party analogy'),
      P('Everyone has an arm’s length (ε). If you can reach at least minPts people (yourself included), you’re a <b>core</b> guest at the centre of a party. Anyone a core guest can reach joins that party — if they can’t reach enough people themselves, they’re on the <b>border</b>. People nobody reaches are standing alone: <b>noise</b>.'),
    ),
    h('h4', {}, 'Two settings'),
    h('ul', {},
      h('li', { html: '<b>ε (epsilon)</b> — the radius of the neighbourhood circle.' }),
      h('li', { html: '<b>minPts</b> — how many points (including itself) must be inside that circle for a point to be <b>core</b>.' }),
    ),
    h('h4', {}, 'Three kinds of points'),
    h('ul', {},
      h('li', { html: '<b>Core</b> (big, colored): at least minPts points within ε.' }),
      h('li', { html: '<b>Border</b> (small, colored): not core, but inside a core point’s circle.' }),
      h('li', { html: '<b>Noise</b> (hollow): neither.' }),
    ),
    h('h4', {}, 'The steps'),
    h('ol', {},
      h('li', { html: 'Pick an unvisited point and count its ε-neighbours.' }),
      h('li', { html: 'If it’s core, start a new cluster and add its neighbours.' }),
      h('li', { html: 'Expand: every neighbour that is also core adds <i>its</i> neighbours too.' }),
      h('li', { html: 'Points reached but not core become border points.' }),
      h('li', { html: 'Points never reached stay noise. Repeat until every point is visited.' }),
    ),
    h('h4', {}, 'DBSCAN vs K-Means'),
    h('ul', {},
      h('li', { html: 'Finds any shape (moons, rings), not just round blobs.' }),
      h('li', { html: 'No K to choose, and outliers are labelled instead of forced into a cluster.' }),
      h('li', { html: 'But one ε for the whole map: clusters with very different densities are hard. That’s what HDBSCAN fixes.' }),
    ),
  );
}

export function mathTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'ε-neighbourhood'),
    eq('N_\\varepsilon(p) = \\{\\, q \\in D : d(p, q) \\le \\varepsilon \\,\\}'),
    P('It includes $p$ itself, so $|N_\\varepsilon(p)| \\ge 1$.'),
    h('h4', {}, 'Point types'),
    eq('p \\text{ is core} \\iff |N_\\varepsilon(p)| \\ge \\text{minPts}'),
    P('$q$ is <b>directly density-reachable</b> from $p$ if $p$ is core and $q \\in N_\\varepsilon(p)$. A chain of such steps makes $q$ <b>density-reachable</b>. A cluster is everything density-reachable from one core point.'),
    h('h4', {}, 'Choosing ε: the k-distance plot'),
    P('For every point, measure the distance to its $k$-th nearest neighbour ($k = \\text{minPts} - 1$) and sort them. Inside clusters these are small; for noise they shoot up. A good ε sits at the <b>knee</b> of the curve — shown live in the chart above.'),
    h('h4', {}, 'Cost'),
    P('Each point needs one neighbourhood query. With the simple scan used here that’s $O(n^2)$; with a spatial index (k-d tree, grid) it is close to $O(n \\log n)$.'),
    h('h4', {}, 'Determinism'),
    P('Core points and noise never depend on the visiting order. A border point within reach of two clusters joins whichever reaches it first.'),
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
    card('📝', 'Reproduce the slides', 'Load points A–J and step through one point at a time. Watch the distance table.', 'Load slide example', actions.lec,
      'A, B, C, D are core → cluster 1. E, F, G are core → cluster 2, and H joins as a border point (only 2 neighbours). I and J are noise.'),
    card('🌙', 'Moons + noise', 'Load moons with noise and run to the end.', 'Load moons', actions.moons,
      'DBSCAN follows the curves and finds both moons, and the scattered points become noise. K-Means can do neither.'),
    card('🎚️', 'Too small, too big', 'After it finishes, slide ε down slowly, then up.', 'Load noisy blobs', actions.noisy,
      'Small ε: almost everything becomes noise. Large ε: separate clusters melt into one. The k-distance chart’s knee shows a sensible ε.'),
    card('🌗', 'Different densities', 'Load clusters with very different densities. Try to find one ε that works for all three.', 'Load densities', actions.density,
      'You can’t: an ε that captures the loose cluster merges or swallows noise, and one tuned for the tight cluster turns the loose one into noise. HDBSCAN solves this.'),
  );
}
