// Builds the prompt chart from the song itself: hooks follow the melody's
// contour, builds follow the snare roll, the breakdown gets held poses.
(function (IGG) {
  'use strict';
  const S = IGG.Song;

  const DIFFICULTY = {
    easy:   { name: 'Easy',   windows: [0.055, 0.1, 0.15],   minGap: 0.42 },
    normal: { name: 'Normal', windows: [0.045, 0.09, 0.135], minGap: 0.2 },
    hard:   { name: 'Hard',   windows: [0.04, 0.08, 0.12],   minGap: 0.09 }
  };

  const GROOVE_PATTERNS = [
    ['L', 'R', 'L', 'R'], ['U', 'D', 'U', 'D'], ['L', 'L', 'R', 'R'], ['L', 'U', 'R', 'D'],
    ['R', 'U', 'L', 'D'], ['U', 'U', 'D', 'D'], ['L', 'R', 'U', 'U'], ['R', 'L', 'D', 'D'],
    ['L', 'D', 'R', 'D'], ['U', 'L', 'U', 'R']
  ];
  const OPP = { L: 'R', R: 'L', U: 'D', D: 'U' };

  function build(diffKey) {
    const diff = DIFFICULTY[diffKey] || DIFFICULTY.normal;
    const rand = IGG.util.rng(0xC0FFEE + diffKey.length * 7919);
    const notes = [];

    function add(gs, dir, holdSteps) {
      const t = S.stepTime(gs);
      const last = notes[notes.length - 1];
      if (last) {
        const lastEnd = last.end || last.t;
        if (t - lastEnd < diff.minGap * (last.end ? 1.6 : 1)) return false;
      }
      // Avoid long runs of the same direction.
      const n = notes.length;
      if (n >= 3 && notes[n - 1].dir === dir && notes[n - 2].dir === dir && notes[n - 3].dir === dir) dir = OPP[dir];
      notes.push({ t, gs, dir, end: holdSteps ? S.stepTime(gs + holdSteps) : 0 });
      return true;
    }

    let pattern = GROOVE_PATTERNS[0], pi = 0;
    function nextGroove() { const d = pattern[pi % pattern.length]; pi++; return d; }
    function newPattern() { pattern = rand.pick(GROOVE_PATTERNS); pi = 0; }

    function grooveBar(bar, level) {
      const sets = [
        [[0]],
        [[0, 8]],
        [[0, 4, 8, 12], [0, 4, 8, 12], [0, 4, 8, 10, 12]],
        [[0, 2, 4, 8, 10, 12, 14], [0, 3, 6, 8, 12, 14], [0, 4, 6, 8, 10, 12]]
      ];
      const steps = rand.pick(sets[level]);
      if ((bar & 1) === 0) newPattern();
      for (const s of steps) add(bar * 16 + s, nextGroove());
    }

    let prevMidi = 72, lr = 'L';
    function riffBar(bar, sec, mode) {
      const b = bar - sec.start;
      const riff = (Math.floor(b / 4) & 1) ? S.RIFF_B : S.RIFF_A;
      const base = (b & 3) * 16;
      for (const [st, m] of riff) {
        if (st < base || st >= base + 16) continue;
        const local = st - base;
        const diffSemis = m - prevMidi;
        prevMidi = m;
        let include;
        if (mode === 'easy') include = (local & 7) === 0;
        else if (mode === 'normal') include = (local & 1) === 0;
        else include = true;
        if (!include) continue;
        let dir;
        if (diffSemis >= 2) dir = 'U';
        else if (diffSemis > 0) dir = 'R';
        else if (diffSemis <= -2) dir = 'D';
        else if (diffSemis < 0) dir = 'L';
        else { lr = OPP[lr]; dir = lr; }
        add(bar * 16 + local, dir);
      }
      if (mode === 'easy' && !notes.some((n) => n.gs >= bar * 16 && n.gs < bar * 16 + 16)) add(bar * 16, nextGroove());
    }

    const lvl = { easy: 0, normal: 1, hard: 2 }[diffKey];

    for (const sec of S.SECTIONS) {
      for (let b = 0; b < sec.len; b++) {
        const bar = sec.start + b;
        const gs0 = bar * 16;
        switch (sec.type) {
          case 'intro':
            if (b < 2) break;
            grooveBar(bar, b < 8 ? lvl : Math.min(3, lvl + 1) - (lvl === 0 ? 1 : 0));
            break;
          case 'groove':
            grooveBar(bar, lvl + 1);
            break;
          case 'hook':
          case 'drop':
          case 'drop2':
            if (b === 0 && sec.type !== 'hook') { add(gs0, 'D'); }
            riffBar(bar, sec, diffKey);
            break;
          case 'break':
            if (lvl === 0) add(gs0, b & 1 ? 'R' : 'L');
            else riffBar(bar, sec, lvl === 2 ? 'normal' : 'easy');
            break;
          case 'rise': {
            const every = lvl === 0 ? 8 : (b < 4 ? (lvl === 2 ? 2 : 4) : b < 6 ? (lvl === 2 ? 2 : 4) : (lvl === 2 ? 1 : 2));
            for (let s = 0; s < 16; s += every) {
              if (b === 7 && s > 8) break;
              const k = s / every;
              const seq = b < 4 ? ['L', 'R'] : b < 6 ? ['L', 'U', 'R', 'D'] : ['U', 'D'];
              add(gs0 + s, b === 7 && s === 8 ? 'U' : seq[k % seq.length]);
            }
            break;
          }
          case 'breakdown': {
            const holdDirs = ['U', 'L', 'D', 'R'];
            if (lvl === 0) { if ((b & 1) === 0) add(gs0, holdDirs[(b >> 1) & 3], 24); }
            else if (lvl === 1) { add(gs0, holdDirs[b & 3], 12); }
            else { add(gs0, holdDirs[b & 3], 8); add(gs0 + 10, 'L'); add(gs0 + 12, 'R'); add(gs0 + 14, 'U'); }
            break;
          }
          case 'outro':
            if (b < 8) grooveBar(bar, lvl + (lvl < 2 ? 1 : 0));
            else if (b < 12) grooveBar(bar, Math.max(0, lvl));
            else if (bar === S.BARS - 1) add(gs0, 'U');
            break;
        }
      }
    }
    notes.sort((a, b) => a.t - b.t);
    notes.forEach((n, i) => { n.id = i; n.judged = false; });
    return { notes, diff };
  }

  IGG.Chart = { build, DIFFICULTY };
})(window.IGG);
