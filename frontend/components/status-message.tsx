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
        // <img> puro: o otimizador do Next recusa SVG sem `dangerouslyAllowSVG`,
        // e o logotipo vetorial passou a ser o que chega aqui. Largura fixa com
        // altura automatica serve tanto ao lockup (deitado) quanto a um raster
        // quadrado, sem deformar nenhum dos dois.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt="" className="h-auto w-32 opacity-80" />
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
