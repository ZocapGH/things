/* Game of Life (und Verwandte) – zellulärer Automat auf einem Torus, mit Malen und Geisterspuren. */
(function () {
  'use strict';
  const RULES = [
    ['B3/S23', 'Conway (B3/S23)'], ['B36/S23', 'HighLife (B36/S23)'], ['B3678/S34678', 'Tag & Nacht'],
    ['B2/S', 'Samen (B2/S)'], ['B368/S245', 'Morley'], ['B3/S12345', 'Labyrinth'],
  ];
  const PATTERNS = {
    gun: ['Gleiterkanone', [
      '........................O...........',
      '......................O.O...........',
      '............OO......OO............OO',
      '...........O...O....OO............OO',
      'OO........O.....O...OO..............',
      'OO........O...O.OO....O.O...........',
      '..........O.....O.......O...........',
      '...........O...O....................',
      '............OO......................']],
    rpent: ['R-Pentomino', ['.OO', 'OO.', '.O.']],
    acorn: ['Eichel', ['.O.....', '...O...', 'OO..OOO']],
    glider: ['Gleiter', ['.O.', '..O', 'OOO']],
    lwss: ['Raumschiff', ['.O..O', 'O....', 'O...O', 'OOOO.']],
    pulsar: ['Pulsar', [
      '..OOO...OOO..', '.............', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O', '..OOO...OOO..',
      '.............', '..OOO...OOO..', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O', '.............',
      '..OOO...OOO..']],
  };
  function parseRule(s) {
    const m = /B(\d*)\/S(\d*)/.exec(s), B = new Uint8Array(9), Sv = new Uint8Array(9);
    for (const c of m[1]) B[+c] = 1;
    for (const c of m[2]) Sv[+c] = 1;
    return { B, S: Sv };
  }

  // Farbtabellen: Alter -> Farbe, Geist -> Farbe
  const AGE = new Uint8Array(256 * 3), GHOST = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = Math.min(1, i / 60);
    const c = Things.hsl(52 - t * 90, 0.95, 0.72 - t * 0.14);
    AGE[i * 3] = c[0]; AGE[i * 3 + 1] = c[1]; AGE[i * 3 + 2] = c[2];
    const g = i / 255;
    GHOST[i * 3] = 11 + 30 * g * g; GHOST[i * 3 + 1] = 11 + 25 * g * g; GHOST[i * 3 + 2] = 16 + 80 * g * g;
  }

  Things.register({
    id: 'life',
    name: 'Game of Life',
    desc: 'Zellen leben, sterben, wandern. Mal selbst Muster hinein.',

    thumb(c, w, h) {
      const cs = 5, cols = Math.ceil(w / cs), rows = Math.ceil(h / cs);
      let g = new Uint8Array(cols * rows);
      const R = Things.rng(11);
      for (let i = 0; i < g.length; i++) g[i] = R() < 0.3 ? 1 : 0;
      const rule = parseRule('B3/S23'), ghost = new Uint8Array(cols * rows);
      for (let k = 0; k < 30; k++) g = stepGrid(g, cols, rows, rule, ghost, null);
      c.fillStyle = '#0b0b10';
      c.fillRect(0, 0, w, h);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (g[i]) c.fillStyle = 'hsl(40,95%,65%)';
        else if (ghost[i]) { const j = ghost[i] * 3; c.fillStyle = `rgb(${GHOST[j]},${GHOST[j + 1]},${GHOST[j + 2]})`; }
        else continue;
        c.fillRect(x * cs, y * cs, cs - 1, cs - 1);
      }
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage, { raw: true });
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const P = { cell: 7, speed: 15, run: true, ghosts: true, rule: 'B3/S23', pattern: 'gun' };
      let rule = parseRule(P.rule), cols = 0, rows = 0, grid, age, ghost, gen = 0, pop = 0, acc = 0;
      const buf = document.createElement('canvas'), bctx = buf.getContext('2d');
      let img;

      function setup(keep) {
        const c = Math.max(8, Math.floor(S.w / P.cell)), r = Math.max(8, Math.floor(S.h / P.cell));
        const ng = new Uint8Array(c * r), na = new Uint8Array(c * r), nh = new Uint8Array(c * r);
        if (keep && grid) {
          const dx = ((c - cols) / 2) | 0, dy = ((r - rows) / 2) | 0;
          for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
            const X = x + dx, Y = y + dy;
            if (X < 0 || Y < 0 || X >= c || Y >= r) continue;
            ng[Y * c + X] = grid[y * cols + x]; na[Y * c + X] = age[y * cols + x]; nh[Y * c + X] = ghost[y * cols + x];
          }
        }
        cols = c; rows = r; grid = ng; age = na; ghost = nh;
        buf.width = cols; buf.height = rows;
        img = bctx.createImageData(cols, rows);
      }
      function randomize() {
        for (let i = 0; i < grid.length; i++) { grid[i] = Math.random() < 0.28 ? 1 : 0; age[i] = 0; ghost[i] = grid[i] ? 255 : 0; }
        gen = 0;
      }
      function clear() { grid.fill(0); age.fill(0); ghost.fill(0); gen = 0; }
      function place(key) {
        const rowsP = PATTERNS[key][1], ph = rowsP.length, pw = rowsP[0].length;
        const ox = ((cols - pw) / 2) | 0, oy = ((rows - ph) / 2) | 0;
        for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
          if (rowsP[y][x] !== 'O') continue;
          const X = (ox + x + cols) % cols, Y = (oy + y + rows) % rows;
          grid[Y * cols + X] = 1; age[Y * cols + X] = 0; ghost[Y * cols + X] = 255;
        }
      }
      function tick() { grid = stepGrid(grid, cols, rows, rule, ghost, age); gen++; }

      function draw() {
        const d = img.data;
        pop = 0;
        for (let i = 0, o = 0; i < grid.length; i++, o += 4) {
          let j;
          if (grid[i]) { pop++; j = age[i] * 3; d[o] = AGE[j]; d[o + 1] = AGE[j + 1]; d[o + 2] = AGE[j + 2]; }
          else { j = (P.ghosts ? ghost[i] : 0) * 3; d[o] = GHOST[j]; d[o + 1] = GHOST[j + 1]; d[o + 2] = GHOST[j + 2]; }
          d[o + 3] = 255;
        }
        bctx.putImageData(img, 0, 0);
        const cs = P.cell * S.dpr, W = cols * cs, H = rows * cs;
        ctx.fillStyle = '#0b0b10';
        ctx.fillRect(0, 0, S.cv.width, S.cv.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buf, (S.cv.width - W) / 2, (S.cv.height - H) / 2, W, H);
        hud.textContent = `Generation ${gen}   Lebend ${pop}` + (P.run ? '' : '   ⏸');
      }

      const stop = Things.loop((dt) => {
        if (P.run && !painting) {
          acc += dt * P.speed;
          let n = 0;
          while (acc >= 1 && n < 20) { tick(); acc -= 1; n++; }
          if (n === 20) acc = 0;
        }
        draw();
      });
      S.onresize = () => setup(true);

      // Malen: Zellen setzen oder (wenn man auf einer lebenden beginnt) löschen
      let painting = false, paintVal = 1, lastCell = null;
      const cellAt = (p) => {
        const cs = P.cell, offX = (S.w - cols * cs) / 2, offY = (S.h - rows * cs) / 2;
        return [Math.floor((p.x - offX) / cs), Math.floor((p.y - offY) / cs)];
      };
      const setCell = (x, y) => {
        if (x < 0 || y < 0 || x >= cols || y >= rows) return;
        const i = y * cols + x;
        grid[i] = paintVal; age[i] = 0; if (paintVal) ghost[i] = 255;
      };
      function line(a, b) {
        let [x0, y0] = a; const [x1, y1] = b;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (let n = 0; n < 5000; n++) {
          setCell(x0, y0);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      }
      Things.pointer(stage, {
        down(p) {
          const c = cellAt(p);
          painting = true;
          const inside = c[0] >= 0 && c[1] >= 0 && c[0] < cols && c[1] < rows;
          paintVal = inside && grid[c[1] * cols + c[0]] ? 0 : 1;
          setCell(c[0], c[1]);
          lastCell = c;
        },
        move(p) { if (!painting || !p.down) return; const c = cellAt(p); line(lastCell, c); lastCell = c; },
        up() { painting = false; lastCell = null; },
      });

      const [runBtn] = U.buttons(panel, [
        ['Pause', () => { P.run = !P.run; runBtn.textContent = P.run ? 'Pause' : 'Start'; }, true],
        ['Schritt', () => { tick(); }],
        ['Zufall', randomize],
        ['Leeren', clear],
      ]);
      U.slider(panel, 'Tempo', { min: 1, max: 120, step: 1, value: P.speed, fmt: (v) => v + ' Gen/s', onInput: (v) => (P.speed = v) });
      U.slider(panel, 'Zellgröße', { min: 2, max: 24, step: 1, value: P.cell, fmt: (v) => v + ' px',
        onChange: (v) => { P.cell = v; setup(true); } });
      U.heading(panel, 'Muster');
      U.select(panel, 'Muster', Object.entries(PATTERNS).map(([k, v]) => [k, v[1] ? v[0] : k]), P.pattern, (v) => (P.pattern = v));
      U.buttons(panel, [['In die Mitte setzen', () => place(P.pattern)]]);
      U.heading(panel, 'Regeln');
      U.select(panel, 'Regel', RULES, P.rule, (v) => { P.rule = v; rule = parseRule(v); });
      U.toggle(panel, 'Geisterspuren', P.ghosts, (v) => (P.ghosts = v));
      U.hint(panel, 'Male mit Finger oder Maus Zellen ins Feld – wer auf einer lebenden Zelle beginnt, radiert. ' +
        'Die Welt ist ein Torus: Was rechts rausläuft, kommt links wieder rein. Junge Zellen leuchten gelb, alte rot-violett.');

      setup(false);
      randomize();
      return { destroy() { stop(); S.destroy(); } };
    },
  });

  function stepGrid(cur, cols, rows, rule, ghost, age) {
    const nxt = new Uint8Array(cur.length), B = rule.B, Sv = rule.S;
    for (let y = 0; y < rows; y++) {
      const ym = ((y - 1 + rows) % rows) * cols, y0 = y * cols, yp = ((y + 1) % rows) * cols;
      for (let x = 0; x < cols; x++) {
        const xm = x === 0 ? cols - 1 : x - 1, xp = x === cols - 1 ? 0 : x + 1;
        const n = cur[ym + xm] + cur[ym + x] + cur[ym + xp] + cur[y0 + xm] + cur[y0 + xp] + cur[yp + xm] + cur[yp + x] + cur[yp + xp];
        const i = y0 + x, a = cur[i], v = a ? Sv[n] : B[n];
        nxt[i] = v;
        if (v) {
          ghost[i] = 255;
          if (age) age[i] = a ? Math.min(255, age[i] + 1) : 0;
        } else {
          ghost[i] = ghost[i] > 5 ? ghost[i] - 5 : 0;
        }
      }
    }
    return nxt;
  }
})();
