'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatShortDate } from '@/lib/portal-formatters';
import { cn } from '@/lib/utils';
import {
  ESTADO_DESCRIPTIONS,
  ESTADO_LABELS,
  type EmbarqueEstado,
} from '@/types/portal-shipment';

import {
  IncompleteDataBadge,
  IncompleteDataNote,
} from '../../_shared/incomplete-data-badge';
import { INCOMPLETE_DATA_COPY } from '../lib/delay-risk';
import {
  STEP_RISK_TONE,
  type StepAction,
  type StepInsight,
  type StepRisk,
  type StepRiskLevel,
} from '../lib/step-insights';
import { firstBlockedKey, type StepStatus, type TimelineStep } from '../lib/timeline-steps';

/**
 * Timeline HORIZONTAL da jornada do embarque.
 *
 * O que mudou, e por quê (revisão de 14/08/2026 com Victor Orsi e Vinicius)
 * ------------------------------------------------------------------------
 * A versão anterior era vertical, com as nove etapas empilhadas e todas com o
 * mesmo peso: informação demais de uma vez, e nenhuma resposta rápida para
 * "onde meu embarque está agora". Agora a tela tem três níveis de leitura:
 *
 *   1. Ação necessária — o que depende do CLIENTE, em destaque, fora de
 *      qualquer accordion. É a única coisa aqui que ele pode mudar.
 *   2. Etapa atual (dominante) + próxima etapa (secundária), EMPILHADAS, com
 *      risco e justificativa por extenso.
 *   3. O eixo horizontal com as nove etapas, que continua mostrando a jornada
 *      inteira — inclusive os textos descritivos de cada etapa, que não se
 *      perderam na mudança de layout.
 *
 * O que mudou na revisão de 18/08/2026 (planning da Sprint 13)
 * ------------------------------------------------------------
 * Vendo a tela rodar, os dois ajustes foram de VOLUME, não de conteúdo:
 *
 *   - o nível 2 deixou de ser duas colunas e passou a ser duas faixas
 *     empilhadas, para a próxima etapa ganhar largura inteira e comportar mais
 *     texto de contexto;
 *   - o nível 3 mostra semáforo de risco só na etapa atual e na próxima. As
 *     outras sete mantêm data prevista, descrição, gatilho de ação e mudança de
 *     data. O cálculo do risco não mudou — ver `showsRisk` no map do eixo.
 *
 * O eixo virou RÉGUA (terceira rodada, mesmo planning)
 * ----------------------------------------------------
 * O corte anterior tirou os semáforos e o eixo continuou carregado, porque o que
 * pesava era o texto: nove parágrafos descritivos empilhados sob nove nomes de
 * etapa. Agora cada card do eixo diz quatro coisas, todas de uma linha:
 *
 *     círculo de status · nome da etapa · data (realizada ou prevista) · marcas
 *
 * onde "marcas" são o ponto de risco (sem a palavra), o triângulo de
 * reprogramação, o badge de trecho travado e o chip de ação — tudo com o texto
 * por extenso em `title`/`aria-label`, nunca só na cor.
 *
 * A descrição de cada etapa NÃO se perdeu: ela está por extenso nos dois cards
 * de destaque acima, que é onde há largura para ela. O eixo deixou de repetir o
 * que o card logo acima já diz. Os cards de destaque estão fora do escopo desta
 * rodada e continuam idênticos.
 *
 * Este componente é PRESENTACIONAL. Os passos vêm de `buildTimelineSteps` e o
 * enriquecimento de `buildStepInsights`, os dois puros e unit-testados, e é a
 * página que os compõe. Regra antiga que continua valendo: não devolva lógica
 * de etapa para dentro do JSX.
 *
 * A metade de baixo da linha (Em trânsito -> Chegada -> Descarregado ->
 * Liberado) segue andando SÓ por `tracking.last_milestone`, e um passo ainda
 * não alcançado mostra data prevista derivada do ETA da própria tela — o
 * círculo continua vazio e "Etapa atual" não se move por causa disso.
 */

/**
 * Desembaraço (Camada 2, Inova / Portal Único) — não integrado.
 *
 * Continua fora da linha: desembaraço é um atributo da chegada, não um degrau,
 * e não é garantido em todo processo. Por isso a ausência renderiza NADA — nem
 * "Pendente integração", que leria como lacuna do processo em embarques que
 * nunca vão ter o dado.
 */
export interface CustomsClearance {
  /** ISO da data de desembaraço, quando a Camada 2 reportar uma. */
  clearedAt?: string | null;
}

export interface StepActionEvent {
  stepKey: string;
  stepLabel: string;
  action: StepAction;
}

const RISK_CHIP_CLASS: Record<StepRiskLevel, string> = {
  low: 'border-portal-success/25 bg-portal-success/10 text-portal-success',
  moderate: 'border-portal-warning/30 bg-portal-warning/10 text-portal-warning',
  high: 'border-portal-danger/30 bg-portal-danger/10 text-portal-danger',
};

const RISK_DOT_CLASS: Record<StepRiskLevel, string> = {
  low: 'bg-portal-success',
  moderate: 'bg-portal-warning',
  high: 'bg-portal-danger',
};

function StepDot({
  status,
  emphasis = false,
}: {
  status: StepStatus;
  emphasis?: boolean;
}) {
  const size = emphasis ? 'h-9 w-9' : 'h-7 w-7';
  if (status === 'done') {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-portal-success text-white',
          size,
        )}
      >
        <Check className={emphasis ? 'h-5 w-5' : 'h-4 w-4'} />
      </span>
    );
  }
  if (status === 'current') {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full border-2 border-portal-success bg-white ring-4 ring-portal-success/15',
          size,
        )}
      >
        <span className="h-3 w-3 rounded-full bg-portal-success" />
      </span>
    );
  }
  if (status === 'pending' || status === 'blocked') {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-muted',
          size,
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-border bg-white',
        size,
      )}
    />
  );
}

/**
 * Data prevista de uma etapa que ainda não aconteceu. Neutra de propósito: é
 * projeção, não conclusão nem sinal de saúde — quem diz que a etapa está à
 * frente é o círculo vazio ao lado.
 */
function ForecastTag({ iso }: { iso: string }) {
  return (
    <span className="portal-small inline-flex items-center gap-1.5 rounded border border-border bg-muted px-2 py-0.5 font-medium text-portal-neutral">
      <CalendarClock className="h-3.5 w-3.5" />
      Previsto: {formatShortDate(iso)}
    </span>
  );
}

function RiskChip({ risk, className }: { risk: StepRisk; className?: string }) {
  return (
    <span
      className={cn(
        'portal-small inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-medium',
        RISK_CHIP_CLASS[risk.level],
        className,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', RISK_DOT_CLASS[risk.level])} />
      {risk.label}
    </span>
  );
}

/**
 * "Postergado — motivo: navio lotado". O deslocamento em dias sai da mesma
 * aritmética do badge de atraso do topo; sem as duas previsões da companhia não
 * há número, e a linha afirma só o motivo.
 */
function scheduleChangeText(
  change: NonNullable<StepInsight['scheduleChange']>,
): string {
  return change.deltaDays != null
    ? `Postergado ${change.deltaDays} ${change.deltaDays === 1 ? 'dia' : 'dias'} — motivo: ${change.reason}`
    : `Reprogramado — motivo: ${change.reason}`;
}

function ScheduleChangeLine({
  change,
  className,
}: {
  change: NonNullable<StepInsight['scheduleChange']>;
  className?: string;
}) {
  return (
    <p className={cn('portal-small text-portal-warning', className)}>
      {scheduleChangeText(change)}
    </p>
  );
}

/** "✓ Desembaraçado" — etiqueta na Chegada, não degrau. Ver CustomsClearance. */
function CustomsClearedTag({ clearance }: { clearance?: CustomsClearance | null }) {
  if (!clearance?.clearedAt) return null;
  return (
    <span className="portal-small inline-flex items-center gap-1 rounded border border-portal-success/25 bg-portal-success/10 px-1.5 py-0.5 font-medium text-portal-success">
      <ShieldCheck className="h-3.5 w-3.5" />
      Desembaraçado
    </span>
  );
}

/**
 * Faixa de ação. Depois que o cliente responde ao gatilho ela NÃO some: vira
 * confirmação (verde, sem botão). Continuar pedindo o que já foi feito é o
 * defeito óbvio; apagar a faixa inteira é o menos óbvio, e tira a única prova
 * na tela de que o clique chegou a algum lugar.
 */
function ActionCallout({
  step,
  action,
  onAction,
}: {
  step: TimelineStep;
  action: StepAction;
  onAction?: (event: StepActionEvent) => void;
}) {
  const done = action.status === 'concluida';
  const Icon = action.kind === 'documento' ? Upload : CheckCircle2;
  return (
    // Empilha no mobile: lado a lado, o botão espremia o texto a uma palavra
    // por linha — o aviso mais importante da tela virava o menos legível.
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start',
        done
          ? 'border-portal-success/30 bg-portal-success/[0.07]'
          : 'border-portal-warning/40 bg-portal-warning/[0.07]',
      )}
    >
      {done ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-portal-success" />
      ) : (
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-portal-warning" />
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="portal-h3 text-foreground">{action.title}</p>
        <p className="portal-body text-foreground/80">{action.description}</p>
        <p className="portal-small text-portal-neutral">Etapa: {step.label}</p>
      </div>
      {!done && (
        <Button
          size="sm"
          className="w-full gap-2 sm:w-auto"
          onClick={() =>
            onAction?.({ stepKey: step.key, stepLabel: step.label, action })
          }
        >
          <Icon className="h-4 w-4" />
          {action.ctaLabel}
        </Button>
      )}
    </div>
  );
}

export function ShipmentTimeline({
  steps,
  insights = {},
  estado,
  isException,
  customsClearance,
  onAction,
}: {
  /** Saída de `buildTimelineSteps`, na ordem. */
  steps: TimelineStep[];
  /** Saída de `buildStepInsights`, por chave de etapa. */
  insights?: Record<string, StepInsight>;
  estado: EmbarqueEstado;
  isException: boolean;
  /** Camada 2 (Inova / Portal Único). Não integrada: ninguém passa isto hoje. */
  customsClearance?: CustomsClearance | null;
  onAction?: (event: StepActionEvent) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);
  // Véus das bordas do eixo, ligados só quando há mesmo conteúdo escondido
  // daquele lado: um véu permanente apagaria a primeira letra de "Solicitado"
  // num eixo que nem rolou.
  const [edges, setEdges] = useState({ left: false, right: false });

  const currentIndex = steps.findIndex((s) => s.status === 'current');
  const current = currentIndex >= 0 ? steps[currentIndex] : null;
  // Com a linha congelada por exceção não existe "atual"; a próxima é a
  // primeira que ainda não foi concluída.
  // Com exceção não se anuncia próxima etapa: a linha está congelada e o estágio
  // anterior não é armazenado, então chamar "Solicitado" de próxima etapa seria
  // um palpite com cara de plano. O aviso da exceção é que responde por ela.
  const nextIndex =
    currentIndex >= 0 ? currentIndex + 1 : isException ? -1 : 0;
  const next = nextIndex >= 0 ? (steps[nextIndex] ?? null) : null;

  const blockedKey = firstBlockedKey(steps);
  const actions = steps
    .map((step) => ({ step, action: insights[step.key]?.action }))
    .filter((entry): entry is { step: TimelineStep; action: StepAction } =>
      Boolean(entry.action),
    );

  // Traz a etapa atual para o centro do eixo assim que a tela abre: numa
  // timeline que rola, a etapa que importa não pode nascer fora do campo de
  // visão. Mexe só no scroll do trilho, nunca no da página.
  const currentKey = current?.key;
  const syncEdges = () => {
    const rail = railRef.current;
    if (!rail) return;
    setEdges({
      left: rail.scrollLeft > 4,
      right: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4,
    });
  };
  useEffect(() => {
    const rail = railRef.current;
    const item = currentRef.current;
    if (rail && item) {
      rail.scrollLeft = Math.max(
        0,
        item.offsetLeft - rail.clientWidth / 2 + item.clientWidth / 2,
      );
    }
    syncEdges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  return (
    <div className="space-y-6">
      {isException && (
        <div className="flex items-start gap-2 rounded-xl border border-portal-danger/30 bg-portal-danger/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-portal-danger" />
          <div className="space-y-1">
            <p className="portal-h3 text-portal-danger">{ESTADO_LABELS[estado]}</p>
            <p className="portal-body text-foreground/80">
              {ESTADO_DESCRIPTIONS[estado]}
            </p>
          </div>
        </div>
      )}

      {/* Nível 1 — o que depende do cliente. Sempre visível, nunca colapsado. */}
      {actions.map(({ step, action }) => (
        <ActionCallout
          key={`${step.key}:${action.kind}`}
          step={step}
          action={action}
          onAction={onAction}
        />
      ))}

      {/* Nível 2 — etapa atual dominante, próxima etapa em segundo plano.
          EMPILHADAS, não lado a lado (planning da Sprint 13, 18/08/2026).
          Vinicius: "vai ter que jogar pra baixo a linha, não vai dar pra deixar
          a lateral". Duas razões, e a segunda é a que fecha a discussão:

          - lado a lado, a próxima etapa ficava com um terço da coluna e
            comprimia justamente o texto que Orsi pediu para CRESCER ("aqui na
            próxima etapa, aí sim tu pode abranger mais, comentar mais");
          - a dominância da etapa atual não vinha da largura, vinha da borda
            verde, do título em portal-h2 e do fundo branco contra o tracejado
            da próxima. Empilhar não custa nada dela, e devolve largura inteira
            para as duas.

          `space-y-4` em vez de grid: não há mais nada a alinhar em colunas, e
          um grid de uma coluna só seria a mesma coisa escrita de forma que
          convida a voltar para duas. */}
      <div className={cn('space-y-4', !current && !next && 'hidden')}>
        {current && (
          <div className="space-y-3 rounded-xl border border-portal-success/30 bg-white p-5">
            <span className="portal-small inline-flex items-center rounded border border-portal-success/25 bg-portal-success/10 px-1.5 py-0.5 font-medium text-portal-success">
              Etapa atual
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="portal-h2 text-foreground">{current.label}</h3>
              {current.isArrival && (
                <CustomsClearedTag clearance={customsClearance} />
              )}
            </div>
            <p className="portal-body text-foreground/80">{current.description}</p>
            {insights[current.key]?.risk && (
              <div className="flex flex-wrap items-center gap-2">
                <RiskChip risk={insights[current.key]!.risk!} />
                <span className="portal-body text-portal-neutral">
                  {insights[current.key]!.risk!.rationale}
                </span>
              </div>
            )}
            {insights[current.key]?.scheduleChange && (
              <ScheduleChangeLine change={insights[current.key]!.scheduleChange!} />
            )}
          </div>
        )}

        {next && (
          // Largura inteira da coluna, e por isso o texto interno usa
          // `portal-body` (não `portal-small`) e as linhas correm em
          // `max-w-3xl`: o bloco agora comporta um parágrafo de contexto sem
          // quebrar, que é o espaço que Orsi pediu. O teto de medida é a mesma
          // regra da legenda do ShipmentRoute — texto solto num card de 1552px
          // a 1920px vira uma linha só, longa demais para ser lida.
          <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/40 p-5">
            <p className="portal-small font-medium text-portal-neutral">
              Próxima etapa
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="portal-h3 text-foreground/80">{next.label}</p>
              {next.forecastAt && <ForecastTag iso={next.forecastAt} />}
            </div>
            <p className="portal-body max-w-3xl text-portal-neutral">
              {next.description}
            </p>
            {insights[next.key]?.risk && (
              <div className="flex flex-wrap items-center gap-2">
                <RiskChip risk={insights[next.key]!.risk!} />
                <span className="portal-body max-w-3xl text-portal-neutral">
                  {insights[next.key]!.risk!.rationale}
                </span>
              </div>
            )}
            {insights[next.key]?.scheduleChange && (
              <ScheduleChangeLine change={insights[next.key]!.scheduleChange!} />
            )}
          </div>
        )}
      </div>

      {/* Nível 3 — a jornada inteira no eixo horizontal. Rola no eixo x quando
          não cabe; a etapa atual é centrada na abertura. */}
      <div className="relative">
        {/* Véus nas bordas: o eixo abre centrado na etapa atual, então quase
            sempre há etapa cortada nas pontas — sem o esmaecimento, o corte no
            meio de uma palavra lê como defeito de render, não como "rola". */}
        {edges.left && (
          <span
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent"
            aria-hidden
          />
        )}
        {edges.right && (
          <span
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white to-transparent"
            aria-hidden
          />
        )}
        <div
          ref={railRef}
          className="overflow-x-auto pb-2"
          role="group"
          aria-label="Etapas do embarque"
          onScroll={syncEdges}
        >
          <ol className="flex min-w-max items-stretch">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const insight = insights[step.key];
            const isCurrent = step.status === 'current';
            const isDone = step.status === 'done';
            // Risco só na etapa atual e na próxima (planning da Sprint 13,
            // 18/08/2026). Orsi: "não precisa talvez apontar todos os riscos,
            // talvez só da próxima etapa". Nove semáforos com nove
            // justificativas no eixo era informação demais rodando de verdade —
            // e, com a cascata do atraso confirmado (17/08), sete chips
            // vermelhos seguidos dizendo variações da mesma coisa.
            //
            // O que sai é a EXIBIÇÃO, não o cálculo: `buildStepInsights`
            // continua devolvendo risco para toda etapa não concluída (é o que
            // os dois cards acima consomem, e os testes de step-insights.ts
            // continuam valendo palavra por palavra).
            const showsRisk = index === currentIndex || index === nextIndex;
            return (
              <li
                key={step.key}
                ref={isCurrent ? currentRef : undefined}
                className={cn(
                  'flex shrink-0 flex-col gap-1.5',
                  // Larguras MEDIDAS, não escolhidas no olho: a 1440px o
                  // trilho tem 1070px úteis, e 8 x 112 + 136 = 1032 põe as NOVE
                  // etapas na tela sem rolagem, com ~38px de folga. A folga é de
                  // propósito: com 116/140 dava 1068 em 1070 e qualquer quebra
                  // de rótulo diferente devolvia a barra de rolagem.
                  // Abaixo de 1440px o eixo volta a rolar, e isso continua sendo
                  // o comportamento esperado — o objetivo era reduzir a
                  // necessidade de rolar, não garantir que nunca role.
                  isCurrent ? 'w-[136px]' : 'w-[112px]',
                )}
              >
                <div className="flex items-center">
                  <StepDot status={step.status} emphasis={isCurrent} />
                  {!isLast && (
                    <span
                      className={cn(
                        'h-px flex-1',
                        isDone ? 'bg-portal-success' : 'bg-border',
                      )}
                      aria-hidden
                    />
                  )}
                </div>

                <div
                  className={cn(
                    'space-y-1 pr-3',
                    isDone && 'opacity-60',
                    !isDone && !isCurrent && 'opacity-90',
                  )}
                >
                  {/* Quebra em duas linhas em vez de truncar: "Aguardando
                      prontidão" e "Em análise de booking" não cabem numa linha a
                      112px, e reticências no NOME da etapa tirariam a única
                      coisa que o card ainda diz. */}
                  <p
                    className={cn(
                      isCurrent
                        ? 'portal-body font-semibold text-foreground'
                        : 'portal-small font-medium',
                      isDone && 'text-foreground/80',
                      !isDone && !isCurrent && 'text-portal-neutral',
                    )}
                  >
                    {step.label}
                  </p>

                  {/* A DATA da etapa. Uma linha, um formato por natureza:
                      realizada sai crua ("22 de jul."), prevista sai prefixada
                      ("Previsto: 20 de ago."). O prefixo é a diferença
                      semântica inteira — quem diz "já aconteceu" é o círculo
                      logo acima. A maioria das etapas concluídas não tem data
                      nenhuma, e isso é o correto: ver o cabeçalho de
                      lib/timeline-steps.ts. */}
                  {(step.occurredAt || (step.status === 'pending' && step.forecastAt)) && (
                    <p
                      className="portal-small text-portal-neutral"
                      title={
                        step.occurredAt
                          ? 'Data registrada para esta etapa'
                          : 'Previsão derivada do ETA da companhia'
                      }
                    >
                      {step.occurredAt
                        ? formatShortDate(step.occurredAt)
                        : `Previsto: ${formatShortDate(step.forecastAt!)}`}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Risco reduzido a um PONTO no eixo (18/08/2026): a
                        palavra "Risco alto" e a justificativa continuam nos dois
                        cards de destaque, onde há largura para elas. Aqui o
                        chip com texto era metade da altura do card e mandava no
                        piso de largura de toda a régua. `title` + `aria-label`
                        carregam o rótulo por extenso, porque cor sozinha não é
                        informação para quem não a distingue. */}
                    {showsRisk && insight?.risk && (
                      <span
                        className={cn(
                          'h-2.5 w-2.5 shrink-0 rounded-full',
                          RISK_DOT_CLASS[insight.risk.level],
                        )}
                        title={insight.risk.label}
                        aria-label={insight.risk.label}
                        role="img"
                      />
                    )}
                    {/* Reprogramação: ícone, não parágrafo. A frase inteira
                        (com o motivo) fica no `title` e nos cards de destaque, e
                        o número de dias já está por extenso no indicador de
                        chegada no topo da tela. */}
                    {insight?.scheduleChange && (
                      <span
                        className="inline-flex"
                        title={scheduleChangeText(insight.scheduleChange)}
                        aria-label={scheduleChangeText(insight.scheduleChange)}
                        role="img"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-portal-warning" />
                      </span>
                    )}
                    {/* Um badge para todo o trecho travado: repeti-lo em quatro
                        etapas seguidas diz a mesma coisa quatro vezes. Rótulo
                        curto aqui — a frase completa está no
                        `IncompleteDataNote` no rodapé da seção. */}
                    {step.status === 'blocked' && step.key === blockedKey && (
                      <IncompleteDataBadge label="Sem atualização" />
                    )}
                    {step.isArrival && (
                      <CustomsClearedTag clearance={customsClearance} />
                    )}
                    {insight?.action &&
                      (insight.action.status === 'concluida' ? (
                        <span className="portal-small inline-flex items-center gap-1 rounded border border-portal-success/25 bg-portal-success/10 px-1.5 py-0.5 font-medium text-portal-success">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Concluída
                        </span>
                      ) : (
                        <span className="portal-small inline-flex items-center gap-1 rounded border border-portal-warning/30 bg-portal-warning/10 px-1.5 py-0.5 font-medium text-portal-warning">
                          <BellRing className="h-3.5 w-3.5" />
                          Ação
                        </span>
                      ))}
                  </div>
                </div>
              </li>
            );
          })}
          </ol>
        </div>
      </div>

      {blockedKey && <IncompleteDataNote>{INCOMPLETE_DATA_COPY}</IncompleteDataNote>}
    </div>
  );
}
