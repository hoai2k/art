import { TEXT } from './text_config.js';
// One clock keeps the closing tableau, credits and score in sync.
export const FINALE = { celebrate: 5, roll: 30 };
export const FINALE_END = FINALE.celebrate + FINALE.roll;
export const CREDITS = [
  { y: 0, text: TEXT.credits.title, size: 48, title: true },
  { y: 68, text: TEXT.credits.tagline, size: 25 },
  { y: 190, text: TEXT.credits.designerRole, size: 24 },
  { y: 240, text: TEXT.credits.designer, size: 38 },
  { y: 365, text: TEXT.credits.afterRole, size: 24 },
  { y: 415, text: TEXT.credits.film, size: 34 },
  { y: 465, text: TEXT.credits.director, size: 32 },
  { y: 590, text: TEXT.credits.songRole, size: 24 },
  { y: 640, text: TEXT.credits.song, size: 36 },
  { y: 690, text: TEXT.credits.songBy, size: 28 },
  { y: 840, text: TEXT.credits.thanks, size: 38 },
];
export function finaleFrame(time) {
  const clamp = n => Math.max(0, Math.min(1, n));
  const roll = clamp((time - FINALE.celebrate) / FINALE.roll);
  // The roll ends; the celebration, music and player controls continue.
  const fade = 0;
  return { roll, fade, music: 1, creditsY: 720 - roll * (CREDITS.at(-1).y + 640), done: time >= FINALE_END };
}
