// MOCK - Auditoria real (Camada de Auditoria de Frete/Fatura) é produto separado,
// sequenciado após GE go-live. Este preview existe apenas para visualização
// conceitual no debate de produto.
//
// Contrato de GET /portal/quotations/{id}/audit-preview (backend/app/audit_preview.py).
// Só `quoted_value_brl` tem lastro: é o total da proposta vencedora. Todo campo
// com prefixo `mock_` é fabricado — não existe valor realizado (fatura/BL) em
// nenhuma tabela deste repositório.

export interface PortalAuditPreview {
  is_mock: true;
  disclaimer: string;
  // Real — proposta vencedora.
  quoted_value_brl: number;
  quoted_value_source: 'winning_proposal';
  // Fabricado.
  mock_realized_value_brl: number;
  mock_variation_pct: number;
  mock_difference_brl: number;
  mock_divergence_detected: boolean;
  divergence_threshold_pct: number;
}
