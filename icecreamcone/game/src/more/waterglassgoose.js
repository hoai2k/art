// The Waterglass Goose: its field-guide entry. Its game is ../games/waterglassgoose.js.
export default {
  id: 'waterglassgoose',
  name: 'The Waterglass Goose',
  object: 'a drinking glass',
  rhyme: ['A little water, not too much,', 'And every glass will sing at a touch.', 'The Goose plays first, then it’s your go:', 'Tap them back just so, just so.'],
  game: 'Glass Harp',
  goal: 'Watch and listen as the Goose taps out a tune on the glasses, then tap the same glasses back in the same order.',
  tips: [
    'Each glass has its own colour and its own note: the fuller the glass, the lower the note.',
    'Say the colours to yourself as the Goose plays them: blue, green, yellow, pink, orange.',
    'Play each note straight after the last (within a moment) for one extra.',
    'A whole tune played back scores three extra. A wrong glass cracks it and ends that tune; three cracks and the concert is over.',
  ],
  score: 'points',
  controls: [['Step along the glasses', 'move', 'Tap the glasses in the same order'], ['Tap a glass', 'action']],
  pass: 30,
  tune: 'menu',
  color: '#b7dcc0',
};
