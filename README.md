# One RPG Game

Projeto de dungeon crawler tático com **tabuleiro 3D (Three.js)**, inspirado em card dungeons, organizado em módulos ES nativos.

## Funcionalidades Atuais

- **Tabuleiro 3D**: Visão isométrica com renderização via Three.js, incluindo animações de movimento e combate.
- **Sistema de Turnos Individual**: Cada entidade (jogador e monstros) possui sua própria vez na fila de iniciativa.
- **Fase de Herói Simplificada**: O turno do aventureiro começa direto na ação, com **6 AP** fixos por turno.
- **Ações Estratégicas**:
  - **Movimento**: 4 pontos de movimento por turno (passos ortogonais apenas).
  - **Ataque**: Equipado com `Golpe` (5 AP, 5 Dano, 1 Roubo de Vida).
- **Combate**: Defesa mitiga dano (Dano Final = Ataque - Defesa, min 0).
- **Vida**: Aventureiro tem 60 HP; monstros têm vida proporcional à sua periculosidade.
- **Interface**: HUD interativo, tooltips e animações de texto flutuante.

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
