import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StatusMessageProps {
  title: string;
  description: string;
  onRetry?: () => void;
  logoSrc?: string;
  titleClassName?: string;
}

export function StatusMessage({ title, description, onRetry, logoSrc, titleClassName }: StatusMessageProps) {
  return (
    <div className={cn('flex flex-col items-center py-24 text-center', logoSrc ? 'gap-4' : 'gap-3')}>
      {logoSrc && (
        <Image src={logoSrc} alt="" width={56} height={56} className="opacity-80" />
      )}
      <div className="flex flex-col gap-2 items-center">
        <p className={cn('text-lg font-semibold', titleClassName)}>{title}</p>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
