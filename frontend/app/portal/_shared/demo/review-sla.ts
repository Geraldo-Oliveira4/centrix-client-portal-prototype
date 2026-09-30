// O prazo das revisões da Freitas — UMA regra para as duas jornadas V2.
//
// PURE, sem o alias `@/`: roda sob `npm run test:unit`.
//
// DECISÃO DO ORSI (29/09/2026): 1 hora na revisão de ENTRADA e 1 hora na
// revisão de SAÍDA. O Embarque via PO herda o mesmo prazo até que ele decida
// outro (itens 2.3/2.4 do Embarque via PO estão em aberto).
//
// PERGUNTA ABERTA: se a hora conta em horário CORRIDO ou só em horário
// comercial. O protótipo assume CORRIDO. Trocar é mudar `clock` abaixo — os
// rótulos das duas jornadas saem daqui, e `reviewDueAt` para de calcular um
// horário (horário útil exigiria o calendário comercial da Freitas, que não
// existe neste repositório, e inventar um seria pior que não mostrar).

export type ReviewSlaClock = 'corrido' | 'util';

export interface ReviewSla {
  hours: number;
  clock: ReviewSlaClock;
}

export const REVIEW_SLA: ReviewSla = { hours: 1, clock: 'corrido' };

/** "até 1 hora" · "até 2 horas" · "até 1 hora útil" · "até 4 horas úteis". */
export function reviewSlaLabel(sla: ReviewSla = REVIEW_SLA): string {
  const plural = sla.hours !== 1;
  const unit = plural ? 'horas' : 'hora';
  const suffix = sla.clock === 'util' ? (plural ? ' úteis' : ' útil') : '';
  return `até ${sla.hours} ${unit}${suffix}`;
}

/**
 * Quando a revisão que começou em `enteredAt` vence, ou `null`.
 *
 * `null` em horário útil (ver o cabeçalho) e com data inválida. Em horário
 * corrido é soma simples: o prazo é uma duração, não um horário comercial.
 */
export function reviewDueAt(
  enteredAt: string,
  sla: ReviewSla = REVIEW_SLA,
): Date | null {
  if (sla.clock !== 'corrido') return null;
  const start = Date.parse(enteredAt);
  if (!Number.isFinite(start)) return null;
  return new Date(start + sla.hours * 60 * 60 * 1000);
}
