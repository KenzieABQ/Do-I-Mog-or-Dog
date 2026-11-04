/* Do I Mog or Dog — interactive landmark editor with 2.5× sub-pixel loupe */
(function (M) {
  'use strict';
  const G = M.geo;
  const L = M.landmarks;
  const LOUPE_ZOOM = 2.5;

  class LandmarkEditor {
    constructor(opts) {
      this.stage = opts.stage;
      this.canvas = opts.canvas;
      this.loupe = opts.loupe;
      this.listEl = opts.list;
      this.currentEl = opts.current;
      this.hud = opts.hud;
      this.onChange = opts.onChange || (() => {});
      this.getFacing = opts.getFacing || (() => 'right');
      this.ctx = this.canvas.getContext('2d');
      this.lctx = this.loupe.getContext('2d');

      this.view = null; this.img = null; this.defs = []; this.points = {}; this.conns = [];
      this.selected = null; this.hoverId = null; this.mode = 'place';
      this.scale = 1; this.fitScale = 1; this.zoom = 1; this.ox = 0; this.oy = 0;
      this.cw = 0; this.ch = 0; this.dpr = 1;
      this.action = null; this.pointers = new Map(); this.spaceDown = false;

      this._bind();
      new ResizeObserver(() => this.resize()).observe(this.stage);
    }

    // ---------- loading & view transform ----------
    load({ view, img, defs, points, conns }) {
      this.view = view; this.img = img; this.defs = defs; this.points = points; this.conns = conns;
      this.selected = this.nextUnplaced() || defs[0].id;
      this.action = null;
      this.hideLoupe();
      this.resize(true);
      this.renderPanel();
    }

    get W() { return this.img ? this.img.naturalWidth : 1; }
    get H() { return this.img ? this.img.naturalHeight : 1; }

    resize(refit) {
      const r = this.stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      this.dpr = window.devicePixelRatio || 1;
      this.cw = r.width; this.ch = r.height;
      this.canvas.width = Math.round(r.width * this.dpr);
      this.canvas.height = Math.round(r.height * this.dpr);
      if (this.img) {
        this.fitScale = Math.min(this.cw / this.W, this.ch / this.H) * 0.96;
        if (refit || this.zoom <= 1.001) this.fit();
        else { this.scale = this.fitScale * this.zoom; this.clampPan(); }
      }
      this.render();
    }

    fit() {
      this.zoom = 1;
      this.scale = this.fitScale;
      this.ox = (this.cw - this.W * this.scale) / 2;
      this.oy = (this.ch - this.H * this.scale) / 2;
      this.render();
    }

    zoomAt(sp, factor) {
      const ns = G.clamp(this.scale * factor, this.fitScale * 0.8, this.fitScale * 16);
      this.ox = sp.x - (sp.x - this.ox) * (ns / this.scale);
      this.oy = sp.y - (sp.y - this.oy) * (ns / this.scale);
      this.scale = ns;
      this.zoom = ns / this.fitScale;
      this.clampPan();
      this.render();
    }

    clampPan() {
      const w = this.W * this.scale, h = this.H * this.scale, m = 60;
      this.ox = w <= this.cw ? (this.cw - w) / 2 : G.clamp(this.ox, this.cw - w - m, m);
      this.oy = h <= this.ch ? (this.ch - h) / 2 : G.clamp(this.oy, this.ch - h - m, m);
    }

    toImage(sp) { return { x: (sp.x - this.ox) / this.scale, y: (sp.y - this.oy) / this.scale }; }
    toScreen(p) { return { x: p.x * this.scale + this.ox, y: p.y * this.scale + this.oy }; }
    inImage(p) { return p.x >= 0 && p.y >= 0 && p.x <= this.W && p.y <= this.H; }
    clampImg(p) { return { x: G.clamp(p.x, 0, this.W), y: G.clamp(p.y, 0, this.H) }; }

    pos(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    hitTest(sp, touch) {
      const radius = touch ? 24 : 13;
      let best = null, bestD = radius;
      for (const d of this.defs) {
        const p = this.points[d.id];
        if (!p) continue;
        const dd = G.dist(this.toScreen(p), sp) - (d.id === this.selected ? 2 : 0);
        if (dd <= bestD) { best = d.id; bestD = dd; }
      }
      return best;
    }

    // ---------- selection & mutation ----------
    nextUnplaced(afterId) {
      const n = this.defs.length;
      const start = afterId ? this.defs.findIndex((d) => d.id === afterId) + 1 : 0;
      for (let i = 0; i < n; i++) {
        const d = this.defs[(start + i) % n];
        if (!this.points[d.id]) return d.id;
      }
      return null;
    }

    step(dir) {
      const i = this.defs.findIndex((d) => d.id === this.selected);
      const n = this.defs.length;
      this.select(this.defs[(i + dir + n) % n].id);
    }

    select(id) {
      this.selected = id;
      this.render();
      this.renderPanel();
      const row = this.listEl.querySelector(`[data-id="${id}"]`);
      if (row) row.scrollIntoView({ block: 'nearest' });
    }

    clearPoint(id = this.selected) {
      if (!this.points[id]) return;
      delete this.points[id];
      this.selected = id;
      this.commit();
    }

    clearAll() {
      for (const k of Object.keys(this.points)) delete this.points[k];
      this.selected = this.defs[0].id;
      this.commit();
    }

    seedTemplate() {
      const facing = this.getFacing();
      for (const d of this.defs) {
        if (!this.points[d.id]) this.points[d.id] = L.seed(this.view, d, this.W, this.H, facing);
      }
      this.commit();
    }

    nudge(dx, dy) {
      const p = this.points[this.selected];
      if (!p) return;
      this.points[this.selected] = this.clampImg({ x: p.x + dx, y: p.y + dy });
      this.commit(false);
      const sp = this.toScreen(this.points[this.selected]);
      this.showLoupe(this.points[this.selected], sp, false);
    }

    commit(full = true) {
      this.onChange(this.view);
      this.render();
      if (full) this.renderPanel(); else this.renderCurrent();
    }

    // ---------- input ----------
    _bind() {
      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => this._down(e));
      c.addEventListener('pointermove', (e) => this._move(e));
      c.addEventListener('pointerup', (e) => this._up(e));
      c.addEventListener('pointercancel', (e) => this._up(e));
      c.addEventListener('pointerleave', (e) => {
        if (!this.action && e.pointerType === 'mouse') { this.hideLoupe(); this.hoverId = null; this.render(); }
      });
      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.zoomAt(this.pos(e), Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
      }, { passive: false });
      c.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _startPan(sp) {
      this.action = { type: 'pan', s: sp, ox0: this.ox, oy0: this.oy };
      this.canvas.style.cursor = 'grabbing';
      this.hideLoupe();
    }

    _down(e) {
      if (!this.img) return;
      e.preventDefault();
      this.canvas.setPointerCapture(e.pointerId);
      const sp = this.pos(e);
      this.pointers.set(e.pointerId, sp);

      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        if (this.action && this.action.type === 'drag') this.onChange(this.view);
        this.action = { type: 'pinch', d0: G.dist(a, b) || 1, m0: G.mid(a, b), s0: this.scale, ox0: this.ox, oy0: this.oy };
        this.hideLoupe();
        return;
      }
      if (this.pointers.size > 2) return;

      const touch = e.pointerType !== 'mouse';
      const ip = this.toImage(sp);
      if (e.button === 1 || e.button === 2 || this.mode === 'pan' || this.spaceDown) { this._startPan(sp); return; }

      const hit = this.hitTest(sp, touch);
      if (hit) {
        if (hit !== this.selected) this.select(hit);
        const p = this.points[hit];
        this.action = { type: 'drag', id: hit, off: { x: p.x - ip.x, y: p.y - ip.y }, isNew: false, touch };
      } else if (this.selected && !this.points[this.selected] && this.inImage(ip)) {
        this.points[this.selected] = this.clampImg(ip);
        this.action = { type: 'drag', id: this.selected, off: { x: 0, y: 0 }, isNew: true, touch };
        this.renderCurrent();
      } else {
        this._startPan(sp);
        return;
      }
      this.render();
      this.showLoupe(this.points[this.action.id], sp, touch);
    }

    _move(e) {
      const sp = this.pos(e);
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, sp);
      const a = this.action;

      if (a && a.type === 'pinch') {
        if (this.pointers.size < 2) return;
        const [p1, p2] = [...this.pointers.values()];
        const m = G.mid(p1, p2);
        const ns = G.clamp(a.s0 * G.dist(p1, p2) / a.d0, this.fitScale * 0.8, this.fitScale * 16);
        const ix = (a.m0.x - a.ox0) / a.s0, iy = (a.m0.y - a.oy0) / a.s0;
        this.scale = ns; this.zoom = ns / this.fitScale;
        this.ox = m.x - ix * ns; this.oy = m.y - iy * ns;
        this.clampPan(); this.render();
        return;
      }
      if (a && a.type === 'drag') {
        const ip = this.toImage(sp);
        this.points[a.id] = this.clampImg({ x: ip.x + a.off.x, y: ip.y + a.off.y });
        this.render();
        this.renderCurrent();
        this.showLoupe(this.points[a.id], sp, a.touch);
        return;
      }
      if (a && a.type === 'pan') {
        this.ox = a.ox0 + sp.x - a.s.x;
        this.oy = a.oy0 + sp.y - a.s.y;
        this.clampPan(); this.render();
        return;
      }
      if (e.pointerType !== 'mouse' || !this.img) return;

      const hit = this.hitTest(sp, false);
      if (hit !== this.hoverId) { this.hoverId = hit; this.render(); }
      const ip = this.toImage(sp);
      const placing = this.mode === 'place' && !this.spaceDown && this.selected && !this.points[this.selected] && this.inImage(ip);
      this.canvas.style.cursor = this.mode === 'pan' || this.spaceDown ? 'grab' : hit ? 'move' : placing ? 'crosshair' : 'default';
      if (hit) this.showLoupe(this.points[hit], sp, false, hit);
      else if (placing) this.showLoupe(ip, sp, false);
      else this.hideLoupe();
    }

    _up(e) {
      this.pointers.delete(e.pointerId);
      const a = this.action;
      if (!a) return;
      if (a.type === 'pinch') {
        if (this.pointers.size === 0) this.action = null;
        return;
      }
      this.action = null;
      this.canvas.style.cursor = '';
      if (a.type === 'drag') {
        this.onChange(this.view);
        if (a.isNew) {
          const next = this.nextUnplaced(a.id);
          if (next) this.selected = next;
        }
        this.renderPanel();
      }
      if (e.pointerType !== 'mouse' || a.type === 'drag') this.hideLoupe();
      this.render();
    }

    handleKey(e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.type === 'keyup') {
        if (e.code === 'Space') { this.spaceDown = false; this.canvas.style.cursor = ''; }
        return;
      }
      const step = e.altKey ? 0.25 : e.shiftKey ? 10 : 1;
      const k = e.key;
      if (k === 'ArrowLeft') this.nudge(-step, 0);
      else if (k === 'ArrowRight') this.nudge(step, 0);
      else if (k === 'ArrowUp') this.nudge(0, -step);
      else if (k === 'ArrowDown') this.nudge(0, step);
      else if (k === ']' || k === 'n') this.step(1);
      else if (k === '[' || k === 'p') this.step(-1);
      else if (k === 'Delete' || k === 'Backspace') this.clearPoint();
      else if (k === '+' || k === '=') this.zoomAt({ x: this.cw / 2, y: this.ch / 2 }, 1.25);
      else if (k === '-' || k === '_') this.zoomAt({ x: this.cw / 2, y: this.ch / 2 }, 0.8);
      else if (k === '0') this.fit();
      else if (e.code === 'Space') { this.spaceDown = true; this.canvas.style.cursor = 'grab'; }
      else return;
      e.preventDefault();
    }

    setMode(mode) { this.mode = mode; this.hideLoupe(); }

    // ---------- rendering ----------
    render() {
      const { ctx, dpr, cw, ch } = this;
      if (!cw) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      if (!this.img) {
        ctx.fillStyle = '#5c5c6b';
        ctx.font = '500 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('No photo loaded for this view', cw / 2, ch / 2);
        return;
      }
      ctx.save();
      ctx.translate(this.ox, this.oy);
      ctx.scale(this.scale, this.scale);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.img, 0, 0);
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,240,255,.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.ox - 0.5, this.oy - 0.5, this.W * this.scale + 1, this.H * this.scale + 1);

      // guide connections
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(0,240,255,.55)';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (const [a, b] of this.conns) {
        const p = this.points[a], q = this.points[b];
        if (!p || !q) continue;
        const s1 = this.toScreen(p), s2 = this.toScreen(q);
        ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // nodes (selected drawn last)
      const order = this.defs.filter((d) => d.id !== this.selected);
      const sel = this.defs.find((d) => d.id === this.selected);
      if (sel) order.push(sel);
      for (const d of order) {
        const p = this.points[d.id];
        if (p) this._node(ctx, this.toScreen(p), d, d.id === this.selected, d.id === this.hoverId);
      }

      const placed = this.defs.filter((d) => this.points[d.id]).length;
      this.hud.textContent = `${this.view.toUpperCase()} · ${placed}/${this.defs.length} nodes · ${(this.scale * 100).toFixed(0)}% · ${this.W}×${this.H}px`;
    }

    _node(ctx, s, d, sel, hov) {
      const col = L.color(d.group);
      const r = sel ? 8 : hov ? 7 : 5.5;
      ctx.save();
      if (sel) { ctx.shadowColor = col; ctx.shadowBlur = 14; }
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(5,5,8,.35)';
      ctx.fill();
      ctx.lineWidth = sel ? 2 : 1.5;
      ctx.strokeStyle = col;
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      if (sel) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          ctx.moveTo(s.x + dx * (r + 3), s.y + dy * (r + 3));
          ctx.lineTo(s.x + dx * (r + 9), s.y + dy * (r + 9));
        }
        ctx.stroke();
      }
      if (sel || hov) {
        ctx.font = '600 11px "JetBrains Mono", monospace';
        const label = d.abbr;
        const w = ctx.measureText(label).width + 10;
        const lx = s.x + r + 8, ly = s.y - r - 20;
        ctx.fillStyle = 'rgba(10,10,12,.88)';
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(lx, ly, w, 18, 5) : ctx.rect(lx, ly, w, 18);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.textAlign = 'left';
        ctx.fillText(label, lx + 5, ly + 13);
      }
    }

    showLoupe(c, sp, touch, idOverride) {
      if (!this.img || !c) return;
      const size = touch ? 150 : 170;
      const dpr = this.dpr;
      const L2 = this.loupe;
      if (L2.width !== Math.round(size * dpr)) {
        L2.width = Math.round(size * dpr);
        L2.height = Math.round(size * dpr);
        L2.style.width = size + 'px';
        L2.style.height = size + 'px';
      }
      let lx = sp.x + 26, ly = sp.y - size - 26;
      if (touch) { lx = sp.x - size / 2; ly = sp.y - size - 64; }
      if (lx + size > this.cw - 6) lx = touch ? this.cw - size - 6 : sp.x - size - 26;
      if (lx < 6) lx = 6;
      if (ly < 6) ly = touch ? sp.y + 64 : sp.y + 26;
      L2.style.transform = `translate(${lx}px, ${ly}px)`;
      L2.classList.add('on');

      const ctx = this.lctx;
      const mag = this.scale * LOUPE_ZOOM;
      const half = size / 2;
      const activeId = idOverride || (this.action && this.action.id) || this.selected;
      const def = this.defs.find((d) => d.id === activeId);
      const col = def ? L.color(def.group) : '#00F0FF';

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(half, half, half - 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#050507';
      ctx.fillRect(0, 0, size, size);
      ctx.save();
      ctx.translate(half, half);
      ctx.scale(mag, mag);
      ctx.translate(-c.x, -c.y);
      ctx.imageSmoothingEnabled = mag < 6;
      ctx.drawImage(this.img, 0, 0);
      ctx.restore();

      // neighbouring nodes
      for (const d of this.defs) {
        const p = this.points[d.id];
        if (!p || d.id === activeId) continue;
        const x = (p.x - c.x) * mag + half, y = (p.y - c.y) * mag + half;
        if (x < -10 || y < -10 || x > size + 10 || y > size + 10) continue;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.strokeStyle = L.color(d.group);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // crosshair
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, half); ctx.lineTo(half - 7, half);
      ctx.moveTo(half + 7, half); ctx.lineTo(size, half);
      ctx.moveTo(half, 0); ctx.lineTo(half, half - 7);
      ctx.moveTo(half, half + 7); ctx.lineTo(half, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(half, half, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();

      // readout
      ctx.fillStyle = 'rgba(5,5,8,.82)';
      ctx.fillRect(0, size - 30, size, 30);
      ctx.fillStyle = '#E9E9F1';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${c.x.toFixed(2)}, ${c.y.toFixed(2)}`, half, size - 13);
      ctx.fillStyle = col;
      ctx.fillText(`${def ? def.abbr : ''} · ${LOUPE_ZOOM}×`, half, 18);
      ctx.restore();
    }

    hideLoupe() { this.loupe.classList.remove('on'); }

    // ---------- side panel ----------
    renderPanel() {
      const groups = [];
      for (const d of this.defs) {
        let g = groups.find((x) => x.name === d.group);
        if (!g) groups.push(g = { name: d.group, items: [] });
        g.items.push(d);
      }
      this.listEl.innerHTML = groups.map((g) => `
        <div class="lm-group-h">${g.name}</div>
        ${g.items.map((d) => `
          <button class="lm-row${this.points[d.id] ? ' placed' : ''}${d.id === this.selected ? ' sel' : ''}" data-id="${d.id}" style="--c:${L.color(d.group)}">
            <span class="dot"></span><span class="ab">${d.abbr}</span><span class="nm">${d.name}</span>${d.extra ? '<span class="extra" title="Extra node required by the mentolabial formula">+REQ</span>' : ''}
          </button>`).join('')}`).join('');
      this.renderCurrent();
    }

    renderCurrent() {
      const i = this.defs.findIndex((d) => d.id === this.selected);
      const d = this.defs[i];
      if (!d) { this.currentEl.innerHTML = ''; return; }
      const p = this.points[d.id];
      const placed = this.defs.filter((x) => this.points[x.id]).length;
      this.currentEl.innerHTML = `
        <div class="cur-idx">NODE ${String(i + 1).padStart(2, '0')} / ${this.defs.length} · ${placed} PLACED</div>
        <div class="cur-name" style="color:${L.color(d.group)}"><i></i><span style="color:var(--text)">${d.name}</span></div>
        <div class="cur-id">${d.id}</div>
        <div class="cur-desc">${d.desc}</div>
        <div class="cur-coord${p ? '' : ' pending'}">${p ? `x ${p.x.toFixed(2)} · y ${p.y.toFixed(2)} px` : '▸ Click the photo to place this node'}</div>
        <div class="cur-nav">
          <button class="btn ghost" data-act="prev">← Prev</button>
          <button class="btn ghost danger" data-act="clear" ${p ? '' : 'disabled'}>Re-place</button>
          <button class="btn ghost" data-act="next">Next →</button>
        </div>`;
    }

    bindPanel() {
      this.listEl.addEventListener('click', (e) => {
        const row = e.target.closest('.lm-row');
        if (row) this.select(row.dataset.id);
      });
      this.currentEl.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'prev') this.step(-1);
        else if (b.dataset.act === 'next') this.step(1);
        else if (b.dataset.act === 'clear') this.clearPoint();
      });
    }
  }

  M.LandmarkEditor = LandmarkEditor;
})(window.MOG = window.MOG || {});
