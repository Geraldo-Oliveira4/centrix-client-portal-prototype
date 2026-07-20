'use client';

import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Checkbox,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui';
import { useFreightAgents } from '@/hooks/use-freight-agents';
import { FreightAgent, FreightAgentContact, ModalRegion } from '@/types/freight-agent';
import { ScoreBadge } from './score-badge';
import { SectionHeader } from '@arboria-tech/arboria-ui';

type ModalMode = 'create' | 'read' | 'edit';

const contactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  export_air: z.boolean().default(false),
  import_air: z.boolean().default(false),
  export_maritime: z.boolean().default(false),
  import_maritime: z.boolean().default(false),
  export_road: z.boolean().default(false),
  import_road: z.boolean().default(false),
});

const agentSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  preferred_channel: z.enum(['email', 'whatsapp', 'phone']).optional(),
  modal_regions: z.array(z.enum([
    'AEREO_ASIA', 'AEREO_EUROPA', 'AEREO_AMERICAS',
    'MARITIMO_FCL_ASIA', 'MARITIMO_FCL_EUROPA', 'MARITIMO_FCL_AMERICAS',
    'MARITIMO_LCL_ASIA', 'MARITIMO_LCL_EUROPA', 'MARITIMO_LCL_AMERICAS',
  ])).optional(),
  certificacao_oea: z.boolean().optional(),
  data_validade_oea: z.string().optional(),
  carga_imo: z.boolean().optional(),
  contacts: z.array(contactSchema).min(1, 'Adicione pelo menos um contato'),
});

type AgentFormValues = z.infer<typeof agentSchema>;

interface AgentModalProps {
  agentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultContact: FreightAgentContact = {
  name: '',
  email: '',
  phone: '',
  export_air: false,
  import_air: false,
  export_maritime: false,
  import_maritime: false,
  export_road: false,
  import_road: false,
};

export function AgentModal({ agentId, open, onOpenChange }: AgentModalProps) {
  const [mode, setMode] = useState<ModalMode>('create');
  const [agent, setAgent] = useState<FreightAgent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createAgent, updateAgent, getAgent } = useFreightAgents();

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: '',
      email: '',
      preferred_channel: undefined,
      modal_regions: [],
      certificacao_oea: false,
      data_validade_oea: '',
      carga_imo: false,
      contacts: [{ ...defaultContact }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'contacts',
  });

  useEffect(() => {
    if (!open) return;

    if (agentId) {
      setMode('read');
      setIsLoading(true);
      getAgent(agentId).then((data) => {
        if (data) {
          setAgent(data);
          populateForm(data);
        }
        setIsLoading(false);
      });
    } else {
      setMode('create');
      setAgent(null);
      form.reset({
        name: '',
        email: '',
        preferred_channel: undefined,
        modal_regions: [],
        certificacao_oea: false,
        data_validade_oea: '',
        carga_imo: false,
        contacts: [{ ...defaultContact }],
      });
    }
  }, [open, agentId]);

  const populateForm = (data: FreightAgent) => {
    form.reset({
      name: data.name,
      email: data.email,
      preferred_channel: (data.preferred_channel as AgentFormValues['preferred_channel']) ?? undefined,
      modal_regions: (data.modal_regions as ModalRegion[]) ?? [],
      certificacao_oea: data.certificacao_oea ?? false,
      data_validade_oea: data.data_validade_oea ?? '',
      carga_imo: data.carga_imo ?? false,
      contacts: data.contacts?.length > 0 ? data.contacts : [{ ...defaultContact }],
    });
  };

  const handleEditStart = () => {
    if (agent) populateForm(agent);
    setMode('edit');
  };

  const handleSubmitCreate = async (values: AgentFormValues) => {
    setIsSubmitting(true);
    const result = await createAgent({
      name: values.name,
      email: values.email,
      preferred_channel: values.preferred_channel,
      modal_regions: values.modal_regions,
      certificacao_oea: values.certificacao_oea,
      data_validade_oea: values.data_validade_oea || undefined,
      carga_imo: values.carga_imo,
      contacts: values.contacts,
    });
    setIsSubmitting(false);
    if (result) {
      form.reset();
      onOpenChange(false);
    }
  };

  const handleSubmitEdit = async (values: AgentFormValues) => {
    if (!agentId) return;
    setIsSubmitting(true);
    const result = await updateAgent(agentId, {
      name: values.name,
      email: values.email,
      preferred_channel: values.preferred_channel,
      modal_regions: values.modal_regions,
      certificacao_oea: values.certificacao_oea,
      data_validade_oea: values.data_validade_oea || null,
      carga_imo: values.carga_imo,
      contacts: values.contacts,
    });
    setIsSubmitting(false);
    if (result) {
      setAgent(result);
      setMode('read');
    }
  };

  const onSubmit = mode === 'create' ? handleSubmitCreate : handleSubmitEdit;
  const isLoadingContent = isLoading && mode === 'read';

  const errorRate =
    agent && agent.total_quotations > 0
      ? ((agent.error_count / agent.total_quotations) * 100).toFixed(1)
      : '0.0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>
              {mode === 'create' ? 'Novo Agente de Carga' : (agent?.name ?? '...')}
            </DialogTitle>
            {mode === 'read' && !isLoadingContent && (
              <Button variant="outline" size="sm" onClick={handleEditStart}>
                <Pencil className="w-3 h-3 mr-1" />
                Editar
              </Button>
            )}
          </div>
        </DialogHeader>

        {isLoadingContent ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : mode === 'read' && agent ? (
          <AgentReadView agent={agent} errorRate={errorRate} />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Maersk Line" {...field} />
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
                      <FormLabel>Email Principal *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="ops@agente.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferred_channel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Canal Preferido</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="phone">Telefone</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="modal_regions"
                render={({ field }) => {
                  const MODAIS = [
                    { key: 'AEREO', label: 'Aéreo' },
                    { key: 'MARITIMO_FCL', label: 'Marítimo FCL' },
                    { key: 'MARITIMO_LCL', label: 'Marítimo LCL' },
                  ] as const;
                  const REGIOES = [
                    { key: 'ASIA', label: 'Ásia' },
                    { key: 'EUROPA', label: 'Europa' },
                    { key: 'AMERICAS', label: 'Américas' },
                  ] as const;

                  const toggle = (value: ModalRegion) => {
                    const current = field.value || [];
                    if (current.includes(value)) {
                      field.onChange(current.filter((v) => v !== value));
                    } else {
                      field.onChange([...current, value]);
                    }
                  };

                  return (
                    <FormItem>
                      <FormLabel>Regiões de Atuação</FormLabel>
                      <div className="mt-2 border rounded-lg overflow-hidden">
                        <div className="grid grid-cols-4 bg-muted/50 border-b">
                          <div className="px-3 py-2 text-xs font-medium text-muted-foreground" />
                          {REGIOES.map((r) => (
                            <div key={r.key} className="px-3 py-2 text-xs font-medium text-muted-foreground text-center">
                              {r.label}
                            </div>
                          ))}
                        </div>
                        {MODAIS.map((modal, idx) => (
                          <div
                            key={modal.key}
                            className={`grid grid-cols-4 ${idx < MODAIS.length - 1 ? 'border-b' : ''}`}
                          >
                            <div className="px-3 py-2.5 text-sm font-medium">{modal.label}</div>
                            {REGIOES.map((regiao) => {
                              const value = `${modal.key}_${regiao.key}` as ModalRegion;
                              return (
                                <div key={regiao.key} className="flex items-center justify-center px-3 py-2.5">
                                  <Checkbox
                                    checked={(field.value || []).includes(value)}
                                    onCheckedChange={() => toggle(value)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <div className="rounded-lg border p-4 space-y-3">
                <SectionHeader>Certificacao OEA</SectionHeader>
                <FormField
                  control={form.control}
                  name="certificacao_oea"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between">
                      <FormLabel>Possui certificacao OEA</FormLabel>
                      <FormControl>
                        <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {form.watch('certificacao_oea') && (
                  <FormField
                    control={form.control}
                    name="data_validade_oea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Validade da certificacao OEA</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <SectionHeader>Carga IMO</SectionHeader>
                <FormField
                  control={form.control}
                  name="carga_imo"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between">
                      <FormLabel>Possui certificacao de Carga IMO</FormLabel>
                      <FormControl>
                        <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <SectionHeader>Contatos e Produtos</SectionHeader>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ ...defaultContact })}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add contato
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px] px-2">Nome</TableHead>
                        <TableHead className="min-w-[200px] px-2">E-mail</TableHead>
                        <TableHead className="min-w-[120px] px-2">Telefone</TableHead>
                        <TooltipProvider>
                          <TableHead className="text-center w-12 px-1">
                            <Tooltip>
                              <TooltipTrigger>EA</TooltipTrigger>
                              <TooltipContent>
                                <p>Exportação Aérea</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableHead>
                          <TableHead className="text-center w-12 px-1">
                            <Tooltip>
                              <TooltipTrigger>IA</TooltipTrigger>
                              <TooltipContent>
                                <p>Importação Aérea</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableHead>
                          <TableHead className="text-center w-12 px-1">
                            <Tooltip>
                              <TooltipTrigger>EM</TooltipTrigger>
                              <TooltipContent>
                                <p>Exportação Marítima</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableHead>
                          <TableHead className="text-center w-12 px-1">
                            <Tooltip>
                              <TooltipTrigger>IM</TooltipTrigger>
                              <TooltipContent>
                                <p>Importação Marítima</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableHead>
                          <TableHead className="text-center w-12 px-1">
                            <Tooltip>
                              <TooltipTrigger>ER</TooltipTrigger>
                              <TooltipContent>
                                <p>Exportação Rodoviária</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableHead>
                          <TableHead className="text-center w-12 px-1">
                            <Tooltip>
                              <TooltipTrigger>IR</TooltipTrigger>
                              <TooltipContent>
                                <p>Importação Rodoviária</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableHead>
                        </TooltipProvider>
                        <TableHead className="w-12 px-2"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => (
                        <TableRow key={field.id}>
                          <TableCell className="px-2">
                            <FormField
                              control={form.control}
                              name={`contacts.${index}.name`}
                              render={({ field }) => (
                                <FormItem className="m-0">
                                  <FormControl>
                                    <Input placeholder="Nome" {...field} className="h-8" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="px-2">
                            <FormField
                              control={form.control}
                              name={`contacts.${index}.email`}
                              render={({ field }) => (
                                <FormItem className="m-0">
                                  <FormControl>
                                    <Input
                                      type="email"
                                      placeholder="email@exemplo.com"
                                      {...field}
                                      className="h-8"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="px-2">
                            <FormField
                              control={form.control}
                              name={`contacts.${index}.phone`}
                              render={({ field }) => (
                                <FormItem className="m-0">
                                  <FormControl>
                                    <Input placeholder="(00) 0000-0000" {...field} className="h-8" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-center px-1">
                            <FormField
                              control={form.control}
                              name={`contacts.${index}.export_air`}
                              render={({ field }) => (
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-center px-1">
                            <FormField
                              control={form.control}
                              name={`contacts.${index}.import_air`}
                              render={({ field }) => (
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-center px-1">
                            <FormField
                              control={form.control}
                              name={`contacts.${index}.export_maritime`}
                              render={({ field }) => (
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-center px-1">
                            <FormField
                              control={form.control}
                              name={`contacts.${index}.import_maritime`}
                              render={({ field }) => (
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-center px-1">
                            <FormField
                              control={form.control}
                              name={`contacts.${index}.export_road`}
                              render={({ field }) => (
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-center px-1">
                            <FormField
                              control={form.control}
                              name={`contacts.${index}.import_road`}
                              render={({ field }) => (
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell className="px-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
                              disabled={fields.length === 1}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {form.formState.errors.contacts?.root && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.contacts.root.message}
                  </p>
                )}
                {form.formState.errors.contacts && Array.isArray(form.formState.errors.contacts) && (
                  <p className="text-sm text-red-500">
                    Preencha todos os campos obrigatórios dos contatos.
                  </p>
                )}
              </div>

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
                      ? 'Cadastrar'
                      : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AgentReadView({ agent, errorRate }: { agent: FreightAgent; errorRate: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-lg border p-4 bg-muted/30">
        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          Score de Confiabilidade
        </span>
        <ScoreBadge score={agent.reliability_score} showBar />
        <p className="text-xs text-muted-foreground">
          Score inicia em 100.0 e é decrementado automaticamente pelo motor de auditoria conforme erros identificados nas propostas.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center rounded-lg border p-3 text-center">
          <span className="text-2xl font-bold tabular-nums">{agent.total_quotations}</span>
          <span className="text-xs text-muted-foreground mt-0.5">Cotações</span>
        </div>
        <div className="flex flex-col items-center rounded-lg border p-3 text-center">
          <span className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
            {agent.error_count}
          </span>
          <span className="text-xs text-muted-foreground mt-0.5">Erros</span>
        </div>
        <div className="flex flex-col items-center rounded-lg border p-3 text-center">
          <span className="text-2xl font-bold tabular-nums">{errorRate}%</span>
          <span className="text-xs text-muted-foreground mt-0.5">Taxa de Erro</span>
        </div>
      </div>

      <hr className="border-border" />

      <div className="flex flex-col gap-3">
        <SectionHeader>Dados do Agente de Carga</SectionHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <InfoField label="Email Principal" value={agent.email} />
          <InfoField
            label="Canal Preferido"
            value={<span className="capitalize">{agent.preferred_channel ?? '—'}</span>}
          />
          <InfoField
            label="Regiões de Atuação"
            value={
              agent.modal_regions && agent.modal_regions.length > 0
                ? agent.modal_regions.map((mr) => {
                    const LABELS: Record<string, string> = {
                      AEREO_ASIA: 'Aéreo — Ásia',
                      AEREO_EUROPA: 'Aéreo — Europa',
                      AEREO_AMERICAS: 'Aéreo — Américas',
                      MARITIMO_FCL_ASIA: 'Marítimo FCL — Ásia',
                      MARITIMO_FCL_EUROPA: 'Marítimo FCL — Europa',
                      MARITIMO_FCL_AMERICAS: 'Marítimo FCL — Américas',
                      MARITIMO_LCL_ASIA: 'Marítimo LCL — Ásia',
                      MARITIMO_LCL_EUROPA: 'Marítimo LCL — Europa',
                      MARITIMO_LCL_AMERICAS: 'Marítimo LCL — Américas',
                    };
                    return LABELS[mr] ?? mr;
                  }).join(', ')
                : '—'
            }
          />
          <InfoField
            label="Certificacao OEA"
            value={
              agent.certificacao_oea
                ? agent.data_validade_oea
                  ? `Sim — valido ate ${new Date(agent.data_validade_oea + 'T12:00:00').toLocaleDateString('pt-BR')}`
                  : 'Sim — sem data de validade'
                : 'Nao'
            }
          />
          <InfoField
            label="Carga IMO"
            value={agent.carga_imo ? 'Sim' : 'Nao'}
          />
          <InfoField
            label="Cadastrado em"
            value={new Date(agent.created_at).toLocaleDateString('pt-BR')}
          />
          {agent.updated_at && (
            <InfoField
              label="Atualizado em"
              value={new Date(agent.updated_at).toLocaleDateString('pt-BR')}
            />
          )}
        </div>
      </div>

      {agent.contacts && agent.contacts.length > 0 && (
        <>
          <hr className="border-border" />
          <div className="flex flex-col gap-3">
            <SectionHeader>Contatos e Produtos</SectionHeader>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-2">Nome</TableHead>
                    <TableHead className="px-2">E-mail</TableHead>
                    <TableHead className="px-2">Telefone</TableHead>
                    <TooltipProvider>
                      <TableHead className="text-center px-1">
                        <Tooltip>
                          <TooltipTrigger>EA</TooltipTrigger>
                          <TooltipContent>
                            <p>Exportação Aérea</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center px-1">
                        <Tooltip>
                          <TooltipTrigger>IA</TooltipTrigger>
                          <TooltipContent>
                            <p>Importação Aérea</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center px-1">
                        <Tooltip>
                          <TooltipTrigger>EM</TooltipTrigger>
                          <TooltipContent>
                            <p>Exportação Marítima</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center px-1">
                        <Tooltip>
                          <TooltipTrigger>IM</TooltipTrigger>
                          <TooltipContent>
                            <p>Importação Marítima</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center px-1">
                        <Tooltip>
                          <TooltipTrigger>ER</TooltipTrigger>
                          <TooltipContent>
                            <p>Exportação Rodoviária</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center px-1">
                        <Tooltip>
                          <TooltipTrigger>IR</TooltipTrigger>
                          <TooltipContent>
                            <p>Importação Rodoviária</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                    </TooltipProvider>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agent.contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="px-2">{contact.name}</TableCell>
                      <TableCell className="px-2">{contact.email}</TableCell>
                      <TableCell className="px-2">{contact.phone || '—'}</TableCell>
                      <TableCell className="text-center px-1">
                        {contact.export_air ? '✓' : '—'}
                      </TableCell>
                      <TableCell className="text-center px-1">
                        {contact.import_air ? '✓' : '—'}
                      </TableCell>
                      <TableCell className="text-center px-1">
                        {contact.export_maritime ? '✓' : '—'}
                      </TableCell>
                      <TableCell className="text-center px-1">
                        {contact.import_maritime ? '✓' : '—'}
                      </TableCell>
                      <TableCell className="text-center px-1">
                        {contact.export_road ? '✓' : '—'}
                      </TableCell>
                      <TableCell className="text-center px-1">
                        {contact.import_road ? '✓' : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      <hr className="border-border" />

      <div className="flex flex-col gap-2">
        <SectionHeader>Histórico de Participação</SectionHeader>
        <p className="text-sm text-muted-foreground">
          Cotações participadas e detalhamento de erros disponíveis após implementação do motor de auditoria (T10).
        </p>
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
