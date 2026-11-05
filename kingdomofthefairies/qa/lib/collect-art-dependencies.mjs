import { readFile } from 'node:fs/promises';
import { literalDependencies } from './art-dependencies.mjs';
export const ACT_MODULES = { prologue: 'prologue.js', crossing: 'act1.js', grotto: 'act2.js', court: 'act3.js', whale: 'act4.js', tower: 'act5film.js', burning: 'act5film.js', 5: 'act5.js' };
const actsRoot = new URL('../../src/acts/', import.meta.url);
export async function collectActDependencies(key) {
  if (!ACT_MODULES[key]) throw new Error('No artwork source graph for ' + key);
  const dependencies = { ids: new Set(), suffixes: new Set(), walks: new Set() }, seen = new Set();
  async function visit(file) {
    if (seen.has(file.href)) return;
    seen.add(file.href);
    const source = await readFile(file, 'utf8'), literals = literalDependencies(source);
    for (const kind of Object.keys(dependencies)) for (const value of literals[kind]) dependencies[kind].add(value);
    for (const [, ref] of source.matchAll(/\bfrom\s*['"](\.[^'"]+\.js)['"]/g)) {
      const dependency = new URL(ref, file);
      // Universal shell/drawing helpers are represented by their shared
      // resolver contracts, rather than including every game's shell asset.
      if (dependency.href.startsWith(actsRoot.href)) await visit(dependency);
    }
  }
  await visit(new URL(ACT_MODULES[key], actsRoot));
  return Object.fromEntries(Object.entries(dependencies).map(([kind, values]) => [kind, [...values]]));
}
