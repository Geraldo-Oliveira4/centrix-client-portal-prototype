// Lightweight session manager for the Client Portal. Kept independent from
// the internal session (lib/session.ts) so analyst and customer can be
// signed in simultaneously in the same browser without overwriting each
// other.

import { PORTAL_SESSION_KEY } from './portal-session-key';

export interface PortalSession {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    sub: string;
    email: string;
    name: string;
  };
}

const isClient = () => typeof window !== 'undefined';

// PROTOTYPE: there is no Cognito. The local backend auto-logs-in as the seeded
// demo client regardless of the token, so the frontend always presents a demo
// session. This keeps the login screen viewable but never required.
const DEMO_SESSION: PortalSession = {
  accessToken: 'prototype-fake-token',
  idToken: 'prototype-fake-token',
  refreshToken: 'prototype-fake-token',
  expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365,
  user: {
    sub: 'demo-portal-user-sub',
    email: 'demo@cliente.local',
    name: 'Cliente Demo',
  },
};

export const portalSession = {
  get(): PortalSession | null {
    if (!isClient()) return DEMO_SESSION;
    const raw = window.localStorage.getItem(PORTAL_SESSION_KEY);
    if (!raw) return DEMO_SESSION;
    try {
      return JSON.parse(raw) as PortalSession;
    } catch {
      return DEMO_SESSION;
    }
  },

  set(value: PortalSession): void {
    if (!isClient()) return;
    window.localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(value));
    // Cookie is informational — middleware can read it to redirect unauthenticated
    // users back to /portal/login. Value is just a presence flag; tokens never leave
    // localStorage. max-age is synced with the token's real expiresAt so the cookie
    // cannot survive an expired token.
    const maxAge = Math.max(
      0,
      Math.floor((value.expiresAt - Date.now()) / 1000),
    );
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${PORTAL_SESSION_KEY}=1; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
  },

  clear(): void {
    if (!isClient()) return;
    window.localStorage.removeItem(PORTAL_SESSION_KEY);
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${PORTAL_SESSION_KEY}=; path=/; max-age=0; SameSite=Lax${secure}`;
  },

  isAuthenticated(): boolean {
    // PROTOTYPE: always authenticated (see DEMO_SESSION above).
    return true;
  },
};
