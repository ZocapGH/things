/* Pendelwelle – Pendel mit abgestimmten Längen: in 60 s schafft Pendel i genau K+i Schwingungen.
   Dadurch entstehen Schlangen, Wellen, scheinbares Chaos – und nach 60 s sind alle wieder in einer Reihe.
   3D-Ansicht (drehbar), optional mit Ton an jedem Umkehrpunkt (Pentatonik). */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const PENTA = [0, 2, 4, 7, 9];

  function setup(n, T) {
    const K = Math.round(n * 3.4), ps = [];
    for (let i = 0; i < n; i++) {
      const f = (K + i) / T, L = 9.81 / (TAU * f) ** 2;
      ps.push({ f, L, hue: (i / n) * 300, ext: 0 });
    }
    return ps;
  }

  Things.register({
    id: 'pendelwelle',
    name: 'Pendelwelle',
    desc: 'Fünfzehn Pendel, ein Tanz – und nach einer Minute wieder im Gleichschritt.',

    thumb(c, w, h) {
      c.fillStyle = '#08080c';
      c.fillRect(0, 0, w, h);
      const ps = setup(15, 60), t = 9.5, sx = w / 17;
      c.strokeStyle = '#555'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(sx * 0.6, h * 0.18); c.lineTo(w - sx * 0.6, h * 0.18); c.stroke();
      ps.forEach((p, i) => {
        const th = 0.5 * Math.cos(TAU * p.f * t), x = sx * (i + 1), y = h * 0.18 + p.L * h * 1.6 * 0.6 + Math.sin(th) * h * 0.3;
        c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x, h * 0.18); c.lineTo(x, y); c.stroke();
        c.fillStyle = `hsl(${p.hue},85%,62%)`;
        c.beginPath(); c.arc(x, y, sx * 0.32, 0, TAU); c.fill();
      });
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { n: 15, T: 60, amp: 0.45, speed: 1, run: true, sound: false, trails: true, pitch: 0.7, yaw: -0.25 };
      let ps = setup(st.n, st.T), t = 0, ac = null;

      function restart() { ps = setup(st.n, st.T); t = 0; }
      function beep(i) {
        if (!st.sound || !ac) return;
        const step = PENTA[i % 5] + 12 * Math.floor(i / 5), f = 220 * Math.pow(2, step / 12);
        const now = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.06, now + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        o.connect(g); g.connect(ac.destination); o.start(now); o.stop(now + 0.4);
      }

      const stop = Things.loop((dt) => {
        if (st.run) {
          t += dt * st.speed;
          // Umkehrpunkt = Phase überschreitet ein Vielfaches von π
          for (let i = 0; i < ps.length; i++) {
            const e = Math.floor(2 * ps[i].f * t);
            if (e !== ps[i].ext) { ps[i].ext = e; if (st.speed <= 2.5) beep(i); }
          }
        }
        draw();
      });

      function draw() {
        ctx.fillStyle = '#08080c';
        ctx.fillRect(0, 0, S.w, S.h);
        const n = ps.length, Lmax = ps[0].L, cp = Math.cos(st.pitch), sp = Math.sin(st.pitch), cy = Math.cos(st.yaw), sy = Math.sin(st.yaw);
        const width = n - 1, spacing = Lmax * 0.16;
        // 3D -> 2D in Welteinheiten (gieren um die Senkrechte, dann neigen, leichte Perspektive)
        const raw = (X, Y, Z) => {
          const x1 = X * cy - Z * sy, z1 = X * sy + Z * cy;
          const y2 = Y * cp - z1 * sp, z2 = Y * sp + z1 * cp;
          const pr = 1 / (1 - z2 * 0.2 / Lmax);
          return [x1 * pr, -y2 * pr, z2];
        };
        // Szene einpassen: Ausdehnung aus Balken und Pendeln bei voller Auslenkung (unabhängig von der Zeit)
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        const grow = (q) => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); };
        ps.forEach((p, i) => {
          const X = (i - width / 2) * spacing;
          grow(raw(X, Lmax * 0.55, 0));
          for (const th of [-st.amp, 0, st.amp]) grow(raw(X, Lmax * 0.55 - p.L * Math.cos(th), p.L * Math.sin(th)));
        });
        grow(raw(-(width / 2 + 0.6) * spacing, Lmax * 0.55, 0)); grow(raw((width / 2 + 0.6) * spacing, Lmax * 0.55, 0));
        const top = 70, mg = 24, sc = Math.min((S.w - 2 * mg) / (x1 - x0), (S.h - top - mg) / (y1 - y0));
        const offX = (S.w - (x1 - x0) * sc) / 2 - x0 * sc, offY = top + (S.h - top - mg - (y1 - y0) * sc) / 2 - y0 * sc;
        const proj = (X, Y, Z) => { const q = raw(X, Y, Z); return [offX + q[0] * sc, offY + q[1] * sc, q[2]]; };
        const items = ps.map((p, i) => {
          const th = st.amp * Math.cos(TAU * p.f * t), X = (i - width / 2) * spacing;
          const piv = proj(X, Lmax * 0.55, 0), bob = proj(X, Lmax * 0.55 - p.L * Math.cos(th), p.L * Math.sin(th));
          return { p, piv, bob };
        });
        // Balken
        const a = proj(-width / 2 * spacing - spacing * 0.6, Lmax * 0.55, 0), b = proj(width / 2 * spacing + spacing * 0.6, Lmax * 0.55, 0);
        ctx.strokeStyle = '#4a4a58'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        // Schlangenlinie durch die Kugeln
        if (st.trails) {
          ctx.strokeStyle = 'rgba(255,204,51,0.35)'; ctx.lineWidth = 2;
          ctx.beginPath();
          items.forEach((it, i) => (i ? ctx.lineTo(it.bob[0], it.bob[1]) : ctx.moveTo(it.bob[0], it.bob[1])));
          ctx.stroke();
        }
        items.sort((u, v) => u.bob[2] - v.bob[2]);
        const r0 = Math.max(5, spacing * sc * 0.36);
        for (const it of items) {
          ctx.strokeStyle = 'rgba(220,220,235,0.35)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(it.piv[0], it.piv[1]); ctx.lineTo(it.bob[0], it.bob[1]); ctx.stroke();
          const r = r0 / (1 - it.bob[2] * 0.2 / Lmax), x = it.bob[0], y = it.bob[1];
          const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
          g.addColorStop(0, `hsl(${it.p.hue},90%,82%)`); g.addColorStop(0.5, `hsl(${it.p.hue},85%,58%)`); g.addColorStop(1, `hsl(${it.p.hue},80%,28%)`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        }
        const tc = t % st.T;
        hud.textContent = `t = ${tc.toFixed(1).replace('.', ',')} s von ${st.T} s   ` + (tc < 0.6 || tc > st.T - 0.6 ? 'alle in einer Reihe!' : '');
      }

      let last = null;
      Things.pointer(stage, {
        down(p) { last = p; },
        move(p) {
          if (!p.down || !last) return;
          st.yaw -= (p.x - last.x) * 0.006;
          st.pitch = Math.max(0.05, Math.min(1.5, st.pitch + (p.y - last.y) * 0.006));
          last = p;
        },
        up() { last = null; },
      });

      const [runBtn] = U.buttons(panel, [
        ['Pause', () => { st.run = !st.run; runBtn.textContent = st.run ? 'Pause' : 'Weiter'; }, true],
        ['Neu starten', restart],
      ]);
      U.toggle(panel, 'Ton an jedem Umkehrpunkt', st.sound, (v) => {
        st.sound = v;
        if (v && !ac && (window.AudioContext || window.webkitAudioContext)) ac = new (window.AudioContext || window.webkitAudioContext)();
        if (ac) ac.resume();
      });
      U.toggle(panel, 'Verbindungslinie', st.trails, (v) => (st.trails = v));
      U.slider(panel, 'Tempo', { min: 0.25, max: 4, value: st.speed, fmt: (v) => v.toFixed(2).replace('.', ',') + '×', onInput: (v) => (st.speed = v) });
      U.slider(panel, 'Auslenkung', { min: 0.1, max: 0.8, value: st.amp, fmt: (v) => Math.round(v * 57.3) + '°', onInput: (v) => (st.amp = v) });
      U.slider(panel, 'Anzahl Pendel', { min: 6, max: 30, step: 1, value: st.n, fmt: (v) => v, onChange: (v) => { st.n = v; restart(); } });
      U.slider(panel, 'Zyklusdauer', { min: 20, max: 120, step: 5, value: st.T, fmt: (v) => v + ' s', onChange: (v) => { st.T = v; restart(); } });
      U.hint(panel, 'Jedes Pendel ist ein kleines bisschen kürzer als sein Nachbar und schwingt dadurch etwas schneller. ' +
        'Pendel Nr. 1 schafft in einem Zyklus genau eine Schwingung weniger als Nr. 2 und so weiter. Darum laufen sie ' +
        'auseinander, bilden Wellen und Muster – und am Ende des Zyklus treffen sich alle wieder. ' +
        'Zum Drehen der Ansicht übers Bild ziehen.');

      return { destroy() { stop(); S.destroy(); if (ac) ac.close(); } };
    },
  });
})();
