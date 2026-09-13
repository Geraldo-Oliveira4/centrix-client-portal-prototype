'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

// The approved settings preview owns its tabs at the root. Existing connected
// preferences, exporters and agent blocks retain their routes and behavior.
const TABS = [
  { href: '/portal/preferencias', label: 'Configurações' },
  { href: '/portal/preferencias/conectadas', label: 'Perfil e notificações conectados' },
  { href: '/portal/preferencias/exportadores', label: 'Meus Exportadores' },
  { href: '/portal/preferencias/agentes', label: 'Meus Agentes' },
];

export default function PreferenciasLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/portal/preferencias') return <>{children}</>;

  return (
    <div className="space-y-6">
      <nav className="-mb-px flex gap-1 overflow-x-auto border-b">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 py-2 portal-body font-medium transition-colors',
                active
                  ? 'border-brand-indigo-800 text-foreground'
                  : 'border-transparent text-portal-neutral hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
