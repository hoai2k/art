// The minigames, one module per bird: src/games/<birdId>.js.
//
// THE CONTRACT. Each module default-exports `create(env)`, which returns a
// game object. The shell (main.js) owns the count-in, the clock display,
// pause, results and best scores; a game only plays.
//
//   env = {
//     W: 1600, H: 900,        logical canvas size; draw in these units
//     rng(): number in [0, 1), seeded, so tests are repeatable
//     sfx(name, opts?)        a sound from audio.js (no-op in tests)
//     vibrate(ms)             a short rumble when supported and allowed
//     reduceMotion: boolean   keep shakes and flashes small when true
//     subjects?: string[]     Shuttercluck only: the ids (in subjects.js) of
//                             the birds not yet discovered, to photograph
//   }
//
//   game = {
//     update(dt, input)       advance dt seconds (the shell caps it at 0.05)
//     draw(g, t)              draw the whole frame on a 1600 x 900 context
//     score: number           the score so far (whole numbers)
//     done: boolean           true once the game is over
//     time?: number           seconds left, if the game is timed (shown in the HUD)
//     hud?(): string          a short status line for the HUD, e.g. "Shots 7"
//     summary?(): string[]    extra lines for the results card
//     focus?(): number        on a narrow (portrait) screen, the x the view
//                             follows (default the middle)
//     span?: number           and how much of the width it must keep in view
//                             (default 760)
//     drawOverlay?(g, view)   draw fixed on the screen, after draw(), not
//                             moved by the narrow-screen camera. The context
//                             is scaled like the scene (logical units) with
//                             (0, 0) at the top left of the visible play
//                             area; view = { w, h, s, kind }: that area's
//                             size in logical units, CSS px per unit, and
//                             the input in use ('keyboard' | 'controller' |
//                             'pointer')
//   }
//
//   input = {                 from input.js `state()`, every frame
//     x, y                    -1..1, stick / D-pad / arrows / WASD
//     action                  held: A, RT, Space, Enter, mouse or touch down
//     actionPressed           went down this frame
//     actionReleased          went up this frame
//     left, right             a fresh left / right step (Bobolinks): LB/RB,
//                             D-pad, arrow keys, A/D, or a tap on that half
//     xPressed, bPressed      a fresh press of the controller's X / B
//                             (Bobolinks steps with them too)
//     pointer { active, x, y, down, pressed }   logical coordinates; active
//                             when the mouse or touch is the device in use
//     spin                    radians the left stick turned this frame
//     kind                    'keyboard' | 'controller' | 'pointer'
//   }
//
// When the pointer is active, a game that moves something follows the
// pointer's x (and y where it makes sense) instead of the stick.
//
// Draw with the helpers in draw.js: drawBird() for the birds (it uses the
// delivered portrait once it arrives; the undiscovered birds in subjects.js
// work too), scene() for the background. A game not listed below is loaded
// from ./<birdId>.js.

const loaders = {
  coot: () => import('./coot.js'),
  cupadee: () => import('./cupadee.js'),
  shuttercluck: () => import('./shuttercluck.js'),
  gullfinch: () => import('./gullfinch.js'),
  plume: () => import('./plume.js'),
  bobolinks: () => import('./bobolinks.js'),
  peeper: () => import('./peeper.js'),
  piffle: () => import('./piffle.js'),
  dodo: () => import('./dodo.js'),
  crow: () => import('./crow.js'),
};

export async function loadGame(id) {
  try {
    const m = await (loaders[id] || (() => import(`./${id}.js`)))();
    return m.default;
  } catch (e) {
    console.warn('[games] could not load', id, e);
    return null;
  }
}

// A seeded random number generator (mulberry32).
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Helpers games share.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const approach = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));
