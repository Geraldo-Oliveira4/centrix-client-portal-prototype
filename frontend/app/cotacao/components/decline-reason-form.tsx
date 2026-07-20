'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DECLINE_REASON_OPTIONS } from '@/types/portal';

interface DeclineReasonFormProps {
  reason: string;
  note: string;
  onReasonChange: (reason: string) => void;
  onNoteChange: (note: string) => void;
}

export function DeclineReasonForm({ reason, note, onReasonChange, onNoteChange }: DeclineReasonFormProps) {
  const isOutros = reason === 'OUTROS';

  return (
    <div className="space-y-2">
      <Label>Motivo da Recusa</Label>
      <Select
        value={reason}
        onValueChange={(v) => { onReasonChange(v); onNoteChange(''); }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {DECLINE_REASON_OPTIONS.map((r) => (
            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isOutros && (
        <div className="space-y-1">
          <Textarea
            placeholder="Descreva o motivo (mínimo 10 caracteres)"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={3}
            className="resize-none text-sm"
          />
          {note.trim().length > 0 && note.trim().length < 10 && (
            <p className="text-xs text-destructive">Mínimo 10 caracteres</p>
          )}
        </div>
      )}
    </div>
  );
}
