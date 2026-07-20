import { ReactNode } from 'react';

interface HomeLayoutProps {
  children: ReactNode;
}

export default async function HomeLayout({ children }: HomeLayoutProps) {
  return <div className="px-8 w-full h-full flex flex-col">{children}</div>;
}
