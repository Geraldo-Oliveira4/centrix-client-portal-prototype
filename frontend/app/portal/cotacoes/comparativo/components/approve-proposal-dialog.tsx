'use client';

// Confirmação de aprovação, com um passo OPCIONAL depois dela.
//
// A aprovação acontece no primeiro passo ("Confirmar aprovação"); o segundo só
// pergunta o motivo e pode ser pulado ou fechado sem perder nada. É simulado:
// nada é gravado nem enviado.
//
// IDEIA DE PRODUTO, PENDENTE DE VALIDAÇÃO DO ORSI: "Por que você escolheu esta
// proposta?" existe para alimentar, no futuro, o relatório de propostas ganhas
// e perdidas por agente (won/lost). Hoje a resposta morre no componente — não
// persistir até a ideia ser validada, e não transformar em campo obrigatório.

import { useState } from 'react';
import { Check } from 'lucide-react';

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

export const CHOICE_REASONS = [
  'Preço',
  'Prazo',
  'Já trabalho com este agente',
  'Rota/porto',
  'Outro',
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalLabel: string;
  totalBrl: string;
  transit: string;
  validity: string;
  onConfirm: () => void;
}

export function ApproveProposalDialog({
  open,
  onOpenChange,
  proposalLabel,
  totalBrl,
  transit,
  validity,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<'confirm' | 'reason'>('confirm');
  const [reasons, setReasons] = useState<string[]>([]);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setStep('confirm');
      setReasons([]);
    }
  };

  const toggle = (r: string) =>
    setReasons((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="md">
        {step === 'confirm' ? (
          <>
            <DialogHeader>
              <DialogTitle className="portal-h2">Aprovar esta proposta?</DialogTitle>
              <DialogDescription className="portal-body">
                Você está aprovando a proposta de <strong className="font-medium text-foreground">{proposalLabel}</strong>.
                Nossa equipe recebe a aprovação e segue com o agente.
              </DialogDescription>
            </DialogHeader>
            <dl className="portal-body grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-border p-4">
              <dt className="text-portal-neutral">Total em BRL</dt>
              <dd className="font-medium">{totalBrl}</dd>
              <dt className="text-portal-neutral">Transit time</dt>
              <dd>{transit}</dd>
              <dt className="text-portal-neutral">Validade</dt>
              <dd>{validity}</dd>
            </dl>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onConfirm();
                  setStep('reason');
                }}
              >
                Confirmar aprovação
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="portal-h2 flex items-center gap-2">
                <Check className="h-5 w-5 text-portal-success-ink" aria-hidden />
                Proposta aprovada
              </DialogTitle>
              <DialogDescription className="portal-body">
                Por que você escolheu esta proposta? Opcional: ajuda a Freitas a entender o que pesa na sua decisão.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Motivos da escolha">
              {CHOICE_REASONS.map((r) => {
                const on = reasons.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(r)}
                    className={cn(
                      'portal-body inline-flex items-center gap-1 rounded-full border px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      on
                        ? 'border-brand-indigo-800/40 bg-brand-indigo-100 font-medium text-brand-indigo'
                        : 'border-border text-foreground hover:bg-accent',
                    )}
                  >
                    {on ? <Check className="h-4 w-4" aria-hidden /> : null}
                    {r}
                  </button>
                );
              })}
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Pular
              </Button>
              <Button type="button" disabled={!reasons.length} onClick={() => close(false)}>
                Enviar resposta
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
