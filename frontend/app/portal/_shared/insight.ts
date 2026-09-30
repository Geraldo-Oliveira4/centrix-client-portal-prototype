// Variação escrita de um número contra o período anterior — o padrão de
// INSIGHT do portal (30/09/2026, feedback de marketing: "número sem
// interpretação"). Todo número de destaque vem com uma frase que diz o que ele
// significa e para que lado andou.
//
// PURE, sem o alias `@/`: roda sob `npm run test:unit`.
//
// A MESMA regra existe no iframe da Inteligência
// (`public/prototypes/centrix-inteligencia/insights.js`); mudou aqui, mude lá.
//
// Três decisões que a regra carrega:
// - sem os dois lados não há variação (`null`), e nunca vira "0%" nem "+100%";
// - taxas variam em PONTOS, valores em %;
// - nem toda queda é ruim: `higherIsBetter: null` desenha a seta sem cor, e
//   `badTone: 'neutral'` existe para KPI comercial, que não pode usar o
//   vermelho do semáforo de carga.

export type InsightTone = 'good' | 'bad' | 'neutral';

export interface Variation {
  delta: number;
  direction: 'up' | 'down' | 'flat';
  tone: InsightTone;
  text: string;
}

export interface VariationOptions {
  kind: 'pp' | 'pct';
  /** `null`: nenhum lado é melhor (ex.: frete contratado). */
  higherIsBetter: boolean | null;
  /** "o mês passado", "julho". */
  previousLabel: string;
  /** Tom de uma piora. Padrão 'bad'; 'neutral' para KPI comercial. */
  badTone?: 'bad' | 'neutral';
}

/** "de" + "o mês passado" = "do mês passado"; "a" + "julho" = "a julho". */
function contract(prep: 'de' | 'a', label: string): string {
  const [article, ...rest] = label.split(' ');
  const noun = rest.join(' ');
  if (article === 'o') return `${prep === 'de' ? 'do' : 'ao'} ${noun}`;
  if (article === 'a') return `${prep === 'de' ? 'da' : 'à'} ${noun}`;
  return `${prep} ${label}`;
}

export function variationOf(
  current: number | null | undefined,
  previous: number | null | undefined,
  { kind, higherIsBetter, previousLabel, badTone = 'bad' }: VariationOptions,
): Variation | null {
  if (current == null || previous == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  let raw: number;
  if (kind === 'pp') raw = Math.round(current - previous);
  else if (previous === 0) return null;
  else raw = Math.round(((current - previous) / previous) * 100);

  const direction = raw > 0 ? 'up' : raw < 0 ? 'down' : 'flat';
  const better =
    direction === 'up'
      ? higherIsBetter
      : direction === 'down'
        ? higherIsBetter === false
        : null;
  const tone: InsightTone =
    direction === 'flat' || higherIsBetter == null
      ? 'neutral'
      : better
        ? 'good'
        : badTone;
  const delta = Math.abs(raw);
  const amount =
    kind === 'pp'
      ? `${delta} ${delta === 1 ? 'ponto' : 'pontos'}`
      : `${delta}%`;
  const text =
    direction === 'flat'
      ? `igual ${contract('a', previousLabel)}`
      : `${amount} ${direction === 'up' ? 'acima' : 'abaixo'} ${contract('de', previousLabel)}`;
  return { delta: raw, direction, tone, text };
}
