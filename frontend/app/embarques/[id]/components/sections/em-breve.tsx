'use client';

import { EmptyState } from '@arboria-tech/arboria-ui';

interface EmBreveProps {
  label: string;
}

export function EmBreve({ label }: EmBreveProps) {
  return (
    <div className="py-12">
      <EmptyState message={`${label} — em breve.`} />
    </div>
  );
}
