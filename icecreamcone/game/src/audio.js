// Sound: soft plinks, pours, clicks and honks synthesised in the browser for
// the games, recorded music for the menus and each kind of game (a little
// synthesised music-box tune stands in for any track that doesn't load), and
// a recorded fanfare for the sticker celebration.
// Nothing plays until the first user gesture (browsers require one).

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
const vol = { volume: 0.8, music: 0.5, sfx: 0.8, sound: true };

function ensure() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  apply();
  return ctx;
}

function apply() {
  if (!ctx) return;
  // Silent while muted or while the page is away (a short ramp avoids clicks).
  master.gain.setTargetAtTime(vol.sound && !away ? vol.volume : 0, ctx.currentTime, 0.04);
  sfxBus.gain.value = vol.sfx;
  musicBus.gain.value = vol.music * 0.5;
}

export function setVolumes(s) {
  vol.volume = s.volume / 100;
  vol.music = s.music / 100;
  vol.sfx = s.sfx / 100;
  vol.sound = s.sound !== false;
  apply();
}

export function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
  loadSting();
  // A track asked for before the first gesture could not start; now it can.
  if (rec && rec.el.paused && !away) rec.el.play().catch(() => {});
}

let away = false;
// For checks: what the master is aimed at.
export const state = () => ({ sound: vol.sound, away, master: vol.sound && !away ? vol.volume : 0 });
export function suspend(on) {
  away = on;
  apply();
  if (!ctx) return;
  if (on) ctx.suspend();
  else ctx.resume();
  if (rec) {
    if (on) rec.el.pause();
    else rec.el.play().catch(() => {});
  }
}

function tone(freq, { type = 'sine', dur = 0.15, gain = 0.25, when = 0, slide = 0, attack = 0.005, bus = sfxBus } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, gain = 0.2, when = 0, freq = 1200, q = 1, type = 'bandpass', sweep = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(sfxBus);
  s.start(t, Math.random());
  s.stop(t + dur + 0.05);
}

// Named effects. `opts.freq` or `opts.pitch` (semitones) vary some of them.
const SFX = {
  ui: () => tone(880, { type: 'triangle', dur: 0.06, gain: 0.12 }),
  move: () => tone(660, { type: 'triangle', dur: 0.04, gain: 0.07 }),
  back: () => tone(440, { type: 'triangle', dur: 0.08, gain: 0.1, slide: 0.7 }),
  page: () => noise({ dur: 0.25, gain: 0.12, freq: 3000, sweep: 0.4, q: 0.6 }),
  tick: () => tone(1200, { type: 'square', dur: 0.03, gain: 0.05 }),
  go: () => { tone(784, { type: 'triangle', dur: 0.2, gain: 0.2 }); tone(1175, { type: 'triangle', dur: 0.3, gain: 0.15, when: 0.08 }); },
  time: () => { tone(988, { type: 'square', dur: 0.12, gain: 0.08 }); tone(740, { type: 'square', dur: 0.25, gain: 0.08, when: 0.14 }); },
  catch: (o) => tone(520 * Math.pow(2, (o.pitch || 0) / 12), { type: 'triangle', dur: 0.14, gain: 0.22, slide: 1.5 }),
  plop: () => { tone(300, { dur: 0.12, gain: 0.25, slide: 0.5 }); noise({ dur: 0.08, gain: 0.08, freq: 800 }); },
  topple: () => { tone(400, { type: 'sawtooth', dur: 0.6, gain: 0.08, slide: 0.3 }); noise({ dur: 0.5, gain: 0.1, freq: 500, sweep: 0.5 }); },
  bonk: () => tone(180, { type: 'square', dur: 0.15, gain: 0.12, slide: 0.6 }),
  pour: () => noise({ dur: 0.12, gain: 0.05, freq: 1800 + Math.random() * 600, q: 3 }),
  splash: () => noise({ dur: 0.45, gain: 0.25, freq: 1400, sweep: 0.3, q: 0.8 }),
  ding: (o) => { const f = 1320 * Math.pow(2, (o.pitch || 0) / 12); tone(f, { dur: 0.6, gain: 0.18 }); tone(f * 2.01, { dur: 0.3, gain: 0.05 }); },
  squawk: () => { tone(700, { type: 'sawtooth', dur: 0.18, gain: 0.08, slide: 0.6 }); tone(620, { type: 'sawtooth', dur: 0.15, gain: 0.07, when: 0.12, slide: 0.5 }); },
  shutter: () => { noise({ dur: 0.04, gain: 0.3, freq: 4000, q: 0.5 }); noise({ dur: 0.05, gain: 0.25, freq: 2500, q: 0.5, when: 0.07 }); },
  note: (o) => tone(o.freq || 440, { type: 'triangle', dur: o.dur || 0.3, gain: 0.2 }),
  miss: () => noise({ dur: 0.18, gain: 0.12, freq: 300, q: 2 }),
  wind: () => tone(200 + Math.random() * 80, { type: 'square', dur: 0.03, gain: 0.04 }),
  grow: (o) => tone(400 * Math.pow(2, (o.pitch || 0) / 12), { type: 'sine', dur: 0.25, gain: 0.15, slide: 1.3 }),
  bloom: () => [0, 4, 7, 12].forEach((s, i) => tone(660 * Math.pow(2, s / 12), { type: 'triangle', dur: 0.3, gain: 0.12, when: i * 0.06 })),
  wilt: () => tone(500, { type: 'sine', dur: 0.5, gain: 0.1, slide: 0.5 }),
  step: (o) => tone(o.side < 0 ? 330 : 392, { type: 'triangle', dur: 0.1, gain: 0.18 }),
  stitch: () => tone(1500 + Math.random() * 200, { type: 'square', dur: 0.02, gain: 0.04 }),
  shuffle: () => noise({ dur: 0.1, gain: 0.08, freq: 900, q: 1 }),
  right: () => [0, 4, 7].forEach((s, i) => tone(784 * Math.pow(2, s / 12), { type: 'triangle', dur: 0.2, gain: 0.15, when: i * 0.07 })),
  wrong: () => tone(220, { type: 'sawtooth', dur: 0.35, gain: 0.1, slide: 0.8 }),
  honk: () => { tone(350, { type: 'sawtooth', dur: 0.25, gain: 0.08 }); tone(440, { type: 'sawtooth', dur: 0.25, gain: 0.06 }); },
  switch: () => tone(1000, { type: 'square', dur: 0.05, gain: 0.07 }),
  medal: (o) => [0, 4, 7, 12, 16].slice(0, 3 + (o.level || 0)).forEach((s, i) => tone(523 * Math.pow(2, s / 12), { type: 'triangle', dur: 0.4, gain: 0.16, when: i * 0.11 })),
};

export function sfx(name, opts = {}) {
  if (!ctx || ctx.state !== 'running') return;
  const fn = SFX[name];
  if (fn) fn(opts);
}

// ---------- music: a soft music-box loop ----------

const TUNES = {
  // Each tune: tempo (beats per minute), a melody of [semitone from root | null, beats],
  // and the root frequency. The bass plays the root and fifth on the beat.
  menu: { bpm: 92, root: 523.25, melody: [[0, 1], [4, 1], [7, 1], [9, 1], [7, 2], [4, 1], [2, 1], [0, 1], [2, 1], [4, 2], [null, 2], [5, 1], [4, 1], [2, 1], [4, 1], [0, 2], [-3, 1], [-1, 1], [0, 4]] },
  play: { bpm: 132, root: 587.33, melody: [[0, 0.5], [2, 0.5], [4, 0.5], [7, 0.5], [9, 1], [7, 1], [4, 0.5], [5, 0.5], [7, 1], [4, 1], [2, 1], [0, 0.5], [2, 0.5], [4, 1], [2, 1], [-1, 1], [0, 2]] },
  night: { bpm: 84, root: 440, melody: [[0, 1.5], [3, 0.5], [7, 1], [5, 1], [3, 2], [2, 1], [0, 1], [-2, 2], [0, 2], [null, 2]] },
};

let music = null;

function playTune(name) {
  if (music && music.name === name) return;
  stopTune();
  const tune = TUNES[name];
  if (!tune) return;
  music = { name, tune, next: ctx.currentTime + 0.1, i: 0, timer: null };
  const m = music;
  const beat = 60 / tune.bpm;
  const step = () => {
    if (music !== m) return;
    while (m.next < ctx.currentTime + 0.4) {
      const [semi, beats] = tune.melody[m.i % tune.melody.length];
      const when = m.next - ctx.currentTime;
      if (semi !== null) {
        const f = tune.root * Math.pow(2, semi / 12);
        tone(f, { type: 'sine', dur: beat * beats * 0.9 + 0.3, gain: 0.12, when, bus: musicBus });
        tone(f * 2, { type: 'sine', dur: 0.25, gain: 0.03, when, bus: musicBus });
      }
      if (m.i % 2 === 0) tone(tune.root / 4 * (m.i % 4 === 0 ? 1 : 1.5), { type: 'triangle', dur: beat * 1.5, gain: 0.06, when, bus: musicBus });
      m.next += beat * beats;
      m.i++;
    }
    m.timer = setTimeout(step, 120);
  };
  step();
}

function stopTune() {
  if (music && music.timer) clearTimeout(music.timer);
  music = null;
}

// ---------- recorded music ----------

// Each piece of music by name, the recording (in assets/music/) and the
// synthesised tune that stands in for it if the file can't be played.
// See icecreamcone/design/music.md.
const TRACKS = {
  title: { file: 'title', tune: 'menu' },
  guide: { file: 'field-guide', tune: 'menu' },
  bouncy: { file: 'tiptoe-bounce', tune: 'play' },
  busy: { file: 'cartoon-busy', tune: 'play' },
  gentle: { file: 'sunny-gentle-shuffle', tune: 'menu' },
  clockwork: { file: 'clockwork-concentration', tune: 'menu' },
  carousel: { file: 'seaside-carousel-waltz', tune: 'play' },
};
const REC_LEVEL = 0.32; // under the effects: the recordings are mastered loud
const FADE = 0.8;
let rec = null; // { name, el, gain }

function fadeOut(r) {
  const t = ctx.currentTime;
  r.gain.gain.cancelScheduledValues(t);
  r.gain.gain.setValueAtTime(r.gain.gain.value, t);
  r.gain.gain.linearRampToValueAtTime(0, t + FADE);
  setTimeout(() => {
    r.el.pause();
    r.el.removeAttribute('src');
    r.el.load();
  }, FADE * 1000 + 50);
}

function playTrack(name, after) {
  const track = TRACKS[name];
  if (rec && rec.name === name) {
    // Asked for again: it plays on (and loops again, if it was to give way).
    rec.el.loop = true;
    rec.next = null;
    return;
  }
  if (rec && after && rec.name === after) {
    // Let it play to its end (or from its start, if the browser hasn't let it
    // begin yet), then start this one.
    rec.el.loop = false;
    rec.next = name;
    return;
  }
  if (rec) fadeOut(rec);
  const el = new Audio(`assets/music/${track.file}.mp3`);
  el.loop = true;
  el.preload = 'auto';
  let gain;
  try {
    gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain);
    gain.connect(musicBus);
  } catch {
    rec = null;
    playTune(track.tune);
    return;
  }
  const r = { name, el, gain, next: null };
  rec = r;
  el.addEventListener('ended', () => {
    if (rec !== r || !r.next) return;
    const next = r.next;
    rec = null;
    playTrack(next);
  });
  // If the recording can't be played, its tune stands in.
  el.addEventListener('error', () => {
    if (rec !== r) return;
    rec = null;
    playTune(track.tune);
  });
  gain.gain.linearRampToValueAtTime(REC_LEVEL / 0.25, ctx.currentTime + FADE);
  if (!away) el.play().catch(() => {});
}

// Music for a screen or kind of game, by name ('none' for silence). The same
// name again carries on where it is. With `after`, a playing track of that
// name finishes first and this one follows it (the title theme runs on into
// the field guide).
export function playMusic(name, { after = null } = {}) {
  if (!ensure()) return;
  if (TRACKS[name]) {
    stopTune();
    playTrack(name, after);
    return;
  }
  if (rec) fadeOut(rec);
  rec = null;
  if (name === 'none') stopTune();
  else playTune(name);
}

export function stopMusic() {
  stopTune();
  if (rec && ctx) fadeOut(rec);
  rec = null;
}

// ---------- the celebration fanfare ----------

let sting = null; // the decoded recording, once fetched
let stingUntil = 0;
let stingNow = null; // the one sounding: { s: its source, g: its gain }
// True while the fanfare is sounding (the chimes it replaces stay quiet).
export const stingPlaying = () => !!ctx && ctx.currentTime < stingUntil;
export function loadSting() {
  if (sting || !ensure()) return;
  sting = 'loading';
  fetch('assets/sfx/celebration.mp3')
    .then((r) => r.arrayBuffer())
    .then((b) => ctx.decodeAudioData(b))
    .then((buf) => (sting = buf))
    .catch(() => (sting = null));
}

// Plays the fanfare, the music dipping under it; false if it isn't ready
// (the caller plays the synthesised chime instead).
export function playSting() {
  if (!ctx || ctx.state !== 'running' || !(sting instanceof AudioBuffer)) return false;
  stopSting(0.05);
  const s = ctx.createBufferSource();
  s.buffer = sting;
  const g = ctx.createGain();
  g.gain.value = 0.9;
  s.connect(g);
  g.connect(sfxBus);
  s.start();
  stingNow = { s, g };
  stingUntil = ctx.currentTime + sting.duration;
  if (rec) {
    const t = ctx.currentTime;
    const p = rec.gain.gain;
    const full = REC_LEVEL / 0.25;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(full * 0.25, t + 0.2);
    p.setValueAtTime(full * 0.25, t + sting.duration - 0.6);
    p.linearRampToValueAtTime(full, t + sting.duration + 0.6);
  }
  return true;
}

// Fades the fanfare out (a result card left early), the music coming back up.
export function stopSting(fade = 0.4) {
  if (!stingNow || !stingPlaying()) return;
  const t = ctx.currentTime;
  const { s, g } = stingNow;
  stingNow = null;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(0, t + fade);
  try {
    s.stop(t + fade + 0.02);
  } catch { /* already stopped */ }
  stingUntil = t + fade;
  if (rec) {
    const p = rec.gain.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(REC_LEVEL / 0.25, t + fade + 0.6);
  }
}
