// Layout da Home do Portal do Cliente (`/portal/home`): os temas que o cliente
// escolheu no onboarding e os cards que ele deixou ligados.
//
// Nao confundir com `PortalPreferences` (types/portal-agent.ts): aquilo e a
// preferencia OPERACIONAL do cliente (porto, incoterm, agentes pausados) e vive
// na tabela da migracao 094. Isto e layout de tela, com tabela e endpoint
// proprios (migracao 095, `/portal/home-layout-experiment` — o nome guarda a
// origem experimental da frente; ver o handler no backend).

import type {
  PortalHomeCard,
  PortalHomeTheme,
} from '@/app/portal/home/lib/home-layout';

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
