'use client';
import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, Roles } from '@arboria-tech/arboria-ui';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  LogOut,
  Menu,
  Building,
  Mail,
  Inbox,
  LayoutGrid,
  LayoutDashboard,
  DollarSign,
  Activity,
  Users,
  BarChart2,
  TrendingUp,
  Ship,
  Clock,
  Scale,
  ShieldAlert,
  FileCheck,
  GitBranch,
  PieChart,
  Search,
  FileText,
  ClipboardList,
  ClipboardCheck,
  Settings,
  GanttChart,
  Truck,
  Globe,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from './ui/button';
import React from 'react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/brand-mark';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from './ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { ThemeToggle } from './theme-toggle';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTrigger,
} from '@/components/ui';
type NavItem = {
  title: string;
  href: string;
  icon: React.ElementType;
  requiredRoles?: string[];
};
type NavGroup = {
  title: string;
  icon: React.ElementType;
  items: NavItem[];
  requiredRoles?: string[];
};
const ALL_GROUPS: NavGroup[] = [
  {
    title: 'Cotação de Frete',
    icon: FileText,
    items: [
      { title: 'Inbox', href: '/inbox', icon: Inbox },
      { title: 'Kanban', href: '/cotacao/kanban', icon: LayoutGrid },
      { title: 'Dashboard', href: '/cotacao/dashboard', icon: LayoutDashboard },
      { title: 'Pricing', href: '/cotacao/pricing', icon: DollarSign },
      { title: 'Performance', href: '/cotacao/performance', icon: Activity },
      { title: 'Clientes', href: '/cotacao/clientes', icon: Users },
      { title: 'Agentes de Carga', href: '/cotacao/agentes', icon: Truck },
      { title: 'Empresas Exterior', href: '/cotacao/empresas-exterior', icon: Globe },
      { title: 'Win-Loss', href: '/cotacao/win-loss', icon: BarChart2 },
      {
        title: 'Rentabilidade',
        href: '/cotacao/rentabilidade',
        icon: TrendingUp,
      },
    ],
  },
  {
    title: 'Embarques',
    icon: Ship,
    items: [
      { title: 'Kanban', href: '/embarques/kanban', icon: LayoutGrid },
      {
        title: 'Dashboard',
        href: '/embarques/dashboard',
        icon: LayoutDashboard,
      },
      { title: 'Custos', href: '/embarques/custos', icon: DollarSign },
      { title: 'Tempo', href: '/embarques/tempo', icon: Clock },
      { title: 'Trade-off', href: '/embarques/trade-off', icon: Scale },
      { title: 'Riscos', href: '/embarques/riscos', icon: ShieldAlert },
    ],
  },
  {
    title: 'Aprovação Documental',
    icon: FileCheck,
    items: [
      { title: 'Processos', href: '/aprovacao/processos', icon: GitBranch },
      { title: 'Analytics', href: '/aprovacao/analytics', icon: PieChart },
    ],
  },
  {
    title: 'Auditoria de Frete',
    icon: ClipboardCheck,
    items: [
      { title: 'Auditoria', href: '/auditoria', icon: Search },
      { title: 'Savings', href: '/auditoria/savings', icon: TrendingUp },
    ],
  },
  {
    title: 'Administração',
    icon: Settings,
    requiredRoles: [Roles.Admin, Roles.Manager],
    items: [
      {
        title: 'Usuários',
        href: '/users',
        icon: Users,
        requiredRoles: [Roles.Admin, Roles.Manager],
      },
      {
        title: 'Logs',
        href: '/logs',
        icon: ClipboardList,
        requiredRoles: [Roles.Admin],
      },
    ],
  },
];
function GroupedNav({
  groups,
  openGroups,
  onToggle,
  pathname,
}: {
  groups: NavGroup[];
  openGroups: Record<number, boolean>;
  onToggle: (i: number) => void;
  pathname: string;
}) {
  const isItemActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');
  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => isItemActive(item.href));
  return (
    <div className="space-y-0.5">
      {groups.map((group, groupIdx) => {
        const isOpen = openGroups[groupIdx] ?? false;
        const active = isGroupActive(group);
        return (
          <div key={groupIdx}>
            <button
              onClick={() => onToggle(groupIdx)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors group',
                'hover:bg-muted/60',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <group.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{group.title}</span>
              </div>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 shrink-0 transition-transform duration-200 opacity-60',
                  isOpen && 'rotate-180',
                )}
              />
            </button>
            {isOpen && (
              <div className="ml-4 pl-3 border-l border-border/50 mt-0.5 mb-1 space-y-0.5">
                {group.items.map((item, itemIdx) => {
                  const itemActive = isItemActive(item.href);
                  return (
                    <Link
                      key={itemIdx}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
                        itemActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
function CollapsedGroupItem({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isItemActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');
  const active = group.items.some((item) => isItemActive(item.href));
  const enter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const leave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 80);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          onMouseEnter={enter}
          onMouseLeave={leave}
          className={cn(
            'h-9 w-9 flex items-center justify-center rounded-md transition-colors cursor-pointer',
            active
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          )}
        >
          <group.icon className="h-4 w-4" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="p-2 w-48"
        onMouseEnter={enter}
        onMouseLeave={leave}
      >
        <p className="font-semibold text-xs text-foreground mb-1.5 px-1">
          {group.title}
        </p>
        <div className="space-y-0.5">
          {group.items.map((item, i) => (
            <Link
              key={i}
              href={item.href}
              className={cn(
                'flex items-center gap-2 text-xs py-1.5 px-2 rounded transition-colors',
                isItemActive(item.href)
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
              )}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              {item.title}
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
function BrandLogo({ showText = true, small = false }: { showText?: boolean, small?: boolean }) {
  return (
    <div className={cn("flex items-center", showText ? "gap-2" : "")}>
      {/* Sidebar de fundo claro -> lockup principal. Substitui o
          freitascomex-logo.jpeg, que era um raster recortado em circulo. A
          marca ja diz "freitas centrix", entao a palavra "Centrix" ao lado
          saiu junto: mostrar as duas era escrever o nome do produto duas
          vezes, uma delas fora da tipografia da marca. */}
      {showText ? (
        <BrandMark variant="principal" width={small ? 96 : 120} />
      ) : (
        /* Sidebar recolhida: o lockup a 28px seria uma palavra ilegivel; o
           simbolo e a marca desenhada para esta caixa. */
        <BrandMark variant="simbolo" width={small ? 24 : 30} />
      )}
    </div>
  );
}
function UserFooter({ compact = false, userInitials, userName, userEmail, userDivision, onLogout }: any) {
  return (
    <div className="border-t pt-4 mt-2">
      {!compact ? (
        <>
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-10 w-10 border shadow-sm" glow status="online">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="font-medium text-sm truncate">{userName}</p>
              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                <Mail className="h-3 w-3" />
                <span className="truncate">{userEmail}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                <Building className="h-3 w-3" />
                <span>{userDivision}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onLogout} variant="gradient" className="flex items-center gap-2 flex-1">
              Sair
              <LogOut className="w-4 h-4" />
            </Button>
            <ThemeToggle />
          </div>
        </>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-2">
                <Avatar className="h-9 w-9 border shadow-sm" glow status="online">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <ThemeToggle />
                <Button variant="gradient" onClick={onLogout} size="icon" className="h-9 w-9">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="flex flex-col gap-1">
              <div className="font-medium">{userName}</div>
              <div className="text-xs text-muted-foreground">{userEmail}</div>
              <div className="text-xs text-muted-foreground">{userDivision}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
export default function SideNavbar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileWidth, setMobileWidth] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({
    0: true,
  });
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const isPasswordResetPage = pathname === '/reset-password';
  const isRegisterPage = pathname === '/register';
  const isPropostaPage = pathname.startsWith('/proposta');
  const isPortalPage = pathname.startsWith('/portal');
  const { session, logout } = useAuth();
  const router = useRouter();
  useEffect(() => {
    const handleResize = () => {
      setMobileWidth(window.innerWidth < 768);
      setIsCollapsed(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  async function handleLogout() {
    await logout();
    router.replace('/');
  }
  if (isLoginPage || isPasswordResetPage || isRegisterPage || isPropostaPage || isPortalPage) return null;
  const userRoles = session?.user?.roles || [];
  const userInitials = session?.user?.name
    ? session.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';
  const userDivision = userRoles.includes(Roles.Admin)
    ? 'Administrador'
    : userRoles.includes(Roles.Manager)
      ? 'Gerente'
      : 'Usuário';
  const visibleGroups = ALL_GROUPS.filter(
    (group) =>
      !group.requiredRoles ||
      group.requiredRoles.some((r) => userRoles.includes(r)),
  )
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.requiredRoles ||
          item.requiredRoles.some((r) => userRoles.includes(r)),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const toggleGroup = (index: number) => {
    setOpenGroups((prev) => ({ ...prev, [index]: !prev[index] }));
  };
  return (
    <>
      {/* Desktop sidebar */}
      {!mobileWidth && (
        <div
          className={cn(
            'sticky top-0 h-screen border-r flex flex-col bg-background transition-all duration-300 ease-in-out glass',
            isCollapsed ? 'min-w-[60px] w-[60px]' : 'w-64',
          )}
        >
          {/* Collapse toggle */}
          <div className="absolute right-[-12px] top-7 z-10">
            <Button
              onClick={() => setIsCollapsed(!isCollapsed)}
              variant="secondary"
              size="icon"
              className="rounded-full shadow-md h-6 w-6"
              aria-label={isCollapsed ? 'Expandir navegação' : 'Colapsar navegação'}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronLeft className="h-3 w-3" />
              )}
            </Button>
          </div>
          {/* Logo */}
          <div className="flex flex-col items-center pt-8 px-3">
            {!isCollapsed ? (
<BrandLogo showText={true} />
            ) : (
<BrandLogo showText={false} />
            )}
          </div>
          {/* Nav */}
          <div
            className={cn(
              'flex-1 mt-4 overflow-y-auto',
              isCollapsed ? 'px-1.5' : 'px-3',
            )}
          >
            {isCollapsed ? (
              <TooltipProvider>
                <div className="flex flex-col items-center gap-1">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link
                        href="/home"
                        className={cn(
                          'h-9 w-9 flex items-center justify-center rounded-md transition-colors',
                          pathname === '/home'
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                        )}
                      >
                        <GanttChart className="h-4 w-4" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">Home</TooltipContent>
                  </Tooltip>
                  <div className="w-full h-px bg-border/50 my-1" />
                  {visibleGroups.map((group, groupIdx) => (
                    <CollapsedGroupItem
                      key={groupIdx}
                      group={group}
                      pathname={pathname}
                    />
                  ))}
                </div>
              </TooltipProvider>
            ) : (
              <>
                <Link
                  href="/home"
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-2',
                    pathname === '/home'
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                >
                  <GanttChart className="h-4 w-4 shrink-0" />
                  Home
                </Link>
                <GroupedNav
                  groups={visibleGroups}
                  openGroups={openGroups}
                  onToggle={toggleGroup}
                  pathname={pathname}
                />
              </>
            )}
          </div>
          {/* User footer */}
          <div
            className={cn(
              'pb-5 mt-auto transition-all duration-300 ease-in-out',
              isCollapsed ? 'px-2' : 'px-4',
            )}
          >
            <TooltipProvider><UserFooter compact={isCollapsed} userInitials={userInitials} userName={session?.user?.name} userEmail={session?.user?.email} userDivision={userDivision} onLogout={handleLogout} /></TooltipProvider>
          </div>
        </div>
      )}
      {/* Mobile top bar + drawer */}
      {mobileWidth && (
        <div className="fixed w-full flex items-center justify-between px-4 py-2 bg-background border-b top-0 z-50 glass shadow-sm">
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Abrir menu de navegação">
                <Menu className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="fixed inset-y-0 left-0 w-72 rounded-r-lg glass">
              <DrawerHeader className="pb-2 pt-6 flex flex-col items-center">
<BrandLogo showText={true} />
              </DrawerHeader>
              <div className="flex-1 px-3 py-2 overflow-y-auto">
                <Link
                  href="/home"
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-2',
                    pathname === '/home'
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                >
                  <GanttChart className="h-4 w-4 shrink-0" />
                  Home
                </Link>
                <GroupedNav
                  groups={visibleGroups}
                  openGroups={openGroups}
                  onToggle={toggleGroup}
                  pathname={pathname}
                />
              </div>
              <DrawerFooter className="pt-0 px-4">
                <UserFooter compact={false} userInitials={userInitials} userName={session?.user?.name} userEmail={session?.user?.email} userDivision={userDivision} onLogout={handleLogout} />
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
<BrandLogo showText={true} small={true} />
        </div>
      )}
    </>
  );
}
