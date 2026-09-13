import type { PortalQuotation } from '../../../../types/portal';

export const outcomes = {
  all: 'Todas',
  FECHADA: 'Fechadas',
  DECLINADA: 'Propostas recusadas',
  CANCELADO: 'Canceladas',
  negadas: 'Recusadas e canceladas',
};
export type HistoryFilter = keyof typeof outcomes;
export function historyFilter(params: URLSearchParams): HistoryFilter {
  const value = params.get('resultado');
  if (value && Object.hasOwn(outcomes, value)) return value as HistoryFilter;
  return params.get('tab') === 'fechadas'
    ? 'FECHADA'
    : params.get('tab') === 'negadas'
      ? 'negadas'
      : 'all';
}
export const isHistory = (state: string) =>
  ['FECHADA', 'DECLINADA', 'CANCELADO'].includes(state);
export function closingDate(q: PortalQuotation) {
  const date =
    q.state === 'FECHADA'
      ? q.closed_at
      : q.state === 'DECLINADA'
        ? q.declined_at
        : null;
  return {
    value: date || q.updated_at || q.created_at,
    label: date ? 'Encerrada em' : 'Última atualização',
  };
}
export function finalProposal(q: PortalQuotation) {
  if (q.state !== 'FECHADA') return null;
  const candidates = q.proposals ?? (q.best_proposal ? [q.best_proposal] : []);
  const winners = candidates.filter(
    (p) =>
      p.is_winner && (!q.winning_agent_id || q.winning_agent_id === p.agent_id),
  );
  return winners.length === 1 ? winners[0] : null;
}
const normalized = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
export function filterHistory(
  rows: PortalQuotation[],
  query: string,
  outcome: HistoryFilter,
  days: string,
  now = Date.now(),
) {
  const cutoff = ['30', '90', '365'].includes(days)
    ? now - Number(days) * 86400000
    : null;
  return rows
    .filter((q) => isHistory(q.state))
    .filter(
      (q) =>
        outcome === 'all' ||
        (outcome === 'negadas'
          ? ['DECLINADA', 'CANCELADO'].includes(q.state)
          : q.state === outcome),
    )
    .filter((q) =>
      normalized(
        [
          q.exporter_name,
          q.reference,
          q.client_reference,
          q.product,
          q.origin,
          q.porto_embarque,
          q.porto_destino,
          q.aeroporto_embarque,
          q.aeroporto_destino,
        ]
          .flat()
          .filter(Boolean)
          .join(' '),
      ).includes(normalized(query.trim())),
    )
    .filter((q) => cutoff == null || Date.parse(closingDate(q).value) >= cutoff)
    .sort(
      (a, b) =>
        (Date.parse(closingDate(b).value) || 0) -
        (Date.parse(closingDate(a).value) || 0),
    );
}
export function historyReturn(value: string | null) {
  return value?.startsWith('/portal/cotacoes?')
    ? value
    : '/portal/cotacoes?tab=historico';
}
