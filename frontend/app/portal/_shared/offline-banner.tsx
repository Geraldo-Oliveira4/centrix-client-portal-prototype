'use client';

// Faixa do modo offline: diz, em toda tela, que os dados são de exemplo.
//
// Presa ao topo da área de conteúdo (`sticky` dentro do `<main>`, que é quem
// rola), abaixo do cabeçalho e fora do caminho das barras presas ao rodapé e do
// botão "Ajuda". Discreta de propósito — é aviso permanente, não alarme —, mas
// nunca some enquanto o modo estiver ativo. Com a API de pé, não renderiza nada.

import { useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { offlineBannerText } from '@/lib/offline/offline-mode';
import { retryOnline } from '@/lib/offline/offline-store';
import { useOfflineStatus } from '@/lib/offline/use-offline-status';

export function OfflineBanner() {
  const status = useOfflineStatus();
  const [retrying, setRetrying] = useState(false);
  const [stillDown, setStillDown] = useState(false);

  if (status.status !== 'offline') return null;

  const retry = async () => {
    setRetrying(true);
    setStillDown(false);
    const ok = await retryOnline();
    // Com sucesso a página recarrega; aqui só chega quem continua sem servidor.
    if (!ok) {
      setStillDown(true);
      setRetrying(false);
    }
  };

  return (
    // Fundo opaco (bg-card) por baixo da tinta: a faixa e sticky, e com a tinta
    // translucida sozinha o conteudo rolando apareceria atraves dela.
    <div role="status" className="sticky top-0 z-30 bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-portal-warning/30 bg-portal-warning/10 px-4 py-2 md:px-8">
        <CloudOff
          className="h-4 w-4 shrink-0 text-portal-warning-ink"
          aria-hidden="true"
        />
        <p className="portal-small min-w-0 flex-1 font-medium text-portal-warning-ink">
          {offlineBannerText(status.reason)}{' '}
          {/* No celular a faixa fica numa linha so: ela e presa ao topo, e cada
            linha a mais e conteudo a menos em toda tela. */}
          <span className="hidden font-normal sm:inline">
            Ações que gravariam algo são simuladas: nada é enviado.
          </span>
          {stillDown ? (
            <span className="font-normal">
              {' '}
              O servidor ainda não respondeu.
            </span>
          ) : null}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 bg-card"
          onClick={retry}
          disabled={retrying}
        >
          <RefreshCw
            className={retrying ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'}
          />
          {retrying ? 'Testando…' : 'Tentar de novo'}
        </Button>
      </div>
    </div>
  );
}
