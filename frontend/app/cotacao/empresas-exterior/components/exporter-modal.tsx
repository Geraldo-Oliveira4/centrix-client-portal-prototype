'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldAlert, Pencil, Trash2 } from 'lucide-react';
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
  Textarea,
} from '@/components/ui';
import { useExporters } from '@/hooks/use-exporters';
import {
  CARGO_PROFILE_LABELS,
  CreateExporterPayload,
  Exporter,
  UpdateExporterPayload,
} from '@/types/exporter';
import { SectionHeader } from '@arboria-tech/arboria-ui';

type ModalMode = 'create' | 'read' | 'edit';

const exporterSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  endereco: z.string().optional(),
  particularidades: z.string().optional(),
  cargo_profile: z.enum(['GERAL', 'PERIGOSA', 'TEMP_CONTROLADA']).optional(),
  contact_email: z.string().email('Email inválido').optional().or(z.literal('')),
});

type ExporterFormValues = z.infer<typeof exporterSchema>;

interface ExporterModalProps {
  exporterId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExporterModal({ exporterId, open, onOpenChange }: ExporterModalProps) {
  const [mode, setMode] = useState<ModalMode>('create');
  const [exporter, setExporter] = useState<Exporter | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { createExporter, updateExporter, getExporter, deleteExporter } = useExporters();

  const form = useForm<ExporterFormValues>({
    resolver: zodResolver(exporterSchema),
    defaultValues: { cargo_profile: 'GERAL' },
  });

  useEffect(() => {
    if (!open) return;

    if (exporterId) {
      setMode('read');
      setIsLoading(true);
      getExporter(exporterId).then((data) => {
        setExporter(data);
        setIsLoading(false);
      });
    } else {
      setMode('create');
      setExporter(null);
      form.reset({ cargo_profile: 'GERAL' });
    }
  }, [open, exporterId]);

  const populateForm = (data: Exporter) => {
    form.reset({
      name: data.name,
      endereco: data.endereco ?? '',
      particularidades: data.particularidades ?? '',
      cargo_profile: data.cargo_profile,
      contact_email: data.contact_email ?? '',
    });
  };

  const handleEditStart = () => {
    if (exporter) populateForm(exporter);
    setMode('edit');
  };

  const handleDeleteConfirm = async () => {
    if (!exporterId) return;
    setIsDeleting(true);
    const success = await deleteExporter(exporterId);
    setIsDeleting(false);
    if (success) {
      setDeleteDialogOpen(false);
      onOpenChange(false);
    }
  };

  const handleSubmitCreate = async (values: ExporterFormValues) => {
    setIsSubmitting(true);
    const payload: CreateExporterPayload = {
      name: values.name,
      endereco: values.endereco || undefined,
      particularidades: values.particularidades || undefined,
      cargo_profile: values.cargo_profile,
      contact_email: values.contact_email || undefined,
    };
    const result = await createExporter(payload);
    setIsSubmitting(false);
    if (result) {
      form.reset();
      onOpenChange(false);
    }
  };

  const handleSubmitEdit = async (values: ExporterFormValues) => {
    if (!exporterId) return;
    setIsSubmitting(true);
    const payload: UpdateExporterPayload = {
      name: values.name,
      endereco: values.endereco || undefined,
      particularidades: values.particularidades || undefined,
      cargo_profile: values.cargo_profile,
      contact_email: values.contact_email || undefined,
    };
    const updated = await updateExporter(exporterId, payload);
    setIsSubmitting(false);
    if (updated) {
      setExporter(updated);
      setMode('read');
    }
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
              {mode === 'create' ? 'Novo Exportador' : (exporter?.name ?? '...')}
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
        ) : mode === 'read' && exporter ? (
          <ExporterReadView exporter={exporter} />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
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
                          <Input type="email" placeholder="contato@exportador.com" {...field} />
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
                            {Object.entries(CARGO_PROFILE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
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
                          placeholder="Ex: Coleta requer agendamento previo, horario restrito..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                      ? 'Cadastrar Exportador'
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
          <AlertDialogTitle>Excluir exportador</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir <strong>{exporter?.name}</strong>? Esta ação não pode
            ser desfeita. Exportadores com cotações vinculadas não podem ser excluídos.
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

function ExporterReadView({ exporter }: { exporter: Exporter }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SectionHeader>
          Dados do Exportador
        </SectionHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <InfoField label="Email de Contato" value={exporter.contact_email} />
          <InfoField label="Endereço" value={exporter.endereco} />
          <InfoField
            label="Perfil de Carga"
            value={
              exporter.cargo_profile === 'PERIGOSA' ? (
                <Badge className="gap-1 bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-900/30 dark:text-orange-400">
                  <ShieldAlert className="w-3 h-3" />
                  {CARGO_PROFILE_LABELS[exporter.cargo_profile]}
                </Badge>
              ) : (
                CARGO_PROFILE_LABELS[exporter.cargo_profile]
              )
            }
          />
          <InfoField
            label="Desde"
            value={new Date(exporter.created_at).toLocaleDateString('pt-BR')}
          />
        </div>
      </div>

      {exporter.particularidades && (
        <>
          <hr className="border-border" />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Particularidades de Coleta
            </span>
            <span className="text-sm">{exporter.particularidades}</span>
          </div>
        </>
      )}
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
