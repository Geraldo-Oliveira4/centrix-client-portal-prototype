'use client';

import dynamic from 'next/dynamic';

// Só no cliente: validade e chegada são relativas ao DIA de quem abre a tela, e
// o servidor (UTC) e o navegador (BRT) discordam do dia entre 21h e meia-noite.
const ComparisonScreen = dynamic(() => import('./comparison-screen'), {
  ssr: false,
});

export default function ComparativoPage() {
  return <ComparisonScreen />;
}
