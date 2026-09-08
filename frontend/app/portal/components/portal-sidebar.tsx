'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  Gauge,
  LayoutDashboard,
  PanelLeft,
  PanelLeftClose,
  Scale,
  Settings,
  Ship,
  Sparkles,
  X,
} from 'lucide-react';

import { BrandMark } from '@/components/brand-mark';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useSidebar } from './sidebar-context';

const NAV_ITEMS = [
  // A Home abre o menu porque e a landing do portal: `/portal` redireciona para
  // ca e o login cai aqui. Ela tem segmento proprio (`/portal/home`) em vez de
  // morar na raiz porque a regra de item ativo e `startsWith(href + '/')` — com
  // href `/portal`, TODA tela do portal deixaria a Home acesa.
  {
    href: '/portal/home',
    label: 'Início',
    icon: LayoutDashboard,
  },
  // Visao Geral (Torre de Controle) fica AO LADO da Home, nao no lugar dela: a
  // Home responde "como minha operacao esta indo"; esta responde "o que precisa
  // de mim agora", cruzando Cotacao e Embarque numa lista de itens acionaveis.
  {
    href: '/portal/visao-geral',
    label: 'Visão Geral',
    icon: Gauge,
  },
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
  // Meus Exportadores e Meus Agentes NAO sao itens deste menu desde 26/08/2026:
  // sao telas de cadastro/configuracao e viraram abas de Minhas Preferencias
  // (`preferencias/layout.tsx`), enquanto este nivel fica so com as telas
  // operacionais do dia a dia. As rotas antigas continuam como redirect. O item
  // abaixo cobre as tres pelo `startsWith` da regra de item ativo.
  {
    href: '/portal/preferencias',
    label: 'Minhas Preferências',
    icon: Settings,
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
            {/* A marca leva para a Home, que e a landing do portal. O botao de
                recolher/fechar fica FORA do Link de proposito: um <button>
                dentro de um <a> e HTML invalido, e o clique de recolher seria
                engolido pela navegacao. No mobile o link tambem fecha a gaveta,
                como os itens de menu abaixo. */}
            <Link
              href="/portal/home"
              onClick={mobile ? toggleMobile : undefined}
              className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-md transition-opacity hover:opacity-80"
            >
              {/* `auto`, nao `principal`: a sidebar e branca na luz e Navy
                  Profundo no escuro, e a escolha do lockup e pelo FUNDO. Com o
                  principal fixo, a palavra "freitas" (navy) ficava navy sobre
                  navy no tema escuro. A marca ja diz "freitas centrix", entao a
                  segunda linha de texto que dizia "Freitas Comex" saiu: sobrou
                  so o nome do PRODUTO, que o logotipo nao carrega. */}
              <BrandMark variant="auto" width={104} />
              <p className="truncate text-xs text-muted-foreground">Portal do Cliente</p>
            </Link>
            {/* Toggle collapse (desktop) or close (mobile) */}
            {mobile ? (
              <button
                type="button"
                onClick={toggleMobile}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0 transition-colors"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={toggle}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0 transition-colors"
                aria-label="Recolher menu"
              >
                <PanelLeftClose className="h-5 w-5" />
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
                      // `brand-indigo` e theme-aware (e a TINTA do portal), entao
                      // no escuro ele sobe para indigo-300 — certo para texto,
                      // errado aqui, onde e SUPERFICIE com branco em cima: a
                      // pilula ficava lavanda clara com texto branco, 1.70:1. No
                      // escuro a superficie selecionada e indigo-700, um degrau
                      // fixo da rampa (branco em cima 8.36:1, e 2.00:1 contra a
                      // sidebar navy, entao a selecao continua se destacando).
                      ? 'bg-brand-indigo text-white dark:bg-brand-indigo-700'
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
