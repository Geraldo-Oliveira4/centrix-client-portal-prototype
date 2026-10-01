import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { SESSION_KEY } from '@/lib/session-key';
import { PORTAL_SESSION_KEY } from '@/lib/portal-session-key';

function getRolesFromRequest(request: NextRequest): string[] | null {
  const sessionStr = request.cookies.get(SESSION_KEY)?.value;
  if (!sessionStr) return null;
  try {
    const session = JSON.parse(decodeURIComponent(sessionStr));
    const tokenParts = session.accessToken.split('.');
    if (tokenParts.length !== 3) return null;
    const base64 = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return payload['cognito:groups'] || [];
  } catch {
    return null;
  }
}

function hasPortalSession(request: NextRequest): boolean {
  // Portal cookie is a presence flag (value "1"). Token lives in localStorage,
  // not in the cookie — so middleware can only check existence, not validity.
  return Boolean(request.cookies.get(PORTAL_SESSION_KEY)?.value);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // PROTOTYPE: portal routes are not gated here — the app auto-logs-in as the
  // demo client (see lib/portal-session.ts), so there is no cookie to check.
  // The original cookie-based gate is intentionally disabled.
  void hasPortalSession;

  // Ferramentas INTERNAS do protótipo (gestão de acessos): fora de um build com
  // NEXT_PUBLIC_PROTO_INTERNAL=1, /portal/admin responde como uma URL que não
  // existe — mesmo corpo e mesmo status 404 — antes de qualquer renderização. A
  // página também se recusa a renderizar (admin/acessos/page.tsx); este é o
  // ponto que garante o STATUS, que o layout do portal (client, em streaming)
  // já não consegue trocar.
  if (
    pathname.startsWith('/portal/admin') &&
    process.env.NEXT_PUBLIC_PROTO_INTERNAL !== '1'
  ) {
    return NextResponse.rewrite(new URL('/_rota-inexistente', request.url));
  }

  // Rotas que precisam de admin OU manager
  const managerRoutes = ['/users', '/pre-registered-users'];

  // Rotas que precisam apenas de admin
  const adminOnlyRoutes = ['/logs'];

  // Verificar rotas de manager
  if (managerRoutes.includes(pathname)) {
    const roles = getRolesFromRequest(request);

    if (!roles) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (!roles.includes('admin') && !roles.includes('manager')) {
      return NextResponse.redirect(new URL('/home', request.url));
    }
  }

  // Verificar rotas admin-only
  if (adminOnlyRoutes.includes(pathname)) {
    const roles = getRolesFromRequest(request);

    if (!roles) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (!roles.includes('admin')) {
      return NextResponse.redirect(new URL('/home', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/users', '/logs', '/pre-registered-users', '/portal/:path*'],
};
