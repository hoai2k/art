from pathlib import Path
import io,tarfile
import numpy as np
from PIL import Image,ImageFilter
root=Path('/private/tmp/widowsbay-animation-work')
checkpoint=Path('/Volumes/BACKUP/Backup/Games/mini/kingdomofthefairies/design/generated/anims/checkpoint-2026-10-06/offline/work.tar.gz')
# Local correction only: SAM's added arm points changed other body regions at
# those keyframes. Preserve the already-reviewed body mask and repair the arm.
with tarfile.open(checkpoint) as archive:
 for i in range(19):
  name=f'{i:05d}.png';saved=archive.extractfile('widowsbay-animation-work/band-pilot-cutouts/'+name).read()
  old=Image.open(io.BytesIO(saved)).convert('RGBA')
  corrected=Image.open(root/'band-pilot-cutouts'/name).convert('RGBA')
  a=np.array(old.getchannel('A'));new=np.array(corrected.getchannel('A'))
  region=np.zeros_like(a);region[418:480,112:220]=255
  weight=np.array(Image.fromarray(region).filter(ImageFilter.GaussianBlur(1.0)))/255
  a=np.maximum(a,np.uint8(new*weight))
  old.putalpha(Image.fromarray(a));old.save(root/'band-pilot-cutouts'/name)
print('Restored reviewed body masks and merged the local arm corrections')
