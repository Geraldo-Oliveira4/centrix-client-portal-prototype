'use client';

// Erro de carregamento das telas do portal. Substitui o `ErrorComponent` da lib
// ("Aguarde o servidor inicializar... recarregue em 30 segundos"): o portal não
// pede espera longa. Com o modo offline ligado (padrão) esta tela quase não
// aparece — a falha de servidor vira dados de exemplo (`lib/offline/`). Ela fica
// para o modo offline DESLIGADO e para erro de negócio (cotação inexistente),
// e sempre oferece a saída para os dados de exemplo.

import { CloudOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { switchToSampleData } from '@/lib/offline/offline-store';

export function PortalLoadError({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
      <CloudOff className="h-6 w-6 text-portal-neutral" aria-hidden="true" />
      <h1 className="portal-h2">Não foi possível carregar estes dados</h1>
      <p className="portal-body max-w-md text-portal-neutral">
        {message ??
          'O servidor não respondeu ou devolveu um erro. Você pode tentar de novo ou continuar com dados de exemplo.'}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Tentar de novo
        </Button>
        <Button onClick={switchToSampleData}>Usar dados de exemplo</Button>
      </div>
    </div>
  );
}
