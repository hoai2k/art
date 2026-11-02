// node --test stratford/prototype/game/test/audio.test.mjs
// The recorded sound effects (web/sfx, made by tools/sfx/generate.py) and the surface -> sound mapping.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SURFACE } from '../src/surface.js';
import { buildZones, bedGains, findWeirs, BEDS } from '../src/ambience-zones.js';
import { stepSound, squirrelStep, climbSound, landSound, splashSound, actionSound, createGrid, leafyAt, mainStreetPoints, distanceGain } from '../src/sfx-map.js';

const game = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(game, 'web');
const proto = join(game, '..');
const index = JSON.parse(readFileSync(join(web, 'sfx', 'index.json'), 'utf8'));
const cfg = JSON.parse(readFileSync(join(proto, 'tools', 'sfx', 'sfx.json'), 'utf8'));
const names = Object.keys(index).filter((k) => !k.startsWith('_'));

function pcm(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '44100', '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  assert.equal(r.status, 0, `ffmpeg decodes ${file}`);
  const a = new Int16Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 2));
  let sum = 0; let peak = 0; let hot = 0;
  for (const v of a) { const x = Math.abs(v) / 32768; sum += x * x; if (x > peak) peak = x; if (x > 0.985) hot++; }
  return { seconds: a.length / 44100, rms: Math.sqrt(sum / a.length), peak, hot: hot / a.length };
}

test('index.json: valid, levels and loops refer to listed sounds', () => {
  assert.ok(names.length > 0);
  for (const n of names) {
    assert.ok(Array.isArray(index[n]) && index[n].length > 0, n);
    for (const p of index[n]) assert.match(p, /^sfx\/[a-z0-9_]+-\d+\.mp3$/);
  }
  for (const k of Object.keys(index._levels)) { assert.ok(names.includes(k), k); assert.ok(index._levels[k] > 0 && index._levels[k] <= 1, k); }
  for (const n of names) assert.ok(n in index._levels, `${n} has a level`);
  for (const l of index._loops) assert.ok(names.includes(l), l);
});

test('index.json matches sfx.json: delivered sounds in, held loops and the library out', () => {
  for (const s of cfg.sounds) {
    if (s.library || s.hold) assert.ok(!(s.name in index), `${s.name} must not be loaded`);
    else assert.ok(s.name in index, `${s.name} is delivered`);
    if (s.library) for (let i = 1; i <= s.n; i++) assert.ok(existsSync(join(game, 'assets', 'sfx', 'library', `${s.name}-${i}.mp3`)), `library ${s.name}-${i}`);
  }
  assert.ok(cfg.sounds.filter((s) => s.library).length >= 30);
  assert.ok(cfg.sounds.filter((s) => s.library).every((s) => !s.loop || s.hold), 'library loops are held');
  assert.ok(!readdirSync(web).includes('library'));
});

test('web/sfx files: exist, small, sensible length, not silent, not clipped', () => {
  for (const n of names) {
    for (const p of index[n]) {
      const f = join(web, p);
      assert.ok(existsSync(f), `${p} exists`);
      assert.ok(statSync(f).size < 300 * 1024, `${p} under 300 KB`);
      const a = pcm(f);
      const loop = index._loops.includes(n);
      assert.ok(a.seconds >= 0.2 && a.seconds <= (loop ? 40 : 12), `${p} duration ${a.seconds.toFixed(2)} s`);
      assert.ok(a.rms > 0.002, `${p} is not silent (rms ${a.rms.toFixed(4)})`);
      assert.ok(a.peak < 0.995, `${p} peak ${a.peak.toFixed(3)}`);
      assert.ok(a.hot < 0.0005, `${p} is not clipped`);
    }
  }
});

test('short sounds are short: footsteps and clicks are not seconds of noise', () => {
  for (const n of names) {
    if (!/step|hop|click|ui_|nut_pickup|thump|land$/.test(n) || /water/.test(n)) continue;
    for (const p of index[n]) assert.ok(pcm(join(web, p)).seconds <= 1.6, `${p} is short`);
  }
});

test('footsteps follow the surface under the creature', () => {
  const S = SURFACE;
  assert.equal(squirrelStep(S.road), 'squirrel_step_pavement');
  assert.equal(squirrelStep(S.sidewalk, true), 'squirrel_step_pavement');
  assert.equal(squirrelStep(S.roof), 'squirrel_step_pavement');
  assert.equal(squirrelStep(S.grass, false), 'squirrel_step_grass');
  assert.equal(squirrelStep(S.grass, true), 'squirrel_step_leaves');
  assert.equal(squirrelStep(S.ground, true), 'squirrel_step_leaves');
  assert.equal(squirrelStep(S.bark), 'squirrel_climb_bark');
  assert.equal(squirrelStep(S.wall_brick), 'squirrel_climb_brick');
  assert.equal(climbSound(S.bark), 'squirrel_climb_bark');
  assert.equal(climbSound(S.branch), 'squirrel_climb_bark');
  assert.equal(climbSound(S.wall_brick), 'squirrel_climb_brick');
  assert.equal(climbSound(S.wall_stone), 'squirrel_climb_brick');
  assert.equal(stepSound('squirrel', S.sidewalk), 'squirrel_step_pavement');
  assert.equal(stepSound('capsule', S.grass, { leafy: true }), 'squirrel_step_leaves');
  for (const id of Object.values(S)) for (const leafy of [false, true]) assert.ok(String(squirrelStep(id, leafy)).startsWith('squirrel_'), `surface ${id}`);
});

test('creature-specific sounds', () => {
  const S = SURFACE;
  assert.equal(stepSound('beaver', S.grass), 'beaver_step');
  assert.equal(stepSound('rabbit', S.grass), 'rabbit_hop');
  assert.equal(stepSound('heron', S.ground, { inWater: true }), 'heron_wade');
  assert.equal(stepSound('swan', S.ground, { inWater: true }), 'swim_paddle');
  assert.equal(landSound('squirrel', S.road, { impact: 3 }), 'squirrel_land');
  assert.equal(landSound('squirrel', S.grass, { impact: 8, leafy: true }), 'leaf_pile_burst');
  assert.equal(landSound('swan', S.ground, { water: true }), null);
  assert.equal(splashSound('beaver', 0.5, 'dive'), 'dive');
  assert.equal(splashSound('beaver', 0.4, 'swim'), 'surface');
  assert.equal(splashSound('squirrel', 3, 'swim'), 'splash');
  assert.equal(splashSound('swan', 2, 'swim'), 'swan_land_water');
  assert.equal(splashSound('swan', 1, 'air'), null);
  assert.equal(actionSound('heron'), 'heron_call');
  assert.equal(actionSound('squirrel'), 'squirrel_dig');
  const known = new Set(names);
  for (const s of ['beaver_step', 'rabbit_hop', 'heron_wade', 'swim_paddle', 'leaf_pile_burst', 'dive', 'surface', 'swan_land_water', 'beaver_gnaw', 'rabbit_thump', 'swan_hiss', 'heron_call']) assert.ok(known.has(s), `${s} delivered`);
});

test('positional helpers: tree grid, leafy ground, main streets, distance falloff', () => {
  const trees = [{ x: 0, z: 0, crown: 4 }, { x: 200, z: 200, crown: 5 }];
  const g = createGrid(trees);
  assert.equal(g.near(0, 0, 10).length, 1);
  assert.equal(g.near(100, 100, 10).length, 0);
  assert.equal(g.near(190, 190, 30).length, 1);
  assert.ok(leafyAt(g, 2, 2));
  assert.ok(!leafyAt(g, 30, 0));
  const pts = mainStreetPoints([{ kind: 'primary', points: [[0, 0], [100, 0]] }, { kind: 'footway', points: [[0, 0], [10, 0]] }]);
  assert.ok(pts.length >= 6 && pts.every((p) => p.z === 0 && p.x < 100));
  assert.ok(distanceGain(5) === 1 && distanceGain(100) < distanceGain(50) && distanceGain(400) < 0.2);
});

// ---- ambient beds by area ---------------------------------------------------------------
const town = JSON.parse(readFileSync(join(game, 'data', 'town.json'), 'utf8'));
const zones = buildZones(town);
const top = (x, z, opts) => { const g = bedGains(zones.weights(x, z), opts); return Object.entries(g).sort((a, b) => b[1] - a[1])[0]?.[0]; };
const lm = (id) => town.landmarks.find((l) => l.id === id);

test('beds: the approved loops are in the index, the river flow is held', () => {
  for (const k of ['downtown', 'residential', 'park', 'busy', 'pond', 'weir', 'underwater']) assert.ok(names.includes(BEDS[k]), BEDS[k]);
  assert.ok(index.amb_downtown.length === 2 && index.amb_park_trees.length === 2, 'both takes kept as variants');
  assert.ok(!names.includes(BEDS.river), 'amb_river_flow waits for the owner');
  assert.ok(index._loops.includes('amb_weir'));
});

test('beds: zone lookup for known points', () => {
  const ms = lm('market-square'); const ch = lm('city-hall');
  assert.equal(top(ms.x, ms.z), 'downtown');
  assert.equal(top(ch.x, ch.z), 'downtown');
  assert.equal(top(380, -540), 'busy');            // Lake Victoria by Lakeside Drive, between the bridges
  assert.equal(top(1100, -700), 'busy');           // by the Festival Theatre lawns' shoreline
  assert.ok(zones.weights(882, -661).busy > 0.5);  // around Tom Patterson Island
  assert.equal(top(-30, -300), 'pond');            // the calmer lake near the dam
  const dam = findWeirs(town.water.polygons).filter((w) => w.strength > 0.9)[0];
  assert.ok(dam, 'the dam is found from the water levels');
  assert.ok(Math.abs(dam.a[0] + 112) < 2);
  assert.equal(top(-112, -305), 'weir');            // the Thomas Orr dam
  assert.ok(zones.weights(-112, -305).weir > 0.9 && zones.weights(0, 0).weir === 0);
  const res = town.buildings.filter((b) => b.use === 'residential').slice(0, 300)
    .filter((b) => { const w = zones.weights(b.outer[0][0], b.outer[0][1]); return w.residential > 0.4 && w.downtown < 0.3; });
  assert.ok(res.length > 100, 'residential streets are residential');
  const b0 = res[0]; assert.ok(['residential', 'park'].includes(top(b0.outer[0][0], b0.outer[0][1])));
  const sh = lm('shakespearean-gardens'); assert.ok(zones.weights(sh.x, sh.z).park > 0.4);
});

test('beds: at most three audible, under water only the underwater bed, zoom quietens, river uses the pond bed', () => {
  for (const [x, z] of [[0, 0], [380, -540], [-112, -305], [882, -661], [-300, 300]]) {
    const g = bedGains(zones.weights(x, z));
    assert.ok(Object.keys(g).length <= 3);
    assert.ok(Object.values(g).reduce((s, v) => s + v, 0) <= 1.0001);
  }
  assert.deepEqual(Object.keys(bedGains(zones.weights(0, 0), { underwater: true })), ['underwater']);
  const near = bedGains(zones.weights(0, 0), { zoom: 0 }).downtown; const far = bedGains(zones.weights(0, 0), { zoom: 1 }).downtown;
  assert.ok(far < near && far > 0.6 * near);
  const riv = { downtown: 0, residential: 0, park: 0, busy: 0, pond: 0, river: 1, weir: 0 };
  assert.ok(Math.abs(bedGains(riv).pond - 0.35) < 1e-9 && !('river' in bedGains(riv)));
  assert.ok('river' in bedGains(riv, { hasRiverFlow: true }));
});
