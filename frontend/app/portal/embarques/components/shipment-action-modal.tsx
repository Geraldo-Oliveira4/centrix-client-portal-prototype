'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';

import { ProvenanceBadge } from '../../_shared/provenance-badge';

/**
 * Fecho dos gatilhos de ação do embarque (enviar documento, aprovar booking).
 *
 * O que mudou em 17/08/2026, e por quê
 * -------------------------------------
 * Até aqui o botão de confirmação encerrava com "Nada foi enviado" e a
 * explicação de que não há rota de escrita — tecnicamente exato e, numa
 * demonstração ao vivo, um beco: o fluxo que a tela inteira monta (faixa de
 * ação -> modal -> documento muda de status) parava no passo em que ele
 * deveria fechar. Agora o modal confirma, e o efeito aparece na tela que gerou
 * o gatilho.
 *
 * O que NÃO mudou: nada é escrito em lugar nenhum. O portal não replica as
 * rotas de escrita do GE, e o "sucesso" aqui é estado de componente que morre
 * no refresh — quem projeta o efeito na tela é `applyLocalDocumentActions`
 * (documentos) e o flag `bookingApproved` de `buildStepInsights`. Por isso o
 * selo `preview` fica no rodapé do estado de sucesso: é a mesma marcação de
 * todo o resto ilustrativo do portal, e é a única linha que impede a tela de
 * afirmar um efeito que o backend não teve.
 *
 * `request-agent-modal.tsx` (Meus Agentes) e `dispute-draft-modal.tsx`
 * (Auditoria) seguem no contrato antigo, de propósito: lá o clique pediria algo
 * a um destinatário que não existe (fila de avaliação, serviço de contestação),
 * enquanto aqui ele responde a uma pergunta que a própria tela fez.
 */

export interface ShipmentActionPrompt {
  title: string;
  description: string;
  ctaLabel: string;
  /** Título do estado de sucesso — o que acabou de acontecer, no passado. */
  successTitle: string;
  /** O que a tela vai mostrar por causa disso, em uma frase. */
  successDescription: string;
  /**
   * Aplica o efeito na tela. Chamado UMA vez, no clique de confirmação — o
   * fecho do modal não repete nem desfaz.
   */
  onConfirm?: () => void;
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

  const confirm = () => {
    setSubmitted(true);
    prompt?.onConfirm?.();
  };

  return (
    <Dialog
      open={prompt != null}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent size="md">
        {/* O cabeçalho não muda no sucesso: ele nomeia a AÇÃO, e trocá-lo pelo
            resultado faria o modal parecer outro modal no meio do clique. Quem
            anuncia o desfecho é o bloco abaixo. */}
        <DialogHeader>
          <DialogTitle>{prompt?.title ?? ''}</DialogTitle>
          <DialogDescription>{prompt?.description ?? ''}</DialogDescription>
        </DialogHeader>

        {submitted && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-portal-success/25 bg-portal-success/[0.07] p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-portal-success" />
              <div className="space-y-1">
                <p className="portal-body font-medium text-foreground">
                  {prompt?.successTitle}
                </p>
                <p className="portal-body text-portal-neutral">
                  {prompt?.successDescription}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ProvenanceBadge provenance="preview" />
              <span className="portal-small text-portal-neutral">
                Confirmação simulada nesta demonstração.
              </span>
            </div>
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
              <Button onClick={confirm}>{prompt?.ctaLabel ?? 'Confirmar'}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
