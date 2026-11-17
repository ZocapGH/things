/* Harmonograph – vier gedämpfte Pendel zeichnen gemeinsam eine Kurve (optional auf Drehtisch). */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const RATIOS = [[1, 1], [1, 2], [2, 3], [3, 4], [1, 3], [3, 5], [2, 5], [4, 5], [3, 2]];

  function makeH(seed, detune, rotary) {
    const R = Things.rng(seed);
    const r = (a, b) => a + (b - a) * R();
    const [a, b] = RATIOS[Math.floor(R() * RATIOS.length)];
    const base = r(1.6, 2.6);
    const fr = () => (R() < 0.5 ? a : b) * base + r(-1, 1) * detune * base;
    const pend = () => ({ A: r(0.3, 0.55), f: fr(), p: r(0, TAU), d: r(0.002, 0.012) });
    const ps = [pend(), pend(), pend(), pend()];
    const sx = ps[0].A + ps[1].A, sy = ps[2].A + ps[3].A;
    ps[0].A /= sx; ps[1].A /= sx; ps[2].A /= sy; ps[3].A /= sy;
    return { ps, rot: rotary ? r(0.004, 0.012) * (R() < 0.5 ? 1 : -1) : 0, hue: r(0, 360) };
  }
  function point(H, t, out) {
    const [p0, p1, p2, p3] = H.ps;
    let x = p0.A * Math.sin(p0.f * t + p0.p) * Math.exp(-p0.d * t) + p1.A * Math.sin(p1.f * t + p1.p) * Math.exp(-p1.d * t);
    let y = p2.A * Math.sin(p2.f * t + p2.p) * Math.exp(-p2.d * t) + p3.A * Math.sin(p3.f * t + p3.p) * Math.exp(-p3.d * t);
    if (H.rot) {
      const a = H.rot * t, c = Math.cos(a), s = Math.sin(a);
      const X = x * c - y * s; y = x * s + y * c; x = X;
    }
    out[0] = x; out[1] = y;
    return Math.exp(-Math.min(p0.d, p1.d, p2.d, p3.d) * t);
  }

  Things.register({
    id: 'harmonograph',
    name: 'Harmonograph',
    desc: 'Vier schwingende Pendel zeichnen filigrane Kurven.',

    thumb(c, w, h) {
      c.fillStyle = '#0b0b10';
      c.fillRect(0, 0, w, h);
      const H = makeH(9, 0.012, false), q = [0, 0], sc = h * 0.44;
      c.globalCompositeOperation = 'lighter';
      c.lineWidth = 0.7;
      for (let k = 0; k < 40; k++) {
        c.strokeStyle = `hsla(${(H.hue + k * 6) % 360},85%,60%,0.6)`;
        c.beginPath();
        for (let t = k * 7; t <= (k + 1) * 7; t += 0.02) {
          point(H, t, q);
          c.lineTo(w / 2 + q[0] * sc, h / 2 + q[1] * sc);
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
      const st = { seed: Things.randomSeed(), detune: 0.012, rotary: false, speed: 1, width: 1, color: true };
      let H, t = 0, done = false;
      const q = [0, 0], STEP = 0.004, TMAX = 900;

      function restart(newSeed) {
        if (newSeed) st.seed = Things.randomSeed();
        H = makeH(st.seed, st.detune, st.rotary);
        t = 0; done = false;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#0b0b10';
        ctx.fillRect(0, 0, S.w, S.h);
      }
      S.onresize = () => restart(false);

      const stop = Things.loop((dt) => {
        if (done) return;
        const sc = Math.min(S.w, S.h) * 0.44, ox = S.w / 2, oy = S.h / 2;
        const t1 = t + dt * 22 * st.speed;
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = st.width;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = st.color ? `hsla(${(H.hue + t * 0.7) % 360},85%,60%,0.55)` : 'rgba(235,235,245,0.45)';
        ctx.beginPath();
        point(H, t, q);
        ctx.moveTo(ox + q[0] * sc, oy + q[1] * sc);
        let amp = 1;
        for (let tt = t + STEP; tt <= t1; tt += STEP) {
          amp = point(H, tt, q);
          ctx.lineTo(ox + q[0] * sc, oy + q[1] * sc);
        }
        ctx.stroke();
        t = t1;
        if (amp < 0.02 || t > TMAX) done = true;
        hud.textContent = done ? 'fertig – tippe für eine neue Zeichnung' : `t = ${t.toFixed(0)}`;
      });

      let downAt = null;
      Things.pointer(stage, {
        down(p) { downAt = p; },
        up(p) { if (downAt && Math.hypot(p.x - downAt.x, p.y - downAt.y) < 12) restart(true); downAt = null; },
      });

      U.buttons(panel, [
        ['Neue Zeichnung', () => restart(true), true],
        ['Bild speichern', () => Things.saveCanvas(S.cv, `harmonograph-${st.seed}.png`)],
      ]);
      U.slider(panel, 'Verstimmung', { min: 0, max: 0.05, step: 0.001, value: st.detune, fmt: (v) => (v * 100).toFixed(1).replace('.', ',') + ' %',
        onChange: (v) => { st.detune = v; restart(false); } });
      U.toggle(panel, 'Drehtisch', st.rotary, (v) => { st.rotary = v; restart(false); });
      U.heading(panel, 'Stift');
      U.slider(panel, 'Tempo', { min: 0.2, max: 6, value: st.speed, fmt: (v) => v.toFixed(1).replace('.', ',') + '×', onInput: (v) => (st.speed = v) });
      U.slider(panel, 'Linienstärke', { min: 0.3, max: 3, value: st.width, onInput: (v) => (st.width = v) });
      U.toggle(panel, 'Farbig', st.color, (v) => (st.color = v));
      U.hint(panel, 'Fast ganzzahlige Frequenzverhältnisse ergeben die typischen Rosetten. Die Verstimmung lässt ' +
        'die Figur langsam wandern, der Drehtisch dreht das Papier mit.');

      restart(false);
      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
