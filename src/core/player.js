import { h } from './ui.js';

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
    this.playBtn = h('button', { type: 'button', class: 'pb-btn pb-play', title: 'Play / pause (Space)', onclick: () => this.toggle() }, '▶');
    this.stepBtn = h('button', { type: 'button', class: 'pb-btn', title: 'One step (→)', onclick: () => this.step() }, h('span', { class: 'pb-icon' }, '⏭'), h('span', { class: 'pb-text' }, 'Step'));
    this.resetBtn = h('button', { type: 'button', class: 'pb-btn', title: 'Reset (R)', onclick: () => this.reset() }, h('span', { class: 'pb-icon' }, '↺'), h('span', { class: 'pb-text' }, 'Reset'));
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
      h('label', { class: 'pb-speed' }, h('span', { class: 'pb-speed-label' }, '🐢'), range, h('span', { class: 'pb-speed-label' }, '🐇'), this.speedOut),
    );
  }

  _emit() {
    this.playBtn.textContent = this.playing ? '❚❚' : '▶';
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
