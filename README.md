# Quizshow 🎤

Ein Quizspiel im Stil einer TV-Gameshow – **offline**, **portabel**, als **eine einzige HTML-Datei**.

- 4 Antwortmöglichkeiten (Text oder Zahlen) pro Frage, Frage optional mit Bild
- Kategorien und vier Schwierigkeitsgrade (leicht / medium / schwer / extrem)
- Spielmodi:
  - **Punkteleiter** – 15 Fragen, Zeitlimit, Joker 50:50 / Publikum / +30 s
  - **Training** – freie Auswahl, Erklärungen, Falsches wiederholen
  - **Blitzrunde** – 60 Sekunden, Serien-Multiplikator bis ×4
  - **Sudden Death** – immer schwerer, bis zum ersten Fehler
  - **Duell / Party** – 2–4 Spieler an einem Gerät, mit Buzzer (`Q` `P` `X` `N` oder Antippen) oder reihum
- Bestenlisten (Top 10) für Punkteleiter, Blitzrunde und Sudden Death
- Show-Feeling: Moderator, Spannungspause, Sounds (synthetisiert, offline), Konfetti
- Bedienung per Maus, Touch oder Tastatur (`A`–`D`, `Enter`, `Esc`, Joker `H`/`P`/`T`, Ton `M`)
- Fragenkataloge als CSV in [`catalogs/`](catalogs/), aktualisierbar direkt aus GitHub
- **Optionen & Kataloge:** weitere Kataloge per URL (GitHub-Repo, `index.json` mit mehreren CSVs oder
  einzelne CSV) oder als lokale CSV-Dateien hinzufügen; jede CSV ist ein Katalog, der sich einzeln
  ein- und ausschalten lässt – alle eingeschalteten werden zu einem Fragenpool vereint

**Status:** Meilenstein M4 (Katalogverwaltung, Updates, Import). Den vollständigen Plan gibt es in [`docs/PLAN.md`](docs/PLAN.md).

## Spielen

[`dist/quizshow.html`](dist/quizshow.html) herunterladen (auf GitHub: Datei öffnen → „Download raw file“)
und im Browser öffnen – fertig. Kein Server, keine Installation, kein Internet nötig.

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

Nach Änderungen `version` in `catalogs/index.json` erhöhen, `npm run check` ausführen und
`catalogs/` **zusammen mit** dem neu gebauten `dist/quizshow.html` committen.

## Projektstruktur

```
catalogs/          Fragenkataloge (CSV), Manifest index.json, Bilder
dist/              fertiges Spiel (wird mit committet)
docs/              Plan und Formatbeschreibung
src/index.html     HTML-Template mit Platzhaltern für CSS/Kataloge/JS
src/js/core/       Spiellogik ohne DOM (in Node testbar)
src/js/ui/         Darstellung
src/styles/        CSS
tools/             Build und Katalog-Validierung
test/              Unit-Tests (node:test)
```
