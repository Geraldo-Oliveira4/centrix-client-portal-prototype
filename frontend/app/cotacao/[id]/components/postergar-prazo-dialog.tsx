'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '@/components/ui';
import { toDatetimeLocal } from '@/utils/quotation-fields';

interface PostergarPrazoDialogProps {
  currentDeadline: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (deadline: string) => Promise<void>;
}

export function PostergarPrazoDialog({
  currentDeadline,
  open,
  onOpenChange,
  onSave,
}: PostergarPrazoDialogProps) {
  const [deadline, setDeadline] = useState(toDatetimeLocal(currentDeadline));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!deadline) return;
    setSaving(true);
    await onSave(new Date(deadline).toISOString());
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-content-sm">
        <DialogHeader>
          <DialogTitle>Postergar Prazo de Envio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label htmlFor="new-deadline">Novo prazo (deadline envio cotacao)</Label>
          <Input
            id="new-deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!deadline || saving}>
            {saving ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Salvando...</>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
