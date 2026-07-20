import { useState } from 'react';
import useSWR from 'swr';
import { LogsResponse } from '@/types/log';
import base_api from '@/lib/axios-config';

interface DateFilter {
  type: 'range' | 'specific';
  days?: number;
  date?: Date;
}

const buildDateQuery = (filter: DateFilter): string => {
  const params = new URLSearchParams();

  if (filter.type === 'range' && filter.days) {
    params.append('lastDays', filter.days.toString());
  } else if (filter.type === 'specific' && filter.date) {
    params.append('startDate', filter.date.toISOString());
  }

  return params.toString();
};

export const useLogs = () => {
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    type: 'range',
    days: 7,
  });

  const fetcher = async (url: string) => {
    const response = await base_api.get<LogsResponse>(url);
    return response.data;
  };

  const { data, error, isLoading } = useSWR(
    `/logs?${buildDateQuery(dateFilter)}`,
    fetcher,
  );

  return {
    logs: data?.items ?? [],
    isLoading,
    isError: !!error,
    setDateFilter,
  };
};
