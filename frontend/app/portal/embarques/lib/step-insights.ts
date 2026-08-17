// Enriquecimento por ETAPA da timeline do embarque: risco, gatilho de ação e
// mudança de data. Puro e unit-testado (step-insights.test.ts).
//
// Por que por etapa, e não só do embarque inteiro
// -----------------------------------------------
// Até aqui a tela dizia uma coisa só sobre risco — o badge "Atraso, +5 dias"
// do topo, que compara duas datas da companhia. Isso responde "chegou tarde?",
// não "o que pode dar errado daqui pra frente?". O risco por etapa responde a
// segunda pergunta, e é o que permite a timeline horizontal ter hierarquia:
// a etapa atual leva peso porque tem um porquê escrito nela, não porque está
// em negrito.
//
// A regra que impede as duas respostas de brigarem
// ------------------------------------------------
// Onde existe aritmética de verdade, ela GANHA. Os quatro passos pós-embarque
// herdam o resultado de `computeDelayRisk` (a mesma função do badge do topo,
// do card da Lista e das agregações de Inteligência) em vez de terem opinião
// própria: atraso confirmado -> risco alto, com o número de dias no texto.
// Uma etapa "risco baixo" embaixo de um badge "Atraso, +5 dias" seria a mesma
// contradição que matou o card "Rastreamento marítimo".
//
// Cascata do atraso confirmado (17/08/2026, Vinicius/Geraldo)
// -----------------------------------------------------------
// Atraso confirmado força **risco alto em TODA etapa operacional restante**, sem
// exceção pelo peso próprio da etapa. A versão anterior agravava uma casa, e o
// resultado quebrava a leitura de escalada: "Em análise de booking" alto,
// "Embarcado" moderado (porque o perfil dele é baixo) e "Em trânsito"/"Chegada"
// alto de novo. O leitor lia o vale do meio como "essa etapa está mais tranquila",
// quando o que existe é um atraso já medido que pressiona a cadeia inteira.
// O percentual histórico da etapa continua no texto — é o motivo específico
// dela — mas a frase diz qual fator manda. Exceção continua agravando uma casa
// (mecanismo separado; ela não mede nada, só congela a linha).
//
// O que é ilustrativo, e como
// ---------------------------
// Quando não há aritmética (embarque ainda em terra, sem rastreamento), o
// risco vem de um perfil por etapa — nível base + um percentual histórico
// determinístico pela referência. É estruturado como um modelo devolveria
// (nível + rótulo + justificativa curta), para a versão integrada trocar a
// fonte sem mexer na tela. Nenhum número daqui contradiz outro da tela: os
// percentuais falam de HISTÓRICO da rota, não deste embarque.

import type { EmbarqueEstado } from '@/types/portal-shipment';

import type { DelayRisk } from './delay-risk';
import type { StepStatus } from './timeline-steps';
import { seededInt } from '../../inteligencia/lib/intel-helpers.ts';

export type StepRiskLevel = 'low' | 'moderate' | 'high';

export interface StepRisk {
  level: StepRiskLevel;
  /** Rótulo do chip. */
  label: string;
  /** Uma frase curta dizendo POR QUE, que é o que torna o semáforo útil. */
  rationale: string;
}

/** Cor do semáforo por nível — status, nunca cor de marca. */
export const STEP_RISK_TONE: Record<StepRiskLevel, 'success' | 'warning' | 'danger'> =
  {
    low: 'success',
    moderate: 'warning',
    high: 'danger',
  };

const RISK_LABEL: Record<StepRiskLevel, string> = {
  low: 'Risco baixo',
  moderate: 'Risco moderado',
  high: 'Risco alto',
};

/** Faixa do percentual histórico citado na justificativa, por nível. */
const RISK_PCT_RANGE: Record<StepRiskLevel, [number, number]> = {
  low: [4, 12],
  moderate: [15, 32],
  high: [38, 60],
};

export type StepActionKind = 'documento' | 'aprovacao';

/**
 * `concluida` = o cliente já respondeu a este gatilho. A faixa continua na tela,
 * em tom de confirmação e sem botão: some o pedido, fica o recibo. Deixar a
 * faixa pedindo a mesma coisa depois do "sim" é o que quebrava a demonstração;
 * apagá-la por completo tiraria a única confirmação visível de que o clique
 * chegou a algum lugar.
 */
export type StepActionStatus = 'pendente' | 'concluida';

/**
 * Gatilho de ação: a etapa depende de algo que só o cliente pode fazer. Fica
 * em destaque na tela (nunca dentro de accordion) porque é a única coisa da
 * timeline que o cliente pode mudar — o resto ele acompanha.
 */
export interface StepAction {
  kind: StepActionKind;
  status: StepActionStatus;
  title: string;
  description: string;
  ctaLabel: string;
  /** Documentos que originaram a ação, quando `kind` é `documento`. */
  documentIds?: string[];
}

/**
 * Mudança de data prevista. A data é sempre uma que a tela já mostra; o que se
 * acrescenta é o MOTIVO — "postergado" sem porquê é a reclamação, não a
 * informação.
 */
export interface StepScheduleChange {
  /** Dias de deslocamento, quando há aritmética por trás. */
  deltaDays: number | null;
  reason: string;
}

export interface StepInsight {
  risk?: StepRisk;
  action?: StepAction;
  scheduleChange?: StepScheduleChange;
}

interface RiskProfile {
  level: StepRiskLevel;
  rationale: (pct: number) => string;
}

const BASE_RISK: Record<string, RiskProfile> = {
  solicitado: {
    level: 'low',
    rationale: () =>
      'Etapa administrativa: a abertura do processo raramente segura o embarque.',
  },
  aguardando_prontidao: {
    level: 'moderate',
    rationale: (pct) =>
      `A prontidão depende do exportador — ${pct}% dos embarques desta rota saíram da origem depois da data combinada.`,
  },
  coletado: {
    level: 'low',
    rationale: (pct) =>
      `Coleta com janela confirmada pelo agente; ${pct}% precisaram de reagendamento.`,
  },
  analise_booking: {
    level: 'moderate',
    rationale: (pct) =>
      `Conferência da reserva com o armador — ${pct}% dos bookings nesta rota mudaram de navio ou de data.`,
  },
  embarcado: {
    level: 'low',
    rationale: (pct) =>
      `A partida segue a escala do navio; ${pct}% dos embarques perderam a janela de atracação.`,
  },
  em_transito: {
    level: 'moderate',
    rationale: (pct) => `Rota histórica com ${pct}% de atraso neste trecho.`,
  },
  chegada: {
    level: 'moderate',
    rationale: (pct) =>
      `Congestionamento no destino afetou ${pct}% das chegadas recentes nesta rota.`,
  },
  descarregado: {
    level: 'low',
    rationale: (pct) =>
      `A descarga costuma sair em até 2 dias após a atracação; ${pct}% passaram disso.`,
  },
  liberado: {
    level: 'moderate',
    rationale: (pct) =>
      `A liberação depende de conferência e desembaraço — ${pct}% levaram mais de 5 dias.`,
  },
};

/**
 * Justificativa dos passos que o rastreamento governa, quando há aritmética.
 * O NÚMERO é o mesmo para os quatro (é um delta só, o do badge do topo), mas o
 * texto diz o que aquele atraso significa NAQUELA etapa: repetir a mesma frase
 * quatro vezes seguidas no eixo faz o leitor parar de ler na segunda.
 */
const MEASURED_RATIONALE: Record<
  'delayed' | 'attention' | 'on_time',
  Record<string, (days: number) => string>
> = {
  delayed: {
    em_transito: (d) =>
      `O trecho de trânsito já consumiu ${d} dias a mais que a primeira previsão.`,
    chegada: (d) =>
      `A companhia empurrou a chegada em ${d} dias sobre a primeira previsão.`,
    descarregado: (d) =>
      `A descarga só começa depois da atracação, que já escorregou ${d} dias.`,
    liberado: (d) =>
      `A liberação herda os ${d} dias de atraso da chegada — reprograme a retirada.`,
  },
  attention: {
    em_transito: (d) =>
      `O trânsito escorregou ${d} ${d === 1 ? 'dia' : 'dias'} sobre a primeira previsão — ainda dentro da janela de atenção.`,
    chegada: (d) =>
      `A chegada foi revista em ${d} ${d === 1 ? 'dia' : 'dias'} sobre a primeira previsão — ainda dentro da janela de atenção.`,
    descarregado: (d) =>
      `A atracação atrasou ${d} ${d === 1 ? 'dia' : 'dias'}, e a janela de descarga acompanha.`,
    liberado: (d) =>
      `A retirada desloca os mesmos ${d} ${d === 1 ? 'dia' : 'dias'} da chegada.`,
  },
  on_time: {
    em_transito: () => 'O trânsito segue no ritmo da primeira previsão da companhia.',
    chegada: () =>
      'A companhia mantém a mesma previsão de chegada desde a primeira estimativa.',
    descarregado: () =>
      'Com a chegada mantida, a janela de descarga do terminal segue valendo.',
    liberado: () =>
      'Sem mudança na chegada, a liberação segue o prazo nominal do terminal.',
  },
};

const MEASURED_LEVEL: Record<'delayed' | 'attention' | 'on_time', StepRiskLevel> = {
  delayed: 'high',
  attention: 'moderate',
  on_time: 'low',
};

/**
 * Motivos de reprogramação. Ilustrativos e determinísticos pela referência —
 * o embarque não guarda histórico de transição, então não há motivo real a ler.
 */
const SCHEDULE_REASONS = [
  'navio lotado',
  'janela de atracação remarcada no porto de origem',
  'congestionamento no porto de destino',
  'conexão perdida no transbordo',
];

const bump = (level: StepRiskLevel): StepRiskLevel =>
  level === 'low' ? 'moderate' : 'high';

function risk(level: StepRiskLevel, rationale: string): StepRisk {
  return { level, label: RISK_LABEL[level], rationale };
}

export interface StepInsightsInput {
  /** Passos como `buildTimelineSteps` os devolve. */
  steps: { key: string; status: StepStatus }[];
  referencia: string;
  estado: EmbarqueEstado;
  isException: boolean;
  /** Resultado de `delayRiskFromTracking` — a MESMA instância que o badge usa. */
  delayRisk: DelayRisk;
  /** Documentos pendentes do cliente (`pendingClientDocuments`). */
  pendingDocuments?: { id: string; label: string; requiredForStep: string }[];
  /**
   * O cliente já aprovou o booking NESTA SESSÃO (efeito local de demonstração —
   * não existe rota de escrita de embarque no portal). Vira o gatilho de
   * `pendente` para `concluida`; o `estado` do embarque, esse, não se move,
   * porque quem o escreve é o módulo do analista.
   */
  bookingApproved?: boolean;
}

/**
 * Insight por chave de etapa. Etapa concluída não recebe risco: risco é sobre
 * o que ainda pode acontecer, e pendurar semáforo no que já passou é ruído com
 * cara de alerta.
 */
export function buildStepInsights({
  steps,
  referencia,
  estado,
  isException,
  delayRisk,
  pendingDocuments = [],
  bookingApproved = false,
}: StepInsightsInput): Record<string, StepInsight> {
  const insights: Record<string, StepInsight> = {};
  const set = (key: string, patch: StepInsight) => {
    insights[key] = { ...(insights[key] ?? {}), ...patch };
  };

  // Só há aritmética quando a companhia publicou as duas previsões; `pending` e
  // `incomplete` não medem nada e caem no perfil ilustrativo da etapa.
  const measuredStatus =
    delayRisk.status === 'on_time' ||
    delayRisk.status === 'attention' ||
    delayRisk.status === 'delayed'
      ? delayRisk.status
      : null;

  steps.forEach((step) => {
    if (step.status === 'done') return;

    const profile = BASE_RISK[step.key];
    if (!profile) return;

    // Rastreamento medido manda nos passos pós-embarque: o número exibido aqui
    // é o mesmo delta do badge do topo, não uma segunda leitura do atraso.
    const measuredText = measuredStatus
      ? MEASURED_RATIONALE[measuredStatus][step.key]
      : undefined;
    if (measuredStatus && measuredText) {
      set(step.key, {
        risk: risk(
          MEASURED_LEVEL[measuredStatus],
          measuredText(delayRisk.deltaDays ?? 0),
        ),
      });
      return;
    }

    // Duas situações mexem numa etapa que a aritmética não alcança, e elas NÃO
    // são o mesmo mecanismo:
    //  - atraso JÁ confirmado na chegada: força alto, sem gradação. Há um número
    //    medido pressionando toda a cadeia que falta, e uma etapa "moderada" no
    //    meio de duas altas lê como alívio que não existe;
    //  - exceção, que congela a linha (não se sabe o estágio anterior, então
    //    nada depois dela pode ser dado como calmo): agrava uma casa, porque
    //    aqui não há medição nenhuma — só perda de visibilidade.
    const delayed = measuredStatus === 'delayed';
    const level: StepRiskLevel = delayed
      ? 'high'
      : isException
        ? bump(profile.level)
        : profile.level;
    const [min, max] = RISK_PCT_RANGE[profile.level];
    const base = profile.rationale(seededInt(`${referencia}:${step.key}`, min, max));
    // O motivo próprio da etapa continua na frente (é o que a diferencia das
    // outras); o fator dominante fecha a frase, para o chip vermelho não ficar
    // sem explicação de por que esta etapa específica é alta.
    const days = delayRisk.deltaDays ?? 0;
    set(step.key, {
      risk: risk(
        level,
        delayed
          ? `${base} O atraso de ${days} ${days === 1 ? 'dia' : 'dias'} já confirmado na chegada é o fator dominante desta etapa.`
          : base,
      ),
    });
  });

  // --- Gatilhos de ação -----------------------------------------------------

  // Documento: uma ação por etapa, listando o que falta. Os documentos vêm da
  // seção Documentos da mesma tela, então a etapa cobra exatamente o arquivo
  // que a lista mostra como pendente.
  const byStep = new Map<string, { id: string; label: string }[]>();
  pendingDocuments.forEach((doc) => {
    const list = byStep.get(doc.requiredForStep) ?? [];
    list.push({ id: doc.id, label: doc.label });
    byStep.set(doc.requiredForStep, list);
  });

  byStep.forEach((docs, stepKey) => {
    if (!steps.some((s) => s.key === stepKey)) return;
    const names = docs.map((d) => d.label).join(' e ');
    set(stepKey, {
      action: {
        kind: 'documento',
        // Documento entregue sai da lista de pendentes ANTES de chegar aqui
        // (`pendingClientDocuments` filtra por status), então todo gatilho de
        // documento que existe é, por construção, um gatilho pendente.
        status: 'pendente',
        title: docs.length === 1 ? 'Documento pendente' : 'Documentos pendentes',
        description: `Precisamos de ${names} para esta etapa seguir sem espera.`,
        ctaLabel: docs.length === 1 ? 'Enviar documento' : 'Enviar documentos',
        documentIds: docs.map((d) => d.id),
      },
    });
  });

  // Aprovação de booking: a única decisão do cliente dentro da jornada do
  // embarque. Nos dois casos a bola está com ele, e o texto diz qual é.
  if (estado === 'booking_divergente') {
    set('analise_booking', {
      action: bookingApproved
        ? {
            kind: 'aprovacao',
            status: 'concluida',
            title: 'Booking conferido',
            description:
              'Você confirmou as novas condições. A Freitas segue com o armador e avisa quando a reserva estiver fechada.',
            ctaLabel: 'Revisar booking',
          }
        : {
            kind: 'aprovacao',
            status: 'pendente',
            title: 'Booking divergente — sua conferência',
            description:
              'O booking voltou do armador diferente do que foi aprovado na cotação. Confirme se as novas condições servem antes de a Freitas fechar com o armador.',
            ctaLabel: 'Revisar booking',
          },
    });
  } else if (estado === 'analise_booking') {
    set('analise_booking', {
      action: bookingApproved
        ? {
            kind: 'aprovacao',
            status: 'concluida',
            title: 'Booking aprovado',
            description:
              'Sua aprovação foi registrada. A Freitas fecha a reserva com o armador e a etapa seguinte é liberada.',
            ctaLabel: 'Aprovar booking',
          }
        : {
            kind: 'aprovacao',
            status: 'pendente',
            title: 'Aprovação de booking pendente',
            description:
              'A Freitas conferiu a reserva com o armador. Sua confirmação libera a etapa seguinte.',
            ctaLabel: 'Aprovar booking',
          },
    });
  }

  // --- Mudança de data ------------------------------------------------------

  const reason = SCHEDULE_REASONS[seededInt(referencia, 0, SCHEDULE_REASONS.length - 1)];

  // Chegada remarcada: o deslocamento é real (delta das duas previsões da
  // companhia), só o motivo é ilustrativo — o embarque não guarda histórico de
  // transição de onde ler o motivo verdadeiro.
  if (delayRisk.deltaDays != null && delayRisk.deltaDays > 0) {
    set('chegada', {
      scheduleChange: { deltaDays: delayRisk.deltaDays, reason },
    });
  }

  // Embarque postergado: a reprogramação é da CHEGADA, que é onde a data
  // importa — pendurar o aviso na primeira etapa não concluída o colocaria em
  // "Solicitado", que já aconteceu. Sem duas previsões para comparar não há
  // quantos dias, e um número aqui seria invenção pura.
  if (estado === 'postergado' && !insights.chegada?.scheduleChange) {
    set('chegada', { scheduleChange: { deltaDays: null, reason } });
  }

  return insights;
}
