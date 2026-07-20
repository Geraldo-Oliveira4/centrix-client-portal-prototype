import { ReactNode, Suspense } from 'react';

interface ResetPasswordProps {
  children: ReactNode;
}

export default async function ResetPasswordLayout({
  children,
}: ResetPasswordProps) {
  return <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>;
}
