// On-screen controls for touch screens (phones and tablets). Feeds `input.touch`, which
// src/input.js merges into `controls` like any other device. The logic is in touch-logic.js.
//
// - The play view is one Pointer Events surface (`touch-action: none`: no scrolling or page
//   zoom during play). Each finger gets a role when it goes down and keeps it until it lifts:
//   * on the stick zone (bottom left): the stick. It floats to where the finger lands, or is
//     grabbed where it sits; deflection moves, pushing past the ring runs fast (the ring lights).
//   * on a button (hit-tested by its box, so a hidden button works too): jump / fly / dive,
//     the creature's action (Y) or sit / eat (X).
//   * anywhere else: the camera. A drag orbits it, a tap shows the controls, two fingers pinch
//     to zoom (the LB / RB zoom).
// - The stick and buttons fade out after a few seconds unused and come back on a tap, or at
//   once with the first touch on their zone (which also operates them).
// - Layout follows the screen: sizes from its short side, safe-area insets, and the text panels
//   are placed between the thumbs (landscape) or just above the controls (portrait).

import {
  createTouchRouter, createFader, createLookSmoother, lookRadians, dragThreshold, stickRadius, buttonSizes,
  buttonLabels, HIDE_AFTER,
} from './touch-logic.js';

const ICONS = {
  jump: '<path d="M12 20V7M6 12l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  fly: '<path d="M3 14c4-1 6-4 9-8 1 4 4 7 9 8-4 1-7 0-9-2-2 2-5 3-9 2z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 12v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  dive: '<path d="M3 7c3 2 6-2 9 0s6-2 9 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 10v10M7 15l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
};

export function createTouch(input, { app = document.getElementById('app'), hud = document.getElementById('hud') } = {}) {
  const root = document.getElementById('touch');
  const stickEl = document.getElementById('touch-stick');
  const knob = stickEl.querySelector('.stick-knob');
  const btns = { jump: root.querySelector('[data-touch="jump"]'), action: root.querySelector('[data-touch="action"]'), sit: root.querySelector('[data-touch="sit"]') };
  const t = input.touch;
  const router = createTouchRouter();
  const fader = createFader({ hideAfter: HIDE_AFTER });
  const smooth = createLookSmoother();
  const now = () => performance.now() / 1000;
  let shown = false, active = false, visible = false;
  let geo = { w: 0, h: 0 };
  let labels = '';
  const debug = { last: null };

  // ---- layout ------------------------------------------------------------------------------
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
    + 'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  root.appendChild(probe);
  const insets = () => {
    const cs = getComputedStyle(probe);
    const n = (v) => parseFloat(cs[v]) || 0;
    return { l: n('paddingLeft'), r: n('paddingRight'), b: n('paddingBottom'), t: n('paddingTop') };
  };
  function layout() {
    const w = app.clientWidth, h = app.clientHeight;
    if (w === geo.w && h === geo.h) return;
    const R = stickRadius(w, h), S = buttonSizes(w, h), ins = insets();
    const portrait = h > w;
    const m = Math.max(16, Math.round(Math.min(w, h) * 0.04));
    const ax = ins.l + m + R * 1.3, ay = h - ins.b - m - R * 1.3;       // the stick's resting place
    const jx = w - ins.r - m - S.jump / 2, jy = h - ins.b - m - S.jump / 2;
    // the small buttons on an arc round the jump button: the action above it, sit to its left
    const g = Math.max(8, S.small * 0.18), ring = S.jump / 2 + g + S.small / 2;
    const ac = [jx - ring * Math.sin(0.35), jy - ring * Math.cos(0.35)];
    const sc = [jx - ring * Math.cos(0.3), jy - ring * Math.sin(0.3) + S.jump * 0.12];
    geo = { w, h, R, S, ax, ay, jx, jy, portrait };
    router.radius = R;
    router.threshold = dragThreshold(w, h);
    const st = root.style;
    st.setProperty('--stick-r', `${R}px`);
    st.setProperty('--jump-d', `${S.jump}px`);
    st.setProperty('--small-d', `${S.small}px`);
    place(btns.jump, jx, jy); place(btns.action, ac[0], ac[1]); place(btns.sit, sc[0], sc[1]);
    if (!router.stick) placeStick(ax, ay);
    // the text panels: between the thumbs in landscape, just above the controls in portrait
    const left = ax + R * 1.6 + 10, right = Math.min(sc[0], ac[0]) - S.small / 2 - 10;
    const top = Math.min(ac[1] - S.small / 2, ay - R * 1.6);
    const hs = hud.style;
    if (!portrait && right - left >= 260) {
      const width = Math.min(right - left, 480);
      hs.setProperty('--tb-left', `${Math.round(left + (right - left - width) / 2)}px`);
      hs.setProperty('--tb-width', `${Math.round(width)}px`);
      hs.setProperty('--tb-bottom', `${Math.round(ins.b + 10)}px`);
    } else {
      const width = Math.min(w - ins.l - ins.r - 24, 480);
      hs.setProperty('--tb-left', `${Math.round((w - width) / 2)}px`);
      hs.setProperty('--tb-width', `${Math.round(width)}px`);
      hs.setProperty('--tb-bottom', `${Math.round(h - top + 8)}px`);
    }
  }
  function place(el, x, y) { el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`; }
  function placeStick(x, y) { stickEl.style.left = `${Math.round(x)}px`; stickEl.style.top = `${Math.round(y)}px`; }

  // ---- hit testing (by box, so hidden controls still answer) ----------------------------------
  function zoneAt(x, y) {
    for (const [k, el] of Object.entries(btns)) {
      const r = el.getBoundingClientRect(), pad = 8;
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return `button:${k}`;
    }
    const { w, h, portrait } = geo;
    if (x < w * (portrait ? 0.5 : 0.45) && y > h * (portrait ? 0.5 : 0.3)) return 'stick';
    return 'surface';
  }

  const local = (e) => { const r = app.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  function press(k, on) {
    btns[k].classList.toggle('down', on);
    if (k === 'jump') { if (on) { t.jump = true; t.jumpPressed = true; } else t.jump = router.buttons().includes('jump'); }
    if (on && k === 'action') t.dig = true;
    if (on && k === 'sit') t.sit = true;
  }

  root.addEventListener('pointerdown', (e) => {
    if (!active) return;
    e.preventDefault();
    layout();
    const [x, y] = local(e);
    const zone = zoneAt(x, y);
    let origin = null;
    if (zone === 'stick' && visible && Math.hypot(x - geo.ax, y - geo.ay) < geo.R * 1.3) origin = [geo.ax, geo.ay];
    const role = router.down(e.pointerId, x, y, e.timeStamp, zone, origin);
    try { root.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (role === 'stick') {
      fader.poke(now());
      const s = router.stick;
      stickEl.classList.add('held');
      placeStick(s.ox, s.oy);
    } else if (role === 'button') {
      fader.poke(now());
      press(zone.slice(7), true);
    }
    sync();
  });
  root.addEventListener('pointermove', (e) => {
    if (!active) return;
    const [x, y] = local(e);
    const r = router.move(e.pointerId, x, y);
    if (r === 'stick') { const s = router.stick; placeStick(s.ox, s.oy); sync(); }
  });
  const end = (e, cancelled) => {
    const role = router.roleOf(e.pointerId);
    if (!role) return;
    const [x, y] = local(e);
    const btn = role === 'button' ? router.buttons() : null;
    const r = router.up(e.pointerId, cancelled ? null : x, cancelled ? null : y, e.timeStamp, cancelled);
    debug.last = { role, result: r, cancelled };
    if (role === 'button') {
      const left = router.buttons();
      for (const k of btn) if (!left.includes(k)) press(k, false);
    }
    if (r === 'stick-end') { stickEl.classList.remove('held'); placeStick(geo.ax, geo.ay); }
    if (r === 'tap') fader.poke(now());
    sync();
  };
  root.addEventListener('pointerup', (e) => end(e, false));
  root.addEventListener('pointercancel', (e) => end(e, true));
  root.addEventListener('lostpointercapture', (e) => { if (router.roleOf(e.pointerId)) end(e, true); });
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  function sync() {
    const s = router.stickState();
    t.move = s.move;
    t.sprint = s.sprint;
    knob.style.transform = `translate(${s.knob[0].toFixed(1)}px, ${s.knob[1].toFixed(1)}px)`;
    stickEl.style.setProperty('--sprint', s.sprint.toFixed(2));
    stickEl.classList.toggle('sprint', s.sprint > 0.5);
  }

  function release() {
    router.reset(); smooth.reset();
    t.move = [0, 0]; t.look = [0, 0]; t.jump = false; t.sprint = 0; t.zoom = 0;
    for (const k of Object.keys(btns)) btns[k].classList.remove('down');
    stickEl.classList.remove('held');
    if (geo.w) placeStick(geo.ax, geo.ay);
    sync();
  }

  const api = {
    root, router, fader, debug,
    get shown() { return shown; },
    get visible() { return visible; },
    // On while touch is the input in use (the HUD's touch controls exist only then).
    show(on) {
      on = !!on;
      t.active = on;
      if (on === shown) return;
      shown = on;
      root.hidden = !on;
      if (on) { geo = { w: 0, h: 0 }; layout(); fader.poke(now()); } else release();
    },
    // Taking input: only during play with nothing over it. Off releases every finger.
    setActive(on) {
      on = !!on && shown;
      if (on === active) return;
      active = on;
      root.classList.toggle('live', on);
      if (!on) release(); else fader.poke(now());
    },
    // Called once a frame (before input.controls): camera drag and pinch, fading, labels.
    frame(dt, { kind = 'squirrel', state = 'idle', carried = 0, sens = 1 } = {}) {
      if (!shown) return;
      layout();
      const g = router.take();
      const [rx, ry] = lookRadians(g.dx, g.dy, Math.min(geo.w, geo.h), sens);
      smooth.add(rx, ry);
      const [lx, ly] = smooth.step(dt);
      t.look[0] += lx; t.look[1] += ly;
      t.zoom = (t.zoom || 0) + g.zoom;
      const v = active && fader.visible(now(), router.busy);
      if (v !== visible) { visible = v; root.classList.toggle('idle', !v); }
      const L = buttonLabels(kind, state, { carried });
      const key = `${L.jump}|${L.action}|${L.sit}`;
      if (key !== labels) {
        labels = key;
        btns.jump.querySelector('svg').innerHTML = ICONS[L.icon];
        btns.jump.querySelector('span').textContent = L.jump;
        btns.jump.setAttribute('aria-label', L.jump);
        btns.action.textContent = L.action; btns.action.setAttribute('aria-label', L.action);
        btns.sit.textContent = L.sit; btns.sit.setAttribute('aria-label', L.sit);
      }
    },
    reveal() { fader.poke(now()); },
    release,
    // geometry for checks: the stick's resting centre, the buttons' centres
    geometry() { layout(); return { ...geo }; },
  };
  return api;
}
