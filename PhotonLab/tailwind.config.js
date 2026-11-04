/** @type {import('tailwindcss').Config} */
// Palette follows The Brain Maze logo: navy #243056 and coral #F37064.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b1022',
          900: '#10172f',
          850: '#151d3a',
          800: '#1b2446',
          700: '#243056',
          600: '#2f3d6b',
        },
        coral: {
          100: '#fde6e2',
          200: '#fbcdc6',
          300: '#f8a79d',
          400: '#f5897d',
          500: '#f37064',
          600: '#e2564a',
          700: '#bd4238',
        },
      },
      fontFamily: {
        display: ['Brain', 'Barlow Semi Condensed', 'Barlow', 'ui-sans-serif', 'sans-serif'],
        sans: ['Barlow', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
