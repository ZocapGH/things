/* Things – Kern: Registry, Zufall, Canvas, Loop, Pointer, UI-Bausteine.
   Keine externen Bibliotheken – alles selbst geschrieben. */
(function () {
  'use strict';
  const Things = (window.Things = { list: [], frameMs: 0 });

  /** Ein "Ding" registrieren: { id, name, desc, thumb(ctx,w,h), create(stage,panel) -> {destroy} } */
  Things.register = (t) => Things.list.push(t);

  /* ---------- Zufall (mulberry32, reproduzierbar per Seed) ---------- */
  Things.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  Things.randomSeed = () => 1 + ((Math.random() * 999999) | 0);

  /* ---------- Farbe ---------- */
  Things.hsl = function (h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  };
  Things.hex = (s) => {
    s = s.replace('#', '');
    if (s.length === 3) s = s.split('').map((c) => c + c).join('');
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  /* ---------- Canvas, das seine Bühne füllt (HiDPI) ----------
     opts.raw: kein DPR-Transform (für Pixelarbeit), opts.maxDpr: Obergrenze */
  Things.canvas = function (stage, opts) {
    opts = opts || {};
    const cv = document.createElement('canvas');
    stage.appendChild(cv);
    const ctx = cv.getContext('2d');
    const s = { cv, ctx, w: 1, h: 1, dpr: 1, onresize: null };
    const maxDpr = opts.maxDpr || 2;
    function fit() {
      const r = stage.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      s.w = r.width; s.h = r.height; s.dpr = dpr;
      if (W === cv.width && H === cv.height) return;
      cv.width = W; cv.height = H;
      if (!opts.raw) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (s.onresize) s.onresize();
    }
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    fit();
    s.fit = fit;
    s.destroy = () => ro.disconnect();
    return s;
  };

  /* ---------- Animationsschleife: fn(dt Sekunden, t Sekunden) ---------- */
  Things.loop = function (fn) {
    let id = 0, last = performance.now(), alive = true;
    function frame(now) {
      if (!alive) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const t0 = performance.now();
      try { fn(dt, now / 1000); } catch (e) { console.error(e); }
      Things.frameMs = Things.frameMs * 0.9 + (performance.now() - t0) * 0.1; // Rechenzeit pro Bild (Diagnose)
      id = requestAnimationFrame(frame);
    }
    id = requestAnimationFrame(frame);
    return () => { alive = false; cancelAnimationFrame(id); };
  };

  /* ---------- Zeiger (Maus + Touch + Stift einheitlich) ----------
     h.down(p,e,pts) h.move(p,e,pts) h.up(p,e,pts) h.wheel(delta,p) ; p = {x,y,id,down} in CSS-Pixeln */
  Things.pointer = function (el, h) {
    const pts = new Map();
    const pos = (e) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, down: false };
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      const p = pos(e); p.down = true;
      pts.set(e.pointerId, p);
      if (h.down) h.down(p, e, pts);
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      const p = pos(e);
      p.down = pts.has(e.pointerId);
      if (p.down) pts.set(e.pointerId, p);
      if (h.move) h.move(p, e, pts);
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (h.up) h.up(pos(e), e, pts);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    if (h.wheel) el.addEventListener('wheel', (e) => { e.preventDefault(); h.wheel(e.deltaY, pos(e)); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  };

  /* ---------- UI-Bausteine für das Einstellungs-Panel ---------- */
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const UI = (Things.ui = {});
  UI.heading = (parent, text) => parent.appendChild(el('h4', null, text));
  UI.hint = (parent, text) => parent.appendChild(el('p', 'hint', text));
  UI.slider = (parent, label, o) => {
    const wrap = el('div', 'ctl'), lab = el('label'), val = el('b');
    lab.append(el('span', null, label), val);
    const inp = el('input');
    inp.type = 'range'; inp.min = o.min; inp.max = o.max; inp.step = o.step || 0.01; inp.value = o.value;
    const fmt = o.fmt || ((v) => String(+v.toFixed(2)).replace('.', ','));
    const upd = () => { val.textContent = fmt(+inp.value); };
    inp.addEventListener('input', () => { upd(); if (o.onInput) o.onInput(+inp.value); });
    if (o.onChange) inp.addEventListener('change', () => o.onChange(+inp.value));
    upd();
    wrap.append(lab, inp);
    parent.appendChild(wrap);
    return { get value() { return +inp.value; }, set value(v) { inp.value = v; upd(); } };
  };
  UI.select = (parent, label, options, value, onChange) => {
    const wrap = el('div', 'ctl'), lab = el('label');
    lab.append(el('span', null, label));
    const s = el('select');
    for (const [v, t] of options) { const o = el('option', null, t); o.value = v; s.appendChild(o); }
    s.value = value;
    s.addEventListener('change', () => onChange(s.value));
    wrap.append(lab, s);
    parent.appendChild(wrap);
    return s;
  };
  UI.toggle = (parent, label, value, onChange) => {
    const l = el('label', 'tog'), i = el('input');
    i.type = 'checkbox'; i.checked = !!value;
    i.addEventListener('change', () => onChange(i.checked));
    l.append(el('span', null, label), i);
    parent.appendChild(l);
    return i;
  };
  UI.buttons = (parent, defs) => {
    const row = el('div', 'btns');
    const out = defs.map(([label, fn, primary]) => {
      const b = el('button', 'btn' + (primary ? ' primary' : ''), label);
      b.addEventListener('click', fn);
      row.appendChild(b);
      return b;
    });
    parent.appendChild(row);
    return out;
  };
  UI.hud = (stage) => stage.appendChild(el('div', 'hud'));

  /* ---------- Bild speichern (Teilen-Dialog auf Mobilgeräten, sonst Download) ---------- */
  Things.saveCanvas = async function (cv, name) {
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    if (!blob) return;
    const file = new File([blob], name, { type: 'image/png' });
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
})();
