// Walking scenes free Up/W for jumping. Vertical navigation keeps Space
// for its existing leap/kick, so changing rows never also jumps.
export function keyboardControls(act, state, film) {
  const key = act?.key, ph = state?.phase;
  const primaryX = key === 'prologue' || (key === 'court' && film && !!state?.tf)
    || (key === 'burning' && ['barrel', 'apotheosis', 'finale'].includes(ph));
  const upJump = primaryX || key === 'whale'
    || (key === 'tower' && ph === 'dive')
    || (act?.id === 5 && ph === 'quay')
    || (key === 'burning' && ph === 'quay');
  return { primaryX, upJump };
}
