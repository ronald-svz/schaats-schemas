# Trainingsschema's Schaatsvereniging Zwolle

Statische site zonder database en zonder build. Alles staat in gewone bestanden.

## Lokaal bekijken
De site laadt JSON-bestanden en moet daarom via een webadres draaien (dubbelklikken op `index.html` werkt niet).

```bash
python -m http.server 8123 --directory schaats-schemas
```

Open daarna http://localhost:8123.

## Hosten
Zet de map `schaats-schemas` op een statische host:
- **Netlify:** sleep de map naar app.netlify.com/drop. Klaar, je krijgt een link.
- **GitHub Pages:** zet de inhoud in een repository en zet Pages aan op de hoofdmap.

Elke pagina heeft een eigen link, bijvoorbeeld `https://jouwsite.nl/#/week/2026-w41`. Die deel je in de WhatsApp-groep.

## Opbouw
```
index.html            de pagina
css/style.css         opmaak (mobiel-eerst, licht en donker)
js/app.js             pagina's, router, schema-bouwer
js/anim.js            kleine SVG-animaties van de ijsbaan
js/publiceren.js      publiceren naar GitHub vanuit de bouwer
data/config.json      repository waarnaar gepubliceerd wordt
data/oefeningen.json  de oefeningenbibliotheek en de hartslagzones
data/index.json       lijst van alle weken (voor het archief)
data/weken/*.json     één bestand per weekschema
img/                  foto's bij oefeningen
```

## Een nieuw weekschema toevoegen (voor trainers)
1. Open `#/bouwer` ("Trainers" in het menu), vul het schema in of begin met een bestaand schema.
2. Plak bij "Publiceren" eenmalig je toegangssleutel (zie hieronder). De browser onthoudt hem.
3. Klik op "Publiceer schema". Het weekbestand en het weekoverzicht worden bijgewerkt. Na ongeveer een minuut staat het live.
4. Deel de getoonde link in de WhatsApp-groep.

Zonder publiceren kan het ook: "Download weekbestand" en het bestand in `data/weken/` zetten, plus de getoonde regel in `data/index.json`.

## Eenmalige inrichting van het publiceren (beheerder)
De bouwer schrijft via de GitHub-API rechtstreeks naar de repository van de site. GitHub Pages zet de wijziging zelf online.

1. Maak een repository op GitHub en zet de inhoud van deze map in de hoofdmap. Zet bij Settings, Pages de bron op de branch `main` en de map `/ (root)`.
2. Vul `data/config.json` in:
   ```json
   {"owner": "jouw-gebruikersnaam-of-organisatie", "repo": "naam-van-de-repository", "branch": "main"}
   ```
3. Geef elke trainer een eigen toegangssleutel: GitHub, Settings, Developer settings, Personal access tokens, Fine-grained tokens. Kies alleen deze repository en bij Repository permissions: **Contents: Read and write**. Geef de sleutel een einddatum, bijvoorbeeld een jaar.
4. De trainer moet daarvoor een eigen GitHub-account hebben en als collaborator aan de repository zijn toegevoegd.

Let op: wie de sleutel heeft, kan bestanden in die repository wijzigen. Gebruik daarom een repository die alleen de site bevat en trek de sleutel in als iemand stopt als trainer. De wijzigingen staan met naam in de GitHub-geschiedenis, dus een foutje is terug te draaien.

De bouwer uploadt nog geen foto's. Nieuwe foto's zet je in `img/` en je verwijst ernaar in `data/oefeningen.json`.

## Een oefening toevoegen
Voeg een blok toe aan `data/oefeningen.json`:

```json
{
  "id": "unieke-naam",
  "naam": "Naam van de oefening",
  "thema": ["techniek"],
  "types": ["droog"],
  "niveau": "alle",
  "uitleg": "Korte uitleg.",
  "coachpunten": ["Punt 1", "Punt 2"],
  "beelden": [
    {"type": "foto", "src": "img/mijn-foto.jpg", "bijschrift": "Wat je ziet"},
    {"type": "video", "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX", "bijschrift": "Voorbeeld"},
    {"type": "animatie", "anim": "kop-over-kop", "bijschrift": "Zo wissel je"}
  ]
}
```

- `foto`: bestand in `img/`. Klik op de foto voor een grote weergave.
- `video`: YouTube-link. De video laadt pas als je op afspelen tikt.
- `animatie`: naam uit `js/anim.js`. Nu beschikbaar: `kop-over-kop` en `steigerung`. Nieuwe animaties voeg je toe in dat bestand.

## Opmerkingen
- De schema-bouwer bewaart een concept automatisch in de browser van de trainer (niet gedeeld).
- Foto's `a-*.jpg` en `b-*.jpg` zijn uitgesneden uit de Word-schema's van 24 februari en 3 maart 2026.

## Versie 2 (naast de huidige site)
In de map `v2/` staat een tweede versie die naast de eerste draait: `https://ronald-svz.github.io/schaats-schemas/v2/`. De eerste versie blijft ongemoeid. Beide gebruiken dezelfde gegevens (`data/`) en foto's (`img/`).

Wat v2 anders doet:
- **Clubcode in plaats van GitHub-sleutel.** Trainers hoeven geen GitHub-account. Een kleine publicatiedienst (zie `worker/README.md`) zet het schema of de oefening online.
- **Oefening maken** (`#/oefening-maken`): een oefening beschrijven met thema, uitleg en aandachtspunten, en een bestaande oefening bewerken.
- **Eigen animatie maken:** rijders op de ijsbaan naar de juiste plek slepen, stap voor stap. De animatie rijdt zelf van stap naar stap. Met één stap maak je een stilstaande tekening. Beschikbare startvoorbeelden: kop over kop en steigerung.
- **AI-hulp:** een voorstel voor de tekst en de animatie laten maken. Zonder instellingen kopieer je een kant-en-klare opdracht naar je eigen AI-assistent en plak je het antwoord terug. Met een API-sleutel in de publicatiedienst werkt het met één klik.
- **YouTube-video's** aan een oefening koppelen.

Publiceren in v2 werkt pas als `publiceren_url` in `data/config.json` is ingevuld.
