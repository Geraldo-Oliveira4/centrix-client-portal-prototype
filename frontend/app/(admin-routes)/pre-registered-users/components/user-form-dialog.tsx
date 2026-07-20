import React, { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserAddViewModel } from '@/types/user-viewmodel';
import { TextInput } from '@arboria-tech/arboria-ui';
import { CentrixPreRegisteredUser } from '@/types/centrix-user';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
interface UserFormDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  user: CentrixPreRegisteredUser | null;
  addUser: (user: UserAddViewModel[]) => void;
}

const formSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .min(1, 'O campo email é obrigatório.'),
  role: z.enum(['admin', 'manager', 'user']),
});

type FormData = z.infer<typeof formSchema>;

export const UserFormDialog: React.FC<UserFormDialogProps> = ({
  open,
  setOpen,
  user,
  addUser,
}) => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: user?.email || '',
      role:
        (user?.role?.toLowerCase() as 'admin' | 'manager' | 'user') || 'user',
    },
  });

  const onSubmit = useCallback(
    (values: FormData) => {
      addUser([values]);
      setOpen(false);
      form.reset();
    },
    [addUser, setOpen, form],
  );

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        form.reset();
      }
      setOpen(isOpen);
    },
    [setOpen, form],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {user ? 'Editar Usuário' : 'Adicionar Novo Usuário'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <TextInput
              control={form.control}
              name="email"
              label="Email"
              placeholder="Email do usuário"
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Função</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          defaultValue={field.value}
                          placeholder="Selecione uma função"
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-green-500 hover:bg-green-600">
                Salvar Usuário
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
