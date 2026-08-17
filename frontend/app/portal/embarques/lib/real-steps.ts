// Os cinco estados operacionais reais, já com o texto que o cliente lê.
//
// Vive fora de `timeline-steps.ts` de propósito: aquele módulo é puro e roda no
// runner nativo do Node (`npm run test:unit`), que não resolve o alias `@/`.
// Por isso `buildTimelineSteps` recebe os passos como argumento em vez de
// importar os rótulos — e é aqui que o argumento é montado, uma vez, para a
// tela de detalhe e para quem mais precisar dele.

import {
  ESTADO_DESCRIPTIONS,
  ESTADO_LABELS,
  SHIPMENT_STEPS,
  type EmbarqueEstado,
} from '@/types/portal-shipment';

export const REAL_STEPS: {
  key: EmbarqueEstado;
  label: string;
  description: string;
}[] = SHIPMENT_STEPS.map((step) => ({
  key: step,
  label: ESTADO_LABELS[step],
  description: ESTADO_DESCRIPTIONS[step],
}));
