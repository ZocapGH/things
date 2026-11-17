/* Wellenwanne – 2D-Wellengleichung mit Quellen, Wänden und Doppelspalt. Zeigt Interferenz und Beugung. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const EDGE = 26; // absorbierender Randstreifen (Zellen)

  // Farbskala: negativ blau, null dunkel, positiv bernstein
  const WAVE = new Uint8Array(512 * 3), INT = new Uint8Array(256 * 3);
  for (let i = 0; i < 512; i++) {
    const v = i / 255.5 - 1, a = Math.min(1, Math.abs(v));
    const c = v < 0 ? [40, 120, 255] : [255, 190, 60], z = [8, 10, 18];
    for (let k = 0; k < 3; k++) WAVE[i * 3 + k] = z[k] + (c[k] - z[k]) * Math.pow(a, 0.8);
  }
  for (let i = 0; i < 256; i++) {
    const c = Things.hsl(190 - i * 0.4, 0.8, Math.min(0.92, i / 255 * 0.85 + 0.03));
    INT[i * 3] = c[0]; INT[i * 3 + 1] = c[1]; INT[i * 3 + 2] = c[2];
  }

  Things.register({
    id: 'wellen',
    name: 'Wellenwanne',
    desc: 'Interferenz, Beugung, Doppelspalt – Wellen zum Anfassen.',

    thumb(c) {
      const cv = c.canvas, W = cv.width, H = cv.height, img = c.createImageData(W, H), d = img.data;
      const k = TAU / (W / 18), x1 = W * 0.4, x2 = W * 0.6, y0 = H * 0.15;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const r1 = Math.hypot(x - x1, y - y0), r2 = Math.hypot(x - x2, y - y0);
        const v = (Math.sin(k * r1) / Math.sqrt(1 + r1 * 0.02) + Math.sin(k * r2) / Math.sqrt(1 + r2 * 0.02)) * 0.6;
        const j = Math.max(0, Math.min(511, ((v + 1) * 255.5) | 0)) * 3, o = (y * W + x) * 4;
        d[o] = WAVE[j]; d[o + 1] = WAVE[j + 1]; d[o + 2] = WAVE[j + 2]; d[o + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage, { raw: true });
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { period: 22, amp: 1, speed: 2, mode: 'quelle', view: 'welle', preset: 'zwei', cell: 3 };
      let W, H, u0, u1, I, wall, damp, img, sources = [], t = 0;
      const buf = document.createElement('canvas'), bctx = buf.getContext('2d');

      function setup() {
        W = Math.max(40, Math.floor(S.w / st.cell)); H = Math.max(40, Math.floor(S.h / st.cell));
        const n = W * H;
        u0 = new Float32Array(n); u1 = new Float32Array(n); I = new Float32Array(n);
        wall = new Uint8Array(n); damp = new Float32Array(n);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const d = Math.min(x, y, W - 1 - x, H - 1 - y);
          damp[y * W + x] = d < EDGE ? 1 - 0.3 * Math.pow((EDGE - d) / EDGE, 2.5) : 0.9996;
        }
        buf.width = W; buf.height = H;
        img = bctx.createImageData(W, H);
        preset(st.preset);
      }
      S.onresize = setup;

      function clearWaves() { u0.fill(0); u1.fill(0); I.fill(0); t = 0; }
      function addSource(x, y, ph) { sources.push({ x, y, i: y * W + x, ph: ph || 0 }); }
      function wallRect(x0, y0, x1, y1, v) {
        for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
          for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) wall[y * W + x] = v;
      }
      function preset(name) {
        st.preset = name;
        sources = []; wall.fill(0); clearWaves();
        const cx = W >> 1, cy = H >> 1, lam = st.period / 2;
        if (name === 'zwei') {
          const s = Math.round(lam * 1.6);
          addSource(cx - s, Math.round(H * 0.3)); addSource(cx + s, Math.round(H * 0.3));
        } else if (name === 'spalt' || name === 'einzel') {
          const portrait = H > W;
          const wx = portrait ? 0 : Math.round(W * 0.38), wy = portrait ? Math.round(H * 0.35) : 0;
          const gap = name === 'einzel' ? Math.round(lam * 1.4) : Math.max(2, Math.round(lam * 0.35));
          const sep = Math.round(lam * 2.2);
          if (!portrait) {
            wallRect(wx, 0, wx + 1, H - 1, 1);
            const slits = name === 'einzel' ? [cy] : [cy - sep, cy + sep];
            for (const sy of slits) wallRect(wx, sy - gap, wx + 1, sy + gap, 0);
            for (let y = EDGE; y < H - EDGE; y++) addSource(EDGE + 4, y);
          } else {
            wallRect(0, wy, W - 1, wy + 1, 1);
            const slits = name === 'einzel' ? [cx] : [cx - sep, cx + sep];
            for (const sx of slits) wallRect(sx - gap, wy, sx + gap, wy + 1, 0);
            for (let x = EDGE; x < W - EDGE; x++) addSource(x, EDGE + 4);
          }
        }
      }

      function step() {
        t++;
        const om = TAU / st.period, a = st.amp * Math.sin(om * t);
        for (const s of sources) u1[s.i] = a;
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
            if (wall[i]) { u0[i] = 0; continue; }
            const lap = u1[i - 1] + u1[i + 1] + u1[i - W] + u1[i + W] - 4 * u1[i];
            u0[i] = (2 * u1[i] - u0[i] + 0.25 * lap) * damp[i];
          }
        }
        const tmp = u0; u0 = u1; u1 = tmp;
      }
      function render() {
        const d = img.data, intens = st.view === 'intens';
        for (let i = 0, o = 0; i < W * H; i++, o += 4) {
          if (wall[i]) { d[o] = 170; d[o + 1] = 172; d[o + 2] = 185; }
          else if (intens) {
            const v = u1[i];
            I[i] = I[i] * 0.985 + v * v * 0.015;
            const j = Math.min(255, (Math.sqrt(I[i]) * 300) | 0) * 3;
            d[o] = INT[j]; d[o + 1] = INT[j + 1]; d[o + 2] = INT[j + 2];
          } else {
            let v = u1[i] * 1.2;
            v = v < -1 ? -1 : v > 1 ? 1 : v;
            const j = ((v + 1) * 255.5 | 0) * 3;
            d[o] = WAVE[j]; d[o + 1] = WAVE[j + 1]; d[o + 2] = WAVE[j + 2];
          }
          d[o + 3] = 255;
        }
        bctx.putImageData(img, 0, 0);
        ctx.fillStyle = '#08090f';
        ctx.fillRect(0, 0, S.cv.width, S.cv.height);
        ctx.imageSmoothingEnabled = true;
        const cs = st.cell * S.dpr;
        ctx.drawImage(buf, 0, 0, W * cs, H * cs);
        if (sources.length < 12) {
          ctx.fillStyle = '#fff';
          for (const s of sources) { ctx.beginPath(); ctx.arc((s.x + 0.5) * cs, (s.y + 0.5) * cs, 3 * S.dpr, 0, TAU); ctx.fill(); }
        }
      }

      // Interaktion
      let lastCell = null, wallVal = 1;
      const cellOf = (p) => [Math.floor(p.x / st.cell), Math.floor(p.y / st.cell)];
      function drop(cx, cy) {
        for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
          const X = cx + x, Y = cy + y;
          if (X < 1 || Y < 1 || X >= W - 1 || Y >= H - 1) continue;
          u1[Y * W + X] += 1.5 * Math.exp(-(x * x + y * y) / 5);
        }
      }
      function paintWall(a, b) {
        const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
        for (let s = 0; s <= n; s++) {
          const x = Math.round(a[0] + (b[0] - a[0]) * s / n), y = Math.round(a[1] + (b[1] - a[1]) * s / n);
          wallRect(x - 1, y - 1, x + 1, y + 1, wallVal);
        }
      }
      Things.pointer(stage, {
        down(p) {
          const c = cellOf(p);
          lastCell = c;
          if (st.mode === 'quelle') {
            const k = sources.findIndex((s) => Math.hypot(s.x - c[0], s.y - c[1]) < 6);
            if (k >= 0) sources.splice(k, 1);
            else if (c[0] > 0 && c[1] > 0 && c[0] < W - 1 && c[1] < H - 1) addSource(c[0], c[1]);
          } else if (st.mode === 'tropfen') drop(c[0], c[1]);
          else {
            const i = c[1] * W + c[0];
            wallVal = wall[i] ? 0 : 1;
            paintWall(c, c);
          }
        },
        move(p) {
          if (!p.down || !lastCell) return;
          const c = cellOf(p);
          if (st.mode === 'wand') paintWall(lastCell, c);
          else if (st.mode === 'tropfen' && Math.hypot(c[0] - lastCell[0], c[1] - lastCell[1]) > 4) drop(c[0], c[1]);
          else return;
          lastCell = c;
        },
        up() { lastCell = null; },
      });

      const stop = Things.loop(() => {
        for (let s = 0; s < st.speed; s++) step();
        render();
        hud.textContent = `Wellenlänge ${(st.period / 2 * st.cell).toFixed(0)} px   ${sources.length} Quelle${sources.length === 1 ? '' : 'n'}`;
      });

      U.select(panel, 'Versuch', [['zwei', 'Zwei Quellen'], ['spalt', 'Doppelspalt'], ['einzel', 'Einzelspalt'], ['leer', 'Leere Wanne']],
        st.preset, (v) => preset(v));
      U.select(panel, 'Finger macht …', [['quelle', 'Quelle setzen / entfernen'], ['tropfen', 'Tropfen'], ['wand', 'Wand malen / radieren']],
        st.mode, (v) => (st.mode = v));
      U.select(panel, 'Ansicht', [['welle', 'Welle (Momentaufnahme)'], ['intens', 'Intensität (Mittelwert)']], st.view, (v) => { st.view = v; I.fill(0); });
      U.buttons(panel, [['Wellen glätten', clearWaves, true], ['Alles leeren', () => preset('leer')]]);
      U.slider(panel, 'Frequenz', { min: 10, max: 60, step: 1, value: 70 - st.period, fmt: (v) => v,
        onInput: (v) => { st.period = 70 - v; } });
      U.slider(panel, 'Tempo', { min: 1, max: 6, step: 1, value: st.speed, fmt: (v) => v + '×', onInput: (v) => (st.speed = v) });
      U.hint(panel, 'Wo Wellenberg auf Wellenberg trifft, verstärken sie sich; wo Berg auf Tal trifft, löschen sie sich aus. ' +
        'In der Ansicht „Intensität“ werden die Streifen hinter dem Doppelspalt besonders deutlich – genau wie bei Licht.');

      setup();
      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
