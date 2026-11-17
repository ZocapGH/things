# Things

Kleine Spielereien aus Mathe & Physik – als installierbare Web-App (PWA) für iOS, Android, Windows und macOS.
Reines HTML/CSS/JavaScript mit Canvas, **keine externen Bibliotheken**, kein Build-Schritt.

## Enthalten
| Ding | Datei |
|---|---|
| Doppelpendel (RK4, Chaos-Fächer bis 200 Pendel, Kugeln ziehbar) | `js/things/pendulum.js` |
| Op-Art-Generator (9 Stile, Seeds, Farbmodi, Animation, PNG-Export) | `js/things/opart.js` |
| Fraktal-Zoom (Mandelbrot & Julia, Pinch/Mausrad, fließende Farben) | `js/things/fractal.js` |
| Fourier-Epizykel (eigene Zeichnung in rotierende Kreise zerlegen) | `js/things/fourier.js` |
| Turing-Muster (Gray-Scott-Reaktion-Diffusion, malbar) | `js/things/reaction.js` |
| Wellenwanne (Quellen, Wände, Doppelspalt, Intensitätsansicht) | `js/things/ripple.js` |
| Sandkasten (Sand, Wasser, Öl, Stein, Holz, Pflanze, Feuer) | `js/things/sand.js` |
| Gravitation (N-Körper, Schleudern mit Bahnvorschau, Achterbahn-Lösung) | `js/things/gravity.js` |
| Stoff (Verlet-Tuch, ziehen, schneiden, zerreißen, Wind) | `js/things/cloth.js` |
| Kaleidoskop (Symmetrie-Malen, Leuchten, Auto-Pinsel) | `js/things/kaleido.js` |
| Galtonbrett (Binomialverteilung live, Glockenkurve) | `js/things/galton.js` |
| Sortieren (10 Algorithmen als Animation mit Ton) | `js/things/sorting.js` |
| Langtons Ameise (6 Regeln, mehrere Ameisen) | `js/things/langton.js` |
| Tinte & Rauch (Gitter-Flüssigkeit, Stable Fluids, Wirbel, Auftrieb) | `js/things/fluid.js` |
| Wasser (Partikel-Flüssigkeit, Dammbruch, Wasserhahn, Handy-Lagesensor) | `js/things/water.js` |
| Labyrinth (6 Algorithmen animiert, Lösen per Breitensuche, selbst spielen) | `js/things/maze.js` |
| Harmonograph (gedämpfte Pendel, Drehtisch) | `js/things/harmonograph.js` |
| Seltsame Attraktoren (Lorenz, Rössler, Aizawa, Thomas, Halvorsen, Dadras; 3D drehbar) | `js/things/attractor.js` |
| Schwarm / Boids (bis 3000, Zeiger als Raubvogel oder Futter) | `js/things/boids.js` |
| Game of Life (6 Regeln, Muster, Malen, Geisterspuren) | `js/things/life.js` |

## Lokal starten (Windows)
```
powershell -ExecutionPolicy Bypass -File serve.ps1
```
Dann http://localhost:8080 öffnen.

## Auf Handy & anderen Rechnern installieren
Service Worker und „Installieren“ brauchen HTTPS. Am einfachsten den Ordner auf einen statischen Host legen
(z. B. GitHub Pages, Netlify, Cloudflare Pages) und die URL öffnen:
- **iOS/iPadOS (Safari):** Teilen → „Zum Home-Bildschirm“
- **Android (Chrome):** Menü → „App installieren“
- **Windows/macOS (Chrome/Edge):** Installieren-Symbol in der Adressleiste bzw. Button auf der Startseite
- **macOS (Safari 17+):** Ablage → „Zum Dock hinzufügen“

## Neues Ding hinzufügen
1. Datei `js/things/<name>.js` anlegen und `Things.register({ id, name, desc, thumb(ctx,w,h), create(stage, panel) })` aufrufen.
   `create` gibt `{ destroy() }` zurück. Helfer in `js/core.js`: `Things.canvas`, `Things.loop`, `Things.pointer`, `Things.ui.*`, `Things.saveCanvas`.
2. `<script>`-Tag in `index.html` ergänzen.
3. Datei in die `FILES`-Liste von `sw.js` eintragen und `CACHE`-Version erhöhen.
