/* Wasser – Partikel-Flüssigkeit nach Clavet et al. ("Particle-based Viscoelastic Fluid Simulation", 2005):
   Doppel-Dichte-Relaxation, Viskositätsimpulse, räumliches Gitter. Kippen per Regler oder Handy-Lagesensor. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const MAX = 4000;

  Things.register({
    id: 'wasser',
    name: 'Wasser',
    desc: 'Tausende Tröpfchen: Dammbruch, Wellen, Spritzer – kipp das Handy.',

    thumb(c, w, h) {
      c.fillStyle = '#0b0b10';
      c.fillRect(0, 0, w, h);
      const R = Things.rng(6);
      for (let i = 0; i < 900; i++) {
        const x = R() * w, base = h * 0.62 + Math.sin(x / w * 7) * h * 0.08 - (x < w * 0.35 ? h * 0.18 * (1 - x / (w * 0.35)) : 0);
        const y = base + R() * (h - base);
        const s = Math.max(0, 1 - (y - base) / 25);
        c.fillStyle = `hsl(${205 - s * 15},85%,${45 + s * 35}%)`;
        c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
      }
      for (let i = 0; i < 40; i++) {
        c.fillStyle = 'hsl(195,90%,82%)';
        c.beginPath(); c.arc(w * 0.3 + R() * w * 0.2, h * 0.3 + R() * h * 0.25, 2.5, 0, TAU); c.fill();
      }
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { h: 16, k: 0.5, kn: 1.2, rho0: 2.6, visc: 0.12, g: 0.08, angle: 0, tilt: false, faucet: false, steps: 2, size: 1 };
      const x = new Float32Array(MAX), y = new Float32Array(MAX), px = new Float32Array(MAX), py = new Float32Array(MAX);
      const vx = new Float32Array(MAX), vy = new Float32Array(MAX), next = new Int32Array(MAX), bucket = new Uint8Array(MAX);
      const dens = new Float32Array(MAX);
      const nbI = new Int32Array(256), nbQ = new Float32Array(256);
      let n = 0, head = null, cols = 0, rows = 0, tiltG = null;

      function add(X, Y, VX, VY) {
        if (n >= MAX) return;
        x[n] = X; y[n] = Y; vx[n] = VX || 0; vy[n] = VY || 0; n++;
      }
      function block(x0, y0, x1, y1) {
        const s = st.h * 0.5;
        for (let yy = y1; yy > y0; yy -= s) for (let xx = x0; xx < x1; xx += s) add(xx + Math.random() * 0.5, yy);
      }
      function preset(name) {
        n = 0;
        const W = S.w, H = S.h;
        if (name === 'damm') block(8, H * 0.25, W * 0.38, H - 8);
        else if (name === 'tropfen') {
          block(8, H * 0.72, W - 8, H - 8);
          const r = Math.min(W, H) * 0.12, cx = W / 2, cy = H * 0.25, s = st.h * 0.5;
          for (let yy = cy - r; yy < cy + r; yy += s) for (let xx = cx - r; xx < cx + r; xx += s)
            if (Math.hypot(xx - cx, yy - cy) < r) add(xx, yy);
        } else if (name === 'becken') block(8, H * 0.55, W - 8, H - 8);
        // Begrenzung auf Leistung: zu viele Partikel ausdünnen
        if (n > 2600) { for (let i = 0; i < n; i += 2) { const j = i >> 1; x[j] = x[i]; y[j] = y[i]; vx[j] = 0; vy[j] = 0; } n = n >> 1; }
      }

      function grid() {
        const hh = st.h;
        cols = Math.ceil(S.w / hh) + 1; rows = Math.ceil(S.h / hh) + 1;
        if (!head || head.length < cols * rows) head = new Int32Array(cols * rows);
        head.fill(-1, 0, cols * rows);
        for (let i = 0; i < n; i++) {
          let gx = (x[i] / hh) | 0, gy = (y[i] / hh) | 0;
          gx = gx < 0 ? 0 : gx >= cols ? cols - 1 : gx;
          gy = gy < 0 ? 0 : gy >= rows ? rows - 1 : gy;
          const c = gy * cols + gx;
          next[i] = head[c]; head[c] = i;
        }
      }
      // Nachbarn von i im Radius h sammeln (gibt Anzahl zurück)
      function neighbors(i) {
        const hh = st.h, h2 = hh * hh, gx = (x[i] / hh) | 0, gy = (y[i] / hh) | 0;
        let m = 0;
        for (let oy = -1; oy <= 1; oy++) {
          const yy = gy + oy;
          if (yy < 0 || yy >= rows) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const xx = gx + ox;
            if (xx < 0 || xx >= cols) continue;
            for (let j = head[yy * cols + xx]; j !== -1; j = next[j]) {
              if (j === i) continue;
              const dx = x[j] - x[i], dy = y[j] - y[i], d2 = dx * dx + dy * dy;
              if (d2 >= h2 || d2 < 1e-6) continue;
              nbI[m] = j; nbQ[m] = Math.sqrt(d2) / hh;
              if (++m === 256) return m;
            }
          }
        }
        return m;
      }

      let ptr = null, ptrLast = null, pvx = 0, pvy = 0;
      function step() {
        let gx = Math.sin(st.angle * Math.PI / 180) * st.g, gy = Math.cos(st.angle * Math.PI / 180) * st.g;
        if (st.tilt && tiltG) { gx = tiltG[0] * st.g; gy = tiltG[1] * st.g; }
        const hh = st.h;
        for (let i = 0; i < n; i++) { vx[i] += gx; vy[i] += gy; }
        // Zeiger rührt
        if (ptr) {
          const R = 70, R2 = R * R;
          for (let i = 0; i < n; i++) {
            const dx = x[i] - ptr.x, dy = y[i] - ptr.y, d2 = dx * dx + dy * dy;
            if (d2 > R2) continue;
            const w = 1 - Math.sqrt(d2) / R;
            vx[i] += (pvx - vx[i]) * 0.25 * w; vy[i] += (pvy - vy[i]) * 0.25 * w;
          }
        }
        // Viskosität (Impulse zwischen Nachbarn)
        grid();
        if (st.visc > 0) {
          for (let i = 0; i < n; i++) {
            const m = neighbors(i);
            for (let a = 0; a < m; a++) {
              const j = nbI[a]; if (j < i) continue;
              const q = nbQ[a], r = q * hh, ux = (x[j] - x[i]) / r, uy = (y[j] - y[i]) / r;
              const inward = (vx[i] - vx[j]) * ux + (vy[i] - vy[j]) * uy;
              if (inward <= 0) continue;
              const I = (1 - q) * (st.visc * inward + 0.02 * inward * inward) * 0.5;
              vx[i] -= I * ux; vy[i] -= I * uy; vx[j] += I * ux; vy[j] += I * uy;
            }
          }
        }
        for (let i = 0; i < n; i++) { px[i] = x[i]; py[i] = y[i]; x[i] += vx[i]; y[i] += vy[i]; }
        // Doppel-Dichte-Relaxation
        grid();
        const lim = hh * 0.2;
        for (let i = 0; i < n; i++) {
          const m = neighbors(i);
          let rho = 0, rhoN = 0;
          for (let a = 0; a < m; a++) { const t = 1 - nbQ[a]; rho += t * t; rhoN += t * t * t; }
          dens[i] = rho;
          const P = st.k * (rho - st.rho0), PN = st.kn * rhoN;
          let dxi = 0, dyi = 0;
          for (let a = 0; a < m; a++) {
            const j = nbI[a], q = nbQ[a], t = 1 - q, r = q * hh;
            let D = (P * t + PN * t * t) * 0.5;
            if (D > lim) D = lim; else if (D < -lim) D = -lim;
            const ux = (x[j] - x[i]) / r, uy = (y[j] - y[i]) / r;
            x[j] += D * ux; y[j] += D * uy; dxi -= D * ux; dyi -= D * uy;
          }
          x[i] += dxi; y[i] += dyi;
        }
        // Wände
        const r0 = 3, W = S.w - r0, H = S.h - r0;
        for (let i = 0; i < n; i++) {
          if (x[i] < r0) x[i] = r0 + Math.random() * 0.1; else if (x[i] > W) x[i] = W - Math.random() * 0.1;
          if (y[i] < r0) y[i] = r0 + Math.random() * 0.1; else if (y[i] > H) y[i] = H - Math.random() * 0.1;
          let nvx = x[i] - px[i], nvy = y[i] - py[i];
          const sp = nvx * nvx + nvy * nvy;
          if (sp > 144) { const f = 12 / Math.sqrt(sp); nvx *= f; nvy *= f; }
          vx[i] = nvx; vy[i] = nvy;
        }
      }

      const B = 10;
      const stop = Things.loop(() => {
        if (st.faucet && n < MAX) for (let k = 0; k < 3; k++) add(S.w * 0.5 + (Math.random() - 0.5) * st.h, 12, (Math.random() - 0.5) * 0.3, 3);
        if (ptr && ptrLast) { pvx = (ptr.x - ptrLast.x) / st.steps; pvy = (ptr.y - ptrLast.y) / st.steps; }
        else { pvx = 0; pvy = 0; }
        ptrLast = ptr;
        for (let s = 0; s < st.steps; s++) step();

        ctx.fillStyle = '#0b0b10';
        ctx.fillRect(0, 0, S.w, S.h);
        for (let i = 0; i < n; i++) {
          // hell = schnell oder an der Oberfläche (wenige Nachbarn) -> Schaum
          const sp = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]), surf = Math.max(0, st.rho0 * 0.95 - dens[i]);
          bucket[i] = Math.min(B - 1, (sp * 1.3 + surf * 3.5) | 0);
        }
        const rad = st.h * 0.42 * st.size;
        for (let b = 0; b < B; b++) {
          const f = b / (B - 1);
          ctx.fillStyle = `hsl(${208 - f * 18},${85 - f * 25}%,${42 + f * 45}%)`;
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            if (bucket[i] !== b) continue;
            ctx.moveTo(x[i] + rad, y[i]);
            ctx.arc(x[i], y[i], rad, 0, TAU);
          }
          ctx.fill();
        }
        if (ptr) { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 70, 0, TAU); ctx.stroke(); }
        hud.textContent = `${n} Tropfen`;
      });

      Things.pointer(stage, {
        down(p) { ptr = p; ptrLast = p; },
        move(p) { if (p.down) ptr = p; },
        up() { ptr = null; ptrLast = null; },
      });

      // Handy-Lagesensor
      function onTilt(e) {
        if (e.gamma == null) return;
        const a = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
        let gxx = Math.sin(e.gamma * Math.PI / 180), gyy = Math.sin(e.beta * Math.PI / 180);
        if (a === 90) [gxx, gyy] = [gyy, -gxx]; else if (a === -90 || a === 270) [gxx, gyy] = [-gyy, gxx];
        const l = Math.hypot(gxx, gyy) || 1;
        tiltG = [gxx / Math.max(0.35, l), gyy / Math.max(0.35, l)];
      }
      async function enableTilt(on) {
        st.tilt = on;
        if (!on) { window.removeEventListener('deviceorientation', onTilt); return; }
        try {
          if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
            const r = await DeviceOrientationEvent.requestPermission();
            if (r !== 'granted') { tiltBox.checked = false; st.tilt = false; return; }
          }
          window.addEventListener('deviceorientation', onTilt);
        } catch (_) { tiltBox.checked = false; st.tilt = false; }
      }

      U.select(panel, 'Szene', [['damm', 'Dammbruch'], ['tropfen', 'Tropfen ins Becken'], ['becken', 'Ruhiges Becken'], ['leer', 'Leer']], 'damm', (v) => preset(v));
      U.toggle(panel, 'Wasserhahn', st.faucet, (v) => (st.faucet = v));
      const tiltBox = U.toggle(panel, 'Handy neigen (Lagesensor)', st.tilt, (v) => enableTilt(v));
      U.slider(panel, 'Schwerkraft-Richtung', { min: -180, max: 180, step: 1, value: st.angle, fmt: (v) => v + '°', onInput: (v) => (st.angle = v) });
      U.slider(panel, 'Schwerkraft', { min: 0, max: 0.25, step: 0.005, value: st.g, fmt: (v) => Math.round(v / 0.08 * 100) + ' %', onInput: (v) => (st.g = v) });
      U.slider(panel, 'Zähigkeit', { min: 0, max: 1, value: st.visc, onInput: (v) => (st.visc = v) });
      U.slider(panel, 'Druck', { min: 0.05, max: 0.8, value: st.k, onInput: (v) => (st.k = v) });
      U.slider(panel, 'Tropfengröße', { min: 0.5, max: 1.6, value: st.size, onInput: (v) => (st.size = v) });
      U.hint(panel, 'Mit dem Finger rühren und schieben. Auf dem Handy „Handy neigen“ einschalten und das Gerät kippen. ' +
        'Jeder Tropfen kennt nur seine Nachbarn: Ist es ihm zu eng, schiebt er sie weg – daraus entstehen Wellen und Spritzer.');

      preset('damm');
      return { destroy() { stop(); S.destroy(); window.removeEventListener('deviceorientation', onTilt); } };
    },
  });
})();
