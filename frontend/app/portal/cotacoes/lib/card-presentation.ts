import type { PortalQuotation } from '../../../../types/portal';
import { proposalIssue } from '../../cotacao/lib/detail-model.ts';

/** Cards explain the current step; a first response is not a released comparison. */
export function cardPresentation(q: PortalQuotation, today?: string) {
  const supplier = q.exporter_name?.trim() || null;
  const count =
    q.proposals_count ?? q.proposals?.length ?? (q.best_proposal ? 1 : 0);
  const needsInfo = q.state === 'AGUARDANDO_DADOS';
  const deciding = q.state === 'ENVIADA_CLIENTE';
  const reviewing = q.state === 'APROVADA_PELO_CLIENTE';
  const best = deciding ? q.best_proposal : undefined;
  const issue = best ? proposalIssue(best, today) : null;
  const status = needsInfo
    ? 'Complete as informações solicitadas'
    : reviewing
      ? q.guard_rail_active
        ? 'Sua escolha está em análise'
        : 'Sua escolha foi liberada'
      : q.state === 'TRIAGEM_IA'
        ? 'Solicitação em análise'
        : count > 0
          ? `${count} ${count === 1 ? 'proposta recebida' : 'propostas recebidas'}`
          : 'Aguardando propostas dos agentes';
  return {
    supplier,
    title: supplier || q.product?.trim() || q.reference,
    count,
    needsInfo,
    deciding,
    reviewing,
    best,
    issue,
    status,
    // Presence of a score alone does not identify the recommended offer.
    recommended: !!best && !issue && best.is_recommended === true,
    showPrice: !!best && Number.isFinite(best.total_brl) && best.total_brl > 0,
  };
}
