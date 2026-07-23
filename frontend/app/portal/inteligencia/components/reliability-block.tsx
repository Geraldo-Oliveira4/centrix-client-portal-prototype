'use client';

import { ShieldCheck } from 'lucide-react';
import { LoadingState } from '@arboria-tech/arboria-ui';

import { useMyQuotations } from '@/hooks/use-portal-quotations';

import { IntelBlock } from './intel-block';
import { flattenQuotations, seededInt } from '../lib/intel-helpers';

/**
 * MIXED, headline is MOCK. The agent names are real (drawn from the proposals
 * the client received), but the reliability scores are fabricated: there is no
 * agent performance history apuration in this prototype yet.
 */
export function ReliabilityBlock() {
  const { data, isLoading } = useMyQuotations();

  const names = Array.from(
    new Set(
      flattenQuotations(data)
        .map((q) => q.best_proposal?.agent?.name)
        .filter((n): n is string => Boolean(n)),
    ),
  );
  const agents = names.map((name) => ({ name, score: seededInt(name, 82, 97) }));
  const avg = agents.length
    ? Math.round(agents.reduce((sum, a) => sum + a.score, 0) / agents.length)
    : null;

  return (
    <IntelBlock
      icon={<ShieldCheck className="h-5 w-5" />}
      title="Confiabilidade"
      question="Esse agente é confiável e previsível?"
      provenance="preview"
      footnote="Os nomes dos agentes são reais (propostas recebidas). Os scores de confiabilidade são ilustrativos — ainda não há histórico de desempenho apurado neste protótipo."
    >
      {isLoading ? (
        <LoadingState />
      ) : agents.length === 0 ? (
        <p className="portal-body text-portal-neutral">
          Nenhum agente com proposta registrada ainda.
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-3xl font-semibold leading-none text-foreground">
              {avg}
              <span className="portal-body ml-1 font-normal text-portal-neutral">
                /100
              </span>
            </p>
            <p className="portal-small mt-1 text-portal-neutral">
              Score médio dos seus agentes (ilustrativo)
            </p>
          </div>
          <ul className="space-y-2">
            {agents.slice(0, 4).map((a) => (
              <li key={a.name} className="flex items-center gap-3">
                <span className="portal-body min-w-0 flex-1 truncate text-foreground">
                  {a.name}
                </span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-portal-info"
                    style={{ width: `${a.score}%` }}
                  />
                </div>
                <span className="portal-small w-7 text-right font-medium text-portal-neutral">
                  {a.score}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </IntelBlock>
  );
}
