'use client';

import React from 'react';
import { BrandLogo } from '@/components/brand-logo';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';

interface PortalAuthShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function PortalAuthShell({
  title,
  description,
  children,
  footer,
}: PortalAuthShellProps) {
  /*
   * TEMA ESCURO: a tela vira navy inteira, de proposito.
   *
   * O painel esquerdo (`.bg-brand-gradient`) JA e escuro nos dois temas — dois
   * halos laranja sobre a placa Navy Profundo, o unico gradiente que o guia
   * permite sobre navy. O direito e `bg-background`, que no escuro tambem vira
   * navy. A divisao entre os dois nao some por isso: quem a faz continua sendo o
   * halo laranja da esquerda, que e o elemento de marca da tela, e nao o degrau
   * claro/escuro que existia so por acidente do tema unico.
   *
   * O que precisava de retoque era o CARTAO, nao o painel: com `border-0` e
   * `--card` #23253F sobre o navy #1A1C31 ele fica a 1.12:1 e some. No escuro a
   * borda volta. `dark:border-border` junto e obrigatorio: o projeto nao aplica
   * a regra `* { border-color: hsl(var(--border)) }` do shadcn, entao `border`
   * sozinho herda o cinza #E5E7EB do preflight do Tailwind — um fio claro
   * demais sobre o navy. Com o token, o fio e o #3D3F56 que o guia descreve
   * como "borda branca a 12%".
   */
  return (
    <main className="h-screen flex w-full overflow-hidden">
      <div className="bg-brand-gradient w-full h-full hidden md:flex items-center justify-center relative">
        <div className="flex flex-col items-center justify-center text-center max-w-lg p-8">
          <div className="mb-8">
            <BrandLogo variant="light" size="lg" />
          </div>
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-4">Portal do Cliente</h1>
            <p className="text-base/relaxed text-white/80">
              Acompanhe suas cotações e propostas Freitas Comex em um só lugar.
            </p>
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

        <Card className="w-full max-w-md shadow-elevation border-0 dark:border dark:border-border animate-fade-in overflow-auto">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">
              {title}
            </CardTitle>
            <CardDescription className="text-base">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {children}
            {footer}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
