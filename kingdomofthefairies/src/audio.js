import { LEGACY } from './theme.js';
// Recorded score and stage foley. The default edition starts period music on
// audio unlock; the query edition downloads and opens with its preserved song.
// Sound effects use delivered recordings with synthesized fallbacks.

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);

// The recording's beat grid, measured from its onsets: a steady 76.5 BPM
// (the band played to a click) with the first beat 0.33 s in, stable to
// within 0.04 s across the whole song. Acts use it for beat-timed machinery.
export const BEAT = { bpm: 76.5, period: 60 / 76.5, offset: 0.33 };

// Mix for recorded effects: frequent ones sit lower. Tonal effects are tuned
// to F (design/source/build_sfx.py), so they keep their pitch.
const MIX = { ui: 0.5, row: 0.55, pearl: 0.7, rockWarn: 0.6, wind: 0.8 };
const TONAL = new Set(['pearl', 'keepsake', 'done', 'arrive', 'ui', 'landho', 'partyHit', 'victoryStinger']);

export function createAudio() {
  let ac = null, master, music, sfx, sea, playing = false;
  // In play (the score) or in the menus (the record's crackle); see setStage.
  let stage, record, recordSrc = null, inPlay = false, crackleOn = false;
  // The song: { url, loopStart, loopEnd, bytes, buffer, state, progress, node }.
  // state: 'loading' -> 'downloaded' -> 'decoding' -> 'ready', or 'failed'.
  let track = null;
  // Delivered effects (ElevenLabs, see design/source/build_sfx.py):
  // name -> url until decoded, then name -> AudioBuffer.
  let sfxUrls = {};
  const sfxBuf = {};
  let sfxLoading = null;
  const vol = { music: 0.7, sfx: 0.8 };
  let musicLevel = 1;
  // The Sound button, and whether the page is away (hidden or unfocused).
  let soundOn = true, away = false;

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.connect(ac.destination);
    // The score plays through `stage`, which is open only in play; in the
    // menus `record` carries an old gramophone's crackle instead.
    stage = ac.createGain(); stage.gain.value = inPlay ? 1 : 0; stage.connect(master);
    music = ac.createGain(); music.connect(stage);
    record = ac.createGain(); record.gain.value = 0; record.connect(master);
    sfx = ac.createGain(); sfx.connect(master);
    apply();
    loadSfx();
    decodeTrack();
    applyStage(0.05);
    return true;
  }

  function decode(url) {
    return fetch(url)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((data) => new Promise((ok, fail) => ac.decodeAudioData(data, ok, fail)));
  }
  function loadSfx() {
    if (sfxLoading || !ac) return sfxLoading;
    sfxLoading = Promise.all(Object.entries(sfxUrls).map(([name, url]) =>
      decode(url).then((b) => { sfxBuf[name] = b; }).catch(() => { /* keep the synth version */ })));
    return sfxLoading;
  }
  function playBuffer(buf, gain = 1, rate = 1) {
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ac.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(sfx);
    src.start();
  }
  function apply() {
    if (!ac) return;
    master.gain.setTargetAtTime(soundOn && !away ? 1 : 0, ac.currentTime, 0.04);
    music.gain.value = vol.music * 0.55 * musicLevel;
    sfx.gain.value = vol.sfx * 0.8;
  }

  function noiseBuffer(sec = 2) {
    const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function startSea() {
    if (sfxBuf.sea) {
      // The recorded wave machine, looping under the score.
      const src = ac.createBufferSource(); src.buffer = sfxBuf.sea; src.loop = true;
      const g = ac.createGain(); g.gain.value = 0.35;
      src.connect(g); g.connect(music); src.start();
      sea = { src, g, recorded: true };
      return;
    }
    const src = ac.createBufferSource(); src.buffer = noiseBuffer(4); src.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = ac.createGain(); g.gain.value = 0.12;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.12;
    const lg = ac.createGain(); lg.gain.value = 0.08;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(music);
    src.start(); lfo.start();
    sea = { src, lfo, g };
  }

  // An old record turning with no music on it: surface hiss, a low rumble,
  // irregular crackle and pops, and a soft click once a turn (78 rpm). A
  // delivered recording (sfx 'record', build_sfx.py) replaces the synthesis.
  function crackleBuffer(sec = 9.23) {   // a whole number of turns at 78 rpm
    const sr = ac.sampleRate, n = Math.floor(sr * sec), b = ac.createBuffer(1, n, sr), d = b.getChannelData(0);
    let lp = 0, hp = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      lp += (w - lp) * 0.02;                   // rumble
      hp = 0.6 * (hp + w - prev); prev = w;    // hiss
      d[i] = hp * 0.035 + lp * 0.12;
    }
    const pop = (at, amp, len) => {
      const i0 = Math.floor(at * sr), m = Math.floor(len * sr), sign = Math.random() < 0.5 ? -1 : 1;
      for (let j = 0; j < m && i0 + j < n; j++) d[i0 + j] += sign * amp * Math.exp(-j / (m / 5)) * (j % 2 ? -0.6 : 1);
    };
    for (let k = 0; k < sec * 30; k++) pop(Math.random() * sec, 0.04 + Math.random() * 0.12 * Math.random(), 0.0015 + Math.random() * 0.002);
    for (let k = 0; k < sec * 2.2; k++) pop(Math.random() * sec, 0.25 + Math.random() * 0.35, 0.003 + Math.random() * 0.004);
    const turn = 60 / 78;
    for (let t = 0.2; t < sec; t += turn) pop(t, 0.18, 0.012);
    // the seam: fade the last 20 ms into the first
    const f = Math.floor(sr * 0.02);
    for (let j = 0; j < f; j++) { const a = j / f; d[n - f + j] = d[n - f + j] * (1 - a) + d[j] * a; }
    return b;
  }
  function startRecord() {
    if (recordSrc || !ac) return;
    const src = ac.createBufferSource();
    src.buffer = sfxBuf.record || crackleBuffer(); src.loop = true;
    const g = ac.createGain(); g.gain.value = sfxBuf.record ? 0.5 : 0.9;
    src.connect(g); g.connect(record); src.start();
    recordSrc = src;
    // the synthesis stands in until the recording has decoded, then gives way
    if (!sfxBuf.record) loadSfx()?.then(() => {
      if (!sfxBuf.record || recordSrc !== src) return;
      try { src.stop(); } catch { /* already stopped */ }
      recordSrc = null; startRecord();
    });
  }
  // In play the score fades up and the record fades out; in the menus the
  // other way about. (The Widow's Bay edition keeps its song throughout.)
  function applyStage(dur = 1.2) {
    if (!ac) return;
    const t = ac.currentTime, menus = !inPlay && crackleOn;
    stage.gain.cancelScheduledValues(t); stage.gain.setTargetAtTime(inPlay || !crackleOn ? 1 : 0, t, dur / 3);
    record.gain.cancelScheduledValues(t); record.gain.setTargetAtTime(menus ? 1 : 0, t, dur / 3);
    if (menus) startRecord();
  }

  function pluck(t, midi, gain = 0.18, dest = music) {
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = NOTE(midi);
    const o2 = ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = NOTE(midi) * 1.003;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.5);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    const g2 = ac.createGain(); g2.gain.value = 0.25;
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(dest);
    o.start(t); o2.start(t); o.stop(t + 1.2); o2.stop(t + 1.2);
  }
  // Download with progress; needs no AudioContext, so it starts at page load.
  async function download() {
    try {
      const res = await fetch(track.url);
      if (!res.ok) throw new Error(res.status);
      const total = +res.headers.get('content-length') || 0;
      if (!res.body || !total) { track.bytes = await res.arrayBuffer(); }
      else {
        const reader = res.body.getReader();
        const chunks = []; let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value); got += value.length;
          track.progress = Math.min(0.95, (got / total) * 0.95);
        }
        const all = new Uint8Array(got); let o = 0;
        for (const c of chunks) { all.set(c, o); o += c.length; }
        track.bytes = all.buffer;
      }
      track.state = 'downloaded'; track.progress = 0.95;
      if (ac) decodeTrack();
    } catch { track.state = 'failed'; }
  }
  function decodeTrack() {
    if (!track || track.state !== 'downloaded') return;
    track.state = 'decoding';
    new Promise((ok, fail) => ac.decodeAudioData(track.bytes, ok, fail))
      .then((buf) => {
        track.buffer = buf; track.bytes = null; track.state = 'ready'; track.progress = 1;
        if (playing && !track.node) playTrack();
      })
      .catch(() => { track.state = 'failed'; });
  }
  // ---- The score: the band's song first, then period accompaniment by mood
  // (design/music.md). `now` is what is playing: { kind: 'song'|'period',
  // id, node, gain }. With no period tracks ready (or accompaniment off), the
  // song loops as it always did.
  const SONG_GAIN = 0.8, PERIOD_GAIN = 0.8, FADE = 2;
  let now = null, mood = 'voyage', lastPeriod = null, periodOn = true;
  let periods = []; // [{ id, url, moods, state, buffer }]

  function fadeOut(n, dur = FADE) {
    if (!n?.node) return;
    const t = ac.currentTime;
    try {
      n.gain.gain.cancelScheduledValues(t);
      n.gain.gain.setValueAtTime(n.gain.gain.value, t);
      n.gain.gain.linearRampToValueAtTime(0.0001, t + dur);
      n.node.onended = null;
      n.node.stop(t + dur + 0.05);
    } catch { /* already stopped */ }
  }
  function startNode(buffer, level, { loop = false, loopStart = 0, loopEnd = 0, offset = 0, fadeIn = 0.05 } = {}) {
    const src = ac.createBufferSource();
    src.buffer = buffer; src.loop = loop;
    if (loop && loopEnd) { src.loopStart = loopStart; src.loopEnd = loopEnd; }
    const g = ac.createGain();
    const t = ac.currentTime + 0.05;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + fadeIn);
    src.connect(g); g.connect(music);
    src.start(t, offset);
    return { node: src, gain: g, startedAt: t - offset };
  }
  const anyPeriodReady = () => periodOn && periods.some((p) => p.state === 'ready');

  function playTrack(fadeIn = 0.05) {
    // The song plays through once when accompaniment can follow; otherwise it loops.
    const loop = !anyPeriodReady();
    const n = startNode(track.buffer, SONG_GAIN, { loop, loopStart: track.loopStart || 0, loopEnd: track.loopEnd || 0, fadeIn });
    if (now) fadeOut(now, fadeIn > 0.1 ? fadeIn : 0.3);
    now = { kind: 'song', id: 'song', ...n };
    track.node = n.node; track.startedAt = n.startedAt;
    // When the song ends, hand over to the accompaniment.
    if (!loop) n.node.onended = () => { if (now?.node === n.node) { track.node = null; next(); } };
    if (sea) sea.g.gain.value = sea.recorded ? 0.12 : 0.05; // let the music carry the scene
    loadPeriods();
  }

  // Choose the period track for the current mood (avoiding an immediate repeat).
  // A mood whose own piece has not been delivered borrows another's.
  const STAND_IN = { wedding: 'revel' };
  const fits = (p, m) => p.moods.includes(m) || (STAND_IN[m] && !periods.some((q) => q.moods.includes(m)) && p.moods.includes(STAND_IN[m]));
  function pick() {
    const ready = periods.filter((p) => p.state === 'ready');
    if (!ready.length) return null;
    const fit = ready.filter((p) => fits(p, mood));
    const pool = (fit.length ? fit : ready);
    return pool.find((p) => p.id !== lastPeriod) || pool[0];
  }
  function playPeriod(p, fadeIn = 0.4) {
    if (now) fadeOut(now);
    const n = startNode(p.buffer, PERIOD_GAIN, { fadeIn });
    now = { kind: 'period', id: p.id, moods: p.moods, ...n };
    lastPeriod = p.id;
    n.node.onended = () => { if (now?.node === n.node) next(); };
  }
  function next(fadeIn) {
    if (!playing) return;
    const p = periodOn ? pick() : null;
    if (p) playPeriod(p, fadeIn);
    else if (track?.buffer) playTrack(); // nothing else ready: the song again
  }
  function loadPeriods() {
    // One at a time in the background, after the song has started: first
    // what suits the scene now (the title's tender piece), so the music
    // doesn't open on one piece and switch to another as soon as it arrives.
    if (!ac) return;
    const p = periods.find((q) => q.state === 'idle' && fits(q, mood)) || periods.find((q) => q.state === 'idle');
    if (!p) return;
    p.state = 'loading';
    decode(p.url).then((b) => { p.buffer = b; p.state = 'ready'; })
      .catch(() => { p.state = 'failed'; })
      .finally(() => {
        // If the song was looping because nothing was ready, let it finish its pass.
        if (now?.kind === 'song' && now.node.loop && anyPeriodReady()) now.node.loop = false, now.node.onended = () => { if (now?.kind === 'song') { track.node = null; next(); } };
        // Nothing playing yet: start, unless a piece that suits the scene is
        // still on its way (wait for it rather than open on another). A
        // piece that doesn't suit the scene gives way to one that does with
        // the usual crossfade.
        const fitting = periods.some((q) => fits(q, mood) && (q.state === 'idle' || q.state === 'loading'));
        if (!LEGACY && playing && !now && (fits(p, mood) || !fitting)) next();
        else if (!LEGACY && playing && now?.kind === 'period' && !fits(now, mood) && p.state === 'ready' && fits(p, mood)) next(FADE);
        loadPeriods();
      });
  }
  async function startMusic() {
    if (!ensure() || playing) return;
    playing = true;
    // Give the recorded sea a moment to decode before falling back to noise.
    await Promise.race([loadSfx(), new Promise((r) => setTimeout(r, 1500))]);
    if (!playing) return;
    if (!sea) startSea();
    if (track?.state === 'ready') playTrack();
    else if (LEGACY) decodeTrack(); // plays as soon as it is ready
    else { next(); loadPeriods(); }
  }
  function stopMusic() {
    playing = false;
    try { now?.node?.stop(); } catch { /* already stopped */ }
    now = null;
    if (track) track.node = null;
  }

  function env(t, g, a, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); }
  function tone(type, f0, f1, d, a = 0.3) {
    const t = ac.currentTime;
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
    const g = ac.createGain(); env(t, g, a, d);
    o.connect(g); g.connect(sfx); o.start(t); o.stop(t + d + 0.05);
  }
  function noise(d, freq, a = 0.4, type = 'lowpass') {
    const t = ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = noiseBuffer(d + 0.1);
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ac.createGain(); env(t, g, a, d);
    s.connect(f); f.connect(g); g.connect(sfx); s.start(t);
  }

  const SFX = {
    leap: () => { tone('sine', 300, 700, 0.25, 0.18); noise(0.25, 1800, 0.12, 'bandpass'); },
    row: () => { tone('square', 180, 140, 0.06, 0.06); noise(0.08, 900, 0.1, 'bandpass'); },
    pearl: () => { const t = ac.currentTime; pluck(t, 86, 0.12, sfx); pluck(t + 0.06, 93, 0.1, sfx); },
    keepsake: () => { const t = ac.currentTime; [74, 77, 81, 86, 89].forEach((n, i) => pluck(t + i * 0.07, n, 0.14, sfx)); },
    hit: () => { tone('sine', 120, 40, 0.4, 0.5); noise(0.4, 600, 0.5); },
    wreck: () => { tone('sawtooth', 200, 30, 1.6, 0.25); noise(1.6, 400, 0.5); },
    windWarn: () => { // the witch's laugh and a whistling gust
      const t = ac.currentTime;
      for (let i = 0; i < 4; i++) {
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(900 - i * 90, t + i * 0.14); o.frequency.exponentialRampToValueAtTime(600 - i * 80, t + i * 0.14 + 0.12);
        const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.14); g.gain.exponentialRampToValueAtTime(0.06, t + i * 0.14 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.14 + 0.12);
        o.connect(g); g.connect(sfx); o.start(t + i * 0.14); o.stop(t + i * 0.14 + 0.15);
      }
      noise(1.6, 1200, 0.15, 'bandpass');
    },
    wind: () => noise(0.9, 700, 0.2, 'bandpass'),
    boltWarn: () => noise(1.2, 160, 0.35),
    strike: () => { noise(0.5, 3000, 0.5, 'highpass'); tone('square', 80, 30, 0.5, 0.3); },
    rockWarn: () => noise(0.5, 300, 0.12),
    rockUp: () => tone('sine', 90, 50, 0.25, 0.3),
    arrive: () => { const t = ac.currentTime; [62, 66, 69, 74].forEach((n, i) => pluck(t + i * 0.12, n, 0.16, sfx)); },
    done: () => { const t = ac.currentTime; pluck(t, 62, 0.2, sfx); pluck(t + 0.2, 69, 0.2, sfx); pluck(t + 0.4, 74, 0.2, sfx); },
    curtain: () => noise(1.2, 500, 0.12, 'bandpass'),
    ui: () => tone('triangle', 660, 880, 0.06, 0.08),
  };

  return {
    unlock: ensure,
    startMusic, stopMusic,
    // Whether the playable game is on stage (the score) or the menus (the
    // record's crackle). `crackle` false (the default) keeps the score everywhere.
    setStage(play, crackle = false) {
      if (play === inPlay && crackle === crackleOn) return;
      inPlay = play; crackleOn = crackle;
      applyStage();
    },
    recordPlaying: () => !!recordSrc && !inPlay && crackleOn,
    // Register the band's recording and start downloading it now. Decoding
    // waits for the first user gesture (browsers won't start audio before one).
    setTrack(url, loopStart = 0, loopEnd = 0) {
      track = { url, loopStart, loopEnd, bytes: null, buffer: null, state: 'loading', progress: 0, node: null };
      download();
    },
    // { state, progress 0..1 } for the loading bar; 'none' when no song is set.
    trackStatus: () => (track ? { state: track.state, progress: track.progress } : { state: 'none', progress: 1 }),
    usingTrack: () => !!track?.node,
    // Period accompaniment ([{ id, url, moods }]); loaded after the song starts.
    setPeriod(list) { periods = list.map((p) => ({ ...p, state: 'idle', buffer: null })); if (now || (!LEGACY && ac)) loadPeriods(); },
    // The scene's mood. A period track that doesn't suit a new mood crossfades
    // to one that does; the song is never cut off for a mood change.
    setMood(m) {
      if (m === mood) return;
      mood = m;
      if (!ac || !playing || now?.kind !== 'period' || fits(now, m)) return;
      const p = periods.find((q) => q.state === 'ready' && fits(q, m));
      if (p) playPeriod(p, FADE);
    },
    // The pageant and curtain call bring the band's song back.
    returnToSong() {
      if (!ac || !playing || !track?.buffer || now?.kind === 'song') return;
      playTrack(FADE);
    },
    setPeriodOn(on) {
      periodOn = LEGACY ? !!on : true;
      if (!ac || !playing) return;
      if (!periodOn && now?.kind === 'period' && track?.buffer) playTrack(FADE);
      else if (now?.kind === 'song') now.node.loop = !anyPeriodReady();
    },
    nowPlaying: () => (now ? { kind: now.kind, id: now.id } : null),
    // QA: end the current piece now, as if it had played out (tests only).
    skip() { try { now?.node?.stop(); } catch { /* ignore */ } },
    periodStates: () => periods.map((p) => `${p.id}:${p.state}`),
    // Seconds into the recording (following its loop), or null when it isn't playing.
    songTime() {
      if (!track?.node || !ac || now?.kind !== 'song') return null;
      let t = ac.currentTime - track.startedAt;
      const end = track.loopEnd || track.buffer.duration, start = track.loopStart || 0;
      if (t > end) t = start + ((t - start) % (end - start));
      return Math.max(0, t);
    },
    // The current beat as a running number (its fraction is the phase within
    // the beat). Follows the recording; a steady clock at the same tempo if
    // the song isn't playing.
    beat() {
      const st = this.songTime();
      if (st == null) return performance.now() / 1000 / BEAT.period;
      return (st - BEAT.offset) / BEAT.period;
    },
    sfxLoaded: () => Object.keys(sfxBuf).length,
    // `gain` scales one playing (a quiet footfall from a louder effect).
    play(name, gain = 1) {
      if (!ac) return;
      try {
        // Recorded effects get a little pitch variation so repeats don't grate.
        if (sfxBuf[name]) return playBuffer(sfxBuf[name], (MIX[name] ?? 1) * gain, TONAL.has(name) ? 1 : 0.94 + Math.random() * 0.12);
        SFX[name]?.();
      } catch { /* audio is optional */ }
    },
    // Register delivered effects ({ name: url }); decoded on the first gesture.
    setSfx(urls) { sfxUrls = { ...urls }; if (ac) loadSfx(); },
    setVolumes(m, s) { vol.music = m; vol.sfx = s; apply(); },
    // The finale uses its game clock, so pausing also pauses the long fade.
    // This separate multiplier preserves the player's music-volume setting.
    setMusicLevel(level) {
      level = Math.max(0, Math.min(1, level));
      if (level === musicLevel) return;
      const returning = level > musicLevel;
      musicLevel = level;
      if (ac) music.gain.setTargetAtTime(vol.music * 0.55 * level, ac.currentTime, returning ? 0.8 : 0.04);
    },
    musicLevel: () => musicLevel,
    setSound(on) { soundOn = on; apply(); },
    // For checks: what the master is aimed at.
    state() { return { sound: soundOn, away, master: soundOn && !away ? 1 : 0 }; },
    suspend() { away = true; apply(); ac?.suspend(); },
    resume() { away = false; apply(); ac?.resume(); },
  };
}
