'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatBRL, formatCurrency, formatDate, formatEstimatedArrival } from '@/lib/portal-formatters';
import { PROPOSAL_ROUTE_TYPE_LABELS } from '@/types/quotation';
import type { PortalProposal } from '@/types/portal';

interface ProposalsTableProps {
  proposals: PortalProposal[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  winnerId: string | null;
  locked: boolean;
  headerHint?: string;
}

export function ProposalsTable({
  proposals,
  selectedId,
  onSelect,
  winnerId,
  locked,
  headerHint,
}: ProposalsTableProps) {
  return (
    <section className="portal-card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-4">
        <h2 className="portal-h2 text-foreground">
          Propostas Disponíveis ({proposals.length})
        </h2>
        <p className="portal-small text-portal-neutral">
          {headerHint ?? getHeaderHint(locked, winnerId)}
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {/* Empty corner above the label column */}
              <th className="sticky left-0 bg-background z-10 w-36 border-b border-r" />
              {proposals.map((p) => {
                const isWinner = winnerId != null && p.id === winnerId;
                const isSelected = !locked && p.id === selectedId;
                const dimmed = locked && !isWinner;
                return (
                  <th
                    key={p.id}
                    className={cn(
                      'px-4 py-3 border-b min-w-[180px] align-top text-center font-normal',
                      isWinner && 'bg-emerald-50/60 dark:bg-emerald-950/20',
                      isSelected && !locked && 'bg-muted/30',
                      dimmed && 'opacity-50',
                    )}
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex flex-wrap justify-center gap-1 min-h-[1rem]">
                        {isWinner && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Vencedora
                          </span>
                        )}
                        {!locked && p.is_recommended && (
                          <span className="inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-xs text-violet-700">
                            <Sparkles className="h-3 w-3" />
                            Recomendada
                          </span>
                        )}
                        {!locked && p.is_cheapest && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">
                            Menor preço
                          </span>
                        )}
                        {!locked && p.is_fastest && !p.is_cheapest && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                            Mais rápido
                          </span>
                        )}
                      </div>
                      <span className="font-semibold text-foreground">
                        {p.agent?.name ?? '—'}
                      </span>
                      {!locked && (
                        <input
                          type="radio"
                          checked={p.id === selectedId}
                          onChange={() => onSelect(p.id)}
                          className="mt-0.5 cursor-pointer"
                          aria-label={`Selecionar proposta de ${p.agent?.name ?? 'agente'}`}
                        />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <CompareRow label="Total (BRL)">
              {proposals.map((p) => {
                const isWinner = winnerId != null && p.id === winnerId;
                return (
                  <DataCell key={p.id} isWinner={isWinner} isSelected={!locked && p.id === selectedId} dimmed={locked && !isWinner}>
                    <span className="font-bold">{formatBRL(p.total_brl)}</span>
                  </DataCell>
                );
              })}
            </CompareRow>

            <CompareRow label="Frete">
              {proposals.map((p) => {
                const isWinner = winnerId != null && p.id === winnerId;
                return (
                  <DataCell key={p.id} isWinner={isWinner} isSelected={!locked && p.id === selectedId} dimmed={locked && !isWinner}>
                    {formatCurrency(p.freight_value)}
                  </DataCell>
                );
              })}
            </CompareRow>

            <CompareRow label="Transit time">
              {proposals.map((p) => {
                const isWinner = winnerId != null && p.id === winnerId;
                return (
                  <DataCell key={p.id} isWinner={isWinner} isSelected={!locked && p.id === selectedId} dimmed={locked && !isWinner}>
                    {p.transit_time}d
                  </DataCell>
                );
              })}
            </CompareRow>

            <CompareRow label="Chegada est.">
              {proposals.map((p) => {
                const isWinner = winnerId != null && p.id === winnerId;
                return (
                  <DataCell key={p.id} isWinner={isWinner} isSelected={!locked && p.id === selectedId} dimmed={locked && !isWinner}>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatEstimatedArrival(p.transit_time)}
                    </span>
                  </DataCell>
                );
              })}
            </CompareRow>

            <CompareRow label="Rota">
              {proposals.map((p) => {
                const isWinner = winnerId != null && p.id === winnerId;
                return (
                  <DataCell key={p.id} isWinner={isWinner} isSelected={!locked && p.id === selectedId} dimmed={locked && !isWinner}>
                    {p.route_type ? (
                      <span className="rounded border px-2 py-0.5 text-xs">
                        {PROPOSAL_ROUTE_TYPE_LABELS[p.route_type]}
                      </span>
                    ) : (
                      '—'
                    )}
                  </DataCell>
                );
              })}
            </CompareRow>

            <CompareRow label="Validade">
              {proposals.map((p) => {
                const isWinner = winnerId != null && p.id === winnerId;
                return (
                  <DataCell key={p.id} isWinner={isWinner} isSelected={!locked && p.id === selectedId} dimmed={locked && !isWinner}>
                    {formatDate(p.validity)}
                  </DataCell>
                );
              })}
            </CompareRow>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompareRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="sticky left-0 bg-muted/30 z-10 px-4 py-2.5 border-r text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
        {label}
      </td>
      {children}
    </tr>
  );
}

interface DataCellProps {
  children: ReactNode;
  isWinner: boolean;
  isSelected: boolean;
  dimmed: boolean;
}

function DataCell({ children, isWinner, isSelected, dimmed }: DataCellProps) {
  return (
    <td
      className={cn(
        'px-4 py-2.5 text-center',
        isWinner && 'bg-emerald-50/60 dark:bg-emerald-950/20',
        isSelected && 'bg-muted/30',
        dimmed && 'opacity-50',
      )}
    >
      {children}
    </td>
  );
}

function getHeaderHint(locked: boolean, winnerId: string | null): string {
  if (!locked) return 'Selecione uma proposta para ver detalhes.';
  return winnerId
    ? 'Cotação fechada. Proposta vencedora destacada abaixo.'
    : 'Cotação recusada.';
}
