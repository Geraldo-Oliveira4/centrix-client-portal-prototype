import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LockKeyhole, Check } from 'lucide-react';
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@/components/ui';

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, { message: 'Sua senha deve ter pelo menos 8 caracteres' })
      .regex(/[A-Z]/, {
        message: 'Sua senha deve conter pelo menos uma letra maiúscula',
      })
      .regex(/[0-9]/, { message: 'Sua senha deve conter pelo menos um número' })
      .regex(/[^A-Za-z0-9]/, {
        message: 'Sua senha deve conter pelo menos um caractere especial',
      }),
    confirmPassword: z
      .string()
      .min(8, { message: 'Confirmação de senha é obrigatória' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não correspondem',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordFormProps {
  token: string;
}

const ResetPasswordForm = ({ token }: ResetPasswordFormProps) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: FormData) => {
    setLoading(true);
    try {
      // Here you would make an API call with token and new password
      // Example:
      // await api.post('/reset-password', {
      //   token: token,
      //   password: values.newPassword,
      // });

      // Simulate API call for demo purposes
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setResetSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error) {
      form.setError('root', {
        message: 'Erro ao redefinir senha. Tente novamente mais tarde.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (resetSuccess) {
    return (
      <div className="text-center py-4">
        <div className="bg-green-50 p-6 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
          <Check className="h-10 w-10 text-green-500" />
        </div>
        <h3 className="text-xl font-medium mb-2">Senha Atualizada!</h3>
        <p className="text-muted-foreground mb-4">
          Sua senha foi redefinida com sucesso. Você será redirecionado para a
          página de login.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-secondary/30 p-4 rounded-lg mb-6">
          <div className="flex items-start gap-3">
            <LockKeyhole className="h-6 w-6 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium mb-1">Requisitos de senha</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Mínimo de 8 caracteres</li>
                <li>Pelo menos uma letra maiúscula</li>
                <li>Pelo menos um número</li>
                <li>Pelo menos um caractere especial</li>
              </ul>
            </div>
          </div>
        </div>

        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nova Senha</FormLabel>
              <FormControl>
                <Input placeholder="••••••••" type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirme a Nova Senha</FormLabel>
              <FormControl>
                <Input placeholder="••••••••" type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <div className="text-sm font-medium text-destructive">
            {form.formState.errors.root.message}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Processando...' : 'Redefinir Senha'}
        </Button>
      </form>
    </Form>
  );
};

export default ResetPasswordForm;
