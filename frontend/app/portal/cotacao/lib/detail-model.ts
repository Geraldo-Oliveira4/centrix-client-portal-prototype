import type { PortalProposal } from '../../../../types/portal';
import { seededInt } from '../../inteligencia/lib/intel-helpers.ts';

/** Eligibility uses the current calendar day, unlike the frozen review fixtures. */
export function proposalIssue(
  p: Pick<PortalProposal, 'total_brl' | 'validity'>,
  today = new Date().toLocaleDateString('en-CA'),
): string | null {
  if (!Number.isFinite(p.total_brl) || p.total_brl <= 0)
    return 'Valor a confirmar';
  if (!p.validity || !Number.isFinite(Date.parse(p.validity)))
    return 'Validade a confirmar';
  if (p.validity.slice(0, 10) < today) return 'Proposta vencida';
  return null;
}

/**
 * "2 pallets, 850 kg": a carga por extenso, quando TODOS os volumes da cotação
 * são pallets. Fora disso devolve `null` e a tela cai no `formatTotals` de
 * sempre ("850 kg / 2 vol.") — a contagem genérica "vol." não diz que tipo de
 * volume é, e inventar o tipo seria pior do que não dizer.
 */
export function palletCargoSummary(q: {
  volumes?: { quantity: number; embalagem: string | null }[] | null;
  totals?: { weight_kg: number | null } | null;
}): string | null {
  const volumes = q.volumes ?? [];
  if (!volumes.length || volumes.some((v) => v.embalagem !== 'PALLET'))
    return null;
  const count = volumes.reduce((sum, v) => sum + v.quantity, 0);
  if (!(count > 0)) return null;
  const pallets = `${count} ${count === 1 ? 'pallet' : 'pallets'}`;
  const weight = q.totals?.weight_kg;
  return weight != null && weight > 0
    ? `${pallets}, ${weight.toLocaleString('pt-BR')} kg`
    : pallets;
}

/** Same illustrative 8% benchmark as the existing MarketBlock; one base per quote. */
export function illustrativeMarketReference(
  proposals: PortalProposal[],
): number | null {
  const priced = proposals.filter(
    (p) => Number.isFinite(p.total_brl) && p.total_brl > 0,
  );
  const reference =
    priced.find((p) => p.is_winner) ??
    priced.find((p) => p.is_recommended) ??
    [...priced].sort((a, b) => a.total_brl - b.total_brl)[0];
  return reference ? reference.total_brl * 1.08 : null;
}

/**
 * Históricos FIXOS de demonstração, por agente. Existem para o roteiro da demo
 * comercial (27/11/2026): a Gamma é a recomendada da COT-2026-0016 e a amostra
 * sorteada dela (7 de 11, 2 divergências) contradizia a indicação na mesma
 * coluna. Continua ilustrativo como o resto; só deixa de ser sorteado.
 */
const DEMO_HISTORY_OVERRIDES: Record<
  string,
  { completed: number; onTime: number; audited: number; discrepancies: number }
> = {
  'demo-agent-gamma': { completed: 11, onTime: 10, audited: 9, discrepancies: 0 },
};

/** UI reference only: stable sample per agent, not calculated from shipment records. */
export function illustrativeAgentHistory(agentId: string) {
  const fixed = DEMO_HISTORY_OVERRIDES[agentId];
  if (fixed) return { ...fixed };
  const completed = seededInt(agentId + ':sample', 8, 24);
  const audited = completed - 2;
  return {
    completed,
    onTime: completed - seededInt(agentId + ':late', 1, 4),
    audited,
    discrepancies: seededInt(agentId + ':billing', 0, 2),
  };
}
