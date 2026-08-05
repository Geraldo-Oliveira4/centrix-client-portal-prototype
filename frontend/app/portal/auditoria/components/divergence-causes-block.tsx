'use client';

import { BarChart3 } from 'lucide-react';

import { cn } from '@/lib/utils';

import { SectionHeading } from '../../_shared/page-header';
import { ProvenanceBadge } from '../../_shared/provenance-badge';
import {
  computeDivergenceCauses,
  type ConciliationExample,
} from '../lib/conciliation';

/**
 * "Causas mais comuns de divergência" — a leitura agregada da Camada 1, acima da
 * lista embarque a embarque.
 *
 * Responde uma pergunta que a lista não responde: a lista diz QUAIS embarques
 * divergiram, esta barra diz O QUE costuma divergir. É a diferença entre
 * conferir um fechamento e negociar a próxima cotação.
 *
 * Selo `preview` e não `pending`: a agregação é aritmética correta, mas roda
 * sobre os exemplos EXEMPLO- fictícios (não existe NF final no schema), então o
 * VOLUME é ilustrativo. Mesma categoria dos exemplos que ela resume — se um dia
 * a lista virar dado real, este bloco vira `real` junto, sem tocar no cálculo.
 */
export function DivergenceCausesBlock({
  examples,
}: {
  examples: ConciliationExample[];
}) {
  const causes = computeDivergenceCauses(examples);

  if (causes.length === 0) {
    return (
      <section className="space-y-4 rounded-xl border border-dashed border-border bg-muted/20 p-6">
        <SectionHeading
          title="Causas mais comuns de divergência"
          icon={<BarChart3 className="h-5 w-5" />}
          action={<ProvenanceBadge provenance="preview" />}
        />
        <p className="portal-body text-portal-neutral">
          Nenhuma divergência nos fechamentos analisados.
        </p>
      </section>
    );
  }

  // Normaliza pelo maior valor: com a maior causa em 37%, barras desenhadas
  // sobre 100% ficariam todas curtas e a comparação — que é o ponto do bloco —
  // se perderia. O número ao lado continua sendo a participação real.
  const max = causes[0].sharePct;

  return (
    <section className="space-y-4 rounded-xl border border-dashed border-border bg-muted/20 p-6">
      <SectionHeading
        title="Causas mais comuns de divergência"
        hint="o que mais diverge entre o contratado e o cobrado"
        icon={<BarChart3 className="h-5 w-5" />}
        action={<ProvenanceBadge provenance="preview" />}
      />

      <ul className="space-y-3">
        {causes.map((cause) => (
          <li
            key={cause.item}
            className="grid grid-cols-[8rem_1fr_auto] items-center gap-x-4 gap-y-1"
          >
            <span className="portal-body font-medium text-foreground">
              {cause.item}
            </span>
            <span
              className="h-2 rounded-full bg-muted"
              role="img"
              aria-label={`${cause.sharePct}% das divergências`}
            >
              <span
                className={cn('block h-2 rounded-full bg-primary')}
                style={{ width: `${Math.max((cause.sharePct / max) * 100, 4)}%` }}
              />
            </span>
            <span className="portal-small whitespace-nowrap text-portal-neutral">
              <span className="font-medium text-foreground">{cause.sharePct}%</span>{' '}
              das divergências
              <span className="mx-1.5 text-border">·</span>
              {cause.count} {cause.count === 1 ? 'embarque' : 'embarques'}
            </span>
          </li>
        ))}
      </ul>

      <p className="portal-small border-t border-dashed pt-3 text-portal-neutral">
        Participação de cada item sobre o total de linhas divergentes — as fatias
        somam 100%. A leitura de cada linha usa o mesmo limite de divergência da
        tabela de detalhe. O <span className="font-medium text-foreground">cálculo é
        real</span>; o <span className="font-medium text-foreground">volume é
        ilustrativo</span>, porque roda sobre os exemplos abaixo e não sobre
        fechamentos seus.
      </p>
    </section>
  );
}
