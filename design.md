# Direcao Visual

## Objetivo

A UI do jogo deve parecer um RPG tatico de ferro, pedra e musgo: sombria, legivel e material, sem depender de azul/slate como linguagem principal. O visual deve reforcar combate tatico, mapa fisico e fantasia medieval discreta.

## Paleta Oficial

- Fundo: `#070807`, `#0d0f0b`, `#14150f`
- Superficies: `#171912`, `#202219`, `#29291f`
- Bordas: `#4a4638`, `#6f6342`, `#9a7a32`
- Texto: `#f2ead7`, `#c9bea5`, `#8f8773`
- Acao principal: `#d39b32`
- Movimento/sucesso: `#5f8f54`
- Perigo/dano: `#b94735`
- Azul/cyan: usar apenas para estados tecnicos raros. Nao usar como base dominante de HUD, modal, botao ou painel.

## Bordas E Formas

- Paineis principais: raio entre `6px` e `8px`.
- Botoes, slots e controles compactos: raio entre `4px` e `6px`.
- Modal e banners especiais: raio maximo de `10px`.
- Evitar raios grandes como `18px`, `20px` e `24px`, exceto se houver uma justificativa visual explicita para um banner especial.
- A borda deve parecer metal/pedra: discreta, firme e com contraste controlado.

## Componentes

- Botoes primarios usam bronze/ambar.
- Botoes secundarios usam ferro escuro.
- Acoes destrutivas, dano e perigo usam vermelho queimado.
- Hover deve aumentar luz, contraste ou borda; nao trocar para azul.
- HUD deve priorizar leitura rapida: HP, AP, movimento, fila de turno e acoes equipadas precisam ter hierarquia clara.
- Tooltips e banners devem usar fundo escuro quente, texto claro e borda ambar ou ferro.
- Highlights do tabuleiro seguem semantica fixa: hover claro discreto, movimento musgo, ataque vermelho queimado, selecao ambar.
- Modais usam overlay escuro, painel de ferro/pergaminho escuro, sidebar sem azul dominante e links em ambar/musgo.

## Tipografia

- Manter Inter por enquanto.
- Usar peso forte em valores, titulos curtos e chamadas importantes.
- Evitar que todos os textos parecam HUD tecnico.
- Usar caixa alta apenas em rotulos curtos ou comandos, nao em paragrafos.

## Nao Fazer

- Nao criar UI azul/slate dominante.
- Nao usar radius alto por padrao.
- Nao adicionar muitos acentos competindo na mesma tela.
- Nao colocar cards dentro de cards.
- Nao criar botoes genericos sem hierarquia de estado.
- Nao introduzir novas cores soltas sem encaixar na paleta oficial.

## Checklist Visual

- A tela ainda parece RPG tatico, nao dashboard tecnico?
- Azul/cyan aparece apenas como excecao?
- Botoes e paineis estao menos arredondados?
- Estados de hover, ataque, movimento e perigo continuam distinguiveis?
- O modal parece pertencer ao mesmo sistema visual do HUD?
- O texto mantem contraste e cabe no container em desktop e mobile?
