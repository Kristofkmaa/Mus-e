(() => {
  'use strict';

  /* ---------- Règles ---------- */

  const RARITIES = [
    { id: 'imperial',   name: 'Impériale',  frame: 'Vermeil', rate: 1.5,  sell: 500, desc: 'Les images que tout le monde connaît : le Cri, la Liberté guidant le peuple, la Création d\'Adam.' },
    { id: 'legendaire', name: 'Légendaire', frame: 'Or',      rate: 5,    sell: 150, desc: 'Les toiles pour lesquelles on traverse un musée : Vénus et Mars, la Donna Velata, le Joueur de luth.' },
    { id: 'epique',     name: 'Épique',     frame: 'Argent',  rate: 13.5, sell: 50,  desc: 'Grands tableaux de maîtres, de Titien à Malevitch.' },
    { id: 'rare',       name: 'Rare',       frame: 'Bronze',  rate: 30,   sell: 15,  desc: 'Œuvres reconnues des collections permanentes.' },
    { id: 'commune',    name: 'Commune',    frame: 'Bois',    rate: 50,   sell: 5,   desc: 'Études, esquisses et toiles moins connues des mêmes maîtres.' },
  ];
  const BY_ID = Object.fromEntries(RARITIES.map((r, i) => [r.id, { ...r, rank: i }]));
  const PRICE = 100, PRICE_TEN = 1000, DAILY = 500, START = 1600, PITY = 60;

  /* ---------- État ---------- */

  const STORE = 'musee.v2';
  const today = () => new Date().toISOString().slice(0, 10);
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE));
      if (s && typeof s.coins === 'number') return s;
    } catch { /* stockage indisponible */ }
    return { coins: START, lastDaily: today(), pity: 0, pulls: 0, collection: {} };
  }
  const state = load();
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* navigation privée */ } };

  /* ---------- Outils ---------- */

  const $ = (s) => document.querySelector(s);
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => n.toLocaleString('fr-FR');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));
  const imgSrc = (a) => `art/${a.key}.jpg`;
  const inv = (a) => `INV. ${String(a.inv).padStart(3, '0')}`;

  function hexes(rarity) {
    const filled = 5 - BY_ID[rarity].rank;
    return `<span class="hexes" aria-label="${esc(BY_ID[rarity].name)}">${Array.from({ length: 5 }, (_, i) => `<svg aria-hidden="true"><use href="#${i < filled ? 'hex-full' : 'hex'}"/></svg>`).join('')}</span>`;
  }
  const plural = (n, s) => `${n} ${s}${n > 1 ? 'S' : ''}`;

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3600);
  }

  /* ---------- Catalogue ---------- */

  let ART = [], BY_KEY = {};
  async function loadCatalogue() {
    if (window.MUSEE_CATALOGUE) ART = window.MUSEE_CATALOGUE;
    else ART = await (await fetch('art/catalogue.json')).json();
    BY_KEY = Object.fromEntries(ART.map((a) => [a.key, a]));
    $('#total').textContent = fmt(ART.length);
  }
  function preload(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image')); i.src = src; });
  }
  async function drawArtwork(rarity) {
    const pool = ART.filter((a) => a.r === rarity);
    const owned = pool.filter((a) => !state.collection[a.key]);
    const from = owned.length && Math.random() < 0.7 ? owned : pool; // les œuvres manquantes sortent un peu plus souvent
    const a = from[Math.floor(Math.random() * from.length)];
    await preload(imgSrc(a));
    return a;
  }

  /* ---------- Tirage ---------- */

  let busy = false;
  function renderCoins() {
    $('#coins').textContent = fmt(state.coins);
    $('#pull1').disabled = busy || state.coins < PRICE;
    $('#pull10').disabled = busy || state.coins < PRICE_TEN;
    const left = PITY - state.pity;
    $('#pity').textContent = left === 1 ? 'Le prochain tirage est doré au minimum.' : `Un cadre doré au plus tard dans ${left} tirages.`;
  }
  function finishRoll(id) { state.pity = BY_ID[id].rank <= 1 ? 0 : state.pity + 1; return id; }
  function rollRarity(minRank = 4) {
    if (state.pity >= PITY - 1) { state.pity = 0; return Math.random() < 1.5 / 6.5 ? 'imperial' : 'legendaire'; }
    const pool = RARITIES.filter((r) => BY_ID[r.id].rank <= minRank);
    const total = pool.reduce((s, r) => s + r.rate, 0);
    let x = Math.random() * total;
    for (const r of pool) { x -= r.rate; if (x <= 0) return finishRoll(r.id); }
    return finishRoll(pool[pool.length - 1].id);
  }
  function addToCollection(a) {
    const c = state.collection[a.key];
    if (c) { c.count += 1; return c.count; }
    state.collection[a.key] = { count: 1, at: Date.now() };
    return 1;
  }

  function cardHTML(a, count) {
    const r = BY_ID[a.r];
    return `
      <p class="card__room">${hexes(a.r)} ${esc(r.name)}, cadre ${esc(r.frame.toLowerCase())}</p>
      <p class="card__artist">${esc(a.artist)}</p>
      <p class="card__title"><cite>${esc(a.title)}</cite>${a.date ? `, ${esc(a.date)}` : ''}</p>
      <p class="card__meta">${[a.medium, a.museum].filter(Boolean).map(esc).join('<br>') || esc(inv(a))}</p>
      ${count > 1 ? `<p class="card__meta">Doublon, ${count} exemplaires.</p>` : ''}
      <button class="ghost card__link" type="button" data-detail="${esc(a.key)}">Voir l'œuvre entière</button>`;
  }

  async function pullOne() {
    if (busy || state.coins < PRICE) return;
    busy = true;
    state.coins -= PRICE; state.pulls += 1;
    const rarity = rollRarity();
    save(); renderCoins();

    const panel = $('#tirage'), img = $('#panelImg'), card = $('#card'), body = $('#cardBody');
    img.hidden = true; card.classList.remove('card--paper');
    panel.classList.add('is-waiting');
    body.innerHTML = `<p class="card__lead">Tirage nº ${state.pulls}.</p><p class="card__text">Le conservateur décroche une œuvre.</p>`;
    $('#cardMicro').textContent = `TIRAGE Nº ${state.pulls}`;
    panel.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });

    try {
      const [a] = await Promise.all([drawArtwork(rarity), wait(900)]);
      const count = addToCollection(a);
      save();
      img.src = imgSrc(a); img.alt = `${a.title}, ${a.artist}`; img.hidden = false;
      panel.classList.remove('is-waiting');
      card.classList.toggle('card--paper', a.r === 'imperial');
      body.innerHTML = cardHTML(a, count);
      renderGallery();
    } catch {
      state.coins += PRICE; save();
      panel.classList.remove('is-waiting');
      body.innerHTML = `<p class="card__lead">L'œuvre n'a pas pu être chargée.</p><p class="card__text">Vos 100 napoléons ont été rendus. Réessayez.</p>`;
    } finally {
      busy = false; renderCoins();
    }
  }

  async function pullTen() {
    if (busy || state.coins < PRICE_TEN) return;
    busy = true;
    state.coins -= PRICE_TEN;
    const first = state.pulls + 1;
    state.pulls += 10;
    const rarities = Array.from({ length: 10 }, () => rollRarity());
    if (!rarities.some((r) => BY_ID[r].rank <= 2)) rarities[9] = rollRarity(2);
    save(); renderCoins();

    const dlg = $('#tenDialog'), grid = $('#tenGrid');
    $('#tenMicro').textContent = `TIRAGES Nº ${first} À ${state.pulls}`;
    $('#closeTen').disabled = true;
    grid.innerHTML = rarities.map(() => '<div class="ten__item"></div>').join('');
    dlg.showModal();

    let failed = 0;
    const results = await Promise.all(rarities.map((r) => drawArtwork(r).catch(() => null)));
    results.sort((x, y) => (y ? BY_ID[y.r].rank : 9) - (x ? BY_ID[x.r].rank : 9)); // les plus rares en dernier
    for (let i = 0; i < results.length; i++) {
      const a = results[i], slot = grid.children[i];
      if (!a) { failed += 1; slot.innerHTML = '<p class="ten__fail">Œuvre indisponible, 100 napoléons rendus.</p>'; continue; }
      const count = addToCollection(a);
      slot.innerHTML = `
        <p class="ten__cap">${esc(a.artist)}</p>
        <button class="ten__circle" type="button" data-detail="${esc(a.key)}" aria-label="Voir ${esc(a.title)}"><img src="${imgSrc(a)}" alt=""></button>
        ${hexes(a.r)}
        <p class="ten__title"><cite>${esc(a.title)}</cite>${count > 1 ? ` · ${count} ex.` : ''}</p>`;
      slot.classList.add('is-in');
      await wait(140);
    }
    if (failed) state.coins += failed * PRICE;
    save();
    busy = false;
    $('#closeTen').disabled = false;
    renderCoins(); renderGallery();
  }

  /* ---------- Galerie ---------- */

  let filter = 'all';
  function items() {
    return Object.entries(state.collection).filter(([k]) => BY_KEY[k]).map(([k, c]) => ({ ...c, art: BY_KEY[k] }));
  }
  function renderGallery() {
    const all = items();
    const counts = Object.fromEntries(RARITIES.map((r) => [r.id, 0]));
    all.forEach((c) => { counts[c.art.r] += 1; });
    $('#filters').innerHTML = [
      `<button type="button" class="ghost" aria-pressed="${filter === 'all'}" data-f="all">Toutes<span>${all.length}</span></button>`,
      ...RARITIES.map((r) => `<button type="button" class="ghost" aria-pressed="${filter === r.id}" data-f="${r.id}">${r.name}<span>${counts[r.id]}</span></button>`),
    ].join('');

    const sort = $('#sort').value;
    const list = all.filter((c) => filter === 'all' || c.art.r === filter).sort((x, y) => {
      if (sort === 'rarity') return BY_ID[x.art.r].rank - BY_ID[y.art.r].rank || y.at - x.at;
      if (sort === 'artist') return x.art.artist.localeCompare(y.art.artist, 'fr') || x.art.title.localeCompare(y.art.title, 'fr');
      return y.at - x.at;
    });
    const copies = all.reduce((s, c) => s + c.count, 0);
    $('#owned').textContent = fmt(all.length);
    $('#galleryCount').textContent = `${plural(all.length, 'ŒUVRE')}, ${plural(copies - all.length, 'DOUBLON')}`;
    $('#empty').hidden = all.length > 0;
    $('#sellAll').disabled = copies === all.length;

    $('#hang').innerHTML = list.map((c) => `
      <button class="piece" type="button" data-detail="${esc(c.art.key)}">
        <img src="${imgSrc(c.art)}" alt="" loading="lazy" decoding="async" style="--ar:${c.art.ratio}">
        <span class="piece__cap">
          <span class="piece__artist">${esc(c.art.artist)}</span>
          <span class="piece__title"><cite>${esc(c.art.title)}</cite></span>
          <span class="piece__foot">${hexes(c.art.r)}${c.count > 1 ? `<span class="piece__count">×${c.count}</span>` : ''}</span>
        </span>
      </button>`).join('');
  }

  function openDetail(key) {
    const a = BY_KEY[key], c = state.collection[key];
    if (!a) return;
    const r = BY_ID[a.r];
    const count = c ? c.count : 0;
    $('#detailBody').innerHTML = `
      <div class="detail__art"><img src="${imgSrc(a)}" alt="${esc(a.title)}, ${esc(a.artist)}"></div>
      <div class="detail__text">
        <p class="detail__room">${hexes(a.r)} ${esc(r.name)}, cadre ${esc(r.frame.toLowerCase())}</p>
        <p class="detail__artist">${esc(a.artist)}</p>
        <p class="detail__title"><cite>${esc(a.title)}</cite>${a.date ? `, ${esc(a.date)}` : ''}</p>
        <div class="detail__meta">
          ${a.medium ? `<p>${esc(a.medium)}</p>` : ''}
          ${a.museum ? `<p>${esc(a.museum)}</p>` : ''}
          <p>${esc(inv(a))}${c ? ` · accrochée le ${new Date(c.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}</p>
          ${count > 1 ? `<p>Doublon, ${count} exemplaires.</p>` : ''}
        </div>
        <div class="detail__actions">
          ${count > 1 ? `<button class="pill" type="button" id="sellOne">Vendre un doublon pour ${r.sell} N</button>` : ''}
        </div>
      </div>`;
    $('#sellOne')?.addEventListener('click', () => {
      c.count -= 1; state.coins += r.sell; save();
      renderCoins(); renderGallery();
      toast(`Doublon vendu, ${r.sell} napoléons ajoutés.`);
      openDetail(key);
    });
    const dlg = $('#detailDialog');
    if (!dlg.open) dlg.showModal();
  }

  function sellAll() {
    let gain = 0;
    for (const [k, c] of Object.entries(state.collection)) {
      if (c.count > 1 && BY_KEY[k]) { gain += (c.count - 1) * BY_ID[BY_KEY[k].r].sell; c.count = 1; }
    }
    if (!gain) return;
    state.coins += gain; save();
    renderCoins(); renderGallery();
    toast(`Doublons vendus, ${fmt(gain)} napoléons ajoutés.`);
  }

  function renderRates() {
    $('#rates').innerHTML = RARITIES.map((r) => `
      <li class="rate">
        <p class="rate__name">${hexes(r.id)} ${r.name}, cadre ${r.frame.toLowerCase()}</p>
        <p class="rate__stats"><span>Chance : ${String(r.rate).replace('.', ',')} %</span><span>Revente : ${r.sell} N</span></p>
        <p class="rate__desc">${r.desc} ${ART.filter((a) => a.r === r.id).length} œuvres.</p>
      </li>`).join('');
  }

  /* ---------- Démarrage ---------- */

  async function start() {
    await loadCatalogue();
    if (state.lastDaily !== today()) {
      state.lastDaily = today(); state.coins += DAILY; save();
      setTimeout(() => toast(`Allocation du jour, ${DAILY} napoléons ajoutés.`), 600);
    }
    $('#pull1').addEventListener('click', pullOne);
    $('#pull10').addEventListener('click', pullTen);
    $('#closeTen').addEventListener('click', () => $('#tenDialog').close());
    $('#tenDialog').addEventListener('cancel', (e) => { if (busy) e.preventDefault(); });
    $('#closeDetail').addEventListener('click', () => $('#detailDialog').close());
    $('#detailDialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
    $('#filters').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; renderGallery(); } });
    $('#sort').addEventListener('change', renderGallery);
    $('#sellAll').addEventListener('click', sellAll);
    document.addEventListener('click', (e) => { const b = e.target.closest('[data-detail]'); if (b) openDetail(b.dataset.detail); });
    renderRates(); renderGallery(); renderCoins();
  }
  start().catch(() => { $('#cardBody').innerHTML = '<p class="card__lead">Le catalogue n\'a pas pu être chargé.</p><p class="card__text">Rechargez la page.</p>'; });
})();
