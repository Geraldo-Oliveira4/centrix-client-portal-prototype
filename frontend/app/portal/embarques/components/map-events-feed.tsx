'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Container,
  Navigation,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatShortDate } from '@/lib/portal-formatters';
import type { SemaforoTone } from '@/types/portal-shipment';

import { ProvenanceBadge } from '../../_shared/provenance-badge';
import { sortAlertsForFeed } from '../lib/alert-priority';
import { ALERT_TYPE_LABELS, type AlertType, type ShipmentAlert } from '../lib/shipment-alerts';

// Coluna direita do Mapa: os eventos recentes da operação.
//
// NÃO é uma feature nova nem uma segunda fonte: são os MESMOS alertas da aba
// Alertas (`buildShipmentAlerts` + `sortAlertsForFeed`), com as MESMAS
// preferências de tipo. O que muda é só a densidade — aqui é leitura, sem
// switches de tipo, sem marcar como lido e sem "marcar todas": esses controles
// são da aba Alertas, e duplicá-los criaria dois lugares para editar o mesmo
// estado.
//
// O selo `preview` acompanha: o feed é ilustrativo por construção (não há motor
// de exceções), e ele não deixa de ser ao mudar de coluna.

const TYPE_ICON: Record<AlertType, LucideIcon> = {
  confirmado: CheckCircle2,
  eta: Navigation,
  excecao: AlertTriangle,
  demurrage: Container,
};

const TONE_TEXT: Record<SemaforoTone, string> = {
  success: 'text-portal-success',
  warning: 'text-portal-warning',
  danger: 'text-portal-danger',
};

const TONE_BG: Record<SemaforoTone, string> = {
  success: 'bg-portal-success/10',
  warning: 'bg-portal-warning/10',
  danger: 'bg-portal-danger/10',
};

// Quantos eventos cabem na coluna sem ela virar uma segunda Lista. O restante
// continua na aba Alertas, para onde o rodapé aponta.
const MAX_ITEMS = 6;

export function MapEventsFeed({
  alerts,
  readIds,
  enabledTypes,
  onSeeAll,
}: {
  alerts: ShipmentAlert[];
  readIds: Set<string>;
  enabledTypes: Set<AlertType>;
  onSeeAll: () => void;
}) {
  const visible = sortAlertsForFeed(
    alerts.filter((a) => enabledTypes.has(a.type)),
    readIds,
  );
  const shown = visible.slice(0, MAX_ITEMS);

  return (
    <section className="portal-card flex h-full flex-col p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="portal-h3 text-foreground">Eventos recentes</p>
        <ProvenanceBadge provenance="preview" />
      </div>

      {shown.length === 0 ? (
        <p className="portal-small mt-4 text-portal-neutral">
          Nenhum evento nos tipos que você acompanha.
        </p>
      ) : (
        <ul className="mt-4 flex-1 space-y-3">
          {shown.map((alert) => {
            const Icon = TYPE_ICON[alert.type];
            return (
              <li key={alert.id}>
                <Link
                  href={`/portal/embarques/${alert.shipmentId}`}
                  className="flex gap-3 rounded-md p-1.5 transition-colors hover:bg-muted/50"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                      TONE_BG[alert.tone],
                    )}
                  >
                    <Icon className={cn('h-4 w-4', TONE_TEXT[alert.tone])} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="portal-small font-medium text-foreground">
                      {alert.referencia}
                      {!readIds.has(alert.id) && (
                        <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
                      )}
                    </p>
                    <p className="portal-small truncate text-portal-neutral">
                      {ALERT_TYPE_LABELS[alert.type]}
                    </p>
                    <p className="portal-small text-portal-neutral">
                      {formatShortDate(alert.timestamp)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {visible.length > shown.length && (
        <button
          type="button"
          onClick={onSeeAll}
          className="portal-small mt-4 self-start font-medium text-primary hover:underline"
        >
          Ver todos os {visible.length} na aba Alertas →
        </button>
      )}
    </section>
  );
}
