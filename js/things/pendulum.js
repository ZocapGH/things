/* Doppelpendel – exakte Bewegungsgleichungen, RK4-Integration, Chaos-Fächer. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  // Winkelbeschleunigungen (Winkel von der Senkrechten nach unten gemessen)
  function accel(P, a1, a2, w1, w2, out) {
    const m1 = P.m1, m2 = P.m2, l1 = P.l1, l2 = P.l2, g = P.g;
    const d = a1 - a2, sd = Math.sin(d), cd = Math.cos(d);
    const den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
    out[0] = (-g * (2 * m1 + m2) * Math.sin(a1) - m2 * g * Math.sin(a1 - 2 * a2)
      - 2 * sd * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * cd)) / (l1 * den);
    out[1] = (2 * sd * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(a1)
      + w2 * w2 * l2 * m2 * cd)) / (l2 * den);
  }
  const k1 = [0, 0], k2 = [0, 0], k3 = [0, 0], k4 = [0, 0];
  function rk4(P, s, h) {
    const a1 = s.a1, a2 = s.a2, w1 = s.w1, w2 = s.w2;
    accel(P, a1, a2, w1, w2, k1);
    const w1b = w1 + k1[0] * h / 2, w2b = w2 + k1[1] * h / 2;
    accel(P, a1 + w1 * h / 2, a2 + w2 * h / 2, w1b, w2b, k2);
    const w1c = w1 + k2[0] * h / 2, w2c = w2 + k2[1] * h / 2;
    accel(P, a1 + w1b * h / 2, a2 + w2b * h / 2, w1c, w2c, k3);
    const w1d = w1 + k3[0] * h, w2d = w2 + k3[1] * h;
    accel(P, a1 + w1c * h, a2 + w2c * h, w1d, w2d, k4);
    s.a1 += h / 6 * (w1 + 2 * w1b + 2 * w1c + w1d);
    s.a2 += h / 6 * (w2 + 2 * w2b + 2 * w2c + w2d);
    s.w1 += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    s.w2 += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    if (P.damp > 0) {
      const f = Math.exp(-P.damp * h);
      s.w1 *= f; s.w2 *= f;
    }
  }

  Things.register({
    id: 'doppelpendel',
    name: 'Doppelpendel',
    desc: 'Chaos pur: winzige Unterschiede am Start, völlig andere Bahnen.',

    thumb(c, w, h) {
      c.fillStyle = '#08080c';
      c.fillRect(0, 0, w, h);
      const P = { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81, damp: 0 };
      const s = { a1: 2.3, a2: 2.9, w1: 0, w2: 0 };
      const sc = h * 0.22, ox = w / 2, oy = h * 0.48;
      c.lineWidth = 1.2;
      let px = null, py = null;
      for (let i = 0; i < 2600; i++) {
        rk4(P, s, 0.004);
        const x = ox + (Math.sin(s.a1) + Math.sin(s.a2)) * sc;
        const y = oy + (Math.cos(s.a1) + Math.cos(s.a2)) * sc;
        if (px !== null) {
          c.strokeStyle = `hsla(${(i * 0.15) % 360},90%,62%,${0.25 + 0.75 * i / 2600})`;
          c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke();
        }
        px = x; py = y;
      }
      const x1 = ox + Math.sin(s.a1) * sc, y1 = oy + Math.cos(s.a1) * sc;
      c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(ox, oy); c.lineTo(x1, y1); c.lineTo(px, py); c.stroke();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(x1, y1, 4, 0, TAU); c.fill();
      c.beginPath(); c.arc(px, py, 5, 0, TAU); c.fill();
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const P = { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81, damp: 0, speed: 1, count: 1, trail: 900, paused: false };
      const H = 1 / 480; // feste Schrittweite – genau und stabil
      let pends = [], time = 0, acc = 0, sub = 0, drag = 0;

      function make(a1, a2, w1, w2) {
        pends = [];
        const n = P.count;
        for (let i = 0; i < n; i++) {
          const off = n > 1 ? (i - (n - 1) / 2) * 0.0004 : 0;
          pends.push({ a1: a1 + off, a2: a2 + off, w1: w1 || 0, w2: w2 || 0,
            hue: n > 1 ? (i / n) * 300 : 0, xs: [], ys: [] });
        }
        time = 0; acc = 0;
      }
      const rnd = (a, b) => a + (b - a) * Math.random();
      make(2.1, 2.7);

      const bob = (p) => {
        const x1 = P.l1 * Math.sin(p.a1), y1 = P.l1 * Math.cos(p.a1);
        return [x1, y1, x1 + P.l2 * Math.sin(p.a2), y1 + P.l2 * Math.cos(p.a2)];
      };
      const view = () => ({ ox: S.w / 2, oy: S.h * 0.46, sc: Math.min(S.w * 0.46, S.h * 0.41) / (P.l1 + P.l2) });

      function draw() {
        const { ox, oy, sc } = view();
        ctx.fillStyle = '#08080c';
        ctx.fillRect(0, 0, S.w, S.h);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const multi = pends.length > 1, B = 16;
        // Spuren in Alpha-Stufen (älter = blasser)
        for (const p of pends) {
          const n = p.xs.length;
          if (n < 2) continue;
          for (let b = 0; b < B; b++) {
            const s = Math.floor(b * (n - 1) / B), e = Math.floor((b + 1) * (n - 1) / B);
            if (e <= s) continue;
            const f = (b + 1) / B;
            const hue = multi ? p.hue : (time * 25 + b * 7) % 360;
            ctx.strokeStyle = `hsla(${hue},90%,62%,${(f * f * (multi ? 0.85 : 1)).toFixed(3)})`;
            ctx.lineWidth = multi ? 1.3 : 0.8 + f * 2.4;
            ctx.beginPath();
            ctx.moveTo(ox + p.xs[s] * sc, oy + p.ys[s] * sc);
            for (let k = s + 1; k <= e; k++) ctx.lineTo(ox + p.xs[k] * sc, oy + p.ys[k] * sc);
            ctx.stroke();
          }
        }
        // Stangen und Kugeln
        const many = pends.length > 6;
        const r1 = 6 + 5 * Math.cbrt(P.m1), r2 = 6 + 5 * Math.cbrt(P.m2);
        for (let i = pends.length - 1; i >= 0; i--) {
          const p = pends[i];
          const [x1, y1, x2, y2] = bob(p);
          const X1 = ox + x1 * sc, Y1 = oy + y1 * sc, X2 = ox + x2 * sc, Y2 = oy + y2 * sc;
          ctx.strokeStyle = many ? `hsla(${p.hue},80%,75%,0.35)` : '#dcdce6';
          ctx.lineWidth = many ? 1 : 3;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(X1, Y1); ctx.lineTo(X2, Y2); ctx.stroke();
          const c2 = multi ? `hsl(${p.hue},90%,62%)` : `hsl(${(time * 25) % 360},90%,62%)`;
          if (many) {
            ctx.fillStyle = c2;
            ctx.beginPath(); ctx.arc(X2, Y2, 3, 0, TAU); ctx.fill();
          } else {
            ctx.fillStyle = '#f4f4f8';
            ctx.beginPath(); ctx.arc(X1, Y1, r1, 0, TAU); ctx.fill();
            ctx.fillStyle = c2;
            ctx.beginPath(); ctx.arc(X2, Y2, r2, 0, TAU); ctx.fill();
            ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 1.5; ctx.stroke();
          }
        }
        ctx.fillStyle = '#9a9aab';
        ctx.beginPath(); ctx.arc(ox, oy, 5, 0, TAU); ctx.fill();
        hud.textContent = `t = ${time.toFixed(1)} s` + (pends.length > 1 ? `   ${pends.length} Pendel` : '') +
          (P.paused ? '   ⏸' : '');
      }

      const stop = Things.loop((dt) => {
        if (!P.paused && !drag) {
          acc += dt * P.speed;
          const maxLen = Math.max(2, Math.min(P.trail, Math.floor(80000 / pends.length)));
          let n = 0;
          while (acc >= H && n < 3000) {
            acc -= H; n++; time += H; sub++;
            for (const p of pends) rk4(P, p, H);
            if (P.trail > 0 && sub % 2 === 0) {
              for (const p of pends) {
                const b = bob(p);
                p.xs.push(b[2]); p.ys.push(b[3]);
              }
            }
          }
          for (const p of pends) {
            const extra = p.xs.length - (P.trail > 0 ? maxLen : 0);
            if (extra > 0) { p.xs.splice(0, extra); p.ys.splice(0, extra); }
          }
        }
        draw();
      });

      // Kugeln mit Finger/Maus ziehen
      function applyDrag(pt) {
        const { ox, oy, sc } = view();
        const p0 = pends[0];
        let a1 = p0.a1, a2 = p0.a2;
        if (drag === 1) a1 = Math.atan2(pt.x - ox, pt.y - oy);
        else {
          const X1 = ox + P.l1 * sc * Math.sin(a1), Y1 = oy + P.l1 * sc * Math.cos(a1);
          a2 = Math.atan2(pt.x - X1, pt.y - Y1);
        }
        make(a1, a2);
      }
      Things.pointer(stage, {
        down(pt) {
          const { ox, oy, sc } = view();
          const [x1, y1, x2, y2] = bob(pends[0]);
          const d1 = Math.hypot(pt.x - (ox + x1 * sc), pt.y - (oy + y1 * sc));
          const d2 = Math.hypot(pt.x - (ox + x2 * sc), pt.y - (oy + y2 * sc));
          if (Math.min(d1, d2) > 55) return;
          drag = d2 <= d1 ? 2 : 1;
          applyDrag(pt);
        },
        move(pt) { if (drag && pt.down) applyDrag(pt); },
        up() { drag = 0; },
      });

      // Panel
      const [pauseBtn] = U.buttons(panel, [
        ['Pause', () => { P.paused = !P.paused; pauseBtn.textContent = P.paused ? 'Weiter' : 'Pause'; }, true],
        ['Zufall', () => make(rnd(-Math.PI, Math.PI), rnd(-Math.PI, Math.PI))],
        ['Fast senkrecht', () => make(Math.PI - 0.03, Math.PI + 0.02)],
      ]);
      U.heading(panel, 'Chaos');
      U.slider(panel, 'Pendel (Fächer)', { min: 1, max: 200, step: 1, value: P.count, fmt: (v) => v,
        onInput: (v) => { P.count = v; const p = pends[0]; make(p.a1, p.a2, p.w1, p.w2); } });
      U.heading(panel, 'Physik');
      U.slider(panel, 'Masse oben (kg)', { min: 0.2, max: 5, value: P.m1, onInput: (v) => (P.m1 = v) });
      U.slider(panel, 'Masse unten (kg)', { min: 0.2, max: 5, value: P.m2, onInput: (v) => (P.m2 = v) });
      U.slider(panel, 'Länge oben (m)', { min: 0.3, max: 2, value: P.l1, onInput: (v) => (P.l1 = v) });
      U.slider(panel, 'Länge unten (m)', { min: 0.3, max: 2, value: P.l2, onInput: (v) => (P.l2 = v) });
      U.slider(panel, 'Gravitation (m/s²)', { min: 0, max: 30, step: 0.01, value: P.g, onInput: (v) => (P.g = v) });
      U.slider(panel, 'Reibung', { min: 0, max: 1, value: P.damp, onInput: (v) => (P.damp = v) });
      U.heading(panel, 'Darstellung');
      U.slider(panel, 'Tempo', { min: 0.1, max: 3, value: P.speed, fmt: (v) => v.toFixed(1).replace('.', ',') + '×',
        onInput: (v) => (P.speed = v) });
      U.slider(panel, 'Spurlänge', { min: 0, max: 3000, step: 10, value: P.trail, fmt: (v) => (v / 240).toFixed(1).replace('.', ',') + ' s',
        onInput: (v) => (P.trail = v) });
      U.hint(panel, 'Zieh an den Kugeln, um das Pendel neu zu positionieren. Mit mehreren Pendeln starten alle ' +
        'fast gleich (je 0,0004 rad Unterschied) – nach wenigen Sekunden fliegt der Fächer auseinander.');

      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
