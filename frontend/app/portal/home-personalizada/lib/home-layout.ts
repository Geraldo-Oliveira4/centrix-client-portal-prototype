// O "molde": temas, cards e a tabela que liga um ao outro.
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
// e depois quebra o registro no render. Mexeu num lado, mexa no outro.

/** Os tres temas oferecidos no onboarding. */
export type PortalHomeTheme = 'alertas' | 'mapa_mundi' | 'inteligencia';

/**
 * Uniao dos cards disponiveis. Cada valor tem um componente no registro — e o
 * `Record<PortalHomeCard, ...>` de la e o que garante isso em tempo de
 * compilacao: acrescentar um card aqui quebra o build ate ele ganhar um
 * componente.
 */
export type PortalHomeCard =
  | 'acao_urgente'
  | 'alertas_embarque'
  | 'mapa_embarques'
  | 'economia';

export const PORTAL_HOME_THEMES: PortalHomeTheme[] = [
  'alertas',
  'mapa_mundi',
  'inteligencia',
];

/**
 * Tema -> cards. A ORDEM IMPORTA: e a ordem em que os cards aparecem na tela,
 * e ela e a do tema, nao a da escolha do cliente — dois clientes com os mesmos
 * temas veem a mesma Home, e uma demo nao muda de layout entre duas contas.
 *
 * `inteligencia` tem UM card so, e isso e uma lacuna conhecida, nao um
 * esquecimento: o on-time rate existe (`computeOnTimeRate`), mas e renderizado
 * inline nas telas de Executivo e Performance — nao ha card extraido para
 * reaproveitar, e inventar um aqui criaria um segundo lugar calculando o mesmo
 * numero.
 */
export const PORTAL_HOME_LAYOUT_CARDS: Record<PortalHomeTheme, PortalHomeCard[]> =
  {
    alertas: ['acao_urgente', 'alertas_embarque'],
    mapa_mundi: ['mapa_embarques'],
    inteligencia: ['economia'],
  };

/**
 * Teto de temas no onboarding. Hoje igual ao numero de temas existentes, e de
 * proposito NAO derivado de `PORTAL_HOME_THEMES.length`: o teto e do produto
 * ("escolha ate tres"), e um quarto tema nao deve afrouxa-lo sozinho.
 */
export const MAX_PORTAL_HOME_THEMES = 3;

export const PORTAL_HOME_THEME_LABELS: Record<PortalHomeTheme, string> = {
  alertas: 'Alertas',
  mapa_mundi: 'Mapa-múndi',
  inteligencia: 'Inteligência',
};

export const PORTAL_HOME_THEME_DESCRIPTIONS: Record<PortalHomeTheme, string> = {
  alertas: 'O que depende de você agora e o que mudou nos seus embarques.',
  mapa_mundi: 'Onde estão seus embarques, por porto de origem.',
  inteligencia: 'Quanto a sua operação economizou com a Freitas.',
};

export const PORTAL_HOME_CARD_LABELS: Record<PortalHomeCard, string> = {
  acao_urgente: 'Sua ação mais urgente',
  alertas_embarque: 'Notificações dos embarques',
  mapa_embarques: 'Mapa dos embarques',
  economia: 'Economia gerada',
};

export const PORTAL_HOME_CARD_DESCRIPTIONS: Record<PortalHomeCard, string> = {
  acao_urgente: 'O primeiro item da sua fila, com o prazo mais próximo.',
  alertas_embarque: 'O feed de notificações, com os mesmos filtros de Meus Embarques.',
  mapa_embarques: 'Os embarques plotados no porto de origem.',
  economia: 'O quanto você economizou neste mês e no acumulado.',
};

/** Em que tema cada card mora — usado para agrupar o modal "Personalizar". */
export const PORTAL_HOME_CARD_THEME: Record<PortalHomeCard, PortalHomeTheme> =
  Object.fromEntries(
    PORTAL_HOME_THEMES.flatMap((theme) =>
      PORTAL_HOME_LAYOUT_CARDS[theme].map((card) => [card, theme] as const),
    ),
  ) as Record<PortalHomeCard, PortalHomeTheme>;

/**
 * Todos os cards dos temas escolhidos, na ordem dos temas.
 *
 * A ordem e a de `PORTAL_HOME_THEMES`, e nao a de `themes`, pela mesma razao da
 * nota acima: a Home nao pode reordenar porque o cliente clicou "Inteligência"
 * antes de "Alertas" no onboarding.
 */
export function cardsForThemes(themes: PortalHomeTheme[]): PortalHomeCard[] {
  const chosen = new Set(themes);
  return PORTAL_HOME_THEMES.filter((t) => chosen.has(t)).flatMap(
    (t) => PORTAL_HOME_LAYOUT_CARDS[t],
  );
}

/**
 * Os cards que a tela deve DESENHAR: os habilitados, menos os que ficaram orfaos
 * de tema.
 *
 * O filtro por tema nao e paranoia com o backend (que ja rejeita card de tema
 * nao escolhido): ele cobre a janela entre o cliente tirar um tema no
 * onboarding e o PUT voltar. Sem ele a tela desenharia por um instante um card
 * do tema que acabou de sair.
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
