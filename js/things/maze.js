/* Labyrinth – sechs Erzeugungsalgorithmen animiert, Lösen per Breitensuche (Farbwelle) und selbst durchlaufen. */
(function () {
  'use strict';
  const N = 1, E = 2, Sd = 4, Wd = 8;
  const OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };
  const DIRS = [[N, 0, -1], [E, 1, 0], [Sd, 0, 1], [Wd, -1, 0]];
  const ALGOS = [
    ['dfs', 'Rekursives Zurückverfolgen'], ['prim', 'Prim (zufällig)'], ['kruskal', 'Kruskal'],
    ['wilson', 'Wilson (gleichverteilt)'], ['division', 'Rekursive Teilung'], ['binary', 'Binärbaum'],
  ];

  function makeMaze(C, R) {
    return { C, R, walls: new Uint8Array(C * R).fill(15), vis: new Uint8Array(C * R), cur: -1, walk: null };
  }
  function carve(M, a, b) {
    const ax = a % M.C, ay = (a / M.C) | 0, bx = b % M.C, by = (b / M.C) | 0;
    const d = bx > ax ? E : bx < ax ? Wd : by > ay ? Sd : N;
    M.walls[a] &= ~d; M.walls[b] &= ~OPP[d];
  }
  function nbrs(M, c) {
    const x = c % M.C, y = (c / M.C) | 0, out = [];
    for (const [d, dx, dy] of DIRS) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < M.C && Y < M.R) out.push([Y * M.C + X, d]);
    }
    return out;
  }
  const pick = (a) => a[(Math.random() * a.length) | 0];

  const GEN = {
    *dfs(M) {
      const start = (Math.random() * M.C * M.R) | 0, stack = [start];
      M.vis[start] = 1;
      while (stack.length) {
        const c = stack[stack.length - 1], un = nbrs(M, c).filter(([n]) => !M.vis[n]);
        if (!un.length) { stack.pop(); M.cur = stack.length ? stack[stack.length - 1] : -1; yield; continue; }
        const [nx] = pick(un);
        carve(M, c, nx); M.vis[nx] = 1; stack.push(nx); M.cur = nx;
        yield;
      }
    },
    *prim(M) {
      const total = M.C * M.R, inF = new Uint8Array(total), front = [];
      const s = (Math.random() * total) | 0;
      M.vis[s] = 1;
      const addF = (c) => { for (const [n] of nbrs(M, c)) if (!M.vis[n] && !inF[n]) { inF[n] = 1; front.push(n); } };
      addF(s);
      while (front.length) {
        const k = (Math.random() * front.length) | 0, f = front[k];
        front[k] = front[front.length - 1]; front.pop();
        const [v] = pick(nbrs(M, f).filter(([n]) => M.vis[n]));
        carve(M, f, v); M.vis[f] = 1; M.cur = f; addF(f);
        yield;
      }
    },
    *kruskal(M) {
      const total = M.C * M.R, parent = new Int32Array(total).map((_, i) => i), edges = [];
      const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
      for (let c = 0; c < total; c++) {
        if (c % M.C < M.C - 1) edges.push([c, c + 1]);
        if (c + M.C < total) edges.push([c, c + M.C]);
      }
      for (let i = edges.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [edges[i], edges[j]] = [edges[j], edges[i]]; }
      for (const [a, b] of edges) {
        const ra = find(a), rb = find(b);
        if (ra === rb) continue;
        parent[ra] = rb; carve(M, a, b); M.vis[a] = M.vis[b] = 1; M.cur = b;
        yield;
      }
    },
    *wilson(M) {
      const total = M.C * M.R, inT = M.vis, nextDir = new Int32Array(total);
      inT[(Math.random() * total) | 0] = 1;
      let remaining = total - 1;
      const cells = [];
      for (let i = 0; i < total; i++) cells.push(i);
      while (remaining > 0) {
        let start;
        do start = cells[(Math.random() * total) | 0]; while (inT[start]);
        // zufälliger Spaziergang mit Schleifenlöschung
        let c = start;
        M.walk = new Set([c]);
        while (!inT[c]) {
          const [n] = pick(nbrs(M, c));
          nextDir[c] = n; c = n; M.cur = c;
          M.walk.add(c);
          yield;
        }
        c = start;
        while (!inT[c]) { const n = nextDir[c]; carve(M, c, n); inT[c] = 1; remaining--; c = n; }
        M.walk = null;
        yield;
      }
    },
    *division(M) {
      M.walls.fill(0);
      for (let x = 0; x < M.C; x++) { M.walls[x] |= N; M.walls[(M.R - 1) * M.C + x] |= Sd; }
      for (let y = 0; y < M.R; y++) { M.walls[y * M.C] |= Wd; M.walls[y * M.C + M.C - 1] |= E; }
      M.vis.fill(1);
      const stack = [[0, 0, M.C, M.R]];
      while (stack.length) {
        const [x, y, w, h] = stack.pop();
        if (w < 2 || h < 2) continue;
        const horiz = h > w ? true : w > h ? false : Math.random() < 0.5;
        if (horiz) {
          const wy = y + ((Math.random() * (h - 1)) | 0), gap = x + ((Math.random() * w) | 0);
          for (let cx = x; cx < x + w; cx++) {
            if (cx === gap) continue;
            M.walls[wy * M.C + cx] |= Sd; M.walls[(wy + 1) * M.C + cx] |= N; M.cur = wy * M.C + cx;
            yield;
          }
          stack.push([x, y, w, wy - y + 1], [x, wy + 1, w, y + h - wy - 1]);
        } else {
          const wx = x + ((Math.random() * (w - 1)) | 0), gap = y + ((Math.random() * h) | 0);
          for (let cy = y; cy < y + h; cy++) {
            if (cy === gap) continue;
            M.walls[cy * M.C + wx] |= E; M.walls[cy * M.C + wx + 1] |= Wd; M.cur = cy * M.C + wx;
            yield;
          }
          stack.push([x, y, wx - x + 1, h], [wx + 1, y, x + w - wx - 1, h]);
        }
      }
    },
    *binary(M) {
      for (let y = 0; y < M.R; y++) for (let x = 0; x < M.C; x++) {
        const c = y * M.C + x, opts = [];
        if (y > 0) opts.push(c - M.C);
        if (x < M.C - 1) opts.push(c + 1);
        if (opts.length) carve(M, c, pick(opts));
        M.vis[c] = 1; M.cur = c;
        yield;
      }
    },
  };
  function finish(gen) { for (const _ of gen) { /* sofort fertig */ } }

  function drawMaze(c, M, ox, oy, cs, wallCol, lw) {
    c.strokeStyle = wallCol; c.lineWidth = lw; c.lineCap = 'square';
    c.beginPath();
    for (let y = 0; y < M.R; y++) for (let x = 0; x < M.C; x++) {
      const w = M.walls[y * M.C + x], X = ox + x * cs, Y = oy + y * cs;
      if (w & N) { c.moveTo(X, Y); c.lineTo(X + cs, Y); }
      if (w & Wd) { c.moveTo(X, Y); c.lineTo(X, Y + cs); }
      if (y === M.R - 1 && (w & Sd)) { c.moveTo(X, Y + cs); c.lineTo(X + cs, Y + cs); }
      if (x === M.C - 1 && (w & E)) { c.moveTo(X + cs, Y); c.lineTo(X + cs, Y + cs); }
    }
    c.stroke();
  }

  Things.register({
    id: 'labyrinth',
    name: 'Labyrinth',
    desc: 'Labyrinthe entstehen sehen, lösen lassen – oder selbst raus finden.',

    thumb(c, w, h) {
      c.fillStyle = '#0b0b10';
      c.fillRect(0, 0, w, h);
      const cs = 10, M = makeMaze(Math.floor((w - 10) / cs), Math.floor((h - 10) / cs)), ox = (w - M.C * cs) / 2, oy = (h - M.R * cs) / 2;
      finish(GEN.dfs(M));
      // Lösungsweg per BFS
      const total = M.C * M.R, dist = new Int32Array(total).fill(-1), par = new Int32Array(total), q = [0];
      dist[0] = 0;
      for (let qi = 0; qi < q.length; qi++) {
        const cc = q[qi];
        for (const [n, d] of nbrs(M, cc)) if (!(M.walls[cc] & d) && dist[n] < 0) { dist[n] = dist[cc] + 1; par[n] = cc; q.push(n); }
      }
      const maxD = dist[total - 1];
      for (let i = 0; i < total; i++) if (dist[i] >= 0 && dist[i] <= maxD) {
        c.fillStyle = `hsla(${dist[i] / maxD * 280},80%,45%,0.55)`;
        c.fillRect(ox + (i % M.C) * cs, oy + ((i / M.C) | 0) * cs, cs, cs);
      }
      drawMaze(c, M, ox, oy, cs, '#e8e8f0', 1.5);
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { algo: 'dfs', cell: 22, speed: 6 };
      let M, gen = null, L, phase = 'gen', solve = null, player = 0, trail = [], t0 = 0, won = 0, flash = 0;

      function layout() {
        const top = S.w < 700 ? 100 : Math.max(70, S.h * 0.09), side = 12;
        const C = Math.max(4, Math.floor((S.w - 2 * side) / st.cell)), R = Math.max(4, Math.floor((S.h - top - side) / st.cell));
        return { C, R, ox: (S.w - C * st.cell) / 2, oy: top + (S.h - top - side - R * st.cell) / 2, cs: st.cell };
      }
      function newMaze(instant) {
        L = layout();
        M = makeMaze(L.C, L.R);
        gen = GEN[st.algo](M);
        phase = 'gen'; solve = null; player = 0; trail = [0]; t0 = 0; won = 0;
        if (instant) { finish(gen); phase = 'play'; M.cur = -1; }
      }
      S.onresize = () => newMaze(true);

      function startSolve() {
        if (phase === 'gen') { finish(gen); M.cur = -1; }
        const total = M.C * M.R, dist = new Int32Array(total).fill(-1), par = new Int32Array(total).fill(-1);
        dist[player] = 0;
        solve = { dist, par, q: [player], qi: 0, path: null, maxD: 1 };
        phase = 'solve';
      }
      function solveStep(k) {
        const s = solve;
        for (let it = 0; it < k && s.qi < s.q.length; it++) {
          const c = s.q[s.qi++];
          if (c === M.C * M.R - 1) { s.qi = s.q.length; break; }
          for (const [nb, d] of nbrs(M, c)) {
            if (M.walls[c] & d || s.dist[nb] >= 0) continue;
            s.dist[nb] = s.dist[c] + 1; s.par[nb] = c; s.q.push(nb);
            if (s.dist[nb] > s.maxD) s.maxD = s.dist[nb];
          }
        }
        if (s.qi >= s.q.length && !s.path) {
          s.path = [];
          for (let c = M.C * M.R - 1; c !== -1; c = s.par[c]) s.path.push(c);
          phase = 'play';
        }
      }

      // Spielfigur bewegen
      function canGo(c, d) { return !(M.walls[c] & d); }
      function moveDir(di, slide) {
        if (phase === 'gen' || won) return;
        if (!t0) t0 = performance.now();
        const [d, dx, dy] = DIRS[di];
        let c = player, moved = false;
        while (canGo(c, d)) {
          c += dx + dy * M.C; moved = true;
          trail.push(c);
          if (!slide || c === M.C * M.R - 1) break;
          // an Abzweigungen anhalten
          let exits = 0;
          for (const [dd] of DIRS) if (dd !== OPP[d] && canGo(c, dd)) exits++;
          if (exits !== 1 || !canGo(c, d)) {
            if (exits === 1 && !canGo(c, d)) {
              // Kurve: weiter um die Ecke
              const nd = DIRS.findIndex(([dd]) => dd !== OPP[d] && canGo(c, dd));
              player = c; return moveDir(nd, true);
            }
            break;
          }
        }
        if (moved) player = c;
        if (player === M.C * M.R - 1) { won = (performance.now() - t0) / 1000; flash = 1; }
      }
      const KEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
      function onKey(e) {
        if (!(e.code in KEYS)) return;
        e.preventDefault();
        moveDir(KEYS[e.code], e.shiftKey);
      }
      window.addEventListener('keydown', onKey);
      let down = null;
      Things.pointer(stage, {
        down(p) { down = p; },
        up(p) {
          if (!down) return;
          const dx = p.x - down.x, dy = p.y - down.y;
          down = null;
          if (Math.hypot(dx, dy) < 18) return;
          moveDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0), true);
        },
      });

      const stop = Things.loop((dt) => {
        if (phase === 'gen') {
          const k = Math.max(1, Math.round(Math.pow(10, st.speed / 4) / 2));
          for (let i = 0; i < k; i++) if (gen.next().done) { phase = 'play'; M.cur = -1; M.walk = null; break; }
        } else if (phase === 'solve') solveStep(Math.max(3, Math.ceil(M.C * M.R / 100)));

        const { ox, oy, cs } = L;
        ctx.fillStyle = '#0b0b10';
        ctx.fillRect(0, 0, S.w, S.h);
        // besuchte Zellen / Lösungswelle
        if (solve) {
          for (let i = 0; i < M.C * M.R; i++) {
            const d = solve.dist[i];
            if (d < 0) continue;
            ctx.fillStyle = `hsla(${d / Math.max(1, solve.maxD) * 280},80%,45%,0.6)`;
            ctx.fillRect(ox + (i % M.C) * cs, oy + ((i / M.C) | 0) * cs, cs, cs);
          }
        } else if (phase === 'gen' && st.algo !== 'division') {
          ctx.fillStyle = '#1d2140';
          for (let i = 0; i < M.C * M.R; i++) if (M.vis[i]) ctx.fillRect(ox + (i % M.C) * cs, oy + ((i / M.C) | 0) * cs, cs, cs);
        }
        if (M.walk) {
          ctx.fillStyle = 'rgba(255,90,120,0.5)';
          for (const i of M.walk) ctx.fillRect(ox + (i % M.C) * cs, oy + ((i / M.C) | 0) * cs, cs, cs);
        }
        // Start & Ziel
        ctx.fillStyle = '#3ddc84';
        ctx.fillRect(ox + (M.C - 1) * cs + cs * 0.2, oy + (M.R - 1) * cs + cs * 0.2, cs * 0.6, cs * 0.6);
        drawMaze(ctx, M, ox, oy, cs, '#e8e8f0', Math.max(1.5, cs * 0.12));
        if (M.cur >= 0) {
          ctx.fillStyle = '#ffcc33';
          ctx.fillRect(ox + (M.cur % M.C) * cs + 1, oy + ((M.cur / M.C) | 0) * cs + 1, cs - 2, cs - 2);
        }
        // Lösungsweg
        const line = (cells, col, w) => {
          if (cells.length < 2) return;
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          ctx.beginPath();
          for (const i of cells) ctx.lineTo(ox + (i % M.C + 0.5) * cs, oy + (((i / M.C) | 0) + 0.5) * cs);
          ctx.stroke();
        };
        if (solve && solve.path) line(solve.path, '#ffcc33', Math.max(2, cs * 0.25));
        if (phase !== 'gen') {
          line(trail.slice(-4000), 'rgba(90,200,255,0.55)', Math.max(1.5, cs * 0.18));
          ctx.fillStyle = '#5ac8ff';
          ctx.beginPath();
          ctx.arc(ox + (player % M.C + 0.5) * cs, oy + (((player / M.C) | 0) + 0.5) * cs, cs * 0.32, 0, Math.PI * 2);
          ctx.fill();
        }
        if (flash > 0) {
          ctx.fillStyle = `rgba(61,220,132,${flash * 0.35})`;
          ctx.fillRect(0, 0, S.w, S.h);
          flash = Math.max(0, flash - dt);
        }
        const name = ALGOS.find((a) => a[0] === st.algo)[1];
        hud.textContent = phase === 'gen' ? `${name} …` : won ? `Geschafft in ${won.toFixed(1).replace('.', ',')} s – ${trail.length - 1} Schritte`
          : `${M.C} × ${M.R}   ${t0 ? ((performance.now() - t0) / 1000).toFixed(1).replace('.', ',') + ' s' : 'Wischen oder Pfeiltasten zum Laufen'}`;
      });

      U.select(panel, 'Algorithmus', ALGOS, st.algo, (v) => { st.algo = v; newMaze(false); });
      U.buttons(panel, [
        ['Neues Labyrinth', () => newMaze(false), true],
        ['Sofort', () => newMaze(true)],
        ['Lösen', startSolve],
      ]);
      U.slider(panel, 'Zellgröße', { min: 6, max: 60, step: 1, value: st.cell, fmt: (v) => v + ' px', onChange: (v) => { st.cell = v; newMaze(false); } });
      U.slider(panel, 'Bau-Tempo', { min: 0, max: 16, step: 1, value: st.speed, fmt: (v) => Math.max(1, Math.round(Math.pow(10, v / 4) / 2)) + ' Schritte/Bild',
        onInput: (v) => (st.speed = v) });
      U.buttons(panel, [['Bild speichern', () => Things.saveCanvas(S.cv, `labyrinth-${Date.now()}.png`)]]);
      U.hint(panel, 'Lauf vom blauen Punkt (oben links) zum grünen Ziel: Pfeiltasten/WASD gehen einen Schritt, mit Umschalt ' +
        'oder per Wischen rutschst du bis zur nächsten Abzweigung. „Lösen“ startet eine Breitensuche – die Farbwelle zeigt ' +
        'den Abstand zu dir. Jeder Algorithmus hat seinen eigenen Charakter: lange Gänge (Zurückverfolgen), viele ' +
        'Sackgassen (Prim), Rechtecke (Teilung), ein Diagonal-Drall (Binärbaum).');

      newMaze(false);
      return { destroy() { stop(); S.destroy(); window.removeEventListener('keydown', onKey); } };
    },
  });
})();
