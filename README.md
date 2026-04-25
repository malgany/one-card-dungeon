# One RPG Game

Projeto de dungeon crawler em canvas inspirado em card dungeon, agora organizado em modulos ES nativos para ficar mais facil de manter e navegar.

## Como abrir

Como o projeto agora usa modulos JavaScript, o ideal e servir a pasta com um servidor estatico simples.

Exemplos:

```bash
python -m http.server 8080
```

ou

```bash
npx serve .
```

Depois abra `http://localhost:8080` ou a porta indicada pelo servidor.

## Estrutura

- `index.html`: pagina principal.
- `style.css`: estilos basicos da pagina e do canvas.
- `script.js`: entrypoint pequeno que importa a aplicacao modular.
- `js/config`: configuracoes e dados fixos do jogo.
- `js/game`: regras, fabrica de estado e logica de tabuleiro.
- `js/ui`: layout, input e renderizacao.
- `assets`: imagens das cartas.
- `docs`: espaco reservado para documentacao das regras.
- `context.md`: mapa rapido para localizar cada responsabilidade.

## Documento de Regras

O arquivo `docs/game-rules.md` foi criado como placeholder para voce preencher as regras do jogo depois.
