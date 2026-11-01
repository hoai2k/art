// All sound is made in the browser with Web Audio (no audio files yet):
// a soft outdoor ambience (wind in the leaves, distant birds, now and then
// the clock-tower bell from City Hall's side), the squirrel's small sounds
// (pitter-patter, a scrabble of claws on bark, a splash, a thump of landing),
// UI clicks and the discovery chime. Starts on the first user gesture.

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

export function createAudio() {
  let ctx = null;
  let master; let sfxBus; let uiBus; let ambBus; let noiseBuf;
  let wantAmbience = false;
  let ambStarted = false;
  let timers = [];
  const state = { enabled: true, volume: 0.8, active: true };

  const AC = () => globalThis.AudioContext || globalThis.webkitAudioContext;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended' && state.active && state.enabled) ctx.resume?.().catch?.(() => {});
      return true;
    }
    const C = AC();
    if (!C) return false;
    try { ctx = new C(); } catch { return false; }
    master = ctx.createGain();
    master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    uiBus = ctx.createGain(); uiBus.gain.value = 0.6; uiBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.55; ambBus.connect(master);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    // Pinkish noise: a gentle one-pole low-pass of white.
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = last * 1.6; }
    apply();
    if (wantAmbience) startAmbience();
    return true;
  }

  function apply() {
    if (!ctx) return;
    const on = state.enabled && state.active;
    master.gain.setTargetAtTime(on ? state.volume : 0, ctx.currentTime, 0.05);
    if (on) { if (ctx.state === 'suspended') ctx.resume?.().catch?.(() => {}); }
    else setTimeout(() => { if (!(state.enabled && state.active)) ctx?.suspend?.().catch?.(() => {}); }, 200);
  }

  const live = () => ctx && state.enabled && state.active && ctx.state !== 'closed';

  function noiseSrc(rate = 1) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate;
    s.loopStart = Math.random() * 1.5;
    return s;
  }

  // One shaped burst of noise: claws, steps, splash.
  function burst({ bus = sfxBus, t = 0, dur = 0.08, freq = 2500, q = 1.2, type = 'bandpass', gain = 0.3, attack = 0.004, pan = 0 }) {
    const now = ctx.currentTime + t;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let out = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    src.connect(f).connect(g);
    out.connect(bus);
    src.start(now, Math.random() * 1.5, dur + 0.05);
  }

  function tone({ bus = uiBus, t = 0, freq = 440, dur = 0.3, gain = 0.2, type = 'sine', attack = 0.005, slideTo = null, pan = 0, decay = 'exp' }) {
    const now = ctx.currentTime + t;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, now);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + attack);
    if (decay === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, now + dur); else g.gain.linearRampToValueAtTime(0.0001, now + dur);
    let out = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    o.connect(g); out.connect(bus);
    o.start(now); o.stop(now + dur + 0.05);
  }

  // ---- Ambience ------------------------------------------------------------
  function startAmbience() {
    if (!ctx || ambStarted) return;
    ambStarted = true;
    // Wind in the leaves: two bands of noise breathing slowly.
    for (const [freq, q, base, lfoHz] of [[420, 0.5, 0.05, 0.07], [3200, 0.7, 0.018, 0.13]]) {
      const src = noiseSrc(freq > 1000 ? 1.3 : 0.8);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = base;
      const lfo = ctx.createOscillator(); lfo.frequency.value = lfoHz;
      const lg = ctx.createGain(); lg.gain.value = base * 0.8;
      lfo.connect(lg).connect(g.gain);
      const ff = ctx.createGain(); ff.gain.value = freq * 0.25;
      lfo.connect(ff).connect(f.frequency);
      src.connect(f).connect(g).connect(ambBus);
      src.start(); lfo.start();
    }
    scheduleBirds();
    timers.push(setTimeout(scheduleBell, 18000 + Math.random() * 20000));
  }

  function chirp(t, freq, pan, gain = 0.05) {
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      tone({ bus: ambBus, t: t + i * 0.11, freq: freq * (1 + Math.random() * 0.1), slideTo: freq * (1.35 + Math.random() * 0.4), dur: 0.08, gain, type: 'sine', attack: 0.01, pan });
    }
  }
  function scheduleBirds() {
    const next = () => {
      if (live() && wantAmbience) {
        const pan = Math.random() * 1.6 - 0.8;
        const base = 2400 + Math.random() * 1800;
        chirp(0, base, pan, 0.03 + Math.random() * 0.03);
        if (Math.random() < 0.4) chirp(0.7, base * 0.9, pan, 0.025);
      }
      timers.push(setTimeout(next, 2500 + Math.random() * 7000));
    };
    timers.push(setTimeout(next, 1500));
  }
  function bellStroke(t, gain = 0.07) {
    // A bell: inharmonic partials, a long decay, rolled off, from the left of centre.
    const base = 392;
    for (const [ratio, g, d] of [[1, 1, 3.6], [2.0, 0.55, 2.8], [2.76, 0.45, 2.2], [5.4, 0.2, 1.4], [8.9, 0.08, 0.8]]) {
      tone({ bus: ambBus, t, freq: base * ratio, dur: d, gain: gain * g, type: 'sine', attack: 0.004, pan: -0.35 });
    }
    tone({ bus: ambBus, t, freq: base * 0.5, dur: 4.2, gain: gain * 0.7, type: 'sine', attack: 0.004, pan: -0.35 });
  }
  function scheduleBell() {
    if (live() && wantAmbience) {
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) bellStroke(i * 2.4);
    }
    timers.push(setTimeout(scheduleBell, 70000 + Math.random() * 60000));
  }

  const SFX = {
    click() { tone({ freq: 900, slideTo: 1200, dur: 0.06, gain: 0.12, type: 'triangle' }); },
    move() { tone({ freq: 620, dur: 0.04, gain: 0.07, type: 'triangle' }); },
    back() { tone({ freq: 700, slideTo: 450, dur: 0.1, gain: 0.1, type: 'triangle' }); },
    open() { tone({ freq: 520, slideTo: 780, dur: 0.12, gain: 0.1, type: 'triangle' }); },
    chime() {
      // The discovery chime: a rising bell-like arpeggio, soft.
      [69, 73, 76, 81].forEach((m, i) => {
        tone({ freq: hz(m), t: i * 0.11, dur: 1.4, gain: 0.16, type: 'sine', attack: 0.01 });
        tone({ freq: hz(m) * 2.01, t: i * 0.11, dur: 0.7, gain: 0.04, type: 'sine', attack: 0.01 });
      });
    },
    nut() { tone({ freq: 880, slideTo: 1320, dur: 0.12, gain: 0.14, type: 'triangle' }); tone({ freq: 1760, t: 0.08, dur: 0.2, gain: 0.07 }); },
    bury() { burst({ t: 0, dur: 0.14, freq: 500, q: 0.7, gain: 0.35, bus: sfxBus }); burst({ t: 0.12, dur: 0.12, freq: 420, q: 0.7, gain: 0.3, bus: sfxBus }); },
    dig() { for (let i = 0; i < 4; i++) burst({ t: i * 0.1, dur: 0.09, freq: 700 + Math.random() * 500, q: 0.8, gain: 0.3, type: 'bandpass' }); },
    eat() { for (let i = 0; i < 5; i++) burst({ t: i * 0.07, dur: 0.04, freq: 1800 + Math.random() * 900, q: 3, gain: 0.25 }); },
    step(a = 1) { burst({ dur: 0.035, freq: 2600 + Math.random() * 1400, q: 1.6, gain: 0.07 * a, pan: Math.random() * 0.3 - 0.15 }); },
    jump() { burst({ dur: 0.07, freq: 1500, q: 0.8, gain: 0.16 }); tone({ bus: sfxBus, freq: 340, slideTo: 520, dur: 0.07, gain: 0.04, type: 'triangle' }); },
    land(a = 0.5) {
      burst({ dur: 0.1, freq: 160, q: 0.7, type: 'lowpass', gain: 0.35 * Math.min(1, 0.4 + a) });
      burst({ t: 0.01, dur: 0.05, freq: 3000, q: 1, gain: 0.1 * Math.min(1, 0.4 + a) });
    },
    climb() { for (let i = 0; i < 2; i++) burst({ t: i * 0.05, dur: 0.045, freq: 4200 + Math.random() * 1800, q: 2.2, gain: 0.13, pan: Math.random() * 0.4 - 0.2 }); },
    splash() {
      burst({ dur: 0.45, freq: 1400, q: 0.6, gain: 0.35, attack: 0.02 });
      burst({ t: 0.05, dur: 0.3, freq: 3200, q: 0.5, type: 'highpass', gain: 0.15, attack: 0.02 });
      tone({ bus: sfxBus, freq: 300, slideTo: 120, dur: 0.2, gain: 0.12, type: 'sine' });
    },
  };

  const api = {
    get enabled() { return state.enabled; },
    get started() { return !!ctx; },
    get running() { return !!ctx && ctx.state === 'running'; },
    // Call from a user gesture (click, key, controller button).
    unlock() { return ensure(); },
    setEnabled(on) { state.enabled = !!on; if (on) ensure(); apply(); },
    setVolume(v) { state.volume = Math.max(0, Math.min(1, v)); apply(); },
    // False while the page is hidden or the window is in the background.
    setActive(on) { state.active = !!on; apply(); },
    ambience(on) {
      wantAmbience = !!on;
      if (ctx) ambBus.gain.setTargetAtTime(on ? 0.55 : 0.0, ctx.currentTime, 0.6);
      if (on && ctx) startAmbience();
    },
    play(name, arg) {
      if (!live()) return;
      try { SFX[name]?.(arg); } catch { /* sound is optional */ }
    },
    dispose() { timers.forEach(clearTimeout); timers = []; ctx?.close?.(); ctx = null; },
  };
  return api;
}
