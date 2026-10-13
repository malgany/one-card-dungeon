import { CAMPAIGN_MAPS } from '../config/world/maps/campaign.js';
import { campaignGateMessage } from '../game/campaign.js';

export const isoProject=(x,y)=>({x:x-y,y:(x+y)*.5});
export function regionPoint(map,x,y){
  return isoProject(map.gridPosition.x*28+x/map.size.width*24,-map.gridPosition.y*28+y/map.size.height*24);
}
export function atlasGeometry(){
  const maps=Object.values(CAMPAIGN_MAPS),corners=maps.flatMap(m=>[[0,0],[m.size.width,0],[0,m.size.height],[m.size.width,m.size.height]].map(([x,y])=>regionPoint(m,x,y)));
  return {maps,minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minY:Math.min(...corners.map(p=>p.y)),maxY:Math.max(...corners.map(p=>p.y))};
}
function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function region(ctx,map,project,game,mini=false){
  const n=map.size,land=map.biome==='meadow'?'#263826':'#35362e';
  polygon(ctx,[[0,0],[n.width,0],[n.width,n.height],[0,n.height]].map(([x,y])=>project(x,y)),land,map.id===game.overworld.currentMapId?'#d5c998':'#56634a');
  for(const patch of map.terrainPatches||[])for(const [x,y] of patch.cells||[])polygon(ctx,[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([a,b])=>project(a,b)),'#756644');
  for(const p of map.points){const c=project(p.x+.5,p.y+.5),s=mini?3:4;ctx.fillStyle=p.kind==='camp'?'#e3a449':p.kind==='chest'?'#d4bd75':'#c6ceae';ctx.fillRect(c.x-s/2,c.y-s/2,s,s);}
  for(const c of map.connections){const p=project(c.x+.5,c.y+.5);ctx.fillStyle=campaignGateMessage(game,c)?'#b87565':'#accb85';ctx.fillRect(p.x-2,p.y-2,4,4);}
  const mapState=game.overworld.mapStates?.[map.id];
  const enemies=mapState?.enemies||map.encounters.filter(e=>!game.campaign?.defeated?.includes(e.groupId));
  for(const e of enemies.filter(e=>e.hp!==0)){const p=project(e.x+.5,e.y+.5);ctx.beginPath();ctx.fillStyle='#d27663';ctx.arc(p.x,p.y,mini?2:3,0,Math.PI*2);ctx.fill();}
  if(map.id===game.overworld.currentMapId){const p=project(game.player.x+.5,game.player.y+.5);ctx.beginPath();ctx.fillStyle='#fff1ca';ctx.strokeStyle='#070807';ctx.lineWidth=2;ctx.arc(p.x,p.y,mini?4:5,0,Math.PI*2);ctx.fill();ctx.stroke();}
}
export function drawRegionMiniMap(ctx,map,game,x,y,size){
  const scale=(size-10)/(map.size.width+map.size.height);
  const project=(a,b)=>{const p=isoProject(a,b);return {x:x+size/2+p.x*scale,y:y+size/2-(map.size.width+map.size.height)*scale/4+p.y*scale};};
  ctx.save();ctx.beginPath();ctx.rect(x,y,size,size);ctx.clip();ctx.fillStyle='#121b14';ctx.fillRect(x,y,size,size);region(ctx,map,project,game,true);ctx.restore();
}
export function createAtlasView(canvas,state){
  let zoom=1,pan={x:0,y:0},pointers=new Map(),gesture=null;
  const ctx=canvas.getContext('2d'),geometry=atlasGeometry();
  function render(){
    const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;if(!w||!h)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#121b14';ctx.fillRect(0,0,w,h);
    const {maps,minX,maxX,minY,maxY}=geometry;
    const scale=Math.min((w-60)/(maxX-minX),(h-100)/(maxY-minY))*zoom;
    const screen=p=>({x:w/2+pan.x+(p.x-(minX+maxX)/2)*scale,y:h/2+pan.y+(p.y-(minY+maxY)/2)*scale});
    const point=(m,x,y)=>screen(regionPoint(m,x,y));
    // Connections join the real exit cells, including the north/south branches.
    for(const m of maps)for(const c of m.connections){
      if(m.id>c.targetMapId)continue;const target=CAMPAIGN_MAPS[c.targetMapId],a=point(m,c.x+.5,c.y+.5),b=point(target,c.spawn.x+.5,c.spawn.y+.5);
      ctx.strokeStyle=campaignGateMessage(state.game,c)?'#b87565':'#9bad7b';ctx.lineWidth=3;ctx.setLineDash(campaignGateMessage(state.game,c)?[5,4]:[]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
    }
    for(const m of maps)region(ctx,m,(x,y)=>point(m,x,y),state.game);
    for(const m of maps){if(scale<4.2)continue;const p=point(m,m.size.width/2,m.size.height/2);ctx.save();ctx.font='700 12px Inter,system-ui';ctx.textAlign='center';ctx.textBaseline='middle';const label=`${m.name} · Nv. ${m.enemyLevel}`,width=ctx.measureText(label).width+16;ctx.fillStyle='#11170ee8';ctx.fillRect(p.x-width/2,p.y-30,width,22);ctx.fillStyle=m.id===state.game.overworld.currentMapId?'#fff1ca':'#d7d1b9';ctx.fillText(label,p.x,p.y-19);ctx.restore();}
    const current=CAMPAIGN_MAPS[state.game.overworld.currentMapId];
    if(current){const p=point(current,state.game.player.x+.5,state.game.player.y+.5);ctx.beginPath();ctx.fillStyle='#fff1ca';ctx.strokeStyle='#070807';ctx.lineWidth=2;ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();}
    canvas.parentElement.querySelector('[data-atlas-zoom]')?.replaceChildren(document.createTextNode(`${Math.round(zoom*100)}%`));
  }
  function changeZoom(next,anchor){
    const old=zoom;zoom=Math.max(.65,Math.min(4,next));
    if(anchor){const r=canvas.getBoundingClientRect(),x=anchor.x-r.width/2,y=anchor.y-r.height/2;pan={x:x-(x-pan.x)*zoom/old,y:y-(y-pan.y)*zoom/old};}
    render();
  }
  function wheel(e){e.preventDefault();const r=canvas.getBoundingClientRect();changeZoom(zoom*Math.exp(-e.deltaY*.0015),{x:e.clientX-r.left,y:e.clientY-r.top});}
  function seedGesture(){const points=[...pointers.values()];gesture={points,pan:{...pan},zoom,distance:points.length===2?Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y):0};}
  function down(e){if(e.button!==0)return;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});seedGesture();}
  function move(e){if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=[...pointers.values()];if(p.length===1){pan={x:gesture.pan.x+p[0].x-gesture.points[0].x,y:gesture.pan.y+p[0].y-gesture.points[0].y};render();}else if(p.length===2&&gesture.distance){const r=canvas.getBoundingClientRect();changeZoom(gesture.zoom*Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)/gesture.distance,{x:(p[0].x+p[1].x)/2-r.left,y:(p[0].y+p[1].y)/2-r.top});}}
  function up(e){pointers.delete(e.pointerId);seedGesture();}
  function key(e){if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(['+','='].includes(e.key))changeZoom(zoom*1.25);else if(e.key==='-')changeZoom(zoom/1.25);else if(e.key==='0')reset();else{pan.x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;pan.y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;render();}}}
  function reset(){zoom=1;pan={x:0,y:0};render();}
  canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('keydown',key);render();
  return {render,zoom:factor=>changeZoom(zoom*factor),reset,dispose(){canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('keydown',key);}};
}
