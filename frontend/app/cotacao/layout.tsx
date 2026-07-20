import { ReactNode } from 'react';

export default function CotacaoLayout({ children }: { children: ReactNode }) {
  return <div className="p-8 w-full h-full">{children}</div>;
}
