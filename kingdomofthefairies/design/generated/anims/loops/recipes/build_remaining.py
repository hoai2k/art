"""Offline painted-puppet loops; no independently generated image frames."""
from pathlib import Path
import json,math,subprocess
import numpy as np
from scipy.ndimage import map_coordinates,label
from PIL import Image,ImageOps,ImageDraw
import imageio_ffmpeg
ROOT=Path('/private/tmp/widowsbay-animation-work')
GAME=Path('/Volumes/BACKUP/Backup/Games/mini/widowsbay')
OUT=ROOT/'delivery'
JOBS=[
 ('anim-reveller-yellow','reveller-yellow',220,420,18,2,'dance'),
 ('anim-reveller-shaggy','reveller-shaggy',260,440,16,2,'dance'),
 ('anim-reveller-jester','reveller-jester',220,420,18,2,'dance'),
 ('anim-sea-spirit','sea-spirit',240,480,18,2.5,'spirit'),
 ('anim-witch-wand','witch-stand',260,420,14,1.2,'wand'),
 ('anim-pageant-dancers','pageant-dancers',600,262,12,2,'pageant'),
 ('anim-sea-dragon','sea-dragon',400,160,24,2,'dragon'),
 ('anim-jellyfish','jellyfish',180,280,18,1.5,'jelly')]

def save(ident,frames,meta,notes):
 out=OUT/ident;out.mkdir(parents=True,exist_ok=True)
 fw,fh=frames[0].size;n=len(frames);cols=6;rows=math.ceil(n/cols)
 sheet=Image.new('RGBA',(cols*fw,rows*fh));contact=Image.new('RGB',(cols*fw,rows*(fh+22)),'#999');draw=ImageDraw.Draw(contact)
 previews=[]
 for i,im in enumerate(frames):
  x=i%cols*fw;y=i//cols*fh;sheet.paste(im,(x,y));contact.paste(im,(x,i//cols*(fh+22)+22),im);draw.text((x+3,i//cols*(fh+22)+3),str(i),fill='black')
  bg=Image.new('RGB',(fw,fh),'#999');bg.paste(im,(0,0),im);previews.append(bg)
 sheet.save(out/'sheet.webp',quality=90,method=6,exact=True);contact.save(out/'contact.jpg')
 meta.update(id=ident,frameW=fw,frameH=fh,frames=n,cols=cols,decodedBytes=sheet.width*sheet.height*4,bytes=(out/'sheet.webp').stat().st_size)
 (out/'meta.json').write_text(json.dumps(meta,indent=2)+'\n');(out/'notes.txt').write_text(notes+'\n')
 ms=round(1000*meta['duration']/n);previews[0].save(out/'preview.gif',save_all=True,append_images=previews[1:],duration=ms,loop=0 if meta['loop']!='once' else 1,disposal=2)
 rgb=out/'rendered-source';rgb.mkdir(exist_ok=True)
 for i,im in enumerate(previews):im.save(rgb/(f'{i:04d}.png'))
 subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-framerate',str(n/meta['duration']),'-i',str(rgb/'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-y',str(out/'source.mp4')],check=True)
 for p in rgb.iterdir():p.unlink()
 rgb.rmdir()
 print(ident,n,'frames',meta['bytes'],'bytes',meta['decodedBytes'],'decoded',flush=True)

for ident,artid,w,h,n,length,kind in JOBS:
 source=Image.open(GAME/'assets'/(artid+'.webp')).convert('RGBA')
 base=Image.new('RGBA',(w,h));art=ImageOps.contain(source,(w-16,h-16),Image.Resampling.LANCZOS);base.paste(art,((w-art.width)//2,h-8-art.height))
 out=OUT/ident;out.mkdir(parents=True,exist_ok=True);source.save(out/'source.png')
 data=np.array(base,dtype=np.float32)/255;data[:,:,:3]*=data[:,:,3,None]
 yy,xx=np.mgrid[:h,:w].astype(np.float32);v=yy/h;u=xx/w
 frames=[]
 duration=length*60/76.5 if kind in ['dance','pageant'] else length
 for frame in range(n):
  phase=2*math.pi*frame/n;dx=np.zeros_like(xx);dy=np.zeros_like(yy)
  if kind=='dance':
   dx=7*np.sin(phase)*(1-v)**1.5
   # Distal sleeves and the raised knee move counter to the torso.
   dx+=5*np.sin(phase+np.pi)*np.exp(-((v-.35)/.19)**2)*(2*u-1)
   dy=5*np.sin(phase*2)*np.sin(np.pi*v)**2
  elif kind=='spirit':
   dx=5*np.sin(phase+v*3)*np.sin(np.pi*v)
   dy=4*np.sin(phase)*np.sin(np.pi*v)
  elif kind=='dragon':
   dy=6*np.sin(phase-u*2*np.pi)*(0.35+0.65*u)
   dx=2*np.cos(phase+u*2*np.pi)
  elif kind=='jelly':
   bell=np.exp(-((v-.24)/.20)**2)
   dx=(xx-w/2)*.065*np.sin(phase)*bell
   dx+=5*np.sin(phase-v*5)*np.clip((v-.3)/.7,0,1)
   dy=3*np.sin(phase)*bell
  elif kind=='pageant':
   # Independent phase per painted dancer; keep the common floor fixed.
   lane=np.floor(u*6);p=phase+lane*np.pi/3
   dx=4*np.sin(p)*(1-v)
   dy=6*np.sin(p)*np.sin(np.pi*v)**2
  elif kind=='wand':
   progress=frame/(n-1);raise_angle=-.55*(.5-.5*np.cos(np.pi*progress))
   raise_angle+=.10*np.sin(progress*4*np.pi)*np.sin(np.pi*progress)
   px,py=w*.69,h*.46;rx,ry=xx-px,yy-py
   strength=np.clip((u-.52)/.22,0,1)*np.exp(-((v-.48)/.28)**4)
   angle=-raise_angle*strength
   dx=rx*np.cos(angle)-ry*np.sin(angle)-rx
   dy=rx*np.sin(angle)+ry*np.cos(angle)-ry
  coords=[yy+dy,xx+dx]
  warped=np.stack([map_coordinates(data[:,:,c],coords,order=1,mode='constant',cval=0) for c in range(4)],axis=-1)
  alpha=warped[:,:,3];warped[:,:,:3]/=np.maximum(alpha[:,:,None],1e-6)
  frames.append(Image.fromarray(np.uint8(np.clip(warped,0,1)*255),'RGBA'))
 meta=dict(fps=n/duration,duration=duration,loop='once' if kind=='wand' else 'loop',anchor='centre' if kind=='spirit' else 'bottom centre',method='painted-puppet deformation',source='assets/'+artid+'.webp',rig=kind)
 if kind in ['dance','pageant']:meta.update(beats=length,bpm=76.5)
 notes='Method: continuous deformation of the existing painted cut-out; not rotoscoped footage and not AI-generated video. No frames were independently redrawn. Source art: assets/'+artid+'.webp.\nMotion: '+kind+'. Frames sampled around a periodic deformation (except the one-shot wand gesture). Premultiplied-alpha resampling prevents dark fringes. Frame dimensions balance legibility with the ~8 MB decoded-sheet target; larger sprites have lower spatial resolution than the still artwork.\nsource.mp4 is the offline puppet renderer output on a grey preview background; source.png preserves the original still.'
 save(ident,frames,meta,notes)

# Isolate the same central bearded performer from the verified trio track.
frames=[]
files=sorted((ROOT/'band-pilot-cutouts').glob('*.png'))[:10]
for p in files:
 im=Image.open(p).convert('RGBA').crop((350,350,560,720));a=np.array(im.getchannel('A'))
 labels,count=label(a>64);sizes=np.bincount(labels.ravel());sizes[0]=0;keep=labels==sizes.argmax();a[~keep]=0
 grey=ImageOps.grayscale(im);im=Image.merge('RGBA',(grey,grey,grey,Image.fromarray(a)))
 base=Image.new('RGBA',(240,440));art=ImageOps.contain(im,(232,432));base.paste(art,((240-art.width)//2,440-art.height-4));frames.append(base)
frames+=frames[-2:0:-1]
save('anim-band-giant',frames,dict(fps=12,duration=2*60/76.5,beats=2,bpm=76.5,loop='loop',anchor='bottom centre',method='tracked music-video footage',source='music video 38.3–39.05 s',sourceUrl='https://www.youtube.com/watch?v=7zoGfdN4dgE',closure='ping-pong return encoded'),
     'Same central bearded performer as the trio pilot, isolated from its tracked masks. Source is 38.3–39.05 seconds, not the approximate 2:55 scene in the request. Monochrome; no invented performance. Natural photographic softness remains. Full-size giant stage rendering upsamples this compact pilot sheet.')
import shutil
shutil.copy2(OUT/'anim-band-play/source.mp4',OUT/'anim-band-giant/source.mp4')
