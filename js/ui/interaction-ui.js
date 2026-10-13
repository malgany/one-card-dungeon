import { getWorldMap } from '../config/world/index.js';
import { ITEM_TYPES, bagItems, chestItems, inventorySlots, moveInventoryStack } from '../game/inventory.js';
import { craftAtCamp, runeRecipe } from '../game/camp-crafting.js';
import { itemArt } from './inventory-art.js';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art=id=>`<svg class="item-pixel-art" viewBox="0 0 32 32" aria-hidden="true" shape-rendering="crispEdges">${itemArt[id]}</svg>`;
export function createInteractionUI(state,actions){
  const root=document.createElement('section');root.id='interaction-ui';root.hidden=true;document.body.append(root);
  const tooltip=document.createElement('div');tooltip.className='game-item-tooltip';tooltip.id='inventory-tooltip';tooltip.role='tooltip';tooltip.hidden=true;document.body.append(tooltip);
  let last='',selected=null,pointer=null,ghost=null,dropTarget=null,previousFocus=null,suppressClickUntil=0;
  const currentPoint=()=>getWorldMap(state.game.overworld?.currentMapId)?.points?.find(p=>p.id===state.game.campaignInteraction?.pointId);
  const slots=side=>inventorySlots(state.game,side,currentPoint()?.id);
  function pane(title,items,side){
    return `<section class="inventory-pane" data-inventory-side="${side}"><div class="inventory-pane-heading"><h3>${title}</h3></div><div class="inventory-grid" role="group" aria-label="${title}">${slots(side).map((id,index)=>`<button class="inventory-slot ${id?'inventory-item':'inventory-slot-empty'} ${selected?.side===side&&selected?.slot===index?'is-selected':''}" draggable="false" data-slot="${index}" data-side="${side}" ${id?`data-item="${id}"`:''} aria-pressed="${selected?.side===side&&selected?.slot===index}" aria-label="${id?`${esc(ITEM_TYPES[id].name)}, ${items[id]} unidades`:'Vazio'}, espaço ${index+1}">${id?`${art(id)}<b class="item-count">${items[id]}</b>`:''}</button>`).join('')}</div></section>`;
  }
  function clearDropTarget(){dropTarget?.classList.remove('is-drop-target');dropTarget?.querySelector('.slot-drop-preview')?.remove();dropTarget=null;}
  function cancelDrag(){
    if(pointer&&root.hasPointerCapture?.(pointer.pointerId))root.releasePointerCapture(pointer.pointerId);
    pointer=null;ghost?.remove();ghost=null;clearDropTarget();tooltip.hidden=true;
  }
  function close(){cancelDrag();actions.closeActiveModal();state.game.campaignInteraction=null;selected=null;render();previousFocus?.focus?.();}
  function render(){
    const g=state.game,visible=['campaignInteraction','campaignBag'].includes(g.activeModal)&&!!document.getElementById('menu-root')?.hidden;
    if(!visible){root.hidden=true;last='';cancelDrag();return;}
    if(pointer)return;
    const opening=root.hidden;root.hidden=false;if(opening)previousFocus=document.activeElement;
    const p=g.activeModal==='campaignInteraction'?currentPoint():null;
    const chest=p?.kind==='chest'?chestItems(g,p.id):null,bag=bagItems(g),inventory=!p||p.kind==='chest';
    if(selected&&slots(selected.side)?.[selected.slot]!==selected.id)selected=null;
    const item=selected&&ITEM_TYPES[selected.id],rune=runeRecipe(g);
    const workshop=p?.kind==='camp'?`<div class="camp-workshop"><h3>Preparar a jornada</h3><div><strong>Poção de vida</strong><p>2 ervas → 1 poção. Você tem ${bag.herb} ervas.</p><button data-craft="potion" ${bag.herb<2?'disabled':''}>Preparar poção</button></div><div><strong>Runa da jornada · ${rune.rank}/3</strong><p>Seus ataques recebem +${rune.rank*2} de dano. ${rune.rank<3?`Próximo grau: ${rune.cost} fragmentos. Você tem ${bag.shard}.`: 'Runa no grau máximo.'}${!rune.unlocked?' O último grau requer os dois selos.':''}</p><button data-craft="rune" ${rune.rank>=3||bag.shard<rune.cost||!rune.unlocked?'disabled':''}>Reforçar runa · +2 dano</button></div></div>`:'';

    const html=inventory?`<article class="inventory-layout" role="dialog" aria-modal="true" aria-label="${chest?'Baú e mochila':'Sua mochila'}"><button class="inventory-close" data-interaction="close" aria-label="Fechar inventário">×</button><div class="inventory-columns ${chest?'':'inventory-single'}">${pane('Sua mochila',bag,'bag')}${chest?pane('Baú',chest,'chest'):''}</div><div class="inventory-help">${item?`<strong>${esc(item.name)}</strong><span>${esc(item.description)}</span>${chest?`<button data-interaction="transfer">${selected.side==='chest'?'← Levar pilha':'Guardar pilha →'}</button>`:''}`:'Arraste a pilha até um espaço. No toque, selecione o item e depois o espaço de destino.'}</div><p class="inventory-feedback" role="status" aria-live="polite"></p></article>`:
      `<article class="interaction-panel" role="dialog" aria-modal="true" aria-label="${esc(p.name)}"><header><h2>${esc(p.name)}</h2><button data-interaction="close" aria-label="Fechar interação">Fechar</button></header><div class="interaction-story"><div class="interaction-symbol">${p.kind==='camp'?'♨':'✦'}</div><p>${esc(p.text)}</p>${p.kind==='camp'?`<p class="rest-result">Vida restaurada: ${g.player.health}/${g.player.maxHealth}. Progresso salvo.</p>`:''}</div>${workshop}<p class="inventory-feedback" role="status" aria-live="polite"></p></article>`;
    if(html!==last){
      const focus=root.contains(document.activeElement)?document.activeElement?.dataset:null;
      tooltip.hidden=true;root.innerHTML=html;last=html;
      if(focus?.slot)root.querySelector(`[data-slot="${focus.slot}"][data-side="${focus.side}"]`)?.focus({preventScroll:true});
      else if(focus?.interaction)root.querySelector(`[data-interaction="${focus.interaction}"]`)?.focus({preventScroll:true});
    }
    if(opening){root.querySelector('[data-interaction="close"]')?.focus();actions.autoSaveGame();}
  }
  function move(source,side,index){
    if(!source||!moveInventoryStack(state.game,currentPoint()?.id,source.side,source.slot,side,index))return false;
    selected={id:source.id,side,slot:index};actions.autoSaveGame();last='';render();
    root.querySelector('.inventory-feedback').textContent=`${ITEM_TYPES[source.id].name}: pilha no espaço ${index+1} ${side==='bag'?'da mochila':'do baú'}.`;
    return true;
  }
  function click(event){
    if(Date.now()<suppressClickUntil)return;
    const recipe=event.target.closest('[data-craft]')?.dataset.craft;
    if(recipe&&craftAtCamp(state.game,recipe)){actions.autoSaveGame();last='';render();root.querySelector('.inventory-feedback').textContent=recipe==='potion'?'Poção preparada.':'Runa reforçada.';return;}
    const slot=event.target.closest('[data-slot]');
    if(slot){
      const {side,item,slot:index}=slot.dataset;
      if(selected&&(!item||selected.side!==side)){move(selected,side,Number(index));return;}
      selected=item?{id:item,side,slot:Number(index)}:null;render();return;
    }
    const action=event.target.closest('[data-interaction]')?.dataset.interaction;
    if(action==='close')close();
    if(action==='transfer'&&selected){const side=selected.side==='bag'?'chest':'bag',dest=slots(side);move(selected,side,dest.includes(selected.id)?dest.indexOf(selected.id):dest.indexOf(null));}
  }
  function showTooltip(element){
    const id=element?.dataset.item;if(!id||pointer||root.hidden){tooltip.hidden=true;return;}
    tooltip.innerHTML=`<strong>${esc(ITEM_TYPES[id].name)}</strong><span>${esc(ITEM_TYPES[id].description)}</span><small>Arraste para mover a pilha inteira</small>`;tooltip.hidden=false;
    const r=element.getBoundingClientRect(),t=tooltip.getBoundingClientRect();
    tooltip.style.left=`${Math.max(8,Math.min(window.innerWidth-t.width-8,r.left))}px`;
    tooltip.style.top=`${Math.max(8,Math.min(window.innerHeight-t.height-8,r.top-t.height-8))}px`;
  }
  function pointerDown(event){
    const item=event.target.closest('[data-item]');if(!item||event.button!==0||pointer)return;
    tooltip.hidden=true;pointer={id:item.dataset.item,side:item.dataset.side,slot:Number(item.dataset.slot),x:event.clientX,y:event.clientY,pointerId:event.pointerId,art:item.innerHTML};
    root.setPointerCapture?.(event.pointerId);
  }
  function targetAt(event){return document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-slot]');}
  function pointerMove(event){
    if(!pointer||pointer.pointerId!==event.pointerId)return;
    if(!ghost&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>8){ghost=document.createElement('div');ghost.className='inventory-drag-ghost';ghost.innerHTML=pointer.art;ghost.setAttribute('aria-hidden','true');root.append(ghost);}
    if(!ghost)return;
    event.preventDefault();ghost.style.left=`${event.clientX}px`;ghost.style.top=`${event.clientY}px`;
    const target=targetAt(event);
    if(target!==dropTarget){clearDropTarget();if(target&&root.contains(target)&&!(target.dataset.side===pointer.side&&Number(target.dataset.slot)===pointer.slot)){dropTarget=target;target.classList.add('is-drop-target');const preview=document.createElement('span');preview.className='slot-drop-preview';preview.innerHTML=pointer.art;target.append(preview);}}
  }
  function pointerUp(event){
    if(!pointer||pointer.pointerId!==event.pointerId)return;
    const source=pointer,target=targetAt(event),moved=!!ghost;cancelDrag();
    if(moved){suppressClickUntil=Date.now()+400;event.preventDefault();if(target&&root.contains(target))move(source,target.dataset.side,Number(target.dataset.slot));else render();}
    else { // Pointer capture retargets click to the root; handle taps here.
      if(selected&&selected.side!==source.side)move(selected,source.side,source.slot);
      else {selected={id:source.id,side:source.side,slot:source.slot};render();}
      suppressClickUntil=Date.now()+100;
    }
  }
  function key(event){
    if(root.hidden)return;
    if(event.key==='Escape'){event.preventDefault();if(pointer)cancelDrag();else close();}
    if(event.key==='Tab'){const f=[...root.querySelectorAll('button:not(:disabled)')];if(event.shiftKey&&document.activeElement===f[0]){event.preventDefault();f.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===f.at(-1)){event.preventDefault();f[0]?.focus();}}
  }
  root.addEventListener('pointerdown',pointerDown);root.addEventListener('pointermove',pointerMove);root.addEventListener('pointerup',pointerUp);
  root.addEventListener('pointercancel',()=>{cancelDrag();render();});root.addEventListener('click',click);
  root.addEventListener('pointerover',e=>{if(e.pointerType!=='touch')showTooltip(e.target.closest('[data-item]'));});
  root.addEventListener('pointerout',()=>{tooltip.hidden=true;});root.addEventListener('focusin',e=>{if(e.target.matches(':focus-visible'))showTooltip(e.target.closest('[data-item]'));});root.addEventListener('focusout',()=>{tooltip.hidden=true;});root.addEventListener('scroll',()=>{tooltip.hidden=true;},true);
  const resize=()=>{tooltip.hidden=true;};window.addEventListener('resize',resize);
  document.addEventListener('keydown',key);const timer=setInterval(render,120);render();
  return {dispose(){cancelDrag();clearInterval(timer);window.removeEventListener('resize',resize);document.removeEventListener('keydown',key);tooltip.remove();root.remove();}};
}
