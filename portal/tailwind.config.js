/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Matching Oread, Syrinx, Mneme font stack
        display: ['Crimson Pro', 'Georgia', 'serif'],
        body: ['Work Sans', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // MedEd brand colors
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Tool-specific accent colors (matching Dashboard card colors)
        oread: '#10b981',    // Emerald - patient generation
        syrinx: '#8b5cf6',   // Violet - voice/scripts
        mneme: '#f59e0b',    // Amber - EMR/records
        echo: '#06b6d4',     // Cyan - AI tutor
      },
    },
  },
  plugins: [],
}
