/** @type {import('tailwindcss').Config} */
// Palette: The Brain Maze site tokens (thebrainmaze.com): white panels, navy text, coral accents.
// The optics canvas keeps its own dark drawing (src/render/renderer.ts).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bm: {
          navy: '#304169',
          'navy-deep': '#1e2a47',
          coral: '#f78677',
          'coral-hover': '#e67566',
          'coral-text': '#d9594e', // coral dark enough for small text on white
          blush: '#fdf2f0',
          mist: '#f0f3fa',
          line: '#e3e8f2',
          slate: '#3d4f7c',
          muted: '#6b7c9e',
          faint: '#8a97b4',
          pale: '#a5b0c8',
        },
      },
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
        sans: ['Poppins', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        // numeric readouts use Poppins with tabular figures (see index.css)
        mono: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        bm: '0 4px 15px rgba(48, 65, 105, 0.10)',
        'bm-hover': '0 8px 25px rgba(48, 65, 105, 0.15)',
        'bm-float': '0 8px 24px rgba(0, 0, 0, 0.25)', // cards floating over the dark canvas
      },
    },
  },
  plugins: [],
};
