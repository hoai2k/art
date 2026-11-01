// One clock keeps the closing tableau, credits and score in sync.
export const FINALE = { celebrate: 5, roll: 30 };
export const FINALE_END = FINALE.celebrate + FINALE.roll;
export const CREDITS = [
  { y: 0, text: 'Kingdom of the Fairies', size: 48, title: true },
  { y: 68, text: 'A hand-tinted toy theatre', size: 25 },
  { y: 190, text: 'Principal Game Designer', size: 24 },
  { y: 240, text: 'Hoai Nguyen', size: 38 },
  { y: 365, text: 'After the film', size: 24 },
  { y: 415, text: 'Le Royaume des fées (1903)', size: 34 },
  { y: 465, text: 'Georges Méliès', size: 32 },
  { y: 590, text: 'Video game inspired by the song', size: 24 },
  { y: 640, text: "Widow's Bay", size: 36 },
  { y: 690, text: 'by Langan, Frost, and Wane', size: 28 },
  { y: 840, text: 'Thank you for playing', size: 38 },
];
export function finaleFrame(time) {
  const clamp = n => Math.max(0, Math.min(1, n));
  const roll = clamp((time - FINALE.celebrate) / FINALE.roll);
  // The roll ends; the celebration, music and player controls continue.
  const fade = 0;
  return { roll, fade, music: 1, creditsY: 720 - roll * (CREDITS.at(-1).y + 640), done: time >= FINALE_END };
}
