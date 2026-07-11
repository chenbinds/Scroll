import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/src/**/*.{ts,tsx}', './src/renderer/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        scroll: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#748ffc',
          500: '#5c7cfa',
          600: '#4c6ef5',
          700: '#4263eb',
          800: '#3b5bdb',
          900: '#364fc7'
        }
      },
      fontFamily: {
        reader: ['Georgia', 'Noto Serif SC', 'serif'],
        ui: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config
