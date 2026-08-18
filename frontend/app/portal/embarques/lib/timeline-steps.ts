// Step-by-step state of the shipment timeline. Pure and unit-tested
// (timeline-steps.test.ts) — the component that draws it stays presentational,
// which is the same split the Inteligência blocks use (logic in lib/, blocks
// render).
//
// Two independent inputs decide a step's status:
//
//   `estado`     — the real EmbarqueState the GE module stores. Drives the five
//                  operational steps (solicitado .. embarcado).
//   `milestone`  — the last milestone the carrier reported (ShipsGo), which is
//                  the ONLY thing that can advance the four post-departure
//                  steps. Without it they stay "pending" (no integration), or
//                  "blocked" when the carrier answered with INCOMPLETE.
//
// Datas por etapa: só as DUAS que existem de verdade (18/08/2026)
// ----------------------------------------------------------------
// Não há tabela de transição de embarque. `centrix_shipment_embarques` guarda
// só o `estado` ATUAL e nenhuma linha é escrita quando ele muda; `processos.datas`
// é JSONB `null` em todo processo provisionado pelo portal. Isso está afirmado
// no docstring de `shared/portal_shipment_helpers.py` e foi reconferido no banco
// em 18/08/2026. Ou seja: "concluído em 24 de jul." não é derivável para
// Aguardando prontidão, Coletado, Em análise de booking nem Embarcado, e
// fabricar um timestamp ali seria pior do que não datar.
//
// Existem exatamente DOIS fatos datados, e por isso exatamente duas etapas
// recebem `occurredAt`:
//
//   solicitado        <- `processo.created_at`, o mesmo "Aberto em 13 de ago."
//                        que o cabeçalho da página já imprime. Não é uma segunda
//                        fonte: é o mesmo campo, mostrado onde ele responde
//                        "quando esta etapa aconteceu".
//   etapa do milestone <- `tracking.last_milestone_at` (migração 093), que data
//                        o ÚLTIMO marco reportado pela companhia. Os marcos
//                        ANTERIORES a ele ficam sem data de propósito: o ShipsGo
//                        diz quando o último aconteceu, não quando cada um dos
//                        anteriores aconteceu, e herdar a data para trás
//                        inventaria três datas a partir de uma.
//
// `occurredAt` só é preenchido em etapa `done` ou `current` — uma etapa que
// ainda não aconteceu não tem quando. Em exceção (linha congelada) ninguém é
// `done`/`current`, então não há data nenhuma, que é a leitura certa: não se
// sabe qual estágio precedeu a exceção.
//
// A metade futura continua com `forecastAt` (step-forecast.ts). Nenhum dos dois
// campos muda `status`: o círculo do passo futuro continua vazio e "Etapa atual"
// continua onde a regra do milestone a colocou.

import type { EmbarqueEstado, TrackingDataStatus, TrackingMilestone } from '@/types/portal-shipment';

import { forecastDownstreamDates, type DownstreamKey } from './step-forecast.ts';

export type StepStatus = 'done' | 'current' | 'upcoming' | 'pending' | 'blocked';

export interface TimelineStep {
  key: string;
  label: string;
  description: string;
  status: StepStatus;
  /** Chegada is the anchor for the customs-clearance tag (Camada 2). */
  isArrival?: boolean;
  /**
   * Expected date (ISO) for a step that has NOT happened, replacing the
   * "Pendente integração" badge. Only ever set on `pending` steps, and only when
   * there is an ETA to derive it from.
   */
  forecastAt?: string;
  /**
   * Date (ISO) on which this step actually happened, when a real dated fact
   * exists for it. Only two steps can ever carry one — see the header of this
   * file. Never derived, never inherited from a neighbouring step.
   */
  occurredAt?: string;
}

export interface DownstreamStep {
  key: string;
  label: string;
  description: string;
  /** ShipsGo milestone that marks this step as reached. */
  milestone: TrackingMilestone;
}

/**
 * The four post-departure stages, in carrier order. Gate-in and Vessel Loading
 * are absent because they already are the real states `coletado` / `embarcado`.
 */
export const DOWNSTREAM_STEPS: DownstreamStep[] = [
  {
    key: 'em_transito',
    label: 'Em trânsito',
    description: 'A carga segue em trânsito internacional até o destino.',
    milestone: 'OCEAN_TRANSIT',
  },
  {
    key: 'chegada',
    label: 'Chegada',
    description: 'Chegada ao porto ou aeroporto de destino.',
    milestone: 'ARRIVAL',
  },
  {
    key: 'descarregado',
    label: 'Descarregado',
    description: 'A carga foi descarregada do navio no porto de destino.',
    milestone: 'DISCHARGE',
  },
  {
    key: 'liberado',
    label: 'Liberado',
    description: 'Carga liberada para retirada no destino.',
    milestone: 'AVAILABLE',
  },
];

export interface TimelineInput {
  estado: EmbarqueEstado;
  /** Real operational steps, in order, with their labels/descriptions. */
  realSteps: { key: EmbarqueEstado; label: string; description: string }[];
  /** True for postergado / booking_divergente. */
  isException: boolean;
  dataStatus?: TrackingDataStatus | null;
  milestone?: TrackingMilestone | null;
  /** ETA at POD, the anchor every forecast is derived from. */
  currentEta?: string | null;
  firstEta?: string | null;
  /** `processo.created_at` — the only dated fact about "Solicitado". */
  createdAt?: string | null;
  /** `tracking.last_milestone_at` — dates the LAST milestone, and only it. */
  milestoneAt?: string | null;
  /** "Today", for the forecast. Injected in tests; defaults to the real clock. */
  now?: Date;
}

export function buildTimelineSteps({
  estado,
  realSteps,
  isException,
  dataStatus,
  milestone,
  currentEta,
  firstEta,
  createdAt,
  milestoneAt,
  now,
}: TimelineInput): TimelineStep[] {
  const currentIndex = realSteps.findIndex((s) => s.key === estado);

  // An exception freezes the line: the stage that preceded it is not stored, so
  // marking anything done would be a guess presented as fact — and a milestone
  // reported before the exception cannot be trusted to still hold.
  const milestoneIndex =
    !isException && milestone
      ? DOWNSTREAM_STEPS.findIndex((d) => d.milestone === milestone)
      : -1;
  const hasMilestone = milestoneIndex >= 0;

  const real: TimelineStep[] = realSteps.map((step, index) => {
    let status: StepStatus;
    if (isException) {
      status = 'upcoming';
    } else if (index < currentIndex) {
      status = 'done';
    } else if (index === currentIndex) {
      // A reported milestone means the cargo is past the last operational state
      // the GE module tracks, so "Etapa atual" belongs on the milestone below.
      status = hasMilestone ? 'done' : 'current';
    } else {
      status = 'upcoming';
    }
    // "Solicitado" é a única etapa operacional com um fato datado por trás
    // (a abertura do processo). As outras quatro não têm de onde vir uma data,
    // e o índice é comparado com `realSteps` em vez de com a string 'solicitado'
    // para a regra continuar valendo se a primeira etapa for renomeada.
    const occurredAt =
      index === 0 && createdAt && (status === 'done' || status === 'current')
        ? createdAt
        : undefined;
    return {
      key: step.key,
      label: step.label,
      description: step.description,
      status,
      ...(occurredAt ? { occurredAt } : {}),
    };
  });

  const blocked = dataStatus === 'INCOMPLETE';
  // Only `pending` steps take a forecast. A `blocked` one is the carrier's own
  // silence ("Sem atualização da companhia") and has no ETA behind it anyway,
  // and a done/current one already happened.
  const forecast = forecastDownstreamDates({
    estado,
    currentEta,
    firstEta,
    now: now ?? new Date(),
  });

  const downstream: TimelineStep[] = DOWNSTREAM_STEPS.map((step, index) => {
    let status: StepStatus = blocked ? 'blocked' : 'pending';
    if (hasMilestone && index < milestoneIndex) status = 'done';
    else if (hasMilestone && index === milestoneIndex) status = 'current';
    return {
      key: step.key,
      label: step.label,
      description: step.description,
      status,
      isArrival: step.key === 'chegada',
      ...(status === 'pending' && forecast[step.key as DownstreamKey]
        ? { forecastAt: forecast[step.key as DownstreamKey] }
        : {}),
      // Só o milestone reportado é datado. Os marcos anteriores a ele ficam
      // `done` e SEM data: a companhia informou quando o último aconteceu, não
      // quando cada um dos anteriores aconteceu.
      ...(status === 'current' && milestoneAt ? { occurredAt: milestoneAt } : {}),
    };
  });

  return [...real, ...downstream];
}

/** Key of the first step that is blocked, for the single INCOMPLETE notice. */
export function firstBlockedKey(steps: TimelineStep[]): string | null {
  return steps.find((s) => s.status === 'blocked')?.key ?? null;
}
