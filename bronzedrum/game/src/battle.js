import { precisionFactor } from './rhythm.js';

// Battle simulation. Pure and deterministic: the renderer reads the state and
// the events, it never changes them. Two clocks drive it: the army acts on the
// player's own beats (stepArmy, four per order), and the Han act on the steady
// beat of their war drum (stepEnemies, at the chapter's tempo). Times are
// seconds on the game clock.

export const ENEMY_TYPES = {
  target: { hp: 30, goal: true, faction: 'straw' },
  spear: { hp: 30, goal: false, faction: 'han' },
  crossbow: { hp: 20, goal: false, faction: 'han' },
  fort: { hp: 200, goal: true, faction: 'han' },
  // The first chapter's lesson in blocking: village children who lob stones.
  // A ghost is out of the fight: the army neither stops at it nor hits it.
  children: { hp: 1, goal: false, faction: 'village', ghost: true },
};

const MELEE_REACH = 3;
const ARCHER_REACH = 12;
const CONTACT_GAP = 1.5;
// A stronger march (tier II, III) that reaches the enemy line spends the
// ground it had left in a hit on the front enemy: this much per field unit
// left, times the march's power (at most about half a spear blow).
const MARCH_HIT = 2;
// Attacks travel: a Han blow is launched on his war drum and lands a moment
// later (seconds in flight), visible all the way. The guard (separate from
// the drum) raises a shield wall over the whole army: for `up` seconds, and
// in any case until every attack already in the air has landed, so raising
// it while an attack is visibly on its way always deflects it. Raising it
// with nothing incoming costs a longer recovery (`whiff`) than a real block.
export const FLIGHT = { spear: 0.7, crossbow: 0.9, fort: 1.1, children: 1.0 };
export const GUARD = { up: 0.5, recover: 0.1, whiff: 0.2 }; // quick to raise again: it is also the rhythm's clear
const SPEAR_HIT = 1.5; // every 2 Han beats in contact
const BOLT_VOLLEY = 1.5; // every 4 Han beats in range
const FORT_VOLLEY = 2.25;

export function createBattle(stage) {
  let id = 0;
  return {
    stage: stage.id,
    elephant: stage.elephant,
    army: { x: 0, troops: stage.troops, maxTroops: stage.troops },
    enemies: stage.enemies.map((e) => {
      const type = ENEMY_TYPES[e.type];
      const hp = e.hp ?? type.hp;
      return { id: id++, type: e.type, x: e.x, hp, maxHp: hp, goal: type.goal, cooldown: 0, alive: true };
    }),
    order: null, // { command, power, beat (0..3), u, tier }
    guardAt: -Infinity, // when the guard was last raised (seconds)
    guardUntil: -Infinity,
    guardReadyAt: 0,
    incoming: [], // attacks in flight: { from, kind, amount, launch, arrive }
    time: 0,
    tick: 0, // Han beats so far
    outcome: null, // 'won' | 'lost'
    survive: stage.survive || 0, // seconds to hold out, for a hold-the-line chapter
    nextId: id,
  };
}

/**
 * Power of a command: its evenness (accuracy 0..1 gives ×0.72..×1), its tier
 * (×1, ×1.4, ×1.96) and the drum's spirit (×1.5).
 */
export function commandPower(accuracy, spirit, tierPower = 1) {
  return precisionFactor(accuracy) * tierPower * (spirit ? 1.5 : 1);
}

/**
 * Slower drumming gives fewer orders per second while the Han keep their own
 * beat, so an order's power scales with the beat's length: the army does the
 * same work per second at any tempo. 0.6 s per beat (100 BPM) is ×1.
 */
export function tempoFactor(u) {
  return Math.min(2, Math.max(0.55, u / 0.6));
}

/** What a drummed command becomes: with the elephant, a strike on a waking drum is the charge. */
export function orderFor(state, command, spirit) {
  return command === 'strike' && spirit && state.elephant ? 'charge' : command;
}

/** Give the army an order for its next four beats; u is the player's beat length. */
export function issueOrder(state, command, power, u = 0.6, tier = 1) {
  state.order = { command, power, beat: 0, u, tier };
}

/** The living enemies the army fights (not the children). */
function living(state) {
  return state.enemies.filter((e) => e.alive && !ENEMY_TYPES[e.type].ghost);
}

/** Everyone on the field who acts on the war drum's beat, the children included. */
function actors(state) {
  return state.enemies.filter((e) => e.alive);
}

/** The nearest living enemy ahead of the army; the army cannot pass it. */
export function blocker(state) {
  let best = null;
  for (const e of living(state)) if (!best || e.x < best.x) best = e;
  return best;
}

/** Move the army up to dist, never through the nearest enemy; returns the ground left unused. */
function advance(state, dist) {
  const b = blocker(state);
  const limit = b ? b.x - CONTACT_GAP : Infinity;
  const from = state.army.x;
  state.army.x = Math.min(state.army.x + dist, Math.max(state.army.x, limit));
  return dist - (state.army.x - from);
}

function damage(state, enemy, amount, events, source) {
  const dealt = Math.min(enemy.hp, amount);
  enemy.hp -= dealt;
  events.push({ type: 'damage', target: enemy.id, amount: dealt, source, x: enemy.x });
  if (enemy.hp <= 0) {
    enemy.alive = false;
    events.push({ type: 'defeated', target: enemy.id, enemy: enemy.type, x: enemy.x });
  }
}

/** A Han blow leaves his hands; it lands FLIGHT seconds later. */
function launch(state, e, amount, events) {
  const attack = { from: e.id, kind: e.type, amount, launch: state.time, arrive: state.time + FLIGHT[e.type], x: e.x };
  state.incoming.push(attack);
  events.push({ type: 'launch', ...attack, to: state.army.x });
}

function hurtArmy(state, amount, events, source) {
  const dealt = amount;
  state.army.troops = Math.max(0, state.army.troops - dealt);
  events.push({ type: 'wound', amount: dealt, source });
}

function runOrder(state, events) {
  const o = state.order;
  if (!o) return;
  const p = o.power;
  const front = state.army.x;
  switch (o.command) {
    case 'march': {
      const b = blocker(state);
      const arriving = b && front < b.x - CONTACT_GAP - 1e-6; // not yet at the line
      const left = advance(state, 2 * o.power);
      // A stronger march crashes into the line as it arrives, with the ground it had left.
      if (arriving && o.tier >= 2 && left > 0.01) {
        damage(state, b, MARCH_HIT * left * p, events, 'march');
        events.push({ type: 'marchHit', target: b.id, x: b.x });
      }
      break;
    }
    case 'strike':
      if (o.beat === 1 || o.beat === 3) {
        const near = living(state).filter((e) => e.x - front <= MELEE_REACH + CONTACT_GAP);
        const melee = near.sort((a, b) => a.x - b.x)[0];
        if (melee) damage(state, melee, 12 * p, events, 'spear');
        const shot = blocker(state);
        if (shot && shot.x - front <= ARCHER_REACH) {
          events.push({ type: 'volley', from: front - 3, to: shot.x });
          damage(state, shot, 6 * p, events, 'arrow');
        }
      }
      break;
    case 'charge':
      // Not drummed directly: a strike with the drum awake and the elephant present.
      if (!state.elephant) break;
      if (o.beat < 3) advance(state, 2 * o.power);
      else {
        events.push({ type: 'trample', x: state.army.x });
        for (const e of living(state)) {
          if (e.x - state.army.x <= 5) damage(state, e, (e.type === 'fort' ? 60 : 30) * p, events, 'elephant');
        }
      }
      break;
  }
  o.beat += 1;
  if (o.beat >= 4) state.order = null;
}

function runEnemies(state, events) {
  const front = state.army.x;
  for (const e of actors(state)) {
    const dist = e.x - front;
    e.cooldown = Math.max(0, e.cooldown - 1);
    if (e.type === 'children' && e.fleeing) {
      // Off the way they came, and gone once out of sight.
      e.x += 1.6;
      if (dist > 26) {
        e.alive = false;
        events.push({ type: 'childrenGone', target: e.id });
      }
      continue;
    }
    const inReach =
      (e.type === 'children' && Math.abs(e.x - (front + e.standOff)) < 0.6) ||
      (e.type === 'spear' && dist <= CONTACT_GAP + 0.6) ||
      (e.type === 'crossbow' && dist <= 14) ||
      (e.type === 'fort' && dist <= 13);
    if (inReach && !e.engaged) {
      // A beat of wind-up before the first blow, so the warning shows.
      e.engaged = true;
      e.cooldown = Math.max(e.cooldown, 1);
      continue;
    }
    if (e.type === 'spear') {
      if (dist <= CONTACT_GAP + 0.6) {
        if (e.cooldown === 0) {
          launch(state, e, SPEAR_HIT, events);
          e.cooldown = 2;
        }
      } else if (dist <= 18) {
        const ahead = living(state).filter((o) => o !== e && o.x < e.x && o.x > front);
        const stop = ahead.length ? Math.max(...ahead.map((o) => o.x)) + 0.9 : front + CONTACT_GAP;
        e.x = Math.max(stop, e.x - 0.8);
      }
    } else if (e.type === 'children') {
      // Keep their distance ahead of the army (backing off as it marches),
      // then a stone every three beats (harmless).
      const stand = front + e.standOff;
      if (Math.abs(e.x - stand) >= 0.6) e.x += Math.max(-1.2, Math.min(1.2, stand - e.x));
      else if (e.cooldown === 0) {
        launch(state, e, 0, events);
        e.cooldown = 3;
      }
    } else if ((e.type === 'crossbow' && dist <= 14) || (e.type === 'fort' && dist <= 13)) {
      if (e.cooldown === 0) {
        launch(state, e, e.type === 'fort' ? FORT_VOLLEY : BOLT_VOLLEY, events);
        e.cooldown = 4;
      }
    }
  }
}

/** Raise the shield wall at time t. Returns false while the army is still recovering. */
export function guard(state, time) {
  if (state.outcome || time < state.guardReadyAt) return false;
  const inFlight = state.incoming.filter((a) => a.arrive >= time);
  state.guardAt = time;
  state.guardUntil = Math.max(time + GUARD.up, ...inFlight.map((a) => a.arrive + 0.05));
  state.guardReadyAt = state.guardUntil + (inFlight.length ? GUARD.recover : GUARD.whiff);
  return true;
}

/** Whether the shield wall is up at time t. */
export function shieldsUp(state, time = state.time) {
  return time >= state.guardAt && time <= state.guardUntil;
}

/** Land every attack that has arrived by time t: deflected if the shields are up. */
export function resolveIncoming(state, time) {
  const events = [];
  if (state.outcome) return events;
  state.time = Math.max(state.time, time);
  const landed = state.incoming.filter((a) => a.arrive <= time);
  state.incoming = state.incoming.filter((a) => a.arrive > time);
  for (const a of landed) {
    if (shieldsUp(state, a.arrive)) events.push({ type: 'deflect', ...a });
    else hurtArmy(state, a.amount, events, a.from);
  }
  checkOutcome(state, events);
  return events;
}

/** Han who will strike on their next beat: the warning the guard answers. */
export function aboutToAttack(state) {
  const front = state.army.x;
  return state.enemies.filter((e) => {
    if (!e.alive || e.cooldown > 1) return false;
    const dist = e.x - front;
    if (e.type === 'children') return !e.fleeing && Math.abs(e.x - (front + e.standOff)) < 0.6;
    if (e.type === 'spear') return dist <= CONTACT_GAP + 0.6;
    if (e.type === 'crossbow') return dist <= 14;
    if (e.type === 'fort') return dist <= 13;
    return false;
  });
}

/** Bring a new Han soldier onto the field (hold-the-line waves), dx ahead of the army. */
export function spawnEnemy(state, type, dx) {
  const t = ENEMY_TYPES[type];
  const e = { id: state.nextId++, type, x: state.army.x + dx, hp: t.hp, maxHp: t.hp, goal: false, cooldown: 0, alive: true };
  state.enemies.push(e);
  return e;
}

/**
 * The village children run in from dx ahead of the army and keep `stand`
 * ahead of it to throw (the first chapter's lesson in blocking).
 */
export function spawnChildren(state, dx = 16, stand = 6.5) {
  const out = [];
  for (const [k, off] of [[0, 0], [1, 1.1]]) {
    const e = spawnEnemy(state, 'children', dx + off);
    e.standOff = stand + off; // how far ahead of the army they stand
    e.child = k; // which child: 0 the boy, 1 the girl
    out.push(e);
  }
  return out;
}

/** The children have had enough: they turn and run off. */
export function dismissChildren(state) {
  for (const e of state.enemies) if (e.type === 'children' && e.alive) e.fleeing = true;
}

function checkOutcome(state, events) {
  if (state.outcome) return;
  if (state.survive) {
    if (state.army.troops <= 0) state.outcome = 'lost';
    else if (state.time >= state.survive) state.outcome = 'won';
  } else if (!state.hold && state.enemies.filter((e) => e.goal).every((e) => !e.alive)) state.outcome = 'won';
  else if (state.army.troops <= 0) state.outcome = 'lost';
  if (state.outcome) events.push({ type: 'outcome', outcome: state.outcome });
}

/** One of the army's beats, at the player's tempo. */
export function stepArmy(state, time = state.time) {
  const events = [];
  if (state.outcome) return events;
  state.time = Math.max(state.time, time);
  runOrder(state, events);
  checkOutcome(state, events);
  return events;
}

/** One beat of the Han war drum. */
export function stepEnemies(state, time = state.time) {
  const events = [];
  if (state.outcome) return events;
  state.time = Math.max(state.time, time);
  runEnemies(state, events);
  state.tick += 1;
  checkOutcome(state, events);
  return events;
}
