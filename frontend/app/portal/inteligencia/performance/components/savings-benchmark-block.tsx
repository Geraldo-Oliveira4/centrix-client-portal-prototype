'use client';

import { Landmark, TrendingDown } from 'lucide-react';

import { formatBRL } from '@/lib/portal-formatters';

import { SectionHeading } from '../../../_shared/page-header';
import { ProvenanceBadge } from '../../../_shared/provenance-badge';
import type { IllustrativeSavings } from '../../lib/illustrative-kpis';

/**
 * "Economia e Benchmark" — ESTRUTURA APENAS. Nenhum cálculo, nem função pura.
 *
 * As três perguntas do bloco dependem de dado que não existe em lugar nenhum
 * deste repositório, e cada uma por um motivo diferente:
 *
 *   1. Savings vs. a PRIMEIRA proposta recebida — o payload da listagem expõe
 *      só a `best_proposal` de cada cotação. A série completa de propostas, com
 *      ordem de chegada, não vem; sem ela não há "primeira" contra a qual
 *      comparar.
 *   2. Posição vs. mercado — não há base de preços de mercado. É o bloqueador do
 *      Data Lake, fora do escopo deste protótipo.
 *   3. Operações semelhantes anteriores — depende de histórico agregado por rota
 *      com preço comparável, que é o mesmo Data Lake.
 *
 * POR QUE NÃO TEM FUNÇÃO PURA AQUI, ao contrário dos outros dois blocos novos:
 * `computeRouteDeviations` e `computeCarrierUsage` calculam sobre dado que já
 * existe e só falta volume — escrevê-las agora é trabalho aproveitado. Aqui não
 * há dado de origem nenhum, então uma função pura seria uma assinatura vazia
 * esperando um formato que ninguém definiu, e ela envelheceria errada.
 *
 * ESTE BLOCO SUBSTITUIU o antigo "Economia estimada" (`savings-block.tsx`), que
 * exibia `Σ(fechadas.total_brl) × 0.08` sob selo `preview`. Os dois responderiam
 * a MESMA pergunta com respostas contraditórias na mesma tela — um número em
 * reais e um "não temos como saber" —, e é a repetição do erro já corrigido no
 * card "Rastreamento marítimo" dos embarques: uma tela, uma resposta por
 * pergunta. Entre um número fabricado e a ausência honesta, o portal escolhe a
 * ausência. Não reintroduza o número dos 8%: aquele fator continua vivo no
 * `MarketBlock` do detalhe da cotação, que é outra tela e outro contexto.
 */
export function SavingsBenchmarkBlock({
  savings,
}: {
  savings: IllustrativeSavings | null;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-dashed border-border bg-muted/20 p-6">
      <SectionHeading
        title="Economia e Benchmark"
        hint="quanto você economiza e como isso se compara ao mercado"
        icon={<TrendingDown className="h-6 w-6" />}
        action={<ProvenanceBadge provenance="preview" />}
      />

      <dl className="space-y-4">
        <div className="space-y-1 border-b border-dashed pb-4">
          <dt className="portal-body font-medium text-foreground">
            Savings acumulado
          </dt>
          {/* O valor vem de `computeIllustrativeSavings`, a MESMA função que o
              KPI "Economia" do Executivo consome. Se este número e o de lá
              divergirem, é porque alguém recalculou num dos dois — foi
              exatamente o problema corrigido em 05/08/2026. */}
          {savings && (
            <dd className="flex flex-wrap items-baseline gap-x-2 pt-1">
              <span className="text-2xl font-semibold leading-none text-portal-success">
                {formatBRL(savings.savingsBRL)}
              </span>
              <span className="portal-small text-portal-neutral">
                ~{Math.round(savings.pct * 100)}% sobre {formatBRL(savings.baseBRL)}{' '}
                fechados
              </span>
            </dd>
          )}
          <dd className="portal-body text-portal-neutral">
            Quanto suas escolhas economizaram em relação à primeira proposta
            recebida em cada cotação.
          </dd>
          <dd className="portal-small text-portal-neutral">
            Depende da série completa de propostas por cotação — o portal recebe
            hoje apenas a melhor de cada uma, sem ordem de chegada.
          </dd>
        </div>

        <div className="space-y-1 border-b border-dashed pb-4">
          <dt className="portal-body font-medium text-foreground">
            Posição vs. mercado
          </dt>
          <dd className="portal-body text-portal-neutral">
            Se o preço que você paga hoje está acima ou abaixo do praticado no
            setor para a mesma rota.
          </dd>
          <dd className="portal-small text-portal-neutral">
            Depende de uma base de preços de mercado. Não existe neste
            protótipo — nenhum percentual é estimado no lugar.
          </dd>
        </div>

        <div className="space-y-1">
          <dt className="portal-body font-medium text-foreground">
            Operações semelhantes anteriores
          </dt>
          <dd className="portal-body text-portal-neutral">
            Dois ou três embarques históricos da mesma rota, para comparar preço
            e prazo com o que está sendo cotado agora.
          </dd>
          <dd className="portal-small text-portal-neutral">
            Depende de histórico agregado por rota com preço comparável.
          </dd>
        </div>
      </dl>

      <p className="inline-flex items-start gap-1.5 portal-small border-t border-dashed pt-3 text-portal-neutral">
        <Landmark className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Bloco em construção: a estrutura está definida, os números chegam com o
          Data Lake. Enquanto a fonte não existe, o portal prefere não mostrar
          nada a mostrar uma estimativa que você não teria como conferir.
        </span>
      </p>
    </section>
  );
}
