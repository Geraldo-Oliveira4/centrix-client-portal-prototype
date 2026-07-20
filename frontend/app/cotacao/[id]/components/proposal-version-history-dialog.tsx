'use client';

import { Badge } from '@/components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProposalVersions } from '@/hooks/use-proposals';
import { cn } from '@/lib/utils';
import type { QuotationProposal } from '@/types/quotation';
import { LoadingState } from '@arboria-tech/arboria-ui';
import { formatCurrencyCode } from '@/lib/portal-formatters';

const FIELD_LABELS: Record<string, string> = {
  total_value: 'Valor total',
  freight_value: 'Frete',
  transit_time: 'Transit time (dias)',
  carrier: 'Transportadora',
  incoterm: 'Incoterm',
  route_detail: 'Rota',
  insurance_included: 'Seguro incluso',
  validity: 'Validade',
  numero_oferta: 'Nr. oferta',
  ptax_percentual: 'PTAX (%)',
  prazo_pagamento_dias: 'Prazo pagamento (dias)',
  seguro_percentual: 'Seguro (%)',
  seguro_minimo: 'Seguro minimo',
  frequencia: 'Frequencia',
  observations: 'Observacoes',
  taxes_breakdown: 'Encargos',
  freight_currency: 'Moeda frete',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Nao';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

interface ProposalVersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string;
  proposal: QuotationProposal;
}

export function ProposalVersionHistoryDialog({
  open,
  onOpenChange,
  quotationId,
  proposal,
}: ProposalVersionHistoryDialogProps) {
  const agentName = proposal.agent?.name ?? `Agente ${proposal.agent_id.slice(0, 8)}`;
  const { versions, isLoading } = useProposalVersions(
    open ? quotationId : null,
    open ? proposal.id : null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-content-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historico de versoes — {agentName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <LoadingState message="Carregando versoes..." />
        ) : !versions || versions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhuma versao encontrada.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {[...versions].reverse().map((v) => (
              <VersionCard key={v.id} version={v} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface VersionCardProps {
  version: QuotationProposal;
}

function VersionCard({ version }: VersionCardProps) {
  const isLatest = version.is_latest;
  const hasDiff = version.version_diff && Object.keys(version.version_diff).length > 0;
  const receivedAt = new Date(version.received_at).toLocaleString('pt-BR');

  return (
    <div
      className={cn(
        'rounded-lg border p-4 flex flex-col gap-3',
        isLatest && 'border-primary/40 bg-primary/5',
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant="outline"
          className="text-xs font-mono font-semibold"
        >
          V{version.version}
        </Badge>
        {isLatest && (
          <Badge className="text-xs bg-primary text-primary-foreground">
            Atual
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">{receivedAt}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <VersionField label="Valor total" value={formatCurrencyCode(Number(version.total_value), version.freight_currency)} />
        <VersionField label="Frete" value={formatCurrencyCode(Number(version.freight_value), version.freight_currency)} />
        <VersionField label="Transit time" value={`${version.transit_time} dias`} />
        {version.carrier && <VersionField label="Transportadora" value={version.carrier} />}
      </div>

      {hasDiff && (
        <div className="border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Alteracoes nesta versao
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Campo</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Antes</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Depois</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(version.version_diff!).map(([field, change]) => (
                  <tr key={field} className="border-b last:border-0">
                    <td className="px-2 py-1.5 font-medium text-foreground">
                      {FIELD_LABELS[field] ?? field}
                    </td>
                    <td className="px-2 py-1.5 text-red-600 dark:text-red-400 line-through">
                      {formatValue(change.before)}
                    </td>
                    <td className="px-2 py-1.5 text-green-700 dark:text-green-400 font-medium">
                      {formatValue(change.after)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function VersionField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
