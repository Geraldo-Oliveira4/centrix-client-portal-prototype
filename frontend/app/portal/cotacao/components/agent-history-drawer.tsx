'use client';

// Gaveta "Ver histórico" do detalhe da cotação (07/10/2026): o que o antigo
// bloco "Raio X do agente de cargas" mostrava, aberto a partir da linha de
// histórico de cada oferta. Sheet do Radix: foco preso, Esc fecha. À direita
// no desktop, folha de baixo no celular.
//
// Fatos, sem nota. As evidências entram por `children` porque cada tela tem a
// própria fonte (o detalhe real usa `useEvidence`; a prévia, a tabela
// demonstrativa) e esta gaveta não troca fonte nenhuma.

import { useEffect, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { portalFont } from '../../portal-font';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import {
  HISTORY_DISCLAIMER,
  agentHistoryFacts,
  type AgentRouteHistory,
} from '../lib/agent-history-line';

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile;
}

export interface AgentHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  /** "Agente da sua escolha", "Agente da proposta recomendada"... */
  context?: string;
  history: AgentRouteHistory | null;
  routeLabel: string;
  periodNote: string;
  /** "Ver histórico e evidências", já aberto dentro da gaveta. */
  children?: ReactNode;
}

export function AgentHistoryDrawer({
  open,
  onOpenChange,
  agentName,
  context,
  history,
  routeLabel,
  periodNote,
  children,
}: AgentHistoryDrawerProps) {
  const mobile = useIsMobile();
  const facts = agentHistoryFacts(history, routeLabel);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={mobile ? 'bottom' : 'right'}
        // O Sheet vai para um portal fora do layout: a fonte do portal entra aqui.
        className={cn(
          portalFont.variable,
          'font-[family-name:var(--font-source-sans)]',
          mobile
            ? 'max-h-[85dvh] overflow-y-auto rounded-t-2xl'
            : 'w-[28rem] max-w-[92vw] overflow-y-auto sm:max-w-md',
        )}
      >
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="portal-h2">{agentName}</SheetTitle>
          <SheetDescription className="portal-small text-portal-neutral">
            Histórico nesta rota{context ? ` · ${context}` : ''}. Dado, não veredito.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <dl className="space-y-4">
            {facts.map((f) => (
              <div key={f.term} className="space-y-1 border-b border-border pb-4 last:border-0">
                <dt className="portal-small text-portal-neutral">{f.term}</dt>
                <dd className="flex flex-wrap items-baseline gap-x-2">
                  <strong className="portal-h3">{f.value}</strong>
                  {f.unit ? <span className="portal-body">{f.unit}</span> : null}
                </dd>
                <p className="portal-small text-portal-neutral">{f.note}</p>
              </div>
            ))}
          </dl>

          <div className="space-y-1">
            <p className="portal-body">
              Use o histórico junto ao prazo e às condições da proposta. {HISTORY_DISCLAIMER}
            </p>
            <p className="portal-small text-portal-neutral">{periodNote}</p>
          </div>

          {children ? (
            <section className="space-y-2" aria-labelledby="agent-history-evidence">
              <h3 id="agent-history-evidence" className="portal-h3">
                Ver histórico e evidências
              </h3>
              {children}
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** A linha sob o nome do agente, com o link que abre a gaveta. */
export function AgentHistoryInline({
  text,
  muted,
  onOpen,
  agentName,
}: {
  text: string;
  muted: boolean;
  onOpen: () => void;
  agentName: string;
}) {
  return (
    // `div` e não `span`: a célula da tabela estiliza os spans (selos) como
    // inline, e a linha tem de ficar sozinha, sob o nome do agente.
    <div className="portal-small mt-1 flex flex-wrap items-baseline gap-x-2">
      <span className={cn('whitespace-nowrap', muted ? 'text-portal-neutral' : 'text-foreground')}>{text}</span>
      <button
        type="button"
        onClick={onOpen}
        className="font-medium text-brand-indigo underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Ver histórico de ${agentName}`}
      >
        Ver histórico
      </button>
    </div>
  );
}
