'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAutosave } from '@/hooks/use-autosave';
import { useServerSync } from '@/hooks/use-server-sync';
import { useShipmentBooking, updateShipmentBooking } from '@/hooks/use-shipments';
import { AutoSaveIndicator } from '@/components/auto-save-indicator';
import { LoaderComponent } from '@arboria-tech/arboria-ui';
import type { BookingContainer, BookingDetail, ShipmentModal, UpdateBookingPayload } from '@/types/shipment';

interface DadosFreteProps {
  processId: string;
  modal: ShipmentModal | null;
}

interface FormState {
  cia_aerea_armador: string;
  mawb_mbl: string;
  hawb_hbl: string;
  frete_valor: string;
  seguro_valor: string;
  observacao: string;
  containers: BookingContainer[];
}

function bookingToState(booking: BookingDetail | null | undefined): FormState {
  return {
    cia_aerea_armador: booking?.cia_aerea_armador ?? '',
    mawb_mbl: booking?.mawb_mbl ?? '',
    hawb_hbl: booking?.hawb_hbl ?? '',
    frete_valor: booking?.frete_valor != null ? String(booking.frete_valor) : '',
    seguro_valor: booking?.seguro_valor != null ? String(booking.seguro_valor) : '',
    observacao: booking?.observacao ?? '',
    containers: booking?.containers ?? [],
  };
}

// Stable reference (module scope) so useAutosave's effect doesn't re-run every render.
function buildBookingPayload(values: FormState): UpdateBookingPayload {
  return {
    cia_aerea_armador: values.cia_aerea_armador || null,
    mawb_mbl: values.mawb_mbl || null,
    hawb_hbl: values.hawb_hbl || null,
    frete_valor: values.frete_valor ? parseFloat(values.frete_valor) : null,
    seguro_valor: values.seguro_valor ? parseFloat(values.seguro_valor) : null,
    observacao: values.observacao || null,
    containers: values.containers.length > 0 ? values.containers : null,
  };
}

function masterLabel(modal: ShipmentModal | null): string {
  if (modal === 'AEREO') return 'MAWB';
  if (modal === 'MARITIMO') return 'MBL';
  return 'MAWB / MBL';
}

function houseLabel(modal: ShipmentModal | null): string {
  if (modal === 'AEREO') return 'HAWB';
  if (modal === 'MARITIMO') return 'HBL';
  return 'HAWB / HBL';
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium text-muted-foreground">{children}</label>
  );
}

export function DadosFrete({ processId, modal }: DadosFreteProps) {
  const { booking, isLoading } = useShipmentBooking(processId);
  const [form, setForm] = useState<FormState>(() => bookingToState(null));
  const [seeded, setSeeded] = useState(false);

  // `values` stays null until the initial load completes, mirroring the
  // quotation autosave pattern — this lets useAutosave's own null-guard
  // absorb the window where useDebounce is still catching up to the
  // freshly-loaded `form` (avoids saving a stale empty payload over real
  // data before the debounce settles).
  const { autoSaveStatus: status, markAsSaved } = useAutosave({
    id: processId,
    values: seeded ? form : null,
    buildPayload: buildBookingPayload,
    save: updateShipmentBooking,
  });

  useServerSync(
    booking,
    (b) => {
      const initial = bookingToState(b);
      setForm(initial);
      markAsSaved(initial);
      setSeeded(true);
    },
    { skip: booking === undefined, once: true },
  );

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addContainer = () =>
    setForm((prev) => ({
      ...prev,
      containers: [...prev.containers, { numero: '', tipo: '', tara: null }],
    }));

  const removeContainer = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      containers: prev.containers.filter((_, i) => i !== idx),
    }));

  const updateContainer = (idx: number, field: keyof BookingContainer, value: string) =>
    setForm((prev) => {
      const updated = [...prev.containers];
      updated[idx] = {
        ...updated[idx],
        [field]: field === 'tara' ? (value === '' ? null : parseFloat(value)) : value,
      };
      return { ...prev, containers: updated };
    });

  if (isLoading) return <LoaderComponent />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Dados de Frete</p>
        <AutoSaveIndicator status={status} />
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <FieldLabel>Cia. Aérea / Armador</FieldLabel>
          <Input
            value={form.cia_aerea_armador}
            onChange={(e) => setField('cia_aerea_armador', e.target.value)}
            placeholder="Ex: LATAM, MSC..."
          />
        </div>

        <div className="space-y-1">
          <FieldLabel>{masterLabel(modal)}</FieldLabel>
          <Input
            value={form.mawb_mbl}
            onChange={(e) => setField('mawb_mbl', e.target.value)}
            placeholder="Número master"
          />
        </div>

        <div className="space-y-1">
          <FieldLabel>{houseLabel(modal)}</FieldLabel>
          <Input
            value={form.hawb_hbl}
            onChange={(e) => setField('hawb_hbl', e.target.value)}
            placeholder="Número house"
          />
        </div>

        <div className="space-y-1">
          <FieldLabel>Frete (R$)</FieldLabel>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.frete_valor}
            onChange={(e) => setField('frete_valor', e.target.value)}
            placeholder="0,00"
          />
        </div>

        <div className="space-y-1">
          <FieldLabel>Seguro (R$)</FieldLabel>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.seguro_valor}
            onChange={(e) => setField('seguro_valor', e.target.value)}
            placeholder="0,00"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <FieldLabel>Containers</FieldLabel>
          <Button type="button" variant="outline" size="sm" onClick={addContainer}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar
          </Button>
        </div>

        {form.containers.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum container cadastrado.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_100px_36px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Número</span>
              <span>Tipo</span>
              <span>Tara (kg)</span>
              <span />
            </div>
            {form.containers.map((c, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_100px_36px] gap-2 items-center">
                <Input
                  value={c.numero}
                  onChange={(e) => updateContainer(idx, 'numero', e.target.value)}
                  placeholder="Ex: TCKU1234567"
                />
                <Input
                  value={c.tipo}
                  onChange={(e) => updateContainer(idx, 'tipo', e.target.value)}
                  placeholder="Ex: 40HC"
                />
                <Input
                  type="number"
                  min={0}
                  value={c.tara ?? ''}
                  onChange={(e) => updateContainer(idx, 'tara', e.target.value)}
                  placeholder="Tara"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeContainer(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <FieldLabel>Observação</FieldLabel>
        <Textarea
          value={form.observacao}
          onChange={(e) => setField('observacao', e.target.value)}
          rows={3}
          placeholder="Notas sobre o booking..."
        />
      </div>
    </div>
  );
}
