/* Publiceert een weekschema rechtstreeks naar de GitHub-repository van de site (GitHub Pages).
   De trainer plakt eenmalig een persoonlijke toegangssleutel (fine-grained token, alleen "Contents: lezen en schrijven"
   op deze ene repository). Er wordt niets via een eigen server verstuurd. */
(function () {
  'use strict';
  const API = 'https://api.github.com';

  function naarBase64(tekst) {
    const bytes = new TextEncoder().encode(tekst);
    let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); });
    return btoa(s);
  }
  function vanBase64(b64) {
    const s = atob(String(b64).replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
  }

  async function gh(cfg, token, pad, opties) {
    const url = API + '/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + pad.split('/').map(encodeURIComponent).join('/');
    const o = opties || {};
    const r = await fetch(o.method === 'PUT' ? url : url + '?ref=' + encodeURIComponent(cfg.branch || 'main'), {
      method: o.method || 'GET',
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: o.body ? JSON.stringify(o.body) : undefined
    });
    if (r.status === 404 && !o.method) return null; // bestand bestaat nog niet
    if (!r.ok) {
      let melding = '';
      try { melding = (await r.json()).message || ''; } catch (e) { /* geen JSON */ }
      const fout = new Error(uitleg(r.status, melding));
      fout.status = r.status; throw fout;
    }
    return r.json();
  }
  function uitleg(status, melding) {
    if (status === 401) return 'De sleutel is ongeldig of verlopen. Maak een nieuwe aan en plak die opnieuw.';
    if (status === 403) return 'Deze sleutel mag hier niet schrijven. Controleer of hij "Contents: Read and write" heeft voor de juiste repository.';
    if (status === 404) return 'Repository of map niet gevonden. Controleer data/config.json en de rechten van de sleutel.';
    if (status === 409 || status === 422) return 'Het bestand is net door iemand anders gewijzigd. Probeer het nog een keer.';
    return 'GitHub gaf een fout (' + status + ')' + (melding ? ': ' + melding : '') + '.';
  }

  async function bewaar(cfg, token, pad, inhoud, bericht) {
    for (let poging = 0; poging < 3; poging++) {
      const bestaand = await gh(cfg, token, pad);
      try {
        await gh(cfg, token, pad, { method: 'PUT', body: { message: bericht, content: naarBase64(inhoud), branch: cfg.branch || 'main', sha: bestaand ? bestaand.sha : undefined } });
        return;
      } catch (e) {
        if ((e.status === 409 || e.status === 422) && poging < 2) continue; // iemand was net eerder: opnieuw lezen en nog eens proberen
        throw e;
      }
    }
  }

  function controleer(week) {
    if (!/^\d{4}-w\d{1,2}$/.test(week.id || '')) return 'Vul een code in zoals 2026-w42.';
    if (!week.titel) return 'Vul een titel in.';
    const metDatum = (week.sessies || []).filter((s) => s.datum);
    if (!metDatum.length) return 'Voeg minstens één sessie met een datum toe.';
    return '';
  }

  // Zet {id, titel, start, bijzonderheden} in de lijst en bewaar die op volgorde van start (nieuwste eerst)
  async function werkIndexBij(cfg, token, week, schoon) {
    const start = (week.sessies || []).map((s) => s.datum).filter(Boolean).sort()[0];
    for (let poging = 0; poging < 3; poging++) {
      const bestand = await gh(cfg, token, 'data/index.json');
      const index = bestand ? JSON.parse(vanBase64(bestand.content)) : { weken: [] };
      index.weken = (index.weken || []).filter((w) => w.id !== week.id);
      index.weken.push({ id: week.id, titel: week.titel, start, bijzonderheden: week.bijzonderheden || '' });
      index.weken.sort((a, b) => String(b.start).localeCompare(String(a.start)));
      try {
        await gh(cfg, token, 'data/index.json', { method: 'PUT', body: { message: 'Weekoverzicht bijgewerkt: ' + week.titel, content: naarBase64(JSON.stringify(index, null, 2) + '\n'), branch: cfg.branch || 'main', sha: bestand ? bestand.sha : undefined } });
        return;
      } catch (e) {
        if ((e.status === 409 || e.status === 422) && poging < 2) continue;
        throw e;
      }
    }
  }

  // Publiceren: eerst het weekbestand, daarna de lijst. Zo staat er nooit een verwijzing naar een ontbrekend bestand.
  window.publiceerSchema = async function (week, schoon, cfg, token) {
    const probleem = controleer(week);
    if (probleem) throw new Error(probleem);
    if (!cfg || !cfg.owner || !cfg.repo) throw new Error('Publiceren is nog niet ingesteld. Vul data/config.json in (zie README).');
    if (!token) throw new Error('Plak eerst je toegangssleutel.');
    await bewaar(cfg, token, 'data/weken/' + week.id + '.json', JSON.stringify(schoon, null, 2) + '\n', 'Schema ' + week.titel);
    await werkIndexBij(cfg, token, week, schoon);
  };
  window.__publiceerHulp = { naarBase64, vanBase64, controleer }; // voor tests
})();
