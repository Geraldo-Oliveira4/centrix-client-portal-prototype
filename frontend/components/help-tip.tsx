'use client';

// "?" de ajuda contextual ao lado de um rótulo de campo (30/09/2026).
//
// POPOVER, e não tooltip: tooltip de hover não abre no toque do celular, e a
// ajuda de um campo de formulário é mais usada justamente por quem está em
// dúvida no meio do preenchimento. Abre por clique, toque, Enter e Espaço;
// fecha com Esc e devolve o foco ao "?". A área de toque tem 44px, mesmo com o
// ícone de 16px (margem negativa compensa no layout do rótulo).
//
// Domain-agnostic: o texto vem de quem usa.

import { HelpCircle } from 'lucide-react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function HelpTip({ label, text }: { label: string; text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Ajuda: ${label}`}
          className="-my-3 inline-grid h-11 w-11 shrink-0 place-items-center rounded-full text-portal-neutral transition-colors hover:text-brand-indigo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HelpCircle aria-hidden="true" className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="portal-small w-72 leading-relaxed"
      >
        <p className="mb-1 font-medium text-foreground">{label}</p>
        <p className="text-portal-neutral">{text}</p>
      </PopoverContent>
    </Popover>
  );
}
