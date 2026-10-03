// HUD: the prompt lane (styled as a subway platform edge), score, combo,
// hype gauge, the song-progress subway map, and comic pop-up text.
(function (IGG) {
  'use strict';
  const { clamp, lerp, easeOut, easeOutBack } = IGG.util;
  const P = IGG.PAL;
  const S = IGG.Song;
  const { hexA, star } = IGG.fx;
  const INK = '#140c1c';
  const FONT = '"Bangers", Impact, "Arial Black", sans-serif';

  const LANE_TOP = 942, LANE_BOT = 1068, LANE_Y = 1005, HIT_X = 210, NOTE_R = 42;

  const DIR_COL = { keyboard: { L: P.pink, U: P.yellow, D: P.sky, R: P.lime }, gamepad: { L: '#2f7cff', U: '#f7c823', D: '#33c45a', R: '#ef3b3b' } };
  const PAD_LETTER = { L: 'X', U: 'Y', D: 'A', R: 'B' };
  const ARROW_ANG = { R: 0, D: Math.PI / 2, L: Math.PI, U: -Math.PI / 2 };

  function comicText(ctx, str, x, y, size, fill, opts) {
    opts = opts || {};
    ctx.font = (opts.weight || '') + ' ' + size + 'px ' + FONT;
    ctx.textAlign = opts.align || 'left'; ctx.textBaseline = opts.base || 'alphabetic';
    ctx.lineJoin = 'round';
    if (opts.shadow !== false) { ctx.fillStyle = INK; ctx.fillText(str, x + size * 0.06, y + size * 0.08); }
    ctx.lineWidth = Math.max(3, size * (opts.outline || 0.16));
    ctx.strokeStyle = INK; ctx.strokeText(str, x, y);
    ctx.fillStyle = fill; ctx.fillText(str, x, y);
  }

  function arrow(ctx, x, y, r, ang, fill) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(r * 0.62, 0); ctx.lineTo(r * 0.02, -r * 0.55); ctx.lineTo(r * 0.02, -r * 0.24);
    ctx.lineTo(-r * 0.56, -r * 0.24); ctx.lineTo(-r * 0.56, r * 0.24); ctx.lineTo(r * 0.02, r * 0.24); ctx.lineTo(r * 0.02, r * 0.55);
    ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = r * 0.16; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = fill; ctx.fill();
    ctx.restore();
  }

  function badge(ctx, x, y, r, dir, device, alpha, glow) {
    const col = DIR_COL[device][dir];
    ctx.save();
    ctx.globalAlpha = alpha;
    if (glow) { ctx.shadowColor = col; ctx.shadowBlur = glow; }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    ctx.shadowBlur = 0;
    // Kandinsky ring + cel shadow crescent
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(40,10,70,0.35)'; ctx.beginPath(); ctx.arc(x + r * 0.28, y + r * 0.32, r, 0, Math.PI * 2); ctx.arc(x - r * 0.1, y - r * 0.1, r * 1.02, 0, Math.PI * 2, true); ctx.fill('evenodd');
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.45, r * 0.32, r * 0.16, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.lineWidth = r * 0.11; ctx.strokeStyle = P.cream; ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = r * 0.14; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    if (device === 'gamepad') {
      ctx.font = (r * 1.15) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = r * 0.18; ctx.strokeStyle = INK; ctx.strokeText(PAD_LETTER[dir], x, y + r * 0.06);
      ctx.fillStyle = '#fff'; ctx.fillText(PAD_LETTER[dir], x, y + r * 0.06);
      arrow(ctx, x + r * 0.72, y + r * 0.72, r * 0.42, ARROW_ANG[dir], P.cream);
    } else {
      arrow(ctx, x, y, r * 1.05, ARROW_ANG[dir], '#fff');
    }
    ctx.restore();
  }

  function HUD() {
    this.pops = [];
    this.rings = [];
    this.sparks = [];
  }

  HUD.prototype.pop = function (text, x, y, color, size, life) {
    this.pops.push({ text, x, y, color, size: size || 64, t: 0, life: life || 0.8, rot: (Math.random() - 0.5) * 0.25 });
  };
  HUD.prototype.judge = function (text, x, y, color, size) {
    this.pops = this.pops.filter((p) => !p.judge);
    this.pop(text, x, y, color, size, 0.5);
    this.pops[this.pops.length - 1].judge = true;
  };
  HUD.prototype.ring = function (x, y, color, big) { this.rings.push({ x, y, color, t: 0, big }); };
  HUD.prototype.sparkle = function (x, y, color, n) {
    for (let i = 0; i < (n || 8); i++) {
      const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, life: 0.5 + Math.random() * 0.4, color, r: 8 + Math.random() * 10 });
    }
  };
  HUD.prototype.update = function (dt) {
    for (const arr of [this.pops, this.rings, this.sparks]) {
      for (let i = arr.length - 1; i >= 0; i--) {
        const o = arr[i]; o.t += dt;
        if (o.vx != null) { o.x += o.vx * dt; o.y += o.vy * dt; o.vy += 400 * dt; o.vx *= 1 - 2 * dt; }
        if (o.t > (o.life || 0.45)) arr.splice(i, 1);
      }
    }
  };

  // ---- Lane ------------------------------------------------------------------------
  HUD.prototype.drawLane = function (ctx, g) {
    const W = g.W, songT = g.songT, speed = g.pxPerSec;
    const device = g.input.device;
    // Platform slab
    ctx.fillStyle = 'rgba(12,8,22,0.86)'; ctx.fillRect(0, LANE_TOP, W, LANE_BOT - LANE_TOP + 20);
    // Yellow tactile edge strip with bumps
    ctx.fillStyle = '#f2c230'; ctx.fillRect(0, LANE_TOP - 14, W, 14);
    ctx.fillStyle = '#c99a12';
    const off = (songT * speed) % 22;
    for (let x = -off; x < W; x += 22) { ctx.beginPath(); ctx.arc(x, LANE_TOP - 7, 3.2, 0, 7); ctx.fill(); }
    ctx.fillStyle = INK; ctx.fillRect(0, LANE_TOP, W, 4); ctx.fillRect(0, LANE_TOP - 18, W, 4);

    // Beat ticks scrolling with the chart
    const firstBeat = Math.floor(songT / S.BEAT) - 1;
    for (let b = firstBeat; b < firstBeat + 40; b++) {
      if (b < 0) continue;
      const x = HIT_X + (b * S.BEAT - songT) * speed;
      if (x > W + 10) break;
      if (x < -10) continue;
      const bar = b % 4 === 0;
      ctx.fillStyle = bar ? 'rgba(255,240,210,0.28)' : 'rgba(255,240,210,0.1)';
      ctx.fillRect(x - (bar ? 2 : 1), LANE_TOP + 10, bar ? 4 : 2, LANE_BOT - LANE_TOP - 20);
    }

    // Hit target: a Kandinsky target that pulses on the beat
    const ph = g.beats - Math.floor(g.beats);
    const pulse = g.playing ? Math.pow(1 - ph, 3) : 0;
    const R = NOTE_R + 8 + pulse * 6;
    ctx.save();
    ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(HIT_X, LANE_Y, R, 0, 7); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = P.cream; ctx.beginPath(); ctx.arc(HIT_X, LANE_Y, R, 0, 7); ctx.stroke();
    ctx.setLineDash([10, 9]); ctx.lineWidth = 3; ctx.strokeStyle = hexA(P.yellow, 0.7 + 0.3 * pulse);
    ctx.beginPath(); ctx.arc(HIT_X, LANE_Y, R - 10, g.t * 0.8, g.t * 0.8 + 7); ctx.stroke();
    ctx.setLineDash([]);
    // Held direction highlights
    ['L', 'U', 'D', 'R'].forEach((d, i) => {
      if (!g.input.held[d]) return;
      ctx.fillStyle = hexA(DIR_COL[device][d], 0.35);
      ctx.beginPath(); ctx.arc(HIT_X, LANE_Y, R - 4, -Math.PI / 2 + i * Math.PI / 2 - 0.7, -Math.PI / 2 + i * Math.PI / 2 + 0.7); ctx.lineTo(HIT_X, LANE_Y); ctx.fill();
    });
    ctx.restore();

    // Notes (drawn far-to-near so nearer ones sit on top)
    const notes = g.chart ? g.chart.notes : [];
    const vis = [];
    for (let i = g.firstLive; i < notes.length; i++) {
      const n = notes[i];
      const x = HIT_X + (n.t - songT) * speed;
      if (x > W + 80) break;
      if (n.judged && !n.holding) continue;
      vis.push([n, x]);
    }
    for (let k = vis.length - 1; k >= 0; k--) {
      const [n, x] = vis[k];
      const col = DIR_COL[device][n.dir];
      if (n.end) {
        const xe = HIT_X + (n.end - songT) * speed;
        const xs = n.holding ? HIT_X : x;
        if (xe > xs) {
          ctx.fillStyle = INK; ctx.fillRect(xs, LANE_Y - 19, xe - xs, 38);
          ctx.fillStyle = n.broken ? '#555' : col; ctx.fillRect(xs, LANE_Y - 13, xe - xs, 26);
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(xs, LANE_Y - 11, xe - xs, 6);
          // Kandinsky dots along the tail
          for (let d = xs + 30; d < xe - 10; d += 46) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(d, LANE_Y, 6, 0, 7); ctx.fill(); }
          ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(xe, LANE_Y, 19, -Math.PI / 2, Math.PI / 2); ctx.fill();
          ctx.fillStyle = n.broken ? '#555' : col; ctx.beginPath(); ctx.arc(xe, LANE_Y, 13, -Math.PI / 2, Math.PI / 2); ctx.fill();
        }
        if (n.holding) { badge(ctx, HIT_X, LANE_Y, NOTE_R + 4, n.dir, device, 1, 24 + 10 * Math.sin(g.t * 20)); continue; }
      }
      if (n.judged) continue;
      const near = clamp(1 - Math.abs(x - HIT_X) / 300, 0, 1);
      const bob = Math.sin(g.beats * Math.PI * 2) * 3 * (1 - near);
      badge(ctx, x, LANE_Y + bob, NOTE_R * (1 + near * 0.08), n.dir, device, x < HIT_X - 20 ? clamp(1 - (HIT_X - 20 - x) / 80, 0, 1) : 1, near > 0.8 ? 16 : 0);
    }

    // Hit rings
    for (const r of this.rings) {
      const k = r.t / 0.45;
      ctx.lineWidth = (r.big ? 14 : 9) * (1 - k);
      ctx.strokeStyle = hexA(r.color, 1 - k);
      ctx.beginPath(); ctx.arc(r.x, r.y, NOTE_R + easeOut(k) * (r.big ? 90 : 60), 0, 7); ctx.stroke();
    }
  };

  // ---- Score / combo / hype / progress ----------------------------------------------
  HUD.prototype.drawTop = function (ctx, g) {
    const W = g.W;
    const plate = ctx.createLinearGradient(0, 0, 0, 260);
    plate.addColorStop(0, 'rgba(8,4,16,0.7)'); plate.addColorStop(1, 'rgba(8,4,16,0)');
    ctx.fillStyle = plate; ctx.fillRect(0, 0, W, 260);
    // Score
    comicText(ctx, 'SCORE', 44, 62, 30, P.yellow);
    const sc = String(Math.floor(g.scoreShown)).padStart(7, '0');
    comicText(ctx, sc, 44, 128, 70, P.cream);
    // Multiplier badge
    const mx = 44 + ctx.measureText(sc).width + 52, my = 100;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(-0.12);
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fillStyle = g.mult > 1 ? P.red : '#3a3150'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
    comicText(ctx, 'x' + g.mult, 0, 12, 36, '#fff', { align: 'center', shadow: false });
    ctx.restore();

    // Combo
    if (g.combo >= 3) {
      const k = clamp(g.comboBump, 0, 1);
      const s = 1 + 0.25 * k;
      ctx.save(); ctx.translate(48, 220); ctx.scale(s, s); ctx.rotate(-0.05);
      comicText(ctx, String(g.combo), 0, 0, 84, g.combo >= 50 ? P.pink : P.sky);
      const w = ctx.measureText(String(g.combo)).width;
      comicText(ctx, 'COMBO!', w + 14, -6, 38, P.yellow);
      ctx.restore();
    }

    // Hype gauge
    const hw = Math.min(380, W * 0.22), hx = W - hw - 44, hy = 44;
    comicText(ctx, 'CROWD HYPE', hx, hy + 18, 30, P.yellow);
    const bx = hx, by = hy + 32, bh = 34;
    ctx.fillStyle = INK; roundRect(ctx, bx - 5, by - 5, hw + 10, bh + 10, 12); ctx.fill();
    ctx.fillStyle = '#2b2340'; roundRect(ctx, bx, by, hw, bh, 8); ctx.fill();
    const segs = 10, fill = g.hypeShown * segs;
    const cols = [P.red, P.red, P.orange, P.orange, P.yellow, P.yellow, P.lime, P.lime, P.sky, P.pink];
    for (let i = 0; i < segs; i++) {
      const f = clamp(fill - i, 0, 1);
      if (f <= 0) continue;
      const sx = bx + 4 + i * (hw - 8) / segs, sw = (hw - 8) / segs - 4;
      ctx.fillStyle = cols[i];
      ctx.fillRect(sx, by + 4, sw * f, bh - 8);
      if (i % 3 === 0) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(sx + sw / 2, by + bh / 2, 4, 0, 7); ctx.fill(); }
    }
    if (g.hypeShown > 0.9) { ctx.fillStyle = '#fff'; star(ctx, bx + hw - 10, by + 4, 12 + 4 * Math.sin(g.t * 10)); }

    // Subway-line progress map
    const narrow = W < 1400;
    const pw = narrow ? Math.min(W - 120, 760) : Math.min(760, W - 940);
    const px = W / 2 - pw / 2, py = narrow ? 300 : 70;
    const prog = clamp(g.songT / S.LENGTH, 0, 1);
    ctx.lineCap = 'round';
    ctx.lineWidth = 16; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + pw, py); ctx.stroke();
    ctx.lineWidth = 9; ctx.strokeStyle = '#5b4f7a'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + pw, py); ctx.stroke();
    ctx.strokeStyle = P.orange; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + pw * prog, py); ctx.stroke();
    const cur = S.sectionAt(Math.floor(g.songT / S.BAR));
    S.SECTIONS.forEach((sec, i) => {
      const x = px + pw * (sec.start / S.BARS);
      const passed = g.songT >= sec.start * S.BAR;
      ctx.beginPath(); ctx.arc(x, py, 9, 0, 7);
      ctx.fillStyle = passed ? '#fff' : '#9a8fb8'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      if (sec === cur) {
        comicText(ctx, sec.stop.toUpperCase(), x, py + 40, 24, P.yellow, { align: i === 0 ? 'left' : 'center' });
      }
    });
    // Little train
    const tx = px + pw * prog;
    ctx.save(); ctx.translate(tx, py - 2);
    ctx.fillStyle = P.cream; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    roundRect(ctx, -22, -18, 44, 26, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.sky; ctx.fillRect(-15, -12, 10, 8); ctx.fillRect(5, -12, 10, 8);
    ctx.beginPath(); ctx.arc(0, -5, 6, 0, 7); ctx.fillStyle = P.lime; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  };

  HUD.prototype.drawPops = function (ctx) {
    for (const s of this.sparks) {
      const k = s.t / s.life;
      ctx.fillStyle = hexA(s.color, 1 - k);
      star(ctx, s.x, s.y, s.r * (1 - k * 0.5));
    }
    for (const p of this.pops) {
      const k = p.t / p.life;
      const sc = p.t < 0.12 ? easeOutBack(p.t / 0.12) : 1;
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.translate(p.x, p.y - easeOut(k) * 60); ctx.rotate(p.rot); ctx.scale(sc, sc);
      comicText(ctx, p.text, 0, 0, p.size, p.color, { align: 'center', base: 'middle' });
      ctx.restore();
    }
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  IGG.HUD = HUD;
  IGG.HUDConst = { LANE_TOP, LANE_Y, HIT_X, NOTE_R, DIR_COL };
  IGG.hudText = comicText;
})(window.IGG);
