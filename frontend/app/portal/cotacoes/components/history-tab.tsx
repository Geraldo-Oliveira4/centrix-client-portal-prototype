'use client';

import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from '@/components/ui';
import { useAuditPreviews } from '@/hooks/use-portal-audit-preview';
import { isApproved, resolveClosedAt } from '@/lib/portal-state';
import type { PortalQuotation } from '@/types/portal';

import { AuditDocumentModal } from './audit-document-modal';
import { HistoryItem } from './history-item';
import { PortalSearchInput, applyPortalFilters, EMPTY_PORTAL_FILTERS } from './portal-filters';

// Same key the standalone Auditoria panel used, so a demo that already sent
// documents keeps its "em conferência" rows after the move.
const SUBMITTED_KEY = 'portal:audit:submitted';

type StatusFilter = 'all' | 'FECHADA' | 'DECLINADA' | 'CANCELADO';
type PeriodFilter = 'all' | '30' | '90' | '365';

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'Todas',
  FECHADA: 'Aprovadas',
  DECLINADA: 'Recusadas',
  CANCELADO: 'Canceladas',
};

const PERIOD_LABEL: Record<PeriodFilter, string> = {
  all: 'Qualquer data',
  '30': 'Últimos 30 dias',
  '90': 'Últimos 90 dias',
  '365': 'Últimos 12 meses',
};

interface SelectedForUpload {
  id: string;
  reference: string;
}

/**
 * Histórico — closed quotations as a list, never a kanban: nothing here moves
 * between columns and nothing can be approved or declined, so the screen is
 * read-only. Filtering is by outcome and by closing period.
 */
export function HistoryTab({ quotations }: { quotations: PortalQuotation[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');

  // The conference only exists for approved quotations, and the SWR key is the
  // full set of approved ids (not the filtered ones) so filtering never
  // re-fetches.
  const approvedIds = useMemo(
    () => quotations.filter((q) => isApproved(q.state)).map((q) => q.id),
    [quotations],
  );
  const { previews, isLoading: loadingPreviews } = useAuditPreviews(approvedIds);

  // Which quotations the client sent documents for. Client-side only (there is
  // no audit engine); seeded from localStorage after mount to avoid a hydration
  // mismatch.
  const [submittedList, setSubmittedList] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SUBMITTED_KEY);
      if (raw) setSubmittedList(JSON.parse(raw));
    } catch {
      // ignore corrupt/unavailable storage — nothing is marked as submitted
    }
  }, []);
  const submittedIds = useMemo(() => new Set(submittedList), [submittedList]);

  const [selected, setSelected] = useState<SelectedForUpload | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSubmitted = (quotationId: string) => {
    if (submittedIds.has(quotationId)) return;
    const next = [...submittedList, quotationId];
    setSubmittedList(next);
    try {
      localStorage.setItem(SUBMITTED_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const filtered = useMemo(() => {
    const cutoff =
      period === 'all' ? null : Date.now() - Number(period) * 24 * 60 * 60 * 1000;
    const searched = applyPortalFilters(quotations, {
      ...EMPTY_PORTAL_FILTERS,
      query,
    });
    return searched
      .filter((q) => {
        if (status !== 'all' && q.state !== status) return false;
        if (cutoff != null && new Date(resolveClosedAt(q)).getTime() < cutoff) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(resolveClosedAt(b)).getTime() -
          new Date(resolveClosedAt(a)).getTime(),
      );
  }, [quotations, query, status, period]);

  const activeFilters = (status !== 'all' ? 1 : 0) + (period !== 'all' ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="portal-small text-portal-neutral">
          {filtered.length}{' '}
          {filtered.length === 1 ? 'cotação fechada' : 'cotações fechadas'}
          {filtered.length !== quotations.length ? ` de ${quotations.length}` : ''}
        </p>

        <div className="flex items-center gap-2">
          <PortalSearchInput value={query} onChange={setQuery} />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFilters > 0 && (
                  <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                    {activeFilters}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-4">
              <div className="space-y-2">
                <Label className="portal-small text-portal-neutral">Situação</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as StatusFilter)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {STATUS_LABEL[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="portal-small text-portal-neutral">
                  Período (fechamento)
                </Label>
                <Select
                  value={period}
                  onValueChange={(v) => setPeriod(v as PeriodFilter)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PERIOD_LABEL) as PeriodFilter[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {PERIOD_LABEL[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
          <p className="portal-body font-medium text-foreground">
            Nenhuma cotação fechada encontrada
          </p>
          <p className="portal-small text-portal-neutral">
            {quotations.length === 0
              ? 'Cotações aprovadas, recusadas e canceladas aparecem aqui.'
              : 'Ajuste a busca ou os filtros.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <HistoryItem
              key={q.id}
              quotation={q}
              preview={
                isApproved(q.state)
                  ? loadingPreviews
                    ? undefined
                    : (previews[q.id] ?? null)
                  : null
              }
              submitted={submittedIds.has(q.id)}
              onSendDocuments={() => {
                setSelected({ id: q.id, reference: q.reference });
                setModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <AuditDocumentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        quotationId={selected?.id ?? null}
        reference={selected?.reference ?? ''}
        preview={selected ? (previews[selected.id] ?? null) : null}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}
