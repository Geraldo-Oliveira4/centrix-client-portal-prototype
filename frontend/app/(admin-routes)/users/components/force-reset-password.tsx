import React from 'react';
import { toast } from 'react-toastify';
import base_api from '@/lib/axios-config';
import { Key } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@/components/ui';

export const ForcePasswordReset: React.FC = () => {
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleForceReset = async () => {
    if (!confirm) return;
    setIsLoading(true);
    try {
      const response = await base_api.post('/force-password-reset');
      const { successCount } = response.data;
      toast.success(
        `Senha resetada com sucesso para ${successCount} usuários!`,
      );
      setShowConfirmDialog(false);
    } catch (error) {
      toast.error('Erro ao resetar senhas dos usuários.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => setShowConfirmDialog(true)}
      >
        <Key className="h-4 w-4" />
        Forçar Reset de Senha
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset de Senha em Massa</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá forçar todos os usuários a alterarem suas senhas no
              próximo login. Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceReset}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'Processando...' : 'Forçar Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
