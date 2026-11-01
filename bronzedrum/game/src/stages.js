// Stage data, in story order. Positions are in field units; the army starts
// at x = 0 and the camera shows about 24 units across. bpm is the Han war
// drum's tempo (how often the enemy acts); the player drums at any speed.
// maxTier is the most intricate rhythm tier the chapter allows.
//
// story: two sentences that set the scene (the chapter's opening card);
// goal: what to do in it (the card, the chapter list, the first caption).
// mode: 'battle' (the default), 'echo' (answer a caller's rhythms; see
// modes.js), 'casting' (repeat a rhythm at a steady tempo), or a battle with
// `survive` seconds and `waves` (hold the line). Echo calls are four-beat
// rhythms that keep the deep strokes (L) at least a beat apart, like the
// commands. music lists beds in order of preference: the first one whose
// file exists plays.

import { T } from './text_config.js';

export const STAGES = [
  {
    id: 'garden',
    // Its own bed if delivered; else the sisters' theme that used to play on the chapter select.
    music: ['mu-bed-garden', 'mu-select', 'mu-bed-battle'],
    title: T.chapters.garden.title,
    subtitle: T.chapters.garden.subtitle,
    story: T.chapters.garden.story,
    goal: T.chapters.garden.goal,
    bpm: 92,
    lessons: true, // teaches as it goes (main.js LESSONS), with the children's stones
    unlocked: ['march', 'strike'],
    maxTier: 2,
    troops: 60,
    elephant: false,
    sky: 'dawn',
    ambience: 'amb-garden',
    enemies: [
      { type: 'target', x: 9 },
      { type: 'target', x: 16 },
      { type: 'target', x: 23 },
    ],
  },
  {
    id: 'oath',
    music: ['mu-bed-oath', 'mu-bed-story'], // its own bed if delivered, else the shared one
    mode: 'echo',
    title: T.chapters.oath.title,
    subtitle: T.chapters.oath.subtitle,
    story: T.chapters.oath.story,
    goal: T.chapters.oath.goal,
    caller: 'mourning',
    calls: [
      { text: 'L R L R', bpm: 56 },
      { text: 'L R R L', bpm: 56 },
      { text: 'L RR L R', bpm: 58 },
      { text: 'L R LR R', bpm: 58 },
      { text: 'L RRR L R', bpm: 60 },
    ],
    matchTempo: false,
    troops: 0,
    elephant: false,
    sky: 'dusk',
    // No ambience: every bed tried here sounded synthetic against the incense
    // and the dusk, so the music carries the scene alone, a little louder.
    ambience: null,
    musicLevel: 0.75,
    enemies: [],
  },
  {
    id: 'casting',
    music: ['mu-bed-foundry', 'mu-bed-story'], // its own bed if delivered, else the shared one
    mode: 'casting',
    title: T.chapters.casting.title,
    subtitle: T.chapters.casting.subtitle,
    story: T.chapters.casting.story,
    goal: T.chapters.casting.goal,
    rhythm: 'L RR L RR',
    bpm: 76, // the bellows' pace: heard as the guide rhythm, never shown as a number
    drums: 3,
    tolerance: 0.14,
    troops: 0,
    elephant: false,
    sky: 'foundry',
    ambience: 'amb-foundry',
    enemies: [],
  },
  {
    id: 'villages',
    // Its own bed if delivered; else the old title theme, quan ho (call-and-response singing) like the chapter.
    music: ['mu-bed-villages', 'mu-title', 'mu-bed-story'],
    mode: 'echo',
    title: T.chapters.villages.title,
    subtitle: T.chapters.villages.subtitle,
    story: T.chapters.villages.story,
    goal: T.chapters.villages.goal,
    caller: 'village',
    calls: [
      { text: 'L R L R', bpm: 84, label: T.chapters.villages.callers[0] },
      { text: 'R R L R', bpm: 90, label: T.chapters.villages.callers[1] },
      { text: 'L RR L R', bpm: 92, label: T.chapters.villages.callers[2] },
      { text: 'RR L R L', bpm: 96, label: T.chapters.villages.callers[3] },
      { text: 'L R RRR L', bpm: 100, label: T.chapters.villages.callers[4] },
      { text: 'RRR L RR L', bpm: 104, label: T.chapters.villages.callers[5] },
    ],
    matchTempo: true,
    tolerance: 0.3,
    troops: 0,
    elephant: false,
    sky: 'night',
    ambience: 'amb-village',
    settle: 2.6, // seconds after a village lights up, back to the crickets, before the next call
    enemies: [],
  },
  {
    id: 'outpost',
    music: ['mu-bed-river', 'mu-bed-battle'], // its own bed if delivered, else the shared one
    title: T.chapters.outpost.title,
    subtitle: T.chapters.outpost.subtitle,
    story: T.chapters.outpost.story,
    goal: T.chapters.outpost.goal,
    bpm: 96,
    unlocked: ['march', 'strike'],
    maxTier: 3,
    troops: 100,
    elephant: false,
    sky: 'day',
    ambience: 'amb-river',
    enemies: [
      { type: 'spear', x: 12 },
      { type: 'spear', x: 14 },
      { type: 'crossbow', x: 20 },
      { type: 'spear', x: 26 },
      { type: 'crossbow', x: 30 },
      { type: 'fort', x: 36, hp: 150 },
    ],
  },
  {
    id: 'luylau',
    music: ['mu-bed-luylau', 'mu-bed-battle'], // its own bed if delivered, else the shared one
    title: T.chapters.luylau.title,
    subtitle: T.chapters.luylau.subtitle,
    story: T.chapters.luylau.story,
    goal: T.chapters.luylau.goal,
    bpm: 100,
    unlocked: ['march', 'strike'],
    maxTier: 3,
    troops: 120,
    elephant: true,
    sky: 'night',
    ambience: 'amb-night',
    enemies: [
      { type: 'spear', x: 12 },
      { type: 'crossbow', x: 17 },
      { type: 'spear', x: 20 },
      { type: 'spear', x: 22 },
      { type: 'crossbow', x: 27 },
      { type: 'spear', x: 31 },
      { type: 'crossbow', x: 35 },
      { type: 'spear', x: 38 },
      { type: 'fort', x: 44, hp: 320 },
    ],
  },
  {
    id: 'coronation',
    music: ['mu-bed-coronation', 'mu-bed-story'], // its own bed if delivered, else the shared one
    mode: 'echo',
    title: T.chapters.coronation.title,
    subtitle: T.chapters.coronation.subtitle,
    story: T.chapters.coronation.story,
    goal: T.chapters.coronation.goal,
    caller: 'festival',
    calls: [
      { text: 'L R L R', bpm: 112 },
      { text: 'L RR L RR', bpm: 112 },
      { text: 'RR L RR L', bpm: 116 },
      { text: 'L RRR L RRR', bpm: 116 },
      { text: 'RRR L RRR L', bpm: 120 },
      { text: 'L RR RRR L', bpm: 120 },
    ],
    matchTempo: false,
    troops: 100,
    elephant: false,
    sky: 'day',
    ambience: 'amb-coronation',
    enemies: [],
  },
  {
    id: 'mavien',
    music: ['mu-bed-mavien', 'mu-bed-battle'], // its own bed if delivered, else the shared one
    title: T.chapters.mavien.title,
    subtitle: T.chapters.mavien.subtitle,
    story: T.chapters.mavien.story,
    goal: T.chapters.mavien.goal,
    bpm: 100,
    unlocked: ['march', 'strike'],
    maxTier: 3,
    troops: 120,
    elephant: false,
    sky: 'dusk',
    ambience: 'amb-river',
    survive: 90,
    enemies: [
      { type: 'spear', x: 10 },
      { type: 'crossbow', x: 16 },
    ],
    // Columns arrive every few seconds, dx ahead of the army.
    waves: [
      { at: 10, enemies: [{ type: 'spear', dx: 14 }, { type: 'spear', dx: 16 }] },
      { at: 20, enemies: [{ type: 'crossbow', dx: 15 }, { type: 'spear', dx: 13 }] },
      { at: 30, enemies: [{ type: 'spear', dx: 13 }, { type: 'spear', dx: 15 }, { type: 'crossbow', dx: 18 }] },
      { at: 42, enemies: [{ type: 'crossbow', dx: 14 }, { type: 'crossbow', dx: 17 }] },
      { at: 52, enemies: [{ type: 'spear', dx: 12 }, { type: 'spear', dx: 14 }, { type: 'spear', dx: 16 }] },
      { at: 64, enemies: [{ type: 'crossbow', dx: 14 }, { type: 'spear', dx: 12 }, { type: 'crossbow', dx: 18 }] },
      { at: 76, enemies: [{ type: 'spear', dx: 12 }, { type: 'spear', dx: 13 }, { type: 'crossbow', dx: 16 }] },
    ],
  },
  {
    id: 'elegy',
    music: ['mu-bed-elegy', 'mu-ending'], // its own bed if delivered, else the shared one
    mode: 'echo',
    title: T.chapters.elegy.title,
    subtitle: T.chapters.elegy.subtitle,
    story: T.chapters.elegy.story,
    goal: T.chapters.elegy.goal,
    caller: 'elegy',
    calls: [
      { text: 'L R L R', bpm: 50 },
      { text: 'L R R L', bpm: 50 },
      { text: 'L RR L R', bpm: 48 },
      { text: 'L R L R', bpm: 46 },
      { text: 'L R R R', bpm: 44 },
    ],
    matchTempo: false,
    troops: 0,
    elephant: false,
    sky: 'ash',
    ambience: 'amb-elegy',
    enemies: [],
  },
];
