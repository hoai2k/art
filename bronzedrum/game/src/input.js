// Keyboard, mouse, touch and Xbox-controller input. Drum hits carry a timestamp
// on the performance.now() clock so the game can map them onto the audio
// clock; menu actions are plain names.

const DRUM_KEYS = {
  KeyF: 'L', KeyD: 'L', KeyA: 'L', ArrowLeft: 'L',
  KeyJ: 'R', KeyK: 'R', KeyL: 'R', ArrowRight: 'R',
};
const NAV_KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'confirm', Space: 'confirm', Escape: 'back', Backspace: 'back',
};

/**
 * A pointer event in the game's 1280 x 720 layout. The canvas is drawn at one
 * scale both ways, and when it is wider than 16:9 (a phone, src/fit.js) the
 * layout sits in its middle, so x can run below 0 or past 1280.
 */
function toLogical(e, r) {
  const s = r.height / 720 || 1;
  return { x: (e.clientX - r.left - r.width / 2) / s + 640, y: (e.clientY - r.top) / s };
}

// Standard gamepad mapping.
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
// Only X and B strike the drum (Y the secondary drum in Drum Practice): the
// shoulder buttons, triggers and d-pad do not, so a resting finger cannot.
const PAD_DRUM = { [PAD.X]: 'L', [PAD.B]: 'R' };
const PAD_NAV = { [PAD.UP]: 'up', [PAD.DOWN]: 'down', [PAD.LEFT]: 'left', [PAD.RIGHT]: 'right', [PAD.A]: 'confirm', [PAD.B]: 'back', [PAD.MENU]: 'menu' };
// Drum Practice: Y strikes the secondary drum and LB and RB choose it; the
// d-pad's up and down add and take away beats.
const PAD_PRACTICE = { [PAD.LB]: 'secondPrev', [PAD.RB]: 'secondNext', [PAD.UP]: 'more', [PAD.DOWN]: 'fewer' };
// Training (Drum Practice): the d-pad (the arrow keys) chooses the level (◀ ▶)
// and the rhythm (▲ ▼). There the arrow keys do not drum.
const PAD_TRAINING = { [PAD.LEFT]: 'levelPrev', [PAD.RIGHT]: 'levelNext', [PAD.UP]: 'rhythmPrev', [PAD.DOWN]: 'rhythmNext' };
const KEY_TRAINING = { ArrowLeft: 'levelPrev', ArrowRight: 'levelNext', ArrowUp: 'rhythmPrev', ArrowDown: 'rhythmNext' };
const KEY_PRACTICE = {
  Minus: 'fewer', NumpadSubtract: 'fewer', ArrowDown: 'fewer',
  Equal: 'more', NumpadAdd: 'more', ArrowUp: 'more',
  BracketLeft: 'secondPrev', BracketRight: 'secondNext',
};
const DEAD = 0.5;
const REPEAT_FIRST = 0.38;
const REPEAT_NEXT = 0.14;
const SWIPE = 110; // logical pixels a finger must travel sideways to swipe

export class Input {
  constructor(target) {
    this.handlers = { drum: [], nav: [], device: [], padButton: [], stick: [], action: [], touch: [], swipe: [] };
    this.mode = 'menu'; // 'menu' | 'play'
    this.practice = false; // Drum Practice: the extra controls above
    this.training = false; // Training: the d-pad and arrows choose the level and the rhythm
    this.pointerPick = null; // (x, y) -> true if a click there chose something (Training)
    this.device = 'keyboard';
    this.padIndex = null;
    this.prev = [];
    this.stickDir = null;
    this.stickNext = 0;
    this.armed = false; // ignore buttons held when a gamepad first appears
    this.vibration = true;

    this.keysDown = new Set(); // for buttons that act while held (the Oath's wind)
    window.addEventListener('keydown', (e) => {
      this.keysDown.add(e.code);
      this.onKey(e);
    });
    window.addEventListener('keyup', (e) => this.keysDown.delete(e.code));
    window.addEventListener('blur', () => this.keysDown.clear());
    window.addEventListener('gamepadconnected', (e) => {
      if (this.padIndex === null) this.padIndex = e.gamepad.index;
      this.armed = false;
      this.emit('device', { type: 'connected' });
      // A controller has no events, only state to poll. Polled once a frame,
      // a stroke would wait for the next frame (up to 17 ms at 60 fps, 33 ms
      // when the frame rate dips) before it sounds, so it is also polled
      // every 4 ms between frames (the frame loop still calls poll() too).
      if (!this.fastPoll) this.fastPoll = setInterval(() => this.poll(), 4);
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (e.gamepad.index === this.padIndex) {
        this.padIndex = null;
        this.emit('device', { type: 'disconnected' });
      }
      const any = navigator.getGamepads && [...navigator.getGamepads()].some(Boolean);
      if (!any && this.fastPoll) {
        clearInterval(this.fastPoll);
        this.fastPoll = null;
      }
    });
    // Mouse: the left and right halves of the canvas are the two drummers, and
    // clicking the bronze drum raises the guard.
    target.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'play' || e.pointerType === 'touch' || e.pointerType === 'pen') return;
      const r = target.getBoundingClientRect();
      this.setDevice('pointer');
      // Training's tabs and list take clicks before the drum does.
      const p = toLogical(e, r);
      if (this.pointerPick && this.pointerPick(p.x, p.y)) {
        e.preventDefault();
        return;
      }
      const dx = p.x - 640;
      const dy = ((e.clientY - r.top) / r.height - 628 / 720) * 720;
      if (Math.hypot(dx, dy) < 72) {
        this.emit('action', { action: 'guard', time: e.timeStamp });
        e.preventDefault();
        return;
      }
      const drum = e.clientX - r.left < r.width / 2 ? 'L' : 'R';
      this.emit('drum', { drum, time: e.timeStamp });
      e.preventDefault();
    });
    // Touch and pen: the game lays out a big drum and on-screen buttons, so
    // pass the point on in the canvas's 1280 x 720 coordinates. Listening on
    // the whole app lets the letterbox beside the canvas take thumb taps too.
    const app = target.parentElement || target;
    const logical = (e) => toLogical(e, target.getBoundingClientRect());
    const fingers = new Map(); // pointerId -> where and when it landed
    app.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'play' || (e.pointerType !== 'touch' && e.pointerType !== 'pen')) return;
      this.setDevice('touch');
      const p = logical(e);
      fingers.set(e.pointerId, { ...p, time: e.timeStamp, swiped: false });
      this.emit('touch', { ...p, time: e.timeStamp });
      e.preventDefault();
    });
    // A quick sideways stroke of one finger is a swipe (the game uses it to
    // reset the rhythm when it starts on the drum or the dots).
    app.addEventListener('pointermove', (e) => {
      const f = fingers.get(e.pointerId);
      if (!f || f.swiped || this.mode !== 'play') return;
      const p = logical(e);
      const dx = p.x - f.x;
      const dy = p.y - f.y;
      if (e.timeStamp - f.time < 700 && Math.abs(dx) > SWIPE && Math.abs(dx) > 1.5 * Math.abs(dy)) {
        f.swiped = true;
        this.emit('swipe', { x0: f.x, y0: f.y, x: p.x, y: p.y, time: e.timeStamp });
      }
    });
    for (const type of ['pointerup', 'pointercancel']) app.addEventListener(type, (e) => fingers.delete(e.pointerId));
  }

  on(type, fn) {
    this.handlers[type].push(fn);
  }

  emit(type, data) {
    for (const fn of this.handlers[type]) fn(data);
  }

  setDevice(d) {
    if (d !== this.device) {
      this.device = d;
      this.emit('device', { type: 'switch', device: d });
    }
  }

  onKey(e) {
    if (e.repeat) {
      if (this.mode === 'menu' && NAV_KEYS[e.code] && e.code.startsWith('Arrow')) this.emit('nav', NAV_KEYS[e.code]);
      return;
    }
    this.setDevice('keyboard');
    if (this.mode === 'play') {
      if (this.training && KEY_TRAINING[e.code]) {
        this.emit('action', { action: KEY_TRAINING[e.code], time: e.timeStamp });
        e.preventDefault();
        return;
      }
      if (DRUM_KEYS[e.code]) {
        this.emit('drum', { drum: DRUM_KEYS[e.code], time: e.timeStamp });
        e.preventDefault();
        return;
      }
      // Drum Practice's secondary drum: G or H (Y on a controller).
      if (this.practice && (e.code === 'KeyG' || e.code === 'KeyH')) {
        this.emit('drum', { drum: 'S', time: e.timeStamp });
        e.preventDefault();
        return;
      }
      if (this.practice && KEY_PRACTICE[e.code]) {
        this.emit('action', { action: KEY_PRACTICE[e.code], time: e.timeStamp });
        e.preventDefault();
        return;
      }
      // Space is the one shield-and-clear button (Enter goes on from a success screen).
      const act = { Space: 'guard', Enter: 'confirm', NumpadEnter: 'confirm' }[e.code];
      if (act) {
        this.emit('action', { action: act, time: e.timeStamp });
        e.preventDefault();
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.emit('nav', 'menu');
        e.preventDefault();
      }
      return;
    }
    const nav = NAV_KEYS[e.code];
    if (nav) {
      // Let native controls (sliders) keep their own arrow handling.
      const t = e.target;
      if (t && t.tagName === 'INPUT' && t.type === 'range' && (nav === 'left' || nav === 'right')) return;
      this.emit('nav', nav);
      e.preventDefault();
    }
  }

  /** Whether A (Space) or Y (R) is held now: the Oath's breeze, one way or the other. */
  held(action) {
    const keys = action === 'guard' ? ['Space'] : ['KeyR', 'Backspace'];
    const button = action === 'guard' ? PAD.A : PAD.Y;
    return keys.some((k) => this.keysDown.has(k)) || !!this.prev[button];
  }

  pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (this.padIndex === null) {
      for (const p of pads) if (p) { this.padIndex = p.index; break; }
    }
    return this.padIndex === null ? null : pads[this.padIndex];
  }

  rumble(ms = 60, strength = 0.5) {
    if (!this.vibration) return;
    if (this.device === 'touch') {
      // Phones buzz for a duration only; keep taps short so fast rhythms stay crisp.
      if (navigator.vibrate) navigator.vibrate(Math.round(Math.min(ms, 40) * (0.5 + strength / 2)));
      return;
    }
    const p = this.pad();
    const act = p && p.vibrationActuator;
    if (act && act.playEffect) act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength }).catch(() => {});
  }

  /** Poll the controller once per frame. */
  poll() {
    const p = this.pad();
    if (!p) return;
    const now = performance.now();
    // When the controller's state last changed (same clock as performance.now()),
    // so a stroke is timed from the press rather than from when it was polled.
    const stamp = p.timestamp > 0 && p.timestamp <= now && now - p.timestamp < 50 ? p.timestamp : now;
    const pressed = p.buttons.map((b) => b.pressed || b.value > 0.5);
    if (!this.armed) {
      // Wait until every button is released so a held press does not fire.
      if (!pressed.some(Boolean)) this.armed = true;
      this.prev = pressed;
      return;
    }
    pressed.forEach((down, i) => {
      if (!down || this.prev[i]) return;
      this.setDevice('gamepad');
      this.emit('padButton', i);
      if (this.mode === 'play') {
        if (this.training && PAD_TRAINING[i]) this.emit('action', { action: PAD_TRAINING[i], time: stamp });
        else if (this.practice && i === PAD.Y) this.emit('drum', { drum: 'S', time: stamp });
        else if (this.practice && PAD_PRACTICE[i]) this.emit('action', { action: PAD_PRACTICE[i], time: stamp });
        else if (PAD_DRUM[i]) this.emit('drum', { drum: PAD_DRUM[i], time: stamp });
        else if (i === PAD.A) this.emit('action', { action: 'guard', time: stamp });
        else if (i === PAD.MENU || i === PAD.VIEW) this.emit('nav', 'menu');
      } else if (PAD_NAV[i]) {
        this.emit('nav', PAD_NAV[i]);
      }
    });
    this.prev = pressed;

    if (this.mode === 'menu') {
      const [x, y] = [p.axes[0] || 0, p.axes[1] || 0];
      let dir = null;
      if (Math.hypot(x, y) > DEAD) dir = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
      if (dir) {
        const t = now / 1000;
        if (dir !== this.stickDir) {
          this.stickDir = dir;
          this.stickNext = t + REPEAT_FIRST;
          this.setDevice('gamepad');
          this.emit('stick', dir);
          this.emit('nav', dir);
        } else if (t >= this.stickNext) {
          this.stickNext = t + REPEAT_NEXT;
          this.emit('nav', dir);
        }
      } else {
        this.stickDir = null;
      }
    }
  }
}
