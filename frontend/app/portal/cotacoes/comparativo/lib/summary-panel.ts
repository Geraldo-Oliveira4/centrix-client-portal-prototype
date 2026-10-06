// "Resumo da solicitação" recolhível (07/10/2026). PURO, roda sob `node --test`.
//
// Sem escolha gravada, o painel abre a partir de 1536px (`2xl`) e nasce
// recolhido abaixo disso: a 1440px, aberto, ele tirava da tabela o espaço de
// duas colunas. A escolha do cliente, quando existe, vence a largura — é
// preferência de tela, guardada no store de demonstração como as outras do
// protótipo (o "Reiniciar" do painel a limpa).

import { decodeDemoValue } from '../../../_shared/demo/demo-store.ts';

export const SUMMARY_PANEL_STORE_NAME = 'comparativo-summary-open';

/** Largura a partir da qual o painel abre por padrão (Tailwind `2xl`). */
export const SUMMARY_OPEN_MIN_WIDTH = 1536;

/** A escolha gravada, ou `null` quando o cliente nunca escolheu. */
export function parseSummaryOpen(raw: string | null): boolean | null {
  return decodeDemoValue<boolean | null>(raw, null, (parsed) =>
    typeof parsed === 'boolean' ? parsed : null,
  );
}

export function summaryOpen(stored: boolean | null, viewportWidth: number): boolean {
  return stored ?? viewportWidth >= SUMMARY_OPEN_MIN_WIDTH;
}
