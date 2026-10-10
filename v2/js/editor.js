/* Oefening maken: een oefening beschrijven, er een eigen animatie bij tekenen (stap voor stap) en publiceren.
   Optioneel met AI-hulp: een voorstel laten maken of de prompt kopiëren naar je eigen AI-assistent. */
(function () {
  'use strict';

  const SLEUTEL = 'schaats-clubcode';
  const KLEUREN = ['#e0802a', '#0b6fb8', '#2f7d4f', '#9b3fb5', '#d23c3c', '#1d9e9e'];
  const THEMAS = ['techniek', 'bocht', 'conditie', 'snelheid', 'kracht', 'stabiliteit', 'coordinatie', 'warming-up', 'cooling-down', 'herstel', 'start', 'teamwork'];
  const PROMPT = `Je helpt schaatstrainers om een oefening uit te werken voor een website. Antwoord uitsluitend met één JSON-object, zonder uitleg eromheen en zonder codeblok.
Velden: {"naam": korte naam, "thema": [1 tot 3 woorden uit: ${THEMAS.join(', ')}], "types": ["droog" en/of "ijs" en/of "weekend"], "niveau": "alle" of "gevorderd", "uitleg": 2 tot 4 zinnen in eenvoudig Nederlands, "coachpunten": [2 tot 4 korte aandachtspunten], "scene": optioneel animatie van rijders op de ijsbaan}.
Een scene bestaat uit: "rijders": [{"naam": "1", "kleur": "#e0802a"}, ...] (maximaal 6, kleur als #rrggbb) en "stappen": een lijst keyframes {"duur": seconden (0.5 tot 4), "tekst": korte uitleg bij die stap, "posities": [{"s": 0 tot 1, "in": -12 tot 12}, ... één per rijder in dezelfde volgorde]}.
De baan is een ovaal en er wordt tegen de klok in gereden. "s" is de afstand langs de baan als fractie van een hele ronde: 0 tot 0.24 is het onderste rechte stuk (van links naar rechts), 0.24 tot 0.5 de bocht rechts, 0.5 tot 0.74 het bovenste rechte stuk, 0.74 tot 1 de bocht links. "in" is de zijwaartse plaats: 0 is midden op de baan, positief naar de binnenkant, negatief naar de buitenkant.
Een rijder die vooraan rijdt heeft een hogere "s" dan een rijder erachter. Laat rijders steeds vooruit rijden (s neemt toe, over 1 heen telt als doorrijden naar 0). Gebruik 3 tot 6 stappen. Laat de laatste stap aansluiten op de eerste, zodat de animatie vloeiend herhaalt. Laat "scene" weg als de oefening geen beweging op de baan is (bijvoorbeeld rompstabiliteit).`;

  const kopie = (o) => JSON.parse(JSON.stringify(o));
  const afronden = (n, d) => Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
  const tussen = (v, a, b, std) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : std; };
  function slug(naam) {
    return String(naam || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }

  // ---------- voorbeelden van scenes ----------
  function sceneLeeg() {
    return { rijders: [{ naam: '1', kleur: KLEUREN[0] }], stappen: [{ duur: 2, tekst: '', posities: [{ s: 0.1, in: 0 }] }, { duur: 2, tekst: '', posities: [{ s: 0.35, in: 0 }] }], lus: true };
  }
  function sceneKopOverKop() {
    const g = 0.04; const rijders = ['1', '2', '3', '4'].map((n, i) => ({ naam: n, kleur: i === 0 ? KLEUREN[0] : KLEUREN[1] }));
    let volgorde = [0, 1, 2, 3]; const stappen = [];
    for (let j = 0; j < 4; j++) {
      const b = 0.25 * j; const pos = [0, 0, 0, 0];
      volgorde.forEach((r, k) => { pos[r] = { s: afronden((b - k * g + 1) % 1, 3), in: 0 }; });
      stappen.push({ duur: 1.2, tekst: 'Groep rijdt door', posities: pos.map((p) => Object.assign({}, p)) });
      const mid = [0, 0, 0, 0]; const b2 = b + 0.125;
      volgorde.forEach((r, k) => { mid[r] = k === 3 ? { s: afronden((b2 - g * 1.5 + 1) % 1, 3), in: 10 } : { s: afronden((b2 - k * g - g * 0.5 + 1) % 1, 3), in: 0 }; });
      stappen.push({ duur: 1.2, tekst: 'Achterste komt langs de binnenkant', posities: mid });
      volgorde = [volgorde[3], volgorde[0], volgorde[1], volgorde[2]];
    }
    return { rijders, stappen, lus: true };
  }
  function sceneSteigerung() {
    const s = [0, 0.05, 0.12, 0.22, 0.35, 0.52, 0.72, 1];
    const tek = ['Rustig opbouwen', 'Rustig opbouwen', 'Iets sneller', 'Doorversnellen in de bocht', 'Doorversnellen in de bocht', 'Aanzetten', 'Aanzetten', 'Aanzetten'];
    return { rijders: [{ naam: '1', kleur: KLEUREN[0] }], stappen: s.map((x, i) => ({ duur: 0.8, tekst: tek[i], posities: [{ s: x % 1, in: 0 }] })), lus: true };
  }

  function opschonenScene(sc) {
    if (!sc || !Array.isArray(sc.rijders) || !Array.isArray(sc.stappen) || !sc.rijders.length || !sc.stappen.length) return null;
    const rijders = sc.rijders.slice(0, 6).map((r, i) => ({ naam: String((r && r.naam) || i + 1).slice(0, 20), kleur: /^#[0-9a-fA-F]{6}$/.test((r && r.kleur) || '') ? r.kleur : KLEUREN[i % 6] }));
    const stappen = sc.stappen.slice(0, 30).map((st) => {
      const pos = Array.isArray(st && st.posities) ? st.posities : [];
      return { duur: tussen(st && st.duur, 0.2, 10, 1.5), tekst: String((st && st.tekst) || '').slice(0, 120), posities: rijders.map((_, i) => ({ s: tussen(pos[i] && pos[i].s, 0, 1, 0), in: tussen(pos[i] && pos[i]['in'], -20, 20, 0) })) };
    });
    return { rijders, stappen, lus: sc.lus !== false };
  }

  async function pagina(editId) {
    const A = window.__app; await A.laadBasis();
    const { h, cache, toast, veld, TYPES } = A; const M = window.__baan;
    const bestaand = editId ? cache.oefById[editId] : null;
    if (editId && !bestaand) return h('p', { class: 'leeg', text: 'Deze oefening is niet gevonden.' });

    // ---- toestand ----
    const ed = { id: bestaand ? bestaand.id : '', naam: '', thema: '', types: { droog: true, ijs: false, weekend: false }, niveau: 'alle', uitleg: '', coach: '', overige: [], sceneBijschrift: '' };
    let sc = sceneLeeg(); let metScene = false; let stap = 0;
    if (bestaand) {
      ed.naam = bestaand.naam; ed.thema = (bestaand.thema || []).join(', '); ed.niveau = bestaand.niveau || 'alle'; ed.uitleg = bestaand.uitleg || ''; ed.coach = (bestaand.coachpunten || []).join('\n');
      ed.types = { droog: false, ijs: false, weekend: false }; (bestaand.types || []).forEach((t) => { ed.types[t] = true; });
      let gevonden = false;
      (bestaand.beelden || []).forEach((b) => {
        if (!gevonden && b.type === 'animatie' && b.anim === 'scene' && b.scene) { sc = kopie(b.scene); metScene = true; gevonden = true; ed.sceneBijschrift = b.bijschrift || ''; } else ed.overige.push(kopie(b));
      });
    }
    const velden = {};
    const dun = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms || 250); }; };

    function bouwOefening() {
      const id = ed.id || slug(ed.naam);
      const beelden = ed.overige.map(kopie);
      if (metScene) beelden.unshift({ type: 'animatie', anim: 'scene', scene: kopie(sc), bijschrift: ed.sceneBijschrift || undefined });
      return {
        id, naam: ed.naam.trim(), thema: ed.thema.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean), types: Object.keys(ed.types).filter((k) => ed.types[k]), niveau: ed.niveau,
        uitleg: ed.uitleg.trim(), coachpunten: ed.coach.split('\n').map((x) => x.trim()).filter(Boolean), beelden
      };
    }

    // ---- onderdelen: oefening ----
    function tekstVeld(sleutel, opties) {
      opties = opties || {};
      const i = h(opties.area ? 'textarea' : 'input', { type: opties.area ? null : 'text', placeholder: opties.ph || '', list: opties.list });
      i.addEventListener('input', () => { ed[sleutel] = i.value; tekenVoorbeeld(); });
      velden[sleutel] = i; return i;
    }
    const typeBoxen = h('div', { class: 'chips' }, ['droog', 'ijs', 'weekend'].map((t) => {
      const k = h('input', { type: 'checkbox', style: 'width:auto' }); k.checked = !!ed.types[t];
      k.addEventListener('change', () => { ed.types[t] = k.checked; tekenVoorbeeld(); }); velden['type-' + t] = k;
      return h('label', { style: 'display:flex;align-items:center;gap:6px;flex-direction:row;font-weight:500' }, k, TYPES[t]);
    }));
    const niveauSel = h('select', null, h('option', { value: 'alle', text: 'Alle niveaus' }), h('option', { value: 'gevorderd', text: 'Gevorderd' }));
    niveauSel.value = ed.niveau; niveauSel.addEventListener('change', () => { ed.niveau = niveauSel.value; }); velden.niveau = niveauSel;
    const themaLijst = h('datalist', { id: 'themalijst' }, THEMAS.map((t) => h('option', { value: t })));
    const kaartOefening = h('section', { class: 'kaart' }, h('h2', { text: 'De oefening' }),
      h('div', { class: 'formraster' },
        h('div', { class: 'breed' }, veld('Naam', tekstVeld('naam', { ph: 'Bijvoorbeeld: Kop over kop' }))),
        h('div', { class: 'breed' }, veld('Thema\'s (gescheiden door komma\'s)', tekstVeld('thema', { ph: 'techniek, bocht', list: 'themalijst' })), themaLijst),
        h('div', null, veld('Niveau', niveauSel)),
        h('div', null, h('label', null, 'Waar'), typeBoxen),
        h('div', { class: 'breed' }, veld('Uitleg', tekstVeld('uitleg', { area: true, ph: 'Wat doe je en waarom?' }))),
        h('div', { class: 'breed' }, veld('Aandachtspunten (een per regel)', tekstVeld('coach', { area: true, ph: 'Diep zitten\nRustig opbouwen' })))));
    velden.naam.value = ed.naam; velden.thema.value = ed.thema; velden.uitleg.value = ed.uitleg; velden.coach.value = ed.coach;

    // ---- onderdelen: animatie ----
    const rijdersBox = h('div', null); const stappenBox = h('div', null); const baanBox = h('div', null); const animVoorbeeld = h('div', null);
    const stapVelden = h('div', { class: 'formraster' });
    const tekenAnimVoorbeeld = dun(() => {
      animVoorbeeld.replaceChildren(window.maakAnimatie('scene', { scene: { rijders: sc.rijders, stappen: sc.stappen, lus: true }, bijschrift: ed.naam || 'Voorbeeld' }));
    }, 200);
    function wijzig() { tekenAnimVoorbeeld(); tekenVoorbeeld(); }

    function tekenRijders() {
      rijdersBox.replaceChildren(
        ...sc.rijders.map((r, i) => {
          const kleur = h('input', { type: 'color', value: r.kleur, 'aria-label': 'Kleur rijder ' + (i + 1), style: 'width:44px;padding:2px;height:38px' });
          kleur.addEventListener('input', () => { r.kleur = kleur.value; tekenBaan(); wijzig(); });
          const naam = h('input', { type: 'text', value: r.naam, maxlength: 3, 'aria-label': 'Naam rijder ' + (i + 1), style: 'width:70px' });
          naam.addEventListener('input', () => { r.naam = naam.value; tekenBaan(); wijzig(); });
          const weg = h('button', { type: 'button', class: 'knop klein gevaar', 'aria-label': 'Rijder verwijderen', onclick: () => { if (sc.rijders.length < 2) return; sc.rijders.splice(i, 1); sc.stappen.forEach((st) => st.posities.splice(i, 1)); tekenRijders(); tekenBaan(); wijzig(); } }, '✕');
          return h('div', { class: 'rij', style: 'margin:4px 0' }, kleur, naam, sc.rijders.length > 1 ? weg : null);
        }),
        sc.rijders.length < 6 ? h('button', { type: 'button', class: 'knop klein licht', style: 'margin-top:6px', onclick: () => {
          const i = sc.rijders.length; sc.rijders.push({ naam: String(i + 1), kleur: KLEUREN[i % 6] });
          sc.stappen.forEach((st) => { const vorige = st.posities[i - 1] || { s: 0.1, in: 0 }; st.posities.push({ s: afronden((vorige.s - 0.04 + 1) % 1, 3), in: 0 }); });
          tekenRijders(); tekenBaan(); wijzig();
        } }, '+ Rijder') : null);
    }

    function tekenStappen() {
      const st = sc.stappen[stap];
      stappenBox.replaceChildren(
        h('div', { class: 'chips', style: 'margin-bottom:8px' }, sc.stappen.map((s, i) => h('button', { type: 'button', 'aria-pressed': String(i === stap), onclick: () => { stap = i; tekenStappen(); tekenBaan(); } }, 'Stap ' + (i + 1)))),
        h('div', { class: 'rij', style: 'margin-bottom:8px' },
          h('button', { type: 'button', class: 'knop klein licht', onclick: () => { const nieuw = kopie(sc.stappen[stap]); sc.stappen.splice(stap + 1, 0, nieuw); stap++; tekenStappen(); tekenBaan(); wijzig(); } }, '+ Stap (kopie van deze)'),
          h('button', { type: 'button', class: 'knop klein licht', 'aria-label': 'Stap naar voren', disabled: stap === 0, onclick: () => { const x = sc.stappen.splice(stap, 1)[0]; sc.stappen.splice(stap - 1, 0, x); stap--; tekenStappen(); tekenBaan(); wijzig(); } }, '← Eerder'),
          h('button', { type: 'button', class: 'knop klein licht', 'aria-label': 'Stap naar achteren', disabled: stap === sc.stappen.length - 1, onclick: () => { const x = sc.stappen.splice(stap, 1)[0]; sc.stappen.splice(stap + 1, 0, x); stap++; tekenStappen(); tekenBaan(); wijzig(); } }, 'Later →'),
          h('button', { type: 'button', class: 'knop klein gevaar', disabled: sc.stappen.length < 2, onclick: () => { sc.stappen.splice(stap, 1); stap = Math.max(0, stap - 1); tekenStappen(); tekenBaan(); wijzig(); } }, 'Stap verwijderen')));
      const duur = h('input', { type: 'number', min: 0.2, max: 10, step: 0.1, value: st.duur }); duur.addEventListener('input', () => { st.duur = tussen(duur.value, 0.2, 10, 1.5); wijzig(); });
      const tekst = h('input', { type: 'text', value: st.tekst || '', placeholder: 'Wat gebeurt er in deze stap?', maxlength: 120 }); tekst.addEventListener('input', () => { st.tekst = tekst.value; wijzig(); });
      stapVelden.replaceChildren(h('div', null, veld('Duur van de beweging (seconden)', duur)), h('div', { class: 'breed' }, veld('Tekst in beeld', tekst)));
    }

    function tekenBaan() {
      const st = sc.stappen[stap]; const vorige = sc.stappen[(stap - 1 + sc.stappen.length) % sc.stappen.length];
      const svg = M.el('svg', { viewBox: '26 16 288 136', role: 'img', 'aria-label': 'Baan: sleep de rijders naar de plek voor deze stap' }); svg.style.cssText = 'width:100%;height:auto;touch-action:none;color:#6b8fb3;background:var(--bg);border-radius:10px';
      M.baan(svg);
      if (sc.stappen.length > 1) sc.rijders.forEach((r, i) => { // vage stippen: waar stond de rijder in de vorige stap
        const p = vorige.posities[i]; const pt = M.baanPunt(p.s * M.P, p.in);
        M.el('circle', { cx: pt.x, cy: pt.y, r: 8, fill: r.kleur, opacity: 0.25 }, svg);
      });
      const dots = sc.rijders.map((r, i) => {
        const g = M.el('g', { style: 'cursor:grab' }, svg);
        M.el('circle', { r: 11, fill: r.kleur, stroke: '#fff', 'stroke-width': 1.5 }, g);
        const t = M.el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 10, 'font-weight': 700, fill: '#fff', style: 'pointer-events:none' }, g); t.textContent = (r.naam || '').slice(0, 3);
        const zet = () => { const p = st.posities[i]; const pt = M.baanPunt(p.s * M.P, p.in); g.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')'); };
        zet();
        let sleep = false;
        g.addEventListener('pointerdown', (e) => { sleep = true; try { g.setPointerCapture(e.pointerId); } catch (err) { /* synthetisch of niet actief */ } g.style.cursor = 'grabbing'; e.preventDefault(); });
        g.addEventListener('pointerup', () => { sleep = false; g.style.cursor = 'grab'; });
        g.addEventListener('pointermove', (e) => {
          if (!sleep) return;
          const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse());
          let beste = 0, dmin = Infinity;
          for (let k = 0; k < 720; k++) { const q = M.baanPunt((k / 720) * M.P, 0); const d = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y); if (d < dmin) { dmin = d; beste = k; } }
          const s = beste / 720; const q = M.baanPunt(s * M.P, 0); const q1 = M.baanPunt(s * M.P, 1);
          const ins = (p.x - q.x) * (q1.x - q.x) + (p.y - q.y) * (q1.y - q.y);
          st.posities[i] = { s: afronden(s, 3), in: afronden(tussen(ins, -14, 14, 0), 1) };
          zet(); wijzig();
        });
      });
      baanBox.replaceChildren(svg);
      return dots;
    }

    function zetScene(nieuw) { sc = nieuw; stap = 0; tekenRijders(); tekenStappen(); tekenBaan(); wijzig(); }
    const animBody = h('div', null,
      h('p', { class: 'meta', text: 'Maak de animatie stap voor stap: kies een stap en sleep de rijders naar de plek waar ze dan moeten zijn. De animatie rijdt vanzelf van stap naar stap en begint daarna weer van voren.' }),
      h('div', { class: 'rij', style: 'margin:8px 0' }, h('span', { class: 'meta', text: 'Begin met een voorbeeld:' }),
        h('button', { type: 'button', class: 'knop klein licht', onclick: () => zetScene(sceneKopOverKop()) }, 'Kop over kop'),
        h('button', { type: 'button', class: 'knop klein licht', onclick: () => zetScene(sceneSteigerung()) }, 'Steigerung'),
        h('button', { type: 'button', class: 'knop klein licht', onclick: () => zetScene(sceneLeeg()) }, 'Leeg')),
      h('h3', { text: 'Rijders' }), rijdersBox, h('h3', { text: 'Stappen', style: 'margin-top:12px' }), stappenBox, stapVelden,
      h('div', { style: 'margin-top:8px' }, baanBox), h('h3', { text: 'Voorbeeld', style: 'margin-top:12px' }), animVoorbeeld);
    const animAan = h('input', { type: 'checkbox', style: 'width:auto' }); animAan.checked = metScene; velden.animAan = animAan;
    animAan.addEventListener('change', () => { metScene = animAan.checked; animBody.style.display = metScene ? '' : 'none'; wijzig(); });
    animBody.style.display = metScene ? '' : 'none';
    const kaartAnim = h('section', { class: 'kaart' }, h('h2', { text: 'Animatie of tekening' }),
      h('label', { style: 'display:flex;align-items:center;gap:8px;flex-direction:row;font-weight:500;color:var(--tekst);margin-bottom:8px' }, animAan, 'Voeg een animatie toe aan deze oefening'),
      h('p', { class: 'meta', text: 'Wil je alleen een stilstaande tekening? Maak dan maar één stap.' }), animBody);

    // ---- video en andere beelden ----
    const overigeBox = h('div', null);
    function tekenOverige() {
      overigeBox.replaceChildren(...ed.overige.map((b, i) => h('div', { class: 'rij', style: 'margin:4px 0' },
        h('span', { class: 'chip', text: b.type }), h('span', { class: 'meta', text: b.bijschrift || b.url || b.src || b.anim }),
        h('button', { type: 'button', class: 'knop klein gevaar', 'aria-label': 'Beeld verwijderen', onclick: () => { ed.overige.splice(i, 1); tekenOverige(); tekenVoorbeeld(); } }, '✕'))));
    }
    const vUrl = h('input', { type: 'text', placeholder: 'https://www.youtube.com/watch?v=…' }); const vTekst = h('input', { type: 'text', placeholder: 'Wat zie je in de video?' });
    const kaartVideo = h('section', { class: 'kaart' }, h('h2', { text: 'Video erbij' }),
      h('p', { class: 'meta', text: 'Plak een YouTube-link. Foto\'s uploaden kan hier nog niet.' }),
      h('div', { class: 'formraster' }, h('div', { class: 'breed' }, veld('YouTube-link', vUrl)), h('div', { class: 'breed' }, veld('Bijschrift', vTekst))),
      h('div', { class: 'rij', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'knop klein licht', onclick: () => {
        if (!/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(vUrl.value.trim())) { toast('Dit is geen YouTube-link'); return; }
        ed.overige.push({ type: 'video', url: vUrl.value.trim(), bijschrift: vTekst.value.trim() || undefined }); vUrl.value = ''; vTekst.value = ''; tekenOverige(); tekenVoorbeeld();
      } }, '+ Video toevoegen')), overigeBox);

    // ---- AI-hulp ----
    const beschrijving = h('textarea', { placeholder: 'Beschrijf de oefening in je eigen woorden. Bijvoorbeeld: "Vier schaatsers rijden achter elkaar. De achterste gaat in de bocht langs de binnenkant naar voren en neemt de kop over."' });
    const plak = h('textarea', { placeholder: 'Plak hier het antwoord van de AI (de tekst met accolades { … })' });
    const aiStatus = h('p', { class: 'meta', role: 'status' });
    function neemOver(o) {
      if (o.naam) ed.naam = String(o.naam).slice(0, 120);
      if (Array.isArray(o.thema)) ed.thema = o.thema.map(String).join(', ');
      if (Array.isArray(o.types)) { ed.types = { droog: false, ijs: false, weekend: false }; o.types.forEach((t) => { if (t in ed.types) ed.types[t] = true; }); }
      if (o.niveau) ed.niveau = o.niveau === 'gevorderd' ? 'gevorderd' : 'alle';
      if (o.uitleg) ed.uitleg = String(o.uitleg).slice(0, 3000);
      if (Array.isArray(o.coachpunten)) ed.coach = o.coachpunten.map(String).join('\n');
      const nieuw = opschonenScene(o.scene);
      if (nieuw) { sc = nieuw; stap = 0; metScene = true; }
      velden.naam.value = ed.naam; velden.thema.value = ed.thema; velden.uitleg.value = ed.uitleg; velden.coach.value = ed.coach; velden.niveau.value = ed.niveau;
      ['droog', 'ijs', 'weekend'].forEach((t) => { velden['type-' + t].checked = !!ed.types[t]; });
      velden.animAan.checked = metScene; animBody.style.display = metScene ? '' : 'none';
      tekenRijders(); tekenStappen(); tekenBaan(); wijzig();
      aiStatus.style.color = ''; aiStatus.textContent = 'Voorstel overgenomen' + (nieuw ? ', met animatie' : '') + '. Controleer alles en pas aan waar nodig.';
    }
    const kaartAi = h('section', { class: 'kaart' }, h('h2', { text: 'Laat AI helpen (optioneel)' }),
      h('p', { class: 'meta', text: 'Beschrijf de oefening en laat een AI een eerste voorstel maken voor de tekst en de animatie. Je kunt het daarna zelf aanpassen. Controleer altijd of de uitleg klopt: een AI kan fouten maken.' }),
      veld('Beschrijving', beschrijving),
      h('div', { class: 'rij', style: 'margin:8px 0' },
        cache.config && cache.config.ai ? h('button', { type: 'button', class: 'knop', onclick: async (e) => {
          const b = e.currentTarget; b.disabled = true; b.textContent = 'AI denkt na…'; aiStatus.textContent = ''; aiStatus.style.color = '';
          try { const r = await window.vraagAI(beschrijving.value, cache.config, localStorage.getItem(SLEUTEL) || ''); neemOver(Object.assign({}, r.oefening, { scene: r.scene })); }
          catch (err) { aiStatus.textContent = err.message; aiStatus.style.color = '#c0392b'; } finally { b.disabled = false; b.textContent = 'Laat AI een voorstel maken'; }
        } }, 'Laat AI een voorstel maken') : null,
        h('button', { type: 'button', class: 'knop licht', onclick: () => {
          if (beschrijving.value.trim().length < 10) { aiStatus.textContent = 'Beschrijf de oefening eerst in een paar zinnen.'; aiStatus.style.color = '#c0392b'; return; }
          navigator.clipboard.writeText(PROMPT + '\n\nDe oefening: ' + beschrijving.value.trim()).then(() => { aiStatus.style.color = ''; aiStatus.textContent = 'Gekopieerd. Plak dit in je eigen AI-assistent (bijvoorbeeld Claude of ChatGPT) en plak het antwoord hieronder.'; }, () => { aiStatus.textContent = 'Kopiëren is niet gelukt.'; });
        } }, 'Kopieer opdracht voor mijn eigen AI')),
      veld('Antwoord van de AI', plak),
      h('div', { class: 'rij', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'knop licht', onclick: () => {
        const t = plak.value; const a = t.indexOf('{'); const z = t.lastIndexOf('}');
        try { if (a < 0 || z < a) throw new Error('x'); neemOver(JSON.parse(t.slice(a, z + 1))); }
        catch (e) { aiStatus.textContent = 'Dit antwoord kan ik niet lezen. Plak de hele tekst met de accolades { }.'; aiStatus.style.color = '#c0392b'; }
      } }, 'Gebruik dit antwoord')), aiStatus);

    // ---- voorbeeld en publiceren ----
    const voorbeeld = h('div', null);
    const tekenVoorbeeld = dun(() => {
      const o = bouwOefening();
      voorbeeld.replaceChildren(h('h3', { text: o.naam || 'Naam van de oefening' }), A.oefeningInhoud(o));
    }, 300);
    const code = h('input', { type: 'password', autocomplete: 'off', placeholder: 'Clubcode', value: localStorage.getItem(SLEUTEL) || '' });
    const status = h('p', { class: 'meta', role: 'status' });
    const knop = h('button', { type: 'button', class: 'knop' }, 'Publiceer oefening');
    knop.addEventListener('click', async () => {
      status.textContent = ''; status.style.color = '';
      const o = bouwOefening();
      if (!o.naam) { status.textContent = 'Vul eerst een naam in.'; status.style.color = '#c0392b'; return; }
      if (!bestaand && cache.oefById[o.id] && !confirm('Er bestaat al een oefening met deze naam. Wil je die vervangen?')) return;
      knop.disabled = true; knop.textContent = 'Bezig met publiceren…';
      try {
        try { localStorage.setItem(SLEUTEL, code.value.trim()); } catch (e) { /* ignore */ }
        await window.publiceerOefening(o, cache.config, code.value.trim());
        cache.oef = null; ed.id = o.id;
        status.replaceChildren('Gepubliceerd. Over ongeveer een minuut staat de oefening in de bibliotheek. ', h('a', { href: '#/oefeningen/' + o.id, text: 'Bekijk de oefening' }), '.');
      } catch (e) { status.textContent = e.message || String(e); status.style.color = '#c0392b'; } finally { knop.disabled = false; knop.textContent = 'Publiceer oefening'; }
    });
    const kaartPubliceer = h('section', { class: 'kaart' }, h('h2', { text: 'Publiceren' }),
      cache.config && cache.config.publiceren_url ? null : h('div', { class: 'kader', text: 'Publiceren is nog niet ingesteld: vul publiceren_url in data/config.json in (zie README).' }),
      veld('Clubcode (eenmalig)', code),
      h('div', { class: 'rij', style: 'margin-top:10px' }, knop, h('button', { type: 'button', class: 'knop licht', onclick: () => navigator.clipboard.writeText(JSON.stringify(bouwOefening(), null, 2)).then(() => toast('JSON gekopieerd'), () => toast('Kopiëren mislukt')) }, 'Kopieer JSON')), status);

    const kiesBestaand = h('select', null, h('option', { value: '', text: 'Bewerk een bestaande oefening…' }), ...cache.oef.oefeningen.map((o) => h('option', { value: o.id, text: o.naam })));
    kiesBestaand.value = editId || ''; kiesBestaand.addEventListener('change', () => { location.hash = kiesBestaand.value ? '#/oefening-maken/' + kiesBestaand.value : '#/oefening-maken'; });

    const root = h('div', null,
      h('a', { class: 'terug', href: '#/oefeningen', text: '← Alle oefeningen' }),
      h('h1', { text: bestaand ? 'Oefening bewerken' : 'Nieuwe oefening' }),
      h('div', { style: 'margin-bottom:12px' }, kiesBestaand),
      kaartAi, kaartOefening, kaartAnim, kaartVideo,
      h('section', { class: 'kaart' }, h('h2', { text: 'Zo ziet het eruit' }), voorbeeld), kaartPubliceer);
    tekenRijders(); tekenStappen(); tekenBaan(); tekenOverige(); tekenAnimVoorbeeld(); tekenVoorbeeld();
    return root;
  }

  window.__editor = { pagina, slug, opschonenScene, PROMPT };
})();
