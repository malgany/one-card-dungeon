import { createAtlasView } from './map-cartography.js';
import { CAMPAIGN_MAPS } from '../config/world/maps/campaign.js';
import { campaignGateMessage } from '../game/campaign.js';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const QUALITY_KEY='one-rpg-display-quality';
export const QUALITY_PROFILES={economy:{label:'Econômico',pixels:1,shadows:false},balanced:{label:'Equilibrado',pixels:1.5,shadows:true},high:{label:'Alto',pixels:2,shadows:true}};

export function regionAccess(game,mapId){
  if(mapId==='vale-cripta')return campaignGateMessage(game,{requires:'seals'});
  if(mapId==='vale-trono')return campaignGateMessage(game,{requires:'seals'})||campaignGateMessage(game,{requires:'crypt'});
  return null;
}

export function createWorldPanels(state,actions,onExit){
  state.enhancedPanels=true;
  const root=document.createElement('section');root.id='world-panels';root.hidden=true;document.body.append(root);
  let last='',selection=null,quality='balanced',previousFocus=null,atlasView=null;
  try { const saved=localStorage.getItem(QUALITY_KEY);if(QUALITY_PROFILES[saved])quality=saved; }catch{}
  function applyQuality(){const p=QUALITY_PROFILES[quality];state.pixelRatioLimit=p.pixels;state.visuals.shadowMapEnabled=p.shadows;}
  applyQuality();
  function close(){state.game.menuOpen=false;actions.closeActiveModal();render();previousFocus?.focus?.();}
  function render(){
    const g=state.game,map=CAMPAIGN_MAPS[g.overworld?.currentMapId];
    const atlas=g.activeModal==='worldMap'&&!!map,settings=g.menuOpen;
    if((!atlas&&!settings)||!document.getElementById('menu-root')?.hidden){root.hidden=true;last='';selection=null;atlasView?.dispose();atlasView=null;return;}
    const opening=root.hidden;root.hidden=false;if(opening)previousFocus=document.activeElement;
    if(atlas&&!settings){
      root.classList.add('is-visual-atlas');
      if(!atlasView){root.innerHTML=`<article class="visual-atlas" role="dialog" aria-modal="true" aria-label="Mapa do vale"><header><strong>Mapa do Vale</strong><span data-current-region></span><button data-world="close" aria-label="Fechar mapa">×</button></header><div class="atlas-canvas-wrap"><canvas tabindex="0" aria-label="Mapa isométrico das seis regiões conectadas. Use mais e menos para zoom, setas para mover e zero para enquadrar."></canvas><div class="atlas-zoom"><button data-atlas-action="out" aria-label="Diminuir zoom">−</button><button data-atlas-action="reset" aria-label="Enquadrar todo o mapa"><span data-atlas-zoom>100%</span></button><button data-atlas-action="in" aria-label="Aumentar zoom">+</button></div></div><footer><span>● Você</span><span class="map-enemy">● Inimigos</span><span class="map-camp">■ Fogueiras</span><span class="map-gate">┄ Passagem selada</span><small>Arraste para explorar · Roda ou pinça para zoom</small></footer></article>`;atlasView=createAtlasView(root.querySelector('canvas'),state);}
      root.querySelector('[data-current-region]').textContent=map.name;atlasView.render();
      if(opening)root.querySelector('[data-world="close"]')?.focus();return;
    }
    root.classList.remove('is-visual-atlas');if(atlasView){atlasView.dispose();atlasView=null;last='';}
    if(!selection)selection=map?.id;
    const selected=CAMPAIGN_MAPS[selection]||map;
    const blocked=selected?regionAccess(g,selected.id):null;
    const html=`<article class="interaction-panel world-panel" role="dialog" aria-modal="true" aria-label="${atlas?'Atlas do vale':'Configurações'}"><header><div><span class="campaign-eyebrow">${atlas?'CAMINHOS E REGIÕES':'OPÇÕES DE JOGO'}</span><h2>${atlas?'Atlas do vale':'Configurações'}</h2></div><button data-world="close">Fechar</button></header>${atlas?`
      <p class="interaction-intro">Você está em <strong>${esc(map.name)}</strong>. Selecione uma região para consultar suas passagens.</p>
      <div class="atlas-grid">${Object.values(CAMPAIGN_MAPS).map(m=>`<button data-region="${m.id}" aria-pressed="${m.id===selected.id}" class="atlas-region ${m.id===map.id?'is-current':''}"><span>${m.id===map.id?'● Você está aqui':regionAccess(g,m.id)?'◆ Passagem selada':g.overworld.heroPath?.includes(m.id)?'✓ Visitada':'◇ A explorar'}</span><strong>${esc(m.name)}</strong><small>Nível recomendado ${m.enemyLevel}</small></button>`).join('')}</div>
      <section class="atlas-detail"><h3>${esc(selected.name)} · Nv. ${selected.enemyLevel}</h3><p>${esc(selected.description)}</p>${blocked?`<p class="atlas-locked">${esc(blocked)}</p>`:''}<h3>Passagens</h3><ul>${selected.connections.map(c=>`<li>${c.x===0?'Oeste':c.x===selected.size.width-1?'Leste':c.y===0?'Norte':'Sul'} → ${esc(CAMPAIGN_MAPS[c.targetMapId]?.name)}${campaignGateMessage(g,c)?' · Selada':''}</li>`).join('')}</ul></section>`:`
      <label class="setting-field">Volume da música <input type="range" min="0" max="100" value="${Math.round((actions.getOverworldMusicVolume?.()??.5)*100)}" data-setting="volume" aria-label="Volume da música"></label>
      <label class="setting-field">Qualidade visual <select data-setting="quality" aria-label="Qualidade visual">${Object.entries(QUALITY_PROFILES).map(([id,p])=>`<option value="${id}" ${id===quality?'selected':''}>${p.label}</option>`).join('')}</select></label>
      <p class="interaction-intro">Econômico reduz a resolução e desliga sombras. Equilibrado prioriza fluidez; Alto preserva mais detalhes.</p>
      <details class="controls-help"><summary>Como jogar</summary><p>Clique ou toque no chão para andar. Selecione um ataque e depois o alvo. Use Fim de turno quando terminar.</p><p>Clique em baús, marcos e fogueiras para caminhar até eles. Arraste itens entre baú e mochila ou use o botão de transferência. Nas fogueiras, prepare poções e reforce sua runa.</p><p>Desktop: J abre o diário, Q usa poção, M abre o mapa, Esc fecha janelas. No celular, todas essas ações têm botões.</p></details>
      <button data-world="exit">Salvar e voltar ao início</button>`}</article>`;
    // Keep a range control stable while it is being dragged.
    if(html!==last&&document.activeElement?.dataset?.setting!=='volume'){root.innerHTML=html;last=html;}
    if(opening)root.querySelector('[data-world="close"]')?.focus();
  }
  root.addEventListener('click',e=>{
    const mapAction=e.target.closest('[data-atlas-action]')?.dataset.atlasAction;
    if(mapAction){if(mapAction==='reset')atlasView?.reset();else atlasView?.zoom(mapAction==='in'?1.25:.8);return;}
    const region=e.target.closest('[data-region]')?.dataset.region;if(region){selection=region;render();return;}
    const action=e.target.closest('[data-world]')?.dataset.world;
    if(action==='close')close();
    if(action==='exit'){actions.autoSaveGame();state.game.menuOpen=false;actions.closeActiveModal();onExit();render();}
  });
  root.addEventListener('input',e=>{if(e.target.dataset.setting==='volume')actions.setOverworldMusicVolume(Number(e.target.value)/100);});
  root.addEventListener('change',e=>{if(e.target.dataset.setting==='quality'&&QUALITY_PROFILES[e.target.value]){quality=e.target.value;applyQuality();try{localStorage.setItem(QUALITY_KEY,quality);}catch{}render();}});
  function key(e){if(root.hidden)return;if(e.key==='Escape'){e.preventDefault();close();}
    if(e.key==='Tab'){const nodes=[...root.querySelectorAll('button,input,select,summary')];if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}
  }
  document.addEventListener('keydown',key);const timer=setInterval(render,150);render();
  return{dispose(){atlasView?.dispose();clearInterval(timer);document.removeEventListener('keydown',key);root.remove();}};
}
