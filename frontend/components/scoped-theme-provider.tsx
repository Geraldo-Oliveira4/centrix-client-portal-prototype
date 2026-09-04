'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { ThemeProvider } from '@/components/theme-provider';

/**
 * Um provider de tema, DOIS escopos de persistencia.
 *
 * POR QUE NAO E UM PROVIDER ANINHADO DENTRO DE `app/portal/layout.tsx`:
 * o `ThemeProvider` do next-themes 0.4.6 e um no-op quando ja existe um acima
 * dele. O export e literalmente
 *
 *     ThemeProvider = props => useContext(ctx)
 *       ? <>{props.children}</>          // ignora TODAS as props
 *       : <Theme {...props} />
 *
 * ou seja, um `<ThemeProvider storageKey="portal:theme">` dentro do portal
 * renderizaria os filhos e jogaria fora a chave — o portal continuaria gravando
 * em `theme`, junto com as telas do analista, sem nenhum aviso em runtime. Nao
 * ha API publica para aninhar; e guarda deliberada da biblioteca.
 *
 * O QUE ESTE COMPONENTE FAZ: mantem UM provider (o da raiz, servindo o
 * analista exatamente como antes) e troca a `storageKey` conforme a rota. A
 * troca precisa do `key` do React: `storageKey` so e lida no inicializador do
 * `useState` e e capturada pelo `setTheme` memoizado — mudar a prop sem
 * remontar faria o portal LER a chave certa e ESCREVER na errada.
 *
 * Custo, e e o unico: atravessar a fronteira /portal <-> analista remonta a
 * subarvore uma vez. Dentro de cada escopo o `key` nao muda e nao ha remontagem
 * nenhuma. O cache do SWR e de modulo, entao a remontagem revalida, nao perde
 * dado.
 *
 * `/proposta-cliente` fica no escopo do analista de proposito: e pagina publica,
 * sem sessao e sem toggle, e a Fase 2 do dark mode nao a cobre.
 */
const PORTAL_PREFIX = '/portal';
const PORTAL_STORAGE_KEY = 'portal:theme';
const APP_STORAGE_KEY = 'theme';

export function ScopedThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPortal =
    pathname === PORTAL_PREFIX || (pathname?.startsWith(PORTAL_PREFIX + '/') ?? false);

  return (
    <ThemeProvider
      key={isPortal ? 'portal' : 'app'}
      attribute="class"
      defaultTheme="light"
      // A fonte oficial do Brand System descartou `prefers-color-scheme` como
      // mecanismo: o tema e escolha explicita por classe de conteiner. Com
      // `enableSystem`, o valor resolvido passaria a depender do SO.
      enableSystem={false}
      disableTransitionOnChange
      storageKey={isPortal ? PORTAL_STORAGE_KEY : APP_STORAGE_KEY}
    >
      {children}
    </ThemeProvider>
  );
}
