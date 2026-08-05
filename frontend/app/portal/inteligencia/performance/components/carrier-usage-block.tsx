'use client';

import { Anchor, Info } from 'lucide-react';

import { SectionHeading } from '../../../_shared/page-header';
import { ProvenanceBadge } from '../../../_shared/provenance-badge';
import type { CarrierUsage } from '../../lib/shipment-dimensions';

/**
 * "Armadores mais usados" — em que companhia a carga do cliente costuma viajar.
 *
 * ARMADOR NÃO É AGENTE. O armador (Maersk, ONE, MSC) opera o navio ou o avião e
 * vem de `Proposal.carrier`; o agente de frete é quem cota e intermedia, tem
 * tela própria ("Meus Agentes") e ranking próprio em Inteligência > Agentes. São
 * duas perguntas diferentes — "com quem eu contrato" e "em que navio minha carga
 * vai" — e um mesmo agente cota vários armadores. Não unifique os dois blocos.
 *
 * Selo `pending` no bloco inteiro, mas por metades diferentes, e a nota de
 * rodapé diz qual é qual:
 *   - o NOME do armador e a CONTAGEM de embarques são reais (campo estruturado,
 *     já exposto ao portal);
 *   - o ON-TIME depende do mesmo rastreamento que falta em "Rotas com maiores
 *     desvios", então aparece como "—" enquanto não houver embarque medido.
 * Nunca substitua esse "—" por 0%: seria acusar o armador de atrasar tudo com
 * base em nenhuma medição.
 */
export function CarrierUsageBlock({ carriers }: { carriers: CarrierUsage[] }) {
  return (
    <section className="space-y-4 rounded-xl border border-dashed border-border bg-muted/20 p-6">
      <SectionHeading
        title="Armadores / cias mais usados"
        hint="quem opera o navio ou o avião"
        icon={<Anchor className="h-5 w-5" />}
        action={<ProvenanceBadge provenance="pending" />}
      />

      {carriers.length === 0 ? (
        <p className="portal-body text-portal-neutral">
          Nenhum dos seus embarques tem armador informado na proposta vencedora
          ainda.
        </p>
      ) : (
        <ul className="space-y-3">
          {carriers.map((carrier) => (
            <li
              key={carrier.carrier}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-dashed pb-3 last:border-0 last:pb-0"
            >
              <span className="portal-body font-medium text-foreground">
                {carrier.carrier}
              </span>
              <span className="inline-flex flex-wrap items-center gap-x-2 portal-small text-portal-neutral">
                <span>
                  {carrier.shipments}{' '}
                  {carrier.shipments === 1 ? 'embarque' : 'embarques'}
                </span>
                <span className="text-border">·</span>
                <span>
                  On-time:{' '}
                  {carrier.onTimePct != null ? (
                    <span className="font-medium text-foreground">
                      {carrier.onTimePct}%
                    </span>
                  ) : (
                    <span title="Nenhum embarque deste armador tem rastreamento ainda">
                      —
                    </span>
                  )}
                </span>
                {carrier.trackedShipments > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <span>
                      sobre {carrier.trackedShipments}{' '}
                      {carrier.trackedShipments === 1 ? 'medido' : 'medidos'}
                    </span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="inline-flex items-start gap-1.5 portal-small border-t border-dashed pt-3 text-portal-neutral">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-medium text-foreground">Real:</span> o nome do
          armador (campo da proposta vencedora) e a contagem de embarques.{' '}
          <span className="font-medium text-foreground">Pendente:</span> o
          on-time, que precisa do rastreamento da companhia — por isso aparece
          como &ldquo;—&rdquo; e nunca como 0%. O armador é quem opera o navio; o
          agente de frete, que cota e intermedia, fica em Inteligência ·
          Agentes.
        </span>
      </p>
    </section>
  );
}
