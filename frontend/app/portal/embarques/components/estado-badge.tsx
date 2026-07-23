import { cn } from '@/lib/utils';
import {
  ESTADO_BADGE_CLASS,
  ESTADO_LABELS,
  type EmbarqueEstado,
} from '@/types/portal-shipment';

export function EstadoBadge({
  estado,
  className,
}: {
  estado: EmbarqueEstado;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'portal-small inline-flex items-center whitespace-nowrap rounded border px-2 py-0.5 font-medium',
        ESTADO_BADGE_CLASS[estado],
        className,
      )}
    >
      {ESTADO_LABELS[estado]}
    </span>
  );
}
