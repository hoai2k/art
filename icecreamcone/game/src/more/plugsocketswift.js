// The Plugsocket Swift's field-guide entry; its game is ../games/plugsocketswift.js.
export default {
  id: 'plugsocketswift',
  name: 'The Plugsocket Swift',
  object: 'a plug socket',
  rhyme: ['When dusk comes down and windows ask,', 'The Swift zips off about its task.', 'A lamp for you, a lamp for you,', 'But not too many, or the fuse blows through!'],
  game: 'Lights On',
  goal: 'Fly to each window that asks for a light and plug its lamp in, without blowing the fuse.',
  tips: ['A ring round the bulb shows how long they will wait.', 'Once they fall asleep, unplug their lamp to save power.', 'Three lamps are safe; any more and the fuse heats up.', 'If the fuse blows, fly to the fuse box and flip it back on.'],
  score: 'rooms lit',
  controls: [['Fly', 'move', 'Tap a window to fly there and plug in'], ['Plug in or unplug', 'action']],
  pass: 13,
  tune: 'night',
  color: '#e0b84a',
};
