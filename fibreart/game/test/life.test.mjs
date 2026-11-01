// Life in the pictures: wind, gusts, loose leaves, and each kind of piece's
// small motion. It only changes how pieces are drawn, never where they are.
//   node --test fibreart/game/test/*.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, step, W } from '../src/collage.js';
import { life, updateLife, windAt, gustNow, groundRipple, SCENE_LIFE } from '../src/life.js';

const data = JSON.parse(readFileSync(new URL('../web/scenes.json', import.meta.url)));
const at = (key, seed = 3) => createGame(data.scenes, { chains: data.chains, seed, scene: data.scenes.findIndex((s) => s.key === key) });
const run = (g, seconds) => {
  for (let i = 0; i < seconds * 60; i++) {
    step(g, 1 / 60, new Map());
    updateLife(g, 1 / 60);
  }
};

test('every scene has a life entry', () => {
  for (const s of data.scenes) assert.ok(SCENE_LIFE[s.key], s.key);
});

test('gusts sweep across the windy scenes and pass', () => {
  const g = at('viriditas');
  let peak = 0;
  for (let i = 0; i < 60 * 30; i++) {
    step(g, 1 / 60, new Map());
    updateLife(g, 1 / 60);
    peak = Math.max(peak, gustNow(g));
  }
  assert.ok(peak > 0.5, `a gust came (${peak.toFixed(2)})`);
  assert.ok(g.wind.gusts.every((q) => q.front < W + 8));
});

test('the wind blows left to right and stays in bounds', () => {
  const g = at('viriditas');
  run(g, 20);
  for (let x = 0; x <= W; x += 2) {
    const w = windAt(g, x, 4);
    assert.ok(w > -0.2 && w < 3, `${x}: ${w}`);
  }
});

test('leaves blow across the windy scenes and leave again', () => {
  const g = at('man-and-woman');
  let most = 0;
  for (let i = 0; i < 60 * 40; i++) {
    step(g, 1 / 60, new Map());
    updateLife(g, 1 / 60);
    most = Math.max(most, g.drift.length);
  }
  assert.ok(most > 0, 'some leaves blew');
  assert.ok(g.drift.length <= 14);
  for (const d of g.drift) assert.ok(Number.isFinite(d.x) && Number.isFinite(d.y));
});

test('no leaves blow in the night quilt, and none with reduced motion', () => {
  const g = at('night-quilt');
  run(g, 30);
  assert.equal(g.drift.length, 0);
  const v = at('viriditas');
  for (let i = 0; i < 60 * 30; i++) {
    step(v, 1 / 60, new Map());
    updateLife(v, 1 / 60, 0.3);
  }
  assert.equal(v.drift.length, 0);
});

test('every piece of every scene moves only a little, and never where it is', () => {
  for (const s of data.scenes) {
    const g = at(s.key);
    run(g, 4);
    for (const p of g.pieces) {
      const before = { x: p.x, y: p.y, rot: p.rot };
      for (let t = 0; t < 20; t += 0.37) {
        g.time = t;
        const L = life(g, p);
        for (const k of ['dx', 'dy', 'drot', 'sway']) assert.ok(Number.isFinite(L[k]), `${s.key} ${p.kind} ${k}`);
        assert.ok(Math.abs(L.dx) < 0.6 && Math.abs(L.dy) < 0.4, `${s.key} ${p.kind} offset`);
        assert.ok(Math.abs(L.drot) < 0.25, `${s.key} ${p.kind} turn`);
        assert.ok(Math.abs(L.sway) < p.h * 0.35 + 0.1, `${s.key} ${p.kind} sway`);
        assert.ok(L.sx > 0.9 && L.sx < 1.12 && L.sy > 0.05 && L.sy < 1.12, `${s.key} ${p.kind} scale`);
      }
      assert.deepEqual({ x: p.x, y: p.y, rot: p.rot }, before, 'life does not move the piece itself');
    }
  }
});

test('trees bend more in a gust than in the breeze', () => {
  const g = at('viriditas');
  const tree = g.pieces.find((p) => p.kind === 'tree');
  g.wind = { scene: g.index, gusts: [], next: 99 };
  const calm = Math.abs(life(g, tree).sway);
  g.wind.gusts.push({ front: tree.x, speed: 0, width: 3, strength: 1, age: 2 });
  const gust = Math.abs(life(g, tree).sway);
  assert.ok(gust > calm * 2, `${calm} -> ${gust}`);
});

test('the floating eye blinks now and then', () => {
  const g = at('crowd');
  const eye = g.pieces.find((p) => p.kind === 'eye');
  let shut = 0;
  for (let t = 0; t < 30; t += 0.02) {
    g.time = t;
    if (life(g, eye).sy < 0.5) shut++;
  }
  assert.ok(shut > 3 && shut < 200, `${shut} frames shut`);
});

test('a delivered blink swaps a face in now and then', () => {
  const g = at('golden-lady');
  const face = g.pieces.find((p) => p.kind === 'face');
  face.blink = 'anim/blink-golden-lady-1.webp';
  let swaps = 0;
  for (let t = 0; t < 30; t += 0.02) {
    g.time = t;
    if (life(g, face).swap === 0) swaps++;
  }
  assert.ok(swaps > 3 && swaps < 200);
});

test('reduced motion shrinks every movement', () => {
  const g = at('dancers');
  const fig = g.pieces.find((p) => p.kind === 'figure');
  g.time = 2.1;
  const full = life(g, fig, 1);
  const calm = life(g, fig, 0.3);
  assert.ok(Math.abs(calm.sway) <= Math.abs(full.sway) * 0.31 + 1e-9);
  assert.ok(groundRipple(at('blue-lady'), 0.3) < groundRipple(at('blue-lady'), 1));
});

test('a bird with delivered poses flaps and later ruffles', () => {
  const g = at('viriditas');
  const bird = g.pieces.find((p) => p.kind === 'bird');
  bird.poses = ['a', 'b', 'c'];
  const seen = new Set();
  for (let t = 0; t < 12; t += 0.01) {
    g.time = t;
    const s = life(g, bird).swap;
    if (s >= 0) seen.add(s);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2]);
});
