# Trainingsschema's Schaatsvereniging Zwolle

Statische site zonder database en zonder build. Alles staat in gewone bestanden.

## Het idee
**Een schema is een training**: een dag, een tijd, een plaats, een of meer groepen en blokken met oefeningen. Een week is dus geen schema maar een manier om trainingen te tonen. Heeft een groep op dinsdag en vrijdag training, dan zijn dat twee schema's. In Inzell zijn het er elke dag een, samen te herkennen aan dezelfde kampnaam.

## Wat de site doet
- **Startpagina:** deelnemers kiezen hun groep (onthouden op het apparaat) en zien de komende trainingen per week, met bovenaan de training van vandaag of de eerstvolgende. Eerdere trainingen staan in een uitklapper. Filters op **jaar** en op **kamp of reeks** staan onder de groepsknoppen. De kampknoppen volgen vanzelf uit de trainingen: kampen met een komende training staan erbij, en kies je een jaar dan ook de kampen uit dat jaar.
- **Een training bekijken:** de blokken met tijden en hartslagzones, per oefening uitleg, foto's, video's en animaties, en een knop om de link te delen. Daaronder andere trainingen op dezelfde dag en een knop naar de vorige en volgende training.
- **Groepen:** een training is voor één groep, voor meerdere groepen of voor alle groepen. Directe link per groep: `…/#/groep/junioren`.
- **Kampen:** trainingen met dezelfde kampnaam krijgen een eigen overzichtspagina (`…/#/kamp/trainingskamp-inzell`).
- **Weken:** `…/#/week/2026-w42` toont alle trainingen van een week. Oude links naar een week blijven zo werken.
- **Oefeningen:** doorzoekbare bibliotheek. Trainers kunnen oefeningen toevoegen en bewerken (`#/oefening-maken`), met eigen animaties en AI-hulp.
- **Trainers publiceren met een clubcode** (geen GitHub-account nodig) en kunnen een training verwijderen, ook met de clubcode.
- **Huisstijl:** logo en blauw van Schaatsvereniging Zwolle (`img/logo.png`, kleur `#0860ac`), met pictogram en deelplaatje voor WhatsApp.

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

Elke training heeft een eigen link, bijvoorbeeld `https://jouwsite.nl/#/training/2026-10-13-junioren-ijs`. Die deel je in de WhatsApp-groep.

## Opbouw
```
index.html              de pagina
css/style.css           opmaak (mobiel-eerst, licht en donker)
js/app.js               pagina's, router, training-bouwer
js/editor.js            oefening maken, animatie tekenen, AI-hulp
js/anim.js              SVG-animaties van de ijsbaan
js/publiceren.js        publiceren via de publicatiedienst
data/config.json        groepen, adres van de publicatiedienst
data/oefeningen.json    de oefeningenbibliotheek en de hartslagzones
data/index.json         lijst van alle trainingen
data/trainingen/*.json  een bestand per training
img/                    foto's bij oefeningen en het logo
worker/                 de publicatiedienst (Cloudflare Worker)
v2/                     doorverwijzing van het oude adres
```

## Een training: de velden
```json
{
  "id": "2026-10-13-junioren-masters-ijs",
  "type": "ijs",
  "titel": "Techniek in de bocht",
  "datum": "2026-10-13",
  "tijd": "19:00",
  "locatie": "Deventer",
  "groepen": ["junioren", "masters"],
  "kamp": "Trainingskamp Inzell",
  "doel": "…", "trainingsblok": "VP2", "intensiteit": "70%", "bijzonderheden": "…",
  "blokken": [{ "naam": "Warming-up", "minuten": 15, "zone": 1, "items": [{ "oef": "inrijden", "detail": "6 ronden rustig" }] }]
}
```
- `type`: `droog`, `ijs`, `weekend` of `rust` (voor rustdagen en weekenden met alleen `tekst`).
- `groepen`: leeg of weglaten = alle groepen. De groepen staan in `data/config.json`.
- `kamp`: alleen invullen als de training bij een kamp of reeks hoort. In de bouwer kies je uit de bestaande kampen of maak je een nieuw kamp aan. Typ je een naam die al bestaat (hoofdletters en accenten maken niet uit), dan wordt het bestaande kamp gekozen, zodat er geen dubbele kampen ontstaan.
- **Code (`id`)** begint met de datum, daarna eventueel groep, kamp en soort: `2026-10-13-junioren-ijs`. Kleine letters, cijfers en streepjes. In de bouwer staat een voorstel dat je met een klik overneemt. Dezelfde code vervangt een bestaande training.

## Een training toevoegen (voor trainers)
1. Open je persoonlijke link met de clubcode (of `#/bouwer` en vul de code eenmalig in). De browser onthoudt hem.
2. Kies Soort, Datum, Tijd, Locatie en voor welke groepen het is. Begin eventueel met een bestaande training.
3. Voeg blokken met oefeningen toe, kijk met "Voorbeeld bekijken" hoe het eruitziet en klik op "Publiceer training".
4. Na ongeveer een minuut staat het live. Deel de getoonde link in de WhatsApp-groep.
5. Voor een kamp of een tweede dag: klik op "Nieuwe training op basis van deze". De training wordt gekopieerd naar de volgende dag.

Zonder publiceren kan het ook: "Download bestand" en het bestand in `data/trainingen/` zetten, plus de getoonde regel in de lijst `trainingen` in `data/index.json`.

## Eenmalige inrichting van het publiceren (beheerder)
Zie `worker/README.md`. Kort: een gratis Cloudflare Worker met een GitHub-sleutel als geheim en een lijst clubcodes. De adressen staan in `data/config.json`.

## Een oefening toevoegen
Gebruik `#/oefening-maken` op de site, of voeg een blok toe aan `data/oefeningen.json`:

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
- `animatie`: een naam uit `js/anim.js` (`kop-over-kop`, `steigerung`), of `scene` met zelf getekende stappen (zie de editor).

## Opmerkingen
- De bouwer bewaart een concept automatisch in de browser van de trainer (niet gedeeld).
- Foto's `a-*.jpg` en `b-*.jpg` zijn uitgesneden uit de Word-schema's van 24 februari en 3 maart 2026.
- Eerder gedeelde links naar een week (`#/week/2026-w41`) en naar `…/v2/` blijven werken.
