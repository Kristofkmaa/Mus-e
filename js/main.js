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

  /* ---------- Sons synthétisés ---------- */

  let actx = null;
  const soundOn = () => state.sound !== false;
  function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } if (actx.state === 'suspended') actx.resume(); return actx; }
  function whoosh(dur = 0.6, vol = 0.5) {
    const ac = soundOn() && audio(); if (!ac) return;
    const n = ac.sampleRate * dur, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.5);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(300, ac.currentTime); f.frequency.exponentialRampToValueAtTime(2400, ac.currentTime + dur * 0.5);
    const g = ac.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(ac.destination); src.start();
  }
  function thud(vol = 0.7) {
    const ac = soundOn() && audio(); if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(140, ac.currentTime); o.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.35);
    g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.45);
  }
  function chime(rank) {
    const ac = soundOn() && audio(); if (!ac) return;
    const notes = rank >= 4 ? [523, 659, 784, 1047, 1319, 1568] : rank >= 3 ? [523, 659, 784, 1047] : [659, 988];
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = f;
      const t = ac.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 1);
    });
  }
  function tick2(level) { // battement pendant la tension
    const ac = soundOn() && audio(); if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = 90 + level * 60;
    g.gain.setValueAtTime(0.08, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.1);
  }

  /* ---------- Drap de velours simulé ---------- */

  class Cloth {
    constructor(canvas) {
      this.c = canvas; this.ctx = canvas.getContext('2d');
      this.cols = 36; this.rows = 46; this.pts = []; this.mode = 'idle'; this.t = 0; this.tense = 0; this.raf = 0; this.alive = false;
      this.leakColor = '#ffd75e';
      // grain du velours, dessiné une fois
      const g = document.createElement('canvas'); g.width = g.height = 96; const gc = g.getContext('2d'); const im = gc.createImageData(96, 96);
      for (let i = 0; i < im.data.length; i += 4) { const v = 110 + Math.random() * 70; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      gc.putImageData(im, 0, 0); this.grain = this.ctx.createPattern(g, 'repeat');
    }
    reset() {
      const r = this.c.getBoundingClientRect(), fr = this.c.parentElement.getBoundingClientRect();
      this.w = r.width; this.h = r.height; this.c.width = this.w * devicePixelRatio; this.c.height = this.h * devicePixelRatio;
      // Le drap épouse le cadre réel (mesuré), avec un débord fixe.
      this.fx0 = fr.left - r.left; this.fx1 = fr.right - r.left; const fy0 = fr.top - r.top; this.fy1 = fr.bottom - r.top;
      const x0 = this.fx0 - 14, x1 = this.fx1 + 14, y0 = fy0 - 16, y1 = this.fy1 + 22;
      this.rows = Math.max(24, Math.min(60, Math.round((y1 - y0) / 11)));
      this.sx = (x1 - x0) / (this.cols - 1); this.sy = (y1 - y0) / (this.rows - 1);
      this.pts = [];
      for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) {
        const x = x0 + i * this.sx, y = y0 + j * this.sy;
        const zr = ((Math.sin(i * 0.95) + 1) * 7 + Math.sin(i * 2.3) * 2.5) * Math.min(1, j / 3) + Math.sin(j * 0.5) * 1.5;
        this.pts.push({ x, y, z: zr, zr, px: x, py: y, pz: zr, pin: j === 0, x0: x, y0: y });
      }
      for (let k = 0; k < 40; k++) this.step(0.016); // laisse le tissu se poser avant le premier rendu
      {
      }
      this.mode = 'idle'; this.t = 0; this.tense = 0; this.gust = 0; this.alive = true; this.fade = 1; this.dropT = 0;
      if (!this.raf) this.raf = requestAnimationFrame((ts) => this.loop(ts));
    }
    at(i, j) { return this.pts[j * this.cols + i]; }
    step(dt) {
      const drop = this.mode === 'drop';
      const g = drop ? (this.dropT < 0.3 ? -2.2 : 1.6) : 0.3, k = drop ? 0.995 : 0.96;
      this.t += dt;
      for (const p of this.pts) {
        if (p.pin) continue;
        const vx = (p.x - p.px) * k, vy = (p.y - p.py) * k, vz = (p.z - p.pz) * k;
        p.px = p.x; p.py = p.y; p.pz = p.z;
        const wave = Math.sin(this.t * 1.4 + p.y * 0.02) * 0.35 + Math.sin(this.t * 2.3 + p.x * 0.03) * 0.25;
        let fx = wave * 0.06, fz = wave * 0.3;
        if (this.mode === 'tense') {
          const a = this.tense;
          fx += Math.sin(this.t * (16 + a * 24) + p.y * 0.05) * a * 1.5;
          fz += (Math.sin(this.t * 22 + p.x * 0.07) + 0.8) * a * 1.6 + Math.sin(this.t * 6) * a * 0.8;
        }
        if (drop) { fx += this.gust * 1.1 + (Math.random() - 0.5) * 1.4; fz += Math.sin(this.t * 9 + p.y * 0.04) * 3 + 1.5; }
        p.x += vx + fx; p.y += vy + g; p.z += vz + fz;
        if (p.z < 0) { p.z = 0; p.pz = 0; }                       // le cadre est derrière
        if (!drop) { p.z += (p.zr - p.z) * 0.07; if (p.z > 36) p.z = 36; p.x += (p.x0 - p.x) * 0.03; }
      }
      for (let it = 0; it < (drop ? 3 : 6); it++) {
        for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) {
          const p = this.at(i, j);
          if (i < this.cols - 1) this.link(p, this.at(i + 1, j), this.sx);
          if (j < this.rows - 1) this.link(p, this.at(i, j + 1), this.sy);
          if (i < this.cols - 1 && j < this.rows - 1) this.link(p, this.at(i + 1, j + 1), Math.hypot(this.sx, this.sy), 0.35);
          if (i < this.cols - 2) this.link(p, this.at(i + 2, j), this.sx * 2, 0.2);   // raideur contre le froissement
        }
      }
      if (!drop) { // le tissu ne peut pas s'étirer au-delà de sa longueur : chaque rangée reste sous sa tringle
        for (let j = 1; j < this.rows; j++) for (let i = 0; i < this.cols; i++) { const p = this.at(i, j), lim = this.at(i, 0).y + j * this.sy * 1.02; if (p.y > lim) { p.y = lim; p.py = Math.min(p.py, lim); } }
      }
      if (this.mode === 'tense') {
        const a = this.tense, s = Math.sin(this.t * 40) * a * 7, s2 = Math.cos(this.t * 31) * a * 3;
        for (let i = 0; i < this.cols; i++) { const p = this.at(i, 0); p.x = p.x0 + s + Math.sin(i * 0.8 + this.t * 20) * a * 2; p.y = p.y0 + s2; }
      }
      if (drop) this.gust *= 0.965;
    }
    link(a, b, rest, stiff = 1) {
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1, diff = (d - rest) / d * 0.5 * stiff;
      if (!a.pin) { a.x += dx * diff; a.y += dy * diff; a.z += dz * diff; }
      if (!b.pin) { b.x -= dx * diff; b.y -= dy * diff; b.z -= dz * diff; }
    }
    // fausse perspective : ce qui bombe vers nous paraît un peu plus grand
    sx_(p) { return this.w / 2 + (p.x - this.w / 2) * (1 + p.z / 900); }
    sy_(p) { return this.h / 2 + (p.y - this.h / 2) * (1 + p.z / 900); }
    outline(ctx, dx = 0, dy = 0) {
      ctx.beginPath();
      for (let i = 0; i < this.cols; i++) { const p = this.at(i, 0); i ? ctx.lineTo(this.sx_(p) + dx, this.sy_(p) + dy) : ctx.moveTo(this.sx_(p) + dx, this.sy_(p) + dy); }
      for (let j = 1; j < this.rows; j++) { const p = this.at(this.cols - 1, j); ctx.lineTo(this.sx_(p) + dx, this.sy_(p) + dy); }
      for (let i = this.cols - 1; i >= 0; i--) { const p = this.at(i, this.rows - 1); ctx.lineTo(this.sx_(p) + dx, this.sy_(p) + dy); }
      for (let j = this.rows - 2; j > 0; j--) { const p = this.at(0, j); ctx.lineTo(this.sx_(p) + dx, this.sy_(p) + dy); }
      ctx.closePath();
    }
    draw() {
      const ctx = this.ctx; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); ctx.clearRect(0, 0, this.w, this.h);
      // fuite de lumière de la rareté sous le bord, qui monte avec la tension
      if (this.mode === 'tense' && this.tense > 0.2) {
        const a = Math.min(1, (this.tense - 0.2) * 1.4), flick = 0.75 + Math.sin(this.t * 37) * 0.15 + Math.random() * 0.1;
        const cx = (this.fx0 + this.fx1) / 2, gr = ctx.createRadialGradient(cx, this.fy1, 10, cx, this.fy1, (this.fx1 - this.fx0) * 0.6);
        gr.addColorStop(0, this.leakColor); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = a * flick * 0.9; ctx.fillStyle = gr; ctx.fillRect(0, 0, this.w, this.h); ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = this.fade;
      // tringle dorée à embouts
      const top = this.at(0, 0), topR = this.at(this.cols - 1, 0), ry = Math.min(top.y, topR.y) - 7;
      if (this.mode !== 'drop') {
        const rod = ctx.createLinearGradient(0, ry - 4, 0, ry + 4); rod.addColorStop(0, '#fff0c0'); rod.addColorStop(0.5, '#d9a51f'); rod.addColorStop(1, '#8a6410');
        ctx.fillStyle = rod; ctx.fillRect(this.fx0 - 26, ry - 3.5, this.fx1 - this.fx0 + 52, 7);
        for (const x of [this.fx0 - 30, this.fx1 + 30]) { ctx.beginPath(); ctx.arc(x, ry, 7, 0, Math.PI * 2); ctx.fillStyle = '#e6b933'; ctx.fill(); ctx.beginPath(); ctx.arc(x - 2, ry - 2, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#fff6d0'; ctx.fill(); }
      }
      // ombre portée
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.filter = 'blur(6px)'; this.outline(ctx, 8, 16); ctx.fill(); ctx.restore();
      // velours : chaque maille éclairée selon sa normale
      for (let j = 0; j < this.rows - 1; j++) for (let i = 0; i < this.cols - 1; i++) {
        const a = this.at(i, j), b = this.at(i + 1, j), c = this.at(i + 1, j + 1), d = this.at(i, j + 1);
        const ux = c.x - a.x, uy = c.y - a.y, uz = c.z - a.z, vx = d.x - b.x, vy = d.y - b.y, vz = d.z - b.z;
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const n = Math.hypot(nx, ny, nz) || 1; nx /= n; ny /= n; nz /= n;
        const lit = Math.max(0, nx * -0.55 + ny * -0.3 + nz * 0.78);
        const rim = Math.pow(1 - Math.abs(nz), 2);                // le velours s'éclaircit sur les bords des plis
        const spec = Math.pow(Math.max(0, nx * -0.4 + ny * -0.5 + nz * 0.77), 24) * 0.35;
        const l = 0.2 + lit * 0.75 + rim * 0.5 + spec;
        const r = Math.min(255, 158 * l + rim * 70 + spec * 160), gg = Math.min(255, 14 * l + rim * 26 + spec * 90), bb = Math.min(255, 34 * l + rim * 44 + spec * 110);
        ctx.fillStyle = `rgb(${r | 0},${gg | 0},${bb | 0})`; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(this.sx_(a), this.sy_(a)); ctx.lineTo(this.sx_(b), this.sy_(b)); ctx.lineTo(this.sx_(c), this.sy_(c)); ctx.lineTo(this.sx_(d), this.sy_(d)); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // grain
      ctx.save(); this.outline(ctx); ctx.clip(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = this.fade * 0.28; ctx.fillStyle = this.grain; ctx.fillRect(0, 0, this.w, this.h); ctx.restore();
      ctx.globalAlpha = this.fade;
      // franges à pompons sous le bord
      const last = this.rows - 1;
      for (let i = 0; i < this.cols; i += 2) {
        const p = this.at(i, last), q = this.at(i, last - 1);
        const x = this.sx_(p), y = this.sy_(p), dx = (p.x - p.px) * 2.5 + (p.x - q.x) * 0.3, len = 16;
        ctx.strokeStyle = '#c9961c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + dx * 0.4, y + len * 0.6, x + dx, y + len); ctx.stroke();
        ctx.fillStyle = '#e6b933'; ctx.beginPath(); ctx.arc(x + dx, y + len + 3, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff0c0'; ctx.beginPath(); ctx.arc(x + dx - 1, y + len + 2, 1.1, 0, Math.PI * 2); ctx.fill();
      }
      // cordon doré le long du haut, et son gland au centre
      ctx.lineWidth = 3.5; ctx.strokeStyle = '#b8860b'; ctx.beginPath();
      for (let i = 0; i < this.cols; i++) { const p = this.at(i, 1); i ? ctx.lineTo(this.sx_(p), this.sy_(p)) : ctx.moveTo(this.sx_(p), this.sy_(p)); }
      ctx.stroke(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#ffe79a'; ctx.stroke();
      const m = this.at(this.cols >> 1, 1), mx = this.sx_(m), my = this.sy_(m), md = (m.x - m.px) * 3;
      ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, my); ctx.quadraticCurveTo(mx + md * 0.5, my + 14, mx + md, my + 26); ctx.stroke();
      ctx.fillStyle = '#e6b933'; ctx.beginPath(); ctx.ellipse(mx + md, my + 34, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff0c0'; ctx.beginPath(); ctx.arc(mx + md - 1.5, my + 30, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    loop(ts) {
      if (!this.alive) { this.raf = 0; return; }
      const dt = Math.min(0.05, (ts - (this.last || ts)) / 1000); this.last = ts;
      if (!reduced) { this.step(dt || 0.016); this.draw(); }
      else if (this.mode === 'drop') { this.alive = false; this.ctx.clearRect(0, 0, this.c.width, this.c.height); }
      else this.draw();
      if (this.mode === 'drop') { this.dropT += dt; if (this.dropT > 0.5) this.fade = Math.max(0, this.fade - dt * 0.8); if (this.fade <= 0) this.alive = false; }
      this.raf = requestAnimationFrame((t) => this.loop(t));
    }
    setTense(a) { this.mode = 'tense'; this.tense = a; }
    drop() {
      this.mode = 'drop'; this.gust = 7 + Math.random() * 3; this.dropT = 0;
      for (const p of this.pts) { if (p.pin) { p.pin = false; p.px = p.x + (Math.random() - 0.5) * 4; p.py = p.y + 14; } }
    }
  }
  let cloth = null;

  /* ---------- Catalogue ---------- */

  let ART = [], BY_KEY = {};
  async function loadCatalogue() {
    ART = window.MUSEE_CATALOGUE || await (await fetch('art/catalogue.json')).json();
    BY_KEY = Object.fromEntries(ART.map((a) => [a.key, a]));
  }
  const preload = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image')); i.src = src; });
  async function drawArtwork(rarity) {
    let pool = ART.filter((a) => a.r === rarity);
    if (forced === 'sculpture') { forced = null; const s = ART.filter((a) => a.model); if (s.length) pool = s; }
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
  let forced = null; // panneau admin : rareté (ou 'sculpture') imposée au prochain tirage
  function finishRoll(id) { state.pity = BY_ID[id].rank <= 1 ? 0 : state.pity + 1; return id; }
  function rollRarity(minRank = 4) {
    if (forced && forced !== 'sculpture') { const r = forced; forced = null; return r; }
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

  function innerHTML(a, live) {
    if (a.model && live) return `<model-viewer data-model="${esc(a.model)}" poster="${imgSrc(a)}" alt="${esc(a.title)}, ${esc(a.artist)}" camera-controls auto-rotate auto-rotate-delay="0" rotation-per-second="40deg" shadow-intensity="1" exposure="1.1" interaction-prompt="none" touch-action="pan-y"></model-viewer>`;
    return `<img src="${imgSrc(a)}" alt="${esc(a.title)}, ${esc(a.artist)}" decoding="async">`;
  }
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
    save(); renderCoins();
    audio();

    const stage = $('#stage'), veiled = $('#veiled'), vf = $('#veilFrame'), slot = $('#veilSlot'), reveal = $('#reveal'), stamp = $('#stamp');
    reveal.hidden = true; reveal.innerHTML = '';
    stamp.textContent = ''; stamp.classList.remove('is-on');
    stage.classList.remove('is-glowing');
    veiled.hidden = false; veiled.className = 'veiled is-waiting';
    vf.className = 'frame frame--pending'; vf.style.setProperty('--ar', 0.8); slot.innerHTML = '';
    cloth.reset();
    veiled.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });

    try {
      const [a] = await Promise.all([drawArtwork(rarity), wait(500)]);
      const rank = 4 - BY_ID[a.r].rank; // 0 commune … 4 impériale
      const res = collect(a);
      save();
      // Le cadre prend sa couleur sous le drap, qui se tend de plus en plus.
      vf.className = `frame frame--${a.r} ${a.model ? 'frame--vitrine' : ''}`;
      vf.style.setProperty('--ar', a.model ? 1 : a.ratio);
      slot.innerHTML = innerHTML(a, true);
      hydrateViewers(slot);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      cloth.reset();
      stage.style.setProperty('--glow', color(a.r));
      stage.classList.add('is-glowing');
      cloth.leakColor = color(a.r);
      veiled.className = 'veiled is-tense';
      const shake = 1100 + rank * 450, t0 = performance.now();
      let lastTick = 0;
      await new Promise((done) => {
        const f = (t) => {
          const k = Math.min(1, (t - t0) / shake);
          cloth.setTense(0.15 + k * k * (0.5 + rank * 0.18));
          if (t - lastTick > 420 - k * 330) { lastTick = t; tick2(k * rank); buzz(15 + k * 25); }
          if (k < 1) requestAnimationFrame(f); else done();
        };
        requestAnimationFrame(f);
      });
      // On arrache le drap.
      cloth.drop(); whoosh(0.7, 0.6);
      veiled.className = 'veiled is-unveiled';
      await wait(260);
      thud(0.5 + rank * 0.12); buzz(rank >= 3 ? [60, 40, 60, 40, 160] : [50]);
      const c = color(a.r);
      confetti(40 + rank * 45, [c, '#fff4e0', rank >= 3 ? '#ffd75e' : c], { power: 1.1 + rank * 0.3 });
      if (rank >= 2) { stamp.textContent = BY_ID[a.r].stamp; stamp.className = `stamp is-on r-${a.r}`; chime(rank); }
      if (rank >= 3) { flashScreen(); setTimeout(() => confetti(140, ['#ffd75e', '#ff4d7a', '#7df9ff', '#fff'], { y: 0.3, power: 1.7 }), 300); }
      reveal.innerHTML = (a.model ? '<p class="vitrine__hint">Sculpture en 3D, fais-la tourner</p>' : '') + cartelHTML(a, res);
      reveal.hidden = false;
      renderAll();
    } catch {
      state.coins += PRICE; save();
      veiled.className = 'veiled is-idle';
      toast('L\'œuvre n\'a pas pu être chargée, 100 napoléons rendus.');
    } finally {
      busy = false; renderCoins();
      setTimeout(() => stage.classList.remove('is-glowing'), 1800);
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
    $('#openAdmin').addEventListener('click', () => $('#adminDialog').showModal());
    $('#closeAdmin').addEventListener('click', () => $('#adminDialog').close());
    $('#adminDialog').addEventListener('click', (e) => {
      const b = e.target.closest('[data-admin]'); if (!b) return;
      const [cmd, arg] = b.dataset.admin.split(':');
      if (cmd === 'coins') { state.coins += Number(arg); save(); renderCoins(); toast(`+${fmt(Number(arg))} napoléons`); }
      if (cmd === 'force') { forced = arg; $('#adminDialog').close(); showTab('tirage'); toast(`Prochaine ouverture : ${arg === 'sculpture' ? 'une sculpture' : BY_ID[arg].name.toLowerCase()}`); }
      if (cmd === 'pity') { state.pity = PITY - 1; save(); renderCoins(); toast('Cadre doré garanti au prochain tirage'); }
      if (cmd === 'reset') { localStorage.removeItem(STORE); location.reload(); }
    });
    document.addEventListener('click', (e) => {
      const d = e.target.closest('[data-detail]'); if (d) return openDetail(d.dataset.detail);
      const t = e.target.closest('[data-tab]'); if (t) showTab(t.dataset.tab);
    });
    const snd = $('#sound');
    snd.setAttribute('aria-pressed', soundOn());
    snd.addEventListener('click', () => { state.sound = !soundOn(); save(); snd.setAttribute('aria-pressed', soundOn()); if (soundOn()) chime(2); });
    cloth = new Cloth($('#cloth'));
    requestAnimationFrame(() => cloth.reset());
    addEventListener('resize', () => { if (cloth.mode !== 'drop') cloth.reset(); });
    shownCoins = state.coins;
    renderAll(); renderCoins();
  }
  start().catch(() => toast('Le catalogue n\'a pas pu être chargé. Recharge la page.'));
})();
