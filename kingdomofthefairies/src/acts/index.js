// The acts, in story order. Each module follows src/acts/CONTRACT.md.
// The default edition follows Méliès's 1903 film (design/film-adaptation.md):
// a prologue, Acts I-IV recast, and the film's Acts V and VI. The query
// editions (?widowsbay=on, ?widowsbay=partial) keep the original five acts.
import { CLASSIC } from '../theme.js';
import prologue from './prologue.js';
import act1 from './act1.js';
import act2 from './act2.js';
import act3 from './act3.js';
import act4 from './act4.js';
import act5 from './act5.js';
import { actTower, actBurning } from './act5film.js';

export const ACTS = CLASSIC ? [act1, act2, act3, act4, act5] : [prologue, act1, act2, act3, act4, actTower, actBurning];
