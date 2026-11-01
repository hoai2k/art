// The 2D layer over the picture: running stitches round each found control's
// target in its player's thread colour, threads between sewn pieces, the small
// line drawing pinned beside a control when it is found, and the tightening
// threads round a large control's anchor as its setup nears waking.

import { W, H, setupPower, reach, AWAKE, inputKind } from './collage.js';

const GLYPH = { stick: 'hand', trigger: 'spool', button: 'needle' };

export function createOverlay(canvas, base = 'web/') {
  const ctx = canvas.getContext('2d');
  const lines = new Map();
  const pins = []; // { player, input, target, scale, t }
  let showHints = true;

  function loadLines(list) {
    for (const l of list) {
      const img = new Image();
      img.src = base + l.file;
      lines.set(l.name, img);
    }
  }

  function event(e, game) {
    if (e.type === 'found' || e.type === 'retarget') {
      pins.push({ player: e.player, input: e.input, target: e.target, scale: e.scale || game.players.find((p) => p.id === e.player)?.bindings[e.input]?.scale, t: 0 });
      while (pins.length > 4) pins.shift();
    }
    if (e.type === 'scene') pins.length = 0;
  }

  function draw(game, frame, dt) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = Math.round(canvas.clientWidth * dpr);
    const ch = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (game.transition) return;
    ctx.setTransform(dpr * frame.scale, 0, 0, dpr * frame.scale, dpr * frame.x, dpr * frame.y);
    const px = 1 / frame.scale; // one CSS pixel in world units
    const P = game.pieces;

    // Threads between sewn pieces.
    ctx.lineCap = 'round';
    ctx.strokeStyle = game.scene.thread;
    ctx.lineWidth = 2.2 * px;
    ctx.setLineDash([7 * px, 5 * px]);
    for (const a of P) {
      for (const j of a.links) {
        if (j < a.i) continue;
        const b = P[j];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.stroke();
      }
    }
    if (!showHints) return;

    // Found controls: a running stitch round the target in the player's colour.
    for (const pl of game.players) {
      for (const b of Object.values(pl.bindings)) {
        if (!b.found) continue;
        const live = b.target < 1000 ? P[b.target] : null;
        ctx.strokeStyle = pl.colour;
        ctx.lineWidth = (b.scale === 'large' ? 3.4 : b.scale === 'medium' ? 2.6 : 2) * px;
        ctx.setLineDash(b.scale === 'large' ? [10 * px, 4 * px] : [6 * px, 6 * px]);
        ctx.lineDashOffset = -game.time * 8 * px;
        ctx.globalAlpha = 0.35 + Math.min(0.6, live?.held || 0);
        if (live) {
          ctx.save();
          ctx.translate(live.x, live.y);
          ctx.rotate(live.rot);
          const s = 1 + live.bloom * 0.35;
          ctx.beginPath();
          ctx.ellipse(0, 0, (live.w * live.sx * s) / 2 + 0.12, (live.h * live.sy * s) / 2 + 0.12, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else if (b.target >= 1000) {
          const pn = game.panels[b.target - 1000];
          ctx.strokeRect((W / 3) * pn.c + pn.x + 0.15, (H / 2) * pn.r + pn.y + 0.15, W / 3 - 0.3, H / 2 - 0.3);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Large controls tighten their threads as their setup nears waking.
    for (const pl of game.players) {
      for (const b of Object.values(pl.bindings)) {
        if (b.scale !== 'large' || !b.setup) continue;
        const pw = setupPower(game, b);
        if (pw < 0.45 && !b.found) continue;
        const a = P[b.setup.anchor];
        const r = reach(game, b);
        ctx.strokeStyle = pl.colour;
        ctx.setLineDash([3 * px, 9 * px]);
        ctx.lineDashOffset = game.time * (pw >= AWAKE ? 30 : 6) * px;
        ctx.lineWidth = (pw >= AWAKE ? 3 : 1.5) * px;
        ctx.globalAlpha = Math.min(0.8, 0.15 + pw * 0.6) * (pw >= AWAKE ? 0.75 + 0.25 * Math.sin(game.time * 6) : 1);
        ctx.beginPath();
        ctx.arc(a.x, a.y, Math.min(r, 9), 0, Math.PI * 2);
        ctx.stroke();
        if (b.setup.type === 'meet') {
          const o = P[b.setup.other];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(o.x, o.y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.setLineDash([]);

    // A drawing pinned beside each newly found control for a few seconds.
    for (const pin of pins) pin.t += dt;
    for (let i = pins.length - 1; i >= 0; i--) if (pins[i].t > 4.5) pins.splice(i, 1);
    for (const pin of pins) {
      const pl = game.players.find((p) => p.id === pin.player);
      if (!pl) continue;
      let x;
      let y;
      if (pin.target < 1000) {
        const p = P[pin.target];
        if (!p) continue;
        x = p.x + p.w * 0.45;
        y = p.y - p.h * 0.45;
      } else {
        const pn = game.panels[pin.target - 1000];
        x = (W / 3) * (pn.c + 0.8);
        y = (H / 2) * (pn.r + 0.2);
      }
      x = Math.min(W - 0.9, Math.max(0.9, x));
      y = Math.min(H - 0.7, Math.max(0.7, y));
      const fade = Math.min(1, pin.t * 3, (4.5 - pin.t) * 1.5);
      ctx.globalAlpha = fade;
      const kind = inputKind(pin.input);
      const control = ['LB', 'RB'].includes(pin.input) ? 'shoulder' : pin.input.startsWith('D') ? 'dpad' : kind;
      const img = lines.get(control) || lines.get(GLYPH[kind]);
      ctx.fillStyle = 'rgba(250, 244, 230, 0.92)';
      ctx.beginPath();
      ctx.ellipse(x, y, 0.62, 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pl.colour;
      ctx.lineWidth = 2.5 * px;
      ctx.setLineDash([5 * px, 4 * px]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (img?.complete && img.naturalWidth) {
        const s = 0.62 / Math.max(img.naturalWidth, img.naturalHeight);
        ctx.drawImage(img, x - 0.42 - (img.naturalWidth * s) / 2 + 0.2, y - (img.naturalHeight * s) / 2 - 0.05, img.naturalWidth * s, img.naturalHeight * s);
      }
      ctx.fillStyle = pl.colour;
      ctx.font = `700 ${0.3}px Questrial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(pin.input, x + 0.24, y + 0.12);
      if (pin.scale === 'large') {
        ctx.font = `600 ${0.17}px Questrial, sans-serif`;
        ctx.fillText('big', x + 0.24, y + 0.33);
      }
      ctx.globalAlpha = 1;
    }
  }

  return {
    loadLines,
    event,
    draw,
    set hints(v) { showHints = v; },
  };
}
