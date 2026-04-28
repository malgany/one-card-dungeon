# Regras Atuais

## Vez e AP

O jogo nao usa mais rolagem e distribuicao de dados no comeco da vez.
O aventureiro comeca a vez direto na fase de heroi com 6 AP.

AP e o recurso usado para executar acoes. Cada acao define o proprio custo.

## Movimento e Alcance

Movimento e feito apenas em cruz: cima, baixo, esquerda e direita.
Nao existe passo diagonal. Para chegar em uma casa diagonal, o caminho custa dois passos ortogonais.

Alcance usa a mesma distancia por passos ortogonais.

## Ataque Equipado

Ataque nao e mais um atributo direto do personagem.
O personagem tem um slot de ataque equipado.

Ataque inicial:

- Nome: `Golpe`
- Custo: 5 AP
- Dano: 5
- Suga: 1 vida quando causa dano

## Defesa e Dano

Defesa mitiga dano por subtracao.

```text
dano final = max(0, dano do ataque - defesa do alvo)
```

Exemplo: um ataque de dano 5 contra defesa 1 causa 4 de dano.

## Vida

O aventureiro tem 60 de vida.
As vidas dos monstros foram multiplicadas por 10 em relacao aos valores antigos.
