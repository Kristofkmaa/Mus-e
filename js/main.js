(() => {
  'use strict';

  /* ---------- Règles ---------- */

  const RARITIES = [
    { id: 'imperial',   name: 'Impériale',  frame: 'Vermeil', rate: 1.5,  sell: 500, stamp: 'IMPÉRIALE !!!', desc: 'Le Cri, la Liberté guidant le peuple, la Création d\'Adam.' },
    { id: 'legendaire', name: 'Légendaire', frame: 'Or',      rate: 5,    sell: 150, stamp: 'LÉGENDAIRE !', desc: 'Vénus et Mars, la Donna Velata, le Joueur de luth.' },
    { id: 'epique',     name: 'Épique',     frame: 'Argent',  rate: 13.5, sell: 50,  stamp: 'Épique',       desc: 'Grands tableaux de maîtres, de Titien à Malevitch.' },
    { id: 'rare',       name: 'Rare',       frame: 'Bronze',  rate: 30,   sell: 15,  stamp: '',             desc: 'Œuvres reconnues des collections permanentes.' },
    { id: 'commune',    name: 'Commune',    frame: 'Bois',    rate: 50,   sell: 5,   stamp: '',             desc: 'Études, esquisses et toiles moins connues.' },
  ];
  const BY_ID = Object.fromEntries(RARITIES.map((r, i) => [r.id, { ...r, rank: i }]));
  const PRICE = 100, PRICE_TEN = 1000, DAILY = 500, START = 1600, PITY = 60;

  /* ---------- État ---------- */

  const STORE = 'musee.v3';
  const today = () => new Date().toISOString().slice(0, 10);
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE));
      if (s && typeof s.coins === 'number') return s;
    } catch { /* stockage indisponible */ }
    return { coins: START, lastDaily: today(), streak: 0, pity: 0, pulls: 0, collection: {}, seen: {} };
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
  const buzz = (p) => { try { navigator.vibrate?.(p); } catch { /* non supporté */ } };
  const color = (r) => getComputedStyle(document.documentElement).getPropertyValue(`--c-${r}`).trim();

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
  }

  /* ---------- Confettis ---------- */

  const fx = $('#fx'), ctx = fx.getContext('2d');
  let parts = [], raf = 0;
  function resize() { fx.width = innerWidth * devicePixelRatio; fx.height = innerHeight * devicePixelRatio; }
  addEventListener('resize', resize); resize();
  function confetti(n, colors, { x = 0.5, y = 0.45, power = 1 } = {}) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (4 + Math.random() * 9) * power;
      parts.push({ x: x * innerWidth, y: y * innerHeight, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4 * power, g: 0.25, life: 70 + Math.random() * 50,
        c: colors[Math.floor(Math.random() * colors.length)], s: 4 + Math.random() * 6, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3 });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.98; p.r += p.vr; p.life -= 1;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, p.life / 30);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(tick) : 0;
  }
  const flash = document.createElement('div'); flash.className = 'flash'; document.body.append(flash);
  function flashScreen() { flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on'); }

  /* ---------- Catalogue ---------- */

  let ART = [], BY_KEY = {};
  async function loadCatalogue() {
    ART = window.MUSEE_CATALOGUE || await (await fetch('art/catalogue.json')).json();
    BY_KEY = Object.fromEntries(ART.map((a) => [a.key, a]));
  }
  const preload = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image')); i.src = src; });
  async function drawArtwork(rarity) {
    const pool = ART.filter((a) => a.r === rarity);
    const missing = pool.filter((a) => !state.collection[a.key]);
    const from = missing.length && Math.random() < 0.7 ? missing : pool;
    const a = from[Math.floor(Math.random() * from.length)];
    await preload(imgSrc(a));
    return a;
  }

  /* ---------- Économie ---------- */

  let busy = false, shownCoins = state.coins;
  function renderCoins() {
    const el = $('#coins');
    if (shownCoins !== state.coins) {
      const from = shownCoins, to = state.coins, t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 500); shownCoins = Math.round(from + (to - from) * k); el.textContent = fmt(shownCoins); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
      if (to > from) { $('#wallet').classList.remove('is-bump'); void $('#wallet').offsetWidth; $('#wallet').classList.add('is-bump'); }
    } else el.textContent = fmt(state.coins);
    $('#pull1').disabled = busy || state.coins < PRICE;
    $('#pull10').disabled = busy || state.coins < PRICE_TEN;
    const left = PITY - state.pity;
    $('#pityFill').style.width = `${(state.pity / (PITY - 1)) * 100}%`;
    $('#pityText').textContent = left === 1 ? 'Prochaine ouverture : cadre doré garanti' : `Cadre doré garanti dans ${left} ouvertures`;
    const st = $('#streak'); st.hidden = state.streak < 2; st.textContent = `🔥 ${state.streak} jours`;
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
  // Ajoute l'œuvre ; un doublon est revendu sur-le-champ. Renvoie { isNew, refund, count }.
  function collect(a) {
    const c = state.collection[a.key];
    if (c) { c.count += 1; const refund = BY_ID[a.r].sell; state.coins += refund; return { isNew: false, refund, count: c.count }; }
    state.collection[a.key] = { count: 1, at: Date.now() };
    state.seen[a.key] = false;
    return { isNew: true, refund: 0, count: 1 };
  }

  /* ---------- Cadres et cartels ---------- */

  function frameHTML(a, cls = '', live = false) {
    if (a.model && live) {
      return `<div class="frame frame--${a.r} frame--vitrine ${cls}" style="--ar:1"><model-viewer data-model="${esc(a.model)}" poster="${imgSrc(a)}" alt="${esc(a.title)}, ${esc(a.artist)}" camera-controls auto-rotate auto-rotate-delay="0" rotation-per-second="40deg" shadow-intensity="1" exposure="1.1" interaction-prompt="none" touch-action="pan-y"></model-viewer></div>`;
    }
    return `<div class="frame frame--${a.r} ${cls}" style="--ar:${a.ratio}"><img src="${imgSrc(a)}" alt="${esc(a.title)}, ${esc(a.artist)}" loading="lazy" decoding="async"></div>`;
  }
  // Donne sa source à chaque vitrine. Un modèle publié en base64 (.txt) devient un blob.
  const modelUrls = {};
  async function modelUrl(path) {
    if (!path.endsWith('.txt')) return path;
    if (!modelUrls[path]) modelUrls[path] = fetch(path).then((r) => r.text()).then((b64) => {
      const bin = atob(b64.trim()), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' }));
    });
    return modelUrls[path];
  }
  function hydrateViewers(root) {
    root.querySelectorAll('model-viewer[data-model]').forEach(async (mv) => { mv.src = await modelUrl(mv.dataset.model); });
  }
  // Les scans sont gris : on leur donne un marbre clair une fois chargés.
  document.addEventListener('load', (e) => {
    const mv = e.target;
    if (!mv.model) return;
    for (const m of mv.model.materials) { m.pbrMetallicRoughness.setBaseColorFactor([0.93, 0.9, 0.85, 1]); m.pbrMetallicRoughness.setMetallicFactor(0); m.pbrMetallicRoughness.setRoughnessFactor(0.55); }
  }, true);
  function cartelHTML(a, res) {
    const r = BY_ID[a.r];
    return `
      <div class="cartel">
        <p class="cartel__rarity r-${a.r}">${esc(r.name)}, ${a.model ? 'socle' : 'cadre'} ${esc(r.frame.toLowerCase())}</p>
        <p class="cartel__artist">${esc(a.artist)}</p>
        <p class="cartel__title"><cite>${esc(a.title)}</cite>${a.date ? `, ${esc(a.date)}` : ''}</p>
        <div class="cartel__tags">
          ${res.isNew ? '<span class="tag tag--new">Nouveau</span>' : `<span class="tag">Doublon ×${res.count}</span><span class="tag tag--gold">+${res.refund} N</span>`}
          <button class="tag" type="button" data-detail="${esc(a.key)}">Voir en grand</button>
        </div>
      </div>`;
  }

  /* ---------- Ouverture simple ---------- */

  async function pullOne() {
    if (busy || state.coins < PRICE) return;
    busy = true;
    state.coins -= PRICE; state.pulls += 1;
    const rarity = rollRarity();
    const rank = 4 - BY_ID[rarity].rank; // 0 commune … 4 impériale
    save(); renderCoins();

    const stage = $('#stage'), crate = $('#crate'), reveal = $('#reveal'), stamp = $('#stamp');
    reveal.hidden = true; reveal.innerHTML = '';
    stamp.textContent = ''; stamp.classList.remove('is-on');
    crate.hidden = false; crate.classList.remove('is-burst');
    stage.style.setProperty('--glow', color(rarity));
    const shake = 900 + rank * 350;
    crate.style.setProperty('--shake', `${shake}ms`);
    crate.classList.add('is-shaking');
    buzz(rank >= 3 ? [60, 40, 60, 40, 120] : 40);
    setTimeout(() => stage.classList.add('is-glowing'), shake * 0.4);

    try {
      const [a] = await Promise.all([drawArtwork(rarity), wait(shake)]);
      const res = collect(a);
      save();
      crate.classList.remove('is-shaking'); crate.classList.add('is-burst');
      await wait(250);
      crate.hidden = true;
      reveal.innerHTML = frameHTML(a, '', true) + (a.model ? '<p class="vitrine__hint">Sculpture en 3D, fais-la tourner</p>' : '') + cartelHTML(a, res);
      reveal.hidden = false;
      hydrateViewers(reveal);
      const c = color(rarity);
      confetti(30 + rank * 40, [c, '#fff4e0', rank >= 3 ? '#ffd75e' : c], { power: 1 + rank * 0.3 });
      if (rank >= 2) { stamp.textContent = BY_ID[rarity].stamp; stamp.className = `stamp is-on r-${rarity}`; }
      if (rank >= 3) { flashScreen(); buzz([80, 60, 200]); setTimeout(() => confetti(120, ['#ffd75e', '#ff4d7a', '#7df9ff', '#fff'], { y: 0.3, power: 1.6 }), 300); }
      renderAll();
    } catch {
      state.coins += PRICE; save();
      crate.classList.remove('is-shaking');
      toast('L\'œuvre n\'a pas pu être chargée, 100 napoléons rendus.');
    } finally {
      busy = false; renderCoins();
      setTimeout(() => stage.classList.remove('is-glowing'), 1500);
    }
  }

  /* ---------- Dix caisses ---------- */

  async function pullTen() {
    if (busy || state.coins < PRICE_TEN) return;
    busy = true;
    state.coins -= PRICE_TEN; state.pulls += 10;
    const rarities = Array.from({ length: 10 }, () => rollRarity());
    if (!rarities.some((r) => BY_ID[r].rank <= 2)) rarities[9] = rollRarity(2);
    save(); renderCoins();

    const dlg = $('#tenDialog'), grid = $('#tenGrid');
    $('#tenSum').textContent = 'Retourne les cartes.';
    $('#closeTen').disabled = true; $('#flipAll').disabled = true;
    grid.innerHTML = rarities.map(() => `<button class="tcard" type="button" disabled><div class="tcard__in"><div class="tcard__face tcard__back">M</div><div class="tcard__face tcard__front"></div></div></button>`).join('');
    dlg.showModal();

    const results = await Promise.all(rarities.map((r) => drawArtwork(r).catch(() => null)));
    results.sort((x, y) => (y ? BY_ID[y.r].rank : 9) - (x ? BY_ID[x.r].rank : 9)); // la plus rare en dernier
    let failed = 0, gained = 0, news = 0;
    results.forEach((a, i) => {
      const card = grid.children[i];
      if (!a) { failed += 1; card.querySelector('.tcard__front').innerHTML = '<p class="ten__fail">Indisponible, 100 N rendus.</p>'; }
      else {
        const res = collect(a);
        gained += res.refund; if (res.isNew) news += 1;
        card.dataset.r = a.r; card.classList.toggle('is-new', res.isNew);
        card.querySelector('.tcard__front').innerHTML = `${frameHTML(a, 'frame--small')}<div class="tcard__cap"><b>${esc(a.artist)}</b>${esc(a.title)}</div>`;
      }
      card.disabled = false; card.classList.add('is-ready');
      card.addEventListener('click', () => flipCard(card), { once: true });
    });
    state.coins += failed * PRICE;
    save();
    $('#flipAll').disabled = false;
    $('#tenSum').textContent = `${news} nouvelle${news > 1 ? 's' : ''} œuvre${news > 1 ? 's' : ''}${gained ? `, doublons revendus +${gained} N` : ''}.`;
    renderAll();
    busy = false;
    const done = () => { if ([...grid.children].every((c) => c.classList.contains('is-flipped'))) { $('#closeTen').disabled = false; renderCoins(); } };
    grid.addEventListener('flipped', done);
  }
  function flipCard(card) {
    if (card.classList.contains('is-flipped')) return;
    card.classList.add('is-flipped'); card.classList.remove('is-ready');
    const r = card.dataset.r;
    if (r) {
      const rank = 4 - BY_ID[r].rank;
      const b = card.getBoundingClientRect();
      if (rank >= 1) confetti(10 + rank * 25, [color(r), '#fff4e0'], { x: (b.left + b.width / 2) / innerWidth, y: (b.top + b.height / 2) / innerHeight, power: 0.6 + rank * 0.25 });
      if (rank >= 3) { flashScreen(); buzz([60, 40, 120]); } else buzz(20);
    }
    card.dispatchEvent(new Event('flipped', { bubbles: true }));
  }
  async function flipAll() {
    $('#flipAll').disabled = true;
    for (const card of [...$('#tenGrid').children]) { if (!card.classList.contains('is-flipped')) { flipCard(card); await wait(260); } }
  }

  /* ---------- Galerie ---------- */

  let filter = 'all';
  function owned() { return Object.entries(state.collection).filter(([k]) => BY_KEY[k]).map(([k, c]) => ({ ...c, art: BY_KEY[k] })); }
  function renderGallery() {
    const all = owned();
    const counts = Object.fromEntries(RARITIES.map((r) => [r.id, 0]));
    all.forEach((c) => { counts[c.art.r] += 1; });
    $('#filters').innerHTML = [
      `<button type="button" class="chip" aria-pressed="${filter === 'all'}" data-f="all">Toutes<span>${all.length}</span></button>`,
      ...RARITIES.map((r) => `<button type="button" class="chip" aria-pressed="${filter === r.id}" data-f="${r.id}">${r.name}<span>${counts[r.id]}</span></button>`),
      `<button type="button" class="chip" aria-pressed="${filter === 'sculpture'}" data-f="sculpture">Sculptures<span>${all.filter((c) => c.art.model).length}</span></button>`,
    ].join('');
    const list = all.filter((c) => filter === 'all' || c.art.r === filter || (filter === 'sculpture' && c.art.model)).sort((x, y) => y.at - x.at);
    $('#progressText').textContent = `${all.length} / ${ART.length}`;
    $('#progressFill').style.width = `${(all.length / ART.length) * 100}%`;
    $('#empty').hidden = all.length > 0;
    const fresh = Object.values(state.seen).filter((v) => v === false).length;
    const badge = $('#newBadge'); badge.hidden = !fresh; badge.textContent = fresh;
    $('#hang').innerHTML = list.map((c) => `
      <button class="piece ${state.seen[c.art.key] === false ? 'is-new' : ''}" type="button" data-detail="${esc(c.art.key)}">
        <span style="position:relative;display:block">${frameHTML(c.art, 'frame--small')}${c.count > 1 ? `<span class="piece__count">×${c.count}</span>` : ''}</span>
        <span class="piece__cap"><span class="piece__artist">${esc(c.art.artist)}</span><span class="piece__title"><cite>${esc(c.art.title)}</cite></span></span>
      </button>`).join('');
  }
  function markSeen() {
    let changed = false;
    for (const k in state.seen) if (state.seen[k] === false) { state.seen[k] = true; changed = true; }
    if (changed) { save(); $('#newBadge').hidden = true; }
  }

  function openDetail(key) {
    const a = BY_KEY[key], c = state.collection[key];
    if (!a) return;
    const r = BY_ID[a.r];
    $('#detailBody').innerHTML = `
      <div class="detail__art">${frameHTML(a, '', true)}</div>
      <div class="detail__text">
        <p class="cartel__rarity r-${a.r}">${esc(r.name)}, ${a.model ? 'socle' : 'cadre'} ${esc(r.frame.toLowerCase())}</p>
        <p class="cartel__artist">${esc(a.artist)}</p>
        <p class="cartel__title"><cite>${esc(a.title)}</cite>${a.date ? `, ${esc(a.date)}` : ''}</p>
        <div class="detail__meta">
          ${a.medium ? `<p>${esc(a.medium)}</p>` : ''}${a.museum ? `<p>${esc(a.museum)}</p>` : ''}
          <p>Inventaire nº ${String(a.inv).padStart(3, '0')}${c ? `, accrochée le ${new Date(c.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''}${c && c.count > 1 ? `, ${c.count} exemplaires` : ''}</p>
        </div>
        <div class="detail__actions"><button class="btn btn--small" type="button" id="closeDetail">Fermer</button></div>
      </div>`;
    hydrateViewers($('#detailBody'));
    $('#closeDetail').addEventListener('click', () => $('#detailDialog').close());
    const dlg = $('#detailDialog');
    if (!dlg.open) dlg.showModal();
  }

  /* ---------- Collection ---------- */

  function renderCollection() {
    const have = (pred) => ART.filter((a) => pred(a) && state.collection[a.key]).length;
    $('#salles').innerHTML = RARITIES.map((r) => {
      const total = ART.filter((a) => a.r === r.id).length, n = have((a) => a.r === r.id);
      const sample = ART.find((a) => a.r === r.id && state.collection[a.key]) || ART.find((a) => a.r === r.id);
      return `<li class="salle">
        ${frameHTML(sample, 'frame--small')}
        <div><div class="salle__name r-${r.id}">${r.name}, cadre ${r.frame.toLowerCase()}</div><div class="salle__meta">${r.desc} ${n} / ${total}</div>
          <div class="salle__bar r-${r.id}"><i style="width:${(n / total) * 100}%"></i></div></div>
        <div class="salle__odds">${String(r.rate).replace('.', ',')} %<small>doublon +${r.sell} N</small></div>
      </li>`;
    }).join('');
    const artists = [...new Set(ART.map((a) => a.artist))].map((name) => {
      const total = ART.filter((a) => a.artist === name).length, n = have((a) => a.artist === name);
      return { name, total, n };
    }).sort((x, y) => y.n / y.total - x.n / x.total || x.name.localeCompare(y.name, 'fr'));
    $('#artists').innerHTML = artists.map((x) => `<li class="artist ${x.n === x.total ? 'is-done' : ''}"><b>${esc(x.name)}</b><span>${x.n} / ${x.total}${x.n === x.total ? ' ✓' : ''}</span><div class="salle__bar" style="color:var(--gold)"><i style="width:${(x.n / x.total) * 100}%"></i></div></li>`).join('');
  }
  function renderAll() { renderGallery(); renderCollection(); }

  /* ---------- Onglets ---------- */

  function showTab(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('is-active', v.id === `view-${name}`));
    document.querySelectorAll('.tab').forEach((t) => { const on = t.dataset.tab === name; t.classList.toggle('is-active', on); t.setAttribute('aria-pressed', on); });
    if (name === 'galerie') markSeen();
    scrollTo({ top: 0 });
  }

  /* ---------- Démarrage ---------- */

  async function start() {
    await loadCatalogue();
    if (state.lastDaily !== today()) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      state.streak = state.lastDaily === y.toISOString().slice(0, 10) ? (state.streak || 0) + 1 : 1;
      state.lastDaily = today(); state.coins += DAILY; save();
      setTimeout(() => { toast(`Cadeau du jour : +${DAILY} napoléons`); confetti(60, ['#ffd75e', '#fff4e0'], { y: 0.15 }); }, 700);
    } else if (!state.streak) state.streak = 1;
    $('#pull1').addEventListener('click', pullOne);
    $('#pull10').addEventListener('click', pullTen);
    $('#flipAll').addEventListener('click', flipAll);
    $('#closeTen').addEventListener('click', () => $('#tenDialog').close());
    $('#tenDialog').addEventListener('cancel', (e) => e.preventDefault());
    $('#detailDialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
    $('#filters').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; renderGallery(); } });
    $('#wallet').addEventListener('click', () => toast(`${fmt(state.coins)} napoléons. +${DAILY} chaque jour.`));
    document.addEventListener('click', (e) => {
      const d = e.target.closest('[data-detail]'); if (d) return openDetail(d.dataset.detail);
      const t = e.target.closest('[data-tab]'); if (t) showTab(t.dataset.tab);
    });
    shownCoins = state.coins;
    renderAll(); renderCoins();
  }
  start().catch(() => toast('Le catalogue n\'a pas pu être chargé. Recharge la page.'));
})();
