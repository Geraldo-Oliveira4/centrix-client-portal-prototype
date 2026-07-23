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

// Aggregated variant for the standalone Auditoria module: fans out the SAME
// per-quotation GET endpoint over every closed quotation and returns the
// previews keyed by id. No new backend endpoint — the list view is composed
// entirely from the existing per-quotation audit-preview reads, so the numbers
// match the per-quotation detail exactly. Each id is fetched with its own
// try/catch so one 409 (e.g. a closed quotation without a winning proposal)
// yields `null` for that row instead of failing the whole batch.
export const useAuditPreviews = (quotationIds: string[]) => {
  const ids = [...quotationIds].sort();
  const key = ids.length ? ['portal-audit-previews', ...ids] : null;

  const { data, error } = useSWR<Record<string, PortalAuditPreview | null>>(
    key,
    async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await portal_api.get<{ audit_preview: PortalAuditPreview }>(
              `/portal/quotations/${id}/audit-preview`,
            );
            return [id, res.data.audit_preview] as const;
          } catch {
            return [id, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
  );

  return {
    previews: data ?? {},
    isLoading: !!key && !error && !data,
    isError: !!error,
  };
};
