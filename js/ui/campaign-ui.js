import { getWorldMap } from '../config/world/index.js';
import { CAMPAIGN_START, CAMPAIGN_MAPS } from '../config/world/maps/campaign.js';
import { ensureCampaign, campaignObjectives, nearbyCampaignPoint } from '../game/campaign.js';
import { ensureOverworldMapState } from '../game/game-factories.js';

export function createCampaignUI(state, actions) {
  const root=document.createElement('section'); root.id='campaign-hud'; document.body.append(root);
  let open=false, last='', previousFocus=null;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function closeJournal() { open=false; if(state.game.activeModal==='campaignJournal') state.game.activeModal=null; render(); previousFocus?.focus?.(); }
  function toggleJournal() {
    if(open){closeJournal();return;}
    if(state.game.busy||state.game.cutscene||state.game.mode!=='overworld'||state.game.activeModal||state.game.menuOpen)return;
    previousFocus=document.activeElement; open=true;state.game.activeModal='campaignJournal';render();root.querySelector('[data-campaign="close"]')?.focus();
  }
  function render() {
    const g=state.game,c=ensureCampaign(g),map=getWorldMap(g.overworld?.currentMapId);
    if(open&&g.activeModal!=='campaignJournal')open=false;
    const hidden=!document.getElementById('menu-root')?.hidden||!!g.cutscene||g.menuOpen||!['overworld','combat'].includes(g.mode)||(g.activeModal&&g.activeModal!=='campaignJournal');
    root.hidden=!!hidden; if(hidden)return;
    const objectives=campaignObjectives(g);
    const inCampaign=!!map?.campaign;
    const html=`<div class="campaign-tracker"><span class="campaign-eyebrow">${g.mode==='combat'?'ENCONTRO TÁTICO':'CRÔNICAS DO VALE'}</span>
      <strong>${esc(g.mode==='combat'?(g.monsters.some(m=>m.type==='eclipseWarden')?'Guardião do Eclipse':'Combate por turnos'):map?.name||'Exploração')}</strong>
      <div class="campaign-toolbar"><button data-campaign="bag">Bolsa</button><button data-campaign="journal" ${g.mode!=='overworld'||g.busy?'disabled':''}>Diário <kbd>J</kbd></button><button data-campaign="potion" ${c.potions<1||g.busy||g.player.health>=g.player.maxHealth||(g.mode==='combat'&&(g.turnQueue?.[0]!=='player'||g.apRemaining<2))?'disabled':''}>Poção · ${c.potions} <kbd>Q</kbd></button></div>
      ${!inCampaign&&g.mode==='overworld'?'<button class="campaign-interact" data-campaign="travel">Viajar ao Refúgio do Vale</button>':''}
      </div>
      ${g.bossTelegraph?'<div class="campaign-alert" role="status">Ruptura preparada — saia das casas vermelhas antes do próximo turno do Guardião.</div>':''}
      ${open?`<div class="campaign-modal-backdrop"><article class="campaign-journal" role="dialog" aria-modal="true" aria-label="Diário do vale" tabindex="-1"><button class="campaign-close" data-campaign="close" aria-label="Fechar diário">×</button><span class="campaign-eyebrow">DIÁRIO DE VIAGEM</span><h1>${c.completed?'O vale respira outra vez':'Os selos do vale'}</h1><p class="campaign-lead">A floresta e o farol guardam a entrada da cripta. Explore no seu ritmo e use as fogueiras para se recuperar.</p><div class="campaign-journal-columns"><div><h2>Sua jornada</h2><ol class="campaign-objectives">${objectives.map(o=>`<li class="${o.done?'is-done':''}"><span>${o.done?'✓':'◇'}</span><div><strong>${esc(o.title)}</strong><p>${esc(o.detail)}</p></div></li>`).join('')}</ol></div><div><h2>Regiões do vale</h2><div class="campaign-route">Refúgio → Bosque / Estrada<br>↓<br>Ruínas do Farol → Cripta → Guardião</div>${Object.values(CAMPAIGN_MAPS).map(m=>`<p class="campaign-region ${m.id===map?.id?'is-current':''}"><strong>${esc(m.name)}</strong><span>${m.id===map?.id?'Você está aqui':g.overworld?.heroPath?.includes(m.id)?'Visitada':m.id==='vale-cripta'?'Requer dois selos':'A explorar'} · Nv. ${m.enemyLevel}</span></p>`).join('')}</div></div><footer>Clique nos objetos para se aproximar e interagir. Transfira os itens dos baús para sua bolsa.<br>Progresso salvo ao vencer, interagir e sair. Cenário: KayKit / Kay Lousberg · Monstros: Quaternius · CC0.</footer></article></div>`:''}`;
    if(html!==last){root.innerHTML=html;last=html;}
  }
  function click(event) {
    const action=event.target.closest('[data-campaign]')?.dataset.campaign;
    if(!action)return;
    if(action==='bag'&&!state.game.busy){state.game.activeModal='campaignBag';}
    if(action==='journal')toggleJournal();
    if(action==='close')closeJournal();
    if(action==='interact')actions.interactCampaign();
    if(action==='potion')actions.drinkPotion();
    if(action==='travel'&&!state.game.busy&&state.game.mode==='overworld'){
      // Migration preserves the character, inventory and old explored maps.
      const g=state.game,map=CAMPAIGN_MAPS[CAMPAIGN_START];
      g.overworld.currentMapId=map.id; g.player.x=map.playerStart.x;g.player.y=map.playerStart.y;
      g.overworld.heroPath=[...(g.overworld.heroPath||[]),map.id];
      ensureOverworldMapState(g.overworld,map.id);actions.setEvent('Você chegou ao Refúgio do Vale. Leia a carta junto à fogueira.');actions.autoSaveGame();
    }
    render();
  }
  function key(event) {
    if(root.hidden||event.repeat||/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName))return;
    if(open){
      if(event.key==='Escape'){event.preventDefault();closeJournal();}
      if(event.key==='Tab'){event.preventDefault();root.querySelector('[data-campaign="close"]')?.focus();}
      return;
    }
    if(state.game.activeModal)return;
    if(event.key.toLowerCase()==='j'){event.preventDefault();toggleJournal();}
    if(event.key.toLowerCase()==='e'){event.preventDefault();actions.interactCampaign();}
    if(event.key.toLowerCase()==='q'){event.preventDefault();actions.drinkPotion();}
    render();
  }
  root.addEventListener('click',click);document.addEventListener('keydown',key);
  const timer=setInterval(render,150);render();
  return {dispose(){clearInterval(timer);root.remove();document.removeEventListener('keydown',key);}};
}
