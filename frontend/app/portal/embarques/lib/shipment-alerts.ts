// Illustrative notification feed for the shipment "Alertas" tab.
//
// PREVIEW, by design: there is no push service and no exception-detection engine
// in this prototype. So this module derives a plausible, stable alert stream
// deterministically from the shipments the client already owns. The whole tab
// wears the "Pré-visualização" badge; nothing here is a real notification.
//
// What is illustrative is the FRAMING, never the content: every timestamp comes
// from the shipment (created_at / updated_at) or from the carrier tracking block
// (last_milestone_at), so no date is ever invented. An alert built on tracking
// carries `isMock` when that tracking is demo data.

import { formatDate } from '@/lib/portal-formatters';
import {
  ESTADO_DESCRIPTIONS,
  ESTADO_SEMAFORO,
  isExceptionState,
  type PortalShipment,
  type SemaforoTone,
} from '@/types/portal-shipment';

import { compareByTimestampDesc } from './alert-priority';

export type AlertType =
  | 'confirmado'
  | 'eta'
  | 'excecao'
  | 'demurrage'
  | 'preco';

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  confirmado: 'Embarque confirmado',
  eta: 'Mudança de estimativa de chegada',
  excecao: 'Exceção detectada',
  demurrage: 'Risco de demurrage/detention',
  // "Oportunidade OU alta": o alerta dispara nos dois extremos do Radar, e um
  // rótulo só com "oportunidade" faria a entrada vermelha de alta de preço
  // parecer erro de classificação. Os dois avisam a mesma coisa — o momento de
  // cotar mudou —, só que em direções opostas.
  preco: 'Oportunidade ou alta de preço',
};

export const ALL_ALERT_TYPES: AlertType[] = [
  'confirmado',
  'eta',
  'excecao',
  'demurrage',
  'preco',
];

// `demurrage` is the odd one out among the shipment alerts, and deliberately
// so: the others tell the client what happened, this one says money starts
// running if they do nothing. That single difference drives three rules no other type
// gets — always `danger` (never softened by the shipment's health semáforo),
// first in the feed while unread (`sortAlertsForFeed` in lib/alert-priority.ts),
// and on by default in the preferences (see TYPES_KEY in embarques/page.tsx).
//
// Deliberately absent: any countdown. Free time (demurrage/detention free days)
// is a commercial clause that lives in Inova, not in the carrier feed, so
// "vence em X dias" has no source — inventing one would hang a fake deadline on
// the one alert with a real cost attached.

export interface ShipmentAlert {
  id: string;
  type: AlertType;
  tone: SemaforoTone;
  /**
   * O que o alerta nomeia: a referência do embarque, ou a rota no alerta de
   * preço. Genérico de propósito — desde que a notificação de preço entrou no
   * feed, nem todo alerta é DE um embarque, e um campo chamado `referencia`
   * obrigaria o alerta de preço a mentir o nome do próprio assunto.
   */
  subject: string;
  /**
   * O embarque a que o alerta pertence, quando pertence a um. Ausente no alerta
   * de preço, que é da ROTA: é o que faz o filtro do Mapa (que recorta por
   * embarque plotado) deixá-lo de fora em vez de o associar ao embarque errado.
   */
  shipmentId?: string;
  /** Para onde a notificação leva, e com que chamada. */
  link: { href: string; label: string };
  title: string;
  description: string;
  // Real ISO timestamp from the shipment; the alert framing is illustrative.
  timestamp: string;
  /**
   * True when this alert was derived from a tracking block flagged as demo data
   * (`tracking.is_mock`). The surface that renders it must show the
   * "Pré-visualização" seal, same contract as every other tracking value.
   */
  isMock?: boolean;
}

// Build the (illustrative) alert stream from the owned shipments. Deterministic:
// same shipments -> same alerts, stable ids so read-state persists.
export function buildShipmentAlerts(
  shipments: PortalShipment[],
): ShipmentAlert[] {
  const alerts: ShipmentAlert[] = [];

  shipments.forEach((s) => {
    const opened = s.created_at;
    const moved = s.updated_at ?? s.created_at;
    // Todo alerta de embarque leva ao próprio embarque. Uma linha só, para os
    // quatro tipos: um deles apontando para outro lugar seria acidente, não
    // decisão.
    const link = { href: `/portal/embarques/${s.id}`, label: 'Ver embarque' };

    // 1. Every shipment was confirmed when it opened.
    alerts.push({
      id: `${s.id}:confirmado`,
      type: 'confirmado',
      tone: 'success',
      shipmentId: s.id,
      subject: s.referencia,
      link,
      title: `Embarque ${s.referencia} confirmado`,
      description: ESTADO_DESCRIPTIONS.solicitado,
      timestamp: opened,
    });

    // 2. Shipments already in transit get an (illustrative) ETA-window update.
    //    No specific date is asserted — there is no ETA source.
    if (s.estado === 'embarcado' || s.estado === 'analise_booking') {
      alerts.push({
        id: `${s.id}:eta`,
        type: 'eta',
        tone: 'success',
        shipmentId: s.id,
        subject: s.referencia,
        link,
        title: `Estimativa de chegada revista — ${s.referencia}`,
        description:
          'A janela estimada de chegada foi ajustada com base no andamento do embarque.',
        timestamp: moved,
      });
    }

    // 3. Exception states raise an alert, coloured by the same health semáforo.
    if (isExceptionState(s.estado)) {
      alerts.push({
        id: `${s.id}:excecao`,
        type: 'excecao',
        tone: ESTADO_SEMAFORO[s.estado],
        shipmentId: s.id,
        subject: s.referencia,
        link,
        title: `Exceção detectada — ${s.referencia}`,
        description: ESTADO_DESCRIPTIONS[s.estado],
        timestamp: moved,
      });
    }

    // 4. Container released for pickup: storage/demurrage starts running.
    //    The trigger is the carrier milestone, not the EmbarqueState — the GE
    //    module's states stop at `embarcado` (departure), so nothing but
    //    tracking knows the cargo is sitting at the destination terminal.
    if (s.tracking?.last_milestone === 'AVAILABLE') {
      const releasedAt = s.tracking.last_milestone_at;
      alerts.push({
        id: `${s.id}:demurrage`,
        type: 'demurrage',
        // Always danger. Not ESTADO_SEMAFORO[s.estado]: the shipment's health
        // is green (it arrived fine) while the client's exposure is red.
        tone: 'danger',
        shipmentId: s.id,
        subject: s.referencia,
        link,
        title: 'Atenção — Container liberado',
        // The carrier may report the milestone without dating it, so the date
        // is stated only when it exists. The fact is the alert; the date is not
        // load-bearing and is never guessed from the ETA.
        description: releasedAt
          ? `${s.referencia} foi liberado em ${formatDate(releasedAt)}. Providencie a retirada para evitar custos de armazenagem/demurrage.`
          : `${s.referencia} foi liberado para retirada. Providencie a retirada para evitar custos de armazenagem/demurrage.`,
        timestamp: releasedAt ?? moved,
        isMock: s.tracking.is_mock,
      });
    }
  });

  return alerts.sort(compareByTimestampDesc);
}
