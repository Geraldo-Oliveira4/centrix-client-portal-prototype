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
      <div className="flex min-h-screen w-full bg-muted/30">
        <PortalSidebar />
        <main className="flex-1 min-w-0 overflow-auto">
          <PortalHeader />
          <div className="p-6 md:p-8">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
