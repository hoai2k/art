import assert from 'node:assert/strict';
import '../src/acts/act5film.js';
import {drawSurfaceSwimmer,SURFACE_SWIM} from '../src/acts/act5film-art.js';
import {PERSON} from '../src/person-size.js';
for(const look of ['','-tinted'])for(const frame of ['a','b']){
 const id='prince-swim-surface-'+frame,aid=id+look,px=PERSON[aid]?.px;
 assert.ok(px>0,aid+' is measured against the standing prince');
 let at={x:0,y:0},stack=[],box;
 const k={c:{save(){stack.push({...at});},restore(){at=stack.pop();},translate(x,y){at.x+=x;at.y+=y;}},
  img(){return {naturalWidth:360,naturalHeight:240,src:aid+'.webp'};},
  asset(id,x,y,w,h){box={x:at.x+x-w/2,y:at.y+y-h,w,h};return true;}};
 assert.ok(drawSurfaceSwimmer(k,id,600,460,124));
 assert.ok(Math.abs(box.x+SURFACE_SWIM.headX*box.w/360-600)<1e-8,'stroke head stays at its world position');
 assert.ok(Math.abs(box.y+SURFACE_SWIM.waterY*box.h/240-460)<1e-8,'invisible waterline stays on the sea surface');
 assert.ok(Math.abs(box.h/240-124/px)<1e-8,'person size controls the scale');
}
assert.equal(drawSurfaceSwimmer({img:()=>null},'missing',0,0),false);
console.log('Surface strokes keep the measured person scale, head registration and waterline in both looks');
