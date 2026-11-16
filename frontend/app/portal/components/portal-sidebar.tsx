'use client';

import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  FileText,
  Gauge,
  LayoutDashboard,
  PanelLeft,
  PanelLeftClose,
  Radar,
  Scale,
  Settings,
  Ship,
  Sparkles,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { BrandMark } from '@/components/brand-mark';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { PortalModule } from '../_shared/demo/feature-flags';
import { usePortalModuleFlags } from '../_shared/demo/use-feature-flags';
import {
  INTEL_BASE_PATH,
  INTEL_HASH_EVENT,
  INTEL_SUBMODULES,
  activeIntelSubmodule,
  intelSubmoduleHash,
  isIntelPath,
  type IntelSubmodule,
  type IntelSubmoduleId,
} from '../inteligencia/lib/intel-submodules';

import { useSidebar } from './sidebar-context';

// `module` liga o item a uma chave de modulo (`_shared/demo/feature-flags.ts`).
// SEM `module` = sempre no menu: Inicio, Central de trabalho e Configuracoes
// nao entram nas ondas de liberacao — a Home e para onde o `ModuleNotReleased`
// devolve o cliente, e as outras duas sao como ele encontra o proprio dia e as
// proprias preferencias. Uma onda capaz de escondê-las produziria um portal sem
// saida.
interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  module?: PortalModule;
  beta?: boolean;
  // Submodulos (v4, 13/11/2026): as abas da Inteligencia viraram itens do menu.
  // O destino de cada um e um HASH da mesma rota (`inteligencia/lib/intel-submodules.ts`).
  submodules?: IntelSubmodule[];
}

// DOIS GRUPOS POR FREQUENCIA DE USO (30/09/2026, feedback de marketing: "todos
// os modulos parecem iguais"). OPERACAO e o dia a dia — onde o cliente age;
// PERFORMANCE e leitura semanal ou sob demanda, e por isso tem peso visual
// menor (tinta neutra em vez de foreground). Configuracoes nao e nenhum dos
// dois: fica fixa no rodape.
const NAV_GROUPS: { id: string; label: string; quiet: boolean; items: NavItem[] }[] = [
  {
    id: 'operacao',
    label: 'Operação',
    quiet: false,
    items: [
      // A Home abre o menu porque e a landing do portal. Segmento proprio
      // (`/portal/home`) porque a regra de item ativo e `startsWith(href+'/')`.
      { href: '/portal/home', label: 'Início', icon: LayoutDashboard },
      // A Central e a tela de TRABALHO: o que precisa de mim agora, cruzando
      // Cotacao e Embarque em itens acionaveis.
      { href: '/portal/visao-geral', label: 'Central de trabalho', icon: Gauge },
      { href: '/portal/cotacoes', label: 'Minhas Cotações', icon: FileText, module: 'cotacao' },
      { href: '/portal/embarques', label: 'Meus Embarques', icon: Ship, module: 'embarques' },
    ],
  },
  {
    id: 'performance',
    label: 'Performance',
    quiet: true,
    items: [
      {
        href: INTEL_BASE_PATH,
        label: 'Inteligência',
        icon: Sparkles,
        module: 'inteligencia',
        submodules: INTEL_SUBMODULES,
      },
      { href: '/portal/radar', label: 'Radar', icon: Radar, module: 'radar', beta: true },
      { href: '/portal/auditoria', label: 'Auditoria', icon: Scale, module: 'auditoria' },
    ],
  },
];

// Meus Exportadores e Meus Agentes sao abas de Configuracoes desde 26/08/2026;
// o `startsWith` da regra de item ativo cobre as tres rotas.
const SETTINGS_ITEM: NavItem = {
  href: '/portal/preferencias',
  label: 'Configurações',
  icon: Settings,
};

function SidebarContent({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const { collapsed, toggle, toggleMobile } = useSidebar();
  const slim = collapsed && !mobile;
  // A gaveta do mobile renderiza ESTE mesmo componente (ver `PortalSidebar`
  // abaixo), entao o filtro vale nas duas sem nenhuma segunda lista.
  const flags = usePortalModuleFlags();
  // Grupo sem nenhum modulo liberado some inteiro, rotulo incluido: um rotulo
  // "Performance" sem nada embaixo leria como menu quebrado.
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => item.module == null || flags[item.module],
    ),
  })).filter((group) => group.items.length > 0);

  // O SUBMODULO ATIVO VEM DA URL. As cinco telas da Inteligencia dividem a
  // mesma rota e se distinguem pelo hash, que o `usePathname` nao enxerga: o
  // menu le `window.location.hash` e reage ao `hashchange` (clique aqui no
  // menu, voltar/avancar) e ao aviso do host quando a navegacao acontece DENTRO
  // do iframe (`IntelligencePreview` espelha o hash com `replaceState`, que nao
  // dispara evento nenhum sozinho).
  const [hash, setHash] = useState('');
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener('hashchange', read);
    window.addEventListener(INTEL_HASH_EVENT, read);
    return () => {
      window.removeEventListener('hashchange', read);
      window.removeEventListener(INTEL_HASH_EVENT, read);
    };
  }, [pathname]);
  const activeSubmodule = activeIntelSubmodule(pathname, hash);
  // `null` = segue a rota (aberto dentro da Inteligencia, fechado fora). O
  // clique na seta fixa a escolha ate a proxima troca de rota.
  const [submenuOpen, setSubmenuOpen] = useState<boolean | null>(null);
  useEffect(() => setSubmenuOpen(null), [pathname]);

  const goToSubmodule = (event: MouseEvent, id: IntelSubmoduleId) => {
    if (mobile) toggleMobile();
    // Ja dentro da Inteligencia a troca e so de hash: o host repassa ao iframe
    // e periodo e filtros sao preservados, como as abas faziam. De fora, o
    // Link navega para a rota com o hash de destino.
    if (!isIntelPath(pathname)) return;
    event.preventDefault();
    const next = intelSubmoduleHash(id, window.location.hash);
    if (window.location.hash !== next) window.location.hash = next;
  };

  const renderSubmodules = (item: NavItem, active: boolean) => {
    const open = submenuOpen ?? active;
    const listId = 'menu-sub-inteligencia';
    return (
      <li key={item.href}>
        <div
          className={cn(
            'flex min-h-11 items-center rounded-lg text-sm transition-colors',
            active
              ? 'bg-brand-indigo text-white dark:bg-brand-indigo-700'
              : 'text-portal-neutral hover:bg-muted hover:text-foreground',
          )}
        >
          <Link
            href={item.href + intelSubmoduleHash('geral')}
            onClick={(event) => goToSubmodule(event, 'geral')}
            aria-current={active && !activeSubmodule ? 'page' : undefined}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className={cn(active && 'font-semibold')}>{item.label}</span>
          </Link>
          {/* Fora do Link: <button> dentro de <a> e HTML invalido. */}
          <button
            type="button"
            onClick={() => setSubmenuOpen(!open)}
            aria-expanded={open}
            aria-controls={listId}
            aria-label={open ? 'Recolher submódulos de Inteligência' : 'Expandir submódulos de Inteligência'}
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
        {open && (
          <ul id={listId} aria-label="Submódulos de Inteligência" className="mt-1 space-y-1">
            {item.submodules!.map((sub) => {
              const current = activeSubmodule === sub.id;
              return (
                <li key={sub.id}>
                  <Link
                    href={item.href + intelSubmoduleHash(sub.id)}
                    onClick={(event) => goToSubmodule(event, sub.id)}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'flex min-h-11 items-center gap-2 rounded-lg py-2 pl-10 pr-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      current
                        ? 'bg-brand-indigo-100 font-semibold text-brand-indigo'
                        : 'text-portal-neutral hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span>{sub.label}</span>
                    {sub.preview && (
                      <span className="portal-small ml-auto rounded-full border border-brand-indigo-800/20 bg-brand-indigo-100 px-1.5 font-normal text-brand-indigo">
                        Prévia
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  const renderItem = (item: NavItem, quiet: boolean) => {
    const Icon = item.icon;
    const active =
      pathname === item.href || pathname.startsWith(item.href + '/');
    // Recolhida, a Inteligencia e so o icone (sem submodulos), como os outros.
    if (item.submodules && !slim) return renderSubmodules(item, active);
    const link = (
      <Link
        href={item.href}
        onClick={mobile ? toggleMobile : undefined}
        aria-current={active ? 'page' : undefined}
        className={cn(
          // 44px de alvo (py-3 + linha de 20px), nos dois grupos: peso menor e
          // TINTA, nunca alvo menor.
          'flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          slim && 'justify-center px-0',
          active
            // `brand-indigo` e theme-aware (e a TINTA do portal), entao no
            // escuro ele sobe para indigo-300 — certo para texto, errado aqui,
            // onde e SUPERFICIE com branco em cima (1.70:1). No escuro a
            // superficie selecionada e indigo-700 (branco em cima 8.36:1).
            ? 'bg-brand-indigo text-white dark:bg-brand-indigo-700'
            : quiet
              ? 'text-portal-neutral hover:bg-muted hover:text-foreground'
              : 'font-medium text-foreground hover:bg-muted',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!slim && <span>{item.label}</span>}
        {!slim && item.beta && (
          <span className="ml-auto rounded border border-current/20 px-1.5 py-0.5 text-[10px]">
            Beta
          </span>
        )}
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
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-background border-r transition-[width] duration-200 shrink-0 overflow-hidden',
        slim ? 'w-14' : 'w-60',
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'flex items-center gap-2 border-b shrink-0 px-5 py-6',
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
                  Profundo no escuro, e a tinta da palavra acompanha o FUNDO. A
                  marca e "Centrix" (nunca "Freitas Centrix"); embaixo fica so o
                  nome do PRODUTO, que o logotipo nao carrega. */}
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

      {/* Nav: grupos por frequencia de uso + Configuracoes no rodape. */}
      <TooltipProvider delayDuration={0}>
        <nav
          aria-label="Menu principal"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-5"
        >
          <div className="space-y-5" data-tour="menu">
            {groups.map((group, index) => (
              <div key={group.id}>
                {slim ? (
                  // Recolhida nao cabe rotulo: um fio separa os grupos.
                  index > 0 && <div aria-hidden="true" className="mx-2 mb-3 border-t" />
                ) : (
                  <p
                    id={`menu-grupo-${group.id}`}
                    className="portal-small mb-1 px-3 font-semibold uppercase tracking-[0.08em] text-portal-neutral"
                  >
                    {group.label}
                  </p>
                )}
                <ul
                  className="space-y-1"
                  aria-labelledby={slim ? undefined : `menu-grupo-${group.id}`}
                  aria-label={slim ? group.label : undefined}
                >
                  {group.items.map((item) => renderItem(item, group.quiet))}
                </ul>
              </div>
            ))}
          </div>
          <ul className="mt-auto border-t pt-3">{renderItem(SETTINGS_ITEM, false)}</ul>
        </nav>
      </TooltipProvider>

    </aside>
  );
}

export function PortalSidebar() {
  const { mobileOpen, toggleMobile, collapsed } = useSidebar();

  return (
    <>
      {/* Desktop sidebar — FIXA na janela (100dvh), com rolagem interna no
          miolo. Era `sticky`, e o `overflow-auto` do wrapper do layout raiz
          (app/layout.tsx, que também serve o analista) quebrava o sticky: o
          menu rolava junto com a página e deixava um vão cinza embaixo. O
          espaçador ocupa a largura do menu no fluxo, aberto ou recolhido. */}
      <div
        aria-hidden="true"
        className={cn(
          'hidden shrink-0 transition-[width] duration-200 md:block',
          collapsed ? 'w-14' : 'w-60',
        )}
      />
      <div className="fixed inset-y-0 left-0 z-30 hidden h-[100dvh] md:block">
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
