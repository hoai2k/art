// Keyboard, touch and gamepad merged into one per-frame snapshot. Discrete
// actions are edges (fresh presses only); a button already held when a pad is
// first seen is ignored until released, so it can't start the game by accident.

const DEAD = 0.35;
const REPEAT_FIRST = 0.38, REPEAT_NEXT = 0.13;
// Standard mapping indexes.
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, VIEW: 8, MENU: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export function createInput(target = window) {
  const keys = new Set();
  let keyEdges = [];
  let touchSrc = null; // src/touch.js controller, attached on touch devices
  let owner = null; // gamepad index that owns gameplay
  const prev = new Map(); // pad index -> boolean[]
  const held = new Map(); // pad index -> Set of buttons held when first seen
  const rep = { dir: null, t: 0 };
  let stickWasNeutral = true;
  let source = 'key';
  const listeners = { connect: [], disconnect: [] };

  target.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code); keyEdges.push(e.code); source = 'key';
  });
  target.addEventListener('keyup', (e) => keys.delete(e.code));
  target.addEventListener('blur', () => keys.clear());
  window.addEventListener('gamepadconnected', (e) => listeners.connect.forEach((f) => f(e.gamepad)));
  window.addEventListener('gamepaddisconnected', (e) => {
    prev.delete(e.gamepad.index); held.delete(e.gamepad.index);
    const wasOwner = e.gamepad.index === owner;
    if (wasOwner) owner = null;
    listeners.disconnect.forEach((f) => f(e.gamepad, wasOwner));
  });

  // Attach the touch layer (src/touch.js); its input merges in poll().
  function attachTouch(t) { touchSrc = t; }

  function poll(dt) {
    const k = (...codes) => codes.some((c) => keys.has(c));
    const ke = (...codes) => codes.some((c) => keyEdges.includes(c));
    const tc = touchSrc ? touchSrc.poll(dt) : null;
    if (tc && (tc.a || tc.b || tc.pause || tc.tap || tc.moveX || tc.moveY)) source = 'touch';
    const te = (name) => !!tc?.[name];
    const s = {
      moveX: (k('ArrowRight', 'KeyD') ? 1 : 0) - (k('ArrowLeft', 'KeyA') ? 1 : 0) + (tc?.moveX || 0),
      // Continuous vertical (positive = down), for swimming and climbing acts.
      moveY: (k('ArrowDown', 'KeyS') ? 1 : 0) - (k('ArrowUp', 'KeyW') ? 1 : 0) + (tc?.moveY || 0),
      // The action button held (A, Space, Z, J or touch Leap).
      aHeld: k('Space', 'KeyZ', 'KeyJ') || !!tc?.aHeld,
      // X held (the X key, pad X, or touch B held): bowing past the guards.
      xHeld: k('KeyX') || !!tc?.bHeld,
      up: ke('ArrowUp', 'KeyW') || te('up'),
      down: ke('ArrowDown', 'KeyS') || te('down'),
      left: ke('ArrowLeft', 'KeyA') || te('left'),
      right: ke('ArrowRight', 'KeyD') || te('right'),
      leap: ke('Space', 'KeyZ', 'KeyJ') || te('a'),
      confirm: ke('Enter', 'Space', 'KeyZ', 'KeyJ'),
      back: ke('Escape', 'Backspace'),
      pause: ke('Escape', 'KeyP') || te('pause'),
      // B in play (refuse, cancel): pad B, or X / Backspace on keys.
      bPress: ke('KeyX', 'Backspace'),
      anyPad: false, stickNav: false, padA: false, padStart: false, padB: false, padX: false,
      keyAny: keyEdges.length > 0,
      keyNav: ke('Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'),
    };

    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    for (const p of pads) {
      const now = p.buttons.map((b) => b.pressed || b.value > 0.5);
      if (!prev.has(p.index)) {
        held.set(p.index, new Set(now.flatMap((v, i) => (v ? [i] : []))));
        prev.set(p.index, now);
        continue;
      }
      const was = prev.get(p.index);
      const h = held.get(p.index);
      const edge = (i) => {
        if (h.has(i)) { if (!now[i]) h.delete(i); return false; }
        return now[i] && !was[i];
      };
      const edges = now.map((_, i) => edge(i));
      prev.set(p.index, now);
      if (edges.some(Boolean)) {
        s.anyPad = true; source = 'pad';
        if (owner === null) owner = p.index;
      }
      if (owner !== null && p.index !== owner) continue;
      const ax = Math.abs(p.axes[0] || 0) > DEAD ? p.axes[0] : 0;
      const ay = Math.abs(p.axes[1] || 0) > DEAD ? p.axes[1] : 0;
      if (ax || ay) { source = 'pad'; if (owner === null) owner = p.index; }
      s.moveX += ax + (now[BTN.RIGHT] ? 1 : 0) - (now[BTN.LEFT] ? 1 : 0);
      s.moveY += ay + (now[BTN.DOWN] ? 1 : 0) - (now[BTN.UP] ? 1 : 0);
      if (now[BTN.A] && !h.has(BTN.A)) s.aHeld = true;
      if (edges[BTN.A]) { s.leap = true; s.padA = true; }
      if (edges[BTN.B]) { s.back = true; s.padB = true; }
      if (edges[BTN.X]) s.padX = true;
      if (now[BTN.X] && !h.has(BTN.X)) s.xHeld = true;
      if (edges[BTN.MENU]) { s.pause = true; s.padStart = true; }
      if (edges[BTN.UP]) s.up = true;
      if (edges[BTN.DOWN]) s.down = true;
      if (edges[BTN.LEFT]) s.left = true;
      if (edges[BTN.RIGHT]) s.right = true;
      // stick as discrete directions with menu repeat
      const dir = Math.abs(ay) > Math.abs(ax) ? (ay < 0 ? 'up' : ay > 0 ? 'down' : null) : (ax < 0 ? 'left' : ax > 0 ? 'right' : null);
      if (dir) {
        if (stickWasNeutral) s.stickNav = true;
        if (dir !== rep.dir) { rep.dir = dir; rep.t = REPEAT_FIRST; s[dir] = true; }
        else if ((rep.t -= dt) <= 0) { rep.t = REPEAT_NEXT; s[dir] = true; }
        stickWasNeutral = false;
      } else { rep.dir = null; stickWasNeutral = true; }
    }
    s.moveX = Math.max(-1, Math.min(1, s.moveX));
    s.moveY = Math.max(-1, Math.min(1, s.moveY));
    s.source = source;
    s.tap = tc?.tap || null;     // a tap outside play, in stage coordinates
    s.touchB = !!tc?.b;
    s.touchX = !!tc?.x;              // a tap that stands for the X action
    s.playTap = tc?.playTap || null; // where a tap in play landed, stage coordinates
    keyEdges = [];
    return s;
  }

  return {
    poll, attachTouch,
    on(ev, f) { listeners[ev].push(f); },
    owner: () => owner,
    rumble(strong = 0.6, weak = 0.4, ms = 180) {
      const p = owner !== null && navigator.getGamepads?.()[owner];
      p?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch?.(() => {});
    },
  };
}
