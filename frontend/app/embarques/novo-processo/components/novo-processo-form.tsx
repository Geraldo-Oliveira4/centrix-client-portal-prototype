'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  Form,
  FormControl,
  FormDescription,
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
import { Combobox } from '@/components/ui/combobox';
import { useClients } from '@/hooks/use-clients';
import { createShipment } from '@/hooks/use-shipments';
import type { Quotation } from '@/types/quotation';
import type { CreateShipmentPayload } from '@/types/shipment';
import { TIPO_DESPACHO_LABELS } from '@/types/shipment';
import { CotacaoCombobox } from './cotacao-combobox';

const shipmentSchema = z
  .object({
    quotation_id: z.string().optional(),
    client_id: z.string().min(1, 'Selecione um cliente.'),
    agente_id: z.string().optional(),
    tipo_despacho: z.enum(['DIRETO', 'CONSOLIDADO'], {
      required_error: 'Selecione o estilo de processo.',
    }),
    modal: z.enum(['AEREO', 'MARITIMO', 'RODOVIARIO'], {
      required_error: 'Selecione o modal.',
    }),
    tipo_embarque: z.enum(['FCL', 'LCL']).optional(),
    incoterm: z.string().optional(),
    carga_urgente: z.boolean(),
    observacao: z.string().optional(),
    inova_processo_id: z.string().optional(),
  })
  .refine((v) => v.modal !== 'MARITIMO' || !!v.tipo_embarque, {
    message: 'Informe o tipo de embarque (FCL/LCL) para o modal marítimo.',
    path: ['tipo_embarque'],
  });

type ShipmentFormValues = z.infer<typeof shipmentSchema>;

// Single place that maps form values to the POST /shipments payload.
function buildCreatePayload(values: ShipmentFormValues): CreateShipmentPayload {
  const isMaritime = values.modal === 'MARITIMO';
  return {
    client_id: values.client_id,
    quotation_id: values.quotation_id || null,
    agente_id: values.agente_id || null,
    incoterm: values.incoterm || null,
    modal: values.modal,
    tipo_embarque: isMaritime ? values.tipo_embarque ?? null : null,
    tipo_despacho: values.tipo_despacho,
    carga_urgente: values.carga_urgente,
    observacao: values.observacao || null,
    inova_processo_id: values.inova_processo_id || null,
  };
}

export function NovoProcessoForm() {
  const router = useRouter();
  const { clients } = useClients();
  const [submitting, setSubmitting] = useState(false);
  const [linkedToQuotation, setLinkedToQuotation] = useState(false);

  const form = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      quotation_id: '',
      client_id: '',
      agente_id: '',
      tipo_despacho: undefined,
      modal: undefined,
      tipo_embarque: undefined,
      incoterm: '',
      carga_urgente: false,
      observacao: '',
      inova_processo_id: '',
    },
  });

  const modal = form.watch('modal');
  const isMaritime = modal === 'MARITIMO';

  const clientOptions = useMemo(
    () => (clients ?? []).map((c) => ({ value: c.id, label: c.name })),
    [clients],
  );

  const handleQuotationSelect = (quotation: Quotation | null) => {
    if (!quotation) {
      form.setValue('quotation_id', '');
      form.setValue('agente_id', '');
      setLinkedToQuotation(false);
      return;
    }
    form.setValue('quotation_id', quotation.id);
    if (quotation.client_id) form.setValue('client_id', quotation.client_id);
    form.setValue('agente_id', quotation.winning_agent_id ?? '');
    if (quotation.incoterm) form.setValue('incoterm', quotation.incoterm);
    if (quotation.modal) form.setValue('modal', quotation.modal);
    if (quotation.tipo_embarque === 'FCL' || quotation.tipo_embarque === 'LCL') {
      form.setValue('tipo_embarque', quotation.tipo_embarque);
    }
    setLinkedToQuotation(true);
    // Clear stale validation errors after autofill.
    form.clearErrors();
  };

  const onSubmit = async (values: ShipmentFormValues) => {
    setSubmitting(true);
    const created = await createShipment(buildCreatePayload(values));
    setSubmitting(false);
    if (created) {
      router.push(`/embarques/${created.id}`);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
        {/* Linked quotation */}
        <FormField
          control={form.control}
          name="quotation_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cotação vinculada</FormLabel>
              <FormControl>
                <CotacaoCombobox value={field.value ?? ''} onSelect={handleQuotationSelect} />
              </FormControl>
              <FormDescription>
                Opcional. Ao vincular uma cotação aprovada, os campos abaixo são
                preenchidos automaticamente e travados.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Client */}
        <FormField
          control={form.control}
          name="client_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cliente *</FormLabel>
              <FormControl>
                <Combobox
                  value={field.value}
                  onValueChange={field.onChange}
                  options={clientOptions}
                  placeholder="Selecionar cliente..."
                  searchPlaceholder="Buscar cliente..."
                  disabled={linkedToQuotation}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Numero do processo na Inova */}
        <FormField
          control={form.control}
          name="inova_processo_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número do processo na Inova</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Ex: FRT0585.II" />
              </FormControl>
              <FormDescription>
                Opcional, mas recomendado preencher já se você souber — sem ele, a
                sincronização com a Inova fica inativa para este embarque (você pode
                preencher depois na aba Dados Gerais).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Estilo de processo (tipo_despacho) */}
          <FormField
            control={form.control}
            name="tipo_despacho"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estilo de processo *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(['DIRETO', 'CONSOLIDADO'] as const).map((v) => (
                      <SelectItem key={v} value={v}>
                        {TIPO_DESPACHO_LABELS[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Modal */}
          <FormField
            control={form.control}
            name="modal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modalidade *</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    if (v !== 'MARITIMO') form.setValue('tipo_embarque', undefined);
                  }}
                  disabled={linkedToQuotation}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="MARITIMO">Marítimo</SelectItem>
                    <SelectItem value="AEREO">Aéreo</SelectItem>
                    <SelectItem value="RODOVIARIO">Rodoviário</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tipo de embarque (only MARITIMO) */}
          {isMaritime && (
            <FormField
              control={form.control}
              name="tipo_embarque"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de embarque *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={linkedToQuotation}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="FCL">FCL</SelectItem>
                      <SelectItem value="LCL">LCL</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Incoterm */}
          <FormField
            control={form.control}
            name="incoterm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Incoterm</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Ex: FOB, CIF, EXW..."
                    disabled={linkedToQuotation}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Cargo urgente */}
        <FormField
          control={form.control}
          name="carga_urgente"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Carga urgente</FormLabel>
                <FormDescription>
                  Marca o embarque como prioritário no Kanban de Embarques.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Observacao */}
        <FormField
          control={form.control}
          name="observacao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observação</FormLabel>
              <FormControl>
                <Textarea {...field} rows={4} placeholder="Notas internas sobre o embarque..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/embarques/kanban')}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Criando...' : 'Criar processo'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
