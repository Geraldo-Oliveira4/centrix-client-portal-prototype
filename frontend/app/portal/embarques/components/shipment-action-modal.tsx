'use client';

import { useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';

/**
 * Fecho dos gatilhos de ação do embarque (enviar documento, aprovar booking).
 *
 * O portal não escreve nada no embarque: o módulo GE é do analista e nenhum
 * handler de escrita foi copiado para cá. Então o botão de confirmação NÃO
 * confirma — ele encerra dizendo exatamente isso, mesmo contrato do
 * `request-agent-modal.tsx` (Meus Agentes) e do `dispute-draft-modal.tsx`
 * (Auditoria). Uma confirmação que sugerisse envio seria a única mentira da
 * tela: todo o resto aqui é ilustração de dado, não de efeito.
 */

export interface ShipmentActionPrompt {
  title: string;
  description: string;
  ctaLabel: string;
  /** O que dizer depois do clique — por que nada saiu daqui. */
  closing: string;
}

export function ShipmentActionModal({
  prompt,
  onOpenChange,
}: {
  /** Null fecha o modal. */
  prompt: ShipmentActionPrompt | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [submitted, setSubmitted] = useState(false);

  const close = () => {
    onOpenChange(false);
    // Reseta depois do fecho para o conteúdo não piscar durante a animação.
    setTimeout(() => setSubmitted(false), 200);
  };

  return (
    <Dialog
      open={prompt != null}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{prompt?.title ?? ''}</DialogTitle>
          <DialogDescription>{prompt?.description ?? ''}</DialogDescription>
        </DialogHeader>

        {submitted && (
          <div className="space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
            <p className="portal-body font-medium text-foreground">
              Nada foi enviado.
            </p>
            <p className="portal-body text-portal-neutral">{prompt?.closing}</p>
          </div>
        )}

        <DialogFooter>
          {submitted ? (
            <Button onClick={close}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button onClick={() => setSubmitted(true)}>
                {prompt?.ctaLabel ?? 'Confirmar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
