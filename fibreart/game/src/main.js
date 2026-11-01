// Fibre Art: the shell around the collage. Loading, the title screen (with
// the first picture turning slowly behind it), menus by controller, keyboard
// or pointer, players joining and leaving, the pointer as a hand, sound, the
// card of controls found, settings and pause. See design/design.md.

import { createGame, step, addPlayer, removePlayer, shift, describe, setupPower, AWAKE, INPUTS, W, H, radius, pieceName, inputKind } from './collage.js';
import { createRenderer } from './render.js';
import { createOverlay } from './overlay.js';
import { createInput, BTN, KEYMAP } from './input.js';
import { createAudio } from './audio.js';
import { updateLife } from './life.js';
import { createChrome, requestFullscreen, exitFullscreen, fullscreenElement } from './chrome.js';

const $ = (s) => document.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const SETTINGS_KEY = 'fibreart.settings';
const DEFAULTS = {
  volume: 80, music: 60, sfx: 80, muted: false, playHints: false, vibration: true,
  reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
};
function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* storage unavailable: settings last for this visit */ }
}

const settings = loadSettings();
// Motion follows the system's reduced-motion setting (there is no switch in the game).
settings.reduceMotion = DEFAULTS.reduceMotion;
const input = createInput();
const audio = createAudio();
let renderer;
let overlay;
let data;
let game;
let chrome = null;

const ui = {
  screen: 'loading', // 'loading' | 'title' | 'play'
  modals: [], // open dialogs, top last
  titleNav: false,
  focus: 0,
  stick: null, // the stick's menu direction and when it next repeats
  returnFocus: {}, // where the focus was in each panel (or the title) beneath an open one
  menuAt: 0,
  paused: false,
  missingPads: [],
  drag: null,
  lastPower: new Map(),
  captionTimer: 0,
};

const KEY_NAMES = { LS: 'W A S D', RS: 'Arrows', LT: 'Q', RT: 'E', A: 'K', B: 'L', X: 'J', Y: 'I', LB: 'Z', RB: 'C' };

// ---- Screens, dialogs and focus ----------------------------------------

function show(screen) {
  ui.screen = screen;
  $('#loading').hidden = screen !== 'loading';
  $('#title').hidden = screen !== 'title';
  $('#hud').hidden = screen !== 'play';
  ui.focus = 0;
  refreshFocus();
  updatePadNote();
  chrome?.update();
}

// The "Xbox controller highly recommended" note: on the title only, with
// nothing open over it, and only while no controller is connected.
function updatePadNote() {
  const note = document.getElementById('pad-note');
  if (!note) return;
  const pads = [...(navigator.getGamepads?.() || [])].some(Boolean);
  note.hidden = pads || ui.screen !== 'title' || ui.modals.length > 0;
}
addEventListener('gamepadconnected', updatePadNote);
addEventListener('gamepaddisconnected', () => setTimeout(updatePadNote, 0));

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (id === 'card') fillCard();
  if (id === 'hint') fillHint();
  if (id === 'settings') fillSettings();
  if (id === 'pause') $('#pause-reason').textContent = ui.pauseReason || '';
  // Remember the choice beneath, to come back to it when this panel closes.
  if (ui.modals.at(-1) !== id) ui.returnFocus[ui.modals.at(-1) || ui.screen] = ui.focus;
  el.hidden = false;
  ui.modals = ui.modals.filter((m) => m !== id);
  ui.modals.push(id);
  // Each panel opened sits over the ones beneath it.
  el.style.zIndex = String(20 + ui.modals.length);
  ui.focus = 0;
  input.lockHeld();
  // A stick already held (moving a piece) waits to be let go before it moves the focus.
  const [hx, hy] = input.leftStick();
  ui.stick = Math.hypot(hx, hy) > 0.35 ? { dir: stickDirection(hx, hy), next: Infinity } : null;
  refreshFocus(true);
  updatePadNote();
  chrome?.update();
}

function closeModal() {
  const id = ui.modals.pop();
  if (id) document.getElementById(id).hidden = true;
  // Back on the choice that opened it.
  const below = ui.modals.at(-1) || ui.screen;
  ui.focus = ui.returnFocus[below] ?? 0;
  delete ui.returnFocus[below];
  input.lockHeld();
  if (!ui.modals.length && ui.screen === 'play') resume();
  refreshFocus(true);
  updatePadNote();
  chrome?.update();
}

function container() {
  if (ui.modals.length) return document.getElementById(ui.modals.at(-1));
  if (ui.screen === 'title') return $('#title');
  return null;
}

function navItems() {
  const c = container();
  return c ? $$('[data-nav]', c).filter((el) => el.offsetParent !== null) : [];
}

function refreshFocus(moveDom = false) {
  const items = navItems();
  for (const el of $$('.focused')) el.classList.remove('focused');
  const usingPad = input.kind === 'controller';
  if (!items.length) return;
  ui.focus = Math.max(0, Math.min(ui.focus, items.length - 1));
  const el = items[ui.focus];
  const titleIdle = ui.screen === 'title' && !ui.modals.length && !ui.titleNav;
  if (usingPad && !titleIdle) el.classList.add('focused');
  if (moveDom || usingPad) {
    if (!titleIdle || ui.modals.length) el.focus({ preventScroll: false });
  }
}

function activate(el) {
  if (!el) return;
  if (el.matches('input[type="checkbox"]')) {
    el.checked = !el.checked;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  el.click();
}

// ---- Actions -------------------------------------------------------------

function toggleFullscreen() {
  if (fullscreenElement()) exitFullscreen();
  else requestFullscreen();
}

function start() {
  if (ui.screen !== 'title') return;
  audio.unlock();
  applySettings();
  requestFullscreen();
  show('play');
  input.lockHeld();
  syncPlayers(true);
  if (!game.players.length) addPlayer(game, 'kb');
  audio.scene(game.index);
  caption();
  hint();
}

function pause(reason = '') {
  if (ui.screen !== 'play' || ui.paused) return;
  ui.paused = true;
  ui.pauseReason = reason;
  openModal('pause');
}

function resume() {
  ui.paused = false;
  ui.pauseReason = '';
  for (const id of ui.missingPads) removePlayer(game, `pad${id}`);
  ui.missingPads = [];
  if (!game.players.length && !input.pads().length) addPlayer(game, 'kb');
  input.lockHeld();
  for (const id of [...ui.modals]) document.getElementById(id).hidden = true;
  ui.modals = [];
  chips();
  chrome?.update();
}

function quitToTitle() {
  for (const id of ui.modals) document.getElementById(id).hidden = true;
  ui.modals = [];
  ui.paused = false;
  for (const p of [...game.players]) removePlayer(game, p.id);
  show('title');
  input.lockHeld();
}

// Messages during play are hints too: shown only with hints on.
function playToast(text, ms) {
  if (settings.playHints) toast(text, ms);
}

function toast(text, ms = 2600) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), ms);
}

function caption() {
  const c = $('#caption');
  c.innerHTML = `${game.scene.name}<small>after Hanneke de Neve</small>`;
  c.classList.add('show');
  clearTimeout(ui.captionTimer);
  ui.captionTimer = setTimeout(() => c.classList.remove('show'), 6000);
}

function hint() {
  const k = input.kind;
  $('#play-hint').textContent = k === 'controller'
    ? 'Try every stick, trigger and button · View: controls found · Menu: pause'
    : k === 'keyboard'
      ? 'W A S D, arrows, Q E, I J K L, Z C · Tab: controls found · Esc: pause'
      : k === 'touch'
        ? 'Drag, hold, tap and fling the pieces and the cloth · pinch one to stretch it'
        : 'Drag, hold, click and fling the pieces and the cloth · wheel to stretch one';
}

// The pause button stays out of sight while playing and comes up for a
// moment when the mouse moves or the screen is touched.
function revealHud() {
  if (ui.screen !== 'play' || ui.modals.length) return;
  const hud = $('#hud');
  hud.classList.add('reveal');
  clearTimeout(ui.revealTimer);
  const hide = () => {
    if (hud.querySelector('.icon-btn:hover, .icon-btn:focus-visible')) ui.revealTimer = setTimeout(hide, 1000);
    else hud.classList.remove('reveal');
  };
  ui.revealTimer = setTimeout(hide, 2500);
}

function playerLabel(pl) {
  if (pl.id === 'kb') return input.kind === 'keyboard' ? 'Keyboard' : 'You';
  return `Player ${Number(pl.id.slice(3)) + 1}`;
}

function chips() {
  const box = $('#players');
  box.innerHTML = '';
  for (const pl of game.players) {
    const found = Object.values(pl.bindings).filter((b) => b.found).length;
    const ready = Object.values(pl.bindings).some((b) => b.scale === 'large' && setupPower(game, b) >= AWAKE);
    const el = document.createElement('div');
    el.className = 'chip';
    el.style.setProperty('--c', pl.colour);
    el.innerHTML = `<i></i><span>${playerLabel(pl)} · <b>${found}</b> of ${INPUTS.length} found${ready ? ' · something big is ready' : ''}</span>`;
    box.append(el);
  }
}

// The hint: for each player, the big control that carries the picture on,
// the piece it is centred on, and what wakes it, mostly as pictures.
const CONTROL_DRAWING = { stick: 'stick', trigger: 'trigger', button: 'button' };
const SETUP_PICTURE = {
  centre: '<svg viewBox="0 0 64 40" aria-hidden="true"><rect x="2" y="2" width="60" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="20" r="7" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/><path d="M9 33 L24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M20 23h5v5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 64 40" aria-hidden="true"><circle cx="12" cy="22" r="7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="14" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="52" cy="24" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 20 Q22 12 26 14 M38 15 Q44 14 46 22" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2.5"/></svg>',
  meet: '<svg viewBox="0 0 64 40" aria-hidden="true"><circle cx="16" cy="20" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="48" cy="20" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M27 20h10M33 16l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// A player using the hand (touch or the mouse) is told the gesture, not the input.
const byHand = (pl) => pl.id === 'kb' && input.hand.active && input.kind !== 'keyboard';
const gesture = (inp) => ({ stick: 'drag', trigger: 'hold', button: input.kind === 'touch' ? 'tap' : 'click' })[inputKind(inp)];

function fillHint() {
  const body = $('#hint-body');
  body.innerHTML = '';
  const lines = data.ui.lines || [];
  const drawing = (name) => lines.find((l) => l.name === name)?.file;
  const pieceFile = (p) => (p.stage >= 0 ? game.chains[p.chain]?.[p.stage]?.file : null) || p.file;
  for (const pl of game.players) {
    const hand = byHand(pl);
    const key = (inp) => (hand ? gesture(inp) : pl.id === 'kb' ? KEY_NAMES[inp] : inp);
    for (const b of Object.values(pl.bindings)) {
      if (b.scale !== 'large' || !b.setup) continue;
      const anchor = game.pieces[b.setup.anchor];
      if (!anchor) continue;
      const kind = inputKind(b.input);
      const lean = kind === 'stick' ? 'push' : kind === 'trigger' ? 'hold' : 'press';
      const helper = Object.values(pl.bindings).find((h) => h.setsUp === b.input);
      const awake = setupPower(game, b) >= AWAKE;
      const what = pieceName(anchor);
      const goal = b.setup.type === 'centre' ? `Bring ${what} to the middle`
        : b.setup.type === 'link' ? `Sew ${b.setup.need} pieces to ${what}`
          : `Bring ${what} to ${pieceName(game.pieces[b.setup.other])}`;
      const text = hand
        ? (awake ? `Ready: ${key(b.input)} ${what}.` : `${goal}${helper ? ` (${key(helper.input)} it)` : ''}, then ${key(b.input)} it.`)
        : awake ? `Ready: ${lean} ${key(b.input)}.`
          : `${goal}${helper ? ` (${key(helper.input)})` : ''}, then ${lean} ${key(b.input)}.`;
      const other = b.setup.type === 'meet' ? game.pieces[b.setup.other] : null;
      const row = document.createElement('div');
      row.className = 'hint-row';
      row.style.setProperty('--c', pl.colour);
      row.innerHTML = `
        <span class="hint-dot" aria-hidden="true"></span>
        <figure class="hint-pic">${hand ? '' : `<img src="web/${drawing(CONTROL_DRAWING[kind]) || ''}" alt="">`}<figcaption>${key(b.input)}</figcaption></figure>
        <img class="hint-piece" src="web/${pieceFile(anchor)}" alt="">
        <span class="hint-setup">${awake ? '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 21l8 8 16-18" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : SETUP_PICTURE[b.setup.type]}</span>
        ${other ? `<img class="hint-piece" src="web/${pieceFile(other)}" alt="">` : ''}
        <p class="hint-text">${text}</p>`;
      body.append(row);
    }
  }
  if (!body.children.length) body.innerHTML = `<p class="hint-text">${input.hand.active && input.kind !== 'keyboard' ? 'Drag, hold and tap every piece.' : 'Try every stick, trigger and button.'}</p>`;
}

function fillCard() {
  const body = $('#card-body');
  body.innerHTML = '';
  for (const pl of game.players) {
    const sec = document.createElement('section');
    sec.className = 'card-player';
    sec.style.setProperty('--c', pl.colour);
    const hand = byHand(pl);
    const items = [];
    for (const inp of INPUTS) {
      const b = pl.bindings[inp];
      const key = hand ? gesture(inp) : pl.id === 'kb' ? KEY_NAMES[inp] : inp;
      if (!b?.found) {
        if (!hand) items.push(`<li class="unfound"><kbd>${key}</kbd> not found yet</li>`);
        continue;
      }
      const big = b.scale === 'large';
      let text = describe(game, b);
      if (big && b.setup) {
        const pw = setupPower(game, b);
        const how = b.setup.type === 'centre' ? 'bring it to the middle' : b.setup.type === 'link' ? `sew ${b.setup.need} pieces to it` : 'bring it to its partner';
        text += pw >= AWAKE ? ' — awake' : ` — to wake it, ${how}`;
      }
      items.push(`<li class="${big ? 'large' : ''}"><kbd>${key}</kbd> ${text}</li>`);
    }
    // By hand the controls are found on the pieces, so only the count is left.
    const left = INPUTS.filter((inp) => !pl.bindings[inp]?.found).length;
    if (hand && left) items.push(`<li class="unfound">${left} more to find</li>`);
    sec.innerHTML = `<h3><span class="chip" style="--c:${pl.colour}"><i></i>${playerLabel(pl)}</span></h3><ul>${items.join('')}</ul>`;
    body.append(sec);
  }
}

function fillSettings() {
  for (const el of $$('[data-setting]')) {
    const k = el.dataset.setting;
    if (el.type === 'checkbox') el.checked = !!settings[k];
    else {
      el.value = settings[k];
      el.nextElementSibling.textContent = settings[k];
    }
  }
}

function applySettings() {
  audio.set({ volume: settings.volume / 100, music: settings.music / 100, sfx: settings.sfx / 100, muted: !!settings.muted });
  syncSoundButton();
  // No interface over the picture unless the player asks for hints.
  if (overlay) overlay.hints = settings.playHints;
  $('#hud').classList.toggle('hints', !!settings.playHints);
  if (game) game.reduceMotion = settings.reduceMotion;
}

const SOUND_ICON = {
  on: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></g>',
  off: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></g>',
};
function syncSoundButton() {
  const on = !settings.muted;
  const label = on ? 'Sound on' : 'Sound off';
  for (const b of $$('[data-action="sound"]')) {
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', label);
    b.title = label;
    b.classList.toggle('is-off', !on);
    b.querySelector('svg').innerHTML = on ? SOUND_ICON.on : SOUND_ICON.off;
    b.querySelector('.btn-label').textContent = label;
  }
}
function toggleSound() {
  settings.muted = !settings.muted;
  saveSettings();
  applySettings();
}

function vibrate(id, strength = 0.5, ms = 180) {
  if (!settings.vibration || !id?.startsWith('pad')) return;
  const gp = navigator.getGamepads?.()[Number(id.slice(3))];
  gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }).catch?.(() => {});
}

// ---- Players -------------------------------------------------------------

function syncPlayers(quiet = false) {
  const pads = input.pads();
  for (const i of pads) {
    const id = `pad${i}`;
    if (!game.players.some((p) => p.id === id) && game.players.length < 5) {
      addPlayer(game, id);
      if (!quiet) playToast(`${playerLabel({ id })} joined`);
      chips();
    }
  }
  for (const pl of game.players) {
    if (pl.id.startsWith('pad') && !pads.includes(Number(pl.id.slice(3))) && !ui.missingPads.includes(Number(pl.id.slice(3)))) {
      ui.missingPads.push(Number(pl.id.slice(3)));
      pause(`${playerLabel(pl)}'s controller was disconnected. Reconnect it, or close this to play on without it.`);
    }
  }
  // A reconnected pad is no longer missing.
  ui.missingPads = ui.missingPads.filter((i) => !pads.includes(i));
  if (ui.paused && !ui.missingPads.length && ui.pauseReason.includes('disconnected')) {
    ui.pauseReason = 'The controller is back.';
    $('#pause-reason').textContent = ui.pauseReason;
  }
}

// ---- Pointer as a hand ---------------------------------------------------

function toWorld(e) {
  const f = renderer.frame;
  const r = $('#overlay').getBoundingClientRect();
  return { x: (e.clientX - r.left - f.x) / f.scale, y: (e.clientY - r.top - f.y) / f.scale };
}

function pieceAt(pt) {
  for (let i = game.pieces.length - 1; i >= 0; i--) {
    const p = game.pieces[i];
    if (p.alpha < 0.3) continue;
    const dx = pt.x - p.x;
    const dy = pt.y - p.y;
    const c = Math.cos(-p.rot);
    const s = Math.sin(-p.rot);
    const lx = (c * dx - s * dy) / ((p.w * p.sx) / 2);
    const ly = (s * dx + c * dy) / ((p.h * p.sy) / 2);
    if (lx * lx + ly * ly < 1) return p;
  }
  return null;
}

// The hand: a finger (or the mouse) grabs a piece and drags it, and lets go
// to throw it on. Whatever the touch player's controls are bound to that piece
// answer the hand too, so the hand plays every control without a pad:
//
//   drag a piece          its sticks, in the direction and speed of the drag
//   hold a piece still    its triggers, pressing in the longer it is held
//   tap a piece           its buttons, one after another, a tap each
//
// The same on the bare cloth plays the controls bound to that panel of the
// picture. A second finger pinches a held piece (stretch) and twists it
// (turn). When the picture is larger than the screen, dragging the cloth also
// pans the view.
const HOLD_AFTER = 0.35; // seconds still before a hold presses the triggers
const TAP_TIME = 280; // ms
const DRAG_FULL = 520; // CSS px a second for a stick pushed all the way

function panelAt(pt) {
  if (pt.x < 0 || pt.y < 0 || pt.x > W || pt.y > H) return null;
  return Math.min(2, Math.floor(pt.x / (W / 3))) + 3 * Math.min(1, Math.floor(pt.y / (H / 2)));
}

// The touch player's bindings that a hand on `hand.p` (or its panel) reaches.
function handBindings(hand) {
  const pl = game.players.find((q) => q.id === 'kb');
  if (!pl) return [];
  return Object.values(pl.bindings).filter((b) => (hand.p ? b.target === hand.p.i : b.target === 1000 + hand.panel));
}

function releaseHand() {
  const h = input.hand;
  h.LS = [0, 0];
  h.RS = [0, 0];
  h.LT = 0;
  h.RT = 0;
  ui.hand = null;
  ui.drag = null;
  ui.pan = null;
}

// Each frame: the held hand as stick and trigger values.
function handFrame(now) {
  const h = input.hand;
  h.LS = [0, 0];
  h.RS = [0, 0];
  h.LT = 0;
  h.RT = 0;
  const g = ui.hand;
  if (!g || (g.p === null && g.panel === null)) return;
  // The finger's speed: it fades once the finger stops moving.
  const fresh = now - g.t < 90;
  const vx = fresh ? g.vx : 0;
  const vy = fresh ? g.vy : 0;
  const speed = Math.hypot(vx, vy);
  if (speed > 60) g.stillAt = now;
  const still = (now - g.stillAt) / 1000;
  for (const b of handBindings(g)) {
    const kind = inputKind(b.input);
    if (kind === 'stick' && speed > 60) {
      const m = Math.min(1, speed / DRAG_FULL);
      h[b.input] = [(vx / speed) * m, (vy / speed) * m];
    } else if (kind === 'trigger' && still > HOLD_AFTER) {
      h[b.input] = Math.min(1, (still - HOLD_AFTER) / 0.5);
    }
  }
}

// A tap: the next of the piece's buttons (or the panel's), in turn.
function handTap(g) {
  const buttons = handBindings(g).filter((b) => inputKind(b.input) === 'button');
  if (!buttons.length) {
    if (g.p) g.p.vbloom += 1.2;
    return;
  }
  const key = g.p ? `p${g.p.i}` : `c${g.panel}`;
  ui.taps = ui.taps || new Map();
  const n = ui.taps.get(key) || 0;
  ui.taps.set(key, n + 1);
  input.hand.pressed.add(buttons[n % buttons.length].input);
}

function setupPointer() {
  const cv = $('#overlay');
  const touches = new Map(); // pointerId -> { x, y } in CSS pixels
  const spread = () => {
    const [a, b] = [...touches.values()];
    return { d: Math.hypot(b.x - a.x, b.y - a.y) || 1, a: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  cv.addEventListener('pointerdown', (e) => {
    if (ui.screen !== 'play' || ui.modals.length) return;
    audio.unlock();
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (ui.drag && touches.size === 2) {
      // Second finger: pinch and twist the piece being held.
      const { d, a } = spread();
      const p = ui.drag.p;
      ui.drag.pinch = { d, a, sx: p.sx, sy: p.sy, rot: p.rot, tsx: p.sx, tsy: p.sy, trot: p.rot };
      return;
    }
    if (touches.size > 1) return;
    // The hand plays as the keyboard player: join if not yet in.
    input.hand.active = true;
    if (!game.players.some((q) => q.id === 'kb')) {
      addPlayer(game, 'kb');
      chips();
    }
    const now = performance.now();
    const pt = toWorld(e);
    const p = pieceAt(pt);
    ui.hand = { id: e.pointerId, p, panel: p ? null : panelAt(pt), x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, at: now, t: now, stillAt: now, vx: 0, vy: 0, moved: false };
    if (!p) {
      ui.pan = { id: e.pointerId, x: e.clientX, y: e.clientY };
      return;
    }
    ui.drag = { p, id: e.pointerId, cx: e.clientX, cy: e.clientY, ox: pt.x - p.x, oy: pt.y - p.y };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = ui.hand;
    if (g && g.id === e.pointerId) {
      const now = performance.now();
      const dt = Math.max(8, now - g.t) / 1000;
      const k = 0.45;
      g.vx += ((e.clientX - g.x) / dt - g.vx) * k;
      g.vy += ((e.clientY - g.y) / dt - g.vy) * k;
      g.x = e.clientX;
      g.y = e.clientY;
      g.t = now;
      if (Math.hypot(g.x - g.x0, g.y - g.y0) > 12) g.moved = true;
    }
    if (ui.pan && ui.pan.id === e.pointerId) {
      if (!renderer.frame.pans) return;
      const s = renderer.frame.scale;
      renderer.centre.x -= (e.clientX - ui.pan.x) / s;
      renderer.centre.y -= (e.clientY - ui.pan.y) / s;
      ui.pan.x = e.clientX;
      ui.pan.y = e.clientY;
      ui.panAt = performance.now();
      return;
    }
    if (!ui.drag) return;
    const pin = ui.drag.pinch;
    if (pin && touches.size >= 2) {
      const { d, a } = spread();
      pin.tsx = pin.sx * (d / pin.d);
      pin.tsy = pin.sy * (d / pin.d);
      pin.trot = pin.rot + a - pin.a;
    }
    if (ui.drag.id === e.pointerId) {
      ui.drag.cx = e.clientX;
      ui.drag.cy = e.clientY;
    }
  });
  const up = (e) => {
    touches.delete(e.pointerId);
    const g = ui.hand;
    if (g && g.id === e.pointerId) {
      if (e.type === 'pointerup' && !g.moved && performance.now() - g.at < TAP_TIME) handTap(g);
      // Let go: a piece flung keeps the finger's speed and glides on.
      if (g.p && performance.now() - g.t < 90) {
        const s = renderer.frame.scale;
        g.p.vx = (g.vx / s) * 1.15;
        g.p.vy = (g.vy / s) * 1.15;
      }
      ui.hand = null;
    }
    if (ui.pan && ui.pan.id === e.pointerId) ui.pan = null;
    if (!ui.drag) return;
    if (ui.drag.id === e.pointerId) ui.drag = null;
    else ui.drag.pinch = null;
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => {
    if (ui.screen !== 'play' || ui.modals.length) return;
    e.preventDefault();
    const p = pieceAt(toWorld(e));
    if (!p) return;
    const d = Math.max(-1, Math.min(1, -e.deltaY / 120));
    if (e.shiftKey) p.vrot += d * 1.2;
    else { p.vsx += d * 0.9; p.vsy += d * 0.9; }
  }, { passive: false });
}

// When the picture is larger than the screen, the view follows what is being
// moved: a dragged piece near the screen's edge pulls the view along, and
// otherwise the view drifts towards the pieces that are moving fastest.
function followView(dt) {
  const f = renderer.frame;
  if (!f.pans || ui.screen !== 'play') return;
  const c = renderer.centre;
  if (ui.drag) {
    const edge = (v, size) => {
      const m = size * 0.18;
      return v < m ? (v - m) / m : v > size - m ? (v - (size - m)) / m : 0;
    };
    c.x += edge(ui.drag.cx, innerWidth) * 7 * dt;
    c.y += edge(ui.drag.cy, innerHeight) * 5 * dt;
    return;
  }
  if (ui.pan || performance.now() - (ui.panAt || 0) < 2500) return;
  let wx = 0;
  let wy = 0;
  let wsum = 0;
  for (const p of game.pieces) {
    const v = Math.hypot(p.vx, p.vy);
    if (v < 0.6 || p.alpha < 0.3) continue;
    wx += p.x * v;
    wy += p.y * v;
    wsum += v;
  }
  if (wsum < 1) return;
  const k = 1 - Math.exp(-dt * 1.5);
  c.x += (wx / wsum - c.x) * k;
  c.y += (wy / wsum - c.y) * k;
}

// ---- The frame -------------------------------------------------------------

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  input.poll();
  const nav = input.nav();
  handleMenus(nav, now);

  if (ui.screen === 'title' && !ui.modals.length) {
    // The first picture turns slowly behind the title.
    step(game, dt, new Map());
    updateLife(game, dt, settings.reduceMotion ? 0.3 : 1);
    const sun = game.pieces[0];
    game.field.swirls = [{ owner: 'title', x: sun.x, y: sun.y, r: 9, a: 0.22 * Math.sin(game.time * 0.32), va: 0 }];
    game.field.ripple = settings.reduceMotion ? 0 : 0.25;
  } else if (ui.screen === 'play' && !ui.paused && !ui.modals.length) {
    syncPlayers();
    handFrame(now);
    const inputs = input.players();
    if (inputs.has('kb') && !game.players.some((p) => p.id === 'kb')) {
      addPlayer(game, 'kb');
      chips();
    }
    if (ui.drag) {
      // Re-read the finger each frame: the view may have panned under it.
      const pt = toWorld({ clientX: ui.drag.cx, clientY: ui.drag.cy });
      const p = ui.drag.p;
      p.vx = (pt.x - ui.drag.ox - p.x) * 10;
      p.vy = (pt.y - ui.drag.oy - p.y) * 10;
      const pin = ui.drag.pinch;
      if (pin) {
        p.vsx = (pin.tsx - p.sx) * 10;
        p.vsy = (pin.tsy - p.sy) * 10;
        p.vrot = (pin.trot - p.rot) * 10;
      }
    }
    step(game, dt, inputs);
    updateLife(game, dt, settings.reduceMotion ? 0.3 : 1);
    feedback(inputs);
    followView(dt);
  }
  for (const e of game.events) overlay.event(e, game);
  game.events.length = 0;

  renderer.render(game);
  overlay.draw(game, renderer.frame, dt);
  input.endFrame();
  requestAnimationFrame(frame);
}

function feedback(inputs) {
  let chipsDirty = false;
  for (const e of game.events) {
    if (e.type === 'found') {
      audio.found(e.scale);
      chipsDirty = true;
      if (e.scale === 'large') {
        const pl = game.players.find((p) => p.id === e.player);
        playToast(`${playerLabel(pl)} found a big one: ${e.input === 'LS' || e.input === 'RS' ? 'a stick' : e.input === 'LT' || e.input === 'RT' ? 'a trigger' : 'a button'} that ${describe(game, pl.bindings[e.input])}`);
      }
    } else if (e.type === 'link') audio.link();
    else if (e.type === 'morph') audio.pluck(e.stage + 4, 1);
    else if (e.type === 'rearrange') {
      audio.woke();
      for (const pl of game.players) vibrate(pl.id, 0.7, 300);
      chipsDirty = true;
      playToast('The picture rearranges itself. New controls to find.');
    } else if (e.type === 'shift') {
      audio.shift();
      audio.scene(game.index);
      for (const pl of game.players) vibrate(pl.id, 0.9, 500);
      caption();
      chipsDirty = true;
      renderer.loadScene(game.scenes[(game.index + 1) % game.scenes.length], data.chains, data.drift);
    }
  }
  // Button presses pluck a note; bigger bindings, lower notes.
  for (const pl of game.players) {
    const inp = inputs.get(pl.id);
    if (!inp) continue;
    for (const name of inp.pressed) {
      const b = pl.bindings[name];
      if (b) audio.pluck(INPUTS.indexOf(name) + (b.target || 0), b.scale === 'large' ? 2 : b.scale === 'medium' ? 1 : 0);
    }
    // A large control waking: a chime and a rumble for its player.
    for (const b of Object.values(pl.bindings)) {
      if (b.scale !== 'large') continue;
      const key = pl.id + b.input;
      const pw = setupPower(game, b);
      const was = ui.lastPower.get(key) ?? pw;
      if (was < AWAKE && pw >= AWAKE) {
        audio.woke();
        vibrate(pl.id, 0.5, 200);
        chipsDirty = true;
      }
      if (was >= AWAKE && pw < AWAKE) chipsDirty = true;
      ui.lastPower.set(key, pw);
    }
  }
  const f = game.field;
  audio.rush(f.swirls.reduce((s, q) => s + Math.abs(q.va) * 0.6 + Math.abs(q.a) * 0.15, 0) + Math.abs(f.tideV) * 0.5 + f.pour * 0.6 + f.unravel * 0.6);
  if (chipsDirty) chips();
}

// The left stick in menus: which way it is pushed (the stronger axis), or
// null in the middle, with a little hysteresis so it does not flicker.
function stickDirection(sx, sy) {
  const m = Math.hypot(sx, sy);
  if (m < (ui.stick ? 0.35 : 0.55)) return null;
  return Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 'right' : 'left') : sy > 0 ? 'down' : 'up';
}

// One step when the stick is pushed, then repeats while it is held.
function stickRepeat(sx, sy, now) {
  const d = stickDirection(sx, sy);
  if (!d) {
    ui.stick = null;
    return null;
  }
  if (!ui.stick || ui.stick.dir !== d) {
    ui.stick = { dir: d, next: now + 420 };
    return d;
  }
  if (now >= ui.stick.next) {
    ui.stick.next = now + 170;
    return d;
  }
  return null;
}

function handleMenus(nav, now) {
  const items = navItems();
  const top = ui.modals.at(-1);
  // Title: any fresh controller button starts, until the stick opens the options.
  if (ui.screen === 'title' && !ui.modals.length) {
    const [sx, sy] = nav.stick;
    if (!ui.titleNav && Math.hypot(sx, sy) > 0.5) {
      ui.titleNav = true;
      ui.focus = 0;
      // This push opens the options; it does not also move along them.
      ui.stick = { dir: stickDirection(sx, sy), next: now + 420 };
      refreshFocus(true);
      return;
    }
    if (!ui.titleNav && input.padAnyPressed()) {
      input.lockHeld();
      start();
      return;
    }
    if (ui.titleNav && input.padPressed(BTN.MENU)) {
      start();
      return;
    }
  }
  if (ui.screen === 'play' && !ui.modals.length) {
    if (nav.pause) pause();
    else if (nav.view) {
      ui.paused = true;
      openModal('card');
    }
    return;
  }
  if (!items.length && !top) return;
  // A long text with nothing to choose in it (how to play, the hint, the
  // controls found) reads by scrolling: up and down, on the pad or the stick,
  // move the text rather than the focus.
  const dt = Math.min(0.1, Math.max(0, (now - ui.menuAt) / 1000));
  ui.menuAt = now;
  const scroller = top && document.getElementById(top).querySelector('.scroll');
  const reads = scroller && !scroller.querySelector('[data-nav]') && scroller.scrollHeight > scroller.clientHeight + 2;
  const [sx, sy] = nav.stick;
  if (reads) {
    let ry = Math.abs(sy) > 0.25 ? sy : 0;
    for (const g of navigator.getGamepads?.() || []) if (g && Math.abs(g.axes[3] || 0) > 0.25) ry = g.axes[3];
    // The d-pad: a press scrolls a step; held, the text runs on.
    const pad = input.padHeld(BTN.UP) ? -1 : input.padHeld(BTN.DOWN) ? 1 : 0;
    if (!pad) ui.padSince = null;
    else if (ui.padSince === null || ui.padSince === undefined) ui.padSince = now;
    if (pad && now - ui.padSince > 350) ry = pad;
    if (ry) scroller.scrollTop += ry * 700 * dt;
    else if (nav.up || nav.down) scroller.scrollTop += (nav.up ? -1 : 1) * 120;
  }
  // Directional focus. The stick steps like a key: once when pushed, then,
  // held, again after a pause and at a steady pace; it resets when let go.
  const stickStep = stickRepeat(sx, sy, now);
  const want = (d) => (reads && (d === 'up' || d === 'down') ? false : nav[d] || stickStep === d);
  // In a grid of pictures (the pause menu), up and down move a whole row.
  const cur = items[ui.focus];
  const grid = cur?.closest('[data-cols]');
  const row = grid ? Number(grid.dataset.cols) : 1;
  let dir = 0;
  if (isRange(cur) && (want('left') || want('right'))) {
    cur.value = Number(cur.value) + (want('left') ? -1 : 1) * Number(cur.step || 1);
    cur.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (want('left')) dir = -1;
  else if (want('right')) dir = 1;
  if (want('up')) dir = -row;
  else if (want('down')) dir = row;
  if (dir && items.length) {
    ui.focus = (ui.focus + dir + items.length) % items.length;
    refreshFocus(true);
  }
  // Lists that hold choices (settings) still scroll with the right stick.
  if (scroller && !reads) {
    let ry = 0;
    for (const g of navigator.getGamepads?.() || []) if (g && Math.abs(g.axes[3] || 0) > 0.2) ry = g.axes[3];
    if (ry) scroller.scrollTop += ry * 700 * dt;
  }
  if (nav.confirm && input.kind === 'controller') activate(items[ui.focus]);
  if (nav.back || (top === 'pause' && nav.pause) || (top === 'card' && nav.view)) {
    if (top) closeModal();
    else if (ui.screen === 'title' && ui.titleNav) {
      ui.titleNav = false;
      refreshFocus();
    }
  }
}

const isRange = (el) => el?.matches?.('input[type="range"]');

// ---- Wiring --------------------------------------------------------------

function wire() {
  document.addEventListener('click', (e) => {
    // A click outside the open panel, on the dimmed picture, closes it.
    if (e.target.matches?.('.modal') && e.target.id === ui.modals.at(-1)) return closeModal();
    const el = e.target.closest('[data-action], [data-open]');
    if (!el) return;
    audio.unlock();
    if (el.dataset.open) return openModal(el.dataset.open);
    switch (el.dataset.action) {
      case 'start': return start();
      case 'fullscreen': return toggleFullscreen();
      case 'sound': return toggleSound();
      case 'pause': return pause();
      case 'resume': return closeAllAndResume();
      case 'close': return closeModal();
      case 'card': return openModal('card');
      case 'hint': return openModal('hint');
      case 'next-scene':
        closeAllAndResume();
        return shift(game, 'pour');
      case 'quit-title': return quitToTitle();
      default:
    }
  });
  // Keyboard on the title: Enter starts when nothing else has focus.
  addEventListener('keydown', (e) => {
    if (ui.screen === 'title' && !ui.modals.length && (e.code === 'Enter' || e.code === 'Space')) {
      const a = document.activeElement;
      if (!a || a === document.body || a.id === 'press-start') {
        e.preventDefault();
        start();
      }
    }
  });
  for (const el of $$('[data-setting]')) {
    const k = el.dataset.setting;
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
      settings[k] = el.type === 'checkbox' ? el.checked : Number(el.value);
      if (el.type !== 'checkbox') el.nextElementSibling.textContent = el.value;
      saveSettings();
      applySettings();
    });
  }
  // Sound only while the page is visible and focused.
  const syncAudio = () => audio.setActive(!document.hidden && document.hasFocus());
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && (e.movementX || e.movementY)) revealHud();
  });
  addEventListener('pointerdown', revealHud);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause('Paused while the page was hidden.');
    syncAudio();
  });
  addEventListener('blur', () => {
    pause('Paused while the window was in the background.');
    audio.setActive(false);
    releaseHand();
  });
  addEventListener('focus', () => audio.setActive(!document.hidden));
  addEventListener('pageshow', syncAudio);
  input.onKind((k) => {
    $('#hud').classList.toggle('touch', k === 'touch');
    hint();
    refreshFocus();
  });
}

function closeAllAndResume() {
  for (const id of ui.modals) document.getElementById(id).hidden = true;
  ui.modals = [];
  resume();
}

async function boot() {
  wire();
  // Browser bars: see src/chrome.js.
  chrome = createChrome({ app: $('#app'), isPlaying: () => ui.screen === 'play' && !ui.modals.length, hintEl: $('#bars-hint') });
  try {
    data = await (await fetch('web/scenes.json')).json();
    renderer = createRenderer($('#gl'));
    overlay = createOverlay($('#overlay'));
    overlay.loadLines(data.ui.lines);
    const seed = Math.floor(Math.random() * 1e9);
    const first = new URLSearchParams(location.search).get('scene');
    const at = Math.max(0, data.scenes.findIndex((s) => s.key === first));
    game = createGame(data.scenes, { chains: data.chains, seed, scene: at });
    game.driftFiles = data.drift || [];
    // Delivered pause menu pictures (HK-U06) replace the icons drawn in code.
    for (const [name, file] of Object.entries(data.ui.pause || {})) {
      for (const el of $$(`[data-icon="${name}"]`)) {
        const img = document.createElement('img');
        img.src = `web/${file}`;
        img.alt = '';
        img.className = 'badge';
        el.querySelector('svg, img')?.replaceWith(img);
      }
    }
    if (data.music) audio.setSong(`web/${data.music.file}`, data.music.root);
    applySettings();
    // The loading bar: a running stitch sewn across as the first picture arrives.
    const bar = $('.stitch-bar');
    const sew = setInterval(() => {
      const { asked, done } = renderer.progress;
      const pct = asked ? Math.round((100 * done) / asked) : 0;
      bar.firstElementChild.style.width = `${pct}%`;
      bar.setAttribute('aria-valuenow', pct);
    }, 100);
    await renderer.loadScene(game.scene, data.chains, data.drift).finally(() => clearInterval(sew));
    renderer.loadScene(data.scenes[(game.index + 1) % data.scenes.length], data.chains, data.drift);
  } catch (err) {
    console.error(err);
    $('.stitch-bar').hidden = true;
    $('.loading-text').hidden = false;
    $('.loading-text').textContent = 'This browser cannot show the collage: it needs WebGL 2.';
    return;
  }
  setupPointer();
  show('title');
  hint();
  window.fibreart = { game: () => game, frame: () => renderer.frame, ui, input, start, shift: (how) => shift(game, how), W, H, radius, audio };
  requestAnimationFrame(frame);
}

boot();
