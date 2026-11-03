// Accès aux API ouvertes des musées. Chaque fonction renvoie une œuvre normalisée :
// { key, title, artist, date, medium, origin, museum, img, thumb, link }

const MET = 'https://collectionapi.metmuseum.org/public/collection/v1';
const AIC = 'https://api.artic.edu/api/v1/artworks';
const CMA = 'https://openaccess-api.clevelandart.org/api/artworks/';

const AIC_FIELDS = 'id,title,artist_title,date_display,image_id,medium_display,place_of_origin,is_public_domain';

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];

async function getJSON(url, timeout = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Mémoire des réserves déjà chargées, pour éviter de rappeler les API à chaque tirage.
const pools = new Map();
const recent = new Set();

function takeFrom(poolKey) {
  const pool = pools.get(poolKey);
  if (!pool || !pool.length) return null;
  const i = rand(pool.length);
  const [item] = pool.splice(i, 1);
  return item;
}

/* ---------- Metropolitan Museum of Art ---------- */

async function metIds(query) {
  if (!pools.has(query)) {
    const data = await getJSON(`${MET}/search?${query}`);
    pools.set(query, (data.objectIDs || []).slice());
  }
  return pools.get(query);
}

async function fromMet(query) {
  const ids = await metIds(query);
  for (let attempt = 0; attempt < 6 && ids.length; attempt++) {
    const id = ids.splice(rand(ids.length), 1)[0];
    try {
      const o = await getJSON(`${MET}/objects/${id}`);
      if (!o.primaryImageSmall || !o.isPublicDomain) continue;
      return {
        key: `met:${o.objectID}`,
        title: o.title || 'Sans titre',
        artist: o.artistDisplayName || o.culture || 'Artiste inconnu',
        date: o.objectDate || '',
        medium: o.medium || '',
        origin: [o.city, o.country].filter(Boolean).join(', ') || o.culture || '',
        museum: 'The Metropolitan Museum of Art, New York',
        img: o.primaryImage || o.primaryImageSmall,
        thumb: o.primaryImageSmall,
        link: o.objectURL,
      };
    } catch { /* objet indisponible, on en tente un autre */ }
  }
  throw new Error('Met: aucune œuvre exploitable');
}

/* ---------- Art Institute of Chicago ---------- */

function aicArt(a) {
  const iiif = `https://www.artic.edu/iiif/2/${a.image_id}/full`;
  return {
    key: `aic:${a.id}`,
    title: a.title || 'Sans titre',
    artist: a.artist_title || 'Artiste inconnu',
    date: a.date_display || '',
    medium: a.medium_display || '',
    origin: a.place_of_origin || '',
    museum: 'Art Institute of Chicago',
    img: `${iiif}/843,/0/default.jpg`,
    thumb: `${iiif}/400,/0/default.jpg`,
    link: `https://www.artic.edu/artworks/${a.id}`,
  };
}

async function fillAic(poolKey, must, maxPage) {
  const page = 1 + rand(maxPage);
  const params = {
    query: { bool: { must } },
    fields: AIC_FIELDS.split(','),
    limit: 100,
    page,
  };
  let data;
  try {
    data = await getJSON(`${AIC}/search?params=${encodeURIComponent(JSON.stringify(params))}`);
    if (!data.data?.length && page > 1) {
      params.page = 1;
      data = await getJSON(`${AIC}/search?params=${encodeURIComponent(JSON.stringify(params))}`);
    }
  } catch {
    // Repli : liste simple, filtrée côté client.
    data = await getJSON(`${AIC}?page=${1 + rand(80)}&limit=100&fields=${AIC_FIELDS}`);
  }
  const items = (data.data || []).filter((a) => a.image_id && a.is_public_domain !== false);
  pools.set(poolKey, items.map(aicArt));
}

async function fromAic(poolKey, must, maxPage) {
  let art = takeFrom(poolKey);
  if (!art) {
    await fillAic(poolKey, must, maxPage);
    art = takeFrom(poolKey);
  }
  if (!art) throw new Error('AIC: réserve vide');
  return art;
}

/* ---------- Cleveland Museum of Art ---------- */

async function fromCma() {
  let art = takeFrom('cma');
  if (!art) {
    const fields = 'id,title,creators,creation_date,images,technique,culture,url';
    const data = await getJSON(`${CMA}?cc0=1&has_image=1&limit=100&skip=${rand(30000)}&fields=${fields}`);
    const items = (data.data || []).filter((a) => a.images?.web?.url);
    pools.set('cma', items.map((a) => ({
      key: `cma:${a.id}`,
      title: a.title || 'Sans titre',
      artist: a.creators?.[0]?.description?.replace(/\s*\(.*\)\s*$/, '') || a.culture?.[0] || 'Artiste inconnu',
      date: a.creation_date || '',
      medium: a.technique || '',
      origin: a.culture?.[0] || '',
      museum: 'Cleveland Museum of Art',
      img: a.images.web.url,
      thumb: a.images.web.url,
      link: a.url,
    })));
    art = takeFrom('cma');
  }
  if (!art) throw new Error('CMA: réserve vide');
  return art;
}

/* ---------- Rareté → salle du musée ---------- */

const AIC_PD = [{ term: { is_public_domain: true } }, { exists: { field: 'image_id' } }];

const SOURCES = {
  // Chefs-d'œuvre de la peinture européenne du Met (Vermeer, Rembrandt, Van Gogh…)
  imperial: () => fromMet('isHighlight=true&departmentId=11&hasImages=true&q=*'),
  // Peintures mises en avant par l'Art Institute de Chicago
  legendaire: () => fromAic('aic-boosted', [...AIC_PD, { term: { is_boosted: true } }, { term: { artwork_type_id: 1 } }], 3),
  // Pièces phares du Met, tous départements
  epique: () => fromMet('isHighlight=true&hasImages=true&q=*'),
  // Collection permanente de l'Art Institute
  rare: () => fromAic('aic-pd', [...AIC_PD, { term: { is_boosted: false } }], 10),
  // Réserves en accès libre du Cleveland Museum of Art
  commune: () => fromCma(),
};

const FALLBACK = {
  imperial: 'legendaire',
  legendaire: 'epique',
  epique: 'rare',
  rare: 'commune',
  commune: 'rare',
};

function preload(src, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const t = setTimeout(() => reject(new Error('image trop lente')), timeout);
    img.onload = () => { clearTimeout(t); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => { clearTimeout(t); reject(new Error('image introuvable')); };
    img.referrerPolicy = 'no-referrer';
    img.src = src;
  });
}

// Tire une œuvre de la rareté demandée et précharge son image.
// En cas d'échec d'une API, on retente puis on se replie sur une autre salle,
// tout en conservant la rareté tirée (le cadre reste le même).
export async function drawArtwork(rarity) {
  let source = rarity;
  const tried = new Set();
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const art = await SOURCES[source]();
      if (recent.has(art.key) && attempt < 4) continue;
      const size = await preload(art.img).catch(() => preload(art.thumb));
      recent.add(art.key);
      return { ...art, ratio: size.w / size.h };
    } catch (err) {
      console.warn(`[${source}]`, err.message);
      if (attempt % 2 === 1) {
        tried.add(source);
        const next = FALLBACK[source];
        source = tried.has(next) ? pick(Object.keys(SOURCES)) : next;
      }
    }
  }
  throw new Error('Les musées ne répondent pas');
}
