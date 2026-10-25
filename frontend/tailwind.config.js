/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'st-mat-bg': 'var(--st-mat-bg)',
        'st-mat-grid': 'var(--st-mat-grid)',
        'st-paper-card': 'var(--st-paper-card)',
        'st-paper-aux': 'var(--st-paper-aux)',
        'st-ink-primary': 'var(--st-ink-primary)',
        'st-ink-muted': 'var(--st-ink-muted)',
        'st-marker-primary': 'var(--st-marker-primary)',
        'st-marker-ai': 'var(--st-marker-ai)',
        'st-stamp-pow': 'var(--st-stamp-pow)',
        'st-tape-catchup': 'var(--st-tape-catchup)',
        'st-chalk-weekend': 'var(--st-chalk-weekend)',
        'st-red-pencil': 'var(--st-red-pencil)',
      },
      fontFamily: {
        sketch: ['"Shantell Sans"', 'Virgil', 'cursive', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      boxShadow: {
        'hard-sm': '3px 3px 0px #0F2029',
        'hard-md': '5px 5px 0px #0F2029',
        'hard-lg': '7px 7px 0px #0F2029',
        'hard-active': '6px 6px 0px #0F2029',
      },
    },
  },
  plugins: [],
}
