/* Chladni-Figuren – Sand auf einer schwingenden Platte sammelt sich an den Knotenlinien.
   Eigenschwingungen einer quadratischen Platte (Näherung), Ton per Web Audio (selbst erzeugt). */
(function () {
  'use strict';
  const PI = Math.PI;
  const MODES = [];
  for (let n = 1; n <= 10; n++) for (let m = n + 1; m <= 13; m++) { MODES.push([n, m, -1]); MODES.push([n, m, 1]); }
  MODES.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]) || a[2] - b[2]);
  const field = (md, x, y) => Math.cos(md[0] * PI * x) * Math.cos(md[1] * PI * y) + md[2] * Math.cos(md[1] * PI * x) * Math.cos(md[0] * PI * y);
  const freqOf = (md) => Math.round(60 * Math.pow(md[0] * md[0] + md[1] * md[1], 0.75));

  Things.register({
    id: 'chladni',
    name: 'Chladni-Figuren',
    desc: 'Ein Ton bringt Sand zum Tanzen – und es entstehen Muster.',

    thumb(c, w, h) {
      c.fillStyle = '#0b0b10';
      c.fillRect(0, 0, w, h);
      const s = h * 0.9, ox = (w - s) / 2, oy = (h - s) / 2;
      c.fillStyle = '#26262e';
      c.fillRect(ox, oy, s, s);
      const R = Things.rng(5), md = [3, 5, -1];
      c.fillStyle = '#f0d9a0';
      for (let i = 0; i < 9000; i++) {
        const x = R(), y = R();
        if (Math.abs(field(md, x, y)) < 0.07) c.fillRect(ox + x * s, oy + y * s, 1.2, 1.2);
      }
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { mode: 6, n: 14000, shake: 1, sound: false, auto: false, vol: 0.5 };
      const G = 220;
      const ddx = new Float32Array(G * G), ddy = new Float32Array(G * G);
      let kick = 0;
      let amp = new Float32Array(G * G), px, py, count = 0, ac = null, osc = null, gain = null, autoT = 0;

      function computeField() {
        const md = MODES[st.mode];
        for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) amp[j * G + i] = Math.abs(field(md, (i + 0.5) / G, (j + 0.5) / G)) * 0.5;
        // Gefälle der Schwingstärke: Sand rutscht von stark schwingenden Stellen weg
        for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
          const k = j * G + i, l = i > 0 ? k - 1 : k, r = i < G - 1 ? k + 1 : k, u = j > 0 ? k - G : k, d = j < G - 1 ? k + G : k;
          const gx = (amp[r] - amp[l]) * G * 0.5, gy = (amp[d] - amp[u]) * G * 0.5, n = Math.hypot(gx, gy) + 4;
          ddx[k] = -gx / n; ddy[k] = -gy / n;
        }
        if (osc) osc.frequency.setTargetAtTime(freqOf(md), ac.currentTime, 0.05);
        kick = 0.5; // kurz kräftig rütteln, damit sich der Sand neu verteilt
      }
      function sprinkle(n, cx, cy, r) {
        for (let k = 0; k < n; k++) {
          const i = count < MAXN ? count++ : (Math.random() * count) | 0;
          if (cx === undefined) { px[i] = Math.random(); py[i] = Math.random(); }
          else { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r; px[i] = Math.min(1, Math.max(0, cx + Math.cos(a) * d)); py[i] = Math.min(1, Math.max(0, cy + Math.sin(a) * d)); }
        }
      }
      const MAXN = 40000;
      px = new Float32Array(MAXN); py = new Float32Array(MAXN);
      function reset() { count = 0; sprinkle(st.n); }

      function plate() {
        const s = Math.min(S.w, S.h - 70) * 0.92;
        return { s, ox: (S.w - s) / 2, oy: Math.max(64, (S.h - s) / 2 + 20) };
      }
      function sound(on) {
        st.sound = on;
        if (on) {
          if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
          ac.resume();
          osc = ac.createOscillator(); gain = ac.createGain();
          osc.type = 'sine'; osc.frequency.value = freqOf(MODES[st.mode]);
          gain.gain.value = 0;
          gain.gain.setTargetAtTime(0.08 * st.vol, ac.currentTime, 0.1);
          osc.connect(gain); gain.connect(ac.destination); osc.start();
        } else if (osc) {
          const o = osc, g = gain;
          g.gain.setTargetAtTime(0, ac.currentTime, 0.05);
          setTimeout(() => { try { o.stop(); } catch (_) {} }, 300);
          osc = null; gain = null;
        }
      }

      // ---- Mikrofon: lautester Ton wählt die Schwingungsform, Lautstärke bestimmt das Rütteln ----
      // Alles wird nur auf dem Gerät ausgewertet, nichts aufgenommen oder verschickt.
      let mic = null, micNote = '';
      const FREQS = MODES.map(freqOf);
      async function micOn(on) {
        st.mic = on;
        if (!on) { stopMic(); return; }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          micNote = 'Mikrofon wird hier nicht unterstützt (nur über https)'; micBox.checked = false; st.mic = false; return;
        }
        try {
          if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
          await ac.resume();
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
          if (!st.mic) { stream.getTracks().forEach((t) => t.stop()); return; }
          const src = ac.createMediaStreamSource(stream), an = ac.createAnalyser();
          an.fftSize = 4096; an.smoothingTimeConstant = 0.3;
          src.connect(an);
          mic = { stream, src, an, spec: new Float32Array(an.frequencyBinCount), wave: new Float32Array(an.fftSize), level: 0, hz: 0, cand: -1, candT: 0 };
          micNote = '';
          if (st.sound) { sound(false); soundBox.checked = false; } // eigener Ton würde sich selbst hören
          if (st.auto) { st.auto = false; autoBox.checked = false; }
        } catch (e) {
          micNote = 'Kein Zugriff aufs Mikrofon – bitte im Browser erlauben';
          micBox.checked = false; st.mic = false;
        }
      }
      function stopMic() {
        if (mic) { mic.stream.getTracks().forEach((t) => t.stop()); mic.src.disconnect(); }
        mic = null;
      }
      function listen(dt) {
        const m = mic, an = m.an;
        an.getFloatTimeDomainData(m.wave);
        let rms = 0;
        for (let i = 0; i < m.wave.length; i++) rms += m.wave[i] * m.wave[i];
        rms = Math.sqrt(rms / m.wave.length);
        const lvl = Math.max(0, Math.min(1, (20 * Math.log10(rms + 1e-9) + 58) / 38));
        m.level += (lvl - m.level) * Math.min(1, dt * 12);
        // Tonhöhe: stärkste Spektrallinie zwischen 150 und 4300 Hz (mit Parabel-Verfeinerung)
        an.getFloatFrequencyData(m.spec);
        const binHz = ac.sampleRate / an.fftSize, lo = Math.floor(150 / binHz), hi = Math.min(m.spec.length - 2, Math.ceil(4300 / binHz));
        let best = lo, sum = 0;
        for (let i = lo; i <= hi; i++) { sum += m.spec[i]; if (m.spec[i] > m.spec[best]) best = i; }
        const peak = m.spec[best], avg = sum / (hi - lo + 1);
        if (peak > -70 && peak - avg > 22 && lvl > 0.05) {
          const a = m.spec[best - 1], b = peak, c = m.spec[best + 1], off = 0.5 * (a - c) / (a - 2 * b + c || 1);
          m.hz = (best + off) * binHz;
          let mi = 0, md = Infinity;
          for (let i = 0; i < FREQS.length; i++) { const d = Math.abs(Math.log2(FREQS[i] / m.hz)); if (d < md) { md = d; mi = i; } }
          // kurz stabil halten, bevor umgeschaltet wird (gegen Flackern)
          if (mi !== st.mode) {
            if (mi === m.cand) m.candT += dt; else { m.cand = mi; m.candT = 0; }
            if (m.candT > 0.12) { st.mode = mi; modeS.value = mi; computeField(); kick = 0.2; m.cand = -1; }
          } else m.cand = -1;
        } else m.hz = 0;
      }

      const stop = Things.loop((dt) => {
        if (st.auto) {
          autoT += dt;
          if (autoT > 4) { autoT = 0; st.mode = (st.mode + 1) % MODES.length; modeS.value = st.mode; computeField(); }
        }
        if (mic) listen(dt);
        // Sand hüpft – je stärker die Platte an dieser Stelle schwingt, desto weiter.
        // Mit Mikrofon: Stille = Platte ruht, lauter = stärker.
        const loud = mic ? Math.min(1.6, mic.level * 1.8) : 1;
        const k = 0.025 * st.shake * loud, drift = 0.0025 * st.shake * loud, extra = kick * 0.06 * (mic ? mic.level : 1);
        kick = Math.max(0, kick - dt);
        for (let i = 0; i < count; i++) {
          const gx = (px[i] * G) | 0, gy = (py[i] * G) | 0, gi = (gy < G ? gy : G - 1) * G + (gx < G ? gx : G - 1);
          const a = amp[gi] * k + (mic ? 0 : 0.00015) + extra;
          let x = px[i] + (Math.random() - 0.5) * a + ddx[gi] * drift, y = py[i] + (Math.random() - 0.5) * a + ddy[gi] * drift;
          px[i] = x < 0 ? -x : x > 1 ? 2 - x : x;
          py[i] = y < 0 ? -y : y > 1 ? 2 - y : y;
        }
        const { s, ox, oy } = plate();
        ctx.fillStyle = '#0b0b10';
        ctx.fillRect(0, 0, S.w, S.h);
        const g = ctx.createLinearGradient(ox, oy, ox + s, oy + s);
        g.addColorStop(0, '#34343e'); g.addColorStop(0.5, '#23232b'); g.addColorStop(1, '#2e2e37');
        ctx.fillStyle = g;
        ctx.fillRect(ox, oy, s, s);
        ctx.fillStyle = '#7a7a88';
        ctx.beginPath(); ctx.arc(ox + s / 2, oy + s / 2, 4, 0, 7); ctx.fill();
        ctx.fillStyle = '#f0d9a0';
        const ps = Math.max(1, s / 500);
        for (let i = 0; i < count; i++) ctx.fillRect(ox + px[i] * s, oy + py[i] * s, ps, ps);
        const md = MODES[st.mode], form = `Schwingungsform (${md[0]}, ${md[1]})${md[2] > 0 ? '+' : '−'}`;
        if (mic) {
          // Pegelanzeige unter der Platte
          const bw = s * Math.min(1, mic.level), by = Math.min(S.h - 10, oy + s + 8);
          ctx.fillStyle = '#2a2a36'; ctx.fillRect(ox, by, s, 5);
          ctx.fillStyle = mic.level > 0.85 ? '#ff4d6d' : '#3ddc84'; ctx.fillRect(ox, by, bw, 5);
          hud.textContent = (mic.hz ? `Gehört: ${Math.round(mic.hz)} Hz → ${freqOf(md)} Hz   ` : 'Mikrofon: pfeif, sing oder spiel einen Ton   ') + form;
        } else hud.textContent = micNote || `${freqOf(md)} Hz   ${form}`;
      });

      Things.pointer(stage, {
        down(p) {
          const { s, ox, oy } = plate();
          const x = (p.x - ox) / s, y = (p.y - oy) / s;
          if (x >= 0 && y >= 0 && x <= 1 && y <= 1) sprinkle(1500, x, y, 0.06);
        },
      });

      const modeS = U.slider(panel, 'Frequenz', { min: 0, max: MODES.length - 1, step: 1, value: st.mode,
        fmt: (v) => freqOf(MODES[v]) + ' Hz', onInput: (v) => { st.mode = v; computeField(); } });
      const micBox = U.toggle(panel, 'Mikrofon (pfeifen, singen, Instrument)', false, (v) => { micNote = ''; micOn(v); });
      const soundBox = U.toggle(panel, 'Ton', st.sound, (v) => {
        if (v && mic) { micOn(false); micBox.checked = false; }
        sound(v);
      });
      U.slider(panel, 'Lautstärke', { min: 0, max: 1, value: st.vol, fmt: (v) => Math.round(v * 100) + ' %',
        onInput: (v) => { st.vol = v; if (gain) gain.gain.setTargetAtTime(0.08 * v, ac.currentTime, 0.05); } });
      const autoBox = U.toggle(panel, 'Automatisch durchspielen', st.auto, (v) => {
        st.auto = v; autoT = 0;
        if (v && mic) { micOn(false); micBox.checked = false; }
      });
      U.slider(panel, 'Schwingstärke', { min: 0.3, max: 3, value: st.shake, onInput: (v) => (st.shake = v) });
      U.slider(panel, 'Sandmenge', { min: 2000, max: 40000, step: 1000, value: st.n, fmt: (v) => v, onChange: (v) => { st.n = v; reset(); } });
      U.buttons(panel, [['Sand neu streuen', reset, true]]);
      U.hint(panel, 'Die Platte schwingt in einer Eigenform: Manche Linien bleiben dabei völlig ruhig (Knotenlinien). ' +
        'Dort bleibt der Sand liegen, überall sonst wird er weggeschüttelt. Höhere Töne ergeben feinere Muster. ' +
        'Tippe auf die Platte, um Sand nachzustreuen. Ernst Chladni hat das 1787 mit einem Geigenbogen entdeckt.');
      U.hint(panel, 'Mit Mikrofon wählt der lauteste Ton, den du pfeifst, singst oder spielst, die Schwingungsform – ' +
        'und je lauter, desto stärker hüpft der Sand. Pfeifen funktioniert am besten. Der Ton wird nur auf dem Gerät ' +
        'ausgewertet, nichts wird aufgenommen oder verschickt.');

      computeField();
      reset();
      return { destroy() { stop(); stopMic(); S.destroy(); if (ac) ac.close(); } };
    },
  });
})();
