import { walkFrame, walkStep } from '../walking.js';
// Act III drawing: the Sea King's court. Every piece of art has a procedural
// stand-in until its file is delivered (ids and sizes are in
// design/image-requests.md, Part C4; drawn here at half the listed pixels).
import {
  ROWY, ROWSCALE, PEDESTAL, PASSAGE, guardOpen, THRONE_BX, WITCH_BX, LANTERN_BX, LANTERN_Y, DAIS_Y, PAR, OUTRO,
  beamOn, rowY, rowScale, whaleX, fishX, backX, gazeLook,
} from './act3.js';
import { clamp, lerp, easeOut, easeInOut, beatPhase } from './shared.js';
import { FILM } from '../theme.js';
import { drawPose, drawPerson, personPx } from '../pose.js';
import { card } from './tableau.js';
import { richText } from '../art.js';   // headless-safe: art.js touches no DOM at load

const FLOOR_TOP = 404;
const BC_H = 900;               // drawn height of the delivered backcloth
const GOWN = { green: '#9cc7a4', pink: '#f3c6dc', blue: '#a9c4e0' };
const NAVY = '#26304a';

export function draw(k, st, t) {
  if (st.transform != null) return transformation(k, st, t);
  const c = k.c, ph = st.phase;
  const bob = Math.abs(Math.sin(Math.PI * beatPhase(st.beat)));
  const cam = st.cam;
  hall(k, st, t);
  dais(k, st, t, bob);
  // the floor layer rolls 1:1 with the sailor
  c.save(); c.translate(-cam, 0);
  floor(k, cam);
  pedestal(k, st, t);

  // Everything on the grooves, back to front. The sailor sorts just behind a
  // courtier on the same groove, so freezing "behind" one reads as cover.
  const items = [];
  const vis = (x) => Math.abs(x - cam - 640) < 760;
  for (const q of st.pearlsOnFloor) if (!q.got && vis(q.x)) items.push({ y: ROWY[q.row] - 1, f: () => floorPearl(k, q, t) });
  for (const cr of st.courtiers) if (cr !== st.capture?.guard && vis(cr.x)) items.push({ y: ROWY[cr.row], f: () => courtier(k, cr, bob, st) });
  if (st.capture) items.push({ y: ROWY[st.capture.row], f: () => capture(k, st.capture, ROWY[st.capture.row], 180 * ROWSCALE[st.capture.row]) });
  else if (ph !== 'lunge' && ph !== 'iris') items.push({ y: rowY(st.p) - 0.5, f: () => player(k, st, t) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.f();
  if (ph === 'play') hiddenCue(k, st, t);

  for (const s of st.sentries) if (Math.abs(s.x - cam - 640) < 800) sentry(k, s, st, t);
  c.restore();
  telegraph(k, st, t);
  beam(k, st, t);
  omens(k, st, t);
  passers(k, st, t);
  pearlCue(k, st, t);
  if (ph === 'turn' || ph === 'lunge' || ph === 'iris') outro(k, st, t);
  if (ph === 'caught') k.wash('#4a0a18', 0.25 * clamp(st.phaseT / 0.8, 0, 1));
  c.globalAlpha = 1;
}

// The film's passage (tableaux 19-21): he walks through the lobster palace,
// past its guards' claws, the sea flora and the azure grotto, each set
// then the sea flora, dissolving into Neptune's court.
const TSETS = ['lobster-palace'];
const TNAMES = ['The Lobster Palace'];
// (leaping is said where it is needed: at the pearls)
const TSUBS = ['Hold [X] to bow and let each guard pass'];
// on touch a tap leaps (there is no Leap button there), so it says tap
const TSUBS_TOUCH = ['Hold [X] to bow and let each guard pass'];
const tsub = (k, i) => (k.inputMode === 'touch' ? TSUBS_TOUCH : TSUBS)[i];
const BOW_H = 160 * 300 / 360;   // prince-crouch (240 x 300) at the standing pose's scale
function transformation(k, st, t) {
  const c = k.c, f = st.tf, P = PASSAGE;
  if (!f) return;
  if (!k.asset(TSETS[f.set], 640, 720, 1280, 720)) { c.fillStyle = k.col('#5a3a4a'); c.fillRect(0, 0, 1280, 720); }
  for (const g of f.guards) {
    if (g === f.capture?.guard) continue;
    const open = guardOpen(g, f), near = Math.abs(f.x - g.x) < P.notice;
    c.save(); c.translate(g.x, P.y);
    if (!k.asset(open ? 'lobster-guard-open' : 'lobster-guard-closed', 0, 0, 230, 156)) { c.fillStyle = k.col('#c8321e'); c.fillRect(-30, -140, 60, 140); }
    c.restore();
    // coming up on a guard upright: he is about to snap
    if (g.mode === 'approach' && near && !open && f.x < g.x && f.knockT <= 0 && f.t > 1) prompt(k, 'Hold [X] to bow', g.x, P.y - 200, '#ffb0a0');
  }
  P.pearls.forEach(([px, py], i) => {
    if (f.got.includes(i)) return;
    const bob = Math.sin(t * 2.4 + i) * 4;
    c.save(); c.globalAlpha = 0.28 + 0.14 * Math.sin(t * 4 + i); c.fillStyle = k.col('#fff2b0'); k.circle(px, py + bob, 24); c.restore();
    if (!k.asset('pearl', px, py + 14 + bob, 30, 30)) { c.fillStyle = k.col('#f7f2fa'); k.circle(px, py + bob, 10); }
  });
  // the prince: bowing past the guards, leaping for pearls, else walking
  const moving = Math.abs(f.vx) > 20, step = walkFrame('sailor', f.walk, 34);
  if (f.capture) capture(k, f.capture, P.y, 160);
  else {
    c.save(); c.translate(f.x, P.y - (f.lift || 0)); c.scale(f.face, 1);
    if (f.knockT > 0) k.asset('sailor-fall', 0, 0, 98, 160);
    else if (f.bow && k.img('sailor-crouch')) k.asset('sailor-crouch', 0, Math.sin(f.walk / 14) * 1.5, 98, BOW_H);
    else if (f.lift > 0 && k.img('sailor-leap')) k.asset('sailor-leap', 0, 0, 98, 160);
    else if (!k.asset(moving ? step : 'sailor-stand', 0, 0, 98, 160)) { c.fillStyle = k.col('#6f9fc8'); c.fillRect(-14, -120, 28, 120); }
    c.restore();
  }
  // the way on glows at the right
  c.save(); c.globalAlpha = 0.25 + 0.15 * Math.sin(t * 3); c.fillStyle = k.col('#fff2b0'); c.beginPath(); c.ellipse(P.exit + 40, P.y - 90, 40, 110, 0, 0, Math.PI * 2); c.fill(); c.restore();
  if (f.guards.every(g => g.passed)) prompt(k, f.got.length ? `Pearls ${f.got.length} of ${P.pearls.length}` : k.inputMode === 'touch' ? 'Tap to leap for the pearls' : 'Leap with [A] for the pearls', 900, 230, '#f3c6dc');
  if (f.fade === 0) card(k, TNAMES[f.set], tsub(k, f.set).replace(/\[(\w)\]/g, '$1'), Math.min(1, clamp((f.t - 0.2) / 0.5, 0, 1)) * (f.t > 4.5 ? clamp((5.2 - f.t) / 0.7, 0, 1) : 1), { y: 92 });
  if (f.fade === 0 && f.t > 4.5) (k.flat || ((g) => g()))(() => prompt(k, tsub(k, f.set), 640, 150, '#f3c6dc'));
  if (f.fade > 0) k.wash('#000000', Math.sin(Math.PI * f.fade / P.fade));
}
function capture(k, grab, y, height) {
  const id = 'prince-caught-' + grab.kind;
  const c = k.c;
  c.save(); c.translate(grab.x, y); c.scale(grab.face, 1);
  // Measured midpoint of the prince's boots in each 640px delivery.
  // Keep his feet at the collision position when the pair replaces him.
  const im = k.img(id), tinted = /-tinted\./.test(im?.src || '');
  const princeX = grab.kind === 'human' ? 276 : tinted ? 237 : 234;
  const offset = im ? ((im.naturalWidth || im.width) / 2 - princeX) * height / personPx(k, id) : 0;
  drawPerson(k, id, offset, 0, height);
  c.restore();
}

// A short instruction on a plum label (button glyphs from [A], [X]).
function prompt(k, text, x, y, col = '#f3c6dc') {
  const c = k.c;
  c.save(); c.font = '700 18px "Josefin Sans", sans-serif'; c.textAlign = 'center';
  const w = c.measureText(text.replace(/\[(\w+)\]/g, 'XX')).width + 48;
  c.globalAlpha = 0.85; c.fillStyle = k.col('#2a1424'); c.beginPath(); c.roundRect(x - w / 2, y - 24, w, 34, 17); c.fill();
  c.globalAlpha = 1; c.fillStyle = k.col(col);
  richText(c, text, x, y, { px: 18, mode: k.inputMode || 'key', col: k.col });
  c.restore();
}

// On entering Neptune's court, for its first seconds: how to hide.
export const COURT_PROMPT = 8;
export function drawOver(k, st) {
  if (FILM && st.transform == null && st.courtAt != null && st.status === 'play' && st.t - st.courtAt < COURT_PROMPT) {
    prompt(k, (k.inputMode === 'touch' ? 'Hold Hide' : 'Hold [X]') + ' to hide behind a courtier from guards and from the witch’s eye', 640, 150);
  }
  if (st.phase === 'iris') k.iris(640, 400, 780 * (1 - easeInOut(st.phaseT / OUTRO.iris)));
  if (st.status === 'won') k.iris(640, 400, 0);
}

export function onEvent(k, e, st) {
  if (st.tf) {
    if (e.type === 'pearl') { k.burst(e.x, e.y, '#eef3ea', 12, 'sparkle'); k.text('+10', e.x, e.y - 40); }
    if (e.type === 'clawSnap') { k.shake(0.35); k.burst(e.x, PASSAGE.y - 90, '#c8321e', 12, 'streak'); k.text('Bow to pass!', e.x, PASSAGE.y - 230); }
    if (e.type === 'bow') k.burst(st.tf.x, PASSAGE.y - 120, '#fff2b0', 4, 'sparkle');
    return;
  }
  if (e.x != null) e = { ...e, x: e.x - st.cam };
  if (e.type === 'pearl') { k.burst(e.x, e.y - 20, '#eef3ea', 8, 'sparkle'); k.text('+10', e.x, e.y - 60); }
  if (e.type === 'spotted') { k.flash(0.55); k.shake(0.3); k.text('Spotted!', e.x, e.y - 200, true); k.burst(e.x, e.y - 80, '#e0127a', 14, 'streak'); }
  if (e.type === 'guardBump') { k.shake(0.3); k.burst(e.x, e.y - 60, '#d9b34a', 12, 'streak'); }
  if (e.type === 'sentryBite') { k.shake(0.4); k.burst(e.x, e.y - 30, '#c8321e', 14, 'streak'); }
  if (e.type === 'unseen') { k.text('Unseen +25', e.x, e.y - 190); }
  if (e.type === 'whalePass') { k.shake(0.25); }
  // as it comes between the eye and the hall, say what it is for
  if (e.type === 'whaleMask' && !FILM) k.text('The whale hides you: go!', 640, 520, true);
  if (e.type === 'pearlTaken') { const px = PEDESTAL.x - st.cam, py = pearlY(k, ROWY[0] - 10); k.burst(px, py, '#eef3ea', 22, 'sparkle'); k.burst(px, py, '#f3c6dc', 14, 'sparkle'); k.text('Her pearl', px - 60, 200, true); }
  if (e.type === 'whaleTurn') k.shake(0.4);
  if (e.type === 'swallow') { k.shake(0.9); k.flash(0.4); }
}

// ---------------------------------------------------------------- the hall
function hall(k, st, t) {
  const c = k.c, off = -st.cam * PAR;
  // The painted backcloth is centred on the throne, scaled so its dais (66%
  // of the way down the painting) is where the throne stands; the floor strip
  // covers its painted floor.
  if (!k.asset('court-backcloth', backX(THRONE_BX, st.cam), DAIS_Y + 0.34 * BC_H, BC_H * 16 / 9, BC_H)) {
    const g = c.createLinearGradient(0, 60, 0, FLOOR_TOP);
    g.addColorStop(0, k.col('#1f3d40')); g.addColorStop(0.6, k.col('#3f6f6a')); g.addColorStop(1, k.col('#7aa39a'));
    c.fillStyle = g; c.fillRect(0, 0, 1280, FLOOR_TOP + 4);
    // water light falling through the shell windows
    c.save(); c.globalAlpha = 0.12; c.fillStyle = k.col('#eef3ea');
    for (let i = 0; i < 5; i++) {
      const x = 260 + i * 290 + off + Math.sin(t * 0.35 + i * 1.7) * 18;
      c.beginPath(); c.moveTo(x, 60); c.lineTo(x + 50, 60); c.lineTo(x + 130, FLOOR_TOP); c.lineTo(x + 20, FLOOR_TOP); c.fill();
    }
    c.restore();
    // three gilded arches with shell windows
    for (const [x0, w] of [[330, 250], [640, 250], [950, 290], [1260, 250]]) {
      const x = x0 + off;
      const top = 120;
      c.fillStyle = k.col('#16302f');
      c.beginPath(); c.moveTo(x - w / 2 + 18, FLOOR_TOP); c.lineTo(x - w / 2 + 18, top + w / 2); c.arc(x, top + w / 2, w / 2 - 18, Math.PI, 0); c.lineTo(x + w / 2 - 18, FLOOR_TOP); c.fill();
      c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 10;
      c.beginPath(); c.moveTo(x - w / 2 + 12, FLOOR_TOP); c.lineTo(x - w / 2 + 12, top + w / 2); c.arc(x, top + w / 2, w / 2 - 12, Math.PI, 0); c.lineTo(x + w / 2 - 12, FLOOR_TOP); c.stroke();
      // shell window
      c.fillStyle = k.col('#8fb8ae');
      c.beginPath(); c.moveTo(x - 44, top + 96); c.arc(x, top + 96, 44, Math.PI, 0); c.closePath(); c.fill();
      c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 2.5;
      for (let r = 0; r <= 6; r++) { const a = Math.PI + (r / 6) * Math.PI; c.beginPath(); c.moveTo(x, top + 96); c.lineTo(x + Math.cos(a) * 44, top + 96 + Math.sin(a) * 44); c.stroke(); }
      // pearl beads round the arch
      c.fillStyle = k.col('#f1e3c8');
      for (let i = 0; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI; k.circle(x + Math.cos(a) * (w / 2 - 12), top + w / 2 + Math.sin(a) * (w / 2 - 12), 3.5); }
    }
    // coral-red columns between the arches
    for (const x of [178, 485, 795, 1105, 1415]) column(k, x + off, 70, FLOOR_TOP, 34);
    // drifting bubbles (driven by t only)
    c.fillStyle = k.col('#eef3ea'); c.globalAlpha = 0.35;
    for (let i = 0; i < 10; i++) { const y = FLOOR_TOP - ((t * 24 + i * 61) % 330); k.circle(220 + ((i * 113) % 860) + Math.sin(t + i) * 6, y, 2 + (i % 3)); }
    c.globalAlpha = 1;
  }
  // column wings, framing the hall
  if (!k.asset('court-wing-left', 168, 700, 300, 675)) column(k, 150, 40, 660, 46, true);
  if (!k.asset('court-wing-right', 1092, 700, 300, 675)) column(k, 1130, 40, 660, 46, true);
}

function column(k, x, top, bottom, w, lamp = false) {
  const c = k.c;
  c.fillStyle = k.col('#c8321e'); c.fillRect(x - w / 2, top, w, bottom - top);
  c.fillStyle = k.col('#8e1f14'); c.fillRect(x + w / 2 - 8, top, 8, bottom - top);
  c.fillStyle = k.col('#d9b34a');
  c.fillRect(x - w / 2 - 8, top, w + 16, 14); c.fillRect(x - w / 2 - 8, bottom - 14, w + 16, 14);
  // gold ribbon spiral
  c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 3;
  for (let y = top + 30; y < bottom - 30; y += 46) { c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y + 22); c.stroke(); }
  if (lamp) {
    c.fillStyle = k.col('#3a2112'); c.fillRect(x - 1, top + 14, 2, 120);
    c.fillStyle = k.col('#d9b34a'); c.beginPath(); c.ellipse(x, top + 146, 12, 16, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = k.col('#f3c6dc'); k.circle(x, top + 146, 6);
  }
}

// ---------------------------------------------------------------- the dais
function dais(k, st, t, bob) {
  const c = k.c, tx = backX(THRONE_BX, st.cam), wx = backX(WITCH_BX, st.cam), lx = backX(LANTERN_BX, st.cam);
  // raised steps (the delivered backcloth paints its own)
  if (!k.img('court-backcloth')) {
  c.fillStyle = k.col('#6d4a6a'); c.fillRect(lx - 60, FLOOR_TOP - 34, wx - lx + 160, 34);
  c.fillStyle = k.col('#d9b34a'); c.fillRect(lx - 60, FLOOR_TOP - 36, wx - lx + 160, 5); c.fillRect(lx - 90, FLOOR_TOP - 6, wx - lx + 220, 6);
  }
  const by = DAIS_Y;
  // The king's eyes follow his beam.
  const look = clamp((gazeLook(st) - st.cam - tx) / 600, -1, 1);
  if (!k.asset('sea-king-throne', tx, by, 300, 310)) kingStandin(k, tx, by, look, bob);
  // the witch at his side
  if (!k.asset('witch-stand', wx, by + 2, 130, 210)) witchStandin(k, wx, by + 2, t);
  // the gaze lantern on its gilded pole
  const lit = st.masked ? 0.3 : 1;
  if (!k.asset('gaze-lantern', lx, 412, 140, 210)) lanternStandin(k, st, t, lit, lx);
}

function kingStandin(k, x, y, look, bob) {
  const c = k.c;
  // scallop-shell throne
  c.fillStyle = k.col('#d9b34a');
  c.beginPath(); c.moveTo(x - 120, y); c.lineTo(x - 140, y - 170); c.arc(x, y - 170, 140, Math.PI, 0); c.lineTo(x + 120, y); c.closePath(); c.fill();
  c.strokeStyle = k.col('#9a7a2a'); c.lineWidth = 4;
  for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI; c.beginPath(); c.moveTo(x, y - 120); c.lineTo(x + Math.cos(a) * 136, y - 170 + Math.sin(a) * 136); c.stroke(); }
  // white coral flanks
  c.strokeStyle = k.col('#f1e3c8'); c.lineWidth = 9; c.lineCap = 'round';
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(x + s * 140, y); c.lineTo(x + s * 150, y - 120); c.moveTo(x + s * 146, y - 70); c.lineTo(x + s * 172, y - 110); c.moveTo(x + s * 150, y - 120); c.lineTo(x + s * 136, y - 160); c.stroke();
  }
  // robes: white, with a pale blue mantle
  c.fillStyle = k.col('#f4f1ea');
  c.beginPath(); c.moveTo(x - 70, y); c.lineTo(x - 46, y - 160); c.lineTo(x + 46, y - 160); c.lineTo(x + 70, y); c.fill();
  c.fillStyle = k.col('#9fbfe0');
  c.beginPath(); c.moveTo(x - 74, y); c.lineTo(x - 50, y - 158); c.lineTo(x - 26, y - 158); c.lineTo(x - 30, y); c.fill();
  c.beginPath(); c.moveTo(x + 74, y); c.lineTo(x + 50, y - 158); c.lineTo(x + 26, y - 158); c.lineTo(x + 30, y); c.fill();
  c.fillStyle = k.col('#d9b34a'); c.fillRect(x - 46, y - 96, 92, 6);
  // head, long white beard, crown
  c.fillStyle = k.col('#efd7c4'); k.circle(x, y - 182, 22);
  c.fillStyle = k.col('#ffffff');
  c.beginPath(); c.moveTo(x - 22, y - 180); c.quadraticCurveTo(x, y - 60, x + 22, y - 180); c.fill();
  c.fillStyle = k.col('#2a1a22'); k.circle(x - 8 + look * 4, y - 188, 2.5); k.circle(x + 8 + look * 4, y - 188, 2.5);
  c.fillStyle = k.col('#d9b34a'); c.strokeStyle = k.col('#3a2112'); c.lineWidth = 3;
  c.beginPath(); c.moveTo(x - 24, y - 198); c.lineTo(x - 27, y - 230); c.lineTo(x - 12, y - 214); c.lineTo(x, y - 238); c.lineTo(x + 12, y - 214); c.lineTo(x + 27, y - 230); c.lineTo(x + 24, y - 198); c.closePath(); c.stroke(); c.fill();
  c.fillStyle = k.col('#e0127a'); k.circle(x, y - 208, 4); c.fillStyle = k.col('#5f8c88'); k.circle(x - 14, y - 205, 3); k.circle(x + 14, y - 205, 3);
  // trident, swaying with the beat
  c.save(); c.translate(x + 66, y - 60); c.rotate(0.05 - bob * 0.04);
  c.fillStyle = k.col('#d9b34a'); c.fillRect(-3, -200, 6, 230);
  c.fillRect(-20, -200, 40, 5);
  for (const dx of [-20, 0, 17]) { c.beginPath(); c.moveTo(dx, -198); c.lineTo(dx + 1.5, -232); c.lineTo(dx + 3, -198); c.fill(); }
  c.restore();
  // his hand on it
  c.fillStyle = k.col('#efd7c4'); k.circle(x + 62, y - 110, 7);
}

function witchStandin(k, x, y, t) {
  const c = k.c, sway = Math.sin(t * 1.1) * 3;
  c.fillStyle = k.col('#e7a6bd');
  c.beginPath(); c.moveTo(x - 38, y); c.quadraticCurveTo(x - 30 + sway, y - 100, x - 14, y - 160); c.lineTo(x + 14, y - 160); c.quadraticCurveTo(x + 30 + sway, y - 100, x + 40, y); c.fill();
  c.fillStyle = k.col('#e0127a'); c.fillRect(x - 15, y - 120, 30, 5);
  // long black hair, crown, face turned toward the king (left)
  c.fillStyle = k.col('#1a1012');
  c.beginPath(); c.moveTo(x - 6, y - 196); c.quadraticCurveTo(x + 26, y - 170, x + 18, y - 110); c.lineTo(x + 2, y - 150); c.fill();
  c.fillStyle = k.col('#efd7c4'); k.circle(x - 2, y - 178, 13);
  c.fillStyle = k.col('#d9b34a');
  c.beginPath(); c.moveTo(x - 12, y - 190); c.lineTo(x - 10, y - 204); c.lineTo(x - 3, y - 196); c.lineTo(x + 4, y - 206); c.lineTo(x + 8, y - 190); c.fill();
  // star wand lowered; arm out
  c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(x + 24, y - 100); c.lineTo(x + 44, y - 60); c.stroke();
  c.fillStyle = k.col('#d9b34a'); k.star(x + 46, y - 56, 8);
}

function lanternStandin(k, st, t, lit, x) {
  const c = k.c, y = LANTERN_Y;
  c.fillStyle = k.col('#d9b34a'); c.fillRect(x - 4, y + 22, 8, 412 - y - 22);
  c.fillRect(x - 18, 404, 36, 8);
  // glow
  const warn = st.gaze.phase === 'warn' ? 0.5 + 0.5 * Math.sin(t * 14) : 0;
  c.save(); c.globalAlpha = (0.35 + warn * 0.4) * lit;
  const g = c.createRadialGradient(x, y, 4, x, y, 60);
  g.addColorStop(0, k.col(st.gaze.lock > 0 ? '#e0127a' : '#fff2c0')); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(x - 60, y - 60, 120, 120);
  c.restore();
  // an eye-shaped lantern with a pink iris that looks along the beam
  c.fillStyle = k.col('#d9b34a');
  c.beginPath(); c.ellipse(x, y, 34, 22, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = k.col('#f4f1ea');
  c.beginPath(); c.ellipse(x, y, 27, 15, 0, 0, Math.PI * 2); c.fill();
  const look = clamp((gazeLook(st) - st.cam - x) / 700, -1, 1) * 12;
  c.fillStyle = k.col(st.masked ? '#8f8a86' : '#e0127a'); k.circle(x + look, y + 2, 9);
  c.fillStyle = k.col('#2a1424'); k.circle(x + look, y + 2, 4);
  // lid
  c.fillStyle = k.col('#9a7a2a'); c.fillRect(x - 10, y - 32, 20, 10);
}

function pedestal(k, st, t) {
  const c = k.c, x = PEDESTAL.x, by = ROWY[0] - 10;
  // a pool of treasury light marks it among the painted shells
  c.save(); c.globalAlpha = 0.28 + 0.08 * Math.sin(t * 2);
  c.fillStyle = k.col('#fff2c0'); c.beginPath(); c.ellipse(x, by - 80, 92, 110, 0, 0, Math.PI * 2); c.fill(); c.restore();
  // (The film edition's pedestal holds Neptune's seal: the empty shell, the
  // seal drawn in it.)
  const emptyArt = (st.taken || FILM) && k.img('pearl-pedestal-empty');
  if (!(emptyArt ? k.asset('pearl-pedestal-empty', x, by, PED_W, PED_H) : k.asset('pearl-pedestal', x, by, PED_W, PED_H))) {
    c.fillStyle = k.col('#f1e3c8');
    c.beginPath(); c.moveTo(x - 30, by); c.lineTo(x - 16, by - 110); c.lineTo(x + 16, by - 110); c.lineTo(x + 30, by); c.fill();
    c.strokeStyle = k.col('#cbb89a'); c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - 20, by - 50); c.lineTo(x - 40, by - 80); c.moveTo(x + 18, by - 70); c.lineTo(x + 38, by - 96); c.stroke();
    // open scallop
    c.fillStyle = k.col('#f3c6dc');
    c.beginPath(); c.moveTo(x - 44, by - 112); c.arc(x, by - 112, 44, Math.PI, 0); c.closePath(); c.fill();
    c.strokeStyle = k.col('#c99aae'); c.lineWidth = 2;
    for (let i = 0; i <= 6; i++) { const a = Math.PI + (i / 6) * Math.PI; c.beginPath(); c.moveTo(x, by - 112); c.lineTo(x + Math.cos(a) * 44, by - 112 + Math.sin(a) * 44); c.stroke(); }
    c.fillStyle = k.col('#e9cfd8'); c.fillRect(x - 46, by - 116, 92, 7);
  }
  const art = !!k.img('pearl-pedestal'), py = pearlY(k, by);
  if (!st.taken) {
    c.save(); c.globalAlpha = 0.3 + 0.15 * Math.sin(t * 3);
    c.fillStyle = k.col('#fff6e0'); k.circle(x, py, 24); c.restore();
    if (FILM) goalAt(k, x, py + Math.sin(t * 2) * 2, 15);
    else if (!art) pearlAt(k, x, py + Math.sin(t * 2) * 2, 15);
  } else if (art && !emptyArt) {
    // no empty-pedestal art: paint the shell empty over the pearl
    c.fillStyle = k.col('#e7b3c4'); c.beginPath(); c.ellipse(x, py + 2, 17, 15, 0, 0, Math.PI * 2); c.fill();
  }
}

// Over the whale: the pedestal pearl glows as he nears it (walking up to it
// takes it); once taken it flies up into his hand.
function pearlCue(k, st, t) {
  const c = k.c, x = PEDESTAL.x - st.cam, by = ROWY[0] - 10, p = st.p;
  const py = pearlY(k, by);
  // The goal glows as he nears it, so the pedestal reads as the way out.
  if (st.phase === 'play' && Math.abs(p.x - PEDESTAL.x) < 700) {
    c.save(); c.globalAlpha = 0.45 + 0.3 * Math.sin(t * 5);
    c.fillStyle = k.col('#fff6e0'); k.circle(x, py, 26); c.restore();
    goalAt(k, x, py, 15);
  }
  if (st.phase === 'take') {
    const f = easeOut(st.phaseT / 0.8), px = p.x - st.cam;
    const sx = lerp(x, px, f), sy = lerp(py, rowY(p) - 112 * rowScale(p), f) - Math.sin(f * Math.PI) * 50;
    c.save(); c.globalAlpha = 0.5; c.fillStyle = k.col('#fff6e0'); k.circle(sx, sy, 26); c.restore();
    goalAt(k, sx, sy, 15);
  }
}

// Where her pearl sits: in the delivered art it is 40% of the way down.
const PED_W = 150, PED_H = 196;
const pearlY = (k, by) => (k.img('pearl-pedestal') ? by - PED_H * 0.6 : by - 128);

// The goal on the pedestal: her pearl, or in the film edition Neptune's seal,
// his grant of passage.
function goalAt(k, x, y, r) {
  if (FILM && k.asset('keepsake-seal', x, y + r * 1.8, r * 3.6, r * 3.6)) return;
  pearlAt(k, x, y, r);
}

function pearlAt(k, x, y, r) {
  if (k.asset('pearl', x, y + r, r * 2, r * 2)) return;
  const c = k.c;
  c.fillStyle = k.col('#f4efe6'); k.circle(x, y, r);
  c.fillStyle = k.col('#ffffff'); k.circle(x - r * 0.35, y - r * 0.35, r * 0.3);
}

// ---------------------------------------------------------------- the floor
function floor(k, cam) {
  const c = k.c, x0 = cam, x1 = cam + 1280;
  // The delivered strip (2560 x 400, tiling 1280 wide) paints two grooves;
  // the court needs three on Act I's rows, so the floor is laid from its
  // plain marble bands with the seams under three brass grooves drawn here.
  // The three-groove strip (court-floor-3) is laid whole, stretched in four
  // bands so its painted grooves (art y 95, 210, 314 of 400) land on the rows.
  if (k.img('court-floor-3')) {
    const A = [0, 95, 210, 314, 400], D = [FLOOR_TOP, ROWY[0], ROWY[1], ROWY[2], 650];
    for (let x = Math.floor(x0 / 1280) * 1280; x < x1; x += 1280) {
      for (let i = 0; i < 4; i++) k.assetCrop('court-floor-3', 0, A[i], 2560, A[i + 1] - A[i], x, D[i], 1281, D[i + 1] - D[i] + 1);
    }
    frontEdge(k, x0);
    return;
  }
  const tiled = !!k.img('court-floor');
  if (tiled) {
    for (let x = Math.floor(x0 / 1280) * 1280; x < x1; x += 1280) {
      for (const [sy, sh, dy, dh] of FLOOR_BANDS) k.assetCrop('court-floor', 0, sy, 2560, sh, x, dy, 1281, dh);
    }
    grooves(k, x0);
  }
  if (!tiled) {
    c.fillStyle = k.col('#e9c9c9'); c.fillRect(x0, FLOOR_TOP, 1280, 650 - FLOOR_TOP);
    // marble slabs, their seams raking toward the audience
    c.strokeStyle = k.col('#c79aa5'); c.lineWidth = 1.5;
    for (let x = Math.floor(x0 / 160) * 160 - 160; x < x1 + 160; x += 160) {
      const lean = (x - cam - 640) * 0.45;
      c.beginPath(); c.moveTo(x, FLOOR_TOP); c.lineTo(x + lean, 650); c.stroke();
    }
    c.fillStyle = k.col('#f1e3c8'); c.globalAlpha = 0.5;
    for (let x = Math.floor(x0 / 120) * 120; x < x1; x += 120) { const i = Math.round(x / 120), y = 455 + (((i % 3) + 3) % 3) * 70; c.beginPath(); c.ellipse(x + 30, y, 30, 6, 0.2, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
    grooves(k, x0);
  }
  // the floor's front edge, where the sentries crouch
  frontEdge(k, x0);
}

// The floor's front edge (y 640-650): the seamless strip court-floor-edge
// (2560 x 40 art, 1280 x 20 here) tiled along it, its top on y 640.
function frontEdge(k, x0) {
  if (k.img('court-floor-edge')) {
    for (let x = Math.floor(x0 / 1280) * 1280; x < x0 + 1280; x += 1280) k.asset('court-floor-edge', x + 640, 640 + 20, 1281, 20);
    return;
  }
  k.c.fillStyle = k.col('#6d4a6a'); k.c.fillRect(x0, 640, 1280, 10);
}

// Source band (y, height) of the floor strip -> stage band (y, height).
const FLOOR_BANDS = [
  [0, 28, 398, 14],      // its gilded back edge
  [160, 60, 412, 22],
  [296, 96, 434, 80],
  [156, 72, 514, 84],
  [300, 54, 598, 52],
];

// The three brass-edged processional grooves.
function grooves(k, x0) {
  const c = k.c;
  for (let r = 0; r < 3; r++) {
    const y = ROWY[r], s = ROWSCALE[r];
    c.fillStyle = k.col('#2a1424'); c.fillRect(x0, y - 4 * s, 1280, 9 * s);
    c.fillStyle = k.col('#d9b34a'); c.fillRect(x0, y - 7 * s, 1280, 3 * s); c.fillRect(x0, y + 5 * s, 1280, 3 * s);
    c.fillStyle = k.col('#9a7a2a'); c.fillRect(x0, y + 8 * s, 1280, 1.5);
  }
}

function floorPearl(k, q, t) {
  const s = ROWSCALE[q.row], y = ROWY[q.row] - 14 * s + Math.sin(t * 3 + q.x) * 2;
  pearlAt(k, q.x, y, 9 * s);
}

// ---------------------------------------------------------------- figures
// A brass slider tab where each cut-out rides in its groove.
function tab(k, x, y, s) {
  if (k.asset('groove-slider', x, y, 24 * s, 12 * s)) return;   // requested: 56x28 art, bottom centre on the groove
  k.c.fillStyle = k.col('#9a7a2a'); k.c.fillRect(x - 8 * s, y - 4 * s, 16 * s, 8 * s);
}

function courtier(k, cr, bob, st) {
  const c = k.c, s = ROWSCALE[cr.row], x = cr.x, y = ROWY[cr.row];
  // the one who dives after you into the whale leaves the groove
  if (st.phase === 'lunge' || st.phase === 'iris') {
    if (cr === diver(st)) return;
  }
  tab(k, x, y, s);
  const rock = Math.sin(Math.PI * clamp(beatPhase(st.beat) / 0.42, 0, 1)) * 0.05 * cr.dir;
  c.save(); c.translate(x, y); c.rotate(rock); c.scale(s, s);
  if (cr.kind === 'guard') {
    if (FILM && cr.guardType === 'lobster') {
      c.scale(cr.dir < 0 ? 1 : -1, 1);
      k.asset(st.p.frozen && Math.abs(st.p.x - cr.x) < PASSAGE.notice ? 'lobster-guard-open' : 'lobster-guard-closed', 0, 0, 230, 156);
    } else if (!k.asset('seahorse-guard', 0, 0, 120, 230)) guardStandin(k);
  }
  else if (!k.asset('attendant-' + cr.kind, 0, 0, 110, 210)) attendantStandin(k, cr.kind);
  c.restore();
}

function attendantStandin(k, kind) {
  const c = k.c, col = GOWN[kind];
  c.fillStyle = k.col(col);
  c.beginPath(); c.moveTo(-40, 0); c.quadraticCurveTo(-34, -80, -14, -128); c.lineTo(14, -128); c.quadraticCurveTo(34, -80, 40, 0); c.closePath(); c.fill();
  c.fillStyle = k.col('#f4f1ea'); c.globalAlpha = 0.5; c.fillRect(-36, -14, 72, 6); c.fillRect(-28, -54, 56, 4); c.globalAlpha = 1;
  c.fillStyle = k.col(col); c.fillRect(-12, -150, 24, 26);
  c.fillStyle = k.col('#efd7c4'); k.circle(0, -162, 12);
  c.fillStyle = k.col('#5a3a2a'); c.beginPath(); c.arc(0, -164, 12, Math.PI, 0); c.fill();
  // headdress
  if (kind === 'green') {
    c.fillStyle = k.col('#f1e3c8'); c.beginPath(); c.moveTo(-20, -172); c.arc(0, -172, 20, Math.PI, 0); c.closePath(); c.fill();
    c.strokeStyle = k.col('#c79aa5'); c.lineWidth = 1.5; for (let i = 1; i < 5; i++) { const a = Math.PI + (i / 5) * Math.PI; c.beginPath(); c.moveTo(0, -172); c.lineTo(Math.cos(a) * 20, -172 + Math.sin(a) * 20); c.stroke(); }
    // coral fan
    c.fillStyle = k.col('#c8321e'); c.beginPath(); c.moveTo(22, -110); c.arc(22, -110, 22, -2.4, -0.6); c.closePath(); c.fill();
  } else if (kind === 'pink') {
    c.fillStyle = k.col('#f4efe6'); for (let i = -2; i <= 2; i++) k.circle(i * 7, -178 - (2 - Math.abs(i)) * 3, 4);
    // long-stemmed sea flower
    c.strokeStyle = k.col('#3f6a3a'); c.lineWidth = 2.5; c.beginPath(); c.moveTo(18, -100); c.lineTo(26, -196); c.stroke();
    c.fillStyle = k.col('#e0127a'); k.circle(26, -200, 8);
  } else {
    c.fillStyle = k.col('#e9a46a'); k.star(0, -182, 13);
    // gilded conch
    c.fillStyle = k.col('#d9b34a'); c.beginPath(); c.moveTo(14, -108); c.lineTo(42, -122); c.lineTo(36, -96); c.closePath(); c.fill();
  }
  // arms
  c.fillStyle = k.col('#efd7c4'); k.circle(-16, -104, 5); k.circle(18, -106, 5);
}

function guardStandin(k) {
  const c = k.c;
  c.fillStyle = k.col('#2a1a22'); c.fillRect(-16, -60, 12, 60); c.fillRect(4, -60, 12, 60);
  c.fillStyle = k.col('#c8321e'); c.fillRect(-26, -150, 52, 96);
  c.fillStyle = k.col('#d9b34a'); c.fillRect(-26, -106, 52, 6); k.circle(0, -128, 7);
  c.fillStyle = k.col('#efd7c4'); k.circle(0, -164, 13);
  // gold seahorse helmet: crested dome with a curled snout and tail
  c.fillStyle = k.col('#d9b34a');
  c.beginPath(); c.arc(0, -168, 16, Math.PI, 0); c.fill();
  c.beginPath(); c.moveTo(-4, -184); c.quadraticCurveTo(4, -214, 24, -206); c.quadraticCurveTo(14, -198, 10, -184); c.fill();
  c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 4;
  c.beginPath(); c.arc(-18, -160, 7, -1.6, 2.6); c.stroke();
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-8 + i * 5, -184); c.lineTo(-12 + i * 5, -194); c.stroke(); }
  // trident held upright
  c.fillStyle = k.col('#d9b34a'); c.fillRect(32, -222, 5, 222);
  c.fillRect(22, -222, 25, 4);
  for (const dx of [22, 32, 43]) c.fillRect(dx, -238, 4, 16);
  c.fillStyle = k.col('#efd7c4'); k.circle(34, -120, 6);
}

// The mobile camera's focus (src/camera.js): the player's middle, stage px.
export function focus(st) {
  if (st.tf) return { x: st.tf.x, y: PASSAGE.y - 110 };
  const p = st.p;
  return { x: p.x, y: rowY(p) - 90 * rowScale(p) };
}

function player(k, st, t) {
  const c = k.c, p = st.p, s = rowScale(p), y = rowY(p);
  const flicker = p.grace > 0 && st.phase === 'play' && Math.floor(t * 12) % 2 === 0;
  const hiddenNow = p.hidden && p.frozen;
  // hidden cue: a soft lavender veil behind him, and two glints
  if (hiddenNow) {
    c.save(); c.globalAlpha = 0.45 + 0.1 * Math.sin(t * 5);
    c.fillStyle = k.col('#cfc0dc'); c.beginPath(); c.ellipse(p.x, y - 70 * s, 48 * s, 88 * s, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  tab(k, p.x, y, s);
  c.save();
  if (flicker) c.globalAlpha = 0.45;
  else if (hiddenNow) c.globalAlpha = 0.8;
  c.translate(p.x, y - (p.lift || 0));
  // seized by the collar: the film's prince in his own pose, hauled up a little
  const collared = st.phase === 'caught' && FILM && k.img('prince-collared');
  if (collared) {
    c.scale(s, s);
    drawPose(k, 'prince-collared', 0, -10 * clamp(st.phaseT / 0.4, 0, 1), 180, { face: p.face });
    c.restore();
    return;
  }
  if (st.phase === 'caught') c.rotate(-0.25 * clamp(st.phaseT / 0.5, 0, 1));
  c.scale(s * (p.frozen ? 1 : p.face), s);
  if (p.frozen) { if (!k.asset('sailor-crouch', 0, 0, 120, 150)) sailorBow(k); }
  else if (FILM && p.jumpT > 0) k.asset('sailor-leap', 0, 0, 110, 180);
  else {
    const stride = walkFrame('sailor', p.walk, 0.2);
    const walking = p.moving && st.phase === 'play';
    const id = walking ? stride : 'sailor-stand';
    if (!k.asset(id, 0, 0, 110, 180)) sailorStandin(k, walking ? walkStep(p.walk, 0.2) : 0, st.taken);
  }
  c.restore();
  // spotted: an exclamation over him while the beam holds
  if (st.gaze.lock > 0 && st.phase === 'play') {
    c.fillStyle = k.col('#e0127a'); c.font = '700 40px "Josefin Sans", sans-serif'; c.textAlign = 'center';
    c.fillText('!', p.x, y - 190 * s);
  }
}

// Over the courtiers: while he is hidden, a dashed outline shows where he
// stands and a closed eye says the court cannot see him.
function hiddenCue(k, st, t) {
  const c = k.c, p = st.p;
  if (!(p.hidden && p.frozen)) return;
  const s = rowScale(p), y = rowY(p);
  c.save();
  c.globalAlpha = 0.8; c.strokeStyle = k.col('#cfc0dc'); c.lineWidth = 2; c.setLineDash([5, 5]);
  c.beginPath(); c.ellipse(p.x, y - 72 * s, 30 * s, 80 * s, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  const ex = p.x, ey = y - 236 * s + Math.sin(t * 3) * 2;
  c.globalAlpha = 0.9; c.fillStyle = k.col('#2a1424'); k.circle(ex, ey, 17);
  c.strokeStyle = k.col('#cfc0dc'); c.lineWidth = 2.5; c.lineCap = 'round';
  c.beginPath(); c.arc(ex, ey - 7, 11, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
  for (const d of [-6, 0, 6]) { c.beginPath(); c.moveTo(ex + d, ey + 4); c.lineTo(ex + d * 1.4, ey + 9); c.stroke(); }
  c.restore();
}

function sailorStandin(k, stride, holdingPearl) {
  const c = k.c;
  // legs (grey trousers, black boots) scissoring with the stride
  c.fillStyle = k.col('#7d7a78');
  c.save(); c.translate(-6, -62); c.rotate(stride * 0.32); c.fillRect(-6, 0, 12, 56); c.fillStyle = k.col('#141014'); c.fillRect(-7, 50, 18, 10); c.restore();
  c.fillStyle = k.col('#8a8784');
  c.save(); c.translate(6, -62); c.rotate(-stride * 0.32); c.fillRect(-6, 0, 12, 56); c.fillStyle = k.col('#141014'); c.fillRect(-7, 50, 18, 10); c.restore();
  // navy pea coat
  c.fillStyle = k.col(NAVY);
  c.beginPath(); c.moveTo(-24, -54); c.lineTo(-20, -132); c.lineTo(20, -132); c.lineTo(26, -54); c.closePath(); c.fill();
  c.fillStyle = k.col('#d9b34a'); k.circle(12, -110, 2.5); k.circle(12, -92, 2.5); k.circle(12, -74, 2.5);
  // arm swinging
  c.fillStyle = k.col('#1e2740');
  c.save(); c.translate(0, -126); c.rotate(-stride * 0.4 + (holdingPearl ? -2.4 : 0)); c.fillRect(-6, 0, 12, 52); c.restore();
  // kit bag when standing
  if (stride === 0 && !holdingPearl) { c.fillStyle = k.col('#cbb89a'); c.beginPath(); c.ellipse(-20, -128, 16, 22, -0.4, 0, Math.PI * 2); c.fill(); }
  // red neckerchief, head, grey beard, flat cap
  c.fillStyle = k.col('#c8321e'); c.fillRect(-12, -138, 26, 8);
  c.fillStyle = k.col('#e7c9a8'); k.circle(2, -150, 14);
  c.fillStyle = k.col('#b9b4ac'); c.beginPath(); c.moveTo(-6, -148); c.quadraticCurveTo(6, -122, 17, -146); c.fill();
  c.fillStyle = k.col('#141014'); k.circle(9, -154, 2);
  c.fillStyle = k.col(NAVY); c.fillRect(-14, -170, 28, 9); c.fillRect(4, -163, 16, 4);
}

function sailorBow(k) {
  // front-on, frozen in a stiff courtly bow, hand on his cap
  const c = k.c;
  c.fillStyle = k.col('#7d7a78'); c.fillRect(-16, -56, 12, 50); c.fillRect(4, -56, 12, 50);
  c.fillStyle = k.col('#141014'); c.fillRect(-18, -8, 16, 8); c.fillRect(2, -8, 16, 8);
  c.fillStyle = k.col(NAVY);
  c.beginPath(); c.moveTo(-26, -50); c.lineTo(-22, -112); c.lineTo(22, -112); c.lineTo(26, -50); c.closePath(); c.fill();
  // arm across the chest, the other up to the cap
  c.fillStyle = k.col('#1e2740'); c.fillRect(-22, -100, 40, 10);
  c.save(); c.translate(18, -110); c.rotate(-2.6); c.fillRect(-5, 0, 10, 34); c.restore();
  // bowed head
  c.fillStyle = k.col('#c8321e'); c.fillRect(-12, -116, 24, 7);
  c.fillStyle = k.col('#e7c9a8'); k.circle(0, -122, 13);
  c.fillStyle = k.col('#b9b4ac'); c.beginPath(); c.moveTo(-11, -120); c.quadraticCurveTo(0, -100, 11, -120); c.fill();
  c.fillStyle = k.col(NAVY); c.fillRect(-15, -138, 30, 9);
}

// ---------------------------------------------------------------- sentries
function sentry(k, s, st, t) {
  const c = k.c, x = s.x, y = 652, asleep = st.carry.rose;
  if (k.asset(s.open ? 'sentry-creature-open' : 'sentry-creature-closed', x, y - 2, 176, 120)) {
    if (asleep) sleepZ(k, x + 56, y - 96, t);
    return;
  }
  // a crouching coral-red beast facing right, with a finned crest
  c.fillStyle = k.col('#c8321e');
  c.beginPath(); c.ellipse(x - 10, y - 38, 62, 36, 0, Math.PI, 0); c.fill();
  c.fillRect(-72 + x, y - 40, 124, 40);
  // curled tail
  c.strokeStyle = k.col('#c8321e'); c.lineWidth = 12; c.lineCap = 'round';
  c.beginPath(); c.arc(x - 78, y - 34, 18, -0.4, 3.6); c.stroke();
  // crest
  c.fillStyle = k.col(s.open ? '#e0127a' : '#e9a46a');
  for (let i = 0; i < 5; i++) { const cx = x - 50 + i * 20, h = s.open ? 30 : 18; c.beginPath(); c.moveTo(cx - 9, y - 66); c.lineTo(cx, y - 66 - h); c.lineTo(cx + 9, y - 66); c.fill(); }
  // scales
  c.fillStyle = k.col('#8e1f14');
  for (let i = 0; i < 6; i++) k.circle(x - 50 + i * 18, y - 22 - (i % 2) * 10, 4);
  // head and jaws
  const open = s.open ? 0.75 : 0;
  c.fillStyle = k.col('#c8321e');
  c.fillRect(x + 40, y - 24, 52, 22);                         // lower jaw
  c.save(); c.translate(x + 40, y - 26); c.rotate(-open);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(58, 0); c.lineTo(52, -22); c.lineTo(0, -34); c.closePath(); c.fill();
  c.fillStyle = k.col('#f4f1ea'); for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(10 + i * 10, 0); c.lineTo(15 + i * 10, 8); c.lineTo(20 + i * 10, 0); c.fill(); }
  c.fillStyle = k.col(asleep ? '#2a1424' : '#e3c13b');
  if (asleep) c.fillRect(14, -24, 12, 3); else k.circle(20, -22, 6);
  if (!asleep) { c.fillStyle = k.col('#2a1424'); k.circle(22, -22, 2.5); }
  c.restore();
  if (s.open) {
    c.fillStyle = k.col('#4a0a18'); c.beginPath(); c.moveTo(x + 40, y - 26); c.lineTo(x + 92, y - 26); c.lineTo(x + 40 + Math.cos(-open) * 58, y - 26 + Math.sin(-open) * 58); c.fill();
    c.fillStyle = k.col('#f4f1ea'); for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x + 50 + i * 10, y - 24); c.lineTo(x + 55 + i * 10, y - 32); c.lineTo(x + 60 + i * 10, y - 24); c.fill(); }
  }
  if (asleep) sleepZ(k, x + 60, y - 80, t);
}

function sleepZ(k, x, y, t) {
  const c = k.c;
  c.fillStyle = k.col('#eef3ea'); c.font = '700 18px "Josefin Sans", sans-serif'; c.textAlign = 'center';
  for (let i = 0; i < 2; i++) {
    const f = (t * 0.5 + i * 0.5) % 1;
    c.globalAlpha = 1 - f; c.fillText('z', x + f * 14, y - f * 30);
  }
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------- the gaze
function beam(k, st, t) {
  const c = k.c, g = st.gaze;
  if (st.phase !== 'play' && st.phase !== 'caught') return;
  // The cone only shows while the beam sweeps; dark or winding up, the hall is dim.
  const blind = st.masked || !['sweep', 'fade'].includes(g.phase);
  const fade = g.phase === 'fade' ? 1 - clamp(g.t / g.dur, 0, 1) : 1;
  const spot = g.lock > 0 || st.phase === 'caught';
  const light = FILM ? (spot ? '#ff384f' : '#f16a66') : spot ? '#e0127a' : '#ffe9a8';
  c.save();
  // Stage lighting: the hall is dimmed everywhere the gaze is not.
  c.fillStyle = k.col('#140a16'); c.globalAlpha = 0.32;
  c.beginPath(); c.rect(0, 60, 1280, 592);
  if (!blind) beamPath(c, g.aim, st.cam, false, g.dir);
  c.fill('evenodd');
  if (!blind) {
    // warm light in the cone and pools on the grooves
    c.fillStyle = k.col(light);
    c.globalAlpha = fade * (spot ? 0.3 : FILM ? 0.23 : 0.14); beamPath(c, g.aim, st.cam, true, g.dir); c.fill();
    c.globalAlpha = fade * (spot ? 0.4 : 0.26);
    for (let r = 0; r < 3; r++) {
      const b = beamOn(g.aim - st.cam, r, g.dir);
      c.beginPath(); c.ellipse(b.cx, ROWY[r], b.hw, 9 * ROWSCALE[r], 0, 0, Math.PI * 2); c.fill();
    }
    // the beam's edge, so its reach reads clearly
    c.globalAlpha = 0.75 * fade; c.strokeStyle = k.col(light); c.lineWidth = 2;
    beamPath(c, g.aim, st.cam, true, g.dir); c.stroke();
  }
  // the lantern's eye glows above the dimming
  const lx = backX(LANTERN_BX, st.cam);
  c.globalAlpha = st.masked || g.phase === 'dark' ? 0.2 : 0.55; c.fillStyle = k.col(light); k.circle(lx + 3, FILM ? 300 : LANTERN_Y, 12);
  c.restore();
}

// The beam's outline: from the lantern's eye down to a long pool across the
// grooves (the same x band on each, as the rules have it).
function beamPath(c, aim, cam, fresh = true, dir = 1) {
  const b0 = beamOn(aim - cam, 0, dir), b2 = beamOn(aim - cam, 2, dir), y0 = ROWY[0] - 12, y2 = ROWY[2] + 30;
  const lx = backX(LANTERN_BX, cam) + 3, ly = FILM ? 300 : LANTERN_Y;
  if (fresh) c.beginPath();
  c.moveTo(lx - 14, ly); c.lineTo(lx + 14, ly);
  c.lineTo(b0.cx + b0.hw, y0); c.lineTo(b2.cx + b2.hw + 3, y2); c.lineTo(b2.cx - b2.hw - 3, y2); c.lineTo(b0.cx - b0.hw, y0);
  c.closePath();
}

// The sweep is telegraphed: while the lantern winds up (and its eye pulses),
// light gathers in the wing the beam will enter from and three chevrons there
// point the way it will travel.
function telegraph(k, st, t) {
  const c = k.c, g = st.gaze;
  if (st.phase !== 'play' || g.phase !== 'warn') return;
  const dir = g.dir || 1, wingIn = dir > 0 ? 170 : 1110, show = clamp(g.t / 0.25, 0, 1);
  c.save();
  // light gathers in the wing the beam will come from
  const gl = c.createLinearGradient(wingIn, 0, wingIn + dir * 300, 0);
  gl.addColorStop(0, k.col(FILM ? '#fa8d87' : '#fff2c0')); gl.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = 0.45 * clamp(g.t / g.dur, 0, 1) + 0.12; c.fillStyle = gl;
  c.fillRect(Math.min(wingIn, wingIn + dir * 300), 300, 300, 330);
  // and three chevrons, lighting in turn, point the way it will travel
  c.fillStyle = k.col(FILM ? '#ff7470' : '#ffd75e'); c.strokeStyle = k.col('#2a1424'); c.lineWidth = 3; c.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const x = wingIn + dir * (50 + i * 50), cy = 500;
    c.globalAlpha = show * (((t * 3 - i) % 3 + 3) % 3 < 1.2 ? 1 : 0.4);
    c.beginPath(); c.moveTo(x - dir * 18, cy - 38); c.lineTo(x + dir * 20, cy); c.lineTo(x - dir * 18, cy + 38); c.lineTo(x - dir * 4, cy); c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
}

function omens(k, st, t) {
  for (const o of st.omens) {
    k.c.save(); k.c.globalAlpha = 0.85;
    k.omen?.(o.x - st.cam, o.y + Math.sin(t * 6) * 3, 1);
    k.c.restore();
  }
}

// ---------------------------------------------------------------- whale and fish
function passers(k, st, t) {
  const c = k.c, w = st.whale, f = st.fish;
  // the whale's coming: bubbles at the right wing
  if (w.t < 0 && w.next < 2.2 && st.phase === 'play') {
    c.fillStyle = k.col('#eef3ea');
    for (let i = 0; i < 9; i++) { const yy = 420 - ((t * 120 + i * 47) % 340); c.globalAlpha = 0.6 * (1 - w.next / 2.2); k.circle(1090 + ((i * 29) % 50), yy, 3 + (i % 3) * 2); }
    c.globalAlpha = 1;
  }
  if (f.t >= 0) {
    const x = fishX(f.t), y = 250 + Math.sin(f.t * 3) * 10;
    k.wire(x, 60, y - 60);
    if (!k.asset('fish-large', x, y + 100, 350, 200)) fishStandin(k, x, y, t);
  }
  if (w.t >= 0) {
    // high over the hall, clear above the court (its belly ~y 380, the top
    // row at 432), so it reads as passing over him rather than upon him
    const x = whaleX(w.t), y = 196 + Math.sin(w.t * 1.6) * 8;
    k.wire(x - 250, 60, y - 150); k.wire(x + 250, 60, y - 130);
    c.save(); c.globalAlpha = 0.94;
    if (!k.asset('whale-side', x, y + 183, 1000, 366)) whaleStandin(k, x, y, w.t);
    c.restore();
    // the sailor stays legible through the whale: a pale outline
    const p = st.p, s = rowScale(p), py = rowY(p), px = p.x - st.cam;
    if (Math.abs(px - x) < 520 && py - 170 * s < y + 180) {
      c.save(); c.globalAlpha = 0.7; c.strokeStyle = k.col('#f1e3c8'); c.lineWidth = 2; c.setLineDash([5, 5]);
      c.beginPath(); c.ellipse(px, py - 80 * s, 30 * s, 90 * s, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.restore();
    }
  }
}

function whaleStandin(k, x, y, wt) {
  const c = k.c;
  // body: a long slate flat, head to the left
  c.fillStyle = k.col('#2c3438');
  c.beginPath();
  c.moveTo(x - 500, y + 10);
  c.quadraticCurveTo(x - 500, y - 150, x - 260, y - 165);
  c.quadraticCurveTo(x + 150, y - 175, x + 380, y - 60);
  c.lineTo(x + 470, y - 140); c.lineTo(x + 500, y - 110); c.lineTo(x + 440, y - 20); c.lineTo(x + 500, y + 80); c.lineTo(x + 460, y + 90); c.lineTo(x + 380, y + 20);
  c.quadraticCurveTo(x + 100, y + 175, x - 300, y + 160);
  c.quadraticCurveTo(x - 490, y + 140, x - 500, y + 10);
  c.fill();
  // pale ridged throat
  c.fillStyle = k.col('#bfb6a8');
  c.beginPath(); c.moveTo(x - 480, y + 60); c.quadraticCurveTo(x - 200, y + 190, x + 120, y + 120); c.quadraticCurveTo(x - 200, y + 140, x - 480, y + 60); c.fill();
  c.strokeStyle = k.col('#7f786e'); c.lineWidth = 2;
  for (let i = 0; i < 8; i++) { const xx = x - 420 + i * 60; c.beginPath(); c.moveTo(xx, y + 88 + i * 4); c.lineTo(xx + 50, y + 128 - i * 1); c.stroke(); }
  // mouth line, small knowing eye, flipper, barnacles
  c.strokeStyle = k.col('#141014'); c.lineWidth = 4;
  c.beginPath(); c.moveTo(x - 496, y + 20); c.quadraticCurveTo(x - 380, y + 60, x - 260, y + 40); c.stroke();
  c.fillStyle = k.col('#f1e3c8'); k.circle(x - 300, y - 30, 9);
  c.fillStyle = k.col('#141014'); k.circle(x - 302, y - 30, 4);
  c.fillStyle = k.col('#1d2427');
  c.beginPath(); c.moveTo(x - 160, y + 80); c.quadraticCurveTo(x - 120, y + 170, x - 40, y + 190); c.quadraticCurveTo(x - 90, y + 120, x - 90, y + 70); c.fill();
  c.fillStyle = k.col('#8a857c');
  for (let i = 0; i < 7; i++) k.circle(x - 200 + i * 70, y - 120 + (i % 3) * 18, 5 + (i % 2) * 3);
  // a spout as it glides
  c.fillStyle = k.col('#eef3ea'); c.globalAlpha *= 0.5;
  const h = 30 + Math.sin(wt * 4) * 10;
  c.beginPath(); c.moveTo(x - 220, y - 165); c.quadraticCurveTo(x - 250, y - 165 - h, x - 280, y - 170 - h * 1.4); c.quadraticCurveTo(x - 220, y - 175 - h, x - 220, y - 165); c.fill();
}

function fishStandin(k, x, y, t) {
  const c = k.c;
  c.fillStyle = k.col('#d9b34a');
  c.beginPath(); c.ellipse(x, y, 130, 70, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = k.col('#c8321e');
  c.beginPath(); c.moveTo(x + 110, y); c.lineTo(x + 175, y - 70 + Math.sin(t * 8) * 8); c.lineTo(x + 175, y + 70 + Math.sin(t * 8) * 8); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(x - 50, y - 60); c.quadraticCurveTo(x, y - 120, x + 60, y - 60); c.fill();
  c.beginPath(); c.moveTo(x - 30, y + 60); c.quadraticCurveTo(x + 10, y + 105, x + 50, y + 60); c.fill();
  c.strokeStyle = k.col('#c8321e'); c.lineWidth = 2;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(x - 30 + i * 30, y, 26, -1, 1); c.stroke(); }
  c.fillStyle = k.col('#f4f1ea'); k.circle(x - 80, y - 14, 18);
  c.fillStyle = k.col('#141014'); k.circle(x - 86, y - 14, 8);
  c.strokeStyle = k.col('#141014'); c.lineWidth = 3; c.beginPath(); c.arc(x - 118, y + 12, 10, 0.2, 1.8); c.stroke();
}

// ---------------------------------------------------------------- the swallow
// the nearest attendant on screen dives in after him
function diver(st) {
  let best = null;
  for (const c of st.courtiers) if (c.kind !== 'guard' && (!best || Math.abs(c.x - st.p.x) < Math.abs(best.x - st.p.x))) best = c;
  return best;
}

function outro(k, st, t) {
  const c = k.c, ph = st.phase;
  let grow, open;
  if (ph === 'turn') { const f = easeOut(st.phaseT / OUTRO.turn); grow = 0.35 + 0.65 * f; open = easeInOut((st.phaseT - 0.6) / 1.2); }
  else if (ph === 'lunge') { const f = easeInOut(st.phaseT / OUTRO.lunge); grow = 1 + 2.2 * f; open = 1; }
  else { grow = 3.2; open = 1; }
  const W = 800 * grow, H = 600 * grow, cx = 640;
  // rising from below the floor, then lunging so its throat fills the stage
  const throat = k.img('whale-mouth') ? 0.41 : 0.4; // the painted gullet's centre, up from the bottom
  const by = grow <= 1 ? 720 + (1 - grow) * 260 : lerp(720 - throat * 600, 400, (grow - 1) / 2.2) + throat * H;
  c.save(); c.globalAlpha = 1;
  if (!k.asset('whale-mouth', cx, by, W, H)) whaleMouthStandin(k, cx, by, W, H, open);
  c.restore();
  // the sailor and one courtier are pulled into the throat
  if (ph === 'lunge') {
    const f = easeInOut(st.phaseT / OUTRO.lunge), p = st.p;
    const mx = cx, my = by - H * throat;
    const sx = lerp(p.x - st.cam, mx, f), sy = lerp(rowY(p), my, f) - Math.sin(f * Math.PI) * 120, s = rowScale(p) * (1 - f * 0.8);
    // the film's prince and courtier tumble in their own limp poses (F20),
    // the courtier at her standing size (design/person-sizes.md)
    if (FILM && k.img('prince-tumble-a')) { c.save(); c.translate(sx, sy); c.scale(s, s); drawPose(k, f < 0.5 ? 'prince-tumble-a' : 'prince-tumble-b', 0, 90 - 40, 180, { rot: f * 1.6, pivot: 90 }); c.restore(); }
    else { c.save(); c.translate(sx, sy); c.rotate(f * 3); c.scale(s, s); if (!k.asset('sailor-crouch', 0, 0, 120, 150)) sailorBow(k); c.restore(); }
    const d = diver(st), g = clamp((st.phaseT - 0.15) / 0.7, 0, 1);
    const dx = lerp(d.x - st.cam, mx + 40, g), dy = lerp(ROWY[d.row], my, g) - Math.sin(g * Math.PI) * 220, ds = ROWSCALE[d.row] * (1 - g * 0.8);
    if (FILM && k.img('attendant-' + d.kind + '-tumble')) { c.save(); c.translate(dx, dy); c.scale(ds, ds); drawPose(k, 'attendant-' + d.kind + '-tumble', 0, 75 - 60, 210, { std: personPx(k, 'attendant-' + d.kind + '-tumble'), rot: -g * 1.4, pivot: 75 }); c.restore(); }
    else { c.save(); c.translate(dx, dy); c.rotate(-g * 2.6); c.scale(ds, ds); if (!k.asset('attendant-' + d.kind, 0, 0, 110, 210)) attendantStandin(k, d.kind); c.restore(); }
  }
}

function whaleMouthStandin(k, cx, by, W, H, open) {
  const c = k.c, cy = by - H * 0.48;
  c.fillStyle = k.col('#2c3438');
  c.beginPath(); c.ellipse(cx, cy, W * 0.5, H * 0.5, 0, 0, Math.PI * 2); c.fill();
  // eyes on the flanks
  c.fillStyle = k.col('#f1e3c8'); k.circle(cx - W * 0.4, cy - H * 0.22, 10 * W / 800); k.circle(cx + W * 0.4, cy - H * 0.22, 10 * W / 800);
  c.fillStyle = k.col('#141014'); k.circle(cx - W * 0.4, cy - H * 0.22, 4 * W / 800); k.circle(cx + W * 0.4, cy - H * 0.22, 4 * W / 800);
  // pink mouth with baleen and a dark throat
  const mw = W * 0.38, mh = H * (0.08 + 0.32 * open);
  c.fillStyle = k.col('#e7a6bd'); c.beginPath(); c.ellipse(cx, cy + H * 0.05, mw, mh, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = k.col('#1a0a10'); c.beginPath(); c.ellipse(cx, cy + H * 0.08, mw * 0.55, mh * 0.6, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = k.col('#f1e3c8'); c.lineWidth = Math.max(1.5, 2 * W / 800);
  for (let i = -8; i <= 8; i++) { const x = cx + (i / 8) * mw * 0.9; c.beginPath(); c.moveTo(x, cy + H * 0.05 - mh * 0.95 * Math.sqrt(1 - (i / 8.6) ** 2)); c.lineTo(x, cy + H * 0.05 - mh * 0.55 * Math.sqrt(1 - (i / 8.6) ** 2)); c.stroke(); }
}
