/* Do I Mog or Dog — app state, navigation, persistence and wiring */
(function (M) {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const STORE = 'mogordog.v1';
  const VIEWS = ['frontal', 'profile'];

  const state = {
    sex: 'male',
    calibrated: false,
    screen: 'capture',
    view: 'frontal',
    facing: 'right',
    guides: true,
    photos: { frontal: null, profile: null },
    landmarks: { frontal: {}, profile: {} },
  };
  const images = { frontal: null, profile: null };
  let editor = null;
  let last = null; // { analysis, result }

  // ---------- persistence ----------
  function restore() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!s) return;
      Object.assign(state, s);
      state.photos = Object.assign({ frontal: null, profile: null }, s.photos);
      state.landmarks = Object.assign({ frontal: {}, profile: {} }, s.landmarks);
      for (const v of VIEWS) if (!state.photos[v]) state.landmarks[v] = {};
    } catch (e) { /* fresh start */ }
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE, JSON.stringify(state));
      } catch (e) {
        try {
          localStorage.setItem(STORE, JSON.stringify({ ...state, photos: { frontal: null, profile: null }, landmarks: { frontal: {}, profile: {} } }));
        } catch (_) { /* storage unavailable */ }
      }
    }, 250);
  }

  // ---------- helpers ----------
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
  }

  const placedCount = (v) => M.landmarks.defs(v).filter((d) => state.landmarks[v][d.id]).length;
  const viewComplete = (v) => placedCount(v) === M.landmarks.defs(v).length;
  const complete = () => VIEWS.every(viewComplete);
  const bothPhotos = () => VIEWS.every((v) => state.photos[v] && images[v]);

  // ---------- navigation ----------
  function go(screen) {
    if (screen === 'calibrate') { openCalibration(); return; }
    if ((screen === 'landmarks' || screen === 'results') && !bothPhotos()) { toast('Load both a frontal and a profile photo first.'); return; }
    if (screen === 'results' && !last) {
      if (complete()) analyze();
      else toast('Place every landmark in both views first.');
      return;
    }
    state.screen = screen;
    save();
    $$('.screen').forEach((s) => { s.hidden = s.id !== 'screen-' + screen; });
    if (screen === 'landmarks') showView(state.view);
    updateNav();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function updateNav() {
    const steps = {
      calibrate: { done: state.calibrated, locked: false },
      capture: { done: bothPhotos(), locked: false },
      landmarks: { done: complete(), locked: !bothPhotos() },
      results: { done: !!last && state.screen === 'results', locked: !complete() },
    };
    $$('#stepper button').forEach((b) => {
      const s = steps[b.dataset.step];
      b.classList.toggle('done', s.done);
      b.classList.toggle('locked', s.locked);
      b.classList.toggle('active', b.dataset.step === state.screen);
    });
    $('#btn-to-landmarks').disabled = !bothPhotos();
    const missing = VIEWS.filter((v) => !state.photos[v]);
    $('#capture-status').textContent = missing.length ? `Awaiting: ${missing.join(' + ')}` : '✓ Both views locked';
    $('#btn-analyze').disabled = !complete();
    for (const v of VIEWS) {
      const n = placedCount(v), t = M.landmarks.defs(v).length;
      const el = $(`[data-count="${v}"]`);
      el.textContent = `${n}/${t}`;
      el.parentElement.classList.toggle('complete', n === t);
    }
    const remain = VIEWS.map((v) => M.landmarks.defs(v).length - placedCount(v));
    $('#lm-status').textContent = complete()
      ? '✓ All nodes registered: ready for analysis'
      : `${remain[0]} frontal + ${remain[1]} profile nodes remaining`;
    $$('[data-sex]').forEach((b) => b.classList.toggle('on', b.dataset.sex === state.sex));
    const facingLabel = `Facing ${state.facing === 'right' ? '▶' : '◀'}`;
    $$('[data-role="facing"], [data-tool="facing"]').forEach((b) => { b.textContent = facingLabel; });
  }

  // ---------- capture ----------
  function renderCaptureCard(view) {
    const card = $(`.capture-card[data-view="${view}"]`);
    const p = state.photos[view];
    const vp = $('[data-role="viewport"]', card);
    const img = $('[data-role="photo"]', card);
    card.classList.toggle('has-photo', !!p);
    if (p) { img.src = p.src; vp.style.aspectRatio = `${p.w} / ${p.h}`; }
    else { img.removeAttribute('src'); vp.style.aspectRatio = ''; }
    $('[data-role="overlay"]', card).innerHTML = state.guides ? M.capture.guideSVG(view, state.facing) : '';
    $('[data-role="status"]', card).textContent = p ? `Locked · ${p.w}×${p.h}` : 'Awaiting';
  }

  async function setPhoto(view, data, points) {
    try {
      images[view] = data ? await M.capture.loadImage(data.src) : null;
    } catch (e) {
      toast('Could not read that image.');
      return;
    }
    state.photos[view] = data;
    state.landmarks[view] = points || {};
    last = null;
    renderCaptureCard(view);
    updateNav();
    save();
  }

  function confirmReplace(view) {
    const n = placedCount(view);
    return !n || window.confirm(`Replacing this photo clears its ${n} placed landmark${n > 1 ? 's' : ''}. Continue?`);
  }

  async function handleFile(view, file) {
    if (!file) return;
    if (!confirmReplace(view)) return;
    try {
      await setPhoto(view, await M.capture.fromFile(file));
      toast(`${view === 'frontal' ? 'Frontal' : 'Profile'} photo locked.`);
    } catch (e) {
      toast(e.message || 'Could not load image.');
    }
  }

  function initCapture() {
    for (const card of $$('.capture-card')) {
      const view = card.dataset.view;
      $('[data-role="file"]', card).addEventListener('change', (e) => {
        handleFile(view, e.target.files[0]);
        e.target.value = '';
      });
      $('[data-role="camera"]', card).addEventListener('click', () => {
        if (!confirmReplace(view)) return;
        M.capture.openCamera(view, state.facing, (data) => setPhoto(view, data).then(() => toast('Captured.')));
      });
      $('[data-role="guides"]', card).addEventListener('click', () => {
        state.guides = !state.guides;
        VIEWS.forEach(renderCaptureCard);
        save();
      });
      $('[data-role="clear"]', card).addEventListener('click', () => {
        if (state.photos[view] && confirmReplace(view)) setPhoto(view, null);
      });
      const facingBtn = $('[data-role="facing"]', card);
      if (facingBtn) facingBtn.addEventListener('click', toggleFacing);

      const vp = $('[data-role="viewport"]', card);
      vp.addEventListener('dragover', (e) => { e.preventDefault(); vp.classList.add('drag'); });
      vp.addEventListener('dragleave', () => vp.classList.remove('drag'));
      vp.addEventListener('drop', (e) => {
        e.preventDefault();
        vp.classList.remove('drag');
        handleFile(view, e.dataTransfer.files[0]);
      });
    }
    $('#btn-to-landmarks').addEventListener('click', () => go('landmarks'));
    $('#btn-demo').addEventListener('click', loadDemo);
  }

  function toggleFacing() {
    state.facing = state.facing === 'right' ? 'left' : 'right';
    VIEWS.forEach(renderCaptureCard);
    updateNav();
    save();
  }

  async function loadDemo() {
    if ((placedCount('frontal') || placedCount('profile')) && !window.confirm('Load the demo subject? This replaces your current photos and landmarks.')) return;
    const d = M.demo.create();
    state.facing = 'right';
    await setPhoto('frontal', d.frontal.photo, d.frontal.points);
    await setPhoto('profile', d.profile.photo, d.profile.points);
    toast('Demo subject loaded with pre-placed landmarks. Drag any node to see it re-score.');
    state.view = 'frontal';
    go('landmarks');
  }

  // ---------- landmarks ----------
  function showView(view) {
    state.view = view;
    $$('#view-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
    $('#stage').classList.toggle('is-profile', view === 'profile');
    editor.load({
      view,
      img: images[view],
      defs: M.landmarks.defs(view),
      points: state.landmarks[view],
      conns: M.landmarks.conns(view),
    });
    updateNav();
  }

  function initLandmarks() {
    editor = new M.LandmarkEditor({
      stage: $('#stage'),
      canvas: $('#editor-canvas'),
      loupe: $('#loupe'),
      list: $('#lm-list'),
      current: $('#lm-current'),
      hud: $('#stage-hud'),
      getFacing: () => state.facing,
      onChange: () => { last = null; updateNav(); save(); },
    });
    editor.bindPanel();

    $('#view-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-view]');
      if (b) showView(b.dataset.view);
    });
    $('#stage-tools').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tool]');
      if (!b) return;
      const t = b.dataset.tool;
      const center = { x: editor.cw / 2, y: editor.ch / 2 };
      if (t === 'place' || t === 'pan') {
        editor.setMode(t);
        $$('[data-tool="place"], [data-tool="pan"]').forEach((x) => x.classList.toggle('on', x.dataset.tool === t));
      } else if (t === 'zoom-in') editor.zoomAt(center, 1.4);
      else if (t === 'zoom-out') editor.zoomAt(center, 1 / 1.4);
      else if (t === 'fit') editor.fit();
      else if (t === 'facing') toggleFacing();
    });
    $('#btn-seed').addEventListener('click', () => {
      editor.seedTemplate();
      toast('Template seeded. Drag each node onto the true anatomical point.');
    });
    $('#btn-clear-view').addEventListener('click', () => {
      if (placedCount(state.view) && window.confirm(`Clear all ${state.view} landmarks?`)) editor.clearAll();
    });
    $('#btn-analyze').addEventListener('click', analyze);
    $$('[data-goto]').forEach((b) => b.addEventListener('click', () => go(b.dataset.goto)));
  }

  // ---------- analysis & results ----------
  function computeAll() {
    const analysis = M.metrics.compute(state.landmarks, state.sex);
    const result = M.scoring.score(analysis);
    last = { analysis, result };
    return last;
  }

  function renderResults(animate) {
    M.results.render($('#results-root'), {
      ...last, images, landmarks: state.landmarks, sex: state.sex, animate,
      onAdjust: () => go('landmarks'),
      onNew: resetAll,
      toast,
    });
  }

  function analyze() {
    if (!complete()) { toast('Place every landmark in both views first.'); return; }
    computeAll();
    M.results.scan({ images, landmarks: state.landmarks }, () => {
      state.screen = 'results';
      save();
      $$('.screen').forEach((s) => { s.hidden = s.id !== 'screen-results'; });
      updateNav();
      window.scrollTo({ top: 0 });
      renderResults(true);
    });
  }

  function resetAll() {
    if (!window.confirm('Start over with a new subject? Photos and landmarks will be cleared.')) return;
    for (const v of VIEWS) { state.photos[v] = null; state.landmarks[v] = {}; images[v] = null; renderCaptureCard(v); }
    last = null;
    save();
    go('capture');
  }

  function setSex(sex) {
    if (sex === state.sex) return;
    state.sex = sex;
    save();
    updateNav();
    if (last) {
      computeAll();
      if (state.screen === 'results') renderResults(false);
    }
    toast(`Scoring standard: ${sex === 'male' ? '♂ Male' : '♀ Female'}`);
  }

  // ---------- calibration protocol ----------
  function openCalibration() {
    $('#calibration-modal').hidden = false;
    updateCalibration();
  }
  function closeModal(m) {
    if (m.id === 'camera-modal') M.capture.closeCamera();
    else m.hidden = true;
  }

  function updateCalibration() {
    const items = $$('.cal-item');
    let n = 0;
    for (const it of items) {
      const ok = $('.confirm input', it).checked;
      it.classList.toggle('ok', ok);
      n += ok;
    }
    $('#cal-count').textContent = `${n}/${items.length}`;
    $('#cal-go').disabled = n < items.length;
  }

  function initCalibration() {
    const modal = $('#calibration-modal');
    modal.addEventListener('change', (e) => { if (e.target.matches('.confirm input')) updateCalibration(); });
    $('#cal-go').addEventListener('click', () => {
      state.calibrated = true;
      save();
      modal.hidden = true;
      go(state.screen === 'results' && !last ? 'capture' : state.screen);
      updateNav();
    });

    // focal distance demo: nose inflation ≈ d / (d − nose projection)
    const focal = $('#focal-range');
    const updFocal = () => {
      const ft = Number(focal.value);
      const m = ft * 0.3048;
      const infl = m / (m - 0.06) - 1;
      $('#focal-dist').textContent = `${ft.toFixed(1)} ft · ${m.toFixed(1)} m`;
      const out = $('#focal-distortion');
      out.textContent = `+${(infl * 100).toFixed(1)}% nasal / midface inflation`;
      out.className = ft >= 6 ? 'ok' : ft >= 4 ? 'warn' : 'bad';
      const nose = $('#focal-nose');
      nose.setAttribute('rx', (9 * (1 + infl * 2.2)).toFixed(2));
      nose.setAttribute('ry', (13 * (1 + infl * 1.6)).toFixed(2));
      const earScale = Math.max(0.15, 1 - infl * 2.5);
      for (const id of ['focal-ear-l', 'focal-ear-r']) $('#' + id).setAttribute('rx', (9 * earScale).toFixed(2));
    };
    focal.addEventListener('input', updFocal);
    updFocal();

    const notes = {
      flat: ['ok', '✓ Even, shadow-less: true geometry visible'],
      top: ['bad', '✕ Fake brow projection, hollowed under-eyes'],
      side: ['bad', '✕ Half-face shadow distorts symmetry'],
    };
    $('#light-seg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-light]');
      if (!b) return;
      $$('#light-seg button').forEach((x) => x.classList.toggle('on', x === b));
      $('#light-face').setAttribute('fill', `url(#lg-${b.dataset.light})`);
      const [cls, txt] = notes[b.dataset.light];
      const n = $('#light-note');
      n.className = cls;
      n.textContent = txt;
    });

    const fh = $('#fh-range');
    const updFh = () => {
      const a = Number(fh.value);
      $('#fh-head').setAttribute('transform', `rotate(${-a} 100 85)`);
      $('#fh-angle').textContent = `${a > 0 ? '+' : a < 0 ? '−' : ''}${Math.abs(a)}°`;
      const note = $('#fh-note');
      if (Math.abs(a) <= 1) { note.textContent = '✓ Frankfurt plane level'; note.className = 'ok'; }
      else { note.textContent = a > 0 ? 'Chin up: tilt head down' : 'Chin down: tilt head up'; note.className = Math.abs(a) > 5 ? 'bad' : 'warn'; }
    };
    fh.addEventListener('input', updFh);
    updFh();
  }

  // ---------- global wiring ----------
  function initGlobal() {
    $('#stepper').addEventListener('click', (e) => {
      const b = e.target.closest('[data-step]');
      if (b) go(b.dataset.step);
    });
    document.addEventListener('click', (e) => {
      const sx = e.target.closest('[data-sex]');
      if (sx) setSex(sx.dataset.sex);
      const op = e.target.closest('[data-open="calibration"]');
      if (op) openCalibration();
      const cl = e.target.closest('[data-close]');
      if (cl) closeModal(cl.closest('.modal'));
    });
    $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const open = $$('.modal').find((m) => !m.hidden);
        if (open) { closeModal(open); return; }
      }
      if (state.screen === 'landmarks' && $$('.modal').every((m) => m.hidden)) editor.handleKey(e);
    });
    document.addEventListener('keyup', (e) => { if (state.screen === 'landmarks') editor.handleKey(e); });
    let rt = null;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { if (last && state.screen === 'results') M.results.redrawAnnotations($('#results-root'), { ...last, images, landmarks: state.landmarks }); }, 150);
    });
  }

  async function init() {
    restore();
    for (const v of VIEWS) {
      if (state.photos[v]) {
        try { images[v] = await M.capture.loadImage(state.photos[v].src); }
        catch (e) { state.photos[v] = null; state.landmarks[v] = {}; }
      }
    }
    M.capture.initCamera();
    initCalibration();
    initCapture();
    initLandmarks();
    initGlobal();
    VIEWS.forEach(renderCaptureCard);

    let screen = state.screen;
    if (screen === 'results') {
      if (bothPhotos() && complete()) {
        computeAll();
        state.screen = 'results';
        $$('.screen').forEach((s) => { s.hidden = s.id !== 'screen-results'; });
        renderResults(false);
        updateNav();
      } else go(bothPhotos() ? 'landmarks' : 'capture');
    } else go(screen === 'landmarks' && !bothPhotos() ? 'capture' : screen);

    if (!state.calibrated) openCalibration();
  }

  M.app = { state, go };
  document.addEventListener('DOMContentLoaded', init);
})(window.MOG = window.MOG || {});
