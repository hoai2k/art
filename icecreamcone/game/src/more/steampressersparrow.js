// The Steampresser Sparrow's page in the field guide; its game is ../games/steampressersparrow.js.
export default {
  id: 'steampressersparrow',
  name: 'The Steampresser Sparrow',
  object: 'an old steam iron',
  rhyme: ['Hiss and puff, the Sparrow glides', 'Over the washing’s crumpled sides.', 'Creases vanish, smooth and neat,', 'But stop too long and feel the heat!'],
  game: 'Pressing Business',
  goal: 'Glide the Sparrow over the creases to press them out before the next garment comes.',
  tips: ['Keep moving: an iron that lingers scorches the cloth.', 'Press (or tap the iron) for a puff of steam. It presses much faster, but it heats faster too.', 'Press out every crease without a scorch for a bonus of two.', 'Silk scorches sooner: go gently.'],
  score: 'points',
  controls: [['Iron', 'move', 'Drag the iron along the creases; tap for steam'], ['Steam', 'action']],
  pass: 16,
  tune: 'menu',
  color: '#8a9aa8',
};
