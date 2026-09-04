'use client';

import { useMemo } from 'react';
import { LoaderComponent, ErrorComponent } from '@arboria-tech/arboria-ui';

import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { useMyShipments } from '@/hooks/use-portal-shipments';
import { formatLongDate } from '@/lib/portal-formatters';
import { countBySemaforo } from '@/types/portal-shipment';

import { SemaforoChips } from '../_shared/semaforo-chips';
import { REAL_STEPS } from '../embarques/lib/real-steps';
import { TowerColumn } from './components/tower-column';
import { buildControlTower } from './lib/control-tower';

/**
 * Visão Geral — a Torre de Controle do cliente.
 *
 * CABEÇALHO BRANCO, sem card escuro em volta: o bloco navy é da Home, onde ele
 * substitui a sidebar. Aqui a sidebar está de volta, e um segundo bloco de marca
 * competiria com ela. Título preto, subtítulo com a data, farol em chips numa
 * linha — tudo sobre o fundo da página.
 *
 * TRÊS SINAIS NA TELA, e só três (regra dos 5 segundos): o farol,
 * "Aguardando sua ação" e "Precisam de atenção". Nada de KPI, gráfico ou atalho
 * extra — quem quiser o quarto número tem uma tela para ele.
 *
 * O FAROL E AS COLUNAS RESPONDEM COISAS DIFERENTES, e por isso saem de fontes
 * diferentes, de propósito:
 *
 *   - o FAROL é `countBySemaforo` — quantas operações estão em cada nível de
 *     RISCO (verde/laranja/vermelho). É o mesmo número do "Visão do todo" do
 *     Mapa e do farol da Home, e é o que impede as três telas de discordarem.
 *   - as COLUNAS são quem PRECISA AGIR, e quem age.
 *
 * Um não popula o outro. Um embarque verde no farol pode ter documento pendente
 * (o estado dele no GE está normal, mas a bola está com o cliente), e um
 * embarque laranja pode não exigir nada. Somar o tamanho das colunas para
 * imprimir no farol daria um número que não responde nenhuma das duas perguntas.
 *
 * IMUTÁVEL, de propósito: sem toggle, sem ordenação escolhida pelo cliente, sem
 * personalização. A mesma estrutura para todo cliente é o que faz a Freitas
 * poder dizer ao telefone "olha a primeira coluna" e acertar.
 *
 * SEM ENDPOINT NOVO E SEM CÁLCULO NOVO: as mesmas duas chaves SWR do resto do
 * portal, e `lib/control-tower.ts`, que consome `collectHomeActions` (o
 * `needsAction` do Funil + os `StepAction` pendentes da timeline) e
 * `delayRiskFromTracking`.
 */
export default function PortalControlTowerPage() {
  const { shipments, isLoading: loadingShipments, isError: shipmentsError } =
    useMyShipments();
  const { data, isLoading: loadingQuotations, isError: quotationsError } =
    useMyQuotations();

  // Uma leitura de relógio por render, compartilhada pela data do subtítulo e
  // pelos prazos das ações — a mesma disciplina da Home.
  const now = useMemo(() => new Date(), []);

  const tower = useMemo(
    () =>
      buildControlTower({
        shipments,
        buckets: data?.buckets ?? {},
        realSteps: REAL_STEPS,
        now,
      }),
    [shipments, data, now],
  );

  const counts = useMemo(() => countBySemaforo(shipments), [shipments]);

  if (loadingShipments || loadingQuotations) return <LoaderComponent />;
  if (shipmentsError || quotationsError) return <ErrorComponent />;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="portal-h1">Visão Geral</h1>
          <p className="portal-small text-portal-neutral">
            Tudo que precisa da sua ação hoje · {formatLongDate(now.toISOString())}
          </p>
        </div>
        <SemaforoChips counts={counts} />
      </div>

      {/* Duas colunas de mesmo peso. Abaixo de `lg` empilham, e "Aguardando sua
          ação" fica em cima — é o grid fazendo o certo, não uma exceção. */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <TowerColumn
          title="Aguardando sua ação"
          hint="A bola está com você: nada anda até você responder."
          column={tower.awaiting}
          emptyMessage="Nada depende de você agora. Assim que uma proposta, um booking ou um documento precisar da sua resposta, ele aparece aqui."
          // O Funil é a tela do `needsAction` de cotação: as duas colunas de ação
          // do cliente são as que ele destaca no topo. A Lista de embarques não
          // tem chip de "ação necessária" hoje (os quatro são Urgentes,
          // Embarcados, Com atraso e Com exceção), então o link abre a Lista
          // inteira — criar um chip novo é decisão de produto, não de layout.
          links={[
            { href: '/portal/cotacoes?tab=funil', label: 'Cotação' },
            { href: '/portal/embarques?tab=lista', label: 'Embarques' },
          ]}
        />
        <TowerColumn
          title="Precisam de atenção"
          hint="A bola está com a Freitas ou com a companhia marítima, mas você precisa saber."
          column={tower.attention}
          emptyMessage="Nenhum embarque com a chegada movida para depois da primeira previsão da companhia marítima."
          // Só embarque nesta coluna, então só o chip que mede a mesma coisa:
          // "Com atraso" é `delayRiskFromTracking`, a MESMA função que classifica
          // as linhas daqui.
          links={[
            { href: '/portal/embarques?tab=lista&filtro=atraso', label: 'Embarques' },
          ]}
        />
      </div>
    </div>
  );
}
