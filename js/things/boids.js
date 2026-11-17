/* Schwarm (Boids) – drei einfache Regeln, emergentes Schwarmverhalten. Räumliches Gitter für Tempo. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  Things.register({
    id: 'schwarm',
    name: 'Schwarm',
    desc: 'Hunderte Vögel, drei Regeln – und du bist der Raubvogel.',

    thumb(c, w, h) {
      c.fillStyle = '#0b0b10';
      c.fillRect(0, 0, w, h);
      const R = Things.rng(5);
      for (let i = 0; i < 170; i++) {
        const x = R() * w, y = R() * h;
        const a = Math.sin(x * 0.02) * 1.2 + Math.cos(y * 0.025) * 0.8 + 0.3 * R();
        c.beginPath();
        tri(c, x, y, Math.cos(a), Math.sin(a), 1.1);
        c.fillStyle = `hsl(${((a / TAU) * 360 + 720) % 360},85%,62%)`;
        c.fill();
      }
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const P = { n: 700, r: 45, align: 1, coh: 1, sep: 1, speed: 1, trails: true, mode: 'flucht', size: 1 };
      let N = 0, px, py, vx, vy, next, head = null, bucket;
      let ptr = null;

      function alloc(n) {
        const o = { px, py, vx, vy }, old = N;
        px = new Float32Array(n); py = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n);
        next = new Int32Array(n); bucket = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          if (i < old) { px[i] = o.px[i]; py[i] = o.py[i]; vx[i] = o.vx[i]; vy[i] = o.vy[i]; continue; }
          px[i] = Math.random() * S.w; py[i] = Math.random() * S.h;
          const a = Math.random() * TAU;
          vx[i] = Math.cos(a) * 80; vy[i] = Math.sin(a) * 80;
        }
        N = n;
      }
      alloc(P.n);

      function step(dt) {
        const R = P.r, W = S.w, H = S.h;
        const cols = Math.max(1, Math.ceil(W / R)), rows = Math.max(1, Math.ceil(H / R));
        if (!head || head.length < cols * rows) head = new Int32Array(cols * rows);
        head.fill(-1, 0, cols * rows);
        for (let i = 0; i < N; i++) {
          let gx = (px[i] / R) | 0, gy = (py[i] / R) | 0;
          gx = gx < 0 ? 0 : gx >= cols ? cols - 1 : gx;
          gy = gy < 0 ? 0 : gy >= rows ? rows - 1 : gy;
          const c = gy * cols + gx;
          next[i] = head[c]; head[c] = i;
        }
        const maxV = 120 * P.speed, minV = maxV * 0.5, R2 = R * R, sR = R * 0.42, sR2 = sR * sR;
        for (let i = 0; i < N; i++) {
          const x = px[i], y = py[i];
          let cnt = 0, ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0;
          const gx = (x / R) | 0, gy = (y / R) | 0;
          for (let oy = -1; oy <= 1; oy++) {
            const yy = gy + oy;
            if (yy < 0 || yy >= rows) continue;
            for (let ox = -1; ox <= 1; ox++) {
              const xx = gx + ox;
              if (xx < 0 || xx >= cols) continue;
              for (let j = head[yy * cols + xx]; j !== -1; j = next[j]) {
                if (j === i) continue;
                const dx = px[j] - x, dy = py[j] - y, d2 = dx * dx + dy * dy;
                if (d2 > R2) continue;
                cnt++; ax += vx[j]; ay += vy[j]; cx += dx; cy += dy;
                if (d2 < sR2 && d2 > 0.01) {
                  const d = Math.sqrt(d2), w = (sR - d) / d;
                  sx -= dx * w; sy -= dy * w;
                }
              }
            }
          }
          let fx = 0, fy = 0;
          if (cnt) {
            fx += (ax / cnt - vx[i]) * 1.6 * P.align + (cx / cnt) * 2.2 * P.coh + sx * 9 * P.sep;
            fy += (ay / cnt - vy[i]) * 1.6 * P.align + (cy / cnt) * 2.2 * P.coh + sy * 9 * P.sep;
          }
          if (ptr) {
            const dx = ptr.x - x, dy = ptr.y - y, d = Math.sqrt(dx * dx + dy * dy) + 0.01;
            if (P.mode === 'locken') { fx += dx / d * 260; fy += dy / d * 260; }
            else if (d < 170) { const f = 1600 * (1 - d / 170); fx -= dx / d * f; fy -= dy / d * f; }
          }
          let nvx = vx[i] + fx * dt, nvy = vy[i] + fy * dt;
          const v = Math.sqrt(nvx * nvx + nvy * nvy) + 1e-6;
          const lim = v > maxV * (ptr && P.mode === 'flucht' ? 2 : 1) ? maxV / v : v < minV ? minV / v : 1;
          vx[i] = nvx * lim; vy[i] = nvy * lim;
        }
        for (let i = 0; i < N; i++) {
          px[i] += vx[i] * dt; py[i] += vy[i] * dt;
          if (px[i] < 0) px[i] += W; else if (px[i] >= W) px[i] -= W;
          if (py[i] < 0) py[i] += H; else if (py[i] >= H) py[i] -= H;
        }
      }

      const B = 24;
      function draw() {
        ctx.fillStyle = P.trails ? 'rgba(11,11,16,0.3)' : '#0b0b10';
        ctx.fillRect(0, 0, S.w, S.h);
        for (let i = 0; i < N; i++) {
          const a = Math.atan2(vy[i], vx[i]);
          bucket[i] = (((a / TAU + 1) % 1) * B) | 0;
        }
        for (let b = 0; b < B; b++) {
          ctx.fillStyle = `hsl(${(b / B) * 360},85%,62%)`;
          ctx.beginPath();
          for (let i = 0; i < N; i++) {
            if (bucket[i] !== b) continue;
            const v = Math.hypot(vx[i], vy[i]) + 1e-6;
            tri(ctx, px[i], py[i], vx[i] / v, vy[i] / v, P.size);
          }
          ctx.fill();
        }
        if (ptr) {
          ctx.strokeStyle = P.mode === 'locken' ? '#ffcc3388' : '#ff445588';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(ptr.x, ptr.y, P.mode === 'locken' ? 14 : 30, 0, TAU); ctx.stroke();
        }
        hud.textContent = `${N} Vögel`;
      }

      const stop = Things.loop((dt) => { step(dt); draw(); });
      Things.pointer(stage, {
        down(p) { ptr = p; },
        move(p, e) { if (p.down || e.pointerType === 'mouse') ptr = p; },
        up(p, e) { ptr = e.pointerType === 'mouse' ? p : null; },
      });
      stage.addEventListener('pointerleave', () => { ptr = null; });

      U.select(panel, 'Zeiger', [['flucht', 'Raubvogel (verscheucht)'], ['locken', 'Futter (lockt an)']], P.mode, (v) => (P.mode = v));
      U.slider(panel, 'Anzahl', { min: 50, max: 3000, step: 50, value: P.n, fmt: (v) => v, onChange: (v) => alloc(v) });
      U.heading(panel, 'Regeln');
      U.slider(panel, 'Ausrichtung', { min: 0, max: 3, value: P.align, onInput: (v) => (P.align = v) });
      U.slider(panel, 'Zusammenhalt', { min: 0, max: 3, value: P.coh, onInput: (v) => (P.coh = v) });
      U.slider(panel, 'Abstand', { min: 0, max: 3, value: P.sep, onInput: (v) => (P.sep = v) });
      U.slider(panel, 'Sichtweite', { min: 15, max: 120, step: 1, value: P.r, fmt: (v) => v + ' px', onInput: (v) => (P.r = v) });
      U.heading(panel, 'Darstellung');
      U.slider(panel, 'Tempo', { min: 0.2, max: 3, value: P.speed, fmt: (v) => v.toFixed(1).replace('.', ',') + '×', onInput: (v) => (P.speed = v) });
      U.slider(panel, 'Größe', { min: 0.5, max: 2.5, value: P.size, onInput: (v) => (P.size = v) });
      U.toggle(panel, 'Schweife', P.trails, (v) => (P.trails = v));
      U.hint(panel, 'Jeder Vogel sieht nur seine Nachbarn: in dieselbe Richtung fliegen, zusammenbleiben, nicht ' +
        'zusammenstoßen. Farbe = Flugrichtung. Bewege Maus oder Finger durch den Schwarm.');

      return { destroy() { stop(); S.destroy(); } };
    },
  });

  function tri(c, x, y, dx, dy, s) {
    const L = 7 * s, Bk = 4 * s, Wd = 3.2 * s;
    c.moveTo(x + dx * L, y + dy * L);
    c.lineTo(x - dx * Bk - dy * Wd, y - dy * Bk + dx * Wd);
    c.lineTo(x - dx * Bk + dy * Wd, y - dy * Bk - dx * Wd);
    c.closePath();
  }
})();
