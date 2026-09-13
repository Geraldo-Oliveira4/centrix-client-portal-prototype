'use client';
import { useEffect, useState } from 'react';
import type { PortalQuotationsResponse, PortalQuotation } from '@/types/portal';
import type { Quote } from '../previa/model';

export function usePreparationData(
  data: PortalQuotationsResponse | undefined,
  clientId?: string,
) {
  const [overrides, setOverrides] = useState<
    Record<string, { quote: Quote; waiting: boolean }>
  >({});
  useEffect(() => {
    if (!data || !clientId) {
      setOverrides({});
      return;
    }
    const read = () => {
      const next: typeof overrides = {};
      for (const q of Object.values(data.buckets).flat()) {
        try {
          const value = JSON.parse(
            localStorage.getItem(
              `centrix-preparation-v1:${clientId}:${q.id}`,
            ) || 'null',
          );
          if (value?.quote?.manualDraft) next[q.id] = value;
        } catch {
          /* The detail exposes the storage error and prevents overwriting. */
        }
      }
      setOverrides(next);
    };
    read();
    window.addEventListener('centrix-preparation', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('centrix-preparation', read);
      window.removeEventListener('storage', read);
    };
  }, [data, clientId]);
  if (!data) return data;
  const moved: PortalQuotation[] = [];
  const buckets = { ...data.buckets };
  buckets.aguardando_dados = data.buckets.aguardando_dados.flatMap((source) => {
    const local = overrides[source.id];
    if (!local) return [source];
    const q = {
      ...source,
      exporter_name: local.quote.supplier,
      product: local.quote.product,
      client_reference: local.quote.po,
    };
    if (local.waiting) {
      moved.push({ ...q, state: 'COTANDO' });
      return [];
    }
    return [q];
  });
  buckets.buscando_propostas = [...moved, ...data.buckets.buscando_propostas];
  return { ...data, buckets };
}
