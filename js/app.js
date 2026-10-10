/* Trainingsschema's Schaatsvereniging Zwolle: statische site zonder build en zonder database.
   Gegevens staan in data/ (oefeningen.json, index.json en per week een bestand in data/weken/). */
(function () {
  'use strict';

  const BASE = ''; // gegevens en foto's staan naast de pagina
  const app = document.getElementById('app');
  const cache = { index: null, oef: null, weken: {} };
  const TYPES = { droog: 'Droogtraining', ijs: 'IJstraining', weekend: 'Weekend', rust: 'Rustdag' };

  // ---------- hulpfuncties ----------
  function h(tag, attrs) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(parent, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach((x) => add(parent, x));
    else parent.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('zichtbaar');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('zichtbaar'), 2600);
  }
  function datumTekst(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function jaarDatum(iso) {
    const d = new Date(iso + 'T12:00:00');
    return isNaN(d) ? '' : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  async function haal(pad) {
    const r = await fetch(pad, { cache: 'no-cache' });
    if (!r.ok) throw new Error(pad + ' (' + r.status + ')');
    return r.json();
  }
  async function laadBasis() {
    if (!cache.index) cache.index = await haal(BASE + 'data/index.json');
    if (!cache.config) cache.config = await haal(BASE + 'data/config.json').catch(() => ({}));
    if (!cache.oef) {
      const o = await haal(BASE + 'data/oefeningen.json');
      cache.oef = o; cache.oefById = {};
      o.oefeningen.forEach((x) => { cache.oefById[x.id] = x; });
    }
  }
  async function laadWeek(id) {
    if (!cache.weken[id]) cache.weken[id] = await haal(BASE + 'data/weken/' + encodeURIComponent(id) + '.json');
    return cache.weken[id];
  }
  function maakCopyLink(url) {
    if (navigator.share) return navigator.share({ title: document.title, url }).catch(() => {});
    return navigator.clipboard.writeText(url).then(() => toast('Link gekopieerd'), () => toast(url));
  }
  function totaalMinuten(sessie) { return (sessie.blokken || []).reduce((n, b) => n + (Number(b.minuten) || 0), 0); }

  // ---------- beelden ----------
  function youtubeId(url) {
    const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
    return m ? m[1] : null;
  }
  function beeld(b) {
    if (b.type === 'animatie') return h('figure', null, window.maakAnimatie(b.anim, b), b.bijschrift && h('figcaption', { text: b.bijschrift }));
    if (b.type === 'video') {
      const id = youtubeId(b.url);
      if (!id) return h('p', null, h('a', { href: b.url, target: '_blank', rel: 'noopener', text: b.bijschrift || 'Bekijk video' }));
      const knop = h('button', { type: 'button', 'aria-label': 'Video afspelen: ' + (b.bijschrift || '') , style: 'background-image:url(https://i.ytimg.com/vi/' + id + '/hqdefault.jpg)', text: '▶ Afspelen' });
      const box = h('div', { class: 'video' }, knop);
      knop.addEventListener('click', () => {
        box.replaceChildren(h('iframe', { src: 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0', allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: true, title: b.bijschrift || 'Video' }));
      });
      return h('figure', null, box, b.bijschrift && h('figcaption', { text: b.bijschrift }));
    }
    const img = h('img', { src: BASE + b.src, alt: b.bijschrift || '', loading: 'lazy' });
    img.addEventListener('click', () => {
      const d = document.getElementById('lightbox');
      d.querySelector('img').src = BASE + b.src; d.querySelector('img').alt = b.bijschrift || '';
      d.querySelector('p').textContent = b.bijschrift || '';
      d.showModal();
    });
    return h('figure', null, img, b.bijschrift && h('figcaption', { text: b.bijschrift }));
  }
  function oefeningInhoud(o) {
    return h('div', { class: 'oef-body' },
      o.uitleg && h('p', { text: o.uitleg }),
      o.coachpunten && o.coachpunten.length ? h('div', null, h('strong', { text: 'Let op' }), h('ul', null, o.coachpunten.map((c) => h('li', { text: c })))) : null,
      o.beelden && o.beelden.length ? h('div', { class: 'beelden' }, o.beelden.map(beeld)) : null);
  }

  // ---------- weergave: week ----------
  function zoneChip(z) {
    const info = cache.oef.zones.find((x) => x.zone === Number(z));
    return h('span', { class: 'chip zone z' + z, title: info ? info.naam + ' ' + info.intensiteit : '', text: 'Zone ' + z + (info ? ' · ' + info.naam : '') });
  }
  function itemKaart(it) {
    const o = cache.oefById[it.oef];
    const wrap = h('div', { class: 'item' });
    if (it.detail) wrap.appendChild(h('p', { class: 'detail', text: it.detail }));
    if (o) {
      const heeftBeeld = o.beelden && o.beelden.length;
      wrap.appendChild(h('details', { class: 'oef' },
        h('summary', null, o.naam, heeftBeeld ? h('span', { class: 'chip', text: 'beeld' }) : null),
        oefeningInhoud(o)));
    } else if (it.oef) wrap.appendChild(h('p', { class: 'meta', text: 'Oefening onbekend: ' + it.oef }));
    return wrap;
  }
  function sessieKaart(s) {
    const totaal = totaalMinuten(s);
    const kaart = h('section', { class: 'kaart' },
      h('div', { class: 'sessie-kop' },
        h('div', null,
          h('div', { class: 'datum', text: datumTekst(s.datum) }),
          h('div', { class: 'meta', text: [s.titel, s.tijd && s.tijd + ' uur', s.locatie].filter(Boolean).join(' · ') })),
        h('div', { class: 'rij' },
          h('span', { class: 'chip ' + s.type, text: TYPES[s.type] || s.type }),
          totaal ? h('span', { class: 'chip', text: totaal + ' min' }) : null)));
    if (s.tekst) kaart.appendChild(h('p', { class: 'tekstblok', text: s.tekst }));
    (s.blokken || []).forEach((b) => {
      kaart.appendChild(h('div', { class: 'blok' },
        h('div', { class: 'blok-kop' },
          h('h3', { text: b.naam }),
          b.zone ? zoneChip(b.zone) : null,
          Number(b.minuten) ? h('span', { class: 'minuten', text: b.minuten + ' min' }) : null),
        b.omschrijving && h('p', { class: 'meta', text: b.omschrijving }),
        (b.items || []).map(itemKaart)));
    });
    if (s.items && s.items.length) kaart.appendChild(h('div', { class: 'blok' }, s.items.map(itemKaart)));
    return kaart;
  }
  function weekWeergave(w, opties) {
    opties = opties || {};
    const gebruiktZone = (w.sessies || []).some((s) => (s.blokken || []).some((b) => b.zone));
    const wrap = h('div', null);
    if (!opties.voorbeeld) wrap.appendChild(h('a', { class: 'terug', href: '#/', text: '← Alle schema\'s' }));
    wrap.appendChild(h('div', { class: 'hero' },
      h('h1', { text: 'Training ' + (w.titel || '') }),
      h('div', { class: 'rij' },
        w.trainingsblok ? h('span', { class: 'chip', text: 'Blok ' + w.trainingsblok }) : null,
        w.intensiteit ? h('span', { class: 'chip', text: 'Intensiteit ' + w.intensiteit }) : null),
      w.doel && h('p', null, h('strong', { text: 'Doel: ' }), w.doel),
      w.bijzonderheden && h('p', null, h('strong', { text: 'Let op: ' }), w.bijzonderheden),
      opties.voorbeeld ? null : h('button', { class: 'knop', type: 'button', onclick: () => maakCopyLink(location.href) }, 'Deel deze week')));
    (w.sessies || []).forEach((s) => wrap.appendChild(sessieKaart(s)));
    if (gebruiktZone) {
      wrap.appendChild(h('section', { class: 'kaart' }, h('h2', { text: 'Hartslagzones' }),
        h('ul', { class: 'legenda' }, cache.oef.zones.map((z) => h('li', null,
          h('span', { class: 'chip zone z' + z.zone, text: 'Zone ' + z.zone }), h('span', { text: z.intensiteit }),
          h('span', { class: 'gevoel', text: z.naam + ': ' + z.gevoel }))))));
    }
    return wrap;
  }

  // ---------- pagina's ----------
  function huidigeWeek(weken) {
    const nu = new Date(); nu.setHours(12, 0, 0, 0);
    const gesorteerd = weken.slice().sort((a, b) => b.start.localeCompare(a.start));
    return gesorteerd.find((w) => { const s = new Date(w.start + 'T12:00:00'); const e = new Date(s); e.setDate(e.getDate() + 6); return nu >= s && nu <= e; }) ||
      gesorteerd.find((w) => new Date(w.start + 'T12:00:00') <= nu) || gesorteerd[0];
  }
  function weekRij(w) {
    return h('li', null, h('a', { href: '#/week/' + w.id },
      h('div', { class: 'titel', text: w.titel }),
      h('div', { class: 'sub', text: [jaarDatum(w.start), w.bijzonderheden].filter(Boolean).join(' · ') })));
  }
  async function paginaHome() {
    await laadBasis();
    const weken = cache.index.weken.slice().sort((a, b) => b.start.localeCompare(a.start));
    const nu = huidigeWeek(weken);
    const out = h('div', null,
      h('div', { class: 'hero' },
        h('h1', { text: 'Trainingsschema\'s' }),
        h('p', { text: 'Bekijk het schema van deze week, met per oefening uitleg, plaatjes en animaties.' }),
        nu ? h('a', { class: 'knop', href: '#/week/' + nu.id, text: 'Open ' + nu.titel }) : null),
      h('section', { class: 'kaart' }, h('h2', { text: 'Alle weken' }), h('ul', { class: 'weeklijst' }, weken.map(weekRij))),
      h('section', { class: 'kaart' }, h('h2', { text: 'Oefeningen' }),
        h('p', { class: 'meta', text: 'Zoek op thema of type en bekijk hoe een oefening moet.' }),
        h('a', { class: 'knop licht', href: '#/oefeningen', text: 'Naar de oefeningen' })));
    return out;
  }
  async function paginaWeek(id) {
    await laadBasis();
    let w;
    try { w = await laadWeek(id); } catch (e) { return h('p', { class: 'leeg', text: 'Dit schema is niet gevonden.' }); }
    document.title = w.titel + ' · Schaatsvereniging Zwolle';
    return weekWeergave(w);
  }
  async function paginaOefeningen(zoekparam) {
    await laadBasis();
    const alle = cache.oef.oefeningen;
    const themas = Array.from(new Set(alle.flatMap((o) => o.thema || []))).sort();
    const staat = { zoek: '', type: '', thema: '' };
    const lijst = h('div', null);
    const zoek = h('input', { type: 'search', placeholder: 'Zoek een oefening…', 'aria-label': 'Zoeken' });
    const typeChips = h('div', { class: 'chips' });
    const themaChips = h('div', { class: 'chips' });
    function chipSet(box, opties, sleutel) {
      box.replaceChildren(...opties.map(([w, l]) => h('button', { type: 'button', 'aria-pressed': String(staat[sleutel] === w), onclick: () => { staat[sleutel] = w; chipSet(box, opties, sleutel); toon(); } }, l)));
    }
    function toon() {
      const q = staat.zoek.toLowerCase();
      const res = alle.filter((o) =>
        (!staat.type || (o.types || []).includes(staat.type)) &&
        (!staat.thema || (o.thema || []).includes(staat.thema)) &&
        (!q || (o.naam + ' ' + (o.uitleg || '') + ' ' + (o.thema || []).join(' ')).toLowerCase().includes(q)));
      lijst.replaceChildren(...(res.length ? res.map((o) => h('details', { class: 'kaart oef', id: 'o-' + o.id },
        h('summary', null, o.naam, ...(o.types || []).map((t) => h('span', { class: 'chip ' + t, text: TYPES[t] || t })), (o.beelden || []).length ? h('span', { class: 'chip', text: 'beeld' }) : null),
        h('div', { class: 'meta', style: 'padding:0 12px', text: (o.thema || []).join(' · ') + (o.niveau ? ' · niveau ' + o.niveau : '') }),
        oefeningInhoud(o),
        h('p', { style: 'padding:0 12px 12px;margin:0' }, h('a', { href: '#/oefening-maken/' + o.id, text: 'Bewerk deze oefening' })))) : [h('p', { class: 'leeg', text: 'Geen oefeningen gevonden.' })]));
    }
    zoek.addEventListener('input', () => { staat.zoek = zoek.value; toon(); });
    chipSet(typeChips, [['', 'Alle'], ['droog', 'Droog'], ['ijs', 'IJs'], ['weekend', 'Weekend']], 'type');
    chipSet(themaChips, [['', 'Alle thema\'s']].concat(themas.map((t) => [t, t])), 'thema');
    toon();
    const out = h('div', null, h('div', { class: 'rij', style: 'justify-content:space-between;margin-bottom:8px' }, h('h1', { text: 'Oefeningen', style: 'margin:0' }), h('a', { class: 'knop klein', href: '#/oefening-maken', text: '+ Nieuwe oefening' })), h('div', { class: 'filters' }, zoek, typeChips, themaChips), lijst);
    if (zoekparam) {
      const d = lijst.querySelector('#o-' + CSS.escape(zoekparam));
      if (d) { d.open = true; setTimeout(() => d.scrollIntoView({ block: 'start' }), 50); }
    }
    return out;
  }

  // ---------- bouwer voor trainers ----------
  const DRAFT = 'schaats-bouwer-v1';
  function nieuweWeek() { return { id: '', titel: '', doel: '', trainingsblok: '', intensiteit: '', bijzonderheden: '', sessies: [] }; }
  function laadDraft() { try { return JSON.parse(localStorage.getItem(DRAFT)) || nieuweWeek(); } catch (e) { return nieuweWeek(); } }
  function bewaarDraft(w) { try { localStorage.setItem(DRAFT, JSON.stringify(w)); } catch (e) { /* ignore */ } }
  function schoon(w) {
    // verwijdert lege velden voor een nette JSON
    return JSON.parse(JSON.stringify(w, (k, v) => (v === '' || v === null || (Array.isArray(v) && v.length === 0 && k !== 'sessies' && k !== 'blokken' && k !== 'items') ? undefined : v)));
  }
  function veld(label, input) { return h('label', null, label, input); }
  function textInput(obj, key, opts) {
    opts = opts || {};
    const i = h(opts.area ? 'textarea' : 'input', { type: opts.area ? null : (opts.type || 'text'), value: obj[key] == null ? '' : obj[key], placeholder: opts.ph || '' });
    i.addEventListener('input', () => { obj[key] = opts.type === 'number' ? (i.value === '' ? '' : Number(i.value)) : i.value; opts.after && opts.after(); update(); });
    return i;
  }
  let bw = null, bwUi = null, update = () => {};

  async function paginaBouwer() {
    await laadBasis();
    bw = laadDraft();
    bwUi = h('div', null);
    const uit = h('pre', { class: 'json' });
    const ids = () => { const m = String(bw.id || '').match(/^(\d{4})-w(\d{1,2})$/); return m; };

    update = () => {
      bewaarDraft(bw);
      uit.textContent = JSON.stringify(schoon(bw), null, 2);
      const idEl = document.getElementById('bw-index');
      if (idEl) idEl.textContent = JSON.stringify({ id: bw.id, titel: bw.titel, start: (bw.sessies[0] && bw.sessies[0].datum) || '', bijzonderheden: bw.bijzonderheden || '' });
    };

    function oefSelect(item) {
      const s = h('select', null, h('option', { value: '', text: '— kies een oefening —' }),
        ...cache.oef.oefeningen.map((o) => h('option', { value: o.id, text: o.naam })));
      s.value = item.oef || '';
      s.addEventListener('change', () => { item.oef = s.value; update(); });
      return s;
    }
    function blokUi(sessie, blok, bi) {
      const items = h('div', null);
      function tekenItems() {
        items.replaceChildren(...(blok.items = blok.items || []).map((it, ii) =>
          h('div', { class: 'bouw-item' },
            h('div', { class: 'velden' }, oefSelect(it), textInput(it, 'detail', { ph: 'Details, bijv. 6x 30\'\' - rust 2\'' })),
            h('button', { type: 'button', class: 'knop klein gevaar', 'aria-label': 'Oefening verwijderen', onclick: () => { blok.items.splice(ii, 1); tekenItems(); update(); } }, '✕'))));
      }
      tekenItems();
      return h('div', { class: 'bouw-blok' },
        h('div', { class: 'formraster' },
          h('div', { class: 'breed' }, veld('Naam van het blok', textInput(blok, 'naam', { ph: 'Warming-up' }))),
          veld('Minuten', textInput(blok, 'minuten', { type: 'number' })),
          veld('Hartslagzone', (() => { const s = h('select', null, h('option', { value: '', text: '—' }), ...[1, 2, 3, 4, 5].map((z) => h('option', { value: z, text: 'Zone ' + z }))); s.value = blok.zone || ''; s.addEventListener('change', () => { blok.zone = s.value ? Number(s.value) : ''; update(); }); return s; })()),
          h('div', { class: 'breed' }, veld('Omschrijving (optioneel)', textInput(blok, 'omschrijving')))),
        items,
        h('div', { class: 'rij', style: 'margin-top:8px' },
          h('button', { type: 'button', class: 'knop klein licht', onclick: () => { (blok.items = blok.items || []).push({ oef: '', detail: '' }); tekenItems(); update(); } }, '+ Oefening'),
          h('button', { type: 'button', class: 'knop klein gevaar', onclick: () => { sessie.blokken.splice(bi, 1); teken(); update(); } }, 'Blok verwijderen')));
    }
    function sessieUi(s, si) {
      const typeSel = h('select', null, ...Object.keys(TYPES).map((t) => h('option', { value: t, text: TYPES[t] })));
      typeSel.value = s.type; typeSel.addEventListener('change', () => { s.type = typeSel.value; update(); });
      return h('section', { class: 'kaart bouw-sessie' },
        h('div', { class: 'formraster' },
          veld('Type', typeSel),
          veld('Datum', textInput(s, 'datum', { type: 'date' })),
          veld('Tijd', textInput(s, 'tijd', { type: 'time' })),
          h('div', { class: 'breed' }, veld('Titel', textInput(s, 'titel', { ph: 'Indoor droogtraining' }))),
          h('div', { class: 'breed' }, veld('Locatie', textInput(s, 'locatie', { ph: 'Sportpark HTC, Brinkhoekweg 200 Zwolle' }))),
          h('div', { class: 'breed' }, veld('Tekst (voor rustdag of weekend)', textInput(s, 'tekst', { area: true })))),
        (s.blokken = s.blokken || []).map((b, bi) => blokUi(s, b, bi)),
        h('div', { class: 'rij', style: 'margin-top:10px' },
          h('button', { type: 'button', class: 'knop klein licht', onclick: () => { s.blokken.push({ naam: '', minuten: '', zone: '', omschrijving: '', items: [] }); teken(); update(); } }, '+ Blok'),
          h('button', { type: 'button', class: 'knop klein gevaar', onclick: () => { bw.sessies.splice(si, 1); teken(); update(); } }, 'Sessie verwijderen')));
    }
    function teken() {
      const laad = h('select', null, h('option', { value: '', text: 'Begin met een bestaand schema…' }),
        ...cache.index.weken.map((w) => h('option', { value: w.id, text: w.titel })));
      laad.addEventListener('change', async () => {
        if (!laad.value) return;
        bw = JSON.parse(JSON.stringify(await laadWeek(laad.value)));
        teken(); update();
      });
      bwUi.replaceChildren(
        h('div', { class: 'kader', text: 'Je werk wordt automatisch in deze browser bewaard. Klaar? Download het weekbestand en stuur het naar de beheerder, of zet het zelf op de site (zie onderaan).' }),
        h('section', { class: 'kaart' },
          h('div', { class: 'rij', style: 'justify-content:space-between;margin-bottom:10px' }, h('h2', { text: 'Week' }), laad),
          h('div', { class: 'formraster' },
            veld('Code, bijv. 2026-w42 (dezelfde code vervangt een bestaand schema)', textInput(bw, 'id', { ph: '2026-w42' })),
            veld('Titel', textInput(bw, 'titel', { ph: 'Week 42' })),
            veld('Trainingsblok', textInput(bw, 'trainingsblok', { ph: 'VP2' })),
            veld('Intensiteit', textInput(bw, 'intensiteit', { ph: '70%' })),
            h('div', { class: 'breed' }, veld('Trainingsdoel', textInput(bw, 'doel', { area: true }))),
            h('div', { class: 'breed' }, veld('Bijzonderheden', textInput(bw, 'bijzonderheden', { area: true }))))),
        h('div', null, bw.sessies.map(sessieUi)),
        h('div', { class: 'rij' },
          h('button', { type: 'button', class: 'knop licht', onclick: () => { bw.sessies.push({ type: 'droog', titel: '', datum: '', tijd: '19:00', locatie: '', blokken: [] }); teken(); update(); } }, '+ Sessie toevoegen'),
          h('a', { class: 'knop licht', href: '#/voorbeeld', text: 'Voorbeeld bekijken' })),
        publiceerKaart(),
        h('section', { class: 'kaart', style: 'margin-top:16px' },
          h('h2', { text: 'Zelf opslaan' }),
          h('div', { class: 'rij' },
            h('button', { type: 'button', class: 'knop', onclick: downloadWeek }, 'Download weekbestand'),
            h('button', { type: 'button', class: 'knop licht', onclick: () => navigator.clipboard.writeText(uit.textContent).then(() => toast('JSON gekopieerd'), () => toast('Kopiëren mislukt')) }, 'Kopieer JSON'),
            h('button', { type: 'button', class: 'knop gevaar', onclick: () => { if (confirm('Alles wissen en opnieuw beginnen?')) { bw = nieuweWeek(); teken(); update(); } } }, 'Nieuw schema')),
          h('p', { class: 'meta' }, 'Publiceren: zet het bestand in ', h('code', { text: 'data/weken/' }), ' en voeg onderstaande regel toe aan de lijst in ', h('code', { text: 'data/index.json' }), ':'),
          h('pre', { class: 'json', id: 'bw-index' }),
          h('details', null, h('summary', { text: 'Toon de JSON' }), uit)));
      update();
    }
    function publiceerKaart() {
      const SLEUTEL = 'schaats-clubcode';
      let bewaard = '';
      try { bewaard = localStorage.getItem(SLEUTEL) || ''; } catch (e) { /* ignore */ }
      const code = h('input', { type: 'password', autocomplete: 'off', placeholder: 'Clubcode', value: bewaard });
      const status = h('p', { class: 'meta', role: 'status' });
      const knop = h('button', { type: 'button', class: 'knop' }, 'Publiceer schema');
      const ingesteld = Boolean(cache.config && cache.config.publiceren_url);
      knop.addEventListener('click', async () => {
        status.textContent = ''; status.style.color = '';
        knop.disabled = true; knop.textContent = 'Bezig met publiceren…';
        try {
          try { localStorage.setItem(SLEUTEL, code.value.trim()); } catch (e) { /* ignore */ }
          await window.publiceerSchema(bw, schoon(bw), cache.config, code.value.trim());
          delete cache.weken[bw.id]; cache.index = null;
          const link = location.origin + location.pathname.replace(/v2\/?$/, '') + '#/week/' + bw.id;
          status.replaceChildren('Gepubliceerd. Over ongeveer een minuut staat het live op ', h('a', { href: link, text: link }), '. Deel die link in WhatsApp. ',
            h('button', { type: 'button', class: 'knop klein licht', onclick: () => maakCopyLink(link) }, 'Deel link'));
        } catch (e) {
          status.textContent = e.message || String(e); status.style.color = '#c0392b';
        } finally { knop.disabled = false; knop.textContent = 'Publiceer schema'; }
      });
      return h('section', { class: 'kaart', style: 'margin-top:16px' },
        h('h2', { text: 'Publiceren' }),
        ingesteld ? h('p', { class: 'meta', text: 'Zet het schema met één klik online. Vul eenmalig de clubcode in, die krijg je van de beheerder.' })
          : h('div', { class: 'kader', text: 'Publiceren is nog niet ingesteld: vul publiceren_url in data/config.json in (zie README). Tot die tijd kun je het schema zelf opslaan (onderaan).' }),
        veld('Clubcode (eenmalig)', code), h('div', { class: 'rij', style: 'margin-top:10px' }, knop), status);
    }
    function downloadWeek() {
      if (!bw.id || !ids()) { toast('Vul eerst een code in, zoals 2026-w42'); return; }
      const blob = new Blob([JSON.stringify(schoon(bw), null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: bw.id + '.json' });
      document.body.appendChild(a); a.click(); a.remove();
    }
    teken();
    return h('div', null, h('h1', { text: 'Schema maken' }), bwUi);
  }
  async function paginaVoorbeeld() {
    await laadBasis();
    const w = laadDraft();
    return h('div', null, h('a', { class: 'terug', href: '#/bouwer', text: '← Terug naar de bouwer' }), weekWeergave(w, { voorbeeld: true }));
  }

  window.__app = { h, cache, laadBasis, toast, veld, TYPES, oefeningInhoud };

  // ---------- router ----------
  async function route() {
    let hash = location.hash.replace(/^#/, '') || '/';
    const q = hash.indexOf('?');
    if (q >= 0) {
      const params = new URLSearchParams(hash.slice(q + 1));
      hash = hash.slice(0, q);
      if (params.get('code')) {
        try { localStorage.setItem('schaats-clubcode', params.get('code')); } catch (e) { /* ignore */ }
        history.replaceState(null, '', location.pathname + '#' + hash); // code niet in de adresbalk laten staan
        toast('Clubcode opgeslagen');
      }
    }
    const delen = hash.split('/').filter(Boolean);
    const sleutel = delen[0] || 'home';
    document.querySelectorAll('.topbar nav a').forEach((a) => a.classList.toggle('actief', a.dataset.nav === (sleutel === 'week' ? 'home' : (sleutel === 'voorbeeld' || sleutel === 'oefening-maken') ? 'bouwer' : sleutel)));
    document.title = 'Trainingsschema\'s Schaatsvereniging Zwolle';
    let pagina;
    try {
      if (sleutel === 'week' && delen[1]) pagina = await paginaWeek(decodeURIComponent(delen[1]));
      else if (sleutel === 'oefeningen') pagina = await paginaOefeningen(delen[1] && decodeURIComponent(delen[1]));
      else if (sleutel === 'oefening-maken') pagina = await window.__editor.pagina(delen[1] && decodeURIComponent(delen[1]));
      else if (sleutel === 'bouwer') pagina = await paginaBouwer();
      else if (sleutel === 'voorbeeld') pagina = await paginaVoorbeeld();
      else pagina = await paginaHome();
    } catch (e) {
      console.error(e);
      pagina = h('div', { class: 'kaart' }, h('h2', { text: 'Er ging iets mis' }), h('p', { text: 'De gegevens konden niet worden geladen. Open de site via een webadres (niet door het bestand te dubbelklikken).' }), h('p', { class: 'meta', text: String(e.message || e) }));
    }
    app.replaceChildren(pagina);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  document.querySelector('#lightbox button').addEventListener('click', () => document.getElementById('lightbox').close());
  document.getElementById('lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') e.target.close(); });
  route();
})();
