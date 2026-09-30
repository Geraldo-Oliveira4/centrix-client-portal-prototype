'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { IntelligencePreview } from './components/intelligence-preview';
export default function InteligenciaLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Radar keeps its existing implementation and URL, with a separate sidebar entry.
  if (pathname.startsWith('/portal/inteligencia/radar')) return <>{children}</>;
  // Pagina continua em blocos desde 30/09/2026: a raiz abre no Executivo, e as
  // URLs antigas continuam levando ao bloco (e aba) equivalente.
  const initialSection = pathname.includes('/agentes')
    ? 'agentes'
    : pathname.includes('/performance')
      ? 'performance'
      : 'executivo';
  return <IntelligencePreview initialSection={initialSection} />;
}
