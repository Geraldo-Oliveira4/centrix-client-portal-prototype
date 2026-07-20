import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SESSION_KEY } from '@/lib/session-key';

interface PrivateLayoutProps {
  children: ReactNode;
}

function decodeJWT(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

function getSessionFromCookie() {
  const cookieStore = cookies();
  const sessionStr = cookieStore.get(SESSION_KEY)?.value;

  if (!sessionStr) {
    return null;
  }

  try {
    const session = JSON.parse(decodeURIComponent(sessionStr));
    const payload = decodeJWT(session.accessToken);

    return {
      user: {
        roles: payload['cognito:groups'] || [],
      },
    };
  } catch {
    return null;
  }
}

export default async function PrivateLayout({ children }: PrivateLayoutProps) {
  const session = getSessionFromCookie();

  if (!session) {
    redirect('/login');
  }

  const userRoles = (session.user?.roles as string[]) || [];
  const isAdminOrManager =
    userRoles.includes('admin') || userRoles.includes('manager');

  if (!isAdminOrManager) {
    redirect('/home');
  }

  return <div className="p-8 w-full h-full">{children}</div>;
}
