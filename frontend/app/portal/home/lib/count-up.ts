// Contagem dos números na revelação da Home (Prompt 5). PURO: roda sob
// `npm run test:unit`.
//
// A Home não edita os cards que reaproveita (`SavingsCard`, o farol etc.), então
// a contagem age sobre o TEXTO já renderizado: só um nó de texto que é número
// puro ("12", "R$ 1.270,00", "35%") entra; frase com número no meio fica como
// está. A animação termina SEMPRE no texto original, caractere por caractere —
// a contagem é efeito, nunca um segundo valor.

export interface Countable {
  prefix: string;
  value: number;
  decimals: number;
  suffix: string;
}

const COUNTABLE = /^(R\$\s?|US\$\s?)?(\d{1,3}(?:\.\d{3})*|\d+)(,\d+)?(\s?%)?$/;

/** O texto é um número que vale animar? Zero não anima: não há o que contar. */
export function parseCountable(text: string): Countable | null {
  const match = COUNTABLE.exec(text.trim());
  if (!match) return null;
  const [, prefix = '', int, frac = '', suffix = ''] = match;
  const value = Number(`${int.replace(/\./g, '')}.${frac.slice(1) || '0'}`);
  if (!Number.isFinite(value) || value === 0) return null;
  // Um ano sozinho ("2026") é rótulo, não quantidade.
  if (!prefix && !frac && !suffix && /^(19|20)\d\d$/.test(int)) return null;
  return { prefix, value, decimals: frac ? frac.length - 1 : 0, suffix };
}

/** O valor intermediário no MESMO formato pt-BR do original. */
export function formatCountable(c: Countable, value: number): string {
  const body = value.toLocaleString('pt-BR', {
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
  });
  return `${c.prefix}${body}${c.suffix}`;
}

/** Curva de saída: começa rápido e assenta no valor final. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}
