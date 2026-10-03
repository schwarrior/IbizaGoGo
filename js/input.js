// Keyboard + gamepad. Emits timestamped presses/releases in performance.now()
// time so judging is independent of frame rate.
(function (IGG) {
  'use strict';

  const KEYS = {
    ArrowLeft: 'L', KeyA: 'L', ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D', ArrowRight: 'R', KeyD: 'R'
  };
  // Standard mapping: face buttons sit where the directions are (X left, Y up, A down, B right).
  const PAD = { 14: 'L', 12: 'U', 13: 'D', 15: 'R', 2: 'L', 3: 'U', 0: 'D', 1: 'R' };

  function Input() {
    this.handlers = [];
    this.device = 'keyboard';
    this.held = { L: 0, U: 0, D: 0, R: 0 };
    this.padPrev = {};
    this.padAxes = { L: false, U: false, D: false, R: false };
    this.hasPad = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (KEYS[e.code] || e.code === 'Space') e.preventDefault(); return; }
      const dir = KEYS[e.code];
      this.device = 'keyboard';
      if (dir) { e.preventDefault(); this._emit({ type: 'press', dir, time: e.timeStamp, src: 'key', code: e.code }); this._hold(dir, 1); }
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this._emit({ type: 'confirm', time: e.timeStamp }); }
      if (e.code === 'Escape' || e.code === 'KeyP') this._emit({ type: 'pause', time: e.timeStamp });
      if (e.code === 'Backspace') this._emit({ type: 'back', time: e.timeStamp });
    });
    window.addEventListener('keyup', (e) => {
      const dir = KEYS[e.code];
      if (dir) { this._hold(dir, -1); if (!this.held[dir]) this._emit({ type: 'release', dir, time: e.timeStamp }); }
    });
    window.addEventListener('blur', () => { for (const k in this.held) this.held[k] = 0; });
    window.addEventListener('gamepadconnected', () => { this.hasPad = true; });
  }

  Input.prototype._hold = function (dir, d) { this.held[dir] = Math.max(0, Math.min(2, this.held[dir] + d)); };
  Input.prototype.on = function (fn) { this.handlers.push(fn); };
  Input.prototype._emit = function (ev) { for (const h of this.handlers) h(ev); };

  // Call once per frame.
  Input.prototype.poll = function () {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const now = performance.now();
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      this.hasPad = true;
      const prev = this.padPrev[gp.index] || (this.padPrev[gp.index] = []);
      gp.buttons.forEach((b, i) => {
        const down = b.pressed || b.value > 0.5;
        if (down && !prev[i]) {
          this.device = 'gamepad';
          const dir = PAD[i];
          if (dir) { this._emit({ type: 'press', dir, time: now, src: 'pad', button: i }); this._hold(dir, 1); }
          if (i === 0) this._emit({ type: 'confirm', time: now, pad: true });
          if (i === 1) this._emit({ type: 'back', time: now, pad: true });
          if (i === 9 || i === 8) this._emit({ type: 'pause', time: now });
        } else if (!down && prev[i]) {
          const dir = PAD[i];
          if (dir) { this._hold(dir, -1); if (!this.held[dir]) this._emit({ type: 'release', dir, time: now }); }
        }
        prev[i] = down;
      });
      // Left stick as a d-pad
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const st = { L: ax < -0.6, R: ax > 0.6, U: ay < -0.6, D: ay > 0.6 };
      for (const d in st) {
        if (st[d] && !this.padAxes[d]) { this.device = 'gamepad'; this._emit({ type: 'press', dir: d, time: now, src: 'stick' }); this._hold(d, 1); }
        else if (!st[d] && this.padAxes[d]) { this._hold(d, -1); if (!this.held[d]) this._emit({ type: 'release', dir: d, time: now }); }
        this.padAxes[d] = st[d];
      }
    }
  };

  IGG.Input = Input;
})(window.IGG);
