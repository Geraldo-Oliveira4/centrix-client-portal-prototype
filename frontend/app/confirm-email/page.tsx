'use client';

import React, { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';

import { BrandLogo } from '@/components/brand-logo';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import ConfirmEmailForm from './components/confirm-email-form';

const ConfirmEmailPage = () => {
  const router = useRouter();

  return (
    <main className="h-screen flex w-full overflow-hidden">
      <div className="bg-brand-gradient w-full h-full hidden md:flex items-center justify-center relative">
        <div className="flex flex-col items-center justify-center text-center max-w-lg p-8">
          <div className="mb-8">
            <BrandLogo variant="light" size="lg" />
          </div>
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-4">Centrix</h1>
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
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-secondary/50 p-2 rounded-full">
                <MailCheck className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Confirme seu email
              </CardTitle>
            </div>
            <CardDescription className="text-base">
              Digite o código de 6 dígitos que enviamos para o seu email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Suspense fallback={null}>
              <ConfirmEmailForm />
            </Suspense>
            <Button
              variant="link"
              className="w-full"
              onClick={() => router.push('/login')}
            >
              Voltar ao login
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default ConfirmEmailPage;
