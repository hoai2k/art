// Three editions, chosen by the query (headless tests: KOTF_EDITION, the same
// names; unset means the default):
// - the default (no ?widowsbay, ?widowsbay=off, or any value but on and
//   partial): the film edition, following Méliès's 1903 film
//   (design/film-adaptation.md), with a prologue and six acts;
// - ?widowsbay=partial: the original five acts under the new title, with no
//   band, song or guitar (new art fills their places, PARTIAL_CAST);
// - ?widowsbay=on: the preserved music-video edition.
const query = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('widowsbay') : null;
const env = typeof process !== 'undefined' ? process.env?.KOTF_EDITION : undefined;
export const editionOf = (q) => ({ on: 'widowsbay', partial: 'partial', classic: 'partial' }[String(q ?? '').toLowerCase()] || 'film');
export const EDITION = env ? (['widowsbay', 'partial', 'film'].includes(env) ? env : 'film') : editionOf(query);
// The film edition's cast look: the hand-tinted alternates (design/
// character-audit.md, image requests F8) by default, or ?look=original for
// the first, cleaner art. Settings › Cast look changes it too.
export const LOOK_PARAM = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('look') : null;
// LEGACY: the band, the song and the Widow's Bay title.
export const LEGACY = EDITION === 'widowsbay';
export const PARTIAL = EDITION === 'partial';
export const FILM = EDITION === 'film';
// CLASSIC: the original five acts (the query editions).
export const CLASSIC = !FILM;
export const TITLE = LEGACY ? "Widow's Bay" : 'Kingdom of the Fairies';
export const BAY_TITLE = LEGACY ? "Widow's Bay" : 'The Enchanted Tower';
// Each edition's saves and settings (src/editor.js lists them for ?edit=local).
export const STORAGE_PREFIXES = { widowsbay: 'widowsbay', partial: 'kingdomofthefairies.partial', film: 'kingdomofthefairies' };
export const STORAGE_PREFIX = LEGACY ? 'widowsbay' : PARTIAL ? 'kingdomofthefairies.partial' : 'kingdomofthefairies';
import { WALK_FIT, POSE_FIT } from './sprite-fit.js';

export function themeManifest(manifest, edition = EDITION) {
  // The new slots (production requests, interim cut-outs, tableaux) never
  // load in the music-video edition.
  if (edition === 'widowsbay' || edition === true) return { ...manifest, slots: Object.fromEntries(Object.entries(manifest.slots || {}).filter(([, s]) => s.edition !== 'film')) };
  // A requested film slot with an interim cut-out (design/source/cut_planning.py)
  // loads that until its own art is delivered.
  const slots = Object.fromEntries(Object.entries(manifest.slots || {}).filter(([id]) => !id.startsWith('band-'))
    .map(([id, s]) => [id, s.status === 'requested' && s.interim ? { ...s, status: 'delivered', file: s.interim, interimArt: true } : s]));
  slots.logo = { status: 'delivered', file: 'fairies-title.webp' };
  const anims = Object.fromEntries(Object.entries(manifest.anims || {}).filter(([id, slot]) =>
    !id.includes('band-') && !String(slot.file).includes('band-')));
  const { song, ...audio } = manifest.audio || {};
  return { ...manifest, slots, anims, audio };
}

export function applyDocumentTheme() {
  document.title = TITLE + (location.pathname.includes('/workbench/') ? ' · Workbench' : '');
  // Each edition's instructions pages and tabs; the other edition's are
  // marked ed-off so the shell never shows them.
  // data-classic-only: the original acts' pages (both query editions);
  // data-legacy-only: the band and the song (?widowsbay alone).
  for (const el of document.querySelectorAll(FILM ? '[data-classic-only]' : '[data-film-only]')) { el.classList.add('ed-off'); el.hidden = true; }
  if (PARTIAL || FILM) partialWords(document.querySelector('#instructions'));
  if (!LEGACY) return;
  for (const el of document.querySelectorAll('[data-widowsbay]')) el.textContent = el.dataset.widowsbay;
  for (const el of document.querySelectorAll('[data-legacy-only]:not(.ins-page)')) el.hidden = false;
  const stage = document.querySelector('#stage'); if (stage) stage.setAttribute('aria-label', TITLE + ' stage');
  const meta = document.querySelector('meta[name="apple-mobile-web-app-title"]'); if (meta) meta.content = TITLE;
  const manifest = document.querySelector('link[rel="manifest"]'); if (manifest) manifest.href = 'manifest-widowsbay.webmanifest';
  for (const el of document.querySelectorAll('link[data-legacy-icon]')) el.href = el.dataset.legacyIcon;
}

// The partial edition's swaps: the guitar becomes a sword, in its art and in
// its words. Strict: a legacy id here never draws itself, so until the new
// art loads the code's own fallback is used (the sailor stands in the moon
// boat instead of sitting with his guitar).
export const PARTIAL_CAST = {
  'guitar-sinking': 'sword-sinking', 'keepsake-guitar': 'keepsake-sword', 'sailor-seated': 'sailor-seated-plain',
};
// The partial and film editions have no guitar: the enchanted sword in its place.
export const words = (s) => (PARTIAL || FILM ? String(s).replace(/its music wakes/g, 'its glow wakes').replace(/guitar/g, 'sword').replace(/Guitar/g, 'Sword') : s);
function partialWords(root) {
  if (!root) return;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (/guitar|music wakes/i.test(n.nodeValue)) n.nodeValue = words(n.nodeValue);
}

// The film edition's cast: a legacy sprite id drawn as its film counterpart
// whenever that art is loaded (delivered, or an interim cut-out), else the
// legacy art. Acts add their own with a `cast` map (src/acts/CONTRACT.md).
export const FILM_CAST = {
  ...Object.fromEntries(['stand', 'walk-a', 'walk-b', 'pass-a', 'pass-b', 'leap', 'crouch', 'carry', 'carry-walk-a', 'carry-pass-a', 'carry-walk-b', 'carry-pass-b', 'swim-a', 'swim-b', 'seated', 'hang', 'pullup',
    'climb-a', 'climb-b', 'apex', 'fall', 'land', 'stairs-a', 'stairs-b'].map((p) => ['sailor-' + p, 'prince-' + p])),
  'sailor-throw': 'prince-push',
  'reveller-yellow': 'crew-squire', 'reveller-jester': 'crew-helmsman', 'reveller-lady': 'crew-manatarms', 'reveller-shaggy': 'crew-bosun',
  'guitar-sinking': 'sword-sinking', 'tea-leaf': 'aurora-star',
  'keepsake-guitar': 'keepsake-sword', 'keepsake-tea': 'keepsake-star', 'keepsake-rose': 'keepsake-shell',
  'keepsake-pearl': 'keepsake-seal', 'keepsake-stone': 'keepsake-lamp',
  // (The Crossing keeps the original ship and its wreck: the galley art
  // stays in the manifest but is not drawn, at the owner's request.)
  'sentry-creature-closed': 'lobster-guard-closed', 'sentry-creature-open': 'lobster-guard-open',
  'gaze-lantern': 'scrying-eye', 'beloved-stand': 'azurine-stand', playbill: 'playbill-film',
};

// The delivered prince poses were fitted to fill their canvases, not to one
// body scale as the sailor's were (sailor-motion.js), so he grew as he
// climbed. Each factor scales a pose about its feet (bottom centre) to the
// standing pose's head size: measured by matching prince-stand's helmet and
// face in each pose, against the sailor's own pose-to-pose ratios.
export const FILM_BODY_SCALE = {
  'prince-leap': 1.14, 'prince-seated': 1.22, 'prince-carry': 0.95,
  'prince-climb-a': 0.81, 'prince-climb-b': 0.81, 'prince-apex': 0.93, 'prince-fall': 0.84,
  'prince-land': 0.76, 'prince-stairs-a': 0.76, 'prince-stairs-b': 0.78, 'prince-push': 0.82,
};
// The tinted prince (F8) was measured the same way on its own poses, so each
// look scales by its own numbers rather than inheriting the other's.
export const FILM_BODY_SCALE_TINTED = {
  'prince-leap': 1.17, 'prince-seated': 1.22, 'prince-carry': 0.95,
  'prince-climb-a': 0.80, 'prince-climb-b': 0.80, 'prince-apex': 0.91, 'prince-fall': 0.84,
  'prince-land': 0.76, 'prince-stairs-a': 0.79, 'prince-stairs-b': 0.81, 'prince-push': 0.85,
};
// A walking frame drawn with its head too low (design/sprite-audit.md) is
// scaled up from its feet by the audit's factor (WALK_FIT), and a pose painted
// larger or smaller than its character is drawn at its size (POSE_FIT).
export const bodyScaleOf = (id) => {
  const tinted = id.endsWith('-tinted');
  const base = (tinted ? id.slice(0, -7) : id).replace(/-carry-(?:walk|pass)-[ab]$/, '-carry');
  return ((tinted ? FILM_BODY_SCALE_TINTED[base] : FILM_BODY_SCALE[base]) || 1) * (WALK_FIT[id] || 1) * (POSE_FIT[id] || 1);
};

