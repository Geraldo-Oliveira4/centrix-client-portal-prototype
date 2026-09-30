'use client';

// RQ-12 — a aba "Visão por PO".
//
// SÓ PROTÓTIPO. A spec pede esta tela apenas para validar a aderência com
// clientes; a gestão por PO de verdade é V2. Por isso ela é simples de
// propósito: agrupa, lista e desenha uma régua de chegadas. Nenhuma ação, nenhum
// dado novo, nenhuma origem inventada.
//
// A PERGUNTA QUE ELA RESPONDE é "quando cada carga deste pedido chega?" — e por
// isso a régua só posiciona o que TEM data. Uma carga sem previsão aparece na
// lista com "Sem previsão" e fora da régua, em vez de ganhar uma posição
// arbitrária que leria como uma data.

import Link from 'next/link';
import { ChevronRight, Package } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatShortDate } from '@/lib/portal-formatters';
import { MODAL_LABELS } from '@/types/quotation';
import { ESTADO_LABELS } from '@/types/portal-shipment';

import { SectionHeading } from '../page-header';
import {
  etaPositions,
  groupShipmentsByPo,
  splitPoCount,
  type PoOverviewGroup,
} from './po-overview';
import { PO_STAGE_LABELS } from './shipment-po-review';
import type { PortalShipmentWithReview } from './shipment-po-merge';

function PoGroup({ group }: { group: PoOverviewGroup }) {
  const positions = etaPositions(group);
  const dated = group.shipments.filter((s) => positions.has(s.id));

  return (
    <article className="portal-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 shrink-0 text-portal-neutral" />
          <h3 className="portal-h3">{group.po}</h3>
        </div>
        <span className="portal-small rounded bg-muted px-1.5 py-0.5 text-portal-neutral">
          {group.shipments.length}{' '}
          {group.shipments.length === 1 ? 'embarque' : 'embarques'}
        </span>
      </div>

      <ul className="mt-4 divide-y divide-border/60">
        {group.shipments.map((shipment) => (
          <li
            key={shipment.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2.5"
          >
            <div className="min-w-0">
              <Link
                href={`/portal/embarques/${shipment.id}`}
                className="portal-body font-medium text-foreground hover:underline"
              >
                {shipment.reference}
              </Link>
              <p className="portal-small text-portal-neutral">
                {shipment.modal
                  ? (MODAL_LABELS[
                      shipment.modal as keyof typeof MODAL_LABELS
                    ] ?? shipment.modal)
                  : 'Modal a confirmar'}{' '}
                · {shipment.stateLabel}
              </p>
            </div>
            <p className="portal-small shrink-0 text-portal-neutral">
              {shipment.eta
                ? `${shipment.etaIsActual ? 'Chegou em' : 'Chegada prevista'} ${formatShortDate(shipment.eta)}`
                : 'Sem previsão'}
            </p>
          </li>
        ))}
      </ul>

      {/* A RÉGUA. Só aparece com pelo menos uma data; com uma só, a carga fica
          no meio, porque não há intervalo a distribuir. */}
      {dated.length > 0 && (
        <div className="mt-5">
          {/* A margem lateral existe porque os marcadores das pontas ficam
              centrados na propria data (`-translate-x-1/2`): sem ela, a
              primeira e a ultima legenda saem cortadas pela borda do card. */}
          <div className="relative mx-10 h-10">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-3 h-px bg-border"
            />
            {dated.map((shipment) => (
              <span
                key={shipment.id}
                className="absolute top-0 -translate-x-1/2"
                style={{ left: `${positions.get(shipment.id)}%` }}
              >
                <span className="flex flex-col items-center gap-1">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-2.5 w-2.5 rounded-full ring-2 ring-card',
                      shipment.etaIsActual
                        ? 'bg-portal-success'
                        : 'bg-brand-indigo',
                    )}
                  />
                  <span className="portal-small whitespace-nowrap text-portal-neutral">
                    {formatShortDate(shipment.eta as string)}
                  </span>
                </span>
              </span>
            ))}
          </div>
          {group.shipments.length > dated.length && (
            <p className="portal-small mt-1 text-portal-neutral">
              {group.shipments.length - dated.length}{' '}
              {group.shipments.length - dated.length === 1
                ? 'carga ainda sem previsão de chegada'
                : 'cargas ainda sem previsão de chegada'}
              .
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export function PoOverviewTab({
  shipments,
}: {
  shipments: PortalShipmentWithReview[];
}) {
  const groups = groupShipmentsByPo(shipments, {
    // O rótulo do estado vem da MESMA fonte que a carteira usa: a etapa de
    // revisão quando ela existe, o estado operacional quando não.
    stateLabel: (shipment) =>
      shipment.review_status && shipment.review_status.stage !== 'active'
        ? PO_STAGE_LABELS[shipment.review_status.stage]
        : (ESTADO_LABELS[shipment.estado] ?? shipment.estado),
  });
  const split = splitPoCount(groups);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
        <p className="portal-h3">Nenhum embarque com PO informado</p>
        <p className="portal-small mt-1 text-portal-neutral">
          Assim que os seus embarques tiverem o número do PO, eles aparecem aqui
          agrupados por pedido.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Seus pedidos"
        hint={
          split > 0
            ? `${split} ${split === 1 ? 'PO dividido' : 'POs divididos'} em mais de um embarque`
            : 'cada PO com os embarques que nasceram dele'
        }
      />
      <p className="portal-small text-portal-neutral">
        Uma visão por pedido, em avaliação. As datas são as chegadas previstas
        que já existem — nenhuma é estimada aqui.
      </p>
      {groups.map((group) => (
        <PoGroup key={group.key} group={group} />
      ))}
    </div>
  );
}
