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
              <div className="w-16 h-1 bg-gradient-to-r from-[#E91E8C] to-[#F7941D] rounded mx-auto" />
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
