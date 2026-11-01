// The book's other 18 birds, in the field guide after the first ten (see
// ../birds.js). Each has its field-guide entry here, src/more/<id>.js,
// default-exporting it in the same shape as the entries in ../birds.js (id,
// name, object, rhyme, game, goal, tips, controls, score, pass, tune, color),
// and its game in ../games/<id>.js. Its bird is drawn by ../subjects.js, from
// its painting.

import milkmidge from './milkmidge.js';
import waterglassgoose from './waterglassgoose.js';
import niffy from './niffy.js';
import broomwhisk from './broomwhisk.js';
import buttonbeaks from './buttonbeaks.js';
import keycrane from './keycrane.js';
import snippit from './snippit.js';
import garbagecanary from './garbagecanary.js';
import steampressersparrow from './steampressersparrow.js';
import wetweatherwren from './wetweatherwren.js';
import glovedove from './glovedove.js';
import titthrush from './titthrush.js';
import plugsocketswift from './plugsocketswift.js';
import saltshakershrike from './saltshakershrike.js';
import ladlelark from './ladlelark.js';
import drippet from './drippet.js';
import sawbird from './sawbird.js';
import radiobird from './radiobird.js';

// In the guide's order: pages 11 to 28.
export const MORE = [
  milkmidge, waterglassgoose, niffy, broomwhisk, buttonbeaks, keycrane,
  snippit, garbagecanary, steampressersparrow, wetweatherwren, glovedove, titthrush,
  plugsocketswift, saltshakershrike, ladlelark, drippet, sawbird, radiobird,
];

export const MORE_IDS = MORE.map((b) => b.id);
