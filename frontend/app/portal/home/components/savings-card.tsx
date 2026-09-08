'use client';

import Link from 'next/link';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatBRL } from '@/lib/portal-formatters';
import type {
  IllustrativeSavings,
  SavingsTrend,
} from '../../inteligencia/lib/illustrative-kpis';

/**
 * Card de economia — o par do farol na primeira dobra, mesma largura e mesmo
 * peso visual.
 *
 * NADA É CALCULADO AQUI. Os dois números chegam prontos de
 * `inteligencia/lib/illustrative-kpis.ts`, que é a fonte ÚNICA de economia do
 * portal desde 12/08/2026 — Performance e Executivo leem de lá, e a Home passou
 * a ler também. Um cálculo próprio nesta tela reabriria exatamente o conflito
 * que zerou o número nas duas telas em 05/08/2026 (uma dizia "não temos como
 * saber", a outra dava um valor em reais). Quando a fonte real existir, troca-se
 * `SAVINGS_PCT` lá e este componente não muda uma linha.
 *
 * O NÚMERO GRANDE É O DO MÊS, e não o acumulado, porque o badge ao lado dele
 * compara MESES. A primeira versão mostrava o acumulado com "−100% vs. mês
 * passado" embaixo: as duas afirmações eram verdadeiras e falavam de janelas
 * diferentes, e a leitura imediata era que a economia acumulada tinha caído
 * 100%. Uma pergunta, uma janela — o acumulado continua na tela, como apoio.
 *
 * A DIVISÃO DO QUE É REAL: a base (o que o cliente fechou) é real e a variação
 * mês a mês também — como o percentual é constante, `deltaPct` é a variação do
 * volume fechado de verdade. Ilustrativo é o valor absoluto em reais. Sem selo
 * de proveniência, seguindo a filosofia vigente do portal para dado rico.
 */
export function SavingsCard({
  savings,
  trend,
}: {
  savings: IllustrativeSavings | null;
  trend: SavingsTrend | null;
}) {
  // Sem nenhuma cotação fechada não há base para multiplicar. "R$ 0" aqui seria
  // uma afirmação ("você não economizou nada"), e não uma lacuna.
  if (!savings) {
    return (
      <section className="portal-card flex flex-col gap-5 p-6">
        <div className="space-y-1">
          <p className="portal-small font-medium uppercase tracking-wide text-portal-neutral">
            Economia gerada
          </p>
          <p className="portal-h2">Ainda sem cotação fechada.</p>
          <p className="portal-small text-portal-neutral">
            A economia aparece assim que a primeira cotação for aprovada.
          </p>
        </div>
        <DetailLink />
      </section>
    );
  }

  // `trend` é null quando nem este mês nem o anterior tiveram fechamento — há
  // histórico, mas nada nos dois meses que o badge compara. Aí o card volta a
  // falar do acumulado, sem badge: comparar sem ponto de partida seria inventar.
  const monthly = trend != null;

  return (
    <section className="portal-card flex flex-col gap-5 p-6">
      <div className="space-y-1">
        <p className="portal-small font-medium uppercase tracking-wide text-portal-neutral">
          Economia gerada{' '}
          <span className="normal-case tracking-normal">
            {monthly ? '· este mês' : '· acumulada'}
          </span>
        </p>
        <p className="text-4xl font-semibold leading-none text-foreground">
          {formatBRL(monthly ? trend.currentBRL : savings.savingsBRL)}
        </p>
        <p className="portal-small text-portal-neutral">
          {monthly
            ? `Acumulado: ${formatBRL(savings.savingsBRL)} sobre ${formatBRL(
                savings.baseBRL,
              )} fechados com a Freitas`
            : `sobre ${formatBRL(savings.baseBRL)} fechados com a Freitas`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-dashed pt-4">
        {/* O badge só aparece quando existe mês anterior com base. Sem ponto de
            partida não há "variação", e um "+100%" ali seria inventado. */}
        {trend?.deltaPct != null ? (
          <span
            className={cn(
              'portal-small inline-flex items-center gap-1 rounded border px-2 py-0.5 font-medium',
              trend.deltaPct >= 0
                ? 'border-portal-success/25 bg-portal-success/10 text-portal-success'
                : // Queda de economia NÃO é vermelho: o semáforo do portal fala
                  // de saúde de carga, e pintar um KPI comercial com ele leria
                  // como embarque em risco.
                  'border-portal-neutral/30 bg-muted text-portal-neutral',
            )}
          >
            {trend.deltaPct >= 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {trend.deltaPct >= 0 ? '+' : ''}
            {trend.deltaPct}% vs. mês passado
          </span>
        ) : (
          <span className="portal-small text-portal-neutral">
            {monthly
              ? 'Sem fechamento no mês passado para comparar.'
              : 'Sem fechamento nos últimos dois meses.'}
          </span>
        )}
        {trend != null && trend.previousBRL > 0 ? (
          <span className="portal-small text-portal-neutral">
            mês passado: {formatBRL(trend.previousBRL)}
          </span>
        ) : null}
      </div>

      <DetailLink />
    </section>
  );
}

function DetailLink() {
  return (
    <Link
      href="/portal/inteligencia/performance"
      className="portal-small mt-auto inline-flex items-center gap-1 self-start font-medium text-brand-indigo hover:underline"
    >
      Ver detalhamento
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
