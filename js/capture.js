/* Do I Mog or Dog — photo upload, normalization, camera capture and alignment guides */
(function (M) {
  'use strict';
  const MAX_DIM = 2000;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode image'));
      img.src = src;
    });
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  // Downscale to MAX_DIM and re-encode (browsers apply EXIF orientation when drawing).
  async function normalize(src) {
    const img = await loadImage(src);
    const w = img.naturalWidth, h = img.naturalHeight;
    const k = Math.min(1, MAX_DIM / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { src: c.toDataURL('image/jpeg', 0.92), w: c.width, h: c.height };
  }

  async function fromFile(file) {
    if (!file || !/^image\//.test(file.type)) throw new Error('Not an image file');
    return normalize(await fileToDataURL(file));
  }

  // ---------- Alignment guide overlay (viewBox 300×400, eye line at y=166) ----------
  const FRONTAL_SIL = 'M150 40 C215 40 250 85 250 150 C252 190 248 215 240 240 C228 280 195 312 150 318 C105 312 72 280 60 240 C52 215 48 190 50 150 C50 85 85 40 150 40 Z ' +
    'M50 160 C38 156 36 190 52 204 M250 160 C262 156 264 190 248 204 ' +
    'M112 300 C112 330 108 350 100 362 C70 372 34 380 6 400 M188 300 C188 330 192 350 200 362 C230 372 266 380 294 400';
  const PROFILE_SIL = 'M95 400 C95 360 90 330 80 300 C60 260 52 200 58 150 C66 85 110 45 165 45 C200 47 222 70 228 100 ' +
    'C232 120 233 135 230 148 C228 155 226 160 230 170 L255 215 C258 222 252 228 240 228 C242 238 244 245 240 252 ' +
    'C236 256 238 262 240 268 C236 276 230 280 232 288 C236 298 234 310 225 316 C205 325 180 325 165 330 C160 350 158 375 160 400 ' +
    'M112 158 C100 150 98 196 114 202';

  function guideSVG(view, facing) {
    const grid = [100, 200].map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="400"/>`).join('') +
      [133, 266].map((y) => `<line x1="-600" y1="${y}" x2="900" y2="${y}"/>`).join('');
    const flip = view === 'profile' && facing === 'left' ? ' transform="translate(300 0) scale(-1 1)"' : '';
    const fh = view === 'profile'
      ? `<line class="g-fh" x1="112" y1="170" x2="226" y2="168"/><text class="a" x="${facing === 'left' ? 40 : 232}" y="182">FH 0°</text>`
      : '';
    return `<svg class="guide-svg" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g class="g-grid">${grid}</g>
      <line class="g-center" x1="150" y1="-400" x2="150" y2="800"/>
      <line class="g-eye" x1="-600" y1="166" x2="900" y2="166"/>
      <text x="6" y="161">EYE LEVEL</text>
      <text class="c" x="154" y="14">CENTERLINE</text>
      <g${flip}><path class="g-sil" d="${view === 'frontal' ? FRONTAL_SIL : PROFILE_SIL}"/></g>
      ${fh}
    </svg>`;
  }

  // ---------- Camera ----------
  const cam = {
    stream: null, facingMode: 'user', timer: 0, view: 'frontal', guideFacing: 'right', onCapture: null, busy: false,
  };
  const el = (id) => document.getElementById(id);

  async function startStream() {
    stopStream();
    const err = el('cam-error');
    err.hidden = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      err.textContent = 'Camera API unavailable here. Serve the app over https or localhost, or use Upload.';
      err.hidden = false;
      return;
    }
    try {
      cam.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cam.facingMode, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
    } catch (e) {
      err.textContent = `Camera unavailable (${e.name || 'error'}). Grant camera permission or use Upload instead.`;
      err.hidden = false;
      return;
    }
    const video = el('cam-video');
    video.srcObject = cam.stream;
    el('cam-view').classList.toggle('mirror', cam.facingMode === 'user');
    video.onloadedmetadata = () => {
      if (video.videoWidth) el('cam-view').style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    };
    // Optical zoom, where the device exposes it.
    const track = cam.stream.getVideoTracks()[0];
    const caps = track && track.getCapabilities ? track.getCapabilities() : {};
    const wrap = el('cam-zoom-wrap');
    if (caps.zoom) {
      const z = el('cam-zoom');
      z.min = caps.zoom.min; z.max = caps.zoom.max; z.step = caps.zoom.step || 0.1;
      const target = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 2));
      z.value = target;
      applyZoom(target);
      wrap.hidden = false;
    } else wrap.hidden = true;
  }

  function applyZoom(v) {
    const track = cam.stream && cam.stream.getVideoTracks()[0];
    if (!track) return;
    track.applyConstraints({ advanced: [{ zoom: Number(v) }] }).catch(() => {});
    el('cam-zoom-val').textContent = Number(v).toFixed(1) + '×';
  }

  function stopStream() {
    if (cam.stream) cam.stream.getTracks().forEach((t) => t.stop());
    cam.stream = null;
  }

  function open(view, guideFacing, onCapture) {
    cam.view = view;
    cam.guideFacing = guideFacing;
    cam.onCapture = onCapture;
    el('cam-title').textContent = view === 'frontal' ? 'Frontal View' : 'Profile View (90°)';
    el('cam-overlay').innerHTML = guideSVG(view, guideFacing);
    el('cam-countdown').textContent = '';
    el('camera-modal').hidden = false;
    startStream();
  }

  function close() {
    cam.busy = false;
    stopStream();
    el('camera-modal').hidden = true;
  }

  async function shoot() {
    const video = el('cam-video');
    if (cam.busy || !cam.stream || !video.videoWidth) return;
    cam.busy = true;
    const cd = el('cam-countdown');
    for (let t = cam.timer; t > 0; t--) {
      cd.textContent = t;
      await new Promise((r) => setTimeout(r, 1000));
      if (!cam.busy) return;
    }
    cd.textContent = '';
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext('2d').drawImage(video, 0, 0);
    const data = await normalize(c.toDataURL('image/jpeg', 0.95));
    const cb = cam.onCapture;
    close();
    if (cb) cb(data);
  }

  function initCamera() {
    el('cam-shoot').addEventListener('click', shoot);
    el('cam-flip').addEventListener('click', () => {
      cam.facingMode = cam.facingMode === 'user' ? 'environment' : 'user';
      startStream();
    });
    el('cam-zoom').addEventListener('input', (e) => applyZoom(e.target.value));
    el('cam-timer').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      cam.timer = Number(b.dataset.t);
      el('cam-timer').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    });
    el('camera-modal').querySelector('[data-close]').addEventListener('click', close);
  }

  M.capture = { loadImage, normalize, fromFile, guideSVG, openCamera: open, closeCamera: close, initCamera };
})(window.MOG = window.MOG || {});
