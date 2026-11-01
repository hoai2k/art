// All 28 field-guide birds and ten pocket birds for Shuttercluck.
// Each is drawn from its delivered painting (IC-R01..R18 and IC-N01..N10), or
// from a small ink-and-wash stand-in until then, in drawBird's space: 400
// units tall at size 400, feet at the origin, facing left.
//
// `box` is the drawing's extent (left, right, top) and `head` where its head
// is, for peeking out of the knothole; `tier` 0..2 is how rare it is (rarer
// ones are worth more and peek for less time).

import { BIRDS } from './birds.js';

import { drawBird, art, blob, poly, wash, ink, hatch, eye, beak, leg, drawOtherBirds, PAL, INK } from './draw.js';

// The paintings share the field-guide portraits' framing: the bird fills
// about 80% of a square, centred, drawn 420 units wide.
const FRAME = { cx: 0.5, u: 420 };

// Measured on each delivered painting: where its claws touch the ground (a
// share of the image's height), the solid extent of the bird and where its
// head is, in drawBird units (feet at the origin). The games and Shuttercluck
// use these once the painting has loaded, the stand-in's own otherwise.
const PAINTED = {
  // Original guide portraits, normalized to the same 420-unit framing.
  coot: { feet: 0.93, box: { x0: -142, x1: 155, top: -370 }, head: [0, -340] },
  shuttercluck: { feet: 0.87, box: { x0: -199, x1: 203, top: -304 }, head: [-21, -155] },
  gullfinch: { feet: 0.96, box: { x0: -153, x1: 146, top: -397 }, head: [-34, -239] },
  bobolinks: { feet: 0.97, box: { x0: -188, x1: 171, top: -400 }, head: [-46, -269] },
  peeper: { feet: 0.97, box: { x0: -141, x1: 181, top: -405 }, head: [-46, -273] },
  piffle: { feet: 0.94, box: { x0: -159, x1: 180, top: -386 }, head: [-25, -176] },
  crow: { feet: 0.93, box: { x0: -97, x1: 112, top: -386 }, head: [0, -298] },
  plume: { feet: 0.93, box: { x0: -123, x1: 124, top: -375 }, head: [-13, -252] },
  cupadee: { feet: 0.93, box: { x0: -144, x1: 182, top: -371 }, head: [-42, -227] },
  dodo: { feet: 0.87, box: { x0: -208, x1: 203, top: -296 }, head: [-113, -210] },
  broomwhisk: { feet: 0.980, box: { x0: -123, x1: 144, top: -402 }, head: [-42, -368] },
  buttonbeaks: { feet: 0.942, box: { x0: -189, x1: 199, top: -362 }, head: [-72, -307] },
  drippet: { feet: 0.976, box: { x0: -185, x1: 194, top: -395 }, head: [20, -348] },
  garbagecanary: { feet: 0.969, box: { x0: -155, x1: 183, top: -387 }, head: [-29, -333] },
  glovedove: { feet: 0.974, box: { x0: -199, x1: 199, top: -392 }, head: [-132, -333] },
  keycrane: { feet: 0.970, box: { x0: -183, x1: 190, top: -391 }, head: [-63, -332] },
  ladlelark: { feet: 0.972, box: { x0: -174, x1: 180, top: -393 }, head: [-73, -346] },
  milkmidge: { feet: 0.966, box: { x0: -111, x1: 128, top: -389 }, head: [-13, -335] },
  niffy: { feet: 0.970, box: { x0: -190, x1: 188, top: -393 }, head: [45, -333] },
  plugsocketswift: { feet: 0.977, box: { x0: -194, x1: 191, top: -391 }, head: [-74, -341] },
  radiobird: { feet: 0.932, box: { x0: -142, x1: 156, top: -356 }, head: [-68, -299] },
  saltshakershrike: { feet: 0.976, box: { x0: -160, x1: 173, top: -394 }, head: [-71, -338] },
  sawbird: { feet: 0.911, box: { x0: -201, x1: 202, top: -334 }, head: [-8, -274] },
  snippit: { feet: 0.966, box: { x0: -200, x1: 202, top: -386 }, head: [-19, -334] },
  steampressersparrow: { feet: 0.967, box: { x0: -198, x1: 202, top: -386 }, head: [10, -330] },
  titthrush: { feet: 0.978, box: { x0: -175, x1: 189, top: -400 }, head: [-9, -342] },
  waterglassgoose: { feet: 0.980, box: { x0: -165, x1: 171, top: -402 }, head: [-66, -356] },
  wetweatherwren: { feet: 0.969, box: { x0: -193, x1: 201, top: -383 }, head: [-143, -292] },
  bellowsbittern: { feet: 0.949, box: { x0: -183, x1: 192, top: -373 }, head: [53, -314] },
  candlestickkiwi: { feet: 0.980, box: { x0: -173, x1: 174, top: -403 }, head: [36, -340] },
  concertinacurlew: { feet: 0.954, box: { x0: -198, x1: 200, top: -375 }, head: [32, -311] },
  hatboxhoopoe: { feet: 0.987, box: { x0: -161, x1: 165, top: -410 }, head: [37, -350] },
  hourglassheron: { feet: 0.988, box: { x0: -160, x1: 152, top: -406 }, head: [-24, -362] },
  lampshadeloon: { feet: 0.978, box: { x0: -173, x1: 186, top: -397 }, head: [-46, -347] },
  mousetrapmagpie: { feet: 0.919, box: { x0: -200, x1: 201, top: -346 }, head: [-79, -288] },
  rollingpinrail: { feet: 0.887, box: { x0: -203, x1: 202, top: -298 }, head: [-46, -249] },
  spectaclesnipe: { feet: 0.962, box: { x0: -200, x1: 201, top: -383 }, head: [-32, -320] },
  weathervanewarbler: { feet: 0.981, box: { x0: -191, x1: 199, top: -399 }, head: [-64, -340] },
};

// The box and head of the bird as it is drawn now.
export function subjectShape(id) {
  const sub = SUBJECTS[id];
  const p = PAINTED[id];
  return p && art((sub.pocket ? 'pocket.' : sub.guideBase ? 'bird.' : 'subject.') + id) ? p : sub;
}

// Two thin legs from the body down to the feet.
function legs(g, x, hip, gap = 34, color = INK) {
  leg(g, x - gap / 2, hip, x - gap / 2 - 6, 0, color);
  leg(g, x + gap / 2, hip, x + gap / 2 + 4, 0, color);
}
// A head: eye and beak facing left.
function head(g, x, y, r = 22, color = PAL.cream, bk = PAL.ochre, len = 46) {
  blob(g, x, y, r, r * 0.9, 3);
  wash(g, color);
  ink(g, 2);
  eye(g, x - r * 0.15, y - r * 0.1, r * 0.42);
  beak(g, x - r * 0.75, y + r * 0.1, len, r * 0.3, bk);
}
function feathers(g, x, y, color, n = 3, dir = 1) {
  for (let i = 0; i < n; i++) {
    blob(g, x + dir * (20 + i * 6), y - 10 + i * 12, 26, 9, i + 2, 0.1);
    wash(g, color, 0.85);
    ink(g, 1.5);
  }
}

export const SUBJECTS = {
  milkmidge: {
    name: 'the Milkbottle Midge', tier: 0, box: { x0: -110, x1: 70, top: -300 }, head: [-40, -250],
    draw(g) {
      legs(g, 0, -90);
      poly(g, [[-55, -95], [55, -95], [58, -190], [28, -230], [26, -265], [-26, -265], [-28, -230], [-58, -190]], 2);
      wash(g, '#f6f3ea');
      ink(g, 2.4);
      g.fillStyle = '#c9c9c9';
      g.fillRect(-28, -282, 56, 18);
      eye(g, -20, -205, 11);
      beak(g, -55, -195, 50, 8, PAL.ochre);
    },
  },
  waterglassgoose: {
    name: 'the Waterglass Goose', tier: 0, box: { x0: -150, x1: 140, top: -360 }, head: [-110, -330],
    draw(g) {
      legs(g, 10, -150, 40);
      poly(g, [[-70, -230], [80, -250], [95, -150], [-50, -130]], 4);
      wash(g, '#eef2f0');
      ink(g, 2.4);
      g.beginPath();
      g.moveTo(-55, -215);
      g.quadraticCurveTo(-110, -260, -90, -330);
      ink(g, 12, '#e8e6dc');
      ink(g, 2);
      head(g, -95, -335, 20, '#ece8dc', PAL.ochre, 40);
      feathers(g, 85, -220, '#555a60', 3, 1);
    },
  },
  niffy: {
    name: 'the Jackknife Niffy', tier: 1, box: { x0: -170, x1: 110, top: -290 }, head: [-100, -220],
    draw(g) {
      legs(g, 0, -150);
      blob(g, 0, -190, 95, 34, 5, 0.04);
      wash(g, '#c0392b');
      ink(g, 2.4);
      poly(g, [[-80, -205], [-170, -230], [-90, -180]], 2);
      wash(g, '#cfd4d8');
      ink(g, 2);
      poly(g, [[-10, -215], [60, -290], [40, -205]], 3);
      wash(g, '#cfd4d8');
      ink(g, 2);
      eye(g, -60, -200, 11);
    },
  },
  snippit: {
    name: 'the Cutitup Snippit', tier: 1, box: { x0: -200, x1: 150, top: -300 }, head: [-60, -230],
    draw(g) {
      legs(g, 40, -150);
      for (const [cy, a] of [[-235, 0.12], [-205, -0.12]]) {
        poly(g, [[-30, cy], [-200, cy - a * 300], [-35, cy + 14]], 6);
        wash(g, '#d0d4d8');
        ink(g, 2);
      }
      for (const cy of [-245, -190]) {
        blob(g, 50, cy, 38, 26, cy, 0.05);
        wash(g, PAL.strawberry, 0.6);
        ink(g, 4, '#d0607a');
      }
      eye(g, -30, -220, 12);
      feathers(g, 90, -230, '#e8a0b8', 3);
    },
  },
  buttonbeaks: {
    name: 'the Buttonbeaks', tier: 2, box: { x0: -160, x1: 150, top: -230 }, head: [-80, -170],
    draw(g) {
      for (const [x, c] of [[-60, '#c08060'], [70, '#6f8fb0']]) {
        legs(g, x, -70, 24);
        blob(g, x, -130, 60, 58, x, 0.06);
        wash(g, c);
        ink(g, 2.4);
        g.beginPath();
        g.arc(x - 55, -150, 22, 0, Math.PI * 2);
        g.fillStyle = '#f2e6c8';
        g.fill();
        ink(g, 2);
        for (const [dx, dy] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
          g.beginPath();
          g.arc(x - 55 + dx, -150 + dy, 3, 0, Math.PI * 2);
          g.fillStyle = INK;
          g.fill();
        }
        eye(g, x - 15, -165, 10);
      }
    },
  },
  broomwhisk: {
    name: 'the Broomwhisk', tier: 0, box: { x0: -110, x1: 110, top: -420 }, head: [-50, -390],
    draw(g) {
      poly(g, [[-25, -180], [25, -180], [100, 0], [-100, 0]], 4, 3);
      wash(g, '#d9b25a');
      ink(g, 2.4);
      hatch(g, -90, -170, 90, 0, 10, 0.4, 2);
      g.beginPath();
      g.moveTo(0, -180);
      g.lineTo(-20, -380);
      ink(g, 10, '#9a6a3a');
      ink(g, 2);
      head(g, -25, -390, 22, '#e6d2a0', PAL.ochre, 44);
    },
  },
  keycrane: {
    name: 'the Key Crane', tier: 1, box: { x0: -170, x1: 150, top: -360 }, head: [-110, -290],
    draw(g) {
      legs(g, 20, -180, 40);
      g.beginPath();
      g.moveTo(-80, -230);
      g.lineTo(130, -215);
      ink(g, 18, '#c9a24a');
      ink(g, 2);
      poly(g, [[100, -215], [100, -180], [118, -180], [118, -200], [135, -200], [135, -215]], 2);
      wash(g, '#c9a24a');
      ink(g, 2);
      g.beginPath();
      g.arc(-110, -250, 42, 0, Math.PI * 2);
      g.fillStyle = '#c9a24a';
      g.fill();
      ink(g, 2.4);
      g.beginPath();
      g.arc(-110, -250, 18, 0, Math.PI * 2);
      g.fillStyle = '#f4ecd6';
      g.fill();
      ink(g, 2);
      poly(g, [[-130, -290], [-90, -290], [-95, -350], [-125, -350]], 3);
      wash(g, '#3a3030');
      ink(g, 2);
      eye(g, -125, -265, 9);
      beak(g, -150, -255, 30, 7);
    },
  },
  garbagecanary: {
    name: 'the Garbage Canary', tier: 0, box: { x0: -120, x1: 110, top: -330 }, head: [-50, -280],
    draw(g) {
      legs(g, 0, -80);
      poly(g, [[-80, -90], [80, -90], [92, -250], [-92, -250]], 3, 2);
      wash(g, '#a8aeb0');
      ink(g, 2.4);
      for (let x = -60; x <= 60; x += 30) {
        g.beginPath();
        g.moveTo(x, -100);
        g.lineTo(x * 1.1, -240);
        ink(g, 1.2);
      }
      head(g, -40, -275, 26, '#f2d24a', PAL.ochre, 40);
      poly(g, [[-100, -270], [110, -330], [115, -310], [-95, -250]], 5);
      wash(g, '#b8bec0');
      ink(g, 2.4);
    },
  },
  steampressersparrow: {
    name: 'the Steampresser Sparrow', tier: 2, box: { x0: -170, x1: 120, top: -300 }, head: [-130, -200],
    draw(g) {
      legs(g, 0, -120);
      poly(g, [[-160, -130], [110, -130], [110, -200], [-60, -210]], 3, 2);
      wash(g, '#555658');
      ink(g, 2.4);
      g.beginPath();
      g.moveTo(-20, -205);
      g.quadraticCurveTo(40, -290, 100, -205);
      ink(g, 9, '#7a5030');
      ink(g, 2);
      for (let i = 0; i < 3; i++) {
        blob(g, -40 + i * 50, -110, 18, 10, i, 0.2);
        wash(g, '#ffffff', 0.7);
      }
      head(g, -140, -195, 22, '#9a7050', PAL.ochre, 36);
    },
  },
  wetweatherwren: {
    name: 'the Wetweather Wren', tier: 2, box: { x0: -165, x1: 120, top: -320 }, head: [-110, -250],
    draw(g) {
      legs(g, 0, -120, 30);
      poly(g, [[-110, -240], [100, -200], [100, -150], [-90, -225]], 4);
      wash(g, '#2c2c34');
      ink(g, 2.4);
      g.beginPath();
      g.arc(110, -150, 22, -Math.PI / 2, Math.PI / 2);
      ink(g, 7, '#7a5030');
      head(g, -115, -245, 18, '#8a6a4a', PAL.ochre, 32);
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(-120 + i * 45, -320 + (i % 2) * 30);
        g.lineTo(-126 + i * 45, -300 + (i % 2) * 30);
        ink(g, 2, '#6a90b0');
      }
    },
  },
  glovedove: {
    name: 'the Glove Dove', tier: 1, box: { x0: -235, x1: 150, top: -330 }, head: [-170, -290],
    draw(g) {
      legs(g, 20, -120, 44);
      blob(g, 30, -170, 90, 55, 7, 0.06);
      wash(g, '#8a9cb8');
      ink(g, 2.4);
      for (let i = 0; i < 4; i++) {
        blob(g, 120 + i * 8, -230 + i * 22, 34, 11, i, 0.1);
        wash(g, '#e8a0b0');
        ink(g, 1.6);
      }
      g.beginPath();
      g.moveTo(-40, -190);
      g.quadraticCurveTo(-150, -200, -165, -280);
      ink(g, 26, '#e8a0b0');
      ink(g, 2);
      head(g, -170, -290, 20, '#e8a0b0', PAL.ochre, 44);
    },
  },
  titthrush: {
    name: "the Ten O'clock Tit Trush", tier: 2, box: { x0: -150, x1: 150, top: -330 }, head: [-110, -290],
    draw(g) {
      legs(g, 0, -100);
      g.beginPath();
      g.arc(0, -195, 95, 0, Math.PI * 2);
      g.fillStyle = '#d8b040';
      g.fill();
      ink(g, 2.4);
      g.beginPath();
      g.arc(0, -195, 75, 0, Math.PI * 2);
      g.fillStyle = '#fbf6e4';
      g.fill();
      ink(g, 1.6);
      g.beginPath();
      g.moveTo(0, -195);
      g.lineTo(-40, -220);
      g.moveTo(0, -195);
      g.lineTo(0, -250);
      ink(g, 3);
      head(g, -95, -285, 18, '#d8b040', PAL.ochre, 34);
      feathers(g, 90, -200, '#e8a0b8', 3);
    },
  },
  plugsocketswift: {
    name: 'the Plugsocket Swift', tier: 1, box: { x0: -150, x1: 160, top: -360 }, head: [-50, -300],
    draw(g) {
      legs(g, 0, -110);
      blob(g, 0, -160, 70, 55, 9, 0.04);
      wash(g, '#ece6d4');
      ink(g, 2.4);
      for (const dx of [-14, 14]) {
        g.fillStyle = INK;
        g.fillRect(dx - 4, -170, 8, 18);
      }
      poly(g, [[40, -190], [160, -250], [70, -160]], 4);
      wash(g, '#6a7080');
      ink(g, 2);
      g.fillStyle = '#c0a050';
      g.fillRect(-28, -240, 56, 26);
      g.beginPath();
      g.arc(-10, -290, 50, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,248,200,0.9)';
      g.fill();
      ink(g, 2.4);
      eye(g, -30, -295, 11);
      beak(g, -55, -285, 40, 7);
    },
  },
  saltshakershrike: {
    name: 'the Saltshaker Shrike', tier: 2, box: { x0: -130, x1: 90, top: -320 }, head: [-30, -280],
    draw(g) {
      legs(g, 0, -100);
      poly(g, [[-55, -100], [55, -100], [48, -240], [-48, -240]], 3, 1.5);
      wash(g, '#eef0ee');
      ink(g, 2.4);
      blob(g, 0, -265, 50, 32, 3, 0.03);
      wash(g, '#c0c4c8');
      ink(g, 2);
      g.fillStyle = INK;
      g.fillRect(-48, -275, 40, 9);
      eye(g, -28, -270, 9);
      poly(g, [[-45, -258], [-110, -250], [-100, -240], [-45, -248]], 2);
      wash(g, INK);
    },
  },
  ladlelark: {
    name: 'the Soupladle Lark', tier: 0, box: { x0: -170, x1: 110, top: -350 }, head: [-140, -320],
    draw(g) {
      legs(g, 10, -120);
      g.beginPath();
      g.arc(20, -170, 80, 0, Math.PI);
      g.closePath();
      g.fillStyle = '#9aa0a8';
      g.fill();
      ink(g, 2.4);
      g.beginPath();
      g.moveTo(-50, -175);
      g.quadraticCurveTo(-130, -200, -130, -310);
      ink(g, 10, '#9aa0a8');
      ink(g, 2);
      head(g, -135, -320, 18, '#9aa0a8', PAL.ochre, 36);
    },
  },
  drippet: {
    name: 'the Drippet', tier: 1, box: { x0: -170, x1: 100, top: -320 }, head: [-40, -250],
    draw(g) {
      legs(g, 10, -110);
      blob(g, 20, -180, 70, 55, 4, 0.05);
      wash(g, '#5a8ab8');
      ink(g, 2.4);
      poly(g, [[-40, -200], [-150, -195], [-160, -160], [-140, -160], [-130, -180], [-40, -170]], 3);
      wash(g, '#5a8ab8');
      ink(g, 2);
      g.beginPath();
      g.moveTo(20, -235);
      g.lineTo(20, -275);
      g.moveTo(-15, -275);
      g.lineTo(55, -275);
      ink(g, 8, '#c9a24a');
      eye(g, -10, -195, 12);
      blob(g, -150, -135, 7, 10, 1, 0.1);
      wash(g, '#8ab8e0');
      blob(g, -60, -2, 60, 8, 2, 0.1);
      wash(g, '#8ab8e0', 0.5);
    },
  },
  sawbird: {
    name: 'the Saw Bird', tier: 0, box: { x0: -210, x1: 120, top: -300 }, head: [40, -260],
    draw(g) {
      legs(g, 50, -150);
      poly(g, [[0, -250], [-210, -205], [-210, -180], [0, -190]], 2);
      wash(g, '#c8ccd0');
      ink(g, 2);
      g.beginPath();
      for (let x = -205; x < 0; x += 12) {
        g.moveTo(x, -186);
        g.lineTo(x + 6, -175);
        g.lineTo(x + 12, -188);
      }
      ink(g, 1.5);
      blob(g, 50, -215, 65, 55, 6, 0.05);
      wash(g, '#a0683a');
      ink(g, 2.4);
      eye(g, 30, -240, 11);
    },
  },
  radiobird: {
    name: 'the Radio Bird', tier: 1, box: { x0: -150, x1: 110, top: -380 }, head: [-100, -350],
    draw(g) {
      legs(g, 0, -120, 44);
      poly(g, [[-80, -120], [90, -120], [90, -230], [-80, -230]], 2, 1.5);
      wash(g, '#c7a86a');
      ink(g, 2.4);
      hatch(g, -60, -215, 20, -135, 7, 0.6, 1);
      g.beginPath();
      g.arc(55, -175, 22, 0, Math.PI * 2);
      ink(g, 2);
      g.beginPath();
      g.moveTo(-40, -230);
      g.quadraticCurveTo(-110, -260, -95, -340);
      ink(g, 9, '#d07a50');
      ink(g, 2);
      head(g, -100, -350, 18, '#e0b080', PAL.ochre, 36);
    },
  },

  // Ten new rare birds of our own, in Lobel's manner (IC-N01..N10): not in
  // the book, kept for later pages, and meanwhile something else to spot.
  hourglassheron: {
    name: 'the Hourglass Heron', tier: 1, pocket: true, box: { x0: -150, x1: 90, top: -420 }, head: [-80, -395],
    draw(g, t) {
      legs(g, 0, -150, 30);
      for (const y of [-155, -300]) {
        g.fillStyle = '#8a5a30';
        g.fillRect(-60, y, 120, 14);
        ink(g, 2);
      }
      poly(g, [[-45, -290], [45, -290], [8, -225], [45, -160], [-45, -160], [-8, -225]], 3);
      wash(g, 'rgba(230,240,240,0.8)');
      ink(g, 2);
      poly(g, [[-35, -165], [35, -165], [0, -205]], 1);
      wash(g, '#e0c080');
      g.beginPath();
      g.moveTo(0, -300);
      g.quadraticCurveTo(-60, -340, -60, -390);
      ink(g, 9, '#b8c4c8');
      ink(g, 2);
      head(g, -65, -395, 17, '#b8c4c8', PAL.ochre, 50);
    },
  },
  spectaclesnipe: {
    name: 'the Spectacle Snipe', tier: 0, pocket: true, box: { x0: -190, x1: 130, top: -270 }, head: [-40, -200],
    draw(g) {
      legs(g, 0, -150, 36);
      for (const x of [-60, 50]) {
        g.beginPath();
        g.arc(x, -195, 42, 0, Math.PI * 2);
        g.fillStyle = 'rgba(220,235,240,0.7)';
        g.fill();
        ink(g, 4, '#8a7040');
        eye(g, x, -195, 12);
      }
      beak(g, -100, -190, 90, 6, '#8a7040');
      g.beginPath();
      g.moveTo(92, -200);
      g.lineTo(130, -150);
      ink(g, 3, '#8a7040');
    },
  },
  bellowsbittern: {
    name: 'the Bellows Bittern', tier: 1, pocket: true, box: { x0: -190, x1: 130, top: -280 }, head: [-110, -200],
    draw(g, t) {
      const puff = 1 + Math.sin(t * 3) * 0.08;
      legs(g, 10, -130);
      poly(g, [[-90, -195], [70, -260 * puff + 10], [120, -200], [70, -140 / puff - 10]], 5);
      wash(g, '#a0683a');
      ink(g, 2.4);
      hatch(g, -80, -260, 120, -140, 12, 0.5, 2);
      poly(g, [[-90, -205], [-185, -198], [-90, -188]], 2);
      wash(g, '#c9a24a');
      ink(g, 2);
      eye(g, -40, -205, 11);
    },
  },
  lampshadeloon: {
    name: 'the Lampshade Loon', tier: 1, pocket: true, box: { x0: -130, x1: 120, top: -340 }, head: [-30, -310],
    draw(g) {
      legs(g, 0, -90);
      poly(g, [[-45, -240], [45, -240], [100, -100], [-100, -100]], 3, 2);
      wash(g, '#f2d890');
      ink(g, 2.4);
      for (let x = -95; x <= 95; x += 12) {
        g.beginPath();
        g.moveTo(x, -100);
        g.lineTo(x, -85);
        ink(g, 1.5, '#c9a24a');
      }
      blob(g, -10, -275, 30, 34, 4, 0.05);
      wash(g, '#2c3030');
      ink(g, 2);
      eye(g, -22, -285, 10, '#e05040');
      beak(g, -38, -272, 50, 8, '#3a3a3a');
    },
  },
  concertinacurlew: {
    name: 'the Concertina Curlew', tier: 2, pocket: true, box: { x0: -200, x1: 120, top: -270 }, head: [-80, -200],
    draw(g, t) {
      const sq = 1 + Math.sin(t * 2.5) * 0.15;
      legs(g, 0, -130);
      for (let i = 0; i < 5; i++) {
        const x = (-60 + i * 30) * sq;
        poly(g, [[x, -245], [x + 15 * sq, -230], [x + 15 * sq, -150], [x, -135]], i);
        wash(g, i % 2 ? '#c9b8a0' : '#b0443a');
        ink(g, 1.6);
      }
      for (const x of [-80 * sq, 90 * sq]) {
        poly(g, [[x - 18, -255], [x + 18, -255], [x + 18, -125], [x - 18, -125]], 3);
        wash(g, '#3a2a40');
        ink(g, 2);
      }
      eye(g, -80 * sq, -205, 10);
      g.beginPath();
      g.moveTo(-98 * sq, -195);
      g.quadraticCurveTo(-170, -190, -195, -130);
      ink(g, 6, PAL.ochre);
      ink(g, 1.5);
    },
  },
  weathervanewarbler: {
    name: 'the Weathervane Warbler', tier: 2, pocket: true, box: { x0: -170, x1: 150, top: -330 }, head: [-130, -280],
    draw(g, t) {
      g.save();
      g.translate(0, -270);
      g.rotate(Math.sin(t * 0.8) * 0.12);
      poly(g, [[-150, 0], [-110, -18], [-110, -6], [110, -6], [140, -40], [150, 0], [140, 40], [110, 6], [-110, 6], [-110, 18]], 4);
      wash(g, '#5a9a80');
      ink(g, 2.2);
      eye(g, -120, -2, 8);
      g.restore();
      g.beginPath();
      g.moveTo(0, -264);
      g.lineTo(0, -60);
      ink(g, 5, '#3a6a58');
      g.beginPath();
      g.moveTo(-60, -130);
      g.lineTo(60, -130);
      ink(g, 3, '#3a6a58');
      legs(g, 0, -60, 40, '#3a6a58');
    },
  },
  mousetrapmagpie: {
    name: 'the Mousetrap Magpie', tier: 0, pocket: true, box: { x0: -170, x1: 200, top: -250 }, head: [-110, -200],
    draw(g) {
      legs(g, 10, -100);
      poly(g, [[-90, -150], [110, -150], [110, -110], [-90, -110]], 2, 1);
      wash(g, '#d8b070');
      ink(g, 2.4);
      g.beginPath();
      g.moveTo(-60, -150);
      g.lineTo(-20, -210);
      g.lineTo(60, -210);
      g.lineTo(80, -150);
      ink(g, 3, '#9aa0a8');
      poly(g, [[100, -150], [200, -190], [200, -175], [100, -135]], 3);
      wash(g, '#20242a');
      ink(g, 1.5);
      head(g, -110, -195, 24, '#20242a', '#20242a', 36);
      poly(g, [[40, -160], [70, -175], [75, -150]], 1);
      wash(g, '#f2d24a');
      ink(g, 1.5);
    },
  },
  hatboxhoopoe: {
    name: 'the Hatbox Hoopoe', tier: 0, pocket: true, box: { x0: -170, x1: 110, top: -330 }, head: [-80, -270],
    draw(g) {
      legs(g, 0, -100);
      poly(g, [[-85, -110], [85, -110], [85, -230], [-85, -230]], 2, 1);
      wash(g, '#e8c8c0');
      ink(g, 2.4);
      for (let x = -70; x <= 70; x += 28) {
        g.fillStyle = 'rgba(180,80,90,0.5)';
        g.fillRect(x, -228, 12, 116);
      }
      poly(g, [[-95, -232], [95, -232], [92, -255], [-92, -255]], 3);
      wash(g, '#c06070');
      ink(g, 2);
      for (let i = 0; i < 5; i++) {
        blob(g, -60 + i * 14, -295 + Math.abs(i - 2) * 8, 8, 30, i, 0.1);
        wash(g, i % 2 ? '#e8a040' : '#2a2a2a');
      }
      eye(g, -60, -215, 10);
      g.beginPath();
      g.moveTo(-82, -210);
      g.quadraticCurveTo(-140, -205, -165, -170);
      ink(g, 4, PAL.ochre);
    },
  },
  candlestickkiwi: {
    name: 'the Candlestick Kiwi', tier: 2, pocket: true, box: { x0: -190, x1: 110, top: -380 }, head: [-60, -130],
    draw(g, t) {
      legs(g, 0, -50, 40);
      blob(g, 0, -100, 85, 55, 2, 0.05);
      wash(g, '#8a6a4a');
      ink(g, 2.4);
      eye(g, -55, -115, 10);
      g.beginPath();
      g.moveTo(-80, -100);
      g.quadraticCurveTo(-150, -95, -185, -50);
      ink(g, 4, PAL.ochre);
      g.fillStyle = '#c9a24a';
      g.fillRect(-12, -260, 24, 110);
      ink(g, 2);
      g.fillStyle = '#f6f2e6';
      g.fillRect(-14, -340, 28, 82);
      blob(g, 0, -362 + Math.sin(t * 9) * 2, 9, 18, 3, 0.15);
      wash(g, '#f0a030');
    },
  },
  rollingpinrail: {
    name: 'the Rollingpin Rail', tier: 1, pocket: true, box: { x0: -190, x1: 170, top: -260 }, head: [-140, -215],
    draw(g) {
      legs(g, 0, -140, 50);
      blob(g, 0, -170, 120, 30, 3, 0.02);
      wash(g, '#e0c08a');
      ink(g, 2.4);
      for (const x of [-140, 145]) {
        blob(g, x, -170, 26, 12, x, 0.05);
        wash(g, '#c8a070');
        ink(g, 2);
      }
      head(g, -150, -210, 18, '#c8a070', PAL.ochre, 36);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(-60, -186, 70, 6);
    },
  },
};

// The original ten playable birds use bird.* portraits, not subject.*.
for (const b of BIRDS) {
  if (!SUBJECTS[b.id]) SUBJECTS[b.id] = {
    name: b.name, tier: 0, guideBase: true,
    box: { x0: -205, x1: 205, top: -390 },
    head: b.id === 'coot' ? [0, -370] : [-65, -300],
  };
}
export const SUBJECT_IDS = Object.keys(SUBJECTS);

// Draw one of them, from its painting once delivered.
export function drawSubject(g, id, { x = 0, y = 0, size = 300, t = 0, flip = false, pose = {} } = {}) {
  const sub = SUBJECTS[id];
  if (!sub) return;
  g.save();
  g.translate(x, y);
  const s = size / 400;
  g.scale(flip ? -s : s, s * (1 + Math.sin(t * 2) * 0.012));
  const img = art((sub.pocket ? 'pocket.' : sub.guideBase ? 'bird.' : 'subject.') + id);
  if (img) g.drawImage(img, -FRAME.cx * FRAME.u, -(PAINTED[id]?.feet ?? 0.93) * FRAME.u, FRAME.u, FRAME.u);
  else if (sub.guideBase) drawBird(g, id, { size: 400, t, pose: { ...pose, standin: true } });
  else sub.draw(g, t, pose);
  g.restore();
}

// drawBird() draws these too, so a page or a game can use either.
drawOtherBirds((g, id, opts) => drawSubject(g, id, opts));
