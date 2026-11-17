/* Fallender Sand – Pixel-Sandkasten: Sand, Wasser, Öl, Stein, Holz, Pflanzen, Feuer und Rauch. */
(function () {
  'use strict';
  const E = 0, SAND = 1, WATER = 2, STONE = 3, WOOD = 4, FIRE = 5, SMOKE = 6, OIL = 7, PLANT = 8;
  const MATS = [[SAND, 'Sand'], [WATER, 'Wasser'], [OIL, 'Öl'], [STONE, 'Stein'], [WOOD, 'Holz'], [PLANT, 'Pflanze'], [FIRE, 'Feuer'], [E, 'Radierer']];
  const DENS = [0, 3, 2, 9, 9, 0, 0, 1, 9];
  const SOLID = [false, false, false, true, true, false, false, false, true];
  const BG = [11, 11, 16];

  // Farbtabellen pro Material (Index: Schattierung bzw. Lebensdauer)
  const LUT = [];
  for (let t = 0; t <= 8; t++) {
    const l = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const v = i / 255 - 0.5;
      let c;
      switch (t) {
        case SAND: c = Things.hsl(42 + v * 8, 0.7, 0.62 + v * 0.12); break;
        case WATER: c = Things.hsl(212 + v * 6, 0.75, 0.5 + v * 0.06); break;
        case STONE: c = [118 + v * 40, 118 + v * 40, 126 + v * 40]; break;
        case WOOD: c = Things.hsl(26, 0.5, 0.28 + v * 0.08); break;
        case FIRE: { const f = i / 255; c = [255, 60 + 190 * f, 20 * f * f * 10]; break; }
        case SMOKE: { const f = Math.min(1, i / 120); c = [BG[0] + (75 - BG[0]) * f, BG[1] + (75 - BG[1]) * f, BG[2] + (82 - BG[2]) * f]; break; }
        case OIL: c = Things.hsl(32, 0.55, 0.2 + v * 0.06); break;
        case PLANT: c = Things.hsl(115 + v * 20, 0.6, 0.38 + v * 0.1); break;
        default: c = BG;
      }
      l[i * 3] = c[0]; l[i * 3 + 1] = c[1]; l[i * 3 + 2] = c[2];
    }
    LUT.push(l);
  }

  Things.register({
    id: 'sand',
    name: 'Sandkasten',
    desc: 'Sand, Wasser, Öl, Feuer – rieseln, fließen, brennen lassen.',

    thumb(c, w, h) {
      c.fillStyle = `rgb(${BG})`;
      c.fillRect(0, 0, w, h);
      const cs = 4, R = Things.rng(2);
      for (let x = 0; x < w; x += cs) {
        const sandTop = h * 0.45 + Math.cos((x / w - 0.62) * 5) * h * 0.22, waterTop = h * 0.62;
        for (let y = 0; y < h; y += cs) {
          let t = E;
          if (y > h - 14) t = STONE;
          else if (y > sandTop) t = SAND;
          else if (y > waterTop && x < w * 0.45) t = WATER;
          if (t === E) continue;
          const j = ((R() * 255) | 0) * 3, l = LUT[t];
          c.fillStyle = `rgb(${l[j]},${l[j + 1]},${l[j + 2]})`;
          c.fillRect(x, y, cs, cs);
        }
      }
      for (let i = 0; i < 160; i++) {
        const x = w * 0.62 + (R() - 0.5) * 6, y = R() * h * 0.3;
        const j = ((R() * 255) | 0) * 3;
        c.fillStyle = `rgb(${LUT[SAND][j]},${LUT[SAND][j + 1]},${LUT[SAND][j + 2]})`;
        c.fillRect(Math.round(x / cs) * cs, Math.round(y / cs) * cs, cs, cs);
      }
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage, { raw: true });
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { mat: SAND, brush: 4, cell: 4, run: true };
      let W, H, type, life, shade, clock, img, frame = 0;
      const buf = document.createElement('canvas'), bctx = buf.getContext('2d');

      function setup() {
        W = Math.max(20, Math.floor(S.w / st.cell)); H = Math.max(20, Math.floor(S.h / st.cell));
        const n = W * H;
        type = new Uint8Array(n); life = new Uint8Array(n); shade = new Uint8Array(n); clock = new Uint8Array(n);
        buf.width = W; buf.height = H;
        img = bctx.createImageData(W, H);
        // kleiner Startaufbau: Steinboden mit Mulde
        for (let x = 0; x < W; x++) {
          const top = H - 3 - Math.round(4 * Math.abs(Math.sin(x / W * Math.PI * 2)));
          for (let y = top; y < H; y++) set(y * W + x, STONE);
        }
      }
      S.onresize = setup;

      function set(i, t) {
        type[i] = t; shade[i] = (Math.random() * 255) | 0; clock[i] = frame;
        life[i] = t === FIRE ? 40 + Math.random() * 50 : t === SMOKE ? 50 + Math.random() * 50 : 0;
      }
      function swap(i, j) {
        let t = type[i]; type[i] = type[j]; type[j] = t;
        t = life[i]; life[i] = life[j]; life[j] = t;
        t = shade[i]; shade[i] = shade[j]; shade[j] = t;
        clock[i] = frame; clock[j] = frame;
      }
      const sinks = (t, d) => d === E || ((d === WATER || d === OIL || d === SMOKE) && DENS[d] < DENS[t]);

      function fall(i, x, y, t, liquid) {
        if (y + 1 < H) {
          const j = i + W;
          if (sinks(t, type[j])) { swap(i, j); return; }
          const d = Math.random() < 0.5 ? 1 : -1;
          if (x + d >= 0 && x + d < W && sinks(t, type[j + d])) { swap(i, j + d); return; }
          if (x - d >= 0 && x - d < W && sinks(t, type[j - d])) { swap(i, j - d); return; }
        }
        if (liquid) {
          const d = Math.random() < 0.5 ? 1 : -1;
          let k = i, xx = x;
          for (let s = 0; s < 4; s++) {
            xx += d;
            if (xx < 0 || xx >= W || type[k + d] !== E) break;
            k += d;
          }
          if (k !== i) swap(i, k);
        }
      }
      function fire(i, x, y) {
        for (let n = 0; n < 4; n++) {
          const xx = x + (n === 0 ? -1 : n === 1 ? 1 : 0), yy = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx, tt = type[j], r = Math.random();
          if (tt === WATER) {
            set(i, SMOKE);
            if (r < 0.5) set(j, SMOKE);
            return;
          }
          if ((tt === WOOD && r < 0.012) || (tt === OIL && r < 0.3) || (tt === PLANT && r < 0.08)) {
            set(j, FIRE);
            if (tt === WOOD) life[j] = 120 + Math.random() * 120;
          }
        }
        if (--life[i] === 0) { if (Math.random() < 0.4) set(i, SMOKE); else { type[i] = E; } return; }
        if (y > 0 && Math.random() < 0.3) {
          const dx = ((Math.random() * 3) | 0) - 1;
          if (x + dx >= 0 && x + dx < W && type[i - W + dx] === E) swap(i, i - W + dx);
        }
      }
      function smoke(i, x, y) {
        if (--life[i] === 0) { type[i] = E; return; }
        const dx = ((Math.random() * 3) | 0) - 1;
        if (y > 0 && x + dx >= 0 && x + dx < W && type[i - W + dx] === E && Math.random() < 0.7) swap(i, i - W + dx);
        else if (x + dx >= 0 && x + dx < W && type[i + dx] === E) swap(i, i + dx);
      }
      function plant(i, x, y) {
        if (Math.random() > 0.08) return;
        const n = (Math.random() * 4) | 0;
        const xx = x + (n === 0 ? -1 : n === 1 ? 1 : 0), yy = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) return;
        const j = yy * W + xx;
        if (type[j] === WATER && Math.random() < 0.4) set(j, PLANT);
      }
      function update() {
        frame = (frame + 1) & 255;
        for (let y = H - 1; y >= 0; y--) {
          const ltr = Math.random() < 0.5;
          for (let n = 0; n < W; n++) {
            const x = ltr ? n : W - 1 - n, i = y * W + x, t = type[i];
            if (t === E || t === STONE || t === WOOD || clock[i] === frame) continue;
            switch (t) {
              case SAND: fall(i, x, y, t, false); break;
              case WATER: case OIL: fall(i, x, y, t, true); break;
              case FIRE: fire(i, x, y); break;
              case SMOKE: smoke(i, x, y); break;
              case PLANT: plant(i, x, y); break;
            }
          }
        }
      }
      function render() {
        const d = img.data;
        for (let i = 0, o = 0; i < W * H; i++, o += 4) {
          const t = type[i];
          if (t === E) { d[o] = BG[0]; d[o + 1] = BG[1]; d[o + 2] = BG[2]; }
          else {
            const idx = t === FIRE ? Math.min(255, life[i] * 3) : t === SMOKE ? life[i] : shade[i];
            const l = LUT[t], j = idx * 3;
            d[o] = l[j]; d[o + 1] = l[j + 1]; d[o + 2] = l[j + 2];
          }
          d[o + 3] = 255;
        }
        bctx.putImageData(img, 0, 0);
        ctx.fillStyle = `rgb(${BG})`;
        ctx.fillRect(0, 0, S.cv.width, S.cv.height);
        ctx.imageSmoothingEnabled = false;
        const cs = st.cell * S.dpr;
        ctx.drawImage(buf, 0, S.cv.height - H * cs, W * cs, H * cs);
      }

      // Pinsel
      let ptr = null, lastCell = null;
      const cellOf = (p) => [Math.floor(p.x / st.cell), H - 1 - Math.floor((S.h - p.y) / st.cell)];
      function stamp(cx, cy) {
        const r = st.brush, m = st.mat;
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
          if (x * x + y * y > r * r) continue;
          const X = cx + x, Y = cy + y;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const i = Y * W + X;
          if (m === E) { type[i] = E; continue; }
          if (type[i] !== E) continue;
          if (SOLID[m] || Math.random() < (m === FIRE ? 0.5 : 0.25)) set(i, m);
        }
      }
      function brush() {
        if (!ptr) return;
        const c = cellOf(ptr);
        if (lastCell && SOLID[st.mat] || (lastCell && st.mat === E)) {
          const steps = Math.max(Math.abs(c[0] - lastCell[0]), Math.abs(c[1] - lastCell[1]));
          for (let s = 1; s <= steps; s++) stamp(Math.round(lastCell[0] + (c[0] - lastCell[0]) * s / steps), Math.round(lastCell[1] + (c[1] - lastCell[1]) * s / steps));
        }
        stamp(c[0], c[1]);
        lastCell = c;
      }
      Things.pointer(stage, {
        down(p) { ptr = p; lastCell = null; },
        move(p) { if (p.down) ptr = p; },
        up() { ptr = null; lastCell = null; },
      });

      const stop = Things.loop(() => {
        brush();
        if (st.run) update();
        render();
        hud.textContent = MATS.find((m) => m[0] === st.mat)[1] + (st.run ? '' : '   ⏸');
      });

      U.heading(panel, 'Material');
      const matBtns = U.buttons(panel, MATS.map(([m, name]) => [name, () => {
        st.mat = m;
        matBtns.forEach((b, k) => b.classList.toggle('on', MATS[k][0] === m));
      }]));
      matBtns[0].classList.add('on');
      U.slider(panel, 'Pinselgröße', { min: 0, max: 12, step: 1, value: st.brush, fmt: (x) => x + 1, onInput: (x) => (st.brush = x) });
      const [runBtn] = U.buttons(panel, [
        ['Pause', () => { st.run = !st.run; runBtn.textContent = st.run ? 'Pause' : 'Weiter'; }, true],
        ['Leeren', () => { type.fill(E); }],
      ]);
      U.slider(panel, 'Körnung', { min: 2, max: 8, step: 1, value: st.cell, fmt: (x) => x + ' px', onChange: (x) => { st.cell = x; setup(); } });
      U.hint(panel, 'Wähle ein Material und male. Sand sinkt in Wasser, Wasser sinkt unter Öl. Öl brennt sofort, Holz langsam, ' +
        'Wasser löscht Feuer. Pflanzen wachsen ins Wasser hinein – und brennen auch.');

      setup();
      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
