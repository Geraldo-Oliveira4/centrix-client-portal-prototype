'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Pencil, ShieldAlert, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
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
  ClientDna,
  CreateClientPayload,
  InsuranceResponsibility,
  INSURANCE_RESPONSIBILITY_LABELS,
  LogisticsType,
  LOGISTICS_TYPE_LABELS,
  Modal,
  MODAL_LABELS,
  PriceOrPerformance,
  PRICE_OR_PERFORMANCE_LABELS,
  QuotationClient,
  ServiceType,
  SERVICE_TYPE_LABELS,
  TipoEmbarque,
  TIPO_EMBARQUE_LABELS,
  UpdateClientPayload,
  UpdateDnaPayload,
} from '@/types/client';
import { DnaDisplay } from './dna-display';
import { PortalContactsSection } from './portal-contacts-section';
import { AgentSelector } from '../../[id]/components/agent-selector';
import { SectionHeader } from '@arboria-tech/arboria-ui';

type ModalMode = 'create' | 'read' | 'edit';

const clientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  sector: z.string().optional(),
  company_code: z.string().optional(),
  cnpj: z.string().optional(),
  razao_social: z.string().optional(),
  endereco: z.string().optional(),
  importador: z.string().optional(),
  adquirente: z.string().optional(),
  importacao_direta: z.boolean().optional(),
  is_vip: z.boolean().optional(),
  modality: z.enum(['MARITIMO', 'AEREO', 'RODOVIARIO']).optional(),
  tipo_embarque: z.enum(['FCL', 'LCL', 'BREAK_BULK']).optional(),
  logistics_type: z.enum(['COTACAO', 'TORRE_DE_CONTROLE', 'PREMIUM']).optional(),
  destination_yard_aereo: z.string().optional(),
  destination_yard_maritimo_fcl: z.string().optional(),
  destination_yard_maritimo_lcl: z.string().optional(),
  insurance_responsibility: z.enum(['FREITAS', 'CLIENTE', 'NAO_INCLUSO', 'AGENTE_DE_CARGAS']).optional(),
  quotation_particularities: z.string().optional(),
  dangerous_cargo_shipper: z.boolean().optional(),
  price_or_performance: z.enum(['PRECO', 'PERFORMANCE']).optional(),
  cargo_profile: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email('Email inválido').optional().or(z.literal('')),
  assigned_analyst: z.string().optional(),
  default_agents: z.array(z.string()).optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientModalProps {
  clientId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientModal({ clientId, open, onOpenChange }: ClientModalProps) {
  const [mode, setMode] = useState<ModalMode>('create');
  const [client, setClient] = useState<QuotationClient | null>(null);
  const [dnaType, setDnaType] = useState<ServiceType>('IMPORTACAO');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { createClient, updateClient, updateDna, getClientWithDna, deleteClient } = useClients();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { is_vip: false, dangerous_cargo_shipper: false, importacao_direta: false },
  });

  const watchModality = form.watch('modality');
  const watchImportacaoDireta = form.watch('importacao_direta');

  useEffect(() => {
    if (!open) return;

    setDnaType('IMPORTACAO');
    if (clientId) {
      setMode('read');
      setIsLoading(true);
      getClientWithDna(clientId).then((data) => {
        setClient(data);
        setIsLoading(false);
      });
    } else {
      setMode('create');
      setClient(null);
      form.reset({ is_vip: false, dangerous_cargo_shipper: false, importacao_direta: false });
    }
  }, [open, clientId]);

  const dnaFor = (data: QuotationClient | null, type: ServiceType) =>
    data?.dnas?.find((d) => d.service_type === type);

  const clientFieldsFrom = (data: QuotationClient) => ({
    name: data.name,
    email: data.email,
    sector: data.sector ?? '',
    company_code: data.company_code ?? '',
    cnpj: data.cnpj ?? '',
    razao_social: data.razao_social ?? '',
    endereco: data.endereco ?? '',
    importador: data.importador ?? '',
    adquirente: data.adquirente ?? '',
    importacao_direta: data.importacao_direta,
    is_vip: data.is_vip,
  });

  const dnaFieldsFrom = (dna?: ClientDna) => ({
    modality: dna?.modality ?? undefined,
    tipo_embarque: dna?.tipo_embarque ?? undefined,
    logistics_type: dna?.logistics_type ?? undefined,
    destination_yard_aereo: dna?.destination_yard_aereo ?? '',
    destination_yard_maritimo_fcl: dna?.destination_yard_maritimo_fcl ?? '',
    destination_yard_maritimo_lcl: dna?.destination_yard_maritimo_lcl ?? '',
    insurance_responsibility: dna?.insurance_responsibility?.value ?? undefined,
    quotation_particularities: dna?.quotation_particularities ?? '',
    dangerous_cargo_shipper: dna?.dangerous_cargo_shipper ?? false,
    price_or_performance: dna?.price_or_performance ?? undefined,
    cargo_profile: dna?.cargo_profile ?? '',
    contact_name: dna?.contact_name ?? '',
    contact_email: dna?.contact_email ?? '',
    assigned_analyst: dna?.assigned_analyst ?? '',
    default_agents: dna?.default_agents ? Object.keys(dna.default_agents) : [],
  });

  const populateForm = (data: QuotationClient, type: ServiceType) => {
    form.reset({
      ...clientFieldsFrom(data),
      ...dnaFieldsFrom(dnaFor(data, type)),
    });
  };

  const handleEditStart = () => {
    if (client) populateForm(client, dnaType);
    setMode('edit');
  };

  // Switching the DNA tab in edit mode reloads only the DNA fields for the
  // selected operation, preserving any in-progress client-data edits.
  const handleDnaTypeChange = (type: ServiceType) => {
    setDnaType(type);
    if (mode === 'edit' && client) {
      form.reset({ ...form.getValues(), ...dnaFieldsFrom(dnaFor(client, type)) });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!clientId) return;
    setIsDeleting(true);
    const success = await deleteClient(clientId);
    setIsDeleting(false);
    if (success) {
      setDeleteDialogOpen(false);
      onOpenChange(false);
    }
  };

  const handleSubmitCreate = async (values: ClientFormValues) => {
    setIsSubmitting(true);
    const payload: CreateClientPayload = {
      name: values.name,
      email: values.email,
      sector: values.sector || undefined,
      company_code: values.company_code || undefined,
      cnpj: values.cnpj || undefined,
      razao_social: values.razao_social || undefined,
      endereco: values.endereco || undefined,
      importador: values.importador || undefined,
      adquirente: values.importacao_direta ? '' : values.adquirente || undefined,
      importacao_direta: values.importacao_direta,
      is_vip: values.is_vip,
      modality: values.modality as Modal | undefined,
      tipo_embarque: values.tipo_embarque as TipoEmbarque | undefined,
      logistics_type: values.logistics_type as LogisticsType | undefined,
      destination_yard_aereo: values.destination_yard_aereo || undefined,
      destination_yard_maritimo_fcl: values.destination_yard_maritimo_fcl || undefined,
      destination_yard_maritimo_lcl: values.destination_yard_maritimo_lcl || undefined,
      insurance_responsibility: values.insurance_responsibility as InsuranceResponsibility | undefined,
      quotation_particularities: values.quotation_particularities || undefined,
      dangerous_cargo_shipper: values.dangerous_cargo_shipper,
      price_or_performance: values.price_or_performance as PriceOrPerformance | undefined,
      cargo_profile: values.cargo_profile || undefined,
      contact_name: values.contact_name || undefined,
      contact_email: values.contact_email || undefined,
      assigned_analyst: values.assigned_analyst || undefined,
    };
    const result = await createClient(payload);
    setIsSubmitting(false);
    if (result) {
      form.reset();
      onOpenChange(false);
    }
  };

  const handleSubmitEdit = async (values: ClientFormValues) => {
    if (!clientId) return;
    setIsSubmitting(true);

    const clientPayload: UpdateClientPayload = {
      name: values.name,
      email: values.email,
      sector: values.sector || undefined,
      company_code: values.company_code || undefined,
      cnpj: values.cnpj || undefined,
      razao_social: values.razao_social || undefined,
      endereco: values.endereco || undefined,
      importador: values.importador || undefined,
      adquirente: values.importacao_direta ? '' : values.adquirente || undefined,
      importacao_direta: values.importacao_direta,
      is_vip: values.is_vip,
    };
    const dnaPayload: UpdateDnaPayload = {
      modality: values.modality as Modal | undefined,
      tipo_embarque: values.tipo_embarque as TipoEmbarque | undefined,
      logistics_type: values.logistics_type as LogisticsType | undefined,
      destination_yard_aereo: values.destination_yard_aereo || undefined,
      destination_yard_maritimo_fcl: values.destination_yard_maritimo_fcl || undefined,
      destination_yard_maritimo_lcl: values.destination_yard_maritimo_lcl || undefined,
      insurance_responsibility: values.insurance_responsibility as InsuranceResponsibility | undefined,
      quotation_particularities: values.quotation_particularities || undefined,
      dangerous_cargo_shipper: values.dangerous_cargo_shipper,
      price_or_performance: values.price_or_performance as PriceOrPerformance | undefined,
      cargo_profile: values.cargo_profile || undefined,
      contact_name: values.contact_name || undefined,
      contact_email: values.contact_email || undefined,
      assigned_analyst: values.assigned_analyst || undefined,
      default_agents: values.default_agents?.length
        ? Object.fromEntries(values.default_agents.map(id => [id, true]))
        : null,
    };

    await Promise.all([
      updateClient(clientId, clientPayload),
      updateDna(clientId, dnaType, dnaPayload),
    ]);

    const updated = await getClientWithDna(clientId);
    setClient(updated);
    setIsSubmitting(false);
    setMode('read');
  };

  const onSubmit = mode === 'create' ? handleSubmitCreate : handleSubmitEdit;
  const isLoadingContent = isLoading && mode === 'read';

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {mode === 'create' ? 'Novo Cliente' : (
                <>
                  {client?.name ?? '...'}
                  {client?.is_vip && (
                    <Badge className="gap-1 bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      Crítico
                    </Badge>
                  )}
                </>
              )}
            </DialogTitle>
            {mode === 'read' && !isLoadingContent && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Excluir
                </Button>
                <Button variant="outline" size="sm" onClick={handleEditStart}>
                  <Pencil className="w-3 h-3 mr-1" />
                  Editar
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {isLoadingContent ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : mode === 'read' && client ? (
          <ClientReadView client={client} />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
              <fieldset className="flex flex-col gap-4">
                <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Dados do Cliente
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome da empresa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="empresa@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sector"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Setor</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Tecnologia, Alimentos..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código da Empresa</FormLabel>
                        <FormControl>
                          <Input placeholder="Código interno" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_vip"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Cliente Crítico</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl>
                          <Input placeholder="00.000.000/0000-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="razao_social"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razão Social</FormLabel>
                        <FormControl>
                          <Input placeholder="Razão social completa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endereco"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input placeholder="Endereço completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="importacao_direta"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Importação Direta</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="importador"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Importador</FormLabel>
                        <FormControl>
                          <Input placeholder="Empresa que consta como importador de fato" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {!watchImportacaoDireta && (
                    <FormField
                      control={form.control}
                      name="adquirente"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Adquirente</FormLabel>
                          <FormControl>
                            <Input placeholder="Empresa que adquire a mercadoria" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </fieldset>

              <hr className="border-border" />

              <fieldset className="flex flex-col gap-4">
                <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  DNA do Cliente
                </legend>

                {mode === 'edit' ? (
                  <div className="flex items-center gap-2">
                    {(['IMPORTACAO', 'EXPORTACAO'] as ServiceType[]).map((type) => (
                      <Button
                        key={type}
                        type="button"
                        size="sm"
                        variant={dnaType === type ? 'default' : 'outline'}
                        onClick={() => handleDnaTypeChange(type)}
                      >
                        {SERVICE_TYPE_LABELS[type]}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    O DNA inicial vale para importação e exportação. Após cadastrar,
                    edite cada operação separadamente.
                  </p>
                )}

                <FormField
                  control={form.control}
                  name="insurance_responsibility"
                  render={({ field }) => (
                    <FormItem className="rounded-md border-2 border-red-400 bg-red-50 dark:bg-red-950/20 p-3">
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <FormLabel className="text-red-600 dark:text-red-400 text-xs font-semibold uppercase tracking-wide m-0">
                          Responsabilidade pelo Seguro — Campo Crítico
                        </FormLabel>
                      </div>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="border-red-300 focus:ring-red-400">
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(INSURANCE_RESPONSIBILITY_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="modality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modalidade</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(MODAL_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchModality === 'MARITIMO' && (
                    <FormField
                      control={form.control}
                      name="tipo_embarque"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Embarque</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecionar..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(TIPO_EMBARQUE_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="logistics_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Logística</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(LOGISTICS_TYPE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="destination_yard_aereo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recinto de Destino — Aéreo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: NVT" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="destination_yard_maritimo_fcl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recinto de Destino — Marítimo FCL</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Recinto Santos" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="destination_yard_maritimo_lcl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recinto de Destino — Marítimo LCL</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Recinto Poly" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="price_or_performance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço ou Performance</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(PRICE_OR_PERFORMANCE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cargo_profile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Perfil de Carga</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Eletrônicos, Alimentos..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dangerous_cargo_shipper"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Shipper com Cargas Perigosas</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contato Principal</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do contato" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email do Contato</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contato@empresa.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="assigned_analyst"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Analista Responsável</FormLabel>
                        <FormControl>
                          <Input placeholder="ID do analista" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="quotation_particularities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Particularidades para Cotar</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ex: Sem transbordo, T1 obrigatório..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {mode === 'edit' && (
                  <FormField
                    control={form.control}
                    name="default_agents"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agentes Preferidos</FormLabel>
                        <FormControl>
                          <AgentSelector
                            value={field.value ?? []}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </fieldset>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => (mode === 'edit' ? setMode('read') : onOpenChange(false))}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? mode === 'create'
                      ? 'Cadastrando...'
                      : 'Salvando...'
                    : mode === 'create'
                      ? 'Cadastrar Cliente'
                      : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>

    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir <strong>{client?.name}</strong>? Esta ação não pode ser
            desfeita. Cotações vinculadas a este cliente não serão excluídas, mas perderão a
            referência ao cliente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
            onClick={handleDeleteConfirm}
          >
            {isDeleting ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function ClientReadView({ client }: { client: QuotationClient }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SectionHeader>
          Dados do Cliente
        </SectionHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <InfoField label="Email" value={client.email} />
          <InfoField label="Setor" value={client.sector} />
          <InfoField label="Código" value={client.company_code} />
          <InfoField label="CNPJ" value={client.cnpj} />
          <InfoField label="Razão Social" value={client.razao_social} />
          <InfoField label="Endereço" value={client.endereco} />
          <InfoField label="Importação Direta" value={client.importacao_direta ? 'Sim' : 'Não'} />
          <InfoField label="Importador" value={client.importador} />
          {!client.importacao_direta && (
            <InfoField label="Adquirente" value={client.adquirente} />
          )}
          <InfoField
            label="Desde"
            value={new Date(client.created_at).toLocaleDateString('pt-BR')}
          />
        </div>
      </div>

      <hr className="border-border" />

      <div className="flex flex-col gap-3">
        <SectionHeader>
          DNA do Cliente
        </SectionHeader>
        {client.dnas && client.dnas.length > 0 ? (
          <div className="flex flex-col gap-5">
            {client.dnas.map((dna) => (
              <div key={dna.id} className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {SERVICE_TYPE_LABELS[dna.service_type]}
                </span>
                <DnaDisplay dna={dna} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">DNA ainda não cadastrado.</p>
        )}
      </div>

      <hr className="border-border" />

      <div className="flex flex-col gap-3">
        <SectionHeader>
          Acessos ao Portal do Cliente
        </SectionHeader>
        <PortalContactsSection clientId={client.id} />
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
        {label}
      </span>
      <span>{value ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}
