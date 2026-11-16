# Lizenzen der Fragenkataloge

## Fragen (alle CSV-Dateien in diesem Ordner)

Die Fragenkataloge stehen unter der **Creative Commons Namensnennung – Weitergabe unter gleichen
Bedingungen 4.0 International** (CC BY-SA 4.0): <https://creativecommons.org/licenses/by-sa/4.0/deed.de>

Sie enthalten Fragen aus **OpenTriviaQA** von uberspot und Mitwirkenden
(<https://github.com/uberspot/OpenTriviaQA>, CC BY-SA 4.0). Diese Fragen wurden ausgewählt, ins
Deutsche übersetzt und bearbeitet (Formulierungen, Falschantworten, Korrekturen, Schwierigkeitsgrade
und Kategorien). Sie sind an IDs mit dem Präfix `otq-` und dem Schlagwort `opentriviaqa` erkennbar;
die ID enthält Quelldatei und laufende Nummer der Frage im Original.

Wer die Kataloge weitergibt oder verändert, muss die Quelle nennen und das Ergebnis ebenfalls unter
CC BY-SA 4.0 stellen.

## Bilder

- `images/flaggen/` – Länder-, Regional- und Organisationsflaggen aus **flag-icons**
  (<https://github.com/lipis/flag-icons>), MIT-Lizenz (Text unten). Ausgenommen sind die Flaggen der
  deutschen Bundesländer (`de-*.svg`): vereinfachte Landesflaggen ohne Wappen, für dieses Projekt
  gezeichnet.
- `images/umrisse/` – Ländersilhouetten, erzeugt mit `tools/assets/build-outlines.mjs` aus den
  Grenzdaten von **Natural Earth** (<https://www.naturalearthdata.com>, gemeinfrei), bezogen über das
  Paket world-atlas (ISC).
- `images/obst/`, `images/gemuese/`, `images/blaetter/` – **Fotos** (`.jpg`) von Beobachtungen auf
  **iNaturalist** (<https://www.inaturalist.org>), bezogen über den Datensatz iNaturalist Open Data
  (<https://github.com/inaturalist/inaturalist-open-data>). Verwendet wurden nur Fotos unter CC0, CC BY
  oder CC BY-SA; sie wurden auf 4:3 zugeschnitten und verkleinert (600×450 Pixel). Urheber, Lizenz und
  Quelle je Foto stehen in der Tabelle unten und maschinenlesbar in `images/FOTOS.json`.
- Für Honigmelone, Kartoffel, Lauch (Porree), Mandarine, Radieschen gab es kein passendes freies Foto; dafür bleiben die
  bisherigen Zeichnungen (`.svg`), erzeugt mit `tools/assets/build-food-images.mjs`: Honigmelone,
  Kartoffel und Mandarine aus **Microsoft Fluent Emoji Flat** (<https://github.com/microsoft/fluentui-emoji>,
  MIT-Lizenz, Text unten), Radieschen und Lauch für dieses Projekt gezeichnet (CC BY-SA 4.0).

Die selbst gezeichneten Bilder stehen wie die Kataloge unter CC BY-SA 4.0.

### Fotos (iNaturalist)

| Motiv | Datei | Urheber/in | Lizenz | Quelle |
|---|---|---|---|---|
| Ahorn | `images/blaetter/ahorn.jpg` | Stephen James McWilliam | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de) | <https://www.inaturalist.org/photos/164885133> |
| Birke | `images/blaetter/birke.jpg` | Daniel Cahen | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/98750137> |
| Buche | `images/blaetter/buche.jpg` | Alexis | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/74072127> |
| Eberesche (Vogelbeere) | `images/blaetter/eberesche.jpg` | Alexis | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/212229960> |
| Eiche | `images/blaetter/eiche.jpg` | Alexis | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/82206518> |
| Erle | `images/blaetter/erle.jpg` | Daniel Das | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de) | <https://www.inaturalist.org/photos/213098305> |
| Esche | `images/blaetter/esche.jpg` | Peter Gabler | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de) | <https://www.inaturalist.org/photos/72108858> |
| Espe (Zitterpappel) | `images/blaetter/espe.jpg` | Stephen James McWilliam | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de) | <https://www.inaturalist.org/photos/101908427> |
| Hainbuche | `images/blaetter/hainbuche.jpg` | Patrick Hacker | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/90519974> |
| Linde | `images/blaetter/linde.jpg` | Stanislav Murashkin | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/224264256> |
| Stechpalme | `images/blaetter/stechpalme.jpg` | Stephen James McWilliam | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de) | <https://www.inaturalist.org/photos/55202728> |
| Ulme | `images/blaetter/ulme.jpg` | Thomas Ebner | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/161298674> |
| Vogelkirsche | `images/blaetter/vogelkirsche.jpg` | Ivo Macek | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/68360197> |
| Weide | `images/blaetter/weide.jpg` | Андрей Тихонов | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de) | <https://www.inaturalist.org/photos/50013422> |
| Aubergine | `images/gemuese/aubergine.jpg` | Prasanta Hembram | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de) | <https://www.inaturalist.org/photos/244472602> |
| Blumenkohl | `images/gemuese/blumenkohl.jpg` | Jagdish Singh Negi | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/173841513> |
| Brokkoli | `images/gemuese/brokkoli.jpg` | buddyt888 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/14407907> |
| Chili | `images/gemuese/chili.jpg` | Thomas Mesaglio | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/110002875> |
| Erbsen | `images/gemuese/erbsen.jpg` | Tom Rogers | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de) | <https://www.inaturalist.org/photos/147524445> |
| Gurke | `images/gemuese/gurke.jpg` | Joyce Lai | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/88468391> |
| Ingwer | `images/gemuese/ingwer.jpg` | Clint Dalrymple | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/170147852> |
| Karotte (Möhre) | `images/gemuese/karotte.jpg` | Lucie Karna | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/103243170> |
| Kidneybohnen | `images/gemuese/kidneybohnen.jpg` | Jagdish Singh Negi | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/248557006> |
| Knoblauch | `images/gemuese/knoblauch.jpg` | Adam Kranz | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de) | <https://www.inaturalist.org/photos/45154103> |
| Kohlrabi | `images/gemuese/kohlrabi.jpg` | Austin R. Kelly | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/64914425> |
| Kürbis | `images/gemuese/kuerbis.jpg` | Jorge Armín Escalante Pasos | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/2200655> |
| Mais | `images/gemuese/mais.jpg` | Tereso Hernández Morales | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/33255735> |
| Paprika | `images/gemuese/paprika.jpg` | Urgamal Magsar | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/222664347> |
| Rote Bete | `images/gemuese/rote-bete.jpg` | Diogo Luiz | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de) | <https://www.inaturalist.org/photos/236430986> |
| Spargel | `images/gemuese/spargel.jpg` | Ryan Durand | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/127928827> |
| Tomate | `images/gemuese/tomate.jpg` | Heidi Hellstern | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de) | <https://www.inaturalist.org/photos/78599077> |
| Zwiebel | `images/gemuese/zwiebel.jpg` | Andrew Sebastian | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/173446391> |
| Ananas | `images/obst/ananas.jpg` | Patty Mitchum | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/145015925> |
| Apfel | `images/obst/apfel.jpg` | Tracy Sherbrook | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de) | <https://www.inaturalist.org/photos/234771727> |
| Avocado | `images/obst/avocado.jpg` | Oscar Alejandro Morales Juárez | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de) | <https://www.inaturalist.org/photos/208507152> |
| Banane | `images/obst/banane.jpg` | ZapolioPvP | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/5445556> |
| Birne | `images/obst/birne.jpg` | jtweddle | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/86995185> |
| Erdbeere | `images/obst/erdbeere.jpg` | Josep Gesti | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de) | <https://www.inaturalist.org/photos/251175425> |
| Heidelbeeren | `images/obst/heidelbeeren.jpg` | Kai Löhr | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/104657473> |
| Himbeere | `images/obst/himbeere.jpg` | Dustin Minialoff | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de) | <https://www.inaturalist.org/photos/47068637> |
| Johannisbeeren | `images/obst/johannisbeeren.jpg` | Annika Lindqvist | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/9351415> |
| Kirschen | `images/obst/kirschen.jpg` | Nicholas Allen | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/107899823> |
| Kiwi | `images/obst/kiwi.jpg` | bogsuckers | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/82677607> |
| Kokosnuss | `images/obst/kokosnuss.jpg` | Rodolfo Salinas Villarreal | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/102226433> |
| Limette | `images/obst/limette.jpg` | Andrew Sebastian | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/143301212> |
| Mango | `images/obst/mango.jpg` | Jean-Lou Justine | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/19811292> |
| Pfirsich | `images/obst/pfirsich.jpg` | Brett Sandford | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/6421837> |
| Stachelbeere | `images/obst/stachelbeere.jpg` | Christian Kahle | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de) | <https://www.inaturalist.org/photos/38571951> |
| Wassermelone | `images/obst/wassermelone.jpg` | Roman Luštrik | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/158964975> |
| Weintrauben | `images/obst/weintrauben.jpg` | Danielle | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/65824009> |
| Zitrone | `images/obst/zitrone.jpg` | Doug Miller | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/199295652> |
| Zwetschge (Pflaume) | `images/obst/zwetschge.jpg` | Jonathan Eisen | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) | <https://www.inaturalist.org/photos/81374506> |

### MIT-Lizenz von flag-icons

```
The MIT License (MIT)

Copyright (c) 2013 Panayiotis Lipiridis

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### MIT-Lizenz von Microsoft Fluent Emoji

```
MIT License

Copyright (c) Microsoft Corporation.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
