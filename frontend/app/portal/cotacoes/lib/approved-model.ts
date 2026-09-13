import type { PortalQuotation } from '../../../../types/portal';

export const isApprovedQuotation = (q: Pick<PortalQuotation, 'state'>) =>
  q.state === 'APROVADA_PELO_CLIENTE' || q.state === 'FECHADA';

export function openingStage(
  linked: boolean,
  blocked: boolean,
  sent: boolean,
  local: boolean,
) {
  if (linked) return 'linked';
  if (blocked) return 'review';
  if (sent) return 'sent';
  if (local) return 'local';
  return 'ready';
}
