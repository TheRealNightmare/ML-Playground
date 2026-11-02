import { h } from './ui.js';

const PLAY = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="5.5" y="4.5" width="4.5" height="15" fill="currentColor"/><rect x="14" y="4.5" width="4.5" height="15" fill="currentColor"/></svg>';
const STEP = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 5v14l10-7z" fill="currentColor"/><rect x="16.5" y="5" width="3" height="14" fill="currentColor"/></svg>';
const RESET = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.6 4.7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="square"/><path d="M3 4.5v6h6z" fill="currentColor"/></svg>';

/**
 * Playback controller shared by all simulations.
 *  - onStep(): advance the algorithm one step; return false when finished.
 *  - isBusy(): return true while an animation should finish before the next step.
 *  - onReset(): restart the algorithm.
 */
export class Player {
  constructor({ onStep, onReset, isBusy = () => false, baseInterval = 0.9 }) {
    this.onStep = onStep;
    this.onReset = onReset;
    this.isBusy = isBusy;
    this.baseInterval = baseInterval;
    this.playing = false;
    this.speed = 1;
    this.acc = 0;
    this.listeners = new Set();
    this.el = this._build();
    this._onKey = (e) => this._key(e);
    window.addEventListener('keydown', this._onKey);
  }

  _build() {
    this.playBtn = h('button', { type: 'button', class: 'pb-btn pb-play', title: 'Play / pause (Space)', 'aria-label': 'Play', onclick: () => this.toggle(), html: PLAY });
    this.stepBtn = h('button', { type: 'button', class: 'pb-btn', title: 'One step (→)', onclick: () => this.step() }, h('span', { class: 'pb-text' }, 'Step'), h('span', { class: 'pb-icon', html: STEP }));
    this.resetBtn = h('button', { type: 'button', class: 'pb-btn', title: 'Reset (R)', onclick: () => this.reset() }, h('span', { class: 'pb-icon', html: RESET }), h('span', { class: 'pb-text' }, 'Reset'));
    const speeds = [0.25, 0.5, 1, 2, 4];
    this.speedOut = h('span', { class: 'pb-speed-val' }, '1×');
    const range = h('input', { type: 'range', min: 0, max: speeds.length - 1, step: 1, value: 2, 'aria-label': 'Speed' });
    range.addEventListener('input', () => {
      this.speed = speeds[Number(range.value)];
      this.speedOut.textContent = (this.speed < 1 ? this.speed : this.speed) + '×';
    });
    return h('div', { class: 'playbar' },
      this.resetBtn,
      this.playBtn,
      this.stepBtn,
      h('label', { class: 'pb-speed' }, h('span', { class: 'pb-speed-label' }, 'Slow'), range, h('span', { class: 'pb-speed-label' }, 'Fast'), this.speedOut),
    );
  }

  _emit() {
    this.playBtn.innerHTML = this.playing ? PAUSE : PLAY;
    this.playBtn.setAttribute('aria-label', this.playing ? 'Pause' : 'Play');
    this.playBtn.classList.toggle('is-playing', this.playing);
    for (const fn of this.listeners) fn(this.playing);
  }

  onChange(fn) { this.listeners.add(fn); }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.acc = this.baseInterval; // first step happens right away
    this._emit();
  }
  pause() { if (!this.playing) return; this.playing = false; this._emit(); }
  toggle() { this.playing ? this.pause() : this.play(); }

  step() {
    this.pause();
    this.onStep();
  }

  reset() {
    this.pause();
    this.onReset?.();
  }

  update(dt) {
    if (!this.playing) return;
    this.acc += dt * this.speed;
    if (this.acc >= this.baseInterval && !this.isBusy()) {
      this.acc = 0;
      const more = this.onStep();
      if (more === false) this.pause();
    }
  }

  _key(e) {
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); this.toggle(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); this.step(); }
    else if (e.key === 'r' || e.key === 'R') { this.reset(); }
  }

  dispose() { window.removeEventListener('keydown', this._onKey); }
}
