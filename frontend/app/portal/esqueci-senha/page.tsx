'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

const requestSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
});

const resetSchema = z
  .object({
    email: z.string().email({ message: 'Email inválido' }),
    code: z
      .string()
      .min(6, { message: 'O código tem 6 dígitos' })
      .max(6, { message: 'O código tem 6 dígitos' }),
    newPassword: z
      .string()
      .min(8, { message: 'A senha deve ter pelo menos 8 caracteres' }),
    newPasswordConfirm: z.string(),
  })
  .refine((v) => v.newPassword === v.newPasswordConfirm, {
    path: ['newPasswordConfirm'],
    message: 'As senhas não conferem',
  });

type RequestValues = z.infer<typeof requestSchema>;
type ResetValues = z.infer<typeof resetSchema>;

type Stage = 'request' | 'reset';

export default function PortalEsqueciSenhaPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('request');
  const [loading, setLoading] = useState(false);

  const requestForm = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: '' },
  });

  const resetForm = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '', code: '', newPassword: '', newPasswordConfirm: '' },
  });

  const onRequest = async (values: RequestValues) => {
    setLoading(true);
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API}/portal/auth/forgot-password`,
        { email: values.email },
      );
      resetForm.reset({
        email: values.email,
        code: '',
        newPassword: '',
        newPasswordConfirm: '',
      });
      setStage('reset');
      toast.info('Se o e-mail existir, um código foi enviado.');
    } catch {
      // Backend always returns 200; this branch only fires on a network error.
      toast.error('Falha de rede. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const onReset = async (values: ResetValues) => {
    setLoading(true);
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API}/portal/auth/confirm-forgot-password`,
        {
          email: values.email,
          confirmation_code: values.code,
          new_password: values.newPassword,
        },
      );
      toast.success('Senha redefinida! Faça login com sua nova senha.');
      router.push('/portal/login');
    } catch (err) {
      const data = axios.isAxiosError(err) ? err.response?.data : null;
      const message =
        (data && typeof data.error === 'string' && data.error) ||
        'Não foi possível redefinir a senha.';
      resetForm.setError('root', { message });
    } finally {
      setLoading(false);
    }
  };

  if (stage === 'request') {
    return (
      <PortalAuthShell
        title="Esqueci minha senha"
        description="Digite seu e-mail para receber um código de redefinição."
        footer={
          <>
            <Separator className="my-6" />
            <Button asChild variant="link" className="w-full text-brand-indigo" disabled={loading}>
              <Link href="/portal/login">Voltar ao login</Link>
            </Button>
          </>
        }
      >
        <Form {...requestForm}>
          <form
            onSubmit={requestForm.handleSubmit(onRequest)}
            className="space-y-4"
          >
            <FormField
              control={requestForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="voce@empresa.com.br"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar código'}
            </Button>
          </form>
        </Form>
      </PortalAuthShell>
    );
  }

  return (
    <PortalAuthShell
      title="Redefinir senha"
      description="Insira o código recebido por e-mail e crie uma nova senha."
      footer={
        <>
          <Separator className="my-6" />
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setStage('request')}
              disabled={loading}
            >
              Reenviar para outro e-mail
            </Button>
            <Button asChild variant="link" className="w-full text-brand-indigo" disabled={loading}>
              <Link href="/portal/login">Voltar ao login</Link>
            </Button>
          </div>
        </>
      }
    >
      <Form {...resetForm}>
        <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4">
          <FormField
            control={resetForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" readOnly {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={resetForm.control}
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
          <FormField
            control={resetForm.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova senha</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={resetForm.control}
            name="newPasswordConfirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmar nova senha</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {resetForm.formState.errors.root ? (
            <p className="text-sm text-destructive" role="alert">
              {resetForm.formState.errors.root.message}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Redefinindo...' : 'Redefinir senha'}
          </Button>
        </form>
      </Form>
    </PortalAuthShell>
  );
}
