'use client';

// Aba "Histórico do agente": FATOS dos embarques com o agente, sem nota.
// "Dado, não veredito." A base é a mesma da Inteligência, lida só para leitura.

import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

// Reaproveitamento SÓ PARA LEITURA da fixture e do motor da Inteligência — os
// mesmos arquivos que o iframe dela carrega. Nada aqui os altera.
import intelData from '../../../../../public/prototypes/centrix-inteligencia/data.js';
import intelEngine from '../../../../../public/prototypes/centrix-inteligencia/intel-engine.js';

import {
  agentHistory,
  type CommitmentsFn,
  type IntelDataset,
} from '../lib/agent-history';
import type { ComparisonProposal } from '../lib/comparison-model';

const D = intelData as unknown as IntelDataset;
const commitments = (intelEngine as unknown as { commitments: CommitmentsFn }).commitments;

/** Corte declarado da tabela de desvios (os mais recentes primeiro). */
const DEVIATION_LIMIT = 6;

function SmallSample({ n }: { n: number }) {
  return (
    <span className="portal-small rounded-full border border-dashed border-border px-2 py-0.5 text-portal-neutral">
      Amostra pequena (n={n})
    </span>
  );
}

export function AgentHistoryTab({ proposals }: { proposals: ComparisonProposal[] }) {
  const agents = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of proposals) if (!seen.has(p.agentId)) seen.set(p.agentId, p.agentName);
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [proposals]);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '');
  const agent = agents.find((a) => a.id === agentId) ?? agents[0];
  const history = useMemo(() => agentHistory(D, commitments, agent.id), [agent.id]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Agente">
        <span className="portal-small text-portal-neutral">Agente</span>
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={a.id === agent.id}
            onClick={() => setAgentId(a.id)}
            className={cn(
              'portal-body rounded-full border px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              a.id === agent.id
                ? 'border-brand-indigo-800/40 bg-brand-indigo-100 font-medium text-brand-indigo'
                : 'border-border hover:bg-accent',
            )}
          >
            {a.name}
          </button>
        ))}
      </div>
      <p className="portal-small text-portal-neutral">
        Dado, não veredito: o que aconteceu nos seus embarques com este agente, na mesma base da Inteligência. Sem
        nota de agente.
      </p>

      {history.state === 'sem_historico' ? (
        <div className="portal-card p-6" role="status">
          <p className="portal-h3">Sem histórico com este agente</p>
          <p className="portal-body text-portal-neutral">
            Você ainda não embarcou com {agent.name}. Isso não é bom nem ruim: só não há dado para mostrar.
          </p>
        </div>
      ) : (
        <>
          <section className="portal-card space-y-1 p-6" aria-labelledby="hist-total">
            <h3 id="hist-total" className="portal-small text-portal-neutral">Embarques com {agent.name}</h3>
            <p className="flex flex-wrap items-center gap-2">
              <span className="portal-h1 tabular-nums text-brand-indigo">{history.shipments}</span>
              {history.smallSample ? <SmallSample n={history.shipments} /> : null}
            </p>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="portal-card space-y-2 p-6" aria-labelledby="hist-etapas">
              <h3 id="hist-etapas" className="portal-h3">No prazo por etapa</h3>
              <table className="portal-body w-full text-left">
                <caption className="sr-only">Percentual no prazo por etapa da cadeia</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 pr-4 font-medium">Etapa</th>
                    <th scope="col" className="py-2 pr-4 font-medium">No prazo</th>
                    <th scope="col" className="py-2 font-medium">Base</th>
                  </tr>
                </thead>
                <tbody>
                  {history.stages.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2 pr-4 font-normal">{s.label}</th>
                      <td className="py-2 pr-4">
                        {s.base === 0 ? (
                          '—'
                        ) : s.smallSample ? (
                          <SmallSample n={s.base} />
                        ) : (
                          <span className="tabular-nums">
                            {s.pct}% <span className="text-portal-neutral">({s.onTime} de {s.base})</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 tabular-nums text-portal-neutral">{s.base}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="portal-card space-y-2 p-6" aria-labelledby="hist-ultimos">
              <h3 id="hist-ultimos" className="portal-h3">Últimos 5 embarques</h3>
              <table className="portal-body w-full text-left">
                <caption className="sr-only">Os cinco embarques mais recentes com o agente</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 pr-4 font-medium">Referência</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Rota</th>
                    <th scope="col" className="py-2 font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {history.recent.map((r) => (
                    <tr key={r.reference} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2 pr-4 font-normal tabular-nums">{r.reference}</th>
                      <td className="py-2 pr-4">{r.route}</td>
                      <td className="py-2">{r.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <section className="portal-card-muted space-y-2 p-6" aria-labelledby="hist-compromissos">
            <h3 id="hist-compromissos" className="portal-h3">Compromissos com desvio</h3>
            {history.deviations.length ? (
              <div className="overflow-x-auto">
                <table className="portal-body w-full text-left">
                  <caption className="sr-only">Compromissos combinados com o agente que tiveram desvio</caption>
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className="py-2 pr-4 font-medium">Embarque</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Compromisso</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Combinado</th>
                      <th scope="col" className="py-2 font-medium">Realizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history.deviations].reverse().slice(0, DEVIATION_LIMIT).map((d) => (
                      <tr key={d.reference + d.control} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 pr-4 font-normal tabular-nums">{d.reference}</th>
                        <td className="py-2 pr-4">{d.control}</td>
                        <td className="py-2 pr-4 tabular-nums">{d.agreed}</td>
                        <td className="py-2 tabular-nums">{d.actual}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="portal-body text-portal-neutral">Nenhum desvio registrado nos compromissos combinados.</p>
            )}
            <p className="portal-small text-portal-neutral">
              {history.deviations.length > DEVIATION_LIMIT
                ? `Mostrando os ${DEVIATION_LIMIT} mais recentes de ${history.deviations.length} desvios. `
                : ''}
              Somente leitura. Os mesmos registros de “Compromissos do serviço” da Inteligência.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
