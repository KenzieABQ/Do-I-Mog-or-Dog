/* Do I Mog or Dog — vector math, statistics and triangulation helpers */
(function (M) {
  'use strict';

  const DEG = 180 / Math.PI;

  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const len = (a) => Math.hypot(a.x, a.y);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const norm = (a) => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // Unsigned angle (degrees, 0–180) between two vectors.
  function angleBetween(u, v) {
    const l = len(u) * len(v);
    if (!l) return NaN;
    return Math.acos(clamp(dot(u, v) / l, -1, 1)) * DEG;
  }
  // Interior angle at `vertex` formed by rays to `a` and `b`.
  const angleAt = (vertex, a, b) => angleBetween(sub(a, vertex), sub(b, vertex));

  // Abramowitz & Stegun 7.1.26 (max error 1.5e-7)
  function erf(x) {
    const s = Math.sign(x);
    x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const normPdf = (z) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);

  function circumcircle(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-9) return { x: 0, y: 0, r2: Infinity };
    const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
    const x = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
    const y = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
    return { x, y, r2: (a.x - x) ** 2 + (a.y - y) ** 2 };
  }

  // Bowyer–Watson Delaunay triangulation; returns unique edges as index pairs.
  function delaunayEdges(points) {
    const n = points.length;
    if (n < 2) return [];
    if (n === 2) return [[0, 1]];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const d = Math.max(maxX - minX, maxY - minY, 1) * 20;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const P = points.map((p) => ({ x: p.x, y: p.y }))
      .concat([{ x: cx - d, y: cy - d }, { x: cx + d, y: cy - d }, { x: cx, y: cy + d }]);
    const tri = (a, b, c) => ({ a, b, c, cc: circumcircle(P[a], P[b], P[c]) });
    const key = (u, v) => (u < v ? u + ',' + v : v + ',' + u);

    let tris = [tri(n, n + 1, n + 2)];
    for (let i = 0; i < n; i++) {
      const p = P[i];
      const keep = [];
      const edges = new Map();
      for (const t of tris) {
        const dx = p.x - t.cc.x, dy = p.y - t.cc.y;
        if (dx * dx + dy * dy <= t.cc.r2) {
          for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
            const k = key(u, v);
            edges.set(k, (edges.get(k) || 0) + 1);
          }
        } else keep.push(t);
      }
      tris = keep;
      for (const [k, count] of edges) {
        if (count !== 1) continue;
        const [u, v] = k.split(',').map(Number);
        tris.push(tri(u, v, i));
      }
    }
    const out = new Set();
    for (const t of tris) {
      for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
        if (u < n && v < n) out.add(key(u, v));
      }
    }
    return [...out].map((k) => k.split(',').map(Number));
  }

  // Deterministic PRNG for repeatable animations / demo jitter.
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
  }

  M.geo = {
    DEG, sub, add, mul, dot, cross, len, dist, mid, norm, clamp, lerp,
    angleBetween, angleAt, erf, normCdf, normPdf, delaunayEdges, rng,
  };
})(window.MOG = window.MOG || {});
