// The shell: screens, menus and navigation, the field guide, the bird pages,
// and running a minigame (count-in, HUD, pause, results and best scores).

import { createInput, BTN } from './input.js';
import * as audio from './audio.js';
import { keepForSessionOnly, loadSettings, saveSettings, loadProgress, recordScore, bestAt, tallyAt, resetProgress, canRestore, restoreProgress, keepOldPasses, loadStickers, saveStickers, resetStickers, loadPhotos, savePhotos } from './store.js';
import { BIRDS, passes } from './birds.js';
import { loadGame, makeRng } from './games/index.js';
import { LEVEL_NAMES } from './games/difficulty.js';
import { pointsFor } from './points.js';
import { controlLines as controlLinesFor } from './controls.js';
import { drawBird, drawSilhouette, paper, band, label, setArt, setBoil, art, PAL, INK } from './draw.js';
import { ASSETS } from './asset-list.js';
import { roundOutcome, turnsOver, spottedLine, skipFrom, stepAt, END, HOLD_TO_SKIP, UNLOCK, UNLOCK_TIME, resultKind, resultTiming, RESULT_TITLES, spreadCount, sheetCells } from './reward.js';
import * as fs from './fullscreen.js';
import { drawCelebration, sticker, drawStickerBook, stickerBookLayout, stickerSize, stickerSpot, regionRect, regionSize, SNAP_TIME, snapGrey } from './celebrate.js';
import { prepareWhenIdle } from './celebrate.js';
import { normalizeBook, emptyBook, backgrounds, cycle, shownBackground, placeOnSpread, moveSticker, drawOrder, pagePoint, PLAIN, GATHERING, regionsFromAtlas, toPicture, dropOnPicture, regionAt, snapSticker, placeFree, toSheet, gatherState, clampCam, bookToStage, stageToBook, edgePush } from './stickerbook.js';
import { normalizePhotos, nextPhotoRound } from './photo-album.js';
import { SUBJECT_IDS } from './subjects.js';

const W = 1600;
const H = 900;
const params = new URLSearchParams(location.search);
const FIXED_DT = Number(params.get('dt')) || 0; // for automated checks
// Every page can be played from the start. ?debug shows every card turned
// over (?all is the old name for that), and every round that reaches its
// score plays the whole celebration, as if for the first time.
const DEBUG = params.has('debug');
const ALL_OPEN = DEBUG || params.has('all');
if (DEBUG) keepForSessionOnly();

const $ = (s) => document.querySelector(s);
const canvas = $('#stage');
const g = canvas.getContext('2d');
const input = createInput(canvas);
let settings = loadSettings();
let progress = loadProgress();
keepOldPasses(progress, BIRDS);
const BIRD_IDS = BIRDS.map((b) => b.id);
const SPREADS = spreadCount(BIRDS.length);
// The sticker book: where the player has put each sticker, its picture and
// the spread it is open at, kept from visit to visit.
let book = normalizeBook(loadStickers(), BIRD_IDS, SPREADS);

let photos = normalizePhotos(loadPhotos());
let photoSerial = 0;

const S = {
  screen: 'loading',
  modals: [], // stack of open modal ids
  titleUtil: false,
  bird: 0, // index into BIRDS
  game: null,
  gameId: null,
  phase: 'idle', // 'loading' | 'count' | 'play' | 'over' | 'result'
  resultT: 0, // how long the brief result card has been up
  cele: null, // the sticker celebration, while it runs (screen 'celebrate')
  unlock: null, // the guide's card turning over, after a bird is first spotted
  last: null, // how the last round ended: { id, score, points, level, outcome }
  points: null, // the round's points (points.js), while it is played
  count: 0,
  overT: 0,
  paused: false,
  t: 0,
  confirmFn: null,
  seed: 1,
};

// ---------- assets ----------

// One picture, tried up to `tries` times: a phone on a poor connection can
// drop a request, and a picture that never loads would leave its stand-in
// drawn for the whole visit.
function loadImage(file, tries = 3) {
  return new Promise((res) => {
    const attempt = (n) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => {
        if (n + 1 < tries) setTimeout(() => attempt(n + 1), 600 * (n + 1));
        else {
          console.warn('[art] could not load', file);
          res(null);
        }
      };
      img.src = n ? `${file}?retry=${n}` : file;
    };
    attempt(0);
  });
}

const artMap = new Map();
// Every delivered picture, loaded before the game shows anything, with a
// loading bar meanwhile: nothing drawn in code ever stands in for a picture
// that has been delivered.
async function loadArt() {
  const map = artMap;
  const todo = Object.entries(ASSETS).filter(([, a]) => a.delivered);
  let done = 0;
  const bar = $('#loading-fill');
  await Promise.all(
    todo.map(([key, a]) =>
      loadImage(a.file).then((img) => {
        if (img) map.set(key, img);
        done++;
        bar.style.width = `${Math.round((done / todo.length) * 100)}%`;
        bar.parentElement.setAttribute('aria-valuenow', Math.round((done / todo.length) * 100));
      }),
    ),
  );
  setArt(map);
  // the gathering painting's atlas: where each bird is in it
  const atlas = async (file) => {
    try {
      const r = await fetch(file);
      return r.ok ? regionsFromAtlas(await r.json()) : null;
    } catch {
      return null;
    }
  };
  [ATLAS, UI_ATLAS] = await Promise.all([atlas('assets/book/gathering.atlas.json'), atlas('assets/ui/gathering.atlas.json')]);
}
// Before a game starts, another try at any delivered picture that failed to
// load (waiting at most a few seconds), so a dropped request doesn't leave a
// game on its stand-ins for the rest of the visit.
function reloadMissing() {
  const missing = Object.entries(ASSETS).filter(([key, a]) => a.delivered && !artMap.has(key));
  if (!missing.length) return Promise.resolve();
  const all = Promise.all(missing.map(([key, a]) => loadImage(a.file, 2).then((img) => img && artMap.set(key, img))));
  return Promise.race([all, new Promise((r) => setTimeout(r, 4000))]);
}
// Where each bird is in the gathering's two paintings: the book's (2:1, two
// pages) and the finale's (16:9); null until loaded, or if missing.
let ATLAS = null;
let UI_ATLAS = null;

// ---------- canvas sizing ----------

let view = { s: 1, ox: 0, oy: 0, cw: 0, ch: 0, dpr: 1 };
function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  view = { cw, ch, dpr };
  fitView();
}

// The whole scene, letterboxed: for the menus, and for play on wide screens.
function fitView() {
  const { cw, ch, dpr } = view;
  const s = Math.min(cw / W, ch / H);
  view = { s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2, cw, ch, dpr };
}

// In play on a narrow (portrait) screen, fitting the whole 1600-wide scene
// would make it tiny. Instead the scene keeps a playable size, at least the
// game's `span` across, and the view follows the game's `focus` left and
// right, never past the scene's edges.
let camX = W / 2;
function playView(dt) {
  const { cw, ch, dpr } = view;
  const gm = S.game;
  const span = gm?.span || 760;
  const s = Math.min(ch / H, Math.max(cw / W, cw / span));
  const want = gm?.focus ? gm.focus() : W / 2;
  camX = Math.abs(want - camX) > W ? want : camX + (want - camX) * Math.min(1, dt * 6);
  const ox = Math.min(0, Math.max(cw - W * s, cw / 2 - camX * s));
  view = { s, ox: W * s <= cw ? (cw - W * s) / 2 : ox, oy: (ch - H * s) / 2, cw, ch, dpr };
}
addEventListener('resize', resize);
document.addEventListener('fullscreenchange', () => {
  resize();
  syncFullscreenUi();
});
document.addEventListener('webkitfullscreenchange', () => {
  resize();
  syncFullscreenUi();
});
input.setPointerMap((cx, cy) => {
  const r = canvas.getBoundingClientRect();
  return [(cx - r.left - view.ox) / view.s, (cy - r.top - view.oy) / view.s];
});

// Draw in logical 1600 x 900 units, letterboxed on paper.
function logical() {
  g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  paper(g, view.cw, view.ch);
  g.setTransform(view.dpr * view.s, 0, 0, view.dpr * view.s, view.dpr * view.ox, view.dpr * view.oy);
}

// ---------- screens and modals ----------

const SCREENS = ['title', 'guide', 'page', 'gathering', 'celebrate', 'stickers'];

function show(screen) {
  S.screen = screen;
  for (const id of SCREENS) $('#' + id).hidden = id !== screen;
  $('#hud').hidden = screen !== 'play';
  if (screen !== 'play') {
    closeAll();
    for (const m of ['pause', 'result']) $('#' + m).hidden = true;
    S.phase = 'idle';
    S.game = null;
  }
  input.lockHeld();
  if (screen !== 'celebrate') S.cele = null;
  if (screen !== 'guide') S.unlock = null;
  if (screen !== 'stickers') S.sb = null;
  if (screen === 'title') {
    S.titleUtil = false;
    focusFirst();
    audio.playMusic('title');
  } else if (screen === 'guide') {
    buildGuide();
    audio.playMusic('guide', { after: 'title' });
  } else if (screen === 'page') {
    fillPage();
    audio.playMusic('guide', { after: 'title' });
  } else if (screen === 'celebrate') {
    // The game's music carries on under the fanfare.
    document.activeElement?.blur?.();
  } else if (screen === 'stickers') {
    openStickerBook();
    audio.playMusic('guide', { after: 'title' });
  } else if (screen === 'gathering') {
    $('#gathering-count').textContent = `Every one of the ${BIRDS.length} rare birds, spotted.`;
    audio.playMusic('carousel');
    focusFirst();
  }
}

// Only the dialog on top shows; what it was opened from steps out of sight.
function underTop() {
  const top = S.modals.at(-1);
  for (const el of document.querySelectorAll('.modal')) el.classList.toggle('under', !!top && el.id !== top);
}

function openModal(id) {
  S.modals.push(id);
  const el = $('#' + id);
  el.hidden = false;
  el.dataset.returnFocus = document.activeElement?.id || '';
  el._returnTo = document.activeElement;
  if (id === 'settings') syncSettingsUi();
  if (id === 'howto') fillHowto();
  el.querySelector('.leaf-hint')?.replaceChildren(leafHint());
  underTop();
  input.lockHeld();
  focusFirst();
}

function closeModal() {
  const id = S.modals.pop();
  if (!id) return;
  const el = $('#' + id);
  el.hidden = true;
  underTop();
  input.lockHeld();
  const back = el._returnTo;
  if (back && document.contains(back) && !back.closest('[hidden]')) back.focus();
  else focusFirst();
}

// Close every dialog at once (leaving play, or straight back to the game).
function closeAll() {
  for (const id of S.modals.splice(0)) $('#' + id).hidden = true;
  underTop();
}

// A leaf page (How to play, Controls) has nothing to choose but its one
// button: A goes straight back to the game, B one step back.
function leafHint() {
  const inGame = S.screen === 'play';
  if (pad()) return inGame ? 'A: back to the game · B: back' : 'A or B: close';
  if (input.kind === 'keyboard') return inGame ? 'Enter: back to the game · Esc: back' : 'Enter or Esc: close';
  return inGame ? 'Tap outside to go back to the game' : 'Tap outside to close';
}

// Straight back to the game from anywhere in the pause menu.
function toGame() {
  closeAll();
  if (S.screen === 'play' && S.paused && $('#result').hidden) resume();
  else focusFirst();
}

function layer() {
  if (S.modals.length) return $('#' + S.modals[S.modals.length - 1]);
  if (S.screen === 'play') {
    for (const m of ['result', 'pause']) if (!$('#' + m).hidden) return $('#' + m);
    return null;
  }
  return $('#' + S.screen);
}

function navItems() {
  const l = layer();
  if (!l) return [];
  return [...l.querySelectorAll('[data-nav]')].filter((e) => !e.closest('[hidden]') && !e.disabled && e.offsetParent !== null);
}

function focusFirst(force = false) {
  // On a leaf page nothing is chosen until the stick moves, so A goes back.
  if (!force && layer()?.hasAttribute('data-leaf')) {
    document.activeElement?.blur?.();
    return;
  }
  const items = navItems();
  const primary = items.find((e) => e.classList.contains('primary')) || items[0];
  if (primary) primary.focus({ preventScroll: S.screen === 'page' });
}

function moveFocus(dx, dy) {
  const items = navItems();
  if (!items.length) return;
  const cur = document.activeElement;
  if (!items.includes(cur)) {
    focusFirst(true);
    return;
  }
  const r0 = cur.getBoundingClientRect();
  const c0 = [r0.left + r0.width / 2, r0.top + r0.height / 2];
  // The nearest item that way, from `list`.
  const nearest = (list) => {
    let bestEl = null;
    let bestScore = Infinity;
    for (const e of list) {
      if (e === cur) continue;
      const r = e.getBoundingClientRect();
      const c = [r.left + r.width / 2, r.top + r.height / 2];
      const vx = c[0] - c0[0];
      const vy = c[1] - c0[1];
      const along = vx * dx + vy * dy;
      if (along <= 4) continue;
      const across = Math.abs(vx * dy - vy * dx);
      const score = along + across * 2.2;
      if (score < bestScore) {
        bestScore = score;
        bestEl = e;
      }
    }
    return bestEl;
  };
  // In a group (the guide's cards) the next one in it comes first: down goes
  // to the next row, not to the buttons below, until the last row; past the
  // end of a row, left and right go on to the next row.
  const group = cur.closest('[data-nav-group]');
  let bestEl = null;
  if (group) {
    const own = items.filter((e) => group.contains(e));
    bestEl = nearest(own);
    if (!bestEl && dx) bestEl = own[own.indexOf(cur) + dx] || null;
  }
  // In a list (Settings) up and down go row by row, in order, whatever
  // the widths of the controls on each row.
  const list = cur.closest('[data-nav-list]');
  if (!bestEl && list && dy) {
    const own = items.filter((e) => list.contains(e));
    bestEl = own[own.indexOf(cur) + dy] || null;
  }
  bestEl ||= nearest(items);
  if (!bestEl) {
    // Nothing that way: step through the list in order instead.
    const i = items.indexOf(cur);
    const step = dx + dy > 0 ? 1 : -1;
    bestEl = items[(i + step + items.length) % items.length];
  }
  bestEl.focus({ preventScroll: true });
  bestEl.scrollIntoView?.({ block: 'nearest' });
  audio.sfx('move');
}

// ---------- the guide ----------

// The best points at the Difficulty chosen in Settings: each level keeps its own.
const best = (id) => bestAt(progress[id], settings.difficulty);
// A bird once passed stays passed, even if its pass mark is raised later, and
// whatever level it was passed at. (An old save's plain best is a Normal one.)
const passed = (i) => !!progress[BIRDS[i].id]?.passed || passes(BIRDS[i], tallyAt(progress[BIRDS[i].id], 'normal'));
// "19 points", "1 point".
const pointsText = (n) => `${n} point${n === 1 ? '' : 's'}`;
// A round's plain score and its points: ["12 scoops", "19 points"]. When the
// bird's own score is already counted in points: ["12 points", "19 with the bonus"].
function scoreParts(b, score, pts) {
  const word = score === 1 ? one(b.score) : b.score;
  return [`${score} ${word}`, /^points?$/.test(b.score) ? `${pts} with the bonus` : pointsText(pts)];
}
// The same on the result card: "12 scoops · 19 points" as text, shown as two
// lines, the points under the score (styles.css: .result-points).
function fillScore(el, b, score, pts) {
  const [tally, points] = scoreParts(b, score, pts);
  const span = document.createElement('span');
  span.className = 'result-points';
  const sep = document.createElement('span');
  sep.className = 'sep';
  sep.textContent = '· ';
  span.append(sep, points);
  el.textContent = `${tally} `;
  el.append(span);
}
// Whether a card (and its page) shows the bird's painting, name and rhyme:
// once the bird is spotted (its score reached), or always in ?debug. The card
// turning over after a pass shows its silhouette until it flips, even in
// ?debug. Every card can be played either way.
const shown = (i) => (S.unlock?.i === i && !S.unlock.revealed ? false : ALL_OPEN || passed(i));
const spottedCount = () => BIRDS.filter((b, i) => passed(i)).length;

function buildGuide() {
  const wrap = $('#cards');
  wrap.textContent = '';
  BIRDS.forEach((b, i) => {
    const card = document.createElement('button');
    card.dataset.nav = '';
    card.dataset.bird = i;
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'card-name';
    const sub = document.createElement('span');
    sub.className = 'card-sub';
    card.append(cv, name, sub);
    fillCard(card);
    card.addEventListener('click', () => {
      audio.unlock();
      audio.sfx('page');
      S.bird = i;
      show('page');
    });
    wrap.append(card);
  });
  const spotted = spottedCount();
  $('#guide-count').textContent = `${spotted} of ${BIRDS.length} birds spotted`;
  $('#gathering-btn').hidden = spotted < BIRDS.length && !ALL_OPEN;
  const target = wrap.children[Math.min(S.bird, BIRDS.length - 1)];
  target?.focus({ preventScroll: true });
  target?.scrollIntoView?.({ block: 'center' });
}

// A card's words, spotted or not. Every card names its bird and its game; a
// bird not yet spotted shows its silhouette on darker paper.
function fillCard(card) {
  const i = Number(card.dataset.bird);
  const b = BIRDS[i];
  const open = shown(i);
  const hi = best(b.id);
  card.classList.toggle('unspotted', !open);
  card.classList.add('card');
  const bestText = hi ? `, best ${pointsText(hi)}` : '';
  card.setAttribute('aria-label', `${b.name}, ${b.game}${open ? '' : ', not yet spotted'}${bestText}`);
  card.querySelector('.card-name').textContent = b.name.replace(/^The /, '');
  // (no room on a small card for a note as well: the silhouette and the
  // darker paper say it)
  card.querySelector('.card-sub').textContent = hi ? `${b.game} · best ${hi} pts` : b.game;
}

// Back to the guide with `sel` chosen; with `open`, that card (the bird just
// spotted) shows its silhouette, then turns over to its painting and shines
// first (a press skips it).
function toGuide(sel, open = -1) {
  S.bird = sel;
  show('guide');
  if (open < 0) return;
  S.unlock = { i: open, t: 0, revealed: false };
  const card = guideCard(open);
  fillCard(card);
  document.activeElement?.blur?.();
  card.classList.add('unlocking');
  card.scrollIntoView?.({ block: 'nearest' });
  $('#guide-live').textContent = '';
}
const guideCard = (i) => $(`#cards .card[data-bird="${i}"]`);

function tickUnlock(dt) {
  const u = S.unlock;
  u.t += dt;
  const card = guideCard(u.i);
  if (!card) {
    S.unlock = null;
    return;
  }
  const flip = (u.t - UNLOCK.wait) / UNLOCK.flip;
  if (!u.revealed && flip >= 0.5) revealCard(u, card);
  if (!settings.reduceMotion) {
    const a = flip <= 0 ? Math.sin(u.t * 40) * 1.5 * Math.min(1, u.t * 4) : flip < 1 ? 180 * flip : 180;
    const lift = Math.sin(Math.PI * Math.max(0, Math.min(1, flip)));
    // a half turn, with the face shown the right way round after the middle
    const deg = flip <= 0 ? a : flip < 0.5 ? a : a - 180;
    card.style.transform = flip <= 0 ? `rotate(${deg * 0.4}deg)` : `perspective(700px) rotateY(${deg}deg) scale(${1 + 0.12 * lift})`;
  }
  if (u.t >= UNLOCK_TIME) endUnlock();
}

function revealCard(u, card) {
  u.revealed = true;
  fillCard(card);
  audio.sfx('bloom');
  $('#guide-live').textContent = `Spotted: ${BIRDS[u.i].name}.`;
}

// The card is turned over, and chosen.
function endUnlock() {
  const u = S.unlock;
  if (!u) return;
  const card = guideCard(u.i);
  if (card && !u.revealed) revealCard(u, card);
  S.unlock = null;
  if (card) {
    card.classList.remove('unlocking');
    card.style.transform = '';
    card.focus();
  }
  input.lockHeld();
}

// Only cards in view are drawn, and each only when something about it
// changes (spotted, resized); the chosen card, and one turning over, every frame.
function drawCards(t) {
  const wrap = $('#cards');
  const vr = wrap.getBoundingClientRect();
  const dpr = view.dpr;
  for (const card of wrap.querySelectorAll('.card')) {
    const cv = card.querySelector('canvas');
    const i = Number(card.dataset.bird);
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (!w || !h) continue;
    const r = card.getBoundingClientRect();
    if (r.bottom < vr.top - 40 || r.top > vr.bottom + 40) continue; // drawn when it scrolls into view
    const u = S.unlock?.i === i ? S.unlock : null;
    const live = card === document.activeElement || !!u;
    const key = `${shown(i)}|${w}|${h}|${dpr}`;
    if (!live && cv._drawn === key) continue;
    cv._drawn = live ? '' : key;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const size = Math.min(h * 0.92, w * 1.0);
    const opts = { x: w / 2 + size * 0.08, y: h * 0.96, size, t: card === document.activeElement ? t : 0, pose: { growth: 0.2, light: 'green', fill: 0.6 } }; // the Plume as a sprout, so it fits its card
    if (u && settings.reduceMotion) {
      // no turning over: the shadow fades and the bird shows through
      const k = Math.max(0, Math.min(1, (u.t - UNLOCK.wait) / UNLOCK.flip));
      c.globalAlpha = k;
      drawBird(c, BIRDS[i].id, opts);
      c.globalAlpha = 1 - k;
      drawSilhouette(c, BIRDS[i].id, opts);
      c.globalAlpha = 1;
    } else if (shown(i)) drawBird(c, BIRDS[i].id, opts);
    else drawSilhouette(c, BIRDS[i].id, opts);
    if (u && u.revealed && !settings.reduceMotion) shineCard(c, w, h, (u.t - UNLOCK.wait - UNLOCK.flip * 0.5) / (UNLOCK.flip * 0.5 + UNLOCK.shine), t);
  }
}

// A light sweeping across a card's bird as it turns over, and a few glints.
function shineCard(c, w, h, k, t) {
  if (k < 0 || k > 1) return;
  c.save();
  c.globalCompositeOperation = 'source-atop';
  const x = -w * 0.5 + k * w * 2;
  const grd = c.createLinearGradient(x - w * 0.3, 0, x + w * 0.3, h * 0.4);
  grd.addColorStop(0, 'rgba(255,250,225,0)');
  grd.addColorStop(0.5, 'rgba(255,250,225,0.75)');
  grd.addColorStop(1, 'rgba(255,250,225,0)');
  c.fillStyle = grd;
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';
  for (let j = 0; j < 5; j++) {
    const tw = Math.max(0, Math.sin(t * 6 + j * 2.1)) * (1 - k);
    if (tw < 0.05) continue;
    const gx = w * (0.15 + ((j * 0.37) % 0.7));
    const gy = h * (0.15 + ((j * 0.53) % 0.6));
    const s = Math.min(w, h) * 0.07 * tw;
    c.globalAlpha = tw;
    c.beginPath();
    c.moveTo(gx, gy - s);
    c.quadraticCurveTo(gx, gy, gx + s, gy);
    c.quadraticCurveTo(gx, gy, gx, gy + s);
    c.quadraticCurveTo(gx, gy, gx - s, gy);
    c.quadraticCurveTo(gx, gy, gx, gy - s);
    c.fillStyle = '#fff6c8';
    c.fill();
    c.lineWidth = 1.2;
    c.strokeStyle = '#b08a30';
    c.stroke();
  }
  c.restore();
}

// ---------- a bird's page ----------

// " (Harder)" after a best shown at a level other than Normal.
const levelTag = () => (settings.difficulty !== 'normal' ? ` (${LEVEL_NAMES[settings.difficulty]})` : '');

// What it takes to spot the bird (its sticker, its card turned over).
const goalLine = (b) => `Score ${b.pass} to spot this bird`;

// A bird's page: its name, rhyme and game, spotted or not. Until it is
// spotted its picture beside them is a silhouette (renderPage); the game
// itself draws the bird in full.
function fillPage() {
  const b = BIRDS[S.bird];
  const open = shown(S.bird);
  $('#page').classList.toggle('unspotted', !open);
  $('#page-number').textContent = `Page ${S.bird + 1} of ${BIRDS.length}${open ? '' : ' · not yet spotted'}`;
  $('#page-name').textContent = b.name;
  $('#page-object').textContent = `A rare bird that is ${b.object}.`;
  const r = $('#page-rhyme');
  r.textContent = '';
  for (const line of b.rhyme) {
    const p = document.createElement('p');
    p.textContent = line;
    r.append(p);
  }
  $('.page-game').scrollTop = 0;
  $('#page-game').textContent = b.game;
  $('#page-goal').textContent = b.goal;
  fillList($('#page-controls'), controlLines(b));
  fillList($('#page-tips'), b.tips);
  S.pageKind = input.kind;
  $('#page-hint').textContent = input.kind === 'controller' ? '◀ ▶ turn the page · LS / RS ↑ ↓ scroll instructions' : '◀ ▶ turn the page';
  $('#page-best').textContent = [best(b.id) ? `Best: ${pointsText(best(b.id))}${levelTag()}` : '', passed(S.bird) ? '' : goalLine(b)].filter(Boolean).join(' · ');
  focusFirst();
}

function fillList(ul, lines) {
  ul.textContent = '';
  for (const l of lines) {
    const li = document.createElement('li');
    li.textContent = l;
    ul.append(li);
  }
}

function turnPage(d) {
  let i = S.bird + d;
  if (i < 0 || i >= BIRDS.length) return;
  S.bird = i;
  audio.sfx('page');
  fillPage();
}

// ---------- playing a minigame ----------

const pad = () => input.kind === 'controller';

// The controls lines for a bird's page and How to play (src/controls.js),
// for the device in use.
const controlLines = (b) => controlLinesFor(b, input.kind);

// Each game's music, by its feel (see design/music.md). Games that make their
// own music (the gramophone, the glass harp, the radio) play none under it.
const GAME_MUSIC = {
  coot: 'carousel', keycrane: 'carousel', snippit: 'carousel',
  shuttercluck: 'bouncy', bobolinks: 'bouncy', peeper: 'bouncy', milkmidge: 'bouncy',
  niffy: 'bouncy', buttonbeaks: 'bouncy', wetweatherwren: 'bouncy', glovedove: 'bouncy',
  crow: 'busy', broomwhisk: 'busy', garbagecanary: 'busy', steampressersparrow: 'busy',
  plugsocketswift: 'busy', drippet: 'busy',
  cupadee: 'gentle', plume: 'gentle', ladlelark: 'gentle', piffle: 'gentle',
  dodo: 'clockwork', titthrush: 'clockwork', saltshakershrike: 'clockwork', sawbird: 'clockwork',
  gullfinch: 'none', waterglassgoose: 'none', radiobird: 'none',
};

async function startBird(i) {
  S.bird = i;
  const b = BIRDS[i];
  show('play');
  S.phase = 'loading';
  const [factory] = await Promise.all([loadGame(b.id), reloadMissing()]);
  if (!factory) {
    toast('This bird’s game is still being built.');
    show('page');
    return;
  }
  S.factory = factory;
  newGame();
  begin();
  audio.playMusic(GAME_MUSIC[b.id] || 'bouncy');
}

function keepPhoto(photo) {
  photos.push({ ...photo, key: `${Date.now()}-${++photoSerial}`, pinned: false });
  if (!savePhotos(photos)) toast('Photos are available for this visit, but could not be saved on this device.');
}

function newGame() {
  const b = BIRDS[S.bird];
  if (b.id === 'shuttercluck') {
    photos = nextPhotoRound(photos);
    savePhotos(photos);
  }
  S.seed = (Date.now() & 0xffff) + 1;
  // The round keeps the level it started at, even if Settings change it from
  // the pause menu: its score is recorded at that level.
  S.level = settings.difficulty;
  S.game = S.factory({
    W,
    H,
    rng: makeRng(S.seed),
    sfx: audio.sfx,
    vibrate,
    reduceMotion: settings.reduceMotion,
    difficulty: S.level,
    subjects: b.id === 'shuttercluck' ? SUBJECT_IDS : undefined,
    onPhoto: b.id === 'shuttercluck' ? keepPhoto : undefined,
  });
  // Points: each change in the score, times (1 + d) at that moment (points.js).
  S.points = pointsFor(S.game);
  S.gameId = b.id;
}

// How to play, from the pause menu: the same card as the bird's page.
function fillHowto() {
  const b = BIRDS[S.bird];
  $('#howto-title').textContent = b.game;
  $('#howto-goal').textContent = b.goal;
  fillList($('#howto-controls'), controlLines(b));
  fillList($('#howto-tips'), b.tips);
  $('#howto-score').textContent = [passed(S.bird) ? '' : goalLine(b), best(b.id) ? `Your best: ${pointsText(best(b.id))}${levelTag()}` : ''].filter(Boolean).join(' · ');
}

function begin() {
  $('#hud-game').textContent = BIRDS[S.bird].game;
  S.phase = 'count';
  S.count = 3.2;
  S.paused = false;
  input.lockHeld();
  audio.sfx('tick');
}

function restart() {
  if (!S.factory) return;
  closeAll();
  $('#pause').hidden = true;
  $('#result').hidden = true;
  newGame();
  begin();
}

function pause(reason = '') {
  if (S.screen !== 'play' || (S.phase !== 'play' && S.phase !== 'count') || S.paused) return;
  S.paused = true;
  $('#pause-reason').textContent = reason;
  $('#pause').hidden = false;
  input.lockHeld();
  focusFirst();
}

function resume() {
  if (S.modals.length || !S.paused) return;
  S.paused = false;
  $('#pause').hidden = true;
  input.lockHeld();
}

// A score word for one: blooms, dishes, glasses → bloom, dish, glass.
const one = (word) => word.replace(/(ches|shes|sses|xes)$/, (m) => m.slice(0, -2)).replace(/s$/, '');

// The round is over. The first time a bird's score is reached (every time it
// is reached, in ?debug) the sticker celebration plays; otherwise the result
// card shows for a moment, then the guide comes back with the bird chosen.
function finish() {
  const b = BIRDS[S.bird];
  // The plain score decides passing; the points (scaled by difficulty) decide
  // bests and World Records.
  const score = Math.round(S.game.score);
  S.points.step(() => {}); // any change not yet counted, at the difficulty now
  const pts = S.points.shown;
  const before = passed(S.bird);
  const record = recordScore(progress, b.id, pts, passes(b, score), S.level, score) && pts > 0;
  const now = passed(S.bird);
  const outcome = roundOutcome({ wasPassed: before, isPassed: now, reached: passes(b, score), debug: DEBUG });
  S.last = { id: b.id, score, points: pts, level: S.level, outcome };
  if (outcome === 'celebrate') {
    celebrate(S.bird);
    return;
  }
  S.phase = 'result';
  S.resultT = 0;
  // A new best that reaches the score is a World Record, with confetti and a
  // rosette; reaching it again without one gets a tick stamp; a best that
  // still falls short of the score is only a personal one.
  const kind = resultKind({ record, reached: passes(b, score) });
  S.result = { kind, ...resultTiming(kind), fired: new Set() };
  $('#result-title').textContent = RESULT_TITLES[kind];
  fillScore($('#result-score'), b, score, pts);
  const lv = S.level !== 'normal' ? LEVEL_NAMES[S.level] : '';
  $('#result-level').textContent = lv ? `${lv} level` : '';
  $('#result-level').hidden = !lv;
  const atLevel = bestAt(progress[b.id], S.level);
  $('#result-best').textContent = [record ? '' : `Best${lv ? ' at ' + lv : ''}: ${pointsText(atLevel)}.`, now ? '' : goalLine(b) + '.'].filter(Boolean).join(' ');
  const extra = $('#result-extra');
  extra.textContent = '';
  for (const line of S.game.summary?.() || []) {
    const p = document.createElement('p');
    p.textContent = line;
    extra.append(p);
  }
  $('#result-hint').textContent = pad() ? 'A: back to the field guide' : input.kind === 'keyboard' ? 'Enter: back to the field guide' : 'Tap: back to the field guide';
  const bar = $('#result-time');
  bar.style.width = '100%';
  resultFx(kind);
  $('#result').hidden = false;
  if (kind === 'best' || kind === 'plain') audio.sfx('medal', { level: record ? 2 : now ? 1 : 0 });
  input.lockHeld();
  document.activeElement?.blur?.();
}

// Exit to Field Guide from the pause menu: the round so far counts. If that
// spots the bird for the first time, its own card turns over as the guide
// comes back (no celebration); either way the bird is chosen.
function quitToGuide() {
  const i = S.bird;
  const b = BIRDS[i];
  const score = Math.round(S.game?.score || 0);
  S.points?.step(() => {}); // any change not yet counted, at the difficulty now
  const pts = S.points?.shown || 0;
  const before = passed(i);
  if (score > 0 || pts > 0) recordScore(progress, b.id, pts, passes(b, score), S.level, score);
  const turn = turnsOver({ quit: true, wasPassed: before, isPassed: passed(i) });
  toGuide(i, turn ? i : -1);
  if (turn) allSpottedToast();
}

// After the last of the birds is spotted.
function allSpottedToast() {
  if (spottedCount() === BIRDS.length) toast(spottedLine(BIRDS.length, BIRDS.length));
}

// From the result card back to the guide, the bird just played chosen.
function leaveResult() {
  if (S.phase !== 'result') return;
  audio.stopSting();
  toGuide(S.bird);
}

// ---------- the result card's flourishes ----------

// The card dresses up for a World Record (confetti and streamers, a rosette
// stamped on with a shine, the title and score bouncing in) and, less so, for
// a pass that isn't a best (a tick stamp, a few sparkles). It is all CSS
// animation on a few dozen small elements made once here, so nothing is
// added to the frame loop. With reduced motion everything stands still: the
// stamp sits in place and the confetti lies around the edges.
const CONFETTI = [PAL.magenta, PAL.wafer, PAL.lemon, PAL.strawberry, PAL.sage, PAL.sky, PAL.orange, PAL.mint];
function resultFx(kind) {
  const sec = $('#result');
  sec.classList.toggle('fx-record', kind === 'record');
  sec.classList.toggle('fx-passed', kind === 'passed');
  $('#stamp-record').hidden = kind !== 'record';
  $('#stamp-passed').hidden = kind !== 'passed';
  const fx = $('#result-fx');
  fx.textContent = '';
  const still = settings.reduceMotion;
  const rnd = Math.random;
  const pieces = document.createDocumentFragment();
  if (kind === 'record') {
    for (let i = 0; i < 44; i++) {
      const p = document.createElement('i');
      const shape = i % 11 === 0 ? 'streamer' : ['square', 'strip', 'dot'][i % 3];
      p.className = 'confetti ' + shape;
      // still: around the edges, clear of the card; moving: across the top
      const x = still ? (i % 2 ? 2 + rnd() * 12 : 86 + rnd() * 12) : rnd() * 100;
      p.style.cssText = `--x:${x.toFixed(1)}vw;--y:${(still ? 8 + rnd() * 84 : 0).toFixed(1)}vh;--dx:${((rnd() - 0.5) * 24).toFixed(1)}vw;--r:${Math.round((rnd() - 0.5) * 1440)}deg;--d:${(2.4 + rnd() * 1.6).toFixed(2)}s;--delay:${(i < 22 ? rnd() * 0.25 : 0.5 + rnd() * 0.9).toFixed(2)}s;background:${CONFETTI[i % CONFETTI.length]}`;
      pieces.append(p);
    }
  } else if (kind === 'passed') {
    // a few sparkles about the score
    const spots = [[-38, -30], [36, -38], [44, 20], [-46, 26], [4, -52]];
    spots.forEach(([x, y], i) => {
      const p = document.createElement('i');
      p.className = 'sparkle';
      p.style.cssText = `--sx:${x}%;--sy:${y}px;--delay:${(0.35 + i * 0.12).toFixed(2)}s`;
      pieces.append(p);
    });
    $('#result-score').append(pieces);
    return;
  }
  fx.append(pieces);
}

// Sounds at their moments on the card: the fanfare (or the medal chime if it
// hasn't loaded) as the World Record comes up, a thump as its rosette lands;
// a gentle ding as the pass's tick is stamped.
const RESULT_SOUNDS = {
  record: [
    [0, () => { if (!audio.playSting()) { audio.sfx('medal', { level: 2 }); } vibrate(60); }],
    [0.45, () => { audio.sfx('plop'); if (!audio.stingPlaying()) audio.sfx('bloom'); }],
  ],
  passed: [
    [0, () => audio.sfx('medal', { level: 1 })],
    [0.4, () => audio.sfx('ding', { pitch: -5 })],
  ],
};
function tickResultSounds() {
  const r = S.result;
  for (const [when, play] of RESULT_SOUNDS[r?.kind] || []) {
    if (S.resultT >= when && !r.fired.has(when)) {
      r.fired.add(when);
      play();
    }
  }
}

// ---------- the sticker celebration ----------

function celebrate(i) {
  const earned = new Set(BIRDS.map((_, j) => j).filter((j) => j !== i && passed(j)));
  const line = spottedLine(spottedCount(), BIRDS.length);
  S.cele = { index: i, birds: BIRDS, earned, line, t: 0, hold: 0, fired: new Set(), pos: book.pos, bg: bookPicture() };
  // With the book at all the birds together, the new sticker snaps into its
  // own spot in the painting, and stays there.
  if (isGather() && hasGathering()) {
    S.cele.gather = { img: art('book.gathering'), atlas: ATLAS, snapped: new Set(book.snap), gpos: { ...book.gpos } };
    snapSticker(book, BIRDS[i].id);
    saveBook();
  }
  // the stickers are cut out now, not in the middle of the show
  for (const b of BIRDS) sticker(b.id);
  show('celebrate');
  const b = BIRDS[i];
  $('#celebrate-live').textContent = `Spotted! ${b.name}. A new sticker for your field guide. ${line}`;
  celebrateHint();
}

function celebrateHint() {
  const h = $('#celebrate-hint');
  const text = pad() ? 'A: next · B: skip' : input.kind === 'keyboard' ? 'Space: next · Esc: skip' : 'Tap: next · hold: skip';
  if (h.textContent !== text) h.textContent = text;
}

// Sounds at their moments, unless a press jumped well past them.
const CELE_SOUNDS = [
  [0.05, () => audio.playSting() || audio.sfx('medal', { level: 2 })],
  [0.4, () => audio.stingPlaying() || audio.sfx('bloom')],
  [1.6, () => audio.sfx('page')],
  [3.5, () => { audio.sfx('plop'); audio.sfx('catch', { pitch: 7 }); vibrate(60); }],
  [3.55, () => audio.sfx('right')],
];

function tickCelebration(dt) {
  const c = S.cele;
  c.t += dt;
  for (const [when, play] of CELE_SOUNDS) {
    if (c.t >= when && !c.fired.has(when)) {
      c.fired.add(when);
      if (c.t - when < 0.3) play();
    }
  }
  if (c.t >= END) endCelebration(false);
}

// Over: back to the guide, the bird chosen, where its own card turns over
// from silhouette to painting (unless the celebration was skipped).
function endCelebration(skipped) {
  const c = S.cele;
  if (!c) return;
  const i = c.index;
  toGuide(i, turnsOver({ outcome: 'celebrate', skipped }) ? i : -1);
  allSpottedToast();
}

// Any press: the next step; B or a long press: straight to the end.
function celebrationInput(dt) {
  const c = S.cele;
  celebrateHint();
  const n = input.nav();
  const st = input.state();
  if (n.back) {
    endCelebration(true);
    return;
  }
  const fresh = st.actionPressed || n.confirm || input.padAnyPressed();
  if (fresh) c.hold = 0.0001;
  else if (c.hold > 0 && st.action) c.hold += dt;
  else c.hold = 0;
  if (c.hold >= HOLD_TO_SKIP) {
    endCelebration(true);
    return;
  }
  if (fresh) {
    const to = skipFrom(c.t);
    if (to >= END) endCelebration(false);
    else c.t = to;
  }
}

// ---------- the sticker book ----------

// The book, from the guide: the stickers earned, which the player can pick
// up and put anywhere on their pages (the mouse or a finger drags them; the
// stick or the arrows move a hand, and A or Space picks up and puts down),
// a picture to put behind them (LB / RB, Q / E, or the arrows by its name),
// and its two spreads to turn between (LT / RT, Page Up / Page Down, or the
// arrows at the sides). Everything about it is saved.
//
// Its first picture, all the birds together, is one spread with every bird
// in one painting: each bird's spot greyed until its sticker is snapped in
// (dropped on or near it), the stickers not yet placed waiting on a sticker
// sheet beside the book. On a small screen its pages are drawn larger than
// the room for them, and the view pans: drag the picture, or carry a sticker
// (or the hand) near the window's edge.

// With every page open (?debug, ?all) every sticker and picture is too.
const earnedSet = () => new Set(BIRDS.map((_, i) => i).filter((i) => ALL_OPEN || passed(i)));
const hasGathering = () => !!ATLAS && !!art('book.gathering');
const pictures = () => backgrounds(BIRD_IDS, (i) => ALL_OPEN || passed(i), { gathering: hasGathering() });
const isGather = () => shownBackground(pictures(), book.bg) === GATHERING;
// The picture behind the stickers: the bird's own painting for the book
// (IC-SB01..SB28, drawn across both pages) once delivered, its game's scene
// (pasted in) until then.
const bookPicture = () => {
  const bg = shownBackground(pictures(), book.bg);
  if (bg === PLAIN || bg === GATHERING) return null;
  const own = ASSETS['book.' + bg]?.delivered && art('book.' + bg);
  if (own) return { img: own, full: true };
  const scene = art('scene.' + bg);
  return scene ? { img: scene, full: false } : null;
};
const saveBook = () => saveStickers(book);
const isWide = () => view.cw >= view.ch * 0.95;
const sbLayout = () => stickerBookLayout(BIRDS.length, isWide(), book.spread, isGather());
const normalSize = () => stickerSize(BIRDS.length, isWide());

function openStickerBook() {
  const wide = isWide();
  S.sb = { held: null, hand: wide ? { x: 800, y: 470 } : { x: 450, y: 820 }, cam: null, fx: [], pan: null };
  document.activeElement?.blur?.();
  fillStickerBook();
  if (!earnedSet().size) toast('Reach a bird’s score to earn its sticker.');
}

function closeStickerBook() {
  show('guide');
  $('#stickers-btn')?.focus({ preventScroll: true });
}

function fillPhotoPage() {
  const page = $('#sb-photos');
  page.replaceChildren();
  const intro = document.createElement('p');
  intro.className = 'photo-intro';
  intro.textContent = 'Your latest photographs and pinned favourites. Pin a photo to keep it after another round.';
  page.append(intro);
  if (!photos.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Play Say Cheese with the Shuttercluck to take your first photographs.';
    page.append(empty);
  }
  const grid = document.createElement('div');
  grid.className = 'photo-grid';
  for (const photo of photos) {
    const button = document.createElement('button');
    button.className = 'photo-card';
    button.dataset.nav = '';
    button.dataset.photo = photo.key;
    button.setAttribute('aria-pressed', String(photo.pinned));
    const image = document.createElement('img');
    image.src = photo.src;
    image.alt = photo.name;
    const caption = document.createElement('span');
    caption.textContent = `${photo.name} · ${photo.pts} points`;
    const pin = document.createElement('strong');
    pin.textContent = photo.pinned ? 'Pinned · unpin' : 'Pin photo';
    button.append(image, caption, pin);
    button.addEventListener('click', () => {
      photo.pinned = !photo.pinned;
      if (!savePhotos(photos)) toast('This photo could not be saved on this device.');
      fillPhotoPage();
      $('#sb-pages').textContent = `${photos.length} ${photos.length === 1 ? 'photograph' : 'photographs'} · ${photos.filter(p => p.pinned).length} pinned`;
      [...page.querySelectorAll('[data-photo]')].find(el => el.dataset.photo === photo.key)?.focus({ preventScroll: true });
      $('#sb-live').textContent = photo.pinned ? 'Photo pinned' : 'Photo unpinned';
    });
    grid.append(button);
  }
  page.append(grid);
}

// The words around the book: which pages, which picture, how to use it.
function fillStickerBook() {
  const album = !!S.sb?.photos;
  $('#sb-photos').hidden = !album;
  $('#stickers').classList.toggle('photos', album);
  $('#sb-title').textContent = album ? 'Shuttercluck’s photographs' : 'Sticker Book';
  $('.sb-bg').hidden = album;
  if (album) {
    $('#sb-pages').textContent = `${photos.length} ${photos.length === 1 ? 'photograph' : 'photographs'} · ${photos.filter(p => p.pinned).length} pinned`;
    $('#sb-prev').hidden = false;
    $('#sb-prev').disabled = false;
    $('#sb-next').hidden = false;
    $('#sb-next').disabled = true;
    fillPhotoPage();
    stickerHint();
    $('#sb-photos [data-nav]')?.focus({ preventScroll: true });
    return;
  }
  const gather = isGather();
  const L = sbLayout();
  const earned = earnedSet();
  const placed = book.snap.filter((id) => earned.has(BIRD_IDS.indexOf(id))).length;
  $('#sb-pages').textContent = gather ? `${placed} of ${BIRDS.length} in the picture` : SPREADS > 1 ? `Birds ${L.from + 1}–${L.to} · ${earned.size} of ${BIRDS.length} spotted` : '';
  $('#stickers').classList.toggle('gather', gather);
  const bg = shownBackground(pictures(), book.bg);
  const b = BIRDS.find((x) => x.id === bg);
  $('#sb-bg-name').textContent = b ? b.name : gather ? 'All the birds together' : 'Plain page';
  const n = pictures().length;
  for (const el of document.querySelectorAll('.sb-bg .sb-arrow')) el.disabled = n < 2;
  $('#sb-prev').hidden = gather;
  $('#sb-next').hidden = false;
  $('#sb-prev').disabled = book.spread <= 0;
  $('#sb-next').disabled = false;
  stickerHint();
}

function stickerHint() {
  if (S.sb?.photos) {
    $('#sb-hint').textContent = pad() ? 'Stick: choose · A: pin / unpin · LT: back · B: close' : 'Choose a photo to pin / unpin · Page Up: back';
    return;
  }
  const holding = !!S.sb?.held;
  const gather = isGather();
  const text = pad()
    ? holding ? (gather ? 'A: put it down (on its own bird, it fits in) · B: put it back' : 'A: put it down · B: put it back') : gather ? 'Stick: move the hand · A: pick up · LB RB: picture · RT: photographs · B: close' : 'Stick: move the hand · A: pick up · LB RB: picture · LT RT: turn the page · B: close'
    : input.kind === 'keyboard'
      ? holding ? (gather ? 'Space: put it down (on its own bird, it fits in) · Esc: put it back' : 'Space: put it down · Esc: put it back') : gather ? 'Arrows: move the hand · Space: pick up · Q E: picture · Esc: close' : 'Arrows: move the hand · Space: pick up · Q E: picture · Page Up / Down: turn the page · Esc: close'
      : gather ? (S.sb?.cam?.z > 1 ? 'Drag a sticker onto its own bird · drag the picture to look around' : 'Drag a sticker onto its own bird in the picture, or anywhere') : 'Drag a sticker to put it anywhere on the pages';
  const h = $('#sb-hint');
  if (h.textContent !== text) h.textContent = text;
}

function turnPicture(d) {
  if (S.sb?.photos) return;
  const list = pictures();
  if (list.length < 2) {
    toast('Pass a bird’s game to have its picture for the book.');
    return;
  }
  if (S.sb?.held) putBack();
  book.bg = cycle(list, shownBackground(list, book.bg), d);
  saveBook();
  if (S.sb) {
    S.sb.cam = null;
    S.sb.fx = [];
  }
  audio.sfx('page');
  fillStickerBook();
  $('#sb-live').textContent = `Picture: ${$('#sb-bg-name').textContent}`;
}

function turnSpread(d) {
  if (S.sb?.photos) {
    if (d < 0) { S.sb.photos = false; fillStickerBook(); audio.sfx('page'); }
    return;
  }
  if (d > 0 && (isGather() || book.spread === SPREADS - 1)) {
    if (S.sb?.held) putBack();
    S.sb.photos = true;
    fillStickerBook();
    audio.sfx('page');
    return;
  }
  if (isGather()) {
    toast(`All ${BIRDS.length} birds share this one picture.`);
    return;
  }
  const to = Math.max(0, Math.min(SPREADS - 1, book.spread + d));
  if (to === book.spread) return;
  if (S.sb?.held) putBack();
  book.spread = to;
  saveBook();
  audio.sfx('page');
  fillStickerBook();
  $('#sb-live').textContent = $('#sb-pages').textContent;
}

// The topmost earned sticker on this spread under (x, y), with its spot.
function stickerAt(L, x, y) {
  const earned = earnedSet();
  const ids = L.slots.filter((sl) => earned.has(sl.i)).map((sl) => BIRDS[sl.i].id);
  for (const id of drawOrder(ids, book.pos).reverse()) {
    const i = BIRD_IDS.indexOf(id);
    const at = stickerSpot(L, i, book.pos[id]);
    const half = at.s * 0.42;
    if (Math.abs(x - at.x) <= half && Math.abs(y - (at.y - at.s * 0.02)) <= half * 1.08) return { id, i, at };
  }
  return null;
}

function pickUp(hit, x, y, by) {
  S.sb.held = { id: hit.id, i: hit.i, x: hit.at.x, y: hit.at.y, dx: hit.at.x - x, dy: hit.at.y - y, by, from: hit.from || 'spread', s0: hit.at.s, age: 0 };
  if (hit.from === 'snap') S.sb.fx.push({ kind: 'unsnap', id: hit.id, t: 0, dur: settings.reduceMotion ? 0.15 : 0.3 });
  audio.sfx('catch', { pitch: 5 });
  stickerHint();
}

function putDown() {
  if (isGather()) {
    putDownGather();
    return;
  }
  const h = S.sb.held;
  const L = sbLayout();
  const sl = L.slots.find((s) => s.i === h.i);
  moveSticker(book, h.id, placeOnSpread(L.pages, h.x, h.y, sl.s));
  saveBook();
  S.sb.held = null;
  audio.sfx('plop');
  vibrate(30);
  stickerHint();
}

function putBack() {
  const h = S.sb.held;
  S.sb.held = null;
  // one taken out of its spot goes back into it
  if (h && h.from === 'snap' && isGather()) startSnap(h, gatherRegion(h.id));
  audio.sfx('back');
  stickerHint();
}

// ---------- the gathering ----------

const gatherRegion = (id) => ATLAS.regions.find((r) => r.id === id);
const inBox = (b, p) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
// The size a carried sticker is drawn at (drawPlaced's s), and a page's
// least size on screen, in CSS pixels, before the view zooms in.
const HELD_SCALE = 1.15;
const MIN_PAGE_PX = 420;

// The view of the gathering: zoomed in on a small screen, never past the
// book's edges, easing toward where it is asked to look.
function gatherCam(L, dt = 0) {
  const sb = S.sb;
  const wide = isWide();
  const s = Math.min(view.cw / (wide ? W : H), view.ch / (wide ? H : W)) || 1;
  // big enough to see; upright, the page fills the window's width (the view
  // then scrolls up and down, a page at a time)
  const z = Math.max(1, Math.min(2.2, MIN_PAGE_PX / (L.pages[0].w * s)), wide ? 1 : L.win.w / L.pages[0].w);
  if (!sb.cam || Math.abs(sb.cam.z - z) > 1e-3) {
    const c = clampCam(L.box, { z, x: L.box.x + L.box.w / 2, y: L.box.y }, L.win);
    sb.cam = { z, x: c.x, y: c.y, tx: c.x, ty: c.y };
  }
  const cam = sb.cam;
  const t = clampCam(L.box, { z, x: cam.tx, y: cam.ty }, L.win);
  cam.tx = t.x;
  cam.ty = t.y;
  const k = settings.reduceMotion ? 1 : 1 - Math.exp(-dt * 10);
  cam.x += (cam.tx - cam.x) * k;
  cam.y += (cam.ty - cam.y) * k;
  return cam;
}

// Scrolls the view toward the window's edge a point is near.
function pushCam(L, p, dt) {
  const cam = S.sb.cam;
  if (!cam || cam.z <= 1) return;
  const e = edgePush(L.win, p, Math.min(L.win.w, L.win.h) * 0.14);
  const speed = 900 / cam.z;
  cam.tx += e.x * speed * dt;
  cam.ty += e.y * speed * dt;
}

// The spot of bird `id` on the stage (its region's centre and size), at the
// view as it is.
function spotOnStage(L, id) {
  const cam = S.sb.cam;
  const rr = regionRect(L, gatherRegion(id));
  const c = bookToStage(L.win, cam, { x: rr.cx, y: rr.cy });
  return { x: c.x, y: c.y, size: regionSize(rr) * cam.z };
}

// A point of the stage as a point of the painting (on the nearer page, so
// off its edge it is outside 0..1), and of the book.
function stageToPicture(L, p) {
  const q = stageToBook(L.win, S.sb.cam, p);
  const k = placeOnSpread(L.pages, q.x, q.y, 0).page;
  const pg = L.pages[k];
  return { pic: toPicture({ page: k, u: (q.x - pg.x) / pg.w, v: (q.y - pg.y) / pg.h }), book: q };
}
// The stickers waiting on the sheet (the one in hand keeps its cell).
const gatherCells = (L) => sheetCells(L, BIRDS.map((_, i) => i).filter((i) => earnedSet().has(i) && gatherState(book, BIRD_IDS[i]) === 'sheet'));

// What is under (x, y) on the gathering: a loose sticker (the top one), a
// bird snapped into the painting, or one waiting on the sheet.
function gatherHit(L, x, y) {
  const earned = earnedSet();
  const sb = S.sb;
  const size = normalSize();
  const p = { x, y };
  if (inBox(L.win, p)) {
    const loose = Object.keys(book.gpos).filter((id) => earned.has(BIRD_IDS.indexOf(id)));
    for (const id of drawOrder(loose, book.gpos).reverse()) {
      const at = bookToStage(L.win, sb.cam, pagePoint(L.pages, book.gpos[id]));
      const half = size * 0.42;
      if (Math.abs(x - at.x) <= half && Math.abs(y - (at.y - size * 0.02)) <= half * 1.08) return { id, i: BIRD_IDS.indexOf(id), at: { x: at.x, y: at.y, s: size }, from: 'free' };
    }
    const q = stageToPicture(L, p);
    const r = q && regionAt(ATLAS, q.pic, (r) => book.snap.includes(r.id) && earned.has(BIRD_IDS.indexOf(r.id)));
    if (r) {
      const at = spotOnStage(L, r.id);
      return { id: r.id, i: BIRD_IDS.indexOf(r.id), at: { x: at.x, y: at.y, s: at.size / (0.78 * HELD_SCALE) }, from: 'snap' };
    }
    return null;
  }
  for (const sl of gatherCells(L)) {
    const id = BIRD_IDS[sl.i];
    if (Math.abs(x - sl.x) <= sl.s / 2 && Math.abs(y - sl.y) <= sl.s / 2) return { id, i: sl.i, at: { x: sl.x, y: sl.y, s: (sl.s * 0.84) / (0.78 * HELD_SCALE) }, from: 'sheet' };
  }
  return null;
}

// A sticker begins to snap into its spot, from where it is in hand.
function startSnap(h, r) {
  const size = (h.s ?? normalSize()) * 0.78 * HELD_SCALE;
  S.sb.fx = S.sb.fx.filter((f) => f.id !== h.id);
  S.sb.fx.push({ kind: 'snap', id: h.id, t: 0, dur: settings.reduceMotion ? 0.35 : SNAP_TIME, from: { x: h.x, y: h.y, size } });
  snapSticker(book, r.id);
}

// Put down on the gathering: into its own spot (it snaps in), on another
// bird's spot (a little shake: it stays loose), anywhere else on the pages
// (loose), or off them (back on the sheet).
function putDownGather() {
  const sb = S.sb;
  const h = sb.held;
  const L = sbLayout();
  sb.held = null;
  const q = inBox(L.win, h) ? stageToPicture(L, h) : null;
  if (!q) {
    toSheet(book, h.id);
    audio.sfx('back');
    $('#sb-live').textContent = `${BIRDS[h.i].name}: back on the sticker sheet`;
  } else {
    const res = dropOnPicture(ATLAS, h.id, q.pic);
    if (res.kind === 'snap') {
      startSnap(h, gatherRegion(h.id));
      audio.sfx('plop');
      audio.sfx('bloom');
      vibrate(40);
      $('#sb-live').textContent = `${BIRDS[h.i].name} fits into the picture`;
    } else {
      placeFree(book, h.id, placeOnSpread(L.pages, q.book.x, q.book.y, normalSize() / sb.cam.z));
      if (res.kind === 'wrong') {
        if (!settings.reduceMotion) sb.fx.push({ kind: 'shake', id: h.id, t: 0, dur: 0.45 });
        audio.sfx('bonk');
        $('#sb-live').textContent = `That is the ${BIRDS[BIRD_IDS.indexOf(res.id)].name.replace(/^The /, '')}’s spot`;
      } else audio.sfx('plop');
    }
  }
  saveBook();
  fillStickerBook();
}

// How greyed bird `id`'s spot is now (1 greyed, 0 in colour).
function greyOf(id, earned) {
  const sb = S.sb;
  for (const f of sb.fx) {
    if (f.id !== id) continue;
    if (f.kind === 'snap') return snapGrey(f.t / f.dur, settings.reduceMotion);
    if (f.kind === 'unsnap') return Math.min(1, f.t / f.dur);
  }
  if (sb.held?.id === id) return 1;
  return book.snap.includes(id) && earned.has(BIRD_IDS.indexOf(id)) ? 0 : 1;
}

function stickerInput(dt) {
  const sb = S.sb;
  const n = input.nav();
  const st = input.state();
  const gather = isGather() && hasGathering();
  const L = sbLayout();
  stickerHint();
  if (n.back) {
    back();
    return;
  }
  if (input.padPressed(BTN.LB) || input.keyPressed('KeyQ', 'BracketLeft')) turnPicture(-1);
  if (input.padPressed(BTN.RB) || input.keyPressed('KeyE', 'BracketRight')) turnPicture(1);
  if (input.padPressed(BTN.LT) || input.keyPressed('PageUp')) turnSpread(-1);
  if (input.padPressed(BTN.RT) || input.keyPressed('PageDown')) turnSpread(1);
  if (sb.photos) {
    menuInput(dt);
    $('#sb-photos').scrollTop += input.rightStick()[1] * 420 * dt;
    return;
  }
  const hitAt = (x, y) => (gather ? gatherHit(L, x, y) : stickerAt(L, x, y));
  if (gather) {
    gatherCam(L, dt);
    for (const f of sb.fx) f.t += dt;
    sb.fx = sb.fx.filter((f) => f.t < f.dur);
    if (sb.held) {
      sb.held.age += dt;
      const grow = settings.reduceMotion ? 1 : Math.min(1, sb.held.age / 0.25);
      sb.held.s = sb.held.s0 + (normalSize() - sb.held.s0) * (grow * grow * (3 - 2 * grow));
    }
  }

  // the mouse or a finger: drag (on the gathering, dragging the picture
  // itself looks around it when it is bigger than its window)
  const p = st.pointer;
  if (input.kind === 'pointer') {
    sb.hand = null;
    if (p.pressed && !sb.held) {
      // where it went down (it may have moved on since, within this frame)
      const at = { x: p.downX, y: p.downY };
      const hit = hitAt(at.x, at.y);
      if (hit) pickUp(hit, at.x, at.y, 'pointer');
      else if (gather && sb.cam.z > 1 && inBox(L.win, at)) sb.pan = { x: at.x, y: at.y, cx: sb.cam.x, cy: sb.cam.y };
    }
    if (sb.pan) {
      if (p.down) {
        sb.cam.tx = sb.cam.x = sb.pan.cx - (p.x - sb.pan.x) / sb.cam.z;
        sb.cam.ty = sb.cam.y = sb.pan.cy - (p.y - sb.pan.y) / sb.cam.z;
        const c = clampCam(L.box, sb.cam, L.win);
        sb.cam.x = sb.cam.tx = c.x;
        sb.cam.y = sb.cam.ty = c.y;
      } else sb.pan = null;
    }
    if (sb.held?.by === 'pointer') {
      // a sticker picked off the sheet or out of its spot comes to the finger
      const pull = sb.held.from === 'sheet' || sb.held.from === 'snap' ? Math.max(0, 1 - sb.held.age / 0.2) : 1;
      sb.held.dx *= pull;
      sb.held.dy *= pull;
      sb.held.x = p.x + sb.held.dx;
      sb.held.y = p.y + sb.held.dy;
      if (gather) pushCam(L, sb.held, dt);
      if (!p.down) putDown();
    }
    return;
  }

  // the stick, the D-pad or the arrows: the hand
  const lw = isWide() ? W : H;
  const lh = isWide() ? H : W;
  if (!sb.hand) sb.hand = { x: lw / 2, y: lh / 2 };
  const speed = 900;
  sb.hand.x = Math.max(0, Math.min(lw, sb.hand.x + st.x * speed * dt));
  sb.hand.y = Math.max(0, Math.min(lh, sb.hand.y + st.y * speed * dt));
  if (gather && (st.x || st.y)) pushCam(L, sb.hand, dt);
  if (sb.held) {
    sb.held.by = 'hand';
    sb.held.x = sb.hand.x;
    sb.held.y = sb.hand.y;
  }
  if (n.confirm) {
    if (sb.held) putDown();
    else {
      const hit = hitAt(sb.hand.x, sb.hand.y);
      if (hit) {
        pickUp(hit, sb.hand.x, sb.hand.y, 'hand');
        sb.held.x = sb.hand.x;
        sb.held.y = sb.hand.y;
      } else audio.sfx('back');
    }
  }
}

function vibrate(ms = 80) {
  if (!settings.vibration) return;
  for (const gp of navigator.getGamepads?.() || []) {
    try {
      gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: 0.5, weakMagnitude: 0.5 });
    } catch { /* not supported */ }
  }
}

// ---------- actions ----------

function act(action, el) {
  audio.unlock();
  switch (action) {
    case 'start':
      requestFullscreen();
      audio.sfx('go');
      show('guide');
      break;
    case 'fullscreen':
      toggleFullscreen();
      break;
    case 'sound':
      settings.sound = !settings.sound;
      saveSettings(settings);
      applySettings();
      syncSettingsUi();
      break;
    case 'title':
      show('title');
      break;
    case 'guide':
      show('guide');
      break;
    case 'stickers':
      show('stickers');
      break;
    case 'bg-prev':
    case 'bg-next':
      turnPicture(action === 'bg-next' ? 1 : -1);
      break;
    case 'spread-prev':
    case 'spread-next':
      turnSpread(action === 'spread-next' ? 1 : -1);
      break;
    case 'gathering':
      show('gathering');
      break;
    case 'play':
      startBird(S.bird);
      break;
    case 'pause':
      pause();
      break;
    case 'back':
      back();
      break;
    case 'restart':
      restart();
      break;
    case 'quit-guide':
      quitToGuide();
      break;
    case 'close':
      closeModal();
      break;
    case 'confirm-yes': {
      const fn = S.confirmFn;
      S.confirmFn = null;
      closeModal();
      fn?.();
      break;
    }
    case 'reset-progress':
      confirm('Forget all scores?', 'Every bird’s best score is cleared, only the first page stays open, and the sticker book is emptied. (They are kept aside: Restore my scores brings them back.)', () => {
        resetProgress();
        progress = loadProgress();
        resetStickers();
        book = emptyBook();
        if (S.screen === 'guide') buildGuide();
        syncSettingsUi();
        toast('Scores forgotten.');
      });
      break;
    case 'restore-progress':
      progress = restoreProgress(progress);
      book = normalizeBook(loadStickers(), BIRD_IDS, SPREADS);
      if (S.screen === 'guide') buildGuide();
      syncSettingsUi();
      focusFirst(true);
      toast('Scores restored: the best of then and now.');
      break;
  }
}

function confirm(title, text, fn) {
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  S.confirmFn = fn;
  openModal('confirm');
}

// While a new card opens in the guide, a click only hurries it along.
document.addEventListener(
  'click',
  (e) => {
    if (S.screen !== 'guide' || !S.unlock) return;
    e.preventDefault();
    e.stopPropagation();
    endUnlock();
  },
  true,
);

document.addEventListener('click', (e) => {
  // The result card: a click or tap anywhere goes on to the guide.
  if (S.screen === 'play' && S.phase === 'result') {
    if (S.resultT >= (S.result?.guard ?? 0.5)) leaveResult();
    return;
  }
  // A click on the dim backdrop outside a dialog: back to the game (or, for
  // a question, No).
  if (e.target.classList?.contains('modal')) {
    audio.sfx('back');
    if (S.modals.at(-1) === 'confirm') closeModal();
    else toGame();
    return;
  }
  const el = e.target.closest('[data-action], [data-open]');
  if (!el || el.disabled) return;
  if (el.dataset.open) {
    audio.unlock();
    audio.sfx('ui');
    openModal(el.dataset.open);
  } else {
    if (el.dataset.action !== 'pause') audio.sfx('ui');
    act(el.dataset.action, el);
  }
});

// The B / Escape key: back out of whatever is on top.
function back() {
  if (S.modals.length) {
    audio.sfx('back');
    closeModal();
    return;
  }
  if (S.screen === 'play') {
    if (S.phase === 'result') leaveResult();
    else if (!$('#pause').hidden) resume();
    else pause();
    return;
  }
  audio.sfx('back');
  if (S.screen === 'stickers') {
    if (S.sb?.held) putBack();
    else closeStickerBook();
    return;
  }
  if (S.screen === 'page') show('guide');
  else if (S.screen === 'guide' || S.screen === 'gathering') show(S.screen === 'gathering' ? 'guide' : 'title');
  else if (S.screen === 'title' && S.titleUtil) {
    S.titleUtil = false;
    $('#press-start').focus();
  }
}

// ---------- fullscreen ----------

// Browsers only allow it from a press, so it isn't a saved setting: the
// Settings switch shows whether the page is full screen now, and turns it on
// or off. Where the browser can't (iPhone Safari) the switch is greyed out,
// with a note.
function requestFullscreen() {
  fs.enterFullscreen(document).then(syncFullscreenUi);
}
function toggleFullscreen() {
  fs.toggleFullscreen(document).then(syncFullscreenUi);
}
function syncFullscreenUi() {
  const box = $('#fullscreen-toggle');
  if (!box) return;
  const can = fs.canFullscreen(document);
  box.disabled = !can;
  box.checked = can && fs.isFullscreen(document);
  $('#fullscreen-note').hidden = can;
  box.closest('.row').classList.toggle('disabled', !can);
}
document.addEventListener('change', (e) => {
  if (e.target.id !== 'fullscreen-toggle') return;
  fs.setFullscreen(document, e.target.checked).then(syncFullscreenUi);
});

// ---------- settings ----------

const SOUND_ICON = {
  on: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></g>',
  off: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></g>',
};
function syncSoundButton() {
  const on = settings.sound !== false;
  const label = on ? 'Sound on' : 'Sound off';
  for (const b of document.querySelectorAll('[data-action="sound"]')) {
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', label);
    b.title = label;
    b.classList.toggle('is-off', !on);
    b.querySelector('svg').innerHTML = on ? SOUND_ICON.on : SOUND_ICON.off;
    b.querySelector('.btn-label').textContent = label;
  }
}

function syncSettingsUi() {
  syncSoundButton();
  $('#restore-btn').hidden = !canRestore(progress);
  syncFullscreenUi();
  syncChoices();
  for (const el of document.querySelectorAll('[data-setting]')) {
    const k = el.dataset.setting;
    if (el.type === 'checkbox') el.checked = !!settings[k];
    else {
      el.value = settings[k];
      const out = el.parentElement.querySelector('output');
      if (out) out.textContent = settings[k];
    }
  }
}
// A segmented choice (Difficulty): the chosen segment is checked.
function syncChoices() {
  for (const el of document.querySelectorAll('[data-choice]')) {
    for (const b of el.querySelectorAll('[data-value]')) b.setAttribute('aria-checked', String(b.dataset.value === settings[el.dataset.choice]));
  }
}
// Picks a choice's value (from a click, or ◀ ▶ stepping it).
function choose(k, value) {
  if (settings[k] === value) return;
  settings[k] = value;
  saveSettings(settings);
  syncChoices();
  audio.sfx('move');
  // the guide's cards show the best at this level
  if (k === 'difficulty') for (const card of document.querySelectorAll('#cards .card')) fillCard(card);
}
function stepChoice(el, dx) {
  const values = [...el.querySelectorAll('[data-value]')].map((b) => b.dataset.value);
  const i = values.indexOf(settings[el.dataset.choice]);
  const j = Math.max(0, Math.min(values.length - 1, i + dx));
  if (j !== i) choose(el.dataset.choice, values[j]);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-choice] [data-value]');
  const el = e.target.closest?.('[data-choice]');
  if (!el) return;
  if (b) choose(el.dataset.choice, b.dataset.value);
  else {
    // A (or Enter) on the control itself moves on to the next, round again
    const values = [...el.querySelectorAll('[data-value]')].map((v) => v.dataset.value);
    choose(el.dataset.choice, values[(values.indexOf(settings[el.dataset.choice]) + 1) % values.length]);
  }
  el.focus({ preventScroll: true });
});

function applySettings() {
  audio.setVolumes(settings);
  syncSoundButton();
  setBoil(!settings.reduceMotion);
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
}
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.dataset?.setting) return;
  const k = el.dataset.setting;
  settings[k] = el.type === 'checkbox' ? el.checked : Number(el.value);
  saveSettings(settings);
  applySettings();
  syncSettingsUi();
});

// ---------- toast ----------

let toastTimer = 0;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- keyboard specifics ----------

addEventListener('keydown', (e) => {
  audio.unlock();
  const el = document.activeElement;
  const isRange = el?.type === 'range';
  if (el?.dataset?.choice && (e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
    e.preventDefault();
    el.click();
    return;
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    if (S.screen === 'play' && S.phase === 'play' && !S.paused) {
      e.preventDefault();
      return;
    }
    if (isRange && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) return; // the slider moves
    e.preventDefault();
  }
  if (e.code === 'Space' && S.screen === 'play' && S.phase === 'play') e.preventDefault();
});

// ---------- the frame loop ----------

let last = performance.now();
let repeat = { dir: null, t: 0 };

function menuInput(dt) {
  const n = input.nav();
  const l = layer();

  // Title: idle until the stick moves; any fresh controller button starts.
  if (S.screen === 'title' && !S.modals.length) {
    const [sx, sy] = n.stick;
    if (!S.titleUtil && (Math.abs(sx) > 0.5 || Math.abs(sy) > 0.5)) {
      S.titleUtil = true;
      $('#press-start').focus();
      repeat = { dir: 'x', t: 0.35 };
      return;
    }
    if (!S.titleUtil && input.padAnyPressed()) {
      act('start');
      return;
    }
    if (S.titleUtil && input.padPressed(BTN.MENU)) {
      act('start');
      return;
    }
  }

  if (!l) return;

  // Directions, from the D-pad / arrows (fresh) or the stick (with repeat).
  let dx = 0;
  let dy = 0;
  if (n.left) dx = -1;
  else if (n.right) dx = 1;
  else if (n.up) dy = -1;
  else if (n.down) dy = 1;
  else {
    const [sx, sy] = n.stick;
    const dir = Math.abs(sx) > 0.55 ? (sx > 0 ? 'r' : 'l') : Math.abs(sy) > 0.55 ? (sy > 0 ? 'd' : 'u') : null;
    if (!dir) repeat = { dir: null, t: 0 };
    else if (dir !== repeat.dir) {
      repeat = { dir, t: 0.38 };
      [dx, dy] = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] }[dir];
    } else {
      repeat.t -= dt;
      if (repeat.t <= 0) {
        repeat.t = 0.14;
        [dx, dy] = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] }[dir];
      }
    }
  }

  // Y on the guide opens the sticker book.
  if (S.screen === 'guide' && !S.modals.length && input.padPressed(BTN.Y)) {
    audio.sfx('page');
    show('stickers');
    return;
  }

  // Shoulder buttons and arrows turn the bird's pages.
  if (S.screen === 'page' && !S.modals.length) {
    const leftY = n.stick[1];
    const rightY = input.rightStick()[1];
    const scrollY = Math.abs(rightY) > Math.abs(leftY) ? rightY : leftY;
    if (Math.abs(scrollY) > 0.2) {
      $('.page-game').scrollTop += scrollY * 420 * dt;
      dy = 0;
    }
    if (input.padPressed(BTN.LB)) turnPage(-1);
    if (input.padPressed(BTN.RB)) turnPage(1);
    if (dx) {
      turnPage(dx);
      dx = 0;
    }
  }

  const el = document.activeElement;
  if (dx && el?.dataset?.choice) {
    stepChoice(el, dx); // ◀ ▶ step a segmented choice, like a slider
  } else if ((dx || dy) && el?.type === 'range' && dx && pad()) {
    el.value = Number(el.value) + dx * Number(el.step || 1);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (dx || dy) {
    // A keyboard arrow on a slider moves the slider, not the focus.
    if (!(el?.type === 'range' && dx && !pad())) moveFocus(dx, dy);
  }

  const chosen = navItems().includes(document.activeElement);
  const leaf = l.hasAttribute('data-leaf');
  if (input.padPressed(BTN.A)) {
    if (chosen) document.activeElement.click();
    else if (leaf) toGame();
    else focusFirst();
  } else if (n.confirm && leaf && !chosen) toGame(); // Enter or Space; a focused button clicks itself
  if (n.back) back();
  else if (n.pause && S.screen === 'play' && S.paused) toGame();
}

function frame(now) {
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (FIXED_DT) dt = FIXED_DT;
  S.t += dt;
  input.poll();

  const playing = S.screen === 'play' && !S.paused && !S.modals.length;
  if (playing && S.phase === 'count') {
    const before = Math.ceil(S.count);
    S.count -= dt;
    const after = Math.ceil(S.count);
    const cd = $('#countdown');
    cd.hidden = false;
    cd.textContent = S.count > 0.4 ? String(Math.max(1, after - 0)) : 'Go!';
    if (after !== before && after > 0) audio.sfx('tick');
    if (S.count <= 0.4 && before > 0 && S.count + dt > 0.4) audio.sfx('go');
    if (S.count <= 0) {
      cd.hidden = true;
      S.phase = 'play';
      input.lockHeld();
    }
  } else if (playing && S.phase === 'play') {
    const st = input.state();
    S.points.step(() => S.game.update(dt, st));
    if (S.game.done) {
      S.phase = 'over';
      S.overT = 1.1;
      const cd = $('#countdown');
      cd.hidden = false;
      cd.textContent = 'Time!';
      audio.sfx('time');
    }
  } else if (playing && S.phase === 'over') {
    S.overT -= dt;
    if (S.overT <= 0) {
      $('#countdown').hidden = true;
      finish();
    }
  }
  const live = S.screen === 'play' && ['count', 'play', 'over'].includes(S.phase);
  if (live && !S.paused && !S.modals.length) {
    // In play only pause is read here (Menu or View, Esc or P; not B, which
    // a game may use); the game reads the rest.
    const n = input.nav();
    if (n.pause) pause();
  } else if (S.screen === 'play' && S.phase === 'result' && !S.modals.length) {
    // The result card: gone after a moment, or at any press.
    S.resultT += dt;
    tickResultSounds();
    const { time, guard } = S.result;
    $('#result-time').style.width = `${Math.max(0, 100 * (1 - S.resultT / time))}%`;
    const n = input.nav();
    const st = input.state();
    if (S.resultT >= time || (S.resultT >= guard && (n.confirm || n.back || st.actionPressed || input.padAnyPressed()))) leaveResult();
  } else if (S.screen === 'celebrate' && S.cele && !S.modals.length) {
    celebrationInput(dt);
    if (S.cele) tickCelebration(dt);
  } else if (S.screen === 'guide' && S.unlock && !S.modals.length) {
    const n = input.nav();
    if (n.confirm || n.back || input.padAnyPressed() || input.state().actionPressed) endUnlock();
    else tickUnlock(dt);
  } else if (S.screen === 'stickers' && S.sb && !S.modals.length) stickerInput(dt);
  else menuInput(dt);
  if (S.screen === 'page' && S.pageKind !== input.kind) {
    S.pageKind = input.kind;
  $('#page-hint').textContent = input.kind === 'controller' ? '◀ ▶ turn the page · LS / RS ↑ ↓ scroll instructions' : '◀ ▶ turn the page';
    fillList($('#page-controls'), controlLines(BIRDS[S.bird]));
  }

  render(dt);
  input.endFrame();
  requestAnimationFrame(frame);
}

// ---------- rendering ----------

function render(dt = 0) {
  const t = S.t;
  if (S.screen === 'play' && S.game) {
    playView(dt);
    logical();
    g.save();
    g.beginPath();
    g.rect(0, 0, W, H);
    g.clip();
    S.game.draw(g, S.paused ? 0 : t);
    g.restore();
    // a thin ink frame around the play area
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.strokeRect(0, 0, W, H);
    if (S.game.drawOverlay) {
      // fixed on the screen: the visible part of the play area, in logical units
      const { s, ox, oy, cw, ch, dpr } = view;
      const x0 = Math.max(0, ox);
      const y0 = Math.max(0, oy);
      const w = (Math.min(cw, ox + W * s) - x0) / s;
      const h = (Math.min(ch, oy + H * s) - y0) / s;
      g.save();
      g.setTransform(dpr * s, 0, 0, dpr * s, dpr * x0, dpr * y0);
      g.beginPath();
      g.rect(0, 0, w, h);
      g.clip();
      S.game.drawOverlay(g, { w, h, s, kind: input.kind });
      g.restore();
    }
    updateHud();
    return;
  }
  if (S.screen === 'celebrate' && S.cele) {
    renderCelebration();
    return;
  }
  if (S.screen === 'stickers' && S.sb) {
    renderStickerBook(t);
    return;
  }
  if (S.screen === 'gathering') {
    renderGathering(t);
    return;
  }
  fitView();
  logical();
  if (S.screen === 'title') renderTitle(t);
  else if (S.screen === 'page') renderPage(t);
  else if (S.screen === 'guide') drawCards(t);
}

// The celebration has its own stage: 1600 x 900 on a wide screen, 900 x
// 1600 on an upright one, so the book stays big on a phone either way.
function renderCelebration() {
  const { lw, lh, px, wide } = bookStage();
  drawCelebration(g, S.cele, S.cele.t, { lw, lh, px, reduce: settings.reduceMotion, wide });
}

// The celebration's stage, set up for drawing (and for the pointer).
function bookStage() {
  const { cw, ch, dpr } = view;
  const wide = cw >= ch * 0.95;
  const lw = wide ? W : H;
  const lh = wide ? H : W;
  const s = Math.min(cw / lw, ch / lh);
  view = { ...view, s, ox: (cw - lw * s) / 2, oy: (ch - lh * s) / 2 };
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  paper(g, cw, ch);
  g.setTransform(dpr * s, 0, 0, dpr * s, dpr * view.ox, dpr * view.oy);
  return { lw, lh, px: dpr * s, wide };
}

// The sticker book, on the same stage.
function renderStickerBook(t) {
  if (S.sb?.photos) { fitView(); logical(); paper(g, W, H); return; }
  const { lw, lh, px, wide } = bookStage();
  const sb = S.sb;
  const earned = earnedSet();
  let gather = null;
  if (isGather() && hasGathering()) {
    const L = sbLayout();
    const cam = gatherCam(L, 0);
    const shake = sb.fx.find((f) => f.kind === 'shake');
    gather = {
      L,
      birds: BIRDS,
      earned,
      img: art('book.gathering'),
      atlas: ATLAS,
      grey: (id) => greyOf(id, earned),
      glow: sb.held?.id || null,
      gpos: book.gpos,
      cells: gatherCells(L),
      shake: shake && { id: shake.id, dx: Math.sin(shake.t * 45) * 12 * (1 - shake.t / shake.dur) },
      size: normalSize(),
      skip: sb.held?.id || null,
      cam: { z: cam.z, x: cam.x, y: cam.y },
      snaps: sb.fx.filter((f) => f.kind === 'snap').map((f) => {
        const i = BIRD_IDS.indexOf(f.id);
        return { b: BIRDS[i], i, from: f.from, to: spotOnStage(L, f.id), k: f.t / f.dur };
      }),
    };
  }
  drawStickerBook(g, { birds: BIRDS, earned, book, held: sb.held, hand: input.kind === 'pointer' ? null : sb.hand, bg: bookPicture(), gather }, { lw, lh, px, wide, t, reduce: settings.reduceMotion });
}

function updateHud() {
  const gm = S.game;
  const hs = $('#hud-status');
  const text = gm.hud ? gm.hud() : `Score ${Math.round(gm.score)}`;
  const pts = S.points ? `${S.points.shown} pts` : '';
  // the points after the game's own line, kept whole when it wraps
  if (hs.dataset.text !== text || hs.dataset.pts !== pts) {
    hs.dataset.text = text;
    hs.dataset.pts = pts;
    hs.textContent = pts ? `${text} ` : text;
    if (pts) {
      const span = document.createElement('span');
      span.className = 'hud-points';
      span.textContent = pts;
      hs.append(span);
    }
  }
  const tm = $('#hud-timer');
  if (typeof gm.time === 'number') {
    tm.hidden = false;
    const s = Math.ceil(gm.time);
    tm.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    tm.classList.toggle('low', s <= 5);
  } else tm.hidden = true;
}

// Where the Coot stands on the title picture, in its 1920 x 1080 pixels: by
// the stone wall on the right, above the newspaper, the emptiest place; or,
// when a narrower screen crops that away, farther off on the riverbank by the
// sun, between the camera and the traffic light.
const TITLE_COOT = [{ x: 1735, y: 655, size: 300 }, { x: 1210, y: 800, size: 240 }];
// An upright phone shows only the middle of the picture: higher up the bank there.
const TITLE_COOT_UPRIGHT = { x: 1195, y: 730, size: 260 };

function renderTitle(t) {
  const bg = art('titleBg');
  if (!bg) return;
  g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const s = Math.max(view.cw / bg.width, view.ch / bg.height);
  const ox = (view.cw - bg.width * s) / 2;
  const oy = (view.ch - bg.height * s) / 2;
  g.drawImage(bg, ox, oy, bg.width * s, bg.height * s);
  const k = bg.width / 1920;
  const spot = view.cw < view.ch ? TITLE_COOT_UPRIGHT : TITLE_COOT.find((c) => ox + (c.x + 120) * k * s <= view.cw) || TITLE_COOT[1];
  const size = spot.size * k * s;
  // Kept whole on screen when the picture is cropped at the sides.
  const x = Math.min(ox + spot.x * k * s, view.cw - size * 0.42);
  drawBird(g, 'coot', { x, y: oy + spot.y * k * s, size, t, pose: pagePose(t) });
  placePressStart(oy + CAMERA_TOP * k * s);
}

// Press Start sits on the horizon, halfway between the logo's foot and the
// top of the camera bird's handle (y 700 on the 1920 x 1080 picture).
const CAMERA_TOP = 700;
let pressAt = '';
function placePressStart(cameraTop) {
  const logo = $('#logo-img').getBoundingClientRect();
  const btn = $('#press-start');
  const top = Math.round(logo.height ? (logo.bottom + cameraTop) / 2 : cameraTop - btn.offsetHeight);
  if (`${top}` === pressAt) return;
  pressAt = `${top}`;
  btn.style.top = `${top}px`;
}

// A bird on its own page, gently doing its thing.
function pagePose(t) {
  return { growth: (Math.sin(t * 0.5) + 1) / 2, light: ['green', 'amber', 'red'][Math.floor(t / 1.6) % 3], fill: (Math.sin(t * 0.8) + 1) / 2, sing: Math.abs(Math.sin(t * 2)), click: (t % 3) < 0.2 ? (t % 3) : 0, lift: Math.sin(t * 2) > 0.6 ? -1 : Math.sin(t * 2) < -0.6 ? 1 : 0, wind: 1 };
}

// Birds that grow taller than their portrait (the Plume's bloom) are drawn a
// little smaller on their page, so the whole of them fits.
const PAGE_FIT = { plume: 0.78 };

function renderPage(t) {
  const b = BIRDS[S.bird];
  const fit = PAGE_FIT[b.id] || 1;
  const portrait = view.cw < view.ch;
  if (portrait) {
    // Upright phone: the text fills the lower part of the page, so the bird
    // is drawn at a good size in the space above it, in screen pixels.
    const top = $('.page-text').getBoundingClientRect().top;
    const area = Math.max(80, top - 16);
    const size = Math.min(area * 0.92, view.cw * 0.9) * fit;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.save();
    g.globalAlpha = 0.35;
    g.fillStyle = b.color;
    g.beginPath();
    g.ellipse(view.cw / 2, area * 0.5 + 8, Math.min(view.cw * 0.45, size * 0.7), area * 0.46, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    pageBird(b.id, { x: view.cw / 2 + size * 0.06, y: 8 + area * 0.97, size, t, pose: pagePose(t) });
    return;
  }
  g.save();
  // a soft wash behind the bird, like a page's colour
  const cx = portrait ? W / 2 : W * 0.29;
  const cy = portrait ? 330 : 470;
  g.globalAlpha = 0.35;
  g.fillStyle = b.color;
  g.beginPath();
  g.ellipse(cx, cy, portrait ? 420 : 380, portrait ? 300 : 360, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  const size = (portrait ? 520 : 640) * fit;
  const pose = pagePose(t);
  pageBird(b.id, { x: cx + size * 0.06, y: cy + 352 + (fit < 1 ? 20 : 0), size, t, pose });
}

// The page's bird: its painting once spotted, else its silhouette, standing
// still (a shadow that moved would give too much away).
function pageBird(id, opts) {
  S.pageArt = shown(S.bird) ? 'painting' : 'silhouette'; // (for the browser check)
  if (shown(S.bird)) drawBird(g, id, opts);
  else drawSilhouette(g, id, { ...opts, t: 0, pose: { growth: 0.2, light: 'green', fill: 0.6 } });
}

// The finale: all the birds together. On a wide screen the 16:9 painting
// fills the stage; upright, the book's 2:1 painting instead, its left half
// above its right, across the screen's width, so the birds stay big. The
// bird under the mouse (or a finger) shows its name.
function renderGathering(t) {
  const upright = view.cw < view.ch * 0.95;
  const book2 = art('book.gathering');
  if (upright && book2) {
    // logical units: the painting's own pixels, its halves stacked
    const hw = book2.width / 2;
    const s = Math.min(view.cw / hw, view.ch / (book2.height * 2));
    view = { ...view, s, ox: (view.cw - hw * s) / 2, oy: (view.ch - book2.height * 2 * s) / 2 };
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    paper(g, view.cw, view.ch);
    g.setTransform(view.dpr * s, 0, 0, view.dpr * s, view.dpr * view.ox, view.dpr * view.oy);
    g.drawImage(book2, 0, 0, hw, book2.height, 0, 0, hw, book2.height);
    g.drawImage(book2, hw, 0, hw, book2.height, 0, book2.height, hw, book2.height);
    if (ATLAS) {
      const toPic = (x, y) => (y < book2.height ? { x: x / book2.width, y: y / book2.height } : { x: 0.5 + x / book2.width, y: y / book2.height - 1 });
      const toUnits = (r) => ({ x: (r.cx - r.page * 0.5) * book2.width, y: (r.y + r.page) * book2.height, s: hw });
      gatheringName(ATLAS, toPic, toUnits, 1 / s);
    }
    return;
  }
  fitView();
  logical();
  const img = art('gathering');
  if (img) {
    g.drawImage(img, 0, 0, W, H);
    if (UI_ATLAS) gatheringName(UI_ATLAS, (x, y) => ({ x: x / W, y: y / H }), (r) => ({ x: r.cx * W, y: r.y * H, s: W }), 1 / view.s);
    return;
  }
  g.fillStyle = 'rgba(239,217,106,0.45)';
  g.fillRect(0, 0, W, H);
  band(g, 0, 800, W, 100, PAL.green, 0.4, 2);
  const rows = [BIRDS.slice(0, 5), BIRDS.slice(5)];
  rows.forEach((row, r) => {
    row.forEach((b, i) => {
      const x = 180 + i * 310 + (r ? 140 : 0);
      const y = r ? 860 : 520;
      drawBird(g, b.id, { x, y, size: r ? 330 : 280, t: t + i * 0.7 + r, pose: { growth: 1, light: 'green', fill: 0.7, sing: 0.6 } });
    });
  });
}

// The name of the bird under the pointer, on a paper label above it.
// toPic: logical units → painting shares; toUnits: a region → the point
// above its top in logical units, and the width there is room for; k:
// logical units per CSS pixel.
function gatheringName(atlas, toPic, toUnits, k) {
  const p = input.state().pointer;
  if (!p.active) return;
  const r = regionAt(atlas, toPic(p.x, p.y));
  if (!r) return;
  const b = BIRDS.find((x) => x.id === r.id);
  if (!b) return;
  const at = toUnits(r);
  const size = 17 * k;
  g.font = `600 ${size}px Fraunces, Georgia, serif`;
  const w = g.measureText(b.name).width + size * 1.4;
  const x = Math.max(w / 2 + 4 * k, Math.min(at.s - w / 2 - 4 * k, at.x));
  const y = Math.max(size * 1.2, at.y - size * 0.4);
  g.save();
  g.shadowColor = 'rgba(59,43,32,0.3)';
  g.shadowBlur = 6;
  g.beginPath();
  g.roundRect(x - w / 2, y - size * 0.85, w, size * 1.7, size * 0.5);
  g.fillStyle = 'rgba(251,246,232,0.96)';
  g.fill();
  g.restore();
  g.lineWidth = 1.6 * k;
  g.strokeStyle = INK;
  g.stroke();
  label(g, b.name, x, y, { size, weight: 600 });
}

// ---------- pausing on focus loss and controller loss ----------

// Away from the tab (hidden, or the window not focused): pause, and silence
// everything, music, effects and reading aloud. Back again: the sound
// returns (the game stays paused until you resume).
function away() {
  pause('The game paused while you were away.');
  audio.suspend(true);
}
function returned() {
  if (!document.hidden && document.hasFocus()) audio.suspend(false);
}
document.addEventListener('visibilitychange', () => (document.hidden ? away() : returned()));
addEventListener('blur', away);
addEventListener('focus', returned);
addEventListener('pageshow', returned);
addEventListener('gamepaddisconnected', () => {
  if (input.kind === 'controller') pause('The controller disconnected. Reconnect it, or carry on with the keyboard or touch.');
});
addEventListener('gamepadconnected', () => toast('Controller connected.'));

// ---------- boot ----------

applySettings();
// Controller prompts (the guide's Y for the sticker book) show while one is in use.
document.body.classList.toggle('pad', input.kind === 'controller');
input.onKind((k) => document.body.classList.toggle('pad', k === 'controller'));
resize();
requestAnimationFrame((n) => {
  last = n;
  frame(n);
});
// For automated checks.
globalThis.__coot = { S, act, BIRDS, startBird, show, stepAt, DEBUG, get progress() { return progress; }, get book() { return book; }, get photos() { return photos; }, stickerLayout: () => sbLayout(), stage: () => ({ ...view }),
  // the gathering, for the checks: a bird's spot and its cell on the sheet on the stage, the view
  gather: () => S.sb && isGather() ? { cam: { ...S.sb.cam }, box: sbLayout().box, win: sbLayout().win, size: normalSize(), spots: Object.fromEntries(BIRD_IDS.map((id) => [id, spotOnStage(sbLayout(), id)])), sheet: Object.fromEntries(gatherCells(sbLayout()).map((sl) => [BIRD_IDS[sl.i], { x: sl.x, y: sl.y }])) } : null };

await loadArt();
$('#loading').remove();
show('title');
// the stickers and the gathering's greyed spots, cut out while nothing else is happening
prepareWhenIdle(BIRD_IDS, { img: art('book.gathering'), atlas: ATLAS }, () => S.screen !== 'play');
