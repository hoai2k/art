// Gramophone Gullfinch: Wind and Sing.
//
// A record turns on the Gullfinch's gramophone, and the notes of its song ride
// the groove round to the needle. Press the action as each note reaches the
// needle: perfect, good or miss. Each hit plays that note, so the player
// performs the tune; a missed note leaves a gap in the song.
//
// The spring runs down as the record plays. Below a third the song sags: it
// slows, goes flat, the timing windows shrink and every note scores half. Wind
// it back up by turning the stick in circles, dragging in circles on the
// record, tapping ← →, or tapping the action while no note is near the needle
// (a tap close to a note always counts as playing it).
//
// Score: 50 for a perfect, 25 for a good, plus twice the streak (up to 25).
// The game ends when the song does.

import { drawBird, scene, band, blob, wash, ink, poly, hatch, label, PAL, INK } from '../draw.js';
import { clamp, lerp } from './index.js';
import { curve, knob } from './difficulty.js';

// ---------- the song ----------

const ROOT = 523.25; // C5; semitones below are relative to it
// [semitone, beats]. A cheerful original in C: four plain phrases, then a
// livelier middle in eighths, and a last climb home.
const MELODY = [
  // A: quarter notes
  [0, 1], [4, 1], [7, 1], [4, 1], [5, 1], [9, 1], [7, 2],
  [4, 1], [7, 1], [12, 1], [7, 1], [5, 1], [4, 1], [2, 2],
  [0, 1], [4, 1], [7, 1], [4, 1], [5, 1], [9, 1], [12, 2],
  [11, 1], [9, 1], [7, 1], [5, 1], [4, 1], [2, 1], [0, 2],
  // B: eighths creep in
  [7, 0.5], [9, 0.5], [7, 0.5], [5, 0.5], [4, 1], [0, 1], [5, 0.5], [7, 0.5], [5, 0.5], [4, 0.5], [2, 2],
  [4, 0.5], [5, 0.5], [7, 0.5], [9, 0.5], [11, 1], [12, 1], [9, 0.5], [7, 0.5], [5, 0.5], [4, 0.5], [7, 2],
  // home
  [12, 1], [11, 0.5], [9, 0.5], [7, 1], [5, 0.5], [4, 0.5], [2, 1], [7, 1], [0, 2],
];
// The bass, one root every two beats (semitones from ROOT, two octaves down),
// starting with the four-beat count-in.
const BASS = [0, 7, 0, 5, 0, 5, 0, 7, 0, 5, 0, 5, 7, 7, 7, 0, 0, 0, 7, 7, 0, 7, 5, 7, 0, 5, 7, 0, 0, 0];
const LEAD = 4; // beats of count-in before the first note

// ---------- feel ----------

const PERFECT = 0.06; // seconds either side of the needle
const GOOD = 0.14;
const EARLY = 0.3; // a tap this close before a note plays it (and may be "too early")
const SAG = 0.33; // below this spring the song sags
const DRAIN = 0.025; // spring per second
const NOTE_COST = 0.012; // spring per note played
const WIND_RAD = 0.022; // spring per radian turned
const WIND_TAP = 0.03; // spring per tap between notes

// ---------- layout ----------

const CX = 930;
const CY = 490;
const RREC = 350; // record radius
const R_OUT = 308; // the groove spirals in from here...
const R_IN = 205; // ...to here as the song plays
const ARC = 150; // groove length per beat, in px
const NEEDLE_A = -0.95; // where the needle sits on the record (radians)
const PIVOT = { x: 1345, y: 185 };
const BIRD = { x: 250, y: 872, size: 580 };
const MOUTH = { x: BIRD.x + 68 * BIRD.size / 400, y: BIRD.y - 397 * BIRD.size / 400 };
const METER = { x: 1450, y: 200, w: 64, h: 440 };

const NOTE_COLS = ['#d8706a', PAL.orange, PAL.mustard, '#8fae5a', '#5f9a8a', PAL.slate, '#8a78b0', PAL.strawberry];

export default function create(env) {
  const { W, H, rng, sfx } = env;

  // Lay the song out on the beat line.
  const notes = [];
  let b = LEAD;
  MELODY.forEach(([semi, beats], i) => {
    notes.push({ i, b, semi, beats, state: 'wait', grade: '', col: NOTE_COLS[((semi % 12) + 12) % 12 % NOTE_COLS.length] });
    b += beats;
  });
  const TOTAL = b + 2;

  const g = {
    score: 0,
    done: false,
    beat: 0,
    elapsed: 0,
    spring: 1,
    streak: 0,
    best: 0,
    counts: { perfect: 0, good: 0, miss: 0 },
    notes,
    total: notes.length,
    pops: [], // { x, y, text, color, size, life }
    parts: [], // { x, y, vx, vy, life, color, r, glyph }
    rings: [], // a ring that spreads from the needle on a hit
    sing: 0, // the bird's song pulse, 0..1
    winding: 0, // how hard the crank turned lately, 0..1
    windT: 0, // crank angle for the meter's key
    wobble: 0, // record wow while sagging
    nextBass: 0,
    dragA: null,
    clicks: 0,
    lowWarned: false,
  };

  // ---------- song time ----------

  // How hard it is now, 0 (easy) .. 0.5 (medium) .. 1 (hard), along the
  // shared curve for the chosen Difficulty (see difficulty.js), by how far
  // the song has got. It speeds the tempo, narrows the timing windows and
  // runs the spring down faster. The melody itself already moves from
  // quarters to eighths. Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(clamp(g.beat / TOTAL, 0, 1));
  g.bpm = () => knob(g.d(), 72, 89, 110); // the song's tempo, beats a minute
  g.windows = () => knob(g.d(), 1.25, 1.1, 0.9); // timing windows, times their base width
  g.drain = () => knob(g.d(), 0.7, 1.1, 1.6); // the spring runs down, times its base rate
  // 1 at a good spring, down to 0.5 when it has run right down.
  const tempo = () => (g.spring >= SAG ? 1 : lerp(0.5, 1, g.spring / SAG));
  const spb = () => 60 / (g.bpm() * tempo()); // seconds per beat now
  const sag = () => 1 - (tempo() - 0.5) / 0.5; // 0 fine .. 1 fully sagged
  const winScale = () => (1 - sag() * 0.45) * g.windows();
  g.tempo = tempo;
  g.secPerBeat = spb;
  // Seconds until a note reaches the needle (negative once it has passed).
  g.until = (n) => (n.b - g.beat) * spb();

  // ---------- the groove: a spiral, constant length per beat ----------

  const radiusAt = (beat) => R_OUT - (R_OUT - R_IN) * clamp(beat / TOTAL, 0, 1);
  const K = (ARC * TOTAL) / (R_OUT - R_IN);
  const angAt = (beat) => (beat <= TOTAL ? K * Math.log(R_OUT / radiusAt(beat)) : K * Math.log(R_OUT / R_IN) + ((beat - TOTAL) * ARC) / R_IN);
  // Where a point of the groove (at song beat `nb`) is on screen right now.
  function groovePos(nb) {
    const a = NEEDLE_A - (angAt(nb) - angAt(g.beat)) + wow(nb);
    const r = radiusAt(nb);
    return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r, a, ahead: angAt(nb) - angAt(g.beat) };
  }
  // A sagging record wobbles, which makes the notes harder to read.
  const wow = (nb) => g.wobble * 0.05 * Math.sin(g.elapsed * 7 + nb * 1.3);
  const needle = () => {
    const r = radiusAt(g.beat);
    return { x: CX + Math.cos(NEEDLE_A) * r, y: CY + Math.sin(NEEDLE_A) * r };
  };

  // ---------- events ----------

  // A popping word. Pops with a `tag` replace the last one of that tag, so
  // quick hits don't pile their words on top of each other.
  function pop(text, x, y, color = INK, size = 44, tag = '') {
    if (tag) g.pops = g.pops.filter((q) => q.tag !== tag);
    g.pops.push({ x, y, text, color, size, life: 1, tag });
  }

  function freqOf(semi) {
    return ROOT * Math.pow(2, (semi - sag() * 1.6) / 12);
  }

  function judge(n, offset) {
    const k = winScale();
    const a = Math.abs(offset);
    const nd = needle();
    if (a <= GOOD * k) {
      const perfect = a <= PERFECT * k;
      n.state = 'hit';
      n.grade = perfect ? 'perfect' : 'good';
      g.counts[n.grade]++;
      g.streak++;
      g.best = Math.max(g.best, g.streak);
      const flat = g.spring < SAG;
      let pts = (perfect ? 50 : 25) + 2 * Math.min(g.streak, 25);
      if (flat) pts = Math.round(pts / 2);
      g.score += pts;
      sfx('note', { freq: freqOf(n.semi), dur: Math.min(1.1, n.beats * spb() * 0.95) });
      g.sing = 1;
      pop(perfect ? 'Perfect!' : 'Good', nd.x + 30, nd.y - 100, perfect ? '#b8862a' : INK, perfect ? 54 : 42, 'judge');
      pop(flat ? `+${pts} (flat)` : `+${pts}`, nd.x + 150, nd.y - 50, flat ? PAL.slate : INK, 30, 'pts');
      if ([10, 20, 30, 40, 50].includes(g.streak)) {
        pop(`${g.streak} in a row!`, CX, CY + RREC + 18, '#b8862a', 46);
        sfx('ding', { pitch: g.streak / 10 });
      }
      g.rings.push({ x: nd.x, y: nd.y, life: 1, col: n.col });
      const burst = perfect ? 12 : 6;
      for (let i = 0; i < burst; i++) {
        const a2 = rng() * Math.PI * 2;
        const s = 120 + rng() * 260;
        g.parts.push({ x: nd.x, y: nd.y, vx: Math.cos(a2) * s, vy: Math.sin(a2) * s - 80, life: 0.6 + rng() * 0.4, color: n.col, r: 4 + rng() * 5 });
      }
      // a sung note floats out of the horn
      g.parts.push({ x: MOUTH.x, y: MOUTH.y, vx: 40 + rng() * 60, vy: -90 - rng() * 50, life: 1.6, color: n.col, r: 14, glyph: true, a: (rng() - 0.5) * 0.6 });
    } else {
      miss(n, offset < 0 ? 'Too early' : 'Miss');
    }
    g.spring = Math.max(0, g.spring - NOTE_COST);
  }

  function miss(n, why) {
    n.state = 'miss';
    n.grade = why;
    g.counts.miss++;
    if (g.streak >= 5) pop('Streak lost', CX, CY + RREC + 18, PAL.brick, 34);
    g.streak = 0;
    const nd = needle();
    pop(why, nd.x + 30, nd.y - 100, PAL.brick, 40, 'judge');
    sfx('miss');
  }

  function wind(amount) {
    if (amount <= 0) return;
    const before = g.spring;
    g.spring = Math.min(1, g.spring + amount);
    g.winding = Math.min(1, g.winding + amount * 12);
    g.windT += amount * 40;
    // a ratchet click for each tap, and every little way round when spinning
    g.clicks += amount;
    if (before < 1 && (amount >= WIND_TAP * 0.8 || g.clicks > 0.03)) {
      g.clicks = 0;
      sfx('wind');
    }
    if (before < SAG && g.spring >= SAG) pop('Back in tune!', CX, CY + RREC + 18, '#5a7a2a', 40);
  }

  // ---------- update ----------

  g.update = (dt, input) => {
    if (g.done) return;
    g.elapsed += dt;
    g.kind = input.kind;

    // The spring runs down, and the song plays on at its speed.
    g.spring = Math.max(0, g.spring - dt * DRAIN * g.drain());
    g.beat += dt / spb();
    g.wobble = sag();

    // Bass: a soft root every two beats.
    while (g.nextBass * 2 <= g.beat && g.nextBass < BASS.length) {
      const semi = BASS[g.nextBass] - (BASS[g.nextBass] > 5 ? 12 : 0);
      sfx('note', { freq: ROOT / 4 * Math.pow(2, (semi - sag() * 1.6) / 12), dur: 0.35 });
      g.nextBass++;
    }

    // Winding: the stick's spin, circles dragged around the record, ← →.
    let turn = Math.min(0.7, Math.abs(input.spin || 0));
    const p = input.pointer;
    if (p && p.active && p.down) {
      const a = Math.atan2(p.y - CY, p.x - CX);
      if (g.dragA !== null && Math.hypot(p.x - CX, p.y - CY) > 50) {
        let d = a - g.dragA;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        turn += Math.min(0.7, Math.abs(d));
      }
      g.dragA = a;
    } else g.dragA = null;
    wind(turn * WIND_RAD);
    // (A tap on the screen also reads as a step; that's only the action here.)
    if ((input.left || input.right) && input.kind !== 'pointer') wind(WIND_TAP * 0.8);

    // The action: play the note at the needle, or wind between notes.
    const next = notes.find((n) => n.state === 'wait');
    if (input.actionPressed) {
      const off = next ? -g.until(next) : -9; // negative = early
      if (next && off >= -EARLY && off <= GOOD * winScale()) judge(next, off);
      else wind(WIND_TAP);
    }
    // Notes that slipped past the needle.
    for (const n of notes) {
      if (n.state === 'wait' && -g.until(n) > GOOD * winScale()) miss(n, 'Miss');
    }

    if (g.spring < SAG && !g.lowWarned) {
      g.lowWarned = true;
      pop('Wind me up!', CX, CY + RREC + 18, PAL.brick, 44, 'spring');
    }
    if (g.spring > SAG + 0.15) g.lowWarned = false;

    // Effects.
    g.sing = Math.max(0, g.sing - dt * 2.5);
    g.winding = Math.max(0, g.winding - dt * 2);
    for (const q of g.pops) {
      q.life -= dt * 1.1;
      q.y -= dt * 40;
    }
    g.pops = g.pops.filter((q) => q.life > 0);
    for (const q of g.parts) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (!q.glyph) q.vy += 500 * dt;
      else q.x += Math.sin(q.life * 5) * 20 * dt;
    }
    g.parts = g.parts.filter((q) => q.life > 0);
    for (const r of g.rings) r.life -= dt * 2.5;
    g.rings = g.rings.filter((r) => r.life > 0);

    if (g.beat >= TOTAL) g.done = true;
  };

  g.hud = () => (g.streak >= 3 ? `${g.score} points · streak ${g.streak}` : `${g.score} points`);
  g.summary = () => [
    `Perfect ${g.counts.perfect} · Good ${g.counts.good} · Missed ${g.counts.miss} of ${g.total} notes.`,
    `Longest streak: ${g.best}.`,
  ];

  // ---------- drawing ----------

  // A note: a round head and a flagged stem. On the dark record it gets a pale
  // outline (`line`) so it reads.
  function drawNoteGlyph(c, x, y, col, s = 1, a = -0.35, alpha = 1, line = INK) {
    c.save();
    c.globalAlpha *= alpha;
    c.translate(x, y);
    c.scale(s, s);
    c.beginPath();
    c.moveTo(14, -4);
    c.lineTo(14, -48);
    c.quadraticCurveTo(23, -38, 32, -32);
    if (line !== INK) ink(c, 6, line);
    ink(c, 3, line === INK ? INK : col);
    c.rotate(a);
    blob(c, 0, 0, 18, 13, 3, 0.05, 12);
    if (line !== INK) ink(c, 7, line);
    wash(c, col, 1);
    ink(c, 2.2);
    c.restore();
  }

  function drawBackground(c) {
    // a quiet parlour: striped wallpaper, a wainscot, the gramophone's cabinet
    band(c, 0, 0, W, 640, '#d8cfa8', 0.45, 3);
    c.save();
    c.globalAlpha = 0.16;
    for (let x = 30; x < W; x += 90) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 4, 640);
      ink(c, 10, PAL.olive);
    }
    c.globalAlpha = 0.22;
    for (let x = 75; x < W; x += 90) {
      for (let y = 60; y < 620; y += 110) {
        blob(c, x, y + ((x / 90) % 2) * 55, 7, 9, x + y, 0.1, 8);
        wash(c, PAL.mustard, 1);
      }
    }
    c.restore();
    band(c, 0, 640, W, 260, '#b89a6a', 0.55, 5);
    c.save();
    c.globalAlpha = 0.3;
    c.beginPath();
    c.moveTo(0, 646);
    c.lineTo(W, 640);
    ink(c, 2);
    for (let x = 60; x < W; x += 140) {
      c.beginPath();
      c.moveTo(x, 650);
      c.lineTo(x - 30, 900);
      ink(c, 1.2);
    }
    c.restore();
    // the cabinet top the record sits on
    poly(c, [[CX - 420, CY - 395], [CX + 420, CY - 395], [CX + 432, CY + 400], [CX - 432, CY + 400]], 11, 3);
    wash(c, '#9a8a4a');
    ink(c, 2.6);
    poly(c, [[CX - 420, CY - 395], [CX + 420, CY - 395], [CX + 432, CY + 400], [CX - 432, CY + 400]], 11, 3);
    hatch(c, CX - 440, CY - 400, CX + 440, CY + 405, 13, 0.16);
    poly(c, [[CX - 390, CY - 365], [CX + 390, CY - 365], [CX + 400, CY + 372], [CX - 400, CY + 372]], 12, 2);
    ink(c, 1.4, 'rgba(59,43,32,0.5)');
  }

  function drawRecord(c, t) {
    const rot = angAt(g.beat);
    const wy = env.reduceMotion ? 0 : Math.sin(g.elapsed * 7) * 3 * g.wobble;
    c.save();
    c.translate(CX, CY + wy);
    // shadow and the disc
    c.fillStyle = 'rgba(40,30,20,0.25)';
    c.beginPath();
    c.ellipse(10, 14, RREC, RREC, 0, 0, Math.PI * 2);
    c.fill();
    blob(c, 0, 0, RREC, RREC, 4, 0.006, 48);
    c.fillStyle = '#2a2622';
    c.fill();
    ink(c, 3);
    // grooves
    c.globalAlpha = 0.5;
    for (let r = 140; r < RREC - 8; r += 11) {
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      ink(c, 1, r % 3 ? '#4a423a' : '#5a5046');
    }
    c.globalAlpha = 1;
    // a soft gleam of lamplight on the vinyl
    c.beginPath();
    c.arc(0, 0, RREC - 30, Math.PI * 1.08, Math.PI * 1.32);
    ink(c, 14, 'rgba(240,230,200,0.08)');
    // the label, turning
    c.save();
    c.rotate(rot);
    c.beginPath();
    c.arc(0, 0, 118, 0, Math.PI * 2);
    c.fillStyle = '#c95a4a';
    c.fill();
    ink(c, 2);
    c.beginPath();
    c.arc(0, 0, 100, 0, Math.PI * 2);
    ink(c, 1.2, 'rgba(250,236,200,0.7)');
    c.restore();
    c.restore();
    // song progress around the label
    const prog = clamp((g.beat - LEAD) / (TOTAL - 2 - LEAD), 0, 1);
    c.save();
    c.beginPath();
    c.arc(CX, CY + wy, 109, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ink(c, 8, 'rgba(250,236,200,0.85)');
    c.restore();
    // the streak, or the song's name, on the label
    if (g.beat < LEAD) {
      const n = LEAD - Math.floor(g.beat);
      label(c, n > 1 ? String(n - 1) : 'Sing!', CX, CY + wy - 40, { size: n > 1 ? 70 : 52, color: '#fbf1d8', weight: 800 });
      label(c, 'get ready', CX, CY + wy + 44, { size: 24, color: '#fbf1d8', weight: 600 });
    } else if (g.streak >= 2) {
      label(c, String(g.streak), CX, CY + wy - 46, { size: 64, color: '#fbf1d8', weight: 800 });
      label(c, 'in a row', CX, CY + wy + 44, { size: 24, color: '#fbf1d8', weight: 600 });
    } else {
      label(c, 'Gullfinch', CX, CY + wy - 40, { size: 30, color: '#fbf1d8', weight: 700 });
      label(c, 'Song No. 1', CX, CY + wy + 40, { size: 22, color: '#fbf1d8', weight: 500 });
    }
    // spindle
    c.beginPath();
    c.arc(CX, CY + wy, 9, 0, Math.PI * 2);
    c.fillStyle = '#d8c890';
    c.fill();
    ink(c, 1.6);
    return wy;
  }

  function drawGroove(c, wy) {
    // the lane: the stretch of spiral the coming notes ride on
    const look = 2 * Math.PI * 0.86;
    c.save();
    c.translate(0, wy);
    c.beginPath();
    let first = true;
    for (let k = -0.6; ; k += 0.08) {
      const q = groovePos(g.beat + k);
      if (q.ahead > look) break;
      if (first) c.moveTo(q.x, q.y);
      else c.lineTo(q.x, q.y);
      first = false;
    }
    ink(c, 46, 'rgba(240,226,180,0.10)');
    c.setLineDash([3, 14]);
    ink(c, 2, 'rgba(240,226,180,0.45)');
    c.setLineDash([]);
    // the notes, from the farthest in
    const near = notes.find((n) => n.state === 'wait');
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (n.state === 'hit') continue;
      const q = groovePos(n.b);
      if (q.ahead > look) continue;
      if (n.state === 'miss' && q.ahead < -0.5) continue;
      const fadeIn = clamp((look - q.ahead) / 0.8, 0, 1);
      const alpha = n.state === 'miss' ? clamp(1 + q.ahead * 2, 0, 0.6) : fadeIn;
      const big = n === near && g.until(n) < EARLY + 0.15 ? 1.25 : 1;
      if (n.state === 'miss') drawNoteGlyph(c, q.x, q.y, '#8a8278', 1, -0.35, alpha, '#5a5248');
      else {
        // a longer note trails a short tail along the groove
        if (n.beats >= 2) {
          const e = groovePos(n.b + Math.min(n.beats, 3) * 0.5);
          c.save();
          c.globalAlpha = alpha * 0.5;
          c.beginPath();
          c.moveTo(q.x, q.y);
          c.lineTo(e.x, e.y);
          ink(c, 10, n.col);
          c.restore();
        }
        drawNoteGlyph(c, q.x, q.y, n.col, 1.15 * big, -0.35, alpha, '#f4e8c8');
      }
    }
    c.restore();
  }

  function drawArm(c, wy, t) {
    const nd = needle();
    nd.y += wy;
    const near = notes.find((n) => n.state === 'wait');
    const u = near ? g.until(near) : 9;
    const hot = u < EARLY && u > -GOOD;
    // the hit zone at the needle
    const k = winScale();
    c.save();
    c.beginPath();
    c.arc(nd.x, nd.y, 40 * (0.8 + 0.2 * k), 0, Math.PI * 2);
    c.fillStyle = hot ? 'rgba(250,226,140,0.35)' : 'rgba(250,236,200,0.12)';
    c.fill();
    ink(c, hot ? 4 : 2.4, hot ? '#f2cf6a' : 'rgba(240,226,180,0.7)');
    // the approach ring: closes on the zone as the next note arrives
    if (near && u < 0.9 && u > 0) {
      c.beginPath();
      c.arc(nd.x, nd.y, 40 + u * 110, 0, Math.PI * 2);
      ink(c, 2.5, `rgba(242,207,106,${0.9 - u})`);
    }
    c.restore();
    for (const r of g.rings) {
      c.save();
      c.globalAlpha = r.life;
      c.beginPath();
      c.arc(r.x, r.y + wy, 40 + (1 - r.life) * 80, 0, Math.PI * 2);
      ink(c, 6 * r.life + 1, r.col);
      c.restore();
    }
    // the tone arm, from its pivot to the needle
    c.save();
    c.beginPath();
    c.moveTo(PIVOT.x, PIVOT.y);
    c.quadraticCurveTo(PIVOT.x - 50, PIVOT.y + 90, nd.x + 62, nd.y - 58);
    ink(c, 15, INK);
    ink(c, 10, '#c8b060');
    // the headshell sits just past the zone, with a thin stylus down to it
    c.beginPath();
    c.moveTo(nd.x + 40, nd.y - 40);
    c.lineTo(nd.x + 4, nd.y - 4);
    ink(c, 3);
    poly(c, [[nd.x + 34, nd.y - 64], [nd.x + 82, nd.y - 64], [nd.x + 74, nd.y - 30], [nd.x + 30, nd.y - 32]], 3, 1.2);
    wash(c, '#a89040');
    ink(c, 2.2);
    c.beginPath();
    c.arc(nd.x, nd.y, 5, 0, Math.PI * 2);
    c.fillStyle = '#e8dcb0';
    c.fill();
    ink(c, 1.5);
    c.beginPath();
    c.arc(PIVOT.x, PIVOT.y, 30, 0, Math.PI * 2);
    c.fillStyle = '#7a6a3a';
    c.fill();
    ink(c, 2.4);
    c.beginPath();
    c.arc(PIVOT.x, PIVOT.y, 12, 0, Math.PI * 2);
    c.fillStyle = '#c8b060';
    c.fill();
    ink(c, 1.6);
    c.restore();
  }

  function drawMeter(c, t) {
    const { x, y, w, h } = METER;
    const low = g.spring < SAG;
    // the tube
    poly(c, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], 21, 1.5);
    wash(c, '#efe4c4');
    ink(c, 2.6);
    // the fill and the spring coil inside it
    const fh = (h - 12) * g.spring;
    const top = y + h - 6 - fh;
    c.save();
    c.beginPath();
    c.rect(x + 6, top, w - 12, fh);
    c.fillStyle = low ? '#d8806a' : g.spring < 0.55 ? PAL.mustard : '#a8b860';
    c.globalAlpha = 0.85;
    c.fill();
    c.restore();
    const coils = 12;
    c.beginPath();
    for (let i = 0; i <= coils * 12; i++) {
      const s = i / (coils * 12);
      const cy = y + h - 8 - s * fh;
      const cx = x + w / 2 + Math.sin(s * coils * Math.PI * 2) * (w / 2 - 12);
      if (i === 0) c.moveTo(cx, cy);
      else c.lineTo(cx, cy);
    }
    ink(c, 2, '#5a4a30');
    // the SAG line
    const sy = y + h - 6 - (h - 12) * SAG;
    c.save();
    c.setLineDash([6, 6]);
    c.beginPath();
    c.moveTo(x - 10, sy);
    c.lineTo(x + w + 10, sy);
    ink(c, 2, PAL.brick);
    c.restore();
    label(c, 'Spring', x + w / 2, y - 22, { size: 26, weight: 700 });
    // the winding key below, turning when wound
    const kx = x + w / 2;
    const ky = y + h + 70;
    c.save();
    c.translate(kx, ky);
    c.rotate(g.windT);
    for (const s of [-1, 1]) {
      blob(c, s * 30, 0, 26, 18, s + 40, 0.05, 12);
      wash(c, '#c8b060');
      ink(c, 2.2);
    }
    c.beginPath();
    c.arc(0, 0, 10, 0, Math.PI * 2);
    c.fillStyle = '#7a6a3a';
    c.fill();
    ink(c, 1.8);
    c.restore();
    // "wind me" telegraph while it sags
    if (low) {
      const pulse = env.reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(t * 8);
      c.save();
      c.globalAlpha = pulse;
      c.beginPath();
      c.arc(kx, ky, 62, -Math.PI * 0.9, Math.PI * 0.5);
      ink(c, 5, PAL.brick);
      const ex = kx + Math.cos(Math.PI * 0.5) * 62;
      const ey = ky + Math.sin(Math.PI * 0.5) * 62;
      poly(c, [[ex - 2, ey - 14], [ex - 22, ey + 2], [ex + 2, ey + 16]], 5, 0.5);
      c.fillStyle = PAL.brick;
      c.fill();
      c.restore();
      label(c, 'Wind!', kx, y + h + 160, { size: 36, color: PAL.brick, weight: 800 });
      const how = g.kind === 'controller' ? 'spin the stick' : g.kind === 'pointer' ? 'drag in circles' : 'tap ← → or Space';
      label(c, how, kx - 8, y + h + 196, { size: 20, color: PAL.brick, weight: 600 });
    }
  }

  g.draw = (c, t) => {
    scene(c, 'gullfinch', W, H, drawBackground);
    const wy = drawRecord(c, t);
    drawGroove(c, wy);
    drawArm(c, wy, t);
    drawMeter(c, t);

    // the Gullfinch, singing along
    drawBird(c, 'gullfinch', { x: BIRD.x, y: BIRD.y, size: BIRD.size, t, pose: { wind: tempo() * 0.6 + g.winding * 1.6, sing: g.sing } });

    for (const q of g.parts) {
      if (q.glyph) drawNoteGlyph(c, q.x, q.y, q.color, 0.9, q.a, clamp(q.life, 0, 1));
      else {
        c.save();
        c.globalAlpha = clamp(q.life * 1.5, 0, 1);
        c.beginPath();
        c.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        c.fillStyle = q.color;
        c.fill();
        ink(c, 1.2);
        c.restore();
      }
    }
    for (const q of g.pops) {
      c.save();
      c.globalAlpha = clamp(q.life * 2, 0, 1);
      const s = 1 + Math.max(0, q.life - 0.85) * 2;
      c.translate(q.x, q.y);
      c.scale(s, s);
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(250,244,228,0.9)';
      c.font = `800 ${q.size}px Fraunces, Georgia, serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeText(q.text, 0, 0);
      label(c, q.text, 0, 0, { size: q.size, color: q.color, weight: 800 });
      c.restore();
    }
    // a faint blue chill over everything while the song sags
    if (g.wobble > 0) {
      c.save();
      c.fillStyle = `rgba(80,100,140,${g.wobble * 0.12})`;
      c.fillRect(0, 0, W, H);
      c.restore();
    }
  };

  // For a narrow (portrait) screen: what the view follows, and how much of
  // the width it must keep in view.
  g.focus = () => CX;
  g.span = 900;

  return g;
}
