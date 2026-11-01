// The Jackknife Niffy: its field-guide entry. Its game is ../games/niffy.js.
export default {
  id: 'niffy',
  name: 'The Jackknife Niffy',
  object: 'a pocketknife',
  rhyme: ['Snip-snap! The Niffy’s in the air,', 'With one sharp blade and not a care.', 'A feather here, a thread there:', 'But mind the Keeper’s watchful stare!'],
  game: 'Snip Snap',
  goal: 'Swoop down and snip the feathers, flowers, loose threads and price tags from the people strolling below.',
  tips: [
    'A pink ring shows what a swoop would snip: press when it’s on a feather, flower, thread or tag, and the Niffy goes straight for it.',
    'The Park Keeper only notices you moving. When his “!” and eye appear, keep still (or fly about up high, where he hardly sees you); low down, moving or swooping fills his ring fast, and full, he whistles.',
    'Fly low for quick snips. Miss, and people hold on to their things for a moment: fly up high and they let go sooner.',
    'Never snip a balloon string; a price tag is worth two.',
  ],
  score: 'snips',
  controls: [['Fly along', 'move', 'Point to fly: left and right, and higher or lower'], ['Fly higher / lower', 'stick or D-pad ▲ ▼, or ↑ ↓ / W S', 'Tap where to swoop'], ['Swoop and snip', 'action']],
  pass: 12,
  tune: 'play',
  color: '#e0a49a',
};
