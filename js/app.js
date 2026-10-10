/* Trainingsschema's Schaatsvereniging Zwolle: statische site zonder build en zonder database.
   Een schema is een training: een dag, een tijd, een plaats, een of meer groepen en blokken met oefeningen.
   Gegevens staan in data/ (oefeningen.json, index.json en per training een bestand in data/trainingen/). */
(function () {
  'use strict';

  const BASE = ''; // gegevens en foto's staan naast de pagina
  const app = document.getElementById('app');
  const cache = { index: null, oef: null, trainingen: {} };
  const TYPES = { droog: 'Droogtraining', ijs: 'IJstraining', weekend: 'Weekend', rust: 'Rustdag' };
  const GROEP_SLEUTEL = 'schaats-groep';

  // ---------- groepen ----------
  const groepen = () => (cache.config && cache.config.groepen) || [];
  const groepNaam = (id) => { const g = groepen().find((x) => x.id === id); return g ? g.naam : id; };
  function gekozenGroep() { try { return localStorage.getItem(GROEP_SLEUTEL) || ''; } catch (e) { return ''; } }
  function zetGroep(id) { try { if (id) localStorage.setItem(GROEP_SLEUTEL, id); else localStorage.removeItem(GROEP_SLEUTEL); } catch (e) { /* ignore */ } }
  // Een training hoort bij nul (= alle groepen), een of meer groepen.
  const groepenVan = (t) => (Array.isArray(t.groepen) ? t.groepen : (t.groep ? [t.groep] : []));
  const groepenTekst = (t) => groepenVan(t).map(groepNaam).join(', ');
  const passendBij = (t, groep) => !groep || groepenVan(t).length === 0 || groepenVan(t).includes(groep);

  // Filters op jaar en kamp: alleen voor dit tabblad onthouden
  const FILTER_SLEUTEL = 'schaats-filter';
  function filterStaat() { try { return JSON.parse(sessionStorage.getItem(FILTER_SLEUTEL)) || {}; } catch (e) { return {}; } }
  function zetFilter(k, v) { const s = filterStaat(); if (v) s[k] = v; else delete s[k]; try { sessionStorage.setItem(FILTER_SLEUTEL, JSON.stringify(s)); } catch (e) { /* ignore */ } }

  // ---------- data en tijd ----------
  const tweecijfers = (n) => String(n).padStart(2, '0');
  const naarIso = (d) => d.getFullYear() + '-' + tweecijfers(d.getMonth() + 1) + '-' + tweecijfers(d.getDate());
  const vandaagIso = () => naarIso(new Date());
  function plusDagen(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return naarIso(d); }
  function maandagVan(iso) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return naarIso(d); }
  function isoWeek(iso) {
    const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const w1 = new Date(d.getFullYear(), 0, 4);
    return { jaar: d.getFullYear(), week: 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7) };
  }
  function maandagVanWeek(jaar, week) { const d = new Date(jaar, 0, 4, 12); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + (week - 1) * 7); return naarIso(d); }
  function datumKort(iso) { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' }); }
  function dagKort(iso) { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function datumTekst(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function weekKop(maandag) { const iw = isoWeek(maandag); return 'Week ' + iw.week + ' · ' + datumKort(maandag) + ' tot ' + datumKort(plusDagen(maandag, 6)); }
  function slugVan(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30); }
  const naam = (t) => t.titel || TYPES[t.type] || 'Training';

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
  async function haal(pad) {
    const r = await fetch(pad, { cache: 'no-cache' });
    if (!r.ok) throw new Error(pad + ' (' + r.status + ')');
    return r.json();
  }
  async function laadBasis() {
    if (!cache.index) cache.index = await haal(BASE + 'data/index.json');
    if (!cache.index.trainingen) cache.index.trainingen = [];
    if (!cache.config) cache.config = await haal(BASE + 'data/config.json').catch(() => ({}));
    if (!cache.oef) {
      const o = await haal(BASE + 'data/oefeningen.json');
      cache.oef = o; cache.oefById = {};
      o.oefeningen.forEach((x) => { cache.oefById[x.id] = x; });
    }
  }
  async function laadTraining(id) {
    if (!cache.trainingen[id]) cache.trainingen[id] = await haal(BASE + 'data/trainingen/' + encodeURIComponent(id) + '.json');
    return cache.trainingen[id];
  }
  function maakCopyLink(url) {
    if (navigator.share) return navigator.share({ title: document.title, url }).catch(() => {});
    return navigator.clipboard.writeText(url).then(() => toast('Link gekopieerd'), () => toast(url));
  }
  function totaalMinuten(t) { return (t.blokken || []).reduce((n, b) => n + (Number(b.minuten) || 0), 0); }
  function chipsVoor(t, metLink) { // metLink: kampnaam als link (niet in lijsten, want die zijn zelf al een link)
    return [h('span', { class: 'chip ' + t.type, text: TYPES[t.type] || t.type }),
      t.kamp ? (metLink ? h('a', { class: 'chip', href: '#/kamp/' + slugVan(t.kamp), text: t.kamp }) : h('span', { class: 'chip', text: t.kamp })) : null,
      ...groepenVan(t).map((g) => h('span', { class: 'chip', text: groepNaam(g) }))];
  }

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
      const knop = h('button', { type: 'button', 'aria-label': 'Video afspelen: ' + (b.bijschrift || ''), style: 'background-image:url(https://i.ytimg.com/vi/' + id + '/hqdefault.jpg)', text: '▶ Afspelen' });
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

  // ---------- weergave van een training ----------
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
  function trainingKaart(t) {
    const totaal = totaalMinuten(t);
    const kaart = h('section', { class: 'kaart' },
      h('div', { class: 'sessie-kop' },
        h('div', null,
          h('div', { class: 'datum', text: datumTekst(t.datum) }),
          h('div', { class: 'meta', text: [t.tijd && t.tijd + ' uur', t.locatie].filter(Boolean).join(' · ') })),
        h('div', { class: 'rij' }, totaal ? h('span', { class: 'chip', text: totaal + ' min' }) : null)));
    if (t.tekst) kaart.appendChild(h('p', { class: 'tekstblok', text: t.tekst }));
    (t.blokken || []).forEach((b) => {
      kaart.appendChild(h('div', { class: 'blok' },
        h('div', { class: 'blok-kop' },
          h('h3', { text: b.naam }),
          b.zone ? zoneChip(b.zone) : null,
          Number(b.minuten) ? h('span', { class: 'minuten', text: b.minuten + ' min' }) : null),
        b.omschrijving && h('p', { class: 'meta', text: b.omschrijving }),
        (b.items || []).map(itemKaart)));
    });
    if (t.items && t.items.length) kaart.appendChild(h('div', { class: 'blok' }, t.items.map(itemKaart)));
    return kaart;
  }
  function trainingWeergave(t, opties) {
    opties = opties || {};
    const gebruiktZone = (t.blokken || []).some((b) => b.zone);
    const wrap = h('div', null);
    if (!opties.voorbeeld) wrap.appendChild(h('a', { class: 'terug', href: '#/', text: '← Alle trainingen' }));
    wrap.appendChild(h('div', { class: 'hero' },
      h('h1', { text: naam(t) }),
      h('div', { class: 'rij' }, chipsVoor(t, true),
        t.trainingsblok ? h('span', { class: 'chip', text: 'Blok ' + t.trainingsblok }) : null,
        t.intensiteit ? h('span', { class: 'chip', text: 'Intensiteit ' + t.intensiteit }) : null),
      t.doel && h('p', null, h('strong', { text: 'Doel: ' }), t.doel),
      t.bijzonderheden && h('p', null, h('strong', { text: 'Let op: ' }), t.bijzonderheden),
      opties.voorbeeld ? null : h('button', { class: 'knop', type: 'button', onclick: () => maakCopyLink(location.href) }, 'Deel deze training')));
    wrap.appendChild(trainingKaart(t));
    if (gebruiktZone) {
      wrap.appendChild(h('section', { class: 'kaart' }, h('h2', { text: 'Hartslagzones' }),
        h('ul', { class: 'legenda' }, cache.oef.zones.map((z) => h('li', null,
          h('span', { class: 'chip zone z' + z.zone, text: 'Zone ' + z.zone }), h('span', { text: z.intensiteit }),
          h('span', { class: 'gevoel', text: z.naam + ': ' + z.gevoel }))))));
    }
    return wrap;
  }

  // ---------- lijsten ----------
  function trainingRij(t) {
    return h('li', null, h('a', { href: '#/training/' + t.id },
      h('div', { class: 'titel' }, h('span', { class: 'dagkop', text: dagKort(t.datum) }), ' ', naam(t), ' ', ...chipsVoor(t)),
      h('div', { class: 'sub', text: [t.tijd && t.tijd + ' uur', t.locatie].filter(Boolean).join(' · ') || ' ' })));
  }
  function perWeek(lijst, oplopend) { // lijst per week, met een kopje per week
    const groepenPerWeek = [];
    lijst.forEach((t) => {
      const m = maandagVan(t.datum); let g = groepenPerWeek.find((x) => x.m === m);
      if (!g) { g = { m, items: [] }; groepenPerWeek.push(g); }
      g.items.push(t);
    });
    return groepenPerWeek.map((g) => h('div', null, h('h3', { class: 'weekkop', text: weekKop(g.m) }), h('ul', { class: 'weeklijst' }, g.items.map(trainingRij))));
  }
  const oplopendSorteren = (a, b) => (a.datum + (a.tijd || '')).localeCompare(b.datum + (b.tijd || ''));
  const aflopendSorteren = (a, b) => oplopendSorteren(b, a);

  // ---------- pagina's ----------
  async function paginaHome() {
    await laadBasis();
    const groep = gekozenGroep(); const vandaag = vandaagIso(); const fs = filterStaat();
    const passend = cache.index.trainingen.filter((t) => passendBij(t, groep));
    // bovenaan: de training van vandaag of de eerstvolgende (alleen de groep telt)
    const komendAlle = passend.filter((t) => t.datum >= vandaag).sort(oplopendSorteren);
    let toon = komendAlle.filter((t) => t.datum === vandaag);
    if (!toon.length) toon = komendAlle.slice(0, 1);
    if (!toon.length) toon = passend.filter((t) => t.datum < vandaag).sort(aflopendSorteren).slice(0, 1);
    // filters: jaar, en kamp of reeks (kampen volgen vanzelf uit de trainingen)
    const jaren = Array.from(new Set(passend.map((t) => t.datum.slice(0, 4)))).sort().reverse();
    const jaar = jaren.includes(fs.jaar) ? fs.jaar : '';
    const kampBron = passend.filter((t) => t.kamp && (jaar ? t.datum.startsWith(jaar) : t.datum >= vandaag)).sort(oplopendSorteren);
    const kampen = Array.from(new Set(kampBron.map((t) => t.kamp)));
    const kamp = kampen.includes(fs.kamp) ? fs.kamp : '';
    const gefilterd = passend.filter((t) => (!jaar || t.datum.startsWith(jaar)) && (!kamp || t.kamp === kamp));
    const komend = gefilterd.filter((t) => t.datum >= vandaag).sort(oplopendSorteren);
    const eerder = gefilterd.filter((t) => t.datum < vandaag).sort(aflopendSorteren);
    const chipRij = (opties, huidig, sleutel) => h('div', { class: 'chips', style: 'margin:2px 0 10px' }, opties.map(([id, n]) => h('button', { type: 'button', 'aria-pressed': String(huidig === id), onclick: () => { zetFilter(sleutel, id); route(); } }, n)));
    const filters = (jaren.length || kampen.length) ? h('section', { class: 'kaart' },
      jaren.length ? h('div', null, h('div', { class: 'meta', text: 'Jaar' }), chipRij([['', 'Alle jaren']].concat(jaren.map((j) => [j, j])), jaar, 'jaar')) : null,
      kampen.length ? h('div', null, h('div', { class: 'meta', text: 'Kamp of reeks' }), chipRij([['', 'Alle']].concat(kampen.map((k) => [k, k])), kamp, 'kamp')) : null) : null;
    const kiezen = groepen().length ? h('div', { class: 'chips', style: 'margin:8px 0 12px' },
      [['', 'Alle groepen']].concat(groepen().map((g) => [g.id, g.naam])).map(([id, n]) => h('button', { type: 'button', 'aria-pressed': String(groep === id), onclick: () => { zetGroep(id); route(); } }, n))) : null;
    return h('div', null,
      h('div', { class: 'hero' },
        h('h1', { text: 'Trainingen' }),
        h('p', { text: groepen().length ? 'Kies je groep en bekijk de training, met per oefening uitleg, plaatjes en animaties.' : 'Bekijk de training, met per oefening uitleg, plaatjes en animaties.' }),
        kiezen,
        h('div', { class: 'rij' }, toon.map((t) => h('a', { class: 'knop', href: '#/training/' + t.id, text: (t.datum === vandaag ? 'Vandaag: ' : t.datum > vandaag ? 'Eerstvolgende: ' : 'Laatste: ') + dagKort(t.datum) + ' ' + naam(t) })))),
      filters,
      h('section', { class: 'kaart' }, h('h2', { text: groep ? 'Komende trainingen voor ' + groepNaam(groep) : 'Komende trainingen' }),
        komend.length ? perWeek(komend, true) : h('p', { class: 'leeg', text: (jaar || kamp) ? 'Geen komende trainingen met deze filters.' : 'Er staan nog geen trainingen gepland.' })),
      eerder.length ? h('details', { class: 'kaart oef' }, h('summary', { text: 'Eerdere trainingen (' + eerder.length + ')' }), h('div', { style: 'padding:0 12px 12px' }, perWeek(eerder, false))) : null,
      h('section', { class: 'kaart' }, h('h2', { text: 'Oefeningen' }),
        h('p', { class: 'meta', text: 'Zoek op thema of type en bekijk hoe een oefening moet.' }),
        h('a', { class: 'knop licht', href: '#/oefeningen', text: 'Naar de oefeningen' })));
  }
  async function paginaTraining(id) {
    await laadBasis();
    let t;
    try { t = await laadTraining(id); } catch (e) { return h('p', { class: 'leeg', text: 'Deze training is niet gevonden.' }); }
    document.title = naam(t) + ' · ' + dagKort(t.datum) + ' · Schaatsvereniging Zwolle';
    const scherm = trainingWeergave(t);
    const index = cache.index.trainingen;
    const zelfdeDag = index.filter((x) => x.datum === t.datum && x.id !== t.id);
    if (zelfdeDag.length) scherm.insertBefore(h('section', { class: 'kaart' }, h('h2', { text: 'Andere trainingen op deze dag' }), h('ul', { class: 'weeklijst' }, zelfdeDag.map(trainingRij))), scherm.children[2] || null);
    const groep = gekozenGroep(); const lijst = index.filter((x) => passendBij(x, groep) || x.id === t.id).sort(oplopendSorteren);
    const i = lijst.findIndex((x) => x.id === t.id);
    if (i >= 0 && (i > 0 || i < lijst.length - 1)) scherm.appendChild(h('div', { class: 'rij', style: 'justify-content:space-between' },
      i > 0 ? h('a', { class: 'knop licht klein', href: '#/training/' + lijst[i - 1].id, text: '← ' + dagKort(lijst[i - 1].datum) }) : h('span'),
      i < lijst.length - 1 ? h('a', { class: 'knop licht klein', href: '#/training/' + lijst[i + 1].id, text: dagKort(lijst[i + 1].datum) + ' →' }) : h('span')));
    return scherm;
  }
  async function paginaWeek(id) { // oude weeklinks (2026-w42) en weekoverzicht
    await laadBasis();
    const m = String(id).match(/^(\d{4})-w(\d{1,2})$/);
    if (!m) return paginaTraining(id);
    const maandag = maandagVanWeek(Number(m[1]), Number(m[2])); const zondag = plusDagen(maandag, 6); const groep = gekozenGroep();
    const lijst = cache.index.trainingen.filter((t) => t.datum >= maandag && t.datum <= zondag && passendBij(t, groep)).sort(oplopendSorteren);
    document.title = 'Week ' + Number(m[2]) + ' · Schaatsvereniging Zwolle';
    return h('div', null, h('a', { class: 'terug', href: '#/', text: '← Alle trainingen' }),
      h('div', { class: 'hero' }, h('h1', { text: weekKop(maandag) }), groep ? h('p', { text: 'Trainingen voor ' + groepNaam(groep) + ' en voor alle groepen.' }) : null),
      h('section', { class: 'kaart' }, lijst.length ? h('ul', { class: 'weeklijst' }, lijst.map(trainingRij)) : h('p', { class: 'leeg', text: 'Er zijn deze week geen trainingen.' })),
      h('div', { class: 'rij', style: 'justify-content:space-between' },
        h('a', { class: 'knop licht klein', href: '#/week/' + weekId(plusDagen(maandag, -7)), text: '← Vorige week' }),
        h('a', { class: 'knop licht klein', href: '#/week/' + weekId(plusDagen(maandag, 7)), text: 'Volgende week →' })));
  }
  function weekId(iso) { const iw = isoWeek(iso); return iw.jaar + '-w' + tweecijfers(iw.week); }
  async function paginaKamp(slug) {
    await laadBasis();
    const lijst = cache.index.trainingen.filter((t) => t.kamp && slugVan(t.kamp) === slug).sort(oplopendSorteren);
    if (!lijst.length) return h('p', { class: 'leeg', text: 'Dit kamp is niet gevonden.' });
    const kampNaam = lijst[0].kamp; document.title = kampNaam + ' · Schaatsvereniging Zwolle';
    return h('div', null, h('a', { class: 'terug', href: '#/', text: '← Alle trainingen' }),
      h('div', { class: 'hero' }, h('h1', { text: kampNaam }), h('p', { text: datumKort(lijst[0].datum) + ' tot ' + datumKort(lijst[lijst.length - 1].datum) + ' · ' + lijst.length + ' trainingen' })),
      h('section', { class: 'kaart' }, h('ul', { class: 'weeklijst' }, lijst.map(trainingRij))));
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
  const DRAFT = 'schaats-bouwer-v2';
  const ID_RE = /^\d{4}-\d{2}-\d{2}(-[a-z0-9]+){0,5}$/;
  function nieuweTraining() { return { id: '', type: 'droog', titel: '', datum: '', tijd: '19:00', locatie: '', groepen: [], kamp: '', doel: '', trainingsblok: '', intensiteit: '', bijzonderheden: '', tekst: '', blokken: [] }; }
  function opgeschoond(t) { const x = Object.assign(nieuweTraining(), t); if (t.groep) x.groepen = Array.from(new Set([].concat(x.groepen || [], t.groep))); delete x.groep; if (!Array.isArray(x.groepen)) x.groepen = []; if (!Array.isArray(x.blokken)) x.blokken = []; return x; }
  function laadDraft() { try { return opgeschoond(JSON.parse(localStorage.getItem(DRAFT)) || {}); } catch (e) { return nieuweTraining(); } }
  function bewaarDraft(t) { try { localStorage.setItem(DRAFT, JSON.stringify(t)); } catch (e) { /* ignore */ } }
  function schoon(t) { // verwijdert lege velden voor een nette JSON
    return JSON.parse(JSON.stringify(t, (k, v) => (v === '' || v === null || (Array.isArray(v) && v.length === 0 && k !== 'blokken' && k !== 'items') ? undefined : v)));
  }
  function veld(label, input) { return h('label', null, label, input); }
  function groepenKeuze(obj) { // een, meerdere of alle groepen
    obj.groepen = obj.groepen || [];
    const box = h('div', { class: 'chips' });
    function teken() {
      box.replaceChildren(...[['', 'Alle groepen']].concat(groepen().map((g) => [g.id, g.naam])).map(([id, n]) => {
        const k = h('input', { type: 'checkbox', style: 'width:auto' });
        k.checked = id === '' ? obj.groepen.length === 0 : obj.groepen.includes(id);
        k.addEventListener('change', () => {
          if (id === '') obj.groepen = []; else obj.groepen = k.checked ? obj.groepen.concat(id) : obj.groepen.filter((x) => x !== id);
          teken(); update();
        });
        return h('label', { style: 'display:flex;align-items:center;gap:6px;flex-direction:row;font-weight:500;color:var(--tekst);background:var(--kaart);border:1px solid var(--rand);padding:4px 10px;border-radius:999px' }, k, n);
      }));
    }
    teken();
    return h('div', null, h('label', null, 'Voor welke groepen? (een, meerdere of alle)'), box);
  }
  function kampKeuze(obj) { // kies een bestaand kamp of reeks, of maak een nieuwe aan
    const bestaand = Array.from(new Map(cache.index.trainingen.filter((t) => t.kamp).map((t) => [slugVan(t.kamp), t.kamp])).values()).sort((x, y) => x.localeCompare(y, 'nl'));
    const huidig = (obj.kamp || '').trim();
    const gelijkAanBestaand = (tekst) => bestaand.find((n) => slugVan(n) === slugVan(tekst));
    const gevonden = huidig ? gelijkAanBestaand(huidig) : '';
    const sel = h('select', null, h('option', { value: '', text: '— geen kamp of reeks —' }),
      ...bestaand.map((n) => h('option', { value: n, text: n })), h('option', { value: '__nieuw', text: 'Nieuw kamp of reeks…' }));
    const inv = h('input', { type: 'text', placeholder: 'Naam van het kamp of de reeks, bijvoorbeeld Trainingskamp Inzell', value: huidig && !gevonden ? huidig : '', style: 'margin-top:6px' });
    const toonInvoer = () => { inv.style.display = sel.value === '__nieuw' ? '' : 'none'; };
    sel.value = !huidig ? '' : (gevonden || '__nieuw');
    sel.addEventListener('change', () => {
      if (sel.value === '__nieuw') { obj.kamp = inv.value.trim(); toonInvoer(); inv.focus(); } else { obj.kamp = sel.value; toonInvoer(); }
      update();
    });
    inv.addEventListener('input', () => { obj.kamp = inv.value.trim().replace(/\s+/g, ' '); update(); });
    inv.addEventListener('change', () => { // bestaat deze naam al? Dan die kiezen, tegen tikfouten en dubbele kampen
      const gelijk = inv.value.trim() ? gelijkAanBestaand(inv.value) : null;
      if (gelijk) { obj.kamp = gelijk; sel.value = gelijk; inv.value = ''; toonInvoer(); toast('Dit kamp bestaat al: "' + gelijk + '" is gekozen'); update(); }
    });
    toonInvoer();
    return h('div', null, h('label', null, 'Kamp of reeks (alleen als de training bij een kamp hoort)', sel), inv);
  }
  function keuze(obj, key, opties) {
    const s = h('select', null, ...opties.map(([w, l]) => h('option', { value: w, text: l })));
    s.value = obj[key] || ''; s.addEventListener('change', () => { obj[key] = s.value; update(); });
    return s;
  }
  function textInput(obj, key, opts) {
    opts = opts || {};
    const i = h(opts.area ? 'textarea' : 'input', { type: opts.area ? null : (opts.type || 'text'), value: obj[key] == null ? '' : obj[key], placeholder: opts.ph || '' });
    i.addEventListener('input', () => { obj[key] = opts.type === 'number' ? (i.value === '' ? '' : Number(i.value)) : i.value; opts.after && opts.after(); update(); });
    return i;
  }
  let bw = null, bwUi = null, update = () => {};
  const indexLabel = (t) => dagKort(t.datum) + ' · ' + naam(t) + (groepenVan(t).length ? ' · ' + groepenTekst(t) : '');

  async function paginaBouwer() {
    await laadBasis();
    bw = laadDraft();
    bwUi = h('div', null);
    const uit = h('pre', { class: 'json' });
    let voorstelEl = null;
    function voorstelCode() { // datum, groep(en), kamp en soort
      if (!bw.datum) return '';
      const delen = [bw.datum];
      if (bw.groepen && bw.groepen.length) delen.push(bw.groepen.length <= 2 ? bw.groepen.join('-') : 'groepen');
      if (bw.kamp) delen.push(slugVan(bw.kamp).slice(0, 20));
      delen.push(bw.type);
      return delen.join('-').replace(/-+/g, '-').slice(0, 60);
    }
    function zetVoorstel() {
      if (!voorstelEl) return;
      const v = voorstelCode();
      voorstelEl.replaceChildren();
      if (v && v !== bw.id) voorstelEl.append('Voorstel: ', h('code', { text: v }), ' ', h('button', { type: 'button', class: 'knop klein licht', onclick: () => { bw.id = v; teken(); update(); } }, 'Gebruik'));
    }
    update = () => {
      bewaarDraft(bw);
      uit.textContent = JSON.stringify(schoon(bw), null, 2);
      const idEl = document.getElementById('bw-index');
      if (idEl) idEl.textContent = JSON.stringify(schoon({ id: bw.id, datum: bw.datum, tijd: bw.tijd, type: bw.type, titel: bw.titel, groepen: bw.groepen, kamp: bw.kamp, locatie: bw.locatie }));
      zetVoorstel();
    };

    function oefSelect(item) {
      const s = h('select', null, h('option', { value: '', text: '— kies een oefening —' }),
        ...cache.oef.oefeningen.map((o) => h('option', { value: o.id, text: o.naam })));
      s.value = item.oef || '';
      s.addEventListener('change', () => { item.oef = s.value; update(); });
      return s;
    }
    function blokUi(blok, bi) {
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
          h('button', { type: 'button', class: 'knop klein gevaar', onclick: () => { bw.blokken.splice(bi, 1); teken(); update(); } }, 'Blok verwijderen')));
    }
    function teken() {
      const laad = h('select', null, h('option', { value: '', text: 'Begin met een bestaande training…' }),
        ...cache.index.trainingen.slice().sort(aflopendSorteren).map((t) => h('option', { value: t.id, text: indexLabel(t) })));
      laad.addEventListener('change', async () => {
        if (!laad.value) return;
        bw = opgeschoond(JSON.parse(JSON.stringify(await laadTraining(laad.value))));
        teken(); update();
      });
      bwUi.replaceChildren(
        h('div', { class: 'kader', text: 'Een schema is een training: een dag, een tijd en een plaats, voor een of meer groepen. Je werk wordt automatisch in deze browser bewaard.' }),
        h('section', { class: 'kaart' },
          h('div', { class: 'rij', style: 'justify-content:space-between;margin-bottom:10px' }, h('h2', { text: 'Training' }), laad),
          h('div', { class: 'formraster' },
            veld('Soort', keuze(bw, 'type', Object.keys(TYPES).map((t) => [t, TYPES[t]]))),
            veld('Datum', textInput(bw, 'datum', { type: 'date' })),
            veld('Tijd', textInput(bw, 'tijd', { type: 'time' })),
            h('div', { class: 'breed' }, veld('Titel', textInput(bw, 'titel', { ph: 'Bijvoorbeeld: Techniek in de bocht' }))),
            h('div', { class: 'breed' }, veld('Locatie', textInput(bw, 'locatie', { ph: 'Sportpark HTC, Brinkhoekweg 200 Zwolle' }))),
            h('div', { class: 'breed' }, groepenKeuze(bw)),
            h('div', { class: 'breed' }, kampKeuze(bw)),
            h('div', { class: 'breed' }, veld('Code, bijv. 2026-10-13-junioren-ijs (dezelfde code vervangt een bestaande training)', textInput(bw, 'id', { ph: '2026-10-13-ijs' })), (voorstelEl = h('p', { class: 'meta', style: 'margin:4px 0 0' }))),
            h('div', { class: 'breed' }, veld('Trainingsdoel', textInput(bw, 'doel', { area: true }))),
            veld('Trainingsblok', textInput(bw, 'trainingsblok', { ph: 'VP2' })),
            veld('Intensiteit', textInput(bw, 'intensiteit', { ph: '70%' })),
            h('div', { class: 'breed' }, veld('Bijzonderheden', textInput(bw, 'bijzonderheden', { area: true }))),
            h('div', { class: 'breed' }, veld('Tekst (voor een rustdag of weekend)', textInput(bw, 'tekst', { area: true }))))),
        h('div', null, bw.blokken.map(blokUi)),
        h('div', { class: 'rij' },
          h('button', { type: 'button', class: 'knop licht', onclick: () => { bw.blokken.push({ naam: '', minuten: '', zone: '', omschrijving: '', items: [] }); teken(); update(); } }, '+ Blok toevoegen'),
          h('a', { class: 'knop licht', href: '#/voorbeeld', text: 'Voorbeeld bekijken' }),
          h('button', { type: 'button', class: 'knop licht', title: 'Zelfde training voor een volgende dag, bijvoorbeeld bij een kamp', onclick: () => { bw.id = ''; if (bw.datum) bw.datum = plusDagen(bw.datum, 1); teken(); update(); toast('Nieuwe training klaargezet voor de volgende dag'); } }, 'Nieuwe training op basis van deze')),
        publiceerKaart(),
        verwijderKaart(),
        h('section', { class: 'kaart', style: 'margin-top:16px' },
          h('h2', { text: 'Zelf opslaan' }),
          h('div', { class: 'rij' },
            h('button', { type: 'button', class: 'knop', onclick: downloadTraining }, 'Download bestand'),
            h('button', { type: 'button', class: 'knop licht', onclick: () => navigator.clipboard.writeText(uit.textContent).then(() => toast('JSON gekopieerd'), () => toast('Kopiëren mislukt')) }, 'Kopieer JSON'),
            h('button', { type: 'button', class: 'knop gevaar', onclick: () => { if (confirm('Alles wissen en opnieuw beginnen?')) { bw = nieuweTraining(); teken(); update(); } } }, 'Nieuwe, lege training')),
          h('p', { class: 'meta' }, 'Publiceren: zet het bestand in ', h('code', { text: 'data/trainingen/' }), ' en voeg onderstaande regel toe aan de lijst ', h('code', { text: 'trainingen' }), ' in ', h('code', { text: 'data/index.json' }), ':'),
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
      const knop = h('button', { type: 'button', class: 'knop' }, 'Publiceer training');
      const ingesteld = Boolean(cache.config && cache.config.publiceren_url);
      knop.addEventListener('click', async () => {
        status.textContent = ''; status.style.color = '';
        knop.disabled = true; knop.textContent = 'Bezig met publiceren…';
        try {
          try { localStorage.setItem(SLEUTEL, code.value.trim()); } catch (e) { /* ignore */ }
          await window.publiceerTraining(bw, schoon(bw), cache.config, code.value.trim());
          // overzicht lokaal bijwerken: de live site is pas over een minuut bijgewerkt
          cache.index.trainingen = cache.index.trainingen.filter((x) => x.id !== bw.id).concat(schoon({ id: bw.id, datum: bw.datum, tijd: bw.tijd, type: bw.type, titel: bw.titel, groepen: bw.groepen, kamp: bw.kamp, locatie: bw.locatie }));
          cache.trainingen[bw.id] = schoon(bw);
          const link = location.origin + location.pathname.replace(/v2\/?$/, '') + '#/training/' + bw.id;
          status.replaceChildren('Gepubliceerd. Over ongeveer een minuut staat het live op ', h('a', { href: link, text: link }), '. Deel die link in WhatsApp. ',
            h('button', { type: 'button', class: 'knop klein licht', onclick: () => maakCopyLink(link) }, 'Deel link'));
        } catch (e) {
          status.textContent = e.message || String(e); status.style.color = '#c0392b';
        } finally { knop.disabled = false; knop.textContent = 'Publiceer training'; }
      });
      return h('section', { class: 'kaart', style: 'margin-top:16px' },
        h('h2', { text: 'Publiceren' }),
        ingesteld ? h('p', { class: 'meta', text: 'Zet de training met één klik online. Vul eenmalig de clubcode in, die krijg je van de beheerder.' })
          : h('div', { class: 'kader', text: 'Publiceren is nog niet ingesteld: vul publiceren_url in data/config.json in (zie README). Tot die tijd kun je de training zelf opslaan (onderaan).' }),
        veld('Clubcode (eenmalig)', code), h('div', { class: 'rij', style: 'margin-top:10px' }, knop), status);
    }
    function verwijderKaart() {
      const kies = h('select', null, h('option', { value: '', text: 'Kies de training die weg moet…' }),
        ...cache.index.trainingen.slice().sort(aflopendSorteren).map((t) => h('option', { value: t.id, text: indexLabel(t) })));
      const code = h('input', { type: 'password', autocomplete: 'off', placeholder: 'Clubcode' }); // bewust leeg: je bevestigt met de code
      const status = h('p', { class: 'meta', role: 'status' });
      const knop = h('button', { type: 'button', class: 'knop gevaar' }, 'Verwijder training');
      knop.addEventListener('click', async () => {
        status.textContent = ''; status.style.color = '';
        const t = cache.index.trainingen.find((x) => x.id === kies.value);
        if (!t) { status.textContent = 'Kies eerst de training die je wilt verwijderen.'; status.style.color = '#c0392b'; return; }
        if (!code.value.trim()) { status.textContent = 'Vul de clubcode in om te bevestigen.'; status.style.color = '#c0392b'; return; }
        if (!confirm('Weet je zeker dat je "' + indexLabel(t) + '" wilt verwijderen? De training verdwijnt van de site. Alleen de beheerder kan hem nog terughalen.')) return;
        knop.disabled = true; knop.textContent = 'Bezig met verwijderen…';
        try {
          await window.verwijderTraining(t.id, cache.config, code.value.trim());
          cache.index.trainingen = cache.index.trainingen.filter((x) => x.id !== t.id); delete cache.trainingen[t.id];
          kies.querySelector('option[value="' + t.id + '"]').remove(); kies.value = ''; code.value = '';
          status.textContent = '"' + indexLabel(t) + '" is verwijderd. Over ongeveer een minuut is het ook van de site verdwenen.';
        } catch (e) { status.textContent = e.message || String(e); status.style.color = '#c0392b'; }
        finally { knop.disabled = false; knop.textContent = 'Verwijder training'; }
      });
      return h('section', { class: 'kaart', style: 'margin-top:16px' }, h('h2', { text: 'Training verwijderen' }),
        h('p', { class: 'meta', text: 'Haal een training van de site. Bevestig met de clubcode.' }),
        veld('Training', kies), h('div', { style: 'height:8px' }), veld('Clubcode om te bevestigen', code), h('div', { class: 'rij', style: 'margin-top:10px' }, knop), status);
    }
    function downloadTraining() {
      if (!ID_RE.test(bw.id || '')) { toast('Vul eerst een code in, zoals 2026-10-13-ijs'); return; }
      const blob = new Blob([JSON.stringify(schoon(bw), null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: bw.id + '.json' });
      document.body.appendChild(a); a.click(); a.remove();
    }
    teken();
    return h('div', null, h('h1', { text: 'Training maken' }), bwUi);
  }
  async function paginaVoorbeeld() {
    await laadBasis();
    return h('div', null, h('a', { class: 'terug', href: '#/bouwer', text: '← Terug naar de bouwer' }), trainingWeergave(laadDraft(), { voorbeeld: true }));
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
    const nav = ['week', 'training', 'kamp', 'groep'].includes(sleutel) ? 'home' : (sleutel === 'voorbeeld' || sleutel === 'oefening-maken') ? 'bouwer' : sleutel;
    document.querySelectorAll('.topbar nav a').forEach((a) => a.classList.toggle('actief', a.dataset.nav === nav));
    document.title = 'Trainingsschema\'s Schaatsvereniging Zwolle';
    let pagina;
    const arg = delen[1] && decodeURIComponent(delen[1]);
    try {
      if (sleutel === 'groep') { zetGroep(arg && arg !== 'iedereen' ? arg : ''); history.replaceState(null, '', location.pathname + '#/'); pagina = await paginaHome(); }
      else if (sleutel === 'training' && arg) pagina = await paginaTraining(arg);
      else if (sleutel === 'week' && arg) pagina = await paginaWeek(arg);
      else if (sleutel === 'kamp' && arg) pagina = await paginaKamp(arg);
      else if (sleutel === 'oefeningen') pagina = await paginaOefeningen(arg);
      else if (sleutel === 'oefening-maken') pagina = await window.__editor.pagina(arg);
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
