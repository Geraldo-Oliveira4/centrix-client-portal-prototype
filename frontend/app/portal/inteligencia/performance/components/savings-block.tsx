'use client';

import { TrendingDown } from 'lucide-react';

import { formatBRL } from '@/lib/portal-formatters';

import { SectionHeading } from '../../../_shared/page-header';
import { ProvenanceBadge } from '../../../_shared/provenance-badge';

/**
 * ILLUSTRATIVE — there is no market price baseline in this prototype, so the
 * whole block stays inside the dashed preview frame with the `preview` badge and
 * spells out how the number was made up. Migrated intact from the old "Visão
 * geral" tab when it merged into Performance.
 */
export function SavingsBlock({ estimatedSavingsBRL }: { estimatedSavingsBRL: number | null }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-6">
      <SectionHeading
        title="Economia estimada"
        icon={<TrendingDown className="h-5 w-5" />}
        action={<ProvenanceBadge provenance="preview" />}
      />
      <div className="space-y-1">
        <p className="text-3xl font-semibold leading-none text-foreground">
          {estimatedSavingsBRL != null ? formatBRL(estimatedSavingsBRL) : '—'}
        </p>
        <p className="portal-small text-portal-neutral">
          Estimativa ilustrativa sobre suas cotações fechadas
        </p>
      </div>
      <p className="portal-small border-t border-dashed pt-3 text-portal-neutral">
        Ilustrativo. Compara o que você pagou contra um benchmark de setor
        fabricado (8% acima) — não há base de preços de mercado neste protótipo,
        então este número não representa uma economia apurada.
      </p>
    </section>
  );
}
