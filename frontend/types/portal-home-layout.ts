// EXPERIMENTO INTERNO — Home personalizavel (`/portal/home-personalizada`).
//
// Nao confundir com `PortalPreferences` (types/portal-agent.ts): aquilo e a
// preferencia OPERACIONAL do cliente (porto, incoterm, agentes pausados) e vive
// na tabela da migracao 094. Isto e layout de uma rota de teste, tabela e
// endpoint proprios (migracao 095, `/portal/home-layout-experiment`).

import type {
  PortalHomeCard,
  PortalHomeTheme,
} from '@/app/portal/home-personalizada/lib/home-layout';

export interface PortalHomeLayout {
  themes: PortalHomeTheme[];
  enabled_cards: PortalHomeCard[];
  updated_at: string | null;
}

/**
 * `null` quando o cliente nunca passou pelo onboarding — e o que faz o modal
 * abrir sozinho. Nao confundir com um layout de `enabled_cards: []`, que e o
 * cliente tendo escolhido e desligado tudo.
 */
export type PortalHomeLayoutResponse = { layout: PortalHomeLayout | null };

/** O PUT grava o layout inteiro, nunca um delta — ver o handler. */
export interface SaveHomeLayoutPayload {
  themes: PortalHomeTheme[];
  enabled_cards?: PortalHomeCard[];
}
