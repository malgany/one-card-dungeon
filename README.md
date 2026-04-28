# One RPG Game

Projeto de dungeon crawler em canvas inspirado em card dungeon, agora organizado em modulos ES nativos para ficar mais facil de manter e navegar.

## Regras Atuais

- O turno do aventureiro comeca direto na fase de heroi, sem rolagem ou distribuicao de dados.
- O aventureiro tem 6 AP por turno. AP e gasto por acoes, como ataques equipados.
- O ataque nao e mais um atributo direto do personagem. O personagem tem um slot de ataque; por enquanto ele vem equipado com `Golpe`, que custa 5 AP, tem dano 5 e suga 1 vida quando causa dano.
- Defesa mitiga dano por subtracao: dano final = dano do ataque - defesa do alvo, com minimo 0.
- O aventureiro tem 60 de vida. Os monstros tambem tiveram a vida multiplicada por 10.
- Movimento e alcance usam passos ortogonais. Nao existe passo diagonal; uma diagonal equivale a dois passos em cruz.

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
- `docs`: documentacao das regras atuais.
- `context.md`: mapa rapido para localizar cada responsabilidade.

## Documento de Regras

As regras atuais tambem estao descritas em `docs/game-rules.md`.
