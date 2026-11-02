// Screens, dialogs and controller-first focus. DOM-driven: every control that
// the controller can reach carries `data-nav`; panels are the sections with
// class `modal` (stacked: a panel opened over another returns to it).
//
// Title rules (GAME_GUIDELINES.md): while idle any fresh controller button
// starts; moving the left stick opens utility navigation over Press Start and
// the corner buttons; then A activates, B backs out, Menu starts.

import { BTN } from '../input.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function createMenus({ input, audio, hooks }) {
  const ui = {
    screen: 'loading', // loading | title | play
    modals: [],
    focus: 0,
    titleNav: false,
    returnFocus: {},
    stick: null,
    menuAt: 0,
    padSince: null,
  };

  const items = () => {
    const c = container();
    return c ? $$('[data-nav]', c).filter((el) => el.offsetParent !== null || el === document.activeElement) : [];
  };
  function container() {
    if (ui.modals.length) return document.getElementById(ui.modals.at(-1));
    if (ui.screen === 'title') return $('#title');
    return null;
  }

  function refreshFocus(moveDom = false) {
    const list = items();
    for (const el of $$('.focused')) el.classList.remove('focused');
    if (!list.length) return;
    const usingPad = input.kind === 'controller';
    ui.focus = Math.max(0, Math.min(ui.focus, list.length - 1));
    const el = list[ui.focus];
    const titleIdle = ui.screen === 'title' && !ui.modals.length && !ui.titleNav;
    if (usingPad && !titleIdle) el.classList.add('focused');
    if (moveDom || usingPad) {
      if (!titleIdle || ui.modals.length) el.focus({ preventScroll: false });
    }
    $('#nav-hint').hidden = !(ui.screen === 'title' && !ui.modals.length && !ui.titleNav && input.hasPad());
  }

  function setScreen(screen) {
    ui.screen = screen;
    $('#loading').hidden = screen !== 'loading';
    $('#title').hidden = screen !== 'title';
    $('#hud').hidden = screen !== 'play';
    ui.titleNav = false;
    ui.focus = 0;
    refreshFocus();
    updateNotes();
  }

  function updateNotes() {
    const note = $('#pad-note');
    if (note) note.hidden = true; // the controller hint below is enough once one is connected
    const nh = $('#nav-hint');
    if (nh) nh.hidden = !(ui.screen === 'title' && !ui.modals.length && !ui.titleNav && input.hasPad());
  }

  const stickDirection = (sx, sy) => {
    const m = Math.hypot(sx, sy);
    if (m < (ui.stick ? 0.35 : 0.55)) return null;
    return Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 'right' : 'left') : sy > 0 ? 'down' : 'up';
  };
  function stickRepeat(sx, sy, now) {
    const d = stickDirection(sx, sy);
    if (!d) { ui.stick = null; return null; }
    if (!ui.stick || ui.stick.dir !== d) { ui.stick = { dir: d, next: now + 420 }; return d; }
    if (now >= ui.stick.next) { ui.stick.next = now + 170; return d; }
    return null;
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    hooks.beforeOpen?.(id);
    if (ui.modals.at(-1) !== id) ui.returnFocus[ui.modals.at(-1) || ui.screen] = ui.focus;
    el.hidden = false;
    ui.modals = ui.modals.filter((m) => m !== id);
    ui.modals.push(id);
    el.style.zIndex = String(20 + ui.modals.length);
    ui.focus = 0;
    input.lockHeld();
    const [hx, hy] = input.leftStick();
    ui.stick = Math.hypot(hx, hy) > 0.35 ? { dir: stickDirection(hx, hy), next: Infinity } : null;
    refreshFocus(true);
    updateNotes();
    audio?.play('open');
    hooks.afterOpen?.(id);
  }

  function closeModal() {
    const id = ui.modals.pop();
    if (!id) return;
    document.getElementById(id).hidden = true;
    const below = ui.modals.at(-1) || ui.screen;
    ui.focus = ui.returnFocus[below] ?? 0;
    delete ui.returnFocus[below];
    input.lockHeld();
    audio?.play('back');
    hooks.afterClose?.(id);
    if (!ui.modals.length) hooks.onEmpty?.();
    refreshFocus(true);
    updateNotes();
  }

  function closeAll(silent = false) {
    for (const id of ui.modals) document.getElementById(id).hidden = true;
    ui.modals = [];
    ui.returnFocus = {};
    if (!silent) hooks.onEmpty?.();
    updateNotes();
  }

  function activate(el) {
    if (!el) return;
    if (el.matches('input[type="checkbox"]')) {
      el.checked = !el.checked;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (el.matches('input[type="range"]')) return;
    el.click();
  }

  // Called once a frame, with input.nav(), while any menu or the title is up
  // (and for the play-time shortcuts, handled by main).
  function handle(nav, now) {
    const top = ui.modals.at(-1);
    if (ui.screen === 'title' && !ui.modals.length) {
      const [sx, sy] = nav.stick;
      if (!ui.titleNav && Math.hypot(sx, sy) > 0.5) {
        ui.titleNav = true;
        ui.focus = 0;
        ui.stick = { dir: stickDirection(sx, sy), next: now + 420 };
        refreshFocus(true);
        updateNotes();
        return;
      }
      if (!ui.titleNav && input.padAnyPressed()) {
        input.lockHeld();
        hooks.start();
        return;
      }
      if (ui.titleNav && input.padPressed(BTN.MENU)) { hooks.start(); return; }
    }
    if (!top && ui.screen !== 'title') return;

    const list = items();
    const dt = Math.min(0.1, Math.max(0, (now - ui.menuAt) / 1000));
    ui.menuAt = now;

    // The map owns the sticks.
    if (top === 'map') {
      hooks.mapFrame?.(nav, dt);
      if (nav.back || nav.view || nav.pause) closeModal();
      return;
    }

    const scroller = top && document.getElementById(top).querySelector('.scroll');
    const reads = scroller && !scroller.querySelector('[data-nav]') && scroller.scrollHeight > scroller.clientHeight + 2;
    const instr = top === 'instructions';
    const [sx, sy] = nav.stick;
    if (reads || instr) {
      let ry = Math.abs(sy) > 0.25 ? sy : 0;
      const rs = nav.rstick;
      if (Math.abs(rs[1]) > 0.25) ry = rs[1];
      const pad = input.padHeld(BTN.UP) ? -1 : input.padHeld(BTN.DOWN) ? 1 : 0;
      if (!pad) ui.padSince = null; else if (ui.padSince === null) ui.padSince = now;
      if (pad && now - ui.padSince > 350) ry = pad;
      if (ry && scroller) scroller.scrollTop += ry * 700 * dt;
      else if ((nav.up || nav.down) && scroller) scroller.scrollTop += (nav.up ? -1 : 1) * 120;
    }
    const stickStep = stickRepeat(sx, sy, now);
    const want = (d) => ((reads || instr) && (d === 'up' || d === 'down') ? false : nav[d] || stickStep === d);
    const cur = list[ui.focus];
    let dir = 0;
    const isRange = cur?.matches?.('input[type="range"]');
    const isChoice = cur?.classList?.contains('choice');
    if ((isRange || isChoice) && (want('left') || want('right'))) {
      const step = want('left') ? -1 : 1;
      if (isRange) {
        cur.value = Number(cur.value) + step * Number(cur.step || 1);
        cur.dispatchEvent(new Event('input', { bubbles: true }));
      } else cur.dispatchEvent(new CustomEvent('step', { detail: step }));
      audio?.play('move');
    } else if (want('left')) dir = -1;
    else if (want('right')) dir = 1;
    const row = cur?.closest?.('.corner-buttons') ? 1 : 1;
    if (want('up')) dir = -row;
    else if (want('down')) dir = row;
    if (dir && list.length) {
      ui.focus = (ui.focus + dir + list.length) % list.length;
      refreshFocus(true);
      audio?.play('move');
    }
    if (scroller && !reads && !instr) {
      const ry = nav.rstick[1];
      if (ry) scroller.scrollTop += ry * 700 * dt;
    }
    // On the pad A activates; keyboard Enter and Space click the focused button natively.
    if (nav.padConfirm && list[ui.focus]) activate(list[ui.focus]);
    if (nav.back || (top === 'pause' && nav.pause)) {
      if (top) closeModal();
      else if (ui.screen === 'title' && ui.titleNav) { ui.titleNav = false; refreshFocus(); updateNotes(); }
    }
  }

  return { ui, setScreen, openModal, closeModal, closeAll, handle, refreshFocus, updateNotes, activate };
}
