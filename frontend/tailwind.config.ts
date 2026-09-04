import baseConfig from '@arboria-tech/arboria-config/tailwind/base.config';
import type { Config } from 'tailwindcss';

const config = {
  ...baseConfig,
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    // types/ holds class-name maps (e.g. ESTADO_BADGE_CLASS in
    // types/portal-shipment.ts). Without this glob Tailwind never sees them and
    // silently purges the classes — the shipment state badges rendered
    // colourless until this was added.
    './types/**/*.{ts,tsx}',
    './node_modules/@arboria-tech/arboria-ui/dist/*.{js,mjs}',
  ],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseConfig.theme?.extend,
      backgroundImage: {
        ...(baseConfig.theme?.extend?.backgroundImage as Record<string, string>),
        'mountain-motif': 'url("/assets/images/mountain.svg")',
      },
      colors: {
        ...(baseConfig.theme?.extend?.colors as Record<string, unknown>),
        // Freitas Centrix brand palette (Brand System v1.0). Same colours as
        // --navy / --indigo / --orange in globals.css, which is where the CSS
        // variables live; these tokens are the Tailwind-class spelling of the
        // very same hexes. If one side changes, change both.
        //
        // The 2024 magenta is GONE from the portal. `brand-pink` and
        // `brand-gold` survive only for the analyst screens outside /portal and
        // /proposta-cliente, which are migrating on a separate branch; nothing
        // under those two routes may reference them.
        'brand-navy': '#1A1C31', // Navy Profundo — dark surface + body ink
        'brand-mist': '#F4F5FA', // Cinza Nevoa — light structural surface
        'brand-pink': '#ce0f69', // RETIRED — analyst screens only
        'brand-gold': '#ff9e1b', // RETIRED — analyst screens only
        // Indigo is the brand colour: headings, links, secondary buttons,
        // icons. 12.5:1 on white, so it is the ink the retired pink used to be.
        //
        // Tres chaves desta rampa sao THEME-AWARE desde a Fase 2 do dark mode
        // (DEFAULT, 800 e 100); as demais sao a rampa fixa e continuam hex.
        // Elas viraram var pelo mesmo motivo do semaforo abaixo: sao as
        // spellings SEMANTICAS do indigo no portal (tinta, borda de enfase,
        // superficie-2), e no escuro o indigo de luz da 1.20:1 — 33 tintas e 30
        // bordas invisiveis. Nenhuma das ~80 chamadas mudou.
        //
        //   DEFAULT / 800 -> --indigo         luz #2C2E65  escuro indigo-300
        //   100           -> --brand-indigo-surface
        //                                     luz #EAECFC  escuro indigo-800
        //
        // 800 e DEFAULT sao o MESMO hex na luz e o mesmo papel: `text-*` e a
        // tinta, `border-*` e a borda de enfase (aba ativa, chip selecionado).
        // Se algum dia precisarem divergir, separe em duas vars — nao devolva
        // hex literal, que e o que quebrava no escuro.
        'brand-indigo': {
          DEFAULT: 'hsl(var(--indigo) / <alpha-value>)',
          950: '#1A1C31',
          900: '#22244D',
          800: 'hsl(var(--indigo) / <alpha-value>)',
          700: '#464A78',
          600: '#686A9A',
          500: '#898CBB',
          400: '#A4A6D5',
          300: '#C1C3F3',
          200: '#D7D9FB',
          100: 'hsl(var(--brand-indigo-surface) / <alpha-value>)',
          50: '#F4F5FA',
        },
        // Orange is the CTA and the focus ring, and it is a CEILING of ~10% of
        // the composition, not a target. Text ON orange is always brand-navy
        // (7.7:1). Orange AS text on white is 2.2:1 and is forbidden — the
        // accessible spelling is brand-orange-800 #7A4407 (7.9:1).
        'brand-orange': {
          DEFAULT: '#F59C27',
          800: '#7A4407',
          700: '#A85E0A',
          600: '#DD8803',
          500: '#F59C27',
          400: '#FEB93C',
          300: '#FDC959',
          200: '#FDDB96',
          100: '#FDE8B8',
          50: '#FDF1D9',
        },
        // Client Portal semantic palette — STATE only, never actions. Actions
        // live on --primary (the orange CTA surface) and ink lives on
        // brand-indigo; the semáforo is a separate system and stays separate.
        //
        // These are NOT brand colours and are deliberately not aligned to the
        // brand guide. portal-warning is #C98A00, not the brand orange
        // #F59C27, so "atenção" can never be read as a branded surface. That
        // distance is now the whole point: the previous #FF9500 sat ONE degree
        // of hue from #F59C27 and the two had become the same colour to the
        // eye. Do not "fix" them towards the palette above.
        //
        // Os seis sao CSS var desde a Fase 2 do dark mode. Os valores de luz nao
        // mudaram — sao os mesmos hex que estavam aqui, agora declarados em
        // `:root` no globals.css, com override no bloco `.dark, .fc-dark`. O
        // `<alpha-value>` e o que preserva os modificadores `/8`, `/10`, `/25`,
        // `/30` das 581 chamadas, nenhuma das quais mudou.
        //
        // Onde ler cada valor: `styles/globals.css`, blocos `:root` e `.dark`.
        // Nao devolva hex literal aqui — foi o que impediu o portal inteiro de
        // ter tema escuro.
        'portal-success': 'hsl(var(--portal-success) / <alpha-value>)',
        // attention / waiting — dot and badge fill
        'portal-warning': 'hsl(var(--portal-warning) / <alpha-value>)',
        // Same meaning as portal-warning, at text contrast. #C98A00 on white is
        // 2.95:1 and fails AA for copy; the light value is 5.4:1. Use it ONLY
        // where the warning is TEXT, never for the dot — two tones for one state
        // is the price of the semáforo staying legible on WHITE. No escuro a
        // regra se inverte e o token colapsa em --portal-warning (o ink e que
        // reprova la); a distincao continua existindo em codigo para nao
        // reescrever 38 chamadas.
        'portal-warning-ink': 'hsl(var(--portal-warning-ink) / <alpha-value>)',
        // critical / blocked / divergent
        'portal-danger': 'hsl(var(--portal-danger) / <alpha-value>)',
        // in progress, no action required
        'portal-info': 'hsl(var(--portal-info) / <alpha-value>)',
        // secondary metadata (indigo-600 na luz, indigo-400 no escuro)
        'portal-neutral': 'hsl(var(--portal-neutral) / <alpha-value>)',
        // Fundo da pagina atras dos cards: Cinza Nevoa #F4F5FA na luz, Navy
        // Profundo no escuro. NAO e `--background`, que e branco puro na luz —
        // trocar um pelo outro apagaria o canvas justamente no tema em que ele
        // faz o trabalho de dar profundidade ao card branco.
        'portal-canvas': 'hsl(var(--portal-canvas) / <alpha-value>)',
      },
    },
  },
} satisfies Config;

export default config;
