// Shared colors for every simulation — neumorphic "warm sand" theme.
// Keep three.js and CSS in sync from here.

export const INK = 0x4a3f35; // point / marker outlines
export const PAPER = 0xede6db; // plot background (same sand as the page — the canvas is an inset well)
export const GRID_DOT = 0xd9cfbf; // grid lines
export const NEUTRAL = 0xb8ac9c; // unassigned / unlabeled points

// Earthy categorical colors: calm on sand, still easy to tell apart.
export const PALETTE = [
  0xe07a5f, // terracotta
  0x3d8b8b, // teal
  0xd4a24c, // mustard
  0x6b8e5a, // sage
  0x8a5a83, // plum
  0x4f6d8a, // slate
  0xb5523b, // rust
  0x8c8a3e, // olive
];

export const PALETTE_NAMES = ['Terracotta', 'Teal', 'Mustard', 'Sage', 'Plum', 'Slate', 'Rust', 'Olive'];

export const css = (hex) => '#' + hex.toString(16).padStart(6, '0');
