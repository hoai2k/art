// The creature registry (ARCHITECTURE.md, "Many creatures, many scales"). Each entry loads a module
// exporting createCreature(opts) -> the squirrel contract + { kind, scale, eyeHeight, climbs, canFly }
// and createCamera({ THREE, camera, creature, world }). The shell picks one by name (default
// 'squirrel'); the generic controller and camera live beside this file (controller.js, camera.js).
export const CREATURES = {
  squirrel: () => import('../squirrel/index.js'),
};

export const DEFAULT_CREATURE = 'squirrel';

export async function loadCreature(name = DEFAULT_CREATURE) {
  const load = CREATURES[name] || CREATURES[DEFAULT_CREATURE];
  return load();
}
