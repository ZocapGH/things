/* Fourier-Epizykel – jede geschlossene Linie ist eine Summe rotierender Kreise.
   Diskrete Fourier-Transformation der Kontur, dann Kreise nach Größe sortiert abspielen. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const N = 512;

  function polygon(vs) {
    return (t) => {
      const n = vs.length, f = t * n, i = Math.floor(f) % n, u = f - Math.floor(f);
      const a = vs[i], b = vs[(i + 1) % n];
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    };
  }
  const star = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.42 : 1, a = -Math.PI / 2 + i * Math.PI / 5;
    star.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const SHAPES = {
    herz: ['Herz', (t) => {
      const a = t * TAU, s = Math.sin(a);
      return [16 * s * s * s / 17, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17 - 0.1];
    }],
    stern: ['Stern', polygon(star)],
    unendlich: ['Unendlich', (t) => {
      const a = t * TAU, s = Math.sin(a), d = 1 + s * s;
      return [1.15 * Math.cos(a) / d, 1.15 * s * Math.cos(a) / d];
    }],
    klee: ['Kleeblatt', (t) => {
      const a = t * TAU, r = 0.35 + 0.65 * Math.abs(Math.cos(2 * a));
      return [r * Math.cos(a), r * Math.sin(a)];
    }],
    quadrat: ['Quadrat', polygon([[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]])],
    eigen: ['Eigene Zeichnung', null],
  };

  // Geschlossenen Linienzug gleichmäßig nach Bogenlänge neu abtasten
  function resample(pts, n) {
    const L = [0];
    for (let i = 1; i <= pts.length; i++) {
      const a = pts[i - 1], b = pts[i % pts.length];
      L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const total = L[L.length - 1] || 1, xs = new Float64Array(n), ys = new Float64Array(n);
    let j = 0;
    for (let k = 0; k < n; k++) {
      const d = (k / n) * total;
      while (j < pts.length - 1 && L[j + 1] < d) j++;
      const a = pts[j], b = pts[(j + 1) % pts.length], seg = L[j + 1] - L[j] || 1, u = (d - L[j]) / seg;
      xs[k] = a[0] + (b[0] - a[0]) * u; ys[k] = a[1] + (b[1] - a[1]) * u;
    }
    return [xs, ys];
  }
  const COS = new Float64Array(N), SIN = new Float64Array(N);
  for (let i = 0; i < N; i++) { COS[i] = Math.cos(TAU * i / N); SIN[i] = Math.sin(TAU * i / N); }
  function dft(xs, ys) {
    const out = [];
    for (let k = 0; k < N; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const m = (k * n) % N, c = COS[m], s = SIN[m];
        re += xs[n] * c + ys[n] * s;
        im += ys[n] * c - xs[n] * s;
      }
      re /= N; im /= N;
      out.push({ freq: k <= N / 2 ? k : k - N, amp: Math.hypot(re, im), phase: Math.atan2(im, re) });
    }
    return out.sort((a, b) => b.amp - a.amp);
  }
  function fromShape(f) {
    const pts = [];
    for (let i = 0; i < N; i++) pts.push(f(i / N));
    return pts;
  }

  Things.register({
    id: 'fourier',
    name: 'Fourier-Epizykel',
    desc: 'Zeichne irgendwas – rotierende Kreise malen es nach.',

    thumb(c, w, h) {
      c.fillStyle = '#0b0b10';
      c.fillRect(0, 0, w, h);
      const [xs, ys] = resample(fromShape(SHAPES.herz[1]), N), F = dft(xs, ys), R = h * 0.4, ox = w * 0.5, oy = h * 0.52;
      c.strokeStyle = '#ffcc33'; c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i <= 300; i++) {
        const t = (i / 300) * 0.8;
        let x = 0, y = 0;
        for (let k = 0; k < 40; k++) { const e = F[k], a = TAU * e.freq * t + e.phase; x += e.amp * Math.cos(a); y += e.amp * Math.sin(a); }
        c.lineTo(ox + x * R, oy + y * R);
      }
      c.stroke();
      let x = 0, y = 0;
      c.lineWidth = 1;
      for (let k = 0; k < 12; k++) {
        const e = F[k], a = TAU * e.freq * 0.8 + e.phase;
        c.strokeStyle = 'rgba(255,255,255,0.35)';
        c.beginPath(); c.arc(ox + x * R, oy + y * R, e.amp * R, 0, TAU); c.stroke();
        const nx = x + e.amp * Math.cos(a), ny = y + e.amp * Math.sin(a);
        c.strokeStyle = 'rgba(255,255,255,0.8)';
        c.beginPath(); c.moveTo(ox + x * R, oy + y * R); c.lineTo(ox + nx * R, oy + ny * R); c.stroke();
        x = nx; y = ny;
      }
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { shape: 'herz', kLog: 70, speed: 1, circles: true, ghost: true };
      let F = [], src = null, K = 1, t = 0, trace = [], drawing = null;

      const R = () => Math.min(S.w, S.h) * 0.38;
      const O = () => [S.w / 2, S.h / 2 + 10];
      function setK() { K = Math.max(1, Math.round(Math.exp((st.kLog / 100) * Math.log(N)))); }
      function load(pts) {
        src = resample(pts, N);
        F = dft(src[0], src[1]);
        t = 0; trace = [];
      }
      function tip(tt) {
        let x = 0, y = 0;
        for (let k = 0; k < K; k++) { const e = F[k], a = TAU * e.freq * tt + e.phase; x += e.amp * Math.cos(a); y += e.amp * Math.sin(a); }
        return [x, y];
      }
      setK();
      load(fromShape(SHAPES.herz[1]));

      const stop = Things.loop((dt) => {
        const r = R(), [ox, oy] = O();
        ctx.fillStyle = '#0b0b10';
        ctx.fillRect(0, 0, S.w, S.h);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (drawing) {
          ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (const p of drawing) ctx.lineTo(p[0], p[1]);
          ctx.stroke();
          hud.textContent = 'zeichnen …';
          return;
        }
        if (!F.length) return;
        // Zeit vorrücken – in Schritten von 1/N, damit die Spur glatt bleibt
        const adv = dt * st.speed / 10;
        const steps = Math.max(1, Math.ceil(adv * N));
        for (let s = 0; s < steps; s++) {
          t += adv / steps;
          if (t >= 1) { t -= 1; trace = []; }
          trace.push(tip(t));
        }
        if (st.ghost && src) {
          ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i <= N; i++) ctx.lineTo(ox + src[0][i % N] * r, oy + src[1][i % N] * r);
          ctx.stroke();
        }
        // Kreise und Zeiger
        let x = 0, y = 0;
        if (st.circles) {
          for (let k = 0; k < K; k++) {
            const e = F[k], a = TAU * e.freq * t + e.phase, nx = x + e.amp * Math.cos(a), ny = y + e.amp * Math.sin(a);
            if (e.amp * r > 0.6) {
              ctx.strokeStyle = 'rgba(160,190,255,0.22)'; ctx.lineWidth = 1;
              ctx.beginPath(); ctx.arc(ox + x * r, oy + y * r, e.amp * r, 0, TAU); ctx.stroke();
              ctx.strokeStyle = 'rgba(255,255,255,0.7)';
              ctx.beginPath(); ctx.moveTo(ox + x * r, oy + y * r); ctx.lineTo(ox + nx * r, oy + ny * r); ctx.stroke();
            }
            x = nx; y = ny;
          }
        }
        ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (const p of trace) ctx.lineTo(ox + p[0] * r, oy + p[1] * r);
        ctx.stroke();
        if (trace.length) {
          const p = trace[trace.length - 1];
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(ox + p[0] * r, oy + p[1] * r, 4, 0, TAU); ctx.fill();
        }
        hud.textContent = `${K} von ${N} Kreisen`;
      });

      Things.pointer(stage, {
        down(p) { drawing = [[p.x, p.y]]; },
        move(p) {
          if (!drawing || !p.down) return;
          const l = drawing[drawing.length - 1];
          if (Math.hypot(p.x - l[0], p.y - l[1]) > 2) drawing.push([p.x, p.y]);
        },
        up() {
          const d = drawing;
          drawing = null;
          if (!d || d.length < 12) return;
          const r = R(), [ox, oy] = O();
          load(d.map((q) => [(q[0] - ox) / r, (q[1] - oy) / r]));
          st.shape = 'eigen'; shapeSel.value = 'eigen';
        },
      });

      const shapeSel = U.select(panel, 'Vorlage', Object.entries(SHAPES).map(([k, v]) => [k, v[0]]), st.shape, (v) => {
        st.shape = v;
        if (SHAPES[v][1]) load(fromShape(SHAPES[v][1]));
      });
      U.slider(panel, 'Anzahl Kreise', { min: 0, max: 100, step: 1, value: st.kLog,
        fmt: (v) => Math.max(1, Math.round(Math.exp((v / 100) * Math.log(N)))), onInput: (v) => { st.kLog = v; setK(); trace = []; } });
      U.slider(panel, 'Tempo', { min: 0.1, max: 4, value: st.speed, fmt: (v) => v.toFixed(1).replace('.', ',') + '×', onInput: (v) => (st.speed = v) });
      U.toggle(panel, 'Kreise zeigen', st.circles, (v) => (st.circles = v));
      U.toggle(panel, 'Vorlage zeigen', st.ghost, (v) => (st.ghost = v));
      U.hint(panel, 'Zeichne mit Finger oder Maus eine beliebige Form – sie wird als geschlossene Kurve in Kreise zerlegt. ' +
        'Mit wenigen Kreisen siehst du nur die grobe Gestalt; beim Quadrat zeigen sich an den Ecken kleine Überschwinger (Gibbs-Phänomen).');

      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
