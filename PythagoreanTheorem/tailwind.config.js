/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // "Brain" is used when installed; any glyph it lacks falls back per-character.
        sans: ['Saira', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Brain', '"Saira Semi Condensed"', 'Saira', 'ui-sans-serif', 'sans-serif'],
        // Brain is caps-only, so math (a, b, c) uses Saira to keep variables lowercase.
        math: ['"Saira Semi Condensed"', 'Saira', 'ui-sans-serif', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        coral: {
          50: '#FEF3F1',
          100: '#FDE4E0',
          200: '#FAC6BF',
          DEFAULT: '#F37367',
          500: '#F37367',
          600: '#E25A4D',
          700: '#C2463A',
        },
        navy: '#232F5B',
        // Navy-tinted neutrals so every grey in the UI leans toward the brand navy.
        slate: {
          50: '#F7F7FA',
          100: '#EEEFF5',
          200: '#DEE0EA',
          300: '#C4C8DA',
          400: '#9399B5',
          500: '#6B7299',
          600: '#4D557D',
          700: '#39416A',
          800: '#2A3360',
          900: '#232F5B',
        },
      },
      borderRadius: {
        lg: '4px',
        xl: '6px',
        '2xl': '6px',
        '3xl': '8px',
      },
      boxShadow: {
        soft: '0 1px 0 rgba(35, 47, 91, 0.04), 0 6px 18px -10px rgba(35, 47, 91, 0.18)',
        lift: '0 2px 0 rgba(35, 47, 91, 0.06), 0 12px 28px -14px rgba(35, 47, 91, 0.35)',
      },
    },
  },
  plugins: [],
};
