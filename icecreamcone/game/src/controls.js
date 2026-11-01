// The controls lines on a bird's page and in How to play, for the device in
// use: k is 'controller' | 'keyboard' | 'pointer' (input.js `kind`).
// See design/design.md, Controls.

export function controlLines(b, k) {
  const by = {
    move: { controller: 'Left stick or D-pad', keyboard: 'Arrow keys or WASD', pointer: 'Move the mouse or your finger' },
    action: { controller: 'A', keyboard: 'Space', pointer: 'Click or tap' },
    steps: { controller: 'LB / RB (or X / B)', keyboard: '← / →', pointer: 'Tap the left or right half' },
    wind: { controller: 'Spin the left stick', keyboard: 'Tap Space (or ← →) between notes', pointer: 'Drag in circles' },
  };
  const C = (key) => by[key][k] || by[key].keyboard;
  const lines = {
    coot: [`Move: ${C('move')}`],
    cupadee: [`Pour: hold ${C('action')}, and let go at the line`],
    shuttercluck: [`Aim: ${C('move')}`, `Take a picture: ${C('action')}`],
    gullfinch: [`Sing a note: ${C('action')}`, `Wind the spring: ${C('wind')}`],
    plume: [`Move the watering can: ${C('move')}`, `Water: hold ${C('action')}`],
    bobolinks: k === 'controller'
      ? ['Left foot: LB (or X)', 'Right foot: RB (or B)', 'Both feet: both together']
      : [`Step: ${C('steps')}`],
    peeper: [`Move: ${C('move')}`],
    piffle: k === 'pointer'
      ? [`Steer: ${C('move')}`, 'Sew faster: hold high up the quilt']
      : k === 'controller'
        ? [`Steer: ${C('move')}`, 'Sew faster: hold A', 'Slow down: hold B', 'Steer finely: hold LT or RT']
        : [`Steer: ${C('move')}`, 'Sew faster: hold Space', 'Slow down: hold Shift'],
    dodo: [`Choose a hat: ${C('move')}`, `Pick it: ${C('action')}`],
    crow: [`Switch the light: ${C('action')}`],
  };
  // A bird entry can list its own: [label, input] pairs (input one of the
  // keys above, or plain text), with an optional third item for touch.
  if (!lines[b.id] && b.controls) {
    return b.controls.map(([label, key, touch]) => (k === 'pointer' && touch ? touch : `${label}: ${by[key] ? C(key) : key}`));
  }
  return lines[b.id] || [];
}
