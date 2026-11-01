// Drum Practice, the shell's side: free drumming and call and answer
// (practice.js holds the rhythm logic). It runs inside the game shell
// (main.js), which hands it what it needs through ctx: its systems (sound,
// renderer, input, art), settings and storage, the clocks, the screen and
// feedback helpers, and the current game as ctx.game (read and replaced).

import { T, txt } from './text_config.js';
import { createBattle } from './battle.js';
import { PALETTE as P } from './palette.js';
import { PracticeSession, CallSession, KITS, SECONDS, loopPosition } from './practice.js';

export function createPractice(ctx) {
  const { $, art, sound, renderer, input, settings, save, practiceSettings, songTime, hitTime, heardTime, confirm, feedback, show, enterFullscreen, hideSuccess, strokeKeys, LOOKAHEAD } = ctx;

  // Free drumming and call and answer (practice.js): no right or wrong, just
  // the drum, a kit to choose, and dancers who come once the drumming gets going.

  const PRACTICE = {
    free: {
      id: 'practice-free',
      title: T.practice.modes.free.title,
      subtitle: T.practice.modes.free.subtitle,
      intro: T.practice.modes.free.intro,
    },
    call: {
      id: 'practice-call',
      title: T.practice.modes.call.title,
      subtitle: T.practice.modes.call.subtitle,
      intro: T.practice.modes.call.intro,
    },
    training: {
      id: 'practice-training',
      title: T.practice.modes.training.title,
      subtitle: T.practice.modes.training.subtitle,
      intro: T.practice.modes.training.intro,
    },
  };
  for (const st of Object.values(PRACTICE)) Object.assign(st, { mode: 'practice', sky: 'dusk', ambience: 'amb-practice', troops: 0, elephant: false, enemies: [] });

  /** The practice modes' screen (from the title). */
  function openPractice() {
    sound.start();
    sound.loadSamples().then(() => {
      if (ctx.screen === 'practice') sound.practiceMusic();
    });
    enterFullscreen();
    buildPracticeCards();
    show('practice');
  }

  function buildPracticeCards() {
    const box = $('#practice-cards');
    box.innerHTML = '';
    const intro = $('#practice-intro');
    for (const [kind, st] of Object.entries(PRACTICE)) {
      const b = document.createElement('button');
      b.className = 'card';
      b.dataset.nav = '';
      const img = art.get(`card-${st.id}`);
      b.innerHTML = `<span class="card-art${img ? '' : ' plain'}" aria-hidden="true"></span><span class="num">${T.practice.cardLabel}</span><span class="name"></span><span class="sub"></span>`;
      if (img) b.querySelector('.card-art').style.backgroundImage = `url(${img.src})`;
      b.querySelector('.name').textContent = st.title;
      b.querySelector('.sub').textContent = st.subtitle;
      b.setAttribute('aria-description', st.intro);
      const describe = () => {
        intro.textContent = st.intro;
      };
      b.addEventListener('focus', describe);
      b.addEventListener('mouseenter', describe);
      b.addEventListener('click', () => startPractice(kind));
      box.appendChild(b);
    }
    intro.textContent = PRACTICE.free.intro;
  }

  function practiceKit() {
    return KITS[0]; // the main drum is always the bronze drum
  }

  /** The secondary drum chosen (LB and RB), the barrel drum by default. */
  function secondDrum() {
    return SECONDS.find((x) => x.id === practiceSettings.second) || SECONDS[0];
  }

  /** Sound a stroke of the rhythm on its drum: the bronze drum, or the secondary drum ('S'). */
  function voice(drum, when, gain, rate, dest) {
    if (drum === 'S') return sound.secondStroke(secondDrum().sample, when, gain, rate, dest);
    return sound.echo(drum, when, gain, rate, dest);
  }

  function startPractice(kind) {
    // Training is an answering chapter of its own (main.js).
    if (kind === 'training') return ctx.startTraining();
    hideSuccess();
    if (ctx.game && ctx.game.practice) stopPractice();
    const stage = PRACTICE[kind];
    sound.start();
    sound.setKit(null);
    input.practice = true;
    input.training = false;
    input.pointerPick = null;
    ctx.game = {
      index: -1,
      stage,
      practice: kind,
      mode: 'practice',
      session: kind === 'call' ? new CallSession({ beats: practiceSettings.beats }) : new PracticeSession({ mode: kind, beats: practiceSettings.beats }),
      battle: createBattle(stage),
      clockStart: sound.now + 0.6,
      pulses: [], // strokes heard, for the dancers: { t, drum, who }
      energy: 0, // how much drumming there has been lately (dancers come with it)
      dancers: 0,
      doneAt: null, // when the last rhythm was completed (it lights up)
      lastSound: -9,
      loopBus: null,
      loopNext: 0,
      callBus: null,
      feedback: null,
      confirm: null,
      ended: false,
    };
    renderer.setStage(stage);
    renderer.dancers = [];
    sound.loadSamples().then(() => {
      if (ctx.game && ctx.game.stage === stage) {
        sound.startAmbience(stage.ambience);
        sound.stopMusic(1.5);
      }
    });
    if (document.activeElement) document.activeElement.blur();
    show('play');
  }

  /** Silence the practice loop and the partner when leaving. */
  function stopPractice() {
    const g = ctx.game;
    if (!g) return;
    for (const bus of [g.loopBus, g.callBus]) {
      if (!bus) continue;
      sound.fadeBus(bus, 0, 0.15);
      setTimeout(() => bus.disconnect(), 400);
    }
    g.loopBus = null;
    g.callBus = null;
    sound.setKit(null);
    input.practice = false;
  }

  function practiceStrike(drum, time) {
    const g = ctx.game;
    const t = hitTime(time);
    if (drum === 'L') sound.tung();
    else if (drum === 'S') {
      sound.secondStroke(secondDrum().sample);
      renderer.kick('second', songTime());
    } else sound.cac();
    if (drum !== 'S') renderer.hit(drum, songTime());
    input.rumble(drum === 'R' ? 30 : 50, drum === 'R' ? 0.3 : 0.6);
    heard(drum, songTime(), 'you', 1);
    for (const e of g.session.stroke(drum, t)) practiceEvent(e);
  }

  /** A stroke reaches the green: the dancers move to it, and the drumming builds. */
  function heard(drum, t, who, energy) {
    const g = ctx.game;
    g.pulses.push({ t, drum, who });
    if (g.pulses.length > 48) g.pulses.splice(0, g.pulses.length - 48);
    g.energy = Math.min(36, g.energy + energy);
    g.lastSound = Math.max(g.lastSound, t);
  }

  function practiceAct(action) {
    const g = ctx.game;
    const s = g.session;
    const t = songTime();
    if (action === 'guard' || action === 'reset') {
      // A (Space, a swipe on touch): clear the dots, and in free play stop the loop.
      for (const e of s.clear(t)) practiceEvent(e);
      sound.play('drum-mo', sound.now, 0.6);
      renderer.kick('mo', t);
    } else if (action === 'fewer' || action === 'more') {
      const events = s.setBeats(s.beats + (action === 'more' ? 1 : -1), t);
      if (!events.length) return sound.play('ui-back');
      sound.play('ui-move');
      for (const e of events) practiceEvent(e);
    } else if (action === 'secondNext' || action === 'secondPrev') {
      const i = SECONDS.indexOf(secondDrum());
      const next = SECONDS[(i + (action === 'secondNext' ? 1 : SECONDS.length - 1)) % SECONDS.length];
      practiceSettings.second = next.id;
      save('practice', practiceSettings);
      // Let them hear it.
      sound.secondStroke(next.sample, sound.now + 0.02);
      renderer.kick('second', songTime());
      confirm(`${next.vn} · ${next.name}`, P.bronzeLight);
    }
  }

  function practiceEvent(e) {
    const g = ctx.game;
    const level = (settings.echo / 100) * 0.9 + 0.1;
    switch (e.type) {
      case 'loop': {
        if (g.loopBus) {
          const old = g.loopBus;
          sound.fadeBus(old, 0, 0.3);
          setTimeout(() => old.disconnect(), 800);
        }
        g.loopBus = sound.bus(level);
        g.loopNext = 0;
        g.doneAt = songTime();
        confirm(T.practice.againAndAgain, P.bronzeLight);
        break;
      }
      case 'clear':
        if (g.loopBus) {
          const old = g.loopBus;
          sound.fadeBus(old, 0, 0.2);
          setTimeout(() => old.disconnect(), 600);
          g.loopBus = null;
        }
        confirm(e.stopped ? 'Stopped' : 'Cleared', P.paperShade);
        break;
      case 'beats':
        practiceSettings.beats = e.beats;
        save('practice', practiceSettings);
        confirm(`${e.beats} beats`, P.paper);
        break;
      case 'cutCall':
        if (g.callBus) {
          const old = g.callBus;
          sound.fadeBus(old, 0, 0.06);
          setTimeout(() => old.disconnect(), 400);
          g.callBus = null;
        }
        // The strokes not played yet no longer move the dancers.
        g.pulses = g.pulses.filter((q) => q.who !== 'partner' || q.t <= songTime());
        break;
      case 'call': {
        // The partner plays the whole call now, scheduled on the audio clock.
        if (g.callBus) g.callBus.disconnect();
        g.callBus = sound.bus(0.85);
        for (const st of e.call.strokes) {
          voice(st.drum, g.clockStart + st.t, 1, 1.07, g.callBus);
          heard(st.drum, st.t, 'partner', 0.5);
        }
        break;
      }
      case 'answered':
      case 'led':
        g.doneAt = songTime();
        break;
      case 'exchange': {
        // The exchange loops: the partner's half in their voice, the player's
        // in their own drum (the loop scheduler in updatePractice).
        if (g.callBus) {
          const old = g.callBus;
          sound.fadeBus(old, 0, 0.2);
          setTimeout(() => old.disconnect(), 600);
          g.callBus = null;
        }
        if (g.loopBus) g.loopBus.disconnect();
        g.loopBus = sound.bus(level);
        g.loopNext = 0;
        confirm(T.practice.againAndAgain, P.bronzeLight);
        break;
      }
      case 'turn':
        confirm(e.starter === 'you' ? 'Your turn to call' : 'Your partner calls next', P.bronzeLight);
        break;
    }
  }

  function updatePractice(dt) {
    const g = ctx.game;
    const t = songTime();
    const s = g.session;
    for (const e of s.update(t)) practiceEvent(e);
    // The loop: the crew drums it round after round, just ahead of time.
    const L = s.loop;
    if (L && g.loopBus) {
      const n = L.strokes.length;
      while (true) {
        const st = L.strokes[g.loopNext % n];
        const at = L.start + Math.floor(g.loopNext / n) * L.period + st.pos * L.u;
        if (at - t > LOOKAHEAD) break;
        if (at >= t - 0.05) {
          // In call and answer the partner's half is in their voice.
          const partner = st.who === 'partner';
          voice(st.drum, g.clockStart + Math.max(at, t), 1, partner ? 1.07 : 0.97, g.loopBus);
          heard(st.drum, at, partner ? 'partner' : 'loop', 0.6);
        }
        g.loopNext += 1;
      }
    }
    // The drumming dies down when it stops: the dancers drift away.
    const quiet = t - g.lastSound > 2;
    g.energy = Math.max(0, g.energy - dt * (quiet ? 2.2 : 0.12));
    // The fire on the green: its crackle rises with it as the drumming builds.
    sound.ambienceLayer('amb-fire', 0.25 + 0.75 * Math.min(1, g.energy / 30));
    // A shout and a clap as each new dancer joins.
    const dancers = practiceDancers();
    if (dancers > g.dancers) sound.play('dancer-join', sound.now, 0.8);
    g.dancers = dancers;
    renderer.draw(practiceView(), dt);
  }

  /** How many dancers the drumming has drawn in: one for every five points of groove, up to six. */
  function practiceDancers() {
    return Math.min(6, Math.floor(ctx.game.energy / 5));
  }

  /**
   * What call and answer shows: the partner's row above and the player's
   * below. While the exchange loops, the half that is sounding lights stroke
   * by stroke and the other waits, dimmed. Before that: the partner's call
   * and the answer being drummed, or the player's own call being drummed.
   */
  function callRows(s, t) {
    const played = (strokes, end = Infinity) => strokes.filter((st) => st.t <= Math.min(t, end)).length;
    const asPattern = (r) => ({ strokes: r.strokes, beats: r.beats, text: r.text });
    const drumming = s.phrase.length ? { entering: true } : null;
    if (s.phase === 'loop' && s.exchange && s.loop) {
      const L = s.loop;
      const n = s.beats;
      const into = ((((t - L.start) % L.period) + L.period) % L.period) / L.u; // beats into the round
      const row = (half, offset) => {
        const strokes = half.strokes.map((st) => ({ drum: st.drum, pos: st.pos - offset }));
        const k = into - offset;
        const sounding = t >= L.start + offset * L.u && k >= 0 && k < n;
        return {
          pattern: { strokes, beats: n },
          played: sounding ? strokes.filter((st) => st.pos <= k).length : strokes.length,
          glow: sounding,
          dim: !sounding,
          label: half.who === 'partner' ? T.practice.partner : T.practice.you,
        };
      };
      const { first, second } = s.exchange;
      const a = row(first, 0);
      const b = row(second, n);
      const [partner, you] = first.who === 'partner' ? [a, b] : [b, a];
      return {
        top: partner,
        bottom: you,
        heading: first.who === 'partner' ? T.practice.exchangeLoopsPartner : T.practice.exchangeLoopsYou,
        headingColor: P.bronzeLight,
      };
    }
    if (s.phase === 'lead') {
      return {
        top: null,
        bottom: drumming,
        heading: drumming ? T.practice.yourCall : txt('practice.yourTurnToCall', { beats: s.beats }),
        headingColor: drumming ? P.paper : P.bronzeLight,
      };
    }
    const call = s.call;
    const calling = !!call && s.phase === 'call' && t >= call.start - 0.05 && t < call.end && !s.phrase.length;
    return {
      top: call && s.phase !== 'wait' ? { pattern: asPattern(call), played: played(call.strokes, call.end), glow: calling, label: T.practice.partner } : null,
      bottom: drumming,
      heading: calling ? T.practice.listen : drumming ? T.practice.yourAnswer : call && s.phase !== 'wait' ? txt('practice.answerWith', { beats: s.beats }) : T.practice.partnerAboutToCall,
    };
  }

  /** How each practice control is shown in the HUD for the device in use, as rich-text tokens. */
  function practiceKeys() {
    return {
      gamepad: { fewer: '⟨k:▼⟩', more: '⟨k:▲⟩', second: '⟨Y⟩', choose: '⟨k:LB⟩ ⟨k:RB⟩', clear: '⟨A⟩' },
      touch: { fewer: '−', more: '+', second: 'Tap', choose: '‹ ›', clear: 'Swipe' },
    }[input.device] || { fewer: '⟨k:−⟩', more: '⟨k:+⟩', second: '⟨k:G⟩', choose: '⟨k:[⟩ ⟨k:]⟩', clear: 'Space:' };
  }

  function practiceView() {
    const g = ctx.game;
    const t = songTime();
    const s = g.session;
    const lp = loopPosition(s.loop, t);
    const call = s.call;
    const callPlayed = call ? call.strokes.filter((st) => st.t <= Math.min(t, call.end)).length : 0;
    const calling = !!call && t >= call.start - 0.05 && t < call.end && !s.phrase.length;
    const keys = strokeKeys();
    let hint = null;
    if (settings.hints && t < 14 && !s.loops) {
      hint = s.mode === 'free'
        ? txt('practice.hintFree', { beats: s.beats, deepKey: keys.L, rimKey: keys.R })
        : txt('practice.hintCall', { beats: s.beats });
    }
    const v = {
      battle: g.battle,
      songTime: t,
      beatFloat: lp ? lp.pos : t / 0.8,
      heron: -1,
      phraseView: null,
      ready: !s.phrase.length,
      shieldsUp: false,
      cycle: null,
      threats: [],
      incoming: 0,
      guardAt: -9,
      guardUntil: -9,
      confirm: g.confirm,
      sustaining: false,
      inResponse: false,
      responseCommand: null,
      combo: 0,
      spirit: false,
      feedback: g.feedback,
      unlocked: [],
      maxTier: 3,
      mode: 'practice',
      stage: g.stage,
      session: s,
      touch: input.device === 'touch',
      hint,
      demo: null,
      heard: heardTime(),
      success: false,
      miss: null,
      practice: {
        kind: s.mode,
        beats: s.beats,
        kit: practiceKit(),
        second: secondDrum(),
        entered: s.phrase.length,
        // The settled beats only (PracticeSession.shown): what is shown never regroups.
        partial: s.shown,
        loop: s.loop,
        loopPos: lp,
        call,
        callPlayed,
        calling,
        answer: s.answer,
        // The answer stays up until the partner's next call starts.
        showAnswer: !!s.answer && !!call && t < call.start,
        rows: s.mode === 'call' ? callRows(s, t) : null,
        doneAt: g.doneAt,
        dancers: practiceDancers(),
        groove: Math.min(1, g.energy / 30),
        pulses: g.pulses,
        keys: practiceKeys(),
      },
    };
    return v;
  }

  return { PRACTICE, openPractice, startPractice, stopPractice, practiceStrike, practiceAct, updatePractice, practiceView };
}
