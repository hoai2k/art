// Ink-and-wash drawing in code: the stand-in birds and scenes, drawn the way
// the book is (a wiry brown-black pen line over soft watercolour), until the
// real art in assets/ arrives. A delivered portrait or scene replaces its
// stand-in automatically (see `setArt`).
//
// drawBird(g, id, { x, y, size, t, flip, pose })
//   (x, y) is the ground point between the bird's feet; `size` its height in
//   pixels; it faces left unless `flip`. `t` (seconds) animates the idle and
//   the ink's gentle "boil". `pose` carries per-bird state (see each bird).

export const INK = '#3b2b20';
export const PAPER = '#f4ecd8';
export const PAL = {
  lemon: '#efd96a',
  mustard: '#c9a83a',
  olive: '#9a9a4a',
  sage: '#a9b88a',
  strawberry: '#ea8fb0',
  dusty: '#d9a4a0',
  mauve: '#b98aa3',
  ochre: '#d0a050',
  wafer: '#d9a25a',
  slate: '#7f93a8',
  sky: '#c9d9e0',
  grey: '#9a948a',
  brick: '#b8624a',
  magenta: '#c0407a',
  orange: '#e09a48',
  mint: '#b7dcc0',
  green: '#7f9a5a',
  night: '#25303f',
  cream: '#f7f0dc',
};

let ART = new Map();
let BOIL = true;

// key -> HTMLImageElement, for the delivered art ('bird.coot', 'scene.coot', ...).
export function setArt(map) {
  ART = map;
}
export function setBoil(on) {
  BOIL = on;
}
export const art = (key) => ART.get(key) || null;

// ---------- tiny deterministic noise ----------

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
let seedBase = 0;
const jit = (i, amt) => (hash(i + seedBase) - 0.5) * 2 * amt;

// ---------- primitives ----------

export function ink(g, w = 2.4, color = INK) {
  g.lineWidth = w;
  g.strokeStyle = color;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.stroke();
}

// A watercolour fill: the colour, a darker pooled edge, and a pale bloom.
export function wash(g, color, alpha = 0.92) {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fill();
  g.globalAlpha = 0.18;
  g.lineWidth = 6;
  g.strokeStyle = color;
  g.stroke();
  g.restore();
}

export function blob(g, cx, cy, rx, ry, seed = 0, amt = 0.06, n = 16) {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = i === n ? 0 : i;
    const r = 1 + jit(seed * 31 + k, amt);
    const x = cx + Math.cos(a) * rx * r;
    const y = cy + Math.sin(a) * ry * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

// A lumpy scoop: a circle with bumps along its bottom edge.
export function scoop(g, cx, cy, r, seed = 0) {
  g.beginPath();
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const bottom = Math.sin(a) > 0.2;
    const bump = bottom ? 0.08 * Math.abs(Math.sin(a * 5)) : 0;
    const r2 = r * (1 + bump + jit(seed * 17 + (i % n), 0.035));
    const x = cx + Math.cos(a) * r2;
    const y = cy + Math.sin(a) * r2 * 0.92;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

export function poly(g, pts, seed = 0, amt = 1.5, close = true) {
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const px = x + jit(seed * 13 + i * 2, amt);
    const py = y + jit(seed * 13 + i * 2 + 1, amt);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  });
  if (close) g.closePath();
}

// Crosshatching inside the current path.
export function hatch(g, x0, y0, x1, y1, step = 9, alpha = 0.35, angle = 1) {
  g.save();
  g.clip();
  g.beginPath();
  for (let x = x0 - (y1 - y0); x < x1; x += step) {
    g.moveTo(x, y1);
    g.lineTo(x + (y1 - y0) * angle, y0);
  }
  g.globalAlpha = alpha;
  ink(g, 1.1);
  g.restore();
}

export function eye(g, x, y, r, iris = '#fff', look = 0) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = iris;
  g.fill();
  ink(g, 2);
  g.beginPath();
  g.arc(x - r * 0.25 + look * r * 0.3, y, Math.max(2, r * 0.28), 0, Math.PI * 2);
  g.fillStyle = INK;
  g.fill();
}

export function beak(g, x, y, len, w, color = PAL.ochre, tilt = 0) {
  const tx = x - Math.cos(tilt) * len;
  const ty = y + Math.sin(tilt) * len;
  const nx = Math.sin(tilt) * w;
  const ny = Math.cos(tilt) * w;
  poly(g, [[x - nx, y - ny], [tx, ty], [x + nx, y + ny]], 7);
  wash(g, color);
  ink(g, 2);
}

// A thin knobbly leg from hip to ground with spiky spread claws.
export function leg(g, x0, y0, x1, y1, color = INK, w = 3, claw = INK) {
  const mx = (x0 + x1) / 2 + (x1 - x0) * 0.15;
  const my = (y0 + y1) / 2;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(mx, my);
  g.lineTo(x1, y1);
  ink(g, w + 1.6, INK);
  if (color !== INK) ink(g, w, color);
  g.beginPath();
  g.arc(mx, my, w * 0.9, 0, Math.PI * 2);
  g.fillStyle = color === INK ? INK : color;
  g.fill();
  foot(g, x1, y1, claw);
}

export function foot(g, x, y, color = INK) {
  g.beginPath();
  for (const [dx, dy] of [[-22, 2], [-12, 5], [10, 4], [18, 0]]) {
    g.moveTo(x, y);
    g.lineTo(x + dx, y + dy);
  }
  ink(g, 2, color);
}

// A curly feather plume from (x, y) heading at angle `a`.
export function plume(g, x, y, a, len, color, curl = 1, seed = 0) {
  g.beginPath();
  g.moveTo(x, y);
  let px = x;
  let py = y;
  let ang = a;
  for (let i = 0; i < 6; i++) {
    ang += 0.35 * curl;
    px += Math.cos(ang) * len / 6;
    py += Math.sin(ang) * len / 6;
    g.lineTo(px + jit(seed + i, 1), py + jit(seed + i + 9, 1));
  }
  g.lineWidth = 9;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.stroke();
  ink(g, 1.4);
}

function shadow(g, w) {
  g.save();
  g.globalAlpha = 0.18;
  g.fillStyle = INK;
  g.beginPath();
  g.ellipse(0, 2, w, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// ---------- the birds ----------
// Each is drawn in a 400-unit-tall box, origin on the ground between the
// feet, facing left.

const BIRD_DRAW = {
  // pose.stack: extra scoops drawn by the game itself; pose.lean: radians.
  coot(g, t, pose) {
    shadow(g, 70);
    const bob = Math.sin(t * 2) * 3;
    leg(g, -10, -150, -45, 0, PAL.strawberry, 3.5, PAL.magenta);
    leg(g, 10, -150, 40, 0, PAL.strawberry, 3.5, PAL.magenta);
    // stripes on the legs
    g.save();
    g.setLineDash([6, 8]);
    g.beginPath();
    g.moveTo(-10, -150); g.lineTo(-27, -75); g.lineTo(-45, 0);
    g.moveTo(10, -150); g.lineTo(26, -75); g.lineTo(40, 0);
    ink(g, 3.2, '#fff');
    g.restore();
    g.translate(0, bob);
    // the cone, lying on its side, tip back and down
    poly(g, [[155, -120], [-10, -235], [-50, -155]], 1, 1.5);
    wash(g, PAL.wafer);
    g.save();
    hatch(g, -60, -240, 160, -110, 18, 0.45, 1);
    g.restore();
    poly(g, [[155, -120], [-10, -235], [-50, -155]], 1, 1.5);
    g.save();
    hatch(g, -60, -240, 160, -110, 18, 0.45, -1);
    g.restore();
    poly(g, [[155, -120], [-10, -235], [-50, -155]], 1, 1.5);
    ink(g);
    // drips where the cone meets the scoop
    blob(g, -30, -160, 18, 12, 3);
    wash(g, PAL.mint);
    ink(g, 1.5);
    // the lemon scoop
    scoop(g, -40, -215, 72, 4);
    wash(g, PAL.lemon);
    ink(g);
    g.fillStyle = 'rgba(120,80,30,0.5)';
    for (let i = 0; i < 18; i++) g.fillRect(-90 + hash(i) * 100, -260 + hash(i + 40) * 80, 2, 3);
    // candy-striped neck
    const nx = (s) => -80 - s * 30 + Math.sin(s * 3) * 8;
    const ny = (s) => -260 - s * 70;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(nx(i / 6), ny(i / 6));
      g.lineTo(nx((i + 1) / 6), ny((i + 1) / 6));
      g.lineWidth = 12;
      g.strokeStyle = i % 2 ? PAL.lemon : '#d9534a';
      g.stroke();
    }
    g.beginPath();
    g.moveTo(nx(0), ny(0));
    for (let i = 1; i <= 6; i++) g.lineTo(nx(i / 6), ny(i / 6));
    g.lineWidth = 14; g.strokeStyle = 'rgba(0,0,0,0)'; g.stroke();
    // head: strawberry scoop with wafer crest and cone beak
    const hx = -115;
    const hy = -345 + Math.sin(t * 2 + 1) * 3;
    for (let i = 0; i < 3; i++) {
      const a = -0.5 + i * 0.45;
      const ex = hx + 40 + Math.cos(a) * 70;
      const ey = hy - 10 + Math.sin(a) * 50;
      g.beginPath();
      g.moveTo(hx + 20, hy - 5);
      g.lineTo(ex, ey);
      g.lineWidth = 14; g.strokeStyle = PAL.orange; g.lineCap = 'round'; g.stroke();
      ink(g, 1.3);
      g.beginPath(); g.arc(ex, ey, 8, 0, Math.PI * 2); g.fillStyle = PAL.magenta; g.fill(); ink(g, 1.4);
    }
    scoop(g, hx, hy, 46, 9);
    wash(g, PAL.strawberry);
    ink(g);
    poly(g, [[hx - 40, hy - 12], [hx - 105, hy + 2], [hx - 40, hy + 14]], 5);
    wash(g, PAL.wafer);
    ink(g, 2);
    blink(g, t, () => eye(g, hx - 12, hy - 6, 16, '#bfe0f0'));
  },

  cupadee(g, t, pose) {
    shadow(g, 50);
    leg(g, -15, -170, -40, 0, PAL.ochre, 2.5);
    leg(g, 20, -170, 32, 0, PAL.ochre, 2.5);
    const tilt = -0.22 + Math.sin(t * 1.6) * 0.03 + (pose.tip || 0);
    g.translate(0, -225);
    g.rotate(tilt);
    // handle (tail) behind
    g.beginPath();
    g.ellipse(88, 0, 26, 30, 0, -Math.PI / 2, Math.PI / 2);
    g.lineWidth = 12; g.strokeStyle = PAL.lemon; g.stroke(); ink(g, 1.6);
    plume(g, 110, 22, 0.3, 50, PAL.lemon, 1, 3);
    // the cup
    poly(g, [[-90, -55], [90, -55], [70, 40], [40, 60], [-40, 60], [-70, 40]], 2);
    wash(g, PAL.lemon);
    ink(g);
    poly(g, [[-88, -50], [88, -50], [84, -28], [-84, -28]], 3, 1);
    wash(g, PAL.dusty);
    ink(g, 1.5);
    // tea inside (pose.fill 0..1)
    g.beginPath();
    g.ellipse(0, -55, 90, 14, 0, 0, Math.PI * 2);
    g.fillStyle = '#e9e0c4'; g.fill(); ink(g, 2);
    if (pose.fill > 0) {
      g.beginPath();
      g.ellipse(0, -55, 80 * Math.min(1, 0.4 + pose.fill), 11 * Math.min(1, 0.4 + pose.fill), 0, 0, Math.PI * 2);
      g.fillStyle = '#9a5a2a'; g.fill();
    }
    beak(g, -82, 0, 85, 10, PAL.ochre, -0.35);
    blink(g, t, () => eye(g, -40, -5, 13));
  },

  shuttercluck(g, t, pose) {
    shadow(g, 90);
    const bob = Math.abs(Math.sin(t * 3)) * -3;
    leg(g, -30, -60, -36, 0, PAL.orange, 4);
    leg(g, 30, -60, 34, 0, PAL.orange, 4);
    g.translate(0, bob);
    plume(g, 90, -110, -0.4, 80, PAL.strawberry, 1.2, 4);
    plume(g, 90, -95, 0.1, 70, PAL.strawberry, 1.1, 8);
    plume(g, -10, -205, -1.6, 70, PAL.strawberry, 1.3, 2);
    plume(g, 10, -205, -1.3, 60, PAL.strawberry, 1.2, 6);
    // beak sticking out of the side
    poly(g, [[-88, -140], [-215, -118], [-88, -100]], 5);
    wash(g, '#d8b98a');
    ink(g);
    // body
    poly(g, [[-90, -200], [90, -200], [92, -60], [-92, -60]], 1, 1.2);
    wash(g, '#4a3a30');
    ink(g);
    poly(g, [[-90, -200], [90, -200], [92, -60], [-92, -60]], 1, 1.2);
    hatch(g, -95, -205, 95, -55, 8, 0.4);
    poly(g, [[-62, -228], [-18, -228], [-18, -200], [-62, -200]], 2);
    wash(g, '#5a4a3e'); ink(g, 2);
    blob(g, 45, -210, 16, 8, 4, 0.02);
    wash(g, PAL.mustard); ink(g, 2);
    // the side window
    poly(g, [[30, -170], [70, -170], [70, -100], [30, -100]], 3);
    wash(g, PAL.sage); ink(g, 2);
    // the lens: its one eye
    const shut = pose.click ? Math.max(0, 1 - pose.click * 6) : 1;
    g.beginPath(); g.arc(-35, -130, 46, 0, Math.PI * 2); g.fillStyle = PAL.mustard; g.fill(); ink(g);
    g.beginPath(); g.arc(-35, -130, 34, 0, Math.PI * 2); g.fillStyle = '#e8e4d8'; g.fill(); ink(g, 1.5);
    g.beginPath(); g.arc(-35, -130, 20 * shut + 2, 0, Math.PI * 2); g.fillStyle = '#2a2a30'; g.fill();
    g.beginPath(); g.arc(-42, -137, 5, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill();
  },

  gullfinch(g, t, pose) {
    shadow(g, 60);
    const wind = pose.wind ?? 1;
    // standing leg, and the raised one
    leg(g, 30, -150, 25, 0, PAL.mustard, 2.5);
    g.beginPath(); g.moveTo(50, -150); g.lineTo(80, -100); g.lineTo(55, -75); ink(g, 3.2); ink(g, 2, PAL.mustard);
    foot(g, 55, -75);
    // body: the record-player box
    poly(g, [[-40, -235], [100, -235], [100, -150], [-40, -150]], 1);
    wash(g, PAL.olive); ink(g);
    poly(g, [[-25, -215], [85, -215], [85, -170], [-25, -170]], 2, 1);
    wash(g, '#b8b060'); ink(g, 1.5);
    // record and tone arm
    const spinA = t * 4 * wind;
    g.beginPath(); g.ellipse(30, -238, 55, 11, 0, 0, Math.PI * 2); g.fillStyle = '#2a2622'; g.fill(); ink(g, 1.5);
    g.beginPath(); g.ellipse(30 + Math.cos(spinA) * 30, -238 + Math.sin(spinA) * 5, 4, 2, 0, 0, Math.PI * 2); g.fillStyle = '#c8b070'; g.fill();
    g.beginPath(); g.moveTo(90, -240); g.quadraticCurveTo(95, -265, 55, -245); ink(g, 3);
    // crank
    const ca = -t * 6 * wind;
    g.beginPath(); g.moveTo(100, -195); g.lineTo(100 + 25 + Math.cos(ca) * 4, -195 + Math.sin(ca) * 20); g.lineTo(130 + Math.cos(ca) * 4, -175 + Math.sin(ca) * 20); ink(g, 4); ink(g, 2.5, PAL.mustard);
    // scaly neck
    for (let i = 0; i < 7; i++) {
      const s = i / 6;
      blob(g, -40 - s * 25 + Math.sin(s * 3) * 15, -190 - s * 110, 26 - s * 8, 18, i + 20, 0.08, 10);
      wash(g, i % 2 ? PAL.mustard : '#b8a24a');
      ink(g, 1.4);
    }
    // the horn, flaring behind the head
    const hx = -70;
    const hy = -315 + Math.sin(t * 2) * 3;
    const sing = pose.sing || 0;
    g.save();
    g.translate(hx + 15, hy - 15);
    g.rotate(-0.5 - sing * 0.1);
    poly(g, [[0, -10], [130, -95], [150, 0], [130, 95], [0, 10]], 3, 2);
    wash(g, PAL.mustard); ink(g);
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(10, 0); g.lineTo(138, i * 27); ink(g, 1.2); }
    g.beginPath(); g.ellipse(140, 0, 22, 96, 0, 0, Math.PI * 2); g.fillStyle = '#8a7a2a'; g.fill(); ink(g, 2);
    g.restore();
    // head and crest
    for (let i = 0; i < 5; i++) {
      g.beginPath(); g.moveTo(hx, hy - 15);
      g.quadraticCurveTo(hx - 10 + i * 6, hy - 70, hx - 40 + i * 14, hy - 95 + i * 6);
      g.lineWidth = 5; g.strokeStyle = PAL.lemon; g.stroke(); ink(g, 1.2);
    }
    blob(g, hx, hy, 24, 20, 30, 0.05);
    wash(g, '#8fa080'); ink(g);
    beak(g, hx - 20, hy + 4, 30 + sing * 6, 7 + sing * 4, PAL.ochre, -0.1);
    blink(g, t, () => eye(g, hx - 4, hy - 4, 8));
  },

  // pose.growth 0..1 (sprout, stem, bud, bloom); pose.wilt 0..1; pose.soggy
  plume(g, t, pose) {
    shadow(g, 65);
    const growth = pose.growth ?? 0.15;
    const wilt = pose.wilt || 0;
    leg(g, -25, -60, -30, 0, PAL.orange, 3.5);
    leg(g, 25, -60, 28, 0, PAL.orange, 3.5);
    plumePlant(g, t, pose);
    // tufts in the pot
    plume(g, -10, -238, -1.9, 30, PAL.lemon, 0.6, 1);
    plume(g, 10, -238, -1.2, 26, PAL.lemon, -0.6, 2);
    // the pot
    poly(g, [[-85, -240], [85, -240], [80, -212], [62, -60], [-62, -60], [-80, -212]], 1);
    wash(g, pose.soggy ? '#b98a7a' : PAL.dusty); ink(g);
    poly(g, [[-85, -240], [85, -240], [82, -212], [-82, -212]], 2);
    wash(g, '#e4b8a8'); ink(g, 1.6);
    plume(g, 62, -120, 0.2, 40, PAL.strawberry, 1, 4);
    blob(g, 10, -140, 26, 14, 9, 0.1);
    wash(g, PAL.strawberry); ink(g, 1.5);
    blob(g, -50, -175, 30, 26, 5, 0.05);
    wash(g, PAL.lemon); ink(g, 1.4);
    beak(g, -70, -170, 26, 8, PAL.magenta, 0.15);
    blink(g, t, () => eye(g, -50, -180, 9));
    if (pose.soggy) {
      g.fillStyle = 'rgba(90,130,170,0.6)';
      for (let i = 0; i < 4; i++) g.fillRect(-60 + i * 35, -60 + ((t * 80 + i * 20) % 40), 4, 8);
    }
  },

  // pose.lift: -1 left boot raised, 1 right, 0 both down; pose.sing
  bobolinks(g, t, pose) {
    shadow(g, 90);
    const boot = (bx, by, seed, sing) => {
      g.save();
      g.translate(bx, by);
      // beak out of the top, pointing up
      poly(g, [[-18, -205], [-30 - sing * 8, -300], [8, -208]], seed);
      wash(g, '#f2eee4'); ink(g, 1.8);
      if (sing > 0.2) { poly(g, [[-4, -205], [10 + sing * 12, -290], [14, -206]], seed + 1); wash(g, '#f2eee4'); ink(g, 1.6); }
      // shaft and foot
      poly(g, [[-30, -210], [30, -210], [32, -40], [10, -8], [-80, -12], [-82, -30], [-40, -45], [-34, -210]], seed, 1.4);
      wash(g, PAL.mauve); ink(g);
      poly(g, [[-30, -210], [30, -210], [32, -40], [10, -8], [-80, -12], [-82, -30], [-40, -45], [-34, -210]], seed, 1.4);
      hatch(g, -90, -215, 40, 0, 11, 0.18);
      poly(g, [[-82, -12], [10, -8], [12, 0], [-82, -2]], seed + 2, 1);
      wash(g, '#efe6d0'); ink(g, 1.4);
      poly(g, [[12, -14], [30, -14], [26, 2], [10, 2]], seed + 3, 1);
      wash(g, '#6a4a40'); ink(g, 1.4);
      for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(18, -190 + i * 22, 4, 0, Math.PI * 2); g.fillStyle = '#efe6d0'; g.fill(); ink(g, 1.2); }
      blink(g, t + seed, () => eye(g, -8, -180, 10, PAL.lemon));
      g.restore();
    };
    const lift = pose.lift || 0;
    const s = pose.sing || 0;
    boot(55, -14 - (lift > 0 ? 30 : 0), 7, s * Math.abs(Math.sin(t * 5 + 1)));
    boot(-35, -(lift < 0 ? 30 : 0), 3, s * Math.abs(Math.sin(t * 5)));
  },

  peeper(g, t, pose) {
    shadow(g, 70);
    leg(g, -25, -80, -35, 0, PAL.lemon, 3);
    leg(g, 30, -80, 40, 0, PAL.lemon, 3);
    const flap = Math.sin(t * 2.2) * 0.06;
    // torn strips curling up from the top as crest and tail
    for (let i = 0; i < 6; i++) {
      g.save();
      g.translate(-40 + i * 24, -300);
      g.rotate(0.3 + i * 0.12 + flap);
      poly(g, [[0, 0], [14, 0], [30, -80 - i * 8], [22, -86 - i * 8]], i + 40, 1.2);
      wash(g, '#ece4c8'); ink(g, 1.3);
      g.restore();
    }
    // the sheet
    const sheet = [[-95, -305], [95, -295], [100, -80], [-85, -90]];
    poly(g, sheet, 1, 1.2);
    wash(g, '#ece4c8'); ink(g);
    // headline and columns of print
    poly(g, [[-80, -285], [80, -277], [80, -258], [-80, -265]], 3, 0.6);
    wash(g, '#5a4a40', 0.75);
    g.save();
    g.globalAlpha = 0.45;
    for (let c = 0; c < 3; c++) {
      for (let r = 0; r < 16; r++) {
        const x = -78 + c * 56;
        const y = -245 + r * 9.5;
        if (c === 1 && r > 4 && r < 10) continue;
        g.fillStyle = INK;
        g.fillRect(x, y + c * 1.5, 46 - hash(r * 7 + c) * 12, 2);
      }
    }
    g.restore();
    poly(g, [[-24, -200], [24, -198], [24, -150], [-24, -152]], 9, 0.8);
    wash(g, '#7a6a5a'); ink(g, 1.3);
    // head
    const hy = -305 + Math.sin(t * 2) * 2;
    blob(g, -110, hy, 26, 22, 12, 0.05);
    wash(g, PAL.lemon); ink(g);
    beak(g, -130, hy + 2, 70, 6, PAL.lemon, -0.2);
    blink(g, t, () => eye(g, -110, hy - 4, 9));
  },

  piffle(g, t, pose) {
    shadow(g, 90);
    leg(g, -30, -80, -38, 0, '#4a3a2e', 3);
    leg(g, 30, -80, 36, 0, '#4a3a2e', 3);
    // pins along the back, like a crest
    const cols = [PAL.strawberry, '#f2eee4', '#8a4a6a', PAL.ochre, PAL.slate, PAL.mauve];
    for (let i = 0; i < 17; i++) {
      const a = -Math.PI * 0.95 + (i / 16) * Math.PI * 0.95 + jit(i, 0.05);
      const r0 = 80;
      const r1 = 130 + hash(i * 3) * 70;
      const x0 = Math.cos(a) * r0 * 1.2;
      const y0 = -150 + Math.sin(a) * r0;
      const x1 = Math.cos(a) * r1 * 1.15;
      const y1 = -150 + Math.sin(a) * r1;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); ink(g, 1.6, '#8a8a90');
      if (i % 5 === 2) {
        g.beginPath(); g.ellipse(x1, y1, 7, 14, a + Math.PI / 2, 0, Math.PI * 2); ink(g, 2, '#8a8a90');
      } else {
        g.beginPath(); g.arc(x1, y1, 5 + hash(i) * 5, 0, Math.PI * 2); g.fillStyle = cols[i % cols.length]; g.fill(); ink(g, 1.2);
      }
    }
    poly(g, [[110, -150], [175, -115], [105, -125]], 4);
    wash(g, PAL.olive); ink(g);
    blob(g, 0, -150, 115, 82, 3, 0.04, 20);
    wash(g, '#b0a050'); ink(g);
    blob(g, 0, -150, 115, 82, 3, 0.04, 20);
    hatch(g, -120, -235, 120, -65, 10, 0.15);
    // a few pins stuck in the front
    for (let i = 0; i < 5; i++) {
      g.beginPath(); g.moveTo(-10 + i * 14, -140 + i * 4); g.lineTo(-40 + i * 10, -110 + i * 3); ink(g, 1.4, '#8a8a90');
      g.beginPath(); g.arc(-40 + i * 10, -110 + i * 3, 4, 0, Math.PI * 2); g.fillStyle = cols[(i + 2) % cols.length]; g.fill();
    }
    // the thimble on the front, like a hat
    g.save();
    g.translate(-85, -205);
    g.rotate(-0.4);
    poly(g, [[-24, 0], [24, 0], [18, -48], [-18, -48]], 6);
    wash(g, '#c8c8cc'); ink(g);
    g.fillStyle = INK;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) g.fillRect(-14 + c * 9 + r, -40 + r * 10, 2, 2);
    g.restore();
    beak(g, -112, -170, 34, 6, PAL.ochre, -0.3);
    blink(g, t, () => eye(g, -92, -178, 8));
  },

  dodo(g, t, pose) {
    shadow(g, 80);
    leg(g, -40, -110, -48, 0, PAL.lemon, 3);
    leg(g, 40, -110, 46, 0, PAL.lemon, 3);
    const flap = Math.sin(t * 3) * 3;
    g.translate(0, flap * 0.3);
    // curly tufts at the back
    for (let i = 0; i < 4; i++) plume(g, 150, -190 + i * 22, -0.6 + i * 0.3, 60, '#c8d070', 1.4, i + 7);
    // forked beak at the front
    poly(g, [[-150, -175], [-225, -185], [-150, -160]], 3); wash(g, PAL.lemon); ink(g, 1.8);
    poly(g, [[-150, -150], [-215, -140], [-150, -135]], 4); wash(g, PAL.lemon); ink(g, 1.8);
    // the note
    poly(g, [[-155, -205], [155, -200], [152, -108], [-152, -112]], 1, 1.2);
    wash(g, '#c9d48a'); ink(g);
    poly(g, [[-140, -192], [140, -188], [138, -120], [-138, -124]], 2, 0.8);
    ink(g, 1.4, '#556030');
    g.beginPath(); g.ellipse(0, -156, 34, 30, 0, 0, Math.PI * 2); g.fillStyle = '#e4e8b8'; g.fill(); ink(g, 1.6, '#556030');
    g.save();
    g.beginPath(); g.ellipse(0, -156, 34, 30, 0, 0, Math.PI * 2);
    hatch(g, -40, -190, 40, -120, 6, 0.25);
    g.restore();
    g.fillStyle = '#556030';
    g.font = 'bold 28px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const [x, y] of [[-118, -172], [118, -168], [-116, -136], [116, -132]]) g.fillText('1', x, y);
    blink(g, t, () => eye(g, -128, -152, 9));
  },

  // pose.light: 'red' | 'amber' | 'green' | null
  crow(g, t, pose) {
    shadow(g, 70);
    leg(g, -8, -175, -60, 0, INK, 3, PAL.strawberry);
    leg(g, 8, -175, 52, 0, INK, 3, PAL.strawberry);
    // the pole neck
    const sway = Math.sin(t * 1.3) * 3;
    g.beginPath(); g.moveTo(0, -175); g.lineTo(sway, -300); ink(g, 7);
    g.beginPath(); g.ellipse(0, -178, 14, 8, 0, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
    g.save();
    g.translate(sway, -300);
    // tail tuft and side spikes
    plume(g, 34, -40, -0.3, 40, PAL.orange, 1, 2);
    plume(g, 34, -30, 0.1, 34, PAL.orange, 1, 5);
    for (const sy of [-95, -60]) {
      poly(g, [[-34, sy], [-50, sy - 6], [-34, sy + 8]], sy); wash(g, '#3a4a3a'); ink(g, 1.4);
      poly(g, [[34, sy], [50, sy - 6], [34, sy + 8]], sy + 1); wash(g, '#3a4a3a'); ink(g, 1.4);
    }
    // the lantern
    poly(g, [[-34, -125], [34, -125], [32, 0], [-32, 0]], 1);
    wash(g, '#34463a'); ink(g);
    poly(g, [[-20, -125], [20, -125], [10, -140], [-10, -140]], 2); wash(g, '#34463a'); ink(g, 1.6);
    g.beginPath(); g.arc(0, -148, 8, 0, Math.PI * 2); g.fillStyle = '#34463a'; g.fill(); ink(g, 1.6);
    const lamps = [['red', '#e04a3a', '#5a2a24'], ['amber', '#f0b030', '#5a4a24'], ['green', '#5ac06a', '#244a2e']];
    lamps.forEach(([name, on, off], i) => {
      const ly = -100 + i * 38;
      const lit = pose.light === name;
      if (lit) {
        const grd = g.createRadialGradient(0, ly, 4, 0, ly, 40);
        grd.addColorStop(0, on);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(0, ly, 40, 0, Math.PI * 2); g.fill();
      }
      g.beginPath(); g.arc(0, ly, 14, 0, Math.PI * 2); g.fillStyle = lit ? on : off; g.fill(); ink(g, 1.8);
      g.beginPath(); g.arc(0, ly, 17, Math.PI * 1.1, Math.PI * 1.9); ink(g, 3, '#22302a');
    });
    beak(g, -32, -112, 30, 6, '#2a2a2a', 0.1);
    blink(g, t, () => eye(g, -18, -116, 6, '#efe6d0'));
    g.restore();
  },
};

// The Flowerpot Plume's plant, rising from the soil at (0, -235): shared by
// the stand-in and drawn over the delivered portrait.
function plumePlant(g, t, pose) {
  const growth = pose.growth ?? 0.15;
  const wilt = pose.wilt || 0;
  // the plant: a stem that rises with growth and droops with wilt
  const h = 30 + growth * 230;
  const sway = Math.sin(t * 1.5) * 4 + wilt * 60;
  const top = [sway, -235 - h];
  g.beginPath(); g.moveTo(0, -235); g.quadraticCurveTo(sway * 0.2, -235 - h * 0.5, top[0], top[1]);
  ink(g, 5, PAL.green);
  for (let i = 1; i <= Math.floor(growth * 7) + 1; i++) {
    const s = i / 8;
    const lx = sway * 0.2 * s * 2;
    const ly = -235 - h * s;
    for (const d of [-1, 1]) {
      blob(g, lx + d * 18, ly + 4 + wilt * 8, 16, 7, i * 3 + d, 0.1, 10);
      wash(g, PAL.sage); ink(g, 1.2);
    }
  }
  if (growth > 0.55) {
    const bud = Math.min(1, (growth - 0.55) / 0.45);
    const petals = bud > 0.9 ? 14 : 5;
    const R = 14 + bud * 60;
    const cols = [PAL.strawberry, PAL.slate, PAL.ochre, PAL.mauve, PAL.dusty];
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2 + t * 0.2;
      blob(g, top[0] + Math.cos(a) * R * 0.55, top[1] + Math.sin(a) * R * 0.45 - R * 0.3, R * 0.42, R * 0.3, i + 50, 0.1, 10);
      wash(g, cols[i % cols.length]); ink(g, 1.2);
    }
    blob(g, top[0], top[1] - R * 0.3, R * 0.25, R * 0.22, 77);
    wash(g, PAL.lemon); ink(g, 1.2);
  }
}

// Blinks now and then: the eye is drawn, or a closed line.
function blink(g, t, drawEye) {
  const phase = (t * 0.37) % 4;
  if (phase < 0.08) {
    g.save();
    drawEye();
    g.restore();
    return;
  }
  drawEye();
}

export const STANDIN_BIRDS = Object.keys(BIRD_DRAW);

// How each delivered portrait sits in the 400-unit bird space: `cx` and `feet`
// are the point between its feet as shares of the image, and `u` is the
// image's size in bird units, chosen so each portrait stands about as tall as
// its stand-in (the games place things by the stand-in's geometry). Measured
// from the delivered images.
const PORTRAIT = {
  bobolinks: { cx: 0.48, feet: 0.97, u: 325 },
  coot: { cx: 0.55, feet: 0.93, u: 448 },
  crow: { cx: 0.52, feet: 0.93, u: 500 },
  cupadee: { cx: 0.55, feet: 0.93, u: 372 },
  dodo: { cx: 0.5, feet: 0.87, u: 325 },
  gullfinch: { cx: 0.42, feet: 0.96, u: 485 },
  peeper: { cx: 0.55, feet: 0.97, u: 415 },
  piffle: { cx: 0.5, feet: 0.94, u: 391 },
  plume: { cx: 0.5, feet: 0.93, u: 377 },
  shuttercluck: { cx: 0.55, feet: 0.87, u: 414 },
};

// A point on a portrait (shares of the image) in bird units.
function at(id, fx, fy) {
  const p = PORTRAIT[id];
  return [(fx - p.cx) * p.u, (fy - p.feet) * p.u];
}

// Named points a game can ask for, in bird units from the feet, for whichever
// drawing is showing (the portrait once delivered, else the stand-in).
const POINTS = {
  coot: { head: { standin: [-115, -390], portrait: [0.537, 0.05] } },
};
export function birdPoint(id, name) {
  const p = POINTS[id]?.[name];
  if (!p) return [0, 0];
  return art('bird.' + id) ? at(id, ...p.portrait) : p.standin;
}

// What a portrait can't show by itself: lit lamps, growth, a blink.
const OVERLAY = {
  crow(g, t, pose) {
    const lamps = { red: [0.141, '#ff5a40'], amber: [0.219, '#ffc040'], green: [0.3, '#70e080'] };
    const l = lamps[pose.light];
    if (!l) return;
    const [x, y] = at('crow', 0.51, l[0]);
    const grd = g.createRadialGradient(x, y, 2, x, y, 46);
    grd.addColorStop(0, l[1]);
    grd.addColorStop(0.35, l[1] + 'aa');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, 46, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(x, y, 14, 0, Math.PI * 2);
    g.fillStyle = l[1];
    g.fill();
    g.beginPath();
    g.arc(x - 4, y - 4, 4, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,240,0.85)';
    g.fill();
  },
  plume(g, t, pose) {
    const growth = pose.growth ?? 0;
    const [sx, sy] = at('plume', 0.518, 0.293);
    if (art('sprites.plumeGrowth')) {
      // planted by plantedPlume()
    } else if (growth > 0.2) {
      const [x, y] = [sx, sy];
      g.save();
      g.translate(x, y + 235);
      plumePlant(g, t, pose);
      g.restore();
    }
    if (pose.soggy) {
      g.fillStyle = 'rgba(90,130,170,0.7)';
      for (let i = 0; i < 4; i++) g.fillRect(-60 + i * 35, -60 + ((t * 80 + i * 20) % 40), 4, 8);
    }
  },
  shuttercluck(g, t, pose) {
    if (!pose.click) return;
    const [x, y] = at('shuttercluck', 0.453, 0.527);
    g.beginPath();
    g.arc(x, y, 34 * Math.min(1, pose.click * 6), 0, Math.PI * 2);
    g.fillStyle = '#1e1e24';
    g.fill();
  },
};

// Birds drawn elsewhere (the undiscovered birds in subjects.js, which
// registers itself here): drawBird hands them over.
let otherBirds = null;
export function drawOtherBirds(fn) {
  otherBirds = fn;
}

export function drawBird(g, id, { x = 0, y = 0, size = 300, t = 0, flip = false, pose = {}, rot = 0, squash = 0 } = {}) {
  if (!BIRD_DRAW[id] && !PORTRAIT[id] && otherBirds) {
    otherBirds(g, id, { x, y, size, t, flip, pose });
    return;
  }
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  const s = size / 400;
  g.scale(flip ? -s : s, s * (1 - squash));
  if (squash) g.scale(1 + squash * 0.6, 1);
  const img = art('bird.' + id);
  if (img && !pose.standin && PORTRAIT[id]) {
    // The portrait faces left too; it breathes and hops instead of articulating.
    const p = PORTRAIT[id];
    g.scale(1, 1 + Math.sin(t * 2) * 0.012);
    if (pose.lift && !art('sprites.bobolinkBoots')) {
      g.translate(0, -10);
      g.rotate(pose.lift * 0.04);
    }
    const v = variant(id, pose);
    if (id === 'bobolinks' && art('sprites.bobolinkBoots')) {
      // Each boot on its own, so one can step while the other stands.
      const boot = (i, dx, dy, up) => {
        const c = spriteCell('sprites.bobolinkBoots', i).cell;
        g.save();
        g.translate(dx, dy - (up ? 26 : 0));
        if (up) g.rotate(-0.08);
        g.drawImage(art('sprites.bobolinkBoots'), c.x, c.y, c.w, c.h, -0.55 * p.u, -0.97 * p.u, p.u, p.u);
        g.restore();
      };
      boot(1, 70, -10, pose.lift > 0);
      boot(0, -45, 0, pose.lift < 0);
    } else if (v) {
      // Drawn so the bird is the portrait's size (the variant is painted at
      // v[2].painted of the portrait's scale) and its feet land where the
      // portrait's do (the portrait's feet are at v[2].pfeet of its height,
      // the variant's at v[2].feet of the cell).
      const c = spriteCell(v[0], v[1]).cell;
      const u = p.u / v[2].painted;
      g.drawImage(art(v[0]), c.x, c.y, c.w, c.h, -p.cx * u, (v[2].pfeet - p.feet) * p.u - v[2].feet * u, u, u);
    } else if (id === 'plume' && art('sprites.plumeGrowth')) plantedPlume(g, img, p, t, pose);
    else g.drawImage(img, -p.cx * p.u, -p.feet * p.u, p.u, p.u);
    OVERLAY[id]?.(g, t, pose);
  } else {
    seedBase = BOIL ? Math.floor(t * 5) % 3 * 0.37 : 0;
    BIRD_DRAW[id]?.(g, t, pose);
    seedBase = 0;
  }
  g.restore();
}

// The Flowerpot Plume with its plant growing in it. The portrait's own
// painted sprout is left out (only the pot below its back rim is drawn), the
// growth stage's soil mound is set down into the pot's soil, and the pot's
// front lip is drawn again over the mound's foot, so the plant sits in the
// pot rather than on top of it. Measured on the 1024 px portrait: the soil
// opening is an ellipse about (535, 305), 200 by 20 px; the back rim's top is
// at y 288.
const PLUME_POT = { cx: 535 / 1024, cy: 305 / 1024, rx: 200 / 1024, ry: 20 / 1024, rim: 288 / 1024, foot: 340 / 1024 };
function plantedPlume(g, img, p, t, pose) {
  const P = PLUME_POT;
  const x0 = -p.cx * p.u;
  const y0 = -p.feet * p.u;
  const U = p.u;
  const portrait = (clip) => {
    g.save();
    g.beginPath();
    clip();
    g.clip();
    g.drawImage(img, x0, y0, U, U);
    g.restore();
  };
  // 1. The pot, from its back rim down.
  portrait(() => g.rect(x0, y0 + P.rim * U, U, U));
  // 2. The plant, its mound's foot below the soil line.
  const growth = pose.growth ?? 0;
  const stage = (pose.wilt || 0) > 0.5 ? 3 : growth < 0.35 ? 0 : growth < 0.75 ? 1 : 2;
  const [sx, sy] = at('plume', P.cx, P.foot);
  g.save();
  g.translate(sx, sy);
  g.rotate(Math.sin(t * 1.5) * 0.02);
  drawSprite(g, 'sprites.plumeGrowth', stage, 0, 0.033 * 420, { h: 420, whole: true });
  g.restore();
  // 3. The front lip again, over the mound's foot: everything below the near
  // half of the soil opening.
  portrait(() => {
    const cx = x0 + P.cx * U;
    const cy = y0 + P.cy * U;
    g.moveTo(x0, cy);
    g.lineTo(cx - P.rx * U, cy);
    g.ellipse(cx, cy, P.rx * U, P.ry * U, 0, Math.PI, 0, true);
    g.lineTo(x0 + U, cy);
    g.lineTo(x0 + U, y0 + U);
    g.lineTo(x0, y0 + U);
    g.closePath();
  });
}

// A painted variant of the portrait for this pose, as [sheet, cell, fit], or
// null. The variants are framed like the portrait, but the bird in them is
// painted at a slightly different scale (`painted`, against the portrait:
// design/source/pose-scales.json) and stands on a different line (`feet`, a
// share of the cell's height; `pfeet`, the portrait's own).
const VARIANTS = {
  'sprites.cootPoses': [{ painted: 0.932, feet: 0.96, pfeet: 0.979 }, { painted: 0.909, feet: 0.982, pfeet: 0.979 }],
  'sprites.gullfinchSing': [{ painted: 0.965, feet: 0.986, pfeet: 0.987 }],
  'sprites.cupadeeOpen': [{ painted: 1.034, feet: 0.962, pfeet: 0.964 }],
};
function variant(id, pose) {
  const v = (key, i) => (art(key) ? [key, i, VARIANTS[key][i]] : null);
  if (id === 'coot' && pose.frame) return v('sprites.cootPoses', pose.frame === 'lookup' ? 1 : 0);
  if (id === 'gullfinch' && (pose.sing || 0) > 0.5) return v('sprites.gullfinchSing', 0);
  if (id === 'cupadee' && pose.open) return v('sprites.cupadeeOpen', 0);
  return null;
}

// A dark ink silhouette of a bird, for birds not yet spotted.
// One scratch canvas, reused (a page draws its silhouette every frame).
let silCanvas = null;
export function drawSilhouette(g, id, opts) {
  const c = (silCanvas ||= document.createElement('canvas'));
  if (c.width !== g.canvas.width || c.height !== g.canvas.height) {
    c.width = g.canvas.width;
    c.height = g.canvas.height;
  }
  const h = c.getContext('2d');
  h.setTransform(1, 0, 0, 1, 0, 0);
  h.globalCompositeOperation = 'source-over';
  h.clearRect(0, 0, c.width, c.height);
  h.setTransform(g.getTransform());
  drawBird(h, id, opts);
  h.setTransform(1, 0, 0, 1, 0, 0);
  h.globalCompositeOperation = 'source-in';
  h.fillStyle = 'rgba(70,55,45,0.85)';
  h.fillRect(0, 0, c.width, c.height);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(c, 0, 0);
  g.restore();
}

// ---------- sprite sheets ----------
// Each delivered sheet is an even grid (columns x rows), read row by row.
// `drawSprite` draws one cell, trimmed to what is painted in it, standing on
// (x, y) or centred there; it returns false while the sheet is not delivered
// so the caller draws its stand-in instead.
export const SHEETS = {
  'sprites.scoops': [5, 2], // strawberry, lemon, vanilla, chocolate, mint, pistachio, blueberry, cherry, pickle, sock
  'sprites.cootPoses': [2, 1], // mid-stride, looking up
  'sprites.cupadeeOpen': [1, 1],
  'sprites.teapot': [1, 1],
  'sprites.hides': [3, 2], // bush, wall, trunk with knothole, gate pillar, hedge, tall grass
  'sprites.gullfinchSing': [1, 1],
  'sprites.plumeGrowth': [4, 1], // sprout, bud, bloom, wilted
  'sprites.bobolinkBoots': [2, 1], // left boot, right boot
  'sprites.stones': [3, 2],
  'sprites.scraps': [4, 2],
  'sprites.hats': [3, 1], // black bowler, top hat, brown bowler
  'sprites.cars': [2, 2], // pink, blue, mustard, sage; all facing left
  'sprites.chicks': [3, 2], // standing x3, walking x2, flying
};

const trims = new Map();
// The cell's rectangle in the image, and the painted part of it (alpha > 24).
export function spriteCell(key, i) {
  const img = art(key);
  const grid = SHEETS[key];
  if (!img || !grid) return null;
  const id = key + '#' + i;
  if (trims.has(id)) return trims.get(id);
  const [cols, rows] = grid;
  const cw = img.width / cols;
  const ch = img.height / rows;
  const cx = (i % cols) * cw;
  const cy = Math.floor(i / cols) * ch;
  let box = { x: cx, y: cy, w: cw, h: ch };
  try {
    const k = 0.25; // measure at a quarter size
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cw * k));
    c.height = Math.max(1, Math.round(ch * k));
    const h = c.getContext('2d', { willReadFrequently: true });
    h.drawImage(img, cx, cy, cw, ch, 0, 0, c.width, c.height);
    const d = h.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (d[(y * c.width + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 >= 0) box = { x: cx + x0 / k, y: cy + y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k };
  } catch {
    /* no canvas reads: use the whole cell */
  }
  const cell = { img, cell: { x: cx, y: cy, w: cw, h: ch }, trim: box };
  trims.set(id, cell);
  return cell;
}

// opts: h or w (drawn size of the painted part), anchor 'bottom' | 'center',
// flip, rot, alpha. With `whole: true` the full cell is drawn and sized
// instead of its painted part (for stages that must share one scale).
export function drawSprite(g, key, i, x, y, { h, w, anchor = 'bottom', flip = false, rot = 0, alpha = 1, whole = false } = {}) {
  const s = spriteCell(key, i);
  if (!s) return false;
  const r = whole ? s.cell : s.trim;
  const k = h ? h / r.h : w ? w / r.w : 1;
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  if (flip) g.scale(-1, 1);
  if (alpha < 1) g.globalAlpha *= alpha;
  const dw = r.w * k;
  const dh = r.h * k;
  g.drawImage(s.img, r.x, r.y, r.w, r.h, -dw / 2, anchor === 'bottom' ? -dh : -dh / 2, dw, dh);
  g.restore();
  return true;
}

// ---------- paper and scenes ----------

let grain = null;
function grainPattern(g) {
  if (grain) return grain;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const h = c.getContext('2d');
  h.fillStyle = PAPER;
  h.fillRect(0, 0, 256, 256);
  const d = h.getImageData(0, 0, 256, 256);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d.data[i] += n;
    d.data[i + 1] += n;
    d.data[i + 2] += n * 0.8;
  }
  h.putImageData(d, 0, 0);
  grain = g.createPattern(c, 'repeat');
  return grain;
}

export function paper(g, w, h) {
  const img = art('paper');
  if (img) {
    const p = g.createPattern(img, 'repeat');
    g.fillStyle = p;
  } else g.fillStyle = grainPattern(g);
  g.fillRect(0, 0, w, h);
}

// Covers the whole canvas with a delivered scene, or paints a simple
// stand-in with `standin(g)`. Returns true when the delivered art was drawn.
export function scene(g, id, w, h, standin) {
  const img = art('scene.' + id);
  if (img) {
    const s = Math.max(w / img.width, h / img.height);
    g.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
    return true;
  }
  paper(g, w, h);
  if (standin) standin(g);
  return false;
}

// A soft watercolour band, for skies, ground, water.
export function band(g, x, y, w, h, color, alpha = 0.6, seed = 0) {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y + jit(seed, 6));
  for (let i = 1; i <= 12; i++) g.lineTo(x + (w * i) / 12, y + jit(seed + i, 6));
  g.lineTo(x + w, y + h);
  g.lineTo(x, y + h);
  g.closePath();
  g.fill();
  g.restore();
}

// Shared text style on the canvas.
// The opening hint of a minigame: a line over the painting, haloed. On a
// narrow screen the view shows only `span` of the width around `focus`, so a
// line too wide for that is split at its " · " into lines, and each is kept
// inside the view.
export function hint(g, text, x, y, { focus = x, span = 760, size = 34, color = INK, weight = 600 } = {}) {
  g.font = `${weight} ${size}px Fraunces, Georgia, serif`;
  const lines = g.measureText(text).width > span - 80 ? text.split(' · ') : [text];
  // centred on y, but never off the bottom of the 900-high scene
  const y0 = Math.min(y - ((lines.length - 1) * size * 1.2) / 2, 900 - size * 0.75 - (lines.length - 1) * size * 1.2);
  lines.forEach((line, i) => {
    const half = g.measureText(line).width / 2 + 24;
    const lx = Math.min(Math.max(x, focus - span / 2 + half), focus + span / 2 - half);
    label(g, line, lx, y0 + i * size * 1.2, { size, color, weight, halo: true });
  });
}

// `halo` rings the letters in cream paper first, so a line stays readable over
// a busy painting.
export function label(g, text, x, y, { size = 40, align = 'center', color = INK, font = 'Fraunces, Georgia, serif', weight = 600, baseline = 'middle', halo = false } = {}) {
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = baseline;
  if (halo) {
    g.save();
    g.lineJoin = 'round';
    g.lineWidth = Math.max(4, size * 0.2);
    g.strokeStyle = 'rgba(250,244,228,0.92)';
    g.strokeText(text, x, y);
    g.restore();
  }
  g.fillStyle = color;
  g.fillText(text, x, y);
}
