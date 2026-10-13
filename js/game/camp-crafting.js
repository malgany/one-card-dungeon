import { ensureInventory } from './inventory.js';
import { getWorldMap } from '../config/world/index.js';

export function atOpenCamp(game) {
  if(game.mode!=='overworld'||game.busy||game.activeModal!=='campaignInteraction')return false;
  return !!getWorldMap(game.overworld?.currentMapId)?.points?.some(p=>p.kind==='camp'&&p.id===game.campaignInteraction?.pointId&&Math.abs(p.x-game.player.x)+Math.abs(p.y-game.player.y)<=1);
}
export function runeRecipe(game) {
  const c=ensureInventory(game),rank=Math.min(3,Math.max(0,Math.floor(Number(c.runeRank)||0)));
  c.runeRank=rank;
  return {rank,cost:2+rank,unlocked:rank<2||['seal-forest','seal-stone'].every(id=>c.defeated.includes(id))};
}
export function craftAtCamp(game,recipe) {
  if(!atOpenCamp(game))return false;
  const c=ensureInventory(game);
  if(recipe==='potion'&&c.bag.herb>=2){c.bag.herb-=2;c.potions++;return true;}
  if(recipe==='rune'){
    const r=runeRecipe(game);
    if(r.rank>=3||!r.unlocked||c.bag.shard<r.cost)return false;
    c.bag.shard-=r.cost;c.runeRank=r.rank+1;return true;
  }
  return false;
}
