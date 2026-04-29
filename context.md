# Contexto do Projeto

## Visao Geral

O antigo `script.js` monolitico foi transformado em um entrypoint minimo que apenas importa os modulos da pasta `js/`.
O fluxo principal agora comeca em um mapa aberto 3D/isometrico; clicar em grupos inimigos entra em combate 6x6 e a dungeon antiga fica preservada como modo legado.

## Onde Esta Cada Responsabilidade

- `script.js`: ponto de entrada curto para manter o carregamento principal do projeto.
- `js/main.js`: composicao da aplicacao. Cria estado, carrega assets, conecta input, regras e renderizacao.
- `js/config/game-data.js`: constantes do jogo, modos, fases, mapa aberto, fases legadas, templates de monstros, assets e mapa dos niveis.
- `js/game/game-factories.js`: criacao do estado inicial do mapa aberto, dungeon legada, ataques equipados, valores iniciais de vida/AP e preload das imagens das cartas.
- `js/game/board-logic.js`: utilitarios de tabuleiro, pathfinding, linha de visao e ocupacao.
- `js/game/game-actions.js`: fluxo do mapa aberto, entrada/saida de combate, turno, recompensas, banners e persistencia em `localStorage`.
- `js/ui/layout.js`: calculo de layout do canvas, hit testing e helpers de hover.
- `js/ui/draw-primitives.js`: primitivas de desenho reutilizaveis para HUD, tiles, cartas, botoes e dados legados.
- `js/ui/renderer.js`: montagem visual da cena completa e loop de renderizacao.
- `js/ui/input.js`: eventos do mouse, cliques em botoes/tabuleiro e suporte legado de drag and drop dos dados.
- `js/ui/three-board-view.js`: renderizacao 3D dinamica do mapa aberto e da arena isometrica.

## Arquivos de Apoio

- `README.md`: resumo rapido do projeto e da estrutura.
- `docs/game-rules.md`: regras atuais do jogo.
- `assets/`: imagens usadas nas cartas do jogador e dos monstros.

## Fluxo Rapido Para Se Orientar

1. Comece por `js/main.js` para ver como o jogo e montado.
2. Se a mudanca for de regra, abra `js/game/game-actions.js` e `js/game/board-logic.js`.
3. Se a mudanca for visual, abra `js/ui/renderer.js` e `js/ui/draw-primitives.js`.
4. Se a mudanca for interacao do mouse, abra `js/ui/input.js`.

## Independência de Modos

- **Isolamento**: Alterações no **Mundo Aberto (Overworld)** não afetam necessariamente a **Dungeon Legada** ou o **Modo de Luta (Combate)**, e vice-versa.
- **Regra de Ouro**: A menos que seja explicitamente solicitado que uma mudança seja global, considere que modificações em um modo são isoladas para não quebrar a lógica dos outros estados do jogo.
