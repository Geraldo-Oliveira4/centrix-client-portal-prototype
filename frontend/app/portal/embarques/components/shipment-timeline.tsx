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
import { formatShipmentEta } from '../lib/shipment-date';
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
 *   2. Etapa atual (dominante) + próxima etapa (secundária), lado a lado. O
 *      risco e a justificativa por extenso vivem SÓ no card da próxima etapa —
 *      ver o comentário no JSX do card da etapa atual.
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
 * Última rodada do mesmo planning: o card da ETAPA ATUAL perdeu o chip de risco
 * e a justificativa. Risco é sobre o que ainda pode dar errado, e a etapa atual
 * já está em andamento; o que ela exige do cliente, quando exige, já é dito
 * pela faixa "Ação necessária" do nível 1. O card da PRÓXIMA etapa fica
 * intacto — é ali que a pergunta "o próximo passo vai ser tranquilo?" tem
 * resposta útil.
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
  moderate: 'border-portal-warning/30 bg-portal-warning/10 text-portal-warning-ink',
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
          // O check e icone sobre preenchimento solido: alvo nao-textual, 3:1.
          // Branco sobre o verde do escuro (#21B06E) da 2.81 e reprova; navy da
          // 5.4 — a mesma regra do guia para tinta sobre laranja. Na luz nada
          // muda (branco sobre #1E9E63, 3.43).
          'flex shrink-0 items-center justify-center rounded-full bg-portal-success text-white dark:text-brand-navy',
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
          // `bg-card`, nao `bg-white`: e o mesmo branco na luz e a superficie
          // elevada #23253F no escuro. Vale para os tres `bg-card` deste
          // arquivo — os dois circulos de etapa e o cartao da etapa atual, que
          // hospeda um `.portal-h2`. Com o branco cravado aquele titulo ficava
          // indigo-300 sobre branco: 1.70:1, ilegivel.
          'flex shrink-0 items-center justify-center rounded-full border-2 border-portal-success bg-card ring-4 ring-portal-success/15',
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
        'flex shrink-0 items-center justify-center rounded-full border border-border bg-card',
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
      <CalendarClock className="h-4 w-4" />
      Previsto: {formatShipmentEta(iso)}
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
    <p className={cn('portal-small text-portal-warning-ink', className)}>
      {scheduleChangeText(change)}
    </p>
  );
}

/** "✓ Desembaraçado" — etiqueta na Chegada, não degrau. Ver CustomsClearance. */
function CustomsClearedTag({ clearance }: { clearance?: CustomsClearance | null }) {
  if (!clearance?.clearedAt) return null;
  return (
    <span className="portal-small inline-flex items-center gap-1 rounded border border-portal-success/25 bg-portal-success/10 px-1.5 py-0.5 font-medium text-portal-success">
      <ShieldCheck className="h-4 w-4" />
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
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-portal-success" />
      ) : (
        <BellRing className="mt-0.5 h-6 w-6 shrink-0 text-portal-warning-ink" />
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="portal-h3">{action.title}</p>
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
          <Icon className="h-5 w-5" />
          {action.ctaLabel}
        </Button>
      )}
    </div>
  );
}

/**
 * Largura de um degrau da régua, em px. Não é estética solta: a 1440px o trilho
 * tem 1070px úteis, e 8 x 112 + 136 = 1032 põe as nove etapas na tela sem
 * rolagem com ~38px de folga. Elas vivem aqui como NÚMERO, e não como classe
 * Tailwind, porque o componente precisa somá-las para decidir se cabe — duas
 * cópias do mesmo valor (uma no CSS, outra na conta) divergiriam no primeiro
 * ajuste de largura.
 */
const STEP_WIDTH = 112;
const STEP_WIDTH_CURRENT = 136;

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
  // Largura real do trilho, observada. É o que decide entre os dois modos da
  // régua (ver `fills`), e por isso é medida em vez de inferida de breakpoint:
  // a barra lateral do portal colapsa, e um `lg:` fixo diria "cabe" numa tela
  // de 1440px com a lateral aberta e "não cabe" na mesma tela com ela fechada,
  // ou o contrário.
  const [railWidth, setRailWidth] = useState(0);
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

  // Modo da régua, medido a cada resize:
  //
  //   cabe   -> os degraus CRESCEM e a régua ocupa 100% do card, com o primeiro
  //             círculo na borda esquerda e o último na direita;
  //   não cabe -> largura fixa por degrau e rolagem no trilho, exatamente o
  //             comportamento validado antes — nada de espremer nove etapas
  //             numa tela de celular.
  //
  // `railWidth` nasce 0 (nada foi medido ainda), então o primeiro render é
  // sempre o modo com rolagem: na dúvida, o que não deforma nada.
  const naturalWidth = steps.reduce(
    (sum, step) =>
      sum + (step.status === 'current' ? STEP_WIDTH_CURRENT : STEP_WIDTH),
    0,
  );
  const fills = railWidth > 0 && railWidth >= naturalWidth;

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    setRailWidth(rail.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width != null) setRailWidth(width);
    });
    observer.observe(rail);
    return () => observer.disconnect();
  }, []);

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
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-portal-danger" />
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

      {/* Nível 2 — etapa atual dominante (2/3), próxima etapa secundária (1/3),
          LADO A LADO.

          Foram empilhados por uma rodada (18/08) para resolver um scroll
          horizontal de página que, medido depois em 15 larguras de 320 a
          1920px, não existia: o único overflow encontrado era do header do
          portal a 320px, que não tem relação com estes cards. Empilhado, os
          dois blocos somavam quase uma dobra inteira de altura antes de a
          régua aparecer, e a leitura ficou pesada — que é o problema oposto ao
          que a mudança tentava resolver.

          Voltando lado a lado, a próxima etapa volta a ter um terço da largura,
          e por isso o texto dela volta ao tamanho compacto (`portal-small`) que
          tinha antes: o `portal-body` foi consequência da largura inteira, não
          uma decisão de conteúdo. É lado a lado MINIMALISTA — o conteúdo é o
          mesmo, o volume visual é menor, mesma disciplina que a régua recebeu.

          `lg:` e não `sm:`: abaixo de 1024px as duas colunas espremeriam a
          justificativa de risco a três palavras por linha, então ali elas
          empilham de novo — que é o comportamento natural do grid, não uma
          exceção. */}
      <div
        className={cn(
          'grid gap-4 lg:grid-cols-3',
          !current && !next && 'hidden',
        )}
      >
        {current && (
          <div
            className={cn(
              'space-y-3 rounded-xl border border-portal-success/30 bg-card p-5',
              // Na última etapa não há próxima: sem isto o painel fica com um
              // terço de branco ao lado dele.
              next ? 'lg:col-span-2' : 'lg:col-span-3',
            )}
          >
            <span className="portal-small inline-flex items-center rounded border border-portal-success/25 bg-portal-success/10 px-1.5 py-0.5 font-medium text-portal-success">
              Etapa atual
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="portal-h2">{current.label}</h3>
              {current.isArrival && (
                <CustomsClearedTag clearance={customsClearance} />
              )}
            </div>
            <p className="portal-body text-foreground/80">{current.description}</p>
            {/* SEM risco aqui, de propósito (planning da Sprint 13, 18/08/2026,
                mesma fala do Orsi que cortou os riscos do eixo). Risco é sobre o
                que ainda PODE dar errado; a etapa atual já está ACONTECENDO — o
                cliente não precisa de alerta sobre o que já está em curso,
                precisa saber se o PRÓXIMO passo vai ser tranquilo ou não. Por
                isso o chip e a justificativa ficam só no card da próxima etapa.

                Quando a etapa atual realmente exige algo do cliente, quem diz
                isso é a faixa "Ação necessária" logo acima (nível 1), que é
                acionável em vez de probabilística; o chip de risco ao lado dela
                seria a mesma informação dita duas vezes, uma delas sem saída.

                Sai a EXIBIÇÃO, não o cálculo: `buildStepInsights` continua
                devolvendo `risk` para toda etapa não concluída, e os testes de
                step-insights.ts continuam valendo palavra por palavra. */}
            {insights[current.key]?.scheduleChange && (
              <ScheduleChangeLine change={insights[current.key]!.scheduleChange!} />
            )}
          </div>
        )}

        {next && (
          // Um terço da largura: texto em `portal-small` e risco EMPILHADO sob
          // o chip (não ao lado dele, como na etapa atual). Numa coluna de
          // ~330px o par chip + frase na mesma linha deixa a justificativa com
          // três palavras por linha ao lado de um chip solto.
          <div
            className={cn(
              'space-y-2 rounded-xl border border-dashed border-border bg-muted/40 p-4',
              !current && 'lg:col-span-3',
            )}
          >
            <p className="portal-small font-medium text-portal-neutral">
              Próxima etapa
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="portal-h3 text-foreground/80">{next.label}</p>
              {next.forecastAt && <ForecastTag iso={next.forecastAt} />}
            </div>
            <p className="portal-small text-portal-neutral">{next.description}</p>
            {insights[next.key]?.risk && (
              <div className="space-y-1">
                <RiskChip risk={insights[next.key]!.risk!} />
                <p className="portal-small text-portal-neutral">
                  {insights[next.key]!.risk!.rationale}
                </p>
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
          {/* `min-w-max` só no modo com rolagem: no modo preenchido ele
              brigaria com o crescimento dos degraus, medindo o eixo pelo
              max-content dos rótulos em vez de pela largura do trilho. */}
          <ol className={cn('flex items-stretch', !fills && 'min-w-max')}>
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
            const base = isCurrent ? STEP_WIDTH_CURRENT : STEP_WIDTH;
            // O ÚLTIMO degrau do modo preenchido é ESPELHADO: largura fixa como
            // sempre, mas o círculo encostado na direita da própria célula
            // (`items-end`) e o rótulo alinhado por ela. É o que leva o último
            // ponto até a borda do quadro — nove células iguais com o ponto na
            // esquerda de cada uma deixariam o nono a 8/9 da largura, que é
            // exatamente o vão sobrando que motivou esta mudança.
            //
            // Ele NÃO cresce junto com os outros oito, e isso é o que impede a
            // colisão: dar a ele a largura do próprio círculo e deixar o rótulo
            // transbordar para a esquerda sobrepunha "Previsto: 17 de set." em
            // cima de "Previsto: 14 de set." da etapa anterior. Com a célula
            // inteira reservada, o rótulo só ocupa espaço que já é dele.
            const isFilledLast = fills && isLast;
            const flexStyle =
              fills && !isLast
                ? { flex: `1 0 ${base}px` }
                : { flex: `0 0 ${base}px` };
            return (
              <li
                key={step.key}
                ref={isCurrent ? currentRef : undefined}
                style={flexStyle}
                className={cn(
                  'flex flex-col gap-1.5',
                  isFilledLast && 'items-end',
                )}
              >
                <div className="flex w-full items-center">
                  {/* Espelhado, o traço vem ANTES do círculo — sem isso a régua
                      abriria um vão entre a penúltima etapa e o último ponto,
                      que agora vive na outra ponta da própria célula. A cor
                      segue a etapa ANTERIOR, que é quem desenharia este trecho
                      no modo normal. */}
                  {isFilledLast && (
                    <span
                      className={cn(
                        'h-px flex-1',
                        steps[index - 1]?.status === 'done'
                          ? 'bg-portal-success'
                          : 'bg-border',
                      )}
                      aria-hidden
                    />
                  )}
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
                    'space-y-1',
                    isFilledLast ? 'w-full pl-3 text-right' : 'pr-3',
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
                        : `Previsto: ${formatShipmentEta(step.forecastAt!)}`}
                    </p>
                  )}

                  <div
                    className={cn(
                      'flex flex-wrap items-center gap-1.5',
                      isFilledLast && 'justify-end',
                    )}
                  >
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
                        <AlertTriangle className="h-4 w-4 shrink-0 text-portal-warning-ink" />
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
                          <CheckCircle2 className="h-4 w-4" />
                          Concluída
                        </span>
                      ) : (
                        <span className="portal-small inline-flex items-center gap-1 rounded border border-portal-warning/30 bg-portal-warning/10 px-1.5 py-0.5 font-medium text-portal-warning-ink">
                          <BellRing className="h-4 w-4" />
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
