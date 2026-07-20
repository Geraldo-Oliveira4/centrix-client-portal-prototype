'use client';

import { useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label, Textarea } from '@/components/ui';
import { notifyRfqUpdate } from '@/hooks/use-rfq';

interface NotifyRfqUpdateDialogProps {
  quotationId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NotifyRfqUpdateDialog({ quotationId, open, onOpenChange }: NotifyRfqUpdateDialogProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    await notifyRfqUpdate(quotationId, message.trim() || undefined);
    setSending(false);
    setMessage('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-content-sm">
        <DialogHeader>
          <DialogTitle>Notificar Agentes sobre Atualização</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Envia um aviso por e-mail a todos os agentes com acesso ativo à RFQ desta cotação,
            informando que os dados foram atualizados.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notify-message">Observação para os agentes (opcional)</Label>
            <Textarea
              id="notify-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: o peso da carga foi atualizado de 500 kg para 650 kg"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Enviando...</>
            ) : (
              <><Bell className="w-3.5 h-3.5 mr-1.5" />Enviar Notificação</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
