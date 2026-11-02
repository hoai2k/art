import { rockfallDust, rockfallTrail } from '../rockfall-effects.js';
import { LEGACY, BAY_TITLE, FILM } from '../theme.js';
// Act V drawing: the cliff, the burning house, the quay, the three endings
// and the pageant. Every piece of new art has a procedural stand-in until its
// file is delivered (ids are in design/image-requests.md, Parts C1 and C6,
// drawn at half the listed size). Draw only from state and t: no randomness.
import { BEAT_S, CLIFF, HOUSE, QUAY, T, PAGEANT, joinAt, climberPos, bootLift, holdY, climbOptions } from './act5.js';
import { richText } from '../art.js';   // headless-safe: art.js touches no DOM at load
import { clamp, lerp, easeOut, easeInOut, beatPhase } from './shared.js';
import { drawMovement, cliffPose, housePose } from './sailor-motion.js';
import { walkFrame, walkStep, walkFrameFromSwing } from '../walking.js';
import { CLIMB, wallPose } from './climb.js';
import { drawPose } from '../pose.js';

const S = 0.6; // the sailor's scale on the cliff and in the house
const LEGS = [450, 564]; // the giant's boots on their shelf under the lip
const SAILOR = { coat: '#2b3550', legs: '#8a8a8a', hat: 'cap', hatCol: '#1f2740', scarf: '#c8321e', beard: '#d8d4cc', hair: '#9a948a' };
const BELOVED = { coat: '#f1e3c8', skirt: '#f1e3c8', shawl: '#f3c6dc', hair: '#7a3420', hat: 'bun' };
const WITCH = { coat: '#f3c6dc', skirt: '#f3c6dc', hair: '#1a1214', hat: 'crown', hatCol: '#d9b34a', long: true };
const KING = { coat: '#4a6fa0', skirt: '#f4f1ea', trim: '#4a6fa0', hat: 'crown', hatCol: '#d9b34a', beard: '#f4f1ea', hair: '#f4f1ea' };
const REVELLER_COLS = ['#e3c13b', '#6f9a4a', '#8a3f7a', '#e7a6bd', '#5f8c88', '#e9a46a'];

// ---------------------------------------------------------------- entry points
export function draw(k, st, t) {
  const ph = st.phase;
  if (ph === 'cliff' || ph === 'storm') return cliffScene(k, st, t);
  if (ph === 'house') return houseScene(k, st, t);
  if (ph === 'quay') return quayScene(k, st, t);
  if (ph === 'ending') return endingScene(k, st, t);
  return pageantScene(k, st, t);
}

export function drawOver(k, st) {
  if (st.defeatT != null) k.wash('#2a1424', 0.55 * clamp(st.defeatT / T.defeat, 0, 1));
  if (st.phase === 'iris') k.iris(640, 400, 760 * (1 - easeInOut(st.phaseT / T.iris)));
  if (st.status === 'won') k.iris(640, 400, 0);
}

export function onEvent(k, e, st) {
  const at = playerScreen(st);
  switch (e.type) {
    case 'hit': k.shake(0.35); k.burst(at.x, at.y - 50, '#c8321e', 14, 'streak'); break;
    case 'pearl': { const s = cliffScreen(st, e.x, e.y); k.burst(s.x, s.y - 20, '#eef3ea', 8, 'sparkle'); k.text('+10', s.x, s.y - 60); break; }
    case 'holdCrumble': { const s = cliffScreen(st, e.x, e.y); k.burst(s.x, s.y, '#b8ad9a', 14, 'chip'); k.shake(0.2); break; }
    case 'stoneGlance': k.burst(at.x + 30, at.y - 110, '#b8ad9a', 8, 'chip'); k.text('Sheltered', at.x, at.y - 130); break;
    case 'giantStep': { const s = cliffScreen(st, e.foot ? LEGS[1] : LEGS[0], CLIFF.top - 100); k.burst(s.x, s.y, '#cfc0dc', 4, 'chip'); break; }
    case 'clifftop': k.text(BAY_TITLE, 640, 240, true); k.burst(at.x, at.y - 40, '#d9b34a', 18, 'sparkle'); break;
    case 'strike': k.flash(1); k.shake(0.5); break;
    case 'houseOpen': k.shake(0.3); break;
    case 'beamCrash': k.burst(e.x, e.y - 10, '#3a2112', 14, 'chip'); k.burst(e.x, e.y - 20, '#e9a46a', 8, 'sparkle'); k.shake(0.25); break;
    case 'debrisCrash': k.burst(e.x, e.y - 10, '#8d8f91', 14, 'chip'); k.shake(0.2); break;
    case 'stoneThrow': k.text('The stone!', at.x, at.y - 130); break;
    case 'shutterSmash': k.burst(HOUSE.shutterX, HOUSE.shutterY, '#6b4024', 22, 'chip'); k.text('Shortcut!', HOUSE.shutterX, HOUSE.shutterY - 90, true); k.shake(0.2); break;
    case 'shutterLocked': k.text('Locked fast', HOUSE.shutterX, HOUSE.shutterY - 70); break;
    case 'liftHer': k.burst(HOUSE.beloved, HOUSE.floors[2] - 70, '#f3c6dc', 20, 'sparkle'); break;
    case 'floorBreak': k.shake(0.6); k.burst(560, 560, '#3a2112', 24, 'chip'); k.burst(820, 440, '#e9a46a', 14, 'sparkle'); break;
    case 'thud': k.burst(at.x, at.y, '#b98a5e', 10, 'chip'); break;
    case 'houseFall': k.shake(0.8); k.burst(330, 300, '#e9a46a', 30, 'sparkle'); k.burst(330, 340, '#6b4024', 20, 'chip'); break;
    case 'ending': break;
    case 'moonboatRise': k.burst(900, 540, '#eef3ea', 26, 'drop'); break;
    case 'witchClaim': k.burst(800, 520, '#f3c6dc', 20, 'sparkle'); break;
    case 'lampLit': k.flash(0.3); k.burst(372, 268, '#d9b34a', 22, 'sparkle'); break;
    case 'stonePlop': k.burst(990, 540, '#eef3ea', 18, 'drop'); break;
    case 'pageant': k.flash(0.4); break;
    case 'pageantJoin': { const s = joinerSlot(e.n - 1); k.burst(s.x, 540, REVELLER_COLS[(e.n - 1) % 6], 8, 'confetti'); break; }
    case 'pageantApplause': for (const col of ['#f3c6dc', '#d9b34a', '#5f8c88', '#eef3ea']) k.burst(640, 260, col, 18, 'confetti'); break;
    default: break;
  }
}

// ---------------------------------------------------------------- coordinates
// Cliff world (y up from the shore) to the stage.
const sy = (st, wy) => 640 + st.camY - wy;
function cliffScreen(st, x, wy) { return { x, y: sy(st, wy) }; }
// The mobile camera's focus (src/camera.js): the player's middle, stage px.
export function focus(st) {
  const q = playerScreen(st);
  return { x: q.x, y: q.y - (st.phase === 'cliff' || st.phase === 'storm' ? 40 : 70) };
}

export function playerScreen(st) {
  if (st.phase === 'cliff' || st.phase === 'storm') { const p = climberPos(st); return { x: p.x, y: sy(st, p.y) }; }
  return { x: st.p.x, y: st.p.y };
}

// ---------------------------------------------------------------- figures
// A cut-out person on a stick: feet at (x, by), height h. o: costume.
function person(k, x, by, h, o, pose = {}) {
  const c = k.c, face = pose.face || 1, arms = pose.arms || 'down';
  const step = pose.step || 0;
  c.save(); c.translate(x, by); c.scale(face, 1);
  if (pose.tilt) c.rotate(pose.tilt);
  const u = h / 100;
  // legs or skirt
  if (o.skirt) {
    c.fillStyle = k.col(o.skirt);
    c.beginPath(); c.moveTo(-20 * u, 0); c.lineTo(20 * u, 0); c.lineTo(10 * u, -55 * u); c.lineTo(-10 * u, -55 * u); c.closePath(); c.fill();
    if (o.trim) { c.fillStyle = k.col(o.trim); c.fillRect(-20 * u, -6 * u, 40 * u, 6 * u); }
  } else {
    c.fillStyle = k.col(o.legs || '#555');
    c.save(); c.rotate(step * 0.35); c.fillRect(-9 * u, -46 * u, 8 * u, 44 * u); c.restore();
    c.save(); c.rotate(-step * 0.35); c.fillRect(1 * u, -46 * u, 8 * u, 44 * u); c.restore();
    c.fillStyle = k.col('#1a1416');
    c.fillRect(-11 * u + step * 6 * u, -5 * u, 12 * u, 5 * u); c.fillRect(1 * u - step * 6 * u, -5 * u, 13 * u, 5 * u);
  }
  // coat / bodice
  c.fillStyle = k.col(o.coat);
  c.beginPath(); c.moveTo(-15 * u, -42 * u); c.lineTo(15 * u, -42 * u); c.lineTo(11 * u, -80 * u); c.lineTo(-11 * u, -80 * u); c.closePath(); c.fill();
  if (o.shawl) { c.fillStyle = k.col(o.shawl); c.beginPath(); c.moveTo(-14 * u, -78 * u); c.lineTo(14 * u, -78 * u); c.lineTo(4 * u, -58 * u); c.lineTo(-6 * u, -60 * u); c.closePath(); c.fill(); }
  if (o.scarf) { c.fillStyle = k.col(o.scarf); c.fillRect(-7 * u, -82 * u, 14 * u, 6 * u); }
  // arms
  c.strokeStyle = k.col(o.shawl || o.coat); c.lineWidth = 6 * u; c.lineCap = 'round';
  const arm = (sx, ex, ey) => { c.beginPath(); c.moveTo(sx * u, -76 * u); c.lineTo(ex * u, ey * u); c.stroke(); };
  if (arms === 'up') { arm(-9, -18, -112); arm(9, 16, -106); }
  else if (arms === 'reach') { arm(-9, -10, -60); arm(9, 30, -100); }
  else if (arms === 'out') { arm(-9, -30, -70); arm(9, 30, -70); }
  else if (arms === 'v') { arm(-9, -26, -118); arm(9, 26, -118); }
  else if (arms === 'throw') { arm(-9, -16, -56); arm(9, 32, -96); }
  else { arm(-9, -14, -46); arm(9, 14, -46); }
  // head
  if (o.long) { c.fillStyle = k.col(o.hair); c.fillRect(-12 * u, -96 * u, 6 * u, 32 * u); c.fillRect(6 * u, -96 * u, 6 * u, 32 * u); }
  c.fillStyle = k.col('#efd7c4'); k.circle(0, -90 * u, 9 * u);
  if (o.beard) { c.fillStyle = k.col(o.beard); c.beginPath(); c.moveTo(-8 * u, -90 * u); c.quadraticCurveTo(0, -70 * u, 9 * u, -90 * u); c.closePath(); c.fill(); }
  if (o.long) { c.fillStyle = k.col(o.hair); c.beginPath(); c.arc(0, -91 * u, 9.5 * u, Math.PI * 1.05, Math.PI * 1.95); c.fill(); }
  if (o.hat === 'cap') { c.fillStyle = k.col(o.hatCol); c.fillRect(-10 * u, -102 * u, 20 * u, 7 * u); c.fillRect(-4 * u, -97 * u, 16 * u, 3 * u); }
  else if (o.hat === 'crown') { c.fillStyle = k.col(o.hatCol); c.beginPath(); c.moveTo(-9 * u, -97 * u); c.lineTo(-9 * u, -108 * u); c.lineTo(-4 * u, -102 * u); c.lineTo(0, -110 * u); c.lineTo(4 * u, -102 * u); c.lineTo(9 * u, -108 * u); c.lineTo(9 * u, -97 * u); c.closePath(); c.fill(); }
  else if (o.hat === 'bun') { c.fillStyle = k.col(o.hair); k.circle(-2 * u, -99 * u, 8 * u); k.circle(-8 * u, -96 * u, 5 * u); }
  else if (o.hat === 'flowers') { c.fillStyle = k.col(o.hair); c.fillRect(-9 * u, -100 * u, 18 * u, 5 * u); for (let i = -1; i <= 1; i++) { c.fillStyle = k.col(i ? '#e0127a' : '#d9b34a'); k.circle(i * 7 * u, -100 * u, 3 * u); } }
  else if (o.hair) { c.fillStyle = k.col(o.hair); c.fillRect(-9 * u, -100 * u, 18 * u, 5 * u); }
  c.restore();
}

// Delivered art faces right; flip it for face -1.
// A person with the film idle (kit.idle), mirrored when facing left.
function idleFlip(k, id, time, x, by, w, h, face = 1) {
  if (!k.img(id)) return false;
  const c = k.c;
  c.save(); c.translate(x, by); c.scale(face, 1); k.idle(id, time, 0, 0, w, h); c.restore();
  return true;
}
function artFlip(k, id, x, by, w, h, face = 1) {
  if (!k.img(id)) return false;
  const c = k.c;
  c.save(); c.translate(x, by); c.scale(face, 1); k.asset(id, 0, 0, w, h); c.restore();
  return true;
}

// The sailor's movement poses share an anatomical scale and foot anchor.
export function sailor(k, x, by, s, pose, face = 1, step = 0, travel = null) {
  if (drawMovement(k, pose, x, by, 180 * s, face)) return;
  if (pose === 'apex' || pose === 'fall') pose = 'leap';
  if (pose.startsWith('climb-')) pose = 'climb';
  if (pose.startsWith('stairs-pass-')) pose = pose.slice('stairs-'.length);
  else if (pose.startsWith('stairs-')) pose = 'walk';
  if (pose === 'land') pose = 'stand';
  if (pose === 'carry') {
    const carryId = travel == null ? 'sailor-carry' : walkFrame('sailor-carry', travel);
    if (artFlip(k, carryId, x, by, 180 * s, 200 * s, face)
        || carryId !== 'sailor-carry' && artFlip(k, 'sailor-carry', x, by, 180 * s, 200 * s, face)) return;
    person(k, x, by, 180 * s, SAILOR, { face, arms: 'out', step });
    // her, across his arms: head at his shoulder, skirt falling past his knees
    const c = k.c;
    c.save(); c.translate(x, by - 104 * s); c.scale(face, 1);
    c.fillStyle = k.col(BELOVED.skirt);
    c.beginPath(); c.moveTo(-6 * s, -12 * s); c.quadraticCurveTo(40 * s, -16 * s, 74 * s, 6 * s); c.lineTo(80 * s, 44 * s); c.quadraticCurveTo(50 * s, 30 * s, 6 * s, 18 * s); c.closePath(); c.fill();
    c.fillStyle = k.col('#c9b79a'); c.fillRect(70 * s, 40 * s, 12 * s, 6 * s);
    c.fillStyle = k.col(BELOVED.shawl);
    c.beginPath(); c.moveTo(-26 * s, -22 * s); c.lineTo(12 * s, -18 * s); c.lineTo(14 * s, 10 * s); c.lineTo(-20 * s, 26 * s); c.closePath(); c.fill();
    c.strokeStyle = k.col(BELOVED.shawl); c.lineWidth = 7 * s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-14 * s, -18 * s); c.quadraticCurveTo(-4 * s, -52 * s, 10 * s, -66 * s); c.stroke(); // her arm round his neck
    c.fillStyle = k.col('#efd7c4'); k.circle(-24 * s, -30 * s, 14 * s);
    c.fillStyle = k.col(BELOVED.hair); k.circle(-34 * s, -36 * s, 11 * s); k.circle(-28 * s, -42 * s, 9 * s);
    c.restore();
    return;
  }
  const id = pose.startsWith('pass-') ? 'sailor-' + pose : pose === 'walk' ? (travel == null ? walkFrameFromSwing('sailor', step) : walkFrame('sailor', travel)) : pose === 'leap' || pose === 'climb' ? 'sailor-leap' : 'sailor-stand';
  const w = pose === 'leap' || pose === 'climb' ? 130 : 110;
  if (artFlip(k, id, x, by, w * s, 180 * s, face)) return;
  const arms = pose === 'climb' ? 'up' : pose === 'leap' ? 'reach' : pose === 'throw' ? 'throw' : 'down';
  person(k, x, by, 180 * s, SAILOR, { face, arms, step: pose === 'walk' ? step : pose === 'leap' ? 0.8 : 0 });
}

export function beloved(k, x, by, s, face = -1, arms = 'down') {
  if (artFlip(k, 'beloved-stand', x, by, 100 * s, 190 * s, -face)) return;
  person(k, x, by, 175 * s, BELOVED, { face, arms });
}

function witchFigure(k, x, by, s, face = -1) {
  if (artFlip(k, 'witch-stand', x, by, 130 * s, 210 * s, -face)) return;
  person(k, x, by, 200 * s, WITCH, { face, arms: 'reach' });
  const c = k.c; // the star wand
  c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 2.5;
  const hx = x + face * 28 * s, hy = by - 196 * s;
  c.beginPath(); c.moveTo(x + face * 18 * s, by - 150 * s); c.lineTo(hx, hy); c.stroke();
  c.fillStyle = k.col('#fff2b0'); k.star(hx, hy, 9 * s);
}

// ---------------------------------------------------------------- the band at impossible scales
// Fractions of the delivered band-trio cut-out (1254 px square original).
const TRIO = {
  legs: [0.594, 0.55, 0.785, 0.969],     // the bearded one's legs and boots
  guitarist: [0.295, 0.048, 0.638, 0.969],
  beard: [0.586, 0.068, 0.917, 0.574],   // the bearded one, hip up, with the guitar neck
};
function trioCrop(k, part, dx, dy, dw, dh, sub = null) {
  const im = k.img('band-trio');
  if (!im) return false;
  let [x0, y0, x1, y1] = TRIO[part];
  if (sub) { const w = x1 - x0; x1 = x0 + w * sub[1]; x0 = x0 + w * sub[0]; }
  return k.assetCrop('band-trio', x0 * im.width, y0 * im.height, (x1 - x0) * im.width, (y1 - y0) * im.height, dx, dy, dw, dh);
}

// One giant leg, its boot sole at (x, by). half: 0 = left leg, 1 = right.
function giantLeg(k, x, by, half) {
  if (!LEGACY) {
    // Same moving foothold and foot anchor as the preserved boot mechanic.
    k.c.fillStyle = k.col('#6f6a5e');
    k.c.beginPath(); k.c.moveTo(x - 50, by); k.c.lineTo(x - 38, by - 46);
    k.c.lineTo(x + 38, by - 46); k.c.lineTo(x + 50, by); k.c.closePath(); k.c.fill();
    return;
  }
  const c = k.c, legs = k.img('band-legs-giant');
  if (legs) {
    const w = legs.width / 2;
    k.assetCrop('band-legs-giant', half * w, 0, w, legs.height, x - 70, by - 560, 140, 560);
    return;
  }
  if (trioCrop(k, 'legs', x - 64, by - 580, 128, 580, half ? [0.5, 1] : [0, 0.5])) return;
  c.fillStyle = k.col('#e9e1d0'); c.fillRect(x - 34, by - 900, 68, 870);
  c.fillStyle = k.col('#6a2a4a');
  for (let i = 0; i < 4; i++) c.fillRect(x - 30 + i * 18, by - 900, 7, 870);
  c.fillStyle = k.col('#1a1416');
  c.beginPath(); c.moveTo(x - 38, by - 46); c.lineTo(x + 38, by - 46); c.lineTo(x + 44, by - 10); c.quadraticCurveTo(x + 60, by, x + 50, by); c.lineTo(x - 50, by); c.quadraticCurveTo(x - 60, by, x - 44, by - 10); c.closePath(); c.fill();
}

function tinyGuitarist(k, x, by, t, beat) {
  if (!LEGACY) return;
  const bob = Math.abs(Math.sin(Math.PI * beatPhase(beat))) * 2;
  if (k.asset('band-guitar', x, by - bob, 50, 100)) return;
  if (trioCrop(k, 'guitarist', x - 19, by - 104 - bob, 38, 104)) return;
  person(k, x, by, 70, { coat: '#f3c6dc', legs: '#5f8c88', hair: '#3a2112', long: true }, {});
  k.c.fillStyle = k.col('#e8d3a0'); k.circle(x + 3, by - 36, 8);
}

function hugeGuitarist(k, st, t) {
  if (!LEGACY) return;
  const show = st.phase === 'storm' ? 1 - easeInOut(st.phaseT / 1.2) : easeInOut((st.camY - CLIFF.camMax + 420) / 320);
  if (show <= 0.01) return;
  const c = k.c, x = 1400 - show * 270;
  const sway = Math.sin(Math.PI * (st.beat || 0)) * 0.025;
  c.save(); c.translate(x, 740); c.rotate(-0.12 + sway);
  if (!k.idle('band-beard', (st.beat || 0) * 60 / 76.5, 0, 260, 440, 880)) {
    if (!trioCrop(k, 'beard', -230, -700, 460, 704)) {
      person(k, 0, 0, 760, { coat: '#e9e1d0', legs: '#4a2a3a', beard: '#3a2a20', hair: '#3a2a20' }, { arms: 'out' });
      c.fillStyle = k.col('#2a1a12'); c.fillRect(-260, -420, 340, 26);
    }
  }
  c.restore();
}

// ---------------------------------------------------------------- backcloth
function bay(k, st, t, fire, horizon = 470) {
  const c = k.c;
  if (!k.asset('bay-backcloth-empty', 640, 720, 1280, 720) && !k.asset('bay-backcloth', 640, 720, 1280, 720)) {
    const g = c.createLinearGradient(0, 60, 0, horizon);
    g.addColorStop(0, k.col('#1d3a4a')); g.addColorStop(0.7, k.col('#355a66')); g.addColorStop(1, k.col('#6d4a6a'));
    c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
    c.fillStyle = k.col('#f1e3c8');
    for (let i = 0; i < 26; i++) { c.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2 + i); k.star((i * 397) % 980 + 150, (i * 151) % (horizon - 150) + 70, 2 + (i % 3)); }
    c.globalAlpha = 1;
    k.moon(1010, 150, 42);
    // the far headland with the lighthouse
    c.fillStyle = k.col('#2a4049');
    c.beginPath(); c.moveTo(860, horizon); c.quadraticCurveTo(1000, horizon - 70, 1180, horizon - 50); c.lineTo(1280, horizon - 40); c.lineTo(1280, horizon); c.fill();
    if (!k.asset('lighthouse', 1090, horizon - 50, 46, 92)) { c.fillStyle = k.col('#eef3ea'); c.fillRect(1082, horizon - 130, 16, 80); c.fillStyle = k.col('#c8321e'); c.fillRect(1082, horizon - 110, 16, 12); }
    // the sea and boats at anchor
    c.fillStyle = k.col('#2f5552'); c.fillRect(0, horizon, 1280, 720 - horizon);
    c.strokeStyle = k.col('#eef3ea'); c.lineWidth = 2; c.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) { const y = horizon + 18 + i * 34; c.beginPath(); for (let x = 140; x <= 1140; x += 40) c.lineTo(x, y + Math.sin(x * 0.03 + t * 1.5 + i) * 4); c.stroke(); }
    c.globalAlpha = 1;
    for (const [bx, s] of [[300, 1], [1020, 0.8]]) {
      c.fillStyle = k.col('#3a2112');
      c.beginPath(); c.moveTo(bx - 30 * s, horizon + 14); c.lineTo(bx + 30 * s, horizon + 14); c.lineTo(bx + 22 * s, horizon + 26); c.lineTo(bx - 22 * s, horizon + 26); c.fill();
      c.fillRect(bx - 1, horizon - 34 * s, 2, 48 * s);
      c.fillStyle = k.col('#f1e3c8'); c.beginPath(); c.moveTo(bx + 2, horizon - 30 * s); c.lineTo(bx + 24 * s, horizon + 8); c.lineTo(bx + 2, horizon + 8); c.fill();
    }
  }
  if (fire > 0.01) {
    c.save(); c.globalAlpha = fire;
    if (!k.asset('bay-backcloth-fire-empty', 640, 720, 1280, 720) && !k.asset('bay-backcloth-fire', 640, 720, 1280, 720)) { c.globalAlpha = 1; k.wash('#c8321e', 0.5 * fire); k.wash('#e9a46a', 0.22 * fire); }
    c.restore();
  }
}

// ---------------------------------------------------------------- part 1: the cliff
// Any delivered cliff art brings its own surf at the foot and grass on top.
const CLIFF_ART_SEA = (k) => !!(k.img('cliff-face-tall-2') || k.img('cliff-face-tall') || k.img('cliff-face'));
// cliff-face-tall (1400 x 3600) as delivered: its grass top slopes (art y 50
// at the left to 230 at the right), it narrows toward the top, and its dark
// crack runs nearly the whole height at about two-thirds across. It is drawn
// 868 wide (8% wider than its proportions), its left edge at x 213, so the
// crack falls at x ~790 and the face covers the top-left holds, and scaled
// so the grass under the house (art y 110) is the clifftop line, its foot
// on world y -30.
// cliff-face-tall-2 (third round) is requested with a level top and a full-
// width face, so it is drawn at its own proportions when it arrives.
const TALL1 = { id: 'cliff-face-tall', x0: 213, w: 868, topArtY: 110 };
const TALL2 = { id: 'cliff-face-tall-2', x0: 230, w: 820, topArtY: 12 };
let TALL = TALL1;
const tallScale = () => (CLIFF.top + 30) / (3600 - TALL.topArtY);
const tallH = () => 3600 * tallScale();
export const tallGap = () => ({ x: TALL.x0 + TALL.w * 0.665, lo: 0, hi: CLIFF.top });
const lx = (wy) => 268 + 16 * Math.sin(wy * 0.013) + 10 * Math.sin(wy * 0.041);
const rx = (wy) => 1004 + 14 * Math.sin(wy * 0.017 + 1) + 9 * Math.sin(wy * 0.05);
// Rock pillars across the cliff flat: x, width, block height, phase, shade.
const PILLARS = (() => {
  const out = []; let x = 276, i = 0;
  while (x < 990) { const w = 48 + ((i * 37) % 46); out.push({ x, w: Math.min(w, 1000 - x), h: 110 + ((i * 59) % 80), off: (i * 71) % 150, shade: 12 + (i * 5) % 12 }); x += w; i++; }
  return out;
})();
const IVY = Array.from({ length: 40 }, (_, i) => ({ x: (i * 263) % 680 + 300, y: (i * 211) % 1900, r: 16 + (i * 7) % 16 }));

export function cliffScene(k, st, t) {
  const c = k.c, cam = st.camY, storm = st.phase === 'storm';
  // The film edition climbs its own coast: the sea gap and the witch's tower
  // across it behind the cliff, darkened a little; else the bay.
  if (st.part && k.img('coast-gap')) { k.asset('coast-gap', 640, 720 + cam * 0.05, 1280, 720); k.wash('#0b0a18', 0.25); }
  else bay(k, st, t, st.fire, 470 + cam * 0.08);
  c.save(); c.translate(0, 640 + cam); // world: draw at y = -wy
  const lo = Math.max(-120, cam - 120), hi = cam + 720;
  // shore and surf (cliff-face paints its own surf at its foot)
  if (lo < 40 && !CLIFF_ART_SEA(k)) {
    c.fillStyle = k.col('#2f5552'); c.fillRect(0, 10, 1280, 200);
    c.strokeStyle = k.col('#eef3ea'); c.lineWidth = 3;
    for (let i = 0; i < 3; i++) { c.beginPath(); for (let x = 0; x <= 1280; x += 30) c.lineTo(x, 30 + i * 26 + Math.sin(x * 0.04 + t * 2 + i) * 5); c.stroke(); }
    c.fillStyle = k.col('#cdbb93'); c.fillRect(0, -2, 1280, 22);
  }
  // the cliff flat
  // A delivered cliff flat is hung twice, one above the other. The upper one
  // whole (its cleft is where the tiny guitarist's gap hold is); the lower one
  // without its grassy top, reaching up over the upper one's painted surf so
  // no sea shows halfway up the climb. (cliff-face.webp is 1400x1800: grass
  // to y 80, surf from y 1540.)
  const H2 = (CLIFF.top + 30) / 2, SURF = (1800 - 1540) / 1800 * (H2 + 4);
  let cliffArt = false;
  // cliff-face-tall is the whole climb in one image, drawn once (see TALL).
  TALL = k.img(TALL2.id) ? TALL2 : TALL1;
  if (k.img(TALL.id)) cliffArt = k.asset(TALL.id, TALL.x0 + TALL.w / 2, 30, TALL.w, tallH());
  else if (k.img('cliff-face')) {
    c.save(); c.beginPath(); c.rect(0, -1e5, 1280, 1e5 + 30 - H2 - SURF + 12); c.clip(); // the upper one stops above its surf
    k.asset('cliff-face', 640, 30 - H2, 820, H2 + 4);
    c.restore();
    cliffArt = k.assetCrop('cliff-face', 0, 80, 1400, 1720, 230, 30 - (H2 + 4) - SURF, 820, H2 + 4 + SURF);
  }
  if (!cliffArt) {
    const y0 = Math.max(-20, lo), y1 = Math.min(CLIFF.top, hi);
    c.fillStyle = k.col('#e4dccb');
    c.beginPath();
    for (let wy = y0; wy <= y1; wy += 30) c.lineTo(lx(wy), -wy);
    c.lineTo(lx(y1), -y1);
    for (let wy = y1; wy >= y0; wy -= 30) c.lineTo(rx(wy), -wy);
    c.lineTo(rx(y0), -y0);
    c.closePath(); c.fill();
    // pillars of rock, blocks staggered column by column, shaded on one side
    for (const col of PILLARS) {
      for (let by = Math.floor((y0 - col.off) / col.h) * col.h + col.off; by < y1; by += col.h) {
        const b0 = Math.max(y0, by), b1 = Math.min(y1, by + col.h);
        if (b1 <= b0) continue;
        const j = Math.round(by / col.h) & 3, sw = col.shade + j * 3;
        // the shaded side of each block, a little ragged, and its bedding line
        c.fillStyle = k.col(j === 2 ? '#a99d88' : '#bdb29c');
        c.beginPath(); c.moveTo(col.x + col.w - sw, -b0); c.lineTo(col.x + col.w, -b0); c.lineTo(col.x + col.w, -b1); c.lineTo(col.x + col.w - sw - 6, -b1 + 10); c.closePath(); c.fill();
        if (j === 1) { c.fillStyle = k.col('#d6ccb8'); c.fillRect(col.x + 4, -b1 + 8, col.w * 0.4, (b1 - b0) * 0.5); }
        c.fillStyle = k.col('#8d8170'); c.fillRect(col.x, -by - 3, col.w, 3);
      }
    }
    c.fillStyle = k.col('#5f7d4a');
    for (const v of IVY) if (v.y > lo - 40 && v.y < hi + 40) { k.circle(v.x, -v.y, v.r); k.circle(v.x + v.r * 0.8, -v.y + v.r * 0.6, v.r * 0.6); }
    c.fillStyle = k.col('#7f9a5a');
    for (const v of IVY) if (v.y > lo - 40 && v.y < hi + 40) k.circle(v.x - v.r * 0.3, -v.y - v.r * 0.3, v.r * 0.45);
  }
  // the overhanging lip and the grass top
  if (hi > CLIFF.top - 80 && !CLIFF_ART_SEA(k)) {
    c.fillStyle = k.col('#6f6a5e'); c.fillRect(254, -CLIFF.top + 54, 772, 12);
    c.fillStyle = k.col('#c9bda5'); c.fillRect(258, -CLIFF.top, 764, 56);
    c.strokeStyle = k.col('#8d8170'); c.lineWidth = 2;
    for (let x = 270; x < 1010; x += 60) { c.beginPath(); c.moveTo(x, -CLIFF.top + 6); c.lineTo(x + 14, -CLIFF.top + 52); c.stroke(); }
    c.fillStyle = k.col('#6f9a4a'); c.fillRect(248, -CLIFF.top - 10, 784, 14);
    // the rock shelf the giant stands on
    if (!k.img('cliff-ledge')) { c.fillStyle = k.col('#8d8170'); c.fillRect(LEGS[0] - 70, -(CLIFF.top - 100), 250, 14); }
  }
  // the giant's shelf, 250 wide: three 104 x 24 cliff-ledge tiles, top on the shelf line
  if (hi > CLIFF.top - 200 && !st.part) for (const lx0 of [LEGS[0] - 18, LEGS[0] + 55, LEGS[0] + 128]) k.asset('cliff-ledge', lx0, -(CLIFF.top - 100) + 24, 104, 24);
  holds(k, st, t);
  c.restore();

  // The house on the clifftop, in stage coordinates lifted with the camera:
  // front closed, or swinging open in the storm.
  // (The film edition's clifftop has no house: the tower is across the sea.)
  if (!st.part) {
    c.save(); c.translate(0, cam - CLIFF.top);
    if (st.open > 0) houseInterior(k, st, t);
    frontPanel(k, st.open, t);
    c.restore();
  }

  c.save(); c.translate(0, 640 + cam);
  // the giant's legs, shifting weight on the beat; they stride off in the storm
  const off = storm ? easeInOut((st.phaseT - 0.3) / 1.6) * 1100 : 0;
  const beat = st.beat || 0;
  if (!st.part) for (const half of [0, 1]) {
    const lift = (half ? bootLift(beat - 1) : bootLift(beat)) * CLIFF.bootLift;
    giantLeg(k, LEGS[half], -(CLIFF.top - 100) - lift - off - 4, half);
  }
  rocksWorld(k, st, t);
  climbGuide(k, st, t);
  climber(k, st, t);
  c.restore();
  rockWarnings(k, st, t);
  if (storm) stormFx(k, st, t);
  if (!st.part) hugeGuitarist(k, st, t);
}

export function holds(k, st, t) {
  if (st.wall) return wallThings(k, st, t);
  const c = k.c, cam = st.camY;
  st.holds.forEach((h, i) => {
    const y = -holdY(h, st.beat || 0);
    if (-y < cam - 140 || -y > cam + 720) return;
    if (h.kind === 'boot' || h.kind === 'top') return;
    // (film tower) a stone painted on the wall is its own hold; a grip in the
    // painted ivy is a knot of vine, dry and brown where it will tear
    if (h.painted || h.ivy) {
      if (h.ivy && !h.gone) ivyGrip(k, h.x + (h.kind === 'crumble' && st.cl.at === i && st.cl.crumbleT < 0.5 ? Math.sin(t * 60) * 2.5 : 0), y, h.kind === 'crumble', t + i);
      if (h.pearl && !h.taken) {
        const by = y - 8 + Math.sin(t * 3 + i) * 3;
        c.save(); c.globalAlpha = 0.3 + 0.15 * Math.sin(t * 4 + i); c.fillStyle = k.col('#fff2b0'); k.circle(h.x, by - 11, 18); c.restore();
        if (!k.asset('pearl', h.x, by, 22, 22)) { c.fillStyle = k.col('#efe9f2'); k.circle(h.x, by - 10, 9); }
      }
      return;
    }
    if (h.gone) { if (!k.asset('cliff-hold-gone', h.x, y + 12, 40, 12)) { c.fillStyle = k.col('#7d7262'); c.fillRect(h.x - 16, y + 2, 32, 5); } return; }
    const occupied = st.cl.at === i;
    let x = h.x;
    if (h.kind === 'crumble' && occupied && st.cl.crumbleT < 0.5) x += Math.sin(t * 60) * 2.5;
    if (h.kind === 'gap') {
      // a dark cleft in the rock; the tiny guitarist plays on a knob above the hold
      // (the delivered cliff already has the cleft painted; its slot is at x 740-790)
      if (!k.img('cliff-face')) {
        c.fillStyle = k.col('#3a302a');
        c.beginPath(); c.moveTo(x - 34, y + 18); c.lineTo(x - 26, y - 236); c.lineTo(x + 30, y - 228); c.lineTo(x + 38, y + 18); c.closePath(); c.fill();
      }
      if (!k.asset('cliff-hold', x, y - 124 + 20, 50, 20)) { c.fillStyle = k.col('#8d8170'); c.fillRect(x - 22, y - 124, 44, 8); }
      tinyGuitarist(k, x, y - 124, t, st.beat || 0);
    }
    const w = h.kind === 'ledge' ? 104 : 50;
    // art, top at the hold's y: ledge 104 x 24, hold and crumbling hold 50 x 20
    const holdArt = h.kind === 'ledge' ? k.asset('cliff-ledge', x, y + 24, 104, 24)
      : k.asset(h.kind === 'crumble' ? 'cliff-hold-crumble' : 'cliff-hold', x, y + 20, 50, 20);
    if (!holdArt) {
      c.fillStyle = k.col('#2a2420'); c.globalAlpha = 0.28;
      c.beginPath(); c.moveTo(x - w / 2 + 4, y + 12); c.lineTo(x + w / 2 - 4, y + 12); c.lineTo(x + w / 2 - 14, y + 30); c.lineTo(x - w / 2 + 14, y + 30); c.closePath(); c.fill();
      c.globalAlpha = 1;
      c.fillStyle = k.col(h.kind === 'crumble' ? '#c4b394' : '#a8987a');
      c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.lineTo(x + w / 2 - 6, y + 13); c.lineTo(x - w / 2 + 6, y + 13); c.closePath(); c.fill();
      c.fillStyle = k.col('#d8ccb2'); c.fillRect(x - w / 2 + 2, y, w - 4, 3);
      c.fillStyle = k.col('#5e5446'); c.fillRect(x - w / 2 + 6, y + 11, w - 12, 5);
      if (h.kind === 'crumble') {
        c.strokeStyle = k.col('#6f6a5e'); c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(x - 12, y + 1); c.lineTo(x - 4, y + 7); c.lineTo(x + 2, y + 2); c.lineTo(x + 10, y + 11); c.stroke();
      }
    }
    if (h.pearl && !h.taken) {
      const by = y - 6 + Math.sin(t * 3 + i) * 3;
      if (!k.asset('pearl', x, by, 22, 22)) { c.fillStyle = k.col('#efe9f2'); k.circle(x, by - 10, 9); c.fillStyle = k.col('#ffffff'); k.circle(x - 3, by - 13, 3); }
    }
  });
}

// A grip in the painted ivy: a twist of vine with three leaves, its top at y.
function ivyGrip(k, x, y, dry, t) {
  const c = k.c;
  c.save(); c.translate(x, y); c.scale(1.35, 1.35);
  // a pale rim, so the grip reads against the painted ivy
  c.strokeStyle = k.col('#f1e3c8'); c.globalAlpha = 0.55; c.lineWidth = 9; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-20, 6); c.quadraticCurveTo(-6, -6, 0, 2); c.quadraticCurveTo(8, 10, 20, -2); c.stroke();
  c.globalAlpha = 1;
  c.strokeStyle = k.col(dry ? '#8a6a3a' : '#5a3e24'); c.lineWidth = 5;
  c.beginPath(); c.moveTo(-20, 6); c.quadraticCurveTo(-6, -6, 0, 2); c.quadraticCurveTo(8, 10, 20, -2); c.stroke();
  c.strokeStyle = k.col(dry ? '#c9a36a' : '#8a6a44'); c.lineWidth = 2;
  c.beginPath(); c.moveTo(-18, 4); c.quadraticCurveTo(-6, -7, 0, 0); c.stroke();
  const leaf = dry ? ['#b88a4a', '#9a7038', '#c79a5a'] : ['#3f6a4a', '#2f5a52', '#5a8a5a'];
  [[-14, -2, -0.6], [2, -6, 0.2], [15, -4, 0.9]].forEach(([lx, ly, r], j) => {
    c.save(); c.translate(lx, ly); c.rotate(r + Math.sin(t * 2 + j) * 0.08);
    c.fillStyle = k.col(leaf[j]); c.beginPath(); c.ellipse(0, -6, 6, 9, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  });
  c.restore();
}

// What a press would do, shown on the cliff while he waits on a hold: every
// hold within reach glows gold with an arrow for the way to press, the hold
// A would leap to is joined by a dotted arc with the A button on it, and a
// press that finds nothing flashes a cross on that side.
const ARROW = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export function climbGuide(k, st, t) {
  if (st.wall || st.phase !== 'cliff' || st.defeatT != null) return;
  const c = k.c, cl = st.cl, pos = climberPos(st);
  const bump = cl.bump;
  if (bump) {
    const a = bump.t / 0.4, bx = pos.x + bump.dir.x * 70, by = -pos.y - 60 - bump.dir.y * 70;
    c.save(); c.globalAlpha = a; c.strokeStyle = k.col('#c8321e'); c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(bx - 11, by - 11); c.lineTo(bx + 11, by + 11); c.moveTo(bx + 11, by - 11); c.lineTo(bx - 11, by + 11); c.stroke();
    c.restore();
  }
  if (pos.moving) return;
  const opts = climbOptions(st, cl.aim);
  const byHold = new Map();
  for (const name of ['up', 'left', 'right', 'down']) {
    const i = opts[name];
    if (i < 0) continue;
    if (!byHold.has(i)) byHold.set(i, []);
    byHold.get(i).push(name);
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  // the leap: a dotted arc to its hold, the A button at the top
  if (opts.leap >= 0) {
    const h = st.holds[opts.leap], hx = h.x, hy = -holdY(h, st.beat || 0) - 4;
    const ax = pos.x, ay = -pos.y - 40, mx = (ax + hx) / 2, my = Math.min(ay, hy) - 70;
    c.save(); c.strokeStyle = k.col('#f1e3c8'); c.lineWidth = 3; c.setLineDash([7, 9]); c.lineDashOffset = -t * 30;
    c.globalAlpha = 0.75; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, my, hx, hy); c.stroke(); c.setLineDash([]);
    c.globalAlpha = 0.5 + 0.3 * pulse; c.strokeStyle = k.col('#f1e3c8'); c.lineWidth = 3;
    c.beginPath(); c.ellipse(hx, hy + 6, 34, 15, 0, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1; c.font = '700 20px "Josefin Sans", sans-serif'; c.textAlign = 'center'; c.fillStyle = k.col('#f1e3c8');
    richText(c, '[A]', (ax + 2 * mx + hx) / 4, (ay + 2 * my + hy) / 4 + 6, { px: 20, mode: k.inputMode || 'key', col: k.col });
    c.restore();
  }
  for (const [i, names] of byHold) {
    const h = st.holds[i];
    const x = h.x, y = -holdY(h, st.beat || 0);
    const w = h.kind === 'ledge' || h.kind === 'boot' ? 60 : 34;
    c.save();
    if (h.kind !== 'top') {  // the grass needs no ring, only its arrow
      c.globalAlpha = 0.28 + 0.22 * pulse; c.fillStyle = k.col('#d9b34a');
      c.beginPath(); c.ellipse(x, y + 6, w + 10, 18, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 0.9; c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 3;
      c.beginPath(); c.ellipse(x, y + 6, w + 4, 14, 0, 0, Math.PI * 2); c.stroke();
    }
    names.forEach((n, j) => {
      const [dx, dy] = ARROW[n], ox = x + (j - (names.length - 1) / 2) * 30, oy = y - 34;
      c.save(); c.translate(ox, oy + Math.sin(t * 5) * 3); c.rotate(Math.atan2(dy, dx));
      c.globalAlpha = 1; c.fillStyle = k.col('#2a1424');
      c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.fill();
      c.fillStyle = k.col('#f1d27a');
      c.beginPath(); c.moveTo(9, 0); c.lineTo(-5, -8); c.lineTo(-2, 0); c.lineTo(-5, 8); c.closePath(); c.fill();
      c.restore();
    });
    c.restore();
  }
}

export function climber(k, st, t) {
  const c = k.c;
  if (st.phase === 'storm') {
    // He walks to the door.
    const x = lerp(st.walkFromX, HOUSE.door + 30, easeInOut(st.phaseT / 1.3));
    const walking = st.phaseT < 1.3;
    // on the painted floor edge (HOUSE.floors[0]), 14 px above the cliff line, when the art is hung
    sailor(k, x, -CLIFF.top - (k.img('stone-house') ? 640 - HOUSE.floors[0] : 0), S, walking ? 'walk' : 'stand', -1, walking ? walkStep(st.phaseT * 150) : 0, walking ? st.phaseT * 150 : null);
    return;
  }
  if (st.wall) return wallClimber(k, st, t);
  const p = climberPos(st), cl = st.cl, h = st.holds[cl.at];
  let y = -p.y;
  let tilt = 0;
  if (st.defeatT != null) { y += st.defeatT * st.defeatT * 500; tilt = st.defeatT * 2; }
  const face = h.x < (cl.fromX ?? h.x) ? -1 : 1;
  c.save();
  if (st.inv > 0 && Math.floor(st.inv * 10) % 2) c.globalAlpha = 0.45;
  if (tilt) { c.translate(p.x, y - 50); c.rotate(tilt); c.translate(-p.x, -(y - 50)); }
  const pose = cliffPose(st, p, h);
  sailor(k, p.x, y, S, pose, face);
  c.restore();
}

// ---------------------------------------------------------------- the continuous climb
// On the face: the dry ivy that tears if he lingers in it (shivering as it
// goes), and the pearls. The painted cloth is the rest: he climbs it all.
function wallThings(k, st, t) {
  const c = k.c, cam = st.camY, w = st.wall;
  w.crumbles.forEach((cr, i) => {
    if (cr.y < cam - 140 || cr.y > cam + 760) return;
    const shake = cr.t > 0 ? Math.sin(t * 60) * 2.5 * Math.min(1, cr.t / CLIMB.crumble * 2) : 0;
    if (!st.part) {
      // this edition's loose rock: a cracked hold that gives way, then its scar
      if (cr.gone) { if (!k.asset('cliff-hold-gone', cr.x, -cr.y + 12, 40, 12)) { c.fillStyle = k.col('#7d7262'); c.fillRect(cr.x - 16, -cr.y + 2, 32, 5); } return; }
      for (const [dx, dy] of [[-14, 6], [16, -10]]) if (!k.asset('cliff-hold-crumble', cr.x + dx + shake, -cr.y + dy + 20, 50, 20)) { c.fillStyle = k.col('#c4b394'); c.fillRect(cr.x + dx - 22 + shake, -cr.y + dy, 44, 12); }
      return;
    }
    if (cr.gone) return;
    // Ivy is already painted on the cloth; its instability is loose grit.
    if (cr.t > 0) rockfallDust(k,cr.x+shake,-cr.y-30,t,.45,i);
  });
  // the tiny guitarist plays on a knob in the cleft: under him, stones glance off
  if (st.shelter && st.shelter.y > cam - 140 && st.shelter.y < cam + 760) {
    const g = st.shelter, y = -g.y;
    if (!k.asset('cliff-hold', g.x, y - 124 + 20, 50, 20)) { c.fillStyle = k.col('#8d8170'); c.fillRect(g.x - 22, y - 124, 44, 8); }
    tinyGuitarist(k, g.x, y - 124, t, st.beat || 0);
  }
  w.pearls.forEach((p, i) => {
    if (p.taken || p.y < cam - 140 || p.y > cam + 760) return;
    const by = -p.y - 8 + Math.sin(t * 3 + i) * 3;
    c.save(); c.globalAlpha = 0.3 + 0.15 * Math.sin(t * 4 + i); c.fillStyle = k.col('#fff2b0'); k.circle(p.x, by - 11, 18); c.restore();
    if (!k.asset('pearl', p.x, by, 22, 22)) { c.fillStyle = k.col('#efe9f2'); k.circle(p.x, by - 10, 9); }
  });
}

// The climbing frames (F19), drawn at the movement frames' scale; until
// they arrive, the earlier climbing, hanging and landing frames stand in.
const WALL_STANDIN = {
  'wall-up-a': 'climb-a', 'wall-up-b': 'climb-b', 'wall-up-c': 'climb-b', 'wall-up-d': 'climb-a',
  'wall-side-a': 'climb-a', 'wall-side-b': 'climb-b', 'wall-side-c': 'climb-a', 'wall-side-d': 'climb-b',
  'wall-idle': 'climb-a', 'wall-idle-b': 'climb-a', 'wall-leap': 'apex', 'wall-catch': 'climb-b', 'wall-hit': 'climb-a',
  'wall-step': 'climb-a', 'mantle-a': 'hang', 'mantle-b': 'pullup', 'mantle-c': 'land',
};
// A frame of the set, or while the set is still arriving the nearest one
// delivered: up-c and up-d are up-a and up-b mirrored (as requested), and
// the traverse, the idles, the spring, the catch and the jolt borrow the
// climbing cycle, so the back view never flips to a profile mid-climb.
const WALL_MIRROR = { 'wall-up-c': 'wall-up-a', 'wall-up-d': 'wall-up-b' };
const WALL_BORROW = {
  'wall-side-a': ['wall-up-a', false], 'wall-side-b': ['wall-up-b', false], 'wall-side-c': ['wall-up-a', true], 'wall-side-d': ['wall-up-b', true],
  'wall-idle': ['wall-up-b', false], 'wall-idle-b': ['wall-up-b', true], 'wall-leap': ['wall-up-a', false],
  'wall-catch': ['wall-up-b', false], 'wall-hit': ['wall-up-b', false], 'wall-step': ['wall-up-b', false],
};
function wallFrame(k, kind) {
  if (!FILM) return [null, false];   // the other editions climb as the sailor, on his frames
  if (k.img('prince-' + kind)) return ['prince-' + kind, false];
  const m = WALL_MIRROR[kind];
  if (m && k.img('prince-' + m)) return ['prince-' + m, true];
  const b = WALL_BORROW[kind];
  if (b) {
    const [bk, bm] = b;
    if (k.img('prince-' + bk)) return ['prince-' + bk, bm];
    if (WALL_MIRROR[bk] && k.img('prince-' + WALL_MIRROR[bk])) return ['prince-' + WALL_MIRROR[bk], !bm];
  }
  return [null, false];
}

function wallClimber(k, st, t) {
  const c = k.c, w = st.wall, pose = wallPose(w);
  let x = w.x, y = -w.y, tilt = 0;
  if (st.defeatT != null) { y += st.defeatT * st.defeatT * 500; tilt = st.defeatT * 2; }
  c.save();
  if (st.inv > 0 && Math.floor(st.inv * 10) % 2) c.globalAlpha = 0.45;
  if (tilt) { c.translate(x, y - 50); c.rotate(tilt); c.translate(-x, -(y - 50)); }
  const face = w.face || 1, H = 180 * S, sc = H / 360;
  if (st.defeatT != null) { sailor(k, x, y, S, 'fall', face); c.restore(); return; }
  if (pose.kind === 'walk' || pose.kind === 'stand' || pose.kind === 'land' || pose.kind === 'fall') {
    sailor(k, x, y, S, pose.kind === 'walk' ? 'walk' : pose.kind, face, 0, pose.kind === 'walk' ? w.dist : null);
    c.restore(); return;
  }
  // the back-view frames face the wall, so only the traverse turns to go left
  const own = pose.kind.startsWith('wall-side') || pose.kind === 'mantle-c' || pose.kind === 'wall-step' ? face : 1;
  const shake = pose.kind === 'wall-hit' ? Math.sin(t * 70) * 3 : 0;
  const [id, mirror] = wallFrame(k, pose.kind);
  if (id) {
    const flip = (mirror ? -1 : 1) * (id === 'prince-' + pose.kind ? own : 1);
    c.save(); c.translate(x + shake, y); c.scale(flip, 1);
    k.asset(id, 0, 0, 360 * sc, 440 * sc);
    c.restore();
  } else {
    const alt = WALL_STANDIN[pose.kind];
    if (alt === 'hang' || alt === 'pullup') {
      // the profile hang and pull-up frames, his hands at the ledge's lip
      const hid = 'sailor-' + alt, hw = alt === 'hang' ? 67 : 79, hh = alt === 'hang' ? 134 : 91;
      const s2 = H / 110;
      c.save(); c.translate(x, y + (alt === 'hang' ? -CLIMB.hands - 6 : 0)); c.scale(face, 1);
      if (!k.asset(hid, 0, alt === 'hang' ? hh * s2 : 0, hw * s2, hh * s2)) sailor(k, 0, 0, S, 'climb-a', 1);
      c.restore();
    } else sailor(k, x + shake, y, S, alt, face);
  }
  c.restore();
}

export function rocksWorld(k, st, t) {
  const c = k.c;
  for (const r of st.rocks) {
    if (r.y == null) continue;
    rockfallTrail(k,r,t);
    // The film edition: one stone block from the debris painting (the whole
    // cut-out is a collapsing wall in a dust cloud, which read as a pink
    // blob whirling past), turning slowly as it falls.
    c.save(); c.translate(r.x, -r.y); c.rotate(r.spin + t * (FILM ? 2.2 : 7));
    if (FILM && k.img('debris-stones') && k.assetCrop('debris-stones', 200, 8, 56, 50, -17, -15, 34, 30)) { c.restore(); continue; }
    if (!k.asset('debris-stones', 0, 22, 60, 40)) {
      c.fillStyle = k.col('#8d8f91');
      c.beginPath(); c.moveTo(-18, -6); c.lineTo(-6, -18); c.lineTo(14, -14); c.lineTo(20, 4); c.lineTo(6, 18); c.lineTo(-14, 14); c.closePath(); c.fill();
      c.fillStyle = k.col('#5a5c5e'); c.fillRect(-6, 2, 14, 6);
    }
    c.restore();
  }
}

// Dust gathering at the top of the frame over a stone about to fall, and the
// tea-leaf omen a beat earlier when the reading is complete.
export function rockWarnings(k, st, t) {
  for (const r of st.rocks) {
    if (r.y != null) continue;
    // The bonus still grants its earlier tell, now through the same natural
    // dust emitter instead of a circled token laid over the scenery.
    const lead = r.warn + (r.omen ? BEAT_S : 0);
    if (r.wait > lead) continue;
    const intensity = .25 + .75 * clamp(1-r.wait/lead,0,1);
    rockfallDust(k,r.x,124,t,intensity,r.spin*100);
  }
}

function stormFx(k, st, t) {
  const c = k.c, pt = st.phaseT;
  if (pt > 0.95 && pt < 1.3) {
    c.strokeStyle = k.col('#fff6d0'); c.lineWidth = 5;
    // It lands on the roof, about (740, 110) once the camera is up. The roof
    // sits just under the valance, so the bolt comes in at a slant across the
    // open sky to its right.
    const ex = 740, ey = 110 + (st.camY - CLIFF.top);
    c.beginPath(); c.moveTo(ex + 250, ey - 62);
    for (const [dx, dy] of [[196, -40], [214, -33], [150, -22], [164, -14], [84, -8], [96, -2], [0, 0]]) c.lineTo(ex + dx, ey + dy);
    c.stroke();
  }
  if (st.fire > 0.05) flames(k, st, t, st.fire);
}

// ---------------------------------------------------------------- the house
// The front swings open on its left hinge like a dollhouse front.
function frontPanel(k, open, t) {
  const c = k.c, H = HOUSE;
  const sx = Math.cos(open * 1.76); // past 90 degrees: it ends up left of the hinge
  c.save(); c.translate(H.x0 - 14, 0); c.scale(sx, 1); c.translate(-(H.x0 - 14), 0);
  if (!k.asset('house-front', ...HOUSE_ART)) {
    c.fillStyle = k.col('#9a948a');
    c.beginPath(); c.moveTo(H.x0 - 14, 642); c.lineTo(H.x0 - 14, 112); c.lineTo(640, 40); c.lineTo(H.x1 + 14, 112); c.lineTo(H.x1 + 14, 642); c.closePath(); c.fill();
    c.strokeStyle = k.col('#77716a'); c.lineWidth = 1.5;
    for (let y = 130; y < 640; y += 28) { c.beginPath(); c.moveTo(H.x0 - 12, y); c.lineTo(H.x1 + 12, y); c.stroke(); for (let x = H.x0 + ((y / 28) % 2) * 30; x < H.x1; x += 60) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 28); c.stroke(); } }
    c.fillStyle = k.col('#5a3a2a'); c.beginPath(); c.moveTo(H.x0 - 30, 116); c.lineTo(640, 30); c.lineTo(H.x1 + 30, 116); c.lineTo(H.x1 + 30, 126); c.lineTo(640, 44); c.lineTo(H.x0 - 30, 126); c.closePath(); c.fill();
    // ivy
    c.fillStyle = k.col('#4f7a3e');
    for (let i = 0; i < 16; i++) k.circle(H.x0 + 10 + (i * 37) % 120, 640 - ((i * 53) % 420), 14 + (i % 3) * 5);
    for (let i = 0; i < 8; i++) k.circle(H.x1 - 20 - (i * 29) % 70, 640 - ((i * 71) % 300), 12 + (i % 3) * 4);
    // the wooden door with iron hinges
    c.fillStyle = k.col('#6b4024');
    c.beginPath(); c.moveTo(H.door - 2, 642); c.lineTo(H.door - 2, 540); c.quadraticCurveTo(H.door + 34, 505, H.door + 70, 540); c.lineTo(H.door + 70, 642); c.closePath(); c.fill();
    c.fillStyle = k.col('#1a1416'); c.fillRect(H.door, 556, 60, 6); c.fillRect(H.door, 606, 60, 6); k.circle(H.door + 58, 590, 4);
    // windows: the shuttered one on the middle floor, a small one at the top
    c.fillStyle = k.col('#6b4024'); c.fillRect(FRONT_WINDOW_X, 316, 70, 96);
    c.strokeStyle = k.col('#3a2112'); c.lineWidth = 2; c.strokeRect(FRONT_WINDOW_X, 316, 70, 96); c.beginPath(); c.moveTo(FRONT_WINDOW_X + 35, 316); c.lineTo(FRONT_WINDOW_X + 35, 412); c.stroke();
    c.fillStyle = k.col('#2a1a22'); c.fillRect(612, 160, 56, 66);
    c.fillStyle = k.col('#3a2112'); c.fillRect(612, 190, 56, 4); c.fillRect(638, 160, 4, 66);
  }
  if (open > 0) { c.fillStyle = k.col('#000000'); c.globalAlpha = 0.45 * open; c.fillRect(H.x0 - 14, 30, H.x1 - H.x0 + 28, 612); }
  c.restore();
}

// The delivered house art (1400 x 1800) drawn so its painted floor edges
// (y 236, 420, 612 at the old 560 x 720 size) land on HOUSE.floors.
const HOUSE_ART = [640, 654, 518, 666];
// HOUSE.shutterX/Y is the centre of the shutter painted in stone-house.webp:
// the teal leaves span x 643-816, y 863-1026 of the 1400 x 1800 art, which
// HOUSE_ART maps to stage x 619-683, y 307-368 (centre 651, 337).
// The closed front's stand-in window (frontPanel) keeps its old place.
const FRONT_WINDOW_X = 830;

const ROOM = [
  { col: '#b98a5e', y0: 452, y1: 626 },
  { col: '#a0607a', y0: 278, y1: 452 },
  { col: '#7d86a8', y0: 112, y1: 278 },
];

function houseInterior(k, st, t) {
  const c = k.c, H = HOUSE;
  const painted = k.asset('stone-house', ...HOUSE_ART);
  if (!painted) {
    // shell and roof
    c.fillStyle = k.col('#77716a'); c.fillRect(H.x0 - 14, 112, 14, 530); c.fillRect(H.x1, 112, 14, 530);
    c.fillStyle = k.col('#2a1a22'); c.beginPath(); c.moveTo(H.x0 - 14, 112); c.lineTo(640, 40); c.lineTo(H.x1 + 14, 112); c.closePath(); c.fill();
    c.fillStyle = k.col('#5a3a2a'); c.beginPath(); c.moveTo(H.x0 - 30, 116); c.lineTo(640, 30); c.lineTo(H.x1 + 30, 116); c.lineTo(H.x1 + 30, 126); c.lineTo(640, 44); c.lineTo(H.x0 - 30, 126); c.closePath(); c.fill();
    for (const r of ROOM) {
      c.fillStyle = k.col(r.col); c.fillRect(H.x0, r.y0, H.x1 - H.x0, r.y1 - r.y0);
      c.fillStyle = k.col('#000000'); c.globalAlpha = 0.12;
      for (let x = H.x0 + 20; x < H.x1; x += 40) c.fillRect(x, r.y0, 12, r.y1 - r.y0);
      c.globalAlpha = 1;
    }
    // windows onto the burning night
    c.fillStyle = k.col('#e9a46a'); c.fillRect(680, 490, 60, 70); c.fillRect(740, 150, 64, 76);
    c.fillStyle = k.col('#3a2112'); c.fillRect(708, 490, 4, 70); c.fillRect(680, 523, 60, 4); c.fillRect(770, 150, 4, 76); c.fillRect(740, 186, 64, 4);
    // furniture silhouettes
    c.fillStyle = k.col('#2a1a12');
    c.fillRect(800, 566, 60, 60); c.fillRect(812, 520, 10, 46);                    // the stove
    c.fillRect(470, 584, 90, 8); c.fillRect(478, 592, 6, 34); c.fillRect(546, 592, 6, 34); // the table
    c.fillRect(520, 408, 44, 44); c.fillRect(516, 380, 8, 72);                     // the armchair
    c.fillRect(680, 360, 26, 92); k.circle(693, 372, 10);                          // the clock
    c.fillRect(520, 244, 110, 34); c.fillRect(520, 226, 12, 52);                   // the bed
    c.fillStyle = k.col('#f1e3c8'); c.fillRect(534, 238, 90, 8);
    c.fillStyle = k.col('#6b4024'); c.fillRect(746, 262, 56, 16);                  // the window seat
  }
  // the locked shutter on the middle floor, at the right
  shutter(k, st, t);
  // connectors
  for (const cn of st.conns) connector(k, st, cn, t);
  // what has fallen away
  if (st.broke) rubble(k, st, t);
  // floors
  H.floors.forEach((fy, f) => {
    for (const [a, b] of painted ? [] : st.spans[f]) {
      c.fillStyle = k.col('#7a4a26'); c.fillRect(a, fy, b - a, 14);
      c.fillStyle = k.col('#a0703e'); c.fillRect(a, fy, b - a, 3);
      c.fillStyle = k.col('#2a1a12');
      if (a > H.x0) { c.beginPath(); c.moveTo(a, fy); c.lineTo(a + 12, fy + 7); c.lineTo(a, fy + 14); c.closePath(); c.fill(); }
      if (b < H.x1) { c.beginPath(); c.moveTo(b, fy); c.lineTo(b - 12, fy + 7); c.lineTo(b, fy + 14); c.closePath(); c.fill(); }
    }
    // burnt holes: planks hang from their broken edges, embers below
    if (f > 0) for (let g = 0; g < st.spans[f].length - 1; g++) {
      const gx0 = st.spans[f][g][1], gx1 = st.spans[f][g + 1][0];
      // art: the gap + 24 wide, its top 12 above the floor line (planks and embers are painted in)
      const holeArt = k.asset('floor-hole', (gx0 + gx1) / 2, fy - 12 + 60, gx1 - gx0 + 24, 60);
      if (painted && !holeArt) { c.fillStyle = k.col('#1a0c08'); c.fillRect(gx0, fy - 12, gx1 - gx0, 36); } // the painted floor burnt through
      c.fillStyle = k.col('#3a2112');
      if (!holeArt) for (const [ex, dir] of [[gx0, 1], [gx1, -1]]) { c.save(); c.translate(ex, fy + 4); c.rotate(dir * 1.1); c.fillRect(dir > 0 ? 0 : -34, -4, 34, 8); c.restore(); }
    }
  });
  // in-room flames on sticks (not in the way)
  for (const [x, y, s] of [[615, H.floors[1] + 22, 0.55], [830, 566, 0.32], [892, H.floors[2], 0.36], [404, H.floors[2], 0.42], [404, H.floors[1], 0.36]]) flameFlat(k, x, y, s, t + x);
  if (!st.p.carry) beloved(k, H.beloved, H.floors[2], S, -1, Math.sin(t * 5) > 0.3 ? 'reach' : 'down');
}

function shutter(k, st, t) {
  const c = k.c, cx = HOUSE.shutterX + (st.lockedT > 0 ? Math.sin(t * 70) * 2 : 0), cy = HOUSE.shutterY;
  const x = cx - 26, y = cy - 56;
  // art 55 x 115, centred on the painted shutter
  if (!k.asset(st.shutter === 'shut' ? 'shutter-shut' : 'shutter-smashed', cx, cy + 57.5, 55, 115)) {
    // Shut, the shutter painted on the delivered house shows as it is.
    if (st.shutter === 'shut' && k.img('stone-house')) { /* the painted one */ }
    else if (st.shutter === 'shut') {
      c.fillStyle = k.col('#6b4024'); c.fillRect(x, y, 52, 112);
      c.strokeStyle = k.col('#3a2112'); c.lineWidth = 2;
      for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(x, y + i * 22); c.lineTo(x + 52, y + i * 22); c.stroke(); }
      c.fillStyle = k.col('#1a1416'); c.fillRect(x + 20, y + 50, 14, 12); // the lock
    } else {
      c.fillStyle = k.col('#e9a46a'); c.fillRect(x, y, 52, 112);
      c.fillStyle = k.col('#3a2112');
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 14, y + 30); c.lineTo(x, y + 60); c.fill();
      c.beginPath(); c.moveTo(x + 52, y + 112); c.lineTo(x + 38, y + 80); c.lineTo(x + 52, y + 50); c.fill();
    }
  }
  // the stone in flight
  if (st.throwT != null && st.throwT < 0.35) {
    const kk = st.throwT / 0.35, sx = lerp(st.p.x, cx, kk), syy = lerp(st.p.y - 70, cy, kk) - Math.sin(Math.PI * kk) * 40;
    if (!k.asset('keepsake-stone', sx, syy + 12, 24, 24)) { c.fillStyle = k.col('#8d8f91'); k.circle(sx, syy, 7); }
  }
}

// The painted rails fill the bottom 62.4% of ladder.webp (alpha y 188-500 of
// 500), so the art is drawn taller than the climb to make the rails span it.
const LADDER_RAILS = 312 / 500, LADDER_W = 52;

export function connector(k, st, cn, t) {
  const c = k.c, H = HOUSE;
  const ya = H.floors[cn.a.f], yb = H.floors[cn.b.f];
  if (cn.id === 'ladderDown' || cn.id === 'ladderDown2') {
    if (!cn.on) return;
    // It drops on its hinge at the top (the second just after the first).
    const drop = (st.ladderDropT ?? 1) - (cn.id === 'ladderDown2' ? 0.45 : 0);
    if (drop < 0) return;
    const a = (1 - easeOut(clamp(drop / 0.6, 0, 1))) * (Math.PI / 2);
    // hinged at the top of the painted rails, hanging down to the lower floor
    c.save(); c.translate(cn.b.x, yb - 4); c.rotate(a);
    if (!k.asset('ladder', 0, ya - yb + 8, LADDER_W, (ya - yb + 8) / LADDER_RAILS)) ladderShape(k, 0, ya - yb + 8, 0);
    c.restore();
    return;
  }
  if (!cn.on) return;
  if (cn.kind === 'ladder') { if (!k.asset('ladder', cn.a.x, ya + 4, LADDER_W, (ya - yb + 8) / LADDER_RAILS)) ladderShape(k, cn.a.x, ya + 4, yb - 4); return; }
  if (cn.kind === 'ivy' && k.img('ivy-climb')) {
    // tiled upward from the lower floor along the span, 40 wide (art 80 x 400, so 40 x 200 a tile)
    c.save(); c.beginPath(); c.rect(cn.a.x - 30, yb - 10, 60, ya - yb + 10); c.clip();
    for (let y = ya; y > yb - 10; y -= 200) k.asset('ivy-climb', cn.a.x, y, 40, 200);
    c.restore();
    return;
  }
  if (cn.kind === 'ivy') {
    c.strokeStyle = k.col('#3f6a3a'); c.lineWidth = 5;
    c.beginPath(); for (let y = ya; y >= yb - 10; y -= 12) c.lineTo(cn.a.x + Math.sin(y * 0.12) * 8, y); c.stroke();
    c.fillStyle = k.col('#5f8c4a');
    for (let y = ya - 6; y > yb; y -= 18) { k.circle(cn.a.x + Math.sin(y * 0.12) * 8 + 9, y, 6); k.circle(cn.a.x + Math.sin(y * 0.12) * 8 - 9, y - 8, 6); }
    return;
  }
  if (cn.kind === 'stairs') {
    if (k.asset('staircase', (cn.a.x + cn.b.x) / 2, ya + 4, cn.b.x - cn.a.x + 40, ya - yb + 8)) return;
    c.strokeStyle = k.col('#5a3a1e'); c.lineWidth = 10;
    c.beginPath(); c.moveTo(cn.a.x - 16, ya + 6); c.lineTo(cn.b.x, yb + 10); c.stroke();
    c.fillStyle = k.col('#8a5a32');
    const n = 9;
    for (let i = 0; i < n; i++) { const kk = (i + 0.5) / n; c.fillRect(lerp(cn.a.x, cn.b.x, kk) - 14, lerp(ya, yb, kk) - 2, 28, 6); }
    c.strokeStyle = k.col('#3a2112'); c.lineWidth = 3;
    c.beginPath(); c.moveTo(cn.a.x, ya - 60); c.lineTo(cn.b.x, yb - 60); c.stroke();
    for (let i = 0; i <= 4; i++) { const kk = i / 4; c.beginPath(); c.moveTo(lerp(cn.a.x, cn.b.x, kk), lerp(ya, yb, kk) - 60); c.lineTo(lerp(cn.a.x, cn.b.x, kk), lerp(ya, yb, kk)); c.stroke(); }
    return;
  }
  if (cn.kind === 'slope') {
    // a broken floor section, slanting down to the ground floor
    c.save(); c.translate(cn.b.x, yb); c.rotate(Math.atan2(ya - yb, cn.a.x - cn.b.x));
    const len = Math.hypot(cn.a.x - cn.b.x, ya - yb);
    // art: stretched to the slope's length, pivot at the left end, top on the line
    if (!k.asset('floor-slope', len / 2, 28 - 2, len, 28)) {
      c.fillStyle = k.col('#7a4a26'); c.fillRect(-4, 0, len + 8, 14);
      c.fillStyle = k.col('#a0703e'); c.fillRect(-4, 0, len + 8, 3);
      c.fillStyle = k.col('#2a1a12'); for (let s = 20; s < len; s += 34) c.fillRect(s, 3, 3, 11);
    }
    c.restore();
  }
}

function ladderShape(k, x, by, ty) {
  const c = k.c;
  c.fillStyle = k.col('#6b4024'); c.fillRect(x - 20, ty, 6, by - ty); c.fillRect(x + 14, ty, 6, by - ty);
  c.fillStyle = k.col('#8a5a32');
  for (let y = by - 16; y > ty; y -= 24) c.fillRect(x - 18, y, 36, 5);
  c.fillStyle = k.col('#2a1a12'); c.globalAlpha = 0.4; c.fillRect(x - 20, ty, 40, (by - ty) * 0.25); c.globalAlpha = 1;
}

export function rubble(k, st, t) {
  const c = k.c;
  if (!k.asset('rubble-planks', 650, HOUSE.floors[0], 150, 40)) {
    c.fillStyle = k.col('#3a2112');
    for (const [x, y, w, a] of [[600, 616, 120, -0.3], [660, 612, 90, 0.4], [700, 618, 70, -0.1]]) { c.save(); c.translate(x, y); c.rotate(a); c.fillRect(-w / 2, -5, w, 10); c.restore(); }
  }
  // the burnt ladder stub, standing on the middle floor under the ladder's top
  if (!k.asset('ladder-stub', 450, HOUSE.floors[1], 20, 55)) { c.fillStyle = k.col('#1a1012'); c.fillRect(444, 400, 12, 52); }
}

// A painted stage flame on a stick.
function flameFlat(k, x, by, s, phase) {
  const c = k.c, f = 1 + Math.sin(phase * 3.1 + kT(k) * 11) * 0.08;
  if (k.asset('flame-flat', x, by, 150 * s, 200 * s * f)) return;
  c.fillStyle = k.col('#3a2112'); c.fillRect(x - 3 * s, by - 40 * s, 6 * s, 40 * s);
  const layer = (col, w, h) => { c.fillStyle = k.col(col); c.beginPath(); c.moveTo(x - w * s, by - 30 * s); c.quadraticCurveTo(x - w * s, by - (h * 0.6) * s * f, x + 6 * s * Math.sin(phase), by - h * s * f); c.quadraticCurveTo(x + w * s, by - (h * 0.6) * s * f, x + w * s, by - 30 * s); c.closePath(); c.fill(); };
  layer('#c8321e', 50, 190); layer('#e9a46a', 34, 140); layer('#d9b34a', 18, 90);
}
const kT = (k) => k.t || 0;

// Flame flats rolling across the front, and smoke flats over the top.
export function flames(k, st, t, amt = 1, { right = 1, left = 1 } = {}) {
  const c = k.c;
  c.save(); c.globalAlpha = Math.min(1, amt);
  for (let i = 0; i < 2; i++) {
    const x = ((t * 34 + i * 820) % 1700) - 210, y = 150 + i * 70;
    // Translucent, so the sailor stays visible as it drifts over the floors.
    c.globalAlpha = 0.6 * Math.min(1, amt);
    const drawn = k.asset('smoke-flat', x, y + 100, 400, 200);
    c.globalAlpha = Math.min(1, amt);
    if (!drawn) {
      c.fillStyle = k.col('#6d5a72'); c.globalAlpha = 0.55 * amt;
      c.beginPath(); c.ellipse(x - 90, y + 10, 110, 50, 0, 0, Math.PI * 2); c.ellipse(x + 40, y - 10, 130, 66, 0, 0, Math.PI * 2); c.ellipse(x + 170, y + 14, 100, 46, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = Math.min(1, amt);
    }
  }
  const rise = 1 - easeOut(amt);
  for (let i = 0; i < 6; i++) {
    const x = [190, 290, 1000, 1100, 250, 1050][i] + Math.sin(t * 0.8 + i) * 22;
    const clearing = x > 900 ? clamp(right,0,1) : clamp(left,0,1);
    if (clearing <= 0) continue;
    c.globalAlpha = Math.min(1, amt) * clearing;
    flameFlat(k, x, 672 + rise * 160 + (i > 3 ? 20 : 0),
      (i > 3 ? 0.9 : 0.7) * (.25 + .75 * clearing), t + i);
  }
  c.restore();
}

function houseScene(k, st, t) {
  bay(k, st, t, 1);
  houseInterior(k, st, t);
  hazards(k, st, t);
  player(k, st, t);
  flames(k, st, t, 1);
  frontPanel(k, 1, t);
}

export function hazards(k, st, t) {
  const c = k.c, quay = st.phase === 'quay';
  for (const h of st.haz) {
    const fy = quay ? QUAY.y : HOUSE.floors[h.f];
    const ceil = quay ? 130 : Math.max(132, fy - HOUSE.storey + 14);
    if (h.wait > 0) {
      const lead = h.warn + (h.omen ? BEAT_S : 0);
      if (h.wait > lead) continue;
      rockfallDust(k,h.x,ceil,t,.3+.7*clamp(1-h.wait/lead,0,1),h.x);
      if (h.wait > h.warn) continue;
      // shudder and dust
      const kk = 1 - h.wait / h.warn;
      c.save(); c.globalAlpha = 0.6;
      c.fillStyle = k.col('#f1e3c8');
      for (let i = 0; i < 5; i++) { const py = ceil + 6 + ((t * 200 + i * 33) % (20 + kk * (fy - ceil - 30))); k.circle(h.x - 30 + i * 15, py, 3); }
      c.globalAlpha = 0.25 + 0.2 * kk; c.fillStyle = k.col('#2a1424');
      c.beginPath(); c.ellipse(h.x, fy + 2, (h.kind === 'beam' ? 72 : 44) * (0.6 + 0.4 * kk), 6, 0, 0, Math.PI * 2); c.fill();
      c.restore();
      const shake = Math.sin(t * 55) * 2 * kk;
      fallingPiece(k, h, h.x + shake, ceil - 6, 0);
      continue;
    }
    if (!h.landed) { fallingPiece(k, h, h.x, lerp(ceil - 6, fy - 12, h.fallT / HOUSE.beamFall), 0.1); continue; }
    c.save(); c.globalAlpha = clamp(h.life / 0.6, 0, 1);
    fallingPiece(k, h, h.x, fy - 8, h.kind === 'beam' ? 0.05 : 0);
    c.restore();
  }
}

function fallingPiece(k, h, x, y, rot) {
  const c = k.c;
  c.save(); c.translate(x, y); c.rotate(rot);
  if (h.kind === 'beam') {
    if (!k.asset('beam-fall', 0, 15, 150, 30)) {
      c.fillStyle = k.col('#2a1a12'); c.fillRect(-75, -11, 150, 22);
      c.fillStyle = k.col('#e9a46a');
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 20 - 8, -11); c.lineTo(i * 20, -26 - Math.abs(Math.sin(i + kT(k) * 9)) * 8); c.lineTo(i * 20 + 8, -11); c.fill(); }
    }
  } else if (FILM && k.img('debris-stones')) {
    // (film) three stone blocks from the debris painting, not its dust cloud
    for (const [dx, dy, sz, r] of [[-24, -4, 30, 0.4], [6, -14, 36, -0.3], [28, 2, 26, 1.1]]) {
      c.save(); c.translate(dx, dy); c.rotate(r); k.assetCrop('debris-stones', 200, 8, 56, 50, -sz / 2, -sz * 0.45, sz, sz * 0.9); c.restore();
    }
  } else if (!k.asset('debris-stones', 0, 34, 100, 66)) {
    c.fillStyle = k.col('#8d8f91');
    for (const [dx, dy, r] of [[-26, 2, 13], [0, -6, 16], [24, 4, 12], [-8, 12, 10], [14, -18, 9]]) { c.beginPath(); c.moveTo(dx - r, dy); c.lineTo(dx - r * 0.3, dy - r); c.lineTo(dx + r, dy - r * 0.4); c.lineTo(dx + r * 0.6, dy + r); c.lineTo(dx - r * 0.6, dy + r * 0.8); c.closePath(); c.fill(); }
  }
  c.restore();
}

export function player(k, st, t) {
  const c = k.c, p = st.p;
  c.save();
  if (st.inv > 0 && Math.floor(st.inv * 10) % 2) c.globalAlpha = 0.45;
  let tilt = 0;
  if (st.defeatT != null) tilt = Math.min(1.4, st.defeatT * 2) * -p.face;
  if (tilt) { c.translate(p.x, p.y); c.rotate(tilt); c.translate(-p.x, -p.y); }
  const walking = p.f >= 0 && !p.conn && Math.abs(p.vx) > 1;
  const stairTravel = p.conn && ['stairs', 'slope'].includes(p.conn.c.kind)
    ? p.conn.u * Math.hypot(p.conn.c.b.x - p.conn.c.a.x, HOUSE.floors[p.conn.c.b.f] - HOUSE.floors[p.conn.c.a.f]) : null;
  const travel = walking ? p.x : stairTravel;
  const step = travel == null ? 0 : walkStep(travel);
  const s = st.phase === 'quay' ? 0.8 : S;
  const pose = housePose(st, HOUSE.floors);
  // the film's prince stoops to lift her (F20), and carries her down a ladder
  // or the ivy on his own climbing-with-her frames
  const H = 180 * s;
  const lifting = FILM && p.liftT > T.lift / 2 && drawPose(k, 'prince-lift', p.x, p.y, H, { face: p.face });
  const onRungs = FILM && pose === 'carry' && p.conn && !['stairs', 'slope'].includes(p.conn.c.kind);
  const rung = onRungs && Math.floor(p.conn.u * Math.hypot(p.conn.c.b.x - p.conn.c.a.x, HOUSE.floors[p.conn.c.b.f] - HOUSE.floors[p.conn.c.a.f]) / 26) % 2;
  if (!lifting && !(onRungs && drawPose(k, rung ? 'prince-carry-climb-b' : 'prince-carry-climb-a', p.x, p.y, H, { face: p.face }))) {
    sailor(k, p.x, p.y, s, pose, pose === 'throw' ? 1 : p.face, step, travel);
  }
  c.restore();
}

// ---------------------------------------------------------------- the quay
function quayGround(k, t, lamp = false) {
  const c = k.c;
  if (k.asset('harbour-quay', 640, 692, 1280, 200)) return;
  c.fillStyle = k.col('#8d877a'); c.fillRect(0, QUAY.y, 1280, 60);
  c.fillStyle = k.col('#a59f92'); c.fillRect(0, QUAY.y, 1280, 6);
  c.strokeStyle = k.col('#6f6a5e'); c.lineWidth = 1.5;
  for (let x = 0; x < 1280; x += 64) { c.beginPath(); c.moveTo(x, QUAY.y + 6); c.lineTo(x, QUAY.y + 60); c.stroke(); }
  c.beginPath(); c.moveTo(0, QUAY.y + 30); c.lineTo(1280, QUAY.y + 30); c.stroke();
  c.fillStyle = k.col('#1a1416');
  for (const x of [240, 560, 880]) { c.fillRect(x - 9, QUAY.y - 22, 18, 22); c.beginPath(); c.ellipse(x, QUAY.y - 22, 13, 5, 0, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = k.col('#c9b07a'); c.lineWidth = 3;
  c.beginPath(); c.ellipse(700, QUAY.y - 6, 24, 7, 0, 0, Math.PI * 2); c.stroke();
  c.fillStyle = k.col('#6b4024'); c.fillRect(380, QUAY.y - 26, 34, 26); c.strokeStyle = k.col('#3a2112'); c.strokeRect(380, QUAY.y - 26, 34, 26);
  // the lamp post
  c.fillStyle = k.col('#1a1416'); c.fillRect(1086, QUAY.y - 170, 6, 170); c.fillRect(1076, QUAY.y - 186, 26, 18);
  c.fillStyle = k.col(lamp ? '#ffe9a8' : '#d9b34a'); c.fillRect(1080, QUAY.y - 182, 18, 12);
}

// The house on its cliff upstage: small, whole or falling.
function distantHouse(k, st, t, fall = 0, window = 'dark') {
  const c = k.c;
  // The clifftop seen from the quay: the top of the delivered cliff flat (its
  // grass at the house's foot, y 330), or a stand-in.
  if (!k.assetCrop('cliff-face', 0, 0, 1400, 1000, 110, 318, 490, 350)) {
    c.fillStyle = k.col('#cfc5b0');
    c.beginPath(); c.moveTo(150, 640); c.lineTo(150, 330); c.lineTo(520, 330); c.quadraticCurveTo(560, 450, 600, 640); c.closePath(); c.fill();
    c.fillStyle = k.col('#a99d88');
    for (let i = 0; i < 9; i++) { const x = 168 + i * 44; c.fillRect(x + 26, 340 + (i % 3) * 20, 10, 300 - (i % 3) * 20); c.fillRect(x, 400 + ((i * 37) % 120), 40, 3); }
    c.fillStyle = k.col('#6f9a4a'); c.fillRect(150, 322, 372, 10);
  }
  c.save();
  c.translate(330, 330); c.rotate(fall * 0.5); c.translate(0, fall * fall * 260); c.scale(0.36, 0.36); c.translate(-640, -642);
  if (fall > 0.95) { c.restore(); return; }
  frontPanel(k, 0, t);
  if (window === 'lit') {
    const g = c.createRadialGradient(640, 193, 10, 640, 193, 160);
    g.addColorStop(0, k.P.mode === 'lum' ? 'rgba(255,245,215,0.9)' : 'rgba(255,214,120,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(480, 40, 320, 320);
    c.fillStyle = k.col('#ffe9a8'); c.fillRect(612, 160, 56, 66);
    c.fillStyle = k.col('#3a2112'); c.fillRect(612, 190, 56, 4); c.fillRect(638, 160, 4, 66);
  }
  if (window === 'door') {
    // the door stands open, a figure against the warm light inside
    c.fillStyle = k.col('#e9a46a'); c.fillRect(HOUSE.door + 2, 540, 64, 102);
    if (!k.asset('rival-silhouette', HOUSE.door + 34, 642, 64, 120)) {
      c.fillStyle = k.col('#0c0a0c');
      c.beginPath(); c.moveTo(HOUSE.door + 14, 642); c.lineTo(HOUSE.door + 22, 570); c.lineTo(HOUSE.door + 46, 570); c.lineTo(HOUSE.door + 54, 642); c.closePath(); c.fill();
      k.circle(HOUSE.door + 34, 556, 12); c.fillRect(HOUSE.door + 12, 544, 44, 6);
    }
  }
  c.restore();
}

function quayScene(k, st, t) {
  const fall = easeInOut(st.quayT / 6);
  bay(k, st, t, 1 - 0.4 * fall);
  distantHouse(k, st, t, fall);
  flames(k, st, t, 1 - fall * 0.5);
  quayGround(k, t);
  hazards(k, st, t);
  player(k, st, t);
}

// ---------------------------------------------------------------- endings
const CAPTIONS = {
  witch: ["The Sea Witch's", 'She claims him for the sea. The beloved is safe on the quay.'],
  lamp: ['A Lamp in the Window', 'She waited. Her pearl is home on its chain.'],
  dark: ['The Window is Dark', 'Another waits in her doorway. The stone goes into the bay.'],
};

function endingScene(k, st, t) {
  const c = k.c, pt = st.phaseT, e = st.ending;
  const art = (e === 'dark' && (k.asset('ending-dark-3', 640, 720, 1280, 720) || k.asset('ending-dark-2', 640, 720, 1280, 720)))
    || k.asset('ending-' + e, 640, 720, 1280, 720);
  if (!art) {
    bay(k, st, t, 0.12 * (1 - easeInOut(pt / 4)));
    if (e === 'witch') witchEnding(k, st, t, pt);
    else if (e === 'lamp') lampEnding(k, st, t, pt);
    else darkEnding(k, st, t, pt);
  }
  caption(k, CAPTIONS[e], easeInOut((pt - 1.0) / 1.0), (e === 'dark' && k.img('ending-dark-3') && CAPTION_AT.dark) || {});
  k.wash('#1a0f18', easeInOut((pt - (T.ending - 1.0)) / 1.0));
}

function witchEnding(k, st, t, pt) {
  const rise = easeOut((pt - 2.2) / 2.0);
  const away = easeInOut((pt - 7.0) / 3.5);
  const bx = 900 + away * 420, by = 600 - rise * 140 - away * 60;
  distantHouse(k, st, t, 0, 'dark');
  if (rise > 0) k.moonboat(bx, by, 1, 1);
  quayGround(k, t);
  beloved(k, 420, QUAY.y, 0.8, 1, pt > 7 ? 'reach' : 'down');
  // he is drawn up to her boat
  const claim = easeInOut((pt - 5.2) / 1.6);
  if (claim < 1) {
    const x = lerp(700, bx - 10, claim), y = lerp(QUAY.y, by - 4, claim);
    k.c.save(); k.c.globalAlpha = 1 - claim * 0.3;
    sailor(k, x, y, lerp(0.8, 0.45, claim), 'stand', 1);
    k.c.restore();
  } else sailor(k, bx - 10, by - 4, 0.45, 'stand', 1);
  // rose petals on the air
  const c = k.c;
  c.fillStyle = k.col('#d63c6c');
  for (let i = 0; i < 12; i++) { const px = ((i * 113 + t * 30) % 900) + 250, py = ((i * 71 + t * 40) % 400) + 140; c.beginPath(); c.ellipse(px, py, 5, 3, t + i, 0, Math.PI * 2); c.fill(); }
}

function lampEnding(k, st, t, pt) {
  const lit = pt > 2.4;
  distantHouse(k, st, t, 0, lit ? 'lit' : 'dark');
  quayGround(k, t, lit);
  const meet = easeInOut((pt - 0.6) / 1.8);
  sailor(k, lerp(520, 606, meet), QUAY.y, 0.8, meet < 1 ? 'walk' : 'stand', 1, meet < 1 ? walkStep(pt * 120) : 0, meet < 1 ? pt * 120 : null);
  beloved(k, lerp(760, 662, meet), QUAY.y, 0.8, -1, meet >= 1 ? 'out' : 'down');
  if (meet >= 1) {
    // her pearl, home on its chain
    const c = k.c, tw = 0.5 + 0.5 * Math.sin(t * 6);
    c.fillStyle = k.col('#ffffff'); k.circle(660, QUAY.y - 118, 4);
    c.globalAlpha = tw; k.star(660, QUAY.y - 118, 10); c.globalAlpha = 1;
  }
}

function darkEnding(k, st, t, pt) {
  const c = k.c;
  distantHouse(k, st, t, 0, 'door');
  quayGround(k, t);
  const thrown = pt > 3.2;
  sailor(k, 780, QUAY.y, 0.8, pt > 2.6 && pt < 3.6 ? 'throw' : 'stand', 1);
  if (pt > 2.6 && !thrown) { c.fillStyle = k.col('#8d8f91'); k.circle(806, QUAY.y - 118, 6); }
  const fly = clamp((pt - 3.2) / 0.9, 0, 1);
  if (thrown && fly < 1) {
    const x = lerp(806, 990, fly), y = lerp(QUAY.y - 118, 540, fly) - Math.sin(Math.PI * fly) * 120;
    c.fillStyle = k.col('#8d8f91'); k.circle(x, y, 6);
  }
  if (fly >= 1) {
    c.strokeStyle = k.col('#eef3ea'); c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const r = ((pt - 4.1) * 30 + i * 22) % 90;
      c.globalAlpha = Math.max(0, 1 - r / 90);
      c.beginPath(); c.ellipse(990, 545, r * 1.6, r * 0.35, 0, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
  }
}

// An intertitle-style caption: plum card, fine double rule, pink script.
// The caption plaque, centred on cx with its top at y (by default over the
// centre of the sky; the dark ending's painting puts the house there, so its
// caption sits in the sky at the right, between the moon and the sailor).
const CAPTION_AT = { dark: { cx: 870, y: 178, w: 528, sub: 12.5 } };
export function caption(k, [title, sub], a, at = {}) {
  if (a <= 0) return;
  const c = k.c, { cx = 770, y = 84, w = 660, sub: px = 15 } = at, x = cx - w / 2;
  c.save(); c.globalAlpha = a * 0.94;
  c.fillStyle = k.col('#2a1424'); c.fillRect(x, y, w, 112);
  c.strokeStyle = k.col('#c79ab7'); c.lineWidth = 1.5;
  c.strokeRect(x + 6, y + 6, w - 12, 100); c.strokeRect(x + 12, y + 12, w - 24, 88);
  c.globalAlpha = a;
  c.textAlign = 'center'; c.fillStyle = k.col('#f3c6dc');
  c.font = '54px Yesteryear, cursive'; c.fillText(title, cx, y + 62);
  c.font = `700 ${px}px "Josefin Sans", sans-serif`; c.fillText(sub.toUpperCase(), cx, y + 90);
  c.restore();
}

// ---------------------------------------------------------------- the pageant
const REVELLER_ART = ['reveller-yellow', 'reveller-shaggy', 'reveller-jester', 'reveller-lady'];
const REVELLER_H = 180; // beside 315-px dancers and the band
function joinerSlot(i) {
  const side = i % 2 ? 1 : -1, j = Math.floor(i / 2);
  return { x: 640 + side * (176 + j * 50), side };
}

function pageantScene(k, st, t) {
  const c = k.c, pt = st.phase === 'iris' ? T.pageant + st.phaseT : st.phaseT;
  const beat = st.beat || 0, ph = beatPhase(beat), bob = Math.abs(Math.sin(Math.PI * ph));
  c.fillStyle = k.col('#1a0f18'); c.fillRect(0, 0, 1280, 720);
  // the apotheosis backcloth flies in
  const dy = -(1 - easeOut(pt / PAGEANT.fly)) * 700;
  c.save(); c.translate(0, dy);
  k.wire(300, -800, 62); k.wire(980, -800, 62);
  if (!k.asset('pageant-backcloth', 640, 720, 1280, 720)) apotheosis(k, t);
  c.restore();
  // the dancers' line
  const dIn = easeOut((pt - PAGEANT.dancers) / 1.2);
  if (dIn > 0) {
    c.save(); c.beginPath(); c.rect(0, 0, 1280, 566); c.clip();
    const yb = 566 + (1 - dIn) * 200 - bob * 6;
    if (!k.idle('pageant-dancers', beat * 60 / 76.5, 640, yb, 720, 315)) {
      for (let i = 0; i < 5; i++) dancer(k, 380 + i * 130, yb, 130, ((Math.floor(beat) + i) % 2) * bob);
    }
    c.restore();
  }
  // the Sea King and the witch take their places on the daises
  const court = easeOut((pt - PAGEANT.court) / 1.2);
  if (!k.img('pageant-backcloth')) { dais(k, 222); dais(k, 1058); }
  if (court > 0) {
    c.save(); c.beginPath(); c.rect(0, 0, 1280, 566); c.clip();
    const cy = 566 + (1 - court) * 240;
    if (!k.asset('sea-king-throne', 222, cy, 180, 228)) seaKing(k, 222, cy, t);
    witchFigure(k, 1058, cy, 1.05, -1);
    c.restore();
  }
  // every reveller woken in the grotto steps into the line
  const n = st.sleepersShown;
  for (let i = 0; i < st.joined; i++) {
    const s = joinerSlot(i), since = pt - joinAt(i, n);
    const walk = easeInOut(since / 0.9);
    const x = lerp(640 + s.side * 720, s.x, walk);
    const hop = walk >= 1 ? ((Math.floor(beat) + i) % 2) * bob * 8 : Math.abs(Math.sin(since * 9)) * 6;
    const face = walk < 1 ? -s.side : 1;
    // the delivered revellers (220 x 420 each), cycled when more than four join
    if (!idleFlip(k, REVELLER_ART[i % REVELLER_ART.length], beat * 60 / 76.5 + i * 0.13, x, 618 - hop, REVELLER_H * 220 / 420, REVELLER_H, face)) {
      person(k, x, 618 - hop, 142, revellerCostume(i), { face, arms: walk >= 1 ? 'v' : 'down', step: walk < 1 ? Math.sin(since * 12) : 0 });
    }
  }
  // the band at centre, rising through the trapdoor
  const band = easeOut((pt - PAGEANT.band) / 1.4);
  if (LEGACY && band > 0) {
    c.save(); c.beginPath(); c.rect(0, 0, 1280, 650); c.clip();
    const sway = st.carry.guitar ? Math.sin(Math.PI * beat) * 0.03 : 0;
    c.translate(640, 652 + (1 - band) * 280); c.rotate(sway);
    // Without the guitar the band takes its bow empty-handed: the three
    // members drawn singly, the guitarist with nothing in his hands.
    const noGuitar = !st.carry.guitar && k.img('band-guitarist-empty') && k.img('band-hat') && k.img('band-beard');
    if (noGuitar) {
      k.asset('band-hat', -82, 2, 104, 208);
      k.asset('band-beard', 82, 2, 104, 208);
      k.asset('band-guitarist-empty', 0, 4, 108, 216);
    } else if (!k.idle('band-trio', beat * 60 / 76.5, 0, 2, 250, 250)) {
      for (const [dx, col] of [[-50, '#2b2b2b'], [0, '#e9e1d0'], [50, '#5a4a3a']]) person(k, dx, 0, 200, { coat: col, legs: '#4a2a3a', hair: '#3a2112' });
    }
    c.restore();
    if (st.carry.guitar && band >= 1) {
      // the guitar is home: notes rise on the beat
      c.save(); c.font = '34px Yesteryear, cursive'; c.textAlign = 'center';
      for (let i = 0; i < 4; i++) {
        const a = ((t * 0.7 + i * 0.25) % 1);
        c.globalAlpha = 1 - a; c.fillStyle = k.col(i % 2 ? '#d9b34a' : '#f3c6dc');
        c.fillText(i % 2 ? '♫' : '♪', 640 + Math.sin(i * 2 + t) * 90, 420 - a * 200);
      }
      c.restore();
    }
  }
  // confetti from the flies after the band arrives
  if (pt > PAGEANT.band + 1) {
    for (let i = 0; i < 36; i++) {
      c.fillStyle = k.col(REVELLER_COLS[i % 6]);
      const x = (i * 97) % 980 + 150 + Math.sin(t * 2 + i) * 10, y = ((t * 70 + i * 53) % 600) + 60;
      c.save(); c.translate(x, y); c.rotate(t * 3 + i); c.fillRect(-4, -2, 8, 4); c.restore();
    }
  }
}

function revellerCostume(i) {
  const col = REVELLER_COLS[i % 6];
  return i % 3 === 1 ? { coat: col, skirt: col, hair: '#3a2112', hat: 'bun' } : { coat: col, legs: i % 2 ? '#3a2a40' : '#e9e1d0', hair: '#3a2112', hat: i % 4 === 0 ? 'cap' : undefined, hatCol: '#2a1a22' };
}

function apotheosis(k, t) {
  const c = k.c;
  c.fillStyle = k.col('#e7c6dc'); c.fillRect(0, 0, 1280, 720);
  // a sunburst behind the central arch
  c.save(); c.translate(640, 300); c.rotate(t * 0.08);
  for (let i = 0; i < 24; i++) {
    c.fillStyle = k.col(i % 2 ? '#d9b34a' : '#f1e3c8');
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 900, (i / 24) * Math.PI * 2, ((i + 1) / 24) * Math.PI * 2); c.closePath(); c.fill();
  }
  c.restore();
  c.fillStyle = k.col('#fff2b0'); k.circle(640, 300, 70);
  // tiered arches and coral columns
  for (const [x, r, top] of [[640, 190, 130], [320, 120, 230], [960, 120, 230]]) {
    c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 16;
    c.beginPath(); c.arc(x, top + r, r, Math.PI, 0); c.lineTo(x + r, 566); c.moveTo(x - r, 566); c.lineTo(x - r, top + r); c.stroke();
    c.strokeStyle = k.col('#8a6a20'); c.lineWidth = 3; c.beginPath(); c.arc(x, top + r, r - 10, Math.PI, 0); c.stroke();
  }
  for (const x of [170, 470, 810, 1110]) {
    c.fillStyle = k.col('#c8321e'); c.fillRect(x - 16, 200, 32, 366);
    c.fillStyle = k.col('#d9b34a'); c.fillRect(x - 24, 192, 48, 14); c.fillRect(x - 24, 556, 48, 12);
    // a scallop shell on top
    c.fillStyle = k.col('#f3c6dc'); c.beginPath(); c.moveTo(x, 192); c.arc(x, 192, 30, Math.PI, 0); c.closePath(); c.fill();
    c.strokeStyle = k.col('#c79ab7'); c.lineWidth = 2; for (let a = 1; a < 6; a++) { c.beginPath(); c.moveTo(x, 192); c.lineTo(x + Math.cos(Math.PI + (a / 6) * Math.PI) * 30, 192 + Math.sin(Math.PI + (a / 6) * Math.PI) * 30); c.stroke(); }
  }
  c.fillStyle = k.col('#fff2b0');
  for (let i = 0; i < 18; i++) { c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + i); k.star((i * 211) % 980 + 150, (i * 97) % 300 + 80, 5 + (i % 3) * 2); }
  c.globalAlpha = 1;
  // the stage floor of the set, with foam scallops
  c.fillStyle = k.col('#5f8c88'); c.fillRect(0, 566, 1280, 154);
  c.fillStyle = k.col('#eef3ea'); for (let x = 0; x < 1280; x += 40) { c.beginPath(); c.arc(x + 20, 566, 20, 0, Math.PI); c.fill(); }
}

function dais(k, x) {
  const c = k.c;
  c.fillStyle = k.col('#d9b34a'); c.fillRect(x - 70, 566, 140, 18);
  c.fillStyle = k.col('#8a6a20'); c.fillRect(x - 62, 584, 124, 10);
}

function dancer(k, x, by, h, kick) {
  const c = k.c, u = h / 100;
  c.fillStyle = k.col('#efd7c4');
  c.fillRect(x - 6 * u, by - 46 * u, 4 * u, 46 * u);
  c.save(); c.translate(x + 3 * u, by - 46 * u); c.rotate(-kick * 1.1); c.fillRect(0, 0, 4 * u, 46 * u); c.restore();
  c.fillStyle = k.col('#f3a6c8'); c.beginPath(); c.ellipse(x, by - 48 * u, 26 * u, 8 * u, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = k.col('#f4ece4'); c.fillRect(x - 8 * u, by - 76 * u, 16 * u, 28 * u);
  c.strokeStyle = k.col('#efd7c4'); c.lineWidth = 3.5 * u; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - 6 * u, by - 72 * u); c.lineTo(x - 20 * u, by - 104 * u); c.moveTo(x + 6 * u, by - 72 * u); c.lineTo(x + 20 * u, by - 104 * u); c.stroke();
  c.fillStyle = k.col('#efd7c4'); k.circle(x, by - 84 * u, 7 * u);
  for (let i = -1; i <= 1; i++) { c.fillStyle = k.col(i ? '#e0127a' : '#d9b34a'); k.circle(x + i * 6 * u, by - 91 * u, 2.6 * u); }
}

function seaKing(k, x, by, t) {
  person(k, x, by, 230, KING, { face: 1, arms: 'out' });
  const c = k.c;
  c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 5;
  c.beginPath(); c.moveTo(x + 70, by); c.lineTo(x + 70, by - 266); c.stroke();
  c.beginPath(); c.moveTo(x + 54, by - 268); c.lineTo(x + 54, by - 242); c.lineTo(x + 86, by - 242); c.lineTo(x + 86, by - 268); c.moveTo(x + 70, by - 278); c.lineTo(x + 70, by - 242); c.stroke();
}

export const _forTests = { CAPTIONS, joinerSlot };

