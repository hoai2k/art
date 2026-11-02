// Act IV drawing: inside the whale on its rocking cradle, then the beaching.
// Every piece of art has a procedural stand-in until its file is delivered
// (ids and sizes in design/image-requests.md, Part C5; drawn at about half).
import {
  W, CAM_Y_MIN, PIVOT, THROAT, STONE, HOOKS, LANTERN_XS, OUTRO,
  floorY, hookTip, hookAngle, shoreTimes, toScreen, extent, platformOf, HANG,
} from './act4.js';
import { clamp, easeOut, easeInOut } from './shared.js';
import { FILM } from '../theme.js';
import { drawPose, CREW_OF } from '../pose.js';
import { drawMovement, whalePose } from './sailor-motion.js';
import { walkPose } from '../walking.js';
import { TEXT } from '../text_config.js';
import { cavernScene, cavernOver, cavernEvent } from './act4cavern-art.js';
import { camX as cavernCamX } from './act4cavern.js';

const REV = [
  { id: 'reveller-yellow', col: '#e3c13b' },
  { id: 'reveller-shaggy', col: '#6f9a4a' },
  { id: 'reveller-jester', col: '#8a3f7a' },
  { id: 'reveller-lady', col: '#e7a6bd' },
];
const BONE = '#d8c7a8', BONE_DARK = '#8f7a62', IVORY = '#f1e3c8', FLESH = '#7a2342', FLESH_LIT = '#a8466a';
const TOP_EDGE = '#f6ead0'; // every walkable surface carries this pale edge

export function draw(k, st, t) {
  if (st.cv) return cavernScene(k, st, t);
  if (st.phase === 'shore' || st.phase === 'iris' || st.status === 'won') return shoreScene(k, st, t);
  belly(k, st, t);
  if (st.phase === 'throat') k.wash('#fff4dc', 0.92 * easeInOut(st.phaseT / OUTRO.throat));
}

// The mobile camera's focus (src/camera.js): the player's middle, stage px.
export function focus(st) {
  if (st.cv) { const s = st.cv.s; return { x: s.x - cavernCamX(st.cv), y: s.y - 60 }; }
  const s = st.s, cam = st.cam, x = s.x - cam.x - PIVOT.x, y = s.y - 60 - cam.y - PIVOT.y;
  const co = Math.cos(st.tilt || 0), si = Math.sin(st.tilt || 0);
  return { x: PIVOT.x + x * co - y * si, y: PIVOT.y + x * si + y * co };
}

export function drawOver(k, st) {
  if (st.cv) return cavernOver(k, st);
  if (st.phase === 'iris') k.iris(1050, 540, 820 * (1 - easeInOut(st.phaseT / OUTRO.iris)));
  if (st.status === 'won') k.iris(1050, 540, 0);
}

export function onEvent(k, e, st) {
  if (st?.cv) return cavernEvent(k, e, st);
  const at = (x, y) => toScreen(st, x, y);
  const s = st.s;
  if (e.type === 'pearl') { const p = at(e.x, e.y); k.burst(p.x, p.y, '#efe9f2', 8, 'sparkle'); }
  if (e.type === 'stoneFound') { const p = at(e.x, e.y); k.burst(p.x, p.y, '#d9b34a', 18, 'sparkle'); k.text(FILM ? TEXT.whale.burst.lampFound : TEXT.whale.burst.stoneFound, p.x, p.y - 40, true); }
  if (e.type === 'hit') { k.shake(0.45); k.flash(0.25); const p = at(s.x, s.y - 60); k.burst(p.x, p.y, '#c8321e', 12, 'streak'); }
  if (e.type === 'splash') { const p = at(e.x, e.y); k.burst(p.x, p.y, '#9fb8b0', 20, 'drop'); }
  if (e.type === 'acidSting') { const p = at(e.x, e.y); k.burst(p.x, p.y, '#e07a5a', 14, 'bubble'); }
  if (e.type === 'grab') { const p = at(e.x, e.y); k.burst(p.x, p.y, '#9fb8b0', 6, 'drop'); }
  if (e.type === 'climbUp') { const p = at(e.x, e.y); k.burst(p.x, p.y, '#f1e3c8', 6, 'chip'); }
  if (e.type === 'hookSnag') { const p = at(e.x, e.y); k.burst(p.x, p.y, '#f1e3c8', 10, 'streak'); }
  if (e.type === 'whaleInhale') k.shake(0.2);
  if (e.type === 'swallowed') k.shake(0.6);
  if (e.type === 'daylight') k.flash(0.35);
  if (e.type === 'beachSurf') { k.flash(0.9); k.burst(640, 480, '#ffffff', 24, 'drop'); }
  if (e.type === 'tailSplash') k.burst(260, 470, '#ffffff', 26, 'drop');
  if (e.type === 'revellerOut') k.text('♪', 960, 440);
}

// ================================================================ inside the whale
function belly(k, st, t) {
  const c = k.c, cam = st.cam;
  c.fillStyle = k.col('#140a12'); c.fillRect(0, 0, 1280, 720);
  c.save();
  c.translate(PIVOT.x, PIVOT.y); c.rotate(st.tilt); c.translate(-PIVOT.x, -PIVOT.y);
  backcloth(k, st, t);
  c.save(); c.translate(-cam.x, -cam.y);
  const L = cam.x - 320, R = cam.x + 1600;
  throat(k, st, t);
  if (!img(k, 'belly-backcloth')) midRibs(k, L, R);   // the delivered backcloth paints its own ribs
  LANTERN_XS.forEach((x, i) => { if (x > L && x < R) lantern(k, st, x, i, t); });
  for (const p of st.ledges) { const e = extent(p); if (e.x1 > L && e.x0 < R) ribBehind(k, p); }
  for (const p of st.ledges) { const e = extent(p); if (e.x1 > L && e.x0 < R) ledge(k, p); }
  if (!st.stone) stone(k, t);
  for (const h of HOOKS) if (h.ax > L - 300 && h.ax < R + 300) hook(k, st, h);
  for (const f of st.floaters) if (f.x > L - 150 && f.x < R + 150) floater(k, f);
  water(k, st, t, L, R);
  floor(k, st, t, L, R);
  pearls(k, st, t, L, R);
  floorOmens(k, st, t, L, R);
  sailor(k, st, t);
  c.restore();
  if (!img(k, 'belly-backcloth')) foreRibs(k, st);
  setBase(k);
  c.restore();
  fulcrum(k);
  // the film edition shows the breath in the water and the ribs alone
  if (!FILM) cueBoard(k, st, t);
}

function backcloth(k, st, t) {
  const c = k.c, cam = st.cam;
  const fx = cam.x / (W - 1280), fy = cam.y / CAM_Y_MIN;
  const g = c.createLinearGradient(0, -300, 0, 900);
  g.addColorStop(0, k.col('#1c0c18')); g.addColorStop(0.45, k.col('#4a1834')); g.addColorStop(1, k.col('#2a0f22'));
  c.fillStyle = g; c.fillRect(-300, -300, 1880, 1300);
  // The whale breathes: the ribs swell a touch with the inhale.
  const swell = st.breath.phase === 'inhale' ? Math.sin(Math.PI * st.breath.b / 4) * 0.015 : 0;
  if (k.asset('belly-backcloth', 640 + (0.5 - fx) * 384, 828 + 108 * fy, 1664 * (1 + swell), 936 * (1 + swell))) return;
  // Stand-in: two rows of ribs as Gothic arches, the far row dimmer.
  for (const [p, gap, lw, alpha, apex] of [[0.25, 300, 16, 0.22, -40], [0.5, 470, 28, 0.42, -160]]) {
    const ox = -((cam.x * p) % gap), oy = -cam.y * p;
    c.save(); c.globalAlpha = alpha; c.strokeStyle = k.col(BONE); c.lineWidth = lw * (1 + swell * 4); c.lineCap = 'round';
    for (let x = ox - gap; x < 1280 + gap * 2; x += gap) arch(c, x, x + gap, 760, apex + oy, 200 + oy);
    c.restore();
  }
  // Wet glints running down the walls.
  c.save(); c.globalAlpha = 0.25; c.strokeStyle = k.col('#f3c6dc'); c.lineWidth = 2;
  const ox = -((cam.x * 0.5) % 470);
  for (let x = ox - 470; x < 1700; x += 470) for (const dx of [40, 70]) {
    const y0 = 260 + ((dx * 7) % 90) - cam.y * 0.5;
    c.beginPath(); c.moveTo(x + dx, y0); c.lineTo(x + dx + 3, y0 + 60 + Math.sin(t + dx) * 8); c.stroke();
  }
  c.restore();
}

// The whale's ribs in the midground: each rises from the stomach floor and
// arches away overhead, as the set's own rib flats.
function midRibs(k, L, R) {
  const c = k.c, gap = 560;
  c.lineCap = 'round';
  for (let x = Math.floor(L / gap) * gap + 90; x < R + 300; x += gap) {
    c.strokeStyle = k.col('#6e5a4e'); c.lineWidth = 34;
    c.beginPath(); c.moveTo(x, 720); c.quadraticCurveTo(x - 20, -200, x + 380, -1100); c.stroke();
    c.strokeStyle = k.col('#b8a387'); c.lineWidth = 6;
    c.beginPath(); c.moveTo(x - 10, 720); c.quadraticCurveTo(x - 30, -200, x + 370, -1100); c.stroke();
  }
}

// A pointed (Gothic) arch from legs at xl and xr, springing at sy, apex at ay.
function arch(c, xl, xr, base, ay, sy) {
  const xm = (xl + xr) / 2;
  c.beginPath();
  c.moveTo(xl, base); c.lineTo(xl, sy); c.quadraticCurveTo(xl, ay + (sy - ay) * 0.25, xm, ay);
  c.quadraticCurveTo(xr, ay + (sy - ay) * 0.25, xr, sy); c.lineTo(xr, base);
  c.stroke();
}

function throat(k, st, t) {
  const c = k.c, { x, y } = THROAT;
  const g = c.createRadialGradient(x, y, 30, x, y, 420);
  g.addColorStop(0, k.P.mode === 'lum' ? 'rgba(255,250,235,0.55)' : 'rgba(255,226,160,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(x - 420, y - 420, 840, 840);
  // Requested re-draw seen from inside (800 x 800 art, 400 here, centred): the
  // bottom of its opening (70% down) sits on the lip at THROAT.y + 150.
  if (k.asset('whale-throat-inside', x, y + 150 - 0.7 * 400 + 400, 400, 400)) return;
  if (k.asset('whale-throat', x, y + 235, 300, 300)) return;
  // fleshy ring, baleen fringe, daylight and a glimpse of the shore
  c.fillStyle = k.col(FLESH_LIT); c.beginPath(); c.ellipse(x, y, 150, 140, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = k.col('#fbf1dc'); c.beginPath(); c.ellipse(x, y, 105, 98, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.beginPath(); c.ellipse(x, y, 105, 98, 0, 0, Math.PI * 2); c.clip();
  c.fillStyle = k.col('#bcd6d4'); c.fillRect(x - 110, y + 10, 220, 30);
  c.fillStyle = k.col('#a39a92'); c.beginPath(); c.moveTo(x - 110, y + 100); c.lineTo(x - 70, y + 28); c.lineTo(x - 20, y + 50); c.lineTo(x + 30, y + 22); c.lineTo(x + 110, y + 60); c.lineTo(x + 110, y + 100); c.fill();
  c.restore();
  c.strokeStyle = k.col('#3a2430'); c.lineWidth = 4;
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2, r0 = 104, r1 = 128 + (i % 2) * 10;
    c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.94); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.94); c.stroke();
  }
}

function lantern(k, st, x, i, t) {
  const c = k.c, top = -1400, len = 1400 + [100, 110, 70, 90][i % 4];
  // It hangs plumb while the set tilts, so it swings against the cradle.
  const a = -st.tilt * 1.4 + 0.08 * Math.sin(t * 1.3 + i * 2);
  c.save(); c.translate(x, top); c.rotate(a);
  if (img(k, 'chain-strip')) {
    // the requested chain (24 x 400 art), tiled down from the top to the lantern
    c.save(); c.beginPath(); c.rect(-10, 0, 20, len + 10); c.clip();
    for (let y = 0; y < len + 10; y += 200) k.asset('chain-strip', 0, y + 201, 12, 201);
    c.restore();
  } else {
    c.strokeStyle = k.col('#2a1a12'); c.lineWidth = 3; c.setLineDash([6, 4]);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, len); c.stroke(); c.setLineDash([]);
  }
  const g = c.createRadialGradient(0, len + 70, 6, 0, len + 70, 230);
  g.addColorStop(0, k.P.mode === 'lum' ? 'rgba(255,245,215,0.42)' : 'rgba(255,196,110,0.42)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(-230, len - 160, 460, 460);
  if (!k.asset('lantern-hanging', 0, len + 130, 60, 130)) {
    c.fillStyle = k.col('#8c6a2a'); c.beginPath(); c.moveTo(-20, len + 26); c.lineTo(0, len + 8); c.lineTo(20, len + 26); c.fill();
    c.fillStyle = k.col('#ffcf5c'); c.globalAlpha = 0.85 + 0.15 * Math.sin(t * 9 + i); c.fillRect(-17, len + 28, 34, 56); c.globalAlpha = 1;
    c.strokeStyle = k.col('#5a4320'); c.lineWidth = 3;
    for (const dx of [-17, 0, 17]) { c.beginPath(); c.moveTo(dx, len + 28); c.lineTo(dx, len + 84); c.stroke(); }
    c.fillStyle = k.col('#8c6a2a'); c.fillRect(-22, len + 84, 44, 10); c.fillRect(-6, len + 94, 12, 8);
  }
  c.restore();
}

// The rib-arch-tall art at its natural size (260 x 520), hanging under its
// bone shelf: the painted hook (80% across, 1% down the art) under the shelf's
// centre, the rest of the rib curving down and fading into the murk (the art's
// base dissolves, so it may end above the water). Drawn before every slab.
const RIB = { w: 260, h: 520, hookX: 0.8, hookY: 0.011 };
function ribBehind(k, p) {
  if (p.kind || !img(k, 'rib-arch-tall')) return;
  const cx = (p.x0 + p.x1) / 2;
  k.asset('rib-arch-tall', cx - (RIB.hookX - 0.5) * RIB.w, p.y + 6 + RIB.h * (1 - RIB.hookY), RIB.w, RIB.h);
}

function ledge(k, p) {
  const c = k.c, { x0, x1, y } = p, cx = (x0 + x1) / 2;
  let art = false;
  if (p.kind === 'bank') {
    // The starting bank (900 x 1000 art, 450 x 500 here), spanning x -200 .. x1.
    if (k.asset('belly-bank', (x1 - 200) / 2, y - 6 + 500, x1 + 200, 500)) art = true;
    else {
      // A fleshy shelf of stomach wall to start on.
      c.fillStyle = k.col(FLESH);
      c.beginPath(); c.moveTo(-200, 760); c.lineTo(-200, y - 6); c.lineTo(x1 - 20, y - 6); c.quadraticCurveTo(x1 + 10, y + 40, x1 - 10, 760); c.fill();
      c.fillStyle = k.col(FLESH_LIT); c.fillRect(-200, y - 6, x1 - 10 + 200, 12);
    }
  } else if (p.kind === 'lip') {
    // The throat's lower lip (900 x 300 art, 450 x 150 here), x0 .. x1 + 200.
    if (k.asset('throat-lip', (x0 + x1 + 200) / 2, y - 4 + 150, x1 + 200 - x0, 150)) art = true;
    else {
      // the fleshy lower lip of the throat, a soft rounded tongue of flesh
      c.fillStyle = k.col(FLESH);
      c.beginPath(); c.moveTo(x0, y + 2);
      c.quadraticCurveTo(x0 - 26, y + 40, x0 + 20, y + 80); c.quadraticCurveTo(x0 + 110, y + 130, x1 + 200, y + 70);
      c.lineTo(x1 + 200, y - 4); c.quadraticCurveTo(cx, y - 14, x0, y + 2); c.fill();
      c.fillStyle = k.col(FLESH_LIT); c.beginPath(); c.moveTo(x0 + 4, y - 2); c.quadraticCurveTo(cx, y - 14, x1 + 200, y - 4); c.lineTo(x1 + 200, y + 8); c.quadraticCurveTo(cx, y - 2, x0 + 4, y + 8); c.fill();
    }
  } else {
    // A rib with a bone slab on it. The slab is rib-ledge (360 x 70 art, 35 tall
    // here, top on the walkable y); the rib stands behind it.
    const slab = img(k, 'rib-ledge');
    if (img(k, 'rib-arch-tall')) { /* drawn behind everything by ribBehind() */ }
    else if (!k.asset('rib-arch', cx - 51, y + 490, 230, 490)) {
      // A bone shelf jutting from a rib: a short curved bracket under it.
      const side = (Math.round(cx / 10) % 2) ? 1 : -1; // brackets lean either way
      c.fillStyle = k.col(BONE_DARK);
      c.beginPath(); c.moveTo(cx - 22, y + 10); c.lineTo(cx + 22, y + 10);
      c.quadraticCurveTo(cx + side * 12 + 6, y + 50, cx + side * 40, y + 110);
      c.lineTo(cx + side * 30, y + 114);
      c.quadraticCurveTo(cx - side * 6 - 6, y + 50, cx - 22, y + 10); c.fill();
      c.strokeStyle = k.col(BONE); c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx - side * 8, y + 14); c.quadraticCurveTo(cx + side * 6, y + 50, cx + side * 33, y + 108); c.stroke();
    }
    if (slab) { k.asset('rib-ledge', cx, y + 35, x1 - x0, 35); art = true; }
    else {
      c.fillStyle = k.col('#5e4a3a'); c.beginPath(); c.roundRect(x0 + 4, y + 8, x1 - x0 - 8, 8, 4); c.fill();
      c.fillStyle = k.col(IVORY); c.beginPath(); c.roundRect(x0, y - 2, x1 - x0, 16, 7); c.fill();
    }
  }
  // the pale walkable edge belongs to the stand-ins; art paints its own
  if (!art) { c.fillStyle = k.col(TOP_EDGE); c.fillRect(x0 + 4, y - 3, x1 - x0 - 8, 3); }
}

function pearls(k, st, t, L, R) {
  const c = k.c;
  for (const p of st.pearlsLeft) {
    if (p.got || p.x < L || p.x > R) continue;
    const y = p.y + Math.sin(t * 3 + p.i) * 4;
    c.globalAlpha = y > st.water ? 0.3 : 1; // drowned until the water falls
    if (!k.asset('pearl', p.x, y + 12, 26, 26)) {
      c.fillStyle = k.col('#efe9f2'); k.circle(p.x, y, 10);
      c.fillStyle = k.col('#ffffff'); k.circle(p.x - 3, y - 3, 3);
    }
    c.globalAlpha = 1;
  }
}

function stone(k, t) {
  const c = k.c, { x, y } = STONE;
  c.save(); c.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3); c.fillStyle = k.col('#d9b34a'); k.circle(x, y - 22, 30); c.restore();
  if (!k.asset('keepsake-stone', x, y, 48, 48)) k.keepsake('stone', x, y - 26, 1);
}

function hook(k, st, h) {
  const c = k.c, tip = hookTip(h, st.beat), a = hookAngle(h, st.beat);
  // The requested sprite (80 x 220 art, 40 x 110 here) hangs from its top
  // centre, 75 above the tip, swung by -a about that attachment; the long
  // line stays a thin stroke down to it.
  const sprite = img(k, 'fish-hook');
  const ex = sprite ? tip.x - 75 * Math.sin(a) : tip.x, ey = sprite ? tip.y - 75 * Math.cos(a) : tip.y;
  c.strokeStyle = k.col('#d9cdb5'); c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(h.ax, h.ay); c.lineTo(ex, ey); c.stroke();
  c.save(); c.translate(tip.x, tip.y); c.rotate(-a);
  if (sprite) k.asset('fish-hook', 0, -75 + 110, 40, 110);
  else {
  // a red and cream float on the line, so the hook reads from afar
  c.fillStyle = k.col('#c8321e'); c.beginPath(); c.arc(0, -70, 9, Math.PI, 0); c.fill();
  c.fillStyle = k.col('#f1e3c8'); c.beginPath(); c.arc(0, -70, 9, 0, Math.PI); c.fill();
  c.strokeStyle = k.col('#aeb6ba'); c.lineWidth = 5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, -28); c.lineTo(0, 6); c.arc(-11, 6, 11, 0, Math.PI * 0.95); c.stroke();
  c.beginPath(); c.moveTo(-22, 7); c.lineTo(-17, -3); c.stroke();
  }
  c.restore();
  // The tea-leaf omen: where the hook will be one beat from now.
  if (st.carry.tea >= 3) {
    const f = hookTip(h, st.beat + 1);
    omen(k, f.x, f.y, 0.85);
  }
}

function floater(k, f) {
  const c = k.c, x = f.x, top = f.top;
  const box = { barrel: [80, 100, 'barrel'], crate: [90, 90, 'crate'], debris: [260, 111, 'wreck-debris', -45, 0], piano: [210, 160, 'piano'], figurehead: [160, 210, 'figurehead', -14, 12] }[f.kind];
  const drawn = k.asset(box[2], x + (box[4] || 0), top + box[1] + (box[3] || 0), box[0], box[1]);
  if (!drawn) {
    if (f.kind === 'barrel') {
      c.fillStyle = k.col('#7a4a26'); c.beginPath(); c.moveTo(x - 30, top); c.quadraticCurveTo(x - 44, top + 50, x - 30, top + 100); c.lineTo(x + 30, top + 100); c.quadraticCurveTo(x + 44, top + 50, x + 30, top); c.fill();
      c.fillStyle = k.col('#3a2a22'); for (const dy of [12, 48, 84]) c.fillRect(x - 38, top + dy, 76, 6);
      c.fillStyle = k.col('#a0703f'); c.beginPath(); c.ellipse(x, top + 2, 31, 7, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = k.col('#3f6a3a'); c.lineWidth = 4; c.beginPath(); c.moveTo(x + 18, top + 4); c.quadraticCurveTo(x + 30, top + 26, x + 20, top + 46); c.stroke();
    } else if (f.kind === 'crate') {
      c.fillStyle = k.col('#a57a45'); c.fillRect(x - 45, top, 90, 90);
      c.strokeStyle = k.col('#6b4a28'); c.lineWidth = 3; c.strokeRect(x - 43, top + 2, 86, 86);
      for (const dy of [30, 60]) { c.beginPath(); c.moveTo(x - 43, top + dy); c.lineTo(x + 43, top + dy); c.stroke(); }
      anchorGlyph(k, x, top + 44);
    } else if (f.kind === 'debris') {
      // a broken piece of the ship: deck planks over a curve of hull
      c.fillStyle = k.col('#6b4024'); c.beginPath(); c.moveTo(x - 115, top + 10); c.quadraticCurveTo(x - 100, top + 90, x - 10, top + 100); c.lineTo(x + 70, top + 96); c.lineTo(x + 92, top + 70); c.lineTo(x + 104, top + 84); c.lineTo(x + 115, top + 10); c.fill();
      c.strokeStyle = k.col('#4a2a16'); c.lineWidth = 2; for (const dy of [34, 58, 80]) { c.beginPath(); c.moveTo(x - 108, top + dy); c.lineTo(x + 108, top + dy); c.stroke(); }
      c.fillStyle = k.col('#9a6a3c'); c.fillRect(x - 115, top, 230, 14);
      c.fillStyle = k.col('#8e1730'); c.beginPath(); c.moveTo(x - 60, top + 16); c.lineTo(x - 42, top + 16); c.lineTo(x - 42, top + 30); c.quadraticCurveTo(x - 51, top + 40, x - 60, top + 30); c.fill();
    } else if (f.kind === 'piano') {
      c.fillStyle = k.col('#3a2116'); c.fillRect(x - 85, top, 170, 150);
      c.save(); c.translate(x - 85, top); c.rotate(-0.5); c.fillStyle = k.col('#4e2c1c'); c.fillRect(0, -8, 120, 8); c.restore(); // the lid, propped open
      c.fillStyle = k.col('#2a160e'); c.fillRect(x - 92, top + 46, 184, 14);
      c.fillStyle = k.col('#f4ecdc'); c.fillRect(x - 88, top + 38, 176, 10);
      c.fillStyle = k.col('#1a1012'); for (let i = 0; i < 16; i++) if (i % 7 !== 2 && i % 7 !== 6) c.fillRect(x - 84 + i * 11, top + 38, 6, 6);
      c.strokeStyle = k.col('#6b4024'); c.lineWidth = 2; c.strokeRect(x - 70, top + 72, 60, 60); c.strokeRect(x + 10, top + 72, 60, 60);
      starfish(k, x + 52, top - 4);
    } else {
      // a gilded mermaid figurehead, lying across the water
      c.fillStyle = k.col('#d9b34a');
      c.beginPath(); c.moveTo(x - 65, top + 4); c.lineTo(x + 40, top); c.quadraticCurveTo(x + 70, top + 4, x + 62, top + 40); c.quadraticCurveTo(x, top + 70, x - 50, top + 60); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(x - 60, top + 30); c.lineTo(x - 92, top + 6); c.lineTo(x - 84, top + 42); c.closePath(); c.fill(); // tail fin
      c.fillStyle = k.col('#8c6a2a'); for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(x - 40 + i * 14, top + 30, 6, 0, Math.PI); c.fill(); }
      c.fillStyle = k.col('#efd7c4'); k.circle(x + 50, top + 18, 13);
      c.fillStyle = k.col('#c4426e'); c.beginPath(); c.moveTo(x + 40, top + 6); c.quadraticCurveTo(x + 20, top + 30, x + 30, top + 54); c.lineTo(x + 40, top + 30); c.fill();
    }
  }
  if (!drawn) { c.fillStyle = k.col(TOP_EDGE); c.fillRect(x - f.w / 2 + 4, top - 3, f.w - 8, 3); }
}

function anchorGlyph(k, x, y) {
  const c = k.c;
  c.strokeStyle = k.col('#2a1424'); c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x, y + 18); c.moveTo(x - 10, y - 10); c.lineTo(x + 10, y - 10); c.stroke();
  c.beginPath(); c.arc(x, y + 2, 16, 0.2, Math.PI - 0.2); c.stroke();
  c.beginPath(); c.arc(x, y - 24, 4, 0, Math.PI * 2); c.stroke();
}

function starfish(k, x, y) {
  const c = k.c;
  c.fillStyle = k.col('#e0703c'); c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 6 : 15; c.lineTo(x + Math.cos(a) * r, y + 6 + Math.sin(a) * r * 0.5); }
  c.fill();
}

function floor(k, st, t, L, R) {
  const c = k.c, bare = st.water > 580;
  c.fillStyle = k.col(FLESH);
  c.beginPath(); c.moveTo(L, 1300);
  for (let x = L; x <= R; x += 30) c.lineTo(x, floorY(x));
  c.lineTo(R, 1300); c.fill();
  if (img(k, 'belly-floor')) {
    // The seamless strip (2560 x 400 art, tiling every 1280) in 10-px columns,
    // each sheared to follow floorY, its top on the walkable line. The flesh
    // fill above shows below the strip.
    for (let x = Math.floor(L / 10) * 10; x < R; x += 10) {
      const y0 = floorY(x), y1 = floorY(x + 10), sx = (((x % 1280) + 1280) % 1280) * 2;
      c.save(); c.transform(1, (y1 - y0) / 10, 0, 1, x, y0);
      k.assetCrop('belly-floor', sx, 0, 20, 400, 0, 0, 10.6, 200);
      c.restore();
    }
  } else {
    c.strokeStyle = k.col(FLESH_LIT); c.lineWidth = 4;
    c.beginPath(); for (let x = L; x <= R; x += 30) c.lineTo(x, floorY(x) + 4); c.stroke();
  }
  // Under water the floor (a ground row in front of the water strip) is dimmed by it.
  const under = clamp((610 - st.water) / 30, 0, 1);
  if (under > 0) {
    c.save(); c.globalAlpha = 0.6 * under; c.fillStyle = k.col('#3d4a48');
    c.beginPath(); c.moveTo(L, 1300); for (let x = L; x <= R; x += 30) c.lineTo(x, floorY(x)); c.lineTo(R, 1300); c.fill();
    c.restore();
  }
  if (bare) {
    // The bare lining smarts: it reddens and fizzes.
    const k2 = clamp((st.water - 580) / 40, 0, 1);
    c.save(); c.globalAlpha = 0.45 * k2; c.fillStyle = k.col('#e0405a');
    c.beginPath(); c.moveTo(L, 1300); for (let x = L; x <= R; x += 30) c.lineTo(x, floorY(x)); c.lineTo(R, 1300); c.fill();
    c.globalAlpha = 0.8 * k2; c.fillStyle = k.col('#f3c6dc');
    for (let x = Math.floor(L / 60) * 60; x < R; x += 60) {
      const ph = (t * 1.4 + (x * 0.37) % 1) % 1;
      k.circle(x + ((x * 13) % 40), floorY(x) - ph * 26, 3 + (1 - ph) * 2);
    }
    c.restore();
  }
}

function water(k, st, t, L, R) {
  const c = k.c, y = st.water, b = st.breath.b;
  // Before the inhale the water trembles.
  const amp = 4 + (st.breath.phase === 'cue' ? (b - 12) * 2.5 : 0);
  if (img(k, 'belly-water')) {
    // The delivered strip (2560x300 art, drawn 1280x150) drifts slowly and
    // bobs with the tremble. Below it: belly-water-body when delivered, else the
    // strip's bottom fades into a dark gradient (no stretched streaks).
    const drift = (t * 18) % 1280, bob = Math.sin(t * 1.6) * amp * 0.5, top = y - 8 + bob;
    const body = img(k, 'belly-water-body');
    if (body) {
      // the requested seamless body (1024 art, 512 here) fills everything below the
      // strip; the strip is drawn over its top
      for (let ty = top + 120; ty < 1300; ty += 512) {
        for (let x = Math.floor((L - drift) / 512) * 512 + drift; x < R; x += 512) k.asset('belly-water-body', x + 256, ty + 512, 513, 513);
      }
    }
    for (let x = Math.floor((L - drift) / 1280) * 1280 + drift - 1280; x < R; x += 1280) {
      k.assetCrop('belly-water', 0, 0, 2560, 300, x, top, 1281, 150);
    }
    if (!body) {
      // Until then the strip's own bottom fades into a dark gradient, rather than
      // being stretched into streaks.
      const dark = k.col('#26343a'), gr = c.createLinearGradient(0, top + 70, 0, top + 150);
      gr.addColorStop(0, 'rgba(38,52,58,0)'); gr.addColorStop(1, dark);
      c.fillStyle = gr; c.fillRect(L, top + 70, R - L, 81);
      const gb = c.createLinearGradient(0, top + 150, 0, 1300);
      gb.addColorStop(0, dark); gb.addColorStop(1, k.col('#10181c'));
      c.fillStyle = gb; c.fillRect(L, top + 149, R - L, 1300 - (top + 149));
    }
    return;
  }
  const g = c.createLinearGradient(0, y, 0, y + 260);
  g.addColorStop(0, k.col('#5f6e66')); g.addColorStop(1, k.col('#2a2b36'));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(L, 1300);
  for (let x = L; x <= R; x += 40) c.lineTo(x, y + Math.sin(x * 0.02 + t * 1.6) * amp);
  c.lineTo(R, 1300); c.fill();
  c.strokeStyle = k.col('#bba9cc'); c.lineWidth = 3;
  c.beginPath(); for (let x = L; x <= R; x += 40) c.lineTo(x, y + Math.sin(x * 0.02 + t * 1.6) * amp); c.stroke();
  c.strokeStyle = k.col('#5f8c88'); c.lineWidth = 2;
  c.beginPath(); for (let x = L; x <= R; x += 40) c.lineTo(x, y + 22 + Math.sin(x * 0.017 - t * 1.2) * 3); c.stroke();
}
const img = (k, id) => !!k.img(id);

// Early warnings remain particles even in alternate renderer kits.
function omen(k, x, y, alpha) {
  k.c.save(); k.c.globalAlpha = alpha;
  k.omen?.(x, y, 1);
  k.c.restore();
}

// The tea-leaf omen over the floor, a beat before the low tide bares it.
function floorOmens(k, st, t, L, R) {
  const b = st.breath.b;
  if (st.carry.tea < 3 || b < 8.2 || b >= 12) return;
  const c = k.c;
  for (let x = Math.ceil(L / 240) * 240 + 120; x < R; x += 240) omen(k, x, floorY(x) - 40, 0.7 + 0.3 * Math.sin(t * 8));
}

// ---------------------------------------------------------------- the sailor
function sailor(k, st, t) {
  const c = k.c, s = st.s;
  if (st.phase === 'throat') c.globalAlpha = 1 - easeInOut(st.phaseT / OUTRO.throat) * 0.6;
  if (st.grace > 0 && Math.floor(t * 14) % 2) c.globalAlpha = 0.35;
  if (s.hang) { hanging(k, st); c.globalAlpha = 1; return; }
  const frame = whalePose(s, st.phase);
  c.save(); c.translate(s.x, s.y);
  if (st.phase === 'down') c.rotate(Math.min(1.4, st.phaseT * 1.2) * -s.face);
  c.scale(s.face, 1);
  drawSailor(k, frame);
  c.restore();
  c.globalAlpha = 1;
}

// Hanging from an edge (sailor-hang, hands at its top centre), then hauling
// himself over it (sailor-pullup, its ledge line 25% up). The leap sprite
// stands in for both until they are delivered.
function hanging(k, st) {
  const c = k.c, s = st.s, h = s.hang, e = extent(platformOf(st, h.id));
  const kClimb = h.climb < 0 ? -1 : Math.min(1, h.climb / HANG.climb);
  c.save();
  if (kClimb < 0) {
    c.translate(s.x, s.y); c.scale(s.face, 1);
    // his hands (the sprite's top centre) grip just inside the edge
    if (!k.asset('sailor-hang', HANG.off + 7, 0, 67, 134)) drawSailor(k, 'leap', -20);
  } else if (kClimb < 0.75 && k.img('sailor-pullup')) {
    c.translate(s.x, e.y + 91 * 0.25); c.scale(s.face, 1);
    k.asset('sailor-pullup', 0, 0, 79, 91);
  } else {
    c.translate(s.x, s.y); c.scale(s.face, 1);
    drawSailor(k, kClimb < 0.75 ? 'leap' : 'stand');
  }
  c.restore();
}

// The sailor at the origin (feet), facing right, 110 tall.
export function drawSailor(k, frame, dy = 0) {
  if (drawMovement(k, frame, 0, dy, 110)) return;
  if (frame === 'apex' || frame === 'fall') frame = 'leap';
  if (frame === 'land') frame = 'stand';
  const id = 'sailor-' + frame, w = frame === 'leap' ? 79 : 67;
  if (k.asset(id, 0, dy, w, 110)) return;
  const c = k.c;
  const legs = { stand: [[-6, 0], [6, 0]], 'walk-a': [[-16, 0], [14, 0]], 'pass-a': [[-3, 0], [3, -6]], 'walk-b': [[10, 0], [-8, 0]], 'pass-b': [[-3, -6], [3, 0]], leap: [[-18, -10], [16, -22]] }[frame];
  c.lineCap = 'round';
  for (const [fx, fy] of legs) {
    c.strokeStyle = k.col('#7d7f86'); c.lineWidth = 11;
    c.beginPath(); c.moveTo(fx * 0.3, -48); c.lineTo(fx, fy - 8); c.stroke();
    c.fillStyle = k.col('#1d1a1c'); c.beginPath(); c.roundRect(fx - 6, fy - 10, 16, 10, 3); c.fill();
  }
  // pea coat
  c.fillStyle = k.col('#24324f');
  c.beginPath(); c.moveTo(-15, -40); c.lineTo(-13, -86); c.lineTo(13, -86); c.lineTo(16, -40); c.fill();
  const arm = frame === 'leap' ? -1.9 : frame === 'stand' || frame.startsWith('pass-') ? 0.15 : frame === 'walk-a' ? 0.5 : -0.4;
  c.save(); c.translate(2, -82); c.rotate(arm); c.fillStyle = k.col('#1d2a44'); c.beginPath(); c.roundRect(-5, 0, 10, 34, 4); c.fill();
  c.fillStyle = k.col('#e9c9a8'); k.circle(0, 36, 5); c.restore();
  c.fillStyle = k.col('#d9b34a'); for (const dy of [-76, -64, -52]) k.circle(6, dy, 2);
  // neckerchief, head, beard, cap
  c.fillStyle = k.col('#c8321e'); c.beginPath(); c.moveTo(-10, -88); c.lineTo(12, -88); c.lineTo(4, -78); c.fill();
  c.fillStyle = k.col('#e9c9a8'); k.circle(2, -97, 10);
  c.fillStyle = k.col('#c9c4bc'); c.beginPath(); c.moveTo(-6, -98); c.quadraticCurveTo(0, -80, 13, -94); c.lineTo(12, -98); c.fill();
  c.fillStyle = k.col('#1d2740'); c.fillRect(-9, -112, 20, 8); c.fillRect(-9, -106, 26, 3);
  c.fillStyle = k.col('#1a1012'); k.circle(7, -100, 1.6);
}

// ---------------------------------------------------------------- the set's machinery
function foreRibs(k, st) {
  // Foreground rib flats, nearer than the set (parallax 1.35), framing the view.
  const c = k.c, gap = 2200, ox = -((st.cam.x * 1.35) % gap), oy = -st.cam.y * 0.4;
  c.save(); c.lineCap = 'round';
  for (let x = ox - gap; x < 1280 + gap; x += gap) {
    for (const [col, lw] of [['#2c1324', 30], ['#7a5262', 4]]) {
      c.strokeStyle = k.col(col); c.lineWidth = lw;
      c.beginPath(); c.moveTo(x, 780); c.quadraticCurveTo(x - 10, 120 + oy, x + 260, -160 + oy); c.stroke();
      c.beginPath(); c.moveTo(x + 1180, 780); c.quadraticCurveTo(x + 1190, 120 + oy, x + 920, -160 + oy); c.stroke();
    }
  }
  c.restore();
}

function setBase(k) {
  // The edge of the set platform, and the rocker of the cradle beneath it.
  const c = k.c;
  if (img(k, 'set-platform-edge')) {
    // the seamless beam (2560 x 40 art, 1280 x 20 here), tiled, its top on y 648
    for (let x = -300; x < 1580; x += 1280) k.asset('set-platform-edge', x + 640, 648 + 20, 1281, 20);
  } else {
    c.fillStyle = k.col('#3a2112'); c.fillRect(-300, 648, 1880, 16);
    c.fillStyle = k.col('#b9a27c'); c.fillRect(-300, 648, 1880, 3);
  }
  if (k.asset('cradle', 640, 662 + 110, 700, 110)) return;
  c.strokeStyle = k.col('#6b4024'); c.lineWidth = 16; c.lineCap = 'round';
  c.beginPath(); c.moveTo(300, 664); c.quadraticCurveTo(640, 820, 980, 664); c.stroke();
  c.strokeStyle = k.col('#c9b48a'); c.lineWidth = 3;
  for (const x of [380, 500, 640, 780, 900]) { c.beginPath(); c.moveTo(x, 664); c.lineTo(x, 664 + 70 * Math.sin(((x - 300) / 680) * Math.PI)); c.stroke(); }
}

function fulcrum(k) {
  const c = k.c;
  if (k.asset('cradle-fulcrum', 640, 760, 80, 60)) return;   // 160 x 120 art, bottom centre on y 760
  c.fillStyle = k.col('#2a160e'); c.beginPath(); c.moveTo(600, 760); c.lineTo(640, 712); c.lineTo(680, 760); c.fill();
  c.fillStyle = k.col('#d9b34a'); k.circle(640, 716, 6);
}

// The stage manager's cue board: four lamps count in the whale's breath.
function cueBoard(k, st, t) {
  const c = k.c, b = st.breath.b, ph = st.breath.phase, x = 196, y = 90;
  c.fillStyle = k.col('#2a1424'); c.strokeStyle = k.col('#d9b34a'); c.lineWidth = 2;
  c.beginPath(); c.roundRect(x, y - 20, 186, 40, 8); c.fill(); c.stroke();
  c.fillStyle = k.col('#f3c6dc'); c.font = '700 13px "Josefin Sans", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(ph === 'low' ? TEXT.whale.cue.low : ph === 'inhale' || ph === 'high' ? TEXT.whale.cue.inhale : TEXT.whale.cue.breath, x + 12, y + 1);
  for (let i = 0; i < 4; i++) {
    let col = '#4b3a45', glow = 0;
    if (ph === 'cue' && b - 12 >= i) { col = '#ffcf5c'; glow = 1 - ((b - 12) % 1) * (b - 12 < i + 1 ? 1 : 0) * 0.5; }
    else if (ph === 'inhale' || ph === 'high') { col = '#9fd6cf'; glow = 0.6; }
    else if (ph === 'low') { col = Math.floor(t * 4) % 2 ? '#e0405a' : '#6a2a3a'; }
    const lx = x + 104 + i * 22;
    if (glow) { c.save(); c.globalAlpha = 0.35 * glow; c.fillStyle = k.col(col); k.circle(lx, y, 13); c.restore(); }
    c.fillStyle = k.col(col); k.circle(lx, y, 7);
  }
  c.textBaseline = 'alphabetic';
}

// ================================================================ the beaching
function shoreScene(k, st, t) {
  const c = k.c, n = st.revellers, T = shoreTimes(n);
  const pt = st.phase === 'shore' ? st.phaseT : T.end + (st.phase === 'iris' ? st.phaseT : OUTRO.iris);
  // pale sky and hung clouds
  // the requested backcloth (2560 x 1440 art) is the whole frame: sky, clouds, sea
  // (the film edition's shore shows the cave Aurora points to, at the right)
  const cloth = (FILM && k.asset('shore-cave', 640, 720, 1280, 720)) || k.asset('shore-backcloth', 640, 720, 1280, 720);
  if (!cloth) {
    const g = c.createLinearGradient(0, 60, 0, 440);
    g.addColorStop(0, k.col('#e9b9c4')); g.addColorStop(1, k.col('#f8ded6'));
    c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
  }
  k.cloud(320, 170, 0.8, '#f6e4e6'); k.cloud(930, 130, 0.65, '#f6e4e6');
  if (!cloth) sea(k, t);
  // its tail lifts out of the sea and slips away
  const tk = pt - T.tail, lift = easeOut(tk / 1.2) - easeInOut((tk - 1.8) / 1.2);
  if (tk > 0 && lift > 0.01) {
    c.save(); c.beginPath(); c.rect(0, 0, 1280, SEA_Y + 4); c.clip();
    const by = SEA_Y + 10 + (1 - lift) * 260;
    if (!k.asset('whale-tail', 260, by, 350, 250, WHALE_PRINT)) tailStandin(k, 260, by);
    c.restore();
  }
  // the whale, beached on the rocks, then sliding back into the sea
  const slide = easeInOut((pt - T.slide) / 2.4);
  const wx = 520 - slide * 1000, wb = 610 + slide * 70;   // belly sunk into the painted rocks
  if (slide < 1) whaleBeached(k, wx, wb, t);
  rocks(k);
  // the sailor crawls out of the mouth onto the rocks
  const mouth = { x: 902, y: 455 };   // 50 lower with the whale
  const sp = clamp((pt - T.crawl) / 2, 0, 1);
  crawler(k, mouth, { x: 950, y: rockTop(950) + 6 }, sp, (fr) => drawSailor(k, fr), t,
    { crawl: ['prince-crawl-a', 'prince-crawl-b'], rise: 'prince-kneel-rise', stand: (x, y) => { k.c.save(); k.c.translate(x, y); drawSailor(k, 'stand'); k.c.restore(); }, std: 360, H: 110 });
  for (let i = 0; i < n; i++) {
    const p = clamp((pt - T.out - i * T.gap) / 1.6, 0, 1);
    if (p <= 0) continue;
    const r = REV[i % REV.length], tx = 900 - i * 44, to = { x: tx, y: rockTop(tx) + 6 + (i % 2) * 8 };
    const crew = CREW_OF[r.id];
    crawler(k, mouth, to, p, () => { if (!k.asset(r.id, 0, 0, 60, 115)) figure(k, r.col, Math.sin(t * 6 + i) * 0.5 + 0.5); }, t + i,
      crew && { crawl: [crew + '-crawl'], rise: null, stand: (x, y) => k.asset(r.id, x, y, 60, 115), std: 420, H: 115 });
  }
  // The film edition: Aurora appears on the rocks at the right and points the
  // way on toward the cave (tableau 23), once the party is out.
  if (FILM) {
    const ap = easeOut((pt - T.out - n * T.gap - 0.6) / 1.4);
    if (ap > 0) {
      c.save(); c.globalAlpha = ap;
      c.fillStyle = k.col('#fff2c0'); c.globalAlpha = 0.25 * ap; k.circle(1090, 470, 120); c.globalAlpha = ap;
      if (!k.asset('aurora-point', 1090, rockTop(1100) + 10, 120, 170)) { c.fillStyle = k.col('#f4ead2'); k.circle(1090, 420, 30); }
      c.restore();
    }
  }
  k.wash('#e7a6bd', 0.3); // the video's rose-pink stage wash
}

// Top of the painted shore-rocks ground row (art alpha, sampled every 40 px
// over its main mass); the landing spots stand on it.
const ROCK_TOPS = [[560, 512], [600, 548], [640, 544], [680, 574], [720, 596], [760, 594], [800, 586], [840, 577], [880, 566], [920, 572], [960, 556]];
function rockTop(x) {
  const T = ROCK_TOPS;
  if (x <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (x <= T[i][0]) return T[i - 1][1] + (T[i][1] - T[i - 1][1]) * (x - T[i - 1][0]) / (T[i][0] - T[i - 1][0]);
  return T[T.length - 1][1];
}

// Crawl from `a` to `b` head-first, low to the ground, then stand up: on the
// crawling and rising sprites where they have been delivered (`poses`), else
// a walking figure laid on its side.
function crawler(k, a, b, p, drawFig, t, poses = null) {
  if (p <= 0) return;
  const c = k.c, m = easeInOut(p);
  const x = a.x + (b.x - a.x) * m, y = a.y + (b.y - a.y) * m - Math.sin(Math.PI * m) * 10;
  if (FILM && poses && k.img(poses.crawl[0])) {
    const face = b.x >= a.x ? 1 : -1;
    // down the slope of the rocks, tipped a little with it
    const tilt = p < 0.72 ? Math.atan2(b.y - a.y, Math.abs(b.x - a.x)) * 0.35 * face : 0;
    if (p < 0.72) {
      const fr = poses.crawl[Math.floor(t * 4) % poses.crawl.length];
      drawPose(k, fr, x, y + Math.sin(t * 8) * 1.2, poses.H, { std: poses.std, face, rot: tilt, pivot: 20 });
    } else if (p < 0.9 && poses.rise && k.img(poses.rise)) drawPose(k, poses.rise, x, y, poses.H, { std: poses.std, face });
    else if (p < 0.82 && !poses.rise) drawPose(k, poses.crawl[0], x, y, poses.H, { std: poses.std, face });
    else poses.stand(x, y);
    return;
  }
  const rot = 1.25 * (1 - easeInOut((p - 0.72) / 0.28));
  c.save(); c.translate(x, y); c.rotate(rot + (rot > 0.3 ? Math.sin(t * 10) * 0.04 : 0));
  drawFig(p < 1 ? walkPose(t * 120) : 'stand');
  c.restore();
}

function figure(k, col, bob) {
  const c = k.c;
  c.fillStyle = k.col(col);
  c.beginPath(); c.moveTo(-18, 0); c.lineTo(-13, -76); c.lineTo(13, -76); c.lineTo(18, 0); c.fill();
  c.save(); c.translate(0, -68); c.rotate((bob - 0.5) * 0.6); c.fillRect(-30, -4, 60, 8); c.restore();
  c.fillStyle = k.col('#efd7c4'); k.circle(0, -88, 11);
  c.fillStyle = k.col('#2a1a22'); c.fillRect(-13, -103, 26, 6);
}

// The whale is painted dark slate and magenta; against the bright shore cloth
// the print and dye passes left him pale, so he is printed deeper and richer.
const WHALE_PRINT = 'brightness(0.74) contrast(1.35) saturate(1.5)';
function whaleBeached(k, x, bottom, t) {
  if (k.asset('whale-beached', x, bottom, 900, 450, WHALE_PRINT)) return;
  const c = k.c, top = bottom - 380;
  // slate body facing right, the tail end curling up at the left
  c.fillStyle = k.col('#5a6470');
  c.beginPath();
  c.moveTo(x - 440, top + 120);
  c.quadraticCurveTo(x - 400, top + 230, x - 300, top + 250);
  c.quadraticCurveTo(x - 60, top + 40, x + 260, top + 70);
  c.quadraticCurveTo(x + 400, top + 90, x + 420, top + 200);
  c.lineTo(x + 300, top + 240);
  c.lineTo(x + 430, top + 300);
  c.quadraticCurveTo(x + 300, bottom + 10, x - 100, bottom);
  c.quadraticCurveTo(x - 330, bottom - 40, x - 360, top + 250);
  c.quadraticCurveTo(x - 420, top + 200, x - 440, top + 120);
  c.fill();
  // the open mouth: dark gape with baleen
  c.fillStyle = k.col('#2a1424');
  c.beginPath(); c.moveTo(x + 420, top + 200); c.lineTo(x + 296, top + 240); c.lineTo(x + 430, top + 300); c.closePath(); c.fill();
  c.strokeStyle = k.col('#e8dccb'); c.lineWidth = 3;
  for (let i = 0; i < 7; i++) { const yy = top + 208 + i * 4; c.beginPath(); c.moveTo(x + 330 + i * 12, yy); c.lineTo(x + 330 + i * 12, yy + 12); c.stroke(); }
  // pale ridged throat
  c.fillStyle = k.col('#cfc2b4');
  c.beginPath(); c.moveTo(x + 430, top + 300); c.quadraticCurveTo(x + 300, bottom + 4, x - 40, bottom - 4); c.quadraticCurveTo(x + 200, top + 330, x + 420, top + 296); c.fill();
  c.strokeStyle = k.col('#8f8478'); c.lineWidth = 2;
  for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x + 400 - i * 60, top + 306 + i * 6); c.quadraticCurveTo(x + 260 - i * 50, top + 340 + i * 2, x + 60 - i * 40, bottom - 10); c.stroke(); }
  c.fillStyle = k.col('#f1e3c8'); k.circle(x + 230, top + 160, 9); c.fillStyle = k.col('#1a1012'); k.circle(x + 232, top + 161, 4);
}

function tailStandin(k, x, bottom) {
  const c = k.c;
  c.fillStyle = k.col('#5a6470');
  c.beginPath(); c.moveTo(x - 30, bottom); c.lineTo(x - 18, bottom - 150);
  c.quadraticCurveTo(x - 120, bottom - 170, x - 170, bottom - 240); c.quadraticCurveTo(x - 60, bottom - 220, x, bottom - 190);
  c.quadraticCurveTo(x + 60, bottom - 220, x + 170, bottom - 240); c.quadraticCurveTo(x + 120, bottom - 170, x + 18, bottom - 150);
  c.lineTo(x + 30, bottom); c.fill();
  c.strokeStyle = k.col('#ffffff'); c.lineWidth = 3;
  for (const dx of [-140, -90, 90, 140]) { c.beginPath(); c.moveTo(x + dx, bottom - 220); c.lineTo(x + dx * 1.05, bottom - 140); c.stroke(); }
}

const SEA_Y = 430;
const BOULDERS = [
  [60, 600, 90, 50, '#857679'], [210, 590, 80, 44, '#958687'], [350, 610, 100, 46, '#7e7075'],
  [520, 596, 90, 52, '#918283'], [680, 612, 110, 40, '#857679'], [850, 600, 80, 46, '#9a8b8a'],
  [1000, 616, 110, 40, '#8a7b7d'], [1160, 604, 100, 50, '#938485'], [1280, 620, 80, 40, '#857679'],
];
function sea(k, t) {
  const c = k.c, y = SEA_Y;
  c.fillStyle = k.col('#6f9896');
  c.beginPath(); c.moveTo(0, 720); for (let x = 0; x <= 1280; x += 40) c.lineTo(x, y + Math.sin(x * 0.03 + t * 1.5) * 5); c.lineTo(1280, 720); c.fill();
  c.strokeStyle = k.col('#ffffff'); c.lineWidth = 3;
  c.beginPath(); for (let x = 0; x <= 1280; x += 40) c.lineTo(x, y + Math.sin(x * 0.03 + t * 1.5) * 5); c.stroke();
  c.strokeStyle = k.col('#d8e6e2'); c.lineWidth = 2;
  for (let r = 1; r < 3; r++) { c.beginPath(); for (let x = 0; x <= 1280; x += 40) c.lineTo(x, y + r * 22 + Math.sin(x * 0.025 - t * 1.2 + r) * 4); c.stroke(); }
}

function rocks(k) {
  if (k.asset('shore-rocks', 640, 720, 1280, 300)) return;
  const c = k.c;
  // A ground row of boulders: a darker back rank, a paler front rank, surf between.
  c.fillStyle = k.col('#6f6266');
  c.beginPath(); c.moveTo(0, 720); c.lineTo(0, 540);
  for (let x = 0; x <= 1280; x += 80) c.lineTo(x, 520 + ((x * 37) % 50));
  c.lineTo(1280, 720); c.fill();
  c.strokeStyle = k.col('#ffffff'); c.lineWidth = 3;
  c.beginPath(); for (let x = 0; x <= 1280; x += 80) c.lineTo(x, 516 + ((x * 37) % 50)); c.stroke();
  for (const [x, y, rx, ry, col] of BOULDERS) {
    // an angular cut-out rock with a lit facet on top
    const j = (n) => ((x * 7 + n * 13) % 17) / 17 - 0.5;
    c.fillStyle = k.col(col);
    c.beginPath(); c.moveTo(x - rx, 730); c.lineTo(x - rx, y + ry * 0.1); c.lineTo(x - rx * 0.55, y - ry * (0.8 + j(1) * 0.3));
    c.lineTo(x + rx * (0.1 + j(2) * 0.3), y - ry); c.lineTo(x + rx * 0.7, y - ry * (0.6 + j(3) * 0.3)); c.lineTo(x + rx, y + ry * 0.2); c.lineTo(x + rx, 730); c.fill();
    c.fillStyle = k.col('#d9cfca');
    c.beginPath(); c.moveTo(x - rx * 0.55, y - ry * (0.8 + j(1) * 0.3)); c.lineTo(x + rx * (0.1 + j(2) * 0.3), y - ry); c.lineTo(x + rx * 0.2, y - ry * 0.55); c.lineTo(x - rx * 0.4, y - ry * 0.45); c.fill();
    c.strokeStyle = k.col('#5e5256'); c.lineWidth = 2;
    c.beginPath(); c.moveTo(x + rx * 0.2, y - ry * 0.55); c.lineTo(x + rx * 0.35, y + ry * 0.6); c.stroke();
  }
  // gulls
  c.strokeStyle = k.col('#3a3438'); c.lineWidth = 2;
  for (const [gx, gy] of [[700, 210], [760, 190], [1010, 240]]) { c.beginPath(); c.moveTo(gx - 12, gy); c.quadraticCurveTo(gx - 6, gy - 7, gx, gy); c.quadraticCurveTo(gx + 6, gy - 7, gx + 12, gy); c.stroke(); }
}
