import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOverworldGame} from '../js/game/game-factories.js';
import {getWorldMap} from '../js/config/world/index.js';
import {interactCampaignPoint} from '../js/game/campaign.js';
import {inventorySlots,moveInventoryStack,bagItems,chestItems} from '../js/game/inventory.js';
import {ambientMotion} from '../js/ui/ambient-motion.js';
import {atlasGeometry,regionPoint,isoProject,createAtlasView} from '../js/ui/map-cartography.js';
import {JSDOM} from 'jsdom';
import {createInteractionUI} from '../js/ui/interaction-ui.js';
function setup(){const map=getWorldMap('vale-refugio'),g=createOverworldGame(map),p=map.points.find(p=>p.kind==='chest');g.player.x=p.x+1;g.player.y=p.y;interactCampaignPoint(g,p);return {g,p};}
test('whole stack moves to chosen slot, survives save, and stays after other items are gained',()=>{
  const {g,p}=setup();const source=inventorySlots(g,'chest',p.id).indexOf('herb');
  assert.ok(moveInventoryStack(g,p.id,'chest',source,'bag',17));assert.equal(bagItems(g).herb,3);assert.equal(chestItems(g,p.id).herb,0);
  const restored=JSON.parse(JSON.stringify(g));assert.equal(inventorySlots(restored,'bag',p.id)[17],'herb');
  restored.campaign.bag.shard=7;assert.equal(inventorySlots(restored,'bag',p.id)[17],'herb');
  assert.ok(moveInventoryStack(restored,p.id,'bag',17,'bag',23));assert.equal(inventorySlots(restored,'bag',p.id)[23],'herb');
});
test('different stacks swap atomically, equal stacks merge without duplication',()=>{
  const {g,p}=setup(),chest=inventorySlots(g,'chest',p.id),bag=inventorySlots(g,'bag',p.id);
  assert.ok(moveInventoryStack(g,p.id,'chest',chest.indexOf('herb'),'bag',bag.indexOf('potion')));
  assert.equal(bagItems(g).herb,3);assert.equal(bagItems(g).potion,0);assert.equal(chestItems(g,p.id).potion,3);
  assert.equal(inventorySlots(g,'chest',p.id).filter(id=>id==='potion').length,1);
  const potionSlot=inventorySlots(g,'chest',p.id).indexOf('potion');
  assert.ok(moveInventoryStack(g,p.id,'chest',potionSlot,'bag',20));assert.equal(bagItems(g).potion,3);
  chestItems(g,p.id).potion=2;const again=inventorySlots(g,'chest',p.id).indexOf('potion');
  assert.ok(moveInventoryStack(g,p.id,'chest',again,'bag',20));assert.equal(bagItems(g).potion,5);assert.equal(chestItems(g,p.id).potion,0);
});
test('same-container swaps, consuming stacks, and remote/closed/invalid drops',()=>{
  const {g,p}=setup();inventorySlots(g,'bag',p.id);g.campaign.bag.herb=2;let bag=inventorySlots(g,'bag',p.id);
  const a=bag.indexOf('potion'),b=bag.indexOf('herb');assert.ok(moveInventoryStack(g,p.id,'bag',a,'bag',b));assert.equal(inventorySlots(g,'bag',p.id)[b],'potion');
  g.campaign.bag.herb=0;bag=inventorySlots(g,'bag',p.id);assert.equal(bag[a],null);assert.equal(bag[b],'potion');
  for(const invalid of [-1,24,NaN,.5])assert.equal(moveInventoryStack(g,p.id,'bag',b,'chest',invalid),false);
  g.player.x+=5;assert.equal(moveInventoryStack(g,p.id,'bag',b,'chest',9),false);
  g.activeModal='campaignBag';assert.ok(moveInventoryStack(g,undefined,'bag',b,'bag',8));
  g.activeModal=null;assert.equal(moveInventoryStack(g,undefined,'bag',8,'bag',9),false);
});
test('legacy inventories migrate to slots without losing quantities',()=>{
  const {g,p}=setup();g.campaign.slotLayouts={bag:['potion','potion','unknown'],chests:{}};
  assert.equal(inventorySlots(g,'bag',p.id).filter(Boolean).length,1);assert.equal(bagItems(g).potion,1);assert.equal(inventorySlots(g,'chest',p.id).length,24);
});
test('repeated rearrangements and transfers conserve every item and unique stack position',()=>{
  const {g,p}=setup();g.campaign.bag={herb:8,shard:6};g.campaign.potions=5;
  const total=()=>Object.fromEntries(['potion','herb','shard'].map(id=>[id,(bagItems(g)[id]||0)+(chestItems(g,p.id)[id]||0)]));
  const initial=total();let seed=31;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};
  for(let i=0;i<300;i++){
    const from=rand()%3===0?'bag':'chest',to=rand()%3===0?'chest':'bag';
    const src=inventorySlots(g,from,p.id),occupied=src.map((id,i)=>id?i:-1).filter(i=>i>=0);if(!occupied.length)continue;
    moveInventoryStack(g,p.id,from,occupied[rand()%occupied.length],to,rand()%24);
    assert.deepEqual(total(),initial);
    for(const side of ['bag','chest']){const ids=inventorySlots(g,side,p.id).filter(Boolean);assert.equal(ids.length,new Set(ids).size);}
  }
});
test('nearby idle motion is bounded, deterministic and disabled in tactical states',()=>{
  for(let t=0;t<28000;t+=90){const p=ambientMotion('guardian',t);assert.ok(Math.hypot(p.x,p.y)<=.220001);assert.deepEqual(p,ambientMotion('guardian',t));}
  assert.equal(ambientMotion('guardian',9000,false).x,0);
});
test('atlas includes all six connected regions using the same isometric projection',()=>{
  const g=atlasGeometry();assert.equal(g.maps.length,6);assert.ok(g.maxX>g.minX&&g.maxY>g.minY);
  assert.deepEqual(isoProject(2,0),{x:2,y:1});assert.deepEqual(isoProject(0,2),{x:-2,y:1});
  for(const m of g.maps)for(const c of m.connections){const p=regionPoint(m,c.x,c.y);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(g.maps.some(n=>n.id===c.targetMapId));}
});
test('UI has no native titles or outer window; preview and ghost show whole stack',()=>{
  const dom=new JSDOM('<div id="menu-root" hidden></div>',{url:'http://localhost/'});globalThis.document=dom.window.document;globalThis.window=dom.window;
  const {g,p}=setup();let saves=0;const ui=createInteractionUI({game:g},{autoSaveGame(){saves++;},closeActiveModal(){g.activeModal=null;}}),q=s=>document.querySelector(s);
  try{
    assert.equal(document.querySelectorAll('[title]').length,0);assert.equal(q('.inventory-layout header'),null);
    q('[data-item="herb"][data-side="chest"]').focus();assert.equal(q('.game-item-tooltip').hidden,false);assert.match(q('.game-item-tooltip').textContent,/Erva do vale/);
    const source=q('[data-item="herb"][data-side="chest"]'),target=q('[data-slot="17"][data-side="bag"]');document.elementFromPoint=()=>target;
    const event=(type,x,y)=>{const e=new dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{button:0,pointerId:1,clientX:x,clientY:y});return e;};
    source.dispatchEvent(event('pointerdown',10,10));q('#interaction-ui').dispatchEvent(event('pointermove',120,120));
    assert.equal(q('.inventory-drag-ghost .item-count').textContent,'3');assert.ok(target.classList.contains('is-drop-target'));assert.ok(q('.slot-drop-preview'));
    q('#interaction-ui').dispatchEvent(event('pointerup',120,120));assert.equal(bagItems(g).herb,3);assert.equal(inventorySlots(g,'bag',p.id)[17],'herb');assert.equal(q('.slot-drop-preview'),null);assert.ok(saves>=2);
  }finally{ui.dispose();dom.window.close();}
});
test('atlas zoom is bounded and reset restores overview; keyboard navigation works',()=>{
  const dom=new JSDOM('<div><canvas></canvas><span data-atlas-zoom></span></div>');globalThis.document=dom.window.document;globalThis.window=dom.window;
  const canvas=document.querySelector('canvas'),ctx=new Proxy({measureText:t=>({width:t.length*6})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  canvas.getContext=()=>ctx;canvas.getBoundingClientRect=()=>({width:390,height:500,left:0,top:0});const {g}=setup();
  const view=createAtlasView(canvas,{game:g});
  try{view.zoom(2);assert.equal(document.querySelector('[data-atlas-zoom]').textContent,'200%');view.zoom(10);assert.equal(document.querySelector('[data-atlas-zoom]').textContent,'400%');view.zoom(.01);assert.equal(document.querySelector('[data-atlas-zoom]').textContent,'65%');canvas.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'0'}));assert.equal(document.querySelector('[data-atlas-zoom]').textContent,'100%');}finally{view.dispose();dom.window.close();}
});
