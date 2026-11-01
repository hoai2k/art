// A placeholder act: an empty stage with a card-style notice. Each act file
// starts as one of these until it is built (see src/acts/CONTRACT.md).
export function rehearsal({ id, kicker, title, sub, result = {} }) {
  return {
    id, kicker, title, sub, size: 120, action: 'A: continue',
    create() { return { status: 'play', statusT: 0, events: [], result: null, t: 0 }; },
    step(st, dt, input) {
      st.statusT += dt; st.t += dt;
      if (st.status === 'play' && st.t > 0.6 && input.a) { st.status = 'won'; st.statusT = 0; st.result = { ...result }; }
    },
    hud: () => null,
    draw(k, st, t) {
      const c = k.c;
      k.sky(null);
      c.fillStyle = k.col('#2a1424'); c.globalAlpha = 0.85; c.fillRect(300, 230, 680, 260); c.globalAlpha = 1;
      c.strokeStyle = k.col('#c79ab7'); c.lineWidth = 2; c.strokeRect(310, 240, 660, 240);
      c.textAlign = 'center'; c.fillStyle = k.col('#f3c6dc');
      c.font = '60px Yesteryear, cursive'; c.fillText(title, 640, 330);
      c.font = '700 22px "Josefin Sans", sans-serif'; c.fillText('IN REHEARSAL', 640, 380);
      c.font = '20px "Josefin Sans", sans-serif'; c.fillText('Press A to continue the story', 640, 440);
    },
  };
}
