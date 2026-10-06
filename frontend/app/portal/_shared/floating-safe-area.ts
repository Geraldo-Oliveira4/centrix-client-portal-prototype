// "Elementos flutuantes nunca cobrem ação primária" (07/10/2026).
//
// O botão "Ajuda" e a aba "Demonstração" vivem nos cantos de baixo da tela; a
// barra fixa de decisão da cotação ("Sua escolha / Revisar escolha") e os
// rodapés fixos das gavetas dos iframes também. Antes, a Ajuda cobria
// "Revisar escolha". A regra agora é UMA, para o portal inteiro:
//
//   toda barra de ação presa ao rodapé se registra (useBottomActionBar no
//   React, `_shared/floating-safe.js` nos iframes) com o espaço que ocupa a
//   partir da base da janela; o maior deles vira `--floating-bottom-offset`
//   no <html>, e os flutuantes sobem acima dele. O conteúdo ganha
//   `--floating-content-pad` para nada ficar escondido atrás dos dois.
//
// PURO (sem DOM, sem `@/`): as contas rodam sob `node --test`.

/** Quão perto da base a barra precisa estar para contar como "presa ao rodapé". */
export const ANCHOR_TOLERANCE_PX = 56;
/** Folga entre a barra e o flutuante que sobe acima dela. */
export const FLOATING_GAP_PX = 8;
/** Altura do botão flutuante (Ajuda: 44px) e a margem dele até a borda. */
export const FLOATING_HEIGHT_PX = 44;
export const FLOATING_EDGE_PX = 16;
/** Abaixo disto, com barra presente, a Ajuda vira só ícone. */
export const COMPACT_BELOW_PX = 1024;

export interface BarRect {
  top: number;
  bottom: number;
}

/**
 * Quanto da janela, a partir da base, a barra ocupa. 0 quando ela não está
 * presa ao rodapé (rolou para dentro da página, está fora da tela ou vazia).
 */
export function barOccupancy(
  rect: BarRect,
  viewportHeight: number,
  tolerance = ANCHOR_TOLERANCE_PX,
): number {
  if (rect.bottom - rect.top <= 0) return 0;
  if (rect.top >= viewportHeight) return 0;
  if (rect.bottom < viewportHeight - tolerance) return 0;
  return Math.max(0, Math.round(viewportHeight - rect.top));
}

/**
 * Quanto os flutuantes sobem: a barra mais alta + folga, menos a margem que o
 * flutuante já tem até a borda. 0 sem barra.
 */
export function floatingOffset(occupancies: Iterable<number>): number {
  const max = Math.max(0, ...Array.from(occupancies));
  if (max <= 0) return 0;
  return Math.max(0, max + FLOATING_GAP_PX - FLOATING_EDGE_PX);
}

/** Espaço que o conteúdo precisa ao fim da página para não sumir atrás da barra e da Ajuda. */
export function contentPadding(offset: number): number {
  if (offset <= 0) return 0;
  return offset + FLOATING_EDGE_PX + FLOATING_HEIGHT_PX + FLOATING_EDGE_PX;
}

export function compactFloating(offset: number, viewportWidth: number): boolean {
  return offset > 0 && viewportWidth < COMPACT_BELOW_PX;
}

/** Retângulo de uma barra de dentro de um iframe, nas coordenadas da janela de fora. */
export function rectFromIframe(iframeTop: number, child: BarRect): BarRect {
  return { top: iframeTop + child.top, bottom: iframeTop + child.bottom };
}

/** Mensagem que os iframes do protótipo mandam (`_shared/floating-safe.js`). */
export const IFRAME_BAR_MESSAGE = 'centrix:bottom-bar';
