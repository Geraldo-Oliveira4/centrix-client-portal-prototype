import { Award, Clock } from 'lucide-react';

// Single source of truth for the "menor preço"/"menor prazo" badges, used
// both in the full comparison table and the approval list. Both are backed
// by is_lowest_cost/is_lowest_transit computed server-side over eligible
// (non-expired) proposals only.

export function LowestCostBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-brand-pink text-white px-1.5 py-0.5 rounded">
      <Award className="w-3 h-3" />
      Menor Preço
    </span>
  );
}

export function LowestTransitBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-brand-navy text-white px-1.5 py-0.5 rounded">
      <Clock className="w-3 h-3" />
      Menor Prazo
    </span>
  );
}
