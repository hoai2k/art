// The living collage: one scene's pieces, panels and field, the players'
// bindings, and how each verb moves them. Pure state, no DOM or WebGL, so it
// runs in Node for the tests. See design/design.md.
//
// World units: the picture is W x H (16 x 9). A piece's home is where it sits
// in the scene's composition; left alone it drifts back there.

export const W = 16;
export const H = 9;

export const STICKS = ['LS', 'RS'];
export const TRIGGERS = ['LT', 'RT'];
export const BUTTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB'];
export const INPUTS = [...STICKS, ...TRIGGERS, ...BUTTONS];

export const PLAYER_COLOURS = ['#d8282f', '#f2b51b', '#1aa7a0', '#8a4fd0'];

// What each kind of input can do, at each scale. A large verb is centred on an
// anchor piece and its reach depends on how the picture is set up.
export const VERBS = {
  stick: { small: ['nudge', 'turn', 'stretch'], medium: ['drift', 'herd'], large: ['swirl', 'tide'] },
  trigger: { small: ['fade', 'bloom'], medium: ['bloom-kind', 'unfold'], large: ['pour', 'unravel'] },
  button: { small: ['morph', 'hop', 'stitch'], medium: ['swap', 'turn-over', 'pulse-kind'], large: ['scatter', 'morph-all', 'gather'] },
};

// Plain-language names for the bindings card and the hints.
export const VERB_TEXT = {
  nudge: 'moves', turn: 'turns', stretch: 'stretches', drift: 'slides', herd: 'herds',
  swirl: 'swirls the picture around', tide: 'sends a tide through the picture',
  fade: 'fades', bloom: 'blooms', 'bloom-kind': 'blooms every', unfold: 'unfolds',
  pour: 'pours the next picture in from', unravel: 'unravels the picture from',
  morph: 'changes', hop: 'hops', stitch: 'stitches', swap: 'swaps', 'turn-over': 'turns over',
  'pulse-kind': 'pulses every', scatter: 'scatters the picture from', 'morph-all': 'changes everything with',
  gather: 'gathers the picture to',
};

export const inputKind = (input) => (STICKS.includes(input) ? 'stick' : TRIGGERS.includes(input) ? 'trigger' : 'button');

// Seeded random numbers, so a deal can be replayed in the tests.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const len = (x, y) => Math.hypot(x, y);
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

// Pieces, from a scene's data (web/scenes.json).
export function makePieces(scene) {
  return scene.pieces.map((p, i) => {
    const w = p.home[2] * W;
    const x = p.home[0] * W;
    const y = p.home[1] * H;
    return {
      i,
      kind: p.kind,
      chain: p.chain || null,
      file: p.file,
      blink: p.blink || null, // a closed-eyes swap, once delivered
      poses: p.poses || null, // swaps for a bird's wings, once delivered
      w,
      h: w * p.aspect,
      home: { x, y, rot: 0 },
      origin: { x, y, rot: 0 }, // its place in the composition
      x, y, vx: 0, vy: 0,
      rot: 0, vrot: 0,
      sx: 1, sy: 1, vsx: 0, vsy: 0, // stretch
      flip: 1, flipTo: 1,
      bloom: 0, vbloom: 0,
      alpha: 1, alphaTo: 1,
      stage: -1, // morph-chain stage shown instead of the piece (-1: the piece itself)
      morph: 0, // 0..1 progress of the change to `stage`
      fromStage: -1,
      links: new Set(),
      held: 0, // how hard a player is holding it this frame (for the hints)
    };
  });
}

// The ground is cut into panels (a 3 x 2 patchwork) that can slide and turn.
export function makePanels() {
  const out = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      out.push({ i: out.length, c, r, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0, flip: 1, flipTo: 1 });
    }
  }
  return out;
}

export function radius(p) {
  return 0.5 * Math.max(p.w * p.sx, p.h * p.sy) * (1 + p.bloom * 0.4);
}

// How ready a large binding's setup is, 0..1. Its reach and strength follow.
export function setupPower(game, b) {
  const s = b.setup;
  if (!s) return 1;
  const a = game.pieces[s.anchor];
  if (!a) return 0;
  if (s.type === 'centre') {
    const d = len(a.x - W / 2, a.y - H / 2);
    return clamp(1 - (d - 0.8) / 5.5, 0, 1);
  }
  if (s.type === 'link') return clamp(linked(game, s.anchor).size / s.need, 0, 1);
  if (s.type === 'meet') {
    const o = game.pieces[s.other];
    if (!o) return 0;
    const d = len(a.x - o.x, a.y - o.y);
    const touch = (radius(a) + radius(o)) * 0.75;
    return clamp(1 - (d - touch) / 6, 0, 1);
  }
  return 1;
}

export const AWAKE = 0.85;

// All the pieces sewn to piece i, i included.
export function linked(game, i) {
  const seen = new Set([i]);
  const todo = [i];
  while (todo.length) {
    const p = game.pieces[todo.pop()];
    for (const j of p.links) if (!seen.has(j)) { seen.add(j); todo.push(j); }
  }
  return seen;
}

export function link(game, i, j) {
  if (i === j) return;
  const a = game.pieces[i];
  const b = game.pieces[j];
  // Sewn at the distance they are now, so sewing does not drag them together;
  // from then on they keep about that far apart and move as one.
  const rest = Math.max(len(a.x - b.x, a.y - b.y), (radius(a) + radius(b)) * 0.5);
  a.links.add(j);
  b.links.add(i);
  a.rest = a.rest || new Map();
  b.rest = b.rest || new Map();
  a.rest.set(j, rest);
  b.rest.set(i, rest);
  game.events.push({ type: 'link', a: i, b: j });
}

// The reach of a large effect: a radius around its anchor.
export function reach(game, b) {
  const pw = setupPower(game, b);
  return 1.6 + pw * pw * 11;
}

// Deal every player's bindings for this scene. Each player gets one large
// control and a small one that sets it up, then a mix of the rest (roughly six
// small to three medium to one large). Targets are spread across players.
export function deal(game, seed = Math.floor(Math.random() * 1e9), keep = null) {
  const r = rng(seed);
  const n = game.pieces.length;
  const taken = new Map(); // piece -> times dealt
  const take = (list) => {
    const sorted = [...list].sort((a, b) => (taken.get(a) || 0) - (taken.get(b) || 0) || r() - 0.5);
    const best = sorted[0];
    taken.set(best, (taken.get(best) || 0) + 1);
    return best;
  };
  const all = [...Array(n).keys()];
  const big = all.filter((i) => game.pieces[i].w * game.pieces[i].h > 1.2);
  for (const pl of game.players) {
    const old = pl.bindings || {};
    const bindings = {};
    // A player joining leaves everyone else's controls exactly as they are.
    if (keep === 1 && Object.keys(old).length === INPUTS.length) {
      for (const b of Object.values(old)) if (b.target < 1000) taken.set(b.target, (taken.get(b.target) || 0) + 1);
      continue;
    }
    // Otherwise some small and medium controls carry over at the same scale
    // and verb but on new targets; the large one and its helper are dealt anew.
    const keepInputs = keep ? new Set(INPUTS.filter((inp) => old[inp] && old[inp].scale !== 'large' && !old[inp].setsUp && r() < keep)) : new Set();
    for (const inp of keepInputs) {
      const b = { ...old[inp], found: false, use: 0 };
      if (b.target < 1000) b.target = take(all);
      bindings[inp] = b;
    }
    const free = INPUTS.filter((i) => !bindings[i]);
    const hasLarge = Object.values(bindings).some((b) => b.scale === 'large');
    // The large control and the small control that sets it up.
    if (!hasLarge) {
      const bigInputs = free.filter((i) => inputKind(i) !== 'button' || r() < 0.4);
      const inp = pick(r, bigInputs.length ? bigInputs : free);
      const anchor = take(big.length ? big : all);
      const kind = inputKind(inp);
      bindings[inp] = {
        input: inp, scale: 'large', verb: pick(r, VERBS[kind].large), target: anchor,
        setup: makeSetup(game, r, anchor, take, all), found: false, use: 0,
      };
      free.splice(free.indexOf(inp), 1);
      const s = bindings[inp].setup;
      const sInputs = free.filter((i) => (s.type === 'link' ? inputKind(i) === 'button' : inputKind(i) === 'stick'));
      const sInp = pick(r, sInputs.length ? sInputs : free);
      const sKind = inputKind(sInp);
      const sVerb = s.type === 'link' ? (sKind === 'button' ? 'stitch' : 'nudge') : sKind === 'stick' ? 'nudge' : sKind === 'button' ? 'hop' : 'bloom';
      bindings[sInp] = { input: sInp, scale: 'small', verb: sVerb, target: anchor, setsUp: inp, found: false, use: 0 };
      free.splice(free.indexOf(sInp), 1);
    }
    for (const inp of free) {
      const kind = inputKind(inp);
      const roll = r();
      const scale = roll < 0.66 ? 'small' : roll < 0.95 ? 'medium' : 'large';
      const verb = pick(r, VERBS[kind][scale]);
      let target;
      if (verb === 'drift' || verb === 'turn-over' || verb === 'unfold') target = 1000 + Math.floor(r() * game.panels.length);
      else target = take(all);
      const b = { input: inp, scale, verb, target, found: false, use: 0 };
      if (scale === 'large') b.setup = makeSetup(game, r, target, take, all);
      bindings[inp] = b;
    }
    pl.bindings = bindings;
  }
  game.dealt = (game.dealt || 0) + 1;
}

function makeSetup(game, r, anchor, take, all) {
  const roll = r();
  if (roll < 0.45) return { type: 'centre', anchor };
  if (roll < 0.75) return { type: 'link', anchor, need: 2 + Math.floor(r() * 2) };
  const others = all.filter((i) => i !== anchor);
  return { type: 'meet', anchor, other: others.length ? take(others) : anchor };
}

export function createGame(scenes, opts = {}) {
  const game = {
    scenes,
    chains: opts.chains || {},
    index: opts.scene ?? 0,
    pieces: [],
    panels: makePanels(),
    players: [],
    field: { swirls: [], tide: 0, tideV: 0, ripple: 0, pour: 0, pourX: W / 2, pourY: H / 2, unravel: 0, unravelX: W / 2, unravelY: H / 2 },
    events: [],
    time: 0,
    quiet: 0, // seconds since anyone touched anything
    settled: 0, // 0..1 how settled the picture is: every piece home and still
    sceneTime: 0,
    transition: null, // { from: {scene, pieces, panels}, t, mask }
    travellers: [],
    rearranged: 0,
    touching: new Map(),
    reduceMotion: false,
    seed: opts.seed ?? 1,
  };
  game.random = rng(game.seed);
  enterScene(game, game.index);
  return game;
}

export function addPlayer(game, id) {
  if (game.players.some((p) => p.id === id)) return game.players.find((p) => p.id === id);
  const used = new Set(game.players.map((p) => p.colour));
  const colour = PLAYER_COLOURS.find((c) => !used.has(c)) || PLAYER_COLOURS[game.players.length % 4];
  const pl = { id, colour, bindings: {}, last: null, step: 0, prev: {} };
  game.players.push(pl);
  deal(game, Math.floor(game.random() * 1e9), 1); // everyone keeps theirs; the new player is dealt
  return pl;
}

export function removePlayer(game, id) {
  game.players = game.players.filter((p) => p.id !== id);
}

export function enterScene(game, index) {
  game.index = ((index % game.scenes.length) + game.scenes.length) % game.scenes.length;
  game.scene = game.scenes[game.index];
  game.pieces = makePieces(game.scene);
  game.panels = makePanels();
  game.field.swirls = [];
  game.field.tide = 0;
  game.field.pour = 0;
  game.field.unravel = 0;
  game.sceneTime = 0;
  game.settled = 0;
  game.quiet = 0;
  game.rearranged = 0;
  if (game.players.length) deal(game, Math.floor(game.random() * 1e9), game.dealt ? 0.3 : null);
  game.events.push({ type: 'scene', index: game.index });
}

// Carry the picture on to the next scene: the old one dissolves through a
// mask while up to two pieces on a shared morph chain travel across.
export function shift(game, how = 'pour', at = null) {
  if (game.transition) return;
  const from = { scene: game.scene, pieces: game.pieces, panels: game.panels, field: { ...game.field, swirls: game.field.swirls.map((s) => ({ ...s })) } };
  const next = (game.index + 1) % game.scenes.length;
  const carry = game.pieces.filter((p) => p.chain).sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 2);
  enterScene(game, next);
  const travellers = [];
  for (const p of carry) {
    const target = game.pieces.find((q) => q.chain === p.chain && !travellers.some((t) => t.to === q.i));
    if (!target) continue;
    // The arriving piece starts where the old one was and drifts home.
    target.x = p.x;
    target.y = p.y;
    target.rot = p.rot;
    target.fromFile = p.stage >= 0 ? game.chains[p.chain]?.[p.stage]?.file || p.file : p.file;
    target.morph = 0;
    travellers.push({ from: p, to: target.i, t: 0 });
  }
  game.travellers = travellers;
  game.transition = { from, t: 0, how, x: at ? at.x : W / 2, y: at ? at.y : H / 2, mask: how === 'unravel' ? 3 : how === 'pour' ? 1 : 0 };
  game.events.push({ type: 'shift', how, scene: game.index });
}

// The per-player input for one frame:
// { LS: [x, y], RS: [x, y], LT: 0..1, RT: 0..1, pressed: Set of buttons, dpad: -1|0|1 }
export function step(game, dt, inputs = new Map()) {
  dt = Math.min(dt, 1 / 20);
  game.time += dt;
  game.sceneTime += dt;
  let active = 0;
  for (const p of game.pieces) p.held = 0;
  for (const pl of game.players) {
    const inp = inputs.get(pl.id);
    if (!inp) continue;
    active += applyPlayer(game, pl, inp, dt);
  }
  game.quiet = active > 0.05 ? 0 : game.quiet + dt;
  physics(game, dt);
  // The finished picture shows through when everything has come home and been still a while.
  const home = game.pieces.every((p) => len(p.x - p.home.x, p.y - p.home.y) < 0.12 && Math.abs(p.rot) < 0.05 && p.stage < 0 && p.alpha > 0.95) && game.rearranged === 0;
  const target = home && game.quiet > 5 && !game.transition ? 1 : 0;
  game.settled += (target - game.settled) * Math.min(1, dt * (target ? 0.5 : 3));
  if (game.transition) {
    game.transition.t += dt / 3.2;
    for (const t of game.travellers) t.t = Math.min(1, t.t + dt / 2.4);
    if (game.transition.t >= 1) {
      game.transition = null;
      game.travellers = [];
    }
  }
  // If nobody finds a way on, the picture drifts on by itself after a while.
  if (game.sceneTime > 300 && game.quiet > 20) shift(game, 'drift');
}

function applyPlayer(game, pl, inp, dt) {
  let activity = 0;
  for (const name of INPUTS) {
    const b = pl.bindings[name];
    if (!b) continue;
    const kind = inputKind(name);
    let amount = 0;
    let vec = [0, 0];
    let pressed = false;
    if (kind === 'stick') {
      vec = inp[name] || [0, 0];
      amount = len(vec[0], vec[1]);
    } else if (kind === 'trigger') {
      amount = inp[name] || 0;
    } else {
      pressed = inp.pressed?.has(name) || false;
      amount = pressed ? 1 : 0;
    }
    if (amount > 0.25) {
      if (!b.found) {
        b.found = true;
        game.events.push({ type: 'found', player: pl.id, input: name, scale: b.scale, verb: b.verb, target: b.target });
      }
      b.use += dt + (pressed ? 1 : 0);
      pl.last = name;
      activity += amount;
    }
    if (amount > 0.02) apply(game, pl, b, { amount, vec, pressed }, dt);
  }
  // D-pad steps the most recently used binding to the next target of the same kind.
  if (inp.dpad && pl.last && pl.bindings[pl.last]) {
    const b = pl.bindings[pl.last];
    if (b.target < 1000 && b.scale !== 'large') {
      const cur = game.pieces[b.target];
      const same = game.pieces.filter((p) => p.kind === cur.kind);
      const pool = same.length > 1 ? same : game.pieces;
      const at = pool.indexOf(cur);
      b.target = pool[(at + inp.dpad + pool.length) % pool.length].i;
      game.events.push({ type: 'retarget', player: pl.id, input: pl.last, target: b.target });
      activity += 1;
    }
  }
  return activity;
}

function apply(game, pl, b, { amount, vec, pressed }, dt) {
  const P = game.pieces;
  const piece = b.target < 1000 ? P[b.target] : null;
  const panel = b.target >= 1000 ? game.panels[b.target - 1000] : null;
  const group = piece ? [...linked(game, piece.i)].map((i) => P[i]) : [];
  const motion = game.reduceMotion ? 0.5 : 1;
  if (piece) piece.held = Math.max(piece.held, amount);
  switch (b.verb) {
    case 'nudge':
      for (const p of group) {
        p.vx += vec[0] * 9 * dt;
        p.vy += vec[1] * 9 * dt;
      }
      break;
    case 'turn':
      for (const p of group) p.vrot += vec[0] * 5 * dt;
      break;
    case 'stretch': {
      const ax = Math.abs(vec[0]);
      const ay = Math.abs(vec[1]);
      piece.vsx += (ax - ay * 0.4) * 5 * dt;
      piece.vsy += (ay - ax * 0.4) * 5 * dt;
      break;
    }
    case 'drift':
      panel.vx += vec[0] * 6 * dt;
      panel.vy += vec[1] * 6 * dt;
      panel.vrot += vec[0] * 0.4 * dt;
      break;
    case 'herd':
      for (const p of P) if (p.kind === piece.kind) { p.vx += vec[0] * 7 * dt; p.vy += vec[1] * 7 * dt; }
      break;
    case 'swirl':
    case 'tide': {
      const pw = setupPower(game, b);
      const r = reach(game, b);
      const anchor = P[b.setup ? b.setup.anchor : b.target];
      if (b.verb === 'swirl') {
        let s = game.field.swirls.find((q) => q.owner === pl.id + b.input);
        if (!s) {
          s = { owner: pl.id + b.input, x: anchor.x, y: anchor.y, r, a: 0, va: 0 };
          game.field.swirls.push(s);
        }
        s.x = anchor.x;
        s.y = anchor.y;
        s.r += (r - s.r) * Math.min(1, dt * 3);
        // The stick's direction winds it: right or down winds clockwise.
        s.va += (vec[0] + vec[1] * 0.5) * (0.6 + pw * 2.6) * motion * dt * 4;
        if (pw >= AWAKE && Math.abs(s.a) > 2.4) rearrange(game, 'swirl', s);
      } else {
        game.field.tideV += vec[0] * (0.3 + pw * 2.2) * motion * dt * 3;
        for (const p of P) {
          const d = len(p.x - anchor.x, p.y - anchor.y);
          if (d < r) { p.vx += vec[0] * (1 - d / r) * (2 + pw * 6) * dt; p.vy += vec[1] * (1 - d / r) * (1 + pw * 3) * dt; }
        }
        if (pw >= AWAKE && Math.abs(game.field.tide) > 2.2) rearrange(game, 'tide', null);
      }
      break;
    }
    case 'fade':
      for (const p of group) p.alphaTo = 1 - amount * 0.85;
      break;
    case 'bloom':
      for (const p of group) p.vbloom += amount * 3 * dt;
      break;
    case 'bloom-kind':
      for (const p of P) if (p.kind === piece.kind || p.chain && p.chain === piece.chain) p.vbloom += amount * 2.6 * dt;
      break;
    case 'unfold':
      panel.flipTo = amount > 0.6 ? -1 : 1;
      break;
    case 'pour':
    case 'unravel': {
      const pw = setupPower(game, b);
      const anchor = P[b.setup ? b.setup.anchor : b.target];
      const f = game.field;
      const key = b.verb === 'pour' ? 'pour' : 'unravel';
      const cap = pw >= AWAKE ? 1 : 0.18 + pw * 0.35;
      f[key] += (Math.min(amount, cap) - f[key]) * Math.min(1, dt * 2);
      f[key + 'X'] = anchor.x;
      f[key + 'Y'] = anchor.y;
      if (pw >= AWAKE && amount > 0.95) {
        b.hold = (b.hold || 0) + dt;
        if (b.hold > 1.1) {
          b.hold = 0;
          shift(game, b.verb, anchor);
        }
      } else b.hold = 0;
      break;
    }
    case 'morph':
      if (pressed) for (const p of group) morphStep(game, p);
      break;
    case 'hop':
      if (pressed) for (const p of group) { p.vy -= 3.2; p.vrot += (game.random() - 0.5) * 2; }
      break;
    case 'stitch':
      if (pressed) {
        const free = P.filter((p) => p !== piece && !linked(game, piece.i).has(p.i)).sort((a, c) => len(a.x - piece.x, a.y - piece.y) - len(c.x - piece.x, c.y - piece.y));
        if (free[0] && len(free[0].x - piece.x, free[0].y - piece.y) < 6) {
          link(game, piece.i, free[0].i);
          free[0].vx += (piece.x - free[0].x) * 0.8;
          free[0].vy += (piece.y - free[0].y) * 0.8;
        } else piece.vbloom += 1.2;
      }
      break;
    case 'swap':
      if (pressed) {
        const others = P.filter((p) => p !== piece);
        const o = others.find((p) => p.kind === piece.kind) || others[Math.floor(game.random() * others.length)];
        if (o) {
          const h = piece.home;
          piece.home = o.home;
          o.home = h;
          game.rearranged += 1;
        }
      }
      break;
    case 'turn-over':
      if (pressed) panel.flipTo = -panel.flipTo;
      break;
    case 'pulse-kind':
      if (pressed) for (const p of P) if (p.kind === piece.kind || (p.chain && p.chain === piece.chain)) p.vbloom += 2.4;
      break;
    case 'scatter':
    case 'gather':
    case 'morph-all': {
      if (!pressed) break;
      const pw = setupPower(game, b);
      const anchor = P[b.setup ? b.setup.anchor : b.target];
      const r = reach(game, b);
      const kick = 2 + pw * 9;
      for (const p of P) {
        const dx = p.x - anchor.x;
        const dy = p.y - anchor.y;
        const d = len(dx, dy);
        if (d > r) continue;
        const f = 1 - d / r;
        if (b.verb === 'scatter') {
          p.vx += (dx / (d || 1)) * kick * f;
          p.vy += (dy / (d || 1)) * kick * f;
          p.vrot += (game.random() - 0.5) * 3 * f;
        } else if (b.verb === 'gather') {
          p.vx -= dx * 0.6 * f * (0.5 + pw);
          p.vy -= dy * 0.6 * f * (0.5 + pw);
        } else if (p.chain) morphStep(game, p);
      }
      if (pw >= AWAKE) rearrange(game, b.verb, anchor);
      break;
    }
    default:
      break;
  }
}

// Step a piece along its morph chain: piece -> stage 0 -> 1 -> ... -> piece.
export function morphStep(game, p) {
  if (!p.chain) {
    p.flipTo = -p.flipTo;
    return;
  }
  const stages = game.chains[p.chain] || [];
  if (!stages.length) {
    p.flipTo = -p.flipTo;
    return;
  }
  p.fromStage = p.stage;
  p.fromFile = null;
  p.stage = p.stage + 1 >= stages.length ? -1 : p.stage + 1;
  p.morph = 0;
  game.events.push({ type: 'morph', piece: p.i, stage: p.stage });
}

// A large effect that has woken leaves the picture rearranged: homes move to
// where the effect left the pieces, and the controls are dealt again in part.
export function rearrange(game, how, at) {
  if (game.cooldown && game.time < game.cooldown) return;
  game.cooldown = game.time + 4;
  const P = game.pieces;
  if (how === 'swirl' && at) {
    const a = Math.sign(at.a) * 0.9;
    for (const p of P) {
      const dx = p.home.x - at.x;
      const dy = p.home.y - at.y;
      const d = len(dx, dy);
      if (d > at.r) continue;
      const t = a * (1 - d / at.r);
      p.home = { ...p.home, x: clamp(at.x + dx * Math.cos(t) - dy * Math.sin(t), 0.5, W - 0.5), y: clamp(at.y + dx * Math.sin(t) + dy * Math.cos(t), 0.5, H - 0.5) };
    }
  } else if (how === 'tide') {
    const dir = Math.sign(game.field.tide) || 1;
    for (const p of P) p.home = { ...p.home, x: ((p.home.x + dir * 3 + W) % W) };
  } else if (how === 'scatter' || how === 'gather') {
    for (const p of P) p.home = { ...p.home, x: clamp(p.x + p.vx * 0.5, 0.6, W - 0.6), y: clamp(p.y + p.vy * 0.5, 0.6, H - 0.6) };
  }
  game.rearranged += 1;
  game.events.push({ type: 'rearrange', how });
  // Half the bindings are dealt anew, so there is something new to find.
  if (game.players.length) deal(game, Math.floor(game.random() * 1e9), 0.5);
}

function physics(game, dt) {
  const P = game.pieces;
  const motion = game.reduceMotion ? 0.6 : 1;
  for (const p of P) {
    // A gentle spring home: slow, so a moved piece stays moved for a while.
    const k = 0.55;
    const c = 1.6;
    p.vx += ((p.home.x - p.x) * k - p.vx * c) * dt;
    p.vy += ((p.home.y - p.y) * k - p.vy * c) * dt;
    p.x += p.vx * dt * motion;
    p.y += p.vy * dt * motion;
    p.vrot += (-p.rot * 1.2 - p.vrot * 2) * dt;
    p.rot += p.vrot * dt * motion;
    p.vsx += ((1 - p.sx) * 3 - p.vsx * 2.4) * dt;
    p.vsy += ((1 - p.sy) * 3 - p.vsy * 2.4) * dt;
    p.sx = clamp(p.sx + p.vsx * dt, 0.35, 2.6);
    p.sy = clamp(p.sy + p.vsy * dt, 0.35, 2.6);
    p.vbloom += (-p.bloom * 4 - p.vbloom * 3) * dt;
    p.bloom = clamp(p.bloom + p.vbloom * dt, -0.3, 1.6);
    p.alpha += (p.alphaTo - p.alpha) * Math.min(1, dt * 4);
    p.alphaTo += (1 - p.alphaTo) * Math.min(1, dt * 0.8);
    p.flip += (p.flipTo - p.flip) * Math.min(1, dt * 5);
    if (p.morph < 1) p.morph = Math.min(1, p.morph + dt / 1.1);
    p.x = clamp(p.x, -1, W + 1);
    p.y = clamp(p.y, -1, H + 1);
  }
  // Pieces of one chain that rest against each other sew themselves together.
  for (let i = 0; i < P.length; i++) {
    for (let j = i + 1; j < P.length; j++) {
      const a = P[i];
      const b = P[j];
      if (!a.chain || a.chain !== b.chain || a.links.has(j)) continue;
      // Only pieces a player has brought together, not neighbours at home.
      if (len(a.x - a.home.x, a.y - a.home.y) < 0.6 && len(b.x - b.home.x, b.y - b.home.y) < 0.6) continue;
      const d = len(a.x - b.x, a.y - b.y);
      const key = i * 64 + j;
      const slow = len(a.vx - b.vx, a.vy - b.vy) < 0.6;
      if (d < (radius(a) + radius(b)) * 0.7 && slow) {
        const t = (game.touching.get(key) || 0) + dt;
        game.touching.set(key, t);
        if (t > 0.8) { link(game, i, j); game.touching.delete(key); }
      } else game.touching.delete(key);
    }
  }
  // Left alone long enough, the threads are unpicked and everything goes home.
  if (game.quiet > 25 && P.some((p) => p.links.size)) {
    for (const p of P) { p.links.clear(); p.rest?.clear(); }
    game.events.push({ type: 'unpick' });
  }
  if (game.quiet > 40 && game.rearranged) {
    for (const p of P) p.home = { ...p.origin };
    game.rearranged = 0;
  }
  // Linked pieces keep near each other, like cloth sewn together.
  for (const a of P) {
    for (const j of a.links) {
      const b = P[j];
      const d = len(a.x - b.x, a.y - b.y);
      const rest = (a.rest?.get(j) ?? (radius(a) + radius(b)) * 0.8) * 1.15;
      if (d > rest) {
        const f = ((d - rest) / d) * 1.5 * dt;
        a.vx += (b.x - a.x) * f;
        a.vy += (b.y - a.y) * f;
      }
    }
  }
  for (const pn of game.panels) {
    pn.vx += (-pn.x * 0.8 - pn.vx * 1.8) * dt;
    pn.vy += (-pn.y * 0.8 - pn.vy * 1.8) * dt;
    pn.vrot += (-pn.rot * 1.2 - pn.vrot * 2) * dt;
    pn.x += pn.vx * dt * motion;
    pn.y += pn.vy * dt * motion;
    pn.rot += pn.vrot * dt * motion;
    pn.flip += (pn.flipTo - pn.flip) * Math.min(1, dt * 3);
    if (pn.flipTo < 0 && Math.abs(pn.flip + 1) < 0.02) pn.backTime = (pn.backTime || 0) + dt;
    if (pn.backTime > 6) { pn.flipTo = 1; pn.backTime = 0; }
  }
  const f = game.field;
  for (const s of f.swirls) {
    s.va += (-s.a * 0.9 - s.va * 1.4) * dt; // unwinds
    s.a += s.va * dt;
  }
  f.swirls = f.swirls.filter((s) => Math.abs(s.a) > 0.002 || Math.abs(s.va) > 0.002 || game.players.some((p) => s.owner.startsWith(p.id)));
  f.tideV += (-f.tide * 0.7 - f.tideV * 1.3) * dt;
  f.tide += f.tideV * dt;
  f.pour += (0 - f.pour) * Math.min(1, dt * 0.6);
  f.unravel += (0 - f.unravel) * Math.min(1, dt * 0.6);
  f.ripple = Math.min(1, f.ripple * 0.98 + Math.abs(f.tideV) * 0.02);
}

// For the hints: how close each player's large controls are to waking.
export function largeBindings(game) {
  const out = [];
  for (const pl of game.players) {
    for (const b of Object.values(pl.bindings)) {
      if (b.scale === 'large') out.push({ player: pl, binding: b, power: setupPower(game, b) });
    }
  }
  return out;
}

export function describe(game, b) {
  const target = b.target >= 1000 ? 'a panel of the picture' : pieceName(game.pieces[b.target]);
  const verb = VERB_TEXT[b.verb] || b.verb;
  if (b.verb === 'bloom-kind' || b.verb === 'pulse-kind') return `${verb} ${game.pieces[b.target]?.kind || 'piece'}`;
  return `${verb} ${target}`;
}

export function pieceName(p) {
  if (!p) return 'something';
  const names = { sun: 'the sun', moon: 'a moon', heart: 'a heart', tree: 'a tree', berries: 'the berries', bud: 'a bud', cloud: 'a cloud', bird: 'the bird', leaf: 'a leaf', face: 'a face', hair: 'her hair', body: 'her dress', house: 'the houses', diamond: 'a diamond', mountain: 'the mountains', band: 'the comet band', star: 'a star', figure: 'a figure', ribbon: 'a ribbon', fish: 'a fish', reeds: 'the reeds', eye: 'the eye', triangle: 'the pink silk', hand: 'the hand', flower: 'the flowers', panel: 'a block' };
  return names[p.kind] || 'a piece';
}
