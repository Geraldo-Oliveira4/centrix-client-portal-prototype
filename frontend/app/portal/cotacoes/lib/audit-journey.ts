// Audit journey status — client-side only.
//
// There is no audit engine and no invoice/BL analysis in this prototype: the
// divergence flag comes from the mock audit-preview, and "sent for review" is a
// state the client drives by uploading documents (tracked in localStorage). So
// this whole status layer is illustrative and must stay inside the preview frame.
//
// The two origins ("Auditado automaticamente" vs "Conferido via documentação")
// are ONE journey to the client — never surfaced as two different technical
// engines.

import type { SemaforoTone } from '@/types/portal-shipment';

export type AuditStatus = 'auditado' | 'em_conferencia' | 'divergencia';

export interface AuditRowStatus {
  status: AuditStatus;
  label: string;
  tone: SemaforoTone;
  originLabel: string;
}

// Precedence: a row the client sent documents for is "em conferência" (they are
// resolving it), whatever the automatic result was; otherwise the mock
// divergence flag decides between "divergência" and "auditado".
export function resolveAuditStatus(
  divergent: boolean,
  submitted: boolean,
): AuditRowStatus {
  if (submitted) {
    return {
      status: 'em_conferencia',
      label: 'Em conferência',
      tone: 'warning',
      originLabel: 'Conferido via documentação',
    };
  }
  if (divergent) {
    return {
      status: 'divergencia',
      label: 'Divergência',
      tone: 'danger',
      originLabel: 'Auditado automaticamente',
    };
  }
  return {
    status: 'auditado',
    label: 'Auditado',
    tone: 'success',
    originLabel: 'Auditado automaticamente',
  };
}
