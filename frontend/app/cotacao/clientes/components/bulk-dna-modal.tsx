'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@/components/ui';
import { useClients } from '@/hooks/use-clients';
import {
  BulkDnaUpdateFields,
  INSURANCE_RESPONSIBILITY_LABELS,
  LOGISTICS_TYPE_LABELS,
  MODAL_LABELS,
  PRICE_OR_PERFORMANCE_LABELS,
  QuotationClient,
  ServiceType,
  TIPO_EMBARQUE_LABELS,
} from '@/types/client';

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

// Which operations the bulk change applies to.
const SCOPE_OPTIONS: { label: string; value: ServiceType[] }[] = [
  { label: 'Ambos', value: ['IMPORTACAO', 'EXPORTACAO'] },
  { label: 'Importação', value: ['IMPORTACAO'] },
  { label: 'Exportação', value: ['EXPORTACAO'] },
];

type FieldType = 'select' | 'text' | 'textarea' | 'boolean';

interface FieldConfig {
  key: keyof BulkDnaUpdateFields;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

// Fields the bulk editor may write, mirroring the backend whitelist in
// lambdas/client/bulk_update_client_dna. Excludes per-client fields
// (contact_name/contact_email) and complex JSONB editors (default_agents,
// anvisa_restrictions), which stay on the single-client modal.
const FIELDS: FieldConfig[] = [
  {
    key: 'insurance_responsibility',
    label: 'Responsabilidade pelo Seguro',
    type: 'select',
    options: toOptions(INSURANCE_RESPONSIBILITY_LABELS),
  },
  {
    key: 'modality',
    label: 'Modalidade',
    type: 'select',
    options: toOptions(MODAL_LABELS),
  },
  {
    key: 'tipo_embarque',
    label: 'Tipo de Embarque',
    type: 'select',
    options: toOptions(TIPO_EMBARQUE_LABELS),
  },
  {
    key: 'logistics_type',
    label: 'Tipo de Logística',
    type: 'select',
    options: toOptions(LOGISTICS_TYPE_LABELS),
  },
  {
    key: 'price_or_performance',
    label: 'Preço ou Performance',
    type: 'select',
    options: toOptions(PRICE_OR_PERFORMANCE_LABELS),
  },
  { key: 'preferred_embarque_local', label: 'Local de Embarque Preferido', type: 'text', placeholder: 'Ex: Porto de Itajaí' },
  { key: 'destination_yard_aereo', label: 'Recinto de Destino — Aéreo', type: 'text', placeholder: 'Ex: NVT' },
  { key: 'destination_yard_maritimo_fcl', label: 'Recinto de Destino — Marítimo FCL', type: 'text', placeholder: 'Ex: Recinto Santos' },
  { key: 'destination_yard_maritimo_lcl', label: 'Recinto de Destino — Marítimo LCL', type: 'text', placeholder: 'Ex: Recinto Poly' },
  { key: 'cargo_profile', label: 'Perfil de Carga', type: 'text', placeholder: 'Ex: Alimentos' },
  { key: 'assigned_analyst', label: 'Analista Responsável', type: 'text', placeholder: 'ID do analista' },
  { key: 'dangerous_cargo_shipper', label: 'Shipper com Cargas Perigosas', type: 'boolean' },
  { key: 'exige_oea', label: 'Exige OEA', type: 'boolean' },
  { key: 'quotation_particularities', label: 'Particularidades para Cotar', type: 'textarea', placeholder: 'Ex: Sem transbordo, T1 obrigatório...' },
];

interface BulkDnaModalProps {
  clients: QuotationClient[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}

export function BulkDnaModal({ clients, open, onOpenChange, onApplied }: BulkDnaModalProps) {
  const { bulkUpdateDna } = useClients();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [scopeIndex, setScopeIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setEnabled({});
      setValues({});
      setScopeIndex(0);
      setIsSubmitting(false);
    }
  }, [open]);

  const toggleField = (key: string) =>
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));

  const setValue = (key: string, value: string | boolean) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const enabledFields = FIELDS.filter((f) => enabled[f.key]);
  const canSubmit = enabledFields.length > 0 && clients.length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    const dna_update: Partial<Record<keyof BulkDnaUpdateFields, string | boolean>> = {};
    for (const field of enabledFields) {
      const raw = values[field.key];
      if (field.type === 'boolean') {
        dna_update[field.key] = !!raw;
      } else if (raw !== undefined) {
        // Empty text is intentionally sent so the analyst can clear a field.
        // Enums with no selection stay undefined and are dropped here.
        dna_update[field.key] = raw;
      }
    }

    setIsSubmitting(true);
    const ok = await bulkUpdateDna({
      client_ids: clients.map((c) => c.id),
      service_types: SCOPE_OPTIONS[scopeIndex].value,
      dna_update: dna_update as BulkDnaUpdateFields,
    });
    setIsSubmitting(false);
    if (ok) {
      onOpenChange(false);
      onApplied?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atualizar DNA em massa</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              A alteração será aplicada a{' '}
              <strong>{clients.length}</strong> cliente(s). Apenas os campos marcados
              serão sobrescritos; os demais permanecem inalterados. Clientes sem DNA
              cadastrado são ignorados.
            </p>
            <ScrollArea className="max-h-24 rounded-md border p-2">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {clients.map((c) => (
                  <span key={c.id}>{c.name}</span>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Aplicar em</Label>
            <div className="flex items-center gap-2">
              {SCOPE_OPTIONS.map((opt, idx) => (
                <Button
                  key={opt.label}
                  type="button"
                  size="sm"
                  variant={scopeIndex === idx ? 'default' : 'outline'}
                  onClick={() => setScopeIndex(idx)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col divide-y divide-border">
            {FIELDS.map((field) => {
              const isOn = !!enabled[field.key];
              return (
                <div key={field.key} className="flex items-start gap-3 py-3">
                  <Checkbox
                    id={`enable-${field.key}`}
                    checked={isOn}
                    onCheckedChange={() => toggleField(field.key)}
                    className="mt-1"
                  />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label htmlFor={`enable-${field.key}`} className="cursor-pointer">
                      {field.label}
                    </Label>
                    {isOn && (
                      <BulkFieldInput
                        field={field}
                        value={values[field.key]}
                        onChange={(v) => setValue(field.key, v)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              {isSubmitting
                ? 'Aplicando...'
                : `Aplicar a ${clients.length} cliente(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BulkFieldInputProps {
  field: FieldConfig;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}

function BulkFieldInput({ field, value, onChange }: BulkFieldInputProps) {
  if (field.type === 'select') {
    return (
      <Select value={(value as string) ?? ''} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecionar..." />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === 'textarea') {
    return (
      <Textarea
        placeholder={field.placeholder}
        className="resize-none"
        rows={3}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === 'boolean') {
    return (
      <Switch checked={!!value} onCheckedChange={onChange} />
    );
  }

  return (
    <Input
      placeholder={field.placeholder}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
