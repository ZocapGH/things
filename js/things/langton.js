/* Langtons Ameise (und Verwandte) – eine Ameise, zwei Regeln, und nach 10.000 Schritten Chaos baut sie plötzlich eine Autobahn. */
(function () {
  'use strict';
  const RULES = [
    ['RL', 'Klassisch (RL)'], ['LLRR', 'Symmetrisch (LLRR)'], ['LRRRRRLLR', 'Quadrat (LRRRRRLLR)'],
    ['RRLLLRLLLRRR', 'Dreieck (RRLLLRLLLRRR)'], ['LLRRRLRLRLLR', 'Verschlungene Autobahn'], ['RLR', 'Chaos (RLR)'],
  ];
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

  function palette(n) {
    const p = new Uint8Array(n * 3);
    p[0] = 11; p[1] = 11; p[2] = 16;
    for (let s = 1; s < n; s++) {
      const c = n === 2 ? [240, 236, 225] : Things.hsl(200 + (s - 1) / (n - 1) * 260, 0.75, 0.6);
      p[s * 3] = c[0]; p[s * 3 + 1] = c[1]; p[s * 3 + 2] = c[2];
    }
    return p;
  }
  function makeWorld(W, H, rule) {
    const turn = new Int8Array(rule.length);
    for (let i = 0; i < rule.length; i++) turn[i] = rule[i] === 'R' ? 1 : rule[i] === 'L' ? 3 : rule[i] === 'U' ? 2 : 0;
    return { W, H, grid: new Uint8Array(W * H), turn, n: rule.length, ants: [], steps: 0 };
  }
  function run(w, steps) {
    const { W, H, grid, turn, n } = w;
    for (const a of w.ants) {
      let x = a.x, y = a.y, d = a.d;
      for (let s = 0; s < steps; s++) {
        const i = y * W + x, c = grid[i];
        d = (d + turn[c]) & 3;
        grid[i] = c + 1 === n ? 0 : c + 1;
        x += DX[d]; y += DY[d];
        if (x < 0) x = W - 1; else if (x >= W) x = 0;
        if (y < 0) y = H - 1; else if (y >= H) y = 0;
      }
      a.x = x; a.y = y; a.d = d;
    }
    w.steps += steps;
  }

  Things.register({
    id: 'ameise',
    name: 'Langtons Ameise',
    desc: 'Eine Ameise, zwei Regeln – erst Chaos, dann baut sie eine Autobahn.',

    thumb(c, w, h) {
      const W = 120, H = 75, wd = makeWorld(W, H, 'RL');
      wd.ants.push({ x: 70, y: 45, d: 0 });
      run(wd, 11800);
      const pal = palette(2), b = document.createElement('canvas');
      b.width = W; b.height = H;
      const bc = b.getContext('2d'), img = bc.createImageData(W, H);
      for (let i = 0; i < W * H; i++) { const j = wd.grid[i] * 3; img.data.set([pal[j], pal[j + 1], pal[j + 2], 255], i * 4); }
      bc.putImageData(img, 0, 0);
      c.imageSmoothingEnabled = false;
      c.drawImage(b, 0, 0, w, h);
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage, { raw: true });
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { rule: 'RL', cell: 3, speed: 7, run: true };
      let w, pal, img;
      const buf = document.createElement('canvas'), bctx = buf.getContext('2d');

      function setup() {
        const W = Math.max(20, Math.floor(S.w / st.cell)), H = Math.max(20, Math.floor(S.h / st.cell));
        w = makeWorld(W, H, st.rule);
        w.ants.push({ x: W >> 1, y: H >> 1, d: 0 });
        pal = palette(st.rule.length);
        buf.width = W; buf.height = H;
        img = bctx.createImageData(W, H);
      }
      S.onresize = setup;

      const stop = Things.loop(() => {
        if (st.run) run(w, Math.round(Math.pow(10, st.speed / 4)));
        const d = img.data, g = w.grid;
        for (let i = 0, o = 0; i < g.length; i++, o += 4) {
          const j = g[i] * 3;
          d[o] = pal[j]; d[o + 1] = pal[j + 1]; d[o + 2] = pal[j + 2]; d[o + 3] = 255;
        }
        for (const a of w.ants) { const o = (a.y * w.W + a.x) * 4; d[o] = 255; d[o + 1] = 60; d[o + 2] = 80; }
        bctx.putImageData(img, 0, 0);
        ctx.fillStyle = '#0b0b10';
        ctx.fillRect(0, 0, S.cv.width, S.cv.height);
        ctx.imageSmoothingEnabled = false;
        const cs = st.cell * S.dpr;
        ctx.drawImage(buf, 0, 0, w.W * cs, w.H * cs);
        hud.textContent = `Schritt ${w.steps.toLocaleString('de-DE')}   ${w.ants.length} Ameise${w.ants.length > 1 ? 'n' : ''}`;
      });

      Things.pointer(stage, {
        down(p) {
          const x = Math.floor(p.x / st.cell), y = Math.floor(p.y / st.cell);
          if (x >= 0 && y >= 0 && x < w.W && y < w.H) w.ants.push({ x, y, d: (Math.random() * 4) | 0 });
        },
      });

      U.select(panel, 'Regel', RULES, st.rule, (v) => { st.rule = v; setup(); });
      const [runBtn] = U.buttons(panel, [
        ['Pause', () => { st.run = !st.run; runBtn.textContent = st.run ? 'Pause' : 'Weiter'; }, true],
        ['Neu', setup],
      ]);
      U.slider(panel, 'Tempo', { min: 0, max: 18, step: 1, value: st.speed, fmt: (v) => Math.round(Math.pow(10, v / 4)).toLocaleString('de-DE') + ' Schritte/Bild',
        onInput: (v) => (st.speed = v) });
      U.slider(panel, 'Zellgröße', { min: 1, max: 10, step: 1, value: st.cell, fmt: (v) => v + ' px', onChange: (v) => { st.cell = v; setup(); } });
      U.hint(panel, 'Die Ameise dreht auf einem hellen Feld nach rechts, auf einem dunklen nach links, färbt das Feld um und geht ' +
        'einen Schritt. Nach rund 10.000 Schritten scheinbarem Chaos baut sie plötzlich eine endlose „Autobahn“. ' +
        'Tippe, um weitere Ameisen auszusetzen. Bei mehrfarbigen Regeln steht jeder Buchstabe für eine Farbe.');

      setup();
      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
