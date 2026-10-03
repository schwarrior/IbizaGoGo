// Game loop, judging, menus and screen effects.
(function (IGG) {
  'use strict';
  const { clamp, lerp } = IGG.util;
  const S = IGG.Song;
  const P = IGG.PAL;
  const { LANE_Y, HIT_X, DIR_COL } = IGG.HUDConst;

  const STAGE_Y = 852, UNIT = 78;
  const JUDGE = [
    { name: 'PERFECT', score: 300, hype: 0.035, color: P.yellow },
    { name: 'GREAT', score: 200, hype: 0.022, color: P.lime },
    { name: 'GOOD', score: 100, hype: 0.01, color: P.sky }
  ];
  const PALETTES = [
    [P.pink, P.sky, P.yellow], [P.orange, P.violet, P.lime], [P.sky, P.pink, P.teal], [P.yellow, P.red, P.blue]
  ];
  const SETTINGS_KEY = 'ibiza-gogo-settings';

  const OPTIONS = {
    difficulty: { values: ['easy', 'normal', 'hard'], label: (v) => IGG.Chart.DIFFICULTY[v].name },
    speed: { values: [0.75, 1, 1.25, 1.5, 1.75], label: (v) => v.toFixed(2).replace(/0$/, '') + 'x' },
    offset: { values: Array.from({ length: 31 }, (_, i) => (i - 15) * 10), label: (v) => (v > 0 ? '+' : '') + v + ' ms' },
    volume: { values: [0.25, 0.5, 0.75, 1], label: (v) => Math.round(v * 100) + '%' },
    flash: { values: [false, true], label: (v) => (v ? 'On' : 'Off') }
  };

  function Game() {
    this.canvas = document.getElementById('view');
    this.ctx = this.canvas.getContext('2d');
    this.scratch = document.createElement('canvas');
    this.music = new IGG.Music();
    this.input = new IGG.Input();
    this.club = new IGG.Club();
    this.dancer = new IGG.Dancer();
    this.hud = new IGG.HUD();
    this.settings = this._loadSettings();
    this.state = 'title';
    this.t = 0; this.songT = 0; this.beats = 0;
    this.W = 1920;
    this.hype = 0.6; this.hypeShown = 0.6;
    this.score = 0; this.scoreShown = 0;
    this.combo = 0; this.maxCombo = 0; this.comboBump = 0; this.mult = 1;
    this.counts = [0, 0, 0, 0];
    this.chart = null; this.firstLive = 0;
    this.glitchT = 0; this.shake = 0;
    this.lastSecIdx = -1;
    this.lastFrame = performance.now();
    this.frameAvg = 16; this.dprCap = 2;
    this.params = new URLSearchParams(location.search);
    this.bot = this.params.has('demo') || this.params.has('shot');
    this.pxPerSec = 560;
    this.botMiss = this.params.has('miss');

    this._bindUI();
    this.input.on((e) => this._onInput(e));
    window.addEventListener('resize', () => this._resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
    this._resize();
    const fontsReady = document.fonts && document.fonts.load ? Promise.race([document.fonts.load('40px Bangers'), new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
    fontsReady.then(() => this._resize(true));

    if (this.params.has('shot')) this._startShot(parseFloat(this.params.get('shot')) || 0);
    requestAnimationFrame((t) => this._frame(t));
  }

  // ---- Settings & UI ---------------------------------------------------------
  Game.prototype._loadSettings = function () {
    const def = { difficulty: 'normal', speed: 1, offset: 0, volume: 0.75, flash: false };
    try { return Object.assign(def, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { return def; }
  };
  Game.prototype._saveSettings = function () {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { /* storage unavailable */ }
  };

  Game.prototype._bindUI = function () {
    this.panels = {};
    document.querySelectorAll('.panel').forEach((el) => {
      this.panels[el.id] = { el, items: Array.from(el.querySelectorAll('.mi')), idx: 0 };
    });
    document.querySelectorAll('.mi').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const panel = this.panels[btn.closest('.panel').id];
        panel.idx = panel.items.indexOf(btn);
        this._focus(panel);
        if (btn.dataset.opt) this._cycle(btn.dataset.opt, 1);
        else this._act(btn.dataset.act);
      });
      btn.addEventListener('mouseenter', () => {
        const panel = this.panels[btn.closest('.panel').id];
        panel.idx = panel.items.indexOf(btn); this._focus(panel);
      });
    });
    this._refreshOptions();
    this._show('title');
  };

  Game.prototype._show = function (id) {
    for (const k in this.panels) this.panels[k].el.classList.toggle('hidden', k !== id);
    document.getElementById('ui').classList.toggle('hidden', !id);
    this.activePanel = id ? this.panels[id] : null;
    if (this.activePanel) { this.activePanel.idx = 0; this._focus(this.activePanel); }
  };
  Game.prototype._focus = function (panel) {
    panel.items.forEach((b, i) => b.classList.toggle('focus', i === panel.idx));
  };
  Game.prototype._cycle = function (key, d) {
    const o = OPTIONS[key];
    const i = o.values.indexOf(this.settings[key]);
    this.settings[key] = o.values[(Math.max(0, i) + d + o.values.length) % o.values.length];
    this._saveSettings();
    this._refreshOptions();
  };
  Game.prototype._refreshOptions = function () {
    document.querySelectorAll('[data-opt]').forEach((b) => {
      const k = b.dataset.opt;
      b.querySelector('.val').textContent = OPTIONS[k].label(this.settings[k]);
    });
    this.club.reduceFlashing = this.settings.flash;
  };
  Game.prototype._act = function (act) {
    switch (act) {
      case 'play': this.start(); break;
      case 'howto': this._show('howto'); break;
      case 'back': this._show('title'); break;
      case 'resume': this.resume(); break;
      case 'restart': this.start(); break;
      case 'quit': this.music.stop(); this.state = 'title'; this._show('title'); break;
    }
  };

  Game.prototype._onInput = function (e) {
    if (this.state === 'playing') {
      if (e.type === 'press') this._press(e.dir, this._songTimeOf(e.time), true);
      else if (e.type === 'release') this._release(e.dir, this._songTimeOf(e.time));
      else if (e.type === 'pause') this.pause();
      return;
    }
    // Menus
    if (e.type === 'press' && this.state === 'title' && !this.activePanel) return;
    const panel = this.activePanel;
    if (!panel) return;
    if (e.type === 'press') {
      if (e.src === 'pad' && (e.button === 0 || e.button === 1)) return; // A/B handled as confirm/back
      // Freestyle on the title screen: the dancer follows your inputs
      this.dancer.trigger(e.dir);
      if (e.dir === 'U' || e.dir === 'D') {
        panel.idx = (panel.idx + (e.dir === 'D' ? 1 : -1) + panel.items.length) % panel.items.length;
        this._focus(panel);
      } else {
        const it = panel.items[panel.idx];
        if (it && it.dataset.opt) this._cycle(it.dataset.opt, e.dir === 'R' ? 1 : -1);
      }
    } else if (e.type === 'confirm') {
      const it = panel.items[panel.idx];
      if (!it) return;
      if (it.dataset.opt) this._cycle(it.dataset.opt, 1); else this._act(it.dataset.act);
    } else if (e.type === 'back' || e.type === 'pause') {
      if (this.state === 'paused') this.resume();
      else if (panel.el.id === 'howto') this._show('title');
    }
  };

  // ---- Flow -------------------------------------------------------------------------
  Game.prototype._reset = function () {
    this.chart = IGG.Chart.build(this.settings.difficulty);
    this.firstLive = 0;
    this.score = 0; this.scoreShown = 0; this.combo = 0; this.maxCombo = 0; this.mult = 1;
    this.counts = [0, 0, 0, 0]; this.holdsDone = 0;
    this.hype = 0.6; this.hypeShown = 0.6;
    this.lastSecIdx = -1;
    this.pxPerSec = 560 * this.settings.speed;
    this.hud = new IGG.HUD();
    this.club.confetti = [];
  };

  Game.prototype.start = function () {
    this._reset();
    this.music.volume = this.settings.volume;
    this.music.start(0);
    this.state = 'playing';
    this._show(null);
  };
  Game.prototype._startShot = function (sec) {
    this._reset();
    this.shotStart = performance.now() / 1000 - sec;
    this.state = 'playing';
    this._show(null);
    // Pre-judge everything before the requested time so the HUD looks lived-in.
    for (const n of this.chart.notes) {
      if (n.t < sec - 0.2) { n.judged = true; this.counts[0]++; this.combo++; this.score += 300 * this.mult; this.mult = Math.min(4, 1 + Math.floor(this.combo / 16)); }
    }
    this.maxCombo = this.combo; this.scoreShown = this.score; this.hype = 0.85; this.hypeShown = 0.85;
  };
  Game.prototype.pause = function () {
    if (this.state !== 'playing' || this.shotStart != null) return;
    this.music.pause();
    this.state = 'paused';
    this._show('pause');
  };
  Game.prototype.resume = function () {
    if (this.state !== 'paused') return;
    const p = this.music.resume();
    this.state = 'playing';
    this._show(null);
    // Release any holds that were let go during the pause.
    if (p && p.then) p.then(() => { for (const d of ['L', 'U', 'D', 'R']) if (!this.input.held[d]) this._release(d, this.songT); });
  };
  Game.prototype._finish = function () {
    this.state = 'results';
    this.music.stop();
    const n = this.chart.notes.length;
    const acc = n ? (this.counts[0] + this.counts[1] * 0.7 + this.counts[2] * 0.4) / n : 0;
    const grade = acc >= 0.95 ? 'S' : acc >= 0.88 ? 'A' : acc >= 0.75 ? 'B' : acc >= 0.6 ? 'C' : 'D';
    const set = (id, v) => { document.getElementById(id).textContent = v; };
    set('r-grade', grade);
    set('r-score', String(this.score).padStart(7, '0'));
    set('r-acc', (acc * 100).toFixed(1) + '%');
    set('r-perfect', this.counts[0]); set('r-great', this.counts[1]); set('r-good', this.counts[2]); set('r-miss', this.counts[3]);
    set('r-combo', this.maxCombo);
    set('r-diff', IGG.Chart.DIFFICULTY[this.settings.difficulty].name);
    const lines = { S: 'The whole club is chanting your name.', A: 'Vista Club is losing its mind.', B: 'Solid set. The crowd wants an encore.', C: 'A few stumbles, but the vibe survived.', D: 'Rough night on the box. Shake it off and go again.' };
    set('r-line', lines[grade]);
    document.getElementById('r-grade').className = 'grade g' + grade;
    this._show('results');
    if (grade === 'S' || grade === 'A') this.club.burst(this.W / 2, 900, 200, 1.2);
  };

  Game.prototype._songTimeOf = function (perfMs) {
    if (this.shotStart != null) return perfMs / 1000 - this.shotStart;
    return this.music.songTimeAt(perfMs) - this.settings.offset / 1000;
  };

  // ---- Judging ----------------------------------------------------------------------
  Game.prototype._press = function (dir, t, fromPlayer) {
    const notes = this.chart.notes, win = this.chart.diff.windows;
    let best = null, bestD = 1e9;
    for (let i = this.firstLive; i < notes.length; i++) {
      const n = notes[i];
      if (n.t - t > win[2]) break;
      if (n.judged || n.dir !== dir) continue;
      const d = Math.abs(n.t - t);
      if (d <= win[2] && d < bestD) { best = n; bestD = d; }
    }
    if (!best) { this.dancer.trigger(dir); return; }
    const q = bestD <= win[0] ? 0 : bestD <= win[1] ? 1 : 2;
    best.judged = true;
    this._hit(best, q, t - best.t);
    if (best.end) { best.holding = true; this.dancer.trigger(dir, { hold: true }); }
    else this.dancer.trigger(dir);
  };

  Game.prototype._release = function (dir, t) {
    if (!this.chart) return;
    for (let i = this.firstLive; i < this.chart.notes.length; i++) {
      const n = this.chart.notes[i];
      if (n.t > t + 1) break;
      if (n.holding && n.dir === dir) {
        n.holding = false;
        this.dancer.release();
        if (t < n.end - 0.12) { n.broken = true; this._miss(n, true); }
        else this._holdDone(n);
      }
    }
  };

  Game.prototype._hit = function (n, q, err) {
    const J = JUDGE[q];
    this.counts[q]++;
    this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.mult = Math.min(4, 1 + Math.floor(this.combo / 16));
    this.score += J.score * this.mult;
    this.hype = clamp(this.hype + J.hype, 0, 1);
    this.comboBump = 1;
    const col = DIR_COL[this.input.device][n.dir];
    this.hud.ring(HIT_X, LANE_Y, col, q === 0);
    this.hud.judge(J.name, HIT_X + 10, LANE_Y - 92, J.color, q === 0 ? 46 : 40);
    // Borderlands-style floating score number by the dancer
    const hp = this.dancer.headPos(this.W / 2, STAGE_Y, UNIT);
    this.hud.pop('+' + J.score * this.mult, hp.x + 160 + Math.random() * 120, hp.y + Math.random() * 140, q === 0 ? P.yellow : '#fff', 40, 0.6);
    if (q === 0) {
      const hand = this.dancer.handPos(this.W / 2, STAGE_Y, UNIT, n.dir === 'R' ? 1 : 0);
      this.hud.sparkle(hand.x, hand.y, col, 7);
    }
    if (this.combo > 0 && this.combo % 50 === 0) {
      this.hud.pop(this.combo + ' COMBO!', this._calloutX(), 470, P.pink, 96, 1.3);
      this.club.burst(this.W / 2 - 330, 930, 90, 1); this.club.burst(this.W / 2 + 330, 930, 90, 1);
      this.music.cheer(this.combo % 100 === 0);
    }
  };

  Game.prototype._holdDone = function (n) {
    if (n.done) return;
    n.done = true; n.holding = false;
    this.dancer.release();
    this.holdsDone++;
    this.score += 150 * this.mult;
    this.hype = clamp(this.hype + 0.03, 0, 1);
    this.hud.pop('HOLD! +' + 150 * this.mult, HIT_X + 40, LANE_Y - 140, P.pink, 40, 0.7);
    const hp = this.dancer.headPos(this.W / 2, STAGE_Y, UNIT);
    this.hud.sparkle(hp.x, hp.y - 40, P.yellow, 14);
  };

  Game.prototype._miss = function (n, broke) {
    if (!broke) { n.judged = true; }
    this.counts[3]++;
    const lost = this.combo;
    this.combo = 0; this.mult = 1;
    this.hype = clamp(this.hype - 0.09, 0, 1);
    this.dancer.stumble();
    if (this.shotStart == null) this.music.glitch(clamp(0.35 + lost / 60, 0, 1));
    this.glitchT = 0.32; this.shake = 1;
    this.hud.judge(broke ? 'DROPPED!' : 'MISS', HIT_X + 10, LANE_Y - 92, P.red, 44);
    const hp = this.dancer.headPos(this.W / 2, STAGE_Y, UNIT);
    this.hud.pop(['WHOA!', 'OOPS!', 'EEK!', 'UH-OH!'][Math.floor(Math.random() * 4)], hp.x - 190, hp.y - 20, P.red, 58, 0.7);
  };

  Game.prototype._updatePlay = function (dt) {
    const notes = this.chart.notes, good = this.chart.diff.windows[2];
    const t = this.songT;
    if (this.bot) {
      for (let i = this.firstLive; i < notes.length; i++) {
        const n = notes[i];
        if (n.t > t) break;
        if (!n.judged && !(this.botMiss && n.id % 6 === 3)) this._press(n.dir, n.t, false);
        if (n.holding && t >= n.end) this._holdDone(n);
      }
    }
    for (let i = this.firstLive; i < notes.length; i++) {
      const n = notes[i];
      if (n.t > t) break;
      if (!n.judged && t - n.t > good) this._miss(n, false);
      if (n.holding) {
        if (t >= n.end) this._holdDone(n);
        else if (!this.bot && !this.input.held[n.dir]) { n.holding = false; n.broken = true; this.dancer.release(); this._miss(n, true); }
        else if (Math.random() < dt * 8) this.score += 5 * this.mult;
      }
    }
    while (this.firstLive < notes.length) {
      const n = notes[this.firstLive];
      if (n.judged && !n.holding && t > (n.end || n.t) + 0.3) this.firstLive++;
      else break;
    }

    // Section transitions: confetti cannons on drops
    const bar = Math.floor(t / S.BAR);
    const idx = S.SECTIONS.indexOf(S.sectionAt(bar));
    if (idx !== this.lastSecIdx && t >= 0) {
      const type = S.SECTIONS[idx].type;
      if (this.lastSecIdx >= 0) {
        if (type === 'drop' || type === 'drop2') {
          this.club.burst(this.W / 2 - 360, 930, 160, 1.3); this.club.burst(this.W / 2 + 360, 930, 160, 1.3);
          this.hud.pop(type === 'drop2' ? 'FINAL DROP!' : 'DROP!', this._calloutX(), 470, P.yellow, 120, 1.2);
          this.shake = 0.6;
        } else if (type === 'hook') {
          this.club.burst(this.W / 2 - 360, 930, 70, 1); this.club.burst(this.W / 2 + 360, 930, 70, 1);
        } else if (type === 'breakdown') {
          this.hud.pop('HOLD THE POSE!', this._calloutX(), 470, P.sky, 80, 1.4);
        }
      }
      this.lastSecIdx = idx;
    }
    if ((S.sectionAt(bar).type === 'drop2' || S.sectionAt(bar).type === 'drop') && Math.random() < dt * 30) this.club.rain(1);

    if (t > S.LENGTH + 1.5) {
      if (this.shotStart != null) this.shotStart += S.LENGTH; else this._finish();
    }
  };

  // ---- Frame ----------------------------------------------------------------------
  Game.prototype._resize = function (force) {
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    const cw = Math.round(cssW * dpr), ch = Math.round(cssH * dpr);
    if (!force && cw === this.canvas.width && ch === this.canvas.height) return;
    this.canvas.width = cw; this.canvas.height = ch;
    this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
    this.scale = ch / 1080;
    this.W = cw / this.scale;
    this.club.resize(this.W, this.scale);
    this.scratch.width = cw; this.scratch.height = ch;
  };

  Game.prototype._frame = function (now) {
    requestAnimationFrame((t) => this._frame(t));
    const dt = clamp((now - this.lastFrame) / 1000, 0, 0.1);
    this.lastFrame = now;
    this.t += dt;
    this.input.poll();

    // Adaptive resolution if we're struggling
    this.frameAvg = lerp(this.frameAvg, dt * 1000, 0.05);
    if (this.frameAvg > 24 && this.dprCap > 1 && this.t > 3) { this.dprCap = 1; this.frameAvg = 16; this._resize(true); }

    const playing = this.state === 'playing';
    if (playing || this.state === 'paused') {
      if (playing) this.songT = this._songTimeOf(now);
      this.beats = this.songT / S.BEAT;
    } else {
      this.songT = 0;
      this.beats = this.t / S.BEAT;
    }
    if (playing) this._updatePlay(dt);
    this.playing = playing;

    const bar = Math.floor(this.songT / S.BAR);
    const sec = this.state === 'title' || this.state === 'results' ? { type: 'title' } : S.sectionAt(bar);
    if (this.state !== 'paused') {
      this.dancer.setStyle(sec.type);
      this.dancer.update(dt, this.beats, this.hypeShown);
      this.club.updateConfetti(dt);
      this.hud.update(dt);
    }
    this.hypeShown = lerp(this.hypeShown, this.hype, 1 - Math.pow(0.02, dt));
    this.scoreShown = lerp(this.scoreShown, this.score, 1 - Math.pow(0.0005, dt));
    if (Math.abs(this.scoreShown - this.score) < 1) this.scoreShown = this.score;
    this.comboBump = Math.max(0, this.comboBump - dt * 6);
    this.glitchT = Math.max(0, this.glitchT - dt);
    this.shake = Math.max(0, this.shake - dt * 3);
    if (this.music.ctx && playing) this.music.setHype(this.hype);

    this._render(sec);
  };

  // Big comic callouts sit beside the dancer, not on top of her.
  Game.prototype._calloutX = function () { return this.W >= 1400 ? this.W / 2 - 500 : this.W / 2; };

  Game.prototype._energy = function (type) {
    return { intro: 0.45, groove: 0.7, hook: 0.85, break: 0.5, rise: 0.7, drop: 1, breakdown: 0.35, drop2: 1, outro: 0.6, title: 0.55 }[type] || 0.6;
  };

  Game.prototype._render = function (sec) {
    const ctx = this.ctx, W = this.W;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    let sx = 0, sy = 0;
    if (this.shake > 0) { sx = (Math.random() - 0.5) * 22 * this.shake; sy = (Math.random() - 0.5) * 16 * this.shake; }
    ctx.translate(sx, sy);

    const bar = Math.max(0, Math.floor(this.songT / S.BAR));
    const palette = PALETTES[Math.floor(bar / 2) % PALETTES.length];
    const energy = this._energy(sec.type) * (0.55 + 0.45 * this.hypeShown);
    const st = {
      t: this.t, beats: this.beats, hype: this.hypeShown, energy, palette,
      strobe: (sec.type === 'drop' || sec.type === 'drop2') && this.playing,
      lasers: sec.type === 'drop2' ? 1 : sec.type === 'drop' ? 0.5 : 0
    };
    this.club.draw(ctx, st);

    // Spotlight pool on the dancer
    const cx = W / 2;
    const pool = ctx.createRadialGradient(cx, STAGE_Y - 280, 30, cx, STAGE_Y - 280, 520);
    pool.addColorStop(0, 'rgba(255,240,220,0.20)'); pool.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = pool; ctx.fillRect(cx - 600, 0, 1200, 1080);

    const beatPh = this.beats - Math.floor(this.beats);
    const rim = palette[(Math.floor(this.beats / 4)) % palette.length];
    this.dancer.draw(ctx, cx, STAGE_Y, UNIT, { rim, pulse: Math.pow(1 - beatPh, 2) });

    this.club.drawCrowd(ctx, st);
    this.club.drawConfetti(ctx);

    if (this.state !== 'title' && this.state !== 'results') {
      this.hud.drawLane(ctx, this);
      this.hud.drawTop(ctx, this);
      if (this.songT < S.BAR * 2 && this.playing) {
        IGG.hudText(ctx, this.songT < S.BAR ? 'GET READY...' : 'HERE WE GO!', this._calloutX(), 470, 90 + 10 * Math.sin(this.t * 8), P.yellow, { align: 'center', base: 'middle' });
      }
    }
    this.hud.drawPops(ctx);

    // Vignette
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const cw = this.canvas.width, ch = this.canvas.height;
    const v = ctx.createRadialGradient(cw / 2, ch * 0.45, ch * 0.35, cw / 2, ch * 0.5, ch * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, cw, ch);

    if (this.glitchT > 0) this._glitchFX();
    if (this.hype < 0.25 && this.playing) {
      ctx.fillStyle = 'rgba(20,0,30,' + (0.25 - this.hype).toFixed(3) + ')'; ctx.fillRect(0, 0, cw, ch);
    }
  };

  // RGB-split slice displacement + scanlines when a prompt is missed.
  Game.prototype._glitchFX = function () {
    const ctx = this.ctx, cw = this.canvas.width, ch = this.canvas.height;
    const k = this.glitchT / 0.32;
    const sc = this.scratch.getContext('2d');
    sc.globalCompositeOperation = 'copy';
    sc.drawImage(this.canvas, 0, 0);
    sc.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * k;
    ctx.drawImage(this.scratch, 14 * k * this.scale, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const y = Math.random() * ch, h = (8 + Math.random() * 60) * this.scale;
      const dx = (Math.random() - 0.5) * 120 * k * this.scale;
      ctx.drawImage(this.scratch, 0, y, cw, h, dx, y, cw, h);
      if (Math.random() < 0.4) { ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,0,140,0.25)' : 'rgba(0,255,230,0.22)'; ctx.fillRect(0, y, cw, h); }
    }
    ctx.fillStyle = 'rgba(0,0,0,' + (0.18 * k).toFixed(3) + ')';
    for (let y = 0; y < ch; y += 4 * this.scale) ctx.fillRect(0, y, cw, 1.5 * this.scale);
    ctx.restore();
  };

  window.addEventListener('DOMContentLoaded', () => { IGG.game = new Game(); });
})(window.IGG);
