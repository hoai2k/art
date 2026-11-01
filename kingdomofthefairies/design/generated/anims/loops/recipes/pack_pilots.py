from pathlib import Path
import json, math, subprocess, hashlib
import numpy as np
from scipy import ndimage
from PIL import Image,ImageOps,ImageDraw
import imageio_ffmpeg

ROOT=Path('/private/tmp/widowsbay-animation-work')
OUT=ROOT/'delivery';OUT.mkdir(exist_ok=True)
BPM=76.5
jobs=[dict(id='anim-band-play',frames='band-pilot-cutouts',width=420,height=200,beats=4,
           count=13,monochrome=True,start=38.3,source='music-video.mp4',url='https://www.youtube.com/watch?v=7zoGfdN4dgE',
           note='Band performance insert. Three separate SAM 2 object tracks combined; monochrome. 24 displayed frames sampled from 19 source frames, ping-pong order. The source sequence is reversed on the return half to close the loop. Frame box is 2× the 210-pixel Act I band width; transparent padding is trimmed vertically. Tempo-locked playback is 7.65 displayed frames/s to keep the decoded sheet near 8 MB.'),
      dict(id='anim-reveller-lady',frames='lady-pilot-cutouts',width=220,height=420,beats=2,
           count=10,monochrome=False,start=329.9,source='kingdom.webm',url='https://commons.wikimedia.org/wiki/File:Le_Royaume_des_f%C3%A9es_(1903).webm',
           note='Pink-clad court performer from the armoury scene, used as a lady-reveller pilot. This is a small hand flourish and sway, not a full dance routine. Original film tint retained. 18 displayed frames, ping-pong return, stable skirt/feet anchor. Judge the footage costume beside the existing painted sprite before broader rollout.')]

for job in jobs:
 ident=job['id'];out=OUT/ident;out.mkdir(exist_ok=True)
 files=sorted((ROOT/job['frames']).glob('*.png'));frames=[];anchor=None
 for p in files:
  im=Image.open(p).convert('RGBA');a=np.array(im.getchannel('A'))
  labels,n=ndimage.label(a>64);sizes=np.bincount(labels.ravel());small=sizes<48;small[0]=False
  a[small[labels]]=0
  if not job['monochrome']:
   sizes[0]=0;a[labels!=sizes.argmax()]=0
  ys,xs=np.where(a>160);floor=int(np.percentile(ys,99.5))
  footx=int(np.median(xs[ys>=np.percentile(ys,96)]))
  if anchor is None:anchor=(footx,floor)
  # Source camera is fixed; only the solo performer is centred by its feet.
  dx=anchor[0]-footx if not job['monochrome'] else 0
  dy=anchor[1]-floor
  if job['monochrome']:
   grey=ImageOps.grayscale(im);im=Image.merge('RGBA',(grey,grey,grey,Image.fromarray(a)))
  else:im.putalpha(Image.fromarray(a))
  aligned=Image.new('RGBA',im.size);aligned.paste(im,(dx,dy));frames.append(aligned)
 boxes=[im.getchannel('A').point(lambda v:255 if v>=8 else 0).getbbox() for im in frames]
 box=(max(0,min(b[0] for b in boxes)-4),max(0,min(b[1] for b in boxes)-4),
      min(frames[0].width,max(b[2] for b in boxes)+4),min(frames[0].height,max(b[3] for b in boxes)+4))
 fw,fh=job['width'],job['height'];sized=[]
 for im in frames:
  art=ImageOps.contain(im.crop(box),(fw-4,fh-4),Image.Resampling.LANCZOS)
  canvas=Image.new('RGBA',(fw,fh));canvas.paste(art,((fw-art.width)//2,fh-2-art.height));sized.append(canvas)
 selected=np.linspace(0,len(sized)-1,job['count']).round().astype(int).tolist()
 order=selected+selected[-2:0:-1];loop=[sized[i] for i in order]
 cols=6;rows=math.ceil(len(loop)/cols);sheet=Image.new('RGBA',(cols*fw,rows*fh))
 contact=Image.new('RGB',(cols*fw,rows*(fh+25)),'#999');d=ImageDraw.Draw(contact)
 preview=[]
 for i,im in enumerate(loop):
  x=i%cols*fw;y=i//cols*fh;sheet.paste(im,(x,y))
  cy=i//cols*(fh+25);contact.paste(im,(x,cy+25),im);d.text((x+5,cy+5),str(i),fill='black')
  pr=Image.new('RGB',(fw,fh),'#999');pr.paste(im,(0,0),im);preview.append(pr)
 sheet.save(out/'sheet.webp',quality=90,method=6,exact=True)
 contact.save(out/'contact.jpg',quality=92)
 duration=job['beats']*60/BPM
 preview[0].save(out/'preview.gif',save_all=True,append_images=preview[1:],duration=round(1000*duration/len(loop)),loop=0,disposal=2)
 metadata=dict(id=ident,frameW=fw,frameH=fh,frames=len(loop),cols=cols,fps=12,beats=job['beats'],bpm=BPM,
               loop='loop',anchor='bottom centre',source=job['url'],sourceStart=job['start'],sourceEnd=job['start']+(len(files)-1)/12,
               sourceFps=12,frameOrder=order,closure='ping-pong, endpoints not repeated',sourceCrop=list(box),
               monochrome=job['monochrome'],decodedBytes=sheet.width*sheet.height*4,bytes=(out/'sheet.webp').stat().st_size)
 (out/'meta.json').write_text(json.dumps(metadata,indent=2)+'\n')
 # Packet copy preserves the source video samples; adds roughly 1 s each side.
 f=imageio_ffmpeg.get_ffmpeg_exe()
 subprocess.run([f,'-hide_banner','-loglevel','error','-ss',str(job['start']-1),'-i',str(ROOT/job['source']),
                 '-t',str((len(files)-1)/12+2),'-an','-c:v','copy','-y',str(out/'source.mp4')],check=True)
 notes=job['note']+'\nSource: '+job['url']+'\nOriginal timestamps: '+str(job['start'])+'–'+str(metadata['sourceEnd'])+' seconds.\n'+\
       'source.mp4 is a video-packet copy with approximately one second of context either side; source frames were extracted at 12 fps.\n'+\
       'Masks: SAM 2.1 Hiera Tiny; selection points retained in tracking.json. Tiny detached specks removed, alpha edge softened 0.45 source pixels.\n'+\
       'Loop duration: '+str(duration)+' seconds at 76.5 BPM. Stored sequence already includes the return half.\n'
 (out/'notes.txt').write_text(notes)
 (out/'tracking.json').write_text((ROOT/job['frames']/'tracking.json').read_text())
 print(ident,metadata['frames'],'frames',metadata['bytes'],'bytes',metadata['decodedBytes'],'decoded',flush=True)
