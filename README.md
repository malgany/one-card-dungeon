# One RPG Game

Projeto de dungeon crawler tático com **tabuleiro 3D (Three.js)**, inspirado em card dungeons, organizado em módulos ES nativos.

## Funcionalidades Atuais

- **Mapa Aberto 3D**: O jogo novo inicia em um mapa isometrico maior, com camera seguindo o aventureiro.
- **Chunks de Mundo**: O mapa aberto e configurado em chunks 10x10 conectaveis, com bioma, terreno, objetos, encontros e conexoes por arquivo.
- **Transicao Mapa/Luta**: Clicar em um inimigo do mapa inicia uma luta tatica 6x6; ao vencer, o grupo derrotado some do mapa e o jogador volta ao ponto onde estava.
- **Grupos de Encontro**: Inimigos com o mesmo grupo entram juntos na arena.
- **Dungeon Legada**: O fluxo antigo de andares/salas continua preservado como modo legado acessivel pelo menu.
- **Independência de Modos**: Alterações em um modo (Overworld, Luta ou Legado) são isoladas e não afetam os outros, a menos que especificado.

- **Personagens 3D**: O aventureiro (Mago) e os inimigos (Esqueletos) agora são representados por modelos 3D animados (`.glb`), substituindo o visual de cartas antigo.
- **Sistema de Turnos Individual**: Cada entidade (jogador e monstros) possui sua própria vez na fila de iniciativa.
- **Fase de Herói Simplificada**: O turno do aventureiro começa direto na ação, com **6 AP** fixos por turno.
- **Ações Estratégicas**:
  - **Movimento**: 4 pontos de movimento por turno (passos ortogonais apenas).
  - **Ataque**: Equipado com `Golpe` (5 AP, 10 Dano, sem roubo de vida).
- **Combate**: Defesa mitiga dano (Dano Final = Ataque - Defesa, min 0).
- **Vida**: Aventureiro tem 60 HP; monstros têm vida proporcional à sua periculosidade.
- **Interface**: HUD interativo, tooltips e animações de texto flutuante.

## Como abrir

Como o projeto usa imports de pacote (`three` e addons), rode pelo Vite para que as dependencias sejam resolvidas corretamente.

```bash
npm install
npm run dev
```

Depois abra a URL indicada pelo Vite.

## Debug Local

O painel e as ferramentas de debug ficam desligados por padrão. Para usar localmente, crie um `.env` na raiz com:

```bash
VITE_ONE_RPG_DEBUG=true
```

O arquivo `.env.example` documenta a variável esperada. Não habilite `VITE_ONE_RPG_DEBUG` no ambiente de produção.

Para gerar a versao de producao:

```bash
npm run build
```

A pasta publicada em producao e `dist`.

## Deploy No GitHub Pages

O deploy principal e feito pelo workflow `.github/workflows/deploy-pages.yml`.

No GitHub, abra `Settings > Pages` e selecione `GitHub Actions` como origem do deploy. Depois disso, cada push na branch `master` publica uma nova versao.

O workflow:

- instala dependencias com `npm ci`;
- roda `npm run build`;
- define `VITE_BASE_PATH` como `/<nome-do-repositorio>/`;
- publica a pasta `dist`.

Esse `VITE_BASE_PATH` e o que faz os scripts, CSS, imagens, sons e modelos 3D carregarem corretamente em URLs do tipo `https://usuario.github.io/one-rpg-game/`. O ambiente local continua usando a raiz `/` quando voce roda `npm run dev`.

## Estrutura

- `index.html`: pagina principal.
- `style.css`: estilos basicos da pagina e do canvas.
- `script.js`: entrypoint pequeno que importa a aplicacao modular.
- `js/config`: configuracoes e dados fixos do jogo.
- `js/config/world`: mapas, biomas, terrenos, objetos e assets do mundo aberto.
- `js/game`: regras, fabrica de estado e logica de tabuleiro.
- `js/ui`: layout, input e renderizacao.
- `assets`: texturas do mundo aberto, modelos 3D (`models/`) e imagens legadas.
- `js/game/world-state.js`: helpers do chunk ativo, inimigos, objetos e conexoes.
- `docs`: documentacao das regras atuais.
- `context.md`: mapa rapido para localizar cada responsabilidade.

## Documento de Regras

As regras atuais tambem estao descritas em `docs/game-rules.md`.

## Guia Visual

Antes de alterar HUD, modal, botoes, highlights, tabuleiro ou qualquer elemento de interface, consulte `design.md`.
A direcao atual e um RPG tatico de ferro, pedra e musgo: menos azul/slate, menos arredondamento e mais materialidade sombria.

## Guia 3D

Se for adicionar ou ajustar modelos GLTF no mundo aberto, consulte `docs/gltf-models.md` antes de mexer em `js/ui/three-board-view.js` ou em `js/config/world/objects.js`.
O jogador usa o pacote KayKit Adventurers documentado em `docs/kaykit-adventurers.md`; os inimigos esqueletos usam o pacote KayKit Skeletons documentado em `docs/kaykit-skeletons.md`.
