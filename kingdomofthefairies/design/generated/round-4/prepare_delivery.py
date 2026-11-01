from pathlib import Path
import json,html,math
from PIL import Image,ImageOps,ImageDraw
ROOT=Path(__file__).resolve().parent
JOBS=json.loads((ROOT/'requests.json').read_text())
OUT=ROOT/'delivery';OUT.mkdir(exist_ok=True)
records=[]
def bounds(im):return im.getchannel('A').point(lambda v:255 if v>=32 else 0).getbbox()
for job in JOBS:
 recipe=ROOT/'records'/(job['id']+'.json')
 if not recipe.exists():continue
 record=json.loads(recipe.read_text());raw=Image.open(ROOT/'originals'/(job['id']+'.png')).convert('RGBA')
 assert raw.getchannel('A').getextrema()[0]==0,job['id']
 ref=Image.open(ROOT/'references'/(job['base']+'.png')).convert('RGBA')
 rb=bounds(ref);bbox=bounds(raw)
 # Retain the supplied canvas framing. Cropping to changing arm bounds would
 # zoom a lowered-arm pose and make its head jump. Only snap the floor line.
 art=raw.resize((job['width'],job['height']),Image.Resampling.LANCZOS)
 painted=bounds(art);x=0;y=rb[3]-painted[3]
 final=Image.new('RGBA',(job['width'],job['height']));final.paste(art,(x,y))
 assert final.getchannel('A').getextrema()==(0,255),job['id']
 final.save(OUT/(job['id']+'.png'),optimize=True)
 record.update(file='intake/'+job['id']+'.png',original='design/generated/round-4/originals/'+job['id']+'.png',originalSize=list(raw.size),sourceCrop=[0,0,*raw.size],paintedBounds=list(bbox),referenceBounds=list(rb),placement=[x,y,*art.size])
 records.append(record)
(OUT/'prompts.json').write_text(json.dumps({'requested':18,'generated':len(records),'images':records},indent=2)+'\n')
groups=[base for base in dict.fromkeys(j['base'] for j in JOBS) if all((OUT/(base+'-idle-'+s+'.png')).exists() for s in ['b','c'])]
for part in range(math.ceil(len(groups)/3)):
 sheet=Image.new('RGB',(1500,1200),'#d0c5b8');draw=ImageDraw.Draw(sheet)
 for row,base in enumerate(groups[part*3:part*3+3]):
  for col,p in enumerate([ROOT/'references'/(base+'.png'),OUT/(base+'-idle-b.png'),OUT/(base+'-idle-c.png')]):
   im=Image.open(p).convert('RGBA');th=ImageOps.contain(im,(475,355),Image.Resampling.LANCZOS);x=col*500+(500-th.width)//2;y=row*400+35+(355-th.height)//2
   sheet.paste(th,(x,y),th);draw.text((col*500+10,row*400+10),base+' · '+['A','B','C'][col],fill='#2a1424')
 sheet.save(ROOT/('review-'+str(part+1)+'.jpg'))
print('Prepared',len(records),'/18; complete pairs',len(groups))
