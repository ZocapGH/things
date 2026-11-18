/* Flussfeld-Kunst – tausende Linien folgen einem unsichtbaren Strömungsfeld aus Perlin-Rauschen (selbst implementiert). */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const PALS = {
    ozean: ['#0b3954', '#087e8b', '#bfd7ea', '#ff5a5f', '#c81d25'],
    sonnenuntergang: ['#f8b195', '#f67280', '#c06c84', '#6c5b7b', '#355c7d'],
    wald: ['#2d6a4f', '#40916c', '#74c69d', '#b7e4c7', '#d8f3dc'],
    neon: ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0'],
    gold: ['#ffd166', '#f4a259', '#e9c46a', '#fff1d0', '#c9a227'],
    tinte: ['#111111', '#2b2b2b', '#4a4a4a', '#7a7a7a', '#b0a99f'],
  };

  // Perlins "Improved Noise" (2002) mit Permutation aus Seed
  function makeNoise(seed) {
    const R = Things.rng(seed), base = [];
    for (let i = 0; i < 256; i++) base.push(i);
    for (let i = 255; i > 0; i--) { const j = (R() * (i + 1)) | 0; [base[i], base[j]] = [base[j], base[i]]; }
    const p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) p[i] = base[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + t * (b - a);
    const grad = (h, x, y, z) => {
      const hh = h & 15, u = hh < 8 ? x : y, v = hh < 4 ? y : hh === 12 || hh === 14 ? x : z;
      return ((hh & 1) ? -u : u) + ((hh & 2) ? -v : v);
    };
    return (x, y, z) => {
      const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
      const X = fx & 255, Y = fy & 255, Z = fz & 255;
      x -= fx; y -= fy; z -= fz;
      const u = fade(x), v = fade(y), w = fade(z);
      const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
      return lerp(
        lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
        lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
        w);
    };
  }

  Things.register({
    id: 'flussfeld',
    name: 'Flussfeld-Kunst',
    desc: 'Tausende Linien folgen unsichtbaren Strömungen – jedes Bild einzigartig.',

    thumb(c, w, h) {
      c.fillStyle = '#0d0d12';
      c.fillRect(0, 0, w, h);
      const N = makeNoise(17), R = Things.rng(17), pal = PALS.ozean;
      c.lineWidth = 0.8;
      c.globalAlpha = 0.5;
      for (let i = 0; i < 700; i++) {
        let x = R() * w, y = R() * h;
        c.strokeStyle = pal[i % pal.length];
        c.beginPath(); c.moveTo(x, y);
        for (let s = 0; s < 40; s++) {
          const a = N(x * 0.012, y * 0.012, 0.5) * TAU * 1.5;
          x += Math.cos(a) * 1.6; y += Math.sin(a) * 1.6;
          c.lineTo(x, y);
        }
        c.stroke();
      }
      c.globalAlpha = 1;
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { seed: Things.randomSeed(), pal: 'ozean', paper: false, scale: 1, curl: 1.5, n: 3000, width: 0.8, alpha: 0.12, move: false, speed: 1.6 };
      let noise, x, y, ox, oy, life, colIdx, z = 0, frames = 0;
      let ptr = null;

      function restart(newSeed) {
        if (newSeed) st.seed = Things.randomSeed();
        noise = makeNoise(st.seed);
        x = new Float32Array(st.n); y = new Float32Array(st.n); ox = new Float32Array(st.n); oy = new Float32Array(st.n);
        life = new Uint16Array(st.n); colIdx = new Uint8Array(st.n);
        for (let i = 0; i < st.n; i++) spawn(i);
        ctx.globalAlpha = 1;
        ctx.fillStyle = st.paper ? '#f3eee3' : '#0d0d12';
        ctx.fillRect(0, 0, S.w, S.h);
        z = 0; frames = 0;
      }
      function spawn(i, px, py) {
        x[i] = px !== undefined ? px + (Math.random() - 0.5) * 30 : Math.random() * S.w;
        y[i] = py !== undefined ? py + (Math.random() - 0.5) * 30 : Math.random() * S.h;
        ox[i] = x[i]; oy[i] = y[i];
        life[i] = 60 + ((Math.random() * 300) | 0);
        const pal = PALS[st.pal];
        // Farbe nach Startort, damit Farbflächen entstehen
        const v = noise(x[i] * 0.002, y[i] * 0.002, 9.3) * 0.5 + 0.5;
        colIdx[i] = Math.min(pal.length - 1, Math.max(0, Math.floor(v * pal.length + (Math.random() - 0.5) * 1.2)));
      }
      S.onresize = () => restart(false);

      const stop = Things.loop((dt) => {
        if (st.move) z += dt * 0.08;
        const sc = 0.0025 * st.scale * (1000 / Math.max(500, Math.min(S.w, S.h)) * 0.6 + 0.4);
        if (ptr) for (let k = 0; k < 25; k++) spawn((Math.random() * st.n) | 0, ptr.x, ptr.y);
        for (let i = 0; i < st.n; i++) {
          ox[i] = x[i]; oy[i] = y[i];
          const a = noise(x[i] * sc, y[i] * sc, z) * TAU * st.curl;
          x[i] += Math.cos(a) * st.speed; y[i] += Math.sin(a) * st.speed;
          if (--life[i] === 0 || x[i] < -10 || y[i] < -10 || x[i] > S.w + 10 || y[i] > S.h + 10) { spawn(i); ox[i] = x[i]; oy[i] = y[i]; }
        }
        const pal = PALS[st.pal];
        ctx.globalAlpha = st.alpha;
        ctx.lineWidth = st.width;
        ctx.lineCap = 'round';
        for (let c = 0; c < pal.length; c++) {
          ctx.strokeStyle = st.paper && st.pal === 'tinte' ? pal[c] : pal[c];
          ctx.beginPath();
          for (let i = 0; i < st.n; i++) {
            if (colIdx[i] !== c) continue;
            ctx.moveTo(ox[i], oy[i]); ctx.lineTo(x[i], y[i]);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        frames++;
        hud.textContent = `#${st.seed}   ${st.n} Linien`;
      });

      Things.pointer(stage, {
        down(p) { ptr = p; },
        move(p) { if (p.down) ptr = p; },
        up() { ptr = null; },
      });

      U.buttons(panel, [['Neues Bild', () => restart(true), true], ['Bild speichern', () => Things.saveCanvas(S.cv, `flussfeld-${st.seed}.png`)]]);
      U.select(panel, 'Farben', [['ozean', 'Ozean'], ['sonnenuntergang', 'Sonnenuntergang'], ['wald', 'Wald'], ['neon', 'Neon'], ['gold', 'Gold'], ['tinte', 'Tinte']],
        st.pal, (v) => { st.pal = v; restart(false); });
      U.toggle(panel, 'Heller Hintergrund (Papier)', st.paper, (v) => { st.paper = v; restart(false); });
      U.slider(panel, 'Maßstab', { min: 0.3, max: 4, value: st.scale, onChange: (v) => { st.scale = v; restart(false); } });
      U.slider(panel, 'Verwirbelung', { min: 0.3, max: 4, value: st.curl, onChange: (v) => { st.curl = v; restart(false); } });
      U.slider(panel, 'Linien', { min: 300, max: 12000, step: 100, value: st.n, fmt: (v) => v, onChange: (v) => { st.n = v; restart(false); } });
      U.slider(panel, 'Strichstärke', { min: 0.3, max: 4, value: st.width, onInput: (v) => (st.width = v) });
      U.slider(panel, 'Deckkraft', { min: 0.02, max: 0.6, value: st.alpha, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => (st.alpha = v) });
      U.toggle(panel, 'Strömung verändert sich', st.move, (v) => (st.move = v));
      U.hint(panel, 'Das Bild malt sich selbst: Jede Linie folgt der Richtung eines unsichtbaren Feldes aus „Perlin-Rauschen“, ' +
        'wie Treibgut in einem Fluss. Mit dem Finger setzt du neue Linien an einer Stelle an. Nach einer Weile ' +
        '„Bild speichern“ – zum Beispiel als Handy-Hintergrund.');

      restart(false);
      return { destroy() { stop(); S.destroy(); } };
    },
  });
})();
