// Artwork and title remain separate. Change layouts.json, then run this
// file with Node from the repository to regenerate SVG and PNG deliverables.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serve, launch } from '../../../../../../shared/test/lib.mjs';
const here = fileURLToPath(new URL('./', import.meta.url));
const layouts = JSON.parse(await fs.readFile(here + 'layouts.json'));
const font = (await fs.readFile(here + 'fonts/Yesteryear-Regular.ttf')).toString('base64');
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
for (const name of ['landscape', 'portrait', 'square']) {
  const spec = layouts[name];
  const art = (await fs.readFile(here + `masters/${name}.png`)).toString('base64');
  const text = spec.lines.map(line => `<text x="${line.x}" y="${line.y}" font-size="${line.size}" text-anchor="${line.anchor || 'start'}">${escape(line.text)}</text>`).join('\n');
  const svg = image => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}">
<title>Kingdom of the Fairies — ${name} cover</title>
<defs><style>@font-face { font-family: CoverTitle; src: url(data:font/ttf;base64,${font}) format('truetype'); } text { font-family: CoverTitle; font-weight: 400; font-kerning: normal; }</style></defs>
${image ? `<g id="artwork" inkscape:groupmode="layer" inkscape:label="Text-free artwork"><image width="${spec.width}" height="${spec.height}" href="data:image/png;base64,${art}"/></g>` : ''}
<g id="title" inkscape:groupmode="layer" inkscape:label="Editable title" fill="${escape(layouts.fill)}">${text}</g>
</svg>`;
  await fs.writeFile(here + `cover-${name}.svg`, svg(true));
  await fs.writeFile(here + `title-${name}.svg`, svg(false));
}
const server = await serve(here), browser = await launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const name of ['landscape', 'portrait', 'square']) {
    const spec = layouts[name];
    await page.setViewportSize({ width: spec.width, height: spec.height });
    for (const layer of ['cover', 'title']) {
      await page.goto(server.url + `/${layer}-${name}.svg`);
      await page.evaluate(async () => { await document.fonts.load('100px CoverTitle'); await document.fonts.ready; });
      const bounds = await page.evaluate(() => [...document.querySelectorAll('text')].map(el => { const b = el.getBBox(); return { text: el.textContent, x: b.x, y: b.y, width: b.width, height: b.height }; }));
      for (const b of bounds) if (b.x < 8 || b.y < 8 || b.x + b.width > spec.width - 8 || b.y + b.height > spec.height - 8) throw Error(`${name} title outside safe margins: ${JSON.stringify(b)}`);
      const suffix = `${name}-${spec.width}x${spec.height}.png`;
      await page.screenshot({ path: here + `${layer}-${suffix}`, omitBackground: true });
      if (layer === 'cover') console.log(name, JSON.stringify(bounds));
    }
  }
} finally { await browser.close(); server.close(); }
