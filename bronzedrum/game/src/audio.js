// Sound. Effects are samples generated with ElevenLabs and listed in
// assets/audio.json (built by design/source/build_audio.py); until a sample has
// loaded, or if it is missing, a synthesised stand-in plays instead: a bronze
// drum (deep "tùng" with an inharmonic metal ring, dry rim "cắc") and short
// army calls.

// Seconds a looping track crossfades into its next round.
const MUSIC_XFADE = 3;

/**
 * Move a gain to `to` over `dur` seconds along an equal-power curve, taking
 * over from whatever fade it is in the middle of.
 */
function glide(ctx, param, to, dur) {
  const t = ctx.currentTime;
  const from = param.value;
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
  else {
    param.cancelScheduledValues(t);
    param.setValueAtTime(from, t);
  }
  try {
    param.setValueCurveAtTime(fadeCurve(from, to), t + 0.005, Math.max(0.02, dur));
  } catch {
    param.cancelScheduledValues(t);
    param.setValueAtTime(from, t);
    param.linearRampToValueAtTime(to, t + dur);
  }
}

/** An equal-power fade from a to b (sine/cosine), so a crossfade never dips. */
function fadeCurve(a, b, n = 64) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * (Math.PI / 2);
    c[i] = a > b ? b + (a - b) * Math.cos(x) : a + (b - a) * Math.sin(x);
  }
  return c;
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.8;
    this.muted = false;
    this.ambienceLevel = 0.6;
    this.samples = new Map(); // id -> { buffers, gain, loop }
    this.ambience = null;
    this.musicLevel = 0.6;
    this.musicFiles = new Map(); // id -> { file, loop } for tracks that exist
    this.music = null; // { id, el, gain } now playing
    this.base = 'assets/';
    this.kit = null; // Drum Practice's kit (setKit); null is the bronze drum
  }

  /** Fetch and decode every sample in the audio manifest. */
  async loadSamples(base = 'assets/') {
    if (!this.ctx || this.loading) return this.loading;
    this.loading = (async () => {
      let manifest;
      try {
        manifest = await (await fetch(`${base}audio.json`)).json();
      } catch {
        return;
      }
      for (const [id, m] of Object.entries(manifest.music || {})) this.musicFiles.set(id, m);
      const entries = Object.entries(manifest.sfx || {});
      await Promise.all(
        entries.map(async ([id, e]) => {
          const buffers = [];
          for (const f of e.files) {
            try {
              const data = await (await fetch(`${base}${f}`)).arrayBuffer();
              const buf = await this.ctx.decodeAudioData(data);
              buffers.push(e.loop ? buf : this.trimLead(buf));
            } catch {
              /* a missing or broken file falls back to the stand-in */
            }
          }
          if (buffers.length) this.samples.set(id, { buffers, gain: e.gain ?? 1, loop: !!e.loop });
        }),
      );
    })();
    return this.loading;
  }

  has(id) {
    return this.samples.has(id);
  }

  /** Play a sample (a random variant) at audio time t. Returns false if it is not loaded. */
  play(id, t = this.now, gain = 1, dest = this.master, rate = 1) {
    const s = this.samples.get(id);
    if (!this.ctx || !s) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = s.buffers[Math.floor(Math.random() * s.buffers.length)];
    src.loop = s.loop;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = s.gain * gain;
    src.connect(g).connect(dest);
    src.start(Math.max(t, this.ctx.currentTime));
    return src;
  }

  /** Start a looping ambience bed, replacing any other. */
  startAmbience(id) {
    this.stopAmbience();
    if (!this.ctx || !this.samples.has(id)) return;
    const bus = this.ctx.createGain();
    bus.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.ambienceLevel), this.ctx.currentTime + 1.5);
    bus.connect(this.master);
    const src = this.play(id, this.now, 1, bus);
    this.ambience = { src, bus, layers: new Map() };
  }

  /**
   * A second looping bed over the ambience whose level the scene sets as it
   * goes (Drum Practice's fire, louder as the drumming builds). It stops with
   * the ambience.
   */
  ambienceLayer(id, level) {
    if (!this.ctx || !this.ambience || !this.samples.has(id)) return;
    let layer = this.ambience.layers.get(id);
    if (!layer) {
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.ambience.bus);
      layer = { gain, src: this.play(id, this.now, 1, gain), level: 0 };
      this.ambience.layers.set(id, layer);
    }
    if (Math.abs(level - layer.level) < 0.01) return;
    layer.level = level;
    layer.gain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.4);
  }

  stopAmbience() {
    this.stopBreeze();
    if (!this.ambience) return;
    const { src, bus } = this.ambience;
    const t = this.ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.stop(t + 0.7);
    for (const l of this.ambience.layers.values()) if (l.src) l.src.stop(t + 0.7);
    this.ambience = null;
  }

  // ------------------------------------------------------------- music
  // Tracks are long, so they stream through <audio> elements into a music bus
  // instead of being decoded up front. A track with no file yet is silent.

  setMusic(v) {
    this.musicLevel = v;
    if (!this.music) return;
    // Only the voice that is not fading out follows the slider.
    const cur = this.music.current;
    if (cur && !cur.out && !cur.el.paused) glide(this.ctx, cur.gain.gain, v * this.music.level, 0.15);
  }

  /**
   * Crossfade to a track. id may be a list: the first track whose file exists
   * plays (a chapter's own bed, else the shared one). level scales it.
   *
   * A looping track with loop points (from build_audio.py) never just
   * restarts: just before loopEnd a second voice starts at loopStart and the
   * two crossfade over MUSIC_XFADE seconds, so the track's own fade-out, its
   * fade-in and the gap browsers leave when an MP3 loops are never heard.
   */
  /** The menus (title, chapter select): the anthem, round and round. */
  menuMusic() {
    this.playMusic('mu-anthem', { loop: true });
  }

  /** Drum Practice's screen of modes: the old menu theme (the two sisters); the drumming itself has none. */
  practiceMusic() {
    this.playMusic('mu-select');
  }

  playMusic(id, { level = 1, fade = 1.2, loop = null } = {}) {
    if (!this.ctx) return;
    if (Array.isArray(id)) id = id.find((x) => this.musicFiles.has(x)) || id[0];
    if (this.music && this.music.id === id) return;
    this.stopMusic(fade);
    const m = this.musicFiles.get(id);
    if (!m) return;
    // loop: play a track that does not loop by itself round and round (the anthem on the menus).
    const music = { id, m: loop === null ? m : { ...m, loop }, level, voices: new Set(), current: null, next: null };
    this.music = music;
    music.current = this.voice(music, 0, fade);
    music.timer = setInterval(() => this.loopTick(music), 100);
  }

  /** One playing copy of a track, from `from` seconds, fading in over `fade`. */
  voice(music, from, fade, start = true) {
    const el = new Audio(`${this.base}${music.m.file}${from ? `#t=${from}` : ''}`);
    el.preload = 'auto';
    // Without loop points, fall back to the element's own loop.
    el.loop = !!music.m.loop && !music.m.loopEnd;
    el.crossOrigin = 'anonymous';
    const src = this.ctx.createMediaElementSource(el);
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    src.connect(gain).connect(this.master);
    const v = { el, gain, from, out: false, endAt: Infinity };
    music.voices.add(v);
    if (start) this.startVoice(music, v, fade);
    return v;
  }

  startVoice(music, v, fade) {
    v.gain.gain.value = 0;
    glide(this.ctx, v.gain.gain, this.musicLevel * music.level, fade);
    if (v.from && Math.abs(v.el.currentTime - v.from) > 0.25) {
      try {
        v.el.currentTime = v.from;
      } catch {
        /* the #t= fragment already placed it */
      }
    }
    // In the background it waits: setFocused(true) starts it.
    if (this.focused !== false) v.el.play().catch(() => {});
  }

  fadeOutVoice(music, v, fade) {
    v.out = true;
    glide(this.ctx, v.gain.gain, 0, fade);
    v.endAt = this.ctx.currentTime + fade + 0.05;
  }

  /** Hand a looping track over to its next voice, and retire faded voices. */
  loopTick(music) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const m = music.m;
    const cur = music.current;
    if (m.loop && m.loopEnd && cur && !cur.out && this.music === music) {
      const left = m.loopEnd - cur.el.currentTime;
      // Get the next copy loading a few seconds ahead, so it starts on time.
      if (!music.next && left < MUSIC_XFADE + 6) music.next = this.voice(music, m.loopStart || 0, MUSIC_XFADE, false);
      if (left <= MUSIC_XFADE && music.next) {
        this.fadeOutVoice(music, cur, MUSIC_XFADE);
        this.startVoice(music, music.next, MUSIC_XFADE);
        music.current = music.next;
        music.next = null;
      }
    }
    for (const v of music.voices) {
      if (this.ctx.currentTime >= v.endAt) {
        v.el.pause();
        v.el.removeAttribute('src');
        music.voices.delete(v);
      }
    }
    if (this.music !== music && !music.voices.size) clearInterval(music.timer);
  }

  stopMusic(fade = 0.8) {
    if (!this.music || !this.ctx) return;
    const music = this.music;
    for (const v of music.voices) {
      if (v === music.next) {
        music.voices.delete(v);
        continue;
      }
      if (!v.out) this.fadeOutVoice(music, v, fade);
    }
    music.next = null;
    this.music = null;
  }

  /** A one-off over whatever is playing (the drum-wake swell). */
  musicOverlay(id, level = 0.9) {
    const m = this.musicFiles.get(id);
    if (!this.ctx || !m) return;
    const el = new Audio(`${this.base}${m.file}`);
    const src = this.ctx.createMediaElementSource(el);
    const gain = this.ctx.createGain();
    gain.gain.value = this.musicLevel * level;
    src.connect(gain).connect(this.master);
    if (this.focused !== false) el.play().catch(() => {});
  }

  /** Pause and resume with the game (the audio clock suspends; elements do not). */
  pauseMusic(paused) {
    this.musicPaused = paused;
    if (!this.music) return;
    for (const v of this.music.voices) {
      if (v === this.music.next) continue;
      if (paused) v.el.pause();
      else if (this.focused !== false) v.el.play().catch(() => {});
    }
    // The volume may have changed in Settings while paused.
    const cur = this.music.current;
    if (!paused && cur && !cur.out) glide(this.ctx, cur.gain.gain, this.musicLevel * this.music.level, 0.3);
  }

  /**
   * The Oath's breeze: a looping wind that fades in while A or Y is held and
   * out when released (level 0..1). Started on first use, kept running quietly.
   */
  setBreeze(level) {
    if (!this.ctx || !this.samples.has('breeze')) return;
    if (!this.breeze) {
      if (level <= 0) return;
      const bus = this.ctx.createGain();
      bus.gain.value = 0;
      bus.connect(this.master);
      const src = this.play('breeze', this.now, 1, bus);
      this.breeze = { bus, src, level: 0 };
    }
    if (Math.abs(level - this.breeze.level) < 0.01) return;
    this.breeze.level = level;
    glide(this.ctx, this.breeze.bus.gain, level * this.ambienceLevel, level > 0 ? 0.35 : 0.8);
  }

  stopBreeze() {
    if (!this.breeze) return;
    const { bus, src } = this.breeze;
    glide(this.ctx, bus.gain, 0, 0.4);
    setTimeout(() => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      bus.disconnect();
    }, 600);
    this.breeze = null;
  }

  setAmbience(v) {
    this.ambienceLevel = v;
    if (this.ambience) this.ambience.bus.gain.setTargetAtTime(Math.max(0.0001, v), this.ctx.currentTime, 0.1);
  }

  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      // A limiter at the end of the mix: a drum stroke landing on the army's
      // echoes, the music and the ambience peaked over full scale and
      // clipped, which on the bronze drum sounds like a harsh metallic crack.
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -8;
      this.limiter.knee.value = 4;
      this.limiter.ratio.value = 16;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.12;
      // The pause fade: the last gain before the speakers.
      this.out = this.ctx.createGain();
      // Silent while the tab or window is in the background (setFocused).
      this.focusGain = this.ctx.createGain();
      this.focusGain.gain.value = this.focused === false ? 0 : 1;
      this.master.connect(this.limiter).connect(this.out).connect(this.focusGain).connect(this.ctx.destination);
      this.noise = this.makeNoise();
      this.setVolume(this.volume);
    }
    if (this.ctx.state === 'suspended' && this.focused !== false) this.ctx.resume();
  }

  /**
   * Silence everything while the game's tab or window is not focused: fade
   * out, then stop the audio clock (no sound, no scheduled strokes, no music
   * loop ticking over), and pause the music elements. On return only what was
   * running comes back: a clock stopped by the pause menu stays stopped.
   */
  setFocused(focused) {
    if (this.focused === focused) return;
    this.focused = focused;
    if (!this.focusGain) return;
    if (!focused) {
      this.focusHeld = this.ctx.state === 'running' && !this.paused;
      clearTimeout(this.focusTimer);
      this.focusTimer = setTimeout(() => {
        if (this.focused === false && this.ctx.state === 'running') this.ctx.suspend();
      }, 100);
    } else {
      clearTimeout(this.focusTimer);
      if (this.focusHeld && !this.paused) this.ctx.resume();
      this.focusHeld = false;
    }
    const t = this.ctx.currentTime;
    const g = this.focusGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(focused ? 1 : 0, t + (focused ? 0.3 : 0.08));
    // Streamed music plays through <audio> elements: hold them too.
    if (this.music) {
      for (const v of this.music.voices) {
        if (v === this.music.next) continue;
        if (!focused) v.el.pause();
        else if (!this.musicPaused) v.el.play().catch(() => {});
      }
    }
  }

  /** Pause: fade out over a few milliseconds, then stop the audio clock. */
  async suspend() {
    if (!this.ctx) return;
    this.paused = true;
    // Already stopped for the background: it stays stopped when focus returns.
    if (this.focusHeld) this.focusHeld = false;
    if (this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + 0.06);
    this.suspending = new Promise((r) => setTimeout(r, 80)).then(() => this.ctx.suspend());
    await this.suspending;
  }

  /** Resume: restart the clock and fade back in, so nothing starts on a hard edge. */
  async resume() {
    if (!this.ctx) return;
    this.paused = false;
    if (this.suspending) await this.suspending;
    // In the background the clock stays stopped until focus returns.
    if (this.focused === false) {
      this.focusHeld = true;
    } else await this.ctx.resume();
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(1, t + 0.25);
  }

  /**
   * A one-shot sample without the silence before its attack. MP3 files carry
   * about 25 ms of encoder and decoder padding at the start; Chrome removes it
   * while decoding, but not every browser does, and a drum stroke that starts
   * 25 ms late feels late. Anything quieter than -50 dB before the first sound
   * is cut, keeping half a millisecond.
   */
  trimLead(buf) {
    const n = buf.length;
    let first = n;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < Math.min(first, n); i++) {
        if (Math.abs(d[i]) > 0.003) {
          first = i;
          break;
        }
      }
    }
    const cut = first - Math.round(buf.sampleRate * 0.0005);
    if (cut < buf.sampleRate * 0.001 || cut >= n) return buf;
    const out = this.ctx.createBuffer(buf.numberOfChannels, n - cut, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(cut), c);
    return out;
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  /** Output latency in seconds: the delay between scheduling and hearing. */
  get latency() {
    if (!this.ctx) return 0;
    return (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  }

  /** The Sound button: silences the whole mix (music, ambience, strokes) at the master. */
  setMuted(muted) {
    this.muted = !!muted;
    this.setVolume(this.volume);
  }

  makeNoise() {
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  env(gain, t, peak, decay) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }

  tone(type, freq, t, peak, decay, endFreq, dest = this.master) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + decay * 0.6);
    this.env(g, t, peak, decay);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  noiseBurst(t, peak, decay, filterType, freq, q = 1, dest = this.master) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, peak, decay);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 0.5);
    s.stop(t + decay + 0.05);
  }

  /**
   * Drum Practice can swap the bronze drum for another kit (practice.js
   * KITS): its low voice takes Trắc's strokes and its high voice Nhị's.
   * null is the bronze drum.
   */
  setKit(kit) {
    this.kit = kit && kit.id !== 'bronze' ? kit : null;
  }

  /** A stroke on the current kit: its sample, or a synthesised stand-in. */
  kitStroke(drum, t, gain = 1, rate = 1, dest = this.master) {
    const k = this.kit;
    const src = this.play(k[drum], t, gain, dest, rate);
    const tone = (type, f, at, peak, d, end) => this.tone(type, f, at, peak, d, end, dest);
    const noise = (at, peak, d, type, f, q = 1) => this.noiseBurst(at, peak, d, type, f, q, dest);
    if (src) return src;
    const low = drum === 'L';
    const a = gain;
    switch (k.id) {
      case 'temple':
        if (low) {
          tone('sine', 92 * rate, t, 0.8 * a, 0.4, 50);
          noise(t, 0.25 * a, 0.12, 'lowpass', 500);
        } else {
          tone('sine', 820 * rate, t, 0.35 * a, 0.09);
          noise(t, 0.2 * a, 0.04, 'bandpass', 1400, 3);
        }
        break;
      case 'rice':
        tone('sine', (low ? 150 : 410) * rate, t, (low ? 0.75 : 0.45) * a, low ? 0.4 : 0.16, low ? 132 : 390);
        noise(t, 0.15 * a, 0.03, 'bandpass', low ? 700 : 2400, 2);
        break;
      case 'gongs':
        for (const [f, amp, d] of low ? [[146, 0.5, 1.8], [293, 0.18, 1.2], [441, 0.08, 0.9]] : [[523, 0.3, 1.1], [1049, 0.1, 0.7], [1571, 0.05, 0.5]]) {
          tone('sine', f * rate, t, amp * a, d);
        }
        break;
      case 'bamboo':
        tone('triangle', (low ? 294 : 698) * rate, t, (low ? 0.5 : 0.35) * a, low ? 0.25 : 0.12);
        noise(t, 0.12 * a, 0.02, 'bandpass', low ? 900 : 2600, 3);
        break;
      case 'lion':
        if (low) {
          tone('sine', 78 * rate, t, 0.9 * a, 0.45, 44);
          noise(t, 0.3 * a, 0.1, 'lowpass', 700);
        } else {
          noise(t, 0.35 * a, 0.45, 'highpass', 4500);
          noise(t, 0.2 * a, 0.2, 'bandpass', 2800, 2);
        }
        break;
    }
    return null;
  }

  /** A gain stage of its own (Drum Practice's loop), so it can be quieted and stopped as one. */
  bus(level = 1) {
    if (!this.ctx) return null;
    const g = this.ctx.createGain();
    g.gain.value = level;
    g.connect(this.master);
    return g;
  }

  /** Fade a bus to a level over dur seconds. */
  fadeBus(bus, to, dur = 0.3) {
    if (bus && this.ctx) glide(this.ctx, bus.gain, to, dur);
  }

  /** Drum Practice's secondary drum: one sample, with a short thud as its stand-in. */
  secondStroke(sample, t = this.now, gain = 1, rate = 1, dest = this.master) {
    if (!this.ctx) return null;
    const src = this.play(sample, t, gain, dest, rate);
    if (src) return src;
    this.tone('sine', 130 * rate, t, 0.6 * gain, 0.3, 70, dest);
    this.noiseBurst(t, 0.2 * gain, 0.06, 'bandpass', 900, 2, dest);
    return null;
  }

  /** Trắc's deep centre stroke. */
  tung(t = this.now, strong = false) {
    if (!this.ctx) return;
    if (this.kit) return this.kitStroke('L', t, strong ? 1.1 : 1);
    const src = this.play('drum-tung', t, strong ? 1.15 : 1);
    if (src) return src;
    const k = strong ? 1.25 : 1;
    this.tone('sine', 110, t, 0.9 * k, 0.55, 52);
    // Bronze: a few inharmonic partials that ring after the thump.
    for (const [f, a, d] of [[187, 0.12, 1.1], [301, 0.08, 0.9], [457, 0.05, 0.7], [733, 0.03, 0.5]]) {
      this.tone('sine', f, t, a * k, d);
    }
    this.noiseBurst(t, 0.25, 0.08, 'lowpass', 900);
  }

  /** Nhị's rim stroke. */
  cac(t = this.now, soft = false) {
    if (!this.ctx) return;
    if (this.kit) return this.kitStroke('R', t, soft ? 0.7 : 1);
    const src = this.play('drum-cac', t, soft ? 0.7 : 1);
    if (src) return src;
    const k = soft ? 0.55 : 1;
    this.noiseBurst(t, 0.5 * k, 0.05, 'bandpass', 3200, 4);
    this.tone('triangle', 1870, t, 0.18 * k, 0.07);
    this.tone('sine', 1243, t, 0.1 * k, 0.25);
  }

  /**
   * The army's drums echoing a stroke: the same bronze drum, a little lower
   * and softer, so the player can tell their own strokes from the answer.
   * Returns the source so a cancelled answer can be silenced.
   */
  echo(drum, t, level, rate = 0.9, dest = this.master) {
    if (!this.ctx || level <= 0) return null;
    if (this.kit) return this.kitStroke(drum, t, level, rate, dest);
    const id = drum === 'L' ? 'drum-tung' : 'drum-cac';
    const src = this.play(id, t, level, dest, rate);
    if (src) return src;
    // Stand-in: a short low tone.
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = drum === 'L' ? 95 : 1500;
    this.env(g, t, 0.5 * level, drum === 'L' ? 0.3 : 0.06);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.4);
    return o;
  }

  /** The army answers: a short rising vocal shout. */
  call(t, pitch = 1) {
    if (!this.ctx) return;
    if (this.has('call')) return void this.play('call', t);
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220 * pitch, t);
    o.frequency.linearRampToValueAtTime(300 * pitch, t + 0.12);
    f.type = 'bandpass';
    f.frequency.value = 800;
    f.Q.value = 3;
    this.env(g, t, 0.12, 0.22);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.3);
  }

  clash(t = this.now) {
    if (!this.ctx) return;
    this.noiseBurst(t, 0.3, 0.15, 'highpass', 2500);
    this.tone('square', 640, t, 0.04, 0.1);
  }

  thud(t = this.now) {
    if (!this.ctx) return;
    this.tone('sine', 70, t, 0.6, 0.35, 35);
    this.noiseBurst(t, 0.3, 0.3, 'lowpass', 400);
  }

  miss(t = this.now) {
    if (!this.ctx) return;
    if (this.play('stumble', t)) return;
    this.tone('sawtooth', 160, t, 0.08, 0.18, 90);
  }
}
