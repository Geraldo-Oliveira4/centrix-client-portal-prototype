'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Menu, PackageSearch } from 'lucide-react';
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
    // Brand accent: a hairline gradient on the top edge plus a tinted plate
    // around the logged-in company. Enough to read as a product surface rather
    // than an internal tool, using the existing Freitas pink (--primary) as an
    // accent — no new brand, no colour substitution. The client company's own
    // identity is deliberately absent: whose logo goes here is a product
    // decision, not a prototype one.
    <header className="relative flex items-center justify-between border-b bg-background px-4 py-3 md:px-6">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-primary/40 to-transparent"
      />
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
        <div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-primary/8 to-transparent py-1.5 pl-3 pr-6">
          <span className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />
          <div>
            <p className="portal-small font-medium uppercase tracking-wide text-primary">
              Portal do Cliente
            </p>
            <p className="portal-body font-medium text-foreground">
              {isLoading ? 'Carregando...' : client?.name ?? '—'}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* Global shortcut to the shipment lookup. Points at the Lista tab with
            the search field expanded (?busca=1) — the old `#verificar` anchor
            was left dangling when Meus Embarques was rebuilt as three tabs, so
            this button navigated and then did nothing. */}
        <Button variant="ghost" size="sm" asChild>
          <Link href="/portal/embarques?tab=lista&busca=1">
            <PackageSearch className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Verificar embarque</span>
          </Link>
        </Button>
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
