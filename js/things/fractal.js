/* Fraktal-Zoom – Mandelbrot- und Julia-Mengen mit weicher Färbung, progressivem Rendern,
   Pinch-/Mausrad-Zoom und fließenden Farben. */
(function () {
  'use strict';
  const STOPS = {
    klassik: [[0, [0, 7, 100]], [0.16, [32, 107, 203]], [0.42, [237, 255, 255]], [0.6425, [255, 170, 0]], [0.8575, [0, 2, 0]], [1, [0, 7, 100]]],
    feuer: [[0, [0, 0, 0]], [0.25, [130, 12, 0]], [0.5, [255, 115, 0]], [0.75, [255, 235, 140]], [1, [0, 0, 0]]],
    ozean: [[0, [2, 8, 30]], [0.3, [0, 90, 140]], [0.55, [80, 220, 210]], [0.75, [240, 255, 250]], [1, [2, 8, 30]]],
    mono: [[0, [0, 0, 0]], [0.5, [255, 255, 255]], [1, [0, 0, 0]]],
  };
  const PALS = [['klassik', 'Klassik'], ['feuer', 'Feuer'], ['ozean', 'Ozean'], ['regenbogen', 'Regenbogen'], ['mono', 'Schwarz/Weiß']];
  function makeLut(name) {
    const lut = new Uint8Array(1024 * 3);
    for (let i = 0; i < 1024; i++) {
      const t = i / 1024;
      let c;
      if (name === 'regenbogen') c = Things.hsl(t * 360, 0.85, 0.55);
      else {
        const s = STOPS[name];
        let j = 0;
        while (j < s.length - 2 && t > s[j + 1][0]) j++;
        const [t0, a] = s[j], [t1, b] = s[j + 1], f = (t - t0) / (t1 - t0);
        c = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
      }
      lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2];
    }
    return lut;
  }
  const JULIAS = [
    ['spirale', 'Spirale', -0.8, 0.156], ['kaninchen', 'Douady-Kaninchen', -0.123, 0.745], ['dendrit', 'Dendrit', 0, 1],
    ['marco', 'San Marco', -0.75, 0], ['galaxie', 'Galaxie', 0.285, 0.01], ['seepferd', 'Seepferdchen', -0.7269, 0.1889],
    ['blitz', 'Blitz', -0.4, 0.6],
  ];

  // Rückgabe: weicher Iterationswert (>= 0) oder -1 für "in der Menge"
  function iterate(julia, x0, y0, jr, ji, maxIt) {
    let zx, zy, cr, ci;
    if (!julia) {
      const xq = x0 - 0.25, q = xq * xq + y0 * y0;
      if (q * (q + xq) <= 0.25 * y0 * y0 || (x0 + 1) * (x0 + 1) + y0 * y0 <= 0.0625) return -1;
      zx = 0; zy = 0; cr = x0; ci = y0;
    } else { zx = x0; zy = y0; cr = jr; ci = ji; }
    let i = 0, x2 = zx * zx, y2 = zy * zy;
    for (; i < maxIt && x2 + y2 <= 256; i++) {
      zy = 2 * zx * zy + ci;
      zx = x2 - y2 + cr;
      x2 = zx * zx; y2 = zy * zy;
    }
    if (i >= maxIt) return -1;
    return i + 1 - Math.log(Math.log(x2 + y2) * 0.5) / Math.LN2;
  }

  Things.register({
    id: 'fraktal',
    name: 'Fraktal-Zoom',
    desc: 'Mandelbrot & Julia: zoomen, bis die Rechengenauigkeit aufgibt.',

    thumb(c) {
      const cv = c.canvas, W = cv.width, H = cv.height, img = c.createImageData(W, H), d = img.data;
      const lut = makeLut('klassik'), cx = -0.74364, cy = 0.13183, s = 0.006 / W;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = iterate(false, cx + (x - W / 2) * s, cy - (y - H / 2) * s, 0, 0, 500), o = (y * W + x) * 4;
        if (v < 0) { d[o] = d[o + 1] = d[o + 2] = 0; } else { const j = ((v * 12) | 0) % 1024 * 3; d[o] = lut[j]; d[o + 1] = lut[j + 1]; d[o + 2] = lut[j + 2]; }
        d[o + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage, { raw: true });
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { julia: false, cx: -0.6, cy: 0, zoom: 1, it: 250, pal: 'klassik', dens: 12, cycle: false, jr: -0.8, ji: 0.156, off: 0 };
      let lut = makeLut(st.pal), W = 0, H = 0, img = null, nu = null, row = 0, dirty = true, maxIt = 0, B = 6;

      function alloc() {
        W = S.cv.width; H = S.cv.height;
        img = ctx.createImageData(W, H);
        nu = new Float32Array(W * H);
        dirty = true;
      }
      S.onresize = alloc;
      alloc();

      const spd = () => 3 / (Math.min(W, H) * st.zoom); // Einheiten pro Gerätepixel
      const k = () => S.cv.width / S.w;                  // CSS -> Gerätepixel
      function setColor(d, o, v) {
        if (v < 0) { d[o] = d[o + 1] = d[o + 2] = 0; }
        else { const j = (((v * st.dens + st.off) | 0) & 1023) * 3; d[o] = lut[j]; d[o + 1] = lut[j + 1]; d[o + 2] = lut[j + 2]; }
        d[o + 3] = 255;
      }
      function coarse() {
        maxIt = Math.round(st.it * (1 + 0.3 * Math.log2(Math.max(1, st.zoom))));
        const s = spd(), d = img.data, tmp = [0, 0, 0, 0];
        for (let by = 0; by < H; by += B) {
          const wy = st.cy - (by + B / 2 - H / 2) * s, ye = Math.min(H, by + B);
          for (let bx = 0; bx < W; bx += B) {
            const v = iterate(st.julia, st.cx + (bx + B / 2 - W / 2) * s, wy, st.jr, st.ji, maxIt);
            setColor(tmp, 0, v);
            const xe = Math.min(W, bx + B);
            for (let y = by; y < ye; y++) for (let x = bx; x < xe; x++) {
              const i = y * W + x, o = i * 4;
              nu[i] = v; d[o] = tmp[0]; d[o + 1] = tmp[1]; d[o + 2] = tmp[2]; d[o + 3] = 255;
            }
          }
        }
        ctx.putImageData(img, 0, 0);
        row = 0;
      }
      function fine(budget) {
        const t0 = performance.now(), s = spd(), d = img.data, r0 = row;
        while (row < H && performance.now() - t0 < budget) {
          const wy = st.cy - (row + 0.5 - H / 2) * s;
          for (let x = 0; x < W; x++) {
            const i = row * W + x, v = iterate(st.julia, st.cx + (x + 0.5 - W / 2) * s, wy, st.jr, st.ji, maxIt);
            nu[i] = v; setColor(d, i * 4, v);
          }
          row++;
        }
        if (row > r0) ctx.putImageData(img, 0, 0, 0, r0, W, row - r0);
      }
      function recolor() {
        const d = img.data;
        for (let i = 0, n = W * H; i < n; i++) setColor(d, i * 4, nu[i]);
        ctx.putImageData(img, 0, 0);
      }
      const fmtZoom = (z) => (z < 1e4 ? z.toFixed(z < 10 ? 1 : 0) : z.toExponential(1)).replace('.', ',');

      const stop = Things.loop((dt) => {
        if (dirty) {
          dirty = false;
          const t0 = performance.now();
          coarse();
          const ms = performance.now() - t0;
          if (ms > 30 && B < 16) B++; else if (ms < 8 && B > 3) B--;
        } else if (row < H) fine(14);
        if (st.cycle) { st.off = (st.off + dt * 60) % 1024; recolor(); }
        hud.textContent = `Zoom ${fmtZoom(st.zoom)}×   Iterationen ${maxIt}` + (row < H ? `   ${Math.round(row / H * 100)} %` : '') +
          (st.zoom > 3e13 ? '\nGrenze der Rechengenauigkeit erreicht' : '');
      });

      // Ansicht verschieben / zoomen
      function panBy(dx, dy) {
        const s = spd() * k();
        st.cx -= dx * s; st.cy += dy * s; dirty = true;
      }
      function zoomAt(x, y, f) {
        const px = x * k(), py = y * k(), s = spd();
        const wx = st.cx + (px - W / 2) * s, wy = st.cy - (py - H / 2) * s;
        st.zoom = Math.max(0.3, Math.min(1e14, st.zoom * f));
        const s2 = spd();
        st.cx = wx - (px - W / 2) * s2; st.cy = wy + (py - H / 2) * s2;
        dirty = true;
      }
      const last = new Map();
      let pinchD = 0, pinchM = null, lastTap = 0, tapPos = null;
      const two = (m) => { const [a, b] = [...m.values()]; return [Math.hypot(a.x - b.x, a.y - b.y), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }]; };
      Things.pointer(stage, {
        down(p, e, m) {
          last.set(p.id, p);
          if (m.size === 1) {
            const now = performance.now();
            if (now - lastTap < 320 && tapPos && Math.hypot(p.x - tapPos.x, p.y - tapPos.y) < 30) { zoomAt(p.x, p.y, 3); lastTap = 0; }
            else { lastTap = now; tapPos = p; }
          } else if (m.size === 2) [pinchD, pinchM] = two(m);
        },
        move(p, e, m) {
          if (!p.down) return;
          if (m.size >= 2) {
            const [d, mid] = two(m);
            if (pinchD) { panBy(mid.x - pinchM.x, mid.y - pinchM.y); zoomAt(mid.x, mid.y, d / pinchD); }
            pinchD = d; pinchM = mid;
          } else {
            const l = last.get(p.id);
            if (l) panBy(p.x - l.x, p.y - l.y);
          }
          last.set(p.id, p);
        },
        up(p, e, m) { last.delete(p.id); if (m.size < 2) pinchD = 0; },
        wheel(dy, p) { zoomAt(p.x, p.y, Math.exp(-dy * 0.0015)); },
      });

      function reset() {
        st.zoom = 1; st.cx = st.julia ? 0 : -0.6; st.cy = 0; dirty = true;
      }
      let jSel, reS, imS;
      const setJulia = (on) => { st.julia = on; modeSel.value = on ? 'julia' : 'mandel'; reset(); };
      const modeSel = U.select(panel, 'Fraktal', [['mandel', 'Mandelbrot-Menge'], ['julia', 'Julia-Menge']], 'mandel', (v) => setJulia(v === 'julia'));
      U.buttons(panel, [
        ['Zurücksetzen', reset, true],
        ['Julia von hier', () => { st.jr = st.cx; st.ji = st.cy; reS.value = st.jr; imS.value = st.ji; setJulia(true); }],
        ['Bild speichern', () => Things.saveCanvas(S.cv, `fraktal-${Date.now()}.png`)],
      ]);
      U.heading(panel, 'Julia-Parameter c');
      jSel = U.select(panel, 'Vorlage', JULIAS.map((j) => [j[0], j[1]]), 'spirale', (v) => {
        const j = JULIAS.find((x) => x[0] === v);
        st.jr = j[2]; st.ji = j[3]; reS.value = j[2]; imS.value = j[3];
        setJulia(true);
      });
      const fmtC = (v) => v.toFixed(4).replace('.', ',');
      reS = U.slider(panel, 'Realteil', { min: -1.5, max: 1.5, step: 0.0001, value: st.jr, fmt: fmtC, onInput: (v) => { st.jr = v; if (st.julia) dirty = true; } });
      imS = U.slider(panel, 'Imaginärteil', { min: -1.5, max: 1.5, step: 0.0001, value: st.ji, fmt: fmtC, onInput: (v) => { st.ji = v; if (st.julia) dirty = true; } });
      U.heading(panel, 'Farben');
      U.select(panel, 'Palette', PALS, st.pal, (v) => { st.pal = v; lut = makeLut(v); recolor(); });
      U.slider(panel, 'Farbdichte', { min: 2, max: 60, step: 1, value: st.dens, fmt: (v) => v, onInput: (v) => { st.dens = v; recolor(); } });
      U.toggle(panel, 'Farben fließen', st.cycle, (v) => (st.cycle = v));
      U.slider(panel, 'Iterationen (Basis)', { min: 50, max: 2000, step: 50, value: st.it, fmt: (v) => v, onChange: (v) => { st.it = v; dirty = true; } });
      U.hint(panel, 'Ziehen verschiebt, Mausrad / zwei Finger / Doppeltipp zoomen. „Julia von hier“ macht aus dem ' +
        'Mittelpunkt der Mandelbrot-Ansicht eine Julia-Menge – jeder Punkt der Mandelbrot-Menge gehört zu einer eigenen Julia-Menge.');
      void jSel;
      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
