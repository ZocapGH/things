/* Things – Startseite, Navigation (Hash-Routing), Installation, Offline. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const home = $('home'), view = $('thing'), grid = $('grid'), panel = $('panel'), title = $('title');
  const VERSION = '1.1';
  let stage = $('stage'), current = null, homeScroll = 0;

  /* ---------- Kategorien ---------- */
  const CATS = [
    ['physik', 'Physik', ['doppelpendel', 'pendelwelle', 'gravitation', 'stoff', 'wasser', 'tinte', 'wellen', 'licht', 'efeld']],
    ['klang', 'Klang', ['klang', 'chladni']],
    ['kunst', 'Kunst', ['opart', 'flussfeld', 'kaleidoskop', 'harmonograph']],
    ['mathe', 'Mathe & Chaos', ['fraktal', 'fourier', 'attraktor', 'galton', 'labyrinth', 'sortieren']],
    ['zellen', 'Zellen & Schwärme', ['schwarm', 'turing', 'sand', 'life', 'ameise']],
  ];
  const byId = Object.fromEntries(Things.list.map((t) => [t.id, t]));
  const listed = new Set(CATS.flatMap((c) => c[2]));
  const rest = Things.list.filter((t) => !listed.has(t.id)).map((t) => t.id);
  if (rest.length) CATS.push(['weitere', 'Weitere', rest]);

  /* ---------- Zuletzt benutzt (nur lokal im Browser gespeichert) ---------- */
  const RKEY = 'things.recent';
  const getRecent = () => { try { return (JSON.parse(localStorage.getItem(RKEY)) || []).filter((id) => byId[id]); } catch (_) { return []; } };
  function addRecent(id) {
    try { localStorage.setItem(RKEY, JSON.stringify([id, ...getRecent().filter((x) => x !== id)].slice(0, 4))); } catch (_) {}
  }

  /* ---------- Karten & Vorschaubilder ---------- */
  const thumbCache = new Map(); // id -> Canvas mit fertigem Vorschaubild
  function card(t) {
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
    b._thing = t; b._cv = cv;
    return b;
  }
  function section(id, label, ids) {
    const sec = document.createElement('section');
    sec.className = 'sect'; sec.id = 'sect-' + id;
    const h = document.createElement('h2'); h.textContent = label;
    const g = document.createElement('div'); g.className = 'grid';
    for (const tid of ids) if (byId[tid]) g.appendChild(card(byId[tid]));
    sec.append(h, g);
    return sec;
  }
  function renderHome() {
    grid.innerHTML = '';
    const recent = getRecent();
    const chips = document.createElement('nav');
    chips.className = 'chips';
    const cats = (recent.length ? [['zuletzt', 'Zuletzt', recent]] : []).concat(CATS);
    for (const [id, label] of cats) {
      const c = document.createElement('button');
      c.className = 'chip'; c.textContent = label;
      c.addEventListener('click', () => document.getElementById('sect-' + id).scrollIntoView({ behavior: 'smooth', block: 'start' }));
      chips.appendChild(c);
    }
    grid.appendChild(chips);
    if (recent.length) grid.appendChild(section('zuletzt', 'Zuletzt benutzt', recent));
    for (const [id, label, ids] of CATS) grid.appendChild(section(id, label, ids));
    requestAnimationFrame(paintThumbs);
  }
  function paintThumbs() {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    for (const b of grid.querySelectorAll('.card')) {
      const t = b._thing, cv = b._cv, r = cv.getBoundingClientRect();
      const W = Math.max(1, Math.round(r.width * d)), H = Math.max(1, Math.round(r.height * d));
      let src = thumbCache.get(t.id);
      if (!src || src.width !== W || src.height !== H) {
        src = document.createElement('canvas');
        src.width = W; src.height = H;
        const c = src.getContext('2d');
        c.setTransform(d, 0, 0, d, 0, 0);
        try { t.thumb(c, r.width, r.height); } catch (e) { console.error(t.id, e); }
        thumbCache.set(t.id, src);
      }
      cv.width = W; cv.height = H;
      cv.getContext('2d').drawImage(src, 0, 0);
    }
  }
  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { if (!home.classList.contains('hidden')) paintThumbs(); }, 200);
  });

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
      renderHome();
      window.scrollTo(0, homeScroll);
      return;
    }
    if (!home.classList.contains('hidden')) homeScroll = window.scrollY;
    addRecent(t.id);
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
