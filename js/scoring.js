/* Do I Mog or Dog — blackpill scoring: Gaussian placement + hard failo ceilings */
(function (M) {
  'use strict';
  const G = M.geo;

  const TIERS = [
    { min: 7.5, name: 'GIGACHAD / CHAD', badge: 'ULTIMATE MOG', color: '#00E58B' },
    { min: 6.5, name: 'CHADLITE', badge: 'MOGGER', color: '#39FF14' },
    { min: 5.75, name: 'HTN · High-Tier Normie', badge: 'SLIGHT MOG', color: '#14D9C4' },
    { min: 4.75, name: 'MTN · Mid-Tier Normie', badge: 'NEUTRAL / MID', color: '#C9A64E' },
    { min: 4.0, name: 'LTN · Low-Tier Normie', badge: 'SLIGHT DOG', color: '#FF8A1F' },
    { min: 3.0, name: 'SUB-5 · Sub-Normie', badge: 'GETTING MOGGED', color: '#FF2A2A' },
    { min: -Infinity, name: 'TRUECEL · Skeletal Failo', badge: 'BRUTAL DOGGED', color: '#C0122F' },
  ];

  const AXES = [
    { key: 'eye', label: 'Eye Area' },
    { key: 'jaw', label: 'Lower Third / Jaw' },
    { key: 'midface', label: 'Midface Compactness' },
    { key: 'profile', label: 'Profile Projection' },
    { key: 'harmony', label: 'Facial Harmony' },
    { key: 'dimorphism', label: 'Dimorphism' },
  ];

  const MEAN = 5.0;
  const SIGMA = 1.0;

  const tierFor = (score) => TIERS.find((t) => score >= t.min);

  function weightedZ(list) {
    let s = 0, w = 0;
    for (const m of list) { s += m.z * m.weight; w += m.weight; }
    return w ? s / w : 0;
  }

  // Composite z (ideal ≈ 1..2, average ≈ −1..1) → standardized deviation from the population mean.
  // Calibrated so a mixed "everything mid" face sits at 5.0 and an all-ideal face lands ~7–8.
  const toScore = (zbar) => G.clamp(MEAN + SIGMA * 2.0 * (zbar - 0.5), 1, 10);

  function score(analysis) {
    const all = analysis.frontal.concat(analysis.profile).filter((m) => m.status !== 'na');
    const base = toScore(weightedZ(all));
    const crits = all.filter((m) => m.critical && m.critical.hit);

    let cap = null, capLabel = '';
    if (crits.length === 1) { cap = 5.40; capLabel = 'HTN Max'; }
    else if (crits.length === 2) { cap = 4.40; capLabel = 'LTN Max'; }
    else if (crits.length >= 3) { cap = Math.max(1, 3.99 - 0.35 * (crits.length - 3)); capLabel = 'Truecel / Sub-Normie'; }

    let final = cap != null ? Math.min(base, cap) : base;
    final = Math.round(G.clamp(final, 1, 10) * 100) / 100;

    const sigma = (final - MEAN) / SIGMA;
    const percentile = G.normCdf(sigma) * 100;

    const axes = AXES.map((a) => {
      const ms = all.filter((m) => m.axes.includes(a.key));
      const z = weightedZ(ms);
      return { ...a, value: ms.length ? G.clamp(5 + 2.5 * z, 0, 10) : 0, count: ms.length };
    });

    const sorted = all.slice().sort((a, b) => b.z - a.z);
    return {
      base: Math.round(base * 100) / 100,
      final, cap, capLabel, crits, sigma, percentile,
      tier: tierFor(final),
      axes,
      frontalScore: toScore(weightedZ(analysis.frontal.filter((m) => m.status !== 'na'))),
      profileScore: toScore(weightedZ(analysis.profile.filter((m) => m.status !== 'na'))),
      counts: {
        ideal: all.filter((m) => m.status === 'ideal').length,
        average: all.filter((m) => m.status === 'average').length,
        failo: all.filter((m) => m.status === 'failo').length,
      },
      strengths: sorted.filter((m) => m.status === 'ideal').slice(0, 4),
      weaknesses: sorted.filter((m) => m.status !== 'ideal').reverse().slice(0, 4),
    };
  }

  M.scoring = { score, TIERS, AXES, tierFor, MEAN, SIGMA };
})(window.MOG = window.MOG || {});
