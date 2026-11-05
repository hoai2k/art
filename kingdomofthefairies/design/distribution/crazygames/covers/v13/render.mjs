// Composite generated alpha lettering as its own movable layer. Masters
// are never repainted. Run from this repository with Node/Playwright.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serve, launch } from '../../../../../../shared/test/lib.mjs';
const here = fileURLToPath(new URL('./', import.meta.url));
const layouts = JSON.parse(await fs.readFile(here + 'layouts.json'));
const titleBytes = await fs.readFile(here + 'title-alpha-master.png');
const titleW = titleBytes.readUInt32BE(16), titleH = titleBytes.readUInt32BE(20);
const title = titleBytes.toString('base64');
for (const name of ['landscape', 'portrait', 'square']) {
  const s = layouts[name], t = s.title;
  const art = (await fs.readFile(here + `masters/${name}.png`)).toString('base64');
  const height = t.width * titleH / titleW;
  const svg = artwork => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${s.width}" height="${s.height}" viewBox="0 0 ${s.width} ${s.height}">
<title>Kingdom of the Fairies — ${name}</title>
<defs><filter id="sky-shadow" filterUnits="userSpaceOnUse" x="0" y="0" width="${s.width}" height="${s.height}" color-interpolation-filters="sRGB">
<feMorphology in="SourceAlpha" operator="dilate" radius="${t.width*.018}" result="spread"/>
<feGaussianBlur in="spread" stdDeviation="${t.width*.035}" result="feather"/>
<feFlood flood-color="#20121d" flood-opacity=".65" result="ink"/>
<feComposite in="ink" in2="feather" operator="in"/>
</filter></defs>
${artwork ? `<g id="artwork" inkscape:groupmode="layer" inkscape:label="Text-free artwork"><image width="${s.width}" height="${s.height}" href="data:image/png;base64,${art}"/></g>` : ''}
<g id="sky-shading" inkscape:groupmode="layer" inkscape:label="Diffuse sky darkening" filter="url(#sky-shadow)"><image x="${t.x}" y="${t.y}" width="${t.width}" height="${height}" href="data:image/png;base64,${title}"/></g>
<g id="title" inkscape:groupmode="layer" inkscape:label="Generated alpha lettering"><image x="${t.x}" y="${t.y}" width="${t.width}" height="${height}" href="data:image/png;base64,${title}"/></g></svg>`;
  await fs.writeFile(here+`cover-${name}.svg`, svg(true));
  await fs.writeFile(here+`title-${name}.svg`, svg(false));
}
const server = await serve(here), browser = await launch();
try {
  const page = await browser.newPage({deviceScaleFactor:1});
  await page.goto(server.url);
  const alpha = await page.evaluate(async () => {
    const image = new Image(); image.src = 'title-alpha-master.png'; await image.decode();
    const c = document.createElement('canvas'); c.width=image.width; c.height=image.height;
    const x=c.getContext('2d'); x.drawImage(image,0,0); const data=x.getImageData(0,0,c.width,c.height).data;
    let transparent=0, visible=0; for(let i=3;i<data.length;i+=4) {if(data[i]===0) transparent++; if(data[i]>128) visible++;}
    return {transparent,visible,pixels:c.width*c.height};
  });
  if (alpha.transparent < alpha.pixels*.25 || !alpha.visible) throw Error('Title has unusable alpha');
  console.log('Native alpha verified:',JSON.stringify(alpha));
  for (const name of ['landscape','portrait','square']) {
    const s=layouts[name]; await page.setViewportSize({width:s.width,height:s.height});
    for(const kind of ['cover','title']) {
      await page.goto(server.url+`/${kind}-${name}.svg`);
      await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('image')].map(el=>new Promise((resolve,reject)=>{const im=new Image();im.onload=resolve;im.onerror=reject;im.src=el.getAttribute('href');})));});
      await page.screenshot({path:here+`${kind}-${name}-${s.width}x${s.height}.png`,omitBackground:true});
    }
  }
} finally {await browser.close();server.close();}
