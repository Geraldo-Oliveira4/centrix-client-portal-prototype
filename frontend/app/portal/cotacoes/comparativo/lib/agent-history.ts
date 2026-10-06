// Histórico do agente no comparativo (06/10/2026): FATOS, sem nota.
//
// "Dado, não veredito." Esta aba mostra o que aconteceu nos embarques do
// cliente com o agente — quantos, no prazo por etapa, os últimos cinco e os
// compromissos com desvio — e nunca uma nota ou ranking do agente. A única nota
// do portal é a da Recomendação IA, e ela compara PROPOSTAS desta cotação.
//
// FONTE: a fixture da Inteligência (`public/prototypes/centrix-inteligencia/
// data.js`) e o `commitments` do motor dela, reaproveitados SÓ PARA LEITURA. Este
// módulo recebe os dois por parâmetro (é puro e roda sob `node --test`); quem os
// importa é a tela. As etapas são as MESMAS da Inteligência (`D.stages`), com a
// mesma regra de no prazo: dias realizados <= dias planejados da etapa.

/** O recorte de `data.js` que esta aba lê. */
export interface IntelOperation {
  id: string;
  agent: string;
  route: string;
  readyPlan: string;
  depart: string | null;
  arrive: string | null;
  final: string | null;
  finalPlan: string;
  [key: string]: unknown;
}

export interface IntelStage {
  id: string;
  label: string;
  from: string;
  to: string;
  plan: (o: IntelOperation) => number;
}

export interface IntelDataset {
  cutoff: string;
  agents: { id: string; name: string }[];
  routes: { id: string; from: string; to: string }[];
  locations: Record<string, { name: string }>;
  operations: IntelOperation[];
  stages: IntelStage[];
  days: (a: string | null, b: string | null) => number | null;
}

export interface IntelCommitment {
  o: IntelOperation;
  controls: {
    name: string;
    agreed: number;
    actual: number;
    unit: string;
  }[];
  deviations: { name: string; agreed: number; actual: number; unit: string }[];
  status: 'missing' | 'deviation' | 'clean';
}

export type CommitmentsFn = (
  D: IntelDataset,
  ops: IntelOperation[],
) => IntelCommitment[];

/** Mesmo limite da Inteligência (`MIN_SAMPLE`). */
export const MIN_SAMPLE = 3;

export interface StageOnTime {
  id: string;
  label: string;
  base: number;
  onTime: number;
  /** null sem base; o percentual não é mostrado como número de verdade abaixo de 3. */
  pct: number | null;
  smallSample: boolean;
}

export interface RecentShipment {
  reference: string;
  route: string;
  result: string;
}

export interface CommitmentDeviation {
  reference: string;
  control: string;
  agreed: string;
  actual: string;
}

export type AgentHistory =
  | { state: 'sem_historico' }
  | {
      state: 'com_historico';
      shipments: number;
      smallSample: boolean;
      stages: StageOnTime[];
      recent: RecentShipment[];
      deviations: CommitmentDeviation[];
    };

function routeName(D: IntelDataset, routeId: string): string {
  const r = D.routes.find((x) => x.id === routeId);
  if (!r) return routeId;
  return `${D.locations[r.from]?.name ?? r.from} → ${D.locations[r.to]?.name ?? r.to}`;
}

function result(D: IntelDataset, o: IntelOperation): string {
  if (o.final) {
    const late = D.days(o.finalPlan, o.final) ?? 0;
    return late <= 0
      ? 'Entregue no prazo'
      : `Entregue com ${late} ${late === 1 ? 'dia' : 'dias'} de atraso`;
  }
  if (o.arrive) return 'Chegou ao porto · entrega pendente';
  if (o.depart) return 'Em trânsito';
  return 'Ainda não embarcou';
}

/**
 * O histórico de um agente. `agentId` é o id da fixture da Inteligência; agente
 * que não está lá (ou que não tem embarque) devolve `sem_historico` — ausência
 * é dado, não zero.
 */
export function agentHistory(
  D: IntelDataset,
  commitments: CommitmentsFn,
  agentId: string,
): AgentHistory {
  const ops = D.operations.filter((o) => o.agent === agentId);
  if (!ops.length) return { state: 'sem_historico' };

  const stages: StageOnTime[] = D.stages.map((s) => {
    const done = ops.filter((o) => o[s.from] && o[s.to]);
    const onTime = done.filter(
      (o) => (D.days(o[s.from] as string, o[s.to] as string) ?? 0) <= s.plan(o),
    ).length;
    return {
      id: s.id,
      label: s.label,
      base: done.length,
      onTime,
      pct: done.length ? Math.round((onTime / done.length) * 100) : null,
      smallSample: done.length < MIN_SAMPLE,
    };
  });

  // Mais recentes primeiro, pela data de prontidão planejada (a coorte que a
  // Inteligência usa); empate pela referência.
  const recent = [...ops]
    .sort(
      (a, b) =>
        b.readyPlan.localeCompare(a.readyPlan) || b.id.localeCompare(a.id),
    )
    .slice(0, 5)
    .map((o) => ({
      reference: o.id,
      route: routeName(D, o.route),
      result: result(D, o),
    }));

  const deviations = commitments(D, ops)
    .filter((c) => c.status === 'deviation')
    .flatMap((c) =>
      c.deviations.map((d) => ({
        reference: c.o.id,
        control: d.name,
        agreed: `${d.agreed} ${d.unit}`,
        actual: `${d.actual} ${d.unit}`,
      })),
    );

  return {
    state: 'com_historico',
    shipments: ops.length,
    smallSample: ops.length < MIN_SAMPLE,
    stages,
    recent,
    deviations,
  };
}
