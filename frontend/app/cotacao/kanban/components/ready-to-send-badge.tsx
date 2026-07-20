import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ReadyToSendBadgeProps {
  className?: string;
}

export function ReadyToSendBadge({ className }: ReadyToSendBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'bg-green-100 text-green-800 border-green-300',
        'dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
        'text-[10px] font-medium',
        className,
      )}
    >
      Pronto para enviar
    </Badge>
  );
}
