// The Buttonbeaks: their field-guide entry. Their game is ../games/buttonbeaks.js.
export default {
  id: 'buttonbeaks',
  name: 'The Buttonbeaks',
  object: 'a pair of buttons',
  rhyme: ['Two little buttons, round and bright,', 'Go everywhere as a pair, just right.', 'They know each coat that needs a stitch:', 'Find the one that makes it match!'],
  game: 'Button Up',
  goal: 'Pick up the button each passing coat is missing, and toss it up into its buttonhole.',
  tips: ['Each empty buttonhole shows the button it wants: look at the colour, the shape and the holes.', 'Pick from the bowl under the tall bird’s beak: every hole that button fits glows pink. Walk under that coat and toss.', 'B: discard a button you don’t need (or toss it up where no coat is overhead).', 'A button that doesn’t match bounces off and makes the Buttonbeaks dizzy.', 'Later the line runs faster, and two bowls of look-alike buttons arrive.'],
  score: 'buttons',
  controls: [['Walk', 'move'], ['Pick up a button, toss it', 'action', 'Tap a bowl to pick a button, tap a coat to toss it'], ['B', 'discard (on the keyboard, toss it where no coat is overhead)', 'Tap up where no coat is overhead to toss a button away']],
  pass: 10,
  tune: 'menu',
  color: '#d9b0a0',
};
