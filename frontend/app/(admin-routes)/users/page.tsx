'use client';

import React from 'react';
import { useUsers } from '@/hooks/use-users';
import { useRouter } from 'next/navigation';
import { PageTitle } from '@arboria-tech/arboria-ui';
import { DataTable } from '@/components/data-table';
import { columns } from './components/columns';
import { LoaderComponent } from '@arboria-tech/arboria-ui';
import { ErrorComponent } from '@arboria-tech/arboria-ui';
import { ForcePasswordReset } from './components/force-reset-password';
import { Button } from '@/components/ui';

export default function UsersPage() {
  const { users, isLoading, isError } = useUsers();
  const router = useRouter();

  if (isLoading) {
    return <LoaderComponent />;
  }

  if (isError) {
    return <ErrorComponent />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
        <PageTitle title="Usuários" />
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <ForcePasswordReset />
          <Button
            onClick={() => router.push('/pre-registered-users')}
            className="whitespace-normal sm:whitespace-nowrap text-sm sm:text-base"
          >
            Usuários Pré-Registrados
          </Button>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={users || []}
        enableColumnVisibility={false}
        enableFiltering={false}
        onRowClick={(row) => console.log(row)}
      />
    </div>
  );
}
