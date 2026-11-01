// The Radio Bird's field-guide entry (its game is ../games/radiobird.js). Its
// name in the book isn't known; it is "the Radio Bird" until it is.
export default {
  id: 'radiobird',
  name: 'The Radio Bird',
  object: 'a transistor radio',
  rhyme: ['Hiss and crackle, whistle and hum,', 'Turn the dial and the songs will come.', 'Find the one your friends call for,', 'Then click! It plays. Now find some more!'],
  game: 'Tune In',
  goal: 'Turn the dial to the station the listeners ask for, and press to play it. Quick finds score more.',
  tips: ['The speaker under the needle crackles; a station’s picture fades in as you get close.', 'The listeners lean forward when you’re near the one they want.', 'Stations you play, or rest on, are pencilled on the dial, but the stations drift.', 'Each song scores 10, and up to 10 more for finding it fast.'],
  score: 'points',
  controls: [['Turn the dial', 'move', 'Drag the needle, and let go on their station'], ['Play the station', 'action'], ['Fine tuning', 'Spin the stick, or tap the arrows']],
  pass: 75,
  tune: null,
  color: '#d0a070',
};
