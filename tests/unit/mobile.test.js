import { afterEach, describe, expect, it, vi } from 'vitest';
import { mobileBoardViewport, mobileCameraHeight, isMobileLayout } from '../../js/ui/mobile-layout.js';
import { createMobileUI } from '../../js/ui/mobile-ui.js';
import { PHASES } from '../../js/config/game-data.js';

describe('mobile camera', () => {
  it.each([[320,568],[390,844],[768,1024],[844,390],[667,375]])('fits the entire combat floor at %sx%s', (w,h) => {
    const viewport = mobileBoardViewport(w,h);
    const height = mobileCameraHeight(viewport,1.8,true);
    expect(height * viewport.w / viewport.h).toBeGreaterThanOrEqual(9.79);
    expect(height).toBeGreaterThanOrEqual(6.8);
    expect(viewport.y + viewport.h).toBeLessThan(h);
  });
  it('uses touch layout in landscape and ordinary layout on desktop', () => {
    expect(isMobileLayout(844,390)).toBe(true);
    expect(isMobileLayout(1280,720)).toBe(false);
  });
});

describe('mobile controls', () => {
  let ui;
  afterEach(() => { ui?.dispose(); vi.useRealTimers(); document.body.innerHTML=''; });
  it('exposes every attack, respects turn/AP restrictions, and invokes the selected action', () => {
    vi.useFakeTimers(); window.innerWidth=390; window.innerHeight=844;
    document.body.innerHTML='<div id="menu-root" hidden></div>';
    const attacks=Array.from({length:6},(_,i)=>({id:`a${i}`,name:`Ataque ${i}`,apCost:i+1}));
    const state={game:{mode:'combat',phase:PHASES.HERO,player:{health:20,maxHealth:60},apRemaining:4,speedRemaining:3}};
    const actions={getAvailableAttacks:()=>attacks,toggleAttackSelection:vi.fn(),endHeroPhase:vi.fn()};
    ui=createMobileUI(state,actions);
    expect(document.querySelectorAll('[data-attack]')).toHaveLength(6);
    document.querySelector('[data-attack="a2"]').click();
    expect(actions.toggleAttackSelection).toHaveBeenCalledWith('a2');
    expect(document.querySelector('[data-attack="a5"]').disabled).toBe(true);
    state.game.busy=true; vi.advanceTimersByTime(100);
    expect(document.querySelector('[data-mobile="end"]').disabled).toBe(true);
    expect(document.querySelector('[data-attack="a0"]').disabled).toBe(true);
  });
});
