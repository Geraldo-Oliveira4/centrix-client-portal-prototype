'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { portalSession } from '@/lib/portal-session';
import { PortalHeader } from './components/portal-header';
import { PortalSidebar } from './components/portal-sidebar';
import { SidebarProvider } from './components/sidebar-context';

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
        router.replace('/portal/cotacoes');
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
  if (isPublic) return <>{children}</>;

  return (
    <SidebarProvider>
      {/* Canvas #F5F5F7 behind white cards: with a white page background the
          cards had nothing to sit on, which is half of why every block read as
          the same weight. Page margin is the 32px step (p-8) on desktop. */}
      <div className="flex min-h-screen w-full bg-portal-canvas">
        <PortalSidebar />
        <main className="flex-1 min-w-0 overflow-auto">
          <PortalHeader />
          <div className="p-6 md:p-8">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
