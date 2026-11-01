// The collage's rules, without a browser: dealing, setups, effects, scene changes.
//   node --test fibreart/game/test/*.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, addPlayer, step, setupPower, AWAKE, INPUTS, inputKind, link, shift, deal, W, H, reach } from '../src/collage.js';

const data = JSON.parse(readFileSync(new URL('../web/scenes.json', import.meta.url)));
const fresh = (seed = 7, scene = 0) => createGame(data.scenes, { chains: data.chains, seed, scene });
const idle = () => new Map();
const press = (id, ...buttons) => new Map([[id, { LS: [0, 0], RS: [0, 0], LT: 0, RT: 0, pressed: new Set(buttons), dpad: 0 }]]);
const hold = (id, name, value) => new Map([[id, { LS: [0, 0], RS: [0, 0], LT: 0, RT: 0, pressed: new Set(), dpad: 0, [name]: value }]]);

test('every scene has pieces with homes inside the picture and an image', () => {
  assert.equal(data.scenes.length, 10);
  for (const s of data.scenes) {
    assert.ok(s.pieces.length >= 5, s.key);
    for (const p of s.pieces) {
      assert.ok(p.home[0] > 0 && p.home[0] < 1 && p.home[1] > 0 && p.home[1] < 1, `${s.key} ${p.file}`);
      assert.ok(p.aspect > 0.05 && p.aspect < 10);
    }
  }
});

test('each player is dealt every input, one large control and a small one that sets it up', () => {
  for (let seed = 1; seed < 40; seed++) {
    const g = fresh(seed, seed % 10);
    addPlayer(g, 'pad0');
    addPlayer(g, 'pad1');
    for (const pl of g.players) {
      assert.deepEqual(Object.keys(pl.bindings).sort(), [...INPUTS].sort());
      const large = Object.values(pl.bindings).filter((b) => b.scale === 'large');
      assert.ok(large.length >= 1, `seed ${seed}: a large control`);
      const helper = Object.values(pl.bindings).find((b) => b.setsUp && pl.bindings[b.setsUp].scale === 'large');
      assert.ok(helper, `seed ${seed}: a small control sets up the large one`);
      assert.equal(helper.target, pl.bindings[helper.setsUp].setup.anchor);
      for (const b of Object.values(pl.bindings)) {
        assert.ok(['small', 'medium', 'large'].includes(b.scale));
        if (b.target < 1000) assert.ok(g.pieces[b.target], 'a real piece');
      }
    }
  }
});

test('the two players are mostly dealt different targets', () => {
  const g = fresh(3, 2);
  addPlayer(g, 'pad0');
  addPlayer(g, 'pad1');
  const a = new Set(Object.values(g.players[0].bindings).map((b) => b.target));
  const b = Object.values(g.players[1].bindings).map((x) => x.target);
  const shared = b.filter((t) => a.has(t)).length;
  assert.ok(shared < b.length, 'not all the same');
});

test('using a control finds it, once', () => {
  const g = fresh();
  const pl = addPlayer(g, 'pad0');
  step(g, 1 / 60, press('pad0', 'A'));
  assert.equal(pl.bindings.A.found, true);
  assert.equal(g.events.filter((e) => e.type === 'found').length, 1);
  step(g, 1 / 60, press('pad0', 'A'));
  assert.equal(g.events.filter((e) => e.type === 'found').length, 1);
});

test('a centre setup wakes as its anchor comes to the middle', () => {
  const g = fresh(5, 0);
  const pl = addPlayer(g, 'pad0');
  const b = { input: 'RT', scale: 'large', verb: 'pour', target: 0, setup: { type: 'centre', anchor: 0 } };
  pl.bindings.RT = b;
  const a = g.pieces[0];
  a.x = 1;
  a.y = 1;
  const far = setupPower(g, b);
  a.x = W / 2;
  a.y = H / 2;
  const near = setupPower(g, b);
  assert.ok(far < 0.5 && near >= AWAKE, `${far} -> ${near}`);
  assert.ok(reach(g, b) > 8, 'awake reaches most of the picture');
});

test('a link setup wakes when enough pieces are sewn to the anchor', () => {
  const g = fresh(5, 3);
  const b = { scale: 'large', setup: { type: 'link', anchor: 0, need: 2 } };
  assert.ok(setupPower(g, b) < AWAKE);
  link(g, 0, 1);
  link(g, 1, 2);
  assert.ok(setupPower(g, b) >= AWAKE);
});

test('pieces drift home when left alone', () => {
  const g = fresh(9, 1);
  const p = g.pieces[0];
  p.x += 3;
  for (let i = 0; i < 60 * 30; i++) step(g, 1 / 60, idle());
  assert.ok(Math.abs(p.x - p.home.x) < 0.1);
});

test('the finished picture shows through only when everything is home and still', () => {
  const g = fresh(9, 1);
  for (let i = 0; i < 60 * 12; i++) step(g, 1 / 60, idle());
  assert.ok(g.settled > 0.8, `settled ${g.settled}`);
  g.pieces[2].x += 2;
  for (let i = 0; i < 30; i++) step(g, 1 / 60, idle());
  assert.ok(g.settled < 0.5);
});

test('an awake pour held fully carries the picture into the next scene', () => {
  const g = fresh(11, 0);
  const pl = addPlayer(g, 'pad0');
  pl.bindings.RT = { input: 'RT', scale: 'large', verb: 'pour', target: 0, setup: { type: 'centre', anchor: 0 }, found: false, use: 0 };
  g.pieces[0].home = { x: W / 2, y: H / 2, rot: 0 };
  g.pieces[0].x = W / 2;
  g.pieces[0].y = H / 2;
  const before = g.index;
  for (let i = 0; i < 60 * 2; i++) step(g, 1 / 60, hold('pad0', 'RT', 1));
  assert.equal(g.index, (before + 1) % g.scenes.length);
  assert.ok(g.transition, 'dissolving from the old picture');
  assert.ok(g.events.some((e) => e.type === 'shift'));
});

test('an asleep pour only tints, it never changes the scene', () => {
  const g = fresh(11, 0);
  const pl = addPlayer(g, 'pad0');
  pl.bindings.RT = { input: 'RT', scale: 'large', verb: 'pour', target: 0, setup: { type: 'centre', anchor: 0 }, found: false, use: 0 };
  g.pieces[0].home = { x: 0.8, y: 0.8, rot: 0 };
  g.pieces[0].x = 0.8;
  g.pieces[0].y = 0.8;
  for (let i = 0; i < 60 * 3; i++) step(g, 1 / 60, hold('pad0', 'RT', 1));
  assert.equal(g.index, 0);
  assert.ok(g.field.pour < 0.4);
});

test('a scene change carries a chain piece across and deals new controls', () => {
  const g = fresh(13, 1); // Moons and hearts: moons and hearts on the moon chain
  addPlayer(g, 'pad0');
  const dealt = g.dealt;
  shift(g, 'pour');
  assert.equal(g.scene.key, 'golden-lady');
  assert.ok(g.dealt > dealt);
  for (let i = 0; i < 60 * 4; i++) step(g, 1 / 60, idle());
  assert.equal(g.transition, null);
});

test('a big swirl that has woken rearranges the homes and deals again', () => {
  const g = fresh(17, 0);
  const pl = addPlayer(g, 'pad0');
  pl.bindings.LS = { input: 'LS', scale: 'large', verb: 'swirl', target: 0, setup: { type: 'centre', anchor: 0 }, found: false, use: 0 };
  Object.assign(g.pieces[0], { x: W / 2, y: H / 2 });
  g.pieces[0].home = { x: W / 2, y: H / 2, rot: 0 };
  const homes = g.pieces.map((p) => ({ ...p.home }));
  const spin = new Map([['pad0', { LS: [1, 0], RS: [0, 0], LT: 0, RT: 0, pressed: new Set(), dpad: 0 }]]);
  for (let i = 0; i < 60 * 3 && !g.rearranged; i++) step(g, 1 / 60, spin);
  assert.ok(g.rearranged > 0, 'rearranged');
  assert.ok(g.pieces.some((p, i) => Math.hypot(p.home.x - homes[i].x, p.home.y - homes[i].y) > 0.3), 'homes moved');
});

test('the D-pad moves a small control to the next piece of the same kind', () => {
  const g = fresh(19, 8); // the crowd: many faces
  const pl = addPlayer(g, 'pad0');
  const face = g.pieces.find((p) => p.kind === 'face');
  pl.bindings.A = { input: 'A', scale: 'small', verb: 'hop', target: face.i, found: true, use: 1 };
  pl.last = 'A';
  step(g, 1 / 60, new Map([['pad0', { LS: [0, 0], RS: [0, 0], LT: 0, RT: 0, pressed: new Set(), dpad: 1 }]]));
  assert.notEqual(pl.bindings.A.target, face.i);
  assert.equal(g.pieces[pl.bindings.A.target].kind, 'face');
});

test('input kinds', () => {
  assert.equal(inputKind('LS'), 'stick');
  assert.equal(inputKind('RT'), 'trigger');
  assert.equal(inputKind('Y'), 'button');
  deal(fresh(), 1);
});
