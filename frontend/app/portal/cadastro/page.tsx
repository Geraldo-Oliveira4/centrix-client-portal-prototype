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

const schema = z
  .object({
    name: z.string().min(2, { message: 'Informe seu nome' }),
    email: z.string().email({ message: 'Email inválido' }),
    password: z
      .string()
      .min(8, { message: 'A senha deve ter pelo menos 8 caracteres' }),
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'As senhas não conferem',
  });

type FormValues = z.infer<typeof schema>;

export default function PortalCadastroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', passwordConfirm: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API}/portal/auth/register`, {
        email: values.email,
        password: values.password,
        name: values.name,
      });
      router.push(
        `/portal/cadastro/confirmar?email=${encodeURIComponent(values.email)}`,
      );
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : null;
      const data = axios.isAxiosError(err) ? err.response?.data : null;

      if (status === 403) {
        form.setError('email', {
          message:
            'Esse e-mail não está cadastrado como contato de nenhum cliente. Fale com seu gerente Freitas Comex.',
        });
      } else if (status === 409 && data?.code === 'USER_UNCONFIRMED') {
        toast.info('Cadastro pendente. Redirecionando para a confirmação.');
        router.push(
          `/portal/cadastro/confirmar?email=${encodeURIComponent(values.email)}`,
        );
      } else if (status === 400 && typeof data?.error === 'string') {
        form.setError('root', { message: data.error });
      } else {
        form.setError('root', {
          message: 'Não foi possível cadastrar agora. Tente novamente em instantes.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalAuthShell
      title="Criar nova conta"
      description="Use o e-mail cadastrado como contato no seu cliente Freitas Comex."
      footer={
        <>
          <Separator className="my-6" />
          <div className="space-y-3">
            <Button asChild className="w-full" variant="outline" disabled={loading}>
              <Link href="/portal/login">Entrar na minha conta</Link>
            </Button>
          </div>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Seu nome" autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="passwordConfirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmar senha</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
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
            {loading ? 'Cadastrando...' : 'Cadastrar'}
          </Button>
        </form>
      </Form>
    </PortalAuthShell>
  );
}
