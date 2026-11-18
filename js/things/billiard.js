/* Billard – 15 Kugeln, Stoßphysik (elastische Stöße gleicher Massen), Rollreibung, Banden, Taschen,
   Zielhilfe mit Geisterkugel, Klick-Geräusche per Web Audio. Tisch dreht sich im Hochformat mit. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const R = 0.026, RAIL = 0.07;
  const POCKETS = [[0, 0, 0.068], [1, 0, 0.056], [2, 0, 0.068], [0, 1, 0.068], [1, 1, 0.056], [2, 1, 0.068]];
  const COLORS = ['#f2f2f2', '#f5c518', '#1f5fd1', '#d8262f', '#6a2fa0', '#f07c18', '#1c8a3c', '#7a1d1d', '#111111'];
  const ORDER = [1, 9, 2, 10, 8, 3, 11, 7, 14, 4, 5, 13, 15, 6, 12];

  function rack() {
    const balls = [{ n: 0, x: 0.5, y: 0.5, vx: 0, vy: 0, in: false }];
    let k = 0;
    for (let row = 0; row < 5; row++) for (let j = 0; j <= row; j++) {
      balls.push({ n: ORDER[k++], x: 1.5 + row * R * Math.sqrt(3) * 1.02, y: 0.5 + (j - row / 2) * R * 2.04, vx: 0, vy: 0, in: false });
    }
    return balls;
  }
  function drawBall(c, b, X, Y, rad) {
    const base = COLORS[b.n > 8 ? b.n - 8 : b.n];
    if (b.n > 8) {
      c.fillStyle = '#f2f2f2'; c.beginPath(); c.arc(X, Y, rad, 0, TAU); c.fill();
      c.save(); c.beginPath(); c.arc(X, Y, rad, 0, TAU); c.clip();
      c.fillStyle = base; c.fillRect(X - rad, Y - rad * 0.55, rad * 2, rad * 1.1); c.restore();
    } else { c.fillStyle = base; c.beginPath(); c.arc(X, Y, rad, 0, TAU); c.fill(); }
    if (b.n > 0 && rad > 7) {
      c.fillStyle = '#fff'; c.beginPath(); c.arc(X, Y, rad * 0.45, 0, TAU); c.fill();
      c.fillStyle = '#111'; c.font = `bold ${Math.round(rad * 0.62)}px system-ui,sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b.n, X, Y + rad * 0.04);
    }
    const g = c.createRadialGradient(X - rad * 0.35, Y - rad * 0.4, rad * 0.1, X, Y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(0.4, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    c.fillStyle = g; c.beginPath(); c.arc(X, Y, rad, 0, TAU); c.fill();
  }

  Things.register({
    id: 'billard',
    name: 'Billard',
    desc: 'Zielen, ziehen, loslassen – echte Stoßphysik auf grünem Filz.',

    thumb(c, w, h) {
      c.fillStyle = '#0b0b10'; c.fillRect(0, 0, w, h);
      const s = Math.min((w - 16) / 2.14, (h - 16) / 1.14), ox = (w - 2 * s) / 2, oy = (h - s) / 2;
      c.fillStyle = '#5b3417'; c.fillRect(ox - RAIL * s, oy - RAIL * s, (2 + 2 * RAIL) * s, (1 + 2 * RAIL) * s);
      c.fillStyle = '#0f7a43'; c.fillRect(ox, oy, 2 * s, s);
      c.fillStyle = '#000'; for (const [x, y, r] of POCKETS) { c.beginPath(); c.arc(ox + x * s, oy + y * s, r * s, 0, TAU); c.fill(); }
      for (const b of rack()) drawBall(c, b, ox + b.x * s, oy + b.y * s, R * s);
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.setLineDash([3, 4]);
      c.beginPath(); c.moveTo(ox + 0.5 * s, oy + 0.5 * s); c.lineTo(ox + 1.45 * s, oy + 0.5 * s); c.stroke(); c.setLineDash([]);
      c.strokeStyle = '#d9b77a'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(ox + 0.05 * s, oy + 0.5 * s); c.lineTo(ox + 0.45 * s, oy + 0.5 * s); c.stroke();
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { sound: true, guide: true, friction: 0.55 };
      let balls = rack(), shots = 0, potted = 0, aim = null, ac = null, msg = '';

      // Bildschirm <-> Tischkoordinaten (Tisch 2 x 1); im Hochformat um 90° gedreht
      function view() {
        const top = 64, por = S.h > S.w * 1.1;
        const aw = S.w - 24, ah = S.h - top - 16;
        const s = por ? Math.min(aw / (1 + 2 * RAIL), ah / (2 + 2 * RAIL)) : Math.min(aw / (2 + 2 * RAIL), ah / (1 + 2 * RAIL));
        const tw = por ? s : 2 * s, th = por ? 2 * s : s;
        return { s, por, ox: (S.w - tw) / 2, oy: top + (ah - th) / 2 + 8 };
      }
      const toS = (V, x, y) => V.por ? [V.ox + (1 - y) * V.s, V.oy + x * V.s] : [V.ox + x * V.s, V.oy + y * V.s];
      const toT = (V, X, Y) => V.por ? [(Y - V.oy) / V.s, 1 - (X - V.ox) / V.s] : [(X - V.ox) / V.s, (Y - V.oy) / V.s];

      function click(vol, freq) {
        if (!st.sound || !ac || vol < 0.02) return;
        const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle'; o.frequency.value = freq;
        g.gain.setValueAtTime(Math.min(0.25, vol * 0.25), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.05);
      }
      const moving = () => balls.some((b) => !b.in && (b.vx || b.vy));
      const cue = () => balls[0];

      function step(h) {
        const live = balls.filter((b) => !b.in);
        for (const b of live) {
          b.x += b.vx * h; b.y += b.vy * h;
          const sp = Math.hypot(b.vx, b.vy);
          if (sp > 0) { const ns = Math.max(0, sp - st.friction * h); b.vx *= ns / sp; b.vy *= ns / sp; if (ns < 0.004) { b.vx = 0; b.vy = 0; } }
        }
        // Taschen
        for (const b of live) for (const [px, py, pr] of POCKETS) {
          if (Math.hypot(b.x - px, b.y - py) < pr) {
            b.in = true; b.vx = b.vy = 0; click(0.6, 180);
            if (b.n === 0) msg = 'Weiße versenkt – sie kommt zurück.';
            else { potted++; msg = ''; }
          }
        }
        // Banden
        for (const b of live) {
          if (b.in) continue;
          if (b.x < R) { b.x = R; b.vx = -b.vx * 0.78; click(Math.abs(b.vx) * 0.3, 320); }
          if (b.x > 2 - R) { b.x = 2 - R; b.vx = -b.vx * 0.78; click(Math.abs(b.vx) * 0.3, 320); }
          if (b.y < R) { b.y = R; b.vy = -b.vy * 0.78; click(Math.abs(b.vy) * 0.3, 320); }
          if (b.y > 1 - R) { b.y = 1 - R; b.vy = -b.vy * 0.78; click(Math.abs(b.vy) * 0.3, 320); }
        }
        // Kugel-Kugel-Stöße
        for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
          const a = live[i], b = live[j];
          if (a.in || b.in) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d >= 2 * R || d === 0) continue;
          const nx = dx / d, ny = dy / d, ov = (2 * R - d) / 2;
          a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
          const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (vn <= 0) continue;
          const j2 = vn * 0.97;
          a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny;
          click(vn * 0.5, 1900);
        }
      }

      // Zielhilfe: erste Kugel auf dem Weg der Weißen finden
      function predict(dx, dy) {
        const c = cue();
        let best = Infinity, hit = null;
        for (const b of balls) {
          if (b === c || b.in) continue;
          const fx = b.x - c.x, fy = b.y - c.y, t = fx * dx + fy * dy;
          if (t <= 0) continue;
          const d2 = fx * fx + fy * fy - t * t, rr = 4 * R * R;
          if (d2 > rr) continue;
          const tt = t - Math.sqrt(rr - d2);
          if (tt < best) { best = tt; hit = b; }
        }
        let tw = Infinity;
        if (dx > 0) tw = Math.min(tw, (2 - R - c.x) / dx); if (dx < 0) tw = Math.min(tw, (R - c.x) / dx);
        if (dy > 0) tw = Math.min(tw, (1 - R - c.y) / dy); if (dy < 0) tw = Math.min(tw, (R - c.y) / dy);
        if (!hit || tw < best) return { t: tw, hit: null };
        return { t: best, hit };
      }

      const stop = Things.loop((dt) => {
        const sub = 10, h = Math.min(dt, 1 / 30) / sub;
        for (let k = 0; k < sub; k++) step(h);
        if (!moving() && cue().in) {
          const c = cue(); c.in = false; c.x = 0.5; c.y = 0.5;
          if (balls.some((b) => b !== c && !b.in && Math.hypot(b.x - 0.5, b.y - 0.5) < 2 * R)) { c.y = 0.3; }
        }
        const V = view(), s = V.s;
        ctx.fillStyle = '#0b0b10'; ctx.fillRect(0, 0, S.w, S.h);
        const [x0, y0] = toS(V, V.por ? 0 : 0, V.por ? 1 : 0), tw = V.por ? s : 2 * s, th = V.por ? 2 * s : s;
        ctx.fillStyle = '#5b3417';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0 - RAIL * s, y0 - RAIL * s, tw + 2 * RAIL * s, th + 2 * RAIL * s, RAIL * s * 0.6) : ctx.rect(x0 - RAIL * s, y0 - RAIL * s, tw + 2 * RAIL * s, th + 2 * RAIL * s);
        ctx.fill();
        const cloth = ctx.createRadialGradient(x0 + tw / 2, y0 + th / 2, 0, x0 + tw / 2, y0 + th / 2, Math.max(tw, th) * 0.7);
        cloth.addColorStop(0, '#14915a'); cloth.addColorStop(1, '#0b6a3c');
        ctx.fillStyle = cloth; ctx.fillRect(x0, y0, tw, th);
        ctx.fillStyle = '#000';
        for (const [px, py, pr] of POCKETS) { const [X, Y] = toS(V, px, py); ctx.beginPath(); ctx.arc(X, Y, pr * s, 0, TAU); ctx.fill(); }
        // Markierungen
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
        const [la, lb] = [toS(V, 0.5, 0), toS(V, 0.5, 1)];
        ctx.beginPath(); ctx.moveTo(la[0], la[1]); ctx.lineTo(lb[0], lb[1]); ctx.stroke();
        // Zielen
        if (aim && !moving()) {
          const c = cue(), [cx, cy] = toS(V, c.x, c.y);
          let dx = cx - aim.x, dy = cy - aim.y;
          const L = Math.hypot(dx, dy);
          if (L > 4) {
            dx /= L; dy /= L;
            const pw = Math.min(1, L / (s * 0.55));
            // Richtung in Tischkoordinaten
            const p1 = toT(V, cx, cy), p2 = toT(V, cx + dx, cy + dy), tdx = p2[0] - p1[0], tdy = p2[1] - p1[1], tl = Math.hypot(tdx, tdy);
            if (st.guide) {
              const pr = predict(tdx / tl, tdy / tl), gx = c.x + tdx / tl * pr.t, gy = c.y + tdy / tl * pr.t, [GX, GY] = toS(V, gx, gy);
              ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.setLineDash([5, 6]); ctx.lineWidth = 1.5;
              ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(GX, GY); ctx.stroke(); ctx.setLineDash([]);
              ctx.strokeStyle = 'rgba(255,255,255,0.6)';
              ctx.beginPath(); ctx.arc(GX, GY, R * s, 0, TAU); ctx.stroke();
              if (pr.hit) {
                const [HX, HY] = toS(V, pr.hit.x, pr.hit.y), nx = HX - GX, ny = HY - GY, nl = Math.hypot(nx, ny) || 1;
                ctx.strokeStyle = 'rgba(255,204,51,0.8)';
                ctx.beginPath(); ctx.moveTo(HX, HY); ctx.lineTo(HX + nx / nl * s * 0.25, HY + ny / nl * s * 0.25); ctx.stroke();
              }
            }
            // Queue
            const back = R * s + 6 + pw * s * 0.25;
            ctx.strokeStyle = '#d9b77a'; ctx.lineWidth = Math.max(3, s * 0.012); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(cx - dx * back, cy - dy * back); ctx.lineTo(cx - dx * (back + s * 0.9), cy - dy * (back + s * 0.9)); ctx.stroke();
            ctx.fillStyle = `hsl(${120 - pw * 120},90%,55%)`;
            ctx.fillRect(16, S.h - 30, (S.w - 32) * pw, 6);
            aim.power = pw; aim.dir = [tdx / tl, tdy / tl];
          }
        }
        for (const b of balls) if (!b.in) { const [X, Y] = toS(V, b.x, b.y); drawBall(ctx, b, X, Y, R * s); }
        hud.textContent = potted >= 15 ? `Alle versenkt in ${shots} Stößen!` : `Stöße ${shots}   Versenkt ${potted}/15` + (msg ? '   ' + msg : '');
      });

      Things.pointer(stage, {
        down(p) {
          if (!ac && (window.AudioContext || window.webkitAudioContext)) ac = new (window.AudioContext || window.webkitAudioContext)();
          if (ac && ac.state === 'suspended') ac.resume();
          if (!moving()) aim = { x: p.x, y: p.y, power: 0, dir: null };
        },
        move(p) { if (aim && p.down) { aim.x = p.x; aim.y = p.y; } },
        up() {
          if (aim && aim.dir && aim.power > 0.03 && !moving()) {
            const sp = 0.3 + aim.power * 4.2, c = cue();
            c.vx = aim.dir[0] * sp; c.vy = aim.dir[1] * sp;
            shots++; msg = '';
            click(aim.power, 900);
          }
          aim = null;
        },
      });

      U.buttons(panel, [['Neu aufbauen', () => { balls = rack(); shots = 0; potted = 0; msg = ''; }, true]]);
      U.toggle(panel, 'Zielhilfe', st.guide, (v) => (st.guide = v));
      U.toggle(panel, 'Geräusche', st.sound, (v) => (st.sound = v));
      U.slider(panel, 'Reibung', { min: 0.15, max: 1.5, value: st.friction, onInput: (v) => (st.friction = v) });
      U.hint(panel, 'Irgendwo hindrücken und ziehen: Die Weiße wird in Gegenrichtung gestoßen, je weiter du ziehst, desto ' +
        'fester (Balken unten). Die gestrichelte Linie zeigt, wo die Weiße auftrifft, der gelbe Strich, wohin die ' +
        'getroffene Kugel rollt. Bei gleich schweren Kugeln laufen beide danach fast genau im rechten Winkel auseinander.');

      return { destroy() { stop(); S.destroy(); if (ac) ac.close(); } };
    },
  });
})();
