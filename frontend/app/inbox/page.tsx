'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { PageTitle } from '@arboria-tech/arboria-ui';
import { LoaderComponent } from '@arboria-tech/arboria-ui';
import { ErrorComponent } from '@arboria-tech/arboria-ui';
import { useAuth } from '@arboria-tech/arboria-ui';
import { useQuotations } from '@/hooks/use-quotations';
import { InboxFilters } from './components/inbox-filters';
import { InboxTable } from './components/inbox-table';
import type { AnalystFilter, UrgencyFilter } from './components/inbox-filters';
import type { Quotation, QuotationFilters } from '@/types/quotation';

// Closed states should not appear in inbox
const CLOSED_STATES = new Set(['FECHADA', 'DECLINADA', 'CANCELADO']);

// Extract the Cognito sub from the JWT access token
function extractSubFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);
    const payload = JSON.parse(atob(base64));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function filterByUrgency(quotations: Quotation[], urgency: UrgencyFilter): Quotation[] {
  if (urgency === 'ALL') return quotations;
  if (urgency === 'URGENTE') return quotations.filter((q) => (q.priority_score ?? 0) >= 80);
  if (urgency === 'ALTA') {
    return quotations.filter((q) => {
      const s = q.priority_score ?? 0;
      return s >= 60 && s < 80;
    });
  }
  return quotations.filter((q) => (q.priority_score ?? 0) < 60);
}

function filterByOrigin(quotations: Quotation[], origin: string): Quotation[] {
  if (!origin.trim()) return quotations;
  const term = origin.toLowerCase();
  return quotations.filter(
    (q) =>
      q.origin?.toLowerCase().includes(term) ||
      q.porto_destino?.some((p) => p.toLowerCase().includes(term)) ||
      q.aeroporto_destino?.some((p) => p.toLowerCase().includes(term)),
  );
}

export default function InboxPage() {
  const { session } = useAuth();
  const [search, setSearch] = useState('');
  const [urgency, setUrgency] = useState<UrgencyFilter>('ALL');
  const [analyst, setAnalyst] = useState<AnalystFilter>('ALL');
  const [originFilter, setOriginFilter] = useState('');

  const currentUserSub = useMemo(() => {
    if (!session?.accessToken) return null;
    return extractSubFromToken(session.accessToken);
  }, [session?.accessToken]);

  // Build server-side filters
  const apiFilters: QuotationFilters = useMemo(() => {
    const filters: QuotationFilters = {};
    if (search.trim()) filters.search = search.trim();
    if (analyst === 'MINE' && currentUserSub) filters.analyst_id = currentUserSub;
    return filters;
  }, [search, analyst, currentUserSub]);

  const { quotations, isLoading, isError, mutate } = useQuotations(apiFilters);

  // Client-side filtering: exclude closed, apply urgency and origin
  const filteredQuotations = useMemo(() => {
    if (!quotations) return [];
    let result = quotations.filter((q) => !CLOSED_STATES.has(q.state));
    result = filterByUrgency(result, urgency);
    result = filterByOrigin(result, originFilter);
    return result;
  }, [quotations, urgency, originFilter]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
        <PageTitle title="Inbox" />
        <Link href="/cotacao/nova-cotacao">
          <Button className="whitespace-nowrap">
            <Plus className="w-4 h-4 mr-2" />
            Nova Cotacao
          </Button>
        </Link>
      </div>

      <InboxFilters
        search={search}
        onSearchChange={setSearch}
        urgency={urgency}
        onUrgencyChange={setUrgency}
        analyst={analyst}
        onAnalystChange={setAnalyst}
        origin={originFilter}
        onOriginChange={setOriginFilter}
      />

      {isLoading && <LoaderComponent />}
      {isError && <ErrorComponent />}

      {!isLoading && !isError && quotations && (
        <>
          {filteredQuotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma cotacao encontrada com os filtros selecionados.
              </p>
            </div>
          ) : (
            <InboxTable quotations={filteredQuotations} onRefresh={mutate} />
          )}
        </>
      )}
    </div>
  );
}
