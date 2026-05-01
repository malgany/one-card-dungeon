# Guia De Modelos GLTF/GLB

Este documento resume o fluxo para adicionar modelos 3D no mundo aberto usando `GLTFLoader`.
O objetivo e cortar caminho na proxima vez que for incluir um `.gltf` ou `.glb`, evitando retrabalho em build, pasta de assets, config de objeto, cor/textura e renderizacao.

## Padrao De Arquivos

Use uma pasta por modelo dentro de `assets/models/`.

Exemplo recomendado:

```text
assets/models/
  test-model/
    test-model.gltf
    test-model.bin
    test-model.png
  scenery/
    arvore.glb
```

Regras praticas:

- Mantenha o `.gltf`, o `.bin` e todas as texturas no mesmo diretorio.
- Para `.glb`, o binario e as texturas podem estar embutidos no proprio arquivo; nesse caso um unico arquivo pode bastar.
- Use nomes em minusculo, sem espacos, com `-` quando precisar separar palavras.
- Os caminhos internos do `.gltf` sao resolvidos relativo ao proprio arquivo `.gltf`.
- Se a exportacao gerar mais texturas, deixe tudo junto na mesma pasta e preserve os nomes que o glTF espera.
- Prefira exportar materiais em glTF 2.0 PBR Metallic Roughness (`pbrMetallicRoughness.baseColorTexture`). Modelos antigos podem usar `KHR_materials_pbrSpecularGlossiness`, que precisa de fallback no renderer para aparecer com cor.

## Passo A Passo

### 1. Organize o asset

Coloque o modelo e seus arquivos auxiliares em uma pasta propria em `assets/models/`.

Se o modelo vier de Blender ou de outro exportador, confira se:

- o `.gltf` aponta para o `.bin` correto;
- as imagens referenciadas existem na mesma pasta;
- nao houve renomeacao manual que quebrou os URIs do glTF.

Para `.glb`, confira se o arquivo carrega como `200` no navegador e se o tamanho nao ficou pequeno demais para o mundo. O modelo `assets/models/scenery/arvore.glb`, por exemplo, vem com textura embutida e serve como objeto de cenario.

### 2. Registre o asset

Edite `js/config/world/assets.js` e centralize o caminho do modelo em `WORLD_ASSETS`.

Exemplo:

```js
export const WORLD_ASSETS = {
  objects: {
    tree: './assets/models/scenery/arvore.glb',
  },
};
```

Isso evita espalhar strings de caminho em varios arquivos e facilita trocar o arquivo depois.

### 3. Registre o tipo do objeto

Edite `js/config/world/objects.js` e crie um tipo com `shape: 'model'`.

Exemplo:

```js
tree: {
  id: 'tree',
  name: 'Arvore',
  shape: 'model',
  modelUrl: WORLD_ASSETS.objects.tree,
  blocksMovement: true,
  scale: 8,
  rotation: { x: 0, y: 0, z: 0 },
},
```

Notas:

- `blocksMovement: true` faz o objeto bloquear o caminho no mundo aberto.
- `blocksMovement: false` serve para decoracao que nao interfere no pathfinding.
- `scale` e `rotation` sao uteis para ajustar proporcao e orientacao sem mexer no asset.
- `groundOffset` pode ser usado se a base ainda ficar enterrada ou flutuando depois da centralizacao automatica.
- O `scale` depende do asset exportado. A `arvore.glb` usa `scale: 8` porque veio muito pequena para a grade apos a escala interna do GLB.

### 4. Coloque uma instancia no mapa

Edite o arquivo do mapa, por exemplo `js/config/world/maps/open-road.js`, e adicione uma instancia do objeto:

```js
{ id: 'open-road-tree-0', type: 'tree', x: 4, y: 7 },
```

O renderer usa essas coordenadas para posicionar o modelo no tile correspondente.

### 5. Confirme o suporte no carregador

O jogo usa `GLTFLoader` em `js/ui/three-board-view.js`.
O Vite resolve `three` e `three/addons/...` no build, entao nao coloque caminhos para `node_modules` no HTML.
Se o build falhar ao importar addons, confira se o pacote `three` esta instalado e se o import usa o prefixo `three/addons/`.

## O Que O Renderer Faz

O fluxo atual do renderer para `shape: 'model'` e:

1. cria um `THREE.Group` para o objeto;
2. carrega o `.gltf` ou `.glb` de forma assincrona;
3. calcula a `Box3` do modelo para centralizar o conteudo;
4. ajusta a base para encostar no chao em `Y = 0`;
5. aplica `DoubleSide` nas malhas para evitar face sumindo por culling;
6. habilita sombras nas malhas;
7. aplica `scale` e `rotation` vindos da config do objeto.

### Cor E Textura

O `GLTFLoader` aplica normalmente materiais glTF 2.0 com `pbrMetallicRoughness.baseColorTexture`.

Alguns modelos, como `assets/models/scenery/arvore.glb`, carregam a cor pela extensao legacy `KHR_materials_pbrSpecularGlossiness`, usando `diffuseTexture`. Versoes atuais do Three.js podem carregar a malha sem converter essa textura para `material.map`, deixando o objeto sem a cor esperada.

Para esse caso, `js/ui/three-board-view.js` tem o fallback `applyLegacyDiffuseTexture(gltf, material)`:

1. usa `gltf.parser.associations` para descobrir o indice do material original;
2. le `gltf.parser.json.materials[materialIndex].extensions.KHR_materials_pbrSpecularGlossiness`;
3. pega `diffuseFactor`, quando existir, como cor/opacidade;
4. carrega `diffuseTexture.index` via `gltf.parser.getDependency('texture', index)`;
5. define `texture.colorSpace = THREE.SRGBColorSpace`;
6. aplica a textura em `material.map`;
7. ajusta `metalness` e `roughness` para um resultado menos metalico.

Esse fallback deve ficar restrito a modelos que nao trouxeram `material.map`. Se o material ja veio correto, o renderer nao deve sobrescrever a textura.

Detalhe importante:

- nao force `texture.needsUpdate = true` em texturas do GLTF a menos que voce tenha trocado a imagem manualmente;
- esse tipo de update prematuro costuma gerar o warning `Texture marked for update but no image data found`.
- se o modelo aparecer branco/cinza, inspecione o JSON do GLB/GLTF e procure por `pbrMetallicRoughness.baseColorTexture` ou `KHR_materials_pbrSpecularGlossiness.diffuseTexture`.

## Checklist Rapido Quando Nao Aparece

- Confirme se o `modelUrl` aponta para o arquivo certo.
- Confirme se `WORLD_ASSETS` aponta para o arquivo certo.
- Confirme se `assets/models/<pasta>/` existe e se o `.gltf` encontra o `.bin` e as texturas. Para `.glb`, confirme se o arquivo unico existe.
- Abra o DevTools e verifique se `gltf`, `glb`, `bin` e `png` estao voltando `200`, conforme o formato usado.
- Confirme se o tipo do objeto e `shape: 'model'`.
- Confirme se o objeto foi adicionado ao mapa correto.
- Ajuste `scale` se o asset estiver pequeno ou grande demais para a grade.
- Use `rotation` se o modelo exportado vier de lado.
- Use `groundOffset` se o modelo estiver flutuando ou enterrado.
- Se a malha usar transparencia, confirme se a textura PNG realmente tem alpha.
- Se o modelo desaparecer dependendo do angulo, mantenha `DoubleSide` nas malhas.
- Se o modelo aparecer sem cor, verifique se ele usa `KHR_materials_pbrSpecularGlossiness` e se `applyLegacyDiffuseTexture` esta sendo chamado durante o traverse das malhas.

## Exemplo De Cadastro: Arvore

Arquivos envolvidos para deixar a arvore colorida pronta para uso no cenario:

- `assets/models/scenery/arvore.glb`: modelo GLB com textura embutida.
- `js/config/world/assets.js`: `WORLD_ASSETS.objects.tree`.
- `js/config/world/objects.js`: tipo `tree` com `shape: 'model'`, `blocksMovement: true` e `scale: 8`.
- `js/config/world/maps/*.js`: local onde uma instancia `{ id: 'open-road-tree-0', type: 'tree', x: 4, y: 7 }` pode ser adicionada quando quiser mostrar a arvore no mapa.
- `js/ui/three-board-view.js`: carregamento do modelo e fallback de textura legacy.

## Pacote KayKit Adventurers

O pacote KayKit Adventurers fica organizado em `assets/models/adventurers/`.
Veja `docs/kaykit-adventurers.md` para a lista de personagens, props e animacoes disponiveis.
O jogador padrao usa `assets/models/adventurers/characters/mage.glb` com `Idle_A` parado, `Walking_A` durante movimento, `Hit_A` no ataque em combate e `Hit_B` ao receber dano.

## Pacote KayKit Skeletons

O pacote KayKit Skeletons fica organizado em `assets/models/skeletons/`.
Veja `docs/kaykit-skeletons.md` para a lista de personagens, props, animacoes e mapeamento dos inimigos antigos.
Os inimigos `skeletonMinion`, `skeletonWarrior`, `skeletonRogue` e `skeletonMage` usam GLBs animados com `Idle_A` parado, `Walking_A` durante movimento, `Hit_A` no ataque em combate e `Hit_B` ao receber dano.
Quando mais de uma unidade usa o mesmo GLB, o renderer clona a cena com `SkeletonUtils.clone` antes de criar o `AnimationMixer`.

## Referencias No Codigo

- `package.json`: scripts de Vite e dependencia do Three.js.
- `js/config/world/assets.js`: caminhos centralizados de assets do mundo.
- `js/config/world/objects.js`: cadastro do tipo de objeto 3D.
- `js/config/world/maps/*.js`: instancia do objeto no mapa.
- `js/ui/three-board-view.js`: carregamento, centralizacao e renderizacao do modelo.
