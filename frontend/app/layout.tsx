import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import '../styles/globals.css';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './context/auth/auth-context';
import SideNavbar from '@/components/side-navbar';
import { cn } from '@/lib/utils';
import { ToastProvider } from '@/components/toast-provider';
import { ThemeProvider } from '@/components/theme-provider';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Centrix',
  description: 'Dashboard',
  icons: {
    icon: '/circlecentrix.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={montserrat.variable} suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen w-full bg-background text-foreground flex flex-col md:flex-row overflow-y-auto overflow-x-hidden font-sans',
          montserrat.className,
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ToastProvider />
            <SideNavbar />
            <div className="flex-1 overflow-auto pt-14 md:pt-0 md:px-0 animate-fade-in">
              {children}
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
