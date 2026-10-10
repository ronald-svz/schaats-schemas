# Publicatiedienst (Cloudflare Worker)

Deze kleine dienst zit tussen de bouwer en GitHub. De trainer vult een **clubcode** in. De dienst controleert die en schrijft het schema of de oefening naar GitHub. De GitHub-sleutel staat alleen in de dienst en komt nooit in een browser.

```
Trainer  --clubcode + schema-->  Worker  --GitHub-sleutel-->  GitHub  -->  GitHub Pages  -->  site
```

De dienst kan vier dingen (een schema is een training: een dag met tijd, plaats en groepen):
1. een training opslaan en het overzicht bijwerken;
2. een training verwijderen (uit het overzicht en het bestand);
3. een oefening opslaan of vervangen (inclusief eigen animatie);
4. optioneel: met AI een voorstel voor een oefening en animatie maken.

Hij laat alleen bekende velden door, met een maximale lengte, en schrijft alleen naar `data/trainingen/<code>.json`, `data/index.json` en `data/oefeningen.json`. Een verwijderd schema blijft terug te vinden in de GitHub-geschiedenis.

**Na een wijziging in `worker.js` moet je de code opnieuw in Cloudflare plakken** (Edit code, alles vervangen, Deploy). De variabelen en geheimen blijven staan.

## Eenmalig instellen (beheerder, ongeveer 15 minuten)

De namen van de knoppen bij Cloudflare kunnen iets afwijken, de volgorde blijft hetzelfde.

1. **Cloudflare-account.** Maak een gratis account op dash.cloudflare.com. Een creditcard is niet nodig voor het gratis plan.
2. **Worker maken.** Ga naar *Workers & Pages*, kies *Create*, dan *Create Worker*. Geef hem de naam `schaats-publicatie` en klik op *Deploy*. Klik daarna op *Edit code*, vervang alles door de inhoud van `worker.js` uit deze map en klik op *Deploy*.
3. **Variabelen.** Open de Worker, ga naar *Settings*, dan *Variables and Secrets*. Voeg toe als gewone variabele (*Text*):
   - `GITHUB_OWNER` = `ronald-svz`
   - `GITHUB_REPO` = `schaats-schemas`
   - `GITHUB_BRANCH` = `main`
   - `ALLOWED_ORIGINS` = `https://ronald-svz.github.io`
4. **Geheimen.** Voeg toe als *Secret*:
   - `GITHUB_TOKEN`: een fine-grained token van GitHub met alleen de repository `schaats-schemas` en **Contents: Read and write**. Maak hem aan zoals in de hoofd-README beschreven.
   - `CLUB_CODES`: de codes per trainer, bijvoorbeeld `kerstboom7=Jan,vuurtoren3=Els`. Gebruik minstens 6 tekens per code. De naam komt in de GitHub-geschiedenis te staan, zodat je ziet wie wat heeft gepubliceerd.
5. **Adres koppelen.** Kopieer het adres van de Worker (iets als `https://schaats-publicatie.jouwnaam.workers.dev`) naar `data/config.json`:
   ```json
   {"owner": "ronald-svz", "repo": "schaats-schemas", "branch": "main", "publiceren_url": "https://schaats-publicatie.jouwnaam.workers.dev", "ai": false}
   ```
   Zet dit bestand daarna op GitHub, net als de andere bestanden.
6. **Link voor trainers.** Stuur elke trainer een persoonlijke link, zodat de code vanzelf wordt opgeslagen:
   `https://ronald-svz.github.io/schaats-schemas/#/bouwer?code=kerstboom7`
   De code verdwijnt na het openen uit de adresbalk en wordt in de browser onthouden.

## Een code intrekken
Pas `CLUB_CODES` aan in Cloudflare. De oude code werkt meteen niet meer.

## AI-hulp aanzetten (optioneel, kost geld)
Zonder dit werkt het kopiëren van de opdracht naar je eigen AI-assistent nog steeds.

1. Maak een API-sleutel bij console.anthropic.com en **stel daar een maandlimiet in** (bijvoorbeeld €5), zodat de kosten niet kunnen oplopen.
2. Voeg in Cloudflare de *Secret* `ANTHROPIC_API_KEY` toe. Eventueel de variabele `AI_MODEL` (standaard `claude-sonnet-5-5`).
3. Zet `"ai": true` in `data/config.json`. Daarna verschijnt in de oefening-editor de knop "Laat AI een voorstel maken".

Elke aanvraag kost een paar cent. Iedereen met een geldige clubcode kan de knop gebruiken. De dienst heeft geen eigen aanvraaglimiet, dus de maandlimiet bij Anthropic is je vangnet.

## Wat niet geregeld is
- Een clubcode die gelekt is, kan door iedereen worden gebruikt tot je hem intrekt.
- Foto's uploaden kan niet. Foto's zet je zelf in `img/` op GitHub.
- Een foutieve poging met een verkeerde code wordt 0,7 seconde vertraagd, maar er is geen blokkade na herhaald proberen.

## Lokaal testen
De code is getest tegen een nagebootste GitHub en AI, niet tegen de echte Cloudflare, GitHub of Anthropic. Test na het instellen eerst met een proefschema en een proefoefening en verwijder die daarna in GitHub.
