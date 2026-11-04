/* Do I Mog or Dog — synthetic demo subject (schematic face rendered from the landmark templates) */
(function (M) {
  'use strict';
  const L = M.landmarks;
  const G = M.geo;
  const W = 900, H = 1200;

  function spline(ctx, pts, closed) {
    const n = pts.length;
    const get = (i) => (closed ? pts[(i + n) % n] : pts[G.clamp(i, 0, n - 1)]);
    ctx.moveTo(pts[0].x, pts[0].y);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      ctx.bezierCurveTo(
        p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
        p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
        p2.x, p2.y);
    }
    if (closed) ctx.closePath();
  }

  function points(view, jitter) {
    const r = G.rng(view === 'frontal' ? 11 : 23);
    const box = L.faceBox(view, W, H);
    const out = {};
    for (const d of L.defs(view)) {
      const p = L.seed(view, d, W, H, 'right');
      out[d.id] = { x: p.x + (r() - 0.5) * jitter * box.w, y: p.y + (r() - 0.5) * jitter * box.h };
    }
    return out;
  }

  function backdrop(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a2e36');
    g.addColorStop(1, '#14161b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function skin(ctx, cx, cy, r) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#e2b293');
    g.addColorStop(1, '#b67e60');
    return g;
  }

  function frontal(P) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    backdrop(ctx);
    const cx = (P.Left_Pupil.x + P.Right_Pupil.x) / 2;
    const Tr = P.Hairline_Trichion, Gl = P.Glabella, Me = P.Menton;
    const Lz = P.Left_Zygoma, Rz = P.Right_Zygoma, LGo = P.Left_Gonion, RGo = P.Right_Gonion;

    // neck + shoulders
    const nh = (LGo.x - RGo.x) * 0.33;
    ctx.fillStyle = '#a8735a';
    ctx.fillRect(cx - nh, Me.y - 120, nh * 2, H);
    ctx.fillStyle = '#1d2230';
    ctx.beginPath();
    ctx.moveTo(cx - nh, H * 0.9);
    ctx.bezierCurveTo(cx - nh - 60, H * 0.95, 80, H * 0.93, 0, H);
    ctx.lineTo(W, H);
    ctx.bezierCurveTo(W - 80, H * 0.93, cx + nh + 60, H * 0.95, cx + nh, H * 0.9);
    ctx.closePath();
    ctx.fill();

    // ears
    ctx.fillStyle = '#b07a5d';
    const earY = (P.Left_Pupil.y + P.Left_Alar.y) / 2;
    for (const x of [Rz.x + 10, Lz.x - 10]) { ctx.beginPath(); ctx.ellipse(x, earY, 26, 66, 0, 0, Math.PI * 2); ctx.fill(); }

    // face
    const outline = [
      { x: cx, y: Tr.y - 50 },
      { x: Lz.x - 28, y: Tr.y + 30 }, { x: Lz.x - 6, y: Gl.y + 10 }, Lz,
      { x: Lz.x - 14, y: (Lz.y + LGo.y) / 2 }, LGo,
      { x: cx + (LGo.x - cx) * 0.42, y: Me.y - 22 }, { x: cx, y: Me.y },
      { x: cx - (cx - RGo.x) * 0.42, y: Me.y - 22 }, RGo,
      { x: Rz.x + 14, y: (Rz.y + RGo.y) / 2 }, Rz, { x: Rz.x + 6, y: Gl.y + 10 }, { x: Rz.x + 28, y: Tr.y + 30 },
    ];
    ctx.fillStyle = skin(ctx, cx, (Gl.y + P.Subnasale.y) / 2, (Lz.x - Rz.x) * 0.75);
    ctx.beginPath(); spline(ctx, outline, true); ctx.fill();

    // hair
    ctx.fillStyle = '#1b1310';
    ctx.beginPath();
    ctx.moveTo(Rz.x - 4, Gl.y - 40);
    ctx.bezierCurveTo(Rz.x - 50, Tr.y - 190, Lz.x + 50, Tr.y - 190, Lz.x + 4, Gl.y - 40);
    ctx.quadraticCurveTo(Lz.x - 40, Tr.y, cx, Tr.y);
    ctx.quadraticCurveTo(Rz.x + 40, Tr.y, Rz.x - 4, Gl.y - 40);
    ctx.fill();

    // brows
    ctx.strokeStyle = '#2a1c15';
    ctx.lineCap = 'round';
    ctx.lineWidth = 13;
    for (const s of ['Left', 'Right']) {
      const inn = P[s + '_Inner_Canthus'], out = P[s + '_Outer_Canthus'], up = P[s + '_Upper_Eyelid'];
      const dir = Math.sign(out.x - inn.x);
      ctx.beginPath();
      ctx.moveTo(inn.x - dir * 6, up.y - 34);
      ctx.quadraticCurveTo(up.x + dir * 30, up.y - 52, out.x + dir * 12, up.y - 36);
      ctx.stroke();
    }

    // eyes
    for (const s of ['Left', 'Right']) {
      const inn = P[s + '_Inner_Canthus'], out = P[s + '_Outer_Canthus'];
      const up = P[s + '_Upper_Eyelid'], lo = P[s + '_Lower_Eyelid'], pu = P[s + '_Pupil'];
      const my = (inn.y + out.y) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(inn.x, inn.y);
      ctx.quadraticCurveTo(up.x, 2 * up.y - my, out.x, out.y);
      ctx.quadraticCurveTo(lo.x, 2 * lo.y - my, inn.x, inn.y);
      ctx.fillStyle = '#efe9e3';
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = '#4c6a3c';
      ctx.beginPath(); ctx.arc(pu.x, pu.y, 19, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0c0c0c';
      ctx.beginPath(); ctx.arc(pu.x, pu.y, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath(); ctx.arc(pu.x + 5, pu.y - 5, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#3a271e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(inn.x, inn.y);
      ctx.quadraticCurveTo(up.x, 2 * up.y - my, out.x, out.y);
      ctx.stroke();
    }

    // nose
    const la = P.Left_Alar, ra = P.Right_Alar, sn = P.Subnasale;
    ctx.strokeStyle = 'rgba(110,68,50,.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(P.Right_Inner_Canthus.x + 12, P.Right_Inner_Canthus.y + 14);
    ctx.quadraticCurveTo(ra.x + 8, (Gl.y + sn.y) / 2 + 30, ra.x + 4, ra.y - 22);
    ctx.moveTo(P.Left_Inner_Canthus.x - 12, P.Left_Inner_Canthus.y + 14);
    ctx.quadraticCurveTo(la.x - 8, (Gl.y + sn.y) / 2 + 30, la.x - 4, la.y - 22);
    ctx.stroke();
    ctx.strokeStyle = '#7c4c38';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ra.x, ra.y - 14);
    ctx.quadraticCurveTo(ra.x - 4, ra.y + 14, cx - 14, sn.y - 2);
    ctx.quadraticCurveTo(cx, sn.y + 6, cx + 14, sn.y - 2);
    ctx.quadraticCurveTo(la.x + 4, la.y + 14, la.x, la.y - 14);
    ctx.stroke();
    ctx.fillStyle = '#5a3426';
    for (const x of [cx - 20, cx + 20]) { ctx.beginPath(); ctx.ellipse(x, sn.y - 9, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); }

    // mouth
    const lc = P.Left_Cheilion, rc = P.Right_Cheilion, ls = P.Labiale_Superius, li = P.Labiale_Inferius;
    const st = (ls.y + li.y) / 2 - 6;
    ctx.fillStyle = '#b4625a';
    ctx.beginPath();
    ctx.moveTo(rc.x, rc.y);
    ctx.quadraticCurveTo(cx - 34, ls.y - 4, cx - 9, ls.y);
    ctx.quadraticCurveTo(cx, ls.y + 6, cx + 9, ls.y);
    ctx.quadraticCurveTo(cx + 34, ls.y - 4, lc.x, lc.y);
    ctx.quadraticCurveTo(cx, st + 6, rc.x, rc.y);
    ctx.fill();
    ctx.fillStyle = '#c4726a';
    ctx.beginPath();
    ctx.moveTo(rc.x, rc.y);
    ctx.quadraticCurveTo(cx, st + 6, lc.x, lc.y);
    ctx.quadraticCurveTo(cx, 2 * li.y - lc.y, rc.x, rc.y);
    ctx.fill();
    ctx.strokeStyle = '#6e3530';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(rc.x, rc.y); ctx.quadraticCurveTo(cx, st + 6, lc.x, lc.y); ctx.stroke();

    // jaw shading
    ctx.strokeStyle = 'rgba(90,50,35,.25)';
    ctx.lineWidth = 6;
    ctx.beginPath(); spline(ctx, [Rz, RGo, { x: cx, y: Me.y - 4 }, LGo, Lz], false); ctx.stroke();
    return c.toDataURL('image/jpeg', 0.9);
  }

  function profile(P) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    backdrop(ctx);
    const b = L.faceBox('profile', W, H);
    const B = (x, y) => ({ x: b.x + x * b.w, y: b.y + y * b.h });
    const p = (id) => P['Profile_' + id];

    // shoulders
    ctx.fillStyle = '#1d2230';
    ctx.beginPath();
    ctx.moveTo(B(0.2, 1.02).x, H);
    ctx.bezierCurveTo(B(0.25, 0.98).x, B(0, 0.97).y, B(0.7, 0.97).x, B(0, 0.98).y, B(0.85, 1.05).x, H);
    ctx.fill();

    const tr = p('Trichion'), gl = p('Glabella'), n = p('Nasion'), tip = p('Nasal_Tip'), sn = p('Subnasale');
    const ls = p('Labiale_Superius'), li = p('Labiale_Inferius'), sm = p('Mentolabial_Sulcus'), pog = p('Pogonion');
    const me = p('Menton'), c2 = p('Submental_Point'), ra = p('Ramus_Top'), go = p('Gonion');
    const stom = { x: ls.x - 0.02 * b.w, y: (ls.y + li.y) / 2 };
    const head = [
      tr, B(0.645, 0.22), gl, n, { x: (n.x + tip.x) / 2 + 6, y: (n.y + tip.y) / 2 }, tip,
      { x: tip.x - 0.035 * b.w, y: tip.y + 0.03 * b.h }, sn, ls, stom, li, sm, pog, me, c2,
      { x: c2.x + 6, y: B(0, 0.95).y }, { x: c2.x - 4, y: H + 20 }, { x: B(0.29, 0).x, y: H + 20 },
      B(0.30, 0.86), B(0.24, 0.66), B(0.17, 0.45), B(0.22, 0.24), B(0.38, 0.08),
    ];
    ctx.fillStyle = skin(ctx, B(0.5, 0.45).x, B(0.5, 0.45).y, b.h * 0.6);
    ctx.beginPath(); spline(ctx, head, true); ctx.fill();

    // hair
    ctx.fillStyle = '#1b1310';
    ctx.beginPath();
    spline(ctx, [tr, B(0.38, 0.06), B(0.21, 0.22), B(0.16, 0.45), B(0.2, 0.6), B(0.3, 0.52), B(0.36, 0.36), B(0.5, 0.24), B(0.58, 0.16)], true);
    ctx.fill();

    // ear
    ctx.fillStyle = '#b07a5d';
    ctx.beginPath(); ctx.ellipse(ra.x - 0.04 * b.w, ra.y - 0.07 * b.h, 0.04 * b.w, 0.075 * b.h, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(80,45,30,.6)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(ra.x - 0.04 * b.w, ra.y - 0.07 * b.h, 0.022 * b.w, 0.05 * b.h, 0.15, 0, Math.PI * 2); ctx.stroke();

    // eye + brow
    const co = p('Cornea');
    ctx.fillStyle = '#efe9e3';
    ctx.beginPath();
    ctx.moveTo(co.x - 0.07 * b.w, co.y - 2);
    ctx.quadraticCurveTo(co.x - 0.02 * b.w, co.y - 0.025 * b.h, co.x, co.y);
    ctx.quadraticCurveTo(co.x - 0.02 * b.w, co.y + 0.02 * b.h, co.x - 0.07 * b.w, co.y - 2);
    ctx.fill();
    ctx.fillStyle = '#3d5a30';
    ctx.beginPath(); ctx.ellipse(co.x - 0.012 * b.w, co.y, 5, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a1c15';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(gl.x - 0.11 * b.w, gl.y + 0.005 * b.h); ctx.quadraticCurveTo(gl.x - 0.05 * b.w, gl.y - 0.02 * b.h, gl.x - 0.01 * b.w, gl.y + 0.01 * b.h); ctx.stroke();

    // nostril, lips, jaw shading
    ctx.fillStyle = '#5a3426';
    ctx.beginPath(); ctx.ellipse(sn.x + 0.03 * b.w, sn.y - 0.012 * b.h, 14, 6, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6e3530';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(stom.x, stom.y); ctx.lineTo(stom.x - 0.05 * b.w, stom.y + 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,50,35,.3)';
    ctx.lineWidth = 6;
    ctx.beginPath(); spline(ctx, [ra, go, me], false); ctx.stroke();
    return c.toDataURL('image/jpeg', 0.9);
  }

  function create() {
    const fp = points('frontal', 0.006);
    const pp = points('profile', 0.006);
    return {
      frontal: { photo: { src: frontal(fp), w: W, h: H }, points: fp },
      profile: { photo: { src: profile(pp), w: W, h: H }, points: pp },
    };
  }

  M.demo = { create };
})(window.MOG = window.MOG || {});
