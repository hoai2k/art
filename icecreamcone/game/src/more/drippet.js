// The Drippet's field-guide entry (its game is ../games/drippet.js).
export default {
  id: 'drippet',
  name: 'The Drippet',
  object: 'a water tap',
  rhyme: ['Drip and drop goes the Drippet’s spout,', 'Wherever it runs, the water comes out.', 'Give the thirsty things a drink,', 'But mind the puddles: slip! Don’t sink!'],
  game: 'Drip Drop Dash',
  goal: 'Run to each thirsty thing and stand over it until it’s full, without skidding in your own puddles.',
  tips: ['On water you keep sliding: steer to recover, or hop. Puddles stay wet a little longer.', 'A brand-new drip is safe; a puddle that has sat a moment is slippery.', 'Press the action to hop over a puddle.', 'A hop lands with a splash, skids if it lands in any puddle, and needs a moment before the next: steer round puddles where you can.', 'The cat noses its bowl away from puddles, so don’t drip all round it.'],
  score: 'drinks',
  controls: [['Run', 'move'], ['Hop over a puddle', 'action']],
  pass: 13,
  tune: 'play',
  color: '#8ab0d0',
};
