// Touch controls for phones and tablets. Feeds the same input snapshot the
// keyboard and pad do (src/input.js merges it), so acts need no changes and
// desktop is untouched: nothing here is shown unless the device is touch.
//
// Two schemes, chosen by the shell per scene (show({ mode })):
// - 'swipe' (rows and floors: Acts I, III, IV): the whole screen is the
//   control. Drag forward or back to move (moveX follows how far the finger
//   has travelled from where it settled), swipe up or down to change row,
//   and a quick tap is the act button. The A button stays for holding.
// - 'stick' (free movement: Act II swimming, Act V climbing): a floating
//   stick on the left half, analog in every direction. Its base is kept
//   fully on screen, however far the thumb strays.
// In both, the A button (labelled with its verb) and B when a scene needs it
// sit on the left by default, with the stick zone on the right; drag the A
// button across the screen to swap sides (remembered on this device). Pause
// stays at the top right. Outside play a tap anywhere is a tap.

const DEAD = 0.22;            // stick dead zone (fraction of radius)
const RADIUS = 56;            // px the stick knob may travel
const BASE_R = 66;            // stick base radius (for keeping it on screen)
const DRAG_FULL = 70;         // swipe mode: px of drag for full speed
const FLICK = 38;             // swipe mode: px of vertical travel that counts as a swipe
const FLICK_MS = 320;         // ...within this long
const TAP_MS = 230, TAP_PX = 14;
const REPEAT_FIRST = 0.36, REPEAT_NEXT = 0.14;
const GESTURE_HOLD = 0.28;    // a tap or swipe-up "A" counts as A held this long (full jumps)
const FLICK_GAP = 200;        // ms between swipes within one drag

function label(btn, verb) {
  btn.hidden = !verb;
  if (!verb) { btn.classList.remove('on'); return; }
  const el = btn.querySelector('.verb');
  if (el.textContent !== verb) { el.textContent = verb; el.classList.toggle('long', verb.length > 6); btn.setAttribute('aria-label', verb); }
}

export function isTouchDevice() {
  return matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
}

export function createTouch(root) {
  const zone = root.querySelector('.stick-zone');
  const base = root.querySelector('.stick-base');
  const knob = root.querySelector('.stick-knob');
  const hint = root.querySelector('.stick-hint');
  const btnA = root.querySelector('[data-t=a]');
  const btnB = root.querySelector('[data-t=b]');
  const btnPause = root.querySelector('[data-t=pause]');

  const SIDE_KEY = 'kingdomofthefairies.touchSide';
  let side = 'left';
  try { side = localStorage.getItem(SIDE_KEY) === 'right' ? 'right' : 'left'; } catch { /* storage unavailable */ }
  const applySide = () => root.classList.toggle('a-left', side === 'left');
  applySide();

  const st = { mode: 'stick', holdT: 0, lastFlick: 0, f: null, ax: 0, ay: 0, aHeld: false, bHeld: false, edges: [], used: false, flickUpIsA: false, tapAs: null };
  // A quick tap in play, in stage coordinates (a scene may act on what it lands on).
  let playTap = null;
  const toStage = (x, y) => { const c = root.ownerDocument.getElementById('stage').getBoundingClientRect(); return { x: ((x - c.left) / c.width) * 1280, y: ((y - c.top) / c.height) * 720 }; };
  const rep = { dir: null, t: 0 };
  let taps = [];

  // Keep a stick base centred at (x, y) fully inside the viewport.
  const clampBase = (x, y) => [
    Math.min(innerWidth - BASE_R - 6, Math.max(BASE_R + 6, x)),
    Math.min(innerHeight - BASE_R - 6, Math.max(BASE_R + 6, y)),
  ];
  const placeBase = (x, y) => { base.style.left = x + 'px'; base.style.top = y + 'px'; };

  // ---- one finger on the control area
  zone.addEventListener('pointerdown', (e) => {
    // A finger already tracked whose lift was lost (a system gesture, a
    // hidden layer) must not hold the controls: the new finger takes over.
    if (st.f && st.f.id === e.pointerId) return;
    st.ax = st.ay = 0;
    e.preventDefault();
    zone.setPointerCapture(e.pointerId);
    const now = performance.now();
    st.used = true;
    if (st.mode === 'stick') {
      const [cx, cy] = clampBase(e.clientX, e.clientY);
      st.f = { id: e.pointerId, cx, cy, x0: e.clientX, y0: e.clientY, t0: now, moved: 0 };
      placeBase(cx, cy);
      base.classList.add('on');
      stickMove(e);
    } else {
      st.f = { id: e.pointerId, ax: e.clientX, x0: e.clientX, y0: e.clientY, t0: now, vy: e.clientY, vt: now, moved: 0, peak: e.clientX, lastX: e.clientX };
    }
  });
  zone.addEventListener('pointermove', (e) => {
    if (!st.f || e.pointerId !== st.f.id) return;
    if (st.mode === 'stick') stickMove(e); else swipeMove(e);
  });
  const end = (e) => {
    const f = st.f;
    if (!f || e.pointerId !== f.id) return;
    const tap = performance.now() - f.t0 < TAP_MS && f.moved < TAP_PX;
    // a tap: A in the swipe scheme; in either scheme, whatever the scene makes
    // of a tap (`tapAs`), with where it landed
    if (tap && (st.mode === 'swipe' || st.tapAs)) {
      const as = st.tapAs || 'a';
      st.edges.push(as); if (as === 'a') st.holdT = GESTURE_HOLD;
      playTap = toStage(e.clientX, e.clientY);
    }
    st.f = null; st.ax = 0; st.ay = 0;
    knob.style.transform = '';
    base.classList.remove('on');
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  // the capture lost without a lift: let go, and never as a tap
  zone.addEventListener('lostpointercapture', (e) => { if (st.f && e.pointerId === st.f.id) { st.f.moved = 1e9; end(e); } });
  const release = () => { st.f = null; st.ax = st.ay = 0; st.aHeld = false; st.bHeld = false; base.classList.remove('on'); knob.style.transform = ''; };
  addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });

  function stickMove(e) {
    const f = st.f;
    f.moved = Math.max(f.moved, Math.hypot(e.clientX - f.x0, e.clientY - f.y0));
    let dx = e.clientX - f.cx, dy = e.clientY - f.cy;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      // The base follows a thumb that strays far, but never leaves the screen.
      const over = d - RADIUS;
      [f.cx, f.cy] = clampBase(f.cx + (dx / d) * over, f.cy + (dy / d) * over);
      placeBase(f.cx, f.cy);
      dx = e.clientX - f.cx; dy = e.clientY - f.cy;
      const d2 = Math.hypot(dx, dy);
      if (d2 > RADIUS) { dx = (dx / d2) * RADIUS; dy = (dy / d2) * RADIUS; }
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / RADIUS, ny = dy / RADIUS, m = Math.hypot(nx, ny);
    if (m < DEAD) { st.ax = 0; st.ay = 0; return; }
    const k = (m - DEAD) / (1 - DEAD) / m; // rescale past the dead zone
    st.ax = nx * k; st.ay = ny * k;
  }

  function swipeMove(e) {
    const f = st.f, now = performance.now();
    f.moved = Math.max(f.moved, Math.hypot(e.clientX - f.x0, e.clientY - f.y0));
    // Forward / back: how far the finger has travelled from its anchor; the
    // anchor trails so reversing direction responds at once.
    f.lastX = e.clientX;
    // Reversing: once the finger comes back REVERSE px from the furthest it
    // went, the anchor jumps to that point, so the walk turns at once.
    const REVERSE = 12;
    const sgn = Math.sign(e.clientX - f.ax);
    if (sgn > 0) f.peak = Math.max(f.peak, e.clientX); else if (sgn < 0) f.peak = Math.min(f.peak, e.clientX);
    if (f.peak > f.ax && e.clientX < f.peak - REVERSE) { f.ax = f.peak; f.peak = e.clientX; }
    else if (f.peak < f.ax && e.clientX > f.peak + REVERSE) { f.ax = f.peak; f.peak = e.clientX; }
    let dx = e.clientX - f.ax;
    if (Math.abs(dx) > DRAG_FULL) { f.ax += dx - Math.sign(dx) * DRAG_FULL; dx = Math.sign(dx) * DRAG_FULL; }
    st.ax = Math.abs(dx) < 8 ? 0 : dx / DRAG_FULL;
    // Up / down: a quick vertical swipe changes row; several in one drag work.
    const dy = e.clientY - f.vy;
    if (now - f.vt > FLICK_MS) { f.vy = e.clientY; f.vt = now; }
    else if (Math.abs(dy) > FLICK && Math.abs(dy) > Math.abs(e.clientX - f.x0) * 0.6 && now - st.lastFlick > FLICK_GAP) {
      st.lastFlick = now;
      const asA = dy < 0 && st.flickUpIsA;
      const dir = dy < 0 ? 'up' : 'down';
      // One move per swipe: a second in the same drag needs the finger to reverse.
      if ((asA && f.leapt) || f.lastDir === dir) { f.vy = e.clientY; f.vt = now; return; }
      f.lastDir = dir;
      st.edges.push(asA ? 'a' : dir);
      if (asA) { st.holdT = GESTURE_HOLD; f.leapt = true; }
      f.vy = e.clientY; f.vt = now; f.ax = e.clientX; st.ax = 0;
    }
  }

  // ---- buttons (press = edge, hold = held)
  const press = (el, onDown, onUp) => {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); el.classList.add('on'); st.used = true; onDown(); });
    const up = () => { el.classList.remove('on'); onUp?.(); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  // A: a press; or dragged across the screen, it swaps the controls' sides.
  let aDrag = null;
  btnA.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation(); btnA.setPointerCapture(e.pointerId);
    btnA.classList.add('on'); st.used = true; st.aHeld = true; st.edges.push('a');
    aDrag = { id: e.pointerId, x0: e.clientX, dragging: false };
  });
  btnA.addEventListener('pointermove', (e) => {
    if (!aDrag || e.pointerId !== aDrag.id) return;
    const dx = e.clientX - aDrag.x0;
    if (!aDrag.dragging && Math.abs(dx) > 48) { aDrag.dragging = true; st.aHeld = false; btnA.classList.add('dragging'); }
    if (aDrag.dragging) btnA.style.transform = `translateX(${dx}px)`;
  });
  const aUp = (e) => {
    if (!aDrag || e.pointerId !== aDrag.id) return;
    btnA.classList.remove('on', 'dragging'); btnA.style.transform = ''; st.aHeld = false;
    if (aDrag.dragging) {
      side = e.clientX < innerWidth / 2 ? 'left' : 'right';
      try { localStorage.setItem(SIDE_KEY, side); } catch { /* storage unavailable */ }
      applySide();
    }
    aDrag = null;
  };
  btnA.addEventListener('pointerup', aUp); btnA.addEventListener('pointercancel', aUp);
  press(btnB, () => { st.bHeld = true; st.edges.push('b'); }, () => { st.bHeld = false; });
  press(btnPause, () => st.edges.push('pause'));

  // ---- taps outside play (cards, playbill, curtain call), in stage coords
  root.ownerDocument.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || root.classList.contains('playing')) return;
    if (e.target.closest('button, input, label, .dialog, #title')) return;
    const c = root.ownerDocument.getElementById('stage').getBoundingClientRect();
    taps.push({ x: ((e.clientX - c.left) / c.width) * 1280, y: ((e.clientY - c.top) / c.height) * 720 });
  });

  return {
    // Called by input.poll each frame; returns this frame's touch input.
    poll(dt) {
      st.holdT = Math.max(0, st.holdT - dt);
      const out = { moveX: st.ax, moveY: st.mode === 'stick' ? st.ay : 0, aHeld: st.aHeld || st.holdT > 0, bHeld: st.bHeld, a: false, b: false, pause: false,
        up: false, down: false, left: false, right: false, tap: taps[0] || null, playTap, used: st.used };
      playTap = null;
      for (const e of st.edges) out[e] = true;
      st.edges = []; taps = [];
      if (st.mode === 'stick') {
        // Stick edges with repeat, for row-like moves.
        const dir = Math.hypot(st.ax, st.ay) < 0.45 ? null
          : Math.abs(st.ay) > Math.abs(st.ax) ? (st.ay < 0 ? 'up' : 'down') : (st.ax < 0 ? 'left' : 'right');
        if (dir) {
          if (dir !== rep.dir) { rep.dir = dir; rep.t = REPEAT_FIRST; out[dir] = true; }
          else if ((rep.t -= dt) <= 0) { rep.t = REPEAT_NEXT; out[dir] = true; }
        } else rep.dir = null;
      }
      return out;
    },
    // What the shell shows: play controls, the scheme, the A verb, B.
    // A and B show only when they do something, each named for what it does.
    show({ playing, mode = 'stick', verb, verbB, hintText, flickUpIsA = false, tapAs = null }) {
      st.tapAs = tapAs;
      // a tap anywhere counts: the zone covers the whole screen (the buttons sit above it)
      root.classList.toggle('tap-any', !!tapAs);
      root.hidden = false;
      root.classList.toggle('playing', playing);
      if (mode !== st.mode) { st.mode = mode; st.f = null; st.ax = st.ay = 0; base.classList.remove('on'); knob.style.transform = ''; }
      st.flickUpIsA = flickUpIsA;
      root.classList.toggle('swipe', mode === 'swipe');
      label(btnA, verb); label(btnB, verbB);
      if (!verb) st.aHeld = false;
      if (!verbB) st.bHeld = false;
      if (hintText != null && hint.textContent !== hintText) hint.textContent = hintText;
      if (!playing) { st.f = null; st.ax = st.ay = 0; st.aHeld = false; base.classList.remove('on'); knob.style.transform = ''; }
    },
    hide() { root.hidden = true; root.classList.remove('playing'); },
    // A new scene: a finger still down from the last one counts from where it
    // rests now, so a held drag doesn't carry the prince on by itself.
    settle() { if (st.f && st.mode === 'swipe') { st.f.ax = st.f.lastX; st.f.peak = st.f.lastX; } st.ax = 0; st.ay = 0; },
  };
}
