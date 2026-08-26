// "Ações necessárias" da Home — a fila do que depende do CLIENTE agora.
// Puro e unit-testado (home-actions.test.ts).
//
// ESTE MÓDULO NÃO DESCOBRE NADA. Ele não sabe quando um documento está
// pendente nem quando um booking espera aprovação: ele RODA a mesma pipeline
// que a tela de detalhe do embarque roda, e coleta o que ela já produz. Uma
// segunda regra de "o que está pendente" divergiria da faixa de Ação Necessária
// na primeira mudança de qualquer uma das duas, e o cliente veria a Home pedindo
// um documento que o embarque mostra como entregue.
//
// As duas fontes, ambas já estabelecidas no portal:
//
//   1. EMBARQUE — `buildTimelineSteps` -> `buildShipmentDocuments` ->
//      `pendingClientDocuments` -> `buildStepInsights`, exatamente a ordem de
//      `embarques/[id]/page.tsx`. Dela saem os gatilhos `documento` e
//      `aprovacao` com `status === 'pendente'`.
//   2. COTAÇÃO — `PORTAL_CLIENT_ACTION_BUCKETS` (`types/portal.ts`), os mesmos
//      dois baldes que sustentam o "X aguardando sua ação" do Funil. É de onde
//      sai o "prazo pra confirmar": a validade da proposta vencedora. O embarque
//      não tem prazo nenhum a cobrar do cliente — nada em `step-insights` data
//      um gatilho —, então essa terceira categoria só pode vir daqui.
//
// O que é do Home e não da fonte: a DESCRIÇÃO de uma linha. Os textos de
// `StepAction` são de uma faixa de destaque dentro da jornada, com o embarque
// já em volta, e estão travados palavra por palavra em `step-insights.test.ts`.
// Aqui a linha é lida fora de contexto, então ela nomeia o embarque e explica o
// jargão inline. `title` e `ctaLabel` vêm da fonte sem reescrita.
//
// `applyLocalDocumentActions` NÃO entra: aquilo projeta o que o cliente clicou
// na sessão da tela de detalhe, e a Home descreve o que o backend sabe.

import type { PortalQuotation, PortalBucketKey } from '../../../../types/portal.ts';
import { PORTAL_CLIENT_ACTION_BUCKETS } from '../../../../types/portal.ts';
import type {
  EmbarqueEstado,
  PortalShipment,
} from '../../../../types/portal-shipment.ts';
import { isExceptionState } from '../../../../types/portal-shipment.ts';
// Imports relativos COM extensão, não pelo alias `@/`: este módulo roda no
// runner nativo do Node (`npm run test:unit`), que não resolve o alias. Mesma
// razão de `shipment-filters.ts` e `shipment-dimensions.ts`.
import { delayRiskFromTracking } from '../../embarques/lib/delay-risk.ts';
import {
  buildShipmentDocuments,
  pendingClientDocuments,
} from '../../embarques/lib/shipment-documents.ts';
import { buildStepInsights } from '../../embarques/lib/step-insights.ts';
import { buildTimelineSteps } from '../../embarques/lib/timeline-steps.ts';

/**
 * Categoria da ação. Decide o ícone e o acento, e é o primeiro critério de
 * ordenação — a fila é por QUEM BLOQUEIA O QUÊ, não por data.
 */
export type HomeActionKind = 'proposta' | 'booking' | 'documento' | 'dados';

export interface HomeAction {
  /** Estável entre renders: usado como key e para deduplicar. */
  id: string;
  kind: HomeActionKind;
  /** Rótulo curto do registro a que a ação pertence ("Embarque EMB-2026-0004"). */
  category: string;
  title: string;
  /** Uma linha, com o jargão explicado inline. */
  description: string;
  ctaLabel: string;
  /** Destino real. Nenhuma ação da Home é decorativa. */
  href: string;
  tone: 'danger' | 'warning' | 'info';
  /**
   * A data do prazo, crua (ISO), quando existe uma. Quem formata é a tela, com o
   * MESMO `daysUntil` que o card do Funil usa — assim "Expira hoje" é a mesma
   * frase nos dois lugares. Passar a data em vez do rótulo pronto é o que evita
   * duas redações do mesmo prazo.
   */
  deadline?: string;
  /**
   * Dias até `deadline`, derivado do `now` injetado. Existe para a ORDENAÇÃO ser
   * determinística e testável sem depender do relógio de quem formata.
   */
  daysLeft?: number;
}

/**
 * Peso por categoria. Menor = mais acima.
 *
 * A ordem responde "o que trava mais coisa se ficar parado": proposta expirando
 * some sozinha (a validade vence e o preço morre), booking segura o navio,
 * documento segura a etapa seguinte, e detalhe faltando segura a cotação, que
 * ainda não tem carga andando atrás dela.
 */
const KIND_WEIGHT: Record<HomeActionKind, number> = {
  proposta: 0,
  booking: 1,
  documento: 2,
  dados: 3,
};

/** Quantas linhas a Home mostra. O resto é contado, nunca omitido em silêncio. */
export const HOME_ACTION_LIMIT = 5;

export interface HomeActionsInput {
  shipments: PortalShipment[];
  /** Baldes da resposta de `/portal/quotations`, como o Funil os recebe. */
  buckets: Partial<Record<PortalBucketKey, PortalQuotation[]>>;
  /**
   * `REAL_STEPS` — entra por argumento porque aquele módulo importa rótulos
   * pelo alias `@/` e não roda no runner. Mesmo contrato de `buildTimelineSteps`.
   */
  realSteps: { key: EmbarqueEstado; label: string; description: string }[];
  /** Uma leitura de relógio por render, compartilhada com o resto da tela. */
  now: Date;
}

export interface HomeActionsResult {
  /** As primeiras `HOME_ACTION_LIMIT`, já ordenadas. */
  actions: HomeAction[];
  /** Quantas existem no total — o que a tela precisa para não truncar calada. */
  total: number;
}

const daysBetween = (from: Date, toIso: string): number => {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const target = new Date(toIso).getTime();
  return Math.ceil((target - start.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Gatilhos pendentes de UM embarque, pela mesma composição da tela de detalhe.
 */
function shipmentActions(
  shipment: PortalShipment,
  realSteps: HomeActionsInput['realSteps'],
  now: Date,
): HomeAction[] {
  const isException = isExceptionState(shipment.estado);
  const steps = buildTimelineSteps({
    estado: shipment.estado,
    realSteps,
    isException,
    dataStatus: shipment.tracking?.data_status,
    milestone: shipment.tracking?.last_milestone,
    currentEta: shipment.tracking?.current_eta,
    firstEta: shipment.tracking?.first_eta,
    createdAt: shipment.created_at,
    milestoneAt: shipment.tracking?.last_milestone_at,
    now,
  });

  const documents = buildShipmentDocuments({
    referencia: shipment.referencia,
    createdAt: shipment.created_at,
    steps,
    now,
  });

  const insights = buildStepInsights({
    steps,
    referencia: shipment.referencia,
    estado: shipment.estado,
    isException,
    delayRisk: delayRiskFromTracking(shipment.tracking),
    pendingDocuments: pendingClientDocuments(documents),
  });

  const out: HomeAction[] = [];

  for (const [stepKey, insight] of Object.entries(insights)) {
    const action = insight.action;
    if (!action || action.status !== 'pendente') continue;

    if (action.kind === 'documento') {
      const names = (action.documentIds ?? [])
        .map((id) => documents.find((d) => d.id === id)?.label)
        .filter((label): label is string => Boolean(label));
      out.push({
        id: `doc:${shipment.id}:${stepKey}`,
        kind: 'documento',
        category: `Embarque ${shipment.referencia}`,
        title: action.title,
        description: names.length
          ? `A Freitas precisa de ${names.join(' e ')} para a etapa seguir sem espera.`
          : 'A Freitas precisa de um documento seu para a etapa seguir sem espera.',
        ctaLabel: action.ctaLabel,
        // A seção Documentos é onde o envio acontece — um segundo lugar de envio
        // seria um lugar a mais para os dois estados discordarem.
        href: `/portal/embarques/${shipment.id}#documentos`,
        tone: 'warning',
      });
      continue;
    }

    // Aprovação de booking. `booking_divergente` é vermelho e `analise_booking`
    // laranja pelo mesmo critério do semáforo de estado — divergência é
    // tratativa aberta, conferência de rotina não é.
    const divergent = shipment.estado === 'booking_divergente';
    out.push({
      id: `booking:${shipment.id}`,
      kind: 'booking',
      category: `Embarque ${shipment.referencia}`,
      title: action.title,
      description: divergent
        ? 'O booking — a reserva de espaço no navio — voltou do armador diferente do que você aprovou. Confirme se as novas condições servem.'
        : 'O booking — a reserva de espaço no navio — está conferido com o armador e espera só a sua confirmação para a carga seguir.',
      ctaLabel: action.ctaLabel,
      href: `/portal/embarques/${shipment.id}`,
      tone: divergent ? 'danger' : 'warning',
    });
  }

  return out;
}

/**
 * Ações vindas da cotação. Os dois baldes são os MESMOS de
 * `PORTAL_CLIENT_ACTION_BUCKETS`, e a lista é derivada dele em vez de repetir os
 * nomes aqui: um balde novo entra nas duas telas de uma vez ou em nenhuma.
 */
function quotationActions(
  buckets: HomeActionsInput['buckets'],
  now: Date,
): HomeAction[] {
  const out: HomeAction[] = [];

  for (const bucket of PORTAL_CLIENT_ACTION_BUCKETS) {
    for (const q of buckets[bucket] ?? []) {
      if (bucket === 'aguardando_aprovacao') {
        // O prazo é a validade da proposta vencedora, com a data-limite da
        // necessidade como reserva — a mesma dupla que o card do Funil lê para
        // imprimir "Expira hoje".
        const deadline = q.best_proposal?.validity ?? q.data_limite_necessidade;
        const daysLeft = deadline ? daysBetween(now, deadline) : undefined;
        out.push({
          id: `proposta:${q.id}`,
          kind: 'proposta',
          category: `Cotação ${q.reference}`,
          title: 'Proposta aguardando sua escolha',
          description:
            daysLeft != null && daysLeft <= 0
              ? 'A validade do preço já venceu. Escolher agora exige a Freitas revalidar com o agente.'
              : 'As propostas chegaram e o preço vale por tempo limitado — depois da validade o agente pode recotar.',
          ctaLabel: 'Escolher proposta',
          href: `/portal/cotacao/${q.id}`,
          // Prazo vencido ou vencendo hoje é vermelho: passou do ponto em que
          // "depois eu vejo" ainda era verdade.
          tone: daysLeft != null && daysLeft <= 0 ? 'danger' : 'warning',
          ...(deadline != null && daysLeft != null ? { deadline, daysLeft } : {}),
        });
        continue;
      }

      out.push({
        id: `dados:${q.id}`,
        kind: 'dados',
        category: `Cotação ${q.reference}`,
        title: 'Detalhes pendentes',
        description:
          'A Freitas precisa de informações que faltam para pedir preço aos agentes.',
        ctaLabel: 'Preencher detalhes',
        href: `/portal/cotacao/${q.id}`,
        tone: 'info',
      });
    }
  }

  return out;
}

/**
 * A fila inteira, ordenada, com o corte declarado.
 *
 * Ordenação: categoria, depois urgência do prazo (quem tem prazo mais curto
 * primeiro; quem não tem prazo vai depois de quem tem), depois o id — o
 * desempate por id existe só para a ordem ser estável entre renders, nunca para
 * significar alguma coisa.
 */
export function buildHomeActions({
  shipments,
  buckets,
  realSteps,
  now,
}: HomeActionsInput): HomeActionsResult {
  const all = [
    ...shipments.flatMap((s) => shipmentActions(s, realSteps, now)),
    ...quotationActions(buckets, now),
  ];

  all.sort((a, b) => {
    const byKind = KIND_WEIGHT[a.kind] - KIND_WEIGHT[b.kind];
    if (byKind !== 0) return byKind;
    const aDays = a.daysLeft ?? Number.POSITIVE_INFINITY;
    const bDays = b.daysLeft ?? Number.POSITIVE_INFINITY;
    if (aDays !== bDays) return aDays - bDays;
    return a.id.localeCompare(b.id);
  });

  return { actions: all.slice(0, HOME_ACTION_LIMIT), total: all.length };
}
