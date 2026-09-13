'use client';

import { useState } from 'react';
import { Input } from '@/components/ui';
import {
  ManualForm,
  type ManualFormDraft,
} from '@/app/cotacao/nova-cotacao/components/manual-form';
import type { Quote } from './model';

export function DraftRequestForm({
  quotation: q,
  onSave,
  onReview,
}: {
  quotation: Quote;
  onSave: (patch: Partial<Quote>) => void;
  onReview: (patch: Partial<Quote>) => void;
}) {
  const [supplier, setSupplier] = useState(q.supplier);
  const [initial] = useState<ManualFormDraft>(
    () =>
      q.manualDraft || {
        values: {
          tipo_cotacao: 'REAL',
          data_cotacao: '2026-09-13',
          service_type: 'IMPORTACAO',
          modal: 'MARITIMO',
          tipo_embarque: 'FCL',
          product: q.product,
          client_reference: q.po,
          origin: q.pickup,
          porto_embarque: 'Busan, South Korea (KRPUS)',
          porto_destino: ['Santos, Brazil (BRSSZ)'],
          incoterm: q.incoterm,
          data_prontidao: q.readyDate,
          data_limite_necessidade: q.needDate,
          desired_deadline: '2026-09-14T17:00',
        },
        equipments:
          q.weight && q.volume
            ? [
                {
                  quantity: 1,
                  tipo_container: 'HIGH_CUBE_40',
                  peso_bruto: Number(q.weight.replace(',', '.')),
                  peso_unidade: 'KG',
                  volume_m3: Number(q.volume.replace(',', '.')),
                },
              ]
            : [],
        volumes: [],
      },
  );
  const patch = (snapshot: ManualFormDraft): Partial<Quote> => {
    const v = snapshot.values;
    const cargo =
      v.tipo_embarque === 'FCL' ? snapshot.equipments : snapshot.volumes;
    return {
      manualDraft: snapshot,
      supplier,
      product: v.product || '',
      po: v.client_reference || '',
      pickup: v.origin || '',
      readyDate: v.data_prontidao || '',
      needDate: v.data_limite_necessidade || '',
      responseBy: v.desired_deadline
        ? new Date(v.desired_deadline).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Prazo a confirmar',
      origin:
        v.porto_embarque ||
        v.aeroporto_embarque ||
        v.origin ||
        'Origem a confirmar',
      destination:
        v.porto_destino?.join(', ') ||
        v.aeroporto_destino?.join(', ') ||
        'Destino a confirmar',
      modal:
        v.modal === 'AEREO'
          ? 'Aéreo'
          : v.modal === 'RODOVIARIO'
            ? 'Rodoviário'
            : 'Marítimo',
      incoterm: v.incoterm || '',
      equipment: v.tipo_embarque || '',
      weight: String(
        cargo.reduce(
          (total, item) =>
            total +
            (item.peso_bruto || 0) *
              (item.peso_unidade === 'LB' ? 0.45359237 : 1),
          0,
        ) || '',
      ),
      volume: String(
        cargo.reduce((total, item) => total + (item.volume_m3 || 0), 0) || '',
      ),
    };
  };
  return (
    <ManualForm
      clientId={null}
      onQuotationCreated={() => {}}
      exporterSection={
        <Input
          aria-label="Exportador do rascunho"
          value={supplier}
          onChange={(event) => setSupplier(event.target.value)}
        />
      }
      draft={{
        initial,
        onSave: (snapshot) => onSave(patch(snapshot)),
        onReview: (snapshot) => onReview(patch(snapshot)),
      }}
    />
  );
}
