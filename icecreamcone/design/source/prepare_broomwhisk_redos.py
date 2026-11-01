from pathlib import Path
from PIL import Image
import cv2, numpy as np, json

root=Path(__file__).resolve().parents[3]
out=root/'local/broomwhisk-review'
out.mkdir(parents=True,exist_ok=True)
sources=[(str(root/'icecreamcone/design/references/broomwhisk-redo/originals/IC-M06f.png'),2,'sweep'),(str(root/'icecreamcone/design/references/broomwhisk-redo/originals/IC-M06g.png'),3,'poses')]
metadata=[]
for path,count,name in sources:
    image=Image.open(path).convert('RGBA'); a=np.array(image)
    n,labels,stats,centres=cv2.connectedComponentsWithStats((a[:,:,3]>32).astype('uint8'))
    ids=sorted(sorted(range(1,n),key=lambda i:stats[i,4],reverse=True)[:count],key=lambda i:centres[i,0])
    for index,cid in enumerate(ids):
        main=labels==cid
        # Include detached bristles with the nearest whole bird, and retain antialiasing.
        for small in range(1,n):
            if small in ids or stats[small,4]<8: continue
            nearest=min(ids,key=lambda k:np.linalg.norm(centres[small]-centres[k]))
            if nearest==cid: main|=labels==small
        keep=cv2.dilate(main.astype('uint8'),np.ones((5,5),np.uint8))>0
        cut=a.copy();cut[:,:,3]=np.where(keep,cut[:,:,3],0)
        im=Image.fromarray(cut); box=im.getbbox(); im=im.crop(box)
        scale=min(960/im.width,960/im.height)
        im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
        canvas=Image.new('RGBA',(1024,1024))
        x=(1024-im.width)//2;y=990-im.height
        canvas.alpha_composite(im,(x,y));canvas.save(out/f'{name}-{index}.png')
        metadata.append(dict(sheet=name,cell=index,source=path,source_crop=list(box),fit_scale=scale,feet=990,fx=512))
(out/'preparation.json').write_text(json.dumps(metadata,indent=2)+'\n')

# SIFT/ORB head and binding measurements determine one uniform scale per pose.
scales={'sweep':[1.136,1.142],'poses':[1.026,1.083,1.146]}
placements=[]
for sheet,painted in scales.items():
    atlas=Image.new('RGBA',(1024*len(painted),1024))
    for index,scale in enumerate(painted):
        im=Image.open(out/f'{sheet}-{index}.png').convert('RGBA')
        im=im.crop(im.getbbox())
        im=im.resize((round(im.width/scale),round(im.height/scale)),Image.Resampling.LANCZOS)
        x=(1024-im.width)//2;y=990-im.height
        atlas.alpha_composite(im,(index*1024+x,y))
        a=np.array(im)[:,:,3];ys,xs=np.where(a>128);lowest=int(ys.max());foot=xs[ys>=lowest-12]
        placements.append(dict(sheet=sheet,cell=index,fx=round(x+(int(foot.min())+int(foot.max()))/2),feet=y+lowest,painted=1,normalization_scale=scale))
    atlas.save(root/f'icecreamcone/game/assets/sprites/broomwhisk-{sheet}.png',optimize=True)
folder=root/'icecreamcone/design/references/broomwhisk-redo'
(folder/'placement.json').write_text(json.dumps(placements,indent=2)+'\n')
print(json.dumps(placements))
