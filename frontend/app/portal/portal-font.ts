import { Source_Sans_3 } from 'next/font/google';

/**
 * Fonte do Portal do Cliente — Source Sans 3 (Brand System v1.0).
 *
 * MORA NUM MODULO PROPRIO, e nao em `layout.tsx`, por duas razoes:
 *
 *   1. `app/portal/layout.tsx` e `'use client'`, e os font loaders do
 *      `next/font` nao podem ser chamados de dentro de um Client Component.
 *      Aqui o loader roda em tempo de build e o que atravessa para o cliente e
 *      so um objeto com strings de classe.
 *   2. A troca de fonte e ESCOPADA. `app/layout.tsx` (raiz) continua em
 *      Montserrat porque serve tambem as telas de Analista, que estao migrando
 *      numa branch separada — trocar a fonte na raiz mudaria aquelas telas sem
 *      que ninguem tivesse pedido.
 *
 * O guia de marca pede New Black nos titulos; ela ainda nao tem arquivo de
 * fonte licenciado, entao titulo e corpo dividem a Source Sans 3 por enquanto.
 * Isso e uma pendencia de marca em aberto, nao um descuido — a mesma nota que
 * valia para a Avenir no guia anterior.
 */
export const portalFont = Source_Sans_3({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-source-sans',
  display: 'swap',
});
