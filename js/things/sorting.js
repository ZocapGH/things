/* Sortieren – neun Sortieralgorithmen als Balken-Animation, mit Ton (Web Audio, selbst erzeugt). */
(function () {
  'use strict';
  const swap = (a, i, j) => { const t = a[i]; a[i] = a[j]; a[j] = t; };

  function* bubble(a) {
    for (let n = a.length; n > 1; n--) {
      let sw = false;
      for (let i = 0; i < n - 1; i++) {
        yield ['cmp', i, i + 1];
        if (a[i] > a[i + 1]) { swap(a, i, i + 1); yield ['swap', i, i + 1]; sw = true; }
      }
      if (!sw) return;
    }
  }
  function* cocktail(a) {
    let lo = 0, hi = a.length - 1, sw = true;
    while (sw) {
      sw = false;
      for (let i = lo; i < hi; i++) { yield ['cmp', i, i + 1]; if (a[i] > a[i + 1]) { swap(a, i, i + 1); yield ['swap', i, i + 1]; sw = true; } }
      hi--;
      for (let i = hi; i > lo; i--) { yield ['cmp', i - 1, i]; if (a[i - 1] > a[i]) { swap(a, i - 1, i); yield ['swap', i - 1, i]; sw = true; } }
      lo++;
    }
  }
  function* insertion(a) {
    for (let i = 1; i < a.length; i++) {
      for (let j = i; j > 0; j--) {
        yield ['cmp', j - 1, j];
        if (a[j - 1] > a[j]) { swap(a, j - 1, j); yield ['swap', j - 1, j]; } else break;
      }
    }
  }
  function* selection(a) {
    for (let i = 0; i < a.length - 1; i++) {
      let m = i;
      for (let j = i + 1; j < a.length; j++) { yield ['cmp', m, j]; if (a[j] < a[m]) m = j; }
      if (m !== i) { swap(a, i, m); yield ['swap', i, m]; }
    }
  }
  function* shell(a) {
    const gaps = [701, 301, 132, 57, 23, 10, 4, 1].filter((g) => g < a.length);
    for (const g of gaps) {
      for (let i = g; i < a.length; i++) {
        for (let j = i; j >= g; j -= g) {
          yield ['cmp', j - g, j];
          if (a[j - g] > a[j]) { swap(a, j - g, j); yield ['swap', j - g, j]; } else break;
        }
      }
    }
  }
  function* quick(a, lo = 0, hi = a.length - 1) {
    if (lo >= hi) return;
    const pv = a[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) {
      while (true) { yield ['cmp', i, j]; if (a[i] < pv) i++; else break; }
      while (true) { yield ['cmp', j, i]; if (a[j] > pv) j--; else break; }
      if (i <= j) { swap(a, i, j); yield ['swap', i, j]; i++; j--; }
    }
    yield* quick(a, lo, j);
    yield* quick(a, i, hi);
  }
  function* merge(a) {
    const n = a.length;
    for (let w = 1; w < n; w *= 2) {
      for (let lo = 0; lo < n - w; lo += 2 * w) {
        const mid = lo + w, hi = Math.min(lo + 2 * w, n), aux = a.slice(lo, hi);
        let i = 0, j = w, k = lo;
        while (i < w && j < hi - lo) {
          yield ['cmp', lo + i, lo + j];
          a[k] = aux[i] <= aux[j] ? aux[i++] : aux[j++];
          yield ['set', k++];
        }
        while (i < w) { a[k] = aux[i++]; yield ['set', k++]; }
        while (j < hi - lo) { a[k] = aux[j++]; yield ['set', k++]; }
        void mid;
      }
    }
  }
  function* heap(a) {
    const n = a.length;
    function* sift(i, end) {
      while (true) {
        let c = 2 * i + 1;
        if (c >= end) return;
        if (c + 1 < end) { yield ['cmp', c, c + 1]; if (a[c + 1] > a[c]) c++; }
        yield ['cmp', i, c];
        if (a[c] <= a[i]) return;
        swap(a, i, c); yield ['swap', i, c];
        i = c;
      }
    }
    for (let i = (n >> 1) - 1; i >= 0; i--) yield* sift(i, n);
    for (let end = n - 1; end > 0; end--) { swap(a, 0, end); yield ['swap', 0, end]; yield* sift(0, end); }
  }
  function* radix(a) {
    const max = Math.max(...a);
    for (let e = 1; Math.floor(max / e) > 0; e *= 10) {
      const buckets = Array.from({ length: 10 }, () => []);
      for (let i = 0; i < a.length; i++) { buckets[Math.floor(a[i] / e) % 10].push(a[i]); yield ['read', i]; }
      let k = 0;
      for (const b of buckets) for (const v of b) { a[k] = v; yield ['set', k++]; }
    }
  }
  function* bogo(a) {
    while (true) {
      let ok = true;
      for (let i = 0; i < a.length - 1; i++) { yield ['cmp', i, i + 1]; if (a[i] > a[i + 1]) { ok = false; break; } }
      if (ok) return;
      for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; swap(a, i, j); yield ['swap', i, j]; }
    }
  }
  const ALGOS = {
    quick: ['Quicksort', quick], merge: ['Mergesort', merge], heap: ['Heapsort', heap], shell: ['Shellsort', shell],
    radix: ['Radixsort (LSD)', radix], insertion: ['Insertionsort', insertion], selection: ['Selectionsort', selection],
    bubble: ['Bubblesort', bubble], cocktail: ['Cocktailsort', cocktail], bogo: ['Bogosort (reine Glückssache)', bogo],
  };

  Things.register({
    id: 'sortieren',
    name: 'Sortieren',
    desc: 'Quicksort, Bubblesort & Co. – zum Zuschauen und Zuhören.',

    thumb(c, w, h) {
      c.fillStyle = '#0b0b10';
      c.fillRect(0, 0, w, h);
      const n = 48, a = [], R = Things.rng(8);
      for (let i = 0; i < n; i++) a.push(i + 1);
      for (let i = 0; i < 26; i++) { const j = i + ((R() * (n - i)) | 0); swap(a, i, j); }
      a.slice(0, 22).sort((x, y) => x - y).forEach((v, i) => (a[i] = v));
      const bw = w / n;
      for (let i = 0; i < n; i++) {
        const H = a[i] / n * h * 0.85;
        c.fillStyle = i === 23 || i === 31 ? '#ffffff' : `hsl(${a[i] / n * 300},80%,60%)`;
        c.fillRect(i * bw + 0.5, h - H, bw - 1, H);
      }
    },

    create(stage, panel) {
      const U = Things.ui;
      const S = Things.canvas(stage);
      const ctx = S.ctx;
      const hud = U.hud(stage);
      const st = { algo: 'quick', n: 120, speed: 6, data: 'zufall', sound: true, run: false };
      let a = [], gen = null, done = false, sweep = -1, marks = {}, cmps = 0, writes = 0, ac = null;

      function fill() {
        const n = st.n;
        a = [];
        for (let i = 0; i < n; i++) a.push(st.data === 'wenige' ? 1 + Math.floor(i / n * 6) * Math.ceil(n / 6) : i + 1);
        if (st.data === 'umgekehrt') a.reverse();
        else {
          const swaps = st.data === 'fast' ? Math.max(2, n / 20) : n;
          for (let s = 0; s < swaps; s++) {
            const i = st.data === 'fast' ? (Math.random() * n) | 0 : n - 1 - s, j = st.data === 'fast' ? Math.min(n - 1, i + ((Math.random() * 6) | 0)) : (Math.random() * (i + 1)) | 0;
            swap(a, i, j);
          }
        }
        gen = null; done = false; sweep = -1; marks = {}; cmps = 0; writes = 0;
        st.run = false;
        if (runBtn) runBtn.textContent = 'Start';
      }
      function beep(v) {
        if (!st.sound || !ac) return;
        const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle';
        o.frequency.value = 160 + (v / st.n) * 1000;
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        o.connect(g); g.connect(ac.destination);
        o.start(t); o.stop(t + 0.08);
      }

      const stop = Things.loop(() => {
        marks = {};
        if (st.run && !done) {
          if (!gen) gen = ALGOS[st.algo][1](a);
          const ops = Math.max(1, Math.round(Math.pow(10, st.speed / 4) / 3));
          let lastIdx = -1;
          for (let k = 0; k < ops; k++) {
            const r = gen.next();
            if (r.done) { done = true; sweep = 0; break; }
            const [op, i, j] = r.value;
            if (op === 'cmp') { cmps++; marks[i] = 1; if (j !== undefined) marks[j] = 1; }
            else if (op === 'swap') { writes += 2; marks[i] = 2; marks[j] = 2; }
            else if (op === 'set') { writes++; marks[i] = 2; }
            else marks[i] = 1;
            lastIdx = i;
          }
          if (lastIdx >= 0) beep(a[lastIdx]);
        }
        if (done && sweep >= 0 && sweep < a.length) {
          const step = Math.max(1, Math.ceil(a.length / 70));
          sweep = Math.min(a.length, sweep + step);
          beep(a[sweep - 1]);
        }
        // Zeichnen
        ctx.fillStyle = '#0b0b10';
        ctx.fillRect(0, 0, S.w, S.h);
        const n = a.length, top = Math.max(80, S.h * 0.1), H = S.h - top - 10, bw = S.w / n, maxV = Math.max(...a);
        for (let i = 0; i < n; i++) {
          const h = a[i] / maxV * H;
          ctx.fillStyle = i < sweep ? '#3ddc84' : marks[i] === 2 ? '#ff4d6d' : marks[i] === 1 ? '#ffffff' : `hsl(${a[i] / maxV * 300},80%,60%)`;
          ctx.fillRect(i * bw + (bw > 3 ? 0.5 : 0), S.h - 10 - h, Math.max(1, bw - (bw > 3 ? 1 : 0)), h);
        }
        hud.textContent = `${ALGOS[st.algo][0]}   Vergleiche ${cmps}   Schreibzugriffe ${writes}` + (done ? '   ✓ sortiert' : '');
      });

      let runBtn = null;
      [runBtn] = U.buttons(panel, [
        ['Start', () => {
          if (!ac && (window.AudioContext || window.webkitAudioContext)) ac = new (window.AudioContext || window.webkitAudioContext)();
          if (ac && ac.state === 'suspended') ac.resume();
          if (done) fill();
          st.run = !st.run;
          runBtn.textContent = st.run ? 'Pause' : 'Weiter';
        }, true],
        ['Mischen', () => fill()],
      ]);
      U.select(panel, 'Algorithmus', Object.entries(ALGOS).map(([k, v]) => [k, v[0]]), st.algo, (v) => { st.algo = v; fill(); });
      U.select(panel, 'Startdaten', [['zufall', 'Zufällig'], ['fast', 'Fast sortiert'], ['umgekehrt', 'Umgekehrt'], ['wenige', 'Wenige verschiedene Werte']],
        st.data, (v) => { st.data = v; fill(); });
      U.slider(panel, 'Anzahl', { min: 8, max: 600, step: 1, value: st.n, fmt: (v) => v, onChange: (v) => { st.n = v; fill(); } });
      U.slider(panel, 'Tempo', { min: 0, max: 16, step: 1, value: st.speed, fmt: (v) => Math.max(1, Math.round(Math.pow(10, v / 4) / 3)) + ' Schritte/Bild',
        onInput: (v) => (st.speed = v) });
      U.toggle(panel, 'Ton', st.sound, (v) => (st.sound = v));
      U.hint(panel, 'Weiß = wird verglichen, Rot = wird geschrieben. Bubblesort braucht für n Werte rund n² Vergleiche, ' +
        'Quick-, Merge- und Heapsort nur etwa n·log n. Radixsort vergleicht gar nicht, sondern sortiert Ziffer für Ziffer. ' +
        'Und Bogosort mischt einfach so lange, bis es zufällig passt – viel Glück ab 8 Balken.');

      fill();
      return { destroy() { stop(); S.destroy(); if (ac) ac.close(); } };
    },
  });
})();
