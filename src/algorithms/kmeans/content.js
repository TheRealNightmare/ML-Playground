import katex from 'katex';
import 'katex/dist/katex.min.css';
import { h } from '../../core/ui.js';

const tex = (s, display = false) => katex.renderToString(s, { displayMode: display, throwOnError: false });
const eq = (s) => h('div', { class: 'eq', html: tex(s, true) });
const html = (s) => {
  // inline $...$ → KaTeX
  return s.replace(/\$([^$]+)\$/g, (_, m) => tex(m));
};
const P = (s) => h('p', { html: html(s) });

/* ---------------- Narrator lines for each phase ---------------- */
export const PHASE_TRACK = [
  { id: 'data', label: 'Data' },
  { id: 'init', label: 'Place ★' },
  { id: 'assign', label: 'Assign', loop: true },
  { id: 'update', label: 'Update', loop: true },
  { id: 'converged', label: 'Done' },
];

export function narration(S) {
  const K = S.cents.length || S.K;
  const initName = { random: 'random data points', pp: 'K-Means++', spots: 'random spots', farthest: 'the two farthest points (modified k-means)', given: 'the starting centroids from the slide' }[S.init];
  switch (S.phase) {
    case 'empty':
      return { emoji: '', title: 'Give me some data!', text: 'Pick a dataset on the left, or <b>click on the canvas</b> to drop points yourself. Drag to spray a few in a row.' };
    case 'ready':
      return { emoji: '', title: `Ready to find ${S.K} groups`, text: `I see <b>${S.points.length}</b> points with no labels. Press <b>Step</b> (or ▶) and I’ll drop <b>${S.K}</b> centroids — the ★ stars — to start.` };
    case 'init':
      return { emoji: '', title: `Step 1 · Dropped ${K} stars`, text: `I placed the stars using <b>${initName}</b>. They’re just guesses for now. Next, every point will look for its <b>closest</b> star.` };
    case 'assign':
      return {
        emoji: '',
        title: `Assign · round ${S.iter + 1}`,
        text: S.lastChanged === S.points.length
          ? `Every point joined its <b>nearest ★</b> and took its color. The shaded regions show which star “owns” each spot.`
          : `Every point checked which ★ is closest now. <b>${S.lastChanged}</b> point${S.lastChanged === 1 ? '' : 's'} switched team. Next, the stars move.`,
      };
    case 'update': {
      const extra = S.emptyNote ? ` ${S.emptyNote}` : '';
      return {
        emoji: '',
        title: `Update · round ${S.iter}`,
        text: `Each ★ walked to the <b>average position</b> of its own points (the middle of its team). Biggest move: <b>${S.lastShift.toFixed(3)}</b>.${extra}`,
      };
    }
    case 'converged':
      return { emoji: '', title: `Done after ${S.iter} round${S.iter === 1 ? '' : 's'}!`, text: `No point switched team, so the stars won’t move again — that’s <b>convergence</b>. Try dragging a ★ somewhere silly and press ▶ again.` };
    case 'edited':
      return { emoji: '', title: 'You changed things!', text: 'Points instantly re-picked their nearest ★. Press <b>Step</b> or ▶ to let the stars catch up.' };
    default:
      return { emoji: '', title: '', text: '' };
  }
}

/* ---------------- Learn tabs ---------------- */
export function intuitionTab() {
  return h('div', { class: 'learn' },
    h('h4', {}, 'What is K-Means?'),
    P('K-Means is an <b>unsupervised</b> algorithm: the points have no labels and no right answers. Its job is to split them into <b>K groups</b> (clusters) so that points in the same group sit close together.'),
    P('Each group has a center called a <b>centroid</b> — the <span class="legend-star">★</span> stars on the canvas.'),
    h('div', { class: 'callout' },
      h('strong', {}, 'Ice-cream truck analogy'),
      P('Imagine K ice-cream trucks parked in a park. Everyone walks to the <b>nearest</b> truck. Then each truck drives to the <b>middle</b> of its own crowd. Some people now have a closer truck, so they switch. Repeat until nobody switches.'),
    ),
    h('h4', {}, 'The four steps'),
    h('ol', {},
      h('li', { html: '<b>Choose K</b> — how many groups you want. You decide this, not the algorithm.' }),
      h('li', { html: '<b>Place K stars</b> — usually on random data points (or smartly with K-Means++).' }),
      h('li', { html: '<b>Assign</b> — every point joins its closest star.' }),
      h('li', { html: '<b>Update</b> — every star moves to the average of its points. Go back to step 3 until nothing changes.' }),
    ),
    h('h4', {}, 'Good to know'),
    h('ul', {},
      h('li', { html: 'It <b>always</b> stops — usually after just a handful of rounds.' }),
      h('li', { html: 'Different starting stars can give <b>different answers</b>. Real libraries run it several times and keep the best.' }),
      h('li', { html: 'Borders between groups are always <b>straight lines</b>, so it loves round blobs and struggles with moons, rings and very uneven groups.' }),
      h('li', { html: 'It’s used for customer segmentation, compressing image colors, grouping documents and more.' }),
    ),
    h('div', { class: 'callout mint' },
      P('<b>Inertia</b> (the chart above) adds up how far every point is from its own star (squared). Lower = tighter groups. Watch it drop with every step!'),
    ),
  );
}

export function mathTab() {
  const pseudo = h('div', { class: 'pseudo' });
  const lines = [
    ['', '<span class="kw">input</span>  points x₁ … xₙ,  number of clusters K'],
    ['init', 'μ₁ … μ_K ← pick K starting centroids'],
    ['', '<span class="kw">repeat</span>'],
    ['assign', '    <span class="cm"># assignment step</span>'],
    ['assign', '    <span class="kw">for each</span> i:  cᵢ ← argmin_k ‖xᵢ − μ_k‖²'],
    ['update', '    <span class="cm"># update step</span>'],
    ['update', '    <span class="kw">for each</span> k:  μ_k ← mean of { xᵢ : cᵢ = k }'],
    ['converged', '<span class="kw">until</span> no cᵢ changes'],
  ];
  pseudo.innerHTML = lines.map(([ph, l]) => `<span data-ph="${ph}">${l}</span>`).join('\n');

  const el = h('div', { class: 'learn' },
    h('h4', {}, 'Notation'),
    P('Points $x_1, \\dots, x_n \\in \\mathbb{R}^2$, centroids $\\mu_1, \\dots, \\mu_K$, and $c_i \\in \\{1,\\dots,K\\}$ is the cluster of point $i$.'),
    h('h4', {}, 'The objective (inertia)'),
    P('K-Means tries to make this number as small as possible:'),
    eq('J(c, \\mu) = \\sum_{i=1}^{n} \\lVert x_i - \\mu_{c_i} \\rVert^2'),
    P('It’s called <b>inertia</b> or <b>WCSS</b> (within-cluster sum of squares).'),
    h('h4', {}, 'Assignment step'),
    P('Hold the centroids fixed and give each point to the closest one:'),
    eq('c_i \\leftarrow \\arg\\min_{k} \\lVert x_i - \\mu_k \\rVert^2'),
    h('h4', {}, 'Update step'),
    P('Hold the assignments fixed and move each centroid to the mean of its cluster $C_k$:'),
    eq('\\mu_k \\leftarrow \\frac{1}{|C_k|} \\sum_{i \\in C_k} x_i'),
    P('The mean is exactly the point that minimises the squared distances to a set of points — that’s why this step can only lower $J$.'),
    h('div', { class: 'callout purple' },
      P('<b>Why it always stops:</b> neither step can increase $J$, and there are only finitely many ways to assign $n$ points to $K$ clusters. So $J$ keeps dropping until it gets stuck — at a <b>local</b> minimum, which isn’t always the best one.'),
    ),
    h('h4', {}, 'Pseudocode'),
    pseudo,
    P('The highlighted line is what the simulation is doing right now.'),
    h('h4', {}, 'K-Means++ initialization'),
    P('Pick the first centroid at random. Then pick each next one with probability proportional to its squared distance $D(x)^2$ from the nearest centroid already chosen:'),
    eq('P(x) = \\frac{D(x)^2}{\\sum_{x\'} D(x\')^2}'),
    P('Far-away points are more likely to be picked, so the stars start spread out and bad starts become rare.'),
    h('h4', {}, 'Other distances'),
    P('The slides also use <b>Manhattan</b> distance $d = |x_2 - x_1| + |y_2 - y_1|$. Switch “Distance” to see how the borders between clusters turn into zig-zags. (With Manhattan distance the truly optimal centre is the median, which gives the k-medians algorithm.)'),
    h('h4', {}, 'Modified k-means (smart start)'),
    P('Compute all pairwise distances and start from the two points that are farthest apart. For more than two clusters, keep adding the point whose nearest chosen centroid is farthest away. Pick “Farthest” under Starting positions.'),
    h('h4', {}, 'Cost'),
    P('Each round costs $O(nKd)$ for $n$ points, $K$ clusters and $d$ dimensions (here $d = 2$).'),
    h('h4', {}, 'Choosing K: the elbow method'),
    P('Run K-Means for $K = 1, 2, 3, \\dots$ and plot the best $J$ for each. $J$ always shrinks as $K$ grows, but at some point the drop flattens out. That bend — the <b>elbow</b> — is a reasonable choice for $K$.'),
  );
  el.highlight = (phase) => {
    pseudo.querySelectorAll('span[data-ph]').forEach((s) => {
      const ph = s.dataset.ph;
      const on = ph && (ph === phase || (phase === 'edited' && ph === 'assign'));
      s.classList.toggle('hl', !!on);
    });
  };
  return el;
}

export function challengesTab(actions) {
  const card = (emoji, title, text, btnLabel, action, answer) =>
    h('div', { class: 'challenge' },
      h('div', { class: 'challenge-head' }, h('span', { class: 'challenge-emoji' }, emoji), h('strong', {}, title)),
      h('p', { html: text }),
      btnLabel ? h('button', { type: 'button', class: 'btn btn-primary', onclick: action }, btnLabel) : null,
      answer ? h('details', {}, h('summary', {}, 'What should I notice?'), h('p', { html: answer })) : null,
    );
  return h('div', { class: 'learn' },
    card('', 'Watch it work', 'Load three clean blobs with K = 3 and press play. Count how many rounds it takes.', 'Set it up', actions.basic,
      'Usually just 2–5 rounds. Each round has two steps: points switch color (assign), then stars move (update). The inertia chart only ever goes down.'),
    card('', 'A bad start', 'Two stars start inside the same blob, and one sits between the other two. Press play and see where they end up.', 'Load tricky start', actions.tricky,
      'It gets stuck! One blob is split in half while two blobs share a star. This is a <b>local minimum</b>. Press Reset and try again with <b>K-Means++</b> — it almost never starts this badly.'),
    card('', 'Moons', 'Two curved moons, K = 2. Will K-Means find the two moons?', 'Load moons', actions.moons,
      'No — it cuts straight across both moons. K-Means borders are always straight lines (look at the shaded regions), so curved shapes need other algorithms like DBSCAN or spectral clustering.'),
    card('', 'Find the best K', 'Load blobs with an unknown number of groups, then use the elbow chart to guess K.', 'Load mystery blobs', actions.elbow,
      'Look for where the bars stop shrinking a lot. Click that bar to set K, then press play to check your guess.'),
    card('', 'Be the algorithm', 'After it converges, <b>drag a ★</b> somewhere else. Watch the colored regions and the points react, then press play again.', null, null,
      'The regions update live because every spot just belongs to its nearest star. Once you let go and press play, the stars walk back to a stable spot — maybe a different one!'),
    card('', 'Uneven groups', 'One huge group and two tiny ones, K = 3.', 'Load uneven', actions.uneven,
      'Look at the borders: each one sits exactly halfway between two stars, no matter how big the groups are. So the outer edge of the big group gets “stolen” by the small ones. K-Means quietly assumes every group has a similar size and spread.'),
  );
}
