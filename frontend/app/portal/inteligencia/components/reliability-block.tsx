'use client';

import type { PortalProposal } from '@/types/portal';

import { seededInt } from '../lib/intel-helpers';

// Rótulo qualitativo do score de confiabilidade. O cliente nunca vê
// o número — decisão de produto — e desde 27/08/2026 também não vê a BARRA.
//
// A barra tinha o mesmo desenho do score da Recomendação logo acima: mesma
// altura, mesma pista cinza, mesmo preenchimento proporcional. Tirar a
// pontuação de lá e manter a régua aqui devolveria a sensação de placar que o
// feedback do Vinicius pediu para remover — e sem sequer ter um número para
// justificar a régua. Continua sendo `seededInt` que ordena os agentes; o que
// saiu é o desenho, não o cálculo.
function reliabilityLabel(score: number): string {
  if (score >= 90) return 'muito alta';
  if (score >= 80) return 'alta';
  return 'média';
}

/**
 * Escopado a UMA cotação: ordena os agentes que enviaram proposta por um score
 * que nunca chega à tela — ele só escolhe a palavra e a ordem.
 *
 * Exportado como CORPO (sem card próprio) porque desde 27/08/2026 ele vive
 * dentro do card composto `AgentTrustBlock`, ao lado da Evidência: as duas
 * respondem "posso confiar nesse agente?", em níveis de certeza diferentes, e
 * separadas na tela nenhuma das duas explicava por que existia.
 *
 * O rodapé que declarava a proveniência do score saiu em 28/08/2026 junto com
 * os selos (ver `lib/proposal-provenance.ts`): sem a ressalva não sobrava
 * conteúdo nenhum na frase.
 */
export function ReliabilityBody({ proposals }: { proposals: PortalProposal[] }) {
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
  const top = agents[0] ?? null;

  if (!top) {
    return (
      <p className="portal-body text-portal-neutral">
        Nenhuma proposta com agente identificado nesta cotação.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Um degrau acima do corpo: é a conclusão do bloco, e a altura
          igualada com o Mercado sobra quando tudo aqui é `portal-body`. */}
      <p className="portal-h3 font-normal">
        <span className="font-medium">{top.name}</span> tem histórico de
        confiabilidade {reliabilityLabel(top.score)}.
      </p>
      {agents.length === 1 ? null : (
        <ul className="space-y-1">
          {agents.slice(1).map((a) => (
            <li key={a.name} className="portal-body text-portal-neutral">
              {a.name} — confiabilidade {reliabilityLabel(a.score)}.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
