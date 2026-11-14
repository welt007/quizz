# Umsetzungsplan – Quizshow

Stand: 2026-11-14

## 1. Ziel

Ein Quizspiel im Stil einer TV-Gameshow, das

- **offline** funktioniert und **portabel** ist: das Ergebnis ist eine **einzige HTML-Datei**
  (`dist/quizshow.html`), die per Doppelklick im Browser läuft (auch von USB-Stick, über `file://`),
- **Fragenkataloge als CSV** aus einem GitHub-Repo laden und aktualisieren kann,
- Fragen mit **genau 4 Antwortmöglichkeiten** stellt, optional mit **Bild**,
- **mehrere Spielmodi**, **Kategorien** und **Schwierigkeitsgrade** anbietet.

## 2. Leitentscheidungen

| Thema | Entscheidung | Begründung |
|---|---|---|
| Laufzeit | Vanilla JS (ES2020), kein Framework | Kleine Dateigröße, keine Laufzeitabhängigkeiten, läuft lange stabil |
| Quellcode | Modular in `src/` (ES-Module) | Wartbar und testbar |
| Build | Node-Skript `tools/build.mjs` + **esbuild** (einzige Dev-Abhängigkeit) | Bündelt JS/CSS/Fragen/Bilder in eine HTML-Datei |
| Fragen im Auslieferungszustand | Beim Build als JSON **eingebettet**, Bilder als `data:`-URI | Spiel ist ohne Netz sofort spielbar |
| Aktualisierung | `fetch` auf `raw.githubusercontent.com` (CORS `*`, funktioniert auch von `file://`) | Kein Server nötig |
| Lokaler Speicher | **IndexedDB** für aktualisierte Kataloge + Bilder, **localStorage** für Einstellungen/Highscores | IndexedDB verkraftet Bilddaten, localStorage ist für Kleinkram einfacher |
| Sounds | Per **WebAudio synthetisiert** (keine Audiodateien) | Offline, keine Dateigröße, keine Lizenzfragen |
| Schriften/Icons | System-Fonts, Emoji / Inline-SVG | Keine externen Ressourcen |
| Sprache | UI und Doku Deutsch, Code-Bezeichner Englisch | |
| Optik | Eigenes Gameshow-Design (Bühne, Spotlights, Countdown, Punkteleiter) – **kein** Nachbau einer bestehenden Show | Rechtlich sauber, eigener Look |

## 3. Architektur

```
┌──────────────────────── dist/quizshow.html ────────────────────────┐
│  <style>  … gebündeltes CSS …                                      │
│  <script type="application/json" id="embedded-catalogs"> … </script>│
│  <script> … gebündeltes JS (IIFE) … </script>                       │
└─────────────────────────────────────────────────────────────────────┘

src/js/
  core/            reine Logik, ohne DOM → in Node testbar
    csv.js           RFC-4180-Parser, Trennzeichen-Erkennung (, ;), BOM
    catalog.js       CSV-Zeilen → Question-Objekte, Validierung
    questionPool.js  Filtern (Kategorie/Schwierigkeit), Ziehen ohne Wiederholung
    random.js        seedbarer Zufall (für Mehrspieler-Fairness & Tests)
    scoring.js       Punkte, Zeitbonus, Streaks
    modes/           je Modus eine Zustandsmaschine (siehe §5)
  data/
    sources.js       Kataloge zusammenführen: eingebettet ← IndexedDB ← Import
    updater.js       Manifest + CSV + Bilder von GitHub laden
    storage.js       IndexedDB/localStorage-Wrapper (mit Fallback)
  ui/
    screens/         Start, Modus-Auswahl, Spiel, Ergebnis, Einstellungen, Kataloge
    components/      Antwort-Buttons, Timer, Punkteleiter, Joker, Moderator-Text
    audio.js         WebAudio-Effekte (Tusch, richtig, falsch, Ticken)
    input.js         Maus/Touch/Tastatur (A–D, 1–4, Buzzer-Tasten)
  main.js           Einstieg, Router zwischen Screens
```

**Datenfluss beim Start:** eingebettete Kataloge laden → in IndexedDB gespeicherte, neuere
Katalogversionen darüberlegen → Fragepool aufbauen. Ein Update läuft nur auf Knopfdruck
(oder optional „beim Start prüfen, wenn online“) und überschreibt nie die eingebetteten Daten.

## 4. Fragenkataloge

Details für Autoren: [`docs/FRAGENFORMAT.md`](FRAGENFORMAT.md).

- Ablage im Repo unter `catalogs/`:
  - `index.json` – Manifest (Formatversion, Katalogversion, Liste der CSV-Dateien, Kategorien-Metadaten)
  - `*.csv` – ein oder mehrere Kataloge (UTF-8)
  - `images/` – Bilder, in der CSV relativ referenziert
- Pflichtspalten: `id, category, difficulty, question, correct, wrong1, wrong2, wrong3`
- Optionale Spalten: `image, explanation, tags`
- Die **richtige Antwort steht immer in `correct`**; die Reihenfolge wird zur Laufzeit gemischt.
  Das macht das Schreiben einfacher und Fehler (falscher Buchstabe) unmöglich.
- Schwierigkeit: `1` = leicht, `2` = mittel, `3` = schwer.
- `id` ist stabil und eindeutig → Statistik („schon gestellt“), Wiederholungsvermeidung, Updates.

### Aktualisierung aus GitHub

1. Einstellung „Katalog-Quelle“: `owner/repo`, Branch, Pfad – Vorgabe `welt007/quizz`, `main`, `catalogs`.
2. `GET https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>/index.json`
3. Versionsvergleich mit lokal gespeicherter Version → nur bei Änderung weiter.
4. Alle CSVs laden, parsen, **validieren**. Fehlerhafte Zeilen werden übersprungen und angezeigt;
   ist ein Katalog komplett unbrauchbar, bleibt die alte Version aktiv.
5. Bilder laden, in `data:`-URIs bzw. Blobs wandeln und mit in IndexedDB speichern
   → danach auch offline mit Bildern spielbar.
6. Fortschrittsanzeige, Zusammenfassung („+12 neue Fragen, 3 Zeilen fehlerhaft“).

Zusätzlich: **manueller Import** einer CSV-Datei über einen Datei-Dialog (ganz ohne Netz,
Bilder dann nur als URL oder `data:`-URI) und **Zurücksetzen** auf die eingebetteten Fragen.

Qualitätssicherung im Repo: `npm run validate` prüft alle CSVs; die GitHub Action
`.github/workflows/ci.yml` führt Validierung, Tests und Build bei jedem Push aus und stellt
`quizshow.html` als Build-Artefakt bereit.

## 5. Spielmodi

Alle Modi teilen sich Fragepool, Antwort-Komponente und Scoring; jeder Modus ist eine
kleine Zustandsmaschine (`intro → question → reveal → … → result`).

| Modus | Ablauf | Besonderheiten |
|---|---|---|
| **Punkteleiter** (Hauptmodus) | 12 Fragen mit steigender Schwierigkeit (4× leicht, 4× mittel, 4× schwer), Punktwert steigt pro Stufe | 3 Joker: **50:50**, **Publikum** (simulierte Abstimmung, Trefferquote abhängig von Schwierigkeit), **Zeit+**; 2 Sicherheitsstufen; jederzeit „aussteigen“ |
| **Blitzrunde** | 60 Sekunden, so viele Fragen wie möglich | Streak-Multiplikator, falsche Antwort kostet 3 s |
| **Sudden Death** | Fragen bis zum ersten Fehler, Schwierigkeit steigt langsam | Highscore pro Kategorie |
| **Duell / Party** (2–4 Spieler, ein Gerät) | Reihum oder Buzzer (Tasten je Spieler, z. B. `Q`, `P`, `Z`, `M`) | Wer zuerst buzzert, antwortet; falsch → Punktabzug, Frage geht an die anderen |
| **Training** | Freie Wahl von Kategorie(n) und Schwierigkeit, kein Timer | Erklärung (`explanation`) nach jeder Antwort, „falsch beantwortete wiederholen“ |

Gemeinsame Einstellungen pro Spiel: Kategorien (Mehrfachauswahl), Schwierigkeit (falls im Modus
wählbar), Timer an/aus/Dauer, Sound an/aus.

## 6. Gameshow-Präsentation

- Bühnen-Look: dunkler Hintergrund, animierte Spotlights (CSS), große Typografie,
  Antwort-Kacheln A–D mit Hover/Lock-in/Auflösungs-Animation (orange „eingeloggt“ → grün/rot).
- Spannungsaufbau: kurze Pause zwischen „eingeloggt“ und Auflösung, Trommelwirbel-Sound.
- Moderator-Sprüche (Textbausteine, zufällig, je Situation).
- Konfetti bei Sieg/Highscore (Canvas, ohne Bibliothek).
- **Präsentationsmodus** für Beamer/TV: Vollbild (`F`), komplette Tastatursteuerung,
  skaliert auf 16:9; Bilder groß darstellbar (Klick → Zoom).
- Responsiv: Smartphone (hochkant) bis Beamer. Bedienbar per Touch, Maus und Tastatur.
- Barrierearm: ausreichende Kontraste, Fokus-Ringe, `prefers-reduced-motion` respektieren,
  Antworten nicht nur über Farbe kenntlich (✓/✗-Symbole).

## 7. Persistenz

| Schlüssel | Speicher | Inhalt |
|---|---|---|
| `quizshow.settings` | localStorage | Sound, Timer, Katalog-Quelle, Sprache der Moderation |
| `quizshow.highscores` | localStorage | je Modus/Kategorie Top 10 (Name, Punkte, Datum) |
| `quizshow.stats` | localStorage | je Frage-`id`: gestellt/richtig (für Wiederholungsvermeidung) |
| `catalogs` | IndexedDB | aktualisierte Kataloge inkl. Version und Bilddaten |

Alle Zugriffe in `try/catch`; im privaten Modus oder bei `file://`-Einschränkungen läuft das
Spiel ohne Speicherung weiter (In-Memory-Fallback).

## 8. Meilensteine

| # | Inhalt | Ergebnis |
|---|---|---|
| **M0** ✅ | Projektgerüst, Plan, CSV-Format, Beispielkataloge, CSV-Parser + Validierung, Build-Pipeline, CI | `npm run build` erzeugt lauffähige Einzeldatei mit Startbildschirm |
| **M1** | Spielkern: Fragepool, Antwort-Mischen, Scoring, **Training** und **Punkteleiter** ohne Joker; Basis-UI (Start → Spiel → Ergebnis) | Erstes spielbares Quiz |
| **M2** | Gameshow-Optik & Sound: Bühne, Animationen, Timer, WebAudio, Moderator-Texte, Joker | Show-Feeling |
| **M3** | Weitere Modi: Blitzrunde, Sudden Death, Duell/Party mit Buzzer; Highscores | Alle Modi |
| **M4** | Katalog-Update aus GitHub, IndexedDB, CSV-Import, Katalogverwaltung, Fehleranzeige | Kataloge ohne neuen Build aktualisierbar |
| **M5** | Präsentationsmodus, Responsiv-/A11y-Feinschliff, Statistik, Playwright-E2E-Tests (`file://`) | Release 1.0 |
| **M6** | Inhalte: Kataloge auf ≥ 50 Fragen je Kategorie und Stufe ausbauen | Spielspaß |

## 9. Tests

- **Unit** (`node --test`): CSV-Parser, Validierung, Fragepool, Scoring, Modus-Zustandsmaschinen.
- **Katalog-Validierung** (`npm run validate`): in CI bei jeder Änderung an `catalogs/`.
- **E2E** (ab M5, Playwright, Chromium ist vorhanden): `dist/quizshow.html` über `file://` öffnen,
  je Modus ein Spiel durchspielen, Offline-Betrieb prüfen (Netz blockiert).

## 10. Risiken & Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Dateigröße durch eingebettete Bilder | Richtwert ≤ 200 KB/Bild, max. 1280 px; Build warnt ab 5 MB Gesamtgröße |
| `file://`-Einschränkungen (einige Browser sperren Storage/fetch) | Alles mit Fallback; Update-Funktion zeigt klare Fehlermeldung, Spielen geht immer |
| GitHub-Rate-Limit / Repo privat | `raw.githubusercontent.com` statt API; bei privatem Repo: Hinweis, CSV-Import als Alternative |
| Excel speichert CSV mit `;` und Windows-1252 | Trennzeichen-Erkennung; Doku empfiehlt „CSV UTF-8“; Validator meldet kaputte Umlaute |
| Fehlerhafte Fragen in Katalogen | Validator in CI, zeilengenaue Fehlermeldungen, defekte Zeilen werden übersprungen |

## 11. Offene Punkte (zur Entscheidung)

1. **Auslieferung der HTML-Datei:** nur als CI-Artefakt, zusätzlich als GitHub-Release, oder
   `dist/quizshow.html` mit ins Repo committen? (Aktuell: CI-Artefakt, `dist/` ist ignoriert.)
2. **Fragen-Repo:** Kataloge im selben Repo (`welt007/quizz/catalogs`) oder separates Inhalts-Repo?
   Technisch ist beides über die Einstellung „Katalog-Quelle“ möglich.
3. **Schwierigkeitsstufen:** 3 Stufen (aktuell) oder 5 für eine feinere Punkteleiter?
4. **Bildantworten** (Antworten selbst als Bilder) – gewünscht? Aktuell nicht vorgesehen.
5. Länge der Punkteleiter (12 oder 15 Fragen) und Joker-Auswahl.
