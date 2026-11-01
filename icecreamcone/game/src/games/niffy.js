// Jackknife Niffy: Snip Snap.
//
// The Niffy hovers over the park promenade while people stroll along below,
// each with a little something that wants snipping: a long hat feather, a
// buttonhole flower, a loose thread from a coat hem, a price tag left on a
// new hat. Fly along the sky, and up and down between a high line and a low
// one; press the action to swoop. A pink ring shows what a swoop would go
// for (the nearest thing whose spot, when the blade arrives, is within
// reach: less reach while flying flat out); the swoop homes onto it, so a
// ringed thing is snipped. Swoops take longer the further down they go, so
// cruising low snips quickly. Every snip scores one (a price tag two), and
// the Niffy flies it off to its nest. A child's balloon string is not for
// snipping (−1). A swoop at nothing makes people nearby hold on to their
// things (longer if it snaps again); they relax three times as fast while
// the Niffy is up in the top quarter of its range. Now and then the Park
// Keeper looks round (a red "!", then his eye): while he looks, he notices
// only movement: a Niffy keeping still is never seen, one flying about is
// seen more the lower it is (high up, hardly at all), and a swoop is seen
// fast. His noticing fills a ring; full, and he whistles and dazes the
// Niffy (no points lost). People come in steadily, never bunched; they start
// slow and get quicker, and the Keeper looks round more often and for longer. Score: snips.

import { art, drawBird, drawSprite, scene, band, blob, poly, wash, ink, hatch, label, hint, SHEETS, PAL, INK } from '../draw.js';
import { clamp, lerp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

Object.assign(SHEETS, {
  'sprites.niffyWalkers': [3, 2], // six passers-by walking left, nothing on them to snip
  'sprites.niffyProps': [3, 2], // feather, flower, loose thread, price tag, balloon on its string, nest of snippings
  'sprites.parkKeeper': [3, 1], // back turned, glancing over his shoulder, facing front with his whistle
  'sprites.niffyDive': [2, 1], // swooping with its blade open, and snapping it shut
  'sprites.niffyFly': [3, 1], // hovering with wings up, wings down (a flap), and dazed, tumbling
});

const DURATION = 45;
const HOVER = 230; // where the Niffy starts cruising (its blade tip)
const HIGH = 150; // the highest it cruises
// the lowest: about 70 px above the highest thing anyone carries (a feather
// in the hat band of the tallest walker, size 1.05: 800 - 326 x 1.05 = 458)
const LOW = 385;
const GROUND = 800; // the walkers' feet
const AIM = 90; // a swoop goes for a thing whose blade-arrival spot is within this, across
const AIM_FAST = 35; // or only this, when the Niffy is flying along at full speed
const CLIMB = 420; // px a second the stick moves the cruising height
const RELAX_Y = HIGH + 0.25 * (LOW - HIGH); // above this (the top quarter), wary people relax 3x as fast
// The Keeper's noticing, per second while he looks:
const STILL = 40; // px/s of movement (across plus up and down) that counts as keeping still
const STILL_DRAIN = 0.15; // keeping still: it drains a little
const MOVE_RATE = 1.6; // flying about flat out at the low line (scaled by lowness squared)
const SWOOP_RATE = 1.8; // swooping, at any height (a swoop from high takes longer, so costs more)
// Swoops take longer the further they have to go: down to the thing, and back
// up to the cruising height.
const downTime = (dy) => Math.max(0.14, Math.abs(dy) / 1050);
const upTime = (dy) => Math.max(0.16, Math.abs(dy) / 900);
const SIZE = 210;
const KEEPER_X = 1420;
const GAP = 420; // the least room between two people walking the same way
const WARY = 1.8; // seconds people hold on to their things after a snap at the air nearby
const WARY_R = 240;
const DAZE = 1.6; // seconds the Niffy is dazed after the Keeper's whistle
// Where the blade's tip is, from the feet, in bird units (400 = the bird's
// size): on the painting (the open blades' point, measured on the 1024 px
// PNG at about (50, 285), feet line 0.970 of a 420-unit frame), or on the
// stand-in. The Niffy is drawn so its tip is at (g.x, g.y).
const TIP_PAINTED = [-190, -291];
const TIP_STANDIN = [-170, -230];
const KEEPER_Y = 735; // on the promenade's back edge, in front of the painted railing
const NEST = [300, 122]; // the nest, sitting on the painted branch (top left)
const PROMPTS = { feather: 1, flower: 1, thread: 1, tag: 2 };
// Where each thing hangs on a walker, above the feet (and across, facing left).
const SPOT = { feather: [38, 318], flower: [-14, 214], thread: [24, 112], tag: [-40, 278], balloon: [-36, 236] };
// Where things hang on each painted walker (sprites.niffyWalkers, cells 0-5),
// measured on the 2048 x 1536 sheet: across from the middle of the figure's
// painted outline (positive = towards its back) and up from its feet, in
// the units SPOT uses (the figure drawn 340 tall at size 1). Feather in the
// hat band at the back, price tag on the front of the brim, flower on the
// lapel, loose thread at the back of the coat's hem; the child (cell 5) holds
// up an empty fist, where the balloon string starts (hand), and is snipped a
// little above it.
const PAINTED_SPOT = [
  { feather: [60, 304], tag: [4, 297], flower: [3, 215], thread: [74, 67] }, // bowler, grey coat
  { feather: [40, 319], tag: [-61, 298], flower: [-21, 228], thread: [65, 51] }, // wide hat, pink coat
  { feather: [32, 326], tag: [-48, 321], flower: [-32, 220], thread: [80, 76] }, // flat cap, mustard coat
  { feather: [28, 323], tag: [-29, 313], flower: [-19, 235], thread: [86, 72] }, // old lady, felt hat
  { feather: [46, 321], tag: [-15, 312], flower: [2, 239], thread: [53, 142] }, // trilby, red jacket
  { balloon: [-87, 370], hand: [-87, 310] }, // the child
];
// The blade tip in each painted pose cell (1024 px cells, at the portrait's scale).
const POSE_TIP = { 'sprites.niffyFly': [[33, 282], [55, 299], [99, 250]], 'sprites.niffyDive': [[58, 381], [37, 445]] };
const COATS = [PAL.slate, PAL.olive, PAL.mauve, PAL.brick, PAL.mustard, '#5a6a7a', PAL.sage];
const ITEM_COLS = { feather: PAL.magenta, flower: PAL.strawberry, thread: PAL.lemon, tag: '#fbf8ee', balloon: '#d04a3a' };

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    x: W / 2,
    y: HOVER,
    face: -1, // which way the Niffy looks: -1 left, 1 right
    state: 'hover', // hover | down | up | dazed
    st: 0,
    dive: null, // { x0, y0, x1, depth, dur, up, target }
    cruise: HOVER, // the height the Niffy cruises at, HIGH..LOW
    aimRef: W / 2, // where a press now would swoop for (the Niffy, or the pointer)
    speed: 0, // how fast the Niffy is flying along, smoothed
    motion: 0, // how much it is moving, across and up or down, smoothed
    notice: 0, // the Keeper's noticing, 0..1: full, and he whistles
    walkers: [],
    flying: [], // snipped things on their way to the nest
    balloons: [], // let go, floating away
    pops: [],
    nest: 0,
    keeper: { state: 'away', t: 8.5, look: 0 }, // away | turning | watch
    spawnT: 0.4,
    snips: 0,
    caught: 0,
    popped: 0,
    whistle: 0,
  };

  const progress = () => Math.min(1, g.elapsed / DURATION);
  // How hard it is now, 0 to 1, along the shared curve for the chosen
  // Difficulty (see difficulty.js): slow strollers, few balloons and a Keeper
  // who seldom looks round at first. Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(progress());
  g.walkSpeed = () => knob(g.d(), 80, 108, 175); // px/s
  g.walkerGap = () => knob(g.d(), 1.75, 1.47, 0.82); // seconds between strollers
  g.balloonChance = () => knob(g.d(), 0.12, 0.19, 0.34);
  g.pairChance = () => knob(g.d(), 0, 0, 0.32); // two things on one stroller
  g.keeperAway = () => knob(g.d(), 4.8, 4.0, 2.0); // seconds with his back turned
  g.keeperWatch = () => knob(g.d(), 1.2, 1.6, 2.6); // seconds he looks round
  g.keeperTurn = () => knob(g.d(), 1.0, 0.85, 0.45); // seconds of warning before he looks
  const add = (n) => {
    g.score = Math.max(0, g.score + n);
  };
  function pop(text, x, y, color = INK, size = 40) {
    // Stack above a pop still showing nearby rather than on top of it.
    while (g.pops.some((p) => p.life > 0.5 && Math.abs(p.x - x) < 160 && Math.abs(p.y - y) < size)) y -= size;
    g.pops.push({ text, x, y, color, size, life: 1.2 });
  }
  g.HIGH = HIGH;
  g.LOW = LOW;
  g.downTime = downTime;
  // Is the Keeper looking (or about to)?
  g.watching = () => g.keeper.state === 'watch';

  // A side people can come in from: the last one in that way has walked on
  // far enough that they won't bunch up (so no more than two ever overlap).
  const clear = (dir) => !g.walkers.some((w) => Math.sign(w.vx) === dir && (dir > 0 ? w.x < GAP - 120 : w.x > W + 120 - GAP));
  function spawn() {
    let dir = rng() < 0.5 ? -1 : 1;
    if (!clear(dir)) dir = -dir;
    if (!clear(dir)) return false;
    const kid = g.elapsed > 10 && rng() < g.balloonChance();
    const kinds = ['feather', 'flower', 'thread', 'feather', 'flower', 'thread', 'tag'];
    const items = [];
    if (kid) items.push({ kind: 'balloon' });
    else {
      items.push({ kind: kinds[Math.floor(rng() * kinds.length)] });
      if (rng() < g.pairChance()) {
        const k2 = kinds[Math.floor(rng() * kinds.length)];
        if (k2 !== items[0].kind) items.push({ kind: k2 });
      }
    }
    const v = g.walkSpeed() * (0.95 + rng() * 0.1);
    g.walkers.push({
      x: dir > 0 ? -120 : W + 120,
      vx: dir * v,
      kid,
      size: kid ? 0.62 : 0.9 + rng() * 0.15,
      coat: COATS[Math.floor(rng() * COATS.length)],
      cell: Math.floor(rng() * (kid ? 1 : 5)) + (kid ? 5 : 0),
      phase: rng() * 6,
      huh: 0,
      wary: 0,
      items: items.map((it) => ({ ...it, snipped: false })),
    });
    return true;
  }

  // Where a walker's thing is now.
  g.spot = (w, it) => {
    const [ax, ay] = (art('sprites.niffyWalkers') && PAINTED_SPOT[w.cell]?.[it.kind]) || SPOT[it.kind];
    const f = w.vx < 0 ? 1 : -1; // drawn facing left; mirrored walking right
    return [w.x + ax * f * w.size, GROUND - ay * w.size];
  };
  // Everything that can be snipped (or shouldn't be), with where it is.
  g.targets = () => {
    const out = [];
    for (const w of g.walkers) for (const it of w.items) if (!it.snipped && !(w.wary > 0)) {
      const [x, y] = g.spot(w, it);
      out.push({ w, it, x, y, vx: w.vx });
    }
    return out;
  };

  // What a swoop aimed at x would go for: the nearest thing whose spot,
  // when the blade gets down to it from where the Niffy is, is within AIM
  // across (or null). The swoop then homes onto that thing, so if the ring
  // shows it, a swoop snips it.
  g.aim = (x1 = g.aimRef) => {
    let hit = null;
    let best = g.aimWindow();
    for (const o of g.targets()) {
      const dur = downTime(o.y - g.y);
      const px = o.x + o.vx * dur;
      const d = Math.abs(px - x1);
      if (d < best) {
        best = d;
        hit = { ...o, px, dur };
      }
    }
    return hit;
  };
  // A Niffy lined up and hovering takes good aim; one flying flat out, less.
  g.aimWindow = () => lerp(AIM, AIM_FAST, clamp(g.speed / 820, 0, 1));
  const refFor = (input) => (input.pointer.active ? clamp(input.pointer.x, g.x - 300, g.x + 300) : g.x);

  function startDive(input) {
    const x0 = g.x;
    const ref = refFor(input);
    const aim = g.aim(ref);
    if (aim) {
      g.dive = { x0, y0: g.y, x1: aim.px, depth: aim.y, dur: aim.dur, target: { w: aim.w, it: aim.it } };
    } else {
      const depth = Math.max(590, g.y + 120);
      g.dive = { x0, y0: g.y, x1: ref, depth, dur: downTime(depth - g.y), target: null };
    }
    g.state = 'down';
    g.st = 0;
    if (Math.abs(g.dive.x1 - x0) > 4) g.face = g.dive.x1 < x0 ? -1 : 1;
    sfx('wind');
  }

  // A snap at the air makes the people close by hold on to their things.
  function startle() {
    let holding = false;
    for (const w of g.walkers) {
      if (Math.abs(w.x - g.x) < WARY_R) {
        if (w.wary > 0 && w.items.some((it) => !it.snipped)) holding = true;
        w.wary = Math.min(2 * WARY, (w.wary || 0) + WARY); // snap again, and they hold on longer
        w.huh = 1;
      }
    }
    return holding;
  }

  function snip() {
    const tg = g.dive.target;
    const hit = tg && !tg.it.snipped && !(tg.w.wary > 0) ? { ...tg, x: g.x, y: g.y } : null;
    sfx('shutter');
    if (!hit) {
      const holding = startle() || (tg && tg.w.wary > 0);
      if (holding) pop('They’re holding on!', g.x, g.y - 40, PAL.brick, 34);
      else pop('Snap!', g.x, g.y + 40, PAL.grey, 30);
      return;
    }
    hit.it.snipped = true;
    hit.w.huh = 1;
    if (hit.it.kind === 'balloon') {
      g.popped++;
      add(-1);
      g.balloons.push({ x: hit.x, y: hit.y - 70 * hit.w.size, vy: -60, sway: rng() * 6 });
      pop('Oh no, my balloon!  −1', hit.x, hit.y - 160, PAL.brick, 38);
      sfx('wrong');
      env.vibrate?.(100);
      return;
    }
    const pts = PROMPTS[hit.it.kind];
    g.snips++;
    add(pts);
    g.flying.push({ kind: hit.it.kind, x: hit.x, y: hit.y, t: 0, x0: hit.x, y0: hit.y });
    pop(pts > 1 ? `Snip! +${pts}` : 'Snip!', hit.x, hit.y - 60, PAL.magenta, 44);
    sfx('catch', { pitch: pts > 1 ? 7 : 2 });
    env.vibrate?.(25);
  }

  function caught() {
    g.caught++; // no points lost: the daze is the cost
    g.state = 'dazed';
    g.st = 0;
    g.whistle = 1.2;
    g.notice = 0.6; // it drains away while the Niffy is dazed
    pop('Peep! Caught!', g.x, g.y - 70, PAL.brick, 44);
    sfx('honk');
    env.vibrate?.(150);
  }

  function updateKeeper(dt) {
    const k = g.keeper;
    k.t -= dt;
    if (k.t > 0) return;
    if (k.state === 'away') {
      k.state = 'turning';
      k.t = g.keeperTurn();
      sfx('tick');
    } else if (k.state === 'turning') {
      k.state = 'watch';
      k.t = g.keeperWatch() * (0.8 + rng() * 0.4);
    } else {
      k.state = 'away';
      k.t = g.keeperAway() * (0.75 + rng() * 0.5);
    }
  }

  g.update = (dt, input) => {
    if (g.done) return;
    g.elapsed += dt;
    g.time = Math.max(0, DURATION - g.elapsed);
    if (g.time <= 0 && (g.state === 'hover' || g.state === 'dazed')) {
      g.done = true;
      return;
    }

    // People strolling by.
    g.spawnT -= dt;
    if (g.spawnT <= 0 && g.time > 1.5) {
      g.spawnT = spawn() ? g.walkerGap() * (0.85 + rng() * 0.3) : 0.2;
    }
    for (const w of g.walkers) {
      w.x += w.vx * dt;
      w.phase += dt * Math.abs(w.vx) / 22;
      w.huh = Math.max(0, w.huh - dt);
      // people relax 3x as fast while the Niffy is up in the top part of the sky
      w.wary = Math.max(0, w.wary - dt * (g.y <= RELAX_Y ? 3 : 1));
    }
    g.walkers = g.walkers.filter((w) => w.x > -200 && w.x < W + 200);

    updateKeeper(dt);
    g.whistle = Math.max(0, g.whistle - dt);

    // The Niffy.
    g.st += dt;
    let moving = false;
    if (g.state === 'hover') {
      const was = g.x;
      const wasC = g.cruise;
      if (input.pointer.active) {
        g.x = approach(g.x, input.pointer.x, 9, dt);
        g.cruise = clamp(approach(g.cruise, input.pointer.y, 6, dt), HIGH, LOW);
      } else {
        g.x += input.x * 820 * dt;
        g.cruise = clamp(g.cruise + input.y * CLIMB * dt, HIGH, LOW);
      }
      g.x = clamp(g.x, 80, W - 80);
      const vx = Math.abs(g.x - was) / Math.max(dt, 1e-6);
      g.speed = approach(g.speed, vx, 12, dt);
      // how much it is moving, across and up or down (the hovering bob doesn't count)
      g.motion = approach(g.motion, vx + Math.abs(g.cruise - wasC) / Math.max(dt, 1e-6), 15, dt);
      moving = g.motion > STILL;
      if (Math.abs(g.x - was) > 0.6) g.face = g.x < was ? -1 : 1;
      g.y = approach(g.y, g.cruise + Math.sin(g.elapsed * 3) * 8, 7, dt);
      g.aimRef = refFor(input);
      if (input.actionPressed && g.time > 0) startDive(input);
    } else if (g.state === 'down') {
      const d = g.dive;
      const k = Math.min(1, g.st / d.dur);
      // home onto the thing as it walks along, arriving exactly on it
      let tx = d.x1;
      let ty = d.depth;
      if (d.target && !d.target.it.snipped) [tx, ty] = g.spot(d.target.w, d.target.it);
      g.x = lerp(d.x0, tx, Math.sin((k * Math.PI) / 2));
      g.y = lerp(d.y0, ty, k * k);
      if (k >= 1) {
        d.depth = g.y;
        d.up = upTime(g.y - g.cruise);
        snip();
        g.state = 'up';
        g.st = 0;
      }
    } else if (g.state === 'up') {
      const k = Math.min(1, g.st / g.dive.up);
      g.y = lerp(g.dive.depth, g.cruise, 1 - (1 - k) * (1 - k));
      if (k >= 1) {
        g.state = 'hover';
        g.dive = null;
      }
    } else if (g.state === 'dazed') {
      g.y = approach(g.y, Math.max(HIGH, g.cruise - 40), 5, dt);
      if (g.st > DAZE) g.state = 'hover';
    }
    // The Keeper's noticing comes only from movement: while he looks, a
    // Niffy keeping still is never noticed, at any height; one flying about
    // is noticed more the lower it is (high up, hardly at all); a swoop is
    // noticed fast. It drains while he looks away, and slowly while the
    // Niffy keeps still under his eye. Full: he whistles.
    if (g.watching() && g.state !== 'dazed') {
      let rate = -STILL_DRAIN;
      if (g.state === 'down' || g.state === 'up') rate = SWOOP_RATE;
      else if (moving) {
        const low = clamp((g.y - HIGH) / (LOW - HIGH), 0, 1);
        rate = MOVE_RATE * low * low * Math.min(1, g.motion / 400);
      }
      g.notice = clamp(g.notice + rate * dt, 0, 1);
      if (g.notice >= 1) caught();
    } else {
      g.notice = Math.max(0, g.notice - (g.keeper.state === 'turning' ? 0.25 : 0.5) * dt);
    }

    for (const f of g.flying) {
      f.t += dt / 0.9;
      const k = Math.min(1, f.t);
      f.x = lerp(f.x0, NEST[0], k);
      f.y = lerp(f.y0, NEST[1] - 10, k) - Math.sin(k * Math.PI) * 140;
      if (k >= 1) {
        f.dead = true;
        g.nest++;
      }
    }
    g.flying = g.flying.filter((f) => !f.dead);
    for (const b of g.balloons) {
      b.vy -= 20 * dt;
      b.y += b.vy * dt;
      b.sway += dt;
    }
    g.balloons = g.balloons.filter((b) => b.y > -100);
    for (const q of g.pops) {
      q.life -= dt;
      q.y -= 40 * dt;
    }
    g.pops = g.pops.filter((q) => q.life > 0);
  };

  g.hud = () => `Snips ${g.score}`;
  g.summary = () => {
    const lines = [`${g.snips} snip${g.snips === 1 ? '' : 's'} for the nest.`];
    const woes = [];
    if (g.caught) woes.push(`caught ${g.caught} time${g.caught === 1 ? '' : 's'} by the Keeper`);
    if (g.popped) woes.push(`${g.popped} balloon${g.popped === 1 ? '' : 's'} let go`);
    lines.push(woes.length ? `Oops: ${woes.join(', ')}.` : 'Never once seen, and every balloon still on its string!');
    return lines;
  };

  // ---------- drawing ----------

  function standinScene(c) {
    band(c, 0, 0, W, 470, PAL.sky, 0.55, 1);
    // trees along the back of the park
    for (let i = 0; i < 9; i++) {
      const tx = 60 + i * 190 + ((i * 47) % 50);
      c.beginPath();
      c.moveTo(tx, 560);
      c.lineTo(tx + 6, 420);
      ink(c, 10, '#6a5040');
      blob(c, tx, 380, 95, 80, i + 1, 0.12);
      wash(c, i % 2 ? PAL.sage : PAL.olive, 0.7);
      ink(c, 1.6);
    }
    // the pond behind the railings, the gravel, the railings
    band(c, 0, 520, W, 80, '#9fbfc8', 0.6, 4);
    band(c, 0, 590, W, 110, '#d9cfb0', 0.75, 5);
    c.beginPath();
    for (let x = 20; x < W; x += 34) {
      c.moveTo(x, 700);
      c.lineTo(x, 640);
    }
    c.moveTo(0, 650);
    c.lineTo(W, 650);
    c.moveTo(0, 690);
    c.lineTo(W, 690);
    ink(c, 2.2, '#3a3a34');
    // the promenade the people walk along
    band(c, 0, 700, W, H - 700, '#cfc4a8', 0.85, 6);
    c.save();
    c.globalAlpha = 0.25;
    for (let x = 0; x < W; x += 120) {
      c.beginPath();
      c.moveTo(x, 720);
      c.lineTo(x - 60, H);
      ink(c, 1.2);
    }
    c.restore();
    // the Niffy's nest, in the corner of a branch
    c.beginPath();
    c.moveTo(0, 165);
    c.quadraticCurveTo(200, 140, 420, 110);
    ink(c, 12, '#6a5040');
  }

  function drawItem(c, kind, x, y, s, t, hangFrom = null) {
    const cell = { feather: 0, flower: 1, thread: 2, tag: 3, balloon: 4 }[kind];
    if (kind === 'balloon') {
      // the string, from the child's hand up to the balloon
      const bx = x + Math.sin(t * 1.5) * 6;
      const by = y - 120 * s;
      c.beginPath();
      c.moveTo(hangFrom ? hangFrom[0] : x, hangFrom ? hangFrom[1] : y + 40 * s);
      c.quadraticCurveTo(x + 8, y - 40 * s, bx, by + 34 * s);
      ink(c, 1.4);
      if (!drawSprite(c, 'sprites.niffyProps', cell, bx, by, { h: 90 * s, anchor: 'center' })) {
        blob(c, bx, by, 32 * s, 38 * s, 3, 0.03);
        wash(c, ITEM_COLS.balloon);
        ink(c, 2);
        c.beginPath();
        c.arc(bx - 10 * s, by - 14 * s, 6 * s, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,240,230,0.7)';
        c.fill();
      }
      return;
    }
    if (drawSprite(c, 'sprites.niffyProps', cell, x, y, { h: 56 * s, anchor: 'center' })) return;
    if (kind === 'feather') {
      // a long hat feather: a curved vane on a quill
      c.save();
      c.translate(x, y + 20 * s);
      c.rotate(0.35 + Math.sin(t * 2) * 0.06);
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(-16 * s, -30 * s, -4 * s, -70 * s);
      c.quadraticCurveTo(14 * s, -34 * s, 0, 0);
      wash(c, ITEM_COLS.feather);
      ink(c, 1.4);
      c.beginPath();
      c.moveTo(0, 6 * s);
      c.quadraticCurveTo(-3 * s, -30 * s, -4 * s, -68 * s);
      ink(c, 1.2);
      c.restore();
    } else if (kind === 'flower') {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + t * 0.2;
        blob(c, x + Math.cos(a) * 10 * s, y + Math.sin(a) * 10 * s, 9 * s, 7 * s, i, 0.1, 10);
        wash(c, ITEM_COLS.flower);
        ink(c, 1);
      }
      c.beginPath();
      c.arc(x, y, 6 * s, 0, Math.PI * 2);
      c.fillStyle = PAL.lemon;
      c.fill();
      ink(c, 1);
    } else if (kind === 'thread') {
      c.beginPath();
      c.moveTo(x, y - 18 * s);
      for (let i = 1; i <= 6; i++) c.lineTo(x + Math.sin(t * 6 + i) * 5 * s, y - 18 * s + i * 8 * s);
      ink(c, 3.4, '#b8902a');
      c.beginPath();
      c.arc(x + Math.sin(t * 6 + 6) * 5 * s, y + 32 * s, 5 * s, 0, Math.PI * 2);
      ink(c, 2, '#b8902a');
    } else if (kind === 'tag') {
      c.beginPath();
      c.moveTo(x + 10 * s, y - 26 * s);
      c.lineTo(x, y - 10 * s);
      ink(c, 1.2);
      poly(c, [[x - 18 * s, y - 10 * s], [x + 18 * s, y - 10 * s], [x + 18 * s, y + 18 * s], [x - 18 * s, y + 18 * s]], 5, 0.5);
      wash(c, ITEM_COLS.tag);
      ink(c, 1.6);
      c.beginPath();
      c.moveTo(x - 10 * s, y + 4 * s);
      c.lineTo(x + 10 * s, y + 4 * s);
      ink(c, 1.4, PAL.brick);
    }
  }

  function drawWalker(c, w, t) {
    const f = w.vx < 0 ? 1 : -1;
    const s = w.size;
    const step = Math.sin(w.phase);
    const bob = Math.abs(Math.cos(w.phase)) * 4 * s;
    c.save();
    c.translate(w.x, GROUND - bob);
    if (!drawSprite(c, 'sprites.niffyWalkers', w.cell, 0, 0, { h: 340 * s, flip: f < 0 })) {
      c.scale(f * s, s);
      // legs
      for (const k of [-1, 1]) {
        c.beginPath();
        c.moveTo(k * 12, -120);
        c.lineTo(k * 12 + step * k * 22, 0);
        ink(c, 9, '#4a4038');
      }
      // coat
      poly(c, [[-40, -100], [40, -100], [28, -250], [-28, -250]], w.cell + 1, 1.2);
      wash(c, w.coat);
      ink(c, 2.2);
      poly(c, [[-40, -100], [40, -100], [28, -250], [-28, -250]], w.cell + 1, 1.2);
      hatch(c, -42, -252, 42, -98, 10, 0.18, 1);
      // arm
      c.beginPath();
      c.moveTo(-6, -235);
      c.lineTo(-10 - step * 16, -150);
      ink(c, 10, w.coat);
      ink(c, 1.4);
      // head and hat
      blob(c, 0, -282, 26, 30, w.cell + 3, 0.05);
      wash(c, '#f0d8bc');
      ink(c, 2);
      eye(c, -14, -288, 3);
      if (!w.kid) {
        poly(c, [[-44, -300], [44, -300], [40, -308], [-40, -308]], w.cell + 4, 0.6);
        wash(c, '#3a3430');
        ink(c, 1.6);
        poly(c, [[-26, -306], [26, -306], [22, -344], [-22, -344]], w.cell + 5, 0.8);
        wash(c, w.cell % 2 ? '#3a3430' : PAL.mauve);
        ink(c, 1.6);
      } else {
        blob(c, 0, -306, 26, 12, 7, 0.08);
        wash(c, PAL.lemon);
        ink(c, 1.6);
      }
    }
    c.restore();
    // what they carry (drawn in the world, so the blade lines up)
    for (const it of w.items) {
      if (it.snipped) continue;
      const [x, y] = g.spot(w, it);
      if (it.kind === 'balloon') {
        const hand = art('sprites.niffyWalkers') && PAINTED_SPOT[w.cell]?.hand;
        const from = hand ? [w.x + hand[0] * f * s, GROUND - hand[1] * s] : [w.x - 24 * f * s, GROUND - 160 * s];
        drawItem(c, 'balloon', x, y, s * 1.4, t + w.phase, from);
      }
      else drawItem(c, it.kind, x, y, s, t + w.phase);
      if (w.wary > 0) {
        // holding on to it: a hand cupped over it, fingers drawn in ink
        const hx = x + 4 * s;
        const hy = y + 2 * s;
        blob(c, hx, hy, 19 * s, 14 * s, 41, 0.06);
        wash(c, '#efcfae');
        ink(c, 2);
        c.beginPath();
        for (let i = -1; i <= 1; i++) {
          c.moveTo(hx + i * 8 * s, hy - 12 * s);
          c.lineTo(hx + i * 8 * s, hy + 2 * s);
        }
        ink(c, 1.4);
      }
    }
    if (w.wary > 0) {
      // holding on: a stern little "!" over them, shrinking and fading as
      // they relax
      c.save();
      const left = Math.min(1, w.wary / WARY);
      c.globalAlpha = Math.min(1, 0.35 + left);
      const jig = env.reduceMotion ? 0 : Math.sin(t * 14 + w.phase) * 3;
      const by = GROUND - 410 * s;
      const bs = 0.55 + 0.45 * left;
      c.save();
      c.translate(w.x + jig, by);
      c.scale(bs, bs);
      blob(c, 0, 0, 24, 26, 43, 0.06);
      wash(c, '#fbf8ee');
      ink(c, 2.4);
      label(c, '!', 0, 2, { size: 40, color: PAL.brick, weight: 800 });
      c.restore();
      if (w.huh > 0) {
        c.lineWidth = 6;
        c.strokeStyle = 'rgba(250,244,228,0.9)';
        c.font = '800 30px Fraunces, Georgia, serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const hy = by - 46 - (1 - w.huh) * 20;
        c.strokeText('Hmph!', w.x, hy);
        label(c, 'Hmph!', w.x, hy, { size: 30, color: PAL.brick, weight: 800 });
      }
      c.restore();
    } else if (w.huh > 0) {
      c.save();
      c.globalAlpha = Math.min(1, w.huh * 2);
      label(c, 'Hm?', w.x, GROUND - 400 * s, { size: 34, color: INK, weight: 800 });
      c.restore();
    }
  }

  function eye(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = INK;
    c.fill();
  }

  function drawKeeper(c, t) {
    const k = g.keeper;
    const x = KEEPER_X;
    const y = KEEPER_Y;
    const cell = k.state === 'away' ? 0 : k.state === 'turning' ? 1 : 2;
    if (!drawSprite(c, 'sprites.parkKeeper', cell, x, y, { h: 340 })) {
      // a stout park keeper in a peaked cap
      poly(c, [[x - 70, y - 20], [x + 70, y - 20], [x + 56, y - 230], [x - 56, y - 230]], 21, 1.2);
      wash(c, '#4f6a4a');
      ink(c, 2.4);
      for (const lx of [-26, 26]) {
        c.beginPath();
        c.moveTo(x + lx, y - 30);
        c.lineTo(x + lx, y);
        ink(c, 14, '#3a3430');
      }
      blob(c, x, y - 266, 40, 42, 22, 0.04);
      wash(c, '#f0d8bc');
      ink(c, 2.2);
      // cap: its peak shows which way he looks
      const peak = k.state === 'away' ? 0 : k.state === 'turning' ? -1 : 0;
      poly(c, [[x - 42, y - 292], [x + 42, y - 292], [x + 36, y - 326], [x - 36, y - 326]], 23, 0.8);
      wash(c, '#2f3f30');
      ink(c, 1.8);
      if (k.state === 'away') {
        // back of his head: hair, no face
        blob(c, x, y - 262, 36, 30, 24, 0.06);
        wash(c, '#7a6a5a', 0.8);
        // he is busy with the ducks on the pond
        label(c, '♪', x + 60, y - 330 + Math.sin(t * 3) * 6, { size: 34, color: PAL.slate, weight: 700 });
      } else {
        poly(c, [[x - 46 + peak * 20, y - 292], [x + (peak < 0 ? -10 : 46), y - 292], [x + (peak < 0 ? -40 : 30), y - 280], [x - 60 + peak * 20, y - 280]], 25, 0.6);
        wash(c, '#1f2a20');
        ink(c, 1.4);
        if (k.state === 'turning') {
          eye(c, x - 26, y - 270, 4);
          label(c, '?', x + 50, y - 350, { size: 54, color: PAL.ochre, weight: 800 });
        } else {
          eye(c, x - 14, y - 272, 5);
          eye(c, x + 14, y - 272, 5);
          c.beginPath();
          c.moveTo(x - 24, y - 288);
          c.lineTo(x - 6, y - 284);
          c.moveTo(x + 24, y - 288);
          c.lineTo(x + 6, y - 284);
          ink(c, 2.4);
          // whistle at the ready
          blob(c, x + 4, y - 244, 9, 6, 26, 0.05);
          wash(c, '#c8c8c0');
          ink(c, 1.4);
        }
      }
    }
    // the same warning over him, bigger
    if (k.state !== 'away' || g.notice > 0.02) warning(c, x, y - 430, t, 1.3);
    if (g.whistle > 0) {
      c.save();
      c.globalAlpha = Math.min(1, g.whistle * 2);
      label(c, 'PEEP!', x - 90, y - 380, { size: 48, color: PAL.brick, weight: 800 });
      c.restore();
    }
  }

  // A red "!" (turning) or a wide-open red-rimmed eye (looking), at (x, y).
  // The Keeper's warning and how much he has noticed, at (x, y): a red "!"
  // as he turns, then his eye while he looks, opening wider as he notices
  // more; round it an ink arc fills with his noticing (and drains after).
  function warning(c, x, y, t, k) {
    const st = g.keeper.state;
    c.save();
    c.translate(x, y);
    c.scale(k, k);
    if (st === 'turning') {
      const pulse = 1 + 0.12 * Math.sin(t * 16);
      c.save();
      c.scale(pulse, pulse);
      c.beginPath();
      c.arc(0, 0, 30, 0, Math.PI * 2);
      c.fillStyle = '#c0403a';
      c.fill();
      ink(c, 2.4);
      label(c, '!', 0, 2, { size: 46, color: '#fbf8ee', weight: 800 });
      c.restore();
    } else if (st === 'watch') {
      // an eye: almond white, a big iris and pupil, lashes on top; wider as he notices
      const open = 0.45 + 0.75 * g.notice;
      c.beginPath();
      c.moveTo(-46, 0);
      c.quadraticCurveTo(0, -38 * open, 46, 0);
      c.quadraticCurveTo(0, 38 * open, -46, 0);
      c.fillStyle = '#fbf8ee';
      c.fill();
      ink(c, 5, '#c0403a');
      c.save();
      c.clip();
      c.beginPath();
      c.arc(0, 0, 15, 0, Math.PI * 2);
      c.fillStyle = '#5a7a9a';
      c.fill();
      c.beginPath();
      c.arc(0, 0, 7, 0, Math.PI * 2);
      c.fillStyle = INK;
      c.fill();
      c.restore();
      c.beginPath();
      for (let i = -2; i <= 2; i++) {
        c.moveTo(i * 16, (-18 + Math.abs(i) * 3) * open);
        c.lineTo(i * 22, (-32 + Math.abs(i) * 4) * open - 4);
      }
      ink(c, 3, '#c0403a');
    }
    if (g.notice > 0.02 || st === 'watch') {
      // the noticing meter: a faint ink ring, filling clockwise from the top
      c.beginPath();
      c.arc(0, 0, 58, 0, Math.PI * 2);
      ink(c, 3, 'rgba(59,43,32,0.25)');
      c.beginPath();
      c.arc(0, 0, 58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.notice);
      ink(c, 8, g.notice > 0.7 ? '#c0403a' : PAL.ochre);
      ink(c, 1.4);
    }
    c.restore();
  }

  function drawNiffy(c, t) {
    const k = SIZE / 400;
    const f = g.face;
    let rot = 0;
    if (g.state === 'down') rot = 0.95 * Math.min(1, g.st / 0.1);
    else if (g.state === 'up') rot = 0.95 * (1 - Math.min(1, g.st / g.dive.up)) - 0.2;
    else if (g.state === 'dazed') rot = Math.sin(g.st * 20) * 0.3;
    else rot = Math.sin(t * 4) * 0.05;
    c.save();
    c.translate(g.x, g.y);
    c.rotate(-rot * -f); // nose down towards the snip
    // swooping: the dive sheet; hovering: a two-frame flap; dazed: tumbling
    const sheet = g.state === 'down' || g.state === 'up' ? 'sprites.niffyDive' : 'sprites.niffyFly';
    const cell = g.state === 'down' ? 0 : g.state === 'up' ? 1 : g.state === 'dazed' ? 2 : Math.floor(t * 8) % 2;
    const tip = art('subject.niffy') ? TIP_PAINTED : TIP_STANDIN;
    const fx = tip[0] * k * f; // the feet, from the tip
    const fy = -tip[1] * k;
    // the painted poses: each whole cell at the portrait's scale, placed by
    // its own measured blade tip so the tip stays on the snip point
    const pk = (SIZE * 1.05) / 1024;
    const [tx, ty] = POSE_TIP[sheet][cell];
    if (!drawSprite(c, sheet, cell, (512 - tx) * pk * -f, (512 - ty) * pk, { h: 1024 * pk, whole: true, anchor: 'center', flip: f > 0 })) {
      // the blade tip is at (x, y); the bird is drawn from its feet
      drawBird(c, 'niffy', { x: fx, y: fy, size: SIZE, t, flip: f > 0 });
    }
    c.restore();
    // The Keeper's warning, right beside the Niffy (he may be off a narrow
    // screen): a red "!" as he turns, then a red eye while he looks.
    // (below it when it flies up near the top, clear of the clock)
    if (g.keeper.state !== 'away' || g.notice > 0.02) warning(c, g.x + 100 * -g.face, g.y < 260 ? g.y + 110 : g.y - 60, t, 1);
    if (g.state === 'dazed') {
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + (i * Math.PI * 2) / 3;
        label(c, '✦', g.x + Math.cos(a) * 50, g.y - 90 + Math.sin(a) * 14, { size: 24, color: PAL.ochre, weight: 700 });
      }
    }
  }

  g.draw = (c, t) => {
    scene(c, 'niffy', W, H, standinScene);
    // the sky reddens a little while the Keeper looks round
    if (g.keeper.state !== 'away') {
      c.save();
      const a = g.keeper.state === 'watch' ? 0.16 : 0.06 + 0.04 * Math.sin(t * 16);
      const grd = c.createLinearGradient(0, 0, 0, 700);
      grd.addColorStop(0, `rgba(200,70,60,${a})`);
      grd.addColorStop(1, 'rgba(200,70,60,0)');
      c.fillStyle = grd;
      c.fillRect(0, 0, W, 700);
      c.restore();
    }

    // the nest and its snippings
    if (!drawSprite(c, 'sprites.niffyProps', 5, NEST[0], NEST[1] + 18, { h: 90 })) {
      blob(c, NEST[0], NEST[1], 70, 26, 31, 0.12);
      wash(c, '#a07a4a');
      ink(c, 2);
      blob(c, NEST[0], NEST[1], 70, 26, 31, 0.12);
      hatch(c, NEST[0] - 80, NEST[1] - 32, NEST[0] + 80, NEST[1] + 28, 7, 0.4, -1);
    }
    for (let i = 0; i < Math.min(g.nest, 12); i++) {
      const kinds = ['feather', 'flower', 'thread', 'tag'];
      drawItem(c, kinds[i % 4], NEST[0] - 40 + ((i * 29) % 90), NEST[1] - 20 - Math.floor(i / 4) * 10, 0.6, 0);
    }

    drawKeeper(c, t);

    // the Niffy's shadow on the promenade, to judge the swoop
    c.save();
    c.globalAlpha = 0.16 + (g.state === 'hover' ? 0 : 0.1);
    c.beginPath();
    c.ellipse(g.state === 'down' ? g.dive.x1 : g.x, GROUND + 18, 44, 10, 0, 0, Math.PI * 2);
    c.fillStyle = INK;
    c.fill();
    c.restore();

    const ws = [...g.walkers].sort((a, b) => a.size - b.size);
    for (const w of ws) drawWalker(c, w, t);

    // while hovering, ring the thing a swoop from here would go for
    if (g.state === 'hover') {
      const o = g.aim();
      if (o) {
        c.save();
        c.globalAlpha = 0.75 + 0.25 * Math.sin(t * 8);
        c.beginPath();
        c.arc(o.x, o.y, 34, 0, Math.PI * 2);
        ink(c, 4, o.it.kind === 'balloon' ? '#c0403a' : PAL.magenta);
        c.restore();
      }
    }

    for (const b of g.balloons) drawItem(c, 'balloon', b.x + Math.sin(b.sway * 2) * 20, b.y + 120, 1, t, [b.x, b.y + 200]);
    for (const fl of g.flying) drawItem(c, fl.kind, fl.x, fl.y, 0.9, t);

    // a dotted line from the blade to where the swoop will reach, while hovering
    if (g.state === 'hover') {
      c.save();
      c.globalAlpha = 0.25;
      c.setLineDash([4, 12]);
      c.beginPath();
      c.moveTo(g.x, g.y + 20);
      c.lineTo(g.x, GROUND - 60);
      ink(c, 2, PAL.slate);
      c.restore();
    }

    drawNiffy(c, t);

    for (const q of g.pops) {
      c.save();
      c.globalAlpha = Math.min(1, q.life * 2);
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(250,244,228,0.9)';
      c.font = `800 ${q.size}px Fraunces, Georgia, serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeText(q.text, q.x, q.y);
      label(c, q.text, q.x, q.y, { size: q.size, color: q.color, weight: 800 });
      c.restore();
    }

    if (g.elapsed < 4) {
      c.save();
      c.globalAlpha = Math.min(1, 4 - g.elapsed);
      // Under the Niffy, clear of the clock, and whole on a phone.
      hint(c, 'Fly along, higher or lower · press to swoop · keep still when he looks', W / 2, 330, { focus: g.focus(), span: g.span, size: 36 });
      c.restore();
    }
  };

  // On a narrow screen, follow the Niffy (its little eye says when the Keeper looks).
  g.focus = () => g.x;
  g.span = 820;

  return g;
}
