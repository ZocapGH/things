/* Reaktion-Diffusion (Gray-Scott) – zwei Chemikalien, die sich ausbreiten und reagieren,
   erzeugen Turing-Muster wie Korallen, Zellteilung und Labyrinthe. */
(function () {
  'use strict';
  const PRESETS = [
    ['korallen', 'Korallen', 0.0545, 0.062], ['zellteilung', 'Zellteilung', 0.0367, 0.0649],
    ['labyrinth', 'Labyrinth', 0.029, 0.057], ['punkte', 'Punkte', 0.03, 0.062], ['wuermer', 'Würmer', 0.078, 0.061],
    ['loecher', 'Löcher', 0.039, 0.058], ['chaos', 'Chaos', 0.026, 0.051],
  ];
  const PALS = {
    tiefsee: [[0, [6, 10, 26]], [0.35, [12, 80, 120]], [0.65, [90, 220, 200]], [1, [250, 255, 245]]],
    lava: [[0, [10, 2, 2]], [0.4, [150, 20, 10]], [0.75, [255, 140, 20]], [1, [255, 245, 200]]],
    tinte: [[0, [244, 240, 230]], [0.5, [120, 116, 110]], [1, [10, 10, 14]]],
    gift: [[0, [4, 8, 4]], [0.5, [40, 160, 40]], [1, [220, 255, 120]]],
  };
  function lutFor(name) {
    const s = PALS[name], lut = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let j = 0;
      while (j < s.length - 2 && t > s[j + 1][0]) j++;
      const [t0, a] = s[j], [t1, b] = s[j + 1], f = (t - t0) / (t1 - t0);
      for (let c = 0; c < 3; c++) lut[i * 3 + c] = a[c] + (b[c] - a[c]) * f;
    }
    return lut;
  }

  // Ein Zeitschritt (Torus-Rand); schreibt in nu/nv
  function stepRD(u, v, nu, nv, W, H, f, k) {
    for (let y = 0; y < H; y++) {
      const ym = ((y - 1 + H) % H) * W, y0 = y * W, yp = ((y + 1) % H) * W;
      for (let x = 0; x < W; x++) {
        const xm = x === 0 ? W - 1 : x - 1, xp = x === W - 1 ? 0 : x + 1, i = y0 + x;
        const uu = u[i], vv = v[i];
        const lu = 0.2 * (u[y0 + xm] + u[y0 + xp] + u[ym + x] + u[yp + x]) + 0.05 * (u[ym + xm] + u[ym + xp] + u[yp + xm] + u[yp + xp]) - uu;
        const lv = 0.2 * (v[y0 + xm] + v[y0 + xp] + v[ym + x] + v[yp + x]) + 0.05 * (v[ym + xm] + v[ym + xp] + v[yp + xm] + v[yp + xp]) - vv;
        const uvv = uu * vv * vv;
        nu[i] = uu + lu - uvv + f * (1 - uu);
        nv[i] = vv + 0.5 * lv + uvv - (k + f) * vv;
      }
    }
  }
  function seed(u, v, W, H, n, rnd) {
    u.fill(1); v.fill(0);
    for (let s = 0; s < n; s++) {
      const cx = (rnd() * W) | 0, cy = (rnd() * H) | 0, r = 2 + ((rnd() * 4) | 0);
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        const i = ((cy + y + H) % H) * W + ((cx + x + W) % W);
        u[i] = 0.5; v[i] = 0.25 + rnd() * 0.05;
      }
    }
  }
  function paint(img, v, W, H, lut) {
    const d = img.data;
    for (let i = 0, o = 0; i < W * H; i++, o += 4) {
      let t = v[i] * 3.2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const j = ((t * 255) | 0) * 3;
      d[o] = lut[j]; d[o + 1] = lut[j + 1]; d[o + 2] = lut[j + 2]; d[o + 3] = 255;
    }
  }

  Things.register({
    id: 'turing',
    name: 'Turing-Muster',
    desc: 'Reaktion & Diffusion: wie Leopardenflecken und Korallen entstehen.',

    thumb(c, w, h) {
      const W = 100, H = 62, n = W * H;
      let u = new Float32Array(n), v = new Float32Array(n), nu = new Float32Array(n), nv = new Float32Array(n);
      seed(u, v, W, H, 14, Things.rng(3));
      for (let s = 0; s < 1400; s++) { stepRD(u, v, nu, nv, W, H, 0.0545, 0.062); [u, nu] = [nu, u]; [v, nv] = [nv, v]; }
      const b = document.createElement('canvas'); b.width = W; b.height = H;
      const bc = b.getContext('2d'), img = bc.createImageData(W, H);
      paint(img, v, W, H, lutFor('tiefsee'));
      bc.putImageData(img, 0, 0);
      c.imageSmoothingEnabled = true;
      c.drawImage(b, 0, 0, w, h);
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage, { raw: true });
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { f: 0.0545, k: 0.062, steps: 10, cell: 3, pal: 'tiefsee', brush: 5, run: true };
      let W, H, u, v, nu, nv, img, lut = lutFor(st.pal), iter = 0;
      const buf = document.createElement('canvas'), bctx = buf.getContext('2d');

      function setup() {
        W = Math.max(16, Math.floor(S.w / st.cell)); H = Math.max(16, Math.floor(S.h / st.cell));
        const n = W * H;
        u = new Float32Array(n); v = new Float32Array(n); nu = new Float32Array(n); nv = new Float32Array(n);
        seed(u, v, W, H, Math.max(6, (n / 1800) | 0), Math.random);
        buf.width = W; buf.height = H;
        img = bctx.createImageData(W, H);
        iter = 0;
      }
      S.onresize = setup;

      let ptr = null;
      const stop = Things.loop(() => {
        if (ptr) {
          const cx = Math.floor(ptr.x / S.w * W), cy = Math.floor(ptr.y / S.h * H), r = st.brush;
          for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
            if (x * x + y * y > r * r) continue;
            const i = ((cy + y + H) % H) * W + ((cx + x + W) % W);
            u[i] = 0.5; v[i] = 0.25;
          }
        }
        if (st.run) {
          for (let s = 0; s < st.steps; s++) {
            stepRD(u, v, nu, nv, W, H, st.f, st.k);
            let t = u; u = nu; nu = t; t = v; v = nv; nv = t;
          }
          iter += st.steps;
        }
        paint(img, v, W, H, lut);
        bctx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(buf, 0, 0, S.cv.width, S.cv.height);
        hud.textContent = `f = ${st.f.toFixed(4)}   k = ${st.k.toFixed(4)}   Schritt ${iter}`;
      });

      Things.pointer(stage, {
        down(p) { ptr = p; },
        move(p) { if (p.down) ptr = p; },
        up() { ptr = null; },
      });

      let fS, kS;
      U.select(panel, 'Muster', PRESETS.map((p) => [p[0], p[1]]), 'korallen', (val) => {
        const p = PRESETS.find((x) => x[0] === val);
        st.f = p[2]; st.k = p[3]; fS.value = p[2]; kS.value = p[3];
      });
      const [runBtn] = U.buttons(panel, [
        ['Pause', () => { st.run = !st.run; runBtn.textContent = st.run ? 'Pause' : 'Weiter'; }, true],
        ['Neu säen', () => { seed(u, v, W, H, Math.max(6, (W * H / 1800) | 0), Math.random); iter = 0; }],
        ['Leeren', () => { u.fill(1); v.fill(0); iter = 0; }],
      ]);
      U.buttons(panel, [['Bild speichern', () => Things.saveCanvas(S.cv, `turing-${Date.now()}.png`)]]);
      U.heading(panel, 'Chemie');
      const f4 = (x) => x.toFixed(4).replace('.', ',');
      fS = U.slider(panel, 'Zufuhr f', { min: 0.01, max: 0.1, step: 0.0005, value: st.f, fmt: f4, onInput: (x) => (st.f = x) });
      kS = U.slider(panel, 'Abbau k', { min: 0.045, max: 0.07, step: 0.0005, value: st.k, fmt: f4, onInput: (x) => (st.k = x) });
      U.heading(panel, 'Darstellung');
      U.select(panel, 'Farben', [['tiefsee', 'Tiefsee'], ['lava', 'Lava'], ['tinte', 'Tinte'], ['gift', 'Gift']], st.pal, (x) => { st.pal = x; lut = lutFor(x); });
      U.slider(panel, 'Tempo', { min: 1, max: 40, step: 1, value: st.steps, fmt: (x) => x + ' Schritte/Bild', onInput: (x) => (st.steps = x) });
      U.slider(panel, 'Pinselgröße', { min: 1, max: 15, step: 1, value: st.brush, fmt: (x) => x, onInput: (x) => (st.brush = x) });
      U.slider(panel, 'Auflösung', { min: 2, max: 6, step: 1, value: st.cell, fmt: (x) => ['', '', 'fein', 'mittel', 'grob', 'sehr grob', 'minimal'][x],
        onChange: (x) => { st.cell = x; setup(); } });
      U.hint(panel, 'Male mit Finger oder Maus neue Keime. Stoff V frisst Stoff U und vermehrt sich dabei, U wird ' +
        'nachgeliefert (f), V zerfällt (k). Kleine Änderungen an f und k ergeben völlig andere Muster – Alan Turing ' +
        'hat 1952 so die Musterbildung in der Natur erklärt.');

      setup();
      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
