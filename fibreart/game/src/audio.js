// Sound: the game's song (web/audio/, looping under every scene), plucked
// notes for button actions, a breathy rush that follows swirls and tides, and
// a few chimes when a control is found or the picture moves on, all in the
// song's key so they play along with it. If the song cannot load, a soft held
// chord made in the browser stands in for it, one per scene.

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
// With the song (Aksak Folk Dance, in C minor): the minor pentatonic.
const MINOR = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
// One root per scene, so each picture has its own key.
const ROOTS = [57, 50, 55, 52, 59, 53, 48, 45, 54, 60];
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

export function createAudio() {
  let ctx = null;
  let master;
  let music;
  let sfx;
  let rushGain;
  let rushFilter;
  let drone = null;
  // The song: an <audio> element routed through the music volume.
  let song = null; // { el, root } once it plays; null until then or if it failed
  let songWanted = null; // { url, root } from setSong
  let songFailed = false;
  const vol = { volume: 0.8, music: 0.6, sfx: 0.8, muted: false };
  // False while the page is hidden or the window is in the background: the
  // context stays suspended and nothing new is scheduled until it is back.
  let active = true;

  function ensure() {
    if (!active) return false;
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      startSong();
      return true;
    }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    music = ctx.createGain();
    music.connect(master);
    sfx = ctx.createGain();
    sfx.connect(master);
    // A rush of filtered noise for the large movements.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    rushFilter = ctx.createBiquadFilter();
    rushFilter.type = 'bandpass';
    rushFilter.Q.value = 0.8;
    rushFilter.frequency.value = 500;
    rushGain = ctx.createGain();
    rushGain.gain.value = 0;
    noise.connect(rushFilter).connect(rushGain).connect(sfx);
    noise.start();
    apply();
    startSong();
    return true;
  }

  // Start the song once there is a context to play it through (after a tap,
  // click or key: browsers do not allow sound before one).
  function startSong() {
    if (!ctx || songFailed || !songWanted) return;
    if (song) {
      if (song.el.paused && active) playSong();
      return;
    }
    const el = new Audio();
    el.src = songWanted.url;
    el.loop = true;
    el.preload = 'auto';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    try {
      ctx.createMediaElementSource(el).connect(gain).connect(music);
    } catch {
      songFailed = true;
      return;
    }
    song = { el, gain, root: songWanted.root };
    el.addEventListener('error', () => {
      // No song after all: back to the chords made in the browser.
      songFailed = true;
      song = null;
      if (lastScene !== null) scene(lastScene);
    });
    playSong();
  }

  function playSong() {
    const { el, gain } = song;
    el.play().then(() => {
      gain.gain.setTargetAtTime(0.75, ctx.currentTime, 1.5);
      if (drone) {
        const old = drone;
        drone = null;
        old.gain.gain.setTargetAtTime(0, ctx.currentTime, 1);
        setTimeout(() => old.oscs.forEach((o) => o.stop()), 4000);
      }
    }).catch(() => { /* blocked until the next gesture: ensure() tries again */ });
  }
  let lastScene = null;

  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(vol.muted || !active ? 0 : vol.volume, t, 0.05);
    music.gain.setTargetAtTime(vol.music * 0.5, t, 0.05);
    sfx.gain.setTargetAtTime(vol.sfx * 0.6, t, 0.05);
  }

  function scene(index) {
    lastScene = index;
    if (!ensure()) return;
    // The song carries every scene; the chords only stand in without it.
    if (songWanted && !songFailed) return;
    const t = ctx.currentTime;
    if (drone) {
      const old = drone;
      old.gain.gain.setTargetAtTime(0, t, 1.2);
      setTimeout(() => old.oscs.forEach((o) => o.stop()), 5000);
    }
    const root = ROOTS[index % ROOTS.length];
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.16, t, 2);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    gain.connect(filter).connect(music);
    const oscs = [];
    [0, 7, 16, 21].forEach((step, i) => {
      for (const det of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = hz(root - 12 + step);
        o.detune.value = det + i;
        const g = ctx.createGain();
        g.gain.value = (i === 0 ? 0.5 : 0.22) / 2;
        // Each voice breathes at its own slow rate.
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.05 + i * 0.031 + (det > 0 ? 0.013 : 0);
        const lg = ctx.createGain();
        lg.gain.value = g.gain.value * 0.6;
        lfo.connect(lg).connect(g.gain);
        o.connect(g).connect(gain);
        o.start();
        lfo.start();
        oscs.push(o, lfo);
      }
    });
    drone = { gain, oscs, root };
  }

  function note(step, { length = 0.9, level = 0.3, type = 'triangle', octave = 0, when = 0 } = {}) {
    if (!ensure()) return;
    const withSong = songWanted && !songFailed;
    const root = withSong ? songWanted.root : drone ? drone.root : 57;
    const scale = withSong ? MINOR : SCALE;
    const m = root + 12 * octave + scale[((step % scale.length) + scale.length) % scale.length];
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + length);
    o.connect(g).connect(sfx);
    o.start(t);
    o.stop(t + length + 0.05);
  }

  return {
    unlock: ensure,
    // Silence everything while the page is hidden or unfocused; resume after.
    setActive(on) {
      active = on;
      apply();
      if (!ctx) return;
      if (on) ctx.resume().catch(() => {});
      else ctx.suspend().catch(() => {});
      // The song waits where it was, rather than running on in silence.
      if (song) {
        if (on) song.el.play().catch(() => {});
        else song.el.pause();
      }
    },
    // The game's song: plays from the first gesture, loops under every scene.
    setSong(url, root = 60) {
      songWanted = { url, root };
      startSong();
    },
    get songPlaying() { return !!song && !song.el.paused; },
    // For checks: the master level that is aimed at right now.
    get state() { return { muted: vol.muted, active, master: vol.muted || !active ? 0 : vol.volume }; },
    set(v) {
      Object.assign(vol, v);
      apply();
    },
    scene,
    // A plucked note for a button action; `size` 0 small .. 2 large.
    pluck(seed, size = 0) {
      note(Math.floor(seed) % 8, { level: 0.18 + size * 0.08, octave: size === 2 ? -1 : 0, length: 0.7 + size * 0.5 });
    },
    found(scale) {
      const steps = scale === 'large' ? [0, 4, 7, 9] : scale === 'medium' ? [2, 4, 7] : [4, 7];
      steps.forEach((s, i) => note(s, { when: i * 0.09, level: 0.14, type: 'sine', octave: 1, length: 1.2 }));
    },
    woke() {
      [0, 2, 4, 7, 9].forEach((s, i) => note(s, { when: i * 0.07, level: 0.1, type: 'sine', octave: 1, length: 1.5 }));
    },
    shift() {
      [0, 4, 7, 9, 12].forEach((s, i) => note(s, { when: i * 0.16, level: 0.16, type: 'sine', length: 2.6 }));
    },
    link() {
      note(9, { level: 0.12, type: 'sine', octave: 1, length: 0.5 });
      note(11, { when: 0.06, level: 0.1, type: 'sine', octave: 1, length: 0.6 });
    },
    // Follows the size of the swirls and tides, every frame.
    rush(level) {
      if (!ctx || !rushGain) return;
      const t = ctx.currentTime;
      rushGain.gain.setTargetAtTime(Math.min(0.5, level * 0.35), t, 0.15);
      rushFilter.frequency.setTargetAtTime(300 + level * 900, t, 0.2);
    },
  };
}
