// Fits the 1280x720 stage into the space that is actually visible.
//
// CSS 100vh/100vw can't be trusted on phones: iOS Safari's 100vh ignores its
// address and tab bars, so a stage sized with it runs off the bottom. Here
// the visible box is measured from the visual viewport, less the safe-area
// insets (notch, home bar), and the stage is scaled to fit it:
// - it is letterboxed (never stretched) when the shapes differ;
// - only decorative edges may be cropped: when the box is narrower than 16:9
//   on a desktop window, up to CROP_SIDE stage px of painted drape on each
//   side, so the play area can be larger. The valance (it carries Act I's
//   wind vane), the floor band (the HUD) and the play area are never cropped.
//   Touch tablets keep the full width, because their controls live in the
//   band below the stage (styles.css).
// The measured box is published as CSS variables (--app-w, --app-h,
// --stage-w, --stage-h, --stage-x, --stage-y) for layout that needs it.

const W = 1280, H = 720;
export const CROP_SIDE = 100;

export function createFit({ app, stage, touch, onChange }) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const root = document.documentElement.style;
  let last = '';

  function fit() {
    const vv = window.visualViewport;
    const vw = Math.round(vv ? vv.width : innerWidth), vh = Math.round(vv ? vv.height : innerHeight);
    const ox = vv ? Math.round(vv.offsetLeft) : 0, oy = vv ? Math.round(vv.offsetTop) : 0;
    const cs = getComputedStyle(probe);
    const inset = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    const key = [vw, vh, ox, oy, inset.t, inset.r, inset.b, inset.l, touch].join(',');
    if (key === last) return;
    last = key;

    // #app covers exactly the visible viewport (it follows Safari's bars).
    Object.assign(app.style, { left: ox + 'px', top: oy + 'px', width: vw + 'px', height: vh + 'px', right: 'auto', bottom: 'auto' });
    const aw = Math.max(1, vw - inset.l - inset.r), ah = Math.max(1, vh - inset.t - inset.b);

    // Visible part of the stage: all of it, or with the side drapes trimmed.
    const canCrop = !touch && aw / ah < W / H;
    const visW = canCrop ? Math.max(W - 2 * CROP_SIDE, Math.min(W, (aw / ah) * H)) : W;
    const scale = Math.min(aw / visW, ah / H);
    const sw = W * scale, sh = H * scale, cropX = ((W - visW) / 2) * scale;
    const showW = sw - 2 * cropX;
    // Centre the visible part; tablets pin it to the top (controls go below).
    const x = inset.l + (aw - showW) / 2 - cropX;
    const pinTop = touch && aw / ah < 16 / 10.5;
    const y = inset.t + (pinTop ? 0 : (ah - sh) / 2);
    Object.assign(stage.style, { position: 'absolute', left: x + 'px', top: y + 'px', width: sw + 'px', height: sh + 'px', margin: '0' });
    // A clip so cropped drape doesn't spill into the letterbox.
    const clipL = Math.max(0, cropX), clipR = Math.max(0, cropX);
    stage.style.clipPath = clipL ? `inset(0 ${clipR}px 0 ${clipL}px)` : '';

    root.setProperty('--app-w', vw + 'px'); root.setProperty('--app-h', vh + 'px');
    root.setProperty('--stage-w', showW + 'px'); root.setProperty('--stage-h', sh + 'px');
    root.setProperty('--stage-x', (x + cropX) + 'px'); root.setProperty('--stage-y', y + 'px');
    root.setProperty('--band-below', Math.max(0, vh - inset.b - (y + sh)) + 'px');
    onChange?.({ vw, vh, scale, visW, x, y, sw, sh, inset });
  }

  addEventListener('resize', fit);
  addEventListener('orientationchange', () => setTimeout(fit, 120));
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);
  document.addEventListener('fullscreenchange', () => setTimeout(fit, 60));
  // iOS settles its bars a beat after rotation and scroll; re-measure briefly.
  setInterval(fit, 500);
  fit();
  return { fit };
}
