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
  - **Journey** – eine Reise in 15 Etappen: je 5 Fragen aus einer ausgelosten Kategorie, alle richtig;
    alle 5 Etappen ein Etappenziel mit 10 Fragen und einem Joker nach Wahl (Kategorie wechseln,
    ein Fehler frei, 50:50 für eine ganze Etappe); wird immer schwerer; Pause und Fortsetzen möglich
- Bestenlisten (Top 10) für Punkteleiter, Journey, Blitzrunde und Sudden Death
- Show-Feeling: Moderator, Spannungspause, Sounds (synthetisiert, offline), Konfetti – in einer hellen,
  luftigen Optik mit Glühbirnen-Akzenten
- **Präsentationsmodus** für Beamer/TV (`F`): Vollbild, alles groß; Fragebilder zoombar (`Z`)
- **Kategorien-Übersicht** mit Fragenzahl je Schwierigkeit (eigenes Untermenü)
- **Statistik**: Trefferquoten je Kategorie/Schwierigkeit, „Knackpunkte“ gezielt üben
- Bedienung per Maus, Touch oder Tastatur – Übersicht aller Tasten mit `?`
- **Antwort bestätigen** (Option): Antippen markiert die Antwort, erst „Antwort einloggen“ zählt
- **Automatisch weiter:** 5 Sekunden nach der Auflösung kommt die nächste Frage (abschaltbar in den
  Optionen; Antippen oder Scrollen hält die Automatik für die aktuelle Frage an)
- Fragenkataloge als CSV in [`catalogs/`](catalogs/), aktualisierbar direkt aus GitHub
- **Optionen & Kataloge:** weitere Kataloge per URL (GitHub-Repo, `index.json` mit mehreren CSVs oder
  einzelne CSV) oder als lokale CSV-Dateien hinzufügen; jede CSV ist ein Katalog, der sich einzeln
  ein- und ausschalten lässt – alle eingeschalteten werden zu einem Fragenpool vereint
- Über **5400 Fragen** in 19 Kategorien – u. a. Essen & Ernährung, Computer- & Brettspiele, Die 90er –
  sowie Bilderfragen zu **Flaggen**, **Länderumrissen**, **Obst & Gemüse** und **Blättern heimischer Bäume**

**Status:** Version 1.0 – alle Meilensteine M0–M9 umgesetzt (M7: Android-App, M8: Design „Tageslicht“, M9: Journey). Den vollständigen Plan gibt es in [`docs/PLAN.md`](docs/PLAN.md).

## Spielen

[`dist/quizshow.html`](dist/quizshow.html) herunterladen (auf GitHub: Datei öffnen → „Download raw file“)
und im Browser öffnen – fertig. Kein Server, keine Installation, kein Internet nötig.

### Android-App

Dasselbe Spiel gibt es als Android-App (ab Android 7). Die APK baut GitHub Actions bei jeder
Änderung: im Repo unter **Actions → „Android“** den neuesten erfolgreichen Lauf öffnen und unten das
Artefakt **`quizshow-apk`** herunterladen (eine ZIP-Datei mit der APK). Die APK aufs Handy
kopieren und öffnen; beim ersten Mal muss die Installation „aus unbekannten Quellen“ für die
Datei-App bzw. den Browser erlaubt werden.

Es ist vorerst eine **Debug-APK** (für Tests, nicht für den Play Store). Neuere APKs lassen sich
über ältere installieren – Einstellungen, Statistik, Bestenlisten und importierte Kataloge bleiben
erhalten und sind Teil der Android-Datensicherung. Die Zurück-Taste schließt Dialoge, fragt vor dem
Beenden eines Spiels nach und verlässt die App auf dem Startbildschirm.

## Entwickeln

Voraussetzung: Node.js ≥ 20.

```bash
npm install
npm run build      # → dist/quizshow.html (minifiziert)
npm run build:dev  # ohne Minifizierung
npm run build:android  # Web-Teil der Android-App → android/app/src/main/assets/www/
npm run validate   # Fragenkataloge prüfen
npm test           # Unit-Tests
npm run check      # alles zusammen (wie in CI)
npm run e2e        # Browser-Tests (braucht Playwright, s. u.)
```

Die Browser-Tests spielen die fertige `dist/quizshow.html` offline durch. Playwright ist bewusst
keine Projektabhängigkeit; einmalig installieren mit
`npm i --no-save playwright && npx playwright install chromium`. In CI laufen sie in einem eigenen Job.

Die Android-App selbst (`android/`) ist eine schlanke WebView-Hülle in Java. Lokal bauen mit
Android Studio oder – mit installiertem Android-SDK und JDK 17 – per
`npm run build:android && cd android && ./gradlew assembleDebug`
(→ `android/app/build/outputs/apk/debug/`). Das App-Icon erzeugt `tools/assets/build-app-icon.mjs`.

## Fragen schreiben

Siehe [`docs/FRAGENFORMAT.md`](docs/FRAGENFORMAT.md). Kurzfassung:

```csv
id,category,difficulty,question,correct,wrong1,wrong2,wrong3,image,explanation,tags
geo-0001,geographie,1,Wie heißt die Hauptstadt von Frankreich?,Paris,Lyon,Marseille,Nizza,,,europa
```

Nach Änderungen `version` in `catalogs/index.json` erhöhen, `npm run check` ausführen und
`catalogs/` **zusammen mit** dem neu gebauten `dist/quizshow.html` committen.

## Lizenzen der Inhalte

Der Standardkatalog enthält übersetzte Fragen aus [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA)
(CC BY-SA 4.0); diese Fragen (IDs `otq-…`) stehen ebenfalls unter CC BY-SA 4.0. Flaggen stammen aus
[flag-icons](https://github.com/lipis/flag-icons) (MIT), Länderumrisse aus Natural Earth (gemeinfrei),
viele Obst- und Gemüsebilder aus [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (MIT);
die übrigen Bilder (Blätter, einige Obst- und Gemüsesorten) sind für dieses Projekt gezeichnet.
Details: [`catalogs/LIZENZ.md`](catalogs/LIZENZ.md).

## Projektstruktur

```
catalogs/          Fragenkataloge (CSV), Manifest index.json, Bilder
dist/              fertiges Spiel (wird mit committet)
docs/              Plan und Formatbeschreibung
src/index.html     HTML-Template mit Platzhaltern für CSS/Kataloge/JS
android/           Android-App (WebView-Hülle, Gradle-Projekt)
src/js/core/       Spiellogik ohne DOM (in Node testbar)
src/js/ui/         Darstellung
src/styles/        CSS
tools/             Build und Katalog-Validierung
test/              Unit-Tests (node:test)
```
