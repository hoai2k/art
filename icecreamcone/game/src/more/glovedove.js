// The Glove Dove: Slippery Dishes. Its game is ../games/glovedove.js.
export default {
  id: 'glovedove',
  name: 'The Glove Dove',
  object: 'a rubber glove',
  rhyme: ['A long pink glove with a dove’s pink head', 'Has washed the plates and the cups, it said.', 'But wet things slip! So, quick as a wink,', 'It bumps them up from the soapy sink.'],
  game: 'Slippery Dishes',
  goal: 'Crouch under the slippery dishes to catch them on your glove, then spring up and bump each one into the plate rack.',
  tips: ['Watch the ring on the counter: that is where the dish comes down. Hold to crouch under it.', 'Keep crouching till the pink dots over the glove are full: let go for a “Hup!” that flies to the rack.', 'Let go sooner and it only hops along. You can carry a dish on your glove while you crouch.', 'Standing up, a dish bounces once, then slips off. Heavy pans fly lower.'],
  score: 'points',
  controls: [['Run along the counter', 'move', 'Drag to run under the dishes'], ['Hold to crouch and catch a dish; let go to bump it to the rack', 'action', 'Hold your finger down to crouch; lift it to bump']],
  pass: 30,
  tune: 'play',
  color: '#e8a0b0',
};
