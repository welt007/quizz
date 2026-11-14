# Umsetzungsplan – Quizshow

Stand: 2026-11-14

## 1. Ziel

Ein Quizspiel im Stil einer TV-Gameshow, das

- **offline** funktioniert und **portabel** ist: das Ergebnis ist eine **einzige HTML-Datei**
  (`dist/quizshow.html`), die per Doppelklick im Browser läuft (auch von USB-Stick, über `file://`),
- **Fragenkataloge als CSV** aus einem GitHub-Repo laden und aktualisieren kann,
- im **Optionsmenü weitere Kataloge per URL** hinzufügen lässt,
- Fragen mit **genau 4 Antwortmöglichkeiten** (nur Text oder Zahlen) stellt, die Frage optional mit **Bild**,
- **mehrere Spielmodi**, **Kategorien** und **4 Schwierigkeitsgrade** anbietet.

## 2. Leitentscheidungen

| Thema | Entscheidung | Begründung |
|---|---|---|
| Laufzeit | Vanilla JS (ES2020), kein Framework | Kleine Dateigröße, keine Laufzeitabhängigkeiten, läuft lange stabil |
| Quellcode | Modular in `src/` (ES-Module) | Wartbar und testbar |
| Build | Node-Skript `tools/build.mjs` + **esbuild** (einzige Dev-Abhängigkeit) | Bündelt JS/CSS/Fragen/Bilder in eine HTML-Datei |
| Auslieferung | `dist/quizshow.html` **wird ins Repo committet**; Build ist reproduzierbar (keine Zeitstempel), CI prüft, dass die Datei aktuell ist | Direkt von GitHub herunterladbar, ohne Build-Werkzeuge |
| Fragen im Auslieferungszustand | Beim Build als JSON **eingebettet**, Bilder als `data:`-URI | Spiel ist ohne Netz sofort spielbar |
| Kataloge | Liegen im selben Repo unter `catalogs/` | Eine Quelle für Code und Inhalte |
| Schwierigkeit | **4 Stufen**: 1 leicht, 2 medium, 3 schwer, 4 extrem | Feine Abstufung für die 15er-Punkteleiter |
| Antworten | **Nur Text oder Zahlen**, Bilder **nur in der Frage** | Einheitliche Darstellung, vom Validator erzwungen |
| Aktualisierung & weitere Kataloge | `fetch` auf vom Nutzer eingetragene URLs (Standard: `raw.githubusercontent.com`, CORS `*`, funktioniert auch von `file://`) | Kein Server nötig |
| Lokaler Speicher | **IndexedDB** für geladene Kataloge + Bilder, **localStorage** für Einstellungen/Highscores | IndexedDB verkraftet Bilddaten, localStorage ist für Kleinkram einfacher |
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
    csv.js           RFC-4180-Parser, Trennzeichen-Erkennung (, ;), BOM          ✅
    catalog.js       CSV-Zeilen → Question-Objekte, Validierung                  ✅
    sources.js       Nutzer-URL → ladbare Manifest-/CSV-URL (GitHub-Links etc.) ✅
    question.js      Antworten mischen                                           ✅
    random.js        seedbarer Zufall (für Mehrspieler-Fairness & Tests)        ✅
    questionPool.js  filtern, nach „am längsten nicht gestellt“ ordnen, Punkteleiter zusammenstellen ✅
    stats.js         je Frage: gestellt/richtig/zuletzt (Wiederholungsvermeidung) ✅
    modes/           je Modus eine Zustandsmaschine (siehe §5) – ladder.js ✅, training.js ✅
    scoring.js       Zeitbonus, Streaks (ab M2/M3)
  data/
    loader.js        Manifest + CSV + Bilder einer Quelle per fetch laden (M4)
    storage.js       localStorage-Wrapper mit In-Memory-Fallback ✅ (IndexedDB folgt in M4)
  ui/
    screens/         start ✅, setup ✅, ladder ✅, training ✅ (je Spiel + Ergebnis); Optionen (M4)
    components/      questionView ✅, chips ✅, dialog ✅; Timer, Joker, Moderator-Text (M2)
    audio.js         WebAudio-Effekte (Tusch, richtig, falsch, Ticken)
    input.js         Maus/Touch/Tastatur (A–D, 1–4, Buzzer-Tasten)
  main.js           Einstieg, Router zwischen Screens
```

**Datenfluss beim Start:** eingebetteter Standardkatalog → aktualisierte Version des
Standardkatalogs aus IndexedDB (falls neuer) → alle aktivierten zusätzlichen Quellen aus
IndexedDB → gemeinsamer Fragepool. Netzzugriffe gibt es nur auf Knopfdruck („Aktualisieren“,
„Hinzufügen“) oder optional „beim Start prüfen, wenn online“.

## 4. Fragenkataloge

Details für Autoren: [`docs/FRAGENFORMAT.md`](FRAGENFORMAT.md).

- Ablage im Repo unter `catalogs/`:
  - `index.json` – Manifest (Formatversion, Katalogversion, Liste der CSV-Dateien, Kategorien-Metadaten)
  - `*.csv` – ein oder mehrere Kataloge (UTF-8)
  - `images/` – Bilder, in der CSV relativ referenziert
- Pflichtspalten: `id, category, difficulty, question, correct, wrong1, wrong2, wrong3`
- Optionale Spalten: `image, explanation, tags`
- Die **richtige Antwort steht immer in `correct`**; die Reihenfolge wird zur Laufzeit gemischt.
- Antworten sind **nur Text oder Zahlen**; Bildpfade, URLs oder `data:`-URIs als Antwort lehnt der Validator ab.
- Schwierigkeit: `1` leicht, `2` medium, `3` schwer, `4` extrem.
- `id` ist stabil und eindeutig → Statistik („schon gestellt“), Wiederholungsvermeidung, Updates.

### 4.1 Optionsmenü „Kataloge“

Liste aller Quellen mit Name, Herkunft, Version, Fragenanzahl, Stand (zuletzt aktualisiert) und
Fehlerhinweisen. Pro Quelle: **aktivieren/deaktivieren**, **aktualisieren**, **entfernen**
(der Standardkatalog kann nicht entfernt, nur deaktiviert oder zurückgesetzt werden).

**„Katalog hinzufügen“** – ein Eingabefeld für eine URL. Akzeptiert wird (umgesetzt in `core/sources.js`):

| Eingabe | wird geladen |
|---|---|
| `owner/repo` oder `https://github.com/owner/repo` | `raw.githubusercontent.com/owner/repo/HEAD/catalogs/index.json` |
| `https://github.com/owner/repo/tree/<branch>/<ordner>` | `<ordner>/index.json` auf `<branch>` |
| `https://github.com/owner/repo/blob/<branch>/<datei>.csv` | genau diese CSV (bzw. `.json` als Manifest) |
| `https://…/index.json` | Manifest mit mehreren CSVs + Bildern |
| `https://…/fragen.csv` | einzelne CSV (ohne Manifest; Name = Dateiname) |
| `https://…/ordner/` | `ordner/index.json` |

Nur `https` (und `http://localhost` zum Testen). Der Server muss CORS erlauben – GitHub (raw)
und GitHub Pages tun das. Bei CORS- oder Netzfehlern gibt es einen verständlichen Hinweis
mit Alternative (Datei herunterladen und per **CSV-Import** laden).

Ablauf beim Hinzufügen/Aktualisieren:

1. URL normalisieren → Manifest bzw. CSV laden.
2. Bei Aktualisierung: Versionsvergleich (`version` im Manifest; bei reiner CSV ein Hash des
   Inhalts) → nur bei Änderung weiter.
3. Alle CSVs laden, parsen, **validieren**. Fehlerhafte Zeilen werden übersprungen und angezeigt;
   ist eine Quelle komplett unbrauchbar, bleibt die alte Version aktiv.
4. Bilder (relativ zur Quelle aufgelöst) laden und als Blob in IndexedDB speichern
   → danach auch offline mit Bildern spielbar.
5. Vorschau vor dem Übernehmen: „48 Fragen in 4 Kategorien, 2 Zeilen fehlerhaft – hinzufügen?“

**Zusammenführen mehrerer Quellen:**

- Fragen werden intern als `<quelle>:<id>` geführt → gleiche IDs in verschiedenen Quellen kollidieren nicht.
- Gleiche Kategorie-ID in mehreren Quellen = **eine** Kategorie (z. B. „geographie“ aus zwei
  Katalogen wird zusammen gespielt). Anzeigename/Icon/Farbe aus der zuerst geladenen Quelle;
  Kategorien ohne Metadaten bekommen eine automatisch gewählte Farbe und ❓.
- Beim Spielstart lässt sich zusätzlich nach Quelle filtern.

Außerdem: **CSV-Import** aus einer lokalen Datei (ganz ohne Netz; Bilder dann nur als
`https`-URL oder `data:`-URI) und **„Standardkatalog zurücksetzen“** auf die eingebettete Version.

Qualitätssicherung im Repo: `npm run validate` prüft alle CSVs; die GitHub Action
`.github/workflows/ci.yml` führt Validierung, Tests und Build bei jedem Push aus und prüft,
dass das committete `dist/quizshow.html` zum Quellstand passt.

## 5. Spielmodi

Alle Modi teilen sich Fragepool, Antwort-Komponente und Scoring; jeder Modus ist eine
kleine Zustandsmaschine (`intro → question → reveal → … → result`).

| Modus | Ablauf | Besonderheiten |
|---|---|---|
| **Punkteleiter** (Hauptmodus) | **15 Fragen** mit steigender Schwierigkeit (siehe unten) | 3 Joker: **50:50**, **Publikum** (simulierte Abstimmung, Trefferquote abhängig von Schwierigkeit), **Zeit+**; 2 Sicherheitsstufen; jederzeit „aussteigen“ |
| **Blitzrunde** | 60 Sekunden, so viele Fragen wie möglich | Streak-Multiplikator, falsche Antwort kostet 3 s |
| **Sudden Death** | Fragen bis zum ersten Fehler, Schwierigkeit steigt alle 5 Fragen | Highscore pro Kategorie |
| **Duell / Party** (2–4 Spieler, ein Gerät) | Reihum oder Buzzer (Tasten je Spieler, z. B. `Q`, `P`, `Z`, `M`) | Wer zuerst buzzert, antwortet; falsch → Punktabzug, Frage geht an die anderen |
| **Training** | Freie Wahl von Kategorie(n) und Schwierigkeit(en), kein Timer | Erklärung (`explanation`) nach jeder Antwort, „falsch beantwortete wiederholen“ |

### 5.1 Punkteleiter (15 Stufen)

| Frage | 1–4 | 5 | 6–8 | 9 | 10 | 11–12 | 13–15 |
|---|---|---|---|---|---|---|---|
| Schwierigkeit | leicht | medium | medium | schwer | schwer | schwer | extrem |
| Besonderheit | | 🛡 Sicherheitsstufe 1 | | | 🛡 Sicherheitsstufe 2 | | 15 = Hauptgewinn |

- Verteilung: 4× leicht, 4× medium, 4× schwer, 3× extrem.
- Punktwerte (eigene Werte, umgesetzt in `core/modes/ladder.js`):
  50 → 100 → 200 → 300 → **500** 🛡 → 750 → 1 000 → 1 500 → 2 500 → **4 000** 🛡 → 6 000 → 10 000 →
  15 000 → 25 000 → **50 000** Punkte.
- Fragen werden so gewählt, dass zuerst nie oder am längsten nicht gestellte Fragen drankommen.
- Falsche Antwort → zurück auf die letzte erreichte Sicherheitsstufe; „Aussteigen“ sichert den aktuellen Stand.
- Gibt der Pool für eine Stufe zu wenige Fragen her, wird auf die benachbarte Schwierigkeit
  ausgewichen (nächste Stufe zuerst, bei Gleichstand leichter vor schwerer) und ein Hinweis angezeigt.
  Danach wird nach Schwierigkeit sortiert, damit das Spiel nie leichter wird. Unter 15 passenden
  Fragen ist die Punkteleiter nicht startbar.
- Zeitlimit je Stufe (Standard): 30 s für leicht/medium, 45 s für schwer/extrem; abschaltbar.

Bedienung in allen Modi: Maus/Touch oder Tastatur – `A`–`D` bzw. `1`–`4` antworten,
`Enter`/`Leertaste`/`→` weiter, `Esc` beenden bzw. zurück.

Gemeinsame Einstellungen pro Spiel: Kategorien (Mehrfachauswahl), Quellen, Schwierigkeit (falls im Modus
wählbar), Timer an/aus/Dauer, Sound an/aus.

## 6. Gameshow-Präsentation

- Bühnen-Look: dunkler Hintergrund, animierte Spotlights (CSS), große Typografie,
  Antwort-Kacheln A–D mit Hover/Lock-in/Auflösungs-Animation (orange „eingeloggt“ → grün/rot).
- Spannungsaufbau: kurze Pause zwischen „eingeloggt“ und Auflösung, Trommelwirbel-Sound.
- Moderator-Sprüche (Textbausteine, zufällig, je Situation).
- Konfetti bei Sieg/Highscore (Canvas, ohne Bibliothek).
- **Präsentationsmodus** für Beamer/TV: Vollbild (`F`), komplette Tastatursteuerung,
  skaliert auf 16:9; Fragebilder groß darstellbar (Klick → Zoom).
- Responsiv: Smartphone (hochkant) bis Beamer. Bedienbar per Touch, Maus und Tastatur.
- Barrierearm: ausreichende Kontraste, Fokus-Ringe, `prefers-reduced-motion` respektieren,
  Antworten nicht nur über Farbe kenntlich (✓/✗-Symbole).

## 7. Persistenz

| Schlüssel | Speicher | Inhalt |
|---|---|---|
| `quizshow.settings` | localStorage | Sound, Timer, Moderation, „beim Start auf Updates prüfen“ |
| `quizshow.sources` | localStorage | Liste der Quellen: id, URL, Name, aktiv, Version/Hash, Stand, Fragenanzahl |
| `quizshow.highscores` | localStorage | je Modus/Kategorie Top 10 (Name, Punkte, Datum) |
| `quizshow.stats` | localStorage | je Frage-`<quelle>:<id>`: gestellt/richtig (für Wiederholungsvermeidung) |
| `catalogs` | IndexedDB | Fragen je Quelle inkl. Manifest |
| `images` | IndexedDB | Bilder je Quelle als Blob |

Alle Zugriffe in `try/catch`; im privaten Modus oder bei `file://`-Einschränkungen läuft das
Spiel ohne Speicherung weiter (In-Memory-Fallback; hinzugefügte Kataloge gelten dann nur bis
zum Schließen, worauf das Optionsmenü hinweist).

## 8. Meilensteine

| # | Inhalt | Ergebnis |
|---|---|---|
| **M0** ✅ | Projektgerüst, Plan, CSV-Format (4 Stufen), Beispielkataloge, CSV-Parser + Validierung, URL-Normalisierung für Quellen, Build-Pipeline, CI | `npm run build` erzeugt lauffähige Einzeldatei mit Startbildschirm |
| **M1** ✅ | Spielkern: Fragepool, Wiederholungsvermeidung, **Training** und **Punkteleiter (15 Stufen)** ohne Joker/Timer; Basis-UI (Start → Einrichtung → Spiel → Ergebnis), Tastatursteuerung | Erstes spielbares Quiz |
| **M2** | Gameshow-Optik & Sound: Bühne, Animationen, Timer, WebAudio, Moderator-Texte, Joker | Show-Feeling |
| **M3** | Weitere Modi: Blitzrunde, Sudden Death, Duell/Party mit Buzzer; Highscores | Alle Modi |
| **M4** | **Optionsmenü**: Kataloge per URL hinzufügen/aktualisieren/entfernen, Standardkatalog-Update, IndexedDB, CSV-Import, Fehleranzeige | Kataloge ohne neuen Build erweiterbar |
| **M5** | Präsentationsmodus, Responsiv-/A11y-Feinschliff, Statistik, Playwright-E2E-Tests (`file://`) | Release 1.0 |
| **M6** | Inhalte: Kataloge auf ≥ 50 Fragen je Kategorie und Stufe ausbauen | Spielspaß |

## 9. Tests

- **Unit** (`node --test`): CSV-Parser, Validierung, URL-Normalisierung, Fragepool, Scoring, Modus-Zustandsmaschinen.
- **Katalog-Validierung** (`npm run validate`): in CI bei jeder Änderung an `catalogs/`.
- **Build-Aktualität**: CI baut neu und bricht ab, wenn `dist/quizshow.html` vom Commit abweicht.
- **E2E** (ab M5, Playwright, Chromium ist vorhanden): `dist/quizshow.html` über `file://` öffnen,
  je Modus ein Spiel durchspielen, Offline-Betrieb prüfen (Netz blockiert), Katalog per URL
  hinzufügen (gegen lokalen Testserver).

## 10. Risiken & Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Dateigröße durch eingebettete Bilder | Richtwert ≤ 200 KB/Bild, max. 1280 px; Build warnt ab 5 MB Gesamtgröße |
| Repo wächst durch committete HTML-Datei | Build ist reproduzierbar, Änderungen nur bei echten Inhaltsänderungen; Bildgrößen-Richtwert |
| `file://`-Einschränkungen (einige Browser sperren Storage/fetch) | Alles mit Fallback; Optionsmenü zeigt klare Fehlermeldung, Spielen geht immer |
| Fremde Kataloge ohne CORS oder hinter Login | Verständliche Fehlermeldung + Weg über Download und CSV-Import |
| Schadhafte Inhalte aus fremden Quellen | Texte nur per `textContent`; Bilder nur als `<img>` (SVG in `<img>` führt kein Script aus); Validierung vor Übernahme |
| GitHub-Rate-Limit / Repo privat | `raw.githubusercontent.com` statt API; bei privatem Repo: Hinweis, CSV-Import als Alternative |
| Excel speichert CSV mit `;` und Windows-1252 | Trennzeichen-Erkennung; Doku empfiehlt „CSV UTF-8“; Validator meldet kaputte Umlaute |
| Fehlerhafte Fragen in Katalogen | Validator in CI, zeilengenaue Fehlermeldungen, defekte Zeilen werden übersprungen |

## 11. Entscheidungen

| Frage | Entscheidung (2026-11-14) |
|---|---|
| Auslieferung der HTML-Datei | Fertige HTML-Datei **und** Kataloge liegen im Repo |
| Ort der Kataloge | Im selben Repo (`catalogs/`); weitere Kataloge per URL im Optionsmenü |
| Schwierigkeitsstufen | 4: leicht, medium, schwer, extrem |
| Bildantworten | Nein – Antworten nur Text oder Zahlen, Bilder nur in der Frage |
| Punkteleiter | 15 Fragen |

| Punktwerte | Eigene Werte 50 … 50 000 (siehe §5.1) |

Noch offen (Vorschläge oben, Entscheidung bei M2): Joker-Auswahl, Zeitlimits.
