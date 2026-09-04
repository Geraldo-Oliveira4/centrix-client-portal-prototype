'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';

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
import { portalSession } from '@/lib/portal-session';
import type { PortalLoginResponse } from '@/types/portal';

const schema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  password: z
    .string()
    .min(8, { message: 'A senha deve ter pelo menos 8 caracteres' }),
});

type FormValues = z.infer<typeof schema>;

const decodeJwt = (token: string): Record<string, unknown> | null => {
  try {
    const [, payload] = token.split('.');
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
};

export default function PortalLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const response = await axios.post<PortalLoginResponse>(
        `${process.env.NEXT_PUBLIC_API}/portal/auth/login`,
        { email: values.email, password: values.password },
      );
      const { access_token, id_token, refresh_token } = response.data;

      const claims = decodeJwt(id_token) ?? {};
      const expiresAt =
        typeof claims.exp === 'number' ? claims.exp * 1000 : Date.now() + 3600_000;

      portalSession.set({
        accessToken: access_token,
        idToken: id_token,
        refreshToken: refresh_token,
        expiresAt,
        user: {
          sub: typeof claims.sub === 'string' ? claims.sub : '',
          email: typeof claims.email === 'string' ? claims.email : values.email,
          name: typeof claims.name === 'string' ? claims.name : '',
        },
      });

      router.push('/portal/home');
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : null;
      const data = axios.isAxiosError(err) ? err.response?.data : null;

      if (status === 409 && data?.code === 'USER_UNCONFIRMED') {
        router.push(
          `/portal/cadastro/confirmar?email=${encodeURIComponent(values.email)}`,
        );
        return;
      }

      if (status === 401 || status === 403) {
        form.setError('password', { message: 'Credenciais inválidas' });
      } else {
        form.setError('root', {
          message: 'Não foi possível entrar. Tente novamente em instantes.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalAuthShell
      title="Acesso ao portal"
      description="Utilize seu email e senha para acessar suas cotações."
      footer={
        <>
          <Separator className="my-6" />
          <div className="space-y-3">
            <Button asChild className="w-full" variant="outline" disabled={loading}>
              <Link href="/portal/cadastro">Criar nova conta</Link>
            </Button>
            <Button asChild variant="link" className="w-full text-brand-indigo" disabled={loading}>
              <Link href="/portal/esqueci-senha">Esqueci minha senha</Link>
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
                    placeholder="voce@empresa.com.br"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.formState.errors.root ? (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </Form>
    </PortalAuthShell>
  );
}
