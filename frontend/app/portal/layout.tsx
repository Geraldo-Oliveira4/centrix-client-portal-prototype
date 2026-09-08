'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { portalSession } from '@/lib/portal-session';
import { PortalHeader } from './components/portal-header';
import { PortalSidebar } from './components/portal-sidebar';
import { SidebarProvider } from './components/sidebar-context';
import { portalFont } from './portal-font';

const PUBLIC_PATHS = [
  '/portal/login',
  '/portal/cadastro',
  '/portal/esqueci-senha',
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (isPublic) {
      if (portalSession.isAuthenticated()) {
        // Landing do portal: a Home. Era `/portal/cotacoes` até a Home existir.
        router.replace('/portal/home');
        return;
      }
      setAuthChecked(true);
      return;
    }
    if (!portalSession.isAuthenticated()) {
      router.replace('/portal/login');
      return;
    }
    setAuthChecked(true);
  }, [isPublic, pathname, router]);

  if (!authChecked) return null;
  if (isPublic) {
    return (
      <div className={`fc-brand-scope ${portalFont.variable} font-[family-name:var(--font-source-sans)]`}>
        {children}
      </div>
    );
  }

  return (
    <SidebarProvider>
      {/* Canvas atras dos cards: com fundo branco os cards nao tinham sobre o
          que sentar, que e metade do motivo de todo bloco ter o mesmo peso.
          Margem da pagina no passo de 32px (p-8) no desktop.

          Continua `bg-portal-canvas`, mas o TOKEN passou a virar com o tema
          (globals.css, `--portal-canvas`): Cinza Nevoa #F4F5FA na luz, Navy
          Profundo no escuro. Trocar a classe por `bg-background` teria
          apagado o canvas na LUZ — `--background` e branco puro ali, e e a
          diferenca entre canvas e card que da profundidade a tela. */}
      <div
        className={`fc-brand-scope flex min-h-screen w-full bg-portal-canvas ${portalFont.variable} font-[family-name:var(--font-source-sans)]`}
      >
        <PortalSidebar />
        <main className="flex-1 min-w-0 overflow-auto">
          <PortalHeader />
          <div className="p-6 md:p-8">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
