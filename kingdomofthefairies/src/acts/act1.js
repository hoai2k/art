import { LEGACY, FILM, BAY_TITLE } from '../theme.js';
// Act I — The Crossing. The voyage (board.js), then the ending from
// design/acts.md: land ho, a celebration on the deck set, the witch's turn,
// the wreck and the sinking guitar. Headless: drawing is in act1-art.js.
import { createBoard, step as stepBoard, LEAVES, TUNING } from '../board.js';
import { BEAT_WINDOW, beatHit } from './shared.js';
import * as art from './act1-art.js';

// Ending timeline, seconds per phase. Each scene shows its moment and moves
// on: the deck rises as soon as the ship's bell has rung.
export const ENDING = { landho: 1.7, party: 6, turn: 4.4, wreck: 4.6, sink: 5.0, iris: 1.2 };
export const LANTERNS = 4; // paper lanterns lit on the beat during the party
// Cues within the turn and the wreck (seconds into the phase).
export const CUES = { strike: 1.2, shipBreak: 2.0, splash: 3.2 };
// Where the revellers land on the deck set (stage px, feet; s = scale). The
// first two are the big and small barrels, so only one of them is used.
// In the film's tempest the crew stand on the deck's planks (around the
// hatches and before the mast), not up on the barrels and rope.
const FILM_SPOTS = [
  { x: 250, y: 464, s: 0.8 }, { x: 1022, y: 460, s: 0.8 },  // by the rail, left and right
  { x: 548, y: 420, s: 0.7 }, { x: 742, y: 420, s: 0.7 },   // either side of the mast's foot
  { x: 640, y: 478, s: 0.82 },                              // before the mast, between the hatches
];
const CLASSIC_SPOTS = [
  { x: 418, y: 296, s: 0.62 }, { x: 372, y: 360, s: 0.58 },   // on the barrels by the left hatch
  { x: 870, y: 316, s: 0.62 },                                // on the right barrel
  { x: 520, y: 390, s: 0.64 },                                // on the coil of rope
  { x: 262, y: 466, s: 0.8 }, { x: 1012, y: 460, s: 0.8 },    // at the rail, left and right
  { x: 748, y: 402, s: 0.66 },                                // by the bell
];
export const SPOTS = FILM ? FILM_SPOTS : CLASSIC_SPOTS;

const ORDER = ['landho', 'party', 'turn', 'wreck', 'sink', 'iris'];

// Scenes, for checkpoints and the scene select. Scenes 1-3 begin just past
// each tea leaf (where it floats by, at TUNING.keepsakeAt).
export const SCENES = [
  { name: 'Setting Sail' },
  { name: FILM ? 'Toward the Second Star' : 'Toward the Second Leaf', progress: 0.25 },
  { name: FILM ? 'Toward the Third Star' : 'Toward the Third Leaf', progress: 0.53 },
  { name: 'The Last Stretch', progress: 0.81 },
  { name: FILM ? 'The Tempest' : 'The Celebration' },
  { name: FILM ? 'The Witch Strikes' : "The Witch's Turn" },
];

export default {
  id: 1, key: 'crossing', kicker: 'Act I', title: FILM ? 'The Royal Crossing' : 'The Crossing', size: FILM ? 116 : 130,
  sub: FILM ? "Sail for the witch's tower; she will turn the wind.\nGather Aurora's three stars on the way."
    : 'The witch will turn the wind.\nGather the three tea leaves for the reading.',
  // In the film edition the witch rides her storm cloud, not a moon boat.
  cast: FILM ? { 'witch-moonboat': 'witch-storm' } : undefined,
  action: 'A: leap',
  scenes: SCENES,

  // `from` (optional): { scene } to start at a scene, plus the fields of a
  // checkpoint this act made (progress, leaves, spawned, score, pearls).
  create({ seed, from = null }) {
    const st = {
      board: createBoard(seed), phase: 'voyage', phaseT: 0,
      status: 'play', statusT: 0, events: [], result: null,
      party: { lit: 0, beats: new Set(), revelry: false, on: [false, false, false, false] },
      witchAt: null, checkpoint: null,
    };
    const k = from?.scene | 0;
    if (k <= 0) return st;
    const b = st.board;
    // Leaves gathered before this scene count as gathered.
    b.leaves = from.leaves ?? Math.min(k, LEAVES);
    b.keepsakesSpawned = from.spawned ?? Math.min(k, LEAVES);
    b.score = from.score ?? b.leaves * 100;
    b.pearls = from.pearls ?? 0;
    if (k <= 3) {
      b.progress = from.progress ?? SCENES[k].progress;
      b.wind.next = TUNING.wind.first; // a calm few seconds to settle in
    } else {
      b.progress = 1; b.phase = 'done'; b.ship.x = 560; b.pickups = [];
      st.phase = k === 4 ? 'party' : 'turn';
      placeRevellers(st);
      if (k === 4) st.events.push({ type: 'cheer' });
      else st.events.push({ type: 'spirits' });
    }
    st.checkpoint = { ...from, scene: k };
    return st;
  },

  step(st, dt, input) {
    st.statusT += dt;
    st.beat = input.beat;
    if (st.status !== 'play') return;
    st.phaseT += dt;
    const b = st.board;

    if (st.phase === 'voyage') {
      stepBoard(b, dt, { moveX: input.moveX, rowUp: input.up, rowDown: input.down, leap: input.a });
      // Each tea leaf gathered is a checkpoint: a retry starts just past it.
      if (b.events.some((e) => e.type === 'keepsake')) {
        st.checkpoint = { scene: Math.min(3, b.keepsakesSpawned), progress: b.progress, leaves: b.leaves, spawned: b.keepsakesSpawned, score: b.score, pearls: b.pearls };
      }
      st.events.push(...b.events); b.events.length = 0;
      if (b.phase === 'wrecked' && b.phaseT > 2.2) { st.status = 'lost'; st.statusT = 0; }
      if (b.phase === 'done') next(st);
      return;
    }
    // The stage keeps scrolling gently behind the ending.
    stepBoard(b, dt, {}); b.events.length = 0;

    // The film edition's tempest is a scene: the crew light the ship's
    // lanterns themselves, one on each beat, before the witch turns on it.
    if (st.phase === 'party' && FILM) {
      const k = Math.floor(input.beat ?? st.phaseT / 0.784);
      if (st.phaseT > 0.6 && st.party.lit < LANTERNS && !st.party.beats.has(k)) {
        st.party.beats.add(k); st.party.on[st.party.lit] = true; st.party.lit++;
        st.events.push({ type: 'partyHit', n: st.party.lit, i: st.party.lit - 1 });
        if (st.party.lit === LANTERNS) { st.party.revelry = true; st.events.push({ type: 'revelry' }); }
      }
    } else if (st.phase === 'party') {
      if (input.a && st.party.lit < LANTERNS) {
        const k = beatHit(input.beat, BEAT_WINDOW);
        if (k != null && !st.party.beats.has(k)) {
          st.party.beats.add(k);
          st.party.lit++;
          st.events.push({ type: 'partyHit', n: st.party.lit });
          if (st.party.lit === LANTERNS) { st.party.revelry = true; b.score += 200; st.events.push({ type: 'revelry' }); }
        }
      }
    }
    if (st.phase === 'turn' && st.phaseT >= CUES.strike && !st.struck) { st.struck = true; st.events.push({ type: 'strike' }); }
    if (st.phase === 'turn') st.witchAt = { x: 900, y: 170 };
    if (st.phase === 'wreck' && st.phaseT >= CUES.shipBreak && !st.broken) { st.broken = true; st.events.push({ type: 'shipBreak' }); }
    if (st.phase === 'wreck' && st.phaseT >= CUES.splash && !st.splashed) { st.splashed = true; st.witchAt = { x: 1500, y: 150 }; st.events.push({ type: 'splash' }); }

    if (st.phaseT >= ENDING[st.phase]) next(st);
  },

  hud(st) {
    const b = st.board;
    const leaves = Array.from({ length: LEAVES }, (_, i) => ({ id: 'leaf', have: i < b.leaves }));
    if (st.phase === 'voyage' || st.phase === 'landho') {
      return { lanterns: b.ship.hull, maxLanterns: TUNING.hull, pearls: b.pearls, progress: b.progress, keepsakes: leaves,
        wind: st.phase === 'voyage' ? { dir: b.wind.dir, warn: b.wind.warn } : null };
    }
    if (st.phase === 'party') return { lanterns: b.ship.hull, maxLanterns: TUNING.hull, pearls: b.pearls, progress: null, keepsakes: leaves };
    return null;
  },

  announce(e) {
    if (e.type === 'hit') { const n = Math.round(e.hull * 10) / 10; return `Hit. ${n} lantern${n === 1 ? '' : 's'} left.`; }
    if (e.type === 'pearl' && e.mended) return `A lantern mended: ${Math.floor(e.hull)} whole.`;
    if (e.type === 'keepsake') return FILM ? `Aurora's star ${e.n} of 3.` : `Tea leaf ${e.n} of 3.`;
    if (e.type === 'windWarn') return e.to > 0 ? 'The wind is turning behind you.' : 'The wind is turning against you.';
    if (e.type === 'arrive') return LEGACY ? "Widow's Bay in sight." : FILM ? "The sky blackens: the witch's tempest." : 'The enchanted tower in sight.';
    if (e.type === 'cheer') return FILM ? "The witch's tempest! The crew light the ship's lanterns against the dark." : 'A celebration on deck! Press A on the beat to light the lanterns.';
    if (e.type === 'revelry') return FILM ? 'Every lantern lit: they hold against the storm.' : 'Every lantern lit.';
    if (e.type === 'strike') return 'The witch strikes the mast.';
    if (e.type === 'shipBreak') return FILM ? 'The royal ship breaks on the rocks.' : 'The ship breaks apart.';
    if (e.type === 'guitarSink' && FILM) return "Aurora's sword sinks into the deep.";
    return null;
  },

  focus: art.focus, draw: art.draw, drawOver: art.drawOver, onEvent: art.onEvent,
};

function next(st) {
  const i = st.phase === 'voyage' ? 0 : ORDER.indexOf(st.phase) + 1;
  if (i >= ORDER.length) {
    const b = st.board;
    st.status = 'won'; st.statusT = 0;
    st.result = { keepsakes: { tea: b.leaves }, score: b.score, pearls: b.pearls, revelry: st.party.revelry };
    return;
  }
  st.phase = ORDER[i]; st.phaseT = 0;
  const b = st.board;
  if (st.phase === 'party' || st.phase === 'turn') {
    st.checkpoint = { scene: st.phase === 'party' ? 4 : 5, leaves: b.leaves, spawned: b.keepsakesSpawned, score: b.score, pearls: b.pearls };
  }
  if (st.phase === 'landho') st.events.push({ type: 'landho' });
  if (st.phase === 'party') { placeRevellers(st); st.events.push({ type: 'cheer' }); }
  if (st.phase === 'turn') st.events.push({ type: 'spirits' });
  if (st.phase === 'sink') st.events.push({ type: 'guitarSink' });
}

// A different arrangement each time: four of the spots (only one of the two
// barrels by the left hatch), shuffled with the voyage's own random numbers.
function placeRevellers(st) {
  const r = st.board.rand;
  const pool = FILM ? FILM_SPOTS.map((_, i) => i) : [r() < 0.5 ? 0 : 1, 2, 3, 4, 5, 6];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  st.party.spots = pool.slice(0, 4);
}
