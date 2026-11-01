import assert from 'node:assert/strict';
import { WALK_PHASES, walkPhase, walkPose, walkFrame, walkStep, walkFrameFromSwing } from '../src/walking.js';
import { whalePose, housePose } from '../src/acts/sailor-motion.js';
import { readFileSync, existsSync } from 'node:fs';

const poses = ['walk-a', 'pass-a', 'walk-b', 'pass-b'];
for (let phase = 0; phase < 4; phase++) {
  const travel = phase * 19 + 1;
  assert.equal(walkPose(travel), poses[phase]);
  assert.equal(walkPose(travel + 76), poses[phase], 'cycle repeats without skipping passing');
  assert.equal(walkFrame('prince-court', travel), 'prince-court-' + poses[phase]);
  assert.equal(walkFrame('sailor-carry', travel), 'sailor-carry-' + poses[phase]);
  assert.equal(walkStep(travel), [1, 0, -1, 0][phase]);
  assert.equal(whalePose({ on: 'bank', vx: 60, walk: travel, landT: 0 }, 'play'), poses[phase]);
}
assert.equal(walkPhase(-1), 3, 'negative positions wrap to a valid phase');
assert.equal(walkPose(Number.NaN), 'walk-a');
assert.throws(() => walkPose(1, 0), RangeError);
assert.throws(() => walkPose(1, Infinity), RangeError);
assert.equal(walkFrameFromSwing('sailor', 0), 'sailor-pass-a');
assert.equal(walkFrameFromSwing('sailor', 1), 'sailor-walk-a');
assert.equal(walkFrameFromSwing('sailor', -1), 'sailor-walk-b');
assert.equal(whalePose({ on: 'bank', vx: 0, walk: 19 }, 'play'), 'stand');
assert.equal(whalePose({ on: null, vy: 150, walk: 19 }, 'play'), 'apex');   // a jump coming down
assert.equal(whalePose({ on: null, vy: 1100, walk: 19 }, 'play'), 'fall');  // a long drop
const stair = { p: { conn: { c: { kind: 'stairs', a: { x: 0, f: 0 }, b: { x: 104, f: 0 } }, u: 0 } } };
for (let phase = 0; phase < 4; phase++) {
  stair.p.conn.u = (phase * 13 + 1) / 104;
  assert.equal(housePose(stair, [100]), 'stairs-' + poses[phase].replace('walk-', ''));
  assert.equal(housePose(stair, [100]), housePose(stair, [100]), 'paused stair travel holds its pose');
}
console.log('Walking contacts, both passing phases, direction, carry naming, stairs and idle/airborne separation pass');
const slots = JSON.parse(readFileSync(new URL('../assets/manifest.json', import.meta.url))).slots;
for (const [prefix, looks, contact] of [
  ['prince', ['', '-tinted'], 'stride'], ['prince-court', ['', '-tinted'], 'stride'],
  ['azurine', ['', '-tinted'], 'walk'], ['sailor', [''], 'stride'],
  ['prince-carry', ['', '-tinted'], 'walk'], ['sailor-carry', [''], 'walk'],
]) for (const look of looks) for (const pose of WALK_PHASES) {
  const id = `${prefix}-${pose.replace('walk', contact)}${look}`;
  assert.equal(slots[id]?.status, 'delivered', id + ' must exist for a complete walking cycle');
  assert.ok(existsSync(new URL('../assets/' + slots[id].file, import.meta.url)), id);
  if (prefix.startsWith('sailor')) {
    assert.notEqual(slots[id].edition, 'film', 'shared sailor phases must load in the older editions');
  }
}
console.log('Every walking character/look has complete delivered contact and passing frames');
const deliveries = JSON.parse(readFileSync(new URL('../design/generated/film-production/deliveries.json', import.meta.url))).images;
for (const record of deliveries.filter(record => record.install_as && !record.superseded_by)) {
  assert.ok(readFileSync(new URL('../' + record.installed_file, import.meta.url)).equals(
    readFileSync(new URL('../' + record.file, import.meta.url))), record.id + ' must replace its runtime filename');
  const earlier = deliveries.find(earlier => earlier.id === record.install_as);
  assert.equal(earlier.superseded_by, record.id);
  assert.ok(existsSync(new URL('../' + earlier.file, import.meta.url)), 'superseded frame remains archived');
}
console.log('Delivered stride repairs are installed and superseded frames remain available');
