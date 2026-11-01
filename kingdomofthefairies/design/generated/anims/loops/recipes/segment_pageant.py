from pathlib import Path
import numpy as np
import torch
from PIL import Image,ImageFilter
from sam2.build_sam import build_sam2_video_predictor
r=Path('/private/tmp/widowsbay-animation-work');device='cpu'
p=build_sam2_video_predictor('configs/sam2.1/sam2.1_hiera_t.yaml',str(r/'sam2.1_hiera_tiny.pt'),device=device,apply_postprocessing=False)
prompts=[([90,290,240,655],[[176,400],[174,520]],[[275,445]]),
         ([195,270,350,590],[[258,400],[252,480]],[[370,480]]),
         ([610,310,835,665],[[718,408],[715,525]],[[580,500]]),
         ([760,300,950,700],[[866,405],[868,520]],[[744,450]])]
with torch.inference_mode():
 s=p.init_state(video_path=str(r/'pageant-pilot'),offload_video_to_cpu=True,offload_state_to_cpu=True)
 for oid,(box,pos,neg) in enumerate(prompts,1):p.add_new_points_or_box(s,frame_idx=0,obj_id=oid,points=np.array(pos+neg,np.float32),labels=np.array([1]*len(pos)+[0]*len(neg),np.int32),box=np.array(box,np.float32))
 out=r/'pageant-cutouts';out.mkdir(exist_ok=True);files=sorted((r/'pageant-pilot').glob('*.jpg'))
 for i,ids,masks in p.propagate_in_video(s):
  mask=np.any(masks.cpu().numpy()[:,0]>0,axis=0);im=Image.open(files[i]).convert('RGBA');im.putalpha(Image.fromarray(np.uint8(mask)*255).filter(ImageFilter.GaussianBlur(.45)));im.save(out/(f'{i:05d}.png'));print('pageant',i+1,flush=True)
