import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        dark: {
          bg: '#0F1117',
          surface: '#1A1D27',
          border: '#2A2D3A',
        },
        primary: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
        },
        success: {
          DEFAULT: '#22C55E',
          light: '#4ADE80',
          dark: '#052E16',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          dark: '#451A03',
        },
        danger: {
          DEFAULT: '#EF4444',
          light: '#F87171',
          dark: '#450A0A',
        },
        text: {
          primary: '#F1F5F9',
          muted: '#94A3B8',
        },
      },
    },
  },
  plugins: [],
}

export default config
