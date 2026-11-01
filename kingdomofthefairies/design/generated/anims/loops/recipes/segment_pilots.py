from pathlib import Path
import json
import numpy as np
import torch
from PIL import Image, ImageFilter
from sam2.build_sam import build_sam2_video_predictor

ROOT=Path('/private/tmp/widowsbay-animation-work')
device='mps' if torch.backends.mps.is_available() else 'cpu'
print('SAM 2 device:',device,flush=True)
predictor=build_sam2_video_predictor('configs/sam2.1/sam2.1_hiera_t.yaml',str(ROOT/'sam2.1_hiera_tiny.pt'),device=device,apply_postprocessing=False)
jobs=[('band-pilot',[
    (1,[60,375,350,719],[[213,433],[205,520],[145,635],[290,650]],[]),
    (2,[350,360,560,719],[[447,418],[445,518],[417,643],[481,665]],[]),
    (3,[645,350,865,719],[[720,420],[727,520],[720,650]],[]),
]),('lady-pilot',[(1,[405,285,565,610],[[485,375],[490,460],[488,540]],[[555,405],[400,520]])])]
with torch.inference_mode():
 for ident,prompts in jobs:
  state=predictor.init_state(video_path=str(ROOT/ident),offload_video_to_cpu=True,offload_state_to_cpu=True)
  for oid,box,positive,negative in prompts:
   points=np.array(positive+negative,dtype=np.float32);labels=np.array([1]*len(positive)+[0]*len(negative),dtype=np.int32)
   predictor.add_new_points_or_box(state,frame_idx=0,obj_id=oid,points=points,labels=labels,box=np.array(box,dtype=np.float32))
  out=ROOT/(ident+'-cutouts');out.mkdir(exist_ok=True)
  files=sorted((ROOT/ident).glob('*.jpg'))
  for index,ids,masks in predictor.propagate_in_video(state):
   mask=np.any(masks.detach().cpu().numpy()[:,0]>0,axis=0)
   im=Image.open(files[index]).convert('RGBA')
   alpha=Image.fromarray(np.uint8(mask)*255).filter(ImageFilter.GaussianBlur(.45))
   im.putalpha(alpha);im.save(out/(f'{index:05d}.png'))
   print(ident,index+1,'/',len(files),flush=True)
  (out/'tracking.json').write_text(json.dumps({'model':'SAM 2.1 Hiera Tiny','device':device,'points':prompts},indent=2))
  del state
  if device=='mps':torch.mps.empty_cache()
