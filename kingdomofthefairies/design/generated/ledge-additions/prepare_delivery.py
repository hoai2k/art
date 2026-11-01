from pathlib import Path
import json,math
import numpy as np
from PIL import Image,ImageOps,ImageDraw
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'delivery';OUT.mkdir(exist_ok=True)
records=[];sheet=Image.new('RGB',(1200,650),'#d0c5b8');draw=ImageDraw.Draw(sheet)
for index,job in enumerate(json.loads((ROOT/'requests.json').read_text())):
 ident=job['id'];r=json.loads((ROOT/'records'/(ident+'.json')).read_text());raw=Image.open(ROOT/'originals'/(ident+'.png')).convert('RGBA')
 assert raw.getchannel('A').getextrema()[0]==0
 w,h=r['width'],r['height'];bbox=raw.getchannel('A').point(lambda v:255 if v>=32 else 0).getbbox()
 source_anchor=None;crop=[0,0,*raw.size]
 if ident=='clam-open-empty':
  final=raw.resize((w,h),Image.Resampling.LANCZOS)
  ref=Image.open(ROOT/'references/clam-open.png').convert('RGBA')
  ref_bottom=ref.getchannel('A').point(lambda v:255 if v>=32 else 0).getbbox()[3]
  bottom=final.getchannel('A').point(lambda v:255 if v>=32 else 0).getbbox()[3]
  y=ref_bottom-bottom;x=0;art=final;final=Image.new('RGBA',(w,h));final.paste(art,(x,y))
 else:
  a=np.array(raw.getchannel('A'));crop=list(bbox);left,top,right,bottom=bbox;art=raw.crop(bbox)
  if ident=='sailor-hang':
   ys,xs=np.where(a[top:top+max(3,round(raw.height*.01))]>128)
   hands=float(np.median(xs));scale=min(h/(bottom-top),w/(2*max(hands-left,right-hands)))
   size=(round(art.width*scale),round(art.height*scale));art=art.resize(size,Image.Resampling.LANCZOS)
   x=round(w/2-(hands-left)*scale);y=0;source_anchor=[hands,top];target_anchor=[w/2,0]
  else:
   # Measured palm and knee contact in the selected source image. Preserve
   # proportions; pad the canvas so the complete dangling boot remains visible.
   contact=947;target=h*.75;scale=min((h-target-1)/(bottom-contact),w/(right-left),target/(contact-top))
   size=(round(art.width*scale),round(art.height*scale));art=art.resize(size,Image.Resampling.LANCZOS)
   x=(w-art.width)//2;y=round(target-(contact-top)*scale)
   source_anchor=[(left+right)/2,contact];target_anchor=[w/2,target]
  final=Image.new('RGBA',(w,h));final.paste(art,(x,y));r['targetAnchor']=target_anchor
 final.save(OUT/(ident+'.png'),optimize=True)
 assert final.size==(w,h) and final.getchannel('A').getextrema()==(0,255)
 r.update(originalSize=list(raw.size),sourceCrop=crop,sourceAnchor=source_anchor,placement=[x,y,*art.size],file='intake/'+ident+'.png',original='design/generated/ledge-additions/originals/'+ident+'.png')
 records.append(r)
 th=ImageOps.contain(final,(360,560),Image.Resampling.LANCZOS);px=index*400+(400-th.width)//2;py=50+(560-th.height)//2
 sheet.paste(th,(px,py),th);draw.text((index*400+12,10),ident,fill='#2a1424')
 if ident=='sailor-pullup':
  line=py+225/h*th.height;draw.line((index*400+12,line,index*400+385,line),fill='#a3323c',width=2);draw.text((index*400+12,line+3),'75% contact line (preview only)',fill='#a3323c')
(OUT/'prompts.json').write_text(json.dumps({'requested':3,'generated':3,'images':records},indent=2)+'\n')
sheet.save(ROOT/'review.jpg');print('Prepared three images with explicit hand/contact anchors')
