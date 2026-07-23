'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Textarea,
} from '@/components/ui';
import { createMyExporter } from '@/hooks/use-portal-exporters';
import { CARGO_PROFILE_LABELS, type Exporter } from '@/types/exporter';

// Self-service adaptation of the analyst app/cotacao/empresas-exterior modal.
// Differences, all deliberate:
//  - create only. The analyst modal also does read/edit/delete; the portal has
//    no such endpoints, since an exporter already linked to quotations is not
//    the client's to rewrite or remove.
//  - no client picker: the owner is derived from the session on the backend.
const exporterSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  endereco: z.string().optional(),
  particularidades: z.string().optional(),
  cargo_profile: z.enum(['GERAL', 'PERIGOSA', 'TEMP_CONTROLADA']).optional(),
  contact_email: z.string().email('Email inválido').optional().or(z.literal('')),
});

type ExporterFormValues = z.infer<typeof exporterSchema>;

const EMPTY_FORM: ExporterFormValues = {
  name: '',
  endereco: '',
  particularidades: '',
  cargo_profile: 'GERAL',
  contact_email: '',
};

interface PortalExporterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the created exporter, so the caller can auto-select it. */
  onCreated?: (exporter: Exporter) => void;
}

export function PortalExporterModal({
  open,
  onOpenChange,
  onCreated,
}: PortalExporterModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ExporterFormValues>({
    resolver: zodResolver(exporterSchema),
    defaultValues: EMPTY_FORM,
  });

  // Reset on every open so a cancelled attempt never leaks into the next one.
  useEffect(() => {
    if (open) form.reset(EMPTY_FORM);
  }, [open]);

  const onSubmit = async (values: ExporterFormValues) => {
    setIsSubmitting(true);
    const created = await createMyExporter({
      name: values.name,
      endereco: values.endereco || undefined,
      particularidades: values.particularidades || undefined,
      cargo_profile: values.cargo_profile,
      contact_email: values.contact_email || undefined,
    });
    setIsSubmitting(false);

    if (created) {
      onCreated?.(created);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Exportador</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
          >
            <fieldset className="flex flex-col gap-4">
              <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Dados do Exportador
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do exportador" {...field} />
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
                      <FormLabel>Email de Contato</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="contato@exportador.com"
                          {...field}
                        />
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
                  name="cargo_profile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Perfil de Carga</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(CARGO_PROFILE_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="particularidades"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Particularidades de Coleta</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ex: coleta requer agendamento prévio, horário restrito..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Informações que ajudam o agente a planejar a coleta na
                      origem.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Cadastrando...' : 'Cadastrar Exportador'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
