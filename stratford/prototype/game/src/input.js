// Input from every device: Xbox controller(s), keyboard, mouse (pointer lock
// for the camera during play) and touch. Polled once per frame.
//
//   input.poll()        read the pads (call first each frame)
//   input.controls(dt)  the `controls` object of ARCHITECTURE.md for the squirrel
//   input.nav()         fresh menu presses from any device
//   input.endFrame()    forget this frame's fresh key presses (call last)
//
// Everything that touches the browser is injectable (`target`, `getGamepads`,
// `doc`) so the node tests can drive it with a fake pad and a fake EventTarget.

export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export const DEAD_MOVE = 0.18;
export const DEAD_LOOK = 0.14;
export const LOOK_RATE = 2.6; // radians a second at full stick, sensitivity 1
export const MOUSE_RATE = 0.0022; // radians a pixel, sensitivity 1
// Camera zoom, in zoom units (0 = the standard close follow .. 1 = the far follow; see
// src/creatures/camera.js): held LB / RB or Z / X sweep the whole range in about 1.4 s, a mouse
// wheel notch (100 px) moves an eighth of it.
export const ZOOM_RATE = 0.7;
export const WHEEL_RATE = 0.00125;

// Radial dead zone with the live range rescaled to 0..1.
export function stick(x, y, dead = DEAD_MOVE) {
  const m = Math.hypot(x, y);
  if (m < dead) return [0, 0];
  const k = Math.min(1, (m - dead) / (1 - dead)) / m;
  return [x * k, y * k];
}

export const KEYS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  lookUp: 'ArrowUp', lookDown: 'ArrowDown', lookLeft: 'ArrowLeft', lookRight: 'ArrowRight',
  jump: 'Space', sprint: ['ShiftLeft', 'ShiftRight'], sit: 'KeyE', dig: 'KeyF', recenter: 'KeyC',
  zoomOut: 'KeyZ', zoomIn: 'KeyX', boost: 'KeyQ',
  map: ['KeyM', 'Tab'], pause: ['Escape', 'KeyP'],
};

const zeroControls = () => ({
  move: [0, 0], look: [0, 0], jump: false, jumpPressed: false, sprint: 0,
  sitPressed: false, digPressed: false, recenter: false, zoom: 0, boost: 0,
});
export { zeroControls };

export function createInput(opts = {}) {
  const target = opts.target ?? globalThis;
  const doc = 'doc' in opts ? opts.doc : globalThis.document;
  const getPads = opts.getGamepads ?? (() => (globalThis.navigator?.getGamepads ? globalThis.navigator.getGamepads() : []));
  const settings = opts.settings ?? { camSens: 1, invertY: false, rumble: true };

  const keys = new Set();
  const pressed = new Set(); // fresh this frame
  const pads = new Map(); // index -> { gp, prev, now, axes, held:Set }
  const handlers = { kind: [], padlost: [], padfound: [], lock: [] };
  const mouse = { dx: 0, dy: 0, wheel: 0 };
  const touch = { move: [0, 0], look: [0, 0], jump: false, jumpPressed: false, sit: false, dig: false, sprint: 0, active: false };
  let kind = 'keyboard';
  let lockEl = null;
  let activePad = null;

  const emit = (name, ...a) => { for (const fn of handlers[name]) fn(...a); };
  const setKind = (k) => { if (k !== kind) { kind = k; emit('kind', k); } };
  const isLocked = () => !!doc && doc.pointerLockElement != null && doc.pointerLockElement === lockEl;

  target.addEventListener('keydown', (e) => {
    if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault?.();
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    setKind('keyboard');
  });
  target.addEventListener('keyup', (e) => keys.delete(e.code));
  target.addEventListener('blur', () => { keys.clear(); mouse.dx = mouse.dy = 0; });
  target.addEventListener('mousemove', (e) => {
    if (isLocked()) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; setKind('pointer'); }
  });
  target.addEventListener('pointerdown', (e) => setKind(e.pointerType === 'touch' ? 'touch' : 'pointer'));
  // The wheel zooms the follow camera during play (the map has its own wheel handler on its view).
  target.addEventListener('wheel', (e) => {
    const px = (e.deltaY || 0) * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
    mouse.wheel += px;
  }, { passive: true });
  doc?.addEventListener?.('pointerlockchange', () => emit('lock', isLocked()));

  const padFresh = (p, b) => !p.held.has(b) && p.now[b] > 0.5 && !(p.prev[b] > 0.5);
  const padDown = (p, b) => !p.held.has(b) && p.now[b] > 0.5;

  const api = {
    settings,
    touch,
    get kind() { return kind; },
    get locked() { return isLocked(); },
    on(name, fn) { handlers[name].push(fn); },
    setKind,
    pads() { return [...pads.keys()]; },
    hasPad() { return pads.size > 0; },
    get activePad() { return activePad; },

    poll() {
      const list = getPads() || [];
      const seen = new Set();
      for (const gp of list) {
        if (!gp || !gp.connected) continue;
        seen.add(gp.index);
        let p = pads.get(gp.index);
        if (!p) {
          // A pad newly seen: whatever it already holds must be let go first.
          p = { gp, prev: [], now: [], axes: [], held: new Set() };
          gp.buttons.forEach((b, i) => b.pressed && p.held.add(i));
          pads.set(gp.index, p);
          if (activePad === null) activePad = gp.index;
          emit('padfound', gp.index);
        }
        p.gp = gp;
        p.prev = p.now;
        p.now = gp.buttons.map((b) => (b.pressed ? Math.max(b.value, 0.6) : b.value));
        p.axes = gp.axes.slice();
        for (const i of [...p.held]) if (!gp.buttons[i]?.pressed) p.held.delete(i);
        const act = p.now.some((v, i) => v > 0.5 && !p.held.has(i) && !(p.prev[i] > 0.5)) || p.axes.some((a) => Math.abs(a) > 0.5);
        if (act) { activePad = gp.index; setKind('controller'); }
      }
      for (const i of [...pads.keys()]) {
        if (!seen.has(i)) {
          pads.delete(i);
          const wasActive = activePad === i;
          if (wasActive) activePad = pads.size ? [...pads.keys()][0] : null;
          emit('padlost', i, wasActive);
        }
      }
    },
    endFrame() { pressed.clear(); mouse.dx = mouse.dy = mouse.wheel = 0; touch.jumpPressed = false; },
    // Whatever is held now is stale until released (after a screen change).
    lockHeld() {
      for (const p of pads.values()) p.now.forEach((v, i) => v > 0.5 && p.held.add(i));
      pressed.clear();
    },
    padAnyPressed() {
      for (const p of pads.values()) if (p.now.some((v, b) => padFresh(p, b))) return true;
      return false;
    },
    padPressed(b) { for (const p of pads.values()) if (padFresh(p, b)) return true; return false; },
    padHeld(b) { for (const p of pads.values()) if (padDown(p, b)) return true; return false; },
    keyPressed(code) { return pressed.has(code); },
    keyDown(code) { return keys.has(code); },
    leftStick() {
      let x = 0; let y = 0;
      for (const p of pads.values()) {
        const [ax, ay] = stick(p.axes[0] || 0, p.axes[1] || 0, 0.2);
        if (Math.abs(ax) > Math.abs(x)) x = ax;
        if (Math.abs(ay) > Math.abs(y)) y = ay;
      }
      return [x, y];
    },
    rightStick() {
      let x = 0; let y = 0;
      for (const p of pads.values()) {
        const [ax, ay] = stick(p.axes[2] || 0, p.axes[3] || 0, 0.2);
        if (Math.abs(ax) > Math.abs(x)) x = ax;
        if (Math.abs(ay) > Math.abs(y)) y = ay;
      }
      return [x, y];
    },

    // Fresh presses for menus, from any device.
    nav() {
      const any = (...codes) => codes.some((c) => pressed.has(c));
      const pad = (b) => api.padPressed(b);
      return {
        up: any('ArrowUp', 'KeyW') || pad(BTN.UP),
        down: any('ArrowDown', 'KeyS') || pad(BTN.DOWN),
        left: any('ArrowLeft', 'KeyA') || pad(BTN.LEFT),
        right: any('ArrowRight', 'KeyD') || pad(BTN.RIGHT),
        confirm: any('Enter', 'NumpadEnter', 'Space') || pad(BTN.A),
        padConfirm: pad(BTN.A),
        back: any('Escape', 'Backspace') || pad(BTN.B),
        pause: any('Escape', 'KeyP') || pad(BTN.MENU),
        menu: pad(BTN.MENU),
        view: any('Tab', 'KeyM') || pad(BTN.VIEW),
        y: any('KeyF') || pad(BTN.Y),
        lb: any('KeyQ') || pad(BTN.LB),
        rb: any('KeyE') || pad(BTN.RB),
        stick: api.leftStick(),
        rstick: api.rightStick(),
      };
    },

    // The controls object for the squirrel this frame.
    controls(dt = 1 / 60) {
      const c = zeroControls();
      const k = (code) => (keys.has(code) ? 1 : 0);
      const anyKey = (codes) => (Array.isArray(codes) ? codes : [codes]).some((x) => keys.has(x));
      // Movement: the stronger of stick, keys and touch.
      let mx = k(KEYS.right) - k(KEYS.left);
      let my = k(KEYS.forward) - k(KEYS.back);
      const kn = Math.hypot(mx, my);
      if (kn > 1) { mx /= kn; my /= kn; }
      let sprint = anyKey(KEYS.sprint) ? 1 : 0;
      let boost = keys.has(KEYS.boost) ? 1 : 0;     // debug superspeed (LT / Q)
      let jump = keys.has(KEYS.jump); let jumpPressed = pressed.has(KEYS.jump);
      let sit = pressed.has(KEYS.sit); let dig = pressed.has(KEYS.dig);
      let recenter = pressed.has(KEYS.recenter);
      // Zoom: Z further, X closer (held), the wheel (down = further).
      let zoom = (k(KEYS.zoomOut) - k(KEYS.zoomIn)) * ZOOM_RATE * dt + mouse.wheel * WHEEL_RATE;
      // Camera from the arrow keys and the mouse.
      const sens = settings.camSens ?? 1;
      let lookX = (k(KEYS.lookRight) - k(KEYS.lookLeft)) * 0.8 * LOOK_RATE * dt * sens;
      let lookY = (k(KEYS.lookDown) - k(KEYS.lookUp)) * 0.8 * LOOK_RATE * dt * sens;
      lookX += mouse.dx * MOUSE_RATE * sens;
      lookY += mouse.dy * MOUSE_RATE * sens;
      let bestMag = Math.hypot(mx, my);
      for (const p of pads.values()) {
        const [sx, sy] = stick(p.axes[0] || 0, p.axes[1] || 0);
        if (Math.hypot(sx, sy) > bestMag) { mx = sx; my = -sy; bestMag = Math.hypot(sx, sy); }
        const [rx, ry] = stick(p.axes[2] || 0, p.axes[3] || 0, DEAD_LOOK);
        // A gentle curve: fine aim near the middle, a quick turn at the edge.
        const shape = (v) => Math.sign(v) * Math.abs(v) ** 1.5;
        lookX += shape(rx) * LOOK_RATE * dt * sens;
        lookY += shape(ry) * LOOK_RATE * dt * sens;
        const rt = p.held.has(BTN.RT) ? 0 : p.now[BTN.RT] || 0;
        sprint = Math.max(sprint, rt < 0.05 ? 0 : rt);
        const lt = p.held.has(BTN.LT) ? 0 : p.now[BTN.LT] || 0;
        boost = Math.max(boost, lt < 0.05 ? 0 : lt);
        if (padDown(p, BTN.A)) jump = true;
        if (padFresh(p, BTN.A)) jumpPressed = true;
        if (padFresh(p, BTN.X)) sit = true;
        if (padFresh(p, BTN.Y)) dig = true;
        if (padFresh(p, BTN.RS)) recenter = true;          // R3 click: camera behind
        zoom += ((padDown(p, BTN.LB) ? 1 : 0) - (padDown(p, BTN.RB) ? 1 : 0)) * ZOOM_RATE * dt;   // LB further, RB closer
      }
      if (touch.active) {
        if (Math.hypot(touch.move[0], touch.move[1]) > bestMag) { mx = touch.move[0]; my = touch.move[1]; }
        lookX += touch.look[0]; lookY += touch.look[1];
        touch.look[0] = touch.look[1] = 0;
        jump = jump || touch.jump; jumpPressed = jumpPressed || touch.jumpPressed;
        sprint = Math.max(sprint, touch.sprint);
        sit = sit || touch.sit; dig = dig || touch.dig;
        touch.sit = touch.dig = false;
      }
      // The camera's vertical direction is set here and only here (the creature
      // cameras take look[1] as given: positive tilts the view up). Default
      // (settings version 2): stick or mouse up looks up; Invert camera Y: up looks down.
      if (!settings.invertY) lookY = -lookY;
      c.move = [mx, my];
      c.look = [lookX, lookY];
      c.jump = jump; c.jumpPressed = jumpPressed; c.sprint = Math.min(1, sprint);
      c.sitPressed = sit; c.digPressed = dig; c.recenter = recenter; c.zoom = zoom; c.boost = Math.min(1, boost);
      return c;
    },

    // True when this frame asks for the map / pause (play only).
    mapPressed() { return pressed.has('Tab') || pressed.has('KeyM') || api.padPressed(BTN.VIEW); },
    pausePressed() { return pressed.has('Escape') || pressed.has('KeyP') || api.padPressed(BTN.MENU); },

    lockPointer(el) {
      if (!doc || !el?.requestPointerLock) return;
      lockEl = el;
      try {
        const r = el.requestPointerLock();
        r?.catch?.(() => {});
      } catch { /* refused */ }
    },
    unlockPointer() {
      try { if (doc?.pointerLockElement) doc.exitPointerLock?.(); } catch { /* fine */ }
    },

    // A light rumble on the pad being played, where the browser has one.
    rumble(strength = 0.4, ms = 120) {
      if (!settings.rumble) return;
      const p = pads.get(activePad);
      const act = p?.gp?.vibrationActuator;
      if (!act?.playEffect) return;
      try {
        act.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: Math.min(1, strength), strongMagnitude: Math.min(1, strength * 0.6) })?.catch?.(() => {});
      } catch { /* fine */ }
    },
  };
  return api;
}
