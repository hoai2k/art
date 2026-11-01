// Delivered artwork. assets/manifest.json (generated from
// design/source/build_requests.py) lists every requested image. Entries whose
// status is "delivered" (or "regenerate") are loaded; everything else is drawn
// by the procedural paper-cut stand-ins in render.js. Delivered production
// sheets with runtime: false are reserved for later builds. The game loads
// the scaled WebP copy (a.web, from design/source/build_web_art.py) when there
// is one; the PNG masters in assets/art/ are not published.

import { loadRig } from './rig.js';

// Jointed puppets cut from the part sheets (design/source/build_rigs.py),
// and their water-puppet twins once those sheets are cut.
const RIGS = ['sister-trac', 'sister-nhi', 'wp-sister-trac', 'wp-sister-nhi'];

// The looks (Settings, Style). The water puppets' images are the shadow
// puppets' twins under a 'wp-' id (build_requests.py, BD-W); a twin not yet
// delivered falls back to the shadow-puppet image, except these, which the
// renderer draws for itself in the water style rather than show paper.
export const STYLES = ['shadow', 'water'];
const DRAWN_IN_WATER = new Set(['paper-fiber', 'fx-scraps', 'ui-panel']);

// Cut-out figures and props stand on the ground line; some images leave an
// empty strip below the feet, which would leave them floating.
const FIGURES = new Set(['cast', 'story', 'practice']);

/** The empty strip under an image's lowest opaque pixel, as a fraction of its height. */
function footMargin(img) {
  try {
    const h = Math.min(img.height, 256);
    const w = Math.max(1, Math.round((img.width / img.height) * h));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    for (let y = h - 1; y >= 0; y--) {
      for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) return (h - 1 - y) / h;
    }
  } catch {
    /* unreadable: draw it as it is */
  }
  return 0;
}

export class Art {
  constructor() {
    this.images = new Map();
    this.entries = [];
    this.rigs = new Map();
    this.style = 'shadow';
  }

  async load(base = 'assets/') {
    try {
      const res = await fetch(`${base}manifest.json`);
      const manifest = await res.json();
      this.entries = manifest.assets || [];
    } catch {
      this.entries = [];
    }
    // 'regenerate': delivered, with a new take wanted; the current file is used until then.
    const loaded = (a) => a.status === 'delivered' || a.status === 'regenerate';
    const delivered = this.entries.filter((a) => loaded(a) && a.runtime !== false && a.file);
    // A water twin's rig is cut only once its part sheet is delivered.
    const sheets = new Set(this.entries.filter(loaded).map((a) => a.id));
    const rigs = RIGS.filter((id) => !id.startsWith('wp-') || sheets.has(`wp-rig-${id.slice(3)}`)).map(async (id) => {
      const r = await loadRig(base, id);
      if (r) this.rigs.set(id, r);
    });
    await Promise.all(
      [...rigs, ...delivered.map(
        (a) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const section = a.base ? (this.entries.find((b) => b.id === a.base) || a).section : a.section;
              if (FIGURES.has(section)) img.footMargin = footMargin(img);
              this.images.set(a.id, img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = `${base}${a.web || a.file}`;
          }),
      )],
    );
  }

  /** A jointed puppet, or null to draw the figure's whole sprite. */
  rig(id) {
    if (this.style === 'water') {
      // The water twin's own rig; its whole sprite if it has none yet; else the shadow puppet's rig.
      if (this.rigs.has(`wp-${id}`)) return this.rigs.get(`wp-${id}`);
      if (this.images.has(`wp-${id}`)) return null;
    }
    return this.rigs.get(id) || null;
  }

  /** The delivered image for an id in the current style, or null to use the stand-in. */
  get(id) {
    if (this.style === 'water') {
      const twin = this.images.get(`wp-${id}`);
      if (twin) return twin;
      if (DRAWN_IN_WATER.has(id)) return null;
    }
    return this.images.get(id) || null;
  }

  /** The delivered image for an id itself, whatever the style. */
  own(id) {
    return this.images.get(id) || null;
  }
}
