'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  FileText,
  PanelLeft,
  PanelLeftClose,
  Scale,
  Ship,
  Sparkles,
  Warehouse,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useSidebar } from './sidebar-context';

const NAV_ITEMS = [
  {
    href: '/portal/cotacoes',
    label: 'Minhas Cotações',
    icon: FileText,
  },
  {
    href: '/portal/embarques',
    label: 'Meus Embarques',
    icon: Ship,
  },
  {
    href: '/portal/inteligencia',
    label: 'Inteligência',
    icon: Sparkles,
  },
  {
    href: '/portal/auditoria',
    label: 'Auditoria',
    icon: Scale,
  },
  {
    href: '/portal/exportadores',
    label: 'Meus Exportadores',
    icon: Warehouse,
  },
];

function SidebarContent({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const { collapsed, toggle, toggleMobile } = useSidebar();
  const slim = collapsed && !mobile;

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-background border-r transition-[width] duration-200 shrink-0 overflow-hidden',
        slim ? 'w-14' : 'w-64',
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'flex items-center gap-2 border-b shrink-0 px-3 py-4',
          slim && 'justify-center',
        )}
      >
        {slim ? (
          /* Collapsed: toggle icon fills the header */
          <button
            type="button"
            onClick={toggle}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
            aria-label="Expandir menu"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
        ) : (
          <>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight truncate">Portal do Cliente</p>
              <p className="text-xs text-muted-foreground truncate">Freitas Comex</p>
            </div>
            {/* Toggle collapse (desktop) or close (mobile) */}
            {mobile ? (
              <button
                type="button"
                onClick={toggleMobile}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0 transition-colors"
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={toggle}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0 transition-colors"
                aria-label="Recolher menu"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2">
        <TooltipProvider delayDuration={0}>
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(item.href + '/');

              const link = (
                <Link
                  href={item.href}
                  onClick={mobile ? toggleMobile : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    slim && 'justify-center px-0 py-2',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!slim && <span>{item.label}</span>}
                </Link>
              );

              if (slim) {
                return (
                  <li key={item.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  </li>
                );
              }

              return <li key={item.href}>{link}</li>;
            })}
          </ul>
        </TooltipProvider>
      </nav>

    </aside>
  );
}

export function PortalSidebar() {
  const { mobileOpen, toggleMobile } = useSidebar();

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={toggleMobile}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden h-full">
            <SidebarContent mobile />
          </div>
        </>
      )}
    </>
  );
}
