/* Do I Mog or Dog — scan sequence, verdict reveal, radar, diagnostic matrix */
(function (M) {
  'use strict';
  const G = M.geo;
  const L = M.landmarks;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- shared canvas helpers ----------
  function sizeCanvas(canvas) {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  }

  // Fit the image (or, if zoomTo, the landmark bounding box) into w×h.
  function fitTransform(img, w, h, pts, pad = 0.12) {
    let bx = 0, by = 0, bw = img.naturalWidth, bh = img.naturalHeight;
    if (pts && pts.length) {
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const pw = (maxX - minX) * pad + 20, ph = (maxY - minY) * pad + 20;
      bx = minX - pw; by = minY - ph; bw = maxX - minX + pw * 2; bh = maxY - minY + ph * 2;
    }
    const s = Math.min(w / bw, h / bh);
    return { s, ox: (w - bw * s) / 2 - bx * s, oy: (h - bh * s) / 2 - by * s };
  }
  const T = (t, p) => ({ x: p.x * t.s + t.ox, y: p.y * t.s + t.oy });

  function label(ctx, text, x, y, color) {
    ctx.font = '600 10px "JetBrains Mono", monospace';
    const w = ctx.measureText(text).width + 10;
    const cw = ctx.canvas.width / (window.devicePixelRatio || 1);
    const ch = ctx.canvas.height / (window.devicePixelRatio || 1);
    x = G.clamp(x, 2, cw - w - 2);
    y = G.clamp(y, 14, ch - 4);
    ctx.fillStyle = 'rgba(6,6,9,.88)';
    ctx.fillRect(x, y - 12, w, 16);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y - 11.5, w - 1, 15);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 5, y);
  }

  function line(ctx, a, b, color, width = 1.5, dash) {
    ctx.beginPath();
    ctx.setLineDash(dash || []);
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---------- 3-second cybernetic scan ----------
  const PHASES = [
    'Triangulating Delaunay mesh',
    'Computing canthal & orbital vectors',
    'Resolving gonial / ramus geometry',
    'Projecting Frankfurt horizontal',
    'Applying critical failo gates',
  ];

  function scan(data, done) {
    const overlay = $('#scan-overlay');
    overlay.hidden = false;
    overlay.classList.remove('out');
    const bar = $('#scan-bar'), sub = $('#scan-sub'), log = $('#scan-log');
    log.textContent = '';
    const scenes = ['frontal', 'profile'].map((view, vi) => {
      const canvas = overlay.querySelector(`canvas[data-view="${view}"]`);
      const { ctx, w, h } = sizeCanvas(canvas);
      const img = data.images[view];
      const defs = L.defs(view);
      const raw = defs.map((d) => data.landmarks[view][d.id]).filter(Boolean);
      const t = fitTransform(img, w, h, raw, 0.35);
      const pts = raw.map((p) => T(t, p));
      const r = G.rng(97 + vi * 31);
      const nodeT = pts.map(() => 0.05 + r() * 0.45);
      const edges = G.delaunayEdges(pts).map(([a, b]) => ({ a, b, t0: Math.max(nodeT[a], nodeT[b]) + r() * 0.25 }));
      return { view, ctx, w, h, img, t, pts, nodeT, edges, defs: defs.filter((d) => data.landmarks[view][d.id]), raw };
    });

    const allNodes = [];
    scenes.forEach((s) => s.defs.forEach((d, i) => allNodes.push({ d, p: s.raw[i] })));
    let logIdx = 0, lastLog = 0;
    const D = 3000;
    const t0 = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - t0) / D);
      for (const s of scenes) drawScan(s, t, now);
      bar.style.width = (t * 100).toFixed(1) + '%';
      sub.textContent = `▸ ${PHASES[Math.min(PHASES.length - 1, Math.floor(t * PHASES.length))]} · ${Math.round(t * 100)}%`;
      if (now - lastLog > 70 && logIdx < allNodes.length * 2) {
        lastLog = now;
        const n = allNodes[logIdx % allNodes.length];
        const lines = log.textContent.split('\n').filter(Boolean);
        lines.push(`> ${n.d.id.padEnd(28)} (${n.p.x.toFixed(2).padStart(8)}, ${n.p.y.toFixed(2).padStart(8)})  ${logIdx < allNodes.length ? 'LOCKED' : 'VECTOR OK'}`);
        log.textContent = lines.slice(-6).join('\n');
        logIdx++;
      }
      if (t < 1) requestAnimationFrame(frame);
      else {
        overlay.classList.add('out');
        setTimeout(() => { overlay.hidden = true; overlay.classList.remove('out'); done(); }, 340);
      }
    }
    requestAnimationFrame(frame);
  }

  function drawScan(s, t, now) {
    const { ctx, w, h, img } = s;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(s.t.ox, s.t.oy);
    ctx.scale(s.t.s, s.t.s);
    ctx.globalAlpha = 0.55;
    ctx.filter = 'grayscale(1) contrast(1.25) brightness(0.65)';
    ctx.drawImage(img, 0, 0);
    ctx.filter = 'none';
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,40,30,.25)';
    ctx.fillRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = 'rgba(0,240,255,.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x += 24) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0; y < h; y += 24) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();

    // mesh edges grow in
    for (const e of s.edges) {
      const k = G.clamp((t - e.t0) / 0.15, 0, 1);
      if (k <= 0) continue;
      const a = s.pts[e.a], b = s.pts[e.b];
      const end = { x: G.lerp(a.x, b.x, k), y: G.lerp(a.y, b.y, k) };
      ctx.strokeStyle = `rgba(57,255,20,${0.25 + 0.45 * k})`;
      ctx.lineWidth = 1;
      ctx.shadowColor = '#39FF14';
      ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // nodes
    s.pts.forEach((p, i) => {
      const k = G.clamp((t - s.nodeT[i]) / 0.08, 0, 1);
      if (!k) return;
      const pulse = 1 + 0.5 * Math.sin(now / 120 + i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2 + (1 - k) * 10, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,240,255,${k})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,240,255,${0.35 * k})`;
      ctx.stroke();
    });

    // sweeping scanline
    const sy = ((t * 2.2) % 1) * h;
    const g = ctx.createLinearGradient(0, sy - 40, 0, sy);
    g.addColorStop(0, 'rgba(57,255,20,0)');
    g.addColorStop(1, 'rgba(57,255,20,.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, sy - 40, w, 40);
    ctx.fillStyle = '#39FF14';
    ctx.fillRect(0, sy, w, 1.5);
  }

  // ---------- annotated diagnostic images ----------
  function drawAnnotated(canvas, img, P, view, analysis) {
    const { ctx, w, h } = sizeCanvas(canvas);
    const defs = L.defs(view);
    const raw = defs.map((d) => P[d.id]).filter(Boolean);
    const t = fitTransform(img, w, h, raw, 0.22);
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(t.ox, t.oy); ctx.scale(t.s, t.s);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
    const S = (id) => (P[id] ? T(t, P[id]) : null);
    const metric = (key) => analysis[view].find((m) => m.key === key);
    const colorOf = (m) => (m && m.status === 'ideal' ? '#39FF14' : m && m.status === 'failo' ? '#FF2A3D' : '#E0B84A');

    for (const [a, b] of L.conns(view)) {
      const p = S(a), q = S(b);
      if (p && q) line(ctx, p, q, 'rgba(0,240,255,.35)', 1, [3, 3]);
    }

    if (view === 'frontal') {
      const fw = metric('fwhr'), ct = metric('canthalTilt'), mf = metric('midface'), bg = metric('bigonial');
      const zl = S('Left_Zygoma'), zr = S('Right_Zygoma'), gl = S('Glabella'), ls = S('Labiale_Superius');
      if (zl && zr) { line(ctx, zr, zl, colorOf(fw), 2); label(ctx, `FWHR ${fw.display}`, Math.min(zr.x, zl.x), zr.y - 8, colorOf(fw)); }
      if (gl && ls && zl && zr) {
        line(ctx, { x: zr.x, y: gl.y }, { x: zl.x, y: gl.y }, 'rgba(255,255,255,.25)', 1, [5, 4]);
        line(ctx, { x: zr.x, y: ls.y }, { x: zl.x, y: ls.y }, 'rgba(255,255,255,.25)', 1, [5, 4]);
      }
      for (const side of ['Left', 'Right']) {
        const a = S(side + '_Inner_Canthus'), b = S(side + '_Outer_Canthus');
        if (!a || !b) continue;
        const d = G.sub(b, a);
        line(ctx, G.sub(a, G.mul(d, 0.3)), G.add(b, G.mul(d, 0.5)), colorOf(ct), 1.8);
      }
      const ol = S('Left_Outer_Canthus');
      if (ol && ct) label(ctx, `TILT ${ct.display}`, ol.x + 8, ol.y - 10, colorOf(ct));
      const pl = S('Left_Pupil'), pr = S('Right_Pupil');
      if (pl && pr && mf) { line(ctx, pr, pl, colorOf(mf), 1.2); }
      const gol = S('Left_Gonion'), gor = S('Right_Gonion');
      if (gol && gor && bg) { line(ctx, gor, gol, colorOf(bg), 1.8); label(ctx, `Go/Zy ${bg.display}`, gor.x, gor.y + 18, colorOf(bg)); }
      if (mf && pr) label(ctx, `MIDFACE ${mf.display}`, pr.x - 40, (pr.y + (ls ? ls.y : pr.y)) / 2, colorOf(mf));
    } else {
      const go = S('Profile_Gonion'), ra = S('Profile_Ramus_Top'), me = S('Profile_Menton');
      const gm = metric('gonial'), cv = metric('convexity'), nl = metric('nasolabial'), cm = metric('cervicomental');
      if (go && ra && me) {
        line(ctx, ra, go, colorOf(gm), 2.2);
        line(ctx, go, me, colorOf(gm), 2.2);
        label(ctx, `∠G ${gm.display}`, go.x - 70, go.y + 22, colorOf(gm));
      }
      const g = S('Profile_Glabella'), sn = S('Profile_Subnasale'), pog = S('Profile_Pogonion');
      if (g && sn && pog) {
        line(ctx, g, sn, colorOf(cv), 1.6);
        line(ctx, sn, pog, colorOf(cv), 1.6);
        label(ctx, `CONVEX ${cv.display}`, sn.x + 12, sn.y + 4, colorOf(cv));
      }
      const tip = S('Profile_Nasal_Tip'), ls = S('Profile_Labiale_Superius');
      if (tip && sn && ls) {
        line(ctx, sn, tip, colorOf(nl), 1.4);
        line(ctx, sn, ls, colorOf(nl), 1.4);
        label(ctx, `NL ${nl.display}`, tip.x + 8, tip.y - 6, colorOf(nl));
      }
      const c = S('Profile_Submental_Point');
      if (c && me) {
        line(ctx, c, me, colorOf(cm), 1.6);
        line(ctx, c, { x: c.x, y: c.y + 60 }, colorOf(cm), 1.2, [4, 3]);
        label(ctx, `CM ${cm.display}`, c.x - 20, c.y + 30, colorOf(cm));
      }
      const co = S('Profile_Cornea'), or = S('Profile_Infraorbital_Rim');
      const ov = metric('orbital');
      if (co && or) {
        line(ctx, { x: co.x, y: co.y - 16 }, { x: co.x, y: or.y + 12 }, 'rgba(255,255,255,.35)', 1, [3, 3]);
        line(ctx, { x: or.x, y: or.y - 10 }, { x: or.x, y: or.y + 10 }, colorOf(ov), 2);
      }
    }

    for (const d of defs) {
      const p = S(d.id);
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = L.color(d.group);
      ctx.fill();
    }
  }

  // ---------- radar ----------
  function radarSVG(axes, color) {
    const VW = 560, VH = 400, cx = VW / 2, c = VH / 2, R = 135;
    const n = axes.length;
    const pt = (i, v) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      return { x: cx + Math.cos(a) * R * v / 10, y: c + Math.sin(a) * R * v / 10 };
    };
    const poly = (vals) => vals.map((v, i) => { const p = pt(i, v); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ');
    let s = `<svg class="radar" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Six-axis radar chart">`;
    for (const r of [2, 4, 6, 8, 10]) {
      s += `<polygon points="${poly(axes.map(() => r))}" fill="${r === 10 ? 'rgba(255,255,255,.015)' : 'none'}" stroke="rgba(255,255,255,${r === 10 ? 0.18 : 0.08})"/>`;
    }
    s += `<polygon points="${poly(axes.map(() => 5))}" fill="none" stroke="rgba(0,240,255,.45)" stroke-dasharray="4 4"/>`;
    axes.forEach((a, i) => {
      const p = pt(i, 10);
      s += `<line x1="${cx}" y1="${c}" x2="${p.x}" y2="${p.y}" stroke="rgba(255,255,255,.08)"/>`;
    });
    s += `<polygon points="${poly(axes.map((a) => a.value))}" fill="${color}" fill-opacity=".18" stroke="${color}" stroke-width="2" style="filter:drop-shadow(0 0 8px ${color})"/>`;
    axes.forEach((a, i) => {
      const p = pt(i, a.value);
      s += `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${color}"/>`;
      const lp = pt(i, 11.4);
      const anchor = Math.abs(lp.x - cx) < 10 ? 'middle' : lp.x > cx ? 'start' : 'end';
      s += `<text x="${lp.x}" y="${lp.y}" text-anchor="${anchor}" dominant-baseline="middle">${esc(a.label.toUpperCase())}</text>`;
      s += `<text class="rv" x="${lp.x}" y="${lp.y + 13}" text-anchor="${anchor}" dominant-baseline="middle">${a.value.toFixed(1)}</text>`;
    });
    s += `<text x="${cx + 4}" y="${c - R / 2 - 3}" style="fill:rgba(0,240,255,.7)">μ 5.0</text></svg>`;
    return s;
  }

  // ---------- Gaussian placement ----------
  function bellSVG(score, color) {
    const W = 640, H = 130, x0 = 30, x1 = W - 30, base = H - 26;
    const X = (v) => x0 + ((v - 1) / 9) * (x1 - x0);
    const Y = (v) => base - G.normPdf(v - 5) / G.normPdf(0) * (base - 14);
    let path = '', fill = '';
    for (let v = 1; v <= 10.001; v += 0.05) path += `${path ? 'L' : 'M'}${X(v).toFixed(1)},${Y(v).toFixed(1)}`;
    for (let v = 1; v <= score + 0.001; v += 0.05) fill += `L${X(v).toFixed(1)},${Y(v).toFixed(1)}`;
    fill = `M${X(1)},${base}${fill}L${X(score)},${Y(score)}L${X(score)},${base}Z`;
    let ticks = '';
    for (let v = 1; v <= 10; v++) ticks += `<line x1="${X(v)}" y1="${base}" x2="${X(v)}" y2="${base + 4}" stroke="rgba(255,255,255,.25)"/><text x="${X(v)}" y="${base + 16}" text-anchor="middle">${v}</text>`;
    return `<svg class="bell" viewBox="0 0 ${W} ${H}" role="img" aria-label="Score position on a normal distribution, mean 5, sigma 1">
      <path d="${fill}" fill="${color}" fill-opacity=".18"/>
      <path d="${path}" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.5"/>
      <line x1="${x0}" y1="${base}" x2="${x1}" y2="${base}" stroke="rgba(255,255,255,.2)"/>
      ${ticks}
      <line x1="${X(5)}" y1="14" x2="${X(5)}" y2="${base}" stroke="rgba(0,240,255,.4)" stroke-dasharray="3 3"/>
      <text x="${X(5) + 4}" y="20" style="fill:rgba(0,240,255,.8)">μ = 5.0  σ = 1.0</text>
      <line x1="${X(score)}" y1="8" x2="${X(score)}" y2="${base}" stroke="${color}" stroke-width="2.5" style="filter:drop-shadow(0 0 6px ${color})"/>
      <circle cx="${X(score)}" cy="${Y(score)}" r="5" fill="${color}"/>
      <text x="${X(score)}" y="6" text-anchor="middle" style="fill:${color};font-weight:700">YOU ${score.toFixed(2)}</text>
    </svg>`;
  }

  // ---------- odometer ----------
  function odometerHTML(final) {
    const str = final.toFixed(2);
    let html = '';
    for (const ch of str) {
      if (ch === '.') { html += '<span class="odo-dot">.</span>'; continue; }
      let digits = '';
      for (let d = 0; d <= 10; d++) digits += `<span>${d % 10}</span>`;
      html += `<span class="odo-col"><span class="odo-strip">${digits}</span></span>`;
    }
    return html + '<span class="odo-max">/10</span>';
  }

  function runOdometer(root, final, duration, onDone) {
    const strips = [...root.querySelectorAll('.odo-strip')].reverse(); // [hundredths, tenths, units, tens]
    const target = Math.round(final * 100);
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    function pos(n, k) {
      const p = Math.pow(10, k);
      const d = Math.floor(n / p) % 10;
      const frac = k === 0 ? n - Math.floor(n) : Math.max(0, (n % p) - (p - 1));
      return d + frac;
    }
    function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      const n = t >= 1 ? target : target * ease(t);
      strips.forEach((s, k) => { s.style.transform = `translateY(${-pos(n, k)}em)`; });
      if (t < 1) requestAnimationFrame(frame);
      else if (onDone) onDone();
    }
    requestAnimationFrame(frame);
  }

  // ---------- matrix table ----------
  const STATUS = { ideal: 'MOG / IDEAL', average: 'AVERAGE', failo: 'FAILO / DOGGED', na: 'N/A' };

  function tableHTML(title, list, sub, sex) {
    const sym = sex === 'female' ? '♀' : '♂';
    const rows = list.map((m) => `
      <tr class="st-${m.status}">
        <td><b>${esc(m.label)}</b>${m.critical ? '<span class="gate-mark" title="Critical failo gate">◆ GATE</span>' : ''}<small>${esc(m.formula)}</small></td>
        <td class="v">${esc(m.display)}${m.detail ? `<small>${esc(m.detail)}</small>` : ''}</td>
        <td class="t"><span class="nw">${m.sexSpecific ? sym + ' ' : ''}${esc(m.target.ideal)}</span>${m.target.failo ? `<small>Failo ${esc(m.target.failo)}</small>` : ''}</td>
        <td><span class="pill ${m.status}">${STATUS[m.status]}</span></td>
      </tr>`).join('');
    return `<section class="card">
      <header><h3>${title}</h3><small>${sub}</small></header>
      <table class="matrix">
        <thead><tr><th>Metric</th><th>Measured</th><th>PSL Target</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
  }

  function summaryText(result, analysis) {
    const r = result;
    const lines = [
      `DO I MOG OR DOG — ${r.tier.badge}`,
      `PSL ${r.final.toFixed(2)} / 10 · ${r.tier.name} · ${r.percentile.toFixed(1)}th percentile`,
    ];
    if (r.cap != null) lines.push(`Hard cap ${r.cap.toFixed(2)} (${r.capLabel}) from ${r.crits.length} critical failo(s); uncapped ${r.base.toFixed(2)}`);
    lines.push('', 'FRONTAL');
    analysis.frontal.forEach((m) => lines.push(`  ${m.label}: ${m.display} [${STATUS[m.status]}]`));
    lines.push('PROFILE');
    analysis.profile.forEach((m) => lines.push(`  ${m.label}: ${m.display} [${STATUS[m.status]}]`));
    return lines.join('\n');
  }

  // ---------- reveal ----------
  function render(root, ctx) {
    const { analysis, result, images, landmarks, sex, animate = true } = ctx;
    const r = result;
    const color = r.tier.color;
    const allGates = analysis.frontal.concat(analysis.profile).filter((m) => m.critical);
    const pctTop = 100 - r.percentile;

    root.innerHTML = `
    <div class="reveal" style="--tier:${color}">
      <section class="hero-card">
        <div class="eyebrow">Step 04 · Final Verdict · ${sex === 'female' ? '♀ Female' : '♂ Male'} standard</div>
        <div class="stamp-wrap"><div class="stamp" id="verdict-stamp">${esc(r.tier.badge)}</div></div>
        <div class="odometer" id="odometer" aria-label="PSL score ${r.final.toFixed(2)} out of 10">${odometerHTML(r.final)}</div>
        <div class="tier-name">${esc(r.tier.name)}</div>
        <div class="score-meta">
          <span>PERCENTILE <b>${r.percentile.toFixed(1)}</b></span>
          <span>${pctTop < 50 ? 'TOP' : 'BOTTOM'} <b>${(pctTop < 50 ? pctTop : r.percentile).toFixed(1)}%</b></span>
          <span>σ <b>${r.sigma >= 0 ? '+' : '−'}${Math.abs(r.sigma).toFixed(2)}</b></span>
          <span>IDEAL <b>${r.counts.ideal}</b> · AVG <b>${r.counts.average}</b> · FAILO <b>${r.counts.failo}</b></span>
        </div>
        ${r.cap != null ? `<div class="cap-notice">⚠ ${r.crits.length} CRITICAL FAILO${r.crits.length > 1 ? 'S' : ''} DETECTED (${r.crits.map((m) => esc(m.critical.label)).join(', ')}). HARD CAP ${r.cap.toFixed(2)} · ${esc(r.capLabel)}. Uncapped geometry scored ${r.base.toFixed(2)}.</div>` : ''}
        ${bellSVG(r.final, color)}
      </section>

      ${analysis.warnings.length ? `<div class="warnings">${analysis.warnings.map((w) => `<div>⚠ ${esc(w)}</div>`).join('')}</div>` : ''}

      <section class="card">
        <header><h3>Critical Failo Gates</h3><small>1 fail → cap 5.40 · 2 → cap 4.40 · 3+ → sub-4.00</small></header>
        <div class="gates">
          ${allGates.map((m) => `<div class="gate ${m.value == null ? 'na' : m.critical.hit ? 'fail' : 'pass'}"><i>${m.value == null ? 'N/A' : m.critical.hit ? 'FAIL' : 'PASS'}</i><span>${esc(m.critical.label)} <small style="color:var(--dim)">${esc(m.critical.rule)}</small></span><span class="gv">${esc(m.display)}</span></div>`).join('')}
        </div>
        <div class="factors">
          <div class="mog"><h4>▲ Mog Factors</h4><ul>${r.strengths.map((m) => `<li>${esc(m.label)}<span>${esc(m.display)}</span></li>`).join('') || '<li>None<span>—</span></li>'}</ul></div>
          <div class="dog"><h4>▼ Dog Factors</h4><ul>${r.weaknesses.map((m) => `<li>${esc(m.label)}<span>${esc(m.display)}</span></li>`).join('') || '<li>None<span>—</span></li>'}</ul></div>
        </div>
      </section>

      <div class="grid-2">
        <section class="card">
          <header><h3>Morphometric Radar</h3><small>0–10 per axis · dashed ring = population mean</small></header>
          ${radarSVG(r.axes, color)}
          <div class="subscores">
            <div>FRONTAL SUBSCORE<b>${r.frontalScore.toFixed(2)}</b></div>
            <div>PROFILE SUBSCORE<b>${r.profileScore.toFixed(2)}</b></div>
          </div>
        </section>
        <section class="card">
          <header><h3>Vector Overlay</h3><small>green ideal · gold average · red failo</small></header>
          <div class="annot"><canvas id="annot-frontal"></canvas><canvas id="annot-profile"></canvas></div>
        </section>
      </div>

      <div class="grid-2 matrix-grid">
        ${tableHTML('Frontal Metrics', analysis.frontal, `${analysis.frontal.length} measures · subscore ${r.frontalScore.toFixed(2)}`, sex)}
        ${tableHTML('Profile Metrics', analysis.profile, `${analysis.profile.length} measures · subscore ${r.profileScore.toFixed(2)}`, sex)}
      </div>

      <div class="result-actions">
        <button class="btn ghost" data-res="adjust">← Adjust Landmarks</button>
        <button class="btn ghost" data-res="copy">⧉ Copy Verdict</button>
        <button class="btn ghost danger" data-res="new">New Subject</button>
      </div>
    </div>`;

    requestAnimationFrame(() => {
      drawAnnotated($('#annot-frontal', root), images.frontal, landmarks.frontal, 'frontal', analysis);
      drawAnnotated($('#annot-profile', root), images.profile, landmarks.profile, 'profile', analysis);
    });

    const stamp = $('#verdict-stamp', root);
    if (animate) runOdometer(root, r.final, 2200, () => stamp.classList.add('slam'));
    else { runOdometer(root, r.final, 1, null); stamp.classList.add('slam'); }

    root.querySelector('.result-actions').addEventListener('click', (e) => {
      const b = e.target.closest('[data-res]');
      if (!b) return;
      if (b.dataset.res === 'adjust') ctx.onAdjust();
      else if (b.dataset.res === 'new') ctx.onNew();
      else if (b.dataset.res === 'copy') {
        const text = summaryText(r, analysis);
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
          .then(() => ctx.toast('Verdict copied to clipboard'))
          .catch(() => ctx.toast('Clipboard unavailable'));
      }
    });
  }

  function redrawAnnotations(root, ctx) {
    const f = $('#annot-frontal', root), p = $('#annot-profile', root);
    if (f && p && f.offsetParent) {
      drawAnnotated(f, ctx.images.frontal, ctx.landmarks.frontal, 'frontal', ctx.analysis);
      drawAnnotated(p, ctx.images.profile, ctx.landmarks.profile, 'profile', ctx.analysis);
    }
  }

  M.results = { scan, render, redrawAnnotations };
})(window.MOG = window.MOG || {});
