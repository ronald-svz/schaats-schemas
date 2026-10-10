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
1. Open je persoonlijke link met de clubcode (of `#/bouwer` en vul de code eenmalig in). Vul het schema in of begin met een bestaand schema.
2. De browser onthoudt de clubcode.
3. Klik op "Publiceer schema". Het weekbestand en het weekoverzicht worden bijgewerkt. Na ongeveer een minuut staat het live.
4. Deel de getoonde link in de WhatsApp-groep.

Zonder publiceren kan het ook: "Download weekbestand" en het bestand in `data/weken/` zetten, plus de getoonde regel in `data/index.json`.

## Eenmalige inrichting van het publiceren (beheerder)
Zie `worker/README.md`. Kort: een gratis Cloudflare Worker met een GitHub-sleutel als geheim en een lijst clubcodes. De adressen staan in `data/config.json`.

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

## Wat de site doet
- **Schema's bekijken:** per week de sessies en blokken, met per oefening uitleg, foto's, video's en animaties. Elke week heeft een eigen link om te delen.
- **Schema verwijderen:** in de bouwer, bevestigd met de clubcode. Het schema verdwijnt uit de site; de GitHub-geschiedenis houdt het bij.
- **Oefeningen:** doorzoekbare bibliotheek. Trainers kunnen oefeningen toevoegen en bewerken (`#/oefening-maken`).
- **Eigen animaties maken:** rijders op de ijsbaan naar de juiste plek slepen, stap voor stap. Met één stap maak je een stilstaande tekening. Startvoorbeelden: kop over kop en steigerung.
- **AI-hulp:** een voorstel voor tekst en animatie laten maken. Zonder instellingen kopieer je een opdracht naar je eigen AI-assistent en plak je het antwoord terug. Met een API-sleutel in de publicatiedienst werkt het met één klik.
- **Publiceren met een clubcode:** trainers hebben geen GitHub-account nodig. Een kleine publicatiedienst (zie `worker/README.md`) zet het schema of de oefening online. Een persoonlijke link bewaart de code: `…/#/bouwer?code=<code>`.
- **Huisstijl:** logo en blauw van Schaatsvereniging Zwolle (`img/logo.png`, kleur `#0860ac`), met pictogram en deelplaatje voor WhatsApp (`img/logo-og.jpg`).
- Het oude adres `…/v2/` stuurt door naar de hoofdsite, zodat eerder gedeelde links blijven werken.
