// The film edition's last two acts (design/film-adaptation.md), built on Act
// V's machinery (act5.js): its climb, burning interior, carry and hazards.
//
// Act V — The Enchanted Tower (tableaux 23-25): climb the cliff, dive for the
// witch's tower, swim the sea gap while she swoops (A dives under; Aurora's
// light drives her off at last), and climb the tower wall to the window.
//
// Act VI — The Burning Tower (tableaux 26-32): her demons set the tower alight;
// climb to Azurine and carry her down as the way breaks behind you, out
// across the clifftop; roll the witch's barrel over the edge on the beat; the
// wedding procession and the apotheosis.
//
// Headless: drawing is in act5film-art.js.
import act5, {
  BEAT_S, GRACE, LANTERNS, CLIFF, HOLDS, HOUSE, QUAY,
  stepCliff, stepHouse, stepQuay, hit, checkpoint, setPhase, climberPos, stepRocks, reachTop,
} from './act5.js';
import { createWall, stepWall, jolt } from './climb.js';
import { clamp, lerp } from './shared.js';
import { FINALE, FINALE_END } from '../finale.js';
import * as art from './act5film-art.js';
import { TEXT } from '../text_config.js';

// ---------------------------------------------------------------- the swim
// World x along the sea gap, from the foot of the cliff (0) to the tower's
// rock (len). The current pulls back toward the cliff; keep swimming.
// Aurora drives the witch off after `swoops` swoops or `auroraAt` of the way across.
export const SWIM = { len: 2400, speed: 360, current: 30, dive: 0.9, diveCD: 0.45, every: [1.8, 2.4], warn: 1.5, swoops: 3, auroraAt: 0.7, aurora: 2.0, arrival: 1.1 };

// ---------------------------------------------------------------- the tower
// The tower wall: x on stage, y up from the rocks at its foot to her window.
// Every hold is on the delivered tower-wall-tall: `painted` holds are the
// stones that jut from its wall (their top faces, measured on the cloth as
// drawn: 760 wide, centred, foot at y -30), and `ivy` holds are grips in its
// painted ivy, drawn as a knot of vine. The top is the sill of her window,
// the painted one at the upper right. Plain moves reach 130, leaps 190.
export const TOWER_TOP = 1520;
export const TOWER_HOLDS = [
  { x: 590, y: 128, kind: 'ledge', painted: true, start: true },   // the flat rock at its foot
  { x: 460, y: 210, kind: 'ledge', painted: true },                // the rock beside it
  { x: 545, y: 240, ivy: true },
  { x: 512, y: 345, kind: 'ledge', painted: true },
  { x: 575, y: 455, ivy: true },
  { x: 600, y: 550, ivy: true },
  { x: 590, y: 640, kind: 'ledge', painted: true },
  { x: 500, y: 720, ivy: true },
  { x: 405, y: 750, kind: 'ledge', painted: true, pearl: true },
  { x: 470, y: 830, ivy: true },
  { x: 515, y: 925, kind: 'ledge', painted: true },                // halfway
  { x: 530, y: 1035, kind: 'ledge', painted: true },
  { x: 560, y: 1130, ivy: true, kind: 'crumble' },                 // dry ivy: it tears away
  { x: 495, y: 1235, kind: 'ledge', painted: true },               // the lower window's sill
  { x: 560, y: 1330, ivy: true },
  { x: 595, y: 1425, kind: 'ledge', painted: true },
  // a detour up the right of the wall, for its pearls
  { x: 700, y: 752, ivy: true },
  { x: 752, y: 830, kind: 'ledge', painted: true },
  { x: 812, y: 960, kind: 'ledge', painted: true, pearl: true },
  { x: 770, y: 1060, ivy: true },
  { x: 738, y: 1155, kind: 'ledge', painted: true, pearl: true },
  { x: 680, y: 1395, ivy: true },
  { x: 760, y: 1430, ivy: true },                                  // under her sill
  { x: 812, y: TOWER_TOP, kind: 'top' },                           // her window's sill
];
export const TOWER_HALF = TOWER_HOLDS.findIndex((h) => h.x === 515 && h.y === 925);
export const TOWER_WINDOW = { x: 825, y: TOWER_TOP };

// The film's cliff (cliff-face-tall-2 as Act V draws it: 820 wide from x 230,
// its foot at y -30): every ledge hold is on the top face of one of its
// painted ledges, and every grip in its painted ivy; leaps cross the dark
// cleft to the pearls on the right. No giant, no boot: he climbs over the
// grass edge from the ledge below it. Plain moves reach 130, leaps 190.
export const FILM_CLIFF = [
  { x: 670, y: 70, kind: 'ledge', painted: true, start: true },
  { x: 745, y: 160, kind: 'ledge', painted: true },
  { x: 620, y: 180, ivy: true },
  { x: 610, y: 290, ivy: true },
  { x: 880, y: 300, kind: 'ledge', painted: true, pearl: true },
  { x: 760, y: 380, kind: 'ledge', painted: true },
  { x: 650, y: 410, kind: 'ledge', painted: true },
  { x: 540, y: 435, kind: 'ledge', painted: true },
  { x: 430, y: 455, kind: 'ledge', painted: true },
  { x: 330, y: 380, ivy: true },
  { x: 350, y: 520, ivy: true },
  { x: 380, y: 612, kind: 'ledge', painted: true },
  { x: 500, y: 600, kind: 'ledge', painted: true },
  { x: 620, y: 585, kind: 'ledge', painted: true, pearl: true },
  { x: 300, y: 690, ivy: true },
  { x: 370, y: 785, kind: 'ledge', painted: true },
  { x: 490, y: 772, kind: 'ledge', painted: true },
  { x: 610, y: 760, kind: 'ledge', painted: true },
  { x: 730, y: 745, kind: 'ledge', painted: true },
  { x: 900, y: 712, kind: 'ledge', painted: true },
  { x: 975, y: 860, ivy: true },
  { x: 960, y: 945, kind: 'ledge', painted: true, pearl: true },
  { x: 450, y: 870, ivy: true },
  { x: 420, y: 965, kind: 'ledge', painted: true },
  { x: 540, y: 955, kind: 'ledge', painted: true },
  { x: 660, y: 945, kind: 'ledge', painted: true },
  { x: 770, y: 930, kind: 'ledge', painted: true },
  { x: 430, y: 1060, kind: 'ledge', painted: true },
  { x: 560, y: 1040, kind: 'ledge', painted: true, pearl: true },
  { x: 350, y: 1145, ivy: true },
  { x: 310, y: 1230, ivy: true },
  { x: 400, y: 1275, kind: 'ledge', painted: true },
  { x: 520, y: 1248, kind: 'ledge', painted: true },
  { x: 640, y: 1240, kind: 'ledge', painted: true },
  { x: 760, y: 1236, kind: 'ledge', painted: true },
  { x: 900, y: 1225, kind: 'ledge', painted: true },
  { x: 900, y: 1300, ivy: true },
  { x: 950, y: 1385, kind: 'ledge', painted: true, pearl: true },
  { x: 575, y: 1350, ivy: true, kind: 'crumble' },
  { x: 450, y: 1418, kind: 'ledge', painted: true },
  { x: 580, y: 1414, kind: 'ledge', painted: true },
  { x: 380, y: 1492, kind: 'ledge', painted: true },
  { x: 520, y: 1498, kind: 'ledge', painted: true },
  { x: 660, y: 1502, kind: 'ledge', painted: true },
  { x: 640, y: 1580, ivy: true },
  { x: 370, y: 1667, kind: 'ledge', painted: true },
  { x: 500, y: 1663, kind: 'ledge', painted: true },
  { x: 640, y: 1658, kind: 'ledge', painted: true },
  { x: 330, y: 1760, ivy: true, kind: 'crumble' },
  { x: 380, y: 1850, ivy: true },
  { x: 470, y: 1878, kind: 'ledge', painted: true },
  { x: 580, y: 1874, kind: 'ledge', painted: true },
  { x: 690, y: 1870, kind: 'ledge', painted: true },
  { x: 850, y: 1830, kind: 'ledge', painted: true, pearl: true },
  { x: 560, y: CLIFF.top + 6, kind: 'top' },
  { x: 680, y: CLIFF.top + 6, kind: 'top' },
];
export const FILM_CLIFF_HALF = FILM_CLIFF.findIndex((h) => h.x === 420 && h.y === 965);

// Cut-scene lengths, seconds. Victory fades with the final chord, not the
// MP3’s near-silent tail (the audible decay begins at about 3.45 seconds).
export const FILM_T = { dive: 3.8, window: 3.6, iris: 1.6, barrelFall: 2.4, victory: 3.45, victoryFade: 1.65, weddingFade: 2.8, weddingLead: 1.2, wedding: 7.5, apotheosis: 8.5, defeat: 1.8, splash: 1.0, rise: 5, descend: 3 };

// The walking scenes between the climbs (all stage px, feet at `y`): the
// clifftop he dives from, the cliff he rolls the witch's barrel over, the
// wedding street and the apotheosis. Each was measured on its delivered set.
export const WALK = { speed: 240, acc: 2000, g: 2000, jump: 720, cut: 2400, buffer: 0.13 };
export const DIVE = { y: 378, x0: 170, edge: 375, start: 210, water: 550 };
export const diveFloor = x => x < 260 ? lerp(365,389,clamp((x-170)/90,0,1)) : lerp(389,412,clamp((x-260)/115,0,1));
// One stage-space route shared by the swimmer, witch shadow and water mask.
export function swimPosition(sw) {
  const f = clamp(sw.x / SWIM.len,0,1);
  const land = clamp((sw.arrivalT || 0) / .85,0,1);
  return { x: lerp(495,865,f) + land*95, y: 550-land*54, land };
}
// The rescue opens a clear route on the right. Time and descent both
// extinguish it, so waiting works and reaching the ground always clears it.
// The left-hand demon runs in (`run` s) and lights the fires behind him
// (over `light` s) once he has moved or `wait` s have passed.
export const TOWER_FIRE = { wait: 1.5, run: 0.9, light: 0.9 };
export const towerLeftFire = st => st.leftFireT == null ? 0 : clamp((st.leftFireT - TOWER_FIRE.run) / TOWER_FIRE.light, 0, 1);
export const TOWER_ESCAPE = { x: HOUSE.wallR, fireSeconds: 8 };
export function towerEscapeFire(st) {
  if (!st.p?.carry) return 1;
  const height = clamp((HOUSE.floors[0]-st.p.y)/(HOUSE.floors[0]-HOUSE.floors[2]),0,1);
  return Math.min(st.escapeFire ?? 1, clamp(1-(st.escapeT||0)/TOWER_ESCAPE.fireSeconds,0,1), height);
}
export const BARREL = {                                                  // cliff-whirlpool's ledge
  y: 412, x0: 150, edge: 728, start: 230, at: 470, hw: 48, push: 150, knock: 320,
};
export const AURORA = { x: 250, height: 200, shieldX: 308, smokeLife: 1.3 };
export const auroraFacing = () => 1; // always toward the witch and cliff edge
// The witch's last stand on that ledge: she winds up (warn), then hurls a
// bolt of fire along the ground (leap it, A), or blasts him back if he lingers
// at her side; the sword (X) swings, and three blows that reach her beat her.
// Then, as in the film, Aurora shuts her in a barrel: it drops out of the air
// over her (`trap`: Aurora casts until `drop`, it falls until `land`, rocks
// until the end) and he pushes it over the cliff.
export const DUEL = {
  hp: 3, x: BARREL.edge - BARREL.hw, idle: [0.9, 1.4], warn: 0.65, reach: 115, near: 150,
  bolt: 400, boltR: 26, boltH: 34, reel: 0.8, counterPose: 0.4, witchHeight: 172, hw: 34, swing: 0.35,
  trap: { drop: 0.6, land: 1.05, end: 1.9 },
};
// A short stage entrance identifies the tall fairy and the rescued princess
// before handing the combat controls back. Retry checkpoints skip this once.
export const BATTLE_INTRO = { faceoff: 2.2, arrival: 2.8, setdown: 1.1, rise: .45, forward: 1, settle: .35,
  witchFrom: 480, heroFrom: -100, handoff: 230, shelter: 180, ready: 350, height: 140 };
export const BATTLE_INTRO_END = ['faceoff','arrival','setdown','rise','forward','settle'].reduce((sum,key)=>sum+BATTLE_INTRO[key],0);
export function battleIntroFrame(st) {
  let t = st.battleIntro?.t || 0;
  for (const stage of ['faceoff','arrival','setdown','rise','forward','settle']) {
    if (t < BATTLE_INTRO[stage]) return { stage, u: clamp(t/BATTLE_INTRO[stage],0,1) };
    t -= BATTLE_INTRO[stage];
  }
  return { stage: 'settle', u: 1 };
}
// (each walk starts with its figures in view, clear of the left curtain at ~x 170)
// The front flight climbs up and back into the arched doorway (centre ~x 900,
// threshold ~y 516); the balustraded ramp to its right is scenery. The couple
// climb at `climb` of their walking pace, shrink by up to `shrink` as they go
// up and back, and walk on through the doorway, out of sight behind its
// right jamb (`door`, the wall's edge: a feathered mask) by `gate`.
export const WEDDING = { y: 652, x0: 60, gate: 1000, start: 330, follow: 96, petals: 14, stairs: 780, door: 944, returnAt: 830, climb: 0.45, shrink: 0.16 };
// Feet follow the painted paving, the stair flight, the threshold and on
// into the doorway.
export const WEDDING_PATH = [[60,652],[760,652],[795,606],[880,524],[905,516],[1000,512]];
export function weddingFloor(x) {
  for (let i=1;i<WEDDING_PATH.length;i++) {
    const [x1,y1]=WEDDING_PATH[i], [x0,y0]=WEDDING_PATH[i-1];
    if (x <= x1) return lerp(y0,y1,clamp((x-x0)/(x1-x0),0,1));
  }
  return WEDDING_PATH.at(-1)[1];
}
// Figures shrink slightly as the stairs carry them up and away from the audience.
export const weddingScale = x => 1-WEDDING.shrink*clamp((WEDDING.y-weddingFloor(x))/(WEDDING.y-WEDDING_PATH.at(-1)[1]),0,1);

// Walking left leads back out to the wedding guests as soon as Azurine,
// following him, is hidden behind the left curtain (her centre at `offAz`);
// he can walk on to `off`, offstage.
// What the voyage earned, heaped on the top step of the right-hand stairs of
// the final tableau: every pearl taken in every act (the carried total and
// this act's), Aurora's stars, the sword, Neptune's seal and Aurora's lamp,
// and every gift the Water Fairy below it has given.
export const TREASURE = { x: 980, y: 348 };
// The heap's slots, bottom up: a broad base narrowing to a column of five
// and six laid like bricks, so it climbs (slowly) off the top of the stage.
export function pileSlot(i) {
  for (let r = 0, n = 0; ; r++) {
    const w = r < 3 ? 9 - r : r % 2 ? 5 : 6;
    if (i < n + w) { const c = i - n; return { x: TREASURE.x + (c - (w - 1) / 2) * 14 + ((i * 7) % 5) - 2, y: TREASURE.y - r * 10.5 }; }
    n += w;
  }
}
// An easter egg: beside the Water Fairy (the far-right figure) X takes one
// gift after another from her; each flies up onto the heap.
export const GIFTING = { x: 980, near: 60, flight: 0.9, hand: { x: 948, y: 470 },
  kinds: ['pearl', 'keepsake-shell', 'aurora-star', 'keepsake-pearl', 'pearl', 'keepsake-star', 'keepsake-rose', 'pearl'] };
export const nearGiftFairy = st => !!st.w && !st.flight && Math.abs(st.w.x - GIFTING.x) < GIFTING.near && ['apotheosis', 'finale'].includes(st.phase);
export const pileCount = st => (st.carry?.pearls || 0) + (st.pearls || 0) + (st.giftsLanded || 0);
// What cannot be missed on the way here (the betrothal gifts, the sword,
// Neptune's seal) is always laid out, even with nothing recorded (a scene
// opened directly); the optional finds (pearls, Aurora's stars, her lamp)
// only when they were found.
export const REQUIRED_GIFTS = ['flower', 'ring', 'crown', 'gold'];
export const treasures = st => ({
  pearls: (st.carry?.pearls || 0) + (st.pearls || 0), stars: Math.min(3, st.carry?.tea || 0),
  gifts: REQUIRED_GIFTS, sword: true, seal: true, lamp: !!st.carry?.stone,
});
export const APOTH = { y: 592, x0: 120, x1: 1160, mark: 640, near: 40, start: 320, off: -140, offAz: 80 };
// After the credits: [X] fades out to the title screen over `fade` seconds;
// so does the end of the wedding piece if the player has been idle `idle` s.
export const ENDING = { fade: 2.5, idle: 5 };
export const WEDDING_GUESTS = [
  ['crew-squire', 250], ['crew-helmsman', 340], ['crew-manatarms', 430], ['crew-bosun', 520],
  ['fairy-ring', 610], ['fairy-crown', 690], ['fairy-gold', 770], ['king-stand', 990], ['queen-stand', 1080],
];
export const CELEBRATION = { jump: 760, stagger: 0.12, guestDuration: 0.65, guestHeight: 32 };
export const weddingGuests = st => WEDDING_GUESTS.filter((_, i) => i >= 4 || i < Math.min(4, st.sleepersShown || 0));
export function guestHop(st, id) {
  return Math.max(0, ...(st.cheers || []).map(wave => {
    const rank = wave.order.indexOf(id);
    const t = st.clock - wave.at - rank * CELEBRATION.stagger;
    return rank < 0 || t < 0 || t >= CELEBRATION.guestDuration ? 0 : Math.sin(Math.PI * t / CELEBRATION.guestDuration) * CELEBRATION.guestHeight;
  }));
}
const PRINCE_HW = 18;

const CARRY_DEFAULT = { tea: 0, guitar: false, rose: false, pearl: false, stone: false, sleepers: 0 };

function base(st, dt, input) {
  st.statusT += dt;
  st.clock += dt;
  st.beat = input.beat ?? st.clock / BEAT_S;
  if (st.status !== 'play') return false;
  st.phaseT += dt;
  st.inv = Math.max(0, st.inv - dt);
  if (st.defeatT != null) {
    st.defeatT += dt;
    if (st.defeatT >= FILM_T.defeat) { st.status = 'lost'; st.statusT = 0; }
    return false;
  }
  return true;
}

function filmKeepsakes(c) {
  return [
    { id: 'tea', have: (c.tea || 0) >= 3 }, { id: 'guitar', have: !!c.guitar },
    { id: 'pearl', have: !!c.pearl }, { id: 'stone', have: !!c.stone },
  ];
}

function winFilm(st, extra = {}) {
  st.status = 'won'; st.statusT = 0;
  st.result = { keepsakes: {}, score: st.score, pearls: st.pearls, ...extra };
}

// ================================================================= Act V
export const TOWER_SCENES = [
  { name: TEXT.tower.scenes.cliffFoot }, { name: TEXT.tower.scenes.halfway }, { name: TEXT.tower.scenes.seaGap },
  { name: TEXT.tower.scenes.wall }, { name: TEXT.tower.scenes.top },
];

function startSwim(st) {
  setPhase(st, 'swim');
  st.sw = { x: 0, dive: 0, cd: 0, swoop: null, next: 1.8, swoops: 0, aurora: null, stroke: 0 };
  st.rocks = [];
  checkpoint(st, 2);
  st.events.push({ type: 'swimStart' });
}

// The climbs are continuous (climb.js): anywhere on the painted face, from
// the start ledge or a checkpoint's place; the hold lists give the start,
// the halfway mark, the pearls and the dry ivy.
function startWall(st, name, holds, at, half, opts = {}) {
  st.holds = holds.map((h) => ({ kind: 'hold', ...h, gone: false }));
  st.wall = createWall(name, holds, at, opts);
  st.shelter = null;   // no tiny guitarist's gap on the film's cliff
  st.climb = { ...st.climb, halfY: holds[half].y };
  st.camY = clamp(st.wall.y - 250, 0, st.climb.camMax);
}
const wallAt = (holds, from, half) => (from?.wy != null ? { x: from.wx, y: from.wy }
  : from?.hold != null && holds[from.hold] ? holds[from.hold] : half != null ? holds[half] : holds.find((h) => h.start));
function takenAgain(st, from, half) {
  // pearls taken before the checkpoint stay taken
  const taken = from?.taken ?? st.wall.pearls.map((p, i) => (p.y <= st.wall.y + 4 ? i : -1)).filter((i) => i >= 0);
  for (const i of taken) if (st.wall.pearls[i]) st.wall.pearls[i].taken = true;
}

function startTower(st, from = null) {
  setPhase(st, 'tower');
  st.climb = { top: TOWER_TOP, camMax: TOWER_TOP - 330, half: TOWER_HALF, halfScene: 4, openTop: true };
  startWall(st, 'tower', TOWER_HOLDS, wallAt(TOWER_HOLDS, from, from ? TOWER_HALF : null), TOWER_HALF,
    { goal: { x: TOWER_WINDOW.x, y: TOWER_WINDOW.y, r: 60 }, floor: 110 });
  if (from) takenAgain(st, from);
  st.rocks = []; st.nextRock = 3.4;
  if (!from) checkpoint(st, 3);
}

function stepClimb(st, dt, input) {
  const w = st.wall, cfg = st.climb;
  const r = stepWall(w, dt, input, {
    events: st.events,
    hit: (cause) => hit(st, { cause }),
    pearl: (p) => { st.pearls++; st.score += 10; st.events.push({ type: 'pearl', x: p.x, y: p.y }); },
  });
  if (r === 'top') { reachTop(st, { x: w.x }); return; }
  if ((st.checkpoint?.scene | 0) < cfg.halfScene && w.mode === 'ledge' && w.y >= cfg.halfY - 6) {
    checkpoint(st, cfg.halfScene, { wx: w.x, wy: w.y, taken: w.pearls.map((p, i) => (p.taken ? i : -1)).filter((i) => i >= 0) });
  }
  // The camera follows, like a cliff flat winched down through the floor.
  const want = clamp(w.y - 250, 0, cfg.camMax);
  st.camY += (want - st.camY) * Math.min(1, dt * 3);
  const before = st.lanterns;
  stepRocks(st, dt, climberPos(st));
  if (st.lanterns < before) jolt(w);
}

export const actTower = {
  id: 5, key: 'tower', kicker: TEXT.tower.kicker, title: TEXT.tower.title, size: 116, page: 5,
  sub: TEXT.tower.sub,
  // (no second card: the act card and the cliff's own prompts say it)
  intertitle: null,
  action: TEXT.tower.action,
  scenes: TOWER_SCENES,
  mood: (st) => (st.phase === 'swim' ? 'storm' : st.phase === 'dive' || st.phase === 'window' ? 'tender' : 'storm'),
  touchLive: (st) => ['cliff', 'tower', 'swim'].includes(st.phase) || (st.phase === 'dive' && !st.dv),
  touchVerb: (st) => (st.phase === 'swim' || st.phase === 'dive' ? TEXT.touch.verb.dive : TEXT.touch.verb.leap),
  touchHint: TEXT.tower.touchHint,
  touchScheme: (st) => (st.phase === 'swim' ? { mode: 'stick', hint: TEXT.tower.touchSwim } : { mode: 'stick', hint: TEXT.touch.scheme.climb }),

  create({ seed = 1, carry = {}, from = null } = {}) {
    const k = clamp(from?.scene | 0, 0, TOWER_SCENES.length - 1);
    // The cliff, from Act V's own create (scene 1 is its halfway checkpoint).
    const st = act5.create({ seed, carry, from: k === 1 ? { ...from, scene: 1 } : null });
    st.part = 'tower';
    // the film's own cliff route, on the cliff's painted ledges and ivy
    st.climb = { top: CLIFF.top, camMax: CLIFF.camMax, half: FILM_CLIFF_HALF, halfScene: 1, openTop: true };
    startWall(st, 'cliff', FILM_CLIFF, wallAt(FILM_CLIFF, k === 1 ? from : null, k === 1 ? FILM_CLIFF_HALF : null), FILM_CLIFF_HALF, { floor: 40 });
    st.cl = null;
    if (k === 1) takenAgain(st, from);
    else st.camY = 0;
    st.carry = { ...CARRY_DEFAULT, ...carry };
    st.events.length = 0;
    if (k >= 2) { st.score = from.score ?? 0; st.pearls = from.pearls ?? 0; }
    if (k === 2) startSwim(st);
    else if (k === 3) startTower(st);
    else if (k === 4) startTower(st, from || {});
    st.events.length = 0;
    st.checkpoint = k > 0 ? { ...from, scene: k } : null;
    return st;
  },

  step(st, dt, input = {}) {
    if (!base(st, dt, input)) return;
    if ((st.phase === 'cliff' || st.phase === 'tower') && st.wall) stepClimb(st, dt, input);
    else if (st.phase === 'cliff' || st.phase === 'tower') stepCliff(st, dt, input);
    else if (st.phase === 'dive') { if (!st.w) startDive(st); stepDive(st, dt, input); }
    else if (st.phase === 'swim') stepSwim(st, dt, input);
    else if (st.phase === 'window') { if (st.phaseT >= FILM_T.window) setPhase(st, 'iris'); }
    else if (st.phase === 'iris' && st.phaseT >= FILM_T.iris) winFilm(st);
    if (st.defeatT === 0) lostText(st);
    st.lastBeat = st.beat;
  },

  hud(st) {
    if (!['cliff', 'swim', 'tower'].includes(st.phase)) return null;
    const prog = st.phase === 'cliff' ? 0.4 * clamp(climberPos(st).y / CLIFF.top, 0, 1)
      : st.phase === 'swim' ? 0.4 + 0.2 * clamp(st.sw.x / SWIM.len, 0, 1)
        : 0.6 + 0.4 * clamp(climberPos(st).y / TOWER_TOP, 0, 1);
    return { lanterns: st.lanterns, maxLanterns: LANTERNS, pearls: st.pearls, progress: prog, keepsakes: filmKeepsakes(st.carry) };
  },

  announce(e) {
    const A = TEXT.tower.announce;
    if (e.type === 'hit') return A.hit(e.lanterns);
    if (e.type === 'clifftop') return A.clifftop;
    if (e.type === 'swimStart') return A.swimStart;
    if (e.type === 'witchSwoop') return A.witchSwoop;
    if (e.type === 'auroraLight') return A.auroraLight;
    if (e.type === 'towerFoot') return A.towerFoot;
    if (e.type === 'stoneWarn') return A.stoneWarn;
    if (e.type === 'holdCrumble') return A.holdCrumble;
    return null;
  },

  focus: art.focusTower, draw: art.drawTower, drawOver: art.drawOverTower, onEvent: art.onEventTower,
};

function lostText(st) {
  st.lostTitle = st.phase === 'swim' ? TEXT.tower.lost.seaTitle : st.phase === 'tower' ? TEXT.tower.lost.towerTitle : TEXT.tower.lost.cliffTitle;
  st.lostSub = st.phase === 'swim' ? TEXT.tower.lost.seaSub : TEXT.tower.lost.cliffSub;
}

function stepSwim(st, dt, input) {
  const sw = st.sw;
  if (sw.arrivalT != null) {
    sw.arrivalT += dt;
    if (sw.arrivalT >= SWIM.arrival) { st.score += 150; st.events.push({type:'towerFoot'}); startTower(st); }
    return;
  }
  const mx = input.moveX || (input.left ? -1 : 0) || (input.right ? 1 : 0);
  sw.x = clamp(sw.x + (mx * SWIM.speed - SWIM.current) * dt, 0, SWIM.len);
  if (Math.abs(mx) > 0.2) sw.stroke += dt;
  sw.cd = Math.max(0, sw.cd - dt);
  if (sw.dive > 0) { sw.dive -= dt; if (sw.dive <= 0) { sw.cd = SWIM.diveCD; st.events.push({ type: 'surface' }); } }
  else if (input.a && sw.cd <= 0) { sw.dive = SWIM.dive; st.events.push({ type: 'dive' }); }
  // The witch swoops at where he will be; her shadow on the water warns.
  if (sw.aurora == null && !sw.swoop) {
    sw.next -= dt;
    if (sw.next <= 0) {
      const lead = SWIM.warn + (st.omen ? BEAT_S : 0);
      sw.swoop = { x: clamp(sw.x + mx * SWIM.speed * lead * 0.6, 0, SWIM.len), t: 0, lead };
      st.events.push({ type: 'witchSwoop' });
    }
  }
  if (sw.swoop) {
    sw.swoop.t += dt;
    if (sw.swoop.t >= sw.swoop.lead && !sw.swoop.struck) {
      sw.swoop.struck = true;
      if (Math.abs(sw.x - sw.swoop.x) < 80 && sw.dive <= 0) hit(st, { cause: 'witch' });
      else st.events.push({ type: 'witchMiss' });
    }
    if (sw.swoop.t >= sw.swoop.lead + 0.6) {
      sw.swoop = null; sw.swoops++;
      const [lo, hi] = SWIM.every; sw.next = lo + st.rand() * (hi - lo);
      if (sw.swoops >= SWIM.swoops) { sw.aurora = 0; st.events.push({ type: 'auroraLight' }); }
    }
  }
  if (sw.aurora == null && !sw.swoop && sw.x >= SWIM.len * SWIM.auroraAt) { sw.aurora = 0; st.events.push({ type: 'auroraLight' }); }
  if (sw.aurora != null) sw.aurora += dt;
  if (sw.x >= SWIM.len) { sw.arrivalT = 0; sw.dive = 0; sw.swoop = null; }
}

// ================================================================= Act VI
export const BURNING_SCENES = [
  { name: TEXT.burning.scenes.inside }, { name: TEXT.burning.scenes.carrying }, { name: TEXT.burning.scenes.cliff },
  { name: TEXT.burning.scenes.lastAttack }, { name: TEXT.burning.scenes.wedding },
];
// Film scenes 0-3 are Act V's house (2), carry (3), quay (4) and barrel (5).
const LEGACY_SCENE = [2, 3, 4, 5];

export const actBurning = {
  id: 6, key: 'burning', kicker: TEXT.burning.kicker, title: TEXT.burning.title, size: 120, page: 7,
  sub: TEXT.burning.sub,
  action: TEXT.burning.action,
  scenes: BURNING_SCENES,
  mood: (st) => (['wedding', 'apotheosis', 'finale', 'iris'].includes(st.phase) ? 'wedding' : 'storm'),
  touchLive: (st) => !st.battleIntro && (['house', 'quay', 'apotheosis', 'finale'].includes(st.phase) || (st.phase === 'wedding' && (st.weddingIntro === false || st.phaseT >= FILM_T.weddingLead)) || (st.phase === 'barrel' && st.barrel?.fallT == null)),
  // the second button swings the sword in the witch's last stand
  touchVerbB: (st) => (nearGiftFairy(st) ? TEXT.touch.verb.gift : creditsDone(st) && st.leaveT == null ? TEXT.touch.verb.title : st.phase === 'barrel' && st.duel && st.duel.state !== 'trap' ? TEXT.touch.verb.strike : ''),
  touchVerb: (st) => (st.phase === 'barrel' && st.duel ? TEXT.touch.verb.leap : st.phase === 'barrel' ? '' : st.phase === 'house' && st.carry?.stone && !st.stoneThrown ? TEXT.touch.verb.action : TEXT.touch.verb.leap),
  fade: st => st?.leaveT != null ? clamp(st.leaveT / ENDING.fade, 0, 1) : st?.phase === 'victory' ? clamp((st.phaseT - FILM_T.victory) / FILM_T.victoryFade, 0, 1) : st?.phase === 'wedding' && st.weddingIntro !== false ? clamp(1 - (st.phaseT - FILM_T.weddingLead) / FILM_T.weddingFade, 0, 1) : 0,
  touchHint: TEXT.burning.touchHint,
  touchScheme: (st) => (st.phase === 'barrel' && st.duel ? { mode: 'stick', hint: TEXT.burning.touchWalk } : ['wedding', 'apotheosis', 'finale'].includes(st.phase) ? { mode: 'swipe', hint: TEXT.burning.touchCelebrate } : (st.phase === 'barrel' && !st.duel) ? { mode: 'swipe', hint: TEXT.burning.touchWalk } : { mode: 'stick', hint: TEXT.burning.touchStairs }),

  create({ seed = 1, carry = {}, from = null } = {}) {
    const k = clamp(from?.scene | 0, 0, BURNING_SCENES.length - 1);
    const lk = LEGACY_SCENE[Math.min(k, 2)];
    const st = act5.create({ seed, carry, from: { ...(from || {}), scene: lk } });
    st.part = 'burning';
    st.houseExit = { side: 'right', x: TOWER_ESCAPE.x };
    // A second ladder from the middle floor to the ground, unfolding just
    // after the first when the floor breaks, so the way down reads clearly.
    if (!st.conns.some((c) => c.id === 'ladderDown2')) {
      const saved = from?.conns?.find((c) => c.id === 'ladderDown2');
      st.conns.push({ id: 'ladderDown2', kind: 'ladder', a: { x: 772, f: 0 }, b: { x: 772, f: 1 }, on: saved ? !!saved.on : !!st.broke });
    }
    // The left-hand demon and its fires arrive once he is inside (TOWER_FIRE);
    // a resume into the carry finds them already lit.
    st.leftFireT = st.p.carry || (from?.scene | 0) > 1 ? 99 : null;
    st.escapeT = st.p.carry ? Math.max(0, from?.escapeT || 0) : null;
    st.escapeFire = st.p.carry ? (from?.escapeFire ?? 1) : 1;
    st.carry = { ...CARRY_DEFAULT, ...carry };
    st.score = from?.score ?? 0; st.pearls = from?.pearls ?? 0;
    st.sleepersShown = Math.min(12, Math.max(0, carry.sleepers || 0));
    if (k === 3) { startBarrel(st, !!from?.introDone); st.haz = []; }
    if (k === 4) { startWedding(st); st.haz = []; }
    st.events.length = 0;
    st.checkpoint = k > 0 ? { ...(from || {}), scene: k } : null;
    return st;
  },

  step(st, dt, input = {}) {
    if (!base(st, dt, input)) return;
    if (st.smoke) st.smoke = st.smoke.filter(puff => (puff.t += dt) < AURORA.smokeLife);
    if (st.creditsT != null) st.creditsT += dt;
    if (st.creditsT != null) {
      const active = movingDirection(input) || input.a || input.x;
      st.idleT = active ? 0 : (st.idleT || 0) + dt;
      if (st.leaveT == null && creditsDone(st) && ((input.x && !nearGiftFairy(st))
        || (input.songLeft != null && input.songLeft <= ENDING.fade && st.idleT >= ENDING.idle))) {
        st.leaveT = 0; st.events.push({ type: 'leaveToTitle' });
      }
    }
    // fading out to the title screen: the stage holds still
    if (st.leaveT != null) { st.leaveT += dt; if (st.leaveT >= ENDING.fade) st.toTitle = true; return; }
    const cpBefore = st.checkpoint;
    if (st.phase === 'house') {
      const carrying = st.p.carry;
      if (carrying) { st.escapeT = (st.escapeT || 0) + dt; st.escapeFire = towerEscapeFire(st); }
      // the demon comes as soon as he moves (or after a moment) and lights the fires behind him
      if (st.leftFireT == null && (Math.abs(input.moveX || 0) > 0.15 || input.up || input.a || st.phaseT >= TOWER_FIRE.wait)) { st.leftFireT = 0; st.events.push({ type: 'demonArrives' }); }
      else if (st.leftFireT != null) st.leftFireT += dt;
      stepHouse(st, dt, input);
      if (!carrying && st.p.carry) { st.escapeT = 0; st.escapeFire = 1; }
      if (st.phase === 'house' && st.p.carry) st.escapeFire = towerEscapeFire(st);
    }
    else if (st.phase === 'quay') stepQuay(st, dt, input);
    else if (st.phase === 'barrel') { if (!st.barrel && !st.duel) startBarrel(st); stepBarrel(st, dt, input); }
    else if (st.phase === 'victory' && st.phaseT >= FILM_T.victory + FILM_T.victoryFade) startWedding(st);
    else if (st.phase === 'wedding') stepWedding(st, dt, input);
    else if (st.phase === 'apotheosis' || st.phase === 'finale') stepApotheosis(st, dt, input);
    else if (st.phase === 'iris' && st.phaseT >= FILM_T.iris) winFilm(st, { ending: 'wedding' });
    // Act V's house checkpoints are numbered as its own scenes; renumber.
    if (st.checkpoint && st.checkpoint !== cpBefore && !st.checkpoint.film) {
      const film = LEGACY_SCENE.indexOf(st.checkpoint.scene);
      if (film >= 0) st.checkpoint = { ...st.checkpoint, scene: film };
    }
    // (the witch's own defeat keeps its words: duelHit)
    if (st.defeatT === 0 && st.phase === 'house') { st.lostTitle = TEXT.burning.lost.fireTitle; st.lostSub = TEXT.burning.lost.fireSub; }
    st.lastBeat = st.beat;
  },

  hud(st) {
    if (st.battleIntro) return null;
    if (!['house', 'quay', 'barrel'].includes(st.phase)) return null;
    const prog = st.phase === 'house' ? (st.p.carry ? 0.45 : 0.15) : st.phase === 'quay' ? 0.7 + 0.2 * clamp((st.p.x - QUAY.x0) / (QUAY.x1 - QUAY.x0), 0, 1)
      : st.duel ? 0.9 + 0.05 * (1 - st.duel.hp / DUEL.hp) : 0.95 + 0.05 * clamp(((st.barrel?.x ?? BARREL.at) - BARREL.at) / (BARREL.edge - BARREL.at), 0, 1);
    return { lanterns: st.lanterns, maxLanterns: LANTERNS, pearls: st.pearls, progress: prog, keepsakes: filmKeepsakes(st.carry) };
  },

  announce(e) {
    const A = TEXT.burning.announce;
    if (e.type === 'hit') return A.hit(e.lanterns);
    if (e.type === 'beamWarn') return A.beamWarn;
    if (e.type === 'shutterLocked') return A.shutterLocked;
    if (e.type === 'shutterSmash') return A.shutterSmash;
    if (e.type === 'liftHer') return A.liftHer;
    if (e.type === 'floorBreak') return A.floorBreak;
    if (e.type === 'houseFall') return A.houseFall;
    if (e.type === 'witchReturns' || e.type === 'battleFaceoff') return A.faceoff;
    if (e.type === 'battleArrival') return A.battleArrival;
    if (e.type === 'azurineSheltered') return A.azurineSheltered;
    if (e.type === 'battleReady') return A.battleReady;
    if (e.type === 'witchStruck') return e.hp > 0 ? A.witchStruck : A.witchBeatenShort;
    if (e.type === 'witchBlast') return e.repel ? A.witchRepel : A.witchBlast;
    if (e.type === 'witchBeaten') return A.witchBeaten;
    if (e.type === 'witchInBarrel') return A.witchInBarrel;
    if (e.type === 'barrelFall') return A.barrelFall;
    if (e.type === 'wedding') return A.wedding;
    if (e.type === 'apotheosis') return A.apotheosis;
    if (e.type === 'ascend') return A.ascend;
    if (e.type === 'floatDown') return A.floatDown;
    if (e.type === 'demonArrives') return A.demonArrives;
    if (e.type === 'leaveToTitle') return A.leaveToTitle;
    if (e.type === 'giftGiven') return e.n === 1 ? A.giftFirst : A.gift(e.n);
    if (e.type === 'finale') return A.finale;
    return null;
  },

  focus: art.focusBurning, draw: art.drawBurning, drawOver: art.drawOverBurning, onEvent: art.onEventBurning,
};

// ---------------------------------------------------------------- walking scenes
// The prince on foot on a flat floor: walk, and (where allowed) leap.
function walker(x, y) { return { x, y, vx: 0, vy: 0, on: true, face: 1, walk: 0, buffer: 0, knockT: 0, landT: 0 }; }
function walk(w, dt, input, { y, x0, x1, leap = false, events = null, jumpSpeed = WALK.jump }) {
  let mx = clamp(input.moveX || 0, -1, 1);
  if (w.knockT > 0) { w.knockT -= dt; mx = 0; }
  w.landT = Math.max(0, w.landT - dt);
  if (Math.abs(mx) > 0.15) w.face = Math.sign(mx);
  w.vx += clamp(mx * WALK.speed - w.vx, -WALK.acc * dt, WALK.acc * dt);
  const jumped = stepJump(w, dt, input, y, leap, events, jumpSpeed);
  w.x = clamp(w.x + w.vx * dt, x0, x1);
  if (w.on) w.walk += Math.abs(w.vx) * dt;
  return jumped;
}
function stepJump(w, dt, input, y, leap = true, events = null, jumpSpeed = CELEBRATION.jump) {
  w.buffer = input.a ? WALK.buffer : Math.max(0, w.buffer - dt);
  const jumped = leap && w.on && w.buffer > 0;
  if (jumped) { w.vy = -jumpSpeed; w.on = false; w.buffer = 0; events?.push({ type: 'leap' }); }
  if (!w.on) {
    w.vy += (WALK.g + (w.vy < 0 && !input.aHeld ? WALK.cut : 0)) * dt;
    w.y += w.vy * dt;
    if (w.y >= y) { w.y = y; w.vy = 0; w.on = true; w.landT = 0.12; }
  }
  return !!jumped;
}

// Act V: from the cliff top he walks to the edge and dives for the tower
// (A, or walking off the edge), arcing down into the sea.
function startDive(st) {
  setPhase(st, 'dive');
  st.w = walker(DIVE.start, diveFloor(DIVE.start));
  st.dv = null;
}
function stepDive(st, dt, input) {
  const w = st.w;
  if (st.dv) {
    const d = st.dv;
    d.t += dt;
    if (!d.splash) { d.vy += WALK.g * 0.8 * dt; w.x += d.vx * dt; w.y += d.vy * dt; d.rot += dt * 3.2;
      if (w.y >= DIVE.water) { d.splash = true; d.t = 0; st.events.push({ type: 'diveSplash', x: w.x, y: DIVE.water }); } }
    else if (d.t >= FILM_T.splash) startSwim(st);
    return;
  }
  // A leaps on the clifftop like anywhere else; at the edge it dives
  const atEdge = w.x > DIVE.edge - 110;
  walk(w, dt, atEdge ? { ...input, a: false } : input, { y: diveFloor(w.x), x0: DIVE.x0, x1: DIVE.edge + 40, leap: true });
  if (w.on) w.y = diveFloor(w.x);
  if ((input.a && atEdge) || w.x > DIVE.edge + 10) {
    st.dv = { t: 0, vx: 170, vy: -260, rot: 0, splash: false };
    st.events.push({ type: 'diveLeap' });
  }
}

// Act VI: the witch's last attack. She stands on the clifftop and fights; once
// he has beaten her she hides in her barrel, and he pushes it over the edge.
function startBarrel(st, ready = false) {
  setPhase(st, 'barrel');
  st.w = walker(ready ? BATTLE_INTRO.ready : BATTLE_INTRO.heroFrom, BARREL.y);
  st.battleIntro = ready ? null : { t: 0, stage: null };
  st.shelteredAz = ready ? walker(BATTLE_INTRO.shelter, BARREL.y) : null;
  if (ready && st.p) st.p.carry = false;
  st.duel = { x: ready ? DUEL.x : BATTLE_INTRO.witchFrom, hp: DUEL.hp, state: 'idle', t: 0, next: DUEL.idle[1], bolts: [], strikeT: 0 };
  st.barrel = null;
  st.smoke = [];
}
function stepBattleIntro(st, dt) {
  const intro = st.battleIntro, w = st.w, d = st.duel, before = w.x;
  intro.t += dt;
  const frame = battleIntroFrame(st), smooth = frame.u*frame.u*(3-2*frame.u);
  if (frame.stage !== intro.stage) {
    intro.stage = frame.stage;
    if (frame.stage === 'faceoff') st.events.push({type:'battleFaceoff'});
    if (frame.stage === 'arrival') st.events.push({type:'battleArrival'});
    if (frame.stage === 'rise') {
      st.shelteredAz = walker(BATTLE_INTRO.shelter, BARREL.y);
      if (st.p) st.p.carry = false;
      st.events.push({type:'azurineSheltered'});
    }
  }
  d.x = frame.stage === 'faceoff' ? lerp(BATTLE_INTRO.witchFrom,DUEL.x,smooth) : DUEL.x;
  d.state = frame.stage === 'faceoff' ? (frame.u < .22 ? 'warn' : 'reel') : 'idle';
  d.t = d.state === 'warn' ? frame.u*DUEL.warn : .4;
  if (frame.stage === 'faceoff') w.x = BATTLE_INTRO.heroFrom;
  else if (frame.stage === 'arrival') w.x = lerp(BATTLE_INTRO.heroFrom,BATTLE_INTRO.handoff,frame.u);
  else if (frame.stage === 'forward') w.x = lerp(BATTLE_INTRO.handoff,BATTLE_INTRO.ready,frame.u);
  else w.x = frame.stage === 'settle' ? BATTLE_INTRO.ready : BATTLE_INTRO.handoff;
  w.vx = dt > 0 ? (w.x-before)/dt : 0; w.walk += Math.abs(w.x-before); w.face = 1;
  if (intro.t >= BATTLE_INTRO_END) {
    st.battleIntro = null; st.phaseT = 0;
    st.w = walker(BATTLE_INTRO.ready,BARREL.y);
    st.shelteredAz ||= walker(BATTLE_INTRO.shelter,BARREL.y);
    if (st.p) st.p.carry = false;
    d.x = DUEL.x; d.state = 'idle'; d.t = 0; d.next = DUEL.idle[1]; d.bolts.length = 0;
    st.checkpoint = {scene:3,film:true,introDone:true,score:st.score,pearls:st.pearls};
    st.events.push({type:'battleReady'});
  }
}
// Halfway back along the approach, safely beyond sword range. The shove
// is a response to a successful strike and never costs a lantern itself.
export const duelResetX = st => (BARREL.start + st.duel.x - DUEL.hw - PRINCE_HW) / 2;
function stepDuel(st, dt, input) {
  const d = st.duel, w = st.w;
  const locked = d.state === 'trap' || d.state === 'reel';
  walk(w, dt, locked ? {} : input, { y: BARREL.y, x0: BARREL.x0,
    x1: d.x - DUEL.hw - PRINCE_HW, leap: true, events: st.events });
  d.t += dt; w.strikeT = Math.max(0, (w.strikeT || 0) - dt);
  const dist = d.x - DUEL.hw - (w.x + PRINCE_HW);
  if (input.x && w.strikeT <= 0 && w.knockT <= 0 && !locked) {
    w.strikeT = DUEL.swing; st.events.push({ type: 'swordSwing', x: w.x });
    if (duelReach(st)) {
      d.hp--; d.state = 'reel'; d.t = 0; d.bolts.length = 0;
      st.events.push({ type: 'witchStruck', x: d.x, hp: d.hp });
      if (d.hp <= 0) {
        d.state = 'trap'; st.score += 300; st.events.push({ type: 'witchBeaten', x: d.x });
      } else {
        d.shoveFrom = w.x; d.shoveY = w.y; d.resetX = duelResetX(st);
        w.knockT = DUEL.reel; w.buffer = 0;
        st.events.push({ type: 'witchBlast', x: w.x, repel: true });
      }
    }
  }
  if (d.state === 'idle' && d.t >= d.next) {
    d.state = 'warn'; d.t = 0; st.events.push({ type: 'witchWinds', x: d.x });
  } else if (d.state === 'warn' && d.t >= DUEL.warn) {
    d.state = 'idle'; d.t = 0; d.next = lerp(DUEL.idle[0], DUEL.idle[1], st.rand());
    if (dist < DUEL.near - DUEL.hw) {
      w.knockT = 0.6; w.vx = -BARREL.knock; w.vy = -320; w.on = false;
      st.events.push({ type: 'witchBlast', x: w.x }); duelHit(st);
    } else {
      d.bolts.push({ x: d.x - DUEL.hw - 10 }); st.events.push({ type: 'witchBolt', x: d.x });
    }
  } else if (d.state === 'reel') {
    // Pushed, not hit: he slides back on his feet, still facing her, in his
    // standing pose (w.slide), and is never lifted off the ground.
    const f = clamp(d.t / DUEL.reel, 0, 1), ease = 1-(1-f)*(1-f);
    const before = w.x;
    w.x = lerp(d.shoveFrom, d.resetX, ease);
    w.y = lerp(d.shoveY, BARREL.y, Math.min(1, f * 4));
    w.vx = dt > 0 ? (w.x-before)/dt : 0; w.vy = 0; w.on = w.y >= BARREL.y; w.slide = true; w.face = 1;
    if (f >= 1) {
      w.x = d.resetX; w.y = BARREL.y; w.vx = w.vy = w.knockT = w.strikeT = 0; w.on = true; w.face = 1; w.slide = false;
      d.state = 'counter'; d.t = 0;
      d.bolts.push({ x: d.x - DUEL.hw - 10, counter: true });
      st.events.push({ type: 'witchBolt', x: d.x, counter: true });
    }
  } else if (d.state === 'counter' && d.t >= DUEL.counterPose) {
    d.state = 'idle'; d.t = 0; d.next = DUEL.idle[1];
  } else if (d.state === 'trap') {
    const T2 = DUEL.trap, was = d.t - dt, at = q => was < q && d.t >= q;
    if (at(0.05)) st.events.push({ type: 'auroraCasts', x: d.x });
    if (at(T2.land)) st.events.push({ type: 'barrelDrop', x: d.x, sound: 'barrelKnock' });
    if (d.t >= T2.end) {
      st.barrel = { x: Math.min(d.x, BARREL.edge-BARREL.hw), state: 'still', t: 0, fallT: null, rot: 0 };
      st.duel = null; st.events.push({ type: 'witchInBarrel' }); return;
    }
  }
  // her bolts run along the ground at him: leap them
  d.bolts = d.bolts.filter((bo) => {
    bo.x -= DUEL.bolt * dt;
    // Aurora catches the fire that gets past the prince. Smoke is purely
    // decorative: the projectile is removed before any further hit test.
    if (bo.x <= AURORA.shieldX) {
      st.smoke.push({ x: AURORA.shieldX, y: BARREL.y - 18, t: 0 });
      st.events.push({ type: 'auroraQuenches', x: AURORA.shieldX, y: BARREL.y - 18 });
      return false;
    }
    if (Math.abs(bo.x - w.x) < DUEL.boltR && w.y > BARREL.y - DUEL.boltH) { duelHit(st); return false; }
    return true;
  });
}
export const duelReach = (st) => !!st.duel && st.duel.x - DUEL.hw - (st.w.x + PRINCE_HW) < DUEL.reach - DUEL.hw && !['trap', 'reel'].includes(st.duel.state);
function duelHit(st) {
  if (hit(st, { cause: 'witch' }) && st.defeatT != null) {
    st.lostTitle = TEXT.burning.lost.flamesTitle;
    st.lostSub = TEXT.burning.lost.flamesSub;
  }
}
function stepBarrel(st, dt, input) {
  if (st.battleIntro) return stepBattleIntro(st,dt);
  if (st.duel) return stepDuel(st, dt, input);
  const b = st.barrel, w = st.w;
  if (b.fallT != null) {
    b.fallT += dt;
    walk(w, dt, {}, { y: BARREL.y, x0: BARREL.x0, x1: BARREL.edge - 60 });
    if (b.fallT >= FILM_T.barrelFall) {
      // The renderer finishes fading the witch and barrel at barrelFall.
      // Celebrate only once she has disappeared entirely into the water.
      setPhase(st, 'victory');
      st.events.push({ type: 'witchGone', sound: 'victoryStinger' });
    }
    return;
  }
  walk(w, dt, input, { y: BARREL.y, x0: BARREL.x0, x1: BARREL.edge - 60 });
  // beaten, she cowers in it: he walks into it and rolls it to the edge
  const contact = w.x + PRINCE_HW >= b.x - BARREL.hw - 2;
  if (contact && w.vx > 20) { b.x += BARREL.push * dt; b.rot += BARREL.push * dt / 40; st.pushing = true; }
  else st.pushing = false;
  if (contact) w.x = Math.min(w.x, b.x - BARREL.hw - PRINCE_HW);
  if (b.x >= BARREL.edge) { b.fallT = 0; st.pushing = false; st.score += 150; st.events.push({ type: 'barrelFall' }); }
}

// The wedding: he walks Azurine (she follows a step behind) along the
// wedding street past the crew, the fairies and the king and queen, to the
// castle gate, catching the petals that fall on the way.
function startWedding(st) {
  st.shelteredAz = null;
  setPhase(st, 'wedding');
  st.weddingIntro = true;
  st.weddingMusicStarted = false; // the shell starts the reveal clock when the recording actually plays
  st.events.push({ type: 'wedding' });
  st.checkpoint = { scene: 4, film: true, score: st.score, pearls: st.pearls };
  st.w = walker(WEDDING.start, WEDDING.y);
  st.az = walker(WEDDING.start - WEDDING.follow, WEDDING.y);
  st.cheers = [];
  st.petals = Array.from({ length: WEDDING.petals }, (_, i) => ({ x: 180 + ((i * 263) % 680), y: -40 - i * 70, got: false }));
  st.petalsGot = 0;
}
function follow(st, dt, gap, jumped = false, held = false, floor = WEDDING.y) {
  const a=st.az, floorAt=typeof floor==='function'?floor:()=>floor, oldFloor=floorAt(a.x);
  stepJump(a,dt,{a:jumped,aHeld:held},oldFloor);
  const want=st.w.x-gap*st.w.face, dx=want-a.x;
  const v=clamp(dx*4,-WALK.speed,WALK.speed);
  a.x+=v*dt;
  if(typeof floor==='function')a.x=clamp(a.x,WEDDING.x0,WEDDING.gate);
  a.y+=floorAt(a.x)-oldFloor;
  if(a.on)a.y=floorAt(a.x);
  a.vx=v;a.walk+=Math.abs(v)*dt;
  if(Math.abs(v)>20)a.face=Math.sign(v);
  a.stairs=typeof floor==='function'&&a.on&&a.x>=WEDDING.stairs;
}
function stepWedding(st,dt,input) {
  if(st.weddingIntro!==false&&st.phaseT<FILM_T.weddingLead)return;
  if(st.phaseT>=FILM_T.weddingLead+FILM_T.weddingFade)st.weddingIntro=false;
  const w=st.w, oldFloor=weddingFloor(w.x);
  // Finish stepping out of the doorway before handing movement back.
  const exiting = !!st.weddingExit;
  if (exiting) input = { moveX: -1 };
  const vertical= input.moveY || (input.down?1:input.up?-1:0);
  const moveX=(Math.abs(input.moveX||0)>.15?input.moveX:w.x>=WEDDING.stairs?-vertical:0)*(w.x>=WEDDING.stairs?WEDDING.climb:1);
  const jumped=walk(w,dt,{...input,moveX},{y:oldFloor,x0:WEDDING.x0,x1:WEDDING.gate,leap:true,jumpSpeed:CELEBRATION.jump});
  w.y+=weddingFloor(w.x)-oldFloor;if(w.on)w.y=weddingFloor(w.x);
  w.stairs=w.on&&w.x>=WEDDING.stairs;
  if (exiting && w.x <= WEDDING.returnAt) st.weddingExit = false;
  const gap=WEDDING.follow*(1-clamp((w.x-WEDDING.stairs)/(WEDDING.gate-WEDDING.stairs),0,1));
  follow(st,dt,gap,jumped,input.aHeld,weddingFloor);
  st.cheers=st.cheers.filter(wave=>st.clock-wave.at<WEDDING_GUESTS.length*CELEBRATION.stagger+CELEBRATION.guestDuration);
  if(jumped)st.cheers.push({at:st.clock,order:[...weddingGuests(st)].sort((a,b)=>Math.abs(a[1]-w.x)-Math.abs(b[1]-w.x)).map(([id])=>id)});
  for(const p of st.petals){
    if(p.got)continue;
    p.y+=70*dt;p.x+=Math.sin(st.clock*2+p.y*.02)*30*dt;
    if(p.y>WEDDING.y+10){p.y=-30;continue;}
    if(Math.abs(p.x-w.x)<40&&p.y>w.y-200&&p.y<w.y){p.got=true;st.petalsGot++;st.score+=20;st.events.push({type:'petal',x:p.x,y:p.y});}
  }
  // The prince waits inside while Azurine finishes crossing the doorway.
  if(!exiting&&moveX>.15*WEDDING.climb&&w.x>=WEDDING.gate-.5&&st.az.x>=WEDDING.gate-5&&w.on&&st.az.on)startApotheosis(st);
}
function returnToWedding(st){
  setPhase(st,'wedding');st.weddingIntro=false;st.weddingMusicStarted=true;st.weddingExit=true;
  st.w=walker(WEDDING.gate,weddingFloor(WEDDING.gate));st.w.face=-1;
  st.az=walker(WEDDING.gate,weddingFloor(WEDDING.gate));st.az.face=-1;
  st.flight=null;st.riseT=null;st.lift=0;
}
function startApotheosis(st){
  setPhase(st,st.creditsT!=null?'finale':'apotheosis');st.events.push({type:'apotheosis'});
  st.w=walker(APOTH.x0+65,APOTH.y);st.az=walker(APOTH.x0+20,APOTH.y);
  st.riseT=null;st.flight=null;st.lift=0;
}
export const creditsDone = st => st?.creditsT != null && st.creditsT >= FINALE_END && ['wedding', 'apotheosis', 'finale'].includes(st.phase);
const movingDirection=input=>Math.abs(input.moveX||0)>.15||Math.abs(input.moveY||0)>.15||input.up||input.down||input.left||input.right;
function stepApotheosis(st,dt,input){
  const w=st.w;
  // the Water Fairy's gifts in flight to the heap
  st.giftsFlying=(st.giftsFlying||[]).filter(g=>{g.t+=dt;if(g.t>=GIFTING.flight){st.giftsLanded=(st.giftsLanded||0)+1;st.giftKinds=[...(st.giftKinds||[]),g.kind];return false;}return true;});
  if(input.x&&nearGiftFairy(st)){
    const n=st.giftN=(st.giftN||0)+1, kind=GIFTING.kinds[(n-1)%GIFTING.kinds.length];
    st.giftsFlying.push({kind,t:0,slot:pileCount(st)+st.giftsFlying.length});
    st.events.push({type:'giftGiven',n,kind});
  }
  if(st.flight){
    if(st.flight==='rise'){
      st.riseT=Math.min(FILM_T.rise,st.riseT+dt);
      // a slow, even rise in their standing poses (eased in and out)
      const f=st.riseT/FILM_T.rise,from=st.riseFrom||0;st.lift=from+(140-from)*f*f*(3-2*f);
      if(st.riseT>=FILM_T.rise&&st.riseAgain){
        // Once the credits have begun, a jump into the light is a slow float
        // up and straight back down, steerable at once, with no hold.
        st.flight='descend';st.releaseT=0;st.events.push({type:'floatDown'});
      }else if(st.riseT>=FILM_T.rise){
        st.flight='hold';
        if(st.creditsT==null){st.creditsT=0;st.result={ending:'wedding',score:st.score,pearls:st.pearls};st.events.push({type:'finale'});}
        st.phase='finale';
      }
    }
    // Held aloft until the credits begin to roll; then any direction brings
    // them slowly back down to walk about while the credits run.
    if(st.flight==='hold'&&st.creditsT>=FINALE.celebrate&&movingDirection(input)){st.flight='descend';st.releaseT=0;st.events.push({type:'floatDown'});}
    if(st.flight==='descend'){
      st.releaseT+=dt;const f=clamp(st.releaseT/FILM_T.descend,0,1);st.lift=140*(1-f*f*(3-2*f));
      const dx=clamp(input.moveX||0,-1,1);w.x=clamp(w.x+dx*WALK.speed*.35*dt,APOTH.x0,APOTH.x1);
      st.az.x+=clamp((w.x-70*w.face-st.az.x)*3,-WALK.speed,WALK.speed)*dt;
      if(Math.abs(dx)>.15)w.face=st.az.face=Math.sign(dx);
      if(f>=1){st.flight=null;st.riseT=null;st.lift=0;for(const actor of [w,st.az]){actor.y=APOTH.y;actor.vy=0;actor.on=true;actor.buffer=0;}}
    }
    return;
  }
  const before=w.x;
  const jumped=walk(w,dt,input,{y:APOTH.y,x0:APOTH.off,x1:APOTH.x1,leap:true,jumpSpeed:CELEBRATION.jump});
  follow(st,dt,70,jumped,input.aHeld,APOTH.y);
  // Any jump that is in the air over the light (or passes across its centre)
  // carries them up, from the height they have reached.
  const over=Math.abs(w.x-APOTH.mark)<APOTH.near||(before-APOTH.mark)*(w.x-APOTH.mark)<=0;
  if(!w.on&&over){
    st.flight='rise';st.riseT=0;st.riseFrom=st.lift=clamp(APOTH.y-w.y,0,140);st.riseAgain=st.creditsT!=null;
    for(const actor of [w,st.az]){actor.y=APOTH.y;actor.vy=0;actor.vx=0;actor.on=false;}
    st.events.push({type:'ascend'});
  }else if(st.az.x<=APOTH.offAz&&w.x<st.az.x)returnToWedding(st);
}

export { GRACE, HOLDS, lerp };
