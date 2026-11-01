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
};
// facade elevations, in the order of the shader's array layers
export const FACADES = [
  'facades/commercial_red_3storey.png', 'facades/commercial_buff_2storey.png', 'facades/commercial_red_2storey_narrow.png',
  'facades/commercial_stone_bank.png', 'facades/commercial_corner_red_3storey.png', 'facades/commercial_painted_2storey.png',
  'facades/house_italianate_buff.png', 'facades/house_ontario_cottage_red.png', 'facades/house_clapboard_gable.png',
  'facades/house_queen_anne_red.png',
];
export const SPRITES = { maple: 'sprites/maple_leaf_cluster.png', oak: 'sprites/oak_leaf_cluster.png', willow: 'sprites/willow_strands.png', spruce: 'sprites/spruce_bough.png', fallen: 'sprites/fallen_leaves.png' };

export async function loadAssets(manifestUrl) {
  let files = [];
  try {
    const r = await fetch(manifestUrl || new URL('manifest.json', ASSETS));
    if (r.ok) { const j = await r.json(); files = Array.isArray(j) ? j : (j.files || []); }
  } catch { /* no manifest: all stand-ins */ }
  const listed = new Set(files);
  const tex = {}, facades = [], sprites = {};
  const load = async (path) => {
    const img = new Image(); img.decoding = 'async'; img.src = new URL(path, ASSETS).href;
    await img.decode();
    return img;
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
  const facadeImgs = await Promise.all(FACADES.map((f) => (listed.has(f) ? load(f).catch(() => null) : null)));
  await Promise.all(jobs);
  let facadeArray = null; const facadeLayer = FACADES.map(() => -1);
  const present = facadeImgs.map((im, i) => [im, i]).filter(([im]) => im);
  if (present.length) {
    const S = 512, data = new Uint8Array(S * S * 4 * present.length);
    const cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d', { willReadFrequently: true });
    present.forEach(([im, i], layer) => {
      cx.clearRect(0, 0, S, S); cx.drawImage(im, 0, 0, S, S);
      // flip rows so v=0 is the ground
      const d = cx.getImageData(0, 0, S, S).data;
      for (let y = 0; y < S; y++) data.set(d.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), (layer * S * S) + y * S * 4);
      facadeLayer[i] = layer;
    });
    facadeArray = new THREE.DataArrayTexture(data, S, S, present.length);
    facadeArray.colorSpace = THREE.SRGBColorSpace; facadeArray.generateMipmaps = true;
    facadeArray.minFilter = THREE.LinearMipmapLinearFilter; facadeArray.magFilter = THREE.LinearFilter; facadeArray.needsUpdate = true;
  }
  return { files: listed, tex, sprites, facadeArray, facadeLayer };
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
