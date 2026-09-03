'use client';

import { useMemo } from 'react';
import { LoaderComponent, ErrorComponent } from '@arboria-tech/arboria-ui';

import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { useMyShipments } from '@/hooks/use-portal-shipments';

import { PortalTabHeader } from '../components/portal-tab-header';
import { REAL_STEPS } from '../embarques/lib/real-steps';
import { TowerColumn } from './components/tower-column';
import { buildControlTower } from './lib/control-tower';

/**
 * Visão Geral — a Torre de Controle do cliente.
 *
 * TRÊS SINAIS NA TELA, e só três (regra dos 5 segundos): o farol combinado no
 * cabeçalho, "Aguardando sua ação" e "Precisam de atenção". Nada de KPI, gráfico
 * ou atalho extra aqui — quem quiser o quarto número tem uma tela para ele.
 *
 * SEM ENDPOINT NOVO. As mesmas duas chaves SWR do resto do portal
 * (`/portal/quotations` e `/portal/shipments`), deduplicadas — abrir esta tela
 * não custa um fetch a mais do que abrir a Home.
 *
 * SEM CÁLCULO NOVO. A classificação inteira é `lib/control-tower.ts`, que
 * consome `collectHomeActions` (o `needsAction` do Funil + os `StepAction`
 * pendentes da timeline) e `delayRiskFromTracking`. Esta página é composição:
 * uma leitura de relógio, um helper, dois componentes.
 *
 * IMUTÁVEL, de propósito: sem toggle, sem ordenação escolhida pelo cliente, sem
 * personalização. A mesma estrutura para todo cliente é o que faz a Freitas
 * poder dizer ao telefone "olha a primeira coluna" e acertar.
 */
export default function PortalControlTowerPage() {
  const { shipments, isLoading: loadingShipments, isError: shipmentsError } =
    useMyShipments();
  const { data, isLoading: loadingQuotations, isError: quotationsError } =
    useMyQuotations();

  // Uma leitura de relógio por render, compartilhada pela saudação do cabeçalho
  // e pelos prazos das ações — a mesma disciplina da Home.
  const now = useMemo(() => new Date(), []);

  const tower = useMemo(
    () =>
      buildControlTower({
        shipments,
        buckets: data?.buckets ?? {},
        bucketOrder: data?.bucket_order ?? [],
        realSteps: REAL_STEPS,
        now,
      }),
    [shipments, data, now],
  );

  if (loadingShipments || loadingQuotations) return <LoaderComponent />;
  if (shipmentsError || quotationsError) return <ErrorComponent />;

  const pending = tower.awaiting.length + tower.attention.length;

  return (
    <div className="space-y-8">
      <PortalTabHeader
        now={now}
        beacons={tower.beacons}
        headline={
          pending === 0 ? (
            'Nada precisa da sua atenção agora.'
          ) : (
            <>
              <span className="text-portal-warning">{pending}</span>{' '}
              {pending === 1
                ? 'item precisa da sua atenção'
                : 'itens precisam da sua atenção'}
            </>
          )
        }
        support={`Cotações e embarques em aberto: ${tower.total}`}
      />

      {/* Duas colunas de mesmo peso. Abaixo de `lg` empilham, e "Aguardando sua
          ação" fica em cima — é o grid fazendo o certo, não uma exceção. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TowerColumn
          title="Aguardando sua ação"
          hint="A bola está com você: nada anda até você responder."
          items={tower.awaiting}
          emptyMessage="Nada depende de você agora. Assim que uma proposta, um booking ou um documento precisar da sua resposta, ele aparece aqui."
          />
        <TowerColumn
          title="Precisam de atenção"
          hint="A bola está com a Freitas ou com a companhia marítima, mas você precisa saber."
          items={tower.attention}
          emptyMessage="Nenhum embarque com a chegada movida para depois da primeira previsão da companhia marítima."
        />
      </div>
    </div>
  );
}
