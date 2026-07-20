'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ShipmentDetail } from '@/types/shipment';
import { ESTADO_BADGE } from '../../kanban/constants';

interface WorkspaceHeaderProps {
  shipment: ShipmentDetail;
}

export function WorkspaceHeader({ shipment }: WorkspaceHeaderProps) {
  const router = useRouter();
  const estado = ESTADO_BADGE[shipment.estado];

  return (
    <div className="space-y-3">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 -ml-2 text-muted-foreground"
        onClick={() => router.push('/embarques/kanban')}
      >
        <ArrowLeft className="h-4 w-4" />
        Kanban de Embarques
      </Button>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">{shipment.referencia}</h1>
        {estado && (
          <Badge variant="outline" className={cn('text-xs', estado.className)}>
            {estado.label}
          </Badge>
        )}
        {shipment.carga_urgente && (
          <Badge
            variant="outline"
            className="text-xs gap-1 bg-destructive/10 text-destructive border-destructive/30"
          >
            <AlertTriangle className="h-3 w-3" />
            Urgente
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{shipment.cliente.nome}</p>
    </div>
  );
}
