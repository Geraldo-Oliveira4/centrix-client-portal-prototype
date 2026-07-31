'use client';

import Link from 'next/link';
import { ArrowRight, FileSearch, Receipt, ScrollText } from 'lucide-react';

import { Button } from '@/components/ui';

import { PagePortalHeader } from '../_shared/page-header';
import { ProvenanceBadge } from '../_shared/provenance-badge';

/**
 * Auditoria — placeholder for the Camada de Auditoria de Frete/Fatura, a
 * separate product sequenced after the GE go-live. It has no data source in this
 * repository (no invoice, no BL, no audit engine), so this page shows NO number
 * at all: a fabricated figure here would read as the real product.
 *
 * What used to live here — the cotado × estimado comparison with the divergence
 * badge — was never audit: it is the data-conference layer of the quotation
 * itself, and now lives inside Minhas Cotações > Histórico, next to the closed
 * quotation it belongs to.
 */

const SCOPE = [
  {
    icon: Receipt,
    title: 'Fatura do agente × proposta aprovada',
    description:
      'Confronto linha a linha do que foi cobrado contra o que foi cotado, incluindo taxas que não estavam na proposta.',
  },
  {
    icon: ScrollText,
    title: 'BL e documentos do embarque',
    description:
      'Leitura dos documentos do embarque para apurar o valor efetivamente realizado, hoje inexistente em qualquer base.',
  },
  {
    icon: FileSearch,
    title: 'Trilha de divergências',
    description:
      'Histórico de divergências por agente e por rota, com o desfecho de cada contestação.',
  },
];

export default function AuditoriaPage() {
  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Auditoria"
        subtitle="Auditoria de frete e fatura — módulo em construção."
        action={<ProvenanceBadge provenance="pending" />}
      />

      <section className="space-y-6 rounded-xl border border-dashed border-border bg-muted/20 p-6">
        <div className="space-y-2">
          <p className="portal-h3 text-foreground">
            Ainda não há dado de auditoria neste portal
          </p>
          <p className="portal-body max-w-3xl text-portal-neutral">
            A auditoria compara o que foi cobrado com o que foi contratado, a
            partir da fatura do agente e dos documentos do embarque. Essas fontes
            ainda não estão integradas, então esta tela não exibe nenhum número —
            preferimos deixá-la vazia a mostrar um valor que ninguém apurou.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {SCOPE.map((item) => (
            <div key={item.title} className="space-y-2 rounded-xl border border-dashed border-border p-4">
              <item.icon className="h-5 w-5 text-portal-neutral" />
              <p className="portal-body font-medium text-foreground">{item.title}</p>
              <p className="portal-small text-portal-neutral">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="portal-card space-y-4 p-6">
        <div className="space-y-1">
          <p className="portal-h3 text-foreground">
            Procurando a conferência das cotações fechadas?
          </p>
          <p className="portal-body max-w-3xl text-portal-neutral">
            O comparativo entre o valor cotado e o valor de fechamento é uma
            conferência da própria cotação, não auditoria de fatura. Ele agora
            fica no histórico, dentro de cada cotação fechada.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/portal/cotacoes?tab=historico">
            Ir para Minhas Cotações · Histórico
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
