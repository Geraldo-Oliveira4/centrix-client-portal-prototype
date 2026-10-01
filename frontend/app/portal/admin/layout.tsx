import type { Metadata } from 'next';

// /portal/admin é a camada INTERNA simulada (a Freitas), servida dentro do
// portal só porque o protótipo não tem Centrix interno. Fora de busca e de
// qualquer link do cliente; a página ainda exige o modo de demonstração.
export const metadata: Metadata = {
  title: 'Centrix · Gestão de acessos (simulada)',
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
