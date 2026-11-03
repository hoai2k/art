// The pure logic behind the touch controls (no DOM, so node --test covers it; src/ui/touch.js
// wires it to Pointer Events and the page):
//
//   gesture sizes      dragThreshold, stickRadius, buttonSizes: CSS px scaled to the short side
//   classifyGesture    a press is a 'tap' (quick, little movement), a 'drag' (moved past the
//                      threshold) or 'pending' / 'hold'
//   stickVector        finger offset -> controls.move (dead zone, clamp) + sprint (pushed past
//                      the ring) + the knob's offset
//   createTouchRouter  multi-touch ownership: one finger owns the stick, any number hold
//                      buttons, the rest are camera fingers (a drag looks, a tap reveals the
//                      controls, two camera fingers pinch to zoom). A finger keeps its role from
//                      press to release, so a second finger can never move the stick.
//   createFader        the controls hide after HIDE_AFTER s unused and come back on a tap
//   createLookSmoother camera drag (px) -> radians, eased over a few frames
//   chooseCameraProfile  'touch' or 'console' from the input in use and the pointer type

export const TAP_MS = 280;          // a tap is released within this
export const HIDE_AFTER = 3.5;      // s unused before the controls fade out
export const STICK_DEAD = 0.12;     // dead zone, fraction of the stick radius
export const SPRINT_FROM = 1.0;     // run fast from the ring's edge (fraction of the radius) ...
export const SPRINT_FULL = 1.35;    // ... to full sprint this far out
export const STICK_FOLLOW = 1.6;    // a finger further out than this drags the floating stick along
export const LOOK_TURN = Math.PI;   // a drag across the short side of the screen turns the camera this far
export const LOOK_EASE = 0.035;     // s: the time constant of the look smoothing
export const PINCH_ZOOM = 0.9;      // zoom units for a pinch that changes the finger gap by e (2.7x)

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Movement before a press counts as a drag: about 1.5% of the short side, 8..12 CSS px.
export function dragThreshold(w, h) { return clamp(0.015 * Math.min(w, h), 8, 12); }

// The stick's travel radius in CSS px: 13% of the short side, 44..72 px.
export function stickRadius(w, h) { return Math.round(clamp(0.13 * Math.min(w, h), 44, 72)); }

// Diameters of the jump button and the small action buttons (never under 44 px).
export function buttonSizes(w, h) {
  const s = Math.min(w, h);
  return { jump: Math.round(clamp(0.2 * s, 68, 100)), small: Math.round(clamp(0.13 * s, 46, 64)) };
}

// { dist: the furthest the finger got from where it went down, ms: time held, released }
export function classifyGesture({ dist, ms, released }, threshold, tapMs = TAP_MS) {
  if (dist > threshold) return 'drag';
  if (!released) return 'pending';
  return ms <= tapMs ? 'tap' : 'hold';
}

// Finger offset (CSS px, y down) from the stick's centre -> { move: [x, y up], mag, sprint, knob: [x, y] px }.
export function stickVector(dx, dy, R, dead = STICK_DEAD) {
  const raw = Math.hypot(dx, dy) / R;
  if (!(raw > 0)) return { move: [0, 0], mag: 0, raw: 0, sprint: 0, knob: [0, 0] };
  const ux = dx / (raw * R), uy = dy / (raw * R);
  const mag = raw <= dead ? 0 : Math.min(1, (raw - dead) / (1 - dead));
  const sprint = clamp((raw - SPRINT_FROM) / (SPRINT_FULL - SPRINT_FROM), 0, 1);
  const k = Math.min(raw, 1) * R;
  return { move: [ux * mag + 0, -uy * mag + 0], mag, raw, sprint, knob: [ux * k, uy * k] };
}

// Multi-touch ownership. Zones are given by the caller per press: 'stick', 'button:<name>' or
// 'surface'. Times in ms, positions in CSS px.
export function createTouchRouter({ threshold = 10, tapMs = TAP_MS, radius = 56 } = {}) {
  const ptrs = new Map();              // id -> { role, x0, y0, x, y, t0, dist, ... }
  let stick = null;                    // { id, ox, oy, x, y }
  let lookX = 0, lookY = 0, zoom = 0;  // accumulated since last take
  let pinch = null;                    // { a, b, d0 }
  const r = {
    get threshold() { return threshold; }, set threshold(v) { threshold = v; },
    get radius() { return radius; }, set radius(v) { radius = v; },
    get stick() { return stick; },
    roleOf(id) { return ptrs.get(id)?.role ?? null; },
    buttons() { return [...ptrs.values()].filter((p) => p.role === 'button').map((p) => p.button); },
    cameraFingers() { return [...ptrs.values()].filter((p) => p.role === 'camera').length; },
    get pinching() { return !!pinch; },
    get busy() { return !!stick || [...ptrs.values()].some((p) => p.role === 'button'); },

    // A press. `origin` (optional) is where the stick's centre goes: the anchored stick when
    // the finger lands on it, else the finger itself (a floating stick).
    down(id, x, y, t, zone, origin = null) {
      const p = { id, role: 'camera', x0: x, y0: y, x, y, t0: t, dist: 0, drag: false };
      if (zone === 'stick' && !stick) {
        p.role = 'stick';
        stick = { id, ox: origin ? origin[0] : x, oy: origin ? origin[1] : y, x, y };
      } else if (zone?.startsWith?.('button:')) {
        p.role = 'button'; p.button = zone.slice(7);
      }
      ptrs.set(id, p);
      if (p.role === 'camera') startPinch();
      return p.role;
    },
    move(id, x, y) {
      const p = ptrs.get(id);
      if (!p) return null;
      const lx = p.x, ly = p.y;
      p.x = x; p.y = y;
      p.dist = Math.max(p.dist, Math.hypot(x - p.x0, y - p.y0));
      if (p.role === 'stick') {
        stick.x = x; stick.y = y;
        // a floating stick follows a finger that runs far past its edge
        const dx = x - stick.ox, dy = y - stick.oy, d = Math.hypot(dx, dy), max = STICK_FOLLOW * radius;
        if (d > max) { stick.ox = x - dx / d * max; stick.oy = y - dy / d * max; }
        return 'stick';
      }
      if (p.role !== 'camera') return p.role;
      if (pinch && (id === pinch.a || id === pinch.b)) {
        const a = ptrs.get(pinch.a), b = ptrs.get(pinch.b);
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 1 && pinch.d > 1) zoom += -Math.log(d / pinch.d) * PINCH_ZOOM;   // fingers apart: closer
        pinch.d = d;
        p.drag = p.drag || p.dist > threshold;
        return 'pinch';
      }
      if (!p.drag && p.dist > threshold) { p.drag = true; return 'drag'; }   // the slop is swallowed
      if (p.drag) { lookX += x - lx; lookY += y - ly; }
      return p.drag ? 'drag' : 'pending';
    },
    // A release (or cancel): returns 'tap' for a camera finger that was a tap.
    up(id, x, y, t, cancelled = false) {
      const p = ptrs.get(id);
      if (!p) return null;
      if (x != null) r.move(id, x, y);
      ptrs.delete(id);
      if (p.role === 'stick') { stick = null; return 'stick-end'; }
      if (p.role === 'button') return 'button-end';
      const wasPinch = pinch && (id === pinch.a || id === pinch.b);
      if (wasPinch) {
        pinch = null;
        // the finger left behind carries on looking from where it is
        for (const q of ptrs.values()) if (q.role === 'camera') { q.drag = true; }
        startPinch();
        return 'pinch-end';
      }
      r.lastGesture = { dist: p.dist, ms: t - p.t0, cancelled };
      if (cancelled) return null;
      return classifyGesture({ dist: p.dist, ms: t - p.t0, released: true }, threshold, tapMs) === 'tap' ? 'tap' : null;
    },
    // The accumulated camera drag (px) and pinch zoom since the last call.
    take() { const out = { dx: lookX, dy: lookY, zoom }; lookX = lookY = zoom = 0; return out; },
    reset() { ptrs.clear(); stick = null; pinch = null; lookX = lookY = zoom = 0; },
    stickState() {
      if (!stick) return stickVector(0, 0, radius);
      return stickVector(stick.x - stick.ox, stick.y - stick.oy, radius);
    },
  };
  function startPinch() {
    if (pinch) return;
    const cams = [...ptrs.values()].filter((p) => p.role === 'camera');
    if (cams.length >= 2) {
      const [a, b] = cams;
      pinch = { a: a.id, b: b.id, d: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  }
  return r;
}

// Shown while used, hidden `hideAfter` s after the last use; `poke` shows it again.
export function createFader({ hideAfter = HIDE_AFTER } = {}) {
  let last = -Infinity;
  return {
    poke(now) { last = now; },
    hide() { last = -Infinity; },
    // busy: a finger is on the stick or a button (keeps it shown)
    visible(now, busy = false) { if (busy) last = now; return now - last < hideAfter; },
    get last() { return last; },
  };
}

// Camera drag in CSS px -> radians in input's mouse convention (x > 0 turns right, y > 0 looks
// down; input.js applies invert-Y), scaled to the screen: a swipe across the short side turns
// LOOK_TURN. CSS px are already device-independent, so the device pixel ratio cancels out.
export function lookRadians(dxPx, dyPx, shortSide, sens = 1) {
  const k = (LOOK_TURN / Math.max(200, shortSide)) * sens;
  return [dxPx * k, dyPx * k];
}

// Eases the camera drag over a few frames (no stutter from uneven touch events).
export function createLookSmoother(tau = LOOK_EASE) {
  let px = 0, py = 0;
  return {
    add(x, y) { px += x; py += y; },
    step(dt) {
      const k = 1 - Math.exp(-Math.max(0, dt) / tau);
      const out = [px * k, py * k];
      px -= out[0]; py -= out[1];
      if (Math.abs(px) < 1e-6) px = 0;
      if (Math.abs(py) < 1e-6) py = 0;
      return out;
    },
    get pending() { return [px, py]; },
    reset() { px = py = 0; },
  };
}

// Which follow-camera profile: the touch camera when touch is the input in use, or before any
// input when the device's main pointer is coarse; the console camera once a pad, the keyboard or
// a mouse is used.
export function chooseCameraProfile({ kind = 'keyboard', explicit = false, coarse = false } = {}) {
  if (explicit) return kind === 'touch' ? 'touch' : 'console';
  return coarse || kind === 'touch' ? 'touch' : 'console';
}

// The jump button's label, and the action buttons', for the creature and what it is doing.
export function buttonLabels(kind, state, { carried = 0 } = {}) {
  const flyer = kind === 'swan' || kind === 'heron';
  let jump = 'Jump', icon = 'jump';
  if (flyer) { jump = state === 'fly' ? 'Flap' : 'Fly'; icon = 'fly'; }
  else if (kind === 'beaver' && state === 'swim') { jump = 'Dive'; icon = 'dive'; }
  else if (kind === 'beaver' && state === 'dive') { jump = 'Surface'; icon = 'jump'; }
  else if (state === 'climb') jump = 'Leap';
  const action = { squirrel: 'Dig', beaver: 'Gnaw', rabbit: 'Thump', swan: 'Preen', heron: 'Strike' }[kind] || 'Dig';
  const sit = kind === 'squirrel' && carried > 0 ? 'Eat' : flyer ? 'Rest' : 'Sit';
  return { jump, icon, action, sit };
}
