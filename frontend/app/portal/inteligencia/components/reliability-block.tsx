'use client';

import { ShieldCheck } from 'lucide-react';

import type { PortalProposal } from '@/types/portal';

import { IntelBlock } from './intel-block';
import { seededInt } from '../lib/intel-helpers';

// Maps the (fabricated) 0-100 reliability score to a qualitative tier. The
// client never sees the numeric AI score (product decision) — only this label
// and the comparative bars.
function reliabilityLabel(score: number): string {
  if (score >= 90) return 'Muito alta';
  if (score >= 80) return 'Alta';
  return 'Média';
}

/**
 * MIXED, headline is MOCK. Scoped to a SINGLE quotation: it scores the agents
 * that actually sent a proposal for this quotation (real names), comparing them
 * against each other. The reliability scores themselves are fabricated — there
 * is no agent performance history apuration in this prototype yet. The numeric
 * score is not shown to the client; it drives the qualitative label and the bars.
 */
export function ReliabilityBlock({ proposals }: { proposals: PortalProposal[] }) {
  const names = Array.from(
    new Set(
      proposals
        .map((p) => p.agent?.name)
        .filter((n): n is string => Boolean(n)),
    ),
  );
  const agents = names
    .map((name) => ({ name, score: seededInt(name, 82, 97) }))
    .sort((a, b) => b.score - a.score);
  const single = agents.length === 1;
  const top = agents[0] ?? null;

  return (
    <IntelBlock
      icon={<ShieldCheck className="h-5 w-5" />}
      title="Confiabilidade"
      question="Esse agente é confiável e previsível?"
      provenance="preview"
      footnote={
        single
          ? 'O nome do agente é real (proposta desta cotação). A confiabilidade exibida é ilustrativa — ainda não há histórico de desempenho apurado neste protótipo.'
          : 'Os nomes dos agentes são reais (propostas desta cotação). A confiabilidade exibida é ilustrativa — ainda não há histórico de desempenho apurado neste protótipo.'
      }
    >
      {agents.length === 0 ? (
        <p className="portal-body text-portal-neutral">
          Nenhuma proposta com agente identificado nesta cotação.
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-2xl font-semibold leading-none text-foreground">
              {top ? reliabilityLabel(top.score) : ''}
            </p>
            <p className="portal-small mt-1 text-portal-neutral">
              {single
                ? `Confiabilidade de ${top?.name} (ilustrativo)`
                : 'Melhor confiabilidade entre os agentes desta cotação (ilustrativo)'}
            </p>
          </div>
          {single ? null : (
            <ul className="space-y-2">
              {agents.map((a) => (
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
                  <span className="portal-small w-20 text-right font-medium text-portal-neutral">
                    {reliabilityLabel(a.score)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </IntelBlock>
  );
}
