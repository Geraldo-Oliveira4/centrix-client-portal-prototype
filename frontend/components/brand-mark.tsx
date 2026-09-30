import { cn } from '@/lib/utils';

/**
 * Logotipo do Centrix, em vetor + tipografia.
 *
 * A MARCA É "Centrix", nunca "Freitas Centrix" (feedback de marketing, Semanal
 * de 25/09/2026). Os lockups oficiais de `public/logos/freitas-centrix-*`
 * desenham a palavra "freitas" e não há arte só Centrix no repositório, então
 * este componente é PROVISÓRIO: o símbolo laranja oficial (intocado) + a palavra
 * "centrix" composta em New Black (`.brand-wordmark`). Quando a arte chegar,
 * troque o corpo deste componente; a API (`variant`, `width`) fica.
 *
 * A escolha continua sendo pelo FUNDO: `principal` (tinta navy) sobre claro,
 * `negativo` (branco) sobre escuro, `auto` quando o fundo acompanha o tema
 * (a tinta vira `foreground`, que já flipa). `simbolo` é por TAMANHO: caixas
 * pequenas, onde a palavra ficaria ilegível.
 *
 * `width` é a largura aproximada do lockup inteiro, como antes.
 */

const SIMBOLO_SRC = '/logos/freitas-centrix-simbolo-laranja.svg';
// viewBox do simbolo: 791.14 x 805.61 — levemente mais alto que largo.
const SIMBOLO_RATIO = 805.61 / 791.14;
// Proporções medidas para que símbolo + palavra ocupem ~`width` px.
const SYMBOL_SHARE = 0.2;
const WORD_SHARE = 0.23;

const INK = {
  principal: 'text-brand-navy',
  negativo: 'text-white',
  auto: 'text-foreground',
} as const;

interface BrandMarkProps {
  variant: keyof typeof INK | 'simbolo';
  /** Largura aproximada do lockup, em px. */
  width: number;
  className?: string;
}

export function BrandMark({ variant, width, className }: BrandMarkProps) {
  if (variant === 'simbolo') {
    return (
      <img
        src={SIMBOLO_SRC}
        alt="Centrix"
        className={cn('block max-w-none', className)}
        style={{ width, height: width * SIMBOLO_RATIO }}
      />
    );
  }

  const symbol = width * SYMBOL_SHARE;
  return (
    <span
      role="img"
      aria-label="Centrix"
      className={cn('inline-flex shrink-0 items-center gap-[0.2em]', className)}
      style={{ fontSize: width * WORD_SHARE }}
    >
      {/* <img> puro, e nao next/image: o otimizador recusa SVG sem
          `dangerouslyAllowSVG`, e vetor nao ganha nada sendo reamostrado. */}
      <img
        src={SIMBOLO_SRC}
        alt=""
        className="block max-w-none"
        style={{ width: symbol, height: symbol * SIMBOLO_RATIO }}
      />
      <span aria-hidden="true" className={cn('brand-wordmark', INK[variant])}>
        centrix
      </span>
    </span>
  );
}
