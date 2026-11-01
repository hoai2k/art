// Fits the 1280 x 720 canvas into the space that is actually visible.
//
// CSS 100vh can't be trusted on phones: iOS Safari's 100vh ignores its
// address and tab bars, so a stage sized with it runs off the bottom. Here
// the visible box is measured from the visual viewport, less the safe-area
// insets (notch, home bar), and the canvas is letterboxed into it (never
// stretched). The same approach as Widow's Bay (widowsbay/src/fit.js).

const W = 1280;
const H = 720;
// Phones are wider than 16:9 (about 2.17:1 on an iPhone held sideways). There
// the canvas takes the full width instead of leaving bars beside it: the
// renderer widens its view to match (Renderer.resize, render.js), up to this
// aspect; anything wider still gets bars.
const MAX_ASPECT = 2.4;
const coarse = matchMedia('(pointer: coarse)');

export function createFit({ app, stage, onChange }) {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  let last = '';

  function fit() {
    const vv = window.visualViewport;
    const vw = Math.round(vv ? vv.width : innerWidth);
    const vh = Math.round(vv ? vv.height : innerHeight);
    const ox = vv ? Math.round(vv.offsetLeft) : 0;
    const oy = vv ? Math.round(vv.offsetTop) : 0;
    const cs = getComputedStyle(probe);
    const inset = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    const key = [coarse.matches, vw, vh, ox, oy, inset.t, inset.r, inset.b, inset.l].join(',');
    if (key === last) return;
    last = key;
    // #app covers exactly the visible viewport (it follows Safari's bars).
    Object.assign(app.style, { left: ox + 'px', top: oy + 'px', width: vw + 'px', height: vh + 'px', right: 'auto', bottom: 'auto' });
    const aw = Math.max(1, vw - inset.l - inset.r);
    const ah = Math.max(1, vh - inset.t - inset.b);
    const scale = Math.min(aw / W, ah / H);
    const wide = coarse.matches && aw / ah > W / H;
    const sw = wide ? Math.min(aw, ah * MAX_ASPECT) : W * scale;
    const sh = H * scale;
    Object.assign(stage.style, {
      position: 'absolute', left: inset.l + (aw - sw) / 2 + 'px', top: inset.t + (ah - sh) / 2 + 'px',
      width: sw + 'px', height: sh + 'px', maxWidth: 'none', maxHeight: 'none', margin: '0',
    });
    onChange?.();
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
