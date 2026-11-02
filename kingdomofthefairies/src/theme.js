// Two editions, chosen by the query (headless tests: KOTF_EDITION, the same
// names; unset means the default):
// - the default (no ?widowsbay, ?widowsbay=off, or any value but on): the
//   film edition, following Méliès's 1903 film (design/film-adaptation.md),
//   with a prologue and six acts;
// - ?widowsbay=on: the preserved music-video edition, unless the deploy left
//   it out (<meta name="kotf-widowsbay" content="off">, written by publish.sh).
const query = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('widowsbay') : null;
const env = typeof process !== 'undefined' ? process.env?.KOTF_EDITION : undefined;
export const WIDOWSBAY_DEPLOYED = typeof document === 'undefined' || document.querySelector?.('meta[name="kotf-widowsbay"]')?.content !== 'off';
export const editionOf = (q, deployed = WIDOWSBAY_DEPLOYED) => (deployed && String(q ?? '').toLowerCase() === 'on' ? 'widowsbay' : 'film');
export const EDITION = env ? (env === 'widowsbay' ? 'widowsbay' : 'film') : editionOf(query);
// The film edition's cast look: the hand-tinted alternates (design/
// character-audit.md, image requests F8) by default, or ?look=original for
// the first, cleaner art. Settings › Cast look changes it too.
export const LOOK_PARAM = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('look') : null;
// LEGACY: the band, the song and the Widow's Bay title.
export const LEGACY = EDITION === 'widowsbay';
export const FILM = EDITION === 'film';
// CLASSIC: the original five acts (Widow's Bay).
export const CLASSIC = !FILM;
export const TITLE = LEGACY ? TEXT.titles.widowsbay : TEXT.titles.film;
export const BAY_TITLE = LEGACY ? TEXT.titles.widowsbay : TEXT.titles.tower;
// Each edition's saves and settings (src/editor.js lists them for ?edit=local).
export const STORAGE_PREFIXES = { widowsbay: 'widowsbay', film: 'kingdomofthefairies' };
export const STORAGE_PREFIX = LEGACY ? 'widowsbay' : 'kingdomofthefairies';
import { WALK_FIT, POSE_FIT } from './sprite-fit.js';
import { TEXT } from './text_config.js';

export function themeManifest(manifest, edition = EDITION) {
  // The film edition's slots never load in the music-video edition.
  if (edition === 'widowsbay' || edition === true) return { ...manifest, slots: Object.fromEntries(Object.entries(manifest.slots || {}).filter(([, s]) => s.edition !== 'film')) };
  const slots = Object.fromEntries(Object.entries(manifest.slots || {}).filter(([id]) => !id.startsWith('band-')));
  slots.logo = { status: 'delivered', file: 'fairies-title.webp' };
  const anims = Object.fromEntries(Object.entries(manifest.anims || {}).filter(([id, slot]) =>
    !id.includes('band-') && !String(slot.file).includes('band-')));
  const { song, ...audio } = manifest.audio || {};
  return { ...manifest, slots, anims, audio };
}

// The page's own wording (index.html): each [data-text="html.…"] element takes
// the HTML string at that path in TEXT (src/text_config.js); the text written
// in the page stays as its fallback. [data-text-node] replaces only the
// element's first text node (a button's label before its <span>, an input's
// label), keeping the whitespace around it.
const textAt = (key) => String(key).split('.').reduce((o, k) => (o == null ? o : o[k]), TEXT);
export function fillText(root = document) {
  for (const el of root.querySelectorAll('[data-text]')) {
    const v = textAt(el.dataset.text);
    if (typeof v === 'string') el.innerHTML = v;
  }
  for (const el of root.querySelectorAll('[data-text-node]')) {
    const v = textAt(el.dataset.textNode);
    const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
    if (typeof v === 'string' && node) node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), () => v);
  }
}

export function applyDocumentTheme() {
  document.title = TITLE + (location.pathname.includes('/workbench/') ? ' · Workbench' : '');
  fillText();
  // Each edition's own elements; the other edition's are marked ed-off so
  // the shell never shows them. data-classic-only: Widow's Bay's;
  // data-legacy-only: the band and the song (?widowsbay alone).
  for (const el of document.querySelectorAll(FILM ? '[data-classic-only]' : '[data-film-only]')) { el.classList.add('ed-off'); el.hidden = true; }
  if (!LEGACY) return;
  for (const el of document.querySelectorAll('[data-widowsbay]')) el.textContent = el.dataset.widowsbay;
  for (const el of document.querySelectorAll('[data-text-widowsbay]')) { const v = textAt(el.dataset.textWidowsbay); if (typeof v === 'string') el.textContent = v; }
  for (const el of document.querySelectorAll('[data-legacy-only]')) el.hidden = false;
  const stage = document.querySelector('#stage'); if (stage) stage.setAttribute('aria-label', TEXT.titles.stageLabel(TITLE));
  const meta = document.querySelector('meta[name="apple-mobile-web-app-title"]'); if (meta) meta.content = TITLE;
  const manifest = document.querySelector('link[rel="manifest"]'); if (manifest) manifest.href = 'manifest-widowsbay.webmanifest';
  for (const el of document.querySelectorAll('link[data-legacy-icon]')) el.href = el.dataset.legacyIcon;
}

// The film edition has no guitar: the enchanted sword in its place.
export const words = (s) => (FILM ? String(s).replace(/its music wakes/g, 'its glow wakes').replace(/guitar/g, 'sword').replace(/Guitar/g, 'Sword') : s);

// The film edition's cast: a legacy sprite id drawn as its film counterpart
// whenever that art is loaded, else the
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

