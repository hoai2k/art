// On-screen controls for touch: the left side is a stick, a drag on the rest of
// the screen turns the camera, buttons do the rest. Feeds input.touch.

export function createTouch(input, { onMap }) {
  const root = document.getElementById('touch');
  const zone = document.getElementById('touch-move');
  const knob = zone.querySelector('i');
  const t = input.touch;
  let moveId = null; let origin = null; let lookId = null; let last = null;
  const R = 48;

  zone.addEventListener('pointerdown', (e) => {
    if (moveId !== null) return;
    moveId = e.pointerId; origin = [e.clientX, e.clientY];
    zone.setPointerCapture(e.pointerId); t.active = true;
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== moveId) return;
    const dx = (e.clientX - origin[0]) / R; const dy = (e.clientY - origin[1]) / R;
    const m = Math.hypot(dx, dy); const k = m > 1 ? 1 / m : 1;
    t.move = [dx * k, -dy * k];
    knob.style.setProperty('--dx', `${dx * k * 30}px`); knob.style.setProperty('--dy', `${dy * k * 30}px`);
  });
  const endMove = (e) => {
    if (e.pointerId !== moveId) return;
    moveId = null; t.move = [0, 0]; knob.style.setProperty('--dx', '0px'); knob.style.setProperty('--dy', '0px');
  };
  zone.addEventListener('pointerup', endMove); zone.addEventListener('pointercancel', endMove);

  // The camera: any drag on the game view outside the controls.
  const gl = document.getElementById('app');
  gl.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || root.hidden || e.target.closest('.stick-zone, .touch-btns, .hud-pause, .modal')) return;
    lookId = e.pointerId; last = [e.clientX, e.clientY]; t.active = true;
  });
  gl.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    t.look[0] += (e.clientX - last[0]) * 0.005 * (input.settings.camSens ?? 1);
    t.look[1] += (e.clientY - last[1]) * 0.005 * (input.settings.camSens ?? 1);
    last = [e.clientX, e.clientY];
  });
  const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
  gl.addEventListener('pointerup', endLook); gl.addEventListener('pointercancel', endLook);

  for (const b of root.querySelectorAll('[data-touch]')) {
    const k = b.dataset.touch;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); t.active = true;
      if (k === 'jump') { t.jump = true; t.jumpPressed = true; }
      if (k === 'sprint') t.sprint = 1;
      if (k === 'dig') t.dig = true;
      if (k === 'sit') t.sit = true;
    });
    const up = () => { if (k === 'jump') t.jump = false; if (k === 'sprint') t.sprint = 0; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  }
  root.querySelector('[data-action="map"]')?.addEventListener('click', () => onMap());
  return { show(on) { root.hidden = !on; }, };
}
