/* Galtonbrett – Kugeln prallen an Nägeln zufällig links oder rechts ab.
   Aus purem Zufall entsteht verlässlich die Glockenkurve (Binomial- bzw. Normalverteilung). */
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  function probs(n, p) {
    p = Math.min(0.999, Math.max(0.001, p));
    const out = new Float64Array(n + 1);
    out[0] = Math.pow(1 - p, n);
    for (let k = 0; k < n; k++) out[k + 1] = out[k] * (n - k) / (k + 1) * p / (1 - p);
    return out;
  }

  Things.register({
    id: 'galton',
    name: 'Galtonbrett',
    desc: 'Lauter Zufall – und trotzdem entsteht die Glockenkurve.',

    thumb(c, w, h) {
      c.fillStyle = '#0b0b10';
      c.fillRect(0, 0, w, h);
      const n = 10, sp = w / 15, top = h * 0.1, rh = h * 0.045;
      c.fillStyle = '#8a8aa0';
      for (let r = 0; r < n; r++) for (let k = 0; k <= r; k++) { c.beginPath(); c.arc(w / 2 + (k - r / 2) * sp, top + r * rh, 1.6, 0, TAU); c.fill(); }
      const pr = probs(n, 0.5), base = h * 0.95, bh = h * 0.42;
      for (let k = 0; k <= n; k++) {
        const x = w / 2 + (k - n / 2) * sp, H = pr[k] / pr[n / 2] * bh;
        c.fillStyle = `hsl(${200 + k * 8},75%,60%)`;
        c.fillRect(x - sp * 0.4, base - H, sp * 0.8, H);
      }
      c.strokeStyle = '#ffcc33'; c.lineWidth = 2;
      c.beginPath();
      for (let x = -n / 2 - 0.5; x <= n / 2 + 0.5; x += 0.1) {
        const y = Math.exp(-x * x / (2 * n * 0.25));
        c.lineTo(w / 2 + x * sp, base - y * bh);
      }
      c.stroke();
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { rows: 12, p: 0.5, rate: 30, run: true, dur: 0.11 };
      let counts, total, balls = [], acc = 0, L;

      function reset() { counts = new Float64Array(st.rows + 1); total = 0; balls = []; }
      function layout() {
        const top = Math.max(84, S.h * 0.12), binH = S.h * 0.36, binTop = S.h - binH - 12;
        const rowH = (binTop - top) / (st.rows + 0.5);
        const spacing = Math.min(rowH * 1.25, (S.w * 0.92) / (st.rows + 1));
        return { top, binTop, binH, rowH, spacing, cx: S.w / 2, bottom: S.h - 12 };
      }
      const peg = (r, k) => [L.cx + (k - r / 2) * L.spacing, L.top + r * L.rowH];
      function spawn() { balls.push({ r: 0, k: 0, t: 0, d: Math.random() < st.p ? 1 : 0, hue: 180 + Math.random() * 60 }); }
      function instant(n) {
        for (let i = 0; i < n; i++) {
          let k = 0;
          for (let r = 0; r < st.rows; r++) if (Math.random() < st.p) k++;
          counts[k]++; total++;
        }
      }

      const stop = Things.loop((dt) => {
        L = layout();
        if (st.run) {
          acc += dt * st.rate;
          while (acc >= 1 && balls.length < 3000) { spawn(); acc -= 1; }
          for (let i = balls.length - 1; i >= 0; i--) {
            const b = balls[i];
            b.t += dt / st.dur;
            while (b.t >= 1) {
              b.t -= 1; b.r++; b.k += b.d;
              if (b.r >= st.rows) { counts[b.k]++; total++; balls.splice(i, 1); break; }
              b.d = Math.random() < st.p ? 1 : 0;
            }
          }
        }
        // Zeichnen
        ctx.fillStyle = '#0b0b10';
        ctx.fillRect(0, 0, S.w, S.h);
        const pr = probs(st.rows, st.p), sp = L.spacing;
        let maxC = 0;
        for (let k = 0; k <= st.rows; k++) maxC = Math.max(maxC, counts[k], total * pr[k]);
        const scale = maxC > 0 ? (L.binH - 10) / (maxC * 1.05) : 0;
        // Fächer
        ctx.strokeStyle = '#2a2a36'; ctx.lineWidth = 1;
        for (let k = 0; k <= st.rows + 1; k++) {
          const x = L.cx + (k - 0.5 - st.rows / 2) * sp;
          ctx.beginPath(); ctx.moveTo(x, L.binTop); ctx.lineTo(x, L.bottom); ctx.stroke();
        }
        for (let k = 0; k <= st.rows; k++) {
          const x = L.cx + (k - st.rows / 2) * sp, H = counts[k] * scale;
          ctx.fillStyle = `hsl(${200 + (k / st.rows) * 120},75%,58%)`;
          ctx.fillRect(x - sp * 0.42, L.bottom - H, sp * 0.84, H);
        }
        // Theorie: Normalverteilung
        const mu = st.rows * st.p, sig = Math.sqrt(st.rows * st.p * (1 - st.p)) || 0.3;
        if (total > 0) {
          ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let x = -0.5; x <= st.rows + 0.5; x += 0.05) {
            const y = total * Math.exp(-((x - mu) ** 2) / (2 * sig * sig)) / (sig * Math.sqrt(TAU));
            ctx.lineTo(L.cx + (x - st.rows / 2) * sp, L.bottom - y * scale);
          }
          ctx.stroke();
        }
        // Nägel
        ctx.fillStyle = '#9a9aab';
        const pr2 = Math.max(1.5, sp * 0.08);
        for (let r = 0; r < st.rows; r++) for (let k = 0; k <= r; k++) {
          const [x, y] = peg(r, k);
          ctx.beginPath(); ctx.arc(x, y, pr2, 0, TAU); ctx.fill();
        }
        // Trichter
        ctx.strokeStyle = '#555568'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(L.cx - sp * 1.6, L.top - L.rowH * 1.3); ctx.lineTo(L.cx - sp * 0.35, L.top - L.rowH * 0.45);
        ctx.moveTo(L.cx + sp * 1.6, L.top - L.rowH * 1.3); ctx.lineTo(L.cx + sp * 0.35, L.top - L.rowH * 0.45);
        ctx.stroke();
        // Kugeln
        const br = Math.max(2, sp * 0.17);
        for (const b of balls) {
          const [x0, y0] = peg(b.r, b.k);
          let x1, y1;
          if (b.r + 1 >= st.rows) { x1 = L.cx + (b.k + b.d - st.rows / 2) * sp; y1 = L.binTop; }
          else [x1, y1] = peg(b.r + 1, b.k + b.d);
          const t = b.t;
          const x = x0 + (x1 - x0) * (0.5 - 0.5 * Math.cos(Math.PI * t));
          const y = y0 - pr2 - br + (y1 - y0) * (1.35 * t * t - 0.35 * t);
          ctx.fillStyle = `hsl(${b.hue},85%,70%)`;
          ctx.beginPath(); ctx.arc(x, y, br, 0, TAU); ctx.fill();
        }
        let mean = 0;
        for (let k = 0; k <= st.rows; k++) mean += k * counts[k];
        mean = total ? mean / total : 0;
        hud.textContent = `${total} Kugeln   Mittel ${mean.toFixed(2).replace('.', ',')}   erwartet ${mu.toFixed(2).replace('.', ',')}`;
      });

      const [runBtn] = U.buttons(panel, [
        ['Pause', () => { st.run = !st.run; runBtn.textContent = st.run ? 'Pause' : 'Weiter'; }, true],
        ['+1000 sofort', () => instant(1000)],
        ['Leeren', reset],
      ]);
      U.slider(panel, 'Reihen', { min: 4, max: 24, step: 1, value: st.rows, fmt: (v) => v, onChange: (v) => { st.rows = v; reset(); } });
      U.slider(panel, 'Neigung (rechts)', { min: 0.05, max: 0.95, step: 0.01, value: st.p, fmt: (v) => Math.round(v * 100) + ' %',
        onInput: (v) => { st.p = v; } , onChange: () => reset() });
      U.slider(panel, 'Kugeln pro Sekunde', { min: 1, max: 300, step: 1, value: st.rate, fmt: (v) => v, onInput: (v) => (st.rate = v) });
      U.slider(panel, 'Fallgeschwindigkeit', { min: 0.03, max: 0.3, value: 0.33 - st.dur, fmt: (v) => Math.round(v / 0.22 * 100) + ' %',
        onInput: (v) => (st.dur = 0.33 - v) });
      U.hint(panel, 'An jedem Nagel entscheidet der Zufall: links oder rechts. Die Endposition ist die Anzahl der Rechts-Abpraller – ' +
        'binomialverteilt. Je mehr Kugeln, desto genauer folgen die Säulen der gelben Glockenkurve (zentraler Grenzwertsatz).');

      reset();
      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
