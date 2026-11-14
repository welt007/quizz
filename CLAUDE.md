# Hinweise für die Arbeit an diesem Repo

Quizspiel im Gameshow-Stil. Auslieferung als **eine einzige, offline lauffähige HTML-Datei**
(`dist/quizshow.html`), gebaut aus `src/` + `catalogs/` mit `npm run build`.
Plan und Meilensteine: `docs/PLAN.md`. CSV-Format: `docs/FRAGENFORMAT.md`.

## Regeln

- **Keine externen Laufzeit-Ressourcen**: keine CDNs, Webfonts, externen Bilder/Sounds im gebauten
  Spiel. Alles wird inline gebündelt; Sounds per WebAudio erzeugen. Einzige erlaubte Netzwerk-
  zugriffe zur Laufzeit: das optionale Katalog-Update von `raw.githubusercontent.com`.
- Muss über `file://` funktionieren (kein Service Worker, keine ES-Module zur Laufzeit,
  Storage-Zugriffe immer in `try/catch` mit Fallback).
- Katalogtexte nie per `innerHTML` einsetzen – nur `textContent` (siehe `src/js/ui/dom.js`).
- `src/js/core/` bleibt DOM-frei und wird mit `node --test` getestet.
- Laufzeit-Abhängigkeiten vermeiden; einzige Dev-Abhängigkeit ist esbuild.
- UI-Texte und Doku auf Deutsch, Code-Bezeichner auf Englisch.
- Eigenes Gameshow-Design – keine Namen, Logos oder Optik bestehender TV-Shows nachbauen.
- Vor dem Commit: `npm run check` (validieren, testen, bauen).
