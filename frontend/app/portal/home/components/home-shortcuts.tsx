'use client';

import Link from 'next/link';
import { FileCheck2, FilePlus2, FolderClosed, Ship } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * "Atalhos" — a fileira de pills do rodapé da Home.
 *
 * São NAVEGAÇÃO, não ação: por isso pill neutra com ícone, e não botão rosa. O
 * único CTA rosa da tela é o do card "Sua ação mais urgente", e um segundo rosa
 * aqui disputaria com ele exatamente o clique que a tela existe para provocar.
 *
 * "Documentos" NÃO TEM DESTINO e por isso não é clicável: não existe tela de
 * documentos no portal — eles vivem dentro do detalhe de cada embarque
 * (`embarques/lib/shipment-documents.ts`), sem rota própria e sem endpoint que
 * os liste de forma agregada. O pill aparece porque está no mockup validado, e
 * fica inerte porque a alternativa era mandar o cliente para uma tela que não
 * responde o que o rótulo promete. Quando a rota existir, é só preencher `href`.
 */

interface Shortcut {
  label: string;
  icon: LucideIcon;
  /** Ausente = o destino ainda não existe; o pill renderiza inerte. */
  href?: string;
}

const SHORTCUTS: Shortcut[] = [
  { label: 'Nova cotação', icon: FilePlus2, href: '/portal/nova-cotacao' },
  { label: 'Meus embarques', icon: Ship, href: '/portal/embarques' },
  { label: 'Documentos', icon: FolderClosed },
  // O slug continua `fechadas` (deep link estável); o RÓTULO é "Aprovadas"
  // desde 26/08/2026 — ver o vocabulário da Camada 3 no CLAUDE.md do frontend.
  {
    label: 'Cotações aprovadas',
    icon: FileCheck2,
    href: '/portal/cotacoes?tab=fechadas',
  },
];

const PILL_BASE =
  'portal-body inline-flex items-center gap-2 rounded-full border px-4 py-2 font-medium transition-colors';

export function HomeShortcuts() {
  return (
    <ul className="flex flex-wrap gap-2">
      {SHORTCUTS.map(({ label, icon: Icon, href }) => (
        <li key={label}>
          {href ? (
            <Link
              href={href}
              className={cn(
                PILL_BASE,
                'bg-background text-foreground hover:border-primary/40 hover:text-primary',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ) : (
            <span
              aria-disabled="true"
              title="Os documentos ficam dentro de cada embarque — ainda não há uma tela que reúna todos."
              className={cn(
                PILL_BASE,
                'cursor-not-allowed border-dashed bg-transparent text-portal-neutral',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
