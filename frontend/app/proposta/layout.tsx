import type { ReactNode } from 'react';

// Public layout for the agent proposal portal.
// Intentionally does not inherit the app shell (no sidebar, no auth).
// The root layout still renders but SideNavbar skips /proposta/* routes.
export default function PropostaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background">
      {children}
    </div>
  );
}
