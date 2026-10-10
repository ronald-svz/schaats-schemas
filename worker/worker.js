/* Publicatiedienst voor de schema-bouwer (Cloudflare Worker).
   Ontvangt {code, week}, controleert de clubcode en schrijft het weekschema naar GitHub.
   De GitHub-sleutel staat alleen hier als geheim (GITHUB_TOKEN), nooit in de browser.

   Instellingen (zie README.md in deze map):
     geheim  GITHUB_TOKEN     fine-grained token, alleen "Contents: Read and write" op de site-repository
     geheim  CLUB_CODES       codes per trainer, bijvoorbeeld:  kerstboom7=Jan,vuurtoren3=Els
     variabele GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH
     variabele ALLOWED_ORIGINS  adressen van de site, komma-gescheiden, bijv. https://ronald-svz.github.io
     optioneel geheim ANTHROPIC_API_KEY  zet AI-hulp aan (kost een paar cent per aanvraag); variabele AI_MODEL (standaard claude-sonnet-5-5)
*/

const MAX_BYTES = 200000;
const TYPES = ['droog', 'ijs', 'weekend', 'rust'];

function cors(env, request) {
  const toegestaan = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  return {
    ok: !origin || toegestaan.includes(origin),
    headers: {
      'Access-Control-Allow-Origin': toegestaan.includes(origin) ? origin : (toegestaan[0] || ''),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin'
    }
  };
}
function antwoord(status, body, headers) {
  return new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers) });
}
function tekst(v, max) { return typeof v === 'string' ? v.slice(0, max || 2000) : undefined; }
function getal(v) { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 1000 ? n : undefined; }
function schoon(obj) { const o = {}; for (const k in obj) if (obj[k] !== undefined && obj[k] !== '') o[k] = obj[k]; return o; }

// Alleen bekende velden doorlaten, met een maximale lengte. Zo kan niemand rommel in de bestanden zetten.
function opschonen(w) {
  const item = (i) => schoon({ oef: tekst(i && i.oef, 80), detail: tekst(i && i.detail) });
  const blok = (b) => schoon({ naam: tekst(b && b.naam, 200), minuten: getal(b && b.minuten), zone: [1, 2, 3, 4, 5].includes(Number(b && b.zone)) ? Number(b.zone) : undefined, omschrijving: tekst(b && b.omschrijving), items: Array.isArray(b && b.items) ? b.items.slice(0, 30).map(item) : [] });
  const sessie = (s) => schoon({
    type: TYPES.includes(s && s.type) ? s.type : 'droog', titel: tekst(s && s.titel, 200), datum: /^\d{4}-\d{2}-\d{2}$/.test((s && s.datum) || '') ? s.datum : undefined,
    tijd: /^\d{2}:\d{2}$/.test((s && s.tijd) || '') ? s.tijd : undefined, locatie: tekst(s && s.locatie, 300), tekst: tekst(s && s.tekst),
    blokken: Array.isArray(s && s.blokken) ? s.blokken.slice(0, 30).map(blok) : [], items: Array.isArray(s && s.items) && s.items.length ? s.items.slice(0, 30).map(item) : undefined
  });
  return schoon({ id: w.id, titel: tekst(w.titel, 200), doel: tekst(w.doel), trainingsblok: tekst(w.trainingsblok, 50), intensiteit: tekst(w.intensiteit, 50), bijzonderheden: tekst(w.bijzonderheden), sessies: w.sessies.slice(0, 14).map(sessie) });
}
function controleer(w) {
  if (!w || typeof w !== 'object') return 'Geen schema ontvangen.';
  if (!/^\d{4}-w\d{1,2}$/.test(w.id || '')) return 'De code van de week moet er zo uitzien: 2026-w42.';
  if (!tekst(w.titel)) return 'Vul een titel in.';
  if (!Array.isArray(w.sessies) || !w.sessies.some((s) => s && /^\d{4}-\d{2}-\d{2}$/.test(s.datum || ''))) return 'Voeg minstens één sessie met een datum toe.';
  return '';
}


const ANIMS = ['kop-over-kop', 'steigerung', 'scene'];
const KLEUR = /^#[0-9a-fA-F]{6}$/;

function getalIn(v, min, max, std) { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std; }
// Een scene is een kleine animatie van rijders op de ovale baan: rijders + stappen (keyframes)
function opschonenScene(sc) {
  if (!sc || !Array.isArray(sc.rijders) || !Array.isArray(sc.stappen)) return null;
  const rijders = sc.rijders.slice(0, 6).map((r, i) => ({ naam: tekst(r && r.naam, 20) || String(i + 1), kleur: KLEUR.test((r && r.kleur) || '') ? r.kleur : '#0b6fb8' }));
  if (!rijders.length) return null;
  const stappen = sc.stappen.slice(0, 30).map((st) => {
    const pos = Array.isArray(st && st.posities) ? st.posities : [];
    return schoon({
      duur: getalIn(st && st.duur, 0.2, 10, 1.5), tekst: tekst(st && st.tekst, 120),
      posities: rijders.map((_, i) => ({ s: getalIn(pos[i] && pos[i].s, 0, 1, 0), 'in': getalIn(pos[i] && pos[i]['in'], -20, 20, 0) }))
    });
  });
  if (!stappen.length) return null;
  return { rijders, stappen, lus: sc.lus !== false };
}
function opschonenBeeld(b) {
  if (!b || typeof b !== 'object') return null;
  const bijschrift = tekst(b.bijschrift, 300);
  if (b.type === 'foto') return /^img\/[\w.\-]{1,80}$/.test(b.src || '') ? schoon({ type: 'foto', src: b.src, bijschrift }) : null;
  if (b.type === 'video') return /^https:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//.test(b.url || '') ? schoon({ type: 'video', url: tekst(b.url, 300), bijschrift }) : null;
  if (b.type === 'animatie' && ANIMS.includes(b.anim)) {
    if (b.anim !== 'scene') return schoon({ type: 'animatie', anim: b.anim, bijschrift });
    const scene = opschonenScene(b.scene);
    return scene ? schoon({ type: 'animatie', anim: 'scene', scene, bijschrift }) : null;
  }
  return null;
}
function lijst(v, n, max) { return Array.isArray(v) ? v.slice(0, n).map((x) => tekst(x, max)).filter(Boolean) : []; }
function opschonenOefening(o) {
  const types = lijst(o.types, 4, 20).filter((t) => TYPES.includes(t));
  return schoon({
    id: o.id, naam: tekst(o.naam, 120), thema: lijst(o.thema, 8, 30).map((x) => x.toLowerCase()), types: types.length ? types : ['droog'], niveau: tekst(o.niveau, 20) || 'alle',
    uitleg: tekst(o.uitleg, 3000), coachpunten: lijst(o.coachpunten, 12, 300), beelden: (Array.isArray(o.beelden) ? o.beelden.slice(0, 8) : []).map(opschonenBeeld).filter(Boolean)
  });
}
function controleerOefening(o) {
  if (!o || typeof o !== 'object') return 'Geen oefening ontvangen.';
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(o.id || '')) return 'De code van de oefening mag alleen kleine letters, cijfers en streepjes bevatten.';
  if (!tekst(o.naam)) return 'Vul een naam in.';
  return '';
}

const AI_PROMPT = `Je helpt schaatstrainers om een oefening uit te werken voor een website. Antwoord uitsluitend met één JSON-object, zonder uitleg eromheen en zonder codeblok.
Velden: {"naam": korte naam, "thema": [1 tot 3 woorden uit: techniek, bocht, conditie, snelheid, kracht, stabiliteit, coordinatie, warming-up, cooling-down, herstel, start, teamwork], "types": ["droog" en/of "ijs" en/of "weekend"], "niveau": "alle" of "gevorderd", "uitleg": 2 tot 4 zinnen in eenvoudig Nederlands, "coachpunten": [2 tot 4 korte aandachtspunten], "scene": optioneel animatie van rijders op de ijsbaan}.
Een scene bestaat uit: "rijders": [{"naam": "1", "kleur": "#e0802a"}, ...] (maximaal 6, kleur als #rrggbb) en "stappen": een lijst keyframes {"duur": seconden (0.5 tot 4), "tekst": korte uitleg bij die stap, "posities": [{"s": 0 tot 1, "in": -12 tot 12}, ... één per rijder in dezelfde volgorde]}.
De baan is een ovaal en er wordt tegen de klok in gereden. "s" is de afstand langs de baan als fractie van een hele ronde: 0 tot 0.24 is het onderste rechte stuk (van links naar rechts), 0.24 tot 0.5 de bocht rechts, 0.5 tot 0.74 het bovenste rechte stuk, 0.74 tot 1 de bocht links. "in" is de zijwaartse plaats: 0 is midden op de baan, positief naar de binnenkant, negatief naar de buitenkant.
Een rijder die vooraan rijdt heeft een hogere "s" dan een rijder erachter. Laat rijders steeds vooruit rijden (s neemt toe, over 1 heen telt als doorrijden naar 0). Gebruik 3 tot 6 stappen. Laat de laatste stap aansluiten op de eerste, zodat de animatie vloeiend herhaalt. Laat "scene" weg als de oefening geen beweging op de baan is (bijvoorbeeld rompstabiliteit).`;

async function aiAanvraag(env, beschrijving) {
  if (!env.ANTHROPIC_API_KEY) return { status: 501, fout: 'AI-hulp is op deze site niet aangezet.' };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: env.AI_MODEL || 'claude-sonnet-5-5', max_tokens: 2500, system: AI_PROMPT, messages: [{ role: 'user', content: beschrijving }] })
  });
  if (!r.ok) return { status: 502, fout: 'De AI gaf geen antwoord (' + r.status + '). Probeer het zo nog een keer.' };
  const data = await r.json();
  const txt = ((data.content || []).find((c) => c.type === 'text') || {}).text || '';
  const a = txt.indexOf('{'); const b = txt.lastIndexOf('}');
  let ruw;
  try { ruw = JSON.parse(txt.slice(a, b + 1)); } catch (e) { return { status: 502, fout: 'Het AI-antwoord was niet te lezen. Probeer het nog een keer, of formuleer het anders.' }; }
  const oef = opschonenOefening(Object.assign({ id: 'concept' }, ruw));
  const scene = opschonenScene(ruw.scene);
  return { status: 200, oefening: oef, scene };
}

function naarBase64(t) { const b = new TextEncoder().encode(t); let s = ''; b.forEach((x) => { s += String.fromCharCode(x); }); return btoa(s); }
function vanBase64(b64) { const s = atob(String(b64).replace(/\s/g, '')); return new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0))); }

async function gh(env, pad, opties) {
  const o = opties || {};
  const url = 'https://api.github.com/repos/' + env.GITHUB_OWNER + '/' + env.GITHUB_REPO + '/contents/' + pad.split('/').map(encodeURIComponent).join('/') + (o.method ? '' : '?ref=' + encodeURIComponent(env.GITHUB_BRANCH || 'main'));
  const r = await fetch(url, {
    method: o.method || 'GET',
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + env.GITHUB_TOKEN, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'schaats-publicatie', 'Content-Type': 'application/json' },
    body: o.body ? JSON.stringify(o.body) : undefined
  });
  if (r.status === 404 && !o.method) return null;
  if (!r.ok) { const e = new Error('GitHub ' + r.status); e.status = r.status; throw e; }
  return r.json();
}
async function bewaar(env, pad, inhoud, bericht, bijwerken) {
  for (let poging = 0; poging < 3; poging++) {
    const bestaand = await gh(env, pad);
    const nieuw = bijwerken ? bijwerken(bestaand ? vanBase64(bestaand.content) : null) : inhoud;
    try {
      await gh(env, pad, { method: 'PUT', body: { message: bericht, content: naarBase64(nieuw), branch: env.GITHUB_BRANCH || 'main', sha: bestaand ? bestaand.sha : undefined } });
      return;
    } catch (e) {
      if ((e.status === 409 || e.status === 422) && poging < 2) continue; // iemand was net eerder: opnieuw lezen
      throw e;
    }
  }
}


// Een weekschema verwijderen. Eerst uit het overzicht, daarna het bestand, zodat er nooit een verwijzing naar een ontbrekend bestand overblijft.
async function verwijderWeek(env, id, trainer) {
  await bewaar(env, 'data/index.json', null, 'Weekoverzicht bijgewerkt: ' + id + ' verwijderd (door ' + trainer + ')', (huidig) => {
    const index = huidig ? JSON.parse(huidig) : { weken: [] };
    index.weken = (index.weken || []).filter((w) => w.id !== id);
    return JSON.stringify(index, null, 2) + '\n';
  });
  const pad = 'data/weken/' + id + '.json';
  for (let poging = 0; poging < 3; poging++) {
    const bestand = await gh(env, pad);
    if (!bestand) return false; // bestond al niet meer
    try {
      await gh(env, pad, { method: 'DELETE', body: { message: 'Schema ' + id + ' verwijderd (door ' + trainer + ')', sha: bestand.sha, branch: env.GITHUB_BRANCH || 'main' } });
      return true;
    } catch (e) {
      if ((e.status === 409 || e.status === 422) && poging < 2) continue;
      throw e;
    }
  }
  return false;
}

function zoekTrainer(env, code) {
  const lijst = String(env.CLUB_CODES || '').split(',').map((s) => s.trim()).filter(Boolean);
  let gevonden = null;
  for (const regel of lijst) { // alle codes langslopen, zodat de tijd niet verraadt welke klopt
    const i = regel.indexOf('=');
    const c = i < 0 ? regel : regel.slice(0, i); const naam = i < 0 ? 'trainer' : regel.slice(i + 1);
    if (c.length === code.length && c === code && c.length >= 6) gevonden = naam;
  }
  return gevonden;
}

export default {
  async fetch(request, env) {
    const c = cors(env, request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: c.headers });
    if (request.method !== 'POST') return antwoord(405, { ok: false, fout: 'Alleen POST.' }, c.headers);
    if (!c.ok) return antwoord(403, { ok: false, fout: 'Deze site mag hier niet publiceren.' }, c.headers);
    if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO || !env.CLUB_CODES) return antwoord(500, { ok: false, fout: 'De publicatiedienst is nog niet ingesteld.' }, c.headers);

    const ruw = await request.text();
    if (ruw.length > MAX_BYTES) return antwoord(413, { ok: false, fout: 'Het schema is te groot.' }, c.headers);
    let invoer;
    try { invoer = JSON.parse(ruw); } catch (e) { return antwoord(400, { ok: false, fout: 'Ongeldig verzoek.' }, c.headers); }

    const trainer = zoekTrainer(env, String(invoer.code || ''));
    if (!trainer) { await new Promise((r) => setTimeout(r, 700)); return antwoord(401, { ok: false, fout: 'De clubcode klopt niet.' }, c.headers); }

    const soort = invoer.soort || 'week';

    if (soort === 'ai') {
      const vraag = tekst(invoer.beschrijving, 1500);
      if (!vraag || vraag.length < 10) return antwoord(400, { ok: false, fout: 'Beschrijf de oefening in een paar zinnen.' }, c.headers);
      const res = await aiAanvraag(env, vraag);
      return antwoord(res.status, res.status === 200 ? { ok: true, oefening: res.oefening, scene: res.scene } : { ok: false, fout: res.fout }, c.headers);
    }

    if (soort === 'oefening') {
      const probleemO = controleerOefening(invoer.oefening);
      if (probleemO) return antwoord(400, { ok: false, fout: probleemO }, c.headers);
      const oef = opschonenOefening(invoer.oefening);
      try {
        await bewaar(env, 'data/oefeningen.json', null, 'Oefening ' + oef.naam + ' (door ' + trainer + ')', (huidig) => {
          const data = huidig ? JSON.parse(huidig) : { oefeningen: [], zones: [] };
          const i = data.oefeningen.findIndex((x) => x.id === oef.id);
          if (i >= 0) data.oefeningen[i] = oef; else data.oefeningen.push(oef);
          return JSON.stringify(data, null, 2) + '\n';
        });
      } catch (e) {
        return antwoord(502, { ok: false, fout: 'Opslaan bij GitHub is niet gelukt. Probeer het zo nog een keer.' }, c.headers);
      }
      return antwoord(200, { ok: true }, c.headers);
    }

    if (soort === 'verwijder-week') {
      const id = String(invoer.id || '');
      if (!/^\d{4}-w\d{1,2}$/.test(id)) return antwoord(400, { ok: false, fout: 'De code van de week moet er zo uitzien: 2026-w42.' }, c.headers);
      try {
        const bestond = await verwijderWeek(env, id, trainer);
        return antwoord(200, { ok: true, bestond }, c.headers);
      } catch (e) {
        return antwoord(502, { ok: false, fout: 'Verwijderen bij GitHub is niet gelukt. Probeer het zo nog een keer.' }, c.headers);
      }
    }

    if (soort !== 'week') return antwoord(400, { ok: false, fout: 'Onbekende opdracht. Is de publicatiedienst bijgewerkt?' }, c.headers);

    const probleem = controleer(invoer.week);
    if (probleem) return antwoord(400, { ok: false, fout: probleem }, c.headers);
    const week = opschonen(invoer.week);
    const start = week.sessies.map((s) => s.datum).filter(Boolean).sort()[0];

    try {
      await bewaar(env, 'data/weken/' + week.id + '.json', JSON.stringify(week, null, 2) + '\n', 'Schema ' + week.titel + ' (door ' + trainer + ')');
      await bewaar(env, 'data/index.json', null, 'Weekoverzicht bijgewerkt: ' + week.titel + ' (door ' + trainer + ')', (huidig) => {
        const index = huidig ? JSON.parse(huidig) : { weken: [] };
        index.weken = (index.weken || []).filter((w) => w.id !== week.id);
        index.weken.push({ id: week.id, titel: week.titel, start, bijzonderheden: week.bijzonderheden || '' });
        index.weken.sort((a, b) => String(b.start).localeCompare(String(a.start)));
        return JSON.stringify(index, null, 2) + '\n';
      });
    } catch (e) {
      return antwoord(502, { ok: false, fout: 'Opslaan bij GitHub is niet gelukt. Probeer het zo nog een keer.' }, c.headers);
    }
    return antwoord(200, { ok: true }, c.headers);
  }
};
