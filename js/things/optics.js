/* Lichtstrahlen – 2D-Raytracing mit Brechung (Snellius), Dispersion (Cauchy), Totalreflexion,
   Fresnel-Teilreflexion und Spiegeln. Prismen, Linsen, Blöcke und Spiegel lassen sich verschieben und drehen. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  function wl2rgb(w) {
    let r = 0, g = 0, b = 0;
    if (w < 440) { r = -(w - 440) / 60; b = 1; }
    else if (w < 490) { g = (w - 440) / 50; b = 1; }
    else if (w < 510) { g = 1; b = -(w - 510) / 20; }
    else if (w < 580) { r = (w - 510) / 70; g = 1; }
    else if (w < 645) { r = 1; g = -(w - 645) / 65; }
    else r = 1;
    const f = w < 420 ? 0.3 + 0.7 * (w - 380) / 40 : w > 700 ? 0.3 + 0.7 * (780 - w) / 80 : 1;
    return [Math.round(r * f * 255), Math.round(g * f * 255), Math.round(b * f * 255)];
  }
  const LIGHTS = {
    weiss: { name: 'Weißes Licht', wl: (() => { const a = []; for (let w = 400; w <= 700; w += 15) a.push(w); return a; })() },
    rot: { name: 'Laser rot', wl: [650] }, gruen: { name: 'Laser grün', wl: [532] }, blau: { name: 'Laser blau', wl: [450] },
  };

  function shape(type) {
    const P = [];
    if (type === 'prisma') { const s = 130; P.push(0, -s / Math.sqrt(3), s / 2, s / (2 * Math.sqrt(3)), -s / 2, s / (2 * Math.sqrt(3))); }
    else if (type === 'block') P.push(-170, -20, 170, -20, 170, 20, -170, 20);
    else if (type === 'linse' || type === 'zerstreu') {
      const h = 75, R = 140, n = 22, bulge = (y) => Math.sqrt(R * R - y * y) - Math.sqrt(R * R - h * h);
      const xr = type === 'linse' ? (y) => bulge(y) : (y) => 7 + (R - Math.sqrt(R * R - y * y));
      for (let i = 0; i <= n; i++) { const y = -h + 2 * h * i / n; P.push(xr(y), y); }
      for (let i = 0; i <= n; i++) { const y = h - 2 * h * i / n; P.push(-xr(y), y); }
    } else if (type === 'spiegel') P.push(-75, 0, 75, 0);
    return P;
  }

  Things.register({
    id: 'licht',
    name: 'Lichtstrahlen',
    desc: 'Prismen, Linsen, Spiegel – und weißes Licht wird zum Regenbogen.',

    thumb(c, w, h) {
      c.fillStyle = '#05050a';
      c.fillRect(0, 0, w, h);
      const px = w * 0.5, py = h * 0.55, s = h * 0.55;
      const A = [px, py - s * 0.58], B = [px + s / 2, py + s * 0.29], C = [px - s / 2, py + s * 0.29];
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2;
      const hit = [px - s * 0.2, py - s * 0.05];
      c.beginPath(); c.moveTo(0, h * 0.62); c.lineTo(hit[0], hit[1]); c.stroke();
      for (let i = 0; i < 14; i++) {
        const col = wl2rgb(400 + i * 22), a = -0.05 + i * 0.022;
        c.strokeStyle = `rgba(${col},0.8)`;
        c.beginPath(); c.moveTo(hit[0], hit[1]); c.lineTo(px + s * 0.22, py + s * 0.02 + i * 1.2);
        c.lineTo(w, py + s * 0.02 + (w - px) * Math.tan(0.25 + a)); c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = 'rgba(160,200,255,0.18)'; c.strokeStyle = 'rgba(200,225,255,0.6)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(C[0], C[1]); c.closePath(); c.fill(); c.stroke();
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { light: 'weiss', beam: 'einzel', n: 1.5, disp: 0.018 };
      let objs = [], src = { x: 0, y: 0, a: 0 }, sel = null, dirty = true, segCount = 0;

      function add(type, x, y, a) {
        const o = { type, x, y, a: a || 0, local: shape(type), world: null, sign: 1 };
        objs.push(o); sel = o; update(o); dirty = true;
        return o;
      }
      function update(o) {
        const c = Math.cos(o.a), s = Math.sin(o.a), L = o.local, W = new Float32Array(L.length);
        for (let i = 0; i < L.length; i += 2) { W[i] = o.x + L[i] * c - L[i + 1] * s; W[i + 1] = o.y + L[i] * s + L[i + 1] * c; }
        o.world = W;
        let A = 0;
        for (let i = 0; i < W.length; i += 2) { const j = (i + 2) % W.length; A += W[i] * W[j + 1] - W[j] * W[i + 1]; }
        o.sign = A > 0 ? 1 : -1;
      }
      function preset(name) {
        objs = []; sel = null;
        const w = S.w, h = S.h;
        if (name === 'prisma') { src = { x: w * 0.08, y: h * 0.62, a: -0.2 }; add('prisma', w * 0.45, h * 0.52, 0); st.light = 'weiss'; st.beam = 'einzel'; }
        else if (name === 'linsen') { src = { x: w * 0.08, y: h * 0.55, a: 0 }; add('linse', w * 0.4, h * 0.55, 0); add('zerstreu', w * 0.72, h * 0.55, 0); st.light = 'gruen'; st.beam = 'buendel'; }
        else if (name === 'spiegel') {
          src = { x: w * 0.1, y: h * 0.3, a: 0.25 };
          add('spiegel', w * 0.6, h * 0.55, 1.1); add('spiegel', w * 0.25, h * 0.8, -0.35); add('spiegel', w * 0.8, h * 0.25, 0.4);
          st.light = 'rot'; st.beam = 'einzel';
        } else if (name === 'faser') {
          const bx = w * 0.55, by = h * 0.55, a = 0.5, d = Math.min(120, w * 0.12);
          add('block', bx, by, 0);
          src = { x: bx - 170 - d * Math.cos(a), y: by - 4 - d * Math.sin(a), a };
          st.light = 'rot'; st.beam = 'einzel';
        }
        sel = null;
        lightSel.value = st.light; beamSel.value = st.beam; dirty = true;
      }

      const nAt = (lam) => st.n + st.disp * (1 / ((lam / 1000) ** 2) - 1 / 0.3025);
      function raySeg(ox, oy, dx, dy, ax, ay, bx, by) {
        const ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) return -1;
        const t = ((ax - ox) * ey - (ay - oy) * ex) / den, u = ((ax - ox) * dy - (ay - oy) * dx) / den;
        return u < 0 || u > 1 ? -1 : t;
      }
      function trace(ox, oy, dx, dy, lam, I, depth, out) {
        let best = Infinity, hit = null, hax = 0, hay = 0, hbx = 0, hby = 0;
        for (const o of objs) {
          const P = o.world, n = P.length, edges = o.type === 'spiegel' ? 1 : n / 2;
          for (let e = 0; e < edges; e++) {
            const i = e * 2, j = (i + 2) % n;
            const t = raySeg(ox, oy, dx, dy, P[i], P[i + 1], P[j], P[j + 1]);
            if (t > 0.01 && t < best) { best = t; hit = o; hax = P[i]; hay = P[i + 1]; hbx = P[j]; hby = P[j + 1]; }
          }
        }
        segCount++;
        if (!hit) { out.push(ox, oy, ox + dx * 5000, oy + dy * 5000, I); return; }
        const hx = ox + dx * best, hy = oy + dy * best;
        out.push(ox, oy, hx, hy, I);
        if (depth >= 14 || segCount > 6000 || I < 0.02) return;
        const ex = hbx - hax, ey = hby - hay, L = Math.hypot(ex, ey);
        let nx = ey / L, ny = -ex / L;
        if (hit.type === 'spiegel') {
          const dn = dx * nx + dy * ny;
          trace(hx, hy, dx - 2 * dn * nx, dy - 2 * dn * ny, lam, I * 0.93, depth + 1, out);
          return;
        }
        nx *= hit.sign; ny *= hit.sign; // nach außen
        const entering = dx * nx + dy * ny < 0, ng = nAt(lam);
        const n1 = entering ? 1 : ng, n2 = entering ? ng : 1;
        const Nx = entering ? nx : -nx, Ny = entering ? ny : -ny;
        const cosi = -(dx * Nx + dy * Ny), eta = n1 / n2, k = 1 - eta * eta * (1 - cosi * cosi);
        const rx = dx + 2 * cosi * Nx, ry = dy + 2 * cosi * Ny;
        if (k < 0) { trace(hx, hy, rx, ry, lam, I * 0.99, depth + 1, out); return; } // Totalreflexion
        const sk = Math.sqrt(k), tx = eta * dx + (eta * cosi - sk) * Nx, ty = eta * dy + (eta * cosi - sk) * Ny;
        const R0 = ((n1 - n2) / (n1 + n2)) ** 2, R = R0 + (1 - R0) * Math.pow(1 - cosi, 5);
        trace(hx, hy, tx, ty, lam, I * (1 - R), depth + 1, out);
        if (I * R > 0.05) trace(hx, hy, rx, ry, lam, I * R, depth + 1, out);
      }

      function rays() {
        const list = [], c = Math.cos(src.a), s = Math.sin(src.a);
        if (st.beam === 'einzel') list.push([src.x, src.y, c, s]);
        else if (st.beam === 'buendel') for (let i = -5; i <= 5; i++) list.push([src.x - s * i * 9, src.y + c * i * 9, c, s]);
        else for (let i = -8; i <= 8; i++) { const a = src.a + i * 0.04; list.push([src.x, src.y, Math.cos(a), Math.sin(a)]); }
        return list;
      }

      function draw() {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#05050a';
        ctx.fillRect(0, 0, S.w, S.h);
        // Objekte
        for (const o of objs) {
          const P = o.world;
          ctx.beginPath();
          ctx.moveTo(P[0], P[1]);
          for (let i = 2; i < P.length; i += 2) ctx.lineTo(P[i], P[i + 1]);
          if (o.type === 'spiegel') { ctx.strokeStyle = '#d8dde8'; ctx.lineWidth = 5; ctx.stroke(); }
          else { ctx.closePath(); ctx.fillStyle = 'rgba(150,200,255,0.13)'; ctx.fill(); ctx.strokeStyle = 'rgba(190,220,255,0.55)'; ctx.lineWidth = 1.2; ctx.stroke(); }
        }
        // Strahlen
        segCount = 0;
        const L = LIGHTS[st.light], base = L.wl.length > 1 ? 0.3 : 0.95;
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = L.wl.length > 1 ? 2 : 1.8;
        ctx.lineCap = 'round';
        for (const lam of L.wl) {
          const col = wl2rgb(lam), out = [];
          for (const r of rays()) trace(r[0], r[1], r[2], r[3], lam, 1, 0, out);
          for (let i = 0; i < out.length; i += 5) {
            ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${(out[i + 4] * base).toFixed(3)})`;
            ctx.beginPath(); ctx.moveTo(out[i], out[i + 1]); ctx.lineTo(out[i + 2], out[i + 3]); ctx.stroke();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        // Lichtquelle
        ctx.save(); ctx.translate(src.x, src.y); ctx.rotate(src.a);
        ctx.fillStyle = '#3a3a48'; ctx.fillRect(-26, -9, 26, 18);
        ctx.fillStyle = '#ffcc33'; ctx.fillRect(-4, -5, 4, 10);
        ctx.restore();
        const hx = src.x + Math.cos(src.a) * 44, hy = src.y + Math.sin(src.a) * 44;
        ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(hx, hy, 7, 0, TAU); ctx.stroke();
        if (sel) {
          const [rx, ry] = rotHandle(sel);
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.moveTo(sel.x, sel.y); ctx.lineTo(rx, ry); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.arc(rx, ry, 8, 0, TAU); ctx.fill();
        }
        hud.textContent = `${L.name}   Brechzahl ${st.n.toFixed(2).replace('.', ',')}   ${segCount} Strahlabschnitte`;
      }
      function rotHandle(o) {
        let r = 0;
        for (let i = 0; i < o.local.length; i += 2) r = Math.max(r, Math.hypot(o.local[i], o.local[i + 1]));
        return [o.x + Math.cos(o.a - Math.PI / 2) * (r + 22), o.y + Math.sin(o.a - Math.PI / 2) * (r + 22)];
      }
      function inside(o, x, y) {
        const P = o.world;
        if (o.type === 'spiegel') {
          const ax = P[0], ay = P[1], bx = P[2], by = P[3], vx = bx - ax, vy = by - ay;
          const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
          return Math.hypot(x - ax - vx * t, y - ay - vy * t) < 16;
        }
        let c = false;
        for (let i = 0, j = P.length - 2; i < P.length; j = i, i += 2) {
          if ((P[i + 1] > y) !== (P[j + 1] > y) && x < (P[j] - P[i]) * (y - P[i + 1]) / (P[j + 1] - P[i + 1]) + P[i]) c = !c;
        }
        return c || Math.hypot(x - o.x, y - o.y) < 20;
      }

      let drag = null;
      Things.pointer(stage, {
        down(p) {
          const hx = src.x + Math.cos(src.a) * 44, hy = src.y + Math.sin(src.a) * 44;
          if (Math.hypot(p.x - hx, p.y - hy) < 22) { drag = { kind: 'srcRot' }; return; }
          if (Math.hypot(p.x - src.x, p.y - src.y) < 26) { drag = { kind: 'src', dx: src.x - p.x, dy: src.y - p.y }; return; }
          if (sel) { const [rx, ry] = rotHandle(sel); if (Math.hypot(p.x - rx, p.y - ry) < 22) { drag = { kind: 'rot', o: sel }; return; } }
          for (let i = objs.length - 1; i >= 0; i--) {
            if (inside(objs[i], p.x, p.y)) { sel = objs[i]; drag = { kind: 'move', o: sel, dx: sel.x - p.x, dy: sel.y - p.y }; dirty = true; return; }
          }
          sel = null; dirty = true;
        },
        move(p) {
          if (!drag || !p.down) return;
          if (drag.kind === 'srcRot') src.a = Math.atan2(p.y - src.y, p.x - src.x);
          else if (drag.kind === 'src') { src.x = p.x + drag.dx; src.y = p.y + drag.dy; }
          else if (drag.kind === 'rot') { drag.o.a = Math.atan2(p.y - drag.o.y, p.x - drag.o.x) + Math.PI / 2; update(drag.o); }
          else { drag.o.x = p.x + drag.dx; drag.o.y = p.y + drag.dy; update(drag.o); }
          dirty = true;
        },
        up() { drag = null; },
        wheel(d, p) {
          const o = objs.slice().reverse().find((x) => inside(x, p.x, p.y));
          if (o) { o.a += d * 0.002; update(o); sel = o; dirty = true; }
        },
      });

      const stop = Things.loop(() => { if (dirty) { dirty = false; draw(); } });
      S.onresize = () => { dirty = true; };

      U.select(panel, 'Versuch', [['prisma', 'Prisma & Regenbogen'], ['linsen', 'Sammel- & Zerstreuungslinse'], ['spiegel', 'Spiegel-Labyrinth'],
        ['faser', 'Totalreflexion (Lichtleiter)'], ['leer', 'Leerer Tisch']], 'prisma', (v) => preset(v));
      const lightSel = U.select(panel, 'Licht', Object.entries(LIGHTS).map(([k, v]) => [k, v.name]), st.light, (v) => { st.light = v; dirty = true; });
      const beamSel = U.select(panel, 'Strahl', [['einzel', 'Einzelner Strahl'], ['buendel', 'Paralleles Bündel'], ['faecher', 'Lichtfächer']], st.beam, (v) => { st.beam = v; dirty = true; });
      U.heading(panel, 'Hinzufügen');
      const place = (t) => () => { add(t, S.w / 2, S.h / 2, 0); };
      U.buttons(panel, [['Prisma', place('prisma')], ['Sammellinse', place('linse')], ['Zerstreuungslinse', place('zerstreu')], ['Spiegel', place('spiegel')], ['Glasblock', place('block')]]);
      U.buttons(panel, [['Ausgewähltes entfernen', () => { if (sel) { objs = objs.filter((o) => o !== sel); sel = null; dirty = true; } }]]);
      U.heading(panel, 'Glas');
      U.slider(panel, 'Brechzahl', { min: 1.1, max: 2.4, value: st.n, onInput: (v) => { st.n = v; dirty = true; } });
      U.slider(panel, 'Farbzerlegung', { min: 0, max: 0.06, step: 0.001, value: st.disp, fmt: (v) => Math.round(v / 0.06 * 100) + ' %', onInput: (v) => { st.disp = v; dirty = true; } });
      U.hint(panel, 'Ziehe Gläser und Spiegel herum, der gelbe Punkt dreht das ausgewählte Teil. Die Lichtquelle ' +
        'verschiebst du am Kästchen und richtest sie am gelben Ring aus. Blaues Licht wird im Glas stärker gebrochen als ' +
        'rotes – deshalb fächert das Prisma weißes Licht zum Regenbogen auf. Trifft Licht von innen zu flach auf die ' +
        'Oberfläche, kommt es nicht mehr heraus (Totalreflexion) – so funktionieren Glasfaserkabel.');

      preset('prisma');
      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
