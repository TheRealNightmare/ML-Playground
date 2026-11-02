// Shared colors for every simulation. Keep three.js and CSS in sync from here.

export const INK = 0x2b2240;
export const PAPER = 0xfff8ec;
export const GRID_DOT = 0xd9cdb8;
export const NEUTRAL = 0xbdb5a6; // unassigned / unlabeled points

// Candy palette — one color per cluster / class.
export const PALETTE = [
  0xff6b6b, // coral
  0x4d96ff, // sky
  0xffc93c, // sunflower
  0x2ec4b6, // mint
  0x9b5de5, // grape
  0xf15bb5, // bubblegum
  0x8ac926, // lime
  0xff924c, // tangerine
];

export const PALETTE_NAMES = ['Coral', 'Sky', 'Sunny', 'Mint', 'Grape', 'Bubblegum', 'Lime', 'Tangerine'];

export const css = (hex) => '#' + hex.toString(16).padStart(6, '0');
