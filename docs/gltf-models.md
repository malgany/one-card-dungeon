# Guia de Modelos GLTF

Este documento resume o fluxo para adicionar modelos 3D no mundo aberto usando `GLTFLoader`.
O objetivo e cortar caminho na proxima vez que for incluir um `.gltf`, evitando retrabalho em build, pasta de assets, config de objeto e renderizacao.

## Padrao De Arquivos

Use uma pasta por modelo dentro de `assets/models/`.

Exemplo recomendado:

```text
assets/models/
  test-model/
    test-model.gltf
    test-model.bin
    test-model.png
```

Regras praticas:

- Mantenha o `.gltf`, o `.bin` e todas as texturas no mesmo diretorio.
- Use nomes em minusculo, sem espacos, com `-` quando precisar separar palavras.
- Os caminhos internos do `.gltf` sao resolvidos relativo ao proprio arquivo `.gltf`.
- Se a exportacao gerar mais texturas, deixe tudo junto na mesma pasta e preserve os nomes que o glTF espera.

## Passo A Passo

### 1. Organize o asset

Coloque o modelo e seus arquivos auxiliares em uma pasta propria em `assets/models/`.

Se o modelo vier de Blender ou de outro exportador, confira se:

- o `.gltf` aponta para o `.bin` correto;
- as imagens referenciadas existem na mesma pasta;
- nao houve renomeacao manual que quebrou os URIs do glTF.

### 2. Registre o tipo do objeto

Edite `js/config/world/objects.js` e crie um tipo com `shape: 'model'`.

Exemplo:

```js
'test-model': {
  id: 'test-model',
  name: 'Objeto 3D Teste',
  shape: 'model',
  modelUrl: './assets/models/test-model/test-model.gltf',
  blocksMovement: true,
  scale: 0.8,
  rotation: { x: 0, y: 0, z: 0 },
},
```

Notas:

- `blocksMovement: true` faz o objeto bloquear o caminho no mundo aberto.
- `blocksMovement: false` serve para decoracao que nao interfere no pathfinding.
- `scale` e `rotation` sao uteis para ajustar proporcao e orientacao sem mexer no asset.

### 3. Coloque uma instancia no mapa

Edite o arquivo do mapa, por exemplo `js/config/world/maps/open-road.js`, e adicione uma instancia do objeto:

```js
{ id: 'test-obj-3d', type: 'test-model', x: 4, y: 5 },
```

O renderer usa essas coordenadas para posicionar o modelo no tile correspondente.

### 4. Confirme o suporte no carregador

O jogo usa `GLTFLoader` em `js/ui/three-board-view.js`.
O Vite resolve `three` e `three/addons/...` no build, entao nao coloque caminhos para `node_modules` no HTML.
Se o build falhar ao importar addons, confira se o pacote `three` esta instalado e se o import usa o prefixo `three/addons/`.

## O Que O Renderer Faz

O fluxo atual do renderer para `shape: 'model'` e:

1. cria um `THREE.Group` para o objeto;
2. carrega o `.gltf` de forma assincrona;
3. calcula a `Box3` do modelo para centralizar o conteudo;
4. ajusta a base para encostar no chao em `Y = 0`;
5. aplica `DoubleSide` nas malhas para evitar face sumindo por culling;
6. habilita sombras nas malhas;
7. aplica `scale` e `rotation` vindos da config do objeto.

Detalhe importante:

- nao force `texture.needsUpdate = true` em texturas do GLTF a menos que voce tenha trocado a imagem manualmente;
- esse tipo de update prematuro costuma gerar o warning `Texture marked for update but no image data found`.

## Checklist Rapido Quando Nao Aparece

- Confirme se o `modelUrl` aponta para o arquivo certo.
- Confirme se `assets/models/<pasta>/` existe e se o `.gltf` encontra o `.bin` e as texturas.
- Abra o DevTools e verifique se `gltf`, `bin` e `png` estao voltando `200`.
- Confirme se o tipo do objeto e `shape: 'model'`.
- Confirme se o objeto foi adicionado ao mapa correto.
- Ajuste `scale` se o asset estiver pequeno ou grande demais para a grade.
- Use `rotation` se o modelo exportado vier de lado.
- Se a malha usar transparencia, confirme se a textura PNG realmente tem alpha.
- Se o modelo desaparecer dependendo do angulo, mantenha `DoubleSide` nas malhas.

## Referencias No Codigo

- `package.json`: scripts de Vite e dependencia do Three.js.
- `js/config/world/objects.js`: cadastro do tipo de objeto 3D.
- `js/config/world/maps/*.js`: instancia do objeto no mapa.
- `js/ui/three-board-view.js`: carregamento, centralizacao e renderizacao do modelo.
