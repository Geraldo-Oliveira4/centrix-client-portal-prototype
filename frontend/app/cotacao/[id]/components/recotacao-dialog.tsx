'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '@/components/ui';
import { recotacao } from '@/hooks/use-quotations';
import type { Quotation } from '@/types/quotation';

interface RecotacaoDialogProps {
  quotationId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (clone: Quotation) => void;
}

export function RecotacaoDialog({ quotationId, open, onOpenChange, onCreated }: RecotacaoDialogProps) {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    const clone = await recotacao(quotationId, motivo || undefined);
    setSaving(false);
    if (clone) onCreated(clone);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-content-sm">
        <DialogHeader>
          <DialogTitle>Re-cotar</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Cria uma nova cotacao em TRIAGEM_IA com os mesmos dados desta. Informe o motivo (opcional).
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recotacao-motivo">Motivo</Label>
            <Input
              id="recotacao-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: cliente voltou após proposta concorrente"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Criando...</>
            ) : (
              'Criar Re-cotacao'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
