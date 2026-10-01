import type { Metadata } from 'next';

// /portal/admin é a camada INTERNA simulada (Freitas/Ionix). Só existe em build
// com NEXT_PUBLIC_PROTO_INTERNAL=1; fora dele, a rota é 404. Sempre noindex.
export const metadata: Metadata = {
  // Fora do build interno o título não pode nomear a ferramenta: a rota é 404.
  title:
    process.env.NEXT_PUBLIC_PROTO_INTERNAL === '1'
      ? 'Centrix · Gestão de acessos (simulada)'
      : 'Centrix',
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
