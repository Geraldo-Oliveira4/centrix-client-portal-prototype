'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LoaderComponent } from '@arboria-tech/arboria-ui';
import { cn } from '@/lib/utils';
import {
  createFollowup,
  deleteFollowup,
  useShipmentFollowups,
} from '@/hooks/use-shipments';
import type { Followup } from '@/types/shipment';

interface FollowupSectionProps {
  processId: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function FollowupItem({
  followup,
  onDelete,
}: {
  followup: Followup;
  onDelete: (id: string) => void;
}) {
  const isAuto = followup.origem === 'AUTOMATICO';
  return (
    <div className={cn('flex gap-3 p-3 rounded-md border', isAuto && 'bg-muted/40')}>
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
        {isAuto ? 'A' : 'M'}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{followup.tipo_ocorrencia}</span>
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              isAuto
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-green-50 text-green-700 border-green-200',
            )}
          >
            {isAuto ? 'Automático' : 'Manual'}
          </Badge>
          {followup.grupo && (
            <Badge variant="secondary" className="text-xs">
              {followup.grupo}
            </Badge>
          )}
        </div>
        {followup.nota && (
          <p className="text-sm text-muted-foreground">{followup.nota}</p>
        )}
        <p className="text-xs text-muted-foreground">{formatDate(followup.created_at)}</p>
      </div>
      {!isAuto && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => onDelete(followup.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function FollowupSection({ processId }: FollowupSectionProps) {
  const { followups, isLoading } = useShipmentFollowups(processId);
  const [tipo, setTipo] = useState('');
  const [nota, setNota] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo.trim()) return;
    setSubmitting(true);
    const result = await createFollowup(processId, {
      tipo_ocorrencia: tipo.trim(),
      nota: nota.trim() || null,
    });
    if (result) {
      setTipo('');
      setNota('');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await deleteFollowup(processId, id);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-md border bg-muted/20">
        <p className="text-sm font-medium">Registrar ocorrência</p>
        <Input
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          placeholder="Tipo (ex: AGUARDANDO_NCM, BOOKING_POSTERGADO...)"
          required
        />
        <Textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota adicional (opcional)"
          rows={2}
        />
        <Button type="submit" size="sm" disabled={submitting || !tipo.trim()}>
          {submitting ? 'Registrando...' : 'Registrar'}
        </Button>
      </form>

      {isLoading ? (
        <LoaderComponent />
      ) : followups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhuma ocorrência registrada.
        </p>
      ) : (
        <div className="space-y-2">
          {followups.map((f) => (
            <FollowupItem key={f.id} followup={f} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
