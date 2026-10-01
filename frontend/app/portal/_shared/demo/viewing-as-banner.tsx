'use client';

// Faixa no topo do miolo, em toda tela, enquanto o "ver como" está ligado:
// quem apresenta precisa saber em que pele está, e quem assiste precisa saber
// que é simulação.

import { Eye } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { CLIENT_KIND_LABELS } from './access-model';
import { useSetViewingAs, useViewedCompany } from './use-access';

export function ViewingAsBanner() {
  const company = useViewedCompany();
  const setViewingAs = useSetViewingAs();
  if (!company) return null;
  return (
    <div
      role="status"
      className="-mx-4 -mt-6 mb-6 flex md:-mt-9 flex-wrap items-center justify-between gap-2 border-b border-portal-info/40 bg-card px-4 py-2 md:-mx-8 md:px-8"
    >
      <p className="portal-small flex items-center gap-2 text-portal-info">
        <Eye className="h-4 w-4 shrink-0" />
        <span>
          Vendo como <span className="font-medium">{company.name}</span> ({CLIENT_KIND_LABELS[company.kind]}) —
          simulado: módulos e tipo de cliente desta empresa, com os dados demo do portal.
        </span>
      </p>
      <Button type="button" size="sm" variant="outline" className="min-h-9" onClick={() => setViewingAs(null)}>
        Voltar à visão normal
      </Button>
    </div>
  );
}
