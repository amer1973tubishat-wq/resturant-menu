import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand, carried over from the public site so the two read as one product
        char: { 900: '#0A0A0B', 800: '#101012', 700: '#16161A', 600: '#1E1E24', 500: '#2A2A31' },
        flame: { DEFAULT: '#FF6A1A', deep: '#E8500A' },
        gold: { DEFAULT: '#F2B33D', deep: '#C98A16' },
        jo: { red: '#CE1126', hi: '#E5203A' },
        cream: { DEFAULT: '#F4EFE6', dim: '#C9C2B6' },
        line: 'rgb(var(--line) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        surface2: 'rgb(var(--surface2) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Anton', 'Impact', 'sans-serif'],
        sans: ['var(--font-sans)', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up .4s cubic-bezier(.22,1,.36,1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
