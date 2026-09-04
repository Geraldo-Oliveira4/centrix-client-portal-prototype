'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

// Navegacao secundaria de Minhas Preferencias, mesmo padrao (e mesmo desenho) do
// `inteligencia/layout.tsx` — a sidebar do portal nao tem sub-itens, entao uma
// secao com mais de uma tela e alcancada por esta faixa de abas. Nao invente um
// terceiro padrao de navegacao aqui.
//
// Meus Exportadores e Meus Agentes eram itens de primeiro nivel da sidebar ate
// 26/08/2026. Vieram para ca porque sao telas de CADASTRO/CONFIGURACAO, e no
// nivel de cima elas se misturavam com as telas operacionais do dia a dia
// (Cotacoes, Embarques, Inteligencia, Auditoria). As rotas antigas
// (`/portal/exportadores`, `/portal/agentes`) continuam existindo como redirect
// — ver os `page.tsx` daquelas pastas.
//
// A ORDEM e deliberada: "Perfil e notificacoes" primeiro porque e o indice da
// secao (a rota `/portal/preferencias` em si, para onde a sidebar aponta), e
// Exportadores antes de Agentes porque o exportador entra na cotacao pelas maos
// do cliente enquanto o agente e curadoria da Freitas — o cliente so liga e
// desliga. Exportador e agente sao papeis distintos e ficam lado a lado de
// proposito: o exportador fabrica e embarca a carga, o agente move o frete.
const TABS = [
  { href: '/portal/preferencias', label: 'Perfil e notificações' },
  { href: '/portal/preferencias/exportadores', label: 'Meus Exportadores' },
  { href: '/portal/preferencias/agentes', label: 'Meus Agentes' },
];

export default function PreferenciasLayout({ children }: { children: ReactNode }) {
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
