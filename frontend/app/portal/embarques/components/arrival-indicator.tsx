'use client';

import { CalendarClock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatLongDate } from '@/lib/portal-formatters';
import type { PortalShipmentTracking } from '@/types/portal-shipment';

import {
  arrivalCountdownFromTracking,
  arrivalNote,
  arrivalTone,
  type ArrivalTone,
} from '../lib/arrival-countdown';
import type { DelayRisk } from '../lib/delay-risk';

/**
 * Indicador-chave do detalhe do embarque: a data final de chegada e quantos
 * dias faltam (planning da Sprint 13, 18/08/2026).
 *
 * O que ele substituiu, e por quê
 * -------------------------------
 * O topo mostrava um bloco de quatro campos — "Chegada estimada (ETA)" com a
 * data num chip de 12px, "Risco de atraso" com outro chip do mesmo tamanho, e
 * duas legendas explicando de onde cada um vinha. Orsi: "tira todo aquele
 * chegada estimada e coisas do gênero". Vinicius: "prefiro dar mais ênfase em
 * poucos indicadores que ela precisa bater o olho e saber". A pergunta que o
 * comprador do cliente traz para esta tela é uma só — quando a carga chega — e
 * ela estava dividida em dois chips do mesmo peso que exigiam ser cruzados.
 *
 * O atraso NÃO foi apagado: ele foi fundido. O delta em dias é a única
 * aritmética real desta tela (duas datas publicadas pela companhia, a mesma
 * `computeDelayRisk` do card da Lista, do Mapa e das agregações de
 * Inteligência), e o `step-insights` continua citando o número por extenso nas
 * etapas ("O atraso de 7 dias já confirmado na chegada..."). Removê-lo do topo
 * deixaria aquelas frases apontando para um número que a tela não afirma mais.
 * Ele vive aqui em duas formas: a COR do indicador e a frase de apoio.
 *
 * Sem badge de proveniência (mesma decisão de 18/08/2026): este era um dos
 * últimos pontos do portal ainda na convenção antiga, com selo e moldura
 * tracejada em volta do valor. A honestidade sobre dado de demonstração
 * continua — em texto corrido, não em selo — porque `tracking.is_mock` continua
 * sendo o que separa o rastreamento inventado do rastreamento real, e a seção
 * Acompanhamento logo abaixo segue selada.
 */

const TONE_CHIP: Record<ArrivalTone, string> = {
  neutral: 'border-border bg-muted text-portal-neutral',
  success: 'border-portal-success/25 bg-portal-success/10 text-portal-success',
  warning: 'border-portal-warning/30 bg-portal-warning/10 text-portal-warning',
  danger: 'border-portal-danger/30 bg-portal-danger/10 text-portal-danger',
};

export function ArrivalIndicator({
  tracking,
  delayRisk,
  /** "Hoje". Argumento para a data da tela sair da mesma leitura de relógio. */
  now,
  className,
}: {
  tracking: PortalShipmentTracking | null | undefined;
  /** A MESMA instância que a timeline e os insights por etapa consomem. */
  delayRisk: DelayRisk;
  now: Date;
  className?: string;
}) {
  const countdown = arrivalCountdownFromTracking(tracking, now);
  const tone = arrivalTone(countdown, delayRisk);
  const isMock = tracking?.is_mock === true;

  return (
    <div className={cn('space-y-2', className)}>
      <p className="portal-small inline-flex items-center gap-1.5 font-medium uppercase tracking-wide text-portal-neutral">
        <CalendarClock className="h-4 w-4" />
        {countdown.title}
      </p>

      {/* Sem data não há duas metades: a ausência ocupa a linha inteira, em
          neutro e sem chip. Um "—" grande ao lado de um chip do tamanho de uma
          resposta desenharia uma lacuna com a forma de um valor. */}
      {countdown.iso == null ? (
        <p className="portal-h2 text-portal-neutral">{countdown.headline}</p>
      ) : (
        /* A data e a contagem na MESMA linha e no mesmo salto de tamanho: são
           as duas metades de uma resposta só, e separá-las em dois blocos foi
           exatamente o que fez o bloco anterior precisar ser interpretado. */
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {/* A data fica em `text-foreground` em qualquer cenário: quem carrega
              o semáforo é o chip ao lado. Pintar os dois de vermelho faria a
              própria data parecer duvidosa, quando o que está ruim é o prazo. */}
          <span className="portal-h1 text-foreground">
            {formatLongDate(countdown.iso)}
          </span>
          <span
            className={cn(
              'portal-h3 inline-flex items-center rounded-md border px-2.5 py-1',
              TONE_CHIP[tone],
            )}
          >
            {countdown.headline}
          </span>
        </div>
      )}

      <p className="portal-body text-portal-neutral">{arrivalNote(delayRisk)}</p>

      {isMock && (
        <p className="portal-small text-portal-neutral">
          Rastreamento de demonstração — não vem da companhia marítima.
        </p>
      )}
    </div>
  );
}
