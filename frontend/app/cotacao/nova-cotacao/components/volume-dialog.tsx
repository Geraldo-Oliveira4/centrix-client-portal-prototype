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
import type { CreateVolumeItem, QuotationModal, TipoEmbalagem } from '@/types/quotation';
import { TIPO_EMBALAGEM_LABELS } from '@/types/quotation';

const schema = z.object({
  quantity: z.string().min(1),
  embalagem: z.string().optional(),
  peso_bruto: z.string().optional(),
  peso_unidade: z.enum(['KG', 'LB']).default('KG'),
  comprimento: z.string().optional(),
  largura: z.string().optional(),
  altura: z.string().optional(),
  dimensao_unidade: z.enum(['CM', 'M', 'MM', 'POL']).default('CM'),
  volume_m3: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface VolumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: CreateVolumeItem) => void;
  initialValues?: CreateVolumeItem;
  modal?: QuotationModal;
}

const EMPTY_DEFAULTS: FormValues = {
  quantity: '1',
  embalagem: '',
  peso_bruto: '',
  peso_unidade: 'KG',
  comprimento: '',
  largura: '',
  altura: '',
  dimensao_unidade: 'CM',
  volume_m3: '',
};

// Normalizes a dimension value to centimeters regardless of the input unit.
function toCm(value: number, unit: 'CM' | 'M' | 'MM' | 'POL'): number {
  if (unit === 'M') return value * 100;
  if (unit === 'MM') return value / 10;
  if (unit === 'POL') return value * 2.54;
  return value;
}

/**
 * Calculates the chargeable volume/weight for a set of packages.
 *
 * All dimensions are normalized to centimeters before applying the formula.
 *
 * Air freight — dimensional weight (kg):
 *   (C × L × A) / 6000 × quantity
 *   The factor 6000 cm³/kg is the IATA standard for converting cubic
 *   centimeters to dimensional weight in kilograms.
 *
 * Maritime LCL — cubic meters (m³):
 *   (C × L × A) / 6000 / 166.67 × quantity
 *   Dividing by 6000 converts cm³ to dm³ (litres); dividing further by
 *   166.67 converts to m³ (1 m³ = 1,000,000 cm³ ÷ 6000 ÷ 166.67 ≈ 1).
 */
function calculateVolume(
  comprimento: string,
  largura: string,
  altura: string,
  dimensao_unidade: 'CM' | 'M' | 'MM' | 'POL',
  quantity: string,
  modal: QuotationModal | undefined,
): string {
  const c = parseFloat(comprimento);
  const l = parseFloat(largura);
  const a = parseFloat(altura);
  const qty = parseInt(quantity, 10);

  if (!c || !l || !a || c <= 0 || l <= 0 || a <= 0) return '';

  const cCm = toCm(c, dimensao_unidade);
  const lCm = toCm(l, dimensao_unidade);
  const aCm = toCm(a, dimensao_unidade);
  const safeQty = isNaN(qty) || qty < 1 ? 1 : qty;

  const result =
    modal === 'AEREO'
      ? (cCm * lCm * aCm / 6000) * safeQty
      : (cCm * lCm * aCm / 6000 / 166.67) * safeQty;

  return result.toFixed(4);
}

export function VolumeDialog({ open, onOpenChange, onAdd, initialValues, modal }: VolumeDialogProps) {
  const isEditing = initialValues !== undefined;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_DEFAULTS,
  });

  const watchComprimento = form.watch('comprimento');
  const watchLargura = form.watch('largura');
  const watchAltura = form.watch('altura');
  const watchDimensaoUnidade = form.watch('dimensao_unidade');
  const watchQuantity = form.watch('quantity');

  useEffect(() => {
    const calculated = calculateVolume(
      watchComprimento ?? '',
      watchLargura ?? '',
      watchAltura ?? '',
      watchDimensaoUnidade ?? 'CM',
      watchQuantity ?? '1',
      modal,
    );
    form.setValue('volume_m3', calculated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchComprimento, watchLargura, watchAltura, watchDimensaoUnidade, watchQuantity, modal]);

  useEffect(() => {
    if (open) {
      form.reset(
        initialValues
          ? {
              quantity: String(initialValues.quantity),
              embalagem: initialValues.embalagem ?? '',
              peso_bruto: initialValues.peso_bruto != null ? String(initialValues.peso_bruto) : '',
              peso_unidade: initialValues.peso_unidade ?? 'KG',
              comprimento: initialValues.comprimento != null ? String(initialValues.comprimento) : '',
              largura: initialValues.largura != null ? String(initialValues.largura) : '',
              altura: initialValues.altura != null ? String(initialValues.altura) : '',
              dimensao_unidade: initialValues.dimensao_unidade ?? 'CM',
              volume_m3: initialValues.volume_m3 != null ? String(initialValues.volume_m3) : '',
            }
          : EMPTY_DEFAULTS,
      );
    }
  }, [open, initialValues, form]);

  const handleSubmit = (values: FormValues) => {
    onAdd({
      quantity: parseInt(values.quantity, 10),
      embalagem: (values.embalagem as TipoEmbalagem) || undefined,
      peso_bruto: values.peso_bruto ? parseFloat(values.peso_bruto) : undefined,
      peso_unidade: values.peso_unidade,
      comprimento: values.comprimento ? parseFloat(values.comprimento) : undefined,
      largura: values.largura ? parseFloat(values.largura) : undefined,
      altura: values.altura ? parseFloat(values.altura) : undefined,
      dimensao_unidade: values.dimensao_unidade,
      volume_m3: values.volume_m3 ? parseFloat(values.volume_m3) : undefined,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-content-md !max-w-[740px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Volume' : 'Novo Volume'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-5">
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
                name="embalagem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Embalagem</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value ?? ''}
                        onValueChange={field.onChange}
                        options={(Object.entries(TIPO_EMBALAGEM_LABELS) as [TipoEmbalagem, string][]).map(
                          ([value, label]) => ({ value, label }),
                        )}
                        placeholder="Selecionar..."
                        searchPlaceholder="Buscar embalagem..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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

              <FormField
                control={form.control}
                name="peso_unidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade</FormLabel>
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

            <div className="flex flex-col gap-1.5">
              <FormLabel className="text-sm">Dimensões</FormLabel>
              <div className="grid grid-cols-4 gap-2">
                <FormField
                  control={form.control}
                  name="comprimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="number" placeholder="Comprimento" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="largura"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="number" placeholder="Largura" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="altura"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="number" placeholder="Altura" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dimensao_unidade"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CM">cm</SelectItem>
                          <SelectItem value="M">m</SelectItem>
                          <SelectItem value="MM">mm</SelectItem>
                          <SelectItem value="POL">pol</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="volume_m3"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{modal === 'AEREO' ? 'Peso Taxado (kg)' : 'Volume (m³)'}</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0.000" readOnly {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
