// The club: a subway station turned into an Ibiza dance floor, painted as loose
// impressionist outlines (jittery multi-pass strokes and short color dabs). Three
// pre-rendered variants are cycled to make the lines "boil" like hand-drawn animation.
// Lights, lasers, the DJ, the crowd and confetti are drawn live on top.
(function (IGG) {
  'use strict';
  const { rng, clamp, lerp } = IGG.util;
  const P = IGG.PAL;

  const FOCAL = 520;      // perspective focal length (virtual px)
  const VP_Y = 395;       // horizon / vanishing point height

  function Club() {
    this.layers = [];
    this.W = 1920;
    this.confetti = [];
    this.flash = 0;
    this.reduceFlashing = false;
  }

  // ---- Sketch primitives -------------------------------------------------------
  function Sketch(ctx, r) { this.c = ctx; this.r = r; }
  Sketch.prototype.line = function (pts, color, width, passes, jit) {
    const c = this.c, r = this.r;
    passes = passes || 2; jit = jit == null ? 3 : jit;
    c.strokeStyle = color; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let p = 0; p < passes; p++) {
      c.globalAlpha = 0.45 + r() * 0.45;
      c.lineWidth = width * (0.6 + r() * 0.7);
      c.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const x = pts[i][0] + (r() - 0.5) * jit * 2, y = pts[i][1] + (r() - 0.5) * jit * 2;
        if (i === 0) c.moveTo(x, y);
        else {
          const px = pts[i - 1][0], py = pts[i - 1][1];
          c.quadraticCurveTo((px + x) / 2 + (r() - 0.5) * jit * 2, (py + y) / 2 + (r() - 0.5) * jit * 2, x, y);
        }
      }
      c.stroke();
    }
    c.globalAlpha = 1;
  };
  Sketch.prototype.seg = function (x1, y1, x2, y2, color, width, passes, jit) { this.line([[x1, y1], [x2, y2]], color, width, passes, jit); };
  Sketch.prototype.quad = function (q, color, width, passes, jit) { this.line([q[0], q[1], q[2], q[3], q[0]], color, width, passes, jit); };
  Sketch.prototype.ellipse = function (cx, cy, rx, ry, color, width, passes, jit) {
    const pts = [];
    const n = 18, a0 = this.r() * 6.28;
    for (let i = 0; i <= n + 1; i++) { const a = a0 + i / n * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    this.line(pts, color, width, passes, jit);
  };
  // Short directional brush strokes inside a quad (impressionist texture).
  Sketch.prototype.dabs = function (q, colors, count, len, width, alpha, angle) {
    const c = this.c, r = this.r;
    c.save();
    c.beginPath(); c.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) c.lineTo(q[i][0], q[i][1]); c.closePath(); c.clip();
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    q.forEach(([x, y]) => { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); });
    c.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const x = lerp(minx, maxx, r()), y = lerp(miny, maxy, r());
      const a = (angle == null ? r() * Math.PI : angle + (r() - 0.5) * 0.6);
      const l = len * (0.5 + r());
      c.strokeStyle = colors[Math.floor(r() * colors.length)];
      c.globalAlpha = alpha * (0.5 + r() * 0.5);
      c.lineWidth = width * (0.6 + r() * 0.8);
      c.beginPath(); c.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2); c.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2); c.stroke();
    }
    c.restore();
    c.globalAlpha = 1;
  };
  Sketch.prototype.text = function (str, x, y, size, color, passes, font) {
    const c = this.c, r = this.r;
    c.font = (font || '900 ') + size + 'px "Bangers", Impact, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.strokeStyle = color; c.lineJoin = 'round';
    for (let i = 0; i < (passes || 2); i++) {
      c.globalAlpha = 0.55 + r() * 0.4;
      c.lineWidth = 1.2 + r() * 1.6;
      c.strokeText(str, x + (r() - 0.5) * 3, y + (r() - 0.5) * 3);
    }
    c.globalAlpha = 1;
  };

  // ---- Scene geometry ----------------------------------------------------------
  Club.prototype.proj = function (X, Y, Z) { return [this.W / 2 + X / Z * FOCAL, VP_Y + Y / Z * FOCAL]; };

  Club.prototype.resize = function (W, pxScale) {
    this.W = W;
    const s = Math.min(pxScale, 1.5);
    this.layers = [0, 1, 2].map((v) => {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(W * s); cv.height = Math.ceil(1080 * s);
      const ctx = cv.getContext('2d');
      ctx.scale(s, s);
      this._paint(ctx, rng(1234 + v * 977), W, rng(42));
      return cv;
    });
  };

  // layoutR is shared by all variants so objects stay put; r adds the per-variant jitter.
  Club.prototype._paint = function (c, r, W, layoutR) {
    const sk = new Sketch(c, r);
    const pr = (X, Y, Z) => this.proj(X, Y, Z);
    const cx = W / 2;
    const L = layoutR;

    // Atmosphere
    const g = c.createLinearGradient(0, 0, 0, 1080);
    g.addColorStop(0, '#0b0818'); g.addColorStop(0.45, '#160f2c'); g.addColorStop(1, '#0d0a19');
    c.fillStyle = g; c.fillRect(0, 0, W, 1080);
    sk.dabs([[0, 0], [W, 0], [W, 1080], [0, 1080]], ['#2a1a55', '#3b1d4f', '#14244a', '#3d2440'], 900, 60, 14, 0.35);
    const warm = c.createRadialGradient(cx, VP_Y + 60, 20, cx, VP_Y + 60, 520);
    warm.addColorStop(0, 'rgba(255,140,60,0.35)'); warm.addColorStop(1, 'rgba(255,140,60,0)');
    c.fillStyle = warm; c.fillRect(0, 0, W, 1080);

    const ZN = 1.0, ZF = 7.5;
    const Yc = -0.95, Yf = 1.0, Yt = 1.35; // ceiling, platform floor, track bed

    // Ceiling beams and fluorescent tubes
    for (let i = -6; i <= 6; i++) {
      const X = i * 0.55;
      const a = pr(X, Yc, ZN * 0.6), b = pr(X, Yc, ZF);
      sk.seg(a[0], a[1], b[0], b[1], '#5d4f8f', 3, 2, 4);
    }
    for (const Z of [1.3, 1.8, 2.5, 3.5, 5]) {
      const a = pr(-3.6, Yc, Z), b = pr(3.6, Yc, Z);
      sk.seg(a[0], a[1], b[0], b[1], '#4a3c7a', 2.5, 2, 3);
      for (const X of [-0.9, 0.9]) {
        const t1 = pr(X - 0.35, Yc + 0.04, Z), t2 = pr(X + 0.35, Yc + 0.04, Z);
        sk.seg(t1[0], t1[1], t2[0], t2[1], '#fff6c8', 6 / Z + 2, 3, 2);
      }
    }

    // Back wall (far end): tile, mosaic name band, route bullets
    const bw = [pr(-3.2, Yc, ZF), pr(3.2, Yc, ZF), pr(3.2, Yt, ZF), pr(-3.2, Yt, ZF)];
    sk.dabs(bw, ['#e8e2ff', '#bcd2ff', '#ffe2c4'], 260, 10, 3, 0.25, 0);
    for (let y = bw[0][1]; y < bw[2][1]; y += 9) sk.seg(bw[0][0], y, bw[1][0], y, '#9aa6d8', 1, 1, 1.5);
    for (let x = bw[0][0]; x < bw[1][0]; x += 16) sk.seg(x, bw[0][1], x, bw[2][1], '#7f88c0', 0.8, 1, 1.5);
    const bandY = lerp(bw[0][1], bw[2][1], 0.3);
    c.fillStyle = 'rgba(160,40,60,0.55)'; c.fillRect(cx - 150, bandY - 15, 300, 30);
    sk.quad([[cx - 150, bandY - 15], [cx + 150, bandY - 15], [cx + 150, bandY + 15], [cx - 150, bandY + 15]], '#ffcf7a', 2, 2, 2);
    sk.text('IBIZA  ·  161 ST', cx, bandY + 1, 22, '#fff4dc', 3);

    // DJ booth
    const booth = [[cx - 150, VP_Y + 40], [cx + 150, VP_Y + 40], [cx + 160, VP_Y + 92], [cx - 160, VP_Y + 92]];
    c.fillStyle = 'rgba(20,10,30,0.85)'; c.beginPath(); booth.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.fill();
    sk.quad(booth, '#ff9d5c', 3, 3, 3);
    sk.dabs(booth, [P.yellow, P.red, P.blue], 50, 14, 4, 0.5);
    sk.ellipse(cx - 85, VP_Y + 36, 34, 7, '#cfd6ff', 2, 2, 1.5);
    sk.ellipse(cx + 85, VP_Y + 36, 34, 7, '#cfd6ff', 2, 2, 1.5);
    // Speaker stacks
    for (const s of [-1, 1]) {
      const x0 = cx + s * 215;
      const q = [[x0 - 38, VP_Y - 60], [x0 + 38, VP_Y - 60], [x0 + 38, VP_Y + 92], [x0 - 38, VP_Y + 92]];
      c.fillStyle = 'rgba(10,6,20,0.8)'; c.fillRect(x0 - 38, VP_Y - 60, 76, 152);
      sk.quad(q, '#8c7cff', 2.5, 2, 2.5);
      sk.ellipse(x0, VP_Y - 20, 22, 22, '#b6a8ff', 2, 2, 2);
      sk.ellipse(x0, VP_Y + 48, 28, 28, '#b6a8ff', 2, 2, 2);
    }

    // Track beds and rails on both sides; platform with yellow edge strips
    for (const s of [-1, 1]) {
      for (const X of [1.95, 2.6, 3.0, 3.65]) {
        const a = pr(s * X, Yt, ZN * 0.75), b = pr(s * X, Yt, ZF);
        sk.seg(a[0], a[1], b[0], b[1], '#8b8fb0', 2.5, 2, 3);
      }
      for (let Z = 0.9; Z < ZF; Z *= 1.18) { // sleepers
        const a = pr(s * 1.85, Yt, Z), b = pr(s * 3.8, Yt, Z);
        sk.seg(a[0], a[1], b[0], b[1], '#4a3a3a', 6 / Z, 1, 2);
      }
      const e1 = pr(s * 1.6, Yf, ZN * 0.62), e2 = pr(s * 1.6, Yf, ZF);
      sk.seg(e1[0], e1[1], e2[0], e2[1], '#ffd23a', 7, 3, 3);
      const e3 = pr(s * 1.6, Yt, ZN * 0.62), e4 = pr(s * 1.6, Yt, ZF);
      sk.seg(e3[0], e3[1], e4[0], e4[1], '#6d5a8c', 3, 2, 3);
    }
    const plat = [pr(-1.6, Yf, ZN * 0.62), pr(1.6, Yf, ZN * 0.62), pr(1.6, Yf, ZF), pr(-1.6, Yf, ZF)];
    sk.dabs(plat, ['#3a2f5c', '#4b3a6b', '#5a3a4f', '#2f3a66'], 700, 30, 7, 0.55, 0);
    for (let Z = 1.2; Z < ZF; Z *= 1.35) { const a = pr(-1.6, Yf, Z), b = pr(1.6, Yf, Z); sk.seg(a[0], a[1], b[0], b[1], '#4f4380', 1.5, 1, 2); }

    // Subway train on the left track, covered in graffiti
    const tx0 = -2.05, ty0 = -0.55, ty1 = 1.15;
    const car = [pr(tx0, ty0, 0.95), pr(tx0, ty0, ZF), pr(tx0, ty1, ZF), pr(tx0, ty1, 0.95)];
    c.fillStyle = 'rgba(40,40,60,0.6)'; c.beginPath(); car.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.fill();
    sk.dabs(car, ['#9aa0b8', '#6c7090', '#c0c4d8'], 500, 26, 5, 0.35, 0.2);
    sk.quad(car, '#c9cde8', 3, 3, 4);
    for (let i = 0; i < 9; i++) {
      const z1 = 1.05 * Math.pow(1.24, i), z2 = z1 * 1.13;
      if (z2 > ZF) break;
      const win = [pr(tx0, -0.38, z1), pr(tx0, -0.38, z2), pr(tx0, 0.12, z2), pr(tx0, 0.12, z1)];
      c.fillStyle = 'rgba(255,214,140,0.35)'; c.beginPath(); win.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.fill();
      sk.quad(win, '#ffe6a8', 2.5, 2, 2);
    }
    // Graffiti: bubbly colored squiggles along the lower car body
    const gcols = [P.pink, P.lime, P.sky, P.orange, P.yellow, '#ff6bff'];
    for (let i = 0; i < 7; i++) {
      const z = 1.05 * Math.pow(1.3, i), z2 = z * 1.22;
      if (z2 > ZF) break;
      const col = gcols[Math.floor(L() * gcols.length)], col2 = gcols[Math.floor(L() * gcols.length)];
      const letters = 3 + Math.floor(L() * 3);
      for (let k = 0; k < letters; k++) {
        const zz = lerp(z, z2, (k + 0.5) / letters);
        const [x, y] = pr(tx0, 0.5 + (L() - 0.5) * 0.15, zz);
        const rx = 0.42 / zz / letters * FOCAL * 0.9, ry = 0.24 / zz * FOCAL * (0.8 + L() * 0.4);
        c.fillStyle = col; c.globalAlpha = 0.55;
        c.beginPath(); c.ellipse(x, y, rx, ry, -0.35, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
        sk.ellipse(x, y, rx, ry, '#120a1c', 3, 1, 1.5);
        sk.ellipse(x - rx * 0.15, y - ry * 0.1, rx * 0.8, ry * 0.8, col2, 2, 2, 1.5);
      }
    }
    const tagA = pr(tx0, 0.62, 1.15);
    c.save(); c.translate(tagA[0], tagA[1]); c.transform(1, -0.38, 0, 1, 0, 0);
    sk.text('GO-GO!', 70, 0, 84, P.yellow, 3); sk.text('GO-GO!', 74, 4, 84, P.pink, 2);
    c.restore();

    // Right-hand wall: tiles, posters
    const rw = [pr(3.9, Yc, 0.95), pr(3.9, Yc, ZF), pr(3.9, Yt, ZF), pr(3.9, Yt, 0.95)];
    sk.dabs(rw, ['#dcd6ff', '#b8c6f2', '#f2dccb'], 380, 18, 4, 0.18, 1.2);
    for (let Y = Yc; Y < Yt; Y += 0.18) { const a = pr(3.9, Y, 0.95), b = pr(3.9, Y, ZF); sk.seg(a[0], a[1], b[0], b[1], '#7680b8', 1.2, 1, 2); }
    const posterCols = [P.red, P.blue, P.teal, P.orange, P.violet];
    for (let i = 0; i < 4; i++) {
      const z = 1.15 * Math.pow(1.5, i), z2 = z * 1.25;
      const q = [pr(3.9, -0.55, z), pr(3.9, -0.55, z2), pr(3.9, 0.45, z2), pr(3.9, 0.45, z)];
      c.fillStyle = posterCols[i]; c.globalAlpha = 0.45; c.beginPath(); q.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.fill(); c.globalAlpha = 1;
      sk.quad(q, '#fff0d0', 2.5, 2, 2);
      const m = pr(3.9, -0.05, (z + z2) / 2);
      sk.ellipse(m[0], m[1], 26 / z, 40 / z, gcols[i], 3, 2, 2);
    }

    // Steel I-beam columns along both platform edges
    for (const Z of [1.25, 1.75, 2.45, 3.4, 4.7, 6.4]) {
      for (const s of [-1, 1]) {
        const X = s * 1.45;
        const top = pr(X, Yc, Z), bot = pr(X, Yf, Z);
        const w = 0.09 / Z * FOCAL;
        c.fillStyle = 'rgba(16,40,36,0.7)'; c.fillRect(top[0] - w, top[1], w * 2, bot[1] - top[1]);
        sk.seg(top[0] - w, top[1], bot[0] - w, bot[1], '#3fd6a8', 3, 2, 2.5);
        sk.seg(top[0] + w, top[1], bot[0] + w, bot[1], '#3fd6a8', 3, 2, 2.5);
        sk.seg(top[0], top[1], bot[0], bot[1], '#1f8f72', 1.5, 1, 2);
        for (let k = 0; k < 6; k++) { const y = lerp(top[1], bot[1], 0.1 + k * 0.16); c.fillStyle = '#9ff5d8'; c.globalAlpha = 0.7; c.fillRect(top[0] - w * 0.7, y, 2.4, 2.4); c.fillRect(top[0] + w * 0.6, y, 2.4, 2.4); c.globalAlpha = 1; }
        if (Z === 1.75 || Z === 3.4) { // station name plates
          const py = lerp(top[1], bot[1], 0.32), pw = w * 4.2, ph = w * 1.6;
          c.fillStyle = '#111018'; c.fillRect(top[0] - pw / 2, py - ph / 2, pw, ph);
          sk.quad([[top[0] - pw / 2, py - ph / 2], [top[0] + pw / 2, py - ph / 2], [top[0] + pw / 2, py + ph / 2], [top[0] - pw / 2, py + ph / 2]], '#f4f4f4', 1.5, 2, 1.5);
          c.save(); c.fillStyle = '#f4f4f4'; c.font = '700 ' + Math.round(ph * 0.62) + 'px Helvetica, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(Z === 1.75 ? (s < 0 ? '161 St' : 'Ibiza') : 'Bronx', top[0], py + 1); c.restore();
        }
      }
    }

    // Hanging direction signs
    for (const [Z, txt, bullets, X0, X1] of [[2.1, '↑ Uptown & The Dance Floor', [P.lime, P.orange], -2.25, -0.4], [3.6, 'Downtown & Sant Antoni', [P.red, P.blue], 0.45, 2.3]]) {
      const a = pr(X0, Yc + 0.08, Z), b = pr(X1, Yc + 0.3, Z);
      c.fillStyle = 'rgba(10,10,14,0.88)'; c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      sk.quad([[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]], '#e8e8f0', 2, 2, 2);
      const h = b[1] - a[1];
      bullets.forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(a[0] + h * (0.55 + i * 0.95), (a[1] + b[1]) / 2, h * 0.36, 0, 7); c.fill(); });
      c.fillStyle = '#f2f2f6'; c.font = '700 ' + Math.round(h * 0.42) + 'px Helvetica, Arial, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(txt, a[0] + h * 2.2, (a[1] + b[1]) / 2 + 1);
      sk.seg(a[0] + 10, a[1], a[0] + 10, pr(0, Yc, Z)[1], '#777', 1.5, 1, 1);
      sk.seg(b[0] - 10, a[1], b[0] - 10, pr(0, Yc, Z)[1], '#777', 1.5, 1, 1);
    }

    // Bunting garlands across the ceiling
    const bcols = [P.red, P.yellow, P.blue, P.teal, P.pink, P.orange];
    for (const Z of [1.45, 2.8]) {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const X = lerp(-3.4, 3.4, i / 24);
        const sag = 0.28 * (1 - Math.pow((i / 24) * 2 - 1, 2));
        pts.push(pr(X, Yc + 0.1 + sag, Z));
      }
      sk.line(pts, '#cfc0ff', 1.5, 1, 1.5);
      for (let i = 0; i < 24; i++) {
        const p1 = pts[i], p2 = pts[i + 1];
        const h = 34 / Z;
        c.fillStyle = bcols[(i + (Z > 2 ? 3 : 0)) % bcols.length]; c.globalAlpha = 0.6;
        c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 + h); c.closePath(); c.fill();
        c.globalAlpha = 1;
        sk.line([p1, [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 + h], p2], '#fff3e0', 1.2, 1, 1.5);
      }
    }

    // Giant inflatables: a subway rat (top right) and a pizza slice (top left)
    this._rat(sk, W - 300, 150, 1);
    this._pizza(sk, 270, 160);
  };

  Club.prototype._rat = function (sk, x, y, s) {
    const col = '#d9b8d8';
    sk.ellipse(x, y, 150 * s, 70 * s, col, 4, 3, 5);
    sk.ellipse(x - 150 * s, y - 20 * s, 62 * s, 48 * s, col, 4, 3, 4);
    sk.ellipse(x - 170 * s, y - 70 * s, 26 * s, 30 * s, '#ff9ad0', 3.5, 3, 3);
    sk.ellipse(x - 120 * s, y - 72 * s, 26 * s, 30 * s, '#ff9ad0', 3.5, 3, 3);
    sk.ellipse(x - 168 * s, y - 28 * s, 7 * s, 9 * s, '#ff3060', 4, 2, 1);
    sk.ellipse(x - 210 * s, y - 8 * s, 8 * s, 6 * s, '#ff8ab0', 4, 2, 1);
    sk.line([[x + 145 * s, y + 10 * s], [x + 230 * s, y + 50 * s], [x + 260 * s, y - 30 * s], [x + 310 * s, y - 10 * s]], col, 4, 3, 4);
    sk.dabs([[x - 150, y - 60], [x + 150, y - 60], [x + 150, y + 60], [x - 150, y + 60]], ['#c6a1c8', '#e9c9ea', '#9f7bb5'], 120, 18, 5, 0.35, 0.3);
    for (const dx of [-60, 40]) sk.seg(x + dx * s, y + 62 * s, x + dx * s + 8, y + 95 * s, col, 4, 2, 2);
    sk.seg(x, y - 70 * s, x - 20, -10, '#888', 1.2, 1, 1);
  };
  Club.prototype._pizza = function (sk, x, y) {
    sk.line([[x - 130, y - 50], [x + 130, y - 70], [x + 10, y + 120], [x - 130, y - 50]], '#ffb347', 4, 3, 4);
    sk.line([[x - 135, y - 55], [x + 135, y - 75]], '#c97a2c', 12, 3, 3);
    for (const [dx, dy] of [[-50, -15], [30, -20], [0, 45], [60, -45]]) sk.ellipse(x + dx, y + dy, 16, 14, P.red, 4, 2, 2);
    sk.dabs([[x - 120, y - 45], [x + 120, y - 62], [x + 10, y + 110]], ['#ffd76a', '#ffcf4d', '#ffe9a3'], 90, 16, 5, 0.45);
    sk.seg(x, y - 62, x + 20, -10, '#888', 1.2, 1, 1);
  };

  // ---- Live layer --------------------------------------------------------------
  // st: { beats, bar, sec, hype, energy, rim, t, combo }
  Club.prototype.draw = function (ctx, st) {
    const W = this.W, cx = W / 2;
    const boil = Math.floor(st.t * 8) % 3;
    if (this.layers.length) ctx.drawImage(this.layers[boil], 0, 0, W, 1080);

    const beatPh = st.beats - Math.floor(st.beats);
    const kick = Math.pow(1 - beatPh, 4) * st.energy;
    const cols = st.palette;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Pulsing color wash from the DJ end
    const wash = ctx.createRadialGradient(cx, VP_Y + 40, 10, cx, VP_Y + 40, 700);
    wash.addColorStop(0, hexA(cols[0], 0.25 + 0.35 * kick)); wash.addColorStop(1, hexA(cols[0], 0));
    ctx.fillStyle = wash; ctx.fillRect(0, 0, W, 1080);

    // Moving-head beams from the ceiling
    const nB = 6;
    for (let i = 0; i < nB; i++) {
      const ox = cx + (i - (nB - 1) / 2) * (W / (nB + 1));
      const oy = 40;
      const sweep = Math.sin(st.t * (0.6 + i * 0.07) + i * 1.3) * 0.6 + (i < nB / 2 ? 0.25 : -0.25);
      const ang = Math.PI / 2 + sweep;
      const len = 1100, spread = 0.07 + 0.03 * Math.sin(st.t + i);
      const col = cols[i % cols.length];
      const a1 = ang - spread, a2 = ang + spread;
      const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(ang) * len, oy + Math.sin(ang) * len);
      const inten = (0.12 + 0.22 * st.energy) * (0.6 + 0.4 * kick);
      g.addColorStop(0, hexA(col, inten)); g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a1) * len, oy + Math.sin(a1) * len);
      ctx.lineTo(ox + Math.cos(a2) * len, oy + Math.sin(a2) * len);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = hexA(col, 0.8); ctx.beginPath(); ctx.arc(ox, oy, 7, 0, 7); ctx.fill();
    }

    // Lasers in the big drops
    if (st.lasers > 0) {
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const a = Math.PI * (0.06 + 0.88 * i / 13) + Math.sin(st.t * 1.7 + i * 0.4) * 0.08;
        const ox = cx, oy = VP_Y + 30;
        const col = i & 1 ? '#3dff9a' : '#ff3da5';
        ctx.strokeStyle = hexA(col, 0.55 * st.lasers * (0.5 + 0.5 * Math.sin(st.t * 9 + i)));
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a) * 1600, oy - Math.sin(a) * 700 + 260); ctx.stroke();
      }
    }
    ctx.restore();

    // DJ silhouette nodding to the beat
    this._dj(ctx, cx, VP_Y + 38, st.beats);

    // Disco ball
    this._disco(ctx, cx - 430, 128, st.t, cols);

    // Strobe in the drops
    if (st.strobe && !this.reduceFlashing && beatPh < 0.06) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(0, 0, W, 1080);
    }
  };

  Club.prototype._dj = function (ctx, x, y, beats) {
    const bob = Math.abs(Math.sin(beats * Math.PI)) * 6;
    ctx.save();
    ctx.translate(x, y - bob);
    ctx.fillStyle = '#07050d';
    ctx.strokeStyle = '#ff9d5c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -40, 15, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-30, 2); ctx.quadraticCurveTo(-28, -24, 0, -24); ctx.quadraticCurveTo(28, -24, 30, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -42, 17, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    // One arm up on the downbeats
    const up = (beats % 4) < 1 ? 1 : 0;
    ctx.strokeStyle = '#ff9d5c'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(22, -16); ctx.lineTo(up ? 40 : 34, up ? -62 : 0); ctx.stroke();
    ctx.restore();
  };

  Club.prototype._disco = function (ctx, x, y, t, cols) {
    ctx.save();
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y - 34); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 34, 0, 7); ctx.fillStyle = '#3b3550'; ctx.fill();
    ctx.save(); ctx.clip();
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
      const k = Math.sin(i * 3.1 + j * 1.7 + t * 4);
      ctx.fillStyle = k > 0.7 ? '#ffffff' : k > 0.2 ? '#b7b2d6' : '#6f6890';
      ctx.fillRect(x + i * 8 + ((t * 20) % 8) - 4, y + j * 8 - 4, 7, 7);
    }
    ctx.restore();
    ctx.strokeStyle = '#d8d0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 34, 0, 7); ctx.stroke();
    // Glints
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const a = t * 0.8 + i * 1.256, r = 34;
      const gx = x + Math.cos(a) * r * 0.7, gy = y + Math.sin(a * 1.3) * r * 0.6;
      ctx.fillStyle = hexA(cols[i % cols.length], 0.9);
      star(ctx, gx, gy, 9 + 4 * Math.sin(t * 6 + i));
    }
    ctx.restore();
  };

  // Crowd in the foreground, drawn as boiling sketch outlines.
  Club.prototype.drawCrowd = function (ctx, st) {
    const W = this.W, cx = W / 2;
    const boil = Math.floor(st.t * 8);
    const n = Math.max(6, Math.round(W / 105));
    const beatPh = st.beats - Math.floor(st.beats);
    for (let i = 0; i < n; i++) {
      const pr = rng(i * 7919 + 13);
      let x = (i + 0.5) / n * W + (pr() - 0.5) * 40;
      if (Math.abs(x - cx) < 230) continue; // leave room for the go-go box
      const scale = 0.85 + pr() * 0.4;
      const y = 1000 + pr() * 30;
      const r = rng(i * 131 + boil * 17);
      const sk = new Sketch(ctx, r);
      const bounce = Math.pow(Math.max(0, Math.cos(beatPh * Math.PI * 2)), 2) * 14 * (0.4 + st.hype) * (pr() < 0.5 ? 1 : 0.7);
      const hy = y - 200 * scale - bounce;
      const col = st.palette[i % st.palette.length];
      // Shadow fill for readability
      ctx.fillStyle = 'rgba(8,4,16,0.85)';
      ctx.beginPath(); ctx.ellipse(x, hy + 120 * scale, 58 * scale, 110 * scale, 0, Math.PI, 0); ctx.lineTo(x + 58 * scale, 1080); ctx.lineTo(x - 58 * scale, 1080); ctx.fill();
      ctx.beginPath(); ctx.arc(x, hy, 26 * scale, 0, 7); ctx.fill();
      sk.ellipse(x, hy, 26 * scale, 28 * scale, col, 3, 2, 2.5);
      sk.line([[x - 58 * scale, 1080], [x - 56 * scale, hy + 90 * scale], [x - 30 * scale, hy + 44 * scale], [x + 30 * scale, hy + 44 * scale], [x + 56 * scale, hy + 90 * scale], [x + 58 * scale, 1080]], col, 3, 2, 3);
      // Arms up when the crowd is hyped
      const handsUp = pr() < st.hype * 1.1;
      if (handsUp) {
        const wave = Math.sin(st.t * 3 + i) * 12;
        for (const s of [-1, 1]) {
          if (pr() < 0.3 && s > 0) continue;
          const sx = x + s * 44 * scale, sy = hy + 56 * scale;
          sk.line([[sx, sy], [sx + s * 30 * scale + wave, sy - 70 * scale], [sx + s * 22 * scale + wave, sy - 130 * scale]], col, 4, 2, 2.5);
          sk.ellipse(sx + s * 22 * scale + wave, sy - 138 * scale, 9 * scale, 9 * scale, col, 2.5, 1, 1.5);
        }
      }
    }
  };

  // ---- Confetti ---------------------------------------------------------------
  Club.prototype.burst = function (x, y, count, power) {
    const cols = [P.red, P.yellow, P.blue, P.teal, P.pink, P.orange, P.cream, P.lime];
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const v = (300 + Math.random() * 700) * (power || 1);
      this.confetti.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18,
        flip: Math.random() * 6, vf: 6 + Math.random() * 10, w: 7 + Math.random() * 8, h: 4 + Math.random() * 5,
        col: cols[Math.floor(Math.random() * cols.length)], life: 4 + Math.random() * 3
      });
    }
    if (this.confetti.length > 900) this.confetti.splice(0, this.confetti.length - 900);
  };
  Club.prototype.rain = function (count) {
    for (let i = 0; i < count; i++) {
      this.burst(Math.random() * this.W, -20, 1, 0.05);
    }
  };
  Club.prototype.updateConfetti = function (dt) {
    const c = this.confetti;
    for (let i = c.length - 1; i >= 0; i--) {
      const p = c[i];
      p.vx *= 1 - 1.6 * dt; p.vy = p.vy * (1 - 1.6 * dt) + 520 * dt;
      p.vy = Math.min(p.vy, 140 + Math.sin(p.flip) * 40);
      p.x += (p.vx + Math.sin(p.flip * 0.7) * 40) * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt; p.flip += p.vf * dt; p.life -= dt;
      if (p.life <= 0 || p.y > 1100) c.splice(i, 1);
    }
  };
  Club.prototype.drawConfetti = function (ctx) {
    for (const p of this.confetti) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(Math.cos(p.flip), 1);
      ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
  };

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + clamp(a, 0, 1).toFixed(3) + ')';
  }
  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, rr = i & 1 ? r * 0.25 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  IGG.Club = Club;
  IGG.fx = { hexA, star, Sketch };
})(window.IGG);
