from pathlib import Path
import json,shutil,hashlib,difflib
ROOT=Path('/private/tmp/widowsbay-animation-work')
GAME=Path('/Volumes/BACKUP/Backup/Games/mini/widowsbay')
REVIEW=GAME/'design/generated/anims/loops'
REVIEW.mkdir(parents=True,exist_ok=True)
for rel,digest in json.loads((ROOT/'base-hashes.json').read_text()).items():
 assert hashlib.sha256((GAME/rel).read_bytes()).hexdigest()==digest,rel+' changed concurrently'
(GAME/'assets/anims').mkdir(exist_ok=True)
manifest=json.loads((GAME/'assets/manifest.json').read_text());manifest.setdefault('anims',{})
records=[]
for source in sorted((ROOT/'delivery').iterdir()):
 if not source.is_dir():continue
 ident=source.name;meta=json.loads((source/'meta.json').read_text());record=dict(meta)
 method=meta.get('method','tracked footage');record['method']=method;records.append(record)
 shutil.copy2(source/'sheet.webp',GAME/'assets/anims'/(ident+'.webp'))
 (GAME/'assets/anims'/(ident+'.json')).write_text(json.dumps(meta,indent=2)+'\n')
 review=REVIEW/ident;review.mkdir(exist_ok=True)
 for path in source.iterdir():
  if path.is_file():shutil.copy2(path,review/path.name)
 intake=GAME/'intake/anims'/ident;intake.mkdir(parents=True,exist_ok=True)
 for name in ['source.mp4','notes.txt','meta.json']:
  shutil.copy2(source/name,intake/name)
 if (source/'source.png').exists():shutil.copy2(source/'source.png',intake/'source.png')
 manifest['anims'][ident]={'status':'delivered','file':'anims/'+ident+'.webp','meta':'anims/'+ident+'.json','method':method}
(GAME/'assets/manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
modified=['src/animation.js','src/art.js','src/acts/act1-art.js','src/acts/act2-art.js','src/acts/act5-art.js','qa/animation.test.mjs']
patches=[]
for rel in modified:
 p=ROOT/'project'/rel;dst=GAME/rel
 before=dst.read_text() if dst.exists() else ''
 after=p.read_text();patches.extend(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile=rel,tofile=rel))
 dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(after)
(REVIEW/'game-changes.patch').write_text(''.join(patches))
(REVIEW/'manifest.json').write_text(json.dumps({'count':len(records),'assets':records},indent=2)+'\n')
shutil.copy2(ROOT/'validation.json',REVIEW/'validation.json')
(REVIEW/'recipes').mkdir(exist_ok=True)
for name in ['segment_pilots.py','segment_pageant.py','pack_pilots.py','build_remaining.py']:
 shutil.copy2(ROOT/name,REVIEW/'recipes'/name)
cards=[]
for r in records:
 ident=r['id'];period=r.get('duration',r.get('beats',0)*60/r.get('bpm',76.5))
 cards.append(f'<article data-id="{ident}"><h2>{ident}</h2><p>{r["method"]}</p><canvas width="{r["frameW"]}" height="{r["frameH"]}"></canvas><p>{r["frames"]} frames · {period:.3f} s · {r["bytes"]//1024} KiB WebP</p><p><a href="{ident}/contact.jpg">Every frame</a> · <a href="{ident}/notes.txt">Source and method notes</a> · <a href="{ident}/source.mp4">Source video</a></p></article>')
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Widow’s Bay · animation loops</title><style>body{margin:0;background:#2a1424;color:#f3c6dc;font:16px/1.5 system-ui}header,main{max-width:1440px;margin:auto;padding:28px}h1,h2{font-family:Georgia}h2{font-size:22px}a{color:#d9b34a}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}article{padding:18px;border:1px solid #675044;border-radius:8px}canvas{display:block;width:100%;height:300px;object-fit:contain;background-color:#999;background-image:conic-gradient(#aaa 25%,transparent 0 50%,#aaa 0 75%,transparent 0);background-size:24px 24px}button,select{font:inherit;padding:8px}</style><header><h1>Widow’s Bay · eleven motion assets</h1><p>Three tracked-footage loops and eight painted-puppet animations. No Runway or image-to-video service was used. Painted loops preserve the existing artwork with continuous deformation; they are not independently redrawn frames.</p><p>The footage lady is a hand flourish and sway, rather than a full dance. The giant retains the photographic softness of the source video. Each asset’s notes disclose its source and spatial/temporal sampling.</p><label>Playback <select id="speed"><option value="1">1×</option><option value=".25">0.25×</option></select></label> <button id="pause">Pause</button> <button id="restart">Restart, including the wand gesture</button><p><a href="manifest.json">Metadata</a> · <a href="validation.json">Asset checks</a> · <a href="../../../../?qa">Game</a></p></header><main>CARDS</main><script type="module">import{animationFrame}from'../../../../src/animation.js';const specs=await(await fetch('manifest.json')).json();const records=[];for(const meta of specs.assets){const im=new Image();im.src=meta.id+'/sheet.webp';await im.decode();records.push({meta,im,canvas:document.querySelector('[data-id="'+meta.id+'"] canvas')})}let clock=0,last=performance.now(),paused=false;document.querySelector('#pause').onclick=e=>{paused=!paused;e.target.textContent=paused?'Play':'Pause'};document.querySelector('#restart').onclick=()=>clock=0;function draw(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(!paused)clock+=dt*Number(document.querySelector('#speed').value);for(const{meta,im,canvas}of records){const f=animationFrame(meta,clock),c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(im,f.sx,f.sy,f.sw,f.sh,0,0,canvas.width,canvas.height)}window.loopReview={ready:true,clock,frames:records.map(r=>({id:r.meta.id,index:animationFrame(r.meta,clock).index}))};requestAnimationFrame(draw)}requestAnimationFrame(draw);</script></html>'''
(REVIEW/'index.html').write_text(page.replace('CARDS','\n'.join(cards)))
doc=GAME/'design/image-requests.md';s=doc.read_text()
s=s.replace('steps\n  to prepare each one for the game. Requested; none delivered yet.','steps\n  to prepare each one for the game. Eleven motion assets are delivered; see\n  [the animation gallery](generated/anims/loops/index.html).',1)
s=s.replace('## Part D — animation loops (requested, not yet built)','## Part D — animation loops (delivered, 6 October 2026)',1)
s=s.replace('The game has no animation player yet. When the first loop arrives, the shell\ngets a small `kit.anim(id, t, cx, bottomY, w, h)` helper. It picks a frame by\ntime (or by the song\'s beat for `beat` loops), and each act falls back to its\nstill sprite when a loop is missing.', 'The shell now has `kit.anim(id, t, cx, bottomY, w, h)`, with musical-period\ntiming, preserved frame aspect ratios and still-art fallback for missing or\ninvalid sheets. The initial deliveries include both footage loops and painted\npuppet alternatives, following the user’s request to avoid Runway.',1)
s=s.replace('All of Part D is requested. None is delivered, and the animation helper is\nnot built yet: it will be built with the first delivered loop (the pilot).','All eleven Part D motion assets are delivered and registered in the manifest.\nThree are tracked footage (the band, the isolated bearded performer, and a\npink-clad lady’s hand flourish); eight are continuously deformed painted\ncut-outs. These painted alternatives were built offline, without an\nimage-to-video service or independent frame generation. The pageant footage\nmatte was rejected because it lost costume sections.\n\nSee the [review gallery](generated/anims/loops/index.html) at 1× and 0.25×,\nincluding every-frame contact sheets, source clips and method notes. The lady\nis a gesture/sway pilot rather than a full dance, and the giant is soft at\nlarge display sizes. Sheets target roughly 8 MB decoded and remain below\n1.5 MB WebP. Larger painted groups reduce spatial resolution to meet that\nbudget. The offline preparation checkpoint remains preserved separately.',1)
doc.write_text(s)
print('Installed eleven sheets, player, act hooks and animation review gallery')
