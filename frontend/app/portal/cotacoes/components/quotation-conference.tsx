'use client';
import { useEffect, useState } from 'react';
import { useAuditPreview } from '@/hooks/use-portal-audit-preview';
import type { PortalQuotation } from '@/types/portal';
import { HistoryItem } from './history-item';
import { AuditDocumentModal } from './audit-document-modal';
const key = 'portal:audit:submitted';

/** Preserve the existing document flow when moving conference out of the list. */
export function QuotationConference({
  quotation,
}: {
  quotation: PortalQuotation;
}) {
  const { preview, isLoading } = useAuditPreview(quotation.id);
  const [ids, setIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(saved)) throw new Error();
      setIds(saved);
    } catch {
      setError(
        'Não foi possível recuperar o acompanhamento local da conferência.',
      );
    }
  }, []);
  return (
    <div className="space-y-4">
      {error && <p role="alert">{error}</p>}
      <HistoryItem
        quotation={quotation}
        preview={isLoading ? undefined : (preview ?? null)}
        submitted={ids.includes(quotation.id)}
        onSendDocuments={() => setOpen(true)}
      />
      <AuditDocumentModal
        open={open}
        onOpenChange={setOpen}
        quotationId={quotation.id}
        reference={quotation.reference}
        preview={preview ?? null}
        onSubmitted={(id) => {
          const next = Array.from(new Set([...ids, id]));
          setIds(next);
          try {
            localStorage.setItem(key, JSON.stringify(next));
            setError('');
          } catch {
            setError(
              'Documentação recebida; não foi possível guardar o acompanhamento neste navegador.',
            );
          }
        }}
      />
    </div>
  );
}
