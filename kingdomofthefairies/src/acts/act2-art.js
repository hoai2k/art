// Act II drawing: the grotto descent, the close at the cave floor and the
// moon-boat interlude. Every piece of art has a procedural stand-in until its
// file is delivered (ids and sizes in design/image-requests.md, Parts C1 and
// C3, drawn at half the listed pixel size). No randomness: both passes must
// draw the same shapes, so all motion comes from state and `t`.
import {
  CAM_MAX, FLOOR, SHELF_Y, REST, TUNE, PHASE_LEN, DRAGON, RIDE,
  clamOpen, clamIsOpen, clamSpent, clamRipe, jellyPos, dragonPos, eelExt, rideRowPos, ridePearlX, rideLeapH, ROSE_CUES,
} from './act2.js';
import { clamp, lerp, easeOut, easeInOut, beatPhase, SPENT } from './shared.js';
import { FILM, words } from '../theme.js';
import { REST_GAP } from '../sprite-fit.js';
import { TEXT } from '../text_config.js';
import { drawPose, CREW_OF } from '../pose.js';
import { richText, measureRichText } from '../art.js';   // headless-safe: art.js touches no DOM at load

const TAU = Math.PI * 2;
const sy = (st, wy) => wy - st.cam + 60;           // world y -> stage y
const onScreen = (st, wy, pad = 160) => wy > st.cam - pad && wy < st.cam + 590 + pad;
const REV_COLS = ['#e3c13b', '#6f9a4a', '#8a3f7a', '#e7a6bd'];
const NAVY = '#27304a';

// Fixed decoration (world coordinates).
const KELP = [[262, 640, 380], [1018, 1380, 420], [300, 2280, 400], [992, 3000, 380], [270, 3700, 360]];
const FISH = [[1150, 1], [2030, -1], [2960, 1], [3820, -1]];
// (literal y: act2.js's FLOOR + 40; module-level code can't read its bindings, the import is circular)
const CORAL = [[400, 4190, 'a', 1], [905, 4190, 'b', 1], [1010, 2330, 'a', 0.55], [268, 1910, 'b', 0.55]];

// ---------------------------------------------------------------- entry
export function draw(k, st, t) {
  if (st.phase === 'ride' || st.phase === 'iris') return ride(k, st, t);
  grotto(k, st, t);
}

// The mobile camera's focus (src/camera.js): the player's middle, stage px.
export function focus(st) {
  if (st.phase === 'ride') return { x: boatX(st), y: rowY(st) - 70 };
  const s = st.sailor;
  return s ? { x: s.x, y: sy(st, s.y) } : null;
}

export function drawOver(k, st) {
  const ph = st.phase, pt = st.phaseT;
  if (ph === 'swim' || ph === 'offer' || ph === 'choice') airGauge(k, st);
  if (ph === 'choice' && pt > PHASE_LEN.choice - 0.6) {
    const s = st.sailor;
    k.iris(s.x, sy(st, s.y), 760 * (1 - easeInOut((pt - (PHASE_LEN.choice - 0.6)) / 0.6)));
  }
  if (ph === 'ride' && pt < 0.8) k.iris(boatX(st), 420, 760 * easeInOut(pt / 0.8));
  if (ph === 'iris') k.iris(boatX(st), boatY(st) - 40, 760 * (1 - easeInOut(pt / PHASE_LEN.iris)));
  if (st.status === 'won') k.iris(640, 400, 0);
}

export function onEvent(k, e, st) {
  const s = st.sailor, x = s.x, y = sy(st, s.y);
  switch (e.type) {
    case 'sailorWake': k.burst(x, y - 20, '#eef3ea', 14, 'bubble'); break;
    case 'swimStart': k.text(words(TEXT.grotto.burst.followGuitar), 640, 200, true); break;
    case 'tapMark': k.burst(e.x, sy(st, e.y), '#ffe27a', 10, 'sparkle'); break;
    case 'swimKick': k.burst(x - s.face * 70, y + 10, '#eef3ea', 6, 'bubble'); break;
    case 'conchBlow': k.burst(e.x, sy(st, e.y) - 30, '#d9b34a', 22, 'sparkle'); k.text(TEXT.grotto.burst.conch, 640, 200, true); break;
    case 'sleeperWake': k.burst(e.x, sy(st, e.y) - 20, '#d9b34a', 14, 'bubble'); k.burst(e.x, sy(st, e.y) - 20, '#d9b34a', 8, 'sparkle'); k.text(TEXT.grotto.burst.awake(e.n), e.x, sy(st, e.y) - 60); break;
    case 'pearl': k.burst(e.x, sy(st, e.y), '#eef3ea', 10, 'sparkle'); k.text('+50', e.x, sy(st, e.y) - 40); break;
    case 'hit': k.shake(0.35); k.burst(x, y, '#c8321e', 12, 'streak'); k.burst(x, y, '#eef3ea', 8, 'bubble'); break;
    case 'airOut': k.text(TEXT.grotto.burst.airOut, x, y - 80, true); break;
    case 'airLow': k.text(TEXT.grotto.burst.airLow, x, y - 80); break;
    case 'airVent': k.burst(x, y - 30, '#eef3ea', 16, 'bubble'); k.text(TEXT.grotto.burst.air, x, y - 80); break;
    case 'airFull': k.burst(x, y - 30, '#9fe0d0', 12, 'sparkle'); k.text(TEXT.grotto.burst.airFull, x, y - 80); break;
    case 'guitarCatch': k.burst(x, y, '#d9b34a', 26, 'sparkle'); k.text(words(TEXT.grotto.burst.guitar), x, y - 90, true); break;
    case 'witchOffer': k.burst(WITCH_X + WITCH_ROSE.x, sy(st, FLOOR) + 44 + WITCH_ROSE.y, '#f3c6dc', 16, 'sparkle'); break;
    // Taking the rose: the wand sparkles first, then the rose in her hand,
    // then him when it reaches his head (act2.js ROSE_CUES).
    case 'roseTake': k.burst(WITCH_X + WITCH_WAND.x, sy(st, FLOOR) + 44 + WITCH_WAND.y, '#fff2b0', 26, 'sparkle'); break;
    case 'roseFly': k.burst(WITCH_X + WITCH_ROSE.x, sy(st, FLOOR) + 44 + WITCH_ROSE.y, '#e0127a', 16, 'sparkle'); break;
    case 'roseArrive': { const h = sailorHead(st); k.flash(0.5); k.burst(h.x, h.y, '#e0127a', 18, 'sparkle'); k.burst(h.x, h.y, '#fff2b0', 10, 'sparkle'); break; }
    case 'sleepersRise': k.text(TEXT.grotto.burst.sleepersRise, 640, 220, true); break;
    case 'witchLaugh': k.shake(0.25); k.text(TEXT.grotto.burst.witchLaugh, 640, 220); break;
    case 'drown': k.burst(x, y - 20, '#eef3ea', 20, 'bubble'); break;
    case 'rideStart': break;
    case 'ridePearl': k.burst(boatX(st) + 40, boatY(st) - 40, '#eef3ea', 10, 'sparkle'); k.text('+25', boatX(st) + 40, boatY(st) - 90); break;
    case 'rideRow': k.burst(boatX(st), boatY(st) + 10, '#eef3ea', 6, 'drop'); break;
    case 'rideLand': k.burst(boatX(st), rowY(st) + 10, '#eef3ea', 10, 'drop'); break;
    default: break;
  }
}

// ---------------------------------------------------------------- grotto
function grotto(k, st, t) {
  const c = k.c, ph = st.phase;
  backcloth(k, st, t);
  for (const [x, y, len] of KELP) if (onScreen(st, y, len)) kelp(k, x, sy(st, y), len, t);
  for (const f of FISH) if (onScreen(st, f[0], 80)) fishSchool(k, st, f, t);
  walls(k, st);
  for (const cr of CORAL) if (onScreen(st, cr[1], 300)) coralFlat(k, cr[0], sy(st, cr[1]), cr[2], cr[3]);
  if (onScreen(st, SHELF_Y, 120)) shelf(k, st, t);
  if (onScreen(st, FLOOR, 120)) floor(k, st);
  // the set dims as he sinks
  k.wash('#0b1518', 0.26 * (st.cam / CAM_MAX) ** 1.4);

  for (const v of st.vents) if (onScreen(st, v.y, TUNE.ventH + 60)) vent(k, st, v, t);
  for (const cl of st.clams) if (onScreen(st, cl.y)) clam(k, st, cl);
  for (const cn of st.conches) if (onScreen(st, cn.y)) conch(k, st, cn, t);
  if (FILM && onScreen(st, 470, 320)) octopus(k, st, t);
  for (const sl of st.sleepers) sleeper(k, st, sl, t);
  if (!st.guitar.held) guitarFree(k, st, t);
  for (const e of st.eels) if (onScreen(st, e.y)) eel(k, st, e, t);
  for (const j of st.jellies) { const p = jellyPos(j, st.hzT); if (onScreen(st, p.y, 220)) jelly(k, p.x, sy(st, p.y), t + j.p); }
  if (ph === 'open') openingDragon(k, st, t);
  else { const d = dragonPos(st.hzT); if (onScreen(st, d.y, 120)) dragon(k, d.x, sy(st, d.y), d.face, t); }

  if (ph === 'open') openingWitch(k, st, t);
  if (ph === 'offer' || ph === 'choice') closeWitch(k, st, t);
  if (ph === 'choice' && st.choice === 'take') roseRisers(k, st, t);
  aura(k, st, t);
  swimmer(k, st, t);
  for (const o of st.omens) omen(k, o.x, sy(st, o.y), t);
  captions(k, st, t);
  c.globalAlpha = 1;
}

// The tall backcloth, rolled up as he descends.
const DEPTH_COLS = [[0, '#2a4a5c'], [0.3, '#2f5552'], [0.55, '#3d6b66'], [0.8, '#1c3236'], [1, '#0b1518']];
function depthCol(f) {
  f = Math.round(clamp(f, 0, 1) * 48) / 48; // quantised: the print pass caches each colour
  for (let i = 1; i < DEPTH_COLS.length; i++) {
    if (f <= DEPTH_COLS[i][0]) {
      const [f0, a] = DEPTH_COLS[i - 1], [f1, b] = DEPTH_COLS[i];
      return mix(a, b, (f - f0) / (f1 - f0));
    }
  }
  return DEPTH_COLS[DEPTH_COLS.length - 1][1];
}
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, k));
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

function backcloth(k, st, t) {
  const c = k.c, bcY = (st.cam / CAM_MAX) * 1440; // stage px into the 2160-tall cloth
  if (k.assetCrop('grotto-backcloth', 0, bcY * 2, 2560, 1440, 0, 0, 1280, 720)) return;
  const g = c.createLinearGradient(0, 0, 0, 720);
  g.addColorStop(0, k.col(depthCol(bcY / 2160))); g.addColorStop(1, k.col(depthCol((bcY + 720) / 2160)));
  c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
  const Y = (by) => by - bcY;
  // light rays from the surface
  if (bcY < 760) {
    c.save(); c.globalAlpha = 0.16 * (1 - bcY / 760); c.fillStyle = k.col('#eef3ea');
    for (let i = 0; i < 5; i++) {
      const x = 260 + i * 190 + Math.sin(t * 0.35 + i) * 24;
      c.beginPath(); c.moveTo(x, Y(0)); c.lineTo(x + 56, Y(0)); c.lineTo(x + 170, Y(900)); c.lineTo(x + 40, Y(900)); c.fill();
    }
    c.restore();
  }
  // the sunken ship's timbers, far off: a hull's ribs and a leaning mast
  if (bcY < 760) {
    c.save(); c.globalAlpha = 0.55; c.strokeStyle = k.col('#1d3440'); c.lineWidth = 9; c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x = 800 + i * 44, h = 150 - Math.abs(i - 3) * 22;
      c.beginPath(); c.moveTo(x, Y(660)); c.quadraticCurveTo(x - 30, Y(660 - h * 0.6), x - 6, Y(660 - h)); c.stroke();
    }
    c.lineWidth = 7; c.beginPath(); c.moveTo(780, Y(662)); c.lineTo(1110, Y(662)); c.stroke();
    c.lineWidth = 10; c.beginPath(); c.moveTo(930, Y(660)); c.lineTo(1040, Y(330)); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.moveTo(1040, Y(330)); c.lineTo(1120, Y(560)); c.stroke();
    c.restore();
  }
  // rock arches and the distant palace
  if (bcY > 300 && bcY < 1700) {
    c.fillStyle = k.col('#9fc2b6'); c.globalAlpha = 0.35;
    const px = 640, base = Y(1320);
    c.beginPath(); c.moveTo(px - 140, base);
    for (const [dx, h] of [[-140, 70], [-110, 70], [-110, 130], [-90, 160], [-70, 130], [-40, 130], [-40, 200], [-20, 250], [0, 200], [0, 150], [40, 150], [40, 230], [60, 280], [80, 230], [80, 120], [110, 120], [110, 170], [125, 200], [140, 170], [140, 0]]) c.lineTo(px + dx, base - h);
    c.closePath(); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = k.col('#224241'); c.lineWidth = 46; c.lineCap = 'butt';
    c.beginPath(); c.arc(330, Y(1400), 230, Math.PI, TAU * 0.98); c.stroke();
    c.beginPath(); c.arc(960, Y(1250), 260, Math.PI * 1.02, TAU); c.stroke();
    c.fillStyle = k.col('#e8efe6');
    for (let i = 0; i < 9; i++) k.circle(140 + i * 120, Y(1400 + (i % 3) * 30), 5 + (i % 2) * 3);
  }
  // the cave floor: stalagmites and faint phosphorescent anemones
  if (bcY > 1100) {
    c.fillStyle = k.col('#0d1a1d');
    c.beginPath(); c.moveTo(0, 720);
    for (let x = 0; x <= 1280; x += 80) c.lineTo(x, Y(2160 - 120 - ((x * 37) % 140)));
    c.lineTo(1280, 720); c.closePath(); c.fill();
    for (let i = 0; i < 14; i++) {
      const x = 170 + i * 72, y = Y(1850 + ((i * 53) % 260));
      c.globalAlpha = 0.45 + 0.35 * Math.sin(t * 1.4 + i);
      c.fillStyle = k.col(i % 2 ? '#f3c6dc' : '#9fe0d0'); k.circle(x, y, 4 + (i % 3));
    }
    c.globalAlpha = 1;
  }
}

// The rock walls (wing flats) that frame the descent, with the eel holes.
const wallL = (wy) => 196 + 14 * Math.sin(wy * 0.011) + 8 * Math.sin(wy * 0.037 + 1);
const wallR = (wy) => 1084 - 14 * Math.sin(wy * 0.012 + 2) - 8 * Math.sin(wy * 0.031);
function walls(k, st) {
  const c = k.c;
  const wl = k.img('grotto-wing-left'), wr = k.img('grotto-wing-right');
  if (wl || wr) {
    const off = st.cam % 720;
    for (const y0 of [-off, 720 - off]) {
      if (wl) k.asset('grotto-wing-left', 160, y0 + 720, 320, 720);
      if (wr) k.asset('grotto-wing-right', 1120, y0 + 720, 320, 720);
    }
    if (wl && wr) return;
  }
  const rock = k.col(mix('#2f4341', '#0f1819', Math.round(clamp(st.cam / CAM_MAX, 0, 1) * 24) / 24 * 0.9));
  const y0 = Math.floor((st.cam - 40) / 36) * 36;
  for (const side of [-1, 1]) {
    if ((side < 0 && wl) || (side > 0 && wr)) continue;
    const edge = side < 0 ? wallL : wallR, outer = side < 0 ? 0 : 1280;
    c.fillStyle = rock;
    c.beginPath(); c.moveTo(outer, -10);
    for (let wy = y0; wy <= st.cam + 680; wy += 36) c.lineTo(edge(wy), sy(st, wy));
    c.lineTo(outer, 730); c.closePath(); c.fill();
    c.strokeStyle = k.col('#9cc2b6'); c.lineWidth = 4; c.globalAlpha = 0.7;
    c.beginPath();
    for (let wy = y0; wy <= st.cam + 680; wy += 36) c.lineTo(edge(wy) - side * 3, sy(st, wy));
    c.stroke(); c.globalAlpha = 1;
    // white coral and red sea fans along the edge
    for (let wy = Math.floor(st.cam / 260) * 260; wy < st.cam + 700; wy += 260) {
      const x = edge(wy) - side * 4, y = sy(st, wy + (side > 0 ? 130 : 0));
      c.fillStyle = k.col(side < 0 ? '#ecefe6' : '#c8321e');
      for (let i = 0; i < 3; i++) k.circle(x - side * (6 + i * 7), y - i * 9, 6 - i);
    }
  }
}

function shelf(k, st, t) {
  const c = k.c, y = sy(st, SHELF_Y);
  if (!k.asset('wreck-debris', 640, y + 14, 350, 150)) {
    // a broken length of gold-railed hull, a draped sail, a barrel
    c.fillStyle = k.col('#6b4024');
    c.beginPath(); c.moveTo(470, y + 10); c.lineTo(500, y - 70); c.lineTo(690, y - 92); c.lineTo(720, y - 40); c.lineTo(700, y + 10); c.fill();
    c.fillStyle = k.col('#d9b34a'); c.fillRect(498, y - 76, 192, 6);
    c.fillStyle = k.col('#c8321e'); c.fillRect(492, y - 40, 214, 6);
    c.fillStyle = k.col('#f1e3c8');
    c.beginPath(); c.moveTo(720, y + 10); c.quadraticCurveTo(740, y - 110, 800, y - 60); c.quadraticCurveTo(790, y - 20, 820, y + 10); c.fill();
    c.fillStyle = k.col('#7a4a26'); c.beginPath(); c.ellipse(560, y - 4, 26, 30, 0, 0, TAU); c.fill();
    c.fillStyle = k.col('#3a2112'); c.fillRect(534, y - 14, 52, 4); c.fillRect(534, y + 2, 52, 4);
  }
  // the shelf of the sea floor at the wreck site: a ragged rock ground row
  if (k.asset('grotto-shelf', 640, y + 90, 1000, 90)) return;
  c.fillStyle = k.col('#34413e');
  c.beginPath(); c.moveTo(150, y + 50);
  for (let x = 150; x <= 1130; x += 70) c.lineTo(x, y + 4 + Math.sin(x * 0.05) * 6);
  for (let x = 1130; x >= 150; x -= 40) c.lineTo(x, y + 30 + ((x * 31) % 26));
  c.closePath(); c.fill();
  c.fillStyle = k.col('#8a8a72'); c.globalAlpha = 0.5;
  for (let x = 150; x < 1130; x += 70) c.fillRect(x, y + 2 + Math.sin(x * 0.05) * 6, 70, 3);
  c.globalAlpha = 1;
}

function floor(k, st) {
  const c = k.c, y = sy(st, FLOOR);
  if (k.asset('grotto-floor', 640, y + 130, 1040, 130)) return;
  c.fillStyle = k.col('#1a2427');
  c.beginPath(); c.moveTo(140, 740);
  for (let x = 140; x <= 1140; x += 60) c.lineTo(x, y + Math.sin(x * 0.04) * 6);
  c.lineTo(1140, 740); c.closePath(); c.fill();
}

function ledge(k, st, x, wy, w = 140) {
  const c = k.c, y = sy(st, wy);
  const x0 = x < 460 ? wallL(wy) - 10 : x - w / 2, x1 = x > 820 ? wallR(wy) + 10 : x + w / 2;
  // the delivered ledge, stretched to the walkable run, its top edge on the ledge line
  const nearWall = x < 460 || x > 820;
  c.save();
  if (nearWall && x > 820) { c.translate(x0 + x1, 0); c.scale(-1, 1); }
  const cx = (x0 + x1) / 2;
  const drawn = k.asset(nearWall ? 'grotto-ledge-wall' : 'grotto-ledge', cx, y + 50, x1 - x0, 50);
  c.restore();
  if (drawn) return;
  c.fillStyle = k.col('#3d524f');
  c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y);
  c.quadraticCurveTo(x1 - 10, y + 26, (x0 + x1) / 2 + 20, y + 40);
  c.quadraticCurveTo(x0 + 20, y + 30, x0, y); c.fill();
  c.fillStyle = k.col('#8fb2a8'); c.globalAlpha = 0.6; c.fillRect(x0, y - 2, x1 - x0, 4); c.globalAlpha = 1;
}

function kelp(k, x, top, len, t) {
  const c = k.c;
  k.wire(x, 0, top);
  if (k.asset('kelp-hanging', x, top + len, 100, len)) return;
  c.fillStyle = k.col('#556b2f');
  c.beginPath(); c.moveTo(x - 9, top);
  for (let d = 0; d <= len; d += 30) c.lineTo(x - 9 + Math.sin(t * 1.1 + d * 0.02) * (d / 14), top + d);
  for (let d = len; d >= 0; d -= 30) c.lineTo(x + 9 + Math.sin(t * 1.1 + d * 0.02) * (d / 14) + Math.sin(d * 0.08) * 5, top + d);
  c.closePath(); c.fill();
  c.fillStyle = k.col('#d9b34a'); k.circle(x, top, 3);
}

function fishSchool(k, st, [wy, dir], t) {
  const c = k.c, span = 1500;
  const x = dir > 0 ? ((t * 55 + wy) % span) - 110 : 1390 - ((t * 55 + wy) % span), y = sy(st, wy) + Math.sin(t * 1.3 + wy) * 10;
  c.save(); c.translate(x, y); c.scale(dir, 1);
  // the delivered art paints its own stick; the brown stroke is only the stand-in's
  if (!k.asset('fish-school', 0, 50, 210, 100)) {
    c.restore(); c.save();
    c.strokeStyle = k.col('#6b4024'); c.lineWidth = 3; c.beginPath(); c.moveTo(x, y + 20); c.lineTo(x - dir * 20, 730); c.stroke();
    c.translate(x, y); c.scale(dir, 1);
    for (let i = 0; i < 7; i++) {
      const fx = -80 + i * 26, fy = Math.sin(i * 0.9) * 22;
      c.fillStyle = k.col(i % 2 ? '#c8321e' : '#d9b34a');
      c.beginPath(); c.ellipse(fx, fy, 12, 6, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(fx - 10, fy); c.lineTo(fx - 20, fy - 7); c.lineTo(fx - 20, fy + 7); c.fill();
    }
  }
  c.restore();
}

function coralFlat(k, x, y, kind, s) {
  const c = k.c;
  if (k.asset(kind === 'a' ? 'coral-flat-a' : 'coral-flat-b', x, y, 400 * s, 300 * s)) return;
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = k.col('#3d4a48');
  c.beginPath(); c.moveTo(-190, 0); c.quadraticCurveTo(-120, -60, 0, -50); c.quadraticCurveTo(120, -64, 190, 0); c.fill();
  if (kind === 'a') {
    c.strokeStyle = k.col('#ecefe6'); c.lineWidth = 7; c.lineCap = 'round';
    for (const bx of [-110, -20, 80]) {
      c.beginPath(); c.moveTo(bx, -40); c.lineTo(bx, -130); c.moveTo(bx, -80); c.lineTo(bx - 30, -120); c.moveTo(bx, -100); c.lineTo(bx + 28, -150); c.stroke();
    }
    c.fillStyle = k.col('#e7a6bd');
    for (const fx of [-60, 30, 140]) { c.beginPath(); c.moveTo(fx, -44); c.arc(fx, -44, 56, -Math.PI * 0.8, -Math.PI * 0.2); c.closePath(); c.fill(); }
    c.strokeStyle = k.col('#b5577a'); c.lineWidth = 2;
    for (const fx of [-60, 30, 140]) for (let a = -0.75; a <= -0.25; a += 0.1) { c.beginPath(); c.moveTo(fx, -44); c.lineTo(fx + Math.cos(a * Math.PI) * 54, -44 + Math.sin(a * Math.PI) * 54); c.stroke(); }
  } else {
    c.strokeStyle = k.col('#c8321e'); c.lineWidth = 16;
    c.beginPath(); c.arc(0, -40, 90, Math.PI, TAU); c.stroke();
    c.fillStyle = k.col('#e9a46a'); k.star(120, -40, 18);
    c.fillStyle = k.col('#f1e3c8'); k.circle(-130, -46, 12); k.circle(-100, -42, 8);
  }
  c.restore();
}

// ---------------------------------------------------------------- props
function vent(k, st, v, t) {
  const c = k.c, x = v.x, y = sy(st, v.y), H = TUNE.ventH;
  // the refill column, faintly lit so you can see where to hover
  c.save(); c.globalAlpha = 0.12 + (st.inVent ? 0.08 : 0); c.fillStyle = k.col('#eef3ea');
  c.beginPath(); c.moveTo(x - 16, y - 40); c.lineTo(x + 16, y - 40); c.lineTo(x + TUNE.ventW, y - H); c.lineTo(x - TUNE.ventW, y - H); c.fill();
  c.restore();
  c.fillStyle = k.col('#eef3ea'); c.strokeStyle = k.col('#eef3ea'); c.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const f = ((t * 0.55 + i / 12) % 1), by = y - 40 - f * (H - 30), bx = x + Math.sin(t * 3 + i * 1.7) * (8 + f * 26);
    c.globalAlpha = 0.75 * (1 - f * 0.6); k.circle(bx, by, 3 + (i % 3) * 2 + f * 3);
  }
  c.globalAlpha = 1;
  ledge(k, st, x, v.y + 4, 120);
  if (!k.asset('air-vent', x, y + 6, 80, 100)) {
    c.fillStyle = k.col('#2c2a2e');
    c.beginPath(); c.moveTo(x - 40, y + 4); c.lineTo(x - 14, y - 46); c.lineTo(x + 14, y - 46); c.lineTo(x + 40, y + 4); c.fill();
    c.fillStyle = k.col('#c8321e'); c.fillRect(x - 10, y - 48, 20, 6);
  }
}

function clam(k, st, cl) {
  const c = k.c, x = cl.x, y = sy(st, cl.y);
  ledge(k, st, x, cl.y, 150);
  const spent = clamSpent(cl) && cl.lastBeat !== Math.floor(st.beat);
  const open = clamIsOpen(cl, st.beat);
  const ph = beatPhase(st.beat);
  const o = open ? Math.min(1, ph / 0.1) * Math.min(1, (1 - ph) / 0.12) : 0;
  // What's inside: its first pearl, a regrown one (full, or growing while
  // open), or nothing (just emptied).
  const taken = cl.lastBeat === Math.floor(st.beat);
  const pearlK = taken ? 0 : clamRipe(cl) ? 1 : cl.got > 0 ? cl.grow : 0;
  if (o > 0.4 && pearlK < 1 && k.img('clam-open')) {
    if (!k.asset('clam-open-empty', x, y, 120, 100)) emptyClamStandin(k, x, y);
    if (pearlK > 0) growingPearl(k, x, y, pearlK);
    return;
  }
  if (k.asset(o > 0.4 ? 'clam-open' : 'clam-closed', x, y, 120, 100, spent ? SPENT : '')) return;
  const shell = spent ? '#7b7584' : '#cfc0dc', rib = spent ? '#5a5464' : '#8a7aa0';
  // inside and pearl
  if (o > 0) {
    c.fillStyle = k.col('#e9a2b8'); c.beginPath(); c.ellipse(x, y - 28, 50, 8 + o * 22, 0, Math.PI, TAU); c.fill();
    c.fillStyle = k.col('#f7f2fa'); k.circle(x, y - 34 - o * 6, 6 + o * 6);
    c.fillStyle = k.col('#ffffff'); k.circle(x - 3, y - 38 - o * 6, 3);
  }
  // lower shell
  c.fillStyle = k.col(shell);
  c.beginPath(); c.moveTo(x - 56, y - 26); c.quadraticCurveTo(x, y + 16, x + 56, y - 26); c.closePath(); c.fill();
  // upper shell, lifted on the beat
  c.save(); c.translate(x, y - 26 - o * 34);
  c.beginPath(); c.moveTo(-56, 0); c.quadraticCurveTo(0, -48 + o * 18, 56, 0); c.closePath(); c.fill();
  c.strokeStyle = k.col(rib); c.lineWidth = 2;
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(0, -2); c.lineTo(i * 22, -18 + Math.abs(i) * 6 + o * 6); c.stroke(); }
  c.restore();
}

// The pearl in clam-open sits at art (120, 117), radius 31, in a 240 x 200
// sprite drawn at 120 x 100: (x, y - 41), radius 15.5 on stage.
const CLAM_PEARL = { dy: -41, r: 15.5 };
// Until clam-open-empty is delivered: clam-open with its pearl patched out by
// a mirrored piece of the pink inside from just beside it.
function emptyClamStandin(k, x, y) {
  const c = k.c, { dy, r } = CLAM_PEARL;
  k.asset('clam-open', x, y, 120, 100);
  c.save(); c.beginPath(); c.ellipse(x, y + dy, r + 2, r + 1, 0, 0, Math.PI * 2); c.clip();
  c.translate(x, 0); c.scale(-1, 1); c.translate(-x, 0);
  k.assetCrop('clam-open', 27, 85, 62, 66, x - r - 2, y + dy - r - 2, 2 * r + 4, 2 * r + 4);
  c.restore();
}
// A regrowing pearl: from a seed to full size, resting on the lower lip.
function growingPearl(k, x, y, g) {
  const c = k.c, { dy, r } = CLAM_PEARL, rr = r * (0.25 + 0.75 * g), cy = y + dy + r - rr;
  if (!k.asset('pearl', x, cy + rr * 1.45, rr * 2.9, rr * 2.9)) {
    c.fillStyle = k.col('#f7f2fa'); k.circle(x, cy, rr);
    c.fillStyle = k.col('#ffffff'); k.circle(x - rr * 0.35, cy - rr * 0.35, rr * 0.3);
  }
}

function conch(k, st, cn, t) {
  const c = k.c, x = cn.x, y = sy(st, cn.y);
  if (cn.y > SHELF_Y + 50) ledge(k, st, x, cn.y, 130);
  if (!cn.used) {
    c.save(); c.globalAlpha = 0.25 + 0.15 * Math.sin(t * 4); c.fillStyle = k.col('#d9b34a');
    k.circle(x, y - 30, 46); c.restore();
  }
  if (k.asset('conch-horn', x, y, 80, 70, cn.used ? SPENT : '')) return;
  c.fillStyle = k.col(cn.used ? '#9a8a90' : '#f3c6dc');
  c.beginPath(); c.moveTo(x - 38, y - 18); c.quadraticCurveTo(x - 10, y - 62, x + 36, y - 34); c.lineTo(x + 30, y - 4); c.quadraticCurveTo(x - 10, y + 2, x - 38, y - 18); c.fill();
  c.fillStyle = k.col('#f1e3c8'); c.beginPath(); c.ellipse(x + 20, y - 20, 12, 16, 0.3, 0, TAU); c.fill();
  c.fillStyle = k.col(cn.used ? '#5a4a40' : '#d9b34a'); c.beginPath(); c.ellipse(x + 20, y - 20, 6, 9, 0.3, 0, TAU); c.fill();
  c.strokeStyle = k.col('#c27a96'); c.lineWidth = 2;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x - 24 + i * 12, y - 26, 8, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
}

// A drowned reveller, laid on its back, or rising once woken.
function sleeper(k, st, sl, t) {
  if (sl.state === 'rising' && sl.t > 5) return;
  const rise = sl.state === 'rising' ? sl.t : 0;
  // the man-at-arms carries the prince's shield and plume until his redraw
  // (F17) arrives, so another crewman wakes in his place
  const id = FILM && sl.id === 'reveller-lady' && !k.img('crew-manatarms-redo') ? 'reveller-yellow' : sl.id;
  // the film's crew sit up in their own sprites before they stand (F20)
  const sit = FILM && CREW_OF[id] && k.img(CREW_OF[id] + '-sit-up') ? CREW_OF[id] + '-sit-up' : null;
  const lift0 = sit ? 1.6 : 0.6;   // the float up starts once he stands
  const wy = sl.y - (rise > lift0 ? (rise - lift0) ** 1.4 * 120 : 0);
  if (!onScreen(st, wy, 200)) return;
  const c = k.c, x = sl.x, y = sy(st, wy);
  if (sl.y > SHELF_Y + 50 && !sl.floor) ledge(k, st, x, sl.y + 4, 170);
  if (sit && rise > 0) return wakeSitting(k, st, sl, id, sit, x, y, rise, t);
  const up = easeInOut(rise / 0.8);       // 0 lying .. 1 upright
  // The film edition's crew lie asleep on the floor as themselves (asleepAs),
  // alternately mirrored, and stand as they wake.
  if (FILM && up < 0.5 && k.img('crew-asleep')) {
    asleepAs(k, st, sl, id, x, y, 1 - up * 2);
    if (up > 0) { c.save(); c.globalAlpha = up * 2; } else return asleepBubbles(k, sl, x, y, t);
  } else c.save();
  c.translate(x + 62 * (1 - up), y - 14 * (1 - up) + Math.sin(t * 1.5 + x) * 3 * up);
  c.rotate(-Math.PI / 2 * (1 - up) + Math.sin(t * 2 + x) * 0.08 * up);
  if (rise > 3.5) c.globalAlpha = clamp(1 - (rise - 3.5) / 1.5, 0, 1);
  if (!k.asset(id, 0, 0, 70, 135)) figure(k, 0, 0, REV_COLS[sl.kind], 0.62);
  c.restore();
  c.globalAlpha = 1;
  asleepBubbles(k, sl, x, y, t);
}

// A sleeper on the cave floor, as himself: his own lying sprite (F21) at his
// standing scale, or until it comes the nearer of the two generic ones (the
// squire's for the squire and the bosun, the man-at-arms' for him and the
// helmsman), which the loader draws at the crew's size (POSE_FIT).
// The art rows below a lying figure's lower back, in the look drawn: the
// hips rest on the ground and the figure drapes over it, head, feet and props
// lower (design/sprite-audit.md, REST_GAP).
const restGap = (k, id) => { const im = k.img(id); return (im && REST_GAP[id + (/-tinted\./.test(im.src || '') ? '-tinted' : '')]) || 0; };
// How far a sleeper settles into what they lie on, so they lie in it rather
// than on its outline: the shelf's painted top is ~10 px below the sleepers'
// line, and a ledge's leafy edge (drawn 4 px below it) is thin at the top.
const sink = (sl) => (!FILM || sl.floor ? 0 : sl.y < SHELF_Y + 50 ? 10 : 5);
function asleepAs(k, st, sl, id, x, y, alpha) {
  const c = k.c, crew = CREW_OF[id], face = st.sleepers.indexOf(sl) % 2 ? -1 : 1;
  y += sink(sl);
  if (crew && drawPose(k, crew + '-asleep', x, y + 2 + restGap(k, crew + '-asleep') * 135 / 420, 135, { std: 420, face, alpha })) return;
  const lie = (crew === 'crew-manatarms' || crew === 'crew-helmsman') && k.img('crew-asleep-b') ? 'crew-asleep-b' : 'crew-asleep';
  c.save(); c.translate(x - 5, y + 2 + restGap(k, lie) * 65 / 120); if (face < 0) c.scale(-1, 1); c.globalAlpha *= alpha;
  k.asset(lie, 0, 0, 140, 65);
  c.restore();
}

// Waking in the film: from his lying-down cut-out he sits up (his own
// sprite), holds a moment, then stands and floats up (the standing figure is
// 135 tall; the crew's sprites are 420 px to a standing figure).
function wakeSitting(k, st, sl, id, sit, x, y, rise, t) {
  const c = k.c, n = st.sleepers.indexOf(sl), face = n % 2 ? -1 : 1;
  const a = clamp(rise / 0.4, 0, 1), b = clamp((rise - 1.1) / 0.4, 0, 1);
  if (a < 1) asleepAs(k, st, sl, id, x, y, 1 - a);
  if (b < 1) drawPose(k, sit, x, y + 2 + sink(sl), 135, { std: 420, face, alpha: a * (1 - b) });
  if (b > 0) {
    c.save(); c.globalAlpha = b * (rise > 3.5 ? clamp(1 - (rise - 3.5) / 1.5, 0, 1) : 1);
    c.translate(x, y + Math.sin(t * 1.5 + x) * 3 * b); c.rotate(Math.sin(t * 2 + x) * 0.08 * b); if (face < 0) c.scale(-1, 1);
    if (!k.asset(id, 0, 0, 70, 135)) figure(k, 0, 0, REV_COLS[sl.kind], 0.62);
    c.restore();
  }
}

function asleepBubbles(k, sl, x, y, t) {
  if (sl.state !== 'asleep') return;
  const c = k.c;
  // bubbles rise from the sleepers, and a lazy "z"
  c.fillStyle = k.col('#eef3ea');
  for (let i = 0; i < 3; i++) {
    const f = (t * 0.4 + i / 3 + x * 0.001) % 1;
    c.globalAlpha = 0.6 * (1 - f); k.circle(x - 10 + Math.sin(t * 2 + i) * 6, y - 30 - f * 80, 2 + i);
  }
  c.globalAlpha = 0.7; c.fillStyle = k.col('#f1e3c8'); c.font = 'italic 700 18px "Josefin Sans", sans-serif'; c.textAlign = 'center';
  c.fillText('z', x + 20, y - 36 - ((t * 12 + x) % 18)); c.globalAlpha = 1;
}

// A stand-in cut-out person: hat, head, coat, bottom-centre at (x, y).
function figure(k, x, y, col, s = 1) {
  const c = k.c;
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = k.col(col);
  c.beginPath(); c.moveTo(-24, 0); c.lineTo(-17, -96); c.lineTo(17, -96); c.lineTo(24, 0); c.fill();
  c.fillRect(-36, -88, 72, 10);
  c.fillStyle = k.col('#efd7c4'); k.circle(0, -112, 14);
  c.fillStyle = k.col('#2a1a22'); c.fillRect(-16, -132, 32, 8);
  c.restore();
}

function guitarFree(k, st, t) {
  const g = st.guitar, wy = g.y;
  if (!onScreen(st, wy, 200)) return;
  const c = k.c, x = g.x + (g.settled ? 0 : Math.sin(t * 0.8) * 24), y = sy(st, wy);
  c.save(); c.translate(x, y);
  c.rotate(g.settled ? 1.3 : 0.6 + Math.sin(t * 0.7) * 0.25);
  if (!k.asset('guitar-sinking', 0, 98, 82, 195)) guitarStandin(k, 0.75);
  c.restore();
  if (!g.settled) {
    c.fillStyle = k.col('#eef3ea');
    for (let i = 0; i < 6; i++) { const f = (t * 0.7 + i / 6) % 1; c.globalAlpha = 0.6 * (1 - f); k.circle(x - 20 + i * 8, y - 30 - f * 120, 2 + (i % 3)); }
    c.globalAlpha = 1;
  }
}

function guitarStandin(k, s) {
  const c = k.c;
  c.save(); c.scale(s, s);
  c.fillStyle = k.col('#5a3a1e'); c.fillRect(-7, -140, 14, 110);
  c.fillStyle = k.col('#3a2112'); c.fillRect(-11, -158, 22, 20);
  c.fillStyle = k.col('#e8d3a0'); k.circle(0, -10, 38); k.circle(0, 50, 46);
  c.fillStyle = k.col('#2a1a12'); k.circle(0, 4, 13);
  c.strokeStyle = k.col('#cfcfcf'); c.lineWidth = 1;
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 3, -150); c.lineTo(i * 3, 80); c.stroke(); }
  c.restore();
}

// ---------------------------------------------------------------- hazards
function eel(k, st, e, t) {
  const c = k.c, x = e.x, y = sy(st, e.y), side = e.side;
  const hx = x - side * 6; // the hole sits in the wall's edge
  // hole and eyes
  const holeArt = k.asset('eel-hole', hx, y + 30, 80, 60);
  if (!holeArt) {
    c.fillStyle = k.col('#2e4644'); c.beginPath(); c.ellipse(hx, y, 40, 30, 0, 0, TAU); c.fill();
    c.fillStyle = k.col('#070b0c'); c.beginPath(); c.ellipse(hx, y, 28, 20, 0, 0, TAU); c.fill();
  }
  const glow = e.state === 'glow' ? 0.55 + 0.45 * Math.sin(e.t * 22) : e.state === 'lunge' || e.state === 'hold' ? 1 : 0.18;
  if (e.state === 'glow' && !holeArt) { c.save(); c.globalAlpha = 0.3 * glow; c.fillStyle = k.col('#ffe27a'); k.circle(hx, y, 40); c.restore(); }
  if (e.state === 'glow' && holeArt) { c.save(); c.globalAlpha = 0.22 * glow; c.fillStyle = k.col('#ffe27a'); k.circle(hx, y, 26); c.restore(); }
  c.globalAlpha = glow; c.fillStyle = k.col('#ffe27a');
  if (holeArt) { // glow on the painted eyes (hx - 4, hx + 4.5 at y)
    c.globalAlpha = 0.55 * glow; k.circle(hx - 4, y, 4.5); k.circle(hx + 4.5, y, 4.5);
  } else { k.circle(hx - 7, y - 3, 4); k.circle(hx + 7, y - 3, 4); }
  c.globalAlpha = 1;
  const ext = eelExt(e);
  if (ext <= 0) return;
  const L = TUNE.eelReach * ext;
  c.save(); c.beginPath(); c.rect(side > 0 ? hx : hx - 400, y - 60, 400, 120); c.clip();
  c.translate(hx + side * L, y); c.scale(side, 1); // head at the origin, facing +x
  if (!k.asset('eel', -86, 57, 427, 115)) { // painted jaws end at the head (the art is 70% eel, head on the right; drawn at its own proportions)
    c.strokeStyle = k.col('#5d7a34'); c.lineWidth = 24; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-L - 20, 0);
    for (let d = -L; d <= -20; d += 20) c.lineTo(d, Math.sin(d * 0.05 + t * 10) * 7);
    c.stroke();
    c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 5;
    c.beginPath(); c.moveTo(-L, 8);
    for (let d = -L; d <= -20; d += 20) c.lineTo(d, 8 + Math.sin(d * 0.05 + t * 10) * 7);
    c.stroke();
    c.fillStyle = k.col('#5d7a34');
    c.beginPath(); c.moveTo(-30, -14); c.lineTo(22, -16); c.lineTo(-6, -2); c.lineTo(22, 14); c.lineTo(-30, 14); c.fill();
    c.fillStyle = k.col('#ffe27a'); k.circle(-8, -8, 3.5);
    c.fillStyle = k.col('#f1e3c8'); for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(4 + i * 6, -10 + i * 2); c.lineTo(7 + i * 6, -4); c.lineTo(10 + i * 6, -10 + i * 2); c.fill(); }
  }
  c.restore();
}

function jelly(k, x, y, t) {
  const c = k.c, top = y - 30;
  k.wire(x, 0, top);
  if (k.anim?.('anim-jellyfish', t, x, top + 140, 90, 140) || k.asset('jellyfish', x, top + 140, 90, 140)) return;
  c.strokeStyle = k.col('#e0127a'); c.lineWidth = 4; c.lineCap = 'round'; c.globalAlpha = 0.8;
  for (let i = 0; i < 4; i++) {
    const tx = x - 21 + i * 14;
    c.beginPath(); c.moveTo(tx, y);
    for (let d = 10; d <= 84; d += 12) c.lineTo(tx + Math.sin(t * 3 + d * 0.08 + i) * 7, y + d);
    c.stroke();
  }
  c.globalAlpha = 1;
  const pulse = 1 + Math.sin(t * 3) * 0.06;
  c.fillStyle = k.col('#f3c6dc');
  c.beginPath(); c.ellipse(x, y, 36 * pulse, 30 / pulse, 0, Math.PI, TAU); c.fill();
  for (let i = 0; i < 6; i++) k.circle(x - 30 + i * 12, y, 7);
  c.fillStyle = k.col('#e7a6bd'); c.beginPath(); c.ellipse(x, y - 10, 18, 10, 0, Math.PI, TAU); c.fill();
}

function dragon(k, x, y, face, t) {
  const c = k.c;
  c.save(); c.translate(x, y); c.scale(-face, 1); // the art faces left
  if (!k.asset('sea-dragon', 0, 48, 240, 96)) {
    const sw = Math.sin(t * 5) * 8;
    c.fillStyle = k.col('#c8321e');
    c.beginPath(); c.moveTo(-110, -6);
    c.quadraticCurveTo(-60, -34 + sw, 0, -14); c.quadraticCurveTo(60, 6 - sw, 120, -14);
    c.lineTo(110, 4); c.quadraticCurveTo(60, 28 - sw, 0, 12); c.quadraticCurveTo(-60, -6 + sw, -100, 14); c.closePath(); c.fill();
    for (let i = 0; i < 7; i++) { const sx = -70 + i * 26, syy = -18 + Math.sin(sx * 0.03) * 10; c.beginPath(); c.moveTo(sx - 7, syy); c.lineTo(sx, syy - 18); c.lineTo(sx + 7, syy); c.fill(); }
    c.beginPath(); c.ellipse(-112, 2, 22, 14, -0.2, 0, TAU); c.fill();
    c.fillStyle = k.col('#d9b34a'); k.circle(-118, -3, 4);
  }
  c.restore();
}

// Early warnings use the renderer's particle shimmer, with no badge fallback.
function omen(k, x, y, t) {
  k.omen?.(x, y + Math.sin(t * 6) * 3, 1);
}

// ---------------------------------------------------------------- the sailor
function swimmer(k, st, t) {
  const s = st.sailor, c = k.c, x = s.x, y = sy(st, s.y), ph = st.phase;
  if (ph === 'open') {
    // lying on his back until the witch's breath turns him over, like a card
    const w = easeInOut(s.wake);
    // the film's prince lies on his back (his own sprite) for the first half
    // of the turn, then rolls face down into his swim
    if (FILM && w < 0.5 && k.img('prince-lying-back')) lyingBack(k, x, y - w * 10, 1, 0, Math.abs(lerp(-1, 1, w)));
    else sailorFigure(k, x, y - w * 10, 1, 0, lerp(-1, 1, w), t);
    if (w > 0) harness(k, x, y - w * 10, 0, t, 1 - w, 1, 0, lerp(-1, 1, w));
    return;
  }
  const flick = s.grace > 0 && Math.floor(s.grace * 10) % 2 === 0;
  const drown = ph === 'drown';
  if (flick && !drown) c.globalAlpha = 0.45;
  const rot = drown ? Math.min(1.2, st.phaseT) * s.face * 0.8 : clamp(s.vy / 900, -0.25, 0.25) * s.face;
  harness(k, x, y, drown ? -0.5 : s.vy, t, 0, s.face, rot, 1);
  c.save(); c.translate(x, y);
  if (drown) c.rotate(Math.min(1.2, st.phaseT) * s.face * 0.8);
  else c.rotate(clamp(s.vy / 900, -0.25, 0.25) * s.face);
  c.translate(-x, -y);
  if (drown && FILM && k.img('prince-lying-back')) { c.restore(); lyingBack(k, x, y, s.face, Math.min(1.2, st.phaseT) * s.face * 0.35, 1); c.save(); }
  else sailorFigure(k, x, y, s.face, s.stroke, drown ? -1 : 1, t);
  if (st.guitar.held) {
    c.save(); c.translate(x + s.face * 30, y + 18); c.rotate(s.face * 1.2);
    if (!k.asset('keepsake-guitar', 0, 32, 64, 64)) guitarStandin(k, 0.42);
    c.restore();
  }
  c.restore();
  c.globalAlpha = 1;
  // bubbles from his beard, and the air warning
  c.fillStyle = k.col('#eef3ea');
  // painted mouth of the swim art (+80, -14 from the figure origin in both strokes), turned with his tilt
  const mArt = k.img('sailor-swim-a') ? [80, -14] : [60, -20], mc = Math.cos(rot), ms = Math.sin(rot);
  const mox = s.face * mArt[0], moy = mArt[1] * (drown ? -1 : 1);
  const mx = x + mox * mc - moy * ms, my = y + mox * ms + moy * mc;
  for (let i = 0; i < 3; i++) { const f = (t * 0.9 + i / 3) % 1; c.globalAlpha = 0.6 * (1 - f); k.circle(mx + Math.sin(t * 3 + i) * 5, my - f * 70, 2 + i); }
  c.globalAlpha = 1;
  if (st.air < 0.25 && (ph === 'swim') && Math.floor(t * 3) % 2 === 0) {
    c.font = '700 20px "Josefin Sans", sans-serif'; c.textAlign = 'center';
    c.fillStyle = k.col('#2a1424'); c.fillText(TEXT.grotto.airWarning, x + 2, y - 72);
    c.fillStyle = k.col('#eef3ea'); c.fillText(TEXT.grotto.airWarning, x, y - 74);
  }
}

// The flying wires to the harness ring; they go slack as he swims up.
function harness(k, x, y, vy, t, fade, face = 1, rot = 0, flipY = 1) {
  const c = k.c, slack = clamp(-vy / 160, 0, 1);
  // the swim art paints its own gold ring on his back (at +43, -28 in both
  // strokes, once A is matched to B); the wires attach to it, in the rotated
  // frame. The stand-in keeps its own ring.
  const art = !!k.img('sailor-swim-a');
  const ox = art ? face * 43 : 0, oy = (art ? -28 : -24) * flipY;
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const rx = x + ox * cs - oy * sn, ry = y + ox * sn + oy * cs;
  c.save(); c.globalAlpha = 1 - fade;
  c.strokeStyle = k.col('#1c1c1c'); c.lineWidth = 1.2;
  for (const dx of [-14, 14]) {
    const sway = Math.sin(t * 2.6 + dx) * 26 * slack;
    c.beginPath(); c.moveTo(rx + dx * 1.6, 0);
    c.quadraticCurveTo(rx + dx + sway + dx * slack, ry * 0.6, rx + dx * 0.3, ry - (art ? 6 : 0)); c.stroke();
  }
  if (!art) {
    c.fillStyle = k.col('#d9b34a'); c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 2;
    c.beginPath(); c.arc(rx, ry, 5, 0, TAU); c.stroke();
  }
  c.restore();
}

// The prince lying senseless on his back, centred on (x, y) where his swimming
// figure would be (the swim art is drawn 180 tall for a standing figure), his
// head the way he faces; `squash` flattens it like a turning card.
function lyingBack(k, x, y, face, rot, squash) {
  const c = k.c;
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, squash || 0.001);
  drawPose(k, 'prince-lying-back', 0, 50, 180, { face: -face });
  c.restore();
}

// Stand-in: the sailor swimming face down (flipY -1: lying on his back).
function sailorFigure(k, x, y, face, stroke, flipY, t) {
  const c = k.c;
  c.save(); c.translate(x, y); c.scale(face, flipY || 0.001);
  if (k.img('sailor-swim-a') && k.img('sailor-swim-b')) {
    // The two strokes are painted at different sizes: reaching forward (A) his
    // body is shorter than swept back (B). A is scaled and turned so its head
    // and boots land where B's are, and its arms reach further ahead.
    // (the sailor's strokes; the film prince's are evened by the sprite audit)
    if (!stroke && !FILM) { c.translate(-77.5, 11); c.rotate(0.13); c.scale(1.215, 1.215); c.translate(79, -16); }
    k.asset(stroke ? 'sailor-swim-b' : 'sailor-swim-a', 0, 60, 180, 120);
    c.restore(); return;
  }
  const kick = Math.sin(t * 7) * (stroke ? 0.35 : 0.15);
  // legs and boots
  c.fillStyle = k.col('#7d7f86');
  for (const [dy, a] of [[-6, kick], [6, -kick]]) {
    c.save(); c.translate(-32, dy); c.rotate(a);
    c.fillRect(-48, -6, 50, 12);
    c.fillStyle = k.col('#16161a'); c.fillRect(-60, -7, 16, 14); c.fillStyle = k.col('#7d7f86');
    c.restore();
  }
  // pea coat
  c.fillStyle = k.col(NAVY);
  c.beginPath(); c.ellipse(4, 0, 42, 20, 0, 0, TAU); c.fill();
  c.fillStyle = k.col('#d9b34a'); k.circle(10, 10, 2.5); k.circle(24, 10, 2.5);
  // harness strap
  c.fillStyle = k.col('#6b4024'); c.fillRect(-6, -21, 10, 42);
  // arms: reaching forward (A) or swept back (B)
  c.fillStyle = k.col(NAVY);
  c.save(); c.translate(26, -4);
  if (stroke) { c.rotate(2.7); c.fillRect(0, -6, 46, 12); } else { c.rotate(-0.25); c.fillRect(0, -6, 58, 12); }
  c.fillStyle = k.col('#efd7c4'); k.circle(stroke ? 46 : 60, 0, 6);
  c.restore();
  // neckerchief, head, beard, cap
  c.fillStyle = k.col('#c8321e'); c.fillRect(40, -8, 10, 16);
  c.fillStyle = k.col('#efd7c4'); k.circle(60, -4, 13);
  c.fillStyle = k.col('#c9c6c0'); c.beginPath(); c.moveTo(52, 4); c.quadraticCurveTo(64, 26, 76, 2); c.closePath(); c.fill();
  c.fillStyle = k.col(NAVY); c.fillRect(48, -20, 26, 8); c.fillRect(70, -16, 8, 3);
  c.fillStyle = k.col('#16161a'); k.circle(66, -6, 1.8);
  c.restore();
}

function aura(k, st, t) {
  const s = st.sailor, held = st.guitar.held;
  if (!(st.hornT > 0 || held) || st.phase === 'drown' || st.phase === 'open') return;
  const c = k.c, x = s.x, y = sy(st, s.y);
  const fade = held ? 1 : Math.min(1, st.hornT / 2);
  const b = beatPhase(st.beat);
  c.save(); c.globalAlpha = (0.35 + 0.35 * (1 - b)) * fade;
  c.strokeStyle = k.col(held ? '#f1e3c8' : '#d9b34a'); c.lineWidth = 3; c.setLineDash([10, 12]);
  c.beginPath(); c.arc(x, y, TUNE.wakeR * (0.92 + 0.08 * (1 - b)), 0, TAU); c.stroke(); c.setLineDash([]);
  c.fillStyle = k.col(held ? '#f1e3c8' : '#d9b34a'); c.font = '700 26px serif'; c.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    const a = t * 0.9 + i * 2.1, r = TUNE.wakeR * 0.75;
    c.fillText('♪', x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7);
  }
  c.restore();
}

// ---------------------------------------------------------------- the witch
const WITCH_X = 1000;
function witchFigure(k, x, by, bend, rose, t, wandUp = 0) {
  const c = k.c;
  c.save(); c.translate(x, by); c.rotate(bend);
  if (k.idle('witch-stand', t, 0, 0, 150, 242, 0.5)) { c.restore(); return; }
  // pink robes
  c.fillStyle = k.col('#f3c6dc');
  c.beginPath(); c.moveTo(-50, 0); c.quadraticCurveTo(-34, -120, -16, -176); c.lineTo(16, -176); c.quadraticCurveTo(40, -110, 56, 0);
  c.quadraticCurveTo(0, 10, -50, 0); c.fill();
  c.fillStyle = k.col('#e7a6bd'); c.beginPath(); c.moveTo(-10, -170); c.lineTo(8, -170); c.lineTo(20, 0); c.lineTo(-24, 0); c.fill();
  // long black hair, face, gold crown
  c.fillStyle = k.col('#16161a');
  c.beginPath(); c.moveTo(-18, -196); c.quadraticCurveTo(0, -222, 20, -198); c.quadraticCurveTo(28, -150, 22, -120); c.lineTo(4, -150); c.quadraticCurveTo(-4, -180, -18, -196); c.fill();
  c.fillStyle = k.col('#efd7c4'); k.circle(-2, -194, 14);
  c.fillStyle = k.col('#d9b34a');
  c.beginPath(); c.moveTo(-14, -206); c.lineTo(-12, -222); c.lineTo(-6, -212); c.lineTo(0, -226); c.lineTo(6, -212); c.lineTo(12, -222); c.lineTo(14, -206); c.fill();
  // the arm holding out the rose, and the wand
  c.fillStyle = k.col('#f3c6dc'); c.save(); c.translate(-14, -150); c.rotate(0.35); c.fillRect(-52, -6, 54, 12); c.restore();
  if (rose) k.keepsake('rose', -64, -132, 0.6);
  c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 3;
  const wa = lerp(0.5, -0.9, wandUp);
  const wx = 24 + Math.sin(wa) * 62, wy = -120 - Math.cos(wa) * 62;
  c.beginPath(); c.moveTo(20, -120); c.lineTo(wx, wy); c.stroke();
  c.fillStyle = k.col('#fff2b0'); k.star(wx, wy, 9 + Math.sin(t * 8) * 2);
  c.restore();
}

// His head on screen (the swim art's head is at +74, -22 from his centre).
function sailorHead(st) {
  const s = st.sailor;
  return { x: s.x + s.face * 74, y: sy(st, s.y) - 22 };
}

// Points on the delivered witch-stand art, drawn 150x242 from her feet: the
// rose in her raised hand, the star of her wand and her lips.
const WITCH_ROSE = { x: -63, y: -209 }, WITCH_WAND = { x: 31, y: -166 }, WITCH_LIPS = { x: -18, y: -218 };
const rot = (p, a) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });

// The opening: she sinks down in front of the wreck shelf and stands on the
// sea floor below it, so her face comes up beside the drowned sailor's; she
// leans in and breathes a stream of bubbles into him; as he turns upright,
// bubbles well up around him and carry her away.
const SEA_FLOOR = 646;   // screen y of the rocky floor in front of the shelf (opening view)
function openingWitch(k, st, t) {
  const pt = st.phaseT, c = k.c, s = st.sailor;
  const down = easeOut((pt - 2.2) / 1.1), up = easeInOut((pt - 4.9) / 1.5);
  if (down <= 0 || up >= 1) return;
  const face = { x: s.x + 60, y: sy(st, s.y) - 6 };         // his face, lying on his back
  const lean = -0.1 * easeInOut((pt - 3.2) / 0.5) * (1 - up);
  const lips = rot(WITCH_LIPS, -0.1);
  const x = face.x + 60 - lips.x;                            // her lips beside his face
  const by = lerp(-80, SEA_FLOOR, down) - up * 760;
  k.wire(x - 20, 0, by - 230); k.wire(x + 20, 0, by - 230);
  witchFigure(k, x, by, lean, false, t);
  // her breath: a stream of bubbles from her lips to his
  if (pt > 3.5 && pt < 5.1) {
    const from = rot(WITCH_LIPS, lean);
    c.strokeStyle = k.col('#fff2c0'); c.lineWidth = 2; c.fillStyle = k.col('#ffe9a8');
    for (let i = 0; i < 9; i++) {
      const f = (pt * 1.1 + i / 9) % 1, r = 5 + (i % 3) * 2;
      c.globalAlpha = 0.85 * Math.sin(Math.PI * f);
      const bx = lerp(x + from.x - 6, face.x + 8, f), byy = lerp(by + from.y + 4, face.y - 4, f) + Math.sin(f * 9 + i) * 7;
      c.beginPath(); c.arc(bx, byy, r, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(bx - r * 0.35, byy - r * 0.35, r * 0.25, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }
  // as he turns upright: bubbles well up around him and lift her away
  if (pt > 4.85) risingBubbles(k, [face.x - 70, face.x + 40, x - 30, x + 30], face.y + 30, pt - 4.85, t);
}

// A column of bubbles rising from y0 across the x spans given (pairs), for
// `age` seconds; drawn from time, so both passes match.
function risingBubbles(k, spans, y0, age, t) {
  const c = k.c;
  c.save(); c.strokeStyle = k.col('#eef3ea'); c.fillStyle = k.col('#eef3ea'); c.lineWidth = 1.6;
  for (let i = 0; i < 26; i++) {
    const span = (i % (spans.length / 2)) * 2, a = spans[span], b = spans[span + 1];
    const born = (i * 0.061) % 1.1, life = age - born;
    if (life <= 0 || life > 1.6) continue;
    const bx = a + ((i * 37) % 100) / 100 * (b - a) + Math.sin(t * 5 + i) * 8;
    const byy = y0 - life * (150 + (i % 5) * 30), r = 3 + (i % 4) * 2 + life * 2;
    c.globalAlpha = 0.8 * (1 - life / 1.6);
    c.beginPath(); c.arc(bx, byy, r, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(bx - r * 0.35, byy - r * 0.35, r * 0.25, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

// The film's great octopus (tableau 16), beside the wreck where the Water
// Fairy revives the voyagers, its arms swaying slowly.
function octopus(k, st, t) {
  const c = k.c;
  c.save(); c.translate(150, sy(st, 470)); c.rotate(Math.sin(t * 0.7) * 0.03); c.scale(1, 1 + 0.02 * Math.sin(t * 1.3));
  k.asset('octopus', 0, 0, 250, 175);
  c.restore();
}

function openingDragon(k, st, t) {
  const pt = st.phaseT;
  const f = (pt - 0.5) / 3.6;
  if (f <= 0 || f >= 1) return;
  dragon(k, lerp(1360, -120, f), sy(st, 250) + Math.sin(f * 7) * 20, -1, t);
}

function closeWitch(k, st, t) {
  // her hem on the dark cave floor, in front of the coral ground row
  const pt = st.phaseT, c = k.c, by = sy(st, FLOOR) + 44;
  let y = by, rose = true, wand = 0;
  if (st.phase === 'offer') y = lerp(-60, by, easeOut(pt / 1.4));
  else if (st.choice === 'take') { rose = pt < ROSE_CUES.fly; wand = easeInOut(pt / 0.3) * (1 - easeInOut((pt - ROSE_CUES.fly + 0.2) / 0.3)); }
  else { rose = true; y = by - easeInOut((pt - 1.4) / 1.6) * 760; }
  k.wire(WITCH_X - 20, 0, y - 236); k.wire(WITCH_X + 20, 0, y - 236);
  const laugh = st.phase === 'choice' && st.choice === 'refuse' ? Math.sin(pt * 26) * 0.05 * (pt < 1.4 ? 1 : 0) : 0;
  witchFigure(k, WITCH_X, y, laugh, rose, t, wand);
  const taking = st.phase === 'choice' && st.choice === 'take';
  // first the wand glows: the spell begins (and only then)
  if (taking && pt < ROSE_CUES.fly) {
    c.save(); c.globalAlpha = 0.3 * Math.sin(Math.PI * pt / ROSE_CUES.fly); c.fillStyle = k.col('#ffe27a');
    k.circle(WITCH_X + WITCH_WAND.x, y + WITCH_WAND.y, 80); c.restore();
  }
  // then the rose flies from her hand straight to his head
  if (taking && pt >= ROSE_CUES.fly && pt < ROSE_CUES.arrive) {
    const h = sailorHead(st), f = easeInOut((pt - ROSE_CUES.fly) / (ROSE_CUES.arrive - ROSE_CUES.fly));
    k.keepsake('rose', lerp(WITCH_X + WITCH_ROSE.x, h.x, f), lerp(y + WITCH_ROSE.y, h.y, f) - Math.sin(Math.PI * f) * 40, 0.6);
  }
}

function roseRisers(k, st, t) {
  const pt = st.phaseT - ROSE_CUES.wake, c = k.c;
  if (pt <= 0) return;
  for (let i = 0; i < st.roseRisers; i++) {
    const f = (pt - i * 0.1) / 2.0;
    if (f <= 0 || f >= 1) continue;
    const x = 230 + ((i * 197) % 820), y = 760 - f * 860;
    c.save(); c.translate(x, y); c.rotate(Math.sin(t * 2 + i) * 0.1);
    c.globalAlpha = Math.min(1, (1 - f) * 3);
    if (!k.asset(['reveller-yellow', 'reveller-shaggy', 'reveller-jester', 'reveller-lady'][i % 4], 0, 0, 70, 135)) figure(k, 0, 0, REV_COLS[i % 4], 0.62);
    c.restore();
  }
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------- captions
function panel(k, x, y, w, h) {
  const c = k.c;
  c.save(); c.globalAlpha = 0.9; c.fillStyle = k.col('#2a1424');
  c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 10); c.fill(); c.restore();
  c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 1.5;
  c.beginPath(); c.roundRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, h - 10, 7); c.stroke();
}
function label(k, str, x, y, size = 20, colr = '#f1e3c8') {
  const c = k.c;
  if (k.compact && k.inputMode === 'touch') size = Math.round(size * 1.5);   // readable on a phone
  c.font = `700 ${size}px "Josefin Sans", sans-serif`; c.textAlign = 'center';
  c.fillStyle = k.col('#2a1424'); richText(c, str, x + 2, y + 2, { px: size, mode: k.inputMode || 'key', col: k.col });
  c.fillStyle = k.col(colr); richText(c, str, x, y, { px: size, mode: k.inputMode || 'key', col: k.col });
}

function captions(k, st, t) {
  const c = k.c, ph = st.phase, pt = st.phaseT;
  // breathing in a vent: bubbles stream up around him while the air fills
  if (ph === 'swim' && st.inVent && st.air < 1) {
    const s = st.sailor, x = s.x, y = sy(st, s.y);
    c.save(); c.fillStyle = k.col('#eef3ea');
    for (let i = 0; i < 9; i++) {
      const f = (t * 0.9 + i / 9) % 1;
      c.globalAlpha = 0.7 * (1 - f); k.circle(x - 50 + ((i * 37) % 100) + Math.sin(t * 3 + i) * 6, y + 20 - f * 150, 3 + (i % 3) * 2);
    }
    c.restore();
    label(k, TEXT.grotto.breathing, x, y - 96, 18, '#9fe0d0');
  }
  // X takes what is within reach (film edition)
  // On touch a tap does it (anywhere, or on the sleeper or pearl itself), so
  // the prompt says so once, the first time each is in reach, larger on a
  // phone-sized screen; with keys or a pad it names the button each time.
  const touch = k.inputMode === 'touch';
  const since = st.reach && st.firstReach?.[st.reach.kind] != null ? (st.t ?? 0) - st.firstReach[st.reach.kind] : 0;
  if (ph === 'swim' && st.reach && (!touch || since < 3.5)) {
    const r = st.reach, y = sy(st, r.y);
    const str = touch ? (r.kind === 'pearl' ? TEXT.grotto.reach.tapPearl : TEXT.grotto.reach.tapWake) : r.kind === 'pearl' ? TEXT.grotto.reach.takePearl : TEXT.grotto.reach.wake;
    const px = touch && k.compact ? 30 : 18, hh = px + 14;
    c.save(); c.font = `700 ${px}px "Josefin Sans", sans-serif`; c.textAlign = 'center';
    if (touch) c.globalAlpha = clamp((3.5 - since) / 0.5, 0, 1);
    const fade = c.globalAlpha;
    c.fillStyle = k.col('#2a1424'); c.globalAlpha = 0.8 * fade; const w = measureRichText(c, str, { px, mode: k.inputMode || 'key' }) + 44;
    const lx = clamp(r.x, 180 + w / 2, 1100 - w / 2);
    c.beginPath(); c.roundRect(lx - w / 2, y - hh * 0.7, w, hh, hh / 2); c.fill(); c.globalAlpha = fade;
    c.fillStyle = k.col('#ffe27a'); richText(c, str, lx, y, { px, mode: k.inputMode || 'key', col: k.col });
    c.restore();
  }
  // After "Follow the sword down": the two things worth saying (film); the
  // classic edition points out its first conch instead.
  if (FILM && ph === 'swim' && pt >= 2 && pt < 14) {
    const str = touch ? TEXT.grotto.dive.hintTouch : TEXT.grotto.dive.hint;
    const px = touch && k.compact ? 26 : 18, hh = px + 14;
    c.save(); c.font = `700 ${px}px "Josefin Sans", sans-serif`; c.textAlign = 'center';
    c.globalAlpha = clamp((14 - pt) / 0.6, 0, 1) * clamp((pt - 2) / 0.4, 0, 1);
    const fade = c.globalAlpha, w = measureRichText(c, str, { px, mode: k.inputMode || 'key' }) + 44;
    c.fillStyle = k.col('#2a1424'); c.globalAlpha = 0.8 * fade;
    c.beginPath(); c.roundRect(640 - w / 2, 250 - hh * 0.7, w, hh, hh / 2); c.fill(); c.globalAlpha = fade;
    c.fillStyle = k.col('#ffe27a'); richText(c, str, 640, 250, { px, mode: k.inputMode || 'key', col: k.col });
    c.restore();
  } else if (!FILM && ph === 'swim' && !st.conches[0].used && pt < 14 && onScreen(st, SHELF_Y)) {
    const cn = st.conches[0];
    label(k, TEXT.grotto.swimIntoConch, cn.x, sy(st, cn.y) - 86, 18, '#ffe27a');
  }
  if (ph === 'swim' && st.guitar.settled && !st.guitar.held) {
    const g = st.guitar;
    label(k, FILM ? TEXT.grotto.catchSword : words(TEXT.grotto.catchGuitar), g.x, sy(st, g.y) - 90, 20, '#ffe27a');
  }
  if (ph === 'offer' && pt >= 1.6) {
    panel(k, 640, 128, 620, 104);
    c.font = '40px Yesteryear, cursive'; c.textAlign = 'center';
    c.fillStyle = k.col('#f3c6dc'); c.fillText(FILM ? TEXT.grotto.offer.title : TEXT.grotto.offer.titleClassic, 640, 122);
    const on = pt >= 2.0;
    c.globalAlpha = on ? 1 : 0.5;
    label(k, FILM ? TEXT.grotto.offer.hint : TEXT.grotto.offer.hintClassic, 640, 160, 20, '#f1e3c8');
    c.globalAlpha = 1;
  }
}

// HUD addition: the air gauge and the count of sleepers woken, on a plaque
// on the floor band beside the voyage ribbon.
function airGauge(k, st) {
  const c = k.c, y = 700, low = st.air < 0.25;
  c.fillStyle = k.col('#2a1424'); c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 1.5;
  if (typeof k.plaque === 'function') k.plaque(840, 680, 164, 40);
  else { c.beginPath(); c.roundRect(840, 680, 164, 40, 8); c.fill(); c.stroke(); }
  // bubble icon and bar
  if (!k.asset('hud-air-bubble', 858, y + 10, 20, 20)) {
    c.strokeStyle = k.col('#eef3ea'); c.lineWidth = 2; c.beginPath(); c.arc(858, y, 8, 0, TAU); c.stroke();
    c.fillStyle = k.col('#eef3ea'); k.circle(855, y - 3, 2);
  }
  // the tube is painted; the fill is drawn inside it in code
  if (!k.asset('hud-air-tube', 905, y + 8, 80, 16)) { c.fillStyle = k.col('#3b2a2a'); c.fillRect(872, y - 6, 66, 12); }
  const pulse = low ? 0.6 + 0.4 * Math.sin(k.t * 12) : 1;
  c.globalAlpha = pulse; c.fillStyle = k.col(low ? '#c8321e' : '#9fe0d0'); c.fillRect(872, y - 6, 66 * clamp(st.air, 0, 1), 12); c.globalAlpha = 1;
  if (!k.img('hud-air-tube')) { c.strokeStyle = k.col('#f1e3c8'); c.lineWidth = 1; c.strokeRect(872, y - 6, 66, 12); }
  // sleepers woken: a little sleeper icon and the count
  if (!k.asset('hud-sleeper', 960, y + 8, 24, 16)) {
    c.fillStyle = k.col('#e3c13b'); c.fillRect(950, y - 4, 18, 8);
    c.fillStyle = k.col('#efd7c4'); k.circle(972, y, 4.5);
  }
  c.font = '700 20px "Josefin Sans", sans-serif'; c.textAlign = 'left';
  c.fillStyle = k.col('#f1e3c8'); c.fillText(String(st.woken), 981, y + 7);
}

// ---------------------------------------------------------------- the ride
const boatX = (st) => st.ride?.x ?? RIDE.boatX;
// The boat's waterline on its row, and its height with any leap.
function rowY(st) {
  const r = st.ride;
  if (!r) return 512;
  const rp = rideRowPos(r), r0 = Math.floor(rp), r1 = Math.min(2, r0 + 1);
  const ROWS = [432, 512, 596];
  return lerp(ROWS[r0], ROWS[r1], rp - r0) - 34;
}
const boatY = (st) => rowY(st) - (st.ride ? rideLeapH(st.ride) : 0);

function ride(k, st, t) {
  const c = k.c, r = st.ride, rt = st.phase === 'ride' ? st.phaseT : PHASE_LEN.ride + st.phaseT;
  const scrolled = rt * 260;
  // the deep: dark teal water, rays, far rock silhouettes rolling past
  // the delivered panorama tiles seamlessly left/right and scrolls at 0.25 parallax
  const pano = k.img('deep-panorama');
  if (pano) {
    const po = (scrolled * 0.25) % 1280;
    k.asset('deep-panorama', 640 - po, 720, 1280, 720);
    k.asset('deep-panorama', 640 - po + 1280, 720, 1280, 720);
  } else {
  const g = c.createLinearGradient(0, 0, 0, 720);
  g.addColorStop(0, k.col('#24484c')); g.addColorStop(1, k.col('#0d1c22'));
  c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
  c.save(); c.globalAlpha = 0.14; c.fillStyle = k.col('#eef3ea');
  for (let i = 0; i < 5; i++) { const x = 200 + i * 230 + Math.sin(t * 0.4 + i) * 30; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 50, 0); c.lineTo(x + 150, 720); c.lineTo(x + 40, 720); c.fill(); }
  c.restore();
  }
  k.wire(300, 0, 120); c.save(); c.globalAlpha = 0.7; k.moon(300, 170, 46); c.restore();
  if (!pano) {
  c.fillStyle = k.col('#1a3236');
  const off = (scrolled * 0.25) % 400;
  c.beginPath(); c.moveTo(0, 420);
  for (let x = -off; x <= 1700; x += 100) c.lineTo(x, 330 + Math.sin((x + scrolled * 0.25) * 0.012) * 40 + ((Math.round((x + scrolled * 0.25) / 100) * 37) % 40));
  c.lineTo(1280, 420); c.closePath(); c.fill();
  }
  // the Sea King's palace coming into view
  const arrive = easeInOut((rt - 11) / 6);
  if (arrive > 0 && !k.asset('palace-distant', lerp(1450, 900, arrive), 420, 380, 330)) {
    const px = lerp(1450, 900, arrive), base = 420;
    c.fillStyle = k.col('#cfe3da'); c.globalAlpha = 0.6;
    c.beginPath(); c.moveTo(px - 160, base);
    for (const [dx, h] of [[-160, 90], [-120, 90], [-120, 170], [-95, 210], [-70, 170], [-40, 170], [-40, 250], [-15, 310], [10, 250], [10, 190], [50, 190], [50, 270], [75, 320], [100, 270], [100, 140], [140, 140], [140, 200], [160, 230], [180, 200], [180, 0]]) c.lineTo(px + dx, base - h);
    c.closePath(); c.fill(); c.globalAlpha = 1;
  }
  // three rows of undersea waves; the boat and pearls ride between them
  const by = boatY(st), rowNow = Math.round(rideRowPos(r));
  for (let row = 0; row < 3; row++) {
    for (const p of r.pearls) {
      if (p.got || p.row !== row || rt < p.at) continue;
      const x = ridePearlX(p, rt);
      if (x < -40 || x > 1320) continue;
      const py = [432, 512, 596][row] - 36 - (p.high ? RIDE.leapHeight * 0.8 : 0) + Math.sin(t * 3 + p.at) * 5;
      c.save(); c.globalAlpha = 0.3 + 0.15 * Math.sin(t * 5 + p.at); c.fillStyle = k.col('#d9b34a'); k.circle(x, py, 26); c.restore();
      if (!k.asset('pearl', x, py + 22, 44, 44)) { c.fillStyle = k.col('#f7f2fa'); k.circle(x, py, 15); c.fillStyle = k.col('#ffffff'); k.circle(x - 5, py - 5, 5); }
    }
    if (row === rowNow) {
      // the boat's shadow stays on the water while it leaps
      const lh = rideLeapH(r);
      if (lh > 4) { c.save(); c.globalAlpha = 0.25 * (1 - lh / RIDE.leapHeight / 2); c.fillStyle = k.col('#0d1c22'); c.beginPath(); c.ellipse(boatX(st) - 10, rowY(st) + 24, 120, 12, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
      boat(k, st, by, t);
      // the crew you woke ride after the carriage on their fish
      if (FILM) for (let i = 0; i < Math.min(3, st.woken || 0); i++) {
        const rx = boatX(st) - 190 - i * 130, ry = rowY(st) + 10 + Math.sin(t * 2.4 + i) * 8;
        if (rx > -100) k.asset('crew-rider', rx, ry, 150, 112);
      }
    }
    k.waves(row, scrolled);
  }
  k.wash('#2f5552', 0.38);
  if (rt < 4) label(k, TEXT.grotto.rideHint, 640, 140, 22, '#f1e3c8');
}

function boat(k, st, y, t) {
  const c = k.c, x = boatX(st), lh = st.ride ? rideLeapH(st.ride) : 0;
  // a leap tips the bow up a little, as Act I's ship does
  if (lh > 0) { c.save(); c.translate(x, y); c.rotate(-0.12 * Math.sin(Math.PI * lh / RIDE.leapHeight / 2)); c.translate(-x, -y); }
  k.moonboat(x, y, -1, 0.9);
  // the sailor rides in the stern of the crescent, guitar on his knee
  const sx = x - 84, syy = y + Math.sin(t * 2.1) * 6 + 4;
  // seated with the guitar on his knee (art requested); the rose follows his hand
  const seated = k.asset('sailor-seated', sx - 24, syy + 6, 110, 110);
  if (!seated && !k.asset('sailor-stand', sx, syy, 60, 100)) {
    c.save(); c.translate(sx, syy); c.scale(1.35, 1.35); c.translate(-sx, -syy);
    c.fillStyle = k.col(NAVY); c.beginPath(); c.moveTo(sx - 15, syy); c.lineTo(sx - 11, syy - 44); c.lineTo(sx + 11, syy - 44); c.lineTo(sx + 15, syy); c.fill();
    c.fillStyle = k.col('#c8321e'); c.fillRect(sx - 7, syy - 48, 14, 6);
    c.fillStyle = k.col('#efd7c4'); k.circle(sx, syy - 57, 10);
    c.fillStyle = k.col('#c9c6c0'); c.beginPath(); c.moveTo(sx - 8, syy - 54); c.quadraticCurveTo(sx, syy - 36, sx + 8, syy - 54); c.fill();
    c.fillStyle = k.col(NAVY); c.fillRect(sx - 11, syy - 70, 22, 6);
    c.restore();
  }
  if (!seated) {
    c.save(); c.translate(sx + 10, syy - 24); c.rotate(-0.9);
    if (!k.asset('keepsake-guitar', 0, 20, 40, 40)) guitarStandin(k, 0.22);
    c.restore();
  }
  if (st.rose) { if (seated) k.keepsake('rose', sx - 24 + 18, syy + 6 - 62, 0.4); else k.keepsake('rose', sx + 8, syy - 66, 0.4); }
  if (lh > 0) c.restore();
}
