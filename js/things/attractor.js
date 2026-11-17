/* Seltsame Attraktoren – tausende Teilchen folgen chaotischen Differentialgleichungen in 3D. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const ATT = {
    lorenz: { name: 'Lorenz', dt: 0.004, start: [1, 1, 20],
      f(x, y, z, o) { o[0] = 10 * (y - x); o[1] = x * (28 - z) - y; o[2] = x * y - (8 / 3) * z; } },
    roessler: { name: 'Rössler', dt: 0.02, start: [1, 1, 0],
      f(x, y, z, o) { o[0] = -y - z; o[1] = x + 0.2 * y; o[2] = 0.2 + z * (x - 5.7); } },
    aizawa: { name: 'Aizawa', dt: 0.01, start: [0.1, 0, 0],
      f(x, y, z, o) {
        o[0] = (z - 0.7) * x - 3.5 * y; o[1] = 3.5 * x + (z - 0.7) * y;
        o[2] = 0.6 + 0.95 * z - z * z * z / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x * x * x;
      } },
    thomas: { name: 'Thomas', dt: 0.05, start: [1.1, 1.1, -0.01],
      f(x, y, z, o) { const b = 0.208186; o[0] = Math.sin(y) - b * x; o[1] = Math.sin(z) - b * y; o[2] = Math.sin(x) - b * z; } },
    halvorsen: { name: 'Halvorsen', dt: 0.006, start: [-1.48, -1.51, 2.04],
      f(x, y, z, o) {
        const a = 1.89;
        o[0] = -a * x - 4 * y - 4 * z - y * y; o[1] = -a * y - 4 * z - 4 * x - z * z; o[2] = -a * z - 4 * x - 4 * y - x * x;
      } },
    dadras: { name: 'Dadras', dt: 0.006, start: [1, 1, 0],
      f(x, y, z, o) { o[0] = y - 3 * x + 2.7 * y * z; o[1] = 1.7 * y - x * z + z; o[2] = 2 * x * y - 9 * z; } },
  };

  const k = [0, 0, 0], m = [0, 0, 0];
  function stepRK2(A, s, i, h) {
    const x = s[i], y = s[i + 1], z = s[i + 2];
    A.f(x, y, z, k);
    A.f(x + k[0] * h / 2, y + k[1] * h / 2, z + k[2] * h / 2, m);
    s[i] = x + m[0] * h; s[i + 1] = y + m[1] * h; s[i + 2] = z + m[2] * h;
  }
  // Bahn vorrechnen: liefert Stichproben auf dem Attraktor + Mittelpunkt + Radius
  function survey(A) {
    const s = new Float64Array(A.start);
    for (let i = 0; i < 4000; i++) stepRK2(A, s, 0, A.dt);
    const n = 6000, pts = new Float64Array(n * 3);
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 6; j++) stepRK2(A, s, 0, A.dt);
      pts[i * 3] = s[0]; pts[i * 3 + 1] = s[1]; pts[i * 3 + 2] = s[2];
      cx += s[0]; cy += s[1]; cz += s[2];
    }
    cx /= n; cy /= n; cz /= n;
    const ds = [];
    for (let i = 0; i < n; i++) ds.push(Math.hypot(pts[i * 3] - cx, pts[i * 3 + 1] - cy, pts[i * 3 + 2] - cz));
    ds.sort((a, b) => a - b);
    return { pts, n, c: [cx, cy, cz], rad: ds[Math.floor(n * 0.985)] || 1 };
  }

  Things.register({
    id: 'attraktor',
    name: 'Seltsame Attraktoren',
    desc: 'Lorenz & Co.: Ordnung im Chaos, in 3D zum Drehen.',

    thumb(c, w, h) {
      c.fillStyle = '#05050a';
      c.fillRect(0, 0, w, h);
      const A = ATT.lorenz, s = new Float64Array([1, 1, 20]), sc = h / 62;
      c.globalCompositeOperation = 'lighter';
      c.lineWidth = 0.8;
      for (let i = 0; i < 300; i++) stepRK2(A, s, 0, 0.005);
      for (let seg = 0; seg < 60; seg++) {
        c.strokeStyle = `hsla(${190 + seg * 2.5},90%,60%,0.7)`;
        c.beginPath();
        for (let i = 0; i < 80; i++) {
          stepRK2(A, s, 0, 0.005);
          c.lineTo(w / 2 + (s[0] * 0.8 + s[1] * 0.4) * sc, h * 0.93 - s[2] * sc * 1.1);
        }
        c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { type: 'lorenz', n: 6000, speed: 2, fade: 0.18, auto: true, mono: false, size: 1.4 };
      let A, info, s, yaw = 0.6, pitch = 0.25, zoom = 1, buckets = 12;

      function init() {
        A = ATT[st.type];
        info = survey(A);
        s = new Float64Array(st.n * 3);
        for (let i = 0; i < st.n; i++) spawn(i);
        ctx.fillStyle = '#05050a';
        ctx.fillRect(0, 0, S.w, S.h);
      }
      function spawn(i) {
        const j = Math.floor(Math.random() * info.n) * 3, e = info.rad * 0.002;
        s[i * 3] = info.pts[j] + (Math.random() - 0.5) * e;
        s[i * 3 + 1] = info.pts[j + 1] + (Math.random() - 0.5) * e;
        s[i * 3 + 2] = info.pts[j + 2] + (Math.random() - 0.5) * e;
      }
      function resize(n) {
        const old = s, on = old.length / 3;
        s = new Float64Array(n * 3);
        s.set(old.subarray(0, Math.min(on, n) * 3));
        st.n = n;
        for (let i = on; i < n; i++) spawn(i);
      }

      const stop = Things.loop((dt) => {
        if (st.auto && !dragging) yaw += dt * 0.25;
        const h = A.dt, [cx, cy, cz] = info.c, lim = info.rad * 8;
        for (let r = 0; r < st.speed; r++) {
          for (let i = 0; i < st.n; i++) {
            stepRK2(A, s, i * 3, h);
            const X = s[i * 3] - cx, Y = s[i * 3 + 1] - cy, Z = s[i * 3 + 2] - cz;
            if (!(Math.abs(X) + Math.abs(Y) + Math.abs(Z) < lim)) spawn(i);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(5,5,10,${st.fade})`;
        ctx.fillRect(0, 0, S.w, S.h);
        ctx.globalCompositeOperation = 'lighter';
        const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
        const sc = Math.min(S.w, S.h) * 0.43 / info.rad * zoom, ox = S.w / 2, oy = S.h / 2;
        const ir = 1 / info.rad, sz = st.size, hs = sz / 2;
        for (let b = 0; b < buckets; b++) {
          ctx.fillStyle = st.mono ? 'rgba(170,200,255,0.5)' : `hsla(${(b / buckets) * 300 + 180},90%,60%,0.5)`;
          for (let i = b; i < st.n; i += buckets) {
            const X = s[i * 3] - cx, Y = s[i * 3 + 1] - cy, Z = s[i * 3 + 2] - cz;
            const x1 = X * cyw - Y * syw, y1 = X * syw + Y * cyw;
            const y2 = y1 * cp - Z * sp, z2 = y1 * sp + Z * cp;
            const pr = 1 / (1 + y2 * ir * 0.25);
            ctx.fillRect(ox + x1 * sc * pr - hs, oy - z2 * sc * pr - hs, sz, sz);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        hud.textContent = `${A.name}   ${st.n} Teilchen`;
      });

      // Drehen (ziehen), Zoomen (Mausrad / zwei Finger)
      let dragging = false, last = null, pinch = 0;
      Things.pointer(stage, {
        down(p, e, pts) { dragging = true; last = p; if (pts.size === 2) pinch = dist(pts); },
        move(p, e, pts) {
          if (!p.down) return;
          if (pts.size >= 2) {
            const d = dist(pts);
            if (pinch) zoom = Math.max(0.3, Math.min(5, zoom * d / pinch));
            pinch = d;
            return;
          }
          if (last && last.id === p.id) {
            yaw -= (p.x - last.x) * 0.008;
            pitch = Math.max(-1.5, Math.min(1.5, pitch + (p.y - last.y) * 0.008));
          }
          last = p;
        },
        up(p, e, pts) { pinch = 0; if (pts.size === 0) { dragging = false; last = null; } },
        wheel(d) { zoom = Math.max(0.3, Math.min(5, zoom * Math.exp(-d * 0.001))); },
      });
      function dist(pts) { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }

      U.select(panel, 'Attraktor', Object.entries(ATT).map(([k, v]) => [k, v.name]), st.type, (v) => { st.type = v; zoom = 1; init(); });
      U.slider(panel, 'Teilchen', { min: 500, max: 30000, step: 500, value: st.n, fmt: (v) => v, onChange: (v) => resize(v) });
      U.slider(panel, 'Tempo', { min: 1, max: 6, step: 1, value: st.speed, fmt: (v) => v + '×', onInput: (v) => (st.speed = v) });
      U.slider(panel, 'Schweif', { min: 0, max: 1, value: 1 - st.fade, fmt: (v) => Math.round(v * 100) + ' %',
        onInput: (v) => (st.fade = Math.max(0.01, 1 - v)) });
      U.slider(panel, 'Punktgröße', { min: 0.6, max: 3, value: st.size, onInput: (v) => (st.size = v) });
      U.toggle(panel, 'Automatisch drehen', st.auto, (v) => (st.auto = v));
      U.toggle(panel, 'Einfarbig', st.mono, (v) => (st.mono = v));
      U.buttons(panel, [['Neu verteilen', () => init(), true], ['Bild speichern', () => Things.saveCanvas(S.cv, `attraktor-${st.type}.png`)]]);
      U.hint(panel, 'Ziehen dreht die Ansicht, Mausrad oder zwei Finger zoomen. Jedes Teilchen folgt denselben ' +
        'Gleichungen – trotzdem landen alle auf derselben, unendlich verschachtelten Form.');

      init();
      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
