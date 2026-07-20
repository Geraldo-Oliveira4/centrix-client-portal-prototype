'use client';

import { useState } from 'react';
import { Check, Copy, Link, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientLinks } from '@/hooks/use-client-links';

interface ClientLinksSectionProps {
  quotationId: string;
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado' : 'Copiar link'}
    </button>
  );
}

export function ClientLinksSection({ quotationId }: ClientLinksSectionProps) {
  const { links, isLoading } = useClientLinks(quotationId);

  if (isLoading) return null;
  if (links.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Link className="w-3.5 h-3.5" />
        Links Enviados ao Cliente
      </p>

      <div className="flex flex-col gap-2">
        {links.map((link) => {
          const createdAt = new Date(link.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
          const expiresAt = new Date(link.expires_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });

          return (
            <div
              key={link.id}
              className={cn(
                'flex items-center justify-between gap-3 rounded-md border px-3 py-2.5',
                link.is_expired && 'opacity-50',
              )}
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground truncate max-w-[280px]">
                    {link.url}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">
                    Gerado em {createdAt}
                  </span>
                  {link.is_expired ? (
                    <span className="text-[11px] text-destructive">Expirado</span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      Expira em {expiresAt}
                    </span>
                  )}
                  {link.sent_at && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-green-700">
                      <Mail className="w-3 h-3" />
                      E-mail enviado em{' '}
                      {new Date(link.sent_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>

              {!link.is_expired && <CopyButton url={link.url} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
