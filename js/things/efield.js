/* Elektrische Felder – Punktladungen setzen und verschieben; Potential als Farbe mit Äquipotentiallinien,
   Feldlinien und geladene Probeteilchen, die durchs Feld fliegen. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const SOFT = 16;

  function E(ch, x, y, out) {
    let ex = 0, ey = 0;
    for (const c of ch) {
      const dx = x - c.x, dy = y - c.y, r2 = dx * dx + dy * dy + SOFT, f = c.q / (r2 * Math.sqrt(r2));
      ex += dx * f; ey += dy * f;
    }
    out[0] = ex; out[1] = ey;
  }
  function V(ch, x, y) {
    let v = 0;
    for (const c of ch) v += c.q / Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2 + SOFT);
    return v;
  }

  Things.register({
    id: 'efeld',
    name: 'Elektrische Felder',
    desc: 'Plus und Minus: Feldlinien sichtbar machen und Teilchen fliegen lassen.',

    thumb(c, w, h) {
      const cv = c.canvas, W = cv.width, H = cv.height, k = W / w, img = c.createImageData(W, H), d = img.data;
      const ch = [{ x: w * 0.35 * k, y: h * 0.5 * k, q: 1 }, { x: w * 0.65 * k, y: h * 0.5 * k, q: -1 }];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = V(ch, x, y) * 60 / k, o = (y * W + x) * 4, a = 1 - Math.exp(-Math.abs(v) * 0.5), f = v - Math.round(v);
        const line = Math.abs(f) < 0.07 ? 0.5 : 0;
        const col = v > 0 ? [255, 90, 60] : [60, 140, 255];
        d[o] = 11 + col[0] * (a * 0.45 + line * a); d[o + 1] = 11 + col[1] * (a * 0.45 + line * a); d[o + 2] = 16 + col[2] * (a * 0.45 + line * a); d[o + 3] = 255;
      }
      c.putImageData(img, 0, 0);
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1;
      const chc = [{ x: w * 0.35, y: h * 0.5, q: 1 }, { x: w * 0.65, y: h * 0.5, q: -1 }], e = [0, 0];
      for (let i = 0; i < 14; i++) {
        let x = chc[0].x + Math.cos(i / 14 * TAU) * 6, y = chc[0].y + Math.sin(i / 14 * TAU) * 6;
        c.beginPath(); c.moveTo(x, y);
        for (let s = 0; s < 400; s++) {
          E(chc, x, y, e); const l = Math.hypot(e[0], e[1]) || 1;
          x += e[0] / l * 1.5; y += e[1] / l * 1.5; c.lineTo(x, y);
          if (Math.hypot(x - chc[1].x, y - chc[1].y) < 5 || x < 0 || y < 0 || x > w || y > h) break;
        }
        c.stroke();
      }
      for (const q of chc) { c.fillStyle = q.q > 0 ? '#ff5a3c' : '#3c8cff'; c.beginPath(); c.arc(q.x, q.y, 7, 0, TAU); c.fill(); }
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { mode: 'plus', q: 2, lines: true, pot: true };
      let ch = [], parts = [], dirty = true, lines = [];
      const bg = document.createElement('canvas'), bctx = bg.getContext('2d');
      const e = [0, 0];

      function preset(name) {
        const w = S.w, h = S.h, cx = w / 2, cy = h / 2 + 20, d = Math.min(w, h) * 0.18;
        parts = [];
        if (name === 'dipol') ch = [{ x: cx - d, y: cy, q: 2 }, { x: cx + d, y: cy, q: -2 }];
        else if (name === 'gleich') ch = [{ x: cx - d, y: cy, q: 2 }, { x: cx + d, y: cy, q: 2 }];
        else if (name === 'quadrupol') ch = [{ x: cx - d, y: cy - d, q: 2 }, { x: cx + d, y: cy + d, q: 2 }, { x: cx + d, y: cy - d, q: -2 }, { x: cx - d, y: cy + d, q: -2 }];
        else if (name === 'kondensator') {
          ch = [];
          for (let i = -5; i <= 5; i++) { ch.push({ x: cx - d, y: cy + i * d * 0.25, q: 0.8 }); ch.push({ x: cx + d, y: cy + i * d * 0.25, q: -0.8 }); }
        } else ch = [];
        dirty = true;
      }

      function rebuild() {
        // Potential-Hintergrund in grober Auflösung
        const cell = 4, W = Math.ceil(S.w / cell), H = Math.ceil(S.h / cell);
        bg.width = W; bg.height = H;
        const img = bctx.createImageData(W, H), d = img.data;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const o = (y * W + x) * 4;
          if (!st.pot || !ch.length) { d[o] = 11; d[o + 1] = 11; d[o + 2] = 16; d[o + 3] = 255; continue; }
          const v = V(ch, x * cell + 2, y * cell + 2) * 140, a = 1 - Math.exp(-Math.abs(v) * 0.12), f = v - Math.round(v);
          const line = Math.max(0, 1 - Math.abs(f) / 0.09) * 0.8, col = v > 0 ? [255, 90, 60] : [60, 140, 255], m = a * 0.4 + line * a;
          d[o] = 11 + col[0] * m; d[o + 1] = 11 + col[1] * m; d[o + 2] = 16 + col[2] * m; d[o + 3] = 255;
        }
        bctx.putImageData(img, 0, 0);
        // Feldlinien
        lines = [];
        if (!st.lines || !ch.length) return;
        const pos = ch.filter((c) => c.q > 0), starts = pos.length ? pos : ch.filter((c) => c.q < 0), dir = pos.length ? 1 : -1;
        for (const c of starts) {
          const n = Math.round(Math.abs(c.q) * 7);
          for (let i = 0; i < n; i++) {
            const a = (i + 0.5) / n * TAU;
            let x = c.x + Math.cos(a) * 8, y = c.y + Math.sin(a) * 8;
            const L = [x, y];
            for (let s = 0; s < 1400; s++) {
              E(ch, x, y, e); let l = Math.hypot(e[0], e[1]);
              if (l < 1e-12) break;
              const mx = x + e[0] / l * 2 * dir, my = y + e[1] / l * 2 * dir;
              E(ch, mx, my, e); l = Math.hypot(e[0], e[1]) || 1;
              x += e[0] / l * 4 * dir; y += e[1] / l * 4 * dir;
              L.push(x, y);
              if (x < -200 || y < -200 || x > S.w + 200 || y > S.h + 200) break;
              let end = false;
              for (const o of ch) if (o !== c && Math.sign(o.q) === -dir && Math.hypot(x - o.x, y - o.y) < 9) end = true;
              if (end) break;
            }
            lines.push(L);
          }
        }
      }

      const stop = Things.loop((dt) => {
        if (dirty) { dirty = false; rebuild(); }
        // Probeteilchen bewegen
        const sub = 4, h = dt / sub;
        for (let k = 0; k < sub; k++) {
          for (const p of parts) {
            E(ch, p.x, p.y, e);
            p.vx += e[0] * 2.5e6 * p.q * h; p.vy += e[1] * 2.5e6 * p.q * h;
            const sp = Math.hypot(p.vx, p.vy);
            if (sp > 900) { p.vx *= 900 / sp; p.vy *= 900 / sp; }
            p.x += p.vx * h; p.y += p.vy * h;
          }
        }
        for (const p of parts) {
          p.tr.push(p.x, p.y);
          if (p.tr.length > 80) p.tr.splice(0, 2);
          for (const c of ch) if (Math.hypot(p.x - c.x, p.y - c.y) < 8) p.dead = true;
          if (p.x < -300 || p.y < -300 || p.x > S.w + 300 || p.y > S.h + 300) p.dead = true;
        }
        parts = parts.filter((p) => !p.dead);

        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(bg, 0, 0, S.w, S.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.1;
        for (const L of lines) {
          ctx.beginPath(); ctx.moveTo(L[0], L[1]);
          for (let i = 2; i < L.length; i += 2) ctx.lineTo(L[i], L[i + 1]);
          ctx.stroke();
          // Pfeil in der Mitte
          const m = Math.floor(L.length / 4) * 2;
          if (L.length > 12) {
            const x = L[m], y = L[m + 1], a = Math.atan2(L[m + 3] - y, L[m + 2] - x) + (ch.some((c) => c.q > 0) ? 0 : Math.PI);
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
            ctx.lineTo(x + Math.cos(a + 2.5) * 5, y + Math.sin(a + 2.5) * 5); ctx.lineTo(x + Math.cos(a - 2.5) * 5, y + Math.sin(a - 2.5) * 5); ctx.fill();
          }
        }
        for (const p of parts) {
          ctx.strokeStyle = p.q > 0 ? 'rgba(255,200,80,0.5)' : 'rgba(120,230,255,0.5)'; ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < p.tr.length; i += 2) ctx.lineTo(p.tr[i], p.tr[i + 1]);
          ctx.stroke();
          ctx.fillStyle = p.q > 0 ? '#ffd166' : '#7fe6ff';
          ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, TAU); ctx.fill();
        }
        for (const c of ch) {
          const r = 8 + Math.abs(c.q) * 2;
          ctx.fillStyle = c.q > 0 ? '#ff5a3c' : '#3c8cff';
          ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(c.x - r * 0.5, c.y); ctx.lineTo(c.x + r * 0.5, c.y);
          if (c.q > 0) { ctx.moveTo(c.x, c.y - r * 0.5); ctx.lineTo(c.x, c.y + r * 0.5); }
          ctx.stroke();
        }
        hud.textContent = `${ch.length} Ladungen   ${parts.length} Teilchen`;
      });
      S.onresize = () => { dirty = true; };

      let drag = null, downAt = null, moved = false;
      Things.pointer(stage, {
        down(p) {
          downAt = p; moved = false;
          drag = ch.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < 20) || null;
        },
        move(p) {
          if (!p.down || !downAt) return;
          if (Math.hypot(p.x - downAt.x, p.y - downAt.y) > 6) moved = true;
          if (drag && moved) { drag.x = p.x; drag.y = p.y; dirty = true; }
        },
        up(p) {
          if (!downAt) return;
          if (!moved) {
            if (drag) ch = ch.filter((c) => c !== drag);
            else if (st.mode === 'teilchen' || st.mode === 'teilchenNeg') {
              const q = st.mode === 'teilchen' ? 1 : -1;
              for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; parts.push({ x: p.x + Math.cos(a) * 10, y: p.y + Math.sin(a) * 10, vx: 0, vy: 0, q, tr: [] }); }
              if (parts.length > 300) parts.splice(0, parts.length - 300);
            } else ch.push({ x: p.x, y: p.y, q: st.mode === 'plus' ? st.q : -st.q });
            dirty = true;
          }
          drag = null; downAt = null;
        },
      });

      U.select(panel, 'Anordnung', [['dipol', 'Dipol (+ und −)'], ['gleich', 'Zwei gleiche Ladungen'], ['quadrupol', 'Quadrupol'],
        ['kondensator', 'Plattenkondensator'], ['leer', 'Leer']], 'dipol', (v) => preset(v));
      U.select(panel, 'Tippen setzt …', [['plus', 'Plus-Ladung'], ['minus', 'Minus-Ladung'], ['teilchen', 'Positive Probeteilchen'], ['teilchenNeg', 'Negative Probeteilchen']],
        st.mode, (v) => (st.mode = v));
      U.slider(panel, 'Ladungsstärke', { min: 0.5, max: 5, step: 0.5, value: st.q, fmt: (v) => String(v).replace('.', ','), onInput: (v) => (st.q = v) });
      U.toggle(panel, 'Feldlinien', st.lines, (v) => { st.lines = v; dirty = true; });
      U.toggle(panel, 'Potential (Farben)', st.pot, (v) => { st.pot = v; dirty = true; });
      U.buttons(panel, [['Teilchen entfernen', () => (parts = []), true], ['Alles leeren', () => preset('leer')]]);
      U.hint(panel, 'Tippe ins Feld, um Ladungen oder Probeteilchen zu setzen. Ladungen lassen sich verschieben, ' +
        'ein kurzer Tipp auf eine Ladung entfernt sie. Rot = positives, Blau = negatives Potential; die hellen Ringe ' +
        'sind Linien gleicher Spannung. Feldlinien laufen immer von Plus nach Minus und stehen senkrecht auf diesen Ringen.');

      preset('dipol');
      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
