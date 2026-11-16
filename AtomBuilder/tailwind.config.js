/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // The Brain Maze site face. All families map to Poppins (the Brain logo font is not used for UI text).
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
        math: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['Poppins', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Dark scale built around The Brain Maze navy; still used inside the dark 3D stage.
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
          DEFAULT: '#f78677',
          400: '#F68B81',
          600: '#e67566',
        },
        // The Brain Maze site tokens (thebrainmaze.com).
        navy: { DEFAULT: '#304169', deep: '#1e2a47' },
        mist: '#f0f3fa',
        line: '#e3e8f2',
        muted: '#6b7c9e',
        proton: '#F37367',
        neutron: '#a9b4c8',
        electron: '#4cb5ff',
      },
      borderRadius: {
        lg: '4px',
        xl: '10px',
        '2xl': '10px',
        '3xl': '8px',
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 50px -20px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
