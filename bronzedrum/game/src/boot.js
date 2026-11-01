// The game's entry point, behind the shared invite door (src/gate/gate.js, a
// copy of gate/loader.js from hoai2k.github.io, which loads the shared door). The door
// is off on localhost and while the owner's public-access switch is on; once
// through, the game itself is imported, which starts it.
import { openGate } from './gate/gate.js';

void openGate({
  title: 'Bronze Drum',
  game: 'bronzedrum',
  blurb: 'This game is for friends of Hoai Nguyen. Use your invite link, or enter your code below.',
}).then(() => import('./main.js'));
