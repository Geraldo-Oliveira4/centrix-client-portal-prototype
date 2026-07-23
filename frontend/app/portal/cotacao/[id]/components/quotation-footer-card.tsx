'use client';

import { formatDate, formatTotals } from '@/lib/portal-formatters';
import type { PortalQuotation } from '@/types/portal';

export function QuotationFooterCard({ quotation }: { quotation: PortalQuotation }) {
  return (
    <section className="portal-card-muted space-y-3 p-6">
      <h2 className="portal-h3 text-foreground">Dados da cotação</h2>
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
      <span className="portal-small text-portal-neutral">{label}</span>
      <span className="portal-body font-medium">{value || '—'}</span>
    </div>
  );
}
