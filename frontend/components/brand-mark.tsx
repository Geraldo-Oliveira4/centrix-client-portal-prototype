import { cn } from '@/lib/utils';

/**
 * Logotipo oficial Freitas Centrix (Brand System v1.0), em vetor.
 *
 * Os dois lockups trazem clear-space GENEROSO embutido no proprio viewBox: a
 * arte ocupa 1486,2 x 648,1 de um quadro de 2179,77 x 1642,83 — sobram ~30,2%
 * de altura em cima, ~30,3% embaixo e ~16% de largura em cada lateral. Num
 * arquivo de marca isso e correto; dentro de um header de 40px vira um
 * logotipo minusculo boiando no meio da caixa, desalinhado do texto ao lado.
 *
 * A compensacao e feita AQUI, em CSS, e nao recortando o SVG: `width` passa a
 * valer a largura da ARTE (nao a do quadro) e as margens negativas descontam o
 * padding do quadro, de modo que a caixa de layout abrace a arte. Os arquivos
 * em `public/logos/` seguem intocados — se um dia vierem ja cortados no
 * clear-space, zere as constantes abaixo e nada mais muda.
 *
 * Os dois lockups tem geometria IDENTICA (so muda a cor da palavra "freitas":
 * navy no principal, branco no negativo), entao uma constante serve aos dois.
 *
 * O `simbolo` (o "x" laranja) e outro caso: viewBox JUSTO (791,4 x 805,2 de um
 * quadro de 791,14 x 805,61), entao ele nao leva compensacao nenhuma. Ele
 * existe para as caixas pequenas — sidebar recolhida, favicon, avatar — onde o
 * lockup viraria uma palavra ilegivel de 4px de altura. Nao o use no lugar do
 * lockup numa caixa que comporta o lockup: o simbolo sozinho nao diz o nome.
 */

const FRAME_W = 2179.77;
const FRAME_H = 1642.83;
const INK_W = 1486.2;
const PAD_LEFT = 365.65;
const PAD_RIGHT = FRAME_W - PAD_LEFT - INK_W;
const PAD_TOP = 496.92;
const PAD_BOTTOM = 497.81;

const SOURCES = {
  // Palavra "freitas" em Navy Profundo: use sobre fundo claro.
  principal: '/logos/freitas-centrix-vertical-principal.svg',
  // Palavra "freitas" em branco: use sobre navy ou qualquer fundo escuro.
  negativo: '/logos/freitas-centrix-vertical-negativo.svg',
} as const;

const SIMBOLO_SRC = '/logos/freitas-centrix-simbolo-laranja.svg';
// viewBox do simbolo: 791.14 x 805.61 — levemente mais alto que largo.
const SIMBOLO_RATIO = 805.61 / 791.14;

interface BrandMarkProps {
  /**
   * Escolha pelo FUNDO, nao pelo contexto: claro -> principal, escuro ->
   * negativo. `simbolo` e por TAMANHO, nao por fundo — o laranja tem contraste
   * suficiente nos dois.
   */
  variant: keyof typeof SOURCES | 'simbolo';
  /** Largura da ARTE em px. No lockup a caixa fica com ~43,6% dessa altura. */
  width: number;
  className?: string;
}

export function BrandMark({ variant, width, className }: BrandMarkProps) {
  if (variant === 'simbolo') {
    return (
      <img
        src={SIMBOLO_SRC}
        alt="Freitas Centrix"
        className={cn('block max-w-none', className)}
        style={{ width, height: width * SIMBOLO_RATIO }}
      />
    );
  }

  const frameWidth = (width * FRAME_W) / INK_W;
  const frameHeight = (frameWidth * FRAME_H) / FRAME_W;

  return (
    <img
      // <img> puro, e nao next/image, de proposito: o otimizador do Next recusa
      // SVG sem `dangerouslyAllowSVG` no next.config, e vetor nao ganha nada
      // sendo reamostrado para avif/webp.
      src={SOURCES[variant]}
      alt="Freitas Centrix"
      className={cn('block max-w-none', className)}
      style={{
        width: frameWidth,
        height: frameHeight,
        marginLeft: -(frameWidth * PAD_LEFT) / FRAME_W,
        marginRight: -(frameWidth * PAD_RIGHT) / FRAME_W,
        marginTop: -(frameHeight * PAD_TOP) / FRAME_H,
        marginBottom: -(frameHeight * PAD_BOTTOM) / FRAME_H,
      }}
    />
  );
}
