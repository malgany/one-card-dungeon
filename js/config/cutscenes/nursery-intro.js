export const NURSERY_INTRO_ID = 'nursery-intro';
export const NURSERY_INTRO_MAP_ID = 'chao3-grid--1-0';
export const NURSERY_INTRO_LINE_GAP = 280;
export const NURSERY_INTRO_TIME_SCALE = 3;
export const NURSERY_INTRO_MIN_LINE_DURATION = 7200;
export const NURSERY_INTRO_MAX_LINE_DURATION = 19500;

const NURSERY_INTRO_BASE_LINE_DURATION = 1700;
const NURSERY_INTRO_DURATION_PER_CHAR = 38;

export const NURSERY_INTRO_DIALOGUE = Object.freeze([
  { speaker: '???', actor: 'god', text: 'Acorda, campeão.' },
  { speaker: 'Protagonista', actor: 'player', text: 'Hã...? Onde eu tô?' },
  { speaker: '???', actor: 'god', text: 'No Berçário. Tecnicamente, você morreu. Mas olha pelo lado bom: não precisa mais ir comprar refrigerante.' },
  { speaker: 'Protagonista', actor: 'player', text: 'Eu morri?' },
  { speaker: '???', actor: 'god', text: 'Morreu. Caminhão. Rua. Impacto. Você virou uma panqueca no asfalto. Uma cena bem pouco heroica, se quer minha opinião.' },
  { speaker: 'Protagonista', actor: 'player', text: 'Espera. Quem é você?' },
  { speaker: 'Deus', actor: 'god', text: 'Sou Deus.' },
  { speaker: 'Protagonista', actor: 'player', text: 'Você fala assim?' },
  { speaker: 'Deus', actor: 'god', text: 'Você queria trovão, coral e uma barba ocupando metade da tela? Estamos com orçamento espiritual reduzido.' },
  { speaker: 'Protagonista', actor: 'player', text: 'Isso só pode ser um sonho.' },
  { speaker: 'Deus', actor: 'god', text: 'Também pensei isso vendo sua vida anterior, mas infelizmente era tudo real.' },
  { speaker: 'Protagonista', actor: 'player', text: 'Tá, se você é Deus... por que eu tô aqui?' },
  { speaker: 'Deus', actor: 'god', text: 'Porque você foi selecionado para reencarnar em outro mundo.' },
  { speaker: 'Protagonista', actor: 'player', text: 'Selecionado por quê? Eu fiz alguma coisa importante?' },
  { speaker: 'Deus', actor: 'god', text: 'Não exatamente. Quando uma pessoa tem uma vida muito sem rumo, muito desperdiçada, muito... como posso dizer sem ofender?' },
  { speaker: 'Protagonista', actor: 'player', text: 'Patética?' },
  { speaker: 'Deus', actor: 'god', text: 'Olha aí. Já estamos trabalhando em equipe.' },
  { speaker: 'Protagonista', actor: 'player', text: 'Então eu ganhei uma segunda chance porque minha vida era ruim?' },
  { speaker: 'Deus', actor: 'god', text: 'Basicamente. Não é bonito, mas é eficiente.' },
  { speaker: 'Protagonista', actor: 'player', text: 'E esse lugar?' },
  { speaker: 'Deus', actor: 'god', text: 'Este é o Berçário. Um ponto de passagem. Aqui você aprende o básico antes de descer para o mundo de verdade. Andar, lutar, sobreviver, não ser atropelado de novo. Essas coisas.' },
  { speaker: 'Protagonista', actor: 'player', text: 'E que mundo é esse?' },
  { speaker: 'Deus', actor: 'god', text: 'Um mundo chamado Verden. Espadas, magia, monstros, reinos problemáticos, gente poderosa tomando decisões idiotas... o pacote completo.' },
  { speaker: 'Protagonista', actor: 'player', text: 'E onde eu entro nisso?' },
  { speaker: 'Deus', actor: 'god', text: 'Verden está quebrando. As regiões estão se separando, as bordas do mundo estão instáveis, e criaturas estão surgindo onde não deveriam. Se continuar assim, tudo vira um monte de pedaços desconectados flutuando no nada.' },
  { speaker: 'Protagonista', actor: 'player', text: 'E você quer que eu resolva isso?' },
  { speaker: 'Deus', actor: 'god', text: 'Quero é uma palavra forte. Digamos que você é uma opção disponível.' },
  { speaker: 'Protagonista', actor: 'player', text: 'Você não parece muito confiante.' },
  { speaker: 'Deus', actor: 'god', text: 'Você foi derrotado por um caminhão parado no próprio plano existencial dele. Estou administrando expectativas.' },
  { speaker: 'Protagonista', actor: 'player', text: 'E se eu conseguir?' },
  { speaker: 'Deus', actor: 'god', text: 'Se você restaurar as Âncoras do Mundo e impedir Verden de desmoronar, eu realizo um desejo seu.' },
  { speaker: 'Protagonista', actor: 'player', text: 'Qualquer desejo?' },
  { speaker: 'Deus', actor: 'god', text: 'Dentro do razoável.' },
  { speaker: 'Protagonista', actor: 'player', text: 'Isso não é “qualquer desejo”.' },
  { speaker: 'Deus', actor: 'god', text: 'Bem-vindo à vida adulta. De novo.' },
  { speaker: 'Protagonista', actor: 'player', text: 'E se eu recusar?' },
  { speaker: 'Deus', actor: 'god', text: 'Você pode ficar aqui. Para sempre. O Berçário tem chão confortável, silêncio infinito e absolutamente nada para fazer.' },
  { speaker: 'Protagonista', actor: 'player', text: 'Tá. Entendi. Segunda chance, mundo quebrado, desejo no final.' },
  { speaker: 'Deus', actor: 'god', text: 'Isso. Agora atravesse aquela passagem.' },
  { speaker: 'Protagonista', actor: 'player', text: 'E depois?' },
  { speaker: 'Deus', actor: 'god', text: 'Depois você aprende que morrer uma vez foi só o tutorial.' },
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function nurseryIntroLineDuration(text) {
  return clamp(
    (NURSERY_INTRO_BASE_LINE_DURATION + String(text || '').length * NURSERY_INTRO_DURATION_PER_CHAR)
      * NURSERY_INTRO_TIME_SCALE,
    NURSERY_INTRO_MIN_LINE_DURATION,
    NURSERY_INTRO_MAX_LINE_DURATION,
  );
}

export function createNurseryIntroCutscene(startTime = performance.now()) {
  let cursor = startTime;
  const lines = NURSERY_INTRO_DIALOGUE.map((line, index) => {
    const duration = nurseryIntroLineDuration(line.text);
    const timedLine = {
      ...line,
      index,
      startTime: cursor,
      endTime: cursor + duration,
      duration,
    };
    cursor = timedLine.endTime + NURSERY_INTRO_LINE_GAP;
    return timedLine;
  });

  return {
    id: NURSERY_INTRO_ID,
    mapId: NURSERY_INTRO_MAP_ID,
    startedAt: startTime,
    endsAt: lines[lines.length - 1]?.endTime || startTime,
    currentLineIndex: 0,
    lines,
  };
}

export function activeNurseryIntroLine(cutscene, now = performance.now()) {
  if (!cutscene || cutscene.id !== NURSERY_INTRO_ID || !Array.isArray(cutscene.lines)) return null;

  return cutscene.lines.find((line) => now >= line.startTime && now < line.endTime) || null;
}
