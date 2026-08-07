'use client';

import React from 'react';
import { BrandLogo } from '@/components/brand-logo';
import RegisterForm from './components/register-form';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from '@/components/ui';

const RegisterPage = () => {
  const router = useRouter();

  return (
    <main className="h-screen flex w-full overflow-hidden">
      <div className="bg-brand-gradient w-full h-full hidden md:flex items-center justify-center relative">
        <div className="flex flex-col items-center justify-center text-center max-w-lg p-8">
          <div className="mb-8">
            <BrandLogo variant="light" size="lg" />
          </div>
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-4">
              Centrix
            </h1>
            <div className="mt-8">
              <div className="w-16 h-1 bg-gradient-to-r from-brand-pink to-brand-gold rounded mx-auto" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center bg-background h-full max-w-3xl w-full p-4 sm:p-8 relative overflow-hidden">
        <div className="absolute top-8 left-8 md:hidden">
          <BrandLogo variant="auto" size="md" />
        </div>

        <Card className="w-full max-w-md shadow-elevation border-0 animate-fade-in overflow-auto">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">
              Registrar
            </CardTitle>
            <CardDescription className="text-base">
              Preencha o formulário abaixo para criar uma conta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
            <Separator className="my-6" />

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push('/login')}
              >
                Voltar para Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default RegisterPage;
