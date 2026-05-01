# KayKit Skeletons

Pacote importado: `KayKit_Skeletons_1.1_FREE`.

Os arquivos de runtime foram organizados em `assets/models/skeletons/`.
Foram mantidos os formatos usados pelo jogo (`glb`, `gltf`, `bin` e `png`) e descartadas as copias FBX/OBJ/Unity, atalhos informativos e imagens de catalogo.

## Estrutura

- `assets/models/skeletons/characters/`: personagens GLB com textura embutida.
- `assets/models/skeletons/animations/rig-medium/`: animacoes GLB compativeis com o rig `Rig_Medium`.
- `assets/models/skeletons/props/`: armas, escudos e itens em GLTF com seus `.bin` e `skeleton_texture.png`.
- `assets/models/skeletons/License.txt`: licenca original do pacote.
- `assets/characters/skeleton-*.png`: imagens 2D dos samples usadas por cartas, banners e HUD.

## Personagens

- `minion.glb`
- `rogue.glb`
- `mage.glb`
- `warrior.glb`

## Mapeamento No Jogo

- `spider` -> `skeletonMinion`
- `skeleton` -> `skeletonWarrior`
- `archer` -> `skeletonRogue`
- `golem` -> `skeletonMage`

Os saves antigos passam por migracao em `js/game/game-actions.js`, convertendo tipos, ids e grupos antigos para os novos nomes.

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
- Andando: `Walking_A`
- Ataque em combate: `Hit_A`
- Dano recebido em combate: `Hit_B`

## Props

- `Skeleton_Arrow`
- `Skeleton_Arrow_Broken`
- `Skeleton_Arrow_Broken_Half`
- `Skeleton_Arrow_Half`
- `Skeleton_Axe`
- `Skeleton_Blade`
- `Skeleton_Crossbow`
- `Skeleton_Quiver`
- `Skeleton_Shield_Large_A`
- `Skeleton_Shield_Large_B`
- `Skeleton_Shield_Small_A`
- `Skeleton_Shield_Small_B`
- `Skeleton_Staff`
