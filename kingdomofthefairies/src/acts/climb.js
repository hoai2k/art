// The film edition's continuous climb (Act V: the cliff and the tower wall).
// He climbs anywhere on the painted face, at a speed set by what his hands
// find there (src/acts/climb-map.js, read from the cloths by
// design/source/build_climb_map.py): ivy fastest, the cracks and corners
// between blocks fast, bare rock steady, the cliff's wet cleft and the
// tower's window openings slow, and slower still under the lip of a ledge.
// Pushing up into a ledge, he hauls himself onto it; on a ledge he walks;
// pressing down he lowers himself off it; A springs a short way in the
// direction held. Off the painted edge of the cloth there is nothing to hold.
// Headless: Act V owns the hits, the stones, checkpoints and the camera.
import { CLIMB_MAPS } from './climb-map.js';
import { clamp } from './shared.js';

export const CLIMB = {
  speed: { v: 150, k: 126, r: 80, s: 40 },  // up the face, world px/s, by terrain under his hands
  side: 1.15, down: 1.3,                    // across, and down, go a little quicker
  lip: 0.5, lipBand: 44,                    // under a ledge's top this far, slower
  walk: 230,                                // along a ledge
  hands: 92,                                // his hands above his feet
  mantle: 0.62, lower: 0.45, step: 0.2,     // hauling onto a ledge, lowering off, turning to the wall
  leap: 150, leapT: 0.36, catchT: 0.16, leapCD: 0.25,
  fallCatch: 0.34, g: 1500,                 // falling, he grabs the wall again after this long
  hitT: 0.4,
  crumble: 0.9, crumbleR: 46,               // dry ivy tears this long after he takes it
  pearlR: 38,
};
export const TERRAIN_NAMES = { v: 'ivy', k: 'crack', r: 'rock', s: 'slick', '.': 'none' };

export function terrainAt(map, x, y) {
  const c = Math.floor((x - map.x0) / map.cell), r = Math.floor((y - map.y0) / map.cell);
  if (c < 0 || c >= map.cols || r < 0 || r >= map.rows) return '.';
  return map.grid[r][c];
}
// Can he hold on here, feet at (x, y)? Both his feet and his hands need the
// painted face; reaching over the cliff's grass edge, his hands find the top.
const holdable = (map, x, y) => terrainAt(map, x, y) !== '.'
  && (terrainAt(map, x, y + CLIMB.hands) !== '.' || (map.openTop && y + CLIMB.hands >= map.top - 4 && terrainAt(map, x, map.top - 8) !== '.'));
// No higher than his hands can reach on a wall with a closed top (the tower's battlements).
// (or, on the classic cliff, than the overhanging lip lets him: only the boot gets him over)
const cap = (w, y) => {
  if (w.capY != null) return Math.min(y, Math.max(w.y, w.capY));
  return w.map.openTop || w.goal == null ? y : Math.min(y, w.map.top - CLIMB.hands - 2);
};
const onLedge = (l, x, pad = 0) => x >= l.x0 - pad && x <= l.x1 + pad;

// `holds` is the act's hold list: its ledge holds are already ledges in the
// map; its pearls and its dry ivy (kind 'crumble') carry over.
export function createWall(name, holds, at, opts = {}) {
  const map = CLIMB_MAPS[name];
  const w = {
    name, map, x: at.x, y: at.y, mode: 'wall', t: 0, face: 1, dir: { x: 0, y: 0 }, dist: 0, still: 0,
    ledge: -1, from: null, to: null, vy: 0, cd: 0, after: null,
    goal: opts.goal || null, floor: opts.floor ?? 0,
    // the wall's ledges, and any the act moves itself (the classic giant's boot)
    ledges: [...map.ledges.map((l) => ({ ...l })), ...(opts.extraLedges || [])],
    capY: opts.capY ?? null, closedTop: !!opts.closedTop,
    pearls: holds.filter((h) => h.pearl).map((h) => ({ x: h.x, y: h.y, taken: false })),
    crumbles: holds.filter((h) => h.kind === 'crumble').map((h) => ({ x: h.x, y: h.y, t: 0, gone: false })),
  };
  const near = w.ledges.findIndex((o) => onLedge(o, at.x, 4) && Math.abs(o.y - at.y) <= 40);
  if (near >= 0) { w.mode = 'ledge'; w.ledge = near; w.y = w.ledges[near].y; }
  return w;
}

// The highest ledge whose top is at or just below y under x.
function ledgeUnder(w, x, y) {
  let best = -1;
  w.ledges.forEach((l, i) => { if (onLedge(l, x, 4) && l.y <= y && l.y > y - 60 && (best < 0 || l.y > w.ledges[best].y)) best = i; });
  return best;
}

export function wallSpeed(w, x, y) {
  // (reaching over the cliff's grass edge, the top of the rock under his hands)
  const t = terrainAt(w.map, x, y + CLIMB.hands);
  let v = CLIMB.speed[t] ?? (w.map.openTop && y + CLIMB.hands >= w.map.top - 12 ? CLIMB.speed.r : 0);
  if (w.ledges.some((l) => onLedge(l, x) && l.y > y + CLIMB.hands - CLIMB.lipBand && l.y < y + CLIMB.hands + 12)) v *= CLIMB.lip;
  return v;
}

const begin = (w, mode, to, after = null) => { w.mode = mode; w.t = 0; w.from = { x: w.x, y: w.y }; w.to = to; w.after = after; };

// One frame. ctx: { events, hit(cause), pearl(p), atTop() }. Returns 'top'
// when he hauls himself over the top (or onto the goal sill).
export function stepWall(w, dt, input, ctx) {
  const map = w.map;
  w.t += dt; w.cd = Math.max(0, w.cd - dt);
  const mx = clamp(input.moveX || 0, -1, 1) + (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const my = clamp(-(input.moveY || 0), -1, 1) + (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const m = Math.hypot(mx, my), dir = m > 0.25 ? { x: mx / Math.max(1, m), y: my / Math.max(1, m) } : null;
  const ease = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  const wasY = w.y;

  if (w.mode === 'mantle' || w.mode === 'lower' || w.mode === 'step' || w.mode === 'catch' || w.mode === 'hit') {
    const dur = { mantle: CLIMB.mantle, lower: CLIMB.lower, step: CLIMB.step, catch: CLIMB.catchT, hit: CLIMB.hitT }[w.mode];
    if (w.to) { const k = ease(w.t / dur); w.x = w.from.x + (w.to.x - w.from.x) * k; w.y = w.from.y + (w.to.y - w.from.y) * k; }
    if (w.t >= dur) {
      if (w.after === 'top') return 'top';
      if (w.mode === 'mantle' || (w.mode === 'hit' && w.wasLedge)) { w.mode = 'ledge'; w.t = 0; }
      else { w.mode = 'wall'; w.t = 0; }
    }
  } else if (w.mode === 'leap') {
    if (w.to) {
      const k = clamp(w.t / CLIMB.leapT, 0, 1), kk = 1 - (1 - k) ** 2;
      const nx = w.from.x + (w.to.x - w.from.x) * kk, ny = w.from.y + (w.to.y - w.from.y) * kk;
      if (arrive(w, w.x, w.y, nx, ny, ctx, true)) { /* onto a ledge, or the top */ }
      else if (holdable(map, nx, ny)) { w.x = nx; w.y = ny; }
      else w.to = null;   // the painted edge stops him; he clings there
    }
    if (w.mode === 'leap' && w.t >= CLIMB.leapT) begin(w, 'catch', null);
  } else if (w.mode === 'fall') {
    w.vy = Math.min(900, w.vy + CLIMB.g * dt);
    const ny = Math.max(w.floor, w.y - w.vy * dt);
    const l = w.ledges.findIndex((o) => onLedge(o, w.x) && o.y <= w.y && o.y >= ny);
    if (l >= 0) { w.y = w.ledges[l].y; w.mode = 'ledge'; w.ledge = l; w.t = 0; ctx.events.push({ type: 'climbLand', sound: 'thud', gain: 0.3 }); }
    else { w.y = ny; if (w.t >= CLIMB.fallCatch && holdable(map, w.x, w.y)) { begin(w, 'catch', null); ctx.events.push({ type: 'climbCatch', sound: 'rockScrape', gain: 0.5 }); } }
  } else if (w.mode === 'ledge') {
    const l = w.ledges[w.ledge];
    w.y = l.y;   // a ledge the act moves carries him with it
    if (input.a && w.cd <= 0 && holdable(map, w.x, w.y + 40)) {
      const d = dir && dir.y > -0.3 ? dir : { x: dir ? dir.x * 0.5 : 0, y: 1 };
      return leap(w, d, ctx);
    }
    const canUp = holdable(map, w.x, w.y + 24), canDown = holdable(map, w.x, w.y - CLIMB.hands);
    // a ledge within his reach above (the classic giant's boot over its shelf): straight up onto it
    const above = dir && dir.y > 0.6 ? w.ledges.findIndex((o, i) => i !== w.ledge && onLedge(o, w.x, 4) && o.y > w.y + 8 && o.y <= w.y + CLIMB.hands + 8) : -1;
    if (above >= 0) {
      w.ledge = above; begin(w, 'mantle', { x: clamp(w.x, w.ledges[above].x0 + 6, w.ledges[above].x1 - 6), y: w.ledges[above].y });
      ctx.events.push({ type: 'climbMantle', sound: 'rockScrape', gain: 0.6 });
    } else if (dir && dir.y > 0.6 && Math.abs(dir.x) < 0.8 && canUp) {
      begin(w, 'step', { x: w.x, y: w.y + 8 }); w.face = dir.x < -0.2 ? -1 : dir.x > 0.2 ? 1 : w.face;
      ctx.events.push({ type: 'climbStep' });
    } else if (dir && dir.y < -0.6 && Math.abs(dir.x) < 0.8 && canDown) {
      begin(w, 'lower', { x: w.x, y: w.y - CLIMB.hands + 6 }); ctx.events.push({ type: 'climbLower' });
    } else if (dir && Math.abs(dir.x) > 0.25) {
      const vx = Math.sign(dir.x) * CLIMB.walk * Math.min(1, Math.abs(dir.x) * 1.3);
      w.face = Math.sign(dir.x);
      const nx = w.x + vx * dt;
      if (onLedge(l, nx, 6)) { w.x = nx; w.dist += Math.abs(vx * dt); w.still = 0; }
      else {
        // off its end: onto the face beside it, or along to a ledge level with it
        const next = w.ledges.findIndex((o, i) => i !== w.ledge && onLedge(o, nx, 6) && Math.abs(o.y - l.y) < 20);
        if (next >= 0) { w.ledge = next; w.x = nx; w.y = w.ledges[next].y; w.dist += Math.abs(vx * dt); }
        else if (holdable(map, nx, w.y)) { w.x = nx; w.mode = 'wall'; w.t = 0; ctx.events.push({ type: 'climbStep' }); }
      }
    } else w.still += dt;
    w.dir = dir || { x: 0, y: 0 };
  } else {
    // on the face
    if (input.a && w.cd <= 0) return leap(w, dir || { x: 0, y: 1 }, ctx);
    if (dir) {
      const v = wallSpeed(w, w.x, w.y) * (dir.y < 0 ? CLIMB.down : 1) * (Math.abs(dir.x) > Math.abs(dir.y) ? CLIMB.side : 1);
      const wantY = w.y + dir.y * v * dt;
      let nx = w.x + dir.x * v * dt, ny = cap(w, wantY);
      if (!holdable(map, nx, ny)) {
        if (holdable(map, nx, w.y)) ny = w.y; else if (holdable(map, w.x, ny)) nx = w.x; else { nx = w.x; ny = w.y; }
      }
      ny = Math.max(ny, w.floor);
      // (a ledge within reach above is reached even where the lip caps his climb)
      if (!arrive(w, w.x, w.y, nx, Math.max(ny, Math.min(wantY, w.y + 40)), ctx, false)) {
        w.dist += Math.hypot(nx - w.x, ny - w.y); w.x = nx; w.y = ny;
      }
      w.dir = dir; w.still = 0;
      if (Math.abs(dir.x) > 0.3) w.face = Math.sign(dir.x);
    } else { w.dir = { x: 0, y: 0 }; w.still += dt; }
  }

  // dry ivy tears if he lingers in it
  for (const cr of w.crumbles) {
    if (cr.gone) continue;
    const inIt = w.mode === 'wall' && Math.hypot(w.x - cr.x, w.y + CLIMB.hands * 0.6 - cr.y) < CLIMB.crumbleR;
    cr.t = inIt ? cr.t + dt : Math.max(0, cr.t - dt * 2);
    if (cr.t >= CLIMB.crumble) {
      cr.gone = true;
      ctx.events.push({ type: 'holdCrumble', x: cr.x, y: cr.y });
      w.mode = 'fall'; w.t = 0; w.vy = 0;
      ctx.hit('crumble');
    }
  }
  // pearls along the way
  for (const p of w.pearls) {
    if (!p.taken && Math.abs(p.x - w.x) < CLIMB.pearlR && p.y > w.y - 20 && p.y < w.y + CLIMB.hands + 30) { p.taken = true; ctx.pearl(p); }
  }
  w.moved = w.y - wasY;
  return null;
}

// A move from (px, py) to (nx, ny) that meets a ledge or the top: up into a
// ledge's lip he hauls himself onto it; down onto its top he stands on it.
function arrive(w, px, py, nx, ny, ctx, leaping) {
  const map = w.map, H = CLIMB.hands;
  // the top of the climb, or the goal (her window's sill)
  const g = w.goal;
  if (g && ny + H >= g.y && Math.abs(nx - g.x) < g.r) {
    begin(w, 'mantle', { x: g.x, y: g.y }, 'top'); ctx.events.push({ type: 'climbMantle', sound: 'rockScrape', gain: 0.6 });
    return true;
  }
  if (!g && !w.closedTop && ny + H >= map.top) {
    begin(w, 'mantle', { x: nx, y: map.top }, 'top'); ctx.events.push({ type: 'climbMantle', sound: 'rockScrape', gain: 0.6 });
    return true;
  }
  if (ny > py) {
    const i = w.ledges.findIndex((l) => onLedge(l, nx, 4) && py < l.y - 2 && ny + H >= l.y);
    if (i >= 0) {
      const l = w.ledges[i];
      w.ledge = i;
      begin(w, 'mantle', { x: clamp(nx, l.x0 + 6, l.x1 - 6), y: l.y }); ctx.events.push({ type: 'climbMantle', sound: 'rockScrape', gain: 0.6 });
      return true;
    }
  } else if (ny < py) {
    const i = w.ledges.findIndex((l) => onLedge(l, nx, 4) && py >= l.y - 1 && ny <= l.y);
    if (i >= 0) {
      w.ledge = i; w.x = nx; w.y = w.ledges[i].y; w.mode = 'ledge'; w.t = 0;
      ctx.events.push({ type: leaping ? 'climbLand' : 'climbStepDown' });
      return true;
    }
  }
  return false;
}

function leap(w, d, ctx) {
  const m = Math.hypot(d.x, d.y) || 1;
  begin(w, 'leap', { x: w.x + (d.x / m) * CLIMB.leap, y: cap(w, Math.max(w.floor, w.y + (d.y / m) * CLIMB.leap)) });
  w.cd = CLIMB.leapT + CLIMB.leapCD;
  if (Math.abs(d.x) > 0.3) w.face = Math.sign(d.x);
  w.dir = { x: d.x / m, y: d.y / m };
  ctx.events.push({ type: 'leap' });
  return null;
}

// Hauls him up to (x, y): onto the top when `after` is 'top'.
export function mantleTo(w, x, y, after, ctx) { begin(w, 'mantle', { x, y }, after); ctx.events.push({ type: 'climbMantle', sound: 'rockScrape', gain: 0.6 }); }

// Struck by a stone: a jolt on the wall (no fall).
export function jolt(w) { if (w.mode === 'wall' || w.mode === 'ledge') { const m = w.mode; begin(w, 'hit', null); w.after = null; w.wasLedge = m === 'ledge'; } }

// The pose to draw, for the art: kind and frame (see act5-art.js wallClimber).
export function wallPose(w) {
  const step = (n, len) => Math.floor(w.dist / len) % n;
  switch (w.mode) {
    case 'ledge': return Math.abs(w.dir.x) > 0.25 ? { kind: 'walk' } : { kind: 'stand' };
    case 'mantle': { const k = w.t / CLIMB.mantle; return { kind: k < 0.4 ? 'mantle-a' : k < 0.75 ? 'mantle-b' : 'mantle-c' }; }
    case 'lower': { const k = w.t / CLIMB.lower; return { kind: k < 0.35 ? 'mantle-c' : k < 0.7 ? 'mantle-b' : 'mantle-a' }; }
    case 'step': return { kind: 'wall-step' };
    case 'leap': return { kind: 'wall-leap' };
    case 'catch': return { kind: 'wall-catch' };
    case 'hit': return { kind: w.wasLedge ? 'land' : 'wall-hit' };
    case 'fall': return { kind: 'fall' };
    default: {
      if (!w.dir.x && !w.dir.y) return { kind: Math.floor(w.still / 2.2) % 2 ? 'wall-idle-b' : 'wall-idle' };
      if (Math.abs(w.dir.x) > Math.abs(w.dir.y)) return { kind: 'wall-side-' + 'abcd'[step(4, 22)] };
      const i = step(4, 20);
      return { kind: 'wall-up-' + 'abcd'[w.dir.y < 0 ? 3 - i : i] };
    }
  }
}
