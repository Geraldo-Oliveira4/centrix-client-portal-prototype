import { redirect } from 'next/navigation';

/**
 * Rota antiga, mantida como redirect. "Meus Agentes" deixou de ser item de
 * primeiro nivel da sidebar em 26/08/2026 e passou a ser uma aba de Minhas
 * Preferencias (telas de cadastro/configuracao juntas, separadas das
 * operacionais). Links diretos e favoritos apontando para ca continuam
 * funcionando — nao remova sem saber que ninguem mais chega por este caminho.
 */
export default function PortalAgentesRedirectPage() {
  redirect('/portal/preferencias/agentes');
}
