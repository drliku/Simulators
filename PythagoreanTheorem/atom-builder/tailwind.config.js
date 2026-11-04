/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // The Brain Maze display face (caps-only); missing glyphs fall back to Saira.
        sans: ['Saira', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Brain', '"Saira Semi Condensed"', 'Saira', 'ui-sans-serif', 'sans-serif'],
        // Chemistry symbols (Na, Fe, p⁺) need lowercase letters, which Brain doesn't have.
        math: ['"Saira Semi Condensed"', 'Saira', 'ui-sans-serif', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Dark scale built around The Brain Maze navy (#232F5B).
        lab: {
          950: '#0f1430',
          900: '#161d3f',
          850: '#1b2349',
          800: '#1f2852',
          700: '#232f5b',
          600: '#34427a',
          500: '#4c5b96',
          400: '#7884b8',
          300: '#a6b0d8',
          200: '#ccd3ec',
          100: '#eef0f8',
        },
        coral: {
          DEFAULT: '#F37367',
          400: '#F68B81',
          600: '#E25A4D',
        },
        proton: '#F37367',
        neutron: '#a9b4c8',
        electron: '#4cb5ff',
      },
      borderRadius: {
        lg: '4px',
        xl: '5px',
        '2xl': '6px',
        '3xl': '8px',
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 50px -20px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
