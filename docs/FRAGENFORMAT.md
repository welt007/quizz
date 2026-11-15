# Fragenformat (CSV)

Diese Anleitung richtet sich an alle, die Fragen schreiben oder pflegen.

## Dateien

```
catalogs/
  index.json          Manifest: welche CSV-Dateien gehören dazu, Version, Kategorien
  allgemeinwissen.csv
  geographie.csv
  …
  images/             Bilder zu den Fragen
```

- Kodierung **UTF-8** (in Excel: „CSV UTF-8 (durch Trennzeichen getrennt)“ speichern).
- Trennzeichen **Komma** empfohlen; **Semikolon** wird automatisch erkannt.
- Erste Zeile ist die Kopfzeile mit den Spaltennamen (Reihenfolge egal).
- Felder mit Komma, Semikolon, Anführungszeichen oder Zeilenumbruch in `"…"` setzen;
  ein Anführungszeichen im Text wird verdoppelt: `"Der ""Blaue Planet"""`.

## Spalten

| Spalte | Pflicht | Beschreibung |
|---|---|---|
| `id` | ja | Eindeutige, **dauerhafte** Kennung, z. B. `geo-0001`. Nie wiederverwenden oder ändern. |
| `category` | ja | Kategorie-Kennung, z. B. `geographie`. Anzeigename/Farbe/Icon kommen aus `index.json`. |
| `difficulty` | ja | `1` = leicht, `2` = medium, `3` = schwer, `4` = extrem |
| `question` | ja | Fragetext |
| `correct` | ja | Die **richtige** Antwort (nur Text oder Zahl) |
| `wrong1`, `wrong2`, `wrong3` | ja | Drei falsche Antworten (nur Text oder Zahl) |
| `image` | nein | Bild zur **Frage** (Bilder gibt es nur hier, nie als Antwort): relativer Pfad (`images/eiffelturm.jpg`), `https://…`-URL oder `data:`-URI |
| `explanation` | nein | Kurze Erklärung/Hintergrund, wird nach der Auflösung gezeigt |
| `tags` | nein | Schlagworte, durch senkrechten Strich getrennt, z. B. `europa\|hauptstädte` |

Die Antworten werden im Spiel **zufällig gemischt** – die richtige Antwort steht in der CSV
also immer in `correct`, im Spiel aber auf einer beliebigen Position A–D.

## Regeln (werden von `npm run validate` geprüft)

- Alle Pflichtspalten vorhanden und nicht leer.
- `id` ist im gesamten Katalog eindeutig.
- `difficulty` ist 1, 2, 3 oder 4.
- Antworten sind reiner Text oder Zahlen – Bildpfade (`….png` usw.), URLs und `data:`-URIs sind als Antwort nicht erlaubt.
- Die vier Antworten sind paarweise verschieden (Groß-/Kleinschreibung egal).
- `category` ist in `index.json` definiert (sonst Warnung).
- Relative Bildpfade existieren (beim Build).
- Hinweise (keine Fehler): sehr lange Fragen (> 200 Zeichen) oder Antworten (> 60 Zeichen),
  verdächtige Zeichen wie `Ã¤` (falsche Kodierung).

## Schwierigkeitsgrade

| Wert | Stufe | Richtschnur |
|---|---|---|
| 1 | leicht | Weiß fast jeder, Schulwissen Unterstufe |
| 2 | medium | Allgemeinbildung, kurz nachdenken |
| 3 | schwer | Nur wer sich etwas auskennt |
| 4 | extrem | Expertenwissen, Detailfragen, gute Ablenker |

Die Punkteleiter (15 Fragen) braucht pro Spiel 4× leicht, 4× medium, 4× schwer und 3× extrem –
damit sich Fragen nicht ständig wiederholen, sollte jede Stufe gut gefüllt sein.

## Bilder

- Bilder gibt es **nur in der Frage** (Spalte `image`), nicht in den Antworten.
- Formate: `.jpg`, `.png`, `.webp`, `.gif`, `.svg`
- Empfehlung: max. 1280 px Kantenlänge, ≤ 200 KB je Bild (alle Bilder landen in der HTML-Datei).
- Nur Bilder verwenden, die frei nutzbar sind; Quelle/Lizenz bei Bedarf in `explanation` angeben.

## Beispiel

```csv
id,category,difficulty,question,correct,wrong1,wrong2,wrong3,image,explanation,tags
geo-0001,geographie,1,Wie heißt die Hauptstadt von Frankreich?,Paris,Lyon,Marseille,Nizza,,,europa|hauptstädte
geo-0002,geographie,2,"Welcher Fluss fließt durch Wien, Budapest und Belgrad?",Donau,Rhein,Elbe,Moldau,,Die Donau ist der zweitlängste Fluss Europas.,europa|flüsse
```

## Eigene Kataloge an anderer Stelle

Kataloge müssen nicht in diesem Repo liegen. Im Spiel lassen sich unter **Optionen → Kataloge →
Katalog hinzufügen** weitere Quellen per URL eintragen, z. B. ein eigenes GitHub-Repo
(`owner/repo`, dort wird `catalogs/index.json` erwartet), ein Ordner mit `index.json` oder eine
einzelne `.csv`-Datei. Der Server muss Zugriffe aus dem Browser erlauben (CORS) – GitHub und
GitHub Pages tun das. Format und Regeln sind dieselben wie hier beschrieben.

## index.json

```json
{
  "format": 1,
  "version": "2026-11-14.1",
  "title": "Standardkatalog",
  "updateUrl": "https://github.com/welt007/quizz",
  "files": ["allgemeinwissen.csv", "geographie.csv"],
  "categories": {
    "geographie": { "name": "Geographie", "icon": "🌍", "color": "#2e9e6b" }
  }
}
```

- `version` bei **jeder** inhaltlichen Änderung erhöhen – daran erkennt das Spiel, dass es ein Update gibt.
- `format` beschreibt die Version dieses Dateiformats und wird nur bei inkompatiblen Änderungen erhöht.
- `files`: beliebig viele CSV-Dateien (auch in Unterordnern, z. B. `sport/fussball.csv`). **Jede Datei
  ist im Spiel ein eigener Katalog**, der sich einzeln ein- und ausschalten lässt; alle eingeschalteten
  Kataloge werden zu einem Fragenpool vereint. Fragen-IDs müssen über alle Dateien einer Quelle
  eindeutig sein.
- `categories`: Anzeigename, Icon und Farbe je Kategorie (optional; ohne Angabe wird der Name aus
  der ID gebildet).
- `updateUrl` (optional, nur für den eingebauten Standardkatalog): woher das Spiel Updates holt –
  ein GitHub-Repo oder eine URL wie im Optionsmenü.
