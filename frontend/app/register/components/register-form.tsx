'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import base_api from '@/lib/axios-config';
import { toast } from 'react-toastify';
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

const registerSchema = z
  .object({
    name: z.string().min(1, { message: 'Nome é obrigatório' }),
    email: z.string().email({ message: 'Email Inválido' }),
    password: z
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
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não correspondem',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

const RegisterForm = () => {
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const [loading, setLoading] = useState(false);

  const onSubmit = async (values: RegisterFormValues) => {
    setLoading(true);
    try {
      const requestBody = {
        email: values.email,
        password: values.password,
        name: values.name,
      };

      const response = await base_api.post('/register', requestBody);
      console.log('Registrado com sucesso:', response.data);

      toast.success('Conta criada! Verifique seu email para confirmar o cadastro.');
      router.push(`/confirm-email?email=${encodeURIComponent(values.email)}`);
    } catch (error: any) {
      console.error('Erro ao registrar:', error);
      const data = error.response?.data;

      if (data?.code === 'USER_UNCONFIRMED') {
        toast.info('Cadastro já iniciado. Confirme seu e-mail para continuar.');
        router.push(`/confirm-email?email=${encodeURIComponent(values.email)}`);
        return;
      }

      form.setError('email', {
        message: data?.error ?? 'Ocorreu um erro ao tentar registrar. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Seu nome" {...field} />
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
                  placeholder="exemplo@email.com"
                  type="email"
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
                <Input placeholder="******" type="password" {...field} />
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
              <FormLabel>Confirme a Senha</FormLabel>
              <FormControl>
                <Input placeholder="******" type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Registrando...' : 'Registrar'}
        </Button>
      </form>
    </Form>
  );
};

export default RegisterForm;
