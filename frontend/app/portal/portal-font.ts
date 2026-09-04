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
 * Esta e a fonte do CORPO. Desde 04/09/2026 os TITULOS sao New Black, carregada
 * por `@font-face` em `styles/globals.css` (os .woff2 estao em `public/fonts/`)
 * e aplicada em `.portal-h1/h2/h3`. A Source Sans continua sendo o fallback
 * dessas tres classes, entao o titulo nunca fica invisivel se a New Black
 * falhar. A pendencia de marca que esta nota registrava foi fechada.
 */
export const portalFont = Source_Sans_3({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-source-sans',
  display: 'swap',
});
