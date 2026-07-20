'use client';

import { formatDate, formatTotals } from '@/lib/portal-formatters';
import type { PortalQuotation } from '@/types/portal';

export function QuotationFooterCard({ quotation }: { quotation: PortalQuotation }) {
  return (
    <section className="rounded-md border bg-background p-4 space-y-3 text-sm">
      <h3 className="text-base font-semibold">Dados da cotação</h3>
      <Field label="Solicitada em" value={formatDate(quotation.created_at)} />
      <Field label="Carga" value={formatTotals(quotation.totals, quotation.modal)} />
      <Field label="Produto" value={quotation.product} />
      <Field label="Modal" value={quotation.modal} />
      <Field label="Incoterm" value={quotation.incoterm} />
      <Field label="PO" value={quotation.client_reference} />
      <Field label="Chegada desejada" value={formatDate(quotation.data_limite_necessidade)} />
    </section>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between border-b last:border-b-0 pb-2 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  );
}
