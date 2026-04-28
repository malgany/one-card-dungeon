# Contexto do Projeto

## Visao Geral

O antigo `script.js` monolitico foi transformado em um entrypoint minimo que apenas importa os modulos da pasta `js/`.

## Onde Esta Cada Responsabilidade

- `script.js`: ponto de entrada curto para manter o carregamento principal do projeto.
- `js/main.js`: composicao da aplicacao. Cria estado, carrega assets, conecta input, regras e renderizacao.
- `js/config/game-data.js`: constantes do jogo, fases, metadados de atributos, templates de monstros, assets e mapa dos niveis.
- `js/game/game-factories.js`: criacao do estado inicial, ataques equipados, valores iniciais de vida/AP e preload das imagens das cartas.
- `js/game/board-logic.js`: utilitarios de tabuleiro, pathfinding, linha de visao e ocupacao.
- `js/game/game-actions.js`: fluxo do turno, combate, movimentacao, recompensas, banners e persistencia em `localStorage`.
- `js/ui/layout.js`: calculo de layout do canvas, hit testing e helpers de hover.
- `js/ui/draw-primitives.js`: primitivas de desenho reutilizaveis para HUD, tiles, cartas, botoes e dados legados.
- `js/ui/renderer.js`: montagem visual da cena completa e loop de renderizacao.
- `js/ui/input.js`: eventos do mouse, cliques em botoes/tabuleiro e suporte legado de drag and drop dos dados.

## Arquivos de Apoio

- `README.md`: resumo rapido do projeto e da estrutura.
- `docs/game-rules.md`: regras atuais do jogo.
- `assets/`: imagens usadas nas cartas do jogador e dos monstros.

## Fluxo Rapido Para Se Orientar

1. Comece por `js/main.js` para ver como o jogo e montado.
2. Se a mudanca for de regra, abra `js/game/game-actions.js` e `js/game/board-logic.js`.
3. Se a mudanca for visual, abra `js/ui/renderer.js` e `js/ui/draw-primitives.js`.
4. Se a mudanca for interacao do mouse, abra `js/ui/input.js`.
