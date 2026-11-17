/* Stoff – Verlet-Integration: ein Tuch aus Punkten und Federn. Ziehen, schütteln, zerschneiden, zerreißen. */
(function () {
  'use strict';

  Things.register({
    id: 'stoff',
    name: 'Stoff',
    desc: 'Ein Tuch aus Punkten und Fäden – zerr dran, bis es reißt.',

    thumb(c, w, h) {
      c.fillStyle = '#0b0b10';
      c.fillRect(0, 0, w, h);
      const C = 18, R = 11, sp = w * 0.6 / (C - 1), x0 = w * 0.2, y0 = h * 0.12;
      const P = (i, j) => {
        const x = x0 + j * sp, sag = Math.sin(j / (C - 1) * Math.PI) * i * 0.9;
        return [x + Math.sin(i * 0.5 + j * 0.3) * 2, y0 + i * sp * 0.78 + sag];
      };
      for (let i = 0; i < R - 1; i++) for (let j = 0; j < C - 1; j++) {
        if (i > 5 && j > 8 && j < 12 && i < 9) continue; // Loch
        const a = P(i, j), b = P(i, j + 1), d = P(i + 1, j + 1), e = P(i + 1, j);
        c.fillStyle = ((j >> 1) & 1) ? 'hsl(352,70%,46%)' : 'hsl(42,85%,58%)';
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(e[0], e[1]); c.fill();
      }
      c.fillStyle = '#ddd';
      for (let j = 0; j < C; j += 4) { const p = P(0, j); c.beginPath(); c.arc(p[0], p[1], 2.5, 0, 7); c.fill(); }
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { cols: 44, gravity: 900, tear: 2.4, wind: false, windStr: 300, cut: false, iters: 6 };
      let C, R, sp, px, py, ox, oy, pin, la, lb, rest, alive, linkR, linkD, nLinks = 0, time = 0, acc = 0;

      function build() {
        C = st.cols;
        sp = Math.min(S.w * 0.78, 900) / (C - 1);
        R = Math.max(6, Math.min(Math.round(C * 0.62), Math.floor(S.h * 0.62 / sp)));
        const n = C * R, x0 = (S.w - (C - 1) * sp) / 2, y0 = Math.max(70, S.h * 0.1);
        px = new Float32Array(n); py = new Float32Array(n); ox = new Float32Array(n); oy = new Float32Array(n); pin = new Uint8Array(n);
        for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
          const k = i * C + j;
          px[k] = ox[k] = x0 + j * sp; py[k] = oy[k] = y0 + i * sp;
          if (i === 0 && (j % 4 === 0 || j === C - 1)) pin[k] = 1;
        }
        const max = 2 * n;
        la = new Int32Array(max); lb = new Int32Array(max); rest = new Float32Array(max); alive = new Uint8Array(max);
        linkR = new Int32Array(n).fill(-1); linkD = new Int32Array(n).fill(-1);
        nLinks = 0;
        const link = (a, b) => { la[nLinks] = a; lb[nLinks] = b; rest[nLinks] = sp; alive[nLinks] = 1; return nLinks++; };
        for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
          const k = i * C + j;
          if (j < C - 1) linkR[k] = link(k, k + 1);
          if (i < R - 1) linkD[k] = link(k, k + C);
        }
      }

      let grab = -1, ptr = null, lastPtr = null;
      function step(h) {
        time += h;
        const g = st.gravity * h * h, n = C * R;
        for (let k = 0; k < n; k++) {
          if (pin[k]) continue;
          const vx = (px[k] - ox[k]) * 0.995, vy = (py[k] - oy[k]) * 0.995;
          ox[k] = px[k]; oy[k] = py[k];
          let ax = 0;
          if (st.wind) ax = st.windStr * (0.6 + 0.4 * Math.sin(time * 1.7 + py[k] * 0.02) + 0.3 * Math.sin(time * 4.3 + px[k] * 0.03));
          px[k] += vx + ax * h * h; py[k] += vy + g;
        }
        if (grab >= 0 && ptr) { px[grab] = ptr.x; py[grab] = ptr.y; }
        const lim = st.tear;
        for (let it = 0; it < st.iters; it++) {
          for (let l = 0; l < nLinks; l++) {
            if (!alive[l]) continue;
            const a = la[l], b = lb[l], dx = px[b] - px[a], dy = py[b] - py[a], d = Math.sqrt(dx * dx + dy * dy) || 0.001;
            if (d > rest[l] * lim) { alive[l] = 0; continue; }
            const diff = (d - rest[l]) / d, pa = pin[a] || a === grab, pb = pin[b] || b === grab;
            if (pa && pb) continue;
            const f = pa || pb ? 1 : 0.5, mx = dx * diff * f, my = dy * diff * f;
            if (!pa) { px[a] += mx; py[a] += my; }
            if (!pb) { px[b] -= mx; py[b] -= my; }
          }
        }
        const floor = S.h - 4;
        for (let k = 0; k < n; k++) if (py[k] > floor) { py[k] = floor; ox[k] = px[k] - (px[k] - ox[k]) * 0.5; }
      }

      function cutSegment(a, b) {
        const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1;
        for (let l = 0; l < nLinks; l++) {
          if (!alive[l]) continue;
          const mx = (px[la[l]] + px[lb[l]]) / 2, my = (py[la[l]] + py[lb[l]]) / 2;
          let t = ((mx - a.x) * vx + (my - a.y) * vy) / L2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          if (Math.hypot(mx - (a.x + vx * t), my - (a.y + vy * t)) < Math.max(6, sp * 0.6)) alive[l] = 0;
        }
      }
      Things.pointer(stage, {
        down(p) {
          ptr = p; lastPtr = p;
          if (st.cut) { cutSegment(p, p); return; }
          let best = -1, bd = 50 * 50;
          for (let k = 0; k < C * R; k++) {
            const d = (px[k] - p.x) ** 2 + (py[k] - p.y) ** 2;
            if (d < bd) { bd = d; best = k; }
          }
          grab = best;
        },
        move(p) {
          if (!p.down) return;
          if (st.cut && lastPtr) cutSegment(lastPtr, p);
          ptr = p; lastPtr = p;
        },
        up() { grab = -1; ptr = null; lastPtr = null; },
      });

      function draw() {
        ctx.fillStyle = '#0b0b10';
        ctx.fillRect(0, 0, S.w, S.h);
        const A = sp * sp;
        for (let i = 0; i < R - 1; i++) {
          for (let j = 0; j < C - 1; j++) {
            const k = i * C + j;
            const l1 = linkR[k], l2 = linkD[k], l3 = linkR[k + C], l4 = linkD[k + 1];
            if (!alive[l1] || !alive[l2] || !alive[l3] || !alive[l4]) continue;
            const ax = px[k], ay = py[k], bx = px[k + 1], by = py[k + 1], cx = px[k + C + 1], cy = py[k + C + 1], dx = px[k + C], dy = py[k + C];
            const area = Math.abs((cx - ax) * (dy - by) - (cy - ay) * (dx - bx)) / 2;
            const shade = Math.max(0.35, Math.min(1.15, area / A));
            const red = (j >> 1) & 1;
            ctx.fillStyle = red ? `hsl(352,70%,${(22 + 26 * shade).toFixed(1)}%)` : `hsl(42,85%,${(28 + 32 * shade).toFixed(1)}%)`;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath();
            ctx.fill();
          }
        }
        // lose Fäden (deren Fläche fehlt) sichtbar machen
        ctx.strokeStyle = 'rgba(255,240,210,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let l = 0; l < nLinks; l++) {
          if (!alive[l]) continue;
          ctx.moveTo(px[la[l]], py[la[l]]); ctx.lineTo(px[lb[l]], py[lb[l]]);
        }
        ctx.stroke();
        ctx.fillStyle = '#e6e6ee';
        for (let k = 0; k < C; k++) if (pin[k]) { ctx.beginPath(); ctx.arc(px[k], py[k], 3.5, 0, 7); ctx.fill(); }
        if (st.cut && ptr) { ctx.strokeStyle = '#ff5566'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 10, 0, 7); ctx.stroke(); }
        let broken = 0;
        for (let l = 0; l < nLinks; l++) if (!alive[l]) broken++;
        hud.textContent = `${C * R} Punkte   ${broken} Fäden gerissen`;
      }

      const H = 1 / 120;
      const stop = Things.loop((dt) => {
        acc += dt;
        let n = 0;
        while (acc >= H && n < 6) { step(H); acc -= H; n++; }
        if (n === 6) acc = 0;
        draw();
      });
      S.onresize = build;

      U.toggle(panel, 'Schere (Ziehen schneidet)', st.cut, (v) => (st.cut = v));
      U.buttons(panel, [
        ['Neu aufhängen', build, true],
        ['Nadeln lösen', () => pin.fill(0)],
      ]);
      U.slider(panel, 'Reißfestigkeit', { min: 1.2, max: 5, value: st.tear, fmt: (v) => (v >= 4.95 ? 'unzerreißbar' : v.toFixed(1).replace('.', ',') + '×'),
        onInput: (v) => (st.tear = v >= 4.95 ? 1e9 : v) });
      U.slider(panel, 'Schwerkraft', { min: 0, max: 2500, step: 10, value: st.gravity, fmt: (v) => v, onInput: (v) => (st.gravity = v) });
      U.toggle(panel, 'Wind', st.wind, (v) => (st.wind = v));
      U.slider(panel, 'Windstärke', { min: 0, max: 1500, step: 10, value: st.windStr, fmt: (v) => v, onInput: (v) => (st.windStr = v) });
      U.slider(panel, 'Feinheit', { min: 16, max: 70, step: 1, value: st.cols, fmt: (v) => v + ' Spalten', onChange: (v) => { st.cols = v; build(); } });
      U.hint(panel, 'Greif das Tuch und zieh daran – reißt du zu fest, geben die Fäden nach. Mit der Schere schneidest du ' +
        'Löcher hinein. Jeder Punkt merkt sich nur seine letzte Position (Verlet-Verfahren), die Fäden halten ihn auf Abstand.');

      build();
      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
