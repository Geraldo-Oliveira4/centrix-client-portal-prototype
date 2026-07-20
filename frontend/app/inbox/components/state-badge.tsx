import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { QuotationState } from '@/types/quotation';

// active   → signal-pink tint (uses --secondary / --secondary-foreground tokens)
// attention → amber / cargo-gold family (waiting on action)
// success  → green (closed/won)
// neutral  → muted (system state, no urgent action)
const STATE_CONFIG: Record<QuotationState, { label: string; className: string }> = {
  TRIAGEM_IA: {
    label: 'Triagem IA',
    className: 'bg-muted text-muted-foreground border-border',
  },
  AGUARDANDO_DADOS: {
    label: 'Aguardando Dados',
    className:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800',
  },
  COTANDO: {
    label: 'Cotando',
    className: 'bg-secondary text-secondary-foreground border-primary/20',
  },
  PARA_ANALISE: {
    label: 'Para Análise',
    className: 'bg-secondary text-secondary-foreground border-primary/20',
  },
  REVISAO_AGENTE: {
    label: 'Revisão Agente',
    className:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800',
  },
  ENVIADA_CLIENTE: {
    label: 'Enviada ao Cliente',
    className: 'bg-muted text-muted-foreground border-border',
  },
  APROVADA_PELO_CLIENTE: {
    label: 'Aprovada pelo Cliente',
    className:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800',
  },
  FECHADA: {
    label: 'Fechada',
    className:
      'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800',
  },
  DECLINADA: {
    label: 'Declinada',
    className: 'bg-muted text-muted-foreground border-border',
  },
  CANCELADO: {
    label: 'Cancelado',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export function getStateLabel(state: QuotationState): string {
  return STATE_CONFIG[state]?.label ?? state;
}

interface StateBadgeProps {
  state: QuotationState;
  className?: string;
}

export function StateBadge({ state, className }: StateBadgeProps) {
  const config = STATE_CONFIG[state];
  return (
    <Badge
      variant="outline"
      className={cn('font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
