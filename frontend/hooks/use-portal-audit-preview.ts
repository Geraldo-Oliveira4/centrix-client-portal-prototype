// MOCK - Auditoria real (Camada de Auditoria de Frete/Fatura) é produto separado,
// sequenciado após GE go-live. Este preview existe apenas para visualização
// conceitual no debate de produto.
//
// O endpoint só responde 200 para cotação FECHADA (409 caso contrário), então o
// chamador passa `null` enquanto a cotação não estiver fechada e o SWR nem sai.

import useSWR from 'swr';
import portal_api from '@/lib/portal-api';
import type { PortalAuditPreview } from '@/types/portal-audit';

const fetcher = async (url: string): Promise<PortalAuditPreview> => {
  const response = await portal_api.get<{ audit_preview: PortalAuditPreview }>(url);
  return response.data.audit_preview;
};

export const useAuditPreview = (quotationId: string | null) => {
  const { data, error } = useSWR<PortalAuditPreview>(
    quotationId ? `/portal/quotations/${quotationId}/audit-preview` : null,
    fetcher,
  );
  return {
    preview: data,
    isLoading: !!quotationId && !error && !data,
    isError: !!error,
  };
};
