import { Plane, Ship, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PortalQuotation } from '@/types/portal';

interface ModalIconProps {
  modal: PortalQuotation['modal'];
  className?: string;
}

export function ModalIcon({ modal, className }: ModalIconProps) {
  const cls = cn('h-4 w-4', className);
  if (modal === 'AEREO') return <Plane className={cls} />;
  if (modal === 'RODOVIARIO') return <Truck className={cls} />;
  return <Ship className={cls} />;
}
