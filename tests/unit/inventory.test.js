import { describe, expect, it } from 'vitest';
import { createOverworldGame } from '../../js/game/game-factories.js';
import { getWorldMap } from '../../js/config/world/index.js';
import { ensureCampaign, interactCampaignPoint } from '../../js/game/campaign.js';
import { bagItems, chestItems, transferItem } from '../../js/game/inventory.js';

function setup(){
  const map=getWorldMap('vale-refugio'),g=createOverworldGame(map),p=map.points.find(p=>p.kind==='chest');
  g.player.x=p.x+1;g.player.y=p.y;interactCampaignPoint(g,p);chestItems(g,p.id);
  return {g,p};
}
describe('persistent containers',()=>{
  it('conserves item counts through repeated transfers in both directions',()=>{
    const {g,p}=setup();
    for(const id of ['potion','herb','shard']) {
      const total=bagItems(g)[id]+(chestItems(g,p.id)[id]||0);
      for(let i=0;i<10;i++)transferItem(g,p.id,id,'chest');
      expect(bagItems(g)[id]).toBe(total);expect(chestItems(g,p.id)[id]).toBe(0);
      for(let i=0;i<10;i++)transferItem(g,p.id,id,'bag');
      expect(bagItems(g)[id]).toBe(0);expect(chestItems(g,p.id)[id]).toBe(total);
    }
    const restored=JSON.parse(JSON.stringify(g));
    expect(chestItems(restored,p.id)).toEqual(chestItems(g,p.id));
  });
  it('rejects transfers from remote, busy, wrong-container or closed-dialog states',()=>{
    const {g,p}=setup();g.player.x+=3;
    expect(transferItem(g,p.id,'potion','chest')).toBe(false);
    g.player.x-=3;g.busy=true;expect(transferItem(g,p.id,'potion','chest')).toBe(false);
    g.busy=false;g.activeModal=null;expect(transferItem(g,p.id,'potion','chest')).toBe(false);
    g.activeModal='campaignInteraction';expect(transferItem(g,'cache-bosque','potion','chest')).toBe(false);
    expect(transferItem(g,p.id,'__proto__','chest')).toBe(false);
  });
  it('migrates already claimed legacy chests without awarding loot twice',()=>{
    const {g,p}=setup();const c=ensureCampaign(g);delete c.chests;
    expect(chestItems(g,p.id)).toEqual({});expect(c.potions).toBe(1);
  });
});
