import { readFile } from 'node:fs/promises';
import { ACT_ART } from '../src/act-art.js';
import { validateActArt } from './lib/validate-act-art.mjs';
const manifest = JSON.parse(await readFile(new URL('../assets/manifest.json', import.meta.url)));
const results = await validateActArt(ACT_ART, manifest);
console.log(`Complete generated-name/alias dependencies verified for ${results.length} Act/look combinations`);
