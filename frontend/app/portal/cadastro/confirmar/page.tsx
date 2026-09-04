'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { toast } from 'react-toastify';

import { PortalAuthShell } from '@/app/portal/components/portal-auth-shell';
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Separator,
} from '@/components/ui';

const schema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  code: z
    .string()
    .min(6, { message: 'O código tem 6 dígitos' })
    .max(6, { message: 'O código tem 6 dígitos' }),
});

type FormValues = z.infer<typeof schema>;

export default function PortalConfirmarCadastroPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') ?? '';

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: initialEmail, code: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API}/portal/auth/confirm-email`,
        {
          email: values.email,
          confirmation_code: values.code,
        },
      );
      toast.success('Cadastro confirmado! Faça login para continuar.');
      router.push('/portal/login');
    } catch (err) {
      const data = axios.isAxiosError(err) ? err.response?.data : null;
      const message =
        (data && typeof data.error === 'string' && data.error) ||
        'Código inválido ou expirado.';
      form.setError('code', { message });
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    const email = form.getValues('email');
    if (!email) {
      form.setError('email', { message: 'Informe o email para reenviar' });
      return;
    }
    setResending(true);
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API}/portal/auth/resend-confirmation`,
        { email },
      );
      toast.success('Novo código enviado para seu e-mail.');
    } catch {
      toast.error('Não foi possível reenviar o código agora.');
    } finally {
      setResending(false);
    }
  };

  return (
    <PortalAuthShell
      title="Confirmar cadastro"
      description="Digite o código de 6 dígitos enviado para seu e-mail."
      footer={
        <>
          <Separator className="my-6" />
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onResend}
              disabled={resending || loading}
            >
              {resending ? 'Reenviando...' : 'Reenviar código'}
            </Button>
            <Button asChild variant="link" className="w-full text-brand-indigo" disabled={loading}>
              <Link href="/portal/login">Voltar ao login</Link>
            </Button>
          </div>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    readOnly={!!initialEmail}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={6}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Confirmando...' : 'Confirmar'}
          </Button>
        </form>
      </Form>
    </PortalAuthShell>
  );
}
