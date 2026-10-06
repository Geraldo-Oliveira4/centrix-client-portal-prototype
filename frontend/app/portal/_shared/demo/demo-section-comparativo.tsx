'use client';

// Seção INTERNA do painel: o analista que aprova a Recomendação IA do
// comparativo de propostas. Só existe em build com NEXT_PUBLIC_PROTO_INTERNAL=1
// (import dinâmico com condição inline em `demo-sections.tsx`).

import Link from 'next/link';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import {
  DEMO_REFERENCE_A,
  DEMO_REFERENCE_B,
} from '../../cotacoes/comparativo/lib/fixtures';
import {
  setAnalystApproval,
  useAnalystApproval,
} from '../../cotacoes/comparativo/lib/use-analyst-approval';

export function ComparativoSection() {
  const approved = useAnalystApproval();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Label
            htmlFor="demo-comparativo-analyst"
            className="portal-body font-medium text-foreground"
          >
            Analista aprovou a recomendação
          </Label>
          <p className="portal-small text-portal-neutral">
            Desligado, o cliente vê “Recomendação em revisão”, sem nota. Ligado,
            vê a recomendada com nota e justificativa.
          </p>
        </div>
        <Switch
          id="demo-comparativo-analyst"
          checked={approved}
          onCheckedChange={setAnalystApproval}
          aria-label="Analista aprovou a recomendação"
        />
      </div>
      <p className="portal-small text-portal-neutral">
        Abrir:{' '}
        <Link
          className="text-brand-indigo underline underline-offset-2"
          href={`/portal/cotacoes/comparativo?cotacao=${DEMO_REFERENCE_A}`}
        >
          {DEMO_REFERENCE_A}
        </Link>{' '}
        ·{' '}
        <Link
          className="text-brand-indigo underline underline-offset-2"
          href={`/portal/cotacoes/comparativo?cotacao=${DEMO_REFERENCE_B}`}
        >
          {DEMO_REFERENCE_B}
        </Link>
      </p>
    </div>
  );
}
