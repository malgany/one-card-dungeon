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
- Andando: `Walking_A`
- Ataque do jogador em combate: `Hit_A`
- Dano recebido pelo jogador em combate: `Hit_B`

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
