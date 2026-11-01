// The Ten O'clock Tit Trush: Clock Hop. Its game is ../games/titthrush.js.
export default {
  id: 'titthrush',
  name: 'The Ten O’clock Tit Trush',
  object: 'a pocket watch',
  rhyme: ['Tick, says the Trush, and tock, and tick,', 'Its golden hands go round so quick.', 'Whatever the town clocks call, it’s set;', 'But ten o’clock is its favourite yet.'],
  game: 'Clock Hop',
  goal: 'Ride each clock’s long hand round, and let go to hop to the next clock.',
  tips: [
    'The dotted line shows where the Trush will fly: let go when it turns pink and rings a clock.',
    'Fly through the middle of a clock for a bullseye: two points.',
    'The gold ten o’clock watch is worth three, but it doesn’t wait long.',
    'Every fifth hop in a row earns one more. The cuckoo clock runs backwards!',
  ],
  score: 'points',
  controls: [['Let go and hop', 'action']],
  pass: 14,
  tune: 'menu',
  color: '#d8b040',
};
