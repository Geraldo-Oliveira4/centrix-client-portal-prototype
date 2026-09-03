'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LoaderComponent, ErrorComponent } from '@arboria-tech/arboria-ui';

import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { useMyShipments } from '@/hooks/use-portal-shipments';
import { countBySemaforo } from '@/types/portal-shipment';

import { SectionHeading } from '../_shared/page-header';
import { REAL_STEPS } from '../embarques/lib/real-steps';
import { HomeBanner } from './components/home-banner';
import { HomeShortcuts } from './components/home-shortcuts';
import { UrgentActionCard } from './components/urgent-action-card';
import { collectHomeActions } from './lib/home-actions';

/**
 * Home do Portal do Cliente — a landing pos-login.
 *
 * A SIDEBAR APARECE AQUI COMO EM QUALQUER OUTRA TELA — nao ha excecao de rota.
 * O bloco navy do topo e BANNER INFORMATIVO, sem nenhuma funcao de navegacao:
 * saudacao, frase dominante e farol, e nada mais. Navegacao vive so na sidebar.
 *
 * SEM ENDPOINT NOVO. Tudo sai de `/portal/quotations` e `/portal/shipments`, as
 * duas chaves SWR que o resto do portal ja usa — entao abrir a Home nao custa um
 * fetch a mais do que abrir Meus Embarques, e nenhum numero daqui pode discordar
 * das telas de destino, porque e o mesmo payload.
 *
 * NENHUM CALCULO NOVO:
 *   - farol -> `countBySemaforo` (o mesmo do "Visao do todo" do Mapa)
 *   - acao  -> `collectHomeActions`, que roda a pipeline da tela de detalhe do
 *              embarque + os baldes de acao do Funil
 *
 * A HOME MOSTRA UMA ACAO, NAO A FILA. A fila inteira existe e esta completa —
 * ela mora na Visao Geral, organizada por modulo. Aqui fica o primeiro item e a
 * contagem do resto: dezoito linhas empilhadas nao respondem "o que depende de
 * mim?", elas adiam a resposta.
 *
 * O card "Economia Gerada" saiu (03/09/2026): a Home responde "o que precisa de
 * mim hoje", e economia e pergunta de Inteligencia, que tem duas telas para ela.
 */
export default function PortalHomePage() {
  const { shipments, isLoading: loadingShipments, isError: shipmentsError } =
    useMyShipments();
  const { data, isLoading: loadingQuotations, isError: quotationsError } =
    useMyQuotations();

  // UMA leitura de relogio por render, compartilhada pela saudacao do cabecalho
  // e pelos prazos das acoes. Duas chamadas a `new Date()` podem cair em dias
  // diferentes na virada da meia-noite, e ai "Expira hoje" discordaria do prazo
  // que a fila ordenou. Mesma disciplina do detalhe do embarque.
  const now = useMemo(() => new Date(), []);

  // A FILA INTEIRA, ja ordenada por urgencia. A tela mostra o primeiro item e
  // conta o resto — o corte e declarado, nunca silencioso.
  const actions = useMemo(
    () =>
      collectHomeActions({
        shipments,
        buckets: data?.buckets ?? {},
        realSteps: REAL_STEPS,
        now,
      }),
    [shipments, data, now],
  );

  // O FAROL. A fonte e a MESMA do "Visao do todo" do Mapa: `countBySemaforo`
  // sobre os embarques do cliente — nao ha aritmetica nova aqui, e por isso a
  // Home e o Mapa nao podem discordar.
  const counts = useMemo(() => countBySemaforo(shipments), [shipments]);
  const needsAttention = counts.warning + counts.danger;

  if (loadingShipments || loadingQuotations) return <LoaderComponent />;
  if (shipmentsError || quotationsError) return <ErrorComponent />;

  const remaining = Math.max(0, actions.length - 1);

  return (
    <div className="space-y-8">
      <HomeBanner
        now={now}
        counts={counts}
        headline={
          // O numero e a frase mudam juntos: sem nada em aberto a tela da a boa
          // noticia em vez de imprimir um "0" grande, que le como painel quebrado.
          needsAttention === 0 ? (
            'Nenhum embarque precisa da sua atenção hoje.'
          ) : (
            <>
              <span className="text-portal-warning">{needsAttention}</span>{' '}
              {needsAttention === 1
                ? 'embarque precisa da sua atenção hoje'
                : 'embarques precisam da sua atenção hoje'}
            </>
          )
        }
      />

      <section className="space-y-3">
        <SectionHeading title="Sua ação mais urgente" />
        <UrgentActionCard action={actions[0]} />

        {/* O corte e declarado. "Organizadas por modulo" nao e enfeite: e o que
            a Visao Geral faz de diferente desta tela, e o que justifica mandar o
            cliente para la em vez de esticar a lista aqui. */}
        {remaining > 0 ? (
          <p className="portal-small text-portal-neutral">
            Mais {remaining} {remaining === 1 ? 'ação aguarda' : 'ações aguardam'}{' '}
            você — organizadas por módulo na{' '}
            <Link
              href="/portal/visao-geral"
              className="font-medium text-primary hover:underline"
            >
              Visão Geral
            </Link>
            .
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <SectionHeading title="Atalhos" />
        <HomeShortcuts />
      </section>
    </div>
  );
}
