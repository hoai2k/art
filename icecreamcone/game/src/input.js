// Input for one player from any device: Xbox controllers (any of them), the
// keyboard, and the mouse or touch. Polled once per frame.
//
// Menus read `nav` (fresh presses of up/down/left/right/confirm/back/pause).
// Minigames read `state()`, the same small set of actions on every device:
// a move direction, one action button, left/right steps, the pointer and the
// stick's spin (for winding the Gullfinch), the right stick (rx, ry; Q and E
// stand in for its up and down) and the mouse wheel's notches. `xPressed` and
// `bPressed` are fresh presses of the controller's X and B (controller only:
// no keyboard keys stand in, since the arrows already step and Shift slows;
// B held is also `slow`). See design/design.md, Controls.

export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

const DEAD = 0.2;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : Math.sign(v) * ((Math.abs(v) - DEAD) / (1 - DEAD)));

const KEYS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  action: ['Space', 'Enter', 'NumpadEnter'],
  back: ['Escape', 'Backspace'],
  pause: ['Escape', 'KeyP'],
};

export function createInput(target) {
  const keys = new Set();
  const pressed = new Set(); // codes that went down since the last frame
  const released = new Set();
  const pads = new Map(); // index -> { prev: [], now: [], axes: [], held: Set }
  let kind = 'keyboard'; // 'keyboard' | 'controller' | 'pointer'
  const listeners = [];

  // Pointer, in the canvas's logical coordinates (set by `mapPointer`).
  // (downX, downY: where it last went down, which a frame may see only
  // after it has already moved on)
  const pointer = { x: 0, y: 0, downX: 0, downY: 0, down: false, pressed: false, released: false, active: false, side: 0 };
  let mapPointer = (cx, cy) => [cx, cy];
  let stickAngle = null;
  let navStickHeld = false; // the stick, held through lockHeld(), is ignored by nav() until centred
  let spin = 0;
  const nudge = { d: 0, t: 0 }; // mouse movement while another device is in use
  let wheel = 0; // mouse-wheel notches since the last frame (+ toward you)

  const setKind = (k) => {
    if (k === kind) return;
    kind = k;
    for (const fn of listeners) fn(k);
  };

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    setKind('keyboard');
  });
  addEventListener('keyup', (e) => {
    keys.delete(e.code);
    released.add(e.code);
  });
  addEventListener('blur', () => {
    keys.clear();
    pointer.down = false;
  });

  if (target) {
    const toLogical = (e) => {
      const [x, y] = mapPointer(e.clientX, e.clientY);
      pointer.x = x;
      pointer.y = y;
    };
    target.addEventListener('pointerdown', (e) => {
      toLogical(e);
      pointer.downX = pointer.x;
      pointer.downY = pointer.y;
      pointer.down = true;
      pointer.pressed = true;
      pointer.active = true;
      pointer.side = e.clientX < innerWidth / 2 ? -1 : 1;
      setKind('pointer');
      try { target.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    });
    target.addEventListener('pointermove', (e) => {
      toLogical(e);
      if (e.pointerType === 'mouse' || pointer.down) {
        pointer.active = true;
        // A mouse resting by a controller or keyboard player is easily
        // nudged: it takes over (and games then steer towards it) only once
        // it has really moved, about 24 px within half a second.
        if (pointer.down || kind === 'pointer') setKind('pointer');
        else if (e.movementX || e.movementY) {
          const now = performance.now();
          if (now - nudge.t > 500) nudge.d = 0;
          nudge.t = now;
          nudge.d += Math.abs(e.movementX) + Math.abs(e.movementY);
          if (nudge.d > 24) setKind('pointer');
        }
      }
    });
    const up = (e) => {
      toLogical(e);
      if (pointer.down) pointer.released = true;
      pointer.down = false;
    };
    target.addEventListener('wheel', (e) => {
      wheel += e.deltaY / (e.deltaMode === 1 ? 3 : e.deltaMode === 2 ? 0.1 : 100);
    }, { passive: true });
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }
  addEventListener('pointerdown', () => setKind('pointer'));

  const any = (codes, set) => codes.some((c) => set.has(c));

  function padPressed(p, b) {
    return !p.held.has(b) && p.now[b] > 0.5 && !(p.prev[b] > 0.5);
  }
  function padDown(p, b) {
    return !p.held.has(b) && p.now[b] > 0.5;
  }
  function padReleased(p, b) {
    return !(p.now[b] > 0.5) && p.prev[b] > 0.5;
  }

  const api = {
    get kind() {
      return kind;
    },
    onKind(fn) {
      listeners.push(fn);
    },
    setPointerMap(fn) {
      mapPointer = fn;
    },
    connected() {
      return pads.size > 0;
    },
    poll() {
      const list = navigator.getGamepads ? navigator.getGamepads() : [];
      const seen = new Set();
      for (const gp of list) {
        if (!gp || !gp.connected) continue;
        seen.add(gp.index);
        let p = pads.get(gp.index);
        if (!p) {
          // A newly seen pad: anything already held must be let go first.
          p = { prev: [], now: [], axes: [], held: new Set() };
          gp.buttons.forEach((b, i) => b.pressed && p.held.add(i));
          pads.set(gp.index, p);
        }
        p.prev = p.now;
        p.now = gp.buttons.map((b) => (b.pressed ? Math.max(b.value, 0.6) : b.value));
        p.axes = gp.axes.slice();
        for (const i of [...p.held]) if (!gp.buttons[i]?.pressed) p.held.delete(i);
        if (p.now.some((v, i) => v > 0.5 && !(p.prev[i] > 0.5)) || p.axes.slice(0, 2).some((a) => Math.abs(a) > 0.5)) setKind('controller');
      }
      for (const i of [...pads.keys()]) if (!seen.has(i)) pads.delete(i);

      // Stick spin: how far the left stick turned this frame while pushed out.
      const [sx, sy] = api.stick();
      spin = 0;
      if (Math.hypot(sx, sy) > 0.6) {
        const a = Math.atan2(sy, sx);
        if (stickAngle !== null) {
          let d = a - stickAngle;
          if (d > Math.PI) d -= 2 * Math.PI;
          if (d < -Math.PI) d += 2 * Math.PI;
          spin = d;
        }
        stickAngle = a;
      } else stickAngle = null;
    },
    endFrame() {
      pressed.clear();
      released.clear();
      pointer.pressed = false;
      pointer.released = false;
      wheel = 0;
    },
    // Everything currently held is stale until released (after a screen change).
    lockHeld() {
      for (const p of pads.values()) p.now.forEach((v, i) => v > 0.5 && p.held.add(i));
      // A stick pushed out (stirring, steering) doesn't steer the new menu
      // until it has been let back to the middle.
      const [sx, sy] = api.stick();
      navStickHeld = Math.hypot(sx, sy) > 0.3;
      pressed.clear();
      pointer.pressed = false;
    },
    padPressed(b) {
      for (const p of pads.values()) if (padPressed(p, b)) return true;
      return false;
    },
    // A key (by its code) that went down this frame.
    keyPressed(...codes) {
      return codes.some((c) => pressed.has(c));
    },
    padAnyPressed() {
      for (const p of pads.values()) if (p.now.some((v, b) => v > 0.5 && !(p.prev[b] > 0.5) && !p.held.has(b))) return true;
      return false;
    },
    stick() {
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
    // The right stick (axes 2 and 3), with the same deadzone.
    rightStick() {
      let x = 0;
      let y = 0;
      for (const p of pads.values()) {
        const ax = dz(p.axes[2] || 0);
        const ay = dz(p.axes[3] || 0);
        if (Math.abs(ax) > Math.abs(x)) x = ax;
        if (Math.abs(ay) > Math.abs(y)) y = ay;
      }
      return [x, y];
    },
    // Fresh presses for menus.
    nav() {
      const pad = (b) => api.padPressed(b);
      let [sx, sy] = api.stick();
      if (navStickHeld && Math.hypot(sx, sy) < 0.3) navStickHeld = false;
      if (navStickHeld) sx = sy = 0;
      const n = {
        up: any(KEYS.up, pressed) || pad(BTN.UP),
        down: any(KEYS.down, pressed) || pad(BTN.DOWN),
        left: any(KEYS.left, pressed) || pad(BTN.LEFT),
        right: any(KEYS.right, pressed) || pad(BTN.RIGHT),
        confirm: any(['Space', 'Enter', 'NumpadEnter'], pressed) || pad(BTN.A),
        back: any(KEYS.back, pressed) || pad(BTN.B),
        pause: any(KEYS.pause, pressed) || pad(BTN.MENU) || pad(BTN.VIEW),
        stick: [sx, sy],
      };
      return n;
    },
    // The minigame view of the input, for this frame.
    state() {
      const [sx, sy] = api.stick();
      let x = sx;
      let y = sy;
      const k = (n) => any(KEYS[n], keys);
      let dpadX = 0;
      let dpadY = 0;
      let action = k('action') && !keys.has('Escape');
      let actionPressed = any(KEYS.action, pressed);
      let actionReleased = any(KEYS.action, released);
      let left = pressed.has('ArrowLeft') || pressed.has('KeyA');
      let right = pressed.has('ArrowRight') || pressed.has('KeyD');
      // Fresh presses of X and B, for a game that wants them as a second
      // left / right pair (Bobolinks); B held is also `slow` below.
      let xPressed = false;
      let bPressed = false;
      // Held for a careful pace: B (or Shift); a trigger's depth, 0 to 1; and
      // the action button itself, A or Space, without RT.
      let slow = keys.has('ShiftLeft') || keys.has('ShiftRight');
      let trigger = 0;
      let actionA = k('action') && !keys.has('Escape');
      for (const p of pads.values()) {
        if (padDown(p, BTN.B)) slow = true;
        trigger = Math.max(trigger, p.now[BTN.LT] || 0, p.now[BTN.RT] || 0);
        if (padDown(p, BTN.A)) actionA = true;
        if (padDown(p, BTN.LEFT)) dpadX = -1;
        if (padDown(p, BTN.RIGHT)) dpadX = 1;
        if (padDown(p, BTN.UP)) dpadY = -1;
        if (padDown(p, BTN.DOWN)) dpadY = 1;
        if (padDown(p, BTN.A) || padDown(p, BTN.RT)) action = true;
        if (padPressed(p, BTN.A) || padPressed(p, BTN.RT)) actionPressed = true;
        if (padReleased(p, BTN.A) || padReleased(p, BTN.RT)) actionReleased = true;
        if (padPressed(p, BTN.LB) || padPressed(p, BTN.LEFT) || padPressed(p, BTN.LT)) left = true;
        if (padPressed(p, BTN.RB) || padPressed(p, BTN.RIGHT)) right = true;
        if (padPressed(p, BTN.X)) xPressed = true;
        if (padPressed(p, BTN.B)) bPressed = true;
      }
      const kx = (k('right') ? 1 : 0) - (k('left') ? 1 : 0);
      const ky = (k('down') ? 1 : 0) - (k('up') ? 1 : 0);
      if (kx || dpadX) x = kx || dpadX;
      if (ky || dpadY) y = ky || dpadY;
      // The right stick; Q and E stand in for it up and down.
      let [rx, ry] = api.rightStick();
      const kq = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
      if (kq) ry = kq;
      if (pointer.pressed) {
        if (pointer.side < 0) left = true;
        else right = true;
      }
      return {
        x,
        y,
        rx,
        ry,
        wheel,
        action: action || pointer.down,
        actionPressed: actionPressed || pointer.pressed,
        actionReleased: actionReleased || pointer.released,
        left,
        right,
        xPressed,
        bPressed,
        slow,
        trigger,
        actionA: actionA || pointer.down,
        pointer: { ...pointer, active: pointer.active && kind === 'pointer' },
        spin,
        kind,
      };
    },
  };
  return api;
}
