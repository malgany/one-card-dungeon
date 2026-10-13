import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorldPanels, regionAccess } from '../../js/ui/world-panels.js';
import { createOverworldGame } from '../../js/game/game-factories.js';
import { getWorldMap } from '../../js/config/world/index.js';
import { ensureCampaign } from '../../js/game/campaign.js';

describe('atlas and settings',()=>{
  let ui;
  afterEach(()=>{ui?.dispose();vi.useRealTimers();document.body.innerHTML='';localStorage.clear();});
  it('shows locked regions and updates their access after both seals and sentinels',()=>{
    const g=createOverworldGame(getWorldMap('vale-refugio')),c=ensureCampaign(g);
    expect(regionAccess(g,'vale-cripta')).toBeTruthy();c.defeated.push('seal-forest','seal-stone');
    expect(regionAccess(g,'vale-cripta')).toBeNull();expect(regionAccess(g,'vale-trono')).toBeTruthy();
    c.defeated.push('crypt-roots','crypt-echo');expect(regionAccess(g,'vale-trono')).toBeNull();
  });
  it('keeps settings operable and saves the economical renderer preference',()=>{
    vi.useFakeTimers();document.body.innerHTML='<div id="menu-root" hidden></div>';
    const state={game:createOverworldGame(getWorldMap('vale-refugio')),visuals:{}};state.game.menuOpen=true;
    const actions={getOverworldMusicVolume:()=>.5,setOverworldMusicVolume:vi.fn(),closeActiveModal:vi.fn(),autoSaveGame:vi.fn()};
    ui=createWorldPanels(state,actions,vi.fn());
    const quality=document.querySelector('[data-setting="quality"]');quality.value='economy';quality.dispatchEvent(new Event('change',{bubbles:true}));
    expect(state.pixelRatioLimit).toBe(1);expect(state.visuals.shadowMapEnabled).toBe(false);expect(localStorage.getItem('one-rpg-display-quality')).toBe('economy');
    const volume=document.querySelector('[data-setting="volume"]');volume.value='25';volume.dispatchEvent(new Event('input',{bubbles:true}));
    expect(actions.setOverworldMusicVolume).toHaveBeenCalledWith(.25);
    document.querySelector('[data-world="close"]').click();expect(state.game.menuOpen).toBe(false);
  });
});
