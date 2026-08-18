// Contagem regressiva até a chegada: a data final e "faltam X dias". Pura e
// unit-testada (arrival-countdown.test.ts) — o relógio é argumento, nunca uma
// chamada a `new Date()` dentro da regra.
//
// Por que existe (planning da Sprint 13, 18/08/2026, Vinicius)
// -----------------------------------------------------------
// "Eu colocaria a data final como indicador-chave... e quantos dias faltam em
// destaque lá em cima." A dor descrita é do comprador do cliente, que não sabe
// quando a carga chega e cobra o time errado. O topo da tela mostrava a data
// dentro de um badge de 12px ao lado de um badge de risco: quem batia o olho
// via dois chips do mesmo tamanho e tinha de interpretar os dois para responder
// a pergunta mais simples que existe sobre um embarque.
//
// A regra que impede um segundo número
// ------------------------------------
// A âncora é `tracking.current_eta` (com `first_eta` como reserva) — a MESMA
// string que o `ShipmentEtaBadge` imprimia e a MESMA que `step-forecast.ts` usa
// como chegada para derivar Descarregado (+2) e Liberado (+5). Não há segunda
// fonte de data de chegada nesta tela, e não pode haver: foi ETA próprio
// contradizendo o ETA do topo que matou o card "Rastreamento marítimo".
//
// Sem data não há contagem: `unknown` é um resultado desta função, não uma
// decisão do componente, exatamente como `pending`/`incomplete` são resultados
// de `computeDelayRisk`. Assim a tela não consegue imprimir "faltam X dias"
// sobre um embarque sem rastreamento.
//
// O deslocamento em dias (a frase de apoio) continua vindo de `computeDelayRisk`,
// que é a única aritmética de atraso do portal — este módulo só a redige. Ele
// NÃO reclassifica atraso: um embarque atrasado continua atrasado pelo mesmo
// delta que o card da Lista, o Mapa e as agregações de Inteligência usam.

import type { DelayRisk } from './delay-risk.ts';

export type ArrivalStatus =
  /** Sem ETA de onde contar — a integração não reportou nada. */
  | 'unknown'
  /** A chegada está no futuro. */
  | 'scheduled'
  /** A chegada é hoje. */
  | 'today'
  /** A companhia confirmou a chegada (`IsActual`). */
  | 'arrived'
  /** A previsão venceu e a companhia não confirmou chegada nenhuma. */
  | 'overdue';

export interface ArrivalCountdown {
  status: ArrivalStatus;
  /** ISO da chegada (prevista ou confirmada). Null quando não há data. */
  iso: string | null;
  /** Dias de calendário até a chegada; negativo depois dela. Null sem data. */
  days: number | null;
  /** Rótulo do bloco: "Chegada prevista" / "Chegada confirmada". */
  title: string;
  /** O destaque: "faltam 25 dias", "chega hoje", "chegou há 3 dias". */
  headline: string;
  /** A data é uma chegada real reportada, não uma estimativa. */
  confirmed: boolean;
}

/** Cor do indicador. Neutro quando não há aritmética por trás. */
export type ArrivalTone = 'neutral' | 'success' | 'warning' | 'danger';

const DAY_MS = 86_400_000;

/**
 * Dias de calendário entre dois instantes, ignorando a hora — mesma regra de
 * `delay-risk.ts`. ETA é publicado como data, e comparar timestamps crus
 * transformaria uma revisão 06:00 -> 20:00 do mesmo dia em "meio dia".
 */
function utcDayDiff(from: Date, to: Date): number {
  const day = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((day(to) - day(from)) / DAY_MS);
}

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export interface ArrivalCountdownInput {
  /** ETA atual no POD, ou a chegada real quando `etaIsActual`. */
  currentEta: string | null | undefined;
  /** Reserva quando a companhia só publicou a primeira previsão. */
  firstEta?: string | null;
  /** ShipsGo IsActual: `currentEta` é chegada real, não estimativa. */
  etaIsActual?: boolean | null;
  /** "Hoje". Injetado para a regra continuar pura e testável. */
  now: Date;
}

export function computeArrivalCountdown(
  input: ArrivalCountdownInput,
): ArrivalCountdown {
  const arrival = parse(input.currentEta) ?? parse(input.firstEta);
  const confirmed = input.etaIsActual === true;

  if (!arrival) {
    return {
      status: 'unknown',
      iso: null,
      days: null,
      title: 'Chegada prevista',
      headline: 'Sem previsão da companhia',
      confirmed: false,
    };
  }

  const iso = arrival.toISOString();
  const days = utcDayDiff(input.now, arrival);
  // "Confirmada" só quando a data confirmada JÁ PASSOU. `IsActual` sobre uma
  // data futura é fonte se contradizendo (a companhia não pode ter registrado
  // uma chegada que ainda não aconteceu), e acontece no dado ilustrativo do
  // `topup_tracking_full.py`. Entre acreditar no flag e acreditar no
  // calendário, a tela acredita no calendário: "Chegada confirmada — faltam 9
  // dias" é a única das duas leituras que não pode ser verdade.
  const title = confirmed && days <= 0 ? 'Chegada confirmada' : 'Chegada prevista';

  if (confirmed && days <= 0) {
    return {
      status: 'arrived',
      iso,
      days,
      title,
      headline:
        days === 0
          ? 'chegou hoje'
          : `chegou há ${-days} ${plural(-days, 'dia', 'dias')}`,
      confirmed,
    };
  }

  if (days === 0) {
    return { status: 'today', iso, days, title, headline: 'chega hoje', confirmed };
  }

  if (days > 0) {
    return {
      status: 'scheduled',
      iso,
      days,
      title,
      headline: `${plural(days, 'falta', 'faltam')} ${days} ${plural(days, 'dia', 'dias')}`,
      confirmed,
    };
  }

  // Data no passado sem confirmação da companhia: a previsão venceu e ninguém
  // reportou a chegada. Dizer "chegou" aqui seria afirmar um fato que a fonte
  // não deu — o que a tela sabe é que a previsão passou.
  return {
    status: 'overdue',
    iso,
    days,
    title,
    headline: `previsão vencida há ${-days} ${plural(-days, 'dia', 'dias')}`,
    confirmed,
  };
}

/** Atalho para o shape que o payload do portal entrega. */
export function arrivalCountdownFromTracking(
  tracking:
    | {
        first_eta: string | null;
        current_eta: string | null;
        eta_is_actual: boolean | null;
      }
    | null
    | undefined,
  now: Date,
): ArrivalCountdown {
  return computeArrivalCountdown({
    currentEta: tracking?.current_eta,
    firstEta: tracking?.first_eta,
    etaIsActual: tracking?.eta_is_actual,
    now,
  });
}

/**
 * Cor do indicador. O semáforo do ATRASO manda sempre que há aritmética — é o
 * mesmo `computeDelayRisk` do card da Lista e do Mapa, e um indicador verde
 * sobre um embarque com +7 dias de atraso seria a contradição que a regra
 * "onde existe aritmética, ela ganha" existe para impedir.
 *
 * As duas exceções são estados que o delta não descreve: chegada já confirmada
 * (o embarque acabou — verde independente de ter chegado tarde, e o quanto ele
 * atrasou fica na frase de apoio) e previsão vencida sem confirmação, que é
 * silêncio da companhia sobre uma data que já passou.
 */
export function arrivalTone(
  countdown: ArrivalCountdown,
  delayRisk: DelayRisk,
): ArrivalTone {
  if (countdown.status === 'unknown') return 'neutral';
  if (countdown.status === 'arrived') return 'success';
  if (countdown.status === 'overdue') return 'warning';
  if (delayRisk.status === 'delayed') return 'danger';
  if (delayRisk.status === 'attention') return 'warning';
  if (delayRisk.status === 'on_time') return 'success';
  // `pending` / `incomplete`: há data, mas não há as DUAS previsões de que o
  // delta precisa. Neutro, nunca cor de semáforo — é o mesmo princípio do
  // IncompleteDataBadge: qualidade de dado não é saúde do embarque.
  return 'neutral';
}

/**
 * Frase de apoio: o que aconteceu com esta data desde a primeira previsão. É
 * aqui que sobrevive o número que ficava no badge "Risco de atraso" removido em
 * 18/08/2026 — o delta é real (duas datas publicadas pela companhia) e continua
 * escrito por extenso, em vez de virar um segundo chip para o leitor cruzar.
 */
export function arrivalNote(delayRisk: DelayRisk): string {
  if (delayRisk.status === 'pending') {
    return 'A companhia marítima ainda não publicou previsão para este embarque.';
  }
  if (delayRisk.status === 'incomplete') {
    return 'A companhia marítima não reportou as duas previsões necessárias para medir o desvio.';
  }
  const delta = delayRisk.deltaDays ?? 0;
  if (delta > 0) {
    return `Postergada ${delta} ${plural(delta, 'dia', 'dias')} sobre a primeira previsão da companhia.`;
  }
  if (delta < 0) {
    return `Antecipada ${-delta} ${plural(-delta, 'dia', 'dias')} sobre a primeira previsão da companhia.`;
  }
  return 'A companhia mantém a mesma previsão desde a primeira estimativa.';
}
