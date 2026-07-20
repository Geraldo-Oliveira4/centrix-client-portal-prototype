'use client';

import { useState } from 'react';
import { DatePicker } from '@arboria-tech/arboria-ui';
import { Button } from '@/components/ui/button';
import { updateShipment } from '@/hooks/use-shipments';
import type { ShipmentDatas, ShipmentDetail } from '@/types/shipment';

interface DatasProps {
  shipment: ShipmentDetail;
  onSaved: () => void;
}

// 'YYYY-MM-DD' -> Date (local midnight, avoids UTC off-by-one).
function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

// Date -> 'YYYY-MM-DD' from local parts.
function formatDate(date: Date | undefined): string | null {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const FIELDS: { key: keyof ShipmentDatas; label: string }[] = [
  { key: 'prontidao', label: 'Data de prontidão' },
  { key: 'limite_necessidade', label: 'Data limite de necessidade' },
  { key: 'coleta', label: 'Data de coleta' },
  { key: 'embarque', label: 'Data de embarque' },
  { key: 'chegada_destino', label: 'Data de chegada ao destino' },
];

export function Datas({ shipment, onSaved }: DatasProps) {
  const [datas, setDatas] = useState<ShipmentDatas>(shipment.datas);
  const [saving, setSaving] = useState(false);

  const dirty = FIELDS.some((f) => datas[f.key] !== shipment.datas[f.key]);

  const handleChange = (key: keyof ShipmentDatas, date: Date | undefined) => {
    setDatas((prev) => ({ ...prev, [key]: formatDate(date) }));
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateShipment(shipment.id, { datas });
    setSaving(false);
    if (result) onSaved();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
            <DatePicker
              selected={parseDate(datas[f.key])}
              onSelect={(date) => handleChange(f.key, date)}
              placeholder="Selecionar data"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? 'Salvando...' : 'Salvar datas'}
        </Button>
      </div>
    </div>
  );
}
