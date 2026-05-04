# Contexto do Projeto

## Visao Geral

O antigo `script.js` monolitico foi transformado em um entrypoint minimo que apenas importa os modulos da pasta `js/`.
O fluxo principal agora comeca em um mapa aberto 3D/isometrico; clicar em grupos inimigos entra em combate 6x6 (utilizando modelos 3D para o jogador e inimigos) e a dungeon antiga fica preservada como modo legado.

## Onde Esta Cada Responsabilidade

- `script.js`: ponto de entrada curto para manter o carregamento principal do projeto.
- `js/main.js`: composicao da aplicacao. Cria estado, carrega assets, conecta input, regras e renderizacao.
- `js/config/game-data.js`: constantes do jogo, modos, fases, fases legadas, templates de monstros, cartas, niveis e reexports do mundo aberto.
- `js/config/world/`: configuracao do mundo aberto em chunks 20x20, incluindo mapas, biomas, terrenos, objetos, encontros e conexoes.
- `js/game/game-factories.js`: criacao do estado inicial do mapa aberto por chunk, dungeon legada, ataques equipados, valores iniciais de vida/AP e preload das imagens das cartas.
- `js/game/world-state.js`: helpers de leitura do chunk ativo, inimigos, objetos bloqueantes, terreno e conexoes.
- `js/game/board-logic.js`: utilitarios de tabuleiro, pathfinding, linha de visao e ocupacao.
- `js/game/game-actions.js`: fluxo do mapa aberto, entrada/saida de combate, turno, recompensas, banners e persistencia em `localStorage`.
- `js/ui/layout.js`: calculo de layout do canvas, hit testing e helpers de hover.
- `js/ui/draw-primitives.js`: primitivas de desenho reutilizaveis para HUD, tiles, cartas, botoes e dados legados.
- `js/ui/renderer.js`: montagem visual da cena completa e loop de renderizacao.
- `js/ui/input.js`: eventos do mouse, cliques em botoes/tabuleiro e suporte legado de drag and drop dos dados.
- `js/ui/three-board-view.js`: renderizacao 3D dinamica do mapa aberto e da arena isometrica.

## Arquivos de Apoio

- `README.md`: resumo rapido do projeto e da estrutura.
- `.env.example`: lista variaveis de ambiente esperadas; `VITE_ONE_RPG_DEBUG=true` liga o painel, o objeto `window.__ONE_RPG_DEBUG__` e os endpoints de debug no Vite local.
- `design.md`: direcao visual oficial para HUD, modal, botoes, highlights e novos ajustes de UI.
- `docs/game-rules.md`: regras atuais do jogo.
- `docs/gltf-models.md`: guia para organizar, importar e depurar modelos GLTF/3D no mundo aberto.
- `docs/kaykit-adventurers.md`: registro de assets 3D do personagem aventureiro (Mago).
- `docs/kaykit-skeletons.md`: registro de assets 3D dos inimigos (Esqueletos).
- `assets/`: texturas (`textures/`), modelos 3D (`models/`) e imagens legadas de cartas (`characters/`).

## Fluxo Rapido Para Se Orientar

1. Comece por `js/main.js` para ver como o jogo e montado.
2. Se a mudanca for em mapa/bioma/objeto do mundo aberto, abra `js/config/world/`.
3. Se a mudanca for de regra, abra `js/game/game-actions.js` e `js/game/board-logic.js`.
4. Se a mudanca envolver GLTF/3D, leia `docs/gltf-models.md` e depois abra `js/ui/three-board-view.js` e `js/config/world/objects.js`.
5. Se a mudanca for visual em geral, leia `design.md` antes de abrir `js/ui/renderer.js`, `js/ui/three-board-view.js` e `js/ui/draw-primitives.js`.
6. Se a mudanca for interacao do mouse, abra `js/ui/input.js`.

## Texto e Localizacao

- O texto visivel do jogo e da documentacao deve seguir portugues do Brasil com acentuacao correta.
- Quando `design.md` falar de "acentos" competindo na tela, leia como acentos visuais/destaques de cor, nao como remocao de acentos ortograficos.

## Independência de Modos

- **Isolamento**: Alterações no **Mundo Aberto (Overworld)** não afetam necessariamente a **Dungeon Legada** ou o **Modo de Luta (Combate)**, e vice-versa.
- **Regra de Ouro**: A menos que seja explicitamente solicitado que uma mudança seja global, considere que modificações em um modo são isoladas para não quebrar a lógica dos outros estados do jogo.
