'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogFooter,
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
} from '@/components/ui';
import type { CreateEquipmentItem, TipoContainer } from '@/types/quotation';
import { TIPO_CONTAINER_LABELS } from '@/types/quotation';

const schema = z.object({
  quantity: z.string().min(1),
  tipo_container: z.string().min(1),
  volume_m3: z.string().optional(),
  peso_bruto: z.string().optional(),
  peso_unidade: z.enum(['KG', 'LB']).default('KG'),
});

type FormValues = z.infer<typeof schema>;

interface EquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: CreateEquipmentItem) => void;
  initialValues?: CreateEquipmentItem;
}

export function EquipmentDialog({ open, onOpenChange, onAdd, initialValues }: EquipmentDialogProps) {
  const isEditing = initialValues !== undefined;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      quantity: '1',
      tipo_container: '',
      volume_m3: '',
      peso_bruto: '',
      peso_unidade: 'KG',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        initialValues
          ? {
              quantity: String(initialValues.quantity),
              tipo_container: initialValues.tipo_container ?? '',
              volume_m3: initialValues.volume_m3 != null ? String(initialValues.volume_m3) : '',
              peso_bruto: initialValues.peso_bruto != null ? String(initialValues.peso_bruto) : '',
              peso_unidade: initialValues.peso_unidade ?? 'KG',
            }
          : { quantity: '1', tipo_container: '', volume_m3: '', peso_bruto: '', peso_unidade: 'KG' },
      );
    }
  }, [open, initialValues, form]);

  const handleSubmit = (values: FormValues) => {
    onAdd({
      quantity: parseInt(values.quantity, 10),
      tipo_container: values.tipo_container as TipoContainer,
      volume_m3: values.volume_m3 ? parseFloat(values.volume_m3) : undefined,
      peso_bruto: values.peso_bruto ? parseFloat(values.peso_bruto) : undefined,
      peso_unidade: values.peso_unidade,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-content-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Equipamento' : 'Novo Equipamento'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} placeholder="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="peso_unidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade de Peso</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="KG">kg</SelectItem>
                        <SelectItem value="LB">lb</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tipo_container"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipamento</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value}
                      onValueChange={field.onChange}
                      options={(Object.entries(TIPO_CONTAINER_LABELS) as [TipoContainer, string][]).map(
                        ([value, label]) => ({ value, label }),
                      )}
                      placeholder="Selecionar..."
                      searchPlaceholder="Buscar container..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="volume_m3"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Volume (m³)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="peso_bruto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peso Bruto Total</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">{isEditing ? 'Salvar' : 'Adicionar'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
