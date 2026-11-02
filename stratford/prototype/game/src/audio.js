// Sound: recorded effects (web/sfx/index.json, made by tools/sfx/generate.py, decoded on
// first use and cached) with a Web Audio synthesised stand-in for every sound that is not
// delivered or not yet decoded: a soft outdoor ambience (wind, distant birds, the City Hall
// bell), the creatures' small sounds, UI clicks and the discovery chime. Recorded ones
// play a random variant with a little pitch and volume jitter, a voice limit per sound,
// and (playAt) from a place in the town. Held ambient loops are not in the index until the
// owner approves them. Starts on the first user gesture.
import { createGrid, distanceGain, distanceCutoff, mainStreetPoints } from './sfx-map.js';
import { buildZones, bedGains, BEDS } from './ambience-zones.js';

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

// Logical names the game plays -> the recorded sound; a sound with no recording falls back to the synth.
const ALIAS = { click: 'ui_confirm', move: 'ui_move', back: 'ui_back', open: 'map_open', chime: 'discover', nut: 'nut_pickup', eat: 'squirrel_eat', bury: 'squirrel_dig', dig: 'squirrel_dig' };
const UI = new Set(['ui_move', 'ui_confirm', 'ui_back', 'map_open', 'discover', 'creature_switch', 'nut_pickup']);
const SYNTH_FOR = { squirrel_land: 'land', leaf_pile_burst: 'land', beaver_step: 'step', rabbit_hop: 'step', swan_land_water: 'splash', dive: 'splash', surface: 'splash',
  squirrel_step_pavement: 'step', squirrel_step_leaves: 'step', squirrel_step_grass: 'step', squirrel_climb_bark: 'climb', squirrel_climb_brick: 'climb' };
// Voice limit and the shortest gap (s) between two starts of one sound, so rapid steps never stack.
const VOICES = { default: [3, 0.04], squirrel_step_pavement: [2, 0.07], squirrel_step_leaves: [2, 0.07], squirrel_step_grass: [2, 0.07], beaver_step: [2, 0.1], rabbit_hop: [2, 0.1],
  squirrel_climb_bark: [2, 0.08], squirrel_climb_brick: [2, 0.08], heron_wade: [2, 0.15], swim_paddle: [2, 0.2], city_hall_bell: [4, 1], car_pass: [2, 4], wind_gust: [2, 4] };
const CORE = ['ui_move', 'ui_confirm', 'ui_back', 'map_open', 'discover', 'squirrel_step_pavement', 'squirrel_step_leaves', 'squirrel_step_grass', 'squirrel_climb_bark', 'squirrel_climb_brick', 'squirrel_land'];
const BIRDS = ['crow_call', 'bluejay_call', 'chickadee_call'];

export function createAudio() {
  let ctx = null;
  let master; let sfxBus; let uiBus; let ambBus; let noiseBuf;
  let wantAmbience = false;
  let ambStarted = false;
  let timers = [];
  const state = { enabled: true, volume: 0.8, active: true };
  // recorded sounds
  let index = null; let indexLoading = false;
  const cache = new Map();   // name -> { buffers: AudioBuffer[], last: number } once decoded, or null while loading
  const voices = new Map(); const lastStart = new Map();
  let windBus = null;
  const listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
  const sources = { trees: null, streets: [], cityHall: null, waterAt: null };

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
    loadIndex();
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
    windBus = ctx.createGain(); windBus.connect(ambBus);
    for (const [freq, q, base, lfoHz] of [[420, 0.5, 0.05, 0.07], [3200, 0.7, 0.018, 0.13]]) {
      const src = noiseSrc(freq > 1000 ? 1.3 : 0.8);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = base;
      const lfo = ctx.createOscillator(); lfo.frequency.value = lfoHz;
      const lg = ctx.createGain(); lg.gain.value = base * 0.8;
      lfo.connect(lg).connect(g.gain);
      const ff = ctx.createGain(); ff.gain.value = freq * 0.25;
      lfo.connect(ff).connect(f.frequency);
      src.connect(f).connect(g).connect(windBus);
      src.start(); lfo.start();
    }
    scheduleBirds();
    timers.push(setTimeout(scheduleBell, 18000 + Math.random() * 20000));
    scheduleWorld();
    startBeds();
  }

  // Recorded gusts of wind (by the trees) and a car now and then on a main street.
  function scheduleWorld() {
    const gust = () => {
      if (live() && wantAmbience && hasSample('wind_gust')) {
        const t = treeNear(45);
        sample('wind_gust', { gain: 0.8, pos: t ? { x: t.x, y: (t.height || 8) * 0.7, z: t.z } : null, jitter: 0.08 });
      }
      timers.push(setTimeout(gust, rnd(22000, 50000)));
    };
    const car = () => {
      if (live() && wantAmbience && hasSample('car_pass') && sources.streets.length) {
        let best = null; let bd = 140;
        for (let k = 0; k < 400; k++) {
          const p = sources.streets[Math.floor(Math.random() * sources.streets.length)];
          const d = Math.hypot(p.x - listener.x, p.z - listener.z);
          if (d < bd && d > 12) { bd = d; best = p; }
        }
        if (best) sample('car_pass', { pos: { x: best.x, y: 0, z: best.z }, jitter: 0.06 });
      }
      timers.push(setTimeout(car, rnd(25000, 60000)));
    };
    timers.push(setTimeout(gust, rnd(8000, 20000)), setTimeout(car, rnd(15000, 35000)));
  }

  function chirp(t, freq, pan, gain = 0.05) {
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      tone({ bus: ambBus, t: t + i * 0.11, freq: freq * (1 + Math.random() * 0.1), slideTo: freq * (1.35 + Math.random() * 0.4), dur: 0.08, gain, type: 'sine', attack: 0.01, pan });
    }
  }
  function scheduleBirds() {
    const next = () => {
      const names = BIRDS.filter(hasSample);
      if (live() && wantAmbience && names.length) {
        const t = treeNear(50);   // birds sit in trees; none nearby, none heard
        if (t) sample(names[Math.floor(Math.random() * names.length)], { pos: { x: t.x, y: (t.height || 8) * 0.8, z: t.z }, gain: 0.9, jitter: 0.07 });
      } else if (live() && wantAmbience) {
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
      const n = 1 + Math.floor(Math.random() * 4);
      // from City Hall when it is delivered (every stroke a recording), else the synth bell
      for (let i = 0; i < n; i++) {
        if (hasSample('city_hall_bell') && sources.cityHall) timers.push(setTimeout(() => { if (live()) sample('city_hall_bell', { pos: sources.cityHall, jitter: 0.01 }); }, i * 5200));
        else bellStroke(i * 2.4);
      }
    }
    timers.push(setTimeout(scheduleBell, 70000 + Math.random() * 60000));
  }

  // ---- Recorded sounds -----------------------------------------------------------
  function loadIndex() {
    if (index || indexLoading || typeof fetch !== 'function') return;
    indexLoading = true;
    fetch(new URL('../web/sfx/index.json', import.meta.url))
      .then((r) => (r.ok ? r.json() : null)).then((j) => { index = j || {}; preload(CORE); if (ambStarted) startBeds(); })
      .catch(() => { index = {}; });
  }
  const hasSample = (name) => !!(index && Array.isArray(index[name]) && index[name].length);

  // The decoded variants of `name`, or null while they load (the first play uses the synth).
  function samples(name) {
    if (!hasSample(name)) return null;
    const c = cache.get(name);
    if (c) return c;
    if (c === undefined) {
      cache.set(name, null);
      Promise.all(index[name].map((p) => fetch(new URL('../web/' + p, import.meta.url)).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b))))
        .then((buffers) => cache.set(name, { buffers, last: -1 }))
        .catch(() => cache.delete(name));
    }
    return null;
  }
  const preload = (names) => { if (ctx) for (const n of names) samples(n); };

  // Play a recorded sound. Returns false when it is not available (use the synth), true when played
  // or deliberately skipped by the voice limit.
  function sample(name, { gain = 1, rate = 1, jitter = 0.05, pos = null, bus = null, loop = false } = {}) {
    const c = samples(name);
    if (!c) return false;
    const [maxV, gap] = VOICES[name] || VOICES.default;
    const now = ctx.currentTime;
    if ((voices.get(name) || 0) >= maxV || now - (lastStart.get(name) ?? -9) < gap) return true;
    let i = Math.floor(Math.random() * c.buffers.length);
    if (c.buffers.length > 1 && i === c.last) i = (i + 1) % c.buffers.length;
    c.last = i;
    const src = ctx.createBufferSource();
    src.buffer = c.buffers[i]; src.loop = loop;
    src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * jitter);
    const g = ctx.createGain();
    g.gain.value = gain * (index._levels?.[name] ?? 1) * (1 + (Math.random() * 2 - 1) * 0.12);
    let node = src;
    let pan = 0;
    if (pos) {
      const dx = pos.x - listener.x; const dz = pos.z - listener.z;
      const d = Math.hypot(dx, dz, (pos.y ?? listener.y) - listener.y);
      if (d > 900) return true;
      g.gain.value *= distanceGain(d);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = distanceCutoff(d);
      node = node.connect(lp);
      pan = Math.max(-0.9, Math.min(0.9, d > 1 ? (dx * listener.rx + dz * listener.rz) / Math.hypot(dx, dz) : 0));
    }
    node.connect(g);
    let out = g;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    out.connect(bus || (UI.has(name) ? uiBus : sfxBus));
    voices.set(name, (voices.get(name) || 0) + 1); lastStart.set(name, now);
    src.onended = () => { voices.set(name, Math.max(0, (voices.get(name) || 1) - 1)); try { out.disconnect(); } catch { /* gone */ } };
    src.start();
    return true;
  }

  // Ambient beds: approved loops placed by area (ambience-zones.js), crossfading slowly as the listener
  // moves. A bed's source runs only while it is audible. The synth wind stays under everything as the
  // base bed, so there is never silence between zones.
  const beds = new Map();   // name -> { src, g, target, quiet }
  let zones = null; let zoomNow = 0; let underwaterNow = false;
  function bedTargets() {
    if (!zones) return {};
    const w = zones.weights(listener.x, listener.z);
    const gains = bedGains(w, { underwater: underwaterNow, zoom: zoomNow, hasRiverFlow: hasSample(BEDS.river) });
    const out = {};
    for (const [k, v] of Object.entries(gains)) out[BEDS[k]] = v * (k === 'underwater' ? 1 : 1) * (index?._levels?.[BEDS[k]] ?? 0.5);
    return out;
  }
  function tickBeds() {
    if (!ctx || !index || !zones) return;
    const want = live() && wantAmbience ? bedTargets() : {};
    const names = new Set([...Object.keys(want), ...beds.keys()]);
    for (const name of names) {
      const t = want[name] || 0;
      let bed = beds.get(name);
      if (!bed) {
        if (t <= 0.003 || !hasSample(name)) continue;
        const c = samples(name);
        if (!c) continue;    // still decoding: next tick
        const src = ctx.createBufferSource(); src.buffer = c.buffers[Math.floor(Math.random() * c.buffers.length)]; src.loop = true;
        const g = ctx.createGain(); g.gain.value = 0;
        src.connect(g).connect(ambBus); src.start(0, Math.random() * src.buffer.duration);
        bed = { src, g, quiet: 0 }; beds.set(name, bed);
      }
      // slow fades: about 3 s to follow a change (under water: quicker)
      bed.g.gain.setTargetAtTime(t, ctx.currentTime, name === 'underwater' ? 0.4 : 1.4);
      bed.quiet = t <= 0.003 ? bed.quiet + 0.4 : 0;
      if (bed.quiet > 12) { try { bed.src.stop(); bed.g.disconnect(); } catch { /* gone */ } beds.delete(name); }
    }
  }
  function startBeds() {
    if (bedTimer || !ctx) return;
    bedTimer = setInterval(tickBeds, 400);
    timers.push(bedTimer);
  }
  let bedTimer = null;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const treeNear = (r) => { const l = sources.trees?.near(listener.x, listener.z, r); return l?.length ? l[Math.floor(Math.random() * l.length)] : null; };

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
    // A recorded sound if there is one (`arg`, 0..1, scales steps and landings), else its synth stand-in.
    play(name, arg) {
      if (!live()) return;
      try {
        const rec = ALIAS[name] || name;
        const amp = typeof arg === 'number' ? 0.45 + 0.55 * Math.max(0, Math.min(1, arg)) : 1;
        if (sample(rec, { gain: amp, jitter: UI.has(rec) ? 0.02 : 0.05 })) return;
        SFX[SYNTH_FOR[name] || SYNTH_FOR[rec] || name]?.(arg);
      } catch { /* sound is optional */ }
    },
    // A recorded sound from a place in the town (no synth fallback).
    playAt(name, pos, opts) {
      if (!live()) return false;
      try { return sample(name, { ...opts, pos }); } catch { return false; }
    },
    // The listener (the camera): position and the horizontal direction it looks along.
    listen(x, y, z, fx, fz, zoom = 0) {
      zoomNow = zoom;
      const w = sources.waterAt?.(x, z);
      underwaterNow = w != null && y < w;
      const l = Math.hypot(fx, fz) || 1;
      listener.x = x; listener.y = y; listener.z = z; listener.rx = -fz / l; listener.rz = fx / l;
    },
    // Where positional sounds come from: tree list, road list, and City Hall's {x, z}.
    setWorld({ trees, roads, cityHall, town, waterAt } = {}) {
      sources.waterAt = waterAt || null;
      if (town) { try { zones = buildZones(town); } catch (e) { zones = null; console.warn('[audio] no ambience zones:', e?.message || e); } }
      sources.trees = trees ? createGrid(trees) : null;
      sources.streets = mainStreetPoints(roads);
      sources.cityHall = cityHall ? { x: cityHall.x, y: 30, z: cityHall.z } : null;
    },
    has: hasSample,
    preload,
    dispose() { timers.forEach(clearTimeout); clearInterval(bedTimer); beds.clear(); timers = []; ctx?.close?.(); ctx = null; cache.clear(); voices.clear(); },
  };
  return api;
}
