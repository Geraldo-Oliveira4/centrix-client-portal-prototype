'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, Upload, FileText } from 'lucide-react';
import {
  Button,
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
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { FileListItem } from '@arboria-tech/arboria-ui';
import { FormGrid } from '@arboria-tech/arboria-ui';
import { FormSection } from '@arboria-tech/arboria-ui';
import { useFreightAgents } from '@/hooks/use-freight-agents';
import {
  createProposal,
  updateProposal,
  uploadProposalAttachment,
} from '@/hooks/use-proposals';
import type { CreateProposalPayload, QuotationProposal, TaxesBreakdown } from '@/types/quotation';

const CURRENCIES = ['USD', 'EUR', 'BRL', 'GBP', 'CNY', 'ARS', 'CLP', 'MXN'] as const;
const ROUTE_TYPES = [
  { value: 'DIRETA', label: 'Direta' },
  { value: 'TRANSBORDO', label: 'Transbordo' },
] as const;

const proposalSchema = z.object({
  agent_id: z.string().min(1, 'Agente é obrigatório'),
  total_value: z.string().min(1, 'Valor total é obrigatório'),
  freight_value: z.string().min(1, 'Valor do frete é obrigatório'),
  freight_currency: z.string().default('USD'),
  transit_time: z.string().min(1, 'Transit time é obrigatório'),
  taxes: z.array(z.object({
    key: z.string().min(1, 'Nome é obrigatório'),
    value: z.string().min(1, 'Valor é obrigatório'),
    currency: z.string().default('USD'),
  })),
  route_type: z.enum(['DIRETA', 'TRANSBORDO']).optional().or(z.literal('')),
  route_detail: z.string().optional(),
  carrier: z.string().optional(),
  validity: z.string().optional(),
  insurance_included: z.enum(['', 'true', 'false']).optional(),
  incoterm: z.string().optional(),
});

type ProposalFormValues = z.infer<typeof proposalSchema>;

export type ProposalFormDefaults = Partial<ProposalFormValues>;

interface ProposalManualFormProps {
  quotationId: string;
  onProposalCreated: () => void;
  defaultValues?: ProposalFormDefaults;
  existingProposalId?: string;
  existingProposal?: QuotationProposal;
  existingFiles?: File[];
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'FAS', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

const ACCEPTED_EXTENSIONS = '.msg,.pdf,.docx,.xls,.xlsx,.png,.jpg,.jpeg';

export function ProposalManualForm({
  quotationId,
  onProposalCreated,
  defaultValues,
  existingProposalId,
  existingProposal,
  existingFiles,
  disabled,
}: ProposalManualFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const { agents } = useFreightAgents();

  // Always allow file upload — both for new proposals and edits.
  // On edit, uploaded files are appended to the existing proposal's attachments.
  const showFileUpload = true;

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      agent_id: defaultValues?.agent_id ?? '',
      total_value: defaultValues?.total_value ?? '',
      freight_value: defaultValues?.freight_value ?? '',
      freight_currency: defaultValues?.freight_currency ?? 'USD',
      transit_time: defaultValues?.transit_time ?? '',
      taxes: defaultValues?.taxes ?? [],
      route_type: defaultValues?.route_type ?? '',
      route_detail: defaultValues?.route_detail ?? '',
      carrier: defaultValues?.carrier ?? '',
      validity: defaultValues?.validity ?? '',
      insurance_included: defaultValues?.insurance_included ?? '',
      incoterm: defaultValues?.incoterm ?? '',
    },
  });

  const { fields: taxFields, append: appendTax, remove: removeTax } = useFieldArray({
    control: form.control,
    name: 'taxes',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (values: ProposalFormValues) => {
    setIsSubmitting(true);

    const taxesBreakdown: TaxesBreakdown = {};
    const taxesCurrencyBreakdown: Record<string, string> = {};
    for (const tax of values.taxes) {
      taxesBreakdown[tax.key] = parseFloat(tax.value);
      taxesCurrencyBreakdown[tax.key] = tax.currency || 'USD';
    }

    const payload: CreateProposalPayload = {
      agent_id: values.agent_id,
      total_value: parseFloat(values.total_value),
      freight_value: parseFloat(values.freight_value),
      freight_currency: values.freight_currency || 'USD',
      transit_time: parseInt(values.transit_time, 10),
      taxes_breakdown: taxesBreakdown,
      taxes_currency_breakdown: taxesCurrencyBreakdown,
      route_type: values.route_type || undefined,
      route_detail: values.route_detail || undefined,
      carrier: values.carrier || undefined,
      validity: values.validity || undefined,
      insurance_included:
        values.insurance_included === 'true'
          ? true
          : values.insurance_included === 'false'
            ? false
            : undefined,
      incoterm: values.incoterm || undefined,
      // Preserve fields not exposed in the form so they are not silently zeroed on update
      ...(existingProposal && {
        observations: existingProposal.observations ?? undefined,
        numero_oferta: existingProposal.numero_oferta ?? undefined,
        frequencia: existingProposal.frequencia ?? undefined,
        ptax_percentual: existingProposal.ptax_percentual ?? undefined,
        prazo_pagamento_dias: existingProposal.prazo_pagamento_dias ?? undefined,
        seguro_percentual: existingProposal.seguro_percentual ?? undefined,
        seguro_minimo: existingProposal.seguro_minimo ?? undefined,
      }),
    };

    let proposalId: string | null = null;

    if (existingProposalId) {
      const result = await updateProposal(quotationId, existingProposalId, payload);
      if (!result) {
        setIsSubmitting(false);
        return;
      }
      proposalId = existingProposalId;
    } else {
      const result = await createProposal(quotationId, payload);
      if (!result) {
        setIsSubmitting(false);
        return;
      }
      proposalId = result.proposal.id;
    }

    // Upload selected files to the proposal (new or existing).
    if (files.length > 0 && proposalId) {
      const msgFile = files.find((f) => f.name.toLowerCase().endsWith('.msg'));
      const otherFiles = files.filter((f) => f !== msgFile);

      if (msgFile) {
        await uploadProposalAttachment(quotationId, proposalId, msgFile, true);
      }
      for (const file of otherFiles) {
        await uploadProposalAttachment(quotationId, proposalId, file, false);
      }
    }

    setIsSubmitting(false);
    onProposalCreated();
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-5"
      >
        {/* Agent section */}
        <FormSection title="Agente de Carga">

          <FormField
            control={form.control}
            name="agent_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agente de Carga</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={!!existingProposalId}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar agente..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(agents ?? []).map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <span className="flex items-center gap-2">
                          {agent.name}
                          {agent.reliability_score != null && (
                            <span className={cn(
                              'text-xs font-medium',
                              agent.reliability_score >= 80 ? 'text-green-600' :
                              agent.reliability_score >= 50 ? 'text-yellow-600' :
                              'text-red-600',
                            )}>
                              {agent.reliability_score}%
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <hr className="border-border" />

        {/* Values section */}
        <FormSection title="Valores">

          <FormGrid cols={3}>
            <FormField
              control={form.control}
              name="total_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Total (USD)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="freight_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Frete</FormLabel>
                  <div className="flex gap-1">
                    <FormField
                      control={form.control}
                      name="freight_currency"
                      render={({ field: currField }) => (
                        <Select onValueChange={currField.onChange} value={currField.value}>
                          <SelectTrigger className="w-20 shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transit_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transit Time (dias)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormGrid>

          <FormGrid cols={3}>
            <FormField
              control={form.control}
              name="incoterm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Incoterm</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INCOTERMS.map((term) => (
                        <SelectItem key={term} value={term}>
                          {term}
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
              name="insurance_included"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seguro Incluso</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">Sim</SelectItem>
                      <SelectItem value="false">Nao</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="validity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Validade</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormGrid>

          <FormGrid cols={3}>
            <FormField
              control={form.control}
              name="carrier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Armador / Cia Aerea</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: MSC, Maersk, LATAM Cargo..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="route_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Rota</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROUTE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
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
              name="route_detail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detalhe da Rota / Conexao</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Shanghai → Santos (direto)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormGrid>
        </FormSection>

        <hr className="border-border" />

        {/* Taxes breakdown */}
        <FormSection title="Composicao de Custos" gap={3}>

          {taxFields.map((taxField, index) => (
            <div key={taxField.id} className="flex items-start gap-2">
              <FormField
                control={form.control}
                name={`taxes.${index}.key`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input placeholder="Nome da taxa" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`taxes.${index}.currency`}
                render={({ field }) => (
                  <FormItem className="w-20 shrink-0">
                    <Select onValueChange={field.onChange} value={field.value || 'USD'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`taxes.${index}.value`}
                render={({ field }) => (
                  <FormItem className="w-32">
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 mt-0.5"
                onClick={() => removeTax(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => appendTax({ key: '', value: '', currency: 'USD' })}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar taxa
          </Button>
        </FormSection>

        {/* File upload — available for both new proposals and edits */}
        {showFileUpload && (
          <>
            <hr className="border-border" />

            <FormSection title="Anexos (opcional)" gap={3}>

              <label
                className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">
                  Clique para selecionar arquivos
                </p>
                <p className="text-xs text-muted-foreground/60">
                  .msg, .pdf, .docx, .xls, .xlsx, .png, .jpg, .jpeg
                </p>
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_EXTENSIONS}
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              {files.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {files.map((file, i) => (
                    <FileListItem
                      key={i}
                      iconElement={<FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                      name={file.name}
                      meta={
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({formatFileSize(file.size)})
                        </span>
                      }
                      actions={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-6 w-6"
                          onClick={() => removeFile(i)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      }
                      className="py-1.5 rounded"
                    />
                  ))}
                </div>
              )}
            </FormSection>
          </>
        )}

        {/* Existing files indicator */}
        {existingFiles && existingFiles.length > 0 && (
          <>
            <hr className="border-border" />
            <div className="text-xs text-muted-foreground">
              {existingFiles.length} arquivo(s) ja enviado(s):{' '}
              {existingFiles.map((f) => f.name).join(', ')}
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="submit"
            disabled={isSubmitting || disabled}
          >
            {isSubmitting
              ? existingProposalId ? 'Atualizando...' : 'Registrando...'
              : existingProposalId ? 'Atualizar Proposta' : 'Registrar Proposta'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
