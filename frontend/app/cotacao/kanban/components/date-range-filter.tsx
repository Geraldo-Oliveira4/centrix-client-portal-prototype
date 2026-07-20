'use client';

import { CalendarDays, X } from 'lucide-react';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DateRangeFilterProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  label?: string;
  className?: string;
}

// 'YYYY-MM-DD' -> Date at local midnight (avoids UTC off-by-one).
function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

// Date -> 'YYYY-MM-DD' from local parts.
function formatDate(date: Date | undefined): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const triggerLabel = (fromDate?: Date, toDate?: Date): string | null => {
  if (fromDate && toDate) {
    return `${format(fromDate, 'dd/MM/yy')} – ${format(toDate, 'dd/MM/yy')}`;
  }
  if (fromDate) return `A partir de ${format(fromDate, 'dd/MM/yy')}`;
  if (toDate) return `Até ${format(toDate, 'dd/MM/yy')}`;
  return null;
};

export function DateRangeFilter({
  from,
  to,
  onChange,
  label = 'Recebimento',
  className,
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);

  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  const selected: DateRange | undefined = fromDate ? { from: fromDate, to: toDate } : undefined;
  const active = Boolean(fromDate || toDate);
  const summary = triggerLabel(fromDate, toDate);

  const handleSelect = (range: DateRange | undefined) => {
    onChange(formatDate(range?.from), formatDate(range?.to));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', '');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 justify-start gap-2 font-normal',
            active ? 'text-foreground' : 'text-muted-foreground',
            className,
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{summary ?? label}</span>
          {active && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Limpar período"
              onClick={handleClear}
              className="ml-1 rounded-sm opacity-60 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          locale={ptBR}
          defaultMonth={fromDate ?? toDate}
          selected={selected}
          onSelect={handleSelect}
          numberOfMonths={2}
        />
        <div className="flex items-center justify-between border-t px-3 py-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!active}
            onClick={() => onChange('', '')}
          >
            Limpar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
