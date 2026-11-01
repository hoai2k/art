// Points: the score scaled by how hard the game was at the moment it was
// earned (see design/difficulty.md, "Points").
//
// A game keeps its own plain tally in `game.score` (scoops, stones, points),
// which is what the pass mark is checked against. The shell watches that
// tally change, frame by frame, and adds each change times (1 + d), where d is
// the game's own difficulty right then (0..1, from difficulty.js): 1x at the
// easiest, 2x at the hardest. So the later in a round and the harder the
// level, the more each scoring action is worth. A penalty (a fall in the
// tally) is scaled the same way; points never go below 0.

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

// What one unit of tally is worth at difficulty d.
export const multiplier = (d) => 1 + clamp01(d);

// The points after a change of `delta` in the tally at difficulty d.
export const addPoints = (points, delta, d) => Math.max(0, points + delta * multiplier(d));

// Points as shown and saved: whole numbers.
export const shownPoints = (points) => Math.round(points);

// The game's difficulty right now, from the curve the game itself uses. Every
// game exposes it as `g.d()`, except Puddle Hop, where `g.d` is the distance
// walked and the difficulty is `g.dNow()`. (Dodo's and Glass Harp's take an
// optional round number and default to the current one.)
export function dNow(game) {
  if (typeof game?.dNow === 'function') return clamp01(game.dNow());
  if (typeof game?.d === 'function') return clamp01(game.d());
  return 0;
}

// Watches one game's tally. Call `step(() => game.update(dt, input))` in place
// of a bare update: the difficulty is read just before the update (the moment
// the action was taken, before any round or clock moves on), and the change in
// the tally after it is added at that difficulty.
export function pointsFor(game) {
  let exact = 0;
  let last = Number(game.score) || 0;
  return {
    step(update) {
      const d = dNow(game);
      update();
      const now = Number(game.score) || 0;
      const delta = now - last;
      last = now;
      if (delta) exact = addPoints(exact, delta, d);
    },
    get exact() {
      return exact;
    },
    get shown() {
      return shownPoints(exact);
    },
  };
}
