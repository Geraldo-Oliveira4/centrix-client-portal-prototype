import React from 'react';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Button,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';

type DateRange = '24h' | '7d' | '30d' | 'custom';

interface DateConfig {
  type: 'range' | 'specific';
  days?: number;
  date?: Date;
}

interface DateRangeSelectorProps {
  onDateChange: (config: DateConfig) => void;
}

const ranges: Record<DateRange, { label: string; days: number | null }> = {
  '24h': { label: 'Últimas 24 horas', days: 1 },
  '7d': { label: 'Últimos 7 dias', days: 7 },
  '30d': { label: 'Últimos 30 dias', days: 30 },
  custom: { label: 'Data específica até hoje', days: null },
};

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  onDateChange,
}) => {
  const [dateRange, setDateRange] = React.useState<DateRange>('7d');
  const [customDate, setCustomDate] = React.useState<Date | undefined>(
    undefined,
  );

  const handleRangeChange = (value: DateRange) => {
    setDateRange(value);
    setCustomDate(undefined);

    if (value !== 'custom') {
      const days = ranges[value].days;
      if (days !== null) {
        onDateChange({
          type: 'range',
          days,
        });
      }
    }
  };

  const handleCustomDateChange = (date: Date | undefined) => {
    setCustomDate(date);
    setDateRange('custom');
    if (date) {
      onDateChange({
        type: 'specific',
        date,
      });
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Select value={dateRange} onValueChange={handleRangeChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Selecione o período" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ranges).map(([key, { label }]) => (
            <SelectItem key={key} value={key as DateRange}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {dateRange === 'custom' && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[240px] justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {customDate
                ? format(customDate, 'PPP', { locale: ptBR })
                : 'Selecionar data'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={customDate}
              onSelect={handleCustomDateChange}
              locale={ptBR}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default DateRangeSelector;
