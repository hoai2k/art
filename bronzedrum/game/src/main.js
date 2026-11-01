// Shell and game loop: title, chapter select, play, pause, results.

import { DrumReader, COMMANDS, SPIRIT_COMBO, TIER_POWER, DIFFICULTIES, commandById, parsePattern, rhythmFor, setDifficulty, fitBeats, beatsOf, setBeatCount, getBeatCount } from './rhythm.js';
import { createBattle, orderFor, spawnEnemy, spawnChildren, dismissChildren, issueOrder, stepArmy, stepEnemies, resolveIncoming, commandPower, tempoFactor, blocker, guard, shieldsUp, aboutToAttack } from './battle.js';
import { STAGES } from './stages.js';
import { EchoSession, CastingSession, callPattern, dueWaves } from './modes.js';
import { createPractice } from './practice-play.js';
import { catalogue, levelRhythms, LEVELS } from './training.js';
import { guidedPhrase } from './phrase-view.js';
import { Sound } from './audio.js';
import { Input, PAD } from './input.js';
import { Renderer } from './render.js';
import { Art, STYLES } from './art.js';
import { T, txt, applyPageText } from './text_config.js';
import { PALETTE as P } from './palette.js';
import { createFit } from './fit.js';
import { createChrome, requestFullscreen, exitFullscreen, fullscreenElement, canFullscreen } from './chrome.js';

const $ = (s) => document.querySelector(s);
// The key the saves have always been kept under (changing it would lose them).
const STORE = 'bronzedrum.prototype';

// ---------------------------------------------------------------- storage

function load(key, fallback) {
  try {
    const v = localStorage.getItem(`${STORE}.${key}`);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(`${STORE}.${key}`, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep going */
  }
}

// The page's own words (index.html) come from text_config.js.
applyPageText();

const settings = load('settings', { volume: 80, echo: 60, music: 60, ambience: 60, offset: 0, hints: true, vibration: true, reduceMotion: false, difficulty: 1, beats: 4, sticks: 0, style: 0, muted: false });
// Difficulty: 0 easy, 1 medium, 2 hard (rhythm.js). It takes effect when a chapter starts.
const DIFFICULTY_NAMES = T.settings.difficultyChoices;
// The sisters' close-up sticks over the drum (render/hud.js STICK_SETS).
const STICK_NAMES = T.settings.drumsticksChoices;
// The look (art.js STYLES): the shadow puppets, or the water puppets.
const STYLE_NAMES = T.settings.styleChoices;
const SETTING_NAMES = { difficulty: DIFFICULTY_NAMES, sticks: STICK_NAMES, style: STYLE_NAMES };
function applyDifficulty() {
  setDifficulty(DIFFICULTIES[settings.difficulty] || 'medium');
  setBeatCount(settings.beats);
  buildCommandTable();
}
// Every chapter is open from the start; winning still records progress.
const progress = load('progress', { unlocked: STAGES.length });
// Drum Practice remembers the last number of strokes and kit.
const practiceSettings = load('practice', { beats: 4, kit: 'bronze' });
progress.unlocked = Math.max(progress.unlocked, STAGES.length);

// ---------------------------------------------------------------- systems

const art = new Art();
const sound = new Sound();
const canvas = $('#stage');
const renderer = new Renderer(canvas, art);
const input = new Input(canvas);

/** Settings, Style: the art and everything baked from it follow at once. */
function applyStyle() {
  const style = STYLES[settings.style] || 'shadow';
  document.body.dataset.style = style;
  if (art.style === style) return;
  art.style = style;
  renderer.restyle();
  applyStyleArt();
}

function applySound() {
  const btn = $('#sound-btn');
  if (!btn) return;
  const label = txt(settings.muted ? 'title.cornerButtons.soundOff' : 'title.cornerButtons.soundOn');
  btn.setAttribute('aria-pressed', String(!settings.muted));
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
  btn.classList.toggle('is-off', !!settings.muted);
  btn.querySelector('.btn-label').textContent = label;
  btn.querySelector('svg').innerHTML = settings.muted ? SOUND_OFF : SOUND_ON;
}
const SOUND_ON = '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></g>';
const SOUND_OFF = '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></g>';

function applySettings() {
  sound.setVolume(settings.volume / 100);
  sound.setMuted(settings.muted);
  applySound();
  sound.setAmbience(settings.ambience / 100);
  sound.setMusic(settings.music / 100);
  input.vibration = settings.vibration;
  renderer.reduceMotion = settings.reduceMotion;
  renderer.stickSet = settings.sticks;
  applyStyle();
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
  for (const el of document.querySelectorAll('[data-setting]')) {
    const k = el.dataset.setting;
    if (el.type === 'checkbox') el.checked = settings[k];
    else if (el.tagName === 'SELECT') el.value = String(settings[k]);
    else {
      el.value = settings[k];
      el.nextElementSibling.textContent = SETTING_NAMES[k] ? SETTING_NAMES[k][settings[k]] : settings[k];
    }
  }
  // Mid-chapter the rhythms stay as they are until the next chapter starts.
  if (!game) applyDifficulty();
  save('settings', settings);
}

// ---------------------------------------------------------------- screens

let screen = 'title';
let titleNav = false; // utility navigation on the title screen
const dialogs = []; // open dialog ids, top last
const focusMemory = new Map();

function show(id) {
  for (const s of ['title', 'select', 'practice', 'pause', 'result', 'rotate']) $(`#${s}`).hidden = s !== id;
  // A chapter's opening card shows only over its scene (not over the pause menu).
  $('#opening').hidden = !(id === 'play' && game && game.opening);
  if (id === 'title' || id === 'select' || id === 'practice' || id === 'result') hideSuccess();
  // Menu music: the anthem on the title and the chapter select; Drum Practice's
  // own screen keeps the old menu theme (the two sisters), not the anthem.
  if (id === 'title' || id === 'select') sound.menuMusic();
  if (id === 'practice') sound.practiceMusic();
  screen = id;
  input.mode = id === 'play' ? 'play' : 'menu';
  canvas.style.visibility = id === 'title' || id === 'select' || id === 'practice' ? 'hidden' : 'visible';
  document.body.classList.toggle('playing', id === 'play');
  chrome.update();
  if (id !== 'play') focusFirst(activeRoot());
  // The browser may drop the canvas once a menu goes over it and the game stops drawing.
  if (id !== 'play') requestAnimationFrame(redrawPaused);
}

function activeRoot() {
  if (dialogs.length) return $(`#${dialogs[dialogs.length - 1]}`);
  return screen === 'play' ? null : $(`#${screen}`);
}

function navItems(root) {
  if (!root) return [];
  return [...root.querySelectorAll('[data-nav]')].filter((el) => !el.disabled && el.offsetParent !== null);
}

function setFocus(el) {
  for (const n of document.querySelectorAll('.nav-focus')) n.classList.remove('nav-focus');
  if (!el) return;
  el.focus({ preventScroll: false });
  if (input.device === 'gamepad') el.classList.add('nav-focus');
}

function focusFirst(root) {
  const items = navItems(root);
  const first = items.find((el) => !el.closest('.corner-buttons')) || items[0];
  setFocus(first);
}

function openDialog(id) {
  focusMemory.set(id, document.activeElement);
  dialogs.push(id);
  $(`#${id}`).hidden = false;
  input.mode = 'menu';
  focusFirst($(`#${id}`));
  // Open at the top, even when focus landed on a button further down.
  $(`#${id} .panel`).scrollTop = 0;
  requestAnimationFrame(redrawPaused);
}

function closeDialog() {
  const id = dialogs.pop();
  if (!id) return;
  sound.play('ui-back');
  $(`#${id}`).hidden = true;
  const back = focusMemory.get(id);
  if (back && back.offsetParent !== null) setFocus(back);
  else focusFirst(activeRoot());
}

/** Spatial navigation: the nearest item in the pressed direction. */
function move(dir) {
  const root = activeRoot();
  const items = navItems(root);
  if (!items.length) return;
  const cur = document.activeElement;
  if (cur && cur.type === 'range' && (dir === 'left' || dir === 'right')) {
    if (dir === 'left') cur.stepDown();
    else cur.stepUp();
    cur.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  // A dropdown: left and right step through its choices (a controller cannot open it).
  if (cur && cur.tagName === 'SELECT' && (dir === 'left' || dir === 'right')) return cycleSelect(cur, dir === 'left' ? -1 : 1);
  if (dir === 'down' || dir === 'up') {
    const scroller = root.querySelector('.scroll');
    if (scroller && cur && cur.dataset.action === 'close' && dir === 'up' && scroller.scrollTop > 0) {
      scroller.scrollBy({ top: -120 });
      return;
    }
    if (scroller && cur && cur.dataset.action === 'close' && dir === 'down' && scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 2) {
      scroller.scrollBy({ top: 120 });
      return;
    }
  }
  if (!items.includes(cur)) return setFocus(items[0]);
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - ax;
    const dy = b.top + b.height / 2 - ay;
    const along = { left: -dx, right: dx, up: -dy, down: dy }[dir];
    if (along <= 4) continue;
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  sound.play('ui-move');
  if (best) setFocus(best);
  else {
    // Wrap within a vertical menu.
    const i = items.indexOf(cur);
    if (dir === 'down') setFocus(items[(i + 1) % items.length]);
    if (dir === 'up') setFocus(items[(i - 1 + items.length) % items.length]);
  }
}

/** The next (or previous) choice of a dropdown, wrapping round. */
function cycleSelect(el, step) {
  const n = el.options.length;
  el.selectedIndex = (el.selectedIndex + step + n) % n;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function activate(el) {
  if (!el) return;
  if (el.tagName === 'SELECT') return cycleSelect(el, 1);
  if (el.type === 'checkbox') {
    el.checked = !el.checked;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else el.click();
}

function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------------------------------------------------------------- fullscreen

const coarsePointer = window.matchMedia('(pointer: coarse)');
// Browser bars: fullscreen on the first tap in landscape where possible; on
// iPhone Safari, a swipe up tucks the bars away (see src/chrome.js).
const chrome = createChrome({ isPlaying: () => screen === 'play', hintEl: $('#bars-hint') });
function enterFullscreen() {
  if (coarsePointer.matches || !chrome.scrollTrick) requestFullscreen();
}
async function toggleFullscreen() {
  // iPhone Safari can't go fullscreen: point at the ways it can lose its bars.
  if (chrome.scrollTrick) {
    const h = $('#bars-hint');
    h.hidden = false;
    h.classList.remove('flash');
    void h.offsetWidth;
    h.classList.add('flash');
    return;
  }
  if (!canFullscreen()) return toast(T.messages.fullscreenUnavailable);
  if (fullscreenElement()) await exitFullscreen();
  else await requestFullscreen();
}
// Resizing clears the canvas; while paused nothing else redraws it, so draw
// the frozen scene again (Esc leaves fullscreen as it pauses, phones rotate).
function redrawPaused() {
  if (game && screen !== 'play' && screen !== 'title' && screen !== 'select' && screen !== 'practice') renderer.draw(view(), 0);
}


// ---------------------------------------------------------------- chapter select

function buildCards() {
  const box = $('#stage-cards');
  box.innerHTML = '';
  const intro = $('#stage-intro');
  STAGES.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    b.dataset.nav = '';
    b.disabled = i >= progress.unlocked;
    const img = art.get(`card-${s.id}`);
    b.innerHTML = `<span class="card-art${img ? '' : ' plain'}" aria-hidden="true"></span><span class="num">${txt('chapterSelect.chapterNumber', { n: i + 1 })}</span><span class="name"></span><span class="sub"></span>`;
    if (img) b.querySelector('.card-art').style.backgroundImage = `url(${img.src})`;
    b.querySelector('.name').textContent = s.title;
    b.querySelector('.sub').textContent = s.subtitle;
    b.setAttribute('aria-description', `${s.story} ${s.goal}`);
    const describe = () => {
      intro.textContent = i < progress.unlocked ? `${s.story} ${s.goal}` : T.chapterSelect.locked;
    };
    b.addEventListener('focus', describe);
    b.addEventListener('mouseenter', describe);
    b.addEventListener('click', () => startStage(i));
    box.appendChild(b);
  });
  intro.textContent = `${STAGES[0].story} ${STAGES[0].goal}`;
}

function buildCommandTable() {
  const t = $('#cmd-table');
  t.innerHTML = `<tr><th>${T.instructions.commandTable.command}</th><th>${T.instructions.commandTable.tier1}</th><th>${T.instructions.commandTable.tier2}</th><th>${T.instructions.commandTable.tier3}</th></tr>`;
  const effects = {
    march: T.instructions.commandEffects.march,
    strike: T.instructions.commandEffects.strike,
  };
  const cell = (text) =>
    text
      .split(' ')
      .map((beat) => {
        const dots = [...beat].map((d) => `<span class="${d === '.' ? 'g-rest' : d === 'L' ? 'g-l' : 'g-r'}${beat.length > 1 ? ' sub' : ''}"></span>`).join('');
        return beat.length > 1 ? `<span class="group g${beat.length}">${dots}</span>` : dots;
      })
      .join(' ');
  for (const c of COMMANDS) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${c.name}</strong> · ${c.gloss}<br><small>${effects[c.id]}</small></td>${c.tiers.map((x) => `<td class="pat">${cell(x)}</td>`).join('')}`;
    t.appendChild(tr);
  }
}

// ---------------------------------------------------------------- play

let game = null;

// The army keeps a march or a strike going in the player's
// groove for up to this many extra four-beat cycles, at reduced power, until
// the next phrase starts. The elephant charge happens once.
const SUSTAIN = { march: 0.6, strike: 0.5 };
const SUSTAIN_CYCLES = 2;

function startStage(i, custom = null, { opening = true } = {}) {
  hideSuccess();
  hideOpening();
  stopDemo();
  const stage = custom || STAGES[i];
  sound.start();
  sound.setKit(null);
  input.practice = false;
  input.training = false;
  input.pointerPick = null;
  applyDifficulty();
  // The rhythm this chapter plays, at the chosen difficulty (calls, the hammer
  // rhythm); Training plays them as designed.
  const rhythm = (text) => (stage.asDesigned ? text : fitBeats(rhythmFor(text)));
  game = {
    index: i,
    stage,
    hanBeat: 60 / stage.bpm, // the Han war drum keeps the chapter's tempo
    mode: stage.mode || 'battle',
    reader: new DrumReader({ unlocked: stage.unlocked || [], maxTier: stage.maxTier || 3 }),
    session: null, // echo or casting session (modes.js)
    spawned: new Set(), // hold-the-line waves already on the field
    crackAt: -9,
    battle: createBattle(stage),
    clockStart: sound.now + 0.6,
    nextHan: 1,
    armyBeats: [], // { t, order? } on the player's beats
    cycle: null, // the army's current four-beat cycle
    echoes: [], // scheduled echo-drum sources, cancelled when a new phrase starts
    feedback: null,
    ended: false,
    introUntil: 7,
    commandsDone: 0,
    tiersUsed: new Set(),
    guards: 0,
    blocks: 0,
  };
  if (stage.lessons) {
    game.lessons = { done: new Set(), praise: null, blocked: 0, kids: false };
    game.battle.hold = true; // the chapter waits for the last lesson, the children (updatePlay)
  }
  if (game.mode === 'echo') {
    game.session = new EchoSession({ calls: stage.calls.map((c) => ({ ...c, text: rhythm(c.text) })), matchTempo: stage.matchTempo, tolerance: stage.tolerance, pause: stage.settle ?? 0.4 });
    game.reader.patterns = [];
    game.session.nextCallAt = 2.2;
  } else if (game.mode === 'casting') {
    game.session = new CastingSession({ drums: stage.drums, u: 60 / stage.bpm, tolerance: stage.tolerance });
    // The guide: the foundry's drum plays the hammer rhythm at the pace to hold.
    game.rhythm = rhythm(stage.rhythm);
    game.guide = stage.bpm ? { u: 60 / stage.bpm, start: 2.5, next: 0, strokes: parsePattern(game.rhythm) } : null;
    game.reader.patterns = [callPattern(game.rhythm, 'cast')];
  }
  renderer.setStage(stage);
  // In battle the sisters play each command back as the army acts (startCycle).
  renderer.crewFollowsReplay = game.mode === 'battle';
  sound.loadSamples().then(() => {
    if (game && game.stage === stage) {
      sound.startAmbience(stage.ambience);
      // A beatless bed under the chapter, quieter than the menus.
      if (stage.music) sound.playMusic(stage.music, { level: stage.musicLevel ?? 0.55 });
    }
  });
  if (document.activeElement) document.activeElement.blur();
  show('play');
  // A chapter opens on its story: the clock waits until the player begins.
  if (opening && stage.story) showOpening();
}

// ---------------------------------------------------------------- opening
// Each chapter opens on a card over its scene: the chapter, two sentences of
// its story, and what to do. Nothing moves until the player begins (A, Space,
// a drum stroke, a tap or a click); then the chapter's clock starts afresh.

function showOpening() {
  const g = game;
  g.opening = true;
  $('#opening-num').textContent = txt('opening.chapterNumber', { n: g.index + 1 });
  $('#opening-title').textContent = g.stage.title;
  $('#opening-story').textContent = g.stage.story;
  $('#opening-goal').textContent = g.stage.goal;
  const el = $('#opening');
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
}

function hideOpening() {
  const el = $('#opening');
  el.classList.remove('show');
  el.hidden = true;
}

/** Begin the chapter: the card goes and the clock starts from now. */
function beginChapter() {
  const g = game;
  if (!g || !g.opening) return;
  g.opening = false;
  g.openingView = null;
  hideOpening();
  sound.play('ui-confirm');
  g.clockStart = sound.now + 0.6;
}

/**
 * The game clock: seconds since the chapter's clock started. Sounds are
 * scheduled on the audio clock, but that clock only moves once per audio
 * buffer (every 3 ms in Chrome, and 10-40 ms in other browsers, on Bluetooth
 * and on many phones), so anything drawn from it stutters and a 50 ms stick
 * stroke can fall between two frames. So the game reads the performance clock
 * instead, locked to the audio clock: each time the audio clock steps, the
 * offset between the two is nudged a tenth of the way toward it. A jump of
 * more than 80 ms (a new chapter, a resume, a stall) relocks at once, and
 * while the audio is suspended the audio clock is used as it is.
 */
const smoothClock = { game: null, offset: 0, seen: -1, last: -Infinity };
function songTime() {
  const raw = sound.now - game.clockStart;
  const ctx = sound.ctx;
  if (!ctx || ctx.state !== 'running') {
    smoothClock.game = null;
    return raw;
  }
  const p = performance.now() / 1000;
  const c = smoothClock;
  if (c.game !== game || Math.abs(p + c.offset - raw) > 0.08) {
    Object.assign(c, { game, offset: raw - p, seen: sound.now, last: -Infinity });
  } else if (sound.now !== c.seen) {
    c.seen = sound.now;
    c.offset += (raw - (p + c.offset)) * 0.1;
  }
  // Never backwards: the nudges are smaller than a frame.
  c.last = Math.max(c.last, p + c.offset);
  return c.last;
}

/**
 * The game time now being heard: the audio clock less the output latency, so
 * pictures that follow sounds (the demonstration's pointer) line up with what
 * reaches the speakers rather than with what is being scheduled.
 */
function heardTime() {
  const ctx = sound.ctx;
  const ts = ctx && ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
  if (ts && ts.performanceTime > 0) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000 - game.clockStart;
  return songTime() - sound.latency;
}

/** Map an input timestamp (performance clock) onto the heard game clock. */
function hitTime(perfMs) {
  const ctx = sound.ctx;
  let heard;
  const ts = ctx && ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
  if (ts && ts.performanceTime > 0) heard = ts.contextTime + (perfMs - ts.performanceTime) / 1000;
  else heard = sound.now - (performance.now() - perfMs) / 1000 - sound.latency;
  return heard - game.clockStart - settings.offset / 1000;
}

function feedback(text, color) {
  game.feedback = { text, color, t: songTime() };
}

/** A short confirmation under the drum for the reset and guard buttons. */
function confirm(text, color) {
  game.confirm = { text, color, t: songTime() };
}

input.on('drum', ({ drum, time }) => strike(drum, time));
input.on('action', ({ action, time }) => {
  // The Oath has no shields and its calls need no reset: there A and Y (Space
  // and R) only stir a breeze over the incense while held (see view()). The
  // opening card and the success moment still take A to go on.
  if (game && game.stage.caller === 'mourning' && !game.success && !game.opening) return;
  act(action, time);
});

// Touch: the renderer's layout says what was tapped (the drum's centre or
// rim, the shield, reset or pause button), then it is handled like a key.
input.on('touch', ({ x, y, time }) => {
  // On the success moment only its button goes on (a stray tap should not).
  if (screen !== 'play' || dialogs.length || !game || game.ended) return;
  if (game.opening) return beginChapter();
  // Training: a tap on a level or a rhythm chooses it.
  const pick = game.training && renderer.trainingTarget(x, y, game.training);
  if (pick) return act(pick, time);
  const target = renderer.touchTarget(x, y, game.mode);
  renderer.touched(x, y, target, songTime());
  if (target === 'L' || target === 'R' || target === 'S') strike(target, time);
  else if (target === 'pause') pause();
  else if (target !== 'none') act(target, time);
});
// A swipe across the drum or the dots resets the rhythm, like the mõ.
input.on('swipe', ({ x0, y0, x, y, time }) => {
  if (screen !== 'play' || dialogs.length || !game || game.ended) return;
  if (!renderer.swipeResets(x0, y0)) return;
  renderer.swiped(x0, y0, x, y, songTime());
  act('reset', time);
});

function strike(drum, time) {
  if (screen !== 'play' || dialogs.length || !game || game.ended) return;
  if (game.opening) return beginChapter();
  if (game.mode === 'practice') return practiceStrike(drum, time);
  const t = hitTime(time);
  if (drum === 'L') sound.tung();
  else sound.cac(undefined, game.reader.busy(t));
  renderer.hit(drum, songTime());
  input.rumble(drum === 'L' ? 50 : 30, drum === 'L' ? 0.6 : 0.3);
  // The player takes over: a demonstration stops at the first stroke.
  if (game.demo && songTime() > game.demo.start - 0.3) stopDemo();
  const trying = game.reader.progress();
  if (trying) game.lastTry = trying.pattern;
  const before = game.reader.phrase.slice();
  game.miss = null;
  const events = game.reader.hit(drum, t);
  game.miss = missView(events, trying, before, drum, t);
  if (game.mode === 'casting') {
    // The continuous pour: every stroke in time adds bronze, a broken phrase
    // cracks back to the last cast drum (see CastingSession).
    const done = events.find((e) => e.type === 'command');
    const now = game.reader.progress();
    let out = [];
    if (done) out = game.session.stroke(songTime(), done.u);
    else if (game.miss) out = game.session.miss();
    else if (game.reader.phrase.length) out = game.session.stroke(songTime(), now ? now.u : null);
    for (const e of out) handleMode(e);
  }
  // A stroke just after the phrase timed out: it was too late.
  const f = game.faded;
  if (!game.miss && f && f.trying.u && songTime() - f.at < 1.2 * f.trying.u) {
    game.miss = missView([{ type: 'reset', reason: 'uneven' }], f.trying, f.before, drum, t);
  }
  game.faded = null;
  for (const ev of events) handleRhythm(ev);
}

/**
 * When a stroke breaks the phrase, what to show: the strokes played so far
 * and the wrong one where it actually fell, at the player's own tempo. The
 * wrong drum on time sits in the expected place; a stroke too soon joins the
 * beat before as a pair or triplet; too late, it lands past its beat. The HUD
 * crosses it out (see Renderer.hud).
 */
function missView(events, trying, before, drum, t) {
  const r = game.reader;
  const broke = events.some((e) => e.type === 'reset' && e.reason === 'uneven') ||
    (!before.length && events.some((e) => e.type === 'reset' && e.reason === 'no-pattern') && r.patterns.length === 1);
  if (!broke) return null;
  const p = trying ? trying.pattern : r.patterns[0];
  const k = before.length;
  const want = p.strokes[k];
  if (!want) return null;
  const u = trying && trying.u;
  let pos = want.pos;
  let kind = drum !== want.drum ? 'drum' : 'time';
  if (k > 0 && u) {
    const raw = p.strokes[0].pos + (t - before[0].t) / u;
    const gap = (t - before[k - 1].t) / (u * (want.pos - p.strokes[k - 1].pos));
    const onTime = Math.abs(Math.log2(Math.max(1e-6, gap))) <= 0.45;
    if (!(kind === 'drum' && onTime)) {
      kind = raw < want.pos ? 'soon' : 'late';
      // Snap to the nearest half or third of a beat, after the last stroke.
      const grid = [...Array(25).keys()].flatMap((i) => [i / 2, i / 3]).filter((v) => v > p.strokes[k - 1].pos + 0.1 && v < (p.text ? beatsOf(p.text) : 4));
      pos = grid.reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a), grid[0] ?? want.pos);
    }
  }
  const played = p.strokes.slice(0, k).map((s) => ({ ...s }));
  played.push({ drum, pos, wrong: true });
  const rest = p.strokes.filter((s) => Math.floor(s.pos) > Math.floor(pos));
  return { strokes: [...played, ...rest], filled: played.length, wrong: k, beat: Math.floor(pos), timing: kind !== 'drum', t: songTime() };
}

function act(action, time) {
  if (screen === 'play' && !dialogs.length && game && game.success) {
    if (action === 'guard' || action === 'confirm') continueOn();
    return;
  }
  if (screen !== 'play' || dialogs.length || !game || game.ended) return;
  if (game.opening) return beginChapter();
  if (game.mode === 'practice') return practiceAct(action);
  if (game.training && trainingAct(action)) return;
  // One button, A (Space, the shield drum): it always clears the rhythm dots,
  // and in a battle it also raises the shield wall. In chapters with no
  // shields it is just the clear, with a knock on the wooden slit drum (mõ).
  const battle = game.mode === 'battle';
  if (action === 'reset' || action === 'guard') {
    const shown = view().phraseView;
    const events = game.reader.reset();
    if (events.length && shown && !shown.done) renderer.clearDots(shown, songTime());
    game.quietClear = battle && action === 'guard';
    for (const ev of events) handleRhythm(ev);
    game.quietClear = false;
    if (!battle || action === 'reset') {
      sound.play('drum-mo', sound.now, 0.8);
      renderer.kick('mo', songTime());
      input.rumble(25, 0.3);
    }
  }
  if (action === 'guard' && battle) {
    // The shield wall: timed to attacks in flight.
    const t = hitTime(time);
    if (guard(game.battle, Math.max(t, game.battle.time))) {
      // A stroke on the big hide barrel drum (trống chầu) calls the shields up.
      sound.play('drum-chau', sound.now, 0.9);
      renderer.kick('chau', songTime());
      sound.play('cmd-shield', sound.now + 0.04, 0.6);
      input.rumble(40, 0.3);
      game.guards += 1;
    }
  }
}

/**
 * Start one of the army's four-beat cycles at the player's tempo: four army
 * beats, the command's sound, two shouts, and the echo drums replaying the
 * pattern. Later cycles of a sustained order are quieter and weaker.
 */
function startCycle(c) {
  const g = game;
  g.cycle = c;
  for (let k = 0; k < 4; k++) g.armyBeats.push({ t: c.start + k * c.u, order: k === 0 ? c : null });
  const at = g.clockStart + c.start;
  if (c.index === 0) {
    if (sound.has('call')) {
      sound.play(`cmd-${c.command}`, at);
      sound.call(at);
      sound.call(at + 2 * c.u);
    } else {
      for (let k = 0; k < 4; k++) sound.call(at + k * c.u, 1 + k * 0.06 + (c.spirit ? 0.2 : 0));
    }
  }
  // The drum crew plays the rhythm once more while the army acts: the
  // player's own drum, clearly (the dots light along with it, view()); a
  // sustained round after it is the army's drums keeping the groove, lower
  // and softer.
  const first = c.index === 0;
  const level = (settings.echo / 100) * (first ? 0.85 : 0.4);
  for (const s of c.pattern.strokes) {
    const src = sound.echo(s.drum, at + s.pos * c.u, level, first ? 1 : 0.9);
    if (src) g.echoes.push(src);
    // The sisters on the palanquin play it as the army moves off.
    if (first) renderer.crewStroke(s.drum, c.start + s.pos * c.u);
  }
}

/** The player has started a new phrase: the army stops keeping the old groove. */
function endSustain() {
  const g = game;
  const t = songTime();
  g.armyBeats = g.armyBeats.filter((b) => b.t <= t);
  for (const src of g.echoes) {
    try {
      src.stop();
    } catch {
      /* already finished */
    }
  }
  g.echoes = [];
  renderer.cancelCrew(t);
  if (g.cycle && g.cycle.index > 0) g.battle.order = null;
  g.cycle = null;
}

function handleRhythm(ev) {
  const g = game;
  if (ev.type === 'command') g.misses = 0;
  if (ev.type === 'phraseStart') {
    endSustain();
  } else if (ev.type === 'command' && g.mode === 'echo') {
    // No army answers here: the drum is free at once, and the answered dots
    // clear after a moment so the next call's ghost shows (see view()).
    g.reader.action = null;
    g.clearShownAt = songTime() + 0.8;
    for (const e of g.session.answer(ev, songTime())) handleMode(e);
  } else if (ev.type === 'command' && g.mode === 'casting') {
    // No pause between phrases: the next round can follow straight on.
    g.reader.action = null;
    g.reader.shown = null;
    for (const e of g.session.phrase(ev)) handleMode(e);
  } else if (ev.type === 'command') {
    const c = commandById(ev.command);
    // With the elephant, a strike on a waking drum is the charge; it spends the drum.
    const order = orderFor(g.battle, ev.command, ev.spirit);
    if (order === 'charge') g.reader.combo = 0;
    const power = commandPower(ev.accuracy, ev.spirit, TIER_POWER[ev.tier - 1]) * tempoFactor(ev.u);
    startCycle({ command: order, pattern: ev.pattern, tier: ev.tier, u: ev.u, start: ev.start, power, index: 0, spirit: ev.spirit });
    const name = order === 'charge' ? T.battle.elephantCharges : `${c.name} ${['', 'I', 'II', 'III'][ev.tier]}`;
    const pace = ev.u < 0.45 ? T.battle.paceQuick : ev.u < 0.8 ? T.battle.paceSteady : T.battle.paceSlow;
    feedback(txt(ev.even ? 'battle.commandEven' : 'battle.commandGood', { command: name, pace }), ev.even ? P.bronzeLight : P.paper);
    if (ev.spirit && ev.combo === SPIRIT_COMBO) {
      toast(T.battle.drumWakes);
      sound.play('drum-wake');
      renderer.wake(songTime());
      sound.play('cmd-rally', sound.now + 0.3, 0.7);
      sound.musicOverlay('mu-wake');
    }
    g.commandsDone += 1;
    g.tiersUsed.add(ev.tier);
    if (ev.command === 'march') lessonDone('march', T.lessons.praise.march);
    if (ev.command === 'march' && ev.tier >= 2) lessonDone('march2', T.lessons.praise.march2);
    if (ev.command === 'strike') lessonDone('strike', T.lessons.praise.strike);
  } else if (ev.type === 'reset') {
    // Three uneven tries in a row at a rhythm: play it again for them.
    if ((ev.reason === 'uneven' || ev.reason === 'timeout') && ev.strokes >= 2) {
      g.misses = (g.misses || 0) + 1;
      if (g.misses >= 3 && g.lastTry) {
        g.misses = 0;
        g.wantAgain = g.lastTry;
      }
    }
    if (ev.reason === 'manual' && !g.quietClear) confirm(T.battle.cleared, P.paperShade);
    if (ev.reason === 'no-pattern') sound.miss();
    // Training: a try that does not make the rhythm is told plainly.
    if (g.training && ev.reason !== 'manual' && (ev.strokes || 0) >= 1 && g.session.call) {
      trainingTally(g.session.call.n, false);
      const why = T.training.missReasons[ev.reason] || T.training.missReasons.other;
      confirm(txt('training.miss', { why }), P.lacquer);
    }
  } else if (ev.type === 'comboLost') {
    if (ev.combo > 1 && g.mode === 'battle') feedback(T.battle.chainBroken, P.paperShade);
  }
}

/** Echo and casting events: sounds, confirmations, the end of the chapter. */
function handleMode(e) {
  const g = game;
  const t = songTime();
  const stage = g.stage;
  switch (e.type) {
    case 'call': {
      // The caller's drum plays the rhythm; the reader will only accept that rhythm.
      g.reader.patterns = [e.call.pattern];
      g.reader.phrase = [];
      g.reader.shown = null;
      const voice = { mourning: 0.72, village: 1.08, festival: 1.18, elegy: 0.8 }[stage.caller] || 1;
      // Kept so an early answer can silence the rest of the call.
      g.callSources = e.call.strokes.map((s) => ({ at: g.clockStart + s.t, src: sound.echo(s.drum, g.clockStart + s.t, 0.75, voice) }));
      if (e.call.label) feedback(txt('answering.callerCalls', { caller: e.call.label }), P.paperShade);
      if (g.training) feedback(txt('training.listen', { n: e.call.n }), P.paperShade);
      break;
    }
    case 'yourTurn':
      feedback(T.answering.yourTurn, P.paper);
      break;
    case 'repeat':
      feedback(T.answering.again, P.paperShade);
      break;
    case 'offTempo':
      feedback(e.faster ? T.answering.tooFast : T.answering.tooSlow, P.lacquer);
      g.reader.action = null;
      g.reader.shown = null;
      break;
    case 'answered': {
      if (e.early && g.callSources) {
        // The player answered during the call: the caller falls silent.
        for (const c of g.callSources) {
          if (c.src && c.at > sound.now + 0.02) {
            try {
              c.src.stop();
            } catch {
              /* already finished */
            }
          }
        }
      }
      if (g.training) {
        trainingTally(e.call.n, true);
        confirm(txt('training.wellPlayed', { n: e.call.n, even: Math.round(e.accuracy * 100) }), P.bronzeLight);
        sound.play('lantern', sound.now + 0.1, 0.6);
        break;
      }
      const words = { mourning: T.answering.answered.mourning, village: txt('answering.answered.village', { caller: e.call.label || T.answering.theVillage }), festival: T.answering.answered.festival, elegy: T.answering.answered.elegy };
      confirm(words[stage.caller] || T.answering.answered.other, P.bronzeLight);
      if (stage.caller === 'festival') sound.play('crowd-cheer', sound.now + 0.2, 0.8);
      else if (stage.caller === 'village') {
        // The village comes to life: its gong and voices over the water, its house ablaze.
        sound.play('lantern', sound.now + 0.05, 0.8);
        sound.play('village-wakes', sound.now + 0.25, 0.9);
        renderer.villageWakes(e.index, t + 0.25);
      } else if (stage.caller !== 'elegy') sound.play('lantern', sound.now + 0.1, 0.8);
      break;
    }
    case 'crack':
      confirm(e.faster ? T.casting.rushing : e.slower ? T.casting.dragging : T.casting.spills, P.lacquer);
      sound.play('crack');
      g.crackAt = t;
      break;
    case 'cast':
      toast(txt('casting.drumIsCast', { n: e.drum + 1 }));
      confirm(txt('casting.drumCast', { n: e.drum + 1 }), P.bronzeLight);
      sound.play('pour', sound.now, 0.8);
      g.castAt = { ...(g.castAt || {}), [e.drum]: t };
      sound.play('drum-wake', sound.now + 0.3, 0.6);
      renderer.wake(songTime() + 0.3, 'hud');
      break;
    case 'complete':
      if (g.training) {
        // The end of the level: round again from its first rhythm.
        toast(txt('training.levelDone', { level: g.training.level, name: LEVELS[g.training.level - 1].name }));
        trainingSelect(g.training.level, 0, 1.6);
        break;
      }
      g.evenness = e.evenness;
      finish('won');
      break;
  }
}

/** How each drum is shown in hints for the device in use, as rich-text tokens. */
function strokeKeys() {
  return {
    keyboard: { L: '⟨k:F⟩', R: '⟨k:J⟩' },
    gamepad: { L: '⟨X⟩', R: '⟨B⟩' },
    pointer: { L: '⟨d:L⟩', R: '⟨d:R⟩' },
    touch: { L: '⟨d:L⟩', R: '⟨d:R⟩' },
  }[input.device] || { L: '⟨k:F⟩', R: '⟨k:J⟩' };
}

/** A rhythm ("L RR L R") as tokens: beats apart, strokes sharing a beat together. */
function rhythmTokens(text) {
  const keys = strokeKeys();
  // A silent slot ('.') shows as a rest mark (⟨r⟩), in its place in the beat.
  return text.split(' ').map((beat) => [...beat].map((d) => (d === '.' ? '⟨r⟩' : keys[d])).join('')).join(' ');
}

// ---------------------------------------------------------------- demonstrations
// The first time a rhythm is shown, and again when the player keeps missing
// it, the game plays it: the hint becomes the rhythm alone, a pointer moves
// along its buttons and each one lights as its stroke sounds. Twice through
// at a steady tempo, then the player's turn. Drumming cuts it short.

const DEMO_REPS = 2;
// Repeating rhythms (the casting guide, the practice loop) are scheduled this
// far ahead on the audio clock, so a slow frame or two cannot make them late.
const LOOKAHEAD = 0.6;
// Rhythms already demonstrated (kept between visits; load() merges objects, so read the list directly).
const seenDemos = new Set((() => {
  try {
    const v = JSON.parse(localStorage.getItem(`${STORE}.demos`) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
})());

function startDemo(item, { again = false, u = 0.55 } = {}) {
  const g = game;
  const strokes = parsePattern(item.text);
  const prefix = txt(again ? 'demonstration.listenAgain' : 'demonstration.listen', { rhythm: item.label });
  g.demo = { text: prefix + rhythmTokens(item.text), patternText: item.text, tokenStart: 0, strokes, u, start: songTime() + 0.5, reps: DEMO_REPS, key: item.key, sources: [], beats: beatsOf(item.text) };
  // Every stroke is scheduled on the audio clock now, so a slow frame cannot
  // delay one: the pointer follows the same clock (heardTime) and stays on it.
  for (let rep = 0; rep < DEMO_REPS; rep++) {
    for (const s of strokes) {
      const when = g.clockStart + g.demo.start + (rep * (g.demo.beats + 1) + s.pos) * u;
      g.demo.sources.push(s.drum === 'L' ? sound.tung(when) : sound.cac(when));
    }
  }
  if (!seenDemos.has(item.key)) {
    seenDemos.add(item.key);
    save('demos', [...seenDemos]);
  }
}

/** End the demonstration once it has played through. */
function tickDemo() {
  const g = game;
  const d = g.demo;
  if (d && songTime() > d.start + (d.reps * (d.beats + 1) - 1) * d.u + 0.4) g.demo = null;
}

/** Cut a demonstration short (the player drums, or leaves): silence the strokes still to come. */
function stopDemo() {
  const d = game && game.demo;
  if (!d) return;
  for (const src of d.sources) {
    try {
      if (src) src.stop();
    } catch {
      /* already played */
    }
  }
  game.demo = null;
}

/**
 * The casting guide: the foundry's drum plays the hammer rhythm, round after
 * round, at the pace the player must hold, softly and a little deeper than
 * the sisters' drum. It rests while a demonstration plays.
 */
function tickGuide() {
  const g = game;
  const d = g.guide;
  if (!d || g.ended || (g.session && g.session.done)) return;
  const t = songTime();
  const n = d.strokes.length;
  while (true) {
    const round = Math.floor(d.next / n);
    const s = d.strokes[d.next % n];
    const at = d.start + (round * beatsOf(g.rhythm) + s.pos) * d.u;
    if (at - t > LOOKAHEAD) break;
    if (at >= t - 0.05 && !g.demo) sound.echo(s.drum, g.clockStart + Math.max(at, t), 0.32, 0.82);
    d.next += 1;
  }
}

function hint(view) {
  const g = game;
  const t = view.songTime;
  g.mentioned = [];
  if (t < g.introUntil && g.stage.id !== 'garden') return g.stage.goal.split('. ')[0].replace(/\.?$/, '.');
  // A demonstration under way replaces the hint (see startDemo).
  if (g.demo) return g.demo.text;
  if (!settings.hints) return null;
  const keys = strokeKeys();
  const touch = input.device === 'touch';
  // Every rhythm a hint shows is noted, so the first time one appears the
  // game can demonstrate it (view()).
  const say = (id, tier = 1) => {
    const c = commandById(id);
    const label = `${c.name}${tier > 1 ? ' ' + ['', 'I', 'II', 'III'][tier] : ''}`;
    // Keyed by the rhythm itself, so a changed rhythm is demonstrated afresh.
    g.mentioned.push({ key: `${id}:${c.tiers[tier - 1]}`, text: c.tiers[tier - 1], label });
    return `${label}: ${rhythmTokens(c.tiers[tier - 1])}`;
  };
  const b = g.battle;
  const front = blocker(b);
  const near = front && front.x - b.army.x <= 4.6;
  if (g.mode === 'echo') {
    const sess = g.session;
    if (sess.phase === 'calling' && sess.index === 0) return T.hints.listenToCall;
    if (sess.phase === 'answer' && sess.index === 0) {
      return touch ? T.hints.answerTouch : txt('hints.answerKeys', { deepKey: keys.L, rimKey: keys.R });
    }
    return null;
  }
  if (g.mode === 'casting') {
    const sess = g.session;
    if (sess.cast === 0 && sess.level === 0) {
      g.mentioned = [{ key: `cast:${g.rhythm}`, text: g.rhythm, label: T.casting.hammerRhythm }];
      return txt('hints.drumWithBellows', { rhythm: rhythmTokens(g.rhythm) });
    }
    return T.hints.keepBellowsPace;
  }
  if (g.stage.id === 'mavien' && view.songTime < 20) return T.hints.holdTheFord;
  if (g.lessons) {
    // The garden's lessons, one at a time (lessonNow).
    const guardKey = T.hints.guardKeyLessons[input.device] || T.hints.guardKeyLessons.keyboard;
    switch (lessonNow()) {
      case 'march':
        return txt(touch ? 'lessons.hints.marchTouch' : 'lessons.hints.march', { rhythm: say('march') });
      case 'block':
        return txt('lessons.hints.block', { key: guardKey });
      case 'march2':
        return txt('lessons.hints.march2', { rhythm: say('march', 2) });
      case 'strike':
        return near ? txt('hints.inReach', { rhythm: say('strike') }) : txt('lessons.hints.marchToTargets', { rhythm: say('march') });
      default:
        return near ? (g.tiersUsed.has(2) ? txt('hints.inReachOr', { rhythm: say('strike'), stronger: say('strike', 2) }) : txt('hints.inReach', { rhythm: say('strike') })) : txt('lessons.hints.marchToNextTarget', { rhythm: say('march') });
    }
  }
  const guardKey = T.hints.guardKey[input.device] || T.hints.guardKey.keyboard;
  if (g.index > 0 && (view.threats.length || view.incoming) && g.blocks < 3 && !view.shieldsUp) return txt('hints.attackComing', { key: guardKey });
  if (g.stage.id === 'outpost' && b.enemies.some((e) => e.alive && e.type === 'crossbow' && e.x - b.army.x <= 14) && g.commandsDone < 12) {
    return txt('hints.thirdTier', { rhythm: say('strike', 3) });
  }
  if (g.stage.id === 'luylau' && near && g.reader.spirit) return txt('hints.drumAwakeCharge', { rhythm: say('strike') });
  if (g.stage.id === 'luylau' && !g.reader.spirit && g.commandsDone < 6) return T.hints.chainToWake;
  return null;
}

function updatePlay(dt) {
  const g = game;
  if (g.mode === 'practice') return updatePractice(dt);
  if (g.opening) {
    // The scene as it stands, still: nothing advances until the player begins.
    if (!g.openingView) g.openingView = { ...view(), hint: null }; // the card says it
    renderer.draw(g.openingView, dt);
    return;
  }
  const t = songTime();
  // Note the phrase before the clock moves on: if it times out, a stroke that
  // comes just after was the late one (see strike).
  const held = g.reader.phrase.length ? { trying: g.reader.progress(), before: g.reader.phrase.slice() } : null;
  for (const ev of g.reader.update(t)) {
    if (ev.type === 'reset' && ev.reason === 'timeout' && held && held.trying) g.faded = { ...held, at: t };
    handleRhythm(ev);
  }
  tickDemo();
  tickGuide();
  if (g.mode === 'casting' && !g.ended) g.session.update(t, dt);
  if (g.mode === 'echo' && !g.ended) for (const e of g.session.update(t)) handleMode(e);
  // The Oath: holding A or Y stirs a breeze over the incense (drawn by the renderer).
  if (g.stage.caller === 'mourning') sound.setBreeze(input.held('guard') || input.held('reset') ? 0.7 : 0);
  if (g.mode !== 'battle') {
    // No battle in echo and casting chapters: just the scene.
    renderer.draw(view(), dt);
    return;
  }
  // The garden's last lesson: with the targets down, the children come
  // throwing stones (the chapter is held open until they have run off).
  if (g.lessons && !g.lessons.kids && g.battle.enemies.filter((e) => e.goal).every((e) => !e.alive)) {
    lessonDone('targets', T.lessons.praise.targets);
    g.lessons.kids = true;
    spawnChildren(g.battle, 16, 6.5);
    feedback(T.lessons.childrenCome, P.paperShade);
  }
  // Hold the line: new columns arrive.
  if (g.stage.waves) {
    for (const w of dueWaves(g.stage.waves, t, g.spawned)) {
      for (const e of w.enemies) spawnEnemy(g.battle, e.type, e.dx);
      sound.play('han-horn');
    }
  }
  // A sustained order rolls into its next cycle unless a new phrase began.
  const c = g.cycle;
  if (c && t >= c.start + 4 * c.u - 0.15 && !g.reader.phrase.length) {
    const keep = SUSTAIN[c.command];
    if (keep && c.index < SUSTAIN_CYCLES && !g.ended) {
      startCycle({ ...c, start: c.start + 4 * c.u, power: (c.index === 0 ? c.power * keep : c.power), index: c.index + 1 });
    } else if (t >= c.start + 4 * c.u) g.cycle = null;
  }
  const events = [];
  // The army on the player's beats.
  while (g.armyBeats.length && g.armyBeats[0].t <= t && !g.ended) {
    const beat = g.armyBeats.shift();
    if (beat.order) issueOrder(g.battle, beat.order.command, beat.order.power, beat.order.u, beat.order.tier);
    events.push(...stepArmy(g.battle, beat.t));
  }
  // The Han on their war drum.
  while (g.nextHan * g.hanBeat <= t && !g.ended && !g.battle.outcome) {
    events.push(...stepEnemies(g.battle, g.nextHan * g.hanBeat));
    g.nextHan += 1;
  }
  // Their blows land: deflected if the shield wall is up when they arrive.
  if (!g.ended) events.push(...resolveIncoming(g.battle, t));
  if (events.length) renderer.spawn(events, view());
  for (const ev of events) {
    battleSound(ev);
    if (ev.type === 'trample') input.rumble(300, 1);
    if (ev.type === 'marchHit') {
      feedback(T.battle.marchHit, P.bronzeLight);
      input.rumble(120, 0.7);
    }
    if (ev.type === 'wound') input.rumble(80, 0.4);
    if (ev.type === 'deflect' && ev.kind === 'children') {
      // The lesson in blocking: two stones blocked and the children give up.
      g.lessons.blocked += 1;
      if (g.lessons.blocked >= 2) {
        lessonDone('block', T.lessons.praise.block);
        dismissChildren(g.battle);
      } else confirm(T.lessons.blockedOnceMore, P.bronzeLight);
    } else if (ev.type === 'deflect') {
      g.blocks += 1;
      confirm(T.battle.defended, P.bronzeLight);
    }
    if (ev.type === 'wound' && ev.source !== undefined && g.battle.enemies.find((e) => e.id === ev.source)?.type === 'children') {
      g.coverUntil = t + 0.7; // the women throw up their arms against it
      feedback(T.lessons.stoneHit, P.lacquer);
    }
    // Both children gone off screen: the chapter can end.
    if (ev.type === 'childrenGone' && g.lessons && passed('block') && !g.battle.enemies.some((e) => e.type === 'children' && e.alive)) g.battle.hold = false;
    if (ev.type === 'outcome') finish(ev.outcome);
  }
  renderer.draw(view(), dt);
}

/** Effects for battle events: samples where loaded, synth otherwise. */
function battleSound(ev) {
  const b = game.battle;
  const enemy = (id) => b.enemies.find((e) => e.id === id);
  switch (ev.type) {
    case 'damage': {
      const straw = enemy(ev.target)?.type === 'target';
      if (!sound.play(straw ? 'hit-straw' : 'hit-paper', sound.now, ev.source === 'arrow' ? 0.6 : 1) && ev.source !== 'arrow') sound.clash();
      break;
    }
    case 'defeated':
      if (ev.enemy === 'fort') sound.play('fort-break');
      else if (ev.enemy !== 'target') sound.play('defeat-han');
      break;
    case 'volley':
      sound.play('volley');
      break;
    case 'launch':
      if (ev.kind === 'children') sound.play('volley', sound.now, 0.2);
      else if (ev.kind !== 'spear') sound.play('volley', sound.now, 0.6);
      break;
    case 'deflect':
      sound.play('blocked', sound.now, ev.kind === 'children' ? 0.6 : 1);
      break;
    case 'wound': {
      // A stone from the children only stings.
      if (enemy(ev.source)?.type === 'children') {
        sound.play('hit-paper', sound.now, 0.4);
        break;
      }
      sound.play(ev.kind === 'spear' ? 'hit-paper' : 'bolts', sound.now, 0.8);
      sound.play('wound', sound.now, 0.6);
      break;
    }
    case 'trample':
      if (!sound.play('trample')) sound.thud();
      break;
    case 'outcome':
      sound.stopAmbience();
      sound.play(ev.outcome === 'won' ? 'victory' : 'defeat');
      break;
  }
}

function view() {
  const g = game;
  if (g.mode === 'practice') return practiceView();
  const t = songTime();
  const r = g.reader;
  const c = g.cycle;
  if (g.clearShownAt && t >= g.clearShownAt) {
    r.shown = null;
    g.clearShownAt = null;
  }
  // The army's beat when it is answering; otherwise a slow idle sway.
  const beatFloat = c ? (t - c.start) / c.u : t / 0.8;
  let phraseView = null;
  let heron = -1;
  if (r.shown) {
    phraseView = { pattern: r.shown.pattern, filled: Infinity, done: true, sustain: false };
    // The rhythm played once more while the army acts: each dot pops as its
    // stroke sounds (heard time, so the pop meets the sound).
    if (c && c.index === 0 && c.pattern === r.shown.pattern) {
      const h = heardTime();
      let at = -1;
      c.pattern.strokes.forEach((st, i) => {
        if (h >= c.start + st.pos * c.u) at = i;
      });
      if (at >= 0) phraseView.pop = { i: at, k: Math.max(0, 1 - (h - (c.start + c.pattern.strokes[at].pos * c.u)) / 0.18) };
    }
  } else if (r.phrase.length) {
    const best = r.progress();
    if (best) {
      phraseView = { pattern: best.pattern, filled: r.phrase.length, done: false };
      heron = Math.floor(best.pattern.strokes[r.phrase.length - 1].pos);
    }
  }
  if (c && t >= c.start) heron = Math.floor(beatFloat) % 4;
  // Echo chapters: show the caller's rhythm as it is played, then wait for the answer.
  if (g.mode === 'echo' && g.session.call) {
    const call = g.session.call;
    if (g.session.phase === 'calling' && !r.phrase.length && !r.shown) {
      const played = call.strokes.filter((st) => st.t <= t).length;
      phraseView = { pattern: call.pattern, filled: played, done: false, caller: true };
      heron = played ? Math.floor(call.pattern.strokes[played - 1].pos) : -1;
    } else if (g.session.phase === 'answer' && !phraseView) {
      phraseView = { pattern: call.pattern, filled: 0, done: false };
    }
  }
  if (g.mode === 'casting' && !phraseView) phraseView = { pattern: g.reader.patterns[0], filled: 0, done: false };
  const v = {
    battle: g.battle,
    songTime: t,
    beatFloat,
    heron,
    phraseView,
    ready: !r.action && !r.phrase.length,
    shieldsUp: shieldsUp(g.battle, t),
    // The army's current cycle, so the animation can follow the drummed strokes.
    cycle: c && t >= c.start - 0.05 ? { start: c.start, u: c.u, command: c.command, strokes: c.pattern.strokes } : null,
    threats: aboutToAttack(g.battle),
    incoming: g.battle.incoming.length,
    guardAt: g.battle.guardAt,
    guardUntil: g.battle.guardUntil,
    coverUntil: g.coverUntil || 0,
    confirm: g.confirm,
    sustaining: !!(c && c.index > 0 && !r.phrase.length),
    inResponse: !!g.battle.order,
    responseCommand: g.battle.order ? g.battle.order.command : null,
    combo: r.combo,
    spirit: r.spirit,
    feedback: g.feedback,
    unlocked: g.stage.unlocked || [],
    maxTier: g.stage.maxTier || 3,
    beats: getBeatCount(),
    mode: g.mode,
    stage: g.stage,
    session: g.session,
    crackAt: g.crackAt,
    pouring: g.mode === 'casting' && g.session.lastStroke !== null && t - g.session.lastStroke < 0.6 && !g.session.done,
    guide: g.guide,
    castAt: g.castAt,
    touch: input.device === 'touch',
    // The Oath: A blows one way over the incense, Y the other, while held.
    wind: g.stage.caller === 'mourning' && screen === 'play' ? { a: input.held('guard'), y: input.held('reset') } : null,
  };
  v.hint = hint(v);
  // Start a demonstration when the drum is free: a rhythm shown for the first
  // time, or one the player keeps missing.
  const free = !g.demo && !r.phrase.length && !g.ended && screen === 'play' && t > 1.2;
  if (free && g.wantAgain) {
    const p = g.wantAgain;
    g.wantAgain = null;
    const c = commandById(p.command);
    const echoU = g.mode === 'echo' && g.session.call ? g.session.call.u : null;
    startDemo({ key: `again:${p.text}`, text: p.text, label: c ? `${c.name}${p.tier > 1 ? ' ' + ['', 'I', 'II', 'III'][p.tier] : ''}` : T.demonstration.theRhythm }, { again: true, u: echoU || 0.55 });
    v.hint = hint(v);
  } else if (free && settings.hints && g.mentioned && !r.action) {
    const item = g.mentioned.find((m) => !seenDemos.has(m.key));
    if (item) {
      startDemo(item, { u: g.mode === 'casting' && g.session.u ? g.session.u : 0.55 });
      v.hint = hint(v);
    }
  }
  v.demo = g.demo;
  if (g.mode === 'battle' && (g.lessons || g.demo || g.mentioned.length)) {
    const expected = g.demo
      ? [{ text: g.demo.patternText, strokes: g.demo.strokes }]
      : g.mentioned.map((m) => callPattern(m.text));
    v.phraseView = guidedPhrase(r, phraseView, expected);
  }
  v.heard = heardTime();
  v.success = !!g.success;
  v.miss = g.miss && t - g.miss.t < 1.1 ? g.miss : null;
  if (g.lessons) {
    const now = lessonNow();
    v.lessons = {
      list: LESSONS.map((l) => ({ name: l.name, done: g.lessons.done.has(l.id), current: l.id === now })),
      praise: g.lessons.praise && t - g.lessons.praise.t < 2.2 ? g.lessons.praise : null,
    };
  }
  if (g.training) {
    const tr = g.training;
    v.training = {
      levels: LEVELS,
      level: tr.level,
      entries: tr.entries,
      current: Math.min(g.session.index, tr.entries.length - 1),
      calling: g.session.phase === 'calling',
      tally: tr.tally,
      keys: trainingKeys(),
      touch: input.device === 'touch',
    };
    // The levels and the list say what to do: no other hint.
    if (t >= g.introUntil) v.hint = null;
  }
  return v;
}

/** Go on from the success moment: the next chapter, or the list after the last. */
function continueOn() {
  if (!game || !game.success) return;
  hideSuccess();
  sound.play('ui-confirm');
  if (game.index >= STAGES.length - 1) return action('select');
  startStage(game.index + 1);
}

function hideSuccess() {
  $('#success').classList.remove('show');
  $('#success').hidden = true;
}

function focusSuccess() {
  const b = $('#success-next');
  b.focus({ preventScroll: true });
  if (input.device === 'gamepad') b.classList.add('nav-focus');
}


function finish(outcome) {
  game.ended = true;
  const won = outcome === 'won';
  if (won && progress.unlocked < Math.min(STAGES.length, game.index + 2)) {
    progress.unlocked = Math.min(STAGES.length, game.index + 2);
    save('progress', progress);
  }
  if (won) {
    // A success moment in the scene itself, with one button to go on;
    // restart and the chapter list stay in the pause menu.
    setTimeout(() => {
      if (!game || screen !== 'play') return;
      const peaceful = game.mode !== 'battle';
      // The two queens crowned: their song, Trống Đồng Vang Dới Đất Trời (mu-anthem).
      const tune = { elegy: 'mu-ending', coronation: ['mu-anthem', 'mu-complete'] }[game.stage.id] || (peaceful ? 'mu-complete' : 'mu-victory');
      sound.playMusic(tune, { fade: 0.3 });
      sound.play('drum-wake', sound.now, 0.7);
      game.success = { t: songTime() };
      renderer.celebrate(game.stage, songTime());
      const even = game.evenness !== undefined ? txt('results.evenness', { even: Math.round(game.evenness * 100) }) : '';
      $('#success-title').textContent = T.chapters[game.stage.id].successTitle || T.results.chapterComplete;
      $('#success-text').textContent = T.chapters[game.stage.id].resultText + even;
      $('#success-next').querySelector('.label').textContent = game.index >= STAGES.length - 1 ? T.results.chapters : T.results.continue;
      $('#success').hidden = false;
      requestAnimationFrame(() => $('#success').classList.add('show'));
      focusSuccess();
    }, 900);
    return;
  }
  setTimeout(() => {
    if (!game || screen !== 'play') return;
    const peaceful = game.mode !== 'battle';
    sound.playMusic(!won ? 'mu-defeat' : game.stage.id === 'elegy' ? 'mu-ending' : peaceful ? 'mu-complete' : 'mu-victory', { fade: 0.3 });
    $('#result-title').textContent = won ? (peaceful ? T.results.chapterComplete : T.results.victory) : T.results.defeat;
    const even = game.evenness !== undefined ? txt('results.evenness', { even: Math.round(game.evenness * 100) }) : '';
    $('#result-text').textContent = won
      ? T.chapters[game.stage.id].resultText + even
      : T.results.defeatText;
    $('#result-next').hidden = !won || game.index >= STAGES.length - 1;
    show('result');
  }, 1600);
}

function pause(reason = '') {
  if ((screen !== 'play' && screen !== 'rotate') || !game || (game.ended && !game.success)) return;
  sound.suspend();
  sound.pauseMusic(true);
  $('#pause-reason').textContent = reason;
  $('#pause-chapter').innerHTML = '<span class="num"></span><span class="name"></span>';
  $('#pause-chapter .num').textContent = game.practice ? T.pause.drumPractice : txt('pause.chapterNumber', { n: game.index + 1 });
  $('#pause-chapter .name').textContent = game.stage.title;
  // In practice the chapter buttons lead back to the practice modes instead.
  $('#pause [data-action="restart"]').textContent = game.practice ? T.pause.startOver : T.pause.restartChapter;
  $('#pause [data-action="select"]').textContent = game.practice ? T.pause.practiceModes : T.pause.chapters;
  show('pause');
}

/**
 * A phone or tablet held upright mid-game: the game holds (as a pause does)
 * behind a screen of its own asking for the device to be turned, and carries
 * on by itself once it is (frame()). Its Menu button opens the pause menu.
 */
function holdForRotation() {
  if (!game || (game.ended && !game.success)) return;
  sound.suspend();
  sound.pauseMusic(true);
  show('rotate');
}

function resume() {
  sound.resume();
  sound.pauseMusic(false);
  show('play');
}

// ---------------------------------------------------------------- the garden's lessons
// The first chapter teaches as it goes: one lesson at a time in the hint, a
// list of them at the top left, and each one ticked off with a word of praise
// the moment it is done. The lesson in blocking brings village children who
// throw stones until two are blocked; then they run off.

const LESSONS = [
  { id: 'march', name: T.lessons.names.march },
  { id: 'march2', name: T.lessons.names.march2 },
  { id: 'strike', name: T.lessons.names.strike },
  { id: 'targets', name: T.lessons.names.targets },
  { id: 'block', name: T.lessons.names.block },
];

/** The lesson to teach now: the block while the children are here, else the first not yet done. */
function lessonNow() {
  const L = game.lessons;
  if (L.kids && !passed('block')) return 'block';
  const next = LESSONS.find((l) => !L.done.has(l.id));
  return next ? next.id : null;
}

/** Whether the garden lesson `id` is done. */
function passed(id) {
  return game.lessons.done.has(id);
}

/** A lesson done: ticked off, with praise and a chime. Once only. */
function lessonDone(id, praise) {
  const g = game;
  if (!g.lessons || g.lessons.done.has(id)) return;
  // Blocking is learnt from the children: it counts only once they are here.
  if (id === 'block' && !g.lessons.kids) return;
  g.lessons.done.add(id);
  g.lessons.praise = { text: praise, t: songTime() };
  sound.play('ui-confirm', sound.now, 0.9);
  sound.play('lantern', sound.now + 0.08, 0.5);
}

// ---------------------------------------------------------------- training
// Drum Practice's Training: the chapters' rhythms (training.js), level by
// level, each called and answered as in an answering chapter. ◀ ▶ choose the
// level, ▲ ▼ the rhythm (or taps and clicks on the tabs and the list); A
// plays the rhythm again. A rhythm answered leads on to the next.

const TRAINING_STAGE = {
  id: 'training',
  mode: 'echo',
  title: T.training.title,
  subtitle: T.training.subtitle,
  goal: T.training.goal,
  caller: 'training',
  calls: [],
  asDesigned: true,
  matchTempo: false,
  troops: 0,
  elephant: false,
  sky: 'dusk',
  ambience: 'amb-practice',
  bpm: 84,
  enemies: [],
};
let trainingAt = { level: 1, index: 0 }; // where Training was left, for Start over

function startTraining(level = trainingAt.level, index = trainingAt.index) {
  startStage(-1, { ...TRAINING_STAGE });
  game.practice = 'training';
  game.training = { level, entries: [], all: catalogue(), tally: {} };
  game.introUntil = 0; // the levels and the list explain themselves
  input.training = true;
  // A click on the tabs or the list chooses; anywhere else it drums.
  input.pointerPick = (x, y) => {
    const pick = renderer.trainingTarget(x, y, game && game.training);
    if (!pick) return false;
    act(pick);
    return true;
  };
  trainingSelect(level, index, 2.2);
}

/** Train on a level, from one of its rhythms: the caller starts on it after `delay` seconds. */
function trainingSelect(level, index = 0, delay = 0.6) {
  const g = game;
  const tr = g.training;
  const entries = levelRhythms(level, tr.all);
  tr.level = level;
  tr.entries = entries;
  index = Math.max(0, Math.min(entries.length - 1, index));
  trainingAt = { level, index };
  // Whatever the old caller was still playing stops.
  for (const c of g.callSources || []) {
    if (c.src && c.at > sound.now + 0.02) {
      try {
        c.src.stop();
      } catch {
        /* already finished */
      }
    }
  }
  g.callSources = [];
  g.stage.calls = entries.map((e) => ({ text: e.text, bpm: e.bpm, n: e.n }));
  g.session = new EchoSession({ calls: g.stage.calls, matchTempo: false, pause: 0.6 });
  g.session.index = index;
  g.session.nextCallAt = songTime() + delay;
  g.reader.patterns = [];
  g.reader.phrase = [];
  g.reader.shown = null;
  g.reader.action = null;
}

/** Training's choices; true when the action was one of them. */
function trainingAct(action) {
  const g = game;
  const tr = g.training;
  const n = LEVELS.length;
  const pick = /^(level|rhythm):(\d+)$/.exec(action);
  if (action === 'levelPrev' || action === 'levelNext') {
    sound.play('ui-move');
    trainingSelect(((tr.level - 1 + (action === 'levelNext' ? 1 : n - 1)) % n) + 1, 0);
  } else if (action === 'rhythmPrev' || action === 'rhythmNext') {
    const m = tr.entries.length;
    sound.play('ui-move');
    trainingSelect(tr.level, (g.session.index + (action === 'rhythmNext' ? 1 : m - 1)) % m);
  } else if (pick) {
    sound.play('ui-move');
    if (pick[1] === 'level') trainingSelect(Number(pick[2]), 0);
    else trainingSelect(tr.level, Number(pick[2]));
  } else if (action === 'guard' || action === 'reset') {
    // A: hear the rhythm again.
    sound.play('drum-mo', sound.now, 0.6);
    renderer.kick('mo', songTime());
    trainingSelect(tr.level, g.session.index, 0.3);
  } else return false;
  return true;
}

/** How Training's controls are shown for the device in use, as rich-text tokens. */
function trainingKeys() {
  return {
    gamepad: T.training.controls.gamepad,
    touch: T.training.controls.touch,
    pointer: T.training.controls.pointer,
  }[input.device] || T.training.controls.keyboard;
}

/** Count a success or a miss at a rhythm, for its row in the list. */
function trainingTally(n, ok) {
  const t = game.training.tally;
  const e = t[n] || (t[n] = { ok: 0, miss: 0, at: -9 });
  const now = songTime();
  if (ok) e.ok += 1;
  // One try is one miss, however many strokes in it go astray.
  else if (now - e.at > 1) e.miss += 1;
  if (!ok) e.at = now;
}

// ---------------------------------------------------------------- drum practice
// In practice-play.js; it reads and replaces the current game through ctx.game.

const { openPractice, startPractice, stopPractice, practiceStrike, practiceAct, updatePractice, practiceView } = createPractice({
  get game() {
    return game;
  },
  set game(g) {
    game = g;
  },
  get screen() {
    return screen;
  },
  $,
  art,
  sound,
  renderer,
  input,
  settings,
  save,
  practiceSettings,
  songTime,
  hitTime,
  heardTime,
  confirm,
  feedback,
  show,
  enterFullscreen,
  hideSuccess,
  strokeKeys,
  LOOKAHEAD,
  startTraining: (...a) => startTraining(...a),
});

// ---------------------------------------------------------------- actions

function action(name) {
  switch (name) {
    case 'resume':
      return resume();
    case 'menu':
      return pause();
    case 'restart':
      sound.resume();
      if (game.practice === 'training') return startTraining();
      if (game.practice) return startPractice(game.practice);
      return startStage(game.index, null, { opening: false });
    case 'next':
      return startStage(game.index + 1);
    case 'select':
      // From the pause menu the audio clock is suspended; wake it for the select music.
      sound.resume();
      sound.stopAmbience();
      if (game && game.practice) {
        stopPractice();
        input.training = false;
        input.pointerPick = null;
        game = null;
        return show('practice');
      }
      game = null;
      buildCards();
      return show('select');
    case 'title':
      sound.resume();
      sound.stopAmbience();
      if (game && game.practice) stopPractice();
      input.training = false;
      input.pointerPick = null;
      game = null;
      titleNav = false;
      return show('title');
    case 'practice':
      return openPractice();
    case 'practice-free':
      return startPractice('free');
    case 'practice-call':
      return startPractice('call');
    case 'fullscreen':
      return toggleFullscreen();
    case 'sound':
      settings.muted = !settings.muted;
      return applySettings();
    case 'close':
      return closeDialog();
  }
}

function pressStart() {
  sound.start();
  sound.loadSamples().then(() => {
    sound.play('ui-start');
    if (screen === 'select') sound.menuMusic();
  });
  enterFullscreen();
  buildCards();
  show('select');
}

// The opening card: a click anywhere on it begins the chapter.
$('#opening').addEventListener('click', (e) => {
  e.stopPropagation();
  beginChapter();
});
$('#success-next').addEventListener('click', (e) => {
  e.stopPropagation();
  continueOn();
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn && btn.id !== 'press-start' && btn.dataset.action !== 'close') sound.play('ui-confirm');
  const el = e.target.closest('[data-action],[data-open]');
  if (!el) return;
  if (el.dataset.open) openDialog(el.dataset.open);
  else action(el.dataset.action);
});
$('#press-start').addEventListener('click', pressStart);
// A click outside a menu's panel (on the dimmed backdrop) is "back", like B:
// it closes a dialog, or leaves the pause menu for the game. Only a click
// that both starts and ends on the backdrop counts, so a drag out of the
// panel does not.
let backdropDown = null;
document.addEventListener('pointerdown', (e) => {
  backdropDown = e.target.classList && e.target.classList.contains('modal') ? e.target : null;
});
document.addEventListener('click', (e) => {
  const el = e.target;
  if (!backdropDown || el !== backdropDown) return;
  backdropDown = null;
  if (el.classList.contains('dialog')) {
    if (dialogs.length && dialogs[dialogs.length - 1] === el.id) closeDialog();
  } else if (el.id === 'pause' && screen === 'pause' && !dialogs.length) resume();
});
// A setting's (i): a tap shows or hides its tip (hover does on a mouse); it never changes the setting.
document.addEventListener('click', (e) => {
  const tip = e.target.closest && e.target.closest('.info');
  for (const other of document.querySelectorAll('.info.open')) if (other !== tip) other.classList.remove('open');
  if (!tip) return;
  e.preventDefault();
  tip.classList.toggle('open');
});
for (const el of document.querySelectorAll('[data-setting]')) {
  const ev = el.type === 'checkbox' ? 'change' : 'input';
  el.addEventListener(ev, () => {
    settings[el.dataset.setting] = el.type === 'checkbox' ? el.checked : Number(el.value);
    applySettings();
  });
}

input.on('nav', (dir) => {
  if (dialogs.length) {
    if (dir === 'back') return closeDialog();
    if (dir === 'confirm') return activate(document.activeElement);
    if (dir === 'menu') return;
    return move(dir);
  }
  if (screen === 'play') {
    if (dir === 'menu') pause();
    return;
  }
  if (screen === 'pause' && (dir === 'menu' || dir === 'back')) return resume();
  if (screen === 'rotate' && (dir === 'menu' || dir === 'back')) return pause();
  if (screen === 'title') {
    if (input.device === 'gamepad' && !titleNav) return; // handled by padButton: any button starts
    if (dir === 'menu') return pressStart();
    if (dir === 'confirm') return activate(document.activeElement || $('#press-start'));
    return move(dir);
  }
  if ((screen === 'select' || screen === 'practice') && dir === 'back') return action('title');
  if (dir === 'confirm') return activate(document.activeElement);
  if (dir === 'menu') return;
  move(dir);
});

input.on('padButton', (i) => {
  if (screen !== 'title' || titleNav || dialogs.length) return;
  // The d-pad moves between Press Start and Drum Practice; any other button starts.
  if (i >= PAD.UP && i <= PAD.RIGHT) {
    titleNav = true;
    return;
  }
  pressStart();
});
input.on('stick', () => {
  if (screen === 'title' && !titleNav && !dialogs.length) titleNav = true;
});
input.on('device', (d) => {
  if (d.type === 'disconnected' && screen === 'play') pause(T.messages.controllerDisconnected);
  if (d.type === 'connected') toast(T.messages.controllerConnected);
  if (d.type === 'switch') {
    const f = document.activeElement;
    if (d.device === 'gamepad' && f && f !== document.body) f.classList.add('nav-focus');
    if (d.device !== 'gamepad') for (const n of document.querySelectorAll('.nav-focus')) n.classList.remove('nav-focus');
  }
});
// The game goes quiet whenever its tab or window is in the background, and a
// chapter in play pauses.
function background(away) {
  sound.setFocused(!away);
  if (away) pause();
}
document.addEventListener('visibilitychange', () => background(document.hidden));
window.addEventListener('blur', () => background(true));
window.addEventListener('focus', () => background(document.hidden));

// ---------------------------------------------------------------- loop

const portraitTouch = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
let last = performance.now();
// Adaptive sharpness: a late frame shows every stroke late, so when play runs
// below about 50 fps (the median frame over two seconds above 20 ms) the canvas drops
// half a step of pixel ratio, down to 1, until the frame rate holds.
const frameTimes = [];
function watchFrameRate(ms) {
  if (!renderer.autoResolution || screen !== 'play' || dialogs.length || document.hidden || ms > 200) return;
  frameTimes.push(ms);
  if (frameTimes.reduce((a, b) => a + b, 0) < 2000 || frameTimes.length < 20) return;
  const median = [...frameTimes].sort((a, b) => a - b)[frameTimes.length >> 1];
  frameTimes.length = 0;
  const dpr = renderer.pixel / renderer.cssScale;
  if (median > 20 && dpr > 1.01) {
    renderer.dprCap = Math.max(1, dpr - 0.5);
    renderer.resize();
    console.info(`Bronze Drum: frames take ${median.toFixed(1)} ms; drawing at pixel ratio ${renderer.dprCap} to keep up`);
  }
}
function frame(now) {
  watchFrameRate(now - last);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  input.poll();
  // A phone or tablet held upright: the drum and the field need the width.
  if (screen === 'play' && !dialogs.length && portraitTouch.matches) holdForRotation();
  else if (screen === 'rotate' && !portraitTouch.matches) resume();
  if (game && screen === 'play') updatePlay(dt);
  requestAnimationFrame(frame);
}

async function boot() {
  // The canvas follows the visible viewport, not 100vh (src/fit.js); the
  // renderer matches its pixels to the new size, then the paused scene redraws.
  createFit({
    app: $('#app'),
    stage: canvas,
    onChange: () => {
      renderer.resize();
      redrawPaused();
    },
  });
  applySettings();
  if (coarsePointer.matches) {
    $('#title-hint').textContent = chrome.scrollTrick || window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches
      ? T.title.hintSideways
      : T.title.hintSidewaysAddToHome;
  }
  buildCommandTable();
  // The title is usable at once: on a slow connection the player may press
  // start before the art has arrived, so loading must not send them back.
  show('title');
  requestAnimationFrame(frame);
  revealTitle();
  await art.load();
  applyStyleArt();
}

/**
 * The title appears once, whole: it stays hidden (html.booting) until the
 * fonts and the logo picture are ready, then fades in, so the page does not
 * show empty buttons, then a text logo in a stand-in font, then the picture.
 * On a slow connection it shows after 2.5 s with whatever has arrived; the
 * text logo then stays (no late swap).
 */
async function revealTitle() {
  const img = $('#logo-img');
  const logo = img.decode().then(() => true, () => false);
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : null;
  const late = new Promise((resolve) => setTimeout(() => resolve('late'), 2500));
  const ready = await Promise.race([Promise.all([logo, fonts]), late]);
  if (ready !== 'late' && ready[0]) {
    img.alt = T.game.name;
    img.hidden = false;
    $('#logo-text').classList.add('visually-hidden');
  }
  document.documentElement.classList.remove('booting');
}

/** The art in the page itself (the panels and the cards), in the current style. */
function applyStyleArt() {
  // Dialogs are cut from the delivered paper sheet (BD-U04) when it is here.
  const sheet = art.get('ui-panel');
  if (sheet) document.documentElement.style.setProperty('--panel-art', `url("${sheet.src}")`);
  document.body.classList.toggle('paper-panels', !!sheet);
  // Cards built before the art arrived (or in the other style) get their pictures now.
  document.querySelectorAll('#stage-cards .card-art').forEach((el, i) => {
    const img = art.get(`card-${STAGES[i].id}`);
    el.classList.toggle('plain', !img);
    el.style.backgroundImage = img ? `url(${img.src})` : '';
  });
}

// Debug hooks for automated checks.
window.__bronzeDrum = { get game() { return game; }, renderer, sound, input, startStage, begin: () => beginChapter(), startPractice, finish, STAGES, songTime: () => (game ? songTime() : null), threats: () => (game ? aboutToAttack(game.battle) : []) };

boot();
