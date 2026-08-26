'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LoaderComponent, ErrorComponent } from '@arboria-tech/arboria-ui';

import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { useMyShipments } from '@/hooks/use-portal-shipments';

import { PagePortalHeader, SectionHeading } from '../_shared/page-header';
import { REAL_STEPS } from '../embarques/lib/real-steps';
import { flattenQuotations } from '../inteligencia/lib/intel-helpers';
import {
  computeIllustrativeSavings,
  computeSavingsTrend,
} from '../inteligencia/lib/illustrative-kpis';
import { ActionList } from './components/action-list';
import { SavingsCard } from './components/savings-card';
import { StatusBeaconCard } from './components/status-beacon-card';
import { buildHomeActions } from './lib/home-actions';

/**
 * Home do Portal do Cliente — a tela que responde três perguntas, nesta ordem:
 * "está tudo bem?", "isto está valendo a pena?" e "o que depende de mim?".
 *
 * SEM ENDPOINT NOVO. Tudo sai de `/portal/quotations` e `/portal/shipments`, as
 * duas chaves SWR que o resto do portal já usa — então abrir a Home não custa um
 * fetch a mais do que abrir Meus Embarques, e nenhum número daqui pode discordar
 * das telas de destino, porque é o mesmo payload.
 *
 * NENHUM CÁLCULO NOVO. Cada bloco importa a fonte que já existia:
 *   - farol         -> `countBySemaforo` (o mesmo do "Visão do todo" do Mapa)
 *   - economia      -> `illustrative-kpis` (fonte ÚNICA, com Performance e Executivo)
 *   - ações         -> `lib/home-actions`, que roda a pipeline da tela de
 *                      detalhe do embarque + os baldes de ação do Funil
 *   - rodapé        -> `buscando_propostas`, a coluna "Aguardando agentes"
 *
 * A Home é ponto de COMPOSIÇÃO, como `embarques/[id]/page.tsx`: os helpers são
 * puros e testados, e rodam uma vez cada.
 */
export default function PortalHomePage() {
  const { shipments, isLoading: loadingShipments, isError: shipmentsError } =
    useMyShipments();
  const { data, isLoading: loadingQuotations, isError: quotationsError } =
    useMyQuotations();

  // UMA leitura de relógio por render, compartilhada pelo corte de mês da
  // economia e pelos prazos das ações. Duas chamadas a `new Date()` podem cair
  // em dias diferentes na virada da meia-noite, e aí "Expira hoje" discordaria
  // do mês que a economia soma. Mesma disciplina do detalhe do embarque.
  const now = useMemo(() => new Date(), []);

  const quotations = useMemo(() => flattenQuotations(data), [data]);

  const actions = useMemo(
    () =>
      buildHomeActions({
        shipments,
        buckets: data?.buckets ?? {},
        realSteps: REAL_STEPS,
        now,
      }),
    [shipments, data, now],
  );

  const savings = useMemo(
    () => computeIllustrativeSavings(quotations),
    [quotations],
  );
  const trend = useMemo(
    () => computeSavingsTrend(quotations, now),
    [quotations, now],
  );

  // "Aguardando retorno" = o balde `buscando_propostas`, a coluna "Aguardando
  // agentes" do Funil. É deliberadamente o COMPLEMENTO das ações acima: lá está
  // o que depende do cliente, aqui o que depende do agente. Por isso vive no
  // rodapé, como link discreto, e não como uma sexta linha de ação.
  const awaitingAgents = data?.buckets.buscando_propostas?.length ?? 0;

  if (loadingShipments || loadingQuotations) return <LoaderComponent />;
  if (shipmentsError || quotationsError) return <ErrorComponent />;

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Início"
        subtitle="O que precisa de você hoje, e como sua operação está indo."
      />

      {/* Primeira dobra: farol e economia lado a lado, mesma largura e mesmo
          peso. Abaixo de `lg` empilham — é o grid fazendo o certo, não exceção. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <StatusBeaconCard shipments={shipments} />
        <SavingsCard savings={savings} trend={trend} />
      </div>

      <section className="space-y-4">
        <SectionHeading
          title="Ações necessárias"
          hint={
            actions.total === 0
              ? undefined
              : `${actions.total} ${actions.total === 1 ? 'pendência' : 'pendências'}`
          }
        />
        <ActionList actions={actions.actions} total={actions.total} />
      </section>

      {/* Rodapé: atalhos em texto simples, nunca cards. São links para onde a
          resposta mora, e um card aqui competiria em peso com as ações acima —
          que são a única coisa desta tela que exige alguma coisa do cliente. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-4">
        <Link
          href="/portal/cotacoes"
          className="portal-small inline-flex items-center gap-1 text-portal-neutral hover:text-foreground hover:underline"
        >
          Cotações aguardando retorno ({awaitingAgents})
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/portal/inteligencia/radar"
          className="portal-small inline-flex items-center gap-1 text-portal-neutral hover:text-foreground hover:underline"
        >
          Radar de preços
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
