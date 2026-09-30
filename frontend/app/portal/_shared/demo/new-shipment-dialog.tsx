'use client';

// Tela 2 — "Novo embarque: como você quer começar?"
//
// O modal é o ponto de entrada da jornada (RQ-1) e existe porque as duas portas
// respondem a momentos diferentes do processo do cliente: quem ainda não fechou
// o frete abre uma cotação; quem já tem o PO com o exportador abre o embarque
// direto. Nenhuma das duas é "a certa", então o modal não tem opção pré-marcada
// até o cliente escolher.
//
// Cancelar e o X fecham sem criar nada — o modal é uma bifurcação, não um
// primeiro passo que já reserva alguma coisa.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, FileText, Package } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { usePortalModuleReleased } from './use-feature-flags';
import { useShipmentPoStore } from './use-shipment-po-review';
import { isPoDraft } from './shipment-po-review';

type Choice = 'cotacao' | 'po';

export function NewShipmentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const quotationReleased = usePortalModuleReleased('cotacao');
  const store = useShipmentPoStore();
  const [choice, setChoice] = useState<Choice | null>(null);

  // "Retomar rascunho" só aparece quando há um: um rascunho de PO não entra na
  // carteira (a Freitas nunca o viu), então este modal é o ÚNICO caminho de
  // volta para ele.
  const draftId = Object.entries(store).find(([, entry]) =>
    isPoDraft(entry),
  )?.[0];

  const go = (href: string) => {
    onOpenChange(false);
    setChoice(null);
    router.push(href);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setChoice(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo embarque</DialogTitle>
          <DialogDescription>Como você quer começar?</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {quotationReleased && (
            <ChoiceCard
              icon={FileText}
              title="Abrir uma cotação"
              body="Ainda não tem o frete fechado. A Freitas cota com os agentes e você escolhe a proposta."
              selected={choice === 'cotacao'}
              onSelect={() => setChoice('cotacao')}
            />
          )}
          <ChoiceCard
            icon={Package}
            title="Abrir uma PO"
            body="Você já tem o PO com o exportador. Anexe o PO e acompanhe o embarque sem passar por cotação."
            badge="Novo"
            selected={choice === 'po'}
            onSelect={() => setChoice('po')}
          />
        </div>

        {draftId && (
          <p className="portal-small text-portal-neutral">
            Você tem um rascunho de PO salvo.{' '}
            <button
              type="button"
              className="font-medium text-brand-indigo underline underline-offset-2"
              onClick={() => go(`/portal/embarques/novo?rascunho=${draftId}`)}
            >
              Retomar rascunho
            </button>
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!choice}
            onClick={() =>
              go(
                choice === 'cotacao'
                  ? '/portal/nova-cotacao'
                  : '/portal/embarques/novo',
              )
            }
          >
            Continuar
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceCard({
  icon: Icon,
  title,
  body,
  badge,
  selected,
  onSelect,
}: {
  icon: typeof FileText;
  title: string;
  body: string;
  badge?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors',
        selected
          ? 'border-brand-orange bg-brand-orange/10'
          : 'border-border hover:border-brand-indigo-800/40 hover:bg-muted/40',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            selected
              ? 'bg-brand-orange/20 text-brand-orange-800'
              : 'bg-brand-indigo-100 text-brand-indigo',
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        {badge && (
          <span className="portal-small rounded bg-muted px-1.5 py-0.5 font-medium text-portal-neutral">
            {badge}
          </span>
        )}
      </span>
      <span className="portal-body font-medium text-foreground">{title}</span>
      <span className="portal-small text-portal-neutral">{body}</span>
    </button>
  );
}
