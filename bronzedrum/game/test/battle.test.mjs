import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBattle, orderFor, spawnEnemy, issueOrder, stepArmy, stepEnemies, commandPower, blocker,
  guard, shieldsUp, aboutToAttack, GUARD, FLIGHT, tempoFactor, resolveIncoming,
} from '../src/battle.js';
import { STAGES } from '../src/stages.js';
import { dueWaves } from '../src/modes.js';
import { COMMANDS, TIER_POWER } from '../src/rhythm.js';

const stage = (id) => STAGES.find((s) => s.id === id);

/** One four-beat order at u seconds per beat, starting at the battle's clock. */
function order(state, command, power = 1, u = 0.6, tier = 1) {
  issueOrder(state, command, power, u, tier);
  const t0 = state.time;
  const events = [];
  for (let k = 0; k < 4; k++) events.push(...stepArmy(state, t0 + k * u));
  return events;
}

const BATTLES = STAGES.filter((s) => !s.mode || s.mode === 'battle');

test('battle chapters only unlock known commands, have a goal and a tier cap', () => {
  const ids = new Set(COMMANDS.map((c) => c.id));
  for (const s of BATTLES) {
    for (const c of s.unlocked) assert.ok(ids.has(c), `${s.id}: ${c}`);
    assert.ok(s.maxTier >= 1 && s.maxTier <= 3, s.id);
    assert.ok(s.survive || createBattle(s).enemies.some((e) => e.goal), s.id);
    assert.deepEqual(s.unlocked, ['march', 'strike'], `${s.id}: two families`);
  }
});

test('march advances but never through the nearest enemy', () => {
  const b = createBattle(stage('garden'));
  order(b, 'march', 0.5);
  assert.equal(b.army.x, 4);
  order(b, 'march');
  assert.equal(b.army.x, 9 - 1.5);
});

test('a stronger march crashes into the line with the ground it had left, once, as it arrives', () => {
  const first = (b) => blocker(b);
  // Tier II from 6 units short of the line (the first target at 9, the line at 7.5).
  const strong = createBattle(stage('garden'));
  strong.army.x = 1.5;
  const hp = first(strong).hp;
  const ev = order(strong, 'march', TIER_POWER[1], 0.6, 2);
  assert.equal(strong.army.x, 9 - 1.5, 'at the line');
  const hits = ev.filter((e) => e.type === 'marchHit');
  assert.equal(hits.length, 1, 'one hit, on arrival');
  const dealt = hp - first(strong).hp;
  assert.ok(dealt > 0 && dealt < 12 * TIER_POWER[1], `a small hit (${dealt}), less than a spear blow`);
  // A plain march arriving the same way does no harm.
  const plain = createBattle(stage('garden'));
  plain.army.x = 3.5;
  const evPlain = order(plain, 'march', 1, 0.6, 1);
  assert.equal(plain.army.x, 9 - 1.5);
  assert.ok(!evPlain.some((e) => e.type === 'marchHit' || e.type === 'damage'));
  // Already at the line: nothing to crash with.
  const again = order(strong, 'march', TIER_POWER[1], 0.6, 2);
  assert.ok(!again.some((e) => e.type === 'marchHit'));
});

test('stronger tiers and the waking drum raise power', () => {
  assert.ok(commandPower(1, false, TIER_POWER[2]) > commandPower(1, false, TIER_POWER[1]));
  assert.ok(commandPower(1, false, TIER_POWER[1]) > commandPower(1, false, TIER_POWER[0]));
  assert.ok(commandPower(1, true) > commandPower(1, false));
  const weak = createBattle(stage('garden'));
  const strong = createBattle(stage('garden'));
  weak.army.x = strong.army.x = 7;
  weak.enemies[0].hp = strong.enemies[0].hp = 1000;
  order(weak, 'strike', commandPower(1, false, TIER_POWER[0]));
  order(strong, 'strike', commandPower(1, false, TIER_POWER[2]));
  assert.ok(strong.enemies[0].hp < weak.enemies[0].hp);
});

test('the Han wind up for a beat before their first blow, and show it', () => {
  const b = createBattle(stage('outpost'));
  b.army.x = 18; // the first crossbow (x 20) is in range
  for (const e of b.enemies) if (e.type === 'spear') e.alive = false;
  const first = stepEnemies(b, 0.6);
  assert.ok(!first.some((e) => e.type === 'launch'), 'nothing loosed on the beat they engage');
  assert.ok(aboutToAttack(b).length > 0, 'the warning shows');
  assert.ok(stepEnemies(b, 1.2).some((e) => e.type === 'launch'));
});

/** An outpost where only the first crossbow is in play; it has wound up and looses at t = 1.2. */
function windup() {
  const b = createBattle(stage('outpost'));
  b.army.x = 18;
  for (const e of b.enemies) if (e.type === 'spear') e.alive = false;
  stepEnemies(b, 0.6);
  return b;
}
const lost = (b) => b.army.maxTroops - b.army.troops;

test('attacks travel: launched on the Han beat, they land a moment later', () => {
  const b = windup();
  const ev = stepEnemies(b, 1.2);
  const launch = ev.find((e) => e.type === 'launch');
  assert.ok(launch, 'the bolts leave');
  assert.ok(Math.abs(launch.arrive - (1.2 + FLIGHT.crossbow)) < 1e-9);
  assert.equal(lost(b), 0, 'nothing lands at launch');
  assert.equal(resolveIncoming(b, launch.arrive - 0.01).length, 0);
  assert.ok(resolveIncoming(b, launch.arrive).some((e) => e.type === 'wound'));
  assert.ok(lost(b) > 0);
});

test('a shield raised while the attack is in the air deflects it', () => {
  for (const delay of [0.05, 0.4, FLIGHT.crossbow - 0.05]) {
    const b = windup();
    stepEnemies(b, 1.2);
    assert.ok(guard(b, 1.2 + delay));
    const ev = resolveIncoming(b, 1.2 + FLIGHT.crossbow);
    assert.ok(ev.some((e) => e.type === 'deflect'), `raised ${delay}s after launch`);
    assert.equal(lost(b), 0);
  }
});

test('a shield raised too early has dropped again when the blow lands', () => {
  const b = windup();
  guard(b, 0.6);
  stepEnemies(b, 1.2);
  assert.ok(!shieldsUp(b, 1.2 + FLIGHT.crossbow));
  assert.ok(resolveIncoming(b, 1.2 + FLIGHT.crossbow).some((e) => e.type === 'wound'));
});

test('raising the shield with nothing coming costs a longer recovery', () => {
  const idle = createBattle(stage('outpost'));
  assert.ok(guard(idle, 1));
  assert.ok(!guard(idle, 1 + GUARD.up + GUARD.recover + 0.01), 'a whiff takes longer to recover');
  assert.ok(guard(idle, 1 + GUARD.up + GUARD.whiff));
  const b = windup();
  stepEnemies(b, 1.2);
  assert.ok(guard(b, 1.3));
  const landed = 1.2 + FLIGHT.crossbow + 0.05;
  assert.ok(shieldsUp(b, landed - 0.01), 'the wall stays up until the bolts land');
  assert.ok(guard(b, landed + GUARD.recover), 'a real block recovers quickly');
});

test('the shield is separate from the drum: it does not touch the army’s order', () => {
  const b = createBattle(stage('outpost'));
  issueOrder(b, 'march', 1, 0.6);
  stepArmy(b, 0);
  const before = { ...b.order };
  assert.ok(guard(b, 0.1));
  assert.deepEqual(b.order, before);
  stepArmy(b, 0.6);
  assert.equal(b.order.beat, 2, 'the march carries on');
});

test('idling under fire loses the battle', () => {
  const b = createBattle(stage('outpost'));
  b.army.x = 22;
  for (let i = 1; i < 2000 && !b.outcome; i++) {
    stepEnemies(b, i * 0.6);
    resolveIncoming(b, i * 0.6);
  }
  assert.equal(b.outcome, 'lost');
});

test('with the elephant, a strike on a waking drum becomes the charge', () => {
  const elephant = createBattle(stage('luylau'));
  const foot = createBattle(stage('outpost'));
  assert.equal(orderFor(elephant, 'strike', true), 'charge');
  assert.equal(orderFor(elephant, 'strike', false), 'strike');
  assert.equal(orderFor(elephant, 'march', true), 'march');
  assert.equal(orderFor(foot, 'strike', true), 'strike');
  assert.ok(order(elephant, 'charge').some((e) => e.type === 'trample'));
});

/**
 * A player at u seconds per beat: drums a phrase (4u) while the Han act on
 * their own drum, then the army answers for 4u, then the next phrase starts
 * at once. tier picks the rhythm tier, accuracy its evenness; guarding=true
 * raises the guard whenever a "!" shows (if recovered).
 */
function playChapter(s, { u = 0.6, tier = 1, accuracy = 1, guarding = null } = {}) {
  const b = createBattle(s);
  const han = 60 / s.bpm;
  let nextHan = 1;
  let t = 0;
  let combo = 0;
  let last = null;
  const spawned = new Set();
  const advance = (until) => {
    for (const w of dueWaves(s.waves || [], until, spawned)) for (const e of w.enemies) spawnEnemy(b, e.type, e.dx);
    while (nextHan * han <= until && !b.outcome) {
      const at = nextHan * han;
      const launched = stepEnemies(b, at).filter((e) => e.type === 'launch');
      // A guarding player raises the shield this long after a blow is loosed.
      if (guarding !== null && launched.length) guard(b, at + guarding);
      nextHan += 1;
      resolveIncoming(b, Math.min(until, nextHan * han));
    }
    resolveIncoming(b, until);
  };
  for (let cycle = 0; cycle < 200 && !b.outcome; cycle++) {
    const spirit = accuracy === 1 && combo >= 4;
    const front = blocker(b);
    const dist = front ? front.x - b.army.x : 99;
    const has = (c) => s.unlocked.includes(c);
    let cmd = dist <= 4.6 ? 'strike' : 'march';
    if (cmd === 'strike') cmd = orderFor(b, 'strike', spirit);
    const useTier = Math.min(tier, s.maxTier);
    advance(t + 4 * u); // drumming the phrase
    t += 4 * u;
    issueOrder(b, cmd, commandPower(accuracy, spirit, TIER_POWER[useTier - 1]) * tempoFactor(u), u);
    for (let k = 0; k < 4 && !b.outcome; k++) {
      advance(t + k * u);
      stepArmy(b, t + k * u);
    }
    advance(t + 4 * u);
    t += 4 * u;
    combo = cmd === 'charge' ? 0 : combo + 1;
    last = cmd;
  }
  return b;
}

test('a steady drummer playing only tier I and shielding wins every chapter', () => {
  for (const s of BATTLES) {
    const b = playChapter(s, { tier: 1, guarding: 0.3 });
    assert.equal(b.outcome, 'won', s.id);
    assert.ok(b.army.troops >= b.army.maxTroops * 0.2, `${s.id}: ${b.army.troops.toFixed(1)} left`);
  }
});

test('harder rhythms and the shield make it easier', () => {
  for (const s of BATTLES.filter((x) => x.id !== 'garden' && !x.survive)) {
    const plain = playChapter(s, { tier: 1, guarding: 0.3 });
    const fancy = playChapter(s, { tier: 3, guarding: 0.3 });
    const none = playChapter(s, { tier: 1 });
    assert.ok(fancy.time < plain.time, `${s.id}: harder tiers win faster`);
    assert.ok(plain.army.troops > none.army.troops, `${s.id}: shielding helps`);
  }
});

test('slow or fast, sloppy drumming still clears the first two chapters', () => {
  for (const u of [0.4, 0.9]) {
    for (const s of [stage('garden'), stage('outpost')]) assert.equal(playChapter(s, { u, accuracy: 0, guarding: 0.3 }).outcome, 'won', `${s.id} at ${u}`);
  }
});

test('holding the ford: won by surviving the time, lost if the army breaks', () => {
  const s = stage('mavien');
  const held = playChapter(s, { tier: 2, guarding: 0.3 });
  assert.equal(held.outcome, 'won');
  assert.ok(held.time >= s.survive);
  assert.ok(held.enemies.length > s.enemies.length, 'the waves arrived');
  const idle = createBattle(s);
  for (let i = 1; i < 400 && !idle.outcome; i++) {
    for (const e of [{ type: 'crossbow', dx: 10 }]) if (i % 10 === 0) spawnEnemy(idle, e.type, e.dx);
    stepEnemies(idle, i * 0.6);
    resolveIncoming(idle, i * 0.6);
  }
  assert.equal(idle.outcome, 'lost', 'standing still under fire loses before the time is up');
});

test('the village children run in, lob harmless stones that a block deflects, never stop the army, and run off when dismissed', async () => {
  const B = await import('../src/battle.js');
  const { STAGES } = await import('../src/stages.js');
  const s = B.createBattle(STAGES[0]);
  const kids = B.spawnChildren(s, 16, 6.5);
  assert.equal(kids.length, 2);
  const troops = s.army.troops;
  const events = [];
  let time = 0;
  const beat = 0.65;
  const step = () => {
    time += beat;
    events.push(...B.stepEnemies(s, time), ...B.resolveIncoming(s, time));
  };
  for (let i = 0; i < 12; i++) step();
  assert.ok(kids.every((k) => Math.abs(k.x - (s.army.x + k.standOff)) < 0.6), 'at their places');
  const stones = events.filter((e) => e.type === 'launch' && e.kind === 'children');
  assert.ok(stones.length >= 2, 'stones thrown');
  assert.equal(s.army.troops, troops, 'stones do no harm');
  // Blocking while a stone is in the air deflects it.
  let deflected = 0;
  for (let i = 0; i < 12; i++) {
    if (s.incoming.length) B.guard(s, time);
    step();
    deflected = events.filter((e) => e.type === 'deflect' && e.kind === 'children').length;
    if (deflected) break;
  }
  assert.ok(deflected >= 1, 'a stone blocked');
  // They are out of the fight: a march passes them, a strike does not touch them.
  B.issueOrder(s, 'march', 2);
  for (let k = 0; k < 4; k++) B.stepArmy(s, time);
  assert.ok(s.army.x > 0 && s.army.x < STAGES[0].enemies[0].x, 'the army moves on, up to the first target');
  B.issueOrder(s, 'strike', 3);
  for (let k = 0; k < 4; k++) B.stepArmy(s, time);
  assert.ok(kids.every((k) => k.alive && k.hp === 1), 'untouched');
  // As the army moves on they keep their distance ahead of it.
  for (let i = 0; i < 6; i++) step();
  assert.ok(kids.every((k) => k.x > s.army.x + 5), 'still ahead of the army');
  // Dismissed, they run off and are gone.
  B.dismissChildren(s);
  for (let i = 0; i < 30; i++) step();
  assert.ok(kids.every((k) => !k.alive));
  assert.ok(events.some((e) => e.type === 'childrenGone'));
  assert.equal(s.outcome, null, 'the chapter goes on');
});

test('a held battle is not won with every target down until the hold is released', async () => {
  const B = await import('../src/battle.js');
  const { STAGES } = await import('../src/stages.js');
  const s = B.createBattle(STAGES[0]);
  s.hold = true;
  for (const e of s.enemies) if (e.goal) e.alive = false;
  B.stepEnemies(s, 0.65);
  assert.equal(s.outcome, null, 'held open');
  s.hold = false;
  const events = B.stepEnemies(s, 1.3);
  assert.equal(s.outcome, 'won');
  assert.ok(events.some((e) => e.type === 'outcome'));
});
