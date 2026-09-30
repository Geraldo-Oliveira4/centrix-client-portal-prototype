// A escala de urgência do portal — UMA regra para Home, Central de trabalho,
// Minhas Cotações e Meus Embarques (30/09/2026, feedback de marketing: "sem
// hierarquia visual de urgência").
//
// PURE, sem o alias `@/`: roda sob `npm run test:unit`.
//
// A PERGUNTA É "PRECISO AGIR, E ATÉ QUANDO?", nunca "em que etapa isto está".
// Etapa é informação; urgência é o que sobe na tela. Quatro níveis, e só DOIS
// têm cor — é o teto de ênfase de uma tela:
//
//   crítico  prazo do cliente VENCIDO, ou custo correndo (demurrage)   danger
//   atenção  vence hoje ou em até 3 dias, ou trava a próxima etapa     warning
//   normal   em andamento com a Freitas/agente, ou pendência do
//            cliente SEM prazo ("Pendente com você")                   neutro
//   ok       concluído                                                 selo pequeno
//
// "Vence hoje" é ATENÇÃO, não crítico: com crítico em 24h a Central pintaria de
// vermelho tudo o que vence hoje junto do que já venceu, e o vermelho deixaria
// de separar "perdi o prazo" de "ainda dá". Crítico é só o que JÁ custa.
//
// Documento pendente sem prazo fica NORMAL de propósito. Sem data, ele é
// trabalho, não emergência; quando a Aprovação Documental trouxer prazo, ele
// entra na escala pelo prazo. Contá-lo como atenção deixava 7 de 8 embarques em
// âmbar — e quando quase tudo é urgente, nada é.

export type UrgencyLevel = 'critico' | 'atencao' | 'normal' | 'ok';

/** Dias de antecedência a partir dos quais um prazo vira atenção. */
export const URGENCY_ATTENTION_DAYS = 3;

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  critico: 'Crítico',
  atencao: 'Atenção',
  normal: 'Em andamento',
  ok: 'Concluído',
};

/** Menor = mais acima. */
export const URGENCY_RANK: Record<UrgencyLevel, number> = {
  critico: 0,
  atencao: 1,
  normal: 2,
  ok: 3,
};

export interface UrgencySignal {
  /** A próxima jogada é do CLIENTE. Sem isso, nada passa de normal. */
  clientAction: boolean;
  /** ISO. Data pura ("2026-10-02") vale até o fim daquele dia. */
  deadline?: string | null;
  /** Parado, isto segura a etapa seguinte (booking, dados da cotação). */
  blocksNextStep?: boolean;
  /** Custo correndo agora, com ou sem ação (demurrage). */
  costRunning?: boolean;
  done?: boolean;
}

export interface Urgency {
  level: UrgencyLevel;
  /** O porquê em poucas palavras. Cor nunca aparece sem ele. */
  reason: string;
}

function limitOf(deadline: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    const [y, m, d] = deadline.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  }
  return Date.parse(deadline);
}

/** Dias de calendário entre hoje e o dia do prazo (0 = hoje). */
function calendarDays(now: Date, limit: number): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = new Date(limit);
  day.setHours(0, 0, 0, 0);
  return Math.round((day.getTime() - today.getTime()) / 86_400_000);
}

export function urgencyOf(signal: UrgencySignal, now: Date): Urgency {
  if (signal.done) return { level: 'ok', reason: 'Concluído' };
  if (signal.costRunning) return { level: 'critico', reason: 'Custo correndo' };
  if (!signal.clientAction) return { level: 'normal', reason: 'Em andamento' };

  const limit = signal.deadline ? limitOf(signal.deadline) : Number.NaN;
  if (Number.isFinite(limit)) {
    if (limit < now.getTime())
      return { level: 'critico', reason: 'Prazo vencido' };
    const days = calendarDays(now, limit);
    if (days <= 0) return { level: 'atencao', reason: 'Vence hoje' };
    if (days === 1) return { level: 'atencao', reason: 'Vence amanhã' };
    if (days <= URGENCY_ATTENTION_DAYS) {
      return { level: 'atencao', reason: `Vence em ${days} dias` };
    }
  }
  if (signal.blocksNextStep) {
    return { level: 'atencao', reason: 'Trava a próxima etapa' };
  }
  return { level: 'normal', reason: 'Pendente com você' };
}

/** A ação da fila do cliente (`home/lib/home-actions.ts`) na escala. */
export function urgencyOfAction(
  action: {
    kind: 'proposta' | 'booking' | 'documento' | 'dados';
    deadline?: string;
  },
  now: Date,
): Urgency {
  return urgencyOf(
    {
      clientAction: true,
      deadline: action.deadline,
      blocksNextStep: action.kind === 'booking' || action.kind === 'dados',
    },
    now,
  );
}

export function compareUrgency(a: Urgency, b: Urgency): number {
  return URGENCY_RANK[a.level] - URGENCY_RANK[b.level];
}

/** A mais urgente de uma lista, ou `null` para lista vazia. */
export function mostUrgent(list: Urgency[]): Urgency | null {
  return list.reduce<Urgency | null>(
    (best, item) =>
      best == null || compareUrgency(item, best) < 0 ? item : best,
    null,
  );
}

export interface AttentionSummary {
  critico: number;
  atencao: number;
  /** Crítico + atenção: o número de "o que exige sua atenção hoje". */
  total: number;
}

export function summarizeAttention(list: Urgency[]): AttentionSummary {
  const critico = list.filter((u) => u.level === 'critico').length;
  const atencao = list.filter((u) => u.level === 'atencao').length;
  return { critico, atencao, total: critico + atencao };
}

/** Só os dois níveis que ganham cor. É a regra do "no máximo 2 ênfases". */
export function isEmphasized(level: UrgencyLevel): boolean {
  return level === 'critico' || level === 'atencao';
}

/**
 * A urgência de cada REGISTRO (cotação ou embarque): a mais alta entre as ações
 * do cliente que ele tem. Registro sem ação não entra no mapa — quem lê trata a
 * ausência como normal ("em andamento").
 *
 * Entrada é a fila de `home/lib/home-actions.ts::collectHomeActions`, a MESMA da
 * Home e da Central: "precisa de você" significa a mesma coisa nas três telas.
 */
export function urgencyByRecord(
  actions: {
    recordId: string;
    kind: 'proposta' | 'booking' | 'documento' | 'dados';
    deadline?: string;
  }[],
  now: Date,
): Map<string, Urgency> {
  const out = new Map<string, Urgency>();
  for (const action of actions) {
    const urgency = urgencyOfAction(action, now);
    const current = out.get(action.recordId);
    if (!current || compareUrgency(urgency, current) < 0) {
      out.set(action.recordId, urgency);
    }
  }
  return out;
}

/**
 * A fila reordenada pela escala: crítico primeiro, depois atenção, depois o
 * resto. ESTÁVEL — dentro do mesmo nível vale a ordem que a fila já tinha (em
 * `collectHomeActions`, "quem trava mais coisa"). É o que faz "Sua ação mais
 * urgente" ser a de prazo vencido, e não a primeira categoria da lista.
 */
export function rankByUrgency<
  T extends {
    kind: 'proposta' | 'booking' | 'documento' | 'dados';
    deadline?: string;
  },
>(actions: T[], now: Date): { action: T; urgency: Urgency }[] {
  return actions
    .map((action, index) => ({
      action,
      urgency: urgencyOfAction(action, now),
      index,
    }))
    .sort((a, b) => compareUrgency(a.urgency, b.urgency) || a.index - b.index)
    .map(({ action, urgency }) => ({ action, urgency }));
}
