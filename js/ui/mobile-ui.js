import { CHARACTERISTIC_DEFINITIONS, PHASES } from '../config/game-data.js';
import { isMobileLayout } from './mobile-layout.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

export function createMobileUI(state, actions) {
  const root = document.createElement('section');
  root.id = 'mobile-controls';
  root.setAttribute('aria-label', 'Controles de toque');
  root.innerHTML = `<div class="mobile-zoom"><button data-mobile="out" aria-label="Afastar câmera">−</button><button data-mobile="reset" aria-label="Restaurar câmera">◎</button><button data-mobile="in" aria-label="Aproximar câmera">+</button></div>
    <div class="mobile-dock"><div class="mobile-status"></div><div class="mobile-attacks"></div><nav class="mobile-navigation"><button data-mobile="character">Herói</button><button data-mobile="spells">Feitiços</button><button data-mobile="map">Mapa</button><button data-mobile="menu">Menu</button></nav><button class="mobile-end-turn" data-mobile="end">Fim de turno</button><p class="mobile-hint"></p></div>
    <div class="mobile-modal" hidden><article role="dialog" aria-modal="true" aria-label="Personagem"><button class="mobile-close" data-mobile="close">Fechar</button><div class="mobile-modal-content"></div></article></div>`;
  document.body.append(root);
  const find = selector => root.querySelector(selector);
  let attackSignature = '', modalSignature = '';
  function render() {
    const g = state.game;
    root.hidden = !isMobileLayout(innerWidth, innerHeight) || !document.getElementById('menu-root')?.hidden || !!g.cutscene;
    if (root.hidden) return;
    const combat = g.mode === 'combat';
    const ownTurn = g.phase === PHASES.HERO && !g.busy;
    const blocked = !!g.activeModal || g.menuOpen;
    const customModal = ['characteristics', 'spells'].includes(g.activeModal);
    find('.mobile-dock').hidden = blocked;
    find('.mobile-zoom').hidden = blocked;
    find('.mobile-modal').hidden = !customModal;
    if (customModal) {
      const p = g.player;
      const content = g.activeModal === 'characteristics'
        ? `<h2>Características</h2><p>Vida ${p.health}/${p.maxHealth} · ${p.characteristicPoints} pontos livres</p>${Object.values(CHARACTERISTIC_DEFINITIONS).map(d => `<div class="mobile-stat"><span>${escape(d.label)}: ${p.characteristics?.[d.key] || 0}</span><button data-stat="${escape(d.key)}" ${p.characteristicPoints > 0 ? '' : 'disabled'} aria-label="Aumentar ${escape(d.label)}">+</button></div>`).join('')}`
        : `<h2>Feitiços</h2>${actions.getPlayerSpellbook(p).map(s => `<section><h3>${escape(s.name)}</h3><p>${s.locked ? `Libera no nível ${s.unlockLevel} · ` : ''}${s.apCost} AP · ${actions.getAttackDamage(s, p)} dano · Alcance ${escape(actions.getAttackRangeLabel(s, p))}</p></section>`).join('')}`;
      if (content !== modalSignature) { find('.mobile-modal-content').innerHTML = content; modalSignature = content; }
    }
    if (blocked) return;
    find('.mobile-status').textContent = `♥ ${g.player.health}/${g.player.maxHealth}   •   AP ${g.apRemaining ?? g.player.apMax}   •   Passos ${g.speedRemaining ?? g.player.speedBase}`;
    find('.mobile-navigation').hidden = combat;
    find('.mobile-attacks').hidden = !combat;
    const end = find('.mobile-end-turn');
    end.hidden = !combat;
    end.disabled = !ownTurn;
    const timer = actions.getHeroTurnTimer?.();
    end.textContent = ownTurn ? `Fim de turno${timer ? ` · ${timer.remainingSeconds}s` : ''}` : 'Turno dos inimigos';
    if (combat && ownTurn && timer?.remainingMs <= 0) actions.endHeroPhase();
    const attacks = combat ? actions.getAvailableAttacks(g) : [];
    const html = attacks.map(a => `<button data-attack="${escape(a.id)}" aria-pressed="${g.selectedAttackId === a.id}" ${!ownTurn || g.apRemaining < a.apCost ? 'disabled' : ''}>${escape(a.name)}<small>${a.apCost} AP</small></button>`).join('');
    if (html !== attackSignature) { find('.mobile-attacks').innerHTML = html; attackSignature = html; }
    find('.mobile-hint').textContent = combat ? (g.selectedAttackId ? 'Toque no alvo destacado para atacar.' : 'Toque no chão para mover ou escolha um ataque.') : 'Toque no chão para andar; no inimigo para enfrentar.';
  }
  function click(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.attack) actions.toggleAttackSelection(button.dataset.attack);
    if (button.dataset.stat) actions.allocateCharacteristic(button.dataset.stat);
    const handlers = {
      out: () => { state.debugZoom = Math.max(0.65, (state.debugZoom || 1.15) / 1.15); },
      in: () => { state.debugZoom = Math.min(state.game.mode === 'combat' ? 1.15 : 1.8, (state.debugZoom || 1.15) * 1.15); },
      reset: () => { state.debugZoom = 1.15; },
      end: actions.endHeroPhase,
      character: actions.openCharacteristicsModal,
      spells: actions.openSpellsModal,
      map: actions.openWorldMapModal,
      close: actions.closeActiveModal,
      menu: () => { state.game.menuOpen = true; state.game.menuView = 'main'; },
    };
    handlers[button.dataset.mobile]?.();
    render();
  }
  root.addEventListener('click', click);
  const timer = setInterval(render, 100);
  render();
  return { dispose() { clearInterval(timer); root.remove(); } };
}
