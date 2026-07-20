import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ReviewBadgeProps {
  className?: string;
}

export function ReviewBadge({ className }: ReviewBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'bg-amber-100 text-amber-800 border-amber-300',
        'dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
        'text-[10px] font-medium',
        className,
      )}
    >
      Em Revisão
    </Badge>
  );
}
