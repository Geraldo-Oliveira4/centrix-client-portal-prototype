'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { EmptyState } from '@arboria-tech/arboria-ui';

import {
  PORTAL_CLIENT_ACTION_BUCKETS,
  type PortalBucketKey,
  type PortalQuotation,
  type PortalQuotationsResponse,
} from '@/types/portal';

import { PortalSearchInput } from '../../_shared/portal-search-input';
import {
  V2_STAGE_COLUMN,
  countV2ClientActions,
} from '../../_shared/demo/quotation-review';
import { useQuotationReviewStore } from '../../_shared/demo/use-quotation-review';
import { usePortalModuleReleased } from '../../_shared/demo/use-feature-flags';
import { KanbanColumn } from './kanban-column';
import type { LocalRequest } from '../lib/repeat-model';
import {
  EMPTY_PORTAL_FILTERS,
  PortalFiltersMenu,
  applyPortalFilters,
  type PortalFilterValues,
} from './portal-filters';

/**
 * Funil — the active quotations only. Closed ones (aprovadas, reprovadas,
 * canceladas) live in the Histórico tab, so the funnel reads as work in flight.
 *
 * There is exactly ONE headline number here: how many quotations are waiting on
 * the client. Everything else is secondary text. The previous screen repeated
 * the same counts three times (five equal KPI tiles, two shortlist cards, then
 * the kanban columns); the columns already carry the per-stage counts, so the
 * duplicates are gone.
 */
export function FunnelTab({ data, localRequests = [] }: { data: PortalQuotationsResponse; localRequests?: LocalRequest[] }) {
  const [filters, setFilters] = useState<PortalFilterValues>(EMPTY_PORTAL_FILTERS);
  // `?destaque=<id>` — o cartao que o cliente acabou de enviar. A pagina ja
  // roda dentro de um <Suspense> (ver `cotacoes/page.tsx`), entao ler os
  // parametros aqui nao exige um novo limite.
  const highlightId = useSearchParams().get('destaque');

  // COTACAO V2. `reviews` e `{}` sempre que a flag esta desligada ou a jornada
  // nao comecou, e nesse caso tudo abaixo cai nos mesmos valores de antes:
  // `v2Column` devolve null, o `reduce` nao move cartao nenhum e o contador
  // soma zero. E o que mantem a Onda 0 identica.
  const v2Released = usePortalModuleReleased('cotacaoV2');
  const rawReviews = useQuotationReviewStore();
  const reviews = useMemo(
    () => (v2Released ? rawReviews : {}),
    [v2Released, rawReviews],
  );
  const v2Column = useCallback(
    (id: string) => {
      const stage = reviews[id]?.stage;
      return stage ? V2_STAGE_COLUMN[stage] : null;
    },
    [reviews],
  );

  // O overlay REALOCA o cartao: uma cotacao AGUARDANDO_DADOS no backend pode
  // estar em `entry_review` e pertencer a "Aguardando agentes". A realocacao
  // acontece uma vez, sobre os baldes crus, e todo o resto da tela (contagens,
  // filtros, colunas) le o resultado — duas passagens discordariam no primeiro
  // filtro aplicado.
  const bucketsV2 = useMemo(() => {
    if (Object.keys(reviews).length === 0) return data.buckets;
    const next = Object.fromEntries(
      Object.keys(data.buckets).map((key) => [key, [] as PortalQuotation[]]),
    ) as PortalQuotationsResponse['buckets'];
    for (const [bucket, rows] of Object.entries(data.buckets)) {
      for (const q of rows) {
        const stage = reviews[q.id]?.stage;
        // Etapa SEM coluna (hoje so `approved`) sai do funil: ele e trabalho em
        // curso, e uma cotacao aprovada ja foi para a aba "Aprovadas".
        if (stage && V2_STAGE_COLUMN[stage] == null) continue;
        const target = v2Column(q.id) ?? (bucket as PortalBucketKey);
        (next[target] ??= []).push(q);
      }
    }
    return next;
  }, [data.buckets, reviews, v2Column]);

  const dataV2 = useMemo(
    () => ({ ...data, buckets: bucketsV2 }),
    [data, bucketsV2],
  );

  // "Preencher detalhes" is only shown when Freitas actually asked the client
  // for something — an empty column would read as a permanent pending task.
  const activeBuckets = useMemo(
    () =>
      dataV2.bucket_order.filter(
        (bucket) =>
          bucket !== 'aguardando_dados' || (dataV2.buckets.aguardando_dados?.length ?? 0) > 0 || localRequests.some((r) => r.stage === 'draft'),
      ),
    [dataV2, localRequests],
  );

  const countOf = (bucket: PortalBucketKey) => (dataV2.buckets[bucket]?.length ?? 0) + localRequests.filter((r) => bucket === (r.stage === 'draft' ? 'aguardando_dados' : 'buscando_propostas')).length;
  const localIn = (bucket: PortalBucketKey) => localRequests.filter((r) => {
    if (bucket !== (r.stage === 'draft' ? 'aguardando_dados' : 'buscando_propostas')) return false;
    const contains = (value: string, search: string) => value.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'));
    return contains([r.sourceReference, r.quote.supplier, r.quote.product, r.quote.po].join(' '), filters.query)
      && contains(`${r.quote.origin} ${r.quote.destination}`, filters.route)
      && (!filters.modal || r.quote.manualDraft?.values.modal === filters.modal)
      && (!filters.agent || r.agents.some((agent) => contains(agent, filters.agent)))
      && !filters.pais_procedencia && !filters.peso_taxado_min;
  });

  // COMPOSICAO DOS TRES NUMEROS DO CABECALHO (conferida na fonte em 26/08/2026).
  // Eles nao sao tres recortes independentes: sao um subconjunto e uma soma.
  //
  //   needsAction  ⊂  activeCount        (2 das 3 colunas)
  //   activeCount  +  historyCount  =  data.total
  //
  // 1. `needsAction` = PORTAL_CLIENT_ACTION_BUCKETS (`types/portal.ts`) =
  //    `aguardando_aprovacao` + `aguardando_dados`. Do lado do backend sao os
  //    estados ENVIADA_CLIENTE, APROVADA_PELO_CLIENTE e AGUARDANDO_DADOS
  //    (`shared/domain/portal_buckets.py`). E o unico numero da tela que fala de
  //    quem esta com a bola: as outras cotacoes ativas esperam a Freitas ou os
  //    agentes. Sempre subconjunto de `activeCount`.
  //
  // 2. `activeCount` = soma sobre `data.bucket_order`, que o backend define como
  //    PORTAL_BUCKET_ORDER = as TRES colunas do Funil, nem uma a mais. Nao usa
  //    `activeBuckets` (a lista renderizada) de proposito: aquela esconde
  //    `aguardando_dados` quando vazio, e um bucket vazio soma zero de qualquer
  //    forma — a contagem nao pode depender de quantas colunas foram desenhadas.
  //
  // 3. `data.total` = `len(quotations)` no handler `list_my_quotations`: TUDO que
  //    o cliente tem, sem nenhuma exclusao. Inclui `finalizadas`
  //    (FECHADA + DECLINADA) e `cancelada`, que sao exatamente o conteudo da aba
  //    Historico — e, recortado, das abas Aprovadas e Reprovadas. Ou seja, o
  //    "no total" NAO excluia as resolvidas; ele so nao dizia que as incluia.
  //
  // Por isso o texto abaixo mostra `historyCount` no lugar do total: com "de N
  // ativas" e "M no Historico" as duas relacoes ficam legiveis na propria frase,
  // e o total vira aritmetica do leitor em vez de um quarto numero opaco.
  // Com overlay, "aguardando sua acao" deixa de ser uma soma de BALDES e passa a
  // ser uma contagem de ETAPAS (RQ-6, `countV2ClientActions`): rascunho,
  // devolvida e liberada. As cotacoes sem overlay continuam contadas pelos
  // baldes de sempre, e as duas parcelas nao se sobrepoem porque a segunda
  // desconta exatamente os ids que a primeira ja contou.
  const v2Ids = new Set(Object.keys(reviews));
  const needsAction =
    countV2ClientActions(reviews) +
    PORTAL_CLIENT_ACTION_BUCKETS.reduce(
      (sum, bucket) =>
        sum +
        (dataV2.buckets[bucket] ?? []).filter((q) => !v2Ids.has(q.id)).length,
      0,
    ) +
    localRequests.filter((r) => r.stage === 'draft').length;
  const activeCount = dataV2.bucket_order.reduce((sum, bucket) => sum + countOf(bucket), 0);
  // Mesma derivacao que `cotacoes/page.tsx` usa para o badge da aba Historico
  // (`finalizadas` + `cancelada`), para os dois numeros nunca discordarem.
  const historyCount = countOf('finalizadas') + countOf('cancelada');

  const filteredBuckets = useMemo(
    () =>
      Object.fromEntries(
        activeBuckets.map((bucket) => [
          bucket,
          applyPortalFilters(dataV2.buckets[bucket] ?? [], filters),
        ]),
      ) as Record<PortalBucketKey, ReturnType<typeof applyPortalFilters>>,
    [activeBuckets, dataV2, filters],
  );

  const filteredTotal = activeBuckets.reduce(
    (sum, bucket) => sum + (filteredBuckets[bucket]?.length ?? 0) + localIn(bucket).length,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-3xl font-semibold leading-none text-foreground">
            {needsAction}
          </p>
          <p className="portal-body font-medium text-foreground">
            {needsAction === 1
              ? 'cotação aguardando sua ação'
              : 'cotações aguardando sua ação'}
          </p>
          <p className="portal-small text-portal-neutral">
            de {activeCount} {activeCount === 1 ? 'ativa' : 'ativas'} no funil ·{' '}
            {historyCount}{' '}
            {historyCount === 1 ? 'já resolvida' : 'já resolvidas'} no Histórico
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PortalSearchInput
            value={filters.query}
            onChange={(query) => setFilters((prev) => ({ ...prev, query }))}
            placeholder="Fornecedor, PO, cotação ou carga…"
            label="Buscar cotação por fornecedor, PO, referência ou carga"
          />
          <PortalFiltersMenu values={filters} onChange={setFilters} />
        </div>
      </div>

      {activeCount === 0 ? (
        <EmptyState message="Nenhuma cotação em andamento. As cotações fechadas ficam na aba Histórico." />
      ) : filteredTotal === 0 ? (
        <EmptyState message="Nenhuma cotação corresponde à busca ou aos filtros aplicados." />
      ) : (
        <div className="flex gap-5 overflow-x-auto pb-5">
          {activeBuckets.map((bucket) => (
            <KanbanColumn
              key={bucket}
              bucket={bucket}
              quotations={filteredBuckets[bucket] ?? []}
              localRequests={localIn(bucket)}
              reviews={reviews}
              highlightId={highlightId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
