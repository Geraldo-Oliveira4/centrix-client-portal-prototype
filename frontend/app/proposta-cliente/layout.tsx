import type { ReactNode } from 'react';
import { Source_Sans_3 } from 'next/font/google';

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-source-sans',
  display: 'swap',
});

// Public layout for the client proposal portal.
// Does not inherit the app shell (no sidebar, no auth).
// The root layout still renders but SideNavbar skips /proposta-cliente/* routes.
export default function PropostaClienteLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`fc-brand-scope min-h-screen w-full bg-background ${sourceSans.variable} font-[family-name:var(--font-source-sans)]`}>
      {children}
    </div>
  );
}
