import nextDynamic from 'next/dynamic';
import { notFound } from 'next/navigation';

// /portal/admin/acessos — gestão de acessos, conceito INTERNO (Freitas/Ionix).
// Existe só em build com NEXT_PUBLIC_PROTO_INTERNAL=1 (escopo Preview da
// Vercel). Sem a variável — produção, e o padrão de qualquer build — a rota é
// 404 e o componente não entra no bundle: a condição é inline para o
// compilador resolvê-la. No produto real esta tela mora no Centrix interno
// (modal de DNA), não no portal do cliente.
const AccessManagement =
  process.env.NEXT_PUBLIC_PROTO_INTERNAL === '1'
    ? nextDynamic(() => import('./access-management'))
    : null;

// Renderizada a cada pedido: um 404 decidido no build viraria HTML estático
// servido com status 200.
export const dynamic = 'force-dynamic';

export default function AccessManagementRoute() {
  if (!AccessManagement) notFound();
  return <AccessManagement />;
}
