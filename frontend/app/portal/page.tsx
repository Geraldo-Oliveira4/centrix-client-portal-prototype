import { redirect } from 'next/navigation';

/**
 * Raiz do Portal do Cliente. A tela é a Home, que vive em `/portal/home` e não
 * aqui: a regra de item ativo da sidebar é `pathname.startsWith(href + '/')`, e
 * um item cujo href fosse `/portal` ficaria aceso em todas as telas do portal.
 *
 * Mesmo padrão de `inteligencia/page.tsx`.
 */
export default function PortalRootPage() {
  redirect('/portal/home');
}
