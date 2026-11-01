import { walkPose } from '../walking.js';
// Drawing for Act IV's cavern route (film edition; rules in act4cavern.js).
// The painted cavern cloth behind, rock floors and black pools, the delivered
// cavern-ledge cut-outs, stalactites, and the dark: only a pool of light
// around the prince, wider with Aurora's lamp. Draw only from state and t.
import {
  CW, EXIT_X, WATER_Y, CEIL_Y, LIGHT, DROP, FLOORS, LEDGES, camX,
} from './act4cavern.js';
import { OUTRO } from './act4.js';
import { airbornePose } from './sailor-motion.js';
import { drawSailor } from './act4-art.js';
import { clamp, easeInOut } from './shared.js';

const ROCK = '#4a3440', ROCK_LIT = '#8a6474', EDGE = '#e8d2c6', POOL = '#0e1a22', POOL_LIT = '#3c6a78';

export function cavernScene(k, st, t) {
  const c = k.c, cv = st.cv, cx = camX(cv);
  // The cloth, panned slowly across its width as he goes deeper.
  const pan = cx / (CW - 1280);
  if (!k.asset('cavern', 720 - pan * 160, 740, 1440, 810)) {
    const g = c.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, k.col('#2a1826')); g.addColorStop(1, k.col('#0c0810'));
    c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
  }
  // dimmed a little, so its painted rocks read as scenery behind the floors
  k.wash('#0b070c', 0.28);
  c.save(); c.translate(-cx, 0);
  exit(k, t);
  pools(k, cx, t);
  for (const f of FLOORS) floor(k, f);
  for (const l of LEDGES) ledge(k, l);
  for (const d of cv.drops) drawStalactite(k, d, t);
  for (const p of cv.pearls) {
    if (p.got) continue;
    const bob = Math.sin(t * 2.4 + p.i) * 4;
    c.save(); c.globalAlpha = 0.3 + 0.15 * Math.sin(t * 4 + p.i); c.fillStyle = k.col('#fff2b0'); k.circle(p.x, p.y + bob, 22); c.restore();
    if (!k.asset('pearl', p.x, p.y + 14 + bob, 30, 30)) { c.fillStyle = k.col('#f7f2fa'); k.circle(p.x, p.y + bob, 10); }
  }
  prince(k, st, t);
  c.restore();
  dark(k, st, t);
  if (cv.t < 6 && !cv.done) caption(k, st, cv.t);
}

export function cavernOver(k, st) {
  const ex = EXIT_X + 60 - camX(st.cv);
  if (st.phase === 'iris') k.iris(ex, 400, 820 * (1 - easeInOut(st.phaseT / OUTRO.iris)));
  if (st.status === 'won') k.iris(ex, 400, 0);
}

export function cavernEvent(k, e, st) {
  const x = (wx) => wx - camX(st.cv), s = st.cv.s;
  if (e.type === 'hit') { k.shake(0.45); k.flash(0.25); k.burst(x(s.x), s.y - 60, '#c8321e', 12, 'streak'); }
  if (e.type === 'pearl') { k.burst(x(e.x), e.y, '#efe9f2', 12, 'sparkle'); k.text('+10', x(e.x), e.y - 40); }
  if (e.type === 'leap') k.burst(x(s.x), s.y, '#b9a4a8', 4, 'chip');
  if (e.type === 'poolSplash') k.burst(x(e.x), e.y, '#9fb8c0', 22, 'drop');
  if (e.type === 'dropShake') k.burst(x(e.x), CEIL_Y + 6, '#b9a4a8', 6, 'chip');
  if (e.type === 'dropShatter') { k.shake(0.25); k.burst(x(e.x), e.y, '#d7c4c8', 16, 'chip'); }
  if (e.type === 'caveEnter') k.text(e.lamp ? "Aurora's lamp lights the way" : 'Into the dark', 640, 220, true);
  if (e.type === 'caveExit') k.flash(0.3);
}

// The far mouth of the cave: the night sea through a ragged arch.
function exit(k, t) {
  const c = k.c, x = EXIT_X + 60;
  const g = c.createRadialGradient(x, 380, 20, x, 380, 240);
  g.addColorStop(0, k.col('#7fa6c8')); g.addColorStop(0.5, k.col('#2c4a66')); g.addColorStop(1, 'rgba(20,30,50,0)');
  c.fillStyle = g; c.fillRect(x - 260, 140, 520, 420);
  c.fillStyle = k.col('#e9eef6'); k.circle(x + 40, 260, 16);  // the moon over the sea
  c.fillStyle = k.col('#3c6a78'); c.globalAlpha = 0.6 + 0.2 * Math.sin(t * 2);
  c.fillRect(x - 140, 480, 280, 6); c.globalAlpha = 1;
}

// The black pools between the floors, glinting.
function pools(k, cx, t) {
  const c = k.c;
  const g = c.createLinearGradient(0, WATER_Y, 0, 720);
  g.addColorStop(0, k.col('#1d3a46')); g.addColorStop(1, k.col(POOL));
  c.fillStyle = g; c.fillRect(cx - 20, WATER_Y, 1320, 720 - WATER_Y);
  c.strokeStyle = k.col(POOL_LIT); c.lineWidth = 2;
  for (let x = Math.floor(cx / 70) * 70; x < cx + 1320; x += 70) {
    const o = Math.sin(t * 1.6 + x * 0.05) * 10;
    for (const [dy, a] of [[6, 0.7], [20, 0.4], [40, 0.22]]) {
      c.globalAlpha = a; c.beginPath(); c.moveTo(x + o + dy, WATER_Y + dy); c.lineTo(x + 30 + o + dy, WATER_Y + dy); c.stroke();
    }
  }
  c.globalAlpha = 1;
}

// Painted rock supports reach below the stage; the old gradient slabs and
// straight vertical edge strips are gone. Overlap broad rock sections on long
// floors so their texture keeps its scale instead of stretching across a scene.
export function floor(k, f) {
  const width = f.x1-f.x0, im = k.img('cavern-platform');
  if (im) {
    const n = Math.max(1,Math.ceil(width/600)), w = width/n;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    for (let i=0;i<n;i++) {
      const overlap = i ? 12 : 0;
      k.assetCrop('cavern-platform',0,0,iw,ih,f.x0+i*w-overlap,f.y,w+overlap,740-f.y);
    }
  }
  // The familiar painted rim keeps the exact walkable top and conceals joins.
  const n = Math.max(1, Math.round(width/150)), w = width/n;
  for (let i=0;i<n;i++) k.asset('cavern-ledge',f.x0+w*(i+.5),f.y+w/3.2,w+6,w/3.2);
}

// The delivered cavern ledge: its walkable top is the art's top edge.
function ledge(k, l) {
  const c = k.c, w = l.x1 - l.x0;
  if (k.asset('cavern-ledge', (l.x0 + l.x1) / 2, l.y + w / 3.2, w, w / 3.2)) return;
  c.fillStyle = k.col(ROCK); c.fillRect(l.x0, l.y, w, 24);
  c.fillStyle = k.col(EDGE); c.fillRect(l.x0, l.y, w, 3);
}

// A stalactite: hanging, shivering, falling, or broken on the floor.
export function drawStalactite(k, d, t) {
  const c = k.c;
  const im = k.img('cavern-stalactite');
  if (im) {
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    // The painted ceiling cap stays fixed. Only the spike below it shakes
    // and falls, keeping its tip at the collision model's y + DROP.len.
    const cap = ih / 7, scale = DROP.len / ih, w = iw * scale;
    k.assetCrop('cavern-stalactite', 0, 0, iw, cap, d.x - w / 2, CEIL_Y, w, cap * scale);
    if (d.state !== 'broken') {
      const sx = d.state === 'shake' ? Math.sin(t * 60) * 3 : 0;
      k.assetCrop('cavern-stalactite', 0, cap, iw, ih - cap,
        d.x + sx - w / 2, d.y + cap * scale, w, (ih - cap) * scale);
    } else if (d.landY != null) {
      // Rubble rests on the same surface that stopped the falling tip.
      if (!k.asset('cavern-stalactite-broken', d.x, d.landY, 60, 20)) {
        c.fillStyle = k.col('#9b8790'); c.fillRect(d.x - 24, d.landY - 6, 48, 6);
      }
    }
    return;
  }
  if (d.state === 'broken') {
    if (d.landY == null) return;
    c.fillStyle = k.col('#9b8790');
    for (let i = 0; i < 4; i++) c.fillRect(d.x - 22 + i * 12, d.landY - 6 - (i % 2) * 4, 9, 6);
    return;
  }
  const sx = d.state === 'shake' ? Math.sin(t * 60) * 3 : 0;
  c.save(); c.translate(d.x + sx, d.y);
  if (d.state === 'shake') { c.fillStyle = k.col('#e9a46a'); c.globalAlpha = 0.25 + 0.2 * Math.sin(t * 20); k.circle(0, DROP.len * 0.5, 34); c.globalAlpha = 1; }
  c.fillStyle = k.col('#b9a0aa');
  c.beginPath(); c.moveTo(-DROP.hw, 0); c.lineTo(DROP.hw, 0); c.lineTo(3, DROP.len); c.lineTo(-3, DROP.len); c.closePath(); c.fill();
  c.fillStyle = k.col('#e2d0d6'); c.beginPath(); c.moveTo(-DROP.hw + 6, 0); c.lineTo(-4, 0); c.lineTo(0, DROP.len - 10); c.closePath(); c.fill();
  c.restore();
  // the ceiling it hangs from
  c.fillStyle = k.col(ROCK); c.beginPath(); c.ellipse(d.x, CEIL_Y - 10, 60, 20, 0, 0, Math.PI * 2); c.fill();
}

function prince(k, st, t) {
  const c = k.c, s = st.cv.s;
  if (st.grace > 0 && Math.floor(t * 14) % 2) c.globalAlpha = 0.35;
  const frame = !s.on ? airbornePose(s.vy) : s.landT > 0 ? 'land' : Math.abs(s.vx) > 30 ? walkPose(s.walk) : 'stand';
  c.save(); c.translate(s.x, s.y); c.scale(s.face, 1);
  drawSailor(k, frame);
  if (st.stone) {
    // Aurora's lamp, held out ahead of him
    c.fillStyle = k.col('#ffe9a8'); c.globalAlpha = 0.35 + 0.1 * Math.sin(t * 7); k.circle(30, -70, 16); c.globalAlpha = 1;
    k.asset('keepsake-stone', 30, -56, 28, 28);
  }
  c.restore();
  c.globalAlpha = 1;
}

// The dark: everything beyond his light, the exit's glow showing through.
function dark(k, st, t) {
  const c = k.c, cv = st.cv, s = cv.s, cx = camX(cv);
  const r = (st.stone ? LIGHT.lamp : LIGHT.own) * (1 + 0.03 * Math.sin(t * 5));
  const px = s.x - cx, py = s.y - 60;
  const out = cv.done ? clamp(cv.doneT / 1.2, 0, 1) : 0;
  const g = c.createRadialGradient(px, py, r * 0.45, px, py, r);
  g.addColorStop(0, 'rgba(8,4,10,0)'); g.addColorStop(1, `rgba(8,4,10,${0.72 * (1 - out)})`);
  c.save(); c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
  // the mouth of the cave glows through the dark as he nears it
  const ex = EXIT_X + 60 - cx;
  if (ex < 1500) {
    const e = c.createRadialGradient(ex, 380, 10, ex, 380, 200);
    e.addColorStop(0, 'rgba(160,200,230,0.35)'); e.addColorStop(1, 'rgba(160,200,230,0)');
    c.globalCompositeOperation = 'lighter'; c.fillStyle = e; c.fillRect(ex - 200, 180, 400, 400);
  }
  c.restore();
}

function caption(k, st, ct) {
  const c = k.c, a = Math.min(1, ct / 0.5, (6 - ct) / 0.6), msg = 'Through the cavern to the sea · leap the black pools · run from a shaking stalactite';
  c.save(); c.globalAlpha = a; c.textAlign = 'center'; c.font = '700 18px "Josefin Sans", sans-serif';
  const w = c.measureText(msg).width + 48;
  c.globalAlpha = 0.85 * a; c.fillStyle = k.col('#2a1424'); c.beginPath(); c.roundRect(640 - w / 2, 126, w, 34, 17); c.fill();
  c.globalAlpha = a; c.fillStyle = k.col('#f3c6dc'); c.fillText(msg, 640, 150);
  c.restore();
}
