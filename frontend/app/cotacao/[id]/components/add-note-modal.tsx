'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@/components/ui';
import { addQuotationNote } from '@/hooks/use-quotations';

interface AddNoteModalProps {
  quotationId: string;
  proposalId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddNoteModal({
  quotationId,
  proposalId,
  open,
  onOpenChange,
}: AddNoteModalProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    const ok = await addQuotationNote(quotationId, {
      content: content.trim(),
      proposal_id: proposalId,
    });
    setSubmitting(false);
    if (ok) {
      setContent('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Adicionar Nota</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label className="text-sm">Nota *</Label>
          <Textarea
            placeholder="Escreva sua nota ou observacao..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!content.trim() || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
