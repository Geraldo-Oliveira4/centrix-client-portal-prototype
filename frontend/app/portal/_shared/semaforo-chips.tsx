'use client';

import { cn } from '@/lib/utils';
import {
  SEMAFORO_DOT_CLASS,
  SEMAFORO_LABELS,
  type SemaforoCounts,
  type SemaforoTone,
} from '@/types/portal-shipment';

/**
 * O farol de operações, como CHIPS: bolinha de semáforo + número + rótulo, um
 * chip por tom.
 *
 * UM DESENHO SÓ para as duas telas de entrada. A Home o mostra sobre o navy (no
 * canto superior direito do bloco) e a Visão Geral sobre o branco, numa linha
 * abaixo do título — mesma leitura, dois fundos, e por isso `variant` só troca a
 * cor da moldura e do texto. As BOLINHAS não mudam: elas são semáforo, e
 * semáforo não muda de cor com o fundo.
 *
 * O COMPONENTE NÃO CONTA NADA. `counts` chega pronto, e nas duas telas ele vem
 * do MESMO `countBySemaforo` que o "Visão do todo" do Mapa e o contador da Lista
 * já usam. Isso é o que impede o farol de discordar das telas para onde ele
 * manda — e é por isso que ele nunca é populado pelo tamanho das colunas da
 * Torre de Controle: aquilo conta quem precisa agir, isto conta em que nível de
 * risco cada operação está. São duas perguntas, e misturá-las daria um número
 * que não responde nenhuma.
 *
 * O rótulo laranja diz "Reprogramado", não "atraso": atraso é a régua da
 * companhia marítima (o chip "Com atraso" de Meus Embarques), e são duas
 * contagens diferentes — a justificativa completa está em `SEMAFORO_LABELS`.
 */

const TONES: SemaforoTone[] = ['success', 'warning', 'danger'];

const CHIP_VARIANT = {
  navy: 'border-white/15 bg-white/10 text-white',
  light: 'border-border bg-background text-foreground',
} as const;

const LABEL_VARIANT = {
  navy: 'text-white/70',
  light: 'text-portal-neutral',
} as const;

export function SemaforoChips({
  counts,
  variant = 'light',
  className,
}: {
  counts: SemaforoCounts;
  variant?: keyof typeof CHIP_VARIANT;
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-2', className)}>
      {TONES.map((tone) => (
        <li
          key={tone}
          className={cn(
            'flex items-center gap-2 rounded-full border px-3 py-1.5',
            CHIP_VARIANT[variant],
          )}
        >
          <span
            className={cn('h-2 w-2 shrink-0 rounded-full', SEMAFORO_DOT_CLASS[tone])}
            aria-hidden="true"
          />
          <span className="portal-body font-medium tabular-nums">{counts[tone]}</span>
          <span className={cn('portal-small', LABEL_VARIANT[variant])}>
            {SEMAFORO_LABELS[tone]}
          </span>
        </li>
      ))}
    </ul>
  );
}
