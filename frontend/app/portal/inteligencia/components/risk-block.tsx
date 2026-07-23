'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { LoadingState } from '@arboria-tech/arboria-ui';

import { useMyQuotations } from '@/hooks/use-portal-quotations';

import { IntelBlock } from './intel-block';
import { daysUntilDate, flattenQuotations, sortByNewest } from '../lib/intel-helpers';

interface RiskItem {
  id: string;
  reference: string;
  label: string;
}

/**
 * PREVIEW. The individual signals are derived from real fields on the client's
 * recent quotations (foreign currency, near-expiry proposal validity, flagged
 * urgency), but the consolidated "risk analysis" is illustrative — the product
 * does not yet run a real risk model.
 */
export function RiskBlock() {
  const { data, isLoading } = useMyQuotations();
  const recent = sortByNewest(flattenQuotations(data)).slice(0, 8);

  const risks: RiskItem[] = [];
  for (const q of recent) {
    if (risks.length >= 4) break;
    if (q.declared_value_currency && q.declared_value_currency !== 'BRL') {
      risks.push({
        id: q.id,
        reference: q.reference,
        label: `Exposição cambial (${q.declared_value_currency})`,
      });
      continue;
    }
    const validityDays = daysUntilDate(q.best_proposal?.validity);
    if (validityDays != null && validityDays >= 0 && validityDays <= 10) {
      risks.push({
        id: q.id,
        reference: q.reference,
        label: `Validade da proposta expira em ${validityDays} dia(s)`,
      });
      continue;
    }
    if (q.urgency === 'URGENTE' || q.urgency === 'ALTA') {
      risks.push({
        id: q.id,
        reference: q.reference,
        label: 'Prazo apertado — risco de atraso na cadeia',
      });
    }
  }
  // Fallback so the block still illustrates its purpose on a quiet account.
  if (risks.length === 0 && recent[0]) {
    risks.push({
      id: recent[0].id,
      reference: recent[0].reference,
      label: 'Exemplo: risco cambial em compra denominada em moeda estrangeira',
    });
  }

  return (
    <IntelBlock
      icon={<ShieldAlert className="h-5 w-5" />}
      title="Risco"
      question="Quais riscos podem aparecer depois?"
      provenance="preview"
      footnote="Os sinais vêm de campos reais das suas cotações; a análise de risco consolidada é ilustrativa — ainda não há um modelo de risco neste protótipo."
    >
      {isLoading ? (
        <LoadingState />
      ) : recent.length === 0 ? (
        <p className="portal-body text-portal-neutral">
          Nenhuma cotação recente para analisar.
        </p>
      ) : (
        <ul className="space-y-2">
          {risks.map((risk, i) => (
            <li key={`${risk.id}-${i}`} className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-portal-warning" />
              <p className="portal-body text-foreground">
                <Link
                  href={`/portal/cotacao/${risk.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {risk.reference}
                </Link>
                <span className="text-portal-neutral"> · {risk.label}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </IntelBlock>
  );
}
