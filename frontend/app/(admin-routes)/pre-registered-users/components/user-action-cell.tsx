import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { CentrixPreRegisteredUser } from '@/types/centrix-user';
import { usePreRegisteredUsers } from '@/hooks/use-pre-registered-users';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui';

export function UserActionCell({ user }: { user: CentrixPreRegisteredUser }) {
  const { deleteUser } = usePreRegisteredUsers();
  const [openDialog, setOpenDialog] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleDeleteUser = () => {
    deleteUser([user.email]);
    setOpenDialog(false);
  };

  const handleDeleteClick = () => {
    setIsDropdownOpen(false); // Close dropdown before opening dialog
    setTimeout(() => {
      setOpenDialog(true);
    }, 100); // Add small delay to ensure dropdown is closed
  };

  return (
    <>
      <DropdownMenu
        modal={false}
        open={isDropdownOpen}
        onOpenChange={setIsDropdownOpen}
      >
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          <DropdownMenuItem
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={handleDeleteClick}
          >
            Excluir usuário
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Separate Dialog component */}
      {openDialog && (
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tem certeza que deseja excluir?</DialogTitle>
              <DialogDescription>
                Esta ação não pode ser desfeita. O usuário será permanentemente
                excluído, podendo registrar-se novamente caso liberado.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-4 mt-4">
              <Button variant="ghost" onClick={() => setOpenDialog(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeleteUser}>
                Excluir
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
