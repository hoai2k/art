// Delivered art: game/assets/manifest.json lists the files that exist. Each
// texture slot below has a procedural stand-in in the shaders; when its file is
// listed, the material is compiled with a define that samples it instead.
import * as THREE from 'three';

const ASSETS = new URL('../../assets/', import.meta.url);

// slot -> file, real-world size in metres (tiling textures)
export const TEXTURE_SLOTS = {
  brick_red: ['textures/brick_red.png', 2], brick_buff: ['textures/brick_buff.png', 2],
  stone: ['textures/stone_ashlar.png', 2], clapboard: ['textures/clapboard.png', 2],
  shingles: ['textures/roof_shingles.png', 3], roof_metal: ['textures/roof_metal.png', 3], slate: ['textures/roof_slate.png', 3],
  asphalt: ['textures/asphalt.png', 4], sidewalk: ['textures/sidewalk.png', 3], grass: ['textures/grass_autumn.png', 4],
  leaves: ['textures/leaf_litter.png', 3], bark: ['textures/bark_maple.png', 1], bark_willow: ['textures/bark_willow.png', 1],
  gravel: ['textures/gravel_path.png', 3], water: ['textures/water_avon.png', 8],
  // close-ups, blended in near the camera when the creature is small
  soil_cu: ['textures/soil_closeup.png', 0.2], grass_cu: ['textures/grass_roots_closeup.png', 0.2], moss: ['textures/moss.png', 0.3],
  concrete_cu: ['textures/concrete_closeup.png', 0.3], asphalt_cu: ['textures/asphalt_closeup.png', 0.3], bark_cu: ['textures/bark_closeup.png', 0.3],
  // the facade kit (round 8): sheets of parts for the modelled fronts (see materials.js KIT)
  kit_windows: ['kit/windows_victorian.png', 1], kit_shopfronts: ['kit/shopfronts.png', 1], kit_doors: ['kit/doors.png', 1],
  kit_cornices: ['kit/cornices.png', 1], kit_trim: ['kit/trim.png', 1], kit_awnings: ['kit/awnings.png', 1],
};
// Facade elevations, in the order of the shader's candidates (aFac). The
// delivered pictures are not edge to edge (sky, bushes, margins), so each has
// a crop [left, top, right, bottom] in image fractions: the band of wall from
// the ground to the eaves (houses: under the roof, which is real geometry).
export const FACADES = [
  ['facades/commercial_red_3storey.png', [0.0, 0.02, 1.0, 0.975]],
  ['facades/commercial_buff_2storey.png', [0.03, 0.03, 0.97, 0.985]],
  ['facades/commercial_red_2storey_narrow.png', [0.19, 0.02, 0.81, 0.975]],
  ['facades/commercial_stone_bank.png', [0.02, 0.06, 0.98, 0.9]],
  ['facades/commercial_corner_red_3storey.png', [0.03, 0.06, 0.97, 0.985]],
  ['facades/commercial_painted_2storey.png', [0.03, 0.02, 0.97, 0.985]],
  ['facades/house_italianate_buff.png', [0.05, 0.17, 0.95, 0.9]],
  ['facades/house_ontario_cottage_red.png', [0.03, 0.42, 0.97, 0.9]],
  ['facades/house_clapboard_gable.png', [0.04, 0.4, 0.96, 0.9]],
  ['facades/house_queen_anne_red.png', [0.05, 0.36, 0.95, 0.9]],
  ['facades/side_wall_red.png', [0.01, 0.04, 0.99, 0.985]],
  ['facades/back_lane.png', [0.0, 0.09, 1.0, 0.87]],
  ['facades/church_stone_gothic.png', [0, 0, 1, 1]],
  ['facades/commercial_buff_3storey.png', [0, 0, 1, 1]],
  ['facades/commercial_modern_1960s.png', [0, 0, 1, 1]],
  ['facades/house_buff_cottage.png', [0, 0.46, 1, 1]],
  ['facades/garage_side.png', [0, 0.12, 1, 1]],
];
export const FAC = { red3: 0, buff2: 1, narrow: 2, bank: 3, corner: 4, painted: 5, italianate: 6, cottage: 7, clapboard: 8, queenAnne: 9, side: 10, back: 11, church: 12, buff3: 13, modern: 14, buffCottage: 15, garage: 16 };
export const SPRITES = { maple: 'sprites/maple_leaf_cluster.png', oak: 'sprites/oak_leaf_cluster.png', willow: 'sprites/willow_strands.png', spruce: 'sprites/spruce_bough.png', fallen: 'sprites/fallen_leaves.png',
  blades: 'sprites/grass_blades.png', pebbles: 'sprites/pebbles.png', litter: 'sprites/litter_bits.png' };
export const SKY = 'ui/sky_autumn.png';
// facade kit sheets in shader order: [slot, columns, rows]
export const KIT_GRIDS = [['kit_windows', 4, 2], ['kit_shopfronts', 4, 1], ['kit_doors', 3, 2], ['kit_cornices', 1, 4], ['kit_trim', 4, 2], ['kit_awnings', 4, 1]];

const GAME = new URL('../../', import.meta.url);

// opts.facadeSize: texels per facade layer (512 keeps memory small on integrated GPUs)
export async function loadAssets(manifestUrl, opts = {}) {
  let files = [], web = {};
  try {
    const r = await fetch(manifestUrl || new URL('manifest.json', ASSETS));
    if (r.ok) { const j = await r.json(); files = Array.isArray(j) ? j : (j.files || []); web = (j && j.web) || {}; }
  } catch { /* no manifest: all stand-ins */ }
  const listed = new Set(files);
  const tex = {}, sprites = {};
  // the small web copy when there is one (relative to game/), else the original
  const load = async (path) => {
    const tryLoad = async (url) => { const img = new Image(); img.decoding = 'async'; img.src = url; await img.decode(); return img; };
    if (web[path]) { try { return await tryLoad(new URL(web[path], GAME).href); } catch { /* fall back */ } }
    return tryLoad(new URL(path, ASSETS).href);
  };
  const jobs = [];
  for (const [slot, [file, size]] of Object.entries(TEXTURE_SLOTS)) {
    if (!listed.has(file)) continue;
    jobs.push(load(file).then((img) => {
      const t = new THREE.Texture(img); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4; t.needsUpdate = true; tex[slot] = { texture: t, size };
    }).catch((e) => console.warn('[town] texture failed', file, e)));
  }
  for (const [slot, file] of Object.entries(SPRITES)) {
    if (!listed.has(file)) continue;
    jobs.push(load(file).then((img) => { sprites[slot] = keyMagenta(img); }).catch((e) => console.warn('[town] sprite failed', file, e)));
  }
  // the painted sky dome (scaled down: it is seen blurred through haze anyway)
  let sky = null;
  if (listed.has(SKY)) {
    try {
      const img = await load(SKY);
      const W = Math.min(img.naturalWidth, opts.skyWidth || 2048), Hh = Math.round(W / 2);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
      const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, W, Hh);
      // the haze colour along the painted horizon (about 64% down the image)
      const row = cx.getImageData(0, Math.round(Hh * 0.655), W, 1).data;
      let r = 0, g = 0, b = 0; for (let i = 0; i < row.length; i += 4) { r += row[i]; g += row[i + 1]; b += row[i + 2]; }
      const n = row.length / 4;
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
      sky = { texture: t, horizon: new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace) };
    } catch (e) { console.warn('[town] sky failed', e); }
  }
  // whole-building elevations are a colour and layout reference only: fronts are modelled (facade3d.js)
  const facadeImgs = opts.facades ? await Promise.all(FACADES.map(([f]) => (listed.has(f) ? load(f).catch(() => null) : null))) : FACADES.map(() => null);
  await Promise.all(jobs);
  let facadeArray = null; const facadeLayer = FACADES.map(() => -1);
  // crop (u0, v0, u1, v1 with v up from the ground) and tile aspect (width / height)
  const facadeCrop = FACADES.map(([, c]) => [c[0], 1 - c[3], c[2], 1 - c[1]]);
  const facadeAspect = FACADES.map(([, c]) => (c[2] - c[0]) / (c[3] - c[1]));
  const present = facadeImgs.map((im, i) => [im, i]).filter(([im]) => im);
  if (present.length) {
    const S = opts.facadeSize || 512, data = new Uint8Array(S * S * 4 * present.length);
    const cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d', { willReadFrequently: true });
    present.forEach(([im, i], layer) => {
      // only the cropped band, stretched to the layer (more texels where it matters)
      const [u0, t0, u1, b1] = FACADES[i][1], W = im.naturalWidth, Hh = im.naturalHeight;
      cx.clearRect(0, 0, S, S); cx.drawImage(im, u0 * W, t0 * Hh, (u1 - u0) * W, (b1 - t0) * Hh, 0, 0, S, S);
      // flip rows so v=0 is the ground
      const d = cx.getImageData(0, 0, S, S).data;
      for (let y = 0; y < S; y++) data.set(d.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), layer * S * S * 4 + y * S * 4);
      facadeLayer[i] = layer;
    });
    facadeArray = new THREE.DataArrayTexture(data, S, S, present.length);
    facadeArray.colorSpace = THREE.SRGBColorSpace; facadeArray.generateMipmaps = true; facadeArray.anisotropy = 4;
    facadeArray.minFilter = THREE.LinearMipmapLinearFilter; facadeArray.magFilter = THREE.LinearFilter; facadeArray.needsUpdate = true;
  }
  // facade kit: each cell's real bounds from its alpha (items are not on exact grid cells)
  const kitRects = new Float32Array(48 * 4);
  KIT_GRIDS.forEach(([slot, cols, rows], sheet) => {
    const t = tex[slot]; if (!t) return;
    t.texture.wrapS = t.texture.wrapT = THREE.ClampToEdgeWrapping;
    const img = t.texture.image, W = 512, Hh = 256;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, W, Hh);
    const a = cx.getImageData(0, 0, W, Hh).data;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x0 = Math.floor((c * W) / cols), x1 = Math.floor(((c + 1) * W) / cols), y0 = Math.floor((r * Hh) / rows), y1 = Math.floor(((r + 1) * Hh) / rows);
      let mx0 = x1, mx1 = x0, my0 = y1, my1 = y0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (a[(y * W + x) * 4 + 3] > 40) { if (x < mx0) mx0 = x; if (x > mx1) mx1 = x; if (y < my0) my0 = y; if (y > my1) my1 = y; }
      if (mx1 < mx0) { mx0 = x0; mx1 = x1 - 1; my0 = y0; my1 = y1 - 1; }
      const k = (sheet * 8 + r * cols + c) * 4;
      // (u0, v0, u1, v1) in texture space; v up (the texture is flipped on upload)
      kitRects.set([mx0 / W, 1 - (my1 + 1) / Hh, (mx1 + 1) / W, 1 - my0 / Hh], k);
    }
  });
  return { files: listed, tex, sprites, sky, kitRects, facadeArray, facadeLayer, facadeAspect, facadeCrop, fallen: sprites.fallen || null };
}

// Cut-outs arrive on #FF00FF: key it to alpha.
function keyMagenta(img) {
  const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
  const id = cx.getImageData(0, 0, cv.width, cv.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const m = Math.min(r, b) - g; // magenta-ness
    if (m > 60) d[i + 3] = 0; else if (m > 20) d[i + 3] = 255 * (1 - (m - 20) / 40);
  }
  cx.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
