import { h } from '../../core/ui.js';
import { katexHtml, eq, P } from '../../core/tex.js';

export const LECTURES = [
  {
    id: 'lec-h1', label: '5 points · Manhattan',
    points: [{ x: 1, y: 1, name: 'P1' }, { x: 2, y: 1, name: 'P2' }, { x: 4, y: 3, name: 'P3' }, { x: 5, y: 4, name: 'P4' }, { x: 8, y: 8, name: 'P5' }],
    settings: { linkage: 'centroid', metric: 'manhattan' },
    note: 'Slide example: P1–P5, <b>Manhattan</b> distance between <b>centroids</b>. Merge heights should be 1, 2, 5.5, 10.75.',
  },
  {
    id: 'lec-h2', label: 'Distance table A–E',
    matrix: [[0, 2, 6, 10, 9], [2, 0, 5, 9, 8], [6, 5, 0, 4, 5], [10, 9, 4, 0, 3], [9, 8, 5, 3, 0]],
    names: ['A', 'B', 'C', 'D', 'E'],
    settings: { linkage: 'single' },
    note: 'Slide exercise: only a <b>distance table</b> is given, so positions on the canvas are approximate. <b>Single link</b>: merges at 2, 3, 4, 5.',
  },
  {
    id: 'lec-h3', label: 'Practice A1–B2',
    points: [{ x: 1, y: 3, name: 'A1' }, { x: 2, y: 4, name: 'A2' }, { x: 3, y: 5, name: 'A3' }, { x: 7, y: 8, name: 'A4' }, { x: 1, y: 2, name: 'B1' }, { x: 4, y: 5, name: 'B2' }],
    settings: { linkage: 'single', metric: 'euclidean' },
    note: 'Slide practice question: build the distance matrix, draw the dendrogram, then pick the number of clusters. Try other linkages and metrics too.',
  },
];

export const LINKAGE_INFO = {
  single: 'Distance between two clusters = their <b>closest</b> pair of points. Can follow long, curvy shapes (“chaining”).',
  complete: 'Distance = their <b>farthest</b> pair of points. Prefers compact, round clusters of similar size.',
  average: 'Distance = the <b>average</b> of all point-to-point distances between the two clusters. A balance of the two.',
  centroid: 'Distance = distance between the two cluster <b>centroids</b> (means). Used on the lecture slides.',
};

export function intuitionTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'What is hierarchical clustering?'),
    P('Instead of asking for K up front, it builds a whole <b>family tree</b> of clusters. The version here is <b>agglomerative</b> (bottom-up): every point starts alone, and the two closest clusters keep merging until only one is left.'),
    h('div', { class: 'callout' },
      h('strong', {}, '👨‍👩‍👧 Family tree analogy'),
      P('Siblings join first (they’re most alike), then cousins, then whole branches of the family — until everyone is in one big tree. The <b>dendrogram</b> is that tree, and the height of each join tells you how different the two groups were.'),
    ),
    h('h4', {}, 'The steps'),
    h('ol', {},
      h('li', { html: 'Start with every point as its own cluster.' }),
      h('li', { html: 'Compute the distance between every pair of clusters.' }),
      h('li', { html: '<b>Merge</b> the closest pair.' }),
      h('li', { html: '<b>Update</b> the distances from the new cluster to all the others.' }),
      h('li', { html: 'Repeat until one cluster is left. Each merge height becomes a bar in the dendrogram.' }),
    ),
    h('h4', {}, 'Linkage: what does “closest clusters” mean?'),
    h('ul', {},
      h('li', { html: '<b>Single</b> — closest pair of points.' }),
      h('li', { html: '<b>Complete</b> — farthest pair of points.' }),
      h('li', { html: '<b>Average</b> — average of all pairs.' }),
      h('li', { html: '<b>Centroid</b> — distance between the cluster centres.' }),
    ),
    h('h4', {}, 'Getting K clusters'),
    P('Draw a horizontal <b>cut</b> across the dendrogram. Every branch it crosses is one cluster. A good cut sits in a big gap between merge heights.'),
    h('h4', {}, 'Good to know'),
    h('ul', {},
      h('li', { html: 'No need to choose K first, and you see how groups relate.' }),
      h('li', { html: 'Merges are <b>greedy</b> — they can never be undone.' }),
      h('li', { html: 'Slow for big data (roughly n³ steps here), so it suits small and medium datasets.' }),
      h('li', { html: 'Sensitive to noise: one stray point can link two groups under single linkage.' }),
    ),
  );
}

export function mathTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'Distances between points'),
    eq('d_{\\text{Euclid}}(p,q) = \\sqrt{(p_x-q_x)^2 + (p_y-q_y)^2}'),
    eq('d_{\\text{Manhattan}}(p,q) = |p_x-q_x| + |p_y-q_y|'),
    h('h4', {}, 'Distances between clusters A and B'),
    eq('\\text{single: } \\min_{a\\in A,\\, b\\in B} d(a,b) \\qquad \\text{complete: } \\max_{a\\in A,\\, b\\in B} d(a,b)'),
    eq('\\text{average: } \\frac{1}{|A||B|}\\sum_{a\\in A}\\sum_{b\\in B} d(a,b)'),
    eq('\\text{centroid: } d(\\mu_A, \\mu_B), \\quad \\mu_A = \\tfrac{1}{|A|}\\textstyle\\sum_{a\\in A} a'),
    h('h4', {}, 'Updating the table after a merge'),
    P('When $A$ and $B$ merge into $A\\cup B$, the new row can be built from the old one (Lance–Williams):'),
    eq('d(A\\cup B, C) = \\begin{cases} \\min(d(A,C), d(B,C)) & \\text{single}\\\\ \\max(d(A,C), d(B,C)) & \\text{complete}\\\\ \\frac{|A|\\,d(A,C) + |B|\\,d(B,C)}{|A|+|B|} & \\text{average} \\end{cases}'),
    P('For centroid linkage, compute the new centroid and measure again.'),
    h('div', { class: 'callout purple' },
      P('<b>Centroid vs “averaging the two centroids”.</b> The true centroid of $A\\cup B$ is the size-weighted mean $\\frac{|A|\\mu_A + |B|\\mu_B}{|A|+|B|}$. Simply averaging $\\mu_A$ and $\\mu_B$ (what the slides do in the last step) is called <b>median linkage</b>. They agree whenever the two clusters have the same size.'),
    ),
    h('h4', {}, 'Cost'),
    P('This simple version scans the whole table for every merge: about $O(n^3)$ time and $O(n^2)$ memory. Smarter implementations reach $O(n^2)$ for single linkage.'),
    h('h4', {}, 'Cutting the dendrogram'),
    P('Cutting at height $t$ keeps every merge with height $\\le t$. The number of clusters is $n$ minus the number of merges kept. Centroid linkage can produce <b>inversions</b> (a later merge lower than an earlier one), so the tree may cross itself.'),
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
    card('📝', 'Reproduce the slides', 'Load the 5-point example and step through it. Compare each table with the slides.', 'Load slide example', actions.lec1,
      'Merges at 1 (P1+P2), 2 (P3+P4), 5.5 (C12+C34), 10.75 (+P5). The last centroid differs from the slide — see the note in the worked example.'),
    card('🌙', 'Single link loves moons', 'Load the moons with <b>single</b> linkage, finish, and cut into 2 clusters.', 'Load moons · single', actions.moonsSingle,
      'Single linkage follows the chain of nearby points along each moon, so it separates them perfectly — something K-Means can’t do.'),
    card('🔵', 'Complete link on moons', 'Same moons, but <b>complete</b> linkage.', 'Load moons · complete', actions.moonsComplete,
      'Complete linkage prefers compact round groups, so it chops the moons the way K-Means does.'),
    card('🌫️', 'Chaining problem', 'Two blobs with a thin bridge of noise points between them, <b>single</b> linkage, K = 2.', 'Load bridge', actions.bridge,
      'The bridge lets single linkage hop from one blob to the other at a small height, so the two blobs merge early. Switch to average or complete and compare.'),
    card('✂️', 'Pick K from the tree', 'Load blobs, finish all merges, then drag the cut line on the dendrogram.', 'Load blobs', actions.blobs,
      'The best cut is usually where the vertical lines are longest — a big jump in merge height means you’re joining groups that are truly far apart.'),
  );
}
