'use client';

// Tela 9 — vincular uma cotação a um embarque já criado (RQ-4).
//
// O embarque nasceu de um PO, então não tem cotação por trás dele. Isso não é
// falta de dado: é o caminho de abertura que esta jornada existe para servir. O
// chip é neutro e o card explica, em vez de acusar.
//
// A BUSCA aceita os três critérios que a Open Question 7 deixou em aberto
// (número da cotação, referência do PO e cliente) de propósito: com a pergunta
// ainda aberta, escolher um deles no protótipo seria responder por quem decide.
// A lista mostra só cotações APROVADAS do próprio cliente, que é a proposta da
// spec.
//
// O EMBARQUE MANTÉM O MESMO ID depois de vinculado, e o chip some.

import { useMemo, useState } from 'react';
import { Link2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useMyQuotations } from '@/hooks/use-portal-quotations';
import type { PortalQuotation } from '@/types/portal';

import { NoQuotationChip } from './shipment-po-labels';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

/** Só as cotações que o cliente já aprovou (proposta da spec). */
function approvedQuotations(
  data: ReturnType<typeof useMyQuotations>['data'],
): PortalQuotation[] {
  return Object.values(data?.buckets ?? {})
    .flat()
    .filter(
      (q) =>
        q.state === 'FECHADA' ||
        q.state === 'APROVADA_PELO_CLIENTE' ||
        q.proposals?.some((p) => p.is_winner),
    );
}

export function LinkQuotationCard({
  linkedQuotationId,
  onLink,
}: {
  linkedQuotationId: string | null;
  onLink: (quotationId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const { data } = useMyQuotations();

  const approved = useMemo(() => approvedQuotations(data), [data]);
  const results = useMemo(() => {
    const term = normalize(query);
    if (!term) return approved;
    return approved.filter((q) =>
      [q.reference, q.client_reference ?? '', q.exporter_name ?? '', q.product ?? '']
        .map(normalize)
        .some((value) => value.includes(term)),
    );
  }, [approved, query]);

  const linked = approved.find((q) => q.id === linkedQuotationId);

  return (
    <section className="portal-card p-5">
      <h2 className="portal-h3">Cotação vinculada</h2>

      {linkedQuotationId ? (
        <p className="portal-body mt-2 text-foreground">
          {linked?.reference ?? 'Cotação vinculada'}
          {linked?.product ? ` · ${linked.product}` : ''}
        </p>
      ) : (
        <>
          <div className="mt-2">
            <NoQuotationChip long />
          </div>
          <p className="portal-small mt-2 text-portal-neutral">
            Este embarque foi aberto por PO e ainda não tem cotação. Vincule uma
            para consolidar tudo num único processo.
          </p>
          <Button className="mt-3" onClick={() => setOpen(true)}>
            <Link2 className="mr-1.5 h-4 w-4" />
            Vincular cotação
          </Button>
        </>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setSelected(null);
            setQuery('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular cotação</DialogTitle>
            <DialogDescription>
              Escolha a cotação que originou este embarque.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-neutral" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nº da cotação, cliente ou referência do PO"
              aria-label="Buscar cotação"
              className="pl-9"
            />
          </div>

          {results.length === 0 ? (
            <p className="portal-small text-portal-neutral">
              Nenhuma cotação aprovada corresponde à busca.
            </p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {results.map((quotation) => (
                <li key={quotation.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors',
                      selected === quotation.id
                        ? 'border-brand-orange bg-brand-orange/10'
                        : 'border-border hover:bg-muted/40',
                    )}
                  >
                    <input
                      type="radio"
                      name="link-quotation"
                      className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                      checked={selected === quotation.id}
                      onChange={() => setSelected(quotation.id)}
                    />
                    <span className="min-w-0">
                      <span className="portal-body block font-medium text-foreground">
                        {quotation.reference}
                        {quotation.product ? ` · ${quotation.product}` : ''}
                      </span>
                      <span className="portal-small block text-portal-neutral">
                        {quotation.client_reference ?? 'PO não informado'}
                        {quotation.origin ? ` · ${quotation.origin}` : ''}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!selected}
              onClick={() => {
                if (selected) onLink(selected);
                setOpen(false);
                setSelected(null);
              }}
            >
              <Link2 className="mr-1.5 h-4 w-4" />
              Vincular cotação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
