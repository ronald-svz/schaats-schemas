/* Kleine SVG-animaties van de ijsbaan. Elke animatie is een functie die een element teruggeeft.
   Voeg een nieuwe toe in ANIMATIES en verwijs ernaar met {"type":"animatie","anim":"naam"} in oefeningen.json. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const L = 150, R = 52, CX = 170, CY = 84;
  const P = 2 * L + 2 * Math.PI * R;

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Punt op de baan (tegen de klok in) met zijwaartse verschuiving naar binnen
  function baanPunt(s, inzet) {
    s = ((s % P) + P) % P;
    let x, y, tx, ty;
    if (s < L) { x = CX - L / 2 + s; y = CY + R; tx = 1; ty = 0; }
    else if (s < L + Math.PI * R) {
      const a = (s - L) / R; // 0..pi
      x = CX + L / 2 + R * Math.sin(a); y = CY + R * Math.cos(a);
      tx = Math.cos(a); ty = -Math.sin(a);
    } else if (s < 2 * L + Math.PI * R) { x = CX + L / 2 - (s - L - Math.PI * R); y = CY - R; tx = -1; ty = 0; }
    else {
      const a = (s - 2 * L - Math.PI * R) / R;
      x = CX - L / 2 - R * Math.sin(a); y = CY - R * Math.cos(a);
      tx = -Math.cos(a); ty = Math.sin(a);
    }
    return { x: x + ty * inzet, y: y - tx * inzet };
  }

  function baan(svg) {
    const d = 'M' + (CX - L / 2) + ',' + (CY + R) + ' H' + (CX + L / 2) +
      ' A' + R + ',' + R + ' 0 0 0 ' + (CX + L / 2) + ',' + (CY - R) + ' H' + (CX - L / 2) +
      ' A' + R + ',' + R + ' 0 0 0 ' + (CX - L / 2) + ',' + (CY + R) + ' Z';
    el('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-opacity': '.25', 'stroke-width': 22, 'stroke-linejoin': 'round' }, svg);
    el('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-opacity': '.5', 'stroke-width': 1, 'stroke-dasharray': '4 4' }, svg);
  }

  function ease(u) { return u * u * (3 - 2 * u); }

  function koprover() {
    const svg = el('svg', { viewBox: '26 16 288 136', role: 'img', 'aria-label': 'Animatie kop over kop: de achterste rijdt langs de binnenkant naar voren' });
    svg.style.color = '#6b8fb3';
    baan(svg);
    const N = 4, gap = 21, V = 80, WISSEL = 2.4, RIJ = 1.6;
    const kleur = ['#e0802a', '#0b6fb8', '#0b6fb8', '#0b6fb8'];
    const dots = [];
    for (let i = 0; i < N; i++) dots.push(el('circle', { r: 8, fill: kleur[0] }, svg));
    const tekst = el('text', { x: 170, y: 88, 'text-anchor': 'middle', 'font-size': 12, fill: 'currentColor' }, svg);
    tekst.textContent = 'achterste neemt rustig de kop over';
    tekst.style.opacity = '.0';
    let volgorde = [0, 1, 2, 3]; // volgorde[plaats] = rijder; plaats 0 = voorop
    return {
      el: svg,
      start(t0) {
        let s0 = 0, cyc = 0, last = t0;
        return function frame(t) {
          const dt = Math.min(0.05, (t - last) / 1000); last = t; s0 += V * dt;
          cyc += dt;
          let u = 0;
          if (cyc > RIJ + WISSEL) { // wissel klaar: rotatie doorvoeren
            volgorde = [volgorde[N - 1]].concat(volgorde.slice(0, N - 1)); cyc = 0;
          } else if (cyc > RIJ) u = ease((cyc - RIJ) / WISSEL);
          for (let plaats = 0; plaats < N; plaats++) {
            const rijder = volgorde[plaats];
            let off, inzet = 0;
            if (plaats === N - 1) { off = -(N - 1) * gap + u * (N - 1) * gap; inzet = 13 * Math.sin(Math.PI * u); }
            else off = -plaats * gap - u * gap;
            const p = baanPunt(s0 + off, inzet);
            dots[rijder].setAttribute('cx', p.x.toFixed(1)); dots[rijder].setAttribute('cy', p.y.toFixed(1));
            dots[rijder].setAttribute('fill', plaats === 0 && u === 0 ? '#e0802a' : '#0b6fb8');
          }
          tekst.style.opacity = u > 0 ? '1' : '0';
        };
      }
    };
  }

  function steigerung() {
    const svg = el('svg', { viewBox: '26 16 288 136', role: 'img', 'aria-label': 'Animatie steigerung: rustig beginnen en geleidelijk versnellen' });
    svg.style.color = '#6b8fb3';
    baan(svg);
    const spoor = [];
    for (let i = 0; i < 14; i++) spoor.push(el('circle', { r: 6.5 - i * 0.3, fill: '#0b6fb8', opacity: (0.5 - i * 0.035).toFixed(2) }, svg));
    const dot = el('circle', { r: 8.5, fill: '#e0802a' }, svg);
    el('rect', { x: 95, y: 78, width: 150, height: 8, rx: 4, fill: 'currentColor', 'fill-opacity': '.2' }, svg);
    const balk = el('rect', { x: 95, y: 78, width: 0, height: 8, rx: 4, fill: '#e0802a' }, svg);
    const label = el('text', { x: 170, y: 104, 'text-anchor': 'middle', 'font-size': 12, fill: 'currentColor' }, svg);
    const tempo = el('text', { x: 170, y: 68, 'text-anchor': 'middle', 'font-size': 11, fill: 'currentColor' }, svg);
    tempo.textContent = 'snelheid';
    return {
      el: svg,
      start(t0) {
        let s = 0, last = t0, voortgang = 0;
        return function frame(t) {
          const dt = Math.min(0.05, (t - last) / 1000); last = t;
          voortgang += dt / 7; if (voortgang > 1.15) voortgang = 0;
          const v = 22 + 100 * Math.pow(Math.min(1, voortgang), 1.6);
          s += v * dt;
          for (let i = 0; i < spoor.length; i++) { const p = baanPunt(s - (i + 1) * 5.5 * (0.4 + v / 120), 0); spoor[i].setAttribute('cx', p.x); spoor[i].setAttribute('cy', p.y); }
          const p = baanPunt(s, 0); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
          balk.setAttribute('width', (150 * Math.min(1, voortgang)).toFixed(1));
          label.textContent = voortgang < 0.35 ? 'rustig opbouwen' : voortgang < 0.8 ? 'doorversnellen in de bocht' : 'aanzetten';
        };
      }
    };
  }

  const ANIMATIES = { 'kop-over-kop': koprover, 'steigerung': steigerung };
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.maakAnimatie = function (naam) {
    const maker = ANIMATIES[naam];
    const wrap = document.createElement('div');
    wrap.className = 'anim';
    if (!maker) { wrap.textContent = 'Animatie niet gevonden: ' + naam; return wrap; }
    const a = maker();
    wrap.appendChild(a.el);
    // Een eenvoudige timer (25 beelden/s) is genoeg voor deze kleine tekeningen en werkt overal.
    let timer = 0, frame = null;
    function tik() {
      if (!wrap.isConnected) { if (frame) stop(); return; } // nog niet geplaatst, of verwijderd
      const r = wrap.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight) return; // niet in beeld (of ingeklapt): overslaan
      const t = performance.now();
      if (!frame) frame = a.start(t);
      frame(t);
      if (reduce) stop();
    }
    function stop() { clearInterval(timer); timer = 0; }
    timer = setInterval(tik, 40);
    return wrap;
  };
})();
