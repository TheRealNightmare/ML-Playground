// Shared colors for every simulation — "research paper" palette.
// Keep three.js and CSS in sync from here.

export const INK = 0x1f2937; // point / marker outlines
export const PAPER = 0xffffff; // plot background
export const GRID_DOT = 0xe5e7eb; // grid lines
export const NEUTRAL = 0xb4bac4; // unassigned / unlabeled points

// Categorical colors for clusters / classes, chosen to stay distinct on white.
export const PALETTE = [
  0x2563eb, // blue
  0xf97316, // orange
  0x0d9488, // teal
  0xdc2626, // red
  0x7c3aed, // violet
  0xca8a04, // gold
  0xdb2777, // pink
  0x0891b2, // cyan
];

export const PALETTE_NAMES = ['Blue', 'Orange', 'Teal', 'Red', 'Violet', 'Gold', 'Pink', 'Cyan'];

export const css = (hex) => '#' + hex.toString(16).padStart(6, '0');
