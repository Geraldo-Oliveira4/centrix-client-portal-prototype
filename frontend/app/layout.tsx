import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import '../styles/globals.css';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './context/auth/auth-context';
import SideNavbar from '@/components/side-navbar';
import { cn } from '@/lib/utils';
import { ToastProvider } from '@/components/toast-provider';
import { ScopedThemeProvider } from '@/components/scoped-theme-provider';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Centrix',
  description: 'Dashboard',
  icons: {
    // Simbolo laranja em vetor (Brand System v1.0). Substitui
    // '/circlecentrix.png', que NAO existia em public/ — o favicon vinha
    // dando 404 desde antes desta migracao.
    icon: '/logos/freitas-centrix-simbolo-laranja.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={montserrat.variable} suppressHydrationWarning>
      <head>
        {/* So o SemiBold e pre-carregado: e o peso dos titulos (.portal-h1/h2/h3)
            e portanto o unico que aparece na primeira dobra da Home. O Medium
            fica para o carregamento normal do @font-face. `crossOrigin` e
            obrigatorio mesmo sendo mesma origem — sem ele o preload nao casa
            com o fetch CORS da fonte e o arquivo desce duas vezes. */}
        <link
          rel="preload"
          href="/fonts/NewBlackTypeface-SemiBold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={cn(
          'min-h-screen w-full bg-background text-foreground flex flex-col md:flex-row overflow-y-auto overflow-x-hidden font-sans',
          montserrat.className,
        )}
      >
        <ScopedThemeProvider>
          <AuthProvider>
            <ToastProvider />
            <SideNavbar />
            <div className="flex-1 overflow-auto pt-14 md:pt-0 md:px-0 animate-fade-in">
              {children}
            </div>
          </AuthProvider>
        </ScopedThemeProvider>
      </body>
    </html>
  );
}
