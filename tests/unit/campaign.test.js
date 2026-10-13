import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMPAIGN_MAPS, CAMPAIGN_START } from '../../js/config/world/maps/campaign.js';
import { createOverworldGame, createOverworldMapState } from '../../js/game/game-factories.js';
import { createGameActions } from '../../js/game/game-actions.js';
import { ensureCampaign, campaignGateMessage, recordCampaignVictory, interactCampaignPoint, useCampaignPotion, bossBlastCells } from '../../js/game/campaign.js';
import { getWorldObjectBlockedKeys } from '../../js/game/world-state.js';
import { SAVE_KEY, TIMING, getWorldMap } from '../../js/config/game-data.js';

beforeEach(()=>{vi.useFakeTimers();localStorage.clear();});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();});
const harness=(id=CAMPAIGN_START)=>{const state={game:createOverworldGame(getWorldMap(id))};return{state,actions:createGameActions(state)};};
function finishMove(){vi.advanceTimersByTime(30000);}
describe('campaign progression',()=>{
  it('preserves the named seal guardian in the world, combat and saved game',()=>{
    const {state,actions}=harness('vale-ruinas');
    const guardian=state.game.overworld.mapStates['vale-ruinas'].enemies.find(e=>e.groupId==='seal-stone');
    expect(guardian.name).toBe('Vigia do Farol');
    actions.autoSaveGame();actions.loadGame({silent:true});
    const restored=state.game.overworld.mapStates['vale-ruinas'].enemies.find(e=>e.groupId==='seal-stone');
    expect(restored.name).toBe('Vigia do Farol');
    actions.startOverworldEncounter(restored.id);
    expect(state.game.monsters[0].name).toBe('Vigia do Farol');
  });
  it('keeps every exit, encounter and landmark reachable on foot',()=>{
    for(const map of Object.values(CAMPAIGN_MAPS)){
      const game=createOverworldGame(map),blocked=getWorldObjectBlockedKeys(game.overworld);
      const seen=new Set([`${map.playerStart.x},${map.playerStart.y}`]),queue=[map.playerStart];
      for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const p={x:queue[i].x+dx,y:queue[i].y+dy},key=`${p.x},${p.y}`;
        if(p.x<0||p.y<0||p.x>=map.size.width||p.y>=map.size.height||blocked.has(key)||seen.has(key))continue;
        seen.add(key);queue.push(p);
      }
      for(const p of [...map.connections,...map.points,...map.encounters])expect(seen.has(`${p.x},${p.y}`),`${map.id}: ${p.id}`).toBe(true);
      for(const c of map.connections){const target=CAMPAIGN_MAPS[c.targetMapId];expect(target.connections.some(back=>back.targetMapId===map.id)).toBe(true);expect(getWorldObjectBlockedKeys(createOverworldGame(target).overworld).has(`${c.spawn.x},${c.spawn.y}`)).toBe(false);}
      expect(map.objects.length).toBeLessThan(150);
    }
  });
  it('uses authored encounters and never respawns defeated campaign enemies',()=>{
    const {state,actions}=harness('vale-trono');
    expect(state.game.overworld.mapStates['vale-trono'].enemies.map(e=>e.type)).toEqual(['eclipseWarden']);
    const e=state.game.overworld.mapStates['vale-trono'].enemies[0];
    actions.startOverworldEncounter(e.id);
    const m=state.game.monsters[0];m.hp=1;m.defense=0;m.x=state.game.player.x+1;m.y=state.game.player.y;
    state.game.combatWalls=[];state.game.busy=false;state.game.player.rangeBase=6;state.game.selectedAttackId=state.game.player.attackSlot.id;
    expect(actions.attackMonster(m.id)).toBe(true);vi.advanceTimersByTime(4000);
    expect(state.game.mode).toBe('overworld');expect(state.game.campaign.completed).toBe(true);
    expect(state.game.overworld.mapStates['vale-trono'].enemies).toHaveLength(0);
    vi.advanceTimersByTime(120000);
    expect(state.game.overworld.mapStates['vale-trono'].pendingRespawnEnemies).toHaveLength(0);
    expect(actions.loadGame({silent:true})).toBe(true);expect(state.game.campaign.completed).toBe(true);
  });
  it('requires both seals before entering the crypt and its sentinels before the boss',()=>{
    const g=harness().state.game;
    expect(campaignGateMessage(g,{requires:'seals'})).toBeTruthy();
    recordCampaignVictory(g,'seal-forest');expect(campaignGateMessage(g,{requires:'seals'})).toBeTruthy();
    recordCampaignVictory(g,'seal-stone');expect(campaignGateMessage(g,{requires:'seals'})).toBeNull();
    expect(campaignGateMessage(g,{requires:'crypt'})).toBeTruthy();
    recordCampaignVictory(g,'crypt-roots');recordCampaignVictory(g,'crypt-echo');
    expect(campaignGateMessage(g,{requires:'crypt'})).toBeNull();
  });
  it('enforces gates through actual movement and returns through the same region connection',()=>{
    const {state,actions}=harness('vale-ruinas');const g=state.game;
    g.player.x=18;g.player.y=10;
    expect(actions.moveOverworldPlayer({x:19,y:10})).toBe(true);finishMove();
    expect(g.overworld.currentMapId).toBe('vale-ruinas');expect(g.busy).toBe(false);
    recordCampaignVictory(g,'seal-forest');recordCampaignVictory(g,'seal-stone');
    expect(actions.moveOverworldPlayer({x:19,y:10})).toBe(true);finishMove();
    expect(g.overworld.currentMapId).toBe('vale-cripta');
    expect(actions.moveOverworldPlayer({x:0,y:9})).toBe(true);finishMove();
    expect(g.overworld.currentMapId).toBe('vale-ruinas');
  });
  it('lets camps heal, limits loot to one claim, rejects remote interactions and persists inventory',()=>{
    const {state,actions}=harness();const g=state.game,c=ensureCampaign(g),map=getWorldMap(CAMPAIGN_START);
    const chest=map.points.find(p=>p.kind==='chest');
    expect(interactCampaignPoint(g,chest)).toBeNull();g.player.x=chest.x;g.player.y=chest.y;
    const before=c.potions;interactCampaignPoint(g,chest);interactCampaignPoint(g,chest);expect(c.potions).toBe(before+2);
    const camp=map.points.find(p=>p.kind==='camp');g.player.x=camp.x;g.player.y=camp.y;g.player.health=1;
    interactCampaignPoint(g,camp);expect(g.player.health).toBe(g.player.maxHealth);
    actions.autoSaveGame();expect(JSON.parse(localStorage.getItem(SAVE_KEY)).campaign.claimed).toContain(chest.id);
    actions.loadGame({silent:true});expect(state.game.campaign.potions).toBe(before+2);
  });
  it('charges potions only for a valid hero turn and caps healing',()=>{
    const g=harness().state.game,c=ensureCampaign(g);c.potions=3;g.player.health=50;
    g.mode='combat';g.turnQueue=['enemy','player'];g.apRemaining=6;
    expect(useCampaignPotion(g)).toBe(false);g.turnQueue=['player'];g.apRemaining=1;
    expect(useCampaignPotion(g)).toBe(false);g.apRemaining=6;
    expect(useCampaignPotion(g)).toBe(true);expect(g.apRemaining).toBe(4);expect(c.potions).toBe(2);expect(g.player.health).toBe(60);
    expect(useCampaignPotion(g)).toBe(false);
  });
  it('announces the boss area for one full hero turn and allows dodging',()=>{
    const {state,actions}=harness('vale-trono');const g=state.game;
    actions.startOverworldEncounter(g.overworld.mapStates['vale-trono'].enemies[0].id);
    g.turnCount=2;g.busy=false;actions.endHeroPhase();vi.advanceTimersByTime(2000);
    expect(g.bossTelegraph.cells.length).toBeGreaterThan(0);expect(g.turnQueue[0]).toBe('player');
    const hp=g.player.health;g.player.x=3;g.player.y=3;actions.endHeroPhase();vi.advanceTimersByTime(2000);
    expect(g.bossTelegraph).toBeNull();expect(g.player.health).toBe(hp);
    expect(bossBlastCells({x:0,y:0})).toHaveLength(3);
  });
});
