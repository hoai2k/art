// The Milkbottle Midge: its field-guide entry. Its game is ../games/milkmidge.js.
export default {
  id: 'milkmidge',
  name: 'The Milkbottle Midge',
  object: 'a milk bottle',
  rhyme: ['The float hums out at break of day;', 'The Midge lobs pints along the way.', 'One on each step, and not a drop', 'To wake the dogs: plop, plop, plop!'],
  game: 'Milk Round',
  goal: 'Hold to wind up and let go to lob a pint of milk onto each doorstep as the float rolls by.',
  tips: [
    'The chalk line shows where you throw: hold longer to throw further up it, and let go when the ring turns green on the step.',
    'Start winding up before the house reaches the line.',
    'A pint on the step scores 1; right in the middle, on the mat, 2.',
    'Don’t smash a bottle by a sleeping dog, and skip the houses with a "No milk" card: each costs 1.',
  ],
  score: 'points',
  controls: [['Wind up and throw (hold, then let go)', 'action']],
  pass: 15,
  tune: 'play',
  color: '#c9d9e0',
};
