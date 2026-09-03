'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { useMyClient } from '@/hooks/use-portal-quotations';
import type { SemaforoCounts } from '@/types/portal-shipment';

import { SemaforoChips } from '../_shared/semaforo-chips';

/**
 * Cabecalho navy da HOME. Desenho validado com o Victor Orsi no Claude Design.
 *
 * ESCOPO: so a Home. Nesta tela o bloco navy SUBSTITUI a sidebar (ver
 * `portal/layout.tsx`), e por isso as abas daqui sao a unica navegacao
 * disponivel — em qualquer outra tela a sidebar volta e este bloco nao aparece.
 * A Visao Geral NAO usa este componente: la o cabecalho e branco, sem card
 * escuro em volta.
 *
 * TRES REGRAS DE COR, e as tres vem do guia de marca (ver "Client Portal design
 * system" no CLAUDE.md do frontend):
 *
 *   1. Navy #2C2D65 (`brand-navy`) e IDENTIDADE. Ele emoldura, nunca convida a
 *      clicar: nenhum botao, nenhum link de acao usa essa cor.
 *   2. Rosa #CE0F69 (`primary`) continua sendo a UNICA cor de acao da tela. Aqui
 *      ela aparece so no filete da aba ativa, que e o mesmo papel de "nav ativa"
 *      que a sidebar da nas outras telas.
 *   3. As bolinhas do farol continuam no semaforo, que e ESTADO. Sobre o navy
 *      elas seguem legiveis sem retoque — os tres hexes sao saturados o
 *      bastante — e por isso nao ha uma segunda paleta aqui.
 *
 * O BLOCO NAO CONTA NADA. `counts` chega pronto, do `countBySemaforo` de sempre.
 *
 * As abas sao NAVEGACAO, no estilo de abas de browser: a ativa e pintada com a
 * cor do canvas da pagina (`portal-canvas`) e encosta na borda de baixo do
 * bloco, entao ela literalmente continua no fundo da tela abaixo. Por isso o
 * bloco e full-bleed (as margens negativas cancelam o padding de
 * `portal/layout.tsx`) — com o bloco recuado, a aba ativa terminaria no ar.
 */

/**
 * As abas. Toda uma tem destino REAL — nenhuma aba decorativa, mesma disciplina
 * dos CTAs da Home. "Documentos" aparecia no desenho e ficou de fora porque nao
 * existe tela de documentos no portal: eles vivem dentro do detalhe do embarque.
 * Auditoria e Minhas Preferencias nao entram porque sao telas de configuracao —
 * a sidebar, que volta assim que o cliente sai da Home, e quem as serve.
 */
const TABS: { href: string; label: string }[] = [
  { href: '/portal/home', label: 'Início' },
  { href: '/portal/visao-geral', label: 'Visão Geral' },
  { href: '/portal/cotacoes', label: 'Cotação' },
  { href: '/portal/embarques', label: 'Embarques' },
  { href: '/portal/inteligencia', label: 'Inteligência' },
];

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function PortalTabHeader({
  headline,
  counts,
  now,
}: {
  /** A frase dominante da tela, em branco sobre o navy. */
  headline: ReactNode;
  counts: SemaforoCounts;
  /** O mesmo `now` do resto da tela — uma leitura de relogio por render. */
  now: Date;
}) {
  const pathname = usePathname();
  const { client } = useMyClient();

  return (
    <div className="-mx-6 -mt-6 bg-brand-navy md:-mx-8 md:-mt-8">
      <div className="flex flex-col gap-8 px-6 pt-6 md:px-8 md:pt-8">
        {/* Boas-vindas a esquerda, farol no canto superior direito. */}
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="space-y-1">
            <p className="portal-small font-medium uppercase tracking-wide text-white/60">
              {greetingFor(now)}
              {client?.name ? `, ${client.name}` : ''}
            </p>
            <div className="portal-h1 text-white">{headline}</div>
          </div>
          <SemaforoChips counts={counts} variant="navy" className="shrink-0" />
        </div>

        {/* Abas. Sem `gap` no `<nav>`: as abas se tocam, como num browser. */}
        <nav className="flex overflow-x-auto" aria-label="Navegação do portal">
          {TABS.map((tab) => {
            const active =
              pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'portal-body relative shrink-0 whitespace-nowrap rounded-t-lg px-4 py-2.5 font-medium transition-colors',
                  active
                    ? 'bg-portal-canvas text-brand-navy'
                    : 'text-white/70 hover:bg-white/10 hover:text-white',
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-0.5 rounded-t-lg bg-primary"
                  />
                ) : null}
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
