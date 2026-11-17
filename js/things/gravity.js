/* Gravitation – N-Körper-Sandkasten: Planeten schleudern, Umlaufbahnen, Doppelsterne,
   die berühmte Achter-Bahn dreier Sterne. Zusammenstöße verschmelzen die Körper. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const G = 1000, EPS2 = 36;
  const radius = (m) => 2 + Math.cbrt(m) * 1.2;
  const hueOf = (m) => (m >= 200 ? 45 : 210 - Math.log10(m + 1) * 55);

  Things.register({
    id: 'gravitation',
    name: 'Gravitation',
    desc: 'Schleudere Planeten in Umlaufbahnen – oder ins Chaos.',

    thumb(c, w, h) {
      c.fillStyle = '#05060b';
      c.fillRect(0, 0, w, h);
      const R = Things.rng(4);
      for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,255,255,${R() * 0.5})`; c.fillRect(R() * w, R() * h, 1, 1); }
      const cx = w / 2, cy = h / 2;
      [[30, 2], [52, 3.5], [78, 5], [104, 3]].forEach(([r, s], i) => {
        c.strokeStyle = 'rgba(140,170,255,0.25)';
        c.beginPath(); c.ellipse(cx, cy, r * 1.15, r * 0.55, -0.3, 0, TAU); c.stroke();
        const a = 1 + i * 1.7;
        const x = cx + Math.cos(a) * r * 1.15 * Math.cos(-0.3) - Math.sin(a) * r * 0.55 * Math.sin(-0.3);
        const y = cy + Math.cos(a) * r * 1.15 * Math.sin(-0.3) + Math.sin(a) * r * 0.55 * Math.cos(-0.3);
        c.fillStyle = `hsl(${190 - i * 30},80%,65%)`;
        c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
      });
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, 22);
      g.addColorStop(0, '#fff8d0'); g.addColorStop(0.35, '#ffcc33'); g.addColorStop(1, 'rgba(255,150,0,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, 22, 0, TAU); c.fill();
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { speed: 1, mass: 16, auto: true, trails: true, follow: false, preset: 'sonne' };
      let bodies = [], cam = { x: 0, y: 0 }, acc = 0, sub = 0;
      const H = 1 / 240;

      function add(x, y, vx, vy, m) {
        bodies.push({ x, y, vx, vy, m, r: radius(m), hue: hueOf(m), tr: [] });
      }
      function orbitAround(c, x, y, m, dir) {
        const dx = x - c.x, dy = y - c.y, r = Math.hypot(dx, dy) || 1, v = Math.sqrt(G * c.m / r) * (dir || 1);
        add(x, y, c.vx - dy / r * v, c.vy + dx / r * v, m);
      }
      function preset(name) {
        st.preset = name;
        bodies = []; cam = { x: 0, y: 0 };
        const cx = S.w / 2, cy = S.h / 2, sz = Math.min(S.w, S.h);
        if (name === 'sonne') {
          add(cx, cy, 0, 0, 1000);
          const sun = bodies[0];
          [[0.14, 2], [0.22, 5], [0.3, 6], [0.4, 15], [0.49, 4]].forEach(([f, m]) => {
            const a = Math.random() * TAU;
            orbitAround(sun, cx + Math.cos(a) * sz * f, cy + Math.sin(a) * sz * f, m);
          });
          const big = bodies[4], a = Math.random() * TAU;
          orbitAround(big, big.x + Math.cos(a) * 13, big.y + Math.sin(a) * 13, 0.3);
        } else if (name === 'doppel') {
          const d = sz * 0.12, m = 400, v = Math.sqrt(G * m * (d / 2)) / d;
          add(cx - d / 2, cy, 0, -v, m); add(cx + d / 2, cy, 0, v, m);
          const R = sz * 0.36, vp = Math.sqrt(G * 2 * m / R);
          add(cx + R, cy, 0, vp, 3); add(cx - R * 1.2, cy, 0, -vp / Math.sqrt(1.2), 2);
        } else if (name === 'acht') {
          const L = sz * 0.28, M = 300, V = Math.sqrt(G * M / L);
          const px = 0.97000436, py = -0.24308753, vx = -0.93240737, vy = -0.86473146;
          add(cx + px * L, cy + py * L, -vx / 2 * V, -vy / 2 * V, M);
          add(cx - px * L, cy - py * L, -vx / 2 * V, -vy / 2 * V, M);
          add(cx, cy, vx * V, vy * V, M);
        } else if (name === 'galaxie') {
          add(cx, cy, 0, 0, 1500);
          const core = bodies[0];
          for (let i = 0; i < 160; i++) {
            const r = sz * (0.08 + 0.4 * Math.sqrt(Math.random())), a = Math.random() * TAU;
            orbitAround(core, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.2 + Math.random() * 0.6);
          }
        }
      }

      function accel(list) {
        const n = list.length;
        for (const b of list) { b.ax = 0; b.ay = 0; }
        for (let i = 0; i < n; i++) {
          const a = list[i];
          for (let j = i + 1; j < n; j++) {
            const b = list[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy + EPS2;
            const f = G / (d2 * Math.sqrt(d2));
            a.ax += dx * f * b.m; a.ay += dy * f * b.m;
            b.ax -= dx * f * a.m; b.ay -= dy * f * a.m;
          }
        }
      }
      function merge() {
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i], b = bodies[j];
            if (Math.hypot(b.x - a.x, b.y - a.y) > a.r + b.r) continue;
            const big = a.m >= b.m ? a : b, m = a.m + b.m;
            const nb = { x: (a.x * a.m + b.x * b.m) / m, y: (a.y * a.m + b.y * b.m) / m,
              vx: (a.vx * a.m + b.vx * b.m) / m, vy: (a.vy * a.m + b.vy * b.m) / m, m, r: radius(m), hue: hueOf(m), tr: big.tr, flash: 1 };
            bodies[i] = nb;
            bodies.splice(j, 1);
            j = i;
          }
        }
      }
      function com() {
        let m = 0, x = 0, y = 0;
        for (const b of bodies) { m += b.m; x += b.x * b.m; y += b.y * b.m; }
        return m ? [x / m, y / m] : [S.w / 2, S.h / 2];
      }

      // Zielvorschau: Bahn eines Testkörpers im (eingefrorenen) Feld
      function preview(x, y, vx, vy) {
        const pts = [];
        for (let s = 0; s < 500; s++) {
          let ax = 0, ay = 0;
          for (const b of bodies) {
            const dx = b.x - x, dy = b.y - y, d2 = dx * dx + dy * dy + EPS2, f = G * b.m / (d2 * Math.sqrt(d2));
            ax += dx * f; ay += dy * f;
            if (d2 < b.r * b.r) return pts;
          }
          vx += ax / 60; vy += ay / 60; x += vx / 60; y += vy / 60;
          pts.push(x, y);
        }
        return pts;
      }

      let aim = null;
      const world = (p) => ({ x: p.x + cam.x, y: p.y + cam.y });
      function launchVel() { return [(aim.p1.x - aim.p0.x) * 1.5, (aim.p1.y - aim.p0.y) * 1.5]; }
      Things.pointer(stage, {
        down(p) { const w = world(p); aim = { p0: w, p1: w }; },
        move(p) { if (aim && p.down) aim.p1 = world(p); },
        up() {
          if (!aim) return;
          const { p0, p1 } = aim;
          aim = null;
          if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 6 && st.auto && bodies.length) {
            const heavy = bodies.reduce((a, b) => (b.m > a.m ? b : a));
            if (Math.hypot(p0.x - heavy.x, p0.y - heavy.y) > heavy.r + 4) { orbitAround(heavy, p0.x, p0.y, st.mass); return; }
          }
          add(p0.x, p0.y, (p1.x - p0.x) * 1.5, (p1.y - p0.y) * 1.5, st.mass);
        },
      });

      const stop = Things.loop((dt) => {
        acc += dt * st.speed;
        let n = 0;
        while (acc >= H && n < 2000) {
          acc -= H; n++; sub++;
          accel(bodies);
          for (const b of bodies) { b.vx += b.ax * H; b.vy += b.ay * H; b.x += b.vx * H; b.y += b.vy * H; }
          merge();
          if (sub % 4 === 0) for (const b of bodies) { b.tr.push(b.x, b.y); if (b.tr.length > 400) b.tr.splice(0, 2); }
        }
        const far = 5 * Math.max(S.w, S.h), [mx, my] = com();
        bodies = bodies.filter((b) => Math.hypot(b.x - mx, b.y - my) < far);
        if (st.follow) { cam.x = mx - S.w / 2; cam.y = my - S.h / 2; }

        ctx.fillStyle = '#05060b';
        ctx.fillRect(0, 0, S.w, S.h);
        ctx.save();
        ctx.translate(-cam.x, -cam.y);
        if (st.trails) {
          ctx.lineWidth = 1.2;
          for (const b of bodies) {
            const t = b.tr;
            if (t.length < 4) continue;
            ctx.strokeStyle = `hsla(${b.hue},80%,65%,0.35)`;
            ctx.beginPath();
            ctx.moveTo(t[0], t[1]);
            for (let i = 2; i < t.length; i += 2) ctx.lineTo(t[i], t[i + 1]);
            ctx.stroke();
          }
        }
        for (const b of bodies) {
          if (b.m >= 100) {
            const R = b.r * 3, g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R);
            g.addColorStop(0, '#fffbe0'); g.addColorStop(0.3, `hsl(${b.hue},95%,60%)`); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.fill();
          }
          ctx.fillStyle = `hsl(${b.hue},85%,${b.m >= 100 ? 85 : 65}%)`;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
          if (b.flash) {
            ctx.strokeStyle = `rgba(255,255,255,${b.flash})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r + (1 - b.flash) * 30, 0, TAU); ctx.stroke();
            b.flash = Math.max(0, b.flash - dt * 2);
          }
        }
        if (aim) {
          const [vx, vy] = launchVel(), pts = preview(aim.p0.x, aim.p0.y, vx, vy);
          ctx.strokeStyle = 'rgba(255,204,51,0.6)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(aim.p0.x, aim.p0.y);
          for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
          ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(aim.p0.x, aim.p0.y); ctx.lineTo(aim.p1.x, aim.p1.y); ctx.stroke();
          ctx.fillStyle = `hsl(${hueOf(st.mass)},85%,65%)`;
          ctx.beginPath(); ctx.arc(aim.p0.x, aim.p0.y, radius(st.mass), 0, TAU); ctx.fill();
        }
        ctx.restore();
        hud.textContent = `${bodies.length} Körper`;
      });

      U.select(panel, 'Szenario', [['sonne', 'Sonnensystem'], ['doppel', 'Doppelstern'], ['acht', 'Drei Sterne (Achterbahn)'],
        ['galaxie', 'Mini-Galaxie'], ['leer', 'Leerer Raum']], st.preset, (v) => preset(v));
      U.buttons(panel, [['Neu starten', () => preset(st.preset), true], ['Leeren', () => preset('leer')]]);
      U.slider(panel, 'Masse neuer Körper', { min: 0, max: 100, step: 1, value: 40,
        fmt: (v) => { const m = Math.round(Math.pow(10, v / 100 * 3)); return m; }, onInput: (v) => (st.mass = Math.round(Math.pow(10, v / 100 * 3))) });
      U.toggle(panel, 'Antippen = Umlaufbahn', st.auto, (v) => (st.auto = v));
      U.toggle(panel, 'Spuren', st.trails, (v) => (st.trails = v));
      U.toggle(panel, 'Kamera folgt Schwerpunkt', st.follow, (v) => { st.follow = v; if (!v) cam = { x: 0, y: 0 }; });
      U.slider(panel, 'Tempo', { min: 0.1, max: 4, value: st.speed, fmt: (v) => v.toFixed(1).replace('.', ',') + '×', onInput: (v) => (st.speed = v) });
      U.hint(panel, 'Ziehen schleudert einen neuen Körper – die gestrichelte Linie zeigt die voraussichtliche Bahn. Kurz antippen ' +
        'setzt ihn direkt auf eine Kreisbahn um den schwersten Körper. Prallen zwei zusammen, verschmelzen sie. ' +
        'Die „Achterbahn“ ist eine 1993 entdeckte exakte Lösung des Dreikörperproblems – bis kleine Rundungsfehler sie zerstören.');

      preset('sonne');
      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
