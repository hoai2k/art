// The eastern cottontail (Sylvilagus floridanus): hopping gaits from a slow hop (hind feet landing
// ahead of the fore feet) to a stretched full-speed bound, very quick turns and zig-zags, big
// jumps with A, no climbing; a poor swimmer: a short paddle, then it heads for the bank and climbs
// out. X sits up tall; Y scrabbles. Model: tools/squirrel/build.py --creature rabbit.
import { creatureTuning, makeCreature, makeCamera } from '../creatures/creature.js';
import { createQuadAnimator } from '../creatures/animators.js';

export const KIND = 'rabbit';
export const SCALE = 0.4;

export const rabbitTuning = (scale = SCALE) => creatureTuning(scale, {
  radius: 0.15 * scale, capsuleBack: 0.25 * scale, capsuleFront: 0.25 * scale,
  runSpeed: 3.5, sprintSpeed: 11, accel: 34, decel: 34, brake: 50,
  turnR0: 0.08 * scale, turnK: 0.012, turnMax: 18,          // zig-zags
  stepUp: 0.75 * scale, jumpHeight: 2.0 * scale, gravity: 20, airAccel: 6,
  swimSpeed: 0.45, swimDepth: 0.22 * scale, swimTire: 3,
  camDistance: 3.0 * scale, camHeight: 0.5 * scale, camProbe: 0.18 * scale,
});

export const createCreature = (opts = {}) => makeCreature({
  kind: KIND, tuning: rabbitTuning(), eyeHeight: 0.15, canFly: false, coat: opts.coat, model: opts.model !== false,
  animator: (m, T) => createQuadAnimator(m, T, { style: 'hop' }), shells: 5, strands: 900,
});
export const createCamera = (opts) => makeCamera(opts);
