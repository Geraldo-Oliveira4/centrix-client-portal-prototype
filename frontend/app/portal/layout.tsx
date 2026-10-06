'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { portalSession } from '@/lib/portal-session';
import { PortalHeader } from './components/portal-header';
import { PortalSidebar } from './components/portal-sidebar';
import { SidebarProvider } from './components/sidebar-context';
import { DemoPanel } from './_shared/demo/demo-panel';
import { SupportLauncher } from './_shared/support-launcher';
import { OnboardingFlow } from './_shared/onboarding-flow';
import { ModuleNotReleased } from './_shared/demo/module-not-released';
import { isRouteReleased } from './_shared/demo/feature-flags';
import { usePortalModuleFlags } from './_shared/demo/use-feature-flags';
import { PortalV2AutoAdvance } from './_shared/demo/portal-v2-auto-advance';
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

  // As flags moram no navegador e defaultam para tudo ligado, entao um portal
  // sem nenhuma escolha gravada se comporta exatamente como antes desta camada
  // existir. Ver `_shared/demo/feature-flags.ts`.
  const flags = usePortalModuleFlags();

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
          {/* O guard troca so o MIOLO. Sidebar e header continuam: modulo
              fechado e uma porta fechada dentro do portal, nao uma sessao
              perdida, e o cliente precisa continuar enxergando por onde sair. */}
          {/* portal-content-pad: no minimo 6rem (o botao "Ajuda", 44px + 16px
              da borda, nunca cobre o ultimo bloco), e mais quando ha barra de
              acao presa ao rodape (--floating-content-pad, globals.css). */}
          <div className="portal-content-pad mx-auto w-full max-w-[1540px] px-4 pt-6 md:px-8 md:pt-9">
            {isRouteReleased(pathname, flags) ? children : <ModuleNotReleased />}
          </div>
        </main>
        {/* A autorresposta da Freitas simulada mora AQUI, e nao dentro do
            painel: o avanco automatico tem de continuar acontecendo com o
            painel fechado, que e como uma demonstracao de verdade acontece. */}
        <PortalV2AutoAdvance />
        <SupportLauncher />
        <OnboardingFlow />
        <DemoPanel />
      </div>
    </SidebarProvider>
  );
}
