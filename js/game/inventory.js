import { ensureCampaign } from './campaign.js';
import { getWorldMap } from '../config/world/index.js';

export const ITEM_TYPES = Object.freeze({
  potion: { name:'Poção de vida', icon:'✚', description:'Restaura 25 de vida. Custa 2 AP em combate.', color:'#be5b43' },
  herb: { name:'Erva do vale', icon:'❧', description:'Ingrediente para preparar poções nas fogueiras.', color:'#94b779' },
  shard: { name:'Fragmento rúnico', icon:'◆', description:'Material recuperado dos guardiões do vale.', color:'#dbbd71' },
});

export function ensureInventory(game) {
  const c=ensureCampaign(game);
  if (!c.bag || typeof c.bag !== 'object' || Array.isArray(c.bag)) c.bag={};
  if (!c.chests || typeof c.chests !== 'object' || Array.isArray(c.chests)) c.chests={};
  for (const id of Object.keys(ITEM_TYPES)) if(id!=='potion') c.bag[id]=Math.max(0,Math.floor(Number(c.bag[id])||0));
  return c;
}

export function bagItems(game) {
  const c=ensureInventory(game);
  return { ...c.bag,potion:c.potions };
}

export function nearbyChest(game, id) {
  if(game.mode!=='overworld'||game.busy||game.cutscene)return null;
  return getWorldMap(game.overworld?.currentMapId)?.points?.find(p=>p.id===id&&p.kind==='chest'&&Math.abs(p.x-game.player.x)+Math.abs(p.y-game.player.y)<=1)||null;
}

export function chestItems(game,id) {
  if(!nearbyChest(game,id))return null;
  const c=ensureInventory(game);
  if(!Object.hasOwn(c.chests,id)) {
    c.chests[id]=c.claimed.includes(id)?{}:{potion:2,herb:3,shard:1};
    if(!c.claimed.includes(id))c.claimed.push(id);
  }
  return c.chests[id];
}

// Transfer one item atomically; both click and drag use this same validation.
export function transferItem(game,chestId,itemId,from) {
  if(!Object.hasOwn(ITEM_TYPES,itemId)||!['bag','chest'].includes(from))return false;
  if(game.activeModal!=='campaignInteraction'||game.campaignInteraction?.pointId!==chestId)return false;
  const chest=chestItems(game,chestId);
  if(!chest)return false;
  const c=ensureInventory(game),bag=bagItems(game),source=from==='bag'?bag:chest;
  if(!(source[itemId]>0))return false;
  const delta=from==='chest'?1:-1;
  chest[itemId]=Math.max(0,Math.floor(Number(chest[itemId])||0))-delta;
  if(itemId==='potion')c.potions+=delta;
  else c.bag[itemId]=(c.bag[itemId]||0)+delta;
  return true;
}

export const INVENTORY_SLOT_COUNT = 24;

// Counts remain shared with combat/crafting. Positions are saved independently,
// so consuming or gaining an item never compacts the player's arrangement.
export function inventorySlots(game, side, chestId) {
  if (!['bag','chest'].includes(side)) return null;
  const counts=side==='bag'?bagItems(game):chestItems(game,chestId);
  if (!counts) return null;
  const c=ensureInventory(game);
  c.slotLayouts ||= {bag:[],chests:{}};
  c.slotLayouts.chests ||= {};
  const stored=side==='bag'?c.slotLayouts.bag:c.slotLayouts.chests[chestId];
  const seen=new Set();
  const slots=Array.from({length:INVENTORY_SLOT_COUNT},(_,i)=>{
    const id=stored?.[i];
    if(!Object.hasOwn(ITEM_TYPES,id)||!(counts[id]>0)||seen.has(id))return null;
    seen.add(id);return id;
  });
  for(const id of Object.keys(ITEM_TYPES))if(counts[id]>0&&!seen.has(id))slots[slots.indexOf(null)]=id;
  if(side==='bag')c.slotLayouts.bag=slots;else c.slotLayouts.chests[chestId]=slots;
  return slots;
}

export function moveInventoryStack(game,chestId,from,fromSlot,to,toSlot) {
  if(!['bag','chest'].includes(from)||!['bag','chest'].includes(to))return false;
  if(![fromSlot,toSlot].every(i=>Number.isInteger(i)&&i>=0&&i<INVENTORY_SLOT_COUNT))return false;
  if(game.busy||game.cutscene)return false;
  const withChest=game.activeModal==='campaignInteraction'&&game.campaignInteraction?.pointId===chestId&&nearbyChest(game,chestId);
  if(!withChest&&!(game.activeModal==='campaignBag'&&from==='bag'&&to==='bag'))return false;
  const source=inventorySlots(game,from,chestId);
  const target=from===to?source:inventorySlots(game,to,chestId);
  const id=source?.[fromSlot],other=target?.[toSlot];
  if(!id||!target||(from===to&&fromSlot===toSlot))return false;
  if(from===to){[source[fromSlot],source[toSlot]]=[source[toSlot],source[fromSlot]];return true;}
  const c=ensureInventory(game),bag=bagItems(game),chest=chestItems(game,chestId);
  const srcCounts=from==='bag'?bag:chest,dstCounts=to==='bag'?bag:chest;
  // A different occupied stack swaps; matching stacks merge at the chosen slot.
  const count=srcCounts[id],otherCount=other&&other!==id?dstCounts[other]:0;
  if(!(count>0))return false;
  srcCounts[id]=0;dstCounts[id]=(dstCounts[id]||0)+count;
  if(otherCount){dstCounts[other]=0;srcCounts[other]=(srcCounts[other]||0)+otherCount;}
  for(const key of Object.keys(ITEM_TYPES)){
    if(key==='potion')c.potions=bag[key];else c.bag[key]=bag[key]||0;
    chest[key]=chest[key]||0;
  }
  source[fromSlot]=otherCount?other:null;
  // Relocate an existing destination stack when dropped on an empty slot.
  for(let i=0;i<target.length;i++)if(target[i]===id)target[i]=null;
  if(otherCount)for(let i=0;i<source.length;i++)if(i!==fromSlot&&source[i]===other)source[i]=null;
  target[toSlot]=id;
  return true;
}
