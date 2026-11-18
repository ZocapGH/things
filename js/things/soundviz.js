/* Klang sehen – Mikrofon live als Spektrogramm (logarithmische Frequenzachse), Schwingungskurve
   und Tonhöhe mit Notennamen (Autokorrelation). Alles wird nur auf dem Gerät ausgewertet. */
(function () {
  'use strict';
  const NOTES = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'B', 'H'];
  const FMIN = 50, FMAX = 12000;
  const SCHEMES = {
    glut: [[0, [4, 4, 12]], [0.3, [70, 12, 110]], [0.55, [190, 40, 70]], [0.78, [250, 140, 30]], [1, [255, 250, 200]]],
    ozean: [[0, [3, 6, 18]], [0.4, [10, 60, 120]], [0.7, [40, 190, 200]], [1, [230, 255, 250]]],
    gruen: [[0, [3, 8, 4]], [0.5, [20, 140, 50]], [1, [210, 255, 140]]],
  };
  function lutFor(name) {
    const s = SCHEMES[name], lut = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let j = 0;
      while (j < s.length - 2 && t > s[j + 1][0]) j++;
      const [t0, a] = s[j], [t1, b] = s[j + 1], f = (t - t0) / (t1 - t0);
      for (let c = 0; c < 3; c++) lut[i * 3 + c] = a[c] + (b[c] - a[c]) * f;
    }
    return lut;
  }
  function noteOf(hz) {
    const n = Math.round(12 * Math.log2(hz / 440)), cents = Math.round(100 * (12 * Math.log2(hz / 440) - n));
    const idx = ((n + 9) % 12 + 12) % 12, oct = 4 + Math.floor((n + 9) / 12);
    return { name: NOTES[idx] + oct, cents };
  }
  // Grundton per normierter Autokorrelation (robuster als Spektralspitze bei Stimme)
  function pitch(buf, rate) {
    const n = buf.length >> 1, minLag = Math.floor(rate / 1200), maxLag = Math.min(n - 1, Math.floor(rate / 70));
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    if (Math.sqrt(rms / buf.length) < 0.01) return 0;
    const corr = new Float32Array(maxLag + 2);
    for (let lag = minLag; lag <= maxLag + 1; lag++) {
      let s = 0, e1 = 0, e2 = 0;
      for (let i = 0; i < n; i++) { const a = buf[i], b = buf[i + lag]; s += a * b; e1 += a * a; e2 += b * b; }
      corr[lag] = s / Math.sqrt(e1 * e2 + 1e-12);
    }
    // erstes deutliches Maximum (vermeidet Oktavfehler nach unten)
    let best = -1, bestV = 0;
    const thr = 0.9 * Math.max(...corr.subarray(minLag, maxLag + 1));
    for (let lag = minLag + 1; lag <= maxLag; lag++) {
      if (corr[lag] >= thr && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) { best = lag; bestV = corr[lag]; break; }
    }
    if (best < 0 || bestV < 0.75) return 0;
    const a = corr[best - 1], b = corr[best], c = corr[best + 1], off = 0.5 * (a - c) / (a - 2 * b + c || 1);
    return rate / (best + off);
  }

  Things.register({
    id: 'klang',
    name: 'Klang sehen',
    desc: 'Pfeifen, singen, sprechen – und sehen, wie Töne aussehen.',

    thumb(c, w, h) {
      const cv = c.canvas, W = cv.width, H = cv.height, img = c.createImageData(W, H), d = img.data, lut = lutFor('glut');
      for (let x = 0; x < W; x++) {
        const t = x / W, f0 = 0.35 + 0.1 * Math.sin(t * 9) + (t > 0.5 ? 0.12 : 0);
        for (let y = 0; y < H; y++) {
          const fy = 1 - y / (H * 0.72);
          let v = 0;
          for (let k = 1; k <= 5; k++) { const pos = f0 + Math.log2(k) * 0.16; v += Math.exp(-(((fy - pos) * H * 0.72) ** 2) / 6) / k; }
          v = y > H * 0.72 ? 0 : Math.min(1, v + 0.05 * Math.random());
          const j = ((v * 255) | 0) * 3, o = (y * W + x) * 4;
          d[o] = lut[j]; d[o + 1] = lut[j + 1]; d[o + 2] = lut[j + 2]; d[o + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
      c.strokeStyle = '#3ddc84'; c.lineWidth = 1.5;
      c.beginPath();
      for (let x = 0; x <= w; x += 2) c.lineTo(x, h * 0.86 + Math.sin(x * 0.18) * h * 0.06 + Math.sin(x * 0.36) * h * 0.02);
      c.stroke();
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { scheme: 'glut', gain: 1, speed: 2, notes: true, freeze: false };
      let lut = lutFor(st.scheme), ac = null, mic = null, note = '', hz = 0, hzSmooth = 0, msg = 'Tippe auf „Mikrofon starten“';
      const spec = document.createElement('canvas'), sctx = spec.getContext('2d');

      const area = () => { const top = 64, bot = Math.round(S.h * 0.3); return { top, h: S.h - top - bot, wy: S.h - bot, wh: bot }; };
      function fitSpec() {
        const A = area(), W = Math.max(2, Math.round(S.w * S.dpr)), H = Math.max(2, Math.round(A.h * S.dpr));
        if (spec.width === W && spec.height === H) return;
        const old = spec.width > 2 ? (() => { const c = document.createElement('canvas'); c.width = spec.width; c.height = spec.height; c.getContext('2d').drawImage(spec, 0, 0); return c; })() : null;
        spec.width = W; spec.height = H;
        sctx.fillStyle = `rgb(${lut[0]},${lut[1]},${lut[2]})`; sctx.fillRect(0, 0, W, H);
        if (old) sctx.drawImage(old, W - old.width, 0, old.width, H);
      }
      S.onresize = fitSpec;
      fitSpec();

      async function start() {
        if (mic) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg = 'Mikrofon wird hier nicht unterstützt (nur über https)'; return; }
        try {
          ac = ac || new (window.AudioContext || window.webkitAudioContext)();
          await ac.resume();
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
          const src = ac.createMediaStreamSource(stream), an = ac.createAnalyser();
          an.fftSize = 4096; an.smoothingTimeConstant = 0.2; an.minDecibels = -95; an.maxDecibels = -20;
          src.connect(an);
          mic = { stream, src, an, freq: new Uint8Array(an.frequencyBinCount), wave: new Float32Array(an.fftSize) };
          msg = ''; startBtn.textContent = 'Mikrofon aus';
        } catch (e) { msg = 'Kein Zugriff aufs Mikrofon – bitte im Browser erlauben'; }
      }
      function stopMic() {
        if (mic) { mic.stream.getTracks().forEach((t) => t.stop()); mic.src.disconnect(); }
        mic = null; startBtn.textContent = 'Mikrofon starten'; msg = 'Mikrofon aus';
      }

      // Zeile im Spektrogramm (Pixel y) -> Frequenz (logarithmisch)
      const yToHz = (y, H) => FMIN * Math.pow(FMAX / FMIN, 1 - y / H);
      let col = null, colH = 0, rowBin = null;
      const stop = Things.loop(() => {
        const A = area();
        fitSpec();
        if (mic && !st.freeze) {
          const an = mic.an, H = spec.height, binHz = ac.sampleRate / an.fftSize;
          an.getByteFrequencyData(mic.freq);
          an.getFloatTimeDomainData(mic.wave);
          if (!col || colH !== H) {
            col = sctx.createImageData(1, H); colH = H;
            rowBin = new Float32Array(H);
            for (let y = 0; y < H; y++) rowBin[y] = yToHz(y + 0.5, H) / binHz;
          }
          const dx = Math.max(1, Math.round(st.speed * S.dpr));
          sctx.drawImage(spec, -dx, 0);
          const d = col.data;
          for (let y = 0; y < H; y++) {
            const b = rowBin[y], i = b | 0, f = b - i;
            let v = (mic.freq[i] * (1 - f) + (mic.freq[i + 1] || 0) * f) / 255;
            v = Math.min(1, Math.max(0, (v - 0.12) * 1.25 * st.gain));
            const j = ((v * 255) | 0) * 3, o = y * 4;
            d[o] = lut[j]; d[o + 1] = lut[j + 1]; d[o + 2] = lut[j + 2]; d[o + 3] = 255;
          }
          for (let k = 0; k < dx; k++) sctx.putImageData(col, spec.width - 1 - k, 0);
          hz = pitch(mic.wave, ac.sampleRate);
          if (hz) { hzSmooth = hzSmooth ? hzSmooth * 0.6 + hz * 0.4 : hz; const nn = noteOf(hzSmooth); note = `${nn.name}  ${Math.round(hzSmooth)} Hz  ${nn.cents >= 0 ? '+' : ''}${nn.cents} Cent`; }
          else { hzSmooth = 0; note = ''; }
        }
        // Zeichnen
        ctx.fillStyle = '#07070b';
        ctx.fillRect(0, 0, S.w, S.h);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spec, 0, A.top, S.w, A.h);
        // Frequenzraster
        ctx.font = '11px system-ui,sans-serif'; ctx.textBaseline = 'middle';
        for (const f of [100, 200, 500, 1000, 2000, 5000, 10000]) {
          const y = A.top + A.h * (1 - Math.log(f / FMIN) / Math.log(FMAX / FMIN));
          ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S.w, y); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.fillText(f >= 1000 ? f / 1000 + ' kHz' : f + ' Hz', 8, y - 7);
        }
        if (hzSmooth && st.notes) {
          const y = A.top + A.h * (1 - Math.log(hzSmooth / FMIN) / Math.log(FMAX / FMIN));
          ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.moveTo(S.w - 2, y); ctx.lineTo(S.w - 12, y - 6); ctx.lineTo(S.w - 12, y + 6); ctx.fill();
        }
        // Schwingungskurve (auf steigenden Nulldurchgang getriggert, damit sie stillsteht)
        ctx.fillStyle = '#0d0d14'; ctx.fillRect(0, A.wy, S.w, A.wh);
        ctx.strokeStyle = '#2a2a36'; ctx.beginPath(); ctx.moveTo(0, A.wy + A.wh / 2); ctx.lineTo(S.w, A.wy + A.wh / 2); ctx.stroke();
        if (mic) {
          const w = mic.wave;
          let s0 = 0;
          for (let i = 1; i < w.length / 2; i++) if (w[i - 1] < 0 && w[i] >= 0) { s0 = i; break; }
          const span = Math.min(w.length - s0, Math.round(ac.sampleRate * 0.025));
          let mx = 0.02;
          for (let i = 0; i < span; i++) mx = Math.max(mx, Math.abs(w[s0 + i]));
          const k = (A.wh * 0.42) / Math.max(mx, 0.08);
          ctx.strokeStyle = '#3ddc84'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
          ctx.beginPath();
          for (let i = 0; i < span; i++) ctx.lineTo(i / (span - 1) * S.w, A.wy + A.wh / 2 - w[s0 + i] * k);
          ctx.stroke();
        }
        if (st.notes && note) {
          ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.round(Math.min(34, S.w / 14))}px system-ui,sans-serif`;
          ctx.textAlign = 'right'; ctx.textBaseline = 'top';
          ctx.fillText(note.split('  ')[0], S.w - 16, A.wy + 10);
          ctx.font = '13px system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText(note.split('  ').slice(1).join('   '), S.w - 16, A.wy + 14 + Math.min(34, S.w / 14));
          ctx.textAlign = 'left';
        }
        if (msg) {
          ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '16px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(msg, S.w / 2, A.top + A.h / 2); ctx.textAlign = 'left';
        }
        hud.textContent = st.freeze && mic ? 'angehalten' : '';
      });

      const [startBtn] = U.buttons(panel, [['Mikrofon starten', () => (mic ? stopMic() : start()), true]]);
      const [frzBtn] = U.buttons(panel, [
        ['Anhalten', () => { st.freeze = !st.freeze; frzBtn.textContent = st.freeze ? 'Weiter' : 'Anhalten'; }],
        ['Bild speichern', () => Things.saveCanvas(S.cv, `klang-${Date.now()}.png`)],
      ]);
      U.select(panel, 'Farben', [['glut', 'Glut'], ['ozean', 'Ozean'], ['gruen', 'Grün']], st.scheme, (v) => { st.scheme = v; lut = lutFor(v); });
      U.slider(panel, 'Empfindlichkeit', { min: 0.5, max: 3, value: st.gain, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => (st.gain = v) });
      U.slider(panel, 'Laufgeschwindigkeit', { min: 1, max: 6, step: 1, value: st.speed, fmt: (v) => v + ' px', onInput: (v) => (st.speed = v) });
      U.toggle(panel, 'Tonhöhe und Notenname', st.notes, (v) => (st.notes = v));
      U.hint(panel, 'Oben läuft das Spektrogramm: von unten (tief) nach oben (hoch), hell = laut. Ein gepfiffener Ton ist ' +
        'ein einzelner Strich, eine Stimme ein ganzer Fächer aus Obertönen, ein „sch“ ein breites Rauschen. Unten siehst ' +
        'du die Schwingung selbst und den gesungenen Ton als Notennamen. Der Ton wird nur auf dem Gerät ausgewertet, ' +
        'nichts wird aufgenommen oder verschickt.');

      // Auf großen Bildschirmen Mikrofon-Knopf gleich sichtbar machen
      panel.classList.remove('closed');
      return { destroy() { stop(); stopMic(); S.destroy(); if (ac) ac.close(); } };
    },
  });
})();
