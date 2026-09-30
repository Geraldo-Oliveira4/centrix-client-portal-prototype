'use client';

import Link from 'next/link';

import { usePortalModuleReleased } from '../../_shared/demo/use-feature-flags';
import { ArrowRight } from 'lucide-react';
import { InsightLine } from '../../_shared/insight-line';
import { variationOf } from '../../_shared/insight';

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

      {/* INSIGHT (30/09/2026): selo de variacao + frase. Queda de economia
          NAO e vermelho (`badTone: 'neutral'`): o vermelho do portal fala de
          prazo e custo correndo, e pintar um KPI comercial com ele leria como
          embarque em risco. Sem mes anterior com base nao ha variacao. */}
      <InsightLine
        className="border-t border-dashed pt-4"
        variation={
          trend
            ? variationOf(trend.currentBRL, trend.previousBRL || null, {
                kind: 'pct',
                higherIsBetter: true,
                previousLabel: 'o mês passado',
                badTone: 'neutral',
              })
            : null
        }
        sentence={
          monthly
            ? trend.previousBRL > 0
              ? `Você economizou ${formatBRL(trend.currentBRL)} este mês nas cotações fechadas com a Freitas; no mês passado foram ${formatBRL(trend.previousBRL)}.`
              : `Você economizou ${formatBRL(trend.currentBRL)} este mês. Não houve fechamento no mês passado para comparar.`
            : 'Sem fechamento nos últimos dois meses: o valor acima é o acumulado.'
        }
      />

      <DetailLink />
    </section>
  );
}

function DetailLink() {
  // O NUMERO fica: ele sai das cotacoes do cliente, nao da Inteligencia. Some so
  // o LINK, que apontaria para um modulo que esta empresa nao tem — e que o menu
  // acabou de esconder.
  const released = usePortalModuleReleased('inteligencia');
  if (!released) return null;
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
