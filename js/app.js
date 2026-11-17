/* Things – Startseite, Navigation (Hash-Routing), Installation, Offline. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const home = $('home'), view = $('thing'), grid = $('grid'), panel = $('panel'), title = $('title');
  const VERSION = '1.0';
  let stage = $('stage'), current = null, thumbsDrawn = false;

  /* ---------- Karten ---------- */
  const cards = [];
  for (const t of Things.list) {
    const b = document.createElement('button');
    b.className = 'card';
    const cv = document.createElement('canvas');
    const meta = document.createElement('div');
    meta.className = 'meta';
    const h = document.createElement('h3'); h.textContent = t.name;
    const p = document.createElement('p'); p.textContent = t.desc;
    meta.append(h, p);
    b.append(cv, meta);
    b.addEventListener('click', () => { location.hash = t.id; });
    grid.appendChild(b);
    cards.push([t, cv]);
  }
  function drawThumbs() {
    if (thumbsDrawn) return;
    thumbsDrawn = true;
    requestAnimationFrame(() => {
      for (const [t, cv] of cards) {
        const r = cv.getBoundingClientRect();
        const d = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.max(1, Math.round(r.width * d));
        cv.height = Math.max(1, Math.round(r.height * d));
        const c = cv.getContext('2d');
        c.setTransform(d, 0, 0, d, 0, 0);
        try { t.thumb(c, r.width, r.height); } catch (e) { console.error(t.id, e); }
      }
    });
  }

  /* ---------- Routing ---------- */
  function closeCurrent() {
    if (current) {
      try { if (current.destroy) current.destroy(); } catch (e) { console.error(e); }
      current = null;
    }
    const ns = document.createElement('div');
    ns.className = 'stage';
    ns.id = 'stage';
    stage.replaceWith(ns); // frische Bühne: alte Event-Listener verschwinden mit
    stage = ns;
    panel.innerHTML = '';
  }
  function route() {
    const id = decodeURIComponent(location.hash.slice(1));
    const t = Things.list.find((x) => x.id === id);
    closeCurrent();
    if (!t) {
      view.classList.add('hidden');
      home.classList.remove('hidden');
      document.title = 'Things';
      drawThumbs();
      return;
    }
    home.classList.add('hidden');
    view.classList.remove('hidden');
    title.textContent = t.name;
    document.title = t.name + ' · Things';
    panel.classList.toggle('closed', window.matchMedia('(max-width: 700px)').matches);
    current = t.create(stage, panel) || {};
  }
  window.addEventListener('hashchange', route);
  const goHome = () => {
    history.pushState(null, '', location.pathname + location.search);
    route();
  };
  $('back').addEventListener('click', goHome);
  $('togglePanel').addEventListener('click', () => panel.classList.toggle('closed'));
  window.addEventListener('popstate', route);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) goHome();
  });
  // iOS: Pinch-Zoom der Seite verhindern
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  /* ---------- Installieren / Offline ---------- */
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    $('install').classList.remove('hidden');
  });
  $('install').addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    $('install').classList.add('hidden');
  });
  $('foot').textContent = 'Things ' + VERSION + ' · ' + Things.list.length + ' Dinge' +
    (standalone ? '' : ios ? ' · Als App: Teilen → „Zum Home-Bildschirm“'
      : ' · Als App: Browser-Menü → „App installieren“');

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  route();
})();
