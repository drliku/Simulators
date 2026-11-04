/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark charcoal and forest green, as specified; coral is The Brain Maze accent.
        char: { 950: '#0e1110', 900: '#141816', 850: '#1a1f1c', 800: '#212823', 700: '#2c352f' },
        forest: { DEFAULT: '#4f9a5b', soft: '#8fd19a', deep: '#2f6b3a' },
        wolf: '#e5534b', deer: '#4c8eda', veg: '#58b368', coral: '#f37064',
        ink: { DEFAULT: '#e9ede8', muted: '#a3b0a6', faint: '#6f7d73' },
      },
      fontFamily: {
        display: ['Brain', '"Saira Semi Condensed"', 'sans-serif'],
        sans: ['Saira', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
