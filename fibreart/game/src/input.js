// Input from every device. Each Xbox controller is its own player; the
// keyboard (with the mouse or touch) is one more. Polled once per frame.
//
// Menus read `nav()`: fresh presses from any device. Play reads `players()`:
// for each player, sticks, triggers, fresh button presses and D-pad steps.

export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const PLAY_BUTTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB'];

const DEAD = 0.18;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : Math.sign(v) * ((Math.abs(v) - DEAD) / (1 - DEAD)));
function stick(x, y) {
  const m = Math.hypot(x, y);
  if (m < DEAD) return [0, 0];
  const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
  return [x * k, y * k];
}

// The keyboard as a controller (see the instructions).
export const KEYMAP = {
  LS: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
  RS: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
  LT: 'KeyQ',
  RT: 'KeyE',
  A: 'KeyK',
  B: 'KeyL',
  X: 'KeyJ',
  Y: 'KeyI',
  LB: 'KeyZ',
  RB: 'KeyC',
  prev: 'BracketLeft',
  next: 'BracketRight',
};

export function createInput() {
  const keys = new Set();
  const pressed = new Set();
  const pads = new Map(); // index -> { prev, now, axes, held }
  const listeners = [];
  const padListeners = [];
  let kind = 'keyboard';
  let keyboardUsed = false;
  // The hand: what a finger or the mouse does to the pieces, turned into the
  // inputs bound to them by the shell, and played as the keyboard player.
  const hand = { LS: [0, 0], RS: [0, 0], LT: 0, RT: 0, pressed: new Set(), active: false };

  const setKind = (k) => {
    if (k === kind) return;
    kind = k;
    for (const fn of listeners) fn(k);
  };

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Tab') e.preventDefault();
    keys.add(e.code);
    pressed.add(e.code);
    setKind('keyboard');
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  addEventListener('pointerdown', (e) => setKind(e.pointerType === 'touch' ? 'touch' : 'pointer'));

  const padPressed = (p, b) => !p.held.has(b) && p.now[b] > 0.5 && !(p.prev[b] > 0.5);

  const api = {
    get kind() { return kind; },
    hand,
    onKind(fn) { listeners.push(fn); },
    onPads(fn) { padListeners.push(fn); },
    pads() { return [...pads.keys()]; },
    poll() {
      const list = navigator.getGamepads ? navigator.getGamepads() : [];
      const seen = new Set();
      let changed = false;
      for (const gp of list) {
        if (!gp || !gp.connected) continue;
        seen.add(gp.index);
        let p = pads.get(gp.index);
        if (!p) {
          // A newly seen pad: anything already held must be let go first.
          p = { prev: [], now: [], axes: [], held: new Set() };
          gp.buttons.forEach((b, i) => b.pressed && p.held.add(i));
          pads.set(gp.index, p);
          changed = true;
        }
        p.prev = p.now;
        p.now = gp.buttons.map((b) => (b.pressed ? Math.max(b.value, 0.6) : b.value));
        p.axes = gp.axes.slice();
        for (const i of [...p.held]) if (!gp.buttons[i]?.pressed) p.held.delete(i);
        if (p.now.some((v, i) => v > 0.5 && !(p.prev[i] > 0.5)) || p.axes.some((a) => Math.abs(a) > 0.5)) setKind('controller');
      }
      for (const i of [...pads.keys()]) if (!seen.has(i)) { pads.delete(i); changed = true; }
      if (changed) for (const fn of padListeners) fn(api.pads());
    },
    endFrame() {
      pressed.clear();
      hand.pressed.clear();
    },
    // Everything currently held is stale until released (after a screen change).
    lockHeld() {
      for (const p of pads.values()) p.now.forEach((v, i) => v > 0.5 && p.held.add(i));
      pressed.clear();
    },
    padAnyPressed() {
      for (const p of pads.values()) if (p.now.some((v, b) => v > 0.5 && !(p.prev[b] > 0.5) && !p.held.has(b))) return true;
      return false;
    },
    padPressed(b) {
      for (const p of pads.values()) if (padPressed(p, b)) return true;
      return false;
    },
    // Held down now (and not left over from before a screen change).
    padHeld(b) {
      for (const p of pads.values()) if (p.now[b] > 0.5 && !p.held.has(b)) return true;
      return false;
    },
    keyPressed(code) { return pressed.has(code); },
    leftStick() {
      let x = 0;
      let y = 0;
      for (const p of pads.values()) {
        const ax = dz(p.axes[0] || 0);
        const ay = dz(p.axes[1] || 0);
        if (Math.abs(ax) > Math.abs(x)) x = ax;
        if (Math.abs(ay) > Math.abs(y)) y = ay;
      }
      return [x, y];
    },
    // Fresh presses for menus, from any device.
    nav() {
      const pad = (b) => api.padPressed(b);
      const any = (...codes) => codes.some((c) => pressed.has(c));
      return {
        up: any('ArrowUp', 'KeyW') || pad(BTN.UP),
        down: any('ArrowDown', 'KeyS') || pad(BTN.DOWN),
        left: any('ArrowLeft', 'KeyA') || pad(BTN.LEFT),
        right: any('ArrowRight', 'KeyD') || pad(BTN.RIGHT),
        confirm: any('Enter', 'NumpadEnter', 'Space') || pad(BTN.A),
        back: any('Escape', 'Backspace') || pad(BTN.B),
        pause: any('Escape', 'KeyP') || pad(BTN.MENU),
        view: any('Tab') || pad(BTN.VIEW),
        stick: api.leftStick(),
      };
    },
    keyboardActive() { return keyboardUsed; },
    // Each player's controls for this frame, keyed by player id.
    players() {
      const out = new Map();
      for (const [i, p] of pads) {
        const fresh = new Set(PLAY_BUTTONS.filter((n) => padPressed(p, BTN[n])));
        const trig = (b) => (p.held.has(b) ? 0 : p.now[b] || 0);
        out.set(`pad${i}`, {
          LS: stick(p.axes[0] || 0, p.axes[1] || 0),
          RS: stick(p.axes[2] || 0, p.axes[3] || 0),
          LT: trig(BTN.LT),
          RT: trig(BTN.RT),
          pressed: fresh,
          dpad: padPressed(p, BTN.LEFT) || padPressed(p, BTN.UP) ? -1 : padPressed(p, BTN.RIGHT) || padPressed(p, BTN.DOWN) ? 1 : 0,
        });
      }
      const k = (c) => (keys.has(c) ? 1 : 0);
      const axis = (m) => {
        const x = k(m.right) - k(m.left);
        const y = k(m.down) - k(m.up);
        const n = Math.hypot(x, y) || 1;
        return [x / n, y / n];
      };
      const tp = hand;
      const either = (a, b) => (a[0] || a[1] ? a : b);
      const kb = {
        LS: either(axis(KEYMAP.LS), tp.LS),
        RS: either(axis(KEYMAP.RS), tp.RS),
        LT: Math.max(k(KEYMAP.LT), tp.LT),
        RT: Math.max(k(KEYMAP.RT), tp.RT),
        pressed: new Set(PLAY_BUTTONS.filter((n) => pressed.has(KEYMAP[n]) || tp.pressed.has(n))),
        dpad: pressed.has(KEYMAP.prev) ? -1 : pressed.has(KEYMAP.next) ? 1 : 0,
      };
      const used = kb.LS[0] || kb.LS[1] || kb.RS[0] || kb.RS[1] || kb.LT || kb.RT || kb.pressed.size || kb.dpad;
      if (used || tp.active) keyboardUsed = true;
      if (keyboardUsed) out.set('kb', kb);
      return out;
    },
  };
  return api;
}
