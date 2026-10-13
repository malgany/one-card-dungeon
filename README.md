# One RPG Game

Projeto de dungeon crawler tático com **tabuleiro 3D (Three.js)**, inspirado em card dungeons, organizado em módulos ES nativos.

## Funcionalidades Atuais

- **Crônicas do Vale**: campanha de seis regiões conectadas, de 16×16 a 24×24 casas, com caminhos em terra firme. A floresta e a estrada levam às ruínas; dois selos abrem a Cripta das Raízes e seus sentinelas liberam o chefe final.
- **Exploração com propósito**: clique/toque nos modelos para caminhar até uma casa adjacente e abrir a interação. Fogueiras, marcos e baús têm colisão. Os nomes aparecem ao passar o mouse; objetivos ficam no diário (`J`). Poções (`Q`) curam 25 de vida e custam 2 AP em combate. A roda do mouse ajusta o zoom.
- **Novos adversários**: Slime de Musgo, Guardião de Musgo e Guardião do Eclipse, com modelos animados do pacote Ultimate Monsters, de Quaternius (CC0). O chefe anuncia no chão o golpe da próxima vez: use o turno para sair das marcas vermelhas.
- **Personagens existentes**: no mapa antigo, use “Viajar ao Refúgio do Vale”. A viagem mantém o personagem e os mapas explorados. Novos personagens mantêm a introdução do Berçário, cuja saída leva ao vale.
- **Campanha persistente**: inimigos vencidos não reaparecem. Cada baú conserva seu conteúdo; transfira itens entre baú e mochila por arrastar ou selecionar e transferir. Selos, materiais, poções e conclusão ficam salvos com o personagem.
- **Preparação e dificuldade**: regiões de nível 1 a 5, ervas para preparar poções e fragmentos para reforçar a runa de ataque nas fogueiras. A derrota retorna ao último abrigo com vida e itens preservados.
- **Orientação e preferências**: minimapa da região com jogador, inimigos, objetos e saídas; atlas com nomes, níveis e requisitos. Configurações de volume e qualidade gráfica (Econômico, Equilibrado e Alto). Janelas pausam o relógio do turno do herói.

- **Mapa Aberto 3D**: O jogo novo inicia em um mapa isometrico maior, com camera seguindo o aventureiro.
- **Regiões de Mundo**: a campanha carrega uma região por vez; os mapas antigos de 10×10 continuam disponíveis para saves existentes e ferramentas de edição.
- **Transicao Mapa/Luta**: Clicar em um inimigo do mapa inicia uma luta tatica 6x6; ao vencer, o grupo derrotado some do mapa e o jogador volta ao ponto onde estava.
- **Grupos de Encontro**: Inimigos com o mesmo grupo entram juntos na arena.
- **Dungeon Legada**: O fluxo antigo de andares/salas continua preservado como modo legado acessivel pelo menu.
- **Independência de Modos**: Alterações em um modo (Overworld, Luta ou Legado) são isoladas e não afetam os outros, a menos que especificado.

- **Personagens 3D**: O aventureiro (Mago) e os inimigos (Esqueletos) agora são representados por modelos 3D animados (`.glb`), substituindo o visual de cartas antigo.
- **Sistema de Turnos Individual**: Cada entidade (jogador e monstros) possui sua própria vez na fila de iniciativa.
- **Fase de Herói Simplificada**: O turno do aventureiro começa direto na ação, com **6 AP** fixos por turno.
- **Ações Estratégicas**:
  - **Movimento**: 3 pontos de movimento base por turno.
  - **Ataque**: Equipado com `Golpe` (4 AP, 11 de dano base).
- **Combate**: Defesa mitiga dano (Dano Final = Ataque - Defesa, min 0).
- **Vida**: Aventureiro tem 60 HP; monstros têm vida proporcional à sua periculosidade.
- **Interface**: HUD interativo, tooltips e animações de texto flutuante.

## Como abrir

Os modelos de cenário adicionais são do [KayKit Dungeon Pack](https://kaylousberg.itch.io/kaykit-dungeon-pack), de Kay Lousberg, sob CC0. A licença acompanha `assets/models/dungeon-pack/License.txt`. Os monstros são do [Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html), com licença e procedência em `assets/models/quaternius-monsters/`. A fogueira e a pedra de inscrição são geradas localmente por `scripts/generate-campaign-models.mjs`.

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

Esse `VITE_BASE_PATH` e o que faz os scripts, CSS, imagens, sons e modelos 3D carregarem corretamente em URLs do tipo `https://usuario.github.io/one-card-dungeon/`. O ambiente local continua usando a raiz `/` quando voce roda `npm run dev`.

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

## Controles no celular

A interface se adapta a retrato e paisagem. Toque no chão para andar e selecione um ataque antes de tocar no alvo. Herói, feitiços, mapa, poção, diário e fim de turno têm controles visíveis; a barra de ataques permite rolagem horizontal. Os botões de câmera afastam, aproximam e restauram o enquadramento. O combate mantém o tabuleiro completo visível. O limite de densidade de pixels é 2 para reduzir o custo em telas de alta resolução.

Validação: testes unitários de toque, cancelamento de gestos, enquadramento e disponibilidade das ações; navegação manual em 390×844 e 844×390. Não substitui medição de desempenho em aparelhos físicos.

## Inventário e mapa do vale

Baús e mochila usam grades de 24 espaços. Arrastar move a pilha inteira para o espaço escolhido; pilhas iguais combinam e diferentes trocam de lugar. A organização fica salva com o personagem. No celular, selecione a pilha e toque no destino, ou use o botão de transferência. As dicas dos itens são desenhadas pelo jogo.

O minimapa e o mapa ampliado compartilham a cartografia isométrica. Clique no minimapa ou abra Mapa para ver as seis regiões conectadas. Use os botões, a roda do mouse ou pinça para zoom; arraste para navegar. O enquadramento completo pode ser restaurado pelo botão central. Inimigos fazem movimentos curtos de espera dentro de sua própria célula, sem alterar as regras de colisão ou de combate.

Execute `npm run test:unit` e `npm run test:inventory` (Node 22.8 ou superior). O deploy verifica essas duas suítes antes do build.
