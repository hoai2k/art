// The Saw Bird's field-guide entry (its game is ../games/sawbird.js). Its
// name in the book isn't known; it is "the Saw Bird" until it is.
export default {
  id: 'sawbird',
  name: 'The Saw Bird',
  object: 'a handsaw',
  rhyme: ['Zip and zuzz, the Saw Bird sings', 'Its sawdust song of wooden things.', 'Long strokes, slow strokes, follow the chalk:', 'A wobbly saw makes a crooked walk!'],
  game: 'Saw It Straight',
  goal: 'Saw each plank along its chalk line with long, steady strokes, and keep the cut straight.',
  tips: ['Only long strokes cut: push all the way, then pull all the way (or hold the action to push and let go to pull).', 'Keep a steady rhythm and the saw speeds up.', 'The grain pulls the cut aside: tip the saw up or down to steer it back to the line.', 'Knots sit on the line: steer round them (that doesn’t count against you), or grind slowly through.'],
  score: 'points',
  controls: [['Saw', 'Hold the action to push, let go to pull (or long strokes left and right)', 'Drag the saw back and forth'], ['Steer the cut', 'Stick or arrows up and down', 'Point above or below the cut']],
  pass: 30,
  tune: 'play',
  color: '#c9a070',
};
