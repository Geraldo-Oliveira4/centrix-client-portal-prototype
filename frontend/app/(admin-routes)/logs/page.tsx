'use client';

import React, { useState } from 'react';
import { columns } from './components/columns';
import { LogTable } from './components/log-table';
import { useLogs } from '@/hooks/use-logs';
import { PageTitle } from '@arboria-tech/arboria-ui';
import { LoaderComponent } from '@arboria-tech/arboria-ui';
import DateRangeSelector from './components/date-range-selector';

export default function LogsPage() {
  const { logs, isLoading, setDateFilter } = useLogs();

  const handleDateChange = (dateConfig: any) => {
    setDateFilter(dateConfig);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <PageTitle title="Logs do Sistema" />
        <DateRangeSelector onDateChange={handleDateChange} />
      </div>

      {isLoading ? (
        <LoaderComponent />
      ) : (
        <LogTable columns={columns} enableFiltering={true} data={logs} />
      )}
    </div>
  );
}
