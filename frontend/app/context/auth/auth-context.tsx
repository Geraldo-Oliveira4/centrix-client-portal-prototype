'use client';

import React from 'react';
import { AuthProvider as BaseAuthProvider } from '@arboria-tech/arboria-ui';
import base_api from '@/lib/axios-config';
import { session } from '@/lib/session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BaseAuthProvider
    sessionManager={session}
    apiClient={base_api}
    postLoginRedirect="/home"
    publicRoutes={['/confirm-email', '/proposta', '/portal']}
  >
    {children}
  </BaseAuthProvider>
);
