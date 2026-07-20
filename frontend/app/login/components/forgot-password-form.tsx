'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import base_api from '@/lib/axios-config';
import { useRouter } from 'next/navigation';
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

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Email Inválido' }),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

const ForgotPasswordForm = ({
  setEmailSent,
  setEmail,
}: {
  setEmailSent: (emailSent: boolean) => void;
  setEmail: (email: string) => void;
}) => {
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const [loading, setLoading] = useState(false);

  const onSubmit = async (values: ForgotPasswordFormData) => {
    setLoading(true);
    try {
      const response = await base_api.post('/forgot-password', {
        email: values.email,
      });
      if (response.status === 200) {
        setEmail(values.email);
        setEmailSent(true);
        router.push('/reset-password?email=' + values.email);
      } else {
        form.setError('email', {
          message: 'Erro ao enviar email. Tente novamente mais tarde.',
        });
      }
    } catch (error) {
      form.setError('email', {
        message: 'Erro ao enviar email. Tente novamente mais tarde.',
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
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar'}
        </Button>
      </form>
    </Form>
  );
};

export default ForgotPasswordForm;
