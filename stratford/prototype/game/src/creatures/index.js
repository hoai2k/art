// The creature registry (ARCHITECTURE.md, "Many creatures, many scales"). Each entry loads a module
// exporting createCreature(opts) -> the squirrel contract + { kind, scale, eyeHeight, climbs, canFly }
// and createCamera({ THREE, camera, creature, world }). The shell picks one by name (default
// 'squirrel'); the generic controller and camera live beside this file (controller.js, camera.js).
export const CREATURES = {
  squirrel: () => import('../squirrel/index.js'),
  beaver: () => import('../beaver/index.js'),
  rabbit: () => import('../rabbit/index.js'),
  swan: () => import('../swan/index.js'),
  heron: () => import('../heron/index.js'),
};

// for the creature select (order, names, one line each)
export const CREATURE_INFO = [
  { kind: 'squirrel', name: 'Black squirrel', blurb: 'Runs, leaps and climbs walls and trees.' },
  { kind: 'beaver', name: 'Beaver', blurb: 'Waddles on land; swims and dives (A) like a torpedo.' },
  { kind: 'rabbit', name: 'Cottontail', blurb: 'Hops, bounds and zig-zags; big jumps. Hates water.' },
  { kind: 'swan', name: 'Mute swan', blurb: 'Glides on the Avon; hold A to run and take off, then fly.' },
  { kind: 'heron', name: 'Great blue heron', blurb: 'Wades the shallows; A takes off; perches on roofs.' },
];

export const DEFAULT_CREATURE = 'squirrel';

export async function loadCreature(name = DEFAULT_CREATURE) {
  const load = CREATURES[name] || CREATURES[DEFAULT_CREATURE];
  return load();
}
