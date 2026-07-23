'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, PackageSearch, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMyShipments } from '@/hooks/use-portal-shipments';

import { SectionHeading } from '../../_shared/page-header';
import { EstadoBadge } from './estado-badge';
import { ShipmentRoute } from './shipment-route';

// Normalise a reference for comparison: case- and whitespace-insensitive, so
// "emb-2026-0001" and "EMB-2026-0001" match.
const normalize = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '');

/**
 * "Verifique seu embarque" — a direct lookup by reference, the shortcut a client
 * wants when they only need one shipment's status without walking the list.
 *
 * The search is purely client-side over `useMyShipments`, which the backend
 * already scopes to the logged-in client (portal_shipment_repository). So a
 * reference that belongs to another client is indistinguishable from one that
 * does not exist — both simply fall through to "não encontrado", the same
 * anti-enumeration guarantee get_my_shipment gives. No new endpoint, no leak.
 */
export function ShipmentQuickCheck() {
  const { shipments } = useMyShipments();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState<string | null>(null);

  const term = searched ? normalize(searched) : '';
  const match = term
    ? shipments.find((s) => normalize(s.referencia) === term)
    : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    setSearched(trimmed.length ? trimmed : null);
  };

  return (
    <section id="verificar" className="portal-card scroll-mt-6 space-y-4 p-6">
      <SectionHeading
        title="Verifique seu embarque"
        icon={<PackageSearch className="h-5 w-5" />}
        hint="consulta rápida por referência"
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            // Clear the previous result while a new query is typed.
            setSearched(null);
          }}
          placeholder="Digite a referência do embarque, ex: EMB-2026-0001"
          aria-label="Referência do embarque"
          className="sm:flex-1"
        />
        <Button type="submit" className="shrink-0">
          <Search className="mr-2 h-4 w-4" />
          Verificar
        </Button>
      </form>

      {searched !== null ? (
        match ? (
          <div className="portal-card-muted space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="portal-body font-medium text-foreground">
                  {match.referencia}
                </p>
                <EstadoBadge estado={match.estado} />
              </div>
              <Link
                href={`/portal/embarques/${match.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Ver detalhe completo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ShipmentRoute estado={match.estado} modal={match.modal} />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
            <p className="portal-body font-medium text-foreground">
              Embarque não encontrado
            </p>
            <p className="portal-small text-portal-neutral">
              Nenhum embarque com a referência “{searched.trim()}” foi encontrado
              na sua conta. Confira a referência (formato EMB-AAAA-NNNN) e tente
              novamente.
            </p>
          </div>
        )
      ) : null}
    </section>
  );
}
