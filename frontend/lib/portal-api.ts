// Axios instance for the Client Portal. Reads JWT from portalSession storage,
// transparently refreshes expired access tokens via /portal/auth/refresh-token,
// and redirects to /portal/login when refresh fails.
//
// WARNING: This interceptor mirrors the implementation in @arboria-tech/arboria-ui's
// createApiClient. Any 401/refresh-token bugfix must be applied here AND in the lib.
// When createApiClient supports configurable session + loginPath, replace this file
// with a thin wrapper (see frontend/lib/axios-config.ts).
//
// MODO OFFLINE: this instance is also the ONLY place where the portal's data
// source switches between the API and the demo fixtures (`lib/offline/`). Before
// the first request the health check (a DB-backed route) decides the mode for
// the session; while offline every request is answered by `offlineAdapter`, and
// any request that fails by network, 4 s timeout or 5xx switches over and is
// replayed there. 4xx answers from a live API are never masked.

import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { portalSession } from './portal-session';
import { offlineAdapter } from './offline/offline-adapter';
import { installOfflineFallback } from './offline/install-fallback';
import { REQUEST_TIMEOUT_MS } from './offline/offline-mode';
import { ensureDataMode, getOfflineStatus, markOffline } from './offline/offline-store';

const portal_api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API,
  // Acima de 4 s a chamada conta como servidor indisponivel (lib/offline/).
  timeout: REQUEST_TIMEOUT_MS,
});

const decodeJwtExp = (token: string): number | null => {
  try {
    const [, payload] = token.split('.');
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64));
    return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
};

let isRefreshing = false;
let pendingRequests: ((token: string | null) => void)[] = [];

const subscribe = (cb: (token: string | null) => void) => {
  pendingRequests.push(cb);
};

const drain = (token: string | null) => {
  const callbacks = pendingRequests;
  pendingRequests = [];
  callbacks.forEach((cb) => cb(token));
};

const redirectToLogin = () => {
  portalSession.clear();
  if (
    typeof window !== 'undefined' &&
    !window.location.pathname.startsWith('/portal/login')
  ) {
    window.location.href = '/portal/login';
  }
};

const refreshAccessToken = async (): Promise<string | null> => {
  const session = portalSession.get();
  if (!session?.refreshToken) return null;

  try {
    const response = await axios.post<{ access_token: string; id_token: string }>(
      `${process.env.NEXT_PUBLIC_API}/portal/auth/refresh-token`,
      { refresh_token: session.refreshToken },
    );
    const { access_token, id_token } = response.data;
    const expiresAt = decodeJwtExp(id_token) ?? Date.now() + 3600_000;
    portalSession.set({
      ...session,
      accessToken: access_token,
      idToken: id_token,
      expiresAt,
    });
    return access_token;
  } catch {
    return null;
  }
};

portal_api.interceptors.request.use((config) => {
  const session = portalSession.get();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

portal_api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (error.response?.status !== 401 || !original || original._retry) {
      if (error.response?.status === 401) redirectToLogin();
      return Promise.reject(error);
    }

    // The refresh endpoint itself returning 401 means the refresh token is dead.
    if (original.url?.includes('/portal/auth/refresh-token')) {
      redirectToLogin();
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribe((token) => {
          if (!token) {
            reject(error);
            return;
          }
          original.headers = original.headers ?? {};
          (original.headers as Record<string, string>).Authorization = `Bearer ${token}`;
          resolve(portal_api(original));
        });
      });
    }

    isRefreshing = true;
    try {
      const newToken = await refreshAccessToken();
      drain(newToken);
      if (!newToken) {
        redirectToLogin();
        return Promise.reject(error);
      }
      original.headers = original.headers ?? {};
      (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
      return portal_api(original);
    } finally {
      isRefreshing = false;
    }
  },
);

// Registered after the 401 handler: response interceptors run in order, so a
// 401 is refreshed first and only what is still failing reaches the fallback.
installOfflineFallback(portal_api, {
  ensureMode: ensureDataMode,
  getStatus: getOfflineStatus,
  markOffline,
  adapter: offlineAdapter,
});

export default portal_api;
