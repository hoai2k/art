import { LEGACY, TITLE, STORAGE_PREFIX, applyDocumentTheme } from '../src/theme.js';
applyDocumentTheme();
// Widow's Bay cutscene workbench: every cinematic in one big viewer, with
// play, pause, speed, frame stepping and a deterministic scrub. Uses the
// game's own acts and renderer exactly as src/main.js does. See README.md.
import { ACTS } from '../src/acts/index.js';
import { createRenderer, loadAssets } from '../src/art.js';
import { createAudio } from '../src/audio.js';
import { beatHit } from '../src/acts/shared.js';
import { animationDuration } from '../src/animation.js';
import * as A2 from '../src/acts/act2.js';
import * as A3 from '../src/acts/act3.js';
import * as A5 from '../src/acts/act5.js';

const DT = 1 / 60;          // fixed simulation step
const SEED = 7;             // fixed seed, so every run and scrub is the same
const SONG = { bpm: 76.5, offset: 0.33 };
const beatAt = (t) => (t * SONG.bpm) / 60 + SONG.offset;
const $ = (s) => document.querySelector(s);

// ---------------------------------------------------------------- scenes
// Each scene: { id, title, act (index into ACTS, or null), note, create(),
// input({ t, f, st, at, beat, opts }), end(st, t), max (seconds), opts }.
// create() builds the act state; input() is the scripted player; end() says
// when the cinematic is over (the act's `won` always ends it too).
const act = (n) => ACTS[n - 1];
const mk = (n, { carry = {}, from = null } = {}) => act(n).create({ seed: SEED, carry, from });

const ENDINGS = [
  ['witch', 'the sea witch', { rose: true }, "She carries the rose: the Sea Witch's ending (her moon boat claims him)."],
  ['lamp', 'a lamp in the window', { pearl: true }, 'She carries the pearl: the lamp-in-the-window ending.'],
  ['dark', 'the dark window', {}, 'She carries neither: the dark-window ending.'],
];
const PAGEANTS = [
  ['plain', 'no guitar, no sleepers', {}],
  ['guitar', 'with the guitar', { guitar: true }],
  ['full', 'with the guitar and 8 sleepers', { guitar: true, sleepers: 8 }],
];

const SCENES = [
  {
    id: 'act1-ending', act: 1, title: 'Act I · Land ho to the wreck', max: 60, opts: ['lanterns'],
    note: 'Start of the voyage at 99.5%: land ho, the celebration on deck, the witch\'s turn, the wreck, the guitar sinking and the iris. During the party the scripted player presses A on the beats so the lanterns light (untick "Light the lanterns" to see the party unlit).',
    create: () => mk(1, { from: { scene: 3, progress: 0.995 } }),
    input: ({ st, beat, opts }) => ({ a: !!opts.lanterns && st.phase === 'party' && beatHit(beat, 0.08) != null }),
    end: (st) => st.status === 'won',
  },
  {
    id: 'act1-turn', act: 1, title: "Act I · The witch's turn and the wreck", max: 40,
    note: "Act I scene 5, \"The Witch's Turn\": the witch strikes the mast, the ship breaks, the guitar sinks, the iris.",
    create: () => mk(1, { from: { scene: 5 } }),
    input: () => ({}),
    end: (st) => st.status === 'won',
  },
  {
    id: 'act2-open', act: 2, title: 'Act II · The opening', max: 12,
    note: "Scene 0, phase open: the sleepers on the wreck shelf, the dragon passing, the witch's breath and the sailor waking. Ends when the phase becomes swim.",
    create: () => mk(2),
    input: () => ({}),
    end: (st) => st.phase === 'swim',
  },
  ...[['take', 'taking the rose', 'a'], ['refuse', 'refusing', 'b']].map(([k, label, key]) => ({
    id: 'act2-offer-' + k, act: 2, title: `Act II · The witch's offer, ${label}`, max: 20,
    note: `Scene 4: the witch comes down and offers the sea rose. At 2.5 s the scripted player presses ${key.toUpperCase()}; the scene runs through the choice and five seconds into the moon-boat ride.`,
    create: () => mk(2, { from: { scene: 4 } }),
    input: ({ at }) => (at(2.5) ? { [key]: true } : {}),
    end: (st) => st.phase === 'ride' && st.phaseT >= 5,
  })),
  ...['refuse', 'take'].map((choice) => ({
    id: 'act2-ride-' + choice, act: 2, title: `Act II · The moon-boat ride (${choice === 'take' ? 'rose taken' : 'rose refused'})`, max: 40,
    note: `Scene 5 (${choice === 'take' ? 'the sleepers have risen' : 'the rose refused'}): the whole ride and the iris. A small autopilot changes row for the pearls and leaps for the high ones.`,
    create: () => mk(2, { from: { scene: 5, choice } }),
    input: ({ st }) => {
      const r = st.ride;
      if (!r || st.phase !== 'ride') return {};
      const next = r.pearls.find((p) => !p.got && A2.ridePearlX(p, st.phaseT) > r.x - 50);
      if (!next) return {};
      const dx = A2.ridePearlX(next, st.phaseT) - r.x;
      const a = next.high && next.row === r.row && dx > 90 && dx < 130;
      if (r.rowT < 1 || next.row === r.row) return { a };
      return next.row < r.row ? { up: true, a } : { down: true, a };
    },
    end: (st) => st.status === 'won',
  })),
  {
    id: 'act3-whale', act: 3, title: 'Act III · The whale swallows the court', max: 12,
    note: 'Direct state setup: the sailor is put 180 px short of the pedestal with the whale 0 s into its pass; he walks up to the pedestal under the whale and takes the pearl: take, turn, lunge, iris. Lanterns and grace are topped up.',
    create: () => {
      const st = mk(3, { from: { scene: 3 } });
      const { PEDESTAL, camFor } = A3;
      Object.assign(st.p, { x: PEDESTAL.x - 180, row: PEDESTAL.row, from: PEDESTAL.row, rowT: 1, grace: 999 });
      if (camFor) st.cam = camFor(PEDESTAL.x);
      st.whale.t = 0; st.whale.passes = 1; st.whale.warned = true;
      st.events.push({ type: 'whalePass' });
      return st;
    },
    input: ({ st }) => ({ moveX: st.phase === 'play' && st.whale.t >= 0.6 ? 1 : 0 }),
    end: (st) => st.status === 'won',
  },
  ...[[8, 'with 8 woken sleepers'], [0, 'with none woken']].map(([n, label]) => ({
    id: 'act4-shore-' + n, act: 4, title: `Act IV · Out of the whale, onto the shore (${label})`, max: 40,
    note: `Direct state setup: the sailor is put on the lip just short of the throat (x 5950, past it is THROAT.enterX), grace topped up, camera snapped; he walks right, then the throat, the beached whale${n ? ', the revellers coming out' : ''}, the slide, the tail and the iris play.`,
    create: () => {
      const st = mk(4, { carry: { sleepers: n } });
      const lip = st.ledges.find((l) => l.id === 'lip');
      Object.assign(st.s, { x: 5950, y: lip.y, on: 'lip', safe: 'lip', onT: 1, vx: 0, vy: 0 });
      st.best = 5950; st.grace = 9999;
      st.cam.x = 5950 - 560; st.cam.y = Math.max(-860, Math.min(0, Math.min(lip.y, 440) - 300));
      return st;
    },
    input: ({ st }) => ({ moveX: st.phase === 'climb' ? 1 : 0 }),
    end: (st) => st.status === 'won',
  })),
  {
    id: 'act5-storm', act: 5, title: 'Act V · The storm strikes the house', max: 14,
    note: 'Direct state setup: a cliff-climb state with the climber put on the top hold and the phase set to storm (as stepCliff does on arrival), the camera at its highest climb position. The lightning, fire and the house swinging open play; it ends 1.5 s into the burning house.',
    create: () => {
      const st = mk(5, { from: { scene: 1 } });
      const i = st.holds.findIndex((h) => h.kind === 'top');
      st.cl = { at: i, from: i, moveT: 0, moveDur: 0, kind: null, crumbleT: 0 };
      st.walkFromX = st.holds[i].x;
      st.camY = A5.CLIFF.camMax; st.cam0 = st.camY;
      st.rocks.length = 0;
      st.phase = 'storm'; st.phaseT = 0;
      st.events.push({ type: 'clifftop' });
      return st;
    },
    input: () => ({}),
    end: (st) => st.phase === 'house' && st.phaseT >= 1.5,
  },
  ...ENDINGS.map(([k, label, carry, note]) => ({
    id: 'act5-ending-' + k, act: 5, title: `Act V · The ending: ${label}`, max: 30,
    note: `Scene 5 with carry ${JSON.stringify(carry)}. ${note} Runs until 3 s into the pageant.`,
    create: () => mk(5, { carry, from: { scene: 5 } }),
    input: () => ({}),
    end: (st) => st.phase === 'pageant' && st.phaseT >= 3,
  })),
  ...PAGEANTS.map(([k, label, carry]) => ({
    id: 'act5-pageant-' + k, act: 5, title: `Act V · The pageant (${label})`, max: 30,
    note: `Scene 6 with carry ${JSON.stringify(carry)}: the backcloth, the dancers, the sleepers stepping in, the court and the applause, then the iris.`,
    create: () => mk(5, { carry, from: { scene: 6 } }),
    input: () => ({}),
    end: (st) => st.status === 'won',
  })),
  {
    id: 'curtain-call', act: null, title: 'The curtain call', max: 7,
    note: LEGACY ? 'The band rises before the sea for its curtain call.' : 'The sea and curtain close the toy-theatre evening.',
    create: () => null,
    input: () => ({}),
    end: (st, t) => t >= 7,
  },
  {
    id: 'extra-animations', act: null, title: 'Extra Animations · everything', max: 12, draw: drawAnimGallery,
    note: 'Everything Extra Animations adds, side by side, drawn by the game\'s own kit: the jellyfish loop (assets/anims/) and each person\'s old-film idle: film tricks on the still (uneven cranking, a boil every twelfth of a second, a slow sway on the feet, a breath; src/animation.js idlePose), plus the generated frames flicked A, B, A, C once they arrive (requests in design/image-requests.md, C15). Each label says which frames are in. The Film look menu scales the tricks. This page shows them whatever the Extra Animations box says; tick the box to see them in place in the other scenes.',
    create: () => null,
    input: () => ({}),
    end: (st, t) => t >= 12,
  },
];
const BY_ID = Object.fromEntries(SCENES.map((s) => [s.id, s]));

// Copied from src/main.js (it is not exported there).
function drawCurtainCall(k, t) {
  k.sky(null);
  for (let r = 0; r < 3; r++) k.waves(r, t * 40);
}

// The people with old-film idle frames (design/image-requests.md, C15), and
// the step each uses in the game (half a beat unless given).
const IDLE_PEOPLE = [['band-trio'], ['band-beard'], ['reveller-yellow'], ['reveller-shaggy'], ['reveller-jester'],
  ['reveller-lady'], ['sea-spirit', 0.55], ['witch-stand', 0.5], ['pageant-dancers']];
// Every Extra Animation in a grid with its id, as the game draws it: the
// delivered loops (the jellyfish) and each person's idle frames.
function drawAnimGallery(k, t) {
  const c = k.c, loops = Object.keys(assets?.anims || {}).sort();
  const items = [...loops.map((id) => ({ id, loop: true })), ...IDLE_PEOPLE.filter(([id]) => LEGACY || !id.startsWith('band-')).map(([id, step]) => ({ id, step }))];
  c.fillStyle = k.col('#16282c'); c.fillRect(0, 0, 1280, 720);
  const cols = 4, rows = Math.ceil(items.length / cols), x0 = 170, x1 = 1110, y0 = 90, y1 = 622;
  const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
  items.forEach((it, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = x0 + cw * (col + 0.5), by = y0 + ch * (row + 1) - 30, bw = cw - 18, bh = ch - 46;
    const label = it.id.replace(/^anim-/, '');
    let sub;
    if (it.loop) {
      const meta = assets.anims[it.id].meta;
      const time = meta.loop === 'once' ? t % (animationDuration(meta) + 0.8) : t;
      k.anim(it.id, time, cx, meta.anchor === 'centre' ? by - bh / 2 : by, bw, bh);
      sub = 'loop';
    } else {
      const im = k.img(it.id);
      if (im) {
        const s = Math.min(bw / im.width, bh / im.height);
        k.idle(it.id, t, cx, by, im.width * s, im.height * s, it.step);
      }
      const n = ['b', 'c'].filter((f) => k.img(`${it.id}-idle-${f}`)).length;
      sub = 'film tricks' + (n ? (n === 2 ? ' + frames A B A C' : ' + 1 of 2 frames') : ' only (frames awaited)');
    }
    c.fillStyle = k.col('#f1e3c8'); c.font = '600 14px "Josefin Sans", sans-serif'; c.textAlign = 'center';
    c.fillText(label, cx, by + 16);
    c.font = '13px "Josefin Sans", sans-serif'; c.globalAlpha = 0.7; c.fillText(sub, cx, by + 32); c.globalAlpha = 1;
  });
}

// ---------------------------------------------------------------- setup
const canvas = $('#stage');
const audio = createAudio();
const ui = { sound: $('#sound'), hud: $('#hud'), loop: $('#loop'), lanterns: $('#lanterns'), film: $('#film'), anims: $('#anims'), scrub: $('#scrub') };
// The Extra Animations box is remembered between visits (the game's setting is separate).
try { ui.anims.checked = localStorage.getItem(STORAGE_PREFIX + '.workbench.anims') === '1'; } catch { /* storage is optional */ }
let renderer = null;
let assets = null;
let dirty = true;

const view = { act: null, state: null, curtain: 1, card: null, film: 'full', t: 0, hud: false, curtainCall: 0, scene: null };
const sim = { def: null, st: null, f: 0, len: 1, timeline: [], playing: false, speed: 1, acc: 0 };

const sel = $('#scene');
for (const s of SCENES) sel.add(new Option(s.title, s.id));

const speedBox = $('#speeds');
for (const v of [0.25, 0.5, 1, 2]) {
  const b = document.createElement('button');
  b.textContent = v + '×'; b.dataset.v = v;
  b.addEventListener('click', () => { sim.speed = v; syncSpeed(); });
  speedBox.append(b);
}
function syncSpeed() { for (const b of speedBox.querySelectorAll('button')) b.classList.toggle('on', +b.dataset.v === sim.speed); }
syncSpeed();

// ---------------------------------------------------------------- simulation
function inputFor(f, st) {
  const t = f * DT;
  const beat = beatAt(t);
  const ctx = { t, f, st, beat, opts: { lanterns: ui.lanterns.checked }, at: (sec) => f === Math.round(sec * 60) };
  return {
    moveX: 0, moveY: 0, up: false, down: false, left: false, right: false, a: false, aHeld: false, b: false,
    beat, ...sim.def.input(ctx),
  };
}

function setView() {
  const d = sim.def;
  view.act = d.act ? act(d.act) : null;
  view.state = sim.st;
  view.t = sim.f * DT;
  view.hud = ui.hud.checked;
  view.film = ui.film.value;
  view.extraAnimations = ui.anims.checked || d.draw === drawAnimGallery;
  view.curtainCall = d.act || d.draw ? 0 : Math.min(1, view.t / 1.4);
  view.scene = d.act ? null : d.draw || drawCurtainCall;
}

function restart() {
  renderer.clearFx();
  sim.st = sim.def.create();
  sim.f = 0; sim.acc = 0;
  setView();
  dirty = true;
}

// One fixed step, as src/main.js runs a frame: step the act, drain its
// events into the renderer (and the sound), then tick the renderer.
function stepOnce(sound) {
  const { def, st } = sim;
  if (def.act) {
    act(def.act).step(st, DT, inputFor(sim.f, st));
    const evs = st.events.splice(0);
    sim.f++;
    setView();
    for (const e of evs) { renderer.onEvent(e, view); if (sound) audio.play(e.type); }
  } else { sim.f++; setView(); }
  renderer.tick(DT, view);
}

function seek(frame) {
  frame = Math.max(0, Math.min(sim.len, Math.round(frame)));
  if (frame < sim.f) restart();
  while (sim.f < frame) stepOnce(false);
  dirty = true;
}

// Run the whole scene once, silently, to learn its length and its phases.
function measure() {
  restart();
  const { def } = sim;
  const timeline = [];
  let last = null;
  const note = () => {
    const ph = def.act ? sim.st.phase : 'curtain call';
    if (ph !== last) { timeline.push({ phase: ph, t: sim.f * DT }); last = ph; }
  };
  note();
  const maxF = Math.round(def.max * 60);
  while (sim.f < maxF) {
    stepOnce(false);
    note();
    if (def.end(sim.st, sim.f * DT) || (def.act && sim.st.status !== 'play' && sim.st.status !== 'won')) break;
    if (def.act && sim.st.status === 'won') break;
  }
  sim.len = sim.f;
  sim.timeline = timeline;
  if (def.act && sim.st.status === 'lost') console.warn('scene ended in a loss:', def.id);
}

function load(id, t = 0) {
  sim.def = BY_ID[id] || SCENES[0];
  sel.value = sim.def.id;
  document.title = `${sim.def.title} · Workbench`;
  $('#lanternsLabel').hidden = !(sim.def.opts || []).includes('lanterns');
  measure();
  restart();
  ui.scrub.max = sim.len; ui.scrub.value = 0;
  buildTimeline();
  $('#note').innerHTML = '';
  const p = document.createElement('span'); p.textContent = sim.def.note;
  const sm = document.createElement('small'); sm.textContent = `${(sim.len * DT).toFixed(1)} s, ${sim.len} frames at ${1 / DT} fps, seed ${SEED}.`;
  $('#note').append(p, sm);
  sim.playing = false;
  if (t > 0) seek(t / DT);
  syncUI();
}

// ---------------------------------------------------------------- UI
function buildTimeline() {
  const ol = $('#timeline'), marks = $('#marks');
  ol.innerHTML = ''; marks.innerHTML = '';
  sim.timeline.forEach((p, i) => {
    const li = document.createElement('li'); li.dataset.i = i;
    const b = document.createElement('button');
    const n = document.createElement('span'); n.textContent = p.phase;
    const tt = document.createElement('span'); tt.className = 't'; tt.textContent = p.t.toFixed(1) + ' s';
    b.append(n, tt);
    b.addEventListener('click', () => { sim.playing = false; seek(p.t / DT); syncUI(); });
    li.append(b); ol.append(li);
    const m = document.createElement('i'); m.style.left = `${(p.t / (sim.len * DT)) * 100}%`; m.title = `${p.phase} ${p.t.toFixed(1)} s`;
    marks.append(m);
  });
}

function currentPhase() { return sim.def.act ? sim.st.phase : sim.def.id === 'curtain-call' ? 'curtain call' : ''; }

function syncUI() {
  const t = sim.f * DT;
  const ph = currentPhase();
  $('#readout').innerHTML = `<em>${t.toFixed(1)}</em> / ${(sim.len * DT).toFixed(1)} s · phase <em>${ph}</em>`;
  $('#play').textContent = sim.playing ? 'Pause' : sim.f >= sim.len ? 'Replay' : 'Play';
  if (+ui.scrub.value !== sim.f && document.activeElement !== ui.scrub) ui.scrub.value = sim.f;
  let cur = -1;
  sim.timeline.forEach((p, i) => { if (p.t <= t + 1e-6) cur = i; });
  for (const li of $('#timeline').children) li.classList.toggle('now', +li.dataset.i === cur);
}

function togglePlay() {
  if (sim.f >= sim.len) { restart(); sim.playing = true; } else sim.playing = !sim.playing;
  sim.acc = 0; syncUI();
}
function doRestart() { restart(); sim.playing = false; syncUI(); }
function stepFrames(n) {
  sim.playing = false;
  if (n > 0) { for (let i = 0; i < n && sim.f < sim.len; i++) stepOnce(ui.sound.checked); dirty = true; }
  else seek(sim.f + n);
  syncUI();
}

$('#play').addEventListener('click', togglePlay);
$('#restart').addEventListener('click', doRestart);
$('#step').addEventListener('click', () => stepFrames(1));
$('#back').addEventListener('click', () => stepFrames(-1));
ui.scrub.addEventListener('input', () => { sim.playing = false; seek(+ui.scrub.value); syncUI(); });
sel.addEventListener('change', () => { location.hash = sel.value; });
ui.sound.addEventListener('change', () => { if (ui.sound.checked) { audio.unlock(); audio.resume(); } });
ui.hud.addEventListener('change', () => { setView(); dirty = true; });
ui.film.addEventListener('change', () => { setView(); dirty = true; });
ui.anims.addEventListener('change', () => {
  try { localStorage.setItem(STORAGE_PREFIX + '.workbench.anims', ui.anims.checked ? '1' : '0'); } catch { /* storage is optional */ }
  setView(); dirty = true;
});
ui.lanterns.addEventListener('change', () => { const t = sim.f * DT; load(sim.def.id, t); });
$('#link').addEventListener('click', () => {
  const h = `#${sim.def.id}@${(sim.f * DT).toFixed(1)}`;
  history.replaceState(null, '', h);
  navigator.clipboard?.writeText(location.href).catch(() => {});
  $('#link').textContent = 'Link copied';
  setTimeout(() => { $('#link').textContent = 'Link to this moment'; }, 1500);
});
function fromHash() {
  const [id, t] = decodeURIComponent(location.hash.slice(1)).split('@');
  load(id, +t > 0 ? +t : 0);
}
window.addEventListener('hashchange', fromHash);

window.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.target.tagName === 'SELECT') return;
  const n = e.shiftKey ? 60 : 1;
  if (e.code === 'Space') togglePlay();
  else if (e.code === 'KeyR') doRestart();
  else if (e.code === 'ArrowLeft') stepFrames(-n);
  else if (e.code === 'ArrowRight') stepFrames(n);
  else return;
  e.preventDefault();
});

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (renderer && sim.def) {
    if (sim.playing) {
      sim.acc += dt * sim.speed;
      let n = 0;
      while (sim.acc >= DT && n < 8) {
        if (sim.f >= sim.len) {
          if (ui.loop.checked) { restart(); } else { sim.playing = false; break; }
        }
        stepOnce(ui.sound.checked); sim.acc -= DT; n++;
      }
      if (sim.acc > DT * 8) sim.acc = 0;
      if (sim.f >= sim.len && !ui.loop.checked) sim.playing = false;
      dirty = true;
      syncUI();
    }
    if (dirty) { setView(); renderer.render(view); dirty = false; }
  }
  requestAnimationFrame(frame);
}

async function boot() {
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
  let n = 0;
  assets = await loadAssets('../assets/', { onImage: () => { $('#loading').textContent = `Loading the art… ${++n}`; } });
  await assets.all;
  await withTimeout(Promise.all([document.fonts.load('60px Yesteryear'), document.fonts.load('700 22px "Josefin Sans"'), document.fonts.load('20px "Josefin Sans"')]), 4000).catch(() => {});
  // Sound effects as the game registers them.
  const sfx = Object.fromEntries(Object.entries(assets.sfx || {}).filter(([, v]) => v.status === 'delivered' && v.file).map(([k, v]) => [k, '../assets/' + v.file]));
  audio.setSfx(sfx);
  audio.setVolumes(0.7, 0.8);
  renderer = createRenderer(canvas, assets);
  $('#loading').textContent = '';
  if (!location.hash) history.replaceState(null, '', '#' + SCENES[0].id);
  fromHash();
  window.__workbench = { sim, view, SCENES, seek: (f) => { seek(f); syncUI(); }, load }; // for tests
  requestAnimationFrame(frame);
}
boot().catch((err) => { $('#loading').textContent = 'Could not start: ' + err.message; console.error(err); });
