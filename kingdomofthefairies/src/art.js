import { LEGACY, FILM, FILM_CAST, bodyScaleOf, themeManifest } from './theme.js';
import { TEXT } from './text_config.js';
// Toy-theatre renderer. Every frame is painted twice: a monochrome "print"
// pass and a flat colour "stencil" pass. The stencil pass is laid over the
// print with the `color` blend, slightly out of register, which is how
// Pathé-style stencil colouring looks in the 1903 Méliès footage the video
// is cut from. Procedural stand-ins draw everything until delivered art
// (assets/manifest.json) replaces a slot.

import { animationFrame, validAnimation, idleFrameId, idlePose } from './animation.js';

import { ROWS, STAGE, TUNING, rowPos, leapHeight, effectiveRow } from './board.js';

export const PAL = {
  plum: '#2a1424', pink: '#f3c6dc', magenta: '#e0127a', lavender: '#cfc0dc',
  gold: '#d9b34a', coral: '#c8321e', teal: '#5f8c88', tealDeep: '#2f5552', foam: '#eef3ea',
  sky: '#1d3a4a', skyLow: '#6d4a6a', cream: '#f1e3c8', wood: '#6b4024', woodDark: '#3a2112',
  velvet: '#8e1730', velvetDark: '#4a0a18', rock: '#6f6a5e', stripe: '#e9a46a',
};

// ---------------------------------------------------------------- painter
const lumCache = new Map();
function toLum(hex) {
  let v = lumCache.get(hex);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const y = 0.3 * r + 0.59 * g + 0.11 * b;
  // Push contrast a little, then warm it like an aged print.
  const k = Math.max(0, Math.min(255, (y - 128) * 1.18 + 132));
  v = `rgb(${Math.min(255, k * 1.03 + 6) | 0},${(k * 0.98 + 2) | 0},${(k * 0.88) | 0})`;
  lumCache.set(hex, v);
  return v;
}
export function painter() {
  const P = { mode: 'lum', c: (hex) => (P.mode === 'lum' ? toLum(hex) : hex) };
  return P;
}

// ---------------------------------------------------------------- assets
// Resolves as soon as the manifest is read. Images then load in two waves,
// the `first` ids (what the opening needs) before the rest, and each one
// appears in `out.images` the moment it arrives, so stand-ins give way to
// art progressively. `out.ready` / `out.all` settle after each wave.
// QA (?qa&testart): a labelled placeholder for a requested slot, at its
// requested size, with its anchor marked, so the code that will draw the art
// can be checked before the art exists.
function testArt(id, s) {
  const [w, h] = s.size || [200, 200];
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d');
  let hash = 0; for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  x.fillStyle = `hsla(${hash % 360}, 70%, 55%, 0.55)`; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#000'; x.lineWidth = Math.max(2, Math.min(w, h) / 40); x.strokeRect(1, 1, w - 2, h - 2);
  const a = s.anchor || '', ax = /right/.test(a) ? w : /left/.test(a) ? 0 : w / 2;
  const ay = /^top|top edge|top centre/.test(a) ? 0 : /bottom/.test(a) ? h : h / 2;
  x.strokeStyle = '#ff0'; x.lineWidth = Math.max(3, Math.min(w, h) / 25);
  x.beginPath(); x.moveTo(ax - w * 0.1, ay); x.lineTo(ax + w * 0.1, ay); x.moveTo(ax, ay - h * 0.1); x.lineTo(ax, ay + h * 0.1); x.stroke();
  if (/walkable/.test(a)) { x.strokeStyle = '#0f0'; x.beginPath(); x.moveTo(0, 2); x.lineTo(w, 2); x.stroke(); }
  x.fillStyle = '#000'; x.font = `bold ${Math.max(10, Math.min(h * 0.3, w / (id.length * 0.6)))}px sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(id, w / 2, h / 2);
  return cv;
}
const TEST_ART = typeof location !== 'undefined' && /[?&]qa\b/.test(location.search) && /[?&]testart\b/.test(location.search);

export async function loadAssets(base = 'assets/', { first = [], onImage } = {}) {
  const out = { failed: [], slots: {}, images: {}, anims: {}, audio: {}, sfx: {}, ready: Promise.resolve(), all: Promise.resolve() };
  let animationSlots = {};
  try {
    const res = await fetch(base + 'manifest.json');
    const m = themeManifest(await res.json());
    out.slots = m.slots || {};
    out.audio = m.audio || {};
    out.sfx = m.sfx || {};
    animationSlots = m.anims || {};
  } catch { out.failed.push('manifest'); return out; }
  // Images load through a queue, a few at a time, so the art a scene needs
  // can be moved to the front (out.want) instead of waiting behind the whole
  // game's. Each id settles once: loaded, failed, or (still requested) skipped.
  const settled = {}, waiters = {}, queue = [];
  let inflight = 0;
  const CONCURRENT = 6;
  const settle = (id) => { settled[id] = true; for (const f of waiters[id] || []) f(); delete waiters[id]; inflight--; pump(); };
  const start = (id) => {
    const s = out.slots[id];
    inflight++;
    if (TEST_ART && s?.status === 'requested') { out.images[id] = testArt(id, s); onImage?.(id, out.images[id]); return settle(id); }
    // Art still requested is not a failure: its stand-in draws until it arrives.
    if (s && s.status !== 'delivered') return settle(id);
    if (!s || !s.file) { out.failed.push(id); return settle(id); }
    const img = new Image();
    // Film art keeps its proportions in its box (fitBox); a tinted alternate is
    // drawn the way its original is, so one of an older, stretched-to-box
    // sprite stays stretched rather than taking the film art's fitting.
    const originalSlot = id.endsWith('-tinted') ? out.slots[id.slice(0, -7)] : null;
    const fit = s.edition === 'film' && (!originalSlot || originalSlot.edition === 'film');
    img.onload = () => { if (fit) { img.fitBox = true; img.bodyScale = bodyScaleOf(id); } out.images[id] = img; onImage?.(id, img); settle(id); };
    img.onerror = () => { out.failed.push(id); settle(id); };
    img.src = base + s.file;
  };
  const started = new Set();
  function pump() {
    while (inflight < CONCURRENT && queue.length) { const id = queue.shift(); if (started.has(id)) continue; started.add(id); start(id); }
  }
  const whenSettled = (id) => (settled[id] ? Promise.resolve() : new Promise((f) => (waiters[id] = waiters[id] || []).push(f)));
  // Move ids (known slots only) to the front of the queue, in order; resolves
  // once every one has settled.
  out.want = (ids) => {
    const known = [...new Set(ids)].filter((id) => out.slots[id]);
    const fresh = known.filter((id) => !started.has(id));
    for (const id of fresh) { const i = queue.indexOf(id); if (i >= 0) queue.splice(i, 1); }
    queue.unshift(...fresh); pump();
    return Promise.all(known.map(whenSettled));
  };
  // How many of ids have settled, of how many known slots.
  out.progress = (ids) => { const known = [...new Set(ids)].filter((id) => out.slots[id]); return { done: known.filter((id) => settled[id]).length, total: known.length }; };
  out.settled = (id) => !!settled[id];
  const load = (ids) => { for (const id of ids) if (!started.has(id) && !queue.includes(id)) queue.push(id); pump(); return Promise.all(ids.filter((id) => out.slots[id]).map(whenSettled)); };
  const early = first.filter((id) => out.slots[id]);
  const rest = Object.keys(out.slots).filter((id) => !early.includes(id));
  out.ready = load(early);
  const loadAnimations = async () => {
    await Promise.all(Object.entries(animationSlots).map(async ([id, slot]) => {
      if (slot.status !== 'delivered' || !slot.file || !slot.meta) return;
      try {
        const response = await fetch(base + slot.meta);
        if (!response.ok) return;
        const meta = await response.json();
        if (!validAnimation(meta)) return;
        await new Promise((done) => {
          const image = new Image();
          image.onload = () => { if (validAnimation(meta, image)) out.anims[id] = { image, meta }; done(); };
          image.onerror = done;
          image.src = base + slot.file;
        });
      } catch { /* A missing/bad loop leaves its still-art fallback in place. */ }
    }));
  };
  // the rest queue behind the first wave (out.want moves a scene's ahead)
  const restDone = load(rest);
  out.all = Promise.all([out.ready, restDone, out.ready.then(loadAnimations)]);
  return out;
}

// Canvas filters are far too slow to run per draw, so each image's print-pass
// (greyscale) copy, and any dimmed variant, is baked once and cached.
const baked = new Map();
const FILTERS_OK = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
// w, h: bake at the size it is drawn (the stage canvas is 1280x720), so large
// art isn't resampled every frame. Omitted: native size.
export function bake(img, filter, w = 0, h = 0) {
  let byFilter = baked.get(img);
  if (!byFilter) baked.set(img, (byFilter = new Map()));
  const key = `${filter}|${w}x${h}`;
  let out = byFilter.get(key);
  if (out) return out;
  out = document.createElement('canvas');
  out.width = w || img.naturalWidth || img.width; out.height = h || img.naturalHeight || img.height;
  const x = out.getContext('2d');
  x.imageSmoothingQuality = 'high';
  if (FILTERS_OK || filter === 'none') { x.filter = filter; x.drawImage(img, 0, 0, out.width, out.height); }
  else {
    // Fallback: plain luminance (dim variants just darken).
    x.drawImage(img, 0, 0, out.width, out.height);
    const d = x.getImageData(0, 0, out.width, out.height), a = d.data;
    const dim = filter.includes('brightness') ? 0.3 : 1, grey = filter.includes('grayscale');
    for (let i = 0; i < a.length; i += 4) {
      const y = 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2];
      a[i] = (grey ? y : a[i]) * dim; a[i + 1] = (grey ? y : a[i + 1]) * dim; a[i + 2] = (grey ? y : a[i + 2]) * dim;
    }
    x.putImageData(d, 0, 0);
  }
  byFilter.set(key, out);
  return out;
}
const PRINT = 'grayscale(1) contrast(1.1)';
// The source to draw for the current pass (and optional extra filter).
export function passImage(P, img, extra = '', w = 0, h = 0) {
  if (P.mode === 'lum') return bake(img, PRINT + (extra ? ' ' + extra : ''), w, h);
  return extra || w ? bake(img, extra || 'none', w, h) : img;
}

// Draw a delivered image into a box anchored at its bottom centre.
function drawAsset(ctx, P, img, cx, by, w, h, extra = '') {
  // Film-edition art keeps its own proportions inside the box it is given
  // (bottom centre), as it may stand in for a sprite of another shape.
  // Figures match the box's height and may run a little wider than it.
  if (img.fitBox) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const s = Math.min(h / ih, (w * 1.6) / iw) * (img.bodyScale || 1);
    w = iw * s; h = ih * s;
  }
  // Sprites can be drawn up to ~1.15x their nominal box, so bake a little larger.
  const k = w * h > 400000 ? 1 : 1.25;
  ctx.drawImage(passImage(P, img, extra, Math.round(w * k), Math.round(h * k)), cx - w / 2, by - h, w, h);
}

// ---------------------------------------------------------------- renderer
export function createRenderer(canvas, assets = { slots: {}, images: {} }) {
  const ctx = canvas.getContext('2d');
  const tint = document.createElement('canvas');
  tint.width = canvas.width; tint.height = canvas.height;
  const tctx = tint.getContext('2d');
  // A floor under every font set on the stage (stage px), so on a small
  // touch screen no text is drawn too small to read (setMinFont, main.js).
  let minFont = 0;
  const FONT = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
  for (const cx of [ctx, tctx]) {
    Object.defineProperty(cx, 'font', {
      configurable: true,
      get() { return FONT.get.call(this); },
      set(v) { FONT.set.call(this, minFont > 0 ? String(v).replace(/(\d+(?:\.\d+)?)px/, (m, n) => Math.max(+n, minFont).toFixed(1) + 'px') : v); },
    });
  }
  const P = painter();
  const fx = { particles: [], flash: 0, shake: 0, texts: [] };
  const witch = { x: 1450, y: 150, tx: 1450, ty: 150, face: 1 };
  let reg = { x: 0, y: 0, n: 0 };
  const grain = makeGrain();
  const dye = makeDye();
  let dyeOff = { x: 0, y: 0 };
  const stars = Array.from({ length: 70 }, (_, i) => ({ x: (i * 397) % 1040 + 120, y: (i * 151) % 260 + 60, p: i * 1.7 }));
  // In the film edition a legacy id draws its film counterpart when that is
  // loaded (FILM_CAST in theme.js, plus the act's own `cast`).
  let cast = {};
  const overQueue = [];
  // The mobile camera (main.js): { z, x, y } zooms the act's stage z times
  // about stage point (x, y). Only the act's own drawing, its particles and
  // floating texts go through it; the frame, curtains, HUD, captions, cards
  // and drawOver stay where they are. null or z = 1 is the whole stage.
  let cam = null, camOn = false, camBase = null;
  const camActive = () => !!cam && cam.z > 1.0005;
  function camApply(c) {
    camOn = camActive();
    if (!camOn) return;
    camBase = c.getTransform();
    c.translate(640, 360); c.scale(cam.z, cam.z); c.translate(-cam.x, -cam.y);
  }
  // Stage point (x, y) as it shows through the camera.
  const camPoint = (x, y) => (camActive() ? { x: 640 + (x - cam.x) * cam.z, y: 360 + (y - cam.y) * cam.z, s: cam.z } : { x, y, s: 1 });
  // The prince's walk: the delivered walk-a/walk-b pairs barely move the legs
  // (and the court pair changes costume), so walking uses the matched stride
  // frames (image requests F10) when delivered, and until then alternates
  // walk-a with the standing pose of the same costume.
  // Walking frames resolved from what is delivered: id -> [pair, when the
  // pair is loaded, otherwise]. The prince's strides (F10) replace his first
  // walk frames. The shared sailor's passing frames carry his sack and his
  // first walk frames do not, so until his own strides (F14) arrive he holds
  // each stride through its passing beat rather than blinking the sack.
  const WALK = {
    'prince-walk-a': ['prince-stride', 'prince-stride-a', 'prince-walk-a'], 'prince-walk-b': ['prince-stride', 'prince-stride-b', 'prince-stand'],
    'prince-court-walk-a': ['prince-court-stride', 'prince-court-stride-a', 'prince-court-walk-a'], 'prince-court-walk-b': ['prince-court-stride', 'prince-court-stride-b', 'prince-court'],
    'sailor-walk-a': ['sailor-stride', 'sailor-stride-a', 'sailor-walk-a'], 'sailor-walk-b': ['sailor-stride', 'sailor-stride-b', 'sailor-walk-b'],
    'sailor-pass-a': ['sailor-stride', 'sailor-pass-a', 'sailor-walk-a'], 'sailor-pass-b': ['sailor-stride', 'sailor-pass-b', 'sailor-walk-b'],
  };
  const walkFrame = (r) => {
    const w = WALK[r];
    if (!w) return r;
    return assets.images[w[0] + '-a'] && assets.images[w[0] + '-b'] ? w[1] : w[2];   // both frames, or neither
  };
  const img = (id) => {
    const a = cast[id];
    let r = a && assets.images[a] ? a : id;
    if (!r) return undefined;
    r = walkFrame(r);
    // the tinted cast look (the default in the film edition; Settings or
    // ?look=original turn it off): a sprite's hand-tinted alternate
    return (tinted && assets.images[r + '-tinted']) || assets.images[r];
  };
  let extraAnimations = false, tinted = false;
  let filmAmp = 1;   // how strongly the people's film idle moves (Film look)

  // Act events: the act's own onEvent, which may call kit.voyageEvent (Act I).
  function onEvent(e, view) {
    if (view.act?.onEvent && view.state) view.act.onEvent(kit, e, view.state);
  }
  function voyageEvent(e, b) {
    const s = b.ship;
    const sy = ROWS[effectiveRow(s)].y;
    if (e.type === 'pearl') { burst(s.x, sy - 30, PAL.foam, 8, 'sparkle'); text('+10', s.x, sy - 70); }
    if (e.type === 'keepsake') { burst(s.x, sy - 40, PAL.gold, 22, 'sparkle'); text(LABEL[e.kind], s.x, sy - 90, true); }
    if (e.type === 'hit') { fx.shake = 0.35; burst(s.x, sy - 20, PAL.coral, 12, 'streak'); burst(s.x, sy - 20, PAL.wood, 8, 'chip'); }
    if (e.type === 'strike') fx.flash = 1;
    if (e.type === 'wreck') { fx.shake = 0.8; burst(s.x, sy - 20, PAL.wood, 30, 'chip'); }
    if (e.type === 'leap' || e.type === 'row') burst(s.x - 40, sy, PAL.foam, 5, 'drop');
  }
  // Bursts suit what happens (`kind`):
  //   confetti  paper strips that spin, flip and flutter down (celebrations)
  //   sparkle   twinkling four-point stars that drift and fade (magic, glints)
  //   bubble    rings that rise and wobble (anything underwater)
  //   drop      water droplets thrown up and falling (splashes, foam)
  //   chip      splinters of wood or stone that tumble down (breakages)
  //   streak    short sharp rays from the point (hits)
  // A white confetti or sparkle burst takes the theatre's colours.
  const CONFETTI = ['#f3c6dc', '#e0127a', '#d9b34a', '#5f8c88', '#f1e3c8', '#a9c4e0'];
  const WHITE = new Set(['#eef3ea', '#ffffff', '#efe9f2', PAL.foam]);
  const R = Math.random, pick = (a) => a[(R() * a.length) | 0];
  function burst(x, y, color, n, kind = 'confetti') {
    const mixed = WHITE.has(color);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, base = { x, y, kind, rot: R() * 6.3, spin: (R() - 0.5) * 14, color, t: 0 };
      if (kind === 'sparkle') {
        const v = 30 + R() * 110;
        fx.particles.push({ ...base, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.7 + R() * 0.7, r: 5 + R() * 6,
          color: mixed ? pick(['#fff2b0', '#f3c6dc', '#ffffff', '#d9b34a']) : R() < 0.7 ? color : '#fff2b0', tw: R() * 6.3 });
      } else if (kind === 'bubble') {
        fx.particles.push({ ...base, x: x + (R() - 0.5) * 50, y: y + (R() - 0.5) * 30, vx: (R() - 0.5) * 30, vy: -60 - R() * 90,
          life: 0.9 + R() * 0.9, r: 2.5 + R() * 6, sway: R() * 6.3, color: '#eef3ea' });
      } else if (kind === 'drop') {
        const v = 120 + R() * 220, up = -Math.abs(Math.sin(a)) * v - 120;
        fx.particles.push({ ...base, vx: Math.cos(a) * v * 0.7, vy: up, life: 0.6 + R() * 0.5, r: 2 + R() * 3, color: mixed ? '#eef3ea' : color });
      } else if (kind === 'chip') {
        const v = 80 + R() * 240;
        fx.particles.push({ ...base, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 180, life: 0.7 + R() * 0.6, w: 4 + R() * 7, h: 2 + R() * 4,
          color: R() < 0.8 ? color : '#3a2112' });
      } else if (kind === 'streak') {
        fx.particles.push({ ...base, a: a, len: 16 + R() * 22, d: 8, v: 260 + R() * 220, life: 0.32 + R() * 0.15 });
      } else {
        const v = 60 + R() * 200;
        fx.particles.push({ ...base, kind: 'confetti', vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140, life: 0.9 + R() * 0.7,
          color: mixed ? pick(CONFETTI) : R() < 0.75 ? color : pick(['#d9b34a', '#f1e3c8']),
          w: 6 + R() * 5, h: 3 + R() * 2.5, flip: R() * 6.3, flipV: 6 + R() * 8, sway: R() * 6.3 });
      }
    }
  }
  function text(str, x, y, big = false) { fx.texts.push({ str, x, y, life: big ? 1.8 : 0.9, big }); }

  function tick(dt, view) {
    const b = view?.state?.board || null;
    for (const p of fx.particles) {
      p.life -= dt; p.t += dt;
      if (p.kind === 'confetti') {
        // paper: quick to slow in the air, falls gently and sways as it goes
        const drag = Math.exp(-2.6 * dt);
        p.vx *= drag; p.vy = p.vy * drag + 300 * dt;
        p.x += (p.vx + Math.sin(p.sway += dt * 5) * 30) * dt; p.y += Math.min(p.vy, 150) * dt;
        p.rot += p.spin * dt; p.flip += p.flipV * dt;
      } else if (p.kind === 'sparkle') {
        const drag = Math.exp(-2 * dt); p.vx *= drag; p.vy *= drag;
        p.x += p.vx * dt; p.y += p.vy * dt; p.tw += dt * 12;
      } else if (p.kind === 'bubble') {
        p.x += (p.vx + Math.sin(p.sway += dt * 6) * 18) * dt; p.y += p.vy * dt; p.r += dt * 1.5;
      } else if (p.kind === 'streak') {
        p.d += p.v * dt; p.v *= Math.exp(-6 * dt);
      } else { // drop, chip
        p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      }
    }
    fx.particles = fx.particles.filter((p) => p.life > 0);
    for (const t of fx.texts) { t.life -= dt; t.y -= 40 * dt; }
    fx.texts = fx.texts.filter((t) => t.life > 0);
    fx.flash = Math.max(0, fx.flash - dt * 4);
    fx.shake = Math.max(0, fx.shake - dt);
    // The witch glides to whatever she's casting.
    if (b) {
      const casting = b.hazards.filter((h) => h.type === 'bolt' && h.state === 'warn');
      if (casting.length) { witch.tx = casting[0].x + 120; witch.ty = 175; }
      else if (b.wind.warn) { witch.tx = 880; witch.ty = 190; }
      else if (view.state.witchAt) { witch.tx = view.state.witchAt.x; witch.ty = view.state.witchAt.y; }
      else if (b.phase !== 'sail') { witch.tx = 1500; }
      else if (witch.x > 1300 || Math.abs(witch.tx - witch.x) < 10) { witch.tx = 1500; }
      witch.x += (witch.tx - witch.x) * Math.min(1, dt * 1.6);
      witch.y += (witch.ty - witch.y) * Math.min(1, dt * 1.6);
      // She faces the ship she is attacking, whichever way she glides (her art,
      // and the drawn stand-in, face left: 1 draws them as painted).
      witch.face = witch.x >= b.ship.x ? 1 : -1;
    }
  }

  // view = { board, curtain(0 closed..1 open), card, film: 'full'|'gentle'|'off', t }
  function render(view) {
    cam = view.cam || null;
    extraAnimations = view.extraAnimations === true;
    tinted = view.tinted === true;
    const { t, film } = view;
    filmAmp = film === 'off' ? 0.35 : film === 'gentle' ? 0.6 : 1;
    if (film !== 'off' && ++reg.n % 5 === 0) {
      const m = film === 'full' ? 3 : 1.4;
      reg.x = (Math.random() - 0.5) * m * 2; reg.y = (Math.random() - 0.5) * m * 2;
    } else if (film === 'off') reg = { x: 0, y: 0, n: 0 };

    ctx.save();
    if (fx.shake > 0 && film !== 'off') ctx.translate((Math.random() - 0.5) * 14 * fx.shake, (Math.random() - 0.5) * 10 * fx.shake);
    if (film === 'full') ctx.translate(0, Math.sin(t * 23) * 0.8); // gate weave
    P.mode = 'lum';
    scene(ctx, view);
    ctx.restore();

    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.clearRect(0, 0, tint.width, tint.height);
    tctx.save();
    tctx.translate(reg.x, reg.y);
    P.mode = 'tint';
    scene(tctx, view);
    tctx.restore();
    // Stencil dye is never even: knock soft blotches out of the colour pass,
    // re-dealt every few frames like hand-coloured prints that "boil".
    if (film !== 'off') {
      if (reg.n % 5 === 0) dyeOff = { x: Math.random() * 320, y: Math.random() * 180 };
      tctx.save();
      tctx.globalCompositeOperation = 'destination-out';
      tctx.globalAlpha = film === 'full' ? 0.5 : 0.35;
      tctx.drawImage(dye, -dyeOff.x, -dyeOff.y);
      tctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'color';
    ctx.globalAlpha = 0.88;
    ctx.drawImage(tint, 0, 0);
    ctx.restore();

    if (fx.flash > 0) { ctx.fillStyle = `rgba(255,250,230,${fx.flash * 0.55})`; ctx.fillRect(0, 0, 1280, 720); }
    if (fx.texts.length) { ctx.save(); camApply(ctx); floatingTexts(ctx); ctx.restore(); camOn = false; }
    if (view.card) drawCard(ctx, view.card, t);
    filmLook(ctx, film, t, grain);
    // The closing fade covers both print passes, credits and film grain.
    if (view.fade > 0) {
      ctx.save(); ctx.fillStyle = `rgba(0,0,0,${Math.min(1, view.fade)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
    }
  }

  // ------------------------------------------------------------ scene
  // view = { act, state, curtain, card, film, t, hud, curtainCall, scene }
  // The act draws the stage inside the frame; the core draws the frame,
  // curtains, HUD and anything the act puts over them (irises, washes).
  function scene(c, view) {
    const t = view.t, st = view.state, act = view.act;
    cast = FILM ? { ...FILM_CAST, ...(act?.cast || {}) } : {};
    kit.c = c; kit.t = t;
    c.save();
    if (!view.scene && act && st) camApply(c);
    if (view.scene) view.scene(kit, t); // shell scenes: playbill, curtain call
    else if (act && st) act.draw(kit, st, t);
    else { backdrop(c, null, t); for (let r = 0; r < 3; r++) waves(c, r, t * 60, t); }
    particles(c);
    c.restore(); camOn = false;
    const spec = act && st && view.hud && act.hud ? act.hud(st) : null;
    if (img('proscenium')) { proscenium(c, view.curtain, spec?.wind, t); footlights(c, t); }
    else { footlights(c, t); proscenium(c, view.curtain, spec?.wind, t); }
    if (!st && !view.scene) bandTrio(c, 1, 1, t); // the band waits in front of the curtain
    if (view.curtainCall > 0) bandTrio(c, view.curtainCall, 0, t);
    if (spec) hud(c, spec, t);
    if (act?.drawOver && st) { kit.c = c; act.drawOver(kit, st, t); }
    // Anything an act asked to draw over the frame (tableau captions).
    for (const f of overQueue.splice(0)) { kit.c = c; f(); }
  }

  // Act I's voyage: sky, witch, three wave rows with hazards, pickups, ship.
  // yOff lowers the rows (they sink through the floor for the deck scene).
  function voyage(c, b, t, opts = {}) {
    backdrop(c, b, t);
    clouds(c, b, t);
    moonboat(c, t);
    const shipRow = Math.round(rowPos(b.ship));
    const yOff = opts.rowsDrop || 0; // the back row stays up as the horizon
    for (let r = 0; r < 3; r++) {
      const drop = r > 0 && yOff;
      if (drop) { c.save(); c.translate(0, yOff); }
      for (const h of b.hazards) if (h.row === r) (h.type === 'rock' ? rock : boltShadow)(c, h, t);
      for (const p of b.pickups) if (p.row === r) pickup(c, p, t);
      if (shipRow === r && !opts.hideShip) ship(c, b, t);
      if (opts.beforeWave) opts.beforeWave(r);
      waves(c, r, b.scrolled, t);
      if (drop) c.restore();
    }
    for (const h of b.hazards) if (h.type === 'bolt') bolt(c, h, t);
  }

  function backdrop(c, b, t) {
    const g = c.createLinearGradient(0, 60, 0, 470);
    g.addColorStop(0, P.c(PAL.sky)); g.addColorStop(0.75, P.c('#355a66')); g.addColorStop(1, P.c(PAL.skyLow));
    c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
    if (img('sky-backdrop')) {
      // Alternate reflected panels so the generated panorama meets its own
      // edge at each join. A full two-panel cycle keeps the reflection stable.
      const off = b ? (b.scrolled * 0.08) % 2560 : 0;
      for (let k = 0; k < 3; k++) {
        c.save();
        c.translate(k * 1280 - off + (k % 2 ? 1280 : 0), 0);
        if (k % 2) c.scale(-1, 1);
        drawAsset(c, P, img('sky-backdrop'), 640, 470, 1280, 410);
        c.restore();
      }
    }
    // stars
    c.fillStyle = P.c(PAL.cream);
    for (const s of stars) {
      const a = 0.5 + 0.5 * Math.sin(t * 2 + s.p);
      c.globalAlpha = 0.4 + 0.6 * a;
      star(c, s.x, s.y, 2 + a * 2);
    }
    c.globalAlpha = 1;
    moonFace(c, 250, 150, 52, t);
    if (!img('sky-backdrop')) headlands(c, b, t);
    // The lighthouse of Widow's Bay is wheeled on for the last stretch,
    // steadily, and comes to rest as the ship does on arrival: once it
    // stops, the voyage is over.
    const p = b ? b.progress : 0;
    if (p > 0.82) {
      const k = Math.min(1, (p - 0.82) / 0.18);
      const u = b.phase === 'sail' ? 0 : b.phase === 'arrive' ? Math.min(1, b.phaseT / TUNING.arriveTime) : 1;
      lighthouse(c, 1320 - k * 320 - 40 * (1 - (1 - u) ** 2), 420, t, b.phase !== 'sail');
    }
  }

  // Moving panorama: distant headlands painted on a roll (stand-in only; the
  // delivered sky has its own).
  function headlands(c, b, t) {
    const off = b ? b.scrolled * 0.18 : t * 10;
    c.fillStyle = P.c('#2a4049');
    c.beginPath(); c.moveTo(0, 470);
    for (let x = 0; x <= 1280; x += 20) {
      const w = x + off;
      const y = 400 - 34 * Math.max(0, Math.sin(w * 0.004)) - 18 * Math.sin(w * 0.011 + 1) - 10 * Math.sin(w * 0.027);
      c.lineTo(x, y);
    }
    c.lineTo(1280, 470); c.closePath(); c.fill();
  }

  function moonFace(c, x, y, r, t) {
    const glow = c.createRadialGradient(x, y, r * 0.6, x, y, r * 2.2);
    glow.addColorStop(0, P.mode === 'lum' ? 'rgba(255,245,220,0.35)' : 'rgba(255,230,160,0.35)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    if (img('moon-face')) {
      // Hung on a wire through the hole at its top, swaying a little.
      const sway = Math.sin(t * 0.6) * 0.03;
      wire(c, x, 0, y - r * 1.15);
      c.save(); c.translate(x, y - r * 1.2); c.rotate(sway);
      drawAsset(c, P, img('moon-face'), 0, r * 2.45, r * 2.5, r * 2.5);
      c.restore();
      return;
    }
    c.fillStyle = P.c('#f4e7b8'); circle(c, x, y, r);
    // A sleepy Méliès face.
    c.strokeStyle = P.c('#8c7448'); c.lineWidth = 3; c.lineCap = 'round';
    const blink = Math.sin(t * 0.7) > 0.97 ? 0.2 : 1;
    c.beginPath(); c.arc(x - 18, y - 8, 9, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.beginPath(); c.arc(x + 16, y - 8, 9, 0.15 * Math.PI, 0.85 * Math.PI * blink + 0.15 * (1 - blink)); c.stroke();
    c.beginPath(); c.arc(x, y + 14, 16, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
    c.beginPath(); c.moveTo(x - 2, y - 2); c.quadraticCurveTo(x + 4, y + 6, x - 2, y + 8); c.stroke();
    c.fillStyle = P.c('#e8a9a0'); c.globalAlpha = 0.5; circle(c, x - 28, y + 8, 6); circle(c, x + 28, y + 8, 6); c.globalAlpha = 1;
  }

  function lighthouse(c, x, y, t, lit) {
    const art = img(lit && view_lamp && img('lighthouse-lit') ? 'lighthouse-lit' : 'lighthouse');
    if (art) {
      // Art is 700x420 at 2x; its lamp room is at (410, 56) and the cottage
      // window at (328, 270) in those pixels. Place the lamp at (x, y - 132).
      const cx = x - 30, yb = y + 50;
      drawAsset(c, P, art, cx, yb, 350, 210);
      beam(c, x, yb - 182, t, lit);
      if (lit && view_lamp) {
        const wx = cx - 11, wy = yb - 75;
        const g = c.createRadialGradient(wx, wy, 1, wx, wy, 34);
        g.addColorStop(0, P.mode === 'lum' ? 'rgba(255,245,215,0.85)' : 'rgba(255,205,90,0.85)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(wx - 34, wy - 34, 68, 68);
      }
      return;
    }
    c.fillStyle = P.c('#3b3a3a');
    c.beginPath(); c.moveTo(x - 120, y + 50); c.quadraticCurveTo(x - 40, y - 10, x + 10, y + 4); c.quadraticCurveTo(x + 90, y - 20, x + 200, y + 50); c.fill();
    c.fillStyle = P.c(PAL.cream);
    c.beginPath(); c.moveTo(x - 18, y + 6); c.lineTo(x - 11, y - 120); c.lineTo(x + 11, y - 120); c.lineTo(x + 18, y + 6); c.fill();
    c.fillStyle = P.c(PAL.coral);
    for (let k = 0; k < 3; k++) c.fillRect(x - 16 + k * 2.2, y - 30 - k * 36, 32 - k * 4.4, 14);
    c.fillStyle = P.c(PAL.woodDark); c.fillRect(x - 16, y - 146, 32, 26);
    c.fillStyle = P.c(PAL.gold); c.fillRect(x - 11, y - 142, 22, 18);
    c.fillStyle = P.c(PAL.woodDark);
    c.beginPath(); c.moveTo(x - 20, y - 146); c.lineTo(x, y - 166); c.lineTo(x + 20, y - 146); c.fill();
    beam(c, x, y - 133, t, lit);
    // cottage with her window
    c.fillStyle = P.c('#4a3a44'); c.fillRect(x + 50, y - 26, 70, 40);
    c.beginPath(); c.moveTo(x + 44, y - 26); c.lineTo(x + 85, y - 56); c.lineTo(x + 126, y - 26); c.fill();
    c.fillStyle = P.c(lit && view_lamp ? '#ffd56b' : '#1b1418'); c.fillRect(x + 76, y - 16, 16, 16);
  }
  let view_lamp = false;

  function beam(c, x, y, t, lit) {
    const a = Math.sin(t * 1.4) * 0.9;
    c.save(); c.globalAlpha = lit ? 0.55 : 0.3;
    // Brightest at the lamp, fading to nothing at the far end of the wedge.
    const rgb = P.mode === 'lum' ? '255,245,215' : '255,242,176';
    const g = c.createLinearGradient(x, y, x - 420, y);
    g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.55, `rgba(${rgb},0.4)`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x, y);
    c.lineTo(x - 420, y - 380 * a - 40); c.lineTo(x - 420, y - 380 * a + 40); c.closePath(); c.fill();
    c.restore();
  }

  // The band as a halftone cut-out. title: standing at the left in front of
  // the closed curtain. Curtain call: rising through the centre trapdoor.
  function bandTrio(c, k, title, t) {
    if (!LEGACY) return;
    const art = img('band-trio');
    if (!art) return;
    const e = 1 - (1 - Math.min(1, k)) ** 3;
    const size = title ? 330 : 300;
    const x = title ? 205 : 330;
    const yb = title ? 708 : 660 + (1 - e) * 300;
    c.save();
    if (!title) { c.beginPath(); c.rect(0, 0, 1280, 662); c.clip(); }
    drawIdle(c, 'band-trio', t, x, yb + size * 0.013, size, size);
    c.restore();
  }

  function clouds(c, b, t) {
    // Two hanging cloud flats that drift on their wires.
    const off = b.scrolled * 0.35;
    for (let k = 0; k < 3; k++) {
      const x = ((k * 520 - off) % 1560 + 1560) % 1560 - 140;
      const y = 110 + k * 24 + Math.sin(t * 0.8 + k) * 5;
      wire(c, x, 0, y - 30);
      cloudFlat(c, x, y, 0.9 + k * 0.1, PAL.lavender);
    }
  }

  function cloudFlat(c, x, y, s, col, storm = false) {
    const art = storm && img('cloud-storm') ? img('cloud-storm') : img('cloud');
    if (art) return drawAsset(c, P, art, x, y + 34 * s, 200 * s, 90 * s);
    c.fillStyle = P.c(col);
    c.beginPath();
    c.ellipse(x - 50 * s, y + 8 * s, 46 * s, 26 * s, 0, 0, Math.PI * 2);
    c.ellipse(x, y - 10 * s, 52 * s, 36 * s, 0, 0, Math.PI * 2);
    c.ellipse(x + 52 * s, y + 6 * s, 44 * s, 28 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(x - 90 * s, y + 6 * s, 180 * s, 26 * s);
    c.strokeStyle = P.c('#6f5f7d'); c.lineWidth = 2;
    c.beginPath(); c.moveTo(x - 92 * s, y + 32 * s); c.lineTo(x + 92 * s, y + 32 * s); c.stroke();
  }

  function moonboat(c, t) {
    if (witch.x > 1420) return;
    moonboatAt(c, witch.x, witch.y, witch.face, 1, t);
  }
  function moonboatAt(c, x, y, face, s, t, wires = true) {
    const bob = Math.sin(t * 2.1) * 6;
    if (wires) { wire(c, x - 30 * s, 0, y - 60 * s + bob); wire(c, x + 40 * s, 0, y - 50 * s + bob); }
    c.save(); c.translate(x, y + bob); c.scale(face * s, s);
    if (img('witch-moonboat')) { drawAsset(c, P, img('witch-moonboat'), 0, 40, 260, 170); c.restore(); return; }
    // red sea dragon in harness, out front
    c.fillStyle = P.c(PAL.coral);
    const sw = Math.sin(t * 6) * 6;
    c.beginPath();
    c.moveTo(-60, 20); c.quadraticCurveTo(-95, 0 + sw, -130, 10);
    c.quadraticCurveTo(-150, 0, -160, -10); c.lineTo(-150, 14); c.quadraticCurveTo(-120, 34 - sw, -70, 34); c.fill();
    for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(-80 - k * 14, 14); c.lineTo(-86 - k * 14, -4 + sw * 0.5); c.lineTo(-92 - k * 14, 14); c.fill(); }
    c.fillStyle = P.c(PAL.gold); circle(c, -152, -2, 3);
    c.strokeStyle = P.c(PAL.gold); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-145, 4); c.quadraticCurveTo(-100, -30, -30, -6); c.stroke();
    // crescent shell boat
    c.fillStyle = P.c(PAL.gold);
    c.beginPath();
    c.moveTo(-70, -30); c.quadraticCurveTo(-60, 48, 20, 46); c.quadraticCurveTo(90, 40, 86, -60);
    c.quadraticCurveTo(70, 26, 10, 26); c.quadraticCurveTo(-40, 24, -70, -30); c.fill();
    c.strokeStyle = P.c('#8a6a20'); c.lineWidth = 2;
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(10, -40, 70 + k * 6, 0.35 * Math.PI, 0.75 * Math.PI); c.stroke(); }
    // the witch, in pink, with a star wand
    c.fillStyle = P.c(PAL.pink);
    c.beginPath(); c.moveTo(-10, 26); c.quadraticCurveTo(-8, -30, 14, -40); c.quadraticCurveTo(36, -30, 40, 26); c.fill();
    c.fillStyle = P.c('#efd7c4'); circle(c, 14, -50, 11);
    c.fillStyle = P.c('#2a1a22');
    c.beginPath(); c.moveTo(2, -52); c.quadraticCurveTo(14, -70, 28, -52); c.quadraticCurveTo(34, -20, 26, 0); c.quadraticCurveTo(20, -30, 2, -52); c.fill();
    c.strokeStyle = P.c(PAL.gold); c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(-4, -20); c.lineTo(-30, -62); c.stroke();
    c.fillStyle = P.c('#fff2b0'); star(c, -32, -66, 8 + Math.sin(t * 8) * 2);
    c.restore();
  }

  function waves(c, r, scrolled, t) {
    const { y, scale } = ROWS[r];
    const dir = r % 2 ? -1 : 1;
    const span = 84 * scale;
    const phase = ((scrolled * (0.9 + r * 0.25) * dir) % span + span) % span;
    const bob = Math.sin(t * 1.7 + r * 1.9) * 4;
    const top = y + bob;
    const strip = img(WAVE_ART[r].id);
    if (strip) {
      // Delivered strip: tile the seamless span [x0, x0 + len) of the 2x art.
      const { x0, len } = WAVE_ART[r];
      const g = 0.5 * scale * 1.1; // art px -> stage px
      const tw = len * g, th = 300 * g;
      const y0 = top - 14 * scale - 45 * g; // painted crest line (~45 art px) sits on the waterline
      const off = ((scrolled * (0.9 + r * 0.25) * dir) % tw + tw) % tw;
      const src = passImage(P, strip);
      for (let x = -off; x < 1280; x += tw) {
        c.drawImage(src, x0, 0, len, 300, x, y0, tw + 1, th);
        // carry the strip's bottom edge down to the floor so no gap shows
        c.drawImage(src, x0, 296, len, 3, x, y0 + th - 2, tw + 1, 722 - (y0 + th));
      }
      // (No crank at the wing: the cranks were tried and dropped; they read as screws.)
      return;
    }
    const body = [PAL.tealDeep, '#3f6f6a', PAL.teal][r];
    c.fillStyle = P.c(body);
    c.beginPath();
    c.moveTo(STAGE.left - 60, 720);
    for (let x = STAGE.left - 60 - phase; x < STAGE.right + 100; x += span) {
      c.lineTo(x, top + 6 * scale);
      c.quadraticCurveTo(x + span * 0.35, top - 26 * scale, x + span * 0.62, top - 10 * scale);
      c.quadraticCurveTo(x + span * 0.5, top + 2 * scale, x + span, top + 6 * scale);
    }
    c.lineTo(STAGE.right + 100, 720); c.closePath(); c.fill();
    // painted foam curls
    c.strokeStyle = P.c(PAL.foam); c.lineWidth = 2.5 * scale; c.lineCap = 'round';
    c.beginPath();
    for (let x = STAGE.left - 60 - phase; x < STAGE.right + 100; x += span) {
      c.moveTo(x + span * 0.2, top - 6 * scale);
      c.quadraticCurveTo(x + span * 0.38, top - 24 * scale, x + span * 0.6, top - 11 * scale);
      c.moveTo(x + span * 0.3, top + 10 * scale); c.lineTo(x + span * 0.55, top + 8 * scale);
    }
    c.stroke();
    // darker trough band
    c.fillStyle = P.c('#16302f'); c.globalAlpha = 0.35;
    c.fillRect(STAGE.left - 60, top + 30 * scale, STAGE.right - STAGE.left + 160, 10);
    c.globalAlpha = 1;
  }

  function ship(c, b, t) {
    const s = b.ship;
    const rp = rowPos(s);
    const r0 = Math.floor(rp), r1 = Math.min(2, r0 + 1), f = rp - r0;
    const y = ROWS[r0].y + (ROWS[r1].y - ROWS[r0].y) * f;
    const scale = ROWS[r0].scale + (ROWS[r1].scale - ROWS[r0].scale) * f;
    const h = leapHeight(s);
    if (s.invuln > 0 && Math.floor(t * 14) % 2 === 0) return;
    const sink = b.phase === 'wrecked' ? Math.min(1, b.phaseT / 1.6) : 0;
    const x = s.x;
    const yy = y - h + sink * 70 + Math.sin(t * 2.4) * 3;
    // puppet wires
    c.globalAlpha = 0.35 + (h > 1 ? 0.4 : 0);
    wire(c, x - 30 * scale, 0, yy - 150 * scale); wire(c, x + 34 * scale, 0, yy - 140 * scale);
    c.globalAlpha = 1;
    c.save();
    c.translate(x, yy); c.scale(scale, scale);
    c.rotate(Math.sin(t * 2.4) * 0.05 - (h > 0 ? 0.08 : 0) + sink * 0.7);
    if (img('ship')) { drawAsset(c, P, img('ship'), 0, 20, 190, 200); c.restore(); return; }
    // hull
    c.fillStyle = P.c(PAL.wood);
    c.beginPath(); c.moveTo(-80, -26); c.lineTo(84, -30); c.quadraticCurveTo(70, 12, 40, 16); c.lineTo(-56, 16); c.quadraticCurveTo(-76, 4, -80, -26); c.fill();
    c.fillStyle = P.c(PAL.gold); c.fillRect(-78, -30, 162, 6);
    c.fillStyle = P.c(PAL.woodDark);
    for (let k = 0; k < 4; k++) circle(c, -44 + k * 30, -8, 5);
    c.fillStyle = P.c(PAL.coral); c.fillRect(-62, 2, 108, 5);
    // masts & sails
    c.fillStyle = P.c(PAL.woodDark); c.fillRect(-4, -150, 6, 122); c.fillRect(44, -110, 5, 82);
    const belly = Math.sin(t * 3) * 3 + (b.wind.dir > 0 ? 8 : -6);
    c.fillStyle = P.c(PAL.cream);
    c.beginPath(); c.moveTo(-50, -138); c.quadraticCurveTo(-1 + belly, -120, 50, -138); c.lineTo(46, -48); c.quadraticCurveTo(0 + belly, -40, -46, -48); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(50, -104); c.lineTo(50, -40); c.lineTo(92, -40); c.closePath(); c.fill();
    c.strokeStyle = P.c('#b49b78'); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-48, -94); c.quadraticCurveTo(0 + belly, -80, 48, -94); c.stroke();
    // pennant streams with the wind
    c.fillStyle = P.c(PAL.magenta);
    const w = b.wind.dir;
    c.beginPath(); c.moveTo(0, -150); c.lineTo(-w * 34, -146 + Math.sin(t * 9) * 3); c.lineTo(0, -140); c.fill();
    // the sailor
    c.fillStyle = P.c('#22303a'); c.fillRect(-64, -52, 14, 24);
    c.fillStyle = P.c('#efd7c4'); circle(c, -57, -58, 7);
    c.fillStyle = P.c('#22303a'); c.fillRect(-66, -68, 18, 5); c.fillRect(-62, -74, 10, 7);
    c.restore();
  }

  function rock(c, h) {
    const { y, scale } = ROWS[h.row];
    if (h.state === 'warn') {
      // churning water over the trapdoor
      const k = h.t / TUNING.rock.warn;
      c.strokeStyle = P.c(PAL.foam); c.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const rr = ((k * 3 + i) % 3) / 3;
        c.globalAlpha = 1 - rr;
        c.beginPath(); c.ellipse(h.x, y + 2, (14 + rr * 50) * scale, (4 + rr * 10) * scale, 0, 0, Math.PI * 2); c.stroke();
      }
      c.globalAlpha = 1;
      return;
    }
    const rise = Math.min(1, h.t / 0.25);
    const e = 1 - (1 - rise) ** 3;
    c.save(); c.translate(h.x, y + 10 + (1 - e) * 80 * scale); c.scale(scale, scale);
    if (img('rock')) { drawAsset(c, P, img('rock'), 0, 0, 120, 110); c.restore(); return; }
    c.fillStyle = P.c(PAL.rock);
    c.beginPath(); c.moveTo(-52, 0); c.lineTo(-40, -50); c.lineTo(-14, -66); c.lineTo(4, -96); c.lineTo(26, -60); c.lineTo(48, -44); c.lineTo(56, 0); c.closePath(); c.fill();
    c.fillStyle = P.c('#4a463e');
    c.beginPath(); c.moveTo(4, -96); c.lineTo(26, -60); c.lineTo(48, -44); c.lineTo(56, 0); c.lineTo(14, 0); c.lineTo(10, -56); c.closePath(); c.fill();
    c.strokeStyle = P.c(PAL.foam); c.lineWidth = 3;
    c.beginPath(); c.moveTo(-50, -4); c.quadraticCurveTo(0, -18, 54, -4); c.stroke();
    c.restore();
  }

  function boltShadow(c, h, t) {
    if (h.state !== 'warn') return;
    const { y, scale } = ROWS[h.row];
    const k = h.t / TUNING.bolt.warn;
    c.fillStyle = P.c('#0e1a20');
    c.globalAlpha = 0.25 + 0.4 * k + 0.15 * Math.sin(t * 30);
    c.beginPath(); c.ellipse(h.x, y + 4, TUNING.bolt.hitW * scale, 10 * scale, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  }

  function bolt(c, h, t) {
    const { y } = ROWS[h.row];
    const cy = 190 + h.row * 22;
    const dark = h.state === 'warn' ? Math.min(1, h.t / TUNING.bolt.warn) : 1;
    wire(c, h.x, 0, cy - 30);
    cloudFlat(c, h.x, cy, 0.8, dark > 0.6 ? '#4b3f5c' : '#7d6d8e', dark > 0.6);
    if (h.state === 'warn' && Math.sin(t * 40) > 0.6) {
      c.strokeStyle = P.c('#fff2b0'); c.lineWidth = 2;
      c.beginPath(); c.moveTo(h.x - 20, cy + 30); c.lineTo(h.x - 12, cy + 42); c.lineTo(h.x - 18, cy + 50); c.stroke();
    }
    if (h.state === 'strike') {
      c.strokeStyle = P.c('#fff6c8'); c.lineWidth = 7; c.lineJoin = 'miter';
      c.beginPath(); c.moveTo(h.x, cy + 30);
      let yy = cy + 30, xx = h.x;
      while (yy < y - 6) { yy += 30; xx += (Math.random() - 0.5) * 50; c.lineTo(xx, Math.min(yy, y - 6)); }
      c.stroke();
      c.strokeStyle = P.c(PAL.gold); c.lineWidth = 2.5; c.stroke();
    }
  }

  function pickup(c, p, t) {
    const { y, scale } = ROWS[p.row];
    const bob = Math.sin(t * 3 + p.t) * 6;
    const yy = y - 26 * scale + bob;
    if (p.type === 'pearl') {
      if (img('pearl')) return drawAsset(c, P, img('pearl'), p.x, yy + 12, 28 * scale, 28 * scale);
      c.fillStyle = P.c('#efe9f2'); circle(c, p.x, yy, 11 * scale);
      c.fillStyle = P.c('#ffffff'); circle(c, p.x - 4 * scale, yy - 4 * scale, 3.5 * scale);
      c.strokeStyle = P.c('#b7a7c4'); c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, yy, 11 * scale, 0.1, Math.PI * 0.9); c.stroke();
      return;
    }
    // keepsake: a halo of painted rays
    c.save(); c.translate(p.x, yy - 14 * scale); c.scale(scale, scale);
    c.rotate(t * 0.8);
    c.fillStyle = P.c(PAL.gold); c.globalAlpha = 0.55;
    for (let k = 0; k < 10; k++) { c.rotate(Math.PI / 5); c.beginPath(); c.moveTo(0, 0); c.lineTo(-6, 54); c.lineTo(6, 54); c.fill(); }
    c.restore(); c.globalAlpha = 1;
    c.save(); c.translate(p.x, yy - 14 * scale); c.scale(scale * 1.15, scale * 1.15);
    keepsakeIcon(c, p.kind, t);
    c.restore();
  }

  function keepsakeIcon(c, kind, t, empty = false) {
    const id = kind === 'leaf' ? 'tea-leaf' : 'keepsake-' + kind;
    if (img(id)) {
      if (!empty) return drawAsset(c, P, img(id), 0, 24, 56, 56);
      // An empty slot is a pale ghost, easy to read on the plum plaque.
      const a = c.globalAlpha; c.globalAlpha = a * 0.45;
      drawAsset(c, P, img(id), 0, 24, 56, 56, 'grayscale(1) brightness(0.8)');
      c.globalAlpha = a; return;
    }
    const col = (hex) => (empty ? P.c('#5a4152') : P.c(hex));
    if (kind === 'tea') {
      c.fillStyle = col(PAL.cream);
      c.beginPath(); c.moveTo(-20, -8); c.lineTo(20, -8); c.quadraticCurveTo(18, 18, 0, 18); c.quadraticCurveTo(-18, 18, -20, -8); c.fill();
      c.strokeStyle = col(PAL.cream); c.lineWidth = 4; c.beginPath(); c.arc(22, 2, 7, -1.2, 1.4); c.stroke();
      c.fillStyle = col(PAL.magenta); c.fillRect(-18, -2, 36, 4);
      c.fillStyle = col(PAL.cream); c.beginPath(); c.ellipse(0, 20, 26, 5, 0, 0, Math.PI * 2); c.fill();
      if (!empty) {
        c.fillStyle = P.c('#4a6b3a');
        for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(-8 + k * 8, -16 - Math.sin(t * 3 + k) * 6 - k * 4, 4, 2, k, 0, Math.PI * 2); c.fill(); }
      }
    } else if (kind === 'leaf') {
      c.fillStyle = col('#4a6b3a');
      c.beginPath(); c.ellipse(0, 4, 9, 20, 0.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = col('#2c3f22'); c.lineWidth = 2; c.beginPath(); c.moveTo(-8, 18); c.quadraticCurveTo(0, 4, 8, -12); c.stroke();
      if (!empty) { c.globalAlpha = 0.35; c.fillStyle = P.c(PAL.gold); circle(c, 0, 4, 22); c.globalAlpha = 1; }
    } else if (kind === 'guitar') {
      c.save(); c.rotate(-0.5);
      c.fillStyle = col('#8a5a2b'); c.fillRect(-3, -34, 6, 30);
      c.fillStyle = col('#e8d3a0'); circle(c, 0, 4, 13); circle(c, 0, 18, 15);
      c.fillStyle = col('#2a1a12'); circle(c, 0, 8, 4);
      c.restore();
    } else if (kind === 'stone') {
      c.fillStyle = col('#8d8f91'); c.beginPath(); c.ellipse(0, 6, 20, 14, -0.2, 0, Math.PI * 2); c.fill();
      c.strokeStyle = col('#eeeeee'); c.lineWidth = 2; c.beginPath(); c.ellipse(0, 6, 14, 9, -0.2, 0, Math.PI * 2); c.stroke();
    } else if (kind === 'pearl') {
      c.fillStyle = col('#e9a2b8');
      c.beginPath(); c.moveTo(-24, 6); c.quadraticCurveTo(0, 30, 24, 6); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-24, 2); c.quadraticCurveTo(-10, -30, 24, -8); c.lineTo(22, 0); c.closePath(); c.fill();
      c.fillStyle = col('#f7f2fa'); circle(c, 0, 4, 9);
      if (!empty) { c.fillStyle = P.c('#ffffff'); circle(c, -3, 1, 3); }
    } else {
      c.strokeStyle = col('#3f7a4a'); c.lineWidth = 3; c.beginPath(); c.moveTo(0, 8); c.quadraticCurveTo(-4, 20, 2, 28); c.stroke();
      c.fillStyle = col('#d63c6c');
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; c.beginPath(); c.ellipse(Math.cos(a) * 9, Math.sin(a) * 9, 10, 6, a, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = col(PAL.pink); circle(c, 0, 0, 7);
    }
  }

  function particles(c) {
    for (const p of fx.particles) {
      c.globalAlpha = Math.min(1, p.life * 2);
      c.save(); c.translate(p.x, p.y);
      if (p.kind === 'confetti') {
        const f = Math.cos(p.flip); // the strip turning over: thin edge-on, darker on its back
        c.rotate(p.rot); c.scale(1, Math.max(0.12, Math.abs(f)));
        c.fillStyle = P.c(p.color); c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        if (f < 0) { c.fillStyle = 'rgba(40,20,30,0.28)'; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      } else if (p.kind === 'sparkle') {
        const r = p.r * (0.55 + 0.45 * Math.abs(Math.sin(p.tw)));
        c.rotate(p.rot * 0.2); c.fillStyle = P.c(p.color);
        c.beginPath();
        for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.22 : r, an = (k / 8) * Math.PI * 2; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
        c.closePath(); c.fill();
        c.globalAlpha *= 0.35; c.beginPath(); c.arc(0, 0, r * 0.6, 0, Math.PI * 2); c.fill();
      } else if (p.kind === 'bubble') {
        c.strokeStyle = P.c(p.color); c.lineWidth = 1.5; c.globalAlpha *= 0.85;
        c.beginPath(); c.arc(0, 0, p.r, 0, Math.PI * 2); c.stroke();
        c.fillStyle = P.c(p.color); c.globalAlpha *= 0.6; c.beginPath(); c.arc(-p.r * 0.35, -p.r * 0.35, p.r * 0.25, 0, Math.PI * 2); c.fill();
      } else if (p.kind === 'drop') {
        c.rotate(Math.atan2(p.vy, p.vx) - Math.PI / 2); c.fillStyle = P.c(p.color);
        c.beginPath(); c.ellipse(0, 0, p.r, p.r * 1.8, 0, 0, Math.PI * 2); c.fill();
      } else if (p.kind === 'chip') {
        c.rotate(p.rot); c.fillStyle = P.c(p.color);
        c.beginPath(); c.moveTo(-p.w / 2, -p.h / 2); c.lineTo(p.w / 2, -p.h / 3); c.lineTo(p.w / 3, p.h / 2); c.lineTo(-p.w / 2, p.h / 3); c.closePath(); c.fill();
      } else if (p.kind === 'streak') {
        c.rotate(p.a); c.strokeStyle = P.c(p.color); c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.moveTo(p.d, 0); c.lineTo(p.d + p.len * Math.min(1, p.life * 4), 0); c.stroke();
      }
      c.restore();
    }
    c.globalAlpha = 1;
  }

  // Floating words ("Air full", "The sword!"): lettering, not part of the
  // painted film, so drawn once over the finished frame, after the two
  // misregistered print passes, rather than doubled and boiling with them.
  function floatingTexts(c) {
    const was = P.mode;
    P.mode = 'tint';
    for (const t of fx.texts) {
      c.globalAlpha = Math.min(1, t.life * 2);
      c.font = t.big ? '44px Yesteryear, cursive' : '700 22px "Josefin Sans", sans-serif';
      c.textAlign = 'center';
      c.fillStyle = P.c(PAL.plum); c.fillText(t.str, t.x + 2, t.y + 2);
      c.fillStyle = P.c(t.big ? PAL.gold : PAL.cream); c.fillText(t.str, t.x, t.y);
    }
    c.globalAlpha = 1;
    P.mode = was;
  }

  function footlights(c, t) {
    if (!img('proscenium')) {
      c.fillStyle = P.c(PAL.woodDark); c.fillRect(0, 650, 1280, 70);
      c.fillStyle = P.c(PAL.wood); c.fillRect(0, 650, 1280, 8);
    }
    for (let k = 0; k < 11; k++) {
      const x = 170 + k * 94;
      const f = 0.85 + 0.15 * Math.sin(t * 9 + k * 2.3);
      const g = c.createRadialGradient(x, 652, 2, x, 652, 70);
      g.addColorStop(0, P.mode === 'lum' ? `rgba(255,240,210,${0.45 * f})` : `rgba(255,200,90,${0.45 * f})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x - 70, 590, 140, 70);
      if (img('footlight')) { drawAsset(c, P, img('footlight'), x, 664, 60, 30); continue; }
      c.fillStyle = P.c(PAL.gold);
      c.beginPath(); c.ellipse(x, 660, 20, 7, 0, Math.PI, 0); c.fill();
    }
  }

  function proscenium(c, open, wind, t) {
    const frame = img('proscenium');
    if (frame) {
      // The painted frame is overscanned 1.3x so its columns sit off-screen
      // and its painted drapes frame the playfield. The travelling curtain
      // slides in behind it and hides behind the painted drapes when open.
      if (open < 0.995) curtainPanels(c, 150 + (640 - 150) * (1 - open), open, t, false);
      drawAsset(c, P, frame, 640, 745, 1664, 936);
      if (wind) vane(c, 640, 34, wind, t);
      return;
    }
    curtainPanels(c, STAGE.left + (640 - STAGE.left) * (1 - open), open, t, true);
    // valance with scallops and tassels
    c.fillStyle = P.c(PAL.velvet); c.fillRect(0, 0, 1280, 58);
    c.beginPath();
    for (let x = 0; x < 1280; x += 80) { c.moveTo(x, 50); c.quadraticCurveTo(x + 40, 92, x + 80, 50); }
    c.fill();
    c.strokeStyle = P.c(PAL.gold); c.lineWidth = 4;
    c.beginPath(); for (let x = 0; x < 1280; x += 80) { c.moveTo(x, 54); c.quadraticCurveTo(x + 40, 96, x + 80, 54); } c.stroke();
    c.fillStyle = P.c(PAL.gold);
    for (let x = 80; x < 1280; x += 80) { c.fillRect(x - 2, 52, 4, 16); circle(c, x, 72, 6); }
    c.fillRect(0, 0, 1280, 8);
    // weathervane on the valance: the witch's wind
    if (wind) vane(c, 640, 30, wind, t);
  }

  // The travelling curtain: two velvet panels of width w from each side; when
  // closed (open 0) they meet at centre stage.
  function curtainPanels(c, w, open, t, tieBacks) {
    for (const side of [-1, 1]) {
      c.save();
      if (side === 1) { c.translate(1280, 0); c.scale(-1, 1); }
      if (img('curtain-panel')) {
        // The painted curtain fills x 500-1300 of the 1300x1440 art: draw that
        // 650 px wide with its leading (right) edge at w, slid rather than
        // squashed, and carry its outer folds on to the wing when w is wider.
        // Its leading edge swags in by up to 120 art px (75 stage px) at mid
        // height, so it reaches 75 px past w: closed, the panels overlap there.
        const src = passImage(P, img('curtain-panel')), r = w + 75;
        c.drawImage(src, 500, 0, 800, 1440, r - 650, 0, 650, 720);
        if (r > 650) c.drawImage(src, 500, 0, 60, 1440, 0, 0, r - 650 + 1, 720);
        c.restore(); continue;
      }
      const g = c.createLinearGradient(0, 0, w, 0);
      const folds = Math.max(3, Math.round(w / 44));
      for (let k = 0; k <= folds; k++) {
        g.addColorStop(k / folds, P.c(k % 2 ? PAL.velvetDark : PAL.velvet));
      }
      c.fillStyle = g;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0);
      c.quadraticCurveTo(w - 30 * open, 400, w + 6 * Math.sin(t), 720); c.lineTo(0, 720); c.fill();
      if (tieBacks && open > 0.5) {
        c.fillStyle = P.c(PAL.gold);
        c.beginPath(); c.ellipse(w - 14, 420, 22, 9, 0.2, 0, Math.PI * 2); c.fill();
        c.fillRect(w - 18, 426, 7, 30);
      }
      c.restore();
    }
  }

  function vane(c, x, y, wind, t) {
    const spinning = wind.warn;
    const target = wind.dir > 0 ? 0 : Math.PI;
    const a = spinning ? t * 9 : target;
    c.save(); c.translate(x, y);
    if (img('vane-plaque')) drawAsset(c, P, img('vane-plaque'), 0, 22.5, 140, 45);
    else {
      c.fillStyle = P.c(PAL.plum); c.beginPath(); c.ellipse(0, 0, 70, 22, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = P.c(PAL.gold); c.lineWidth = 2; c.stroke();
    }
    c.scale(Math.cos(a), 1);
    const arrow = spinning && img('vane-arrow-warn') ? 'vane-arrow-warn' : 'vane-arrow';
    if (img(arrow)) { drawAsset(c, P, img(arrow), 0, 12.5, 115, 25); c.restore(); return; }
    c.fillStyle = P.c(spinning ? PAL.magenta : PAL.gold);
    c.beginPath(); c.moveTo(-48, -3); c.lineTo(30, -3); c.lineTo(30, -11); c.lineTo(52, 0); c.lineTo(30, 11); c.lineTo(30, 3); c.lineTo(-48, 3); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-48, 0); c.lineTo(-58, -12); c.lineTo(-36, 0); c.lineTo(-58, 12); c.closePath(); c.fill();
    c.restore();
  }

  // spec = { lanterns, maxLanterns, pearls, progress (0..1, or null for no
  // ribbon), keepsakes: [{ id, have }], wind? } from the act's hud(state).
  function hud(c, spec, t) {
    // The HUD is painted on the stage floor, below the footlights; on the
    // delivered proscenium's patterned floor band it sits on plum plaques.
    c.save(); c.translate(0, 596);
    const plaques = [[140, 390]];
    if (spec.progress != null) plaques.push([450, 830]);
    if (spec.keepsakes?.length) plaques.push([1140 - spec.keepsakes.length * 52 - 24, 1140]);
    if (img('proscenium')) {
      c.fillStyle = P.c(PAL.plum); c.strokeStyle = P.c(PAL.gold); c.lineWidth = 1.5;
      for (const [x0, x1] of plaques) {
        if (plaque(c, x0, 84, x1 - x0, 40)) continue;
        c.beginPath(); c.roundRect(x0, 84, x1 - x0, 40, 8); c.fill(); c.stroke();
      }
    }
    hudItems(c, spec, t);
    c.restore();
  }
  // Three-slice plaque: 20-px ends (40 px in the 2x art), stretched middle.
  // False when the art is missing, so the caller draws its own.
  function plaque(c, x, y, w, h) {
    const im = img('hud-plaque');
    if (!im) return false;
    const src = passImage(P, im), iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    const e = Math.min(ih / 2, iw / 3), ew = Math.min(20, w / 2);
    c.drawImage(src, 0, 0, e, ih, x, y, ew, h);
    c.drawImage(src, e, 0, iw - 2 * e, ih, x + ew, y, Math.max(0, w - 2 * ew), h);
    c.drawImage(src, iw - e, 0, e, ih, x + w - ew, y, ew, h);
    return true;
  }
  // Early underwater warnings are a short rising particle shimmer, never
  // a token/disc/star laid over the scene. Cliff warnings have their own grit.
  function omen(c, x, y, s = 1) {
    c.save();
    for (let i=0;i<14;i++) {
      const seed = ((i*73)%101)/101;
      const age = (kit.t*.65+seed)%1;
      c.globalAlpha = Math.sin(age*Math.PI)*.55;
      c.fillStyle = P.c(i%3 ? '#d9d9cd' : '#e6c68a');
      const dx = Math.sin(i*4.1+age*3)*(8+age*12)*s;
      const size = (1+i%2)*s;
      c.fillRect(x+dx,y-age*30*s,size,size);
    }
    c.restore();
  }
  const drawArt = (c, id, cx, by, w, h, extra = '') => { const im = img(id); if (!im) return false; drawAsset(c, P, im, cx, by, w, h, extra); return true; };

  function hudItems(c, spec, t) {
    const max = spec.maxLanterns ?? 3;
    for (let k = 0; k < max; k++) {
      // Lanterns may be fractional (Act I's pearls mend them): a part-mended
      // lantern is lit from the bottom up by its fraction.
      const fill = Math.max(0, Math.min(1, spec.lanterns - k)), lit = fill >= 0.999;
      const x = 188 + k * 42, y = 104;
      const lamp = img(lit ? 'hud-lantern-lit' : 'hud-lantern-out');
      if (lamp) {
        // At 24 px the lit and dark art look alike, so a lit lantern (or the
        // lit part of a part-mended one) glows, and a dark one is dimmed.
        const glow = (amt) => {
          const g = c.createRadialGradient(x, y + 2, 1, x, y + 2, 20);
          g.addColorStop(0, P.mode === 'lum' ? 'rgba(255,245,215,0.85)' : 'rgba(255,200,90,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.globalAlpha = amt * (0.85 + 0.15 * Math.sin(t * 7 + k)); c.fillStyle = g; c.fillRect(x - 20, y - 18, 40, 40);
        };
        if (lit) { glow(1); c.globalAlpha = 1; drawAsset(c, P, lamp, x, y + 16, 24, 32); }
        else {
          c.globalAlpha = 0.55; drawAsset(c, P, lamp, x, y + 16, 24, 32, 'brightness(0.6)');
          if (fill > 0 && img('hud-lantern-lit')) {
            c.save(); c.beginPath(); c.rect(x - 20, y + 16 - 32 * fill, 40, 32 * fill + 4); c.clip();
            glow(0.8); c.globalAlpha = 1; drawAsset(c, P, img('hud-lantern-lit'), x, y + 16, 24, 32); c.restore();
          }
        }
        c.globalAlpha = 1;
        continue;
      }
      c.fillStyle = P.c(PAL.woodDark); c.fillRect(x - 11, y - 17, 22, 5); c.fillRect(x - 11, y + 12, 22, 5);
      c.fillStyle = P.c(lit ? '#ffcf5c' : '#3b2a2a');
      c.globalAlpha = lit ? 0.9 + 0.1 * Math.sin(t * 7 + k) : 1;
      c.beginPath(); c.ellipse(x, y, 10, 13, 0, 0, Math.PI * 2); c.fill();
      if (!lit && fill > 0) {
        c.save(); c.beginPath(); c.rect(x - 11, y + 13 - 26 * fill, 22, 26 * fill); c.clip();
        c.fillStyle = P.c('#ffcf5c'); c.beginPath(); c.ellipse(x, y, 10, 13, 0, 0, Math.PI * 2); c.fill(); c.restore();
      }
      c.globalAlpha = 1;
    }
    if (!drawArt(c, 'pearl', 320, 118, 26, 26)) { c.fillStyle = P.c('#efe9f2'); circle(c, 320, 104, 10); }
    c.font = '700 24px "Josefin Sans", sans-serif'; c.textAlign = 'left';
    c.fillStyle = P.c(PAL.cream); c.fillText('× ' + (spec.pearls || 0), 336, 113);
    (spec.keepsakes || []).forEach((k, i, all) => {
      c.save(); c.translate(1140 - (all.length - i) * 52 + 14, 104); c.scale(0.7, 0.7);
      keepsakeIcon(c, k.id, t, !k.have);
      c.restore();
    });
    if (spec.progress == null) return;
    const x0 = 470, x1 = 810, y = 100;
    const rope = img('hud-voyage-rope');
    if (rope) {
      // 700x16 art = 350x8 stage px, tiled along the ribbon.
      const src = passImage(P, rope);
      c.save(); c.beginPath(); c.rect(x0, y - 4, x1 - x0, 8); c.clip();
      for (let x = x0; x < x1; x += 350) c.drawImage(src, x, y - 4, 350, 8);
      c.restore();
    } else {
      c.strokeStyle = P.c(PAL.cream); c.lineWidth = 3; c.setLineDash([8, 7]);
      c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); c.setLineDash([]);
    }
    if (!drawArt(c, 'hud-voyage-flag', x1, y + 4, 18, 28)) {
      c.fillStyle = P.c(PAL.coral); c.fillRect(x1 - 3, y - 18, 6, 22);
      c.fillStyle = P.c(PAL.cream); c.beginPath(); c.moveTo(x1 - 3, y - 18); c.lineTo(x1 + 12, y - 13); c.lineTo(x1 - 3, y - 8); c.fill();
    }
    const sx = x0 + (x1 - x0) * Math.min(1, spec.progress);
    if (drawArt(c, 'hud-voyage-ship', sx, y + 4, 30, 25)) return;
    c.fillStyle = P.c(PAL.wood); c.beginPath(); c.moveTo(sx - 12, y - 4); c.lineTo(sx + 12, y - 4); c.lineTo(sx + 8, y + 4); c.lineTo(sx - 8, y + 4); c.fill();
    c.fillStyle = P.c(PAL.cream); c.beginPath(); c.moveTo(sx, y - 20); c.lineTo(sx + 9, y - 6); c.lineTo(sx, y - 6); c.fill();
  }

  // ------------------------------------------------------------ helpers
  function wire(c, x, y0, y1) {
    c.strokeStyle = P.c('#1c1c1c'); c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke();
  }

  // The people's old-film idle frame for this moment (the still when Extra
  // Animations is off or no idle frames are delivered).
  // A recast sprite flicks between its own film idle frames (crew-squire-idle-b
  // and so on), never the legacy figure's.
  const idleId = (id, time, step) => {
    if (!extraAnimations) return id;
    const film = cast[id] && assets.images[cast[id]] ? cast[id] : null;
    return film ? idleFrameId(film, time, (f) => !!assets.images[f], step) : idleFrameId(id, time, (f) => !!img(f), step);
  };
  // A person drawn with the film idle (frames plus the film tricks in
  // idlePose) when Extra Animations is on; the plain still otherwise.
  // `over(c, s, im)` draws something held by the figure (a gift in her
  // hands): called at the figure's bottom centre inside its idle sway, with
  // `s` the stage pixels per art pixel. `onlyOver` draws just what is held,
  // in the same sway (so it can be drawn over a figure in front of hers).
  function drawIdle(c, id, time, cx, by, w, h, step, over, onlyOver = false) {
    if (!img(id)) return false;
    const held = (im) => {
      if (!over) return;
      const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
      over(c, im.fitBox ? Math.min(h / ih, (w * 1.6) / iw) * (im.bodyScale || 1) : h / ih, im);
    };
    if (!extraAnimations) {
      if (!onlyOver) drawAsset(c, P, img(id), cx, by, w, h);
      if (over) { c.save(); c.translate(cx, by); held(img(id)); c.restore(); }
      return true;
    }
    const pose = idlePose(id, time, { step, amp: filmAmp, w, h });
    c.save(); c.translate(cx + pose.dx, by + pose.dy); c.rotate(pose.rot); c.scale(1, pose.sy);
    const im = img(idleId(id, pose.time, step));
    if (!onlyOver) drawAsset(c, P, im, 0, 0, w, h);
    held(im);
    c.restore();
    return true;
  }

  function drawAnimation(c, id, time, cx, by, w, h) {
    if (!extraAnimations) return false;
    const record = assets.anims?.[id];
    if (!record) return false;
    const frame = animationFrame(record.meta, time);
    if (!frame) return false;
    const scale = Math.min(w / frame.sw, h / frame.sh);
    const dw = frame.sw * scale, dh = frame.sh * scale;
    const y = record.meta.anchor === 'centre' ? by - dh / 2 : by - dh;
    c.drawImage(passImage(P, record.image), frame.sx, frame.sy, frame.sw, frame.sh, cx - dw / 2, y, dw, dh);
    return true;
  }

  // Shared primitives for act drawing. kit.c is the context of the pass
  // being painted (print or colour); always draw through it.
  const kit = {
    c: ctx, P, PAL, t: 0, ROWS, STAGE,
    img,
    // Draw `f` after the frame and footlights (this pass), over everything.
    over(f) { overQueue.push(f); },
    anim(id, time, cx, by, w, h) { return drawAnimation(kit.c, id, time, cx, by, w, h); },
    // A person's still, flicked with its idle frames when Extra Animations is
    // on (see idleFrameId); false if the still isn't delivered.
    idle(id, time, cx, by, w, h, step, over, onlyOver) { return drawIdle(kit.c, id, time, cx, by, w, h, step, over, onlyOver); },
    // Draw a delivered image (bottom-centre anchor); false if not delivered.
    asset(id, cx, by, w, h, extra = '') { const im = img(id); if (!im) return false; drawAsset(kit.c, P, im, cx, by, w, h, extra); return true; },
    // Part of a delivered image: source rect in art pixels -> stage box.
    assetCrop(id, sx, sy, sw, sh, dx, dy, dw, dh) { const im = img(id); if (!im) return false; kit.c.drawImage(passImage(P, im), sx, sy, sw, sh, dx, dy, dw, dh); return true; },
    // a canvas derived from a delivered image (masked, say), through the same print pass
    imageCrop(src, sx, sy, sw, sh, dx, dy, dw, dh) { kit.c.drawImage(passImage(P, src), sx, sy, sw, sh, dx, dy, dw, dh); return true; },
    col: (hex) => P.c(hex),
    wire: (x, y0, y1) => wire(kit.c, x, y0, y1),
    circle: (x, y, r) => circle(kit.c, x, y, r),
    star: (x, y, r) => star(kit.c, x, y, r),
    cloud: (x, y, s, colr = PAL.lavender) => cloudFlat(kit.c, x, y, s, colr),
    moon: (x, y, r) => moonFace(kit.c, x, y, r, kit.t),
    sky: (b) => backdrop(kit.c, b, kit.t),
    waves: (r, scrolled, yOff = 0) => { if (yOff) { kit.c.save(); kit.c.translate(0, yOff); } waves(kit.c, r, scrolled, kit.t); if (yOff) kit.c.restore(); },
    lighthouse: (x, y, lit) => lighthouse(kit.c, x, y, kit.t, lit),
    band: (k, title) => bandTrio(kit.c, k, title, kit.t),
    plaque: (x, y, w, h) => plaque(kit.c, x, y, w, h),
    omen: (x, y, s = 1) => omen(kit.c, x, y, s),
    keepsake: (kind, x, y, s = 1, empty = false) => { kit.c.save(); kit.c.translate(x, y); kit.c.scale(s, s); keepsakeIcon(kit.c, kind, kit.t, empty); kit.c.restore(); },
    moonboat: (x, y, face = -1, s = 1) => moonboatAt(kit.c, x, y, face, s, kit.t),
    voyage: (b, opts) => voyage(kit.c, b, kit.t, opts),
    voyageEvent,
    burst, text,
    flash: (v = 1) => { fx.flash = Math.max(fx.flash, v); },
    shake: (v = 0.4) => { fx.shake = Math.max(fx.shake, v); },
    // A wash over the whole stage (for scene tints, whiteouts and the deep).
    // Draw f() fixed to the screen, not the zoomed stage: instructions and
    // gauges an act paints at set places while the mobile camera is in.
    flat(f) { if (!camOn) return f(); const c = kit.c; c.save(); c.setTransform(camBase); f(); c.restore(); },
    wash: (hex, alpha) => { kit.c.save(); kit.c.globalAlpha = alpha; kit.c.fillStyle = P.c(hex); kit.c.fillRect(0, 0, 1280, 720); kit.c.restore(); },
    // An iris closing on (x, y): radius r (0 = black).
    // Drawn over the frame, so a point on the stage goes through the camera.
    iris: (x, y, r) => { const q = camPoint(x, y); x = q.x; y = q.y; r *= q.s; const c = kit.c; c.save(); c.fillStyle = '#000'; c.beginPath(); c.rect(0, 0, 1280, 720); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2, true); c.fill('evenodd'); c.restore(); },
  };

  return {
    setMinFont(px) { minFont = px; },
    render, tick, onEvent, kit,
    setLamp(v) { view_lamp = v; },
    clearFx() { fx.particles = []; fx.texts = []; fx.flash = 0; fx.shake = 0; witch.x = witch.tx = 1450; },
  };
}

// Seamless tiling spans of the delivered wave strips, in art pixels: measured
// so the columns at x0 and x0 + len match (see the Art section of README.md).
const WAVE_ART = [
  { id: 'waves-back', x0: 324, len: 2086 },
  { id: 'waves-mid', x0: 326, len: 2028 },
  { id: 'waves-front', x0: 152, len: 1899 },
];

const LABEL = FILM ? TEXT.hud.keepsakes : TEXT.hud.keepsakesClassic;

function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function star(c, x, y, r) {
  c.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.42 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath(); c.fill();
}

// ---------------------------------------------------------------- button prompts
// Prompt text may name buttons as [A], [B], [MENU] or [LS]. They are drawn
// for the input in use (`mode`): Xbox controller buttons ('pad'), key caps
// ('key') or the on-screen touch buttons ('touch').
const GLYPH_KEYS = TEXT.glyphs.keys;
const XBOX = { A: '#3fa535', B: '#d6262c', X: '#2a6fd6', Y: '#e8b320' };
// On touch the buttons carry no letters, only what they do here, so a prompt
// names them the same way (the shell keeps these current; setTouchNames).
const TOUCH_NAMES = TEXT.glyphs.touch;
let touchNames = { ...TOUCH_NAMES };
export function setTouchNames({ A, X } = {}) { touchNames = { ...TOUCH_NAMES, ...(A ? { A } : {}), ...(X ? { X } : {}) }; }
const touchFont = (px) => `700 ${Math.round(px * 0.55)}px "Josefin Sans", sans-serif`;
function glyphWidth(c, tok, mode, px) {
  if (mode === 'touch') { c.save(); c.font = touchFont(px); const w = c.measureText(touchNames[tok].toUpperCase()).width; c.restore(); return w + px * 0.8; }
  if (mode === 'key') { c.save(); c.font = `700 ${Math.round(px * 0.55)}px "Josefin Sans", sans-serif`; const w = c.measureText(GLYPH_KEYS[tok]).width; c.restore(); return w + px * 0.7; }
  return px * 1.0;
}
function drawGlyph(c, tok, mode, cx, cy, px, col) {
  const r = px * 0.44;
  c.save(); c.globalAlpha = Math.min(1, c.globalAlpha * 1.6);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (mode === 'key') {
    c.font = `700 ${Math.round(px * 0.55)}px "Josefin Sans", sans-serif`;
    const w = c.measureText(GLYPH_KEYS[tok]).width + px * 0.5, h = px * 0.82;
    c.fillStyle = col('#f1e3c8'); c.strokeStyle = col('#2a1424'); c.lineWidth = Math.max(1.5, px * 0.06);
    c.beginPath(); c.roundRect(cx - w / 2, cy - h / 2, w, h, px * 0.14); c.fill(); c.stroke();
    c.fillStyle = col('#2a1424'); c.fillText(GLYPH_KEYS[tok], cx, cy + px * 0.03);
  } else if (mode === 'touch') {
    // a gold pill with the button's name ("Leap", "Take"); touch's second button stands in for X
    const name = touchNames[tok].toUpperCase();
    c.font = touchFont(px);
    const w = c.measureText(name).width + px * 0.6, h = px * 0.88;
    c.fillStyle = col('#b8862e'); c.strokeStyle = col('#f1e3c8'); c.lineWidth = Math.max(1.5, px * 0.06);
    c.beginPath(); c.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2); c.fill(); c.stroke();
    c.fillStyle = col('#fff8e8'); c.fillText(name, cx, cy + px * 0.03);
  } else {
    // Xbox: A, B, X, Y in their colours; Menu and the left stick in charcoal.
    const face = XBOX[tok];
    c.fillStyle = col(face || '#36303a'); c.strokeStyle = col('#140a12'); c.lineWidth = Math.max(1.5, px * 0.07);
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = col('#ffffff'); c.strokeStyle = col('#ffffff');
    if (face) { c.font = `700 ${Math.round(px * 0.52)}px "Josefin Sans", sans-serif`; c.fillText(tok, cx, cy + px * 0.04); }
    else if (tok === 'MENU') { c.lineWidth = Math.max(1.2, px * 0.07); for (const dy of [-0.16, 0, 0.16]) { c.beginPath(); c.moveTo(cx - r * 0.45, cy + dy * px); c.lineTo(cx + r * 0.45, cy + dy * px); c.stroke(); } }
    else { c.lineWidth = Math.max(1.2, px * 0.06); c.beginPath(); c.arc(cx, cy, r * 0.62, 0, Math.PI * 2); c.stroke(); c.font = `700 ${Math.round(px * 0.3)}px "Josefin Sans", sans-serif`; c.fillText('LS', cx, cy + px * 0.02); }
  }
  c.restore();
}
// Draw one line of prompt text centred on x (baseline y) with its button glyphs.
export function richText(c, str, x, y, { px, mode = 'key', col = (h) => h } = {}) {
  const parts = str.split(/\[(A|B|X|MENU|LS)\]/);
  const gap = px * 0.18;
  const widths = parts.map((p, i) => (i % 2 ? glyphWidth(c, p, mode, px) + gap * 2 : c.measureText(p).width));
  const total = widths.reduce((a, b) => a + b, 0);
  const align = c.textAlign;
  let at = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
  c.save(); c.textAlign = 'left';
  parts.forEach((p, i) => {
    if (i % 2) drawGlyph(c, p, mode, at + widths[i] / 2, y - px * 0.34, px, col);
    else c.fillText(p, at, y);
    at += widths[i];
  });
  c.restore();
}

// ---------------------------------------------------------------- intertitles
// Cards copy the video's title cards: swash script in pale pink on plum or
// magenta, inside a fine double rule.
export function drawCard(c, card, t) {
  const a = Math.min(1, card.alpha ?? 1);
  if (a <= 0) return;
  c.save();
  c.globalAlpha = a;
  c.fillStyle = card.bg === 'magenta' ? PAL.magenta : PAL.plum;
  c.fillRect(0, 0, 1280, 720);
  c.strokeStyle = card.bg === 'magenta' ? '#f7b9d6' : '#c79ab7';
  c.lineWidth = 2;
  c.strokeRect(150, 70, 980, 580); c.strokeRect(162, 82, 956, 556);
  c.textAlign = 'center'; c.fillStyle = PAL.pink;
  if (card.body) {
    // A silent-film intertitle: a few lines of swash script, centred.
    const px = card.size || 58, lines = card.body.split('\n'), lh = px * 1.12;
    c.font = `${px}px Yesteryear, cursive`;
    lines.forEach((l, i) => richText(c, l, 640, 372 + (i - (lines.length - 1) / 2) * lh, { px, mode: card.mode }));
    c.fillStyle = PAL.pink; c.font = '700 22px "Josefin Sans", sans-serif';
    c.fillText('· ✦ ·', 640, 140);
  }
  const lines = (card.title || '').split('\n');
  if (card.kicker) { c.font = '700 26px "Josefin Sans", sans-serif'; c.fillText(card.kicker.toUpperCase(), 640, 200 - (lines.length - 1) * 50); }
  c.font = `${card.size || 120}px Yesteryear, cursive`;
  lines.forEach((l, i) => c.fillText(l, 640, 330 + i * (card.size || 120) * 0.95 - (lines.length - 1) * 50));
  if (card.sub) {
    c.font = '700 24px "Josefin Sans", sans-serif';
    card.sub.split('\n').forEach((l, i) => richText(c, l, 640, 500 + i * 34, { px: 24, mode: card.mode }));
  }
  if (card.error) {
    c.font = '600 22px "Josefin Sans", sans-serif'; c.fillStyle = PAL.pink;
    c.textAlign = 'center'; c.fillText(card.error,640,595);
  } else if (card.loading != null) {
    // The song is still loading: a thin double-ruled bar where the prompt goes.
    c.globalAlpha = a;
    c.strokeStyle = card.bg === 'magenta' ? '#f7b9d6' : '#c79ab7'; c.lineWidth = 1.5;
    c.strokeRect(480, 586, 320, 12); c.strokeRect(476, 582, 328, 20);
    c.fillStyle = PAL.pink; c.fillRect(482, 588, 316 * card.loading, 8);
    c.font = '700 18px "Josefin Sans", sans-serif';
    c.fillText(card.loadingText || (LEGACY ? TEXT.shell.loading.cardBand : TEXT.shell.loading.cardOrchestra), 640, 626);
  } else if (card.prompt) {
    c.globalAlpha = a * (0.55 + 0.45 * Math.sin(t * 3));
    c.font = '30px Yesteryear, cursive';
    richText(c, card.prompt, 640, 600, { px: 30, mode: card.mode });
  }
  c.restore();
}

// ---------------------------------------------------------------- film look
function makeGrain() {
  return Array.from({ length: 4 }, () => {
    const g = document.createElement('canvas');
    g.width = g.height = 256;
    const x = g.getContext('2d');
    const d = x.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() * 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    return g;
  });
}

// Soft low-frequency blotches, larger than the stage so they can be shifted.
function makeDye() {
  const small = document.createElement('canvas');
  small.width = 64; small.height = 36;
  const x = small.getContext('2d');
  const d = x.createImageData(64, 36);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random();
    d.data[i] = d.data[i + 1] = d.data[i + 2] = 0;
    d.data[i + 3] = v > 0.55 ? (v - 0.55) * 560 : 0;
  }
  x.putImageData(d, 0, 0);
  const big = document.createElement('canvas');
  big.width = 1600; big.height = 900;
  const b = big.getContext('2d');
  b.imageSmoothingEnabled = true;
  b.filter = 'blur(6px)';
  b.drawImage(small, 0, 0, 1600, 900);
  b.filter = 'none';
  return big;
}

let vignette = null;
function filmLook(c, level, t, grain) {
  if (!vignette) {
    vignette = c.createRadialGradient(640, 360, 300, 640, 360, 820);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(10,4,8,0.75)');
  }
  c.fillStyle = vignette; c.fillRect(0, 0, 1280, 720);
  if (level === 'off') return;
  const full = level === 'full';
  // grain
  c.save();
  c.globalCompositeOperation = 'overlay';
  c.globalAlpha = full ? 0.16 : 0.08;
  const g = grain[(Math.random() * 4) | 0];
  const ox = (Math.random() * 256) | 0, oy = (Math.random() * 256) | 0;
  for (let x = -ox; x < 1280; x += 256) for (let y = -oy; y < 720; y += 256) c.drawImage(g, x, y);
  c.restore();
  if (!full) return;
  // flicker
  c.fillStyle = `rgba(0,0,0,${Math.random() * 0.07})`; c.fillRect(0, 0, 1280, 720);
  // scratches and dust
  c.strokeStyle = 'rgba(240,230,210,0.35)'; c.lineWidth = 1;
  if (Math.random() < 0.3) {
    const x = Math.random() * 1280;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (Math.random() - 0.5) * 8, 720); c.stroke();
  }
  c.fillStyle = 'rgba(20,12,10,0.6)';
  for (let k = 0; k < 4; k++) if (Math.random() < 0.4) circle(c, Math.random() * 1280, Math.random() * 720, Math.random() * 2.5 + 0.5);
}
