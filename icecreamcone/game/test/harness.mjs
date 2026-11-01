// Shared helpers for the minigame tests: run a game headless with scripted
// input, without a canvas.
import { makeRng } from '../src/games/index.js';
import { pointsFor } from '../src/points.js';

export const W = 1600;
export const H = 900;

export function env(seed = 1, extra = {}) {
  return { W, H, rng: makeRng(seed), sfx: () => {}, vibrate: () => {}, reduceMotion: false, ...extra };
}

export function blank(over = {}) {
  return {
    x: 0, y: 0, rx: 0, ry: 0, wheel: 0, action: false, actionPressed: false, actionReleased: false,
    left: false, right: false, spin: 0, kind: 'keyboard',
    pointer: { active: false, x: 0, y: 0, down: false, pressed: false, released: false },
    ...over,
  };
}

// Runs a game to the end. `bot(game, t, prev)` returns a partial input each
// frame (held `action` is turned into pressed/released edges automatically).
// `difficulty` is the Settings level ('easier' | 'normal' | 'harder'); left
// out, the game plays at Normal. `points` is the round's points, worked out
// as the shell does (src/points.js).
export function run(create, { seed = 1, dt = 1 / 60, maxSeconds = 600, bot = () => ({}), difficulty } = {}) {
  const game = create(env(seed, difficulty ? { difficulty } : {}));
  let t = 0;
  let held = false;
  const points = pointsFor(game);
  while (!game.done && t < maxSeconds) {
    const over = bot(game, t) || {};
    const action = !!over.action;
    const inp = blank({ ...over, action, actionPressed: over.actionPressed ?? (action && !held), actionReleased: over.actionReleased ?? (!action && held) });
    held = action;
    points.step(() => game.update(dt, inp));
    t += dt;
  }
  return { game, t, points: points.exact };
}
