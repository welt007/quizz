# Quizshow 🎤

Ein Quizspiel im Stil einer TV-Gameshow – **offline**, **portabel**, als **eine einzige HTML-Datei**.

- 4 Antwortmöglichkeiten pro Frage, optional mit Bild
- Kategorien und drei Schwierigkeitsgrade (leicht / mittel / schwer)
- Spielmodi: Punkteleiter, Blitzrunde, Sudden Death, Duell/Party, Training *(in Arbeit)*
- Fragenkataloge als CSV in [`catalogs/`](catalogs/), aktualisierbar direkt aus GitHub *(in Arbeit)*

**Status:** Meilenstein M0 (Projektgerüst). Den vollständigen Plan gibt es in [`docs/PLAN.md`](docs/PLAN.md).

## Spielen

`dist/quizshow.html` im Browser öffnen – fertig. Kein Server, keine Installation, kein Internet nötig.
Die fertige Datei gibt es auch als Artefakt jedes CI-Laufs (GitHub → Actions → „quizshow“).

## Entwickeln

Voraussetzung: Node.js ≥ 20.

```bash
npm install
npm run build      # → dist/quizshow.html (minifiziert)
npm run build:dev  # ohne Minifizierung
npm run validate   # Fragenkataloge prüfen
npm test           # Unit-Tests
npm run check      # alles zusammen (wie in CI)
```

## Fragen schreiben

Siehe [`docs/FRAGENFORMAT.md`](docs/FRAGENFORMAT.md). Kurzfassung:

```csv
id,category,difficulty,question,correct,wrong1,wrong2,wrong3,image,explanation,tags
geo-0001,geographie,1,Wie heißt die Hauptstadt von Frankreich?,Paris,Lyon,Marseille,Nizza,,,europa
```

Nach Änderungen `version` in `catalogs/index.json` erhöhen und `npm run validate` ausführen.

## Projektstruktur

```
catalogs/          Fragenkataloge (CSV), Manifest index.json, Bilder
docs/              Plan und Formatbeschreibung
src/index.html     HTML-Template mit Platzhaltern für CSS/Kataloge/JS
src/js/core/       Spiellogik ohne DOM (in Node testbar)
src/js/ui/         Darstellung
src/styles/        CSS
tools/             Build und Katalog-Validierung
test/              Unit-Tests (node:test)
```
