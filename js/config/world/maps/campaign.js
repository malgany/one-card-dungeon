// Each region is loaded independently. Roads and landmarks reserve traversable cells.
export const CAMPAIGN_START = 'vale-refugio';
const regions = [
  ['vale-refugio', 'Refúgio do Vale', 20, 0, 0, 'meadow', 1, 'O último abrigo entre as árvores. Recupere os dois selos e abra a Cripta das Raízes.'],
  ['vale-bosque', 'Bosque dos Sussurros', 24, 0, 1, 'meadow', 2, 'A seiva despertou. O Guardião de Musgo protege o selo da floresta.'],
  ['vale-estrada', 'Estrada dos Peregrinos', 24, 1, 0, 'meadow', 2, 'Caravanas abandonadas e sentinelas de osso guardam o caminho das ruínas.'],
  ['vale-ruinas', 'Ruínas do Farol', 20, 1, 1, 'stonefields', 3, 'O último vigia carrega o selo de pedra. As duas rotas se encontram aqui.'],
  ['vale-cripta', 'Cripta das Raízes', 18, 2, 1, 'stonefields', 4, 'As raízes romperam o antigo santuário. Vença os sentinelas para alcançar o trono.'],
  ['vale-trono', 'Câmara do Guardião', 16, 3, 1, 'stonefields', 5, 'O Guardião do Eclipse prepara golpes no chão. Saia das marcas antes da próxima vez dele.'],
];
const key = (x, y) => `${x},${y}`;
const maps = Object.fromEntries(regions.map(([id, name, n, gx, gy, biome, enemyLevel, description]) => [id, {
  id, name, size: { width: n, height: n }, gridPosition: { x: gx, y: gy },
  playerStart: { x: Math.floor(n / 2), y: Math.floor(n / 2) + 2 },
  biome, defaultTerrain: biome === 'meadow' ? 'grass' : 'stone',
  description, campaign: true, randomEncounters: false, authoredEncounters: true,
  enemyLevel, dangerDistance: enemyLevel, terrainPatches: [], objects: [], encounters: [], connections: [], points: [],
}]));
function link(a, b, direction, requires = null) {
  const left = maps[a], right = maps[b];
  const n = left.size.width, m = right.size.width;
  const east = direction === 'east';
  const from = east ? { x: n - 1, y: n / 2 } : { x: n / 2, y: 0 };
  const to = east ? { x: 0, y: m / 2 } : { x: m / 2, y: m - 1 };
  left.connections.push({ id: `${a}-${b}`, ...from, targetMapId: b, spawn: to, requires });
  right.connections.push({ id: `${b}-${a}`, ...to, targetMapId: a, spawn: from });
}
link('vale-refugio', 'vale-bosque', 'north');
link('vale-refugio', 'vale-estrada', 'east');
link('vale-estrada', 'vale-ruinas', 'north');
link('vale-bosque', 'vale-ruinas', 'east');
link('vale-ruinas', 'vale-cripta', 'east', 'seals');
link('vale-cripta', 'vale-trono', 'east', 'crypt');
function point(mapId, id, name, kind, x, y, text, type) {
  const map = maps[mapId];
  map.points.push({ id, name, kind, x, y, text });
  map.objects.push({ id: `${id}-model`, type, x, y });
}
point('vale-refugio', 'camp-refugio', 'Fogueira do refúgio', 'camp', 9, 12, 'O fogo ainda resiste. Vida restaurada; progresso salvo.', 'campfire');
point('vale-refugio', 'journal-start', 'Carta da guardiã', 'lore', 11, 11, 'Dois selos mantêm a cripta fechada. Procure o Guardião de Musgo no bosque e o Vigia do Farol nas ruínas. Volte às fogueiras sempre que precisar.', 'waystone');
point('vale-refugio', 'cache-start', 'Suprimentos da viagem', 'chest', 7, 12, 'Duas poções para a jornada. Use uma durante a sua vez em combate: custa 2 AP e cura 25 de vida.', 'supply-chest');
point('vale-bosque', 'camp-bosque', 'Acampamento da mata', 'camp', 12, 18, 'Sob a copa das árvores, você recupera o fôlego.', 'campfire');
point('vale-bosque', 'cache-bosque', 'Baú entre raízes', 'chest', 5, 7, 'Os peregrinos deixaram duas poções entre as raízes.', 'supply-chest');
point('vale-bosque', 'lore-bosque', 'Pedra da seiva', 'lore', 16, 6, 'A floresta não nasceu hostil. Um eco vindo da cripta retorceu suas raízes.', 'waystone');
point('vale-estrada', 'camp-estrada', 'Pouso dos peregrinos', 'camp', 9, 13, 'Os viajantes usavam este pouso antes de seguir até o farol.', 'campfire');
point('vale-estrada', 'cache-estrada', 'Carga esquecida', 'chest', 17, 7, 'Duas poções sobreviveram ao saque da caravana.', 'supply-chest');
point('vale-ruinas', 'camp-ruinas', 'Braseiro do farol', 'camp', 9, 12, 'O antigo braseiro volta a aquecer as pedras.', 'campfire');
point('vale-ruinas', 'lore-ruinas', 'Inscrição do farol', 'lore', 15, 10, 'Madeira e pedra, memória e vigília. Reúna os dois selos para atravessar a passagem a leste.', 'waystone');
point('vale-cripta', 'camp-cripta', 'Vigília subterrânea', 'camp', 4, 9, 'Um último descanso antes de encarar os sentinelas.', 'campfire');
point('vale-cripta', 'cache-cripta', 'Reserva do santuário', 'chest', 6, 5, 'Duas poções aguardavam alguém que ainda pudesse lutar.', 'supply-chest');
point('vale-trono', 'camp-trono', 'Chama da coragem', 'camp', 3, 8, 'Prepare-se. A marca vermelha anuncia onde o próximo golpe vai cair.', 'campfire');
function encounter(mapId, type, x, y, id, options = {}) {
  maps[mapId].encounters.push({ id, type, x, y, groupId: id, level: maps[mapId].enemyLevel, ...options });
}
encounter('vale-refugio', 'mossSlime', 14, 7, 'slime-practice', { hp:14,maxHp:14,attack:2,defense:0,xp:20 });
encounter('vale-bosque', 'mossSlime', 8, 12, 'bosque-slime', { hp:22,maxHp:22,attack:3,defense:0,xp:18 });
encounter('vale-bosque', 'specter', 17, 14, 'bosque-echo', { hp:26,maxHp:26,attack:4,defense:1,range:3,xp:24 });
encounter('vale-bosque', 'rootGuardian', 12, 5, 'seal-forest', { level:3,hp:44,maxHp:44,attack:5,defense:2,xp:45 });
encounter('vale-estrada', 'skeletonMinion', 12, 7, 'road-patrol', { hp:24,maxHp:24,attack:3,defense:1,xp:20 });
encounter('vale-estrada', 'skeletonRogue', 17, 12, 'road-archer', { hp:26,maxHp:26,attack:4,defense:1,xp:24 });
encounter('vale-ruinas', 'skeletonWarrior', 6, 7, 'ruins-watch', { hp:36,maxHp:36,attack:5,defense:2,xp:30 });
encounter('vale-ruinas', 'skeletonMage', 13, 5, 'seal-stone', { name: 'Vigia do Farol', hp:48,maxHp:48,xp:50,attack:6,defense:2, range: 4 });
encounter('vale-cripta', 'rootGuardian', 9, 6, 'crypt-roots', { hp:52,maxHp:52,attack:7,defense:2,xp:40 });
encounter('vale-cripta', 'specter', 13, 11, 'crypt-echo', { hp:42,maxHp:42,attack:7,defense:2,xp:40 });
encounter('vale-trono', 'eclipseWarden', 10, 7, 'eclipse-warden', { hp:100,maxHp:100,attack:8,defense:3,xp:100, visualScale: 1.25 });

for (const map of Object.values(maps)) {
  const n = map.size.width, center = n / 2;
  const reserved = new Set();
  const road = new Set();
  // A broad crossroad is a readable backbone; side paths reach every landmark.
  for (let i = 0; i < n; i++) for (const d of [-1, 0, 1]) {
    road.add(key(center + d, i)); road.add(key(i, center + d));
  }
  for (const p of [...map.points, ...map.encounters, map.playerStart, ...map.connections]) {
    for (let x = Math.min(center, p.x); x <= Math.max(center, p.x); x++) road.add(key(x, p.y));
    for (let x = p.x - 1; x <= p.x + 1; x++) for (let y = p.y - 1; y <= p.y + 1; y++) reserved.add(key(x, y));
  }
  map.terrainPatches.push({ terrain: 'dirt', cells: [...road].map(s => s.split(',').map(Number)) });
  let seed = [...map.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const dungeon = ['vale-cripta', 'vale-trono'].includes(map.id);
  const types = dungeon ? ['dungeon-column', 'dungeon-rubble', 'dungeon-barrel']
    : map.biome === 'stonefields' ? ['dungeon-column', 'forest-rock', 'dead-tree', 'forest-bush']
      : ['forest-tree', 'forest-tree', 'forest-bush', 'forest-rock'];
  for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
    if (road.has(key(x, y)) || reserved.has(key(x, y))) continue;
    if (random() > (dungeon ? 0.12 : 0.20)) continue;
    map.objects.push({ id: `${map.id}-decor-${x}-${y}`, type: types[Math.floor(random() * types.length)], x, y, rotation: { y: random() * Math.PI * 2 } });
  }
  // Broken perimeter silhouettes hide the board edge without closing its exits.
  for (let i = 1; i < n - 1; i += 2) for (const [x, y] of [[i, 0], [i, n - 1], [0, i], [n - 1, i]]) {
    if (road.has(key(x, y)) || reserved.has(key(x, y))) continue;
    map.objects.push({ id: `${map.id}-edge-${x}-${y}`, type: dungeon ? 'dungeon-column' : 'forest-tree', x, y });
  }
}
export const CAMPAIGN_MAPS = maps;
