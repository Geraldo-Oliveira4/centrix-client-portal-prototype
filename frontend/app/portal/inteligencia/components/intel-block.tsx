'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { ProvenanceBadge, type Provenance } from '../../_shared/provenance-badge';

/**
 * One canvas-question block. A `real` block wears the primary `.portal-card`
 * surface (it looks like real content); a `preview` block wears the dashed,
 * tinted frame already used by the Auditoria preview, so the provenance is
 * legible at a glance before the reader even gets to the badge.
 *
 * `provenance` e OPCIONAL desde 27/08/2026, e o caso omitido tem um dono so: o
 * card COMPOSTO, cujas metades tem proveniencias diferentes (Confiabilidade =
 * ilustrativo, Evidencia = real, no mesmo card). Ali um selo no topo teria de
 * mentir sobre uma das duas, entao nao ha selo no topo — cada `IntelSubBlock`
 * carrega o seu. Nao use a versao sem selo para escapar de declarar a
 * proveniencia de um bloco simples.
 */
export function IntelBlock({
  icon,
  title,
  question,
  provenance,
  children,
  footnote,
  className,
}: {
  icon: ReactNode;
  title: string;
  question: string;
  provenance?: Provenance;
  children: ReactNode;
  footnote?: ReactNode;
  /** Para o par lado a lado esticar na mesma altura (`h-full`). */
  className?: string;
}) {
  const preview = provenance === 'preview';
  return (
    <section
      className={cn(
        'flex flex-col gap-4 p-6',
        preview
          ? 'rounded-xl border border-dashed border-border bg-muted/20'
          : 'portal-card',
        className,
      )}
    >
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-portal-neutral">{icon}</span>
            <h2 className="portal-h2 text-foreground">{title}</h2>
          </div>
          {provenance ? <ProvenanceBadge provenance={provenance} /> : null}
        </div>
        <p className="portal-small text-portal-neutral">{question}</p>
      </header>

      <div className="flex-1">{children}</div>

      {footnote ? (
        <p className="portal-small border-t border-dashed pt-3 text-portal-neutral">
          {footnote}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Uma metade de um card composto, com selo proprio.
 *
 * Existe para que Confiabilidade (ilustrativa) e Evidencia (real) possam viver
 * no MESMO card sem que uma empreste a proveniencia da outra: a metade
 * `preview` mantem a moldura tracejada que o portal inteiro usa para dado
 * fabricado, e a metade `real` fica na superficie limpa do card. A regra do
 * modulo continua valendo dentro do card — nada real veste o selo de
 * pre-visualizacao, nada fabricado aparece sem ele.
 */
export function IntelSubBlock({
  title,
  provenance,
  children,
  footnote,
  className,
}: {
  /** Opcional: a primeira metade costuma ser o proprio headline do card. */
  title?: string;
  provenance: Provenance;
  children: ReactNode;
  footnote?: ReactNode;
  className?: string;
}) {
  const preview = provenance === 'preview';
  return (
    <section
      className={cn(
        'flex flex-col gap-2',
        preview && 'rounded-xl border border-dashed border-border bg-muted/20 p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {title ? (
          <h3 className="portal-h3 text-foreground">{title}</h3>
        ) : (
          <span aria-hidden="true" />
        )}
        <ProvenanceBadge provenance={provenance} />
      </div>

      <div className="flex-1">{children}</div>

      {footnote ? (
        <p className="portal-small border-t border-dashed pt-2 text-portal-neutral">
          {footnote}
        </p>
      ) : null}
    </section>
  );
}
