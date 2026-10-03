// Shared helpers. Everything hangs off one global namespace so the game
// runs straight from file:// without a bundler or ES-module CORS issues.
window.IGG = window.IGG || {};

(function (IGG) {
  'use strict';

  // Deterministic PRNG (mulberry32) so charts and sketchy backgrounds are stable.
  function rng(seed) {
    let a = seed >>> 0;
    const next = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + (hi - lo) * next();
    next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.sign = () => (next() < 0.5 ? -1 : 1);
    return next;
  }

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutBack = (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  // Rotate a vector by angle a.
  function rot(x, y, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: x * c - y * s, y: x * s + y * c };
  }

  // Closed Catmull-Rom spline through points -> Path2D (or into an existing path).
  function smoothClosed(pts, path, tension) {
    const p = path || new Path2D();
    const n = pts.length;
    const k = (tension == null ? 1 : tension) / 6;
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      p.bezierCurveTo(
        p1.x + (p2.x - p0.x) * k, p1.y + (p2.y - p0.y) * k,
        p2.x - (p3.x - p1.x) * k, p2.y - (p3.y - p1.y) * k,
        p2.x, p2.y);
    }
    p.closePath();
    return p;
  }

  // Open Catmull-Rom spline.
  function smoothOpen(pts, path) {
    const p = path || new Path2D();
    const n = pts.length;
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      p.bezierCurveTo(
        p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
        p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
        p2.x, p2.y);
    }
    return p;
  }

  // Two-bone IK. Returns the middle joint for a chain root->end with
  // lengths l1, l2. bendSign picks which side the joint bows toward.
  function ik2(ax, ay, tx, ty, l1, l2, bendSign) {
    let dx = tx - ax, dy = ty - ay;
    let d = Math.hypot(dx, dy);
    const maxD = (l1 + l2) * 0.999;
    if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
    if (d < 1e-4) d = 1e-4;
    const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const base = Math.atan2(dy, dx);
    const ang = base + a * bendSign;
    return {
      mid: { x: ax + Math.cos(ang) * l1, y: ay + Math.sin(ang) * l1 },
      end: { x: ax + dx, y: ay + dy }
    };
  }

  IGG.util = { rng, clamp, lerp, smooth, easeOut, easeOutBack, rot, smoothClosed, smoothOpen, ik2 };

  // Kandinsky-ish palette shared by the dancer, HUD and club accents.
  IGG.PAL = {
    ink: '#120d14',
    cream: '#f5ecd6',
    red: '#e0283f',
    yellow: '#f7c823',
    blue: '#1f49c4',
    sky: '#3fb6e8',
    orange: '#f5822a',
    teal: '#13a88f',
    violet: '#7a3fb8',
    pink: '#ff4fa3',
    lime: '#9be22d'
  };
})(window.IGG);
