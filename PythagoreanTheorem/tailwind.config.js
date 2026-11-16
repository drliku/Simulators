/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // The Brain Maze site face (Poppins) for all UI text; the Brain logo font is not used for UI text.
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
        math: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['Poppins', 'system-ui', 'sans-serif'],
      },
      colors: {
        coral: {
          50: '#FEF3F1',
          100: '#FDE4E0',
          200: '#FAC6BF',
          DEFAULT: '#F78677',
          500: '#F78677',
          600: '#E67566',
          700: '#C2463A',
        },
        navy: '#304169',
        // Navy-tinted neutrals, mapped onto The Brain Maze site tokens (mist, line, muted, navy).
        slate: {
          50: '#F7F7FA',
          100: '#F0F3FA',
          200: '#E3E8F2',
          300: '#C4C8DA',
          400: '#9399B5',
          500: '#6B7C9E',
          600: '#56678C',
          700: '#304169',
          800: '#304169',
          900: '#232F5B',
        },
      },
      borderRadius: {
        lg: '10px',
        xl: '6px',
        '2xl': '10px',
        '3xl': '14px',
      },
      boxShadow: {
        soft: '0 1px 0 rgba(35, 47, 91, 0.04), 0 6px 18px -10px rgba(35, 47, 91, 0.18)',
        lift: '0 2px 0 rgba(35, 47, 91, 0.06), 0 12px 28px -14px rgba(35, 47, 91, 0.35)',
      },
    },
  },
  plugins: [],
};
