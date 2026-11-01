// The Garbage Canary's page in the field guide; its game is ../games/garbagecanary.js.
export default {
  id: 'garbagecanary',
  name: 'The Garbage Canary',
  object: 'a dustbin',
  rhyme: ['A bin on legs, a bird inside,', 'It snaps up rubbish, far and wide.', 'Tins and peel? Up goes the lid!', 'A cat or a hat? Then stay well hid!'],
  game: 'Bin Day',
  goal: 'Walk the bin into the rubbish’s path and lift the lid: the canary inside grabs it. Dodge anything that glows.',
  tips: ['Arrows at the right edge show what’s coming and at what height. Walk up and down the street to get in line with the rubbish: its arrow and shadow darken when it’s in your lane.', 'Lift the lid as the rubbish comes and the canary snatches it; shut it on something at the lid and that goes in too. Don’t leave it gaping: the canary gets bored and ducks down, and the wind whisks rubbish back out.', 'Things that glow gold (cats, hats, letters, sparrows) aren’t rubbish: step aside or keep the lid shut. Catch one and it costs a point, and the lid sticks while the canary splutters. Cats and sparrows come to sniff an open bin!', 'Five in a row earns a bonus, and a longer run earns more.'],
  score: 'points',
  controls: [['Walk (up and down crosses the street)', 'move', 'Press anywhere to walk the bin there'], ['Lift the lid (hold)', 'action', 'Press on the bin and hold to lift the lid (drag to walk with it up)']],
  pass: 20,
  tune: 'play',
  color: '#a8aeb0',
};
