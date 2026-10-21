/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './*.html',
    './partials/**/*.html',
    './src/pages/**/*.html',
    './assets/js/**/*.js',
    './scripts/build-pages.js'
  ],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      nav: '1280px',
      xl: '1280px',
      '2xl': '1536px'
    },
    extend: {
      colors: {
        // Semantic tokens: values come from the active theme + section tone (see src/input.css)
        bg: 'var(--bg)',
        surf: 'var(--surf)',
        fg: 'var(--fg)',
        'fg-2': 'var(--fg-2)',
        'fg-3': 'var(--fg-3)',
        acc: 'var(--acc)',
        ui: 'var(--ui)',
        soft: 'var(--soft)',
        // Brand primitives (only for fills and non-text decoration)
        arc: '#FF5A1F',
        slag: '#14161A',
        bone: '#F4F0E7'
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', '"Arial Narrow"', 'Impact', 'sans-serif'],
        sans: ['"Public Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'Consolas', 'Menlo', 'monospace']
      },
      maxWidth: {
        wrap: '80rem'
      }
    }
  },
  plugins: []
};
