'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@/components/ui';

/**
 * "Solicitar novo agente" — PEDIDO, não cadastro.
 *
 * A regra que este modal existe para não quebrar: o cliente NÃO cadastra agente
 * de frete. A lista de agentes é curadoria da Freitas (marketplace aberto foi
 * descartado), e um agente novo só entra depois de avaliação — habilitação,
 * seguro, histórico. Um formulário que gravasse direto na lista contornaria
 * exatamente isso.
 *
 * Por isso o botão de envio NÃO envia: não existe fila de avaliação, model de
 * solicitação nem destinatário neste repositório. É o mesmo contrato do
 * `dispute-draft-modal.tsx` da Auditoria — o encerramento diz textualmente o que
 * aconteceu, em vez de uma confirmação que sugira que alguém recebeu o pedido.
 */
export function RequestAgentModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const close = () => {
    onOpenChange(false);
    // Reseta depois do fecho para o conteúdo não piscar durante a animação.
    setTimeout(() => {
      setSubmitted(false);
      setName('');
      setReason('');
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Solicitar novo agente</DialogTitle>
          <DialogDescription>
            O pedido vai para a fila de avaliação da Freitas. Agente novo passa
            por habilitação, seguro e histórico antes de entrar na sua lista —
            não é cadastro imediato.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="space-y-3 rounded-lg border border-dashed border-brand-indigo-800/40 bg-brand-indigo-100 p-4">
            <p className="portal-body font-medium text-foreground">
              Nada foi enviado.
            </p>
            <p className="portal-body text-portal-neutral">
              A fila de avaliação de agentes ainda não existe neste protótipo:
              não há para onde despachar o pedido. A tela mostra como o fluxo se
              encaixa; quando a fila existir, é só este botão que passa a ter
              destino. Enquanto isso, fale com seu contato na Freitas.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agente sugerido</Label>
              <Input
                id="agent-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do agente de frete"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-reason">Por que este agente</Label>
              <Textarea
                id="agent-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Rota que ele atende, histórico com sua empresa, condição comercial..."
                rows={4}
              />
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
              <Button
                className="gap-1.5"
                disabled={!name.trim()}
                onClick={() => setSubmitted(true)}
              >
                <Send className="h-4 w-4" />
                Enviar pedido
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
