/* Op-Art-Generator – prozedurale Muster im Stil von Vasarely & Riley.
   Prinzip: Koordinaten werden verzerrt (Linsen, Wirbel, Wellen), dann wird ein periodisches
   Feld ausgewertet; das Vorzeichen entscheidet Hell/Dunkel. Kantenglättung über den Gradienten. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const STYLES = [
    ['zufall', 'Zufall'], ['schach', 'Schachbrett-Wölbung'], ['wellen', 'Wellenbänder'],
    ['ringe', 'Konzentrische Ringe'], ['spirale', 'Spirale'], ['moire', 'Moiré'],
    ['punkte', 'Punktraster'], ['strahlen', 'Strahlenkranz'], ['rauten', 'Rauten'],
  ];
  const NAMES = Object.fromEntries(STYLES);
  const PAL = [
    ['#0a0a0a', '#f4f1ea'], ['#10204a', '#f3efe2'], ['#1b1b1b', '#e63946'], ['#0d2b2b', '#2ec4b6'],
    ['#2b2d42', '#ffd166'], ['#3a0ca3', '#f72585'], ['#1d3557', '#a8dadc'], ['#3d1f0f', '#f4a259'],
    ['#14110f', '#d9c5b2'], ['#0b3d2e', '#e9f5db'],
  ];

  /* ---- Verzerrungen (mutieren p in place) ---- */
  function bulge(cx, cy, rad, k, ph) {
    const ir = 1 / (rad * rad);
    return (p, t) => {
      const X = cx + 0.08 * Math.sin(t * 0.7 + ph), Y = cy + 0.08 * Math.cos(t * 0.5 + ph);
      const dx = p.x - X, dy = p.y - Y;
      const f = 1 - k * Math.exp(-(dx * dx + dy * dy) * ir);
      p.x = X + dx * f; p.y = Y + dy * f;
    };
  }
  function twist(cx, cy, rad, k, ph) {
    const ir = 1 / (rad * rad);
    return (p, t) => {
      const dx = p.x - cx, dy = p.y - cy;
      const a = k * Math.exp(-(dx * dx + dy * dy) * ir) * (1 + 0.4 * Math.sin(t * 0.8 + ph));
      const c = Math.cos(a), s = Math.sin(a);
      p.x = cx + dx * c - dy * s; p.y = cy + dx * s + dy * c;
    };
  }
  function riley(A, f, fm, ph, ph2) {
    return (p, t) => { p.y += A * (0.55 + 0.45 * Math.sin(p.x * fm + ph2 + t * 0.3)) * Math.sin(p.x * f + ph + t); };
  }
  function softWave(A, f, ph, vertical) {
    return vertical
      ? (p, t) => { p.x += A * Math.sin(p.y * f + ph + t * 0.6); }
      : (p, t) => { p.y += A * Math.sin(p.x * f + ph + t * 0.6); };
  }

  /* ---- Generator aus Seed ---- */
  function makeGen(seed, style, K) {
    const R = Things.rng(seed);
    const r = (a, b) => a + (b - a) * R();
    const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const pick = (a) => a[Math.floor(R() * a.length)];
    if (style === 'zufall') style = pick(STYLES.slice(1).map((s) => s[0]));
    const warps = [];
    const F = r(9, 15) * (0.75 + K * 0.12);
    const nbRange = { schach: [1, K], punkte: [1, K], rauten: [1, K], ringe: [0, K - 1],
      wellen: [0, 1], spirale: [0, 1], moire: [0, 1], strahlen: [0, 1] }[style];
    const nb = ri(nbRange[0], Math.max(nbRange[0], nbRange[1]));
    for (let i = 0; i < nb; i++) {
      const k = r(0.35, 0.8) * (R() < 0.75 ? 1 : -0.8);
      warps.push(bulge(r(-0.9, 0.9), r(-0.6, 0.6), r(0.3, 0.85), k, r(0, TAU)));
    }
    if (style === 'strahlen' || R() < 0.1 * K) warps.push(twist(r(-0.4, 0.4), r(-0.3, 0.3), r(0.4, 1), r(-2.5, 2.5), r(0, TAU)));
    if (style === 'wellen') warps.push(riley(r(0.05, 0.13), r(4, 9), r(1.5, 4), r(0, TAU), r(0, TAU)));
    else if (R() < 0.08 * K) warps.push(softWave(r(0.03, 0.08), r(3, 8), r(0, TAU), R() < 0.5));

    let pat;
    switch (style) {
      case 'schach':
      case 'rauten': {
        const a = style === 'rauten' ? Math.PI / 4 : (R() < 0.6 ? 0 : r(0, Math.PI / 2));
        const c = Math.cos(a), s = Math.sin(a), G = style === 'rauten' ? F * 0.85 : F;
        pat = (x, y) => Math.sin(G * (x * c - y * s)) * Math.sin(G * (x * s + y * c));
        break;
      }
      case 'wellen': {
        const a = r(-0.15, 0.15), c = Math.cos(a), s = Math.sin(a), chirp = r(-3, 3), G = F * 1.5;
        pat = (x, y) => { const v = y * c - x * s; return Math.sin(G * v + chirp * v * v); };
        break;
      }
      case 'ringe': {
        const cx = r(-0.3, 0.3), cy = r(-0.2, 0.2);
        pat = (x, y, t) => Math.sin(F * Math.hypot(x - cx, y - cy) - t * 2);
        break;
      }
      case 'spirale': {
        const cx = r(-0.2, 0.2), cy = r(-0.2, 0.2), N = ri(2, 9) * (R() < 0.5 ? 1 : -1);
        pat = (x, y, t) => { const dx = x - cx, dy = y - cy; return Math.sin(F * Math.hypot(dx, dy) + N * Math.atan2(dy, dx) - t * 2); };
        break;
      }
      case 'moire': {
        if (R() < 0.5) {
          const d = r(0.08, 0.3), a = r(0, TAU), x1 = Math.cos(a) * d, y1 = Math.sin(a) * d;
          pat = (x, y, t) => Math.sin(F * Math.hypot(x - x1, y - y1) - t) * Math.sin(F * Math.hypot(x + x1, y + y1) - t);
        } else {
          const a = r(0.04, 0.2), c1 = Math.cos(a), s1 = Math.sin(a), G = F * 1.6;
          pat = (x, y, t) => Math.sin(G * y) * Math.sin(G * (y * c1 - x * s1) * (1 + 0.04 * Math.sin(t * 0.5)));
        }
        break;
      }
      case 'punkte': {
        const th = r(-0.35, 0.35), a = R() < 0.5 ? 0 : Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
        pat = (x, y) => (Math.cos(F * (x * c - y * s)) + Math.cos(F * (x * s + y * c))) * 0.5 - th;
        break;
      }
      case 'strahlen':
      default: {
        style = 'strahlen';
        const N = ri(8, 26) * 2, cx = r(-0.2, 0.2), cy = r(-0.2, 0.2), rings = R() < 0.55, G = F * 0.6;
        pat = (x, y, t) => {
          const dx = x - cx, dy = y - cy;
          const v = Math.sin(N * Math.atan2(dy, dx) + t * 0.5);
          return rings ? v * Math.sin(G * Math.hypot(dx, dy) - t) : v;
        };
      }
    }
    // gelegentlich XOR mit Ringen (Produkt zweier Felder)
    if ((style === 'schach' || style === 'wellen' || style === 'strahlen') && R() < 0.07 * K) {
      const base = pat, cx = r(-0.5, 0.5), cy = r(-0.4, 0.4), G = r(3, 7);
      pat = (x, y, t) => base(x, y, t) * Math.sin(G * Math.hypot(x - cx, y - cy));
    }
    return { warps, pat, style };
  }

  function makeColors(seed, mode) {
    const R = Things.rng(seed * 7 + 3);
    if (mode === 'sw') return { d: [8, 8, 8], l: [246, 244, 238] };
    if (mode === 'invers') return { d: [246, 244, 238], l: [8, 8, 8] };
    if (mode === 'duo') {
      const p = PAL[Math.floor(R() * PAL.length)];
      return { d: Things.hex(p[0]), l: Things.hex(p[1]) };
    }
    const h0 = R() * 360, span = 80 + R() * 200, lut = new Uint8Array(768);
    for (let i = 0; i < 256; i++) {
      const c = Things.hsl(h0 + span * i / 255, 0.85, 0.6);
      lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2];
    }
    return { d: Things.hsl(h0 + 200, 0.45, 0.07), lut, fx: 0.8 + R() * 2.2, fy: 0.8 + R() * 2.2, ph: R() * TAU };
  }

  let fieldBuf = null, idxBuf = null;
  function renderField(gen, col, W, H, t, img) {
    const N = W * H;
    if (!fieldBuf || fieldBuf.length < N) { fieldBuf = new Float32Array(N); idxBuf = new Uint8Array(N); }
    const f = fieldBuf, gi = idxBuf, ws = gen.warps, nw = ws.length, pat = gen.pat;
    const m = Math.min(W, H) / 2, p = { x: 0, y: 0 };
    const lut = col.lut, fx = col.fx, fy = col.fy, ph = col.ph + t * 0.4;
    let i = 0;
    for (let y = 0; y < H; y++) {
      const ny = (y + 0.5 - H / 2) / m;
      for (let x = 0; x < W; x++, i++) {
        p.x = (x + 0.5 - W / 2) / m; p.y = ny;
        for (let k = 0; k < nw; k++) ws[k](p, t);
        f[i] = pat(p.x, p.y, t);
        if (lut) gi[i] = (127.5 + 127 * Math.sin(p.x * fx + p.y * fy + ph)) | 0;
      }
    }
    // Kantenglättung: Abstand zur Nullstelle in Pixeln ≈ f / |∇f|
    const d = img.data, D = col.d, L = col.l;
    i = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++, i++) {
        const s = f[i];
        const xl = x > 0 ? f[i - 1] : s, xr = x < W - 1 ? f[i + 1] : s;
        const yu = y > 0 ? f[i - W] : s, yd = y < H - 1 ? f[i + W] : s;
        const gx = (xr - xl) * 0.5, gy = (yd - yu) * 0.5;
        let a = 0.5 + s / (Math.sqrt(gx * gx + gy * gy) + 1e-4);
        a = a < 0 ? 0 : a > 1 ? 1 : a;
        let lr, lg, lb;
        if (lut) { const j = gi[i] * 3; lr = lut[j]; lg = lut[j + 1]; lb = lut[j + 2]; }
        else { lr = L[0]; lg = L[1]; lb = L[2]; }
        const o = i * 4;
        d[o] = D[0] + (lr - D[0]) * a;
        d[o + 1] = D[1] + (lg - D[1]) * a;
        d[o + 2] = D[2] + (lb - D[2]) * a;
        d[o + 3] = 255;
      }
    }
  }

  Things.register({
    id: 'opart',
    name: 'Op-Art-Generator',
    desc: 'Prozedurale optische Täuschungen – jedes Bild ein Unikat.',

    thumb(c, w, h) {
      const cv = c.canvas, W = cv.width, H = cv.height;
      const img = c.createImageData(W, H);
      renderField(makeGen(48213, 'schach', 3), makeColors(1, 'sw'), W, H, 0, img);
      c.putImageData(img, 0, 0);
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage, { raw: true });
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { seed: Things.randomSeed(), style: 'zufall', color: 'sw', K: 3, anim: false, speed: 1, t: 0 };
      const buf = document.createElement('canvas'), bctx = buf.getContext('2d');
      let gen, col, img = null, pending = 0, budget = 160000;

      function renderAt(W, H) {
        if (buf.width !== W || buf.height !== H) { buf.width = W; buf.height = H; img = null; }
        if (!img) img = bctx.createImageData(W, H);
        renderField(gen, col, W, H, st.t, img);
        bctx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(buf, 0, 0, S.cv.width, S.cv.height);
      }
      function label() { return `${NAMES[gen.style]}  #${st.seed}`; }
      function full() {
        if (st.anim) return;
        clearTimeout(pending);
        hud.textContent = label() + '  …';
        pending = setTimeout(() => {
          const W = S.cv.width, H = S.cv.height;
          const f = Math.min(1, Math.sqrt(4.5e6 / (W * H)));
          const t0 = performance.now();
          renderAt(Math.max(1, Math.round(W * f)), Math.max(1, Math.round(H * f)));
          hud.textContent = `${label()}  ${Math.round(performance.now() - t0)} ms`;
        }, 20);
      }
      function regen(newSeed) {
        if (newSeed) st.seed = Things.randomSeed();
        gen = makeGen(st.seed, st.style, st.K);
        col = makeColors(st.seed, st.color);
        if (st.anim) hud.textContent = label(); else full();
      }

      const stop = Things.loop((dt) => {
        if (!st.anim) return;
        st.t += dt * st.speed;
        const W = S.cv.width, H = S.cv.height;
        const f = Math.min(1, Math.sqrt(budget / (W * H)));
        const t0 = performance.now();
        renderAt(Math.max(1, Math.round(W * f)), Math.max(1, Math.round(H * f)));
        const ms = performance.now() - t0;
        if (ms > 20) budget = Math.max(25000, budget * 0.85);
        else if (ms < 11) budget = Math.min(2.5e6, budget * 1.07);
      });
      S.onresize = () => full();

      let downAt = null;
      Things.pointer(stage, {
        down(p) { downAt = p; },
        up(p) {
          if (downAt && Math.hypot(p.x - downAt.x, p.y - downAt.y) < 12) regen(true);
          downAt = null;
        },
      });

      U.buttons(panel, [
        ['Neues Motiv', () => regen(true), true],
        ['Bild speichern', () => Things.saveCanvas(S.cv, `opart-${gen.style}-${st.seed}.png`)],
      ]);
      U.select(panel, 'Stil', STYLES, st.style, (v) => { st.style = v; regen(false); });
      U.select(panel, 'Farben', [['sw', 'Schwarz / Weiß'], ['invers', 'Weiß / Schwarz'], ['duo', 'Duoton'], ['bunt', 'Farbverlauf']],
        st.color, (v) => { st.color = v; regen(false); });
      U.slider(panel, 'Komplexität', { min: 1, max: 5, step: 1, value: st.K, fmt: (v) => v,
        onChange: (v) => { st.K = v; regen(false); } });
      U.heading(panel, 'Bewegung');
      U.toggle(panel, 'Animieren', st.anim, (v) => { st.anim = v; if (!v) full(); });
      U.slider(panel, 'Tempo', { min: 0.1, max: 3, value: st.speed, fmt: (v) => v.toFixed(1).replace('.', ',') + '×',
        onInput: (v) => (st.speed = v) });
      U.hint(panel, 'Tippe aufs Bild für ein neues Motiv. Beim Animieren wird mit reduzierter Auflösung gerechnet; ' +
        'zum Speichern in voller Schärfe die Animation ausschalten.');

      regen(false);
      return { destroy() { stop(); clearTimeout(pending); S.destroy(); } };
    },
  });
})();
