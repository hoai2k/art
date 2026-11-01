// Safecrossing Crow: Safe Crossing.
//
// The Crow is the traffic light at a zebra crossing. Cars drive along the
// road in two lanes, one each way; little birds flutter down onto both
// pavements to cross. Press the action to switch the light: green lets the
// cars go, red stops them at the line and lets the birds walk over. Going
// from green to red passes through a short amber. Every car or bird that
// gets across scores one. Anyone kept waiting too long gets cross (watch the
// little clocks) and leaves, which costs one; switching to green while birds
// are still on the crossing is a near miss: the cars brake hard and it costs
// three. Arrivals start slow and come faster as time goes on, along the
// shared difficulty curve (`g.d()`, see difficulty.js). Score: crossings.

import { drawBird, drawSprite, spriteCell, scene, band, blob, poly, wash, ink, hatch, label, PAL, INK } from '../draw.js';
import { clamp, lerp } from './index.js';
import { curve, knob } from './difficulty.js';

// The scale each chick cell is painted at, against the first (standing x3,
// walking x2, flying): design/source/pose-scales.json.
const CHICK_PAINTED = [1, 1.032, 0.952, 0.999, 0.966, 0.851];

const DURATION = 45;
// The road, pavements and zebra crossing as painted in the scene.
const ROAD_TOP = 445;
const ROAD_BOT = 698;
const KERB = ROAD_TOP - 70; // the back of the far pavement, where the houses stand
const MID = (ROAD_TOP + ROAD_BOT) / 2;
const CX0 = 630; // the zebra crossing, left and right edges
const CX1 = 970;
const LANE_Y = [MID - 52, ROAD_BOT - 50]; // where each lane's wheels run
const LANE_DIR = [-1, 1]; // the far lane drives left, the near lane right
const CAR_LEN = 150;
const GAP = 26;
const AMBER = 1;
// The Crow stands on the far pavement, its lantern high against the sky.
const CROW_X = 985;
const CROW_Y = ROAD_TOP - 12;
const CROW_SIZE = 405;
const BIRD_COLS = [PAL.lemon, PAL.strawberry, PAL.slate, PAL.sage, PAL.mauve, PAL.ochre, '#9aa8d8', PAL.mint];
const CAR_COLS = [PAL.slate, PAL.mustard, PAL.sage, PAL.brick, PAL.mauve, '#7a9aa0', PAL.olive];

// Lane coordinates: s runs the way the lane drives, so s = x * dir.
const zoneStart = (l) => (LANE_DIR[l] > 0 ? CX0 : -CX1);
const zoneEnd = (l) => (LANE_DIR[l] > 0 ? CX1 : -CX0);
const stopS = (l) => zoneStart(l) - 22;

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    light: 'green',
    amber: 0,
    phase: 0, // seconds since the light last changed
    cars: [], // { lane, s, v, wait, patience, committed, counted, leaving, color }
    birds: [], // { side, x, y, state, wait, patience, ... }
    pops: [],
    puffs: [],
    carT: [1.2, 2.4],
    birdT: [2.2, 3.4],
    carsAcross: 0,
    birdsAcross: 0,
    gaveUp: 0,
    nearMisses: 0,
    brake: 0, // cars braking after a near miss
    flash: 0,
  };

  const progress = () => Math.min(1, g.elapsed / DURATION);
  // How hard it is now, 0 (easy) .. 0.5 (medium) .. 1 (hard), along the
  // shared curve for the chosen Difficulty. Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(progress());
  g.carGap = () => knob(g.d(), 3.3, 2.45, 1.15); // seconds between cars, per lane
  g.birdGap = () => knob(g.d(), 4.6, 3.5, 1.95); // seconds between flocks, per side
  g.carSpeed = () => knob(g.d(), 240, 278, 335);
  g.patienceNow = () => knob(g.d(), 8.5, 6.9, 4.6); // seconds before giving up
  // birds come in little flocks, bigger later on: the chance of a second
  // bird, and of a third
  g.pairChance = () => knob(g.d(), 0.3, 0.5, 0.8);
  g.trioChance = () => knob(g.d(), 0, 0.24, 0.6);
  const patience = () => g.patienceNow() * (0.9 + rng() * 0.2);
  const add = (n) => {
    g.score = Math.max(0, g.score + n);
  };
  function pop(text, x, y, color = INK, size = 30) {
    g.pops.push({ text, x, y, color, size, life: 1.1 });
  }

  // Who is where (also used by the tests' bots).
  g.onCrossing = () => g.birds.filter((b) => b.state === 'cross').length;
  g.waitingBirds = () => g.birds.filter((b) => b.state === 'wait');
  g.waitingCars = () => g.cars.filter((c) => !c.leaving && !c.committed && c.v < 20 && c.s > stopS(c.lane) - 400);
  const carInZone = () => g.cars.some((c) => !c.leaving && c.s > zoneStart(c.lane) - 4 && c.s - CAR_LEN < zoneEnd(c.lane));
  g.carInZone = carInZone;

  function toggle() {
    if (g.light === 'green') {
      g.light = 'amber';
      g.amber = AMBER;
      g.phase = 0;
      sfx('switch');
      // cars too close to stop go on through
      for (const c of g.cars) if (!c.committed && stopS(c.lane) - c.s < 45 && c.v > 120) c.committed = true;
    } else if (g.light === 'red') {
      g.light = 'green';
      g.phase = 0;
      sfx('switch');
      const n = g.onCrossing();
      if (n) {
        g.nearMisses++;
        add(-3);
        g.brake = 1;
        g.flash = 0.35;
        sfx('squawk');
        sfx('honk');
        env.vibrate?.(140);
        pop('Near miss!  −3', (CX0 + CX1) / 2, ROAD_TOP - 70, '#c0403a', 54);
        // the birds on the crossing take fright and fly off, uncounted
        for (const b of g.birds) {
          if (b.state === 'cross') {
            b.state = 'leave';
            b.fly = 0;
            b.face = rng() < 0.5 ? -1 : 1;
          }
        }
      }
    }
  }

  function spawnCar(lane) {
    const d = LANE_DIR[lane];
    const s0 = d > 0 ? -20 : -(W + 20);
    const last = g.cars.filter((c) => c.lane === lane && !c.leaving).sort((a, b) => a.s - b.s)[0];
    if (last && last.s - CAR_LEN - GAP < s0 + 10) return; // the road is full back there
    g.cars.push({ lane, s: s0, v: g.carSpeed(), wait: 0, patience: patience(), committed: false, counted: false, leaving: 0, honked: false, color: CAR_COLS[Math.floor(rng() * CAR_COLS.length)], bob: rng() * 6 });
  }

  function spawnBird(side) {
    const tx = CX0 + 22 + rng() * (CX1 - CX0 - 44);
    const ty = side === 0 ? ROAD_TOP - 14 - rng() * 50 : ROAD_BOT + 16 + rng() * 52;
    const from = rng() < 0.5 ? -1 : 1;
    g.birds.push({
      side,
      x: tx + from * (420 + rng() * 300),
      y: ty - 260 - rng() * 120,
      sx: 0,
      sy: 0,
      tx,
      ty,
      fly: 0,
      state: 'fly',
      wait: 0,
      patience: patience(),
      color: BIRD_COLS[Math.floor(rng() * BIRD_COLS.length)],
      face: -from,
      hop: rng() * 6,
      size: 0.9 + rng() * 0.3,
    });
    const b = g.birds[g.birds.length - 1];
    b.sx = b.x;
    b.sy = b.y;
  }

  g.update = (dt, input) => {
    if (g.done) return;
    g.elapsed += dt;
    g.time = Math.max(0, DURATION - g.elapsed);
    if (g.time <= 0) {
      g.done = true;
      return;
    }
    g.phase += dt;
    if (input.actionPressed) toggle();
    if (g.light === 'amber') {
      g.amber -= dt;
      if (g.amber <= 0) {
        g.light = 'red';
        g.phase = 0;
      }
    }
    g.brake = Math.max(0, g.brake - dt);
    g.flash = Math.max(0, g.flash - dt);

    // Arrivals, faster as time goes on.
    for (let l = 0; l < 2; l++) {
      g.carT[l] -= dt;
      if (g.carT[l] <= 0) {
        spawnCar(l);
        g.carT[l] = g.carGap() * (0.7 + rng() * 0.6);
      }
      g.birdT[l] -= dt;
      if (g.birdT[l] <= 0) {
        const n = 1 + (rng() < g.pairChance() ? 1 : 0) + (rng() < g.trioChance() ? 1 : 0);
        for (let i = 0; i < n; i++) spawnBird(l);
        g.birdT[l] = g.birdGap() * (0.75 + rng() * 0.5);
      }
    }

    // Cars: drive, follow, stop at the line when they must.
    const crossingBusy = g.onCrossing() > 0;
    for (let l = 0; l < 2; l++) {
      const lane = g.cars.filter((c) => c.lane === l && !c.leaving).sort((a, b) => b.s - a.s);
      lane.forEach((c, i) => {
        const V = g.carSpeed();
        let limit = Infinity;
        if (i > 0) limit = lane[i - 1].s - CAR_LEN - GAP;
        if (!c.committed && c.s <= stopS(l) + 2) {
          const mustStop = g.light !== 'green' || crossingBusy;
          if (mustStop) limit = Math.min(limit, stopS(l));
          else if (c.s > stopS(l) - 12) c.committed = true;
        }
        const gap = Math.max(0, limit - c.s);
        const decel = g.brake > 0 ? 2400 : 1100;
        const target = Math.min(V, Math.sqrt(2 * decel * gap));
        c.v = c.v < target ? Math.min(target, c.v + 380 * dt) : target;
        c.s = Math.min(c.s + c.v * dt, limit === Infinity ? Infinity : Math.max(c.s, limit));
        // Waiting: a little clock fills while it is stopped short of the line.
        if (c.v < 20 && !c.committed) c.wait += dt;
        else c.wait = Math.max(0, c.wait - dt);
        if (!c.honked && c.wait > c.patience * 0.6) {
          c.honked = true;
          sfx('honk');
        }
        if (c.wait > c.patience) {
          c.leaving = 0.001;
          g.gaveUp++;
          add(-1);
          const x = c.s * LANE_DIR[l] - (LANE_DIR[l] * CAR_LEN) / 2;
          pop('Hmph! −1', x, LANE_Y[l] - 100, PAL.brick, 30);
          sfx('honk');
        }
        // Across: count it once it has cleared the far side of the crossing.
        if (!c.counted && c.s - CAR_LEN > zoneEnd(l)) {
          c.counted = true;
          g.carsAcross++;
          add(1);
          pop('+1', c.s * LANE_DIR[l] - (LANE_DIR[l] * CAR_LEN) / 2, LANE_Y[l] - 90, '#4a6a8a', 36);
          sfx('tick');
        }
      });
    }
    for (const c of g.cars) {
      if (c.leaving) {
        c.leaving += dt;
        c.s -= 60 * dt; // backs away and turns off
        if (rng() < 0.3) g.puffs.push({ x: c.s * LANE_DIR[c.lane] - LANE_DIR[c.lane] * CAR_LEN, y: LANE_Y[c.lane] - 10, life: 0.6, r: 8 + rng() * 6 });
      }
    }
    g.cars = g.cars.filter((c) => (c.leaving ? c.leaving < 0.9 : c.s - CAR_LEN < (LANE_DIR[c.lane] > 0 ? W + 40 : 40)));

    // Birds: flutter in, wait, cross on red when the crossing is clear.
    const clear = g.light === 'red' && !carInZone();
    const lastGo = [g.lastGo0 ?? -1, g.lastGo1 ?? -1];
    for (const b of g.birds) {
      b.hop += dt * 10;
      if (b.state === 'fly') {
        b.fly = Math.min(1, b.fly + dt / 1.1);
        const k = 1 - (1 - b.fly) * (1 - b.fly);
        b.x = lerp(b.sx, b.tx, k);
        b.y = lerp(b.sy, b.ty, k) - Math.sin(b.fly * Math.PI) * 40;
        if (b.fly >= 1) b.state = 'wait';
      } else if (b.state === 'wait') {
        b.wait += dt;
        if (clear && g.elapsed - lastGo[b.side] > 0.14) {
          b.state = 'cross';
          lastGo[b.side] = g.elapsed;
          b.wait = 0;
          b.ty = b.side === 0 ? ROAD_BOT + 18 + rng() * 48 : ROAD_TOP - 16 - rng() * 44;
        } else if (b.wait > b.patience) {
          b.state = 'leave';
          b.fly = 0;
          g.gaveUp++;
          add(-1);
          pop('Hmph! −1', b.x, b.y - 60, PAL.brick, 28);
          sfx('squawk');
        }
      } else if (b.state === 'cross') {
        const dir = b.side === 0 ? 1 : -1;
        b.y += dir * 190 * dt;
        if ((dir > 0 && b.y >= b.ty) || (dir < 0 && b.y <= b.ty)) {
          b.y = b.ty;
          b.state = 'gone';
          b.fly = 0;
          g.birdsAcross++;
          add(1);
          pop('+1', b.x, b.y - 50, '#4a7a3a', 36);
          sfx('catch', { pitch: (g.birdsAcross % 8) + 2 });
        }
      } else if (b.state === 'gone') {
        b.fly += dt;
        b.x += b.face * 120 * dt;
      } else if (b.state === 'leave') {
        b.fly += dt;
        b.x -= b.face * 260 * dt;
        b.y -= 320 * dt;
      }
    }
    g.lastGo0 = lastGo[0];
    g.lastGo1 = lastGo[1];
    g.birds = g.birds.filter((b) => !((b.state === 'gone' && b.fly > 0.9) || (b.state === 'leave' && b.y < -80)));

    for (const q of g.puffs) {
      q.life -= dt;
      q.y -= 30 * dt;
      q.r += 20 * dt;
    }
    g.puffs = g.puffs.filter((q) => q.life > 0);
    for (const q of g.pops) {
      q.life -= dt;
      q.y -= 50 * dt;
    }
    g.pops = g.pops.filter((q) => q.life > 0);
  };

  g.hud = () => `Birds ${g.birdsAcross} · Cars ${g.carsAcross}`;
  g.summary = () => {
    const woes = [];
    if (g.gaveUp) woes.push(`${g.gaveUp} gave up waiting`);
    if (g.nearMisses) woes.push(`${g.nearMisses} near miss${g.nearMisses === 1 ? '' : 'es'}`);
    return [
      `${g.birdsAcross} bird${g.birdsAcross === 1 ? '' : 's'} and ${g.carsAcross} car${g.carsAcross === 1 ? '' : 's'} got across.`,
      woes.length ? woes.join(', ') + '.' : 'Nobody had to wait too long. Well signalled!',
    ];
  };

  // ---------- drawing ----------

  // A little clock that fills as someone waits; red with a "!" when cross.
  function meter(c, x, y, k, t) {
    if (k < 0.3) return;
    const hot = k > 0.65;
    const r = 13;
    c.save();
    if (hot && !env.reduceMotion) c.translate(Math.sin(t * 40) * 1.5, 0);
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = 'rgba(250,244,228,0.95)';
    c.fill();
    c.beginPath();
    c.moveTo(x, y);
    c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(k, 0, 1));
    c.closePath();
    c.fillStyle = hot ? '#d0503a' : PAL.ochre;
    c.fill();
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    ink(c, 2);
    if (hot) label(c, '!', x + r + 10, y - 2, { size: 30, color: '#c0403a', weight: 800 });
    c.restore();
  }

  function drawCar(c, car, t) {
    const d = LANE_DIR[car.lane];
    const y = LANE_Y[car.lane];
    const x = car.s * d - (d * CAR_LEN) / 2;
    c.save();
    if (car.leaving) c.globalAlpha = Math.max(0, 1 - car.leaving / 0.9);
    c.translate(x, y + (car.leaving ? -car.leaving * 30 * (car.lane ? 1 : -1) : 0));
    c.scale(d, 1);
    const jig = car.v > 20 ? Math.sin(t * 18 + car.bob) * 1.2 : 0;
    if (spriteCell('sprites.cars', 0)) {
      // painted car (faces left; the scale(d) above is undone for it)
      c.save();
      c.globalAlpha *= 0.22;
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(0, 8, 84, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
      drawSprite(c, 'sprites.cars', Math.max(0, CAR_COLS.indexOf(car.color)) % 4, 0, 8 + jig, { w: 168, flip: true });
      // brake lights: lit while stopping, at the tail
      if (car.v < 200 && !car.committed) {
        c.beginPath();
        c.arc(-80, -32 + jig, 5, 0, Math.PI * 2);
        c.fillStyle = '#e04a3a';
        c.fill();
      }
    } else {
    // shadow
    c.save();
    c.globalAlpha *= 0.2;
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(0, 4, 78, 8, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.translate(0, jig);
    // body: an old rounded motor car, nose to the right
    const body = [[-74, -10], [-72, -36], [-40, -42], [-26, -72], [26, -72], [42, -42], [70, -36], [77, -12], [74, -2], [-72, -2]];
    poly(c, body, car.bob * 10, 1.2);
    wash(c, car.color);
    ink(c, 2.4);
    poly(c, body, car.bob * 10, 1.2);
    hatch(c, -80, -76, 80, 0, 10, 0.12, 1);
    poly(c, [[-18, -66], [20, -66], [32, -44], [-30, -44]], car.bob * 10 + 3, 0.8);
    wash(c, '#dde6ea');
    ink(c, 1.6);
    c.beginPath();
    c.moveTo(2, -66);
    c.lineTo(2, -44);
    ink(c, 1.4);
    // headlamp and bumper
    c.beginPath();
    c.arc(68, -26, 7, 0, Math.PI * 2);
    c.fillStyle = PAL.lemon;
    c.fill();
    ink(c, 1.4);
    // wheels
    for (const wx of [-44, 46]) {
      c.beginPath();
      c.arc(wx, -4, 15, 0, Math.PI * 2);
      c.fillStyle = '#3a3230';
      c.fill();
      ink(c, 1.6);
      c.beginPath();
      c.arc(wx, -4, 6, 0, Math.PI * 2);
      c.fillStyle = '#c8c0b0';
      c.fill();
    }
    // brake lights: lit while stopping
    if (car.v < 200 && !car.committed) {
      c.beginPath();
      c.arc(-72, -24, 5, 0, Math.PI * 2);
      c.fillStyle = '#e04a3a';
      c.fill();
    }
    }
    c.restore();
    if (!car.leaving) meter(c, x, y - 104, car.wait / car.patience, t);
    if (car.honked && car.wait > car.patience * 0.6 && !car.leaving) {
      // honk lines from the nose
      c.save();
      c.globalAlpha = 0.6 + Math.sin(t * 12) * 0.3;
      const nx = x + d * 86;
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.moveTo(nx, y - 34 + i * 12);
        c.lineTo(nx + d * 20, y - 34 + i * 20);
        ink(c, 2);
      }
      c.restore();
    }
  }

  function drawLittleBird(c, b, t) {
    const s = 1.35 * b.size;
    const flying = b.state === 'fly' || b.state === 'leave' || (b.state === 'gone' && b.fly > 0.4);
    const hop = b.state === 'cross' || b.state === 'gone' ? -Math.abs(Math.sin(b.hop)) * 5 : 0;
    c.save();
    if (b.state === 'gone') c.globalAlpha = clamp(1 - (b.fly - 0.4) * 2, 0, 1);
    // shadow on the ground
    if (!flying) {
      c.save();
      c.globalAlpha *= 0.18;
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(b.x, b.y + 2, 14 * s, 4 * s, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    if (spriteCell('sprites.chicks', 0)) {
      // painted chick: faces left, so flip when heading right
      const walking = b.state === 'cross' || b.state === 'gone';
      const cell = flying ? 5 : walking ? 3 + (Math.sin(b.hop * 0.8) > 0 ? 1 : 0) : Math.abs(Math.floor(b.sx)) % 3;
      // each cell by the scale its chick is painted at, so a chick stays one
      // size as it stands, walks and flies off (the flying chick is painted
      // smallest: design/source/pose-scales.json)
      const k = (0.1 * s) / CHICK_PAINTED[cell];
      const h = spriteCell('sprites.chicks', cell).trim.h * k;
      const rot = b.state === 'leave' ? 0.1 * b.face : 0;
      if (flying) drawSprite(c, 'sprites.chicks', cell, b.x, b.y - 20 * s + Math.sin(t * 30 + b.hop) * 2, { h, anchor: 'center', flip: b.face > 0, rot });
      else drawSprite(c, 'sprites.chicks', cell, b.x, b.y + hop, { h, flip: b.face > 0 });
      c.restore();
      if (b.state === 'wait') meter(c, b.x, b.y - 56 * b.size, b.wait / b.patience, t);
      return;
    }
    c.translate(b.x, b.y + hop);
    c.scale(s * b.face, s);
    // legs
    if (!flying) {
      c.beginPath();
      c.moveTo(-3, -10);
      c.lineTo(-5, 0);
      c.moveTo(3, -10);
      c.lineTo(4, 0);
      ink(c, 1.4);
    }
    // tail, body, head
    poly(c, [[-12, -16], [-24, -24], [-22, -14]], 2, 0.4);
    wash(c, b.color);
    ink(c, 1.2);
    blob(c, -2, -17, 13, 9, b.size * 10, 0.06, 12);
    wash(c, b.color);
    ink(c, 1.5);
    blob(c, 10, -27, 7.5, 7, b.size * 10 + 1, 0.05, 10);
    wash(c, b.color);
    ink(c, 1.4);
    poly(c, [[16, -29], [26, -26], [16, -24]], 3, 0.3);
    wash(c, PAL.ochre);
    ink(c, 1);
    c.beginPath();
    c.arc(12, -28, 1.8, 0, Math.PI * 2);
    c.fillStyle = INK;
    c.fill();
    // a wing: flapping in the air, folded on the ground
    const flap = flying ? Math.sin(t * 30 + b.hop) * 0.9 : 0.15;
    c.save();
    c.translate(-2, -20);
    c.rotate(-flap - 0.2);
    blob(c, -6, -2, 10, 4.5, b.size * 10 + 2, 0.08, 10);
    wash(c, b.color);
    ink(c, 1.2);
    c.restore();
    c.restore();
    if (b.state === 'wait') meter(c, b.x, b.y - 56 * b.size, b.wait / b.patience, t);
  }

  g.draw = (c, t) => {
    scene(c, 'crow', W, H, (c) => {
      // a pale sky, a quiet row of houses, the road and its two pavements
      band(c, 0, 0, W, KERB + 8, PAL.sky, 0.45, 1);
      const roofs = [[40, 270, 180], [250, 230, 150], [430, 290, 200], [1110, 250, 170], [1300, 280, 150], [1455, 240, 180]];
      roofs.forEach(([x, y, w], i) => {
        poly(c, [[x, KERB + 4], [x, y], [x + w / 2, y - 60], [x + w, y], [x + w, KERB + 4]], i + 3, 1.5);
        wash(c, i % 2 ? '#d8cbb0' : '#cdbfa6', 0.75);
        ink(c, 1.8);
        poly(c, [[x + w * 0.62, y - 24], [x + w * 0.62, y - 70], [x + w * 0.75, y - 70], [x + w * 0.75, y - 10]], i + 9, 1);
        wash(c, PAL.brick, 0.6);
        ink(c, 1.4);
        for (let k = 0; k < 2; k++) {
          poly(c, [[x + 24 + k * (w / 2), y + 40], [x + 54 + k * (w / 2), y + 40], [x + 54 + k * (w / 2), y + 82], [x + 24 + k * (w / 2), y + 82]], i * 4 + k, 0.8);
          wash(c, k ? '#efd98a' : '#9aa8b0', 0.7);
          ink(c, 1.2);
        }
      });
      // a tree between the houses
      c.beginPath();
      c.moveTo(700, KERB + 4);
      c.lineTo(706, 290);
      ink(c, 5);
      blob(c, 706, 260, 90, 70, 4, 0.12);
      wash(c, PAL.green, 0.6);
      ink(c, 1.6);
      blob(c, 706, 260, 90, 70, 4, 0.12);
      hatch(c, 610, 190, 800, 330, 9, 0.18, 1);
      // far pavement
      band(c, 0, KERB, W, ROAD_TOP - KERB, '#d6ccb8', 0.9, 4);
      c.beginPath();
      c.moveTo(0, ROAD_TOP);
      c.lineTo(W, ROAD_TOP);
      ink(c, 2.4);
      // the road
      c.save();
      c.globalAlpha = 0.8;
      c.fillStyle = '#a8a198';
      c.fillRect(0, ROAD_TOP, W, ROAD_BOT - ROAD_TOP);
      c.restore();
      c.save();
      c.beginPath();
      c.rect(0, ROAD_TOP, W, ROAD_BOT - ROAD_TOP);
      hatch(c, 0, ROAD_TOP, W, ROAD_BOT, 16, 0.08, 1);
      c.restore();
      // the centre line, broken
      c.save();
      c.setLineDash([40, 30]);
      c.beginPath();
      c.moveTo(0, MID);
      c.lineTo(CX0 - 30, MID);
      c.moveTo(CX1 + 30, MID);
      c.lineTo(W, MID);
      ink(c, 4, '#f2eee4');
      c.restore();
      // stop lines: the far lane stops right of the crossing, the near lane left
      for (const [x, y0, y1] of [[CX1 + 22, ROAD_TOP + 4, MID - 4], [CX0 - 22, MID + 4, ROAD_BOT - 4]]) {
        c.beginPath();
        c.moveTo(x, y0);
        c.lineTo(x, y1);
        ink(c, 7, '#f2eee4');
      }
      // the zebra stripes
      for (let y = ROAD_TOP + 10; y < ROAD_BOT - 10; y += 40) {
        poly(c, [[CX0, y], [CX1, y], [CX1, y + 22], [CX0, y + 22]], y, 1);
        wash(c, '#f4efe2', 0.95);
        ink(c, 1.2);
      }
      // near pavement and verge
      band(c, 0, ROAD_BOT, W, 96, '#d6ccb8', 0.95, 6);
      c.beginPath();
      c.moveTo(0, ROAD_BOT);
      c.lineTo(W, ROAD_BOT);
      ink(c, 2.4);
      for (let x = 0; x < W; x += 120) {
        c.beginPath();
        c.moveTo(x, ROAD_BOT + 4);
        c.lineTo(x + 6, ROAD_BOT + 92);
        ink(c, 1, 'rgba(59,43,32,0.3)');
      }
      band(c, 0, ROAD_BOT + 96, W, H - ROAD_BOT - 96, PAL.sage, 0.7, 7);
    });

    // everyone, back to front
    const items = [];
    for (const car of g.cars) items.push([LANE_Y[car.lane], () => drawCar(c, car, t)]);
    for (const b of g.birds) items.push([b.state === 'fly' || b.state === 'leave' ? 2000 : b.y, () => drawLittleBird(c, b, t)]);
    items.push([CROW_Y, () => drawBird(c, 'crow', { x: CROW_X, y: CROW_Y, size: CROW_SIZE, t, pose: { light: g.light } })]);
    items.sort((a, b) => a[0] - b[0]);
    for (const [, f] of items) f();

    for (const q of g.puffs) {
      c.save();
      c.globalAlpha = q.life * 0.6;
      blob(c, q.x, q.y, q.r, q.r * 0.8, q.r, 0.1, 10);
      wash(c, '#d8d2c8');
      ink(c, 1);
      c.restore();
    }

    // what the light means, beside the Crow
    const lx = CROW_X + 50;
    const ly = 150;
    const txt = g.light === 'green' ? 'Cars go' : g.light === 'amber' ? 'Wait…' : 'Birds cross';
    const col = g.light === 'green' ? '#3a8a4a' : g.light === 'amber' ? '#b0801a' : '#c0403a';
    c.save();
    blob(c, lx + 92, ly, 108, 30, 7, 0.04);
    c.fillStyle = 'rgba(250,244,228,0.9)';
    c.fill();
    ink(c, 2, col);
    label(c, txt, lx + 92, ly + 1, { size: 32, color: col, weight: 800 });
    c.restore();

    for (const q of g.pops) {
      const k = Math.min(1, (1.1 - q.life) * 8);
      const s = 0.6 + 0.4 * k + (k < 1 ? 0.15 : 0);
      c.save();
      c.globalAlpha = Math.min(1, q.life * 2);
      c.translate(q.x, q.y);
      c.scale(s, s);
      c.lineWidth = 6;
      c.strokeStyle = 'rgba(250,244,228,0.9)';
      c.font = `800 ${q.size}px Fraunces, Georgia, serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeText(q.text, 0, 0);
      label(c, q.text, 0, 0, { size: q.size, color: q.color, weight: 800 });
      c.restore();
    }

    if (g.flash > 0) {
      c.save();
      c.fillStyle = `rgba(220,70,50,${(env.reduceMotion ? 0.1 : 0.3) * g.flash})`;
      c.fillRect(0, 0, W, H);
      c.restore();
    }
    if (g.elapsed < 4) {
      c.save();
      c.globalAlpha = Math.min(1, 4 - g.elapsed);
      label(c, 'Press to switch: green for cars, red for birds', W / 2, 860, { size: 34, weight: 600 });
      c.restore();
    }
  };

  // For a narrow (portrait) screen: what the view follows, and how much of
  // the width it must keep in view.
  g.focus = () => (CX0 + CX1) / 2;
  g.span = 1300;

  return g;
}
