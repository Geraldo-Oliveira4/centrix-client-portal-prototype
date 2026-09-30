'use client';

// O sino do portal — notificações da Cotação V2 (RQ-16).
//
// NÃO EXISTIA. O cabeçalho tinha "Verificar embarque", o sol/lua, o avatar e
// "Sair"; este é o primeiro lugar do portal a avisar o cliente de alguma coisa.
// Por isso ele é MÍNIMO de propósito: dois tipos de aviso (propostas liberadas
// e solicitação devolvida), sem link externo e sem e-mail, exatamente o recorte
// que a spec pede. Quando o portal ganhar mais tipos de notificação, é aqui que
// eles entram — o componente já lê de um modelo puro e ordenado.
//
// Popover e não Sheet: são poucas linhas e elas pertencem ao ícone que as
// abriu. Um Sheet cobriria a tela para mostrar duas frases.
//
// Só aparece com `cotacaoV2` ligada. Com a flag desligada não há o que
// notificar, e um sino vazio permanente no cabeçalho seria uma promessa.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useMyQuotations } from '@/hooks/use-portal-quotations';

import {
  collectNotices,
  noticeAge,
  unreadCount,
} from './quotation-review-notices';
import {
  useMarkNoticesRead,
  useNoticeReadStore,
  useQuotationReviewStore,
} from './use-quotation-review';
import { collectShipmentNotices } from './shipment-po-notices';
import { useShipmentPoStore } from './use-shipment-po-review';
import { usePortalModuleReleased } from './use-feature-flags';

export function PortalNotificationsBell() {
  const released = usePortalModuleReleased('cotacaoV2');
  const poReleased = usePortalModuleReleased('embarqueViaPo');
  const store = useQuotationReviewStore();
  // O overlay de PO ja vem vazio quando `embarqueViaPo` esta desligada — ver
  // `useShipmentPoStore`. O sino nao precisa filtrar de novo.
  const poStore = useShipmentPoStore();
  const read = useNoticeReadStore();
  const markRead = useMarkNoticesRead();
  const [open, setOpen] = useState(false);

  // A MESMA chave SWR que o resto do portal usa (`/portal/quotations`),
  // deduplicada — o sino não acrescenta requisição. Ele só precisa da
  // referência para nomear a cotação de cada linha.
  const { data } = useMyQuotations();

  const references = useMemo(() => {
    const map: Record<string, string> = {};
    for (const rows of Object.values(data?.buckets ?? {})) {
      for (const q of rows) map[q.id] = q.reference;
    }
    return map;
  }, [data]);

  // DUAS FONTES, UMA LISTA. Cada dominio deriva as proprias linhas do proprio
  // historico; o sino so junta e ordena pela data. `href` e quem separa os dois
  // destinos — o resto do formato e identico de proposito.
  const notices = useMemo(() => {
    const rows = [
      ...(released ? collectNotices(store, references, read) : []),
      ...collectShipmentNotices(poStore, read),
    ];
    return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [released, store, references, read, poStore]);

  // UMA leitura de relógio por abertura: a lista inteira data do mesmo
  // instante, então duas linhas não podem discordar na virada do minuto.
  const now = useMemo(() => Date.now(), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!released && !poReleased) return null;

  const unread = unreadCount(notices);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Marca como lidas ao ABRIR, não ao fechar: o cliente já viu as linhas
        // no instante em que o painel apareceu.
        if (next) markRead(notices.map((notice) => notice.id));
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0
              ? `Notificações · ${unread} não ${unread === 1 ? 'lida' : 'lidas'}`
              : 'Notificações'
          }
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <header className="border-b px-4 py-3">
          <h2 className="portal-small font-medium uppercase tracking-wide text-portal-neutral">
            Notificações
          </h2>
        </header>

        {notices.length === 0 ? (
          <p className="portal-small px-4 py-6 text-center text-portal-neutral">
            Nenhuma notificação por enquanto.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {notices.map((notice) => (
              <li key={notice.id} className="border-b last:border-0">
                <Link
                  href={notice.href ?? `/portal/cotacao/${notice.quotationId}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex gap-2.5 px-4 py-3 transition-colors hover:bg-muted/40',
                    !notice.read && 'bg-brand-indigo-100/50',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      notice.read ? 'bg-transparent' : 'bg-primary',
                    )}
                  />
                  <span className="min-w-0">
                    <span className="portal-body block font-medium text-foreground">
                      {notice.title}
                    </span>
                    <span className="portal-small block text-portal-neutral">
                      {notice.body}
                    </span>
                    <span className="portal-small block text-portal-neutral">
                      {noticeAge(notice.at, now)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
