import { h } from '../../core/ui.js';
import { eq, P } from '../../core/tex.js';

export const LECTURES = [
  {
    id: 'lec-hd1', label: 'Points A–F · k = 2',
    points: [{ x: 1, y: 2, name: 'A' }, { x: 2, y: 2, name: 'B' }, { x: 2, y: 3, name: 'C' }, { x: 7, y: 8, name: 'D' }, { x: 8, y: 7, name: 'E' }, { x: 25, y: 80, name: 'F' }],
    fit: ['A', 'B', 'C', 'D', 'E'],
    k: 2, mcs: 2, eps: 7.0, allowSingle: true,
    note: 'Slide example: k = 2 (core distance = 2nd nearest neighbour), min cluster size = 2, threshold ε = 7.0. F is far away at (25, 80).',
  },
];

export function intuitionTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Why HDBSCAN?'),
    P('DBSCAN uses <b>one</b> ε for the whole map. If one cluster is tight and another is loose, no single ε works. HDBSCAN effectively tries <b>every</b> ε and keeps the clusters that survive the longest.'),
    h('div', { class: 'callout' },
      h('strong', {}, 'Island analogy'),
      P('Think of density as a landscape and imagine the sea level slowly rising. Low areas flood first; dense areas stay above water as islands. Some islands split into smaller ones as the water rises. HDBSCAN keeps the islands that stay dry for the longest stretch of sea levels — the most <b>stable</b> ones.'),
    ),
    h('h4', {}, 'The six steps'),
    h('ol', {},
      h('li', { html: '<b>Distances</b> between all points.' }),
      h('li', { html: '<b>Core distance</b> of each point: distance to its k-th nearest neighbour. Small = dense area.' }),
      h('li', { html: '<b>Mutual reachability</b>: stretch distances so sparse points look farther away.' }),
      h('li', { html: '<b>Minimum spanning tree</b>: connect everything using the shortest possible links.' }),
      h('li', { html: '<b>Condense</b> the tree: remove links from longest to shortest and track which groups appear and fall apart.' }),
      h('li', { html: '<b>Extract</b> the most stable clusters. Everything else is noise.' }),
    ),
    h('h4', {}, 'Slides vs the real thing'),
    P('The lecture extracts clusters by cutting the tree at one threshold (remove edges longer than ε). That’s easy to follow by hand, but it’s really DBSCAN again. The real HDBSCAN uses <b>stability</b> over all thresholds. Switch between both with “Cluster extraction”.'),
    h('h4', {}, 'Good to know'),
    h('ul', {},
      h('li', { html: 'Finds clusters of different densities and shapes.' }),
      h('li', { html: 'Mainly one setting: <b>min cluster size</b>. k (min samples) controls how conservative it is about noise.' }),
      h('li', { html: 'Scale-invariant in its results: multiply all data by 2 and you get the same clusters.' }),
    ),
  );
}

export function mathTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Core distance'),
    eq('\\text{core}_k(p) = d\\big(p,\\ k\\text{-th nearest neighbour of } p\\big)'),
    P('On the slides $k$ excludes the point itself. (Libraries such as scikit-learn count the point itself in <code>min_samples</code>, so their $k$ is one larger.)'),
    h('h4', {}, 'Mutual reachability distance'),
    eq('d_{\\text{mreach}}(p, q) = \\max\\{\\, \\text{core}_k(p),\\ \\text{core}_k(q),\\ d(p, q) \\,\\}'),
    P('Dense points keep their real distances; sparse points get pushed away from everything. This makes noise easy to cut off.'),
    h('h4', {}, 'Minimum spanning tree'),
    P('Treat points as nodes and $d_{\\text{mreach}}$ as edge weights. The MST connects all $n$ points with $n-1$ edges of minimum total weight (Prim or Kruskal).'),
    h('h4', {}, 'Condensed tree'),
    P('Remove MST edges from longest to shortest. Use $\\lambda = 1/\\text{distance}$. When a cluster splits, a side smaller than <i>min cluster size</i> just counts as points “falling out”; if both sides are big enough, two new clusters are born.'),
    h('h4', {}, 'Stability'),
    eq('\\text{stability}(C) = \\sum_{p \\in C} \\big(\\lambda_p - \\lambda_{\\text{birth}}(C)\\big)'),
    P('$\\lambda_p$ is when point $p$ leaves $C$. Long-lived, crowded clusters score high.'),
    h('h4', {}, 'Selecting clusters (excess of mass)'),
    P('Walk up from the leaves. If a cluster’s stability beats the sum of its children’s, keep it and drop the children; otherwise keep the children. The root is only allowed when “allow single cluster” is on.'),
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
    card('', 'Reproduce the slides', 'Load A–F and step through: core distances, mutual reachability, MST, then the threshold cut.', 'Load slide example', actions.lec,
      'Core distances 1.41, 1, 1.41, 7.07, 7.21, 74.95. MST edges A–B, B–C, C–D, D–E, D–F. Cutting at ε = 7 leaves (A, B, C) as the only cluster.'),
    card('', 'Where DBSCAN fails', 'Load the three clusters with different densities and run HDBSCAN to the end.', 'Load densities', actions.density,
      'HDBSCAN finds all three groups and leaves the scattered points as noise — no single DBSCAN ε could do that.'),
    card('', 'Threshold vs stability', 'With the same data, switch “Cluster extraction” to Threshold and drag ε.', 'Load noisy moons', actions.moons,
      'A fixed threshold behaves like DBSCAN: too small and clusters shatter, too big and they merge. Stability picks good clusters without any ε.'),
    card('', 'Min cluster size', 'After it finishes, raise and lower <i>min cluster size</i>.', null, null,
      'Small values allow tiny clusters (sometimes splitting real ones). Large values merge small groups into noise or into bigger clusters.'),
  );
}
