'use client';

// Faixa "de onde vem cada dado" (Prompt 3, item B). Desenha o que
// `client-kind.ts` decide; nenhuma tela escreve a própria lista.

import { cn } from '@/lib/utils';

import {
  DATA_SOURCE_LABELS,
  type DataSource,
  type SourceLine,
} from './client-kind';

const SOURCE_CLASS: Record<DataSource, string> = {
  voce: 'bg-brand-indigo-100 text-brand-indigo',
  sincronizado: 'bg-portal-info/10 text-portal-info',
  aguardando: 'bg-portal-warning/10 text-portal-warning-ink',
  freitas: 'bg-muted text-portal-neutral',
  nao_se_aplica:
    'border border-dashed border-portal-neutral text-portal-neutral',
};

export function DataSourceStrip({
  title,
  lines,
  className,
}: {
  title: string;
  lines: SourceLine[];
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        'space-y-2 rounded-lg border border-border bg-card px-4 py-3',
        className,
      )}
    >
      <p className="portal-body font-medium text-foreground">{title}</p>
      <ul className="space-y-1.5">
        {lines.map((line) => (
          <li
            key={line.what}
            className="portal-small flex flex-wrap items-center gap-2"
          >
            <span
              className={cn(
                'inline-flex rounded-full px-2 py-0.5 font-medium',
                SOURCE_CLASS[line.source],
              )}
            >
              {DATA_SOURCE_LABELS[line.source]}
            </span>
            <span className="text-foreground">{line.what}</span>
            {line.note && (
              <span className="text-portal-neutral">— {line.note}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
