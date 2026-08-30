/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sow: {
          50:  '#f0faf9',
          100: '#d0f0ec',
          200: '#a2e0d9',
          300: '#6acac1',
          400: '#38afa5',
          500: '#1a8f86',   // teal principal
          600: '#157470',   // teal sidebar ativo
          700: '#105c59',
          800: '#0c4543',
          900: '#082e2c',
          950: '#041918',
        },
        gold: {
          300: '#e8c97a',
          400: '#d9b355',
          500: '#c4902a',   // dourado SOW
          600: '#a87520',
          700: '#8a5c18',
        },
        dark: {
          50:  '#f4f4f4',
          100: '#e8e8e8',
          200: '#d0d0d0',
          300: '#b0b0b0',
          400: '#888888',
          500: '#666666',
          600: '#444444',
          700: '#2a2a2a',
          800: '#1a1a1a',
          900: '#0d0d0d',   // fundo escuro SOW
          950: '#080808',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
