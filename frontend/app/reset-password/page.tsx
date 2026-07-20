'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import logo from '@/assets/images/freitas-logo.png';
import ResetPasswordForm from './components/reset-password-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, ShieldAlert } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from '@/components/ui';

const ResetPasswordPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [validToken, setValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    const tokenFromParams = searchParams?.get('token');
    setToken(tokenFromParams);

    // Basic validation - you'll want to validate the token against your API
    setValidToken(!!tokenFromParams && tokenFromParams.length > 10);
  }, [searchParams]);

  return (
    <main className="h-screen flex w-full overflow-hidden">
      <div className="bg-blue-gradient w-full h-full hidden md:flex items-center justify-center relative">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/p/AF1QipMlefe4Uk5Ln3z4gpJsefkQsmATxLw2mD51ycfb=s1360-w1360-h1020')",
          }}
        />
        <div className="absolute top-8 left-8">
          <Image
            src={logo}
            alt="Centrix Logo"
            className="h-16 w-auto"
            width={120}
            height={64}
          />
        </div>
        <div className="relative z-10 text-white max-w-lg p-8">
          <h1 className="text-4xl font-bold mb-4">Redefinir Senha</h1>
          <p className="text-lg opacity-90">
            Recupere o acesso à sua conta definindo uma nova senha. Garantimos
            segurança e privacidade em todos os processos.
          </p>
          <div className="mt-8">
            <div className="w-16 h-1 bg-white opacity-50 rounded" />
          </div>
        </div>
        <div className="absolute bottom-0 w-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1440 320"
            className="text-white opacity-10"
          >
            <path
              fill="currentColor"
              fillOpacity="1"
              d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,133.3C672,139,768,181,864,197.3C960,213,1056,203,1152,176C1248,149,1344,107,1392,85.3L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            ></path>
          </svg>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center bg-background h-full max-w-3xl w-full p-4 sm:p-8 relative overflow-hidden">
        <div className="absolute top-8 left-8 md:hidden">
          <Image
            src={logo}
            alt="Centrix Logo"
            className="h-12 w-auto"
            width={90}
            height={48}
          />
        </div>

        <Card className="w-full max-w-md shadow-elevation border-0 animate-fade-in overflow-auto">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">
              Redefinir Senha
            </CardTitle>
            <CardDescription className="text-base">
              {validToken === false
                ? 'O link de redefinição é inválido ou expirou'
                : 'Defina uma nova senha para sua conta'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {validToken === false ? (
              <div className="text-center py-4">
                <div className="bg-destructive/10 p-6 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                  <ShieldAlert className="h-10 w-10 text-destructive" />
                </div>
                <h3 className="text-xl font-medium mb-2">Link Inválido</h3>
                <p className="text-muted-foreground mb-6">
                  O link de redefinição de senha é inválido ou expirou. Por
                  favor, solicite um novo link de redefinição.
                </p>
                <Button
                  variant="default"
                  className="mt-2"
                  onClick={() => router.push('/login')}
                >
                  Voltar para Login
                </Button>
              </div>
            ) : validToken === true ? (
              <>
                <ResetPasswordForm token={token || ''} />
                <Separator className="my-6" />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/login')}
                >
                  Voltar para Login
                </Button>
              </>
            ) : (
              <div className="flex justify-center py-8">
                <div className="animate-pulse flex flex-col items-center">
                  <Shield className="h-12 w-12 text-muted mb-4" />
                  <p>Verificando token de redefinição...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default ResetPasswordPage;
