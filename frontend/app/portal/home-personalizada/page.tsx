import { redirect } from 'next/navigation';

/**
 * `/portal/home-personalizada` deixou de existir como tela propria em
 * 11/09/2026: a Home personalizavel SUBSTITUIU a Home fixa, e o conteudo mudou
 * para `app/portal/home/`.
 *
 * Redirect e nao remocao porque a rota chegou a ser servida em producao e foi
 * divulgada por URL (ela nunca esteve na sidebar — quem a conhecia so tinha o
 * link). Um 404 em cima de um link que alguem guardou leria como "a frente foi
 * cancelada", que e o oposto do que aconteceu.
 *
 * Server Component de uma linha, sem `'use client'`: o redirect acontece antes
 * de qualquer JS chegar ao navegador.
 */
export default function PortalHomePersonalizadaRedirect() {
  redirect('/portal/home');
}
