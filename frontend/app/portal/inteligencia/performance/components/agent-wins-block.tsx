'use client';

import { Award, Trophy } from 'lucide-react';

import { SectionHeading } from '../../../_shared/page-header';
import { ProvenanceBadge } from '../../../_shared/provenance-badge';
import type { AgentWins } from '../../lib/performance-helpers';

/**
 * REAL — the winning agent of each closed quotation, as a proportional bar.
 * Migrated intact from the old "Visão geral" tab when it merged into
 * Performance. No score and no ranking of reliability: only how many quotations
 * each agent actually won (see the Fornecedores placeholder for why a score is
 * deliberately absent).
 */
export function AgentWinsBlock({ agentWins }: { agentWins: AgentWins[] }) {
  const totalWins = agentWins.reduce((sum, a) => sum + a.wins, 0);
  // A "parceiro mais frequente" only when someone is strictly ahead (or is the
  // sole agent with wins). No badge on a tie — that would overclaim.
  const leader =
    agentWins.length > 0 &&
    (agentWins.length === 1 || agentWins[0].wins > agentWins[1].wins)
      ? agentWins[0]
      : null;

  return (
    <section className="portal-card space-y-4 p-6">
      <SectionHeading
        title="Cotações vencidas por agente"
        icon={<Trophy className="h-5 w-5" />}
        action={<ProvenanceBadge provenance="real" />}
      />
      {agentWins.length === 0 ? (
        <p className="portal-body text-portal-neutral">
          Nenhuma cotação fechada ainda. A distribuição por agente aparece assim
          que a primeira cotação é fechada.
        </p>
      ) : (
        <div className="space-y-4">
          {leader ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-portal-success/25 bg-portal-success/10 px-3 py-2">
              <Award className="h-5 w-5 shrink-0 text-portal-success" />
              <p className="portal-body text-foreground">
                <span className="font-semibold">{leader.name}</span> é seu parceiro
                mais frequente
              </p>
            </div>
          ) : null}
          <ul className="space-y-3">
            {agentWins.map((a) => {
              const share = totalWins ? a.wins / totalWins : 0;
              return (
                <li key={a.name} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="portal-body min-w-0 truncate font-medium text-foreground">
                      {a.name}
                    </span>
                    <span className="portal-small shrink-0 text-portal-neutral">
                      {a.wins} {a.wins === 1 ? 'cotação' : 'cotações'} ·{' '}
                      {Math.round(share * 100)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-portal-success"
                      style={{ width: `${Math.max(share * 100, 3)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
