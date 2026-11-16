/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The Brain Maze site look (thebrainmaze.com): white panels and navy text on a mist page, coral accents.
        // char-* is kept for the few dark details on the 3D view; forest-soft is the green used for text on white.
        char: { 950: '#0e1110', 900: '#141816', 850: '#1a1f1c', 800: '#212823', 700: '#2c352f' },
        navy: { DEFAULT: '#304169', deep: '#1e2a47' },
        mist: '#f0f3fa',
        line: '#e3e8f2',
        blush: '#fdf2f0',
        forest: { DEFAULT: '#4f9a5b', soft: '#3f8a4c', deep: '#2f6b3a' },
        wolf: '#d9473e', deer: '#4c8eda', veg: '#58b368',
        coral: { DEFAULT: '#f78677', hover: '#e67566' },
        ink: { DEFAULT: '#304169', muted: '#6b7c9e', faint: '#8d9ab5' },
      },
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 15px rgba(48, 65, 105, 0.10)',
      },
    },
  },
  plugins: [],
};
