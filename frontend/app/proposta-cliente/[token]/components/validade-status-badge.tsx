import { AlertTriangle } from 'lucide-react';
import type { ValidadeStatus } from '@/types/quotation';

interface ValidadeStatusBadgeProps {
  status: ValidadeStatus;
}

// Single source of truth for the "validade" badge shown next to a proposal,
// used both in the approval list and the full comparison table.
export function ValidadeStatusBadge({ status }: ValidadeStatusBadgeProps) {
  if (status === 'em_risco') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded">
        <AlertTriangle className="w-3 h-3" />
        Validade em risco
      </span>
    );
  }
  if (status === 'expirada') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded">
        <AlertTriangle className="w-3 h-3" />
        Vencida
      </span>
    );
  }
  return null;
}
