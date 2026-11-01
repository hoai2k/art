import { walkPose } from '../walking.js';
// Prologue drawing: the delivered sets (betrothal-court, rampart-strip,
// armoury) and the cast's cut-outs, staged as a toy theatre. Draw only from
// state and t.
import { FLOOR, ARM_FLOOR, FAIRIES, AZURINE_X, RAMPART, rampartFloor, ARMS, AURORA, ABDUCT, WIGGLES, T, sceneOf } from './prologue.js';
import { card } from './tableau.js';
import { clamp, easeOut, easeInOut, lerp } from './shared.js';
import { richText } from '../art.js';   // headless-safe: art.js touches no DOM at load
import { REST_GAP } from '../sprite-fit.js';
import { drawPose, drawPerson, personPx, personScale, personRef } from '../pose.js';

const FIG = { w: 132, h: 252 };          // a standing figure (220 x 420 art)
// Where each fairy holds her gift in her 220 x 420 art (measured from the
// delivered fairy-*-empty art): centre x, bottom y, width, art px.
const GIFT_IN_HAND = {
  'fairy-ring': [27, 58, 30], 'fairy-ring-tinted': [28, 50, 30],
  'fairy-crown': [50, 116, 82], 'fairy-crown-tinted': [42, 130, 78],
  'fairy-gold': [34, 105, 58], 'fairy-gold-tinted': [27, 118, 56],
};
const PRINCE = { w: 137, h: 225 };
// A present held up to the audience as he takes it: it rises from where it
// was to the middle of the stage, grows, holds, then settles where it goes.
// Where he would be behind it, it goes up to one side of him instead (CLEAR
// apart, centre to centre), on the side with more room.
const SHOW = { rise: 0.45, hold: 1.25, settle: 1.75, x: 640, y: 330, size: 250, clear: 230, aside: 330 };
// What the curtains leave of the stage, stage px.
const OPEN = { x0: 170, x1: 1100 };
// His arms, once shown, ride above his head as badges until all three are his.
const BADGE = { size: 50, gap: 66, up: 262, r: 31 };
const shown = [];                         // { st, kind: 'gift'|'arm', id, x, by, size, t0, slot }
const giftAt = {};                        // where each held gift was last drawn, stage px
const LABELS = { gold: 'Gold!', flower: 'The flower!', ring: 'The ring!', crown: 'The crown!', helmet: 'The helmet!', shield: 'The shield!', sword: 'The enchanted sword!' };        // the prince (220 x 360 art)
const camX = (st) => (sceneOf(st.phase) === 1 ? clamp(st.p.x - 420, 0, RAMPART.w - 1280) : 0);
const CAPTIONS = {
  court: ['The Betrothal', 'Receive the fairies’ gifts for Princess Azurine'],
  curse: ['The Uninvited', 'The witch curses the betrothal and carries Azurine off'],
  rampart: ['The Abduction', 'Her demons carry Azurine off · run after the chariot'],
  escape: ['The Abduction', 'The chariot is gone into the night'],
  bind: ['The Armoury', 'The witch binds the prince'],
  free: ['The Arming', 'Aurora breaks the spell'],
  armoury: ['The Arming', 'Take up the helmet, shield and enchanted sword she gives you'],
};

// The mobile camera's focus (src/camera.js): the player's middle, stage px.
export const focus = (st) => ({ x: st.p.x - camX(st), y: st.p.y - 115 });

export function draw(k, st, t) {
  const sc = sceneOf(st.phase);
  if (sc === 0) courtScene(k, st, t);
  else if (sc === 1) rampartScene(k, st, t);
  else armouryScene(k, st, t);
  if (st.near) prompt(k, st, st.near);
  const cap = CAPTIONS[st.phase];
  if (cap) card(k, cap[0], cap[1], Math.min(1, clamp((st.phaseT - 0.3) / 0.5, 0, 1), ['court', 'rampart', 'armoury', 'bind'].includes(st.phase) ? clamp((4.5 - st.phaseT) / 0.6, 0, 1) : st.phase === 'curse' ? clamp((ABDUCT.swoon - st.phaseT) / 0.4, 0, 1) : 1));
  // armed, and Aurora gone: now to the ship
  if (st.phase === 'knighted' && st.phaseT >= T.risen) card(k, 'The Arming', 'Now to your ship', Math.min(1, clamp((st.phaseT - T.risen) / 0.5, 0, 1), clamp((T.risen + 4 - st.phaseT) / 0.6, 0, 1)));
  k.flat ? k.flat(() => skipHint(k, st)) : skipHint(k, st);
  if (st.fade > 0) k.wash('#000000', st.fade);
}

export function drawOver(k, st) {
  const ix = st.exitSide > 0 ? 1160 : 120;
  if (st.phase === 'iris') k.iris(ix, 460, 820 * (1 - easeInOut(st.phaseT / T.iris)));
  if (st.status === 'won') k.iris(ix, 460, 0);
}

export function onEvent(k, e, st) {
  const cx = st ? camX(st) : 0;
  if (e.type === 'gift') {
    // a fairy whose art holds the gift vanishes as she gives it (see court)
    const f = FAIRIES.find((q) => q.gift === e.gift);
    if (f && f.gift !== 'flower' && k.img(f.id) && !k.img(f.id + '-empty')) { k.flash(0.25); k.burst(e.x, FLOOR - 130, '#f4ead2', 28, 'smoke'); }
  }
  if (e.type === 'gift' && st) {
    // sparkle from the gift itself, where it was in her hands
    const f = FAIRIES.find((q) => q.gift === e.gift);
    const at = giftAt[e.gift] ?? { x: f ? f.x + f.hand : e.x, by: FLOOR - 120, size: 77 };
    k.burst(at.x, at.by - at.size / 2, '#fff2b0', 22, 'sparkle');
    show(st, 'gift', e.gift, at, e.t ?? st.t, (e.n ?? st.gifts.length) - 1);
  }
  if (e.type === 'betrothed') { k.flash(0.4); k.burst(AZURINE_X - 40, FLOOR - 170, '#f3c6dc', 30, 'sparkle'); }
  if (e.type === 'scene' && e.phase === 'curse') { k.flash(0.6); k.shake(0.4); k.burst(220, FLOOR - 150, '#5f3a6a', 30, 'smoke'); }
  // she takes flight in a puff of smoke; the seizing is a flash of fire
  if (e.type === 'witchSwoop') k.burst(210, FLOOR - 170, '#5f3a6a', 26, 'smoke');
  if (e.type === 'seized') { k.flash(0.45); k.shake(0.35); k.burst(AZURINE_X, FLOOR - 150, '#e9693a', 26, 'streak'); k.burst(AZURINE_X, FLOOR - 150, '#5f3a6a', 20, 'smoke'); }
  if (e.type === 'fireLand') k.burst(e.x - cx, rampartFloor(e.x) - 10, '#e9a46a', 14, 'streak');
  if (e.type === 'scorched') { k.flash(0.2); k.burst(e.x - cx, rampartFloor(e.x) - 60, '#c8321e', 10, 'streak'); }
  // each pull strains the witch's cords: they flare and fray
  if (e.type === 'witchFlees') { k.burst(witchAt().x, witchAt().by - 150, '#5f3a6a', 30, 'smoke'); k.shake(0.15); }
  if (e.type === 'strain') { k.shake(0.06 + 0.03 * e.n); k.burst(e.x + (e.n % 2 ? -26 : 26), ARM_FLOOR - 110 - 12 * e.n, '#5fd0c0', 6 + 3 * e.n, 'streak'); }
  if (e.type === 'unbound') { k.flash(0.5); k.burst(e.x, ARM_FLOOR - 120, '#fff2b0', 34, 'sparkle'); k.burst(e.x, ARM_FLOOR - 110, '#5fd0c0', 18, 'streak'); }
  if (e.type === 'arm' && st) {
    const size = e.arm === 'sword' ? 90 : 84;
    k.burst(e.x, ARM_FLOOR + 2 - size / 2, '#fff2b0', 20, 'sparkle');
    show(st, 'arm', e.arm, { x: e.x, by: ARM_FLOOR + 2, size }, e.t ?? st.t, (e.n ?? st.arms.length) - 1);
  }
  if (e.type === 'armed') {
    const x = st?.p.x ?? e.x;
    k.flash(0.9); k.shake(0.25);
    k.burst(x, ARM_FLOOR - 130, '#ffffff', 40, 'sparkle'); k.burst(x, ARM_FLOOR - 110, '#fff2b0', 50, 'sparkle'); k.burst(x, ARM_FLOOR - 60, '#e9c46a', 24, 'streak');
  }
}

// ---------------------------------------------------------------- the court
function courtScene(k, st, t) {
  const c = k.c;
  if (!k.asset('betrothal-court', 640, 720, 1280, 720)) { c.fillStyle = k.col('#3a2240'); c.fillRect(0, 0, 1280, 720); }
  // the king and queen before their thrones on the dais
  figure(k, 'king-stand', 560, 412, t, 0.82, 1);
  figure(k, 'queen-stand', 722, 412, t + 1, 0.82, -1);
  // the fairies in a line, each holding her gift until she gives it; the
  // gifts are drawn after the prince, so he reaches behind what he takes
  const held = [];
  for (const f of FAIRIES) {
    const given = st.gifts.includes(f.gift);
    if (f.gift === 'flower' || !k.img(f.id)) {
      // Aurora (her flower is drawn in her hand), or a fairy not yet delivered
      figure(k, f.id, f.x, FLOOR + 6, t + f.x, 1, f.id === 'aurora-stand' ? -1 : 1);
      if (!given) held.push(() => {
        const s = 0.8 + 0.1 * Math.sin(t * 3 + f.x);
        giftAt[f.gift] = { x: f.x + f.hand, by: FLOOR - 120, size: 96 * s };
        gift(k, f.gift, f.x + f.hand, FLOOR - 120, s);
      });
    } else if (k.img(f.id + '-empty')) {
      // empty-handed art (F15): the game puts her gift in her hands until she
      // gives it, in the same sway as her figure
      figure(k, f.id + '-empty', f.x, FLOOR + 6, t + f.x, 1, 1);
      if (!given) held.push(() => figure(k, f.id + '-empty', f.x, FLOOR + 6, t + f.x, 1, 1, (c, s, im) => {
        const [hx, hb, hw] = GIFT_IN_HAND[f.id + (/-tinted\./.test(im.src) ? '-tinted' : '')];
        const gx = (hx - (im.naturalWidth || im.width) / 2) * s, gb = (hb - (im.naturalHeight || im.height)) * s;
        const m = c.getTransform?.();
        if (m) giftAt[f.gift] = { x: m.a * gx + m.c * gb + m.e, by: m.b * gx + m.d * gb + m.f, size: hw * s * Math.abs(m.a) };
        gift(k, f.gift, gx, gb, (hw * s) / 96);
      }, true));
    } else if (!given) figure(k, f.id, f.x, FLOOR + 6, t + f.x, 1, 1);
    // Until then her art holds the gift itself, so once she has given it she
    // vanishes in a burst of sparkle, a stop trick, rather than keep it.
  }
  if (st.phase !== 'curse' || st.phaseT < ABDUCT.swoon) figure(k, 'azurine-stand', AZURINE_X, FLOOR + 4, t + 3, 1, 1);
  // the gifts laid at her feet; the witch's curse withers the flower
  const wither = st.phase === 'curse' ? clamp((st.phaseT - 1.6) / 1.2, 0, 1) : 0;
  st.gifts.forEach((g, i) => {
    if (showing(st, g)) return;
    c.save(); if (g === 'flower' && wither) { c.globalAlpha = 1 - 0.6 * wither; }
    gift(k, g, AZURINE_X - 120 + i * 42, FLOOR + 4, 0.55);
    c.restore();
  });
  if (st.phase === 'curse') curse(k, st, t);
  prince(k, st, t);
  if (st.phase === 'curse') abduction(k, st, t);
  for (const draw of held) draw();
  drawShown(k, st, t);
}

function curse(k, st, t) {
  const c = k.c, a = clamp(st.phaseT / 0.6, 0, 1) * clamp((ABDUCT.swoop + 0.15 - st.phaseT) / 0.3, 0, 1);
  k.wash('#2a1030', 0.35 * clamp(st.phaseT / 0.6, 0, 1));
  c.save(); c.globalAlpha = a;
  if (a > 0) figure(k, 'witch-hooded', 210, FLOOR + 6, t, 1, -1);
  c.restore();
  // her curse, a ribbon of violet smoke to the princess
  if (st.phaseT > 0.8 && st.phaseT < ABDUCT.swoop) {
    c.save(); c.globalAlpha = 0.5 + 0.2 * Math.sin(t * 12); c.strokeStyle = k.col('#b06ad0'); c.lineWidth = 6;
    c.beginPath(); c.moveTo(250, FLOOR - 170);
    for (let i = 1; i <= 20; i++) { const f = i / 20; c.lineTo(250 + (AZURINE_X - 290) * f, FLOOR - 170 - Math.sin(f * Math.PI) * 120 + Math.sin(t * 9 + f * 12) * 10); }
    c.stroke(); c.restore();
  }
}

// The abduction: under the curse Azurine swoons; the witch takes flight
// across the hall and her two demons run on from the right with their
// torches; they seize her, flash of fire, and bear her up and away over the
// right of the stage, the witch leading, toward the rampart.
const DEMON_S = 0.78;
// Their raised hands in the carrying poses (F23): the top of the 260 x 360
// art, this far from its centre (art px); she rests on them, at her shoulders
// and her knees (GRIP: stage px from her centre, her head to the left).
const DEMON_HANDS = { 'demon-red-carry': 31, 'demon-teal-carry': -37 }, GRIP = [-70, 52];
function abduction(k, st, t) {
  const c = k.c, tt = st.phaseT, A = ABDUCT;
  if (tt < A.swoon) return;
  // the princess swoons (held a moment when her swoon is drawn), then lies
  // senseless on the floor
  const swoonArt = !!k.img('azurine-swoon');
  const sw = clamp((tt - A.swoon - (swoonArt ? 0.75 : 0)) / (swoonArt ? 0.3 : 0.45), 0, 1);
  // everyone in the seizing flies off together up to the right
  const u = easeInOut(clamp((tt - A.off) / (A.gone - A.off), 0, 1));
  // (clear of the right curtain: they draw her in toward the middle as they
  // lift her, and rise out of the top of the stage)
  const lift = clamp((tt - A.seize) / 0.5, 0, 1);
  const ox = -140 * easeOut(lift) - 160 * easeOut(clamp(u * 1.6, 0, 1)), oy = -u * 760;
  const az = { x: AZURINE_X + ox, y: FLOOR - easeOut(lift) * 120 + oy };
  if (sw < 1) {
    // her swoon (F23), or her standing figure tipping back
    c.save(); c.translate(AZURINE_X, FLOOR + 4);
    if (swoonArt) c.rotate(easeInOut(sw) * 0.5), c.globalAlpha = 1 - sw;
    else c.rotate(easeInOut(sw) * 0.9), c.globalAlpha = 1 - sw * 0.6;
    figure(k, swoonArt ? 'azurine-swoon' : 'azurine-stand', 0, 0, t + 3, 1, 1);
    c.restore();
  }
  if (sw > (swoonArt ? 0 : 0.6)) {
    c.save(); c.globalAlpha = swoonArt ? clamp(sw / 0.6, 0, 1) : clamp((sw - 0.6) / 0.4, 0, 1); c.translate(az.x, az.y + 4); c.rotate(k.img('demon-red-carry') ? Math.sin(t * 3) * 0.015 * lift : -u * 0.25 + Math.sin(t * 3) * 0.03 * lift);
    // her hips on the floor, draped over it (REST_GAP)
    const lieH = personH(k, 'azurine-stand'), drop = restGap(k, 'azurine-asleep') * personScale(k, 'azurine-asleep', lieH) * (1 - lift);
    if (!drawPerson(k, 'azurine-asleep', 0, drop, lieH)) { c.fillStyle = k.col('#c9d8ee'); c.fillRect(-100, -30, 200, 30); }
    c.restore();
  }
  // her demons: on at a run from behind the right curtain, then holding her
  // up between them as they rise
  const run = easeOut(clamp((tt - A.swoop) / (A.seize - A.swoop), 0, 1));
  const demons = [['demon-red', 1330, AZURINE_X - 105], ['demon-teal', 1420, AZURINE_X + 100]];
  demons.forEach(([id, x0, x1], i) => {
    let x = lerp(x0, x1, run) + ox, by = FLOOR + 8 - lift * 70 + oy;
    if (tt < A.swoop) return;
    // flying with her held up on their hands (F23), or running figures
    // tilted under her
    const carry = lift > 0.3 && k.img(id + '-carry');
    if (carry) {
      // the hands' height above the feet: the art's full height at the drawn scale
      const sc = personScale(k, id + '-carry', personH(k, id, DEMON_S));
      x = az.x + GRIP[i] - DEMON_HANDS[id + '-carry'] * sc;
      by = az.y - 40 + 360 * sc + Math.sin(t * 6 + i) * 2;
    }
    c.save(); c.translate(x, by); c.rotate(carry ? 0 : lift * (i ? 0.18 : -0.18) - u * 0.2);
    // (both carrying poses are painted facing her side: red right, teal left)
    figure(k, carry ? id + '-carry' : id, 0, carry ? 0 : Math.abs(Math.sin(t * 9 + i)) * -6 * (1 - lift), t + i, DEMON_S, i && !carry ? -1 : 1);
    c.restore();
  });
  // the witch, flying across the hall to hover over the princess, then off
  // ahead of them
  if (tt >= A.swoop) {
    const f = easeInOut(clamp((tt - A.swoop) / (A.seize - A.swoop), 0, 1));
    const x = lerp(210, AZURINE_X - 20, f) + ox * 1.15, y = FLOOR - 200 - Math.sin(f * Math.PI) * 120 - lift * 110 + oy * 1.1;
    c.save(); c.translate(x, y + Math.sin(t * 4) * 6); c.scale(-1, 1); c.rotate(-0.1 - u * 0.15);
    if (!drawPerson(k, 'witch-swoop', 0, 0, personH(k, 'witch-hooded'))) { c.fillStyle = k.col('#2f5a50'); c.fillRect(-90, -50, 180, 50); }
    c.restore();
    // a trail of violet smoke behind her
    c.save();
    for (let i = 0; i < 8; i++) { c.globalAlpha = 0.25 * (1 - i / 8); c.fillStyle = k.col('#5f3a6a'); k.circle(x - 120 - i * 22, y - 60 + Math.sin(t * 5 + i) * 8, 16 - i); }
    c.restore();
  }
}

// ---------------------------------------------------------------- the rampart
function rampartScene(k, st, t) {
  const c = k.c, cx = camX(st), ch = st.chariot;
  if (!k.asset('rampart-strip', RAMPART.w / 2 - cx, 720, RAMPART.w, 720)) {
    c.fillStyle = k.col('#1c1630'); c.fillRect(0, 0, 1280, 720);
    c.fillStyle = k.col('#8a7a6a'); c.fillRect(0, RAMPART.y, 1280, 120);
  }
  // fire falling from the chariot, then burning on the parapet
  for (const f of st.fires) {
    const x = f.x - cx;
    if (!f.lit) { c.fillStyle = k.col('#ffcf7a'); k.circle(x, f.y, 9); c.fillStyle = k.col('#e9693a'); k.circle(x, f.y - 8, 6); continue; }
    flame(k, x, rampartFloor(f.x) + 4, 0.75, t + f.x);   // it burns on
  }
  // the chariot of fire, with her demons and Azurine asleep
  const up = st.phase === 'escape' ? easeOut(Math.min(1, ch.up / T.escape)) : 0;
  chariot(k, ch.x - cx + up * 300, ch.y - up * 420, t);
  prince(k, st, t, cx);
}

function chariot(k, x, y, t) {
  const c = k.c;
  c.save(); c.translate(x, y);
  c.rotate(Math.sin(t * 1.3) * 0.04);
  figure(k, 'demon-teal', -60, 10, t, 0.55, 1);
  // she lies at the size of her demons' figures (0.55 of a standing figure)
  if (!drawPerson(k, 'azurine-asleep', 10, 0, personH(k, 'azurine-stand', 0.55))) { c.fillStyle = k.col('#c9d8ee'); c.fillRect(-40, -24, 100, 24); }
  if (!k.asset('chariot', 0, 80, 300, 160)) {
    c.fillStyle = k.col('#7a2a1a'); c.beginPath(); c.ellipse(0, 40, 140, 40, 0, 0, Math.PI * 2); c.fill();
    flame(k, -100, 40, 0.8, t);
  }
  figure(k, 'demon-red', 80, 10, t + 1, 0.55, 1);
  c.restore();
}

// ---------------------------------------------------------------- the armoury
function armouryScene(k, st, t) {
  const c = k.c;
  if (!k.asset('armoury', 640, 720, 1280, 720)) { c.fillStyle = k.col('#30283a'); c.fillRect(0, 0, 1280, 720); }
  const ph = st.phase;
  witchOnCloud(k, st, t);
  aurora(k, st, t);
  // the arms on the flagstones, in his way as he follows her
  for (const a of ARMS) {
    if (st.arms.includes(a.id)) continue;
    c.save(); c.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3 + a.x); c.fillStyle = k.col('#fff2b0'); k.circle(a.x, ARM_FLOOR - 40, 46); c.restore();
    arm(k, a.id, a.x, ARM_FLOOR + 2, t);
  }
  if (ph === 'knighted') transformation(k, st, t, false);
  prince(k, st, t);
  if (ph === 'knighted') transformation(k, st, t, true);
  badges(k, st, t);
  drawShown(k, st, t);
  // the witch's cords about him until Aurora breaks them
  if (ph === 'bind') cords(k, st, t, clamp((st.phaseT - 0.4) / 0.4, 0, 1));
  if (ph === 'free' && st.phaseT < T.cast) cords(k, st, t, 1);
}

// The witch on her cloud: she rises beside him and binds him, hovers there
// laughing at him as he struggles, and when Aurora comes on she flees, up and
// away to the right in a puff of smoke, before Aurora breaks her spell.
// (read when drawn: prologue.js and this module import each other)
const witchAt = () => ({ x: 820, by: ARM_FLOOR - 30 });
function witchOnCloud(k, st, t) {
  const c = k.c, ph = st.phase;
  if (ph !== 'bind' && !(ph === 'free' && st.phaseT < T.fled)) return;
  const at = witchAt();
  let x = at.x, by = at.by + Math.sin(t * 1.8) * 8, a = 1, rot = 0;
  if (ph === 'bind') {
    const rise = easeOut(clamp(st.phaseT / 0.7, 0, 1));
    a = rise; by += (1 - rise) * 60;
    // she shakes with laughter after each cackle
    const since = st.phaseT - (st.laughAt ?? -9);
    if (since >= 0 && since < 1.1) by += Math.sin(since * 40) * 4 * (1 - since / 1.1), rot = Math.sin(since * 22) * 0.03;
  } else {
    // up and away to the right, fading into her smoke
    const u = easeInOut(clamp((st.phaseT - T.flee) / (T.fled - T.flee), 0, 1));
    x += u * 420; by -= u * 420; a = 1 - u * u; rot = -0.2 * u;
  }
  if (a <= 0) return;
  c.save(); c.globalAlpha = a; c.translate(x, by); c.rotate(rot);
  // she faces him: her cloud art faces right, toward where he is bound
  figure(k, 'witch-cloud', 0, 0, t, 1, 1);
  c.restore();
}

// Aurora: off at first; she glides on from the stairs at the left and casts
// across the room at him, stays while he takes up the arms she gives him and
// casts again as they make him the armoured prince, then turns and glides off
// the way he must go while he kneels. A fairy, she floats a little above the
// flagstones, trailing sparkle.
function aurora(k, st, t) {
  const c = k.c, ph = st.phase;
  let x = AURORA.at, face = -1, id = 'aurora-stand', u = 0, gliding = false;
  if (ph === 'free') {
    u = clamp(st.phaseT / T.on, 0, 1);
    x = AURORA.from + (AURORA.at - AURORA.from) * easeOut(u);
    gliding = u < 1;
    if (st.phaseT >= T.on - 0.15) id = 'aurora-point';
  } else if (ph === 'knighted') {
    if (st.phaseT >= T.leave + T.off) return;
    if (st.phaseT >= T.badge && st.phaseT < T.armed + 0.2) id = 'aurora-point';
    if (st.phaseT >= T.leave) {
      u = clamp((st.phaseT - T.leave) / T.off, 0, 1);
      x = AURORA.at + (AURORA.to - AURORA.at) * easeInOut(u); face = 1; gliding = true;
    }
  } else if (ph !== 'armoury') return;
  if (gliding && k.img('aurora-glide-a')) id = 'aurora-glide-' + (Math.floor(t * 5) % 2 ? 'b' : 'a');
  const lift = 14 + Math.sin(t * 2.4) * 5;
  if (gliding) {
    c.save();
    for (let i = 0; i < 9; i++) {
      const tx = x - (face === -1 ? 1 : -1) * (20 + i * 16), ty = ARM_FLOOR - 60 - lift - Math.sin(t * 9 + i) * 18 - i * 3;
      c.globalAlpha = 0.7 * (1 - i / 9); c.fillStyle = k.col(i % 2 ? '#fff2b0' : '#bfe8ff'); k.circle(tx, ty, 4 - i * 0.3);
    }
    c.restore();
  }
  // her spell: a ribbon of sparkle from her hand across the room to him
  if (ph === 'free' && st.phaseT > T.on && st.phaseT < T.cast + 0.15) {
    const hx = x + 52, hy = ARM_FLOOR - 170 - lift, px = st.p.x, py = st.p.y - 120;
    const g = clamp((st.phaseT - T.on) / (T.cast - T.on), 0, 1);
    const at = (f) => [hx + (px - hx) * f, hy + (py - hy) * f - Math.sin(f * Math.PI) * 50 + Math.sin(t * 14 + f * 18) * 7];
    c.save();
    c.lineCap = 'round';
    for (const [w, col, al] of [[16, 'rgba(255,242,176,1)', 0.25], [5, 'rgba(255,255,255,1)', 0.7]]) {
      c.globalAlpha = al; c.strokeStyle = col; c.lineWidth = w; c.beginPath();
      for (let i = 0; i <= 28 * g; i++) { const [wx, wy] = at(i / 28); i ? c.lineTo(wx, wy) : c.moveTo(wx, wy); }
      c.stroke();
    }
    for (let i = 0; i <= 28 * g; i++) {
      const [wx, wy] = at(i / 28);
      c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 20 + i); c.fillStyle = k.col(i % 3 ? '#fff2b0' : '#ffffff'); k.circle(wx, wy + Math.sin(t * 11 + i) * 6, 4.5);
    }
    c.restore();
  }
  figure(k, id, x, ARM_FLOOR + 4 - lift, t, 1, face);
}

// His arms as badges above his head, each where its show settled; drawn
// into him as he is transformed.
function badges(k, st, t) {
  if (st.armed || sceneOf(st.phase) !== 2) return;
  const c = k.c;
  st.arms.forEach((id, i) => {
    if (showing(st, id)) return;
    let { x, by } = badgeAt(st, i, t), size = BADGE.size, a = 1;
    if (st.phase === 'knighted') {
      // spiralling in to his heart
      const u = clamp((st.phaseT - T.badge) / 1.1, 0, 1), e = easeInOut(u);
      const cx = st.p.x, cy = st.p.y - 120, ang = e * Math.PI * 2.5 + i * 2.1, r = (1 - e) * 60;
      x = x + (cx - x) * e + Math.cos(ang) * r; by = by + (cy + size / 2 - by) * e + Math.sin(ang) * r * 0.5;
      size *= 1 - 0.6 * e; a = 1 - clamp((u - 0.85) / 0.15, 0, 1);
    }
    if (a <= 0) return;
    c.save(); c.globalAlpha = a;
    // a medallion: a gilt rim about a dark ground, so it reads on the busy set
    const r = BADGE.r * size / BADGE.size, cy = by - size / 2;
    const g = c.createRadialGradient(x, cy, r * 0.8, x, cy, r * 1.7);
    g.addColorStop(0, 'rgba(255,242,176,0.55)'); g.addColorStop(1, 'rgba(255,242,176,0)');
    c.fillStyle = g; c.fillRect(x - r * 1.7, cy - r * 1.7, r * 3.4, r * 3.4);
    c.fillStyle = k.col('#2a1424'); k.circle(x, cy, r);
    c.lineWidth = 3; c.strokeStyle = k.col('#e9c46a'); c.beginPath(); c.arc(x, cy, r, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.rect(x - r, cy - r, r * 2, r * 2); c.save(); c.beginPath(); c.arc(x, cy, r - 2, 0, Math.PI * 2); c.clip();
    armShown(k, id, x, by - size * 0.06, size * 0.9, t);
    c.restore();
    c.restore();
  });
}
function badgeAt(st, i, t) {
  return { x: st.p.x + (i - 1) * BADGE.gap, by: st.p.y - BADGE.up - (i === 1 ? 10 : 0) + Math.sin(t * 3 + i * 1.7) * 3 };
}

// The transformation: the room dims, a column of light rises about him with a
// ring of sparkle closing in, and at its height (T.armed) a flash leaves him
// armoured, kneeling, before he stands. `front`: the parts drawn over him.
function transformation(k, st, t, front) {
  const c = k.c, p = st.p, tt = st.phaseT - T.badge, end = T.armed + 0.9 - T.badge;
  if (tt < 0 || tt > end) return;
  const peak = T.armed - T.badge;
  const up = clamp((tt - 0.5) / (peak - 0.5), 0, 1), down = clamp((tt - peak) / (end - peak), 0, 1);
  const glow = tt < peak ? easeInOut(up) : 1 - easeOut(down);
  if (glow <= 0) return;
  c.save();
  if (!front) {
    c.globalAlpha = 0.45 * glow; c.fillStyle = '#05030a'; c.fillRect(0, 0, 1280, 720);
    // the column of light
    const w = 70 + 90 * glow, g = c.createLinearGradient(p.x - w, 0, p.x + w, 0);
    g.addColorStop(0, 'rgba(255,242,176,0)'); g.addColorStop(0.5, 'rgba(255,248,220,0.85)'); g.addColorStop(1, 'rgba(255,242,176,0)');
    c.globalAlpha = glow; c.fillStyle = g; c.fillRect(p.x - w, 0, w * 2, p.y + 10);
    const h = c.createRadialGradient(p.x, p.y - 120, 10, p.x, p.y - 120, 220);
    h.addColorStop(0, 'rgba(255,255,255,0.9)'); h.addColorStop(1, 'rgba(255,242,176,0)');
    c.globalAlpha = glow * 0.8; c.fillStyle = h; c.fillRect(p.x - 220, p.y - 340, 440, 440);
    // a ring of light on the flagstones about his feet
    c.globalAlpha = glow; c.strokeStyle = 'rgba(255,242,176,0.9)'; c.lineWidth = 4;
    for (let i = 0; i < 2; i++) { c.beginPath(); c.ellipse(p.x, p.y, (90 + 30 * i) * (0.6 + 0.4 * glow), (18 + 6 * i) * (0.6 + 0.4 * glow), 0, 0, Math.PI * 2); c.stroke(); }
  } else {
    // a ring of sparkle closing about him, and motes rising
    for (let i = 0; i < 26; i++) {
      const ang = i / 26 * Math.PI * 2 + t * 4, r = 150 - 80 * up + 40 * down;
      const y = p.y - 30 - ((t * 140 + i * 37) % 260);
      c.globalAlpha = glow * (0.6 + 0.4 * Math.sin(t * 13 + i));
      c.fillStyle = k.col(i % 3 ? '#fff2b0' : '#ffffff');
      k.circle(p.x + Math.cos(ang) * r, y, 3 + 2 * glow);
      k.circle(p.x + Math.cos(ang + 1) * r * 0.55, p.y - 120 + Math.sin(ang) * r * 0.35, 2.5);
    }
    // the white of the moment itself
    const f = clamp(1 - Math.abs(tt - peak) / 0.25, 0, 1);
    if (f > 0) { c.globalAlpha = f * 0.85; c.fillStyle = '#fffaf0'; c.fillRect(0, 0, 1280, 720); }
  }
  c.restore();
}

// The witch's spell about him: drawn cords where the bound art is missing,
// and over either a teal shimmer that flares as he strains against it.
function cords(k, st, t, a) {
  if (a <= 0) return;
  const c = k.c, p = st.p, s = st.struggle, tilt = s.tilt;
  const strain = s.n / WIGGLES, flare = Math.abs(tilt) / 0.16;
  c.save(); c.translate(p.x, p.y); c.rotate(tilt * (k.img('prince-struggle-a') ? 0.35 : 1)); c.globalAlpha = a; c.strokeStyle = k.col('#5fd0c0');
  for (let i = 0; i < 4; i++) {
    const y = -70 - i * 30 + Math.sin(t * 6 + i) * 3;
    const real = !k.img('prince-bound');
    // the struggle frames paint their own straining cords: only sparks there
    if (!k.img('prince-struggle-a')) {
      c.lineWidth = real ? 4 : 2 + 2 * flare;
      c.globalAlpha = a * (real ? 1 : 0.25 + 0.5 * flare + 0.2 * Math.sin(t * 9 + i));
      c.beginPath(); c.ellipse(0, y, 40 + 6 * flare, 10, 0.1 * Math.sin(t * 3 + i), 0, Math.PI * 2); c.stroke();
    }
    // the cords fray as he strains: little gaps that open with each pull
    if (strain > 0 && flare > 0.3) {
      c.globalAlpha = a * flare; c.fillStyle = k.col('#e8fff9');
      k.circle(Math.cos(t * 5 + i * 2) * 40, y + Math.sin(t * 5 + i * 2) * 10, 2 + 3 * strain);
    }
  }
  c.restore();
}

// ---------------------------------------------------------------- the cast
// A standing cut-out with the film idle, feet at (x, by); `face` -1 mirrors.
// `over` draws what she holds (see kit.idle); `onlyOver` draws just that.
// A character drawn through the person-size data (design/person-sizes.md) is
// sized by its reference sprite in the standing figure's box, so every sprite
// of the character comes out at that one person size.
function figure(k, id, x, by, t, s = 1, face = 1, over = null, onlyOver = false) {
  const c = k.c, ref = personRef(id);
  if (ref && k.img(id) && k.img(ref)) { drawPerson(k, id, x, by, personH(k, ref, s), { face, t, over, onlyOver }); return; }
  c.save(); c.translate(x, by); c.scale(face, 1);
  if (!k.idle(id, t, 0, 0, FIG.w * s, FIG.h * s, undefined, over, onlyOver) && !onlyOver) { c.fillStyle = k.col('#b88aa8'); c.fillRect(-18 * s, -FIG.h * s * 0.8, 36 * s, FIG.h * s * 0.8); }
  c.restore();
}

// The art rows below a lying figure's body, in the look drawn (sprite audit).
const restGap = (k, id) => { const im = k.img(id); return (im && REST_GAP[id + (/-tinted\./.test(im.src || '') ? '-tinted' : '')]) || 0; };

// A character's person height (stage px) in this staging: their reference
// sprite fitted to the standing figure's box at scale `s`.
function personH(k, ref, s = 1) {
  const im = k.img(ref);
  if (!im) return FIG.h * s;
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
  return personPx(k, ref) * Math.min((FIG.h * s) / ih, (1.6 * FIG.w * s) / iw);
}

// The prince: in court dress until he takes up his arms, then in armour.
function prince(k, st, t, cx = 0) {
  const c = k.c, p = st.p, armed = st.armed && sceneOf(st.phase) === 2;
  const moving = Math.abs(p.vx) > 20, step = walkPose(p.walk, 34);
  if ((p.knockT > 0 || st.grace > 0) && Math.floor(t * 16) % 2) c.globalAlpha = 0.5;
  // his poses (F20): in court dress he leaps the fires, is knocked back by
  // them, and reaches out as he takes a gift; armed, he kneels to be knighted
  const justTook = shown.some((o) => o.st === st && o.kind === 'gift' && st.t - o.t0 >= 0 && st.t - o.t0 < 0.55);
  const pose = armed ? (st.phase === 'knighted' && st.phaseT < T.risen && !moving ? 'prince-kneel' : null)
    : st.defeatT != null || p.knockT > 0 ? 'prince-court-fall' : !p.on ? 'prince-court-leap' : justTook && !moving ? 'prince-court-reach' : null;
  if (pose && st.phase !== 'bind' && drawPose(k, pose, p.x - cx, p.y, PRINCE.h, { face: p.face })) { c.globalAlpha = 1; return; }
  c.save(); c.translate(p.x - cx, p.y);
  // bound, he wrenches this way and that against the cords
  if (st.phase === 'bind') c.translate(Math.sin(t * 40) * 3 * Math.abs(st.struggle.tilt) / 0.16, 0), c.rotate(st.struggle.tilt * (k.img('prince-struggle-a') ? 0.35 : 1));
  c.scale(p.face, 1);
  let id;
  if ((st.phase === 'bind' || (st.phase === 'free' && st.phaseT < T.cast)) && k.img('prince-bound')) {
    // straining one way or the other (F22), when the struggle frames are in
    const lean = st.phase === 'bind' ? st.struggle.tilt * p.face : 0;
    id = Math.abs(lean) > 0.06 && k.img('prince-struggle-a') ? (lean < 0 ? 'prince-struggle-a' : 'prince-struggle-b') : 'prince-bound';
  }
  else if (armed) id = !p.on ? 'prince-leap' : moving ? 'prince-' + step : 'prince-stand';
  else id = moving && k.img('prince-court-walk-a') ? 'prince-court-' + step : 'prince-court';
  // without walk frames, the court-dress still rocks as a puppet on its slide
  const bob = moving && id === 'prince-court' ? Math.abs(Math.sin(p.walk / 22)) * 6 : 0;
  const tip = moving && id === 'prince-court' ? Math.sin(p.walk / 22) * 0.05 : !p.on ? -0.12 : 0;
  c.rotate(tip);
  if (!k.asset(id, 0, -bob, PRINCE.w, PRINCE.h)) { c.fillStyle = k.col('#6a2a5a'); c.fillRect(-20, -200, 40, 200); }
  c.restore();
  c.globalAlpha = 1;
}

function show(st, kind, id, at, t0, slot) {
  for (let i = shown.length - 1; i >= 0; i--) if (shown[i].st !== st || shown[i].id === id) shown.splice(i, 1);
  shown.push({ st, kind, id, x: at.x, by: at.by, size: at.size, t0, slot });
}
const showing = (st, id) => shown.some((s) => s.st === st && s.id === id && st.t - s.t0 >= 0 && st.t - s.t0 < SHOW.settle);

// Where a present is held up: the middle, unless he stands where it would
// cover him; then to one side of him, the side with more room.
export function showX(px) {
  if (Math.abs(px - SHOW.x) >= SHOW.clear) return SHOW.x;
  const half = SHOW.size / 2 + 20;
  return clamp(px >= SHOW.x ? px - SHOW.aside : px + SHOW.aside, OPEN.x0 + half, OPEN.x1 - half);
}

// Each present being shown: up, big, with its name beneath, then down to
// Azurine's feet (a gift) or to its badge above the prince (his arms).
function drawShown(k, st, t) {
  const c = k.c;
  for (const s of shown) {
    const age = st.t - s.t0;
    if (s.st !== st || age < 0 || age >= SHOW.settle) continue;
    const end = s.kind === 'gift'
      ? { x: AZURINE_X - 120 + s.slot * 42, by: FLOOR + 4, size: 96 * 0.55 }
      : { ...badgeAt(st, s.slot, t), size: BADGE.size };
    // up to the middle, or beside him where he would be behind it; chosen
    // where he stands as it is taken, and kept there if he walks under it
    if (s.cx == null) s.cx = showX(st.p.x);
    const mid = { x: s.cx, by: SHOW.y + SHOW.size / 2, size: SHOW.size };
    let a = 1, from = s, to = mid, u;
    if (age < SHOW.rise) u = easeOut(age / SHOW.rise);
    else if (age < SHOW.hold) u = 1;
    else { from = mid; to = end; u = easeInOut((age - SHOW.hold) / (SHOW.settle - SHOW.hold)); }
    const x = from.x + (to.x - from.x) * u, by = from.by + (to.by - from.by) * u, size = from.size + (to.size - from.size) * u;
    const big = age < SHOW.hold ? u : 1 - u;   // how far up and grown it is
    c.save();
    // a soft glow behind it, and a dimming of the stage while it is held up
    if (big > 0) {
      c.globalAlpha = 0.3 * big; c.fillStyle = '#000'; c.fillRect(0, 0, 1280, 720);
      const g = c.createRadialGradient(x, by - size / 2, size * 0.1, x, by - size / 2, size * 0.75);
      g.addColorStop(0, 'rgba(255,242,176,0.75)'); g.addColorStop(1, 'rgba(255,242,176,0)');
      c.globalAlpha = big * (0.85 + 0.15 * Math.sin(t * 6)); c.fillStyle = g; c.fillRect(x - size, by - size * 1.5, size * 2, size * 2);
    }
    c.globalAlpha = a;
    if (s.kind === 'gift') gift(k, s.id, x, by, size / 96);
    else armShown(k, s.id, x, by, size, t);
    if (big > 0.6 && LABELS[s.id]) {
      c.globalAlpha = clamp((big - 0.6) / 0.4, 0, 1);
      c.textAlign = 'center'; c.font = '700 34px "Josefin Sans", sans-serif';
      c.lineWidth = 6; c.strokeStyle = 'rgba(30,14,30,0.85)'; c.strokeText(LABELS[s.id], x, by + 44);
      c.fillStyle = k.col('#fff2b0'); c.fillText(LABELS[s.id], x, by + 44);
    }
    c.restore();
  }
}

// An arm drawn at any size (arm() draws them at their size on the floor).
function armShown(k, id, x, by, size, t) {
  const c = k.c, s = size / (id === 'sword' ? 90 : 84);
  c.save(); c.translate(x, by); c.scale(s, s); arm(k, id, 0, 0, t); c.restore();
}

function gift(k, g, x, by, s) {
  const c = k.c;
  if (k.asset('gift-' + g, x, by, 96 * s, 96 * s)) return;
  c.fillStyle = k.col('#d9b34a'); k.circle(x, by - 30 * s, 20 * s);
}

function arm(k, id, x, by, t) {
  const c = k.c;
  if (id === 'sword') { c.save(); c.translate(x, by); c.rotate(-0.15); k.asset('keepsake-sword', 0, 0, 90, 90) || (c.fillStyle = k.col('#d8dde6'), c.fillRect(-4, -90, 8, 90)); c.restore(); return; }
  if (k.asset('armour-' + id, x, by, 84, 84)) return;
  if (id === 'helmet') { c.fillStyle = k.col('#c8ccd4'); c.beginPath(); c.arc(x, by - 26, 26, Math.PI, 0); c.fill(); c.fillRect(x - 26, by - 26, 52, 20); c.fillStyle = k.col('#e0127a'); c.beginPath(); c.ellipse(x - 8, by - 62, 10, 22, -0.5, 0, Math.PI * 2); c.fill(); }
  else { c.fillStyle = k.col('#6f9fc8'); k.circle(x, by - 40, 36); c.fillStyle = k.col('#d9b34a'); k.circle(x, by - 40, 12); }
}

function flame(k, x, by, s, t) {
  const c = k.c;
  if (s <= 0) return;
  for (const [col, w, h] of [['#c8321e', 30, 70], ['#e9693a', 22, 52], ['#ffcf7a', 12, 32]]) {
    c.fillStyle = k.col(col); c.beginPath();
    c.moveTo(x - w * s, by); c.quadraticCurveTo(x - w * s * 0.6, by - h * s * 0.6, x + Math.sin(t * 9) * 4 * s, by - h * s * (0.9 + 0.1 * Math.sin(t * 13)));
    c.quadraticCurveTo(x + w * s * 0.6, by - h * s * 0.6, x + w * s, by); c.fill();
  }
}

// "[A] Receive the ring" over what he stands beside.
function prompt(k, st, near) {
  const c = k.c, x = near.at - camX(st), y = FLOOR - 290;
  c.save(); c.font = '700 15px "Josefin Sans", sans-serif'; c.textAlign = 'center';
  const w = c.measureText(near.label).width + 60;
  c.globalAlpha = 0.88; c.fillStyle = k.col('#2a1424'); c.beginPath(); c.roundRect(x - w / 2, y - 20, w, 30, 15); c.fill();
  c.globalAlpha = 1; c.fillStyle = k.col('#f3c6dc');
  // on touch the button itself is named for it, so the label alone
  richText(c, (k.inputMode === 'touch' ? '' : '[A] ') + near.label.toUpperCase(), x, y + 1, { px: 15, mode: k.inputMode || 'key', col: k.col });
  c.restore();
}

function skipHint(k, st) {
  const c = k.c;
  if (k.inputMode === 'touch') return;   // the Skip button says it
  c.save(); c.globalAlpha = 0.7; c.textAlign = 'right'; c.fillStyle = k.col('#f3c6dc');
  c.font = '700 13px "Josefin Sans", sans-serif';
  richText(c, '[B] SKIP SCENE', 1150, 92, { px: 13, mode: k.inputMode || 'key', col: k.col });
  c.restore();
}
