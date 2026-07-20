'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import { PageTitle } from '@arboria-tech/arboria-ui';
import { UserFormDialog } from './components/user-form-dialog';
import { DataTable } from '@/components/data-table';
import { columns } from './components/columns';
import { LoaderComponent } from '@arboria-tech/arboria-ui';
import { ErrorComponent } from '@arboria-tech/arboria-ui';
import { usePreRegisteredUsers } from '@/hooks/use-pre-registered-users';
import { CentrixPreRegisteredUser } from '@/types/centrix-user';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui';

export default function PreRegisteredUserPage() {
  const { users, isLoading, isError, addUser, deleteUser } =
    usePreRegisteredUsers();
  const [open, setOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          const parsedUsers = results.data.map(
            (row: CentrixPreRegisteredUser) => ({
              email: row.email,
              role: row.role,
            }),
          );
          addUser(parsedUsers);
        },
        error: (error: any) => {
          console.error('Error parsing CSV:', error);
        },
      });
    }
  };

  const handleDeleteAll = () => {
    if (users && users.length > 0) {
      const emails = users.map((user) => user.email);
      deleteUser(emails);
    }
    setConfirmDialogOpen(false);
  };

  if (isLoading) {
    return <LoaderComponent />;
  }

  if (isError) {
    return <ErrorComponent />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <PageTitle title="Usuários Pré-Registrados" />
          <p className="text-sm text-gray-600 mt-2 mr-6">
            Esses usuários ainda não estão registrados no sistema. Eles podem se
            registrar utilizando o e-mail fornecido e precisarão confirmar o
            registro através de um código enviado por e-mail. Caso deseje subir
            um csv, utilize email;role (admin ou user)
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-2 min-w-fit">
          <Button
            onClick={() => document.getElementById('upload-csv')?.click()}
          >
            Upload CSV
          </Button>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            id="upload-csv"
            style={{ display: 'none' }}
          />

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Adicionar usuário</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar usuário</DialogTitle>
                <DialogDescription>
                  Adicione o usuário preenchendo os campos abaixo.
                </DialogDescription>
              </DialogHeader>
              <UserFormDialog
                open={open}
                setOpen={setOpen}
                addUser={addUser}
                user={null}
              />
            </DialogContent>
          </Dialog>

          <Button
            variant="destructive"
            onClick={() => setConfirmDialogOpen(true)}
          >
            Deletar Todos
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

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmação de Deleção</DialogTitle>
            <DialogDescription>
              Você tem certeza de que deseja deletar todos os usuários? Esta
              ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteAll}>
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
