import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

const getPriorityConfig = (score: number | null) => {
  if (score === null)
    return {
      label: 'N/A',
      className: 'bg-muted text-muted-foreground border-border',
    };
  if (score >= 80)
    return {
      label: 'Urgente',
      className:
        'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400',
    };
  if (score >= 60)
    return {
      label: 'Alta',
      className:
        'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400',
    };
  return {
    label: 'Normal',
    className:
      'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400',
  };
};

interface PriorityBadgeProps {
  score: number | null;
  className?: string;
}

export function PriorityBadge({ score, className }: PriorityBadgeProps) {
  const config = getPriorityConfig(score);
  return (
    <Badge
      variant="outline"
      className={cn('font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
