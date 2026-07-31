'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

// Secondary navigation for the Inteligência section. The portal sidebar has no
// sub-items, so the three dashboards (Performance, Fornecedores, Executivo) are
// reached from this tab strip. The sidebar entry "Inteligência" stays active for
// all of them (it matches on startsWith).
//
// There is no "Visão geral" tab: it read only the quotation side, and the
// question it answered ("estou indo bem?") needs quotation AND shipment data in
// the same place, so it was merged into Performance. `/portal/inteligencia`
// itself redirects there.
const TABS = [
  { href: '/portal/inteligencia/performance', label: 'Performance' },
  { href: '/portal/inteligencia/fornecedores', label: 'Fornecedores' },
  { href: '/portal/inteligencia/executivo', label: 'Executivo' },
];

export default function InteligenciaLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

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
                  ? 'border-primary text-foreground'
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
