'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';

import base_api from '@/lib/axios-config';
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

const confirmSchema = z.object({
  confirmation_code: z
    .string()
    .length(6, { message: 'O código deve ter 6 dígitos' })
    .regex(/^\d+$/, { message: 'O código deve conter apenas números' }),
});

type ConfirmFormValues = z.infer<typeof confirmSchema>;

const ConfirmEmailForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const form = useForm<ConfirmFormValues>({
    resolver: zodResolver(confirmSchema),
    defaultValues: { confirmation_code: '' },
  });

  const onSubmit = async (values: ConfirmFormValues) => {
    setLoading(true);
    try {
      await base_api.post('/confirm-email', {
        email,
        confirmation_code: values.confirmation_code,
      });
      toast.success('Email confirmado! Faça login para continuar.');
      router.push('/login');
    } catch (error: any) {
      const message = error.response?.data?.error ?? 'Código inválido ou expirado. Tente novamente.';
      form.setError('confirmation_code', { message });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await base_api.post('/resend-confirmation', { email });
      toast.success('Novo código enviado para o seu email.');
    } catch {
      toast.error('Erro ao reenviar o código. Tente novamente.');
    } finally {
      setResending(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Código enviado para <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <FormField
          control={form.control}
          name="confirmation_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Código de confirmação</FormLabel>
              <FormControl>
                <Input
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Confirmando...' : 'Confirmar email'}
        </Button>

        <Button
          type="button"
          variant="link"
          className="w-full"
          disabled={resending}
          onClick={handleResend}
        >
          {resending ? 'Reenviando...' : 'Reenviar código'}
        </Button>
      </form>
    </Form>
  );
};

export default ConfirmEmailForm;
