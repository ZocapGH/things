/* Kaleidoskop – malen mit Dreh- und Spiegelsymmetrie, optional mit leuchtendem Strich und Auto-Pinsel. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  Things.register({
    id: 'kaleidoskop',
    name: 'Kaleidoskop',
    desc: 'Ein Strich, vielfach gespiegelt – Mandalas malen ohne Talent.',

    thumb(c, w, h) {
      c.fillStyle = '#07070b';
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'lighter';
      const n = 10, cx = w / 2, cy = h / 2;
      for (let s = 0; s < 3; s++) {
        c.strokeStyle = `hsla(${180 + s * 60},90%,60%,0.85)`; c.lineWidth = 1.6;
        for (let k = 0; k < n; k++) for (const m of [1, -1]) {
          c.beginPath();
          for (let t = 0; t <= 1; t += 0.02) {
            const r = h * (0.08 + 0.38 * t), a = (Math.sin(t * 6 + s * 2) * 0.25 + s * 0.12) * m + k * TAU / n;
            c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          }
          c.stroke();
        }
      }
      c.globalCompositeOperation = 'source-over';
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const st = { n: 8, mirror: true, width: 3, color: 'regenbogen', glow: true, auto: false, guides: true };
      let art = document.createElement('canvas'), actx = art.getContext('2d'), hue = Math.random() * 360;

      function fitArt() {
        const W = S.cv.width, H = S.cv.height;
        if (art.width === W && art.height === H) return;
        const old = art;
        art = document.createElement('canvas'); art.width = W; art.height = H;
        actx = art.getContext('2d');
        if (old.width > 1) actx.drawImage(old, (W - old.width) / 2, (H - old.height) / 2);
        actx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      }
      S.onresize = fitArt;
      fitArt();

      function color(alpha) {
        switch (st.color) {
          case 'weiss': return `rgba(240,240,250,${alpha})`;
          case 'pastell': return `hsla(${hue},70%,80%,${alpha})`;
          case 'feuer': return `hsla(${20 + 30 * Math.sin(hue * 0.05)},95%,58%,${alpha})`;
          default: return `hsla(${hue},92%,60%,${alpha})`;
        }
      }
      // Ein Segment n-fach (und gespiegelt) zeichnen. Koordinaten relativ zur Mitte.
      function path(x0, y0, x1, y1) {
        actx.beginPath();
        for (let k = 0; k < st.n; k++) {
          const a = k * TAU / st.n, c = Math.cos(a), s = Math.sin(a);
          actx.moveTo(x0 * c - y0 * s, x0 * s + y0 * c); actx.lineTo(x1 * c - y1 * s, x1 * s + y1 * c);
          if (st.mirror) { actx.moveTo(x0 * c + y0 * s, x0 * s - y0 * c); actx.lineTo(x1 * c + y1 * s, x1 * s - y1 * c); }
        }
      }
      function seg(ax, ay, bx, by) {
        const cx = S.w / 2, cy = S.h / 2;
        actx.save();
        actx.translate(cx, cy);
        actx.lineCap = 'round'; actx.lineJoin = 'round';
        path(ax - cx, ay - cy, bx - cx, by - cy);
        if (st.glow) {
          actx.globalCompositeOperation = 'lighter';
          actx.strokeStyle = color(0.12); actx.lineWidth = st.width * 4; actx.stroke();
          actx.strokeStyle = color(0.55); actx.lineWidth = st.width; actx.stroke();
        } else {
          actx.strokeStyle = color(1); actx.lineWidth = st.width; actx.stroke();
        }
        actx.restore();
        hue = (hue + Math.hypot(bx - ax, by - ay) * 0.25) % 360;
      }

      let last = null;
      Things.pointer(stage, {
        down(p) { last = p; seg(p.x, p.y, p.x + 0.01, p.y); },
        move(p) { if (!p.down || !last) return; seg(last.x, last.y, p.x, p.y); last = p; },
        up() { last = null; },
      });

      // Auto-Pinsel: weiche Lissajous-artige Bahn
      let at = Math.random() * 100, autoLast = null;
      const ph = [Math.random() * 6, Math.random() * 6, Math.random() * 6];
      const stop = Things.loop((dt) => {
        if (st.auto) {
          at += dt;
          const R = Math.min(S.w, S.h) * 0.45;
          const r = R * (0.5 + 0.45 * Math.sin(at * 0.37 + ph[0]) * Math.sin(at * 0.13 + ph[1]));
          const a = at * 0.5 + Math.sin(at * 0.23 + ph[2]) * 2;
          const p = { x: S.w / 2 + Math.cos(a) * r, y: S.h / 2 + Math.sin(a) * r };
          if (autoLast) seg(autoLast.x, autoLast.y, p.x, p.y);
          autoLast = p;
        } else autoLast = null;
        ctx.fillStyle = '#07070b';
        ctx.fillRect(0, 0, S.w, S.h);
        ctx.drawImage(art, 0, 0, S.w, S.h);
        if (st.guides) {
          ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
          const R = Math.hypot(S.w, S.h) / 2;
          ctx.beginPath();
          for (let k = 0; k < st.n; k++) {
            const a = k * TAU / st.n + (st.mirror ? 0 : 0);
            ctx.moveTo(S.w / 2, S.h / 2); ctx.lineTo(S.w / 2 + Math.cos(a) * R, S.h / 2 + Math.sin(a) * R);
          }
          ctx.stroke();
        }
      });

      function save() {
        const out = document.createElement('canvas');
        out.width = art.width; out.height = art.height;
        const o = out.getContext('2d');
        o.fillStyle = '#07070b'; o.fillRect(0, 0, out.width, out.height);
        o.drawImage(art, 0, 0);
        Things.saveCanvas(out, `kaleidoskop-${Date.now()}.png`);
      }
      function clear() { actx.save(); actx.setTransform(1, 0, 0, 1, 0, 0); actx.clearRect(0, 0, art.width, art.height); actx.restore(); }

      U.buttons(panel, [['Leeren', clear, true], ['Bild speichern', save]]);
      U.slider(panel, 'Spiegelachsen', { min: 1, max: 24, step: 1, value: st.n, fmt: (v) => v, onInput: (v) => (st.n = v) });
      U.toggle(panel, 'Zusätzlich spiegeln', st.mirror, (v) => (st.mirror = v));
      U.slider(panel, 'Strichstärke', { min: 0.5, max: 16, value: st.width, onInput: (v) => (st.width = v) });
      U.select(panel, 'Farbe', [['regenbogen', 'Regenbogen'], ['pastell', 'Pastell'], ['feuer', 'Feuer'], ['weiss', 'Weiß']], st.color, (v) => (st.color = v));
      U.toggle(panel, 'Leuchten', st.glow, (v) => (st.glow = v));
      U.toggle(panel, 'Hilfslinien', st.guides, (v) => (st.guides = v));
      U.toggle(panel, 'Auto-Pinsel', st.auto, (v) => (st.auto = v));
      U.hint(panel, 'Einfach drauflos malen – jeder Strich wird um die Mitte gedreht und gespiegelt. ' +
        'Der Auto-Pinsel malt von selbst, solange er eingeschaltet ist.');

      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
