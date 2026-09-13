'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { IntelligencePreview } from './components/intelligence-preview';
export default function InteligenciaLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Radar keeps its existing implementation and URL, with a separate sidebar entry.
  if (pathname.startsWith('/portal/inteligencia/radar')) return <>{children}</>;
  const initialSection = pathname.includes('/agentes') ? 'agentes' : pathname.includes('/executivo') ? 'relatorios' : 'performance';
  return <IntelligencePreview initialSection={initialSection} />;
}
