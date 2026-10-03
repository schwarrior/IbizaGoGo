// The go-go dancer: a 2D skeletal rig rendered in a comic cel-shaded style —
// heavy ink outlines, hard-edged shadow shapes, ink hatching inside the shadows
// and a colored club rim-light. Costume and make-up use Kandinsky-like geometry.
(function (IGG) {
  'use strict';
  const { clamp, lerp, rot, smoothClosed, smoothOpen, ik2, easeOut, easeOutBack } = IGG.util;
  const P = IGG.PAL;

  // ---- Look ------------------------------------------------------------------
  const INK = '#140c1c';
  const SKIN = '#f2b58e';
  const HAIR = '#1d1634';
  const HAIR_HI = '#7468ff';
  const BOOT = '#fbf8ff';
  const LIPS = '#d4164a';
  const SHADOW = 'rgba(78, 28, 120, 0.46)';
  const LW = 0.085;   // main outline, in body units
  const LW2 = 0.045;  // detail lines
  // Key light comes from the upper left; shadows fall to the lower right.
  const LX = -0.62, LY = -0.78;

  // Body proportions (units; whole figure is ~8 units tall)
  const HIP_Y = -4.15, THIGH = 2.02, SHIN = 1.96, UPPER = 1.38, FORE = 1.22;

  // ---- Poses -----------------------------------------------------------------
  const REST = {
    px: 0, py: 0, pr: 0, cr: 0, cx: 0, hr: 0,
    lh: { x: -0.55, y: 2.3 }, rh: { x: 0.55, y: 2.3 },
    lf: { x: -0.5, y: 0 }, rf: { x: 0.5, y: 0 },
    flare: 0, look: 0, brow: 0
  };
  const NUM_KEYS = ['px', 'py', 'pr', 'cr', 'cx', 'hr', 'flare', 'look', 'brow'];
  const VEC_KEYS = ['lh', 'rh', 'lf', 'rf'];

  function clonePose(p) {
    const o = {};
    for (const k of NUM_KEYS) o[k] = p[k] || 0;
    for (const k of VEC_KEYS) o[k] = { x: p[k].x, y: p[k].y };
    o.mouth = p.mouth || 0; o.eyes = p.eyes || 0;
    return o;
  }
  function pose(over) {
    const o = clonePose(REST);
    for (const k in over) {
      if (VEC_KEYS.includes(k)) o[k] = { x: over[k].x, y: over[k].y };
      else o[k] = over[k];
    }
    return o;
  }
  function mirror(p) {
    const o = clonePose(p);
    o.px = -p.px; o.pr = -p.pr; o.cr = -p.cr; o.cx = -p.cx; o.hr = -p.hr; o.look = -p.look;
    o.lh = { x: -p.rh.x, y: p.rh.y }; o.rh = { x: -p.lh.x, y: p.lh.y };
    o.lf = { x: -p.rf.x, y: p.rf.y }; o.rf = { x: -p.lf.x, y: p.lf.y };
    return o;
  }
  function blendInto(a, b, w) {
    if (w <= 0) return a;
    for (const k of NUM_KEYS) a[k] = lerp(a[k], b[k], w);
    for (const k of VEC_KEYS) { a[k].x = lerp(a[k].x, b[k].x, w); a[k].y = lerp(a[k].y, b[k].y, w); }
    return a;
  }

  const MOVES = {
    L: [
      pose({ px: -0.5, py: 0.15, pr: 0.17, cr: -0.27, hr: 0.12, lh: { x: -2.3, y: -0.9 }, rh: { x: 0.02, y: 2.0 }, lf: { x: -0.85, y: 0 }, rf: { x: 0.28, y: -0.14 }, look: -1, flare: 0.25 }),
      pose({ px: -0.32, py: 0.3, pr: 0.1, cr: -0.1, hr: -0.15, lh: { x: -0.95, y: 0.45 }, rh: { x: -1.55, y: 0.5 }, lf: { x: -0.78, y: 0 }, rf: { x: 0.22, y: -0.12 }, look: -1, mouth: 1 })
    ],
    U: [
      pose({ py: -0.2, lh: { x: -1.25, y: -2.25 }, rh: { x: 1.25, y: -2.25 }, lf: { x: -0.42, y: 0 }, rf: { x: 0.42, y: 0 }, mouth: 1, eyes: 1, brow: 1 }),
      pose({ px: 0.25, pr: -0.13, cr: 0.1, hr: 0.1, rh: { x: 1.15, y: -2.3 }, lh: { x: 0.05, y: 2.0 }, lf: { x: -0.78, y: 0 }, rf: { x: 0.42, y: -0.06 }, look: 1, brow: 1 })
    ],
    D: [
      pose({ py: 0.8, lh: { x: 0.2, y: 2.35 }, rh: { x: -0.2, y: 2.35 }, lf: { x: -0.98, y: 0 }, rf: { x: 0.98, y: 0 }, hr: 0.06, mouth: 1, flare: 0.5 }),
      pose({ py: 0.6, lh: { x: -1.9, y: 0.9 }, rh: { x: 1.9, y: 0.9 }, lf: { x: -0.92, y: 0 }, rf: { x: 0.92, y: 0 }, eyes: 1, flare: 0.3 })
    ]
  };
  MOVES.R = MOVES.L.map(mirror);
  MOVES.R[0].look = 1; MOVES.R[1].look = 1;

  const FALTER = pose({ px: 0.42, py: 0.55, pr: 0.3, cr: -0.45, hr: 0.45, lh: { x: -1.75, y: -0.3 }, rh: { x: 1.55, y: 0.55 }, lf: { x: -0.32, y: 0 }, rf: { x: 0.98, y: -0.38 }, mouth: 2, eyes: 2, brow: -1, flare: 0.7 });

  // Groove styles driven by the music section.
  const STYLE_BY_SECTION = { intro: 'bounce', groove: 'twist', hook: 'twist', break: 'swim', rise: 'bounce', drop: 'pony', breakdown: 'sway', drop2: 'pony', outro: 'twist', title: 'twist' };

  function groovePose(style, beats, amp) {
    const ph = beats - Math.floor(beats);
    const bnc = 0.5 + 0.5 * Math.cos(ph * Math.PI * 2);       // down on the beat
    const sway = Math.sin(beats * Math.PI);                     // L on 1, R on 2
    const slow = Math.sin(beats * Math.PI / 2);
    const p = clonePose(REST);
    switch (style) {
      case 'bounce':
        p.py = 0.17 * bnc * amp; p.px = 0.14 * sway * amp; p.pr = 0.05 * sway * amp; p.cr = -0.04 * sway;
        p.hr = 0.05 * Math.sin(ph * Math.PI * 2);
        p.lh = { x: -0.78, y: 1.15 + 0.18 * bnc }; p.rh = { x: 0.78, y: 1.15 + 0.18 * bnc };
        break;
      case 'twist':
        p.py = 0.22 * bnc * amp; p.px = 0.3 * sway * amp; p.pr = 0.12 * sway * amp; p.cr = -0.14 * sway * amp;
        p.hr = -0.06 * sway;
        p.lh = { x: -0.95 + 0.42 * sway, y: 1.3 - 0.1 * bnc }; p.rh = { x: 0.95 + 0.42 * sway, y: 1.3 - 0.1 * bnc };
        p.lf = { x: -0.55 + 0.08 * sway, y: 0 }; p.rf = { x: 0.55 + 0.08 * sway, y: 0 };
        p.flare = 0.15 * Math.abs(sway);
        break;
      case 'swim': {
        const w = Math.sin(beats * Math.PI / 2);
        p.py = 0.12 * bnc * amp; p.px = 0.2 * sway * amp; p.pr = 0.06 * sway;
        p.lh = { x: -0.9 + 0.5 * w, y: -1.6 + 0.35 * Math.cos(beats * Math.PI) }; p.rh = { x: 0.9 + 0.5 * w, y: -1.6 - 0.35 * Math.cos(beats * Math.PI) };
        p.hr = 0.08 * w;
        break;
      }
      case 'sway':
        p.py = 0.1 * bnc * amp; p.px = 0.36 * slow * amp; p.pr = 0.11 * slow; p.cr = -0.16 * slow; p.hr = 0.12 * slow;
        p.lh = { x: -1.25, y: -0.5 + 0.7 * slow }; p.rh = { x: 1.25, y: -0.5 - 0.7 * slow };
        p.eyes = 1;
        break;
      case 'pony':
        p.py = 0.3 * bnc * amp; p.px = 0.16 * sway * amp; p.pr = 0.08 * sway; p.cr = -0.06 * sway;
        p.lf = { x: -0.52, y: -0.3 * Math.max(0, sway) * amp }; p.rf = { x: 0.52, y: -0.3 * Math.max(0, -sway) * amp };
        p.lh = { x: -0.55, y: 0.95 + 0.42 * Math.cos(ph * Math.PI * 2) }; p.rh = { x: 0.55, y: 0.95 + 0.42 * Math.cos(ph * Math.PI * 2) };
        p.hr = 0.07 * Math.sin(ph * Math.PI * 2); p.flare = 0.25 * bnc;
        break;
    }
    return p;
  }

  // ---- Dancer ------------------------------------------------------------------
  function Dancer() {
    this.style = 'twist'; this.prevStyle = 'twist'; this.styleBlend = 1;
    this.action = null; this.falter = null;
    this.hair = [];
    this.skirtAng = 0; this.skirtVel = 0; this.flare = 0; this.flareVel = 0;
    this.earAng = 0; this.earVel = 0;
    this.lastPx = 0; this.lastPy = 0; this.lastHead = null;
    this.blinkT = 2; this.blink = 0;
    this.pose = clonePose(REST);
    this.sk = null;
    this.time = 0;
    this.variant = { L: 0, R: 0, U: 0, D: 0 };
  }

  Dancer.prototype.setStyle = function (sectionType) {
    const s = STYLE_BY_SECTION[sectionType] || 'twist';
    if (s !== this.style) { this.prevStyle = this.style; this.style = s; this.styleBlend = 0; }
  };

  // Called on every press of a direction (hit or freestyle).
  Dancer.prototype.trigger = function (dir, opts) {
    const v = this.variant[dir] = (this.variant[dir] + 1) & 1;
    this.action = { dir, pose: MOVES[dir][v], t: 0, hold: !!(opts && opts.hold), dur: (opts && opts.dur) || 0.34, rel: null, v };
  };
  Dancer.prototype.release = function () { if (this.action && this.action.hold) { this.action.hold = false; this.action.dur = this.action.t; } };
  Dancer.prototype.stumble = function () {
    this.falter = { t: 0, side: Math.random() < 0.5 ? -1 : 1 };
    this.action = null;
  };

  Dancer.prototype.update = function (dt, beats, hype) {
    this.time += dt;
    dt = Math.min(dt, 1 / 20);
    this.styleBlend = Math.min(1, this.styleBlend + dt * 2.2);
    const amp = 0.65 + 0.55 * hype;
    let p = groovePose(this.style, beats, amp);
    if (this.styleBlend < 1) p = blendInto(groovePose(this.prevStyle, beats, amp), p, easeOut(this.styleBlend));
    let mouth = beats % 4 < 0.25 && hype > 0.7 ? 1 : 0, eyes = p.eyes, wA = 0;

    if (this.action) {
      const a = this.action; a.t += dt;
      const atk = 0.075;
      let w;
      if (a.t < atk) w = easeOutBack(a.t / atk);
      else if (a.hold || a.t < a.dur) w = 1;
      else w = 1 - easeOut(clamp((a.t - a.dur) / 0.28, 0, 1));
      if (w <= 0 && a.t > a.dur) this.action = null;
      else {
        const target = clonePose(a.pose);
        if (a.hold) { // held poses keep moving
          const s = Math.sin(a.t * 6.5), c = Math.cos(a.t * 3.2);
          if (a.dir === 'U') { target.lh.x += 0.45 * s; target.rh.x += 0.45 * s; target.px = 0.25 * c; target.pr = -0.08 * c; }
          else if (a.dir === 'D') { target.cx = 0.1 * Math.sin(a.t * 26); target.py += 0.08 * s; }
          else { target.lh.y += 0.5 * s; target.rh.y -= 0.3 * s; target.px += 0.1 * c; }
        } else if (a.dir === 'D' && a.v === 1) target.cx = 0.12 * Math.sin(a.t * 40);
        p = blendInto(p, target, w);
        wA = w;
        if (w > 0.5) { mouth = a.pose.mouth; eyes = a.pose.eyes; }
      }
    }
    if (this.falter) {
      const f = this.falter; f.t += dt;
      const w = f.t < 0.08 ? easeOut(f.t / 0.08) : 1 - easeOut(clamp((f.t - 0.22) / 0.45, 0, 1));
      if (f.t > 0.7) this.falter = null;
      else {
        let target = f.side > 0 ? FALTER : (this._falterL || (this._falterL = mirror(FALTER)));
        target = clonePose(target);
        const j = Math.sin(f.t * 47) * 0.12;
        target.lh.x += j * 2; target.rh.y += j * 2; target.hr += j; target.cr += j * 0.5;
        p = blendInto(p, target, w);
        if (w > 0.3) { mouth = 2; eyes = 2; }
      }
    }

    // Blink
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blink = 0.13; this.blinkT = 2 + Math.random() * 3.5; }
    if (this.blink > 0) { this.blink -= dt; if (eyes === 0) eyes = 3; }
    p.mouth = mouth; p.eyes = eyes;
    this.pose = p;

    // Secondary motion -----------------------------------------------------------
    const vx = (p.px - this.lastPx) / Math.max(dt, 1e-3), vy = (p.py - this.lastPy) / Math.max(dt, 1e-3);
    this.lastPx = p.px; this.lastPy = p.py;
    // Skirt angle lags the pelvis; flare rises with motion.
    const sTarget = p.pr - clamp(vx * 0.06, -0.3, 0.3);
    this.skirtVel += ((sTarget - this.skirtAng) * 140 - this.skirtVel * 9) * dt;
    this.skirtAng += this.skirtVel * dt;
    const fTarget = clamp(p.flare + Math.abs(vx) * 0.12 + Math.max(0, -vy) * 0.08, 0, 1.1);
    this.flareVel += ((fTarget - this.flare) * 90 - this.flareVel * 7) * dt;
    this.flare = clamp(this.flare + this.flareVel * dt, -0.2, 1.3);

    this.sk = this._skeleton(p);
    const head = this.sk.H;
    if (this.lastHead) {
      const hvx = (head.x - this.lastHead.x) / Math.max(dt, 1e-3);
      this.earVel += ((-hvx * 0.12 - this.earAng) * 80 - this.earVel * 4) * dt;
      this.earAng = clamp(this.earAng + this.earVel * dt, -0.9, 0.9);
    }
    this.lastHead = { x: head.x, y: head.y };
    this._simHair(dt);
    return wA;
  };

  Dancer.prototype._skeleton = function (p) {
    const P0 = { x: p.px, y: HIP_Y + p.py };
    const add = (a, v) => ({ x: a.x + v.x, y: a.y + v.y });
    const R = (x, y, a) => rot(x, y, a);
    const pr = p.pr, ca = p.pr + p.cr;
    const hipL = add(P0, R(-0.42, 0.16, pr)), hipR = add(P0, R(0.42, 0.16, pr));
    const W = add(P0, R(0, -1.0, pr));
    const Cb = add(W, R(p.cx, -1.38, ca));
    const SL = add(Cb, R(-0.86, 0.2, ca)), SR = add(Cb, R(0.86, 0.2, ca));
    const N = add(Cb, R(0, -0.3, ca));
    const ha = ca + p.hr;
    const H = add(N, R(0, -0.6, ha));

    // Legs: IK to planted feet. Seen from the front a bent knee points at the
    // camera, so its sideways offset is foreshortened instead of bowing out.
    const legs = [[hipL, p.lf, -1], [hipR, p.rf, 1]].map(([hip, f, side]) => {
      const ank = { x: f.x, y: f.y - 0.24 };
      const a = ik2(hip.x, hip.y, ank.x, ank.y, THIGH, SHIN, 1);
      const b = ik2(hip.x, hip.y, ank.x, ank.y, THIGH, SHIN, -1);
      const k = (a.mid.x - hip.x) * side > (b.mid.x - hip.x) * side ? a : b;
      const ex = k.end.x - hip.x, ey = k.end.y - hip.y, el = ex * ex + ey * ey || 1;
      const t = ((k.mid.x - hip.x) * ex + (k.mid.y - hip.y) * ey) / el;
      const px = hip.x + ex * t, py = hip.y + ey * t;
      const knee = { x: px + (k.mid.x - px) * 0.3, y: py + (k.mid.y - py) * 0.3 };
      return { hip, knee, ank: k.end, foot: { x: k.end.x, y: k.end.y + 0.24 }, side };
    });
    // Arms: IK to hand targets, elbows outward.
    const arms = [[SL, p.lh, -1], [SR, p.rh, 1]].map(([sh, h, side]) => {
      const tx = sh.x + h.x, ty = sh.y + h.y;
      const a = ik2(sh.x, sh.y, tx, ty, UPPER, FORE, 1);
      const b = ik2(sh.x, sh.y, tx, ty, UPPER, FORE, -1);
      const sa = (a.mid.x - sh.x) * side + (a.mid.y - sh.y) * 0.15;
      const sb = (b.mid.x - sh.x) * side + (b.mid.y - sh.y) * 0.15;
      const e = sa > sb ? a : b;
      return { sh, el: e.mid, wr: e.end, side };
    });
    return { P0, pr, ca, ha, W, Cb, SL, SR, N, H, legs, arms };
  };

  Dancer.prototype._simHair = function (dt) {
    const sk = this.sk;
    const anchor = { x: sk.H.x + rot(0.05, -0.66, sk.ha).x, y: sk.H.y + rot(0.05, -0.66, sk.ha).y };
    const root2 = { x: anchor.x + rot(0.16, -0.26, sk.ha).x, y: anchor.y + rot(0.16, -0.26, sk.ha).y };
    const N = 8, SEG = 0.34;
    if (!this.hair.length) {
      for (let i = 0; i < N; i++) { const x = root2.x + 0.3 * i, y = root2.y + 0.22 * i; this.hair.push({ x, y, px: x, py: y }); }
    }
    const h = this.hair;
    const sub = 2, sdt = dt / sub;
    for (let s = 0; s < sub; s++) {
      for (let i = 2; i < N; i++) {
        const q = h[i];
        const vx = (q.x - q.px) * 0.94, vy = (q.y - q.py) * 0.94;
        q.px = q.x; q.py = q.y;
        q.x += vx + 6 * sdt * sdt; // slight sideways drift so it drapes over the shoulder
        q.y += vy + 42 * sdt * sdt;
      }
      h[0].x = anchor.x; h[0].y = anchor.y; h[0].px = anchor.x; h[0].py = anchor.y;
      h[1].x = root2.x; h[1].y = root2.y; h[1].px = root2.x; h[1].py = root2.y;
      // A little bend stiffness near the root so the ponytail arcs out before falling.
      for (let i = 2; i < 5; i++) {
        const a = h[i - 2], b = h[i - 1], q = h[i];
        const k = 0.12 / (i - 1);
        q.x += (2 * b.x - a.x - q.x) * k; q.y += (2 * b.y - a.y - q.y) * k;
      }
      for (let it = 0; it < 3; it++) {
        for (let i = 2; i < N; i++) {
          const a = h[i - 1], b = h[i];
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-4;
          const k = (d - SEG) / d;
          b.x -= dx * k; b.y -= dy * k;
        }
      }
      // Keep the tail from swinging through the face.
      for (let i = 2; i < N; i++) {
        const q = h[i];
        const dx = q.x - sk.H.x, dy = q.y - sk.H.y, d = Math.hypot(dx, dy);
        if (d < 0.68) { const nx = (dx / d) + (dx >= 0 ? 0.35 : -0.35), ny = dy / d; const nl = Math.hypot(nx, ny); q.x = sk.H.x + nx / nl * 0.68; q.y = sk.H.y + ny / nl * 0.68; q.px = q.x; q.py = q.y; }
      }
    }
  };

  // ---- Rendering helpers ---------------------------------------------------------
  function shifted(path, dx, dy) {
    const p = new Path2D();
    p.rect(-60, -60, 120, 120);
    p.addPath(path, new DOMMatrix([1, 0, 0, 1, dx, dy]));
    return p;
  }

  function hatch(ctx, fr, R, sp, ang, seed) {
    ctx.save();
    ctx.translate(fr.x, fr.y); ctx.rotate(fr.a + (ang == null ? -0.9 : ang));
    ctx.beginPath();
    let i = 0;
    for (let o = -R; o <= R; o += sp, i++) {
      const h1 = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
      const r1 = h1 - Math.floor(h1);
      const len = R * (0.75 + 0.5 * r1);
      ctx.moveTo(-len, o + r1 * sp * 0.3);
      ctx.lineTo(len, o - r1 * sp * 0.3);
    }
    ctx.strokeStyle = 'rgba(20,10,30,0.62)';
    ctx.lineWidth = 0.022;
    ctx.stroke();
    ctx.restore();
  }

  // Fill, pattern, cel shadow, hatching, rim light, outline.
  function cel(ctx, path, o, look) {
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = o.fill; ctx.fill(path);
    if (o.pattern) o.pattern(ctx);
    const k = o.k == null ? 0.2 : o.k;
    const sh = shifted(path, LX * k, LY * k);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = o.shadow || SHADOW; ctx.fill(sh, 'evenodd');
    ctx.globalCompositeOperation = 'source-over';
    if (o.hatch !== false) {
      ctx.save(); ctx.clip(sh, 'evenodd');
      hatch(ctx, o.frame || { x: 0, y: 0, a: 0 }, o.R || 1.5, o.sp || 0.105, o.ang, o.seed || 1);
      ctx.restore();
    }
    if (look.rim) {
      const r = o.rimK || 0.075;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = look.rim; ctx.fill(shifted(path, LX * r, LY * r), 'evenodd');
      ctx.globalAlpha = 1;
    }
    if (o.gloss) {
      ctx.globalAlpha = o.gloss;
      ctx.fillStyle = '#ffffff'; ctx.fill(shifted(path, -LX * 0.06, -LY * 0.06), 'evenodd');
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.lineWidth = o.lw || LW; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke(path);
  }

  // Tapered limb outline between joints A and B.
  function limb(A, B, wA, wB, bOut, bIn, side, capA, capB) {
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1e-4;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const pts = [];
    const ts = [0.08, 0.3, 0.55, 0.8, 0.96];
    // side +n is "outer" when side>0... choose bulges per side.
    const b1 = side > 0 ? bOut : bIn, b2 = side > 0 ? bIn : bOut;
    for (const t of ts) {
      const w = lerp(wA, wB, t) + b1 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      pts.push({ x: A.x + dx * t + nx * w, y: A.y + dy * t + ny * w });
    }
    pts.push({ x: B.x + ux * wB * (capB == null ? 0.7 : capB), y: B.y + uy * wB * (capB == null ? 0.7 : capB) });
    for (let i = ts.length - 1; i >= 0; i--) {
      const t = ts[i];
      const w = lerp(wA, wB, t) + b2 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      pts.push({ x: A.x + dx * t - nx * w, y: A.y + dy * t - ny * w });
    }
    pts.push({ x: A.x - ux * wA * (capA == null ? 0.6 : capA), y: A.y - uy * wA * (capA == null ? 0.6 : capA) });
    return { path: smoothClosed(pts), frame: { x: A.x, y: A.y, a: Math.atan2(dy, dx) }, L };
  }

  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || LW2; ctx.stroke(); }
  }
  function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || LW2; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  function inFrame(ctx, fr, fn) { ctx.save(); ctx.translate(fr.x, fr.y); ctx.rotate(fr.a); fn(ctx); ctx.restore(); }

  // ---- Kandinsky costume patterns -------------------------------------------------
  function suitPattern(ctx, fr) {
    inFrame(ctx, fr, (c) => {
      // Concentric "Farbstudie" circle on the belly
      [[0.62, P.blue], [0.49, P.yellow], [0.36, P.red], [0.22, INK], [0.1, P.cream]].forEach(([r, col]) => circle(c, 0.28, 1.78, r, col));
      // Sharp diagonals
      c.strokeStyle = INK; c.lineCap = 'round';
      c.lineWidth = 0.07; c.beginPath(); c.moveTo(-1.0, 1.05); c.lineTo(0.75, 0.38); c.stroke();
      c.lineWidth = 0.03; c.beginPath(); c.moveTo(-0.9, 1.35); c.lineTo(0.95, 0.75); c.stroke();
      c.beginPath(); c.moveTo(-0.2, 0.5); c.lineTo(-0.6, 2.4); c.stroke();
      // Triangles
      poly(c, [[-0.78, 1.32], [-0.16, 1.02], [-0.5, 1.98]], P.yellow, INK);
      poly(c, [[0.42, 0.62], [0.82, 0.9], [0.5, 1.12]], P.red, INK);
      // Half moon
      c.beginPath(); c.arc(-0.36, 2.32, 0.3, Math.PI, 0); c.closePath(); c.fillStyle = P.teal; c.fill();
      c.lineWidth = LW2; c.stroke();
      // Checker patch
      c.save(); c.translate(0.42, 1.15); c.rotate(0.35);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        c.fillStyle = (i + j) & 1 ? INK : P.cream; c.fillRect(-0.15 + i * 0.1, -0.15 + j * 0.1, 0.1, 0.1);
      }
      c.restore();
      circle(c, -0.55, 0.88, 0.08, P.blue, INK);
      circle(c, 0.66, 1.42, 0.06, P.red);
      circle(c, -0.15, 2.05, 0.05, INK);
      c.strokeStyle = P.violet; c.lineWidth = 0.05;
      c.beginPath(); c.arc(0.28, 1.78, 0.8, -2.4, -1.2); c.stroke();
    });
  }

  const SKIRT_COLS = [P.red, P.yellow, P.blue, P.cream, P.teal, P.orange, P.violet, P.yellow];

  // ---- Drawing ---------------------------------------------------------------------
  Dancer.prototype.draw = function (ctx, x, y, u, look) {
    if (!this.sk) this.update(0, 0, 0.5);
    const sk = this.sk, p = this.pose;
    ctx.save();
    ctx.translate(x, y); ctx.scale(u, u);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    this._drawBox(ctx, look);
    // Contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(p.px * 0.5, 0.06, 1.5, 0.22, 0, 0, Math.PI * 2); ctx.fill();

    this._drawPonytail(ctx, look);
    this._drawBackHair(ctx, look);
    this._drawNeck(ctx, look);
    sk.legs.forEach((lg, i) => this._drawLeg(ctx, lg, i, look));
    this._drawTorso(ctx, look);
    this._drawSkirt(ctx, look);
    this._drawHead(ctx, look);
    sk.arms.forEach((a, i) => this._drawArm(ctx, a, i, look));
    ctx.restore();
  };

  Dancer.prototype._drawBox = function (ctx, look) {
    // Go-go box: top face + front face.
    const top = new Path2D();
    top.moveTo(-2.4, 0.35); top.lineTo(2.4, 0.35); top.lineTo(1.95, -0.45); top.lineTo(-1.95, -0.45); top.closePath();
    const front = new Path2D(); front.rect(-2.4, 0.35, 4.8, 1.9);
    ctx.fillStyle = '#231a33'; ctx.fill(top);
    ctx.save(); ctx.clip(top);
    const g = ctx.createLinearGradient(0, -0.45, 0, 0.35); g.addColorStop(0, 'rgba(255,255,255,0.02)'); g.addColorStop(1, 'rgba(255,255,255,0.12)');
    ctx.fillStyle = g; ctx.fill(top);
    ctx.restore();
    ctx.fillStyle = '#16101f'; ctx.fill(front);
    ctx.save(); ctx.clip(front);
    circle(ctx, -1.35, 1.3, 0.7, P.blue); circle(ctx, -1.35, 1.3, 0.48, P.yellow); circle(ctx, -1.35, 1.3, 0.26, P.red);
    poly(ctx, [[0.1, 2.3], [1.0, 0.55], [1.6, 2.3]], P.teal);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(-0.6, 0.4); ctx.lineTo(2.4, 1.9); ctx.stroke();
    circle(ctx, 1.85, 0.95, 0.2, P.orange, INK);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(40,20,70,0.55)'; ctx.fillRect(-2.4, 0.35, 4.8, 1.9);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    // Neon edge
    ctx.strokeStyle = look.rim || P.pink; ctx.lineWidth = 0.09; ctx.globalAlpha = 0.6 + 0.4 * (look.pulse || 0);
    ctx.shadowColor = look.rim || P.pink; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(-2.4, 0.35); ctx.lineTo(2.4, 0.35); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.strokeStyle = INK; ctx.lineWidth = LW;
    ctx.stroke(top); ctx.stroke(front);
  };

  Dancer.prototype._drawPonytail = function (ctx, look) {
    const h = this.hair, n = h.length;
    if (n < 3) return;
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = h[Math.max(0, i - 1)], b = h[Math.min(n - 1, i + 1)];
      let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const t = i / (n - 1);
      const w = (0.14 + 0.24 * Math.sin(Math.PI * Math.min(1, t * 1.25))) * (1 - t * 0.55) + 0.02;
      L.push({ x: h[i].x - dy * w, y: h[i].y + dx * w });
      R.push({ x: h[i].x + dy * w, y: h[i].y - dx * w });
    }
    const tip = h[n - 1], pre = h[n - 2];
    const tdx = tip.x - pre.x, tdy = tip.y - pre.y;
    const pts = L.concat([{ x: tip.x + tdx * 0.6, y: tip.y + tdy * 0.6 }], R.reverse());
    const path = smoothClosed(pts);
    const fr = { x: h[2].x, y: h[2].y, a: Math.atan2(tip.y - h[1].y, tip.x - h[1].x) };
    cel(ctx, path, { fill: HAIR, frame: fr, R: 3, k: 0.16, gloss: 0, seed: 7 }, look);
    // Strand lines and a glossy streak
    ctx.save(); ctx.clip(path);
    ctx.strokeStyle = HAIR_HI; ctx.lineWidth = 0.07; ctx.globalAlpha = 0.8;
    ctx.stroke(smoothOpen(h.slice(1).map((q, i) => ({ x: q.x - 0.07 + i * 0.005, y: q.y }))));
    ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = 0.025;
    ctx.stroke(smoothOpen(h.slice(2).map((q) => ({ x: q.x + 0.1, y: q.y + 0.02 }))));
    ctx.restore();
    // Scrunchie
    const s = h[1];
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(h[2].y - h[0].y, h[2].x - h[0].x));
    ctx.beginPath(); ctx.ellipse(0, 0, 0.14, 0.24, 0, 0, Math.PI * 2);
    ctx.fillStyle = P.yellow; ctx.fill(); ctx.lineWidth = LW2; ctx.strokeStyle = INK; ctx.stroke();
    circle(ctx, 0, -0.1, 0.04, P.red); circle(ctx, 0, 0.08, 0.04, P.blue);
    ctx.restore();
  };

  const HEAD_SCALE = 1.1;
  Dancer.prototype._headFrame = function () { const sk = this.sk; return { x: sk.H.x, y: sk.H.y, a: sk.ha }; };
  function headFrame(ctx, fr, fn) { inFrame(ctx, fr, (c) => { c.scale(HEAD_SCALE, HEAD_SCALE); fn(c); }); }

  Dancer.prototype._drawBackHair = function (ctx, look) {
    const fr = this._headFrame();
    headFrame(ctx, fr, (c) => {
      const path = smoothClosed([
        { x: 0, y: -0.74 }, { x: 0.5, y: -0.55 }, { x: 0.62, y: -0.1 }, { x: 0.6, y: 0.35 }, { x: 0.5, y: 0.52 },
        { x: -0.5, y: 0.52 }, { x: -0.6, y: 0.35 }, { x: -0.62, y: -0.1 }, { x: -0.5, y: -0.55 }
      ]);
      cel(c, path, { fill: HAIR, frame: { x: 0, y: 0, a: 0 }, R: 1, k: 0.14, seed: 3 }, look);
    });
  };

  Dancer.prototype._drawNeck = function (ctx, look) {
    const sk = this.sk;
    const fr = { x: sk.N.x, y: sk.N.y, a: sk.ca };
    inFrame(ctx, fr, (c) => {
      const path = smoothClosed([{ x: -0.17, y: -0.35 }, { x: 0.17, y: -0.35 }, { x: 0.19, y: 0.2 }, { x: 0.26, y: 0.42 }, { x: -0.26, y: 0.42 }, { x: -0.19, y: 0.2 }], null, 0.5);
      cel(c, path, { fill: SKIN, frame: { x: 0, y: 0, a: 0 }, R: 0.6, k: 0.12, seed: 4 }, look);
      // Shadow cast by the jaw
      c.save(); c.clip(path); c.globalCompositeOperation = 'multiply'; c.fillStyle = SHADOW;
      c.beginPath(); c.ellipse(0, -0.32, 0.4, 0.2, 0, 0, Math.PI * 2); c.fill(); c.restore();
    });
  };

  Dancer.prototype._drawLeg = function (ctx, lg, i, look) {
    const side = lg.side;
    const thigh = limb(lg.hip, lg.knee, 0.37, 0.235, 0.05, 0.02, side, 0.7, 0.5);
    cel(ctx, thigh.path, {
      fill: SKIN, frame: thigh.frame, R: 2.2, k: 0.17, seed: 10 + i,
      pattern: (c) => {
        // Body-paint geometry on the thighs
        inFrame(c, thigh.frame, (cc) => {
          if (i === 0) { [[0.16, P.blue], [0.11, P.yellow], [0.06, P.red]].forEach(([r, col]) => circle(cc, 1.05, 0.05, r, col)); circle(cc, 1.05, 0.05, 0.16, null, INK, 0.025); }
          else { poly(cc, [[0.9, -0.12], [1.3, 0.02], [0.95, 0.15]], P.blue, INK, 0.025); cc.strokeStyle = INK; cc.lineWidth = 0.03; cc.beginPath(); cc.moveTo(1.35, -0.15); cc.lineTo(1.55, 0.12); cc.stroke(); }
        });
      }
    }, look);
    const shin = limb(lg.knee, lg.ank, 0.215, 0.125, 0.065, 0.025, side, 0.6, 0.4);
    cel(ctx, shin.path, { fill: SKIN, frame: shin.frame, R: 2, k: 0.15, seed: 20 + i }, look);
    // Knee crease
    ctx.strokeStyle = INK; ctx.lineWidth = LW2;
    inFrame(ctx, shin.frame, (c) => { c.beginPath(); c.arc(0.02, 0, 0.12, -0.9, 0.9); c.stroke(); });

    // Go-go boot: shaft from mid-shin, plus the foot.
    const bootTop = { x: lerp(lg.knee.x, lg.ank.x, 0.4), y: lerp(lg.knee.y, lg.ank.y, 0.4) };
    const foot = lg.foot;
    const out = side;
    const fpath = smoothClosed([
      { x: foot.x - 0.17, y: foot.y - 0.3 }, { x: foot.x + 0.17, y: foot.y - 0.3 },
      { x: foot.x + 0.2 + out * 0.08, y: foot.y - 0.06 }, { x: foot.x + out * 0.1 + 0.12, y: foot.y + 0.04 },
      { x: foot.x + out * 0.1 - 0.14, y: foot.y + 0.04 }, { x: foot.x - 0.2 + out * 0.08, y: foot.y - 0.06 }
    ], null, 0.7);
    cel(ctx, fpath, { fill: BOOT, frame: { x: foot.x, y: foot.y, a: 0 }, R: 0.5, k: 0.1, hatch: false, gloss: 0.5 }, look);
    // heel block
    ctx.fillStyle = INK; ctx.fillRect(foot.x - out * 0.12 - 0.05, foot.y - 0.04, 0.1, 0.1);
    const shaft = limb(bootTop, { x: lg.ank.x, y: lg.ank.y + 0.06 }, 0.2, 0.15, 0.045, 0.02, side, 0.15, 0.5);
    cel(ctx, shaft.path, {
      fill: BOOT, frame: shaft.frame, R: 1.4, k: 0.12, seed: 30 + i, gloss: 0.55,
      shadow: 'rgba(70,60,160,0.35)',
      pattern: (c) => inFrame(c, shaft.frame, (cc) => {
        // Kandinsky cuff band
        const cols = [P.red, P.yellow, P.blue, P.red];
        for (let k = 0; k < 4; k++) { cc.fillStyle = cols[k]; cc.fillRect(0.02, -0.3 + k * 0.15, 0.15, 0.15); }
        cc.strokeStyle = INK; cc.lineWidth = 0.025; cc.beginPath(); cc.moveTo(0.17, -0.3); cc.lineTo(0.17, 0.3); cc.stroke();
        circle(cc, 0.55, side * 0.03, 0.05, INK);
      })
    }, look);
  };

  Dancer.prototype._torsoPath = function () {
    const sk = this.sk;
    const A = (base, x, y, a) => { const r = rot(x, y, a); return { x: base.x + r.x, y: base.y + r.y }; };
    const ca = sk.ca, wa = sk.pr + (sk.ca - sk.pr) * 0.4, pr = sk.pr;
    const C = sk.Cb, W = sk.W, P0 = sk.P0;
    const pts = [
      A(C, 0.24, -0.06, ca), A(C, 0.82, 0.12, ca), A(C, 0.98, 0.36, ca), A(C, 0.84, 0.75, ca), A(C, 0.83, 1.05, ca),
      A(C, 0.66, 1.36, ca), A(W, 0.5, 0, wa), A(P0, 0.76, -0.32, pr), A(P0, 0.84, 0.12, pr), A(P0, 0.52, 0.42, pr),
      A(P0, 0.0, 0.62, pr),
      A(P0, -0.52, 0.42, pr), A(P0, -0.84, 0.12, pr), A(P0, -0.76, -0.32, pr), A(W, -0.5, 0, wa),
      A(C, -0.66, 1.36, ca), A(C, -0.83, 1.05, ca), A(C, -0.84, 0.75, ca), A(C, -0.98, 0.36, ca), A(C, -0.82, 0.12, ca), A(C, -0.24, -0.06, ca)
    ];
    return smoothClosed(pts, null, 0.85);
  };

  Dancer.prototype._suitPath = function () {
    const sk = this.sk;
    const A = (base, x, y, a) => { const r = rot(x, y, a); return { x: base.x + r.x, y: base.y + r.y }; };
    const ca = sk.ca, pr = sk.pr, C = sk.Cb, P0 = sk.P0;
    // Halter one-piece: straps tie behind the neck, shoulders bare, high-cut legs.
    const pts = [
      A(C, 0.2, -0.12, ca), A(C, 0.36, -0.1, ca), A(C, 0.7, 0.62, ca), A(C, 1.05, 0.82, ca), A(C, 2.0, 0.9, ca), A(P0, 2.0, 0.05, pr),
      A(P0, 0.86, 0.02, pr), A(P0, 0.3, 0.6, pr), A(P0, -0.3, 0.6, pr), A(P0, -0.86, 0.02, pr),
      A(P0, -2.0, 0.05, pr), A(C, -2.0, 0.9, ca), A(C, -1.05, 0.82, ca), A(C, -0.7, 0.62, ca), A(C, -0.36, -0.1, ca), A(C, -0.2, -0.12, ca),
      A(C, -0.1, 0.6, ca), A(C, 0, 0.78, ca), A(C, 0.1, 0.6, ca)
    ];
    const p = new Path2D();
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
    p.closePath();
    return p;
  };

  Dancer.prototype._drawTorso = function (ctx, look) {
    const sk = this.sk;
    const torso = this._torsoPath();
    const suit = this._suitPath();
    const fr = { x: sk.Cb.x, y: sk.Cb.y, a: sk.ca };
    cel(ctx, torso, {
      fill: SKIN, frame: fr, R: 3, k: 0.3, seed: 40, rimK: 0.09,
      pattern: (c) => {
        c.save(); c.clip(suit);
        c.fillStyle = P.cream; c.fill(suit);
        suitPattern(c, fr);
        c.restore();
      }
    }, look);
    // Suit seams, collarbones, bust contour
    ctx.save(); ctx.clip(torso);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.06; ctx.stroke(suit);
    ctx.restore();
    inFrame(ctx, fr, (c) => {
      c.strokeStyle = INK; c.lineWidth = LW2;
      c.beginPath(); c.moveTo(-0.55, 0.22); c.quadraticCurveTo(-0.32, 0.15, -0.16, 0.24); c.stroke();
      c.beginPath(); c.moveTo(0.55, 0.22); c.quadraticCurveTo(0.32, 0.15, 0.16, 0.24); c.stroke();
      c.lineWidth = 0.035;
      c.beginPath(); c.moveTo(-0.66, 1.0); c.quadraticCurveTo(-0.42, 1.28, -0.14, 1.12); c.stroke();
      c.beginPath(); c.moveTo(0.66, 1.0); c.quadraticCurveTo(0.42, 1.28, 0.14, 1.12); c.stroke();
    });
  };

  Dancer.prototype._drawSkirt = function (ctx, look) {
    const sk = this.sk;
    const a = this.skirtAng;
    const fl = clamp(this.flare, -0.1, 1.2);
    const fr = { x: sk.P0.x, y: sk.P0.y, a };
    inFrame(ctx, fr, (c) => {
      const topY = -0.3, hemY = 0.72 - fl * 0.16, topW = 0.86, hemW = 1.12 + fl * 0.55;
      const n = 8;
      const top = [], hem = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        top.push({ x: lerp(-topW, topW, t), y: topY + Math.sin(t * Math.PI) * 0.06 });
        const wave = (i & 1) ? 0.08 : -0.02;
        hem.push({ x: lerp(-hemW, hemW, t), y: hemY + Math.sin(t * Math.PI) * 0.12 + wave - Math.abs(t - 0.5) * fl * 0.25 });
      }
      const path = new Path2D();
      path.moveTo(top[0].x, top[0].y);
      for (let i = 1; i <= n; i++) path.lineTo(top[i].x, top[i].y);
      path.quadraticCurveTo(topW + 0.2 + fl * 0.2, (topY + hemY) / 2, hem[n].x, hem[n].y);
      for (let i = n - 1; i >= 0; i--) {
        const mx = (hem[i].x + hem[i + 1].x) / 2, my = Math.max(hem[i].y, hem[i + 1].y) + 0.08;
        path.quadraticCurveTo(mx, my, hem[i].x, hem[i].y);
      }
      path.quadraticCurveTo(-topW - 0.2 - fl * 0.2, (topY + hemY) / 2, top[0].x, top[0].y);
      path.closePath();
      cel(c, path, {
        fill: P.cream, frame: { x: 0, y: 0, a: 0 }, R: 2, k: 0.22, seed: 50, ang: -1.3,
        pattern: (cc) => {
          for (let i = 0; i < n; i++) {
            cc.beginPath();
            cc.moveTo(top[i].x, top[i].y); cc.lineTo(top[i + 1].x, top[i + 1].y);
            cc.lineTo(hem[i + 1].x * 1.1, hem[i + 1].y + 0.3); cc.lineTo(hem[i].x * 1.1, hem[i].y + 0.3);
            cc.closePath(); cc.fillStyle = SKIRT_COLS[i]; cc.fill();
          }
          // Circles and a black wedge across the pleats
          [[0.3, P.blue], [0.2, P.cream], [0.1, P.red]].forEach(([r, col]) => circle(cc, -0.55, 0.42, r, col));
          circle(cc, 0.62, 0.55, 0.14, INK); circle(cc, 0.62, 0.55, 0.06, P.yellow);
          poly(cc, [[0.05, 0.2], [0.35, 0.9], [-0.15, 0.85]], INK);
          // Waistband
          cc.fillStyle = INK; cc.fillRect(-1.2, topY - 0.06, 2.4, 0.12);
          for (let i = 0; i < 8; i++) circle(cc, -0.8 + i * 0.23, topY, 0.035, i & 1 ? P.yellow : P.red);
        }
      }, look);
      // Pleat lines
      c.save(); c.clip(path);
      c.strokeStyle = INK; c.lineWidth = 0.03;
      for (let i = 1; i < n; i++) { c.beginPath(); c.moveTo(top[i].x, top[i].y + 0.06); c.lineTo(hem[i].x, hem[i].y + 0.05); c.stroke(); }
      c.restore();
    });
  };

  Dancer.prototype._drawArm = function (ctx, arm, i, look) {
    const side = arm.side;
    const up = limb(arm.sh, arm.el, 0.205, 0.145, 0.04, 0.015, side, 0.9, 0.5);
    cel(ctx, up.path, {
      fill: SKIN, frame: up.frame, R: 1.6, k: 0.13, seed: 60 + i,
      pattern: (c) => inFrame(c, up.frame, (cc) => {
        cc.fillStyle = P.blue; cc.fillRect(0.55, -0.3, 0.14, 0.6);
        circle(cc, 0.62, 0, 0.05, P.yellow);
      })
    }, look);
    const fore = limb(arm.el, arm.wr, 0.15, 0.1, 0.035, 0.01, side, 0.6, 0.5);
    cel(ctx, fore.path, {
      fill: SKIN, frame: fore.frame, R: 1.4, k: 0.11, seed: 70 + i,
      pattern: (c) => inFrame(c, fore.frame, (cc) => {
        const L = fore.L;
        [[P.yellow, L - 0.3], [P.red, L - 0.18]].forEach(([col, x]) => { cc.fillStyle = col; cc.fillRect(x, -0.3, 0.1, 0.6); });
      })
    }, look);
    // Bangle outlines
    inFrame(ctx, fore.frame, (c) => {
      c.strokeStyle = INK; c.lineWidth = 0.025;
      [fore.L - 0.3, fore.L - 0.2, fore.L - 0.18, fore.L - 0.08].forEach((x) => { c.beginPath(); c.moveTo(x, -0.12); c.lineTo(x, 0.12); c.stroke(); });
    });
    // Hand: mitten with thumb, oriented along the forearm
    const a = fore.frame.a;
    inFrame(ctx, { x: arm.wr.x, y: arm.wr.y, a }, (c) => {
      const s = side * (Math.cos(a) > 0 ? 1 : -1);
      const path = smoothClosed([
        { x: -0.04, y: -0.1 }, { x: 0.18, y: -0.13 }, { x: 0.38, y: -0.1 }, { x: 0.44, y: 0 }, { x: 0.38, y: 0.1 },
        { x: 0.18, y: 0.12 }, { x: 0.12, y: 0.14 * 1 }, { x: -0.04, y: 0.1 }
      ]);
      cel(c, path, { fill: SKIN, frame: { x: 0, y: 0, a: 0 }, R: 0.5, k: 0.07, hatch: false, lw: 0.06 }, look);
      const th = smoothClosed([{ x: 0.08, y: -0.08 * s }, { x: 0.22, y: -0.2 * s }, { x: 0.3, y: -0.2 * s }, { x: 0.2, y: -0.06 * s }]);
      cel(c, th, { fill: SKIN, frame: { x: 0, y: 0, a: 0 }, R: 0.4, k: 0.05, hatch: false, lw: 0.05 }, look);
      c.strokeStyle = INK; c.lineWidth = 0.022;
      [0.03, -0.03, 0.08 * s].forEach((y) => { c.beginPath(); c.moveTo(0.26, y); c.lineTo(0.4, y * 1.2); c.stroke(); });
      // Red nail tips
      c.fillStyle = P.red; c.beginPath(); c.arc(0.41, 0, 0.03, 0, Math.PI * 2); c.fill();
    });
  };

  Dancer.prototype._drawHead = function (ctx, look) {
    const p = this.pose;
    const fr = this._headFrame();
    headFrame(ctx, fr, (c) => {
      // Face
      const face = smoothClosed([
        { x: 0, y: -0.64 }, { x: 0.36, y: -0.56 }, { x: 0.45, y: -0.22 }, { x: 0.43, y: 0.08 }, { x: 0.33, y: 0.36 },
        { x: 0.13, y: 0.52 }, { x: 0, y: 0.56 }, { x: -0.13, y: 0.52 }, { x: -0.33, y: 0.36 }, { x: -0.43, y: 0.08 },
        { x: -0.45, y: -0.22 }, { x: -0.36, y: -0.56 }
      ]);
      // Ears + hoop earrings (behind the face outline)
      [-1, 1].forEach((s) => {
        circle(c, s * 0.45, 0.05, 0.09, SKIN, INK, LW2);
        c.save(); c.translate(s * 0.46, 0.13); c.rotate(this.earAng * (s > 0 ? 1 : 0.8));
        c.lineWidth = 0.1; c.strokeStyle = INK; c.beginPath(); c.arc(0, 0.2, 0.18, 0, Math.PI * 2); c.stroke();
        c.lineWidth = 0.055; c.strokeStyle = s < 0 ? P.yellow : P.red; c.beginPath(); c.arc(0, 0.2, 0.18, 0, Math.PI * 2); c.stroke();
        circle(c, 0, 0.38, 0.06, s < 0 ? P.blue : P.yellow, INK, 0.025);
        c.restore();
      });
      cel(c, face, {
        fill: SKIN, frame: { x: 0, y: 0, a: 0 }, R: 0.8, k: 0.16, seed: 80, sp: 0.07,
        pattern: (cc) => this._faceArt(cc, p)
      }, look);
      this._faceInk(c, p);
      // Bangs + side locks
      const bangs = smoothClosed([
        { x: -0.52, y: -0.2 }, { x: -0.5, y: -0.55 }, { x: -0.22, y: -0.76 }, { x: 0.18, y: -0.77 }, { x: 0.5, y: -0.56 },
        { x: 0.52, y: -0.18 }, { x: 0.47, y: 0.32 }, { x: 0.4, y: 0.34 }, { x: 0.38, y: -0.2 },
        { x: 0.25, y: -0.27 }, { x: 0.12, y: -0.22 }, { x: 0, y: -0.27 }, { x: -0.12, y: -0.22 }, { x: -0.25, y: -0.27 },
        { x: -0.38, y: -0.2 }, { x: -0.4, y: 0.34 }, { x: -0.47, y: 0.32 }
      ], null, 0.55);
      cel(c, bangs, {
        fill: HAIR, frame: { x: 0, y: 0, a: 0 }, R: 1, k: 0.12, seed: 90, ang: 0.4,
        pattern: (cc) => {
          // Angel-ring highlight
          cc.strokeStyle = HAIR_HI; cc.lineWidth = 0.08;
          cc.beginPath(); cc.arc(0, -0.15, 0.5, -2.6, -1.9); cc.stroke();
          cc.beginPath(); cc.arc(0, -0.15, 0.5, -1.65, -1.2); cc.stroke();
        }
      }, look);
      c.strokeStyle = INK; c.lineWidth = 0.022;
      [-0.3, -0.12, 0.08, 0.27].forEach((x) => { c.beginPath(); c.moveTo(x, -0.62); c.quadraticCurveTo(x + 0.03, -0.45, x, -0.3); c.stroke(); });
    });
  };

  // Make-up painted under the shading so it gets cel-shaded with the skin.
  Dancer.prototype._faceArt = function (c, p) {
    // Kandinsky make-up: blue triangle over the left eye, sun-circle around the right.
    poly(c, [[-0.4, -0.08], [-0.08, -0.16], [-0.3, -0.42]], P.blue, INK, 0.02);
    circle(c, 0.21, -0.06, 0.15, P.yellow);
    c.strokeStyle = P.red; c.lineWidth = 0.035; c.beginPath(); c.arc(0.21, -0.06, 0.15, 0, Math.PI * 2); c.stroke();
    circle(c, 0.36, 0.2, 0.035, P.red);
    c.strokeStyle = INK; c.lineWidth = 0.02; c.beginPath(); c.moveTo(-0.34, 0.1); c.lineTo(-0.22, 0.26); c.stroke();
    circle(c, -0.3, 0.27, 0.025, P.teal);
    // Blush
    c.globalAlpha = 0.35; c.fillStyle = '#ff6a8a';
    c.beginPath(); c.ellipse(-0.27, 0.16, 0.09, 0.05, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(0.27, 0.16, 0.09, 0.05, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  };

  Dancer.prototype._faceInk = function (c, p) {
    const look = clamp(p.look, -1, 1) * 0.03;
    const browY = -0.2 - p.brow * 0.05;
    c.strokeStyle = INK; c.lineCap = 'round';
    // Brows
    c.lineWidth = 0.05;
    [-1, 1].forEach((s) => {
      c.beginPath();
      if (p.eyes === 2) { c.moveTo(s * 0.08, browY + 0.04); c.lineTo(s * 0.3, browY - 0.04); }
      else { c.moveTo(s * 0.08, browY + 0.02); c.quadraticCurveTo(s * 0.2, browY - 0.05, s * 0.32, browY + 0.01); }
      c.stroke();
    });
    // Eyes
    [-1, 1].forEach((s) => {
      const ex = s * 0.19, ey = -0.04;
      if (p.eyes === 1 || p.eyes === 3) { // closed / happy
        c.lineWidth = 0.04;
        c.beginPath();
        if (p.eyes === 1) c.arc(ex, ey + 0.04, 0.08, Math.PI * 1.15, Math.PI * 1.85);
        else { c.moveTo(ex - 0.09, ey); c.quadraticCurveTo(ex, ey + 0.035, ex + 0.09, ey); }
        c.stroke();
        c.lineWidth = 0.025; c.beginPath(); c.moveTo(ex + s * 0.09, ey - 0.01); c.lineTo(ex + s * 0.15, ey - 0.05); c.stroke();
        return;
      }
      const wide = p.eyes === 2 ? 1.25 : 1;
      c.beginPath();
      c.moveTo(ex - 0.1, ey);
      c.quadraticCurveTo(ex, ey - 0.1 * wide, ex + 0.1, ey);
      c.quadraticCurveTo(ex, ey + 0.065 * wide, ex - 0.1, ey);
      c.fillStyle = '#fffaf2'; c.fill();
      c.save(); c.clip();
      circle(c, ex + look, ey - 0.005, p.eyes === 2 ? 0.035 : 0.055, '#3a1f6b');
      circle(c, ex + look, ey - 0.005, p.eyes === 2 ? 0.015 : 0.028, INK);
      circle(c, ex + look + 0.02, ey - 0.03, 0.014, '#ffffff');
      c.restore();
      // Heavy liner with a wing
      c.lineWidth = 0.035;
      c.beginPath(); c.moveTo(ex - 0.11, ey + 0.005); c.quadraticCurveTo(ex, ey - 0.11 * wide, ex + 0.1, ey);
      c.lineTo(ex + s * 0.17, ey - 0.06); c.stroke();
      c.lineWidth = 0.018; c.beginPath(); c.moveTo(ex - 0.08, ey + 0.04); c.quadraticCurveTo(ex, ey + 0.065 * wide, ex + 0.08, ey + 0.035); c.stroke();
    });
    // Nose
    c.lineWidth = 0.025;
    c.beginPath(); c.moveTo(0.02, 0.06); c.quadraticCurveTo(0.06, 0.15, 0.0, 0.17); c.stroke();
    // Mouth
    const my = 0.31;
    if (p.mouth === 1) {
      c.beginPath(); c.moveTo(-0.12, my - 0.02); c.quadraticCurveTo(0, my - 0.04, 0.12, my - 0.02);
      c.quadraticCurveTo(0.06, my + 0.14, 0, my + 0.14); c.quadraticCurveTo(-0.06, my + 0.14, -0.12, my - 0.02);
      c.fillStyle = '#5a0f2a'; c.fill();
      c.save(); c.clip(); c.fillStyle = '#fff'; c.fillRect(-0.12, my - 0.04, 0.24, 0.045); c.fillStyle = '#e8506f';
      c.beginPath(); c.ellipse(0, my + 0.13, 0.06, 0.04, 0, 0, Math.PI * 2); c.fill(); c.restore();
      c.lineWidth = 0.03; c.strokeStyle = LIPS; c.stroke();
      c.lineWidth = 0.022; c.strokeStyle = INK; c.stroke();
    } else if (p.mouth === 2) {
      c.beginPath(); c.ellipse(0.01, my + 0.04, 0.05, 0.065, 0.2, 0, Math.PI * 2);
      c.fillStyle = '#5a0f2a'; c.fill(); c.lineWidth = 0.03; c.strokeStyle = LIPS; c.stroke();
      c.lineWidth = 0.02; c.strokeStyle = INK; c.stroke();
      // Sweat drop
      c.beginPath(); c.moveTo(0.42, -0.42); c.quadraticCurveTo(0.5, -0.28, 0.44, -0.24); c.quadraticCurveTo(0.36, -0.28, 0.42, -0.42);
      c.fillStyle = '#9fe8ff'; c.fill(); c.lineWidth = 0.02; c.strokeStyle = INK; c.stroke();
    } else {
      // Smile: red lips
      c.beginPath(); c.moveTo(-0.12, my); c.quadraticCurveTo(-0.05, my - 0.04, 0, my - 0.015); c.quadraticCurveTo(0.05, my - 0.04, 0.12, my);
      c.quadraticCurveTo(0, my + 0.1, -0.12, my); c.fillStyle = LIPS; c.fill();
      c.lineWidth = 0.022; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.moveTo(-0.12, my); c.quadraticCurveTo(0, my + 0.035, 0.12, my); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(0.03, my + 0.045, 0.03, 0.012, 0, 0, Math.PI * 2); c.fill();
    }
  };

  // Joint positions in screen space (for effects anchored to hands etc.)
  Dancer.prototype.handPos = function (x, y, u, which) {
    if (!this.sk) return { x, y };
    const w = this.sk.arms[which].wr;
    return { x: x + w.x * u, y: y + w.y * u };
  };
  Dancer.prototype.headPos = function (x, y, u) {
    if (!this.sk) return { x, y: y - 7 * u };
    return { x: x + this.sk.H.x * u, y: y + this.sk.H.y * u };
  };

  IGG.Dancer = Dancer;
})(window.IGG);
