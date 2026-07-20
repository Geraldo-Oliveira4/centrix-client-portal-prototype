'use client';

import { useState } from 'react';
import { Check, Copy, Loader2, Send } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@/components/ui';
import { generateClientLink, sendClientLink, useClientLinks } from '@/hooks/use-client-links';
import type { GenerateClientLinkResponse } from '@/types/quotation';

interface ClientLinkDialogProps {
  quotationId: string;
  clientEmail: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'configure' | 'generated';

export function ClientLinkDialog({
  quotationId,
  clientEmail,
  open,
  onOpenChange,
}: ClientLinkDialogProps) {
  const [step, setStep] = useState<Step>('configure');
  const [observations, setObservations] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [link, setLink] = useState<GenerateClientLinkResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const { mutate } = useClientLinks(quotationId);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStep('configure');
      setObservations('');
      setLink(null);
      setCopied(false);
    }
    onOpenChange(next);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    const result = await generateClientLink(quotationId, {
      observations: observations.trim() || undefined,
    });
    setIsGenerating(false);
    if (result) {
      setLink(result);
      setStep('generated');
      mutate();
    }
  };

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSend = async () => {
    if (!link) return;
    setIsSending(true);
    await sendClientLink(quotationId, { token: link.token });
    setIsSending(false);
    mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="dialog-content-md">
        <DialogHeader>
          <DialogTitle>Enviar Proposta ao Cliente</DialogTitle>
        </DialogHeader>

        {step === 'configure' && (
          <div className="flex flex-col gap-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Gere um link seguro com o comparativo de propostas para enviar ao cliente. O link
              e valido por 30 dias.
            </p>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="observations">Mensagem para o cliente (opcional)</Label>
              <Textarea
                id="observations"
                placeholder="Ex: Segue abaixo o comparativo das propostas recebidas. Recomendamos a opcao X pelo melhor custo-beneficio."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
                {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                Gerar Link
              </Button>
            </div>
          </div>
        )}

        {step === 'generated' && link && (
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label>Link gerado</Label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={link.url}
                  className="flex-1 h-9 rounded-md border border-input bg-muted px-3 text-sm font-mono select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Valido ate{' '}
                {new Date(link.expires_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </p>
            </div>

            {clientEmail && (
              <div className="rounded-md border bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Enviar por e-mail</p>
                  <p className="text-xs text-muted-foreground">{clientEmail}</p>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 shrink-0"
                  disabled={isSending}
                  onClick={handleSend}
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {isSending ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            )}

            {!clientEmail && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Nenhum e-mail de cliente cadastrado. Copie o link e envie manualmente.
              </p>
            )}

            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
