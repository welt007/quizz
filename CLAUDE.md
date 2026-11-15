# Hinweise für die Arbeit an diesem Repo

Quizspiel im Gameshow-Stil. Auslieferung als **eine einzige, offline lauffähige HTML-Datei**
(`dist/quizshow.html`), gebaut aus `src/` + `catalogs/` mit `npm run build`.
Plan und Meilensteine: `docs/PLAN.md`. CSV-Format: `docs/FRAGENFORMAT.md`.
Zusätzlich gibt es eine Android-App (`android/`, WebView-Hülle in Java), deren Web-Teil
`npm run build:android` erzeugt (nicht committet); die Debug-APK baut der Workflow `android.yml`.

## Regeln

- **Keine externen Laufzeit-Ressourcen**: keine CDNs, Webfonts, externen Bilder/Sounds im gebauten
  Spiel. Alles wird inline gebündelt; Sounds per WebAudio erzeugen. Einzige erlaubte Netzwerk-
  zugriffe zur Laufzeit: Laden/Aktualisieren von Katalogquellen, die der Nutzer im Optionsmenü
  eingetragen hat (Standard: `raw.githubusercontent.com`), und nur auf Nutzeraktion.
- Muss über `file://` funktionieren (kein Service Worker, keine ES-Module zur Laufzeit,
  Storage-Zugriffe immer in `try/catch` mit Fallback).
- Katalogtexte nie per `innerHTML` einsetzen – nur `textContent` (siehe `src/js/ui/dom.js`).
- `src/js/core/` bleibt DOM-frei und wird mit `node --test` getestet.
- Laufzeit-Abhängigkeiten vermeiden; einzige Dev-Abhängigkeit ist esbuild.
- UI-Texte und Doku auf Deutsch, Code-Bezeichner auf Englisch.
- Eigenes Gameshow-Design – keine Namen, Logos oder Optik bestehender TV-Shows nachbauen.
- Schwierigkeit 1–4 (leicht, medium, schwer, extrem). Antworten nur Text/Zahlen, Bilder nur in der Frage.
- `dist/quizshow.html` ist **im Repo** und muss zum Quellstand passen (CI prüft das): nach jeder
  Änderung an `src/`, `catalogs/` oder `package.json` neu bauen und mit committen.
- Vor dem Commit: `npm run check` (validieren, testen, bauen). Bei UI-Änderungen zusätzlich
  `npm run e2e` (Browser-Tests in `test/e2e/`). Playwright ist **keine** Abhängigkeit: es wird
  global bzw. mit `npm i --no-save playwright` bereitgestellt; ohne Playwright werden die Tests übersprungen.
