// The Broomwhisk: its field-guide entry. Its game is ../games/broomwhisk.js.
export default {
  id: 'broomwhisk',
  name: 'The Broomwhisk',
  object: 'a straw broom',
  rhyme: ['Swish and swoosh across the floor,', 'The Broomwhisk sweeps from door to door.', 'Leaves and dust, into the pan,', 'Before the wind blows them back again!'],
  game: 'Clean Sweep',
  goal: 'Push the leaves and dust into the dustpan before the wind scatters them.',
  tips: ['Get behind a leaf, then sweep it towards the pan: it slides on after the broom.', 'Press to flick the bristles: everything in front of the broom skids away.', 'When the tree rustles a gust is coming. Only what you sweep goes in the pan.', 'The pan moves after every eight. A golden leaf is worth three.'],
  score: 'points',
  controls: [['Sweep', 'move'], ['Flick', 'action']],
  pass: 15,
  tune: 'play',
  color: '#d9c08a',
};
