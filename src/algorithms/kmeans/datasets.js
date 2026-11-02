// K-Means presets (generators live in core/datasets.js).
import { gauss, clip, blobs, uneven, moons, rings, smiley, uniform } from '../../core/datasets.js';

export { blobs };

export const DATASETS = [
  { id: 'blobs', label: 'Blobs', emoji: '🫧', make: (n) => blobs(n), note: 'Round, well-separated groups — K-Means’ favourite kind of data.' },
  { id: 'uneven', label: 'Uneven', emoji: '⚖️', make: uneven, note: 'One big spread-out group and two tiny tight ones. Watch where the borders end up.' },
  { id: 'moons', label: 'Moons', emoji: '🌙', make: (n) => moons(n), note: 'Two curved shapes. K-Means can only draw straight borders, so it slices them wrong.' },
  { id: 'rings', label: 'Rings', emoji: '💍', make: rings, note: 'A ring around a circle. No straight-line split can separate them.' },
  { id: 'smiley', label: 'Smiley', emoji: '🙂', make: smiley, note: 'Just for fun — what does K-Means think a face is made of?' },
  { id: 'uniform', label: 'Random', emoji: '🎲', make: uniform, note: 'No real groups at all. K-Means still splits it into K pieces — it always will!' },
  { id: 'blank', label: 'Blank', emoji: '✏️', make: () => [], note: 'An empty canvas. Click, drag or use the spray tool to draw your own data.' },
];

export const findDataset = (id) => DATASETS.find((d) => d.id === id) || DATASETS[0];

/** Three clear blobs and a deliberately bad start (two stars inside one blob). */
export function trickyStart() {
  const cs = [{ x: -0.6, y: 0.45 }, { x: 0.55, y: 0.5 }, { x: 0.0, y: -0.55 }];
  const pts = [];
  for (let i = 0; i < 240; i++) {
    const c = cs[i % 3];
    pts.push(clip({ x: c.x + gauss() * 0.11, y: c.y + gauss() * 0.11 }));
  }
  const cents = [{ x: -0.72, y: 0.52 }, { x: -0.48, y: 0.36 }, { x: 0.3, y: -0.05 }];
  return { pts, cents };
}

/** The worked examples from the K-Means lecture (data units). */
export const LECTURE = {
  points: [
    { x: 3, y: 4, name: 'P1' },
    { x: 6, y: 7, name: 'P2' },
    { x: 4, y: 5, name: 'P3' },
    { x: 5, y: 7, name: 'P4' },
    { x: 2, y: 6, name: 'P5' },
  ],
  given: [{ x: 3, y: 4 }, { x: 4, y: 5 }], // initial centroids on the slides
  newPoint: { x: 2, y: 7 },
};
