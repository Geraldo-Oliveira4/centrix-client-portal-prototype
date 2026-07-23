'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UploadCloud, X } from 'lucide-react';
import {
  Button,
  Combobox,
  MultiCombobox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@/components/ui';
import {
  AIRPORTS_DEPARTURE_OPTIONS,
  AIRPORTS_DESTINATION_OPTIONS,
  INCOTERM_OPTIONS,
  PORTS_DEPARTURE_OPTIONS,
  PORTS_DESTINATION_OPTIONS,
} from '@/constants';
import { cn } from '@/lib/utils';
import { createQuotation } from '@/hooks/use-quotations';
import { uploadFileToS3 } from '@/lib/upload-file';
import { defaultDeadlineDatetimeLocal, dnaInsuranceDefault, getFieldVisibility, parseBool, parseBrNumber, resolveDnaDestinationYard, todayISODate } from '@/utils/quotation-fields';
import type {
  CargaPerigosa,
  CreateEquipmentItem,
  CreateVolumeItem,
  Currency,
  Quotation,
  QuotationModal,
  ServiceType,
  TipoCotacao,
  TipoEmbarque,
} from '@/types/quotation';
import type { ClientDna, PriceOrPerformance } from '@/types/client';
import { CardSection } from '@arboria-tech/arboria-ui';
import { ACCEPTED_UPLOAD_TYPES, getFileIcon } from '@/lib/file-icons';
import { EquipmentDialog } from './equipment-dialog';
import { EquipmentsTable } from './equipments-table';
import { VolumeDialog } from './volume-dialog';
import { VolumesTable } from './volumes-table';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const manualFormSchema = z.object({
  // Embarque
  tipo_cotacao: z.enum(['REAL', 'ESTIMATIVA']).optional(),
  data_cotacao: z.string().optional(),
  service_type: z.enum(['IMPORTACAO', 'EXPORTACAO']).optional(),
  modal: z.enum(['AEREO', 'MARITIMO', 'RODOVIARIO']).optional(),
  tipo_embarque: z.enum(['FCL', 'LCL', 'BREAK_BULK']).optional(),
  origin: z.string().optional(),
  porto_embarque: z.string().optional(),
  porto_destino: z.array(z.string()).optional(),
  aeroporto_embarque: z.string().optional(),
  aeroporto_destino: z.array(z.string()).optional(),
  incluir_entrega_destino_final: z.enum(['', 'true', 'false']).optional(),
  endereco_entrega_final: z.string().optional(),
  incoterm: z.string().optional(),
  ptax_negociada: z.string().optional(),
  price_or_performance: z.enum(['', 'PRECO', 'PERFORMANCE']).optional(),
  // Mercadoria
  product: z.string().optional(),
  carga_perigosa: z.enum(['NAO', 'RA', 'IMO']).optional(),
  un_number: z.string().optional(),
  imo_class: z.string().optional(),
  stackability: z.enum(['', 'true', 'false']).optional(),
  carga_tombavel: z.enum(['', 'true', 'false']).optional(),
  temperatura_min: z.string().optional(),
  temperatura_max: z.string().optional(),
  // Condicoes
  desired_deadline: z.string().optional(),
  data_prontidao: z.string().min(1, 'Data de prontidão é obrigatória'),
  data_limite_necessidade: z.string().optional(),
  declared_value: z.string().optional(),
  declared_value_currency: z.enum(['BRL', 'USD', 'EUR', 'GBP', 'CNY', 'ARS', 'CLP', 'MXN', 'CHF']).optional(),
  insurance_required: z.enum(['', 'true', 'false']).optional(),
  destination_yard: z.string().optional(),
  client_reference: z.string().optional(),
  observations: z.string().optional(),
});

type ManualFormValues = z.infer<typeof manualFormSchema>;

interface ManualFormProps {
  clientId: string | null;
  onQuotationCreated: (quotation: Quotation) => void;
  disabled?: boolean;
  clientDna?: ClientDna | null;
  attachmentFiles?: File[];
  onAttachmentFilesChange?: (files: File[]) => void;
  createFn?: typeof createQuotation;
  /**
   * Optional exporter step. The portal renders its own self-service selector
   * here (pick an existing exporter or register a new one); the analyst screen
   * passes nothing and the block is omitted entirely. Kept as a slot so this
   * shared form does not have to import portal-only components.
   */
  exporterSection?: React.ReactNode;
  /** Exporter chosen in `exporterSection`, submitted as `exporter_id`. */
  exporterId?: string | null;
}

export function ManualForm({ clientId, onQuotationCreated, disabled, clientDna, attachmentFiles, onAttachmentFilesChange, createFn = createQuotation, exporterSection, exporterId }: ManualFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraggingAttachments, setIsDraggingAttachments] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [equipments, setEquipments] = useState<CreateEquipmentItem[]>([]);
  const [volumes, setVolumes] = useState<CreateVolumeItem[]>([]);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [editingEquipmentIndex, setEditingEquipmentIndex] = useState<number | null>(null);
  const [volumeDialogOpen, setVolumeDialogOpen] = useState(false);
  const [editingVolumeIndex, setEditingVolumeIndex] = useState<number | null>(null);
  const [showRefrigerada, setShowRefrigerada] = useState(false);
  const [agenteDefineLocalColeta, setAgenteDefineLocalColeta] = useState(false);
  const [agenteDefinePortoEmbarque, setAgenteDefinePortoEmbarque] = useState(false);
  const [agenteDefinePortoDestino, setAgenteDefinePortoDestino] = useState(false);
  const [agenteDefineAeroportoEmbarque, setAgenteDefineAeroportoEmbarque] = useState(false);
  const [agenteDefineAeroportoDestino, setAgenteDefineAeroportoDestino] = useState(false);

  const form = useForm<ManualFormValues>({
    resolver: zodResolver(manualFormSchema),
    defaultValues: {
      tipo_cotacao: undefined,
      data_cotacao: todayISODate(),
      service_type: undefined,
      modal: undefined,
      tipo_embarque: undefined,
      origin: '',
      porto_embarque: '',
      porto_destino: [],
      aeroporto_embarque: '',
      aeroporto_destino: [],
      incluir_entrega_destino_final: '',
      endereco_entrega_final: '',
      incoterm: undefined,
      ptax_negociada: undefined,
      price_or_performance: '',
      product: '',
      carga_perigosa: undefined,
      un_number: '',
      imo_class: '',
      stackability: '',
      carga_tombavel: '',
      temperatura_min: '',
      temperatura_max: '',
      desired_deadline: defaultDeadlineDatetimeLocal(2),
      data_prontidao: '',
      data_limite_necessidade: '',
      declared_value: '',
      declared_value_currency: 'BRL',
      insurance_required: '',
      destination_yard: '',
      client_reference: '',
      observations: '',
    },
  });

  const watchModal = form.watch('modal');
  const watchTipoEmbarque = form.watch('tipo_embarque');
  const watchCargaPerigosa = form.watch('carga_perigosa');
  const watchServiceType = form.watch('service_type');

  const {
    isMaritime,
    isAir,
    isRoad,
    isFCL,
    isExportation,
    showDestinationYard,
    showVolumeSection,
    showUnNumber,
    showImoClass,
  } = getFieldVisibility({
    modal: watchModal,
    tipo_embarque: watchTipoEmbarque,
    carga_perigosa: watchCargaPerigosa,
    service_type: watchServiceType,
  });

  // Track which client's DNA has already been applied so that clearing a field
  // and triggering a re-render (or a component remount) does not re-populate it.
  const appliedDnaClientIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!clientDna) {
      appliedDnaClientIdRef.current = null;
      return;
    }
    // Skip if we have already applied suggestions for this client in this session.
    if (appliedDnaClientIdRef.current === clientDna.client_id) return;
    appliedDnaClientIdRef.current = clientDna.client_id;

    const current = form.getValues();
    if (!current.modal && clientDna.modality) {
      form.setValue('modal', clientDna.modality as ManualFormValues['modal']);
    }
    if (!current.tipo_embarque && clientDna.tipo_embarque) {
      form.setValue('tipo_embarque', clientDna.tipo_embarque as ManualFormValues['tipo_embarque']);
    }
    if (!current.destination_yard) {
      // Modal may be empty if being set for the first time in this same effect.
      const modal = current.modal || clientDna.modality || null;
      const tipoEmbarque = current.tipo_embarque || clientDna.tipo_embarque || null;
      const yard = resolveDnaDestinationYard(clientDna, modal, tipoEmbarque);
      if (yard) form.setValue('destination_yard', yard);
    }
    if (!current.price_or_performance && clientDna.price_or_performance) {
      form.setValue('price_or_performance', clientDna.price_or_performance);
    }
    if (!current.product && clientDna.cargo_profile) {
      form.setValue('product', clientDna.cargo_profile);
    }
    if (!current.insurance_required) {
      const d = dnaInsuranceDefault(clientDna.insurance_responsibility?.value);
      if (d) form.setValue('insurance_required', d);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientDna]);

  const cargaPerigosaActive = watchCargaPerigosa !== undefined && watchCargaPerigosa !== 'NAO';

  const handleAttachmentFiles = useCallback(
    (incoming: globalThis.File[]) => {
      if (!onAttachmentFilesChange) return;
      const existing = new Set((attachmentFiles ?? []).map((f) => f.name));
      const newFiles = incoming.filter((f) => !existing.has(f.name));
      onAttachmentFilesChange([...(attachmentFiles ?? []), ...newFiles]);
    },
    [attachmentFiles, onAttachmentFilesChange],
  );

  const handleAttachmentDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggingAttachments(false);
      handleAttachmentFiles(Array.from(e.dataTransfer.files));
    },
    [handleAttachmentFiles],
  );

  const handleAttachmentInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleAttachmentFiles(Array.from(e.target.files ?? []));
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const handleSubmit = async (values: ManualFormValues) => {
    setIsSubmitting(true);

    const result = await createFn({
      source: 'manual',
      client_id: clientId ?? undefined,
      exporter_id: exporterId || undefined,
      tipo_cotacao: values.tipo_cotacao as TipoCotacao | undefined,
      data_cotacao: values.data_cotacao || undefined,
      service_type: values.service_type as ServiceType | undefined,
      modal: values.modal as QuotationModal | undefined,
      tipo_embarque: values.tipo_embarque as TipoEmbarque | undefined,
      origin: agenteDefineLocalColeta ? undefined : (values.origin || undefined),
      porto_embarque: values.porto_embarque || undefined,
      porto_destino: values.porto_destino?.length ? values.porto_destino : undefined,
      aeroporto_embarque: values.aeroporto_embarque || undefined,
      aeroporto_destino: values.aeroporto_destino?.length ? values.aeroporto_destino : undefined,
      incluir_entrega_destino_final: parseBool(values.incluir_entrega_destino_final),
      endereco_entrega_final:
        values.incluir_entrega_destino_final === 'true'
          ? values.endereco_entrega_final || undefined
          : undefined,
      incoterm: values.incoterm || undefined,
      ptax_negociada: values.ptax_negociada || undefined,
      price_or_performance: (values.price_or_performance || undefined) as PriceOrPerformance | undefined,
      product: values.product || undefined,
      carga_perigosa: values.carga_perigosa as CargaPerigosa | undefined,
      un_number: values.un_number || undefined,
      imo_class: values.imo_class || undefined,
      stackability: parseBool(values.stackability),
      carga_tombavel: parseBool(values.carga_tombavel),
      temperatura_min: values.temperatura_min ? parseFloat(values.temperatura_min) : undefined,
      temperatura_max: values.temperatura_max ? parseFloat(values.temperatura_max) : undefined,
      desired_deadline: values.desired_deadline ? new Date(values.desired_deadline).toISOString() : undefined,
      data_prontidao: values.data_prontidao || undefined,
      data_limite_necessidade: values.data_limite_necessidade || undefined,
      declared_value: values.declared_value ? parseBrNumber(values.declared_value) : undefined,
      declared_value_currency: values.declared_value_currency as Currency | undefined,
      insurance_required: parseBool(values.insurance_required),
      agente_define_local_coleta: agenteDefineLocalColeta || undefined,
      agente_define_porto_embarque: agenteDefinePortoEmbarque || undefined,
      agente_define_porto_destino: agenteDefinePortoDestino || undefined,
      agente_define_aeroporto_embarque: agenteDefineAeroportoEmbarque || undefined,
      agente_define_aeroporto_destino: agenteDefineAeroportoDestino || undefined,
      destination_yard: values.destination_yard || undefined,
      client_reference: values.client_reference || undefined,
      observations: values.observations || undefined,
      equipments: equipments.length > 0 ? equipments : undefined,
      volumes: volumes.length > 0 ? volumes : undefined,
      files: attachmentFiles?.length ? attachmentFiles.map((f) => f.name) : undefined,
    });

    if (result?.quotation) {
      if (attachmentFiles?.length && result.upload_urls?.length) {
        const uploads = result.upload_urls.map(async (info) => {
          const file = attachmentFiles.find((f) => f.name === info.filename);
          if (!file) return;
          await uploadFileToS3(info.upload_url, file);
        });
        await Promise.all(uploads);
      }
      setIsSubmitting(false);
      onQuotationCreated(result.quotation);
    } else {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-5">

        <div className="grid grid-cols-3 gap-4 items-start">

          {/* ── Bloco 1: Embarque ── */}
          <CardSection
            number={1}
            title="Embarque"
            subtitle="Origem, destino e informações de transporte"
          >
            {exporterSection ? (
              <div className="mb-4 flex flex-col gap-2">
                <Label>Exportador</Label>
                {exporterSection}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="tipo_cotacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Cotação</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="REAL">Real</SelectItem>
                        <SelectItem value="ESTIMATIVA">Estimativa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_cotacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data da Cotação</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="service_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Serviço</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="IMPORTACAO">Importação</SelectItem>
                        <SelectItem value="EXPORTACAO">Exportação</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="modal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modal</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('tipo_embarque', undefined);
                        form.setValue('porto_embarque', '');
                        form.setValue('porto_destino', []);
                        form.setValue('aeroporto_embarque', '');
                        form.setValue('aeroporto_destino', []);
                        form.setValue('incluir_entrega_destino_final', '');
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="AEREO">Aéreo</SelectItem>
                        <SelectItem value="MARITIMO">Marítimo</SelectItem>
                        <SelectItem value="RODOVIARIO">Rodoviário</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isMaritime && (
                <FormField
                  control={form.control}
                  name="tipo_embarque"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Embarque</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FCL">FCL — Full Container</SelectItem>
                          <SelectItem value="LCL">LCL — Consolidado</SelectItem>
                          <SelectItem value="BREAK_BULK">Break Bulk</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="incoterm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incoterm</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value ?? ''}
                        onValueChange={field.onChange}
                        options={INCOTERM_OPTIONS}
                        placeholder="Selecionar..."
                        searchPlaceholder="Buscar incoterm..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ptax_negociada"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PTAX Negociada</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {['1%', '2%', '3%', '4%', '5%'].map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price_or_performance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fator de Escolha</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PRECO">Preco</SelectItem>
                        <SelectItem value="PERFORMANCE">Performance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="origin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local de coleta</FormLabel>
                    <div className="flex items-center gap-2 mb-1">
                      <Switch
                        checked={agenteDefineLocalColeta}
                        onCheckedChange={(v) => {
                          setAgenteDefineLocalColeta(v);
                          if (v) field.onChange('');
                        }}
                        className="scale-75 origin-left"
                      />
                      <span className="text-xs text-muted-foreground">Deixar que agentes decidam</span>
                    </div>
                    <FormControl>
                      <Input
                        placeholder="Ex: Shanghai, CN"
                        {...field}
                        disabled={agenteDefineLocalColeta}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(isMaritime || isRoad) && (
                <>
                  <FormField
                    control={form.control}
                    name="porto_embarque"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isRoad ? 'Fronteira de Embarque' : 'Porto de Embarque'}</FormLabel>
                        <div className="flex items-center gap-2 mb-1">
                          <Switch
                            checked={agenteDefinePortoEmbarque}
                            onCheckedChange={(v) => {
                              setAgenteDefinePortoEmbarque(v);
                              if (v) field.onChange('');
                            }}
                            className="scale-75 origin-left"
                          />
                          <span className="text-xs text-muted-foreground">Deixar que agentes decidam</span>
                        </div>
                        <FormControl>
                          {isRoad ? (
                            <Input
                              placeholder="Ex: Foz do Iguaçu"
                              {...field}
                              disabled={agenteDefinePortoEmbarque}
                            />
                          ) : (
                            <Combobox
                              value={field.value ?? ''}
                              onValueChange={field.onChange}
                              options={isExportation ? PORTS_DESTINATION_OPTIONS : PORTS_DEPARTURE_OPTIONS}
                              placeholder="Selecionar porto..."
                              searchPlaceholder="Buscar porto de origem..."
                              disabled={agenteDefinePortoEmbarque}
                            />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="porto_destino"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isRoad ? 'Fronteira de Destino' : 'Porto de Destino'}</FormLabel>
                        <div className="flex items-center gap-2 mb-1">
                          <Switch
                            checked={agenteDefinePortoDestino}
                            onCheckedChange={(v) => {
                              setAgenteDefinePortoDestino(v);
                              if (v) field.onChange([]);
                            }}
                            className="scale-75 origin-left"
                          />
                          <span className="text-xs text-muted-foreground">Deixar que agentes decidam</span>
                        </div>
                        <FormControl>
                          {isRoad ? (
                            <Input
                              placeholder="Ex: Ciudad del Este"
                              value={(field.value as string[] | undefined)?.[0] ?? ''}
                              onChange={(e) => field.onChange(e.target.value ? [e.target.value] : [])}
                              disabled={agenteDefinePortoDestino}
                            />
                          ) : (
                            <MultiCombobox
                              value={(field.value as string[] | undefined) ?? []}
                              onValueChange={field.onChange}
                              options={isExportation ? PORTS_DEPARTURE_OPTIONS : PORTS_DESTINATION_OPTIONS}
                              placeholder="Selecionar portos..."
                              searchPlaceholder="Buscar porto de destino..."
                              disabled={agenteDefinePortoDestino}
                            />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {isAir && (
                <>
                  <FormField
                    control={form.control}
                    name="aeroporto_embarque"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aeroporto de Embarque</FormLabel>
                        <div className="flex items-center gap-2 mb-1">
                          <Switch
                            checked={agenteDefineAeroportoEmbarque}
                            onCheckedChange={(v) => {
                              setAgenteDefineAeroportoEmbarque(v);
                              if (v) field.onChange('');
                            }}
                            className="scale-75 origin-left"
                          />
                          <span className="text-xs text-muted-foreground">Deixar que agentes decidam</span>
                        </div>
                        <FormControl>
                          <Combobox
                            value={field.value ?? ''}
                            onValueChange={field.onChange}
                            options={isExportation ? AIRPORTS_DESTINATION_OPTIONS : AIRPORTS_DEPARTURE_OPTIONS}
                            placeholder="Selecionar aeroporto..."
                            searchPlaceholder="Buscar por código ou cidade..."
                            disabled={agenteDefineAeroportoEmbarque}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="aeroporto_destino"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aeroporto de Desembarque</FormLabel>
                        <div className="flex items-center gap-2 mb-1">
                          <Switch
                            checked={agenteDefineAeroportoDestino}
                            onCheckedChange={(v) => {
                              setAgenteDefineAeroportoDestino(v);
                              if (v) field.onChange([]);
                            }}
                            className="scale-75 origin-left"
                          />
                          <span className="text-xs text-muted-foreground">Deixar que agentes decidam</span>
                        </div>
                        <FormControl>
                          <MultiCombobox
                            value={field.value ?? []}
                            onValueChange={field.onChange}
                            options={isExportation ? AIRPORTS_DEPARTURE_OPTIONS : AIRPORTS_DESTINATION_OPTIONS}
                            placeholder="Selecionar aeroporto(s)..."
                            searchPlaceholder="Buscar por código ou cidade..."
                            disabled={agenteDefineAeroportoDestino}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="incluir_entrega_destino_final"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entrega porta-a-porta?</FormLabel>
                        <Select
                          onValueChange={(val) => {
                            field.onChange(val);
                            if (val !== 'true') form.setValue('endereco_entrega_final', '');
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="true">Sim</SelectItem>
                            <SelectItem value="false">Não</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch('incluir_entrega_destino_final') === 'true' && (
                    <FormField
                      control={form.control}
                      name="endereco_entrega_final"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Endereço de Entrega Final</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Rua das Flores, 123..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}
            </div>
          </CardSection>

          {/* ── Bloco 2: Carga ── */}
          <CardSection
            number={2}
            title="Carga"
            subtitle="Produto, volumes e características da mercadoria"
          >
            <div className="flex flex-col gap-3">
              <FormField
                control={form.control}
                name="product"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Produto / Mercadoria</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Eletrônicos, Têxteis..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Carga Perigosa */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={cargaPerigosaActive}
                    onCheckedChange={(checked) => {
                      if (!checked) {
                        form.setValue('carga_perigosa', 'NAO');
                        form.setValue('un_number', '');
                        form.setValue('imo_class', '');
                      } else {
                        form.setValue('carga_perigosa', 'RA');
                      }
                    }}
                  />
                  <Label>Carga Perigosa</Label>
                </div>

                {cargaPerigosaActive && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="carga_perigosa"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Classificação</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecionar..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="RA">RA — Radioativo</SelectItem>
                              <SelectItem value="IMO">IMO — Perigoso (IMDG)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {showUnNumber && (
                      <FormField
                        control={form.control}
                        name="un_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>UN</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: UN1263" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {showImoClass && (
                      <FormField
                        control={form.control}
                        name="imo_class"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>IMO (Classe)</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: 3, 6.1, 8" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Empilhável + Tombável */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="stackability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empilhável</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="true">Sim</SelectItem>
                          <SelectItem value="false">Não</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="carga_tombavel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Carga Tombável</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="true">Sim</SelectItem>
                          <SelectItem value="false">Não</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Carga Refrigerada */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={showRefrigerada}
                    onCheckedChange={(checked) => {
                      setShowRefrigerada(checked);
                      if (!checked) {
                        form.setValue('temperatura_min', '');
                        form.setValue('temperatura_max', '');
                      }
                    }}
                  />
                  <Label>Carga Refrigerada</Label>
                </div>

                {showRefrigerada && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="temperatura_min"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Temp. Mín (°C)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Mín" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="temperatura_max"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Temp. Máx (°C)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Máx" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              {/* FCL: equipment list */}
              {isFCL && (
                <EquipmentsTable
                  equipments={equipments}
                  onAdd={() => {
                    setEditingEquipmentIndex(null);
                    setEquipmentDialogOpen(true);
                  }}
                  onEdit={(i) => {
                    setEditingEquipmentIndex(i);
                    setEquipmentDialogOpen(true);
                  }}
                  onDelete={(i) => setEquipments((prev) => prev.filter((_, idx) => idx !== i))}
                />
              )}

              {/* LCL / Air / Break Bulk: volume list */}
              {showVolumeSection && (
                <VolumesTable
                  volumes={volumes}
                  modal={watchModal}
                  onAdd={() => {
                    setEditingVolumeIndex(null);
                    setVolumeDialogOpen(true);
                  }}
                  onEdit={(i) => {
                    setEditingVolumeIndex(i);
                    setVolumeDialogOpen(true);
                  }}
                  onDelete={(i) => setVolumes((prev) => prev.filter((_, idx) => idx !== i))}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormItem>
                  <FormLabel>Valor da Carga</FormLabel>
                  <div className="flex gap-2">
                    <FormField
                      control={form.control}
                      name="declared_value_currency"
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value ?? 'BRL'}>
                          <FormControl>
                            <SelectTrigger className="w-24 shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="BRL">BRL</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="CNY">CNY</SelectItem>
                            <SelectItem value="ARS">ARS</SelectItem>
                            <SelectItem value="CLP">CLP</SelectItem>
                            <SelectItem value="MXN">MXN</SelectItem>
                            <SelectItem value="CHF">CHF</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="declared_value"
                      render={({ field }) => (
                        <FormControl>
                          <Input type="text" inputMode="decimal" placeholder="0.00" className="flex-1" {...field} />
                        </FormControl>
                      )}
                    />
                  </div>
                </FormItem>

                <FormField
                  control={form.control}
                  name="insurance_required"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seguro Obrigatório</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="true">Sim</SelectItem>
                          <SelectItem value="false">Não</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardSection>

          {/* ── Bloco 3: Observacoes ── */}
          <CardSection
            number={3}
            title="Observações"
            subtitle="Prazos, condições e informações adicionais"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="desired_deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deadline envio cotacao</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_prontidao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de prontidão da carga</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_limite_necessidade"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Data de chegada solicitada pelo cliente</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showDestinationYard && (
                <FormField
                  control={form.control}
                  name="destination_yard"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recinto de Destino</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Recinto Santos" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="client_reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referência do Cliente</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: PO-12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observations"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Informações adicionais sobre a cotação..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardSection>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          {onAttachmentFilesChange && (
            <div className="flex flex-col gap-2">
              <div
                onDrop={handleAttachmentDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingAttachments(true); }}
                onDragLeave={() => setIsDraggingAttachments(false)}
                onClick={() => attachmentInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-lg px-4 py-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors',
                  isDraggingAttachments
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30',
                  isSubmitting && 'pointer-events-none opacity-50',
                )}
              >
                <UploadCloud className="w-5 h-5 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Documentação do processo</p>
                  <p className="text-xs text-muted-foreground">
                    Arraste ou clique para anexar — PDF, Word, Excel, imagens
                  </p>
                </div>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  accept={ACCEPTED_UPLOAD_TYPES}
                  multiple
                  className="hidden"
                  onChange={handleAttachmentInput}
                  disabled={isSubmitting}
                />
              </div>

              {(attachmentFiles ?? []).length > 0 && (
                <div className="flex flex-col gap-1">
                  {(attachmentFiles ?? []).map((file, index) => {
                    const Icon = getFileIcon(file.name);
                    return (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-1.5"
                    >
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate flex-1">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatBytes(file.size)}
                      </span>
                      {!isSubmitting && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() =>
                            onAttachmentFilesChange(
                              (attachmentFiles ?? []).filter((_, i) => i !== index),
                            )
                          }
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSubmitting || disabled}
            >
              {isSubmitting ? 'Criando cotação...' : 'Criar cotação manual'}
            </Button>
          </div>
        </div>
      </form>

      <EquipmentDialog
        open={equipmentDialogOpen}
        onOpenChange={(open) => {
          setEquipmentDialogOpen(open);
          if (!open) setEditingEquipmentIndex(null);
        }}
        initialValues={editingEquipmentIndex !== null ? equipments[editingEquipmentIndex] : undefined}
        onAdd={(item) => {
          if (editingEquipmentIndex !== null) {
            setEquipments((prev) => prev.map((e, idx) => (idx === editingEquipmentIndex ? item : e)));
          } else {
            setEquipments((prev) => [...prev, item]);
          }
        }}
      />

      <VolumeDialog
        open={volumeDialogOpen}
        onOpenChange={(open) => {
          setVolumeDialogOpen(open);
          if (!open) setEditingVolumeIndex(null);
        }}
        modal={watchModal}
        initialValues={editingVolumeIndex !== null ? volumes[editingVolumeIndex] : undefined}
        onAdd={(item) => {
          if (editingVolumeIndex !== null) {
            setVolumes((prev) => prev.map((v, idx) => (idx === editingVolumeIndex ? item : v)));
          } else {
            setVolumes((prev) => [...prev, item]);
          }
        }}
      />
    </Form>
  );
}

