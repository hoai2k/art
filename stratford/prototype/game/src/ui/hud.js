// The HUD: nut and landmark counters, a compass strip, the discovery card, a
// contextual hint line, the controls strip and toasts.

const $ = (s) => document.querySelector(s);

const POINTS = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];

const STRIPS = {
  controller: [['', 'Left stick', 'Move'], ['a', 'A', 'Jump'], ['', 'RT', 'Run'], ['x', 'X', 'Sit'], ['y', 'Y', 'Dig'], ['', 'LB RB', 'Zoom'], ['', 'View', 'Map'], ['', 'Menu', 'Pause']],
  keyboard: [['', 'WASD', 'Move'], ['', 'Space', 'Jump'], ['', 'Shift', 'Run'], ['', 'E', 'Sit'], ['', 'F', 'Dig'], ['', 'Z X', 'Zoom'], ['', 'M', 'Map'], ['', 'Esc', 'Pause']],
  pointer: [['', 'WASD', 'Move'], ['', 'Space', 'Jump'], ['', 'Shift', 'Run'], ['', 'E', 'Sit'], ['', 'F', 'Dig'], ['', 'Wheel', 'Zoom'], ['', 'M', 'Map'], ['', 'Esc', 'Pause']],
  touch: [],
};

export function createHud({ reduceMotion = false } = {}) {
  const els = {
    hud: $('#hud'), nuts: $('#hud-nuts'), nutsTotal: $('#hud-nuts-total'), carry: $('#hud-carry'), lm: $('#hud-lm'), lmTotal: $('#hud-lm-total'),
    compass: $('#compass'), card: $('#discovery'), name: $('#d-name'), blurb: $('#d-blurb'), ctx: $('#ctx-hint'), strip: $('#hint-strip'), toast: $('#toast'),
  };
  const cctx = els.compass.getContext('2d');
  let lastHeading = null;
  let cardTimer = 0;
  let toastTimer = 0;
  let stripLeft = 0;
  let kind = 'keyboard';
  let hintsOn = true;
  let ctxText = '';

  function drawCompass(deg) {
    const W = els.compass.width; const H = els.compass.height;
    const c = cctx;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(42,29,20,0.68)';
    c.beginPath(); c.roundRect(2, 6, W - 4, H - 12, 22); c.fill();
    c.strokeStyle = 'rgba(244,232,207,0.55)'; c.lineWidth = 2; c.stroke();
    c.save();
    c.beginPath(); c.roundRect(2, 6, W - 4, H - 12, 22); c.clip();
    const ppd = W / 150; // pixels a degree: 150 degrees in view
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let a = 0; a < 360; a += 15) {
      let d = ((a - deg + 540) % 360) - 180;
      const x = W / 2 + d * ppd;
      if (x < -20 || x > W + 20) continue;
      const major = a % 45 === 0;
      const p = POINTS.find((q) => q[1] === a);
      if (p) {
        c.font = `800 ${p[0].length === 1 ? 24 : 16}px "Nunito Sans", sans-serif`;
        c.fillStyle = p[0] === 'N' ? '#f08a73' : '#f4e8cf';
        c.fillText(p[0], x, H / 2 + 1);
      } else {
        c.fillStyle = 'rgba(244,232,207,0.6)';
        c.fillRect(x - 1, H / 2 - 5, 2, 10);
      }
      void major;
    }
    c.restore();
    c.fillStyle = '#f2b51b'; c.strokeStyle = '#2a1d14'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(W / 2 - 8, 1); c.lineTo(W / 2 + 8, 1); c.lineTo(W / 2, 13); c.closePath(); c.fill(); c.stroke();
  }

  function renderStrip() {
    const list = STRIPS[kind] || [];
    els.strip.innerHTML = list.map(([cls, key, label]) => `<span><b class="${cls}">${key}</b>${label}</span>`).join('');
    els.strip.hidden = list.length === 0;
  }

  const api = {
    els,
    setKind(k) {
      if (k === kind) return;
      kind = k;
      renderStrip();
      stripLeft = 9;
      els.strip.classList.remove('faded', 'gone');
    },
    setHintsEnabled(on) { hintsOn = !!on; els.hud.classList.toggle('nohints', !on); },
    // At the start of play: show the controls strip for a while.
    startPlay() {
      renderStrip();
      stripLeft = 22;
      els.strip.classList.remove('faded', 'gone');
      lastHeading = null;
      api.setContext('');
    },
    setCounts({ nuts, nutTotal, carried, lm, lmTotal }) {
      els.nuts.textContent = nuts;
      els.nutsTotal.textContent = ` / ${nutTotal}`;
      els.carry.hidden = !carried;
      els.carry.textContent = `carrying ${carried}`;
      els.lm.textContent = lm;
      els.lmTotal.textContent = ` / ${lmTotal}`;
      $('#chip-nuts').title = `Nuts found: ${nuts} of ${nutTotal}${carried ? `, carrying ${carried}` : ''}`;
      $('#chip-lm').title = `Landmarks found: ${lm} of ${lmTotal}`;
    },
    // heading: degrees, 0 = north, clockwise.
    update(dt, heading) {
      const h = Math.round(heading * 2) / 2;
      if (h !== lastHeading) { lastHeading = h; drawCompass(h); }
      if (stripLeft > 0) {
        stripLeft -= dt;
        if (stripLeft <= 0) {
          els.strip.classList.add('faded');
          setTimeout(() => { if (els.strip.classList.contains('faded')) els.strip.classList.add('gone'); }, 1300);
        }
      }
    },
    setContext(text) {
      if (text === ctxText) return;
      ctxText = text;
      if (text) els.ctx.textContent = text;
      els.ctx.hidden = !text;
    },
    showDiscovery(lm) {
      clearTimeout(cardTimer);
      els.name.textContent = lm.name;
      els.blurb.textContent = lm.blurb || '';
      // A bottom panel under the squirrel that fades in, stays a while and fades out.
      els.card.hidden = false;
      els.card.classList.remove('in');
      void els.card.offsetWidth;
      els.card.classList.add('in');
      cardTimer = setTimeout(() => {
        els.card.classList.remove('in');
        cardTimer = setTimeout(() => { els.card.hidden = true; }, reduceMotion ? 0 : 650);
      }, 8000);
    },
    hideDiscovery() { clearTimeout(cardTimer); els.card.classList.remove('in'); els.card.hidden = true; },
    toast(text, ms = 2200) {
      els.toast.textContent = text;
      els.toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { els.toast.hidden = true; }, ms);
    },
  };
  void hintsOn;
  drawCompass(0);
  return api;
}
