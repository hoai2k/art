// The Saltshaker Shrike's field-guide entry; its game is ../games/saltshakershrike.js.
export default {
  id: 'saltshakershrike',
  name: 'The Saltshaker Shrike',
  object: 'a salt shaker',
  rhyme: ['Upside down above the plates,', 'The Shrike hangs on and calmly waits.', 'A pinch, a pinch, and that will do:', 'Too much, too little? Diners boo!'],
  game: 'Just a Pinch',
  goal: 'As the table turns, shake just as many pinches of salt on each plate as its little flag shows.',
  tips: ['One press is one pinch. The flag fills in as the salt lands.', 'Plates creep at the ends of the table and swing fast across the middle: the ends are easiest.', 'Just right scores three; one pinch out scores one.', 'Salt takes a moment to fall: shake a little ahead. Puddings want none at all!'],
  score: 'points',
  controls: [['Move along the rail', 'move', 'Tap above a plate to shake'], ['Shake a pinch', 'action']],
  pass: 35,
  tune: 'play',
  color: '#9ab0b8',
};
