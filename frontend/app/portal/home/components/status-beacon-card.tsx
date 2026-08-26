'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  SEMAFORO_DOT_CLASS,
  SEMAFORO_LABELS,
  countBySemaforo,
  type PortalShipment,
  type SemaforoTone,
} from '@/types/portal-shipment';

/**
 * Farol de status — a primeira coisa que a Home responde: "está tudo bem?".
 *
 * A FONTE É A MESMA do "Visão do todo" do Mapa: `countBySemaforo` sobre os
 * embarques do cliente, com os rótulos de `SEMAFORO_LABELS`. Não há aritmética
 * nova aqui, e por isso a Home e o Mapa não podem discordar. Pelo mesmo motivo
 * o rótulo laranja diz "Reprogramado" e não "atraso": atraso é a régua da
 * companhia marítima (o chip "Com atraso"), e são duas contagens diferentes —
 * a justificativa completa está em `SEMAFORO_LABELS`.
 *
 * O DESENHO É OUTRO, de propósito. O card do Mapa empilha três números grandes,
 * porque ali a pergunta já é sobre a carteira. Aqui o número dominante é UM — o
 * que precisa de atenção — e as três contagens ficam numa régua secundária. Uma
 * Home com três números do mesmo peso não responde nada; ela lista.
 *
 * "Ver no mapa" leva ao chip "Com exceção" JÁ LIGADO, e isso é exato, não
 * aproximado: aquele chip usa `isExceptionState`, cujos estados são exatamente
 * os que o semáforo pinta de laranja e vermelho. `home-actions.test.ts` falha se
 * um estado novo quebrar essa igualdade.
 */

const TONES: SemaforoTone[] = ['success', 'warning', 'danger'];

export function StatusBeaconCard({ shipments }: { shipments: PortalShipment[] }) {
  const counts = countBySemaforo(shipments);
  const needsAttention = counts.warning + counts.danger;

  return (
    <section className="portal-card flex flex-col gap-5 p-6">
      <div className="space-y-1">
        <p className="portal-small font-medium uppercase tracking-wide text-portal-neutral">
          Seus embarques
        </p>
        {/* O número e a frase mudam juntos: sem nada em aberto a tela dá a boa
            notícia em vez de imprimir um "0" grande, que lê como painel quebrado. */}
        {needsAttention === 0 ? (
          <p className="portal-h2 text-foreground">
            Nenhum embarque precisa da sua atenção hoje.
          </p>
        ) : (
          <p className="portal-h2 text-foreground">
            <span className="text-portal-warning">{needsAttention}</span>{' '}
            {needsAttention === 1
              ? 'embarque precisa da sua atenção hoje'
              : 'embarques precisam da sua atenção hoje'}
          </p>
        )}
        <p className="portal-small text-portal-neutral">
          {shipments.length}{' '}
          {shipments.length === 1
            ? 'embarque em acompanhamento'
            : 'embarques em acompanhamento'}
        </p>
      </div>

      {/* Régua do semáforo. Ponto + número + rótulo, na mesma ordem verde ->
          laranja -> vermelho de todas as superfícies do portal. */}
      <ul className="flex flex-wrap gap-x-6 gap-y-3 border-t border-dashed pt-4">
        {TONES.map((tone) => (
          <li key={tone} className="flex items-center gap-2">
            <span
              className={cn('h-2 w-2 shrink-0 rounded-full', SEMAFORO_DOT_CLASS[tone])}
              aria-hidden="true"
            />
            <span className="portal-body font-medium tabular-nums text-foreground">
              {counts[tone]}
            </span>
            <span className="portal-small text-portal-neutral">
              {SEMAFORO_LABELS[tone]}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href="/portal/embarques?tab=mapa&filtro=excecao"
        className="portal-small mt-auto inline-flex items-center gap-1 self-start font-medium text-primary hover:underline"
      >
        Ver no mapa
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
