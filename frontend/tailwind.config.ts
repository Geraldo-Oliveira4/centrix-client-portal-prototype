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
        'brand-navy': '#2c2d65',
        'brand-pink': '#ce0f69',
        'brand-gold': '#ff9e1b',
        // Client Portal semantic palette — STATE only, never actions. Actions
        // and links stay on the brand pink (--primary) so the portal keeps
        // reading as Centrix. Additive: no existing class changes meaning, so
        // the analyst screens are untouched.
        'portal-success': '#00B050', // concluded / approved
        'portal-warning': '#FF9500', // attention / waiting
        'portal-danger': '#FF3B30', // critical / blocked / divergent
        'portal-info': '#2E5CFF', // in progress, no action required
        'portal-neutral': '#8E8E93', // secondary metadata
        'portal-canvas': '#F5F5F7', // page background behind white cards
      },
    },
  },
} satisfies Config;

export default config;
