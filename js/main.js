import { drawArtwork } from './museums.js';

/* ---------- Règles du jeu ---------- */

const RARITIES = [
  { id: 'imperial',   name: 'Impériale',  frame: 'Cadre de vermeil', rate: 1.5,  sell: 500, room: 'Chefs-d\'œuvre de la peinture européenne du Metropolitan Museum.' },
  { id: 'legendaire', name: 'Légendaire', frame: 'Cadre doré',       rate: 5,    sell: 150, room: 'Peintures phares de l\'Art Institute of Chicago.' },
  { id: 'epique',     name: 'Épique',     frame: 'Cadre d\'argent',  rate: 13.5, sell: 50,  room: 'Pièces maîtresses du Met, toutes époques et cultures.' },
  { id: 'rare',       name: 'Rare',       frame: 'Cadre de bronze',  rate: 30,   sell: 15,  room: 'Collection permanente de l\'Art Institute of Chicago.' },
  { id: 'commune',    name: 'Commune',    frame: 'Cadre de bois',    rate: 50,   sell: 5,   room: 'Réserves en accès libre du Cleveland Museum of Art.' },
];
const BY_ID = Object.fromEntries(RARITIES.map((r, i) => [r.id, { ...r, rank: i }]));
const PRICE = 100;
const PRICE_TEN = 1000;
const DAILY = 500;
const START = 1600;
const PITY = 60; // un cadre doré au plus tard au 60e tirage

/* ---------- État persistant ---------- */

const STORE = 'musee.v1';
const today = () => new Date().toISOString().slice(0, 10);

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && typeof s.coins === 'number') return s;
  } catch { /* stockage indisponible */ }
  return { coins: START, lastDaily: today(), pity: 0, pulls: 0, collection: {} };
}
const state = load();
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* navigation privée */ }
}

/* ---------- Utilitaires DOM ---------- */

const $ = (s) => document.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => n.toLocaleString('fr-FR');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3600);
}

function renderCoins() {
  $('#coins').textContent = fmt(state.coins);
  $('#pull1').disabled = busy || state.coins < PRICE;
  $('#pull10').disabled = busy || state.coins < PRICE_TEN;
  const left = PITY - state.pity;
  $('#pity').textContent = left === 1
    ? 'Le prochain tirage décroche au moins un cadre doré.'
    : `Un cadre doré est garanti d'ici ${left} tirages.`;
}

/* ---------- Tirage ---------- */

function rollRarity({ minRank = 4 } = {}) {
  if (state.pity >= PITY - 1) {
    state.pity = 0;
    return Math.random() < 1.5 / 6.5 ? 'imperial' : 'legendaire';
  }
  const pool = RARITIES.filter((r) => BY_ID[r.id].rank <= minRank);
  const total = pool.reduce((s, r) => s + r.rate, 0);
  let x = Math.random() * total;
  for (const r of pool) {
    x -= r.rate;
    if (x <= 0) return finishRoll(r.id);
  }
  return finishRoll(pool[pool.length - 1].id);
}
function finishRoll(id) {
  state.pity = BY_ID[id].rank <= 1 ? 0 : state.pity + 1;
  return id;
}

function addToCollection(art, rarity) {
  const owned = state.collection[art.key];
  if (owned) {
    owned.count += 1;
    return owned.count;
  }
  state.collection[art.key] = { art, rarity, count: 1, at: Date.now() };
  return 1;
}

let busy = false;

/* ---------- Cadres ---------- */

function frameHTML(art, rarity, { curtain = true, size = '' } = {}) {
  const ratio = Math.min(Math.max(art.ratio || 0.8, 0.55), 1.8);
  return `
    <div class="frame frame--${rarity} ${size}">
      <div class="frame__inner" style="aspect-ratio:${ratio}">
        <img src="${esc(art.img)}" alt="${esc(art.title)}, ${esc(art.artist)}" referrerpolicy="no-referrer" loading="lazy" decoding="async">
        ${curtain ? `<div class="curtain"><span class="curtain__half curtain__half--l"></span><span class="curtain__half curtain__half--r"></span></div>` : ''}
      </div>
    </div>`;
}

function cartelHTML(art, rarity, count) {
  const r = BY_ID[rarity];
  return `
    <p class="cartel__rarity cartel__rarity--${rarity}">${r.name}, ${r.frame.toLowerCase()}${count > 1 ? `<span class="dup">Doublon, ${count} exemplaires</span>` : ''}</p>
    <p class="cartel__artist">${esc(art.artist)}</p>
    <p class="cartel__title"><cite>${esc(art.title)}</cite>${art.date ? `, ${esc(art.date)}` : ''}</p>
    ${art.medium ? `<p class="cartel__meta">${esc(art.medium)}</p>` : ''}
    <p class="cartel__meta">${esc(art.museum)}</p>`;
}

function liftCurtain(frameEl) {
  frameEl.classList.add('is-open');
}

/* ---------- Tirage simple ---------- */

async function pullOne() {
  if (busy || state.coins < PRICE) return;
  busy = true;
  state.coins -= PRICE;
  state.pulls += 1;
  const rarity = rollRarity();
  save();
  renderCoins();

  const stage = $('#stage');
  const cartel = $('#heroCartel');
  cartel.hidden = true;
  stage.innerHTML = `
    <div class="frame frame--pending is-loading">
      <div class="frame__inner">
        <div class="curtain"><span class="curtain__half curtain__half--l"></span><span class="curtain__half curtain__half--r"></span>
        <span class="curtain__msg">Le conservateur décroche une œuvre…</span></div>
      </div>
    </div>`;
  stage.append(cartel);

  try {
    const art = await drawArtwork(rarity);
    const count = addToCollection(art, rarity);
    save();

    stage.innerHTML = frameHTML(art, rarity, { size: 'frame--hero' });
    stage.append(cartel);
    const frame = stage.querySelector('.frame');
    frame.classList.add('is-teasing');
    const curtain = frame.querySelector('.curtain');
    curtain.insertAdjacentHTML('beforeend', `<button class="curtain__msg curtain__btn" type="button">Lever le rideau</button>`);

    const open = () => {
      liftCurtain(frame);
      cartel.innerHTML = cartelHTML(art, rarity, count);
      cartel.hidden = false;
      if (art.link) cartel.insertAdjacentHTML('beforeend', `<a class="cartel__link" href="${esc(art.link)}" target="_blank" rel="noopener">Voir la notice du musée</a>`);
      renderGallery();
    };
    const btn = curtain.querySelector('.curtain__btn');
    btn.addEventListener('click', open, { once: true });
    btn.focus({ preventScroll: true });
    if (reduced) open();
  } catch {
    state.coins += PRICE;
    save();
    stage.innerHTML = `<div class="frame frame--pending"><div class="frame__inner"><div class="curtain"><span class="curtain__half curtain__half--l"></span><span class="curtain__half curtain__half--r"></span><span class="curtain__msg">Les musées ne répondent pas. Vos 100 napoléons ont été rendus, réessayez dans un instant.</span></div></div></div>`;
    stage.append(cartel);
  } finally {
    busy = false;
    renderCoins();
  }
}

/* ---------- Dix tirages ---------- */

async function pullTen() {
  if (busy || state.coins < PRICE_TEN) return;
  busy = true;
  state.coins -= PRICE_TEN;
  state.pulls += 10;
  const rarities = Array.from({ length: 10 }, () => rollRarity());
  if (!rarities.some((r) => BY_ID[r].rank <= 2)) rarities[9] = rollRarity({ minRank: 2 });
  save();
  renderCoins();

  const grid = $('#tenGrid');
  grid.innerHTML = rarities.map(() => `
    <div class="ten__slot"><div class="frame frame--pending is-loading frame--small"><div class="frame__inner"><div class="curtain"><span class="curtain__half curtain__half--l"></span><span class="curtain__half curtain__half--r"></span></div></div></div></div>`).join('');
  const dlg = $('#tenDialog');
  dlg.showModal();

  let failed = 0;
  await Promise.all(rarities.map(async (rarity, i) => {
    const slot = grid.children[i];
    try {
      const art = await drawArtwork(rarity);
      const count = addToCollection(art, rarity);
      slot.innerHTML = `
        <button class="ten__btn" type="button" aria-label="Lever le rideau, ${BY_ID[rarity].frame.toLowerCase()}">
          ${frameHTML(art, rarity, { size: 'frame--small' })}
        </button>
        <div class="ten__label cartel" hidden>${cartelHTML(art, rarity, count)}</div>`;
      slot.querySelector('.frame').classList.add('is-teasing');
      slot.querySelector('.ten__btn').addEventListener('click', () => revealSlot(slot), { once: true });
    } catch {
      failed += 1;
      slot.innerHTML = `<p class="ten__fail">Œuvre indisponible, 100 napoléons rendus.</p>`;
    }
  }));
  if (failed) state.coins += failed * PRICE;
  save();
  busy = false;
  renderCoins();
  renderGallery();
}

function revealSlot(slot) {
  const frame = slot.querySelector('.frame');
  if (!frame || frame.classList.contains('is-open')) return;
  liftCurtain(frame);
  slot.querySelector('.ten__label').hidden = false;
}

/* ---------- Galerie ---------- */

let filter = 'all';

function renderFilters() {
  const counts = Object.fromEntries(RARITIES.map((r) => [r.id, 0]));
  Object.values(state.collection).forEach((c) => { counts[c.rarity] += 1; });
  const total = Object.keys(state.collection).length;
  $('#filters').innerHTML = [
    `<button type="button" class="chip" aria-pressed="${filter === 'all'}" data-f="all">Toutes <span>${total}</span></button>`,
    ...RARITIES.map((r) => `<button type="button" class="chip chip--${r.id}" aria-pressed="${filter === r.id}" data-f="${r.id}">${r.name} <span>${counts[r.id]}</span></button>`),
  ].join('');
}

function renderGallery() {
  renderFilters();
  const items = Object.values(state.collection);
  const sort = $('#sort').value;
  const list = items
    .filter((c) => filter === 'all' || c.rarity === filter)
    .sort((a, b) => {
      if (sort === 'rarity') return BY_ID[a.rarity].rank - BY_ID[b.rarity].rank || b.at - a.at;
      if (sort === 'artist') return a.art.artist.localeCompare(b.art.artist, 'fr');
      return b.at - a.at;
    });

  const total = items.length;
  const copies = items.reduce((s, c) => s + c.count, 0);
  $('#progress').textContent = total
    ? `${total} œuvre${total > 1 ? 's' : ''} accrochée${total > 1 ? 's' : ''}, ${copies - total} doublon${copies - total > 1 ? 's' : ''} en réserve.`
    : 'Aucune œuvre accrochée pour l\'instant.';
  $('#empty').hidden = total > 0;
  $('#sellAll').disabled = copies === total;

  $('#hang').innerHTML = list.map((c) => `
    <button class="piece" type="button" data-key="${esc(c.art.key)}">
      ${frameHTML({ ...c.art, img: c.art.thumb }, c.rarity, { curtain: false, size: 'frame--small' })}
      <span class="plaque"><span class="plaque__artist">${esc(c.art.artist)}</span><cite>${esc(c.art.title)}</cite>${c.count > 1 ? `<span class="plaque__count">×${c.count}</span>` : ''}</span>
    </button>`).join('');
}

function openDetail(key) {
  const c = state.collection[key];
  if (!c) return;
  const r = BY_ID[c.rarity];
  $('#detailBody').innerHTML = `
    <div class="detail__art">${frameHTML(c.art, c.rarity, { curtain: false })}</div>
    <div class="detail__text cartel cartel--large">
      ${cartelHTML(c.art, c.rarity, c.count)}
      ${c.art.origin ? `<p class="cartel__meta">${esc(c.art.origin)}</p>` : ''}
      <p class="cartel__meta">Accrochée le ${new Date(c.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <div class="detail__actions">
        ${c.art.link ? `<a class="btn btn--small" href="${esc(c.art.link)}" target="_blank" rel="noopener">Voir la notice du musée</a>` : ''}
        ${c.count > 1 ? `<button class="btn btn--gold btn--small" type="button" id="sellOne">Vendre un doublon pour ${r.sell} napoléons</button>` : ''}
      </div>
    </div>`;
  $('#sellOne')?.addEventListener('click', () => {
    c.count -= 1;
    state.coins += r.sell;
    save();
    renderCoins();
    renderGallery();
    toast(`Doublon vendu : ${r.sell} napoléons ajoutés.`);
    openDetail(key);
  });
  const dlg = $('#detailDialog');
  if (!dlg.open) dlg.showModal();
}

function sellAll() {
  let gain = 0;
  Object.values(state.collection).forEach((c) => {
    if (c.count > 1) {
      gain += (c.count - 1) * BY_ID[c.rarity].sell;
      c.count = 1;
    }
  });
  if (!gain) return;
  state.coins += gain;
  save();
  renderCoins();
  renderGallery();
  toast(`Doublons vendus : ${fmt(gain)} napoléons ajoutés.`);
}

/* ---------- Taux ---------- */

function renderRates() {
  const sample = { img: '', ratio: 1 };
  $('#ratesList').innerHTML = RARITIES.map((r) => `
    <li class="rate">
      <div class="frame frame--${r.id} frame--swatch"><div class="frame__inner" style="aspect-ratio:${sample.ratio}"></div></div>
      <div class="rate__text">
        <h3>${r.name}</h3>
        <p class="rate__frame">${r.frame}</p>
        <p>${r.room}</p>
      </div>
      <p class="rate__odds"><strong>${String(r.rate).replace('.', ',')} %</strong><span>revente ${r.sell} N</span></p>
    </li>`).join('');
}

/* ---------- Démarrage ---------- */

if (state.lastDaily !== today()) {
  state.lastDaily = today();
  state.coins += DAILY;
  save();
  setTimeout(() => toast(`Allocation du jour : ${DAILY} napoléons ajoutés.`), 600);
}

$('#pull1').addEventListener('click', pullOne);
$('#pull10').addEventListener('click', pullTen);
$('#revealAll').addEventListener('click', () => [...$('#tenGrid').children].forEach((s, i) => setTimeout(() => revealSlot(s), reduced ? 0 : i * 140)));
$('#closeTen').addEventListener('click', () => $('#tenDialog').close());
$('#closeDetail').addEventListener('click', () => $('#detailDialog').close());
$('#detailDialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  filter = b.dataset.f;
  renderGallery();
});
$('#sort').addEventListener('change', renderGallery);
$('#sellAll').addEventListener('click', sellAll);
$('#hang').addEventListener('click', (e) => {
  const p = e.target.closest('.piece');
  if (p) openDetail(p.dataset.key);
});
$('#tenDialog').addEventListener('cancel', (e) => { if (busy) e.preventDefault(); });

renderRates();
renderGallery();
renderCoins();
