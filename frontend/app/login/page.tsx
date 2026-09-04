'use client';

import React, { useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import LoginForm from './components/login-form';
import ForgotPasswordForm from './components/forgot-password-form';
import { MailCheck } from 'lucide-react';
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

const LoginPage = () => {
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [email, setEmail] = useState('');
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
              <div className="w-16 h-1 bg-brand-orange-500 rounded mx-auto" />
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
            {!isForgotPassword && (
              <span className="inline-flex items-center self-start rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Sistema interno
              </span>
            )}
            <CardTitle className="text-2xl font-bold tracking-tight">
              {isForgotPassword ? 'Esqueci minha senha' : 'Login'}
            </CardTitle>
            <CardDescription className="text-base">
              {isForgotPassword
                ? 'Digite seu email para redefinir sua senha'
                : 'Acesso restrito a colaboradores Freitas'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailSent ? (
              <div className="text-center py-4">
                <div className="bg-secondary/50 p-6 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                  <MailCheck className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-medium mb-2">
                  Verifique seu e-mail
                </h3>
                <p className="text-muted-foreground mb-4">
                  Um link de redefinição de senha foi enviado para{' '}
                  <span className="font-medium">{email}</span>.
                </p>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setEmailSent(false);
                  }}
                >
                  Voltar ao login
                </Button>
              </div>
            ) : isForgotPassword ? (
              <ForgotPasswordForm
                setEmailSent={setEmailSent}
                setEmail={setEmail}
              />
            ) : (
              <LoginForm />
            )}
            {!emailSent && (
              <>
                <Separator className="my-6" />
                <div className="space-y-3">
                  {!isForgotPassword && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => router.push('/register')}
                    >
                      Criar nova conta
                    </Button>
                  )}
                  <Button
                    variant="link"
                    className="w-full"
                    onClick={() => setIsForgotPassword(!isForgotPassword)}
                  >
                    {isForgotPassword
                      ? 'Voltar ao login'
                      : 'Esqueci minha senha'}
                  </Button>
                </div>
                {!isForgotPassword && (
                  <p className="mt-6 text-center text-sm text-muted-foreground">
                    É cliente Freitas?{' '}
                    <button
                      type="button"
                      onClick={() => router.push('/portal/login')}
                      className="font-medium text-primary hover:underline"
                    >
                      Acesse o portal do cliente
                    </button>
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default LoginPage;
