// "Ibiza Go-Go" — an original 4-minute swing/techno-house track, synthesized live
// with Web Audio. Style nods to the 2010 Italo swing-house sound: shuffled hats,
// a staccato reedy minor-key hook, bouncing plucked bass, chopped vocal stabs
// and big filtered builds. All melodies here are original.
(function (IGG) {
  'use strict';
  const { clamp } = IGG.util;

  const BPM = 125;
  const BEAT = 60 / BPM;          // 0.48 s
  const STEP = BEAT / 4;          // 1/16 note
  const BAR = BEAT * 4;           // 1.92 s
  const SWING = 0.18;             // fraction of a 16th that off-16ths are pushed late
  const BARS = 125;               // 125 bars * 1.92 s = 240 s = 4:00
  const TOTAL_STEPS = BARS * 16;
  const LENGTH = BARS * BAR;

  // Song map. Each section is a "stop" on the subway line shown in the HUD.
  const SECTIONS = [
    { type: 'intro',     start: 0,   len: 16, stop: 'Sant Antoni' },
    { type: 'groove',    start: 16,  len: 16, stop: 'Groove St' },
    { type: 'hook',      start: 32,  len: 16, stop: 'Americano Sq' },
    { type: 'break',     start: 48,  len: 8,  stop: 'Break Jct' },
    { type: 'rise',      start: 56,  len: 8,  stop: 'Riser Pl' },
    { type: 'drop',      start: 64,  len: 16, stop: 'Drop Av' },
    { type: 'breakdown', start: 80,  len: 8,  stop: 'Pad Yard' },
    { type: 'rise',      start: 88,  len: 8,  stop: 'Riser Pl' },
    { type: 'drop2',     start: 96,  len: 16, stop: 'Vista Club' },
    { type: 'outro',     start: 112, len: 13, stop: 'Last Train' }
  ];

  function sectionAt(bar) {
    for (let i = SECTIONS.length - 1; i >= 0; i--) if (bar >= SECTIONS[i].start) return SECTIONS[i];
    return SECTIONS[0];
  }

  // Time (seconds from song start) of a global 16th step, with swing applied.
  function stepTime(gs) {
    return gs * STEP + ((gs & 1) ? SWING * STEP : 0);
  }

  // ---- Harmony -------------------------------------------------------------
  const CHORDS = {
    Am: { root: 45, v: [57, 60, 64] },
    Dm: { root: 38, v: [57, 62, 65] },
    E7: { root: 40, v: [56, 59, 62, 64] },
    F:  { root: 41, v: [57, 60, 65] },
    G:  { root: 43, v: [55, 59, 62] },
    Em: { root: 40, v: [55, 59, 64] }
  };
  const PROG_MAIN = ['Am', 'Am', 'Dm', 'E7'];
  const PROG_SOFT = ['F', 'G', 'Em', 'Am'];

  function chordAt(bar) {
    const sec = sectionAt(bar);
    const prog = sec.type === 'breakdown' ? PROG_SOFT : PROG_MAIN;
    return CHORDS[prog[(bar - sec.start) & 3]];
  }

  // The hook: 4 bars of 16ths. [step, midi, lengthInSteps]
  const RIFF_A = [
    [0, 76, 1], [2, 76, 1], [3, 74, 1], [4, 72, 1], [6, 74, 1], [8, 76, 2], [11, 69, 1], [12, 72, 1], [14, 71, 1],
    [16, 69, 2], [19, 68, 1], [20, 69, 1], [22, 71, 1], [24, 72, 1], [26, 71, 1], [28, 68, 2],
    [32, 77, 1], [34, 77, 1], [35, 76, 1], [36, 74, 1], [38, 76, 1], [40, 77, 2], [43, 69, 1], [44, 74, 1], [46, 72, 1],
    [48, 71, 2], [51, 68, 1], [52, 71, 1], [54, 74, 1], [56, 76, 2], [60, 68, 1], [62, 71, 1]
  ];
  // Answer phrase: same first three bars, last bar runs up the scale.
  const RIFF_B = RIFF_A.slice(0, 25).concat([
    [48, 71, 1], [50, 72, 1], [52, 74, 1], [54, 76, 1], [56, 77, 1], [58, 76, 1], [60, 74, 1], [62, 80, 2]
  ]);

  const BASS_FULL = [[0, 0, 2], [3, 12, 1], [6, 0, 1], [8, 7, 1], [10, 12, 1], [12, 0, 1], [14, 10, 1]];
  const BASS_LITE = [[0, 0, 2], [6, 0, 1], [10, 12, 1]];
  const VOX = [[0, 'a', 12], [3, 'a', 12], [6, 'o', 19], [10, 'e', 15], [12, 'a', 12]];
  const VOWELS = {
    a: [800, 1150, 2900], e: [420, 1700, 2600], o: [450, 800, 2830], i: [300, 2200, 2950]
  };

  // Everything the arranger needs to know about a bar.
  function arrangement(bar) {
    const sec = sectionAt(bar);
    const b = bar - sec.start;
    const a = {
      sec, b, kick: false, kickQuarterOnly: false, clap: false, hatC: false, hatO: false, shaker: false,
      bass: false, bassPat: BASS_FULL, bassCut: 700, stabs: false, riff: false, riffCut: 3000, riffOct: false,
      brass: false, vox: false, hey: false, pads: false, piano: false, roll: false, cowbell: false
    };
    switch (sec.type) {
      case 'intro':
        a.kick = b < 15;
        a.hatC = b >= 4; a.hatO = b >= 8; a.clap = b >= 12;
        a.bass = b >= 8; a.bassPat = b < 12 ? BASS_LITE : BASS_FULL;
        a.bassCut = 180 + (b - 8) * 80;
        a.roll = b === 15;
        break;
      case 'groove':
        Object.assign(a, { kick: true, clap: true, hatC: true, hatO: true, shaker: true, bass: true, stabs: true, bassCut: 900 });
        a.vox = b >= 8;
        break;
      case 'hook':
        Object.assign(a, { kick: true, clap: true, hatC: true, hatO: true, shaker: true, bass: true, stabs: true, riff: true, brass: true, bassCut: 1000 });
        a.riffCut = 2600 + b * 120;
        break;
      case 'break':
        Object.assign(a, { clap: b >= 4, hatC: true, shaker: true, riff: true, vox: true, riffCut: 900 + b * 260 });
        break;
      case 'rise':
        a.roll = true;
        a.kick = b < 7; a.kickQuarterOnly = true;
        a.hatC = b >= 2; a.shaker = true;
        a.riff = sec.start > 60 ? b >= 2 : false; a.riffCut = 1200 + b * 500;
        a.bass = b >= 4 && b < 7; a.bassPat = BASS_LITE; a.bassCut = 500 + b * 120;
        break;
      case 'drop':
        Object.assign(a, { kick: true, clap: true, hatC: true, hatO: true, shaker: true, bass: true, stabs: true, riff: true, brass: true, vox: (b & 7) >= 4, bassCut: 1300, riffCut: 5200 });
        a.hey = (b & 3) === 0;
        break;
      case 'breakdown':
        Object.assign(a, { shaker: b >= 2, pads: true, piano: true, riff: b >= 4, riffCut: 700 + (b - 4) * 220 });
        break;
      case 'drop2':
        Object.assign(a, { kick: true, clap: true, hatC: true, hatO: true, shaker: true, bass: true, stabs: true, riff: true, riffOct: true, brass: true, vox: true, cowbell: true, bassCut: 1500, riffCut: 6500 });
        a.hey = (b & 3) === 0;
        break;
      case 'outro':
        a.kick = b < 12; a.hatC = b < 12; a.hatO = b < 8; a.clap = b < 8; a.shaker = b < 10;
        a.bass = b < 8; a.stabs = b < 8; a.vox = b < 4; a.bassCut = 1100 - b * 80;
        break;
    }
    return a;
  }

  // ---- Engine ------------------------------------------------------------------
  function Music() {
    this.ctx = null;
    this.t0 = 0;
    this.nextStep = 0;
    this.timer = null;
    this.playing = false;
    this.offsetEst = null; // songTime - perf/1000 smoother
    this.glitchUntil = 0;
    this.volume = 0.75;
  }

  Music.prototype.init = function () {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });

    // Noise buffer reused by all percussion.
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;

    // Master: comp -> master gain -> out
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 8; this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004; this.comp.release.value = 0.18;
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.comp.connect(this.master).connect(ctx.destination);
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 512;
    this.master.connect(this.analyser);

    // Hype filter: music gets muffled when the crowd loses interest.
    this.hypeLP = ctx.createBiquadFilter(); this.hypeLP.type = 'lowpass'; this.hypeLP.frequency.value = 20000; this.hypeLP.Q.value = 0.5;
    this.hypeLP.connect(this.comp);

    // Glitch chain ------------------------------------------------------------
    this.musicBus = ctx.createGain();
    this.glitchLP = ctx.createBiquadFilter(); this.glitchLP.type = 'lowpass'; this.glitchLP.frequency.value = 20000; this.glitchLP.Q.value = 3;
    this.glitchLP.connect(this.hypeLP);
    const glitchOut = ctx.createGain();
    this.crushDry = ctx.createGain(); this.crushWet = ctx.createGain(); this.crushWet.gain.value = 0;
    this.crusher = ctx.createWaveShaper();
    const curve = new Float32Array(4096);
    for (let i = 0; i < curve.length; i++) { const x = i / (curve.length - 1) * 2 - 1; curve[i] = Math.round(x * 3) / 3; }
    this.crusher.curve = curve;
    glitchOut.connect(this.crushDry).connect(this.glitchLP);
    glitchOut.connect(this.crusher).connect(this.crushWet).connect(this.glitchLP);

    this.dryG = ctx.createGain();
    this.musicBus.connect(this.dryG).connect(glitchOut);
    this.capG = ctx.createGain();
    this.stutter = ctx.createDelay(1); this.stutter.delayTime.value = STEP;
    this.fbG = ctx.createGain(); this.fbG.gain.value = 0;
    this.stutWet = ctx.createGain(); this.stutWet.gain.value = 0;
    this.musicBus.connect(this.capG).connect(this.stutter);
    this.stutter.connect(this.fbG).connect(this.stutter);
    this.stutter.connect(this.stutWet).connect(glitchOut);

    // Instrument buses
    this.drumBus = ctx.createGain(); this.drumBus.gain.value = 0.9; this.drumBus.connect(this.musicBus);
    this.side = ctx.createGain(); this.side.connect(this.musicBus); // sidechained by the kick

    // Reverb
    this.verb = ctx.createConvolver();
    this.verb.buffer = this._impulse(2.4, 2.8);
    this.verbIn = ctx.createGain(); this.verbIn.gain.value = 1;
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.32;
    this.verbIn.connect(this.verb).connect(verbOut).connect(this.musicBus);

    // Dotted-8th delay for the hook
    this.dly = ctx.createDelay(2); this.dly.delayTime.value = BEAT * 0.75;
    const dfb = ctx.createGain(); dfb.gain.value = 0.36;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    this.dlyIn = ctx.createGain();
    const dlyOut = ctx.createGain(); dlyOut.gain.value = 0.28;
    this.dlyIn.connect(this.dly); this.dly.connect(dlp).connect(dfb).connect(this.dly);
    dlp.connect(dlyOut).connect(this.side);

    // SFX bypass the glitch chain (they ARE the glitch).
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.5; this.sfx.connect(this.comp);
  };

  Music.prototype._impulse = function (secs, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * secs);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  };

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---- Instruments ---------------------------------------------------------
  Music.prototype._env = function (g, t, peak, attack, decay, sustainLvl, release, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    if (sustainLvl != null) {
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustainLvl), t + attack + decay);
      g.gain.setValueAtTime(Math.max(0.0001, peak * sustainLvl), end);
      g.gain.exponentialRampToValueAtTime(0.0001, end + release);
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }
  };

  Music.prototype._noise = function (t, dur, type, freq, q, gain, dest, attack) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + (attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5, dur + 0.05);
    return { src, f, g };
  };

  Music.prototype.kick = function (t, v) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t); g.gain.setTargetAtTime(0.0001, t + 0.06, 0.09);
    o.connect(g).connect(this.drumBus);
    o.start(t); o.stop(t + 0.6);
    this._noise(t, 0.012, 'highpass', 2500, 0.7, v * 0.35, this.drumBus);
    // Sidechain pump
    const s = this.side.gain;
    s.setValueAtTime(0.22, t); s.setTargetAtTime(1, t + 0.02, 0.075);
  };

  Music.prototype.clap = function (t, v) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1150; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.011;
      g.gain.setValueAtTime(v, tt); g.gain.exponentialRampToValueAtTime(v * 0.15, tt + 0.009);
    }
    g.gain.setValueAtTime(v, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    src.connect(f).connect(g);
    g.connect(this.drumBus); g.connect(this.verbIn);
    src.start(t, Math.random(), 0.3);
  };

  Music.prototype.hat = function (t, open, v) {
    this._noise(t, open ? 0.2 : 0.035, 'highpass', open ? 7000 : 8500, 0.6, v, this.drumBus);
  };
  Music.prototype.shaker = function (t, v) { this._noise(t, 0.055, 'bandpass', 5600, 1.3, v, this.drumBus, 0.01); };

  Music.prototype.snare = function (t, v) {
    const ctx = this.ctx;
    const n = this._noise(t, 0.14, 'bandpass', 1900, 0.7, v, this.drumBus);
    n.g.connect(this.verbIn);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    const g = ctx.createGain(); g.gain.setValueAtTime(v * 0.8, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(this.drumBus); o.start(t); o.stop(t + 0.12);
  };

  Music.prototype.cowbell = function (t, v, hi) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hi ? 900 : 760; f.Q.value = 2.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    f.connect(g).connect(this.drumBus);
    [587, 845].forEach((fr) => {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr * (hi ? 1.12 : 1);
      o.connect(f); o.start(t); o.stop(t + 0.2);
    });
  };

  Music.prototype.bass = function (t, midi, dur, cut, v) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 7;
    f.frequency.setValueAtTime(cut * 3, t); f.frequency.exponentialRampToValueAtTime(cut, t + 0.11);
    const g = ctx.createGain();
    this._env(g, t, v, 0.004, 0.09, 0.55, 0.05, t + dur);
    f.connect(g).connect(this.side);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = mtof(midi);
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = mtof(midi); o2.detune.value = -9;
    o1.connect(f); o2.connect(f);
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = mtof(midi - 12);
    const sg = ctx.createGain(); this._env(sg, t, v * 0.9, 0.004, 0.1, 0.7, 0.05, t + dur);
    sub.connect(sg).connect(this.side);
    [o1, o2, sub].forEach((o) => { o.start(t); o.stop(t + dur + 0.12); });
  };

  // Reedy clarinet-ish lead: odd harmonics (square) + vibrato + slight breath.
  Music.prototype.reed = function (t, midi, dur, cut, v, oct) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; f.Q.value = 1.4;
    const peak = ctx.createBiquadFilter(); peak.type = 'peaking'; peak.frequency.value = 1500; peak.gain.value = 5; peak.Q.value = 1;
    const g = ctx.createGain();
    this._env(g, t, v, 0.008, 0.07, 0.65, 0.04, t + dur);
    f.connect(peak).connect(g);
    g.connect(this.side); g.connect(this.dlyIn); g.connect(this.verbIn);
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(midi);
    o.frequency.setValueAtTime(mtof(midi) * 0.985, t); o.frequency.exponentialRampToValueAtTime(mtof(midi), t + 0.03);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.6;
    const lg = ctx.createGain(); lg.gain.value = 9; lfo.connect(lg).connect(o.detune);
    o.connect(f);
    const nodes = [o, lfo];
    if (oct) {
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = mtof(midi + 12); o2.detune.value = 6;
      const g2 = ctx.createGain(); g2.gain.value = 0.35; o2.connect(g2).connect(f); nodes.push(o2);
    }
    nodes.forEach((n) => { n.start(t); n.stop(t + dur + 0.1); });
    this._noise(t, 0.05, 'bandpass', 2400, 2, v * 0.12, g);
  };

  Music.prototype.brass = function (t, notes, dur, v) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.04); f.frequency.exponentialRampToValueAtTime(900, t + dur);
    const g = ctx.createGain(); this._env(g, t, v, 0.01, 0.12, 0.5, 0.08, t + dur);
    f.connect(g); g.connect(this.side); g.connect(this.verbIn);
    notes.forEach((m) => [-8, 8].forEach((dt) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m + 12); o.detune.value = dt;
      o.connect(f); o.start(t); o.stop(t + dur + 0.12);
    }));
  };

  Music.prototype.stab = function (t, notes, v) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3000;
    f.connect(g); g.connect(this.side); g.connect(this.verbIn);
    notes.forEach((m) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m);
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = mtof(m + 12);
      const g2 = ctx.createGain(); g2.gain.value = 0.18; o2.connect(g2).connect(f);
      o.connect(f); o.start(t); o.stop(t + 0.25); o2.start(t); o2.stop(t + 0.25);
    });
  };

  Music.prototype.piano = function (t, notes, v) {
    const ctx = this.ctx;
    notes.forEach((m, i) => {
      const tt = t + i * 0.012;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m + 12);
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = mtof(m + 24);
      const g = ctx.createGain(); g.gain.setValueAtTime(v, tt); g.gain.setTargetAtTime(0.0001, tt + 0.01, 0.35);
      const g2 = ctx.createGain(); g2.gain.value = 0.3;
      o.connect(g); o2.connect(g2).connect(g); g.connect(this.side); g.connect(this.verbIn);
      o.start(tt); o.stop(tt + 1.8); o2.start(tt); o2.stop(tt + 1.8);
    });
  };

  Music.prototype.pad = function (t, notes, dur, v) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1;
    f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1800, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.5);
    g.gain.setValueAtTime(v, t + dur - 0.1); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
    f.connect(g); g.connect(this.musicBus); g.connect(this.verbIn);
    notes.forEach((m) => [-11, 0, 11].forEach((dt) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt;
      o.connect(f); o.start(t); o.stop(t + dur + 0.7);
    }));
  };

  // Formant "vocal" chop.
  Music.prototype.vox = function (t, midi, vowel, dur, v, drop) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(mtof(midi), t);
    o.frequency.exponentialRampToValueAtTime(mtof(midi - (drop || 0.6)), t + dur);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6.2;
    const lg = ctx.createGain(); lg.gain.value = 14; lfo.connect(lg).connect(o.detune);
    const out = ctx.createGain(); this._env(out, t, v, 0.012, 0.05, 0.75, 0.05, t + dur);
    out.connect(this.side); out.connect(this.verbIn); out.connect(this.dlyIn);
    VOWELS[vowel].forEach((fr, i) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = 9 + i * 3;
      const bg = ctx.createGain(); bg.gain.value = [1.6, 0.9, 0.45][i];
      o.connect(bp).connect(bg).connect(out);
    });
    o.start(t); o.stop(t + dur + 0.1); lfo.start(t); lfo.stop(t + dur + 0.1);
  };

  Music.prototype.hey = function (t, v) {
    this.vox(t, 64, 'e', 0.22, v, 5);
    this.vox(t + 0.004, 52, 'e', 0.22, v * 0.7, 4);
    this._noise(t, 0.12, 'bandpass', 1600, 1.5, v * 0.25, this.side).g.connect(this.verbIn);
  };

  Music.prototype.crash = function (t, v) {
    const n = this._noise(t, 1.8, 'highpass', 4500, 0.5, v, this.drumBus);
    n.g.connect(this.verbIn);
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.8);
    const g = ctx.createGain(); g.gain.setValueAtTime(v * 1.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(this.drumBus); o.start(t); o.stop(t + 1);
  };

  Music.prototype.riser = function (t, dur, v) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(250, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur); g.gain.setValueAtTime(0.0001, t + dur + 0.01);
    src.connect(f).connect(g); g.connect(this.musicBus); g.connect(this.verbIn);
    src.start(t); src.stop(t + dur + 0.05);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + dur);
    const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 1400;
    const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(v * 0.3, t + dur); og.gain.setValueAtTime(0.0001, t + dur + 0.01);
    o.connect(of).connect(og).connect(this.musicBus); o.start(t); o.stop(t + dur + 0.05);
  };

  // ---- Sequencer -------------------------------------------------------------
  Music.prototype._scheduleStep = function (gs) {
    const bar = gs >> 4, s = gs & 15;
    const t = this.t0 + stepTime(gs);
    const A = arrangement(bar);
    const ch = chordAt(bar);
    const type = A.sec.type;

    if (bar >= BARS - 1) { // final bar: one last hit and ring out
      if (s === 0) {
        this.kick(t, 1); this.crash(t, 0.5); this.stab(t, CHORDS.Am.v, 0.3);
        this.brass(t, CHORDS.Am.v, 0.6, 0.11); this.hey(t, 0.35); this.bass(t, 45, 0.5, 900, 0.3);
      }
      return;
    }

    // Big moments
    if (s === 0 && A.b === 0 && (type === 'hook' || type === 'drop' || type === 'drop2' || type === 'groove' || type === 'outro')) this.crash(t, type === 'groove' ? 0.25 : 0.5);
    if (s === 0 && type === 'drop' && A.b === 8) this.crash(t, 0.35);
    if (s === 0 && type === 'rise' && A.b === 0) this.riser(t, BAR * 8 - BEAT, 0.22);
    if (s === 0 && type === 'intro' && A.b === 8) this.riser(t, BAR * 8 - BEAT, 0.08);

    // Drums
    if (A.kick && (s & 3) === 0) this.kick(t, 0.95);
    if (A.clap && (s === 4 || s === 12)) this.clap(t, 0.5);
    const offbeat = s === 2 || s === 6 || s === 10 || s === 14;
    if (A.hatC && !(offbeat && A.hatO)) this.hat(t, false, (s & 1) ? 0.05 : 0.09);
    if (A.hatO && offbeat) this.hat(t, true, 0.12);
    if (A.shaker) this.shaker(t, (s & 1) ? 0.07 : 0.035);
    if (A.cowbell && (s === 3 || s === 6 || s === 10 || s === 14)) this.cowbell(t, 0.11, s === 6);
    if (A.roll) {
      const b = type === 'intro' ? 7 : A.b;
      let every = b < 4 ? 4 : b < 6 ? 2 : 1;
      const lastGap = b === 7 && s >= 12;
      if (!lastGap && s % every === 0) this.snare(t, 0.08 + 0.05 * (b / 7) + 0.03 * (s / 16));
    }

    // Bass
    if (A.bass) {
      for (const [st, off, len] of A.bassPat) if (st === s) this.bass(t, ch.root + off, STEP * len * 0.85, A.bassCut, 0.32);
    }
    // Offbeat chord stabs
    if (A.stabs && (s === 2 || s === 6 || s === 10 || s === 14)) this.stab(t, ch.v, 0.07);
    // Brass accents on bar heads of odd bars, plus a cheeky push into each 4-bar turn
    if (A.brass && s === 0 && (A.b & 1) === 0) this.brass(t, ch.v, 0.32, 0.075);
    if (A.brass && (A.b & 3) === 3 && (s === 11 || s === 14)) this.brass(t, ch.v, 0.12, 0.06);

    // Hook
    if (A.riff) {
      const cycle = Math.floor(A.b / 4);
      const riff = (cycle & 1) ? RIFF_B : RIFF_A;
      const local = ((A.b & 3) << 4) | s;
      for (const [st, m, len] of riff) {
        if (st === local) {
          const quiet = type === 'break' || type === 'breakdown' || type === 'rise';
          this.reed(t, m, STEP * len * 0.78, A.riffCut, quiet ? 0.15 : 0.17, A.riffOct);
        }
      }
    }

    // Vocal chops & shouts
    if (A.vox && (type !== 'groove' || (A.b & 1))) {
      for (const [st, vw, off] of VOX) if (st === s) this.vox(t, ch.root + off, vw, STEP * 1.4, 0.16);
    }
    if (A.hey && s === 0) this.hey(t, 0.3);

    // Breakdown textures
    if (A.pads && s === 0) this.pad(t, ch.v, BAR, 0.035);
    if (A.piano && (s === 0 || s === 10)) this.piano(t, ch.v, 0.07);
  };

  Music.prototype._tick = function () {
    const ctx = this.ctx;
    const horizon = ctx.currentTime + 0.2;
    while (this.nextStep < TOTAL_STEPS && this.t0 + stepTime(this.nextStep) < horizon) {
      this._scheduleStep(this.nextStep);
      this.nextStep++;
    }
  };

  Music.prototype.start = function (fromBar) {
    this.init();
    const ctx = this.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    this.stop();
    const fb = fromBar || 0;
    const now = ctx.currentTime;
    this.t0 = now + 0.5 - fb * BAR;
    // Fade in over the tail of anything left ringing from a previous run.
    const mg = this.master.gain;
    mg.cancelScheduledValues(now); mg.setValueAtTime(0, now);
    mg.setValueAtTime(0, now + 0.45); mg.linearRampToValueAtTime(0.9 * this.volume, now + 0.5);
    [this.dryG, this.capG, this.crushDry].forEach((n) => { n.gain.cancelScheduledValues(now); n.gain.setValueAtTime(1, now); });
    [this.stutWet, this.fbG, this.crushWet].forEach((n) => { n.gain.cancelScheduledValues(now); n.gain.setValueAtTime(0, now); });
    this.glitchLP.frequency.cancelScheduledValues(now); this.glitchLP.frequency.setValueAtTime(20000, now);
    this.glitchUntil = 0;
    this.nextStep = fb * 16;
    this.offsetEst = null;
    this.playing = true;
    this.paused = false;
    this.side.gain.cancelScheduledValues(0); this.side.gain.value = 1;
    this.setHype(1);
    this._tick();
    this.timer = setInterval(() => this._tick(), 25);
  };

  Music.prototype.stop = function () {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
    if (this.ctx && this.master) {
      // Silence anything still queued; start() fades the master back in.
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + 0.05);
    }
  };

  Music.prototype.pause = function () { if (this.ctx && this.playing) { this.paused = true; return this.ctx.suspend(); } };
  Music.prototype.resume = function () {
    if (this.ctx && this.playing) { this.paused = false; this.offsetEst = null; return this.ctx.resume(); }
  };

  // Seconds since song start, as heard at the speakers, for a performance.now() timestamp.
  Music.prototype.songTimeAt = function (perfMs) {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return 0;
    if (ctx.state !== 'running') return this._frozen != null ? this._frozen : 0;
    const now = performance.now();
    let est;
    const ts = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
    if (ts && ts.performanceTime > 0 && ts.contextTime > 0) {
      est = ts.contextTime + (now - ts.performanceTime) / 1000 - this.t0;
    } else {
      est = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) - this.t0;
    }
    const off = est - now / 1000;
    if (this.offsetEst == null || Math.abs(off - this.offsetEst) > 0.05) this.offsetEst = off;
    else this.offsetEst += (off - this.offsetEst) * 0.03;
    const st = perfMs / 1000 + this.offsetEst;
    this._frozen = now / 1000 + this.offsetEst;
    return st;
  };

  // ---- Feedback FX ------------------------------------------------------------
  // A missed prompt freezes the last 1/16 of audio into a stutter loop, bit-crushes
  // and filters the mix, and fires a digital zap.
  Music.prototype.glitch = function (severity) {
    if (!this.ctx || !this.playing) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.005;
    const sev = clamp(severity || 0.5, 0, 1);
    const dur = 0.22 + sev * 0.22;
    const end = Math.max(t + dur, this.glitchUntil);
    this.glitchUntil = end;
    const set = (p, v, at, tc) => { p.cancelScheduledValues(at); p.setTargetAtTime(v, at, tc || 0.004); };
    if (Math.random() < 0.5) this.stutter.delayTime.setValueAtTime(Math.random() < 0.5 ? STEP : STEP / 2, t - 0.004);
    set(this.dryG.gain, 0, t); set(this.stutWet.gain, 1, t);
    set(this.capG.gain, 0, t, 0.001); set(this.fbG.gain, 1, t, 0.001);
    set(this.crushWet.gain, 0.5 + sev * 0.4, t); set(this.crushDry.gain, 0.4, t);
    this.glitchLP.frequency.cancelScheduledValues(t);
    this.glitchLP.frequency.setValueAtTime(700 + Math.random() * 600, t);
    this.glitchLP.frequency.exponentialRampToValueAtTime(20000, end + 0.35);
    set(this.dryG.gain, 1, end); set(this.stutWet.gain, 0, end);
    set(this.capG.gain, 1, end + 0.02, 0.001); set(this.fbG.gain, 0, end, 0.002);
    set(this.crushWet.gain, 0, end + 0.05, 0.02); set(this.crushDry.gain, 1, end + 0.05, 0.02);

    // Zap
    const o = ctx.createOscillator(); o.type = 'square';
    const g = ctx.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    for (let i = 0; i < 6; i++) o.frequency.setValueAtTime(80 + Math.random() * 900, t + i * 0.03);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.2);
  };

  // h in [0,1]: below ~0.3 the mix gets progressively muffled.
  Music.prototype.setHype = function (h) {
    if (!this.ctx) return;
    const target = h > 0.3 ? 20000 : 600 + (h / 0.3) * 6000;
    this.hypeLP.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.4);
  };

  // Crowd roar + Elrow-style whistle for combo milestones.
  Music.prototype.cheer = function (big) {
    if (!this.ctx || !this.playing) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.01;
    const n = this._noise(t, big ? 2.2 : 1.4, 'bandpass', 1300, 0.6, big ? 0.22 : 0.14, this.sfx, 0.35);
    n.g.connect(this.verbIn);
    const blow = (tt, len) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 2900;
      const tr = ctx.createOscillator(); tr.frequency.value = 32;
      const tg = ctx.createGain(); tg.gain.value = 140; tr.connect(tg).connect(o.frequency);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.05, tt + 0.02);
      g.gain.setValueAtTime(0.05, tt + len); g.gain.exponentialRampToValueAtTime(0.0001, tt + len + 0.04);
      o.connect(g).connect(this.sfx); o.start(tt); o.stop(tt + len + 0.06); tr.start(tt); tr.stop(tt + len + 0.06);
    };
    blow(t + 0.1, 0.12); blow(t + 0.3, 0.12); if (big) blow(t + 0.5, 0.35);
  };

  Music.prototype.level = function () {
    if (!this.analyser) return 0;
    const a = this._lvlBuf || (this._lvlBuf = new Uint8Array(this.analyser.frequencyBinCount));
    this.analyser.getByteFrequencyData(a);
    let s = 0; for (let i = 0; i < 12; i++) s += a[i];
    return s / (12 * 255);
  };

  IGG.Song = { BPM, BEAT, STEP, BAR, SWING, BARS, LENGTH, SECTIONS, sectionAt, stepTime, arrangement, chordAt, RIFF_A, RIFF_B, VOX, BASS_FULL };
  IGG.Music = Music;
})(window.IGG);
