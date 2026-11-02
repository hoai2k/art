import { LEGACY, EDITION, LOOK_PARAM, FILM as FILM_ED, TITLE, STORAGE_PREFIX, applyDocumentTheme } from './theme.js';
applyDocumentTheme();
// Shell: title, act cards, play, pause, dialogs, settings, fullscreen.
import { ACTS } from './acts/index.js';
import { ACT_ART } from './act-art.js';
import { loadSave, writeSave, carryInto, recordResult } from './save.js';
import { editorWanted, openEditor } from './editor.js';
import { createRenderer, loadAssets, richText, setTouchNames } from './art.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createTouch, isTouchDevice } from './touch.js';
import { createFit } from './fit.js';
import { createCamera } from './camera.js';
import { createChrome, requestFullscreen, exitFullscreen, fullscreenElement } from './chrome.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#stage');
const live = $('#live');
const audio = createAudio();
const input = createInput();
// Phones and tablets get the touch layer; desktop never sees it.
const TOUCH = isTouchDevice();
const touch = TOUCH ? createTouch($('#touch')) : null;
if (TOUCH) { document.documentElement.classList.add('touch'); input.attachTouch(touch); }
// Size the stage to the space that's really visible (see src/fit.js).
const fitter = createFit({ app: $('#app'), stage: canvas, touch: TOUCH });
// Browser bars: fullscreen on the first tap in landscape where possible;
// on iPhone Safari, a swipe-up to tuck the bars away (see src/chrome.js).
const chrome = createChrome({ touch: TOUCH, isPlaying: () => S.mode === 'play' && !S.paused, hintEl: $('#bars-hint') });

// ---------------------------------------------------------------- settings
const SETTINGS_KEY = STORAGE_PREFIX + '.settings.v1';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Touch devices start on the gentler film look (lighter on a phone's GPU and battery).
const settings = { sound: true, period: true, music: 7, sfx: 8, mobileCamera: true, film: reduced || matchMedia('(pointer: coarse)').matches ? 'gentle' : 'full', vibration: true, extraAnimations: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch { /* storage unavailable */ }
settings.extraAnimations = settings.extraAnimations === true;
settings.mobileCamera = settings.mobileCamera !== false;
// The film edition's cast look: the hand-tinted alternates by default, or the
// first art (design/character-audit.md). `cast` replaces the earlier
// `castLook`, so the new default reaches everyone; ?look= overrides it.
delete settings.castLook;
if (LOOK_PARAM === 'tinted' || LOOK_PARAM === 'original') settings.cast = LOOK_PARAM;
if (settings.cast !== 'original') settings.cast = 'tinted';
if (!LEGACY) { settings.period = true; document.querySelector('[data-key="period"]').hidden = true; }
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } };
const FILM = { full: 'Full', gentle: 'Gentle', off: 'Off' };
function syncSettingsUI() {
  for (const el of document.querySelectorAll('#settings [data-key]')) {
    const k = el.dataset.key;
    if (el.type === 'range') el.value = settings[k];
    else if (k === 'film') el.querySelector('span').textContent = FILM[settings.film];
    else if (k === 'vibration') el.querySelector('span').textContent = settings.vibration ? 'On' : 'Off';
    else if (k === 'sound') el.querySelector('span').textContent = settings.sound ? 'On' : 'Off';
    else if (k === 'period') el.querySelector('span').textContent = settings.period ? 'On' : 'Off';
    else if (k === 'extraAnimations') el.querySelector('span').textContent = settings.extraAnimations ? 'On' : 'Off';
    else if (k === 'mobileCamera') el.querySelector('span').textContent = settings.mobileCamera ? 'Follow' : 'Whole stage';
    else if (k === 'castLook') el.querySelector('span').textContent = settings.cast === 'tinted' ? 'Tinted' : 'Original';
  }
  audio.setVolumes(settings.music / 10, settings.sfx / 10);
  audio.setSound(settings.sound !== false);
  syncSoundButton();
}
const SOUND_ICON = {
  on: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></g>',
  off: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></g>',
};
function syncSoundButton() {
  const b = document.getElementById('btn-sound');
  if (!b) return;
  const on = settings.sound !== false;
  const label = on ? 'Sound on' : 'Sound off';
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', label);
  b.dataset.tip = label;
  b.classList.toggle('is-off', !on);
  b.querySelector('svg').innerHTML = on ? SOUND_ICON.on : SOUND_ICON.off;
}
for (const el of document.querySelectorAll('#settings [data-key]')) {
  const k = el.dataset.key;
  if (el.type === 'range') el.addEventListener('input', () => { settings[k] = +el.value; syncSettingsUI(); saveSettings(); });
  else el.addEventListener('click', () => {
    if (k === 'film') settings.film = { full: 'gentle', gentle: 'off', off: 'full' }[settings.film];
    if (k === 'sound') settings.sound = !settings.sound;
    if (k === 'vibration') settings.vibration = !settings.vibration;
    if (k === 'extraAnimations') settings.extraAnimations = !settings.extraAnimations;
    if (k === 'mobileCamera') settings.mobileCamera = !settings.mobileCamera;
    if (k === 'castLook') settings.cast = settings.cast === 'tinted' ? 'original' : 'tinted';
    if (k === 'period') { settings.period = !settings.period; audio.setPeriodOn(settings.period); }
    syncSettingsUI(); saveSettings(); audio.play('ui');
  });
}
syncSettingsUI();

// ---------------------------------------------------------------- state
let assets = { slots: {}, images: {} };
let assetsLoaded = false;
// How much of the art has arrived: the act card waits for all of it, so a
// scene never opens on its stand-ins (an image that fails still counts as
// arrived, so the wait always ends).
let artLoaded = 0, artTotal = 0, artAll = false;
// Each act's own art (src/act-art.js, by edition and cast look) loads ahead
// of the rest: the act most likely to be opened next while the title and
// playbill wait, the chosen act during its card, then the act after it. The
// card waits only for its own act's art, and only once A is pressed.
const tintedLook = () => FILM_ED && settings.cast === 'tinted';
const actArt = (i) => ACT_ART[EDITION]?.[ACTS[i]?.key || String(ACTS[i]?.id)]?.[tintedLook() ? 'tinted' : 'original'] || [];
let wantedAct = null;
function wantAct(i) {
  if (!assets?.want || i == null || i < 0 || i >= ACTS.length) return;
  const key = `${i}|${tintedLook()}`;
  if (wantedAct === key) return;
  wantedAct = key;
  assets.want(actArt(i)).then(() => { if (wantedAct === key && i + 1 < ACTS.length) assets.want(actArt(i + 1)); });
}
const actArtProgress = (i) => (assets?.progress ? assets.progress(actArt(i)) : { done: 0, total: 1 });
const actArtReady = (i) => { const p = actArtProgress(i); return p.done >= p.total; };
// The act the title's Start (or the playbill's selection) would most likely open.
const predictedAct = () => (S.mode === 'playbill' ? S.pb : save.unlocked > 1 ? Math.min(save.unlocked, ACTS.length) - 1 : 0);
// The title waits behind a spinner for its own art (the first wave and the
// painted title), so it never shows the drawn stand-ins first.
let firstArt = false, booted = false;
// What the title draws (src/art.js scene: the sky, sea and frame); it opens
// as soon as these are in, or the whole first wave if one of them fails.
const TITLE_ART = ['proscenium', 'curtain-panel', 'footlight', 'sky-backdrop', 'moon-face', 'cloud', 'waves-back', 'waves-mid', 'waves-front', FILM_ED ? 'playbill-film' : 'playbill'];
const titleArt = () => firstArt || (assetsLoaded && TITLE_ART.every((id) => !(assets.slots[id]?.status === 'delivered') || assets.images[id]));
// The song gates the curtain: 'ready', or given up on ('failed'/'none').
const songStatus = () => (assetsLoaded ? audio.trackStatus() : { state: 'loading', progress: 0 });
const songSettled = () => ['ready', 'failed', 'none'].includes(songStatus().state);
let renderer = createRenderer(canvas, assets);
const S = {
  mode: 'title', // title | intro | play | over | end
  board: null, curtain: 0, curtainTarget: 0,
  card: null, modeT: 0, t: 0,
  paused: false, titleNav: false,
};
const dialogs = []; // stack of open dialog elements

// Delivered art for the touch controls and the rotate card (image requests D).
function touchArt(a) {
  const url = (im) => im.src || im.toDataURL(); // ?testart placeholders are canvases
  const set = (sel, id) => { const im = a.images[id]; const el = document.querySelector(sel); if (im && el) { el.style.setProperty('--art', `url("${url(im)}")`); el.classList.add('has-art'); } };
  set('.stick-base', 'touch-stick-base'); set('.stick-knob', 'touch-stick-knob'); set('.tbtn-pause', 'touch-pause');
  for (const el of document.querySelectorAll('.tbtn-a, .tbtn-b')) if (a.images['touch-button']) { el.style.setProperty('--art', `url("${url(a.images['touch-button'])}")`); el.classList.add('has-art'); }
  if (a.images['rotate-card']) { const im = $('#rotate-img'); im.src = url(a.images['rotate-card']); im.hidden = false; }
}

// Act I and the title load first; the other acts' art follows in the background.
const FIRST_ART = ['logo', 'playbill', 'playbill-film', 'rotate-card', 'touch-stick-base', 'touch-stick-knob', 'touch-button', 'touch-pause', 'proscenium', 'curtain-panel', 'footlight', 'sky-backdrop', 'moon-face', 'cloud', 'waves-back', 'waves-mid', 'waves-front',
  'ship', 'witch-moonboat', 'rock', 'pearl', 'tea-leaf', 'keepsake-tea', 'lighthouse', 'lighthouse-lit', 'band-trio',
  'deck-set', 'reveller-yellow', 'reveller-shaggy', 'reveller-jester', 'reveller-lady', 'lantern-string', 'sea-spirit',
  'ship-wreck-bow', 'ship-wreck-stern', 'guitar-sinking', 'waterspout'];
// The painted title: index.html starts it loading; this only confirms it (or
// shows it, if that loader gave up early).
const showLogo = (logo) => {
  const el = $('#logo-img'), card = $('#logo');
  el.alt = TITLE;
  if (card.classList.contains('has-img')) return;
  if (el.src !== logo.src) el.src = logo.src;
  card.classList.remove('no-img'); el.hidden = false; card.classList.add('has-img');
};
const TOUCH_ART = new Set(['touch-stick-base', 'touch-stick-knob', 'touch-button', 'touch-pause', 'rotate-card']);
loadAssets('assets/', { first: FIRST_ART, onImage: (id, im) => {
  artLoaded++;
  if (id === 'logo') showLogo(im);
  // Images arrive after the manifest; apply the touch art as each one lands.
  if (TOUCH && TOUCH_ART.has(id)) touchArt({ images: { [id]: im } });
} }).then((a) => {
  assets = a;
  artTotal = Object.values(a.slots).filter((sl) => sl.status === 'delivered' && sl.file).length;
  a.all.then(() => { artAll = a.failed.length === 0; });
  a.ready.then(() => { firstArt = true; wantAct(predictedAct()); });
  const song = a.audio?.song;
  if (song?.status === 'delivered' && song.file) audio.setTrack('assets/' + song.file, song.loopStart, song.loopEnd);
  const sfx = Object.fromEntries(Object.entries(a.sfx || {})
    .filter(([, v]) => v.status === 'delivered' && v.file).map(([k, v]) => [k, 'assets/' + v.file]));
  audio.setSfx(sfx);
  // Period accompaniment after the song (design/music.md).
  audio.setPeriod(Object.entries(a.audio?.period || {}).filter(([, v]) => v.status === 'delivered' && v.file)
    .map(([id, v]) => ({ id, url: 'assets/' + v.file, moods: v.moods || [] })));
  audio.setPeriodOn(settings.period);
  assetsLoaded = true;
  renderer = createRenderer(canvas, assets);
  if (assets.images.logo) showLogo(assets.images.logo);
  if (TOUCH) touchArt(assets);
});

// ---------------------------------------------------------------- flow
// Modes: title, playbill, intro (act card), play, over (retry card),
// curtaincall. One act module (src/acts/) is on stage at a time.
const save = loadSave();
const params = new URLSearchParams(location.search);
const QA = params.has('qa');
const CRACKLE = params.get('crackle') === 'on';
// ?edit=local: choose each edition's unlocked acts on this machine (editor.js),
// from a button beside the options; this edition's save reloads on a change.
if (editorWanted()) {
  const reload = (id) => { if (id === EDITION) { const s = loadSave(); for (const k of Object.keys(save)) delete save[k]; Object.assign(save, s); } };
  const b = document.createElement('button');
  b.className = 'icon unlock-btn'; b.textContent = 'Unlocks'; b.setAttribute('aria-label', 'Unlocked acts'); b.dataset.focus = '';
  b.addEventListener('click', () => openEditor(reload));
  document.querySelector('#icons .corner-left')?.prepend(b);
  addEventListener('load', () => openEditor(reload), { once: true });
}

function startGame() {
  if (S.mode !== 'title' || dialogs.length || document.querySelector('#unlock-editor[open]')) return;
  leaveTitle();
  const jump = QA && +params.get('act');
  if (jump >= 1 && jump <= ACTS.length) return beginAct(jump - 1, params.has('scene') ? { scene: +params.get('scene') } : null);
  if (save.unlocked > 1) showPlaybill(); else beginAct(0);
}

// Raise the title curtain: fullscreen and the selected edition’s score.
function leaveTitle() {
  requestFullscreen();
  if (TOUCH) screen.orientation?.lock?.('landscape').catch(() => { /* not allowed here; the rotate card covers it */ });
  audio.unlock(); audio.startMusic(); audio.play('ui');
  $('#title').classList.add('opening');
  setTimeout(() => { $('#title').hidden = true; $('#title').classList.remove('opening'); }, 600);
}

function carryFor(i) {
  const carry = carryInto(save, i + 1);
  // ?qa&act=N&carry=all starts a later act as if every keepsake were held.
  if (QA && params.get('carry') === 'all') Object.assign(carry, { tea: 3, guitar: true, pearl: true, stone: true, sleepers: 6 });
  if (QA && params.get('carry') === 'rose') Object.assign(carry, { tea: 3, guitar: true, rose: true, pearl: true, stone: true, sleepers: 12 });
  return carry;
}

// Starts act i from the top, or `from` a scene ({ scene }) or a checkpoint
// the act made earlier (src/acts/CONTRACT.md, "Scenes and checkpoints").
function beginAct(i, from = null) {
  renderer.clearFx(); camera.reset();
  S.actIndex = i; S.act = ACTS[i];
  wantAct(i);
  S.state = S.act.create({ seed: (Math.random() * 2 ** 31) | 0, carry: carryFor(i), from: from ? { ...from } : null });
  S.checkpoint = S.state.checkpoint ? JSON.parse(JSON.stringify(S.state.checkpoint)) : null;
  S.cpRef = S.state.checkpoint;
  S.mode = 'intro'; S.modeT = 0;
  S.curtain = 0; S.curtainTarget = 0;
  const scene = from && S.act.scenes?.[from.scene | 0];
  S.card = { kicker: S.act.kicker, title: S.act.title, size: S.act.size || 120,
    sub: scene && (from.scene | 0) > 0 ? `${from.retry ? 'Carrying on from' : 'Scene'}: ${scene.name}` : S.act.sub,
    prompts: { touch: `Tap to begin · ${touchVerbHint(S.act)}`, other: 'Press [A] to begin' }, alpha: 0 };
  S.readyT = 0;
  S.skipIntertitle = !!from?.retry;
  announce(`${S.act.kicker}, ${S.act.title}.${scene && from.scene > 0 ? ' ' + scene.name + '.' : ''}`);
}

// The act sets state.checkpoint as the player passes a point worth resuming
// from. Keep the latest (a retry starts there) and note how far each act has
// been reached, for the scene select.
function trackCheckpoint() {
  const cp = S.state?.checkpoint;
  if (!cp || cp === S.cpRef) return;
  S.cpRef = cp;
  S.checkpoint = JSON.parse(JSON.stringify(cp));
  const id = S.actIndex + 1, k = cp.scene | 0;  // saves are keyed by place in the list
  save.scenes = save.scenes || {};
  if (k > (save.scenes[id] ?? 0)) { save.scenes[id] = k; writeSave(save); }
}

function showPlaybill() {
  S.mode = 'playbill'; S.modeT = 0; S.act = null; S.state = null; S.card = null;
  S.curtainTarget = 1; // the playbill hangs on the stage, so open the curtains on it
  S.pb = Math.min(save.unlocked, ACTS.length) - 1;
  announce('The playbill. Choose an act.');
}

function toTitle() {
  closeAllDialogs();
  S.paused = false; S.mode = 'title'; S.act = null; S.state = null; S.card = null; S.curtainTarget = 0;
  $('#pause').hidden = true; $('#title').hidden = false; $('#touch').hidden = true;
  S.titleNav = false; clearNavFocus();
  audio.resume();
  $('#start').focus({ preventScroll: true });
}

function pause(note = '') {
  if (S.paused || S.mode === 'title') return;
  S.paused = true;
  $('#pause-note').textContent = note;
  // on the playbill there is no act to restart
  $('#pause [data-act=restart]').hidden = !S.act;
  openDialog($('#pause'));
  audio.play('ui');
}
function resume() {
  if (!S.paused) return;
  S.paused = false;
  closeAllDialogs();
}

// ---------------------------------------------------------------- dialogs
function openDialog(el, focusOn = null) {
  el.hidden = false;
  dialogs.push({ el, restore: document.activeElement });
  focusEl(focusOn || el.querySelector('[data-focus]:not(.card-x)'));
}
// A tap or click outside a dialog's card closes it (the pause menu resumes).
// Only a tap that both starts and ends on the backdrop: the tap that opened
// the dialog (the pause button under it) mustn't close it again.
document.querySelectorAll('.layer.dialog').forEach((el) => {
  let downOnBackdrop = false;
  el.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === el; });
  el.addEventListener('click', (e) => {
    const ok = downOnBackdrop && e.target === el && dialogs[dialogs.length - 1]?.el === el;
    downOnBackdrop = false;
    if (!ok) return;
    audio.play('ui');
    if (el.id === 'pause') resume(); else closeDialog();
  });
});

// ---------------------------------------------------------------- instructions
// One page per act; the dialog opens on the act being played (or chosen on
// the playbill, or the furthest reached from the title).
const insTabs = [...document.querySelectorAll('#instructions [role=tab]')].filter((t) => !t.classList.contains('ed-off'));
function showInsPage(n) {
  for (const t of insTabs) t.setAttribute('aria-selected', String(+t.dataset.page === n));
  for (const p of document.querySelectorAll('#instructions .ins-page')) p.hidden = +p.dataset.page !== n || p.classList.contains('ed-off');
  $('#ins-scroll').scrollTop = 0;
}
function openInstructions() {
  const pageOf = (a) => a.page ?? a.id;  // an act may name its instructions page
  const n = S.act ? pageOf(S.act) : S.mode === 'playbill' ? pageOf(ACTS[S.pb]) : pageOf(ACTS[Math.max(0, Math.min(save.unlocked, ACTS.length) - 1)]);
  showInsPage(n);
  openDialog($('#instructions'), insTabs.find((t) => +t.dataset.page === n));
}
for (const t of insTabs) {
  t.addEventListener('click', () => showInsPage(+t.dataset.page));
  t.addEventListener('focus', () => showInsPage(+t.dataset.page));
}

// ---------------------------------------------------------------- scene select
// Every scene of a finished act, and the scenes reached so far in the next.
function scenesReached(a) {
  const last = (a.scenes?.length || 1) - 1, slot = ACTS.indexOf(a) + 1;
  return save.results[slot] ? last : Math.min(last, save.scenes?.[slot] ?? 0);
}
function openScenes() {
  const list = $('#scene-list');
  list.textContent = '';
  let focus = null;
  ACTS.forEach((a, i) => {
    if (i >= save.unlocked) return;
    const h = document.createElement('h3');
    h.textContent = `${a.kicker} · ${a.title}`;
    const grid = document.createElement('div'); grid.className = 'scene-grid';
    const reached = scenesReached(a);
    (a.scenes || [{ name: a.title }]).forEach((sc, k) => {
      const b = document.createElement('button');
      const open = k <= reached;
      b.innerHTML = `<small>SCENE ${k + 1}</small>`;
      b.append(open ? sc.name : '· · ·');
      if (open) {
        b.dataset.focus = '';
        b.addEventListener('click', () => { audio.play('ui'); playScene(i, k); });
        if (S.act ? i === S.actIndex && k <= (S.checkpoint?.scene | 0) : i === save.unlocked - 1) focus = b;
      } else b.disabled = true;
      grid.append(b);
    });
    list.append(h, grid);
  });
  $('#scene-note').textContent = save.unlocked < ACTS.length ? 'Play on to open more scenes.' : '';
  openDialog($('#scenes'), focus);
}
function playScene(i, k) {
  closeAllDialogs();
  S.paused = false;
  if (S.mode === 'title') leaveTitle();
  beginAct(i, k > 0 ? { scene: k } : null);
}
function closeDialog() {
  const d = dialogs.pop();
  if (!d) return;
  d.el.hidden = true;
  if (d.el.id === 'pause') S.paused = false;
  const restore = d.restore && document.contains(d.restore) && !d.restore.closest('[hidden]') ? d.restore : null;
  if (restore) focusEl(restore, false);
  else clearNavFocus();
}
function closeAllDialogs() { while (dialogs.length) closeDialog(); }

document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
  const a = b.dataset.act;
  audio.play('ui');
  if (a === 'close') { if (b.closest('#pause')) resume(); else closeDialog(); }
  if (a === 'resume') resume();
  if (a === 'instructions') openInstructions();
  if (a === 'scenes') openScenes();
  if (a === 'settings') openDialog($('#settings'));
  if (a === 'credits') openDialog($('#credits'), $('#credits .card-x'));
  if (a === 'restart') { closeAllDialogs(); S.paused = false; if (S.act) beginAct(S.actIndex); else showPlaybill(); }
  if (a === 'title') toTitle();
}));
$('#start').addEventListener('click', startGame);
$('#btn-settings').addEventListener('click', () => { audio.play('ui'); openDialog($('#settings')); });
$('#btn-sound').addEventListener('click', () => {
  settings.sound = !settings.sound;
  syncSettingsUI(); saveSettings(); audio.play('ui');
});
$('#btn-fullscreen').addEventListener('click', () => {
  audio.play('ui');
  // iPhone Safari can't go fullscreen: point at the ways it can lose its bars.
  if (chrome.scrollTrick) { const h = $('#bars-hint'); h.hidden = false; h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash'); announce(h.textContent); return; }
  toggleFullscreen();
});

// ---------------------------------------------------------------- focus nav
function focusables() {
  const layer = dialogs.length ? dialogs[dialogs.length - 1].el : (S.mode === 'title' ? $('#title') : null);
  const extra = !dialogs.length && S.mode === 'title' ? [...$('#icons').querySelectorAll('[data-focus]')] : [];
  return layer ? [...layer.querySelectorAll('[data-focus]'), ...extra].filter((e) => !e.closest('[hidden]')) : [];
}
function clearNavFocus() { document.querySelectorAll('.nav-focus').forEach((e) => e.classList.remove('nav-focus')); }
function focusEl(el, mark = true) {
  if (!el) return;
  clearNavFocus();
  el.focus({ preventScroll: true });
  if (el.closest('.scroll') && !el.classList.contains('scroll')) el.scrollIntoView({ block: 'nearest' });
  if (mark) (el.closest('.slider') || el).classList.add('nav-focus');
}
// Scene cards form a responsive grid. Navigate their actual rectangles so
// vertical presses stay in a column even when the number of columns changes.
function sceneNav(direction) {
  const list = focusables().filter(el => !el.disabled && el.getBoundingClientRect().width > 0);
  const current = document.activeElement;
  if (!list.includes(current)) { focusEl(list[0]); return; }
  const box = current.getBoundingClientRect();
  const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
  const vertical = direction === 'up' || direction === 'down';
  const sign = direction === 'up' || direction === 'left' ? -1 : 1;
  // Offscreen rows still belong to the scrolling grid. Keep the fixed
  // close button from interrupting movement between those rows.
  const inGrid = !!current.closest('.scene-grid');
  const targets = inGrid ? list.filter(el => el.closest('.scene-grid')) : list;
  const candidates = targets.filter(el => el !== current).map(el => {
    const rect = el.getBoundingClientRect();
    const dx = (rect.left + rect.right) / 2 - cx, dy = (rect.top + rect.bottom) / 2 - cy;
    return { el, rect, forward: (vertical ? dy : dx) * sign, across: Math.abs(vertical ? dx : dy) };
  }).filter(candidate => candidate.forward > 1 && (vertical ||
    Math.min(box.bottom, candidate.rect.bottom) - Math.max(box.top, candidate.rect.top) > 1));
  if (!candidates.length) {
    if (inGrid && direction === 'up') focusEl(list.find(el => el.classList.contains('card-x')));
    return;
  }
  const nearest = Math.min(...candidates.map(candidate => candidate.forward));
  const row = candidates.filter(candidate => candidate.forward <= nearest + 2);
  row.sort((a, b) => a.across - b.across);
  focusEl(row[0].el);
  audio.play('ui');
}
function navMove(delta, direction) {
  if (dialogs[dialogs.length - 1]?.el.id === 'scenes') return sceneNav(direction);

  const list = focusables();
  if (!list.length) return;
  let i = list.indexOf(document.activeElement);
  i = i < 0 ? 0 : (i + delta + list.length) % list.length;
  focusEl(list[i]);
  audio.play('ui');
}
function navActivate() {
  const el = document.activeElement;
  if (!el || el === document.body) return;
  if (el.type === 'range') return;
  el.click();
}
function navAdjust(dir) {
  const el = document.activeElement;
  if (el?.type === 'range') { el.value = +el.value + dir; el.dispatchEvent(new Event('input')); return true; }
  if (el?.id === 'ins-scroll') return false;
  return false;
}

function menuInput(i) {
  const el = document.activeElement;
  // Instructions tabs: left and right turn the page, down reads it.
  if (el?.getAttribute('role') === 'tab') {
    const n = insTabs.indexOf(el);
    if (i.left || i.right) { focusEl(insTabs[(n + (i.left ? -1 : 1) + insTabs.length) % insTabs.length]); audio.play('ui'); return; }
    if (i.down) { focusEl($('#ins-scroll')); return; }
    if (i.up) return;
  }
  if (el?.id === 'ins-scroll' && i.up && el.scrollTop <= 0) { focusEl(insTabs.find((t) => t.getAttribute('aria-selected') === 'true')); return; }
  if (el?.id === 'ins-scroll' && (i.left || i.right)) {
    const n = insTabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    showInsPage(+insTabs[(n + (i.left ? -1 : 1) + insTabs.length) % insTabs.length].dataset.page); audio.play('ui'); return;
  }
  if (el?.id === 'ins-scroll' && (i.up || i.down)) { el.scrollBy({ top: i.up ? -80 : 80 }); if (!(i.up && el.scrollTop <= 0) && !(i.down && el.scrollTop + el.clientHeight >= el.scrollHeight - 2)) return; }
  if (i.up) navMove(-1, 'up');
  if (i.down) navMove(1, 'down');
  if (i.left && !navAdjust(-1)) navMove(-1, 'left');
  if (i.right && !navAdjust(1)) navMove(1, 'right');
  if (i.padA) navActivate();
  if (i.padB) closeDialog();
  else if (i.back && dialogs.length) closeDialog();
  if (i.padStart && dialogs.length && dialogs[dialogs.length - 1].el.id === 'pause') resume();
}

// Keyboard on the title: Enter starts when nothing is focused; native
// buttons handle their own Enter/Space.
window.addEventListener('keydown', (e) => {
  if (S.mode === 'title' && !dialogs.length && e.code === 'Enter' && (document.activeElement === document.body || !document.activeElement)) startGame();
  if (e.code === 'Escape' && document.fullscreenElement) { /* browser exits fullscreen; resize is CSS-driven */ }
});

// ---------------------------------------------------------------- fullscreen
// Fullscreen helpers (with the webkit prefix iPad Safari needs) live in chrome.js.
function toggleFullscreen() {
  if (fullscreenElement()) exitFullscreen();
  else requestFullscreen();
}

// ---------------------------------------------------------------- pause triggers
// A hidden tab or an unfocused window pauses play and silences every sound
// (the one AudioContext carries the song, the sea loop and the effects);
// sound returns once the page is both visible and focused again.
function syncAway() {
  if (document.hidden || !document.hasFocus()) { if (S.mode === 'play') pause(); audio.suspend(); } else audio.resume();
}
document.addEventListener('visibilitychange', syncAway);
addEventListener('blur', syncAway);
addEventListener('focus', syncAway);
input.on('disconnect', (pad, wasOwner) => {
  if (wasOwner && S.mode === 'play') pause('Controller disconnected — reconnect it, or carry on with keys or touch.');
});
input.on('connect', () => announce('Controller connected.'));

function announce(msg) { live.textContent = msg; }

// ---------------------------------------------------------------- loop
let last = performance.now(), heldLook = null;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // Until the title's art is in (and its painted title decoded, or given up
  // on), only the spinner shows: no drawn stand-ins.
  if (!booted) {
    if (!(titleArt() && $('#logo').matches('.has-img, .no-img'))) { requestAnimationFrame(frame); return; }
    booted = true;
    document.body.classList.remove('booting');
    $('#start').focus({ preventScroll: true });
  }
  // Paused, the stage stands still: lanterns, hooks and water are drawn from
  // this clock, so it stops with the play beneath the pause menu.
  if (!(S.paused && S.mode === 'play')) S.t += dt;
  const i = input.poll(dt);
  update(dt, i);
  if (!(S.paused && S.mode === 'play')) updateCamera(dt);
  const view = currentView();
  renderer.tick(S.paused ? 0 : dt, view);
  // Paused in play, the last frame holds still under the menu (the film
  // grain and flicker included), drawn again only if a setting changes it.
  const still = S.paused && S.mode === 'play';
  const look = `${view.film}|${view.tinted}|${view.extraAnimations}`;
  if (!still || look !== heldLook) renderer.render(view);
  heldLook = still ? look : null;
  requestAnimationFrame(frame);
}

function currentView() {
  return {
    act: S.act, state: S.state, curtain: S.curtain, card: S.card, film: settings.film, extraAnimations: settings.extraAnimations === true, tinted: FILM_ED && settings.cast === 'tinted', t: S.t,
    hud: S.mode === 'play' || S.mode === 'over',
    curtainCall: S.mode === 'curtaincall' ? Math.min(1, S.modeT / 1.4) : 0,
    scene: S.mode === 'playbill' ? drawPlaybill : S.mode === 'curtaincall' ? drawCurtainCall : null,
    cam: S.act && S.state && camera.view.z > 1 ? camera.view : null,
    fade: S.mode === 'play' ? S.act?.fade?.(S.state) || 0 : 0,
  };
}

// ---------------------------------------------------------------- camera
// On a phone the camera eases in toward the player while he has the scene in
// hand, and out to the whole stage for the rest (src/camera.js). Desktops and
// tablets never zoom; Settings > Mobile camera turns it off. ?camera=phone
// tries it on any screen (QA), ?camera=off turns it off.
const camera = createCamera();
const CAM_PARAM = params.get('camera');
const smallScreen = () => CAM_PARAM === 'phone' || (TOUCH && Math.min(innerWidth, innerHeight) <= 600);
function syncCameraSetting() { const b = document.querySelector('[data-key="mobileCamera"]'); if (b) b.hidden = !smallScreen(); }
addEventListener('resize', syncCameraSetting);
syncCameraSetting();
function updateCamera(dt) {
  const st = S.state;
  const live = S.mode === 'play' && !!st && S.curtain > 0.9 && touchLive();
  let focus = null;
  try { focus = live && S.act.focus ? S.act.focus(st) : null; } catch { focus = null; }
  if (focus && !(Number.isFinite(focus.x) && Number.isFinite(focus.y))) focus = null;
  camera.update(dt, {
    enabled: settings.mobileCamera && CAM_PARAM !== 'off' && smallScreen(),
    live, focus, scene: `${S.actIndex}:${st?.phase}:${st?.tf ? 'tf' + st.tf.set : ''}`,
  });
}

function updateLoadbar() {
  const st = songStatus();
  // On the title the song can only download; decoding waits for Press Start.
  const done = ['downloaded', 'decoding', 'ready', 'failed', 'none'].includes(st.state);
  const pct = Math.round((done ? 1 : st.progress / 0.95) * 100);
  $('#loadbar-fill').style.width = pct + '%';
  $('#loadbar').setAttribute('aria-valuenow', pct);
  $('#loadbar').classList.toggle('done', done && st.state !== 'failed');
  $('#loadbar-label').textContent = st.state === 'failed' ? 'The music could not be loaded' : done ? 'Ready' : `${LEGACY ? "Tuning up the band" : "Tuning the orchestra"}… ${pct}%`;
}

// The scene’s period-music mood. Only the query edition reprises its song.
function musicMood() {
  const id = S.act?.id, ph = S.state?.phase;
  if (S.mode === 'curtaincall') return LEGACY ? 'song' : 'revel';
  if (!S.act || S.mode === 'title' || S.mode === 'playbill') return 'tender';
  if (S.act.mood) return S.act.mood(S.state || {});  // a film-edition act chooses its own
  if (id === 1) return ph === 'party' ? 'revel' : ['turn', 'wreck', 'sink', 'iris'].includes(ph) ? 'storm' : 'voyage';
  if (id === 2) return ph === 'ride' ? 'voyage' : 'deep';
  if (id === 3) return 'revel';
  if (id === 4) return 'deep';
  if (id === 5) return ph === 'pageant' || ph === 'iris' ? (LEGACY ? 'song' : 'revel') : ['storm', 'house', 'quay'].includes(ph) ? 'storm' : 'tender';
  return 'voyage';
}

// The input in use, for prompts: 'pad' (Xbox button glyphs), 'key' or 'touch'.
function trackInputMode(i) {
  if (i.keyAny) S.keySeen = true;
  // moving about with the keyboard (Tab, arrows) shows where focus is
  if (i.keyNav && !document.body.classList.contains('keys')) document.body.classList.add('keys');
  const mode = i.source === 'pad' ? 'pad' : i.source === 'touch' || (TOUCH && !S.keySeen) ? 'touch' : 'key';
  if (mode !== S.inputMode) { S.inputMode = mode; syncTitleHint(); }
  renderer.kit.inputMode = mode; // acts draw button prompts for it (richText)
  // a phone-sized stage: prompts are drawn larger to stay readable, and on
  // a touch screen no text is drawn smaller than MIN_TEXT css px
  renderer.kit.compact = canvas.clientWidth < 900;
  renderer.setMinFont(TOUCH ? MIN_TEXT * 1280 / Math.max(1, canvas.clientWidth) : 0);
  if (S.card?.prompts) { S.card.mode = mode; S.card.prompt = mode === 'touch' ? S.card.prompts.touch : S.card.prompts.other; }
}

function update(dt, i) {
  trackInputMode(i);
  // what to load first: the act on stage, or the one the menus point to
  // (re-asked when the playbill selection or the cast look changes)
  if (firstArt) wantAct(S.act ? S.actIndex : ['title', 'playbill'].includes(S.mode) ? predictedAct() : null);
  if (S.mode === 'title') updateLoadbar();
  const mood = musicMood();
  if (mood === 'song') audio.returnToSong(); else audio.setMood(mood);
  if (FILM_ED && S.state?.phase === 'wedding' && !S.state.weddingMusicStarted) {
    // On a slow connection, keep black until the actual wedding recording
    // starts; its musical lead must precede the reveal, not run during loading.
    S.state.phaseT = 0;
    if (audio.nowPlaying()?.id === 'period-wedding' || audio.periodStates().includes('period-wedding:failed')) S.state.weddingMusicStarted = true;
  }
  audio.setMusicLevel(FILM_ED && S.state?.phase === 'victory' ? 0 : 1);
  // The score and the sea play throughout, as before. Optionally (?crackle=on)
  // the score waits for play and an old record's crackle fills the menus (the
  // title, playbill, act cards, pause and dialogs); not in Widow's Bay.
  audio.setStage(S.mode === 'play' && !S.paused, CRACKLE && !LEGACY);
  S.curtain += (S.curtainTarget - S.curtain) * Math.min(1, dt * 2.2);
  if (TOUCH) updateTouch();
  updateIcons(dt);

  // Menus have the input while any dialog is open.
  if (dialogs.length) { menuInput(i); return; }

  if (S.mode === 'title') {
    if (!S.titleNav) {
      if (i.stickNav) { S.titleNav = true; focusEl($('#start')); syncTitleHint(); return; }
      if (i.anyPad) startGame();
    } else {
      if (i.padStart) return startGame();
      if (i.padB) { S.titleNav = false; clearNavFocus(); document.activeElement?.blur(); syncTitleHint(); return; }
      menuInput({ ...i, padB: false, back: false });
    }
    return;
  }

  S.modeT += dt;
  const go = i.padA || i.confirm || !!i.tap;

  if (S.mode === 'playbill') {
    // the pause menu works here as in play (Escape, P, the pad's menu button
    // or the touch pause button); B or Backspace go back to the title
    if (i.pause) { pause(); return; }
    const n = Math.min(save.unlocked, ACTS.length);
    if (i.up) { S.pb = (S.pb + n - 1) % n; audio.play('ui'); }
    if (i.down) { S.pb = (S.pb + 1) % n; audio.play('ui'); }
    if (i.tap) {
      // Tap a line of the playbill to begin that act; tap outside it for the title.
      const pb = playbillRows();
      let row = -1;
      pb.ys.forEach((y, r) => { if (r < n && Math.abs(i.tap.y - y) <= pb.half && (row < 0 || Math.abs(i.tap.y - y) < Math.abs(i.tap.y - pb.ys[row]))) row = r; });
      if (i.tap.x > pb.x0 && i.tap.x < pb.x1 && row >= 0) { S.pb = row; if (S.modeT > 0.3) beginAct(row); }
      else if (i.tap.y > 650 || i.tap.x < (pb.art ? pb.left - 10 : 330) || i.tap.x > (pb.art ? pb.left + PB.w + 10 : 950)) toTitle();
      return;
    }
    if (go && S.modeT > 0.3) beginAct(S.pb);
    else if (i.padB || (i.back && !i.pause)) toTitle();
    return;
  }

  if (S.mode === 'intro') {
    S.card.alpha = Math.min(1, S.modeT * 2.5);
    // Hold the card until the song can play and the art has arrived,
    // showing their progress.
    if (!songSettled()) { S.card.loading = songStatus().progress; S.readyT = 0; if (i.pause) pause(); return; }
    // The card shows its prompt at once while the act's art loads behind it.
    // Pressed (or timed out) before the art is in, the prompt becomes a
    // loading bar, and the act begins as soon as the bar fills.
    const artIn = actArtReady(S.actIndex);
    // An act's own art that failed to load stops at its card: never the stand-ins.
    if (artIn && assets?.failed?.length && actArt(S.actIndex).some((id) => assets.failed.includes(id))) {
      S.card.error = 'The scenery could not load. Please reload.'; S.card.loading = null; S.readyT = 0;
      if (i.pause) pause();
      return;
    }
    if (S.card.loading != null && artIn) { S.card.loading = null; S.card.loadingText = null; announce('Ready.'); }
    S.readyT = (S.readyT || 0) + dt;
    const wants = (go && S.readyT > 0.4) || S.readyT > (S.card.body ? 12 : 6) || S.card.waiting;
    if (wants && !artIn) {
      const p = actArtProgress(S.actIndex);
      if (!S.card.waiting) announce('Setting the stage.');
      S.card.waiting = true; S.card.loadingText = 'SETTING THE STAGE';
      S.card.loading = p.total ? Math.min(0.99, p.done / p.total) : 0;
      if (i.pause) pause();
      return;
    }
    if (wants) {
      // Some acts follow their card with a silent-film intertitle that
      // introduces how they play (not on a retry).
      if (S.act.intertitle && !S.card.body && !S.skipIntertitle) {
        S.card = { body: S.act.intertitle, size: 56, alpha: 0,
          prompts: { touch: 'Tap to begin', other: 'Press [A] to begin' } };
        S.modeT = 0; S.readyT = 0;
        announce(S.act.intertitle.replace(/\[A\]/g, 'A').replace(/\n+/g, ' '));
        return;
      }
      S.mode = 'play'; S.modeT = 0; S.card = null; S.curtainTarget = 1;
      audio.play('curtain');
    }
    if (i.pause) pause();
    return;
  }

  if (S.mode === 'play') {
    if (i.pause && !S.paused) { pause(); return; }
    if (S.paused) return;
    // Hold the player still until the curtains are mostly open.
    const ready = S.curtain > 0.9;
    const actInput = ready
      ? { moveX: i.moveX, moveY: i.moveY, up: i.up, down: i.down, left: i.left, right: i.right, a: i.leap, aHeld: i.aHeld, b: i.padB || i.bPress || i.touchB, x: i.padX || i.bPress || i.touchB || i.touchX, xHeld: i.xHeld, xKey: !!i.keyX, tapAt: i.playTap, beat: audio.beat(),
        songLeft: audio.nowPlaying()?.id === 'period-wedding' ? audio.pieceLeft() : null }
      : { moveX: 0, moveY: 0, beat: audio.beat() };
    S.act.step(S.state, dt, actInput);
    trackCheckpoint();
    for (const e of S.state.events) handleEvent(e);
    S.state.events.length = 0;
    if (S.state.status === 'lost' && S.state.statusT > 0.2) {
      S.mode = 'over'; S.modeT = 0;
      S.card = { bg: 'magenta', kicker: S.act.kicker, title: S.state.lostTitle || 'The Sea Keeps\nHer Own', size: 110,
        sub: S.state.lostSub || '', alpha: 0 };
      const at = S.checkpoint && (S.checkpoint.scene | 0) > 0 ? S.act.scenes?.[S.checkpoint.scene | 0]?.name : null;
      const again = at ? `try again from ${at}` : 'try again';
      S.card.prompts = { touch: `Tap right to ${again} · tap left for the playbill`, other: `[A] ${again[0].toUpperCase() + again.slice(1)} · [B] The playbill` };
      announce(`The act is lost. Press A to ${again}.`);
    }
    if (S.state.status === 'won' && S.state.statusT > 0.15) actWon();
    // the act asked to leave for the title screen (after the film's credits)
    else if (S.state.toTitle) toTitle();
    return;
  }

  if (S.mode === 'over') {
    S.card.alpha = Math.min(1, S.card.alpha + dt * 2);
    if (S.card.alpha > 0.6) {
      if (i.tap) { if (i.tap.x < 640) showPlaybill(); else retry(); }
      else if (go) retry();
      else if (i.padB || i.back) showPlaybill();
    }
    return;
  }

  if (S.mode === 'curtaincall') {
    if (S.modeT > 6 || (go && S.modeT > 2)) showPlaybill();
  }
}

// After a loss: back to the latest checkpoint, or the top of the act.
function retry() {
  beginAct(S.actIndex, S.checkpoint ? { ...S.checkpoint, retry: true } : null);
}

function actWon() {
  const slot = S.actIndex + 1;  // place in the list (the act id in the query edition)
  save.scenes = { ...(save.scenes || {}), [slot]: (S.act.scenes?.length || 1) - 1 };
  recordResult(save, slot, S.state.result || {}, ACTS.length);
  if (S.actIndex + 1 < ACTS.length) return beginAct(S.actIndex + 1);
  // A film ending explicitly completed by another path returns to the playbill.
  // The wedding normally stays playable after its credits.
  if (FILM_ED) {
    // Stop the wedding source before restoring the menu mix.
    audio.stopMusic(); showPlaybill(); audio.setMood('tender'); audio.startMusic();
    return;
  }
  // The whole play is done: curtain call, then the playbill.
  S.mode = 'curtaincall'; S.modeT = 0; S.act = null; S.state = null; S.curtainTarget = 1;
  audio.play('done');
  announce('Curtain call.');
}

function handleEvent(e) {
  // Reaching the light completes the game even if the player closes the
  // page during the credits. The later actWon call is idempotent.
  if (FILM_ED && e.type === 'finale') {
    const slot = S.actIndex + 1;
    save.scenes = { ...(save.scenes || {}), [slot]: S.act.scenes.length - 1 };
    recordResult(save, slot, { keepsakes: {}, score: S.state.score, pearls: S.state.pearls, ending: 'wedding' }, ACTS.length);
  }
  // an event may name its own sound and loudness (e.sound, e.gain)
  audio.play(e.sound || e.type, e.gain ?? 1);
  renderer.onEvent(e, currentView());
  const rumble = settings.vibration && input.owner() !== null;
  if (e.type === 'hit') { if (rumble) input.rumble(0.8, 0.5, 220); if (TOUCH && settings.vibration) navigator.vibrate?.(70); }
  if (e.type === 'wreck' && rumble) input.rumble(1, 1, 600);
  if ((e.type === 'strike' || e.type === 'shipBreak') && rumble) input.rumble(0.4, 0.7, 160);
  const msg = S.act?.announce?.(e);
  if (msg) announce(msg);
}

// ---------------------------------------------------------------- touch
// What the A button says, scene by scene, and when B is needed.
// Whether the player has the scene in hand: not a cutscene, an outro or an
// ending. Outside these the action buttons and the drag hint stay away.
function touchLive() {
  const st = S.state, id = S.act?.id, ph = st?.phase;
  if (!st || st.status !== 'play') return false;
  if (S.act.touchLive) return S.act.touchLive(st);
  if (id === 1) return ph === 'voyage' || (!FILM_ED && ph === 'party');
  if (id === 2) return ph === 'swim' || ph === 'ride' || ph === 'offer';
  if (id === 3) return ph === 'play';
  if (id === 4) return ph === 'climb' || (ph === 'cavern' && !st.cv?.done);
  if (id === 5) return ph === 'cliff' || ph === 'house' || ph === 'quay';
  return true;
}
function touchVerb() {
  const st = S.state, id = S.act?.id;
  if (!st) return '';
  if (S.act.touchVerb) return S.act.touchVerb(st);
  if (id === 1) return st.phase === 'voyage' && !FILM_ED ? 'Leap' : st.phase === 'party' && !FILM_ED ? 'Light' : '';
  if (id === 2) return st.phase === 'offer' ? (FILM_ED ? '' : 'Take') : st.phase === 'ride' ? 'Leap' : 'Swim';
  if (id === 3) return st.tf ? 'Leap' : S.state?.canTake ? 'Take' : 'Hide';
  if (id === 4) return 'Leap';
  if (id === 5) return st.phase === 'house' && st.carry?.stone && !st.stoneThrown ? 'Action' : 'Leap';
  return '';
}
// The second button (pad X, the X key), where a scene uses it.
function touchVerbB() {
  const st = S.state;
  if (!st) return '';
  if (S.act.touchVerbB) return S.act.touchVerbB(st);
  const needB = S.act?.needB ? S.act.needB(st) : S.act?.id === 2 && st.phase === 'offer';
  if (!needB) return '';
  if (S.act.id === 2 && st.phase === 'offer') return 'Refuse';
  if (S.act.id === 2) return st.reach?.kind === 'pearl' ? 'Take' : st.reach?.kind === 'sleeper' ? 'Wake' : 'Action';
  if (S.act.id === 3) return 'Bow';
  return 'Action';
}
function touchVerbHint(act) {
  if (act.touchHint) return act.touchHint;
  return { 1: 'drag to sail, swipe to change row, tap to leap', 2: 'drag to swim, A to kick; on the moon boat, drag to sail, swipe to change row, tap to leap', 3: 'drag to walk, swipe to change groove, tap to hide',
    4: 'drag to walk, swipe up or tap to leap', 5: 'drag to climb, A to leap' }[act.id] || 'drag to move';
}
// Which touch scheme a scene uses: swipes for rows and floors, the stick for
// free movement (swimming, climbing).
function touchScheme() {
  const id = S.act?.id, ph = S.state?.phase;
  if (S.act?.touchScheme) return S.act.touchScheme(S.state || {});
  if (id === 1) return { mode: 'swipe', hint: ph === 'party' ? 'Tap on the beat' : FILM_ED ? 'Drag ↔ to sail · swipe ↕ to change row' : 'Drag ↔ to sail · swipe ↕ to change row · tap to leap' };
  if (id === 2) return ph === 'ride' ? { mode: 'swipe', hint: 'Drag ↔ to sail · swipe ↕ to change row · tap to leap' } : { mode: 'stick', hint: 'Drag to swim' };
  if (id === 3) return { mode: 'swipe', hint: S.state?.tf ? 'Drag ↔ to walk · tap to leap' : 'Drag ↔ to walk · swipe ↕ to change groove · tap to hide' };
  if (id === 4) return { mode: 'swipe', hint: 'Drag ↔ to walk · swipe up or tap to leap', flickUpIsA: true };
  return { mode: 'stick', hint: 'Drag to climb' };
}
// The option buttons (#icons): the guide buttons at the left on the title and
// playbill; settings, sound and fullscreen at the right throughout. In play on
// a phone those hide, and a tap at the bottom right shows them for 7 s.
const ICONS_SHOW = 7;
const MIN_TEXT = 13;   // css px: the smallest canvas text on a touch screen
let iconsT = 0;
const iconsEl = $('#icons');
iconsEl.classList.toggle('autohide', TOUCH);
const revealIcons = () => { iconsT = ICONS_SHOW; iconsEl.classList.add('revealed'); };
iconsEl.querySelector('.corner-reveal').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); revealIcons(); });
iconsEl.querySelector('.corner-right').addEventListener('pointerdown', () => { if (iconsT > 0) iconsT = ICONS_SHOW; });
function updateIcons(dt) {
  const menu = S.mode === 'title' || S.mode === 'playbill';
  const show = menu ? 'menu' : S.mode === 'curtaincall' ? 'none' : 'play';
  if (iconsEl.dataset.show !== show) iconsEl.dataset.show = show;
  // paused or in a dialog, the options stay out (a menu is up)
  const inPlay = S.mode === 'play' && !S.paused && !dialogs.length;
  if (iconsT > 0 && inPlay) { iconsT -= dt; if (iconsT <= 0) iconsEl.classList.remove('revealed'); }
  iconsEl.classList.toggle('menu-up', !inPlay);
  // on a touch screen the option buttons stay shown, in play too
  if (TOUCH) iconsEl.classList.add('revealed'); else if (inPlay && iconsT <= 0) iconsEl.classList.remove('revealed');
}
let lastPortrait = null, lastTouchScene = '', liveT = 0, lastFrameAt = 0;
function updateTouch() {
  const portrait = innerHeight > innerWidth;
  if (portrait !== lastPortrait) {
    lastPortrait = portrait;
    $('#rotate').hidden = !portrait;
    if (portrait && S.mode === 'play') pause('Turn the device sideways to carry on.');
  }
  const playing = S.mode === 'play' && !S.paused && !portrait;
  // on the playbill only the pause button shows
  $('#touch').classList.toggle('menu-pause', S.mode === 'playbill' && !S.paused);
  // A new scene (or act) doesn't inherit a drag held over from the last one.
  const sceneKey = `${S.actIndex}:${S.state?.phase}:${S.state?.tf ? 'tf' : ''}`;
  if (sceneKey !== lastTouchScene) { lastTouchScene = sceneKey; touch.settle?.(); }
  const live = playing && touchLive();
  const now = performance.now(), dt = Math.min(0.1, (now - (lastFrameAt || now)) / 1000); lastFrameAt = now;
  liveT = S.mode !== 'play' ? 0 : live ? liveT + dt : liveT;
  const sch = playing ? touchScheme() : { mode: 'stick', hint: '' };
  // where a tap anywhere does the scene's action, its button is not shown
  const tapAs = live && S.act?.touchTap ? S.act.touchTap(S.state) : null;
  const verb = live && tapAs !== 'a' ? touchVerb() : '';
  // an act may keep its second button through a cutscene (the prologue's Skip)
  let verbB = playing && S.act?.touchVerbB ? S.act.touchVerbB(S.state) : live ? touchVerbB() : '';
  if (tapAs === 'x') verbB = '';
  // a button named Leap needs no "tap to leap" in the hint
  const hint = live ? (/^(Leap|Jump)$/.test(verb) ? sch.hint.split(' · ').filter((h) => !/leap|jump/i.test(h)).join(' · ') : sch.hint) : '';
  touch.show({ playing, mode: sch.mode, hintText: hint, flickUpIsA: !!sch.flickUpIsA, verb, verbB, tapAs });
  setTouchNames({ A: verb, X: verbB });
  // The hint shows for the first few seconds of play in each act (not counting
  // its opening cutscene), and in the classic party.
  if (playing) $('#touch').classList.toggle('stick-used', liveT > 7 && !(!FILM_ED && S.act?.id === 1 && S.state?.phase === 'party' && S.state.phaseT < 4));
}

// ---------------------------------------------------------------- shell scenes
// The delivered playbill (700x1000 art, drawn at 404x578 about the middle of
// the stage). Its title banner and five act panels were measured in the art:
// panels at art y 236-338, 363-470, 497-607, 634-756 and 783-876, x 128-571.
// The film edition's bill (playbill-film, same proportions) has a prologue and
// six panels, at art y 232-298, 325-398, 420-496, 518-594, 615-692, 718-794 and
// 815-886, x 135-565, under a blank title banner at 108-200; its rows use
// smaller type to fit.
const PB = !FILM_ED
  ? { w: 404, h: 578, cx: 640, cy: 360, panels: [287, 416.5, 552, 695, 829.5], panelH: 100, panelX: [128, 571],
      titleY: 163, subY: 192, titlePx: 38, kick: [11, -10], name: [27, 17] }
  : { w: 404, h: 578, cx: 640, cy: 360, panels: [265, 361.5, 458, 556, 653.5, 756, 850.5], panelH: 70, panelX: [135, 565],
      titleY: 150, subY: 184, titlePx: 24, kick: [9, -8], name: [20, 12] };
// Where each act's row sits, for drawing and for taps (stage px).
// A small turning ring, drawn on the stage while art it needs is still coming.
function spinner(k, t) {
  const c = k.c;
  c.save(); c.translate(640, 380); c.rotate(t * 6);
  c.lineWidth = 3; c.strokeStyle = 'rgba(243,198,220,0.2)'; c.beginPath(); c.arc(0, 0, 22, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#f3c6dc'; c.beginPath(); c.arc(0, 0, 22, 0, Math.PI / 2); c.stroke();
  c.restore();
}

function playbillRows() {
  // Each edition's painted bill has one panel per act; without it, a card.
  if (assets.images[FILM_ED ? 'playbill-film' : 'playbill'] && ACTS.length === PB.panels.length) {
    const s = PB.w / 700, x0 = PB.cx - PB.w / 2, y0 = PB.cy - PB.h / 2;
    return { art: true, s, x0: x0 + PB.panelX[0] * s, x1: x0 + PB.panelX[1] * s, half: PB.panelH * s / 2 + 6,
      ys: PB.panels.map((p) => y0 + p * s), left: x0, top: y0 };
  }
  const gap = ACTS.length > 5 ? 62 : 72, y0 = ACTS.length > 5 ? 226 : 244;
  return { art: false, x0: 360, x1: 920, half: gap / 2, ys: ACTS.map((a, n) => y0 + n * gap) };
}
function drawPlaybill(k, t) {
  const c = k.c;
  k.sky(null);
  for (let r = 0; r < 3; r++) k.waves(r, t * 40);
  const rows = playbillRows();
  c.textAlign = 'center';
  const mode = S.inputMode;
  const hint = mode === 'touch' ? 'Tap an act to begin · tap outside for the title'
    : mode === 'pad' ? '[LS] Choose · [A] Begin · [B] The title' : '↑ ↓ to choose · [A] to begin · [B] for the title';
  // The bill waits for its art (the title holds behind the spinner until it
  // is in): never the drawn stand-in, which is wider, then swapped.
  if (!rows.art && !assets?.settled?.(FILM_ED ? 'playbill-film' : 'playbill')) { spinner(k, t); return; }
  if (rows.art && k.asset('playbill', PB.cx, PB.cy + PB.h / 2, PB.w, PB.h)) {
    const s = rows.s, ink = k.col('#2a1424');
    c.fillStyle = ink; c.textAlign = 'center';
    c.font = `${PB.titlePx}px Yesteryear, cursive`; c.fillText(TITLE, 640, rows.top + PB.titleY * s + 8);
    c.font = '700 9px "Josefin Sans", sans-serif'; c.fillText((FILM_ED ? 'A TOY THEATRE IN A PROLOGUE AND SIX ACTS' : 'A TOY THEATRE IN FIVE ACTS'), 640, rows.top + PB.subY * s);
    const pw = (rows.x1 - rows.x0) - 28;
    ACTS.forEach((a, n) => {
      const y = rows.ys[n], open = n < save.unlocked, sel = n === S.pb;
      if (sel) { c.fillStyle = k.col('#e0127a'); c.globalAlpha = 0.2; c.fillRect(rows.x0 + 4, y - PB.panelH * s / 2 + 3, rows.x1 - rows.x0 - 8, PB.panelH * s - 6); c.globalAlpha = 1; }
      c.fillStyle = k.col(open ? '#2a1424' : '#a99a86');
      c.textAlign = 'left'; c.font = `700 ${PB.kick[0]}px "Josefin Sans", sans-serif`; c.fillText(a.kicker.toUpperCase(), rows.x0 + 14, y + PB.kick[1]);
      const best = save.best[n + 1];
      if (open && best != null) { c.textAlign = 'right'; c.font = `${PB.kick[0]}px "Josefin Sans", sans-serif`; c.fillText('best ' + best, rows.x1 - 14, y + PB.kick[1]); }
      let px = PB.name[0]; c.font = `${px}px Yesteryear, cursive`;
      const label = open ? a.title : '· · ·';
      const w = c.measureText(label).width;
      if (w > pw) { px = Math.floor(px * pw / w); c.font = `${px}px Yesteryear, cursive`; }
      c.textAlign = 'center'; c.fillText(label, (rows.x0 + rows.x1) / 2, y + PB.name[1]);
    });
    // The prompt rides on a small plum label over the foot of the bill.
    c.font = '700 12px "Josefin Sans", sans-serif';
    const tw = Math.min(380, c.measureText(hint.replace(/\[(\w+)\]/g, 'XX')).width + 56);
    c.fillStyle = k.col('#2a1424'); c.globalAlpha = 0.85; c.beginPath(); c.roundRect(640 - tw / 2, 624, tw, 22, 11); c.fill(); c.globalAlpha = 1;
    c.fillStyle = k.col('#f1e3c8'); c.textAlign = 'center';
    richText(c, hint, 640, 639, { px: 12, mode, col: k.col });
    return;
  }
  c.fillStyle = k.col('#f1e3c8'); c.fillRect(330, 70, 620, 580);
  c.strokeStyle = k.col('#2a1424'); c.lineWidth = 3; c.strokeRect(344, 84, 592, 552); c.lineWidth = 1; c.strokeRect(352, 92, 576, 536);
  c.textAlign = 'center'; c.fillStyle = k.col('#2a1424');
  c.font = '54px Yesteryear, cursive'; c.fillText(TITLE, 640, 160);
  c.font = '700 15px "Josefin Sans", sans-serif'; c.fillText((FILM_ED ? 'A TOY THEATRE IN A PROLOGUE AND SIX ACTS' : 'A TOY THEATRE IN FIVE ACTS'), 640, 188);
  ACTS.forEach((a, n) => {
    const y = rows.ys[n] + 6, open = n < save.unlocked, sel = n === S.pb, tight = ACTS.length > 5;
    if (sel) { c.fillStyle = k.col('#e0127a'); c.globalAlpha = 0.18; c.fillRect(372, y - (tight ? 30 : 34), 536, tight ? 52 : 60); c.globalAlpha = 1; }
    c.fillStyle = k.col(open ? '#2a1424' : '#a99a86');
    c.font = '700 16px "Josefin Sans", sans-serif'; c.textAlign = 'left'; c.fillText(a.kicker.toUpperCase(), 392, y - 6);
    c.font = `${tight ? 30 : 34}px Yesteryear, cursive`; c.fillText(open ? a.title : '· · ·', tight ? 500 : 470, y + 2);
    c.textAlign = 'right'; c.font = '15px "Josefin Sans", sans-serif';
    const best = save.best[n + 1];
    if (open && best != null) c.fillText('best ' + best, 888, y - 6);
  });
  c.textAlign = 'center'; c.font = '18px "Josefin Sans", sans-serif'; c.fillStyle = k.col('#2a1424');
  richText(c, hint, 640, 612, { px: 18, mode, col: k.col });
}

function drawCurtainCall(k, t) {
  k.sky(null);
  for (let r = 0; r < 3; r++) k.waves(r, t * 40);
}

// The title's hint, in the buttons of the input in use (Xbox glyphs on a pad).
const glyph = (b) => `<span class="xb xb-${b.toLowerCase()}" aria-label="${b === 'LS' ? 'left stick' : b}">${b === 'MENU' ? '<i></i><i></i><i></i>' : b}</span>`;
function syncTitleHint() {
  const h = $('#title-hint');
  if (S.inputMode === 'touch' || (TOUCH && S.inputMode !== 'pad')) { h.textContent = chrome.scrollTrick ? '' : 'Tip: Add to Home Screen to play full screen'; return; }
  if (S.inputMode === 'pad') h.innerHTML = S.titleNav ? `${glyph('A')} Select · ${glyph('MENU')} Start` : `Move ${glyph('LS')} for options · ${glyph('A')} Start`;
  else h.textContent = 'Press Enter to start · Tab for options';
}
S.inputMode = TOUCH ? 'touch' : 'key';
syncTitleHint();
// Start focused on Press Start so keyboard users can begin immediately.
$('#start').focus({ preventScroll: true });
requestAnimationFrame(frame);

// QA hook: ?qa exposes the shell state to browser smoke tests.
if (new URLSearchParams(location.search).has('qa')) window.__widowsBay = window.__kingdomOfTheFairies = { S, settings, audio, camera, get assets() { return assets; },
  // the dialogs the pause menu opens, for the browser checks
  open: { instructions: () => openInstructions(), scenes: () => openScenes(), credits: () => openDialog($('#credits'), $('#credits .card-x')) } };
