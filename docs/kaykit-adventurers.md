# KayKit Adventurers

Pacote importado: `KayKit_Adventurers_2.0_FREE`.

Os arquivos de runtime foram organizados em `assets/models/adventurers/`.
Foram mantidos os formatos usados pelo jogo (`glb`, `gltf`, `bin` e `png`) e descartadas as copias FBX/OBJ/Unity e atalhos informativos.

## Estrutura

- `assets/models/adventurers/characters/`: personagens GLB com textura embutida.
- `assets/models/adventurers/animations/rig-medium/`: animacoes GLB compativeis com o rig `Rig_Medium`.
- `assets/models/adventurers/props/`: armas, escudos e itens em GLTF com seus `.bin` e texturas.
- `assets/models/adventurers/textures/`: texturas PNG originais por classe.
- `assets/models/adventurers/License.txt`: licenca original do pacote.
- `assets/characters/mage.png`: imagem 2D do mago usada por cartas, banners e HUD.

## Personagens

- `barbarian.glb`
- `knight.glb`
- `mage.glb`
- `ranger.glb`
- `rogue.glb`
- `rogue-hooded.glb`

O jogador padrao usa `mage.glb`.

## Animacoes

`animations/rig-medium/general.glb`:

- `Death_A`
- `Death_A_Pose`
- `Death_B`
- `Death_B_Pose`
- `Hit_A`
- `Hit_B`
- `Idle_A`
- `Idle_B`
- `Interact`
- `PickUp`
- `Spawn_Air`
- `Spawn_Ground`
- `T-Pose`
- `Throw`
- `Use_Item`

`animations/rig-medium/movement-basic.glb`:

- `Jump_Full_Long`
- `Jump_Full_Short`
- `Jump_Idle`
- `Jump_Land`
- `Jump_Start`
- `Running_A`
- `Running_B`
- `T-Pose`
- `Walking_A`
- `Walking_B`
- `Walking_C`

Uso atual no jogo:

- Parado: `Idle_A`
- Andando/correndo: `Running_B` para aventureiros do jogador
- Ataque padrao do jogador em combate: `Throw`
- Flecha Hirvante do patrulheiro: `Ranged_Bow_Release` do pacote `KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_CombatRanged.glb`
- Dano recebido pelo jogador em combate: `Hit_B`

## Encaixe De Arco E Flecha

O patrulheiro (`ranger.glb`) usa props do pacote Adventurers para nao tocar animacoes de arco com as maos vazias:

- arco: `assets/models/adventurers/props/bow_withString.gltf`
- flecha na mao: `assets/models/adventurers/props/arrow_bow.gltf`

O renderer registra esses caminhos em `WORLD_ASSETS.props` e os anexa em `js/ui/three-board-view.js` pela configuracao `PLAYER_MODELS.ranger.equipment`.
Os pontos preferidos sao `handslot.l` e `handslot.r`; como o `GLTFLoader` pode normalizar nomes, o codigo tambem tenta `hand.l`/`wrist.l` e `hand.r`/`wrist.r`.

Regra visual atual:

- no mundo aberto, o patrulheiro nao segura arco;
- no ataque basico do patrulheiro, o jogador continua usando `Throw` sem arco/projetil;
- arco e flecha aparecem apenas durante clipes de arco, como `Ranged_Bow_Release`;
- o projetil disparado ate o inimigo usa outro clone de `arrow_bow.gltf` com animacao `type: 'projectile'`.

## Props

- `arrow_bow`
- `arrow_bow_bundle`
- `arrow_crossbow`
- `arrow_crossbow_bundle`
- `axe_1handed`
- `axe_2handed`
- `bow`
- `bow_withString`
- `crossbow_1handed`
- `crossbow_2handed`
- `dagger`
- `mug_empty`
- `mug_full`
- `quiver`
- `shield_badge`
- `shield_badge_color`
- `shield_round`
- `shield_round_barbarian`
- `shield_round_color`
- `shield_spikes`
- `shield_spikes_color`
- `shield_square`
- `shield_square_color`
- `smokebomb`
- `spellbook_closed`
- `spellbook_open`
- `staff`
- `sword_1handed`
- `sword_2handed`
- `sword_2handed_color`
- `wand`
