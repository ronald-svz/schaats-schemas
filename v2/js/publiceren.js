/* Publiceert een weekschema via een kleine tussenstap (Cloudflare Worker, zie ../worker/).
   De trainer hoeft alleen de clubcode in te vullen. De GitHub-sleutel staat veilig in de Worker en komt nooit in de browser. */
(function () {
  'use strict';

  function controleer(week) {
    if (!/^\d{4}-w\d{1,2}$/.test(week.id || '')) return 'Vul een code in zoals 2026-w42.';
    if (!week.titel) return 'Vul een titel in.';
    if (!(week.sessies || []).some((s) => s.datum)) return 'Voeg minstens één sessie met een datum toe.';
    return '';
  }

  window.publiceerSchema = async function (week, schoon, cfg, code) {
    const probleem = controleer(week);
    if (probleem) throw new Error(probleem);
    if (!cfg || !cfg.publiceren_url) throw new Error('Publiceren is nog niet ingesteld. Vul publiceren_url in data/config.json in (zie README).');
    if (!code) throw new Error('Vul eerst de clubcode in.');
    let r;
    try {
      r = await fetch(cfg.publiceren_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, week: schoon }) });
    } catch (e) {
      throw new Error('Geen verbinding met de publicatiedienst. Controleer je internet en probeer het nog een keer.');
    }
    let uitkomst = {};
    try { uitkomst = await r.json(); } catch (e) { /* geen JSON */ }
    if (r.ok && uitkomst.ok) return;
    if (r.status === 401) throw new Error('De clubcode klopt niet. Vraag de juiste code aan de beheerder.');
    if (r.status === 429) throw new Error('Even rustig aan: te veel pogingen. Probeer het over een paar minuten opnieuw.');
    throw new Error(uitkomst.fout || 'Publiceren is niet gelukt (' + r.status + '). Probeer het later nog een keer.');
  };

  async function stuur(cfg, code, body) {
    if (!cfg || !cfg.publiceren_url) throw new Error('Publiceren is nog niet ingesteld. Vul publiceren_url in data/config.json in (zie README).');
    if (!code) throw new Error('Vul eerst de clubcode in.');
    let r;
    try {
      r = await fetch(cfg.publiceren_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ code }, body)) });
    } catch (e) {
      throw new Error('Geen verbinding met de publicatiedienst. Controleer je internet en probeer het nog een keer.');
    }
    let uitkomst = {};
    try { uitkomst = await r.json(); } catch (e) { /* geen JSON */ }
    if (r.ok && uitkomst.ok) return uitkomst;
    if (r.status === 401) throw new Error('De clubcode klopt niet. Vraag de juiste code aan de beheerder.');
    if (r.status === 429) throw new Error('Even rustig aan: te veel pogingen. Probeer het over een paar minuten opnieuw.');
    throw new Error(uitkomst.fout || 'Het is niet gelukt (' + r.status + '). Probeer het later nog een keer.');
  }
  window.publiceerOefening = async function (oefening, cfg, code) {
    if (!oefening.naam) throw new Error('Vul een naam in.');
    if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(oefening.id || '')) throw new Error('Geef de oefening een naam met letters of cijfers.');
    await stuur(cfg, code, { soort: 'oefening', oefening });
  };
  window.vraagAI = async function (beschrijving, cfg, code) {
    if (!beschrijving || beschrijving.trim().length < 10) throw new Error('Beschrijf de oefening eerst in een paar zinnen.');
    return stuur(cfg, code, { soort: 'ai', beschrijving: beschrijving.trim() });
  };
  window.__publiceerHulp = { controleer };
})();
