/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './index.ts', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#8B1A1A',
          'red-light': '#A11F1F',
          'red-dark': '#6B1212',
          gold: '#C9A227',
          'gold-light': '#D4AF37',
          'gold-dark': '#A8861F',
        },
        surface: {
          light: '#FFFFFF',
          muted: '#F7F5F2',
          dark: '#1A1212',
          'dark-elevated': '#241818',
        },
        ink: {
          light: '#1A1212',
          muted: '#6B5E5E',
          dark: '#F7F5F2',
          'dark-muted': '#C4B8B8',
        },
      },
    },
  },
  plugins: [],
};
