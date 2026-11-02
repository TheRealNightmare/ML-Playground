// Shared colors for every simulation — retro pastel, neo-retro style.
// Keep three.js and CSS in sync from here.

export const INK = 0x1a1a1a; // outlines
export const PAPER = 0xfff6e9; // background cream
export const GRID_DOT = 0xeadbc4; // dot grid
export const NEUTRAL = 0xb5aba0; // unassigned / unlabeled points

// Cluster / class colors: slightly deeper pastels so points stay readable on cream.
export const PALETTE = [
  0xff7a66, // coral
  0x5fa8e8, // sky
  0xffcf4a, // butter
  0x4fc9a4, // mint
  0x9d85ee, // lavender
  0xf58fc0, // pink
  0xffa45c, // peach
  0x58b7c4, // teal
];

export const PALETTE_NAMES = ['Coral', 'Sky', 'Butter', 'Mint', 'Lavender', 'Pink', 'Peach', 'Teal'];

export const css = (hex) => '#' + hex.toString(16).padStart(6, '0');
