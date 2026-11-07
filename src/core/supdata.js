// Labelled datasets for the supervised playgrounds.
//   task 'cls' : 2D points { x, y, label }   (features = x, y)
//   task 'reg' : 1D points { x, y }          (feature = x, target = y)
import { gauss } from './datasets.js';

const cl = (v, m = 1.02) => Math.max(-m, Math.min(m, v));
const P = (x, y, label) => ({ x: cl(x), y: cl(y), label });

function cblobs(n) {
  const c = [[-0.42, 0.25], [0.42, -0.2]];
  return Array.from({ length: n }, (_, i) => { const k = i % 2; return P(c[k][0] + gauss() * 0.24, c[k][1] + gauss() * 0.24, k); });
}
function cmoons(n) {
  return Array.from({ length: n }, (_, i) => {
    const t = Math.random() * Math.PI, k = i % 2;
    const x = k ? 1 - Math.cos(t) : Math.cos(t), y = k ? 0.5 - Math.sin(t) : Math.sin(t);
    return P((x - 0.5) * 0.66 + gauss() * 0.07, (y - 0.25) * 0.8 + gauss() * 0.07, k);
  });
}
function cxor(n) {
  return Array.from({ length: n }, () => {
    const x = (Math.random() * 2 - 1) * 0.92, y = (Math.random() * 2 - 1) * 0.92;
    let k = x * y > 0 ? 0 : 1;
    if (Math.random() < 0.04) k = 1 - k;
    return P(x, y, k);
  });
}
function ccircles(n) {
  return Array.from({ length: n }, (_, i) => {
    const k = i % 2, a = Math.random() * Math.PI * 2;
    const r = k ? 0.3 * Math.sqrt(Math.random()) : 0.62 + gauss() * 0.08;
    return P(Math.cos(a) * r, Math.sin(a) * r, k);
  });
}
function cspiral(n) {
  return Array.from({ length: n }, (_, i) => {
    const k = i % 2, t = 0.25 + (i / n) * 2.6 * Math.PI / 2 * 2, r = 0.08 + (i / n) * 0.85;
    const a = t + k * Math.PI;
    return P(Math.cos(a) * r + gauss() * 0.035, Math.sin(a) * r + gauss() * 0.035, k);
  });
}
function cthree(n) {
  const c = [[-0.5, 0.4], [0.5, 0.4], [0, -0.5]];
  return Array.from({ length: n }, (_, i) => { const k = i % 3; return P(c[k][0] + gauss() * 0.2, c[k][1] + gauss() * 0.2, k); });
}
function cnoisy(n) {
  return Array.from({ length: n }, () => {
    const x = (Math.random() * 2 - 1) * 0.92, y = (Math.random() * 2 - 1) * 0.92;
    let k = y > 0.55 * x + 0.12 * Math.sin(5 * x) ? 1 : 0;
    if (Math.random() < 0.1) k = 1 - k;
    return P(x, y, k);
  });
}
function cimbal(n) {
  return Array.from({ length: n }, (_, i) => {
    const k = i % 5 === 0 ? 1 : 0;
    const c = k ? [0.45, 0.35] : [-0.2, -0.1];
    return P(c[0] + gauss() * (k ? 0.18 : 0.36), c[1] + gauss() * (k ? 0.18 : 0.3), k);
  });
}

const R = (x, y) => ({ x: cl(x), y: cl(y, 0.98) });
const xs = (n) => Array.from({ length: n }, () => Math.random() * 1.9 - 0.95);
const rsine = (n) => xs(n).map((x) => R(x, 0.55 * Math.sin(3.2 * x) + gauss() * 0.1));
const rsteps = (n) => xs(n).map((x) => R(x, (x < -0.35 ? -0.45 : x < 0.3 ? 0.35 : -0.05) + gauss() * 0.08));
const rline = (n) => xs(n).map((x) => R(x, 0.55 * x - 0.05 + gauss() * 0.12));
const rquad = (n) => xs(n).map((x) => R(x, 1.1 * x * x - 0.5 + gauss() * 0.1));

export const SUPDATA = {
  cblobs: { id: 'cblobs', task: 'cls', label: 'Two blobs', make: cblobs, note: 'Two overlapping round groups.' },
  cmoons: { id: 'cmoons', task: 'cls', label: 'Moons', make: cmoons, note: 'Two interleaved half-moons.' },
  cxor: { id: 'cxor', task: 'cls', label: 'XOR', make: cxor, note: 'Opposite corners share a class — no single straight cut works.' },
  ccircles: { id: 'ccircles', task: 'cls', label: 'Circles', make: ccircles, note: 'A disc inside a ring.' },
  cspiral: { id: 'cspiral', task: 'cls', label: 'Spiral', make: cspiral, note: 'Two arms winding around each other — hard!' },
  cnoisy: { id: 'cnoisy', task: 'cls', label: 'Noisy', make: cnoisy, note: 'A wavy border with 10% of labels flipped.' },
  cthree: { id: 'cthree', task: 'cls', label: '3 classes', make: cthree, nClasses: 3, note: 'Three groups, three classes.' },
  cimbal: { id: 'cimbal', task: 'cls', label: 'Imbalanced', make: cimbal, note: 'One class is 4× bigger than the other.' },
  rsine: { id: 'rsine', task: 'reg', label: 'Sine', make: rsine, note: 'A wave with noise.' },
  rsteps: { id: 'rsteps', task: 'reg', label: 'Steps', make: rsteps, note: 'Flat levels with jumps — trees love this.' },
  rline: { id: 'rline', task: 'reg', label: 'Line', make: rline, note: 'A straight trend — trees must build it from steps.' },
  rquad: { id: 'rquad', task: 'reg', label: 'Parabola', make: rquad, note: 'A U-shape.' },
  cblank: { id: 'cblank', task: 'cls', label: 'Blank', make: () => [], note: 'Pick a class below and click to add points.' },
  rblank: { id: 'rblank', task: 'reg', label: 'Blank', make: () => [], note: 'Click to add (x, y) points.' },
};

export const CLS_SETS = ['cblobs', 'cmoons', 'cxor', 'ccircles', 'cspiral', 'cnoisy', 'cthree', 'cimbal', 'cblank'];
export const REG_SETS = ['rsine', 'rsteps', 'rline', 'rquad', 'rblank'];
