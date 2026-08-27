'use client';

import { ShieldCheck } from 'lucide-react';

import type { PortalProposal } from '@/types/portal';

import { IntelBlock } from './intel-block';
import { seededInt } from '../lib/intel-helpers';

// Rótulo qualitativo do score (fabricado) de confiabilidade. O cliente nunca vê
// o número — decisão de produto — e desde 27/08/2026 também não vê a BARRA.
//
// A barra tinha o mesmo desenho do score da Recomendação logo acima: mesma
// altura, mesma pista cinza, mesmo preenchimento proporcional. Tirar a
// pontuação de lá e manter a régua aqui devolveria a sensação de placar que o
// feedback do Vinicius (27/08/2026) pediu para remover — e sem sequer ter um
// número para justificar a régua. Continua sendo `seededInt` que ordena os
// agentes; o que sai é o desenho, não o cálculo.
function reliabilityLabel(score: number): string {
  if (score >= 90) return 'muito alta';
  if (score >= 80) return 'alta';
  return 'média';
}

/**
 * MIXED, headline is MOCK. Scoped to a SINGLE quotation: it scores the agents
 * that actually sent a proposal for this quotation (real names), comparing them
 * against each other. The reliability scores themselves are fabricated — there
 * is no agent performance history apuration in this prototype yet. Neither the
 * number nor a bar is shown to the client: the score only orders the list and
 * picks the qualitative word.
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
      {agents.length === 0 || !top ? (
        <p className="portal-body text-portal-neutral">
          Nenhuma proposta com agente identificado nesta cotação.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="portal-body text-foreground">
            <span className="font-medium">{top.name}</span> tem histórico de
            confiabilidade {reliabilityLabel(top.score)}.
          </p>
          {single ? null : (
            <ul className="space-y-1">
              {agents.slice(1).map((a) => (
                <li key={a.name} className="portal-body text-portal-neutral">
                  {a.name} — confiabilidade {reliabilityLabel(a.score)}.
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </IntelBlock>
  );
}
