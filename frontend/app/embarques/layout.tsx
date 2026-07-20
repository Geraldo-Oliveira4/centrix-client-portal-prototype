import { ReactNode } from 'react';

export default function EmbarquesLayout({ children }: { children: ReactNode }) {
  return <div className="p-8 w-full h-full">{children}</div>;
}
