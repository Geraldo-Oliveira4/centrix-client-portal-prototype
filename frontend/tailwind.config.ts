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
      },
    },
  },
} satisfies Config;

export default config;
