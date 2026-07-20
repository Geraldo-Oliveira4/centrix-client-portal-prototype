import { ReactNode } from 'react';

export default function InboxLayout({ children }: { children: ReactNode }) {
  return <div className="p-8 w-full h-full flex flex-col">{children}</div>;
}
