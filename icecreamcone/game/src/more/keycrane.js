// The Key Crane's page in the field guide; its game is ../games/keycrane.js.
export default {
  id: 'keycrane',
  name: 'The Key Crane',
  object: 'an old brass key',
  rhyme: ['Down on a string the Key Crane goes', 'To fish in the jumble with its toes.', 'Keep it steady, hook a ring,', 'Swing too wild and you lose the thing!'],
  game: 'Lucky Dip',
  goal: 'Lower the Key Crane onto a prize’s ring to hook it, then carry it to the chute.',
  tips: ['Moving sets the Crane swinging: stop over a ring and let it settle before you drop.', 'Swing too hard on the way back and the prize slips off.', 'Rings get smaller as you go. A golden watch counts as three.'],
  score: 'prizes',
  controls: [['Drive the trolley', 'move', 'Drag to aim; let go to drop'], ['Drop the Crane', 'action']],
  pass: 5,
  tune: 'play',
  color: '#c9a24a',
};
