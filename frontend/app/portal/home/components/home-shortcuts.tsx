'use client';

import Link from 'next/link';
import { FileCheck2, FilePlus2, Ship } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * "Atalhos" — a fileira de pills do rodapé da Home.
 *
 * São NAVEGAÇÃO, não ação: por isso pill neutra com ícone, e não botão rosa. O
 * único CTA rosa da tela é o do card "Sua ação mais urgente", e um segundo rosa
 * aqui disputaria com ele exatamente o clique que a tela existe para provocar.
 *
 * SÃO TRÊS. Havia um quarto pill, "Documentos", renderizado inerte porque não
 * existe tela de documentos no portal — eles vivem dentro do detalhe de cada
 * embarque (`embarques/lib/shipment-documents.ts`), sem rota própria e sem
 * endpoint que os liste de forma agregada. Ele saiu em 03/09/2026: uma afordância
 * desabilitada ainda é uma promessa, e o portal não expõe caminho para tela que
 * não existe. Quando a rota existir, o pill volta — com `href`.
 */

const SHORTCUTS: { label: string; icon: LucideIcon; href: string }[] = [
  { label: 'Nova cotação', icon: FilePlus2, href: '/portal/nova-cotacao' },
  { label: 'Meus embarques', icon: Ship, href: '/portal/embarques' },
  // O slug continua `fechadas` (deep link estável); o RÓTULO é "Aprovadas"
  // desde 26/08/2026 — ver o vocabulário da Camada 3 no CLAUDE.md do frontend.
  {
    label: 'Cotações aprovadas',
    icon: FileCheck2,
    href: '/portal/cotacoes?tab=fechadas',
  },
];

export function HomeShortcuts() {
  return (
    <ul className="flex flex-wrap gap-2">
      {SHORTCUTS.map(({ label, icon: Icon, href }) => (
        <li key={label}>
          <Link
            href={href}
            className="portal-body inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
