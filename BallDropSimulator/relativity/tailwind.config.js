/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The Brain Maze: coral #F37064 on navy #243056. Ship = brand coral, Earth = periwinkle from the navy family.
        space: { 950: '#0b1022', 900: '#101731', 850: '#161f3e', 800: '#1b2649', 700: '#243056' },
        earth: { DEFAULT: '#9fb0ff', soft: '#c3cdff', deep: '#6f86f0' },
        ship: { DEFAULT: '#f37064', soft: '#ffb4a8', deep: '#e0564a' },
        ink: { DEFAULT: '#f6efea', muted: '#a3acc9', faint: '#737ea3' },
      },
      fontFamily: {
        display: ['Brain', '"Saira Semi Condensed"', '"Arial Narrow"', 'sans-serif'],
        sans: ['Saira', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glass: '0 18px 50px rgba(5, 8, 22, 0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
      },
    },
  },
  plugins: [],
};
