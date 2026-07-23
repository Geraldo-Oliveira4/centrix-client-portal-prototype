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
        'inline-flex items-center rounded border px-1.5 py-0.5 text-xs whitespace-nowrap',
        ESTADO_BADGE_CLASS[estado],
        className,
      )}
    >
      {ESTADO_LABELS[estado]}
    </span>
  );
}
