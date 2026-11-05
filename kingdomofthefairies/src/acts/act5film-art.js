import { GIFT_SHOW } from './prologue-timing.js';
import { walkFrame } from '../walking.js';
import { weddingForeground } from '../wedding-foreground.js';
import { CREDITS, FINALE, finaleFrame } from '../finale.js';
// Drawing for the film edition's Act V and Act VI (act5film.js). The climbs,
// the burning interior's floors, connectors and hazards, and the carry reuse
// Act V's drawing (act5-art.js); the sea gap, the tower wall, the tower's
// stone interior, the clifftop and the tableaux are new. Every requested
// piece of art is delivered; production waits for it before play. Draw only
// from state and t. Compatibility fallbacks support older review harnesses.
import { SWIM, TOWER_TOP, TOWER_WINDOW, FILM_T, BARREL, DUEL, DIVE, WEDDING, APOTH, weddingGuests, guestHop, AURORA, auroraFacing, weddingScale, diveFloor, swimPosition, TOWER_ESCAPE, towerEscapeFire, towerLeftFire, TOWER_FIRE, BATTLE_INTRO, battleIntroFrame, creditsDone, TREASURE, treasures, pileSlot, GIFTING, nearGiftFairy, canReceiveGift, giftPromptAlpha, pileCount } from './act5film.js';
import { HOUSE, QUAY, T, climberPos } from './act5.js';
import {
  onEvent as act5Event, cliffScene, holds, climbGuide, climber, rocksWorld, rockWarnings,
  connector, flames, hazards, player, rubble, beloved,
} from './act5-art.js';
import { card, cardAlpha } from './tableau.js';
import { clamp, lerp, easeOut, easeInOut } from './shared.js';
import { richText, measureRichText } from '../art.js';   // headless-safe: art.js touches no DOM at load
import { drawPose, drawPerson, personPx, personScale } from '../pose.js';
import { TEXT } from '../text_config.js';

// ================================================================= Act V
export function drawTower(k, st, t) {
  const ph = st.phase;
  if (ph === 'cliff') return cliffScene(k, st, t);
  if (ph === 'dive') return diveScene(k, st, t);
  if (ph === 'swim') return swimScene(k, st, t);
  if (ph === 'tower') return towerScene(k, st, t);
  const pt = ph === 'window' ? st.phaseT : FILM_T.window + st.phaseT;
  // Her window at the top of the wall (she has been at it all the climb), the
  // prince beside her.
  towerScene(k, st, t);
  card(k, TEXT.tower.window.title, TEXT.tower.window.sub, cardAlpha(pt, FILM_T.window + 9));
}

// The mobile camera's focus (src/camera.js): the player's middle, stage px.
// The sea gap, where the witch swoops across the stage and Aurora's light
// drives her off, plays on the whole stage, as do the window and the scenes
// between.
// The surface cutouts share a registered head and invisible waterline (the
// neck at art (234, 96), 40% down): drawn at the prince's measured person
// scale with that point on (x, y), so switching strokes never lifts him.
export const SURFACE_SWIM = { headX: 234, waterY: 96 };
export function drawSurfaceSwimmer(k, id, x, y, height = 124) {
  const im = k.img(id), scale = personScale(k, id, height);
  if (!im || !scale) return false;
  const width = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
  return drawPerson(k, id, x + (width / 2 - SURFACE_SWIM.headX) * scale, y + (h - SURFACE_SWIM.waterY) * scale, height);
}

export function focusTower(st) {
  if (st.phase === 'cliff' || st.phase === 'tower') { const p = climberPos(st); return { x: p.x, y: 640 + st.camY - p.y - 40 }; }
  if (st.phase === 'dive') return st.w && !st.dv ? { x: st.w.x, y: st.w.y - 70 } : null;
  return null;
}
export const focusBurning = st => {
  if (st.phase === 'barrel' || st.phase === 'victory') {
    if (st.battleIntro || st.phase === 'victory' || st.barrel?.fallT != null) return null;
    // Keep the sheltered princess, Aurora and witch in the phone framing.
    return { x: 460, y: BARREL.y-80 };
  }
  return st.p ? { x: st.p.x, y: st.p.y-75 } : null;
};

export function drawOverTower(k, st) {
  if (st.defeatT != null) k.wash('#2a1424', 0.55 * clamp(st.defeatT / FILM_T.defeat, 0, 1));
  if (st.phase === 'iris') k.iris(TOWER_WINDOW.x, 640 + st.camY - TOWER_TOP - 50, 760 * (1 - easeInOut(st.phaseT / FILM_T.iris)));
  if (st.status === 'won') k.iris(TOWER_WINDOW.x, 640 + st.camY - TOWER_TOP - 50, 0);
}

export function onEventTower(k, e, st) {
  if (e.type === 'diveLeap') return;
  if (e.type === 'diveSplash') { k.shake(0.3); k.burst(e.x, e.y ?? DIVE.water, '#eef3ea', 30, 'drop'); return; }
  if (st.phase === 'swim' || e.type === 'towerFoot') {
    const {x:px} = swimPosition(st.sw), py = swimY(st);
    if (e.type === 'dive') k.burst(px, py - 10, '#eef3ea', 12, 'drop');
    if (e.type === 'surface') k.burst(px, py - 10, '#eef3ea', 6, 'drop');
    if (e.type === 'witchMiss') { k.burst(swoopScreenX(st), 470, '#eef3ea', 18, 'drop'); k.text(TEXT.tower.burst.missed, swoopScreenX(st), 380); }
    if (e.type === 'hit') { k.shake(0.4); k.burst(px, py - 30, '#c8321e', 14, 'streak'); }
    if (e.type === 'auroraLight') { k.flash(0.6); k.burst(220, 140, '#fff2b0', 40, 'sparkle'); k.text(TEXT.tower.burst.auroraLight, 640, 230, true); }
    return;
  }
  act5Event(k, e, st);
}

// ---------------------------------------------------------------- the sea gap
// the waterline he swims along: in the painted swell of the coast-gap cloth
const SURFACE = 550;
const swimY = (st) => swimPosition(st.sw).y + (st.sw?.dive > 0 ? 70 * Math.sin(Math.PI * clamp(1 - st.sw.dive / SWIM.dive, 0, 1)) + 20 : 0);
const swoopScreenX = st => st.sw?.swoop ? swimPosition({x:st.sw.swoop.x}).x : -999;

function swimScene(k, st, t) {
  const c = k.c, sw = st.sw, f = sw.x / SWIM.len;
  const position = swimPosition(sw), px = position.x;
  // Keep the coast registered to the preceding dive; move through its open
  // channel rather than panning a cliff across a screen-fixed swimmer.
  const cloth = () => k.asset('coast-gap',640,720,1280,720);
  cloth();
  const cliffX = 300;
  // the witch's shadow on the water, then her swoop
  if (sw.swoop) {
    const x = swoopScreenX(st), k2 = clamp(sw.swoop.t / sw.swoop.lead, 0, 1);
    c.save(); c.globalAlpha = 0.25 + 0.45 * k2; c.fillStyle = k.col('#0b0710');
    c.beginPath(); c.ellipse(x, SURFACE + 12, 40 + 50 * k2, 10 + 6 * k2, 0, 0, Math.PI * 2); c.fill(); c.restore();
    const wy = lerp(-80, SURFACE - 40, easeOut(k2)), wx = x + (1 - k2) * 260;
    c.save(); c.translate(wx, wy); c.rotate(-0.5 * (1 - k2));
    if (!k.asset('witch-swoop', 0, 60, 200, 120) && !k.asset('witch-hooded', 0, 60, 70, 120)) { c.fillStyle = k.col('#1f3a3c'); k.circle(0, 20, 28); }
    c.restore();
  }
  // Aurora's light from the cliff drives her off
  if (sw.aurora != null) {
    const a = clamp(1 - sw.aurora / SWIM.aurora, 0, 1);
    if (a > 0) {
      c.save(); c.globalAlpha = 0.5 * a; c.strokeStyle = k.col('#fff2b0'); c.lineWidth = 8;
      c.beginPath(); c.moveTo(cliffX + 60, 150); c.lineTo(900 + sw.aurora * 300, 60); c.stroke();
      c.restore();
      if (!k.asset('aurora-stand', cliffX + 70, 190, 70, 112)) { c.fillStyle = k.col('#f4ead2'); k.circle(cliffX + 70, 150, 16); }
    }
  }
  // the prince, swimming at the surface or diving under it: every stroke on
  // the one scale (his standing figure 124 px; the audit evens the strokes)
  const y = swimY(st);
  c.save();
  if (st.inv > 0 && Math.floor(st.inv * 10) % 2) c.globalAlpha = 0.45;
  const ab = Math.floor(sw.stroke * 4) % 2 ? 'a' : 'b';
  // at the surface: the front-crawl frames once delivered (their waterline
  // 40% down the canvas), else the stroke frames sunk to the head and arms
  const surf = sw.dive <= 0 && k.img('prince-swim-surface-' + ab) ? 'prince-swim-surface-' + ab : null;
  const id = surf || (sw.dive > 0 ? 'prince-swim-under-' : 'prince-swim-') + ab;
  const by = surf ? y + 83 * 0.6 - 2 : y + 35;   // surf: its waterline on the sea's
  if (position.land > .65) drawPose(k, position.land < 1 ? 'prince-mantle-c' : 'prince-stand', px, y, 124);
  else if (!(surf ? drawSurfaceSwimmer(k, surf, px, y, 124) : drawPose(k, id, px, by, 124)) && !k.asset('sailor-swim-' + ab, px, y + 35, 124, 83)) { c.fillStyle = k.col('#2b3550'); c.fillRect(380, y - 12, 80, 22); }
  c.restore();
  // the sea over him below its rippling waterline: the painted water laid
  // back over his lower half at the surface, and over all of him when he
  // dives (no box: the cloth itself, clipped to the water)
  const under = sw.dive > 0 ? Math.sin(Math.PI * clamp(1 - sw.dive / SWIM.dive, 0, 1)) : 0;
  // He swims in the sea, not on it: the water closes over all but his head
  // and arms (the delivered surface frames paint the rest faint themselves).
  const line = surf ? y - 2 : y - 16;
  c.save();
  c.beginPath(); c.moveTo(px-105, 720);
  for (let x = px-105; x <= px+105; x += 10) c.lineTo(x, line + Math.sin(x * 0.05 + t * 3) * 3);
  c.lineTo(px+105, 720); c.closePath(); c.clip();
  c.globalAlpha = surf ? 0.55 : 0.92;
  if (position.land <= .65) cloth();
  c.restore();
  if (position.land <= .65) {
    // diving under her swoop he shows lit beneath the surface for a moment
    if (under > 0 && k.img('prince-swim-under-' + ab)) {
      c.save(); c.globalAlpha = 0.72 * under; drawPose(k, 'prince-swim-under-' + ab, px, y + 35, 124);
      c.globalAlpha = 0.18 * under; c.fillStyle = k.col('#9fd8d0'); c.beginPath(); c.ellipse(px, y - 6, 80, 34, 0, 0, Math.PI * 2); c.fill(); c.restore();
    }
    // spray thrown up by each stroke at the surface
    if (sw.dive <= 0) strokeSpray(k, px, line, sw.stroke, t);
  }
  // how far to the tower (fixed to the screen through the mobile camera)
  (k.flat || ((g) => g()))(() => {
  c.save(); c.globalAlpha = 0.85; c.fillStyle = k.col('#2a1424'); c.beginPath(); c.roundRect(440, 96, 400, 14, 7); c.fill();
  c.fillStyle = k.col('#d9b34a'); c.beginPath(); c.roundRect(442, 98, 396 * f, 10, 5); c.fill(); c.restore();
  if (st.phaseT < 6) {
    c.save(); c.globalAlpha = clamp(1 - (st.phaseT - 4.5) / 1.5, 0, 1); c.textAlign = 'center';
    c.font = '700 18px "Josefin Sans", sans-serif'; c.fillStyle = k.col('#f1e3c8');
    richText(c, TEXT.tower.swimHint, 640, 150, { px: 18, mode: k.inputMode || 'key', col: k.col });
    c.restore();
  }
  });
}

function towerSilhouette(k, x, base, s, t) {
  const c = k.c, w = 120 * s, h = 300 * s;
  c.fillStyle = k.col('#16121c');
  c.fillRect(x - w * 0.8, base - 40 * s, w * 1.6, 40 * s);         // its rock
  c.fillRect(x - w / 2, base - h, w, h);
  for (let i = -2; i <= 2; i++) c.fillRect(x + i * w / 5 - w / 12, base - h - 16 * s, w / 6, 16 * s);
  c.fillStyle = k.col('#e9c46a'); c.globalAlpha = 0.6 + 0.3 * Math.sin(t * 3);
  c.fillRect(x - 8 * s, base - h * 0.82, 16 * s, 24 * s);          // her window
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------- the tower wall
const WALL = { x0: 400, x1: 880 };
// Azurine looking out of her window, in the painted arch above its sill, all
// through the climb, with a warm light behind her, so he can see from below
// which window he is climbing to.
function azurineAtWindow(k, t) {
  const c = k.c, x = TOWER_WINDOW.x, y = -TOWER_TOP - 44;
  const g = c.createRadialGradient(x, y, 6, x, y, 70);
  g.addColorStop(0, `rgba(255,214,140,${0.55 + 0.15 * Math.sin(t * 2.2)})`); g.addColorStop(1, 'rgba(255,214,140,0)');
  c.fillStyle = g; c.fillRect(x - 70, y - 70, 140, 140);
  if (!k.asset('azurine-window', x, -TOWER_TOP + 5, 64, 80)) { c.fillStyle = k.col('#c9d8ee'); k.circle(x, -TOWER_TOP - 50, 14); }
}

function towerScene(k, st, t) {
  const c = k.c, cam = st.camY;
  const g = c.createLinearGradient(0, 0, 0, 720);
  g.addColorStop(0, k.col('#1c1630')); g.addColorStop(1, k.col('#34405a'));
  c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
  k.moon(1080, 140 + cam * 0.04, 40);
  c.save(); c.translate(0, 640 + cam);
  const lo = Math.max(-120, cam - 120), hi = cam + 720;
  if (lo < 60) {  // the sea breaking at its foot
    c.fillStyle = k.col('#1d3b44'); c.fillRect(0, 0, 1280, 220);
    c.strokeStyle = k.col('#eef3ea'); c.lineWidth = 3;
    for (let i = 0; i < 3; i++) { c.beginPath(); for (let x = 0; x <= 1280; x += 30) c.lineTo(x, 20 + i * 26 + Math.sin(x * 0.04 + t * 2 + i) * 5); c.stroke(); }
  }
  // the wall: the delivered tall cloth, or painted stone courses
  if (!k.asset('tower-wall-tall', 640, 30, 760, 760 * 3600 / 1400)) {
    c.fillStyle = k.col('#6d6872'); c.fillRect(WALL.x0, -TOWER_TOP - 40, WALL.x1 - WALL.x0, TOWER_TOP + 80);
    c.fillStyle = k.col('#57525c');
    for (let wy = Math.max(0, Math.floor(lo / 44) * 44); wy < Math.min(TOWER_TOP + 40, hi); wy += 44) {
      const off = (wy / 44) % 2 ? 0 : 40;
      for (let x = WALL.x0 - off; x < WALL.x1; x += 80) { c.fillRect(Math.max(WALL.x0, x), -wy - 2, 3, 44); }
      c.fillRect(WALL.x0, -wy, WALL.x1 - WALL.x0, 3);
    }
    // ivy trailing down the stones
    for (let i = 0; i < 9; i++) {
      const x = WALL.x0 + 30 + ((i * 131) % (WALL.x1 - WALL.x0 - 60)), wy0 = (i * 211) % (TOWER_TOP - 200) + 160;
      c.strokeStyle = k.col('#3f5a34'); c.lineWidth = 2.5; c.beginPath();
      for (let d = 0; d < 180; d += 12) c.lineTo(x + Math.sin((wy0 + d) * 0.07) * 7, -wy0 + d);
      c.stroke();
      c.fillStyle = k.col(i % 2 ? '#5f7d4a' : '#6f9a4a');
      for (let d = 6; d < 180; d += 18) { const lx2 = x + Math.sin((wy0 + d) * 0.07) * 7; k.circle(lx2 + 6, -wy0 + d, 5); k.circle(lx2 - 6, -wy0 + d + 8, 4); }
    }
    // battlements and her window at the top
    c.fillStyle = k.col('#6d6872');
    for (let x = WALL.x0; x < WALL.x1; x += 64) c.fillRect(x, -TOWER_TOP - 80, 40, 42);
  }
  if (k.img('tower-wall-tall')) { /* the cloth paints her window */ }
  else if (!k.asset('tower-window', 640, -TOWER_TOP + 10, 100, 130)) {
    c.fillStyle = k.col('#e9c46a'); c.globalAlpha = 0.7 + 0.25 * Math.sin(t * 3);
    c.beginPath(); c.moveTo(600, -TOWER_TOP + 6); c.lineTo(600, -TOWER_TOP - 70); c.arc(640, -TOWER_TOP - 70, 40, Math.PI, 0); c.lineTo(680, -TOWER_TOP + 6); c.closePath(); c.fill();
    c.globalAlpha = 1; c.fillStyle = k.col('#2a2430');
    for (const x of [616, 640, 664]) c.fillRect(x - 2, -TOWER_TOP - 100, 4, 106);
  }
  azurineAtWindow(k, t);
  holds(k, st, t);
  c.restore();
  c.save(); c.translate(0, 640 + cam);
  rocksWorld(k, st, t);
  climbGuide(k, st, t);
  climber(k, st, t);
  c.restore();
  rockWarnings(k, st, t);
}

// ================================================================= Act VI
export function drawBurning(k, st, t) {
  const ph = st.phase;
  if (ph === 'house') return towerInterior(k, st, t);
  if (ph === 'quay') return clifftop(k, st, t);
  if (ph === 'barrel' || ph === 'victory') return barrelScene(k, st, t);
  if (ph === 'wedding') return wedding(k, st, t);
  apotheosis(k, st, t);
  weddingGiftReveal(k, st, t);
}

export function drawOverBurning(k, st) {
  if (st.creditsT != null) rollingCredits(k, st.creditsT);
  // the credits over and the stage lit again: the way back to the title
  if (creditsDone(st) && st.leaveT == null && !nearGiftFairy(st)) hint(k, k.inputMode === 'touch' ? TEXT.burning.returnTouch : TEXT.burning.returnKey);
  if (st.defeatT != null) k.wash('#2a1424', 0.55 * clamp(st.defeatT / FILM_T.defeat, 0, 1));
  if (st.phase === 'iris') k.iris(640, 300, 760 * (1 - easeInOut(st.phaseT / FILM_T.iris)));
  if (st.status === 'won') k.iris(640, 300, 0);
}

export function onEventBurning(k, e, st) {
  if (e.type === 'auroraQuenches') { k.burst(e.x, e.y, '#fff2b0', 8, 'sparkle'); return; }
  if (e.type === 'witchStruck') { k.flash(0.3); k.shake(0.25); k.burst(e.x - 20, BARREL.y - 110, '#fff2b0', 22, 'sparkle'); if (e.hp > 0) k.text(e.hp === 1 ? TEXT.burning.burst.onceMore : TEXT.burning.burst.hit, e.x, BARREL.y - 220); return; }
  if (e.type === 'witchWinds') { k.burst(e.x, BARREL.y - 150, '#b06ad0', 8, 'sparkle'); return; }
  if (e.type === 'witchBolt') { k.burst(e.x - 40, BARREL.y - 20, '#e9a46a', 10, 'streak'); return; }
  // her push after his blow is a gust, not a hit: no shake or flash
  if (e.type === 'witchBlast' && e.repel) { k.burst(e.x + 30, BARREL.y - 70, '#b06ad0', 10, 'streak'); return; }
  if (e.type === 'witchBlast') { k.shake(0.4); k.flash(0.25); k.burst(e.x + 20, BARREL.y - 80, '#b06ad0', 18, 'streak'); return; }
  if (e.type === 'witchBeaten') { k.flash(0.4); k.text(TEXT.burning.burst.beaten, e.x, BARREL.y - 230, true); return; }
  if (e.type === 'auroraCasts') { k.burst(268, BARREL.y - 190, '#fff2b0', 24, 'sparkle'); return; }
  if (e.type === 'barrelDrop') { k.shake(0.5); k.burst(e.x, BARREL.y - 10, '#d8c8a8', 26, 'smoke'); k.burst(e.x, BARREL.y - 60, '#fff2b0', 16, 'sparkle'); return; }
  if (e.type === 'swordSwing') return;
  if (e.type === 'barrelFall') { k.flash(0.5); k.shake(0.6); k.burst(1000, 610, '#eef3ea', 40, 'drop'); k.text(TEXT.burning.burst.whirlpool, 640, 240, true); return; }
  if (e.type === 'petal') { k.burst(e.x, e.y, '#f3c6dc', 8, 'sparkle'); return; }
  if (e.type === 'ascend') { k.flash(0.6); k.burst(640, 480, '#fff2b0', 120, 'sparkle'); return; }
  if (e.type === 'witchReturns') { k.flash(0.4); return; }
  act5Event(k, e, st);
}

// The tower cut open like a dollhouse, on the house's floors: the delivered
// tower-interior cloth, or (if it fails to load) dark stone floors.
// The cloth's floors are 500 px apart at y 636, 1136 and 1636 of its 1800, so
// at 0.348 scale (one storey) they land on HOUSE.floors and its walls on
// wallL/wallR.
const TOWER_ART = [640, 683, 487, 627];
function towerInterior(k, st, t) {
  const c = k.c, H = HOUSE, rightFire = towerEscapeFire(st);
  // the night outside the cut-away tower: the sea gap behind, darkened, and
  // the fire's glow rising from its foot, so no bare stage shows either side
  if (k.img('tower-interior')) {
    if (k.asset('coast-gap', 640, 720, 1280, 720)) k.wash('#120610', 0.55);
    else { c.fillStyle = k.col('#140a14'); c.fillRect(0, 0, 1280, 720); }
    const g = c.createLinearGradient(0, 720, 0, 200);
    g.addColorStop(0, `rgba(255,120,50,${0.42 + 0.08 * Math.sin(t * 5)})`); g.addColorStop(1, 'rgba(255,90,40,0)');
    c.fillStyle = g; c.fillRect(0, 200, 1280, 520);
  }
  const painted = k.asset('tower-interior', ...TOWER_ART);
  if (!painted) {
    c.fillStyle = k.col('#140a12'); c.fillRect(0, 0, 1280, 720);
    // the tower's walls and vaults
    c.fillStyle = k.col('#5e5864'); c.fillRect(H.x0 - 24, 96, 24, 548); c.fillRect(H.x1, 96, 24, 548);
    c.fillStyle = k.col('#3a3440');
    c.beginPath(); c.moveTo(H.x0 - 24, 100); c.quadraticCurveTo(640, 20, H.x1 + 24, 100); c.lineTo(H.x1 + 24, 112); c.quadraticCurveTo(640, 36, H.x0 - 24, 112); c.closePath(); c.fill();
    for (let f = 0; f < 3; f++) {
      const y1 = H.floors[f], y0 = y1 - H.storey;
      c.fillStyle = k.col(f === 2 ? '#3d3044' : '#352c36'); c.fillRect(H.x0, Math.max(112, y0), H.x1 - H.x0, y1 - Math.max(112, y0));
      c.fillStyle = k.col('#000000'); c.globalAlpha = 0.18;
      for (let x = H.x0 + 30; x < H.x1; x += 90) { c.beginPath(); c.moveTo(x, y1); c.lineTo(x, y0 + 40); c.arc(x + 30, y0 + 40, 30, Math.PI, 0); c.lineTo(x + 60, y1); c.fill(); }
      c.globalAlpha = 1;
    }
    // her canopied bed at the top
    c.fillStyle = k.col('#6f2a48'); c.fillRect(760, H.floors[2] - 70, 110, 10); c.fillRect(760, H.floors[2] - 70, 8, 70); c.fillRect(862, H.floors[2] - 70, 8, 70);
    c.fillStyle = k.col('#c79ab7'); c.fillRect(770, H.floors[2] - 22, 92, 18);
  }
  for (const cn of st.conns) connector(k, st, cn, t);
  if (st.broke) rubble(k, st, t);
  H.floors.forEach((fy, f) => {
    if (!painted) for (const [a, b] of st.spans[f]) {
      c.fillStyle = k.col('#6d6872'); c.fillRect(a, fy, b - a, 14);
      c.fillStyle = k.col('#8c8792'); c.fillRect(a, fy, b - a, 3);
    }
    // the burnt gaps, cut through the painted floors too
    if (f > 0) for (let gi = 0; gi < st.spans[f].length - 1; gi++) {
      const gx0 = st.spans[f][gi][1], gx1 = st.spans[f][gi + 1][0];
      // The opaque painted void covers the intact cloth; fractured stone
      // and charred beam ends make the gameplay gap part of the set.
      const image = k.img('tower-floor-breach');
      if (image) {
        const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
        // The central shadow occupies 42% of this cutout; align that void
        // with the collision gap while keeping the fractured edges in scale.
        const width = (gx1 - gx0) / .42;
        k.assetCrop('tower-floor-breach', 0, 0, iw, ih,
          (gx0 + gx1 - width) / 2, fy - 8, width, width * ih / iw);
      }
    }
  });
  // the demons who set it alight, dancing with their torches at the foot
  // (the red one runs in from the left once he is inside: TOWER_FIRE)
  const runIn = st.leftFireT == null ? 0 : easeOut(clamp(st.leftFireT / TOWER_FIRE.run, 0, 1));
  for (const [x, id, ph0] of [[318, 'demon-red', 0], [962, 'demon-teal', 1.7]]) {
    const hop = Math.abs(Math.sin(t * (id === 'demon-red' && runIn < 1 ? 9 : 4) + ph0)) * 8;
    const clearing = id === 'demon-teal' ? rightFire : runIn > 0 ? 1 : 0;
    if (clearing <= 0) continue;
    c.save(); c.globalAlpha *= clearing;
    const retreat = id === 'demon-teal' ? (1-clearing)*180 : -(1 - runIn) * 420;
    k.asset(id, x+retreat, H.floors[0] - hop, 70, 115);
    c.restore();
  }
  // Continue the flagstones to the right wing: the rescue ends offstage.
  c.fillStyle = k.col('#6d6872'); c.fillRect(H.wallR, H.floors[0], TOWER_ESCAPE.x-H.wallR, 14);
  c.fillStyle = k.col('#8c8792'); c.fillRect(H.wallR, H.floors[0], TOWER_ESCAPE.x-H.wallR, 3);
  hazards(k, st, t);
  player(k, st, t);
  flames(k, st, t, 1, { right: rightFire, left: towerLeftFire(st) });
  // Azurine in front of the smoke, so she can always be seen
  if (!st.p.carry) beloved(k, H.beloved, H.floors[2], 0.6, -1, Math.sin(t * 5) > 0.3 ? 'reach' : 'down');
  // where he is going: to her at the top, then all the way offstage with her
  const [gx, gy, label] = st.p.carry ? [TOWER_ESCAPE.markerX, H.floors[0], TEXT.burning.waypointOut] : [H.beloved, H.floors[2], TEXT.burning.waypointHer];
  const bob = Math.sin(t * 4) * 6, ty = gy - (st.p.carry ? 170 : 150) + bob;
  c.save(); c.globalAlpha = 0.85; c.fillStyle = k.col('#fff2b0');
  c.beginPath(); c.moveTo(gx - 14, ty); c.lineTo(gx + 14, ty); c.lineTo(gx, ty + 18); c.closePath(); c.fill();
  c.font = '700 15px "Josefin Sans", sans-serif'; c.textAlign = 'center';
  c.fillStyle = k.col('#2a1424'); c.fillText(label, gx + 1, ty - 7); c.fillStyle = k.col('#fff2b0'); c.fillText(label, gx, ty - 8);
  c.restore();
  if (st.phaseT < 7 && !st.p.carry) hint(k, TEXT.burning.climbHint);
}

// Out across the clifftop with her, the tower falling behind.
function clifftop(k, st, t) {
  const c = k.c;
  // The delivered cliff-top cloth at 1.45x, its stone ledge (y 420, x 120-730
  // of its 1280 x 720) on the path: QUAY.y, from x 174 to 1058.
  if (k.asset('cliff-whirlpool', 928, QUAY.y + 435, 1856, 1044)) {
    const glow = c.createRadialGradient(0, QUAY.y - 160, 20, 0, QUAY.y - 160, 420);
    glow.addColorStop(0, 'rgba(255,150,70,0.55)'); glow.addColorStop(1, 'rgba(255,120,60,0)');
    c.save(); c.globalAlpha = 0.7 + 0.3 * Math.sin(t * 6); c.fillStyle = glow; c.fillRect(0, 0, 640, 720); c.restore();
    hazards(k, st, t);
    player(k, st, t);
    return;
  }
  const g = c.createLinearGradient(0, 0, 0, QUAY.y);
  g.addColorStop(0, k.col('#1c1222')); g.addColorStop(1, k.col('#5a2a2a'));
  c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
  k.moon(1040, 120, 34);
  // the sea below the cliff at the right
  c.fillStyle = k.col('#1d3b44'); c.fillRect(0, QUAY.y + 40, 1280, 200);
  // the burning tower behind at the left, leaning as it falls
  const fall = clamp(st.quayT / 6, 0, 1);
  c.save(); c.translate(250, QUAY.y); c.rotate(-0.25 * easeInOut(fall));
  towerSilhouette(k, 0, 0, 1.1, t);
  c.fillStyle = k.col('#e9a46a');
  for (let i = 0; i < 6; i++) { c.globalAlpha = 0.5 + 0.3 * Math.sin(t * 9 + i); c.beginPath(); c.moveTo(-50 + i * 20, -300); c.lineTo(-40 + i * 20, -360 - 20 * Math.abs(Math.sin(t * 7 + i))); c.lineTo(-30 + i * 20, -300); c.fill(); }
  c.globalAlpha = 1;
  c.restore();
  // the clifftop path
  c.fillStyle = k.col('#3d3430'); c.fillRect(0, QUAY.y, 1280, 50);
  c.fillStyle = k.col('#5f8c4a'); c.fillRect(0, QUAY.y - 4, 1280, 8);
  hazards(k, st, t);
  player(k, st, t);
}

// ---------------------------------------------------------------- on foot
// The prince on foot (walker state `w`), facing his way, `h` tall.
function princeOnFoot(k, w, h = 170, celebrating = false) {
  if (celebrating) {
    const id = !w.on ? 'prince-court-leap' : w.stairs && Math.abs(w.vx)>20 ? 'prince-court-stairs-'+(Math.floor(w.walk/24)%2?'b':'a') : Math.abs(w.vx) > 20 ? walkFrame('prince-court', w.walk, 36) : 'prince-court';
    if ((id.includes('-stairs-') ? drawPerson : drawPose)(k, id, w.x, w.y, h, { face: w.face })) return;
  }
  const c = k.c, moving = Math.abs(w.vx) > 20, step = walkFrame('prince', w.walk, 36);
  const id = w.slide ? 'prince-stand' : w.knockT > 0 ? 'prince-fall' : !w.on ? (w.vy < -95 ? 'prince-leap' : w.vy > 95 ? 'prince-fall' : 'prince-apex')
    : w.landT > 0 ? 'prince-land' : moving ? step : 'prince-stand';
  const big = ['prince-fall', 'prince-apex', 'prince-land'].includes(id);
  c.save(); c.translate(w.x, w.y); c.scale(w.face, 1);
  if (!k.asset(id, 0, 0, big ? h : h * 0.61, big ? h * 1.22 : h)) { c.fillStyle = k.col('#6f9fc8'); c.fillRect(-14, -h * 0.8, 28, h * 0.8); }
  c.restore();
}
// Azurine walking at his side: her stride frames once delivered (F11),
// else a still on its slide, bobbing as she goes.
function azurineOnFoot(k, a, y, h = 168) {
  const c = k.c, moving = Math.abs(a.vx || 0) > 20;
  const stride = moving && ['walk-a', 'pass-a', 'walk-b', 'pass-b'].every(pose => k.img('azurine-' + pose));
  const bob = !moving || stride ? 0 : Math.abs(Math.sin(a.walk / 24)) * 4;
  const id = a.on === false ? 'azurine-jump' : a.stairs && moving ? 'azurine-stairs-'+(Math.floor(a.walk/24)%2?'b':'a') : stride ? walkFrame('azurine', a.walk, 36) : 'azurine-stand';
  if (drawPerson(k, id, a.x, (a.y ?? y) - (a.on === false ? 0 : bob), h, { face: id.startsWith('azurine-stairs-') ? a.face : -a.face })) return;
  c.save(); c.translate(a.x, y - bob); c.scale(-a.face, 1); if (!stride) c.rotate(Math.sin(a.walk / 24) * 0.03);
  if (!k.asset(id, 0, 0, h * 0.53, h)) { c.fillStyle = k.col('#c9d8ee'); c.fillRect(-16, -h * 0.8, 32, h * 0.8); }
  c.restore();
}
// A short instruction on a plum label near the top of the stage.
// A short instruction on a plum label, drawn over the stage frame (so the
// valance never clips it) low on the stage unless placed.
function hint(k, text, y = 630, alpha = 1) {
  const draw = () => {
    const c = k.c;
    c.save(); c.textAlign = 'center'; c.font = '700 18px "Josefin Sans", sans-serif';
    const w = measureRichText(c, text, { px: 18, mode: k.inputMode || 'key' }) + 60;
    c.globalAlpha = 0.88 * alpha; c.fillStyle = k.col('#2a1424'); c.beginPath(); c.roundRect(640 - w / 2, y - 24, w, 36, 18); c.fill();
    c.globalAlpha = alpha; c.fillStyle = k.col('#f3c6dc');
    richText(c, text, 640, y, { px: 18, mode: k.inputMode || 'key', col: k.col });
    c.restore();
  };
  if (k.over) k.over(draw); else draw();
}

// Act V: the clifftop over the sea gap; he walks to the edge and dives.
// Water particles: the drops of a splash (u 0..1 through it), and the spray
// of each swimming stroke at the waterline.
function splashDrops(k, x, y, u) {
  const c = k.c;
  c.save();
  for (let i = 0; i < 26; i++) {
    const n = Math.sin(i * 78.233) * 43758.5453, r = n - Math.floor(n);
    const vx = (r - 0.5) * 220, vy = -(180 + ((i * 37) % 11) * 26), tt = u * 0.9;
    const dx = vx * tt, dy = vy * tt + 620 * tt * tt;
    if (dy > 6) continue;
    c.globalAlpha = 0.85 * (1 - u); c.fillStyle = k.col(i % 3 ? '#eef3ea' : '#bfe3e0');
    k.circle(x + dx, y + dy, 2 + (i % 3));
  }
  c.restore();
}
function strokeSpray(k, px, line, stroke, t) {
  const c = k.c, u = (stroke * 4) % 1;
  c.save();
  for (let i = 0; i < 8; i++) {
    const tt = (u + i * 0.11) % 1, side = i % 2 ? 1 : -1;
    const x = px + 42 + side * (6 + tt * 22) + (i % 3) * 3, y = line - Math.sin(Math.PI * tt) * (10 + (i % 4) * 4);
    c.globalAlpha = 0.7 * (1 - tt); c.fillStyle = k.col(i % 3 ? '#eef3ea' : '#bfe3e0');
    k.circle(x, y, 1.6 + (i % 2));
  }
  c.restore();
}

function diveScene(k, st, t) {
  const c = k.c, w = st.w, d = st.dv;
  if (!k.asset('coast-gap', 640, 720, 1280, 720)) { c.fillStyle = k.col('#1c1630'); c.fillRect(0, 0, 1280, 720); c.fillStyle = k.col('#4a3a40'); c.fillRect(0, DIVE.y, DIVE.edge, 400); }
  if (!w) return;
  if (d && !d.splash && k.img('prince-dive')) {
    // head first (F20), centred on his flight and tipping steeper as he falls
    const ph = 124 * (k.img('prince-dive').naturalHeight || 360) / 360;
    drawPose(k, 'prince-dive', w.x, w.y - 55 + ph / 2, 124, { rot: clamp(d.rot * 0.18, 0, 0.6), pivot: ph / 2 });
  } else if (d && !d.splash) {
    c.save(); c.translate(w.x, w.y); c.rotate(d.rot * 0.5);
    if (!k.asset('prince-leap', 0, 0, 110, 152)) { c.fillStyle = k.col('#6f9fc8'); c.fillRect(-14, -100, 28, 100); }
    c.restore();
  } else if (!d) princeOnFoot(k, w, 124);
  // the splash: drops thrown up and falling back (no flat marker)
  if (d?.splash) splashDrops(k, w.x, DIVE.water, d.t / FILM_T.splash);

}

// The fight before it: the witch at the right of the ledge, her fire running
// along the ground at him, the prince lunging at her with the sword. Each
// at a stable scene scale: the prince 140 px, the intimidating witch 172 px.
function duel(k, st, t, entrance = false) {
  const c = k.c, d = st.duel, w = st.w, H = 140;
  // her fire, rolling along the ground
  for (const bo of d.bolts) {
    // a low running flame, its tongues streaming back the way it came
    c.save(); c.translate(bo.x, BARREL.y + 2);
    for (const [col, w, h] of [['#c8321e', 30, 46], ['#e9693a', 22, 34], ['#ffcf7a', 12, 20]]) {
      const fl = Math.sin(t * 24 + w) * 4;
      c.fillStyle = k.col(col); c.beginPath(); c.moveTo(-w, 0);
      c.quadraticCurveTo(-w * 0.2, -h * 0.5, w * 1.4 + fl, -h - fl);   // the tip streams back (to the right)
      c.quadraticCurveTo(w * 0.7, -h * 0.35, w, 0); c.closePath(); c.fill();
    }
    c.restore();
  }
  // the witch: standing, winding up in a violet glow, reeling from a blow,
  // or shrinking into smoke as she hides in her barrel
  const warn = d.state === 'counter' ? 1 : d.state === 'warn' ? d.t / DUEL.warn : 0;
  const reel = d.state === 'reel' ? 1 - d.t / DUEL.reel : 0;
  const T2 = DUEL.trap, trap = d.state === 'trap', tt = trap ? d.t : 0;
  if (warn > 0) { c.save(); c.globalAlpha = 0.25 + 0.35 * warn + 0.1 * Math.sin(t * 20); c.fillStyle = k.col('#b06ad0'); k.circle(d.x, BARREL.y - 110, 70 + 20 * warn); c.restore(); }
  const id = d.state === 'reel' && k.img('witch-recoil') ? 'witch-recoil' : ['warn', 'counter'].includes(d.state) && k.img('witch-cast') ? 'witch-cast' : 'witch-hooded';
  // until Aurora's barrel lands over her (beaten, she cowers)
  if (!trap || tt < T2.land) {
    c.save(); c.translate(d.x, BARREL.y);
    c.rotate(0.25 * reel * (id === 'witch-hooded' ? 1 : 0) + (trap ? 0.12 * Math.sin(t * 30) : 0));
    if (!drawPerson(k, trap && k.img('witch-recoil') ? 'witch-recoil' : id, 0, 0, DUEL.witchHeight, { t })) { c.fillStyle = k.col('#2f5a50'); c.fillRect(-26, -H, 52, H); }
    c.restore();
  }
  if (trap) {
    const bx = Math.min(d.x, BARREL.edge - BARREL.hw);
    // Aurora's spell: a ribbon of gold from her hand to the air over the witch
    if (tt < T2.land + 0.2) {
      const g = clamp(tt / T2.drop, 0, 1), hx = AURORA.x + 64, hy = BARREL.y - 150, tx = bx, ty = BARREL.y - 330;
      c.save();
      for (let i = 0; i <= 24 * g; i++) {
        const f = i / 24, x = hx + (tx - hx) * f, y = hy + (ty - hy) * f - Math.sin(f * Math.PI) * 60 + Math.sin(t * 14 + f * 16) * 6;
        c.globalAlpha = (0.5 + 0.5 * Math.sin(t * 20 + i)) * (1 - clamp((tt - T2.land) / 0.2, 0, 1)); c.fillStyle = k.col(i % 3 ? '#fff2b0' : '#ffffff'); k.circle(x, y, 4);
      }
      c.restore();
    }
    // the barrel: forms over her, upside down, drops onto her and shuts her in
    if (tt >= T2.drop) {
      const f = clamp((tt - T2.drop) / (T2.land - T2.drop), 0, 1);
      if (tt < T2.land) {
        const y = BARREL.y - 330 + 330 * f * f;
        c.save(); c.globalAlpha = Math.min(1, (tt - T2.drop) / 0.12); c.translate(bx, y);
        if (k.img('barrel-upturned')) k.asset('barrel-upturned', 0, 0, 140, 168);
        else emptyBarrel(k);
        c.restore();
      } else {
        // landed: it rocks with her inside, then she pokes her head out
        const r = tt - T2.land, rock = Math.sin(r * 22) * 0.08 * Math.max(0, 1 - r / 0.7);
        c.save(); c.translate(bx, BARREL.y); c.rotate(rock);
        if (r > 0.45) barrelWitch(k, t, w.x < bx);
        else if (!k.asset('barrel-upturned', 0, 0, 140, 168)) emptyBarrel(k);
        c.restore();
      }
    }
  }
  // The stage entrance draws the arriving couple separately.
  if (entrance) return;
  // the prince: lunging as he swings the sword, else on foot
  if (w.strikeT > 0) {
    const f = w.strikeT / DUEL.swing;
    if (!(k.img('prince-strike') && drawPerson(k, 'prince-strike', w.x + 10 * f, w.y, H))) {
      c.save(); c.translate(w.x + 14 * f, w.y); c.rotate(0.15 * f); princeOnFoot(k, { ...w, x: 0, y: 0, vx: 0 }, H); c.restore();
      // the enchanted sword's blow
      c.save(); c.globalAlpha = f; c.strokeStyle = k.col('#fff2b0'); c.lineWidth = 6; c.lineCap = 'round';
      c.beginPath(); c.arc(w.x + 30, w.y - 80, 70, -1.1, 0.5); c.stroke(); c.restore();
    }
  } else princeOnFoot(k, w, H);
  // beaten: the witch's fire engulfs him, rising until the retry card
  if (st.defeatT != null) engulfed(k, w, H, st.defeatT, t);
  // her strength left, as three marks over her
  if (!trap) for (let i = 0; i < DUEL.hp; i++) { c.fillStyle = k.col(i < d.hp ? '#b06ad0' : '#3a2a40'); k.circle(d.x - 24 + i * 24, BARREL.y - DUEL.witchHeight - 40, 7); }
  // on touch the buttons are named Leap and Strike, so they need no line
  if (st.phaseT < 7 && !trap && k.inputMode !== 'touch') hint(k, TEXT.burning.duelHint);
}

// Flames wrapping the prince where he stands, in the layered style of her
// running fire, growing from his feet to over his head.
function engulfed(k, w, H, dt, t) {
  const c = k.c, grow = clamp(dt / 0.7, 0, 1), top = H * (0.5 + 0.7 * grow);
  c.save(); c.translate(w.x, w.y);
  // the glow of the fire on him
  const g = c.createRadialGradient(0, -top * 0.45, 4, 0, -top * 0.45, top * 0.75);
  g.addColorStop(0, `rgba(255,190,90,${0.55 * grow})`); g.addColorStop(1, 'rgba(255,120,40,0)');
  c.fillStyle = g; c.fillRect(-top, -top * 1.3, top * 2, top * 1.5);
  // tongues of flame licking up round him, each its own height and sway
  for (let i = 0; i < 11; i++) {
    const n = Math.sin(i * 12.9898) * 43758.5453, r = n - Math.floor(n);
    const x = (r - 0.5) * 70 + Math.sin(t * 7 + i * 2.3) * 5;
    const h = top * (0.45 + 0.55 * r) * (0.75 + 0.25 * Math.sin(t * 14 + i * 1.9));
    for (const [col, wd, f, a] of [['#b8281a', 15, 1, 0.7], ['#e9693a', 10, 0.78, 0.8], ['#ffd27a', 5, 0.5, 0.9]]) {
      const sway = Math.sin(t * 19 + i * 3 + wd) * 7;
      c.globalAlpha = a * (0.25 + 0.75 * grow); c.fillStyle = k.col(col); c.beginPath(); c.moveTo(x - wd, 6);
      c.bezierCurveTo(x - wd * 1.1, -h * f * 0.4, x + sway - wd * 0.3, -h * f * 0.75, x + sway, -h * f);
      c.bezierCurveTo(x + sway + wd * 0.3, -h * f * 0.75, x + wd * 1.1, -h * f * 0.4, x + wd, 6); c.closePath(); c.fill();
    }
  }
  // embers rising off him
  for (let i = 0; i < 14; i++) {
    const life = ((t * (0.6 + (i % 5) * 0.12) + i * 0.37) % 1);
    c.globalAlpha = (1 - life) * grow; c.fillStyle = k.col(i % 2 ? '#ffcf7a' : '#e9693a');
    k.circle(Math.sin(i * 7.1 + t) * 30, -top * 0.4 - life * top * 0.9, 2.2);
  }
  c.restore();
}

// Until barrel-upturned (F26) is delivered: the barrel body of witch-barrel
// (its art rows 92-240, below her), turned upside down, its foot on (0, 0).
function emptyBarrel(k) {
  const c = k.c, s = 108 / 200, h = 148 * s;
  c.save(); c.scale(1, -1);
  k.assetCrop('witch-barrel', 0, 92, 200, 148, -54, 0, 108, h);
  c.restore();
}

// The barrel is anchored on its own base, not the centre of her outstretched
// arms. The sprites paint her head about twice its size in her duel poses,
// so she and the barrel are drawn at separate scales: the woodwork (below
// the rim, `rim` art rows from the top) at the barrel's size (`px`, the
// prop the prince pushes and Aurora drops), and she above it at her one
// person size (person-size.js), her waist sunk just inside the rim.
export const BARREL_WITCH = {
  'witch-barrel-anger-a': { px: 348, rim: 142 }, 'witch-barrel-anger-b': { px: 355, rim: 142 },
  'witch-barrel-anger-a-tinted': { px: 323, rim: 167 }, 'witch-barrel-anger-b-tinted': { px: 324, rim: 167 },
  cols: [108, 296], sink: 6, below: 40, lead: 6, search: 40,
};
// The barrel's part of a sprite (from a little above the rim), with her robe
// cleared out of it: in each column everything above the copper rim, and any
// teal of her sleeves within its top rows. Made once per image.
const barrelParts = new WeakMap();
function barrelPart(im, rim) {
  let part = barrelParts.get(im);
  if (part) return part;
  const [x0, x1] = BARREL_WITCH.cols, top = rim - BARREL_WITCH.lead, ih = im.naturalHeight || im.height;
  part = document.createElement('canvas'); part.width = x1 - x0; part.height = ih - top;
  const x = part.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, x0, top, part.width, part.height, 0, 0, part.width, part.height);
  try {
    const d = x.getImageData(0, 0, part.width, part.height), a = d.data, W = part.width, rows = Math.min(BARREL_WITCH.search, part.height);
    for (let cx = 0; cx < W; cx++) {
      let first = rows;
      for (let y = 0; y < rows; y++) { const i = (y * W + cx) * 4; if (a[i] - a[i + 2] > 18 && a[i] > a[i + 1] + 6 && a[i + 3] > 200) { first = y; break; } }
      for (let y = 0; y < rows; y++) { const i = (y * W + cx) * 4; if (y < first || a[i + 1] - a[i] > 20) a[i + 3] = 0; }
    }
    x.putImageData(d, 0, 0);
  } catch { /* unreadable pixels: the unmasked crop */ }
  barrelParts.set(im, part);
  return part;
}
function barrelWitch(k, t, princeOnLeft = true) {
  const id = 'witch-barrel-anger-' + (Math.floor(t / 0.6) % 2 ? 'b' : 'a');
  const im = k.img(id);
  if (im) {
    const fit = BARREL_WITCH[id + (/-tinted(?:-redo)?\./.test(im.src || '') ? '-tinted' : '')] || BARREL_WITCH[id];
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    const sb = DUEL.witchHeight / fit.px, sw = DUEL.witchHeight / personPx(k, id);
    const x0 = BARREL_WITCH.cols[0], rimY = -(ih - fit.rim) * sb, cut = fit.rim + BARREL_WITCH.below;
    const part = barrelPart(im, fit.rim), top = fit.rim - BARREL_WITCH.lead;
    const c = k.c;
    c.save(); if (!princeOnLeft) c.scale(-1, 1);
    // she, from her hood to just below the rim, then the barrel over her waist
    k.assetCrop(id, 0, 0, iw, cut, -iw / 2 * sw, rimY + BARREL_WITCH.sink - fit.rim * sw, iw * sw, cut * sw);
    k.imageCrop(part, 0, 0, part.width, part.height, (x0 - iw / 2) * sb, -(ih - top) * sb, part.width * sb, part.height * sb);
    c.restore();
    return;
  }
  const c = k.c;
  c.save(); c.scale(princeOnLeft ? -1 : 1, 1);
  if (!k.asset('witch-barrel', 0, 0, 108, 130)) { c.fillStyle = k.col('#7a5a3a'); c.fillRect(-40, -110, 80, 110); }
  c.restore();
}

// Aurora turns to the prince and sends a quiet stream of gold to him. Her
// blessing catches fire at her outstretched protection; the smoke cannot hit.
function auroraBlessing(k, st, t) {
  const c = k.c, face = auroraFacing(st), w = st.w;
  drawPerson(k, 'aurora-point', AURORA.x, BARREL.y + 6, AURORA.height, { face: -face });
  c.save();
  for (const puff of st.smoke || []) {
    const age = puff.t, fade = 1 - age / AURORA.smokeLife;
    for (let i = 0; i < 5; i++) {
      const x = puff.x + Math.sin(i * 2.4 + age * 2) * (10 + age * 15);
      const y = puff.y - age * (30 + i * 7), r = 13 + age * 18;
      const fog = c.createRadialGradient(x, y, 0, x, y, r);
      fog.addColorStop(0, '#e2dccf'); fog.addColorStop(1, 'rgba(226,220,207,0)');
      c.globalAlpha = fade * 0.65; c.fillStyle = fog; k.circle(x, y, r);
    }
  }
  if (w) {
    const hx = AURORA.x + face * 64, hy = BARREL.y - 150;
    const tx = st.battleIntro ? st.duel.x-20 : w.x, ty = st.battleIntro ? BARREL.y-110 : w.y-80;
    c.strokeStyle = k.col('#fff2b0'); c.lineWidth = 2; c.globalAlpha = 0.15;
    c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo((hx + tx) / 2, Math.min(hy, ty) - 30, tx, ty); c.stroke();
    c.shadowColor = '#fff2b0'; c.shadowBlur = 6;
    for (let i = 0; i < 28; i++) {
      const f = (t * 0.45 + i / 28) % 1;
      const x = lerp(hx, tx, f), y = lerp(hy, ty, f) - Math.sin(f * Math.PI) * 30;
      c.globalAlpha = Math.sin(f * Math.PI) * (0.4 + 0.25 * Math.sin(t * 7 + i));
      c.fillStyle = k.col(i % 4 ? '#fff2b0' : '#ffffff'); k.star(x, y, 3 + i % 3);
    }
    if (!st.battleIntro) {
      c.globalAlpha = 0.22; c.strokeStyle = k.col('#fff2b0');
      c.beginPath(); c.ellipse(w.x, w.y-70, 36, 76, 0, 0, Math.PI*2); c.stroke();
    }
  }
  c.restore();
}

// Act VI: the witch's barrel on the cliff over the whirlpool.
function barrelScene(k, st, t) {
  const c = k.c, b = st.barrel, w = st.w;
  if (!k.asset('cliff-whirlpool', 640, 720, 1280, 720)) { c.fillStyle = k.col('#1c1630'); c.fillRect(0, 0, 1280, 720); c.fillStyle = k.col('#7a6a5a'); c.fillRect(BARREL.x0, BARREL.y, BARREL.edge - BARREL.x0, 300); }
  // the cloth paints its own whirlpool (centre ~ x 1000, y 610); the cut-out only without it
  if (!k.img('cliff-whirlpool')) { c.save(); c.translate(1040, 640); c.scale(1 + 0.03 * Math.sin(t * 2), 1); k.asset('whirlpool', 0, 60, 420, 136); c.restore(); }
  if (st.shelteredAz) drawPerson(k,'azurine-stand',st.shelteredAz.x,BARREL.y,BATTLE_INTRO.height,{face:-1});
  auroraBlessing(k, st, t);
  if (st.battleIntro) { duel(k,st,t,true); battleEntrance(k,st,t); return; }
  if (st.duel && w) return duel(k, st, t);
  if (!b || !w) return;
  const fallK = b.fallT == null ? 0 : clamp(b.fallT / FILM_T.barrelFall, 0, 1);
  // the barrel she cowers in, then over the edge
  let x = b.x, y = BARREL.y, rot = b.rot * 0.15;
  if (fallK > 0) { const f = easeInOut(fallK); x = lerp(b.x, 1000, f); y = BARREL.y + f * f * 200; rot = f * 6; }
  c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = 1 - clamp((fallK - 0.8) / 0.2, 0, 1);
  barrelWitch(k, t, w.x < b.x);
  c.restore();
  // the prince: shoulder to it when pushing, else on foot
  if (st.pushing && w.on && w.knockT <= 0 && k.img('prince-push')) {
    const image = k.img('prince-push'), iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
    const scale = Math.min(172/ih, 140*1.6/iw) * (image.bodyScale || 1);
    const palm = (iw/2-6)*scale;
    // Register his palms against the near barrel wall, rather than placing
    // the wide pushing canvas around his standing sprite's centre.
    c.save(); c.translate(b.x-BARREL.hw+3-palm, w.y);
    k.asset('prince-push', 0, 0, 140, 172); c.restore();
  } else princeOnFoot(k, w, 140);
  if (fallK > 0) { c.save(); c.globalAlpha = 0.5 * Math.sin(Math.PI * fallK); c.fillStyle = k.col('#eef3ea'); c.fillRect(0, 0, 1280, 720); c.restore(); }
  if (fallK === 0) hint(k, TEXT.burning.barrelHint);
}

// The prince arrives carrying Azurine, kneels to set her down, then steps
// forward while she stays sheltered behind the taller fairy.
function battleEntrance(k,st,t) {
  const frame = battleIntroFrame(st), w = st.w, c = k.c;
  if (frame.stage === 'arrival') {
    drawPose(k,walkFrame('prince-carry',w.walk,36),w.x,BARREL.y,BATTLE_INTRO.height);
  } else if (frame.stage === 'setdown') {
    const reveal = clamp(frame.u/.22,0,1);
    if (reveal < 1) {
      c.save();c.globalAlpha=1-reveal;drawPose(k,'prince-carry',w.x,BARREL.y,BATTLE_INTRO.height);c.restore();
    }
    c.save();c.globalAlpha=reveal;
    // This paired cutout is anchored on Azurine's feet, at her shelter.
    drawPerson(k,'prince-set-down',BATTLE_INTRO.shelter,BARREL.y,BATTLE_INTRO.height);
    c.restore();
  } else if (frame.stage === 'rise') {
    drawPose(k,'prince-kneel-rise',w.x,BARREL.y,BATTLE_INTRO.height);
  } else if (frame.stage === 'forward' || frame.stage === 'settle') {
    princeOnFoot(k,w,BATTLE_INTRO.height);
  }
  const captions = {
    faceoff: TEXT.burning.battleCaptions.faceoff,
    arrival: TEXT.burning.battleCaptions.arrival,
    setdown: TEXT.burning.battleCaptions.setdown,
    rise: TEXT.burning.battleCaptions.rise,
    forward: TEXT.burning.battleCaptions.forward,
    settle: TEXT.burning.battleCaptions.settle,
  };
  hint(k,captions[frame.stage]);
}

// The wedding street: the court lines the way; he walks Azurine to the gate.
const GUESTS_Y = 622;
function wedding(k,st,t){
  const c=k.c,w=st.w;
  if(!k.asset('wedding-street',640,720,1280,720)){c.fillStyle=k.col('#cfd8e6');c.fillRect(0,0,1280,720);}
  if(!w)return;
  const couple=stairs=>{
    for(const [actor,princess] of [[st.az,true],[w,false]]){
      if((actor.x>=WEDDING.stairs)!==stairs)continue;
      const h=160*weddingScale(actor.x);
      if(princess)azurineOnFoot(k,actor,WEDDING.y,h);else princeOnFoot(k,actor,h,true);
    }
  };
  // The guests at the foot of the stairs stand behind the couple climbing
  // them (no jump behind the fairy at the first step); those at the right,
  // before the ramp, stay in front.
  const guest=([id,x],i)=>{
    const hop=guestHop(st,id);c.save();c.translate(x,GUESTS_Y-hop);if(x>935)c.scale(-1,1);
    k.idle(id,t+i,0,0,82,150);c.restore();
  };
  const guests=weddingGuests(st).map((g,i)=>[g,i]);
  guests.filter(([[,x]])=>x<WEDDING.stairs+40).forEach(([g,i])=>guest(g,i));
  couple(true);
  doorJamb(k);
  weddingForeground(k);
  guests.filter(([[,x]])=>x>=WEDDING.stairs+40).forEach(([g,i])=>guest(g,i));
  couple(false);
  for(const p of st.petals)if(!p.got&&p.y>-20){c.fillStyle=k.col('#f3c6dc');c.save();c.translate(p.x,p.y);c.rotate(p.y*.05);c.beginPath();c.ellipse(0,0,8,4,0,0,Math.PI*2);c.fill();c.restore();}
  if(st.phaseT<6&&st.weddingIntro!==false)hint(k,TEXT.burning.weddingHint);
}

// The wall right of the doorway, repainted over whoever has walked on
// through it: a soft (feathered) edge at the jamb, then solid wall.
function doorJamb(k){
  const c=k.c,x0=WEDDING.door,feather=10,top=300,bottom=626;
  for(let i=0;i<feather;i+=2){
    c.save();c.globalAlpha=(i+1)/feather;c.beginPath();c.rect(x0-feather/2+i,top,2,bottom-top);c.clip();
    k.asset('wedding-street',640,720,1280,720);c.restore();
  }
  c.save();c.beginPath();c.rect(x0+feather/2,top,WEDDING.gate+60-(x0+feather/2),bottom-top);c.clip();
  k.asset('wedding-street',640,720,1280,720);c.restore();
}

// The apotheosis: walk together into the light beneath Aurora, and rise.
function apotheosis(k, st, t) {
  const c = k.c, w = st.w, rise = (st.lift || 0) / 140;
  if (!k.asset('apotheosis', 640, 720, 1280, 720)) { c.fillStyle = k.col('#f4e6c8'); c.fillRect(0, 0, 1280, 720); }
  // the pillar of light at the centre
  const g = c.createLinearGradient(APOTH.mark - 90, 0, APOTH.mark + 90, 0);
  g.addColorStop(0, 'rgba(255,246,208,0)'); g.addColorStop(0.5, `rgba(255,246,208,${0.35 + 0.15 * Math.sin(t * 3) + rise * 0.4})`); g.addColorStop(1, 'rgba(255,246,208,0)');
  c.fillStyle = g; c.fillRect(APOTH.mark - 90, 0, 180, APOTH.y + 10);
  for (const [id, x, y, h] of [['fairy-ring', 300, 560, 180], ['fairy-crown', 420, 520, 170], ['fairy-gold', 860, 520, 170], ['water-fairy-stand', 980, 560, 180]]) {
    c.save(); c.translate(x, y); k.idle(id, t + x, 0, 0, h * 0.55, h); c.restore();
  }
  c.save(); c.translate(APOTH.mark, 330 - 30 * rise); k.idle('aurora-stand', t, 0, 0, 110, 180); c.restore();
  treasurePile(k, st, t);
  if (!w) return;
  // Aloft they hold the jump pose they leapt in while they slowly rise.
  c.save(); c.translate(0, -rise * 140);
  azurineOnFoot(k, st.az, APOTH.y, 166);
  princeOnFoot(k, w, 166, true);
  c.restore();
  if (nearGiftFairy(st)) {
    const alpha = giftPromptAlpha(st);
    if (canReceiveGift(st) && alpha > 0) hint(k, k.inputMode === 'touch' ? TEXT.burning.giftTouch : TEXT.burning.giftKey, 630, alpha);
  }
  else if (!st.flight && st.creditsT == null) hint(k, TEXT.burning.jumpHint);
  if (rise > 0 || st.creditsT != null) celebrationSparkles(k, st.clock);
  // "The end" fades in as they rise and stays through the celebration,
  // giving way as the credits begin to roll
  const endCard = st.creditsT == null ? (st.riseT == null ? 0 : clamp(st.riseT - 1, 0, 1)) : clamp((FINALE.celebrate - st.creditsT) / 0.6, 0, 1);
  if (endCard > 0) card(k, TEXT.burning.endCard.title, TEXT.burning.endCard.sub, endCard);
}

// The voyage's treasures on the top step at the right: a heap of the pearls
// and of the Water Fairy's gifts (pileSlot, growing up off the stage), the
// sword standing in it, the lamp and the seal at its foot, Aurora's stars
// over its top; and the gifts still flying up to it.
function treasurePile(k, st, t) {
  const c = k.c, T = treasures(st), { x, y } = TREASURE, kinds = st.giftKinds || [];
  const n = pileCount(st), pearls = n - kinds.length;
  c.save();
  for (let i = 0; i < n; i++) {
    const p = pileSlot(i); if (p.y < -30) break;
    const size = i < pearls ? 17 : 30;
    k.asset(i < pearls ? 'pearl' : kinds[i - pearls], p.x, p.y + 8, size, size);
  }
  if (T.sword) { c.save(); c.translate(x + 26, y - 12); c.rotate(Math.PI / 4); k.asset('keepsake-sword', 0, 32, 64, 64); c.restore(); }
  if (T.lamp) k.asset('keepsake-lamp', x - 68, y + 8, 44, 44);
  // the betrothal gifts along the front of the heap
  T.gifts.forEach((g, i) => k.asset('gift-' + g, x + (i - (T.gifts.length - 1) / 2) * 26, y + 14, 30, 30));
  if (T.seal) k.asset('keepsake-seal', x + 60, y + 8, 40, 40);
  if (T.stars) {
    const top = n ? pileSlot(n - 1).y : y;
    c.save(); c.shadowColor = '#fff2b0'; c.shadowBlur = 8;
    for (let i = 0; i < T.stars; i++) {
      const sx = x + (i - (T.stars - 1) / 2) * 34, sy = top - 26 + Math.sin(t * 1.6 + i) * 4;
      if (sy > -20 && !k.asset('aurora-star', sx, sy, 28, 28)) { c.fillStyle = k.col('#fff2b0'); k.star(sx, sy - 14, 10); }
    }
    c.restore();
  }

  c.restore();
}

// Match the opening court: grow into the spotlight, hold the name, then
// shrink into the heap. Only then can the next present be accepted.
function weddingGiftReveal(k, st, t) {
  const c = k.c;
  for (const g of st.giftsFlying || []) {
    if (g.t < 0 || g.t >= GIFT_SHOW.settle) continue;
    const mid = { x: 640, y: 455, size: 250 }, slot = pileSlot(g.slot);
    let from = { ...GIFTING.hand, size: 64 }, to = mid, u;
    if (g.t < GIFT_SHOW.rise) u = easeOut(g.t / GIFT_SHOW.rise);
    else if (g.t < GIFT_SHOW.hold) u = 1;
    else { from = mid; to = { x: slot.x, y: slot.y + 8, size: 30 }; u = easeInOut((g.t - GIFT_SHOW.hold) / (GIFT_SHOW.settle - GIFT_SHOW.hold)); }
    const x = lerp(from.x, to.x, u), y = lerp(from.y, to.y, u), size = lerp(from.size, to.size, u);
    const big = g.t < GIFT_SHOW.hold ? u : 1 - u;
    c.save();
    if (big > 0) {
      c.globalAlpha = 0.3 * big; c.fillStyle = '#000'; c.fillRect(0, 0, 1280, 720);
      const glow = c.createRadialGradient(x, y - size / 2, size * 0.1, x, y - size / 2, size * 0.75);
      glow.addColorStop(0, 'rgba(255,242,176,0.75)'); glow.addColorStop(1, 'rgba(255,242,176,0)');
      c.globalAlpha = big * (0.85 + 0.15 * Math.sin(t * 6)); c.fillStyle = glow; c.fillRect(x - size, y - size * 1.5, size * 2, size * 2);
    }
    c.globalAlpha = 1;
    k.asset(g.kind, x, y, size, size);
    if (big > 0.6) {
      const title = TEXT.burning.giftTitles[g.kind];
      c.globalAlpha = clamp((big - 0.6) / 0.4, 0, 1);
      c.textAlign = 'center'; c.font = '700 34px "Josefin Sans", sans-serif';
      c.lineWidth = 6; c.strokeStyle = 'rgba(30,14,30,0.85)'; c.strokeText(title, x, y + 44);
      c.fillStyle = k.col('#fff2b0'); c.fillText(title, x, y + 44);
    }
    c.restore();
  }
}

function celebrationSparkles(k, time) {
  const c = k.c;
  c.save(); c.shadowColor = '#fff2b0'; c.shadowBlur = 5;
  for (let i = 0; i < 72; i++) {
    const p = ((time * (0.09 + (i % 5) * 0.008) + i * 0.618) % 1 + 1) % 1;
    const x = 155 + ((i * 137) % 970) + Math.sin(time * 1.4 + i) * 14;
    const y = 650 - p * 540;
    c.globalAlpha = Math.sin(p * Math.PI) * (0.45 + 0.5 * Math.abs(Math.sin(time * 3 + i)));
    c.fillStyle = k.col(i % 3 ? '#fff2b0' : '#ffffff');
    k.star(x, y, 1.5 + (i % 4) * 0.8);
  }
  c.restore();
}

function rollingCredits(k, time) {
  const f = finaleFrame(time);
  if (f.roll <= 0 || f.roll >= 1) return;
  const c = k.c;
  // the scrim darkens the whole screen, frame and curtains too; the lines
  // fade in and out within the stage opening
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = `rgba(22,9,19,${0.6 * Math.min(1, f.roll * 15, (1 - f.roll) * 15)})`;
  c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  c.restore();
  c.save(); c.beginPath(); c.rect(140, 100, 1000, 530); c.clip();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = '#150b12'; c.shadowBlur = 8;
  for (const line of CREDITS) {
    const y = f.creditsY + line.y;
    c.globalAlpha = clamp(Math.min((y - 100) / 55, (630 - y) / 55), 0, 1);
    c.fillStyle = k.col(line.title ? '#f3c6dc' : '#fff2d9');
    c.font = `${line.title ? '' : '600 '}${line.size}px ${line.title ? 'Yesteryear, cursive' : '"Josefin Sans", sans-serif'}`;
    c.fillText(line.text, 640, y);
  }
  c.restore();
}

export { T, easeOut };
