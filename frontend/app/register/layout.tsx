import { ReactNode } from 'react';

interface RegisterLayoutProps {
  children: ReactNode;
}

export default async function RegisterLayout({
  children,
}: RegisterLayoutProps) {
  return <>{children}</>;
}
