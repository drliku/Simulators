/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The Brain Maze site look (thebrainmaze.com): white cards and navy text on a mist page, coral accents.
        // space-* stays for the dark scene canvases; navy/mist/line are the light UI chrome.
        // Ship = brand coral, Earth = periwinkle; the *-soft shades are the darker variants used for text on white.
        space: { 950: '#0b1022', 900: '#101731', 850: '#161f3e', 800: '#1b2649', 700: '#243056' },
        navy: { DEFAULT: '#304169', deep: '#1e2a47' },
        mist: '#f0f3fa',
        line: '#e3e8f2',
        coral: { DEFAULT: '#f78677', hover: '#e67566' },
        earth: { DEFAULT: '#9fb0ff', soft: '#4a63c9', deep: '#6f86f0', light: '#c3cdff' },
        ship: { DEFAULT: '#f78677', soft: '#d9594e', deep: '#e67566', light: '#ffb4a8' },
        ink: { DEFAULT: '#304169', muted: '#6b7c9e', faint: '#8a97b4' },
      },
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 15px rgba(48, 65, 105, 0.10)',
        'card-hover': '0 8px 25px rgba(48, 65, 105, 0.15)',
      },
    },
  },
  plugins: [],
};
