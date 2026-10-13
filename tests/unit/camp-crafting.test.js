import { describe, expect, it } from 'vitest';
import { createOverworldGame } from '../../js/game/game-factories.js';
import { createGameActions } from '../../js/game/game-actions.js';
import { getWorldMap } from '../../js/config/world/index.js';
import { interactCampaignPoint, ensureCampaign, recordCampaignVictory } from '../../js/game/campaign.js';
import { craftAtCamp, runeRecipe } from '../../js/game/camp-crafting.js';
import { ensureInventory } from '../../js/game/inventory.js';

function camp(){const g=createOverworldGame(getWorldMap('vale-refugio'));interactCampaignPoint(g);return g;}
describe('camp preparation and regional progression',()=>{
  it('consumes exact materials, rejects remote crafting, and cannot overdraft',()=>{
    const g=camp(),c=ensureInventory(g);c.bag.herb=3;
    expect(craftAtCamp(g,'potion')).toBe(true);expect(c.bag.herb).toBe(1);expect(c.potions).toBe(2);
    expect(craftAtCamp(g,'potion')).toBe(false);g.activeModal=null;c.bag.herb=10;
    expect(craftAtCamp(g,'potion')).toBe(false);expect(c.bag.herb).toBe(10);
  });
  it('caps runes, gates the final upgrade behind both seals, and increases real attack damage',()=>{
    const g=camp(),c=ensureInventory(g);c.bag.shard=30;
    const actions=createGameActions({game:g}),attack=actions.getAvailableAttacks()[0],base=actions.getAttackDamage(attack);
    expect(craftAtCamp(g,'rune')).toBe(true);expect(actions.getAttackDamage(attack)).toBe(base+2);
    expect(craftAtCamp(g,'rune')).toBe(true);expect(craftAtCamp(g,'rune')).toBe(false);
    c.defeated.push('seal-forest','seal-stone');expect(craftAtCamp(g,'rune')).toBe(true);
    expect(craftAtCamp(g,'rune')).toBe(false);expect(runeRecipe(g).rank).toBe(3);expect(c.bag.shard).toBe(21);
  });
  it('rewards campaign materials once and preserves increasing region levels',()=>{
    const g=camp(),c=ensureInventory(g);recordCampaignVictory(g,'slime-practice');recordCampaignVictory(g,'slime-practice');
    expect(c.bag.herb).toBe(1);expect(c.bag.shard).toBe(1);
    const regions=['vale-refugio','vale-bosque','vale-ruinas','vale-cripta','vale-trono'];
    expect(regions.map(id=>getWorldMap(id).enemyLevel)).toEqual([1,2,3,4,5]);
    const enemies=regions.map(id=>{const game=createOverworldGame(getWorldMap(id));return game.overworld.mapStates[id].enemies[0];});
    expect(enemies.map(e=>e.level)).toEqual([1,2,3,4,5]);
    expect(enemies[0].attack).toBeLessThan(enemies[4].attack);
    expect(enemies[0].maxHp).toBeLessThan(enemies[4].maxHp);
  });
});
