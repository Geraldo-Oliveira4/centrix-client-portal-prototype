'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  CheckCircle2,
  Container,
  Navigation,
  Radar,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { formatShortDate } from '@/lib/portal-formatters';
import type { SemaforoTone } from '@/types/portal-shipment';

import { ProvenanceBadge } from '../../_shared/provenance-badge';
import { isPriorityType, sortAlertsForFeed } from '../lib/alert-priority';
import {
  ALERT_TYPE_LABELS,
  ALL_ALERT_TYPES,
  type AlertType,
  type ShipmentAlert,
} from '../lib/shipment-alerts';

const TYPE_ICON: Record<AlertType, LucideIcon> = {
  confirmado: CheckCircle2,
  eta: Navigation,
  excecao: AlertTriangle,
  demurrage: Container,
  // Mesmo ícone do feed do Mapa: nomeia a FONTE (o Radar), não a direção do
  // preço — quem diz o lado é o tom da cor.
  preco: Radar,
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

interface ShipmentAlertsTabProps {
  alerts: ShipmentAlert[];
  readIds: Set<string>;
  enabledTypes: Set<AlertType>;
  onToggleType: (type: AlertType) => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export function ShipmentAlertsTab({
  alerts,
  readIds,
  enabledTypes,
  onToggleType,
  onMarkRead,
  onMarkAllRead,
}: ShipmentAlertsTabProps) {
  // Priority (unread demurrage) first, then chronological — the rule lives in
  // lib/alert-priority.ts, not here.
  const visible = useMemo(
    () =>
      sortAlertsForFeed(
        alerts.filter((a) => enabledTypes.has(a.type)),
        readIds,
      ),
    [alerts, enabledTypes, readIds],
  );
  const unread = visible.filter((a) => !readIds.has(a.id)).length;

  return (
    <div className="space-y-6">
      {/* Preview framing: there is no real push/exception engine in this prototype. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="portal-h2 text-foreground">Notificações</h2>
          <ProvenanceBadge provenance="preview" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={onMarkAllRead}
          disabled={unread === 0}
        >
          <CheckCheck className="h-4 w-4" />
          Marcar todas como lidas
        </Button>
      </div>

      {/* Configuração dos alertas que o cliente quer receber */}
      <section className="portal-card-muted space-y-3 p-4">
        <p className="portal-small font-medium text-foreground">
          Quais alertas você quer receber
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
          {ALL_ALERT_TYPES.map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-2 portal-small text-foreground"
            >
              <Switch
                checked={enabledTypes.has(type)}
                onCheckedChange={() => onToggleType(type)}
              />
              {ALERT_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
      </section>

      {/* Feed cronológico */}
      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
          <p className="portal-body font-medium text-foreground">
            Nenhuma notificação
          </p>
          <p className="portal-small text-portal-neutral">
            {alerts.length === 0
              ? 'Assim que houver movimentação nos seus embarques, os alertas aparecem aqui.'
              : 'Ative um tipo de alerta acima para ver as notificações.'}
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {visible.map((alert) => {
            const Icon = TYPE_ICON[alert.type];
            const isRead = readIds.has(alert.id);
            // Only the priority type gets the red frame, and only while unread:
            // the same "see it once" logic that lifts it to the top.
            const isUrgent = isPriorityType(alert.type) && !isRead;
            return (
              // A moldura saiu do <button> para o <li> porque a notificação
              // passou a ter um destino ("Ver embarque", "Ver no Radar de
              // Preços") — e um link dentro de um botão é HTML inválido e
              // inacessível. Clicar no corpo continua marcando como lida; o
              // link fica numa faixa própria, abaixo.
              <li
                key={alert.id}
                className={cn(
                  'overflow-hidden rounded-lg border transition-colors',
                  isRead && 'border-border bg-transparent',
                  !isRead && !isUrgent && 'border-primary/20 bg-primary/[0.03]',
                  isUrgent && 'border-portal-danger/30 bg-portal-danger/[0.04]',
                )}
              >
                <button
                  type="button"
                  onClick={() => onMarkRead(alert.id)}
                  disabled={isRead}
                  className={cn(
                    'flex w-full items-start gap-3 p-3 text-left transition-colors',
                    !isRead && !isUrgent && 'hover:bg-primary/5',
                    isUrgent && 'hover:bg-portal-danger/10',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      TONE_BG[alert.tone],
                      TONE_TEXT[alert.tone],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          'portal-body',
                          isRead ? 'text-foreground/80' : 'font-medium text-foreground',
                        )}
                      >
                        {alert.title}
                      </p>
                      {!isRead && (
                        <span
                          className={cn(
                            'h-2 w-2 shrink-0 rounded-full',
                            isUrgent ? 'bg-portal-danger' : 'bg-primary',
                          )}
                        />
                      )}
                      {/* Derived from a tracking block flagged as demo data:
                          same seal the list card and the detail screen show. */}
                      {alert.isMock && <ProvenanceBadge provenance="preview" />}
                    </div>
                    <p className="portal-small text-portal-neutral">
                      {alert.description}
                    </p>
                  </div>
                  <span className="shrink-0 portal-small text-portal-neutral">
                    {formatShortDate(alert.timestamp)}
                  </span>
                </button>

                {/* O destino da notificação. É o que separa "aviso" de "aviso
                    acionável": o alerta de preço leva ao Radar, onde o cliente
                    compara as rotas e cota; os de embarque levam ao embarque. */}
                <div className="border-t border-inherit px-3 py-2">
                  <Link
                    href={alert.link.href}
                    className="portal-small inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    {alert.link.label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
