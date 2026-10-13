import { getWorldMap } from '../config/world/index.js';

export function ensureCampaign(game) {
  if (!game.campaign || game.campaign.version !== 1) game.campaign = {
    version: 1, defeated: [], discovered: [], claimed: [], potions: 1, completed: false,
  };
  const c = game.campaign;
  for (const key of ['defeated', 'discovered', 'claimed']) if (!Array.isArray(c[key])) c[key] = [];
  c.potions = Math.max(0, Math.floor(Number(c.potions) || 0));
  return c;
}
export function campaignGateMessage(game, connection) {
  const c = ensureCampaign(game);
  if (connection?.requires === 'seals' && !['seal-forest', 'seal-stone'].every(id => c.defeated.includes(id))) {
    return 'A cripta precisa dos dois selos: vença o Guardião de Musgo no bosque e o Vigia do Farol nas ruínas.';
  }
  if (connection?.requires === 'crypt' && !['crypt-roots', 'crypt-echo'].every(id => c.defeated.includes(id))) {
    return 'Derrote os dois sentinelas da cripta para abrir a câmara do Guardião.';
  }
  return null;
}
export function recordCampaignVictory(game, groupId) {
  const c = ensureCampaign(game);
  if (c.defeated.includes(groupId)) return null;
  c.defeated.push(groupId);
  if (groupId === 'seal-forest' || groupId === 'seal-stone') {
    c.potions += 1;
    return { title: groupId === 'seal-forest' ? 'Selo da Floresta recuperado' : 'Selo de Pedra recuperado', text: 'Uma poção recebida. Reúna os dois selos e siga para a passagem leste das Ruínas do Farol.' };
  }
  if (groupId === 'eclipse-warden') {
    c.completed = true;
    game.player.health = game.player.maxHealth;
    return { title: 'O vale respira outra vez', text: 'O Guardião caiu. A campanha foi concluída! Você pode continuar explorando e encontrar os baús restantes.' };
  }
  return null;
}
export function campaignObjectives(game) {
  const c = ensureCampaign(game);
  return [
    { title: 'O chamado do vale', detail: 'Leia a carta junto à fogueira do Refúgio.', done: c.discovered.includes('journal-start') },
    { title: 'A memória da floresta', detail: 'Vença o Guardião de Musgo no Bosque dos Sussurros.', done: c.defeated.includes('seal-forest') },
    { title: 'A vigília de pedra', detail: 'Vença o Vigia do Farol nas Ruínas do Farol.', done: c.defeated.includes('seal-stone') },
    { title: 'Sob as raízes', detail: 'Abra a cripta a leste das ruínas e vença seus dois sentinelas.', done: ['crypt-roots', 'crypt-echo'].every(id => c.defeated.includes(id)) },
    { title: 'O último eclipse', detail: 'Derrote o Guardião. Saia das marcas vermelhas antes do golpe.', done: c.completed },
  ];
}
export function nearbyCampaignPoint(game) {
  if (game.mode !== 'overworld' || game.busy || game.cutscene) return null;
  const map = getWorldMap(game.overworld?.currentMapId);
  return map?.points?.filter(p => Math.abs(p.x - game.player.x) + Math.abs(p.y - game.player.y) <= 2)
    .sort((a,b) => (Math.abs(a.x-game.player.x)+Math.abs(a.y-game.player.y)) - (Math.abs(b.x-game.player.x)+Math.abs(b.y-game.player.y)))[0] || null;
}
export function interactCampaignPoint(game, point = nearbyCampaignPoint(game)) {
  if (!point || game.busy || game.mode !== 'overworld') return null;
  // Never accept a remote point, including calls from debug/test clients.
  const map = getWorldMap(game.overworld?.currentMapId);
  point = map?.points?.find(p => p.id === point.id);
  if (!point || Math.abs(point.x - game.player.x) + Math.abs(point.y - game.player.y) > 2) return null;
  const c = ensureCampaign(game);
  if (point.kind === 'camp') game.player.health = game.player.maxHealth;
  if (point.kind === 'chest') {
    if (c.claimed.includes(point.id)) return { title: point.name, text: 'Este baú já foi recolhido.' };
    c.claimed.push(point.id); c.potions += 2;
  }
  if (!c.discovered.includes(point.id)) c.discovered.push(point.id);
  return { title: point.name, text: point.text };
}
export function useCampaignPotion(game) {
  const c = ensureCampaign(game);
  if (game.busy || game.cutscene || !['overworld', 'combat'].includes(game.mode) || c.potions < 1 || game.player.health >= game.player.maxHealth) return false;
  if (game.mode === 'combat' && (game.turnQueue?.[0] !== 'player' || game.apRemaining < 2)) return false;
  c.potions--; game.player.health = Math.min(game.player.maxHealth, game.player.health + 25);
  if (game.mode === 'combat') game.apRemaining -= 2;
  return true;
}
export function bossBlastCells(player, size = 6) {
  return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: player.x + dx, y: player.y + dy }))
    .filter(p => p.x >= 0 && p.y >= 0 && p.x < size && p.y < size);
}
