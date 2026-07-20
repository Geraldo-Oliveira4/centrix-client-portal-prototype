'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import { ProposalPdfUploader } from './proposal-pdf-uploader';
import type { ExistingPortalProposal, PortalProposalExtractedFields, SubmitPortalProposalResponse, TipoContainer } from '@/types/quotation';
import { TIPO_CONTAINER_LABELS } from '@/types/quotation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = ['USD', 'EUR', 'BRL', 'GBP', 'CNY', 'ARS', 'CLP', 'MXN'];
const ROUTE_TYPES = [
  { value: 'DIRETA', label: 'Direta' },
  { value: 'TRANSBORDO', label: 'Transbordo' },
] as const;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function buildProposalSchema(isFCL: boolean, requiresContainerType: boolean) {
  return z.object({
  total_value: z.coerce
    .number({ invalid_type_error: 'Informe um valor numerico' })
    .positive('Deve ser maior que zero'),
  freight_value: z.coerce
    .number({ invalid_type_error: 'Informe um valor numerico' })
    .positive('Deve ser maior que zero'),
  freight_currency: z.string().default('USD'),
  transit_time: z.coerce
    .number({ invalid_type_error: 'Informe um numero inteiro' })
    .int()
    .positive('Deve ser maior que zero'),
  insurance_included: z.boolean(),
  taxes: z.array(
    z.object({
      key: z.string().min(1, 'Informe o nome'),
      value: z.coerce.number({ invalid_type_error: 'Informe um valor numerico' }),
      currency: z.string().default('USD'),
    }),
  ),
  carrier: z.string().optional(),
  validity: z.string().optional(),
  incoterm: z.string().optional(),
  route_type: z.enum(['DIRETA', 'TRANSBORDO']).optional().or(z.literal('')),
  route_detail: z.string().optional(),
  numero_oferta: z.string().optional(),
  ptax_percentual: z.coerce.number().optional().or(z.literal('')),
  prazo_pagamento_dias: z.coerce.number().int().optional().or(z.literal('')),
  seguro_percentual: z.coerce.number().optional().or(z.literal('')),
  seguro_minimo: z.coerce.number().optional().or(z.literal('')),
  frequencia: z.string().optional(),
  free_time_dias: z.coerce.number().int().optional().or(z.literal('')),
  observations: z.string().optional(),
  carga_perigosa: z.enum(['NAO', 'IMO', 'RA']).optional().or(z.literal('')),
  containers_priced: isFCL
    ? z.coerce
        .number({ invalid_type_error: 'Informe um numero inteiro' })
        .int()
        .positive('Deve ser maior que zero')
    : z.coerce.number().int().positive().optional().or(z.literal('')),
  offered_container_type: requiresContainerType
    ? z.string().min(1, 'Selecione o tipo de container ofertado')
    : z.string().optional(),
  });
}

type ProposalFormValues = z.infer<ReturnType<typeof buildProposalSchema>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInitialTaxes(
  taxes_breakdown: Record<string, number>,
  taxes_currency_breakdown: Record<string, string> | null,
): { key: string; value: number; currency: string }[] {
  return Object.entries(taxes_breakdown).map(([key, value]) => ({
    key,
    value,
    currency: taxes_currency_breakdown?.[key] ?? 'USD',
  }));
}

function buildDefaultValues(initialData?: ExistingPortalProposal): ProposalFormValues {
  if (!initialData) {
    return { insurance_included: false, taxes: [], freight_currency: 'USD' } as unknown as ProposalFormValues;
  }
  return {
    total_value: initialData.total_value ?? ('' as unknown as number),
    freight_value: initialData.freight_value ?? ('' as unknown as number),
    freight_currency: initialData.freight_currency ?? 'USD',
    transit_time: initialData.transit_time ?? ('' as unknown as number),
    insurance_included: initialData.insurance_included ?? false,
    carrier: initialData.carrier ?? '',
    validity: initialData.validity ?? '',
    incoterm: initialData.incoterm ?? '',
    route_type: initialData.route_type ?? '',
    route_detail: initialData.route_detail ?? '',
    numero_oferta: initialData.numero_oferta ?? '',
    frequencia: initialData.frequencia ?? '',
    free_time_dias: initialData.free_time_dias ?? '',
    prazo_pagamento_dias: initialData.prazo_pagamento_dias ?? '',
    ptax_percentual: initialData.ptax_percentual ?? '',
    seguro_percentual: initialData.seguro_percentual ?? '',
    seguro_minimo: initialData.seguro_minimo ?? '',
    observations: initialData.observations ?? '',
    carga_perigosa: (initialData.carga_perigosa as 'NAO' | 'IMO' | 'RA' | undefined) ?? undefined,
    containers_priced: initialData.containers_priced ?? ('' as unknown as number),
    offered_container_type: initialData.offered_container_type ?? '',
    taxes: buildInitialTaxes(initialData.taxes_breakdown, initialData.taxes_currency_breakdown),
  };
}

function buildPayload(
  values: ProposalFormValues,
  origin: string | null,
  destination: string | null,
  revisionOfProposalId?: string,
): Record<string, unknown> {
  const taxes_breakdown: Record<string, number> = {};
  const taxes_currency_breakdown: Record<string, string> = {};
  for (const row of values.taxes) {
    if (row.key) {
      taxes_breakdown[row.key] = row.value;
      taxes_currency_breakdown[row.key] = row.currency || 'USD';
    }
  }

  const payload: Record<string, unknown> = {
    total_value: values.total_value,
    freight_value: values.freight_value,
    freight_currency: values.freight_currency || 'USD',
    transit_time: values.transit_time,
    insurance_included: values.insurance_included,
    taxes_breakdown,
    taxes_currency_breakdown,
  };

  if (origin) payload.proposal_origin = origin;
  if (destination) payload.proposal_destination = destination;
  if (revisionOfProposalId) {
    payload.revision_of_proposal_id = revisionOfProposalId;
  } else {
    // Independent new offer — tell the backend not to auto-supersede existing proposals.
    payload.force_new = true;
  }

  if (values.carrier) payload.carrier = values.carrier;
  if (values.validity) payload.validity = values.validity;
  if (values.incoterm) payload.incoterm = values.incoterm;
  if (values.route_type) payload.route_type = values.route_type;
  if (values.route_detail) payload.route_detail = values.route_detail;
  if (values.numero_oferta) payload.numero_oferta = values.numero_oferta;
  if (values.frequencia) payload.frequencia = values.frequencia;
  if (values.observations) payload.observations = values.observations;
  if (values.ptax_percentual !== '' && values.ptax_percentual !== undefined)
    payload.ptax_percentual = Number(values.ptax_percentual);
  if (values.prazo_pagamento_dias !== '' && values.prazo_pagamento_dias !== undefined)
    payload.prazo_pagamento_dias = Number(values.prazo_pagamento_dias);
  if (values.seguro_percentual !== '' && values.seguro_percentual !== undefined)
    payload.seguro_percentual = Number(values.seguro_percentual);
  if (values.seguro_minimo !== '' && values.seguro_minimo !== undefined)
    payload.seguro_minimo = Number(values.seguro_minimo);
  if (values.carga_perigosa) payload.carga_perigosa = values.carga_perigosa;
  if (values.containers_priced !== '' && values.containers_priced !== undefined)
    payload.containers_priced = Number(values.containers_priced);
  if (values.offered_container_type) payload.offered_container_type = values.offered_container_type;
  if (values.free_time_dias !== '' && values.free_time_dias !== undefined)
    payload.free_time_dias = Number(values.free_time_dias);

  return payload;
}

function formatCurrencyTotals(totals: Record<string, number>): string {
  return Object.entries(totals)
    .filter(([, v]) => v > 0)
    .map(([curr, val]) => `${curr} ${val.toFixed(2)}`)
    .join(' + ');
}

// ---------------------------------------------------------------------------
// OfferCard — one proposal form, self-contained PDF extraction
// ---------------------------------------------------------------------------

interface OfferCardRef {
  getPayload: () => Promise<Record<string, unknown> | null>;
  getIsDirty: () => boolean;
}

interface OfferCardProps {
  index: number;
  canRemove: boolean;
  onRemove: () => void;
  defaultOrigin: string | null;
  defaultDestination: string | null;
  token: string;
  apiUrl: string;
  initialData?: ExistingPortalProposal;
  revisionOfProposalId?: string;
  isFCL: boolean;
  totalContainers: number;
  requestedContainerTypes: string[];
  insuranceRequired: boolean;
}

const OfferCard = forwardRef<OfferCardRef, OfferCardProps>(
  (
    {
      index,
      canRemove,
      onRemove,
      defaultOrigin,
      defaultDestination,
      token,
      apiUrl,
      initialData,
      revisionOfProposalId,
      isFCL,
      totalContainers,
      requestedContainerTypes,
      insuranceRequired,
    },
    ref,
  ) => {
    const isRevision = !!revisionOfProposalId;
    const requiresContainerType = isFCL && requestedContainerTypes.length > 0;
    const [sourcePdfS3Key, setSourcePdfS3Key] = useState<string | null>(null);
    const [showPdfError, setShowPdfError] = useState(false);

    const {
      register,
      control,
      setValue,
      watch,
      getValues,
      trigger,
      reset,
      formState: { errors, isDirty },
    } = useForm<ProposalFormValues>({
      resolver: zodResolver(buildProposalSchema(isFCL, requiresContainerType)),
      defaultValues: {
        ...buildDefaultValues(initialData),
        // When insurance is required by the quotation, force it on
        ...(insuranceRequired && !initialData ? { insurance_included: true } : {}),
      },
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'taxes' });
    const insuranceIncluded = watch('insurance_included');

    // Extraction failed but the PDF is in S3. Retain the key so submission is
    // not blocked — the agent fills the form manually.
    const handleAttachedWithoutExtraction = (s3Key: string) => {
      setSourcePdfS3Key(s3Key);
      setShowPdfError(false);
    };

    const handleExtracted = (extractedFields: PortalProposalExtractedFields, s3Key: string) => {
      setSourcePdfS3Key(s3Key);
      setShowPdfError(false);
      const taxes = Object.entries(extractedFields.taxes_breakdown ?? {}).map(([key, value]) => ({
        key,
        value,
        currency: extractedFields.taxes_currency_breakdown?.[key] ?? 'USD',
      }));
      reset(
        {
          total_value: extractedFields.total_value ?? undefined,
          freight_value: extractedFields.freight_value ?? undefined,
          freight_currency: extractedFields.freight_currency ?? 'USD',
          transit_time: extractedFields.transit_time ?? undefined,
          insurance_included: insuranceRequired ? true : (extractedFields.insurance_included ?? false),
          carrier: extractedFields.carrier ?? undefined,
          incoterm: extractedFields.incoterm ?? undefined,
          route_type: extractedFields.route_type ?? undefined,
          route_detail: extractedFields.route_detail ?? undefined,
          validity: extractedFields.validity ?? undefined,
          numero_oferta: extractedFields.numero_oferta ?? undefined,
          frequencia: extractedFields.frequencia ?? undefined,
          prazo_pagamento_dias: extractedFields.prazo_pagamento_dias ?? undefined,
          free_time_dias: extractedFields.free_time_dias ?? undefined,
          observations: extractedFields.observations ?? undefined,
          taxes,
        },
        // Extraction runs in the background while the agent may already be typing.
        // Only overwrite fields they haven't touched yet — never clobber manual edits.
        { keepDirtyValues: true },
      );
    };

    useImperativeHandle(ref, () => ({
      getPayload: async () => {
        if (!isRevision && !sourcePdfS3Key) {
          setShowPdfError(true);
          return null;
        }
        const valid = await trigger();
        if (!valid) return null;
        const payload = buildPayload(getValues(), defaultOrigin, defaultDestination, revisionOfProposalId);
        if (sourcePdfS3Key) payload.source_pdf_s3_key = sourcePdfS3Key;
        return payload;
      },
      getIsDirty: () => isDirty,
    }));

    const taxes = watch('taxes');
    const freightValue = Number(watch('freight_value')) || 0;
    const freightCurrency = watch('freight_currency') || 'USD';
    const totalValue = Number(watch('total_value')) || 0;

    const taxTotals = taxes.reduce(
      (acc, t) => {
        const curr = t.currency || 'USD';
        acc[curr] = (acc[curr] || 0) + (Number(t.value) || 0);
        return acc;
      },
      {} as Record<string, number>,
    );

    const allTotals: Record<string, number> = { ...taxTotals };
    if (freightValue > 0) {
      allTotals[freightCurrency] = (allTotals[freightCurrency] || 0) + freightValue;
    }

    const cardTitle = isRevision
      ? `Oferta ${initialData?.numero_oferta || index + 1} — v${initialData!.version}`
      : `Nova oferta`;

    return (
      <Card className={isRevision ? 'border-blue-200' : undefined}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{cardTitle}</CardTitle>
              {isRevision && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded-full px-2 py-0.5">
                  <RefreshCw className="w-3 h-3" />
                  Revisao
                </span>
              )}
            </div>
            {canRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Remover
              </Button>
            )}
          </div>
          {isRevision && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Dados da versao {initialData!.version} pre-preenchidos. Edite os campos e envie para criar a versao {initialData!.version + 1}.
            </p>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {/* PDF uploader — required for new offers */}
          <ProposalPdfUploader
            token={token}
            apiUrl={apiUrl}
            onExtracted={handleExtracted}
            onAttachedWithoutExtraction={handleAttachedWithoutExtraction}
            showError={showPdfError}
          />

          {/* Routing — pre-filled from quotation, read-only */}
          {(defaultOrigin || defaultDestination) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-md bg-muted/40 border px-4 py-3">
              {defaultOrigin && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Origem
                  </span>
                  <span className="text-sm font-medium">{defaultOrigin}</span>
                </div>
              )}
              {defaultDestination && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Destino
                  </span>
                  <span className="text-sm font-medium">{defaultDestination}</span>
                </div>
              )}
            </div>
          )}

          {/* Core values */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`total_value_${index}`}>Valor total *</Label>
              <Input
                id={`total_value_${index}`}
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('total_value')}
                className={cn(errors.total_value && 'border-destructive')}
              />
              {errors.total_value && (
                <p className="text-xs text-destructive">{errors.total_value.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`freight_value_${index}`}>Frete *</Label>
              <div className="flex gap-1">
                <Input
                  id={`freight_value_${index}`}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('freight_value')}
                  className={cn('flex-1', errors.freight_value && 'border-destructive')}
                />
                <select
                  {...register('freight_currency')}
                  className="h-10 w-20 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {errors.freight_value && (
                <p className="text-xs text-destructive">{errors.freight_value.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`transit_time_${index}`}>Transit time (dias) *</Label>
              <Input
                id={`transit_time_${index}`}
                type="number"
                placeholder="0"
                {...register('transit_time')}
                className={cn(errors.transit_time && 'border-destructive')}
              />
              {errors.transit_time && (
                <p className="text-xs text-destructive">{errors.transit_time.message}</p>
              )}
            </div>

            {isFCL && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`containers_priced_${index}`}>
                  Containers precificados *
                  {totalContainers > 0 && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      (cotacao solicita {totalContainers})
                    </span>
                  )}
                </Label>
                <Input
                  id={`containers_priced_${index}`}
                  type="number"
                  placeholder={String(totalContainers || 0)}
                  {...register('containers_priced')}
                  className={cn(errors.containers_priced && 'border-destructive')}
                />
                {errors.containers_priced && (
                  <p className="text-xs text-destructive">{String(errors.containers_priced.message)}</p>
                )}
              </div>
            )}

            {requiresContainerType && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`offered_container_type_${index}`}>Tipo de container ofertado *</Label>
                <Combobox
                  value={watch('offered_container_type') || ''}
                  onValueChange={(v) => setValue('offered_container_type', v, { shouldValidate: true, shouldDirty: true })}
                  options={requestedContainerTypes.map((t) => ({
                    value: t,
                    label: TIPO_CONTAINER_LABELS[t as TipoContainer] ?? t,
                  }))}
                  placeholder="Selecionar..."
                  searchPlaceholder="Buscar container..."
                />
                {errors.offered_container_type && (
                  <p className="text-xs text-destructive">{String(errors.offered_container_type.message)}</p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5 justify-end pb-1">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`insurance_${index}`}
                    checked={insuranceIncluded}
                    onCheckedChange={(v) => !insuranceRequired && setValue('insurance_included', v)}
                    disabled={insuranceRequired}
                  />
                  <Label htmlFor={`insurance_${index}`} className={cn('cursor-pointer', insuranceRequired && 'cursor-default')}>
                    Seguro incluido
                  </Label>
                </div>
                {insuranceRequired && (
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 font-medium">
                    Obrigatorio conforme cotacao
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Route */}
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`route_type_${index}`} className="font-semibold">
                Tipo de rota
              </Label>
              <select
                id={`route_type_${index}`}
                {...register('route_type')}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecionar...</option>
                {ROUTE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`route_${index}`} className="font-semibold">
                Detalhe da rota / conexao
              </Label>
              <Input
                id={`route_${index}`}
                placeholder="Ex: GRU-YYZ, FRA-MAD/LIS-GRU+DTA NVT"
                {...register('route_detail')}
              />
            </div>
          </div>

          {/* Optional identification fields */}
          <div className="border-t pt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`carrier_${index}`}>Armador / Cia. aerea</Label>
              <Input
                id={`carrier_${index}`}
                placeholder="Ex: MSC, LATAM"
                {...register('carrier')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`numero_oferta_${index}`}>N° da oferta</Label>
              <Input
                id={`numero_oferta_${index}`}
                placeholder="Ref. interna"
                {...register('numero_oferta')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`validity_${index}`}>Validade</Label>
              <Input id={`validity_${index}`} type="date" {...register('validity')} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`incoterm_${index}`}>Incoterm</Label>
              <Input
                id={`incoterm_${index}`}
                placeholder="Ex: FOB, CIF"
                {...register('incoterm')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`carga_perigosa_${index}`}>Carga Perigosa</Label>
              <select
                id={`carga_perigosa_${index}`}
                {...register('carga_perigosa')}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecionar...</option>
                <option value="NAO">Nao</option>
                <option value="IMO">IMO</option>
                <option value="RA">RA</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`frequencia_${index}`}>Frequencia</Label>
              <Input
                id={`frequencia_${index}`}
                placeholder="Ex: Semanal"
                {...register('frequencia')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`free_time_${index}`}>Free time (dias)</Label>
              <Input
                id={`free_time_${index}`}
                type="number"
                placeholder="0"
                {...register('free_time_dias')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`prazo_pagamento_${index}`}>Prazo pagamento (dias)</Label>
              <Input
                id={`prazo_pagamento_${index}`}
                type="number"
                placeholder="0"
                {...register('prazo_pagamento_dias')}
              />
            </div>
          </div>

          {/* Observations */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`observations_${index}`}>Observacoes</Label>
            <textarea
              id={`observations_${index}`}
              rows={3}
              placeholder="Condicoes especiais, notas do agente, observacoes da proposta..."
              {...register('observations')}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
            />
          </div>

          {/* Costs table */}
          <div className="border-t pt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Composicao de custos</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ key: '', value: 0, currency: 'USD' })}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Adicionar item
              </Button>
            </div>

            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Custo
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24">
                      Moeda
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36">
                      Valor
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {/* Frete — read-only row mirroring the freight_value field */}
                  <tr className="border-b bg-muted/20">
                    <td className="px-3 py-2 text-sm font-medium text-muted-foreground">Frete</td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">{freightCurrency}</td>
                    <td className="px-3 py-2 text-right text-sm text-muted-foreground">
                      {freightValue > 0 ? freightValue.toFixed(2) : '—'}
                    </td>
                    <td />
                  </tr>

                  {fields.map((field, i) => (
                    <tr key={field.id} className="border-b last:border-0">
                      <td className="px-3 py-1.5">
                        <Input
                          placeholder="Nome (ex: BL Fee)"
                          {...register(`taxes.${i}.key`)}
                          className={cn(
                            'h-8 border-0 shadow-none focus-visible:ring-0 px-0',
                            errors.taxes?.[i]?.key && 'border-b border-destructive rounded-none',
                          )}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          {...register(`taxes.${i}.currency`)}
                          className="h-8 w-20 rounded-sm border border-input bg-background px-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...register(`taxes.${i}.value`)}
                          className="h-8 border-0 shadow-none focus-visible:ring-0 px-0 text-right"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => remove(i)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {fields.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-xs text-muted-foreground">
                        Clique em "Adicionar item" para detalhar os custos adicionais.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 border-t">
                    <td
                      colSpan={2}
                      className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                    >
                      Total
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-sm">
                      {formatCurrencyTotals(allTotals) || '—'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Insurance fields */}
          {insuranceIncluded && (
            <div className="border-t pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`seguro_pct_${index}`}>Seguro (%)</Label>
                <Input
                  id={`seguro_pct_${index}`}
                  type="number"
                  step="0.0001"
                  placeholder="0.0000"
                  {...register('seguro_percentual')}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`seguro_min_${index}`}>Seguro minimo (USD)</Label>
                <Input
                  id={`seguro_min_${index}`}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('seguro_minimo')}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`ptax_${index}`}>PTAX (%)</Label>
                <Input
                  id={`ptax_${index}`}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('ptax_percentual')}
                />
              </div>
            </div>
          )}

          {/* Summary footer */}
          <div className="border-t pt-3 flex items-center justify-end gap-2 text-sm">
            <span className="text-muted-foreground font-medium">Valor total da oferta:</span>
            <span className="font-bold text-base">USD {totalValue.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
    );
  },
);

OfferCard.displayName = 'OfferCard';

// ---------------------------------------------------------------------------
// OfferEntry — internal state shape for each card
// ---------------------------------------------------------------------------

interface OfferEntry {
  id: string;
  initialData?: ExistingPortalProposal;
  revisionOfProposalId?: string;
}

// ---------------------------------------------------------------------------
// ProposalForm — manages list of offers
// ---------------------------------------------------------------------------

interface ProposalFormProps {
  token: string;
  apiUrl: string;
  onSubmitted: () => void;
  onDeclined: (reason: string | null) => void;
  defaultOrigin: string | null;
  defaultDestination: string | null;
  existingProposals: ExistingPortalProposal[];
  isFCL: boolean;
  totalContainers: number;
  requestedContainerTypes: string[];
  insuranceRequired: boolean;
}

export function ProposalForm({
  token,
  apiUrl,
  onSubmitted,
  onDeclined,
  defaultOrigin,
  defaultDestination,
  existingProposals,
  isFCL,
  totalContainers,
  requestedContainerTypes,
  insuranceRequired,
}: ProposalFormProps) {
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [isDeclining, setIsDeclining] = useState(false);

  const handleDeclineConfirm = async () => {
    setIsDeclining(true);
    try {
      await axios.post(
        `${apiUrl}/public/rfq/decline`,
        { reason: declineReason.trim() || null },
        { params: { token } },
      );
      setDeclineDialogOpen(false);
      onDeclined(declineReason.trim() || null);
    } catch {
      toast.error('Erro ao declinar. Tente novamente.');
    } finally {
      setIsDeclining(false);
    }
  };

  const [offers, setOffers] = useState<OfferEntry[]>(() => {
    if (existingProposals.length > 0) {
      return existingProposals.map((p) => ({
        id: crypto.randomUUID(),
        initialData: p,
        revisionOfProposalId: p.id,
      }));
    }
    return [{ id: crypto.randomUUID() }];
  });

  const refsMap = useRef<Map<string, OfferCardRef>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([]);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [submittedProposals, setSubmittedProposals] = useState<ExistingPortalProposal[]>([]);

  const addOffer = () => setOffers((prev) => [...prev, { id: crypto.randomUUID() }]);

  const removeOffer = (id: string) => {
    refsMap.current.delete(id);
    setOffers((prev) => prev.filter((o) => o.id !== id));
  };

  const submitAll = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitWarnings([]);

    // Skip revision cards where nothing was changed — only new offers and dirty revisions go through
    const offersToSubmit = offers.filter((entry) => {
      const ref = refsMap.current.get(entry.id);
      if (!ref) return false;
      if (entry.revisionOfProposalId && !ref.getIsDirty()) return false;
      return true;
    });

    if (offersToSubmit.length === 0) {
      setSubmitError('Nenhuma alteracao detectada. Edite os campos de uma oferta existente ou adicione uma nova oferta antes de enviar.');
      setIsSubmitting(false);
      return;
    }

    let payloads: (Record<string, unknown> | null)[];
    try {
      payloads = await Promise.all(
        offersToSubmit.map(async (entry) => {
          const ref = refsMap.current.get(entry.id);
          return ref ? ref.getPayload() : null;
        }),
      );
    } catch {
      setSubmitError('Erro ao preparar as propostas. Tente novamente.');
      setIsSubmitting(false);
      return;
    }

    if (payloads.some((p) => p === null)) {
      setSubmitError('Corrija os erros nas propostas antes de enviar.');
      setIsSubmitting(false);
      return;
    }

    const submitted: ExistingPortalProposal[] = [];

    for (const payload of payloads) {
      try {
        const res = await fetch(`${apiUrl}/public/rfq/submit?token=${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.status === 201) {
          const data: Partial<SubmitPortalProposalResponse> = await res.json().catch(() => ({}));
          const warnings = Array.isArray(data.warnings) ? data.warnings : [];
          if (warnings.length > 0) {
            setSubmitWarnings((prev) => [...prev, ...warnings]);
          }
          if (data.proposal) {
            submitted.push(data.proposal);
          }
          continue;
        }

        if (res.status === 410) {
          setSubmitError('Esta cotacao nao esta mais aceitando propostas.');
          setIsSubmitting(false);
          return;
        }

        const data = await res.json().catch(() => ({}));
        const details = Array.isArray(data.details) ? data.details.join('. ') : '';
        setSubmitError(details || data.error || 'Erro ao enviar proposta. Tente novamente.');
        setIsSubmitting(false);
        return;
      } catch {
        setSubmitError('Erro de conexao. Verifique sua internet e tente novamente.');
        setIsSubmitting(false);
        return;
      }
    }

    toast.success('Proposta enviada com sucesso!');
    setSubmittedProposals(submitted);
    setSuccessDialogOpen(true);
    onSubmitted();
    setIsSubmitting(false);
  };

  const newCount = offers.filter((o) => !o.revisionOfProposalId).length;

  function buildSubmitLabel() {
    if (newCount === 0) return 'Enviar revisoes';
    if (newCount === 1 && offers.length === 1) return 'Enviar proposta';
    return 'Enviar propostas';
  }

  return (
    <div className="flex flex-col gap-4">
      {offers.map((entry, index) => (
        <OfferCard
          key={entry.id}
          index={index}
          canRemove={offers.length > 1}
          onRemove={() => removeOffer(entry.id)}
          defaultOrigin={defaultOrigin}
          defaultDestination={defaultDestination}
          token={token}
          apiUrl={apiUrl}
          initialData={entry.initialData}
          revisionOfProposalId={entry.revisionOfProposalId}
          isFCL={isFCL}
          totalContainers={totalContainers}
          requestedContainerTypes={requestedContainerTypes}
          insuranceRequired={insuranceRequired}
          ref={(el) => {
            if (el) refsMap.current.set(entry.id, el);
            else refsMap.current.delete(entry.id);
          }}
        />
      ))}

      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={addOffer}
          disabled={isSubmitting}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar nova oferta
        </Button>

        <div className="flex flex-col items-end gap-2">
          {submitWarnings.length > 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 max-w-sm text-right space-y-1">
              {submitWarnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          )}
          {submitError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 max-w-sm text-right">
              {submitError}
            </p>
          )}
          <Button onClick={submitAll} disabled={isSubmitting} size="lg">
            {isSubmitting ? 'Enviando...' : buildSubmitLabel()}
          </Button>
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => setDeclineDialogOpen(true)}
          disabled={isSubmitting}
        >
          Nao consigo atender esta cotacao
        </Button>
      </div>

      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent className="dialog-content-sm">
          <DialogHeader>
            <DialogTitle>Declinar cotacao</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm text-muted-foreground">
              Confirme que voce nao consegue atender esta cotacao. Isso sera registrado para a equipe responsavel.
            </p>
            <div className="flex flex-col gap-1">
              <Label htmlFor="decline-reason" className="text-sm">
                Motivo (opcional)
              </Label>
              <Textarea
                id="decline-reason"
                placeholder="Ex: Sem espaco no navio para essa data"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeclineDialogOpen(false)}
              disabled={isDeclining}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeclineConfirm}
              disabled={isDeclining}
            >
              {isDeclining ? 'Registrando...' : 'Confirmar declinio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="dialog-content-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              Cotacao enviada com sucesso
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm text-muted-foreground">
              {submittedProposals.length === 1
                ? 'Sua oferta foi recebida. Resumo do que foi enviado:'
                : `Suas ${submittedProposals.length} ofertas foram recebidas. Resumo do que foi enviado:`}
            </p>
            <div className="flex flex-col gap-2">
              {submittedProposals.map((p) => (
                <div key={p.id} className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex flex-col gap-0.5">
                  {p.numero_oferta && <span className="font-medium">{p.numero_oferta}</span>}
                  <span>
                    Valor total:{' '}
                    {p.total_value != null
                      ? `${p.freight_currency ?? ''} ${p.total_value}`.trim()
                      : 'N/A'}
                  </span>
                  {p.carrier && (
                    <span className="text-muted-foreground">Transportadora: {p.carrier}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setSuccessDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
