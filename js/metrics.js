/* Do I Mog or Dog — geometric calculation engine
 *
 * Every metric is computed from raw pixel coordinates. Each one gets a band
 * [failoLow, idealLow, idealHigh, failoHigh]: inside the ideal range → MOG / IDEAL,
 * between ideal and failo thresholds → AVERAGE, beyond a failo threshold → FAILO / DOGGED.
 */
(function (M) {
  'use strict';
  const G = M.geo;
  const INF = Infinity;
  const DEG = G.DEG;

  const BANDS = {
    canthalTilt:   { male: [-1, 3, 7, 12], female: [-1, 4, 8, 13] },
    fwhr:          { male: [1.68, 1.85, 2.05, 2.18], female: [1.62, 1.78, 1.98, 2.12] },
    midface:       { both: [0.91, 0.98, 1.03, 1.10] },
    eyeRatio:      { both: [0.88, 0.95, 1.05, 1.12] },
    bigonial:      { male: [0.75, 0.83, 0.88, 0.95], female: [0.68, 0.75, 0.80, 0.88] },
    philtrumChin:  { both: [1.6, 2.0, 2.2, 2.8] },
    mouthNose:     { both: [1.20, 1.35, 1.50, 1.70] },
    thirds:        { both: [-INF, -INF, 2.0, 4.5], span: 2.0 },
    palpebral:     { male: [0.18, 0.24, 0.32, 0.40], female: [0.20, 0.28, 0.38, 0.46] },
    symmetry:      { both: [-INF, -INF, 2.5, 6.0], span: 2.5 },
    gonial:        { male: [105, 115, 123, 135], female: [108, 120, 128, 138] },
    ramus:         { male: [0.75, 1.00, INF, INF], female: [0.70, 0.90, INF, INF], span: 0.2 },
    convexity:     { both: [158, 165, 175, 184] },
    mpa:           { both: [12, 20, 25, 32] },
    orbital:       { both: [-1.0, 0, INF, INF], span: 1.5 },
    nasolabial:    { male: [80, 90, 95, 110], female: [85, 95, 105, 120] },
    mentolabial:   { both: [100, 120, 130, 142] },
    cervicomental: { both: [80, 90, 100, 120] },
  };

  const num = (dp, unit = '', signed = false) => (v) => {
    if (v == null || !isFinite(v)) return '—';
    const s = v < 0 ? '−' : signed && v > 0 ? '+' : '';
    return s + Math.abs(v).toFixed(dp) + unit;
  };

  // Radar axes: eye, jaw, midface, profile, harmony, dimorphism
  const META = {
    canthalTilt: {
      label: 'Canthal Tilt', view: 'frontal', fmt: num(1, '°', true), weight: 1.4, axes: ['eye', 'dimorphism'],
      formula: '∠(En→Ex) vs. horizontal, roll-corrected',
      crit: { test: (v) => v < -1, label: 'Negative Canthal Tilt', rule: '< −1°' },
    },
    fwhr: {
      label: 'FWHR', view: 'frontal', fmt: num(2), weight: 1.2, axes: ['midface', 'dimorphism'],
      formula: 'Bizygomatic ÷ vertical(G line → Ls line)',
      crit: { test: (v) => v < 1.68 || v > 2.18, label: 'FWHR Out of Bounds', rule: '< 1.68 or > 2.18' },
    },
    midface: {
      label: 'Midface Ratio', view: 'frontal', fmt: num(3), weight: 1.4, axes: ['midface'],
      formula: 'IPD ÷ vertical(pupil line → Ls line)',
      crit: { test: (v) => v < 0.90, label: 'Long Midface', rule: '< 0.90' },
    },
    eyeRatio: {
      label: 'ICD : PFL (Eye Spacing)', view: 'frontal', fmt: num(3), weight: 0.9, axes: ['eye', 'harmony'],
      formula: 'Intercanthal distance ÷ mean palpebral fissure length',
    },
    bigonial: {
      label: 'Bigonial : Bizygomatic', view: 'frontal', fmt: num(3), weight: 1.1, axes: ['jaw', 'dimorphism'],
      formula: 'Go–Go width ÷ Zy–Zy width',
    },
    philtrumChin: {
      label: 'Philtrum : Chin', view: 'frontal', fmt: (v) => (isFinite(v) ? '1 : ' + v.toFixed(2) : '—'), weight: 1.0, axes: ['jaw', 'harmony'],
      formula: '(Sn→Ls) : (Li→Me)',
      crit: { test: (v) => v < 1.6, label: 'Long Philtrum / Weak Chin', rule: '< 1 : 1.6' },
    },
    mouthNose: {
      label: 'Mouth : Nose Width', view: 'frontal', fmt: num(2), weight: 0.6, axes: ['harmony'],
      formula: 'Ch–Ch width ÷ Al–Al width',
    },
    thirds: {
      label: 'Vertical Thirds σ', view: 'frontal', fmt: num(1, '%'), weight: 0.8, axes: ['harmony'],
      formula: 'SD of Tr–G / G–Sn / Sn–Me share of face height',
    },
    palpebral: {
      label: 'Eye Aspect (Hunter Index)', view: 'frontal', fmt: num(3), weight: 0.7, axes: ['eye', 'dimorphism'],
      formula: 'Lid aperture height ÷ PFL (lower = more hooded)',
    },
    symmetry: {
      label: 'Bilateral Asymmetry', view: 'frontal', fmt: num(1, '%'), weight: 0.9, axes: ['harmony'],
      formula: 'Mean paired-landmark deviation from midline ÷ bizygomatic',
    },
    gonial: {
      label: 'Gonial Angle', view: 'profile', fmt: num(1, '°'), weight: 1.2, axes: ['jaw', 'dimorphism'],
      formula: '∠ Ramus_Top – Gonion – Menton',
      crit: { test: (v) => v > 135, label: 'High-Angle Steep Jaw', rule: '> 135°' },
    },
    ramus: {
      label: 'Ramus : Mandibular Body', view: 'profile', fmt: num(2), weight: 1.0, axes: ['jaw', 'dimorphism'],
      formula: '|Ra→Go| ÷ |Go→Me|',
    },
    convexity: {
      label: 'Facial Convexity', view: 'profile', fmt: num(1, '°'), weight: 1.4, axes: ['profile', 'jaw'],
      formula: '∠ Glabella – Subnasale – Pogonion',
      crit: { test: (v) => v < 155, label: 'Recessed Mandible', rule: '< 155°' },
    },
    mpa: {
      label: 'Mandibular Plane Angle', view: 'profile', fmt: num(1, '°'), weight: 0.9, axes: ['jaw', 'profile'],
      formula: '∠(Go→Me) vs. Frankfurt horizontal (image level)',
    },
    orbital: {
      label: 'Orbital Vector', view: 'profile', fmt: num(1, '%', true), weight: 1.0, axes: ['eye', 'midface'],
      formula: 'Infraorbital rim ahead (+) / behind (−) cornea, % N–Me',
    },
    nasolabial: {
      label: 'Nasolabial Angle', view: 'profile', fmt: num(1, '°'), weight: 0.6, axes: ['profile', 'harmony'],
      formula: '∠ Nasal_Tip – Subnasale – Labiale_Sup',
    },
    mentolabial: {
      label: 'Mentolabial Angle', view: 'profile', fmt: num(1, '°'), weight: 0.6, axes: ['profile', 'jaw'],
      formula: '∠ Labiale_Inf – Sulcus – Pogonion',
    },
    cervicomental: {
      label: 'Cervicomental Angle', view: 'profile', fmt: num(1, '°'), weight: 0.8, axes: ['profile', 'jaw'],
      formula: '∠(C→Me) vs. vertical neck line',
    },
  };

  const ORDER = {
    frontal: ['canthalTilt', 'fwhr', 'midface', 'eyeRatio', 'bigonial', 'philtrumChin', 'mouthNose', 'thirds', 'palpebral', 'symmetry'],
    profile: ['gonial', 'ramus', 'convexity', 'mpa', 'orbital', 'nasolabial', 'mentolabial', 'cervicomental'],
  };

  function getBand(key, sex) {
    const b = BANDS[key];
    const a = b[sex] || b.both;
    return { fl: a[0], il: a[1], ih: a[2], fh: a[3], span: b.span || 1, sexSpecific: !b.both };
  }

  // Map a value onto the band → status + z contribution (ideal 1..2, average 1..−1, failo −1..−3).
  function evaluate(x, b) {
    if (x == null || !isFinite(x)) return { status: 'na', z: 0 };
    const { fl, il, ih, fh, span } = b;
    if (x >= il && x <= ih) {
      let q;
      if (isFinite(il) && isFinite(ih)) {
        const h = (ih - il) / 2;
        q = h > 0 ? 1 - Math.abs(x - (il + ih) / 2) / h : 1;
      } else if (isFinite(il)) q = Math.min(1, (x - il) / span);
      else q = Math.min(1, (ih - x) / span);
      return { status: 'ideal', z: 1 + q };
    }
    const below = x < il;
    const edge = below ? il : ih;
    const limit = below ? fl : fh;
    const tol = isFinite(limit) ? Math.abs(edge - limit) || span : span;
    const d = Math.abs(x - edge) / tol;
    if (d <= 1) return { status: 'average', z: 1 - 2 * d, side: below ? 'low' : 'high' };
    return { status: 'failo', z: Math.max(-3, -1 - 2 * (d - 1)), side: below ? 'low' : 'high' };
  }

  function targetText(b, fmt) {
    let ideal;
    if (isFinite(b.il) && isFinite(b.ih)) ideal = `${fmt(b.il)} – ${fmt(b.ih)}`;
    else if (isFinite(b.il)) ideal = `≥ ${fmt(b.il)}`;
    else ideal = `≤ ${fmt(b.ih)}`;
    const f = [];
    if (isFinite(b.fl)) f.push(`< ${fmt(b.fl)}`);
    if (isFinite(b.fh)) f.push(`> ${fmt(b.fh)}`);
    return { ideal, failo: f.join(' or ') };
  }

  function build(key, value, sex, detail = '') {
    const m = META[key];
    const b = getBand(key, sex);
    const ev = evaluate(value, b);
    const hasVal = value != null && isFinite(value);
    return {
      key, label: m.label, view: m.view, value: hasVal ? value : null,
      display: m.fmt(value), detail, formula: m.formula,
      target: targetText(b, m.fmt), sexSpecific: b.sexSpecific,
      status: ev.status, z: ev.z, weight: m.weight, axes: m.axes,
      critical: m.crit ? { label: m.crit.label, rule: m.crit.rule, hit: hasVal && m.crit.test(value) } : null,
    };
  }

  const has = (P, ids) => ids.every((id) => P[id]);

  function computeFrontal(P, sex) {
    const vals = {};
    const details = {};
    const info = {};

    // Face frame: u = interpupillary axis (image-right), v = perpendicular (down). Removes head roll.
    let u = { x: 1, y: 0 };
    if (has(P, ['Left_Pupil', 'Right_Pupil'])) {
      u = G.norm(G.sub(P.Left_Pupil, P.Right_Pupil));
      if (u.x < 0) u = { x: -u.x, y: -u.y };
    }
    const v = { x: -u.y, y: u.x };
    const X = (p) => G.dot(p, u);
    const Y = (p) => G.dot(p, v);
    info.roll = Math.atan2(u.y, u.x) * DEG;

    const pfl = (side) => G.dist(P[side + '_Inner_Canthus'], P[side + '_Outer_Canthus']);

    if (has(P, ['Left_Inner_Canthus', 'Left_Outer_Canthus', 'Right_Inner_Canthus', 'Right_Outer_Canthus'])) {
      const tilt = (inner, outer) => {
        const d = G.sub(outer, inner);
        return Math.atan2(-G.dot(d, v), Math.abs(G.dot(d, u))) * DEG;
      };
      const l = tilt(P.Left_Inner_Canthus, P.Left_Outer_Canthus);
      const r = tilt(P.Right_Inner_Canthus, P.Right_Outer_Canthus);
      vals.canthalTilt = (l + r) / 2;
      details.canthalTilt = `L ${META.canthalTilt.fmt(l)} · R ${META.canthalTilt.fmt(r)}`;

      const icd = G.dist(P.Left_Inner_Canthus, P.Right_Inner_Canthus);
      vals.eyeRatio = icd / ((pfl('Left') + pfl('Right')) / 2);
      details.eyeRatio = vals.eyeRatio < 0.88 ? 'hypotelorism' : vals.eyeRatio > 1.12 ? 'hypertelorism' : 'ICD ≈ eye width';
    }

    if (has(P, ['Left_Zygoma', 'Right_Zygoma', 'Glabella', 'Labiale_Superius'])) {
      const bzw = G.dist(P.Left_Zygoma, P.Right_Zygoma);
      const h = Math.abs(Y(P.Labiale_Superius) - Y(P.Glabella));
      vals.fwhr = bzw / h;
      details.fwhr = `${bzw.toFixed(0)} ÷ ${h.toFixed(0)} px`;
    }

    if (has(P, ['Left_Pupil', 'Right_Pupil', 'Labiale_Superius'])) {
      const ipd = G.dist(P.Left_Pupil, P.Right_Pupil);
      const h = Math.abs(Y(P.Labiale_Superius) - Y(G.mid(P.Left_Pupil, P.Right_Pupil)));
      vals.midface = ipd / h;
      details.midface = `IPD ${ipd.toFixed(0)} ÷ ${h.toFixed(0)} px`;
    }

    if (has(P, ['Left_Gonion', 'Right_Gonion', 'Left_Zygoma', 'Right_Zygoma'])) {
      vals.bigonial = G.dist(P.Left_Gonion, P.Right_Gonion) / G.dist(P.Left_Zygoma, P.Right_Zygoma);
    }

    if (has(P, ['Subnasale', 'Labiale_Superius', 'Labiale_Inferius', 'Menton'])) {
      const ph = G.dist(P.Subnasale, P.Labiale_Superius);
      const ch = G.dist(P.Labiale_Inferius, P.Menton);
      vals.philtrumChin = ch / ph;
      details.philtrumChin = `${ph.toFixed(0)} : ${ch.toFixed(0)} px`;
    }

    if (has(P, ['Left_Cheilion', 'Right_Cheilion', 'Left_Alar', 'Right_Alar'])) {
      vals.mouthNose = G.dist(P.Left_Cheilion, P.Right_Cheilion) / G.dist(P.Left_Alar, P.Right_Alar);
    }

    if (has(P, ['Hairline_Trichion', 'Glabella', 'Subnasale', 'Menton'])) {
      const d = [
        Y(P.Glabella) - Y(P.Hairline_Trichion),
        Y(P.Subnasale) - Y(P.Glabella),
        Y(P.Menton) - Y(P.Subnasale),
      ].map(Math.abs);
      const tot = d[0] + d[1] + d[2];
      const p = d.map((x) => x / tot);
      const mean = 1 / 3;
      vals.thirds = Math.sqrt(p.reduce((s, x) => s + (x - mean) ** 2, 0) / 3) * 100;
      details.thirds = p.map((x) => (x * 100).toFixed(0)).join(' / ') + ' %';
      info.thirds = p;
    }

    if (has(P, ['Left_Upper_Eyelid', 'Left_Lower_Eyelid', 'Right_Upper_Eyelid', 'Right_Lower_Eyelid',
      'Left_Inner_Canthus', 'Left_Outer_Canthus', 'Right_Inner_Canthus', 'Right_Outer_Canthus'])) {
      const ear = (side) => Math.abs(Y(P[side + '_Lower_Eyelid']) - Y(P[side + '_Upper_Eyelid'])) / pfl(side);
      const l = ear('Left'), r = ear('Right');
      vals.palpebral = (l + r) / 2;
      details.palpebral = `L ${l.toFixed(3)} · R ${r.toFixed(3)}`;
    }

    const mids = ['Glabella', 'Subnasale', 'Labiale_Superius', 'Labiale_Inferius', 'Menton'].filter((id) => P[id]);
    const pairs = ['Inner_Canthus', 'Outer_Canthus', 'Pupil', 'Zygoma', 'Gonion', 'Alar', 'Cheilion'];
    if (mids.length >= 3 && has(P, ['Left_Zygoma', 'Right_Zygoma']) && pairs.every((k) => P['Left_' + k] && P['Right_' + k])) {
      const midX = mids.reduce((s, id) => s + X(P[id]), 0) / mids.length;
      const bzw = G.dist(P.Left_Zygoma, P.Right_Zygoma);
      let total = 0;
      for (const k of pairs) {
        const L = P['Left_' + k], R = P['Right_' + k];
        const horiz = Math.abs((X(L) - midX) + (X(R) - midX));
        const vert = Math.abs(Y(L) - Y(R));
        total += (horiz + vert) / 2;
      }
      vals.symmetry = (total / pairs.length) / bzw * 100;
    }

    return { metrics: ORDER.frontal.map((k) => build(k, vals[k], sex, details[k])), info };
  }

  function computeProfile(P, sex) {
    const vals = {};
    const details = {};
    const info = {};
    const p = (id) => P['Profile_' + id];

    // Anterior direction: +1 when the face points image-right.
    let s = 1;
    if (p('Nasal_Tip') && p('Ramus_Top')) s = Math.sign(p('Nasal_Tip').x - p('Ramus_Top').x) || 1;
    else if (p('Nasal_Tip') && p('Gonion')) s = Math.sign(p('Nasal_Tip').x - p('Gonion').x) || 1;
    info.facing = s > 0 ? 'right' : 'left';

    if (p('Ramus_Top') && p('Gonion') && p('Menton')) {
      vals.gonial = G.angleAt(p('Gonion'), p('Ramus_Top'), p('Menton'));
      const ramus = G.dist(p('Ramus_Top'), p('Gonion'));
      const body = G.dist(p('Gonion'), p('Menton'));
      vals.ramus = ramus / body;
      details.ramus = `${ramus.toFixed(0)} ÷ ${body.toFixed(0)} px`;
    }

    if (p('Glabella') && p('Subnasale') && p('Pogonion')) {
      const g = p('Glabella'), sn = p('Subnasale'), pog = p('Pogonion');
      let a = G.angleAt(sn, g, pog);
      // Subnasale behind the G–Pog line → concave (prognathic) profile → reflex angle.
      const t = (sn.y - g.y) / ((pog.y - g.y) || 1);
      const lineX = g.x + t * (pog.x - g.x);
      const concave = (sn.x - lineX) * s < 0;
      if (concave) a = 360 - a;
      vals.convexity = a;
      details.convexity = concave ? 'concave / prognathic' : a < 158 ? 'convex / retruded' : 'orthognathic';
    }

    if (p('Gonion') && p('Menton')) {
      const d = G.sub(p('Menton'), p('Gonion'));
      vals.mpa = Math.atan2(d.y, Math.abs(d.x)) * DEG;
    }

    if (p('Infraorbital_Rim') && p('Cornea')) {
      const ref = p('Nasion') && p('Menton') ? G.dist(p('Nasion'), p('Menton')) : null;
      if (ref) {
        const dx = (p('Infraorbital_Rim').x - p('Cornea').x) * s;
        vals.orbital = dx / ref * 100;
        details.orbital = dx >= 0 ? 'rim anterior to cornea' : 'rim behind cornea';
      }
    }

    if (p('Subnasale') && p('Nasal_Tip') && p('Labiale_Superius')) {
      vals.nasolabial = G.angleAt(p('Subnasale'), p('Nasal_Tip'), p('Labiale_Superius'));
    }

    if (p('Mentolabial_Sulcus') && p('Labiale_Inferius') && p('Pogonion')) {
      vals.mentolabial = G.angleAt(p('Mentolabial_Sulcus'), p('Labiale_Inferius'), p('Pogonion'));
    }

    if (p('Menton') && p('Submental_Point')) {
      vals.cervicomental = G.angleBetween(G.sub(p('Menton'), p('Submental_Point')), { x: 0, y: 1 });
    }

    if (p('Ramus_Top') && p('Infraorbital_Rim')) {
      const d = G.sub(p('Infraorbital_Rim'), p('Ramus_Top'));
      info.fhProxy = Math.atan2(-d.y, Math.abs(d.x)) * DEG;
    }

    return { metrics: ORDER.profile.map((k) => build(k, vals[k], sex, details[k])), info };
  }

  function compute(landmarks, sex) {
    const f = computeFrontal(landmarks.frontal || {}, sex);
    const p = computeProfile(landmarks.profile || {}, sex);
    const warnings = [];
    if (Math.abs(f.info.roll) > 3) {
      warnings.push(`Head roll of ${f.info.roll.toFixed(1)}° detected in frontal. Metrics are roll-corrected via the interpupillary axis, but re-shoot level for accuracy.`);
    }
    return { frontal: f.metrics, profile: p.metrics, info: { ...f.info, ...p.info }, warnings, sex };
  }

  M.metrics = { compute, evaluate, getBand, META, BANDS, ORDER };
})(window.MOG = window.MOG || {});
