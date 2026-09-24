// Quais cards da Home pertencem a um módulo que pode estar desligado.
//
// PURE, sem o alias `@/`: roda sob `npm run test:unit`.
//
// A TABELA MORA AQUI, e não em `home/lib/home-layout.ts`, por uma razão de
// fronteira: aquele arquivo é espelhado campo a campo com
// `backend/app/home_layout_experiment.py` (o `H11` do e2e compara os dois), e
// módulo desligado é um conceito que só existe nesta camada de demonstração. O
// backend não conhece flags.
//
// DUAS SITUAÇÕES DIFERENTES, e a distinção é o ponto:
//
//   - O card É o módulo. "Mapa dos embarques" desenha a carteira de Meus
//     Embarques; com o módulo desligado ele mostraria exatamente o que o menu
//     acabou de esconder. Some.
//   - O card só LINKA para o módulo. "Economia gerada" e "Tendência de preço"
//     são calculados das cotações e dos embarques do cliente, não da
//     Inteligência — o que aponta para lá é o link de rodapé. Esconder o card
//     inteiro apagaria um número que o cliente tem direito de ver; some o link,
//     fica o card (ver `savings-card.tsx` e `price-trend-card.tsx`).

import type { PortalHomeCard } from '../../home/lib/home-layout.ts';
import type { PortalModule, PortalModuleFlags } from './feature-flags.ts';

/**
 * Card -> módulo que o card É. `null` quando o card não pertence a módulo
 * nenhum, ou quando só o link dele aponta para fora.
 *
 * `acao_urgente` é `null` de propósito: ele já filtra as próprias linhas por
 * módulo dentro do registro (`card-registry.tsx`), então uma ação de um módulo
 * desligado some sozinha e o card continua servindo o outro módulo.
 */
export const PORTAL_HOME_CARD_MODULE: Record<
  PortalHomeCard,
  PortalModule | null
> = {
  acao_urgente: null,
  mapa_embarques: 'embarques',
  economia: null,
  tendencia_preco: null,
};

/** Os cards que podem ser desenhados com estas flags. */
export function releasedHomeCards(
  cards: PortalHomeCard[],
  flags: PortalModuleFlags,
): PortalHomeCard[] {
  return cards.filter((card) => {
    const module = PORTAL_HOME_CARD_MODULE[card];
    return module == null || flags[module];
  });
}

/**
 * Quantos cards a Home escondeu por causa de um módulo desligado.
 *
 * A Home precisa saber DISTINGUIR os dois vazios: "o cliente desligou tudo em
 * Personalizar" (escolha dele, e o caminho de volta é o modal) e "os cards que
 * sobraram são de módulos que a empresa não tem" (não é escolha dele, e não há
 * o que ele possa fazer no modal). Dizer a primeira frase na segunda situação
 * mandaria o cliente procurar um botão que não resolve nada.
 */
export function homeCardsHiddenByModule(
  cards: PortalHomeCard[],
  flags: PortalModuleFlags,
): number {
  return cards.length - releasedHomeCards(cards, flags).length;
}
