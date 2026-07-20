'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Menu } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { portalSession } from '@/lib/portal-session';
import { useMyClient } from '@/hooks/use-portal-quotations';

import { useSidebar } from './sidebar-context';

export function PortalHeader() {
  const { client, isLoading } = useMyClient();
  const { toggleMobile } = useSidebar();
  const router = useRouter();

  const handleLogout = () => {
    portalSession.clear();
    router.replace('/portal/login');
  };

  const initials = (client?.name ?? '??')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <header className="flex items-center justify-between border-b bg-background px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={toggleMobile}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Empresa</p>
          <p className="text-sm font-medium">
            {isLoading ? 'Carregando...' : client?.name ?? '—'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {initials || '??'}
          </AvatarFallback>
        </Avatar>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </header>
  );
}
