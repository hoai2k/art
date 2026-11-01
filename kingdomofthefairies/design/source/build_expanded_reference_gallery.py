"""Rebuild the source-film reference gallery from its saved prompt manifest."""
import html
import json
from pathlib import Path

folder = Path(__file__).resolve().parents[1] / 'references' / 'expanded-world'
data = json.loads((folder / 'prompts.json').read_text())
esc = html.escape
cards = []
links = []
for item in data['images']:
    source_images = []
    for stamp, filename in zip(item['frames'], item['source_frames']):
        minutes, seconds = stamp.split('m')
        label = f'{int(minutes)}:{seconds.removesuffix("s")}'
        source_images.append(f'<figure><a href="{esc(filename)}"><img loading="lazy" src="{esc(filename)}" alt="Source film at {label}"></a><figcaption>Full film {label}</figcaption></figure>')
    cards.append(f'<article id="{esc(item["id"])}"><h2>{esc(item["title"])}</h2><p>{esc(item["note"])}</p><a href="{esc(item["file"])}"><img class="generated" loading="lazy" src="{esc(item["file"])}" alt="Generated {esc(item["title"])} reference"></a><h3>Input frames</h3><div class="inputs">{"".join(source_images)}</div><details><summary>Generation prompt</summary><p>{esc(item["prompt"])}</p></details></article>')
    links.append(f'- [{item["title"]}]({item["file"]}) — {item["note"]}')

intro = 'Primary visual references for the full film direction. Aurora is the helpful fairy; the hooded witch is a separate antagonist. Pair these images with the complete film story and the new journey sheet. The following notes preserve the original commission provenance. Nine companion illustrations informed by frames from the full 1903 film. Eight explore subjects or actions beyond the sampled music-video sequence; the armoury is a bonus deeper study of a setting already glimpsed in the edit. These are interpreted worldbuilding references, with invented details identified below.'
page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kingdom of the Fairies — Film world references</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f6efe2;color:#2a1424;font:17px/1.6 Georgia,serif}main{max-width:1120px;margin:auto;padding:36px 24px}h1{font-size:clamp(30px,5vw,52px);line-height:1.1}h2{font-size:30px}a{color:#8e1730}nav{display:flex;gap:20px;flex-wrap:wrap}article{margin:44px 0;padding-top:20px;border-top:1px solid #c9b89f}.generated{display:block;width:100%;height:auto}.inputs{display:flex;gap:16px;flex-wrap:wrap}figure{margin:0;flex:1;min-width:240px;max-width:480px}figure img{width:100%;height:auto}figcaption{font-size:14px}details{margin-top:18px}summary{cursor:pointer}details p{font:14px/1.6 system-ui,sans-serif}footer{margin:36px 0;font-size:14px}
</style></head><body><main>'''
page += f'<h1>Kingdom of the Fairies — Film world references</h1><p>{intro}</p><nav><a href="../../film-story.md">Complete film story</a><a href="{esc(data["source_url"])}">Full source film</a><a href="prompts.json">Prompts and provenance</a></nav>'
page += ''.join(cards)
page += '<footer>Source timestamps refer to the 16:33 Wikimedia Commons copy. Inputs are browser captures, not original-resolution frame exports; white timestamp boxes belong to the player. Built-in imagegen created all nine final illustrations. The source film and generated adaptations remain distinct from the song’s narrative.</footer></main></body></html>'
(folder / 'index.html').write_text(page)
readme = '# Kingdom of the Fairies — film world references\n\n' + intro + '\n\n'
readme += '[Open the gallery](index.html), [view the source film](' + data['source_url'] + '), or read [the complete prompt set](prompts.json). Generated with built-in imagegen, using the cropped browser frames in `source-frames/`. Full browser captures are retained beside them. Times belong to the 16:33 copy and may differ in other releases.\n\n'
readme += 'The full film adds an abduction, a forbidden castle vision, the fairy’s arming gesture and an approach across a sea moat to the voyage imagery. The antagonist’s hood and the red/teal stage servants offer useful silhouettes. Heraldic stonework, weapon racks and painted night skies extend the same theatrical visual vocabulary. This does not establish the identities or motives of the song’s sea witch and beloved.\n\n'
readme += '\n'.join(links) + '\n'
(folder / 'README.md').write_text(readme)
print(f'Built gallery and provenance notes for {len(cards)} images.')
