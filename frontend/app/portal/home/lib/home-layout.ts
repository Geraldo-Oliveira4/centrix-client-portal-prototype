// O molde da Home: temas, cards e a tabela que liga um ao outro.
//
// ARQUIVO SEM JSX E SEM IMPORT DE COMPONENTE, de proposito. Quem conhece os
// componentes e o registro (`components/card-registry.tsx`); aqui ficam so os
// tipos e a aritmetica, e e isso que permite testar a regra com `node --test`
// sem montar React.
//
// AS DUAS PONTAS TEM DE ANDAR JUNTAS: `PortalHomeTheme` e
// `PORTAL_HOME_LAYOUT_CARDS` sao espelhados em `THEMES` e `THEME_CARDS` de
// `backend/app/home_layout_experiment.py`, que valida o que entra na tabela. Um
// card acrescentado so aqui e gravado como 400; um acrescentado so la e gravado
// e depois quebra o registro no render. Mexeu num lado, mexa no outro — `H11`
// no e2e compara as duas.

/**
 * Os tres temas do onboarding, nomeados pela PERGUNTA que respondem.
 *
 * "Custos", e nao "Inteligencia": Inteligencia ja e um item da sidebar, e o
 * mesmo nome em dois lugares faria o cliente esperar que escolher o tema o
 * levasse aquela aba. O rotulo de um tema descreve o que o card mostra, nunca
 * um destino de navegacao.
 */
export type PortalHomeTheme = 'acao' | 'mapa' | 'custos';

/**
 * Uniao dos cards disponiveis. Cada valor tem um componente no registro — e o
 * `Record<PortalHomeCard, ...>` de la e o que garante isso em tempo de
 * compilacao: acrescentar um card aqui quebra o build ate ele ganhar um
 * componente.
 */
export type PortalHomeCard =
  | 'acao_urgente'
  | 'mapa_embarques'
  | 'economia'
  | 'tendencia_preco';

export const PORTAL_HOME_THEMES: PortalHomeTheme[] = ['acao', 'mapa', 'custos'];

/**
 * Tema -> cards. A ORDEM IMPORTA: e a ordem em que os cards aparecem na tela, e
 * ela e a do tema, nao a da escolha do cliente — dois clientes com os mesmos
 * temas veem a mesma Home, e uma demo nao muda de layout entre duas contas.
 */
export const PORTAL_HOME_LAYOUT_CARDS: Record<PortalHomeTheme, PortalHomeCard[]> =
  {
    acao: ['acao_urgente'],
    mapa: ['mapa_embarques'],
    custos: ['economia', 'tendencia_preco'],
  };

/**
 * Teto de temas no onboarding. Hoje igual ao numero de temas existentes, e de
 * proposito NAO derivado de `PORTAL_HOME_THEMES.length`: o teto e do produto
 * ("escolha ate tres"), e um quarto tema nao deve afrouxa-lo sozinho. Qualquer
 * combinacao de 1 a 3 vale.
 */
export const MAX_PORTAL_HOME_THEMES = 3;

export const PORTAL_HOME_THEME_LABELS: Record<PortalHomeTheme, string> = {
  acao: 'Ação',
  mapa: 'Mapa',
  custos: 'Custos',
};

/** A pergunta que o tema responde — o subtitulo do card de escolha. */
export const PORTAL_HOME_THEME_QUESTIONS: Record<PortalHomeTheme, string> = {
  acao: 'O que precisa de mim',
  mapa: 'Onde está minha carga',
  custos: 'Quanto estou gastando',
};

export const PORTAL_HOME_THEME_DESCRIPTIONS: Record<PortalHomeTheme, string> = {
  acao: 'A sua próxima decisão, com o prazo mais próximo.',
  mapa: 'Seus embarques no mapa, por porto de origem.',
  custos: 'A economia gerada e como o frete das suas rotas se move.',
};

export const PORTAL_HOME_CARD_LABELS: Record<PortalHomeCard, string> = {
  acao_urgente: 'Sua ação mais urgente',
  mapa_embarques: 'Mapa dos embarques',
  economia: 'Economia gerada',
  tendencia_preco: 'Tendência de preço das suas rotas',
};

export const PORTAL_HOME_CARD_DESCRIPTIONS: Record<PortalHomeCard, string> = {
  acao_urgente: 'O primeiro item da sua fila, com o prazo mais próximo.',
  mapa_embarques: 'Os embarques plotados no porto de origem.',
  economia: 'O quanto você economizou neste mês e no acumulado.',
  tendencia_preco: 'Como o frete das rotas que você opera se moveu.',
};

/** Em que tema cada card mora — usado para agrupar o modal "Personalizar". */
export const PORTAL_HOME_CARD_THEME: Record<PortalHomeCard, PortalHomeTheme> =
  Object.fromEntries(
    PORTAL_HOME_THEMES.flatMap((theme) =>
      PORTAL_HOME_LAYOUT_CARDS[theme].map((card) => [card, theme] as const),
    ),
  ) as Record<PortalHomeCard, PortalHomeTheme>;

/** Um tema que esta tela reconhece hoje (ver `knownThemes`). */
export function isPortalHomeTheme(value: unknown): value is PortalHomeTheme {
  return (
    typeof value === 'string' &&
    (PORTAL_HOME_THEMES as string[]).includes(value)
  );
}

/**
 * Filtra os temas gravados para os que esta versao conhece.
 *
 * Existe por causa de RENOMEACAO DE VOCABULARIO. Os temas ja se chamaram
 * `alertas`/`mapa_mundi`/`inteligencia`; uma linha gravada com os nomes antigos
 * nao pode virar uma Home vazia e sem saida — sem este filtro,
 * `cardsForThemes` devolveria `[]` e a tela acusaria "todos os cards
 * desligados", que e uma escolha do cliente, nao um vocabulario obsoleto. Zero
 * temas reconhecidos e tratado como "nunca escolheu" e reabre o onboarding
 * (ver `page.tsx`).
 */
export function knownThemes(themes: unknown[]): PortalHomeTheme[] {
  return themes.filter(isPortalHomeTheme);
}

/**
 * Todos os cards dos temas escolhidos, na ordem dos temas.
 *
 * A ordem e a de `PORTAL_HOME_THEMES`, e nao a de `themes`, pela mesma razao da
 * nota acima: a Home nao pode reordenar porque o cliente clicou "Custos" antes
 * de "Ação" no onboarding.
 */
export function cardsForThemes(themes: PortalHomeTheme[]): PortalHomeCard[] {
  const chosen = new Set(themes);
  return PORTAL_HOME_THEMES.filter((t) => chosen.has(t)).flatMap(
    (t) => PORTAL_HOME_LAYOUT_CARDS[t],
  );
}

/**
 * Os cards que a tela deve DESENHAR: os habilitados, menos os que ficaram
 * orfaos de tema.
 *
 * O filtro por tema nao e paranoia com o backend (que ja rejeita card de tema
 * nao escolhido): ele cobre a janela entre o cliente tirar um tema no
 * "Personalizar" e o PUT voltar. Sem ele a tela desenharia por um instante um
 * card do tema que acabou de sair.
 */
export function visibleCards(
  themes: PortalHomeTheme[],
  enabledCards: PortalHomeCard[],
): PortalHomeCard[] {
  const enabled = new Set(enabledCards);
  return cardsForThemes(themes).filter((card) => enabled.has(card));
}

/**
 * Poda `enabledCards` quando os temas mudam, PRESERVANDO o que o cliente
 * desligou nos temas que ficaram.
 *
 * O caso que erra em silencio: religar sozinho um card que o cliente tinha
 * desligado, so porque ele mexeu em OUTRO tema. Por isso um card de tema que ja
 * estava escolhido mantem o estado que tinha, e so tema NOVO entra com tudo
 * ligado — que e o que "acabei de escolher este tema" quer dizer.
 */
export function reconcileEnabledCards(
  previousThemes: PortalHomeTheme[],
  nextThemes: PortalHomeTheme[],
  enabledCards: PortalHomeCard[],
): PortalHomeCard[] {
  const wasChosen = new Set(previousThemes);
  const enabled = new Set(enabledCards);
  return cardsForThemes(nextThemes).filter((card) =>
    wasChosen.has(PORTAL_HOME_CARD_THEME[card]) ? enabled.has(card) : true,
  );
}

/**
 * Cards que ocupam a LARGURA INTEIRA do grid.
 *
 * O mapa, porque um planisferio em meia coluna fica ilegivel; a acao urgente,
 * porque ela e a unica linha da tela com CTA, e dividir a atencao dela com um
 * card ao lado e o oposto do que "sua acao MAIS urgente" promete.
 *
 * Mora aqui, e nao no registro, porque e DADO de layout — e e o que permite
 * testar `layoutRows` sem montar React.
 */
export const FULL_WIDTH_HOME_CARDS: PortalHomeCard[] = [
  'acao_urgente',
  'mapa_embarques',
];

/**
 * Agrupa os cards em FILEIRAS de uma ou duas colunas, preservando a ordem.
 *
 * Existe por causa do vao: uma metade sem par deixaria meia tela vazia ao lado.
 * Aqui ela vira fileira de item unico e a tela a estica, entao a pagina ocupa a
 * largura inteira em QUALQUER combinacao de temas.
 *
 * Com a tabela de cards de hoje nenhuma combinacao produz metade orfa (as duas
 * metades vivem no mesmo tema e sao adjacentes), e o caso chegou a acontecer —
 * o `farol_resumido`, entre dois cards de largura inteira, foi o que motivou
 * esta funcao antes de sair do tema "Acao". A regra fica porque o proximo card
 * meia-largura num tema de numero impar reabre o caso em silencio.
 *
 * NAO REORDENA para preencher buracos. Um `grid-auto-flow: dense` puxaria um
 * card de "Custos" para cima do Mapa, e a ordem dos temas e o que garante que
 * dois clientes com a mesma escolha vejam a mesma Home.
 */
export function layoutRows(cards: PortalHomeCard[]): PortalHomeCard[][] {
  const isFull = (card: PortalHomeCard) => FULL_WIDTH_HOME_CARDS.includes(card);
  const rows: PortalHomeCard[][] = [];

  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    const next = cards[i + 1];
    if (!isFull(card) && next && !isFull(next)) {
      rows.push([card, next]);
      i += 1;
    } else {
      rows.push([card]);
    }
  }

  return rows;
}
