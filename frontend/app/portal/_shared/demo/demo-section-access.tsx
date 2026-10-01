'use client';

import Link from 'next/link';
import { KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { CLIENT_KIND_LABELS } from './access-model';
import { useSetViewingAs, useViewedCompany } from './use-access';

/** A porta para /portal/admin/acessos. Nenhum outro lugar do portal linka para lá. */
export function AccessSection() {
  const viewed = useViewedCompany();
  const setViewingAs = useSetViewingAs();
  return (
    <div className="space-y-3">
      <Button
        asChild
        variant="outline"
        className="min-h-11 w-full justify-start"
      >
        <Link href="/portal/admin/acessos">
          <KeyRound className="mr-2 h-5 w-5" /> Abrir gestão de acessos
        </Link>
      </Button>
      {viewed ? (
        <div className="space-y-2 rounded-md bg-portal-info/10 px-3 py-2">
          <p className="portal-small text-portal-info">
            Vendo como {viewed.name} ({CLIENT_KIND_LABELS[viewed.kind]}).
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setViewingAs(null)}
          >
            Voltar à visão normal
          </Button>
        </div>
      ) : (
        <p className="portal-small text-portal-neutral">
          Importação de contatos, convites, módulos por empresa e “ver como”.
          Tela da Freitas, simulada.
        </p>
      )}
    </div>
  );
}
