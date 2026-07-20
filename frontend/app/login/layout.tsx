import { ReactNode } from 'react';

interface LoginLayoutProps {
  children: ReactNode;
}

export default async function LoginLayout({ children }: LoginLayoutProps) {
  return <>{children}</>;
}
