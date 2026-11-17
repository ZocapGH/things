/* Tinte & Rauch – Gitter-Flüssigkeit nach Jos Stams "Stable Fluids":
   Semi-Lagrange-Advektion, Druckprojektion (Gauß-Seidel), Wirbelverstärkung, Auftrieb. */
(function () {
  'use strict';

  Things.register({
    id: 'tinte',
    name: 'Tinte & Rauch',
    desc: 'Rühr mit dem Finger in einer wirbelnden Flüssigkeit.',

    thumb(c, w, h) {
      const cv = c.canvas, W = cv.width, H = cv.height, img = c.createImageData(W, H), d = img.data;
      // gemalte Wirbel: verdrehte Farbbänder
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const nx = x / W - 0.5, ny = y / H - 0.5, r = Math.hypot(nx * 1.6, ny), a = Math.atan2(ny, nx * 1.6) + 6 * Math.exp(-r * 4);
        const v1 = Math.max(0, Math.sin(a * 2 + r * 9)) * Math.exp(-r * 2.2);
        const v2 = Math.max(0, Math.sin(a * 2 + r * 9 + 2.5)) * Math.exp(-r * 2.2);
        const o = (y * W + x) * 4;
        d[o] = 255 * (1 - Math.exp(-(v1 * 2.6 + v2 * 0.3)));
        d[o + 1] = 255 * (1 - Math.exp(-(v1 * 0.5 + v2 * 0.9)));
        d[o + 2] = 255 * (1 - Math.exp(-(v2 * 2.8 + v1 * 0.2)));
        d[o + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage, { raw: true });
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { cell: 6, vort: 25, fade: 0.4, buoy: false, jets: true, color: 'regenbogen', brush: 3, iters: 20 };
      let W, H, SX, u, v, u0, v0, p, dv, curl, R, G, B, R0, G0, B0, img, time = 0;
      const buf = document.createElement('canvas'), bctx = buf.getContext('2d');

      function setup() {
        W = Math.max(24, Math.floor(S.w / st.cell)); H = Math.max(24, Math.floor(S.h / st.cell));
        SX = W + 2;
        const n = SX * (H + 2), F = () => new Float32Array(n);
        u = F(); v = F(); u0 = F(); v0 = F(); p = F(); dv = F(); curl = F();
        R = F(); G = F(); B = F(); R0 = F(); G0 = F(); B0 = F();
        buf.width = W; buf.height = H;
        img = bctx.createImageData(W, H);
      }
      S.onresize = setup;

      function bnd(b, x) {
        for (let i = 1; i <= W; i++) {
          x[i] = b === 2 ? -x[i + SX] : x[i + SX];
          x[i + (H + 1) * SX] = b === 2 ? -x[i + H * SX] : x[i + H * SX];
        }
        for (let j = 1; j <= H; j++) {
          x[j * SX] = b === 1 ? -x[1 + j * SX] : x[1 + j * SX];
          x[W + 1 + j * SX] = b === 1 ? -x[W + j * SX] : x[W + j * SX];
        }
        x[0] = 0.5 * (x[1] + x[SX]);
        x[W + 1] = 0.5 * (x[W] + x[W + 1 + SX]);
        x[(H + 1) * SX] = 0.5 * (x[1 + (H + 1) * SX] + x[H * SX]);
        x[W + 1 + (H + 1) * SX] = 0.5 * (x[W + (H + 1) * SX] + x[W + 1 + H * SX]);
      }
      function advect(b, d, d0, uu, vv, dt) {
        for (let j = 1; j <= H; j++) {
          for (let i = 1; i <= W; i++) {
            const k = i + j * SX;
            let x = i - dt * uu[k], y = j - dt * vv[k];
            x = x < 0.5 ? 0.5 : x > W + 0.5 ? W + 0.5 : x;
            y = y < 0.5 ? 0.5 : y > H + 0.5 ? H + 0.5 : y;
            const i0 = x | 0, j0 = y | 0, s1 = x - i0, s0 = 1 - s1, t1 = y - j0, t0 = 1 - t1, a = i0 + j0 * SX;
            d[k] = s0 * (t0 * d0[a] + t1 * d0[a + SX]) + s1 * (t0 * d0[a + 1] + t1 * d0[a + 1 + SX]);
          }
        }
        bnd(b, d);
      }
      function project() {
        for (let j = 1; j <= H; j++) for (let i = 1; i <= W; i++) {
          const k = i + j * SX;
          dv[k] = -0.5 * (u[k + 1] - u[k - 1] + v[k + SX] - v[k - SX]);
          p[k] = 0;
        }
        bnd(0, dv); bnd(0, p);
        for (let it = 0; it < st.iters; it++) {
          for (let j = 1; j <= H; j++) for (let i = 1; i <= W; i++) {
            const k = i + j * SX;
            p[k] = (dv[k] + p[k - 1] + p[k + 1] + p[k - SX] + p[k + SX]) * 0.25;
          }
          bnd(0, p);
        }
        for (let j = 1; j <= H; j++) for (let i = 1; i <= W; i++) {
          const k = i + j * SX;
          u[k] -= 0.5 * (p[k + 1] - p[k - 1]);
          v[k] -= 0.5 * (p[k + SX] - p[k - SX]);
        }
        bnd(1, u); bnd(2, v);
      }
      function vorticity(dt) {
        if (st.vort <= 0) return;
        for (let j = 1; j <= H; j++) for (let i = 1; i <= W; i++) {
          const k = i + j * SX;
          curl[k] = 0.5 * ((v[k + 1] - v[k - 1]) - (u[k + SX] - u[k - SX]));
        }
        for (let j = 2; j < H; j++) for (let i = 2; i < W; i++) {
          const k = i + j * SX;
          const ny = Math.abs(curl[k + SX]) - Math.abs(curl[k - SX]), nx = Math.abs(curl[k + 1]) - Math.abs(curl[k - 1]);
          const len = Math.sqrt(nx * nx + ny * ny) + 1e-5, c = curl[k] * st.vort * dt;
          u[k] += (ny / len) * c;
          v[k] -= (nx / len) * c;
        }
      }
      // Gauß-Klecks: Geschwindigkeit + Farbe
      function splat(cx, cy, fx, fy, col, rad) {
        const r2 = rad * rad, ext = Math.ceil(rad * 2.5);
        for (let y = Math.max(1, (cy - ext) | 0); y <= Math.min(H, (cy + ext) | 0); y++) {
          for (let x = Math.max(1, (cx - ext) | 0); x <= Math.min(W, (cx + ext) | 0); x++) {
            const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy), w = Math.exp(-d2 / r2);
            if (w < 0.01) continue;
            const k = x + y * SX;
            u[k] += fx * w; v[k] += fy * w;
            if (col) { R[k] += col[0] * w; G[k] += col[1] * w; B[k] += col[2] * w; }
          }
        }
      }
      function dyeColor(h) {
        let c;
        if (st.color === 'feuer') c = Things.hsl(15 + 30 * Math.sin(h * 0.02), 1, 0.5);
        else c = Things.hsl(h, 1, 0.5);
        c = [c[0] / 255, c[1] / 255, c[2] / 255];
        if (st.color === 'tinte') c = [1 - c[0], 1 - c[1], 1 - c[2]];
        return c;
      }

      // Zeiger (mehrere Finger gleichzeitig)
      const last = new Map();
      Things.pointer(stage, {
        down(p) { last.set(p.id, p); },
        move(p) {
          if (!p.down) return;
          const l = last.get(p.id);
          if (l) {
            const k = st.cell, dx = (p.x - l.x) / k, dy = (p.y - l.y) / k;
            const col = dyeColor(time * 110 + p.id * 140).map((x) => x * 0.32);
            const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
            for (let s = 1; s <= steps; s++) {
              splat(l.x / k + dx * s / steps + 1, l.y / k + dy * s / steps + 1, dx * 30 / steps, dy * 30 / steps, col.map((x) => x / steps), st.brush);
            }
          }
          last.set(p.id, p);
        },
        up(p) { last.delete(p.id); },
      });

      const stop = Things.loop((dt) => {
        dt = 1 / 60;
        time += dt;
        if (st.jets) {
          const a = Math.sin(time * 0.9) * 0.6, sp = 70;
          splat(W * 0.22, H - 3, Math.sin(0.6 + a) * sp * 0.2, -Math.cos(0.6 + a) * sp * 0.2, dyeColor(time * 30).map((x) => x * 0.35), 2.5);
          splat(W * 0.78, H - 3, -Math.sin(0.6 - a) * sp * 0.2, -Math.cos(0.6 - a) * sp * 0.2, dyeColor(time * 30 + 180).map((x) => x * 0.35), 2.5);
        }
        if (st.buoy) {
          for (let j = 1; j <= H; j++) for (let i = 1; i <= W; i++) {
            const k = i + j * SX;
            v[k] -= (R[k] + G[k] + B[k]) * 6 * dt;
          }
        }
        vorticity(dt);
        project();
        u0.set(u); v0.set(v);
        advect(1, u, u0, u0, v0, dt);
        advect(2, v, v0, u0, v0, dt);
        project();
        R0.set(R); G0.set(G); B0.set(B);
        advect(0, R, R0, u, v, dt); advect(0, G, G0, u, v, dt); advect(0, B, B0, u, v, dt);
        const f = Math.pow(1 - st.fade * 0.02, 1), vf = 0.999;
        for (let k = 0; k < R.length; k++) { R[k] *= f; G[k] *= f; B[k] *= f; u[k] *= vf; v[k] *= vf; }

        // Darstellung
        const d = img.data, ink = st.color === 'tinte';
        for (let j = 1, o = 0; j <= H; j++) {
          for (let i = 1; i <= W; i++, o += 4) {
            const k = i + j * SX;
            if (ink) {
              d[o] = 250 * Math.exp(-R[k] * 1.6); d[o + 1] = 246 * Math.exp(-G[k] * 1.6); d[o + 2] = 238 * Math.exp(-B[k] * 1.6);
            } else {
              d[o] = 255 * (1 - Math.exp(-R[k] * 1.5)); d[o + 1] = 255 * (1 - Math.exp(-G[k] * 1.5)); d[o + 2] = 255 * (1 - Math.exp(-B[k] * 1.5));
            }
            d[o + 3] = 255;
          }
        }
        bctx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(buf, 0, 0, S.cv.width, S.cv.height);
        hud.textContent = `${W} × ${H} Zellen`;
      });

      U.buttons(panel, [
        ['Leeren', () => { for (const a of [u, v, R, G, B]) a.fill(0); }, true],
        ['Bild speichern', () => Things.saveCanvas(S.cv, `tinte-${Date.now()}.png`)],
      ]);
      U.select(panel, 'Farbe', [['regenbogen', 'Regenbogen (leuchtend)'], ['feuer', 'Feuer'], ['tinte', 'Tinte auf Papier']], st.color, (x) => (st.color = x));
      U.toggle(panel, 'Düsen', st.jets, (x) => (st.jets = x));
      U.toggle(panel, 'Auftrieb (Rauch steigt)', st.buoy, (x) => (st.buoy = x));
      U.slider(panel, 'Wirbel', { min: 0, max: 80, step: 1, value: st.vort, fmt: (x) => x, onInput: (x) => (st.vort = x) });
      U.slider(panel, 'Verblassen', { min: 0, max: 2, value: st.fade, onInput: (x) => (st.fade = x) });
      U.slider(panel, 'Pinselgröße', { min: 1.5, max: 10, value: st.brush, onInput: (x) => (st.brush = x) });
      U.slider(panel, 'Auflösung', { min: 3, max: 12, step: 1, value: st.cell, fmt: (x) => (x <= 4 ? 'fein' : x <= 7 ? 'mittel' : 'grob') + ` (${x} px)`,
        onChange: (x) => { st.cell = x; setup(); } });
      U.hint(panel, 'Zieh mit einem oder mehreren Fingern durchs Bild. Die Flüssigkeit ist inkompressibel: Was du ' +
        'wegschiebst, muss woanders hin – so entstehen Wirbel. „Wirbel“ verstärkt kleine Strudel, die beim Rechnen sonst verloren gingen.');

      setup();
      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
