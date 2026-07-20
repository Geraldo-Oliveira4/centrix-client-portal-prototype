'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { cn } from '@/lib/utils';

const URGENCY_TRIGGER_CLASS: Record<string, string> = {
  URGENTE: 'border-red-400 text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-400',
  VIP: 'border-pink-400 text-pink-800 bg-pink-50 dark:bg-pink-900/30 dark:text-pink-400',
  ALTA: 'border-orange-400 text-orange-700 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400',
  NORMAL: '',
};

export function UrgencySelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: 'URGENTE' | 'VIP' | 'ALTA' | 'NORMAL' | null) => void;
}) {
  return (
    <Select
      value={value ?? ''}
      onValueChange={(v) => onChange((v || null) as 'URGENTE' | 'VIP' | 'ALTA' | 'NORMAL' | null)}
    >
      <SelectTrigger
        className={cn(
          'h-6 text-[11px] px-2 py-0 rounded-full border font-semibold w-auto gap-1',
          value && URGENCY_TRIGGER_CLASS[value],
          !value && 'text-muted-foreground',
        )}
      >
        <SelectValue placeholder="Urgência" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="URGENTE">Urgente</SelectItem>
        <SelectItem value="VIP">VIP</SelectItem>
        <SelectItem value="ALTA">Alta</SelectItem>
        <SelectItem value="NORMAL">Normal</SelectItem>
      </SelectContent>
    </Select>
  );
}
