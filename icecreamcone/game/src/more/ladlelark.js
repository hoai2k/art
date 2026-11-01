// The Soupladle Lark's field-guide entry; its game is ../games/ladlelark.js.
export default {
  id: 'ladlelark',
  name: 'The Soupladle Lark',
  object: 'a soup ladle',
  rhyme: ['Round and round the soup pot goes,', 'The Lark dips in its bowl and rose.', 'A carrot here, a pea or two:', 'Just what you asked for, served to you!'],
  game: 'Soup’s On',
  goal: 'Dip the ladle to scoop just what each hungry creature asks for.',
  tips: ['Whatever lies across the ring comes up in the ladle.', 'Make the ring small to pick one bit out of a crowd, big to take two wanted bits at once (and anything round them).', 'One bit they didn’t ask for is forgiven; two, or the old boot, and it’s “Yuck!” (and costs one).', 'Serve before the bar turns yellow for an extra point.', 'The soup turns: dip just ahead of what you want.'],
  score: 'points',
  controls: [['Move the ladle', 'move', 'Tap where to dip'], ['Dip', 'action'], ['Ring smaller / bigger', 'right stick up / down, Q / E, or the mouse wheel', 'Mouse wheel (on a touch screen the ring stays as it is)']],
  pass: 36,
  tune: 'menu',
  color: '#d08a5a',
};
