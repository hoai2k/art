import { LEGACY, FILM } from '../theme.js';
import { drawPose, CREW_OF } from '../pose.js';
// Act I drawing: the voyage (kit.voyage) and the ending scenes. Every piece
// of new art has a procedural stand-in until its file is delivered (ids are
// in design/image-requests.md, Part C2).
import { LANTERNS, ENDING, SPOTS } from './act1.js';
import { ROWS, rowPos } from '../board.js';
import { clamp, easeOut, easeInOut, beatPhase } from './shared.js';

// The deck set as delivered (drawn 1280x500 with its foot at the deck line,
// y 660 when fully up): the deck floor runs y 395-480 behind the carved rail,
// and its two hatches open at x 320-500 and 785-960, around y 450. Figures
// stand on the floor (feet above the rail) or on the barrels (act1.js SPOTS).
const HATCHES = [{ x: 410, y: 450 }, { x: 872, y: 450 }];
const LIP = 472;                 // the hatches' front edge: a figure below it is in the hole
const BAND = { x: 640, y: 474, s: 210 };
const REVELLERS = [
  { id: 'reveller-yellow', col: '#e3c13b' },
  { id: 'reveller-shaggy', col: '#6f9a4a' },
  { id: 'reveller-jester', col: '#8a3f7a' },
  { id: 'reveller-lady', col: '#e7a6bd' },
];
// Revellers spring out of the hatches to their spots as the deck rises,
// hold the moment, and when the witch strikes hop toward the nearest hatch
// and drop in.
const ARRIVE = { from: 0.55, stagger: 0.12, dur: 0.5 };
const FLEE = { from: 0.9, stagger: 0.14, hop: 0.3, hopLen: 120, dive: 0.35 };
const LANTERN_COLS = ['#f3c6dc', '#d9b34a', '#5f8c88'];

export function draw(k, st, t) {
  const b = st.board, ph = st.phase, pt = st.phaseT;
  if (ph === 'voyage' || ph === 'landho') return k.voyage(b);
  if (ph === 'party' || ph === 'turn') {
    // The wave rows sink through the floor and the deck set rises, at once
    // when the bell has rung; it drops away after the revellers are below.
    const deck = ph === 'party' ? easeInOut(pt / 0.8) : 1 - easeInOut((pt - 2.9) / 1.3);
    k.voyage(b, { rowsDrop: deck * 360, hideShip: true });
    if (ph === 'turn') whiteout(k, pt);
    if (FILM) tempestSky(k, st, deck, t);
    deckScene(k, st, deck, t);
    if (FILM) tempestRain(k, st, deck, t);
    if (ph === 'turn') spirits(k, pt, t);
    if (ph === 'turn' && FILM) witchInStorm(k, st, pt, t);
    return;
  }
  if (ph === 'wreck') return wreck(k, st, pt, t);
  if (ph === 'sink' || ph === 'iris') return sinking(k, st, ph === 'sink' ? pt : ENDING.sink + pt, t);
}

// The mobile camera's focus (src/camera.js): the player's middle, stage px.
export function focus(st) {
  if (st.phase !== 'voyage') return null;
  const s = st.board.ship, rp = rowPos(s), r0 = Math.floor(rp), r1 = Math.min(2, r0 + 1), f = rp - r0;
  const y = ROWS[r0].y + (ROWS[r1].y - ROWS[r0].y) * f, scale = ROWS[r0].scale + (ROWS[r1].scale - ROWS[r0].scale) * f;
  return { x: s.x, y: y - 70 * scale };
}

export function drawOver(k, st) {
  if (st.phase === 'iris') k.iris(640, 400, 760 * (1 - easeInOut(st.phaseT / ENDING.iris)));
  if (st.status === 'won') k.iris(640, 400, 0);
}

export function onEvent(k, e, st) {
  if (st.phase === 'voyage' || st.phase === 'landho') return k.voyageEvent(e, st.board);
  if (e.type === 'partyHit') {
    // two painted lanterns light per hit (the pair he lit, in the film)
    const i = e.i ?? e.n - 1;
    for (const j of [2 * i, 2 * i + 1]) {
      const px = PAINTED[Math.min(j, PAINTED.length - 1)].x;
      for (const c of LANTERN_COLS) k.burst(px, 170, c, 3, 'confetti');
    }
    k.text(FILM ? '✦' : '♪', lanternX(i), 140);
  }
  if (e.type === 'revelry') { if (!FILM) k.text('Revelry!', 640, 260, true); for (const c of LANTERN_COLS) k.burst(640, 300, c, 20, 'confetti'); }
  if (e.type === 'strike') { k.flash(1); k.shake(0.5); }
  // the keel breaks where the spout holds it up; each half splashes down where it fell
  const sx = st.board.ship.x;
  if (e.type === 'shipBreak') { k.shake(0.8); k.burst(sx, 512 - 110, '#6b4024', 30, 'chip'); }
  if (e.type === 'splash') { k.burst(sx - 125, 520, '#eef3ea', 26, 'drop'); k.burst(sx + 125, 520, '#eef3ea', 26, 'drop'); }
}

// ---------------------------------------------------------------- tempest
// The film edition's deck scene is the witch's tempest, not a party: the sky
// blackens behind the deck, she rises on her storm cloud, lightning flickers
// and rain drives across the stage. Drawn from state and t only.
const flash = (t) => { const f = (t * 0.9) % 1, n = Math.floor(t * 0.9); return f < 0.06 && (n * 7) % 3 !== 0 ? 1 - f / 0.06 : 0; };
function tempestSky(k, st, deck, t) {
  const c = k.c, rise = st.phase === 'party' ? easeOut(st.phaseT / ENDING.party) : 1;
  // the delivered storm sky, tiling and drifting, fades up with the deck
  if (k.img('tempest-sky')) {
    const w = 470 * 2560 / 820, o = (t * 24) % w;   // its own proportions, 470 tall
    c.save(); c.globalAlpha = deck;
    for (const x of [w / 2 - o, w * 1.5 - o]) k.asset('tempest-sky', x, 470, w, 470);
    c.restore();
  }
  c.save(); c.globalAlpha = (k.img('tempest-sky') ? 0.2 : 0.55) * deck; c.fillStyle = k.col('#1a1024'); c.fillRect(0, 0, 1280, 470); c.restore();
  const lf = flash(t);
  if (lf > 0) { c.save(); c.globalAlpha = 0.35 * lf * deck; c.fillStyle = k.col('#e9d6f2'); c.fillRect(0, 0, 1280, 470); c.restore(); }
  // she rises on her cloud over the stern, larger as the storm grows
  if (st.phase === 'party' && deck > 0.3) {
    const s = 0.6 + 0.5 * rise, x = 990, y = 330 - 110 * rise;
    c.save(); c.globalAlpha = Math.min(1, deck * 1.4);
    if (!k.asset('witch-storm', x, y, 260 * s, 170 * s)) { c.fillStyle = k.col('#2a2430'); k.cloud?.(x, y - 40, 1.2 * s); }
    c.restore();
  }
}
function tempestRain(k, st, deck, t) {
  const c = k.c;
  c.save(); c.globalAlpha = 0.35 * deck; c.strokeStyle = k.col('#cfd8e6'); c.lineWidth = 1.5;
  c.beginPath();
  for (let i = 0; i < 70; i++) {
    const x = ((i * 137 + t * 900) % 1500) - 110, y = ((i * 263 + t * 1300) % 820) - 60;
    c.moveTo(x, y); c.lineTo(x - 18, y + 40);
  }
  c.stroke(); c.restore();
}

// ---------------------------------------------------------------- party
// The delivered lantern-string (1200x300 art, drawn 600x150 centred on 640):
// where its 8 lanterns hang in the art (measured from the alpha), as art x
// and the y of each lantern's middle below the string's top edge.
const STRING_X = [83, 217, 360, 513, 679, 835, 983, 1117];
const STRING_Y = [135, 183, 225, 228, 242, 225, 183, 135];
const STRING_CUT = [0, 150, 288, 436, 596, 757, 909, 1050, 1200]; // column boundaries between lanterns
const PAINTED = STRING_X.map((sx, i) => ({ x: 640 + (sx - 600) / 2, dy: STRING_Y[i] / 2 }));
// each hit lights two painted lanterns; this is the middle of that pair
const lanternX = (i) => (PAINTED[Math.min(2 * i, 7)].x + PAINTED[Math.min(2 * i + 1, 7)].x) / 2;

function deckScene(k, st, deck, t) {
  const c = k.c, base = 660 + (1 - deck) * 520, off = base - 660; // deck floor line, and how far it has sunk
  const beat = st.beat ?? t / 0.784;
  const bob = Math.abs(Math.sin(Math.PI * beatPhase(beat)));
  if (deck > 0.5) lanterns(k, st.party.lit, t, deck, FILM ? st.party.on : null);
  if (!k.asset('deck-set', 640, base + 10, 1280, 500)) deckStandin(k, base);
  // Everyone on the deck, back to front.
  const items = LEGACY ? [{ y: BAND.y, f: () => {
    if (!k.idle('band-trio', beat * 60 / 76.5, BAND.x, BAND.y + off, BAND.s, BAND.s)) {
      for (const [dx, col] of [[-50, '#2b2b2b'], [0, '#e9e1d0'], [50, '#5a4a3a']]) figure(k, BAND.x + dx, BAND.y + off, col, bob * 0.5, 0.9);
    }
  } }] : [];
  REVELLERS.forEach((r, i) => {
    const p = revellerAt(st, i, bob);
    if (!p) return;
    items.push({ y: p.y, f: () => {
      // Clipped at the hatches' front edge, so a figure below it is down the hole.
      c.save(); c.beginPath(); c.rect(0, 0, 1280, LIP + off); c.clip();
      if (!k.idle(r.id, beat * 60 / 76.5 + i * 0.13, p.x, p.y + off, 110 * p.s, 210 * p.s)) figure(k, p.x, p.y + off, r.col, 0, p.s);
      c.restore();
    } });
  });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.f();
}

// Revelling on the spot: a hop on every beat, as on the old line-up, scaled
// to how far back the spot stands.
const dancing = (spot, bob) => ({ x: spot.x, y: spot.y - bob * 16 * spot.s / 0.8, s: spot.s });

// Where reveller i is (feet x, y, scale), or null while below deck.
function revellerAt(st, i, bob) {
  const spot = SPOTS[st.party.spots?.[i] ?? (FILM ? i : i + 2)];
  const h = HATCHES[spot.x < 640 ? 0 : 1];
  const pt = st.phaseT;
  if (st.phase === 'party') {
    // Out of the hatch in one bound, up and over to the spot.
    const k = clamp((pt - ARRIVE.from - i * ARRIVE.stagger) / ARRIVE.dur, 0, 1);
    if (k <= 0) return null;
    if (k >= 1) return dancing(spot, bob);
    const e = easeOut(k), peak = Math.min(spot.y, h.y) - 120;
    const x = h.x + (spot.x - h.x) * e;
    const y = (1 - e) ** 2 * (h.y + 150) + 2 * (1 - e) * e * peak + e * e * spot.y;
    return { x, y, s: 0.72 + (spot.s - 0.72) * e };
  }
  // The turn: hop, hop toward the hatch, then drop in.
  const dist = Math.hypot(h.x - spot.x, h.y - spot.y), hops = Math.max(1, Math.ceil(dist / FLEE.hopLen));
  let tt = pt - FLEE.from - i * FLEE.stagger;
  if (tt <= 0) return dancing(spot, bob);
  const hopT = hops * FLEE.hop;
  if (tt < hopT) {
    const n = Math.floor(tt / FLEE.hop), f = (tt % FLEE.hop) / FLEE.hop;
    const a = n / hops, b2 = (n + 1) / hops, at = (u) => ({ x: spot.x + (h.x - spot.x) * u, y: spot.y + (h.y - spot.y) * u, s: spot.s + (0.74 - spot.s) * u });
    const p0 = at(a), p1 = at(b2), u = easeInOut(f);
    return { x: p0.x + (p1.x - p0.x) * u, y: p0.y + (p1.y - p0.y) * u - Math.sin(Math.PI * f) * 34, s: p0.s + (p1.s - p0.s) * u };
  }
  tt -= hopT;
  if (tt < FLEE.dive) {
    // a little spring up, then straight down past the lip
    const f = tt / FLEE.dive;
    return { x: h.x, y: h.y - Math.sin(Math.PI * Math.min(1, f * 2)) * 30 * (f < 0.5 ? 1 : 0) + Math.max(0, f - 0.3) / 0.7 * 230, s: 0.74 };
  }
  return null;
}

function lanterns(k, lit, t, deck, on = null) {
  const c = k.c, y0 = 120 + (1 - deck) * 200;
  if (k.asset('lantern-string', 640, y0 - 20 + 150, 600, 150)) {
    const n = Math.min(8, lit * Math.ceil(8 / LANTERNS));
    // which painted lanterns are lit: the first n, or each lit pair (film)
    const lt = (j) => (on ? !!on[Math.floor(j / 2)] : j < n);
    // the lit string, one column per lit lantern, over the unlit one
    for (let j = 0; j < 8; j++) if (lt(j)) k.assetCrop('lantern-string-lit', STRING_CUT[j], 0, STRING_CUT[j + 1] - STRING_CUT[j], 300, 340 + STRING_CUT[j] / 2, y0 - 20, (STRING_CUT[j + 1] - STRING_CUT[j]) / 2, 150);
    for (let j = 0; j < 8; j++) {
      if (!lt(j)) continue;
      const x = PAINTED[j].x, y = y0 - 20 + PAINTED[j].dy;
      const g = c.createRadialGradient(x, y, 2, x, y, 46);
      g.addColorStop(0, k.P.mode === 'lum' ? 'rgba(255,245,215,0.6)' : 'rgba(255,210,120,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x - 46, y - 46, 92, 92);
    }
    return;
  }
  c.strokeStyle = k.col('#3a2112'); c.lineWidth = 2;
  c.beginPath(); c.moveTo(250, y0 - 20);
  for (let i = 0; i < LANTERNS; i++) c.lineTo(lanternX(i), y0 + Math.sin((i / (LANTERNS - 1)) * Math.PI) * 40);
  c.lineTo(1030, y0 - 20); c.stroke();
  for (let i = 0; i < LANTERNS; i++) {
    const x = lanternX(i), y = y0 + Math.sin((i / (LANTERNS - 1)) * Math.PI) * 40 + 18;
    const on = i < lit;
    if (on) {
      const g = c.createRadialGradient(x, y, 2, x, y, 40);
      g.addColorStop(0, k.P.mode === 'lum' ? 'rgba(255,245,215,0.7)' : 'rgba(255,210,120,0.7)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x - 40, y - 40, 80, 80);
    }
    c.fillStyle = k.col(on ? LANTERN_COLS[i % 3] : '#4b3a45');
    c.beginPath(); c.ellipse(x, y, 13, 16, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = k.col('#3a2112'); c.fillRect(x - 6, y - 19, 12, 4); c.fillRect(x - 6, y + 15, 12, 4);
  }
}

function deckStandin(k, base) {
  const c = k.c;
  // mast and rigging
  c.fillStyle = k.col('#3a2112'); c.fillRect(632, base - 560, 16, 500);
  c.strokeStyle = k.col('#3a2112'); c.lineWidth = 2;
  for (const dx of [-300, -150, 150, 300]) { c.beginPath(); c.moveTo(640, base - 540); c.lineTo(640 + dx, base - 64); c.stroke(); }
  // deck boards
  c.fillStyle = k.col('#8a5a32'); c.fillRect(0, base - 64, 1280, 80);
  c.fillStyle = k.col('#1a1012');
  for (const h of HATCHES) c.fillRect(h.x - 70, base - 660 + h.y - 20, 140, 36);
  // barrels
  for (const x of [560, 720]) { c.fillStyle = k.col('#7a4a26'); c.beginPath(); c.ellipse(x, base - 96, 30, 36, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = k.col('#3a2112'); c.fillRect(x - 30, base - 106, 60, 5); c.fillRect(x - 30, base - 88, 60, 5); }
  // carved rail with heraldic shields
  c.fillStyle = k.col('#b9a27c'); c.fillRect(0, base - 30, 1280, 50);
  c.fillStyle = k.col('#8c7448'); c.fillRect(0, base - 34, 1280, 6);
  for (let x = 120; x < 1280; x += 160) {
    c.fillStyle = k.col(['#8e1730', '#d9b34a', '#5f8c88'][(x / 160) % 3 | 0]);
    c.beginPath(); c.moveTo(x - 18, base - 20); c.lineTo(x + 18, base - 20); c.lineTo(x + 18, base - 2); c.quadraticCurveTo(x, base + 16, x - 18, base - 2); c.closePath(); c.fill();
  }
}

// A stand-in cut-out person: hat, head, coat in `col`, dancing with the beat.
function figure(k, x0, y0, col, bob = 0, s = 1) {
  const c = k.c;
  c.save(); c.translate(x0, y0); c.scale(s, s);
  const x = 0, y = 0;
  c.fillStyle = k.col(col);
  c.beginPath(); c.moveTo(x - 22, y); c.lineTo(x - 16, y - 90); c.lineTo(x + 16, y - 90); c.lineTo(x + 22, y); c.fill();
  c.save(); c.translate(x, y - 80); c.rotate((bob - 0.5) * 0.8);
  c.fillRect(-36, -4, 72, 9); c.restore();
  c.fillStyle = k.col('#efd7c4'); k.circle(x, y - 104, 13);
  c.fillStyle = k.col('#2a1a22'); c.fillRect(x - 15, y - 122, 30, 7);
  c.restore();
}

// ---------------------------------------------------------------- the turn
// The film's witch in the turn: from over the stern she swoops into the
// middle of the stage and hovers there while the spirits rise, until the last
// of the crew has gone down the hatches; then she flies off.
const WITCH_STORM = { from: { x: 990, y: 220, s: 1.1 }, mid: { x: 640, y: 300, s: 1.25 }, swoop: 0.8, leave: 0.9 };
// When the last reveller has dropped below (s into the turn).
function allDown(st) {
  let last = 0;
  REVELLERS.forEach((_, i) => {
    const spot = SPOTS[st.party.spots?.[i] ?? (FILM ? i : i + 2)], h = HATCHES[spot.x < 640 ? 0 : 1];
    const hops = Math.max(1, Math.ceil(Math.hypot(h.x - spot.x, h.y - spot.y) / FLEE.hopLen));
    last = Math.max(last, FLEE.from + i * FLEE.stagger + hops * FLEE.hop + FLEE.dive);
  });
  return last;
}
function witchInStorm(k, st, pt, t) {
  const c = k.c, W = WITCH_STORM, gone = allDown(st) + 0.45;   // a beat over the empty deck
  let x, y, s, a = 1;
  if (pt < W.swoop) {
    // a swoop: down and across, dipping below the line between
    const u = easeInOut(pt / W.swoop);
    x = W.from.x + (W.mid.x - W.from.x) * u; y = W.from.y + (W.mid.y - W.from.y) * u + Math.sin(Math.PI * u) * 70; s = W.from.s + (W.mid.s - W.from.s) * u;
  } else if (pt < gone) {
    x = W.mid.x + Math.sin(t * 1.3) * 18; y = W.mid.y + Math.sin(t * 2.1) * 10; s = W.mid.s;
  } else {
    const u = easeInOut(clamp((pt - gone) / W.leave, 0, 1));
    x = W.mid.x + u * 760; y = W.mid.y - u * 420; s = W.mid.s * (1 - 0.3 * u); a = 1 - u * u;
  }
  if (a <= 0) return;
  c.save(); c.globalAlpha = a;
  if (!k.asset('witch-storm', x, y, 260 * s, 170 * s)) { c.fillStyle = k.col('#2a2430'); k.cloud?.(x, y - 40, 1.2 * s); }
  c.restore();
}
function whiteout(k, pt) {
  // The sky bleaches white, as in the video around 1:00.
  k.wash('#f4f1ea', 0.75 * easeInOut(pt / 1.3) * (1 - easeInOut((pt - 3.0) / 1.4)));
}

function spirits(k, pt, t) {
  const c = k.c;
  for (let i = 0; i < 4; i++) {
    const rise = easeOut((pt - 0.3 - i * 0.2) / 1.6);
    if (rise <= 0) continue;
    const x = 260 + i * 250 + Math.sin(t * 0.9 + i) * 20, y = 760 - rise * 360;
    c.save(); c.globalAlpha = 0.55 * (1 - easeInOut((pt - 3.2) / 1.2));
    if (!k.idle('sea-spirit', t + i * 0.3, x, y, 150, 300, 0.55)) {
      c.fillStyle = k.col('#ffffff');
      c.beginPath(); c.moveTo(x - 40, y); c.quadraticCurveTo(x - 50, y - 160, x, y - 230); c.quadraticCurveTo(x + 50, y - 160, x + 40, y);
      c.quadraticCurveTo(x, y - 30, x - 40, y); c.fill();
      c.beginPath(); c.moveTo(x - 30, y - 170); c.lineTo(x - 70, y - 250); c.lineTo(x - 22, y - 190); c.fill();
      c.beginPath(); c.moveTo(x + 30, y - 170); c.lineTo(x + 70, y - 250); c.lineTo(x + 22, y - 190); c.fill();
    }
    c.restore();
  }
}

// ---------------------------------------------------------------- the wreck
function wreck(k, st, pt, t) {
  const c = k.c, b = st.board;
  // The waterspout stands behind the ship, which is lifted and broken in front of it.
  k.voyage(b, { hideShip: true, beforeWave: (r) => { if (r === 1) { waterspout(k, pt, t); shipWreck(k, st, pt, t); } } });
}

function waterspout(k, pt, t) {
  const c = k.c;
  const rise = easeOut(pt / 0.9) * (1 - easeInOut((pt - 3.2) / 1.0));
  if (rise > 0 && !k.asset('waterspout', 560, 560, 300 * rise, 550 * rise)) {
    // A twisting column of water, narrow at the sea and flaring into cloud.
    const H = 520 * rise, pts = 24, edge = (side, i) => {
      const f = i / pts, y = 560 - f * H;
      const w = (18 + f * f * 120) * rise, sway = Math.sin(t * 4 + f * 6) * 22 * rise * f;
      return [560 + sway + side * w, y];
    };
    c.fillStyle = k.col('#5f8c88'); c.globalAlpha = 0.8;
    c.beginPath();
    for (let i = 0; i <= pts; i++) c.lineTo(...edge(-1, i));
    for (let i = pts; i >= 0; i--) c.lineTo(...edge(1, i));
    c.fill();
    c.strokeStyle = k.col('#eef3ea'); c.lineWidth = 3;
    for (let j = 0; j < 6; j++) {
      c.beginPath();
      for (let i = 0; i <= pts; i++) { const [lx, y] = edge(-1, i), [rx] = edge(1, i); const f = (Math.sin(t * 5 + i * 0.5 + j) + 1) / 2; c.lineTo(lx + (rx - lx) * f, y); }
      c.stroke();
    }
    c.globalAlpha = 1;
  }
}

function shipWreck(k, st, pt, t) {
  const c = k.c, x = st.board.ship.x, y0 = 512;
  const lift = easeInOut((pt - 0.5) / 1.1) * 110 * (1 - easeInOut((pt - 2.0) / 1.2));
  const brk = easeInOut((pt - 2.0) / 1.2);  // halves part and tip
  const sink = easeInOut((pt - 2.5) / 1.8) * 200;
  for (const side of [-1, 1]) {
    c.save();
    c.translate(x + side * brk * 50, y0 - lift + sink);
    c.rotate(side * brk * 0.6 + Math.sin(t * 2.4) * 0.04);
    const half = side < 0 ? 'ship-wreck-bow' : 'ship-wreck-stern';
    // The delivered halves once requested art arrives; until then each half of
    // the ship's own art (380x400, drawn 190x200 with its waterline at +20).
    if (!(brk > 0.05 && k.asset(half, side * 75, 20, 150, 200))) {
      if (!k.assetCrop('ship', side < 0 ? 0 : 190, 0, 190, 400, side < 0 ? -95 : 0, -180, 95, 200)) {
        c.fillStyle = k.col('#6b4024'); c.fillRect(side < 0 ? -80 : 0, -30, 80, 46);
        c.fillStyle = k.col('#f1e3c8'); c.fillRect(side < 0 ? -46 : 0, -140, 46, 96);
      }
    }
    c.restore();
  }
}

// ---------------------------------------------------------------- the deep
// Who sinks before the guitar: when (s into the scene), where, how they turn.
// w is the art's width over its height.
const FALLERS = [
  { id: 'reveller-jester', x: 300, at: 0.0, spin: 1, tilt: 0.4, h: 150, w: 0.52, col: '#8a3f7a' },
  { id: 'reveller-yellow', x: 920, at: 0.35, spin: -1, tilt: -0.3, h: 150, w: 0.52, col: '#e3c13b' },
  { id: 'sailor-stand', x: 620, at: 0.6, spin: 0.7, tilt: 1.2, h: 170, w: 0.61, col: '#26304a' },
  { id: 'reveller-shaggy', x: 460, at: 0.95, spin: -0.8, tilt: 0.2, h: 150, w: 0.52, col: '#6f9a4a' },
  { id: 'reveller-lady', x: 1060, at: 1.25, spin: 1.1, tilt: -0.6, h: 150, w: 0.52, col: '#e7a6bd' },
];
const GUITAR_AT = 2.3;

function sinking(k, st, pt, t) {
  const c = k.c;
  // the delivered grotto-backcloth is a tall roll; its top third (surface
  // light, kelp, wreck timbers) fills the stage
  if (!k.assetCrop('grotto-backcloth', 0, 0, 2560, 1440, 0, 0, 1280, 720)) sinkingStandin(k, t);
  sinkingFigures(k, st, pt, t);
}

function sinkingStandin(k, t) {
  const c = k.c;
  const g = c.createLinearGradient(0, 60, 0, 720);
  g.addColorStop(0, k.col('#2f5552')); g.addColorStop(1, k.col('#0d1c22'));
  c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
  // light rays from the surface
  c.save(); c.globalAlpha = 0.18; c.fillStyle = k.col('#eef3ea');
  for (let i = 0; i < 5; i++) { const x = 250 + i * 200 + Math.sin(t * 0.4 + i) * 30; c.beginPath(); c.moveTo(x, 60); c.lineTo(x + 60, 60); c.lineTo(x + 160, 720); c.lineTo(x + 40, 720); c.fill(); }
  c.restore();
  // kelp swaying up from the floor
  c.strokeStyle = k.col('#3f6a3a'); c.lineWidth = 8; c.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const x = 170 + i * 160; c.beginPath(); c.moveTo(x, 720);
    for (let y = 700; y > 420 + (i % 3) * 60; y -= 30) c.lineTo(x + Math.sin(t * 1.3 + y * 0.02 + i) * 22, y);
    c.stroke();
  }
}

function sinkingFigures(k, st, pt, t) {
  const c = k.c;
  // first the revellers and the sailor go down through the water, limp and
  // turning slowly, trailing bubbles
  for (const f of FALLERS) {
    const k2 = (pt - f.at) / 2.6;
    if (k2 <= 0 || k2 >= 1) continue;
    const fy = -160 + k2 * 1000, fx = f.x + Math.sin(t * 0.9 + f.at * 3) * 26;
    // the film's cast fall in their own limp tumbling poses, turning slowly
    const tumble = !FILM ? null : f.id === 'sailor-stand' ? (k2 < 0.5 ? 'prince-tumble-a' : 'prince-tumble-b') : CREW_OF[f.id] && CREW_OF[f.id] + '-tumble';
    const tim = tumble && k.img(tumble);
    if (tim) {
      const std = f.id === 'sailor-stand' ? 360 : 420, ph = (tim.naturalHeight || tim.height) * f.h / std;
      drawPose(k, tumble, fx, fy + ph / 2, f.h, { std, rot: f.spin * k2 * 1.1 + f.tilt * 0.4, pivot: ph / 2 });
    } else {
      c.save(); c.translate(fx, fy); c.rotate(f.spin * k2 * 2.4 + f.tilt);
      if (!k.asset(f.id, 0, f.h / 2, f.h * f.w, f.h)) figure(k, 0, f.h / 2, f.col, 0, f.h / 160);
      c.restore();
    }
    c.fillStyle = k.col('#eef3ea');
    for (let i = 0; i < 5; i++) { const by = fy - 70 - ((t * 70 + i * 40) % 200); c.globalAlpha = 0.45; k.circle(fx + Math.sin(t * 3 + i) * 10, by, 2 + (i % 3)); }
    c.globalAlpha = 1;
  }
  // then the guitar tumbling down, as in the video at 1:05
  const gk = clamp((pt - GUITAR_AT) / (ENDING.sink + ENDING.iris - GUITAR_AT), 0, 1);
  const gy = -120 + easeOut(gk) * 520, gx = 640 + Math.sin(t * 0.8) * 30;
  c.save(); c.translate(gx, gy); c.rotate(0.6 + Math.sin(t * 0.7) * 0.25);
  if (!k.asset('guitar-sinking', 0, 130, 110, 260)) guitarStandin(k);
  c.restore();
  // bubbles
  c.fillStyle = k.col('#eef3ea');
  if (gk > 0) for (let i = 0; i < 18; i++) {
    const by = 720 - ((t * 60 + i * 97) % 700), bx = gx - 60 + ((i * 53) % 120) + Math.sin(t * 2 + i) * 8;
    c.globalAlpha = 0.5; k.circle(bx, by, 3 + (i % 4));
  }
  c.globalAlpha = 1;
}

function guitarStandin(k) {
  const c = k.c;
  c.fillStyle = k.col('#5a3a1e'); c.fillRect(-7, -140, 14, 110);
  c.fillStyle = k.col('#3a2112'); c.fillRect(-11, -158, 22, 20);
  c.fillStyle = k.col('#e8d3a0'); k.circle(0, -10, 38); k.circle(0, 50, 46);
  c.fillStyle = k.col('#2a1a12'); k.circle(0, 4, 13);
  c.strokeStyle = k.col('#cfcfcf'); c.lineWidth = 1;
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 3, -150); c.lineTo(i * 3, 80); c.stroke(); }
}
