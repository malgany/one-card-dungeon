// A short out-and-back stroll inside the encounter's own cell. Logical
// coordinates never move, keeping collisions, selection and combat stable.
export function ambientMotion(id,now,enabled=true){
  if(!enabled)return {x:0,y:0,moving:false,direction:{x:0,y:1}};
  let seed=0;for(const c of String(id))seed=(seed*31+c.charCodeAt(0))>>>0;
  const t=((now/1000+seed%11)%14),angle=(seed%360)*Math.PI/180;
  let amount=0,speed=0;
  if(t<2){const u=t/2;amount=u*u*(3-2*u);speed=1;}
  else if(t<4)amount=1;
  else if(t<6){const u=(t-4)/2;amount=1-u*u*(3-2*u);speed=-1;}
  const x=Math.cos(angle),y=Math.sin(angle);
  return {x:x*.22*amount,y:y*.22*amount,moving:speed!==0,direction:{x:x*(speed||1),y:y*(speed||1)}};
}
